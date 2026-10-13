const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');

function sample(vx){
 const f=new Flock(1200,800,1,()=>.5);
 Object.assign(f.birds[0],{x:660,y:420,vx:2.1,vy:0});
 f.step(1/60,{active:true,x:450,y:400,vx,vy:0});
 return f.birds[0];
}
test('approaching arrow warns birds before entering its ordinary radius',()=>{
 assert.equal(sample(0).evadeTime,0);
 assert.ok(sample(1000).evadeTime>0);
 assert.equal(sample(-1000).evadeTime,0);
});
test('a pointer jump cannot extend anticipation across the screen',()=>{
 const f=new Flock(1200,800,1,()=>.5);
 Object.assign(f.birds[0],{x:1000,y:420,vx:2.1,vy:0});
 f.step(1/60,{active:true,x:450,y:400,vx:1e7,vy:0});
 assert.equal(f.birds[0].evadeTime,0);
});
test('birds retain their chosen side while an intruder crosses their heading',()=>{
 const f=new Flock(1200,800,1,()=>.5),p=f.birds[0];
 Object.assign(p,{x:600,y:420,vx:2.1,vy:0});
 f.step(1/60,{active:true,x:600,y:400});
 const side=p.evadeSide;
 f.step(1/60,{active:true,x:600,y:440});
 assert.equal(p.evadeSide,side);
 for(let i=0;i<30;i++)f.step(1/60,{active:false});
 assert.equal(p.evadeTime,0);
});
test('fixed-step flock remains identical at 30, 60 and 120 Hz',()=>{
 function run(hz){let seed=1;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const f=new Flock(1200,800,100,random);
  for(let i=0;i<hz*2;i++)f.advance(1/hz,{active:true,x:600,y:400,vx:500,vy:100},1.8);
  return f.birds.map(p=>[p.x,p.y,p.vx,p.vy]);
 }
 assert.deepEqual(run(30),run(60));assert.deepEqual(run(120),run(60));
});
test('render interpolation stays between consecutive poses without changing physics',()=>{
 const f=new Flock(1200,800,1,()=>.5),p=f.birds[0];
 f.advance(1/60,{active:false},1);
 const previous=p.px,current=p.x;
 f.advance(1/120,{active:false},1);
 assert.ok(Math.abs(f.renderAlpha-.5)<1e-9);
 assert.equal(p.x,current);
 const rendered=p.px+(p.x-p.px)*f.renderAlpha;
 assert.ok(rendered>=Math.min(previous,current)&&rendered<=Math.max(previous,current));
 assert.equal(p.history[0],p.x);assert.equal(p.history[2],p.px);
});
test('regrouping recovers gradually after the intruder leaves',()=>{
 const f=new Flock(1200,800,1,()=>.5),p=f.birds[0];
 for(let i=0;i<30;i++)f.step(1/60,{active:true,x:p.x,y:p.y});
 const alarmed=p.stress;assert.ok(alarmed>.9);
 f.step(1/60,{active:false});assert.ok(p.stress<alarmed&&p.stress>.8);
 for(let i=0;i<300;i++)f.step(1/60,{active:false});
 assert.ok(p.stress<.05);
});
test('free-space flock remains finite with wide and narrow viewport scales',()=>{
 for(const [w,h] of [[1600,900],[390,844]]){
  const f=new Flock(w,h,100,()=>.5);
  for(let i=0;i<900;i++)f.advance(1/60,{active:i<300,x:w*.6,y:h*.5,vx:400,vy:0},2.2);
  assert.ok(f.birds.every(p=>[p.x,p.y,p.vx,p.vy,...p.history].every(Number.isFinite)));
 }
});
test('a sparse bird finds neighbors beyond the ordinary local search radius',()=>{
 const f=new Flock(1280,720,5,()=>.5);
 f.birds.forEach((p,i)=>Object.assign(p,{x:i===0?400:510+i,y:350,vx:2.1,vy:0}));
 f.step(1/60,{active:false});
 assert.equal(f.birds[0].neighborCount,4);
 assert.ok(f.birds[0].neighbors.slice(0,4).every(i=>i>0));
});
test('free-space flight and mouse avoidance are invariant under camera translation',()=>{
 const a=new Flock(1280,720,50,()=>.5),b=new Flock(1280,720,50,()=>.5);
 for(const p of b.birds){p.x+=5000;p.y-=3000}
 for(let i=0;i<120;i++){
  a.step(1/60,{active:true,x:630,y:360,vx:200,vy:0});
  b.step(1/60,{active:true,x:5630,y:-2640,vx:200,vy:0});
 }
 a.birds.forEach((p,i)=>{assert.ok(Math.abs(b.birds[i].x-p.x-5000)<1e-6);assert.ok(Math.abs(b.birds[i].y-p.y+3000)<1e-6)});
});
