import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBasket,newEntry,entryKey,editEntry,toggleNode,filters,restoreBasket,total,countsValid,reportContext,creationPayload} from '../src/components/exams/selectionBasket.ts';
const node=(course,chapter,id=chapter,level='chapter',subject)=>({id,level,label:`مبحث ${id}`,path:{course,chapter,...(subject?{subject}:{}),...(level==='object'?{object:id}:{})}});
test('three grades/courses, counts and exact scope survive switching and session restoration',()=>{
 let basket=emptyBasket();
 for(const [grade,course] of [[10,100],[11,110],[12,120]]) {
  const entry=toggleNode(newEntry(grade,course,`پایه ${grade}`,`درس ${course}`),node(course,course+1));
  const key=entryKey(entry);basket={...basket,grade:String(grade),active:key,entries:{...basket.entries,[key]:entry}};
  basket=editEntry(basket,key,{counts:{easy:String(grade),medium:'0',hard:'0',very_hard:'0'}});
 }
 basket={...basket,grade:'10',active:'10:100'};
 const restored=restoreBasket(JSON.stringify(basket));
 assert.equal(Object.keys(restored.entries).length,3);
 assert.equal(total(restored.entries['10:100']),10);
 assert.deepEqual(filters(restored.entries['10:100']).chapter_ids,[101]);
 assert.equal(Object.values(restored.entries).reduce((sum,e)=>sum+total(e),0),33);
 const changed=editEntry(restored,'11:110',{counts:{easy:'2',medium:'3',hard:'1',very_hard:'0'}});
 assert.deepEqual(changed.entries['11:110'].topics,restored.entries['11:110'].topics);
 assert.deepEqual(changed.entries['10:100'],restored.entries['10:100']);
 delete changed.entries['11:110'];assert.equal(Object.keys(restoreBasket(JSON.stringify(changed)).entries).length,2);
});
test('explicit descendants replace ancestors; overlapping scopes cannot double count',()=>{
 let entry=toggleNode(newEntry(10,100,'دهم','فیزیک'),node(100,1));
 entry=toggleNode(entry,node(100,1,3,'object',2));
 assert.deepEqual(filters(entry),{grade_id:10,course_id:100,chapter_ids:[1],subject_ids:[2],object_ids:[3],question_type:1,consider_used_question:false});
 entry=toggleNode(entry,node(100,1,4,'object',2));
 assert.deepEqual(filters(entry).object_ids,[3,4]);
 entry=toggleNode(entry,node(100,5));assert.throws(()=>filters(entry),/یک سطح/);
 entry=toggleNode(entry,node(100,5));assert.deepEqual(filters(entry).object_ids,[3,4]);
 assert.throws(()=>toggleNode(entry,node(999,1)),/این درس/);
});
test('report sources deduplicate occurrences and retain exact revision and requested scope',()=>{
 const ref={report_item_id:8,source_revision:'a'.repeat(64)};
 let entry=newEntry(10,100,'دهم','فیزیک',true);
 entry=toggleNode(entry,{...node(100,1,3,'object',2),sources:[ref]});
 entry=toggleNode(entry,{...node(100,1,4,'object',2),sources:[ref]});
 assert.deepEqual(reportContext(entry).sources,[ref]);
 assert.deepEqual(reportContext(entry).topics,[{level:'object',id:3},{level:'object',id:4}]);
 assert.deepEqual(creationPayload(entry).object_ids,[3,4]);
 entry.topics[1].sources=[{...ref,source_revision:'b'.repeat(64)}];
 assert.throws(()=>reportContext(entry),/نسخه/);
});
test('invalid quantities and malformed stored drafts fail safely without clearing valid drafts',()=>{
 let entry={...newEntry(10,100,'دهم','فیزیک'),wholeCourse:true};
 const inventory={easy:2,medium:1,hard:0,very_hard:0};
 assert.equal(countsValid(entry,inventory),false);
 entry.counts.easy='2';assert.equal(countsValid(entry,inventory),true);
 entry.counts.easy='3';assert.equal(countsValid(entry,inventory),false);
 entry.counts.easy='-1';assert.equal(total(entry),0);
 const basket={...emptyBasket(),entries:{'10:100':entry}};
 assert.equal(restoreBasket(JSON.stringify(basket)).entries['10:100'].counts.easy,'-1');
 for(const change of [{questionType:3},{gradeId:-1},{counts:{}},{wholeCourse:'yes'},{topics:[{id:3,level:'object',label:'خراب'}]}]) {
  assert.throws(()=>restoreBasket(JSON.stringify({...basket,entries:{'10:100':{...entry,...change}}})),/معتبر/);
 }
 assert.deepEqual(restoreBasket(null),emptyBasket());
});
