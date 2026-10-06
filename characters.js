// Rigged, motion-captured people (shared Mixamo skeleton). Idle / walk / run clips play on every
// character; aiming, punches, jumps, carjacks, swimming and falls are layered on top as bone poses.
import * as T from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

const CAST={soldier:{file:'soldier',height:1.8},michelle:{file:'michelle',height:1.68}};
const lib={ready:false,templates:{},clips:{}};
export const characterLib=lib;

export function loadCharacters(loader){
  if(!lib.promise)lib.promise=Promise.all(Object.entries(CAST).map(([id,c])=>loader.loadAsync('models/characters/'+c.file+'.glb').then(g=>[id,g]))).then(list=>{
    const gltf=Object.fromEntries(list);for(const id in gltf)lib.templates[id]=prepare(id,gltf[id]);
    const clip=(id,name)=>gltf[id].animations.find(a=>a.name===name),moves=['Idle','Walk','Run'];
    for(const id in gltf)lib.clips[id]=Object.fromEntries(moves.map(m=>[m.toLowerCase(),id==='soldier'?clip('soldier',m):bake(lib.templates.soldier,lib.templates[id],clip('soldier',m),clip('soldier','TPose'),clip(id,'TPose'))]));
    lib.ready=true;return lib;
  }).catch(e=>{console.warn('Character models unavailable, using simple figures',e);lib.promise=null;return null});
  return lib.promise;
}
function prepare(id,g){const root=g.scene;let hips=null;root.updateMatrixWorld(true);
  const bone={};root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}if(o.isBone){bone[o.name.replace(/^mixamorig:?/,"")]=o;if(!hips&&/Hips$/.test(o.name))hips=o}});
  // Toes point the way the character faces; the game wants everyone facing -Z.
  const toe=bone.LeftToeBase.getWorldPosition(new T.Vector3()).sub(bone.LeftFoot.getWorldPosition(new T.Vector3()));
  const box=new T.Box3().setFromObject(root),scale=CAST[id].height/(box.max.y-box.min.y);return{root,scale,minY:box.min.y,turn:toe.z>0?Math.PI:0}}
// Skeletons share bone names but not bone axes, so a clip is moved across as world-space rotation
// offsets from each character's own T-pose, sampled at 30 fps. Hip motion is scaled by hip height.
function bake(srcT,dstT,clip,srcPose,dstPose){
  const rig=t=>{const model=cloneSkinned(t.root),frame=new T.Group(),bones=[];frame.rotation.y=t.turn;frame.scale.setScalar(t.scale);frame.add(model);model.traverse(o=>{if(o.isBone)bones.push(o)});return{frame,model,bones,mixer:new T.AnimationMixer(model)}};
  const src=rig(srcT),dst=rig(dstT),byName=Object.fromEntries(src.bones.map(b=>[b.name.replace(/^mixamorig:?/,''),b])),key=b=>b.name.replace(/^mixamorig:?/,'');
  const pose=(r,c,t=0)=>{r.mixer.stopAllAction();const a=r.mixer.clipAction(c);a.play();r.mixer.setTime(t);r.frame.updateMatrixWorld(true)};
  pose(src,srcPose);const restS=new Map(src.bones.map(b=>[key(b),b.getWorldQuaternion(new T.Quaternion())])),hipS=byName.Hips.getWorldPosition(new T.Vector3());
  pose(dst,dstPose);const restD=new Map(dst.bones.map(b=>[b,b.getWorldQuaternion(new T.Quaternion())])),hipsD=dst.bones.find(b=>key(b)==='Hips'),hipD=hipsD.getWorldPosition(new T.Vector3()),ratio=(hipD.y-0)/(hipS.y||1);
  const rootQ=new Map(dst.bones.filter(b=>!b.parent.isBone).map(b=>[b,b.parent.getWorldQuaternion(new T.Quaternion())]));
  const times=[],rot=new Map(dst.bones.map(b=>[b,[]])),pos=[],n=Math.max(2,Math.round(clip.duration*30)+1),world=new Map(),q=new T.Quaternion(),v=new T.Vector3();
  const act=src.mixer.clipAction(clip);
  for(let i=0;i<n;i++){const t=Math.min(clip.duration,i/30);times.push(t);src.mixer.stopAllAction();act.play();src.mixer.setTime(t);src.frame.updateMatrixWorld(true);
    for(const b of dst.bones){const s=byName[key(b)];let w;
      if(s&&restS.has(key(b)))w=s.getWorldQuaternion(q).multiply(restS.get(key(b)).clone().invert()).multiply(restD.get(b)).clone();else w=restD.get(b).clone();
      world.set(b,w);const parent=b.parent.isBone?world.get(b.parent):rootQ.get(b);rot.get(b).push(...parent.clone().invert().multiply(w).toArray())}
    const off=byName.Hips.getWorldPosition(v).sub(hipS).multiplyScalar(ratio).add(hipD);pos.push(...hipsD.parent.worldToLocal(off).toArray())}
  const tracks=dst.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,rot.get(b)));tracks.push(new T.VectorKeyframeTrack(hipsD.name+'.position',times,pos));
  return new T.AnimationClip(clip.name,clip.duration,tracks)}

