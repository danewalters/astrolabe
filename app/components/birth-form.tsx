"use client";

import { CalendarDays, ChevronDown, Clock3, MapPin, ScanLine, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { exampleBirth } from "@/lib/example";
import { approximateTimes, locationSchema, timeHints, years, type BirthDate, type BirthInput } from "@/lib/schema";
import { Button } from "./ui/button";

type Module = "bazi" | "ziwei";
type DateFields = { year: string; month: string; day: string };
type Coordinate = { degrees: string; negative: boolean };
const emptyDate: DateFields = { year: "", month: "", day: "" };
const monthNames = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const commonZones = [
  ["Asia/Shanghai", "中国标准时间 · Asia/Shanghai"],
  ["Asia/Hong_Kong", "香港 · Asia/Hong_Kong"],
  ["Asia/Taipei", "台北 · Asia/Taipei"],
  ["Asia/Singapore", "新加坡 · Asia/Singapore"],
  ["Asia/Tokyo", "东京 · Asia/Tokyo"],
  ["Europe/London", "伦敦 · Europe/London"],
  ["America/New_York", "纽约 · America/New_York"],
  ["America/Los_Angeles", "洛杉矶 · America/Los_Angeles"],
  ["UTC", "协调世界时 · UTC"],
] as const;
const clockOptions = (length: number) => Array.from({ length }, (_, value) => String(value).padStart(2, "0"));
const hours = clockOptions(24);
const minutes = clockOptions(60);

function CoordinateInput({ kind, value, onChange }: {
  kind: "longitude" | "latitude"; value: Coordinate; onChange: (value: Coordinate) => void;
}) {
  const isLongitude = kind === "longitude";
  const label = isLongitude ? "经度" : "纬度";
  return (
    <div className="coordinate-input">
      <div className="select-wrap">
        <select aria-label={label + "方向"} value={value.negative ? "negative" : "positive"}
          onChange={(event) => onChange({ ...value, negative: event.target.value === "negative" })}>
          <option value="positive">{isLongitude ? "东经" : "北纬"}</option>
          <option value="negative">{isLongitude ? "西经" : "南纬"}</option>
        </select><ChevronDown size={14} />
      </div>
      <div className="coordinate-degrees">
        <input aria-label={label + "度数"} type="number" inputMode="decimal" step="any" min="0" max={isLongitude ? 180 : 90}
          placeholder={isLongitude ? "如 120.155" : "如 30.274"} value={value.degrees}
          onChange={(event) => onChange({ ...value, degrees: event.target.value })} />
        <span aria-hidden="true">°</span>
      </div>
    </div>
  );
}

function signedDegrees({ degrees, negative }: Coordinate) {
  if (degrees === "") return undefined;
  const magnitude = Number(degrees);
  return magnitude < 0 ? NaN : magnitude * (negative ? -1 : 1);
}

function coordinateFrom(value?: number): Coordinate {
  return { degrees: value === undefined ? "" : String(Math.abs(value)), negative: value !== undefined && value < 0 };
}

export function BirthForm({ module, busy, timeZones, year, onGenerate }: {
  module: Module; busy: boolean; timeZones: string[]; year: number; onGenerate: (input: BirthInput, withAI: boolean) => Promise<void>;
}) {
  const [calendar, setCalendar] = useState<BirthDate["calendar"]>("solar");
  const [date, setDate] = useState<DateFields>(emptyDate);
  const [leap, setLeap] = useState(false);
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [approximate, setApproximate] = useState(false);
  const [hint, setHint] = useState<(typeof timeHints)[number]>("晚饭后");
  const [sex, setSex] = useState<BirthInput["sex"]>("male");
  const [timeZone, setTimeZone] = useState("");
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [longitude, setLongitude] = useState<Coordinate>(coordinateFrom());
  const [latitude, setLatitude] = useState<Coordinate>(coordinateFrom());
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [withAI, setWithAI] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  const latestYear = Math.min(year, years.max);

  function fillExample() {
    setCalendar(exampleBirth.calendar);
    setDate({ year: String(exampleBirth.year), month: String(exampleBirth.month), day: String(exampleBirth.day) });
    setLeap(exampleBirth.leap);
    const [exampleHour, exampleMinute] = exampleBirth.time.split(":");
    setHour(exampleHour);
    setMinute(exampleMinute);
    setSex(exampleBirth.sex);
    setApproximate(false);
    setTimeZone(exampleBirth.location.timeZone);
    setCountry(exampleBirth.location.country ?? "");
    setProvince(exampleBirth.location.province ?? "");
    setCity(exampleBirth.location.name);
    setLongitude(coordinateFrom(exampleBirth.location.longitude));
    setLatitude(coordinateFrom(exampleBirth.location.latitude));
    setShowCoordinates(true);
    setError("");
  }

  async function changeCalendar(next: BirthDate["calendar"]) {
    if (next === calendar) return;
    setError("");
    if (!date.year || !date.month || !date.day) {
      setCalendar(next);
      setLeap(false);
      if (next === "lunar" && date.day === "31") setDate({ ...date, day: "" });
      return;
    }
    setSwitching(true);
    try {
      const response = await fetch("/api/chart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "calendar", date: { calendar, year: Number(date.year), month: Number(date.month), day: Number(date.day), leap } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDate({ year: String(result.year), month: String(result.month), day: String(result.day) });
      setLeap(result.leap);
      setCalendar(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "换算日期失败，请重试。");
    } finally {
      setSwitching(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!country.trim() || !city.trim()) {
      setError("请输入出生地的国家或地区和城市。");
      return;
    }
    const location = locationSchema.safeParse({
      timeZone, country, province: province.trim() || undefined, name: city,
      longitude: signedDegrees(longitude), latitude: signedDegrees(latitude),
    });
    if (!location.success) {
      setShowCoordinates(true);
      setError("请核对经纬度。经度为 0–180°，纬度为 0–90°。");
      return;
    }
    const birth: BirthInput = {
      calendar, year: Number(date.year), month: Number(date.month), day: Number(date.day), leap: calendar === "lunar" && leap,
      time: approximate ? approximateTimes[timeHints.indexOf(hint)] : hour + ":" + minute,
      ...(approximate ? { hint } : {}), sex, location: location.data,
    };
    try {
      await onGenerate(birth, withAI);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "排盘暂时失败，请重试。");
    }
  }

  return (
    <section className="panel input-panel" aria-labelledby="birth-heading">
      <div className="panel-head">
        <div className="head-group"><span className="head-icon"><ScanLine size={18} /></span><h2 id="birth-heading">生辰录入</h2></div>
        <button type="button" className="text-button" onClick={fillExample} disabled={busy || switching}>填入示例</button>
      </div>
      <form className="birth-form" onSubmit={submit}>
        <fieldset disabled={busy || switching}>
          <legend className="sr-only">出生信息</legend>
          <div className="segmented calendar-toggle" aria-label="历法">
            <button type="button" aria-pressed={calendar === "solar"} onClick={() => void changeCalendar("solar")}>公历</button>
            <button type="button" aria-pressed={calendar === "lunar"} onClick={() => void changeCalendar("lunar")}>农历</button>
          </div>
          <div className="field">
            <label htmlFor="birth-year"><CalendarDays size={15} />出生日期</label>
            <div className="date-fields">
              <div className="select-wrap"><select id="birth-year" aria-label="出生年份" value={date.year} required onChange={(event) => setDate({ ...date, year: event.target.value })}>
                <option value="" disabled>年份</option>
                {Array.from({ length: latestYear - years.min + 1 }, (_, i) => latestYear - i)
                  .map((value) => <option key={value} value={value}>{value}年</option>)}
                {latestYear < years.max && <optgroup label="未来年份">
                  {Array.from({ length: years.max - latestYear }, (_, i) => latestYear + i + 1)
                    .map((value) => <option key={value} value={value}>{value}年</option>)}
                </optgroup>}
              </select><ChevronDown size={14} /></div>
              <div className="select-wrap"><select aria-label="出生月份" value={date.month} required onChange={(event) => setDate({ ...date, month: event.target.value })}>
                <option value="" disabled>月份</option>
                {monthNames.map((month, i) => <option key={month} value={i + 1}>{calendar === "solar" ? i + 1 : month}月</option>)}
              </select><ChevronDown size={14} /></div>
              <div className="select-wrap"><select aria-label="出生日期（日）" value={date.day} required onChange={(event) => setDate({ ...date, day: event.target.value })}>
                <option value="" disabled>日期</option>
                {Array.from({ length: calendar === "solar" ? 31 : 30 }, (_, i) => <option key={i} value={i + 1}>{i + 1}日</option>)}
              </select><ChevronDown size={14} /></div>
            </div>
            {calendar === "lunar" && <label className="check field-help"><input type="checkbox" checked={leap} onChange={(event) => setLeap(event.target.checked)} />这是闰月</label>}
          </div>
          <div className="field">
            <div className="field-top">
              <label htmlFor="birth-hour"><Clock3 size={15} />出生时间</label>
              <button type="button" className="text-button" onClick={() => setApproximate(!approximate)}>{approximate ? "选择准确时间" : "时间不确定？"}</button>
            </div>
            {approximate ? <div className="select-wrap">
              <select id="birth-hour" value={hint} onChange={(event) => setHint(event.target.value as typeof hint)}>
                {timeHints.map((item, index) => <option key={item} value={item}>{item} · 约 {approximateTimes[index]}</option>)}
              </select><ChevronDown size={14} />
            </div> : <div className="time-fields">
              <div className="select-wrap">
                <select id="birth-hour" aria-label="出生时间小时" value={hour} required onChange={(event) => setHour(event.target.value)}>
                  <option value="" disabled>小时</option>
                  {hours.map((value) => <option key={value} value={value}>{value} 时</option>)}
                </select><ChevronDown size={14} />
              </div>
              <div className="select-wrap">
                <select aria-label="出生时间分钟" value={minute} required onChange={(event) => setMinute(event.target.value)}>
                  <option value="" disabled>分钟</option>
                  {minutes.map((value) => <option key={value} value={value}>{value} 分</option>)}
                </select><ChevronDown size={14} />
              </div>
            </div>}
            {approximate && <p className="field-help">取时段代表时间，跨时辰可能影响盘面。</p>}
          </div>
          <fieldset className="field location-field">
            <legend><MapPin size={15} />出生地点</legend>
            <div className="location-input">
              <label htmlFor="birth-zone">时区</label>
              <div className="select-wrap">
                <select id="birth-zone" value={timeZone} required onChange={(event) => setTimeZone(event.target.value)}>
                  <option value="" disabled>选择出生地时区</option>
                  <optgroup label="常用时区">
                    {commonZones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </optgroup>
                  <optgroup label="其他时区">
                    {timeZones.filter((zone) => !commonZones.some(([value]) => zone === value))
                      .map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
                  </optgroup>
                </select><ChevronDown size={14} />
              </div>
            </div>
            <div className="location-fields">
              <div className="location-input">
                <label htmlFor="birth-country">国家 / 地区</label>
                <input id="birth-country" autoComplete="country-name" placeholder="如中国" maxLength={80} required
                  value={country} onChange={(event) => setCountry(event.target.value)} />
              </div>
              <div className="location-input">
                <label htmlFor="birth-province">省份 / 州（选填）</label>
                <input id="birth-province" autoComplete="address-level1" placeholder="如浙江" maxLength={80}
                  value={province} onChange={(event) => setProvince(event.target.value)} />
              </div>
              <div className="location-input">
                <label htmlFor="birth-city">城市</label>
                <input id="birth-city" autoComplete="address-level2" placeholder="如杭州" maxLength={100} required
                  value={city} onChange={(event) => setCity(event.target.value)} />
              </div>
            </div>
            <button type="button" className="coordinate-toggle" aria-expanded={showCoordinates} aria-controls="birth-coordinates"
              onClick={() => setShowCoordinates(!showCoordinates)}>
              <span>补充经纬度（选填）</span><ChevronDown size={14} />
            </button>
            <div className="coordinate-fields" id="birth-coordinates" hidden={!showCoordinates}>
              {showCoordinates && <>
                <CoordinateInput kind="longitude" value={longitude} onChange={setLongitude} />
                <CoordinateInput kind="latitude" value={latitude} onChange={setLatitude} />
              </>}
            </div>
            <p className="field-help"><span className="calibration-dot" data-enabled={longitude.degrees !== ""} />
              {longitude.degrees ? "已填写经度，排盘时校准真太阳时。" : "经度留空时，按当地钟表时间排盘。"}
            </p>
          </fieldset>
          <fieldset className="field sex-field">
            <legend>排盘性别</legend>
            <div className="segmented">
              <button type="button" aria-pressed={sex === "male"} onClick={() => setSex("male")}>男</button>
              <button type="button" aria-pressed={sex === "female"} onClick={() => setSex("female")}>女</button>
            </div>
          </fieldset>
          <label className="check ai-check" title="开启后，结构化盘面会提交给 DeepSeek 生成解读。">
            <input type="checkbox" checked={withAI} onChange={(event) => setWithAI(event.target.checked)} />
            <span>同时使用 DeepSeek 生成解读</span>
          </label>
          <Button className="generate-button" variant="primary" type="submit"><Sparkles size={17} />
            {busy ? "正在排盘…" : module === "bazi" ? "生成八字命盘" : "生成紫微命盘"}
          </Button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </fieldset>
      </form>
    </section>
  );
}
