"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LanguagePicker } from "@/components/profile/language-picker";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { htmlLang, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

type LoginError = "loginRejected" | "loginRate" | "loginUnavailable" | "loginOrigin";

export function LoginForm({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [code, setCode] = useState("");
  const passcode = useRef<HTMLInputElement>(null);
  const text = t(lang);
  useEffect(() => { if (error && !pending) passcode.current?.focus(); }, [error, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !code) return;
    const submittedCode = code;
    setCode("");
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/access", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: submittedCode }),
      });
      if (response.ok) {
        window.location.replace("/?lang=" + lang);
        return;
      }
      setError(response.status === 401 ? "loginRejected" : response.status === 429 ? "loginRate" : response.status === 403 ? "loginOrigin" : "loginUnavailable");
    } catch { setError("loginUnavailable"); }
    setPending(false);
  }

  return <main lang={htmlLang[lang]} className="login-screen mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-8 px-6 py-12">
    <header className="login-header flex flex-wrap items-center justify-between gap-4">
      <span className="wordmark">{text.brand}</span>
      <LanguagePicker lang={lang} onChange={value => {
        setLang(value);
        window.history.replaceState(null, "", "/login?lang=" + value);
      }} />
    </header>
    <section className="login-panel panel flex flex-col gap-6" aria-labelledby="login-title">
      <div className="flex flex-col gap-4">
        <h1 id="login-title" className="!text-4xl">{text.loginTitle}</h1>
        <p id="login-intro">{text.loginIntro}</p>
      </div>
      <form action="/api/access" method="post" autoComplete="off" onSubmit={submit} aria-describedby="login-intro login-privacy" aria-busy={pending} className="login-form flex flex-col gap-4">
        <TextInput ref={passcode} id="judge-code" htmlName="code" type="password" label={text.loginCode} value={code} onChange={value=>setCode(value.slice(0,256))} isRequired autoComplete="off" autoCapitalize="none" hasAutoCorrect={false} hasSpellCheck={false} isDisabled={pending} status={error?{type:"error"}:undefined} aria-describedby={error?"login-error":undefined} containerClassName="login-field" width="100%"/>
        <Button type="submit" variant="primary" label={pending?text.loginPending:text.loginEnter} isDisabled={!pending&&!code} isLoading={pending} size="lg" width="100%"/>
        <p id="login-error" role="alert" className="login-error min-h-6 text-sm">{error ? text[error] : ""}</p>
      </form>
      <small id="login-privacy">{text.loginPrivacy}</small>
    </section>
  </main>;
}
