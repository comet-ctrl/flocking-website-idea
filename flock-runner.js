/* Move the unchanged fixed-step Flock simulation off the drawing thread. */
(() => {
 const HISTORY_FLOATS=32,STRIDE=4+HISTORY_FLOATS,BUFFER_TICKS=10,MAX_BATCH_SECONDS=4/60;
 const workerURL=typeof document!=='undefined'&&document.currentScript
  ?new URL('flock-worker.js',document.currentScript.src).href:'flock-worker.js';
 // Both threads start from the same seed, so the first reply cannot jump.
 function seededRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
 class FlockRunner{
  constructor(w,h,count){
   const seed=Math.floor(Math.random()*4294967296);
   this._flock=new Flock(w,h,count,seededRandom(seed));
   this.birds=this._flock.birds;this.depth=this._flock.depth;
   this.mainClock=0;this.snapshotTick=0;this.droppedTicks=0;this.mode='sync';
   this._snapshotAccumulator=0;this._pendingSeconds=0;this._inFlight=false;
   this._snapshotBuffer=null;this._spareBuffer=null;this._destroyed=false;
   this._latestIntruder={x:0,y:0,vx:0,vy:0,active:false,down:false};
   this._resetAfterReply=false;this._ticksSinceReset=0;
   // A standalone file still works in browsers that cannot start local workers.
   if(typeof Worker==='undefined'||(typeof location!=='undefined'&&location.protocol==='file:'))return;
   try{
    this._worker=new Worker(workerURL);this.mode='worker';this._inFlight=true;
    this._worker.onmessage=event=>this._receive(event.data);
    this._worker.onerror=event=>{event.preventDefault();this._fallback()};
    this._worker.onmessageerror=()=>this._fallback();
    this._worker.postMessage({type:'init',w,h,count,seed});
   }catch{this._fallback()}
  }
  advance(elapsed,intruder,pace=2.2){
   if(this._destroyed)return;
   const dt=Math.max(0,Math.min(.1,Number.isFinite(elapsed)?elapsed:0));
   const rate=Number.isFinite(pace)?Math.max(0,pace):2.2,seconds=dt*rate;
   this._latestIntruder={x:intruder.x,y:intruder.y,vx:intruder.vx||0,vy:intruder.vy||0,active:!!intruder.active,down:!!intruder.down};
   this.mainClock+=seconds*60;
   if(this._resetAfterReply)this._ticksSinceReset+=seconds*60;
   if(this.mode==='sync'){
    this._flock.advance(dt,this._latestIntruder,rate);
    this.snapshotTick=this._flock.tick;this._snapshotAccumulator=this._flock.accumulator;
   }else{
    // Accumulate simulation seconds, not wall seconds: a speed change while
    // the worker is busy must not rescale time that was already requested.
    this._pendingSeconds+=seconds;
    // Match the frame-stall policy on an overloaded device: never queue an
    // unbounded catch-up that makes the flock react to a long-past pointer.
    // The explicit counter lets performance checks detect every dropped tick.
    const excess=Math.max(0,this._pendingSeconds-.1*rate);
    if(excess){
     this._pendingSeconds-=excess;this.mainClock-=excess*60;this.droppedTicks+=excess*60;
     if(this._resetAfterReply)this._ticksSinceReset=Math.max(0,this._ticksSinceReset-excess*60);
    }
    this._dispatch();
   }
  }
  get renderAgeTicks(){
   if(this.mode==='sync')return 1-this._flock.renderAlpha;
   // Render buffered, real positions rather than extrapolating future turns.
   return Math.max(0,Math.min(14,this.snapshotTick-(this.mainClock-BUFFER_TICKS)));
  }
  _dispatch(){
   if(this._destroyed||!this._worker||this._inFlight||this._pendingSeconds<1e-10)return;
   const seconds=Math.min(this._pendingSeconds,MAX_BATCH_SECONDS);
   this._pendingSeconds-=seconds;this._inFlight=true;
   const recycle=this._spareBuffer;this._spareBuffer=null;
   try{
    this._worker.postMessage({type:'advance',seconds,intruder:this._latestIntruder,recycle},recycle?[recycle]:[]);
   }catch{this._fallback()}
  }
  _receive(message){
   if(this._destroyed||this.mode!=='worker')return;
   if(!message||message.type!=='state'||!(message.buffer instanceof ArrayBuffer)||message.buffer.byteLength!==this.birds.length*STRIDE*4){this._fallback();return}
   const data=new Float32Array(message.buffer),oldBuffer=this._snapshotBuffer;
   this._snapshotBuffer=message.buffer;this._spareBuffer=oldBuffer;
   this.snapshotTick=message.tick;this._snapshotAccumulator=message.accumulator;
   this.depth=message.depth;
   // Keep both bird objects and history arrays stable. Copying this small
   // snapshot avoids allocating thousands of typed-array views every reply.
   for(let i=0;i<this.birds.length;i++){
    const p=this.birds[i],base=i*STRIDE,history=p.history;
    for(let j=0;j<HISTORY_FLOATS;j++)history[j]=data[base+4+j];
    p.a=data[base];p.size=data[base+1];p.pz=data[base+2];p.z=data[base+3];
    p.x=history[0];p.y=history[1];p.px=history[2];p.py=history[3];
    if(message.tick){p.vx=p.x-p.px;p.vy=p.y-p.py;p.vz=p.z-p.pz;p.pvx=history[2]-history[4];p.pvy=history[3]-history[5]}
   }
   this._flock.tick=message.tick;this._flock.accumulator=message.accumulator;
   this._inFlight=false;
   if(this._resetAfterReply){
    this.mainClock=message.tick+message.accumulator*60+this._ticksSinceReset;
    this._resetAfterReply=false;this._ticksSinceReset=0;
   }
   this._dispatch();
  }
  resetClock(){
   if(this._destroyed)return;
   this._pendingSeconds=0;this._ticksSinceReset=0;
   if(this.mode==='sync'){
    this._flock.accumulator=0;this._snapshotAccumulator=0;this.mainClock=this.snapshotTick;
   }else{
    this.mainClock=this.snapshotTick+this._snapshotAccumulator*60;
    this._resetAfterReply=this._inFlight;
   }
  }
  _fallback(){
   if(this._destroyed)return;
   this._worker?.terminate();this._worker=null;this.mode='sync';this._inFlight=false;
   this._pendingSeconds=0;this._resetAfterReply=false;this._ticksSinceReset=0;
   this._spareBuffer=null;this._snapshotBuffer=null;
   // If a running worker fails, continue from its last received positions.
   // Its private angular state is unavailable, so rebuild local contacts.
   if(this.snapshotTick){this._flock.refreshNeighbors();this._flock.refreshCohesion()}
   this.mainClock=this.snapshotTick+this._flock.accumulator*60;
  }
  destroy(){
   this._destroyed=true;this._worker?.terminate();this._worker=null;
   this._pendingSeconds=0;this._spareBuffer=null;this._snapshotBuffer=null;
  }
 }
 globalThis.FlockRunner=FlockRunner;
 if(typeof module!=='undefined')module.exports=FlockRunner;
})();
