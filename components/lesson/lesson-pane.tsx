"use client";
import { Button } from "@/components/ui/button";
import { htmlLang, t, timestamp } from "@/lib/i18n";
import type { Corrections, Lang, ProfileCard } from "@/lib/types";
import type { AskResult, StageError } from "./types";
import { StageErrorMessage } from "./stage-error";
import { Prediction } from "./prediction";

export function LessonPane({result,lang,card,corrections,pending,error,askedAtMs,onSeek,onRetry,onReturn,onBookmark,onCorrect,onQuestion}:{result:AskResult|null;lang:Lang;card:ProfileCard|undefined;corrections:Corrections;pending:boolean;error:StageError|null;askedAtMs:number|null;onSeek:(ms:number)=>void;onRetry:()=>void;onReturn:()=>void;onBookmark:()=>void;onCorrect:(corrections:Corrections)=>void;onQuestion:(question:string)=>void}) {
  const text=t(lang), previous=result!==null&&result.turnKey.lang!==lang;

  function citations(ids:string[]) {
    return <div className="citation-row" aria-label={text.citations}>
      {ids.map(id=>{
        const source=result?.sources.find(source=>source.chunkId===id);
        if(!source) return null;
        return source.kind==="talk"&&source.startMs!==undefined
          ? <Button variant="outline" size="sm" key={id} onClick={()=>onSeek(source.startMs!)} aria-label={text.source+": "+source.title+" "+timestamp(source.startMs)}>
              <span>{timestamp(source.startMs)}</span><span>{source.title}</span>
            </Button>
          : <a className="citation-link" key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>;
      })}
    </div>;
  }

  return <aside className="lesson-pane" aria-label={text.lesson} aria-busy={pending}>
    <header className="section-heading">
      <h2>{text.lesson}</h2>
      {askedAtMs!==null&&<small>{text.bookmark} <strong>{timestamp(askedAtMs)}</strong></small>}
    </header>
    {pending&&<p role="status">{text.pending}</p>}
    {error&&<div>
      <StageErrorMessage error={error} lang={lang}/>
      <Button variant="outline" disabled={pending} onClick={onRetry}>{text.retry}</Button>
    </div>}
    {!result&&!pending&&!error&&<p className="lesson-empty">{text.lessonEmpty}</p>}
    {result&&<div className={previous?"lesson-content previous-language":"lesson-content"} lang={htmlLang[result.turnKey.lang]}>
      {previous&&<p className="previous-label" role="status" lang={htmlLang[lang]}>{text.previousLanguage}</p>}
      {result.lesson.answer&&<section>
        <h3 className="eyebrow" lang={htmlLang[lang]}>{text.answerHeading}</h3>
        <p className="direct-answer">{result.lesson.answer}</p>
      </section>}
      {result.lesson.cites.length>0&&<section>
        <h3 className="eyebrow" lang={htmlLang[lang]}>{text.talkCitations}</h3>
        {citations(result.lesson.cites)}
      </section>}
      {result.lesson.boundary&&<section className="source-boundary">
        <h3 lang={htmlLang[lang]}>{text.boundary}</h3>
        <p>{result.lesson.boundary.reason}</p>
        {result.lesson.boundary.nearbyQuestion&&<Button variant="outline" disabled={pending||previous} onClick={()=>onQuestion(result.lesson.boundary!.nearbyQuestion)}>
          {text.nearby}: {result.lesson.boundary.nearbyQuestion}
        </Button>}
      </section>}
      {result.lesson.bridge&&card&&!corrections.noAnalogy&&<section className="bridge">
        <h3 lang={htmlLang[lang]}>{text.bridge} {card.name}</h3>
        <p>{result.lesson.bridge.text}</p>
        <div><h4 lang={htmlLang[lang]}>{text.limit}</h4><p>{result.lesson.bridge.limit}</p></div>
      </section>}
      {result.lesson.steps.length>0&&<section>
        <h3 lang={htmlLang[lang]}>{text.steps}</h3>
        <ol className="lesson-steps">{result.lesson.steps.map((step,i)=><li key={i}>
          <p>{step.text}</p>{citations(step.cites)}
        </li>)}</ol>
      </section>}
      {result.lesson.referenceNotes.map(note=>{
        const source=result.sources.find(source=>source.chunkId===note.refChunkId&&source.kind==="reference");
        return source&&<section className="reference-note" key={note.refChunkId}>
          <h3 lang={htmlLang[lang]}>{text.reference}</h3>
          <p>{note.text}</p>
          <a className="citation-link" href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
        </section>;
      })}
      {!previous&&<>
        <section className="corrections">
          <h3>{text.correctionsHeading}</h3>
          <div className="button-row">
            <Button variant="outline" disabled={pending} aria-pressed={corrections.depth==="simple"} onClick={()=>onCorrect({...corrections,depth:"simple"})}>{text.simpler}</Button>
            <Button variant="outline" disabled={pending} aria-pressed={corrections.depth==="deep"} onClick={()=>onCorrect({...corrections,depth:"deep"})}>{text.deeper}</Button>
            <Button variant="outline" disabled={pending} aria-pressed={corrections.noAnalogy} onClick={()=>onCorrect({...corrections,noAnalogy:true})}>{text.noAnalogy}</Button>
            <Button variant="outline" disabled={pending} onClick={()=>onCorrect({...corrections,depth:"deep"})}>{text.knowAlready}</Button>
          </div>
        </section>
        {!pending&&<Prediction key={result.turnKey.turnId} result={result} lang={lang} onCites={citations}/>}
      </>}
    </div>}
    <footer className="return-controls">
      <Button onClick={onReturn}>{text.returnTalk}</Button>
      {askedAtMs!==null&&<Button variant="outline" onClick={onBookmark}>{text.returnAsked}</Button>}
    </footer>
    <small className="voice-note">{text.voiceOmitted}</small>
  </aside>;
}
