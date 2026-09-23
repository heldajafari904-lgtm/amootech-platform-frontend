"use client";

import DailyReportPage from "@/app/student/plans/report/[date]/daily-report-page";
import { tehranTodayIso } from "@/lib/reports";

export default function ReportsPage() {
  return <DailyReportPage date={tehranTodayIso()}/>;
}
