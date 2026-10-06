'use strict';
const $=id=>document.getElementById(id),TAU=Math.PI*2;
const state={running:false,throttle:0,rpm:900,rpmTarget:900,phase:0,drivePhase:0,wheelPhase:0,speed:0,gear:1,clutch:true,explode:0,explodeTarget:0,bodyXray:false,engineXray:false,flow:true,slow:false,roadMode:true,roadDistance:0,view:'exterior',selected:null,frames:0,time:0};
const parts={},flowDots=[],gasPuffs=[],bodyMats=[],labels=[];
let scene,camera,renderer,carRoot,engine,drive,selectionBox,raycaster,camYaw=.82,camPitch=.14,camDist=6.8,camTarget=new THREE.Vector3(0,.55,0),lastT=0,lastUI=0,drag=null,filter='all',sound=null;
const particlePoint=new THREE.Vector3(),pointer=new THREE.Vector2();
const mats={};
function mat(color,metal=.4,rough=.35){return new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough})}
function mesh(geometry,material,parent,pos=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.set(...pos);parent.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function round(w,h,d,r,material,parent,pos){r=Math.min(r,w*.45,h*.45,d*.45);const geo=new THREE.BoxGeometry(w,h,d,4,4,Math.min(18,Math.max(4,Math.ceil(d/r))));const v=geo.attributes.position,q=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<v.count;i++){q.fromBufferAttribute(v,i);c.set(Math.max(-w/2+r,Math.min(w/2-r,q.x)),Math.max(-h/2+r,Math.min(h/2-r,q.y)),Math.max(-d/2+r,Math.min(d/2-r,q.z)));q.sub(c).normalize().multiplyScalar(r).add(c);v.setXYZ(i,q.x,q.y,q.z);}geo.computeVertexNormals();geo.userData.rounded=true;return mesh(geo,material,parent,pos);}
function cylinder(r,h,material,parent,pos,axis='y'){const m=mesh(new THREE.CylinderGeometry(r,r,h,40),material,parent,pos);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;return m;}
function pipe(points,r,material,parent){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,48,r,14,false),material,parent);}
const RU_PARTS={"hood": ["Капот", "Изогнутая панель над моторным отсеком. Снимите для доступа к 2JZ."], "front-bumper": ["Передний бампер", "Закруглённая передняя часть с открытыми воздухозаборниками и нижней губой."], "rear-bumper": ["Задний бампер", "Изогнутая задняя панель и нижний диффузор. Геометрия приближённая."], "roof": ["Крыша и стойки", "Плавная крыша купе с передними стойками и задними боковыми панелями."], "windshield": ["Лобовое стекло", "Изогнутое наклонное стекло и два дворника."], "rear-glass": ["Заднее стекло", "Большое стекло, повторяющее ниспадающую линию крыши."], "rear-hatch": ["Крышка багажника", "Панель вокруг заднего стекла и верхняя задняя часть кузова."], "spoiler": ["Задний спойлер", "Плавное антикрыло на двух опорах. Самостоятельная съёмная деталь."], "frame": ["Пол и подрамники", "Несущие элементы, поперечины и центральный тоннель. Это схема, не точная силовая структура."], "fuelTank": ["Бензобак", "Задний бак, крепёжные ленты и заливная горловина. Снятие отключает подачу топлива."], "radiator": ["Радиатор и вентиляторы", "Передний радиатор, два вентилятора и патрубки охлаждения."], "intercooler": ["Интеркулер", "Передний теплообменник и трубы наддувочного воздуха; охлаждение условное."], "battery": ["Аккумулятор", "Корпус, контакты и изолированные провода. Электросистема не рассчитывается."], "airbox": ["Патрубок наддувочного воздуха", "Обратная труба от интеркулера к впуску ранее собранного двигателя."], "gearbox": ["Корпус коробки передач", "Сглаженный корпус с колоколом и рёбрами. В режиме трансмиссии скрывается, чтобы показать шестерни."], "gearboxGears": ["Шестерни 6-ступенчатой КПП", "Шесть видимых пар шестерён на двух валах. Схематичная кинематика; переключение мгновенное."], "clutch": ["Сцепление и маховик", "Вращающийся маховик и прижимной узел. Кнопка «Сцепление» связывает или размыкает привод."], "driveshaft": ["Карданный вал", "Передаёт вращение от коробки к заднему редуктору. Снятие размыкает привод."], "differential": ["Задний редуктор", "Схематичный корпус главной передачи. Дифференцирование скоростей в повороте не моделируется."], "halfshaftL": ["Задняя левая полуось", "Соединяет редуктор с левым задним колесом. Видны шарниры и пыльники."], "halfshaftR": ["Задняя правая полуось", "Соединяет редуктор с правым задним колесом. Видны шарниры и пыльники."], "exhaust": ["Выхлопная система", "Даунпайп, условный катализатор, труба, глушитель и полый наконечник. Светящиеся метки идут по геометрии трубы."], "fuelLines": ["Бензонасос и топливная магистраль", "Подача бензина из бака к двигателю. Снятие отключает имитацию работы."], "seatL": ["Левое сиденье", "Спортивное кресло с округлыми боковыми упорами, подголовником и салазками."], "seatR": ["Правое сиденье", "Спортивное кресло с округлыми боковыми упорами, подголовником и салазками."], "dashboard": ["Панель приборов", "Сглаженная панель с круглыми шкалами и воздуховодами; стрелки декоративные."], "steering": ["Руль и рулевая колонка", "Трёхспицевый руль и наклонная колонка. Поворот колёс пока не моделируется."], "console": ["Консоль и рычаг КПП", "Центральная консоль, рукоятка коробки и ручной тормоз; органы управления декоративные."], "front-fender-left": ["Переднее крыло — левый", "Сглаженное крыло с открытой колёсной аркой и подкрылком."], "rear-quarter-left": ["Заднее крыло — левый", "Изогнутая задняя боковая панель с открытой колёсной аркой."], "door-left": ["Дверь — левая", "Дверная панель, боковое стекло, ручка и условный боковой воздухозаборник."], "mirror-left": ["Зеркало — левое", "Сглаженный корпус бокового зеркала на опоре."], "headlight-left": ["Фара — левая", "Тёмный вытянутый корпус с тремя круглыми линзами и общей прозрачной крышкой."], "taillight-left": ["Задний фонарь — левый", "Две круглые красные секции в тёмной накладке."], "front-fender-right": ["Переднее крыло — правый", "Сглаженное крыло с открытой колёсной аркой и подкрылком."], "rear-quarter-right": ["Заднее крыло — правый", "Изогнутая задняя боковая панель с открытой колёсной аркой."], "door-right": ["Дверь — правая", "Дверная панель, боковое стекло, ручка и условный боковой воздухозаборник."], "mirror-right": ["Зеркало — правое", "Сглаженный корпус бокового зеркала на опоре."], "headlight-right": ["Фара — правая", "Тёмный вытянутый корпус с тремя круглыми линзами и общей прозрачной крышкой."], "taillight-right": ["Задний фонарь — правый", "Две круглые красные секции в тёмной накладке."], "wheelFL": ["Колесо — переднее левое", "Округлая шина и бронзовый пятиспицевый диск. На стенде привод вращает только задние колёса."], "brakeFL": ["Тормозной диск — переднее левое", "Вращающийся диск на отдельной ступице. Отверстия декоративные; торможение не рассчитывается."], "caliperFL": ["Суппорт — переднее левое", "Неподвижный красный тормозной суппорт, отделённый от вращающегося диска."], "suspensionFL": ["Подвеска — переднее левое", "Два рычага, стойка и винтовая пружина. Ход подвески и дорожные нагрузки не рассчитываются."], "wheelFR": ["Колесо — переднее правое", "Округлая шина и бронзовый пятиспицевый диск. На стенде привод вращает только задние колёса."], "brakeFR": ["Тормозной диск — переднее правое", "Вращающийся диск на отдельной ступице. Отверстия декоративные; торможение не рассчитывается."], "caliperFR": ["Суппорт — переднее правое", "Неподвижный красный тормозной суппорт, отделённый от вращающегося диска."], "suspensionFR": ["Подвеска — переднее правое", "Два рычага, стойка и винтовая пружина. Ход подвески и дорожные нагрузки не рассчитываются."], "wheelRL": ["Колесо — заднее левое", "Округлая шина и бронзовый пятиспицевый диск. На стенде привод вращает только задние колёса."], "brakeRL": ["Тормозной диск — заднее левое", "Вращающийся диск на отдельной ступице. Отверстия декоративные; торможение не рассчитывается."], "caliperRL": ["Суппорт — заднее левое", "Неподвижный красный тормозной суппорт, отделённый от вращающегося диска."], "suspensionRL": ["Подвеска — заднее левое", "Два рычага, стойка и винтовая пружина. Ход подвески и дорожные нагрузки не рассчитываются."], "wheelRR": ["Колесо — заднее правое", "Округлая шина и бронзовый пятиспицевый диск. На стенде привод вращает только задние колёса."], "brakeRR": ["Тормозной диск — заднее правое", "Вращающийся диск на отдельной ступице. Отверстия декоративные; торможение не рассчитывается."], "caliperRR": ["Суппорт — заднее правое", "Неподвижный красный тормозной суппорт, отделённый от вращающегося диска."], "suspensionRR": ["Подвеска — заднее правое", "Два рычага, стойка и винтовая пружина. Ход подвески и дорожные нагрузки не рассчитываются."]};
function addPart(id,label,category,description,offset){if(RU_PARTS[id]){label=RU_PARTS[id][0];description=RU_PARTS[id][1];}if(parts[id])throw new Error('Duplicate part '+id);const g=new THREE.Group();g.name=label;carRoot.add(g);parts[id]={id,label,category,description,g,base:new THREE.Vector3(),offset:new THREE.Vector3(...offset),hidden:false,enginePart:false};return g;}
function registerEngine(){const mount=addPart('engineAssembly','Двигатель 2JZ целиком','engine','Ранее собранный 2JZ Photo Edition, встроенный в моторный отсек. Снимите капот или включите разрез для просмотра.',[0,1.4,-.5]);engine=buildExisting2JZ();engine.root.scale.setScalar(.13);engine.root.position.set(-.15,.31,-1.12);mount.add(engine.root);for(const [id,p]of Object.entries(engine.parts)){const key='e:'+id;parts[key]={id:key,label:p.def[1],category:'engine',description:p.def[3],g:p.g,base:p.base,offset:p.offset,hidden:false,enginePart:true,engineId:id};}}
function setup(){scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d8dadd',.025);camera=new THREE.PerspectiveCamera(32,1,.03,100);renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight('#edf0f5','#70757b',2.0));const key=new THREE.DirectionalLight('#fff4e5',3);key.position.set(3,7,-5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:1,far:20});key.shadow.bias=-.0005;key.shadow.radius=4;scene.add(key);const rim=new THREE.DirectionalLight('#ffffff',2.2);rim.position.set(-5,3,4);scene.add(rim);
const studio=new THREE.Scene();studio.background=new THREE.Color('#666b73');for(const [p,s,k]of [[[0,6,0],[8,5],4],[[6,3,0],[5,6],3],[[-6,2,0],[4,7],2],[[0,2,-6],[7,5],3]]){const l=new THREE.Mesh(new THREE.PlaneGeometry(...s),new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(k)}));l.position.set(...p);l.lookAt(0,1,0);studio.add(l);}const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.08).texture;pmrem.dispose();
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.28}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);const studioFloor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#c9cdd1',metalness:.18,roughness:.30}));studioFloor.rotation.x=-Math.PI/2;studioFloor.position.y=-.025;studioFloor.receiveShadow=true;scene.add(studioFloor);
const reflection=new StudioReflector(new THREE.PlaneGeometry(200,200),{textureWidth:1024,textureHeight:1024,color:0xc0c4c8,clipBias:.002});reflection.rotation.x=-Math.PI/2;reflection.position.y=-.022;reflection.material.transparent=true;reflection.material.opacity=.18;reflection.material.depthWrite=false;reflection.material.fragmentShader=reflection.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4( blendOverlay( base.rgb, color ), 0.16 );');scene.add(reflection);
mats.paint=new THREE.MeshPhysicalMaterial({color:'#e5e8e5',metalness:.18,roughness:.21,clearcoat:1,clearcoatRoughness:.13,side:THREE.DoubleSide});mats.glass=new THREE.MeshPhysicalMaterial({color:'#162b35',metalness:.30,roughness:.09,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});mats.black=mat('#202329',.25,.48);mats.chrome=mat('#bec8d1',.86,.24);mats.red=mat('#b81528',.2,.3);mats.amber=mat('#e69b32',.3,.32);mats.steel=mat('#818e9b',.78,.34);mats.rubber=mat('#191b20',.05,.78);mats.blue=mat('#5894c6',.5,.3);
carRoot=new THREE.Group();scene.add(carRoot);const api={addPart,materials:mats,mesh,round,pipe,cylinder};drive=buildSupraChassis(api);registerEngine();api.parts=parts;api.drive=drive;buildSupraBody(api);
// Keep cutaway material changes on body parts, not shared with chassis or engine.
const cloned=new Map();for(const p of Object.values(parts)){p.g.traverse(m=>{if(m.isMesh)m.userData.part=p.id;});if(p.category==='body')p.g.traverse(m=>{if(!m.isMesh)return;const src=m.material;if(Array.isArray(src))return;if(!cloned.has(src)){const c=src.clone();c.userData.originalOpacity=c.opacity;c.userData.originalTransparent=c.transparent;cloned.set(src,c);bodyMats.push(c);}m.material=cloned.get(src);});}
// Engine mount traversing must not overwrite fine-grained engine identities.
for(const p of Object.values(parts))if(p.enginePart)p.g.traverse(m=>{if(m.isMesh)m.userData.part=p.id;});
selectionBox=new THREE.BoxHelper(new THREE.Object3D(),'#d8f578');selectionBox.visible=false;scene.add(selectionBox);raycaster=new THREE.Raycaster();createFlow();createPartsUI();bind();resize();setView('exterior');updateUI();window.supraLab={state,parts,engine,drive,scene,camera,renderer,flowDots,gasPuffs,setView,setExplode,togglePart,assemble,select,step,version:'2.0.0-authored-mesh'};bindStudioControls();requestAnimationFrame(frame);}
function makeGlow(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,1,32,32,30);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.23,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function curve(points){return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));}
function createFlow(){const glow=makeGlow();const definitions=[['fuel',curve([[.08,.35,1.55],[.05,.21,.6],[-.15,.23,-.6],[-.20,.98,-1.12]]),'#c6f271',18],['air',curve([[.58,.81,-1.68],[.45,.86,-1.10],[-.35,.98,-.85],[-.10,.83,-1.12]]),'#66ccef',22],['exhaust',curve([[.20,.82,-1.12],[.36,.88,-1.03],[.51,.74,-.98],[.38,.4,-.78],[.33,.23,-.35],[.34,.23,.5],[.52,.25,1.62],[.6,.28,2.35]]),'#ff9a62',38]];
for(const def of definitions){if(def[0]==='exhaust'&&drive.flowPaths.exhaust)def[1]=drive.flowPaths.exhaust;if(def[0]==='fuel'&&drive.flowPaths.fuel)def[1]=drive.flowPaths.fuel;}
for(const [type,path,color,count]of definitions){for(let i=0;i<count;i++){const material=new THREE.SpriteMaterial({map:glow,color,transparent:true,opacity:.8,depthWrite:false,depthTest:false});const dot=new THREE.Sprite(material);dot.scale.setScalar(type==='fuel'?.026:.044);carRoot.add(dot);flowDots.push({dot,type,path,t:i/count});}}
for(let i=0;i<42;i++){const dot=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:'#cbd6dc',opacity:0,depthWrite:false,transparent:true}));carRoot.add(dot);gasPuffs.push({dot,age:i/42,seed:i});}}
function connectedDrive(){const ids=['engineAssembly','clutch','gearbox','gearboxGears','driveshaft','differential'];return state.clutch&&state.gear>0&&ids.every(id=>!parts[id]||!parts[id].hidden);}
function engineCanRun(){return !parts.fuelLines.hidden&&!parts.fuelTank.hidden&&!parts.engineAssembly.hidden&&!parts['e:intake'].hidden&&!parts['e:head'].hidden&&!parts['e:crank'].hidden&&!parts['e:block'].hidden&&!parts['e:cams'].hidden&&!Array.from({length:6},(_,i)=>parts['e:p'+i]).some(p=>p.hidden);}
function step(dt){dt=Math.max(0,Math.min(dt,.12));if(!state.running)return;state.time+=dt;const canRun=engineCanRun();state.rpmTarget=canRun?(isRoadMode()?progressRpmTarget():900+state.throttle*60):0;state.rpm+=(state.rpmTarget-state.rpm)*Math.min(1,dt*2.8);if(!canRun&&state.rpm<15)state.rpm=0;const physicalSpin=state.rpm/60*TAU,spin=physicalSpin*(state.slow?1/35:1);state.phase=(state.phase+dt*spin)%(TAU*2);const ratio=[0,3.8,2.2,1.54,1.20,1.0,.79][state.gear]||0;const connected=connectedDrive()&&canRun;const wheelOmega=isRoadMode()?progressRoadSpeed(dt,connected):(connected?physicalSpin/ratio/3.27:0);const shaftOmega=connected?(isRoadMode()?wheelOmega*3.27:spin/ratio):0;state.drivePhase+=shaftOmega*dt;state.wheelPhase+=(isRoadMode()?wheelOmega:shaftOmega/3.27)*dt;state.speed=wheelOmega*.3335*3.6;if(isRoadMode())state.roadDistance+=state.speed/3.6*dt;
engine.update(state.phase,state.rpm>0,state.explode*.68,state.rpm);
for(const w of drive.wheelRotors||[]){if(w.g&&!w.front){const axle=parts[w.side<0?'halfshaftL':'halfshaftR'];if(!axle.hidden)w.g.rotation.x=state.wheelPhase;}else if(w.g)w.g.rotation.x=isRoadMode()?state.wheelPhase:0;else if(w.isObject3D)w.rotation.x=state.wheelPhase;}
for(const a of drive.shaftRotors||[]){const g=a.g||a;if(g.isObject3D)g.rotation[a.axis||'z']=state.drivePhase;}
for(const a of drive.gearRotors||[]){const g=a.g||a;if(g.isObject3D&&(g.name==='clutchRotor'||state.clutch&&!parts.clutch.hidden))g.rotation[a.axis||'z']=state.phase*(a.ratio||1);}
for(const a of drive.axleRotors||[]){const g=a.g||a;if(g.isObject3D)g.rotation.x=a.front&&!isRoadMode()?0:state.wheelPhase;}
const exhaustAvailable=!!Object.values(parts).find(p=>p.category==='flow'&&/exhaust|выхлоп|выпуск/i.test(p.id+' '+p.label)&&!p.hidden);const strength=state.rpm>10?(state.rpm/7000)*(.22+state.throttle/100*.78):0;state.exhaustStrength=strength;
for(const f of flowDots){f.t=(f.t+dt*(.11+state.rpm/7000*.8))%1;f.path.getPointAt(f.t,particlePoint);if(f.path.userData&&f.path.userData.parent)particlePoint.add(f.path.userData.parent.position);f.dot.position.copy(particlePoint);const routePart=f.path.userData&&parts[f.path.userData.partId];f.dot.visible=state.flow&&state.rpm>0&&['chassis','drive','exhaust'].includes(state.view)&&(!routePart||!routePart.hidden);f.dot.material.opacity=f.type==='exhaust'?.3+strength*.6:.65;}
const tail=(drive.tailPoint||new THREE.Vector3(.6,.28,2.35)).clone().add(parts.exhaust.g.position);for(const p of gasPuffs){p.age=(p.age+dt*(.25+strength*.9))%1;const a=p.age;p.dot.position.set(tail.x+Math.sin(p.seed*2.3+a*7)*a*.10,tail.y+a*.26+Math.cos(p.seed)*a*.07,tail.z+a*(.45+strength*1.3));p.dot.scale.setScalar(.055+a*(.11+strength*.24));p.dot.material.opacity=(1-a)*strength*.33;p.dot.visible=state.flow&&exhaustAvailable&&strength>0&&state.explode<.4&&['exterior','chassis','drive','exhaust'].includes(state.view);}
if(sound&&sound.enabled)sound.update();}
function frame(t){const elapsed=Math.max(0,(t-lastT)/1000)||0;lastT=t;state.frames++;state.explode+=(state.explodeTarget-state.explode)*(1-Math.exp(-Math.min(elapsed,.5)*5));if(Math.abs(state.explodeTarget-state.explode)<.0001)state.explode=state.explodeTarget;for(const p of Object.values(parts))if(!p.enginePart)p.g.position.copy(p.base).addScaledVector(p.offset,state.explode);applyViewVisibility();advanceSimulation(elapsed);if(!state.running)engine.update(state.phase,false,state.explode*.68,state.rpm);if(selectionBox.visible&&state.selected)selectionBox.setFromObject(parts[state.selected].g);if(t-lastUI>130){updateUI();lastUI=t;}updateSpeedExperience(elapsed);if(shouldRenderSpeedFrame())renderer.render(scene,camera);requestAnimationFrame(frame);}
function setBodyXray(on){state.bodyXray=on;$('cutaway').classList.toggle('active',on);for(const m of bodyMats){m.transparent=on||m.userData.originalTransparent;m.opacity=on?.075:m.userData.originalOpacity;m.depthWrite=!on&&!m.userData.originalTransparent;m.needsUpdate=true;}}
function setEngineXray(on){state.engineXray=on;engine.xray(on);$('engineXray').classList.toggle('active',on);}
function applyViewVisibility(){for(const p of Object.values(parts)){let visible=!p.hidden;const close=state.view==='engine'||state.view==='combustion';if(close&&p.category!=='engine')visible=false;if(state.view==='chassis'&&p.category==='cabin')visible=false;if(state.view==='drive'&&(p.category==='cabin'||p.id==='gearbox'||p.id==='frame'))visible=false;if(state.view==='combustion'&&['e:cover','e:head','e:cams','e:intake','e:exhaust','e:timing'].includes(p.id))visible=false;if(state.view==='exterior'&&!state.bodyXray&&state.explode<.012&&p.category!=='body'&&p.category!=='cabin'&&!/^wheel|^brake/.test(p.id)){if(p.category==='engine'&&parts.hood.hidden){}else visible=false;}p.g.visible=visible;}}
function setView(view){state.view=view;applyViewVisibility();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));setBodyXray(view!=='exterior');setEngineXray(view==='combustion'||view==='engine');camYaw=.82;camPitch=.14;camDist=6.8;camTarget.set(0,.55,0);if(view==='engine'||view==='combustion'){camTarget.set(-.11,.61,-1.14);camDist=view==='combustion'?1.48:1.85;camYaw=view==='combustion'?.58:.88;camPitch=.35;}if(view==='drive'){camTarget.set(0,.34,.25);camDist=5.7;camPitch=.5;}if(view==='chassis'){camPitch=.55;}if(view==='exhaust'){camTarget.set(.24,.30,.88);camDist=4.15;camYaw=2.68;camPitch=.29;}updateCamera();const names={exterior:'КУЗОВ',chassis:'ШАССИ',engine:'2JZ / ВНУТРИ',combustion:'СГОРАНИЕ',drive:'ТРАНСМИССИЯ',exhaust:'ВЫХЛОП / ГАЗОВЫЙ ПОТОК'};$('viewName').textContent=names[view];}
function setExplode(value){const newValue=value/100;camDist*= (1+.7*newValue)/(1+.7*state.explodeTarget);camTarget.y+=(state.view==='engine'||state.view==='combustion'?1.4:.55)*(newValue-state.explodeTarget);state.explodeTarget=newValue;$('explode').value=value;$('explodeValue').textContent=value+'%';updateCamera();}
function togglePart(id){const p=parts[id];p.hidden=!p.hidden;p.g.visible=!p.hidden;if(p.enginePart)engine.hide(p.engineId,p.hidden);applyViewVisibility();updatePartsUI();if(state.selected===id)select(id);}
function assemble(){for(const p of Object.values(parts)){p.hidden=false;p.g.visible=true;if(p.enginePart)engine.hide(p.engineId,false);}setExplode(0);applyViewVisibility();updatePartsUI();}
function select(id){state.selected=id;const p=parts[id];$('partTitle').textContent=p.label;$('partDesc').textContent=p.description;$('remove').disabled=false;$('remove').textContent=p.hidden?'Вернуть деталь':'Снять деталь';selectionBox.visible=!p.hidden;if(!p.hidden)selectionBox.setFromObject(p.g);updatePartsUI();}
function createPartsUI(){for(const p of Object.values(parts)){const b=document.createElement('button');b.className='part';b.id='part-'+p.id;b.innerHTML='<span class="part-dot"></span><span class="part-name"></span><span class="part-status">●</span>';b.querySelector('.part-name').textContent=p.label;b.onclick=()=>select(p.id);$('parts').appendChild(b);}const cats=[['all','Все'],['body','Кузов'],['chassis','Шасси'],['engine','2JZ'],['drive','Привод'],['cabin','Салон'],['flow','Потоки']];for(const [key,name]of cats){const b=document.createElement('button');b.textContent=name;b.dataset.filter=key;b.onclick=()=>{filter=key;updatePartsUI();};$('filters').appendChild(b);}updatePartsUI();}
function updatePartsUI(){let count=0;for(const p of Object.values(parts)){const b=$('part-'+p.id);const show=filter==='all'||p.category===filter;b.style.display=show?'flex':'none';b.classList.toggle('off',p.hidden);b.classList.toggle('selected',p.id===state.selected);b.querySelector('.part-status').textContent=p.hidden?'○':'●';if(show)count++;}$('partCount').textContent=count+' узлов';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));}
function updateCamera(){const fitDist=camDist*Math.max(1,1.55/(camera.aspect||1));camera.position.set(camTarget.x+fitDist*Math.sin(camYaw)*Math.cos(camPitch),camTarget.y+fitDist*Math.sin(camPitch),camTarget.z-fitDist*Math.cos(camYaw)*Math.cos(camPitch));camera.lookAt(camTarget);}
function resize(){const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();updateCamera();}
function pick(e){const r=$('view').getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);for(const h of raycaster.intersectObjects(carRoot.children,true)){const p=parts[h.object.userData.part];if(!p||p.hidden||(state.bodyXray&&p.category==='body'))continue;let visible=true;for(let o=h.object;o;o=o.parent)if(!o.visible)visible=false;if(visible)return p.id;}return null;}
function play(){state.running=!state.running;$('play').textContent=state.running?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-pressed',state.running);if(sound&&sound.enabled&&!state.running){sound.stopEffects();sound.gain.gain.cancelScheduledValues(sound.ctx.currentTime);sound.gain.gain.setTargetAtTime(0,sound.ctx.currentTime,.025);}}
function updateUI(){if(window.supraLab&&window.supraLab.progressDrive)updateGearProgressUI();if($('roofToggle')){$('roofToggle').classList.toggle('active',parts.targa.hidden);$('roofToggle').textContent=parts.targa.hidden?'Закрыть тарга':'Открыть тарга';}if(state.selected)$('remove').textContent=parts[state.selected].hidden?'Вернуть деталь':'Снять деталь';$('rpmValue').textContent=Math.round(state.rpm);$('speedValue').textContent=Math.round(state.speed||0);$('throttleValue').textContent=state.throttle+'%';$('clutchStatus').textContent=connectedDrive()?'ПРИВОД СВЯЗАН':'ПРИВОД РАЗОМКНУТ';$('clutchStatus').classList.toggle('warning',!connectedDrive());$('flowStrength').style.width=Math.round((state.exhaustStrength||0)*100)+'%';$('simStatus').textContent=!state.running?'ПАУЗА':engineCanRun()?'ДВИГАТЕЛЬ РАБОТАЕТ':'МЕХАНИЗМ РАЗОБРАН';const color=['#ff9b62','#ed7588','#66ccef','#b495ee'],names=['Раб. ход','Выпуск','Впуск','Сжатие'];for(let i=0;i<6;i++){const stroke=Math.floor(engine.cylinderCycle(i)/Math.PI),n=$('cy'+i);n.style.borderTopColor=color[stroke];n.querySelector('small').textContent=names[stroke];n.classList.toggle('fire',state.running&&stroke===0);}$('slow').classList.toggle('active',state.slow);}
async function toggleSound(){await window.supraLab.sampleAudio.toggle();}
function bind(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('play').onclick=play;$('throttle').oninput=e=>{state.throttle=+e.target.value;updateUI();};$('gear').onchange=e=>state.gear=+e.target.value;$('clutch').onclick=()=>{state.clutch=!state.clutch;$('clutch').classList.toggle('active',state.clutch);updateUI();};$('explode').oninput=e=>setExplode(+e.target.value);$('explodeAll').onclick=()=>setExplode(100);$('assemble').onclick=assemble;$('remove').onclick=()=>state.selected&&togglePart(state.selected);$('cutaway').onclick=()=>setBodyXray(!state.bodyXray);$('engineXray').onclick=()=>setEngineXray(!state.engineXray);$('flows').onclick=()=>{state.flow=!state.flow;$('flows').classList.toggle('active',state.flow);flowDots.forEach(p=>p.dot.visible=state.flow&&state.view!=='exterior');gasPuffs.forEach(p=>p.dot.visible=state.flow);};$('slow').onclick=()=>state.slow=!state.slow;$('sound').onclick=()=>toggleSound().catch(e=>{$('sound').textContent='Звук недоступен';console.warn(e.message);});$('resetCamera').onclick=()=>setView(state.view);$('photo').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='Supra-Mk4-Lab.png';a.click();};
const c=$('view');c.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);camYaw-=dx*.006;camPitch=Math.max(-.23,Math.min(1.4,camPitch+dy*.006));drag.x=e.clientX;drag.y=e.clientY;updateCamera();});c.addEventListener('pointerup',e=>{if(drag&&drag.moved<6){const id=pick(e);if(id)select(id);}drag=null;});c.addEventListener('pointercancel',()=>drag=null);c.addEventListener('wheel',e=>{e.preventDefault();camDist=Math.max(.8,Math.min(16,camDist*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();play();}});new ResizeObserver(resize).observe($('stage'));}

