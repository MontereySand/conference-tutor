"use client";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { htmlLang, t, timestamp } from "@/lib/i18n";
import { demoScenario } from "@/lib/demo-scenario";
import type { Corrections, Lang, ProfileCard } from "@/lib/types";
import type { AskResult, StageError } from "./types";
import { StageErrorMessage } from "./stage-error";
import { Prediction } from "./prediction";
import { DemoDiagram } from "./demo-diagram";
import styles from "./teaching.module.css";

export function LessonPane({result,lang,card,corrections,pending,error,sourceId,currentMs,askedAtMs,onSeek,onRetry,onCorrect,onQuestion}:{result:AskResult|null;lang:Lang;card:ProfileCard|undefined;corrections:Corrections;pending:boolean;error:StageError|null;sourceId:string;currentMs:number;askedAtMs:number|null;onSeek:(ms:number)=>void;onRetry:()=>void;onCorrect:(corrections:Corrections)=>void;onQuestion:(question:string)=>void}) {
  const text=t(lang), previous=result!==null&&result.turnKey.lang!==lang;
  const showDiagram=sourceId===demoScenario.sourceId&&[currentMs,askedAtMs].some(ms=>ms!==null&&ms>=demoScenario.startMs&&ms<demoScenario.endMs);

  function citations(ids:string[]) {
    return <div className={styles.citations} aria-label={text.citations}>
      {ids.map(id=>{
        const source=result?.sources.find(source=>source.chunkId===id);
        if(!source) return null;
        return source.kind==="talk"&&source.startMs!==undefined
          ? <Button variant="secondary" size="sm" key={id} onClick={()=>onSeek(source.startMs!)} label={text.source+": "+source.title+" "+timestamp(source.startMs)}>
              <span>{timestamp(source.startMs)}</span>{" "}<span>{source.title}</span>
            </Button>
          : <a className={styles.citationLink} key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>;
      })}
    </div>;
  }

  return <aside className={styles.lesson} aria-label={text.lesson} aria-busy={pending}>
    <DemoDiagram lang={lang} visible={showDiagram} card={card} noAnalogy={corrections.noAnalogy} onSeek={onSeek}/>
    {pending&&<p role="status">{text.pending}</p>}
    {error&&<div>
      <StageErrorMessage error={error} lang={lang}/>
      <Button variant="secondary" isDisabled={pending} onClick={onRetry} label={text.retry}/>
    </div>}
    {result&&<div className={styles.content} lang={htmlLang[result.turnKey.lang]}>
      {previous&&<p className={styles.previous} role="status" lang={htmlLang[lang]}>{text.previousLanguage}</p>}
      {result.lesson.answer&&<section>
        <h3 lang={htmlLang[lang]}>{text.answerHeading}</h3>
        <p className={styles.answer}>{result.lesson.answer}</p>
      </section>}
      {result.lesson.cites.length>0&&<section>
        <h3 lang={htmlLang[lang]}>{text.talkCitations}</h3>
        {citations(result.lesson.cites)}
      </section>}
      {result.lesson.boundary&&<section className={styles.bounded}>
        <h3 lang={htmlLang[lang]}>{text.boundary}</h3>
        <p>{result.lesson.boundary.reason}</p>
        {result.lesson.boundary.nearbyQuestion&&<Button variant="secondary" isDisabled={pending||previous} onClick={()=>onQuestion(result.lesson.boundary!.nearbyQuestion)} label={`${text.nearby}: ${result.lesson.boundary.nearbyQuestion}`}/>}
      </section>}
      {result.lesson.bridge&&card&&!corrections.noAnalogy&&<section className={styles.bounded}>
        <h3 lang={htmlLang[lang]}>{text.bridge} {card.name}</h3>
        <p>{result.lesson.bridge.text}</p>
        <div><h4 lang={htmlLang[lang]}>{text.limit}</h4><p>{result.lesson.bridge.limit}</p></div>
      </section>}
      {result.lesson.steps.length>0&&<section>
        <Collapsible key={result.turnKey.turnId} className={styles.disclosure} trigger={text.steps} defaultIsOpen={false}>
          <ol className={styles.steps}>{result.lesson.steps.map((step,i)=><li key={i}>
            <p>{step.text}</p>{citations(step.cites)}
          </li>)}</ol>
        </Collapsible>
      </section>}
      {result.lesson.referenceNotes.map(note=>{
        const source=result.sources.find(source=>source.chunkId===note.refChunkId&&source.kind==="reference");
        return source&&<section className={styles.bounded} key={note.refChunkId}>
          <h3 lang={htmlLang[lang]}>{text.reference}</h3>
          <p>{note.text}</p>
          <a className={styles.citationLink} href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
        </section>;
      })}
      {!previous&&<>
        <section className={styles.bounded}>
          <h3>{text.correctionsHeading}</h3>
          <div className={styles.actions}>
            <Button variant="secondary" isDisabled={pending} aria-pressed={corrections.depth==="simple"} onClick={()=>onCorrect({...corrections,depth:"simple"})} label={text.simpler}/>
            <Button variant="secondary" isDisabled={pending} aria-pressed={corrections.depth==="deep"} onClick={()=>onCorrect({...corrections,depth:"deep"})} label={text.deeper}/>
            <Button variant="secondary" isDisabled={pending} aria-pressed={corrections.noAnalogy} onClick={()=>onCorrect({...corrections,noAnalogy:true})} label={text.noAnalogy}/>
            <Button variant="secondary" isDisabled={pending} onClick={()=>onCorrect({...corrections,depth:"deep"})} label={text.knowAlready}/>
          </div>
        </section>
        {!pending&&<Prediction key={result.turnKey.turnId} result={result} lang={lang} onCites={citations}/>}
      </>}
    </div>}
  </aside>;
}
