# ISS Orbit Tracker 3D/2D (国際宇宙ステーション リアルタイム地球儀＆世界地図)

国際宇宙ステーション（ISS）の現在位置をリアルタイムに取得し、美麗な **3D地球儀** および **2D世界地図** 上にプロットして軌道飛行を可視化するWebアプリケーションです。  
HTML / CSS / JavaScript のみで構成されており、ビルド不要で **GitHub Pages** にそのまま公開可能です。

Windowsデスクトップの片隅に常駐させて眺められる「デスクトップWidgetモード」や「最前面小窓表示（Document Picture-in-Picture）」にも対応しています。

---

## 🌟 主な機能

### 1. 3D地球儀 ＆ 2D世界地図のシームレス切替
- **3D地球儀表示**: 宇宙空間に浮かぶ地球儀。カメラ追従モードや日本ビュー、昼夜テクスチャ切り替えに対応。
- **2D世界地図表示**: D3.jsによる高速Canvasベクター地図。

### 2. 多彩な世界地図投影法（図法）
- **イコールアース図法 (Equal Earth Projection)**:
  - 2018年に発表された最新の等面積擬円筒図法。大陸の面積比が正確で、視覚的にも美しく直感的と話題の図法です。
- **メルカトル図法 (Mercator Projection)**:
  - 航海図・Web標準の正角図法。
- **正距円筒図法 (Equirectangular)**:
  - 緯線・経線が正方格子状に並ぶ標準図法。

### 3. 時間指定による複数周回軌跡＆タイムトラベル
- **軌道履歴の可視化**:
  - `現在` / `1周 (約1.5h)` / `2周 (約3.1h)` / `4周 (約6.2h)` / `24時間 (約16周)`
  - スライダーで 0〜1440分（24時間）の航跡を自由にコントロール可能。
  - 地球が自転するため、1周ごとに地上軌道が西へ約23.3度ずつシフトしていくISS特有の正弦波グリッドが地球儀・世界地図の両方に鮮やかに浮かび上がります。
- **▶ 飛行アニメーション再生（Replay）**:
  - 「飛行再生」ボタンを押すと、指定した過去地点から現在地まで、ISSが地球を周回しながら飛んでくる様子を早送りアニメーションで再生します！

### 4. Windows デスクトップ Widget 体験
- **最前面小窓表示 (Picture-in-Picture)**:
  - 「PiP小窓」ボタンで、Windowsの最前面に独立したフロート小窓を表示可能。
- **Widgetモード**:
  - 不要なHUDを折りたたみ、最小限のスマートな表示に切り替え。

---

## 📚 クレジットと謝辞 (Credits & Acknowledgments)

本アプリケーションは、以下の素晴らしいオープンソースライブラリ、パブリックデータ、およびAPIの恩恵を受けて開発されています。開発者ならびに提供元の皆様に深く感謝いたします。

| 構成要素 | 利用素材 / プロジェクト | 開発元 / 提供元 | ライセンス |
| :--- | :--- | :--- | :--- |
| **3D WebGL レンダラー** | [Three.js](https://threejs.org/) | Mr.doob (Ricardo Cabello) | [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| **3D地球儀エンジン** | [Globe.gl](https://globe.gl/) | Vasco Asturiano | [MIT License](https://github.com/vasturiano/globe.gl/blob/master/LICENSE) |
| **2D地図データ可視化** | [D3.js](https://d3js.org/) | Mike Bostock | [ISC License](https://github.com/d3/d3/blob/main/LICENSE) |
| **イコールアース図法** | [d3-geo-projection](https://github.com/d3/d3-geo-projection) | D3 Team | [ISC License](https://github.com/d3/d3-geo-projection/blob/main/LICENSE) |
| **トポロジーデータ変換** | [TopoJSON](https://github.com/topojson/topojson) | Mike Bostock | [BSD 3-Clause](https://github.com/topojson/topojson/blob/master/LICENSE) |
| **世界地図境界データ** | [World Atlas](https://github.com/topojson/world-atlas) (Natural Earth) | Natural Earth | [Public Domain (CC0)](https://www.naturalearthdata.com/about/terms-of-use/) |
| **地球高解像度画像** | [Blue Marble / Earth at Night](https://earthobservatory.nasa.gov/) | NASA Earth Observatory | [Public Domain](https://www.nasa.gov/multimedia/guidelines/index.html) |
| **リアルタイムISS軌道データ** | [Where The ISS at? API](https://wheretheiss.at/) | Bill Shupp | Open API (Keyless / HTTPS) |

---

## 📄 ライセンス (License)

本プロジェクト独自のコードは [MIT License](LICENSE) のもとで公開されています。
