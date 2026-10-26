// Real Django + isolated PostgreSQL; no API mocks. See SPRINT_A.md for setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, message, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const result = await read(); if (result) return result; } catch {} await pause(100); }
  throw new Error(message);
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

test('actual PostgreSQL planner: offline catalog, partial scope, Saturday and persistent school markers reach student', {skip:process.env.RUN_SPRINT_A_BROWSER!=='1',timeout:180000}, async t=>{
 const session=JSON.parse(await readFile(process.env.SPRINT_A_QA_SESSION,'utf8'));
 const base=process.env.SPRINT_A_API || 'http://127.0.0.1:8199/api/v1';
 const call=async(path,method='GET',body,token=session.counselor_token)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=response.status===204?null:await response.json();
  assert.ok(response.ok,`Actual Django ${path}: ${JSON.stringify(result)}`);return result;
 };
 const oldEvents=await call(`/planning/fixed-events/?student=${session.student}`);
 for(const event of oldEvents.results || oldEvents) if(['کوییز شنبه مرور','امتحان یکشنبه'].includes(event.title)) await call(`/planning/fixed-events/${event.id}/`,'DELETE');
 const initial=await call(`/planning/plans/${session.plan}/`);
 const weekly=await call('/planning/fixed-events/','POST',{student:session.student,kind:'QUIZ',title:'کوییز شنبه مرور',weekday:5,valid_from:initial.start_date,valid_until:initial.end_date});
 const once=await call('/planning/fixed-events/','POST',{student:session.student,kind:'EXAM',title:'امتحان یکشنبه',date:'2026-10-25'});
 await call(`/planning/plans/${session.plan}/apply-fixed/`,'POST',{});
 const persisted=await call(`/planning/plans/${session.plan}/`);
 assert.equal(persisted.school_events.find(e=>e.id===weekly.id).date,'2026-10-24');
 assert.ok(persisted.days.find(d=>d.date==='2026-10-24').items.some(i=>i.title==='مدرسه شنبه'));
 assert.ok(!persisted.days.find(d=>d.date==='2026-10-25').items.some(i=>i.title==='مدرسه شنبه'));
 const uiPort=3199,chromePort=4199;
 const profile=await mkdtemp(join(tmpdir(),'amootech-sprint-a-chrome-'));
 const next=spawn('node',['--require','./tests/next-dev-bootstrap.cjs','node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{env:{...process.env,NEXT_PUBLIC_API_BASE_URL:base},stdio:['ignore','pipe','pipe']});
 let log='';next.stdout.on('data',c=>log+=c);next.stderr.on('data',c=>log+=c);
 const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let browser;
 t.after(async()=>{browser?.close();chrome.kill();next.kill();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});});
 const page=await until(async()=>{const r=await fetch(`http://127.0.0.1:${chromePort}/json`);return(await r.json()).find(p=>p.type==='page')},'Chrome unavailable');
 browser=await connect(page.webSocketDebuggerUrl);const {evaluate:run,send}=browser;
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('amootech_counselor_access',${JSON.stringify(session.counselor_token)});sessionStorage.setItem('amootech_student_access',${JSON.stringify(session.student_token)})`});
 await until(()=>log.includes('Ready'),`Next failed: ${log}`);
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/counselor/students/${session.student}/planning?plan=${session.plan}`});
 await until(()=>run("document.querySelectorAll('.ws-day-row').length===7"),`Actual workspace unavailable: ${log}`);
 assert.ok(await run("document.querySelector('.ws-day-row').textContent.includes('شنبه')"));
 assert.ok(await run("document.querySelector('.ws-day-row').textContent.includes('کوییز شنبه مرور')"));
 assert.ok(await run("document.body.textContent.includes('امتحان یکشنبه')"));
 assert.equal(await run("document.querySelectorAll('input[type=date]').length"),0);
 await run("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='＋ افزودن باکس').click()");
 await until(()=>run("!!document.querySelector('.flex-choice-grid button')"),'Local grade tiles missing');
 assert.equal(await run("document.querySelectorAll('.flex-choice-grid').length"),1);
 if(process.env.SPRINT_A_EXPECT_UPPER_GRADES==='1') {
  assert.deepEqual(await run("[...document.querySelectorAll('.flex-choice-grid button')].map(button=>button.textContent)"),['دهم','یازدهم','دوازدهم']);
 }
 await run("document.querySelector('.flex-choice-grid button').click()");
 await until(()=>run("document.querySelector('.flex-activity-editor input[name=title]').value.length>0"),'Grade title missing');
 await run("document.querySelector('.flex-activity-editor').requestSubmit()");
 await until(()=>run("!document.querySelector('.flex-activity-editor')"),'Actual partial-scope save failed');
 const after=await call(`/planning/plans/${session.plan}/`);
 assert.ok(after.days.flatMap(d=>d.items).some(i=>i.taxonomy.grade && !i.taxonomy.course));
 for(const day of after.days) if(!day.items.length) await call('/planning/items/','POST',{plan_day:day.id,kind:'EVENT',title:'یادداشت روزانه',planned_duration_minutes:15});
 await call(`/planning/plans/${session.plan}/publish/`,'POST',{});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/plans/${session.plan}`});
 await until(()=>run("document.body.textContent.includes('کوییز شنبه مرور')"),'Published marker did not reach actual student account');
 assert.ok(await run("document.body.textContent.includes('امتحان یکشنبه')"));
 await call(`/planning/fixed-events/${weekly.id}/`,'PATCH',{active:false});
 await call(`/planning/fixed-events/${once.id}/`,'DELETE');
 await send('Page.reload');
 await until(()=>run("document.body.textContent.includes('برنامه تست یکپارچه') && !document.body.textContent.includes('کوییز شنبه مرور') && !document.body.textContent.includes('امتحان یکشنبه')"),'Cancelled markers survived reload');

 // Exercise the actual plan exam-day controls through their React save path.
 const plansBefore=await call(`/planning/plans/?student=${session.student}`);
 const existingIds=new Set((plansBefore.results || plansBefore).map(plan=>plan.id));
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/counselor/students/${session.student}/planning?plan=${session.plan}`});
 await until(()=>run("!!document.querySelector('.ws-toolbar-new')"),'Counselor controls unavailable');
 await run("document.querySelector('.ws-toolbar-new').click()");
 await until(()=>run("!!document.querySelector('[aria-label=\"برنامه جدید\"] input')"),'Plan dialog unavailable');
 await run(`{const input=document.querySelector('[aria-label="برنامه جدید"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'۱۴۰۵/۰۸/۰۲');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
 await run("[...document.querySelectorAll('button')].find(button=>button.textContent.startsWith('ادامه — انتخاب')).click()");
 await until(()=>run("document.querySelectorAll('.ws-exam-grid button').length===7"),'Exam-day choices unavailable');
 await run("document.querySelector('.ws-exam-grid button').click()");
 await run("document.querySelector('[aria-label=\"برنامه جدید\"] form').requestSubmit()");
 await until(()=>run("!document.querySelector('[aria-label=\"برنامه جدید\"]')"),'Exam-day plan save failed');
 const plansAfter=await call(`/planning/plans/?student=${session.student}`);
 const createdPlan=(plansAfter.results || plansAfter).find(plan=>!existingIds.has(plan.id));
 assert.ok(createdPlan,'Plan was not persisted by the UI');
 assert.deepEqual(createdPlan.exam_dates,['2026-10-24']);
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/counselor/students/${session.student}/planning?plan=${createdPlan.id}`});
 await until(()=>run("document.querySelector('.ws-day-row')?.textContent.includes('امتحان داره')"),'Saved checkbox marker missing after reload');

 // Weekly checkbox -> API -> DB -> marker, with no browser API interception.
 await run("[...document.querySelectorAll('button')].find(button=>button.textContent==='مدیریت برنامه‌های ثابت (مدرسه و کلاس‌ها)').click()");
 await run("[...document.querySelectorAll('button')].find(button=>button.textContent==='رویدادها و فعالیت‌ها').click()");
 await run("[...document.querySelectorAll('.planning-type-picker button')].find(button=>button.textContent==='کوییز').click();document.querySelector('input[type=checkbox]').click()");
 await run(`{const input=document.querySelector('input[placeholder="جلسه"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'کوییز ثبت‌شده از رابط');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
 await run("[...document.querySelectorAll('button')].find(button=>button.textContent==='ثبت برای شنبه').click()");
 await until(()=>run("document.querySelector('.ws-day-row')?.textContent.includes('کوییز ثبت‌شده از رابط')"),'Weekly checkbox did not produce a saved marker');
 await send('Page.reload');
 await until(()=>run("document.querySelector('.ws-day-row')?.textContent.includes('کوییز ثبت‌شده از رابط')"),'Weekly checkbox marker did not survive reload');
 const sources=await call(`/planning/fixed-events/?student=${session.student}`);
 const savedSource=(sources.results || sources).find(source=>source.title==='کوییز ثبت‌شده از رابط');
 assert.equal(savedSource.weekday,5);assert.equal(savedSource.kind,'QUIZ');
 await call(`/planning/fixed-events/${savedSource.id}/`,'DELETE');
 await call(`/planning/plans/${createdPlan.id}/`,'DELETE');
});
