import { advancedExperiments } from "./advanced-registry";
import type { Source, Parameter } from "./advanced-registry";
import type { Capabilities, ExperimentId } from "./types";
import type { Text } from "./i18n";
export interface Experiment {
  id: ExperimentId;
  source?: Source;
  group?: string;
  parameters?: Parameter[];
  name: Text;
  description: Text;
  position: Text;
  physics: Text;
  formula: string;
  required: (keyof Capabilities)[];
}
const basicExperiments: Experiment[] = [
  {
    id: "acceleration",
    name: ["加速度", "Acceleration"],
    description: [
      "觀察三軸加速度與重力的影響",
      "Observe acceleration and gravity along three axes.",
    ],
    position: [
      "將手機穩定放置，觀察靜止與移動讀值。含重力合量靜止時約為 9.8 m/s²。",
      "Place the phone securely. Compare stationary and moving readings. Gravity-inclusive magnitude is about 9.8 m/s² at rest.",
    ],
    physics: [
      "裝置 x 向右、y 向頂端、z 朝螢幕外。含重力與線性加速度分開觀察；感測由瀏覽器／系統處理。",
      "Device x points right, y toward the top, z out of the screen. Compare gravity-inclusive and linear readings; values are processed by the browser/system.",
    ],
    formula: "|a| = √(aₓ² + aᵧ² + a_z²)",
    required: ["gravity"],
  },
  {
    id: "gyroscope",
    name: ["角速度", "Angular velocity"],
    description: [
      "量測手機繞各軸轉動的速率",
      "Measure rotation rate about each device axis.",
    ],
    position: [
      "先讓手機靜止校準，再分別繞各軸緩慢旋轉。",
      "Calibrate at rest, then rotate slowly around each axis.",
    ],
    physics: [
      "瀏覽器 deg/s 轉為 rad/s：x=beta、y=gamma、z=alpha。校準只扣除靜止角速度偏移，不改動原始接收值。",
      "Convert browser deg/s to rad/s: x=beta, y=gamma, z=alpha. Calibration removes stationary rotation bias; original received readings remain unchanged.",
    ],
    formula: "ω (rad/s) = rotationRate (°/s) × π / 180",
    required: ["gyro"],
  },
  {
    id: "inclination",
    name: ["傾角", "Inclination"],
    description: [
      "比較物理水平角與相對基準角",
      "Compare physical inclination and a relative reference.",
    ],
    position: [
      "保持靜止或緩慢傾斜。先選平放、直立或側放，再將目前姿態設為相對 0°。",
      "Keep still or tilt slowly. Choose a mounting view, then set the current pose as relative zero.",
    ],
    physics: [
      "以重力向量估算角度。快速平移時會受線性加速度影響；相對零點與物理水平角分開顯示。",
      "Angles are estimated from the gravity vector. Translation affects readings; relative zero and physical inclination are distinct.",
    ],
    formula:
      "θ = atan2(重力分量 / gravity component, 參考分量 / reference component)",
    required: ["gravity"],
  },
  {
    id: "pendulum",
    name: ["單擺", "Pendulum"],
    description: [
      "從角速度振動估算週期與重力加速度",
      "Estimate period and gravity from rotational oscillation.",
    ],
    position: [
      "將手機牢固固定在擺體，輸入支點至質心的擺長。小角度放手，至少量測數個完整週期。",
      "Secure the phone to the pendulum. Enter pivot-to-centre-of-mass length. Release at a small angle and record several cycles.",
    ],
    physics: [
      "週期來自角速度最明顯軸的自相關。g 使用小角度、質點近似；手機大小與固定方式造成剛體修正時須另評估。",
      "Period comes from autocorrelation of the strongest rotation axis. Gravity uses the small-angle point-mass model; finite phone size may require a rigid-body correction.",
    ],
    formula: "T = 2π√(L/g)   ·   g = 4π²L/T²",
    required: ["gyro"],
  },
  {
    id: "spring",
    name: ["彈簧振動", "Spring oscillation"],
    description: [
      "從振動曲線找出週期與頻率",
      "Find period and frequency from oscillation.",
    ],
    position: [
      "將手機固定於彈簧載具，沿單一方向小振幅振動。勿讓手機撞擊桌面，記錄數個週期。",
      "Secure the phone in a spring-mounted holder. Oscillate with small amplitude along one direction, with clearance from the table. Record several cycles.",
    ],
    physics: [
      "使用線性加速度。自相關估算 T，頻譜呈現主頻；有效質量與彈簧本身質量會影響理想模型。",
      "Use linear acceleration. Autocorrelation estimates T and the spectrum shows dominant frequency; effective mass can differ from the attached mass.",
    ],
    formula: "T = 2π√(m/k)   ·   f = 1/T",
    required: ["linear"],
  },
  {
    id: "centripetal",
    name: ["向心加速度", "Centripetal acceleration"],
    description: [
      "探索 a 與 ω² 的比例關係",
      "Explore the relationship between a and ω².",
    ],
    position: [
      "將手機牢固固定在半徑不變的旋轉裝置上，緩慢改變轉速。",
      "Secure the phone on a fixed-radius rotating apparatus and vary angular speed slowly.",
    ],
    physics: [
      "手機必須跟隨裝置旋轉，才能由自身角速度估計公轉速率。緩慢取平均，排除起停與非向心分量。",
      "The phone must rotate with the apparatus for its gyro to represent orbital rate. Average steady intervals and exclude starts, stops and other acceleration components.",
    ],
    formula: "a = rω²",
    required: ["linear", "gyro"],
  },
];
export const experiments = [...basicExperiments, ...advancedExperiments];
export const getExperiment = (id: ExperimentId) =>
  experiments.find((e) => e.id === id)!;
export const canMeasure = (
  id: ExperimentId,
  c: Capabilities,
  linear = false,
  customField = 0,
) =>
  id === "custom"
    ? !!c[(["linear", "gyro", "gravity"] as const)[customField] ?? "linear"]
    : getExperiment(id).required.every((key) => c[key]) &&
      (!linear || c.linear);
