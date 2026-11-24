"use client";

import { CircleDot, Dices, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type MouseEvent } from "react";
import { linePositions, readCoins } from "@/lib/iching";
import { questionIssue, type CastInput, type LineValue } from "@/lib/schema";
import { exampleCast } from "@/lib/example";
import { Button } from "./ui/button";

export function CastForm({ pending, onComplete, onReset }: {
  pending: boolean;
  onComplete: (input: CastInput) => Promise<void>;
  onReset: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [lines, setLines] = useState<LineValue[]>([]);
  const [coins, setCoins] = useState([2, 3, 2]);
  const [rolling, setRolling] = useState(false);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState("");
  const start = useRef<number | null>(null);
  const reduced = useReducedMotion();

  function reset() {
    setLines([]);
    setCoins([2, 3, 2]);
    setError("");
    onReset();
  }

  async function finish(values: LineValue[]) {
    try {
      await onComplete({ question: question.trim(), lines: values as CastInput["lines"] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成卦象失败，请重试。");
    }
  }

  async function toss(event: MouseEvent<HTMLButtonElement>) {
    const elapsed = event.detail && start.current !== null ? performance.now() - start.current : 0;
    start.current = null;
    setHolding(false);
    const issue = questionIssue(question);
    if (issue) { setError(issue); return; }
    setError("");
    if (lines.length === 6) { await finish(lines); return; }
    setRolling(true);
    const next = readCoins(elapsed);
    await new Promise((resolve) => setTimeout(resolve, reduced ? 0 : 320));
    const values = [...lines, next.value];
    setLines(values);
    setCoins(next.coins);
    setRolling(false);
    if (values.length === 6) await finish(values);
  }

  return (
    <section className="panel input-panel" aria-labelledby="cast-heading">
      <div className="panel-head">
        <div className="head-group"><span className="head-icon"><Dices size={18} /></span><h2 id="cast-heading">六爻起卦</h2></div>
        <button type="button" className="text-button" disabled={Boolean(lines.length) || rolling} onClick={() => { setQuestion(exampleCast.question); setError(""); }}>填入示例</button>
      </div>
      <div className="birth-form cast-form">
        <div className="field">
          <label htmlFor="cast-question">你正在考虑什么选择？</label>
          <textarea id="cast-question" placeholder="例如，未来三个月，我是否应该申请内部转岗？" maxLength={300} rows={4}
            value={question} disabled={Boolean(lines.length) || rolling} onChange={(event) => { setQuestion(event.target.value); setError(""); }} />
          <p className="field-help">一次问一件事，写明你考虑的行动或时间范围。</p>
        </div>
        <div className="coin-tray" aria-hidden="true">
          {coins.map((coin, i) => (
            <motion.span key={i} className="coin" data-side={coin}
              animate={rolling && !reduced ? { rotateY: [0, 215, 540, 720], y: [0, -18 - i * 3, -6, 0] } : { rotateY: 0, y: holding && !reduced ? -5 : 0 }}
              transition={{ duration: rolling ? 0.31 : 0.15, delay: rolling ? i * 0.015 : 0 }}>
              {coin === 3 ? "陽" : "陰"}<span />
            </motion.span>
          ))}
        </div>
        <div className="cast-progress" aria-label="起卦进度">
          {linePositions.map((name, i) => <span key={name} data-cast={Boolean(lines[i])} title={name}>{lines[i] ?? "·"}</span>)}
        </div>
        <p className="cast-caption" aria-live="polite">{lines.length < 6 ? `${lines.length} / 6 爻 · 下一爻：${linePositions[lines.length]}` : "六爻已齐"}</p>
        {lines.length < 6 || pending || error ? <Button className="generate-button" variant="primary" disabled={rolling || pending}
          onPointerDown={() => { start.current = performance.now(); setHolding(true); }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => { start.current = null; setHolding(false); }}
          onPointerLeave={() => setHolding(false)}
          onClick={(event) => void toss(event)}><CircleDot size={17} />
          {pending ? "正在成卦…" : rolling ? "铜钱摇动中…" : lines.length === 6 ? "重试生成卦象" : "点击或长按摇钱"}
        </Button> : <Button className="generate-button" onClick={reset}><RotateCcw size={16} />开启新一卦</Button>}
        {lines.length > 0 && lines.length < 6 && <Button className="reset-cast" variant="quiet" disabled={rolling} onClick={reset}><RotateCcw size={14} />重新起卦</Button>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
