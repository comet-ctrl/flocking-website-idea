/* Presentation only: keep the view still until the flock approaches an edge. */
class FlockView {
 constructor(width,height){this.w=width;this.h=height;this.x=width*.48;this.y=height*.47;this.vx=0;this.vy=0}
 delta(value,size){return ((value+size/2)%size+size)%size-size/2}
 follow(birds,dt){
  this.vx=0;this.vy=0;
  if(!birds.length||dt<=0)return;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of birds){
   const x=this.delta(p.x-this.x,this.w),y=this.delta(p.y-this.y,this.h);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  // Leave 8% padding on each side. When the bounds fit, there is no camera
  // attraction to their center; all of their forward travel remains visible.
  const correction=(min,max,size)=>{
   const safeHalf=size*.42;
   if(max-min>safeHalf*2)return (min+max)*.5;
   if(min<-safeHalf)return min+safeHalf;
   if(max>safeHalf)return max-safeHalf;
   return 0;
  };
  // Ease only the required edge correction so a stray bird cannot instantly
  // move the whole view. The camera never changes a bird's position or heading.
  const blend=1-Math.exp(-dt*8);
  const dx=correction(minX,maxX,this.w)*blend,dy=correction(minY,maxY,this.h)*blend;
  this.x=(this.x+dx+this.w)%this.w;this.y=(this.y+dy+this.h)%this.h;
  this.vx=dx/dt;this.vy=dy/dt;
 }
 screenX(x){return this.w/2+this.delta(x-this.x,this.w)}
 screenY(y){return this.h/2+this.delta(y-this.y,this.h)}
 worldX(x){return ((x-this.w/2+this.x)%this.w+this.w)%this.w}
 worldY(y){return ((y-this.h/2+this.y)%this.h+this.h)%this.h}
}
if(typeof module!=='undefined')module.exports=FlockView;
