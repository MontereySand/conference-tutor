"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { Slider } from "@astryxdesign/core/Slider";
import { t, timestamp } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { createPlayerPosition, observePlayerClock, type PlayerPosition } from "@/lib/clock";
import styles from "./youtube-player.module.css";
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
export const YouTubePlayer=forwardRef<PlayerHandle,{videoId:string;initialMs:number;durationMs:number;lang:Lang;autoplay:boolean;controlsTarget:HTMLElement|null;onTime:(ms:number)=>void;onSeekPending:(pending:boolean)=>void}>(function YouTubePlayer({videoId,initialMs,durationMs,lang,autoplay,controlsTarget,onTime,onSeekPending},ref){
  const host=useRef<HTMLDivElement>(null), player=useRef<YT.Player|null>(null), position=useRef<PlayerPosition|null>(null), onTimeRef=useRef(onTime), onSeekPendingRef=useRef(onSeekPending), readyRef=useRef(false), autoplayRef=useRef(autoplay);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[state,setState]=useState(-1),[rate,setRate]=useState(1),[rates,setRates]=useState([1,1.5,2]),[current,setCurrent]=useState(initialMs),[duration,setDuration]=useState(durationMs),[volume,setVolume]=useState(100),[muted,setMuted]=useState(false);
  if(!position.current)position.current=createPlayerPosition(initialMs,pending=>onSeekPendingRef.current(pending),acknowledged=>setFailed(!acknowledged));
  useEffect(()=>{onTimeRef.current=onTime;onSeekPendingRef.current=onSeekPending;},[onTime,onSeekPending]);
  useEffect(()=>{if(ready&&player.current)player.current.getIframe().title=t(lang).player;},[lang,ready]);
  const sample=useCallback((ms:number)=>{
    if(!Number.isFinite(ms)||ms<0)return;
    position.current!.observe(ms);setCurrent(ms);onTimeRef.current(ms);
  },[]);
  const seekTo=useCallback((ms:number)=>{
    position.current!.select(ms,readyRef.current);
    if(readyRef.current){setFailed(false);player.current!.seekTo(ms/1000,true);sample(player.current!.getCurrentTime()*1000);}
  },[sample]);
  useImperativeHandle(ref,()=>({
    getTimeMs:()=>{if(readyRef.current)position.current!.observe(player.current!.getCurrentTime()*1000);return position.current!.getTimeMs();},
    seekTo,
    play:()=>{if(readyRef.current)player.current!.playVideo();},
    pause:()=>{if(readyRef.current)player.current!.pauseVideo();},
    state:()=>readyRef.current?player.current!.getPlayerState():-1,
    rate:()=>readyRef.current?player.current!.getPlaybackRate():1
  }),[seekTo]);
  useEffect(()=>{
    let disposed=false, stopClock:(()=>void)|undefined;
    loadApi().then(YT=>{
      if(disposed||!host.current)return;
      const node=document.createElement("div");host.current.appendChild(node);
      player.current=new YT.Player(node,{videoId,host:"https://www.youtube-nocookie.com",width:"100%",height:"100%",playerVars:{autoplay:0,controls:0,playsinline:1,rel:0,cc_load_policy:0,origin:window.location.origin},events:{
        onReady:event=>{if(disposed)return;const target=position.current!.getTimeMs();readyRef.current=true;setReady(true);position.current!.select(target,true);event.target.seekTo(target/1000,true);if(autoplayRef.current)event.target.playVideo();else event.target.pauseVideo();setRates(event.target.getAvailablePlaybackRates());const actualDuration=event.target.getDuration()*1000;if(Number.isFinite(actualDuration)&&actualDuration>0)setDuration(actualDuration);setVolume(event.target.getVolume());setMuted(event.target.isMuted());stopClock?.();stopClock=observePlayerClock(()=>event.target.getCurrentTime(),sample);},
        onStateChange:event=>{if(!disposed)setState(event.data);},
        onPlaybackRateChange:event=>{if(!disposed)setRate(event.data);},onError:()=>{if(disposed)return;stopClock?.();readyRef.current=false;position.current!.fail();setReady(false);setFailed(true);}
      }});
    }).catch(()=>{if(!disposed){position.current!.fail();setFailed(true);}});
    return ()=>{disposed=true;stopClock?.();position.current!.dispose();readyRef.current=false;player.current?.destroy();player.current=null;};
  },[videoId,sample]);
  const text=t(lang);
  return <section aria-label={text.player} className={styles.player}><div className={styles.shell}><div ref={host} className={styles.host}/>{!ready&&!failed&&<p className={styles.message} role="status">{text.playerLoading}</p>}{failed&&<div className={styles.message} role="alert"><p>{text.playerError}</p><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`} target="_blank" rel="noreferrer">{text.source} ↗</a></div>}</div>
    {controlsTarget&&createPortal(<div className={styles.controls}>
      <Button variant="secondary" size="sm" label={state===1?text.pause:text.play} isDisabled={!ready} onClick={()=>{if(state===1)player.current?.pauseVideo();else player.current?.playVideo();}}/>
      <span className={styles.time}>{timestamp(current)} / {timestamp(duration)}</span>
      <div className={styles.scrubber}><Slider label={text.learnSeek} isLabelHidden min={0} max={Math.max(1,duration)} step={1000} value={Math.max(0,Math.min(current,duration))} formatValue={timestamp} valueDisplay="none" isDisabled={!ready} onChange={seekTo}/></div>
      <Button variant="secondary" size="sm" label={muted?text.learnUnmute:text.learnMute} isDisabled={!ready} onClick={()=>{if(!player.current)return;if(muted)player.current.unMute();else player.current.mute();setMuted(!muted);}}/>
      <div className={styles.volume}><Slider label={text.learnVolume} isLabelHidden min={0} max={100} value={volume} valueDisplay="none" isDisabled={!ready} onChange={(value:number)=>{if(!player.current)return;player.current.setVolume(value);if(value>0){player.current.unMute();setMuted(false);}setVolume(value);}}/></div>
      <Selector label={text.playbackRate} isLabelHidden variant="secondary" placement="above" isDisabled={!ready} value={String(rate)} onChange={value=>{if(ready)player.current?.setPlaybackRate(Number(value));}} options={rates.map(value=>({value:String(value),label:`${value}×`}))}/>
      <Button variant="secondary" size="sm" label={text.learnFullscreen} isDisabled={!ready} onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>{});}}/>
    </div>,controlsTarget)}
  </section>;
});
