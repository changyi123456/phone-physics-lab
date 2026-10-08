import type { ExperimentId, Sample } from "./types";
import { sourceFor } from "./advanced-registry";
export interface UnitInfo {
  quantity: [string, string];
  unit: string;
  note: [string, string];
}
const unit = (
  quantity: [string, string],
  symbol: string,
  note: [string, string],
): UnitInfo => ({ quantity, unit: symbol, note });
export function unitsFor(id: ExperimentId, customField = 0): UnitInfo[] {
  const source = sourceFor(id);
  const rows = [
    unit(["時間／頻率", "Time / frequency"], "s · Hz", [
      "分析時間以秒為基準；1 Hz = 1 s⁻¹。ms、µs 是秒的 SI 前綴。",
      "Analysis uses seconds; 1 Hz = 1 s⁻¹. ms and µs are SI prefixes of the second.",
    ]),
  ];
  if (source === "motion") {
    const gyro =
      id === "gyroscope" ||
      id === "pendulum" ||
      (id === "custom" && customField === 1);
    rows.push(
      unit(
        gyro ? ["角速度", "Angular velocity"] : ["加速度", "Acceleration"],
        gyro ? "rad/s" : "m/s²",
        gyro
          ? [
              "瀏覽器的 °/s 先乘 π/180 再計算；匯出另保留原始欄位。數值小數位不代表感測準確度。",
              "Browser °/s is multiplied by π/180 before calculation; original fields are also exported. Decimal places do not establish sensor accuracy.",
            ]
          : [
              "瀏覽器提供 m/s²，無需再乘 9.8；含重力與線性加速度分開。小數位不代表感測準確度。",
              "The browser provides m/s²; no additional multiplication by 9.8 is needed. Gravity-inclusive and linear acceleration are separate. Decimal places do not establish accuracy.",
            ],
      ),
    );
    if (id === "inclination")
      rows.push(
        unit(["傾角", "Inclination"], "° ↔ rad", [
          "度是可與 SI 並用的非 SI 單位；1° = π/180 rad。Excel 同時提供 rad。",
          "Degrees are non-SI units accepted for use with SI; 1° = π/180 rad. Excel also provides radians.",
        ]),
      );
    if (id === "centripetal" || id === "radius")
      rows.push(
        unit(["角速度／半徑", "Angular velocity / radius"], "rad/s · m", [
          "a = rω² 必須使用 rad/s；rad 的量綱為 1。",
          "a = rω² requires rad/s; the radian has dimension one.",
        ]),
      );
    if (id === "springK")
      rows.push(
        unit(
          ["有效質量／彈簧常數", "Effective mass / spring constant"],
          "kg · N/m",
          [
            "k = 4π²m/T²；N/m = kg/s²，為模型推導值。",
            "k = 4π²m/T²; N/m = kg/s². This is a model-derived value.",
          ],
        ),
      );
    if (id === "pendulum")
      rows.push(
        unit(["擺長／重力加速度", "Pendulum length / gravity"], "m · m/s²", [
          "g = 4π²L/T² 為小角度理想模型推導值。",
          "g = 4π²L/T² is derived from the ideal small-angle model.",
        ]),
      );
  } else if (source === "audio") {
    rows.push(
      unit(["數位音訊幅度", "Digital audio amplitude"], "FS · 1", [
        "PCM 與 RMS 為滿刻度比例，無量綱；沒有聲壓 Pa 或 dB SPL 校準。",
        "PCM and RMS are dimensionless fractions of full scale; no Pa or dB SPL calibration is available.",
      ]),
    );
    if (id === "bounce")
      rows.push(
        unit(["反彈高度／能量比", "Bounce height / energy ratio"], "m · 1", [
          "h = gΔt²/8 使用 g=9.80665 m/s²；E/E₀ 無量綱，未量測能量 J。",
          "h = gΔt²/8 uses g=9.80665 m/s²; E/E₀ is dimensionless, not a measurement of energy in joules.",
        ]),
      );
  } else if (source === "camera")
    rows.push(
      unit(["RGB／亮度代碼", "RGB / brightness code"], "1 (0…255)", [
        "像素代碼及其加權值沒有物理單位；未換算 lx。不是線性光度或照度。",
        "Pixel codes and their weighted values have no physical unit; they are not converted to lx or linear photometric quantities.",
      ]),
    );
  else if (source === "gps") {
    rows.push(
      unit(
        ["路程／高度／精度／速度", "Distance / altitude / accuracy / speed"],
        "m · m/s",
        [
          "路程含定位漂移；精度是瀏覽器回報值，並非本站驗證的誤差。",
          "Distance includes position drift; accuracy is browser-reported and is not independently verified here.",
        ],
      ),
    );
    rows.push(
      unit(["經緯度", "Latitude / longitude"], "°", [
        "度可與 SI 並用，距離公式先轉 rad。定位來源也可能是網路。",
        "Degrees are accepted with SI and converted to radians in distance formulas. Location may use network sources.",
      ]),
    );
  } else if (source === "magnetometer")
    rows.push(
      unit(["磁通密度", "Magnetic flux density"], "µT", [
        "1 µT = 10⁻⁶ T；保留 API 的微特斯拉讀值。",
        "1 µT = 10⁻⁶ T; the API's microtesla readings are retained.",
      ]),
    );
  else if (source === "light")
    rows.push(
      unit(["照度", "Illuminance"], "lx", [
        "lux 的 SI 符號是 lx；需裝置提供原始照度 API。",
        "The SI symbol for lux is lx; a raw illuminance API must be available.",
      ]),
    );
  if (id === "custom")
    rows.push(
      unit(["可選訊號", "Selectable signals"], "m/s² · rad/s", [
        "預設為線性加速度；匯入教師設定可改為含重力加速度或角速度，門檻單位跟著所選訊號。",
        "The default is linear acceleration. A teacher manifest can select gravity-inclusive acceleration or angular velocity; the threshold uses the selected signal's unit.",
      ]),
    );
  if (
    [
      "pendulum",
      "spring",
      "accelSpectrum",
      "vibration",
      "springK",
      "sound",
      "soundHistory",
    ].includes(id)
  )
    rows.push(
      unit(
        ["正規化 FFT／自相關", "Normalised FFT / correlation"],
        "1 · dB relative",
        [
          "FFT 每窗以自身峰值正規化；熱圖 0 dB 是該窗峰值，不能比較絕對音量／振幅。",
          "Each FFT window is normalised to its own peak. Spectrogram 0 dB is that window's peak, so absolute loudness or amplitude cannot be compared.",
        ],
      ),
    );
  return rows;
}
export const sourceNames: Record<Sample["source"], [string, string]> = {
  motion: ["運動感測", "Motion"],
  orientation: ["姿態", "Orientation"],
  audio: ["麥克風 PCM", "Microphone PCM"],
  camera: ["相機 ROI", "Camera ROI"],
  gps: ["瀏覽器定位", "Browser location"],
  magnetometer: ["磁場", "Magnetic field"],
  light: ["環境照度", "Ambient illuminance"],
};

