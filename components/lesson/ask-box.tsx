"use client";
import type { RefObject } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import styles from "./teaching.module.css";
export function AskBox({lang,question,pending,disabled,inputRef,onChange,onSubmit,onCancel}:{lang:Lang;question:string;pending:boolean;disabled:boolean;inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(question:string)=>void;onSubmit:()=>void;onCancel:()=>void}) {
 const text=t(lang);
 return <form className={styles.dump} aria-label={text.dumpTitle} aria-busy={pending} onSubmit={event=>{event.preventDefault();if(!disabled&&!pending&&question.trim())onSubmit();}}>
   <header className={styles.header}><h2>{text.dumpTitle}</h2></header>
   <p className={styles.hint}>{text.dumpInstructions}</p>
   <TextArea ref={inputRef} label={text.question} containerClassName={styles.dumpField} rows={2} maxLength={2000} value={question} placeholder={text.dumpPlaceholder} onChange={value=>onChange(value.slice(0,2000))}/>
   {disabled&&<small role="status">{text.playerLoading}</small>}
   {pending&&<small role="status">{text.pending}</small>}
   <div className={styles.actions}>
     <Button type="submit" variant="secondary" label={text.send} isDisabled={disabled||pending||!question.trim()}/>
     {pending&&<Button type="button" variant="secondary" label={text.cancel} onClick={onCancel}/>}
   </div>
 </form>;
}
