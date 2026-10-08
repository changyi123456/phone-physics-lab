> 既有研究存檔：本文件的本機啟動器等方案尚未確認。最新目標是教師課堂使用的網頁平台，最終架構將由需求訪談決定。

# phyphox 電腦量測平台規劃

查核日期：2026-10-08。範圍：沿用官方區域網路 HTTP 遠端連線，簡化電腦操作，保留實驗數據圖，讓電腦持續記錄。

這份報告依官方 API、版本紀錄、開源遠端介面，以及 40 個根目錄 .phyphox 定義逐項整理。這是文件與程式定義查核；尚未拿實體 iPhone／Android 測試連線延遲與數據完整性。下面的更新頻率是設計起點，並非實測保證。

## 建議方向

第一版維持手機上的官方 phyphox App，手機負責感測及既有實驗分析，電腦承接顯示、操作、記錄和匯出。這樣可以直接使用已開發的計時、FFT、自相關及衍生量計算。

電腦端採用一個薄型本機啟動器：首次安裝，之後雙擊開啟。它連到手機的 HTTP 服務，載入手機產生的官方遠端頁面，再加上連線指引、清楚的控制列與記錄功能。沿用官方網頁的分頁、數值、曲線和頻譜；改動集中在操作和保存。這個方式是待原型驗證的實作方案，官方網頁本身不能直接當成獨立網站部署後就使用。

官方遠端網頁的實驗版面由手機填入模板，並非只有一個通用 HTML 就能知道所有實驗圖表。因此優先重用手機產生的頁面，並在本機代理層串接資料；必要時對首批實驗做明確的欄位映射。繪圖與記錄共用一次資料取得，不再另開一套高頻輪詢。

