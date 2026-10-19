import assert from 'node:assert/strict';
import test from 'node:test';
import { ParticipantSession, searchStudents, selectStudents, MAX_ASSIGNMENTS, ROWS_PER_PAGE } from '../src/app/counselor/exams/participants.ts';

const students = [
  { id: 1, user: { first_name: 'علي', last_name: 'كريمي', username: 'a' } },
  { id: 2, user: { first_name: '', last_name: '', username: 'student-two' } },
];
const assignment = { student: 1, student_name: 'علی کریمی', assigned_at: '2026-10-18' };
const exam = { id: 7, title: 'آزمون مشترک', assignment_count: 1, student: 1 };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(options = {}) {
  const calls = [], exams = [], counts = [];
  let rows = options.rows ?? [assignment];
  const request = async (path, method = 'GET', body) => {
    calls.push({ path, method, body });
    if (method !== 'GET') {
      if (options.failure) throw new Error(options.failure);
      await options.wait;
      rows = method === 'POST' ? [...rows, ...body.student_ids.map(student => ({ student, student_name: `student-${student}`, assigned_at: '' }))] : rows.filter(r => !body.student_ids.includes(r.student));
      return { assignment_count: rows.length };
    }
    if (options.refreshFailure && counts.length) throw new Error('بازخوانی ناموفق');
    if (path.endsWith('assignments/')) return { results: rows, next: null };
    return { ...exam, assignment_count: rows.length, student: rows.some(r => r.student === 1) ? 1 : null };
  };
  const session = new ParticipantSession(7, request, value => exams.push(value), value => counts.push(value));
  return { session, calls, exams, counts };
}

test('Persian name search normalizes Arabic letters and falls back to username', () => {
  assert.deepEqual(searchStudents(students, 'علی کریمی').map(s => s.id), [1]);
  assert.deepEqual(searchStudents(students, 'student-two').map(s => s.id), [2]);
  assert.equal(searchStudents(students, 'هیچ').length, 0);
});
test('filtered selection excludes existing assignments, deduplicates and respects atomic batch limit', () => {
  assert.deepEqual(selectStudents([2], [1, 2, 3], [assignment]), [2, 3]);
  const many = Array.from({ length: 500 }, (_, i) => i + 1);
  assert.equal(selectStudents([], many, []).length, MAX_ASSIGNMENTS);
  assert.equal(ROWS_PER_PAGE, 30);
});
test('loading blocks writes; successful multi-assignment refreshes server details and list', async () => {
  const { session, calls, exams, counts } = harness();
  assert.equal(session.state.loading, true);
  session.select([2]); await session.save('POST'); assert.equal(calls.length, 0);
  await session.load(); session.select([1, 2, 3, 3]);
  assert.deepEqual(session.state.selected, [2, 3]);
  await session.save('POST');
  assert.deepEqual(calls.find(c => c.method === 'POST'), { path: '/exams/7/assignments/', method: 'POST', body: { student_ids: [2, 3] } });
  assert.equal(session.state.count, 3); assert.equal(session.state.assignments.length, 3);
  assert.equal(exams.at(-1).assignment_count, 3); assert.deepEqual(counts, [3]);
  assert.deepEqual(session.state.selected, []); assert.match(session.state.notice, /اضافه شدند/);
  assert.ok(calls.every(c => !/automatic|provider|create/.test(c.path)));
});
test('duplicate submissions are locked until mutation and refresh finish', async () => {
  const pending = deferred(); const { session, calls } = harness({ wait: pending.promise });
  await session.load(); session.select([2]); const saving = session.save('POST');
  assert.equal(session.state.busy, true); await session.save('POST');
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  pending.resolve(); await saving; assert.equal(session.state.busy, false);
});
test('DELETE requires explicit confirmation and uses the JSON student_ids contract', async () => {
  const { session, calls, exams } = harness(); await session.load();
  await session.save('DELETE'); assert.equal(calls.filter(c => c.method === 'DELETE').length, 0);
  session.confirmRemoval(assignment); session.confirmRemoval(null); await session.save('DELETE');
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 0);
  session.confirmRemoval(assignment); await session.save('DELETE');
  assert.deepEqual(calls.find(c => c.method === 'DELETE').body, { student_ids: [1] });
  assert.equal(session.state.count, 0); assert.deepEqual(session.state.assignments, []);
  assert.equal(exams.at(-1).student, null);
});
test('participation and permission errors remain precise, without success or optimistic deletion', async () => {
  for (const failure of ['حذف تخصیص پس از شروع آزمون مجاز نیست.', 'شناسه نامعتبر یا دانش‌آموز خارج از مسئولیت شماست.', 'فقط مشاور مالک آزمون مجاز است.']) {
    const { session, counts } = harness({ failure }); await session.load(); session.confirmRemoval(assignment);
    await session.save('DELETE'); assert.equal(session.state.error, failure);
    assert.equal(session.state.assignments.length, 1); assert.deepEqual(counts, []);
    assert.equal(session.state.notice, ''); assert.equal(session.state.ready, false);
    await session.load(); assert.equal(session.state.ready, true);
  }
});
test('successful mutation followed by refresh failure preserves success and requires refresh before more writes', async () => {
  const { session, counts } = harness({ refreshFailure: true });
  await session.load(); session.select([2]); await session.save('POST');
  assert.deepEqual(counts, [2]); assert.equal(session.state.count, 2);
  assert.match(session.state.notice, /اضافه شدند/); assert.match(session.state.error, /تغییر ثبت شد/);
  assert.equal(session.state.ready, false);
});
test('empty roster/assignment list and obsolete responses are handled without stale callbacks', async () => {
  const empty = harness({ rows: [] }); await empty.session.load();
  assert.equal(empty.session.state.count, 0); assert.deepEqual(empty.session.state.assignments, []);
  const pending = deferred(); const late = harness({ wait: pending.promise });
  await late.session.load(); late.session.select([2]); const task = late.session.save('POST');
  late.session.dispose(); pending.resolve(); await task;
  assert.deepEqual(late.counts, []); assert.equal(late.exams.length, 1);
});
test('assignment pagination is followed and a slower load cannot replace the latest snapshot', async () => {
  const pending = deferred(); let generation = 0; const exams = [];
  const session = new ParticipantSession(7, async path => {
    if (path.endsWith('/7/')) return { ...exam, assignment_count: ++generation };
    if (generation === 1) return pending.promise;
    if (path === '/next') return { results: [{ ...assignment, student: 2 }], next: null };
    return { results: [assignment], next: '/next' };
  }, e => exams.push(e), () => {});
  const first = session.load(); await session.load();
  pending.resolve({ results: [], next: null }); await first;
  assert.equal(session.state.assignments.length, 2); assert.equal(exams.length, 1);
});
