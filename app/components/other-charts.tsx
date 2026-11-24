"use client";

import { Compass, GitCompareArrows, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ZiweiChart } from "@/lib/calendar";
import { linePositions, lineTypes, type CastChart } from "@/lib/iching";
import type { Focus } from "@/lib/panels";
import { Calibration } from "./bazi";
import { BrandMark } from "./instrument";

const palacePositions = [[4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2]];
const palaceMeaning: Record<string, string> = {
  命宫: "传统上作为观察整体处事方式的起点。", 兄弟: "用于反思同辈关系与协作方式。", 夫妻: "用于反思亲密关系中的期待、界限与沟通。",
  子女: "用于反思照料、创造与代际互动。", 财帛: "用于反思资源分配、金钱习惯与风险偏好。", 疾厄: "在传统上关联身心负荷，可用于反思日常休息与照顾自己的习惯。",
  迁移: "用于反思身处陌生环境时的适应方式。", 仆役: "也称交友宫，常用于观察社交、团队与合作网络。", 官禄: "用于反思职业角色、责任与工作方式。",
  田宅: "用于反思居住、安全感与对空间的需求。", 福德: "用于反思休息、内在满足与压力下的应对方式。", 父母: "用于反思家庭经验与权威关系对自己的影响。",
};

function PalaceConnections({ chart, active }: { chart: ZiweiChart; active: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const draw = () => {
      const context = node.getContext("2d");
      if (!context) return;
      const size = node.getBoundingClientRect();
      const ratio = devicePixelRatio || 1;
      node.width = size.width * ratio;
      node.height = size.height * ratio;
      context.scale(node.width / 400, node.height / 400);
      const colors = getComputedStyle(node);
      const source = chart.palaces[active];
      const [row, col] = palacePositions[active];
      const x = (col - 0.5) * 100, y = (row - 0.5) * 100;
      function curve(to: number, color: string, offset: number, dashed: boolean) {
        const [endRow, endCol] = palacePositions[to];
        const endX = (endCol - 0.5) * 100, endY = (endRow - 0.5) * 100;
        context!.beginPath();
        context!.setLineDash(dashed ? [4, 5] : []);
        context!.strokeStyle = color;
        context!.shadowBlur = dashed ? 0 : 11;
        context!.shadowColor = color;
        context!.lineWidth = dashed ? 1 : 1.55;
        context!.moveTo(x, y);
        context!.bezierCurveTo(200 + offset, 150 + offset, 200 - offset, 250 + offset, endX, endY);
        context!.stroke();
      }
      source.related.forEach((index) => curve(index, colors.getPropertyValue("--palace-link").trim(), 0, true));
      const go = ["--wood", "--fire", "--accent", "--water"];
      source.flies.forEach(({ target }, i) => curve(target, colors.getPropertyValue(go[i]).trim(), (i - 1.5) * 24, false));
    };
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [chart, active]);

  return <canvas className="palace-connections" ref={canvas} aria-hidden="true" />;
}

export function Ziwei({ chart, example, inspect }: { chart: ZiweiChart; example: boolean; inspect: (focus: Focus) => void }) {
  const initial = chart.palaces.find((item) => item.name === "命宫")?.index ?? 0;
  const [selected, setSelected] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  const palace = chart.palaces[active];

  function inspectPalace(item: ZiweiChart["palaces"][number]) {
    setSelected(item.index);
    inspect({ kind: "palace", id: String(item.index), label: item.name === "命宫" ? item.name : item.name + "宫",
      detail: `${item.stem}${item.branch} · ${item.major.map((star) => star.name + (star.mutagen ? "化" + star.mutagen : "")).join("、") || "无主星"}${item.body ? " · 身宫" : ""}`,
      description: palaceMeaning[item.name] ?? "传统紫微斗数的十二种生活领域之一。" });
  }

  return (
    <section className="panel chart-panel" aria-labelledby="ziwei-heading">
      <div className="panel-head"><div className="head-group"><span className="head-icon"><Compass size={18} /></span><h2 id="ziwei-heading">紫微十二宫</h2></div>
        <span className="chart-state" data-example={example}><span />{example ? "示例命盘" : "已排盘"}</span></div>
      <div className="chart-body">
        <div className="chart-meta"><span>{chart.birth.name} · {chart.birth.lunar}</span><Calibration birth={chart.birth} /></div>
        <div className="palace-grid">
          <PalaceConnections chart={chart} active={active} />
          <div className="palace-hub">
            <BrandMark size={48} /><strong>{chart.bureau}</strong>
            <span>命主 {chart.soul} · 身主 {chart.body}</span>
            <span>{chart.year.year} 流年 · {chart.year.stem}{chart.year.branch}{chart.year.palace ? " · " + chart.year.palace : ""}</span>
          </div>
          {chart.palaces.map((item) => (
            <div className="palace" key={item.index} data-active={active === item.index} data-related={palace.related.includes(item.index)}
              style={{ gridRow: palacePositions[item.index][0], gridColumn: palacePositions[item.index][1] }}
              onPointerEnter={() => setHovered(item.index)} onPointerLeave={() => setHovered(null)}>
              <button type="button" className="palace-name" aria-pressed={selected === item.index} onFocus={() => setHovered(item.index)} onBlur={() => setHovered(null)} onClick={() => inspectPalace(item)}>
                {item.name}{item.body && <span aria-label="身宫">身</span>}
              </button>
              <div className="palace-stars">
                {item.major.length ? item.major.map((star) => <button type="button" key={star.name}
                  onClick={() => { setSelected(item.index); inspect({ kind: "star", id: item.index + ":" + star.name, label: star.name + (star.mutagen ? "化" + star.mutagen : ""), detail: `${item.name} · ${item.stem}${item.branch}${star.brightness ? " · " + star.brightness : ""}`,
                    description: "紫微斗数主星的含义需结合所在宫位、同宫星曜和三方四正理解。" }); }}>
                  {star.name}{star.mutagen && <sup>{star.mutagen}</sup>}
                </button>) : <span>无主星</span>}
              </div>
              <small>{item.stem}{item.branch}</small>
            </div>
          ))}
        </div>
        <div className="palace-legend">
          <span><i />三方四正</span>
          {palace.flies.map(({ target, type }) => <button key={type} type="button" data-transition={type} onClick={() => inspectPalace(chart.palaces[target])}>{type} → {chart.palaces[target].name}</button>)}
        </div>
      </div>
    </section>
  );
}

