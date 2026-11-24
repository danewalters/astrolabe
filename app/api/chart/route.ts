import { BirthError, buildBazi, buildZiwei, convertDate, currentYear } from "@/lib/calendar";
import { buildCast } from "@/lib/iching";
import { dateSchema, questionIssue, readingInput, years } from "@/lib/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    if (body?.operation === "calendar") {
      const input = dateSchema.safeParse(body.date);
      if (!input.success) return Response.json({ error: "请先填入有效的年月日。" }, { status: 400 });
      const converted = convertDate(input.data);
      if (converted.year < years.min || converted.year > years.max) {
        return Response.json({ error: "换算后的日期超出当前排盘的年份范围。" }, { status: 400 });
      }
      return Response.json(converted);
    }
    const result = readingInput.safeParse(body);
    if (!result.success) return Response.json({ error: "请核对日期、出生时间和出生地点。" }, { status: 400 });
    const data = result.data;
    if (data.module === "iching") {
      const issue = questionIssue(data.cast.question);
      if (issue) return Response.json({ error: issue }, { status: 400 });
      return Response.json({ module: "iching", chart: buildCast(data.cast) });
    }
    const reference = currentYear();
    return data.module === "bazi"
      ? Response.json({ module: "bazi", chart: buildBazi(data.birth, reference) })
      : Response.json({ module: "ziwei", chart: buildZiwei(data.birth, reference) });
  } catch (error) {
    const message = error instanceof BirthError ? error.message : "暂时无法排盘，请核对输入后重试。";
    return Response.json({ error: message }, { status: error instanceof BirthError ? 400 : 500 });
  }
}
