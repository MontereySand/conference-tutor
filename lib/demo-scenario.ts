import type { Lang } from "@/lib/types";

type DemoScenario = {
  sourceId: string;
  startMs: number;
  endMs: number;
  question: Record<Lang, string>;
  explanation: Record<Lang, string>;
  observabilityBridge: Record<Lang, string>;
  bridgeLimit: Record<Lang, string>;
  citations: readonly { chunkId: string; startMs: number; endMs: number }[];
};

export const demoScenario: DemoScenario = {
  sourceId: "omnigent",
  startMs: 687000,
  endMs: 706000,
  question: {
    en: "Why can a policy block email after an agent reads a confidential document?",
    es: "¿Por qué una política puede bloquear el envío de correos después de que un agente lea un documento confidencial?",
  },
  explanation: {
    en: "Permissions depend on what the agent has already done—not just which tool it wants to call. After it reads a confidential document, a policy may block email outside the company. Reading only public marketing material can lead to a different decision.",
    es: "Los permisos dependen de lo que el agente ya ha hecho, no solo de la herramienta que quiere usar. Tras leer un documento confidencial, una política puede bloquear los correos fuera de la empresa. Leer solo material público de marketing puede llevar a una decisión distinta.",
  },
  observabilityBridge: {
    en: "For you, think of the state tracked by a cluster-monitoring system: a new event changes what the system knows. Here, that accumulated state helps decide what the agent may do next.",
    es: "Piensa en el estado que registra un sistema de monitoreo de clústeres: un evento nuevo cambia lo que sabe el sistema. Aquí, ese estado acumulado ayuda a decidir qué puede hacer el agente después.",
  },
  bridgeLimit: {
    en: "Monitoring observes state; this policy uses it to enforce permissions.",
    es: "El monitoreo observa el estado; esta política lo usa para aplicar permisos.",
  },
  citations: [
    { chunkId: "omnigent-c032", startMs: 664050, endMs: 692490 },
    { chunkId: "omnigent-c033", startMs: 687090, endMs: 711430 },
  ],
};
