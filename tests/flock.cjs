const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
const quiet={active:false};
const rng=(seed=1)=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function setup(states,w=2400,h=1600){
 const f=new Flock(w,h,states.length,rng());f.wanderStrength=0;
 f.birds.forEach((p,i)=>{
  Object.assign(p,{x:900,y:800,z:90,vx:2.1,vy:0,vz:0,ax:0,ay:0,az:0,ox:0,oy:0,oz:0,wx:0,wy:0,wz:0},states[i]);
  p.px=p.x;p.py=p.y;p.pz=p.z;p.pvx=p.vx;p.pvy=p.vy;p.pvz=p.vz;
  p.history=Float64Array.from({length:32},(_,k)=>k%2?p.y:p.x);
 });return f;
}
const state=p=>['x','y','z','vx','vy','vz','ax','ay','az','ox','oy','oz','wx','wy','wz','noiseState'].map(k=>p[k]);
test('fixed 2.2x physics agrees at 30, 60 and 120 Hz',()=>{
 function run(hz){const f=new Flock(1200,800,100,rng());for(let i=0;i<hz*2;i++)f.advance(1/hz,{active:true,x:600,y:400,vx:400,vy:100},2.2);return f.birds.map(state)}
 const expected=run(60);assert.deepEqual(run(30),expected);assert.deepEqual(run(120),expected);
});
test('grid finds actual nearest birds in 3D rather than projected overlaps',()=>{
 const random=rng(31),states=Array.from({length:170},()=>({x:600+random()*260,y:400+random()*190,z:5+random()*170}));
 const f=setup(states);f.refreshNeighbors();
 for(let i=0;i<f.birds.length;i++){
  const p=f.birds[i],expected=f.birds.map((q,j)=>({j,d:(p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2})).filter(q=>q.j!==i&&q.d<120**2).sort((a,b)=>a.d-b.d).slice(0,p.neighbors.length).map(q=>q.j);
  assert.deepEqual(Array.from(p.neighbors.slice(0,p.neighborCount)),expected);
 }
});
test('distant birds have no influence through a hidden whole-flock controller',()=>{
 const local=[{x:800,y:700},{x:809,y:705,z:96},{x:797,y:715,z:86}];
 const a=setup(local),b=setup([...local,...Array.from({length:30},(_,i)=>({x:1800+i%6*10,y:1100+Math.floor(i/6)*10,vx:-2,vy:.5}))]);
 for(let tick=0;tick<80;tick++){a.step(1/60,quiet);b.step(1/60,quiet);a.birds.forEach((p,i)=>assert.deepEqual(state(p),state(b.birds[i])))}
});
test('interior flight and pointer avoidance translate with their positions',()=>{
 const states=[{x:900,y:700},{x:910,y:712,z:96},{x:895,y:718,z:86}],sx=371.25,sy=217.5;
 const a=setup(states,3200,2400),b=setup(states.map(p=>({...p,x:p.x+sx,y:p.y+sy})),3200,2400);
 for(let tick=0;tick<60;tick++){
  a.step(1/60,{active:true,x:915,y:705,vx:100,vy:50});b.step(1/60,{active:true,x:915+sx,y:705+sy,vx:100,vy:50});
  a.birds.forEach((p,i)=>{const q=b.birds[i];close(q.x,p.x+sx);close(q.y,p.y+sy);for(const k of ['z','vx','vy','vz'])close(q[k],p[k])});
 }
});
test('mouse anticipation is local and acts through the visible depth',()=>{
 function sample(vx,z=90,x=1200){const f=setup([{x,y:820,z}]);f.step(1/60,{active:true,x:900,y:800,vx,vy:0});return f.birds[0]}
 close(sample(0).ay,0);assert.ok(sample(1000).ay>0);close(sample(-1000).ay,0);
 close(sample(1e7,90,1600).ay,0);
 const front=sample(1000,45),back=sample(1000,135);close(front.ax,back.ax);close(front.ay,back.ay);
});
test('all poses and trails stay inside the screen with finite bounded motion',()=>{
 for(const [w,h] of [[1280,562],[390,844],[8,7]]){
  const f=new Flock(w,h,100,rng(9));
  for(let t=0;t<420;t++){
   f.advance(1/60,{active:true,down:t<210,x:w*.6,y:h*.6,vx:800,vy:300},2.2);
   for(const p of f.birds){
    assert.ok(state(p).every(Number.isFinite));assert.ok(p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h&&p.z>=0&&p.z<=f.depth);
    assert.ok(Math.hypot(p.vx,p.vy,p.vz)<=2.7+1e-9);
    assert.ok(Math.hypot(p.x-p.px,p.y-p.py,p.z-p.pz)<=2.7+1e-9);
    for(let k=0;k<p.history.length;k+=2)assert.ok(p.history[k]>=0&&p.history[k]<=w&&p.history[k+1]>=0&&p.history[k+1]<=h);
   }
  }
 }
});
test('an isolated bird cruises straight in the interior when fluctuations are disabled',()=>{
 const f=setup([{}]),p=f.birds[0];for(let i=0;i<200;i++)f.step(1/60,quiet);
 close(p.x,900+200*2.1);close(p.y,800);close(p.z,90);close(Math.hypot(p.vx,p.vy,p.vz),2.1);
});
test('head-on avoidance brakes a bird and crossing the arrow reverses the radial force',()=>{
 const a=setup([{}]),b=setup([{}]);
 for(let i=0;i<8;i++){a.step(1/60,quiet);b.step(1/60,{active:true,x:950,y:800})}
 assert.ok(b.birds[0].vx<a.birds[0].vx);close(b.birds[0].vy,0);
 const up=setup([{}]),down=setup([{}]);up.step(1/60,{active:true,x:900,y:780});down.step(1/60,{active:true,x:900,y:820});
 assert.ok(up.birds[0].ay>0&&down.birds[0].ay<0);close(up.birds[0].ay,-down.birds[0].ay);
});
test('render interpolation samples adjacent poses without advancing flight',()=>{
 const f=setup([{}]),p=f.birds[0];f.advance(1/60,quiet,1);
 const current=state(p);f.advance(1/120,quiet,1);close(f.renderAlpha,.5);assert.deepEqual(state(p),current);
 close(p.history[0],p.x);close(p.history[2],p.px);
});
test('a local heading change reaches distant birds later with meaningful strength',()=>{
 // Use the model's uncompressed personal spacing, while retaining an ~900px
 // group and the same localized 17-degree impulse and response thresholds.
 const columns=32,rows=8,count=columns*rows,cohortSize=4*rows;
 function strip(impulse){const random=rng(123),f=new Flock(8000,6000,count,random);f.wanderStrength=0;
  f.birds.forEach((p,i)=>{const column=Math.floor(i/rows),row=i%rows,angle=impulse&&column>=28?.3:0;
   Object.assign(p,{x:3000+column*30+(random()-.5)*.1,y:3000+row*30+(random()-.5)*.1,z:90,vx:2.1*Math.cos(angle),vy:2.1*Math.sin(angle),vz:0,ax:0,ay:0,az:0,ox:0,oy:0,oz:0,wx:0,wy:0,wz:0});
   p.px=p.x;p.py=p.y;p.pz=p.z;p.history=Float64Array.from({length:32},(_,k)=>k%2?p.y:p.x);
  });return f}
 const a=strip(false),b=strip(true),cohorts=[1,4,7].map(bin=>({start:(7-bin)*cohortSize,arrival:null,peak:0,peakTick:0,early:0}));
 for(let t=0;t<=720;t++){
  for(const c of cohorts){let ax=0,ay=0,bx=0,by=0;for(let i=c.start;i<c.start+cohortSize;i++){ax+=a.birds[i].vx;ay+=a.birds[i].vy;bx+=b.birds[i].vx;by+=b.birds[i].vy}
   const angle=Math.atan2(by,bx)-Math.atan2(ay,ax),v=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
   if(c.arrival===null&&v>=.01)c.arrival=t;if(v>c.peak){c.peak=v;c.peakTick=t}if(t<=60)c.early=Math.max(c.early,v);
  }if(t<720){a.step(1/60,quiet);b.step(1/60,quiet)}
 }
 const [near,middle,far]=cohorts;
 assert.ok(far.early<.001);assert.ok(cohorts.every(c=>c.arrival!==null));
 assert.ok(middle.arrival>near.arrival+30&&far.arrival>middle.arrival+30);
 assert.ok(middle.peakTick>near.peakTick+30&&far.peakTick>middle.peakTick+30);
 assert.ok(far.peak>.07&&far.peak>near.peak*.4);assert.ok(cohorts.every(c=>c.peak<.5));
});
