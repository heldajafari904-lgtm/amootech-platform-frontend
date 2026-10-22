import type { PlanItem, PlanningTaxonomy } from '../../../../../lib/planning.ts';

export const levels = ['grade', 'course', 'chapter', 'subject', 'object'] as const;
export type Level = typeof levels[number];
export type Content = {
  taxonomy: PlanningTaxonomy;
  internal: { subject: number | null; chapter: number | null; topic: number | null };
  internalLabels: Partial<Record<'course' | 'chapter' | 'topic', string>>;
  title: string;
  custom: boolean;
  changed: boolean;
  originalGenerated: string;
};

export function initialContent(item?: PlanItem): Content {
  return {
    taxonomy: item?.taxonomy ?? {},
    internal: { subject: item?.subject ?? null, chapter: item?.chapter ?? null, topic: item?.topic ?? null },
    internalLabels: { course: item?.subject_name, chapter: item?.chapter_name, topic: item?.topic_name },
    title: item?.title ?? '', custom: item ? item.title_is_custom !== false && !!item.title?.trim() : false,
    changed: false, originalGenerated: item?.generated_title ?? '',
  };
}

// Preview the catalog title. Save omits automatic titles: backend is authoritative.
export function generatedTitle(content: Content): string {
  if (!content.changed && content.originalGenerated) return content.originalGenerated;
  const labels = content.taxonomy.provider ? content.taxonomy.labels ?? {} : content.internalLabels;
  const course = labels.course ?? '';
  const deepest = ['object', 'subject', 'topic', 'chapter'].map(k => (labels as Record<string, string | undefined>)[k]).find(Boolean) ?? '';
  return course && deepest && course !== deepest ? `${course} — ${deepest}` : course || deepest || ('grade' in labels ? labels.grade ?? '' : '');
}
export function displayTitle(content: Content) { return content.custom ? content.title : generatedTitle(content) || content.title; }
export function manualTitle(content: Content, title: string): Content { return { ...content, title, custom: true }; }
export function automaticTitle(content: Content): Content { return { ...content, custom: false }; }

export function selectProvider(content: Content, level: Level, id?: number, label?: string): Content {
  if (content.taxonomy[level] === id) return content;
  const taxonomy: Extract<PlanningTaxonomy, { provider: 'quiz24' }> = { ...content.taxonomy, provider: 'quiz24', labels: { ...content.taxonomy.labels } };
  const index = levels.indexOf(level);
  for (const descendant of levels.slice(index)) { delete taxonomy[descendant]; delete taxonomy.labels?.[descendant]; }
  if (id) { taxonomy[level] = id; taxonomy.labels![level] = label ?? ''; }
  const selected = levels.some(k => !!taxonomy[k]);
  const result = { ...content, taxonomy: selected ? taxonomy : {}, internal: { subject: null, chapter: null, topic: null }, internalLabels: {}, changed: true, custom: false, title: '' };
  // Clearing the final selection keeps the visible text as a free-text activity.
  return !selected && displayTitle(content) ? manualTitle(result, displayTitle(content)) : result;
}
export function clearContentSelection(content: Content): Content {
  return { ...content, taxonomy: {}, internal: { subject: null, chapter: null, topic: null }, internalLabels: {}, changed: true, custom: true, title: displayTitle(content) };
}
export function selectInternal(content: Content, level: 'subject' | 'chapter' | 'topic', id: number | null, label?: string): Content {
  if (content.internal[level] === id) return content;
  const internal = { ...content.internal, [level]: id };
  const labels = { ...content.internalLabels };
  const key = level === 'subject' ? 'course' : level;
  if (id) labels[key] = label; else delete labels[key];
  if (level === 'subject') { internal.chapter = null; internal.topic = null; delete labels.chapter; delete labels.topic; }
  if (level === 'chapter') { internal.topic = null; delete labels.topic; }
  const result = { ...content, taxonomy: {}, internal, internalLabels: labels, changed: true, custom: false, title: '' };
  return !Object.values(internal).some(Boolean) && displayTitle(content) ? manualTitle(result, displayTitle(content)) : result;
}

export function contentPayload(content: Content, editing = false) {
  const selection = { taxonomy: content.taxonomy, ...content.internal };
  if (content.custom || !generatedTitle(content)) return { ...selection, title: content.title.trim() };
  return { ...selection, ...(editing ? { reset_generated_title: true } : {}) };
}

/** In-flight deduplication and short, auth-scoped cache. Rejected requests remain retryable. */
export function createCatalogCache<T>(ttl = 15 * 60 * 1000) {
  const entries = new Map<string, { value: Promise<T>; expires: number }>();
  return (key: string, load: () => Promise<T>) => {
    const existing = entries.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    const value = Promise.resolve().then(load).catch(reason => { if (entries.get(key)?.value === value) entries.delete(key); throw reason; });
    entries.set(key, { value, expires: Date.now() + ttl });
    return value;
  };
}
