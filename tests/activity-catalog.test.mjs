import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
// Resolve this bundler-style import when running TS directly in Node.
registerHooks({ resolve(specifier, context, nextResolve) {
 return nextResolve(specifier === '../../../../../components/exams/taxonomy' ? `${specifier}.ts` : specifier, context);
}});
const { activityGrades, activityCourses, catalogOptions } = await import('../src/app/counselor/students/[id]/planning/activityCatalog.ts');
import { courseDetail, hierarchySelection } from '../src/components/exams/taxonomy.ts';

// Captured through real Django APIClient routes/serializers in
// planning.tests.test_activity_catalog_contract, with recorded Quiz24 service data.
const contract = JSON.parse(readFileSync(new URL('./fixtures/activity-api-contract.json',import.meta.url)));
const canonical = contract.canonical.results;
const provider = catalogOptions(contract.grades,'grade');
const courses = catalogOptions(contract.courses,'course');
for (const profile of contract.profiles) {
 test(`real StudentSerializer grade ${profile.grade_name}: canonical number, field-specific provider ID and courses`,()=>{
   const grades=activityGrades(canonical,profile,provider);
   assert.deepEqual(grades.map(g=>g.name),['دهم','یازدهم','دوازدهم']);
   assert.deepEqual(grades.map(g=>g.id),[11,21,31]);
   assert.notEqual(profile.grade,canonical.find(g=>g.id===profile.grade).number);
   for (const grade of grades) {
     const children=activityCourses(courses,grade,profile.field_name);
     assert.ok(children.length>0);
     assert.ok(children.every(row=>row.raw.gradeId===grade.id));
     assert.ok(!children.some(row=>row.raw.fieldName && row.raw.fieldName!==profile.field_name));
   }
 });
}
test('real courseDetail and persisted taxonomy keep provider ancestry',()=>{
 const selected=contract.created.taxonomy;
 const hierarchy=hierarchySelection(courseDetail(contract.detail,selected.course),String(selected.chapter),String(selected.subject),String(selected.object));
 assert.equal(hierarchy.valid,true);
 assert.equal(selected.grade,11);
 assert.equal(contract.created.title_is_custom,false);
});
test('missing profile metadata, failed envelopes and empty catalogs remain distinct',()=>{
 assert.throws(()=>activityGrades(canonical,{grade:null},provider),/پایه معتبر/);
 assert.throws(()=>activityGrades(canonical,{grade:1010},provider),/رشته معتبر/);
 assert.throws(()=>activityGrades(canonical,contract.profiles[0],catalogOptions({status:100,result:[]},'grade')),/همگام‌سازی/);
 assert.throws(()=>catalogOptions({status:500,result:[]},'grade'),/معتبر نیست/);
 assert.throws(()=>catalogOptions({detail:'unavailable'},'grade'),/معتبر نیست/);
 assert.throws(()=>catalogOptions({status:100,result:[{id:11}]},'grade'),/معتبر نیست/);
 assert.throws(()=>activityGrades(canonical,contract.profiles[0],catalogOptions({result:[{id:1,title:'نام ناشناخته'}]},'grade')),/تطبیق ندارند/);
});
test('ambiguous or unverified field mappings do not broaden permissions',()=>{
 const profile=contract.profiles[0];
 const grades=activityGrades(canonical,profile,provider);
 assert.deepEqual(activityCourses([{id:9,name:'نامعتبر',raw:{gradeId:grades[0].id,fieldName:'انسانی'}}],grades[0],profile.field_name),[]);
 const generic=activityGrades(canonical,profile,[{id:999,name:'دهم',raw:{id:999,title:'دهم'}}]);
 assert.deepEqual(activityCourses([{id:9,name:'نامعتبر',raw:{gradeId:999}}],generic[0],profile.field_name),[]);
});
