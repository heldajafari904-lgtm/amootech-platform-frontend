"use client";

import { useEffect, useRef, useState } from "react";
import { allPages, api } from "@/lib/api";
import type { AcademicTree } from "@/lib/academicTree";
import type { Student } from "@/lib/planning";
import { courseDetail, field, hierarchySelection, type Option } from "@/components/exams/taxonomy";
import { createCatalogCache, levels, selectInternal, selectProvider, type Content, type Level } from "./flexibleContent";
import { apiErrorMessage } from "./planningFeedback";

import { activityCourses, activityGrades, catalogOptions, type CanonicalGrade, type ActivityGrade } from "./activityCatalog";

const cached = createCatalogCache<unknown>();
const levelLabels: Record<Level, string> = { grade: 'پایه', course: 'درس', chapter: 'فصل', subject: 'مبحث', object: 'موضوع' };
function useCatalog(token: string, path: string | null, body?: Record<string, unknown>) {
  const [retry, setRetry] = useState(0);
  const key = path ? JSON.stringify([token, path, body, retry]) : '';
  const [state, setState] = useState<{ key: string; data?: unknown; error?: string }>({ key: '' });
  useEffect(() => {
    if (!path) return;
    let live = true;
    const payload = body ? JSON.parse(JSON.stringify(body)) as Record<string, unknown> : undefined;
    cached(key, () => path === '/academics/grades/' ? allPages(path, token) : api<unknown>(path, token, payload ? 'POST' : 'GET', payload))
      .then(data => {
        if (data == null) throw new Error('پاسخ فهرست آموزشی معتبر نیست. دوباره تلاش کنید.');
        if (live) setState({ key, data });
      })
      .catch(reason => { if (live) setState({ key, error: apiErrorMessage(reason) }); });
    return () => { live = false; };
    // key includes the serialized body and auth scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : '', loading: !!path && state.key !== key, retry: () => setRetry(v => v + 1) };
}

function Selection({ label, choices, value, savedLabel, onChange }: { label: string; choices: Option[]; value?: number; savedLabel?: string; onChange: (id: number, name: string) => void }) {
  return <div className="flex-selection">
    <div className="flex-choice-grid" role="group" aria-label={label}>
      {choices.map(row => <button type="button" key={row.id} aria-pressed={row.id === value} onClick={() => onChange(row.id, row.name)}>{row.name}</button>)}
    </div>
    {value && !choices.some(row => row.id === value) && <p className="planning-hint">انتخاب ذخیره‌شده: {savedLabel || 'در فهرست فعلی موجود نیست'}</p>}
    {!choices.length && <p className="planning-hint">گزینه‌ای برای {label} در دسترس نیست؛ می‌توانید در همین مرحله تمام کنید.</p>}
  </div>;
}

export default function TaxonomySelector({ token, student, tree, content, onChange }: { token: string; student: Student; tree?: AcademicTree | null; content: Content; onChange: (update: (current: Content) => Content) => void }) {
  const [source] = useState<'internal' | 'quiz24'>(Object.values(content.internal).some(Boolean) ? 'internal' : 'quiz24');
  const [depth, setDepth] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [navigated, setNavigated] = useState(false);
  useEffect(() => { if (navigated) heading.current?.focus(); }, [depth, navigated, source]);
  const selected = content.taxonomy;
  const canonical = useCatalog(token, '/academics/grades/');
  const gradeData = useCatalog(token, source === 'quiz24' ? '/exams/provider/grades/' : null);
  const courseData = useCatalog(token, source === 'quiz24' && depth > 0 ? '/exams/provider/courses/' : null);
  let grades: ActivityGrade[] = [];
  let courseOptions: Option[] = [];
  let catalogError = '';
  try {
    if (canonical.data !== undefined && gradeData.data !== undefined) {
      if (!Array.isArray(canonical.data)) throw new Error('پاسخ پایه‌های آموزشی معتبر نیست.');
      grades = activityGrades(canonical.data as CanonicalGrade[], student, catalogOptions(gradeData.data, 'grade'));
    }
    if (courseData.data !== undefined) courseOptions = catalogOptions(courseData.data, 'course');
  } catch (reason) { catalogError = apiErrorMessage(reason); }
  const course = courseOptions.find(row => row.id === selected.course);
  const grade = selected.grade ?? (course ? Number(field(course.raw, 'gradeid')) : undefined);
  const detail = useCatalog(token, source === 'quiz24' && depth >= 2 && selected.course && grade ? '/exams/provider/course-detail/' : null,
    selected.course && grade ? { grade_id: grade, course_id: selected.course } : undefined);
  let hierarchy: ReturnType<typeof hierarchySelection> | null = null;
  let parseError = '';
  if (detail.data && selected.course) {
    try { hierarchy = hierarchySelection(courseDetail(detail.data, selected.course), String(selected.chapter ?? ''), String(selected.subject ?? ''), String(selected.object ?? '')); }
    catch { parseError = 'ساختار فهرست معتبر نیست. دوباره تلاش کنید یا از عنوان متنی استفاده کنید.'; }
  }
  const choices: Record<Level, Option[]> = {
    grade: grades,
    course: activityCourses(courseOptions, grades.find(row => row.id === grade), student.field_name),
    chapter: hierarchy?.chapters ?? [], subject: hierarchy?.subjects ?? [], object: hierarchy?.objects ?? [],
  };
  const internalLevels = ['subject', 'chapter', 'topic'] as const;
  const internalChoices = [
    (tree?.subjects ?? []).map(row => ({ ...row, raw: row })),
    (tree?.chapters ?? []).filter(row => row.subject === content.internal.subject).map(row => ({ ...row, raw: row })),
    (tree?.topics ?? []).filter(row => row.chapter === content.internal.chapter).map(row => ({ ...row, raw: row })),
  ];
  const level = levels[depth];
  const label = source === 'quiz24' ? levelLabels[level] : ['درس', 'فصل', 'مبحث'][depth];
  const resources = source === 'quiz24' ? [canonical, gradeData, ...(depth === 0 ? [] : depth === 1 ? [courseData] : [courseData, detail])] : [];
  const failed = resources.find(resource => resource.error);
  const loading = resources.some(resource => resource.loading);
  function navigate(next: number) { setNavigated(true); setDepth(next); }
  function choose(id: number, name: string) {
    onChange(current => source === 'quiz24' ? selectProvider(current, level, id, name) : selectInternal(current, internalLevels[depth], id, name));
    navigate(Math.min(depth + 1, source === 'quiz24' ? 4 : 2));
  }
  return <section className="flex-taxonomy" aria-label="انتخاب محتوای آموزشی">
    <div className="flex-selector-head"><h3 ref={heading} tabIndex={-1}>{label}</h3>
      {depth > 0 && <button type="button" className="ws-link" onClick={() => navigate(depth - 1)}>بازگشت</button>}
    </div>
    {loading && <p role="status">در حال دریافت فهرست…</p>}
    {(failed || parseError || catalogError) && <div role="alert" className="flex-catalog-error"><p>{failed?.error || parseError || catalogError}</p><button type="button" onClick={() => { resources.forEach(resource => resource.retry()); }}>تلاش دوباره</button></div>}
    {!loading && !failed && !parseError && !catalogError && <Selection key={`${source}-${depth}-${source === 'quiz24' ? (depth ? selected[levels[depth - 1]] : '') : (depth ? content.internal[internalLevels[depth - 1]] : '')}`} label={label} choices={source === 'quiz24' ? choices[level] : internalChoices[depth]} value={source === 'quiz24' ? selected[level] : content.internal[internalLevels[depth]] ?? undefined} savedLabel={source === 'quiz24' ? selected.labels?.[level] : content.internalLabels[depth === 0 ? 'course' : depth === 1 ? 'chapter' : 'topic']} onChange={choose}/>}

  </section>;
}
