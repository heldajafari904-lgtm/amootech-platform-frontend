import test from 'node:test';
import assert from 'node:assert/strict';
import {courseDetail,topicNodes} from '../src/components/exams/taxonomy.ts';
import {emptyTopics,toggleTopic,validTopicSelection,topicSummary,selectScope,scopeNodes,scopeBreadcrumbs} from '../src/app/student/exams/questionBank.ts';
import {practicePayload,validCounts} from '../src/app/student/exams/studentExam.ts';
const node=(key,type,parentId,children=[])=>({key,title:`عنوان ${key}`,type,parentId,children});
const tree=courseDetail({result:[node(900,1,null,[node(901,2,900,[node(902,3,901,[node(903,4,902),node(904,4,902)])]),node(910,2,900,[node(911,3,910)])])]},900);
const nodes=topicNodes(tree);
test('multi-topic selections retain actual ancestor IDs and labels',()=>{
 let selection=emptyTopics();
 for(const id of [903,904])selection=toggleTopic(selection,nodes.find(n=>n.id===id),nodes);
 assert.deepEqual(selection,{chapter_ids:[901],subject_ids:[902],object_ids:[903,904]});
 assert.equal(validTopicSelection(selection,nodes),true);
 assert.deepEqual(topicSummary(selection,nodes),['عنوان 901','عنوان 902','عنوان 903','عنوان 904']);
});
test('clearing a parent removes incompatible descendants without widening a forged selection',()=>{
 let selection=toggleTopic(emptyTopics(),nodes.find(n=>n.id===903),nodes);
 selection=toggleTopic(selection,nodes.find(n=>n.id===901),nodes);
 assert.deepEqual(selection,emptyTopics());
 assert.equal(validTopicSelection({chapter_ids:[910],subject_ids:[902],object_ids:[903]},nodes),false);
 assert.equal(validTopicSelection({chapter_ids:[999],subject_ids:[],object_ids:[]},nodes),false);
});
test('stopping at course, chapter or subject remains valid',()=>{
 for(const selection of [emptyTopics(),{chapter_ids:[901],subject_ids:[],object_ids:[]},{chapter_ids:[901],subject_ids:[902],object_ids:[]}])assert.equal(validTopicSelection(selection,nodes),true);
 assert.deepEqual(topicNodes(courseDetail({result:[]},900)),[]);
});
test('provider scope and negative marking survive preview payload construction',()=>{
 const filters={grade_id:700,course_id:900,question_type:1,chapter_ids:[901],subject_ids:[902],object_ids:[903,904]};
 const payload=practicePayload(filters,{easy:'2',medium:'1',hard:'0',very_hard:'0'},' تمرین ',20,true);
 assert.deepEqual(payload.object_ids,[903,904]);assert.equal(payload.has_negative_score,true);assert.equal(payload.grade_external_id,700);assert.equal('student' in payload,false);
});
test('availability is bounded and zero inventory never enables creation',()=>{
 const inventory={easy:2,medium:1,hard:0,very_hard:0};
 assert.equal(validCounts({easy:'2',medium:'1',hard:'0',very_hard:'0'},inventory),true);
 assert.equal(validCounts({easy:'3',medium:'0',hard:'0',very_hard:'0'},inventory),false);
 assert.equal(validCounts({easy:'0',medium:'0',hard:'0',very_hard:'0'},inventory),false);
 assert.equal(validCounts({easy:'1.5',medium:'0',hard:'0',very_hard:'0'},inventory),false);
});

test('ambiguous roots, duplicate topics and conflicting normalized parents are rejected',()=>{
 assert.throws(()=>courseDetail({result:[node(900,1,null),node(910,1,null)]},900));
 assert.throws(()=>courseDetail({result:[node(901,2,900),node(901,2,900)]},900));
 assert.throws(()=>courseDetail({result:{chapters:[{id:901,title:'فصل',subjects:[{id:902,title:'مبحث',chapterId:910}]}]}},900));
 assert.throws(()=>courseDetail({result:{chapters:[{id:901,subjects:[]}]}},900));
 assert.throws(()=>courseDetail({result:[node(901,2,900,[node(902,3,901,[node(903,4,902,[node(904,4,903)])])])]},900));
 const normalized=courseDetail({result:{chapters:[{id:901,title:'فصل',subjects:[{id:902,title:'مبحث',chapterId:901}]}]}},900);
 assert.deepEqual(topicNodes(normalized).map(row=>row.name),['فصل','مبحث']);
});

test('explicit optional scopes replace levels and keep complete ancestors for compatible multi-selection',()=>{
 let selected=emptyTopics();
 selected=selectScope(selected,nodes.find(n=>n.id===901),nodes);
 assert.deepEqual(selected,{chapter_ids:[901],subject_ids:[],object_ids:[]});
 selected=selectScope(selected,nodes.find(n=>n.id===902),nodes);
 assert.deepEqual(selected,{chapter_ids:[901],subject_ids:[902],object_ids:[]});
 selected=selectScope(selected,nodes.find(n=>n.id===903),nodes);
 selected=selectScope(selected,nodes.find(n=>n.id===904),nodes);
 assert.deepEqual(selected,{chapter_ids:[901],subject_ids:[902],object_ids:[903,904]});
 assert.equal(scopeNodes(selected,nodes).length,2);
 assert.deepEqual(scopeBreadcrumbs(selected,nodes),['عنوان 901 > عنوان 902 > عنوان 903','عنوان 901 > عنوان 902 > عنوان 904']);
 selected=selectScope(selected,nodes.find(n=>n.id===910),nodes);
 assert.deepEqual(selected,{chapter_ids:[910],subject_ids:[],object_ids:[]});
});
