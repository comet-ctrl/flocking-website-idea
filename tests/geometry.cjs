const {test}=require('node:test');
const assert=require('node:assert/strict');
const Flock=require('../flock.js');
function random(seed=31){return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)}
function checkCohesion(f){
 f.refreshCohesion();
 for(const p of f.birds){
  let x=0,y=0,z=0,total=0;
  for(const q of f.birds){if(p===q)continue;const dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z;
   const weight=Math.max(0,1-(dx*dx+dy*dy+dz*dz)/(f.socialRadius*f.socialRadius));
   x+=dx*weight;y+=dy*weight;z+=dz*weight;total+=weight;
  }
  for(const [actual,expected] of [[p.cohesionX,total?x/total:0],[p.cohesionY,total?y/total:0],[p.cohesionZ,total?z/total:0]]){
   assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != exhaustive result ${expected}`);
  }
 }
}
test('3D cell moments agree with exhaustive attraction in full and cut cells',()=>{
 const r=random(),f=new Flock(1200,800,400,r);
 for(const p of f.birds){p.x=100+r()*800;p.y=100+r()*600;p.z=5+r()*170}
 checkCohesion(f);
});
test('partial cells at every screen and depth edge preserve the same local force',()=>{
 for(const [w,h] of [[390,844],[103,97],[8,7]]){
  const r=random(7),f=new Flock(w,h,70,r);
  for(let i=0;i<f.birds.length;i++){const p=f.birds[i];p.x=i<8?(i&1?w:0):r()*w;p.y=i<8?(i&2?h:0):r()*h;p.z=i<8?(i&4?180:0):r()*180}
  checkCohesion(f);
 }
});
test('social perception has a finite distance cutoff, with no opposite-edge shortcut',()=>{
 const f=new Flock(2000,1000,4,()=>.5),positions=[[500,500,90],[800,500,90],[801,500,90],[1900,500,90]];
 f.birds.forEach((p,i)=>Object.assign(p,{x:positions[i][0],y:positions[i][1],z:positions[i][2]}));
 f.refreshCohesion();assert.equal(f.birds[0].cohesionX,0);assert.equal(f.birds[0].cohesionY,0);assert.equal(f.birds[0].cohesionZ,0);
});
test('local angular exchanges add no artificial net group spin',()=>{
 const r=random(19),f=new Flock(1600,1200,100,r);
 for(const p of f.birds){p.x=700+r()*100;p.y=500+r()*100;p.z=50+r()*80;p.vx=r()*2-1;p.vy=r()*2-1;p.vz=r()*2-1;p.ox=r()*.01;p.oy=r()*.01;p.oz=r()*.01}
 f.step(1/60,{active:false});
 for(const component of [f.torqueX,f.torqueY,f.torqueZ])assert.ok(Math.abs(component.reduce((a,b)=>a+b,0))<1e-12);
});
test('an isolated bird has zero cohesion and an empty flock is supported',()=>{
 const f=new Flock(1280,562,1,random());checkCohesion(f);assert.equal(f.birds[0].cohesionX,0);
 const empty=new Flock(1280,562,0);assert.doesNotThrow(()=>empty.advance(1/60,{active:false},2.2));
});
