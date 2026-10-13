/* Exact nearest neighbors in a repeating viewport. No distant-flock fallback. */
class FlockNeighbors {
 constructor(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Viewport dimensions must be positive');
  this.width=width;this.height=height;this.radius=64;
  // Equal cells cover the whole viewport, including sizes not divisible by 16.
  this.columns=Math.max(1,Math.floor(width/16));this.rows=Math.max(1,Math.floor(height/16));
  this.cellWidth=width/this.columns;this.cellHeight=height/this.rows;
  this.heads=new Int32Array(this.columns*this.rows);
  this.next=new Int32Array(0);this.xs=new Float64Array(0);this.ys=new Float64Array(0);
  this.distances=new Float64Array(7);this.offsets=[];
  const seen=new Set(),reachX=Math.ceil(this.radius/this.cellWidth),reachY=Math.ceil(this.radius/this.cellHeight);
  for(let y=-reachY;y<=reachY;y++)for(let x=-reachX;x<=reachX;x++){
   const column=(x%this.columns+this.columns)%this.columns,row=(y%this.rows+this.rows)%this.rows,key=row*this.columns+column;
   if(seen.has(key))continue;seen.add(key);
   const dx=Math.max(0,Math.min(column,this.columns-column)-1)*this.cellWidth;
   const dy=Math.max(0,Math.min(row,this.rows-row)-1)*this.cellHeight;
   this.offsets.push({column,row,minDistanceSquared:dx*dx+dy*dy});
  }
  // This lower bound is valid anywhere inside the bird's current cell.
  this.offsets.sort((a,b)=>a.minDistanceSquared-b.minDistanceSquared||a.row-b.row||a.column-b.column);
 }
 refresh(birds){
  const count=birds.length,w=this.width,h=this.height,columns=this.columns,rows=this.rows,cw=this.cellWidth,ch=this.cellHeight;
  if(this.next.length!==count){this.next=new Int32Array(count);this.xs=new Float64Array(count);this.ys=new Float64Array(count)}
  const heads=this.heads,next=this.next,xs=this.xs,ys=this.ys,distances=this.distances,radiusSquared=this.radius*this.radius;
  heads.fill(-1);
  for(let i=0;i<count;i++){
   const p=birds[i],x=(p.x%w+w)%w,y=(p.y%h+h)%h;xs[i]=x;ys[i]=y;
   const cell=Math.min(rows-1,Math.floor(y/ch))*columns+Math.min(columns-1,Math.floor(x/cw));
   next[i]=heads[cell];heads[cell]=i;
  }
  for(let i=0;i<count;i++){
   const p=birds[i],ids=p.neighbors,x=xs[i],y=ys[i],gx=Math.min(columns-1,Math.floor(x/cw)),gy=Math.min(rows-1,Math.floor(y/ch));
   let found=0,cutoff=radiusSquared;distances.fill(Infinity);
   for(const offset of this.offsets){
    // Cell bounds can round slightly upward at an exact 64 px seam distance.
    if(offset.minDistanceSquared>cutoff+1e-8)break;
    const column=(gx+offset.column)%columns,row=(gy+offset.row)%rows;
    let cellDX=Math.abs((column+.5)*cw-x),cellDY=Math.abs((row+.5)*ch-y);
    cellDX=Math.max(0,Math.min(cellDX,w-cellDX)-cw*.5);
    cellDY=Math.max(0,Math.min(cellDY,h-cellDY)-ch*.5);
    if(cellDX*cellDX+cellDY*cellDY>cutoff+1e-8)continue;
    for(let j=heads[row*columns+column];j!==-1;j=next[j]){
     if(i===j)continue;
     let dx=Math.abs(xs[j]-x),dy=Math.abs(ys[j]-y);dx=Math.min(dx,w-dx);dy=Math.min(dy,h-dy);
     const d2=dx*dx+dy*dy;
     if(d2>cutoff||(found===7&&d2===distances[6]&&j>ids[6]))continue;
     let k=Math.min(found,6);
     while(k>0&&(d2<distances[k-1]||(d2===distances[k-1]&&j<ids[k-1]))){distances[k]=distances[k-1];ids[k]=ids[k-1];k--}
     distances[k]=d2;ids[k]=j;found=Math.min(7,found+1);
     if(found===7)cutoff=Math.min(radiusSquared,distances[6]);
    }
   }
   p.neighborCount=found;
  }
 }
}
if(typeof module!=='undefined')module.exports=FlockNeighbors;
