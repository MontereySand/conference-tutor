"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import type { Lang, ProfileCard } from "@/lib/types";
import { htmlLang, t } from "@/lib/i18n";

export function ProfilePicker({cards,profileId,lang,onChange}:{cards:ProfileCard[];profileId:string|null;lang:Lang;onChange:(id:string|null)=>void}) {
  const [open,setOpen]=useState(false), [details,setDetails]=useState(false);
  const text=t(lang), card=cards.find(card=>card.id===profileId);
  const categories={"LinkedIn":text.sourceLinkedIn,"Public web":text.sourcePublic,"Event report":text.sourceReport,"Event page":text.sourceEvent};

  return <div className="profile-controls">
    <Button variant="outline" aria-haspopup="dialog" onClick={()=>{setDetails(false);setOpen(true);}}>
      {text.tunedFor}: <strong>{card?.name??text.general}</strong>
    </Button>
    <Button variant="ghost" aria-haspopup="dialog" onClick={()=>{setDetails(true);setOpen(true);}}>{text.whatUsed}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="profile-dialog" lang={htmlLang[lang]}>
        <DialogHeader>
          <DialogTitle>{details?text.whatUsed:text.chooseProfile}</DialogTitle>
          <DialogDescription>{text.profileNote}</DialogDescription>
        </DialogHeader>
        {details
          ? <section>
              <h3>{card?.name??text.general}</h3>
              {card
                ? <><p>{card.role}</p><ul className="anchor-list">
                    {card.anchors.map(anchor=><li key={anchor.id}>
                      <p>{anchor.text}</p><small>{categories[anchor.source]}</small>
                    </li>)}
                  </ul></>
                : <p>{text.generalProfileNote}</p>}
            </section>
          : <div className="profile-grid" role="group" aria-label={text.chooseProfile}>
              <Button className="profile-option" variant={profileId===null?"default":"outline"} aria-pressed={profileId===null} onClick={()=>{onChange(null);setOpen(false);}}>
                <strong>{text.general}</strong><span>{text.generalProfileNote}</span>
              </Button>
              {cards.map(item=><Button className="profile-option" key={item.id} variant={item.id===profileId?"default":"outline"} aria-pressed={item.id===profileId} onClick={()=>{onChange(item.id);setOpen(false);}}>
                <strong>{item.name}</strong><span>{item.role}</span>
              </Button>)}
            </div>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline"/>}>{text.close}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
