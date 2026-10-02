import test from 'node:test';
import assert from 'node:assert/strict';
import { timeToMinutes, minutesToTime, timeFromClientX, clampTime, arrangeLanes, dropConflict, tehranClock } from '../src/app/counselor/students/[id]/planning/plannerTime.ts';

test('RTL pointer coordinates for 06, 12, 18, 24 and scrolled content', () => {
  const rect = { right: 1828, width: 1728 };
  for (const hour of [6,12,18]) assert.equal(timeFromClientX(rect.right - hour*60*1.2, rect), hour*60);
  assert.equal(timeFromClientX(rect.right-rect.width,rect),1425);
  assert.equal(timeFromClientX(100,{right:964,width:1728}),720);
});
test('snap, duration limit and API midnight boundary',()=>{
  assert.equal(timeToMinutes('18:30:00'),1110); assert.equal(minutesToTime(1170),'19:30');
  assert.equal(clampTime(1087,90),1080); assert(clampTime(1440,90)+90<1440);
});
const item=(id,start,end)=>({id,ordering:id,planned_duration_minutes:start&&end?timeToMinutes(end)-timeToMinutes(start):60,start_time:start,end_time:end});
test('single row keeps short cards readable without visual collisions',()=>{
 const result=arrangeLanes([item(1,'08:00','09:00'),item(2,'09:00','10:00'),item(3,'12:00','13:00')]);
 assert.equal(result.lanes,1);
 result.entries.forEach((entry,index)=>{assert.equal(entry.lane,0);assert(entry.width>=190);if(index)assert(entry.position>=result.entries[index-1].position+result.entries[index-1].width+12)});
});
test('flexible activities fill earliest available slots inside the timeline',()=>{
 const result=arrangeLanes([item(1,'06:00','08:00'),item(2,'09:00','10:00'),item(3,null,null),item(4,null,null)]);
 assert.equal(result.entries.find(e=>e.item.id===3).start,480);
 assert.equal(result.entries.find(e=>e.item.id===4).start,600);
 assert.equal(result.entries.length,4);
});
test('overlapping timed items remain on one row with explicit conflicts',()=>{
 const result=arrangeLanes([item(1,'08:00','09:00'),item(2,'08:00','09:00')]);
 assert.equal(result.lanes,1); assert(result.entries[1].conflict);
 assert(result.entries[1].position>=result.entries[0].position+result.entries[0].width+12);
});
test('activity and commitment conflicts, touching boundaries allowed',()=>{
 const source=item(1,null,null); const existing=[item(2,'18:00','19:00')];
 assert(dropConflict(source,1080,existing,[],'2026-10-02'));
 assert.equal(dropConflict(source,1140,existing,[],'2026-10-02'),null);
 assert(dropConflict(source,600,[],[{active:true,weekday:4,start_time:'10:00',end_time:'11:00'}],'2026-10-02'));
});
test('Tehran clock crosses Gregorian day without UTC drift',()=>{
 assert.deepEqual(tehranClock(new Date('2026-10-01T21:05:00Z')),{date:'2026-10-02',minutes:35,time:'00:35'});
});
