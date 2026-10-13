const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');

function isolated(){
 const f=new Flock(2400,1600,1,()=>.5);f.wanderStrength=0;
 Object.assign(f.birds[0],{x:900,y:800,z:90,vx:2.1,vy:0,vz:0,ax:0,ay:0,az:0,ox:0,oy:0,oz:0,wx:0,wy:0,wz:0});
 return f;
}

test('mouse avoidance tapers smoothly with distance and holding remains stronger',()=>{
 function response(distance,down){
  const f=isolated();f.step(1/60,{active:true,x:900,y:800-distance,vx:0,vy:0,down});
  const p=f.birds[0];
  // A nearby pointer should start a turn, not abruptly replace the heading.
  assert.ok(Math.abs(Math.atan2(p.vy,p.vx))<Math.PI/90);
  return p.ay;
 }
 for(const down of [false,true]){
  const samples=Array.from({length:40},(_,i)=>response(5+i*10,down));
  assert.ok(samples[0]>0);assert.equal(samples.at(-1),0);
  for(let i=1;i<samples.length;i++){
   assert.ok(samples[i]<=samples[i-1]+1e-12,'avoidance should weaken with distance');
   assert.ok(samples[i-1]-samples[i]<samples[0]*.12,'a small pointer movement should not cause a force jump');
  }
 }
 assert.ok(response(50,true)>response(50,false),'holding should still produce a stronger encounter');
});

test('mouse activation and release ease the steering force rather than switching it instantly',()=>{
 const f=isolated(),p=f.birds[0],mouse={active:true,x:900,y:740,vx:0,vy:0,down:false};
 f.step(1/60,mouse);const first=p.ay;
 f.step(1/60,mouse);const second=p.ay;
 assert.ok(first>0&&second>first,'avoidance should build through the existing acceleration filter');
 for(let i=0;i<8;i++)f.step(1/60,mouse);
 const beforeRelease=p.ay;
 assert.ok(beforeRelease>second);
 f.step(1/60,{active:false});
 assert.ok(p.ay>0&&p.ay<beforeRelease,'release should retain and then ease the accumulated steering');
});
