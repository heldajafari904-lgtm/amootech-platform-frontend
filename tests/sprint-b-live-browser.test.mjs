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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

test('shared builder: real Django/PostgreSQL, persistent multi-grade basket, reports and counselor group, mobile RTL', {skip:process.env.RUN_SPRINT_B_BROWSER!=='1',timeout:240000}, async t=>{
 const session=JSON.parse(await readFile(process.env.SPRINT_B_QA_SESSION,'utf8'));
 const base='http://127.0.0.1:8199/api/v1';
 const call=async(path,method='GET',body,token=session.student_token)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=response.status===204?null:await response.json();assert.ok(response.ok,`${path}: ${JSON.stringify(result)}`);return result;
 };
 const oldPersonal=new Set((await call('/exams/')).results.map(e=>e.id));
 const oldAssigned=new Set((await call('/exams/','GET',null,session.counselor_token)).results.map(e=>e.id));
 const uiPort=3199,chromePort=4199;
 const profile=await mkdtemp(join(tmpdir(),'amootech-sprint-b-chrome-'));
 const next=spawn('node',['--require','./tests/next-dev-bootstrap.cjs','node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{env:{...process.env,NEXT_PUBLIC_API_BASE_URL:base},stdio:['ignore','pipe','pipe']});
 let log='';next.stdout.on('data',c=>log+=c);next.stderr.on('data',c=>log+=c);
 const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let browser;
 t.after(async()=>{browser?.close();chrome.kill();next.kill();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});});
 const page=await until(async()=>{const r=await fetch(`http://127.0.0.1:${chromePort}/json`);return(await r.json()).find(p=>p.type==='page')},'Chrome unavailable');
 browser=await connect(page.webSocketDebuggerUrl);const {evaluate:run,send}=browser;
 await send('Page.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('amootech_counselor_access',${JSON.stringify(session.counselor_token)});sessionStorage.setItem('amootech_student_access',${JSON.stringify(session.student_token)})`});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await until(()=>log.includes('Ready'),`Next failed: ${log}`);
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/exams`});
 await until(()=>run("!!document.querySelector('.exam-mode')"),`Student unavailable ${log}`);
 const click=async(selector)=>{await until(()=>run(`!!document.querySelector(${JSON.stringify(selector)})`),`Missing ${selector}`);await run(`document.querySelector(${JSON.stringify(selector)}).click()`)};
 const bank='#student-exam-create .exam-basket-builder';
 const report='#student-report-topics .exam-basket-builder';
 async function chooseCourse(root,grade,index=0){
  await until(()=>run(`document.querySelectorAll('${root} [aria-label="پایه"] button').length===3`),'Allowed grade tiles missing');
  await run(`document.querySelectorAll('${root} [aria-label="پایه"] button')[${grade}].click()`);
  await until(()=>run(`document.querySelectorAll('${root} [aria-label="درس"] button').length>${index}`),'Course tiles missing');
  await run(`document.querySelectorAll('${root} [aria-label="درس"] button')[${index}].click()`);
  await until(()=>run(`!!document.querySelector('${root} .basket-node-chapter input')`),'Local chapters missing');
 }
 async function count(root,index=0,value='1'){
  await run(`{const e=document.querySelectorAll('${root} .basket-counts input')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))}`);
 }
 await click('.exam-mode button');
 await chooseCourse(bank,0);await click(`${bank} .basket-node-chapter input`);await count(bank);
 await chooseCourse(bank,2);await click(`${bank} .basket-node-chapter input`);await count(bank,4);
 await chooseCourse(bank,2,1);await click(`${bank} .basket-node-chapter input`);await count(bank,8);
 assert.equal(await run(`document.querySelectorAll('${bank} .basket-summary-row').length`),3);
 assert.equal(await run(`document.querySelector('${bank} .basket-summary strong').textContent.includes('۳')`),true);
 assert.equal(await run(`document.querySelector('${bank} .basket-combined-gate button').disabled`),true);
 await chooseCourse(bank,0);
 assert.equal(await run(`document.querySelector('${bank} .basket-node-chapter input').checked`),true);
 assert.equal(await run(`document.querySelector('${bank} .basket-counts input').value`),'1');
 await send('Page.reload');await until(()=>run("!!document.querySelector('.exam-mode')"),'Reload failed');await click('.exam-mode button');
 await until(()=>run(`document.querySelectorAll('${bank} .basket-summary-row').length===3`),'Basket lost after reload');
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/exams?navigation=1`});
 await until(()=>run("!!document.querySelector('.exam-mode')"),'Navigation failed');
 await run('history.back()');await until(()=>run("location.search==='' && !!document.querySelector('.exam-mode')"),'Back failed');
 if(!await run(`!!document.querySelector('${bank}')`))await click('.exam-mode button');
 await until(()=>run(`document.querySelectorAll('${bank} .basket-summary-row').length===3`),'Basket lost after back');
 await run(`[...document.querySelectorAll('${bank} .basket-summary-row')].at(-1).querySelector('button[aria-label]').click()`);
 assert.equal(await run(`document.querySelectorAll('${bank} .basket-summary-row').length`),2);
 // Report mode reads real eligible sources and local descendants; nothing is prechecked.
 await click('.exam-mode button:nth-child(2)');
 await until(()=>run(`document.querySelectorAll('${report} .basket-report-course').length===3`),'Report topic groups missing');
 assert.equal(await run(`document.querySelectorAll('${report} input:checked').length`),0);
 assert.equal(await run(`document.querySelectorAll('${report} .report-source-card, ${report} .report-card').length`),0);
 assert.equal(await run(`document.querySelectorAll('${report} input[type=date]').length`),0);
 await click(`${report} .basket-node-subject input`);await count(report);
 await until(()=>run(`document.querySelector('${report} .basket-create-course')?.disabled===false`),'Report availability/create missing');
 await run(`{const b=document.querySelector('${report} .basket-create-course');b.click();b.click()}`);
 await until(()=>run(`document.querySelector('${report}').textContent.includes('در تاریخچه ثبت شد')`),'Report creation failed');
 const personal=(await call('/exams/')).results.filter(e=>!oldPersonal.has(e.id));
 assert.equal(personal.length,1);assert.equal(personal[0].report_scope.sources.length,1);
 assert.ok(personal[0].report_scope.selection.provider_filters.subject_ids.length);
 const start=await call(`/exams/${personal[0].id}/start/`,'POST',{});assert.match(start.participation_url,/example.test\/mocked/);
 // Week and custom ranges use Jalali fields and actual Saturday-first backend service.
 await run(`document.querySelectorAll('${report} [aria-label="بازه گزارش"] button')[1].click()`);
 await until(()=>run(`document.querySelectorAll('${report} .basket-report-course').length===3`),'Week report request failed');
 await run(`document.querySelectorAll('${report} [aria-label="بازه گزارش"] button')[2].click()`);
 await until(()=>run(`document.querySelectorAll('${report} .jalali-date-input').length>0 || document.querySelectorAll('${report} input[type=text]').length>=2`),'Jalali custom date fields missing');
 const today=(await call('/exams/study-sources/topics/?period=today')).range.end_date;
 const tomorrow=new Date(new Date(today+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
 const jalali=iso=>{const parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso+'T12:00:00Z'));return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('/')};
 async function fill(selector,value){await run(`{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}`);await pause(80)}
 await fill(`${report} .basket-selection label:first-child input[type=text]`,jalali(today));
 await fill(`${report} .basket-selection label:nth-child(2) input[type=text]`,jalali(today));
 await until(()=>run(`document.querySelectorAll('${report} .basket-report-course').length===3`),'Custom report dates failed');
 // Counselor uses the exact same builder and validates every group recipient.
 await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/counselor/exams`});
 await until(()=>run("!!document.querySelector('.exam-heading button')"),'Counselor page missing');
 await click('.exam-heading button');
 await until(()=>run('document.querySelectorAll(\'[aria-label="دانش‌آموزان آزمون"] button\').length===2'),'Authorized students missing');
 await run('document.querySelectorAll(\'[aria-label="دانش‌آموزان آزمون"] button\')[0].click()');
 await pause(100);
 await run('document.querySelectorAll(\'[aria-label="دانش‌آموزان آزمون"] button\')[1].click()');
 await until(()=>run('document.querySelectorAll(\'[aria-label="دانش‌آموزان آزمون"] button[aria-pressed=true]\').length===2'),'Group recipients not selected');
 const counselor='#exam-creation .exam-basket-builder';
 await chooseCourse(counselor,0);await click(`${counselor} .basket-node-chapter input`);await count(counselor);
 await until(()=>run(`document.querySelector('${counselor} .basket-create-course')?.disabled===false`),'Counselor availability missing');
 assert.equal(await run(`document.querySelectorAll('${counselor} input[type=date]').length`),0);
 assert.equal(await run(`getComputedStyle(document.querySelector('${counselor}')).direction`),'rtl');
 assert.ok(await run(`document.querySelector('${counselor}').scrollWidth<=390`),'Mobile builder overflow');
 await click(`${counselor} details summary`);
 await fill(`${counselor} details .basket-options:nth-of-type(1) input[type=text]`,jalali(tomorrow));
 await fill(`${counselor} details .basket-options:nth-of-type(1) input[type=time]`,'09:00');
 await fill(`${counselor} details .basket-options:nth-of-type(2) input[type=text]`,jalali(tomorrow));
 await fill(`${counselor} details .basket-options:nth-of-type(2) input[type=time]`,'10:00');
 await fill(`${counselor} details .basket-options:nth-of-type(3) input[type=text]`,jalali(tomorrow));
 await fill(`${counselor} details .basket-options:nth-of-type(3) input[type=time]`,'11:00');
 await until(()=>run(`document.querySelector('${counselor} .basket-create-course').disabled===false`),'Complete schedule rejected');
 await click(`${counselor} .basket-create-course`);
 await until(()=>run("document.body.textContent.includes('آزمون ساخته شد')"),'Counselor create failed');
 const assigned=(await call('/exams/','GET',null,session.counselor_token)).results.filter(e=>!oldAssigned.has(e.id)&&e.creation_mode==='AUTOMATIC'&&!e.is_personal_practice&&e.student===null);
 assert.equal(assigned.length,1);assert.equal(assigned[0].assignment_count,2);
 assert.equal(new Date(assigned[0].scheduled_start_at).toISOString(),new Date(tomorrow+'T09:00:00+03:30').toISOString());
 assert.equal(new Date(assigned[0].participation_deadline_at).toISOString(),new Date(tomorrow+'T10:00:00+03:30').toISOString());
 assert.equal(new Date(assigned[0].result_release_at).toISOString(),new Date(tomorrow+'T11:00:00+03:30').toISOString());
 const assignments=await call(`/exams/${assigned[0].id}/assignments/`,'GET',null,session.counselor_token);
 assert.equal((assignments.results??assignments).length,2);
});