function bindStudioControls(){
 const setPaint=hex=>{for(const m of bodyMats)if(m.name==='carpaint')m.color.set(hex);for(const o of window.supraNative.paint)if(o.material.name==='carpaint')o.material.color.set(hex);};
 if($('paintWhite'))$('paintWhite').onclick=()=>{setPaint('#f0f0ed');$('paintWhite').classList.add('active');$('paintRed').classList.remove('active');};
 if($('paintRed'))$('paintRed').onclick=()=>{setPaint('#a90d22');$('paintRed').classList.add('active');$('paintWhite').classList.remove('active');};
 if($('roofToggle')){$('roofToggle').classList.remove('active');$('roofToggle').textContent='Открыть тарга';$('roofToggle').onclick=()=>{togglePart('targa');$('roofToggle').classList.toggle('active',parts.targa.hidden);$('roofToggle').textContent=parts.targa.hidden?'Закрыть тарга':'Открыть тарга';};}
 // An assembled/exploded shell is more readable than scattering every trim element independently.
 window.supraLab.native=window.supraNative;createSpeedExperience();createRimOptions();installRecordedAudio();installProgressDrive();
}
window.prepareSupraBody().then(()=>{try{setup();}catch(e){showStudioError(e);}}).catch(showStudioError);function showStudioError(e){$('error').hidden=false;$('error').textContent='Ошибка запуска 3D: '+e.message;console.error(e);}

