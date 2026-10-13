/* Local flocking in XYZ. Screen XY is the entire visible world. */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v)};
class Flock{
 constructor(w,h,count,random=Math.random){
  this.w=w;this.h=h;this.depth=180;this.accumulator=0;this.tick=0;this.birds=[];this.wanderStrength=.000004;
  this.edgeInset=Math.min(12,w*.08,h*.08);this.contacts=0;
  this.cell=18;this.cols=Math.ceil(w/this.cell);this.rows=Math.ceil(h/this.cell);this.layers=Math.ceil(this.depth/this.cell);
  this.heads=new Int32Array(this.cols*this.rows*this.layers);this.next=new Int32Array(count);
  this.offsets=[];
  const reach=Math.ceil(120/this.cell);
  for(let z=-reach;z<=reach;z++)for(let y=-reach;y<=reach;y++)for(let x=-reach;x<=reach;x++){
   const a=Math.max(0,Math.abs(x)-1)*this.cell,b=Math.max(0,Math.abs(y)-1)*this.cell,c=Math.max(0,Math.abs(z)-1)*this.cell;
   if(a*a+b*b+c*c<=120*120)this.offsets.push({x,y,z,d:a*a+b*b+c*c});
  }
  this.offsets.sort((a,b)=>a.d-b.d);
  this.distances=new Float64Array(7);this.degrees=new Uint16Array(count);
  this.edgeA=new Uint32Array(count*7);this.edgeB=new Uint32Array(count*7);this.edgeWeight=new Float64Array(count*7);this.edgeCount=0;
  this.torqueX=new Float64Array(count);this.torqueY=new Float64Array(count);this.torqueZ=new Float64Array(count);
  this.unitX=new Float64Array(count);this.unitY=new Float64Array(count);this.unitZ=new Float64Array(count);this.speeds=new Float64Array(count);
  this.socialCell=96;this.socialCols=Math.ceil(w/this.socialCell);this.socialRows=Math.ceil(h/this.socialCell);this.socialLayers=Math.ceil(this.depth/this.socialCell);
  const socialCount=this.socialCols*this.socialRows*this.socialLayers;
  this.socialMoments=new Float64Array(socialCount*13);this.socialHeads=new Int32Array(socialCount);this.socialNext=new Int32Array(count);
  this.socialOccupied=new Int32Array(socialCount);this.socialRadius=300;
  this.socialCenterX=new Float64Array(socialCount);this.socialCenterY=new Float64Array(socialCount);this.socialCenterZ=new Float64Array(socialCount);
  for(let cell=0;cell<socialCount;cell++){
   this.socialCenterX[cell]=((cell%this.socialCols)+.5)*this.socialCell;
   this.socialCenterY[cell]=((Math.floor(cell/this.socialCols)%this.socialRows)+.5)*this.socialCell;
   this.socialCenterZ[cell]=(Math.floor(cell/(this.socialCols*this.socialRows))+.5)*this.socialCell;
  }
  for(let i=0;i<count;i++){
   const azimuth=random()*Math.PI*2,vertical=random()*2-1,ring=Math.sqrt(1-vertical*vertical),r=Math.cbrt(random());
   const x=w*.46+Math.cos(azimuth)*ring*r*w*.21,y=h*.5+Math.sin(azimuth)*ring*r*h*.16,z=this.depth*.5+vertical*r*this.depth*.43;
   const yaw=-.18+(random()-.5)*.1,pitch=(random()-.5)*.22,speed=2.05+random()*.1;
   const vx=Math.cos(yaw)*Math.cos(pitch)*speed,vy=Math.sin(yaw)*Math.cos(pitch)*speed,vz=Math.sin(pitch)*speed;
   this.birds.push({x,y,z,vx,vy,vz,px:x,py:y,pz:z,pvx:vx,pvy:vy,pvz:vz,nx:0,ny:0,nz:0,ax:0,ay:0,az:0,
    ox:(random()-.5)*.001,oy:(random()-.5)*.001,oz:(random()-.5)*.003,nox:0,noy:0,noz:0,
    wx:0,wy:0,wz:0,noiseState:(i+1)*1234567>>>0,neighbors:new Int32Array(7),neighborCount:0,socialCell:0,cohesionX:0,cohesionY:0,cohesionZ:0,
    history:Float64Array.from({length:32},(_,j)=>j%2?y:x),a:.36+random()*.5,size:.7+random()*.5});
  }
 }
 advance(elapsed,intruder,pace=2.2){this.accumulator+=clamp(elapsed,0,.1)*pace;while(this.accumulator+1e-10>=1/60){this.step(1/60,intruder);this.accumulator-=1/60}}
 get renderAlpha(){return clamp(this.accumulator*60,0,1)}
 refreshNeighbors(){
  const b=this.birds,c=this.cell,cols=this.cols,rows=this.rows,layers=this.layers,heads=this.heads,next=this.next,dist=this.distances;
  heads.fill(-1);
  for(let i=0;i<b.length;i++){
   const p=b[i],x=clamp(Math.floor(p.x/c),0,cols-1),y=clamp(Math.floor(p.y/c),0,rows-1),z=clamp(Math.floor(p.z/c),0,layers-1),at=(z*rows+y)*cols+x;
   next[i]=heads[at];heads[at]=i;
  }
  for(let i=0;i<b.length;i++){
   const p=b[i],gx=clamp(Math.floor(p.x/c),0,cols-1),gy=clamp(Math.floor(p.y/c),0,rows-1),gz=clamp(Math.floor(p.z/c),0,layers-1);
   let count=0,cutoff=120*120;dist.fill(Infinity);
   for(const offset of this.offsets){
    if(offset.d>cutoff)break;
    const x=gx+offset.x,y=gy+offset.y,z=gz+offset.z;
    if(x<0||y<0||z<0||x>=cols||y>=rows||z>=layers)continue;
    const head=heads[(z*rows+y)*cols+x];if(head===-1)continue;
    const cx=Math.max(0,Math.abs((x+.5)*c-p.x)-c*.5),cy=Math.max(0,Math.abs((y+.5)*c-p.y)-c*.5),cz=Math.max(0,Math.abs((z+.5)*c-p.z)-c*.5);
    if(cx*cx+cy*cy+cz*cz>cutoff)continue;
    for(let j=head;j!==-1;j=next[j]){
     if(i===j)continue;const q=b[j],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d2=dx*dx+dy*dy+dz*dz;
     if(d2>=cutoff)continue;
     let k=Math.min(count,6);while(k>0&&d2<dist[k-1]){dist[k]=dist[k-1];p.neighbors[k]=p.neighbors[k-1];k--}
     dist[k]=d2;p.neighbors[k]=j;count=Math.min(7,count+1);if(count===7)cutoff=dist[6];
    }
   }
   p.neighborCount=count;
  }
  this.degrees.fill(0);let edges=0;
  for(let i=0;i<b.length;i++){
   const p=b[i];for(let k=0;k<Math.min(7,p.neighborCount);k++){
    const j=p.neighbors[k];if(j<i){const q=b[j];let reciprocal=false;for(let m=0;m<Math.min(7,q.neighborCount);m++)if(q.neighbors[m]===i){reciprocal=true;break}if(reciprocal)continue}
    this.edgeA[edges]=i;this.edgeB[edges]=j;edges++;this.degrees[i]++;this.degrees[j]++;
   }
  }
  this.edgeCount=edges;for(let e=0;e<edges;e++)this.edgeWeight[e]=1/Math.max(this.degrees[this.edgeA[e]],this.degrees[this.edgeB[e]]);
 }
 refreshCohesion(start=0,stride=1){
  const m=this.socialMoments,heads=this.socialHeads,next=this.socialNext,occupied=this.socialOccupied,birds=this.birds;
  const cols=this.socialCols,rows=this.socialRows,layers=this.socialLayers,cellSize=this.socialCell;
  heads.fill(-1);m.fill(0);let used=0;
  for(let i=0;i<birds.length;i++){
   const p=birds[i];
   const x=clamp(Math.floor(p.x/cellSize),0,cols-1),y=clamp(Math.floor(p.y/cellSize),0,rows-1),z=clamp(Math.floor(p.z/cellSize),0,layers-1),cell=(z*rows+y)*cols+x;
   p.socialCell=cell;if(heads[cell]===-1)occupied[used++]=cell;
   next[i]=heads[cell];heads[cell]=i;
   const u=p.x-(x+.5)*cellSize,v=p.y-(y+.5)*cellSize,w=p.z-(z+.5)*cellSize,r2=u*u+v*v+w*w,b=cell*13;
   m[b]++;m[b+1]+=u;m[b+2]+=v;m[b+3]+=w;
   m[b+4]+=u*u;m[b+5]+=v*v;m[b+6]+=w*w;m[b+7]+=u*v;m[b+8]+=u*w;m[b+9]+=v*w;
   m[b+10]+=u*r2;m[b+11]+=v*r2;m[b+12]+=w*r2;
  }
  const radiusSquared=this.socialRadius*this.socialRadius,inverseRadiusSquared=1/radiusSquared,half=cellSize*.5;
  for(let i=start;i<birds.length;i+=stride){
   const p=birds[i];
   let cx=0,cy=0,cz=0,total=0;
   // Exact linear radial weights (1-distance²/radius²). Thirteen cell
   // moments sum fully covered cells; only cut cells visit individual birds.
   // Cell boundaries therefore cannot alter the physical attraction.
   for(let k=0;k<used;k++){
    const cell=occupied[k],dx=this.socialCenterX[cell]-p.x,dy=this.socialCenterY[cell]-p.y,dz=this.socialCenterZ[cell]-p.z;
    const nearX=Math.max(0,Math.abs(dx)-half),nearY=Math.max(0,Math.abs(dy)-half),nearZ=Math.max(0,Math.abs(dz)-half);
    if(nearX*nearX+nearY*nearY+nearZ*nearZ>=radiusSquared)continue;
    const farX=Math.abs(dx)+half,farY=Math.abs(dy)+half,farZ=Math.abs(dz)+half;
    if(farX*farX+farY*farY+farZ*farZ<radiusSquared){
     const b=cell*13,t=1-(dx*dx+dy*dy+dz*dz)*inverseRadiusSquared;
     const weight=t*m[b]-(2*(dx*m[b+1]+dy*m[b+2]+dz*m[b+3])+m[b+4]+m[b+5]+m[b+6])*inverseRadiusSquared;
     cx+=dx*weight+t*m[b+1]-(2*(dx*m[b+4]+dy*m[b+7]+dz*m[b+8])+m[b+10])*inverseRadiusSquared;
     cy+=dy*weight+t*m[b+2]-(2*(dx*m[b+7]+dy*m[b+5]+dz*m[b+9])+m[b+11])*inverseRadiusSquared;
     cz+=dz*weight+t*m[b+3]-(2*(dx*m[b+8]+dy*m[b+9]+dz*m[b+6])+m[b+12])*inverseRadiusSquared;
     total+=weight-(cell===p.socialCell?1:0);
    }else{
     for(let j=heads[cell];j!==-1;j=next[j]){
      if(i===j)continue;const q=birds[j],x=q.x-p.x,y=q.y-p.y,z=q.z-p.z,weight=1-(x*x+y*y+z*z)*inverseRadiusSquared;
      if(weight<=0)continue;cx+=x*weight;cy+=y*weight;cz+=z*weight;total+=weight;
     }
    }
   }
   p.cohesionX=total>1e-8?cx/total:0;p.cohesionY=total>1e-8?cy/total:0;p.cohesionZ=total>1e-8?cz/total:0;
  }
 }
 step(dt,intruder){
  const tick=this.tick++;if(tick%3===0)this.refreshNeighbors();if(tick===0)this.refreshCohesion();else this.refreshCohesion(tick%6,6);
  const b=this.birds,n=b.length,tx=this.torqueX,ty=this.torqueY,tz=this.torqueZ;
  tx.fill(0);ty.fill(0);tz.fill(0);
  for(let i=0;i<n;i++){const p=b[i],s=Math.hypot(p.vx,p.vy,p.vz)||1;this.speeds[i]=s;this.unitX[i]=p.vx/s;this.unitY[i]=p.vy/s;this.unitZ[i]=p.vz/s}
  for(let e=0;e<this.edgeCount;e++){
   const i=this.edgeA[e],j=this.edgeB[e],p=b[i],q=b[j],weight=this.edgeWeight[e];
   // Pass turning momentum between neighbors while allowing local heading
   // differences. A bend travels through the group instead of locking it.
   const x=(this.unitY[i]*this.unitZ[j]-this.unitZ[i]*this.unitY[j])*.006+(q.ox-p.ox)*.12;
   const y=(this.unitZ[i]*this.unitX[j]-this.unitX[i]*this.unitZ[j])*.006+(q.oy-p.oy)*.12;
   const z=(this.unitX[i]*this.unitY[j]-this.unitY[i]*this.unitX[j])*.006+(q.oz-p.oz)*.12;
   tx[i]+=x*weight;tx[j]-=x*weight;ty[i]+=y*weight;ty[j]-=y*weight;tz[i]+=z*weight;tz[j]-=z*weight;
  }
  const radius=Math.min(this.w,this.h)*.15*(intruder.down?1.3:1),inset=this.edgeInset;
  let leadX=(intruder.vx||0)*.2,leadY=(intruder.vy||0)*.2;
  const leadScale=Math.min(1,radius/(Math.hypot(leadX,leadY)||1));leadX*=leadScale;leadY*=leadScale;
  const leadSquared=leadX*leadX+leadY*leadY;
  for(let i=0;i<n;i++){
   const p=b[i],speed=this.speeds[i];let ax=0,ay=0,az=0;
   for(let k=0;k<p.neighborCount;k++){
    const q=b[p.neighbors[k]],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d2=dx*dx+dy*dy+dz*dz;
    if(d2<30*30&&d2>1e-8){const d=Math.sqrt(d2),push=(30-d)/30/d*.075;ax-=dx*push;ay-=dy*push;az-=dz*push}
   }
   // The closest seven coordinate flight; a broader finite community keeps
   // neighboring lobes connected without selecting a flock shape or path.
   let cohesionX=p.cohesionX*.00018,cohesionY=p.cohesionY*.00018,cohesionZ=p.cohesionZ*.00018;
   // Turn toward local companions without strongly braking the front into
   // the tail. A modest longitudinal response lets trailing birds catch up.
   const speedSquared=p.vx*p.vx+p.vy*p.vy+p.vz*p.vz;
   if(speedSquared>1e-9){
    const along=(cohesionX*p.vx+cohesionY*p.vy+cohesionZ*p.vz)/speedSquared*.70;
    cohesionX-=p.vx*along;cohesionY-=p.vy*along;cohesionZ-=p.vz*along;
   }
   ax+=cohesionX;ay+=cohesionY;az+=cohesionZ;
   let alarm=0;
   if(intruder.active){
    const ox=p.x-intruder.x,oy=p.y-intruder.y,along=leadSquared>1?clamp((ox*leadX+oy*leadY)/leadSquared,0,1):0;
    const dx=ox-leadX*along,dy=oy-leadY*along,d=Math.hypot(dx,dy);alarm=clamp(1-d/radius,0,1);
    // Keep the stronger, velocity-anticipated intruder response.
    if(d>1e-8){const push=smooth(alarm)*(intruder.down?.29:.22);ax+=dx/d*push;ay+=dy/d*push}
   }
   // Soft physical enclosure, including a depth slab. It has no camera,
   // periodic space, or prescribed circuit. The inset guard is only a backstop.
   const zone=Math.min(125,this.w*.2,this.h*.2),look=28;
   const left=smooth(1-(p.x+p.vx*look-inset)/zone),right=smooth(1-(this.w-inset-p.x-p.vx*look)/zone);
   const top=smooth(1-(p.y+p.vy*look-inset)/zone),bottom=smooth(1-(this.h-inset-p.y-p.vy*look)/zone);
   ax+=(left-right)*.075;ay+=(top-bottom)*.075;
   const front=smooth(1-(p.z+p.vz*18-5)/45),back=smooth(1-(this.depth-5-p.z-p.vz*18)/45);
   az+=(front-back)*.055;
   const drive=(2.1-speed)*.035;ax+=this.unitX[i]*drive;ay+=this.unitY[i]*drive;az+=this.unitZ[i]*drive;
   const force=Math.hypot(ax,ay,az),scale=Math.min(1,(.07+alarm*.16)/(force||1));ax*=scale;ay*=scale;az*=scale;
   const response=1-Math.exp(-dt*10);p.ax+=(ax-p.ax)*response;p.ay+=(ay-p.ay)*response;p.az+=(az-p.az)*response;
   p.noiseState=(Math.imul(p.noiseState,1664525)+1013904223)>>>0;p.wx+=(p.noiseState/4294967296-.5)*this.wanderStrength-p.wx*.03;
   p.noiseState=(Math.imul(p.noiseState,1664525)+1013904223)>>>0;p.wy+=(p.noiseState/4294967296-.5)*this.wanderStrength-p.wy*.03;
   p.noiseState=(Math.imul(p.noiseState,1664525)+1013904223)>>>0;p.wz+=(p.noiseState/4294967296-.5)*this.wanderStrength*2-p.wz*.03;
   // Let lingering rotation relax, opening curves without setting a route.
   p.nox=p.ox+tx[i]-p.ox*.045+p.wx;p.noy=p.oy+ty[i]-p.oy*.045+p.wy;p.noz=p.oz+tz[i]-p.oz*.045+p.wz;
   let turn=Math.hypot(p.nox,p.noy,p.noz);if(turn>.020){const f=.020/turn;p.nox*=f;p.noy*=f;p.noz*=f;turn=.020}
   // Rodrigues rotation: a bird retains its own angular momentum in 3D.
   const kx=p.nox/(turn||1),ky=p.noy/(turn||1),kz=p.noz/(turn||1),cs=Math.cos(turn),sn=Math.sin(turn),dot=kx*p.vx+ky*p.vy+kz*p.vz;
   const vx=p.vx*cs+(ky*p.vz-kz*p.vy)*sn+kx*dot*(1-cs);
   const vy=p.vy*cs+(kz*p.vx-kx*p.vz)*sn+ky*dot*(1-cs);
   const vz=p.vz*cs+(kx*p.vy-ky*p.vx)*sn+kz*dot*(1-cs);
   p.nx=vx+p.ax;p.ny=vy+p.ay;p.nz=vz+p.az;
   // Obstacles seed a local turn which the angular neighbor links can carry.
   const spin=.025/(speed*speed||1);p.nox+=(vy*p.nz-vz*p.ny)*spin;p.noy+=(vz*p.nx-vx*p.nz)*spin;p.noz+=(vx*p.ny-vy*p.nx)*spin;
   const speedScale=Math.min(1,2.7/(Math.hypot(p.nx,p.ny,p.nz)||1));p.nx*=speedScale;p.ny*=speedScale;p.nz*=speedScale;
   p.nx=clamp(p.nx,-Math.max(0,(p.x-inset)/12),Math.max(0,(this.w-inset-p.x)/12));
   p.ny=clamp(p.ny,-Math.max(0,(p.y-inset)/12),Math.max(0,(this.h-inset-p.y)/12));
   p.nz=clamp(p.nz,-Math.max(0,(p.z-5)/12),Math.max(0,(this.depth-5-p.z)/12));
  }
  for(const p of b){
   p.px=p.x;p.py=p.y;p.pz=p.z;p.pvx=p.vx;p.pvy=p.vy;p.pvz=p.vz;
   p.vx=p.nx;p.vy=p.ny;p.vz=p.nz;p.ox=p.nox;p.oy=p.noy;p.oz=p.noz;p.x+=p.vx;p.y+=p.vy;p.z+=p.vz;
   if(p.x<inset||p.x>this.w-inset||p.y<inset||p.y>this.h-inset||p.z<5||p.z>this.depth-5)this.contacts++;
   p.x=clamp(p.x,inset,this.w-inset);p.y=clamp(p.y,inset,this.h-inset);p.z=clamp(p.z,5,this.depth-5);
   p.history.copyWithin(2,0,30);p.history[0]=p.x;p.history[1]=p.y;
  }
 }
}
if(typeof module!=='undefined')module.exports=Flock;
