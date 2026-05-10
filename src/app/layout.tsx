import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JobBinder | Field Management for Small Crews",
  description: "The fast, offline-capable job folder app for small construction companies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 min-h-screen pb-20 md:pb-0`}>
        <Navbar />
        <main className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
