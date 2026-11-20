# Phylab 配對中繼備援

這是直連受阻時的可選轉送服務。GitHub Pages 仍提供原網站，資料不在本服務儲存。

本機測試：

```sh
npm ci --prefix relay
npm test --prefix relay
npm start --prefix relay
```

Node.js 22 以上。單一服務實例；每組 QR 只允許一台電腦及一個手機瀏覽器。正式服務只接受 `https://changyi123456.github.io` 的 WebSocket Origin。電腦以隨機私鑰的雜湊產生配對碼，伺服器驗證證明；只有 QR 連結不能冒充電腦。重新整理的同一個手機身分可以取代舊連線，其他身分會被拒絕。程式限制最多 128 組配對與 300 個 WebSocket，單封包 512 KiB、待送佇列 256 KiB，並有限速與存活檢查。

服務只轉送 JSON 封包，不建立資料庫、不寫量測檔案、不記錄量測封包或配對密鑰。記憶體只保留連線和配對身分；斷線的配對在 10 分鐘後移除。離線期間不保存伺服器歷史，資料補送仍由手機 ReplayBuffer 與電腦 ACK 負責。

正式部署設定（已經使用者同意新增與發布）：

- 使用既有 Render 工作區 `simulation` 的 `phone-physics-relay`。
- 方案 `free`，區域 `singapore`，單一 Node 服務。
- 儲存庫同網站 `changyi123456/phone-physics-lab`，分支 `main`。
- Build：`npm ci --prefix relay`；Start：`node relay/server.mjs`。
- 服務：https://phone-physics-relay.onrender.com；健康檢查：`/health`。在同一 GitHub repo 的 Actions variable `PHYLAB_RELAY_URL` 設定 `wss://實際服務網址/pair`；既有 workflow 會傳入 `VITE_RELAY_URL` 後建置前端。變數未設定時不啟用中繼。
- 直連成功不使用中繼資料通道；直連 8 秒未完成時才嘗試備援。

Render 免費服務閒置 15 分鐘會休眠，首次喚醒可能約一分鐘。免費服務共用工作區免費時數、建置和流量額度；超額與帳戶計費／停用政策依 Render 帳戶設定，不能把「free」當作保證任何用量皆不計費。不得自動升級付費規格。此方案也不能取代實際教室多組手機驗收。

本機已用 WebKit（iPhone 尺寸）與 Chromium（Android 尺寸）刻意強制 ICE relay-only 且提供零 ICE servers，確認 WebRTC 無法直連，再驗證備援配對、感測預覽、開始／暫停／繼續／結束、Excel 下載及頁面重整重連。感測值為測試注入；不代表已完成實體手機測試或實際校園網路驗收。

第三方：`ws`，MIT，見套件的 LICENSE 與 https://github.com/websockets/ws。
