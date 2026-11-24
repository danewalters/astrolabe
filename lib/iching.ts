import type { CastInput, LineValue } from "./schema";

const trigrams = [
  { name: "乾", image: "天", bits: "111", meaning: "主动与持续" },
  { name: "兑", image: "泽", bits: "110", meaning: "交流与开放" },
  { name: "离", image: "火", bits: "101", meaning: "清晰与辨识" },
  { name: "震", image: "雷", bits: "100", meaning: "启动与应变" },
  { name: "巽", image: "风", bits: "011", meaning: "渗透与渐进" },
  { name: "坎", image: "水", bits: "010", meaning: "风险与历练" },
  { name: "艮", image: "山", bits: "001", meaning: "停顿与边界" },
  { name: "坤", image: "地", bits: "000", meaning: "承载与配合" },
] as const;

// King Wen sequence, indexed by upper then lower trigram in the order above.
const order = [
  [1, 10, 13, 25, 44, 6, 33, 12],
  [43, 58, 49, 17, 28, 47, 31, 45],
  [14, 38, 30, 21, 50, 64, 56, 35],
  [34, 54, 55, 51, 32, 40, 62, 16],
  [9, 61, 37, 42, 57, 59, 53, 20],
  [5, 60, 63, 3, 48, 29, 39, 8],
  [26, 41, 22, 27, 18, 4, 52, 23],
  [11, 19, 36, 24, 46, 7, 15, 2],
];
const names = "乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 咸 恒 遁 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济".split(" ");
export const linePositions = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
export const lineTypes = { 6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳" } as const;

function hexagram(bits: boolean[]) {
  const lower = trigrams.findIndex((item) => item.bits === bits.slice(0, 3).map(Number).join(""));
  const upper = trigrams.findIndex((item) => item.bits === bits.slice(3).map(Number).join(""));
  const number = order[upper][lower];
  return { number, name: names[number - 1], upper: trigrams[upper], lower: trigrams[lower], bits };
}

export function buildCast(input: CastInput) {
  const moving = input.lines.flatMap((line, i) => (line === 6 || line === 9 ? [i] : []));
  const original = input.lines.map((line) => line === 7 || line === 9);
  return {
    question: input.question,
    lines: input.lines,
    moving,
    original: hexagram(original),
    changed: hexagram(original.map((yang, i) => moving.includes(i) ? !yang : yang)),
  };
}

export type CastChart = ReturnType<typeof buildCast>;

export function readCoins(elapsed: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const timing = Math.max(0, Math.round(elapsed));
  const coins = Array.from(bytes, (byte, i) => 2 + ((byte ^ (timing >>> i)) & 1));
  return { coins, value: coins.reduce((sum, coin) => sum + coin, 0) as LineValue };
}
