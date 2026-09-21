import Link from "next/link";

export default function CounselorHome() {
  return <main className="planning-content"><h1>برنامه‌ریزی دانش‌آموزان</h1><p>برای نوشتن برنامه، ابتدا دانش‌آموز را انتخاب کنید.</p><Link className="planning-primary" href="/counselor/students">مشاهده دانش‌آموزان</Link></main>;
}
