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
  const savedSelection = useRef<{ ids: Set<string>; text: string } | null>(null);
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

  function captureSelection() {
    const selection = window.getSelection(), container = panel.current;
    if (!selection || !container || selection.isCollapsed || !container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return "";
    const range = selection.getRangeAt(0), parts: string[] = [], ids = new Set<string>();
    for (const row of container.querySelectorAll<HTMLElement>("[data-sentence-id]")) {
      const paragraphs = [row.querySelector(`.${styles.caption}`), ...row.querySelectorAll(`.${styles.original}`)];
      for (const paragraph of paragraphs) {
        if (!paragraph || !range.intersectsNode(paragraph)) continue;
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        let value = "", node: Node | null;
        while ((node = walker.nextNode())) {
          if (!range.intersectsNode(node)) continue;
          const start = node === range.startContainer ? range.startOffset : 0;
          const end = node === range.endContainer ? range.endOffset : node.textContent?.length ?? 0;
          value += (node.textContent ?? "").slice(start, end);
        }
        if (value.trim()) { parts.push(value); if (row.dataset.sentenceId) ids.add(row.dataset.sentenceId); break; }
      }
    }
    const value = boundedSelection(parts.join("\n"));
    if (value) { savedSelection.current = { ids, text: value }; setFollow(false); }
    return value;
  }
  function choose(sentence: Sentence, useSaved: boolean) {
    const selection = captureSelection() || (useSaved && savedSelection.current?.ids.has(sentence.id) ? savedSelection.current.text : "");
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
      <ContextMenu label={text.transcriptActions} presentation="adaptive" items={actions(target)} onOpenChange={open => { if (open) setFollow(false); }} onContextMenu={event => {
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sentence-id]") : null;
        const sentence = transcript.sentences.find(item => item.id === element?.dataset.sentenceId);
        if (sentence) choose(sentence, false); else setTarget(null);
      }} onTouchStart={event => {
        const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sentence-id]") : null;
        const sentence = transcript.sentences.find(item => item.id === element?.dataset.sentenceId);
        setTarget(sentence ? { sentence, selection: boundedSelection(annotations[keyFor(sentence)] ?? sentence.text) } : null);
      }}>
        {transcript.sentences.map((sentence, i) => {
          const key = keyFor(sentence), annotation = annotations[key], isActive = i === index;
          return <div key={sentence.id} data-sentence-id={sentence.id} ref={node => { if (node) rows.current.set(sentence.id, node); else rows.current.delete(sentence.id); }} className={`${styles.row} ${isActive ? styles.active : i < index || (index < 0 && sentence.endMs <= currentMs) ? styles.past : ""}`} aria-current={isActive ? "true" : undefined} onMouseUp={event => { if (!(event.target instanceof Element && event.target.closest("button")) && !captureSelection()) savedSelection.current = null; }} onKeyUp={() => { captureSelection(); }}>
            <div className={styles.rowTools}>
              <Button variant="ghost" size="sm" className={styles.timeButton} label={`${text.seek} ${timestamp(sentence.startMs)}`} onClick={() => onSeek(sentence.startMs)}>{timestamp(sentence.startMs)}</Button>
              <DropdownMenu button={{ variant: "ghost", size: "sm", className: styles.menuButton, label: `${text.transcriptActions} ${timestamp(sentence.startMs)}`, children: "⋯" }} hasChevron={false} presentation="adaptive" onOpenChange={open => { if (open) choose(sentence, true); }} items={actions(target?.sentence.id === sentence.id ? target : { sentence, selection: boundedSelection(annotation ?? sentence.text) })} />
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
