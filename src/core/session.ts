import type { Run, Point } from "./types";
import { analyse } from "./analysis";
import { advancedAnalyse, linearFit, statistics } from "./advanced-analysis";
export interface Trial {
  id: string;
  experiment: Run["experiment"];
  mode: Run["mode"];
  params: Record<string, number>;
  count: number;
  period: number | null;
  frequency: number | null;
  k: number | null;
  radius: number | null;
  complete: boolean;
}
export function trialFrom(run: Run): Trial {
  const base = analyse(
      run.samples,
      run.experiment,
      run.params,
      run.calibration,
    ),
    extra = advancedAnalyse(
      run.samples,
      run.experiment,
      run.params,
      run.calibration,
    );
  const period = extra.period ?? base.period;
  return {
    id: run.id,
    experiment: run.experiment,
    mode: run.mode,
    params: { ...run.params },
    count: run.samples.length,
    period,
    frequency: extra.frequency ?? base.frequency,
    k:
      ["spring", "springK"].includes(run.experiment) &&
      period &&
      run.params.mass
        ? (4 * Math.PI ** 2 * run.params.mass) / period ** 2
        : null,
    radius: extra.fit?.slope ?? null,
    complete: run.complete,
  };
}
export function compareTrials(
  trials: Trial[],
  experiment: Run["experiment"] | undefined,
  mode: Run["mode"] | undefined,
  quantity: "frequency" | "period" | "k" | "radius" = "period",
) {
  const filtered = trials.filter(
    (t) => t.experiment === experiment && t.mode === mode,
  );
  const stats = statistics(
    filtered.flatMap((t) => (t[quantity] === null ? [] : [t[quantity]!])),
  );
  const scan =
    experiment === "pendulum"
      ? "length"
      : ["spring", "springK"].includes(experiment ?? "")
        ? "mass"
        : null;
  const points: Point[] = filtered.flatMap((t, i) => {
    const x = scan ? t.params[scan] : i + 1,
      y = scan ? (t.period === null ? null : t.period ** 2) : t[quantity];
    return x === undefined ? [] : [{ x, y }];
  });
  const fit = scan ? linearFit(points) : null;
  const derived = fit && fit.slope > 0 ? (4 * Math.PI ** 2) / fit.slope : null;
  return { stats, scan, points, fit, derived, filtered };
}
