import type { ConfirmedTopic } from './reportTopics';
export type ReportReference = {report_item_id:number; source_revision:string};
export type ReportNode = ConfirmedTopic & {label:string; chapter_label:string; path:{course:number;chapter:number;subject?:number;object?:number}; sources:ReportReference[]};
export type ReportGroup = {grade_id:number; course_id:number; grade_label:string; course_label:string; topics:ReportNode[]};
export const reportGroupKey = (group:ReportGroup)=>`${group.grade_id}:${group.course_id}`;
export function reportContext(group:ReportGroup, topics:ConfirmedTopic[]) {
  const sources=new Map<number,ReportReference>();
  for(const topic of topics){
    const node=group.topics.find(n=>n.level===topic.level&&n.id===topic.id);
    for(const source of node?.sources??[])sources.set(source.report_item_id,source);
  }
  return {sources:[...sources.values()],grade_id:group.grade_id,course_id:group.course_id,topics,
    confirmed:true,question_type:1,consider_used_question:false};
}
export function selectReportTopic(topics:ConfirmedTopic[], node:ReportNode, nodes:ReportNode[]) {
  if(topics.some(t=>t.level===node.level&&t.id===node.id))return topics.filter(t=>t.level!==node.level||t.id!==node.id);
  return [...topics.filter(t=>{
    const other=nodes.find(n=>n.level===t.level&&n.id===t.id);
    return other && !(other.path[t.level]===node.path[t.level] || node.path[node.level]===other.path[node.level]);
  }),{level:node.level,id:node.id}];
}
export function safeExamLink(value:string) {
  const url=new URL(value);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('لینک آزمون معتبر نیست.');
  return url.href;
}
