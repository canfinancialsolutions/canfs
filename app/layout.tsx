import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AnuNathan Reports",
  description: "AnuNathan Financial Group",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
