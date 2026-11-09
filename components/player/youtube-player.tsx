"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t, timestamp } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { observePlayerClock } from "@/lib/clock";
declare global { interface Window { YT: typeof YT; onYouTubeIframeAPIReady?:()=>void } }
let api: Promise<typeof YT> | null = null;
function loadApi(): Promise<typeof YT> {
  if(window.YT?.Player) return Promise.resolve(window.YT);
  if(!api) api=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{previous?.();resolve(window.YT);};
    const script=document.createElement("script"); script.src="https://www.youtube.com/iframe_api";
    script.onerror=()=>{api=null;reject(new Error("player"));}; document.head.appendChild(script);
  });
  return api;
}
export type PlayerHandle={getTimeMs:()=>number;seekTo:(ms:number)=>void;play:()=>void;pause:()=>void;state:()=>number;rate:()=>number};
export const YouTubePlayer=forwardRef<PlayerHandle,{videoId:string;initialMs:number;lang:Lang;onTime:(ms:number)=>void}>(function YouTubePlayer({videoId,initialMs,lang,onTime},ref){
  const host=useRef<HTMLDivElement>(null), player=useRef<YT.Player|null>(null), time=useRef(initialMs), onTimeRef=useRef(onTime), readyRef=useRef(false);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[state,setState]=useState(-1),[rate,setRate]=useState(1),[rates,setRates]=useState([1,1.5,2]),[current,setCurrent]=useState(initialMs);
  useEffect(()=>{onTimeRef.current=onTime;},[onTime]);
  useEffect(()=>{if(ready&&player.current)player.current.getIframe().title=t(lang).player;},[lang,ready]);
  useImperativeHandle(ref,()=>({getTimeMs:()=>readyRef.current ? player.current!.getCurrentTime()*1000 : time.current,seekTo:ms=>{if(readyRef.current)player.current!.seekTo(ms/1000,true);else{time.current=ms;setCurrent(ms);onTimeRef.current(ms);}},play:()=>{if(readyRef.current) player.current!.playVideo();},pause:()=>{if(readyRef.current) player.current!.pauseVideo();},state:()=>readyRef.current?player.current!.getPlayerState():-1,rate:()=>readyRef.current?player.current!.getPlaybackRate():1}),[]);
  useEffect(()=>{
    let disposed=false, stopClock:(()=>void)|undefined;
    loadApi().then(YT=>{
      if(disposed||!host.current)return;
      const node=document.createElement("div");host.current.appendChild(node);
      player.current=new YT.Player(node,{videoId,host:"https://www.youtube-nocookie.com",width:"100%",height:"100%",playerVars:{autoplay:0,playsinline:1,rel:0,cc_load_policy:0,origin:window.location.origin},events:{
        onReady:event=>{if(disposed)return;readyRef.current=true;setReady(true);event.target.seekTo(time.current/1000,true);event.target.pauseVideo();setRates(event.target.getAvailablePlaybackRates());stopClock?.();stopClock=observePlayerClock(()=>event.target.getCurrentTime(),ms=>{time.current=ms;setCurrent(ms);onTimeRef.current(ms);});},
        onStateChange:event=>{if(!disposed)setState(event.data);},
        onPlaybackRateChange:event=>{if(!disposed)setRate(event.data);},onError:()=>{if(disposed)return;stopClock?.();readyRef.current=false;setReady(false);setFailed(true);}
      }});
    }).catch(()=>{if(!disposed)setFailed(true);});
    return ()=>{disposed=true;stopClock?.();readyRef.current=false;player.current?.destroy();player.current=null;};
  },[videoId]);
  const text=t(lang);
  return <section aria-label={text.player} className="player-block"><div className="video-shell"><div ref={host} className="video-host"/>{!ready&&!failed&&<p className="player-message" role="status">{text.playerLoading}</p>}</div>{failed&&<p role="alert">{text.playerError}</p>}<div className="player-controls"><Button variant="outline" disabled={!ready} onClick={()=>{if(state===1)player.current?.pauseVideo();else player.current?.playVideo();}}>{state===1?text.pause:text.play}</Button><span className="time-readout">{timestamp(current)}</span><Select value={String(rate)} onValueChange={value=>{if(value&&ready)player.current?.setPlaybackRate(Number(value));}}><SelectTrigger aria-label={text.playbackRate} disabled={!ready}><SelectValue>{rate}×</SelectValue></SelectTrigger><SelectContent>{rates.map(value=><SelectItem value={String(value)} key={value}>{value}×</SelectItem>)}</SelectContent></Select></div></section>;
});
