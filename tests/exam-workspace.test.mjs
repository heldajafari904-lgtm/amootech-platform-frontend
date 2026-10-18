import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyFilters, matchesExamFilters, inExamSection, primaryExamAction, needsExamAction } from '../src/app/counselor/exams/workspace.ts';

const exam = { id: 1, title: 'آزمون فيزيك دهم', student: 7, student_name: 'دانش‌آموز', status: 'DRAFT', question_count: 10, question_type: '1', manage_url: 'https://example.com/manage', duration_minutes: 30 };

test('student, title, status and question type filters combine without mixing assignments', () => {
  const filters = { student: '7', title: 'فیزیک', status: 'DRAFT', questionType: '1' };
  assert.equal(matchesExamFilters(exam, filters), true);
  for (const changed of [{ student: '8' }, { title: 'ریاضی' }, { status: 'READY' }, { questionType: '2' }]) {
    assert.equal(matchesExamFilters(exam, { ...filters, ...changed }), false);
  }
  assert.equal(matchesExamFilters({ ...exam, student: null }, { ...emptyFilters, student: '7' }), false);
  assert.equal(matchesExamFilters(exam, emptyFilters), true);
});

test('sections rely only on actual status or available/loaded result', () => {
  assert.equal(inExamSection(exam, 'active', false), true);
  assert.equal(inExamSection(exam, 'results', false), false);
  assert.equal(inExamSection(exam, 'results', true), true);
  assert.equal(inExamSection({ ...exam, result_available: true }, 'results', false), true);
  assert.equal(inExamSection({ ...exam, status: 'CLOSED' }, 'archive', false), true);
  assert.equal(inExamSection({ ...exam, status: 'CLOSED' }, 'active', false), false);
});

test('primary actions follow state and omit unusable actions', () => {
  assert.equal(primaryExamAction(exam), 'manage');
  assert.equal(primaryExamAction({ ...exam, manage_url: null }), null);
  assert.equal(primaryExamAction({ ...exam, status: 'READY' }), 'publish');
  assert.equal(primaryExamAction({ ...exam, status: 'READY', student: null }), null);
  assert.equal(primaryExamAction({ ...exam, status: 'PUBLISHED' }), 'result');
  assert.equal(primaryExamAction({ ...exam, status: 'CLOSED' }), 'result');
  assert.equal(primaryExamAction({ ...exam, status: 'UNKNOWN' }), null);
});

test('action center omits empty, unavailable and already viewed result tasks', () => {
  assert.equal(needsExamAction(exam, false), true);
  assert.equal(needsExamAction({ ...exam, status: 'READY' }, false), true);
  const published = { ...exam, status: 'PUBLISHED' };
  assert.equal(needsExamAction(published, false), false);
  assert.equal(needsExamAction({ ...published, result_available: true }, false), true);
  assert.equal(needsExamAction({ ...published, result_available: true }, true), false);
  assert.equal(needsExamAction({ ...exam, status: 'CLOSED' }, false), false);
});
