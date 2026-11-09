import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCards, getConcepts, getSource, getTranscript } from "@/lib/data";
import { htmlLang, parseLang, t } from "@/lib/i18n";
import { WatchView } from "@/components/watch-view";
import { SetupRequired } from "@/components/library/setup-required";
import { DocumentLanguage } from "@/components/profile/language-picker";
export default async function WatchPage({params,searchParams}:{params:Promise<{sourceId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await connection();
 const {sourceId}=await params,query=await searchParams,lang=parseLang(query.lang),text=t(lang);
 let source;try{source=getSource(sourceId);}catch{return <SetupRequired lang={lang}/>;}
 if(!source)notFound();
 if(!source.ready)return <main lang={htmlLang[lang]} className="setup-screen"><DocumentLanguage lang={lang}/><Link href={"/?lang="+lang}>{text.library}</Link><p className="eyebrow">{text.notReady}</p><h1>{source.labels[lang].title}</h1><p>{source.labels[lang].unreadyReason??source.unreadyReason??source.labels[lang].readiness}</p></main>;
 let data;try{data={transcript:getTranscript(sourceId,lang),english:getTranscript(sourceId,"en"),cards:getCards(),concepts:getConcepts(sourceId)};}catch{return <SetupRequired lang={lang}/>;}
 if(!data.english)return <SetupRequired lang={lang}/>;
 const profileId=typeof query.profile==="string"&&data.cards.some(card=>card.id===query.profile)?query.profile:null;
 const seconds=typeof query.t==="string"?Number(query.t):0;
 const initialMs=Number.isFinite(seconds)?Math.max(0,Math.min(source.durationMs,seconds*1000)):0;
 return <WatchView key={source.id} source={source} transcript={data.transcript} english={data.english} cards={data.cards} concepts={data.concepts} lang={lang} profileId={profileId} initialMs={initialMs} review={process.env.NODE_ENV==="development"&&query.review==="1"} autoplay={query.autoplay==="1"}/>;
}
