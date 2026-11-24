import { Workbench } from "./components/workbench";
import { buildBazi, buildZiwei, currentYear } from "@/lib/calendar";
import { buildCast } from "@/lib/iching";
import { exampleBirth, exampleCast } from "@/lib/example";
import type { ChartSession } from "@/lib/panels";
import type { Module } from "@/lib/schema";

async function getWorkbenchData() {
  "use cache";

  const year = currentYear();
  const specimens: Record<Module, ChartSession> = {
    bazi: { result: { module: "bazi", chart: buildBazi(exampleBirth, year) }, input: { module: "bazi", birth: exampleBirth }, example: true },
    ziwei: { result: { module: "ziwei", chart: buildZiwei(exampleBirth, year) }, input: { module: "ziwei", birth: exampleBirth }, example: true },
    iching: { result: { module: "iching", chart: buildCast(exampleCast) }, input: { module: "iching", cast: exampleCast }, example: true },
  };
  return { specimens, year, timeZones: Intl.supportedValuesOf("timeZone") };
}

export default async function Home() {
  return <Workbench {...await getWorkbenchData()} />;
}
