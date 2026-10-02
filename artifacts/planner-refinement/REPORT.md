# گزارش اصلاح Counselor Planning Workspace

## A. علت مشکلات Layout

`arrangeLanes` بر اساس عرض حداقل کارت، لاین‌های عمودی بیشتری ایجاد می‌کرد؛ حتی دو فعالیت بدون تداخل زمانی می‌توانستند زیر هم قرار بگیرند. فعالیت‌های بدون ساعت در یک بخش جدا با `flex-wrap` بودند؛ در موبایل هر کارت به عرض کامل تبدیل می‌شد. ارتفاع روز هم تابع تعداد لاین‌ها بود.

## B. علت محدودیت Drag

listeners و attributes کتابخانهٔ dnd-kit فقط روی دکمهٔ کوچک handle نصب بودند. محدوده‌های Drop نیز به timeline، backlog و کارت‌های بدون ساعت تقسیم شده بودند؛ header روز Drop zone نبود. مختصات شروع pointer پاک می‌شد و تا حرکت بعدی از لبهٔ کارت استفاده می‌شد.

اکنون کل بدنهٔ کارت Drag را آغاز می‌کند، اکشن‌های تعاملی از فعال‌سازی Drag مستثنا هستند، هر کادر روز یک Drop zone است و مختصات شروع pointer نگه داشته می‌شود. Drop از مقیاس واقعی خط‌کش استفاده می‌کند. سنسورهای mouse، long-press touch و keyboard حفظ شدند.

## C. Copy Day

خرابی مستقلی در API کپی بازتولید نشد: append، محو شدن مبدأ و کلیک تمام کادر مقصد در کد موجود از قبل وجود داشتند. این رفتار حفظ و با API واقعی آزموده شد. Drag هنگام copy mode غیرفعال شد تا با انتخاب مقصد تداخل نکند. در تست مجدد مشخص شد attributes کتابخانه برای Drag غیرفعال، `aria-disabled` را به کل کارت می‌داد و کارت مقصد را برای ابزارهای دسترس‌پذیری غیرقابل انتخاب معرفی می‌کرد. اکنون در Copy mode attributes مربوط به Drag روی کارت نصب نمی‌شوند؛ کل کارت مقصد همچنان قابل کلیک است. این حالت با کلیک روی عنوان خود کارت مقصد بدون force آزموده شد. Escape، پیام انتخاب مقصد، پایان copy mode و پیام موفقیت حفظ شدند. آزمایش دقیق `۲ + ۳ = ۵` پس از refresh تأیید شد؛ فعالیت‌های موجود مقصد حذف نشدند.

## D. Timeline تک‌ردیفی

تمام کارت‌ها یک مختصات عمودی دارند و ارتفاع روز ثابت است. عرض حداقل کارت ۱۹۰ پیکسل و فاصله ۱۲ پیکسل است. مقیاس زمانی روز متناسب با کوتاه‌ترین فعالیت بزرگ‌تر می‌شود تا باکس‌های کوتاه خوانا بمانند؛ ruler و Drop از همان مقیاس استفاده می‌کنند. اسکرول فقط داخل viewport روز است. هیچ کارت حذف یا wrap نمی‌شود.

تداخل‌های زمانی موجود بدون تغییر خودکار داده‌های ذخیره‌شده، به شکل افقی کنار هم و با برچسب «تداخل زمانی · جایگاه نمایشی» نشان داده می‌شوند. Drop روی فعالیت زمان‌دار یا برنامهٔ ثابت متداخل با پیام فارسی رد می‌شود. ساعت واقعی فعالیت داخل کارت حفظ می‌شود.

## E. شناورها

فعالیت‌های زمان‌دار بازه‌های خود را رزرو می‌کنند. شناورها به ترتیب ordering و ID، از ساعت ۶ و در اولین بازهٔ خالی کافی قرار می‌گیرند؛ هر شناور نیز برای شناور بعدی بازه رزرو می‌کند. برچسب «شناور» و شروع نمایشی داخل خود کارت دیده می‌شود. زمان نمایشی شناور در API ذخیره نمی‌شود؛ مفهوم بدون ساعت حفظ می‌شود. Drag آن به ساعت مشخص، زمان واقعی را ذخیره می‌کند. زمان‌های قبل از ۶ هم با اسکرول در خط‌کش ۰۰ تا ۲۴ قابل دسترسی‌اند.

## F. ذخیره‌سازی و اکشن‌ها

مسیر موجود `moveItem`، پاسخ canonical سرور، refresh و optimistic rollback حفظ شد. آزمون mouse از عنوان کارت، cross-day move، touch drag، duplicate و delete با backend واقعی و refresh انجام شد. شکست شبکهٔ move با abort درخواست واقعی آزموده شد: UI به مبدأ برگشت، خطای فارسی نشان داده شد و دادهٔ API و refresh تغییر نکردند. منوی بیشتر به سمت بالای کارت باز می‌شود تا پایین viewport بریده نشود.

## G. فایل‌های تغییرکرده در این اصلاح

