import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// The exact same DOM desktop is projected on the laptop and used fullscreen.
// No screenshot, canvas imitation or second UI is involved in the handoff.
export class DesktopSurface {
  constructor(element, host) {
    this.element=element;
    this.renderer=new CSS3DRenderer();
    this.renderer.domElement.className='desktop-projection';
    host.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.object=new CSS3DObject(element);
    this.scene.add(this.object);
    this.fullscreen=false;
    element.classList.remove('hidden');
    element.classList.add('in-scene');
    element.inert=true;
    this.resize();
  }
  resize() {
    this.width=window.innerWidth;this.height=window.innerHeight;
    this.renderer.setSize(this.width,this.height);
    this.element.style.width=`${this.width}px`;
    this.element.style.height=`${this.height}px`;
  }
  attach(mesh) {
    this.mesh=mesh;
    mesh.material=new THREE.MeshBasicMaterial({color:0x000000,opacity:0,transparent:false,blending:THREE.NoBlending,side:THREE.DoubleSide});
    mesh.castShadow=false;mesh.receiveShadow=false;
    this.sync();
  }
  sync() {
    if(!this.mesh)return;
    this.mesh.updateWorldMatrix(true,false);
    this.mesh.matrixWorld.decompose(this.object.position,this.object.quaternion,this.object.scale);
    this.object.scale.x*=this.mesh.geometry.parameters.width/this.width;
    this.object.scale.y*=this.mesh.geometry.parameters.height/this.height;
  }
  render(camera) {
    if(this.fullscreen||!this.mesh)return;
    this.sync();
    this.renderer.render(this.scene,camera);
  }
  screenRect(camera) {
    this.mesh.updateWorldMatrix(true,false);
    const {width:w,height:h}=this.mesh.geometry.parameters;
    const points=[[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]].map(([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(this.mesh.matrixWorld).project(camera));
    const xs=points.map(p=>(p.x+1)*this.width/2),ys=points.map(p=>(1-p.y)*this.height/2);
    return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  }
  async expand(camera,reducedMotion) {
    const r=this.screenRect(camera);
    this.projectedTransform=this.element.style.transform;
    this.fullscreen=true;
    this.renderer.domElement.style.visibility='hidden';
    document.body.append(this.element);
    this.element.classList.remove('in-scene');
    this.element.style.transform='none';
    this.element.style.transformOrigin='0 0';
    const a=this.element.animate([
      {transform:`translate(${r.x}px,${r.y}px) scale(${r.w/this.width},${r.h/this.height})`},
      {transform:'translate(0px,0px) scale(1,1)'}
    ],{duration:reducedMotion?0:260,easing:'cubic-bezier(.22,.7,.2,1)'});
    await a.finished;
    this.element.inert=false;
  }
  async collapse(camera,reducedMotion) {
    const r=this.screenRect(camera);
    this.element.inert=true;
    const a=this.element.animate([
      {transform:'translate(0px,0px) scale(1,1)'},
      {transform:`translate(${r.x}px,${r.y}px) scale(${r.w/this.width},${r.h/this.height})`}
    ],{duration:reducedMotion?0:240,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
    await a.finished;
    a.cancel();
    this.fullscreen=false;
    this.element.classList.add('in-scene');
    this.element.style.transformOrigin='50% 50%';
    // CSS3DRenderer caches object transforms, so restore the cached projection
    // after the fullscreen animation has temporarily replaced the inline style.
    this.element.style.transform=this.projectedTransform;
    this.renderer.domElement.style.visibility='visible';
    this.render(camera);
  }
}
