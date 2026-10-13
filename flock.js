/* Local flocking with turning momentum, cohesion, and obstacle avoidance. */
const NeighborSearch=typeof module!=='undefined'?require('./neighbors.js'):FlockNeighbors;
function edgeApproach(distance,zone){const t=Math.max(0,Math.min(1,1-distance/zone));return t*t*(3-2*t)}
class Flock {
 constructor(width,height,count,random=Math.random){
  this.w=width;this.h=height;this.accumulator=0;this.neighborTick=0;this.birds=[];
  this.edgeInset=Math.min(12,width*.08,height*.08);this.boundaryContacts=0;
  // Angular rates use radians per nominal 1/60-second physics step.
  this.wanderStrength=.000012;
  this.neighborhood=new NeighborSearch(width,height,300);
  this.bankDegrees=new Uint16Array(count);this.bankTorques=new Float64Array(count);
  this.bankUnitX=new Float64Array(count);this.bankUnitY=new Float64Array(count);this.bankSpeeds=new Float64Array(count);
  this.bankEdgesA=new Uint32Array(count*7);this.bankEdgesB=new Uint32Array(count*7);this.bankWeights=new Float64Array(count*7);this.bankEdgeCount=0;
  for(let i=0;i<count;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random());
   const x=width*(.48+Math.cos(angle)*r*.245),y=height*(.47+Math.sin(angle)*r*.125)+Math.cos(angle)*r*height*.06;
   const heading=-.2+(random()-.5)*.12,speed=2.05+random()*.12;
   const vx=Math.cos(heading)*speed,vy=Math.sin(heading)*speed;
   this.birds.push({x,y,vx,vy,px:x,py:y,pvx:vx,pvy:vy,history:Float64Array.from({length:16},(_,j)=>j%2?y:x),nx:0,ny:0,ax:0,ay:0,bank:Math.sin(i*12.9898)*.004,nbank:0,wander:0,noiseState:(i+1)*1234567>>>0,neighbors:new Int32Array(7),neighborCount:0,a:.36+random()*.5,size:.65+random()*.45});
  }
 }

 // Pace changes elapsed simulation time; the physics step remains small.
 advance(elapsed,intruder,pace=2.2){
  this.accumulator+=Math.min(Math.max(elapsed,0),.1)*pace;
  const tick=1/60;
  while(this.accumulator+1e-10>=tick){this.step(tick,intruder);this.accumulator-=tick}
 }
 get renderAlpha(){return Math.max(0,Math.min(1,this.accumulator*60))}

 refreshBankGraph(){
  const birds=this.birds,degrees=this.bankDegrees,a=this.bankEdgesA,b=this.bankEdgesB,weights=this.bankWeights;
  degrees.fill(0);let edges=0;
  for(let i=0;i<birds.length;i++){
   const p=birds[i];
   for(let k=0;k<p.neighborCount;k++){
    const j=p.neighbors[k];
    // Keep the union of the local choices, visiting reciprocal links once.
    if(j<i){let reciprocal=false;const q=birds[j];for(let m=0;m<q.neighborCount;m++)if(q.neighbors[m]===i){reciprocal=true;break}if(reciprocal)continue}
    a[edges]=i;b[edges]=j;edges++;degrees[i]++;degrees[j]++;
   }
  }
  for(let e=0;e<edges;e++)weights[e]=1/Math.max(degrees[a[e]],degrees[b[e]]);
  this.bankEdgeCount=edges;
 }

 updateBankTorques(){
  const birds=this.birds,torques=this.bankTorques,unitX=this.bankUnitX,unitY=this.bankUnitY,speeds=this.bankSpeeds;
  torques.fill(0);
  for(let i=0;i<birds.length;i++){const p=birds[i],speed=Math.hypot(p.vx,p.vy);speeds[i]=speed;unitX[i]=p.vx/(speed||1);unitY[i]=p.vy/(speed||1)}
  for(let e=0;e<this.bankEdgeCount;e++){
   const i=this.bankEdgesA[e],j=this.bankEdgesB[e],p=birds[i],q=birds[j];
   // Symmetric local torques carry a turn without generating net group spin.
   const heading=unitX[i]*unitY[j]-unitY[i]*unitX[j];
   const torque=this.bankWeights[e]*(heading*.035+(q.bank-p.bank)*.08);
   torques[i]+=torque;torques[j]-=torque;
  }
 }

 step(dt,intruder){
  const step=Math.min(dt*60,2),birds=this.birds,inset=this.edgeInset,zone=Math.min(180,this.w*.26,this.h*.26);
  const neighborTick=this.neighborTick++;
  if(neighborTick%3===0){this.neighborhood.refresh(birds,neighborTick%6===0);this.refreshBankGraph()}
  this.updateBankTorques();
  const radius=Math.min(this.w,this.h)*.16*(intruder.down?1.3:1);
  let leadX=(intruder.vx||0)*.22,leadY=(intruder.vy||0)*.22;
  const leadScale=Math.min(1,radius*.95/(Math.hypot(leadX,leadY)||1));
  leadX*=leadScale;leadY*=leadScale;
  const leadSquared=leadX*leadX+leadY*leadY;

  for(let i=0;i<birds.length;i++){
   const p=birds[i];
   let ax=0,ay=0,separateX=0,separateY=0;
   const found=p.neighborCount;
   for(let k=0;k<found;k++){
    const q=birds[p.neighbors[k]],dx=q.x-p.x,dy=q.y-p.y;
    const distanceSquared=dx*dx+dy*dy;
    if(distanceSquared<7.8*7.8){
     const distance=Math.sqrt(distanceSquared);
     const push=(7.8-distance)/7.8/Math.max(distance,1);
     separateX-=dx*push;separateY-=dy*push;
    }
   }
   if(found){
    ax=separateX*.095;
    ay=separateY*.095;
   }
   // Cohesion primarily banks a bird toward its neighbors. Strong braking at
   // the front and acceleration at the back would squeeze a long flock into
   // a ball. Keep a little speed response so separated birds can catch up.
   let cohesionX=(p.cohesionX||0)*.00012,cohesionY=(p.cohesionY||0)*.00012;
   const speedSquared=p.vx*p.vx+p.vy*p.vy;
   if(speedSquared>1e-9){
    const along=(cohesionX*p.vx+cohesionY*p.vy)/speedSquared*.75;
    cohesionX-=p.vx*along;cohesionY-=p.vy*along;
   }
   ax+=cohesionX;ay+=cohesionY;

   let alarm=0;
   if(intruder.active){
    const offsetX=p.x-intruder.x,offsetY=p.y-intruder.y;
    const along=leadSquared>1?Math.max(0,Math.min(1,(offsetX*leadX+offsetY*leadY)/leadSquared)):0;
    const dx=offsetX-leadX*along,dy=offsetY-leadY*along,distance=Math.hypot(dx,dy);
    alarm=Math.max(0,1-distance/radius);
    const repel=alarm*alarm*(3-2*alarm)*(intruder.down?.34:.26);
    // Repel from the obstacle itself. No chosen side or desired split direction.
    if(distance>1e-9){ax+=dx/distance*repel;ay+=dy/distance*repel}
   }

   // Self-propulsion and finite acceleration model flight inertia. Repulsion
   // can brake a head-on bird instead of discarding its change in speed.
   const speed=this.bankSpeeds[i];
   p.noiseState=(Math.imul(p.noiseState,1664525)+1013904223)>>>0;
   // Slow, independent fluctuations seed local turns; no shared clock or path.
   p.wander+=(p.noiseState/4294967296-.5)*this.wanderStrength-p.wander*.018;
   const bankForce=this.bankTorques[i]-p.bank*.008+p.wander;
   p.nbank=Math.max(-.045,Math.min(.045,p.bank+bankForce*step));
   // Each bird sees the actual screen edges ahead of its own flight. The
   // resulting turn then travels through the same local neighbor network.
   const predictedX=p.x+p.vx*18,predictedY=p.y+p.vy*18;
   const left=p.vx<0?edgeApproach(predictedX-inset,zone):0,right=p.vx>0?edgeApproach(this.w-inset-predictedX,zone):0;
   const top=p.vy<0?edgeApproach(predictedY-inset,zone):0,bottom=p.vy>0?edgeApproach(this.h-inset-predictedY,zone):0;
   const normalX=left-right,normalY=top-bottom,urgency=Math.max(left,right,top,bottom);
   if(urgency>0&&speed>1e-9){
    const cross=p.vx*normalY-p.vy*normalX,dot=p.vx*normalX+p.vy*normalY;
    let angle=Math.atan2(cross,dot);
    if(Math.abs(cross)<1e-8&&dot<0){
     let nearbyBank=p.bank;
     if(Math.abs(nearbyBank)<1e-6)for(let k=0;k<found;k++)nearbyBank+=birds[p.neighbors[k]].bank;
     // Exact head-on symmetry is resolved by existing local flight state.
     const direction=nearbyBank||p.wander||((p.noiseState&1)?1:-1);
     angle=Math.sign(direction)*Math.PI;
    }
    const desiredBank=Math.max(-.045,Math.min(.045,angle*.022))*urgency;
    const wallResponse=urgency*(.18+.82*urgency*urgency);
    p.nbank+=(desiredBank-p.nbank)*wallResponse;
   }
   if(speed>1e-9){const drive=(2.1-speed)*.035;ax+=p.vx/speed*drive;ay+=p.vy/speed*drive}
   const force=Math.hypot(ax,ay),limit=.065+alarm*.18;
   if(force>limit){ax*=limit/force;ay*=limit/force}
   const response=1-Math.exp(-dt*8);
   p.ax+=(ax-p.ax)*response;p.ay+=(ay-p.ay)*response;
   const turn=p.nbank*step,cos=Math.cos(turn),sin=Math.sin(turn);
   const bankVX=p.vx*cos-p.vy*sin,bankVY=p.vx*sin+p.vy*cos;
   p.nx=bankVX+p.ax*step;p.ny=bankVY+p.ay*step;
   // Local obstacle and spacing forces impart a little retained angular momentum.
   const externalTurn=Math.atan2(bankVX*p.ny-bankVY*p.nx,bankVX*p.nx+bankVY*p.ny);
   p.nbank=Math.max(-.045,Math.min(.045,p.nbank+externalTurn*.015));
   const nextSpeed=Math.hypot(p.nx,p.ny),speedScale=Math.min(1,2.8/(nextSpeed||1));
   p.nx*=speedScale;p.ny*=speedScale;
   // Close to a wall, reserve time to finish the bank by easing just the
   // outward component. Tangential flight and inward motion remain free.
   // Clearance shrinks gradually instead of relying on a collision bounce.
   p.nx=Math.max(-Math.max(0,(p.x-inset)/18),Math.min(Math.max(0,(this.w-inset-p.x)/18),p.nx));
   p.ny=Math.max(-Math.max(0,(p.y-inset)/18),Math.min(Math.max(0,(this.h-inset-p.y)/18),p.ny));
  }

  // Commit together so neighboring birds all observe the same previous step.
  for(const p of birds){
   p.px=p.x;p.py=p.y;p.pvx=p.vx;p.pvy=p.vy;
   p.bank=p.nbank;p.vx=p.nx;p.vy=p.ny;p.x+=p.vx*step;p.y+=p.vy*step;
   // A final guard handles extreme pointer pushes and very small screens.
   // No bird is transported to another edge and no camera can extend the world.
   const maxX=this.w-inset,maxY=this.h-inset,contactsBefore=this.boundaryContacts;
   if(p.x<inset){p.x=inset;p.vx=Math.max(.2,Math.abs(p.vx)*.2);p.ax=Math.max(0,p.ax);this.boundaryContacts++}
   else if(p.x>maxX){p.x=maxX;p.vx=-Math.max(.2,Math.abs(p.vx)*.2);p.ax=Math.min(0,p.ax);this.boundaryContacts++}
   if(p.y<inset){p.y=inset;p.vy=Math.max(.2,Math.abs(p.vy)*.2);p.ay=Math.max(0,p.ay);this.boundaryContacts++}
   else if(p.y>maxY){p.y=maxY;p.vy=-Math.max(.2,Math.abs(p.vy)*.2);p.ay=Math.min(0,p.ay);this.boundaryContacts++}
   if(this.boundaryContacts!==contactsBefore){const speed=Math.hypot(p.vx,p.vy);if(speed>2.8){p.vx*=2.8/speed;p.vy*=2.8/speed}}
   p.history.copyWithin(2,0,14);p.history[0]=p.x;p.history[1]=p.y;
  }
 }
}
if(typeof module!=='undefined')module.exports=Flock;
