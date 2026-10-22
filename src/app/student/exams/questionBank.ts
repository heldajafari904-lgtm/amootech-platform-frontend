import type { TopicNode } from "@/components/exams/taxonomy";

export type TopicSelection = { chapter_ids: number[]; subject_ids: number[]; object_ids: number[] };
export const emptyTopics = (): TopicSelection => ({ chapter_ids: [], subject_ids: [], object_ids: [] });
export function toggleTopic(selection: TopicSelection, node: TopicNode, nodes: TopicNode[]): TopicSelection {
  const next = { chapter_ids: [...selection.chapter_ids], subject_ids: [...selection.subject_ids], object_ids: [...selection.object_ids] };
  const key = `${node.level}_ids` as keyof TopicSelection;
  const selected = next[key].includes(node.id);
  next[key] = selected ? next[key].filter(id => id !== node.id) : [...next[key], node.id];
  if (!selected) {
    if (!next.chapter_ids.includes(node.chapter)) next.chapter_ids.push(node.chapter);
    if (node.subject && node.level === 'object' && !next.subject_ids.includes(node.subject)) next.subject_ids.push(node.subject);
  } else if (node.level !== 'object') {
    const invalid = nodes.filter(row => node.level === 'chapter' ? row.chapter === node.id : row.subject === node.id);
    if (node.level === 'chapter') next.subject_ids = next.subject_ids.filter(id => !invalid.some(row => row.level === 'subject' && row.id === id));
    next.object_ids = next.object_ids.filter(id => !invalid.some(row => row.level === 'object' && row.id === id));
  }
  return next;
}
export function validTopicSelection(selection: TopicSelection, nodes: TopicNode[]) {
  return (Object.keys(selection) as (keyof TopicSelection)[]).every(key => selection[key].every(id => {
    const node = nodes.find(row => `${row.level}_ids` === key && row.id === id);
    return !!node && selection.chapter_ids.includes(node.chapter) && (node.level !== 'object' || selection.subject_ids.includes(node.subject!));
  }));
}
export function topicSummary(selection: TopicSelection, nodes: TopicNode[]) {
  return nodes.filter(node => selection[`${node.level}_ids` as keyof TopicSelection].includes(node.id)).map(node => node.name);
}

/** Terminal nodes define the intentional scope; ancestor arrays are filters only. */
export function scopeNodes(selection: TopicSelection, nodes: TopicNode[]) {
  const level = selection.object_ids.length ? 'object' : selection.subject_ids.length ? 'subject' : 'chapter';
  return nodes.filter(node => node.level === level && selection[`${level}_ids`].includes(node.id));
}
export function selectScope(selection: TopicSelection, node: TopicNode, nodes: TopicNode[]): TopicSelection {
  const current = scopeNodes(selection, nodes);
  const sameLevel = current.every(row => row.level === node.level);
  const chosen = sameLevel ? (current.some(row => row.id === node.id) ? current.filter(row => row.id !== node.id) : [...current, node]) : [node];
  return {
    chapter_ids: [...new Set(chosen.map(row => row.chapter))],
    subject_ids: [...new Set(chosen.flatMap(row => row.level === 'subject' ? [row.id] : row.subject ? [row.subject] : []))],
    object_ids: chosen.filter(row => row.level === 'object').map(row => row.id),
  };
}
export function scopeBreadcrumbs(selection: TopicSelection, nodes: TopicNode[]) {
  return scopeNodes(selection,nodes).map(node => [
    nodes.find(row => row.level === 'chapter' && row.id === node.chapter)?.name,
    node.level === 'chapter' ? undefined : nodes.find(row => row.level === 'subject' && row.id === (node.subject ?? node.id))?.name,
    node.level === 'object' ? node.name : undefined,
  ].filter(Boolean).join(' > '));
}
