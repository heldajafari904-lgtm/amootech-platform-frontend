import type { TopicNode } from '@/components/exams/taxonomy';
import type { Inventory } from './studentExam';

export type ConfirmedTopic = {level: 'chapter' | 'subject' | 'object'; id: number};
export type StudySource = {
  report_item_id: number; source_revision: string; report_date: string; title: string;
  reported_status: 'COMPLETED' | 'PARTIAL'; title_is_custom: boolean; classification: string;
  taxonomy_snapshot: {provider_context: {labels?: Record<string,string>} | null; internal: Record<string,number|null>};
  suggested_selection: {hierarchy: Record<string,{id:number;label:string}>} | null;
  resolution?: {state: string; reason: string|null; suggestion: {
    grade_id:number; course_id:number; grade_label:string; course_label:string;
    topics: (ConfirmedTopic & {label:string})[];
  } | null};
};
export type ReportDraft = {sources:number[]; topics:ConfirmedTopic[]};
export type ReportPreview = {schema_version:number; course_scoped:boolean; exam_created:boolean;
  grade_label:string; course_label:string; selected_topics:(ConfirmedTopic & {label:string})[];
  provider_filters:{grade_id:number;course_id:number;chapter_ids:number[];subject_ids:number[];object_ids:number[]};
  availability:Inventory; warnings:string[]; sources:StudySource[]};
export function sourceReferences(sources: StudySource[]) {
  return sources.map(row=>({report_item_id:row.report_item_id,source_revision:row.source_revision}));
}
export function toggleConfirmed(topics:ConfirmedTopic[], node:TopicNode, nodes:TopicNode[]):ConfirmedTopic[] {
  if(topics.some(row=>row.level===node.level && row.id===node.id)) return topics.filter(row=>row.level!==node.level || row.id!==node.id);
  return [...topics.filter(row=>{
    const other=nodes.find(n=>n.level===row.level && n.id===row.id);
    if(!other)return false;
    return !(row.level==='chapter' && row.id===node.chapter || node.level==='chapter' && node.id===other.chapter
      || row.level==='subject' && row.id===node.subject || node.level==='subject' && node.id===other.subject);
  }),{level:node.level,id:node.id}];
}
export function topicFilters(topics:ConfirmedTopic[], nodes:TopicNode[]) {
  const chapters=new Set<number>(), subjects=new Set<number>(), objects=new Set<number>();
  for(const topic of topics){
    const node=nodes.find(row=>row.level===topic.level && row.id===topic.id);
    if(!node)continue;
    chapters.add(node.chapter);
    if(node.level!=='chapter' && node.subject)subjects.add(node.subject);
    if(node.level==='object')objects.add(node.id);
  }
  return {chapter_ids:[...chapters],subject_ids:[...subjects],object_ids:[...objects]};
}
export function suggestedDrafts(sources:StudySource[], previous:Record<string,ReportDraft>={}) {
  const next={...previous};
  for(const source of sources){
    const suggestion=source.resolution?.suggestion;
    if(!suggestion)continue;
    const key=`${suggestion.grade_id}:${suggestion.course_id}`;
    const draft=next[key]??{sources:[],topics:[]};
    next[key]={...draft,sources:[...new Set([...draft.sources,source.report_item_id])]};
  }
  return next;
}
export function validPreview(value:ReportPreview) {
  return value?.schema_version===1 && value.course_scoped===true && value.exam_created===false
    && ['easy','medium','hard','very_hard'].every(key=>Number.isSafeInteger(value.availability?.[key as keyof Inventory]) && value.availability[key as keyof Inventory]>=0 && value.availability[key as keyof Inventory]<=2147483647)
    && Array.isArray(value.selected_topics) && value.selected_topics.length>0 && Array.isArray(value.warnings);
}
