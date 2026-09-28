/**
 * ISS Service - 国際宇宙ステーションの位置情報取得サービス
 * 
 * 公式NORAD衛星データ（WhereTheISS.at API）から
 * HTTPS直接暗号化通信でリアルタイムな位置・高度・速度を取得します。
 * プロキシや外部中継は一切使用せず、100%正規のダイレクト通信です。
 */
class IssService {
    constructor() {
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
     * 位置データのフェッチ（正規HTTPS直接通信）
     */
    async fetchPosition() {
        let telemetry = null;
        try {
            telemetry = await this.fetchWhereTheIss();
        } catch (err) {
            console.warn("[IssService] データ取得一時エラー:", err.message);
            return;
        }

        if (telemetry) {
            telemetry.regionName = this.estimateRegion(telemetry.latitude, telemetry.longitude);

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
     * Where The ISS at? API (公式正規HTTPS通信)
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
                visibility: data.visibility || "unknown",
                footprint: Math.round(Number(data.footprint) || 4500),
                timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
                solarLat: data.solar_lat,
                solarLon: data.solar_lon,
                source: "WhereTheISS.at (正規HTTPS直接通信)"
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * 緯度経度からおおよその地域名や海洋名を推定
     */
    estimateRegion(lat, lon) {
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

    getHistory() {
        return this.history;
    }
}

window.IssService = IssService;
