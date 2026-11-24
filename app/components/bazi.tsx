"use client";

import { Activity, BarChart3, Binary, CircleHelp, Crosshair, GitCommitHorizontal, Layers3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { init, use as registerCharts, type ComposeOption, type EChartsType } from "echarts/core";
import { LineChart, RadarChart, type LineSeriesOption, type RadarSeriesOption } from "echarts/charts";
import { GridComponent, RadarComponent, TooltipComponent, type GridComponentOption, type RadarComponentOption, type TooltipComponentOption } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { BaziChart, Element } from "@/lib/calendar";
import { chartAnchor } from "@/lib/chart-references";
import type { Focus } from "@/lib/panels";

registerCharts([LineChart, RadarChart, GridComponent, RadarComponent, TooltipComponent, SVGRenderer]);
type ChartOptions = ComposeOption<LineSeriesOption | RadarSeriesOption | GridComponentOption | RadarComponentOption | TooltipComponentOption>;
type ChartColors = { gold: string; muted: string; rule: string; fill: string };

const elements: Element[] = ["木", "火", "土", "金", "水"];
const elementNotes: Record<Element, string> = {
  木: "传统意象关联生长、计划与拓展。", 火: "传统意象关联表达、行动与热度。", 土: "传统意象关联承接、稳定与边界。",
  金: "传统意象关联归整、原则与判断。", 水: "传统意象关联流动、观察与适应。",
};
const pillarNotes = ["常用于观察成长背景与外在环境。", "以节气划分，常用于观察环境需求与处事节奏。", "日干是日主，也是确定十神相对关系的基准。", "常用于观察长期目标、产出与后续行动方式。"];

type ChartSelection = { dataIndex?: number; name?: string };

function useChart(makeOptions: (colors: ChartColors) => ChartOptions, onSelect: (event: ChartSelection) => void) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const node = host.current;
    const chart = init(node, undefined, { renderer: "svg" });
    instance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node);
    return () => { observer.disconnect(); chart.dispose(); instance.current = null; };
  }, []);

  useEffect(() => {
    const chart = instance.current;
    if (!chart || !host.current) return;
    const css = getComputedStyle(host.current);
    const read = (property: string) => css.getPropertyValue(property).trim();
    chart.setOption({
      ...makeOptions({ gold: read("--accent"), muted: read("--muted"), rule: read("--line-strong"), fill: read("--chart-fill") }),
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    }, { notMerge: true });
    chart.on("click", onSelect);
    return () => { if (!chart.isDisposed()) chart.off("click", onSelect); };
  }, [makeOptions, onSelect]);

  return host;
}

function Radar({ weights, onSelect }: { weights: BaziChart["weights"]; onSelect: (element: Element) => void }) {
  const options = useCallback(({ gold, rule, muted, fill }: ChartColors): ChartOptions => {
    const limit = Math.max(40, Math.ceil(Math.max(...weights.map((item) => item.percent)) / 10) * 10);
    return {
      radar: {
        radius: "68%", center: ["50%", "53%"], splitNumber: 4,
        indicator: weights.map(({ element }) => ({ name: element, max: limit })),
        axisName: { color: muted, fontSize: 14 }, axisNameGap: 9, triggerEvent: true,
        splitLine: { lineStyle: { color: rule } }, axisLine: { lineStyle: { color: rule } },
        splitArea: { show: false },
      },
      series: [{
        type: "radar", symbol: "circle", symbolSize: 7, itemStyle: { color: gold },
        lineStyle: { color: gold, width: 1.7 }, areaStyle: { color: fill },
        data: [{ value: weights.map((item) => item.percent) }], silent: true,
      }],
    };
  }, [weights]);
  const pick = useCallback(({ name }: ChartSelection) => {
    const match = elements.find((element) => element === name);
    if (match) onSelect(match);
  }, [onSelect]);
  const graph = useChart(options, pick);
  return <div ref={graph} className="radar" role="img" aria-label={weights.map(({ element, percent }) => `${element} ${percent}%`).join("，")} />;
}

const points = elements.map((_, i) => {
  const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
  return { x: 110 + 73 * Math.cos(angle), y: 100 + 73 * Math.sin(angle) };
});

