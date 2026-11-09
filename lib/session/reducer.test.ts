import { describe, expect, it } from "vitest";
import { createSession, sessionReducer } from "./reducer";
import type { AskResult } from "@/components/lesson/types";
const key = {sourceId:"invented",profileId:null,lang:"en" as const,version:0,turnId:"one"};
const result: AskResult = {turnKey:key,lesson:{answer:"An invented explanation.",bridge:null,steps:[],cites:["invented-1"],referenceNotes:[],boundary:null,prediction:null},sources:[],corrections:{depth:"deep",noAnalogy:true},meta:{servedTier:"default",ms:10,costUsd:0}};
describe("session isolation",()=>{
  it("discards a pending answer after a profile switch and resets corrections",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,corrections:{depth:"deep",noAnalogy:true}});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:"invented-card",lang:"en"});
    expect(sessionReducer(state,{type:"result",result,question:"Why?"})).toBe(state);
    expect(state.corrections).toEqual({depth:"standard",noAnalogy:false});
    expect(state.history).toEqual([]);
  });
  it("keeps a previous-language answer but rejects old work",()=>{
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,corrections:result.corrections});
    state=sessionReducer(state,{type:"result",result,question:"Why?"});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"es"});
    expect(state.result).toBe(result);
    expect(state.version).toBe(1);
    expect(state.corrections).toEqual(result.corrections);
    expect(sessionReducer(state,{type:"result",result,question:"stale"})).toBe(state);
  });
  it("drops replaced turns and retains only two completed turns",()=>{
    let state=createSession("invented",null,"en");
    for(let i=0;i<3;i++){
      const turnKey={...key,turnId:String(i)};
      state=sessionReducer(state,{type:"begin",key:turnKey,corrections:result.corrections});
      state=sessionReducer(state,{type:"result",result:{...result,turnKey},question:String(i)});
    }
    expect(state.history.map(turn=>turn.question)).toEqual(["1","2"]);
    state=sessionReducer(state,{type:"begin",key:{...key,turnId:"new"},corrections:result.corrections});
    expect(sessionReducer(state,{type:"result",result,question:"old"})).toBe(state);
    state=sessionReducer(state,{type:"switch",sourceId:"another",profileId:null,lang:"en"});
    expect(state.askedAtMs).toBeNull();
    expect(state.result).toBeNull();
  });
  it("keeps an unsupported-question boundary as usable follow-up history",()=>{
    const boundaryResult:AskResult={...result,lesson:{...result.lesson,answer:"",cites:[],boundary:{reason:"The invented source does not report that statistic.",nearbyQuestion:"What does it describe?"}}};
    let state=sessionReducer(createSession("invented",null,"en"),{type:"begin",key,corrections:result.corrections});
    state=sessionReducer(state,{type:"result",result:boundaryResult,question:"Which percentage?"});
    expect(state.history).toEqual([{question:"Which percentage?",answer:boundaryResult.lesson.boundary!.reason}]);
  });
  it("bookmarks each new question without losing its original playback state",()=>{
    let state=createSession("invented",null,"en");
    state=sessionReducer(state,{type:"bookmark",ms:1200,wasPlaying:true});
    expect(state.askedAtMs).toBe(1200);
    expect(state.wasPlaying).toBe(true);
    state=sessionReducer(state,{type:"bookmark",ms:3200,wasPlaying:false});
    state=sessionReducer(state,{type:"switch",sourceId:"invented",profileId:null,lang:"hi"});
    expect(state.askedAtMs).toBe(3200);
    expect(state.wasPlaying).toBe(false);
  });
});
