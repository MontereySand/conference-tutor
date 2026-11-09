import type { AskRequestKind, Corrections, HistoryTurn, Lang, TurnKey } from "@/lib/types";
import type { AskResult, StageError } from "@/components/lesson/types";
export const defaultCorrections: Corrections = { depth: "standard", noAnalogy: false };
export type LessonRequest = { requestKind: AskRequestKind; question: string; corrections: Corrections };
export type Session = { sourceId: string; profileId: string | null; lang: Lang; version: number; question: string; corrections: Corrections; history: HistoryTurn[]; pending: TurnKey | null; lastRequest: LessonRequest | null; queuedRequest: LessonRequest | null; result: AskResult | null; resultQuestion: string | null; error: StageError | null; askedAtMs: number | null; wasPlaying: boolean };
export function createSession(sourceId: string, profileId: string | null, lang: Lang): Session { return {sourceId,profileId,lang,version:0,question:"",corrections:{...defaultCorrections},history:[],pending:null,lastRequest:null,queuedRequest:null,result:null,resultQuestion:null,error:null,askedAtMs:null,wasPlaying:false}; }
export function sameTurn(a: TurnKey, b: TurnKey): boolean { return a.sourceId === b.sourceId && a.profileId === b.profileId && a.lang === b.lang && a.version === b.version && a.turnId === b.turnId; }
export type SessionAction =
  | {type:"switch";sourceId:string;profileId:string|null;lang:Lang}
  | {type:"question";question:string}
  | {type:"bookmark";ms:number;wasPlaying:boolean}
  | {type:"begin";key:TurnKey;request:LessonRequest}
  | {type:"result";result:AskResult}
  | {type:"error";key:TurnKey;error:StageError}
  | {type:"cancel"};
export function sessionReducer(state: Session, action: SessionAction): Session {
  switch (action.type) {
    case "switch": {
      const sourceChanged = state.sourceId !== action.sourceId;
      const profileChanged = state.profileId !== action.profileId;
      if (!sourceChanged && !profileChanged && state.lang === action.lang) return state;
      if (sourceChanged || profileChanged) return {...createSession(action.sourceId,action.profileId,action.lang),question:sourceChanged?"":state.question,version:state.version+1};
      const queuedRequest = state.queuedRequest ?? (state.pending || state.error ? state.lastRequest
        : state.result && state.resultQuestion ? {requestKind:"regenerate" as const,question:state.resultQuestion,corrections:state.corrections} : null);
      return {...state,lang:action.lang,version:state.version+1,pending:null,queuedRequest,error:null,history:[]};
    }
    case "question": return {...state,question:action.question};
    case "bookmark": return {...state,askedAtMs:action.ms,wasPlaying:action.wasPlaying};
    case "begin": return {...state,pending:action.key,lastRequest:action.request,queuedRequest:null,error:null,corrections:action.request.corrections};
    case "result": {
      if (!state.pending || !state.lastRequest || !sameTurn(state.pending,action.result.turnKey)) return state;
      const question = state.lastRequest.question;
      const answer = (action.result.lesson.answer || action.result.lesson.boundary?.reason || "").slice(0,2000);
      const history = answer ? [...state.history,{question:question.slice(0,2000),answer}].slice(-2) : state.history;
      return {...state,pending:null,result:action.result,resultQuestion:question,error:null,corrections:action.result.corrections,history};
    }
    case "error": return state.pending && sameTurn(state.pending,action.key) ? {...state,pending:null,error:action.error} : state;
    case "cancel": return {...state,pending:null,queuedRequest:null};
  }
}
