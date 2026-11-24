import { cityMapping } from "city-timezones";
import { exampleBirth } from "./example";
import type { BirthLocation } from "./schema";

const localized: Record<string, string> = {
  beijing: "北京", shanghai: "上海", hangzhou: "杭州", guangzhou: "广州", shenzhen: "深圳",
  wuhan: "武汉", chengdu: "成都", chongqing: "重庆", xian: "西安", nanjing: "南京", tianjin: "天津",
  suzhou: "苏州", changsha: "长沙", zhengzhou: "郑州", kunming: "昆明", fuzhou: "福州",
  xiamen: "厦门", qingdao: "青岛", jinan: "济南", hefei: "合肥", nanchang: "南昌", shenyang: "沈阳",
  dalian: "大连", harbin: "哈尔滨", changchun: "长春", taiyuan: "太原", shijiazhuang: "石家庄",
  lanzhou: "兰州", yinchuan: "银川", xining: "西宁", hohhot: "呼和浩特", urumqi: "乌鲁木齐",
  lhasa: "拉萨", nanning: "南宁", haikou: "海口", guiyang: "贵阳", ningbo: "宁波", wuxi: "无锡",
  wenzhou: "温州", foshan: "佛山", dongguan: "东莞", zhuhai: "珠海", taizhou: "台州",
  hongkong: "香港", macau: "澳门", macao: "澳门", taipei: "台北", kaohsiung: "高雄",
  tokyo: "东京", osaka: "大阪", seoul: "首尔", singapore: "新加坡", kualalumpur: "吉隆坡",
  bangkok: "曼谷", jakarta: "雅加达", sydney: "悉尼", melbourne: "墨尔本", auckland: "奥克兰",
  london: "伦敦", paris: "巴黎", berlin: "柏林", moscow: "莫斯科", dubai: "迪拜", toronto: "多伦多",
  vancouver: "温哥华", newyork: "纽约", losangeles: "洛杉矶", sanfrancisco: "旧金山",
  chicago: "芝加哥", boston: "波士顿", seattle: "西雅图",
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\p{M}\p{P}\s]/gu, "").toLowerCase().replace(/市$/, "");
const entries = cityMapping
  .filter((city) => city.timezone && Number.isFinite(city.lng) && Number.isFinite(city.lat))
  .map((city) => {
    const nameKey = normalize(city.city);
    const asciiKey = normalize(city.city_ascii || city.city);
    const alias = localized[nameKey] || localized[asciiKey];
    return {
      name: alias || city.city,
      longitude: city.lng, latitude: city.lat, timeZone: city.timezone,
      region: [city.province, city.country].filter((value) => value && value !== city.city).join(" · "),
      keys: [nameKey, asciiKey, ...(alias ? [alias] : []), normalize(city.city + " " + (city.province || ""))],
      population: city.pop || 0,
    };
  });

export function searchCities(value: string): (BirthLocation & { region?: string })[] {
  const query = normalize(value.trim());
  if (!query) return [exampleBirth.location, ...["北京", "上海", "广州", "成都"].map((name) => searchCities(name)[0]).filter(Boolean)];
  return entries.flatMap((entry) => {
    const rank = Math.min(...entry.keys.map((key) => key === query ? 0 : key.startsWith(query) ? 1 : key.includes(query) ? 2 : 3));
    return rank === 3 ? [] : [{ entry, rank }];
  }).sort((a, b) => a.rank - b.rank || b.entry.population - a.entry.population)
    .slice(0, 8).map(({ entry: { name, longitude, latitude, timeZone, region } }) => ({ name, longitude, latitude, timeZone, region }));
}
