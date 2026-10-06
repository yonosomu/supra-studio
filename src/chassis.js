/* Procedural A80 chassis, Three.js r160. Front -Z; metres; all part roots stay at origin.
 * Animation: wheelRotors / axleRotors rotate g.rotation.x; shaftRotors rotate
 * g.rotation.z; gearRotors rotate g.rotation[axis] at ratio * crank speed.
 * flowPaths contains CatmullRomCurve3 instances in assembled car coordinates.
 * Each curve has userData {partId, kind, parent}; apply parent.matrixWorld to
 * sampled points when the part is exploded. No engine, body, UI or particles.
 */
(function () {
  'use strict';
  window.buildSupraChassis = function (api) {
    const T = THREE, m = api.materials || api.mats;
    if (!m || typeof api.addPart !== 'function') throw new Error('Supra chassis requires addPart and mats');
    const wheelRotors = [], axleRotors = [], shaftRotors = [], gearRotors = [], flowPaths = [];
    const bronze = new T.MeshStandardMaterial({color:0x9d7950,metalness:.82,roughness:.3});
    const darkMetal = new T.MeshStandardMaterial({color:0x343b43,metalness:.78,roughness:.38});
    const treadMat = new T.MeshStandardMaterial({color:0x07090b,roughness:.99});
    const upholstery = new T.MeshStandardMaterial({color:0x25272b,roughness:.93});
    const gaugeMat = new T.MeshStandardMaterial({color:0x11171b,roughness:.4});
    const meshes = [], parts = [];
    const V = p => new T.Vector3(p[0],p[1],p[2]);
    function part(id,label,category,description,offset) {
      const g = api.addPart(id,label,category,description,offset);
      g.name = id; parts.push(g); return g;
    }
    function mesh(geo,mat,parent,pos=[0,0,0]) {
      const o = api.mesh(geo,mat,parent,pos);
      o.castShadow = true; o.receiveShadow = true; meshes.push(o); return o;
    }
    function round(w,h,d,r,mat,parent,pos) {
      const o = api.round(w,h,d,r,mat,parent,pos);
      o.castShadow = true; o.receiveShadow = true; meshes.push(o); return o;
    }
    function cyl(r,len,mat,parent,pos,axis='y') {
      // Explicit 48 sides rather than inheriting a low-poly helper default.
      const o = mesh(new T.CylinderGeometry(r,r,len,48,1),mat,parent,pos);
      if (axis === 'x') o.rotation.z = -Math.PI/2;
      if (axis === 'z') o.rotation.x = Math.PI/2;
      return o;
    }
    function torus(r,t,mat,parent,pos,axis='z') {
      const o = mesh(new T.TorusGeometry(r,t,10,64),mat,parent,pos);
      if (axis === 'x') o.rotation.y = Math.PI/2;
      if (axis === 'y') o.rotation.x = Math.PI/2;
      return o;
    }
    function group(parent,pos=[0,0,0]) {
      const g = new T.Group(); g.position.fromArray(pos); parent.add(g); return g;
    }
    function tube(points,r,mat,parent,segments=64) {
      const c = new T.CatmullRomCurve3(points.map(V),false,'centripetal');
      const o = mesh(new T.TubeGeometry(c,segments,r,10,false),mat,parent);
      o.userData.curve = c; return o;
    }
    function link(a,b,r,mat,parent) {
      const va=V(a), vb=V(b), delta=vb.clone().sub(va);
      const o=cyl(r,delta.length(),mat,parent,va.clone().add(vb).multiplyScalar(.5).toArray());
      o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return o;
    }
    function instances(geo,mat,parent,transforms) {
      const o=new T.InstancedMesh(geo,mat,transforms.length), d=new T.Object3D();
      transforms.forEach((t,i)=>{
        d.position.fromArray(t.p); d.rotation.set(...(t.r||[0,0,0]));
        d.scale.fromArray(t.s||[1,1,1]); d.updateMatrix(); o.setMatrixAt(i,d.matrix);
      });
      o.instanceMatrix.needsUpdate=true; o.castShadow=true; o.receiveShadow=true;
      parent.add(o); meshes.push(o); return o;
    }
    function lathe(profile,mat,parent,pos,axis='y') {
      const o=mesh(new T.LatheGeometry(profile.map(p=>new T.Vector2(p[0],p[1])),64),mat,parent,pos);
      if(axis==='x')o.rotation.z=-Math.PI/2;
      if(axis==='z')o.rotation.x=Math.PI/2;
      return o;
    }

    // Four independently removable wheels. All rotor pivots are actual hub centres.
    for (const front of [true,false]) for (const side of [-1,1]) {
      const z=front?-1.34:1.21, x=side*.795, suffix=(front?'F':'R')+(side<0?'L':'R');
      const p=part('wheel'+suffix,(front?'Front ':'Rear ')+(side<0?'left':'right')+' wheel','chassis',
        'Rounded 330 mm tire, bronze five-spoke rim, polished lip and five lug nuts.',[side*.8,.05,front?-.3:.3]);
      const rot=group(p,[x,.34,z]); rot.name='wheelRotor'+suffix;
      wheelRotors.push({g:rot,front,side});
      lathe([[.215,-.11],[.266,-.11],[.309,-.096],[.329,-.067],[.33,-.035],
        [.33,.035],[.329,.067],[.309,.096],[.266,.11],[.215,.11],[.215,-.11]],m.rubber,rot,[0,0,0],'x');
      lathe([[.195,-.092],[.216,-.092],[.221,-.08],[.218,.075],[.223,.092],[.223,.108],
        [.211,.108],[.201,.092],[.195,-.092]],bronze,rot,[0,0,0],'x');
      const outer=side*.105;
      torus(.216,.007,m.chrome,rot,[outer,0,0],'x');
      torus(.259,.0028,treadMat,rot,[side*.1105,0,0],'x');
      instances(new T.TorusGeometry(.328,.0024,8,64),treadMat,rot,
        [-.046,0,.046].map(sx=>({p:[sx,0,0],r:[0,Math.PI/2,0]})));
      const slashes=[];
      for(let i=0;i<12;i++) {
        const a=i*Math.PI/6;
        slashes.push({p:[0,.331*Math.cos(a),.331*Math.sin(a)],r:[a,0,.22],s:[.13,.002,.007]});
      }
      instances(new T.SphereGeometry(1,8,6),treadMat,rot,slashes);
      instances(new T.CapsuleGeometry(.016,.138,6,12),bronze,rot,
        Array.from({length:5},(_,i)=>{
          const a=i*Math.PI*2/5;
          return {p:[side*.082,.125*Math.cos(a),.125*Math.sin(a)],r:[a,0,0],s:[1,1,1.03]};
        }));
      cyl(.053,.033,bronze,rot,[side*.097,0,0],'x');
      cyl(.029,.008,darkMetal,rot,[side*.117,0,0],'x');
      instances(new T.SphereGeometry(.008,10,8),m.chrome,rot,Array.from({length:5},(_,i)=>{
        const a=i*Math.PI*2/5; return {p:[side*.12,.041*Math.cos(a),.041*Math.sin(a)],s:[.7,1,1]};
      }));
      const brake=part('brake'+suffix,suffix+' brake disc','chassis',
        'Ventilated cross-drilled disc on its own spinning hub; independent of tire.',[side*.53,.1,front?-.2:.2]);
      const br=group(brake,[side*.755,.34,z]); br.name='brakeRotor'+suffix;
      axleRotors.push({g:br,front,side,axis:'x'});
      // Annular disc avoids a solid slab; dark drill marks are geometry instances.
      lathe([[.064,-.012],[.168,-.012],[.173,-.008],[.173,.008],[.168,.012],[.064,.012],[.064,-.012]],
        m.steel,br,[0,0,0],'x');
      cyl(.063,.036,darkMetal,br,[0,0,0],'x');
      const drills=[];
      for(let i=0;i<24;i++) {
        const a=i*Math.PI/12,r=i%2?.148:.123;
        drills.push({p:[side*.0125,r*Math.cos(a),r*Math.sin(a)],s:[.18,1,1]});
      }
      instances(new T.SphereGeometry(.005,8,6),treadMat,br,drills);
      const cal=part('caliper'+suffix,suffix+' fixed caliper','chassis','Fixed red opposed-piston brake caliper.',
        [side*.6,.2,front?-.25:.25]);
      round(.084,.16,.087,.027,m.red,cal,[side*.752,.385,z+.142]);
      round(.089,.067,.046,.012,darkMetal,cal,[side*.752,.385,z+.181]);
      const sus=part('suspension'+suffix,suffix+' double-wishbone suspension','chassis',
        'Upper and lower wishbones, upright, damper and continuous helical coil spring.',[side*.48,.65,front?-.3:.3]);
      const sx=side*.58;
      for(const y of [.225,.45]) {
        link([side*.29,y,z-.16],[side*.71,y,z],.013,m.steel,sus);
        link([side*.29,y,z+.16],[side*.71,y,z],.013,m.steel,sus);
      }
      link([side*.70,.22,z],[side*.70,.47,z],.028,darkMetal,sus);
      cyl(.030,.23,m.blue,sus,[sx,.43,z]);
      cyl(.012,.19,m.chrome,sus,[sx,.61,z]);
      const coil=[];
      for(let j=0;j<=160;j++) {const u=j/160,a=u*7*Math.PI*2; coil.push([sx+.058*Math.cos(a),.34+u*.31,z+.058*Math.sin(a)]);}
      tube(coil,.008,m.red,sus,160);
      cyl(.073,.016,darkMetal,sus,[sx,.665,z]);
    }

    const frame=part('frame','Floor and subframes','chassis','Pressed floor pans, longitudinal boxed rails, transmission tunnel and crossmembers.',[0,-.6,0]);
    // Leave the centre tunnel open underneath so driveshaft and gearbox remain legible.
    for(const s of [-1,1]) {
      round(.58,.042,2.52,.018,darkMetal,frame,[s*.43,.255,.24]);
      round(.09,.11,3.39,.034,m.steel,frame,[s*.62,.22,-.05]);
      round(.052,.038,2.22,.015,m.steel,frame,[s*.31,.29,.25]);
    }
    for(const z of [-1.34,-.46,.78,1.21])round(1.22,.072,.095,.028,darkMetal,frame,[0,.22,z]);
    round(.21,.10,1.02,.04,darkMetal,frame,[0,.30,.48]);
    round(1.16,.045,.45,.018,darkMetal,frame,[0,.37,1.66]);
    const tank=part('fuelTank','Fuel tank','chassis','Rear-mounted contoured tank with straps, filler neck and sender.',[0,-.4,.8]);
    round(.97,.20,.53,.085,darkMetal,tank,[-.08,.29,1.80]);
    for(const x of [-.38,.22])round(.038,.207,.55,.017,m.steel,tank,[x,.29,1.80]);
    cyl(.055,.024,m.steel,tank,[-.14,.402,1.76]);
    tube([[-.46,.37,1.82],[-.65,.42,1.85],[-.72,.60,1.75]],.023,m.rubber,tank);

    const radiator=part('radiator','Radiator and twin fans','chassis','Aluminium front cooling core, side tanks and twin shrouded electric fans.',[0,.45,-.9]);
    round(1.11,.40,.075,.024,m.steel,radiator,[0,.54,-1.88]);
    for(const x of [-.58,.58])round(.071,.43,.094,.026,darkMetal,radiator,[x,.54,-1.88]);
    instances(new T.CylinderGeometry(.003,.003,1.06,6),darkMetal,radiator,
      Array.from({length:18},(_,i)=>({p:[0,.36+i*.020,-1.921],r:[0,0,Math.PI/2]})));
    for(const x of [-.29,.29]) {
      torus(.163,.020,m.black,radiator,[x,.54,-1.814]);
      cyl(.039,.042,m.black,radiator,[x,.54,-1.802],'z');
      instances(new T.SphereGeometry(1,12,8),m.black,radiator,Array.from({length:6},(_,i)=>{
        const a=i*Math.PI/3; return {p:[x+.10*Math.cos(a),.54+.10*Math.sin(a),-1.804],r:[0,0,a+.55],s:[.084,.027,.009]};
      }));
    }
    tube([[-.51,.73,-1.84],[-.48,.75,-1.60],[-.28,.69,-1.47]],.021,m.rubber,radiator);
    tube([[.53,.38,-1.84],[.44,.30,-1.58],[.15,.31,-1.40]],.023,m.rubber,radiator);
    const intercooler=part('intercooler','Front-mount intercooler','flow','Bar-and-plate charge-air core, rounded end tanks and turbo-side plumbing.',[0,-.15,-1.1]);
    round(.88,.23,.105,.021,m.chrome,intercooler,[0,.32,-2.09]);
    for(const s of [-1,1])round(.16,.24,.12,.049,m.steel,intercooler,[s*.51,.32,-2.075]);
    instances(new T.CylinderGeometry(.0025,.0025,.85,6),darkMetal,intercooler,
      Array.from({length:10},(_,i)=>({p:[0,.222+i*.021,-2.145],r:[0,0,Math.PI/2]})));
    tube([[.59,.32,-2.07],[.67,.40,-1.91],[.61,.59,-1.49],[.38,.70,-1.10]],.041,m.chrome,intercooler);
    tube([[-.59,.32,-2.07],[-.65,.43,-1.85],[-.59,.68,-1.51],[-.32,.72,-1.25]],.038,m.chrome,intercooler);
    const battery=part('battery','Battery','chassis','Rounded sealed battery with red positive cap, terminals and insulated leads.',[-.75,.65,-.3]);
    round(.27,.22,.25,.032,m.black,battery,[-.57,.56,-.83]);
    round(.29,.027,.27,.012,darkMetal,battery,[-.57,.68,-.83]);
    for(const s of [-1,1])cyl(.016,.032,m.chrome,battery,[-.57+s*.085,.709,-.83]);
    round(.045,.025,.045,.01,m.red,battery,[-.485,.722,-.83]);
    tube([[-.485,.72,-.83],[-.46,.74,-.63],[-.25,.54,-.62]],.007,m.red,battery);
    tube([[-.655,.72,-.83],[-.69,.64,-.64],[-.63,.34,-.62]],.007,m.black,battery);
    const airbox=part('airbox','Charge-air return duct','flow','Intercooler return to the existing engine intake, with flexible coupler.',[-.7,.45,-.65]);
    tube([[-.59,.32,-2.07],[-.59,.40,-1.82],[-.48,.56,-1.48],[-.35,.64,-1.17]],.027,m.chrome,airbox);
    cyl(.031,.065,m.blue,airbox,[-.35,.64,-1.17],'z');

    // Gearbox casing can be removed while its six visible ratios stay in place.
    const gearbox=part('gearbox','Six-speed gearbox casing','drive','Rounded bellhousing, ribbed six-speed case, tail housing and mounting foot.',[0,.55,-.25]);
    lathe([[.065,-.15],[.14,-.15],[.19,-.13],[.20,-.07],[.19,.05],[.115,.14],[.065,.14]],m.steel,gearbox,[-.15,.334,-.565],'z');
    cyl(.085,.29,m.steel,gearbox,[-.15,.334,-.295],'z');
    round(.29,.25,.54,.07,m.steel,gearbox,[-.15,.334,.085]);
    for(const z of [-.13,-.035,.06,.155,.25]) {
      const rib=torus(.137,.006,darkMetal,gearbox,[-.15,.334,z]); rib.scale.x=1.02; rib.scale.y=.92;
    }
    lathe([[.045,-.12],[.092,-.12],[.095,-.07],[.06,.09],[.045,.12]],m.steel,gearbox,[-.15,.334,.30],'z');
    round(.32,.040,.10,.018,m.black,gearbox,[-.15,.247,.25]);
    const clutch=part('clutch','Clutch and flywheel','drive','Independent flywheel, friction ring and pressure plate at engine/gearbox interface.',[-.45,.25,-.6]);
    const cr=group(clutch,[-.15,.334,-.706]); cr.name='clutchRotor';
    cyl(.146,.023,m.steel,cr,[0,0,0],'z');
    torus(.111,.018,darkMetal,cr,[0,0,.016]);
    cyl(.073,.034,m.steel,cr,[0,0,.021],'z');
    gearRotors.push({g:cr,axis:'z',ratio:1});
    const gearset=part('gearboxGears','Six-speed gearset','drive','Six paired meshing gear ratios on mainshaft and countershaft, exposed by removing casing.',[.45,.08,-.1]);
    cyl(.013,.67,m.chrome,gearset,[-.15,.334,-.01],'z');
    cyl(.012,.48,m.chrome,gearset,[-.15,.237,.06],'z');
    for(let i=0;i<6;i++) {
      const z=-.135+i*.073, r=.073-i*.006;
      for(const main of [true,false]) {
        const radius=main?r:.097-r, y=main?.334:.237;
        const g=group(gearset,[-.15,y,z]); g.name='gear'+(i+1)+(main?'Main':'Counter');
        cyl(radius-.004,.033,main?m.steel:bronze,g,[0,0,0],'z');
        torus(radius-.015,.005,darkMetal,g,[0,0,.018]);
        const teeth=Array.from({length:20},(_,j)=>{
          const a=j*Math.PI/10; return {p:[radius*Math.cos(a),radius*Math.sin(a),0],r:[0,0,a],s:[.006,.004,.016]};
        });
        instances(new T.SphereGeometry(1,8,6),main?m.steel:bronze,g,teeth);
        gearRotors.push({g,axis:'z',ratio:main?1:-r/(.097-r)});
      }
    }
    const shaft=part('driveshaft','Longitudinal driveshaft','drive','Spinning propeller shaft with paired universal joints and flanges.',[.35,-.35,.2]);
    const sr=group(shaft,[-.15,.35,.75]); sr.name='propellerShaftRotor';
    cyl(.028,.78,darkMetal,sr,[0,0,0],'z');
    for(const z of [-.38,.38]) {
      cyl(.047,.035,m.steel,sr,[0,0,z],'z');
      cyl(.013,.094,m.chrome,sr,[0,0,z],'x');
    }
    shaftRotors.push({g:sr,axis:'z',ratio:1});
    const diff=part('differential','Rear differential','drive','Rounded final-drive housing, input nose, bolted rear cover and cooling ribs.',[0,-.334,.45]);
    round(.35,.25,.29,.105,darkMetal,diff,[0,.35,1.21]);
    cyl(.067,.18,m.steel,diff,[-.15,.35,1.10],'z');
    round(.26,.22,.031,.07,m.steel,diff,[0,.35,1.369]);
    instances(new T.SphereGeometry(.008,10,6),m.chrome,diff,Array.from({length:8},(_,i)=>{
      const a=i*Math.PI/4;return {p:[.109*Math.cos(a),.35+.084*Math.sin(a),1.389]};
    }));
    for(const x of [-.08,0,.08])round(.012,.040,.20,.005,m.steel,diff,[x,.222,1.22]);
    for(const side of [-1,1]) {
      const p=part('halfshaft'+(side<0?'L':'R'),(side<0?'Left':'Right')+' rear halfshaft','drive',
        'Independent rotating rear axle with ribbed inner and outer CV boots.',[side*.45,-.20,.40]);
      const hr=group(p,[side*.47,.35,1.21]);hr.name='halfshaftRotor'+side;
      cyl(.019,.65,m.steel,hr,[0,0,0],'x');
      for(const x of [-.245,.245]) {
        lathe([[.022,-.06],[.039,-.055],[.045,-.035],[.042,0],[.045,.035],[.03,.055],[.022,.06]],
          m.rubber,hr,[x,0,0],'x');
        for(const dx of [-.03,0,.03])torus(.043,.005,m.black,hr,[x+dx,0,0],'x');
      }
      axleRotors.push({g:hr,front:false,side,axis:'x',kind:'halfshaft'});
    }

    const exhaust=part('exhaust','Turbo-back exhaust','flow','Downpipe, catalyst, rearward stainless exhaust, offset muffler and hollow polished tip.',[.65,-.23,.55]);
    const exhaustPoints=[[.38,.70,-.95],[.43,.53,-.83],[.40,.30,-.76],[.32,.20,-.70],
      [.32,.20,-.24],[.33,.20,.34],[.39,.21,.85],[.47,.24,1.26],[.59,.25,1.58],[.60,.28,1.99],[.60,.28,2.36]];
    const exhaustTube=tube(exhaustPoints,.029,m.chrome,exhaust,120), exhaustCurve=exhaustTube.userData.curve;
    exhaustCurve.userData={partId:'exhaust',kind:'exhaust',parent:exhaust}; flowPaths.push(exhaustCurve);
    // Named aliases preserve the array API while allowing explicit parent-side lookup.
    flowPaths.exhaust=exhaustCurve;
    round(.11,.095,.28,.045,darkMetal,exhaust,[.32,.20,-.35]);
    round(.22,.18,.47,.079,m.steel,exhaust,[.59,.255,1.90]);
    for(const z of [1.70,2.09])torus(.076,.006,darkMetal,exhaust,[.60,.28,z]);
    lathe([[.032,-.09],[.047,-.09],[.053,.065],[.053,.09],[.046,.09],[.044,.065],[.026,-.09]],
      m.chrome,exhaust,[.60,.28,2.27],'z');
    tube([[.47,.26,1.27],[.47,.35,1.29],[.57,.36,1.29]],.008,m.black,exhaust);
    const fuel=part('fuelLines','Fuel pump and supply line','flow','Rear electric pump, forward fuel feed, filter and protected return plumbing.',[-.62,-.1,.35]);
    cyl(.028,.12,m.steel,fuel,[-.39,.29,1.49],'z');
    cyl(.022,.08,m.red,fuel,[-.39,.29,1.40],'z');
    const fp=tube([[-.14,.405,1.76],[-.36,.40,1.64],[-.39,.29,1.49],[-.43,.25,1.17],
      [-.43,.25,.36],[-.43,.26,-.40],[-.36,.47,-.69],[-.25,.69,-.87]],.007,m.steel,fuel);
    fp.userData.curve.userData={partId:'fuelLines',kind:'fuel',parent:fuel};
    flowPaths.push(fp.userData.curve);flowPaths.fuel=fp.userData.curve;
    tube([[-.28,.67,-.87],[-.48,.38,-.58],[-.49,.26,.34],[-.49,.27,1.41],[-.22,.405,1.76]],.005,m.black,fuel);

    for(const side of [-1,1]) {
      const seat=part(side<0?'seatL':'seatR',side<0?'Left bucket seat':'Right bucket seat','cabin',
        'Sculpted reclining sports seat with side bolsters, headrest, stitched inset and mounting rails.',[side*.55,.7,.18]);
      const x=side*.40;
      round(.36,.13,.44,.06,upholstery,seat,[x,.435,.38]);
      const back=group(seat,[x,.70,.61]);back.rotation.x=-.13;
      round(.35,.47,.11,.048,upholstery,back,[0,0,0]);
      round(.23,.31,.025,.011,m.black,back,[0,-.005,-.064]);
      for(const s of [-1,1])round(.078,.41,.15,.034,upholstery,back,[s*.151,-.012,-.033]);
      round(.22,.14,.095,.043,upholstery,back,[0,.287,0]);
      for(const s of [-1,1]) {
        round(.066,.125,.35,.028,upholstery,seat,[x+s*.157,.51,.38]);
        round(.024,.030,.45,.01,m.steel,seat,[x+s*.123,.353,.38]);
      }
      round(.021,.16,.041,.009,m.red,seat,[x-side*.195,.475,.50]);
    }
    const dash=part('dashboard','Dashboard and instruments','cabin','Rounded cockpit dash with three recessed round gauges, needles, vents and glove box.',[0,.72,-.45]);
    round(1.32,.24,.30,.085,m.black,dash,[0,.83,-.34]);
    round(.47,.18,.12,.065,m.black,dash,[-.35,.93,-.205]);
    for(let i=0;i<3;i++) {
      const x=-.50+i*.14,r=i===1?.068:.050;
      cyl(r,.010,m.chrome,dash,[x,.941,-.136],'z');
      cyl(r-.006,.013,gaugeMat,dash,[x,.941,-.127],'z');
      const ticks=[];
      for(let j=0;j<12;j++){const a=j*Math.PI/6;ticks.push({p:[x+(r-.016)*Math.cos(a),.941+(r-.016)*Math.sin(a),-.118],r:[0,0,a],s:[.005,.0015,.001]});}
      instances(new T.SphereGeometry(1,6,4),m.chrome,dash,ticks);
      link([x,.941,-.115],[x-r*.45,.941+r*.45,-.115],.0018,m.red,dash);
    }
    for(const x of [-.59,.17,.36,.58]) {
      round(.105,.065,.02,.019,darkMetal,dash,[x,.833,-.18]);
      instances(new T.CylinderGeometry(.002,.002,.085,6),m.black,dash,
        Array.from({length:3},(_,i)=>({p:[x,.812+i*.019,-.166],r:[0,0,Math.PI/2]})));
    }
    round(.40,.089,.021,.022,upholstery,dash,[.43,.759,-.191]);
    round(.067,.008,.018,.004,m.chrome,dash,[.43,.771,-.174]);
    const steering=part('steering','Steering wheel and column','cabin','Three-spoke black steering wheel with polished spokes and angled steering column.',[-.6,.6,-.2]);
    const sw=group(steering,[-.40,.84,-.02]);sw.rotation.x=-.30;
    torus(.153,.017,m.black,sw,[0,0,0]);
    cyl(.043,.033,m.black,sw,[0,0,0],'z');
    for(const a of [Math.PI/6,5*Math.PI/6,3*Math.PI/2])link([0,0,0],[.132*Math.cos(a),.132*Math.sin(a),0],.011,m.steel,sw);
    link([-.40,.84,-.02],[-.40,.71,-.43],.024,darkMetal,steering);
    const console=part('console','Console, shifter and handbrake','cabin','Rounded transmission console with six-speed shifter, leather gaiter, handbrake and HVAC knobs.',[.1,.7,.5]);
    round(.22,.16,.79,.045,m.black,console,[0,.45,.15]);
    round(.18,.27,.065,.025,darkMetal,console,[0,.66,-.215]);
    round(.12,.047,.075,.010,gaugeMat,console,[0,.71,-.177]);
    for(const x of [-.056,0,.056])cyl(.016,.016,m.chrome,console,[x,.61,-.173],'z');
    round(.10,.048,.12,.018,upholstery,console,[0,.55,.06]);
    link([0,.57,.06],[0,.70,.085],.011,m.chrome,console);
    mesh(new T.SphereGeometry(.028,24,16),m.black,console,[0,.71,.085]);
    link([.066,.54,.24],[.066,.62,.37],.016,m.black,console);
    torus(.038,.007,darkMetal,console,[0,.537,.44],'y');

    const tailPoint=new T.Vector3(.60,.28,2.36);
    // Metadata is additive: the requested five keys retain their exact types.
    return {wheelRotors,shaftRotors,gearRotors,flowPaths,tailPoint,axleRotors,
      exhaustCurve,fuelCurve:flowPaths.fuel,parts,meshCount:meshes.length,
      materials:[bronze,darkMetal,treadMat,upholstery,gaugeMat]};
  };
})();
