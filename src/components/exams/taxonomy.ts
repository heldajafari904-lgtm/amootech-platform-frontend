export function field(value: unknown, ...keys: string[]): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.replaceAll("_", "").toLowerCase(), entry]));
  for (const key of keys) if (normalized[key] !== undefined) return normalized[key];
}
export type Option = { id: number; name: string; raw: Record<string, unknown> };
export function options(value: unknown, kind: string): Option[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(raw => {
    const id = Number(field(raw, `${kind}id`, "id", "key"));
    const name = field(raw, `${kind}name`, "name", "title");
    return Number.isSafeInteger(id) && id > 0 && typeof name === "string" ? [{ id, name, raw: raw as Record<string, unknown> }] : [];
  });
}
export function envelope(value: unknown) { return field(value, "result", "data") ?? value; }

// Official WebService/v1: 1=course, 2=chapter, 3=subject, 4=object.
// Keep Quiz24 keys intact; the root course is never offered as a chapter.
export function courseDetail(response: unknown, courseId: number): unknown {
  const value = envelope(response);
  const normalized = !Array.isArray(value) && Array.isArray(field(value, "chapters"));
  if (!Array.isArray(value) && !normalized) {
    throw new Error("ساختار مبحث‌های درس معتبر نیست.");
  }
  const rows: unknown[] = Array.isArray(value) ? value : [];
  const roots = rows.filter(row => Number(field(row, "type")) === 1);
  const root = roots.find(row => Number(field(row, "key")) === courseId);
  if (roots.length && (!root || roots.length !== 1 || rows.length !== 1)) throw new Error("اطلاعات مبحث‌ها متعلق به درس انتخاب‌شده نیست.");
  const children = normalized ? field(value, "chapters") : root ? field(root, "children") : rows;
  const seen = new Map<number, Set<number>>();
  function level(rows: unknown, type: number, path: Record<string, number>): Record<string, unknown>[] {
    if (!Array.isArray(rows)) throw new Error("ساختار مبحث‌های درس معتبر نیست.");
    return rows.map(raw => {
      const kind = type === 2 ? "chapter" : type === 3 ? "subject" : "object";
      const id = Number(field(raw, ...(normalized ? [`${kind}id`, "id", "key"] : ["key"])));
      const title = field(raw, ...(normalized ? [`${kind}name`, "name", "title"] : ["title"]));
      const parentId = field(raw, "parentid");
      const parent = path[type === 2 ? "course" : type === 3 ? "chapter" : "subject"];
      const duplicate = seen.get(type)?.has(id);
      if (!Number.isSafeInteger(id) || id <= 0 || typeof title !== "string" || !title.trim() || (!normalized && Number(field(raw, "type")) !== type) || (parentId != null && Number(parentId) !== parent) || duplicate || Object.entries(path).some(([kind, identifier]) => field(raw, `${kind}id`) != null && Number(field(raw, `${kind}id`)) !== identifier)) {
        throw new Error("شناسه یا ارتباط مبحث‌های درس معتبر نیست.");
      }
      if (!seen.has(type)) seen.set(type, new Set());
      seen.get(type)!.add(id);
      const childRows = field(raw, normalized ? (type === 2 ? "subjects" : "objects") : "children") ?? [];
      if (!Array.isArray(childRows) || (type === 4 && childRows.length)) throw new Error("ساختار مبحث‌های درس معتبر نیست.");
      const nextPath = { ...path, [kind]: id };
      return { id, title, ...(type === 2 ? { subjects: level(childRows, 3, nextPath) } : type === 3 ? { objects: level(childRows, 4, nextPath) } : {}) };
    });
  }
  return { chapters: level(children, 2, { course: courseId }) };
}

export function hierarchySelection(taxonomy: unknown, chapter: string, subject: string, object: string) {
  const chapters = options(field(taxonomy, "chapters"), "chapter");
  const chapterNode = chapters.find(row => String(row.id) === chapter);
  const subjects = chapterNode ? options(field(chapterNode.raw, "subjects") ?? field(taxonomy, "subjects"), "subject").filter(row => field(row.raw, "chapterid") == null || String(field(row.raw, "chapterid")) === chapter) : [];
  const subjectNode = subjects.find(row => String(row.id) === subject);
  const objects = subjectNode ? options(field(subjectNode.raw, "objects") ?? field(taxonomy, "objects"), "object").filter(row => field(row.raw, "subjectid") == null || String(field(row.raw, "subjectid")) === subject) : [];
  const valid = (!chapter || !!chapterNode) && (!subject || !!subjectNode) && (!object || objects.some(row => String(row.id) === object));
  return { chapters, subjects, objects, valid };
}

export function coursesForGrade(courses: Option[], grade: string) {
  return grade ? courses.filter(row => String(field(row.raw, "gradeid")) === grade) : [];
}

export type TopicNode = Option & { level: 'chapter' | 'subject' | 'object'; chapter: number; subject?: number };
export function topicNodes(taxonomy: unknown): TopicNode[] {
  return options(field(taxonomy, 'chapters'), 'chapter').flatMap(chapter => [
    { ...chapter, level: 'chapter' as const, chapter: chapter.id },
    ...options(field(chapter.raw, 'subjects'), 'subject').flatMap(subject => [
      { ...subject, level: 'subject' as const, chapter: chapter.id, subject: subject.id },
      ...options(field(subject.raw, 'objects'), 'object').map(object => ({ ...object, level: 'object' as const, chapter: chapter.id, subject: subject.id })),
    ]),
  ]);
}
