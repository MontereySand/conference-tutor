"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import type { Source } from "@/lib/data-schema";
import type { Lang, ProfileCard } from "@/lib/types";
import { htmlLang, t } from "@/lib/i18n";
import { ProfileArt } from "@/components/profile/profile-art";
import { introCards, introWatchUrl } from "./intro";
import styles from "./library-view.module.css";

export function LibraryView({ sources, cards, initialLang, initialProfile }: { sources: Source[]; cards: ProfileCard[]; initialLang: Lang; initialProfile: string | null }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [leaving, setLeaving] = useState(false);
  const navigationTimer = useRef<number | undefined>(undefined);
  const selectedArt = useRef<HTMLDivElement | null>(null);
  const selectionOrigin = useRef<DOMRect | null>(null);
  const text = t(initialLang);
  const selected = cards.find(card => card.id === profile);
  const source = sources.find(item => item.ready);
  const orderedCards = introCards(cards);

  useEffect(() => () => window.clearTimeout(navigationTimer.current), []);

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

  function selectProfile(id: string, origin: DOMRect) {
    if (id === profile) return;
    selectionOrigin.current = origin;
    setProfile(id);
    const query = new URLSearchParams({ lang: initialLang, profile: id });
    window.history.replaceState(null, "", "/?" + query);
  }

  return <div lang={htmlLang[initialLang]} className={`${styles.surface} ${leaving ? styles.leaving : ""}`}>
    <a className="skip-link" href="#intro-content">{text.skipContent}</a>
    <header className={`${styles.topbar} theatre-darkbar`}>
      <Link href="/" className={styles.brand}>Team daybreak</Link>
    </header>
    <main id="intro-content" tabIndex={-1} className={styles.main}>
      <section className={styles.hero} aria-labelledby="intro-title">
        <h1 id="intro-title"><span>{text.introHeroLead}</span> <em>{text.introHeroLearn}</em></h1>
      </section>
      {selected && <section className={styles.selected} aria-label={text.chooseProfile}>
        <div ref={selectedArt} className={styles.selectedArt}>
          {selected.portrait ? <img src={selected.portrait} alt={selected.name} /> : <ProfileArt profileId={selected.id} label={selected.name} />}
        </div>
        <div className={styles.identity}>
          <h2>{selected.name}</h2>
          {source ? <Link className={styles.start} href={introWatchUrl(source.id, initialLang, selected.id)} onClick={event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (navigationTimer.current !== undefined) { event.preventDefault(); return; }
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            event.preventDefault();
            setLeaving(true);
            navigationTimer.current = window.setTimeout(() => router.push(introWatchUrl(source.id, initialLang, selected.id)), 180);
          }}>{text.introStart}<ArrowUpRight size={24} aria-hidden="true" /></Link> : <p role="status">{text.introNoReady}</p>}
        </div>
      </section>}
      <section className={styles.deckSection} aria-label={text.chooseProfile}>
        <div className={styles.deck}>
          {orderedCards.map(card => <button type="button" key={card.id} className={styles.card} aria-label={card.name} aria-pressed={profile === card.id} disabled={leaving} onClick={event => selectProfile(card.id, event.currentTarget.getBoundingClientRect())}>
            <span className={styles.cardName}>{card.name.trim().split(/\s+/)[0]}</span>
            <span className={styles.cardArt}><ProfileArt profileId={card.id} label={card.name} /></span>
          </button>)}
        </div>
      </section>
    </main>
    <footer className={styles.bottomBar} />
  </div>;
}
