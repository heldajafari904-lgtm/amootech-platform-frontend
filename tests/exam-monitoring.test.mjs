import assert from 'node:assert/strict';
import test from 'node:test';
import { MonitoringSession, monitoringPath, effectiveMonitoring } from '../src/app/counselor/exams/monitoring.ts';

const data = { count: 1, next: null, previous: null, results: [{ student: 1, student_name: 'دانش‌آموز', status: 'UNKNOWN', last_known_status: 'IN_PROGRESS', warnings: [] }], summary: { assigned: 1, started: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, UNKNOWN: 1 }, fresh: false, partial: true, error: '', last_success_at: null, availability: { label: 'آماده شرکت' } };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('server-side search/filter/page parameters are encoded and never target provider', () => {
  const url = new URL(monitoringPath(7, ' نام & خانوادگی ', 'UNKNOWN', 2), 'https://amootech.test');
  assert.equal(url.pathname, '/exams/7/monitoring/');
  assert.equal(url.searchParams.get('q'), 'نام & خانوادگی');
  assert.equal(url.searchParams.get('status'), 'UNKNOWN'); assert.equal(url.searchParams.get('page'), '2');
});
test('initial GET, empty results and obsolete query responses are handled safely', async () => {
  const slow = deferred(); let count = 0;
  const session = new MonitoringSession(7, async () => ++count === 1 ? slow.promise : { ...data, count: 0, results: [] });
  const old = session.load(); await session.load('new', 'UNKNOWN', 2);
  slow.resolve(data); await old;
  assert.equal(session.state.data.count, 0); assert.equal(session.state.loading, false);
});
test('manual sync has one POST, prevents double submit and refreshes current filtered page', async () => {
  const pending = deferred(); const calls = [];
  const session = new MonitoringSession(7, async (path, method = 'GET') => {
    calls.push({ path, method }); if (method === 'POST') await pending.promise; return data;
  });
  await session.load('نام', 'UNKNOWN', 2);
  const first = session.sync(); await session.sync();
  assert.equal(session.state.syncing, true); assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  pending.resolve(); await first;
  assert.equal(calls.at(-1).path, monitoringPath(7, 'نام', 'UNKNOWN', 2));
  assert.equal(session.state.syncing, false); assert.ok(session.state.notice);
  assert.ok(calls.every(c => c.path.startsWith('/exams/7/monitoring/')));
});
test('provider failure/cooldown errors remain visible while server last-known data is reloaded', async () => {
  for (const error of ['سرویس در دسترس نیست.', 'برای به‌روزرسانی دوباره کمی صبر کنید.', 'دسترسی مجاز نیست.']) {
    const session = new MonitoringSession(7, async (path, method) => { if (method === 'POST') throw new Error(error); return data; });
    await session.load(); await session.sync();
    assert.equal(session.state.error, error); assert.equal(session.state.data.fresh, false);
    assert.equal(session.state.notice, ''); assert.equal(session.state.syncing, false);
  }
});
test('unauthorized GET clears stale rows and unmounted requests cannot publish', async () => {
  const session = new MonitoringSession(7, async () => { throw new Error('دسترسی مجاز نیست.'); });
  await session.load(); assert.equal(session.state.data, null); assert.ok(session.state.error);
  const pending = deferred(); let notifications = 0;
  const late = new MonitoringSession(7, async () => pending.promise);
  late.connect(() => notifications++); const task = late.load(); late.dispose(); pending.resolve(data); await task;
  assert.equal(notifications, 1); assert.equal(late.state.data, null);
});

test('fresh nonterminal evidence expires in the UI without provider polling or false absence', () => {
  const fresh = { ...data, fresh: true, fresh_until: '2030-01-01T12:00:00Z', summary: { assigned: 2, started: 1, NOT_STARTED: 1, IN_PROGRESS: 1, COMPLETED: 0, UNKNOWN: 0 }, results: [{ ...data.results[0], status: 'NOT_STARTED', absent: true }] };
  assert.equal(effectiveMonitoring(fresh, Date.parse('2030-01-01T11:59:59Z')), fresh);
  const expired = effectiveMonitoring(fresh, Date.parse('2030-01-01T12:00:00Z'));
  assert.equal(expired.fresh, false); assert.equal(expired.summary.UNKNOWN, 2);
  assert.equal(expired.results[0].status, 'UNKNOWN'); assert.equal(expired.results[0].absent, false);
  assert.equal(expired.results[0].last_known_status, 'NOT_STARTED');
});
