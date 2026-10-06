const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const DEFAULT_TARGET = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const artifacts = path.join(__dirname, '.artifacts');
fs.mkdirSync(artifacts, {recursive: true});
process.argv[2] ||= DEFAULT_TARGET;
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1000,height:720},offline:true});const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.argv[2],{timeout:60000});await p.waitForFunction(()=>window.supraLab,{timeout:60000});
  assert.equal(await p.evaluate(()=>supraLab.sampleAudio?.kind),'recordings','Actual recorded-engine audio module must replace oscillator');
  await p.locator('#sound').click({force:true});await p.waitForFunction(()=>supraLab.sampleAudio?.enabled,{timeout:30000});
  let info=await p.evaluate(()=>supraLab.sampleAudio.inspect());
  assert.equal(info.oscillators,0);assert.ok(info.decoded.engine>1);assert.equal(info.state,'running');
  await p.evaluate(()=>{supraLab.state.running=true;supraLab.state.rpm=3200;supraLab.state.throttle=40;});
  await p.waitForTimeout(400);
  info=await p.evaluate(()=>supraLab.sampleAudio.inspect());assert.ok(info.master>0);assert.ok(info.layers.some(l=>l.gain>0&&l.rate>0));
  const energy=await p.evaluate(async()=>{const a=supraLab.sampleAudio;const buffer=new Float32Array(a.analyser.fftSize);let sum=0;for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,50));a.analyser.getFloatTimeDomainData(buffer);sum+=buffer.reduce((v,x)=>v+x*x,0)/buffer.length;}return sum/5;});assert.ok(energy>1e-7,'Real decoded samples must produce audio output');
  await p.locator('#play').click({force:true});await p.waitForTimeout(650);
  info=await p.evaluate(()=>supraLab.sampleAudio.inspect());assert.ok(info.master<0.002,'Pause must mute engine');
  await p.locator('#sound').click({force:true});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>supraLab.sampleAudio.enabled),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',offline:true,energy,info,errors},null,2));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
