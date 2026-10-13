const {test}=require('node:test');
const assert=require('node:assert/strict');
const FlockView=require('../view.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

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
 view.follow([{x:10,y:360}],1/60);
 assert.ok(Math.abs(view.vx)<30);close(view.vy,0);
 const before={x:view.x,y:view.y};view.follow([{x:400,y:300}],0);
 close(view.x,before.x);close(view.y,before.y);
});
