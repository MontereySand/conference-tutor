import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { z } from "zod";
import { getSource, getTranscript, preparedPath } from "@/lib/data";
import { HttpError, apiError, requireSameOrigin, parseJson } from "@/lib/http";
export const runtime="nodejs";
const Mark=z.object({sourceId:z.string().min(1).max(100),sentenceId:z.string().min(1).max(200),startMs:z.number().int().nonnegative()}).strict();
let writing:Promise<unknown>=Promise.resolve();
export async function POST(request:Request){
 if(process.env.NODE_ENV!=="development")return new Response(null,{status:404});
 try{
  requireSameOrigin(request);
  const input=await parseJson(request,Mark,4096);
  const operation=writing.catch(()=>{}).then(async()=>{
   const source=getSource(input.sourceId);if(!source?.ready)throw new HttpError(400,"invalid");
   const transcript=getTranscript(source.id,"en");if(!transcript)throw new HttpError(400,"invalid");
   const index=transcript.sentences.findIndex(sentence=>sentence.id===input.sentenceId),sentence=transcript.sentences[index];
   if(!sentence||input.startMs>=sentence.endMs||input.startMs>=transcript.durationMs||(index>0&&input.startMs<=transcript.sentences[index-1]!.startMs))throw new HttpError(400,"invalid");
   const path=preparedPath("transcripts/"+source.id+".review.json");
   let starts:Record<string,number>={};
   try{starts=z.object({starts:z.record(z.string(),z.number().int().nonnegative())}).parse(JSON.parse(await readFile(path,"utf8"))).starts;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
   starts[input.sentenceId]=input.startMs;
   const temp=path+"."+randomUUID()+".tmp";
   try{await writeFile(temp,JSON.stringify({starts},null,2)+"\n",{mode:0o600,flag:"wx"});await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}
   return Response.json({ok:true});
  });
  writing=operation;return await operation;
 }catch(error){return apiError(error,"timing");}
}
