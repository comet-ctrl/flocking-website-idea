/* Same Flock model and 60 Hz physics as the synchronous fallback. */
importScripts('flock.js');
const HISTORY_FLOATS=32,STRIDE=4+HISTORY_FLOATS;
let flock;
function seededRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function sendState(recycle){
 const bytes=flock.birds.length*STRIDE*4;
 const buffer=recycle instanceof ArrayBuffer&&recycle.byteLength===bytes?recycle:new ArrayBuffer(bytes);
 const data=new Float32Array(buffer);
 for(let i=0;i<flock.birds.length;i++){
  const p=flock.birds[i],base=i*STRIDE;
  data[base]=p.a;data[base+1]=p.size;data[base+2]=p.pz;data[base+3]=p.z;
  data.set(p.history,base+4);
 }
 postMessage({type:'state',buffer,tick:flock.tick,accumulator:flock.accumulator,depth:flock.depth},[buffer]);
}
onmessage=event=>{
 const message=event.data;
 if(message.type==='init'){
  flock=new Flock(message.w,message.h,message.count,seededRandom(message.seed));sendState();
 }else if(message.type==='advance'&&flock){
  // The main thread already clamps each elapsed frame and applies its pace.
  // Do not cap this accumulated time again or faster settings would slow down.
  flock.accumulator+=message.seconds;
  while(flock.accumulator+1e-10>=1/60){flock.step(1/60,message.intruder);flock.accumulator-=1/60}
  sendState(message.recycle);
 }
};
