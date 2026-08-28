import type { Metadata } from "next";
import "./globals.css";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";

export const metadata: Metadata = {
  title: "AgriStack — Sell smarter. Earn better.",
  description:
    "Agricultural market intelligence that helps farmers decide where to sell their crops and join live procurement queues.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-soil-50 font-sans text-soil-900 antialiased">
        <PreviewHostBridge />
        <DemoModeBanner />
        {children}
      </body>
    </html>
  );
}
