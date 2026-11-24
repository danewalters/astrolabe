import { linePositions, lineTypes } from "./iching";
import type { ChartResult } from "./panels";

type Label = { id: string; label: string };
export type ChartReference =
  | (Label & { kind: "palace" | "annual"; palace: number })
  | (Label & { kind: "annual-transformation"; palace: number; star: string })
  | (Label & { kind: "star"; palace: number; star: string })
  | (Label & { kind: "pillar" | "element" | "period" | "year" | "hexagram" | "line" });

export const chartAnchor = (id: string) => "chart-ref-" + id;
export const palaceLabel = (name: string) => name === "命宫" ? name : name + "宫";
export const starReference = (palace: number, index: number) => `star-${palace}-${index}`;

export function chartReferences(result: ChartResult): ChartReference[] {
  if (result.module === "ziwei") {
    const { chart } = result;
    const natal = chart.palaces.flatMap((palace): ChartReference[] => [
      { id: `palace-${palace.index}`, kind: "palace", palace: palace.index, label: palaceLabel(palace.name) },
      ...[...palace.major, ...palace.minor].map(({ name }, index): ChartReference => ({
        id: starReference(palace.index, index), kind: "star", palace: palace.index, star: name,
        label: `${palaceLabel(palace.name)} · ${name}`,
      })),
    ]);
    return [
      ...natal,
      { id: "annual", kind: "annual", palace: chart.year.lifePalaceIndex, label: `${chart.year.year} 年流年命宫` },
      ...chart.year.transformations.map(({ type, star, palaceIndex }, i): ChartReference => ({
        id: `annual-transformation-${i}`, kind: "annual-transformation", palace: palaceIndex, star,
        label: `${chart.year.year} 年 · ${star}化${type} · ${palaceLabel(chart.palaces[palaceIndex].name)}`,
      })),
    ];
  }
  if (result.module === "bazi") {
    const { chart } = result;
    return [
      ...chart.pillars.map((pillar, i): ChartReference => ({ id: `pillar-${i}`, kind: "pillar", label: `${pillar.name} · ${pillar.stem}${pillar.branch}` })),
      ...chart.weights.map(({ element, percent }, i): ChartReference => ({ id: `element-${i}`, kind: "element", label: `${element} · ${percent}%` })),
      ...chart.periods.map(({ startYear, ganZhi }): ChartReference => ({ id: `period-${startYear}`, kind: "period", label: `${ganZhi}大运 · ${startYear}年起` })),
      ...chart.annual.map(({ year, ganZhi }): ChartReference => ({ id: `year-${year}`, kind: "year", label: `${year}年 · ${ganZhi}流年` })),
    ];
  }
  return [
    { id: "hexagram-original", kind: "hexagram", label: `本卦 · ${result.chart.original.name}` },
    { id: "hexagram-changed", kind: "hexagram", label: `变卦 · ${result.chart.changed.name}` },
    ...result.chart.lines.map((line, index): ChartReference => ({ id: `line-${index}`, kind: "line", label: `${linePositions[index]} · ${lineTypes[line]}` })),
  ];
}
