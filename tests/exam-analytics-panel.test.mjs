import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as analytics from '../src/app/counselor/exams/analytics.ts';
import { examDateTime } from '../src/components/exams/schedule.ts';
const require = createRequire(import.meta.url);
function render(state) {
  class Session extends analytics.AnalyticsSession { constructor(...args) { super(...args); this.state = { ...this.state, ...state }; } }
  const source = readFileSync(new URL('../src/app/counselor/exams/AnalyticsPanel.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  const localRequire = name => name === './analytics' ? { ...analytics, AnalyticsSession: Session } : name === '@/lib/api' ? { api: () => { throw new Error('No network in render test'); } } : name === '@/components/exams/schedule' ? { examDateTime } : name === '@/components/exams/ExamUI' ? { ResultDetails: () => createElement('div') } : require(name);
  new Function('require', 'module', 'exports', js)(localRequire, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.default, { examId: 7, token: 'private-token' }));
}
const metrics = { assigned: 1, completed: 1, valid_scored: 1, participation_percentage: 100, average_score: 80, median_score: 80, highest_score: 80, lowest_score: 80, average_quiz24_balance: null, balance_contributors: 0, answer_counts: {}, distribution: [{ lower: 80, upper: 80, count: 1, upper_inclusive: true }] };
const data = { count: 1, results: [{ student: 1, student_name: 'دانش‌آموز نمونه', score: 80, quiz24_balance: null, group_rank: 1, provider_rank: 7, provider_rank_in_class: 3, status: 'SCORED', stale: true, verified_at: null, details_available: true }], metrics, score_scale: { label: 'نمره خام Quiz24؛ مقیاس اعلام نشده' }, ranking: { provisional: true }, fresh: false, partial: false, last_success_at: null, remaining_in_cycle: 0, last_error_count: 0 };
test('separate ranking/Balance labels, no fake zero, local distribution and accessible drilldown', () => {
  const html = render({ loading: false, data });
  for (const label of ['رتبه گروه آموزتک', 'رتبه Quiz24', 'رتبه کلاس Quiz24', 'Balance در Quiz24', 'رتبه‌بندی گروه موقت', 'کارنامه فردی', 'نتیجه مفقود، صفر نیست']) assert.match(html, new RegExp(label));
  assert.match(html, /<meter/); assert.match(html, /scope="col"/); assert.match(html, /tabindex="0"/);
  assert.match(html, /—/); assert.doesNotMatch(html, /private-token|provider_exam/);
});
test('loading, errors and zero-result exams have clear explanations', () => {
  assert.match(render({}), /در حال دریافت نتایج و تحلیل/);
  assert.match(render({ loading: false, error: 'دسترسی مجاز نیست.' }), /role="alert"/);
  const empty = render({ loading: false, data: { ...data, results: [], metrics: { ...metrics, valid_scored: 0, distribution: [] } } });
  assert.match(empty, /هنوز نمره قابل مقایسه‌ای/); assert.match(empty, /دانش‌آموزی با این وضعیت یا جستجو موجود نیست/);
});
