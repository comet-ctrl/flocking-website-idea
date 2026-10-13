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

test('a visible flock that already fits is not reframed around a different periodic arc',()=>{
 const view=new FlockView(1280,720);view.x=640;view.y=360;
 view.follow([{x:140,y:360},{x:1140,y:360}],1/60);
 close(view.x,640);close(view.y,360);close(view.vx,0);close(view.vy,0);
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
 // The unique largest gap is 200 px across the seam; the covering arc is
 // genuinely 1080 px wide, exceeding the 1075.2 px padded viewport.
 view.follow([100,280,460,640,820,1000,1180].map(x=>({x,y:360})),1/60);
 close(view.x,640);close(view.y,360);close(view.w,1280);close(view.h,720);
});

test('a compact flock opposite the camera is not mistaken for a screen-wide flock',()=>{
 const view=new FlockView(1280,720);view.x=640;view.y=360;
 const birds=[{x:10,y:10},{x:1270,y:710}],before=structuredClone(birds);
 const initial={x:view.x,y:view.y};
 view.follow(birds,1/60);
 assert.ok(view.x!==initial.x&&view.y!==initial.y,'both seam crossings must trigger a correction');
 assert.ok(Math.abs(view.delta(view.x-initial.x,1280))<20);
 assert.ok(Math.abs(view.delta(view.y-initial.y,720))<20);
 // Edge correction remains eased, so crossing the last few pixels of the
 // display seam can take another frame rather than snapping the camera.
 view.follow(birds,1/60);view.follow(birds,1/60);
 close(Math.abs(view.screenX(10)-view.screenX(1270)),20);
 close(Math.abs(view.screenY(10)-view.screenY(710)),20);
 for(let tick=0;tick<180;tick++)view.follow(birds,1/60);
 for(const p of birds){
  assert.ok(view.screenX(p.x)>=1280*.08-1e-7&&view.screenX(p.x)<=1280*.92+1e-7);
  assert.ok(view.screenY(p.y)>=720*.08-1e-7&&view.screenY(p.y)<=720*.92+1e-7);
  close(view.delta(view.worldX(view.screenX(p.x))-p.x,1280),0);
  close(view.delta(view.worldY(view.screenY(p.y))-p.y,720),0);
 }
 assert.deepEqual(birds,before);
 close(view.w,1280);close(view.h,720);
});

test('covering-arc selection is independent of bird order and equivalent wrapped positions',()=>{
 const a=new FlockView(1280,720),b=new FlockView(1280,720);
 a.x=b.x=640;a.y=b.y=360;
 const birds=[{x:1270,y:705},{x:4,y:9},{x:12,y:15},{x:1265,y:711}];
 const translated=birds.toReversed().map(p=>({x:p.x+3*1280,y:p.y-4*720}));
 for(let tick=0;tick<180;tick++){
  a.follow(birds,1/60);b.follow(translated,1/60);
  close(a.x,b.x);close(a.y,b.y);close(a.vx,b.vx);close(a.vy,b.vy);
 }
});

test('repeated arc measurement reuses buffers and supports changing flock size',()=>{
 const view=new FlockView(1280,720),birds=[{x:10,y:10},{x:1270,y:710}];
 view.follow(birds,1/60);const xs=view.axisX,ys=view.axisY;
 view.follow(birds,1/60);assert.equal(view.axisX,xs);assert.equal(view.axisY,ys);
 view.follow([],1/60);close(view.vx,0);close(view.vy,0);
 view.follow(birds.slice(0,1),1/60);assert.equal(view.axisX.length,1);assert.equal(view.axisY.length,1);
 assert.ok([view.x,view.y,view.vx,view.vy].every(Number.isFinite));
});

test('a nearly full-axis flock does not make the camera chase changing tiny gaps',()=>{
 const view=new FlockView(1280,720);view.x=640;view.y=200;
 const birds=Array.from({length:120},(_,i)=>({x:640,y:i*6}));
 for(let frame=0;frame<120;frame++){
  // Each frame changes which small empty gap is largest.
  birds.forEach((p,i)=>{p.y=i*6+Math.sin(i*.73+frame*.21)*.6});
  view.follow(birds,1/60);
  close(view.x,640);close(view.y,200);close(view.vx,0);close(view.vy,0);
 }
 // An intermediate gap remains too ambiguous to resume following; this is
 // deliberately between the separate close and reopen thresholds.
 const intermediate=Array.from({length:65},(_,i)=>({x:640,y:100+i*10}));
 view.follow(intermediate,1/60);close(view.y,200);close(view.vy,0);
 // Once a genuinely compact flock exists again, ordinary edge following resumes.
 view.follow([{x:640,y:530},{x:640,y:550}],1/60);
 assert.ok(view.y>200);assert.ok(view.vy>0);
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
