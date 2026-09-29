import PlanningWorkspace from "./PlanningWorkspace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanningWorkspace studentId={id}/>;
}