export function IChing({ chart, example, inspect }: { chart: CastChart; example: boolean; inspect: (focus: Focus) => void }) {
  const [view, setView] = useState<"original" | "changed" | "both">("original");
  const visible = view === "both" ? (["original", "changed"] as const) : [view];

  return (
    <section className="panel chart-panel" aria-labelledby="iching-heading">
      <div className="panel-head"><div className="head-group"><span className="head-icon"><Waves size={18} /></span><h2 id="iching-heading">卦象解析</h2></div>
        <span className="chart-state" data-example={example}><span />{example ? "示例卦象" : "已成卦"}</span></div>
      <div className="chart-body">
        <div className="hexagram-header">
          <p>{chart.question}</p>
          <div className="segmented compact" aria-label="卦象视图">
            <button type="button" aria-pressed={view === "original"} onClick={() => setView("original")}>本卦</button>
            <button type="button" aria-pressed={view === "changed"} onClick={() => setView("changed")}>变卦</button>
            <button type="button" aria-pressed={view === "both"} onClick={() => setView("both")}><GitCompareArrows size={13} />对照</button>
          </div>
        </div>
        <div className="hexagram-grid" data-compare={view === "both"}>
          {visible.map((key) => {
            const hexagram = chart[key];
            return <div className="hexagram" key={key}>
              <div className="hexagram-title">
                <button type="button" onClick={() => inspect({ kind: "hexagram", id: key, label: `${hexagram.name}卦`, detail: `第 ${hexagram.number} 卦 · ${hexagram.upper.image}${hexagram.lower.image}`,
                  description: `上卦${hexagram.upper.name}（${hexagram.upper.meaning}），下卦${hexagram.lower.name}（${hexagram.lower.meaning}）。` })}>
                  <span>{key === "original" ? "本卦" : "变卦"}</span><strong>{hexagram.name}</strong>
                </button>
                <p>{hexagram.upper.name}上 · {hexagram.lower.name}下</p>
              </div>
              <div className="hexagram-lines">
                {[5, 4, 3, 2, 1, 0].map((i) => <button type="button" key={i} data-yang={hexagram.bits[i]} data-moving={chart.moving.includes(i)}
                  className="hexagram-line"
                  aria-label={`${linePositions[i]} ${hexagram.bits[i] ? "阳" : "阴"}爻${chart.moving.includes(i) ? " 动爻" : ""}`}
                  onClick={() => inspect({
                    kind: "line", id: String(i), label: `${linePositions[i]} · ${lineTypes[chart.lines[i]]}`,
                    detail: `${chart.lines[i]} · ${chart.moving.includes(i) ? "动爻" : "静爻"}`,
                    description: chart.moving.includes(i) ? "动爻在变卦中阴阳反转。可用作观察当前处境里哪些条件可能变化的提示。" : "静爻在本卦和变卦中阴阳相同。可用来反思暂时保持稳定的条件。",
                  })}><small>{linePositions[i]}</small><span className="yao"><i /><i /></span><b aria-hidden="true">{chart.moving.includes(i) ? chart.lines[i] === 9 ? "○" : "×" : ""}</b></button>)}
              </div>
            </div>;
          })}
        </div>
        <p className="chart-note">{chart.moving.length ? `${chart.moving.map((index) => linePositions[index]).join("、")}为动爻。点击爻线查看释义。` : "六爻皆静，本卦与变卦相同。"}</p>
      </div>
    </section>
  );
}
