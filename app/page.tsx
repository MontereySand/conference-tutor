import { connection } from "next/server";
import { getCards, getSources } from "@/lib/data";
import { parseLang } from "@/lib/i18n";
import { LibraryView } from "@/components/library/library-view";
import { SetupRequired } from "@/components/library/setup-required";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await connection();
 const query=await searchParams,lang=parseLang(query.lang);
 let data;try{data={sources:getSources(),cards:getCards()};}catch{return <SetupRequired lang={lang}/>;}
 const profile=typeof query.profile==="string"&&data.cards.some(card=>card.id===query.profile)?query.profile:null;
 return <LibraryView sources={data.sources} cards={data.cards} initialLang={lang} initialProfile={profile}/>;
}
