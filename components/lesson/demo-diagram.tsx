import { Button } from "@astryxdesign/core/Button";
import { ArrowDown } from "lucide-react";
import { timestamp } from "@/lib/i18n";
import type { Lang, PreparedDemo, ProfileCard } from "@/lib/types";
import styles from "./teaching.module.css";

const copy = {
  en: { prepared: "Prepared diagram", source: "Talk source" },
  es: { prepared: "Diagrama preparado", source: "Fuente de la charla" },
} satisfies Record<Lang, { prepared: string; source: string }>;

export function DemoDiagram({demo,lang,visible,card,noAnalogy,onSeek}:{demo:PreparedDemo;lang:Lang;visible:boolean;card:ProfileCard|undefined;noAnalogy:boolean;onSeek:(ms:number)=>void}) {
  const text=copy[lang], bridge=demo.bridge;
  const showBridge=bridge&&!noAnalogy&&card?.anchors.some(anchor=>anchor.tags.includes(bridge.tag));
  return <div className={styles.diagramTransition} data-visible={visible} aria-hidden={!visible} inert={!visible}>
    <div className={styles.diagramInner}>
      <section className={styles.diagram} aria-label={`${text.prepared} · ${demo.title[lang]}`}>
        <header className={styles.diagramHeader}>
          <h2>{text.prepared} · {demo.title[lang]}</h2>
          <div className={styles.actions}>{demo.sources.map(source=><Button variant="ghost" size="sm" key={source.chunkId} onClick={()=>onSeek(source.startMs)} label={`${text.source}: ${source.chunkId} ${timestamp(source.startMs)}`}><span>{timestamp(source.startMs)}</span></Button>)}</div>
        </header>
        <div className={styles.diagramBody}>
          <ol className={styles.diagramSteps}>
            {demo.steps[lang].map((step,index)=><li key={index}>
              {index>0&&<ArrowDown size={16} aria-hidden="true"/>}
              <span>{step}</span>
            </li>)}
          </ol>
          <div className={styles.preparedExplanation}>
            <p>{demo.explanation[lang]}</p>
            {showBridge&&bridge&&<><p>{bridge.text[lang]}</p><small>{bridge.limit[lang]}</small></>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}
