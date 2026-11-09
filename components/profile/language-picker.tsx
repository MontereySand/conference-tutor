"use client";
import { useEffect } from "react";
import { Selector } from "@astryxdesign/core/Selector";
import { htmlLang, languages, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function DocumentLanguage({lang}:{lang:Lang}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return null;
}
export function LanguagePicker({lang,onChange}:{lang:Lang;onChange:(lang:Lang)=>void}) {
  useEffect(()=>{document.documentElement.lang=htmlLang[lang];},[lang]);
  return <Selector label={t(lang).language} isLabelHidden variant="secondary" value={lang} options={[{value:"en",label:languages.en},{value:"es",label:languages.es}]} onChange={value=>{if(value==="en"||value==="es")onChange(value);}}/>;
}
