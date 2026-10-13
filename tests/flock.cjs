const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
const quiet={active:false};
const wrap=(value,size)=>(value%size+size)%size;
const difference=(a,b,size)=>{const d=Math.abs(wrap(a,size)-wrap(b,size));return Math.min(d,size-d)};
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

function setup(states,width=1280,height=720){
 const flock=new Flock(width,height,states.length,()=>.5);
 flock.birds.forEach((p,i)=>{
  Object.assign(p,{vx:2.1,vy:0,ax:0,ay:0},states[i]);
  p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;
  p.history=Float64Array.from({length:16},(_,j)=>j%2?p.y:p.x);
 });
 return flock;
}
function physicalState(p){return {x:p.x,y:p.y,vx:p.vx,vy:p.vy,ax:p.ax,ay:p.ay}}

test('fixed physics steps agree at 30, 60 and 120 Hz, including 2.2× pace',()=>{
 function run(hz,pace){
  let seed=1;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const f=new Flock(1200,800,100,random);
  for(let i=0;i<hz*2;i++)f.advance(1/hz,{active:true,x:600,y:400,vx:500,vy:100},pace);
  return f.birds.map(p=>[p.x,p.y,p.vx,p.vy]);
 }
 for(const pace of [1.8,2.2]){
  const expected=run(60,pace);assert.deepEqual(run(30,pace),expected);assert.deepEqual(run(120,pace),expected);
 }
});

test('render interpolation lies between poses without advancing the simulation',()=>{
 const f=setup([{x:600,y:400}]),p=f.birds[0];
 f.advance(1/60,quiet,1);
 const previous=p.px,current=p.x;
 f.advance(1/120,quiet,1);
 close(f.renderAlpha,.5);assert.equal(p.x,current);
 const rendered=p.px+(p.x-p.px)*f.renderAlpha;
 assert.ok(rendered>=Math.min(previous,current)&&rendered<=Math.max(previous,current));
 assert.equal(p.history[0],p.x);assert.equal(p.history[2],p.px);
});

test('distant birds cannot steer a local group through global cohesion or alignment',()=>{
 const local=[{x:300,y:350},{x:311,y:352},{x:304,y:365},{x:317,y:361}];
 const isolated=setup(local),withDistantBirds=setup([...local,...Array.from({length:40},(_,i)=>({x:850+i%8*9,y:130+Math.floor(i/8)*9,vx:-1.2,vy:1.7}))]);
 for(let tick=0;tick<90;tick++){
  isolated.step(1/60,quiet);withDistantBirds.step(1/60,quiet);
  isolated.birds.forEach((p,i)=>assert.deepEqual(physicalState(withDistantBirds.birds[i]),physicalState(p)));
 }
});

test('an isolated bird travels straight through screen edges without a shared bank',()=>{
 const f=setup([{x:1190,y:790}],1200,800),p=f.birds[0];
 for(let tick=0;tick<200;tick++)f.step(1/60,quiet);
 close(p.x,wrap(1190+200*2.1,1200));close(p.y,790);close(p.vx,2.1);close(p.vy,0);
});

test('local flight and mouse avoidance are unchanged by a wrapped translation',()=>{
 const width=1279,height=719,shiftX=384.5,shiftY=400.25;
 const states=[{x:4,y:5},{x:width-5,y:height-4},{x:14,y:height-11},{x:width-18,y:9}];
 const a=setup(states,width,height),b=setup(states.map(p=>({...p,x:wrap(p.x+shiftX,width),y:wrap(p.y+shiftY,height)})),width,height);
 const pointer={active:true,x:7,y:height-12,vx:100,vy:200};
 const translated={...pointer,x:wrap(pointer.x+shiftX,width),y:wrap(pointer.y+shiftY,height)};
 for(let tick=0;tick<90;tick++){
  a.step(1/60,pointer);b.step(1/60,translated);
  a.birds.forEach((p,i)=>{
   const q=b.birds[i];assert.ok(difference(q.x,p.x+shiftX,width)<1e-8);assert.ok(difference(q.y,p.y+shiftY,height)<1e-8);
   close(q.vx,p.vx,1e-8);close(q.vy,p.vy,1e-8);
  });
 }
});

