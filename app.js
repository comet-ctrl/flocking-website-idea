const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
let w=innerWidth,h=innerHeight,dpr=1,particles=[],paused=false,demo=false,hidden=false,last=0,time=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse={x:w*.72,y:h*.65,tx:w*.72,ty:h*.65,angle:.45,active:false,down:false};
let tail=[];
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);seed()}
let flock;
function seed(){flock=new Flock(w,h,Math.min(2400,Math.max(850,Math.floor(w*h/450))));particles=flock.birds;tail=[]}
function move(e){mouse.tx=e.clientX;mouse.ty=e.clientY;mouse.active=true;if(paused)draw(0)}
canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',e=>{move(e);mouse.down=true;canvas.setPointerCapture(e.pointerId)});window.addEventListener('pointerup',()=>mouse.down=false);canvas.addEventListener('pointercancel',()=>mouse.down=false);canvas.addEventListener('pointerleave',()=>{if(!mouse.down)mouse.active=false});window.addEventListener('blur',()=>{mouse.down=false;mouse.active=false});
function draw(dt){
 time+=dt;ctx.fillStyle='#080b11';ctx.fillRect(0,0,w,h);
 const bg=ctx.createRadialGradient(w*.45,h*.45,0,w*.45,h*.45,w*.7);bg.addColorStop(0,'#101823');bg.addColorStop(1,'#080b11');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 if(demo&&!mouse.active&&!paused){mouse.tx=w*(.58+.24*Math.sin(time*.18));mouse.ty=h*(.51+.22*Math.sin(time*.27+.8))}
 const dx=mouse.tx-mouse.x,dy=mouse.ty-mouse.y;const blend=1-Math.pow(.00001,Math.max(dt,.016));mouse.x+=dx*blend;mouse.y+=dy*blend;
 if(Math.hypot(dx,dy)>.2){const target=Math.atan2(dy,dx);mouse.angle+=Math.atan2(Math.sin(target-mouse.angle),Math.cos(target-mouse.angle))*.22}
 if(dt)flock.step(dt,{...mouse,active:mouse.active||demo});
 for(const p of particles){
  const speed=Math.hypot(p.vx,p.vy)||1;const len=Math.min(13,2.8+speed*2.2);ctx.strokeStyle=`rgba(218,233,246,${p.a})`;ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx/speed*len,p.y-p.vy/speed*len);ctx.stroke();
 }
 if(dt||!tail.length){tail.unshift({x:mouse.x,y:mouse.y});if(tail.length>48)tail.pop()}
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#ff4169';ctx.shadowBlur=12;
 for(let i=tail.length-1;i>0;i--){ctx.strokeStyle=`rgba(255,78,114,${(1-i/tail.length)*.52})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(tail[i].x,tail[i].y);ctx.lineTo(tail[i-1].x,tail[i-1].y);ctx.stroke()}
 ctx.translate(mouse.x,mouse.y);ctx.rotate(mouse.angle);const length=Math.min(180,70+Math.hypot(dx,dy)*.7);const grad=ctx.createLinearGradient(-length,0,0,0);grad.addColorStop(0,'#ff527000');grad.addColorStop(1,'#ff8298');ctx.strokeStyle=grad;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,0);ctx.stroke();ctx.strokeStyle='#ff8298';ctx.beginPath();ctx.moveTo(-21,-10);ctx.lineTo(0,0);ctx.lineTo(-21,10);ctx.stroke();ctx.restore();
}
function loop(now){const dt=last?Math.min((now-last)/1000,.033):.016;last=now;if(!paused)draw(dt);requestAnimationFrame(loop)}
function pause(){paused=!paused;document.querySelector('#pause').textContent=paused?'Resume':'Pause';document.querySelector('#pause').setAttribute('aria-pressed',paused)}
document.querySelector('#pause').onclick=pause;document.querySelector('#mode').onclick=e=>{demo=!demo;e.target.setAttribute('aria-pressed',demo);e.target.textContent=demo?'Demo: on':'Demo intruder'};document.querySelector('#reset').onclick=()=>{seed();draw(0)};
document.querySelector('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{document.querySelector('#full').textContent='Unavailable'}};
document.addEventListener('fullscreenchange',()=>document.querySelector('#full').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen');
window.addEventListener('keydown',e=>{if(e.target.matches('button,input'))return;if(e.code==='Space'){e.preventDefault();pause()}if(e.key.toLowerCase()==='h'){hidden=!hidden;document.querySelector('header').style.visibility=hidden?'hidden':'visible';document.querySelector('.controls').style.visibility=hidden?'hidden':'visible'}});
window.addEventListener('resize',resize);resize();draw(.016);if(reduced)pause();requestAnimationFrame(loop);



