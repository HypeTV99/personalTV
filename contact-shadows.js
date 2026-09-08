import * as THREE from 'three';

// Bake height-weighted contact shadows once; blur in texture space, not per frame.
export function bakeContactShadows(scene, renderer) {
  const resolution=512,span=7;
  const target=new THREE.WebGLRenderTarget(resolution,resolution);
  const ping=new THREE.WebGLRenderTarget(resolution,resolution);
  const depth=new THREE.MeshDepthMaterial();
  depth.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), pow(1.0 - fragCoordZ, 2.5) * 0.75 );'
    );
  };
  const camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.001,2.7);
  camera.position.set(0,-.012,.3);camera.up.set(0,0,-1);camera.lookAt(0,1,.3);
  const excluded=[];
  scene.traverse(o=>{
    if(o.visible&&(o.isSprite||o.userData.excludeContactShadow||o.material?.blending===THREE.NoBlending)) {excluded.push(o);o.visible=false;}
  });
  const previousTarget=renderer.getRenderTarget(),previousClear=renderer.getClearColor(new THREE.Color()),previousAlpha=renderer.getClearAlpha();
  const previousOverride=scene.overrideMaterial,previousFog=scene.fog;
  scene.overrideMaterial=depth;scene.fog=null;
  renderer.setClearColor(0x000000,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
  scene.overrideMaterial=previousOverride;scene.fog=previousFog;excluded.forEach(o=>o.visible=true);
  const blurMaterial=new THREE.ShaderMaterial({
    uniforms:{source:{value:target.texture},direction:{value:new THREE.Vector2()}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`uniform sampler2D source;uniform vec2 direction;varying vec2 vUv;
      void main(){vec4 c=texture2D(source,vUv)*.227027;
      c+=(texture2D(source,vUv+direction*1.384615)+texture2D(source,vUv-direction*1.384615))*.316216;
      c+=(texture2D(source,vUv+direction*3.230769)+texture2D(source,vUv-direction*3.230769))*.070270;
      gl_FragColor=c;}`,
    depthTest:false,depthWrite:false
  });
  const blurScene=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blurMaterial);blurScene.add(quad);
  for(let i=0;i<3;i++) {
    blurMaterial.uniforms.source.value=target.texture;blurMaterial.uniforms.direction.value.set(1.8/resolution,0);
    renderer.setRenderTarget(ping);renderer.clear();renderer.render(blurScene,camera);
    blurMaterial.uniforms.source.value=ping.texture;blurMaterial.uniforms.direction.value.set(0,1.8/resolution);
    renderer.setRenderTarget(target);renderer.clear();renderer.render(blurScene,camera);
  }
  renderer.setRenderTarget(previousTarget);renderer.setClearColor(previousClear,previousAlpha);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshBasicMaterial({map:target.texture,transparent:true,depthWrite:false,toneMapped:false,opacity:.85,side:THREE.DoubleSide}));
  plane.rotation.x=Math.PI/2;plane.rotation.z=Math.PI;plane.position.set(0,-.009,.3);
  plane.userData.excludeContactShadow=true;scene.add(plane);
  depth.dispose();blurMaterial.dispose();quad.geometry.dispose();ping.dispose();
  return plane;
}
