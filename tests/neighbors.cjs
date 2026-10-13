const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
const random=(seed=31)=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);

function checkNearest(f){
 f.refreshNeighbors();
 for(let i=0;i<f.birds.length;i++){
  const p=f.birds[i],distance=q=>{const x=q.x-p.x,y=q.y-p.y,z=q.z-p.z;return x*x+y*y+z*z};
  const expected=f.birds.filter((q,j)=>j!==i).map(distance).filter(d=>d<120*120).sort((a,b)=>a-b).slice(0,7);
  const ids=Array.from(p.neighbors.slice(0,p.neighborCount));
  assert.equal(new Set(ids).size,ids.length,'each neighbor appears once');
  assert.ok(!ids.includes(i),'a bird is not its own neighbor');
  // Equal-distance neighbors are interchangeable; compare their distances.
  assert.deepEqual(ids.map(j=>distance(f.birds[j])),expected);
 }
}

test('nearest queries remain exhaustive after reusing bounds and moving birds',()=>{
 const r=random(),f=new Flock(1280,720,160,r);checkNearest(f);
 for(const p of f.birds){p.x+=r()*60-30;p.y+=r()*60-30;p.z+=r()*20-10}
 checkNearest(f);
 // Old neighbors cease to be useful after large motion; the search must
 // still find new companions and retain its finite radius.
 for(let i=0;i<f.birds.length;i++){const p=f.birds[i];p.x=40+r()*1200;p.y=40+r()*640;p.z=5+r()*170}
 checkNearest(f);
});

test('nearest queries handle tied line distances and coincident birds',()=>{
 for(const coincident of [false,true]){
  const f=new Flock(1280,720,45,random(7));
  f.birds.forEach((p,i)=>Object.assign(p,{x:coincident?500:400+i*4,y:360,z:90}));
  checkNearest(f);checkNearest(f);
 }
});

test('nearest perception excludes birds exactly on or beyond the 3D radius',()=>{
 const f=new Flock(1280,720,6,random(9));
 const positions=[[500,360,90],[619.999,360,90],[620,360,90],[620.001,360,90],[500,480,90],[596,360,162]];
 f.birds.forEach((p,i)=>Object.assign(p,{x:positions[i][0],y:positions[i][1],z:positions[i][2]}));
 checkNearest(f);
 assert.deepEqual(Array.from(f.birds[0].neighbors.slice(0,f.birds[0].neighborCount)),[1]);
});
