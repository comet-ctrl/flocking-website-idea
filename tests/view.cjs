const {test}=require('node:test');
const assert=require('node:assert/strict');
const FlockView=require('../view.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('the view stays fixed while a flock travels within its padding',()=>{
 const view=new FlockView(1280,720),initial={x:view.x,y:view.y};
 for(let tick=0;tick<90;tick++){
  const birds=[{x:initial.x-160+tick*2,y:initial.y-40},{x:initial.x+100+tick*2,y:initial.y+40}];
  view.follow(birds,1/60);
  close(view.x,initial.x);close(view.y,initial.y);close(view.vx,0);close(view.vy,0);
 }
});

test('an edge violation pans only toward the violated side without recentering',()=>{
 for(const side of [-1,1]){
  const view=new FlockView(1280,720),initial={x:view.x,y:view.y},overshoot=60;
  const edgeX=initial.x+side*(1280*.42+overshoot);
  view.follow([{x:edgeX,y:initial.y},{x:initial.x,y:initial.y}],1/60);
  const moved=view.delta(view.x-initial.x,1280);
  close(moved,side*overshoot*(1-Math.exp(-8/60)));close(view.y,initial.y);
  assert.ok(Math.abs(moved)<overshoot,'pan must not overshoot the minimum correction');
  close(view.vx,moved*60);close(view.vy,0);
  // Once the visible flock fits, stop at the new view rather than returning
  // to the middle or carrying the prior camera velocity into mouse prediction.
  const stopped={x:view.x,y:view.y};
  view.follow([{x:initial.x,y:initial.y}],1/60);
  close(view.x,stopped.x);close(view.y,stopped.y);close(view.vx,0);close(view.vy,0);
 }
});

test('bounds too wide for the padding are framed symmetrically without zoom',()=>{
 const view=new FlockView(1280,720);view.x=640;view.y=360;
 view.follow([{x:20,y:360},{x:1260,y:360}],1/60);
 close(view.x,640);close(view.y,360);close(view.w,1280);close(view.h,720);
});

test('a flock crossing the physical seam stays together on screen',()=>{
 const view=new FlockView(1280,720);view.x=1278;view.y=360;
 const birds=[{x:1260,y:355},{x:1278,y:360},{x:12,y:365}];
 const before=structuredClone(birds);
 view.follow(birds,1/60);
 const xs=birds.map(p=>view.screenX(p.x));
 assert.ok(Math.max(...xs)-Math.min(...xs)<40);
 assert.deepEqual(birds,before,'camera must not change simulation positions');
});

test('pointer coordinates map to the displayed bird through camera movement and wrapping',()=>{
 const view=new FlockView(1280,720);
 for(const [x,y] of [[1279,719],[0,0],[640,360]]){
  view.x=x;view.y=y;
  for(const [sx,sy] of [[10,10],[640,360],[1270,710]]){
   close(view.screenX(view.worldX(sx)),sx);close(view.screenY(view.worldY(sy)),sy);
  }
 }
});

test('the camera crosses a seam smoothly without a viewport-sized velocity spike',()=>{
 const view=new FlockView(1280,720);view.x=1279;view.y=360;
 // The rightmost bird is beyond the safe area even though its world position
 // has wrapped. The small camera correction crosses the same physical seam.
 const beforeX=view.x;
 view.follow([{x:610,y:360}],1/60);
 const moved=view.delta(view.x-beforeX,1280);
 assert.ok(moved>0&&moved<20);assert.ok(view.x<20);
 close(view.vx,moved*60);close(view.vy,0);
 const before={x:view.x,y:view.y};view.follow([{x:400,y:300}],0);
 close(view.x,before.x);close(view.y,before.y);close(view.vx,0);close(view.vy,0);
});
