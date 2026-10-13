const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
const quiet={active:false};
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

function setup(states,width=1280,height=720){
 const flock=new Flock(width,height,states.length,()=>.5);
 // Controlled force experiments omit independent flight fluctuations.
 flock.wanderStrength=0;
 flock.birds.forEach((p,i)=>{
  Object.assign(p,{vx:2.1,vy:0,ax:0,ay:0,bank:0,wander:0},states[i]);
  p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;
  p.history=Float64Array.from({length:16},(_,j)=>j%2?p.y:p.x);
 });
 return flock;
}
function physicalState(p){return {x:p.x,y:p.y,vx:p.vx,vy:p.vy,ax:p.ax,ay:p.ay,bank:p.bank,wander:p.wander,noiseState:p.noiseState}}
function assertOnScreen(f,p){
 assert.ok([p.x,p.y,p.px,p.py,p.vx,p.vy,...p.history].every(Number.isFinite));
 for(const [x,y] of [[p.x,p.y],[p.px,p.py],...Array.from({length:8},(_,i)=>[p.history[i*2],p.history[i*2+1]])]){
  assert.ok(x>=0&&x<=f.w&&y>=0&&y<=f.h,`pose (${x}, ${y}) is outside ${f.w} × ${f.h}`);
 }
 assert.ok(Math.hypot(p.x-p.px,p.y-p.py)<=2.8+1e-9,'a physics step must not teleport a bird to another edge');
 for(let k=0;k<14;k+=2)assert.ok(Math.hypot(p.history[k]-p.history[k+2],p.history[k+1]-p.history[k+3])<=2.8+1e-9,'short trails must remain continuous');
 assert.ok(Math.hypot(p.vx,p.vy)<=2.8+1e-9);
}

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

