import { planningError } from "@/lib/planning";

export function apiErrorMessage(reason: unknown): string {
  const msg = planningError(reason);
  if (msg.includes("permission") || msg.includes("اجازه")) return "اجازه ویرایش این برنامه را ندارید.";
  if (msg.includes("past") || msg.includes("گذشته")) return "این فعالیت خارج از بازه برنامه است.";
  if (msg.includes("Date must be within")) return "این فعالیت خارج از بازه برنامه است.";
  if (/Subject is required/i.test(msg)) return "برای این فعالیت، درس را انتخاب کنید.";
  if (/Title is required/i.test(msg)) return "عنوان فعالیت را وارد کنید.";
  if (/positive test count/i.test(msg)) return "تعداد تست باید بیشتر از صفر باشد.";
  if (/published plan needs/i.test(msg)) return "برای انتشار، روزهای برنامه باید فعالیت داشته باشند.";
  if (/already published/i.test(msg)) return "این برنامه قبلاً منتشر شده است.";
  if (/daily report|student data/i.test(msg)) return "این فعالیت عملکرد ثبت‌شده دارد و امکان تغییر آن محدود است.";
  if (/End time must be after|end.*after.*start/i.test(msg)) return "ساعت پایان باید بعد از ساعت شروع باشد؛ ساعت‌ها را اصلاح کنید.";
  if (/Start and end times must|both.*start.*end/i.test(msg)) return "ساعت شروع و پایان را با هم وارد کنید، یا هر دو را خالی بگذارید.";
  if (/Duration is required/i.test(msg)) return "مدت فعالیت را وارد کنید.";
  if (/greater than or equal to 1/i.test(msg)) return "مدت یا تعداد تست باید بیشتر از صفر باشد.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
  return msg;
}

