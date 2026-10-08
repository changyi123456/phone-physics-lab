export interface TeacherManifest {
  schema: 1;
  name: { zh: string; en: string };
  sensor: "linear" | "gyro" | "gravity";
  threshold: number;
  refractory: number;
  notes: { zh: string; en: string };
}
export const EXAMPLE_MANIFEST: TeacherManifest = {
  schema: 1,
  name: { zh: "桌面振動探究", en: "Desk vibration inquiry" },
  sensor: "linear",
  threshold: 2,
  refractory: 0.18,
  notes: {
    zh: "將手機固定於桌面，輕敲桌面，觀察頻率與事件間隔。",
    en: "Secure the phone to the desk and tap lightly. Inspect frequency and event intervals.",
  },
};
export function parseManifest(value: unknown): TeacherManifest {
  const m = value as TeacherManifest;
  if (
    !m ||
    m.schema !== 1 ||
    !["linear", "gyro", "gravity"].includes(m.sensor) ||
    !Number.isFinite(m.threshold) ||
    m.threshold <= 0 ||
    m.threshold > 100 ||
    !Number.isFinite(m.refractory) ||
    m.refractory < 0.02 ||
    m.refractory > 10
  )
    throw new Error("Invalid manifest");
  for (const obj of [m.name, m.notes])
    if (
      !obj ||
      typeof obj.zh !== "string" ||
      typeof obj.en !== "string" ||
      obj.zh.length > 1000 ||
      obj.en.length > 1000 ||
      !obj.zh.trim() ||
      !obj.en.trim()
    )
      throw new Error("Invalid bilingual text");
  return {
    schema: 1,
    name: { ...m.name },
    notes: { ...m.notes },
    sensor: m.sensor,
    threshold: m.threshold,
    refractory: m.refractory,
  };
}
