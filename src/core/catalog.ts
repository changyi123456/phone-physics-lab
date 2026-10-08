import { sourceFor } from "./advanced-registry";
import type { ExperimentId } from "./types";
import type { Text } from "./i18n";

export type Category =
  | "all"
  | "motion"
  | "sound"
  | "optics"
  | "environment"
  | "custom";
export const categories: { id: Category; name: Text }[] = [
  { id: "all", name: ["全部", "All experiments"] },
  { id: "motion", name: ["力學與振動", "Mechanics & vibration"] },
  { id: "sound", name: ["聲音與波", "Sound & waves"] },
  { id: "optics", name: ["光與影像", "Light & imaging"] },
  { id: "environment", name: ["位置與環境", "Position & environment"] },
  { id: "custom", name: ["自訂實驗", "Custom experiment"] },
];
export function categoryFor(id: ExperimentId): Category {
  if (id === "custom") return "custom";
  const source = sourceFor(id);
  if (source === "motion" || source === "orientation") return "motion";
  if (source === "audio") return "sound";
  if (source === "camera") return "optics";
  return "environment";
}
export function sourceName(id: ExperimentId): Text {
  const source = sourceFor(id);
  return source === "audio"
    ? ["麥克風", "Microphone"]
    : source === "camera"
      ? ["相機", "Camera"]
      : source === "gps"
        ? ["定位", "Location"]
        : source === "magnetometer"
          ? ["內建磁場感測", "Built-in magnetometer"]
          : source === "light"
            ? ["內建光感測", "Built-in light sensor"]
            : ["動作感測", "Motion sensor"];
}
