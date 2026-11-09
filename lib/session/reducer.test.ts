import { describe, expect, it } from "vitest";
import { createSession, sessionReducer, type LessonRequest } from "./reducer";
import type { AskResult } from "@/components/lesson/types";
const key = {sourceId:"invented",profileId:null,lang:"en" as const,version:0,turnId:"one"};
const result: AskResult = {turnKey:key,lesson:{answer:"An invented explanation.",bridge:null,steps:[],cites:["invented-1"],referenceNotes:[],boundary:null,prediction:null},sources:[],corrections:{depth:"deep",noAnalogy:true},meta:{servedTier:"default",ms:10,costUsd:0}};
const request:LessonRequest = {requestKind:"question",question:"Why?",corrections:result.corrections};
describe("session isolation",()=>{
  it("discards a pending answer after a profile switch and resets corrections",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:"invented-card",lang:"en"});
    expect(sessionReducer(state,{type:"result",result})).toBe(state);
    expect(state.corrections).toEqual({depth:"standard",noAnalogy:false});
    expect(state.history).toEqual([]);
    expect(state.lastRequest).toBeNull();
    expect(state.queuedRequest).toBeNull();
  });
  it("keeps a previous-language answer but rejects old work",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request});
    state=sessionReducer(state,{type:"result",result});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.result).toBe(result);
    expect(state.version).toBe(1);
    expect(state.corrections).toEqual(result.corrections);
    expect(state.queuedRequest).toEqual({...request,requestKind:"regenerate"});
    expect(sessionReducer(state,{type:"result",result})).toBe(state);
  });
  it("drops replaced turns and retains only two completed turns",()=>{
    let state=createSession("invented",null,"en");
    for(let i=0;i<3;i++){
      const turnKey={...key,turnId:String(i)};
      state=sessionReducer(state,{type:"begin",key:turnKey,request:{...request,question:String(i)}});
      state=sessionReducer(state,{type:"result",result:{...result,turnKey}});
    }
    expect(state.history.map(turn=>turn.question)).toEqual(["1","2"]);
    state=sessionReducer(state,{type:"begin",key:{...key,turnId:"new"},request});
    expect(sessionReducer(state,{type:"result",result})).toBe(state);
    state=sessionReducer(state,{type:"switch",sourceId:"another",profileId:null,lang:"en"});
    expect(state.askedAtMs).toBeNull();
    expect(state.result).toBeNull();
    expect(state.lastRequest).toBeNull();
    expect(state.queuedRequest).toBeNull();
  });
  it("keeps an unsupported-question boundary as usable follow-up history",()=>{
    const boundaryResult:AskResult={...result,lesson:{...result.lesson,answer:"",cites:[],boundary:{reason:"The invented source does not report that statistic.",nearbyQuestion:"What does it describe?"}}};
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request:{...request,question:"Which percentage?"}});
    state=sessionReducer(state,{type:"result",result:boundaryResult});
    expect(state.history).toEqual([{question:"Which percentage?",answer:boundaryResult.lesson.boundary!.reason}]);
  });
  it("bookmarks each new question without losing its original playback state",()=>{
    let state=createSession("invented",null,"en");
    state=sessionReducer(state,{type:"bookmark",ms:1200,wasPlaying:true});
    expect(state.askedAtMs).toBe(1200);
    expect(state.wasPlaying).toBe(true);
    state=sessionReducer(state,{type:"bookmark",ms:3200,wasPlaying:false});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.askedAtMs).toBe(3200);
    expect(state.wasPlaying).toBe(false);
  });
  it("queues the very first pending question across repeated locale switches",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"bookmark",ms:687000,wasPlaying:true});
    state=sessionReducer(state,{type:"begin",key,request});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.result).toBeNull();
    expect(state.pending).toBeNull();
    expect(state.queuedRequest).toEqual(request);
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"en"});
    expect(state.queuedRequest).toEqual(request);
    expect(state.askedAtMs).toBe(687000);
    expect(state.wasPlaying).toBe(true);
    expect(sessionReducer(state,{type:"error",key,error:{stage:"request",code:"unavailable"}})).toBe(state);
    const replacementKey={...key,lang:"en" as const,version:state.version,turnId:"replacement"};
    state=sessionReducer(state,{type:"begin",key:replacementKey,request:state.queuedRequest!});
    expect(state.queuedRequest).toBeNull();
    expect(sessionReducer(state,{type:"result",result})).toBe(state);
    state=sessionReducer(state,{type:"result",result:{...result,turnKey:replacementKey}});
    expect(state.result?.turnKey).toEqual(replacementKey);
    expect(state.history).toEqual([{question:"Why?",answer:result.lesson.answer}]);
  });
  it.each(["question","regenerate"] as const)("preserves a pending %s rather than replacing it with the completed question",requestKind=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request});
    state=sessionReducer(state,{type:"result",result});
    const followup:LessonRequest={requestKind,question:"Make this simpler",corrections:{depth:"simple",noAnalogy:false}};
    const nextKey={...key,turnId:"followup"};
    state=sessionReducer(state,{type:"begin",key:nextKey,request:followup});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.queuedRequest).toEqual(followup);
    expect(state.result).toBe(result);
    expect(state.history).toEqual([]);
    expect(sessionReducer(state,{type:"result",result:{...result,turnKey:nextKey}})).toBe(state);
  });
  it("regenerates the completed question with settled corrections, not an unsubmitted draft",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request:{...request,corrections:{depth:"standard",noAnalogy:false}}});
    state=sessionReducer(state,{type:"result",result});
    state=sessionReducer(state,{type:"question",question:"A different unsubmitted question"});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.queuedRequest).toEqual({requestKind:"regenerate",question:"Why?",corrections:result.corrections});
  });
  it.each(["question","regenerate"] as const)("retains failed %s arguments for retry despite draft edits",requestKind=>{
    const failed:LessonRequest={requestKind,question:"Make it simpler",corrections:{depth:"deep",noAnalogy:true}};
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request:failed});
    state=sessionReducer(state,{type:"error",key,error:{stage:"generate",code:"unavailable"}});
    state=sessionReducer(state,{type:"question",question:"An edited draft"});
    expect(state.lastRequest).toEqual(failed);
    state=sessionReducer(state,{type:"begin",key:{...key,turnId:"retry"},request:state.lastRequest!});
    expect(state.question).toBe(failed.question);
    expect(state.corrections).toEqual(failed.corrections);
    expect(state.error).toBeNull();
  });
  it("cancels queued locale work and clears it on source or profile changes",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,request});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(sessionReducer(state,{type:"cancel"}).queuedRequest).toBeNull();
    for(const selection of [{sourceId:"another",profileId:null},{sourceId:"invented",profileId:"card"}]){
      const cleared=sessionReducer(state,{type:"switch",...selection,lang:"es"});
      expect(cleared.queuedRequest).toBeNull();
      expect(cleared.lastRequest).toBeNull();
      expect(cleared.resultQuestion).toBeNull();
      expect(cleared.corrections).toEqual({depth:"standard",noAnalogy:false});
    }
  });
});
