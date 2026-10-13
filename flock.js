/* Local separation, alignment and cohesion. No lanes or prescribed flight paths. */
// Near cells first: a tight seventh-neighbor distance prunes the remaining cells.
const SEARCH_OFFSETS=[];
for(let y=-10;y<=10;y++)for(let x=-10;x<=10;x++)SEARCH_OFFSETS.push([x,y,x*x+y*y]);
SEARCH_OFFSETS.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
class Flock {
 constructor(width,height,count,random=Math.random){
  this.w=width;this.h=height;this.time=0;this.accumulator=0;this.neighborTick=0;this.bank=0;this.bankSide=1;this.birds=[];
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random());
   const x=width*(.48+Math.cos(angle)*r*.245),y=height*(.47+Math.sin(angle)*r*.125)+Math.cos(angle)*r*height*.06;
   const heading=-.2+(random()-.5)*.12,speed=2.05+random()*.12;
   this.birds.push({x,y,vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,px:x,py:y,pvx:Math.cos(heading)*speed,pvy:Math.sin(heading)*speed,history:Float64Array.from({length:16},(_,j)=>j%2?y:x),stress:0,nx:0,ny:0,ax:0,ay:0,neighbors:new Int32Array(7),neighborCount:0,a:.36+random()*.5,size:.65+random()*.45});
  }
 }
 // Scale simulation time, not just velocity: preserve turning and avoidance.
 // Small fixed steps make normal 30/60/120 Hz rendering use the same physics.
 advance(elapsed,intruder,pace=2.2){
  this.accumulator+=Math.min(Math.max(elapsed,0),.1)*pace;
  const tick=1/60;
  while(this.accumulator+1e-10>=tick){this.step(tick,intruder);this.accumulator-=tick}
 }
 get renderAlpha(){return Math.max(0,Math.min(1,this.accumulator*60))}
 step(dt,intruder){
  const step=Math.min(dt*60,2);this.time+=dt;
  // Reuse neighbor identities for three ticks; forces use current positions each tick.
  const refreshNeighbors=this.neighborTick++%3===0;
  const birds=this.birds,cell=16,grid=new Map();let cx=0,cy=0,meanVX=0,meanVY=0;
  for(let i=0;i<birds.length;i++){const p=birds[i];cx+=p.x;cy+=p.y;meanVX+=p.vx;meanVY+=p.vy;if(!refreshNeighbors)continue;const key=Math.floor(p.x/cell)+','+Math.floor(p.y/cell);let bucket=grid.get(key);if(!bucket)grid.set(key,bucket=[]);bucket.push(i)}
  cx/=birds.length||1;cy/=birds.length||1;meanVX/=birds.length||1;meanVY/=birds.length||1;
  const radius=Math.min(this.w,this.h)*.16*(intruder.down?1.3:1);
  // A short swept corridor ahead of the arrow, shrinking when it stops.
  let leadX=(intruder.vx||0)*.22,leadY=(intruder.vy||0)*.22;
  const leadScale=Math.min(1,radius*.95/(Math.hypot(leadX,leadY)||1));leadX*=leadScale;leadY*=leadScale;
  const leadSquared=leadX*leadX+leadY*leadY;
  // One gently changing group bank. Smaller screens use a shorter look-ahead.
  const viewScale=Math.max(.45,Math.min(1,Math.min(this.w,this.h)/720));
  const margin=Math.min(220,this.w*.25,this.h*.25),lookX=cx+meanVX*85*viewScale,lookY=cy+meanVY*85*viewScale;
  const edgeRisk=Math.max(0,(margin-lookX)/margin,(lookX-(this.w-margin))/margin,(margin-lookY)/margin,(lookY-(this.h-margin))/margin);
  const groupAngle=Math.atan2(meanVY,meanVX),inwardAngle=Math.atan2(this.h*.5-cy,this.w*.5-cx),bankDelta=Math.atan2(Math.sin(inwardAngle-groupAngle),Math.cos(inwardAngle-groupAngle));
  if(edgeRisk<.05)this.bankSide=bankDelta>=0?1:-1;
  const bankTarget=Math.min(1,edgeRisk*2)*.06*this.bankSide;
  this.bank+=(bankTarget-this.bank)*(1-Math.exp(-dt*3));
  const distances=new Float64Array(7);
  for(let i=0;i<birds.length;i++){
   const p=birds[i],gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);const ids=p.neighbors;let found=p.neighborCount;
   if(refreshNeighbors){found=0;
   const search=(radius)=>{
    found=0;distances.fill(Infinity);let cutoff=(radius/cell+Math.SQRT2)**2;
    for(const [xx,yy,r2] of SEARCH_OFFSETS){
     // sqrt(2) cells bounds the position uncertainty inside the two cells.
     if(r2>cutoff)break;
     const bx=(gx+xx)*cell,by=(gy+yy)*cell;
     const minX=Math.max(bx-p.x,0,p.x-bx-cell),minY=Math.max(by-p.y,0,p.y-by-cell);
     if(minX*minX+minY*minY>Math.min(radius*radius,distances[6]))continue;
     const bucket=grid.get((gx+xx)+','+(gy+yy));if(!bucket)continue;
     for(const j of bucket){if(i===j)continue;const q=birds[j],dx=q.x-p.x,dy=q.y-p.y,d2=dx*dx+dy*dy;if(d2>radius*radius||d2>distances[6])continue;
      // Match the original 64 px grid's tie order as well as its nearest seven.
      const before=(other)=>{const r=birds[other];return Math.floor(q.y/64)-Math.floor(r.y/64)||Math.floor(q.x/64)-Math.floor(r.x/64)||j-other};
      if(found===7&&d2===distances[6]&&before(ids[6])>=0)continue;
      let k=Math.min(found,6);while(k>0&&(d2<distances[k-1]||(d2===distances[k-1]&&before(ids[k-1])<0))){distances[k]=distances[k-1];ids[k]=ids[k-1];k--}distances[k]=d2;ids[k]=j;found=Math.min(7,found+1);
     }
     cutoff=(Math.sqrt(Math.min(radius*radius,distances[6]))/cell+Math.SQRT2)**2;
    }
   };
   search(64);if(found<4)search(160);
   p.neighborCount=found;}
   let ax=0,ay=0,sx=0,sy=0,px=0,py=0,vx=0,vy=0;
   for(let k=0;k<found;k++){const q=birds[ids[k]];px+=q.x;py+=q.y;vx+=q.vx;vy+=q.vy;const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<7.8){const push=(7.8-d)/7.8;sx+=(p.x-q.x)/Math.max(d,1)*push;sy+=(p.y-q.y)/Math.max(d,1)*push}}
   if(found){
    const flowSpeed=Math.hypot(vx,vy)||1,fx=vx/flowSpeed,fy=vy/flowSpeed,dx=px/found-p.x,dy=py/found-p.y,along=dx*fx+dy*fy;
    // Close sideways gaps while leaving room along each stream to bank and split.
    ax+=(vx/found-p.vx)*.115+dx*.004-fx*along*.0022+sx*.095;
    ay+=(vy/found-p.vy)*.115+dy*.004-fy*along*.0022+sy*.095;
   }
   // Gentle group cohesion bridges a split without locking birds to a path.
   const centerDistance=Math.hypot(cx-p.x,cy-p.y),rejoin=1-p.stress*.35,gather=Math.min(found<3?.06:.036,centerDistance*.00013)*rejoin;
   ax+=(cx-p.x)/Math.max(centerDistance,1)*gather+(meanVX-p.vx)*.014*rejoin;
   ay+=(cy-p.y)/Math.max(centerDistance,1)*gather+(meanVY-p.vy)*.014*rejoin;
   ax+=-Math.sin(groupAngle)*this.bank;ay+=Math.cos(groupAngle)*this.bank;
   const edge=Math.min(210,this.w*.28,this.h*.28),lookAhead=85*viewScale,edgeDistance=Math.min(p.x+p.vx*lookAhead,this.w-p.x-p.vx*lookAhead,p.y+p.vy*lookAhead,this.h-p.y-p.vy*lookAhead);
   if(edgeDistance<edge){
    const birdAngle=Math.atan2(p.vy,p.vx),homeAngle=Math.atan2(this.h*.5-p.y,this.w*.5-p.x),difference=Math.atan2(Math.sin(homeAngle-birdAngle),Math.cos(homeAngle-birdAngle));
    // Begin a shallow turn early, always taking the shorter route inward.
    // Forcing every bird to the group's side can trap birds against an edge.
    const turnSide=difference>=0?1:-1;
    const proximity=Math.max(0,Math.min(1,(edge-edgeDistance)/edge)),urgency=Math.sqrt(proximity),turn=turnSide*Math.min(1,Math.abs(difference)*2)*.095;
    ax=ax*(1-urgency)-Math.sin(birdAngle)*turn*urgency;
    ay=ay*(1-urgency)+Math.cos(birdAngle)*turn*urgency;
   }
   let alarm=0;
   p.evadeTime=Math.max(0,(p.evadeTime||0)-dt);
   if(intruder.active){
    const offsetX=p.x-intruder.x,offsetY=p.y-intruder.y;
    const along=leadSquared>1?Math.max(0,Math.min(1,(offsetX*leadX+offsetY*leadY)/leadSquared)):0;
    const dx=offsetX-leadX*along,dy=offsetY-leadY*along,d=Math.hypot(dx,dy);
    alarm=Math.max(0,1-d/radius);const ease=alarm*alarm*(3-2*alarm);
    // Local headings keep each stream coherent even after the group splits.
    const flowX=found?vx/found:meanVX,flowY=found?vy/found:meanVY;
    const groupSpeed=Math.hypot(flowX,flowY)||1,normalX=-flowY/groupSpeed,normalY=flowX/groupSpeed;
    if(alarm>.03){if(!p.evadeTime)p.evadeSide=dx*normalX+dy*normalY>=0?1:-1;p.evadeTime=.45}
    const side=p.evadeSide||(dx*normalX+dy*normalY>=0?1:-1);
    // Birds on each side peel away tangentially, preserving forward flight.
    const split=ease*(intruder.down?.32:.22),radial=ease*.07;
    ax+=normalX*side*split+dx/Math.max(d,1)*radial;
    ay+=normalY*side*split+dy/Math.max(d,1)*radial;
   }
   // Relax global attraction after a scare; local neighbors still hold each stream.
   const stressTarget=alarm>.03?1:0;p.stress+=(stressTarget-p.stress)*(1-Math.exp(-dt*(stressTarget?12:.65)));
   const force=Math.hypot(ax,ay),limit=.065+alarm*.14;if(force>limit){ax*=limit/force;ay*=limit/force}
   const steeringBlend=1-Math.exp(-dt*8);p.ax+=(ax-p.ax)*steeringBlend;p.ay+=(ay-p.ay)*steeringBlend;
   let nextX=p.vx+p.ax*step,nextY=p.vy+p.ay*step;
   const heading=Math.atan2(p.vy,p.vx),desired=Math.atan2(nextY,nextX),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
   const turnLimit=(.029+alarm*.035)*step,angle=heading+Math.max(-turnLimit,Math.min(turnLimit,delta));
   // A modest escape burst keeps startled birds from outrunning their stream.
   const oldSpeed=Math.hypot(p.vx,p.vy),target=oldSpeed+((2.1+alarm*.45)-oldSpeed)*(1-Math.exp(-dt*2));
   nextX=Math.cos(angle);nextY=Math.sin(angle);const speed=1;
   p.nx=nextX/speed*target;p.ny=nextY/speed*target;
  }
  // Commit all velocities together, so array order cannot bias neighbors.
  for(const p of birds){p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;p.vx=p.nx;p.vy=p.ny;p.x+=p.vx*step;p.y+=p.vy*step;
   if(p.x<2){p.x=2;}if(p.x>this.w-2){p.x=this.w-2;}if(p.y<2){p.y=2;}if(p.y>this.h-2){p.y=this.h-2;}
   p.history.copyWithin(2,0,14);p.history[0]=p.x;p.history[1]=p.y;
  }
 }
}
if(typeof module!=='undefined')module.exports=Flock;
