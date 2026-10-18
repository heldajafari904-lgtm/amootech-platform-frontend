import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartExam, studentEmptyStates, studentExamInSection, runExclusive, validCounts, practicePayload } from '../src/app/student/exams/studentExam.ts';

import { options, envelope, field } from '../src/components/exams/taxonomy.ts';

const exam = { id: 1, title: 'تمرین', question_count: 5, question_type: '1', duration_minutes: 20, status: 'PUBLISHED' };
const counts = { easy: '2', medium: '1', hard: '0', very_hard: '0' };
const inventory = { easy: 4, medium: 2, hard: 0, very_hard: 0 };

test('practice, active, result and past sections use actual ownership source and state', () => {
  assert.equal(studentExamInSection(exam, 'practice', false), false);
  assert.equal(studentExamInSection({ ...exam, is_personal_practice: true }, 'practice', false), true);
  assert.equal(studentExamInSection(exam, 'active', false), true);
  assert.equal(studentExamInSection({ ...exam, result_available: true }, 'active', false), false);
  assert.equal(studentExamInSection(exam, 'results', true), true);
  assert.equal(studentExamInSection({ ...exam, status: 'CLOSED' }, 'past', false), true);
  assert.equal(studentExamInSection(exam, 'past', true), true);
  assert.equal(studentExamInSection(exam, 'results', false), false);
});

test('only published exams without results can start', () => {
  assert.equal(canStartExam(exam, false), true);
  for (const status of ['CLOSED', 'READY', 'DRAFT', 'UNKNOWN']) assert.equal(canStartExam({ ...exam, status }, false), false);
  assert.equal(canStartExam(exam, true), false);
  assert.equal(canStartExam({ ...exam, result_available: true }, false), false);
});

test('section empty messages remain distinct and useful', () => {
  assert.equal(studentEmptyStates.active, 'آزمون فعالی ندارید.');
  assert.equal(studentEmptyStates.practice, 'هنوز آزمون تمرینی نساخته‌اید.');
  assert.equal(studentEmptyStates.results, 'هنوز نتیجه‌ای ثبت نشده است.');
});

test('free builder preserves provider taxonomy and dependent parent information', () => {
  const response = { result: { chapters: [{ chapterId: 2, chapterName: 'فصل دوم', subjects: [{ subject_id: 3, subject_name: 'حرکت', chapter_id: 2 }] }] } };
  const chapters = options(field(envelope(response), 'chapters'), 'chapter');
  const subjects = options(field(chapters[0].raw, 'subjects'), 'subject');
  assert.equal(chapters[0].name, 'فصل دوم');
  assert.equal(subjects[0].name, 'حرکت');
  assert.equal(field(subjects[0].raw, 'chapterid'), 2);
  assert.deepEqual(options([{ id: -1, name: 'invalid' }], 'course'), []);
});

test('difficulty validation blocks unavailable, excess, negative, fractional and empty totals', () => {
  assert.equal(validCounts(counts, inventory), true);
  assert.equal(validCounts(counts, null), false);
  for (const easy of ['5', '-1', '1.5', '', 'not-a-number']) assert.equal(validCounts({ ...counts, easy }, inventory), false);
  assert.equal(validCounts({ easy: '0', medium: '0', hard: '0', very_hard: '0' }, inventory), false);
});

test('free builder request uses existing automatic contract and never sends owner fields', () => {
  const payload = practicePayload({ grade_id: 1, course_id: 2, question_type: 1, chapter_ids: [3], subject_ids: [4], object_ids: [5], student: 999, counselor: 888 }, counts, ' تمرین من ', 30);
  assert.equal(payload.grade_external_id, 1);
  assert.equal(payload.title, 'تمرین من');
  assert.equal(payload.easy_count, 2);
  assert.equal(payload.duration_minutes, 30);
  assert.deepEqual(payload.object_ids, [5]);
  assert.equal('student' in payload, false);
  assert.equal('counselor' in payload, false);
  assert.equal('grade_id' in payload, false);
});

test('pending creation prevents a second submit and releases lock after success', async () => {
  const lock = { current: false };
  let finish, calls = 0;
  const pending = runExclusive(lock, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(await runExclusive(lock, async () => { calls++; }), false);
  assert.equal(calls, 1);
  finish();
  assert.equal(await pending, true);
  assert.equal(lock.current, false);
});

test('start lock survives successful redirect and releases after a failed request', async () => {
  const lock = { current: false };
  let redirects = 0;
  await runExclusive(lock, async () => { redirects++; }, true);
  await runExclusive(lock, async () => { redirects++; }, true);
  assert.equal(redirects, 1);
  const failedLock = { current: false };
  await assert.rejects(runExclusive(failedLock, async () => { throw new Error('network'); }, true));
  assert.equal(failedLock.current, false);
  assert.equal(await runExclusive(failedLock, async () => {}, true), true);
});
