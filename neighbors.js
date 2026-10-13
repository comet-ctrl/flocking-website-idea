/* Local social neighborhoods inside the visible screen; no global attraction. */
function flockCellOffsets(radius,columns,rows,cw,ch){
 const offsets=[],reachX=Math.min(columns-1,Math.ceil(radius/cw)),reachY=Math.min(rows-1,Math.ceil(radius/ch));
 for(let y=-reachY;y<=reachY;y++)for(let x=-reachX;x<=reachX;x++){
  const dx=Math.max(0,Math.abs(x)-1)*cw,dy=Math.max(0,Math.abs(y)-1)*ch;
  offsets.push({column:x,row:y,minDistanceSquared:dx*dx+dy*dy});
 }
 return offsets.sort((a,b)=>a.minDistanceSquared-b.minDistanceSquared||a.row-b.row||a.column-b.column);
}
class FlockNeighbors {
 constructor(width,height,cohesionRadius=120){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Viewport dimensions must be positive');
  if(!Number.isFinite(cohesionRadius)||cohesionRadius<=0)throw new RangeError('Cohesion radius must be positive');
  this.width=width;this.height=height;this.radius=64;this.cohesionRadius=cohesionRadius;
  // Equal cells cover the whole viewport, including sizes not divisible by 16.
  this.columns=Math.max(1,Math.floor(width/16));this.rows=Math.max(1,Math.floor(height/16));
  this.cellWidth=width/this.columns;this.cellHeight=height/this.rows;
  this.heads=new Int32Array(this.columns*this.rows);
  // Polynomial moments let fully covered cells contribute exactly without
  // visiting each bird. The radial weight is a fourth-degree polynomial.
  this.cohesionColumns=Math.max(1,Math.floor(width/64));this.cohesionRows=Math.max(1,Math.floor(height/64));
  this.cohesionCellWidth=width/this.cohesionColumns;this.cohesionCellHeight=height/this.cohesionRows;
  this.cohesionHeads=new Int32Array(this.cohesionColumns*this.cohesionRows);
  this.cohesionStarts=new Int32Array(this.cohesionHeads.length+1);this.cohesionWrite=new Int32Array(this.cohesionHeads.length);
  this.moments=new Float64Array(this.cohesionHeads.length*19);
  this.next=new Int32Array(0);this.xs=new Float64Array(0);this.ys=new Float64Array(0);
  this.sortedX=new Float64Array(0);this.sortedY=new Float64Array(0);this.sortedIds=new Int32Array(0);
  this.distances=new Float64Array(7);
  // This lower bound is valid anywhere inside the bird's current cell.
  this.offsets=flockCellOffsets(this.radius,this.columns,this.rows,this.cellWidth,this.cellHeight);
  this.cohesionOffsets=flockCellOffsets(cohesionRadius,this.cohesionColumns,this.cohesionRows,this.cohesionCellWidth,this.cohesionCellHeight);
 }
 refresh(birds,refreshCohesion=true){
  const count=birds.length,columns=this.columns,rows=this.rows,cw=this.cellWidth,ch=this.cellHeight;
  if(this.next.length!==count){this.next=new Int32Array(count);this.xs=new Float64Array(count);this.ys=new Float64Array(count);this.sortedX=new Float64Array(count);this.sortedY=new Float64Array(count);this.sortedIds=new Int32Array(count);refreshCohesion=true}
  const heads=this.heads,next=this.next,xs=this.xs,ys=this.ys,distances=this.distances,m=this.moments,radiusSquared=this.radius*this.radius;
  const cc=this.cohesionColumns,cr=this.cohesionRows,ccw=this.cohesionCellWidth,cch=this.cohesionCellHeight,cheads=this.cohesionHeads;
  const starts=this.cohesionStarts,write=this.cohesionWrite,sortedX=this.sortedX,sortedY=this.sortedY,sortedIds=this.sortedIds;
  const cohesionSquared=this.cohesionRadius*this.cohesionRadius,inverseCohesionSquared=1/cohesionSquared,inv2=inverseCohesionSquared*inverseCohesionSquared;
  heads.fill(-1);
  if(refreshCohesion){cheads.fill(-1);m.fill(0)}
  for(let i=0;i<count;i++){
   const p=birds[i],x=p.x,y=p.y;xs[i]=x;ys[i]=y;
   const row=Math.min(rows-1,Math.floor(y/ch)),column=Math.min(columns-1,Math.floor(x/cw)),cell=row*columns+column;
   next[i]=heads[cell];heads[cell]=i;
   if(!refreshCohesion)continue;
   const ccolumn=Math.min(cc-1,Math.floor(x/ccw)),crow=Math.min(cr-1,Math.floor(y/cch)),ccell=crow*cc+ccolumn;
   cheads[ccell]=i;
   const u=x-(ccolumn+.5)*ccw,v=y-(crow+.5)*cch,u2=u*u,v2=v*v,uv=u*v,r2=u2+v2,r4=r2*r2,b=ccell*19;
   m[b]++;m[b+1]+=u;m[b+2]+=v;m[b+3]+=u2;m[b+4]+=uv;m[b+5]+=v2;
   m[b+6]+=u2*u;m[b+7]+=u2*v;m[b+8]+=u*v2;m[b+9]+=v2*v;
   m[b+10]+=r2;m[b+11]+=u*r2;m[b+12]+=v*r2;
   m[b+13]+=u2*r2;m[b+14]+=uv*r2;m[b+15]+=v2*r2;
   m[b+16]+=r4;m[b+17]+=u*r4;m[b+18]+=v*r4;
  }
  if(refreshCohesion){
   starts[0]=0;
   for(let cell=0;cell<cheads.length;cell++){starts[cell+1]=starts[cell]+m[cell*19];write[cell]=starts[cell]}
   for(let i=0;i<count;i++){
    const column=Math.min(cc-1,Math.floor(xs[i]/ccw)),row=Math.min(cr-1,Math.floor(ys[i]/cch)),at=write[row*cc+column]++;
    sortedX[at]=xs[i];sortedY[at]=ys[i];sortedIds[at]=i;
   }
  }
  for(let i=0;i<count;i++){
   const p=birds[i],ids=p.neighbors,x=xs[i],y=ys[i],gx=Math.min(columns-1,Math.floor(x/cw)),gy=Math.min(rows-1,Math.floor(y/ch));
   let found=0,cutoff=radiusSquared;distances.fill(Infinity);
   for(const offset of this.offsets){
    // Cell bounds can round slightly upward at an exact 64 px distance.
    if(offset.minDistanceSquared>cutoff+1e-8)break;
    const column=gx+offset.column,row=gy+offset.row;
    if(column<0||column>=columns||row<0||row>=rows)continue;
    let cellDX=Math.abs((column+.5)*cw-x),cellDY=Math.abs((row+.5)*ch-y);
    cellDX=Math.max(0,cellDX-cw*.5);
    cellDY=Math.max(0,cellDY-ch*.5);
    if(cellDX*cellDX+cellDY*cellDY>cutoff+1e-8)continue;
    for(let j=heads[row*columns+column];j!==-1;j=next[j]){
     if(i===j)continue;
     const dx=xs[j]-x,dy=ys[j]-y;
     const d2=dx*dx+dy*dy;
     if(d2>cutoff||(found===7&&d2===distances[6]&&j>ids[6]))continue;
     let k=Math.min(found,6);
     while(k>0&&(d2<distances[k-1]||(d2===distances[k-1]&&j<ids[k-1]))){distances[k]=distances[k-1];ids[k]=ids[k-1];k--}
     distances[k]=d2;ids[k]=j;found=Math.min(7,found+1);
     if(found===7)cutoff=Math.min(radiusSquared,distances[6]);
    }
   }
   p.neighborCount=found;
   if(!refreshCohesion)continue;
   // Cohesion sees a wider local neighborhood than the closest-seven flight
   // alignment. Smoothly vanishing weights retain links between nearby groups
   // without recruiting distant birds or assigning a desired flock shape.
   let cohesionX=0,cohesionY=0,totalWeight=0;
   const cgx=Math.min(cc-1,Math.floor(x/ccw)),cgy=Math.min(cr-1,Math.floor(y/cch));
   for(const offset of this.cohesionOffsets){
    if(offset.minDistanceSquared>cohesionSquared+1e-8)break;
    const column=cgx+offset.column,row=cgy+offset.row;
    if(column<0||column>=cc||row<0||row>=cr)continue;
    const cell=row*cc+column;
    if(cheads[cell]===-1)continue;
    const centerX=(column+.5)*ccw-x,centerY=(row+.5)*cch-y;
    const farX=Math.abs(centerX)+ccw*.5,farY=Math.abs(centerY)+cch*.5;
    const cellDX=Math.max(0,Math.abs(centerX)-ccw*.5),cellDY=Math.max(0,Math.abs(centerY)-cch*.5);
    if(cellDX*cellDX+cellDY*cellDY>=cohesionSquared)continue;
    if(farX*farX+farY*farY<cohesionSquared){
     const b=cell*19,x2=centerX*centerX,y2=centerY*centerY,xy2=2*centerX*centerY;
     const t=1-(x2+y2)*inverseCohesionSquared,t2=t*t,a=-4*t*inverseCohesionSquared,c=-2*t*inverseCohesionSquared,d=4*inv2;
     const weight=t2*m[b]+a*(centerX*m[b+1]+centerY*m[b+2])+c*m[b+10]+d*(x2*m[b+3]+xy2*m[b+4]+y2*m[b+5]+centerX*m[b+11]+centerY*m[b+12])+inv2*m[b+16];
     const localX=t2*m[b+1]+a*(centerX*m[b+3]+centerY*m[b+4])+c*m[b+11]+d*(x2*m[b+6]+xy2*m[b+7]+y2*m[b+8]+centerX*m[b+13]+centerY*m[b+14])+inv2*m[b+17];
     const localY=t2*m[b+2]+a*(centerX*m[b+4]+centerY*m[b+5])+c*m[b+12]+d*(x2*m[b+7]+xy2*m[b+8]+y2*m[b+9]+centerX*m[b+14]+centerY*m[b+15])+inv2*m[b+18];
     cohesionX+=centerX*weight+localX;cohesionY+=centerY*weight+localY;
     totalWeight+=weight-(column===cgx&&row===cgy?1:0);
     continue;
    }
    for(let at=starts[cell],end=starts[cell+1];at<end;at++){
     if(i===sortedIds[at])continue;
     const dx=sortedX[at]-x,dy=sortedY[at]-y;
     const d2=dx*dx+dy*dy;
     if(d2>=cohesionSquared)continue;
     const falloff=1-d2*inverseCohesionSquared,weight=falloff*falloff;
     cohesionX+=dx*weight;cohesionY+=dy*weight;totalWeight+=weight;
    }
   }
   p.cohesionX=totalWeight>1e-9?cohesionX/totalWeight:0;
   p.cohesionY=totalWeight>1e-9?cohesionY/totalWeight:0;
  }
 }
}
if(typeof module!=='undefined')module.exports=FlockNeighbors;
