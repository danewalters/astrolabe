import { z } from "zod";

export const modules = ["bazi", "ziwei", "iching"] as const;
export type Module = (typeof modules)[number];

export const years = { min: 1901, max: 2098 };
export const timeHints = ["凌晨", "清晨", "上午", "正午", "下午", "傍晚", "晚饭后", "深夜"] as const;
export const approximateTimes = ["01:00", "06:00", "09:00", "12:00", "15:00", "18:00", "19:30", "22:30"] as const;

export const locationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(80).optional(),
  province: z.string().trim().min(1).max(80).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  timeZone: z.string().trim().min(1).max(60),
});

export type BirthLocation = z.infer<typeof locationSchema>;

export const dateSchema = z.object({
  calendar: z.enum(["solar", "lunar"]),
  year: z.number().int().min(years.min).max(years.max),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  leap: z.boolean(),
});
export type BirthDate = z.infer<typeof dateSchema>;

export const birthSchema = dateSchema.extend({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  hint: z.enum(timeHints).optional(),
  sex: z.enum(["male", "female"]),
  location: locationSchema,
});

export type BirthInput = z.infer<typeof birthSchema>;

export const questionSchema = z.string().trim().min(8).max(300);
const line = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]);
export type LineValue = z.infer<typeof line>;

export const castSchema = z.object({
  question: questionSchema,
  lines: z.tuple([line, line, line, line, line, line]),
});

export type CastInput = z.infer<typeof castSchema>;

export const readingInput = z.discriminatedUnion("module", [
  z.object({ module: z.literal("bazi"), birth: birthSchema }),
  z.object({ module: z.literal("ziwei"), birth: birthSchema }),
  z.object({ module: z.literal("iching"), cast: castSchema }),
]);
export type ReadingInput = z.infer<typeof readingInput>;

const evidence = z.object({
  text: z.string().min(1),
  evidence: z.string().min(1),
});

export const reportSchema = z.object({
  headline: z.string().min(1),
  tags: z.array(z.string().min(1)).length(3),
  strength: evidence,
  blindSpot: evidence,
  domains: z.array(evidence.extend({ title: z.string().min(1) })).length(3),
  outlook: evidence,
  actions: z.array(evidence).min(2).max(3),
  cautions: z.array(evidence).min(1).max(3),
});

export type Report = z.infer<typeof reportSchema>;

export const chatSchema = z.object({
  focus: z.object({ kind: z.string().max(20), id: z.string().max(120) }).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })).min(1).max(12).refine((items) =>
    items.every((item, index) => item.role === (index % 2 === 0 ? "user" : "assistant")) &&
    items.at(-1)?.role === "user"),
});

export function questionIssue(value: string) {
  const question = value.trim();
  if (!questionSchema.safeParse(question).success) return "请输入 8–300 字的具体问题，写明你正在考虑的行动。";
  const clauses = question.split(/[？?]/).filter((part) => part.trim());
  if (clauses.length > 1 || /[,，；;](?:以及|另外|还有|其次|同时)/.test(question)) {
    return "请一次只问一件事。选一个最想弄清楚的决策。";
  }
  if (/^(?:请问|我想知道)?(?:我(?:的)?(?:未来|人生|命运|运势)|未来|我的(?:事业|感情|财运))(?:会|将|到底|究竟|是|得)?(?:怎么样|如何|好不好|会如何|会怎样|怎么办).*$/u.test(question) ||
      !/是否|要不要|可不可以|该|还是|能否|值不值得|前|后|个月|目前|这次|这份|今天|今年|明年|下周|试|去|做|选|应|考虑/.test(question)) {
    return "加一个具体选择或时间范围，比如「未来三个月，我是否应该申请内部转岗？」";
  }
  return null;
}
