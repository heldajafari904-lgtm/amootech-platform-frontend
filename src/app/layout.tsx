import type { Metadata } from "next";
import "./globals.css";

let vazirClass = "";
try {
  // dynamic to avoid build-time fetch failure
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Vazirmatn } = require("next/font/google");
  const vazirmatn = Vazirmatn({ subsets: ["arabic"], display: "swap", variable: "--font-vazirmatn" });
  vazirClass = vazirmatn.variable;
} catch {}

export const metadata: Metadata = {
  title: "Amootech Platform",
  description: "Amootech educational counseling platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`h-full antialiased ${vazirClass}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}