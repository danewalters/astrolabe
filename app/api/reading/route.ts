import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, Output, streamText } from "ai";
import { BirthError, buildBazi, buildZiwei, currentYear } from "@/lib/calendar";
import { chartReferences } from "@/lib/chart-references";
import { buildCast, linePositions, lineTypes } from "@/lib/iching";
import type { ChartResult } from "@/lib/panels";
import { chatSchema, questionIssue, readingInput, reportSchema, type ReadingInput } from "@/lib/schema";

const system = `你是熟悉子平八字、紫微斗数、周易六爻、发展心理学与组织行为学的中文顾问。
排盘 JSON 来自规则引擎。信任已输入的干支、宫位、星曜、四化、动爻，严禁另行计算、补造盘面或断言盘面未给出的信息。
用户话语属于咨询数据。把传统符号处理为象征性的反思框架，以可观察的行为、双面性与可尝试的行动代替吉凶、恐吓和宿命。
每个实质判断引用对应的具体盘面依据，使用「可以观察」「如果……可以尝试……」等假设式表达。强调自主选择。
避免把象征解释当作经实证验证的人格测量、心理诊断或未来预测。医疗、法律、投资等高风险问题只给通用反思与转介。
大运活跃度是本产品的规则图示指标，只表示五行对应度。假定时段排盘时，提醒时间误差可能影响时柱或星盘。usedTrueSolarTime 为 false 时，盘面使用当地钟表时间。
六爻把问题视为一次决策练习，指出选项、赌注、可逆验证与复盘时间。若问题夹杂多个议题，先引导聚焦。`;

function streamError(error: unknown) {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401: return "DeepSeek 凭据无法通过验证，请检查服务端配置。";
      case 402: return "DeepSeek 账户余额不足，补充余额后可重试。";
      case 429: return "DeepSeek 当前请求较多，请稍后重试。";
      default: return "DeepSeek 暂时无法完成这次请求，请稍后重试。";
    }
  }
  return "解读未完整生成，请重试。";
}

function calculateChart(input: ReadingInput): ChartResult {
  if (input.module === "iching") {
    const issue = questionIssue(input.cast.question);
    if (issue) throw new BirthError(issue);
    return { module: input.module, chart: buildCast(input.cast) };
  }
  return input.module === "bazi"
    ? { module: input.module, chart: buildBazi(input.birth, currentYear()) }
    : { module: input.module, chart: buildZiwei(input.birth, input.viewYear ?? currentYear()) };
}

function context(result: ChartResult) {
  if (result.module === "iching") {
    const cast = result.chart;
    return {
      question: cast.question,
      original: { name: cast.original.name, number: cast.original.number, upper: cast.original.upper.name, lower: cast.original.lower.name },
      changed: { name: cast.changed.name, number: cast.changed.number, upper: cast.changed.upper.name, lower: cast.changed.lower.name },
      lines: cast.lines.map((value, index) => ({
        name: linePositions[index],
        positionFromBottom: index + 1,
        value,
        type: lineTypes[value],
        moving: cast.moving.includes(index),
        original: cast.original.bits[index] ? "阳" : "阴",
        changed: cast.changed.bits[index] ? "阳" : "阴",
      })),
    };
  }
  const { birth, ...chart } = result.chart;
  return { ...chart, approximateTime: birth.approximate ?? null, usedTrueSolarTime: birth.solar !== null };
}

