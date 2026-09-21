import Link from "next/link";
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950">
      <section className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">Amootech</p>
        <h1 className="mt-2 text-3xl font-semibold">Development environment ready</h1>
        <p className="mt-4"><Link className="text-cyan-700 underline" href="/register/student">Register as a student</Link> · <Link className="text-cyan-700 underline" href="/student/profile">Student profile</Link></p>
        <p className="mt-2"><Link className="text-cyan-700 underline" href="/counselor">Counselor area</Link> · <Link className="text-cyan-700 underline" href="/student/plans">Student plans</Link></p>
      </section>
    </main>
  );
}