// Self-contained speed presentation. Metres, seconds, rad/s; no external textures.
let speedExperience,lastSpeedFrameSignature;
function shouldRenderSpeedFrame(){const key=[state.rimStyle,state.running,state.phase,state.rpm,state.explode,state.view,state.selected,state.bodyXray,state.engineXray,state.flow,state.roadMode,state.roadDistance,camera.fov,...camera.position.toArray(),renderer.domElement.width,renderer.domElement.height,window.supraNative.paint[0]?.material.color.getHex(),Object.values(parts).map(p=>Number(p.hidden)).join('')].join('|');const draw=state.running||key!==lastSpeedFrameSignature;lastSpeedFrameSignature=key;return draw;}
function advanceSimulation(elapsed){let remaining=Math.min(.5,Math.max(0,elapsed));while(remaining>1e-8){const dt=Math.min(.05,remaining);step(dt);remaining-=dt;}}
function isRoadMode(){return state.roadMode&&state.view==='exterior'&&!state.bodyXray&&state.explode<.012;}
function createSpeedExperience(){
 const roadMaterial=new THREE.ShaderMaterial({uniforms:{distance:{value:0}},vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.0);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`precision highp float;varying vec3 world;uniform float distance;void main(){float x=world.x,z=world.z-distance;float grain=fract(sin(dot(floor(vec2(x,z)*75.0),vec2(12.9898,78.233)))*43758.5453);vec3 color=vec3(.082,.094,.112)+grain*.012;float dashed=1.0-step(3.0,mod(z+15000.0,9.0));float lanes=(1.0-smoothstep(.045,.08,abs(abs(x)-2.25)))*dashed;float edges=1.0-smoothstep(.045,.085,abs(abs(x)-4.6));color=mix(color,vec3(.69,.70,.65),max(lanes,edges));float shoulder=smoothstep(4.75,4.9,abs(x));color=mix(color,vec3(.22,.25,.25),shoulder);vec3 hazeDelta=world-cameraPosition;float haze=1.0-exp(-dot(hazeDelta,hazeDelta)*.0008);color=mix(color,vec3(.84,.85,.866),haze);gl_FragColor=vec4(color,1.0);}`});
 const road=new THREE.Mesh(new THREE.PlaneGeometry(22,240),roadMaterial);road.rotation.x=-Math.PI/2;road.position.y=-.006;road.visible=false;scene.add(road);
 const posts=new THREE.Group();scene.add(posts);const postMaterial=new THREE.MeshStandardMaterial({color:'#e8eceb',roughness:.7}),capMaterial=new THREE.MeshBasicMaterial({color:'#de5944'});
 for(let i=0;i<32;i++)for(const side of [-1,1]){const post=new THREE.Group();post.position.set(side*5.2,0,i*6-96);const shaft=new THREE.Mesh(new THREE.BoxGeometry(.06,.55,.10),postMaterial);shaft.position.y=.275;post.add(shaft);const cap=new THREE.Mesh(new THREE.BoxGeometry(.07,.10,.11),capMaterial);cap.position.y=.43;post.add(cap);posts.add(post);}posts.visible=false;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,12,64,64,62);g.addColorStop(0,'rgba(165,180,193,0)');g.addColorStop(.35,'rgba(165,180,193,.2)');g.addColorStop(.75,'rgba(196,210,220,.75)');g.addColorStop(.98,'rgba(132,147,160,.15)');g.addColorStop(1,'rgba(132,147,160,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(c);
 const blurs=[];for(const w of drive.wheelRotors){const disc=new THREE.Mesh(new THREE.PlaneGeometry(.47,.47),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.y=Math.PI/2;disc.position.x=w.side*.16;w.g.add(disc);disc.userData.speedBlur=true;blurs.push({mesh:disc,wheel:w});}
 speedExperience={road,posts,roadMaterial,blurs};window.supraLab.speedExperience=speedExperience;
 const button=$('roadMode');button.onclick=()=>{state.roadMode=!state.roadMode;button.classList.toggle('active',state.roadMode);updateSpeedExperience(0);};
}
function updateSpeedExperience(elapsed){
 if(!speedExperience)return;const road=isRoadMode()&&state.speed>.5;speedExperience.road.visible=road;speedExperience.posts.visible=road;speedExperience.roadMaterial.uniforms.distance.value=state.roadDistance;speedExperience.posts.children.forEach((p,i)=>p.position.z=-96+Math.floor(i/2)*6+(state.roadDistance%6));
 const radius=.3335,omega=(state.speed||0)/3.6/radius;for(const {mesh,wheel}of speedExperience.blurs){mesh.visible=!parts['wheel'+(wheel.front?'F':'R')+(wheel.side<0?'L':'R')].hidden&&state.explode<.012&&(isRoadMode()||!wheel.front);mesh.material.opacity=state.running?Math.min(.66,Math.max(0,(omega-10)/75)):0;}
 const fov=32+(road?Math.min(8,state.speed/25):0);camera.fov+=(fov-camera.fov)*(1-Math.exp(-Math.min(elapsed,.5)*4));if(Math.abs(camera.fov-fov)<.01)camera.fov=fov;camera.updateProjectionMatrix();
 if($('stageInfo'))$('stageInfo').textContent=state.roadMode?'ЗАЕЗД · РАЗМЕТКА И КОЛЁСА СВЯЗАНЫ СО СКОРОСТЬЮ':'СТЕНД · ЗАДНИЙ ПРИВОД / БЕЗ ДВИЖЕНИЯ ДОРОГИ';
 $('roadMode').classList.toggle('active',state.roadMode);$('slow').classList.toggle('active',state.slow);$('slow').textContent=state.slow?'×1/35':'×1';
}

// Original rim designs inspired by the supplied photos; no brand replicas.
function createRimOptions(){
 const T=THREE,styles=[{id:'white6',label:'Белые · 6 спиц',count:6,color:'#f7f5ef',width:.074,face:.087},{id:'white5',label:'Белая звезда · 5 спиц',count:5,color:'#f7f5ef',width:.093,face:.077},{id:'chrome',label:'Хром · глубокая полка',count:10,color:'#bac7d1',width:.029,face:.035,deep:true},{id:'bronze',label:'Бронза · 10 спиц',count:10,color:'#a67b43',width:.032,face:.070},{id:'stock',label:'Заводские'}];
 const chrome=new T.MeshPhysicalMaterial({color:'#c3ced5',metalness:1,roughness:.12,clearcoat:1}),black=new T.MeshStandardMaterial({color:'#1b2229',metalness:.55,roughness:.4});
 const collections=[];
 function add(parent,geometry,material,pos=[0,0,0]){const o=new T.Mesh(geometry,material);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function ring(parent,r,t,z,material){return add(parent,new T.TorusGeometry(r,t,12,96),material,[0,0,z]);}
 function make(style){const g=new T.Group();g.name='rim-'+style.id;const finish=new T.MeshPhysicalMaterial({color:style.color,metalness:style.id==='chrome'?1:.45,roughness:style.id==='chrome'?.14:.27,clearcoat:1,clearcoatRoughness:.16});
 const barrel=add(g,new T.CylinderGeometry(.258,.258,.26,96,1,true),black,[0,0,0]);barrel.rotation.x=Math.PI/2;
 const profile=[new T.Vector2(.247,.10),new T.Vector2(.255,.117),new T.Vector2(.270,.137),new T.Vector2(.274,.145),new T.Vector2(.273,.153),new T.Vector2(.266,.155),new T.Vector2(.254,.145),new T.Vector2(style.deep?.231:.251,style.deep?.055:.129)];const lip=add(g,new T.LatheGeometry(profile,96),style.deep?chrome:finish);lip.rotation.x=Math.PI/2;ring(g,.267,.005,.153,chrome);ring(g,.257,.005,-.125,black);
 const shape=new T.Shape(),w=style.width;shape.moveTo(.032,-w*.50);shape.lineTo(.095,-w*.60);shape.quadraticCurveTo(.18,-w*.64,.250,-w*.34);shape.lineTo(.255,w*.34);shape.quadraticCurveTo(.18,w*.62,.095,w*.60);shape.lineTo(.032,w*.5);shape.closePath();const spokeGeometry=new T.ExtrudeGeometry(shape,{depth:.020,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.004,bevelThickness:.004,curveSegments:12});const v=spokeGeometry.attributes.position;for(let i=0;i<v.count;i++){const r=Math.hypot(v.getX(i),v.getY(i));v.setZ(i,v.getZ(i)+style.face+(.129-style.face)*Math.pow(Math.min(1,r/.255),1.6));}spokeGeometry.computeVertexNormals();for(let i=0;i<style.count;i++){const spoke=add(g,spokeGeometry,finish);spoke.rotation.z=i*Math.PI*2/style.count;}
 const hub=add(g,new T.CylinderGeometry(.052,.053,.035,64),finish,[0,0,style.face+.014]);hub.rotation.x=Math.PI/2;
 const cap=add(g,new T.CylinderGeometry(.024,.024,.008,48),style.id==='bronze'?black:chrome,[0,0,style.face+.036]);cap.rotation.x=Math.PI/2;ring(g,.025,.002,style.face+.041,black);
 const boltGeo=new T.CylinderGeometry(.0043,.0043,.009,6);boltGeo.rotateX(Math.PI/2);const bolts=new T.InstancedMesh(boltGeo,chrome,style.deep?25:5),matrix=new T.Matrix4();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;matrix.makeTranslation(Math.cos(a)*.039,Math.sin(a)*.039,style.face+.039);bolts.setMatrixAt(i,matrix);}if(style.deep)for(let i=0;i<20;i++){const a=i*Math.PI*2/20;matrix.makeTranslation(Math.cos(a)*.248,Math.sin(a)*.248,.148);bolts.setMatrixAt(i+5,matrix);}g.add(bolts);
 const valve=add(g,new T.CylinderGeometry(.003,.003,.018,12),black,[.235,0,.15]);valve.rotation.x=Math.PI/2;return g;}
 for(const wheel of drive.wheelRotors){const stock=[];wheel.g.traverse(o=>{if(o.isMesh&&!o.userData.speedBlur&&o.material.name!=='rubber.002')stock.push(o);});const options={};for(const style of styles.filter(s=>s.id!=='stock')){const g=make(style);g.rotation.y=wheel.side*Math.PI/2;g.visible=false;g.traverse(o=>{if(o.isMesh)o.userData.part='wheel'+(wheel.front?'F':'R')+(wheel.side<0?'L':'R');});wheel.g.add(g);options[style.id]=g;}collections.push({wheel,stock,options});}
 const select=$('rimStyle');for(const style of styles){const option=document.createElement('option');option.value=style.id;option.textContent=style.label;select.appendChild(option);}
 function setStyle(id){if(!styles.some(s=>s.id===id))throw new Error('Unknown rim style '+id);for(const c of collections){c.stock.forEach(o=>o.visible=id==='stock');for(const [key,g]of Object.entries(c.options))g.visible=key===id;}state.rimStyle=id;select.value=id;for(const b of speedExperience.blurs)b.mesh.material.color.set(id==='bronze'?'#b99160':'#ffffff');}
 select.onchange=e=>setStyle(e.target.value);window.supraLab.rims={styles,collections,setStyle};setStyle('white6');
}

// Source: editboy23, Freesound 496171, CC0. Supra identity is the recorder's description.
// Real recording, not an oscillator. RPMs below are playback calibration, not measured source RPM.
const SUPRA_RECORDING_DATA = "__ENGINE_AUDIO_BASE64__";
// EwanPenman11 / Freesound 659544 / CC0: chopped recorded blow-off, NOT a verified native Supra flutter.
const TURBO_RECORDING_DATA = "__TURBO_AUDIO_BASE64__";
function installRecordedAudio(){
 const a={kind:'recordings',enabled:false,ctx:null,gain:null,layers:[],decoded:{},volume:.52,oscillators:0,loading:null,voices:new Set()};
 window.supraLab.sampleAudio=a;
 a.inspect=()=>({kind:a.kind,enabled:a.enabled,state:a.ctx?.state||'uninitialized',oscillators:0,decoded:a.decoded,master:a.gain?.gain.value||0,layers:a.layers.map(l=>({name:l.name,gain:l.gain.gain.value,rate:l.source.playbackRate.value})),volume:a.volume,flutterEvents:a.flutterEvents,pulsesScheduled:a.pulsesScheduled,flutterKind:'processed recorded blow-off, not original Supra flutter'});
 a.stopEffects=()=>{for(const s of a.voices){try{s.stop();}catch(_){} }a.voices.clear();};
 a.flutterEvents=0;a.pulsesScheduled=0;a.lastFlutter=-Infinity;a.shiftUntil=0;
 a.flutter=(reason='gear')=>{
  if(!a.enabled||!a.ctx||!a.turbo||!state.running||!engineCanRun())return false;
  const now=a.ctx.currentTime;if(now-a.lastFlutter<.12)return false;
  a.lastFlutter=now;a.shiftUntil=now+.24;a.flutterEvents++;
  const pattern=[0,.073,.158,.257,.374,.514];
  pattern.forEach((delay,i)=>{
   const src=a.ctx.createBufferSource(),gain=a.ctx.createGain();src.buffer=a.turbo;
   src.playbackRate.value=1.03-i*.065;const duration=.103-i*.006,start=now+delay;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.9*Math.pow(.77,i),start+.006);
   gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   src.connect(gain);gain.connect(a.gain);src.onended=()=>{a.voices.delete(src);src.disconnect();gain.disconnect();};
   a.voices.add(src);src.start(start,0,duration*src.playbackRate.value);src.stop(start+duration+.01);a.pulsesScheduled++;
  });return true;
 };
 a.update=()=>{
  if(!a.ctx||!a.gain)return;
  const t=a.ctx.currentTime,live=a.enabled&&state.running&&engineCanRun()&&state.rpm>50;
  a.gain.gain.setTargetAtTime(live?a.volume:0,t,.045);if(!live&&a.voices.size)a.stopEffects();
  const rpm=Math.max(900,Math.min(6900,state.rpm)),load=state.throttle/100;
  const x=(rpm-900)/6000,weights=x<.45?[1-x/.45,x/.45,0]:[0,1-(x-.45)/.55,(x-.45)/.55];
  for(let i=0;i<a.layers.length;i++){
   const l=a.layers[i];l.source.playbackRate.setTargetAtTime(Math.max(.30,Math.min(2,rpm/l.referenceRpm)),t,.085);
   l.gain.gain.setTargetAtTime(Math.sqrt(Math.max(0,weights[i]))*(.32+load*.40)*(t<a.shiftUntil?.30:1),t,.07);
  }
  a.filter.frequency.setTargetAtTime(1700+load*4900,t,.09);
 };
 const loop=(ctx,buffer,start,duration)=>{
  const sr=buffer.sampleRate,n=Math.floor(duration*sr),fade=Math.min(Math.floor(sr*.065),Math.floor(n/4)),off=Math.floor(start*sr),out=ctx.createBuffer(buffer.numberOfChannels,n-fade,sr);
  for(let ch=0;ch<buffer.numberOfChannels;ch++){
   const src=buffer.getChannelData(ch),dst=out.getChannelData(ch);
   for(let i=0;i<dst.length;i++)dst[i]=src[off+i]||0;
   for(let i=0;i<fade;i++){const q=i/fade;dst[i]=(src[off+n-fade+i]||0)*Math.cos(q*Math.PI/2)+(src[off+i]||0)*Math.sin(q*Math.PI/2);}
  }return out;
 };
 a.initialize=async()=>{
  if(a.loading)return a.loading;
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtor)throw new Error('Браузер не поддерживает Web Audio');
  const ctx=a.ctx=new AudioCtor();await ctx.resume();
  a.loading=(async()=>{
   const bytes=Uint8Array.from(atob(SUPRA_RECORDING_DATA),c=>c.charCodeAt(0));
   const buffer=await ctx.decodeAudioData(bytes.buffer);a.decoded.engine=buffer.duration;
   const turboBytes=Uint8Array.from(atob(TURBO_RECORDING_DATA),c=>c.charCodeAt(0));
   a.turbo=await ctx.decodeAudioData(turboBytes.buffer);a.decoded.turbo=a.turbo.duration;
   const filter=a.filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=4200;filter.Q.value=.55;
   const master=a.gain=ctx.createGain();master.gain.value=0;
   const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-13;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.008;compressor.release.value=.16;
   const analyser=a.analyser=ctx.createAnalyser();analyser.fftSize=2048;
   filter.connect(master);master.connect(compressor);compressor.connect(analyser);analyser.connect(ctx.destination);
   const specs=[{name:'low',start:12.4,duration:2.1,referenceRpm:2800},{name:'mid',start:18.1,duration:1.5,referenceRpm:3500},{name:'load',start:24.4,duration:1.25,referenceRpm:6200}];
   for(const spec of specs){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=loop(ctx,buffer,spec.start,spec.duration);source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(filter);source.start();a.layers.push({...spec,source,gain});}
   sound=a;setInterval(a.update,33);
  })();
  try{await a.loading;}catch(e){a.loading=null;await ctx.close();a.ctx=null;throw e;}
 };
 a.toggle=async()=>{
  if(!a.ctx||!a.gain)await a.initialize();
  await a.ctx.resume();a.enabled=!a.enabled;
  $('sound').classList.toggle('active',a.enabled);$('sound').setAttribute('aria-pressed',a.enabled);
  $('sound').textContent=a.enabled?'Звук Supra: вкл.':'Звук Supra';
  if(!a.enabled)a.stopEffects();a.update();
 };
 $('gear').onchange=e=>{
  const previous=state.gear,next=+e.target.value;if(previous===next)return;
  const shifting=state.running&&engineCanRun()&&previous>0&&next>0&&state.clutch&&!parts.gearbox.hidden;
  const boosted=state.rpm>2200&&state.throttle>20&&state.speed>1;
  state.gear=next;
  if(shifting){const ratios=[0,3.8,2.2,1.54,1.2,1,.79];state.rpm=Math.max(900,Math.min(6900,state.rpm*ratios[next]/ratios[previous]));if(boosted)a.flutter('gear');}
  updateUI();
 };
 $('throttle').oninput=e=>{
  const old=state.throttle,next=+e.target.value;
  const lifting=state.running&&state.rpm>2200&&old>25&&old-next>25&&state.speed>1&&connectedDrive();
  state.throttle=next;if(lifting)a.flutter('lift');updateUI();
 };
 if($('audioVolume'))$('audioVolume').oninput=e=>{a.volume=+e.target.value/100;$('audioVolumeValue').textContent=e.target.value+'%';a.update();};
 $('sound').title='Настоящая запись Supra с диностенда · обработка под обороты';
 $('sound').textContent='Звук Supra';
}

