"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { DeepPartial } from "ai";
import { Bot, CircleAlert, Compass, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Focus } from "@/lib/panels";
import type { ReadingInput, Report } from "@/lib/schema";
import { Button } from "./ui/button";

type PartialReport = DeepPartial<Report>;
type Event =
  | { type: "partial"; report: PartialReport }
  | { type: "done"; report?: Report }
  | { type: "delta"; text: string }
  | { type: "error"; message: string };

export type ReportState = { status: "idle" | "loading" | "done" | "error"; report?: PartialReport; error?: string };

export async function readEvents(payload: unknown, signal: AbortSignal, receive: (event: Event) => void) {
  const response = await fetch("/api/reading", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "暂时无法连接 AI 解读。");
  if (!response.body) throw new Error("未收到解读内容，请重试。");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  let done = false;
  function parse(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Event;
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "done") done = true;
    receive(event);
  }

  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      pending += part.value;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      lines.forEach(parse);
    }
    parse(pending);
    if (!done) throw new Error("解读连接中断，请重试。");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function Evidence({ value }: { value?: { text?: string; evidence?: string } }) {
  return <>{value?.text && <p>{value.text}</p>}{value?.evidence && <small className="evidence">盘面依据 · {value.evidence}</small>}</>;
}

export function Reading({ state, example, disabled, onRequest, onAsk }: {
  state: ReportState; example: boolean; disabled: boolean; onRequest: () => void; onAsk: () => void;
}) {
  const report = state.report;
  const ready = state.status === "done";
  const loading = state.status === "loading";
  return (
    <section className="panel report-panel" id="reading" aria-labelledby="report-heading" aria-busy={loading}>
      <div className="panel-head">
        <div className="head-group"><span className="head-icon"><Sparkles size={18} /></span><h2 id="report-heading">AI 深度解读</h2></div>
        <span className="model-label">DeepSeek</span>
      </div>
      <div className="chart-body">
        {!report && <div className="report-intro">
          <p>{loading ? "正在读取盘面并组织解读…" : "把盘面中的符号转化为可观察的行为线索与行动建议。"}{example && !loading ? " 当前展示示例盘。" : ""}</p>
          {loading ? <span className="report-wait" role="status"><LoaderCircle size={16} />正在生成</span> :
            <Button variant="primary" disabled={disabled} onClick={onRequest}><Sparkles size={15} />{state.status === "error" ? "重试解读" : example ? "解读示例盘" : "生成深度解读"}</Button>}
        </div>}
        {state.error && <p className="form-error report-error" role="alert"><CircleAlert size={15} />{state.error}</p>}
        {report && <div className="report-content">
          {report.headline && <div className="report-lead">
            <h3>{report.headline}</h3>
            <div className="report-tags">{report.tags?.map((tag, i) => tag && <span key={i}>{tag}</span>)}</div>
          </div>}
          {(report.strength?.text || report.blindSpot?.text) && <div className="report-contrast">
            <article><h4>可发挥的优势</h4><Evidence value={report.strength} /></article>
            <article><h4>值得留意的盲区</h4><Evidence value={report.blindSpot} /></article>
          </div>}
          {report.domains?.map((domain, i) => domain?.title && <article className="report-domain" key={i}><h4>{domain.title}</h4><Evidence value={domain} /></article>)}
          {report.outlook?.text && <article className="report-domain"><h4>当下观察</h4><Evidence value={report.outlook} /></article>}
          {(report.actions?.length || report.cautions?.length) ? <div className="report-contrast">
            <article><h4>可以尝试</h4><ul>{report.actions?.map((item, i) => item?.text && <li key={i}><Evidence value={item} /></li>)}</ul></article>
            <article><h4>建议留意</h4><ul>{report.cautions?.map((item, i) => item?.text && <li key={i}><Evidence value={item} /></li>)}</ul></article>
          </div> : null}
          {loading && <p className="report-wait" role="status"><LoaderCircle size={15} />持续生成中</p>}
          {ready && <Button onClick={onAsk}><Bot size={15} />继续追问</Button>}
        </div>}
      </div>
    </section>
  );
}

