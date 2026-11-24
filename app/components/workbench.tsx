"use client";

import { BookOpen, ChevronDown, Compass, Dices, Layers3, Pencil, ScanLine, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chartAnchor, chartReferences, type ChartReference } from "@/lib/chart-references";
import { exampleBirth } from "@/lib/example";
import type { ChartResult, ChartSession, Focus } from "@/lib/panels";
import { modules, type BirthInput, type CastInput, type Module, type ReadingInput } from "@/lib/schema";
import { Bazi, Calibration, Trends } from "./bazi";
import { BirthForm, type BirthFormHandle } from "./birth-form";
import { CastForm } from "./cast-form";
import { BrandMark, Instrument } from "./instrument";
import { IChing, type HexagramView } from "./other-charts";
import { Copilot, readEvents, Reading, type ReportState } from "./readings";
import { Button } from "./ui/button";
import { Ziwei, type PalaceSelection } from "./ziwei";

const views = {
  bazi: { nav: "八字", title: "八字命盘", icon: Layers3, description: "从出生的四组干支出发，观察五行分布与人生节奏。" },
  ziwei: { nav: "紫微斗数", title: "紫微斗数", icon: Compass, description: "在十二宫里查看星曜、三方四正与四化流向。" },
  iching: { nav: "周易六爻", title: "周易六爻", icon: Dices, description: "一次问一件事，用六爻卦象梳理眼前的选择。" },
};

const idle: ReportState = { status: "idle" };

function Method({ module }: { module: Module }) {
  return (
    <details className="panel method">
      <summary><BookOpen size={16} /><strong>{module === "iching" ? "起卦方法" : "排盘方法"}</strong><ChevronDown size={16} /></summary>
      {module === "bazi" && <p>年、月柱按节气交接时刻计算。填入经度后，日、时柱采用出生地真太阳时，否则采用当地钟表时间。晚子时的日柱沿用当天，时干按子初推算。五行占比将月支藏干加倍，其余权重按藏干主次分配。</p>}
      {module === "ziwei" && <p>填写经度时按出生地真太阳时起盘，否则采用当地钟表时间。农历正月换年，晚子时保留当天日期。闰月前半按本月、后半按下月排布。选择宫位可以查看三方四正和四化飞向。</p>}
      {module === "iching" && <p>每次投三枚铜钱，正反面分别记为 3 和 2。六次由下往上成卦，得数为 6 或 9 的爻会翻转，组成变卦。</p>}
    </details>
  );
}

