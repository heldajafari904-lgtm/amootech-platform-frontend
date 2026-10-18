import assert from 'node:assert/strict';
import test from 'node:test';
import { courseDetail, hierarchySelection, options, coursesForGrade } from '../src/components/exams/taxonomy.ts';
import { creationRequest, creationComplete } from '../src/components/exams/creation.ts';
import { practicePayload } from '../src/app/student/exams/studentExam.ts';

const node = (key, type, parentId, children = []) => ({ key, title: `عنوان ${key}`, type, parentId, children });
const response = { status: 100, result: [node(4932, 1, null, [node(4510, 2, 4932, [node(9061, 3, 4510, [node(999, 4, 9061)])]), node(4511, 2, 4932)])] };

test('both builders parse the actual Quiz24 key/title/children tree without displaying the course root', () => {
  const taxonomy = courseDetail(response, 4932);
  const selected = hierarchySelection(taxonomy, '4510', '9061', '999');
  assert.deepEqual(selected.chapters.map(x => x.id), [4510, 4511]);
  assert.deepEqual(selected.subjects.map(x => x.id), [9061]);
  assert.deepEqual(selected.objects.map(x => x.id), [999]);
  assert.equal(selected.subjects[0].name, 'عنوان 9061');
  assert.equal(selected.valid, true);
});

test('parent changes invalidate stale child choices; optional leaf levels may remain empty', () => {
  const taxonomy = courseDetail(response, 4932);
  assert.equal(hierarchySelection(taxonomy, '4511', '9061', '999').valid, false);
  assert.equal(hierarchySelection(taxonomy, '', '9061', '').valid, false);
  assert.equal(hierarchySelection(taxonomy, '4511', '', '').valid, true);
  assert.deepEqual(hierarchySelection(taxonomy, '4511', '', '').subjects, []);
  assert.equal(hierarchySelection(taxonomy, '', '', '').valid, true);
});

test('empty provider topics differ from malformed data and a response for a different course', () => {
  assert.deepEqual(courseDetail({ result: [] }, 4932), { chapters: [] });
  assert.throws(() => courseDetail({ result: {} }, 4932));
  assert.throws(() => courseDetail(response, 999));
  assert.throws(() => courseDetail({ result: [node(4932, 1, null, [node(1, 2, 99)])] }, 4932));
});

test('grade selection filters by external gradeId rather than Amootech or course identifiers', () => {
  const courses = options([{ courseId: 4932, gradeId: 10, courseName: 'دین' }, { courseId: 58, gradeId: 7, courseName: 'ریاضی' }], 'course');
  assert.deepEqual(coursesForGrade(courses, '10').map(x => x.id), [4932]);
  assert.deepEqual(coursesForGrade(courses, '4932'), []);
});

test('student hierarchy selections reach the automatic payload as provider IDs', () => {
  const selected = hierarchySelection(courseDetail(response, 4932), '4510', '9061', '999');
  const payload = practicePayload({ grade_id: 10, course_id: 4932, question_type: 1, chapter_ids: [selected.chapters[0].id], subject_ids: [selected.subjects[0].id], object_ids: [selected.objects[0].id] }, { easy: '1', medium: '0', hard: '0', very_hard: '0' }, 'تمرین', 5);
  assert.deepEqual([payload.grade_external_id, payload.course_id, payload.chapter_ids, payload.subject_ids, payload.object_ids], [10, 4932, [4510], [9061], [999]]);
});

for (const scope of ['counselor', 'student']) test(`${scope} reuses creation key after network failure/reload and rotates after success or changed input`, () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  let i = 0; const uuid = () => `id-${++i}`;
  const payload = { grade_external_id: 10, course_id: 4932, easy_count: 1 };
  const first = creationRequest(payload, storage, scope, uuid);
  assert.equal(creationRequest(payload, storage, scope, uuid).creation_key, first.creation_key);
  assert.notEqual(creationRequest({ ...payload, easy_count: 2 }, storage, scope, uuid).creation_key, first.creation_key);
  creationComplete(storage, scope);
  assert.notEqual(creationRequest(payload, storage, scope, uuid).creation_key, first.creation_key);
});
