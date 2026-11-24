import type { BaziChart, ZiweiChart } from "./calendar";
import type { CastChart } from "./iching";
import type { ReadingInput } from "./schema";

export type ChartResult =
  | { module: "bazi"; chart: BaziChart }
  | { module: "ziwei"; chart: ZiweiChart }
  | { module: "iching"; chart: CastChart };

export type ChartSession = { result: ChartResult; input: ReadingInput; example: boolean };

export type Focus = { kind: string; id: string; label: string; detail: string; description: string };
