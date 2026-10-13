const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const bloom=document.createElement('canvas'),bloomCtx=bloom.getContext('2d');
let w=innerWidth,h=innerHeight,dpr=1,particles=[],paused=false,last=0,time=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse={x:w*.72,y:h*.65,tx:w*.72,ty:h*.65,vx:0,vy:0,angle:.45,active:false,down:false};
const pace=2.2;
let flock,background,poses,tones,visualDepth,frozenScene,tail=[];
function resize(){
 w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 background=ctx.createRadialGradient(w*.48,h*.47,0,w*.48,h*.47,Math.max(w,h)*.67);
 background.addColorStop(0,'#10151d');background.addColorStop(.55,'#0b1016');background.addColorStop(1,'#05080b');
 // A quarter-resolution light layer gives a soft halo without per-bird blur.
 bloom.width=Math.ceil(w/4);bloom.height=Math.ceil(h/4);bloomCtx.setTransform(bloom.width/w,0,0,bloom.height/h,0,0);
 mouse.x=Math.max(0,Math.min(w,mouse.x));mouse.y=Math.max(0,Math.min(h,mouse.y));mouse.tx=Math.max(0,Math.min(w,mouse.tx));mouse.ty=Math.max(0,Math.min(h,mouse.ty));
 seed();
}
function seed(){
 flock?.destroy();flock=new FlockRunner(w,h,Math.min(2200,Math.max(1100,Math.floor(w*h/330))));particles=flock.birds;
 poses=new Float32Array(particles.length*6);tones=Uint8Array.from(particles,p=>Math.min(3,Math.floor((p.a-.36)*8)));tail=[];
 visualDepth=Float32Array.from(particles,p=>p.z/flock.depth);
 frozenScene=paused?captureScene():null;
}
// A pending worker reply must not move the flock while paused.
function captureScene(){return {birds:particles.map(p=>({...p,history:p.history.slice()})),age:flock.renderAgeTicks,depth:flock.depth}}
function move(e){mouse.tx=e.clientX;mouse.ty=e.clientY;mouse.active=true;if(paused)draw(0)}
canvas.addEventListener('pointermove',move);
canvas.addEventListener('pointerdown',e=>{move(e);mouse.down=true;canvas.setPointerCapture(e.pointerId)});
window.addEventListener('pointerup',()=>mouse.down=false);
canvas.addEventListener('pointercancel',()=>mouse.down=false);
canvas.addEventListener('pointerleave',()=>{if(!mouse.down)mouse.active=false});
window.addEventListener('blur',()=>{mouse.down=false;mouse.active=false});

