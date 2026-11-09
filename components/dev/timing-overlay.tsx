"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import type { Lang, Transcript } from "@/lib/types";
export function TimingOverlay({sourceId,transcript,currentMs,activeId,lang,getTime,onSaved}:{sourceId:string;transcript:Transcript;currentMs:number;activeId:string|null;lang:Lang;getTime:()=>number;onSaved:()=>void}) {
 const [selected,setSelected]=useState(transcript.sentences[0]?.id??""),[status,setStatus]=useState<"saved"|"error"|null>(null),[pending,setPending]=useState(false),controller=useRef<AbortController|null>(null),busy=useRef(false),text=t(lang);
 const mark=useCallback(async()=>{if(busy.current||!selected)return;busy.current=true;setPending(true);setStatus(null);const active=new AbortController();controller.current=active;
  try{const response=await fetch("/api/dev/timing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId,sentenceId:selected,startMs:Math.round(getTime())}),signal:active.signal});if(!response.ok)throw new Error("timing");if(!active.signal.aborted){setStatus("saved");onSaved();}}
  catch{if(!active.signal.aborted)setStatus("error");}finally{busy.current=false;if(!active.signal.aborted)setPending(false);}
 },[selected,sourceId,getTime,onSaved]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key.toLowerCase()!=="m"||event.repeat||event.ctrlKey||event.metaKey||event.altKey||!(event.target instanceof HTMLElement)||event.target.closest("input,textarea,select,button,[contenteditable],[role=dialog],[role=combobox]"))return;event.preventDefault();void mark();};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);},[mark]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 return <section className="timing-overlay"><h2>{text.review}</h2><p>{text.reviewHint}</p><p>{text.currentTime}: {Math.round(currentMs)} ms · {text.active}: {activeId??"—"}</p><Select value={selected} onValueChange={value=>{if(value)setSelected(value);}}><SelectTrigger aria-label={text.sentence}><SelectValue>{selected}</SelectValue></SelectTrigger><SelectContent>{transcript.sentences.map(sentence=><SelectItem key={sentence.id} value={sentence.id}>{sentence.id} · {sentence.text}</SelectItem>)}</SelectContent></Select><p>{transcript.sentences.find(sentence=>sentence.id===selected)?.text}</p><Button disabled={pending} onClick={()=>void mark()}>{text.mark}</Button>{status&&<p role={status==="error"?"alert":"status"}>{status==="saved"?text.markSaved:text.markError}</p>}</section>;
}
