/* Presentation only: keep a continuous view of the moving flock across seams. */
class FlockView {
 constructor(width,height){this.w=width;this.h=height;this.x=width*.48;this.y=height*.47;this.vx=0;this.vy=0}
 delta(value,size){return ((value+size/2)%size+size)%size-size/2}
 follow(birds,dt){
  if(!birds.length||dt<=0)return;
  let dx=0,dy=0;
  for(const p of birds){dx+=this.delta(p.x-this.x,this.w);dy+=this.delta(p.y-this.y,this.h)}
  const blend=1-Math.exp(-dt*2);
  dx=dx/birds.length*blend;dy=dy/birds.length*blend;
  this.x=(this.x+dx+this.w)%this.w;this.y=(this.y+dy+this.h)%this.h;
  this.vx=dx/dt;this.vy=dy/dt;
 }
 screenX(x){return this.w/2+this.delta(x-this.x,this.w)}
 screenY(y){return this.h/2+this.delta(y-this.y,this.h)}
 worldX(x){return ((x-this.w/2+this.x)%this.w+this.w)%this.w}
 worldY(y){return ((y-this.h/2+this.y)%this.h+this.h)%this.h}
}
if(typeof module!=='undefined')module.exports=FlockView;