- `src/app/counselor/students/[id]/planning/TimelineBoard.tsx`
- `src/app/counselor/students/[id]/planning/PlanActivityCard.tsx`
- `src/app/counselor/students/[id]/planning/plannerTime.ts`
- `src/app/counselor/students/[id]/planning/timeline.css`
- `tests/planner-time.test.mjs`
- شواهد و گزارش در `artifacts/planner-refinement/`

تغییرات قبلی workspace حفظ شدند. فایل‌های Workspace، Wizard و API adapter از قبل در working tree وجود داشتند و در این اصلاح تغییر نکردند. ActivityCard فقط برای نمایش برچسب جای‌گذاری داخل کارت تغییر کرد.

## H. Backend و Bot

کد Backend و Bot تغییر نکرد. برنامهٔ آزمایشی مجزا با ID 1060 برای تست API ساخته و منتشر شد؛ شناسه و URL آن در `fixture.json` ثبت شده است.

## I. Tests

- هفت آزمون منطق زمان: مختصات RTL و scroll، snap و مرز روز، کارت‌های کوتاه تک‌ردیفی، اولین جای خالی شناورها، تداخل‌های یک‌ردیفی، محدودیت فعالیت و commitment و ساعت تهران: pass.
- `npm run test:planner`: pass.
- آزمون مرورگر روی Chrome و backend محلی واقعی: هفت روز و شروع دلخواه، Wizard و auto-advance، نگهداری ورودی پس از خطا، جلوگیری از ثبت دوباره، edit عنوان/یادداشت/مدت، duplicate با ID مستقل، mouse drag در همان روز و بین روزها، ماندگاری پس از refresh، copy mode و Escape، append، delete با confirmation، ۱۹ باکس بدون لاین دوم، خروجی Excel/PDF و publish: pass.
- تست‌های تکمیلی `۲ + ۳ = ۵`، rollback و خطای فارسی، عدم overflow کل سند در عرض ۳۹۰ و اسکرول داخلی: pass.
- touch drag با long press روی عنوان کارت، پاسخ move با status 200 و ساعت ۱۰ پس از refresh: pass.
- TypeScript منابع با tsconfig جدا و بدون generated route checks: pass.
- هر ۸ تست Backend موجود در `apps.planning.tests.test_planning` روی دیتابیس تست مستقل pass شدند؛ شامل مجوز مالکیت، محدودیت منابع nested، publish، کپی مستقل، برنامهٔ ثابت و حفاظت داده‌های اجرا/گزارش. تست `test_past_today_future_edit_policy_and_execution_safety` رد شدن edit/delete دادهٔ گزارش‌شده و `counselor_editable=false` را تأیید کرد. هیچ کد Backend تغییر نکرد. حفاظت نقش‌ها و فعالیت‌های قفل‌شده در مرورگر به صورت مستقل E2E نشد؛ guardهای موجود حفظ شدند.

شواهد: `integration-checks.json`، `extra-checks.json`، `touch-checks.json` و فایل‌های export واقعی.

## J. Lint

`npm run lint`: pass.

## K. Build

Build کامل با دستور زیر داخل کانتینر خود پروژه **pass** شد:

```
docker exec amootech-platform-backend-frontend-1 npm run build
```

Next.js 16.3.5 / Turbopack: کامپایل production، TypeScript کامل، جمع‌آوری دادهٔ صفحات، تولید صفحات و final optimization موفق بودند. خروجی واقعی در `build.txt` ثبت شده است. Source پروژه به `/app` mount شده؛ SHA-256 فایل ActivityCard داخل کانتینر و workspace یکسان بود. بعد از آخرین اصلاح Copy mode، build مجدداً اجرا و pass شد.

اجرای مستقیم روی host همچنان به محدودیت پورت داخلی Turbopack برخورد می‌کند. خطای قبلی named export مربوط به بررسی تولیدشدهٔ مسیرهای webpack بود؛ build استاندارد پروژه داخل Docker آن خطا را ندارد. برای عبور از build هیچ فایل پنل دانش‌آموز تغییر نکرد. patch پیشنهادیِ جابه‌جایی hook لازم نشد و اعمال نشده است.

## اسکرین‌شات‌های واقعی

1. روز با چند باکس تک‌ردیفی: [۱۹ باکس](09-many-boxes.png)، [سه شناور](11-single-row-floating.png)
2. حالت Drag از متن باکس: [Drag](03-dragging-box.png)
3. Drag بین دو روز: [هنگام انتقال](04-cross-day-drag.png)، [پس از Drop](04-cross-day-drop.png)
4. Copy mode، مبدأ محو و مقصدهای فعال: [Copy mode](12-copy-mode.png)
5. نتیجه append: [پنج باکس مقصد](13-copy-append-five.png)
6. جای‌گذاری شناورها در همان Timeline: [شناورها در ۶، ۷ و ۸](11-single-row-floating.png)
7. موبایل: [Timeline با چند باکس و اسکرول](14-mobile-multiple.png)، [Drag لمسی](15-mobile-touch-drag.png)

اسکرین‌شات‌ها از مرورگر و API واقعی در حین آزمون گرفته شدند؛ mockup یا تصاویر قبلی نیستند.
