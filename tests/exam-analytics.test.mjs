import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsSession, analyticsPath, resultNumber, effectiveAnalytics } from '../src/app/counselor/exams/analytics.ts';
const data = { count: 1, results: [{ student: 1, student_name: 'دانش‌آموز', score: 80, group_rank: 1, provider_rank: 7, quiz24_balance: null, verified_at: '2030-01-01T12:00:00Z', stale: false }], metrics: { valid_scored: 1 }, fresh: true, fresh_until: '2030-01-01T12:05:00Z', last_error_count: 0 };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('API query/filter/order/page are server parameters; absent metrics differ from zero', () => {
  const url = new URL(analyticsPath(7, ' نام & نام ', 'SCORED', 'score_asc', 2), 'https://amootech.test');
  assert.equal(url.searchParams.get('q'), 'نام & نام'); assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('ordering'), 'score_asc'); assert.equal(url.searchParams.get('status'), 'SCORED');
  assert.equal(resultNumber(null), '—'); assert.notEqual(resultNumber(0), '—');
});
test('obsolete loads and disposed panels cannot overwrite current filtered results', async () => {
  const pending = deferred(); let calls = 0;
  const session = new AnalyticsSession(7, async () => ++calls === 1 ? pending.promise : { ...data, results: [] });
  const old = session.load(); await session.load('new'); pending.resolve(data); await old;
  assert.deepEqual(session.state.data.results, []);
  const late = deferred(); const other = new AnalyticsSession(7, async () => late.promise);
  const task = other.load(); other.dispose(); late.resolve(data); await task;
  assert.equal(other.state.data, null);
});
test('bounded group refresh is single-flight and reloads latest server-filtered page', async () => {
  const pending = deferred(); const calls = [];
  const session = new AnalyticsSession(7, async (path, method = 'GET') => { calls.push({ path, method }); if (method === 'POST') await pending.promise; return data; });
  await session.load('name', 'SCORED', 'name', 2);
  const first = session.sync(); await session.sync();
  assert.equal(calls.filter(row => row.method === 'POST').length, 1);
  pending.resolve(); await first;
  assert.equal(calls.at(-1).path, analyticsPath(7, 'name', 'SCORED', 'name', 2));
  assert.equal(session.state.syncing, false); assert.ok(session.state.notice);
  assert.ok(calls.every(row => !/provider|automatic|start/.test(row.path)));
});
test('provider/cooldown failure preserves error and reloads server cached evidence', async () => {
  for (const error of ['سرویس در دسترس نیست.', 'برای دریافت دوباره نتایج یک دقیقه فاصله لازم است.']) {
    const session = new AnalyticsSession(7, async (path, method) => { if (method === 'POST') throw new Error(error); return data; });
    await session.load(); await session.sync();
    assert.equal(session.state.error, error); assert.equal(session.state.data.results[0].score, 80);
    assert.equal(session.state.notice, ''); assert.equal(session.state.syncing, false);
  }
});
test('individual drilldown uses only the selected-student existing result GET', async () => {
  const calls = [];
  const session = new AnalyticsSession(7, async (...args) => { calls.push(args); return { score: 80, answers: [] }; });
  await session.detail(12); assert.deepEqual(calls, [['/exams/7/result/?student=12']]);
});
test('cached scores/ranks are retained while freshness expires locally', () => {
  const expired = effectiveAnalytics(data, Date.parse('2030-01-01T12:05:00Z'));
  assert.equal(expired.fresh, false); assert.equal(expired.results[0].stale, true);
  assert.equal(expired.results[0].score, 80); assert.equal(expired.results[0].group_rank, 1);
});
