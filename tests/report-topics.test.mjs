import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleConfirmed,topicFilters,suggestedDrafts,sourceReferences,validPreview} from '../src/app/student/exams/reportTopics.ts';
const nodes=[{id:1,level:'chapter',chapter:1},{id:2,level:'subject',chapter:1,subject:2},
 {id:3,level:'object',chapter:1,subject:2},{id:4,level:'object',chapter:1,subject:2},
 {id:5,level:'chapter',chapter:5},{id:6,level:'subject',chapter:5,subject:6},{id:7,level:'object',chapter:5,subject:6}];
test('selecting a chapter never marks children studied and refining replaces the parent',()=>{
 let topics=toggleConfirmed([],nodes[0],nodes);
 assert.deepEqual(topics,[{level:'chapter',id:1}]);
 topics=toggleConfirmed(topics,nodes[2],nodes);
 assert.deepEqual(topics,[{level:'object',id:3}]);
 topics=toggleConfirmed(topics,nodes[3],nodes);
 assert.deepEqual(topicFilters(topics,nodes),{chapter_ids:[1],subject_ids:[2],object_ids:[3,4]});
 topics=toggleConfirmed(topics,nodes[0],nodes);
 assert.deepEqual(topics,[{level:'chapter',id:1}]);
});
test('objects from different branches retain complete actual ancestors',()=>{
 assert.deepEqual(topicFilters([{level:'object',id:3},{level:'object',id:7}],nodes),{chapter_ids:[1,5],subject_ids:[2,6],object_ids:[3,7]});
});
test('course groups preserve manual drafts without treating suggestions as confirmations',()=>{
 const sources=[{report_item_id:10,resolution:{suggestion:{grade_id:700,course_id:900,topics:[{level:'chapter',id:1}]}}},
 {report_item_id:11,resolution:{suggestion:{grade_id:701,course_id:910,topics:[{level:'object',id:7}]}}},
 {report_item_id:12,resolution:{suggestion:null}}];
 const first=suggestedDrafts(sources);
 assert.deepEqual(first['700:900'],{sources:[10],topics:[]});
 first['700:900'].topics=[{level:'object',id:3}];
 assert.deepEqual(suggestedDrafts(sources,first)['700:900'].topics,[{level:'object',id:3}]);
 assert.deepEqual(first['701:910'].sources,[11]);
});
test('source references preserve report revision and omit owner authority',()=>{
 assert.deepEqual(sourceReferences([{report_item_id:10,source_revision:'abc',student_id:999}]),[{report_item_id:10,source_revision:'abc'}]);
});
test('preview inventory requires normalized bounded nonnegative integers and a course scope',()=>{
 const preview={schema_version:1,course_scoped:true,exam_created:false,selected_topics:[{id:3,level:'object'}],availability:{easy:2,medium:0,hard:0,very_hard:0},warnings:[]};
 assert.equal(validPreview(preview),true);
 for(const bad of [{...preview,availability:{}},{...preview,availability:{...preview.availability,easy:-1}},
 {...preview,course_scoped:false},{...preview,exam_created:true},{...preview,selected_topics:[]}])assert.equal(validPreview(bad),false);
});

const {reportContext,selectReportTopic,safeExamLink}=await import('../src/app/student/exams/reportBuilder.ts');
test('report groups deduplicate source occurrences and preserve exact explicit selections',()=>{
 const refs=[{report_item_id:10,source_revision:'a'},{report_item_id:11,source_revision:'b'}];
 const group={grade_id:700,course_id:900,topics:[
  {level:'subject',id:2,path:{course:900,chapter:1,subject:2},sources:refs},
  {level:'object',id:3,path:{course:900,chapter:1,subject:2,object:3},sources:refs},
  {level:'object',id:4,path:{course:900,chapter:1,subject:2,object:4},sources:[refs[0]]}]};
 assert.deepEqual(reportContext(group,[]).sources,[]);
 let selected=selectReportTopic([],group.topics[0],group.topics);
 selected=selectReportTopic(selected,group.topics[1],group.topics);
 assert.deepEqual(selected,[{level:'object',id:3}]);
 selected=selectReportTopic(selected,group.topics[2],group.topics);
 assert.deepEqual(reportContext(group,selected).sources,refs);
 assert.deepEqual(reportContext(group,selected).topics,[{level:'object',id:3},{level:'object',id:4}]);
 assert.throws(()=>safeExamLink('javascript:alert(1)'));
 assert.equal(safeExamLink('https://quiz24.ir/exam/123'),'https://quiz24.ir/exam/123');
});
