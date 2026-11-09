"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { t } from "@/lib/i18n";
import type { Lang, Transcript } from "@/lib/types";
export function TimingOverlay({sourceId,transcript,currentMs,activeId,lang,getTime,onSaved,disabled=false}:{sourceId:string;transcript:Transcript;currentMs:number;activeId:string|null;lang:Lang;getTime:()=>number;onSaved:()=>void;disabled?:boolean}) {
 const [selected,setSelected]=useState(transcript.sentences[0]?.id??""),[status,setStatus]=useState<"saved"|"error"|null>(null),[pending,setPending]=useState(false),controller=useRef<AbortController|null>(null),busy=useRef(false),text=t(lang);
 const mark=useCallback(async()=>{if(disabled||busy.current||!selected)return;const startMs=Math.round(getTime());if(!Number.isFinite(startMs)){setStatus("error");return;}busy.current=true;setPending(true);setStatus(null);const active=new AbortController();controller.current=active;
  try{const response=await fetch("/api/dev/timing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId,sentenceId:selected,startMs}),signal:active.signal});if(!response.ok)throw new Error("timing");if(!active.signal.aborted){setStatus("saved");onSaved();}}
  catch{if(!active.signal.aborted)setStatus("error");}finally{busy.current=false;if(!active.signal.aborted)setPending(false);}
 },[selected,sourceId,getTime,onSaved,disabled]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key.toLowerCase()!=="m"||event.repeat||event.ctrlKey||event.metaKey||event.altKey||!(event.target instanceof HTMLElement)||event.target.closest("input,textarea,select,button,[contenteditable],[role=dialog],[role=combobox]"))return;event.preventDefault();void mark();};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);},[mark]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 return <section className="timing-overlay"><h2>{text.review}</h2><p>{text.reviewHint}</p><p>{text.currentTime}: {Math.round(currentMs)} ms · {text.active}: {activeId??"—"}</p><Selector label={text.sentence} value={selected} onChange={setSelected} options={transcript.sentences.map(sentence=>({value:sentence.id,label:`${sentence.id} · ${sentence.text}`}))}/><p>{transcript.sentences.find(sentence=>sentence.id===selected)?.text}</p><Button isDisabled={pending||disabled} label={text.mark} onClick={()=>void mark()}/>{status&&<p role={status==="error"?"alert":"status"}>{status==="saved"?text.markSaved:text.markError}</p>}</section>;
}