export function timingGuideFor(id: ExperimentId): [string, string] {
  const source = sourceFor(id);
  if (source === "audio")
    return [
      "PCM 取樣率由 AudioContext 回報；例如 48 kHz 為 20.83 µs／點，每塊 1024 點約 21.33 ms。聲控／反彈事件另以約 5 ms RMS 窗判定，未校準輸入延遲。不能把 PCM 點間隔當作事件準確度。",
      "AudioContext reports the PCM rate; for example, 48 kHz means 20.83 µs/sample and about 21.33 ms per 1024-sample block. Acoustic/bounce triggers use approximately 5 ms RMS windows; input latency is not calibrated. PCM spacing is not event accuracy.",
    ];
  if (source === "camera")
    return [
      "ROI 最快每 95 ms 取一次，上限約 10.5 Hz，還受相機影格率影響。實測間隔在實驗頁顯示。適合較慢的明暗變化與遮光事件；快速光閘可能漏掉。曝光、白平衡與輸入延遲未知。",
      "ROI samples are at least 95 ms apart (at most about 10.5 Hz), further limited by video frame rate. The measured cadence is shown in the lab. Use for slower brightness and occlusion events; fast light gates may be missed. Exposure, white balance and input latency are unknown.",
    ];
  if (source === "gps")
    return [
      "定位由手機系統更新，沒有固定 Hz 或最短間隔保證。適合戶外路程、慢速運動與精度探究；請先等定位精度穩定，不能用來分析毫秒碰撞。",
      "The phone controls location updates; no fixed Hz or shortest interval is guaranteed. Suitable for outdoor paths, slower motion and location-accuracy inquiry. Wait for stable accuracy; do not use it for millisecond impacts.",
    ];
  if (source === "magnetometer" || source === "light")
    return [
      "向 Generic Sensor API 請求 20 Hz（50 ms），實際值可能更慢或完全不支援。iPhone Safari 通常沒有這些原始 API；本站不會用姿態／相機值代替。",
      "Generic Sensor API is requested at 20 Hz (50 ms), but readings may be slower or unsupported. iPhone Safari generally lacks these raw APIs; orientation and camera values are not substituted.",
    ];
  return [
    "運動感測頻率由手機／瀏覽器決定，網站沒有固定硬體 Hz；例如實測 50 Hz 時，點間隔約 20 ms。配對後顯示實測中位間隔與範圍。適合週期與較慢運動；碰撞、快速振動需檢查漏取樣與混疊。",
    "Motion cadence is controlled by the phone/browser with no fixed hardware Hz here; a measured 50 Hz corresponds to about 20 ms/sample. Pairing reveals the median interval and range. Suitable for periodic and slower motion; inspect missed samples and aliasing before studying impacts or fast vibration.",
  ];
}
