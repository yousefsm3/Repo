import "./globals.css";

export const metadata = {
  title: "شرواك | اعثر على صورك من الحفلة",
  description: "منصة البحث عن صور الأعراس والمناسبات بالذكاء الاصطناعي",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen">{children}</body>
    </html>
  );
}
