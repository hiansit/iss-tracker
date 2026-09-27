/**
 * Main Application Logic - UI制御、イベント連携、3D/2Dビュー切替、タイムトラベル＆リプレイ
 */
document.addEventListener('DOMContentLoaded', () => {
    // サービスの初期化
    const issService = new IssService();
    const orbitCalc = new OrbitCalculator();
    const globeCtrl = new GlobeController('globe-container');
    const mapCtrl = new MapController('world-map-canvas');

    // 状態管理
    const state = {
        currentView: 'globe', // 'globe' | 'map'
        pastMinutes: 93, // 過去の航跡時間（デフォルト1周: 約93分）
        isReplaying: false,
        replayTimerId: null,
        lastTelemetry: null,
        prevTelemetry: null,
        currentTrackData: null
    };

    // UIエレメントのキャッシュ
    const ui = {
        globeLayer: document.getElementById('globe-container'),
        mapLayer: document.getElementById('map-container'),
        
        btnViewGlobe: document.getElementById('btn-view-globe'),
        btnViewMap: document.getElementById('btn-view-map'),
        projectionWrapper: document.getElementById('projection-selector-wrapper'),
        selectProjection: document.getElementById('select-projection'),

        lat: document.getElementById('telemetry-lat'),
        lon: document.getElementById('telemetry-lon'),
        alt: document.getElementById('telemetry-alt'),
        spd: document.getElementById('telemetry-spd'),
        region: document.getElementById('telemetry-region'),
        time: document.getElementById('telemetry-time'),
        statusBadge: document.getElementById('status-indicator'),
        sourceName: document.getElementById('source-name'),
        
        // ミニウィジェット
        miniLat: document.getElementById('mini-lat'),
        miniLon: document.getElementById('mini-lon'),
        miniAlt: document.getElementById('mini-alt'),
        miniSpd: document.getElementById('mini-spd'),

        // コントロール
        btnToggleTimetravel: document.getElementById('btn-toggle-timetravel'),
        btnTrack: document.getElementById('btn-track'),
        btnJapan: document.getElementById('btn-japan'),
        btnDayNight: document.getElementById('btn-daynight'),
        btnWidget: document.getElementById('btn-widget-toggle'),
        btnPip: document.getElementById('btn-pip'),
        btnSettings: document.getElementById('btn-settings'),
        
        // タイムトラベル / リプレイ
        timeTravelPanel: document.getElementById('time-travel-panel'),
        btnCloseTimetravel: document.getElementById('btn-close-timetravel'),
        btnReplay: document.getElementById('btn-replay'),
        replayIcon: document.getElementById('replay-icon'),
        replayText: document.getElementById('replay-text'),
        sliderPastTime: document.getElementById('slider-past-time'),
        labelPastTime: document.getElementById('label-past-time'),
        timeTravelStatus: document.getElementById('time-travel-status'),
        presetButtons: document.querySelectorAll('.preset-btn'),

        // 設定モーダル
        modalSettings: document.getElementById('settings-modal'),
        btnCloseSettings: document.getElementById('btn-close-settings'),
        selectApiSource: document.getElementById('select-api-source'),
        rangeInterval: document.getElementById('range-interval'),
        labelInterval: document.getElementById('label-interval')
    };

    // ユーザーが3D地球を手動ドラッグしたときの処理
    globeCtrl.onUserInteract = () => {
        if (globeCtrl.isTracking) {
            globeCtrl.setTracking(false);
            updateTrackButtonUI(false);
        }
    };

    /**
     * 航跡データの再計算・描画更新
     */
    function updateTracksAndRender(replayPos = null) {
        if (!state.lastTelemetry) return;

        const prevLat = state.prevTelemetry ? state.prevTelemetry.latitude : null;
        const prevLon = state.prevTelemetry ? state.prevTelemetry.longitude : null;

        state.currentTrackData = orbitCalc.generateGroundTracks(
            state.lastTelemetry.latitude,
            state.lastTelemetry.longitude,
            prevLat,
            prevLon,
            state.pastMinutes,
            93, // 未来1周
            40  // 40秒間隔で精密プロット
        );

        globeCtrl.updateTelemetryAndTracks(state.lastTelemetry, state.currentTrackData, replayPos);
        mapCtrl.updateData(state.lastTelemetry, state.currentTrackData, replayPos);
    }

    /**
     * テレメトリ受信時のリスナー
     */
    issService.subscribe((telemetry) => {
        state.prevTelemetry = state.lastTelemetry;
        state.lastTelemetry = telemetry;

        if (!state.isReplaying) {
            updateTracksAndRender();
            updateTelemetryUI(telemetry);
        }
    });

    /**
     * UIの更新
     */
    function updateTelemetryUI(t, isReplay = false) {
        const latStr = `${Math.abs(t.latitude).toFixed(2)}° ${t.latitude >= 0 ? 'N' : 'S'}`;
        const lonStr = `${Math.abs(t.longitude).toFixed(2)}° ${t.longitude >= 0 ? 'E' : 'W'}`;
        const altStr = `${t.altitude.toLocaleString()} km`;
        const spdStr = `${t.velocity.toLocaleString()} km/h`;

        if (ui.lat) ui.lat.textContent = latStr;
        if (ui.lon) ui.lon.textContent = lonStr;
        if (ui.alt) ui.alt.textContent = altStr;
        if (ui.spd) ui.spd.textContent = spdStr;
        if (ui.region) ui.region.textContent = t.regionName;
        if (ui.sourceName) ui.sourceName.textContent = t.source;

        if (ui.miniLat) ui.miniLat.textContent = latStr;
        if (ui.miniLon) ui.miniLon.textContent = lonStr;
        if (ui.miniAlt) ui.miniAlt.textContent = altStr;
        if (ui.miniSpd) ui.miniSpd.textContent = spdStr;

        if (ui.time) {
            const date = new Date(t.timestamp);
            ui.time.textContent = date.toLocaleTimeString('ja-JP', { hour12: false });
        }
    }

    /**
     * タイムトラベルパネルの開閉制御
     */
    function toggleTimeTravelPanel(open = null) {
        if (!ui.timeTravelPanel) return;
        const isCollapsed = ui.timeTravelPanel.classList.contains('collapsed');
        const shouldOpen = open !== null ? open : isCollapsed;

        if (shouldOpen) {
            ui.timeTravelPanel.classList.remove('collapsed');
            if (ui.btnToggleTimetravel) ui.btnToggleTimetravel.classList.add('active');
        } else {
            ui.timeTravelPanel.classList.add('collapsed');
            if (ui.btnToggleTimetravel) ui.btnToggleTimetravel.classList.remove('active');
        }
    }

    if (ui.btnToggleTimetravel) {
        ui.btnToggleTimetravel.addEventListener('click', () => toggleTimeTravelPanel());
    }
    if (ui.btnCloseTimetravel) {
        ui.btnCloseTimetravel.addEventListener('click', () => toggleTimeTravelPanel(false));
    }

    /**
     * ビューの切り替え (3D地球儀 / 2D世界地図)
     */
    function switchView(viewName) {
        state.currentView = viewName;

        if (viewName === 'globe') {
            ui.globeLayer.classList.add('active');
            ui.mapLayer.classList.remove('active');
            ui.btnViewGlobe.classList.add('active');
            ui.btnViewMap.classList.remove('active');
            ui.projectionWrapper.style.display = 'none';
            globeCtrl.handleResize();
        } else {
            ui.globeLayer.classList.remove('active');
            ui.mapLayer.classList.add('active');
            ui.btnViewGlobe.classList.remove('active');
            ui.btnViewMap.classList.add('active');
            ui.projectionWrapper.style.display = 'flex';
            mapCtrl.handleResize();
            mapCtrl.render();
        }
    }

    if (ui.btnViewGlobe) {
        ui.btnViewGlobe.addEventListener('click', () => switchView('globe'));
    }
    if (ui.btnViewMap) {
        ui.btnViewMap.addEventListener('click', () => switchView('map'));
    }

    // 図法セレクター
    if (ui.selectProjection) {
        ui.selectProjection.addEventListener('change', (e) => {
            mapCtrl.setProjection(e.target.value);
        });
    }

    /**
     * 過去周回数・タイムトラベルスライダー操作
     */
    function setPastMinutes(minutes) {
        state.pastMinutes = Math.max(0, Math.min(1440, minutes));

        if (ui.sliderPastTime) ui.sliderPastTime.value = state.pastMinutes;
        if (ui.labelPastTime) {
            const h = (state.pastMinutes / 60).toFixed(1);
            ui.labelPastTime.textContent = state.pastMinutes === 0 ? '現在のみ' : `${state.pastMinutes} 分前 (${h}h)`;
        }

        if (ui.presetButtons) {
            ui.presetButtons.forEach(btn => {
                const btnM = Number(btn.getAttribute('data-minutes'));
                btn.classList.toggle('active', btnM === state.pastMinutes);
            });
        }

        if (!state.isReplaying) {
            updateTracksAndRender();
        }
    }

    if (ui.sliderPastTime) {
        ui.sliderPastTime.addEventListener('input', (e) => {
            setPastMinutes(Number(e.target.value));
        });
    }

    if (ui.presetButtons) {
        ui.presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const m = Number(btn.getAttribute('data-minutes'));
                setPastMinutes(m);
            });
        });
    }

    /**
     * 飛行アニメーション再生（Replay）機能
     */
    function toggleReplay() {
        if (state.isReplaying) {
            stopReplay();
        } else {
            startReplay();
        }
    }

    function startReplay() {
        if (!state.lastTelemetry || state.pastMinutes <= 0) {
            alert("過去の周回時間を1分以上に設定してください。");
            return;
        }

        toggleTimeTravelPanel(true); // 再生時はパネルを開く
        state.isReplaying = true;
        ui.btnReplay.classList.add('active');
        ui.replayIcon.textContent = '⏸';
        ui.replayText.textContent = '停止';

        const pastPoints = (state.currentTrackData ? state.currentTrackData.allPoints : [])
            .filter(p => p.dtSeconds <= 0);

        if (pastPoints.length < 2) {
            stopReplay();
            return;
        }

        let currentIndex = 0;
        const totalPoints = pastPoints.length;
        const startTime = Date.now();
        const durationMs = 12000;

        function animateFrame() {
            if (!state.isReplaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / durationMs);
            const index = Math.floor(progress * (totalPoints - 1));
            const point = pastPoints[index];

            if (point) {
                const minutesAgo = Math.round(Math.abs(point.dtSeconds) / 60);
                const replayTime = new Date(state.lastTelemetry.timestamp + point.dtSeconds * 1000);

                ui.timeTravelStatus.textContent = `再生: ${minutesAgo}分前`;

                const replayPos = { lat: point.lat, lng: point.lng };
                globeCtrl.updateTelemetryAndTracks(state.lastTelemetry, state.currentTrackData, replayPos);
                mapCtrl.updateData(state.lastTelemetry, state.currentTrackData, replayPos);

                updateTelemetryUI({
                    latitude: point.lat,
                    longitude: point.lng,
                    altitude: state.lastTelemetry.altitude,
                    velocity: state.lastTelemetry.velocity,
                    timestamp: replayTime.getTime(),
                    regionName: issService.estimateRegion(point.lat, point.lng),
                    source: "軌道リプレイシミュレーション"
                }, true);
            }

            if (progress < 1) {
                state.replayTimerId = requestAnimationFrame(animateFrame);
            } else {
                setTimeout(() => stopReplay(), 800);
            }
        }

        state.replayTimerId = requestAnimationFrame(animateFrame);
    }

    function stopReplay() {
        state.isReplaying = false;
        if (state.replayTimerId) {
            cancelAnimationFrame(state.replayTimerId);
            state.replayTimerId = null;
        }
        ui.btnReplay.classList.remove('active');
        ui.replayIcon.textContent = '▶';
        ui.replayText.textContent = '飛行再生';
        ui.timeTravelStatus.textContent = 'リアルタイム';

        if (state.lastTelemetry) {
            updateTracksAndRender();
            updateTelemetryUI(state.lastTelemetry);
        }
    }

    if (ui.btnReplay) {
        ui.btnReplay.addEventListener('click', toggleReplay);
    }

    // 追従ボタン
    function updateTrackButtonUI(isTracking) {
        if (!ui.btnTrack) return;
        if (isTracking) {
            ui.btnTrack.classList.add('active');
            ui.btnTrack.querySelector('.btn-text').textContent = '追従: ON';
        } else {
            ui.btnTrack.classList.remove('active');
            ui.btnTrack.querySelector('.btn-text').textContent = '追従: OFF';
        }
    }

    if (ui.btnTrack) {
        ui.btnTrack.addEventListener('click', () => {
            const nextState = !globeCtrl.isTracking;
            globeCtrl.setTracking(nextState);
            updateTrackButtonUI(nextState);
        });
    }

    // 日本ビュー
    if (ui.btnJapan) {
        ui.btnJapan.addEventListener('click', () => {
            if (state.currentView !== 'globe') switchView('globe');
            globeCtrl.focusJapan();
            updateTrackButtonUI(false);
        });
    }

    // 昼/夜テクスチャ切り替え
    if (ui.btnDayNight) {
        ui.btnDayNight.addEventListener('click', () => {
            const isNight = globeCtrl.toggleNightMode();
            ui.btnDayNight.classList.toggle('active', isNight);
            ui.btnDayNight.querySelector('.btn-text').textContent = isNight ? '夜景モード' : '昼景モード';
        });
    }

    // ウィジェット（コンパクト）モード切り替え
    if (ui.btnWidget) {
        ui.btnWidget.addEventListener('click', () => {
            document.body.classList.toggle('widget-mode');
            const isWidget = document.body.classList.contains('widget-mode');
            ui.btnWidget.classList.toggle('active', isWidget);
            setTimeout(() => {
                globeCtrl.handleResize();
                mapCtrl.handleResize();
            }, 300);
        });
    }

    // Document Picture-in-Picture (PiP)
    if (ui.btnPip) {
        if ('documentPictureInPicture' in window) {
            ui.btnPip.addEventListener('click', async () => {
                try {
                    if (window.documentPictureInPicture.window) {
                        window.documentPictureInPicture.window.close();
                        return;
                    }

                    const pipWindow = await window.documentPictureInPicture.requestWindow({
                        width: 360,
                        height: 440,
                    });

                    [...document.styleSheets].forEach((styleSheet) => {
                        try {
                            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                            const style = document.createElement('style');
                            style.textContent = cssRules;
                            pipWindow.document.head.appendChild(style);
                        } catch (e) {
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.type = styleSheet.type;
                            link.media = styleSheet.media;
                            link.href = styleSheet.href;
                            pipWindow.document.head.appendChild(link);
                        }
                    });

                    pipWindow.document.body.className = 'pip-mode';
                    const pipContainer = document.createElement('div');
                    pipContainer.style.width = '100vw';
                    pipContainer.style.height = '100vh';
                    pipContainer.style.position = 'relative';

                    const pipHud = document.createElement('div');
                    pipHud.className = 'pip-hud';
                    pipHud.innerHTML = `
                        <div class="pip-title">🛰️ ISS REALTIME</div>
                        <div class="pip-metrics"><span id="pip-lat">--</span> | <span id="pip-lon">--</span></div>
                        <div class="pip-metrics-sub">ALT: <span id="pip-alt">--</span> | SPD: <span id="pip-spd">--</span></div>
                    `;
                    pipContainer.appendChild(pipHud);
                    pipWindow.document.body.appendChild(pipContainer);

                    const pipGlobe = Globe()(pipContainer)
                        .width(360)
                        .height(440)
                        .globeImageUrl(globeCtrl.textures.day)
                        .backgroundImageUrl(globeCtrl.textures.sky)
                        .showAtmosphere(true)
                        .atmosphereColor('#00d2ff')
                        .htmlElementsData(globeCtrl.globe.htmlElementsData())
                        .htmlElement(d => globeCtrl.createIssMarkerElement(d))
                        .pathsData(globeCtrl.globe.pathsData())
                        .pathPoints(d => d.points)
                        .pathPointLat(p => p[0])
                        .pathPointLng(p => p[1])
                        .pathPointAlt(p => p[2])
                        .pathColor(d => d.color)
                        .pathDashLength(d => d.dashLength || 1)
                        .pathDashGap(d => d.dashGap || 0)
                        .pathStroke(d => d.stroke || 2);

                    const pipListener = (t) => {
                        pipGlobe.htmlElementsData([{ lat: t.latitude, lng: t.longitude, alt: 0.1, telemetry: t }]);
                        pipGlobe.pointOfView({ lat: t.latitude, lng: t.longitude }, 800);

                        const pLat = pipWindow.document.getElementById('pip-lat');
                        const pLon = pipWindow.document.getElementById('pip-lon');
                        const pAlt = pipWindow.document.getElementById('pip-alt');
                        const pSpd = pipWindow.document.getElementById('pip-spd');
                        if (pLat) pLat.textContent = `${Math.abs(t.latitude).toFixed(1)}°${t.latitude >= 0 ? 'N':'S'}`;
                        if (pLon) pLon.textContent = `${Math.abs(t.longitude).toFixed(1)}°${t.longitude >= 0 ? 'E':'W'}`;
                        if (pAlt) pAlt.textContent = `${t.altitude}km`;
                        if (pSpd) pSpd.textContent = `${t.velocity}km/h`;
                    };
                    issService.subscribe(pipListener);

                    pipWindow.addEventListener('resize', () => {
                        pipGlobe.width(pipWindow.innerWidth).height(pipWindow.innerHeight);
                    });
                    pipWindow.addEventListener('pagehide', () => {
                        const idx = issService.listeners.indexOf(pipListener);
                        if (idx !== -1) issService.listeners.splice(idx, 1);
                    });
                } catch (err) {
                    console.error("PiP error:", err);
                    alert("PiP起動に失敗しました: " + err.message);
                }
            });
        } else {
            ui.btnPip.style.opacity = '0.4';
            ui.btnPip.title = "お使いのブラウザはDocument PiPに未対応です";
        }
    }

    // 設定モーダル
    if (ui.btnSettings && ui.modalSettings) {
        ui.btnSettings.addEventListener('click', () => ui.modalSettings.classList.add('open'));
    }
    if (ui.btnCloseSettings && ui.modalSettings) {
        ui.btnCloseSettings.addEventListener('click', () => ui.modalSettings.classList.remove('open'));
    }
    window.addEventListener('click', (e) => {
        if (e.target === ui.modalSettings) ui.modalSettings.classList.remove('open');
    });

    if (ui.selectApiSource) {
        ui.selectApiSource.value = issService.apiSource;
        ui.selectApiSource.addEventListener('change', (e) => issService.setApiSource(e.target.value));
    }
    if (ui.rangeInterval && ui.labelInterval) {
        ui.rangeInterval.addEventListener('input', (e) => {
            const sec = e.target.value;
            ui.labelInterval.textContent = `${sec} 秒`;
            issService.setUpdateInterval(sec * 1000);
        });
    }

    // サービス開始
    issService.start();
});
