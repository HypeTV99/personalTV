import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// All surrounding furniture lives here; the original MacBook remains in main.js.
export function buildRealisticScene(scene, top, renderer) {
  let seed = 4817;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  function texture(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = kind === 'wood' ? '#94704d' : '#b7b4ad'; g.fillRect(0,0,512,512);
    for(let i=0;i<14000;i++) {
      const v = Math.floor(70 + random()*140);
      g.fillStyle = `rgba(${v},${v},${v},${kind === 'wood' ? .07 : .22})`;
      g.fillRect(random()*512,random()*512,kind === 'wood' ? 20+random()*100 : 1,1);
    }
    if(kind === 'wood') for(let i=0;i<260;i++) {
      const y=random()*512; g.beginPath(); g.moveTo(0,y);
      g.bezierCurveTo(160,y+Math.sin(i)*18,310,y-Math.cos(i)*16,512,y+Math.sin(i)*8);
      g.strokeStyle=`rgba(49,29,15,${.025+random()*.12})`; g.lineWidth=.4+random(); g.stroke();
    }
    if(kind === 'fabric') {
      g.strokeStyle='rgba(35,30,25,.18)'; g.lineWidth=1;
      for(let i=0;i<512;i+=4) { g.beginPath(); g.moveTo(i,0);g.lineTo(i,512);g.moveTo(0,i);g.lineTo(512,i);g.stroke(); }
    }
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const grain=texture('wood'); grain.colorSpace=THREE.SRGBColorSpace;
  const weave=texture('fabric'), noise=texture('noise');
  const mat=(color,roughness=.6,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
  const wood=mat(0xffffff,.48,0,{map:grain,bumpMap:grain,bumpScale:.003});
  const steel=mat(0x343938,.37,.75), chrome=mat(0xbfc4c6,.23,.94);
  const black=mat(0x202323,.8), ivory=mat(0xe6e3da,.53), paper=mat(0xf3efdf,.94);
  const fabric=mat(0x9b7455,.93,0,{bumpMap:weave,bumpScale:.004});
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xe8e1d2,roughness:.24,clearcoat:.65,clearcoatRoughness:.2});
  const clay=mat(0xb36f4e,.87,0,{bumpMap:noise,bumpScale:.008});
  function mesh(geo,material,x,y,z,parent=scene) {
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(w,h,d,m,x,y,z,parent=scene,r=.01)=>mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),m,x,y,z,parent);
  const cyl=(r1,r2,h,m,x,y,z,p=scene)=>mesh(new THREE.CylinderGeometry(r1,r2,h,40),m,x,y,z,p);
  function tube(points,r,m,parent=scene) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,8,false),m,0,0,0,parent);
  }
  function lathe(points,m,x,y,z,p=scene) {return mesh(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),64),m,x,y,z,p);}
  function ring(r,t,m,x,y,z,p=scene) {const o=mesh(new THREE.TorusGeometry(r,t,10,48),m,x,y,z,p);o.rotation.x=Math.PI/2;return o;}

  // Seamless warm studio with fine surface grain and no architectural backdrop.
  scene.background=null;
  scene.fog=new THREE.Fog(0xd6d6d8,9,24);
  // A baked contact-shadow plane grounds the objects on the seamless backdrop.
  box(3.1,.1,1.45,wood,0,top-.05,0,scene,.025);
  for(const x of [-1.42,1.42]) {
    for(const z of [-.59,.59]) {
      box(.065,.85,.065,steel,x,.475,z);
      cyl(.042,.046,.045,black,x,.023,z);
      cyl(.026,.026,.045,chrome,x,.06,z);
    }
    box(.065,.075,1.24,steel,x,.86,0);
  }
  box(2.85,.08,.05,steel,0,.84,-.59);
  box(.66,.59,.94,ivory,-1.05,.59,0,scene,.018);
  for(const y of [.45,.72]) {
    box(.625,.251,.035,ivory,-1.05,y,.483);
    tube([[-1.18,y,.505],[-1.18,y,.541],[-.92,y,.541],[-.92,y,.505]],.009,chrome);
  }
  for(const x of [-1.31,-.79]) for(const z of [-.36,.36]) cyl(.025,.025,.05,black,x,.275,z);

  function printedSheet(x,y,z,w,h,angle,variant=0) {
    const c=document.createElement('canvas');c.width=768;c.height=1024;
    const g=c.getContext('2d');g.fillStyle='#eee7d6';g.fillRect(0,0,768,1024);
    g.fillStyle='#293e43';g.font='bold 18px sans-serif';g.fillText('STUDIO / ENGINEERING',55,57);
    g.fillStyle='#a58251';g.fillRect(55,78,658,4);
    g.fillStyle='#293338';g.font='bold 40px serif';g.fillText(variant?'Project brief':'System design notes',55,146);
    g.font='17px sans-serif';g.fillStyle='#69716b';g.fillText('WORKING DOCUMENT     /     SEPTEMBER 2026',55,183);
    const lines=['Designing systems that are reliable, observable and easy to maintain.',
      'The architecture separates application services from infrastructure.',
      'Each component has clear ownership and a small operational surface.',
      'Review service boundaries, deployment steps and recovery procedures.',
      'Measure latency and availability before introducing new dependencies.'];
    for(let section=0;section<3;section++) {
      const y0=240+section*220;
      g.font='bold 22px sans-serif';g.fillStyle='#344a4b';g.fillText(['01  Overview','02  Implementation','03  Next steps'][section],55,y0);
      g.font='18px serif';g.fillStyle='#4a4d46';
      for(let j=0;j<5;j++)g.fillText(lines[(j+section)%5],55,y0+38+j*27);
    }
    g.strokeStyle='#587878';g.lineWidth=2;g.strokeRect(55,876,658,72);
    g.font='italic 21px serif';g.fillStyle='#376278';g.fillText('Review: simplify the flow before the next iteration.',77,918);
    g.font='14px sans-serif';g.fillStyle='#6d7067';g.fillText('PRIVATE NOTES',55,987);g.fillText('0'+(variant+1),680,987);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const geo=new THREE.PlaneGeometry(w,h,12,16),a=geo.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=a.getX(i)/w+.5,v=a.getY(i)/h+.5;
      a.setZ(i,.009*Math.pow(u,8)*Math.pow(v,6));
    }
    geo.computeVertexNormals();
    const page=mesh(geo,new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,toneMapped:false}),x,y,z);
    page.rotation.set(-Math.PI/2,0,angle);return page;
  }
  // Stacked bent-metal document trays with thin rolled rims and supports.
  for(const y of [top+.024,top+.205]) {
    box(.59,.012,.73,steel,-1.15,y,.03);
    for(const x of [-1.442,-.858]) box(.012,.1,.73,steel,x,y+.052,.03);
    box(.59,.1,.012,steel,-1.15,y+.052,-.33);
    for(const x of [-1.438,-.862]) tube([[x,y+.104,.38],[x,y+.104,-.33]],.006,chrome);
    for(let i=0;i<9;i++) box(.49,.0018,.63,paper,-1.15+(random()-.5)*.008,y+.009+i*.002,.04,scene,.0004);
    printedSheet(-1.15,y+.027,.04,.487,.625,.006,y>top+.1?1:0);
  }
  for(const x of [-1.42,-.88]) for(const z of [-.29,.31]) cyl(.009,.009,.18,chrome,x,top+.105,z);

  // A loose stack moved clear of the laptop's footprint.
  for(let i=0;i<14;i++) {
    const s=box(.39,.0016,.48,paper,-.99,top+.001+i*.0018,.42,scene,.0003);
    s.rotation.y=-.12+(random()-.5)*.04;
  }
  printedSheet(-.99,top+.027,.42,.387,.475,-.12);

  // Cloth-covered binders: separate covers, inset page blocks, labels and metal eyelets.
  [0,1].forEach(i=>{
    const group=new THREE.Group();group.position.set(.94+i*.19,top,-.28);scene.add(group);
    const cover=mat(i?0x7a8272:0x3a494b,.85,0,{bumpMap:weave,bumpScale:.002});
    box(.122,.555,.365,paper,0,.29,0,group);
    for(const x of [-.072,.072])box(.012,.59,.41,cover,x,.3,0,group);
    box(.15,.59,.025,cover,0,.3,.203,group);
    box(.092,.2,.002,ivory,0,.39,.217,group,.001);
    for(let j=0;j<3;j++)box(.063,.003,.001,steel,0,.43-j*.035,.219,group,.0002);
    const hole=mesh(new THREE.CircleGeometry(.023,24),black,0,.115,.218,group);
    const eye=mesh(new THREE.TorusGeometry(.025,.004,10,32),chrome,0,.115,.22,group);
    for(let j=0;j<14;j++)box(.001,.001,.32,mat(0xc9c6ba,.95),.062,.08+j*.034,-.01,group,.0001);
  });

  // Open glazed mug, visible wall thickness, coffee and an attached curved handle.
  cyl(.105,.107,.009,wood,1.31,top+.005,.32);
  lathe([[0,0],[.05,0],[.063,.008],[.071,.035],[.075,.16],[.072,.176],[.064,.176],[.062,.16],[.057,.025],[0,.025]],ceramic,1.31,top+.01,.32);
  ring(.068,.004,ceramic,1.31,top+.185,.32);
  cyl(.062,.062,.002,mat(0x241007,.22),1.31,top+.173,.32);
  tube([[1.376,top+.158,.32],[1.432,top+.16,.32],[1.449,top+.115,.32],[1.427,top+.057,.32],[1.374,top+.054,.32]],.012,ceramic);
  ring(.059,.0012,mat(0x997044,.5),1.31,top+.175,.32);
  // Soft translucent vapor puffs rise, widen and dissolve above the coffee.
  const vaporCanvas=document.createElement('canvas');vaporCanvas.width=vaporCanvas.height=64;
  const vg=vaporCanvas.getContext('2d'),vgrad=vg.createRadialGradient(32,32,0,32,32,32);
  vgrad.addColorStop(0,'rgba(255,255,255,.5)');vgrad.addColorStop(.4,'rgba(255,255,255,.25)');vgrad.addColorStop(1,'rgba(255,255,255,0)');vg.fillStyle=vgrad;vg.fillRect(0,0,64,64);
  const vaporMap=new THREE.CanvasTexture(vaporCanvas);
  const steam=Array.from({length:14},(_,i)=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:vaporMap,transparent:true,opacity:0,depthWrite:false}));
    scene.add(sprite);return sprite;
  });
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  // Terracotta planter with a real opening, soil, stems and curved, veined leaves.
  const plant=new THREE.Group();plant.position.set(2.13,0,-.56);scene.add(plant);
  lathe([[0,.008],[.14,.008],[.158,.035],[.199,.36],[.21,.38],[.21,.407],[.187,.407],[.18,.36],[.145,.045],[0,.045]],clay,0,0,0,plant);
  ring(.199,.009,clay,0,.399,0,plant);
  cyl(.179,.179,.025,mat(0x30271c,1,0,{bumpMap:noise,bumpScale:.015}),0,.366,0,plant);
  for(let i=0;i<28;i++) { const a=random()*Math.PI*2,r=Math.sqrt(random())*.16;mesh(new THREE.IcosahedronGeometry(.005+random()*.005,0),mat(i%3?0x544331:0xab9f83,1),Math.cos(a)*r,.382,Math.sin(a)*r,plant); }
  for(let i=0;i<12;i++) {
    const a=i*2.399,h=.39+(i%4)*.145,reach=.22+(i%3)*.09;
    const end=[Math.cos(a)*reach,.38+h,Math.sin(a)*reach];
    tube([[0,.38,0],[Math.cos(a)*.08,.55,Math.sin(a)*.08],end],.005,mat(0x52613b,.8),plant);
    const geo=new THREE.PlaneGeometry(1,1,10,18),pos=geo.attributes.position;
    for(let j=0;j<pos.count;j++) {
      const u=pos.getX(j)*2,t=pos.getY(j)+.5;
      pos.setXYZ(j,u*.085*Math.pow(Math.sin(Math.PI*t),.8),t*.39,.06*Math.sin(t*Math.PI)-.035*u*u*Math.sin(Math.PI*t));
    }
    geo.computeVertexNormals();
    const leafMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.25+(i%3)*.015,.35,.19+(i%4)*.025),roughness:.44,side:THREE.DoubleSide,clearcoat:.25});
    const leaf=mesh(geo,leafMat,...end,plant);leaf.rotation.set(.35,a,-.4);
    tube([[0,0,0],[0,.19,.06],[0,.385,0]],.0015,mat(0x89945d,.7),leaf);
    for(let v=1;v<6;v++)for(const side of [-1,1])tube([[0,v*.05,.06*Math.sin(v*.05/.39*Math.PI)],[side*.055,(v+.55)*.05,.035]],.00065,mat(0x657847,.75),leaf);
  }

  // Sculpted executive chair: bent walnut shell, leather panels and exposed hardware.
  const chair=new THREE.Group();chair.position.set(.48,0,1.76);chair.rotation.y=-.36;scene.add(chair);
  const leather=new THREE.MeshPhysicalMaterial({color:0xa6835e,roughness:.56,clearcoat:.12,bumpMap:noise,bumpScale:.0015});
  const walnut=wood;
  function sculpt(w,h,d,m,x,y,z,bend=0) {
    const geo=new RoundedBoxGeometry(w,h,d,7,Math.min(.065,h*.3,d*.35));
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const u=p.getX(i)/(w/2),v=p.getY(i)/h;
      p.setZ(i,p.getZ(i)-bend*u*u+.035*v*v);
    }
    geo.computeVertexNormals();return mesh(geo,m,x,y,z,chair);
  }
  sculpt(.65,.05,.6,walnut,0,.51,0,.025);
  const seat=sculpt(.615,.12,.55,leather,0,.58,-.025,.015);
  const shell=sculpt(.61,.78,.055,walnut,0,1.02,.29,.095);shell.rotation.x=.14;
  for(const [y,h,z] of [[.78,.235,.215],[1.025,.22,.25],[1.258,.2,.28]]) {
    const panel=sculpt(.555,h,.092,leather,0,y,z,.08);panel.rotation.x=.14;
    for(const x of [-.17,.17]) {
      const button=mesh(new THREE.SphereGeometry(.01,12,8),leather,x,y,z-.049-.08*(x/.2775)**2,chair);button.scale.z=.35;
    }
  }
  const stitch=mat(0x9e8469,.96);
  for(const y of [.681,.893,1.134,1.344]) tube([[-.235,y,.165],[0,y,.24],[.235,y,.165]],.0015,stitch,chair);
  tube([[-.275,.598,-.26],[-.29,.598,.20],[.29,.598,.20],[.275,.598,-.26],[-.275,.598,-.26]],.002,stitch,chair);
  for(const x of [-.35,.35]) {
    tube([[x*.77,.5,.16],[x,.73,.15],[x,.76,-.14]],.016,chrome,chair);
    box(.083,.032,.37,walnut,x,.772,-.015,chair,.015);
    box(.078,.038,.355,leather,x,.799,-.025,chair,.018);
    for(const z of [-.14,.11]) {
      const bolt=cyl(.011,.011,.005,chrome,x,.758,z,chair);
    }
  }
  for(const x of [-.2,.2])tube([[x,.49,.12],[x,.63,.32],[x,1.03,.354]],.013,chrome,chair);
  box(.22,.055,.24,steel,0,.465,.035,chair,.018);
  tube([[.08,.465,.04],[.27,.452,.04],[.29,.452,-.05]],.008,chrome,chair);
  box(.075,.025,.04,black,.29,.452,-.06,chair,.011);
  for(const x of [-.2,.2])for(const y of [.73,1.02]) {
    const bolt=mesh(new THREE.CylinderGeometry(.013,.013,.009,20),chrome,x,y,.354,chair);bolt.rotation.x=Math.PI/2;
  }
  cyl(.042,.047,.26,black,0,.22,0,chair);cyl(.024,.024,.22,chrome,0,.405,0,chair);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5,x=Math.cos(a)*.34,z=Math.sin(a)*.34;
    tube([[0,.16,0],[x*.55,.12,z*.55],[x,.08,z]],.023,chrome,chair);
    cyl(.018,.018,.04,chrome,x,.065,z,chair);
    for(const dx of [-.022,.022]) {
      const wheel=cyl(.037,.037,.024,black,x+dx,.038,z,chair);wheel.rotation.z=Math.PI/2;
      const hub=cyl(.014,.014,.025,chrome,x+dx,.038,z,chair);hub.rotation.z=Math.PI/2;
    }
  }
  return (time) => {
    steam.forEach((p,i)=>{
      const life=((reducedMotion.matches?2.2:time)*.24+i/steam.length)%1;
      p.position.set(1.31+Math.sin(life*8+i*.7)*.025+life*.055,top+.185+life*.39,.32+Math.cos(life*6+i)*.016);
      p.scale.set(.036+life*.11,.06+life*.14,1);
      p.material.opacity=Math.sin(life*Math.PI)*.42;
      p.material.rotation=Math.sin(life*4+i)*.35;
    });
  };
}
