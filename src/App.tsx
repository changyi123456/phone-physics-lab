import { useEffect, useState } from "react";
import { Desktop } from "./components/Desktop";
import { Phone } from "./components/Phone";
import type { Lang, Theme } from "./core/types";
const params = new URLSearchParams(location.search);
function initialPrefs() {
  let saved: { lang?: Lang; theme?: Theme } = {};
  try {
    saved = JSON.parse(localStorage.getItem("physics-ui-v1") ?? "{}");
  } catch {}
  return {
    lang: (params.get("lang") === "en"
      ? "en"
      : params.get("lang") === "zh"
        ? "zh"
        : (saved.lang ?? "zh")) as Lang,
    theme: (params.get("theme") === "dark"
      ? "dark"
      : params.get("theme") === "light"
        ? "light"
        : (saved.theme ??
          (matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"))) as Theme,
  };
}
export default function App() {
  const [prefs, setPrefs] = useState(initialPrefs);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = prefs.lang === "zh" ? "zh-Hant" : "en";
    const url = new URL(location.href);
    url.searchParams.set("lang", prefs.lang);
    url.searchParams.set("theme", prefs.theme);
    history.replaceState(null, "", url);
    try {
      localStorage.setItem("physics-ui-v1", JSON.stringify(prefs));
    } catch {}
  }, [prefs]);
  const common = {
    ...prefs,
    setLang: (lang: Lang) => setPrefs((p) => ({ ...p, lang })),
    setTheme: (theme: Theme) => setPrefs((p) => ({ ...p, theme })),
  };
  const code = params.get("sensor");
  return code ? <Phone code={code} {...common} /> : <Desktop {...common} />;
}
