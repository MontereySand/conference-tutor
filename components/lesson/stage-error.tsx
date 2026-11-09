import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import type { StageError } from "./types";
export function StageErrorMessage({error,lang}:{error:StageError;lang:Lang}) {
  const text=t(lang);
  const stages:Record<string,string>={retrieve:text.stageRetrieve,generate:text.stageGenerate,decide:text.stageDecide,check:text.stageCheck,search:text.stageSearch,timing:text.stageTiming,request:text.stageRequest};
  const code=error.code.toLowerCase();
  const detail=/budget|rate|spend/.test(code)?text.budget:/setup|config|prepared|missing/.test(code)?text.setup:/origin|forbidden/.test(code)?text.forbidden:/invalid|validation|malformed/.test(code)?text.invalid:text.unavailable;
  return <div role="alert" className="stage-error"><strong>{stages[error.stage]??text.stageUnknown}</strong><p>{text.error}</p><p>{detail}</p></div>;
}
