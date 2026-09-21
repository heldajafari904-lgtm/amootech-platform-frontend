import { Commitment, commitmentLabel, Student, timeText } from "@/lib/planning";

const weekdayLabel = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"];

export default function StudentSummary({ student, commitments }: { student: Student; commitments: Commitment[] }) {
  const active = commitments.filter((item) => item.active);
  return <section className="planning-summary"><div><h2>{student.user.first_name} {student.user.last_name}</h2><p>{student.grade_name || "پایه نامشخص"} · {student.field_name || "رشته نامشخص"}</p><p>مدرسه: {student.school_name || "ثبت نشده"}</p></div><div><h3>تعهدهای ثابت هفته</h3>{active.length === 0 ? <p>تعهد ثابتی ثبت نشده است.</p> : <ul className="planning-commitments">{active.map((item) => <li key={item.id}><strong>{weekdayLabel[item.weekday]} · {commitmentLabel[item.kind]}</strong><span>{item.title}، {timeText(item.start_time)} تا {timeText(item.end_time)}</span></li>)}</ul>}</div></section>;
}