const UP=new T.Vector3(0,1,0),DOWN=new T.Vector3(0,-1,0);
const _a=new T.Vector3(),_b=new T.Vector3(),_c=new T.Vector3(),_d=new T.Vector3(),_e=new T.Vector3(),_f=new T.Vector3(),_r=new T.Vector3(),_h=new T.Vector3(),_n=new T.Vector3();
const _pa=new T.Vector3(),_pb=new T.Vector3(),_q=new T.Quaternion(),_q2=new T.Quaternion(),_wq=new T.Quaternion(),_pq=new T.Quaternion();
const RATES={aim:14,guard:12,hands:7,air:9,swim:4,down:6,reach:9,steer:10};

export function makePistol(){const g=new T.Group(),metal=new T.MeshStandardMaterial({color:'#1b1f24',metalness:.65,roughness:.38}),grip=new T.MeshStandardMaterial({color:'#2a2622',roughness:.8});
  const box=(w,h,d,m,x,y,z,rx=0)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.rotation.x=rx;b.castShadow=true;g.add(b);return b};
  box(.03,.032,.19,metal,0,.034,.055);box(.028,.022,.15,metal,0,.008,.04);box(.028,.105,.045,grip,0,-.045,-.018,.28);box(.006,.03,.05,metal,0,-.012,.05);
  const flash=new T.Mesh(new T.ConeGeometry(.045,.22,8).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}));flash.position.set(0,.034,.26);flash.visible=false;g.add(flash);
  g.userData={flash,muzzle:new T.Vector3(0,.034,.155)};return g}

