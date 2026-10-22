// Run with RUN_REPORT_BROWSER=1 node --test tests/report-quick-browser.test.mjs
// Uses installed Chrome + Node CDP, the actual Next app, and an isolated mock API. No live provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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

test('student one-tap report saves, retries, serializes cards and supports mobile keyboard/date navigation', {skip:process.env.RUN_REPORT_BROWSER!=='1',timeout:180000}, async t=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const item=(id,kind,title)=>({id,source:'WEB',execution_source:null,plan_item:id,kind,title,resource:'',note:'یادداشت قبلی',start_time:null,end_time:null,subject:null,subject_name:null,chapter:null,chapter_name:null,topic:null,topic_name:null,planned_duration_minutes:60,planned_test_count:kind==='TEST'?20:null,actual_duration_minutes:null,entered_actual_duration_minutes:null,duration_source:null,actual_test_count:null,correct_count:null,wrong_count:null,unanswered_count:null,execution_status:'NOT_STARTED',reported_status:null});
  const rows=[item(1,'STUDY','مرور آزاد'),{...item(2,'TEST','فیزیک — حرکت'),actual_duration_minutes:12,entered_actual_duration_minutes:12,duration_source:'MANUAL',actual_test_count:3,wrong_count:1,correct_count:2}];
  const report={id:1,date:today,student:1,source:'WEB',wake_time:null,sleep_time:null,mobile_minutes:null,self_rating:null,note:'',closed_at:null,editable:true,items:rows};
  function payload(target=report){return {...target,summary:{planned_minutes:120,total_actual_minutes:12,planned_tests:20,total_tests:3,completed_plan_items:target.items.filter(i=>i.reported_status==='COMPLETED').length,partial_plan_items:target.items.filter(i=>i.reported_status==='PARTIAL').length,not_done_plan_items:target.items.filter(i=>i.reported_status==='NOT_DONE').length,uncompleted_plan_items:target.items.filter(i=>!i.reported_status).length,planned_items:2,academic_activities:0,by_subject:[]}};}
  const mutations=[];let active=0,maxActive=0,failNext=false;
  const mock=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, PUT, OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const path=new URL(req.url,'http://localhost').pathname.replace('/api/v1','');
    let body='';for await(const part of req)body+=part;const input=body?JSON.parse(body):{};
    const respond=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    if(path==='/auth/me/')return respond({id:1,username:'mock-student',first_name:'دانش‌آموز',role:'STUDENT'});
    if(path==='/auth/profile/student/')return respond({grade:null,field:null});
    if(path==='/daily-reports/open/')return respond(input.date===today?payload():payload({...report,id:2,date:input.date,items:rows.map(row=>({...row,reported_status:null}))}));
    if(path==='/daily-reports/1/')return respond(payload());
    const match=path.match(/^\/daily-reports\/1\/planned\/(\d+)\/$/);
    if(match&&req.method==='PUT'){
      active++;maxActive=Math.max(maxActive,active);mutations.push(input);await pause(250);active--;
      if(failNext){failNext=false;res.statusCode=503;return respond({detail:'ارتباط قطع شد؛ دوباره تلاش کنید.'});}
      Object.assign(rows.find(row=>row.id===Number(match[1])),input);return respond(payload());
    }
    res.statusCode=404;respond({detail:'Unexpected mock route'});
  });
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));const apiPort=mock.address().port;
  const uiPort=3100+Math.floor(Math.random()*500),chromePort=uiPort+1000;
  const profile=await mkdtemp(join(tmpdir(),'amootech-report-chrome-'));
  const next=spawn('node',['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_API_BASE_URL:`http://127.0.0.1:${apiPort}/api/v1`},stdio:['ignore','pipe','pipe']});
  let serverLog='';next.stdout.on('data',chunk=>{serverLog+=chunk});next.stderr.on('data',chunk=>{serverLog+=chunk});
  const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  let browser;t.after(async()=>{browser?.close();chrome.kill();next.kill();mock.closeAllConnections();mock.close();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});});
  const pages=await until(async()=>{const r=await fetch(`http://127.0.0.1:${chromePort}/json`);const pages=await r.json();return pages.some(p=>p.type==='page')?pages:null},'Chrome unavailable');
  browser=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);const{evaluate:run,send}=browser;
  await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('amootech_student_access','report-test-token')"});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await until(()=>serverLog.includes('Ready'),`Next unavailable: ${serverLog}`);
  await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/plans/report/${today}`});
  await until(()=>run("document.querySelectorAll('.report-quick-card').length===2"),'Report did not load');
  const card=id=>`document.querySelector('[data-report-item="${id}"]')`;
  const click=(id,text)=>run(`{const b=[...${card(id)}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Button missing');b.click()}`);
  const saved=id=>until(()=>run(`!${card(id)}.matches('[aria-busy="true"]') && ${card(id)}.querySelector('.report-save-feedback').textContent.includes('ذخیره شد')`),'Save not confirmed');
  const pressed=(id,text)=>run(`{const b=[...${card(id)}.querySelectorAll('.report-status-button')].find(b=>b.textContent===${JSON.stringify(text)});b?.getAttribute('aria-pressed')}`);
  assert.equal(await run("document.querySelectorAll('.report-status-button[aria-pressed=true]').length"),0,'Legacy measurements cannot imply DONE');
  assert.equal(await run("document.querySelector('.report-submission-progress progress').value"),0);
  assert.equal(await run(`${card(1)}.querySelector('details').open`),false);
  await click(1,'خوندم');await click(1,'خوندم');await click(2,'نصفه');
  assert.equal(await run(`${card(1)}.querySelector('.report-save-feedback').textContent.includes('ذخیره شد')`),false);
  await saved(1);await saved(2);assert.equal(mutations.length,2);assert.equal(maxActive,1);
  assert.deepEqual(mutations[0],{reported_status:'COMPLETED'});assert.deepEqual(mutations[1],{reported_status:'PARTIAL'});
  assert.equal(rows[1].actual_duration_minutes,12);assert.equal(rows[1].actual_test_count,3);
  assert.equal(await run("document.querySelector('.report-submission-progress progress').value"),2);
  failNext=true;await click(1,'نخوندم');
  await until(()=>run(`!!${card(1)}.querySelector('.report-save-error')`),'Error missing');
  assert.equal(await pressed(1,'خوندم'),'true');assert.equal(await pressed(1,'نخوندم'),'false');
  await click(1,'تلاش دوباره');await saved(1);assert.equal(await pressed(1,'نخوندم'),'true');
  // Native keyboard activation of a touch target.
  await run(`[...${card(1)}.querySelectorAll('button')].find(b=>b.textContent==='نصفه').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(()=>run(`${card(1)}.querySelector('[aria-pressed=true]').textContent==='نصفه'`),'Keyboard action failed');
  assert.equal(await run(`${card(1)}.querySelector('.report-status-button').getBoundingClientRect().height>=44`),true);
  assert.equal(await run(`${card(1)}.getBoundingClientRect().width<=innerWidth`),true);
  // Details stay mounted: unsaved note survives a status response on another card.
  await run(`${card(2)}.querySelector('details').open=true`);
  await run(`{const e=[...${card(2)}.querySelectorAll('label')].find(l=>l.textContent.includes('یادداشت کوتاه')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'یادداشت تازه');e.dispatchEvent(new Event('input',{bubbles:true}))}`);
  await click(1,'خوندم');await saved(1);
  assert.equal(await run(`[...${card(2)}.querySelectorAll('label')].find(l=>l.textContent.includes('یادداشت کوتاه')).querySelector('input').value`),'یادداشت تازه');
  await click(2,'ذخیره جزئیات');await saved(2);assert.deepEqual(mutations.at(-1),{note:'یادداشت تازه'});
  // Reload preserves the declaration; date navigation never carries it into another day.
  await send('Page.reload');await until(()=>run("document.querySelectorAll('.report-quick-card').length===2"),'Reload missing');
  assert.equal(await pressed(1,'خوندم'),'true');
  await run("[...document.querySelectorAll('a')].find(a=>a.textContent==='روز قبل').click()");
  await until(()=>run(`document.querySelector('.report-date-picker input').value!==${JSON.stringify(today)}`),'Date navigation failed');
  await until(()=>run("document.querySelector('.report-submission-progress progress')?.value===0"),'Statuses leaked across dates');
});
