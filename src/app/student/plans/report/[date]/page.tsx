import DailyReportPage from "./daily-report-page";

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <DailyReportPage key={date} date={date}/>;
}
