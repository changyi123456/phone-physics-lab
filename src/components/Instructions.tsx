import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { tr, tx } from "../core/i18n";
import type { Experiment } from "../core/registry";
import type { Lang } from "../core/types";
export function Instructions({
  experiment,
  lang,
  demo = false,
}: {
  experiment: Experiment;
  lang: Lang;
  demo?: boolean;
}) {
  const steps = [
    {
      title: demo
        ? lang === "zh"
          ? "示範來源"
          : "Demo source"
        : tr("scan", lang),
      body: demo
        ? lang === "zh"
          ? "使用內建訊號，無需配對手機；資料為示範，非實測。"
          : "Use the built-in signal without a phone. These are simulated readings."
        : tr("scanHelp", lang),
    },
    {
      title: demo
        ? lang === "zh"
          ? "觀察與設定"
          : "Inspect & configure"
        : tr("position", lang),
      body: demo
        ? lang === "zh"
          ? "先觀察讀值與參數，再開始量測熟悉分析流程。"
          : "Inspect readings and parameters, then start a run to explore analysis."
        : tx(experiment.position, lang),
    },
    { title: tr("begin", lang), body: tr("beginHelp", lang) },
  ];
  return (
    <details className="instructions panel" open key={experiment.id}>
      <summary>
        <BookOpen size={18} />
        <h2>{tr("instructions", lang)}</h2>
        <ChevronDown className="guide-toggle" size={17} />
      </summary>
      <div className="steps">
        {steps.map((step, i) => (
          <div className="step" key={i}>
            <span className="step-number">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            {i < 2 ? <ChevronRight className="step-chevron" size={18} /> : null}
          </div>
        ))}
      </div>
    </details>
  );
}
