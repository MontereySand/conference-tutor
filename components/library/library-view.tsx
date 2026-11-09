"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import type { Source } from "@/lib/data-schema";
import type { Lang, ProfileCard } from "@/lib/types";
import { htmlLang, t, timestamp } from "@/lib/i18n";
import { ProfilePicker } from "@/components/profile/profile-picker";
import { LanguagePicker } from "@/components/profile/language-picker";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { StageErrorMessage } from "@/components/lesson/stage-error";
import type { StageError } from "@/components/lesson/types";
type Moment={chunkId:string;sourceId:string;title:string;startMs:number;endMs:number;url:string};
export function LibraryView({sources,cards,initialLang,initialProfile}:{sources:Source[];cards:ProfileCard[];initialLang:Lang;initialProfile:string|null}){
 const [lang,setLang]=useState(initialLang),[profile,setProfile]=useState(initialProfile),[question,setQuestion]=useState(""),[moments,setMoments]=useState<Moment[]|null>(null),[error,setError]=useState<StageError|null>(null),[pending,setPending]=useState(false),controller=useRef<AbortController|null>(null);
 const text=t(lang);
 useEffect(()=>()=>controller.current?.abort(),[]);
 function selection(nextLang:Lang,nextProfile:string|null){controller.current?.abort();setPending(false);setError(null);setMoments(null);setLang(nextLang);setProfile(nextProfile);const query=new URLSearchParams({lang:nextLang});if(nextProfile)query.set("profile",nextProfile);window.history.replaceState(null,"","/?"+query);}
 async function search(){
  if(!question.trim())return;controller.current?.abort();const active=new AbortController();controller.current=active;setPending(true);setError(null);setMoments(null);
  try{const response=await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:question.trim(),lang}),signal:active.signal});const data=await response.json() as {moments:Moment[];error?:StageError};if(!active.signal.aborted){if(!response.ok)setError(data.error??{stage:"search",code:"unavailable"});else setMoments(data.moments);}}
  catch{if(!active.signal.aborted)setError({stage:"search",code:"unavailable"});}finally{if(!active.signal.aborted)setPending(false);}
 }
 function momentUrl(moment:Moment){const url=new URL(moment.url,"http://local.invalid");if(profile)url.searchParams.set("profile",profile);url.searchParams.set("lang",lang);return url.pathname+url.search;}
 return <div lang={htmlLang[lang]} className="library-surface">
  <a className="skip-link" href="#library-content">{text.skipContent}</a>
  <header className="topbar">
   <Link href="/" className="wordmark">{text.brand}</Link>
   <div className="topbar-controls">
    <ProfilePicker cards={cards} profileId={profile} lang={lang} onChange={id=>selection(lang,id)}/>
    <LanguagePicker lang={lang} onChange={value=>selection(value,profile)}/>
   </div>
  </header>
  <main id="library-content" tabIndex={-1} className="library-main">
   <div className="library-feature-grid">
    <section className="library-intro" aria-labelledby="library-title">
     <p className="eyebrow">{text.eyebrow}</p>
     <h1 id="library-title">{text.hero}</h1>
     <p>{text.intro}</p>
    </section>
    <section className="library-search panel" aria-labelledby="search-title">
     <div className="section-heading"><h2 id="search-title">{text.search}</h2><Search aria-hidden="true" size={22}/></div>
     <form onSubmit={event=>{event.preventDefault();void search();}}>
      <TextArea id="library-question" label={text.searchHint} containerClassName="library-search-field" value={question} onChange={value=>{if(pending){controller.current?.abort();setPending(false);}setMoments(null);setError(null);setQuestion(value.slice(0,2000));}}/>
      <Button type="submit" variant="primary" label={pending?text.searching:text.searchAction} isDisabled={!question.trim()} isLoading={pending}/>
     </form>
     {pending&&<p role="status" className="disclosure">{text.searching}</p>}
     {error&&<><StageErrorMessage error={error} lang={lang}/><Button variant="secondary" label={text.retry} onClick={()=>void search()}/></>}
     <div aria-live="polite" aria-atomic="true">
      {moments!==null&&<><h3>{text.searchResults}</h3>{moments.length===0?<p>{text.noMoments}</p>:<ul className="moment-list">{moments.map(moment=><li key={moment.chunkId}><Link href={momentUrl(moment)}><span className="moment-time">{timestamp(moment.startMs)}</span><span>{sources.find(source=>source.id===moment.sourceId)?.labels[lang].title??moment.title}</span><ArrowUpRight aria-hidden="true" size={18}/></Link></li>)}</ul>}</>}
     </div>
    </section>
   </div>
   <section className="library-collection" aria-labelledby="collection-title">
    <div className="section-heading"><h2 id="collection-title">{text.library}</h2></div>
    <div className="talk-grid">{sources.map((source,index)=>{
     const label=source.labels[lang],params=new URLSearchParams({lang});if(profile)params.set("profile",profile);
     return <article key={source.id} className={"talk-card "+(source.ready?"talk-ready":"talk-unready")} aria-labelledby={"talk-title-"+source.id}>
      <div className="talk-card-top"><span className="talk-number" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span className="status-chip">{source.ready?text.ready:text.notReady}</span></div>
      <p className="eyebrow">{label.event}</p>
      <h3 id={"talk-title-"+source.id}>{label.title}</h3>
      <div className="talk-meta">{source.speaker&&<p>{source.speaker}</p>}<p>{Math.ceil(source.durationMs/60000)} {text.minutes}</p></div>
      {source.ready?<><p className="talk-readiness">{text.readyReason}</p><Link className="open-talk" href={"/watch/"+source.id+"?"+params}>{text.openTalk}<ArrowUpRight aria-hidden="true" size={28}/></Link></>:<p className="unready-reason">{label.unreadyReason??source.unreadyReason??label.readiness}</p>}
     </article>;
    })}</div>
   </section>
   <footer className="library-footer"><p>{text.privacy}</p><div><p>{text.nativeReview}</p><p>{text.voiceOmitted}</p></div></footer>
  </main>
 </div>;
}
