const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const DEFAULT_TARGET = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const artifacts = path.join(__dirname, '.artifacts');
fs.mkdirSync(artifacts, {recursive: true});
process.argv[2] ||= DEFAULT_TARGET;
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{const p=await b.newPage({viewport:{width:1000,height:720},offline:true});await p.goto(process.argv[2]);await p.waitForFunction(()=>window.supraLab,{timeout:60000});assert.ok(await p.evaluate(()=>!!supraLab.progressDrive),'Per-gear progress controls are missing');
const checks=await p.evaluate(()=>{const s=supraLab.state;s.running=true;const out=[];for(let gear=1;gear<6;gear++){setGearProgress(100);for(let i=0;i<100;i++)supraLab.step(.05);const before={rpm:s.rpm,speed:s.speed,target:s.rpmTarget};setProgressGear(gear+1);const after={rpm:s.rpm,speed:s.speed,slider:+document.getElementById('throttle').value,percent:s.throttle,range:progressRange()};supraLab.step(.001);out.push({gear,before,after,deltaAfterStep:Math.abs(s.speed-before.speed),nextRpm:s.rpm});}s.running=false;updateUI();return out;});
for(const c of checks){assert.equal(c.after.slider,0);assert.equal(c.after.percent,0);assert.equal(c.after.rpm,c.before.rpm);assert.equal(c.after.speed,c.before.speed);assert.ok(Math.abs(c.after.range.rpmMin-c.before.rpm)<.02);assert.ok(c.after.range.rpmMax>c.after.range.rpmMin);assert.ok(c.deltaAfterStep<.05);assert.ok(Math.abs(c.nextRpm-c.before.rpm)<.05);}
const early=await p.evaluate(()=>{const s=supraLab.state;setProgressGear(1);setGearProgress(45);s.running=true;for(let i=0;i<100;i++)supraLab.step(.05);const before={rpm:s.rpm,speed:s.speed};setProgressGear(2);const after={rpm:s.rpm,speed:s.speed,p:s.throttle,min:progressRange().rpmMin};s.running=false;return {before,after};});assert.equal(early.after.p,0);assert.equal(early.after.rpm,early.before.rpm);assert.equal(early.after.speed,early.before.speed);
const neutral=await p.evaluate(()=>{setProgressGear(0);supraLab.state.running=true;supraLab.step(.1);const s=supraLab.state;const result={speed:s.speed,range:progressRange()};s.running=false;return result;});assert.equal(neutral.speed,0);console.log(JSON.stringify({result:'PASS',offline:true,checks,early,neutral},null,2));}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
