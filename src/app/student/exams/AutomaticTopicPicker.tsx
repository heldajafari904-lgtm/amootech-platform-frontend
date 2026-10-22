"use client";
import { useState } from 'react';
import { topicNodes, type TopicNode } from '@/components/exams/taxonomy';
import { emptyTopics, scopeNodes, selectScope, validTopicSelection, type TopicSelection } from './questionBank';

export default function AutomaticTopicPicker({ taxonomy, selection, onChange, onConfirm }: { taxonomy: unknown; selection: TopicSelection; onChange: (value: TopicSelection) => void; onConfirm: () => void }) {
  const [chapter, setChapter] = useState<number>();
  const [subject, setSubject] = useState<number>();
  const nodes = topicNodes(taxonomy);
  const selected = scopeNodes(selection, nodes);
  const level = subject ? 'object' : chapter ? 'subject' : 'chapter';
  const label = subject ? 'زیرمبحث' : chapter ? 'مبحث' : 'فصل';
  const rows = nodes.filter(row => row.level === level && (!chapter || row.chapter === chapter) && (!subject || row.subject === subject));
  function refine(node: TopicNode) {
    // Browsing never changes scope. Only an explicit check replaces a selection.
    if (node.level === 'chapter') { setChapter(node.id); setSubject(undefined); }
    else setSubject(node.id);
  }
  return <section className="automatic-topic-stage exam-wide" aria-label="انتخاب محدوده آزمون">
    <div className="exam-section-heading"><strong>{label} · اختیاری</strong>{chapter && <button type="button" className="exam-secondary" onClick={() => subject ? setSubject(undefined) : setChapter(undefined)}>بازگشت به {subject ? 'مبحث' : 'فصل'}</button>}</div>
    {(chapter || subject) && <p aria-label="مسیر مرور">{[nodes.find(row => row.level === 'chapter' && row.id === chapter)?.name,nodes.find(row => row.level === 'subject' && row.id === subject)?.name].filter(Boolean).join(' > ')}</p>}
    <p className="exam-muted">انتخاب سطح جدید جایگزین محدوده قبلی می‌شود. چند گزینه از یک سطح قابل انتخاب‌اند.</p>
    <div className="automatic-topic-rows">{rows.map(row => <div className="automatic-topic-row" key={row.id}>
      <label className="question-bank-check"><input type="checkbox" checked={selected.some(item => item.level === row.level && item.id === row.id)} onChange={() => onChange(selectScope(selection,row,nodes))}/>{row.name}</label>
      {row.level !== 'object' && nodes.some(child => child.level === (row.level === 'chapter' ? 'subject' : 'object') && (row.level === 'chapter' ? child.chapter === row.id : child.subject === row.id)) && <button type="button" className="exam-secondary" onClick={() => refine(row)} aria-label={`جزئی‌تر: ${row.name}`}>جزئی‌تر</button>}
    </div>)}</div>
    {!rows.length && <p className="exam-muted">در این سطح گزینه‌ای موجود نیست؛ محدوده انتخاب‌شده را تأیید کنید یا بازگردید.</p>}
    <p className="exam-muted">{selection.object_ids.length ? 'فقط زیرمبحث‌های انتخاب‌شده پوشش داده می‌شوند.' : selection.subject_ids.length ? 'همه زیرمبحث‌های مباحث انتخاب‌شده پوشش داده می‌شوند.' : selection.chapter_ids.length ? 'توجه: همه مباحث فصل‌های انتخاب‌شده در محدوده آزمون هستند.' : 'توجه: هیچ مبحثی انتخاب نشده؛ با تأیید، کل درس در محدوده آزمون خواهد بود.'}</p>
    {!!selected.length && <button type="button" className="exam-secondary" onClick={() => onChange(emptyTopics())}>انتخاب کل درس</button>}
    <button type="button" className="exam-primary" disabled={!validTopicSelection(selection,nodes)} onClick={onConfirm}>انتخاب همین محدوده</button>
  </section>;
}
