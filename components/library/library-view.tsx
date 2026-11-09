"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { TextArea } from "@astryxdesign/core/TextArea";
import type { Source } from "@/lib/data-schema";
import type { Lang, ProfileCard } from "@/lib/types";
import { htmlLang, t, timestamp } from "@/lib/i18n";
import { LanguagePicker } from "@/components/profile/language-picker";
import { ProfileArt } from "@/components/profile/profile-art";
import { StageErrorMessage } from "@/components/lesson/stage-error";
import { introCards, introWatchUrl } from "./intro";
import type { StageError } from "@/components/lesson/types";
import styles from "./library-view.module.css";

type Moment = { chunkId: string; sourceId: string; title: string; startMs: number; endMs: number; url: string };

export function LibraryView({ sources, cards, initialLang, initialProfile }: { sources: Source[]; cards: ProfileCard[]; initialLang: Lang; initialProfile: string | null }) {
  const [lang, setLang] = useState(initialLang);
  const [profile, setProfile] = useState(initialProfile);
  const [sourceId, setSourceId] = useState(() => sources.find(source => source.ready)?.id ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<StageError | null>(null);
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const selectedArt = useRef<HTMLDivElement | null>(null);
  const selectionOrigin = useRef<DOMRect | null>(null);
  const text = t(lang);
  const selected = cards.find(card => card.id === profile);
  const source = sources.find(item => item.id === sourceId && item.ready);
  const orderedCards = introCards(cards);

  useEffect(() => () => controller.current?.abort(), []);
  useLayoutEffect(() => {
    const origin = selectionOrigin.current;
    const target = selectedArt.current;
    selectionOrigin.current = null;
    if (!origin || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = target.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - end.left - end.width / 2;
    const y = origin.top + origin.height / 2 - end.top - end.height / 2;
    target.getAnimations().forEach(animation => animation.cancel());
    target.animate([{ transform: `translate(${x}px, ${y}px) scale(.45)`, opacity: .65 }, { transform: "translate(0, 0) scale(1)", opacity: 1 }], { duration: 400, easing: "cubic-bezier(.2,.7,.2,1)" });
  }, [profile]);
  function selection(nextLang: Lang, nextProfile: string | null) {
    controller.current?.abort();
    setPending(false); setError(null); setMoments(null);
    setLang(nextLang); setProfile(nextProfile);
    const query = new URLSearchParams({ lang: nextLang });
    if (nextProfile) query.set("profile", nextProfile);
    window.history.replaceState(null, "", "/?" + query);
  }
  function changeSearchOpen(open: boolean) {
    if (!open) { controller.current?.abort(); setPending(false); }
    setSearchOpen(open);
  }
  async function search() {
    if (!question.trim()) return;
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setPending(true); setError(null); setMoments(null);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), lang }), signal: active.signal });
      const data = await response.json() as { moments: Moment[]; error?: StageError };
      if (!active.signal.aborted) {
        if (!response.ok) setError(data.error ?? { stage: "search", code: "unavailable" });
        else setMoments(data.moments);
      }
    } catch {
      if (!active.signal.aborted) setError({ stage: "search", code: "unavailable" });
    } finally {
      if (!active.signal.aborted) setPending(false);
    }
  }
  function momentUrl(moment: Moment) {
    const url = new URL(moment.url, "http://local.invalid");
    if (profile) url.searchParams.set("profile", profile);
    url.searchParams.set("lang", lang);
    return url.pathname + url.search;
  }
  return <div lang={htmlLang[lang]} className={styles.surface}>
    <a className="skip-link" href="#intro-content">{text.skipContent}</a>
    <header className={`${styles.topbar} theatre-darkbar`}>
      <Link href="/" className={styles.brand}>{text.brand}</Link>
      <div className={styles.controls}>
        <button className={styles.searchButton} type="button" aria-label={text.search} aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Search size={17} aria-hidden="true" /><span className={styles.searchLabel}>{text.search}</span></button>
        <LanguagePicker lang={lang} onChange={value => selection(value, profile)} />
      </div>
    </header>
    <main id="intro-content" tabIndex={-1} className={styles.main}>
      <section className={styles.hero} aria-labelledby="intro-title">
        <h1 id="intro-title"><span>{text.introHeroLead}</span> <em>{text.introHeroLearn}</em></h1>
        <p>{text.introChoose}</p>
      </section>
      <section className={styles.selected} aria-label={text.chooseProfile}>
        <div ref={selectedArt} className={styles.selectedArt}><ProfileArt profileId={profile} label={selected?.name ?? text.general} /></div>
        <div className={styles.identity}>
          <p className={styles.kicker}>{text.tunedFor}</p>
          <h2>{selected?.name ?? text.general}</h2>
          <p>{selected?.role ?? text.generalProfileNote}</p>
          {source ? <>
            <p className={styles.source}>{source.labels[lang].title}<br /><span>{source.labels[lang].event}</span></p>
            <Link className={styles.start} href={introWatchUrl(source.id, lang, profile)} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) setOpening(true); }}>{text.introStart}<ArrowUpRight size={24} aria-hidden="true" /></Link>
            {opening && <p className={styles.opening} role="status">{text.introOpening} {selected?.name ?? text.general} · {source.labels[lang].event}</p>}
          </> : <p role="status">{text.introNoReady}</p>}
        </div>
      </section>
      <section className={styles.deckSection} aria-label={text.chooseProfile}>
        <p className={styles.deckHint}>{text.introChoose}</p>
        <div className={styles.deck}>
          {[null, ...orderedCards].map(card => {
            const name = card?.name ?? text.general;
            const id = card?.id ?? null;
            return <button type="button" key={id ?? "general"} className={styles.card} aria-label={name} aria-pressed={profile === id} onClick={event => { if (id !== profile) selectionOrigin.current = event.currentTarget.getBoundingClientRect(); selection(lang, id); }}>
              <span className={styles.cardName}>{card ? card.name.trim().split(/\s+/)[0] : text.general}</span>
              <span className={styles.cardArt}><ProfileArt profileId={id} label={name} /></span>
              <span className={styles.cardRole}>{card?.role ?? text.generalProfileNote}</span>
            </button>;
          })}
        </div>
      </section>
    </main>
    <footer className={styles.bottomBar} />
    <Dialog isOpen={searchOpen} onOpenChange={changeSearchOpen} className={styles.dialog} width="42rem" maxHeight="85dvh" purpose="form">
      <div lang={htmlLang[lang]} className={styles.dialogContent}>
        <DialogHeader title={text.search} subtitle={text.searchHint} onOpenChange={changeSearchOpen} />
        <form onSubmit={event => { event.preventDefault(); void search(); }} className={styles.searchForm}>
          <TextArea id="library-question" label={text.searchHint} value={question} onChange={value => { if (pending) { controller.current?.abort(); setPending(false); } setMoments(null); setError(null); setQuestion(value.slice(0, 2000)); }} />
          <Button type="submit" variant="primary" label={pending ? text.searching : text.searchAction} isDisabled={!question.trim()} isLoading={pending} />
        </form>
        {pending && <p role="status">{text.searching}</p>}
        {error && <><StageErrorMessage error={error} lang={lang} /><Button variant="secondary" label={text.retry} onClick={() => void search()} /></>}
        <div aria-live="polite" aria-atomic="true">
          {moments !== null && <><h3>{text.searchResults}</h3>{moments.length === 0 ? <p>{text.noMoments}</p> : <ul className={styles.results}>{moments.map(moment => <li key={moment.chunkId}><Link href={momentUrl(moment)}><span>{timestamp(moment.startMs)}</span><span>{sources.find(item => item.id === moment.sourceId)?.labels[lang].title ?? moment.title}</span><ArrowUpRight aria-hidden="true" size={18} /></Link></li>)}</ul>}</>}
        </div>
        <section className={styles.sources} aria-label={text.library}>
          <h3>{text.library}</h3>
          {sources.map(item => <div key={item.id} className={styles.sourceOption}>
            <div><strong>{item.labels[lang].title}</strong><p>{item.labels[lang].event}</p>{!item.ready && <p>{item.labels[lang].unreadyReason ?? item.unreadyReason ?? item.labels[lang].readiness}</p>}</div>
            {item.ready ? <Button variant="secondary" label={item.id === sourceId ? text.introSelected : text.introSelectTalk} aria-pressed={item.id === sourceId} onClick={() => { setSourceId(item.id); changeSearchOpen(false); }} /> : <span>{text.notReady}</span>}
          </div>)}
        </section>
      </div>
    </Dialog>
  </div>;
}
