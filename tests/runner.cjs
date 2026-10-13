const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
require('node:test').test('worker transfers preserve fixed-step motion, paced time, and lifecycle behavior',()=>{
const Flock=require(root+'/flock.js');
let workers=[];
class FakeWorker {
 constructor(){this.jobs=[];workers.push(this);this.context=vm.createContext({Math,ArrayBuffer,Float32Array,Float64Array,Uint32Array,Int32Array,Uint16Array,console,postMessage:(message,transfer)=>{const clone=structuredClone(message,{transfer});this.onmessage?.({data:clone})}});this.context.importScripts=file=>vm.runInContext(fs.readFileSync(root+'/'+file,'utf8'),this.context);vm.runInContext(fs.readFileSync(root+'/flock-worker.js','utf8'),this.context)}
 postMessage(message,transfer=[]){this.jobs.push(structuredClone(message,{transfer}))}
 flushOne(){const job=this.jobs.shift();if(job) this.context.onmessage({data:job})}
 flushAll(){for(let i=0;this.jobs.length&&i<10000;i++)this.flushOne();assert.equal(this.jobs.length,0)}
 terminate(){this.terminated=true}
}
const fixedMath=Object.create(Math);fixedMath.random=()=>.25;
const context=vm.createContext({Math:fixedMath,Flock,Worker:FakeWorker,location:{protocol:'http:'},ArrayBuffer,Float32Array,Float64Array,Uint32Array,Int32Array,Uint16Array,console});
vm.runInContext(fs.readFileSync(root+'/flock-runner.js','utf8'),context);
const Runner=context.FlockRunner,runner=new Runner(640,360,80),bird=runner.birds[0],intruder={x:10,y:10,vx:0,vy:0,active:false,down:false};
let state=1073741824;const seeded=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
const reference=new Flock(640,360,80,seeded),worker=workers[0];worker.flushOne();
for(let i=0;i<120;i++){const dt=i%3===0?1/30:1/60,pace=i<37?2.2:i<73?1.4:2.6;runner.advance(dt,intruder,pace);reference.advance(dt,intruder,pace);if(i%3===2)worker.flushAll()}
worker.flushAll();assert.equal(runner.snapshotTick,reference.tick);assert.ok(Math.abs(runner.mainClock-(reference.tick+reference.accumulator*60))<1e-7);assert.equal(runner.birds[0],bird);
assert.equal(runner.droppedTicks,0);
for(let i=0;i<80;i++)for(let k=0;k<32;k++)assert.ok(Math.abs(runner.birds[i].history[k]-reference.birds[i].history[k])<.00005);
assert.ok(runner.renderAgeTicks>=0&&runner.renderAgeTicks<=14);assert.equal(runner.mode,'worker');
runner.advance(.016,intruder,2.2);runner.advance(.1,intruder,2.2);runner.resetClock();runner.advance(.01,intruder,2.2);worker.flushAll();assert.ok(Math.abs(runner.mainClock-(runner.snapshotTick+runner._snapshotAccumulator*60))<1e-7);
const before=runner.snapshotTick;runner.destroy();runner.advance(1,intruder,2.2);assert.equal(runner.snapshotTick,before);assert.ok(worker.terminated);
const overloaded=new Runner(640,360,5),slowWorker=workers[1];slowWorker.flushOne();
for(let i=0;i<30;i++)overloaded.advance(.1,intruder,2.2);
assert.ok(overloaded.droppedTicks>0);assert.ok(overloaded._pendingSeconds<=.22+1e-10);
assert.ok(overloaded.mainClock-overloaded.snapshotTick<=4+13.2+1e-8);
slowWorker.flushAll();assert.ok(Math.abs(overloaded.mainClock-(overloaded.snapshotTick+overloaded._snapshotAccumulator*60))<1e-7);overloaded.destroy();
const syncContext=vm.createContext({Math:fixedMath,Flock,location:{protocol:'file:'},ArrayBuffer,Float32Array});vm.runInContext(fs.readFileSync(root+'/flock-runner.js','utf8'),syncContext);const fallback=new syncContext.FlockRunner(640,360,5);fallback.advance(.05,intruder,2.2);assert.equal(fallback.mode,'sync');assert.equal(fallback.snapshotTick,6);assert.ok(Math.abs(fallback.renderAgeTicks-.4)<1e-8);
});
