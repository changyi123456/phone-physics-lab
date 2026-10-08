import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Landing } from "./components/Landing";
import { experiments, getExperiment } from "./core/registry";
import { tx } from "./core/i18n";
import type { ExperimentId, Lang, Theme } from "./core/types";
const Desktop = lazy(() =>
  import("./components/Desktop").then((m) => ({ default: m.Desktop })),
);
const Phone = lazy(() =>
  import("./components/Phone").then((m) => ({ default: m.Phone })),
);
const params = new URLSearchParams(location.search);
type Route = { view: "home" | "lab"; experiment: ExperimentId; demo: boolean };
function readRoute(): Route {
  const query = new URLSearchParams(location.search);
  const id = query.get("experiment");
  return {
    view: query.get("view") === "lab" ? "lab" : "home",
    experiment: experiments.find((e) => e.id === id)?.id ?? "acceleration",
    demo: query.get("mode") === "demo",
  };
}
function routeUrl(route: Route) {
  const url = new URL(location.href);
  url.hash = "";
  for (const key of ["view", "experiment", "mode"])
    url.searchParams.delete(key);
  if (route.view === "lab") {
    url.searchParams.set("view", "lab");
    url.searchParams.set("experiment", route.experiment);
    if (route.demo) url.searchParams.set("mode", "demo");
  }
  return url;
}
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
        : saved.lang === "en"
          ? "en"
          : "zh") as Lang,
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
  const [route, setRoute] = useState(readRoute);
  const routeRef = useRef(route);
  const exitGuard = useRef<(() => boolean) | null>(null);
  const code = params.get("sensor");
  const registerExitGuard = useCallback((guard: (() => boolean) | null) => {
    exitGuard.current = guard;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = prefs.lang === "zh" ? "zh-Hant" : "en";
    const url = new URL(location.href);
    url.searchParams.set("lang", prefs.lang);
    url.searchParams.set("theme", prefs.theme);
    history.replaceState(null, "", url);
    document.title = `${code ? (prefs.lang === "zh" ? "手機感測器" : "Phone sensor") : route.view === "lab" ? tx(getExperiment(route.experiment).name, prefs.lang) : prefs.lang === "zh" ? "手機感測・電腦實驗" : "Phone sensing · Desktop experiments"} · Phylab`;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", prefs.theme === "dark" ? "#101c1c" : "#ffffff");
    try {
      localStorage.setItem("physics-ui-v1", JSON.stringify(prefs));
    } catch {}
  }, [prefs, route, code]);
  useEffect(() => {
    if (code) return;
    const pop = () => {
      const next = readRoute();
      if (
        next.view !== routeRef.current.view &&
        exitGuard.current &&
        !exitGuard.current()
      ) {
        history.pushState(null, "", routeUrl(routeRef.current));
        return;
      }
      routeRef.current = next;
      setRoute(next);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [code]);
  const navigate = (next: Route) => {
    if (exitGuard.current && !exitGuard.current()) return;
    history.pushState(null, "", routeUrl(next));
    routeRef.current = next;
    setRoute(next);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  const common = {
    ...prefs,
    setLang: (lang: Lang) => setPrefs((p) => ({ ...p, lang })),
    setTheme: (theme: Theme) => setPrefs((p) => ({ ...p, theme })),
  };
  if (code)
    return (
      <Suspense fallback={<div className="boot">Phylab</div>}>
        <Phone code={code} {...common} />
      </Suspense>
    );
  if (route.view === "home")
    return (
      <Landing
        {...common}
        onEnter={(experiment, demo = false) =>
          navigate({ view: "lab", experiment, demo })
        }
      />
    );
  return (
    <Suspense fallback={<div className="boot">Phylab</div>}>
      <Desktop
        {...common}
        initialExperiment={route.experiment}
        initialDemo={route.demo}
        registerExitGuard={registerExitGuard}
        onHome={() =>
          navigate({ view: "home", experiment: "acceleration", demo: false })
        }
        onSelection={(experiment, demo) => {
          const next: Route = { view: "lab", experiment, demo };
          routeRef.current = next;
          setRoute(next);
          history.replaceState(null, "", routeUrl(next));
        }}
      />
    </Suspense>
  );
}
