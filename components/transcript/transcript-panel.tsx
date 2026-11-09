"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { ContextMenu } from "@astryxdesign/core/ContextMenu";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { activeSentenceAt } from "@/lib/clock";
import { t, timestamp } from "@/lib/i18n";
import type { Concept, Lang, Sentence, Transcript } from "@/lib/types";
import { boundedSelection, visibleGlosses } from "./transcript-helpers";
import styles from "./transcript-panel.module.css";

type Target = { sentence: Sentence; selection: string };

export function TranscriptPanel({ transcript, english, lang, currentMs, concepts, onSeek, onConcept, onDump }: {
  transcript: Transcript; english: Transcript; lang: Lang; currentMs: number; concepts: Concept[];
  onSeek: (ms: number) => void; onConcept: (question: string) => void; onDump: (text: string) => void;
}) {
  const [follow, setFollow] = useState(true);
  const [original, setOriginal] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [clipboardError, setClipboardError] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const savedSelection = useRef<{ id: string; text: string } | null>(null);
  const pointer = useRef(false);
  const index = activeSentenceAt(transcript.sentences, currentMs);
  const active = transcript.sentences[index];
  const text = t(lang);
  const originals = new Map(english.sentences.map(sentence => [sentence.id, sentence.text]));
  const keyFor = (sentence: Sentence) => `${transcript.sourceId}:${lang}:${sentence.id}`;

  useEffect(() => {
    if (!follow || !active) return;
    const row = rows.current.get(active.id), container = panel.current;
    if (row && container) {
      const top = container.scrollTop + row.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientHeight / 2 + row.clientHeight / 2;
      container.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [active, follow]);

  function captureSelection(sentence: Sentence) {
    const selection = window.getSelection(), row = rows.current.get(sentence.id);
    if (selection && row && !selection.isCollapsed && row.contains(selection.anchorNode) && row.contains(selection.focusNode)) {
      const value = boundedSelection(selection.toString());
      if (value) { savedSelection.current = { id: sentence.id, text: value }; setFollow(false); return value; }
    }
    return "";
  }
  function choose(sentence: Sentence, useSaved: boolean) {
    const selection = captureSelection(sentence) || (useSaved && savedSelection.current?.id === sentence.id ? savedSelection.current.text : "");
    setTarget({ sentence, selection: selection || boundedSelection(annotations[keyFor(sentence)] ?? sentence.text) });
    setClipboardError(false);
    setFollow(false);
  }
  function closeEditor(sentence: Sentence) {
    setEditing(null);
    requestAnimationFrame(() => rows.current.get(sentence.id)?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus());
  }
  function actions(item: Target | null) {
    const value = item?.selection ?? "";
    return [
      { label: text.transcriptExplainSelection, isDisabled: !value, onClick: () => onConcept(`${text.transcriptExplainPrompt} ${value}`) },
      { label: text.transcriptDefine, isDisabled: !value, onClick: () => onConcept(`${text.transcriptDefinePrompt} ${value}`) },
      { label: text.transcriptSimplify, isDisabled: !value, onClick: () => onConcept(`${text.transcriptSimplifyPrompt} ${value}`) },
      { label: text.transcriptAddDump, isDisabled: !value, onClick: () => onDump(value) },
      { label: text.transcriptEdit, isDisabled: !item, onClick: () => { if (item) { const key = keyFor(item.sentence); setEditing(key); setDraft(annotations[key] ?? item.sentence.text); setFollow(false); } } },
      { label: text.transcriptCopy, isDisabled: !value, onClick: () => { void (async () => { try { if (!navigator.clipboard) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(value); setClipboardError(false); } catch { setClipboardError(true); } })(); } },
    ];
  }

  return <section className={styles.panel} aria-label={text.transcript} onKeyDown={event => event.stopPropagation()}>
    <header className={styles.heading}><h2>{text.transcript}</h2>{!follow && <Button variant="secondary" size="sm" label={text.backNow} onClick={() => { savedSelection.current = null; setFollow(true); }} />}</header>
    <div className={styles.notices}><small>{transcript.reviewed ? text.reviewed : text.derived}</small>{transcript.machineTranslated && <small>{text.machine}</small>}{lang !== "en" && <label><input type="checkbox" checked={original} onChange={event => setOriginal(event.target.checked)} /> {text.showOriginal}</label>}</div>
    <small className={styles.selectionHint}>{text.transcriptSelectionHint}</small>
    {clipboardError && <p className={styles.error} role="status">{text.transcriptCopyFailed}</p>}
    <div ref={panel} className={styles.scroll} tabIndex={0} aria-label={text.transcript} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)} onPointerDown={() => { pointer.current = true; }} onPointerUp={() => { pointer.current = false; }} onPointerCancel={() => { pointer.current = false; }} onScroll={() => { if (pointer.current) setFollow(false); }} onKeyDown={event => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) setFollow(false); }}>
      <ContextMenu label={text.transcriptActions} presentation="adaptive" items={actions(target)} onContextMenu={event => {
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sentence-id]") : null;
        const sentence = transcript.sentences.find(item => item.id === element?.dataset.sentenceId);
        if (sentence) choose(sentence, false); else setTarget(null);
      }} onTouchStart={event => {
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sentence-id]") : null;
        const sentence = transcript.sentences.find(item => item.id === element?.dataset.sentenceId);
        if (sentence) choose(sentence, false);
      }}>
        {transcript.sentences.map((sentence, i) => {
          const key = keyFor(sentence), annotation = annotations[key], isActive = i === index;
          return <div key={sentence.id} data-sentence-id={sentence.id} ref={node => { if (node) rows.current.set(sentence.id, node); else rows.current.delete(sentence.id); }} className={`${styles.row} ${isActive ? styles.active : i < index || (index < 0 && sentence.endMs <= currentMs) ? styles.past : ""}`} aria-current={isActive ? "true" : undefined} onMouseUp={event => { if (!(event.target instanceof Element && event.target.closest("button")) && !captureSelection(sentence)) savedSelection.current = null; }} onKeyUp={() => { captureSelection(sentence); }}>
            <div className={styles.rowTools}>
              <Button variant="ghost" size="sm" label={`${text.seek} ${timestamp(sentence.startMs)}`} onClick={() => onSeek(sentence.startMs)} />
              <DropdownMenu button={{ variant: "ghost", size: "sm", label: `${text.transcriptActions} ${timestamp(sentence.startMs)}` }} presentation="adaptive" onOpenChange={open => { if (open) choose(sentence, true); }} items={actions(target?.sentence.id === sentence.id ? target : { sentence, selection: boundedSelection(annotation ?? sentence.text) })} />
            </div>
            {annotation !== undefined ? <><p className={styles.caption}>{annotation}</p><p className={styles.original}><strong>{text.transcriptOriginal}:</strong> {sentence.text}</p><small>{text.transcriptAnnotationNotice}</small></> : <p className={styles.caption}>{sentence.words ? sentence.words.map((word, wordIndex) => <span key={wordIndex} className={isActive && currentMs >= word.startMs && currentMs < word.endMs ? styles.word : undefined}>{word.text}</span>) : sentence.text}</p>}
            {original && lang !== "en" && <p lang="en" className={styles.original}>{originals.get(sentence.id)}</p>}
            {editing === key && <div className={styles.editor}><label htmlFor={`caption-${sentence.id}`}>{text.transcriptAnnotationLabel}</label><textarea autoFocus id={`caption-${sentence.id}`} value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} onFocus={() => setFollow(false)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); closeEditor(sentence); } }} /><small>{text.transcriptAnnotationNotice}</small><div><Button variant="secondary" size="sm" label={text.transcriptSave} isDisabled={!draft.trim()} onClick={() => { setAnnotations(previous => ({ ...previous, [key]: draft.trim() })); closeEditor(sentence); }} /><Button variant="ghost" size="sm" label={text.transcriptCancel} onClick={() => closeEditor(sentence)} />{annotation !== undefined && <Button variant="ghost" size="sm" label={text.transcriptRestore} onClick={() => { setAnnotations(previous => { const next = { ...previous }; delete next[key]; return next; }); closeEditor(sentence); }} />}</div></div>}
          </div>;
        })}
      </ContextMenu>
    </div>
    <div className={styles.glosses}>{visibleGlosses(transcript.glosses, currentMs).map(gloss => <aside key={gloss.id} className={styles.gloss}><small>{text.transcriptPrepared}</small><strong>{gloss.term}</strong><p>{gloss.text}</p><small>{text.transcriptSources}: {gloss.cites.join(", ")}</small></aside>)}</div>
    <div className={styles.concepts} aria-label={text.concepts}>{concepts.filter(concept => currentMs >= concept.startMs && currentMs < concept.endMs).map(concept => <Button variant="secondary" size="sm" key={concept.id} label={`${concept.title[lang]} ↗`} onClick={() => onConcept(concept.suggested[lang])} />)}</div>
  </section>;
}
