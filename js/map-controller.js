/**
 * Map Controller - 2D世界地図（メルカトル図法・イコールアース図法・正距円筒図法）の描画制御
 * D3.js (d3-geo / d3-geo-projection) + HTML5 Canvas による高速・高品位描画
 */
class MapController {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.projectionType = 'equalEarth'; // 'equalEarth' | 'mercator' | 'equirectangular'
        this.projection = null;
        this.geoPath = null;
        this.worldData = null;
        this.currentTelemetry = null;
        this.trackData = null;
        this.replayPosition = null;
        this.isReplaying = false;

        this.width = 0;
        this.height = 0;

        this.init();
    }

    /**
     * 初期化と世界地図データの読み込み
     */
    async init() {
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());

        this.updateProjection();

        // 世界地図データのロード (world-atlas TopoJSON)
        try {
            const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            if (res.ok) {
                const topo = await res.json();
                if (window.topojson) {
                    this.worldData = {
                        land: topojson.feature(topo, topo.objects.land),
                        countries: topojson.feature(topo, topo.objects.countries)
                    };
                }
            }
        } catch (e) {
            console.warn('[MapController] TopoJSON ロード失敗。内蔵グリッドと簡易輪郭で描画します:', e);
        }

        this.render();
    }

    /**
     * 投影法の変更 ('equalEarth' | 'mercator' | 'equirectangular')
     */
    setProjection(type) {
        this.projectionType = type;
        this.updateProjection();
        this.render();
    }

    /**
     * 投影法オブジェクトの更新（上下のUIパネルを避けたセーフエリアに美しくセンタリング）
     */
    updateProjection() {
        if (!window.d3) return;

        const w = this.width;
        const h = this.height;

        // 上部ヘッダー（約65px）と下部フッター（約80px）を避けた描画領域
        const padTop = 60;
        const padBottom = 80;
        const padX = 20;

        let proj;
        switch (this.projectionType) {
            case 'mercator':
                const availH = Math.max(200, h - (padTop + padBottom));
                const scale = Math.min((w - padX * 2) / (2 * Math.PI), availH / 3.0);
                proj = d3.geoMercator()
                    .scale(scale)
                    .translate([w / 2, padTop + availH / 2]);
                break;

            case 'equirectangular':
                proj = d3.geoEquirectangular()
                    .fitExtent([[padX, padTop], [w - padX, h - padBottom]], { type: "Sphere" });
                break;

            case 'equalEarth':
            default:
                if (d3.geoEqualEarth) {
                    proj = d3.geoEqualEarth();
                } else {
                    proj = d3.geoEquirectangular();
                }
                proj.fitExtent([[padX, padTop], [w - padX, h - padBottom]], { type: "Sphere" });
                break;
        }

        this.projection = proj;
        this.geoPath = d3.geoPath(this.projection, this.ctx);
    }

    /**
     * キャンバスサイズのリサイズ
     */
    handleResize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const dpr = window.devicePixelRatio || 1;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        this.updateProjection();
        this.render();
    }

    /**
     * テレメトリおよび航跡データの更新
     */
    updateData(telemetry, trackData, replayPos = null) {
        this.currentTelemetry = telemetry;
        this.trackData = trackData;
        this.replayPosition = replayPos;
        this.render();
    }

    /**
     * 描画メインルーチン
     */
    render() {
        if (!this.ctx || !this.projection) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        // 1. 深海・宇宙背景
        ctx.fillStyle = '#070c18';
        ctx.fillRect(0, 0, w, h);

        // 2. 地球儀球体・外枠 (Sphere)
        ctx.save();
        ctx.beginPath();
        this.geoPath({ type: "Sphere" });
        ctx.fillStyle = '#0a1329';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.clip();

        // 3. 経緯度グリッド線 (Graticule)
        if (d3.geoGraticule) {
            const graticule = d3.geoGraticule().step([30, 30]);
            ctx.beginPath();
            this.geoPath(graticule());
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            const outline = d3.geoGraticule().step([90, 90]);
            ctx.beginPath();
            this.geoPath(outline());
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // 4. 大陸・国の描画
        if (this.worldData && this.worldData.land) {
            ctx.beginPath();
            this.geoPath(this.worldData.land);
            ctx.fillStyle = 'rgba(24, 42, 69, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            if (this.worldData.countries) {
                ctx.beginPath();
                this.geoPath(this.worldData.countries);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        } else {
            this.drawFallbackGrid();
        }

        // 5. 昼夜明暗帯（ターミネーター）の描画
        this.drawDayNightTerminator(ctx);

        // 6. 複数周回軌跡ライン（Ground Track）の描画
        if (this.trackData && this.trackData.segments) {
            this.drawGroundTracks(ctx, this.trackData.segments);
        }

        ctx.restore();

        // 7. ISSマーカー（現在位置またはリプレイ位置）の描画
        const targetPos = this.replayPosition || (this.currentTelemetry ? {
            lat: this.currentTelemetry.latitude,
            lng: this.currentTelemetry.longitude
        } : null);

        if (targetPos) {
            this.drawIssMarker(ctx, targetPos.lat, targetPos.lng);
        }
    }

    /**
     * 昼夜境界線（ターミネーター）の近似描画
     */
    drawDayNightTerminator(ctx) {
        if (!this.currentTelemetry) return;
        const now = new Date(this.currentTelemetry.timestamp || Date.now());

        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const solarDeclination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
        const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        const solarLon = (12 - utcHours) * 15;

        if (d3.geoCircle) {
            const antipodal = [
                solarLon > 0 ? solarLon - 180 : solarLon + 180,
                -solarDeclination
            ];
            const darkCircle = d3.geoCircle().center(antipodal).radius(90);
            ctx.beginPath();
            this.geoPath(darkCircle());
            ctx.fillStyle = 'rgba(4, 7, 18, 0.48)';
            ctx.fill();
        }
    }

    /**
     * 複数周回の地上軌跡を描画
     */
    drawGroundTracks(ctx, segments) {
        ctx.save();

        segments.forEach(segment => {
            if (segment.length < 2) return;

            const avgDt = segment[0].dtSeconds;
            const isPast = avgDt <= 0;
            const pastMinutes = Math.abs(avgDt) / 60;

            ctx.beginPath();
            let first = true;

            segment.forEach(pt => {
                const coords = this.projection([pt.lng, pt.lat]);
                if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    if (first) {
                        ctx.moveTo(coords[0], coords[1]);
                        first = false;
                    } else {
                        ctx.lineTo(coords[0], coords[1]);
                    }
                }
            });

            if (isPast) {
                const fade = Math.max(0.15, 1 - (pastMinutes / 1440));
                if (pastMinutes < 95) {
                    ctx.strokeStyle = `rgba(255, 170, 0, ${0.85 * fade})`;
                    ctx.lineWidth = 2.4;
                } else if (pastMinutes < 190) {
                    ctx.strokeStyle = `rgba(255, 130, 40, ${0.7 * fade})`;
                    ctx.lineWidth = 1.8;
                } else {
                    ctx.strokeStyle = `rgba(180, 100, 255, ${0.5 * fade})`;
                    ctx.lineWidth = 1.2;
                }
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
                ctx.lineWidth = 2.0;
                ctx.setLineDash([5, 4]);
            }

            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * ISSアイコン・ビーコンマーカーの描画（控えめで鮮明なサイズ）
     */
    drawIssMarker(ctx, lat, lng) {
        const coords = this.projection([lng, lat]);
        if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

        const [x, y] = coords;

        ctx.save();

        // 1. 通信可能フットプリントサークル（控えめなサイズ）
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. パルスビーコンリング
        const pulseTime = (Date.now() % 1600) / 1600;
        const pulseR = 6 + pulseTime * 16;
        ctx.beginPath();
        ctx.arc(x, y, pulseR, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(0, 240, 255, ${1 - pulseTime})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. 中心コアと発光
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. ISS ラベル（見やすい位置）
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText('🛰️ ISS', x + 8, y - 6);

        ctx.restore();
    }

    /**
     * フォールバック用グリッド線
     */
    drawFallbackGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        ctx.lineWidth = 0.5;
        for (let lat = -60; lat <= 60; lat += 30) {
            ctx.beginPath();
            for (let lon = -180; lon <= 180; lon += 5) {
                const p = this.projection([lon, lat]);
                if (p) lon === -180 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
            }
            ctx.stroke();
        }
    }
}

window.MapController = MapController;
