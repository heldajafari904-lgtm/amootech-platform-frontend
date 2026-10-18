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
  if (!Array.isArray(value)) {
    if (Array.isArray(field(value, "chapters"))) return value;
    throw new Error("ساختار مبحث‌های درس معتبر نیست.");
  }
  if (!value.length) return { chapters: [] };
  const roots = value.filter(row => Number(field(row, "type")) === 1);
  const root = roots.find(row => Number(field(row, "key")) === courseId);
  if (roots.length && !root) throw new Error("اطلاعات مبحث‌ها متعلق به درس انتخاب‌شده نیست.");
  const children = root ? field(root, "children") : value;
  function level(rows: unknown, type: number, parent: number): Record<string, unknown>[] {
    if (!Array.isArray(rows)) throw new Error("ساختار مبحث‌های درس معتبر نیست.");
    return rows.map(raw => {
      const id = Number(field(raw, "key"));
      const title = field(raw, "title");
      const parentId = field(raw, "parentid");
      if (!Number.isSafeInteger(id) || id <= 0 || typeof title !== "string" || Number(field(raw, "type")) !== type || (parentId != null && Number(parentId) !== parent)) {
        throw new Error("شناسه یا ارتباط مبحث‌های درس معتبر نیست.");
      }
      const childRows = field(raw, "children");
      if (!Array.isArray(childRows)) throw new Error("ساختار مبحث‌های درس معتبر نیست.");
      return { id, title, ...(type === 2 ? { subjects: level(childRows, 3, id) } : type === 3 ? { objects: level(childRows, 4, id) } : {}) };
    });
  }
  return { chapters: level(children, 2, courseId) };
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
