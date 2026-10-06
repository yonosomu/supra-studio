'use strict';
window.prepareSupraBody=()=>new Promise((resolve,reject)=>{
 const bytes=Uint8Array.from(atob('__MODEL_BASE64__'),c=>c.charCodeAt(0));
 new GLTFLoader().parse(bytes.buffer,'',gltf=>{window.supraAuthoredAsset=gltf.scene;resolve(gltf.scene);},reject);
});
window.buildSupraBody=function(api){
 const T=THREE,{addPart,parts,drive}=api,asset=window.supraAuthoredAsset;
 if(!asset)throw new Error('Авторская геометрия не загружена');
 asset.updateMatrixWorld(true);const wheelRotors=[];const nodes=Array.from(asset.children);
 // Replace simplified cabin, not supplement it with overlapping placeholders.
 for(const [id,p] of Object.entries(parts))if(p.category==='cabin'){p.g.removeFromParent();delete parts[id];}
 const defs={
  hood:['hood','Капот','body',[0,1.40,-.25]],
  targa:['targa','Съёмная панель тарга','body',[0,2.0,0]],
  'door-left':['door-left','Левая дверь','body',[-1.35,.38,0]],
  'door-right':['door-right','Правая дверь','body',[1.35,.38,0]],
  shell:['body-shell','Кузов и внешние панели','body',[0,2.20,0]],
  'front-seats':['native-seats','Передние сиденья','cabin',[0,1.30,.6]],
  'dashboard-wipers':['native-wipers','Дворники и отделка','body',[0,1.8,-.3]],
  'badges-chrome':['native-badges','Эмблемы и хромированная отделка','body',[0,2.2,0]],
  spoiler:['spoiler','Заднее антикрыло','body',[0,1.80,1.10]],
  'rear-garnish':['native-garnish','Задняя панель','body',[0,2.2,.45]],
  'front-plate-mount':['native-plate-mount','Крепление переднего номера','body',[0,.6,-1.3]],
  mirrors:['native-mirrors','Боковые зеркала','body',[0,1.9,0]],
  'cabin-trim':['native-cabin','Салон и внутренняя отделка','cabin',[0,.90,.28]],
  'glass-lenses':['native-glass','Остекление и стёкла фар','body',[0,2.2,0]],
  grilles:['native-grilles','Решётки и вставки','body',[0,2.2,0]],
  'front-plate':['native-front-plate','Передний номер','body',[0,.6,-1.3]],
  'rear-plate':['native-rear-plate','Задний номер','body',[0,1.25,1.3]]
 };
 for(const node of nodes){
  if(node.name.startsWith('WHEEL')){
   const front=node.position.z<0,side=node.position.x<0?-1:1,suffix=(front?'F':'R')+(side<0?'L':'R'),id='wheel'+suffix;
   const p=parts[id];if(!p)throw new Error('Wheel linkage missing '+id);
   p.g.clear();p.label=(front?'Переднее ':'Заднее ')+(side<0?'левое':'правое')+' колесо';p.description='Полигональная геометрия колеса из авторской модели. Шина, диск и центр вращения сохранены.';
   const rotor=new T.Group();rotor.position.copy(node.position);node.position.set(0,0,0);rotor.add(node);p.g.add(rotor);wheelRotors.push({g:rotor,front,side});continue;
  }
  if(node.name.startsWith('brakes')||node.name==='source-exhaust'||node.name==='front-plate'||node.name==='front-plate-mount')continue;
  const d=defs[node.name];if(!d)throw new Error('Unmapped model node: '+node.name);
  const group=addPart(d[0],d[1],d[2],'Геометрия Toyota Supra A80 автора Lexyc16, адаптированная для интерактивного стенда. Разборка по представленным поверхностям и узлам, не по заводской ремонтной документации.',d[3]);group.add(node);
 }
 drive.wheelRotors=wheelRotors;
 // Physical paint/reflections on the real mesh, not a procedural replacement shell.
 const paint=[];
 for(const p of Object.values(parts))p.g.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
  const m=o.material;
  if(m&&m.name==='carpaint'){
   const fresh=new T.MeshPhysicalMaterial({name:'carpaint',color:'#f0f0ed',metalness:.06,roughness:.22,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1,side:T.DoubleSide});o.material=fresh;paint.push(o);
  }else if(m&&m.name==='tail lights'){
   const attribute=o.geometry.attributes.position,colors=[];
   for(let i=0;i<attribute.count;i++){const color=new T.Color(attribute.getZ(i)<0?'#ee8d24':'#8d0715');colors.push(color.r,color.g,color.b);}
   o.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));o.material=m.clone();o.material.color.set('#ffffff');o.material.vertexColors=true;o.material.transparent=false;o.material.opacity=1;
  }else if(m&&m.name==='lights11'){
   o.position.z+=.10;
  }else if(m&&m.name==='targa black'){
   o.material=new T.MeshPhysicalMaterial({name:'targa black',color:'#12171c',metalness:.30,roughness:.21,clearcoat:1,clearcoatRoughness:.15,side:T.DoubleSide});
  }else if(m&&m.name==='glass'){
   o.material=new T.MeshPhysicalMaterial({name:'glass',color:'#29353d',metalness:.1,roughness:.065,transparent:true,opacity:.30,depthWrite:false,clearcoat:1,side:T.DoubleSide});
  }
 });
 // Source scene did not include packed lamp/rubber maps; add actual 3D optics and own generated tread microtexture.
 const lamps=addPart('headlight-optics','Оптика передних фар','body','Три объёмных отражателя в каждой фаре, адаптированные к родной форме стекла.',[0,2.2,0]);
 const chrome=new T.MeshStandardMaterial({color:'#bac3cb',metalness:1,roughness:.13});
 const lens=new T.MeshPhysicalMaterial({color:'#7a8792',metalness:.7,roughness:.055,clearcoat:1,clearcoatRoughness:.05});
 const black=new T.MeshStandardMaterial({color:'#10171d',metalness:.3,roughness:.22});
 const glassGroup=parts['native-glass'].g;glassGroup.updateWorldMatrix(true,true);
 for(const side of [-1,1])for(const [x,r]of [[.405,.040],[.535,.044],[.667,.034]]){
  const ray=new T.Raycaster(new T.Vector3(side*x,.620,-3),new T.Vector3(0,0,1));
  const hit=ray.intersectObject(glassGroup,true).find(h=>h.point.z< -1.7);
  if(!hit)continue;
  const normal=hit.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();if(normal.z>0)normal.negate();
  const assembly=new T.Group();assembly.position.copy(hit.point).addScaledVector(normal,-.065);assembly.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),normal);lamps.add(assembly);
  const housing=new T.Mesh(new T.CylinderGeometry(r*1.18,r*1.10,.045,48),chrome);housing.rotation.x=Math.PI/2;assembly.add(housing);
  const face=new T.Mesh(new T.CylinderGeometry(r*.85,r*.85,.006,40),black);face.rotation.x=Math.PI/2;face.position.z=-.026;assembly.add(face);
  const ring=new T.Mesh(new T.TorusGeometry(r*.94,r*.065,12,48),chrome);ring.position.z=-.032;assembly.add(ring);
  const glass=new T.Mesh(new T.SphereGeometry(r*.76,36,24),lens);glass.scale.z=.28;glass.position.z=-.035;assembly.add(glass);
 }
 // Small bumper slats leave the actual authored curved opening intact.
 api.materials.paint.name='carpaint';
 const slats=addPart('front-slats','Планки переднего воздухозаборника','body','Вставки воздухозаборника в стиле белого автомобиля на референсе.',[0,2.2,0]);
 for(const y of [.375,.437])api.round(.87,.026,.035,.011,api.materials.paint,slats,[0,y,-2.157]);
 // Build a legal, original tire bump texture rather than depending on missing author image files.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#888';c.fillRect(0,0,256,256);c.strokeStyle='#333';c.lineWidth=3;
 for(let y=0;y<256;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(115,y+7);c.moveTo(141,y+7);c.lineTo(256,y);c.stroke();}for(const x of [80,128,176]){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();}
 const bump=new T.CanvasTexture(canvas);bump.wrapS=bump.wrapT=T.RepeatWrapping;bump.repeat.set(1,5);
 for(const w of wheelRotors)w.g.traverse(o=>{if(o.isMesh&&o.material.name==='rubber.002'){o.material=o.material.clone();o.material.color.set('#181b20');o.material.roughness=.80;o.material.bumpMap=bump;o.material.bumpScale=.0025;}});
 window.supraNative={asset,wheelRotors,paint,source:{author:'Lexyc16',license:'CC BY-NC 4.0',base:'Toyota Supra (A80) 1993'}};
 return window.supraNative;
};
