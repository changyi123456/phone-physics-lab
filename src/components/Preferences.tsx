import { Globe, Moon, Sun } from "lucide-react";
import type { Lang, Theme } from "../core/types";
import { tr } from "../core/i18n";
export interface PreferencesProps {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}
export function Preferences({
  lang,
  theme,
  setLang,
  setTheme,
}: PreferencesProps) {
  return (
    <div className="preferences">
      <button
        className="button theme-switch"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        title={tr(theme === "light" ? "dark" : "light", lang)}
        aria-label={tr(theme === "light" ? "dark" : "light", lang)}
      >
        {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        <span>{tr(theme === "light" ? "dark" : "light", lang)}</span>
      </button>
      <label className="language">
        <Globe size={16} />
        <select
          aria-label="Language / 語言"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          <option value="zh">繁體中文</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
  );
}
