"use client";

import { GitCompareArrows, Waves } from "lucide-react";
import { chartAnchor } from "@/lib/chart-references";
import { linePositions, lineTypes, type CastChart } from "@/lib/iching";
import type { Focus } from "@/lib/panels";

export type HexagramView = "original" | "changed" | "both";

export function IChing({ chart, example, inspect, view, setView }: {
  chart: CastChart; example: boolean; inspect: (focus: Focus) => void; view: HexagramView; setView: (view: HexagramView) => void;
}) {
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
                <button type="button" id={chartAnchor("hexagram-" + key)} onClick={() => inspect({ kind: "hexagram", id: key, label: `${hexagram.name}卦`, detail: `第 ${hexagram.number} 卦 · ${hexagram.upper.image}${hexagram.lower.image}`,
                  description: `上卦${hexagram.upper.name}（${hexagram.upper.meaning}），下卦${hexagram.lower.name}（${hexagram.lower.meaning}）。` })}>
                  <span>{key === "original" ? "本卦" : "变卦"}</span><strong>{hexagram.name}</strong>
                </button>
                <p>{hexagram.upper.name}上 · {hexagram.lower.name}下</p>
              </div>
              <div className="hexagram-lines">
                {[5, 4, 3, 2, 1, 0].map((i) => <button type="button" key={i} data-yang={hexagram.bits[i]} data-moving={chart.moving.includes(i)}
                  className="hexagram-line" id={key === "original" || view !== "both" ? chartAnchor("line-" + i) : undefined}
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
