import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as participants from '../src/app/counselor/exams/participants.ts';

// Render the actual panel without a browser or new test dependencies. Network
// behavior is covered through the same ParticipantSession in the companion tests.
const require = createRequire(import.meta.url);
function render(state = {}, students = [], props = {}) {
  class Session extends participants.ParticipantSession {
    constructor(...args) { super(...args); this.state = { ...this.state, ...state }; }
  }
  const source = readFileSync(new URL('../src/app/counselor/exams/ParticipantPanel.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  const localRequire = name => name === './participants' ? { ...participants, ParticipantSession: Session }
    : name === '@/lib/api' ? { api: () => { throw new Error('No network in rendering tests'); } }
    : name === '@/components/exams/ExamUI' ? { ExamStatusBadge: () => createElement('span', null, 'آماده انتشار') }
    : require(name);
  new Function('require', 'module', 'exports', js)(localRequire, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.default, {
    exam: { id: 7, title: 'آزمون فیزیک', status: 'READY' }, token: 'test-token', students,
    studentsLoading: false, studentError: '', onExam() {}, onCount() {}, onBusyChange() {}, ...props,
  }));
}
const student = id => ({ id, user: { first_name: `دانش‌آموز ${id}`, last_name: '', username: '' } });
const ready = { loading: false, ready: true };

test('loading markup announces progress and disables assignment submission', () => {
  const html = render();
  assert.match(html, /aria-busy="true"/); assert.match(html, /در حال دریافت شرکت‌کنندگان/);
  assert.match(html, /disabled="">افزودن دانش‌آموزان/);
  assert.doesNotMatch(html, /test-token|examCode|provider_exam/);
});
test('empty assignment list and empty counselor roster have distinct explanations', () => {
  const html = render(ready);
  assert.match(html, /هنوز دانش‌آموزی به این آزمون تخصیص داده نشده/);
  assert.match(html, /دانش‌آموزی تحت مسئولیت شما ثبت نشده/);
  assert.match(html, /جستجوی نام دانش‌آموز/);
});
test('assigned student checkbox is marked and disabled; lists render paged compact rows', () => {
  const html = render({ ...ready, assignments: [{ student: 1, student_name: 'اول', assigned_at: '' }], count: 1 }, Array.from({ length: 65 }, (_, i) => student(i + 1)));
  assert.match(html, /قبلاً تخصیص یافته/);
  assert.match(html, /type="checkbox" disabled="" checked=""/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, participants.ROWS_PER_PAGE);
  assert.match(html, /صفحه‌بندی دانش‌آموزان/);
  assert.match(html, />بعدی<\/button>/);
});
test('confirmation and participation errors remain visible with cancellation and retry', () => {
  const html = render({ ...ready, ready: false, pendingRemoval: { student: 1, student_name: 'اول' }, error: 'حذف تخصیص پس از شروع آزمون مجاز نیست.' });
  assert.match(html, /تأیید حذف تخصیص/); assert.match(html, /انصراف/);
  assert.match(html, /role="alert"/); assert.match(html, /پس از شروع آزمون مجاز نیست/);
  assert.match(html, /بازخوانی فهرست/);
});
test('selected summary, clear selection and roster errors are accessible', () => {
  const html = render({ ...ready, selected: [1, 2], notice: 'دانش‌آموزان به آزمون اضافه شدند.' }, [student(1), student(2)]);
  assert.match(html, /aria-live="polite"/); assert.match(html, /پاک‌کردن انتخاب/);
  assert.match(html, /role="status"/); assert.match(html, /دانش‌آموز 1، دانش‌آموز 2/);
  assert.match(render(ready, [], { studentError: 'اجازه دسترسی ندارید.' }), /اجازه دسترسی ندارید/);
  assert.match(render(ready, [], { studentsLoading: true }), /در حال دریافت دانش‌آموزان/);
});
