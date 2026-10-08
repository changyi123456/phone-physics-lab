# 量測與資料契約 v0.2

## 操作

電腦選模組 → 手機掃 QR → 依選定來源按啟用並授權 → 確認收到有效值 → 電腦開始 → 可暫停／繼續 → 結束確認最後序號 → 檢查圖表 → 手動下載 Excel。

切換感測來源會關閉舊麥克風／相機／定位並要求重新啟用；同來源模組可延用授權。暫停時不產生新的紀錄，保留 runId 和連續 seq，繼續時 segment 加一。原 t 保留真實時間間隔，計時器扣除手動暫停；FFT、自相關與事件間隔不跨分段。手機鎖屏／背景可能停止感測且會留下品質事件。

## 模組與教學

| 類別     | 模組                                       | 圖表與指標                                    | 條件                                                                                          |
| -------- | ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 基礎運動 | 加速度、角速度、傾角                       | xyz／合量／角度–時間                          | Motion 事件有效欄位；動作校準固定一輪                                                         |
| 振動     | 單擺、彈簧、加速度頻譜、振動歷史、彈簧常數 | 時間曲線、FFT、自相關、T、f、g／k、f(t)、熱圖 | 最後連續窗口 ≤512 點、至少2秒；中位 dt≤0.1s；Hann窗，DC移除、自相關峰細化                     |
| 旋轉     | 向心加速度、向心半徑擬合                   | a–ω／a–ω²、斜率 r、截距、R²、殘差、斜率標準誤 | 0.5s 同分段平均；至少3個不同轉速點；裝置固定半徑、手機跟著旋轉                                |
| 聲學     | 聲音頻譜、聲音歷史                         | PCM、FFT、f、數位RMS、f(t)、熱圖              | 原生AudioContext rate；Hann窗，主峰對數拋物線細化；不表示 dB SPL                              |
| 聲事件   | 聲控秒錶、反彈碰撞                         | 事件來源時間、Δt、模型h、E/E₀                 | 5ms RMS門檻窗口、半門檻遲滯、最小間隔；噪音／漏事件要人工核對                                 |
| 動作事件 | 運動觸發秒錶                               | 合線性加速度、門檻事件時間與間隔              | 加速度門檻／遲滯；時序分段，不以網路到達時間觸發                                              |
| 戶外     | GPS                                        | 定位軌跡、速度、高度、精度、累積路程          | 來源定位timestamp；預設精度≤20m，不跨無效／間隔≥15s／暫停定位；路程仍可能累積漂移             |
| 光學     | 相機亮度、顏色、光學秒錶                   | 中央ROI Y／RGB，光學事件Δt                    | 下採樣160×90、中央32×32，約10次/s；影格時間是呈現時間，擷取延遲未知；自動曝光與白平衡影響結果 |
| 原始感測 | 磁場、照度                                 | 通道–時間、原單位                             | 只在內建感測 API 支援時讀取；不以姿態或 RGB 代替                                              |
| 教師設定 | 自訂實驗                                   | 選定 motion 欄位曲線、f、門檻事件             | JSON schema1，linear／gyro／gravity，繁中／英文描述，有限參數；沒有可執行程式碼               |

高度 h=9.80665Δt²/8 假設同一水平面的垂直自由飛行；E/E₀是同一輪高度比，不是直接量測焦耳。k=4π²m/T²使用有效質量；T²–L擬合 g=4π²/slope，T²–m擬合 k=4π²/slope。樣本標準差與SEM需要至少2輪；模型擬合至少3個不同參數。重複資料僅比較同模組與同模式。

## 傳輸與記憶體

schema2 保留既有欄位，新增 segment 與 data。source 可為 motion、orientation、audio、gps、camera、magnetometer、light。未知值保留null於settings，不以0冒充高度或速度。

- 通用單輪600秒；聲音60秒。
- 手機 PCM 只擷取與封裝：AudioWorklet 1024 float32 來源取樣，單一packet一個區塊，回呼立即送出；所有FFT與事件辨識由電腦做。聲音預覽僅傳最後一区塊。
- PCM待ACK區塊最多128個：約512KiB float32／約1MiB以上JS數值，48kHz約2.7秒；其他來源8192事件或60秒。超出會聲明丟棄序號。PeerJS binary 分片傳輸避免 JSON 的 16,300-byte 限制；可靠 DataChannel 仍需足夠網路吞吐。
- 相機只傳ROI數值與一維強度剖面，不傳整個影像；手機本地顯示預覽。
- Worker每600ms至多一個分析工作在途，避免分析工作積壓。
- 音訊時鐘由AudioContext frame與performance anchor映射，輸入延遲未知；光學是影格expectedDisplayTime而非曝光瞬間。這兩種源皆適合相對同源間隔，不承諾跨感測器的毫秒同步。

## Excel

結束不會自動下載。Excel包含來源／DEMO、schema2、參數、校準、原始數據、分析與品質事件。加入比較後，本輪檔案會額外包含本次20輪以內的摘要、重複統計、參數掃描、擬合與殘差；過往完整原始資料應逐輪下載，重新整理會清除所有量測與摘要。

音訊的完整PCM存為每區塊一列的base64 float32 little-endian，以避免Excel單工作表列數與手機記憶體问题；另外提供最多約2萬點的**明確標示抽點波形預覽**、完整區塊FFT／事件／頻率歷史。沒有丟失PCM精度；每列有第1取樣時間、實際sampleRate、樣本數、seq、segment與實際echoCancellation／noiseSuppression／autoGainControl設定，未知設定為null。

Python解碼單一Raw PCM列（非網頁依賴）：

```python
import base64, struct
payload = base64.b64decode(cell_base64)
values = struct.unpack('<' + 'f' * (len(payload) // 4), payload)
timestamps = [first_sample_time + i / sample_rate for i in range(len(values))]
```

相機export原始RGB／Y與160像素剖面；GPS保留精度、nullable高度／速度／航向。所有數值型欄位為Excel numeric，空值為空白；分析衍生值不覆蓋原值。

## 器材擴充範圍

本版依要求移除外接感測器與需光柵的光譜，沒有 Bluetooth／USB 授權、UUID／鮑率設定或器材傳輸程式。氣壓、接近、深度也不出現在實驗選單。

## 技術來源

[W3C Media Capture](https://w3c.github.io/mediacapture-main/getusermedia.html)、[Web Audio](https://www.w3.org/TR/webaudio/)、[Geolocation](https://www.w3.org/TR/geolocation/)、[Video frame callback](https://html.spec.whatwg.org/multipage/media.html#dom-video-requestvideoframecallback)、[Generic Sensor](https://www.w3.org/TR/generic-sensor/)、[WebKit相機／麥克風](https://webkit.org/blog/7726/announcing-webrtc-and-media-capture/)。實现采用运行時能力检測；標准或接口存在不保證手機實機结果。
