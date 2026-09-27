/**
 * Orbit Calculator - ISSの軌道力学計算および複数周回地上軌跡（Ground Track）ジェネレーター
 */
class OrbitCalculator {
    constructor() {
        // ISSの標準軌道要素
        this.inclinationDeg = 51.64; // 軌道傾斜角 (度)
        this.inclinationRad = this.inclinationDeg * (Math.PI / 180);
        this.periodMinutes = 92.85; // 軌道周期 (約92.85分)
        this.periodSeconds = this.periodMinutes * 60;
        this.meanAltitude = 420; // km
        this.earthRadius = 6371; // km
        this.earthRotationRate = 360 / 86164.0905; // 地球自転速度 (度/秒: 約0.004178度/秒)
        this.precessionRate = -5.0 / 86400; // J2摂動による昇交点西進 (度/秒: 約 -5度/日)
    }

    /**
     * 現在の位置(lat, lon)と、直近の過去地点から軌道位相(Phase)と昇交点経度(RAAN)を特定
     */
    solveOrbitState(lat0, lon0, prevLat, prevLon, dtSec = 3) {
        const latRad = lat0 * (Math.PI / 180);
        let sinPhi = Math.sin(latRad) / Math.sin(this.inclinationRad);
        sinPhi = Math.max(-1, Math.min(1, sinPhi));

        // 進行方向（北上中 ascending か 南下中 descending か）
        const isAscending = prevLat !== undefined && prevLat !== null ? (lat0 >= prevLat) : true;

        let u0 = Math.asin(sinPhi); // 昇交点からの引数 (Argument of Latitude: ラジアン)
        if (!isAscending) {
            u0 = Math.PI - u0;
        }
        if (u0 < 0) u0 += 2 * Math.PI;

        // 軌道面内での赤道面からの経度差 Δλ
        const cosU = Math.cos(u0);
        const cosInc = Math.cos(this.inclinationRad);
        const deltaLonRad = Math.atan2(sinPhi * cosInc, cosU);
        const deltaLonDeg = deltaLonRad * (180 / Math.PI);

        // 昇交点の経度 (Longitude of Ascending Node)
        let nodeLon = lon0 - deltaLonDeg;
        nodeLon = this.normalizeLon(nodeLon);

        return {
            argumentOfLatitude: u0,
            nodeLongitude: nodeLon,
            isAscending: isAscending
        };
    }

    /**
     * 基準点から時間オフセット deltaSeconds におけるISSの地上座標 (lat, lon) を計算
     * @param {number} deltaSeconds - 過去ならマイナス、未来ならプラス
     */
    predictPosition(orbitState, deltaSeconds) {
        const meanMotion = (2 * Math.PI) / this.periodSeconds; // ラジアン/秒
        const u = orbitState.argumentOfLatitude + meanMotion * deltaSeconds;

        // 緯度
        const sinLat = Math.sin(this.inclinationRad) * Math.sin(u);
        const latRad = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        const latDeg = latRad * (180 / Math.PI);

        // 軌道面経度差
        const y = Math.sin(u) * Math.cos(this.inclinationRad);
        const x = Math.cos(u);
        const deltaLonDeg = Math.atan2(y, x) * (180 / Math.PI);

        // 地球自転＋摂動による昇交点の移動（西進）
        const totalWestShiftRate = this.earthRotationRate - this.precessionRate; // 度/秒
        const nodeShiftDeg = totalWestShiftRate * deltaSeconds;

        let lonDeg = orbitState.nodeLongitude + deltaLonDeg - nodeShiftDeg;
        lonDeg = this.normalizeLon(lonDeg);

        return {
            latitude: latDeg,
            longitude: lonDeg,
            altitude: this.meanAltitude
        };
    }

    /**
     * 過去 pastMinutes 分間（または指定分数）の航跡ポイント列を生成
     * @param {number} lat0 現在緯度
     * @param {number} lon0 現在経度
     * @param {number} pastMinutes 過去分数 (例: 93, 186, 372, 1440)
     * @param {number} futureMinutes 未来分数 (デフォルト: 93分=1周分)
     * @param {number} stepSeconds サンプリング間隔 (秒)
     */
    generateGroundTracks(lat0, lon0, prevLat, prevLon, pastMinutes = 93, futureMinutes = 93, stepSeconds = 45) {
        const orbitState = this.solveOrbitState(lat0, lon0, prevLat, prevLon);

        const pastSeconds = pastMinutes * 60;
        const futSeconds = futureMinutes * 60;

        const points = [];
        // 過去から現在、そして未来へ順番に計算
        for (let dt = -pastSeconds; dt <= futSeconds; dt += stepSeconds) {
            const pos = this.predictPosition(orbitState, dt);
            const orbitIndex = Math.floor(dt / this.periodSeconds); // 0が現在周回、-1が1周前、+1が1周後

            points.push({
                lat: pos.latitude,
                lng: pos.longitude,
                dtSeconds: dt,
                orbitIndex: orbitIndex,
                isPast: dt <= 0,
                isFuture: dt > 0
            });
        }

        // 2D地図用に、日付変更線（経度±180°）をまたぐ部分でセグメント分割
        const segments = this.splitTrackByDateline(points);

        return {
            allPoints: points,
            segments: segments,
            pastMinutes: pastMinutes,
            futureMinutes: futureMinutes
        };
    }

    /**
     * 日付変更線（経度180度またぎ）で線を切断し、地図描画時の突き抜けを防止する
     */
    splitTrackByDateline(points) {
        const segments = [];
        if (points.length === 0) return segments;

        let currentSegment = [points[0]];

        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];

            // 経度差が180度を超えた場合は日付変更線をまたいだと判定
            const dLon = p1.lng - p0.lng;
            if (Math.abs(dLon) > 180) {
                // セグメントを閉じて新しいセグメントを開始
                if (currentSegment.length > 1) {
                    segments.push(currentSegment);
                }
                currentSegment = [p1];
            } else {
                currentSegment.push(p1);
            }
        }

        if (currentSegment.length > 1) {
            segments.push(currentSegment);
        }

        return segments;
    }

    /**
     * 経度を -180 ~ +180 の範囲に正規化
     */
    normalizeLon(lon) {
        let l = lon % 360;
        if (l > 180) l -= 360;
        if (l < -180) l += 360;
        return l;
    }
}

window.OrbitCalculator = OrbitCalculator;
