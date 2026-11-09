import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
const noto=Noto_Sans({variable:"--font-noto",subsets:["latin","latin-ext"],display:"swap"});
const devanagari=Noto_Sans_Devanagari({variable:"--font-noto-hi",subsets:["devanagari"],display:"swap"});
const chinese=Noto_Sans_SC({variable:"--font-noto-zh",preload:false,display:"swap"});
export const metadata:Metadata={title:"Conference tutor",description:"Understand the hard part of a technical talk, then return without losing your place."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className={noto.variable+" "+devanagari.variable+" "+chinese.variable}><body>{children}</body></html>;}
