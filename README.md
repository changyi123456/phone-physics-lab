# 手機物理實驗室 · Phone Physics Lab

全前端、高中課堂手機感測平台。每台電腦獨立配對一支手機，量測結束後手動下載 Excel。提供繁中／英文與亮色／暗色；只記 UI 偏好，量測留在本輪記憶體。

試用網站：https://changyi123456.github.io/phone-physics-lab/
原始碼：https://github.com/changyi123456/phone-physics-lab

## 使用

公開 HTTPS 網站開在電腦 → 選實驗 → 手機掃 QR → 按啟用動作感測並允許 → 穩定擺放後校準 → 電腦開始量測 → 結束 → 檢查結果 → 手動下載 Excel。

手機維持頁面前景、不要鎖屏；可以用不同 Wi-Fi／行動網路。配對依賴 PeerJS 公共信令與 WebRTC STUN/TURN，受限校園網路需實測。不要在手機使用電腦的 localhost 地址；一般 LAN HTTP 頁面無法提供所需安全感測上下文。

無手機可按「試用示範」體驗 22 個模組入口、圖表與 Excel（瀏覽器能力條件在各模組說明）；所有示範資料在 UI、檔名及內容標示，不能當實測。

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

`dist/` 可部署到 GitHub Pages 等靜態 HTTPS 主機；Vite 使用相對 base。沒有自建後端、帳號或雲端歷史。

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
