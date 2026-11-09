import { describe, expect, it } from "vitest";
import { activeSentenceAt } from "./clock";
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