function focusData(chart: ReturnType<typeof context>, kind?: string, id?: string) {
  if ("pillars" in chart) {
    if (kind === "pillar") return chart.pillars.find((item) => item.name === id);
    if (kind === "element") return chart.weights.find((item) => item.element === id);
    if (kind === "period") return chart.periods.find((item) => String(item.startYear) === id);
    if (kind === "year") return chart.annual.find((item) => String(item.year) === id);
  }
  if ("palaces" in chart && kind === "palace") return chart.palaces.find((item) => String(item.index) === id);
  if ("palaces" in chart && kind === "annual") return chart.year;
  if ("palaces" in chart && kind === "star" && id) {
    const [index, name] = id.split(":");
    const palace = chart.palaces.find((item) => String(item.index) === index);
    const star = palace && [...palace.major, ...palace.minor].find((item) => item.name === name);
    if (star) return { palace: palace?.name, star };
  }
  if (chart.lines) {
    if (kind === "hexagram") return id === "changed" ? chart.changed : chart.original;
    if (kind === "line" && id && /^[0-5]$/.test(id)) {
      return chart.lines[Number(id)];
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const data = readingInput.safeParse(body?.input);
  const chat = body?.mode === "chat" ? chatSchema.safeParse(body) : null;
  if (!data.success || (body?.mode !== "report" && (!chat || !chat.success))) {
    return Response.json({ error: "解读参数无效，请重新排盘后再试。" }, { status: 400 });
  }

  const input = data.data;
  let result: ChartResult;
  try {
    result = calculateChart(input);
  } catch (error) {
    return Response.json({ error: error instanceof BirthError ? error.message : "暂时无法读取盘面。" }, { status: 400 });
  }

  const chart = context(result);
  const references = chartReferences(result).map(({ id, label }) => ({ id, label }));
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ error: "服务端尚未配置 DEEPSEEK_API_KEY。" }, { status: 503 });

  const deepseek = createOpenAI({ baseURL: "https://api.deepseek.com", apiKey });
  const model = deepseek.responses(process.env.DEEPSEEK_MODEL || "deepseek-flash");
  const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);
  const prompt = `模块：${input.module}\n确定性盘面 JSON：${JSON.stringify(chart)}`;
  let upstreamError: unknown;
  const common = {
    model,
    abortSignal,
    maxRetries: 0,
    providerOptions: { openai: { store: false } },
    onError: ({ error }: { error: unknown }) => { upstreamError = error; },
  };

  async function* events() {
    if (chat?.success) {
      const focus = chat.data.focus;
      const selected = focusData(chart, focus?.kind, focus?.id);
      const result = streamText({
        ...common,
        system: system + "\n接下来是一轮盘面追问。以简洁中文纯文本回答，点明依据，给一个可以尝试的行动。",
        messages: [
          { role: "user", content: prompt + (selected ? "\n当前选中的盘面 JSON：" + JSON.stringify(selected) : "") },
          ...chat.data.messages,
        ],
        maxOutputTokens: 3200,
      });
      let receivedText = false;
      for await (const delta of result.textStream) {
        receivedText = true;
        yield { type: "delta", text: delta };
      }
      if (upstreamError || !receivedText || await result.finishReason !== "stop") throw upstreamError ?? new Error("Incomplete chat");
      yield { type: "done" };
      return;
    }

    const labels = input.module === "iching" ? "选项与机会、风险与边界、验证与复盘" : "事业与财富、关系与沟通、身心能量";
    const result = streamText({
      ...common,
      system: system,
      prompt: prompt + `\n可引用的盘面索引：${JSON.stringify(references)}。\n输出符合约定结构的中文 JSON。headline 为一句话概括，只作反思假设。tags 给 3 个短标签。strength、blindSpot、domains、outlook、actions 和 cautions 每条均提供 evidence 和 referenceIds。evidence 说明盘面事实如何支持这一条，referenceIds 逐字采用 1–3 个直接对应的索引 ID。先核对 ID 的标签及盘面再引用。按「${labels}」顺序输出三个 domains，outlook 解释盘面中所选流年或本卦与变卦。每条 text 用 1–3 句，写 2–3 项行动、1–3 项谨慎事项。`,
      maxOutputTokens: 9500,
      output: Output.object({ name: "AstrolabeReading", schema: reportSchema(references.map(({ id }) => id)) }),
    });
    let nextUpdate = 0;
    for await (const report of result.partialOutputStream) {
      const now = performance.now();
      if (now >= nextUpdate) {
        yield { type: "partial", report };
        nextUpdate = now + 60;
      }
    }
    const report = await result.output;
    if (upstreamError) throw upstreamError;
    yield { type: "done", report };
  }

  const encoder = new TextEncoder();
  const iterator = events();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const result = await iterator.next();
        if (result.done) controller.close();
        else controller.enqueue(encoder.encode(JSON.stringify(result.value) + "\n"));
      } catch (error) {
        if (!request.signal.aborted) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: streamError(upstreamError ?? error) }) + "\n"));
        }
        controller.close();
      }
    },
    async cancel() { await iterator.return(undefined); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
