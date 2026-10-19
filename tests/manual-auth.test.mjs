import test from 'node:test';
import assert from 'node:assert/strict';
import { api, saveSession, clearSession, accessToken, onSessionExpired } from '../src/lib/api.ts';
import { rememberManualExam, returnedManualExam, safeExamReturn } from '../src/components/exams/manualFlow.ts';

function environment(t) {
  const previousWindow = globalThis.window, previousStorage = globalThis.sessionStorage;
  const data = new Map();
  globalThis.window = new EventTarget();
  globalThis.sessionStorage = { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  t.after(() => { clearSession('COUNSELOR'); globalThis.window = previousWindow; globalThis.sessionStorage = previousStorage; });
}
const json = (value, status=200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('return after access expiry refreshes in the same tab and syncs the owned exam once', async t => {
  environment(t);
  saveSession('COUNSELOR', { access: 'expired', refresh: 'mock-refresh' });
  rememberManualExam(sessionStorage, 7, 42);
  let syncs = 0, refreshes = 0;
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    if (url.endsWith('/auth/token/refresh/')) { refreshes++; return json({ access: 'renewed' }); }
    if (request.headers.Authorization === 'Bearer expired') return json({}, 401);
    if (url.endsWith('/auth/me/')) return json({ id: 7, role: 'COUNSELOR' });
    if (url.endsWith('/exams/42/sync/')) { syncs++; return json({ id: 42, status: 'READY', question_count: 4 }); }
    throw new Error('Unexpected request');
  });
  const user = await api('/auth/me/', 'expired');
  const id = returnedManualExam('?manual_exam=42', sessionStorage, user.id);
  const exam = await api(`/exams/${id}/sync/`, accessToken('COUNSELOR'), 'POST', {});
  assert.equal(exam.status, 'READY'); assert.equal(refreshes, 1); assert.equal(syncs, 1);
});

test('expired refresh requires login but keeps nonsecret exam context and safe destination', async t => {
  environment(t);
  saveSession('COUNSELOR', { access: 'expired', refresh: 'expired-refresh' });
  rememberManualExam(sessionStorage, 7, 42);
  let expired = 0;
  const unsubscribe = onSessionExpired('COUNSELOR', () => expired++);
  const eventTarget = window;
  t.after(() => { const previous = globalThis.window; globalThis.window = eventTarget; unsubscribe(); globalThis.window = previous; });
  t.mock.method(globalThis, 'fetch', async () => json({}, 401));
  await assert.rejects(api('/auth/me/', 'expired'));
  assert.equal(expired, 1); assert.equal(accessToken('COUNSELOR'), null);
  assert.equal(returnedManualExam('', sessionStorage, 7), 42);
  saveSession('COUNSELOR', { access: 'signed-in-again', refresh: 'new-refresh' });
  assert.equal(safeExamReturn('/counselor/exams?manual_exam=42'), '/counselor/exams?manual_exam=42');
  assert.equal(returnedManualExam('?manual_exam=42', sessionStorage, 7), 42);
  assert.equal(returnedManualExam('', sessionStorage, 8), null);
});
