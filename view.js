/* Presentation only: keep the view still until the flock approaches an edge. */
class FlockView {
 constructor(width,height){this.w=width;this.h=height;this.x=width*.48;this.y=height*.47;this.vx=0;this.vy=0;this.axisX=new Float64Array(0);this.axisY=new Float64Array(0);this.openAxes=new Uint8Array(2).fill(1)}
 delta(value,size){return ((value+size/2)%size+size)%size-size/2}
 edgeCorrection(values,size,center,axis){
  const safeHalf=size*.42;
  let alreadyFits=true;
  for(const value of values)if(Math.abs(this.delta(value-center,size))>safeHalf){alreadyFits=false;break}
  if(alreadyFits){this.openAxes[axis]=1;return 0}
  values.sort();
  // Cut the repeating axis at its largest empty gap, not opposite the current
  // camera. Otherwise a small flock on that opposite seam looks screen-wide.
  let largestGap=-1,offset=0,span=0;
  for(let i=0;i<values.length;i++){
   const next=i+1===values.length?values[0]+size:values[i+1];
   const gap=next-values[i],candidateSpan=size-gap;
   const candidateOffset=this.delta(next+candidateSpan*.5-center,size);
   // Equal gaps have equally valid covering arcs; prefer the nearest center
   // so a symmetric arrangement does not make the camera choose a distant copy.
   if(gap>largestGap+1e-9||(Math.abs(gap-largestGap)<=1e-9&&Math.abs(candidateOffset)<Math.abs(offset))){
    largestGap=gap;span=candidateSpan;offset=candidateOffset;
   }
  }
  // A flock covering almost the whole axis has no useful place to cut it.
  // Preserve the current view instead of chasing whichever tiny gap is
  // largest this frame. Separate close/reopen thresholds prevent chatter.
  if(largestGap<size*.08)this.openAxes[axis]=0;
  else if(largestGap>size*.12)this.openAxes[axis]=1;
  if(!this.openAxes[axis])return 0;
  const min=offset-span*.5,max=offset+span*.5;
  if(span>safeHalf*2)return offset;
  if(min<-safeHalf)return min+safeHalf;
  if(max>safeHalf)return max-safeHalf;
  return 0;
 }
 follow(birds,dt){
  this.vx=0;this.vy=0;
  if(!birds.length||dt<=0)return;
  if(this.axisX.length!==birds.length){this.axisX=new Float64Array(birds.length);this.axisY=new Float64Array(birds.length)}
  for(let i=0;i<birds.length;i++){
   const p=birds[i];this.axisX[i]=(p.x%this.w+this.w)%this.w;this.axisY[i]=(p.y%this.h+this.h)%this.h;
  }
  // Leave 8% padding on each side. When the bounds fit, there is no camera
  // attraction to their center; all of their forward travel remains visible.
  // Ease only the required edge correction so a stray bird cannot instantly
  // move the whole view. The camera never changes a bird's position or heading.
  const blend=1-Math.exp(-dt*8);
  const dx=this.edgeCorrection(this.axisX,this.w,this.x,0)*blend,dy=this.edgeCorrection(this.axisY,this.h,this.y,1)*blend;
  this.x=(this.x+dx+this.w)%this.w;this.y=(this.y+dy+this.h)%this.h;
  this.vx=dx/dt;this.vy=dy/dt;
 }
 screenX(x){return this.w/2+this.delta(x-this.x,this.w)}
 screenY(y){return this.h/2+this.delta(y-this.y,this.h)}
 worldX(x){return ((x-this.w/2+this.x)%this.w+this.w)%this.w}
 worldY(y){return ((y-this.h/2+this.y)%this.h+this.h)%this.h}
}
if(typeof module!=='undefined')module.exports=FlockView;
