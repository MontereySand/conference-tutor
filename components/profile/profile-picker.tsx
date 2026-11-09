"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose } from "@/components/ui/dialog";
import type { Lang, ProfileCard } from "@/lib/types";
import { t } from "@/lib/i18n";
export function ProfilePicker({cards,profileId,lang,onChange}:{cards:ProfileCard[];profileId:string|null;lang:Lang;onChange:(id:string|null)=>void}) {
  const [open,setOpen]=useState(false), [details,setDetails]=useState(false);
  const text=t(lang), card=cards.find(card=>card.id===profileId);
  const categories={"LinkedIn":text.sourceLinkedIn,"Public web":text.sourcePublic,"Event report":text.sourceReport,"Event page":text.sourceEvent};
  return <div className="profile-controls"><Button variant="outline" onClick={()=>{setDetails(false);setOpen(true);}}>{text.tunedFor}: {card?.name??text.general}</Button><Button variant="ghost" onClick={()=>{setDetails(true);setOpen(true);}}>{text.whatUsed}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent showCloseButton={false} className="profile-dialog"><DialogTitle>{details?text.whatUsed:text.chooseProfile}</DialogTitle><DialogDescription>{text.profileNote}</DialogDescription>
    {details ? <div>{card ? <><h3>{card.name}</h3><p>{card.role}</p><ul className="anchor-list">{card.anchors.map(anchor=><li key={anchor.id}><p>{anchor.text}</p><small>{categories[anchor.source]}</small></li>)}</ul></> : <p>{text.general}</p>}</div> : <div className="profile-grid"><Button variant={profileId===null?"default":"outline"} onClick={()=>{onChange(null);setOpen(false);}}>{text.general}</Button>{cards.map(item=><Button className="profile-option" key={item.id} variant={item.id===profileId?"default":"outline"} onClick={()=>{onChange(item.id);setOpen(false);}}><strong>{item.name}</strong><span>{item.role}</span></Button>)}</div>}
    <DialogClose render={<Button variant="outline"/>}>{text.close}</DialogClose></DialogContent></Dialog>
  </div>;
}
