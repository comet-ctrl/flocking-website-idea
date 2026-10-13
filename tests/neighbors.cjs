const {test}=require('node:test');
const assert=require('node:assert/strict');
const FlockNeighbors=require('../neighbors.js');

function check(width,height,positions){
 const birds=positions.map(p=>({...p,neighbors:new Int32Array(7),neighborCount:0}));
 const search=new FlockNeighbors(width,height);
 search.refresh(birds);
 const wrap=(value,size)=>(value%size+size)%size;
 for(let i=0;i<birds.length;i++){
  const p=birds[i],x=wrap(p.x,width),y=wrap(p.y,height);
  const expected=birds.map((q,j)=>{
   const dx=Math.abs(wrap(q.x,width)-x),dy=Math.abs(wrap(q.y,height)-y);
   return {j,d2:Math.min(dx,width-dx)**2+Math.min(dy,height-dy)**2};
  }).filter(q=>q.j!==i&&q.d2<=64*64).sort((a,b)=>a.d2-b.d2||a.j-b.j).slice(0,7).map(q=>q.j);
  const actual=Array.from(p.neighbors.slice(0,p.neighborCount));
  assert.deepEqual(actual,expected,`${width} × ${height}, bird ${i}`);
  assert.equal(new Set(actual).size,actual.length,'wrapped cells must not repeat a bird');
 }
 return {search,birds};
}

test('periodic search agrees with exhaustive distances for sparse and dense flocks',()=>{
 let seed=19;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(const [w,h] of [[1280,720],[390,844],[997,563],[47,23],[8,7]]){
  for(const dense of [false,true]){
   const positions=Array.from({length:350},()=>({x:random()*w*(dense?.06:1),y:random()*h*(dense?.06:1)}));
   check(w,h,positions);
   check(w,h,positions.map(p=>({x:p.x+w*3.2,y:p.y-h*2.7})));
  }
 }
});

test('seams, exact radius boundaries and distance ties return each nearest bird once',()=>{
 for(const [w,h] of [[1280,720],[390,844],[47,23]]){
  const points=[{x:0,y:0},{x:w-1,y:h-1},{x:1,y:1},{x:w,y:h},{x:-1,y:-1}];
  for(const [dx,dy] of [[64,0],[-64,0],[0,64],[0,-64],[64.0001,0],[-64.0001,0],[16,16],[-16,-16]])points.push({x:dx,y:dy});
  check(w,h,points);
 }
});

test('a refresh clears stale grid entries and supports an empty or resized flock',()=>{
 const search=new FlockNeighbors(390,844);
 const birds=[{x:1,y:1},{x:389,y:843}].map(p=>({...p,neighbors:new Int32Array(7)}));
 search.refresh(birds);assert.equal(birds[0].neighborCount,1);
 birds[1].x=195;birds[1].y=422;
 search.refresh(birds);assert.equal(birds[0].neighborCount,0);assert.equal(birds[1].neighborCount,0);
 search.refresh([]);search.refresh(birds.slice(0,1));assert.equal(birds[0].neighborCount,0);
});

test('birds outside 64 pixels are not recruited to enforce regrouping',()=>{
 const {birds}=check(1280,720,[{x:200,y:200},{x:265,y:200},{x:310,y:200},{x:350,y:200}]);
 assert.equal(birds[0].neighborCount,0);
});

function checkCohesion(width,height,positions,radius=120){
 const birds=positions.map(p=>({...p,neighbors:new Int32Array(7)})),search=new FlockNeighbors(width,height,radius);
 search.refresh(birds);
 const wrap=(value,size)=>(value%size+size)%size;
 for(let i=0;i<birds.length;i++){
  const p=birds[i],x=wrap(p.x,width),y=wrap(p.y,height);
  let sx=0,sy=0,total=0;
  for(let j=0;j<birds.length;j++){
   if(i===j)continue;
   let dx=wrap(birds[j].x,width)-x,dy=wrap(birds[j].y,height)-y;
   if(dx>width/2)dx-=width;else if(dx<-width/2)dx+=width;
   if(dy>height/2)dy-=height;else if(dy<-height/2)dy+=height;
   const distance=Math.hypot(dx,dy);
   if(distance>=radius)continue;
   const weight=(1-(distance/radius)**2)**2;
   sx+=dx*weight;sy+=dy*weight;total+=weight;
  }
  const ex=total>1e-9?sx/total:0,ey=total>1e-9?sy/total:0;
  assert.ok(Math.abs(p.cohesionX-ex)<1e-8,`cohesion x ${width}×${height}, bird${i}: ${p.cohesionX} vs ${ex}`);
  assert.ok(Math.abs(p.cohesionY-ey)<1e-8,`cohesion y ${width}×${height}, bird${i}: ${p.cohesionY} vs ${ey}`);
 }
 return {search,birds};
}

test('weighted wider cohesion matches independent all-pairs calculation',()=>{
 let seed=194;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(const [w,h] of [[1280,720],[390,844],[997,563],[47,23],[8,7]])for(const radius of [120,240,300]){
  for(const dense of [false,true]){
   const positions=Array.from({length:180},()=>({x:random()*w*(dense?.09:1),y:random()*h*(dense?.09:1)}));
   checkCohesion(w,h,positions,radius);
   checkCohesion(w,h,positions.map(p=>({x:p.x+w*3.2,y:p.y-h*2.7})),radius);
  }
 }
});

test('wider cohesion uses unique periodic neighbors and smoothly vanishes at its radius',()=>{
 for(const [w,h] of [[1280,720],[390,844],[47,23]]){
  const points=[{x:0,y:0},{x:w-1,y:h-1},{x:1,y:1},{x:w,y:h},{x:-1,y:-1}];
  for(const [dx,dy] of [[120,0],[-120,0],[0,120],[0,-120],[119.9999,0],[120.0001,0],[64,64],[-64,-64]])points.push({x:dx,y:dy});
  checkCohesion(w,h,points);
 }
 const {birds}=checkCohesion(1280,720,[{x:200,y:200},{x:300,y:200},{x:600,y:200}]);
 assert.ok(birds[0].cohesionX>0);assert.equal(birds[2].cohesionX,0);
});

test('cohesion moments clear after movement and an isolated bird has no self attraction',()=>{
 const {search,birds}=checkCohesion(1280,720,[{x:301.333,y:355.71},{x:325,y:360}]);
 birds[1].x=800;search.refresh(birds);
 for(const bird of birds){assert.equal(bird.cohesionX,0);assert.equal(bird.cohesionY,0)}
 search.refresh([]);search.refresh(birds.slice(0,1));
 assert.equal(birds[0].cohesionX,0);assert.equal(birds[0].cohesionY,0);
});

test('fast neighbor refresh retains cached broad cohesion until its next refresh',()=>{
 const {search,birds}=checkCohesion(1280,720,[{x:200,y:200},{x:230,y:210}],300);
 const previous=birds.map(p=>[p.cohesionX,p.cohesionY]);
 birds[1].x=750;
 search.refresh(birds,false);
 birds.forEach((p,i)=>{assert.equal(p.neighborCount,0);assert.deepEqual([p.cohesionX,p.cohesionY],previous[i])});
 search.refresh(birds,true);
 birds.forEach(p=>assert.deepEqual([p.cohesionX,p.cohesionY],[0,0]));
 const resized=[...birds,{x:225,y:210,neighbors:new Int32Array(7)}];
 search.refresh(resized,false);
 assert.ok(Number.isFinite(resized[2].cohesionX)&&Number.isFinite(resized[2].cohesionY));
});
