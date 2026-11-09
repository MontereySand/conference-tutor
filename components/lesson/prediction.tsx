"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { TextArea } from "@astryxdesign/core/TextArea";
import { t } from "@/lib/i18n";
import type { Lang, TurnKey } from "@/lib/types";
import { sameTurn } from "@/lib/session/reducer";
import type { AskResult } from "./types";
export function Prediction({result,lang,onCites}:{result:AskResult;lang:Lang;onCites:(ids:string[])=>React.ReactNode}) {
  const [attempt,setAttempt]=useState(""),[revealed,setRevealed]=useState(false),[pending,setPending]=useState(false),[failed,setFailed]=useState(false),[verdict,setVerdict]=useState<"correct"|"partly"|"incorrect"|null>(null);
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
    setAttempt(value.slice(0,2000));setPending(false);setFailed(false);setVerdict(null);
  }
  return <section className="prediction">
    <Collapsible className="prediction-dock" defaultIsOpen={false} trigger={
      <span className="prediction-dock-trigger"><strong>{text.checkUnderstanding}</strong><span>{prediction.prompt}</span></span>
    }>
      <div className="prediction-body">
        <h3>{text.prediction}</h3>
        <p>{prediction.prompt}</p>
        {!revealed&&<small>{text.predictionHidden}</small>}
        <TextArea label={text.attempt} maxLength={2000} value={attempt} onChange={editAttempt}/>
        <div className="button-row">
          <Button isDisabled={pending||!attempt.trim()} onClick={check} label={pending?text.checking:text.check}/>
          <Button variant="secondary" onClick={()=>{controller.current?.abort();setPending(false);setFailed(false);setVerdict(null);setRevealed(true);}} label={text.skip}/>
        </div>
        {failed&&<p role="alert">{text.predictionError}</p>}
        {verdict&&<strong role="status">{text[verdict]}</strong>}
        {revealed&&<div className="prediction-feedback">
          <h4>{text.expected}</h4>
          <p>{prediction.expected}</p>
          {prediction.cites.length>0&&<Collapsible className="prediction-support" trigger={text.practiceWhy} defaultIsOpen={false}>
            {onCites(prediction.cites)}
          </Collapsible>}
        </div>}
      </div>
    </Collapsible>
  </section>;
}
