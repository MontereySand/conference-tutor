import type { Corrections, HistoryTurn, Lang, TurnKey } from "@/lib/types";
import type { AskResult, StageError } from "@/components/lesson/types";
export const defaultCorrections: Corrections = { depth: "standard", noAnalogy: false };
export type Session = { sourceId: string; profileId: string | null; lang: Lang; version: number; question: string; corrections: Corrections; history: HistoryTurn[]; pending: TurnKey | null; result: AskResult | null; error: StageError | null; askedAtMs: number | null; wasPlaying: boolean };
export function createSession(sourceId: string, profileId: string | null, lang: Lang): Session { return {sourceId,profileId,lang,version:0,question:"",corrections:{...defaultCorrections},history:[],pending:null,result:null,error:null,askedAtMs:null,wasPlaying:false}; }
export function sameTurn(a: TurnKey, b: TurnKey): boolean { return a.sourceId === b.sourceId && a.profileId === b.profileId && a.lang === b.lang && a.version === b.version && a.turnId === b.turnId; }
export type SessionAction =
  | {type:"switch";sourceId:string;profileId:string|null;lang:Lang}
  | {type:"question";question:string}
  | {type:"bookmark";ms:number;wasPlaying:boolean}
  | {type:"begin";key:TurnKey;corrections:Corrections}
  | {type:"result";result:AskResult;question:string}
  | {type:"error";key:TurnKey;error:StageError}
  | {type:"cancel"};
export function sessionReducer(state: Session, action: SessionAction): Session {
  switch (action.type) {
    case "switch": {
      const sourceChanged = state.sourceId !== action.sourceId;
      const profileChanged = state.profileId !== action.profileId;
      if (!sourceChanged && !profileChanged && state.lang === action.lang) return state;
      if (sourceChanged || profileChanged) return {...createSession(action.sourceId,action.profileId,action.lang),version:state.version+1};
      return {...state,lang:action.lang,version:state.version+1,pending:null,error:null,history:[]};
    }
    case "question": return {...state,question:action.question};
    case "bookmark": return {...state,askedAtMs:action.ms,wasPlaying:action.wasPlaying};
    case "begin": return {...state,pending:action.key,error:null,corrections:action.corrections};
    case "result":
      if (!state.pending || !sameTurn(state.pending,action.result.turnKey)) return state;
      return {...state,pending:null,result:action.result,error:null,corrections:action.result.corrections,history:[...state.history,{question:action.question.slice(0,2000),answer:action.result.lesson.answer.slice(0,2000)}].slice(-2)};
    case "error": return state.pending && sameTurn(state.pending,action.key) ? {...state,pending:null,error:action.error} : state;
    case "cancel": return {...state,pending:null};
  }
}
