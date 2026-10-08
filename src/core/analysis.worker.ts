import { analyse } from "./analysis";
self.onmessage = (e) => {
  const { samples, id, params, calibration, job } = e.data;
  self.postMessage({ job, result: analyse(samples, id, params, calibration) });
};
