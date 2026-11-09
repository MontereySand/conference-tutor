import { DocumentLanguage } from "@/components/profile/language-picker";
import { htmlLang, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function SetupRequired({lang}:{lang:Lang}){const text=t(lang);return <main lang={htmlLang[lang]} className="setup-screen"><DocumentLanguage lang={lang}/><p className="eyebrow">{text.brand}</p><h1>{text.setup}</h1><p>{text.setupHint}</p></main>;}
