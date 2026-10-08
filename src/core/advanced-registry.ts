import type { Experiment } from "./registry";
import type { ExperimentId, Sample } from "./types";
export type Source = Sample["source"];
export interface Parameter {
  key: string;
  name: [string, string];
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}
const param = (
  key: string,
  cn: string,
  en: string,
  unit: string,
  value: number,
  min: number,
  max: number,
  step: number,
): Parameter => ({ key, name: [cn, en], unit, value, min, max, step });
const threshold = param(
  "threshold",
  "觸發門檻",
  "Trigger threshold",
  "",
  0.12,
  0.001,
  100,
  0.01,
);
const refractory = param(
  "refractory",
  "觸發間隔下限",
  "Minimum event interval",
  "s",
  0.18,
  0.02,
  10,
  0.01,
);
const mass = param(
  "mass",
  "有效質量",
  "Effective mass",
  "kg",
  0.2,
  0.001,
  20,
  0.01,
);
const motion = {
  position: [
    "固定手機，先觀察靜止讀值。沿同一軸振動或觸發，至少記錄數個週期。",
    "Secure the phone and inspect stationary readings. Vibrate or trigger along one axis for several cycles.",
  ] as [string, string],
  physics: [
    "使用手機線性加速度與來源時間。分析只使用連續分段，暫停或資料缺口不補值。",
    "Use linear acceleration and source timestamps. Analyse continuous segments; pauses and gaps are not filled.",
  ] as [string, string],
};
const sound = {
  position: [
    "手機麥克風朝向音源，先按「啟用感測器」允許麥克風。保持手機網頁在前景；避免多組同時拍手。",
    "Point the phone microphone at the source and enable microphone access. Keep the page visible; avoid simultaneous claps from other groups.",
  ] as [string, string],
  physics: [
    "手機傳送原始單聲道 PCM，FFT／門檻事件由電腦計算。幅度為數位滿刻度比例，不是校準的 dB SPL。裝置可能保留音訊處理；每輪記錄實際設定。",
    "The phone sends mono PCM; the desktop computes FFT and threshold events. Amplitude is relative to digital full scale, not calibrated dB SPL. Actual audio processing settings are recorded.",
  ] as [string, string],
};
const camera = {
  position: [
    "允許後置相機。手機顯示預覽與取樣框，將目標放在中央框內；固定位置與照明。",
    "Allow the rear camera. Position the target inside the centre sampling region in the phone preview; fix position and lighting.",
  ] as [string, string],
  physics: [
    "取中央 ROI 的 RGB 像素，保留影格來源時間。自動曝光、白平衡與相機處理會影響結果；像素亮度不等於照度 lux。",
    "Sample RGB pixels in the centre ROI with frame timestamps. Auto exposure, white balance and camera processing affect results; pixel brightness is not illuminance in lux.",
  ] as [string, string],
};
function e(
  id: ExperimentId,
  name: [string, string],
  source: Source,
  description: [string, string],
  formula: string,
  instructions: { position: [string, string]; physics: [string, string] },
  params: Parameter[] = [],
): Experiment {
  return {
    id,
    name,
    source,
    description,
    formula,
    ...instructions,
    required: [source === "motion" ? "linear" : (source as "audio")],
    parameters: params,
    group:
      source === "motion" ? "motion" : source === "audio" ? "sound" : "source",
  };
}
export const advancedExperiments: Experiment[] = [
  e(
    "sound",
    ["聲音頻譜", "Sound spectrum"],
    "audio",
    ["原始波形、頻譜與主頻", "PCM waveform, spectrum and dominant frequency"],
    "FFT · Δf = sampleRate / N",
    sound,
  ),
  e(
    "soundHistory",
    ["聲音頻率歷史", "Sound frequency history"],
    "audio",
    ["主頻隨時間與頻率熱圖", "Frequency history and spectrogram"],
    "f(t) · Hann FFT",
    sound,
  ),
  e(
    "soundTimer",
    ["聲控秒錶", "Acoustic stopwatch"],
    "audio",
    ["拍手或撞擊的來源時間與間隔", "Source-time sound events and intervals"],
    "Δt = t₂ − t₁",
    sound,
    [{ ...threshold, unit: "FS (1)" }, refractory],
  ),
  e(
    "bounce",
    ["反彈碰撞分析", "Bouncing ball"],
    "audio",
    [
      "碰撞間隔、模型高度與相對能量",
      "Impact intervals, model height and relative energy",
    ],
    "h = gΔt²/8 · E/E₀ = h/h₀",
    {
      ...sound,
      physics: [
        "由相鄰落地聲的間隔推導高度。假設垂直自由飛行、同一地面與 g=9.80665；需人工確認事件。不能辨識其他組噪音或直接量測能量 J。",
        "Infer height between consecutive ground impacts, assuming vertical free flight, one surface and g=9.80665. Inspect events manually. Other groups can cause false triggers; energy in joules is not directly measured.",
      ],
    },
    [{ ...threshold, unit: "FS (1)" }, refractory],
  ),
  e(
    "accelSpectrum",
    ["加速度頻譜", "Acceleration spectrum"],
    "motion",
    ["三軸振動訊號的主頻", "Dominant frequency of acceleration"],
    "FFT · f = 1/T",
    motion,
  ),
  e(
    "vibration",
    ["振動頻率歷史", "Vibration history"],
    "motion",
    ["振動頻率與時間熱圖", "Vibration frequency history and heatmap"],
    "f(t) · continuous windows",
    motion,
  ),
  e(
    "motionTimer",
    ["運動觸發秒錶", "Motion stopwatch"],
    "motion",
    ["以合線性加速度觸發事件", "Trigger events with linear acceleration"],
    "|a| ≥ threshold · Δt",
    motion,
    [{ ...threshold, value: 2, unit: "m/s²" }, refractory],
  ),
  e(
    "springK",
    ["彈簧常數", "Spring constant"],
    "motion",
    ["週期、有效質量與 k 推導", "Period, effective mass and spring constant"],
    "k = 4π²m/T²",
    {
      ...motion,
      physics: [
        "固定手機與載具，填入有效振動質量。理想線性彈簧與小振幅模型；彈簧質量、阻尼及固定方式會影響 k。",
        "Enter effective oscillating mass including phone and holder. Assumes a linear spring and small amplitude; spring mass, damping and mounting affect k.",
      ],
    },
    [mass],
  ),
  e(
    "radius",
    ["向心半徑擬合", "Centripetal radius fit"],
    "motion",
    ["a–ω² 擬合、半徑與殘差", "Fit a–ω², radius and residuals"],
    "a = rω² + b",
    {
      position: [
        "將手機固定在旋轉裝置，緩慢改變轉速，保留至少三段穩定轉速。",
        "Secure the phone on a rotating apparatus; record at least three steady angular speeds.",
      ],
      physics: [
        "每 0.5 s 取平均，以最小平方法擬合。斜率估計半徑，截距保留為診斷值；手機須跟著裝置旋轉，加速度須主要為向心分量。",
        "Average over 0.5 s bins and fit by least squares. Slope estimates radius; retain intercept as a diagnostic. The phone must rotate with the apparatus and acceleration must be predominantly radial.",
      ],
    },
  ),
  e(
    "gps",
    ["GPS／戶外運動", "GPS / outdoor motion"],
    "gps",
    ["定位、速度、高度與位移", "Location, speed, altitude and displacement"],
    "Haversine · Δs/Δt",
    {
      position: [
        "到戶外開闊位置，允許定位。等精度穩定再開始；手機網頁保持前景。",
        "Allow location outdoors with an open sky. Wait for stable accuracy before starting and keep the page visible.",
      ],
      physics: [
        "定位可能來自 GPS 或網路。保留精度、裝置速度及高度；累積路程只納入精度≤設定值的連續點，仍可能受漂移影響。",
        "Location may come from GPS or network sources. Keep accuracy, device speed and altitude. Path length includes only continuous fixes within the accuracy threshold and can still drift.",
      ],
    },
    [
      param(
        "accuracy",
        "可接受定位精度",
        "Accepted accuracy",
        "m",
        20,
        1,
        200,
        1,
      ),
    ],
  ),
  e(
    "brightness",
    ["相機亮度", "Camera brightness"],
    "camera",
    ["ROI 亮度隨時間", "ROI brightness over time"],
    "Y = 0.2126R + 0.7152G + 0.0722B",
    camera,
  ),
  e(
    "color",
    ["相機顏色", "Camera color"],
    "camera",
    ["ROI 的 R、G、B 與色彩比例", "ROI red, green, blue and proportions"],
    "R, G, B ∈ [0,255]",
    camera,
  ),
  e(
    "opticalTimer",
    ["光學秒錶", "Optical stopwatch"],
    "camera",
    ["遮光或閃光的影格事件時間", "Frame-time light / occlusion events"],
    "Δt · frame-limited",
    camera,
    [
      {
        ...threshold,
        value: 100,
        min: 1,
        max: 254,
        step: 1,
        unit: "1 (0…255)",
      },
      refractory,
      param(
        "dark",
        "遮光觸發（1=暗，0=亮）",
        "Occlusion trigger (1=dark,0=bright)",
        "",
        1,
        0,
        1,
        1,
      ),
    ],
  ),
  ...(["magnetometer", "light"] as const).map((id, i) =>
    e(
      id,
      (
        [
          ["三軸磁場", "Magnetic field"],
          ["環境照度", "Ambient illuminance"],
        ] as [string, string][]
      )[i],
      id,
      [
        "依瀏覽器與裝置能力啟用",
        "Available only when the browser exposes this sensor",
      ],
      ["B (µT)", "E (lx)"][i],
      {
        position: [
          "在手機按啟用，網站會檢查實際 API 與讀值。若不支援，請選其他手機量測模組。",
          "Enable on the phone to check the actual API and readings. If unavailable, choose another phone measurement.",
        ],
        physics: [
          "iPhone Safari 通常不提供這些原始感測 API。網站不會把姿態、相機像素或假資料當作原始磁場或照度。",
          "iPhone Safari generally does not expose these raw sensor APIs. Orientation, camera pixels and simulated data are not substituted for raw field or illuminance.",
        ],
      },
    ),
  ),
  e(
    "custom",
    ["教師自訂實驗", "Teacher experiment"],
    "motion",
    [
      "匯入可驗證的 JSON 量測設定",
      "Import a validated JSON measurement manifest",
    ],
    "selected sensor + chart + threshold",
    motion,
  ),
];
export function sourceFor(id: ExperimentId): Source {
  return advancedExperiments.find((e) => e.id === id)?.source ?? "motion";
}
export const parametersFor = (id: ExperimentId) =>
  advancedExperiments.find((e) => e.id === id)?.parameters ?? [];
export const limitFor = (id: ExperimentId) =>
  sourceFor(id) === "audio" ? 60 : 600;
