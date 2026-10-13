const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sourcePath=process.argv[2]||path.join(__dirname,'..','app.js');
const source=fs.readFileSync(sourcePath,'utf8');

function fixture({width=1280,height=720,dpr=1,reduced=false}={}){
 const counters={canvases:1,radials:0,strokes:[],advances:[],resets:0};
 const windowEvents=new Map(),canvasEvents=new Map(),documentEvents=new Map();
 const context2d=()=>({setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},fillRect(){},drawImage(){},save(){},restore(){},translate(){},rotate(){},stroke(){counters.strokes.push(this.strokeStyle)},createLinearGradient(){return {addColorStop(){}}},createRadialGradient(){counters.radials++;return {addColorStop(){}}}});
 const makeCanvas=(events=new Map())=>({width:0,height:0,getContext:()=>context2d(),addEventListener:(name,cb)=>events.set(name,cb),setPointerCapture(){}});
 const field=makeCanvas(canvasEvents);
 class FlockRunner{
  constructor(w,h,count){
   this.depth=200;this.renderAgeTicks=1.25;this.mode='worker';this.birds=Array.from({length:count},(_,n)=>{
    const x=w*(.35+(n%50)/200),y=h*(.3+Math.floor(n/50)/200),vx=1.8,vy=.8;
    const history=Float32Array.from({length:32},(_,j)=>j%2?y-Math.floor(j/2)*vy:x-Math.floor(j/2)*vx);
    return {x,y,vx,vy,z:100+n%80,pz:100+n%80,size:.6+(n%7)*.05,a:.4+(n%4)*.1,history};
   });
  }
  advance(dt,intruder,pace){counters.advances.push({dt,pace})}
  destroy(){this.destroyed=true}
  resetClock(){counters.resets++}
 }
 const sandbox={innerWidth:width,innerHeight:height,devicePixelRatio:dpr,FlockRunner,matchMedia:()=>({matches:reduced}),requestAnimationFrame(){},document:{hidden:false,querySelector:()=>field,createElement(){counters.canvases++;return makeCanvas()},addEventListener:(name,cb)=>documentEvents.set(name,cb)}};
 sandbox.window=sandbox;sandbox.addEventListener=(name,cb)=>windowEvents.set(name,cb);
 const cx=vm.createContext(sandbox);vm.runInContext(source,cx,{filename:sourcePath});
 return {run:code=>vm.runInContext(code,cx),cx,counters,field,windowEvents,canvasEvents,documentEvents};
}

function check(name,fn){test(name,fn)}
check('50% more finite rendered birds, unchanged simulation population and pace',()=>{
 const f=fixture();
 assert.equal(f.run('flock.birds.length'),2200);assert.equal(f.run('renderSources.length'),3300);
 assert.equal(f.run('[...poses,...wakes].every(Number.isFinite)'),true);
 assert.equal(f.run('pace'),2.2);assert.equal(f.counters.advances[0].pace,2.2);
 assert.equal(f.run('renderSources.every(n=>n<flock.birds.length)'),true);
});
check('paused poses remain frozen across late worker changes and mouse movement',()=>{
 const f=fixture();f.run('pause();globalThis.before=Array.from(poses);globalThis.oldFlock=flock;');
 const count=f.counters.advances.length;
 f.run('for(const p of flock.birds){for(let j=0;j<p.history.length;j++)p.history[j]+=60;p.z+=40;p.pz+=40;}paint(0);');
 assert.equal(f.run('before.every((v,i)=>v===poses[i])'),true);
 f.canvasEvents.get('pointermove')({clientX:600,clientY:400});
 assert.equal(f.counters.advances.length,count);assert.equal(f.run('before.every((v,i)=>v===poses[i])'),true);
 f.run('pause();draw(1/60)');assert.equal(f.run('before.some((v,i)=>v!==poses[i])'),true);
});
check('reduced-motion starts paused and Space toggles it',()=>{
 const f=fixture({reduced:true});assert.equal(f.run('paused&&!!frozenScene'),true);
 let prevented=false;f.windowEvents.get('keydown')({code:'Space',repeat:false,preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(f.run('paused'),false);
});
check('resize stays within the pixel budget and refreshes frozen scenes',()=>{
 const f=fixture();f.run('pause();globalThis.previousFlock=flock;');
 f.cx.innerWidth=3840;f.cx.innerHeight=2160;f.cx.devicePixelRatio=2;f.windowEvents.get('resize')();
 assert.ok(f.field.width*f.field.height<=4005000);assert.equal(f.run('previousFlock.destroyed'),true);
 assert.equal(f.run('paused&&!!frozenScene'),true);assert.equal(f.run('[...poses,...wakes].every(Number.isFinite)'),true);
 f.cx.innerWidth=390;f.cx.innerHeight=844;f.windowEvents.get('resize')();f.run('paint(0)');
 assert.equal(f.run('flock.birds.length'),1100);assert.equal(f.run('renderSources.length'),1650);assert.equal(f.run('[...poses,...wakes].every(Number.isFinite)'),true);
});
check('steady frames reuse backdrop and canvases; spill and wings remain drawn',()=>{
 const f=fixture(),canvases=f.counters.canvases,gradients=f.counters.radials;
 f.run('for(let n=0;n<120;n++)paint(1/60)');
 assert.equal(f.counters.canvases,canvases);assert.equal(f.counters.radials,gradients);
 assert.ok(f.counters.strokes.includes('rgba(255,116,148,.9)'));assert.ok(f.counters.strokes.includes('rgba(233,242,252,.65)'));
});
check('pointer hold, release, blur and visibility clock reset are preserved',()=>{
 const f=fixture();f.canvasEvents.get('pointerdown')({clientX:500,clientY:300,pointerId:1});assert.equal(f.run('mouse.down&&mouse.active'),true);
 f.windowEvents.get('pointerup')();assert.equal(f.run('mouse.down'),false);
 f.windowEvents.get('blur')();assert.equal(f.run('mouse.active'),false);
 f.documentEvents.get('visibilitychange')();assert.equal(f.counters.resets,1);
});
