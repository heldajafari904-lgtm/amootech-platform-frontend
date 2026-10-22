// Run with RUN_REPORT_TOPICS_BROWSER=1 node --test tests/report-topics-browser.test.mjs
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

test('report exam on mobile: automatic groups, explicit topics, counts, retry, separate courses and links', {skip:process.env.RUN_REPORT_TOPICS_BROWSER!=='1',timeout:180000},async t=>{
 const previews=[],mutations=[];let weekStarted=false;
 const reference={report_item_id:1,source_revision:'a'.repeat(64)};
 const groups=[900,910].map(course=>({grade_id:700,course_id:course,grade_label:'دوازدهم',course_label:course===900?'حسابان':'فیزیک',topics:[
  {level:'subject',id:2,label:'موضوع یک',chapter_label:'فصل یک',path:{course,chapter:1,subject:2},sources:[reference]},
  ...[3,4].map(id=>({level:'object',id,label:id===3?'زیرمبحث اول':'زیرمبحث دوم',chapter_label:'فصل یک',path:{course,chapter:1,subject:2,object:id},sources:[reference]}))]}));
 const mock=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url=new URL(req.url,'http://localhost'),path=url.pathname.replace('/api/v1','');let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):{};
  const respond=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))};
  if(path==='/auth/me/')return respond({id:1,username:'report-student',role:'STUDENT',first_name:'دانش‌آموز'});
  if(path==='/exams/')return respond({count:0,next:null,previous:null,results:[]});
  if(path==='/exams/study-sources/topics/'){
   if(url.searchParams.get('period')==='week'){weekStarted=true;await pause(600);return respond({groups:[],unavailable_sources:0})}
   return respond({groups,unavailable_sources:1});
  }
  if(path==='/exams/study-sources/topics/preview/'){
   previews.push(input);await pause(100);
   if(previews.length===1){res.statusCode=503;return respond({detail:'موجودی موقتاً در دسترس نیست.'})}
   return respond({schema_version:1,course_scoped:true,exam_created:false,selected_topics:input.topics,provider_filters:{grade_id:700,course_id:input.course_id,chapter_ids:[1],subject_ids:[2],object_ids:input.topics.filter(t=>t.level==='object').map(t=>t.id)},availability:{easy:4,medium:2,hard:1,very_hard:0},warnings:[]});
  }
  if(path==='/exams/automatic/'){
   mutations.push(input);await pause(150);
   if(mutations.length===1){res.statusCode=503;return respond({detail:'خطای موقت ساخت؛ دوباره تلاش کنید.'})}
   res.statusCode=201;return respond({id:input.course_id,title:input.title,status:'PUBLISHED',question_count:input.easy_count,question_type:'1',duration_minutes:input.duration_minutes,is_personal_practice:true});
  }
  if(/^\/exams\/\d+\/start\/$/.test(path))return respond({participation_url:'https://quiz24.ir/exam/'+path.split('/')[2]});
  res.statusCode=404;respond({detail:'Unexpected route'});
 });
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));const apiPort=mock.address().port;
 const uiPort=3600+Math.floor(Math.random()*300),chromePort=uiPort+1000,profile=await mkdtemp(join(tmpdir(),'amootech-report-topics-'));
 const next=spawn('node',['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_API_BASE_URL:`http://127.0.0.1:${apiPort}/api/v1`},stdio:['ignore','pipe','pipe']});
 let logs='';next.stdout.on('data',c=>{logs+=c});next.stderr.on('data',c=>{logs+=c});
 const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 let browser;t.after(async()=>{browser?.close();chrome.kill();next.kill();mock.closeAllConnections();mock.close();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{})});
 const pages=await until(async()=>{const r=await fetch(`http://127.0.0.1:${chromePort}/json`);return(await r.json()).filter(p=>p.type==='page')},'Chrome missing');
 browser=await connect(pages[0].webSocketDebuggerUrl);const{evaluate:run,send}=browser;
 await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('amootech_student_access','report-test-token')"});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await until(()=>logs.includes('Ready'),'Next missing');await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/exams`});
 await until(()=>run("document.querySelectorAll('.exam-mode button').length===2"),'Entry points missing');
 await run("document.querySelectorAll('.exam-mode button')[1].click()");
 const form="document.querySelector('.report-topic-builder')";
 await until(()=>run(`!!${form}`),'Report builder missing');
 const click=text=>run(`{const b=[...${form}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing '+${JSON.stringify(text)});b.click()}`);
 const check=(course,text)=>run(`{const group=[...${form}.querySelectorAll('.report-course-group')].find(g=>g.getAttribute('aria-label')===${JSON.stringify(course)});const l=[...group.querySelectorAll('label')].find(l=>l.textContent.includes(${JSON.stringify(text)})&&l.querySelector('input[type=checkbox]'));l.querySelector('input').click()}`);
 const number=(course,index,value)=>run(`{const group=[...${form}.querySelectorAll('.report-course-group')].find(g=>g.getAttribute('aria-label')===${JSON.stringify(course)});const e=group.querySelectorAll('input[type=number]')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}`);
 await until(()=>run(`${form}.querySelectorAll('.report-course-group').length===2`),'Groups missing');
 assert.equal(await run(`${form}.querySelectorAll('select,.report-source-card').length`),0);
 assert.equal(await run(`${form}.querySelectorAll('input:checked').length`),0);
 await click('این هفته');await until(()=>weekStarted,'Week request missing');await click('امروز');await pause(750);
 assert.equal(await run(`${form}.querySelectorAll('.report-course-group').length`),2,'Stale response replaced today');
 await check('حسابان','زیرمبحث اول');await until(()=>run(`${form}.textContent.includes('موجودی موقتاً')`),'Inventory failure missing');
 await click('تلاش دوباره');await until(()=>run(`${form}.textContent.includes('موجود:')`),'Inventory retry failed');
 assert.equal(await run(`${form}.querySelectorAll('input:checked').length`),1);
 await number('حسابان',0,'5');
 assert.equal(await run(`${form}.querySelector('.exam-primary').disabled`),true,'Excess inventory accepted');
 await number('حسابان',0,'2');await check('فیزیک','زیرمبحث دوم');
 await until(()=>run(`${form}.querySelectorAll('.report-question-settings small').length>=8`),'Second inventory missing');
 await number('فیزیک',0,'1');
 await until(()=>run(`!${form}.querySelector('.exam-primary').disabled`),'Creation not enabled');
 await run(`${form}.querySelector('.exam-primary').click();${form}.querySelector('.exam-primary').click()`);
 await until(()=>run(`${form}.textContent.includes('خطای موقت ساخت')`),'Creation failure missing');
 assert.equal(mutations.length,1);assert.equal(await run(`${form}.querySelectorAll('input:checked').length`),2);
 await click('ساخت آزمون');await until(()=>run(`${form}.querySelectorAll('a[href^="https://quiz24.ir/exam/"]').length===2`),'Exam links missing');
 assert.equal(mutations.length,3);assert.equal(mutations[0].creation_key,mutations[1].creation_key,'Retry duplicated intent');
 assert.deepEqual(mutations.slice(1).map(m=>m.course_id),[900,910]);
 assert.deepEqual(mutations[1].report_context.topics,[{level:'object',id:3}]);
 assert.equal(mutations[1].report_context.confirmed,true);assert.equal(mutations[1].report_context.sources.length,1);
 assert.equal(await run(`${form}.getBoundingClientRect().width<=innerWidth`),true);
 await click('بازه دلخواه');assert.equal(await run(`${form}.querySelectorAll('input[type=date]').length`),2);
 assert.equal(await run(`${form}.querySelector('.exam-primary').disabled`),true);
});
