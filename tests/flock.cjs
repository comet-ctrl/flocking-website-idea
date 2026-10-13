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
