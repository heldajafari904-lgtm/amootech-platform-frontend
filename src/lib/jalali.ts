import * as jalaali from 'jalaali-js';

export const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
export function gregorianToJalali(gy: number, gm: number, gd: number) { return jalaali.toJalaali(gy, gm, gd); }
export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) throw new Error('تاریخ شمسی معتبر نیست.');
  return jalaali.toGregorian(jy, jm, jd);
}
export function jalaliMonthLength(jy: number, jm: number) { return jalaali.jalaaliMonthLength(jy, jm); }
export function formatJalaliShort(jy: number, jm: number, jd: number) { return `${jd} ${JALALI_MONTHS[jm-1]} ${jy}`; }
export const formatJalaliLong = formatJalaliShort;
export const formatJalaliParts = formatJalaliShort;
export function parseISO(iso: string) { const [y,m,d] = iso.split('-').map(Number); return {y,m,d}; }
export function toJalaliParts(iso: string) { const {y,m,d} = parseISO(iso); return gregorianToJalali(y,m,d); }
export function toJalaliString(iso: string) { const {jy,jm,jd} = toJalaliParts(iso); return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`; }
export function jalaliInputToISO(input: string) {
  const text = input.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) throw new Error('تاریخ را به صورت ۱۴۰۵/۰۸/۰۲ وارد کنید.');
  const {gy,gm,gd} = jalaliToGregorian(Number(match[1]),Number(match[2]),Number(match[3]));
  return `${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')}`;
}
