"use client";
import { useState } from "react";
import { topicNodes } from "@/components/exams/taxonomy";
import { toggleTopic, type TopicSelection } from "./questionBank";
import { toggleConfirmed, type ConfirmedTopic } from "./reportTopics";

export default function TopicPicker({ taxonomy, selection, onChange, exactSelection, onExactChange }: { taxonomy: unknown; selection: TopicSelection; onChange: (next: TopicSelection) => void; exactSelection?: ConfirmedTopic[]; onExactChange?: (next:ConfirmedTopic[])=>void }) {
  const [search, setSearch] = useState('');
  const nodes = topicNodes(taxonomy);
  const matches = (name: string) => name.includes(search.trim());
  const chapters = nodes.filter(node => node.level === 'chapter');
  const checked = (node: (typeof nodes)[number]) => exactSelection ? exactSelection.some(row=>row.level===node.level && row.id===node.id) : selection[`${node.level}_ids`].includes(node.id);
  const toggle = (node: (typeof nodes)[number]) => exactSelection && onExactChange ? onExactChange(toggleConfirmed(exactSelection,node,nodes)) : onChange(toggleTopic(selection,node,nodes));
  return <section className="question-bank-topics exam-wide" aria-label="انتخاب فصل‌ها و مباحث">
    <div className="exam-section-heading"><strong>{exactSelection ? 'مباحث واقعاً مطالعه‌شده' : 'فصل و مبحث · اختیاری'}</strong><button type="button" className="exam-secondary" onClick={() => exactSelection && onExactChange ? onExactChange([]) : onChange({ chapter_ids: [], subject_ids: [], object_ids: [] })}>پاک کردن مباحث</button></div>
    <label>جست‌وجوی فصل و مبحث<input type="search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}/></label>
    <p className="exam-muted">{exactSelection ? 'فقط مباحثی را انتخاب کنید که واقعاً مطالعه کرده‌اید. انتخاب کل فصل شامل همه مباحث آن است؛ انتخاب زیرمبحث جایگزین کل والد می‌شود. مباحث مستقل را از یک سطح انتخاب کنید.' : 'می‌توانید چند مبحث انتخاب کنید. انتخاب سطح جزئی‌تر، محدوده سؤال‌ها را محدود می‌کند.'}</p>
    {!chapters.length && <p>{exactSelection ? 'برای این درس مبحثی جهت تأیید موجود نیست.' : 'برای این درس مبحثی موجود نیست؛ فقط محدوده کل درس قابل انتخاب است.'}</p>}
    {!!search && !nodes.some(node => matches(node.name)) && <p>مبحثی با این نام پیدا نشد.</p>}
    {chapters.filter(chapter => !search || nodes.some(row => row.chapter === chapter.id && matches(row.name))).map(chapter => <details className="question-bank-chapter" key={chapter.id} open={search ? true : undefined}>
      <summary>{chapter.name}</summary>
      <label className="question-bank-check"><input type="checkbox" checked={checked(chapter)} onChange={() => toggle(chapter)}/>{exactSelection ? 'انتخاب کل ' : 'انتخاب '}{chapter.name}</label>
      {nodes.filter(node => node.level === 'subject' && node.chapter === chapter.id && (!search || matches(node.name) || matches(chapter.name) || nodes.some(row => row.subject === node.id && matches(row.name)))).map(subject => <details key={subject.id} className="question-bank-subject" open={search ? true : undefined}>
        <summary>{subject.name}</summary><label className="question-bank-check"><input type="checkbox" checked={checked(subject)} onChange={() => toggle(subject)}/>انتخاب {subject.name}</label>
        {nodes.filter(node => node.level === 'object' && node.subject === subject.id && (!search || matches(node.name) || matches(subject.name) || matches(chapter.name))).map(object => <label key={object.id} className="question-bank-check"><input type="checkbox" checked={checked(object)} onChange={() => toggle(object)}/>{object.name}</label>)}
      </details>)}
    </details>)}
  </section>;
}
