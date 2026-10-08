import { unitsFor, timingGuideFor } from "../core/measurement-info";
import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Play, Search } from "lucide-react";
import {
  categories,
  categoryFor,
  sourceName,
  type Category,
} from "../core/catalog";
import { experiments } from "../core/registry";
import { tx, type Text } from "../core/i18n";
import type { ExperimentId } from "../core/types";
import { Preferences, type PreferencesProps } from "./Preferences";
import { ExperimentIcon } from "./ExperimentIcon";

const featured: ExperimentId[] = [
  "acceleration",
  "sound",
  "pendulum",
  "soundHistory",
  "gyroscope",
  "brightness",
  "spring",
  "color",
];
const steps: { title: Text; body: Text }[] = [
  {
    title: ["選擇與配對", "Choose & connect"],
    body: [
      "電腦選實驗，手機掃描 QR Code。不同網路也能連線。",
      "Choose an experiment on the computer. Scan its QR code with your phone, even on a different network.",
    ],
  },
  {
    title: ["授權與量測", "Enable & measure"],
    body: [
      "手機允許所需感測器，依指引擺放，再由電腦開始或暫停。",
      "Allow the required sensors and position the phone as instructed. Start or pause from the computer.",
    ],
  },
  {
    title: ["分析與帶走", "Analyse & export"],
    body: [
      "結束後檢查圖表，手動下載 Excel。資料留在本次電腦頁面。",
      "Finish, inspect your plots, then download Excel manually. Data stays in this computer session.",
    ],
  },
];
export function Landing({
  onEnter,
  ...prefs
}: PreferencesProps & { onEnter: (id: ExperimentId, demo?: boolean) => void }) {
  const { lang } = prefs;
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const query = search.trim().toLowerCase();
  const matches = experiments.filter(
    (e) =>
      (category === "all" || categoryFor(e.id) === category) &&
      (!query ||
        [...e.name, ...e.description].some((t) =>
          t.toLowerCase().includes(query),
        )),
  );
  const visible =
    query || expanded
      ? matches
      : category === "all"
        ? featured
            .map((id) => experiments.find((e) => e.id === id)!)
            .filter(Boolean)
        : matches.slice(0, 8);
  return (
    <div className="landing">
      <a className="skip-link" href="#catalog">
        {lang === "zh" ? "跳至實驗目錄" : "Skip to experiments"}
      </a>
      <header className="landing-header page-width">
        <a
          className="landing-brand"
          href={location.pathname}
          aria-label="Phylab"
        >
          <span className="brand-wordmark">Phylab</span>
          <span>
            {lang === "zh"
              ? "手機感測・電腦實驗"
              : "Phone sensing · Desktop experiments"}
          </span>
        </a>
        <nav aria-label={lang === "zh" ? "入口導覽" : "Home navigation"}>
          <a href="#catalog">{lang === "zh" ? "實驗目錄" : "Experiments"}</a>
          <a href="#how-it-works">
            {lang === "zh" ? "使用方式" : "How it works"}
          </a>
        </nav>
        <Preferences {...prefs} />
      </header>
      <main>
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              {lang === "zh" ? (
                <>
                  <span>把物理現象，</span>
                  <span>變成看得見的數據。</span>
                </>
              ) : (
                <>
                  <span>Make physics</span>
                  <span>visible in your data.</span>
                </>
              )}
            </h1>
            <p>
              {lang === "zh"
                ? "手機負責感測，電腦即時繪圖。從第一次量測，到課堂上的科學探究。"
                : "Your phone senses. Your computer plots. From your first measurement to scientific inquiry in the classroom."}
            </p>
            <div className="hero-actions">
              <button
                className="button primary"
                onClick={() => onEnter("acceleration")}
              >
                {lang === "zh" ? "進入實驗室" : "Enter the lab"}
                <ArrowRight size={21} />
              </button>
              <button
                className="button outline"
                onClick={() => onEnter("pendulum", true)}
              >
                <Play size={18} />
                {lang === "zh" ? "試用示範" : "Try a demo"}
              </button>
            </div>
            <p className="hero-note">
              {lang === "zh"
                ? "不用安裝 App・每組獨立連線・完成後下載 Excel"
                : "No app to install · Independent groups · Export to Excel"}
            </p>
          </div>
          <figure className="hero-visual">
            <img
              src={`${import.meta.env.BASE_URL}assets/phylab-hero.png`}
              width="1448"
              height="1086"
              alt={
                lang === "zh"
                  ? "手機與單擺的物理實驗概念插圖"
                  : "Concept illustration of a phone and pendulum experiment"
              }
              fetchPriority="high"
            />
            <figcaption>
              {lang === "zh"
                ? "概念示意；可用感測器依手機與瀏覽器而定。"
                : "Concept illustration. Available sensors depend on your phone and browser."}
            </figcaption>
          </figure>
        </section>
        <section
          id="catalog"
          className="catalog page-width"
          aria-labelledby="catalog-title"
        >
          <div className="catalog-heading">
            <div>
              <h2 id="catalog-title">
                {lang === "zh"
                  ? "選一個現象，開始探索。"
                  : "Choose a phenomenon. Start exploring."}
              </h2>
              <p>
                {lang === "zh"
                  ? "依課程主題選擇實驗，進入後再配對手機。"
                  : "Choose an experiment for your lesson, then pair your phone inside the lab."}
              </p>
            </div>
            <label className="catalog-search">
              <Search size={20} />
              <input
                type="search"
                aria-label={lang === "zh" ? "搜尋實驗" : "Search experiments"}
                placeholder={lang === "zh" ? "搜尋實驗" : "Search experiments"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div
            className="category-tabs"
            role="group"
            aria-label={lang === "zh" ? "實驗分類" : "Experiment categories"}
          >
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                className={category === c.id ? "selected" : ""}
                onClick={() => {
                  setCategory(c.id);
                  setExpanded(false);
                }}
              >
                {tx(c.name, lang)}
              </button>
            ))}
          </div>
          <div
            className="catalog-measurement-guide"
            aria-label={
              lang === "zh" ? "教師量測須知" : "Teacher measurement guide"
            }
          >
            <p>
              <strong>{lang === "zh" ? "物理單位" : "Physical units"}</strong>
              {lang === "zh"
                ? "物理量採 SI；角度標明 °，相機與音訊幅度標明數位比例。"
                : "Physical quantities use SI; angles are labelled ° and camera/audio amplitude use digital scales."}
            </p>
            <p>
              <strong>{lang === "zh" ? "時間細節" : "Time detail"}</strong>
              {lang === "zh"
                ? "取樣、傳送與畫面更新各有頻率。連線後顯示實測值，時間戳小數位不是準確度。"
                : "Sampling, transmission and display have separate cadences. Observed values appear after pairing; timestamp decimals are not accuracy."}
            </p>
            <p>
              <strong>{lang === "zh" ? "課堂使用" : "Classroom use"}</strong>
              {lang === "zh"
                ? "先開下方「量測說明」確認適用條件。各組獨立，開始／暫停／結束由電腦控制。"
                : "Open Measurement notes below to inspect conditions. Groups are independent; the computer controls start, pause and finish."}
            </p>
          </div>
          <div className="catalog-list">
            {visible.map((e) => (
              <article className="experiment-item" key={e.id}>
                <button
                  className="experiment-entry"
                  onClick={() => onEnter(e.id)}
                >
                  <span className="entry-icon">
                    <ExperimentIcon id={e.id} size={36} />
                  </span>
                  <span className="entry-copy">
                    <strong>{tx(e.name, lang)}</strong>
                    <span>
                      {tx(e.description, lang)}
                      {["magnetometer", "light"].includes(e.id)
                        ? lang === "zh"
                          ? " · 需瀏覽器提供內建感測器"
                          : " · Requires browser sensor support"
                        : ""}
                    </span>
                  </span>
                  <span className="entry-source">
                    {tx(sourceName(e.id), lang)}
                  </span>
                  <ArrowRight size={19} />
                </button>
                <details className="experiment-preview">
                  <summary
                    aria-label={`${lang === "zh" ? "量測說明" : "Measurement notes"}: ${tx(e.name, lang)}`}
                  >
                    <span>
                      {lang === "zh" ? "量測說明" : "Measurement notes"}
                    </span>
                    <ChevronDown size={14} />
                  </summary>
                  <div>
                    <h3>{lang === "zh" ? "功能與圖表" : "Features & plots"}</h3>
                    <p>{tx(e.description, lang)}</p>
                    <p className="preview-formula">{e.formula}</p>
                    <h3>
                      {lang === "zh"
                        ? "單位與數值意義"
                        : "Units & interpretation"}
                    </h3>
                    <dl>
                      {unitsFor(e.id).map((row) => (
                        <div key={row.quantity[1]}>
                          <dt>
                            {tx(row.quantity, lang)} · <span>{row.unit}</span>
                          </dt>
                          <dd>{tx(row.note, lang)}</dd>
                        </div>
                      ))}
                    </dl>
                    <h3>
                      {lang === "zh"
                        ? "取樣時間與適用情境"
                        : "Sampling & suitable use"}
                    </h3>
                    <p>{tx(timingGuideFor(e.id), lang)}</p>
                    <h3>
                      {lang === "zh" ? "實驗條件" : "Experiment conditions"}
                    </h3>
                    <p>{tx(e.physics, lang)}</p>
                    <p className="preview-export">
                      {lang === "zh"
                        ? "圖表時間以秒 (s) 為基準；原始數據保留來源時間與分段。可暫停／繼續；結束後先看圖，再手動匯出 Excel（含單位、設定、取樣與品質資訊）。"
                        : "Plots use seconds (s); raw data retains source timestamps and segments. Pause/resume is supported. Finish, inspect plots, then export Excel manually with units, settings, sampling and quality notes."}
                    </p>
                  </div>
                </details>
              </article>
            ))}
          </div>
          {!visible.length ? (
            <p className="catalog-empty" role="status">
              {lang === "zh"
                ? "找不到符合的實驗，試試其他關鍵字。"
                : "No experiments match. Try another keyword."}
            </p>
          ) : null}
          {!query && matches.length > 8 ? (
            <button
              className="button outline catalog-expand"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? lang === "zh"
                  ? "收起目錄"
                  : "Show fewer"
                : lang === "zh"
                  ? `展開全部 ${matches.length} 項實驗`
                  : `Show all ${matches.length} experiments`}
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          ) : null}
        </section>
        <section
          id="how-it-works"
          className="how-band"
          aria-labelledby="how-title"
        >
          <div className="page-width">
            <h2 id="how-title">
              {lang === "zh"
                ? "三步，把教室變成實驗室。"
                : "Three steps to a classroom laboratory."}
            </h2>
            <div className="how-steps">
              {steps.map((step, i) => (
                <div key={i}>
                  <span className="how-number">0{i + 1}</span>
                  <div>
                    <h3>{tx(step.title, lang)}</h3>
                    <p>{tx(step.body, lang)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer page-width">
        <div>
          <span className="brand-wordmark">Phylab</span>
          <span>
            {lang === "zh"
              ? "手機感測・電腦實驗"
              : "Phone sensing · Desktop experiments"}
          </span>
        </div>
        <p>
          {lang === "zh"
            ? "獨立開發的教學工具，非官方 phyphox 網頁版。"
            : "An independent teaching tool, unaffiliated with phyphox."}
        </p>
      </footer>
    </div>
  );
}
