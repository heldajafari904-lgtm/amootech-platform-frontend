// Optional browser integration: RUN_PLANNER_BROWSER=1 node --test tests/planner-content-browser.test.mjs
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

test('planner add/edit: text, taxonomy, manual reset, stale responses, retry, keyboard and mobile', { skip: process.env.RUN_PLANNER_BROWSER !== '1', timeout: 240000 }, async t => {
  const contract = JSON.parse(await readFile(new URL('./fixtures/activity-api-contract.json',import.meta.url),'utf8'));
  let useContract = false;
  let gradeMode = 'normal';
  let missingProfile = false;
  const user = {id:1,username:'counselor-test',role:'COUNSELOR',first_name:'مشاور',last_name:''};
  const student = {id:1,user:{...user,id:2,role:'STUDENT',first_name:'دانش‌آموز'},grade:17,grade_name:'هفتم',field:1,field_name:'عمومی',school_name:''};
  const plan = {id:1,student:1,counselor:1,title:'برنامه تست',start_date:'2026-10-20',end_date:'2026-10-26',status:'DRAFT',published_at:null,days:[{id:1,plan:1,date:'2026-10-20',items:[]}]};
  const mutations = [];
  let slowDetailStarted = false;
  let catalogMode = 'normal';
  let failedOnce = false;
  let delaySave = false;
  const node = (key,title,type,parentId,children=[]) => ({key,title,type,parentId,children});
  const mock = createServer(async (req,res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const path = new URL(req.url,'http://localhost').pathname.replace('/api/v1','');
    let body = ''; for await (const chunk of req) body += chunk;
    const input = body ? JSON.parse(body) : {};
    const respond = value => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
    if (path === '/auth/me/') return respond(user);
    if (path === '/students/1/') { if (missingProfile) {res.statusCode=404;return respond({detail:'Student profile not found'});} return respond(student); }
    if (path === '/planning/plans/') return respond({count:1,next:null,previous:null,results:[plan]});
    if (path === '/planning/plans/1/') return respond(plan);
    if (path === '/academics/grades/' && useContract) return respond(contract.canonical);
    if (path === '/academics/grades/') return respond({count:7,next:null,previous:null,results:[{id:1,name:'اول',number:1},{id:17,name:'هفتم',number:7},{id:18,name:'هشتم',number:8},{id:19,name:'نهم',number:9},{id:20,name:'دهم',number:10},{id:21,name:'یازدهم',number:11},{id:22,name:'دوازدهم',number:12}]});
    if (path === '/academics/tree/') return respond({subjects:[],chapters:[],topics:[]});
    if (/commitments|school-slots/.test(path)) return respond({count:0,next:null,previous:null,results:[]});
    if (/progress/.test(path)) return respond({});
    if (path === '/exams/provider/grades/' && gradeMode==='null') return respond(null);
    if (path === '/exams/provider/grades/' && gradeMode==='error') {res.statusCode=503;return respond({detail:'خطا در دریافت پایه‌ها'});}
    if (path === '/exams/provider/grades/' && gradeMode==='empty') return respond({status:100,result:[]});
    if (path === '/exams/provider/grades/' && useContract) return respond(contract.grades);
    if (path === '/exams/provider/grades/') return respond({result:[{id:700,name:'هفتم'},{id:800,name:'هشتم'},{id:1000,name:'دهم'},{id:1100,name:'یازدهم'},{id:1200,name:'دوازدهم'},{id:100,name:'اول'}]});
    if (path === '/exams/provider/courses/' && useContract) return respond(contract.courses);
    if (path === '/exams/provider/courses/') return respond({result:[{id:900,name:'فیزیک',gradeId:700},{id:901,name:'شیمی',gradeId:700},{id:902,name:'علوم',gradeId:800},{id:903,name:'زیست',gradeId:800}]});
    if (path === '/exams/provider/course-detail/') {
      if (useContract) {assert.equal(input.grade_id,contract.created.taxonomy.grade);assert.equal(input.course_id,contract.created.taxonomy.course);return respond(contract.detail);}
      if (input.course_id === 900) {
        slowDetailStarted = true; await pause(600);
        return respond({result:[node(900,'فیزیک',1,null,[node(910,'حرکت',2,900,[node(920,'سرعت',3,910,[node(930,'سرعت متوسط',4,920)])])])]});
      }
      if (input.course_id === 902 && catalogMode === 'error' && !failedOnce) { failedOnce = true; res.statusCode=503; return respond({detail:'فهرست موقتاً در دسترس نیست'}); }
      if (input.course_id === 903 && catalogMode === 'malformed') return respond({result:{bad:true}});
      return respond({result:[]});
    }
    if (/^\/planning\/items\/(?:\d+\/)?$/.test(path) && ['POST','PATCH'].includes(req.method)) {
      mutations.push(input);
      if (delaySave) await pause(300);
      const existing = req.method === 'PATCH' ? plan.days[0].items.find(item => item.id === Number(path.split('/')[3])) : null;
      const labels = input.taxonomy?.labels ?? existing?.taxonomy?.labels ?? {};
      const generated = labels.course ? labels.course + ((labels.object || labels.subject || labels.chapter) ? ' — ' + (labels.object || labels.subject || labels.chapter) : '') : labels.grade || '';
      const item = {...existing,...input,id:existing?.id ?? mutations.length,counselor_editable:true,title:input.title ?? generated,title_is_custom:input.title !== undefined,generated_title:generated};
      if (existing) Object.assign(existing,item); else plan.days[0].items.push(item);
      return respond(item);
    }
    // No exam mutation route exists in this mock; unexpected calls are failures.
    res.statusCode=404; respond({detail:`Unexpected mock route: ${path}`});
  });
  await new Promise(resolve => mock.listen(0,'127.0.0.1',resolve));
  const apiPort = mock.address().port;
  const uiPort = 3100 + Math.floor(Math.random()*500);
  const chromePort = uiPort + 1000;
  const profile = await mkdtemp(join(tmpdir(),'amootech-planner-chrome-'));
  const next = spawn('node',['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(uiPort)],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_API_BASE_URL:`http://127.0.0.1:${apiPort}/api/v1`},stdio:['ignore','pipe','pipe']});
  let serverLog = ''; next.stdout.on('data',chunk=>{serverLog+=chunk}); next.stderr.on('data',chunk=>{serverLog+=chunk});
  const chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--no-proxy-server',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  let browser;
  t.after(async()=>{browser?.close();chrome.kill();next.kill();mock.closeAllConnections();mock.close();await pause(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});});
  await until(async()=>{const response=await fetch(`http://127.0.0.1:${chromePort}/json`);return (await response.json()).find(page=>page.type==='page')},'Chrome unavailable');
  const pages = await (await fetch(`http://127.0.0.1:${chromePort}/json`)).json();
  browser = await connect(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  const {evaluate:run,send}=browser;
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('amootech_counselor_access','mock-planner-token')"});
  await until(()=>serverLog.includes('Ready'),`Next did not start: ${serverLog}`);
  await send('Page.navigate',{url:`http://127.0.0.1:${uiPort}/counselor/students/1/planning?plan=1`});
  await until(()=>run("!!document.querySelector('.ws-day-row')"),`Workspace failed: ${serverLog}`);
  const form = "document.querySelector('.flex-activity-editor')";
  const click = text => run(`{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)} && b.getClientRects().length);if(!b)throw new Error('Button missing');b.click()}`);
  const input = (selector,value) => run(`{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))}`);
  const title = () => run(`${form}?.querySelector('input[name="title"]').value`);
  const choose = async text => { await until(()=>run(`[...${form}.querySelectorAll('.flex-choice-grid button')].some(b=>b.textContent===${JSON.stringify(text)})`),`Missing choice: ${text}`); await click(text); assert.equal(await run(`${form}.querySelectorAll('.flex-choice-grid').length <= 1`),true); assert.equal(await run(`${form}.querySelector('input[name="title"]').disabled`),false); assert.equal(await run(`${form}.querySelector('button[type="submit"]').textContent`),'تمام در همین مرحله'); };
  const back = () => click('بازگشت');
  const open = async()=>{await click('＋ افزودن باکس');await until(()=>run(`!!${form}`),'Editor missing');};
  const waitTitle = text => until(async()=>await title()===text,`Expected title: ${text}`);
  const finish = async()=>{await click('تمام در همین مرحله');await until(()=>run(`!${form}`),'Save failed');};
  await open();
  assert.equal(await run(`${form}.querySelector('input[name="title"]').disabled`),false);
  await until(()=>run(`${form}.querySelector('.flex-choice-grid')?.textContent.includes('هفتم')`),'Grades missing');
  assert.equal(await run(`${form}.querySelector('.flex-choice-grid').textContent.includes('دهم')`),false);
  assert.equal(await run(`${form}.querySelectorAll('input').length`),1);
  assert.equal(await run(`${form}.querySelectorAll('select, textarea, details, [role="tablist"], progress').length`),0);
  assert.equal(await run(`${form}.textContent.includes('مرحله 1 از')`),false);
  assert.equal(await run(`[...${form}.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>!['هفتم','هشتم','تمام در همین مرحله'].includes(t)).length`),0);
  await input('input[name="title"]','مطالعه آزاد');
  delaySave=true;
  await run(`${form}.requestSubmit();${form}.requestSubmit()`);
  await until(()=>run(`!${form}`),'Text save failed');
  assert.equal(mutations.length,1);assert.equal(mutations[0].title,'مطالعه آزاد');assert.deepEqual(mutations[0].taxonomy,{});
  delaySave=false;
  await open();await choose('هفتم');
  await until(()=>run(`${form}.querySelector('.flex-choice-grid')?.textContent.includes('فیزیک')`),'Courses did not replace grades');
  assert.equal(await run(`${form}.querySelector('.flex-choice-grid').textContent.includes('هفتم')`),false);
  await choose('فیزیک');await waitTitle('فیزیک');
  await until(()=>slowDetailStarted,'Detail was not requested');
  await back();await choose('شیمی');await waitTitle('شیمی');await pause(800);
  assert.equal(await run(`${form}.querySelector('.flex-choice-grid').textContent.includes('حرکت')`),false);
  assert.equal(await run(`${form}.textContent.includes('گزینه‌ای برای فصل')`),true);
  await back();await choose('فیزیک');await choose('حرکت');await waitTitle('فیزیک — حرکت');
  await input('input[name="title"]','عنوان دستی');
  await back();await waitTitle('عنوان دستی');
  assert.equal(await run(`${form}.querySelector('button[aria-pressed="true"]').textContent`),'حرکت');
  await choose('حرکت');await waitTitle('عنوان دستی');
  await until(()=>run(`${form}.querySelector('.flex-choice-grid button')?.textContent==='سرعت'`),'Subject missing');
  await run(`${form}.querySelector('.flex-choice-grid button').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'char',text:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitTitle('فیزیک — سرعت');await choose('سرعت متوسط');await waitTitle('فیزیک — سرعت متوسط');
  await input('input[name="title"]','آخرین ویرایش');await finish();
  assert.equal(mutations[1].taxonomy.object,930);assert.equal(mutations[1].title,'آخرین ویرایش');
  Object.assign(plan.days[0].items[1],{kind:'TEST',planned_duration_minutes:75,test_count:25,start_time:'10:00',end_time:'11:15',note:'یادداشت محفوظ'});
  await run("[...document.querySelectorAll('.ws-box')].find(card=>card.textContent.includes('آخرین ویرایش')).querySelector('button[aria-label=\"ویرایش\"]').click()");
  await waitTitle('آخرین ویرایش');await choose('هفتم');await waitTitle('آخرین ویرایش');await choose('شیمی');await waitTitle('شیمی');await finish();
  for (const key of ['kind','planned_duration_minutes','test_count','start_time','end_time','note','ordering','plan_day']) assert.equal(key in mutations[2],false);
  assert.equal(plan.days[0].items[1].kind,'TEST');
  assert.equal(plan.days[0].items[1].planned_duration_minutes,75);
  assert.equal(plan.days[0].items[1].test_count,25);
  assert.equal(plan.days[0].items[1].start_time,'10:00');
  assert.equal(plan.days[0].items[1].end_time,'11:15');
  assert.equal(plan.days[0].items[1].note,'یادداشت محفوظ');
  assert.equal(mutations[2].reset_generated_title,true);assert.equal(mutations[2].taxonomy.object,undefined);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await open();await choose('هشتم');catalogMode='error';await choose('علوم');
  await until(()=>run(`${form}.textContent.includes('فهرست موقتاً')`),'Catalog error missing');
  await input('input[name="title"]','هنگام خطا');await click('تلاش دوباره');
  await until(()=>run(`${form}.textContent.includes('گزینه‌ای برای فصل')`),'Retry failed');await waitTitle('هنگام خطا');
  await back();catalogMode='malformed';await choose('زیست');
  await until(()=>run(`${form}.textContent.includes('ساختار فهرست معتبر نیست')`),'Malformed catalog missing');
  catalogMode='normal';await click('تلاش دوباره');
  await until(()=>run(`!${form}.textContent.includes('ساختار فهرست معتبر نیست')`),'Malformed retry failed');
  assert.equal(await run(`document.querySelector('.flex-editor-dialog').getBoundingClientRect().width <= innerWidth`),true);
  assert.equal(await run(`${form}.dir`),'rtl');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
  assert.equal(await run(`${form}.closest('[role="dialog"]').contains(document.activeElement)`),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await until(()=>run(`!${form}`),'Escape did not close editor');
  assert.equal(mutations.length,3);
  // Finish at every taxonomy depth, preserving the last manual edit.
  for (let depth=0;depth<5;depth++) {
    await open();
    for (const choice of ['هفتم','فیزیک','حرکت','سرعت','سرعت متوسط'].slice(0,depth+1)) await choose(choice);
    await input('input[name="title"]',`مرحله ${depth}`);await finish();
    assert.equal(mutations.at(-1).title,`مرحله ${depth}`);
    assert.ok(mutations.at(-1).taxonomy[['grade','course','chapter','subject','object'][depth]]);
  }
  assert.equal(mutations.length,8);
  for (const [grade, expected] of [[20,['دهم','یازدهم','دوازدهم']],[1,['اول']],[null,[]]]) {
    student.grade=grade;
    await run('window.__plannerReload=1');
    await send('Page.reload');
    await until(()=>run("!window.__plannerReload && !!document.querySelector('.ws-day-row')"),'Workspace reload failed');
    await open();
    await until(()=>run(`!!${form}.querySelector('.flex-choice-grid') || ${form}.textContent.includes('پایه معتبر دانش‌آموز مشخص نیست')`),'Period context missing');
    assert.deepEqual(await run(`[...${form}.querySelectorAll('.flex-choice-grid button')].map(b=>b.textContent)`),expected);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await until(()=>run(`!${form}`),'Escape did not close editor');
  }
  useContract=true;
  const reload = async()=>{
    await run('window.__plannerReload=1');await send('Page.reload');
    await until(()=>run("!window.__plannerReload && !!document.querySelector('.ws-day-row')"),'Contract workspace missing');
  };
  for (const profile of contract.profiles) {
    Object.assign(student,{grade:profile.grade,grade_name:profile.grade_name,field:profile.field,field_name:profile.field_name});
    await reload();await open();
    await until(()=>run(`${form}.querySelector('.flex-choice-grid')?.textContent.includes('دهم')`),'Real upper-secondary grades missing');
    assert.deepEqual(await run(`[...${form}.querySelectorAll('.flex-choice-grid button')].map(b=>b.textContent)`),['دهم','یازدهم','دوازدهم']);
    await choose('دهم');
    const expected=contract.courses.result.filter(row=>row.gradeId===contract.created.taxonomy.grade).map(row=>row.courseName);
    await until(()=>run(`${form}.querySelector('.flex-choice-grid button')?.textContent===${JSON.stringify(expected[0])}`),'Real courses missing');
    assert.deepEqual(await run(`[...${form}.querySelectorAll('.flex-choice-grid button')].map(b=>b.textContent)`),expected);
    if (profile!==contract.profiles.at(-1)) {
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await until(()=>run(`!${form}`),'Close failed');continue;
    }
    for (const level of ['course','chapter','subject','object']) await choose(contract.created.taxonomy.labels[level]);
    delaySave=true;await run(`${form}.requestSubmit();${form}.requestSubmit()`);await until(()=>run(`!${form}`),'Real contract save failed');
    assert.equal(mutations.length,9);
    for (const key of ['grade','course','chapter','subject','object']) assert.equal(mutations.at(-1).taxonomy[key],contract.created.taxonomy[key]);
  }
  gradeMode='error';await reload();await open();
  await until(()=>run(`${form}.textContent.includes('خطا در دریافت پایه‌ها')`),'Grade API error missing');
  assert.equal(await run(`${form}.textContent.includes('گزینه‌ای برای پایه')`),false);
  gradeMode='normal';await click('تلاش دوباره');
  await until(()=>run(`${form}.querySelector('.flex-choice-grid')?.textContent.includes('دهم')`),'Grade retry failed');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await until(()=>run(`!${form}`),'Close failed');
  gradeMode='empty';await reload();await open();
  await until(()=>run(`${form}.textContent.includes('گزینه‌ای برای پایه')`),'Genuine empty catalog missing');
  assert.equal(await run(`${form}.querySelector('[role="alert"]')===null`),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await until(()=>run(`!${form}`),'Close failed');
  gradeMode='null';await reload();await open();
  await until(()=>run(`${form}.textContent.includes('پاسخ فهرست آموزشی معتبر نیست')`),'Null API response was treated as loading or empty');
  assert.equal(await run(`${form}.textContent.includes('گزینه‌ای برای پایه')`),false);
  gradeMode='normal';await click('تلاش دوباره');
  await until(()=>run(`${form}.querySelector('.flex-choice-grid')?.textContent.includes('دهم')`),'Null response retry failed');
  missingProfile=true;await run('window.__plannerReload=1');await send('Page.reload');
  await until(()=>run("!window.__plannerReload && document.body.textContent.includes('Student profile not found')"),'Missing profile error missing');
  assert.equal(await run(`!!${form}`),false);

});
