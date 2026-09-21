import Link from "next/link";
export default function AdminHome() {
  return <main><h1>Administration</h1><p>Manage accounts and academic structure.</p><ul><li><Link href="/admin/students">Students</Link></li><li><Link href="/admin/counselors">Counselors</Link></li><li><Link href="/admin/academics">Academic structure</Link></li></ul></main>;
}
