// Run with RUN_QUESTION_BANK_BROWSER=1 node --test tests/question-bank-browser.test.mjs
// Uses installed Chrome + Node CDP, the actual Next app, and an isolated mock API. No live provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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

test('student question bank supports permitted grades, stale responses, multi-topics, preview and safe retry', {skip:process.env.RUN_QUESTION_BANK_BROWSER!=='1',timeout:180000}, async t=>{
  const creations=[],countRequests=[],starts=[];let slowStarted=false;
  const recorded=JSON.parse(await readFile(new URL('./fixtures/automatic-exam-catalog.json',import.meta.url),'utf8'));
  const tree=recorded.detail;
  const root=tree.result[0];
  const chapter=root.children.find(ch=>ch.children.some(sub=>sub.children?.length>=2));
  const subject=chapter.children.find(sub=>sub.children?.length>=2);
  const objects=subject.children.slice(0,2);
  const courseRow=recorded.courses.result.find(row=>row.courseId===root.key && row.gradeId===11);
  const otherCourse=recorded.courses.result.find(row=>row.gradeId===11 && row.courseId!==root.key);
  const mock=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const path=new URL(req.url,'http://localhost').pathname.replace('/api/v1','');let body='';for await(const part of req)body+=part;const input=body?JSON.parse(body):{};
    const respond=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    if(path==='/auth/me/')return respond({id:1,username:'mock-student',role:'STUDENT',first_name:'دانش‌آموز'});
    if(path==='/exams/')return respond({count:0,next:null,previous:null,results:[]});
    if(path==='/exams/provider/grades/')return respond(recorded.grades);
    if(path==='/exams/provider/courses/')return respond(recorded.courses);
    if(path==='/exams/provider/course-detail/'){
      if(input.course_id===root.key){slowStarted=true;await pause(500);return respond(tree);}
      return respond({result:[]});
    }
    if(path==='/exams/provider/question-count/'){
      countRequests.push(input);return respond({easy:input.course_id===root.key?3:0,medium:input.course_id===root.key?2:0,hard:0,very_hard:0});
    }
    if(path==='/exams/automatic/'){
      creations.push(input);await pause(200);
      if(creations.length===1){res.statusCode=503;return respond({detail:'ارتباط موقتاً قطع شد؛ با همان درخواست دوباره تلاش کنید.'});}
      return respond({id:1,title:input.title,status:'PUBLISHED',is_personal_practice:true,question_count:input.easy_count+input.medium_count,question_type:'1',duration_minutes:input.duration_minutes,result_available:false});
    }
    if(path==='/exams/1/start/'){
      starts.push(input);
      if(starts.length===1){res.statusCode=503;return respond({detail:'لینک شرکت موقتاً آماده نیست.'});}
      return respond({participation_url:`http://127.0.0.1:${mock.address().port}/participate`});
    }
    if(path==='/participate'){res.setHeader('Content-Type','text/html');res.end('<title>Participation</title>Exam participation');return;}
    res.statusCode=404;return respond({detail:'Unexpected mock route'});
  });
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));const apiPort=mock.address().port;
  const uiPort=3100+Math.floor(Math.random()*500),chromePort=uiPort+1000;const profile=await mkdtemp(join(tmpdir(),'amootech-bank-chrome-'));
  const next=spawn('node',['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_API_BASE_URL:`http://127.0.0.1:${apiPort}/api/v1`},stdio:['ignore','pipe','pipe']});
  let serverLog='';next.stdout.on('data',chunk=>{serverLog+=chunk});next.stderr.on('data',chunk=>{serverLog+=chunk});
  const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  let browser;t.after(async()=>{browser?.close();chrome.kill();next.kill();mock.closeAllConnections();mock.close();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});});
  const pages=await until(async()=>{const r=await fetch(`http://127.0.0.1:${chromePort}/json`);const pages=await r.json();return pages.some(p=>p.type==='page')?pages:null},'Chrome unavailable');
  browser=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);const{evaluate:run,send}=browser;
  await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('amootech_student_access','bank-test-token')"});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await until(()=>serverLog.includes('Ready'),`Next unavailable: ${serverLog}`);
  await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/student/exams`});
  await until(()=>run("!!document.querySelector('.exam-mode')"),'Exam center missing');
  assert.equal(await run("document.querySelectorAll('.exam-mode button')[1].disabled"),false);
  assert.equal(await run("document.querySelectorAll('.exam-mode button')[1].textContent.includes('آزمون از گزارش کار')"),true);
  assert.equal(creations.length,0);
  await run("document.querySelector('.exam-mode button').click()");
  const form="document.querySelector('.student-practice-form')";
  await until(()=>run(`${form}?.querySelectorAll('.automatic-catalog-tiles button').length===3`),'Permitted grades missing');
  assert.deepEqual(await run(`[...${form}.querySelectorAll('.automatic-catalog-tiles button')].map(b=>b.textContent)`),recorded.grades.result.map(row=>row.title));
  const click=text=>run(`{const b=[...${form}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Button missing');b.click()}`);
  const input=async(label,value)=>{await run(`{const e=[...${form}.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)})&&l.querySelector('input')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))}`);await pause(50)};
  const check=label=>run(`{const e=[...${form}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)}).querySelector('input');e.click()}`);
  const openChildren=label=>run(`{const b=[...${form}.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='جزئی‌تر: '+${JSON.stringify(label)});b.click()}`);
  await click(recorded.grades.result[0].title);await click(courseRow.courseName);
  await until(()=>slowStarted,'Detail not requested');await click('بازگشت');await click(otherCourse.courseName);
  await until(()=>run(`${form}.textContent.includes('مبحثی موجود نیست')`),'Empty tree not shown');await pause(700);
  assert.equal(await run(`!!${form}.querySelector('.automatic-topic-row')`),false,'Stale detail replaced course');
  await click('انتخاب همین محدوده');await until(()=>run(`${form}.textContent.includes('سؤال قابل استفاده‌ای موجود نیست')`),'Zero availability warning missing');
  assert.equal(await run(`[...${form}.querySelectorAll('button')].find(b=>b.textContent==='ادامه').disabled`),true);
  await click('بازگشت');await click('بازگشت');await click(courseRow.courseName);
  await until(()=>run(`!!${form}.querySelector('.automatic-topic-row')`),'Topic tree missing');
  assert.equal(await run(`${form}.querySelectorAll('details').length`),0);
  await openChildren(chapter.title);await openChildren(subject.title);
  await check(objects[0].title);await check(objects[1].title);
  await click('انتخاب همین محدوده');await until(()=>run(`${form}.querySelector('input[type=number]')?.disabled===false`),'Inventory missing');
  assert.deepEqual(countRequests.at(-1).object_ids,objects.map(row=>row.key));
  assert.deepEqual(countRequests.at(-1).chapter_ids,[chapter.key]);
  assert.deepEqual(countRequests.at(-1).subject_ids,[subject.key]);
  await input('آسان','4');assert.equal(await run(`[...${form}.querySelectorAll('button')].find(b=>b.textContent==='ادامه').disabled`),true);
  await input('آسان','2');await input('متوسط','1');await click('ادامه');await check('نمره منفی');await click('ادامه');
  assert.equal(creations.length,0,'Preview must not create an exam');
  assert.equal(await run(`${form}.textContent.includes(${JSON.stringify(objects[0].title)})&&${form}.textContent.includes(${JSON.stringify(objects[1].title)})`),true);
  assert.equal(await run(`${form}.querySelector('button[type=submit]').disabled`),true);
  await check('محدوده، تعداد سؤال‌ها و زمان را تأیید می‌کنم.');
  await click('بازگشت و ویرایش');await click('ادامه');
  assert.equal(await run(`${form}.querySelector('button[type=submit]').disabled`),true,'Preview changes require a new confirmation');
  await check('محدوده، تعداد سؤال‌ها و زمان را تأیید می‌کنم.');
  await run(`${form}.requestSubmit();${form}.requestSubmit()`);
  await until(()=>run(`${form}?.textContent.includes('ارتباط موقتاً قطع شد')`),'Create error missing');assert.equal(creations.length,1);
  await click('ساخت آزمون');await until(()=>run("!document.querySelector('.student-practice-form')"),'Create retry failed');
  assert.equal(creations.length,2);assert.equal(creations[0].creation_key,creations[1].creation_key);
  assert.deepEqual(creations[1].object_ids,objects.map(row=>row.key));assert.equal(creations[1].has_negative_score,true);assert.equal('student' in creations[1],false);
  assert.equal(await run("document.body.textContent.includes('آزمون تمرینی ساخته شد')"),true);
  assert.equal(await run(`document.querySelector('.exam-card')?.textContent.includes(${JSON.stringify(creations[1].title)})`),true);
  assert.equal(await run("[...document.querySelectorAll('.exam-card button')].some(b=>b.textContent.includes('شروع آزمون'))"),true);
  await until(()=>run("document.body.textContent.includes('لینک شرکت موقتاً آماده نیست')"),'Automatic participation missing');
  assert.equal(starts.length,1);
  // The next builder instance starts clean; changing grade cannot retain another grade's course.
  await run("document.querySelector('.exam-mode button').click()");
  await until(()=>run(`${form}?.querySelectorAll('.automatic-catalog-tiles button').length===3`),'Builder reopen failed');
  await click(recorded.grades.result[0].title);await click(courseRow.courseName);await click('بازگشت');await click('بازگشت به پایه');
  await click(recorded.grades.result[1].title);
  assert.equal(await run(`${form}.querySelector('.question-bank-summary')===null`),true);
  assert.equal(await run(`${form}.getBoundingClientRect().width<=innerWidth`),true);
  await run(`${form}.querySelector('.automatic-catalog-tiles button').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await run(`${form}.contains(document.activeElement)`),true);
  await run("[...document.querySelectorAll('button')].find(b=>b.textContent==='تلاش دوباره برای ورود').click()");
  await until(()=>run("location.pathname==='/participate'"),'Participation redirect missing');
  assert.equal(starts.length,2);assert.equal(creations.length,2,'Participation retry recreated exam');

});
