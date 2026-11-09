import "./layers.css";
import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Rum } from "@/components/telemetry/rum";

const noto = Noto_Sans({ variable: "--font-noto", subsets: ["latin", "latin-ext"], display: "swap" });
export const metadata: Metadata = { title: "Conference tutor", description: "Understand the hard part of a technical talk, then return without losing your place." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" className={noto.variable}><body><Providers><Rum />{children}</Providers></body></html>;
}
