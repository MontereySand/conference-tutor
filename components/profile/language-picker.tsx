"use client";
import { useEffect } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Languages } from "lucide-react";
import { htmlLang, languages, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function DocumentLanguage({lang}:{lang:Lang}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return null;
}
export function LanguagePicker({lang,onChange}:{lang:Lang;onChange:(lang:Lang)=>void}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return <div className="language-toggle" role="group" aria-label={t(lang).language}>{(["en","es"] as const).map(value=><Button key={value} variant={lang===value?"primary":"ghost"} size="sm" label={languages[value]} aria-pressed={lang===value} onClick={()=>onChange(value)}><Languages size={14} aria-hidden="true"/><span>{value==="en"?"ENG":"ESP"}</span></Button>)}</div>;
}
