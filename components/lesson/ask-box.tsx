"use client";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function AskBox({lang,question,pending,inputRef,onChange,onSubmit,onCancel}:{lang:Lang;question:string;pending:boolean;inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(question:string)=>void;onSubmit:()=>void;onCancel:()=>void}) {
 const text=t(lang);
 return <form className="ask-box" onSubmit={event=>{event.preventDefault();onSubmit();}}><label htmlFor="tutor-question">{text.ask}</label><Textarea ref={inputRef} id="tutor-question" maxLength={2000} value={question} placeholder={text.askHint} onChange={event=>onChange(event.target.value)} aria-label={text.question}/><div className="ask-actions"><small>{text.privacy}</small><Button type="submit" disabled={pending||!question.trim()}>{pending?text.pending:text.send}</Button>{pending&&<Button type="button" variant="outline" onClick={onCancel}>{text.cancel}</Button>}</div></form>;
}