type Message = { role: "user" | "assistant"; content: string };

export function Copilot({ open, onOpen, focus, input, example, returnTo }: {
  open: boolean; onOpen: (value: boolean) => void; focus: Focus | null; input: ReadingInput; example: boolean; returnTo: HTMLElement | null;
}) {
  const [chat, setChat] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (open && (answer || chat.length)) end.current?.scrollIntoView({ block: "nearest" });
  }, [open, answer, chat.length]);

  async function ask(value: string) {
    if (!value.trim() || busy) return;
    setQuestion("");
    setError("");
    setAnswer("");
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const sent = [...chat.slice(-10), { role: "user" as const, content: value.trim() }];
    setChat(sent);
    let text = "";
    try {
      await readEvents({ mode: "chat", input, focus: focus ? { kind: focus.kind, id: focus.id } : undefined, messages: sent }, abort.signal, (event) => {
        if (event.type === "delta") { text += event.text; setAnswer(text); }
      });
      setChat([...sent, { role: "assistant", content: text }]);
    } catch (reason) {
      if (!abort.signal.aborted) {
        setChat(sent.slice(0, -1));
        setQuestion(value);
        setError(reason instanceof Error ? reason.message : "消息发送失败，请重试。");
      }
    } finally {
      if (!abort.signal.aborted) { setBusy(false); setAnswer(""); }
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(question); }

  return (
    <Dialog.Root open={open} onOpenChange={onOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="copilot" onCloseAutoFocus={(event) => {
          if (returnTo?.isConnected) { event.preventDefault(); returnTo.focus({ preventScroll: true }); }
        }}>
          <div className="copilot-head">
            <div className="head-group"><span className="head-icon"><Sparkles size={18} /></span><Dialog.Title>AI 命理顾问</Dialog.Title></div>
            <Dialog.Close aria-label="关闭 AI 顾问" className="icon-button"><X size={21} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">查看所选盘面元素的释义，并使用 DeepSeek 追问。</Dialog.Description>
          <div className="copilot-scroll" aria-live="polite">
            {focus ? <div className="focus-card"><p><Compass size={14} />{example ? "示例盘面" : "盘面释义"}</p><h3>{focus.label}</h3><strong>{focus.detail}</strong><span>{focus.description}</span></div> :
              <div className="focus-card"><p><Compass size={14} />{example ? "正在使用示例盘" : "已载入当前盘面"}</p><h3>想了解哪一部分？</h3><span>可以从一个盘面符号、行为倾向或当下的选择问起。</span></div>}
            {!chat.length && <div className="chat-suggestions">
              <Button variant="secondary" disabled={busy} onClick={() => void ask(focus ? "这个盘面元素可以怎么理解？" : "这份盘面有哪些值得观察的线索？")}>{focus ? "这个符号代表什么？" : "有哪些可观察的线索？"}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void ask("基于当前盘面，给我一个可以在一周内验证的小行动。")}>我可以尝试什么？</Button>
            </div>}
            {chat.map((message, i) => <p key={i} className="chat-message" data-role={message.role}>{message.content}</p>)}
            {busy && <p className="chat-message" data-role="assistant">{answer || "正在结合盘面思考…"}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div ref={end} />
          </div>
          <form className="chat-form" onSubmit={submit}>
            <label htmlFor="chat-question" className="sr-only">输入你的问题</label>
            <textarea id="chat-question" placeholder="结合当前盘面提问…" rows={2} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(question); } }} />
            <Button variant="primary" type="submit" aria-label="发送问题" disabled={!question.trim() || busy}><Send size={17} /></Button>
            <p>发送后，盘面和对话将提交给 DeepSeek。</p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