test('rotating birds and the intruder rotates the response instead of imposing a stream axis',()=>{
 const size=900,states=[{x:425.1,y:436.3,vx:2,vy:.4},{x:438.4,y:448.9,vx:2.1,vy:.1},{x:417.6,y:450.2,vx:1.8,vy:.9},{x:433.7,y:459.5,vx:2,vy:.5}];
 const a=setup(states,size,size),b=setup(states.map(p=>({...p,x:size-p.y,y:p.x,vx:-p.vy,vy:p.vx})),size,size);
 const pointer={active:true,x:469,y:430,vx:120,vy:60};
 const rotated={...pointer,x:size-pointer.y,y:pointer.x,vx:-pointer.vy,vy:pointer.vx};
 for(let tick=0;tick<60;tick++){
  a.step(1/60,pointer);b.step(1/60,rotated);
  a.birds.forEach((p,i)=>{
   const q=b.birds[i];assert.ok(difference(q.x,size-p.y,size)<1e-8);assert.ok(difference(q.y,p.x,size)<1e-8);
   close(q.vx,-p.vy,1e-8);close(q.vy,p.vx,1e-8);
  });
 }
});

test('the obstacle repels radially, independent of the bird heading',()=>{
 for(const [vx,vy] of [[2.1,0],[0,2.1],[-2.1,0],[0,-2.1]]){
  const f=setup([{x:600,y:400,vx,vy}]),p=f.birds[0];
  f.step(1/60,{active:true,x:580,y:380,vx:0,vy:0});
  assert.ok(p.ax>0&&p.ay>0);close(p.ax,p.ay);
 }
});

test('a head-on bird brakes instead of ignoring backward avoidance force',()=>{
 const a=setup([{x:500,y:400}]),b=setup([{x:500,y:400}]);
 for(let tick=0;tick<8;tick++){
  a.step(1/60,quiet);b.step(1/60,{active:true,x:550,y:400});
 }
 assert.ok(b.birds[0].vx<a.birds[0].vx);assert.ok(b.birds[0].x<a.birds[0].x);
 close(b.birds[0].vy,0);assert.ok(b.birds[0].ax<0);
});

test('crossing the pointer changes the avoidance direction without remembering a split side',()=>{
 const previous=setup([{x:600,y:400}]),p=previous.birds[0];
 previous.step(1/60,{active:true,x:600,y:380});assert.ok(p.ay>0);
 // A fresh bird in exactly the same physical state must react identically.
 const fresh=setup([physicalState(p)]),unperturbed=setup([physicalState(p)]);
 const opposite={active:true,x:p.x,y:p.y+20};
 previous.step(1/60,opposite);fresh.step(1/60,opposite);unperturbed.step(1/60,quiet);
 assert.deepEqual(physicalState(p),physicalState(fresh.birds[0]));
 assert.ok(p.vy<unperturbed.birds[0].vy);
});

test('approaching mouse motion anticipates contact and extreme jumps remain bounded',()=>{
 function sample(vx,x=660){
  const f=setup([{x,y:420}],1200,800);
  f.step(1/60,{active:true,x:450,y:400,vx,vy:0});return f.birds[0];
 }
 close(sample(0).ay,0);assert.ok(sample(1000).ay>0);close(sample(-1000).ay,0);
 close(sample(1e7,1000).ay,0);
});

test('captured pointer positions beyond the viewport use the same periodic obstacle',()=>{
 const a=setup([{x:600,y:400}]),b=setup([{x:600,y:400}]);
 a.step(1/60,{active:true,x:580,y:380,vx:120,vy:40});
 b.step(1/60,{active:true,x:580+3*1280,y:380-4*720,vx:120,vy:40});
 assert.deepEqual(physicalState(a.birds[0]),physicalState(b.birds[0]));
});

test('wrapping preserves continuous interpolation and short particle histories',()=>{
 const f=setup([{x:389.5,y:843.5,vx:2.1/Math.SQRT2,vy:2.1/Math.SQRT2}],390,844),p=f.birds[0];
 for(let tick=0;tick<900;tick++){
  f.step(1/60,quiet);
  assert.ok(p.x>=0&&p.x<390&&p.y>=0&&p.y<844);
  close(p.x-p.px,p.vx);close(p.y-p.py,p.vy);
  for(let k=0;k<14;k+=2)assert.ok(Math.hypot(p.history[k]-p.history[k+2],p.history[k+1]-p.history[k+3])<=2.8+1e-9);
 }
});

test('flight remains finite and bounded at wide, narrow and tiny viewport sizes',()=>{
 for(const [w,h] of [[1600,900],[390,844],[8,7]]){
  let seed=43;const f=new Flock(w,h,100,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
  for(let tick=0;tick<480;tick++)f.advance(1/60,{active:tick<300,x:w*.6,y:h*.5,vx:400,vy:0},2.2);
  for(const p of f.birds){
   assert.ok([p.x,p.y,p.vx,p.vy,...p.history].every(Number.isFinite));
   assert.ok(p.x>=0&&p.x<w&&p.y>=0&&p.y<h);assert.ok(Math.hypot(p.vx,p.vy)<=2.8+1e-9);
  }
 }
 const empty=new Flock(1280,720,0);assert.doesNotThrow(()=>empty.advance(1/60,quiet));
});
