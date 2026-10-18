export type MobileStatus = {
  mobile: string | null;
  mobile_verified_at: string | null;
  quiz24_student_id: number | null;
  quiz24_sync_status: string;
  quiz24_sync_error: string;
  quiz24_sync_at: string | null;
};
export function syncLabel(status: string) {
  return ({ NOT_READY: "در انتظار تأیید موبایل", PENDING: "در انتظار اتصال", SYNCING: "در حال اتصال", SYNCED: "متصل", FAILED: "اتصال ناموفق؛ قابل تلاش مجدد", CONFLICT: "نیازمند تطبیق حساب توسط پشتیبانی", UNKNOWN: "نیازمند بررسی نتیجه توسط پشتیبانی" } as Record<string, string>)[status] || "وضعیت نامشخص";
}
export function canRetrySync(status: MobileStatus) {
  return !!status.mobile_verified_at && ["PENDING", "FAILED", "SYNCING"].includes(status.quiz24_sync_status);
}

export function normalizeOTPInput(value: string) {
  return value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[^0-9]/g, "").slice(0, 6);
}