依據：[官方遠端介面](https://phyphox.org/docs/remote-interface/)、[官方網頁原始碼](https://github.com/phyphox/phyphox-webinterface/blob/master/index.html)。

## 簡化後的操作

1. 手機與電腦連到同一個可互通的 Wi-Fi，或由電腦連入手機熱點。
2. 手機選好實驗並開啟遠端存取。
3. 電腦首次輸入手機顯示的網址，程式記住地址；之後啟動先檢查上次地址，失效才請使用者更新。
4. 電腦自動辨識目前實驗及單位，顯示「開始量測」。
5. 按開始後建立新的實驗紀錄；停止後完成保存，可直接重播或匯出。

官方 App 的「選實驗、啟用遠端存取」仍保留。記住地址不能保證 Wi-Fi 改變或 IP 更新後仍可連上；第一版不依賴自動發現，也不需要雲端帳號或跨網路中繼。

依據：[官方連線步驟](https://phyphox.org/remote-control/)。

## 延遲設計

將手機取樣、實驗分析和電腦顯示更新分開處理。電腦每秒更新幾次，仍能成批取得手機在這段時間內留下的許多樣本；分析時間軸沿用手機資料的時間，不能用封包抵達電腦的時間代替。

- 一般曲線：先以每秒 2–5 次取得資料作為起點，依回應時間與資料量調整；每支手機最多維持一個進行中的請求。
- 單擺、彈簧、加速度、磁場：在緩衝區尚未覆蓋、資料能完整取回的條件下，網路延遲主要影響顯示的新鮮度。原始資料持續保存，不隨切換分頁停止。
- 聲學計時、彈跳碰撞：由手機判定聲音事件和時間差；電腦先啟動量測，再顯示結果。不能讓電腦點按開始與停止的時間差充當落下時間。
- 頻譜：FFT 在手機計算，電腦呈現頻譜、峰值和歷史。結果還會受到分析視窗長度影響；增加樣本有助頻率解析度，但會增加等待時間。
- 傾角與向心加速度：原實驗約有 0.5 秒的平均／取樣尺度，要保留其意義，避免誤認為網路延遲。
- 示波器、FFT 當前視窗：屬於更新中的快照，會被下一視窗覆蓋。第一版保存收到的快照與峰值歷史，不宣稱完整連續錄音或每個 FFT 視窗都已保存。
- 多手機共享絕對時間或即時回授控制：後續另外驗證同步與延遲，先不納入首版。兩支手機各自量到聲音事件間隔的聲速方法可另行擴充，不能只因有兩支手機就判定不可行。

依據：[資料緩衝區與時間介面](https://phyphox.org/docs/remote-interface/)、[聲學計時](https://phyphox.org/wiki/index.php?title=Experiment:_Acoustic_Stopwatch)、[頻譜視窗](https://phyphox.org/wiki/index.php?title=Experiment:_Audio_Spectrum)、[傾角](https://phyphox.org/wiki/index.php?title=Experiment:_Inclination)、[向心加速度](https://phyphox.org/wiki/index.php?title=Experiment:_Centrifugal_Acceleration)。

## 首版 10 個單元

以下共使用 12 個既有實驗定義。第一欄是可沿用的功能；圖表以原定義已有者為主，新增圖有明確標示。器材欄是做物理實驗的裝置，並非連線需要購買的設備。

| 單元／既有功能 | 電腦保留的圖與數值 | 章節／操作例子 | 額外實驗器材與條件 |
|---|---|---|---|
| 加速度：含 g、去除 g | x、y、z 與大小對時間；m/s²；分軸及疊圖 | 運動描述、感測器座標、加減速 | 基礎觀察只需手機；推車實驗需固定架。含 g 讀值是感測器的比力，不能直接解讀成物體在地面座標的運動加速度 |
| 陀螺儀 | 三軸角速度與大小對時間；rad/s | 角速度、轉動、正負方向 | 手機可直接觀察；固定轉台便於量測 |
| 傾角 | 傾角對時間、傾斜方向對時間；°；平放／直立／側放分頁 | 斜面角度、力的分解 | 靜止斜面、方塊；摩擦係數須另記錄開始滑動的角度，屬於新增教學分析 |
| 單擺 | 三軸角速度—時間、自相關、相對振幅—頻率；週期、頻率、輸入擺長後估計 g | 週期、簡諧運動、重力估計 | 繩、固定架、尺。使用小角度；擺長量到手機質心，有限尺寸需考慮理想單擺近似 |
| 彈簧振動 | 三軸加速度—時間、自相關、相對振幅—頻率；週期、頻率 | 簡諧運動、共振 | 彈簧、固定架；輸入質量後推算 k 是另外增加的分析 |
| 向心加速度 | 加速度—角速度、加速度—角速度平方、兩者各自對時間 | 圓周運動，驗證 a=rω² | 固定半徑轉台與手機固定架；使用穩定轉動區段 |
| 聲音頻譜／頻率歷史 | FFT 幅值—頻率、頻率歷史、頻譜熱圖、音訊視窗；Hz、週期 | 聲音頻率、諧波、聲音變化 | 麥克風；可搭配音叉、樂器或另一個聲源 |
| 聲學計時 | 大型時間差、連續事件時間差；事件序號—間隔圖；門檻設定 | 落體時間、週期性聲音事件 | 自由落體需小物體、觸發裝置、尺；手機留在旁邊偵測聲音。落體 h—t² 圖屬新增分析 |
| 彈跳碰撞 | 原有各次反彈時間、推算高度與相對能量／保留比例；新增「次數—高度」及「次數—相對能量」圖 | 能量耗散、非彈性碰撞 | 會發出清楚碰撞聲的球與表面。能量是模型推算的比例，不能標成直接量到的焦耳 |
| 磁場 | 三軸磁場與大小對時間；µT | 磁場向量、磁鐵與方向 | 基礎觀察只需手機；場分布需磁鐵及已知位置。時間圖不能自動當作距離圖 |

首版來源定義見下方附錄；既有實驗的背景說明可參考 [官方實驗列表](https://phyphox.org/experiment/)。

## 第二階段可直接延伸的功能

| 功能 | 原有數據圖／輸出 | 注意的條件 |
|---|---|---|
| 加速度頻譜 | 振動頻譜、主頻歷史、頻譜熱圖、原始加速度視窗 | 解析頻率以實際取樣率與視窗為準 |
| 聲音自相關 | 音訊波形、自相關曲線、週期與頻率 | 適合較單純的週期音，不能把複雜聲音一概當成單頻 |
| 聲音振幅 | dB 對時間、校正狀態 | 未以參考聲源校正時，標示未校正讀值，不能承諾標準聲級計精度 |
| 示波器 | 振幅—時間的觸發短視窗 | 屬視窗快照；適合波形教學 |
| 都卜勒效應 | 頻率—時間、由頻移推算速度—時間 | 須設定基準頻率與幾何條件；速度是推算值 |
| 聲納 | 回波強度—延遲／距離、距離—時間熱圖、聲速推算圖 | 喇叭、麥克風與反射面；聲音輸出與計時保留在手機 |
| 音調產生器 | 設定頻率／振幅及波形預覽 | 是輸出工具，預覽圖是生成訊號而非環境實測 |
| 磁場頻譜 | 磁場 FFT、主頻歷史與熱圖 | 須確認機型取樣率可解析目標頻率 |
| 磁尺 | 位置—時間、速度—時間、磁場曲線 | 需等距磁鐵標記並設定間距 |
| 氣壓／電梯 | 氣壓—時間；電梯高度、速度、加速度對時間 | 手機有氣壓計；高度與速度是由模型及差分取得。電梯行程可先在手機錄完再取回 |
| GPS | 經緯度、高度、速度、方向與移動距離對時間 | 戶外較合適；移動中 Wi-Fi 可能斷線，採手機先錄、回來再下載 |
| 滾動 Roll | 由半徑與角速度推算的速度—時間、原始角速度 | 固定裝置及無滑動條件；iOS 1.2.0 已恢復，舊列表的停用描述過時 |
| 運動計時 | 加速度觸發時間差；事件序號—間隔 | 手機內部觸發；誤差取決於機型與觸發方式 |
| 相機亮度／色彩 | 亮度、色相、飽和度、明度對時間 | 1.2.0 新增；曝光和選區先在手機設定，傳送分析數值。相機亮度不能直接當作照度 lx |
| 相機亮度頻譜／計時 | 亮度頻譜與熱圖、事件間隔／持續時間；色彩觸發也有對應數據 | 精度受實際相機幀率、曝光及觸發條件限制 |
| 光譜學 | 原始亮度—像素位置、校正後亮度—波長 | 1.2.1 新增；需光柵等光譜裝置及校正 |
| 深度 LiDAR／ToF | 距離、速度、加速度對時間 | 限支援機型；深度可能經系統處理。差分會放大雜訊 |
| 照度／光學計時 | lx—時間、遮光事件時間差 | iPhone 無官方環境光讀取介面；主要列為相容 Android 的擴充 |
| 接近計時 | 接近狀態、觸發與持續時間 | 先確認 App 與機型能提供讀值，不當作通用精密距離感測器 |
| 閃光頻閃儀 | 頻率、亮暗時間與預覽波形 | 1.2.1 新增的輸出工具；預覽不是實測光強 |

雙手機聲速實驗也可擴充：沿用兩支手機各自的聲學計時間隔，搭配尺測距離，不用網路封包抵達時間計算聲速。[官方聲速方法](https://phyphox.org/experiment/page/4/)

版本以較新的 [1.2.0 紀錄](https://phyphox.org/docs/reference/version-history/1.2.0/) 與 [1.2.1 紀錄](https://phyphox.org/docs/reference/version-history/1.2.1/) 為準；正式原型要讀取手機實際 App 版本並核對可用項目。溫度、濕度、力與電壓不能因電腦介面增加就變成一般手機能直接測到的量，額外感測器方案另行規劃。

## 電腦介面

保留原本的數值卡、圖表、設定、原始資料、自相關及頻譜分頁，依實驗原有內容呈現。首批實驗的所有既有圖表保留；預設頁可以只突出課堂最常用的圖，其餘仍可切換。

- 頂部：實驗名稱、手機連線狀態、開始／停止、新一筆紀錄、保存狀態。
- 圖表：原有軸名稱、單位、曲線與多軸／多曲線配置；可放大到投影使用的全螢幕。
- 原本有的頻譜熱圖、自相關與關係散點圖均保留，不能只剩即時數字。
- 設定：保留擺長、門檻、基準頻率等必需輸入；校正讀值與原始讀值保留。
- 記錄：各次量測自動命名，停止後可重播、下載 CSV、另存官方匯出檔。
- 不同數據來源標示：實測、手機推算、電腦新增分析。生成音調或頻閃圖標示為設定／預覽。

新增圖的範圍限於已有資料能支持的教學呈現，例如彈跳高度圖與多次實驗比較。新繪的圖會沿用原介面的風格及單位，不改動原計算演算法。

## 電腦記錄的實作規則

1. 用 /config 取得目前實驗、export sets 與 buffers，對首批實驗建立已核對的欄位對應；/config 不提供完整圖表版面，因此不能只靠它通用重建所有介面。
2. 持續曲線成批取得新增樣本；有限長緩衝區要在覆蓋前取得並落盤。切換圖表或暫停畫面滾動不能停掉記錄。
3. 有限視窗、會重設的陣列及單值結果採快照記錄；讀取時間與真正的手機取樣時間分開保存。
4. 分開保存感測資料、分析快照、實驗設定和連線事件。各資料組有自己的時間軸，不能假設不同 buffers 的相同索引必然是同一時刻。
5. 停止後進行最後一次資料取得，並保存官方匯出檔作比對／備份。清除前先保存；不要用重複時間戳記把新一輪量測誤當舊資料。
6. 斷線時標示中斷；重連後能補多少取決於手機仍保存哪些資料。已覆蓋的資料不能憑空補回，不插值偽裝成實測。
7. 長實驗採分批寫入檔案，畫面可減少繪圖點數，磁碟保存完整已取得樣本。

本機啟動器處理 HTTP 與保存，避開 HTTPS 網站直接讀取手機 HTTP 的混合內容限制。[官方說明](https://phyphox.org/docs/remote-interface/api-reference/)

## 開發順序與驗收

先完成連線、官方圖表載入與加速度／陀螺儀記錄，再加入單擺、彈簧、向心加速度，最後驗證聲音頻譜、聲學計時、碰撞和磁場。首版完成後才擴展相機與多手機。

- 用實體 iPhone 與至少一款 Android 比較本機與遠端的圖、數值、單位和設定。
- 量測不同網路下的請求往返時間、圖表更新間隔與控制確認時間，分開回報分析視窗造成的等待。
- 比較電腦保存的時間序列與手機匯出，核對樣本數、起訖時間、重複／遺漏及斷線區段。
- 測試切換分頁、清除、新量測、斷線重連，以及手機鎖屏／切背景時的實際行為。
- 示波器與頻譜以「快照保存正確、歷史資料完整度已標明」驗收，不宣稱連續音訊保存。
- 確认沿用開源元件的授權標示；官方 webinterface 為 GPL-3.0，保留來源及授權，工具使用自己的名稱。[官方程式庫](https://github.com/phyphox/phyphox-webinterface)

## 附錄：逐項核對的原始圖表

以下由實際 .phyphox 定義的 views／graph／value 整理，連結固定在本次查核提交；屬既有定義清單，不代表每支手機都支援，也不代表已完成遠端實機驗收。圖表 x、y 是座標軸；彩色圖另有 z 值作色階。名稱為原定義英文，正式介面可沿用 App 的繁體中文翻譯。

查核提交：`af5c1a52a888426f0acff0284bb6a6564e113afb`；根目錄定義數：40。

### [Acceleration Spectrum](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/acc_spectrum.phyphox)

輸入：accelerometer。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Spectrum | Fourier Transform | Frequency | FFT Mag |
| History | Fourier Transform；另有色階 | Frequency | Time |
| History | History | Time | Peak-Frequency |
| Raw data | Acceleration x | 時間 | 加速度 |
| Raw data | Acceleration y | 時間 | 加速度 |
| Raw data | Acceleration z | 時間 | 加速度 |

數值項目：Peak-Frequency、Samples used、Period used、Resolution、Acquisition rate、Nyquist frequency。

### [Acceleration with g](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/accelerometer.phyphox)

輸入：accelerometer。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Accelerometer x | 時間 | 加速度 |
| Graph | Accelerometer y | 時間 | 加速度 |
| Graph | Accelerometer z | 時間 | 加速度 |
| Absolute | Absolute acceleration | 時間 | 加速度 |
| Multi | Acceleration | 時間 | 加速度 |

數值項目：Absolute acceleration、Accelerometer x、Accelerometer y、Accelerometer z。

### [Acoustic Stopwatch](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/acoustic_stopwatch.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Many | Events | Event number | Time interval |

數值項目：Time、Time 1、Time 2、Time 3、Time 4、Time 5、Event number、Average interval、Average rate、Average rate (bpm)。

### [Applause Meter](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/applause_multi.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Score | History | Time | Subscore |
| Score | Scores | Contestant | Scores |

數值項目：Score。

### [Audio Amplitude](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/audio_amplitude.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Amplitude | History | Time | 聲級 |

數值項目：Status、Sound pressure level、Calibration offset。

### [Audio Autocorrelation](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/audio_autocorrelation.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Autocorr. | Autocorrelation | Δt | correlation |
| Raw data | Recording | 時間 | Amplitude |

數值項目：Period、Frequency、Musical note、Cents from note。

### [Audio Scope](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/audio_scope.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Scope | Audio Data | Time | Amplitude |

### [Audio Spectrum](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/audio_spectrum.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Spectrum | Fourier Transform | Frequency | FFT Mag |
| History | Fourier Transform；另有色階 | Frequency | Time |
| History | History | Time | Peak-Frequency |
| Raw data | Recording | 時間 | Amplitude |

數值項目：Peak-Frequency、Musical note、Cents from note、Samples used、Period used、Resolution。

### [Color (Hue Saturation Value)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/camera-hsv.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| HSV | Hue | 時間 | Hue |
| HSV | Saturation and Value | 時間 | sat., val. |

數值項目：Hue、Saturation、Value、Frame rate。

### [Brightness (Luminance)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/camera-luminance.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Luminance | Luminance | 時間 | 亮度 |

數值項目：Luminance、Frame rate。

### [Camera Spectrum: Brightness](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/camera_spectrum_luma.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Spectrum | Fourier Transform | Frequency | FFT Mag |
| History | Fourier Transform；另有色階 | Frequency | Time |
| History | History | Time | Peak-Frequency |
| Raw data | Luma | 時間 | 影像亮度訊號 |

數值項目：Peak-Frequency、Samples used、Period used、Resolution、Acquisition rate、Nyquist frequency。

### [Camera Stopwatch: Color](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/camera_stopwatch_hue.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Settings | Hue | 時間 | Hue |
| Many | Trigger on events | Event number | Time interval |
| Many | Trigger durations | Event number | Duration |

數值項目：State、Frame rate、Time 1、Time 2、Time 3、Time 4、Time 5、Trigger duration 0、Trigger duration 1、Trigger duration 2、Trigger duration 3、Trigger duration 4、Trigger duration 5、Trigger on 0、Trigger off 0、Trigger on 1、Trigger off 1、Trigger on 2、Trigger off 2、Trigger on 3、Trigger off 3、Trigger on 4、Trigger off 4、Trigger on 5、Trigger off 5、Event number、Average interval、Average rate、Average rate (bpm)。

### [Camera Stopwatch: Brightness](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/camera_stopwatch_luma.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Settings | Luma | 時間 | 影像亮度訊號 |
| Many | Trigger on events | Event number | Time interval |
| Many | Trigger durations | Event number | Duration |

數值項目：State、Frame rate、Time 1、Time 2、Time 3、Time 4、Time 5、Trigger duration 0、Trigger duration 1、Trigger duration 2、Trigger duration 3、Trigger duration 4、Trigger duration 5、Trigger on 0、Trigger off 0、Trigger on 1、Trigger off 1、Trigger on 2、Trigger off 2、Trigger on 3、Trigger off 3、Trigger on 4、Trigger off 4、Trigger on 5、Trigger off 5、Event number、Average interval、Average rate、Average rate (bpm)。

### [Centripetal Acceleration](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/centripetal_acceleration.phyphox)

輸入：linear_acceleration、gyroscope。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Relation | Acceleration | Angular velocity ω | Acceleration a |
| Relation | Square plot | ω² | 加速度 |
| Time | Acceleration | 時間 | 加速度 |
| Time | Angular velocity | 時間 | 角速度 |

### [Depth Sensor (LiDAR / ToF)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/depth.phyphox)

輸入：depth。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Distance / Depth | 時間 | 距離 |
| Kinematics | Distance / Depth | 時間 | 距離 |
| Kinematics | Velocity | 時間 | 速度 |
| Kinematics | Acceleration | 時間 | 加速度 |

數值項目：Distance / Depth。

### [Doppler Effect](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/doppler.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Results | Frequency | 時間 | Frequency |
| Results | Speed | 時間 | Speed |

數值項目：nth period。

### [Elevator](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/elevator.phyphox)

輸入：pressure、linear_acceleration。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Motion | Altitude (from barometer) | 時間 | 高度 |
| Motion | Vertical velocity (from altitude) | 時間 | 速度 |
| Motion | z acceleration (from accelerometer) | 時間 | 加速度 |
| Raw Data | Pressure | 時間 | 氣壓 |
| Raw Data | Accelerometer z | 時間 | 加速度 |

### [Frequency History](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/frequency_history.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| History | Frequency | 時間 | Frequency |
| History | Period | 時間 | Period |

### [Location (GPS)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/gps.phyphox)

輸入：location。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Position | Latitude | 時間 | 緯度 |
| Position | Longitude | 時間 | 經度 |
| Position | Altitude | 時間 | 高度 |
| Movement | Speed | 時間 | 速度 |
| Movement | Direction | 時間 | Direction |
| Movement | Distance travelled | 時間 | 距離 |

數值項目：Status、Latitude、Longitude、Altitude、Speed、Direction、Compass、Distance travelled、Distance from start、Horizontal Accuracy、Vertical Accuracy、Satellites。

### [Gyroscope (Rotation Rate)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/gyroscope.phyphox)

輸入：gyroscope。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Gyroscope x | 時間 | 角速度 |
| Graph | Gyroscope y | 時間 | 角速度 |
| Graph | Gyroscope z | 時間 | 角速度 |
| Absolute | Absolute | 時間 | 角速度 |
| Multi | Gyroscope | 時間 | 角速度 |

數值項目：Absolute、Gyroscope x、Gyroscope y、Gyroscope z。

### [Inclination](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/inclination.phyphox)

輸入：accelerometer。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Flat | Tilt up/down | 時間 | Angle |
| Flat | Tilt left/right | 時間 | Angle |
| Upright | Tilt up/down | 時間 | Angle |
| Upright | Tilt left/right | 時間 | Angle |
| Side | Tilt up/down | 時間 | Angle |
| Side | Tilt left/right | 時間 | Angle |
| Plane | Inclination | 時間 | Angle |
| Plane | Rotation | 時間 | Angle |

數值項目：Tilt up/down、Tilt left/right、Inclination、Rotation。

### [(In)elastic Collision](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/inelastic_collision.phyphox)

輸入：audio。

原定義沒有 graph 元素。

數值項目：Height 0、Height 1、Time 1、Height 2、Time 2、Height 3、Time 3、Height 4、Time 4、Height 5、Time 5、Energy 1、Energy 2、Retained on collision 2、Energy 3、Retained on collision 3、Energy 4、Retained on collision 4、Energy 5、Retained on collision 5、Average retained。

### [light.phyphox](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/light.phyphox)

輸入：light。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Illuminance | 時間 | 照度 |

數值項目：Illuminance。

### [Acceleration (without g)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/linear_accelerometer.phyphox)

輸入：linear_acceleration。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Linear Acceleration x | 時間 | 加速度 |
| Graph | Linear Acceleration y | 時間 | 加速度 |
| Graph | Linear Acceleration z | 時間 | 加速度 |
| Absolute | Absolute acceleration | 時間 | 加速度 |
| Multi | Acceleration | 時間 | 加速度 |

數值項目：Absolute acceleration、Linear Acceleration x、Linear Acceleration y、Linear Acceleration z、Acceleration x、Acceleration y、Acceleration z。

### [Magnetic Spectrum](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/mag_spectrum.phyphox)

輸入：magnetic_field。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Spectrum | Fourier Transform | Frequency | FFT Mag |
| History | Fourier Transform；另有色階 | Frequency | Time |
| History | History | Time | Peak-Frequency |
| Raw data | Magnetic field x | 時間 | 磁場 |
| Raw data | Magnetic field y | 時間 | 磁場 |
| Raw data | Magnetic field z | 時間 | 磁場 |

數值項目：Peak-Frequency、Samples used、Period used、Resolution、Acquisition rate、Nyquist frequency。

### [Magnetic Ruler](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/magnetic_ruler.phyphox)

輸入：magnetic_field。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Results | Distance | 時間 | x |
| Results | Velocity | 時間 | 速度 |
| Raw Data | Magnetic field x | 時間 | Bx |
| Raw Data | Magnetic field y | 時間 | By |
| Raw Data | Magnetic field z | 時間 | Bz |
| Raw Data | Total magnetic field squared and filtered | 時間 | Filtered B² |

### [Magnetometer](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/magnetometer.phyphox)

輸入：magnetic_field。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Magnetometer x | 時間 | 磁場 |
| Graph | Magnetometer y | 時間 | 磁場 |
| Graph | Magnetometer z | 時間 | 磁場 |
| Absolute | Absolute | 時間 | 磁場 |
| Multi | Magnetometer | 時間 | 磁場 |

數值項目：Accuracy、Absolute、Magnetometer x、Magnetometer y、Magnetometer z。

### [Motion Stopwatch](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/motion_stopwatch.phyphox)

輸入：linear_acceleration。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Many | Events | Event number | Time interval |

數值項目：Time、Time 1、Time 2、Time 3、Time 4、Time 5、Event number、Average interval、Average rate、Average rate (bpm)。

### [Optical Stopwatch (Light sensor)](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/optical_stopwatch.phyphox)

輸入：light。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Settings | Illuminance | 時間 | 照度 |

數值項目：Time 1、Time 2、Time 3、Time 4、Time 5、Trigger duration 0、Trigger duration 1、Trigger duration 2、Trigger duration 3、Trigger duration 4、Trigger duration 5、Trigger on 0、Trigger off 0、Trigger on 1、Trigger off 1、Trigger on 2、Trigger off 2、Trigger on 3、Trigger off 3、Trigger on 4、Trigger off 4、Trigger on 5、Trigger off 5。

### [Pendulum](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/pendulum.phyphox)

輸入：gyroscope。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Resonance | Resonance | Frequency | Rel. amplitude |
| Autocorrelation | Autocorrelation | Δt | correlation |
| Raw Data | Gyroscope x | 時間 | 角速度 |
| Raw Data | Gyroscope y | 時間 | 角速度 |
| Raw Data | Gyroscope z | 時間 | 角速度 |

數值項目：Period、Frequency、g、Length。

### [Pressure](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/pressure.phyphox)

輸入：pressure。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Graph | Pressure | 時間 | 氣壓 |

數值項目：Pressure。

### [Proximity Stopwatch](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/proximity_stopwatch.phyphox)

輸入：proximity。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Settings | Distance | 時間 | 距離 |

數值項目：Time 1、Time 2、Time 3、Time 4、Time 5、Trigger duration 0、Trigger duration 1、Trigger duration 2、Trigger duration 3、Trigger duration 4、Trigger duration 5、Trigger on 0、Trigger off 0、Trigger on 1、Trigger off 1、Trigger on 2、Trigger off 2、Trigger on 3、Trigger off 3、Trigger on 4、Trigger off 4、Trigger on 5、Trigger off 5。

### [Roll](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/roll.phyphox)

輸入：gyroscope。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Velocity | Velocity | 時間 | 速度 |
| Velocity | Velocity | 時間 | 速度 |
| Raw Data | Gyroscope y | 時間 | 角速度 |

### [Submit to Sensor Database](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/sensordb.phyphox)

輸入：accelerometer、linear_acceleration、gyroscope、magnetic_field、pressure、temperature、humidity、light、proximity。

原定義沒有 graph 元素。

數值項目：Step、Confidence、Rate、Average、Standard deviation。

用途為支援／資料庫頁，不列為首版教學量測單元。

### [Sonar](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/sonar.phyphox)

輸入：audio。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Time series | Normalized history；另有色階 | distance | time |
| Echo location | Echo location | distance | 振幅 |
| Echo location | Normalized to spherical surface | distance | 振幅 |
| Speed of Sound | Echo strength | Speed of Sound | 振幅 |
| Speed of Sound | Normalized to spherical surface | Speed of Sound | 振幅 |
| Timing | Echo strength | Delay | 振幅 |
| Timing | Normalized to spherical surface | Delay | 振幅 |
| Chirp | Chirp | Time | 振幅 |

### [Spectroscopy](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/spectroscopy.phyphox)

輸入：camera。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| 2 Calibration | Raw Spectrum | Position on sensor | 亮度 |
| 3 Spectrum | Spectrum | 波長 | 亮度 |

數值項目：Pixel 1、Wavelength 1、Pixel 2、Wavelength 2。

### [Spring](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/spring.phyphox)

輸入：linear_acceleration。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Resonance | Resonance | Frequency | Rel. amplitude |
| Autocorrelation | Autocorrelation | Δt | correlation |
| Raw Data | Accelerometer x | 時間 | 加速度 |
| Raw Data | Accelerometer y | 時間 | 加速度 |
| Raw Data | Accelerometer z | 時間 | 加速度 |

數值項目：Period、Frequency。

### [Flashlight Stroboscope](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/strobe.phyphox)

輸入：無感測輸入／工具或資訊頁。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Strobe | Preview | 時間 | Brightness |

數值項目：Period、On duration、Off duration。

### [Other Ways to Contribute…](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/support.phyphox)

輸入：無感測輸入／工具或資訊頁。

原定義沒有 graph 元素。

用途為支援／資料庫頁，不列為首版教學量測單元。

### [Tone Generator](https://github.com/phyphox/phyphox-experiments/blob/af5c1a52a888426f0acff0284bb6a6564e113afb/tone_generator.phyphox)

輸入：無感測輸入／工具或資訊頁。

| 分頁 | 原圖表 | x 軸 | y 軸 |
|---|---|---|---|
| Controls | Signal | Time | 振幅 |

數值項目：Status。

