import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as monitoring from '../src/app/counselor/exams/monitoring.ts';
import { examDateTime } from '../src/components/exams/schedule.ts';
const require = createRequire(import.meta.url);
const summary = { assigned: 1, started: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, UNKNOWN: 1 };
function render(state) {
  class Session extends monitoring.MonitoringSession { constructor(...args) { super(...args); this.state = { ...this.state, ...state }; } }
  const source = readFileSync(new URL('../src/app/counselor/exams/MonitoringPanel.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  const localRequire = name => name === './monitoring' ? { ...monitoring, MonitoringSession: Session } : name === '@/lib/api' ? { api: () => { throw new Error('No network in render test'); } } : name === '@/components/exams/schedule' ? { examDateTime } : require(name);
  new Function('require', 'module', 'exports', js)(localRequire, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.default, { examId: 7, token: 'private-token' }));
}
const data = { summary, count: 1, results: [{ student: 1, student_name: 'دانش‌آموز نمونه', status: 'UNKNOWN', last_known_status: 'IN_PROGRESS', started_at: null, completed_at: null, absent: false, warnings: ['اتصال تأییدشده کامل نیست.'], local_attempt: { status: 'PENDING', requested_at: null } }], fresh: false, partial: true, last_success_at: null, availability: { label: 'آماده شرکت' }, error: 'سرویس در دسترس نیست.', next: null, previous: null };
test('loading, manual sync and retry feedback are accessible', () => {
  assert.match(render({}), /در حال دریافت اطلاعات پایش/);
  const html = render({ loading: false, error: 'دسترسی مجاز نیست.' });
  assert.match(html, /role="alert"/); assert.match(html, /بازخوانی پایش/);
});
test('stale partial evidence and local URL issuance stay distinct without scores or provider identifiers', () => {
  const html = render({ loading: false, data });
  assert.match(html, /اطلاعات قدیمی یا تأییدنشده/); assert.match(html, /پوشش سرویس کامل نیست/);
  assert.match(html, /آخرین وضعیت ثبت‌شده/); assert.match(html, /رکورد محلی: درخواست لینک/);
  assert.match(html, /scope="col"/); assert.match(html, /tabindex="0"/);
  assert.match(html, /جستجوی نام/); assert.match(html, /صفحه‌بندی پایش/);
  assert.doesNotMatch(html, /private-token|score|rank|userName|نمره|رتبه/);
});
test('no assignments and filtered empty results are distinguished', () => {
  assert.match(render({ loading: false, data: { ...data, results: [], summary: { ...summary, assigned: 0 } } }), /هنوز دانش‌آموزی برای پایش تخصیص داده نشده/);
  assert.match(render({ loading: false, data: { ...data, results: [] } }), /دانش‌آموزی با این جستجو یا وضعیت پیدا نشد/);
});
