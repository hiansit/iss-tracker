/**
 * Globe Controller - Globe.gl を用いた3D地球儀および複数周回軌跡・マーカーの描画制御
 */
class GlobeController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.globe = null;
        this.isTracking = true; // ISS追従カメラモード
        this.currentTelemetry = null;
        this.replayPosition = null; // リプレイ再生中の座標
        this.nightMode = false;

        // テクスチャ設定
        this.textures = {
            day: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            night: '//unpkg.com/three-globe/example/img/earth-night.jpg',
            bump: '//unpkg.com/three-globe/example/img/earth-topology.png',
            clouds: '//unpkg.com/three-globe/example/img/earth-clouds.png',
            sky: '//unpkg.com/three-globe/example/img/night-sky.png'
        };

        this.init();
    }

    /**
     * 初期化
     */
    init() {
        if (!window.Globe) {
            console.error("Globe.gl library is not loaded.");
            return;
        }

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.globe = Globe()(this.container)
            .width(width)
            .height(height)
            .globeImageUrl(this.textures.day)
            .bumpImageUrl(this.textures.bump)
            .backgroundImageUrl(this.textures.sky)
            .showAtmosphere(true)
            .atmosphereColor('#00d2ff')
            .atmosphereAltitude(0.20)
            // HTML要素によるISSマーカーの描画
            .htmlElementsData([])
            .htmlElement(d => this.createIssMarkerElement(d))
            // 地表のフットプリント（通信・可視範囲リング：上品なサイズに調整）
            .ringsData([])
            .ringColor(() => 'rgba(0, 240, 255, 0.6)')
            .ringMaxRadius(9)
            .ringPropagationSpeed(1.0)
            .ringRepeatPeriod(1500)
            // 軌跡および予測軌道
            .pathsData([])
            .pathPoints(d => d.points)
            .pathPointLat(p => p[0])
            .pathPointLng(p => p[1])
            .pathPointAlt(p => p[2])
            .pathColor(d => d.color)
            .pathDashLength(d => d.dashLength || 1)
            .pathDashGap(d => d.dashGap || 0)
            .pathDashAnimateTime(d => d.dashAnimateTime || 0)
            .pathStroke(d => d.stroke || 2);

        // カメラコントロールの設定
        const controls = this.globe.controls();
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 140;
        controls.maxDistance = 550;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0.4;

        controls.addEventListener('start', () => {
            if (this.onUserInteract) this.onUserInteract();
        });

        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // 初期のカメラ視点 (少し引いて全体をクリアに収める)
        this.globe.pointOfView({ lat: 20, lng: 135, altitude: 2.6 }, 1000);
    }

    handleResize() {
        if (!this.globe || !this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.globe.width(width).height(height);
    }

    /**
     * ISSのカスタムHTMLマーカー要素を作成
     */
    createIssMarkerElement(d) {
        const wrapper = document.createElement('div');
        wrapper.className = 'iss-3d-marker';

        wrapper.innerHTML = `
            <div class="iss-marker-pulse"></div>
            <div class="iss-marker-icon-box" title="国際宇宙ステーション (ISS)">
                <svg viewBox="0 0 64 64" class="iss-svg-icon">
                    <rect x="4" y="18" width="14" height="28" rx="2" fill="#00e5ff" opacity="0.85" stroke="#ffffff" stroke-width="1.2"/>
                    <line x1="4" y1="25" x2="18" y2="25" stroke="#003366" stroke-width="1"/>
                    <line x1="4" y1="32" x2="18" y2="32" stroke="#003366" stroke-width="1"/>
                    <line x1="4" y1="39" x2="18" y2="39" stroke="#003366" stroke-width="1"/>

                    <rect x="46" y="18" width="14" height="28" rx="2" fill="#00e5ff" opacity="0.85" stroke="#ffffff" stroke-width="1.2"/>
                    <line x1="46" y1="25" x2="60" y2="25" stroke="#003366" stroke-width="1"/>
                    <line x1="46" y1="32" x2="60" y2="32" stroke="#003366" stroke-width="1"/>
                    <line x1="46" y1="39" x2="60" y2="39" stroke="#003366" stroke-width="1"/>

                    <line x1="16" y1="32" x2="48" y2="32" stroke="#e0e0e0" stroke-width="2.5"/>
                    <rect x="27" y="24" width="10" height="16" rx="2.5" fill="#ffffff" stroke="#00f0ff" stroke-width="1.2"/>
                    <circle cx="32" cy="28" r="1.8" fill="#ff0055"/>
                    <circle cx="32" cy="35" r="2.0" fill="#00f0ff"/>
                </svg>
                <div class="iss-marker-label">ISS</div>
            </div>
        `;

        wrapper.style.pointerEvents = 'auto';
        wrapper.style.cursor = 'pointer';
        wrapper.addEventListener('click', () => {
            this.setTracking(true);
            this.focusIss(2.3);
        });

        return wrapper;
    }

    /**
     * テレメトリおよび複数周回軌跡データの更新
     */
    updateTelemetryAndTracks(telemetry, trackData, replayPos = null) {
        this.currentTelemetry = telemetry;
        this.replayPosition = replayPos;

        const targetLat = replayPos ? replayPos.lat : telemetry.latitude;
        const targetLng = replayPos ? replayPos.lng : telemetry.longitude;
        const markerAltitude = 0.08 + (telemetry.altitude / 6371);

        // 1. ISSマーカー
        this.globe.htmlElementsData([{
            lat: targetLat,
            lng: targetLng,
            alt: markerAltitude,
            telemetry: telemetry
        }]);

        // 2. 地表フットプリントリング
        this.globe.ringsData([{
            lat: targetLat,
            lng: targetLng
        }]);

        // 3. 複数周回軌道パスデータ
        const paths = [];

        if (trackData && trackData.segments) {
            trackData.segments.forEach(segment => {
                if (segment.length < 2) return;

                const avgDt = segment[0].dtSeconds;
                const isPast = avgDt <= 0;
                const pastMinutes = Math.abs(avgDt) / 60;

                const points = segment.map(pt => [
                    pt.lat,
                    pt.lng,
                    0.035
                ]);

                if (isPast) {
                    let color = 'rgba(255, 170, 0, 0.85)';
                    let stroke = 2.2;
                    if (pastMinutes > 95 && pastMinutes <= 190) {
                        color = 'rgba(255, 120, 30, 0.7)';
                        stroke = 1.8;
                    } else if (pastMinutes > 190) {
                        color = 'rgba(180, 100, 255, 0.45)';
                        stroke = 1.4;
                    }

                    paths.push({
                        points: points,
                        color: () => color,
                        stroke: stroke,
                        dashLength: 1,
                        dashGap: 0
                    });
                } else {
                    paths.push({
                        points: points,
                        color: () => 'rgba(0, 240, 255, 0.85)',
                        stroke: 1.8,
                        dashLength: 0.15,
                        dashGap: 0.08,
                        dashAnimateTime: 8000
                    });
                }
            });
        }

        this.globe.pathsData(paths);

        // 4. 追従モード（適度な距離でHUDと重ならない視野）
        if (this.isTracking) {
            const currentPov = this.globe.pointOfView();
            this.globe.pointOfView({
                lat: targetLat,
                lng: targetLng,
                altitude: Math.max(2.2, currentPov.altitude || 2.4)
            }, 1000);
        }
    }

    setTracking(enabled) {
        this.isTracking = enabled;
        if (enabled && this.currentTelemetry) {
            this.focusIss();
        }
    }

    focusIss(altitude = 2.4) {
        const lat = this.replayPosition ? this.replayPosition.lat : (this.currentTelemetry ? this.currentTelemetry.latitude : 0);
        const lng = this.replayPosition ? this.replayPosition.lng : (this.currentTelemetry ? this.currentTelemetry.longitude : 0);
        this.globe.pointOfView({ lat, lng, altitude }, 1500);
    }

    focusJapan() {
        this.isTracking = false;
        this.globe.pointOfView({ lat: 36.2048, lng: 138.2529, altitude: 2.2 }, 1500);
    }

    focusGlobal() {
        this.isTracking = false;
        this.globe.pointOfView({ altitude: 3.4 }, 1200);
    }

    toggleNightMode() {
        this.nightMode = !this.nightMode;
        if (this.globe) {
            this.globe.globeImageUrl(this.nightMode ? this.textures.night : this.textures.day);
        }
        return this.nightMode;
    }
}

window.GlobeController = GlobeController;
