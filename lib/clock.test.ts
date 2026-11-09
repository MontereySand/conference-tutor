import { afterEach, describe, expect, it, vi } from "vitest";
import { activeSentenceAt, confirmedPlayerTime, createPlayerPosition, observePlayerClock } from "./clock";
import type { Sentence } from "./types";
const sentences: Sentence[] = [{id:"a",startMs:100,endMs:200,text:"Invented first sentence.",raw:"",chapter:0,timing:"derived"},{id:"b",startMs:250,endMs:400,text:"Invented second sentence.",raw:"",chapter:0,timing:"derived"},{id:"c",startMs:400,endMs:500,text:"Invented third sentence.",raw:"",chapter:0,timing:"derived"}];
describe("actual-time sentence selection", () => {
  it("uses half-open intervals and leaves gaps empty", () => {
    expect([99,100,199,200,249,250,400,500].map(ms => activeSentenceAt(sentences,ms))).toEqual([-1,0,0,-1,-1,1,2,-1]);
  });
  it("handles arbitrary seeks without a second clock", () => {
    expect([450,150,300,0,NaN].map(ms => activeSentenceAt(sentences,ms))).toEqual([2,0,1,-1,-1]);
    expect(activeSentenceAt([], 100)).toBe(-1);
  });
});

describe("asynchronous seek acknowledgement",()=>{
  it("rejects stale zero until the requested 11:27 position is observed",()=>{
    expect(confirmedPlayerTime(0,687000)).toBeNull();
    expect(confirmedPlayerTime(250,687000)).toBeNull();
    expect(confirmedPlayerTime(687000,687000)).toBe(687000);
  });
  it("returns the observed clock, never the requested target or a lead offset",()=>{
    expect(confirmedPlayerTime(686950,687000)).toBe(686950);
    expect(confirmedPlayerTime(687501,687000)).toBeNull();
    expect(confirmedPlayerTime(100,0)).toBe(100);
    expect(confirmedPlayerTime(0,null)).toBe(0);
  });
  it("rejects a superseded seek acknowledgement and unavailable times",()=>{
    expect(confirmedPlayerTime(687000,539000)).toBeNull();
    expect(confirmedPlayerTime(539000,539000)).toBe(539000);
    for(const ms of [NaN,Infinity,-1])expect(confirmedPlayerTime(ms,null)).toBeNull();
  });
});

describe("seek lifecycle and unavailable-video question context",()=>{
  afterEach(()=>vi.useRealTimers());
  it("gates a live seek until observed time acknowledges it, without substituting its target",()=>{
    vi.useFakeTimers();
    const pending=vi.fn(),settled=vi.fn(),position=createPlayerPosition(0,pending,settled);
    position.observe(0);
    position.select(687000,true);
    position.observe(0);
    expect(pending).toHaveBeenLastCalledWith(true);
    expect(position.getTimeMs()).toBe(0);
    position.observe(686950);
    expect(pending).toHaveBeenLastCalledWith(false);
    expect(settled).toHaveBeenLastCalledWith(true);
    expect(position.getTimeMs()).toBe(686950);
    vi.advanceTimersByTime(5000);
    expect(settled.mock.calls).not.toContainEqual([false]);
    position.dispose();
  });
  it("releases an unacknowledged seek after five seconds and preserves selected context for asking",()=>{
    vi.useFakeTimers();
    const pending=vi.fn(),settled=vi.fn(),position=createPlayerPosition(0,pending,settled);
    position.select(687000,true);
    position.observe(0);
    vi.advanceTimersByTime(4999);
    expect(pending).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(1);
    expect(pending).toHaveBeenLastCalledWith(false);
    expect(settled).toHaveBeenLastCalledWith(false);
    expect(position.getTimeMs()).toBe(687000);
    position.observe(687050);
    expect(settled).toHaveBeenLastCalledWith(true);
    expect(position.getTimeMs()).toBe(687050);
    position.dispose();
  });
  it("keeps not-ready selections and falls back to the last observed moment after a video error",()=>{
    const pending=vi.fn(),position=createPlayerPosition(120000,pending,vi.fn());
    position.select(687000,false);
    expect(pending).toHaveBeenLastCalledWith(false);
    expect(position.getTimeMs()).toBe(687000);
    position.fail();
    expect(position.getTimeMs()).toBe(687000);
    position.observe(687000);
    position.observe(688200);
    position.fail();
    expect(position.getTimeMs()).toBe(688200);
    for(const ms of [NaN,Infinity,-1])position.observe(ms);
    expect(Number.isFinite(position.getTimeMs())).toBe(true);
    position.dispose();
  });
  it("supersedes the old seek deadline and cancels pending timers on unmount",()=>{
    vi.useFakeTimers();
    const pending=vi.fn(),settled=vi.fn(),position=createPlayerPosition(0,pending,settled);
    position.select(687000,true);
    vi.advanceTimersByTime(4000);
    position.select(539000,true);
    position.observe(687000);
    vi.advanceTimersByTime(1000);
    expect(pending).toHaveBeenLastCalledWith(true);
    expect(settled).not.toHaveBeenCalled();
    position.dispose();
    vi.advanceTimersByTime(5000);
    expect(settled).not.toHaveBeenCalled();
  });
});

describe("player clock sampling",()=>{
  afterEach(()=>vi.useRealTimers());
  it("uses observed time through playback, buffering, rate changes and paused seeks",()=>{
    vi.useFakeTimers();
    let seconds=0.1;
    const samples:number[]=[];
    const stop=observePlayerClock(()=>seconds,ms=>samples.push(ms));
    expect(samples).toEqual([100]);
    vi.advanceTimersByTime(1000);
    expect(samples).toEqual([100]);
    seconds=0.25;
    vi.advanceTimersByTime(100);
    seconds=0.4;
    vi.advanceTimersByTime(100);
    seconds=0.15;
    vi.advanceTimersByTime(100);
    expect(samples).toEqual([100,250,400,150]);
    expect(samples.map(ms=>activeSentenceAt(sentences,ms))).toEqual([0,1,2,0]);
    stop();
    seconds=0.45;
    vi.advanceTimersByTime(1000);
    expect(samples).toEqual([100,250,400,150]);
  });
  it("ignores unavailable clock values rather than inventing a timestamp",()=>{
    vi.useFakeTimers();
    let seconds=NaN;
    const onTime=vi.fn();
    const stop=observePlayerClock(()=>seconds,onTime);
    seconds=-1;
    vi.advanceTimersByTime(100);
    seconds=Infinity;
    vi.advanceTimersByTime(100);
    expect(onTime).not.toHaveBeenCalled();
    seconds=0;
    vi.advanceTimersByTime(100);
    expect(onTime).toHaveBeenCalledExactlyOnceWith(0);
    stop();
  });
});