export class Humanoid{
  constructor(kind='soldier',{tint=null,fallback=null,armed=false}={}){
    this.root=new T.Group();this.pivot=new T.Group();this.root.add(this.pivot);this.kind=kind;
    this.speed=0;this.back=false;this.time=Math.random()*10;this.weapon='fists';this.punchT=1;this.punchSide=1;this.recoil=0;this.reload=0;this.swimPhase=0;
    this.aimDir=new T.Vector3(0,0,-1);this.reachPoint=new T.Vector3();this.w={};this.target={};for(const k in RATES){this.w[k]=0;this.target[k]=0}
    const t=lib.ready&&lib.templates[kind];
    if(!t){this.simple=true;this.box=fallback?.();if(this.box)this.pivot.add(this.box);return}
    const model=cloneSkinned(t.root),inner=new T.Group();inner.add(model);inner.scale.setScalar(t.scale);inner.position.y=-t.minY*t.scale;inner.rotation.y=t.turn;this.pivot.add(inner);this.model=model;
    this.ownMaterials=[];if(tint){const c=new T.Color(tint);model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.multiply(c);this.ownMaterials.push(o.material)}})}
    this.b={};model.traverse(o=>{if(o.isBone)this.b[o.name.replace(/^mixamorig:?/,'')]=o});
    this.mixer=new T.AnimationMixer(model);this.act={};this.lw={idle:1,walk:0,run:0};
    for(const [name,clip] of Object.entries(lib.clips[kind])){const a=this.mixer.clipAction(clip);a.play();a.time=Math.random()*clip.duration;a.setEffectiveWeight(name==='idle'?1:0);this.act[name]=a}
    if(armed){this.gun=makePistol();this.gun.visible=false;this.root.add(this.gun)}
  }
  get ready(){return !this.simple}
  set(k,v){this.target[k]=v}
  punch(side){this.punchT=0;this.punchSide=side}
  fire(){this.recoil=1;if(this.gun){this.gun.userData.flash.visible=true;this.flashT=.05}}
  muzzle(out=new T.Vector3()){return this.gun?this.gun.localToWorld(out.copy(this.gun.userData.muzzle)):this.root.getWorldPosition(out).add(UP)}
  update(dt){
    this.time+=dt;for(const k in RATES)this.w[k]+=(this.target[k]-this.w[k])*Math.min(1,dt*RATES[k]);
    this.punchT=Math.min(1,this.punchT+dt/.36);this.recoil=Math.max(0,this.recoil-dt*9);this.reload=Math.max(0,this.reload-dt);
    if(this.flashT!==undefined){this.flashT-=dt;if(this.flashT<=0){this.gun.userData.flash.visible=false;this.flashT=undefined}}
    const w=this.w;this.pivot.rotation.x=-1.3*w.swim+w.down*Math.PI/2;this.pivot.position.y=w.down*.12+w.swim*.35;
    if(this.simple){this.simplePose();return}
    this.locomotion(dt);this.mixer.update(dt);this.root.updateMatrixWorld(true);this.layers();
  }
  locomotion(dt){const s=this.speed,still=this.w.swim>.5||this.w.down>.5;let wi,ww,wr;
    if(still||s<.05){wi=1;ww=wr=0}else if(s<1.8){ww=s/1.8;wi=1-ww;wr=0}else{wr=Math.min(1,(s-1.8)/2.2);ww=1-wr;wi=0}
    const k=Math.min(1,dt*9);this.lw.idle+=(wi-this.lw.idle)*k;this.lw.walk+=(ww-this.lw.walk)*k;this.lw.run+=(wr-this.lw.run)*k;
    for(const n in this.act)this.act[n].setEffectiveWeight(this.lw[n]);
    if(this.act.walk)this.act.walk.timeScale=(this.back?-1:1)*Math.min(1.7,Math.max(.55,s/1.35));if(this.act.run)this.act.run.timeScale=Math.min(1.45,Math.max(.8,s/4.4));
  }
  // Rotate a bone (in world space) so the segment to its child points along dir, blended by weight.
  point(name,childName,dir,weight=1){const bone=this.b[name],child=this.b[childName];if(!bone||!child||weight<.002)return;
    bone.getWorldPosition(_pa);child.getWorldPosition(_pb);_pb.sub(_pa);if(_pb.lengthSq()<1e-8)return;_pb.normalize();
    _q.setFromUnitVectors(_pb,_n.copy(dir).normalize());if(weight<1)_q.copy(_q2.identity().slerp(_q,weight));
    bone.getWorldQuaternion(_wq).premultiply(_q);bone.parent.getWorldQuaternion(_pq);bone.quaternion.copy(_pq.invert().multiply(_wq));bone.updateMatrixWorld(true)}
  turn(name,axis,angle){const bone=this.b[name];if(!bone||Math.abs(angle)<1e-4)return;_q.setFromAxisAngle(axis,angle);bone.getWorldQuaternion(_wq).premultiply(_q);bone.parent.getWorldQuaternion(_pq);bone.quaternion.copy(_pq.invert().multiply(_wq));bone.updateMatrixWorld(true)}
  pos(name,out){return this.b[name].getWorldPosition(out)}
  layers(){const w=this.w,fwd=_f.set(0,0,-1).applyQuaternion(this.root.quaternion),right=_r.set(1,0,0).applyQuaternion(this.root.quaternion);
    const arm=(side,upper,fore)=>{const s=side<0?'Left':'Right';return[s+'Arm',s+'ForeArm',s+'Hand',upper,fore]};
    // Pistol aim: right arm locked on the target, left hand cups the grip, chest follows the pitch.
    const pistol=this.weapon==='pistol'&&w.aim>.01,guard=Math.max(w.guard,this.weapon==='fists'?w.aim:0);
    if(pistol){const aw=w.aim*(1-Math.min(1,this.reload*1.6)),dir=_d.copy(this.aimDir).normalize(),pitch=Math.asin(Math.max(-1,Math.min(1,dir.y)));
      this.turn('Spine1',right,pitch*.22*aw);this.turn('Spine2',right,pitch*.22*aw);
      const yawOff=Math.atan2(-(dir.x*right.x+dir.z*right.z),-(dir.x*fwd.x+dir.z*fwd.z));this.turn('Spine1',UP,Math.max(-.9,Math.min(.9,yawOff))*.6*aw);
      const rd=_e.copy(dir).addScaledVector(UP,this.recoil*.28).normalize();
      this.point('RightArm','RightForeArm',dir,aw);this.point('RightForeArm','RightHand',rd,aw);this.point('RightHand','RightHandMiddle1',rd,aw);
      const grip=this.pos('RightHand',_h).addScaledVector(right,-.035).addScaledVector(UP,-.035);
      this.point('LeftArm','LeftForeArm',this.pos('LeftArm',_a).negate().add(grip).addScaledVector(UP,-.16).addScaledVector(right,.05),aw);
      this.point('LeftForeArm','LeftHand',this.pos('LeftForeArm',_a).negate().add(grip),aw);this.curlHand('Left',aw);
    }
    // Fists: boxing guard, then a straight punch from the requested side with the torso twisting into it.
    if(guard>.01||this.punchT<1){for(const side of[-1,1]){const out=_c.copy(right).multiplyScalar(side);const [a,f,h]=arm(side);
        this.point(a,f,_a.copy(fwd).multiplyScalar(.35).addScaledVector(DOWN,.9).addScaledVector(out,.2),guard);this.point(f,h,_b.copy(fwd).multiplyScalar(.7).addScaledVector(UP,.72).addScaledVector(out,-.25),guard)}}
    if(this.punchT<1){const p=this.punchT,e=p<.3?Math.sin(p/.3*Math.PI/2):1-(p-.3)/.7,side=this.punchSide?1:-1,[a,f,h]=arm(side);
      this.turn('Spine1',UP,side*.42*e);const chest=this.pos('Spine2',_h).addScaledVector(fwd,.78).addScaledVector(right,side*.04).addScaledVector(UP,.12);
      this.point(a,f,this.pos(a,_a).negate().add(chest),e);this.point(f,h,this.pos(f,_a).negate().add(chest),e)}
    if(w.hands>.01)for(const side of[-1,1]){const [a,f,h]=arm(side);this.point(a,f,_a.copy(UP).multiplyScalar(.8).addScaledVector(right,side*.55).addScaledVector(fwd,.08),w.hands);this.point(f,h,_b.copy(UP).addScaledVector(fwd,.1),w.hands)}
    if(w.reach>.01){this.point('RightArm','RightForeArm',this.pos('RightArm',_a).negate().add(this.reachPoint),w.reach);this.point('RightForeArm','RightHand',this.pos('RightForeArm',_a).negate().add(this.reachPoint),w.reach)}
    if(w.air>.01){this.point('RightUpLeg','RightLeg',_a.copy(fwd).multiplyScalar(.6).addScaledVector(DOWN,.8),w.air);this.point('RightLeg','RightFoot',_a.copy(DOWN).multiplyScalar(.8).addScaledVector(fwd,-.55),w.air);
      this.point('LeftUpLeg','LeftLeg',_a.copy(fwd).multiplyScalar(.1).addScaledVector(DOWN,1),w.air);this.point('LeftLeg','LeftFoot',_a.copy(DOWN).multiplyScalar(.6).addScaledVector(fwd,-.75),w.air);
      if(!pistol)for(const side of[-1,1]){const [a,f]=arm(side);this.point(a,f,_a.copy(right).multiplyScalar(side*.7).addScaledVector(UP,.25).addScaledVector(fwd,.15),w.air*.7)}}
    // Front crawl in the water: the body is pitched forward by the pivot, arms circle, legs flutter.
    if(w.swim>.01){this.pivot.getWorldQuaternion(_wq);const head=_h.set(0,1,0).applyQuaternion(_wq),face=_e.set(0,0,-1).applyQuaternion(_wq);this.swimPhase+=.016*(this.speed>.3?3.4:1.4);
      for(const side of[-1,1]){const ph=this.swimPhase+(side<0?Math.PI:0),[a,f,h]=arm(side),d=_a.copy(head).multiplyScalar(Math.cos(ph)).addScaledVector(face,Math.sin(ph)).addScaledVector(right,side*.18);
        this.point(a,f,d,w.swim);this.point(f,h,d,w.swim);const s=side<0?'Left':'Right',k=_b.copy(head).negate().addScaledVector(face,.2*Math.sin(this.time*9+(side<0?Math.PI:0)));this.point(s+'UpLeg',s+'Leg',k,w.swim);this.point(s+'Leg',s+'Foot',k,w.swim)}
      this.turn('Neck',right,.55*w.swim)}
    if(w.down>.01)for(const side of[-1,1]){const [a,f]=arm(side);this.pivot.getWorldQuaternion(_wq);const head=_h.set(0,1,0).applyQuaternion(_wq);this.point(a,f,_a.copy(right).multiplyScalar(side*.85).addScaledVector(head,.35),w.down*.85)}
    this.placeGun(pistol);
  }
  // Close a hand round a grip (fingers bend toward the palm).
  curlHand(s,k){const b=this.b,C=this.cv||(this.cv=Array.from({length:5},()=>new this.root.position.constructor()));if(!b[s+'HandMiddle1']||k<.01)return;
    const hand=this.pos(s+'Hand',C[0]),handDir=this.pos(s+'HandMiddle1',C[1]).sub(hand).normalize(),side=this.pos(s+'HandIndex1',C[2]).sub(this.pos(s+'HandPinky1',C[3])).normalize(),palm=C[4].crossVectors(handDir,side).multiplyScalar(s==='Right'?-1:1).normalize();
    for(const f of['Index','Middle','Ring','Pinky']){const n=s+'Hand'+f;this.point(n+'1',n+'2',_e.copy(handDir).multiplyScalar(.25).add(palm).normalize(),k);if(b[n+'3'])this.point(n+'2',n+'3',_e.copy(handDir).multiplyScalar(-.7).addScaledVector(palm,.7).normalize(),k)}}
  // Curl the right hand's fingers round the grip, then seat the pistol in the palm:
  // barrel along the forearm (or the aim line), slide on the index-finger side.
  placeGun(aiming){const g=this.gun;if(!g)return;g.visible=this.weapon==='pistol'&&this.w.swim<.5&&this.w.down<.5&&this.root.visible;if(!g.visible)return;
    const b=this.b,G=this.gv||(this.gv=Array.from({length:9},()=>new T.Vector3())),hand=this.pos('RightHand',G[0]),mid=this.pos('RightHandMiddle1',G[1]),handDir=G[2].copy(mid).sub(hand).normalize(),side=this.pos('RightHandIndex1',G[3]).sub(this.pos('RightHandPinky1',G[4])).normalize(),palm=G[5].crossVectors(handDir,side).negate().normalize();
    this.curlHand('Right',1);
    const fore=this.pos('RightForeArm',G[6]),barrel=G[7].copy(hand).sub(fore).normalize(),top=G[8].copy(side);
    if(aiming&&this.w.aim>.5&&this.reload<=0){barrel.copy(this.aimDir).addScaledVector(UP,this.recoil*.28).normalize();top.copy(UP)}
    top.addScaledVector(barrel,-top.dot(barrel)).normalize();const x=G[6].crossVectors(top,barrel).normalize(),grip=G[4].copy(hand).lerp(mid,.55).addScaledVector(palm,.02).addScaledVector(top,.05).addScaledVector(barrel,-.015);
    _wq.setFromRotationMatrix(new T.Matrix4().makeBasis(x,top,barrel));g.quaternion.copy(_q.copy(this.root.quaternion).invert().multiply(_wq));g.position.copy(this.root.worldToLocal(grip))}
  simplePose(){const ud=this.box?.userData;if(!ud?.arms)return;const w=this.w,move=this.speed>.2?Math.min(1,this.speed/3):0,t=this.time*(this.speed>4?12:8);
    ud.arms.forEach((m,i)=>m.rotation.x=w.swim>.5?Math.sin(t+i*Math.PI)*1.4:w.aim>.5?Math.PI/2:this.punchT<1&&i===this.punchSide?1.7:w.hands>.5?Math.PI:Math.sin(t+i*Math.PI)*.5*move);
    ud.legs.forEach((m,i)=>m.rotation.x=Math.sin(t+i*Math.PI)*.6*move);if(ud.gun)ud.gun.visible=this.weapon==='pistol'&&w.aim>.5}
  // Skinned geometry and textures are shared with the template; only per-person tints and the pistol are owned.
  dispose(){this.mixer?.stopAllAction();this.root.removeFromParent();for(const m of this.ownMaterials||[])m.dispose();this.gun?.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});if(this.simple)this.box?.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}
}
