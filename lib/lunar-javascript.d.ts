declare module "lunar-javascript" {
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, min: number, s: number): SolarDate;
  };
  export const Lunar: {
    fromYmdHms(y: number, m: number, d: number, h: number, min: number, s: number): LunarDate;
  };
  export const LunarYear: {
    fromYear(year: number): { getLeapMonth(): number; getMonth(month: number): { getDayCount(): number } | null };
  };
  export const LunarUtil: {
    GAN: string[];
    ZHI: string[];
  };
  interface SolarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toYmd(): string;
    toYmdHms(): string;
    getLunar(): LunarDate;
  }
  interface LunarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarDate;
    toString(): string;
    getEightChar(): EightChar;
  }
  interface EightChar {
    setSect(sect: number): void;
    getYear(): string;
    getYearNaYin(): string;
    getMonth(): string;
    getMonthNaYin(): string;
    getMonthHideGan(): string[];
    getDay(): string;
    getDayNaYin(): string;
    getTime(): string;
    getTimeNaYin(): string;
    getYearHideGan(): string[];
    getDayHideGan(): string[];
    getTimeHideGan(): string[];
    getYun(sex: number, sect: number): Yun;
  }
  interface Yun {
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartHour(): number;
    getStartSolar(): SolarDate;
    isForward(): boolean;
    getDaYun(count: number): DaYun[];
  }
  interface DaYun {
    getGanZhi(): string;
    getStartYear(): number;
    getEndYear(): number;
    getLiuNian(count: number): LiuNian[];
  }
  interface LiuNian {
    getGanZhi(): string;
    getYear(): number;
  }
}
