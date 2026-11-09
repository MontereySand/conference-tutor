"use client";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { htmlLang, languages, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function DocumentLanguage({lang}:{lang:Lang}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return null;
}
export function LanguagePicker({lang,onChange}:{lang:Lang;onChange:(lang:Lang)=>void}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return <Select value={lang} onValueChange={value=>{if(value && value in languages) onChange(value as Lang);}}><SelectTrigger aria-label={t(lang).language}><SelectValue>{languages[lang]}</SelectValue></SelectTrigger><SelectContent>{(Object.keys(languages) as Lang[]).map(value=><SelectItem key={value} value={value}>{languages[value]}</SelectItem>)}</SelectContent></Select>;
}
