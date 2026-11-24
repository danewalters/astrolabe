"use client";

import { ArrowDown, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import type { ZiweiChart } from "@/lib/calendar";
import { chartAnchor, palaceLabel, starReference } from "@/lib/chart-references";
import type { Focus } from "@/lib/panels";
import { years } from "@/lib/schema";
import { BrandMark } from "./instrument";
import { Button } from "./ui/button";

const palacePositions = [[4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2]];
const palaceMeaning: Record<string, string> = {
  命宫: "传统上用于观察一个人的整体处事方式。",
  兄弟: "用于观察与同辈相处和协作的方式。",
  夫妻: "用于观察亲密关系中的期待、界限和沟通。",
  子女: "用于观察照料、创造和代际互动。",
  财帛: "用于观察资源分配、金钱习惯和风险偏好。",
  疾厄: "传统上关联身心负荷，可用来反思日常休息和自我照顾。",
  迁移: "用于观察人在陌生环境中的适应方式。",
  仆役: "也称交友宫，用于观察社交、团队和合作网络。",
  官禄: "用于观察职业角色、责任和工作方式。",
  田宅: "用于观察居住、安全感和对空间的需求。",
  福德: "用于观察休息、内在满足和应对压力的方式。",
  父母: "用于观察家庭经验与权威关系的影响。",
};

export type PalaceSelection = { palace: number; star?: string };
const linkModes = [
  { value: "all", label: "全部连线" },
  { value: "relations", label: "三方四正" },
  { value: "transformations", label: "宫干飞化" },
] as const;
type Links = (typeof linkModes)[number]["value"];

function position(index: number) {
  const [row, column] = palacePositions[index];
  return { x: (column - .5) * 100, y: (row - .5) * 100 };
}

function PalaceConnections({ palace, links }: { palace: ZiweiChart["palaces"][number]; links: Links }) {
  const halo = useId();
  const from = position(palace.index);
  const related = links === "transformations" ? [] : palace.related;
  const transformations = links === "relations" ? [] : palace.flies;

  function curve(target: number, offset = 0) {
    const to = position(target);
    if (target === palace.index) {
      const inwardX = (from.x + 200) / 2;
      const inwardY = (from.y + 200) / 2;
      return `M${from.x} ${from.y} C${inwardX - 16} ${inwardY + offset} ${inwardX + 16} ${inwardY + offset} ${to.x + 8} ${to.y}`;
    }
    return `M${from.x} ${from.y} C${200 + offset} ${150 + offset} ${200 - offset} ${250 + offset} ${to.x} ${to.y}`;
  }

  return (
    <svg className="ziwei-connections" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <filter id={halo} filterUnits="userSpaceOnUse" x="-12" y="-12" width="424" height="424">
          <feGaussianBlur stdDeviation="2.25" />
        </filter>
      </defs>
      <g key={palace.index + "-" + links} className="ziwei-curve-set">
        {related.map((target) => <path className="ziwei-route-related" key={target} d={curve(target)} vectorEffect="non-scaling-stroke" />)}
        {transformations.map(({ target, type }, index) => {
          const path = curve(target, (index - 1.5) * 24);
          return <g key={type} data-transition={type}>
            <path className="ziwei-route-halo" d={path} filter={`url(#${halo})`} vectorEffect="non-scaling-stroke" />
            <path className="ziwei-route" d={path} vectorEffect="non-scaling-stroke" />
          </g>;
        })}
        <circle className="ziwei-route-origin" cx={from.x} cy={from.y} r="1.65" />
      </g>
    </svg>
  );
}

export function Ziwei({ chart, selection, onSelect, isYearly, setYearly, busy, changingYear, yearError, onYear, onLocateAnnual, inspect }: {
  chart: ZiweiChart;
  selection: PalaceSelection | null;
  onSelect: (selection: PalaceSelection) => void;
  isYearly: boolean;
  setYearly: (value: boolean) => void;
  busy: boolean;
  changingYear: boolean;
  yearError: string;
  onYear: (year: number) => void;
  onLocateAnnual: (palace: number, star?: string) => void;
  inspect: (focus: Focus) => void;
}) {
  const [links, setLinks] = useState<Links>("all");
  const [previewed, setPreviewed] = useState<number | null>(null);
  const natalIndex = chart.palaces.find((item) => item.name === "命宫")?.index ?? 0;
  const palace = chart.palaces[selection?.palace ?? natalIndex];
  const linkedFrom = chart.palaces[previewed ?? palace.index];
  const name = palaceLabel(palace.name);
  const meaning = palaceMeaning[palace.name] ?? "传统紫微斗数的十二个观察领域之一。";
  const selectedStar = [...palace.major, ...palace.minor].find((star) => star.name === selection?.star);
  const activeYear = chart.year;
  const earliestYear = Math.max(years.min, Math.min(activeYear.year, Number(chart.birth.civil.slice(0, 4))));
  const yearChoices = Array.from({ length: years.max - earliestYear + 1 }, (_, index) => earliestYear + index);
  const yearTransformations = activeYear.transformations.filter((item) => item.palaceIndex === palace.index);
  const lifePalace = chart.palaces[activeYear.lifePalaceIndex];
  const focusTitle = selectedStar ? `${name} · ${selectedStar.name}` : name;
  const linkedTargets = links === "transformations" ? linkedFrom.flies.map((item) => item.target) : linkedFrom.related;

  function askAboutSelection() {
    const stars = palace.major.map((star) => star.name + (star.mutagen ? "化" + star.mutagen : ""));
    inspect({
      kind: selectedStar ? "star" : "palace", id: selectedStar ? `${palace.index}:${selectedStar.name}` : String(palace.index),
      label: focusTitle,
      detail: selectedStar
        ? [palace.stem + palace.branch, selectedStar.brightness, selectedStar.mutagen && "生年化" + selectedStar.mutagen].filter(Boolean).join(" · ")
        : `${palace.stem}${palace.branch} · ${stars.join("、") || "无主星"}`,
      description: meaning,
    });
  }

  return (
    <div className="ziwei-layout">
      <section className="ziwei-board-section" aria-labelledby="ziwei-board-heading">
        <div className="ziwei-board-head">
          <h2 id="ziwei-board-heading">十二宫</h2>
          <div className="segmented ziwei-layers" aria-label="命盘层">
            <button type="button" aria-pressed={!isYearly} onClick={() => setYearly(false)}>本命</button>
            <button type="button" aria-pressed={isYearly} onClick={() => setYearly(true)}>流年叠盘</button>
          </div>
        </div>
        <div className="ziwei-board" data-yearly={isYearly}>
          <PalaceConnections palace={linkedFrom} links={links} />
          <div className="ziwei-center">
            <div className="ziwei-center-caption">
              <BrandMark size={38} />
              <strong>{chart.bureau}</strong>
              <span>命主 {chart.soul} · 身主 {chart.body}</span>
              <span className="ziwei-center-period">
                {isYearly && <small key={activeYear.year}>{activeYear.year} · {activeYear.stem}{activeYear.branch}年</small>}
              </span>
            </div>
          </div>
          {chart.palaces.map((item) => {
            const isLife = isYearly && item.index === activeYear.lifePalaceIndex;
            const changes = isYearly ? activeYear.transformations.filter((change) => change.palaceIndex === item.index) : [];
            return <div key={item.index} className="ziwei-cell" data-selected={palace.index === item.index}
              data-source={linkedFrom.index === item.index} data-related={linkedTargets.includes(item.index)} data-life={isLife}
              style={{ gridRow: palacePositions[item.index][0], gridColumn: palacePositions[item.index][1] }}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setPreviewed(item.index); }} onPointerLeave={() => setPreviewed(null)}>
              <button type="button" id={chartAnchor("palace-" + item.index)} aria-pressed={palace.index === item.index}
                aria-label={`${palaceLabel(item.name)}，${item.major.map((star) => star.name).join("、") || "无主星"}${isLife ? "，流年命宫" : ""}`}
                onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setPreviewed(item.index); }}
                onBlur={() => setPreviewed(null)}
                onClick={() => onSelect({ palace: item.index })}>
                <span className="ziwei-cell-title"><strong>{palaceLabel(item.name)}</strong>{item.body && <span title="身宫">身</span>}</span>
                <span className="ziwei-cell-stars">
                  {item.major.length ? item.major.map((star) => <span key={star.name} data-active={palace.index === item.index && selectedStar?.name === star.name}>{star.name}{star.mutagen && <sup>{star.mutagen}</sup>}</span>) : <span className="ziwei-empty">无主星</span>}
                </span>
                <span className="ziwei-cell-foot">
                  <span>{item.stem}{item.branch}</span>
                  <span className="ziwei-cell-changes" data-visible={isLife || changes.length > 0} key={isYearly ? activeYear.year : "natal"}>
                    {isLife && <b title="流年命宫">流命</b>}
                    {changes.map(({ type }) => <b key={type} data-transition={type} title={`流年化${type}`}>{type}</b>)}
                  </span>
                </span>
              </button>
            </div>;
          })}
        </div>
        <div className="ziwei-tools">
          <div className="segmented ziwei-layers" aria-label="连线类型">
            {linkModes.map(({ value, label }) => <button type="button" key={value} aria-pressed={links === value} onClick={() => setLinks(value)}>{label}</button>)}
          </div>
          <span>起点 · {palaceLabel(linkedFrom.name)}</span>
        </div>
      </section>

      <aside className="ziwei-detail" aria-labelledby="ziwei-detail-title">
        <div className="ziwei-detail-head" key={palace.index}>
          <p>{palace.stem}{palace.branch}{palace.body ? " · 身宫" : ""}{palace.original ? " · 来因宫" : ""}</p>
          <h2 id="ziwei-detail-title">{name}</h2>
          <p>{meaning}</p>
        </div>
        <div className="ziwei-detail-data">
          <h3>主星</h3>
          {([palace.major, palace.minor] as const).map((group, groupIndex) => (
            <div key={groupIndex}>
              {groupIndex === 1 && <h3>辅星</h3>}
              {group.length ? <div className="ziwei-star-items" data-minor={groupIndex === 1}>{group.map((star, i) => (
                <button type="button" className="ziwei-fact" key={star.name} aria-pressed={selectedStar?.name === star.name}
                  id={chartAnchor(starReference(palace.index, groupIndex === 0 ? i : palace.major.length + i))}
                  onClick={() => onSelect({ palace: palace.index, star: star.name })}>
                  {star.name}{star.brightness && <small>{star.brightness}</small>}{star.mutagen && <b data-transition={star.mutagen}>{star.mutagen}</b>}
                </button>
              ))}</div> : <p className="ziwei-muted">{groupIndex === 0 ? "本宫无主星" : "本宫无辅星"}</p>}
            </div>
          ))}
          <h3>大限</h3>
          <p className="ziwei-muted">{palace.decadal.range[0]}–{palace.decadal.range[1]} 岁 · {palace.decadal.heavenlyStem}{palace.decadal.earthlyBranch}</p>
          <h3>关联宫位</h3>
          <div className="ziwei-star-items">
            {palace.related.map((target) => <button type="button" className="ziwei-fact" key={target} onClick={() => onSelect({ palace: target })}>{palaceLabel(chart.palaces[target].name)}</button>)}
          </div>
          {links !== "relations" && <div><h3>宫干飞化</h3><div className="ziwei-star-items">
            {palace.flies.map(({ type, target }) => <button type="button" className="ziwei-fact" key={type} data-transition={type} onClick={() => onSelect({ palace: target })}>化{type} · {palaceLabel(chart.palaces[target].name)}</button>)}
          </div></div>}
          {isYearly && <div className="ziwei-detail-annual">
            <h3>{activeYear.year} 年叠盘</h3>
            <p className="ziwei-muted" key={activeYear.year}>对应{palaceLabel(activeYear.palaceNames[palace.index])}</p>
            {yearTransformations.length > 0 && <p>{yearTransformations.map(({ star, type }) => star + "化" + type).join("、")}</p>}
          </div>}
        </div>
        <Button className="ziwei-ask" onClick={askAboutSelection}><Sparkles size={16} />{selectedStar ? `追问${selectedStar.name}` : "追问此宫"}</Button>
        <a className="ziwei-report-link" href="#reading">查看 AI 深度解读 <ArrowDown size={15} /></a>
      </aside>
      <section className="ziwei-year" aria-labelledby="ziwei-year-heading" aria-busy={changingYear}>
        <div className="ziwei-year-head">
          <h3 id="ziwei-year-heading"><CalendarDays size={17} />流年</h3>
          <div className="ziwei-year-controls">
            <button type="button" className="icon-button" aria-label="上一年" disabled={busy || activeYear.year <= earliestYear} onClick={() => onYear(activeYear.year - 1)}><ChevronLeft size={17} /></button>
            <div className="select-wrap">
              <select aria-label="流年年份" value={activeYear.year} disabled={busy} aria-invalid={!!yearError}
                aria-describedby={yearError ? "ziwei-year-error" : undefined}
                onChange={(event) => onYear(Number(event.currentTarget.value))}>
                {yearChoices.map((year) => <option key={year} value={year}>{year} 年</option>)}
              </select><ChevronDown size={14} />
            </div>
            <button type="button" className="icon-button" aria-label="下一年" disabled={busy || activeYear.year >= years.max} onClick={() => onYear(activeYear.year + 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
        {yearError && <p id="ziwei-year-error" className="form-error" role="alert">{yearError}</p>}
        <div className="ziwei-year-status" aria-live="polite">
          {changingYear ? <><LoaderCircle size={15} className="ziwei-spinner" />正在排流年</> :
            <span key={activeYear.year}>{activeYear.year} 年 · {activeYear.stem}{activeYear.branch}</span>}
        </div>
        <div className="ziwei-year-links">
          <button type="button" id={chartAnchor("annual")} className="ziwei-fact" onClick={() => onLocateAnnual(lifePalace.index)}>流年命宫 · {palaceLabel(lifePalace.name)}</button>
          {activeYear.transformations.map(({ palaceIndex, star, type }, index) => (
            <button type="button" key={type} id={chartAnchor("annual-transformation-" + index)} data-transition={type} className="ziwei-fact"
              aria-label={`${star}化${type}，在${palaceLabel(chart.palaces[palaceIndex].name)}`}
              onClick={() => onLocateAnnual(palaceIndex, star)}>{star}化{type}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
