# Phylab · 手機感測・電腦實驗

Phylab = Physics + Laboratory。入口頁提供實驗分類、搜尋與示範；進入實驗台後再配對手機。完整設計與後續擴充規範見 [design-system.md](docs/design-system.md)。保留既有 GitHub repo 與公開網址。

以瀏覽器量測為主的高中課堂手機感測平台。每台電腦獨立配對一支手機，量測結束後手動下載 Excel。提供繁中／英文與亮色／暗色；記住 UI 偏好與隨機瀏覽器配對身分，量測留在本輪記憶體。

試用網站：https://changyi123456.github.io/phone-physics-lab/
原始碼：https://github.com/changyi123456/phone-physics-lab

## 使用

公開 HTTPS 網站開在電腦 → 選實驗 → 手機掃 QR → 按啟用動作感測並允許 → 穩定擺放後校準 → 電腦開始量測 → 結束 → 檢查結果 → 手動下載 Excel。

手機維持頁面前景、不要鎖屏。先以 PeerJS 公共信令與 WebRTC 直連，使用 Cloudflare／Google 的 STUN。即使同一個 Wi-Fi 也可能被基地台的裝置隔離或防火牆阻擋；PeerJS 已停止免費 TURN 服務。已準備可選的 HTTPS WebSocket 中繼備援：設定 `VITE_RELAY_URL` 後，8 秒仍未直連會自動嘗試備援。不設定此環境變數時維持只直連。中繼模式會在兩端明確標示；量測內容只即時轉送，不寫入檔案、資料庫或日誌。不要在手機使用電腦的 localhost 地址；一般 LAN HTTP 頁面無法提供所需安全感測上下文。

Android 請使用 Chrome，檢查「設定 → 網站設定 → 動作感應器」已允許；iPhone 使用 Safari 並允許動作與方向。請從 LINE 等 App 改用外部瀏覽器。手機的「已啟用」表示已啟用感測存取，「資料已就緒」才表示已收到目前實驗所需的欄位。電腦只有在收到必要欄位後才允許開始；切成線性加速度時也需要對應資料。

沒有有效動作事件時，會在 1.5 秒後嘗試 Android Chrome 的 Accelerometer／LinearAccelerationSensor／Gyroscope。備援以單一來源節奏輸出，不將三個 API 的事件數相加當作取樣率；只附上相距 100 ms 內的原始欄位，並在封包與 Excel 的感測來源設定中保留各欄位的實際時間戳。6 秒仍無有效動作資料會顯示權限檢查提示並允許重試。瀏覽器、硬體或網站權限不提供的欄位不會用零值補造。手機重整可用原 QR 重新配對，但進行中的量測緩衝不會跨頁面重整保留，應先結束量測。

無手機可按「試用示範」體驗 22 個模組入口、圖表與 Excel（瀏覽器能力條件在各模組說明）；所有示範資料在 UI、檔名及內容標示，不能當實測。

## 教師量測說明

入口的每一項「量測說明」包含功能與圖表、SI／數位尺度、取樣時間限制與模型條件。實驗頁「單位與時間解析度」顯示當前取樣率與 Δt、來源間隔範圍、封包間隔和 RTT；網頁與 Excel 共用資料條件。詳見 [單位與時間稽核](docs/measurement-audit.md)。

## 本機開發

```sh
npm install
npm run dev
```

電腦開 `http://localhost:5178`。此網址供本機 UI／示範開發；手機真機請使用 HTTPS 部署。

```sh
npm test
npm run build
npm run preview
```

`dist/` 可部署到 GitHub Pages 等靜態 HTTPS 主機；Vite 使用相對 base。不需要使用者帳號，也沒有雲端量測歷史。可選中繼服務位於 `relay/`；部署方式與限制見 [relay/README.md](relay/README.md)。

## 文件

- `docs/project-plan.md`：確認規格與實作計畫。
- `docs/extension-guide.md`：新增感測、算法、圖表與 Excel 契約。
- `docs/roadmap.md`：聲學、其他感測來源與效能待辦。
- `docs/acceptance.md`：已測／待測紀錄。
- `docs/design-system.md`：完整桌機／手機、亮暗、中英視覺規範。
- `docs/prior-research.md`：原生 phyphox 研究，純網頁仕様以本次規格為準。

## 初版限制

瀏覽器提供系統處理後的 motion/orientation 資訊，無固定硬體取樣率保證。原型先記錄原接收值並於電腦分析；相對歸零不等於物理水平。單次量測10分鐘後停止；來源資料缺漏與停止逾時會標記。

實體手機感測、跨實際網路、實驗器材及30組課堂驗收需要各自證據。模擬測試通過不等於完成這些驗收。

研究參考 [phyphox experiments](https://github.com/phyphox/phyphox-experiments)。本專案為獨立網站，未與 phyphox 官方建立隸屬關係；公式與核心分析自行實作，未複製官方 App 原始碼。第三方套件授權見 `THIRD_PARTY_NOTICES.md`。

## v0.2 擴充

聲學、振動、運動／光學秒錶、反彈、彈簧常數、半徑擬合、GPS、相機RGB、教師JSON設定及20輪摘要比較。新增暫停／繼續，結束不自動下載。聲音每輪60秒，其他600秒。原始磁場／照度依API條件；iPhone Safari不一定提供這些內建感測 API。依最新要求移除外接感測器、氣壓／接近／深度與光譜。詳見 [量測契約](docs/measurement-catalog.md) 與 [擴充狀態](docs/roadmap.md)。

開發者介紹：入口導覽與頁尾可點選，或直接開啟 `?view=developer`。提供中英、亮暗、背景介紹、Phylab 理念、教學作品與公開聯絡方式；來源見介紹頁頁尾。
