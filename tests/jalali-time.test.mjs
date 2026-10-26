import test from 'node:test';
import assert from 'node:assert/strict';
import {formatJalali,formatJalaliShort,weekdayIndex,weekdayFa,addDaysISO,tehranTodayISO,formatTehranDate,formatJalaliDateTime,sevenDayRange} from '../src/lib/planning.ts';
import {toJalaliString,jalaliInputToISO,jalaliMonthLength} from '../src/lib/jalali.ts';
import {tehranISO,tehranInput} from '../src/components/exams/schedule.ts';

test('Saturday through Friday use the Python API weekday convention',()=>{
 const labels=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
 for(const [index,date] of sevenDayRange('2026-10-24').entries()) {
  assert.equal(weekdayIndex(date),[5,6,0,1,2,3,4][index]);
  assert.equal(weekdayFa(date),labels[index]);
  assert.ok(formatJalaliShort(date).startsWith(labels[index]));
 }
});
test('civil dates and Tehran timestamps stay separate in every device timezone',()=>{
 for(const timezone of ['UTC','Asia/Tehran','America/Los_Angeles','Pacific/Kiritimati']){
  process.env.TZ=timezone;
  assert.equal(toJalaliString('2026-10-24'),'1405/08/02');
  assert.equal(jalaliInputToISO('۱۴۰۵/۰۸/۰۲'),'2026-10-24');
  assert.equal(tehranTodayISO(new Date('2026-10-23T21:00:00Z')),'2026-10-24');
  assert.ok(formatJalaliDateTime('2026-10-23T21:00:00Z').includes('۰۰:۳۰'));
  assert.ok(formatJalaliDateTime('2026-10-23T21:00:00Z').includes('۲'));
  assert.ok(formatJalali('2026-10-24').includes('شنبه'));
  assert.equal(formatTehranDate('2026-10-23T21:00:00Z'),formatTehranDate('2026-10-24T09:00:00Z'));
  assert.notEqual(formatTehranDate('2026-10-23T19:00:00Z'),formatTehranDate('2026-10-23T21:00:00Z'));
  assert.equal(addDaysISO('2026-12-31',1),'2027-01-01');
  assert.equal(tehranISO({date:'2026-10-24',time:'00:30'}),'2026-10-23T21:00:00.000Z');
 }
});
test('Jalali leap year and month/year rollover validate through the library',()=>{
 assert.equal(jalaliMonthLength(1403,12),30);
 assert.equal(jalaliInputToISO('۱۴۰۳/۱۲/۳۰'),'2025-03-20');
 assert.equal(toJalaliString(addDaysISO('2025-03-20',1)),'1404/01/01');
 assert.equal(toJalaliString(addDaysISO(jalaliInputToISO('1405/07/30'),1)),'1405/08/01');
 assert.throws(()=>jalaliInputToISO('1404/12/30'));
 assert.throws(()=>jalaliInputToISO('1405/13/01'));
 assert.throws(()=>weekdayIndex('2026-02-30'));
 assert.equal(tehranInput('2026-10-23T21:00:00Z').date,'2026-10-24');
});
