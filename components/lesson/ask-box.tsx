"use client";
import type { RefObject } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Send, Square } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import styles from "./teaching.module.css";
export function AskBox({lang,question,pending,disabled,inputRef,onChange,onSubmit,onCancel}:{lang:Lang;question:string;pending:boolean;disabled:boolean;inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(question:string)=>void;onSubmit:()=>void;onCancel:()=>void}) {
 const text=t(lang);
 return <form className={styles.dump} aria-label={text.dumpTitle} aria-busy={pending} onSubmit={event=>{event.preventDefault();if(!disabled&&!pending&&question.trim())onSubmit();}}>
   <TextArea ref={inputRef} label={text.question} isLabelHidden containerClassName={styles.dumpField} controlClassName={styles.dumpControl} rows={3} value={question} placeholder={text.dumpPlaceholder} onChange={value=>onChange(value.slice(0,2000))}/>
   <div className={styles.send}>
     {pending
       ? <Button type="button" variant="secondary" isIconOnly icon={<Square size={16} aria-hidden="true"/>} label={text.cancel} onClick={onCancel}/>
       : <Button type="submit" variant="secondary" isIconOnly icon={<Send size={16} aria-hidden="true"/>} label={text.dumpSend} isDisabled={disabled||!question.trim()}/>}
   </div>
   {disabled&&<span className={styles.srOnly} role="status">{text.playerLoading}</span>}
   {pending&&<span className={styles.srOnly} role="status">{text.pending}</span>}
 </form>;
}
