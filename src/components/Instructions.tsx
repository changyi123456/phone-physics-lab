import { ChevronRight } from "lucide-react";
import { tr, tx } from "../core/i18n";
import type { Experiment } from "../core/registry";
import type { Lang } from "../core/types";
export function Instructions({
  experiment,
  lang,
}: {
  experiment: Experiment;
  lang: Lang;
}) {
  const steps = [
    { title: tr("scan", lang), body: tr("scanHelp", lang) },
    { title: tr("position", lang), body: tx(experiment.position, lang) },
    { title: tr("begin", lang), body: tr("beginHelp", lang) },
  ];
  return (
    <section className="instructions panel">
      <h2>{tr("instructions", lang)}</h2>
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
    </section>
  );
}
