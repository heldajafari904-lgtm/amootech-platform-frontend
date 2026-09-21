import PlanBuilder from "./PlanBuilder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanBuilder studentId={id}/>;
}
