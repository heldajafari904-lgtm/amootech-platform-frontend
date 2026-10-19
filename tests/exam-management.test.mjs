import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { inExamSection, primaryExamAction, needsExamAction } from '../src/app/counselor/exams/workspace.ts';
import { safeExamReturn } from '../src/components/exams/manualFlow.ts';
const require = createRequire(import.meta.url);
const exam = { id: 1, title: 'آزمون', status: 'READY', student: 1, manage_url: 'https://www.quiz24.ir/manage', updated_at: '2026-10-19T10:00:00Z' };

test('trash is isolated and historical results remain accessible in other sections', () => {
  const trashed = { ...exam, trashed_at: '2026-10-19', result_available: true };
  assert.equal(inExamSection(trashed, 'trash', false), true);
  for (const section of ['all', 'active', 'archive', 'results']) assert.equal(inExamSection(trashed, section, true), false);
  const archived = { ...exam, archived_at: '2026-10-19', result_available: true };
  assert.equal(inExamSection(archived, 'archive', false), true);
  assert.equal(inExamSection(archived, 'active', false), false);
  assert.equal(inExamSection(archived, 'results', false), true);
  assert.equal(primaryExamAction(archived), 'result');
  assert.equal(primaryExamAction(trashed), 'result');
  assert.equal(needsExamAction({ ...archived, status: 'PUBLISHED' }, false), false);
});
test('inactive or provider-locked exams never offer primary content edits or publishing', () => {
  for (const guard of [{ archived_at: 'now' }, { trashed_at: 'now' }, { management_blocked: true }]) {
    for (const status of ['DRAFT', 'READY', 'PUBLISHED']) {
      const item = { ...exam, ...guard, status };
      assert.equal(primaryExamAction(item), null);
      assert.equal(needsExamAction(item, false), false);
    }
  }
});
test('expired login preserves only the UUID edit fence and owned-exam context', () => {
  const id = 'f1ae4eb0-2293-4f47-8372-c08b18edc317';
  assert.equal(safeExamReturn(`/counselor/exams?manual_exam=1&edit_session=${id}&token=secret`), `/counselor/exams?manual_exam=1&edit_session=${id}`);
  assert.equal(safeExamReturn('/counselor/exams?manual_exam=1&edit_session=javascript:alert(1)'), '/counselor/exams?manual_exam=1');
});
function render(data) {
  const source = readFileSync(new URL('../src/app/counselor/exams/ManagementPanel.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} }; let index = 0;
  const localRequire = name => name === 'react' ? { ...React, useState: initial => React.useState(index++ === 0 ? data : initial) }
    : name === '@/lib/api' ? { api: () => { throw new Error('No network'); }, allPages: () => { throw new Error('No network'); } }
    : name === '@/components/counselor/PanelUI' ? { useDialogFocus() {} }
    : name === '@/components/exams/ExamUI' ? { examDate: value => value }
    : name === '@/components/exams/manualFlow' ? {} : require(name);
  new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.default, { examId: 1, token: 'secret-token', userId: 1, onClose() {}, onChanged() {} }));
}
test('management dialog exposes limits, disabled actions and no provider deletion by default', () => {
  const html = render({ exam, busy: false, can_publish: true, can_edit_questions: false, can_unpublish: false, can_remote_delete: false, edit_explanation: 'ویرایش مجاز نیست', reset_explanation: 'بازنشانی پشتیبانی نمی‌شود', operation: null });
  assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/);
  assert.match(html, /ویرایش مجاز نیست/); assert.match(html, /بازنشانی پشتیبانی نمی‌شود/);
  assert.match(html, /تاریخچه مدیریت/); assert.doesNotMatch(html, /حذف دائمی از Quiz24|secret-token|href=/);
  assert.match(html, /disabled=""[^>]*>ویرایش سوال/);
});
test('unknown provider state remains blocked with a reconciliation explanation', () => {
  const html = render({ exam, busy: true, can_remote_delete: false, operation: { kind: 'DELETE', state: 'UNKNOWN', edit_session: null } });
  assert.match(html, /UNKNOWN/); assert.match(html, /درخواست دوباره ارسال نکنید/);
  assert.match(html, /disabled=""[^>]*>انتقال به سطل زباله/);
});
