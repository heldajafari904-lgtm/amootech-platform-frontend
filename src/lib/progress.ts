export type ProgressDay = {
  date: string;
  planned_minutes: number;
  actual_minutes: number;
  planned_tests: number;
  actual_tests: number;
  completed: number;
  partial: number;
  not_done: number;
  remaining: number;
  planned_blocks: number;
  completion_percent: number | null;
  by_subject: { name: string; minutes: number }[];
  self_rating: number | null;
  wake_time: string | null;
  sleep_time: string | null;
  mobile_minutes: number | null;
  has_report: boolean;
};

export type StudentProgress = { today: ProgressDay; recent_days: ProgressDay[] };
