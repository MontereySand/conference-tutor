"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { activeSentenceAt } from "@/lib/clock";
import { t, timestamp } from "@/lib/i18n";
import type { Concept, Lang, Transcript } from "@/lib/types";
export function TranscriptPanel({transcript,english,lang,currentMs,concepts,onSeek,onConcept}:{transcript:Transcript;english:Transcript;lang:Lang;currentMs:number;concepts:Concept[];onSeek:(ms:number)=>void;onConcept:(question:string)=>void}) {
  const [follow,setFollow]=useState(true),[original,setOriginal]=useState(false);
  const panel=useRef<HTMLDivElement>(null),rows=useRef(new Map<string,HTMLButtonElement>()),pointer=useRef(false);
  const index=activeSentenceAt(transcript.sentences,currentMs),active=transcript.sentences[index],text=t(lang);
  const originals=new Map(english.sentences.map(sentence=>[sentence.id,sentence.text]));
  useEffect(()=>{
    if(!follow||!active)return;
    const row=rows.current.get(active.id),container=panel.current;
    if(row&&container)container.scrollTo({top:row.offsetTop-container.offsetTop-container.clientHeight/2+row.clientHeight/2,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  },[active,follow]);
  const stop=()=>setFollow(false);
  return <section className="transcript-block" aria-label={text.transcript}><div className="section-heading"><h2>{text.transcript}</h2>{!follow&&<Button variant="outline" onClick={()=>setFollow(true)}>{text.backNow}</Button>}</div><div className="transcript-notices"><small>{transcript.reviewed?text.reviewed:text.derived}</small>{transcript.machineTranslated&&<small>{text.machine}</small>}{lang!=="en"&&<label><input type="checkbox" checked={original} onChange={event=>setOriginal(event.target.checked)}/> {text.showOriginal}</label>}</div>
    <div ref={panel} className="transcript-scroll" tabIndex={0} onWheel={stop} onTouchMove={stop} onPointerDown={()=>{pointer.current=true;}} onPointerUp={()=>{pointer.current=false;}} onPointerCancel={()=>{pointer.current=false;}} onScroll={()=>{if(pointer.current)stop();}} onKeyDown={event=>{if(["Tab","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","PageUp","PageDown","Home","End"," "].includes(event.key))stop();}}>
    {transcript.sentences.map((sentence,i)=><div className={i===index?"sentence-row is-active":"sentence-row"} key={sentence.id}><Button variant="ghost" className="sentence" ref={node=>{if(node)rows.current.set(sentence.id,node);else rows.current.delete(sentence.id);}} aria-current={i===index?"true":undefined} aria-label={text.seek+" "+timestamp(sentence.startMs)+": "+sentence.text} onClick={()=>onSeek(sentence.startMs)}><span className="sentence-time">{i===index&&<span aria-label={text.active}>▶ </span>}{timestamp(sentence.startMs)}</span><span>{sentence.text}{original&&lang!=="en"&&<small lang="en" className="original-line">{originals.get(sentence.id)}</small>}</span></Button></div>)}
    </div><div className="concepts" aria-label={text.concepts}>{concepts.filter(concept=>currentMs>=concept.startMs&&currentMs<concept.endMs).map(concept=><Button variant="outline" key={concept.id} onClick={()=>onConcept(concept.suggested[lang])}>{concept.title[lang]} ↗</Button>)}</div></section>;
}
