import test from 'node:test';
import assert from 'node:assert/strict';
import { initialContent, generatedTitle, displayTitle, manualTitle, automaticTitle, selectProvider, selectInternal, clearContentSelection, contentPayload, createCatalogCache } from '../src/app/counselor/students/[id]/planning/flexibleContent.ts';
const course = () => selectProvider(selectProvider(initialContent(), 'grade', 700, 'دهم'), 'course', 900, 'فیزیک');

test('free text is immediately valid and never turned into a provider identifier', () => {
 const content = manualTitle(initialContent(), '  مرور آزاد  ');
 assert.deepEqual(contentPayload(content), { taxonomy: {}, subject: null, chapter: null, topic: null, title: 'مرور آزاد' });
});
test('grade, course, chapter, subject and object can each be the final selection', () => {
 let content = initialContent();
 for (const [level, id, label, expected] of [['grade',700,'دهم','دهم'],['course',900,'فیزیک','فیزیک'],['chapter',901,'حرکت','فیزیک — حرکت'],['subject',902,'سرعت','فیزیک — سرعت'],['object',903,'سرعت متوسط','فیزیک — سرعت متوسط']]) {
   content = selectProvider(content,level,id,label);
   assert.equal(displayTitle(content), expected);
   assert.equal('title' in contentPayload(content),false);
 }
 assert.deepEqual(contentPayload(content).taxonomy, {provider:'quiz24',grade:700,course:900,chapter:901,subject:902,object:903,labels:{grade:'دهم',course:'فیزیک',chapter:'حرکت',subject:'سرعت',object:'سرعت متوسط'}});
});
test('new taxonomy choice replaces manual title and delegates reset to backend', () => {
 let content = manualTitle(course(), 'عنوان دستی');
 content = selectProvider(content,'chapter',901,'حرکت');
 assert.equal(displayTitle(content),'فیزیک — حرکت');
 assert.equal(content.custom,false);
 assert.equal(contentPayload(content,true).reset_generated_title,true);
 content = automaticTitle(content);
 assert.equal(displayTitle(content),'فیزیک — حرکت');
 assert.equal(contentPayload(content,true).reset_generated_title,true);
 assert.equal('title' in contentPayload(content,true),false);
});
test('changing parent clears all invalid descendants and regenerates title', () => {
 let content = selectProvider(selectProvider(selectProvider(course(),'chapter',901,'فصل'),'subject',902,'مبحث'),'object',903,'موضوع');
 content = selectProvider(manualTitle(content,'دستی'),'course',999,'شیمی');
 assert.deepEqual(content.taxonomy, {provider:'quiz24',grade:700,course:999,labels:{grade:'دهم',course:'شیمی'}});
 assert.equal(displayTitle(content),'شیمی');
 content = selectProvider(content,'grade');
 assert.deepEqual(content.taxonomy,{});
 assert.equal(displayTitle(content),'شیمی');
});
test('clearing selection preserves current generated text as a free-text activity', () => {
 const content = clearContentSelection(course());
 assert.equal(displayTitle(content),'فیزیک');
 assert.equal(contentPayload(content).title,'فیزیک');
 assert.deepEqual(content.taxonomy,{});
});
test('legacy items reopen without inference from historical text and retain internal namespace', () => {
 const old = { title: 'عنوان تاریخی', subject: 12, subject_name: 'فیزیک', chapter: 13, chapter_name: 'حرکت', topic: null };
 const content = initialContent(old);
 assert.equal(displayTitle(content),'عنوان تاریخی');
 assert.equal(contentPayload(content,true).subject,12);
 assert.deepEqual(contentPayload(content,true).taxonomy,{});
 assert.equal(generatedTitle(content),'فیزیک — حرکت');
 const changed = selectInternal(content,'subject',99,'شیمی');
 assert.equal(changed.internal.chapter,null);
 assert.equal(displayTitle(changed),'شیمی');
});
test('saved provider metadata and automatic state survive reopening, including skipped levels', () => {
 const taxonomy = {provider:'quiz24',course:900,object:903,labels:{course:'فیزیک',object:'سرعت'}};
 const content = initialContent({title:'فیزیک — سرعت',taxonomy,title_is_custom:false,generated_title:'فیزیک — سرعت'});
 assert.equal(displayTitle(content),'فیزیک — سرعت');
 assert.deepEqual(contentPayload(content,true).taxonomy,taxonomy);
 assert.equal(contentPayload(content,true).reset_generated_title,true);
});
test('new namespace clears internal FKs rather than equating them to Quiz24 IDs', () => {
 const old = initialContent({title:'قدیمی',subject:900,chapter:901,topic:902});
 const selected = selectProvider(old,'course',900,'درس Quiz24');
 assert.deepEqual(selected.internal,{subject:null,chapter:null,topic:null});
 assert.equal(selected.taxonomy.course,900);
});
test('duplicate labels and grade names do not repeat in generated titles', () => {
 const content = selectProvider(course(),'chapter',901,'فیزیک');
 assert.equal(generatedTitle(content),'فیزیک');
});
test('catalog cache deduplicates rapid calls, isolates auth and retries failures', async () => {
 const cached = createCatalogCache();
 let requests = 0;
 const load = async () => { requests++; return []; };
 await Promise.all([cached('token-a:grades',load),cached('token-a:grades',load)]);
 assert.equal(requests,1);
 await cached('token-b:grades',load); assert.equal(requests,2);
 await assert.rejects(cached('failed',async()=>{throw new Error('offline')}));
 assert.deepEqual(await cached('failed',load),[]);
});

test('legacy blank study titles use their existing structured selection when editing', () => {
 const content = initialContent({title:'',subject:12,subject_name:'فیزیک',title_is_custom:true,generated_title:'فیزیک'});
 assert.equal(displayTitle(content),'فیزیک');
 assert.equal(contentPayload(content,true).reset_generated_title,true);
});

test('choosing the same value preserves manual title and descendants', () => {
 const content = manualTitle(selectProvider(course(),'chapter',901,'حرکت'),'مرور آزاد');
 assert.equal(selectProvider(content,'course',900,'فیزیک'),content);
 assert.equal(displayTitle(content),'مرور آزاد');
});
