import test from 'node:test';
import assert from 'node:assert/strict';
import { examId, rememberManualExam, pendingManualExam, returnedManualExam, clearManualExam, safeExamReturn, safePDFUrl } from '../src/components/exams/manualFlow.ts';
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; };
test('callback context survives expired login and contains no credentials', () => {
  const s = storage(); rememberManualExam(s, 7, 42);
  assert.equal(returnedManualExam('?manual_exam=42', s, 7), 42);
  assert.equal(safeExamReturn('/counselor/exams?manual_exam=42'), '/counselor/exams?manual_exam=42');
  assert.equal(returnedManualExam('', s, 7), 42);
  assert.equal(returnedManualExam('?manual_exam=42', storage(), 7), 42);
});
test('missing callback query falls back only to the current counselor pending exam', () => {
  const s = storage(); rememberManualExam(s, 7, 42);
  assert.equal(pendingManualExam(s, 8), null);
  assert.equal(returnedManualExam('', storage(), 7), null);
  clearManualExam(s, 8, 42); assert.equal(pendingManualExam(s, 7), 42);
  clearManualExam(s, 7, 42); assert.equal(pendingManualExam(s, 7), null);
});
test('untrusted callback and login destinations cannot become arbitrary redirects', () => {
  for (const v of ['https://evil.test/counselor/exams', '//evil.test/counselor/exams', '/student/exams', '/counselor/exams/../../admin', 'javascript:alert(1)']) assert.equal(safeExamReturn(v), null);
  for (const v of [null, '0', '-1', '1.5', 'NaN', '9999999999999999999999']) assert.equal(examId(v), null);
  assert.equal(safeExamReturn('/counselor/exams?next=https://evil.test&manual_exam=42'), '/counselor/exams?manual_exam=42');
});
test('PDF links accept only absolute web URLs, not scripts or unverified relative paths', () => {
  assert.equal(safePDFUrl('javascript:alert(1)'), null);
  assert.equal(safePDFUrl('questions.pdf'), null);
  assert.equal(safePDFUrl('https://example.test/questions.pdf'), 'https://example.test/questions.pdf');
});