// Requested teaching mode: each gear has its own 0–100% acceleration range.
// Monotonic RPM bands and speed hand-off are deliberately not real gearbox physics.
function progressRange(){
 if(!state.progressRanges)state.progressRanges={};
 if(state.gear===0)return {rpmMin:900,rpmMax:6900,speedMin:0,speedMax:0};
 if(!state.progressRanges[state.gear]){const g=state.gear;const speeds=[0,35,70,110,155,205,260];state.progressRanges[g]={rpmMin:900*g,rpmMax:900*(g+1),speedMin:speeds[g-1],speedMax:speeds[g]};}
 return state.progressRanges[state.gear];
}
function progressRpmTarget(){const r=progressRange();return r.rpmMin+(r.rpmMax-r.rpmMin)*state.throttle/100;}
function setGearProgress(value){
 const previous=state.throttle,next=Math.max(0,Math.min(100,+value||0));
 const lifting=state.running&&state.rpm>1500&&previous>25&&previous-next>25&&state.speed>1&&connectedDrive();
 state.throttle=next;$('throttle').value=next;
 if(lifting&&window.supraLab.sampleAudio)window.supraLab.sampleAudio.flutter('lift');
 updateUI();
}
function setProgressGear(next){
 next=Math.max(0,Math.min(6,+next||0));const previous=state.gear;if(previous===next)return;
 const boosted=state.running&&engineCanRun()&&state.rpm>1500&&state.throttle>20&&state.speed>1&&connectedDrive();
 const currentRpm=state.rpm,currentSpeed=state.speed;
 state.gear=next;$('gear').value=next;
 if(next>previous&&previous>0){
  const speeds=[0,35,70,110,155,205,260];
  state.progressRanges[next]={rpmMin:Math.max(900,currentRpm),rpmMax:Math.min(6900,Math.max(900,currentRpm)+900),speedMin:currentSpeed,speedMax:Math.max(currentSpeed+20,speeds[next])};
  state.throttle=0;$('throttle').value=0;
 }else{
  const r=progressRange();state.throttle=Math.round(Math.max(0,Math.min(100,(currentRpm-r.rpmMin)/(r.rpmMax-r.rpmMin)*100)));$('throttle').value=state.throttle;
 }
 state.rpmTarget=progressRpmTarget();
 if(boosted&&next>0&&window.supraLab.sampleAudio)window.supraLab.sampleAudio.flutter('gear');
 updateUI();
}
function progressRoadSpeed(dt,connected){
 if(!connected){state.speed=0;return 0;}
 const r=progressRange(),target=r.speedMin+(r.speedMax-r.speedMin)*state.throttle/100;
 state.speed+=(target-state.speed)*(1-Math.exp(-dt*2.8));
 if(Math.abs(state.speed-target)<.0001)state.speed=target;
 return state.speed/3.6/.3335;
}
function updateGearProgressUI(){
 const road=isRoadMode()&&state.gear>0,r=progressRange();
 if($('progressLabel'))$('progressLabel').textContent=road?'Разгон передачи':'Газ';
 if($('rangeMin'))$('rangeMin').textContent=road?Math.round(r.rpmMin)+' RPM':'ХОЛОСТОЙ ХОД';
 if($('rangeMax'))$('rangeMax').textContent=road?Math.round(r.rpmMax)+' RPM':'ПОЛНЫЙ ГАЗ';
 if($('progressNote'))$('progressNote').textContent=road?'0–100% внутри передачи · ↑ передача: новый диапазон':'Учебный стенд · обычный газ';
}
function installProgressDrive(){
 state.progressRanges={};progressRange();
 window.supraLab.progressDrive={range:progressRange,setProgress:setGearProgress,setGear:setProgressGear};
 $('gear').onchange=e=>setProgressGear(e.target.value);
 $('throttle').oninput=e=>setGearProgress(e.target.value);
 updateGearProgressUI();
}
