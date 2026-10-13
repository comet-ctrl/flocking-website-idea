/* Local separation, alignment and cohesion. No lanes or prescribed flight paths. */
class Flock {
 constructor(width,height,count,random=Math.random){
  this.w=width;this.h=height;this.time=0;this.birds=[];
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random());
   const x=width*(.48+Math.cos(angle)*r*.245),y=height*(.47+Math.sin(angle)*r*.125)+Math.cos(angle)*r*height*.06;
   const heading=-.2+(random()-.5)*.12,speed=2.05+random()*.12;
   this.birds.push({x,y,vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,nx:0,ny:0,ax:0,ay:0,a:.36+random()*.5,size:.65+random()*.45});
  }
 }
 step(dt,intruder){
  const step=Math.min(dt*60,2);this.time+=dt;
  const birds=this.birds,cell=64,grid=new Map();let cx=0,cy=0,meanVX=0,meanVY=0;
  for(let i=0;i<birds.length;i++){const p=birds[i];cx+=p.x;cy+=p.y;meanVX+=p.vx;meanVY+=p.vy;const key=Math.floor(p.x/cell)+','+Math.floor(p.y/cell);let bucket=grid.get(key);if(!bucket)grid.set(key,bucket=[]);bucket.push(i)}
  cx/=birds.length||1;cy/=birds.length||1;meanVX/=birds.length||1;meanVY/=birds.length||1;
  const ids=new Int32Array(7),distances=new Float64Array(7);
  for(let i=0;i<birds.length;i++){
   const p=birds[i],gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);let found=0;
   distances.fill(Infinity);
   for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
    const bucket=grid.get((gx+xx)+','+(gy+yy));if(!bucket)continue;
    for(const j of bucket){if(i===j)continue;const q=birds[j],dx=q.x-p.x,dy=q.y-p.y,d2=dx*dx+dy*dy;if(d2>cell*cell||d2>=distances[6])continue;
     let k=Math.min(found,6);while(k>0&&d2<distances[k-1]){if(k<7){distances[k]=distances[k-1];ids[k]=ids[k-1]}k--}distances[k]=d2;ids[k]=j;found=Math.min(7,found+1);
    }
   }
   let ax=0,ay=0,sx=0,sy=0,px=0,py=0,vx=0,vy=0;
   for(let k=0;k<found;k++){const q=birds[ids[k]];px+=q.x;py+=q.y;vx+=q.vx;vy+=q.vy;const d=Math.sqrt(distances[k]);if(d<9){const push=(9-d)/9;sx+=(p.x-q.x)/Math.max(d,1)*push;sy+=(p.y-q.y)/Math.max(d,1)*push}}
   if(found){ax+=(vx/found-p.vx)*.085+(px/found-p.x)*.0024+sx*.095;ay+=(vy/found-p.vy)*.085+(py/found-p.y)*.0024+sy*.095}
   // Gentle group cohesion bridges a split without locking birds to a path.
   const centerDistance=Math.hypot(cx-p.x,cy-p.y),gather=Math.min(.055,centerDistance*.00018);
   ax+=(cx-p.x)/Math.max(centerDistance,1)*gather+(meanVX-p.vx)*.014;
   ay+=(cy-p.y)/Math.max(centerDistance,1)*gather+(meanVY-p.vy)*.014;
   // Begin a shared bank early, before the leading birds reach the edge.
   const margin=Math.min(210,this.w*.24,this.h*.24),lookX=cx+meanVX*55,lookY=cy+meanVY*55;
   const edgeRisk=Math.max(0,(margin-lookX)/margin,(lookX-(this.w-margin))/margin,(margin-lookY)/margin,(lookY-(this.h-margin))/margin);
   const groupAngle=Math.atan2(meanVY,meanVX),inwardAngle=Math.atan2(this.h*.5-cy,this.w*.5-cx),bankDelta=Math.atan2(Math.sin(inwardAngle-groupAngle),Math.cos(inwardAngle-groupAngle));
   const bank=Math.min(1,edgeRisk*3)*.065*(bankDelta>=0?1:-1);
   ax+=-Math.sin(groupAngle)*bank;ay+=Math.cos(groupAngle)*bank;
   const edge=Math.min(220,this.w*.35,this.h*.35),edgeDistance=Math.min(p.x,this.w-p.x,p.y,this.h-p.y);
   if(edgeDistance<edge){
    const birdAngle=Math.atan2(p.vy,p.vx),homeAngle=Math.atan2(this.h*.5-p.y,this.w*.5-p.x),difference=Math.atan2(Math.sin(homeAngle-birdAngle),Math.cos(homeAngle-birdAngle));
    const urgency=Math.min(1,(edge-edgeDistance)/70),turn=Math.max(-1,Math.min(1,difference*2))*.095;
    ax=ax*(1-urgency)-Math.sin(birdAngle)*turn*urgency;
    ay=ay*(1-urgency)+Math.cos(birdAngle)*turn*urgency;
   }
   let alarm=0;
   if(intruder.active){
    const dx=p.x-intruder.x,dy=p.y-intruder.y,d=Math.hypot(dx,dy),radius=Math.min(this.w,this.h)*.16*(intruder.down?1.3:1);
    alarm=Math.max(0,1-d/radius);const ease=alarm*alarm*(3-2*alarm);
    const groupSpeed=Math.hypot(meanVX,meanVY)||1,normalX=-meanVY/groupSpeed,normalY=meanVX/groupSpeed;
    const side=dx*normalX+dy*normalY>=0?1:-1;
    // Birds on each side peel away tangentially, preserving forward flight.
    const split=ease*(intruder.down?.40:.28),radial=ease*.17;
    ax+=normalX*side*split+dx/Math.max(d,1)*radial;
    ay+=normalY*side*split+dy/Math.max(d,1)*radial;
   }
   const force=Math.hypot(ax,ay),limit=.065+alarm*.20;if(force>limit){ax*=limit/force;ay*=limit/force}
   const steeringBlend=1-Math.exp(-dt*8);p.ax+=(ax-p.ax)*steeringBlend;p.ay+=(ay-p.ay)*steeringBlend;
   let nextX=p.vx+p.ax*step,nextY=p.vy+p.ay*step;
   const heading=Math.atan2(p.vy,p.vx),desired=Math.atan2(nextY,nextX),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
   const turnLimit=(.029+alarm*.058)*step,angle=heading+Math.max(-turnLimit,Math.min(turnLimit,delta));
   const oldSpeed=Math.hypot(p.vx,p.vy),target=oldSpeed+((2.1+alarm*.65)-oldSpeed)*(1-Math.exp(-dt*2));
   nextX=Math.cos(angle);nextY=Math.sin(angle);const speed=1;
   p.nx=nextX/speed*target;p.ny=nextY/speed*target;
  }
  // Commit all velocities together, so array order cannot bias neighbors.
  for(const p of birds){p.vx=p.nx;p.vy=p.ny;p.x+=p.vx*step;p.y+=p.vy*step;
   if(p.x<2){p.x=2;}if(p.x>this.w-2){p.x=this.w-2;}if(p.y<2){p.y=2;}if(p.y>this.h-2){p.y=this.h-2;}
  }
 }
}
if(typeof module!=='undefined')module.exports=Flock;





