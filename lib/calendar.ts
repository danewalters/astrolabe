import { Temporal } from "@js-temporal/polyfill";
import { Lunar, LunarYear, Solar } from "lunar-javascript";
import { astro } from "iztro";
import type { BirthDate, BirthInput } from "./schema";

export const elements = ["木", "火", "土", "金", "水"] as const;
export type Element = (typeof elements)[number];
const stems = "甲乙丙丁戊己庚辛壬癸";
const branches = "子丑寅卯辰巳午未申酉戌亥";
const branchElements: Element[] = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];
const stemElement = (stem: string) => elements[Math.floor(stems.indexOf(stem) / 2)];
const pairElements = (pair: string) => [stemElement(pair[0]), branchElements[branches.indexOf(pair[1])]];
const toSolar = (date: Temporal.PlainDateTime) =>
  Solar.fromYmdHms(date.year, date.month, date.day, date.hour, date.minute, date.second);

export class BirthError extends Error {}

function civilDate(input: BirthDate) {
  let date: Temporal.PlainDate;
  if (input.calendar === "lunar") {
    const month = input.leap ? -input.month : input.month;
    const lunarMonth = LunarYear.fromYear(input.year).getMonth(month);
    if (!lunarMonth || input.day > lunarMonth.getDayCount()) {
      throw new BirthError("这个农历月份或日期不存在，请核对闰月与日期。");
    }
    date = Temporal.PlainDate.from(Lunar.fromYmdHms(input.year, month, input.day, 12, 0, 0).getSolar().toYmd());
  } else {
    try {
      date = Temporal.PlainDate.from({ year: input.year, month: input.month, day: input.day }, { overflow: "reject" });
    } catch {
      throw new BirthError("这个公历日期不存在，请核对月份与日期。");
    }
  }
  return date;
}

export function convertDate(input: BirthDate): BirthDate {
  const date = civilDate(input);
  if (input.calendar === "lunar") {
    return { calendar: "solar", year: date.year, month: date.month, day: date.day, leap: false };
  }
  const lunar = toSolar(date.toPlainDateTime({ hour: 12 })).getLunar();
  return { calendar: "lunar", year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(), leap: lunar.getMonth() < 0 };
}

function solarTimeAdjustment(zoned: Temporal.ZonedDateTime, longitude: number) {
  const utc = zoned.withTimeZone("UTC");
  // NOAA fractional-year approximation for the equation of time, in minutes.
  const angle = 2 * Math.PI / utc.daysInYear * (utc.dayOfYear - 1 + (utc.hour + utc.minute / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
    - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle));
  return 4 * longitude + equation - zoned.offsetNanoseconds / 60_000_000_000;
}

function resolveBirth(input: BirthInput) {
  const date = civilDate(input);
  const local = date.toPlainDateTime(input.time);
  const { name, country, province, latitude, longitude, timeZone } = input.location;
  let zoned: Temporal.ZonedDateTime;
  let alternate: Temporal.ZonedDateTime;
  try {
    // IANA zone names retain historical timezone and daylight-saving rules.
    new Intl.DateTimeFormat("zh-CN", { timeZone });
    zoned = local.toZonedDateTime(timeZone, { disambiguation: "earlier" });
    alternate = local.toZonedDateTime(timeZone, { disambiguation: "later" });
  } catch {
    throw new BirthError("时区无效，请重新选择出生地时区。");
  }
  if (!zoned.toPlainDateTime().equals(local)) {
    throw new BirthError("出生时间落在夏令时跳过的时段内，请核对当地记录。");
  }
  const beijing = zoned.withTimeZone("+08:00").toPlainDateTime();
  const adjustment = longitude === undefined ? null : solarTimeAdjustment(zoned, longitude);
  const chartTime = adjustment === null ? local : local.add({ seconds: Math.round(adjustment * 60) });
  return {
    date, chartTime, beijing,
    details: {
      name: Array.from(new Set([country, province, name].filter(Boolean))).join(" · "),
      timeZone, longitude, latitude,
      civil: local.toString({ smallestUnit: "minute" }).replace("T", " "),
      solar: adjustment === null ? null : chartTime.toString({ smallestUnit: "second" }).replace("T", " "),
      lunar: toSolar(chartTime).getLunar().toString(),
      correction: adjustment === null ? null : Number(adjustment.toFixed(1)),
      approximate: input.hint,
      ambiguous: zoned.epochMilliseconds !== alternate.epochMilliseconds,
    },
  };
}

function tenGod(self: string, other: string) {
  const from = stems.indexOf(self);
  const to = stems.indexOf(other);
  const difference = (Math.floor(to / 2) - Math.floor(from / 2) + 5) % 5;
  const names = [["比肩", "劫财"], ["食神", "伤官"], ["偏财", "正财"], ["七杀", "正官"], ["偏印", "正印"]];
  return names[difference][(from + to) % 2];
}

function elementWeights(pillars: { stem: string; hidden: string[] }[]) {
  const weights: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const shares = [[1], [0.7, 0.3], [0.6, 0.25, 0.15]];
  pillars.forEach(({ stem, hidden }, index) => {
    weights[stemElement(stem)] += 1;
    hidden.forEach((gan, position) => {
      weights[stemElement(gan)] += shares[hidden.length - 1][position] * (index === 1 ? 2 : 1);
    });
  });
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const sharesByElement = elements.map((element) => ({ element, share: weights[element] / total * 100 }));
  let remaining = 100 - sharesByElement.reduce((sum, value) => sum + Math.floor(value.share), 0);
  const extras = new Set(sharesByElement.toSorted((a, b) => b.share % 1 - a.share % 1).filter(() => remaining-- > 0).map((item) => item.element));
  return sharesByElement.map(({ element, share }) => ({ element, percent: Math.floor(share) + Number(extras.has(element)) }));
}

