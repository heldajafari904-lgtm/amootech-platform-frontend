// eslint-disable-next-line @typescript-eslint/no-unused-vars
const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

function isLeapJalali(jy: number): boolean {
  return (((jy - 475) % 2820) + 474 + 38) * 682 % 2816 < 682;
}
function jalaliToJDN(jy: number, jm: number, jd: number): number {
  const epbase = jy - (jy >= 0 ? 474 : 473);
  const epyear = 474 + (epbase % 2820);
  return jd + (jm <= 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) + Math.floor((epyear * 682 - 110) / 2816) + (epyear - 1) * 365 + Math.floor(epbase / 2820) * 1029983 + 1948320;
}
function jdnToJalali(jdn: number): { jy: number; jm: number; jd: number } {
  const depoch = jdn - jalaliToJDN(475, 1, 1);
  const cycle = Math.floor(depoch / 1029983);
  const cyear = depoch % 1029983;
  let ycycle: number;
  if (cyear === 1029982) ycycle = 2820;
  else {
    const aux1 = Math.floor(cyear / 366);
    const aux2 = cyear % 366;
    ycycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
  }
  let jy = ycycle + 2820 * cycle + 474;
  if (jy <= 0) jy--;
  const jdn1f = jalaliToJDN(jy, 1, 1);
  let k = jdn - jdn1f;
  let jm: number, jd: number;
  if (k < 186) { jm = 1 + Math.floor(k / 31); jd = 1 + (k % 31); } else { k -= 186; jm = 7 + Math.floor(k / 30); jd = 1 + (k % 30); }
  return { jy, jm, jd };
}
function gregorianToJDN(gy: number, gm: number, gd: number): number {
  const d = Math.floor((gy + (gm - 8) / 6 + 100100) * 1461 / 4) + Math.floor((153 * ((gm + 9) % 12) + 2) / 5) + gd - 34840408;
  return d - Math.floor(Math.floor((gy + 100100 + (gm - 8) / 6) / 100) * 3 / 4) + 752;
}
function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + Math.floor(Math.floor((4 * jdn + 183187720) / 146097) * 3 / 4 * 4 - 3908);
  const i = Math.floor((j % 1461) / 4) * 5 + 308;
  const gd = Math.floor((i % 153) / 5) + 1;
  const gm = (Math.floor(i / 153) % 12) + 1;
  const gy = Math.floor(j / 1461) - 100100 + Math.floor((8 - gm) / 6);
  return { gy, gm, gd };
}
export function gregorianToJalali(gy: number, gm: number, gd: number) { return jdnToJalali(gregorianToJDN(gy, gm, gd)); }
export function jalaliToGregorian(jy: number, jm: number, jd: number) { return jdnToGregorian(jalaliToJDN(jy, jm, jd)); }
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}
export const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
export function formatJalaliShort(jy: number, jm: number, jd: number): string { return `${jd} ${JALALI_MONTHS[jm-1]} ${jy}`; }

// For display: ISO string -> jalali parts
export function parseISO(iso: string): { y:number; m:number; d:number } {
  const [y,m,d] = iso.split("-").map(Number);
  return { y,m,d };
}
