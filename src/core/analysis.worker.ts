import { analyse } from "./analysis";
import { advancedAnalyse } from "./advanced-analysis";
self.onmessage = (e) => {
  const { samples, id, params, calibration, job } = e.data;
  self.postMessage({
    job,
    result: analyse(samples, id, params, calibration),
    advanced: advancedAnalyse(samples, id, params, calibration),
  });
};