function drawBirds(dt){
 const particles=frozenScene?.birds||flock.birds,age=frozenScene?.age??flock.renderAgeTicks,depthScale=frozenScene?.depth??flock.depth;
 const i=Math.floor(age),j=Math.min(15,i+1),mix=age-i;
 const k=Math.min(14,i),l=Math.min(14,j),alpha=1-Math.min(1,age);
 const depthGain=dt?1-Math.exp(-dt*8):1;
 // Calculate each pose once, then reuse it in a few batched drawing passes.
 for(let n=0;n<particles.length;n++){
  const p=particles[n],a=p.history,b=n*6;
  const x=a[i*2]+(a[j*2]-a[i*2])*mix,y=a[i*2+1]+(a[j*2+1]-a[i*2+1])*mix;
  let vx=(a[k*2]-a[k*2+2])*(1-mix)+(a[l*2]-a[l*2+2])*mix,vy=(a[k*2+1]-a[k*2+3])*(1-mix)+(a[l*2+1]-a[l*2+3])*mix;
  if(Math.hypot(vx,vy)<.001){vx=p.vx;vy=p.vy}
  const speed=Math.hypot(vx,vy)||1,depth=(p.pz+(p.z-p.pz)*alpha)/depthScale;
  visualDepth[n]+=(Math.max(0,Math.min(1,depth))-visualDepth[n])*depthGain;
  const length=(2.2+speed*2.05)*(.86+p.size*.32)*(.88+depth*.24),dx=vx/speed*length,dy=vy/speed*length;
  poses[b]=x;poses[b+1]=y;poses[b+2]=x-dx;poses[b+3]=y-dy;poses[b+4]=x-dx*.34;poses[b+5]=y-dy*.34;
 }
 bloomCtx.clearRect(0,0,w,h);bloomCtx.beginPath();bloomCtx.lineCap='round';
 for(let b=0;b<poses.length;b+=6){bloomCtx.moveTo(poses[b],poses[b+1]);bloomCtx.lineTo(poses[b+2],poses[b+3])}
 bloomCtx.strokeStyle='rgba(197,214,232,.18)';bloomCtx.lineWidth=4.2;bloomCtx.stroke();
 ctx.drawImage(bloom,0,0,w,h);
 // A short, dim wake uses actual flight history and fades behind the body.
 const tailAge=Math.min(15,age+.038*60*pace),ti=Math.floor(tailAge),tj=Math.min(15,ti+1),tm=tailAge-ti;
 ctx.lineCap='round';ctx.beginPath();
 for(let n=0;n<particles.length;n++){
  const a=particles[n].history,b=n*6;
  ctx.moveTo(poses[b+2],poses[b+3]);ctx.lineTo(a[ti*2]+(a[tj*2]-a[ti*2])*tm,a[ti*2+1]+(a[tj*2+1]-a[ti*2+1])*tm);
 }
 ctx.strokeStyle='rgba(189,208,228,.075)';ctx.lineWidth=.65;ctx.stroke();
 // Fixed brightness bands avoid flicker. Fine white tips taper the silver marks.
 for(let band=0;band<4;band++){
  ctx.beginPath();
  for(let n=0;n<particles.length;n++){if(tones[n]!==band)continue;const b=n*6;ctx.moveTo(poses[b],poses[b+1]);ctx.lineTo(poses[b+2],poses[b+3])}
  ctx.strokeStyle=`rgba(221,232,242,${.42+band*.14})`;ctx.lineWidth=.72+band*.105;ctx.stroke();
 }
 for(let band=0;band<2;band++){
  ctx.beginPath();
  for(let n=0;n<particles.length;n++){if((tones[n]>>1)!==band)continue;const b=n*6;ctx.moveTo(poses[b],poses[b+1]);ctx.lineTo(poses[b+4],poses[b+5])}
  ctx.strokeStyle=`rgba(249,251,255,${.48+band*.24})`;ctx.lineWidth=.72+band*.12;ctx.stroke();
 }
 // Permanent subtle wings on a stable subset; no extra particles or forces.
 ctx.beginPath();ctx.lineCap='butt';
 for(let n=0;n<particles.length;n+=4){
  const near=Math.max(0,Math.min(1,(visualDepth[n]-.35)/.45)),amount=near*near*(3-2*near);if(amount<.035)continue;
  const b=n*6,dx=poses[b]-poses[b+2],dy=poses[b+1]-poses[b+3],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  const x=poses[b]-dx*.25,y=poses[b+1]-dy*.25,span=amount*(3.2+.7*Math.sin(time*5+n*1.7));
  ctx.moveTo(x-uy*span-ux*1.3,y+ux*span-uy*1.3);ctx.quadraticCurveTo(x-uy*span*.45+ux,y+ux*span*.45+uy,x,y);
  ctx.quadraticCurveTo(x+uy*span*.45+ux,y-ux*span*.45+uy,x+uy*span-ux*1.3,y-ux*span-uy*1.3);
 }
 ctx.strokeStyle='rgba(233,242,252,.65)';ctx.lineWidth=.75;ctx.stroke();
 // Rose light spills from the arrow onto nearby birds, fading with distance.
 const radius=Math.min(180,Math.min(w,h)*.28),r2=radius*radius;
 ctx.beginPath();ctx.lineCap='butt';
 for(let b=0;b<poses.length;b+=6){
  const dx=poses[b]-mouse.x,dy=poses[b+1]-mouse.y,falloff=Math.max(0,1-(dx*dx+dy*dy)/r2),amount=falloff*falloff;if(amount<.015)continue;
  ctx.moveTo(poses[b],poses[b+1]);ctx.lineTo(poses[b]+(poses[b+2]-poses[b])*amount,poses[b+1]+(poses[b+3]-poses[b+1])*amount);
 }
 ctx.strokeStyle='rgba(255,116,148,.9)';ctx.lineWidth=1.5;ctx.stroke();
 ctx.lineCap='round';
}
function drawArrow(dt){
 // Trail lifetime is measured in seconds, independent of frame rate.
 if(dt||!tail.length)tail.unshift({x:mouse.x,y:mouse.y,t:time});
 while(tail.length>1&&time-tail[tail.length-1].t>.22)tail.pop();
 if(tail.length>32)tail.length=32;
 if(tail.length>1){
  const end=tail[tail.length-1],fade=ctx.createLinearGradient(end.x,end.y,mouse.x,mouse.y);
  fade.addColorStop(0,'rgba(237,80,113,0)');fade.addColorStop(1,'rgba(237,80,113,.18)');
  ctx.strokeStyle=fade;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(end.x,end.y);
  for(let i=tail.length-2;i>=0;i--)ctx.lineTo(tail[i].x,tail[i].y);ctx.stroke();
 }
 ctx.save();ctx.translate(mouse.x,mouse.y);ctx.rotate(mouse.angle);ctx.lineJoin='round';
 const length=Math.min(320,w*.27,100+w*.13+Math.hypot(mouse.vx,mouse.vy)*.04);
 const fade=ctx.createLinearGradient(-length,0,0,0);
 fade.addColorStop(0,'rgba(236,76,109,0)');fade.addColorStop(.45,'rgba(236,76,109,.2)');fade.addColorStop(1,'rgba(255,137,158,.9)');
 ctx.shadowColor='#f04e73';ctx.shadowBlur=7;ctx.strokeStyle=fade;ctx.lineWidth=1.25;
 ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,0);ctx.stroke();
 ctx.strokeStyle='#ff96ac';ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(-16,-6.5);ctx.lineTo(0,0);ctx.lineTo(-16,6.5);ctx.stroke();ctx.restore();
}
function draw(dt){
 time+=dt;
 const dx=mouse.tx-mouse.x,dy=mouse.ty-mouse.y,blend=1-Math.pow(.00001,Math.max(dt,.016));mouse.x+=dx*blend;mouse.y+=dy*blend;
 // Arrow velocity anticipates the same local danger zone; flight rules are unchanged.
 if(dt>0){const gain=1-Math.exp(-dt*18),rawX=dx*blend/dt,rawY=dy*blend/dt,cap=Math.min(1,1400/(Math.hypot(rawX,rawY)||1));mouse.vx+=(rawX*cap-mouse.vx)*gain;mouse.vy+=(rawY*cap-mouse.vy)*gain}else{mouse.vx=0;mouse.vy=0}
 if(Math.hypot(dx,dy)>.2){const target=Math.atan2(dy,dx);mouse.angle+=Math.atan2(Math.sin(target-mouse.angle),Math.cos(target-mouse.angle))*.22}
 if(dt)flock.advance(dt,mouse,pace);
 paint(dt);
}
function paint(dt){
 ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
 drawBirds(dt);drawArrow(dt);
}
function loop(now){const dt=last?Math.min((now-last)/1000,.1):.016;last=now;if(!paused&&!document.hidden)draw(dt);requestAnimationFrame(loop)}
function pause(){paused=!paused;frozenScene=paused?captureScene():null;if(paused)paint(0)}
document.addEventListener('visibilitychange',()=>{last=0;flock.resetClock();mouse.vx=0;mouse.vy=0});
window.addEventListener('keydown',e=>{
 if(e.code==='Space'&&!e.repeat){e.preventDefault();pause()}
});
window.addEventListener('resize',resize);resize();draw(.016);if(reduced)pause();requestAnimationFrame(loop);
