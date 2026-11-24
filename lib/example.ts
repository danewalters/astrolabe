import type { BirthInput, CastInput } from "./schema";

export const exampleBirth: BirthInput = {
  calendar: "solar", year: 1996, month: 8, day: 17, leap: false, time: "14:30", sex: "male",
  location: { country: "中国", province: "浙江", name: "杭州", longitude: 120.155, latitude: 30.274, timeZone: "Asia/Shanghai" },
};

export const exampleCast: CastInput = {
  question: "未来三个月，我是否应该申请内部转岗？",
  lines: [7, 8, 9, 8, 7, 8],
};
