/** Selection intent is independent of the currently browsed grade/course. */
export type Level = 'chapter' | 'subject' | 'object';
export type Reference = {report_item_id:number; source_revision:string};
export type ScopeNode = {level:Level; id:number; label:string; chapter_label?:string; path:{course:number;chapter:number;subject?:number;object?:number}; sources?:Reference[]};
export const difficultyLabels = {easy:'آسان',medium:'متوسط',hard:'سخت',very_hard:'خیلی سخت'};
export type Difficulty = keyof typeof difficultyLabels;
export type Counts = Record<Difficulty,string>;
export type Inventory = Record<Difficulty,number>;
export type Entry = {
 gradeId:number;courseId:number;gradeLabel:string;courseLabel:string;topics:ScopeNode[];wholeCourse:boolean;
 counts:Counts;duration:string;title:string;questionType:number;negative:boolean;considerUsed:boolean;
 report:boolean;reselected:boolean;reportSources:Reference[];schedule?:Record<string,string|null>;
 scheduleDraft?:Record<string,{date:string;time:string}>;created?:{id:number;title:string};
};
export type Basket = {version:1;entries:Record<string,Entry>;grade:string;active:string};
export const emptyBasket = ():Basket=>({version:1,entries:{},grade:'',active:''});
export const entryKey = (entry:Pick<Entry,'gradeId'|'courseId'>)=>`${entry.gradeId}:${entry.courseId}`;
export function newEntry(gradeId:number,courseId:number,gradeLabel:string,courseLabel:string,report=false):Entry {
 return {gradeId,courseId,gradeLabel,courseLabel,topics:[],wholeCourse:false,counts:{easy:'0',medium:'0',hard:'0',very_hard:'0'},duration:'30',title:'',questionType:1,negative:false,considerUsed:false,report,reselected:false,reportSources:[]};
}
export function selected(entry:Entry) {return entry.wholeCourse||entry.topics.length>0;}
export function total(entry:Entry) {return Object.values(entry.counts).reduce((n,value)=>n+(/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):0),0);}
export function editEntry(basket:Basket,key:string,change:Partial<Entry>):Basket {
 const current=basket.entries[key];if(!current)return basket;
 return {...basket,entries:{...basket.entries,[key]:{...current,...change,created:undefined}}};
}
export function toggleNode(entry:Entry,node:ScopeNode):Entry {
 if(node.path.course!==entry.courseId)throw Error('مبحث متعلق به این درس نیست.');
 const same=(other:ScopeNode)=>other.level===node.level&&other.id===node.id;
 const topics=entry.topics.some(same)?entry.topics.filter(other=>!same(other)):[...entry.topics.filter(other=>!(other.path[node.level]===node.id||node.path[other.level]===other.id)),node];
 return {...entry,topics,wholeCourse:false,created:undefined};
}
export function filters(entry:Entry) {
 if(!selected(entry))throw Error('کل درس یا مبحث را صریحاً انتخاب کنید.');
 if(entry.wholeCourse&&entry.topics.length)throw Error('کل درس و مباحث هم‌زمان مجاز نیستند.');
 const levels=new Set(entry.topics.map(node=>node.level));
 if(levels.size>1)throw Error('برای شمارش دقیق، مباحث مستقل را از یک سطح انتخاب کنید. انتخاب‌ها حفظ شده‌اند.');
 for(const node of entry.topics) {
  if(node.path.course!==entry.courseId||node.path[node.level]!==node.id||!node.path.chapter||(node.level==='object'&&!node.path.subject))throw Error('مسیر مبحث معتبر نیست؛ دوباره از فهرست انتخاب کنید.');
 }
 const ids=(level:Level)=>[...new Set(entry.topics.flatMap(node=>node.path[level]?[node.path[level] as number]:[]))].sort((a,b)=>a-b);
 return {grade_id:entry.gradeId,course_id:entry.courseId,chapter_ids:ids('chapter'),subject_ids:ids('subject'),object_ids:ids('object'),question_type:entry.questionType,consider_used_question:entry.considerUsed};
}
export function references(entry:Entry):Reference[] {
 const result=new Map<number,Reference>();
 const refs=[...entry.topics.flatMap(node=>node.sources??[]),...(entry.reselected||entry.wholeCourse?entry.reportSources:[])];
 for(const reference of refs) {
  const previous=result.get(reference.report_item_id);
  if(previous&&previous.source_revision!==reference.source_revision)throw Error('نسخه گزارش‌ها یکسان نیست؛ مباحث گزارش را دوباره دریافت کنید.');
  result.set(reference.report_item_id,reference);
 }
 return [...result.values()].sort((a,b)=>a.report_item_id-b.report_item_id);
}
export function reportContext(entry:Entry) {
 const scope=filters(entry),sources=references(entry);
 if(!sources.length)throw Error('منبع گزارش معتبر موجود نیست؛ بازه گزارش را دوباره دریافت کنید.');
 return {sources,grade_id:scope.grade_id,course_id:scope.course_id,topics:entry.topics.map(({level,id})=>({level,id})),whole_course:entry.wholeCourse,reselected:entry.reselected,confirmed:true,question_type:entry.questionType,consider_used_question:entry.considerUsed};
}
export function countsValid(entry:Entry,inventory:Inventory|null) {
 return !!inventory&&Object.keys(difficultyLabels).every(key=>{
  const value=entry.counts[key as Difficulty];return /^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=inventory[key as Difficulty];
 })&&total(entry)>0&&total(entry)<=2147483647;
}
export function creationPayload(entry:Entry,studentIds:number[]=[]) {
 const {grade_id,...scope}=filters(entry);
 return {...scope,grade_external_id:grade_id,title:entry.title.trim()||`آزمون ${entry.courseLabel}`,duration_minutes:Number(entry.duration),has_negative_score:entry.negative,
  ...Object.fromEntries(Object.entries(entry.counts).map(([key,value])=>[`${key}_count`,Number(value)])),
  ...(entry.report?{report_context:reportContext(entry)}:{}),
  ...(studentIds.length?{student_ids:[...studentIds].sort((a,b)=>a-b),...(entry.schedule?{schedule:entry.schedule}:{})}:{})};
}
export function restoreBasket(value:string|null):Basket {
 if(!value)return emptyBasket();
 const parsed=JSON.parse(value);
 if(parsed?.version!==1||!parsed.entries||typeof parsed.entries!=='object'||Array.isArray(parsed.entries)||typeof parsed.grade!=='string'||typeof parsed.active!=='string')throw Error('پیش‌نویس ذخیره‌شده معتبر نیست.');
 for(const [key,entry] of Object.entries(parsed.entries) as [string,Entry][]) {
  const positive=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
  const validReferences=(refs:unknown)=>Array.isArray(refs)&&refs.every(ref=>ref&&positive(ref.report_item_id)&&typeof ref.source_revision==='string'&&/^[a-f0-9]{64}$/.test(ref.source_revision));
  if(!entry||entryKey(entry)!==key||!positive(entry.gradeId)||!positive(entry.courseId)||
    typeof entry.gradeLabel!=='string'||typeof entry.courseLabel!=='string'||
    !Array.isArray(entry.topics)||!entry.counts||Object.keys(difficultyLabels).some(key=>typeof entry.counts[key as Difficulty]!=='string')||
    typeof entry.duration!=='string'||typeof entry.title!=='string'||!validReferences(entry.reportSources)||
    ![1,2].includes(entry.questionType)||['wholeCourse','negative','considerUsed','report','reselected'].some(key=>typeof entry[key as keyof Entry]!=='boolean')||
    entry.topics.some(node=>!node||!['chapter','subject','object'].includes(node.level)||!positive(node.id)||typeof node.label!=='string'||!node.path||
     node.path.course!==entry.courseId||!positive(node.path.chapter)||node.path[node.level]!==node.id||
     node.level==='object'&&!positive(node.path.subject)||node.sources!==undefined&&!validReferences(node.sources)))throw Error('پیش‌نویس ذخیره‌شده معتبر نیست.');
 }
 return {...parsed,active:parsed.entries[parsed.active]?parsed.active:''};
}
