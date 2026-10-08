import { workbookBytes } from "./export";
self.onmessage = async (e) => {
  try {
    const bytes = await workbookBytes(e.data.run, e.data.lang, e.data.trials);
    (
      self as unknown as {
        postMessage: (v: unknown, t: Transferable[]) => void;
      }
    ).postMessage({ bytes }, [bytes]);
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
