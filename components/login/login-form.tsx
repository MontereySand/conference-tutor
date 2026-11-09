"use client";

import { useRef, useState, type FormEvent } from "react";
import { LanguagePicker } from "@/components/profile/language-picker";
import { Button } from "@/components/ui/button";
import { htmlLang, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

type LoginError = "loginRejected" | "loginRate" | "loginUnavailable" | "loginOrigin";

export function LoginForm({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const passcode = useRef<HTMLInputElement>(null);
  const text = t(lang);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !passcode.current) return;
    const code = passcode.current.value;
    passcode.current.value = "";
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/access", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      if (response.ok) {
        window.location.replace("/?lang=" + lang);
        return;
      }
      setError(response.status === 401 ? "loginRejected" : response.status === 429 ? "loginRate" : response.status === 403 ? "loginOrigin" : "loginUnavailable");
    } catch { setError("loginUnavailable"); }
    setPending(false);
    passcode.current?.focus();
  }

  return <main lang={htmlLang[lang]} className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-8 px-6 py-12">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <span className="wordmark">{text.brand}</span>
      <LanguagePicker lang={lang} onChange={value => {
        setLang(value);
        window.history.replaceState(null, "", "/login?lang=" + value);
      }} />
    </header>
    <section className="panel flex flex-col gap-6" aria-labelledby="login-title">
      <div className="flex flex-col gap-4">
        <h1 id="login-title" className="!text-4xl">{text.loginTitle}</h1>
        <p id="login-intro">{text.loginIntro}</p>
      </div>
      <form action="/api/access" method="post" autoComplete="off" onSubmit={submit} aria-describedby="login-intro login-privacy" aria-busy={pending} className="flex flex-col gap-4">
        <label htmlFor="judge-code" className="font-semibold">{text.loginCode}</label>
        <input ref={passcode} id="judge-code" name="code" type="password" required maxLength={256} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={pending} aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} className="min-h-12 w-full rounded-lg border bg-paper px-3 py-2 text-ink" />
        <Button type="submit" disabled={pending} size="lg" className="w-full">{pending ? text.loginPending : text.loginEnter}</Button>
        <p id="login-error" role="alert" className="min-h-6 text-sm">{error ? text[error] : ""}</p>
      </form>
      <small id="login-privacy">{text.loginPrivacy}</small>
    </section>
  </main>;
}
