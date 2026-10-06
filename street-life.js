// On-foot play shares the highway's world, vehicles, wallet and simulation clock.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class StreetLife {
  constructor(ctx){
    Object.assign(this,ctx);this.ctx=ctx;this.parked=[];this.stations=[];this.npcs=[];this.blocks=[];this.debris=[];
    this.onFoot=false;this.firstPerson=false;this.input={};this.wanted=0;this.heat=0;this.snacks=0;this.cans=0;this.fuel=100;this.driftScore=0;this.combo=0;this.best=0;
    this.actor={x:0,y:0,z:0,s:ctx.run.player.s,d:0,yaw:0,health:100,stamina:100,swimming:false};
    this.avatar=this.person('#4ee0c0');this.avatar.visible=false;ctx.scene.add(this.avatar);
    this.viewWeapon=new ctx.T.Group();this.mesh(.11,.13,.4,'#26303c',this.viewWeapon,0,0,-.1);this.mesh(.1,.2,.12,'#c99370',this.viewWeapon,0,-.12,.03);this.viewWeapon.visible=false;ctx.scene.add(this.viewWeapon);
    this.installUI();this.pointerMove=e=>{if(document.pointerLockElement===ctx.renderer?.domElement||document.pointerLockElement===document.getElementById('driveCanvas')){this.actor.yaw-=e.movementX*.0025;this.pitch=clamp((this.pitch||0)-e.movementY*.002,-.85,.85)}};
    document.addEventListener('mousemove',this.pointerMove);
    this.mouseDown=e=>{if(!this.onFoot||ctx.run.paused)return;if(e.button===2){e.preventDefault();this.input.aim=true}if(e.button===0&&e.target.id==='driveCanvas'){if(this.input.aim)this.attack('shot');else e.target.requestPointerLock?.()}};
    this.mouseUp=e=>{if(e.button===2)this.input.aim=false};this.contextMenu=e=>{if(this.onFoot&&e.target.id==='driveCanvas')e.preventDefault()};
    document.addEventListener('mousedown',this.mouseDown);document.addEventListener('mouseup',this.mouseUp);document.addEventListener('contextmenu',this.contextMenu);
  }
  mesh(w,h,d,color,parent,x=0,y=0,z=0){const T=this.T,m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  person(color){const T=this.T,g=new T.Group();this.mesh(.48,.65,.3,color,g,0,1.05,0);this.mesh(.34,.36,.32,'#c99370',g,0,1.58,0);this.mesh(.35,.09,.33,'#42352c',g,0,1.78,0);for(const x of[-.08,.08])this.mesh(.045,.045,.02,'#252a30',g,x,1.62,-.17);
    const arms=[];for(const x of[-.34,.34]){const a=new T.Group();a.position.set(x,1.32,0);this.mesh(.16,.55,.17,color,a,0,-.22,0);g.add(a);arms.push(a)}
    const legs=[];for(const x of[-.15,.15]){const l=new T.Group();l.position.set(x,.77,0);this.mesh(.2,.68,.22,'#263248',l,0,-.32,0);g.add(l);legs.push(l)}
    const gun=this.mesh(.12,.15,.42,'#26303c',arms[1],0,-.48,-.14);gun.rotation.x=-Math.PI/2;gun.visible=false;g.userData={arms,legs,gun};return g;
  }
  label(text,parent,x,y,z,w=6){const T=this.T,c=document.createElement('canvas');c.width=768;c.height=144;const g=c.getContext('2d');g.fillStyle='#12272b';g.fillRect(0,0,768,144);g.fillStyle='#c8ff73';g.font='bold 56px system-ui';g.textAlign='center';g.fillText(text,384,91);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,w*144/768),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m}
  installUI(){
    document.getElementById('streetHUD')?.remove();const hud=document.createElement('div');hud.id='streetHUD';hud.innerHTML='<div class="street-title"><b>STREET LIFE</b><span id="streetMode">BEHIND THE WHEEL</span></div><div id="streetStats"></div><div id="streetHint"></div><div class="street-progress"><i id="streetProgress"></i></div>';document.querySelector('.drive-stage').append(hud);this.ui=hud;
    this.actions=document.createElement('div');this.actions.className='street-actions';
    for(const[label,fn]of[['Exit / enter · E',()=>this.interact()],['Visit gas station',()=>this.visit()],['Helicopter · 6',()=>this.setCamera(5)],['Top view · 7',()=>this.setCamera(6)],['Controls · ?',()=>{this.help.hidden=!this.help.hidden}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;this.actions.append(b)}
    document.querySelector('.drive-hud').after(this.actions);
    this.help=document.createElement('div');this.help.className='street-help';this.help.hidden=true;this.help.innerHTML='<b>STREET LIFE · CONTROLS</b><p><strong>E</strong> exit / enter a stopped car or interact. <strong>WASD</strong> walk. <strong>← →</strong> turn; click the scene for mouse look; <strong>Esc</strong> releases it. <strong>V</strong> first / third person.</p><p><strong>G / right mouse</strong> aim. Aim at the attendant and hold <strong>E</strong> to rob. Aim at a stopped civilian car and press <strong>E</strong> to demand the keys. <strong>J / K</strong> left / right punch. <strong>H / left mouse while aiming</strong> fire.</p><p><strong>Z</strong> eat snack. <strong>X</strong> use fuel can near your car. <strong>Shift</strong> sprint / swim faster. <strong>R</strong> rescue / tow. Water disables your car; swim ashore before stamina runs out.</p><p><strong>6 / 7</strong> helicopter / top view. <strong>Space</strong> handbrake. Select Drift Playground and a free drift car in the garage. Hold a slide to build your combo.</p><button type="button">Got it</button>';this.help.querySelector('button').onclick=()=>this.help.hidden=true;document.querySelector('.drive-stage').append(this.help);
    const note=document.querySelector('.drive-controls-note');this.oldNote=note.innerHTML;note.textContent='E exit / enter · WASD drive / walk · G aim · hold E rob · J / K punch · V on-foot camera · 6 helicopter · 7 top view · ? controls';
  }
  buildStation(km){
    const T=this.T,s=this.stationS(km),p=this.worldFromRoad(s,0),root=new T.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=-p.th;root.userData.km=km;
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
  addNPC(st,x,z,color,role){const g=this.person(color),p=st.root.localToWorld(new this.T.Vector3(x,0,z));const n={x:p.x,z:p.z,y:p.y,s:st.s-z,mesh:g,role,st,state:'idle',timer:0,health:100,home:{x:p.x,z:p.z},yaw:-Math.PI/2-st.root.rotation.y};g.position.copy(p);this.scene.add(g);this.npcs.push(n);return n}
  buildDrift(){
    const T=this.T,root=new T.Group(),base=this.worldFromRoad(this.run.player.s,60);root.position.set(base.x,.03,base.z);this.scene.add(root);this.driftRoot=root;
    this.mesh(180,.04,230,'#41464e',root,0,0,0);
    for(const z of[-40,40]){const ring=new T.Mesh(new T.RingGeometry(24,25,96).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ecf0dc',side:T.DoubleSide}));ring.position.set(0,.04,z);root.add(ring);for(let i=0;i<20;i++){const a=i*Math.PI/10;const cone=new T.Mesh(new T.ConeGeometry(.45,1,8),new T.MeshStandardMaterial({color:'#ff8640'}));cone.position.set(Math.cos(a)*28,.5,z+Math.sin(a)*28);root.add(cone)}}
    this.label('SLIDE CLUB · FIGURE EIGHT',root,0,5,-95,30);this.run.player.place(this.run.player.s+15,35,0,0);this.run.nextCopMeters=this.run.nextRaceMeters=Infinity;
    this.addNotice('DRIFT PLAYGROUND · pick up speed, steer + Space, then countersteer',false,7);
  }
  visit(){if(this.run.paused||this.run.over||this.run.crashing)return;if(this.wanted>0||this.run.chase){this.addNotice('Lose your wanted level before fast travel.',true,3);return}
    this.onFoot=false;this.avatar.visible=false;this.clearKeys();const km=this.run.nextStationKm;let st=this.stations.find(s=>s.km===km);
    if(!st){const root=this.buildStation(km);this.scene.add(root);this.stationObjs.push(root);st=this.stations.at(-1)}
    const p=this.run.player;p.submerged=false;p.place(st.s-20,20,0,0);p.ghost=2;this.run.distanceMeters=Math.max(this.run.distanceMeters,km*1000-20);this.run.nextCopMeters=Math.max(this.run.nextCopMeters,this.run.distanceMeters+1500);this.run.nextRaceMeters=Math.max(this.run.nextRaceMeters,this.run.distanceMeters+3000);this.world.update(p.s);this.camState.snap=true;this.addNotice('Welcome to Highway Mart · E to get out · ? for controls',false,6);
  }
  exitCar(force=false){const p=this.run.player;if(!force&&p.speed>4){this.addNotice('Slow below 15 km/h to get out.',false,3);return}this.onFoot=true;this.firstPerson=false;this.actor.x=p.x+Math.cos(p.psi)*(p.W/2+1);this.actor.z=p.z+Math.sin(p.psi)*(p.W/2+1);this.actor.s=p.s;this.actor.yaw=p.psi;this.actor.health=Math.max(30,this.actor.health);this.avatar.visible=true;this.clearKeys();p.vx=p.vy=p.r=0;p.input={throttle:0,brake:1,steer:0,reverse:0,handbrake:1};this.addNotice('ON FOOT · WASD walk · arrows turn · V first person · G aim',false,5)}
  nearVehicle(){return [this.run.player,...this.parked,...this.run.traffic].filter(v=>!v.wrecked&&!v.submerged&&v.speed<4&&distance(v,this.actor)<5).sort((a,b)=>distance(a,this.actor)-distance(b,this.actor))[0]}
  targetNPC(range=7){return this.npcs.filter(n=>n.state!=='down'&&distance(n,this.actor)<range&&this.facing(n,.55)).sort((a,b)=>distance(a,this.actor)-distance(b,this.actor))[0]}
  facing(p,threshold=.55){const dx=p.x-this.actor.x,dz=p.z-this.actor.z,len=Math.hypot(dx,dz);return len<1||((dx*Math.sin(this.actor.yaw)-dz*Math.cos(this.actor.yaw))/len)>threshold}
  stationNear(){return this.stations.find(st=>Math.abs(st.s-this.actor.s)<70&&distance(st.clerk,this.actor)<70)}
  local(st,p=this.actor){return st.root.worldToLocal(new this.T.Vector3(p.x,p.y||0,p.z))}
  interact(){if(this.run.paused||this.run.over)return;if(!this.onFoot){this.exitCar();return}if(this.actor.swimming){this.addNotice('Swim to shore · WASD · R rescue',false,2);return}
    const npc=this.targetNPC();if(this.input.aim&&npc?.role==='attendant'){this.input.use=true;return}
    const st=this.stationNear(),q=st&&this.local(st);
    if(st&&q.x>45&&q.x<53&&q.z<-3&&q.z>-11){if(!st.snacksTaken){st.snacksTaken=true;this.snacks+=3;this.crime(1);this.addNotice('SNACKS TAKEN +3 · Z to eat',true,3)}else this.addNotice('These shelves are empty.',false,2);return}
    if(st&&Math.abs(q.x-24)<4&&Math.abs(q.z)<11){const pumps=st.blocks.filter(b=>b.kind==='pump');if(pumps.every(b=>b.broken)){this.addNotice('Pumps damaged. Find another station.',false,3);return}if(!st.fuelTaken){st.fuelTaken=true;this.cans++;this.crime(1);this.addNotice('FUEL CAN TAKEN · X near your car to refuel',true,3)}else this.addNotice('Fuel already collected here.',false,2);return}
    const v=this.nearVehicle();if(!v){this.addNotice('Get closer to a stopped car, shelf, pump or attendant.',false,3);return}
    if(v!==this.run.player&&v.occupied!==false){if(!this.input.aim||!this.facing(v,.25)){this.addNotice('Driver inside · face the car, hold G and press E to demand keys.',false,4);return}v.occupied=false;const pseudo={s:v.s,root:new this.T.Group()};const n=this.addNPC(pseudo,0,0,'#d5a878','civilian');n.x=v.x+3;n.z=v.z;n.home={x:n.x,z:n.z};n.state='flee';n.timer=10;this.crime(2);this.addNotice('Driver surrendered the car!',true,3)}
    if(v!==this.run.player){const old=this.run.player;old.isPlayer=false;old.kind='parked';old.occupied=false;old.input={throttle:0,brake:1,steer:0};if(!this.parked.includes(old))this.parked.push(old);this.parked=this.parked.filter(x=>x!==v);this.run.traffic=this.run.traffic.filter(x=>x!==v);v.isPlayer=true;v.kind='player';this.run.player=v;this.run.car=v.spec;this.applyPlayerUpgrades()}
    this.onFoot=false;this.avatar.visible=false;this.viewWeapon.visible=false;this.clearKeys();this.camState.snap=true;document.exitPointerLock?.();if(this.wanted>0&&!this.run.chase)this.beginCop(null);
  }
  crime(level){this.wanted=Math.min(5,Math.max(this.wanted,level));this.heat=35+this.wanted*8}
  attack(kind){if(!this.onFoot||this.actor.swimming||this.run.paused||this.run.over||this.run.elapsed<(this.nextAttack||0))return;this.nextAttack=this.run.elapsed+.42;this.punchUntil=this.run.elapsed+.24;this.punchSide=kind==='right'?1:0;
    const n=this.targetNPC(kind==='shot'?28:2.3);if(n){n.health-=kind==='shot'?60:35;n.state=n.health<=0?'down':'flee';n.timer=n.state==='down'?14:8;this.crime(2);this.addNotice(n.state==='down'?'Knocked down · witnesses called the police':'Civilian fleeing · wanted level increased',true,2)}
    else if(kind!=='shot')this.addNotice('Punch · move within arm’s reach.',false,1);
    if(kind==='shot'){this.crime(2);const T=this.T,dir=new T.Vector3(Math.sin(this.actor.yaw),0,-Math.cos(this.actor.yaw));for(let i=0;i<10;i++)this.effects.sparks.spawn(this.actor.x+dir.x*(i*.6),this.actor.y+1.3,this.actor.z+dir.z*(i*.6),0,0,0,.15,.08,0,1,.85,.4,1,0,0)}
  }
  clearKeys(){this.input={};for(const k in this.keys)this.keys[k]=false}
  keyDown(e){const k=e.key.toLowerCase();if(k==='?'&&!e.repeat){this.help.hidden=!this.help.hidden;return true}if(this.run.paused||this.run.over)return false;
    if(k==='e'){e.preventDefault();this.input.use=true;if(!e.repeat)this.interact();return true}
    if(k==='g'){e.preventDefault();this.input.aim=true;return true}
    if(k==='z'&&!e.repeat){if(this.snacks){this.snacks--;this.actor.health=Math.min(100,this.actor.health+35);this.actor.stamina=Math.min(100,this.actor.stamina+30);this.addNotice('Snack eaten · health +35 · stamina +30',false,2)}return true}
    if(k==='x'&&!e.repeat){if(this.cans&&(!this.onFoot||distance(this.actor,this.run.player)<5)){this.cans--;this.fuel=100;this.addNotice('Refuelled to 100%',false,2)}return true}
    if(!this.onFoot)return false;
    if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown','shift',' '].includes(k)){e.preventDefault();this.input[k]=true;return true}
    if(k==='v'||k==='c'){if(!e.repeat)this.firstPerson=!this.firstPerson;return true}
    if(['j','k','h'].includes(k)){if(!e.repeat)this.attack(k==='h'?'shot':k==='k'?'right':'left');return true}
    return false;
  }
  keyUp(e){const k=e.key.toLowerCase();this.input[k]=false;if(k==='e')this.input.use=false;if(k==='g')this.input.aim=false}
  isWater(p){const q={};this.toRoad(p.x,p.z,p.s,q);return this.road.env.sea&&this.groundY(q.s,q.d)<-4.8}
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
  update(dt){
    const p=this.run.player,a=this.actor;
    if(this.isWater(p)&&!p.submerged){p.submerged=true;p.vx=p.vy=p.r=0;this.exitCar(true);a.stamina=100;this.addNotice('CAR SUBMERGED! Swim to shore · WASD · Shift · R rescue',true,7)}
    for(const v of this.parked){v.input={throttle:0,brake:1,steer:0,handbrake:1};if(this.isWater(v))v.submerged=true}
    if(!this.onFoot&&!p.submerged){this.fuel=Math.max(0,this.fuel-p.speed*dt*.0009);if(this.fuel<=0){p.input.throttle=0;p.vx*=Math.exp(-dt*.4)}}
    if(this.onFoot){const turn=(this.input.arrowleft?1:0)-(this.input.arrowright?1:0);a.yaw+=turn*dt*2.2;
      const f=(this.input.w||this.input.arrowup?1:0)-(this.input.s||this.input.arrowdown?1:0),r=(this.input.d?1:0)-(this.input.a?1:0),norm=Math.max(1,Math.hypot(f,r)),speed=a.swimming?(this.input.shift?3.8:2.4):this.input.shift?7:3.6;
      a.x+=(Math.sin(a.yaw)*f+Math.cos(a.yaw)*r)/norm*speed*dt;a.z+=(-Math.cos(a.yaw)*f+Math.sin(a.yaw)*r)/norm*speed*dt;this.resolveBlocks(a,.35);this.toRoad(a.x,a.z,a.s,a);a.swimming=this.isWater(a);a.y=a.swimming?-4.7:this.groundY(a.s,a.d)+.17;
      if(a.swimming){a.stamina=Math.max(0,a.stamina-dt*(this.input.shift?5:2.2));if(a.stamina<=0){a.health-=dt*18;if(a.health<=0)this.rescue(true)}}else a.stamina=Math.min(100,a.stamina+dt*9);
      this.avatar.position.set(a.x,a.y,a.z);this.avatar.rotation.set(a.swimming?-.5:0,-a.yaw,0);this.avatar.visible=!this.firstPerson;const ud=this.avatar.userData;
      ud.gun.visible=!!this.input.aim&&!a.swimming;ud.arms.forEach((m,i)=>m.rotation.x=a.swimming?Math.sin(this.run.elapsed*6+i*Math.PI)*1.4:this.input.aim?Math.PI/2:this.punchUntil>this.run.elapsed&&i===this.punchSide?1.7:Math.sin(this.run.elapsed*9+i*Math.PI)*(f||r?.5:0));ud.legs.forEach((m,i)=>m.rotation.x=Math.sin(this.run.elapsed*(a.swimming?6:9)+i*Math.PI)*(f||r?.6:0));
      if(!a.swimming){for(const v of [p,...this.run.traffic,...this.parked]){if(distance(v,a)<v.W*.5+.45){const dx=a.x-v.x,dz=a.z-v.z,len=Math.hypot(dx,dz)||1;a.x=v.x+dx/len*(v.W*.5+.5);a.z=v.z+dz/len*(v.W*.5+.5);if(v.speed>4&&this.run.elapsed>(this.hitUntil||0)){a.health-=Math.min(40,v.speed);this.hitUntil=this.run.elapsed+1;this.addNotice('Hit by traffic! Z for a snack · R rescue',true,3)}}}if(a.health<=0)this.rescue(true)}
    }
    for(const n of this.npcs){if(n.st.root.parent===null&&this.stations.includes(n.st)){n.mesh.visible=false;continue}n.mesh.visible=true;n.timer=Math.max(0,n.timer-dt);
      if(n.state==='down'){n.mesh.rotation.z=Math.PI/2;if(!n.timer){n.health=100;n.state='flee';n.timer=8}continue}n.mesh.rotation.z=0;
      const aimed=this.onFoot&&this.input.aim&&distance(n,a)<9&&this.facing(n,.65);if(aimed){n.state='surrender';n.timer=2}else if(n.state==='surrender'&&!n.timer)n.state='idle';
      if(n.state==='flee'&&n.timer>0){const dx=n.x-a.x,dz=n.z-a.z,d=Math.hypot(dx,dz)||1;n.x+=dx/d*dt*3;n.z+=dz/d*dt*3;n.yaw=Math.atan2(dx,-dz);this.resolveBlocks(n,.35)}else if(n.role==='civilian'&&n.state!=='surrender'){n.x+=(n.home.x+Math.sin(this.run.elapsed*.35)*2-n.x)*dt*.8;n.z+=(n.home.z-n.z)*dt*.8}
      n.mesh.position.set(n.x,n.y,n.z);n.mesh.rotation.y=-n.yaw;n.mesh.userData.arms.forEach(m=>m.rotation.x=n.state==='surrender'?Math.PI:Math.sin(this.run.elapsed*8)*.2);
    }
    for(const st of this.stations){const eligible=this.onFoot&&!a.swimming&&this.input.aim&&this.input.use&&this.targetNPC(7)===st.clerk&&st.clerk.state!=='down'&&this.run.elapsed>=st.robbedUntil;
      st.progress=eligible?Math.min(3,st.progress+dt):0;if(st.progress>=3){st.progress=0;st.robbedUntil=this.run.elapsed+120;this.awardRoadCoins(35);this.snacks+=2;this.cans++;this.crime(3);this.addNotice('ROBBERY COMPLETE · +35 coins · +2 snacks · +1 fuel · escape!',true,7)}}
    this.heat=Math.max(0,this.heat-dt);if(this.wanted&&this.heat===0){this.wanted--;this.heat=this.wanted?12:0;if(!this.wanted)this.addNotice('Wanted level cleared.',false,3)}
    if(this.wanted&&this.onFoot){const near=this.run.pursuers.some(v=>!v.wrecked&&distance(v,a)<10);if(near){this.arrest=(this.arrest||0)+dt;if(this.arrest>4){this.rescue(true);this.addNotice('BUSTED · rescued at roadside · loot confiscated',true,5)}}else this.arrest=0}
    if(p.spec.drift||this.run.map.id==='drift'){const angle=Math.abs(Math.atan2(p.vy,Math.max(1,Math.abs(p.vx))));if(!this.onFoot&&p.speed>6&&angle>.12&&angle<1.35&&!p.wrecked){this.combo+=dt;this.driftScore+=dt*p.speed*angle*10*(1+Math.min(4,this.combo/3));this.best=Math.max(this.best,this.combo)}else this.combo=0}
    for(let i=this.debris.length-1;i>=0;i--){const d=this.debris[i];d.age+=dt;d.v.y-=9.8*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=dt*3;if(d.m.position.y<d.ground){d.m.position.y=d.ground;d.v.set(0,0,0)}if(d.age>8){this.scene.remove(d.m);d.m.geometry.dispose();d.m.material.dispose();this.debris.splice(i,1)}}
    // Expired streamed stations cannot leave invisible colliders or orphaned people/cars.
    for(const st of [...this.stations])if(!st.root.parent){this.blocks=this.blocks.filter(b=>b.st!==st);for(const n of this.npcs.filter(n=>n.st===st))this.disposeObject(n.mesh);this.npcs=this.npcs.filter(n=>n.st!==st);this.stations=this.stations.filter(x=>x!==st);for(const v of this.parked.filter(v=>v.station===st))this.disposeObject(v.mesh.group);this.parked=this.parked.filter(v=>v.station!==st)}
  }
  updateCamera(dt){const a=this.actor,T=this.T;this.camera.up.set(0,1,0);const eye=a.y+(a.swimming?.9:1.6),f=new T.Vector3(Math.sin(a.yaw),Math.sin(this.pitch||0),-Math.cos(a.yaw));let pos=new T.Vector3(a.x,eye,a.z);
    if(!this.firstPerson){pos.addScaledVector(f,-4.2);pos.y+=1.7;const gy=this.groundY(a.s,a.d);pos.y=Math.max(pos.y,gy+.5);const ray=new T.Raycaster(new T.Vector3(a.x,eye,a.z),pos.clone().sub(new T.Vector3(a.x,eye,a.z)).normalize(),0,5);const hit=ray.intersectObjects(this.blocks.filter(b=>!b.broken).map(b=>b.mesh),false)[0];if(hit)pos.copy(hit.point).addScaledVector(ray.ray.direction,-.2)}
    this.camera.position.copy(pos);this.camera.lookAt(a.x+f.x*5,eye+f.y*5,a.z+f.z*5);this.camera.near=.08;this.camera.fov=72;this.camera.updateProjectionMatrix();this.camState.pos.copy(pos);this.camState.snap=true;
    this.viewWeapon.visible=this.firstPerson&&!!this.input.aim&&!a.swimming;this.viewWeapon.position.copy(new T.Vector3(.22,-.18,-.55).applyQuaternion(this.camera.quaternion).add(pos));this.viewWeapon.quaternion.copy(this.camera.quaternion);
  }
  rescue(drowned=false){if(!this.onFoot)return;const a=this.actor,w=this.worldFromRoad(a.s,12);Object.assign(a,{x:w.x,y:w.y+.2,z:w.z,health:100,stamina:100,swimming:false});this.clearKeys();if(drowned){this.snacks=0;this.cans=0;this.wanted=0;this.heat=0;this.arrest=0}const p=this.run.player;p.submerged=false;p.place(a.s+6,12,0,0);p.health=Math.max(p.health,p.maxHealth*.3);p.wrecked=false;this.run.crashing=this.run.over=false;document.getElementById('driveGameover').hidden=true;this.addNotice(drowned?'RESCUED after drowning / injury · loot lost · car recovered':'Roadside rescue · your car is beside you · E to enter',false,5)}
  hud(){if(!this.ui)return;const a=this.actor,aimed=this.onFoot&&this.input.aim,npc=aimed&&this.targetNPC(),st=this.stationNear();
    document.getElementById('streetMode').textContent=this.onFoot?a.swimming?'SWIMMING':this.firstPerson?'FIRST PERSON':'ON FOOT':'BEHIND THE WHEEL';
    document.getElementById('streetStats').textContent=`${'★'.repeat(this.wanted)}${'☆'.repeat(5-this.wanted)}  ·  Health ${Math.ceil(a.health)}  ·  Snacks ${this.snacks}  ·  Fuel cans ${this.cans}  ·  ${Math.ceil(this.fuel)}% fuel`+(a.swimming?`  ·  Stamina ${Math.ceil(a.stamina)}%`:'')+((this.run.map.id==='drift'||this.run.player.spec.drift)?`  ·  DRIFT ${Math.floor(this.driftScore)} ×${(1+Math.min(4,this.combo/3)).toFixed(1)}`:'');
    let hint=this.onFoot?'WASD walk · ← → turn / click for mouse look · G aim · E interact · V view':'E get out when stopped · Visit gas station to try Street Life';
    if(npc?.role==='attendant')hint=this.run.elapsed<npc.st.robbedUntil?`Register empty · restocks in ${Math.ceil(npc.st.robbedUntil-this.run.elapsed)}s`:'HOLD G + E · intimidate attendant and rob the register';
    else if(this.onFoot&&this.nearVehicle())hint=aimed?'E · demand keys / enter car':'E · enter car (hold G if driver is inside)';
    if(a.swimming)hint=a.stamina>0?'WASD swim to land · Shift faster · R rescue':'DROWNING · swim ashore or press R to rescue!';
    document.getElementById('streetHint').textContent=hint;document.getElementById('streetProgress').style.width=((st?.progress||0)/3*100)+'%';this.ui.classList.toggle('aiming',!!aimed);this.ui.classList.toggle('in-water',a.swimming);
  }
  disposeObject(root){root.removeFromParent();root.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep&&!o.geometry.userData.shared)o.geometry.dispose();for(const m of [].concat(o.material||[]))if(!m.userData.keep){if(m.map&&!m.map.userData.keep)m.map.dispose();m.dispose()}})}
  dispose(){document.removeEventListener('mousemove',this.pointerMove);document.removeEventListener('mousedown',this.mouseDown);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('contextmenu',this.contextMenu);document.exitPointerLock?.();this.ui?.remove();this.actions?.remove();this.help?.remove();if(this.oldNote)document.querySelector('.drive-controls-note').innerHTML=this.oldNote}
}
