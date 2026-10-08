import { useState } from "react";
import {
  EXAMPLE_MANIFEST,
  parseManifest,
  type TeacherManifest,
} from "../core/manifest";
import type { Lang } from "../core/types";
export function TeacherConfig({
  lang,
  disabled,
  manifest,
  onLoad,
}: {
  lang: Lang;
  disabled: boolean;
  manifest: TeacherManifest | null;
  onLoad: (m: TeacherManifest) => void;
}) {
  const [error, set] = useState("");
  const zh = lang === "zh";
  return (
    <section className="teacher-config panel">
      <h2>{zh ? "教師實驗設定" : "Teacher experiment settings"}</h2>
      <p>
        {manifest
          ? manifest.notes[lang]
          : zh
            ? "可匯入 JSON 設定感測來源、觸發門檻與中英教學提示。"
            : "Import JSON to set the motion source, trigger threshold and bilingual instructions."}
      </p>
      <div className="session-actions">
        <label className="button outline">
          {zh ? "匯入設定" : "Import manifest"}
          <input
            type="file"
            accept="application/json,.json"
            disabled={disabled}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 10000) throw new Error();
                const m = parseManifest(JSON.parse(await file.text()));
                onLoad(m);
                set("");
              } catch {
                set(
                  zh
                    ? "設定格式不正確。請參考範例。"
                    : "Invalid manifest. Refer to the example.",
                );
              }
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="button"
          disabled={disabled}
          onClick={() => onLoad(EXAMPLE_MANIFEST)}
        >
          {zh ? "載入範例" : "Load example"}
        </button>
        <a
          className="button"
          download="teacher-experiment.json"
          href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(EXAMPLE_MANIFEST, null, 2))}`}
        >
          {zh ? "下載設定範例" : "Download example JSON"}
        </a>
      </div>
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
      {manifest ? (
        <p>
          <strong>{manifest.name[lang]}</strong> · {manifest.sensor} ·
          threshold={manifest.threshold} · refractory={manifest.refractory}s
        </p>
      ) : null}
    </section>
  );
}
