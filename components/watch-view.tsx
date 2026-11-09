"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Source } from "@/lib/data-schema";
import type { Concept, Lang, ProfileCard, Transcript, TurnKey } from "@/lib/types";
import { htmlLang, t } from "@/lib/i18n";
import { createSession, sessionReducer, type LessonRequest, type SessionAction } from "@/lib/session/reducer";
import { YouTubePlayer, type PlayerHandle } from "@/components/player/youtube-player";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { ProfilePicker } from "@/components/profile/profile-picker";
import { LanguagePicker } from "@/components/profile/language-picker";
import { AskBox } from "@/components/lesson/ask-box";
import { LessonPane } from "@/components/lesson/lesson-pane";
import type { AskResult, StageError } from "@/components/lesson/types";
import { TimingOverlay } from "@/components/dev/timing-overlay";
import { activeSentenceAt } from "@/lib/clock";
import { Button } from "@/components/ui/button";
export function WatchView({source,transcript,english,cards,concepts,lang,profileId,initialMs,review}:{source:Source;transcript:Transcript|null;english:Transcript;cards:ProfileCard[];concepts:Concept[];lang:Lang;profileId:string|null;initialMs:number;review:boolean}) {
 const router=useRouter(),player=useRef<PlayerHandle>(null),surface=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),controller=useRef<AbortController|null>(null),drafting=useRef(false);
 const [session,setSession]=useState(()=>createSession(source.id,profileId,lang)),current=useRef(session),[currentMs,setCurrentMs]=useState(initialMs);
 const navigation=useRef<{sourceId:string;lang:Lang;profileId:string|null}|null>(null);
 const update=useCallback((action:SessionAction)=>{current.current=sessionReducer(current.current,action);setSession(current.current);},[]);
 const abort=useCallback(()=>{controller.current?.abort();controller.current=null;update({type:"cancel"});},[update]);
 useEffect(()=>()=>{controller.current?.abort();},[]);
 const send=useCallback(async(request:LessonRequest)=>{
   const state=current.current,q=request.question.trim();if(!q)return;
   const submitted={...request,question:q};
   controller.current?.abort();const active=new AbortController();controller.current=active;
   const key:TurnKey={sourceId:state.sourceId,profileId:state.profileId,lang:state.lang,version:state.version,turnId:crypto.randomUUID()};
   update({type:"begin",key,request:submitted});
   try{
    const response=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({turnKey:key,...submitted,currentMs:player.current?.getTimeMs()??0,history:state.history.slice(-2)}),signal:active.signal});
    const data=await response.json() as AskResult & {error?:StageError};
    if(!response.ok){if(!active.signal.aborted)update({type:"error",key,error:data.error??{stage:"request",code:"unavailable"}});return;}
    if(!active.signal.aborted){update({type:"result",result:data});if(current.current.result===data)drafting.current=false;}
   }catch{if(!active.signal.aborted)update({type:"error",key,error:{stage:"request",code:"unavailable"}});}
   finally{if(controller.current===active)controller.current=null;}
 },[update]);
 useEffect(()=>{
  const target=navigation.current;
  if(target&&target.sourceId===source.id&&(target.lang!==lang||target.profileId!==profileId))return;
  navigation.current=null;
  if(current.current.sourceId!==source.id||current.current.lang!==lang||current.current.profileId!==profileId){
   if(current.current.sourceId!==source.id||current.current.profileId!==profileId)drafting.current=false;
   controller.current?.abort();controller.current=null;
   update({type:"switch",sourceId:source.id,profileId,lang});
  }
  const queued=current.current.queuedRequest;
  if(queued&&transcript?.sourceId===source.id&&transcript.lang===lang)void send(queued);
 },[lang,profileId,source.id,transcript,session.queuedRequest,send,update]);
 const text=t(session.lang),card=cards.find(card=>card.id===session.profileId);
 function bookmark(){
  if(!drafting.current){const ms=player.current?.getTimeMs()??currentMs;update({type:"bookmark",ms,wasPlaying:player.current?.state()===1});drafting.current=true;}
  player.current?.pause();
 }
 function askQuestion(question:string){
  const state=current.current;if(state.pending||state.queuedRequest||!question.trim())return;
  bookmark();void send({requestKind:"question",question,corrections:state.corrections});
 }
 function switchSelection(nextLang:Lang,nextProfile:string|null){
  if(nextLang===current.current.lang&&nextProfile===current.current.profileId)return;
  const ms=player.current?.getTimeMs()??currentMs;
  controller.current?.abort();controller.current=null;
  if(nextProfile!==current.current.profileId)drafting.current=false;
  update({type:"switch",sourceId:source.id,profileId:nextProfile,lang:nextLang});
  navigation.current={sourceId:source.id,lang:nextLang,profileId:nextProfile};
  const params=new URLSearchParams({lang:nextLang,t:String(ms/1000)});if(nextProfile)params.set("profile",nextProfile);if(review)params.set("review","1");
  router.replace("/watch/"+source.id+"?"+params,{scroll:false});
 }
 function returnTalk(){abort();drafting.current=false;surface.current?.focus({preventScroll:true});if(current.current.wasPlaying)player.current?.play();}
 function seek(ms:number){player.current?.seekTo(ms);surface.current?.focus({preventScroll:true});}
 function explain(){const ms=player.current?.getTimeMs()??currentMs,concept=concepts.find(concept=>ms>=concept.startMs&&ms<concept.endMs);askQuestion(concept?.suggested[current.current.lang]??t(current.current.lang).explainMoment);}
 const label=source.labels[session.lang],pending=session.pending!==null||session.queuedRequest!==null;
 return <div ref={surface} tabIndex={0} className="watch-surface" lang={htmlLang[session.lang]} aria-label={text.watch} aria-keyshortcuts="Space / ArrowRight ArrowDown ArrowLeft ArrowUp PageDown PageUp" onKeyDown={event=>{
  if(event.defaultPrevented||event.nativeEvent.isComposing||event.repeat||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||event.target!==event.currentTarget)return;
  if(event.key===" "){event.preventDefault();if(player.current?.state()===1)player.current.pause();else player.current?.play();}
  else if(event.key==="/"){event.preventDefault();input.current?.focus();}
  else if(["ArrowRight","ArrowDown","PageDown"].includes(event.key)&&!current.current.pending&&!current.current.queuedRequest){event.preventDefault();explain();}
  else if(["ArrowLeft","ArrowUp","PageUp"].includes(event.key)){event.preventDefault();returnTalk();}
 }}>
 <header className="topbar watch-header"><Link href={"/?lang="+session.lang+(session.profileId?"&profile="+encodeURIComponent(session.profileId):"")} className="wordmark">{text.brand}</Link><div className="topbar-controls"><ProfilePicker cards={cards} profileId={session.profileId} lang={session.lang} onChange={id=>switchSelection(session.lang,id)}/><LanguagePicker lang={session.lang} onChange={value=>switchSelection(value,session.profileId)}/></div></header>
 <main className="watch-layout"><div className="watch-main"><div className="talk-heading"><p className="eyebrow">{label.event}</p><h1>{label.title}</h1>{source.speaker&&<p>{source.speaker}</p>}<a href={source.url} target="_blank" rel="noreferrer">{text.source} ↗</a></div>
 <YouTubePlayer key={source.id} ref={player} videoId={source.youtubeId} initialMs={initialMs} lang={session.lang} onTime={setCurrentMs}/>
 {transcript?.lang===session.lang?<TranscriptPanel transcript={transcript} english={english} lang={session.lang} currentMs={currentMs} concepts={concepts} onSeek={seek} onConcept={askQuestion}/>:<section className="panel" role="status"><p>{lang!==session.lang?text.pending:text.translationUnavailable}</p></section>}
 <div className="watch-question-region"><AskBox lang={session.lang} question={session.question} pending={pending} inputRef={input} onChange={question=>{bookmark();if(current.current.pending||current.current.queuedRequest)abort();update({type:"question",question});}} onSubmit={()=>askQuestion(current.current.question)} onCancel={abort}/>
 <Button variant="outline" disabled={pending} onClick={explain}>{text.explainMoment}</Button></div>
 {review&&<TimingOverlay sourceId={source.id} transcript={english} currentMs={currentMs} activeId={english.sentences[activeSentenceAt(english.sentences,currentMs)]?.id??null} lang={session.lang} getTime={()=>player.current?.getTimeMs()??currentMs} onSaved={()=>router.refresh()}/>}
 <p className="disclosure">{text.nativeReview}</p><p className="keyboard-help">{text.keyboard}</p></div>
 <LessonPane result={session.result} lang={session.lang} card={card} corrections={session.corrections} pending={pending} error={session.error} askedAtMs={session.askedAtMs} onSeek={seek} onRetry={()=>{const request=current.current.lastRequest;if(request)void send(request);}} onReturn={returnTalk} onBookmark={()=>{if(current.current.askedAtMs!==null)seek(current.current.askedAtMs);returnTalk();}} onCorrect={corrections=>{const question=current.current.resultQuestion;if(question){player.current?.pause();void send({requestKind:"regenerate",question,corrections});}}} onQuestion={askQuestion}/>
 </main></div>;
}
