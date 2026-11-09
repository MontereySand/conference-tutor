import { afterEach, describe, expect, it, vi } from "vitest";
import { activeSentenceAt, observePlayerClock } from "./clock";
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