export const currentYear = () => Temporal.Now.plainDateISO("Asia/Shanghai").year;

export function buildBazi(input: BirthInput, referenceYear: number) {
  const birth = resolveBirth(input);
  // Solar terms in lunar-javascript use UTC+08:00. Day and hour use the local chart time.
  const seasonal = toSolar(birth.beijing).getLunar().getEightChar();
  const daily = toSolar(birth.chartTime).getLunar().getEightChar();
  daily.setSect(2);
  const day = daily.getDay();
  const pairs = [seasonal.getYear(), seasonal.getMonth(), day, daily.getTime()];
  const hidden = [seasonal.getYearHideGan(), seasonal.getMonthHideGan(), daily.getDayHideGan(), daily.getTimeHideGan()];
  const naYin = [seasonal.getYearNaYin(), seasonal.getMonthNaYin(), daily.getDayNaYin(), daily.getTimeNaYin()];
  const pillars = pairs.map((pair, index) => {
    const [stem, branch] = pair;
    const [stemElement, branchElement] = pairElements(pair);
    return {
      name: ["年柱", "月柱", "日柱", "时柱"][index],
      stem, branch, stemElement, branchElement,
      relationship: index === 2 ? "日主" : tenGod(day[0], stem),
      hidden: hidden[index],
      hiddenGods: hidden[index].map((gan) => tenGod(day[0], gan)),
      naYin: naYin[index],
    };
  });
  const weights = elementWeights(pillars);
  const yun = seasonal.getYun(input.sex === "male" ? 1 : 0, 2);
  const activation = (pair: string) => {
    const [stem, branch] = pairElements(pair);
    return Math.round(100 * (weights.find((item) => item.element === stem)!.percent + weights.find((item) => item.element === branch)!.percent) / (2 * Math.max(...weights.map((item) => item.percent))));
  };
  // The library calculates the interval from the precise solar term in UTC+08.
  // Apply that interval to the user's birth date to label the periods in local years.
  const firstStart = birth.date.add({ years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay() })
    .toPlainDateTime(input.time).add({ hours: yun.getStartHour() });
  const periods = yun.getDaYun(11).slice(1).map((period, index) => {
    const ganZhi = period.getGanZhi();
    const startYear = firstStart.year + index * 10;
    return { ganZhi, startYear, endYear: startYear + 9, age: yun.getStartYear() + index * 10, activity: activation(ganZhi) };
  });
  const annual = Array.from({ length: 3 }, (_, index) => {
    const year = referenceYear + index;
    const ganZhi = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getEightChar().getYear();
    return { year, ganZhi, activity: activation(ganZhi), period: periods.find((item) => item.startYear <= year && item.endYear >= year)?.ganZhi };
  });
  return {
    birth: birth.details,
    pillars,
    dayMaster: day[0],
    weights,
    periods,
    annual,
    start: firstStart.toPlainDate().toString(),
    forward: yun.isForward(),
  };
}

const transitions = ["禄", "权", "科", "忌"] as const;

export function buildZiwei(input: BirthInput, referenceYear: number) {
  const birth = resolveBirth(input);
  const hour = birth.chartTime.hour;
  const board = astro.withOptions({
    type: "solar", dateStr: birth.chartTime.toPlainDate().toString(),
    timeIndex: Math.floor((hour + 1) / 2),
    gender: input.sex === "male" ? "男" : "女",
    fixLeap: true, language: "zh-CN",
    config: { dayDivide: "current", yearDivide: "normal", horoscopeDivide: "normal" },
  });
  const palaces = board.palaces.map((palace) => {
    const related = board.surroundedPalaces(palace.index);
    return {
      index: palace.index, name: palace.name,
      stem: palace.heavenlyStem, branch: palace.earthlyBranch,
      body: palace.isBodyPalace,
      original: palace.isOriginalPalace,
      major: palace.majorStars.map(({ name, brightness, mutagen }) => ({ name, brightness, mutagen })),
      minor: palace.minorStars.map(({ name, brightness, mutagen }) => ({ name, brightness, mutagen })),
      adjunct: palace.adjectiveStars.map(({ name }) => name),
      decadal: palace.decadal,
      related: [related.wealth.index, related.career.index, related.opposite.index],
      flies: palace.mutagedPlaces().flatMap((target, index) => target ? [{ target: target.index, type: transitions[index] }] : []),
    };
  });
  const readYear = board.horoscope(referenceYear + "-07-01", 6).yearly;
  return {
    birth: birth.details, palaces, soul: board.soul, body: board.body, bureau: board.fiveElementsClass,
    year: { year: referenceYear, stem: readYear.heavenlyStem, branch: readYear.earthlyBranch, mutagen: readYear.mutagen, palace: palaces[readYear.index]?.name },
  };
}

export type BaziChart = ReturnType<typeof buildBazi>;
export type ZiweiChart = ReturnType<typeof buildZiwei>;
