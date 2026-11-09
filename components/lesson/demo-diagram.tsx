import { Button } from "@astryxdesign/core/Button";
import { ArrowDown } from "lucide-react";
import { demoScenario } from "@/lib/demo-scenario";
import { timestamp } from "@/lib/i18n";
import type { Lang, ProfileCard } from "@/lib/types";
import styles from "./teaching.module.css";

const copy = {
  en: {
    title: "Prepared diagram · Contextual policy",
    steps: ["Agent reads a confidential document", "Earlier action becomes policy context", "Policy may restrict email outside the company"],
    source: "Talk source",
  },
  es: {
    title: "Diagrama preparado · Política contextual",
    steps: ["El agente lee un documento confidencial", "La acción anterior pasa a ser contexto de la política", "La política puede restringir los correos fuera de la empresa"],
    source: "Fuente de la charla",
  },
} satisfies Record<Lang, { title: string; steps: string[]; source: string }>;

export function DemoDiagram({lang,visible,card,noAnalogy,onSeek}:{lang:Lang;visible:boolean;card:ProfileCard|undefined;noAnalogy:boolean;onSeek:(ms:number)=>void}) {
  const text=copy[lang], citation=demoScenario.citations[1];
  const showBridge=!noAnalogy&&card?.anchors.some(anchor=>anchor.tags.includes("observability"));
  return <div className={styles.diagramTransition} data-visible={visible} aria-hidden={!visible} inert={!visible}>
    <div className={styles.diagramInner}>
      <section className={styles.diagram} aria-label={text.title}>
        <header className={styles.diagramHeader}><h2>{text.title}</h2><Button variant="ghost" size="sm" onClick={()=>onSeek(citation.startMs)} label={`${text.source}: ${timestamp(citation.startMs)}`}/></header>
        <div className={styles.diagramBody}>
          <ol className={styles.diagramSteps}>
            {text.steps.map((step,index)=><li key={step}>
              {index>0&&<ArrowDown size={16} aria-hidden="true"/>}
              <span>{step}</span>
            </li>)}
          </ol>
          <div className={styles.preparedExplanation}>
            <p>{demoScenario.explanation[lang]}</p>
            {showBridge&&<><p>{demoScenario.observabilityBridge[lang]}</p><small>{demoScenario.bridgeLimit[lang]}</small></>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}
