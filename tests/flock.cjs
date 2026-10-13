const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
test('optimized neighbor search agrees with an exhaustive search in sparse and dense flocks',()=>{
 let seed=19;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const cases=[
  Array.from({length:350},()=>({x:180+random()*850,y:120+random()*480})),
  Array.from({length:350},()=>({x:600+random()*90,y:320+random()*90})),
  // Equal-distance ties, exact radius boundaries, and almost-adjacent grid cells.
  [{x:640,y:352},...[[-64,0],[64,0],[0,-64],[0,64],[-160,0],[160,0],[0,-160],[0,160],[64.0001,0],[160.0001,0],[-.0001,-.0001],[.0001,.0001]].map(([dx,dy])=>({x:640+dx,y:352+dy}))]
 ];
 for(const positions of cases){
  const f=new Flock(1280,720,positions.length,random);
  f.birds.forEach((p,i)=>Object.assign(p,positions[i]));
  for(let tick=0;tick<7;tick++){
   const refresh=f.neighborTick%3===0,snapshot=f.birds.map(({x,y})=>({x,y}));
   f.step(1/60,{active:false});
   if(!refresh)continue;
   f.birds.forEach((p,i)=>{
    const origin=snapshot[i],all=snapshot.map((q,j)=>({j,q,d2:(q.x-origin.x)**2+(q.y-origin.y)**2})).filter(q=>q.j!==i);
    const nearby=all.filter(q=>q.d2<=64*64),radius=nearby.length<4?160:64;
    const expected=all.filter(q=>q.d2<=radius*radius).sort((a,b)=>a.d2-b.d2||Math.floor(a.q.y/64)-Math.floor(b.q.y/64)||Math.floor(a.q.x/64)-Math.floor(b.q.x/64)||a.j-b.j).slice(0,7).map(q=>q.j);
    assert.deepEqual(Array.from(p.neighbors.slice(0,p.neighborCount)),expected,`bird ${i}, tick ${tick}`);
   });
  }
 }
});

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
test('fixed-step flock remains identical at 30, 60 and 120 Hz at both supported fast speeds',()=>{
 function run(hz,pace){let seed=1;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const f=new Flock(1200,800,100,random);
  for(let i=0;i<hz*2;i++)f.advance(1/hz,{active:true,x:600,y:400,vx:500,vy:100},pace);
  return f.birds.map(p=>[p.x,p.y,p.vx,p.vy]);
 }
 for(const pace of [1.8,2.2]){const expected=run(60,pace);assert.deepEqual(run(30,pace),expected);assert.deepEqual(run(120,pace),expected)}
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
test('flock remains finite with wide and narrow viewport scales',()=>{
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
test('flock travels and banks inside a stationary wide or narrow viewport',()=>{
 for(const [w,h] of [[1280,720],[390,844]]){
  let seed=23;const f=new Flock(w,h,150,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
  const center=()=>[f.birds.reduce((s,p)=>s+p.x,0)/150,f.birds.reduce((s,p)=>s+p.y,0)/150];
  const initial=center();let distance=0,headingChange=0;
  for(let tick=0;tick<300;tick++){
   f.advance(1/60,{active:false},2.2);
   const [cx,cy]=center();distance=Math.max(distance,Math.hypot(cx-initial[0],cy-initial[1]));
   const heading=Math.atan2(f.birds.reduce((s,p)=>s+p.vy,0),f.birds.reduce((s,p)=>s+p.vx,0));
   headingChange=Math.max(headingChange,Math.abs(Math.atan2(Math.sin(heading+.2),Math.cos(heading+.2))));
   assert.ok(f.birds.every(p=>p.x>=2&&p.x<=w-2&&p.y>=2&&p.y<=h-2));
  }
  assert.ok(distance>Math.min(w,h)*.12,`flock did not travel: ${distance}`);
  assert.ok(headingChange>Math.PI/6,`flock did not bank: ${headingChange}`);
 }
});
test('birds on opposite sides peel apart while maintaining forward flight',()=>{
 function sample(active){const f=new Flock(1280,720,2,()=>.5);
  f.birds.forEach((p,i)=>Object.assign(p,{x:580,y:360+(i?18:-18),vx:2.1,vy:0}));
  for(let i=0;i<8;i++)f.step(1/60,{active,x:620,y:360,vx:0,vy:0});
  return f.birds;
 }
 const quiet=sample(false),split=sample(true);
 assert.ok(split[0].vy<quiet[0].vy);assert.ok(split[1].vy>quiet[1].vy);
 assert.ok(split.every(p=>p.vx>1.9));
});
test('an intruder changes nearby birds before its turn propagates through the flock',()=>{
 function setup(){
  let seed=37;const f=new Flock(1280,720,100,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
  f.birds.forEach((p,i)=>Object.assign(p,{x:(i<50?300:850)+(i%10)*5,y:330+Math.floor((i%50)/10)*5,vx:2.1,vy:0}));
  return f;
 }
 const quiet=setup(),alarmed=setup();
 quiet.step(1/60,{active:false});alarmed.step(1/60,{active:true,x:335,y:340,vx:0,vy:0});
 assert.ok(alarmed.birds.slice(0,50).some((p,i)=>Math.hypot(p.vx-quiet.birds[i].vx,p.vy-quiet.birds[i].vy)>.001));
 alarmed.birds.slice(50).forEach((p,i)=>{
  assert.equal(p.vx,quiet.birds[i+50].vx);assert.equal(p.vy,quiet.birds[i+50].vy);
 });
});

test('a centered mouse pass keeps at least 99% of birds connected',()=>{
 let seed=7;const n=1400,f=new Flock(1280,720,n,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
 for(let k=0;k<300;k++){
  const cx=f.birds.reduce((sum,p)=>sum+p.x,0)/n,cy=f.birds.reduce((sum,p)=>sum+p.y,0)/n,t=k/60;
  f.advance(1/60,{active:t>2&&t<4,x:cx+(t-3)*400,y:cy,vx:400,vy:0},2.2);
 }
 let loose=0;
 for(let i=0;i<n;i++){let neighbors=0;
  for(let j=0;j<n&&neighbors<3;j++)if(i!==j&&Math.hypot(f.birds[i].x-f.birds[j].x,f.birds[i].y-f.birds[j].y)<40)neighbors++;
  if(neighbors<3)loose++;
 }
 // Local flocking allows a few stragglers; do not force every bird into a ribbon.
 assert.ok(loose/n<=.01,`isolated birds after pass: ${loose}/${n}`);
});

test('the flock regroups after a mouse pass instead of leaving detached schools',()=>{
 for(const initialSeed of [7,19,37]){
  let seed=initialSeed;const n=1400,f=new Flock(1280,720,n,()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296));
  // Two seconds of flight, a two-second crossing, then four seconds to regroup.
  for(let k=0;k<480;k++){
   const cx=f.birds.reduce((sum,p)=>sum+p.x,0)/n,cy=f.birds.reduce((sum,p)=>sum+p.y,0)/n,t=k/60;
   f.advance(1/60,{active:t>2&&t<4,x:cx+(t-3)*400,y:cy,vx:400,vy:0},2.2);
  }
  // Count whole connected groups: a detached school can have plenty of neighbors
  // and would pass an isolated-bird check despite being a visible offshoot.
  const parents=Int32Array.from({length:n},(_,i)=>i);
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i};
  for(let i=0;i<n;i++)for(let j=0;j<i;j++){
   const dx=f.birds[i].x-f.birds[j].x,dy=f.birds[i].y-f.birds[j].y;
   if(dx*dx+dy*dy<40*40)parents[root(i)]=root(j);
  }
  const sizes=new Map();let largest=0;
  for(let i=0;i<n;i++){const group=root(i),size=(sizes.get(group)||0)+1;sizes.set(group,size);largest=Math.max(largest,size)}
  // Allow natural small strands while requiring most birds to rejoin one flock.
  assert.ok(largest/n>.9,`seed ${initialSeed}: largest recovered group ${largest}/${n}`);
 }
});
