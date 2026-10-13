const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
let w=innerWidth,h=innerHeight,dpr=1,particles=[],paused=false,demo=false,hidden=false,last=0,time=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse={x:w*.72,y:h*.65,tx:w*.72,ty:h*.65,vx:0,vy:0,angle:.45,active:false,down:false};
let tail=[];
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);background=ctx.createRadialGradient(w*.45,h*.45,0,w*.45,h*.45,w*.7);background.addColorStop(0,'#101823');background.addColorStop(1,'#080b11');seed()}
let flock,pace=2.2,background;
function seed(){flock=new Flock(w,h,Math.min(3200,Math.max(1100,Math.floor(w*h/330))));particles=flock.birds;tail=[]}
function move(e){mouse.tx=e.clientX;mouse.ty=e.clientY;mouse.active=true;if(paused)draw(0)}
canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',e=>{move(e);mouse.down=true;canvas.setPointerCapture(e.pointerId)});window.addEventListener('pointerup',()=>mouse.down=false);canvas.addEventListener('pointercancel',()=>mouse.down=false);canvas.addEventListener('pointerleave',()=>{if(!mouse.down)mouse.active=false});window.addEventListener('blur',()=>{mouse.down=false;mouse.active=false});
// Draw the visible parts of a short segment on both sides of a wrapping edge.
function wrappedLine(x1,y1,x2,y2){
 ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
 const shiftX=Math.min(x1,x2)<0?w:Math.max(x1,x2)>w?-w:0;
 const shiftY=Math.min(y1,y2)<0?h:Math.max(y1,y2)>h?-h:0;
 if(shiftX){ctx.moveTo(x1+shiftX,y1);ctx.lineTo(x2+shiftX,y2)}
 if(shiftY){ctx.moveTo(x1,y1+shiftY);ctx.lineTo(x2,y2+shiftY)}
 if(shiftX&&shiftY){ctx.moveTo(x1+shiftX,y1+shiftY);ctx.lineTo(x2+shiftX,y2+shiftY)}
}
function draw(dt){
 time+=dt;ctx.fillStyle='#080b11';ctx.fillRect(0,0,w,h);
 ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
 if(demo&&!mouse.active&&!paused){mouse.tx=w*(.58+.24*Math.sin(time*.18));mouse.ty=h*(.51+.22*Math.sin(time*.27+.8))}
 const dx=mouse.tx-mouse.x,dy=mouse.ty-mouse.y;const blend=1-Math.pow(.00001,Math.max(dt,.016));mouse.x+=dx*blend;mouse.y+=dy*blend;
 // Measure the visible arrow in CSS pixels per real second. Smooth and cap
 // velocity so a sudden pointer jump cannot project danger across the screen.
 if(dt>0){const gain=1-Math.exp(-dt*18),rawX=dx*blend/dt,rawY=dy*blend/dt,cap=Math.min(1,1400/(Math.hypot(rawX,rawY)||1));mouse.vx+=(rawX*cap-mouse.vx)*gain;mouse.vy+=(rawY*cap-mouse.vy)*gain}else{mouse.vx=0;mouse.vy=0}
 if(Math.hypot(dx,dy)>.2){const target=Math.atan2(dy,dx);mouse.angle+=Math.atan2(Math.sin(target-mouse.angle),Math.cos(target-mouse.angle))*.22}
 // A fixed view keeps the flock's forward flight visible.
 if(dt)flock.advance(dt,{...mouse,active:mouse.active||demo},pace);
 // Blend physics poses and batch similar silver strokes into four draw calls.
 const alpha=flock.renderAlpha;
 for(let band=0;band<4;band++){
  ctx.strokeStyle=`rgba(232,238,245,${.43+band*.14})`;ctx.lineWidth=.72+band*.13;ctx.beginPath();
  for(const p of particles){if(Math.min(3,Math.floor((p.a-.36)*8))!==band)continue;
   const x=p.px+(p.x-p.px)*alpha,y=p.py+(p.y-p.py)*alpha;
   const vx=p.pvx+(p.vx-p.pvx)*alpha,vy=p.pvy+(p.vy-p.pvy)*alpha,speed=Math.hypot(vx,vy)||1,len=1.6+speed*1.45;
   wrappedLine(x,y,x-vx/speed*len,y-vy/speed*len);
  }ctx.stroke();
 }
 // Faint 30 ms paths from actual past positions, not accumulated canvas blur.
 // Real-time duration keeps trail lengths consistent across refresh rates.
 for(let segment=0;segment<3;segment++){
  ctx.strokeStyle=`rgba(205,222,240,${.08-segment*.025})`;ctx.lineWidth=.65;ctx.beginPath();
  for(const p of particles){
   let startX=0,startY=0;
   for(let end=0;end<2;end++){
    const age=Math.min(7,1-alpha+(segment+end)*.01*60*pace),i=Math.floor(age),j=Math.min(7,i+1),mix=age-i;
    const x=p.history[i*2]+(p.history[j*2]-p.history[i*2])*mix,y=p.history[i*2+1]+(p.history[j*2+1]-p.history[i*2+1])*mix;
    if(end)wrappedLine(startX,startY,x,y);else{startX=x;startY=y}
   }
  }ctx.stroke();
 }
 if(dt||!tail.length){tail.unshift({x:mouse.x,y:mouse.y});if(tail.length>48)tail.pop()}
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#ff4169';ctx.shadowBlur=12;
 for(let i=tail.length-1;i>0;i--){ctx.strokeStyle=`rgba(255,78,114,${(1-i/tail.length)*.52})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(tail[i].x,tail[i].y);ctx.lineTo(tail[i-1].x,tail[i-1].y);ctx.stroke()}
 ctx.translate(mouse.x,mouse.y);ctx.rotate(mouse.angle);const length=Math.min(180,70+Math.hypot(dx,dy)*.7);const grad=ctx.createLinearGradient(-length,0,0,0);grad.addColorStop(0,'#ff527000');grad.addColorStop(1,'#ff8298');ctx.strokeStyle=grad;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,0);ctx.stroke();ctx.strokeStyle='#ff8298';ctx.beginPath();ctx.moveTo(-21,-10);ctx.lineTo(0,0);ctx.lineTo(-21,10);ctx.stroke();ctx.restore();
}
function loop(now){const dt=last?Math.min((now-last)/1000,.1):.016;last=now;if(!paused&&!document.hidden)draw(dt);requestAnimationFrame(loop)}
function pause(){paused=!paused;document.querySelector('#pause').textContent=paused?'Resume':'Pause';document.querySelector('#pause').setAttribute('aria-pressed',paused)}
document.querySelector('#speed').onchange=e=>{pace=Number(e.target.value)};
document.addEventListener('visibilitychange',()=>{last=0;flock.accumulator=0;mouse.vx=0;mouse.vy=0});
document.querySelector('#pause').onclick=pause;document.querySelector('#mode').onclick=e=>{demo=!demo;e.target.setAttribute('aria-pressed',demo);e.target.textContent=demo?'Demo: on':'Demo intruder'};document.querySelector('#reset').onclick=()=>{seed();draw(0)};
document.querySelector('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{document.querySelector('#full').textContent='Unavailable'}};
document.addEventListener('fullscreenchange',()=>document.querySelector('#full').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen');
window.addEventListener('keydown',e=>{if(e.target.matches('button,input,select'))return;if(e.code==='Space'){e.preventDefault();pause()}if(e.key.toLowerCase()==='h'){hidden=!hidden;document.querySelector('header').style.visibility=hidden?'hidden':'visible';document.querySelector('.controls').style.visibility=hidden?'hidden':'visible'}});
window.addEventListener('resize',resize);resize();draw(.016);if(reduced)pause();requestAnimationFrame(loop);
