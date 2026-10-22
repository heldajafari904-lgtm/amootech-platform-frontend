import test from 'node:test';
import assert from 'node:assert/strict';
import { submittedStatus, reportingProgress, createReportWriteQueue, reportEditable, quickStatuses } from '../src/lib/reportQuick.ts';

test('UNSET and legacy measurements/execution are never interpreted as a reported result',()=>{
 for(const item of [{},{reported_status:null},{execution_status:'COMPLETED',actual_duration_minutes:60},{reported_status:'INVALID'}]) assert.equal(submittedStatus(item),null);
 for(const status of quickStatuses) assert.equal(submittedStatus({reported_status:status}),status);
});
test('daily progress counts submissions, including NOT_DONE, and excludes unplanned rows',()=>{
 const item=(plan_item,reported_status)=>({plan_item,reported_status});
 assert.deepEqual(reportingProgress([item(1,null),item(2,'NOT_DONE'),item(3,'PARTIAL'),item(4,'COMPLETED'),item(null,'COMPLETED')]),{reported:3,total:4,percent:75});
 assert.deepEqual(reportingProgress([]),{reported:0,total:0,percent:0});
});
test('rapid writes to different cards cannot apply stale full-day responses',async()=>{
 const enqueue=createReportWriteQueue();const applied=[];let finish;
 const first=enqueue(async()=>{await new Promise(resolve=>{finish=resolve});applied.push(['COMPLETED',null]);});
 const second=enqueue(async()=>{applied.push(['COMPLETED','PARTIAL']);});
 await Promise.resolve();assert.deepEqual(applied,[]);finish();await Promise.all([first,second]);
 assert.deepEqual(applied,[['COMPLETED',null],['COMPLETED','PARTIAL']]);
});
test('network failure leaves queue available for retry and following cards',async()=>{
 const enqueue=createReportWriteQueue();let calls=0;
 await assert.rejects(enqueue(async()=>{calls++;throw Error('offline')}));
 await enqueue(async()=>{calls++});assert.equal(calls,2);
});
test('historical and future dates follow the existing Tehran thirty-day window',()=>{
 assert.equal(reportEditable({date:'2026-10-20'},'2026-10-20'),true);
 assert.equal(reportEditable({date:'2026-09-20'},'2026-10-20'),true);
 assert.equal(reportEditable({date:'2026-09-19'},'2026-10-20'),false);
 assert.equal(reportEditable({date:'2026-10-21'},'2026-10-20'),false);
 assert.equal(reportEditable({date:'2026-10-20',editable:false},'2026-10-20'),false);
});
