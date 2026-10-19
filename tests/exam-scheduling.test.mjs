import assert from 'node:assert/strict';
import test from 'node:test';
import { tehranInput, tehranISO, examDateTime, scheduleDraft, schedulePayload, participationMessage } from '../src/components/exams/schedule.ts';
import { canStartExam, studentExamInSection, runExclusive } from '../src/app/student/exams/studentExam.ts';
const exam = { id: 1, title: 'زمان‌بندی', status: 'PUBLISHED' };
const availability = code => ({ code, can_start: code === 'AVAILABLE', results_released: true, label: code });

test('Tehran wall time converts to UTC and back independently of host timezone', () => {
  const iso = tehranISO({ date: '2030-05-01', time: '12:30' });
  assert.equal(iso, '2030-05-01T09:00:00.000Z');
  assert.deepEqual(tehranInput(iso), { date: '2030-05-01', time: '12:30:00' });
  assert.deepEqual(tehranInput('2030-04-30T21:00:00Z'), { date: '2030-05-01', time: '00:30:00' });
  assert.notEqual(examDateTime(iso), 'تعیین نشده');
});
test('empty schedule clears nullable fields; incomplete and impossible dates are rejected', () => {
  assert.deepEqual(schedulePayload(scheduleDraft({})), { scheduled_start_at: null, participation_deadline_at: null, result_release_at: null });
  for (const input of [{ date: '2030-05-01', time: '' }, { date: '', time: '12:30' }, { date: '2030-02-30', time: '12:30' }, { date: '2030-05-01', time: '24:01' }]) assert.throws(() => tehranISO(input));
});
test('schedule payload contains only ISO scheduling fields and preserves roundtrip times', () => {
  const data = { scheduled_start_at: '2030-05-01T09:00:30Z', participation_deadline_at: '2030-05-01T10:00:00Z', result_release_at: '2030-05-01T10:30:00Z' };
  const payload = schedulePayload(scheduleDraft(data));
  for (const key of Object.keys(data)) assert.equal(Date.parse(payload[key]), Date.parse(data[key]));
  assert.equal(Object.keys(payload).length, 3);
});
test('upcoming published exams stay visible, expired windows move to past, only available exams start', () => {
  for (const code of ['UPCOMING', 'DEADLINE_PASSED', 'CLOSED', 'UNAVAILABLE']) assert.equal(canStartExam({ ...exam, availability: availability(code) }, false), false);
  assert.equal(canStartExam({ ...exam, availability: availability('AVAILABLE') }, false), true);
  assert.equal(canStartExam(exam, false), true);
  assert.equal(studentExamInSection({ ...exam, availability: availability('UPCOMING') }, 'active', false), true);
  assert.equal(studentExamInSection({ ...exam, availability: availability('DEADLINE_PASSED') }, 'active', false), false);
  assert.equal(studentExamInSection({ ...exam, availability: availability('DEADLINE_PASSED') }, 'past', false), true);
  assert.equal(participationMessage({ availability: availability('UPCOMING') }), 'آزمون هنوز شروع نشده است.');
  assert.equal(participationMessage({ availability: availability('DEADLINE_PASSED') }), 'مهلت شرکت در آزمون به پایان رسیده است.');
});
test('double start uses existing submission lock and unlocks on scheduling rejection', async () => {
  const lock = { current: false }; let reject; let calls = 0;
  const task = () => { calls++; return new Promise((_, r) => { reject = r; }); };
  const first = runExclusive(lock, task, true);
  assert.equal(await runExclusive(lock, task, true), false);
  reject(new Error('آزمون هنوز شروع نشده است.'));
  await assert.rejects(first, /هنوز شروع/); assert.equal(calls, 1); assert.equal(lock.current, false);
});