export function Workbench({ specimens, timeZones, year }: { specimens: Record<Module, ChartSession>; timeZones: string[]; year: number }) {
  const [module, setModule] = useState<Module>("bazi");
  const [sessions, setSessions] = useState(specimens);
  const [revisions, setRevisions] = useState<Record<Module, number>>({ bazi: 0, ziwei: 0, iching: 0 });
  const [pending, setPending] = useState<Partial<Record<Module, boolean>>>({});
  const [reads, setReads] = useState<Partial<Record<Module, ReportState>>>({});
  const [copilot, setCopilot] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [origin, setOrigin] = useState<HTMLElement | null>(null);
  const [editingZiwei, setEditingZiwei] = useState(false);
  const [ziweiSelection, setZiweiSelection] = useState<PalaceSelection | null>(null);
  const [ziweiYearly, setZiweiYearly] = useState(false);
  const [changingYear, setChangingYear] = useState(false);
  const [yearError, setYearError] = useState("");
  const [hexagramView, setHexagramView] = useState<HexagramView>("original");
  const [jump, setJump] = useState<{ id: string } | null>(null);
  const chartRequests = useRef<Partial<Record<Module, AbortController>>>({});
  const reportRequests = useRef<Partial<Record<Module, AbortController>>>({});
  const output = useRef<HTMLDivElement>(null);
  const birthEditor = useRef<BirthFormHandle>(null);

  useEffect(() => {
    const charts = chartRequests.current;
    const reports = reportRequests.current;
    return () => {
      Object.values(charts).forEach((item) => item.abort());
      Object.values(reports).forEach((item) => item.abort());
    };
  }, []);

  const session = sessions[module];
  const { result, example } = session;
  const view = views[module];
  const isZiwei = result.module === "ziwei";

  useEffect(() => {
    if (!jump) return;
    const target = document.getElementById(jump.id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [jump]);

  function choose(next: Module) {
    setModule(next);
    setFocus(null);
    setCopilot(false);
  }

  const inspect = useCallback((item: Focus | null = null) => {
    setOrigin(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setFocus(item);
    setCopilot(true);
  }, []);

  function locateAnnualPalace(palace: number, star?: string) {
    setZiweiYearly(true);
    setZiweiSelection({ palace, star });
    setJump({ id: chartAnchor("palace-" + palace) });
  }

  function revealEvidence(reference: ChartReference) {
    const { id } = reference;
    if (reference.kind === "annual" || reference.kind === "annual-transformation") {
      locateAnnualPalace(reference.palace, "star" in reference ? reference.star : undefined);
      return;
    }
    if ("palace" in reference) {
      setZiweiSelection({ palace: reference.palace, star: "star" in reference ? reference.star : undefined });
    }
    if (reference.kind === "hexagram") setHexagramView(id === "hexagram-changed" ? "changed" : "original");
    if (reference.kind === "line") setHexagramView("original");
    setJump({ id: chartAnchor(id) });
  }

  async function requestReport(input: ReadingInput, jump = false) {
    const name = input.module;
    reportRequests.current[name]?.abort();
    const controller = new AbortController();
    reportRequests.current[name] = controller;
    setReads((previous) => ({ ...previous, [name]: { status: "loading" } }));
    if (jump) document.getElementById("reading")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    try {
      await readEvents({ mode: "report", input }, controller.signal, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === "partial") {
          setReads((previous) => ({ ...previous, [name]: { status: "loading", report: event.report } }));
        }
        if (event.type === "done") {
          setReads((previous) => ({ ...previous, [name]: { status: "done", report: event.report } }));
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setReads((previous) => ({ ...previous, [name]: { status: "error", error: error instanceof Error ? error.message : "解读失败，请重试。" } }));
      }
    }
  }

  async function generate(input: ReadingInput, withAI: boolean, forYear = false) {
    const name = input.module;
    chartRequests.current[name]?.abort();
    const controller = new AbortController();
    chartRequests.current[name] = controller;
    setPending((previous) => ({ ...previous, [name]: true }));
    try {
      const response = await fetch("/api/chart", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: controller.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "生成失败，请重试。");
      const data: ChartResult = await response.json();
      if (controller.signal.aborted) return;
      const updated = input.module === "ziwei" && data.module === "ziwei" ? { ...input, viewYear: data.chart.year.year } : input;
      reportRequests.current[name]?.abort();
      setReads((previous) => ({ ...previous, [name]: idle }));
      setSessions((previous) => ({ ...previous, [name]: { input: updated, result: data, example: forYear && previous[name].example } }));
      if (forYear) {
        setZiweiYearly(true);
      } else {
        setRevisions((previous) => ({ ...previous, [name]: previous[name] + 1 }));
        if (name === "ziwei") {
          setEditingZiwei(false);
          setZiweiSelection(null);
          setZiweiYearly(false);
          setYearError("");
          if (output.current?.dataset.module === name) setJump({ id: "ziwei-title" });
        } else if (output.current?.dataset.module === name && matchMedia("(max-width: 860px)").matches) {
          output.current.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }
        if (name === "iching") setHexagramView("original");
      }
      if (withAI) void requestReport(updated);
    } finally {
      if (!controller.signal.aborted) setPending((previous) => ({ ...previous, [name]: false }));
    }
  }

  async function changeZiweiYear(value: number) {
    const input = sessions.ziwei.input;
    if (input.module !== "ziwei" || pending.ziwei) return;
    setYearError("");
    setChangingYear(true);
    try {
      await generate({ ...input, viewYear: value }, false, true);
    } catch (error) {
      setYearError(error instanceof Error ? error.message : "无法排出该流年，请重试。");
    } finally {
      setChangingYear(false);
    }
  }

  function resetCast() {
    reportRequests.current.iching?.abort();
    setSessions((previous) => ({ ...previous, iching: specimens.iching }));
    setRevisions((previous) => ({ ...previous, iching: previous.iching + 1 }));
    setReads((previous) => ({ ...previous, iching: idle }));
    setHexagramView("original");
  }

  const birthModule = module === "ziwei" ? "ziwei" : "bazi";
  const revision = revisions[module];

  return (
    <>
      <header className="topbar">
        <div className="shell header-inner">
          <a className="brand" href="#top" onClick={() => choose("bazi")} aria-label="玄机 AI 首页">
            <BrandMark /><span><strong>玄机 <i>AI</i></strong><small>ASTROLABE AI</small></span>
          </a>
          <nav className="main-nav" aria-label="排盘工具">
            {modules.map((name) => {
              const item = views[name];
              const Icon = item.icon;
              return <button type="button" key={name} aria-current={name === module ? "page" : undefined} onClick={() => choose(name)}><Icon size={16} /><span>{item.nav}</span></button>;
            })}
          </nav>
          <Button className="top-ask" onClick={() => inspect()}><Sparkles size={15} /><span>AI 顾问</span></Button>
        </div>
      </header>
      <main className="shell main" id="top">
        {isZiwei ? <section className="ziwei-overview" aria-labelledby="ziwei-title">
          <div>
            <h1 id="ziwei-title" tabIndex={-1}>紫微命盘</h1>
            <p><span className="ziwei-overview-state">{example ? "示例命盘" : "出生资料"}</span>
              <span>{result.chart.birth.civil} · {result.chart.birth.name}</span></p>
          </div>
          <div className="ziwei-overview-controls">
            <Calibration birth={result.chart.birth} />
            <Button aria-expanded={editingZiwei} aria-controls="birth-editor" onClick={() => {
              if (!editingZiwei && !example && session.input.module === "ziwei") birthEditor.current?.load(session.input.birth);
              setEditingZiwei(!editingZiwei);
            }}>
              <Pencil size={15} />{editingZiwei ? "收起表单" : example ? "填写生辰" : "编辑生辰"}
            </Button>
          </div>
        </section> : <div className="hero">
          <div className="hero-copy">
            <p className="hero-kicker"><ScanLine size={14} />东方命理工作台</p>
            <h1>{view.title}</h1>
            <p className="hero-description">{view.description}</p>
          </div>
          <Instrument />
          <span className="hero-rule" aria-hidden="true" />
        </div>}
        <div className={isZiwei ? "workbench ziwei-workbench" : "workbench"}>
          <aside id="birth-editor" hidden={isZiwei && !editingZiwei} className="input-column" aria-label="排盘输入">
            <div hidden={module === "iching"}><BirthForm ref={birthEditor} module={birthModule} busy={!!pending[birthModule]} timeZones={timeZones} year={year} onGenerate={(birth: BirthInput, withAI) => generate({ module: birthModule, birth }, withAI)} /></div>
            <div hidden={module !== "iching"}><CastForm pending={!!pending.iching} onComplete={(cast: CastInput) => generate({ module: "iching", cast }, false)} onReset={resetCast} /></div>
            <Method key={module} module={module} />
            {example && module !== "iching" && <p className="sample-note">当前示例使用 {exampleBirth.location.name} 的出生资料。</p>}
          </aside>
          <div className="output-column" ref={output} data-module={module}>
            {result.module === "bazi" && <Bazi key={"bazi-" + revision} chart={result.chart} example={example} inspect={inspect} />}
            {result.module === "ziwei" && <Ziwei key={"ziwei-" + revision} chart={result.chart} selection={ziweiSelection} onSelect={setZiweiSelection}
              isYearly={ziweiYearly} setYearly={setZiweiYearly} busy={!!pending.ziwei} changingYear={changingYear} yearError={yearError}
              onYear={(value) => void changeZiweiYear(value)} onLocateAnnual={locateAnnualPalace} inspect={inspect} />}
            {result.module === "iching" && <IChing key={"iching-" + revision} chart={result.chart} example={example} inspect={inspect} view={hexagramView} setView={setHexagramView} />}
            <Reading state={reads[module] ?? idle} example={example} disabled={!!pending[module]} references={chartReferences(result)} onEvidence={revealEvidence}
              year={result.module === "ziwei" ? result.chart.year.year : undefined} onRequest={() => void requestReport(session.input, true)} onAsk={() => inspect()} />
            {result.module === "bazi" && <Trends key={"trends-" + revision} chart={result.chart} inspect={inspect} />}
          </div>
        </div>
      </main>
      <footer className="shell footer">
        <span><BrandMark size={23} />玄机 AI</span>
        <p>传统命理的象征解读，仅供自我探索与决策反思。</p>
      </footer>
      <button type="button" className="floating-ask icon-button" aria-label="打开 AI 命理顾问" onClick={() => inspect()}><Sparkles size={22} /></button>
      <Copilot key={module + revision + (session.input.module === "ziwei" ? "-" + session.input.viewYear : "") + (focus ? focus.kind + focus.id : "")}
        open={copilot} onOpen={setCopilot} focus={focus} input={session.input} example={example} returnTo={origin} />
    </>
  );
}