test('a broad flock does not rapidly compress into a compact ball during quiet flight',()=>{
 let seed=9;const f=new Flock(1280,720,1400,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
 function extent(){
  // The largest principal extent is independent of the flight direction.
  let mx=0,my=0,xx=0,xy=0,yy=0;
  for(const p of f.birds){const x=p.x,y=p.y;mx+=x;my+=y;xx+=x*x;xy+=x*y;yy+=y*y}
  const count=f.birds.length;mx/=count;my/=count;xx=xx/count-mx*mx;yy=yy/count-my*my;xy=xy/count-mx*my;
  return Math.sqrt((xx+yy+Math.hypot(xx-yy,2*xy))/2);
 }
 const initial=extent();
 for(let frame=0;frame<240;frame++)f.advance(1/60,quiet,2.2);
 const final=extent();
 // Allow substantial natural deformation; reject the old >70% width collapse.
 assert.ok(final>initial*.6,`principal extent collapsed from ${initial} to ${final}`);
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
 const isolated=setup(local,2400,1600),withDistantBirds=setup([...local,...Array.from({length:40},(_,i)=>({x:1500+i%8*9,y:1100+Math.floor(i/8)*9,vx:-1.2,vy:1.7}))],2400,1600);
 for(let tick=0;tick<90;tick++){
  isolated.step(1/60,quiet);withDistantBirds.step(1/60,quiet);
  isolated.birds.forEach((p,i)=>assert.deepEqual(physicalState(withDistantBirds.birds[i]),physicalState(p)));
 }
});

test('an isolated bird without fluctuations travels straight in the screen interior',()=>{
 const f=setup([{x:600,y:500}],2000,1200),p=f.birds[0];
 for(let tick=0;tick<200;tick++)f.step(1/60,quiet);
 close(p.x,600+200*2.1);close(p.y,500);close(p.vx,2.1);close(p.vy,0);
});

test('local flight and mouse avoidance are unchanged by an interior translation',()=>{
 const width=3000,height=2400,shiftX=384.5,shiftY=400.25;
 const states=[{x:804,y:805},{x:795,y:796},{x:814,y:789},{x:782,y:809}];
 const a=setup(states,width,height),b=setup(states.map(p=>({...p,x:p.x+shiftX,y:p.y+shiftY})),width,height);
 const pointer={active:true,x:807,y:788,vx:100,vy:200};
 const translated={...pointer,x:pointer.x+shiftX,y:pointer.y+shiftY};
 for(let tick=0;tick<90;tick++){
  a.step(1/60,pointer);b.step(1/60,translated);
  a.birds.forEach((p,i)=>{
   const q=b.birds[i];close(q.x,p.x+shiftX,1e-8);close(q.y,p.y+shiftY,1e-8);
   close(q.vx,p.vx,1e-8);close(q.vy,p.vy,1e-8);
   for(const bird of [p,q])assert.ok(Math.min(bird.x,width-bird.x,bird.y,height-bird.y)>250,'translation experiment must remain clear of boundary steering');
  });
 }
});

test('rotating birds and the intruder rotates the response instead of imposing a stream axis',()=>{
 const size=2000,states=[{x:975.1,y:986.3,vx:2,vy:.4},{x:988.4,y:998.9,vx:2.1,vy:.1},{x:967.6,y:1000.2,vx:1.8,vy:.9},{x:983.7,y:1009.5,vx:2,vy:.5}];
 const a=setup(states,size,size),b=setup(states.map(p=>({...p,x:size-p.y,y:p.x,vx:-p.vy,vy:p.vx})),size,size);
 const pointer={active:true,x:1019,y:980,vx:120,vy:60};
 const rotated={...pointer,x:size-pointer.y,y:pointer.x,vx:-pointer.vy,vy:pointer.vx};
 for(let tick=0;tick<60;tick++){
  a.step(1/60,pointer);b.step(1/60,rotated);
  a.birds.forEach((p,i)=>{
   const q=b.birds[i];close(q.x,size-p.y,1e-8);close(q.y,p.x,1e-8);
   close(q.vx,-p.vy,1e-8);close(q.vy,p.vx,1e-8);
   for(const bird of [p,q])assert.ok(Math.min(bird.x,size-bird.x,bird.y,size-bird.y)>250,'rotation experiment must remain clear of boundary steering');
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

test('captured pointer positions beyond the viewport do not become a periodic obstacle',()=>{
 const a=setup([{x:600,y:400}]),b=setup([{x:600,y:400}]);
 a.step(1/60,quiet);
 b.step(1/60,{active:true,x:580+3*1280,y:380-4*720,vx:120,vy:40});
 assert.deepEqual(physicalState(a.birds[0]),physicalState(b.birds[0]));
});

test('birds and the mouse on opposite edges cannot steer each other',()=>{
 const state={x:20,y:400},local=setup([state]),distant=setup([state,{x:1260,y:400,vx:-2.1,vy:0}]),mouse=setup([state]);
 for(let tick=0;tick<90;tick++){
  local.step(1/60,quiet);distant.step(1/60,quiet);mouse.step(1/60,{active:true,x:1270,y:400,down:true});
  assert.deepEqual(physicalState(local.birds[0]),physicalState(distant.birds[0]));
  assert.deepEqual(physicalState(local.birds[0]),physicalState(mouse.birds[0]));
 }
});

test('ordinary flight stays on screen with continuous interpolation and short histories',()=>{
 const f=setup([{x:300,y:720,vx:2.1/Math.SQRT2,vy:2.1/Math.SQRT2}],390,844),p=f.birds[0];
 for(let tick=0;tick<900;tick++){
  f.step(1/60,quiet);
  assertOnScreen(f,p);
 }
});

test('outward flight begins a gradual boundary turn before contact',()=>{
 for(const state of [{x:850,y:400,vx:2.1,vy:0},{x:350,y:400,vx:-2.1,vy:0},{x:600,y:450,vx:0,vy:2.1},{x:600,y:350,vx:0,vy:-2.1}]){
  const f=setup([state],1200,800),p=f.birds[0],initialHeading=Math.atan2(p.vy,p.vx);
  let firstTurnClearance=null,previousHeading=initialHeading;
  for(let tick=0;tick<300;tick++){
   f.step(1/60,quiet);assertOnScreen(f,p);
   const heading=Math.atan2(p.vy,p.vx),change=Math.atan2(Math.sin(heading-previousHeading),Math.cos(heading-previousHeading));
   assert.ok(Math.abs(change)<.12,'a boundary turn must remain gradual rather than reflect the heading in one step');
   assert.ok(Math.abs(p.bank)<=.045+1e-9);
   const turned=Math.abs(Math.atan2(Math.sin(heading-initialHeading),Math.cos(heading-initialHeading)))>.04;
   if(turned&&firstTurnClearance===null)firstTurnClearance=Math.min(p.x,f.w-p.x,p.y,f.h-p.y);
   previousHeading=heading;
  }
  assert.ok(firstTurnClearance>80,'the bird must begin banking well before reaching an edge');
  assert.equal(f.boundaryContacts,0,'an ordinary approach should not need the emergency boundary guard');
 }
});

test('a held intruder cannot push birds through a corner or teleport them across the screen',()=>{
 for(const [sx,sy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){
  const width=390,height=844,x=sx===1?width-13:13,y=sy===1?height-13:13;
  const f=setup([{x,y,vx:sx*2.1/Math.SQRT2,vy:sy*2.1/Math.SQRT2}],width,height);
  for(let tick=0;tick<240;tick++){
   f.step(1/60,{active:true,down:true,x:x-sx*25,y:y-sy*25,vx:sx*800,vy:sy*800});
   assertOnScreen(f,f.birds[0]);
  }
 }
});

test('flight remains finite and bounded at wide, narrow and tiny viewport sizes',()=>{
 for(const [w,h] of [[1600,900],[390,844],[8,7]]){
  let seed=43;const f=new Flock(w,h,100,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
  for(let tick=0;tick<480;tick++){
   f.advance(1/60,{active:tick<300,x:w*.6,y:h*.5,vx:400,vy:0},2.2);
   for(const p of f.birds)assertOnScreen(f,p);
  }
 }
 const empty=new Flock(1280,720,0);assert.doesNotThrow(()=>empty.advance(1/60,quiet));
});

test('a local turn travels through the flock with a delay and retains its strength',()=>{
 // A long connected strip makes the distant cohort several neighbor hops away.
 // Matched controls retain the same constructor bank and noise states, so the
 // measured heading difference comes from the local impulse, not background motion.
 const columns=80,rows=8,count=columns*rows,cohortSize=10*rows;
 function strip(perturbed){
  let seed=123;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  // The domain is large enough that even maximum-speed travel cannot bring
  // this experiment into a boundary turn during its twelve simulated seconds.
  const f=new Flock(8000,6000,count,random);f.wanderStrength=0;
  f.birds.forEach((p,i)=>{
   const column=Math.floor(i/rows),row=i%rows;
   const heading=perturbed&&column>=columns-8?.3:0;
   Object.assign(p,{x:3000+column*10+(random()-.5)*.1,y:3000+row*10+(random()-.5)*.1,vx:2.1*Math.cos(heading),vy:2.1*Math.sin(heading),ax:0,ay:0});
   p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;
   p.history=Float64Array.from({length:16},(_,j)=>j%2?p.y:p.x);
  });
  return f;
 }
 const control=strip(false),turned=strip(true);
 const cohorts=[1,4,7].map(bin=>({start:(7-bin)*cohortSize,arrival:null,peak:0,peakTick:0,earlyPeak:0}));
 for(let tick=0;tick<=720;tick++){
  for(const cohort of cohorts){
   let cx=0,cy=0,tx=0,ty=0;
   for(let i=cohort.start;i<cohort.start+cohortSize;i++){
    const c=control.birds[i],p=turned.birds[i];cx+=c.vx;cy+=c.vy;tx+=p.vx;ty+=p.vy;
   }
   const angle=Math.atan2(ty,tx)-Math.atan2(cy,cx),response=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
   if(cohort.arrival===null&&response>=.01)cohort.arrival=tick;
   if(response>cohort.peak){cohort.peak=response;cohort.peakTick=tick}
   if(tick<=60)cohort.earlyPeak=Math.max(cohort.earlyPeak,response);
  }
  if(tick<720){control.step(1/60,quiet);turned.step(1/60,quiet)}
 }
 const [near,middle,far]=cohorts;
 assert.equal(control.boundaryContacts,0);assert.equal(turned.boundaryContacts,0);
 assert.ok(far.earlyPeak<.001,'a local disturbance must not turn the distant flock immediately');
 assert.ok(cohorts.every(c=>c.arrival!==null),'the turn must reach all three cohorts');
 assert.ok(middle.arrival>near.arrival+30&&far.arrival>middle.arrival+30,'turn arrival must be delayed across the local network');
 assert.ok(middle.peakTick>near.peakTick+30&&far.peakTick>middle.peakTick+30,'the heading crest must travel rather than occur everywhere together');
 assert.ok(far.peak>.07&&far.peak>near.peak*.4,'the distant turn must remain visible rather than diffuse away');
 assert.ok(cohorts.every(c=>c.peak<.5),'the disturbance must not grow into an unstable spin');
});
