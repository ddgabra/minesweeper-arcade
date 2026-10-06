// On-foot play shares the highway's world, vehicles, wallet and simulation clock.
import {Humanoid,makePistol} from './characters.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleTo=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const CLIP=12;
export class StreetLife {
  constructor(ctx){
    Object.assign(this,ctx);this.ctx=ctx;this.parked=[];this.stations=[];this.npcs=[];this.blocks=[];this.debris=[];
    this.onFoot=false;this.firstPerson=false;this.input={};this.wanted=0;this.heat=0;this.snacks=0;this.cans=0;this.fuel=100;this.driftScore=0;this.combo=0;this.best=0;
    this.weapon='pistol';this.ammo=CLIP;this.reserve=96;this.reloadT=0;this.camYaw=0;this.camPitch=-.12;this.aimBlend=0;this.enter=null;this.exiting=null;this.wastedT=0;this.knockT=0;this.punchSide=1;
    this.actor={x:0,y:0,z:0,s:ctx.run.player.s,d:0,yaw:0,health:100,stamina:100,swimming:false,vx:0,vz:0,vy:0,lift:0};
    const T=ctx.T;this.aimRay={o:new T.Vector3(),d:new T.Vector3(0,0,-1)};
    this.hero=new Humanoid('soldier',{armed:true,fallback:()=>this.person('#4ee0c0')});this.avatar=this.hero.root;this.avatar.visible=false;ctx.scene.add(this.avatar);
    this.viewWeapon=makePistol();this.viewWeapon.visible=false;ctx.scene.add(this.viewWeapon);
    this.tracer=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#ffe6a0',transparent:true,opacity:.85}));this.tracer.visible=false;this.tracer.frustumCulled=false;ctx.scene.add(this.tracer);
    this.installUI();
    const locked=()=>document.pointerLockElement&&document.pointerLockElement===document.getElementById('driveCanvas');
    this.pointerMove=e=>{if(!this.onFoot||!locked())return;const k=this.input.aim?.0016:.0026;this.camYaw+=e.movementX*k;this.camPitch=clamp(this.camPitch-e.movementY*k,-1.2,.75)};
    document.addEventListener('mousemove',this.pointerMove);
    this.mouseDown=e=>{if(!this.onFoot||ctx.run.paused||e.target.id!=='driveCanvas')return;if(!locked()){e.target.requestPointerLock?.();if(e.button!==2)return}
      if(e.button===2){e.preventDefault();this.input.aim=true}if(e.button===0)this.attack(this.weapon==='pistol'?'shot':this.punchSide?'left':'right')};
    this.mouseUp=e=>{if(e.button===2)this.input.aim=false};this.contextMenu=e=>{if(this.onFoot&&e.target.id==='driveCanvas')e.preventDefault()};
    this.wheel=e=>{if(!this.onFoot||e.target.id!=='driveCanvas')return;e.preventDefault();this.switchWeapon()};
    document.addEventListener('mousedown',this.mouseDown);document.addEventListener('mouseup',this.mouseUp);document.addEventListener('contextmenu',this.contextMenu);document.addEventListener('wheel',this.wheel,{passive:false});
  }
  mesh(w,h,d,color,parent,x=0,y=0,z=0){const T=this.T,m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  // Simple figure, only used if the character models fail to load.
  person(color){const T=this.T,g=new T.Group();this.mesh(.48,.65,.3,color,g,0,1.05,0);this.mesh(.34,.36,.32,'#c99370',g,0,1.58,0);this.mesh(.35,.09,.33,'#42352c',g,0,1.78,0);for(const x of[-.08,.08])this.mesh(.045,.045,.02,'#252a30',g,x,1.62,-.17);
    const arms=[];for(const x of[-.34,.34]){const a=new T.Group();a.position.set(x,1.32,0);this.mesh(.16,.55,.17,color,a,0,-.22,0);g.add(a);arms.push(a)}
    const legs=[];for(const x of[-.15,.15]){const l=new T.Group();l.position.set(x,.77,0);this.mesh(.2,.68,.22,'#263248',l,0,-.32,0);g.add(l);legs.push(l)}
    const gun=this.mesh(.12,.15,.42,'#26303c',arms[1],0,-.48,-.14);gun.rotation.x=-Math.PI/2;gun.visible=false;g.userData={arms,legs,gun};return g;
  }
  label(text,parent,x,y,z,w=6){const T=this.T,c=document.createElement('canvas');c.width=768;c.height=144;const g=c.getContext('2d');g.fillStyle='#12272b';g.fillRect(0,0,768,144);g.fillStyle='#c8ff73';g.font='bold 56px system-ui';g.textAlign='center';g.fillText(text,384,91);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,w*144/768),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m}
  installUI(){
    document.getElementById('streetHUD')?.remove();const hud=document.createElement('div');hud.id='streetHUD';hud.innerHTML='<div class="street-title"><b>STREET LIFE</b><span id="streetMode">BEHIND THE WHEEL</span></div><div id="streetStats"></div><div id="streetHint"></div><div class="street-progress"><i id="streetProgress"></i></div>';document.querySelector('.drive-stage').append(hud);this.ui=hud;
    this.actions=document.createElement('div');this.actions.className='street-actions';
    for(const[label,fn]of[['Exit / enter · F',()=>this.vehicleKey()],['Visit gas station',()=>this.visit()],['Helicopter · 6',()=>this.setCamera(5)],['Top view · 7',()=>this.setCamera(6)],['Controls · ?',()=>{this.help.hidden=!this.help.hidden}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;this.actions.append(b)}
    document.querySelector('.drive-hud').after(this.actions);
    this.help=document.createElement('div');this.help.className='street-help';this.help.hidden=true;this.help.innerHTML='<b>STREET LIFE · CONTROLS</b><p><strong>F</strong> get out of / into a car. Walk up to a car with someone inside and press <strong>F</strong> to pull the driver out. <strong>E</strong> interact (shelves, pumps, hold up the attendant).</p><p>Click the scene to lock the mouse; the mouse moves the camera, <strong>Esc</strong> releases it. <strong>WASD</strong> move relative to the camera, <strong>Shift</strong> sprint, <strong>Alt</strong> walk, <strong>Space</strong> jump, <strong>← →</strong> turn the camera. <strong>V</strong> first / third person.</p><p><strong>Right mouse / G</strong> aim over the shoulder. <strong>Left mouse / H</strong> fire. <strong>R</strong> reload. <strong>Tab</strong>, mouse wheel, <strong>1 / 2</strong> fists / pistol. With fists, <strong>left mouse</strong> or <strong>J / K</strong> punch. Aim at the attendant and hold <strong>E</strong> to rob the register. Drivers stop for pedestrians in front of them and for a gun pointed at them.</p><p><strong>Z</strong> eat snack. <strong>X</strong> use fuel can near your car. <strong>R</strong> while swimming calls a rescue. Water disables your car; swim ashore before stamina runs out.</p><p><strong>6 / 7</strong> helicopter / top view. <strong>Space</strong> handbrake while driving. Select Drift Playground and a free drift car in the garage. Hold a slide to build your combo.</p><button type="button">Got it</button>';this.help.querySelector('button').onclick=()=>this.help.hidden=true;document.querySelector('.drive-stage').append(this.help);
    const note=document.querySelector('.drive-controls-note');this.oldNote=note.innerHTML;note.textContent='F exit / enter / carjack · WASD move · mouse camera · right mouse aim · left mouse fire / punch · R reload · Tab weapon · Space jump · E interact · ? controls';
  }
  buildStation(km){
    const T=this.T,s=this.stationS(km),p=this.worldFromRoad(s,0),root=new T.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=-p.th;root.userData.km=km;root.updateMatrixWorld(true);
    const st={km,s,root,blocks:[],robbedUntil:0,snacksTaken:false,fuelTaken:false,progress:0};this.stations.push(st);
    this.mesh(66,.14,88,'#454c52',root,38,.02,0);
    const block=(w,h,d,col,x,y,z,hp=Infinity,kind='wall')=>{const m=this.mesh(w,h,d,col,root,x,y,z),b={mesh:m,st,x,z,w,d,hp,max:hp,kind,broken:false};st.blocks.push(b);this.blocks.push(b);return m};
    // Open doorway faces the highway. Interior remains visible from aerial cameras.
    block(.5,4,22,'#d8d4c5',63,2,0);block(23,4,.5,'#d8d4c5',51.5,2,-11);block(23,4,.5,'#d8d4c5',51.5,2,11);
    block(.4,1,7,'#71858b',40,.5,-7.5);block(.4,1,7,'#71858b',40,.5,7.5);
    block(.15,2.2,7,'#91c7d1',40,2.1,-7.5,38,'window');block(.15,2.2,7,'#91c7d1',40,2.1,7.5,38,'window');
    const sign=this.label('HIGHWAY MART',root,39.7,4.5,0,14);sign.rotation.y=-Math.PI/2;
    this.mesh(22,.12,21,'#d4d2c3',root,51,.18,0);
    block(1.5,.9,12,'#2f7770',57,.65,0);this.mesh(.7,.45,.6,'#222d36',root,56.8,1.35,3);
    const clerk=this.addNPC(st,59,0,'#f2bc56','attendant');st.clerk=clerk;this.label('ATTENDANT',clerk.mesh,0,2.2,0,2.3).rotation.y=-Math.PI/2;
    st.shelf=block(1.2,1.8,7,'#677b8b',49,1.1,-6.5,75,'shelf');this.label('SNACKS · E',root,49,2.65,-6.5,5).rotation.y=-Math.PI/2;
    for(let row=0;row<3;row++)for(let j=0;j<7;j++)this.mesh(.5,.27,.5,['#e9c24f','#e6734f','#61cda5'][row],root,48.3,.6+row*.5,-9+j*.8);
    // A roof only over the pumps, high enough for trucks.
    this.mesh(13,.6,25,'#ecede5',root,26,5.8,0);this.mesh(13.2,.32,25.2,'#36b69b',root,26,6.1,0);
    for(const z of[-10,10])block(.5,5.7,.5,'#dadcdd',30,2.85,z,120,'post');
    for(const z of[-7,0,7]){block(1.2,1.9,1,'#3f8e83',24,1,z,60,'pump');this.mesh(1.23,.45,.72,'#b8fff0',root,24,1.45,z)}
    this.label('FUEL · E',root,22,3,0,6).rotation.y=-Math.PI/2;
    for(const z of[-24,24])block(2,1.3,1.3,'#e7a44b',35,.7,z,25,'crate');
    const gas=this.label('GAS + FOOD',root,15,7,30,10);gas.rotation.y=Math.PI;block(.5,7,.5,'#78848b',15,3.5,30,100,'sign');
    this.addNPC(st,36,15,'#c5758e','civilian');this.addNPC(st,33,-20,'#779ede','civilian');
    for(const [d,z,spec]of[[21,21,this.cars[0]],[46,24,this.cars[1]]]){const v=new this.Vehicle(spec,{kind:'parked',civilian:true});v.place(s-z,d,Math.PI,0);v.occupied=true;v.input.brake=1;this.scene.add(v.mesh.group);this.parked.push(v);v.station=st}
    root.updateMatrixWorld(true);return root;
  }
  // Pedestrians are rigged people; clothing colour varies per person.
  addNPC(st,x,z,color,role){const T=this.T,tint=new T.Color(color).lerp(new T.Color('#ffffff'),.55),h=new Humanoid('michelle',{tint,fallback:()=>this.person(color)}),g=h.root,p=st.root.localToWorld(new T.Vector3(x,0,z));
    const n={x:p.x,z:p.z,y:p.y,s:st.s-z,mesh:g,h,role,st,state:'idle',timer:0,health:100,home:{x:p.x,z:p.z},yaw:-Math.PI/2-st.root.rotation.y,seed:Math.random()*10};n.y+=this.floorAt(n);g.position.set(n.x,n.y,n.z);this.scene.add(g);this.npcs.push(n);return n}
  // Station slabs and the shop floor sit slightly above the ground.
  floorAt(p){for(const st of this.stations){if(!st.root.parent&&st.root!==p.st?.root)continue;const q=st.root.worldToLocal(new this.T.Vector3(p.x,st.root.position.y,p.z));if(q.x>40&&q.x<62&&Math.abs(q.z)<10.5)return .24;if(q.x>5&&q.x<71&&Math.abs(q.z)<44)return .09}return 0}
  buildDrift(){
    const T=this.T,root=new T.Group(),base=this.worldFromRoad(this.run.player.s,60);root.position.set(base.x,.03,base.z);this.scene.add(root);this.driftRoot=root;
    this.mesh(180,.04,230,'#41464e',root,0,0,0);
    for(const z of[-40,40]){const ring=new T.Mesh(new T.RingGeometry(24,25,96).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ecf0dc',side:T.DoubleSide}));ring.position.set(0,.04,z);root.add(ring);for(let i=0;i<20;i++){const a=i*Math.PI/10;const cone=new T.Mesh(new T.ConeGeometry(.45,1,8),new T.MeshStandardMaterial({color:'#ff8640'}));cone.position.set(Math.cos(a)*28,.5,z+Math.sin(a)*28);root.add(cone)}}
    this.label('SLIDE CLUB · FIGURE EIGHT',root,0,5,-95,30);this.run.player.place(this.run.player.s+15,35,0,0);this.run.nextCopMeters=this.run.nextRaceMeters=Infinity;
    this.addNotice('DRIFT PLAYGROUND · pick up speed, steer + Space, then countersteer',false,7);
  }
  visit(){if(this.run.paused||this.run.over||this.run.crashing)return;if(this.wanted>0||this.run.chase){this.addNotice('Lose your wanted level before fast travel.',true,3);return}
    this.onFoot=false;this.enter=this.exiting=null;this.avatar.visible=false;this.clearKeys();const km=this.run.nextStationKm;let st=this.stations.find(s=>s.km===km);
    if(!st){const root=this.buildStation(km);this.scene.add(root);this.stationObjs.push(root);st=this.stations.at(-1)}
    const p=this.run.player;p.submerged=false;p.place(st.s-20,20,0,0);p.ghost=2;this.run.distanceMeters=Math.max(this.run.distanceMeters,km*1000-20);this.run.nextCopMeters=Math.max(this.run.nextCopMeters,this.run.distanceMeters+1500);this.run.nextRaceMeters=Math.max(this.run.nextRaceMeters,this.run.distanceMeters+3000);this.world.update(p.s);this.camState.snap=true;this.addNotice('Welcome to Highway Mart · F to get out · ? for controls',false,6);
  }
  carFrame(v){return{fx:Math.sin(v.psi),fz:-Math.cos(v.psi),rx:Math.cos(v.psi),rz:Math.sin(v.psi)}}
  // Driver's door is on the left; the character steps out of the seat to stand beside it.
  exitCar(force=false){const p=this.run.player;if(!force&&p.speed>4){this.addNotice('Slow below 15 km/h to get out.',false,3);return}const a=this.actor,f=this.carFrame(p),out=p.W/2+.55;
    this.onFoot=true;this.firstPerson=false;this.enter=null;a.x=p.x-f.rx*out+f.fx*.2;a.z=p.z-f.rz*out+f.fz*.2;a.s=p.s;a.yaw=p.psi-Math.PI/2;a.vx=a.vz=a.vy=a.lift=0;a.health=Math.max(30,a.health);
    this.exiting=force?null:{t:0,v:p,from:{x:p.x-f.rx*.35,z:p.z-f.rz*.35},to:{x:a.x,z:a.z}};this.camYaw=p.psi;this.camPitch=-.14;this.avatar.visible=true;this.clearKeys();
    p.vx=p.vy=p.r=0;p.input={throttle:0,brake:1,steer:0,reverse:0,handbrake:1};this.addNotice('ON FOOT · click to use the mouse · WASD move · right mouse aim · F get in',false,5)}
  nearVehicle(range=5){return [this.run.player,...this.parked,...this.run.traffic].filter(v=>!v.wrecked&&!v.submerged&&v.speed<4.5&&distance(v,this.actor)<range).sort((a,b)=>distance(a,this.actor)-distance(b,this.actor))[0]}
  targetNPC(range=7){return this.npcs.filter(n=>n.state!=='down'&&distance(n,this.actor)<range&&this.facing(n,.55)).sort((a,b)=>distance(a,this.actor)-distance(b,this.actor))[0]}
  facing(p,threshold=.55){const dx=p.x-this.actor.x,dz=p.z-this.actor.z,len=Math.hypot(dx,dz);return len<1||((dx*Math.sin(this.actor.yaw)-dz*Math.cos(this.actor.yaw))/len)>threshold}
  stationNear(){return this.stations.find(st=>Math.abs(st.s-this.actor.s)<70&&distance(st.clerk,this.actor)<70)}
  local(st,p=this.actor){return st.root.worldToLocal(new this.T.Vector3(p.x,p.y||0,p.z))}
  vehicleKey(){if(this.run.paused||this.run.over||this.run.stationOpen)return;if(!this.onFoot){this.exitCar();return}if(this.enter){this.enter=null;return}if(this.actor.swimming||this.wastedT>0)return;
    const v=this.nearVehicle(7);if(v)this.enterVehicle(v);else this.addNotice('No stopped car nearby.',false,2)}
  interact(){if(this.run.paused||this.run.over)return;if(!this.onFoot){this.exitCar();return}if(this.actor.swimming){this.addNotice('Swim to shore · WASD · R rescue',false,2);return}
    const npc=this.targetNPC();if(this.input.aim&&npc?.role==='attendant'){this.input.use=true;return}
    const st=this.stationNear(),q=st&&this.local(st);
    if(st&&q.x>45&&q.x<53&&q.z<-3&&q.z>-11){if(!st.snacksTaken){st.snacksTaken=true;this.snacks+=3;this.crime(1);this.addNotice('SNACKS TAKEN +3 · Z to eat',true,3)}else this.addNotice('These shelves are empty.',false,2);return}
    if(st&&Math.abs(q.x-24)<4&&Math.abs(q.z)<11){const pumps=st.blocks.filter(b=>b.kind==='pump');if(pumps.every(b=>b.broken)){this.addNotice('Pumps damaged. Find another station.',false,3);return}if(!st.fuelTaken){st.fuelTaken=true;this.cans++;this.crime(1);this.addNotice('FUEL CAN TAKEN · X near your car to refuel',true,3)}else this.addNotice('Fuel already collected here.',false,2);return}
    const v=this.nearVehicle();if(!v){this.addNotice('Get closer to a stopped car, shelf, pump or attendant.',false,3);return}this.enterVehicle(v);
  }
  // Walk round to the driver's door (via the nearer corner), open it, pull out anyone inside, then get in.
  enterVehicle(v){if(this.enter||!this.onFoot)return;const a=this.actor,f=this.carFrame(v),dx=a.x-v.x,dz=a.z-v.z,lat=dx*f.rx+dz*f.rz,lon=dx*f.fx+dz*f.fz,end=Math.sign(lon)||1,cx=v.L/2+.9,cy=v.W/2+.75,path=[];
    if(lat>-v.W/2){if(lat>v.W/2)path.push([end*cx,cy]);path.push([end*cx,-cy])}path.push([.2,-(v.W/2+.55)]);
    this.enter={v,path,phase:'approach',t:0,jack:v!==this.run.player&&v.occupied!==false};this.input.aim=false;this.exiting=null}
  carPoint(v,lon,lat){const f=this.carFrame(v);return{x:v.x+f.fx*lon+f.rx*lat,z:v.z+f.fz*lon+f.rz*lat}}
  stepEnter(dt){const e=this.enter,v=e.v,a=this.actor,h=this.hero,f=this.carFrame(v);e.t+=dt;
    if(v.wrecked||v.submerged||v.speed>6){this.enter=null;h.set('reach',0);return}
    if(e.phase==='approach'){const [lon,lat]=e.path[0],p=this.carPoint(v,lon,lat),dx=p.x-a.x,dz=p.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,4.6*dt);
      if(d>.05){a.vx=dx/d*4.6;a.vz=dz/d*4.6;a.x+=dx/d*step;a.z+=dz/d*step;a.yaw+=angleTo(a.yaw,Math.atan2(dx,-dz))*Math.min(1,dt*14)}
      if(d<.3){e.path.shift();if(!e.path.length){e.phase='open';e.t=0;a.vx=a.vz=0}}if(e.t>6){e.path=[e.path.at(-1)];if(d<.6||e.t>8){e.phase='open';e.t=0}}return}
    a.vx=a.vz=0;const door=this.carPoint(v,.2,-(v.W/2+.55)),handle=this.carPoint(v,.45,-(v.W/2+.05));a.x+=(door.x-a.x)*Math.min(1,dt*12);a.z+=(door.z-a.z)*Math.min(1,dt*12);a.yaw+=angleTo(a.yaw,Math.atan2(f.rx,-f.rz))*Math.min(1,dt*12);
    if(e.phase==='open'){h.reachPoint.set(handle.x,a.y+1.02,handle.z);h.set('reach',1);if(e.t>.45){e.t=0;e.phase=e.jack?'jack':'sit';if(e.jack)this.pullOut(v)}return}
    if(e.phase==='jack'){const n=e.victim,k=Math.min(1,e.t/.65),from=this.carPoint(v,.3,-v.W/2+.35),to=this.carPoint(v,-1.3,-(v.W/2+1.6));
      if(n){n.x=from.x+(to.x-from.x)*k;n.z=from.z+(to.z-from.z)*k;n.yaw=Math.atan2(f.rx,-f.rz)+Math.PI;h.reachPoint.set(n.x,a.y+1.2,n.z);if(k>=1&&n.state!=='down'){n.state='down';n.timer=3;n.health=60}}
      if(e.t>.95){e.t=0;e.phase='sit'}return}
    if(e.phase==='sit'){h.set('reach',0);const seat=this.carPoint(v,-.1,-.38),k=Math.min(1,e.t/.42);a.x=door.x+(seat.x-door.x)*k;a.z=door.z+(seat.z-door.z)*k;a.yaw=v.psi;if(k>=1)this.takeVehicle(v)}}
  pullOut(v){v.occupied=false;const pseudo={s:v.s,root:new this.T.Group(),pseudo:true},n=this.addNPC(pseudo,0,0,['#d5a878','#8fb4d9','#b9d68f','#d98f9c'][Math.floor(Math.random()*4)],'civilian');
    const p=this.carPoint(v,.3,-v.W/2+.35);n.x=p.x;n.z=p.z;n.s=v.s;n.d=v.d;n.y=this.groundY(v.s,v.d);n.home={x:n.x,z:n.z};this.enter.victim=n;this.crime(1);this.addNotice('CARJACKING',true,2)}
  takeVehicle(v){if(v!==this.run.player){const old=this.run.player;old.isPlayer=false;old.kind='parked';old.occupied=false;old.input={throttle:0,brake:1,steer:0};if(!this.parked.includes(old))this.parked.push(old);this.parked=this.parked.filter(x=>x!==v);this.run.traffic=this.run.traffic.filter(x=>x!==v);v.isPlayer=true;v.kind='player';v.occupied=true;this.run.player=v;this.run.car=v.spec;this.applyPlayerUpgrades()}
    this.enter=null;this.hero.set('reach',0);this.onFoot=false;this.avatar.visible=false;this.viewWeapon.visible=false;this.clearKeys();this.camState.snap=true;document.exitPointerLock?.();if(this.wanted>0&&!this.run.chase)this.beginCop(null)}
  crime(level){this.wanted=Math.min(5,Math.max(this.wanted,level));this.heat=35+this.wanted*8}
  switchWeapon(to){if(this.reloadT>0)return;this.weapon=to||(this.weapon==='pistol'?'fists':'pistol');this.addNotice(this.weapon==='pistol'?`PISTOL · ${this.ammo} / ${this.reserve}`:'FISTS',false,1.2)}
  reload(){if(this.weapon!=='pistol'||this.reloadT>0||this.ammo>=CLIP||!this.reserve)return;this.reloadT=1.25}
  attack(kind){if(!this.onFoot||this.actor.swimming||this.run.paused||this.run.over||this.enter||this.wastedT>0||this.knockT>0||this.run.elapsed<(this.nextAttack||0))return;
    if(kind==='shot'&&this.weapon!=='pistol')kind=this.punchSide?'left':'right';
    if(kind==='shot'){if(this.reloadT>0)return;if(!this.ammo){this.nextAttack=this.run.elapsed+.3;if(this.reserve)this.reload();else this.addNotice('Out of ammo',false,1.5);return}
      this.ammo--;this.nextAttack=this.run.elapsed+.2;this.hero.fire();this.shoot();if(!this.ammo&&this.reserve)setTimeout(()=>this.reload(),250);return}
    this.nextAttack=this.run.elapsed+.42;this.punchSide=kind==='right'?0:1;this.hero.punch(kind==='right'?1:0);
    const n=this.targetNPC(2.3);if(n){n.health-=35;n.state=n.health<=0?'down':'flee';n.timer=n.state==='down'?14:8;this.crime(2);this.addNotice(n.state==='down'?'Knocked down · witnesses called the police':'Civilian fleeing · wanted level increased',true,2)}
    else this.addNotice('Punch · move within arm’s reach.',false,1);
  }
  // Hitscan from the camera through the crosshair; hip fire is less accurate.
  shoot(){const T=this.T,a=this.actor,o=this.aimRay.o.clone(),d=this.aimRay.d.clone();if(!this.input.aim)d.add(new T.Vector3((Math.random()-.5)*.06,(Math.random()-.5)*.04,(Math.random()-.5)*.06)).normalize();
    const hit=this.castShot(o,d,90),point=o.clone().addScaledVector(d,hit?hit.t:90),muzzle=this.hero.ready?this.hero.muzzle(new T.Vector3()):new T.Vector3(a.x,a.y+1.4,a.z);
    this.tracer.geometry.setFromPoints([muzzle,point]);this.tracer.visible=true;this.tracerT=.05;this.bang();this.panic={x:a.x,z:a.z,until:this.run.elapsed+12};
    if(this.npcs.some(n=>n.state!=='down'&&distance(n,a)<45))this.crime(1);
    if(!hit)return;for(let i=0;i<8;i++)this.effects.sparks.spawn(point.x,point.y,point.z,(Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4,.25,.07,0,1,.85,.4,1,0,0);
    if(hit.npc){const n=hit.npc,head=point.y>n.y+1.5;n.health-=head?100:55;this.hitMark=this.run.elapsed+.18;if(n.health<=0){n.state='down';n.dead=true;n.timer=0;this.crime(3);this.addNotice(head?'HEADSHOT':'Pedestrian down · the police are coming',true,2)}else{n.state='flee';n.timer=10;this.crime(2)}}
    else if(hit.vehicle){const v=hit.vehicle;if(typeof v.health==='number'&&v!==this.run.player)v.health=Math.max(0,v.health-6);this.hitMark=this.run.elapsed+.12;if(v.kind==='cop')this.crime(3)}
    else if(hit.block){const b=hit.block;if(Number.isFinite(b.hp)){b.hp-=14;b.mesh.material.color.multiplyScalar(.9);if(b.hp<=0){b.broken=true;b.mesh.visible=false;this.scatter(b);this.addNotice(b.kind.toUpperCase()+' SHOT OUT',true,2)}}}}
  vehicles(){return [this.run.player,...this.run.traffic,...this.run.pursuers,...this.parked]}
  // Ray against a car's footprint, up to roof height; returns the entry distance or null.
  rayCar(o,d,v,range){const b=v.obb(),rx=o.x-v.x,rz=o.z-v.z,lo=[rx*b.fx+rz*b.fz,rx*b.rx+rz*b.rz],ld=[d.x*b.fx+d.z*b.fz,d.x*b.rx+d.z*b.rz],ext=[b.hl,b.hw];let t0=0,t1=range;
    for(let i=0;i<2;i++){if(Math.abs(ld[i])<1e-6){if(Math.abs(lo[i])>ext[i])return null;continue}let ta=(-ext[i]-lo[i])/ld[i],tb=(ext[i]-lo[i])/ld[i];if(ta>tb)[ta,tb]=[tb,ta];t0=Math.max(t0,ta);t1=Math.min(t1,tb)}
    if(t0>t1)return null;const base=Number.isFinite(v.y)?v.y:this.groundY(v.s,v.d),y=o.y+d.y*t0;return y<base+1.5&&y>base-.5?t0:null}
  castShot(o,d,range){let best=null;const keep=(t,data)=>{if(t>.3&&t<range&&(!best||t<best.t))best={t,...data}};
    for(const n of this.npcs){if(n.state==='down')continue;const ox=n.x-o.x,oz=n.z-o.z,hd=d.x*d.x+d.z*d.z;if(hd<1e-6)continue;const t=(ox*d.x+oz*d.z)/hd,px=o.x+d.x*t-n.x,pz=o.z+d.z*t-n.z,y=o.y+d.y*t;if(Math.hypot(px,pz)<.32&&y>n.y&&y<n.y+1.8)keep(t,{npc:n})}
    for(const v of this.vehicles()){if(v===this.run.player&&this.onFoot&&distance(v,this.actor)<2.5)continue;const t=this.rayCar(o,d,v,range);if(t!==null)keep(t,{vehicle:v})}
    const meshes=this.blocks.filter(b=>!b.broken&&b.st.root.parent&&Math.abs(b.st.s-this.actor.s)<120).map(b=>b.mesh);if(meshes.length){const ray=new this.T.Raycaster(o,d,0,range),h=ray.intersectObjects(meshes,false)[0];if(h)keep(h.distance,{block:this.blocks.find(b=>b.mesh===h.object)})}
    return best}
  bang(){try{const ac=this.audioCtx||(this.audioCtx=new (window.AudioContext||window.webkitAudioContext)()),n=ac.sampleRate*.25,buf=ac.createBuffer(1,n,ac.sampleRate),ch=buf.getChannelData(0);for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*.035));
    const src=ac.createBufferSource(),lp=ac.createBiquadFilter(),g=ac.createGain();src.buffer=buf;lp.type='lowpass';lp.frequency.value=2400;g.gain.value=.5;src.connect(lp).connect(g).connect(ac.destination);src.start()}catch{}}
  clearKeys(){this.input={};for(const k in this.keys)this.keys[k]=false}
  keyDown(e){const k=e.key.toLowerCase();if(k==='?'&&!e.repeat){this.help.hidden=!this.help.hidden;return true}if(this.run.paused||this.run.over||this.run.stationOpen)return false;
    if(k==='f'){e.preventDefault();if(!e.repeat)this.vehicleKey();return true}
    if(k==='e'){e.preventDefault();this.input.use=true;if(!e.repeat)this.interact();return true}
    if(k==='g'){e.preventDefault();this.input.aim=true;return true}
    if(k==='z'&&!e.repeat){if(this.snacks){this.snacks--;this.actor.health=Math.min(100,this.actor.health+35);this.actor.stamina=Math.min(100,this.actor.stamina+30);this.addNotice('Snack eaten · health +35 · stamina +30',false,2)}return true}
    if(k==='x'&&!e.repeat){if(this.cans&&(!this.onFoot||distance(this.actor,this.run.player)<5)){this.cans--;this.fuel=100;this.addNotice('Refuelled to 100%',false,2)}return true}
    if(!this.onFoot)return false;
    if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','shift','alt'].includes(k)){e.preventDefault();this.input[k]=true;return true}
    if(k===' '){e.preventDefault();if(!e.repeat)this.jump();return true}
    if(k==='v'||k==='c'){if(!e.repeat)this.firstPerson=!this.firstPerson;return true}
    if(k==='tab'){e.preventDefault();if(!e.repeat)this.switchWeapon();return true}
    if(k==='1'||k==='2'){if(!e.repeat)this.switchWeapon(k==='1'?'fists':'pistol');return true}
    if(k==='r'&&!this.actor.swimming){if(!e.repeat)this.reload();return true}
    if(['j','k','h'].includes(k)){if(!e.repeat)this.attack(k==='h'?'shot':k==='k'?'right':'left');return true}
    return false;
  }
  keyUp(e){const k=e.key.toLowerCase();this.input[k]=false;if(k==='e')this.input.use=false;if(k==='g')this.input.aim=false;if(k==='alt')e.preventDefault()}
  jump(){const a=this.actor;if(a.swimming||a.lift>0||this.enter||this.wastedT>0||this.knockT>0)return;a.vy=4.6;a.lift=.001}
  isWater(p){const q={};this.toRoad(p.x,p.z,p.s,q);return this.road.env.sea&&this.groundY(q.s,q.d)<-4.8}
  // Drivers brake for a pedestrian ahead of them, or for a gun pointed at the windscreen.
  yieldTo(v){if(!this.onFoot||this.actor.swimming||v.wrecked)return;const a=this.actor,f=this.carFrame(v),dx=a.x-v.x,dz=a.z-v.z,lon=dx*f.fx+dz*f.fz,lat=dx*f.rx+dz*f.rz;
    const ahead=lon>0&&lon<8+v.speed*1.6&&Math.abs(lat)<v.W/2+1.2,threatened=this.input.aim&&this.weapon==='pistol'&&Math.hypot(dx,dz)<18&&this.aimRay.d.x*-dx+this.aimRay.d.z*-dz>.85*Math.hypot(dx,dz);
    if(ahead||threatened||this.enter?.v===v){v.input.throttle=0;v.input.brake=1}}
  resolveBlocks(p,radius,vehicle=null){for(const b of this.blocks){if(b.broken||!b.st.root.parent)continue;if(Math.abs(p.s-b.st.s)>85)continue;const q=this.local(b.st,p),hx=b.w/2,hz=b.d/2,dx=q.x-b.x,dz=q.z-b.z,cx=clamp(dx,-hx,hx),cz=clamp(dz,-hz,hz);let nx=dx-cx,nz=dz-cz,dist=Math.hypot(nx,nz);if(dist>=radius)continue;
      if(dist<.0001){if(hx-Math.abs(dx)<hz-Math.abs(dz)){nx=Math.sign(dx)||1;nz=0;dist=-(hx-Math.abs(dx))}else{nx=0;nz=Math.sign(dz)||1;dist=-(hz-Math.abs(dz))}}else{nx/=dist;nz/=dist}
      const impact=vehicle?vehicle.speed:0;
      if(vehicle&&impact>3&&Number.isFinite(b.hp)&&this.run.elapsed>(b.hitAt||-1)){b.hp-=impact*vehicle.mass/130;b.hitAt=this.run.elapsed+.18;b.mesh.material.color.multiplyScalar(.85);if(b.hp<=0){b.broken=true;b.mesh.visible=false;this.scatter(b);if(vehicle.isPlayer){this.crime(1);this.addNotice(b.kind.toUpperCase()+' SMASHED',true,2)}continue}}
      const a=b.st.root.rotation.y,wx=Math.cos(a)*nx+Math.sin(a)*nz,wz=-Math.sin(a)*nx+Math.cos(a)*nz;
      if(vehicle)this.wallHit(vehicle,wx,wz,vehicle.x-wx*radius,vehicle.z-wz*radius,radius-dist,true);else{p.x+=wx*(radius-dist);p.z+=wz*(radius-dist)}
    }}
  collide(v){if(v.submerged)return;const T=this.T;
    for(const b of this.blocks){if(b.broken||!b.st.root.parent||Math.abs(v.s-b.st.s)>85)continue;
      const o=v.obb(),corners=o.corners.map(c=>b.st.root.worldToLocal(new T.Vector3(c[0],0,c[1]))),q=this.local(b.st,v),a=b.st.root.rotation.y;
      const theta=v.psi+a,axes=[[1,0],[0,1],[Math.sin(theta),-Math.cos(theta)],[Math.cos(theta),Math.sin(theta)]];
      let pen=Infinity,nx=0,nz=0,hit=true;
      for(const [ax,az]of axes){const proj=corners.map(c=>c.x*ax+c.z*az),center=b.x*ax+b.z*az,extent=Math.abs(ax)*b.w/2+Math.abs(az)*b.d/2,overlap=Math.min(Math.max(...proj),center+extent)-Math.max(Math.min(...proj),center-extent);if(overlap<=0){hit=false;break}if(overlap<pen){pen=overlap;const sign=(q.x-b.x)*ax+(q.z-b.z)*az>=0?1:-1;nx=ax*sign;nz=az*sign}}
      if(!hit)continue;const impact=v.speed;if(impact>3&&Number.isFinite(b.hp)&&this.run.elapsed>(b.hitAt||-1)){b.hp-=impact*v.mass/130;b.hitAt=this.run.elapsed+.18;b.mesh.material.color.multiplyScalar(.85);if(b.hp<=0){b.broken=true;b.mesh.visible=false;this.scatter(b);if(v.isPlayer){this.crime(1);this.addNotice(b.kind.toUpperCase()+' SMASHED',true,2)}continue}}
      const wx=Math.cos(a)*nx+Math.sin(a)*nz,wz=-Math.sin(a)*nx+Math.cos(a)*nz,contact=b.st.root.localToWorld(new T.Vector3(clamp(q.x,b.x-b.w/2,b.x+b.w/2),0,clamp(q.z,b.z-b.d/2,b.z+b.d/2)));
      this.wallHit(v,wx,wz,contact.x,contact.z,pen,true);
    }
  }
  scatter(b){const T=this.T,p=b.mesh.getWorldPosition(new T.Vector3());for(let i=0;i<10;i++){const m=this.mesh(.2+Math.random()*.3,.16,.3,b.mesh.material.color,this.scene,p.x,p.y,p.z);this.debris.push({m,v:new T.Vector3((Math.random()-.5)*7,2+Math.random()*4,(Math.random()-.5)*7),age:0,ground:p.y-1})}}
  hurt(amount,knock=false){const a=this.actor;if(this.wastedT>0)return;a.health-=amount;if(knock)this.knockT=Math.max(this.knockT,1.6);if(a.health<=0){a.health=0;this.wastedT=3.2;this.enter=null;this.input.aim=false;this.addNotice('WASTED',true,3)}}
  moveActor(dt){const a=this.actor,inp=this.input,f=(inp.w||inp.arrowup?1:0)-(inp.s||inp.arrowdown?1:0),r=(inp.d?1:0)-(inp.a?1:0),aiming=!!inp.aim&&!a.swimming;
    this.camYaw+=((inp.arrowright?1:0)-(inp.arrowleft?1:0))*dt*2.4;
    const fx=Math.sin(this.camYaw),fz=-Math.cos(this.camYaw),mx=fx*f+Math.cos(this.camYaw)*r,mz=fz*f+Math.sin(this.camYaw)*r,len=Math.hypot(mx,mz),down=this.wastedT>0||this.knockT>0;
    const speed=down?0:a.swimming?(inp.shift?3.8:2.4):aiming?2:inp.alt?1.6:inp.shift?7:4.4,tx=len?mx/len*speed:0,tz=len?mz/len*speed:0,k=Math.min(1,dt*(a.lift>0?2:a.swimming?3:11));
    a.vx+=(tx-a.vx)*k;a.vz+=(tz-a.vz)*k;a.x+=a.vx*dt;a.z+=a.vz*dt;
    if(!down){if(aiming||this.firstPerson)a.yaw+=angleTo(a.yaw,this.camYaw)*Math.min(1,dt*18);else if(len)a.yaw+=angleTo(a.yaw,Math.atan2(mx,-mz))*Math.min(1,dt*10)}
    return len>0}
  update(dt){
    const p=this.run.player,a=this.actor,h=this.hero,T=this.T;
    if(this.isWater(p)&&!p.submerged){p.submerged=true;p.vx=p.vy=p.r=0;this.exitCar(true);a.stamina=100;this.addNotice('CAR SUBMERGED! Swim to shore · WASD · Shift · R rescue',true,7)}
    for(const v of this.parked){v.input={throttle:0,brake:1,steer:0,handbrake:1};if(this.isWater(v))v.submerged=true}
    if(!this.onFoot&&!p.submerged){this.fuel=Math.max(0,this.fuel-p.speed*dt*.0009);if(this.fuel<=0){p.input.throttle=0;p.vx*=Math.exp(-dt*.4)}}
    if(this.tracerT!==undefined){this.tracerT-=dt;if(this.tracerT<=0){this.tracer.visible=false;this.tracerT=undefined}}
    if(this.reloadT>0){this.reloadT-=dt;if(this.reloadT<=0){const n=Math.min(CLIP-this.ammo,this.reserve);this.ammo+=n;this.reserve-=n;this.reloadT=0}}
    if(this.onFoot){
      if(this.wastedT>0){this.wastedT-=dt;if(this.wastedT<=0){this.wastedT=0;this.rescue(true);return}}
      if(this.knockT>0)this.knockT=Math.max(0,this.knockT-dt);
      const wantsMove=['w','a','s','d','arrowup','arrowdown'].some(k=>this.input[k]);
      if(this.exiting&&Math.hypot(a.x-this.exiting.to.x,a.z-this.exiting.to.z)>3)this.exiting=null;
      if(this.exiting){const x=this.exiting;x.t+=dt;const k=Math.min(1,x.t/.4);a.x=x.from.x+(x.to.x-x.from.x)*k;a.z=x.from.z+(x.to.z-x.from.z)*k;if(k>=1||(wantsMove&&x.t>.15)){this.exiting=null}}
      else if(this.enter){if(wantsMove&&this.enter.phase==='approach'){this.enter=null}else this.stepEnter(dt)}
      if(!this.exiting&&!this.enter)this.moveActor(dt);
      if(a.lift>0){a.vy-=15*dt;a.lift+=a.vy*dt;if(a.lift<=0){a.lift=0;a.vy=0}}
      this.resolveBlocks(a,.35);this.toRoad(a.x,a.z,a.s,a);a.swimming=this.isWater(a);if(a.swimming)a.lift=a.vy=0;a.y=a.swimming?-4.7:this.groundY(a.s,a.d)+this.floorAt(a)+a.lift;
      if(a.swimming){a.stamina=Math.max(0,a.stamina-dt*(this.input.shift?5:2.2));if(a.stamina<=0){a.health-=dt*18;if(a.health<=0)this.rescue(true)}}else a.stamina=Math.min(100,a.stamina+dt*9);
      if(this.onFoot){
      if(!a.swimming&&!this.exiting){for(const v of [p,...this.run.traffic,...this.parked,...this.run.pursuers]){if(v===this.enter?.v&&this.enter.phase!=='approach')continue;if(distance(v,a)<v.W*.5+.45){const dx=a.x-v.x,dz=a.z-v.z,len=Math.hypot(dx,dz)||1;a.x=v.x+dx/len*(v.W*.5+.5);a.z=v.z+dz/len*(v.W*.5+.5);
        if(v.speed>4&&this.run.elapsed>(this.hitUntil||0)){this.hitUntil=this.run.elapsed+1;this.hurt(Math.min(60,v.speed*1.6),true);a.vx+=dx/len*v.speed*.4;a.vz+=dz/len*v.speed*.4;if(this.wastedT<=0)this.addNotice('Hit by a car! Z for a snack',true,3)}}}}
      // Character pose follows the controls.
      const aiming=!!this.input.aim&&!a.swimming&&!this.enter&&!this.wastedT&&!this.knockT,eye=new T.Vector3(a.x,a.y+1.45,a.z),target=this.aimRay.o.clone().addScaledVector(this.aimRay.d,30);
      h.weapon=this.weapon;h.aimDir.copy(target.sub(eye)).normalize();h.reload=this.reloadT;h.set('aim',aiming?1:0);h.set('air',a.lift>.05?1:0);h.set('swim',a.swimming?1:0);h.set('down',this.wastedT>0||this.knockT>0?1:0);
      h.speed=Math.hypot(a.vx,a.vz);h.back=aiming&&(a.vx*Math.sin(a.yaw)-a.vz*Math.cos(a.yaw))<-.2;
      this.avatar.position.set(a.x,a.y,a.z);this.avatar.rotation.set(0,-a.yaw,0);this.avatar.visible=!this.firstPerson;h.update(dt);
      this.crossTarget=aiming&&this.weapon==='pistol'?this.castShot(this.aimRay.o,this.aimRay.d,90)?.npc:null;}
    }
    this.updateNPCs(dt);
    for(const st of this.stations){const eligible=this.onFoot&&!a.swimming&&this.input.aim&&this.weapon==='pistol'&&this.input.use&&this.targetNPC(7)===st.clerk&&st.clerk.state!=='down'&&this.run.elapsed>=st.robbedUntil;
      st.progress=eligible?Math.min(3,st.progress+dt):0;if(st.progress>=3){st.progress=0;st.robbedUntil=this.run.elapsed+120;this.awardRoadCoins(35);this.snacks+=2;this.cans++;this.reserve+=24;this.crime(3);this.addNotice('ROBBERY COMPLETE · +35 coins · +2 snacks · +1 fuel · +24 rounds · escape!',true,7)}}
    this.heat=Math.max(0,this.heat-dt);if(this.wanted&&this.heat===0){this.wanted--;this.heat=this.wanted?12:0;if(!this.wanted)this.addNotice('Wanted level cleared.',false,3)}
    if(this.wanted&&this.onFoot&&!this.wastedT){const near=this.run.pursuers.some(v=>!v.wrecked&&distance(v,a)<10);if(near){this.arrest=(this.arrest||0)+dt;if(this.arrest>4){this.rescue(true);this.addNotice('BUSTED · rescued at roadside · loot confiscated',true,5)}}else this.arrest=0}
    if(p.spec.drift||this.run.map.id==='drift'){const angle=Math.abs(Math.atan2(p.vy,Math.max(1,Math.abs(p.vx))));if(!this.onFoot&&p.speed>6&&angle>.12&&angle<1.35&&!p.wrecked){this.combo+=dt;this.driftScore+=dt*p.speed*angle*10*(1+Math.min(4,this.combo/3));this.best=Math.max(this.best,this.combo)}else this.combo=0}
    for(let i=this.debris.length-1;i>=0;i--){const d=this.debris[i];d.age+=dt;d.v.y-=9.8*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=dt*3;if(d.m.position.y<d.ground){d.m.position.y=d.ground;d.v.set(0,0,0)}if(d.age>8){this.scene.remove(d.m);d.m.geometry.dispose();d.m.material.dispose();this.debris.splice(i,1)}}
    // Expired streamed stations cannot leave invisible colliders or orphaned people/cars.
    for(const st of [...this.stations])if(!st.root.parent){this.blocks=this.blocks.filter(b=>b.st!==st);for(const n of this.npcs.filter(n=>n.st===st))n.h.dispose();this.npcs=this.npcs.filter(n=>n.st!==st);this.stations=this.stations.filter(x=>x!==st);for(const v of this.parked.filter(v=>v.station===st))this.disposeObject(v.mesh.group);this.parked=this.parked.filter(v=>v.station!==st)}
    for(const n of this.npcs.filter(n=>n.st.pseudo&&distance(n,this.onFoot?a:p)>350)){n.h.dispose();this.npcs=this.npcs.filter(x=>x!==n)}
  }
  updateNPCs(dt){const a=this.actor,el=this.run.elapsed,cars=[this.run.player,...this.run.traffic,...this.run.pursuers];
    for(const n of this.npcs){if(n.st.root.parent===null&&this.stations.includes(n.st)){n.mesh.visible=false;continue}if(this.enter?.victim===n&&this.enter.phase==='jack'){this.poseNPC(n,dt,0);continue}
      n.mesh.visible=true;n.timer=Math.max(0,n.timer-dt);const px=n.x,pz=n.z;
      if(n.state!=='down')for(const v of cars){if(v.speed>5&&distance(v,n)<v.W*.5+.4){n.state='down';n.timer=10;n.health-=v.speed*3;if(n.health<=0)n.dead=true;const dx=n.x-v.x,dz=n.z-v.z,l=Math.hypot(dx,dz)||1;n.x+=dx/l*1.2;n.z+=dz/l*1.2;if(v===this.run.player&&!this.onFoot){this.crime(2);this.addNotice('Pedestrian hit!',true,2)}break}}
      if(n.state==='down'){if(!n.dead&&!n.timer){n.health=100;n.state='flee';n.timer=8}this.poseNPC(n,dt,0);continue}
      const aimed=this.onFoot&&this.input.aim&&this.weapon==='pistol'&&distance(n,a)<15&&this.facing(n,.8);if(aimed){n.state='surrender';n.timer=2}else if(n.state==='surrender'&&!n.timer)n.state='idle';
      if(n.state==='idle'&&this.panic&&el<this.panic.until&&distance(n,this.panic)<35&&n.role!=='attendant'){n.state='flee';n.timer=10}
      if(n.state==='flee'&&n.timer>0){const dx=n.x-a.x,dz=n.z-a.z,d=Math.hypot(dx,dz)||1;n.x+=dx/d*dt*5.2;n.z+=dz/d*dt*5.2;this.resolveBlocks(n,.35)}
      else if(n.state==='flee')n.state='idle';
      else if(n.role==='civilian'&&n.state==='idle'){const tx=n.home.x+Math.sin(el*.22+n.seed)*4,tz=n.home.z+Math.cos(el*.17+n.seed)*2,dx=tx-n.x,dz=tz-n.z,d=Math.hypot(dx,dz);if(d>.3){const s=Math.min(d,1.25*dt);n.x+=dx/d*s;n.z+=dz/d*s}}
      const mv=Math.hypot(n.x-px,n.z-pz);if(mv>1e-4)n.yaw+=angleTo(n.yaw,Math.atan2(n.x-px,-(n.z-pz)))*Math.min(1,dt*8);
      if(n.state==='surrender'||(n.role==='attendant'&&this.onFoot&&distance(n,a)<14))n.yaw+=angleTo(n.yaw,Math.atan2(a.x-n.x,-(a.z-n.z)))*Math.min(1,dt*6);
      if(mv>1e-4&&n.state==='flee'){this.toRoad(n.x,n.z,n.s,n);n.y=this.groundY(n.s,n.d)+this.floorAt(n)}
      this.poseNPC(n,dt,dt>0?mv/dt:0)}}
  poseNPC(n,dt,speed){const h=n.h;h.speed=speed;h.set('down',n.state==='down'?1:0);h.set('hands',n.state==='surrender'?1:0);n.mesh.position.set(n.x,n.y,n.z);n.mesh.rotation.y=-n.yaw;
    const viewer=this.onFoot?this.actor:this.run.player;if(distance(n,viewer)<160)h.update(dt)}
  updateCamera(dt){const a=this.actor,T=this.T,aiming=!!this.input.aim&&!a.swimming&&this.wastedT<=0;this.aimBlend+=((aiming?1:0)-this.aimBlend)*Math.min(1,dt*10||1);const k=this.aimBlend;
    this.camera.up.set(0,1,0);const cp=Math.cos(this.camPitch),dir=new T.Vector3(Math.sin(this.camYaw)*cp,Math.sin(this.camPitch),-Math.cos(this.camYaw)*cp),right=new T.Vector3(Math.cos(this.camYaw),0,Math.sin(this.camYaw));let pos;
    if(this.firstPerson){pos=new T.Vector3(a.x,a.y+(a.swimming?.9:1.62),a.z).addScaledVector(new T.Vector3(Math.sin(a.yaw),0,-Math.cos(a.yaw)),.12)}
    else{const pivot=new T.Vector3(a.x,a.y+(a.swimming?1:1.52)-a.lift*.45,a.z).addScaledVector(right,.38+.2*k),back=dir.clone().negate();let dist=(3.5-1.95*k)*(this.wastedT>0?1.6:1);
      for(const v of this.vehicles())if(distance(v,a)<12&&v!==this.enter?.v){const t=this.rayCar(pivot,back,v,dist);if(t!==null)dist=Math.max(.4,t-.25)}
      pos=pivot.clone().addScaledVector(dir,-dist);
      const ray=new T.Raycaster(pivot,dir.clone().negate(),0,dist),hit=ray.intersectObjects(this.blocks.filter(b=>!b.broken&&b.st.root.parent).map(b=>b.mesh),false)[0];if(hit)pos.copy(hit.point).addScaledVector(dir,.25);
      pos.y=Math.max(pos.y,this.groundY(a.s,a.d)+.35)}
    this.camera.position.copy(pos);this.camera.lookAt(pos.clone().add(dir));this.camera.near=.08;this.camera.fov=this.firstPerson?72:70-16*k;this.camera.updateProjectionMatrix();this.camState.pos.copy(pos);this.camState.snap=true;
    this.aimRay.o.copy(pos);this.aimRay.d.copy(dir);
    const vw=this.viewWeapon;vw.visible=this.firstPerson&&this.weapon==='pistol'&&!a.swimming&&this.wastedT<=0;if(vw.visible){vw.position.copy(new T.Vector3(.2,-.19-(this.reloadT>0?.12:0),-.42+this.hero.recoil*.05).applyQuaternion(this.camera.quaternion).add(pos));vw.quaternion.copy(this.camera.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI))}
  }
  // Crosshair, hit marker and WASTED screen, drawn on the 2D overlay canvas.
  drawOverlay(g,w,h){if(this.wastedT>0){const t=Math.min(1,(3.2-this.wastedT)/.8);g.fillStyle=`rgba(40,40,40,${.45*t})`;g.fillRect(0,0,w,h);g.font=`900 ${Math.round(Math.min(w,h)*.13)}px Impact, 'Arial Black', sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=6;g.strokeStyle=`rgba(0,0,0,${t})`;g.strokeText('WASTED',w/2,h/2);g.fillStyle=`rgba(200,16,46,${t})`;g.fillText('WASTED',w/2,h/2);return}
    if(!this.input.aim||this.actor.swimming||this.firstPerson&&this.weapon!=='pistol')return;const cx=w/2,cy=h/2,hot=!!this.crossTarget;g.save();g.strokeStyle=hot?'#ff3b3b':'rgba(255,255,255,.95)';g.fillStyle=g.strokeStyle;g.lineWidth=2;g.shadowColor='rgba(0,0,0,.7)';g.shadowBlur=3;
    if(this.weapon==='pistol'){g.beginPath();g.arc(cx,cy,2.2,0,Math.PI*2);g.fill();for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){g.beginPath();g.moveTo(cx+dx*7,cy+dy*7);g.lineTo(cx+dx*13,cy+dy*13);g.stroke()}}
    if(this.run.elapsed<(this.hitMark||0)){g.strokeStyle='#fff';for(const [dx,dy]of[[1,1],[-1,1],[1,-1],[-1,-1]]){g.beginPath();g.moveTo(cx+dx*9,cy+dy*9);g.lineTo(cx+dx*16,cy+dy*16);g.stroke()}}g.restore()}
  rescue(drowned=false){if(!this.onFoot)return;const a=this.actor,w=this.worldFromRoad(a.s,12);Object.assign(a,{x:w.x,y:w.y+.2,z:w.z,health:100,stamina:100,swimming:false,vx:0,vz:0,vy:0,lift:0});this.enter=this.exiting=null;this.wastedT=this.knockT=0;this.hero.set('down',0);this.hero.set('reach',0);this.clearKeys();if(drowned){this.snacks=0;this.cans=0;this.wanted=0;this.heat=0;this.arrest=0}const p=this.run.player;p.submerged=false;p.place(a.s+6,12,0,0);p.health=Math.max(p.health,p.maxHealth*.3);p.wrecked=false;this.run.crashing=this.run.over=false;document.getElementById('driveGameover').hidden=true;this.addNotice(drowned?'RESCUED · loot lost · car recovered':'Roadside rescue · your car is beside you · F to get in',false,5)}
  hud(){if(!this.ui)return;const a=this.actor,aimed=this.onFoot&&this.input.aim,npc=aimed&&this.targetNPC(),st=this.stationNear();
    document.getElementById('streetMode').textContent=this.onFoot?this.wastedT>0?'WASTED':a.swimming?'SWIMMING':this.enter?'GETTING IN':this.firstPerson?'FIRST PERSON':'ON FOOT':'BEHIND THE WHEEL';
    const gun=this.weapon==='pistol'?`Pistol ${this.ammo} / ${this.reserve}${this.reloadT>0?' · reloading':''}`:'Fists';
    document.getElementById('streetStats').textContent=`${'★'.repeat(this.wanted)}${'☆'.repeat(5-this.wanted)}  ·  Health ${Math.ceil(a.health)}  ·  ${gun}  ·  Snacks ${this.snacks}  ·  Fuel cans ${this.cans}  ·  ${Math.ceil(this.fuel)}% fuel`+(a.swimming?`  ·  Stamina ${Math.ceil(a.stamina)}%`:'')+((this.run.map.id==='drift'||this.run.player.spec.drift)?`  ·  DRIFT ${Math.floor(this.driftScore)} ×${(1+Math.min(4,this.combo/3)).toFixed(1)}`:'');
    let hint=this.onFoot?'Click to lock the mouse · WASD move · Shift sprint · Space jump · right mouse aim · left mouse fire · F get in':'F get out when stopped · Visit gas station to try Street Life';
    if(npc?.role==='attendant')hint=this.run.elapsed<npc.st.robbedUntil?`Register empty · restocks in ${Math.ceil(npc.st.robbedUntil-this.run.elapsed)}s`:this.weapon==='pistol'?'HOLD E while aiming · rob the register':'Switch to the pistol (2) to hold up the attendant';
    else if(this.onFoot&&!this.enter&&this.nearVehicle(7)){const v=this.nearVehicle(7);hint=v!==this.run.player&&v.occupied!==false?'F · pull the driver out and take the car':'F · get in'}
    if(a.swimming)hint=a.stamina>0?'WASD swim to land · Shift faster · R rescue':'DROWNING · swim ashore or press R to rescue!';
    document.getElementById('streetHint').textContent=hint;document.getElementById('streetProgress').style.width=((st?.progress||0)/3*100)+'%';this.ui.classList.toggle('aiming',!!aimed);this.ui.classList.toggle('in-water',a.swimming);
  }
  disposeObject(root){root.removeFromParent();root.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep&&!o.geometry.userData.shared)o.geometry.dispose();for(const m of [].concat(o.material||[]))if(!m.userData.keep){if(m.map&&!m.map.userData.keep)m.map.dispose();m.dispose()}})}
  dispose(){document.removeEventListener('mousemove',this.pointerMove);document.removeEventListener('mousedown',this.mouseDown);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('contextmenu',this.contextMenu);document.removeEventListener('wheel',this.wheel);document.exitPointerLock?.();
    this.hero.dispose();for(const n of this.npcs)n.h.dispose();this.viewWeapon.removeFromParent();this.tracer.removeFromParent();this.audioCtx?.close?.();this.ui?.remove();this.actions?.remove();this.help?.remove();if(this.oldNote)document.querySelector('.drive-controls-note').innerHTML=this.oldNote}
}
