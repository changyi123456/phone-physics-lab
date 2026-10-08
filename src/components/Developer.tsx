import { ExternalLink, Mail } from "lucide-react";
import { tx, type Text } from "../core/i18n";
import type { PreferencesProps } from "./Preferences";
import { PublicHeader, publicPageUrl } from "./PublicHeader";

function Instagram({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const profile: { label: Text; body: Text }[] = [
  {
    label: ["學歷", "Education"],
    body: [
      "國立彰化師範大學物理系與物理研究所畢業；現就讀國立臺灣師範大學科學教育研究所博士班。",
      "Completed undergraduate and graduate studies in physics at National Changhua University of Education. Currently a doctoral student in science education at National Taiwan Normal University.",
    ],
  },
  {
    label: ["教學與指導", "Teaching & mentoring"],
    body: [
      "曾在中興高中與明道中學任教，投入物理教學、探究與實作、科展與物理競賽指導。",
      "Previously taught at National Chung Hsing Senior High School and Mingdao High School, with work in physics teaching, inquiry projects, science fairs and physics competition mentoring.",
    ],
  },
  {
    label: ["研究與創作", "Research & development"],
    body: [
      "關注科學與物理教育，作品涵蓋互動模擬、影像追蹤、教學遊戲與探究評量。",
      "Focuses on science and physics education. Projects include interactive simulations, video tracking, educational games and inquiry assessment.",
    ],
  },
];
const principles: { title: Text; body: Text }[] = [
  {
    title: ["隨手可做的實驗", "Experiments within reach"],
    body: [
      "用瀏覽器結合手機感測與電腦運算，把日常裝置變成科學實驗工具，隨時隨地都能動手做實驗。",
      "Combine phone sensors with computer analysis in the browser, turning everyday devices into tools for hands-on science.",
    ],
  },
  {
    title: ["看得懂的數據", "Data you can interpret"],
    body: [
      "清楚標示物理量的單位、取樣頻率與量測限制，並以圖表即時呈現，幫助學生理解數據背後的意義。",
      "Make units, sampling rates and measurement limits visible alongside live plots, so students can interpret the evidence.",
    ],
  },
  {
    title: ["把課堂時間還給探究", "More classroom time for inquiry"],
    body: [
      "不用安裝、不用登入，各組可獨立操作，支援暫停與繼續，也能匯出資料到 Excel，讓課堂更專注於提問、討論與實作。",
      "No installation or sign-in. Independent groups can pause, resume and export Excel, leaving more time for questions, discussion and investigation.",
    ],
  },
];
const works: { title: Text; description: Text; href: string }[] = [
  {
    title: ["AI 物理教室", "AI Physics Classroom"],
    description: [
      "互動模擬、教學遊戲與數位學習作品入口",
      "A collection of interactive simulations, educational games and digital learning projects.",
    ],
    href: "https://aiphysicsteacher.netlify.app/",
  },
  {
    title: ["TRAIL 探究實證歷程評量", "TRAIL · Inquiry assessment"],
    description: [
      "從報告證據與追問，看見學生的科學理解。",
      "Explore students’ scientific understanding through report evidence and follow-up questions.",
    ],
    href: "https://trailassessment.com/about",
  },
];

export function Developer(prefs: PreferencesProps) {
  const { lang } = prefs;
  return (
    <div className="landing developer-page">
      <a className="skip-link" href="#developer-content">
        {lang === "zh" ? "跳至開發者介紹" : "Skip to developer profile"}
      </a>
      <PublicHeader {...prefs} page="developer" />
      <main id="developer-content">
        <section
          className="developer-hero page-width"
          aria-labelledby="developer-title"
        >
          <div className="developer-copy">
            <h1 id="developer-title">
              {lang === "zh" ? "開發者介紹" : "Meet the developer"}
            </h1>
            <h2>{lang === "zh" ? "江長屹" : "Chang-Yi Chiang"}</h2>
            <p
              className="developer-name"
              lang={lang === "zh" ? "en" : "zh-Hant"}
            >
              {lang === "zh" ? "Chang-Yi Chiang" : "江長屹"}
            </p>
            <p className="developer-role">
              {lang === "zh"
                ? "物理教育工作者・Phylab 開發者"
                : "Physics educator · Phylab developer"}
            </p>
            <p className="developer-intro">
              {lang === "zh"
                ? "高中物理教學經驗六年，目前就讀國立臺灣師範大學科學教育研究所博士班。從教室裡的探究與實作出發，開發讓學生能操作、觀察並討論證據的數位工具。"
                : "With six years of high-school physics teaching experience, Chang-Yi is currently a doctoral student in science education at National Taiwan Normal University. Classroom inquiry inspires digital tools that help students experiment, observe and discuss evidence."}
            </p>
            <div
              className="developer-contact"
              aria-label={lang === "zh" ? "聯絡方式" : "Contact"}
            >
              <a href="mailto:d2316079@gmail.com">
                <Mail size={21} aria-hidden="true" />
                d2316079@gmail.com
              </a>
              <a
                href="https://www.instagram.com/aiphysicsteacher/"
                target="_blank"
                rel="noopener noreferrer"
                title={
                  lang === "zh"
                    ? "Instagram（另開分頁）"
                    : "Instagram (opens a new tab)"
                }
              >
                <Instagram size={21} aria-hidden="true" />
                @aiphysicsteacher
              </a>
            </div>
          </div>
          <figure className="developer-portrait">
            <div className="developer-portrait-frame">
              <img
                src={`${import.meta.env.BASE_URL}assets/chang-yi-chiang.webp`}
                width="760"
                height="1602"
                alt={
                  lang === "zh"
                    ? "江長屹的作者插圖"
                    : "Illustration of Chang-Yi Chiang"
                }
                fetchPriority="high"
              />
            </div>
            <figcaption>
              {lang === "zh"
                ? "作者插圖取自 TRAIL。"
                : "Author illustration from TRAIL."}
            </figcaption>
          </figure>
        </section>
        <section
          className="developer-background page-width"
          aria-labelledby="background-title"
        >
          <h2 id="background-title">
            {lang === "zh" ? "從教室出發" : "Rooted in the classroom"}
          </h2>
          <dl>
            {profile.map((row) => (
              <div key={row.label[1]}>
                <dt>{tx(row.label, lang)}</dt>
                <dd>{tx(row.body, lang)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          className="developer-principles"
          aria-labelledby="principles-title"
        >
          <div className="page-width">
            <h2 id="principles-title">
              {lang === "zh" ? (
                <>
                  <span className="brand-wordmark">Phylab</span> 的設計理念
                </>
              ) : (
                <>
                  The ideas behind{" "}
                  <span className="brand-wordmark">Phylab</span>
                </>
              )}
            </h2>
            <div className="developer-principle-list">
              {principles.map((row, i) => (
                <div key={row.title[1]}>
                  <span className="how-number">0{i + 1}</span>
                  <h3>{tx(row.title, lang)}</h3>
                  <p>{tx(row.body, lang)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          className="developer-works page-width"
          aria-labelledby="works-title"
        >
          <h2 id="works-title">
            {lang === "zh" ? "更多教學作品" : "More teaching projects"}
          </h2>
          <div>
            {works.map((work) => (
              <a
                key={work.href}
                href={work.href}
                target="_blank"
                rel="noopener noreferrer"
                title={lang === "zh" ? "另開分頁" : "Opens a new tab"}
              >
                <strong>{tx(work.title, lang)}</strong>
                <span>{tx(work.description, lang)}</span>
                <ExternalLink size={20} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </main>
      <footer className="developer-footer page-width">
        <a
          className="landing-brand"
          href={publicPageUrl("home", prefs)}
          aria-label={lang === "zh" ? "Phylab 返回入口" : "Phylab home"}
        >
          <span className="brand-wordmark">Phylab</span>
          <span>
            {lang === "zh"
              ? "手機感測・電腦實驗"
              : "Phone sensing · Desktop experiments"}
          </span>
        </a>
        <div>
          <p>
            {lang === "zh" ? "參考資料：" : "Sources: "}
            <a
              href="https://aiphysicsteacher.netlify.app/#author"
              target="_blank"
              rel="noopener noreferrer"
            >
              {lang === "zh"
                ? "AI 物理教室作者頁"
                : "AI Physics Classroom author profile"}
            </a>
            <span aria-hidden="true"> · </span>
            <a
              href="https://trailassessment.com/about"
              target="_blank"
              rel="noopener noreferrer"
            >
              {lang === "zh" ? "關於 TRAIL" : "About TRAIL"}
            </a>
          </p>
          <p>
            {lang === "zh" ? "資料更新：" : "Profile updated: "}
            <time dateTime="2026-10-08">2026-10-08</time>
          </p>
        </div>
      </footer>
    </div>
  );
}
