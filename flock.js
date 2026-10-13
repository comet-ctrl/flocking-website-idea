/* Local boids: separation, alignment, cohesion, and obstacle avoidance. */
const NeighborSearch=typeof module!=='undefined'?require('./neighbors.js'):FlockNeighbors;
function wrappedDelta(delta,extent){
 delta%=extent;
 if(delta>extent/2)return delta-extent;
 if(delta<-extent/2)return delta+extent;
 return delta;
}

class Flock {
 constructor(width,height,count,random=Math.random){
  this.w=width;this.h=height;this.accumulator=0;this.neighborTick=0;this.birds=[];
  this.neighborhood=new NeighborSearch(width,height,300);
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random());
   const x=width*(.48+Math.cos(angle)*r*.245),y=height*(.47+Math.sin(angle)*r*.125)+Math.cos(angle)*r*height*.06;
   const heading=-.2+(random()-.5)*.12,speed=2.05+random()*.12;
   const vx=Math.cos(heading)*speed,vy=Math.sin(heading)*speed;
   this.birds.push({x,y,vx,vy,px:x,py:y,pvx:vx,pvy:vy,history:Float64Array.from({length:16},(_,j)=>j%2?y:x),nx:0,ny:0,ax:0,ay:0,neighbors:new Int32Array(7),neighborCount:0,a:.36+random()*.5,size:.65+random()*.45});
  }
 }

 // Pace changes elapsed simulation time; the physics step remains small.
 advance(elapsed,intruder,pace=2.2){
  this.accumulator+=Math.min(Math.max(elapsed,0),.1)*pace;
  const tick=1/60;
  while(this.accumulator+1e-10>=tick){this.step(tick,intruder);this.accumulator-=tick}
 }
 get renderAlpha(){return Math.max(0,Math.min(1,this.accumulator*60))}

 step(dt,intruder){
  const step=Math.min(dt*60,2),birds=this.birds;
  const neighborTick=this.neighborTick++;
  if(neighborTick%3===0)this.neighborhood.refresh(birds,neighborTick%6===0);
  const radius=Math.min(this.w,this.h)*.16*(intruder.down?1.3:1);
  let leadX=(intruder.vx||0)*.22,leadY=(intruder.vy||0)*.22;
  const leadScale=Math.min(1,radius*.95/(Math.hypot(leadX,leadY)||1));
  leadX*=leadScale;leadY*=leadScale;
  const leadSquared=leadX*leadX+leadY*leadY;

  for(const p of birds){
   let ax=0,ay=0,separateX=0,separateY=0,velocityX=0,velocityY=0;
   const found=p.neighborCount;
   for(let k=0;k<found;k++){
    const q=birds[p.neighbors[k]],dx=wrappedDelta(q.x-p.x,this.w),dy=wrappedDelta(q.y-p.y,this.h);
    velocityX+=q.vx;velocityY+=q.vy;
    const distance=Math.hypot(dx,dy);
    if(distance<7.8){
     const push=(7.8-distance)/7.8/Math.max(distance,1);
     separateX-=dx*push;separateY-=dy*push;
    }
   }
   if(found){
    ax=(velocityX/found-p.vx)*.115+separateX*.095;
    ay=(velocityY/found-p.vy)*.115+separateY*.095;
   }
   // See beyond the closest few birds for cohesion, preserving social contact
   // across the flock without a global center or a prescribed formation.
   ax+=(p.cohesionX||0)*.0003;ay+=(p.cohesionY||0)*.0003;

   let alarm=0;
   if(intruder.active){
    const offsetX=wrappedDelta(p.x-intruder.x,this.w),offsetY=wrappedDelta(p.y-intruder.y,this.h);
    const along=leadSquared>1?Math.max(0,Math.min(1,(offsetX*leadX+offsetY*leadY)/leadSquared)):0;
    const dx=offsetX-leadX*along,dy=offsetY-leadY*along,distance=Math.hypot(dx,dy);
    alarm=Math.max(0,1-distance/radius);
    const repel=alarm*alarm*(3-2*alarm)*(intruder.down?.34:.26);
    // Repel from the obstacle itself. No chosen side or desired split direction.
    if(distance>1e-9){ax+=dx/distance*repel;ay+=dy/distance*repel}
   }

   // Self-propulsion and finite acceleration model flight inertia. Repulsion
   // can brake a head-on bird instead of discarding its change in speed.
   const speed=Math.hypot(p.vx,p.vy);
   if(speed>1e-9){const drive=(2.1-speed)*.035;ax+=p.vx/speed*drive;ay+=p.vy/speed*drive}
   const force=Math.hypot(ax,ay),limit=.065+alarm*.18;
   if(force>limit){ax*=limit/force;ay*=limit/force}
   const response=1-Math.exp(-dt*8);
   p.ax+=(ax-p.ax)*response;p.ay+=(ay-p.ay)*response;
   p.nx=p.vx+p.ax*step;p.ny=p.vy+p.ay*step;
   const nextSpeed=Math.hypot(p.nx,p.ny),speedScale=Math.min(1,2.8/(nextSpeed||1));
   p.nx*=speedScale;p.ny*=speedScale;
  }

  // Commit together so neighboring birds all observe the same previous step.
  for(const p of birds){
   p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;
   p.vx=p.nx;p.vy=p.ny;p.x+=p.vx*step;p.y+=p.vy*step;
   // A repeating world has no walls, global steering, or center attraction.
   const shiftX=Math.floor(p.x/this.w)*this.w,shiftY=Math.floor(p.y/this.h)*this.h;
   p.x-=shiftX;p.y-=shiftY;p.px-=shiftX;p.py-=shiftY;
   if(shiftX||shiftY)for(let k=0;k<p.history.length;k+=2){p.history[k]-=shiftX;p.history[k+1]-=shiftY}
   p.history.copyWithin(2,0,14);p.history[0]=p.x;p.history[1]=p.y;
  }
 }
}
if(typeof module!=='undefined')module.exports=Flock;
