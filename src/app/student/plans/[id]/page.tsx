import StudentPlanDetail from "./student-plan-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentPlanDetail id={id}/>;
}