function Flow({ onSelect }: { onSelect: (element: Element) => void }) {
  const between = (from: number, offset: number) => {
    const a = points[from], b = points[(from + offset) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / length * 16, dy = (b.y - a.y) / length * 16;
    return `M ${a.x + dx},${a.y + dy} L ${b.x - dx},${b.y - dy}`;
  };
  return (
    <svg viewBox="0 0 220 200" className="radar flow" aria-label="五行相生相克图">
      <defs>
        <marker id="grow-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" /></marker>
        <marker id="check-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" /></marker>
      </defs>
      <circle cx="110" cy="100" r="87" className="flow-ring" />
      {points.map(({ x, y }, i) => (
        <g key={elements[i]}>
          <path d={between(i, 2)} className="flow-check" markerEnd="url(#check-arrow)" />
          <path d={between(i, 1)} className="flow-grow" markerEnd="url(#grow-arrow)" />
          <g className="flow-node" data-element={elements[i]} role="button" tabIndex={0} aria-label={elements[i]} onClick={() => onSelect(elements[i])}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(elements[i]); } }}>
            <circle cx={x} cy={y} r="13" /><text x={x} y={y + 4} textAnchor="middle">{elements[i]}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}

export function Calibration({ birth }: { birth: BaziChart["birth"] }) {
  const { latitude, longitude, solar, correction } = birth;
  const coordinates = [
    longitude === undefined ? null : `${longitude < 0 ? "西经" : "东经"} ${Math.abs(longitude)}°`,
    latitude === undefined ? null : `${latitude < 0 ? "南纬" : "北纬"} ${Math.abs(latitude)}°`,
  ].filter(Boolean).join(" · ");
  return (
    <details className="calibration">
      <summary>
        <Crosshair size={14} /><span>{solar === null ? "当地时间" : "真太阳时"}</span><strong>{(solar ?? birth.civil).slice(11, 16)}</strong>
        <span className="calibration-offset">{correction === null ? "未填经度" : `${correction >= 0 ? "+" : ""}${correction} 分钟`}</span>
      </summary>
      <dl>
        <div><dt>出生钟表时间</dt><dd>{birth.civil}</dd></div>
        <div><dt>出生地</dt><dd>{birth.name}</dd></div>
        {coordinates && <div><dt>经纬度</dt><dd>{coordinates}</dd></div>}
        <div><dt>时区</dt><dd>{birth.timeZone}</dd></div>
        <div><dt>排盘时间</dt><dd>{solar ?? "采用当地钟表时间"}</dd></div>
        {birth.approximate && <div><dt>推定时段</dt><dd>{birth.approximate} · 使用代表时间</dd></div>}
        {birth.ambiguous && <div><dt>夏令时</dt><dd>重复的时间取较早时刻</dd></div>}
      </dl>
    </details>
  );
}

export function Bazi({ chart, example, inspect }: { chart: BaziChart; example: boolean; inspect: (focus: Focus) => void }) {
  const [view, setView] = useState<"radar" | "flow">("radar");
  const dominant = chart.weights.reduce((left, right) => left.percent >= right.percent ? left : right);

  const inspectElement = useCallback((element: Element) => {
    const value = chart.weights.find((item) => item.element === element)!;
    const at = elements.indexOf(element);
    inspect({ kind: "element", id: element, label: `五行 · ${element}`, detail: `${value.percent}% · 生${elements[(at + 1) % 5]} · 克${elements[(at + 2) % 5]}`,
      description: elementNotes[element] + " 占比依天干、藏干与月令权重计算。" });
  }, [chart.weights, inspect]);

  return (
    <section className="panel chart-panel" aria-labelledby="bazi-heading">
      <div className="panel-head">
        <div className="head-group"><span className="head-icon"><Layers3 size={18} /></span><h2 id="bazi-heading">四柱命盘</h2></div>
        <span className="chart-state" data-example={example}><span />{example ? "示例命盘" : "已排盘"}</span>
      </div>
      <div className="chart-body">
        <div className="chart-meta"><span>{chart.birth.name} · {chart.birth.lunar}</span><Calibration birth={chart.birth} /></div>
        <div className="pillars">
          {chart.pillars.map((pillar, i) => (
            <button type="button" className="pillar" key={pillar.name} data-master={i === 2} id={chartAnchor("pillar-" + i)}
              aria-label={`${pillar.name} ${pillar.stem}${pillar.branch} ${pillar.relationship}，查看释义`}
              onClick={() => inspect({
                kind: "pillar", id: pillar.name, label: `${pillar.name} · ${pillar.stem}${pillar.branch}`,
                detail: `${pillar.relationship} · ${pillar.naYin}　藏干 ${pillar.hidden.map((value, index) => value + " " + pillar.hiddenGods[index]).join("、")}`,
                description: pillarNotes[i],
              })}>
              <span className="pillar-title">{pillar.name}{i === 2 && <span className="master-dot" />}</span>
              <span className="pillar-glyph" data-element={pillar.stemElement}>{pillar.stem}</span>
              <span className="pillar-glyph" data-element={pillar.branchElement}>{pillar.branch}</span>
              <span className="pillar-role">{pillar.relationship}</span>
            </button>
          ))}
        </div>
        <div className="energy-head">
          <div className="head-group"><Activity size={17} /><h3>五行能量</h3></div>
          <div className="segmented compact" aria-label="五行视图">
            <button type="button" aria-pressed={view === "radar"} onClick={() => setView("radar")}><BarChart3 size={13} />占比</button>
            <button type="button" aria-pressed={view === "flow"} onClick={() => setView("flow")}><GitCommitHorizontal size={13} />流通</button>
          </div>
        </div>
        <div className="energy-grid">
          <div className="radar-wrap">{view === "radar" ? <Radar weights={chart.weights} onSelect={inspectElement} /> : <Flow onSelect={inspectElement} />}</div>
          <div className="energy-legend">
            {chart.weights.map(({ element, percent }, index) => (
              <button key={element} id={chartAnchor("element-" + index)} type="button" className="element-row" data-element={element} onClick={() => inspectElement(element)} aria-label={element + " " + percent + "%，查看五行释义"}>
                <span className="element-name"><i />{element}</span>
                <span className="meter" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                <span className="percent">{percent}<small>%</small></span>
              </button>
            ))}
          </div>
        </div>
        <p className="chart-note">{view === "radar" ? <><CircleHelp size={13} /><span>{dominant.element}占比最高 · 可点击四柱或五行查看释义</span></> : <><Binary size={13} /><span>金色为相生方向，灰色为相克方向</span></>}</p>
      </div>
    </section>
  );
}

export function Trends({ chart, inspect }: { chart: BaziChart; inspect: (item: Focus) => void }) {
  const selected = chart.annual[0]?.year;
  const current = chart.periods.findIndex((item) => item.startYear <= selected && item.endYear >= selected);
  const [period, setPeriod] = useState(current >= 0 ? current : 0);
  const keyYears = chart.annual;

  const inspectPeriod = useCallback((i: number) => {
    const item = chart.periods[i];
    if (!item) return;
    setPeriod(i);
    inspect({ kind: "period", id: String(item.startYear), label: `${item.ganZhi}大运`, detail: `${item.startYear}–${item.endYear} · 约 ${item.age} 岁起 · 活跃度 ${item.activity}`,
      description: "每步大运为十年。图示活跃度以本命盘中这一柱干支对应的五行占比计算。" });
  }, [chart.periods, inspect]);

  const options = useCallback(({ gold, muted, rule, fill }: ChartColors): ChartOptions => ({
    grid: { top: 14, left: 29, right: 17, bottom: 26 },
    xAxis: { type: "category", data: chart.periods.map((item) => `${item.age}岁`),
      axisLabel: { color: muted, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: rule } } },
    yAxis: { min: 0, max: 100, interval: 25, axisLabel: { color: muted, fontSize: 10 }, splitLine: { lineStyle: { color: rule, type: "dashed" } } },
    series: [{
      type: "line", data: chart.periods.map((item, index) => ({ value: item.activity, symbolSize: index === period ? 11 : 6 })),
      smooth: 0.3, symbol: "circle", showSymbol: true, lineStyle: { color: gold, width: 2 },
      itemStyle: { color: gold }, areaStyle: { color: fill, opacity: 0.55 },
    }],
  }), [chart.periods, period]);
  const pick = useCallback(({ dataIndex }: ChartSelection) => {
    if (typeof dataIndex === "number") inspectPeriod(dataIndex);
  }, [inspectPeriod]);
  const line = useChart(options, pick);

  const active = chart.periods[period];

  return (
    <section className="panel trend-panel" aria-labelledby="trends-heading">
      <div className="panel-head"><div className="head-group"><span className="head-icon"><Activity size={18} /></span><h2 id="trends-heading">百年大运</h2></div>
        <span className="chart-state">{chart.forward ? "顺排" : "逆排"} · {chart.start} 起运</span></div>
      <div className="chart-body">
        <div className="trend-copy"><span>五行活跃度</span><span>{active.ganZhi} · {active.startYear}–{active.endYear} · {active.activity}</span></div>
        <div ref={line} className="trend-chart" role="img" aria-label="每十年一运的五行活跃度曲线" />
        <div className="period-grid" aria-label="大运节点">
          {chart.periods.map((item, index) => <button key={item.startYear} id={chartAnchor("period-" + item.startYear)} type="button" aria-pressed={period === index} onClick={() => inspectPeriod(index)} title={`${item.startYear}–${item.endYear}`}>{item.ganZhi}</button>)}
        </div>
        <div className="year-grid" aria-label="关键流年">
          {keyYears.map((item) => (
            <button type="button" key={item.year} id={chartAnchor("year-" + item.year)} onClick={() => inspect({ kind: "year", id: String(item.year), label: `${item.year} · ${item.ganZhi}流年`,
              detail: `活跃度 ${item.activity}${item.period ? " · " + item.period + "大运" : ""}`, description: "流年天干地支以立春为界。活跃度描述盘内的五行对应关系。" })}>
              <strong>{item.year}</strong><span>{item.ganZhi}流年</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
