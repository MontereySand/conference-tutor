"use client";
import type { RefObject } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
export function AskBox({lang,question,pending,disabled,inputRef,onChange,onSubmit,onCancel}:{lang:Lang;question:string;pending:boolean;disabled:boolean;inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(question:string)=>void;onSubmit:()=>void;onCancel:()=>void}) {
 const text=t(lang);
 return <form className="ask-box" aria-busy={disabled||pending} onSubmit={event=>{event.preventDefault();if(!disabled&&!pending)onSubmit();}}><TextArea ref={inputRef} label={text.ask} containerClassName="question-field" maxLength={2000} value={question} placeholder={text.askHint} onChange={value=>onChange(value.slice(0,2000))}/>{disabled&&<small role="status">{text.playerLoading}</small>}<div className="ask-actions"><small>{text.privacy}</small><Button type="submit" variant="primary" label={pending?text.pending:text.send} isDisabled={disabled||pending||!question.trim()}/>{pending&&<Button type="button" variant="secondary" label={text.cancel} onClick={onCancel}/>}</div></form>;
}
