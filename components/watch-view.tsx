"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Source } from "@/lib/data-schema";
import type { Lang, ProfileCard, Transcript, TurnKey } from "@/lib/types";
import { htmlLang, t } from "@/lib/i18n";
import { createSession, sessionReducer, type LessonRequest, type SessionAction } from "@/lib/session/reducer";
import { YouTubePlayer, type PlayerHandle } from "@/components/player/youtube-player";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { LanguagePicker } from "@/components/profile/language-picker";
import { AskBox } from "@/components/lesson/ask-box";
import { LessonPane } from "@/components/lesson/lesson-pane";
import type { AskResult, StageError } from "@/components/lesson/types";
import { TimingOverlay } from "@/components/dev/timing-overlay";
import { activeSentenceAt } from "@/lib/clock";
import styles from "./watch-view.module.css";
export function WatchView({source,transcript,english,cards,lang,profileId,initialMs,review,autoplay}:{source:Source;transcript:Transcript|null;english:Transcript;cards:ProfileCard[];lang:Lang;profileId:string;initialMs:number;review:boolean;autoplay:boolean}) {
 const router=useRouter(),player=useRef<PlayerHandle>(null),surface=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),controller=useRef<AbortController|null>(null),seeking=useRef(false);
 const [session,setSession]=useState(()=>createSession(source.id,profileId,lang)),current=useRef(session),[currentMs,setCurrentMs]=useState(initialMs),[seekPending,setSeekPending]=useState(false),[controlsTarget,setControlsTarget]=useState<HTMLDivElement|null>(null);
 const navigation=useRef<{sourceId:string;lang:Lang;profileId:string|null}|null>(null);
 const update=useCallback((action:SessionAction)=>{current.current=sessionReducer(current.current,action);setSession(current.current);},[]);
 const onSeekPending=useCallback((pending:boolean)=>{seeking.current=pending;setSeekPending(pending);},[]);
 const abort=useCallback(()=>{controller.current?.abort();controller.current=null;update({type:"cancel"});},[update]);
 useEffect(()=>()=>{controller.current?.abort();},[]);
 const send=useCallback(async(request:LessonRequest,bookmark=false)=>{
   const state=current.current,q=request.question.trim(),requestMs=bookmark?player.current?.getTimeMs():(state.askedAtMs??player.current?.getTimeMs());if(seeking.current||!q||requestMs===undefined||!Number.isFinite(requestMs))return;
   const submitted={...request,question:q};
   if(bookmark)update({type:"bookmark",ms:requestMs,wasPlaying:player.current?.state()===1});
   controller.current?.abort();const active=new AbortController();controller.current=active;
   const key:TurnKey={sourceId:state.sourceId,profileId:state.profileId,lang:state.lang,version:state.version,turnId:crypto.randomUUID()};
   update({type:"begin",key,request:submitted});
   try{
    const response=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({turnKey:key,...submitted,currentMs:requestMs,history:state.history.slice(-2)}),signal:active.signal});
    const data=await response.json() as AskResult & {error?:StageError};
    if(!response.ok){if(!active.signal.aborted)update({type:"error",key,error:data.error??{stage:"request",code:"unavailable"}});return;}
    if(!active.signal.aborted)update({type:"result",result:data});
   }catch{if(!active.signal.aborted)update({type:"error",key,error:{stage:"request",code:"unavailable"}});}
   finally{if(controller.current===active)controller.current=null;}
 },[update]);
 useEffect(()=>{
  const target=navigation.current;
  if(target&&target.sourceId===source.id&&(target.lang!==lang||target.profileId!==profileId))return;
  navigation.current=null;
  if(current.current.sourceId!==source.id||current.current.lang!==lang||current.current.profileId!==profileId){
   controller.current?.abort();controller.current=null;
   update({type:"switch",sourceId:source.id,profileId,lang});
  }
  const queued=current.current.queuedRequest;
  if(queued&&!seekPending&&transcript?.sourceId===source.id&&transcript.lang===lang)void send(queued);
 },[lang,profileId,source.id,transcript,session.queuedRequest,seekPending,send,update]);
 const text=t(session.lang),card=cards.find(card=>card.id===session.profileId);
 function askQuestion(question:string){
  const state=current.current;if(state.pending||state.queuedRequest||!question.trim())return;
  void send({requestKind:"question",question,corrections:state.corrections},true);
 }
 function switchSelection(nextLang:Lang,nextProfile:string|null){
  if(nextLang===current.current.lang&&nextProfile===current.current.profileId)return;
  const languageChanged=nextLang!==current.current.lang||nextLang!==lang;
  const observedMs=player.current?.getTimeMs(),ms=observedMs!==undefined&&Number.isFinite(observedMs)?observedMs:currentMs;
  controller.current?.abort();controller.current=null;
  update({type:"switch",sourceId:source.id,profileId:nextProfile,lang:nextLang});
  navigation.current={sourceId:source.id,lang:nextLang,profileId:nextProfile};
  const params=new URLSearchParams({lang:nextLang,t:String(ms/1000)});if(nextProfile)params.set("profile",nextProfile);if(review)params.set("review","1");
  const url="/watch/"+source.id+"?"+params;
  if(languageChanged)router.replace(url,{scroll:false});else window.history.replaceState(null,"",url);
 }
 function seek(ms:number){player.current?.seekTo(ms);surface.current?.focus({preventScroll:true});}
 function dump(selection:string){
  const addition=selection.trim();if(!addition)return;
  const draft=current.current.question;
  update({type:"question",question:(draft+(draft.trim()?"\n\n":"")+addition).slice(0,2000)});
  const focus=()=>requestAnimationFrame(()=>input.current?.focus());
  const dialog=document.querySelector<HTMLDialogElement>("dialog[open]");
  if(dialog)dialog.addEventListener("close",focus,{once:true});else focus();
 }
 const pending=session.pending!==null||session.queuedRequest!==null;
 return <div ref={surface} tabIndex={0} className={styles.surface} lang={htmlLang[session.lang]} aria-label={text.watch} aria-keyshortcuts="Space /" onKeyDown={event=>{
  if(event.defaultPrevented||event.nativeEvent.isComposing||event.repeat||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||event.target!==event.currentTarget)return;
  if(event.key===" "){event.preventDefault();if(player.current?.state()===1)player.current.pause();else player.current?.play();}
  else if(event.key==="/"){event.preventDefault();input.current?.focus();}
 }}>
 <header className={`${styles.header} theatre-darkbar`}><Link href={"/?lang="+session.lang+"&profile="+encodeURIComponent(profileId)} className={styles.brand}>DATABRICKS CONFERENCE TUTOR</Link><LanguagePicker lang={session.lang} onChange={value=>switchSelection(value,profileId)}/></header>
 <main className={styles.canvas}>
  <div className={styles.video}><YouTubePlayer key={source.id} ref={player} videoId={source.youtubeId} initialMs={initialMs} durationMs={source.durationMs} lang={session.lang} autoplay={autoplay} controlsTarget={controlsTarget} onTime={setCurrentMs} onSeekPending={onSeekPending}/></div>
  <div className={styles.transcript}>{transcript?.lang===session.lang?<TranscriptPanel transcript={transcript} english={english} lang={session.lang} currentMs={currentMs} onSeek={seek} onDump={dump}/>:<section className="panel" role="status"><p>{lang!==session.lang?text.pending:text.translationUnavailable}</p></section>}</div>
  <div className={styles.lesson}><LessonPane sourceId={source.id} currentMs={currentMs} result={session.result} lang={session.lang} card={card} corrections={session.corrections} pending={pending} error={session.error} askedAtMs={session.askedAtMs} onSeek={seek} onRetry={()=>{const request=current.current.lastRequest;if(request)void send(request);}} onCorrect={corrections=>{const question=current.current.resultQuestion;if(question&&!seeking.current&&Number.isFinite(player.current?.getTimeMs()))void send({requestKind:"regenerate",question,corrections});}} onQuestion={askQuestion}/></div>
  <div className={styles.dump}><AskBox lang={session.lang} question={session.question} pending={pending} disabled={seekPending} inputRef={input} onChange={question=>update({type:"question",question})} onSubmit={()=>askQuestion(current.current.question)} onCancel={abort}/></div>
 </main>
 {review&&<TimingOverlay sourceId={source.id} transcript={english} currentMs={currentMs} activeId={english.sentences[activeSentenceAt(english.sentences,currentMs)]?.id??null} lang={session.lang} disabled={seekPending} getTime={()=>player.current?.getTimeMs()??currentMs} onSaved={()=>router.refresh()}/>}
 <footer className={`${styles.footer} theatre-darkbar`}><div ref={setControlsTarget} className={styles.transport}/></footer>
 </div>;
}
