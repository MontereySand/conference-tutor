"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import type { Lang, TurnKey } from "@/lib/types";
import { sameTurn } from "@/lib/session/reducer";
import type { AskResult } from "./types";
export function Prediction({result,lang,onCites}:{result:AskResult;lang:Lang;onCites:(ids:string[])=>React.ReactNode}) {
  const [opened,setOpened]=useState(false),[attempt,setAttempt]=useState(""),[revealed,setRevealed]=useState(false),[pending,setPending]=useState(false),[failed,setFailed]=useState(false),[verdict,setVerdict]=useState<"correct"|"partly"|"incorrect"|null>(null);
  const controller=useRef<AbortController|null>(null),text=t(lang),prediction=result.lesson.prediction;
  useEffect(()=>()=>controller.current?.abort(),[]);
  if(!prediction)return null;
  async function check(){
    if(!attempt.trim()||!prediction)return;
    controller.current?.abort();const active=new AbortController();controller.current=active;setPending(true);setFailed(false);setVerdict(null);setRevealed(true);
    try{
      const response=await fetch("/api/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({turnKey:result.turnKey,attempt,prediction}),signal:active.signal});
      const data=await response.json() as {turnKey:TurnKey;verdict:"correct"|"partly"|"incorrect"};
      if(!response.ok)throw new Error("check");
      if(!active.signal.aborted&&sameTurn(data.turnKey,result.turnKey)&&["correct","partly","incorrect"].includes(data.verdict))setVerdict(data.verdict);else if(!active.signal.aborted)throw new Error("check");
    }catch{if(!active.signal.aborted)setFailed(true);}finally{if(!active.signal.aborted)setPending(false);}
  }
  function editAttempt(value:string){
    controller.current?.abort();
    setAttempt(value);setPending(false);setFailed(false);setVerdict(null);
  }
  return <section className="prediction"><Button variant="outline" onClick={()=>setOpened(true)} aria-expanded={opened}>{text.tryPrediction}</Button>{opened&&<><h3>{text.prediction}</h3><p>{prediction.prompt}</p><small>{text.predictionHidden}</small><label>{text.attempt}<Textarea maxLength={2000} value={attempt} onChange={event=>editAttempt(event.target.value)}/></label><div className="button-row"><Button disabled={pending||!attempt.trim()} onClick={check}>{pending?text.checking:text.check}</Button><Button variant="outline" onClick={()=>{controller.current?.abort();setPending(false);setRevealed(true);}}>{text.skip}</Button></div>{failed&&<p role="alert">{text.predictionError}</p>}{verdict&&<strong role="status">{text[verdict]}</strong>}{revealed&&<div><h4>{text.expected}</h4><p>{prediction.expected}</p>{onCites(prediction.cites)}</div>}</>}</section>;
}
