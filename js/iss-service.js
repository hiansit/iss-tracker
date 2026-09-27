/**
 * ISS Service - 国際宇宙ステーションの位置情報取得サービス
 * 
 * 複数のAPIソース（WhereTheISS.at, Open Notify）に対応し、
 * HTTPS環境（GitHub Pages）でのMixed Content制限にも自動対応。
 */
class IssService {
    constructor() {
        this.apiSource = 'wheretheiss'; // 'wheretheiss' | 'open_notify'
        this.history = [];
        this.maxHistory = 120; // 航跡履歴の保持数
        this.lastPosition = null;
        this.updateInterval = 3000; // ミリ秒
        this.listeners = [];
        this.timerId = null;
        this.isRunning = false;

        // 海洋と大まかな地域の大円判定データ
        this.regions = [
            { name: "日本近海・東アジア", latMin: 20, latMax: 46, lonMin: 120, lonMax: 150 },
            { name: "北米大陸 (North America)", latMin: 25, latMax: 60, lonMin: -130, lonMax: -65 },
            { name: "南米大陸 (South America)", latMin: -55, latMax: 12, lonMin: -82, lonMax: -35 },
            { name: "ヨーロッパ (Europe)", latMin: 35, latMax: 65, lonMin: -10, lonMax: 40 },
            { name: "アフリカ大陸 (Africa)", latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
            { name: "アジア大陸 (Asia)", latMin: 5, latMax: 65, lonMin: 60, lonMax: 145 },
            { name: "オーストラリア・大洋州 (Oceania)", latMin: -45, latMax: -10, lonMin: 110, lonMax: 178 },
            { name: "太平洋 (Pacific Ocean)", latMin: -60, latMax: 60, lonMin: -180, lonMax: -120 },
            { name: "南太平洋 (South Pacific Ocean)", latMin: -60, latMax: 0, lonMin: -180, lonMax: -70 },
            { name: "大西洋 (Atlantic Ocean)", latMin: -60, latMax: 65, lonMin: -60, lonMax: 0 },
            { name: "インド洋 (Indian Ocean)", latMin: -60, latMax: 25, lonMin: 40, lonMax: 105 }
        ];
    }

    /**
     * リスナー登録 (コールバック関数: (telemetry) => void)
     */
    subscribe(callback) {
        this.listeners.push(callback);
    }

    /**
     * リスナーへの通知
     */
    notify(telemetry) {
        this.listeners.forEach(fn => fn(telemetry));
    }

    /**
     * APIソースの変更
     * @param {'wheretheiss' | 'open_notify'} source 
     */
    setApiSource(source) {
        this.apiSource = source;
        // 即座にフェッチを試みる
        if (this.isRunning) {
            this.fetchPosition();
        }
    }

    /**
     * 更新間隔の変更
     * @param {number} ms 
     */
    setUpdateInterval(ms) {
        this.updateInterval = Math.max(1000, ms);
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * 定期取得の開始
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.fetchPosition();
        this.timerId = setInterval(() => this.fetchPosition(), this.updateInterval);
    }

    /**
     * 定期取得の停止
     */
    stop() {
        this.isRunning = false;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * 位置データのフェッチ
     */
    async fetchPosition() {
        let telemetry = null;
        try {
            if (this.apiSource === 'wheretheiss') {
                telemetry = await this.fetchWhereTheIss();
            } else {
                telemetry = await this.fetchOpenNotify();
            }
        } catch (err) {
            console.warn(`[IssService] プライマリAPI (${this.apiSource}) 取得失敗:`, err);
            // フォールバック: wheretheiss がダメなら open_notify(proxy)、逆も同様
            try {
                if (this.apiSource === 'wheretheiss') {
                    telemetry = await this.fetchOpenNotify();
                } else {
                    telemetry = await this.fetchWhereTheIss();
                }
            } catch (fallbackErr) {
                console.error("[IssService] 全てのAPIフェッチに失敗しました:", fallbackErr);
                return;
            }
        }

        if (telemetry) {
            // 通過地域を推定
            telemetry.regionName = this.estimateRegion(telemetry.latitude, telemetry.longitude);

            // 履歴に追加
            this.history.push({
                lat: telemetry.latitude,
                lng: telemetry.longitude,
                alt: telemetry.altitude,
                time: telemetry.timestamp
            });
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            this.lastPosition = telemetry;
            this.notify(telemetry);
        }
    }

    /**
     * Where The ISS at? API (HTTPS, 速度・高度対応)
     */
    async fetchWhereTheIss() {
        const url = "https://api.wheretheiss.at/v1/satellites/25544";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            return {
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                altitude: Math.round(Number(data.altitude) * 10) / 10, // km
                velocity: Math.round(Number(data.velocity)), // km/h
                visibility: data.visibility || "unknown", // daylight / eclipsed
                footprint: Math.round(Number(data.footprint) || 4500), // 可視半径 km
                timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
                solarLat: data.solar_lat,
                solarLon: data.solar_lon,
                source: "WhereTheISS.at (HTTPS)"
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Open Notify API (HTTP) または Mixed Content 回避用プロキシ
     */
    async fetchOpenNotify() {
        const isHttps = window.location.protocol === 'https:';
        // HTTPS環境ではブラウザがHTTP fetchをブロックするため、CORSプロキシを経由
        const rawUrl = "http://api.open-notify.org/iss-now.json";
        const url = isHttps 
            ? `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`
            : rawUrl;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.message !== 'success' || !data.iss_position) {
                throw new Error("Invalid OpenNotify response payload");
            }

            const lat = Number(data.iss_position.latitude);
            const lng = Number(data.iss_position.longitude);
            const timestamp = data.timestamp ? data.timestamp * 1000 : Date.now();

            // Open Notifyは高度と速度を含まないため、標準軌道値または前地点からの計算
            let velocity = 27600; // 平均軌道速度 (約 27,600 km/h)
            if (this.lastPosition && this.lastPosition.timestamp) {
                const dt = (timestamp - this.lastPosition.timestamp) / 1000; // 秒
                if (dt > 0 && dt < 60) {
                    const distKm = this.calculateDistance(
                        this.lastPosition.latitude, this.lastPosition.longitude,
                        lat, lng
                    );
                    velocity = Math.round((distKm / dt) * 3600);
                }
            }

            return {
                latitude: lat,
                longitude: lng,
                altitude: 418.0, // 平均軌道高度 ~420km
                velocity: velocity,
                visibility: "unknown",
                footprint: 4500,
                timestamp: timestamp,
                source: isHttps ? "Open-Notify (CORS Proxy)" : "Open-Notify (Direct)"
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * 2点間の球面距離計算（ハバーサイン公式: km）
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球半径 (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * 緯度経度からおおよその地域名や海洋名を推定
     */
    estimateRegion(lat, lon) {
        // 正規化
        let normLon = lon;
        while (normLon > 180) normLon -= 360;
        while (normLon < -180) normLon += 360;

        for (const reg of this.regions) {
            if (lat >= reg.latMin && lat <= reg.latMax && normLon >= reg.lonMin && normLon <= reg.lonMax) {
                return reg.name;
            }
        }
        if (lat > 60) return "北極圏近海 (Arctic Region)";
        if (lat < -60) return "南極海 (Southern Ocean)";
        return "大洋上空 (Open Ocean)";
    }

    /**
     * 現在の履歴（過去の航跡リスト）を取得
     */
    getHistory() {
        return this.history;
    }
}

window.IssService = IssService;
