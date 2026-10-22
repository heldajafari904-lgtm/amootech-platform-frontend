import { envelope, field, options, type Option } from '../../../../../components/exams/taxonomy';

export type CanonicalGrade = { id: number; name: string; number: number | null };
type Context = { grade: number | null; field_name?: string };
export type ActivityGrade = Option & { fieldVerified: boolean; restrictField: boolean };

/** Validate the provider contract before distinguishing an empty catalog from a failure. */
export function catalogOptions(response: unknown, kind: 'grade' | 'course'): Option[] {
  const rows = envelope(response);
  const status = field(response, 'status');
  if (!Array.isArray(rows) || (status != null && status !== 100)) throw new Error('پاسخ فهرست آموزشی معتبر نیست. دوباره تلاش کنید.');
  const result = options(rows, kind);
  if (result.length !== rows.length || result.some(row => !row.name.trim()) || new Set(result.map(row => row.id)).size !== result.length) throw new Error('شناسه یا عنوان فهرست آموزشی معتبر نیست. دوباره تلاش کنید.');
  return result;
}

export function activityGrades(canonical: CanonicalGrade[], student: Context, provider: Option[]): ActivityGrade[] {
  const number = canonical.find(row => row.id === student.grade)?.number;
  if (!Number.isInteger(number) || number == null || number < 1 || number > 12) throw new Error('پایه معتبر دانش‌آموز مشخص نیست؛ عنوان متنی همچنان قابل استفاده است.');
  const [low, high] = number <= 6 ? [1, 6] : number <= 9 ? [7, 9] : [10, 12];
  if (low === 10 && !student.field_name?.trim()) throw new Error('رشته معتبر دانش‌آموز مشخص نیست؛ عنوان متنی همچنان قابل استفاده است.');
  const result = canonical.filter(row => row.number != null && row.number >= low && row.number <= high).sort((a, b) => a.number! - b.number!).flatMap(grade => {
    // Quiz24 upper-secondary titles explicitly encode the field, e.g. دهم تجربی.
    // Match verified labels, never interpret provider IDs or period IDs as grade numbers.
    const matches = provider.filter(row => row.name === grade.name || (low === 10 && row.name === `${grade.name} ${student.field_name}`));
    const specific = matches.filter(row => row.name !== grade.name);
    const candidates = specific.length ? specific : matches;
    if (candidates.length > 1) throw new Error('نگاشت پایه‌های فهرست مبهم است. دوباره تلاش کنید.');
    return candidates.map(row => ({ ...row, name: grade.name, fieldVerified: low !== 10 || row.name !== grade.name, restrictField: low === 10 }));
  });
  if (provider.length && !result.length) throw new Error('پایه‌های کاتالوگ با دوره و رشته دانش‌آموز تطبیق ندارند. دوباره تلاش کنید.');
  return result;
}

export function activityCourses(courses: Option[], grade: ActivityGrade | undefined, fieldName?: string): Option[] {
  if (!grade) return [];
  return courses.filter(row => String(field(row.raw, 'gradeid')) === String(grade.id)
    && (!grade.restrictField || (field(row.raw, 'fieldname') != null ? field(row.raw, 'fieldname') === fieldName : grade.fieldVerified)));
}
