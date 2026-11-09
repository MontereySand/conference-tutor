"use client";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import type { Lang, ProfileCard } from "@/lib/types";
import { htmlLang, t } from "@/lib/i18n";

export function ProfilePicker({cards,profileId,lang,onChange}:{cards:ProfileCard[];profileId:string|null;lang:Lang;onChange:(id:string|null)=>void}) {
  const [open,setOpen]=useState(false), [details,setDetails]=useState(false);
  const text=t(lang), card=cards.find(card=>card.id===profileId);
  const categories={"LinkedIn":text.sourceLinkedIn,"Public web":text.sourcePublic,"Event report":text.sourceReport,"Event page":text.sourceEvent};

  return <div className="profile-controls">
    <Button variant="secondary" label={`${text.tunedFor}: ${card?.name??text.general}`} aria-haspopup="dialog" onClick={()=>{setDetails(false);setOpen(true);}}/>
    <Button variant="ghost" label={text.whatUsed} aria-haspopup="dialog" onClick={()=>{setDetails(true);setOpen(true);}}/>
    <Dialog isOpen={open} onOpenChange={setOpen} className="profile-dialog" width="56rem" maxHeight="85dvh">
      <div lang={htmlLang[lang]}>
        <DialogHeader className="profile-dialog-header" title={details?text.whatUsed:text.chooseProfile} subtitle={text.profileNote}/>
        {details
          ? <section className="profile-details">
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
              <Button className="profile-option" width="100%" variant={profileId===null?"primary":"secondary"} label={`${text.general}: ${text.generalProfileNote}`} aria-pressed={profileId===null} onClick={()=>{onChange(null);setOpen(false);}}>
                <strong>{text.general}</strong><span>{text.generalProfileNote}</span>
              </Button>
              {cards.map(item=><Button className="profile-option" width="100%" key={item.id} variant={item.id===profileId?"primary":"secondary"} label={`${item.name}: ${item.role}`} aria-pressed={item.id===profileId} onClick={()=>{onChange(item.id);setOpen(false);}}>
                <strong>{item.name}</strong><span>{item.role}</span>
              </Button>)}
            </div>}
        <div className="profile-dialog-footer">
          <Button variant="secondary" label={text.close} onClick={()=>setOpen(false)}/>
        </div>
      </div>
    </Dialog>
  </div>;
}
