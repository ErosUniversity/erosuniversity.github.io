// Ink wash look for the Wu Shi walk: every surface writes "how much ink" (r) and "how much seal red" (g),
// a paper pass turns that into brush washes, dry outlines and scroll paper.
import * as THREE from "three";

const NOISE = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.; a*=.5; } return s; }
`;

// one set of air per scene: fog density, far distance, ground mist (height, strength), light direction
export const air = { fog:{ value:.05 }, far:{ value:60 }, mist:{ value:new THREE.Vector2(1,0) }, fogInk:{ value:0 }, light:{ value:new THREE.Vector3(.4,.8,.5) } };

export function inkMat(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms:{ uTone:{ value:o.tone ?? .8 }, uSeal:{ value:o.seal ?? 0 }, uMap:{ value:o.map ?? null }, uUseMap:{ value:o.map ? 1 : 0 },
      uFlat:{ value:o.flat || o.map ? 1 : 0 }, uForm:{ value:o.form ?? 0 }, uVcol:{ value:o.vcol ?? 0 }, uInv:{ value:o.inv ?? 0 }, uFog:air.fog, uFogInk:air.fogInk, uFar:air.far, uMist:air.mist, uLight:air.light },
    vertexColors:!!o.vcol, transparent:!!o.map, depthWrite:!o.map, side:o.side ?? THREE.FrontSide,
    polygonOffset:!!o.map, polygonOffsetFactor:-2, polygonOffsetUnits:-2,
    vertexShader:`
      varying vec3 vN; varying vec3 vW; varying float vD; varying vec2 vUv; varying float vCol;
      #include <skinning_pars_vertex>
      void main(){
        vec3 transformed=position; vec3 objectNormal=normal;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vec4 p=vec4(transformed,1.); vec3 n=objectNormal;
        #if defined(USE_COLOR_ALPHA) || defined(USE_COLOR)
          vCol=color.r;
        #else
          vCol=0.;
        #endif
        #ifdef USE_INSTANCING
          p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
        #endif
        vec4 w=modelMatrix*p; vW=w.xyz; vN=normalize(mat3(modelMatrix)*n);
        vec4 mv=viewMatrix*w; vD=-mv.z; vUv=uv; gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform float uTone,uSeal,uUseMap,uFog,uFogInk,uFar,uFlat,uForm,uVcol,uInv; varying float vCol; uniform vec2 uMist; uniform vec3 uLight; uniform sampler2D uMap;
      varying vec3 vN; varying vec3 vW; varying float vD; varying vec2 vUv;
      ${NOISE}
      void main(){
        float a=1.;
        if(uUseMap>.5){ a=texture2D(uMap,vUv).a; if(a<.01) discard; }
        vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
        float mk=clamp(vCol*uVcol,0.,1.); float ink=uTone*mix(1.-mk, .05+mk*1.7, uInv);   // vertex colour: painted markings, bright = bare paper
        if(uFlat<.5){
          float ndl=dot(n,normalize(uLight))*.5+.5;
          vec2 q=abs(n.y)>.7 ? vW.xz : vec2(vW.x+vW.z, vW.y);
          ink*=mix(1.,.62,ndl)*(.75+.5*fbm(q*vec2(3.,.6)));
          ink=clamp(ink+(uForm>0. ? uForm*pow(1.-ndl,2.) : uForm*pow(ndl,2.)),0.,1.);   // form: shadows on white things, highlights on black ones
        }
        float fog=1.-exp(-pow(vD*uFog,1.4));
        float mist=mix(1.-uMist.y,1.,smoothstep(0.,uMist.x,vW.y));
        ink=mix(ink*mist,uFogInk,fog);
        gl_FragColor=vec4(ink*(1.-uSeal), uSeal*(1.-fog*.7), clamp(vD/uFar,0.,1.), a);
      }` });
}

export class InkRenderer {
  constructor() {
    this.r = new THREE.WebGLRenderer({ antialias:false, preserveDrawingBuffer:true });
    this.r.setClearColor(new THREE.Color(0, 0, 1), 1);
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples:4, colorSpace:THREE.NoColorSpace });
    this.post = new THREE.ShaderMaterial({
      uniforms:{ tD:{ value:this.rt.texture }, uRes:{ value:new THREE.Vector2(4, 4) }, uSeed:{ value:0 }, uSky:{ value:0 } },
      depthTest:false, depthWrite:false,
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader:`
        uniform sampler2D tD; uniform vec2 uRes; uniform float uSeed,uSky; varying vec2 vUv;
        ${NOISE}
        const vec3 PAPER=vec3(.953,.910,.812), INK=vec3(.11,.102,.094), SEAL=vec3(.659,.196,.165);
        void main(){
          vec2 px=1./uRes;
          // the hand is never quite steady
          vec2 wob=(vec2(vnoise(vUv*uRes/90.+uSeed), vnoise(vUv*uRes/90.+uSeed+31.))-.5)*5.*px;
          vec2 uv=vUv+wob;
          vec4 c=texture2D(tD,uv);
          float o=1.6;
          vec4 l=texture2D(tD,uv-vec2(o*px.x,0.)), r=texture2D(tD,uv+vec2(o*px.x,0.)), u=texture2D(tD,uv+vec2(0.,o*px.y)), d=texture2D(tD,uv-vec2(0.,o*px.y));
          float eInk=abs(l.r-r.r)+abs(u.r-d.r);
          float eDep=(abs(l.b-r.b)+abs(u.b-d.b))/(c.b+.04);
          float near=1.-smoothstep(.25,.85,min(min(l.b,r.b),min(u.b,d.b)));
          float dry=smoothstep(.3,.62,fbm(vUv*uRes/vec2(46.,7.)+uSeed));
          float line=clamp(smoothstep(.07,.26,eInk)+smoothstep(.12,.5,eDep),0.,1.)*near*(.4+.6*dry);
          float gran=fbm(vUv*uRes/2.5);
          float bloom=fbm(vUv*uRes/170.+uSeed*2.);
          float ink=c.r*(.74+.42*bloom)+(gran-.5)*.14*c.r;
          ink=mix(ink, floor(ink*5.+.5)/5., .3);
          ink+=uSky*smoothstep(.5,1.,vUv.y)*step(.999,c.b)*(.3+.7*bloom);
          float tot=clamp(ink+line*.8,0.,1.);
          float fib=fbm(vec2(vUv.x*uRes.x*.012, vUv.y*uRes.y*.35));
          vec3 col=mix(PAPER*(1.-.07*fib), INK, pow(tot,.68));
          col=mix(col, SEAL*(.9+.2*gran), clamp(c.g,0.,1.));
          vec2 v=vUv-.5; col*=1.-.22*dot(v,v);
          gl_FragColor=vec4(col,1.);
        }` });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.qc = new THREE.Camera();
  }
  get canvas() { return this.r.domElement; }
  setSize(w, h) { this.r.setSize(w, h, false); this.rt.setSize(w, h); this.post.uniforms.uRes.value.set(w, h); }
  render(scene, camera, look = {}) {
    air.fog.value = look.fog ?? .05; air.fogInk.value = look.fogInk ?? 0; this.r.setClearColor(new THREE.Color(air.fogInk.value, 0, 1), 1); air.far.value = look.far ?? 60;
    air.mist.value.set(...(look.mist ?? [1, 0])); air.light.value.set(...(look.light ?? [.4, .8, .5]));
    this.post.uniforms.uSeed.value = look.seed ?? 0; this.post.uniforms.uSky.value = look.sky ?? 0;
    this.r.setRenderTarget(this.rt); this.r.clear(); this.r.render(scene, camera);
    this.r.setRenderTarget(null); this.r.render(this.qs, this.qc);
  }
}
