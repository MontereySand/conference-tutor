import "./layers.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Rum } from "@/components/telemetry/rum";

const mono = IBM_Plex_Mono({ variable: "--font-mono", weight: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"], display: "swap" });
const serif = Playfair_Display({ variable: "--font-serif", subsets: ["latin", "latin-ext"], display: "swap" });
export const metadata: Metadata = { title: "Conference tutor", description: "Understand the hard part of a technical talk, then return without losing your place." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" className={`${mono.variable} ${serif.variable}`}><body><Providers><Rum />{children}</Providers></body></html>;
}
