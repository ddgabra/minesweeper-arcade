/* Highway Run 3D — realistic driving engine built on three.js.
   World units are metres. The road is described in road coordinates (s = distance along the
   centre line, d = signed lateral offset, + to the right). Every vehicle runs the same
   four-wheel tyre model; collisions use impulses on oriented boxes and feed a per-side damage model.
   Road cars are community glTF models (see CREDITS.md), normalised offline to metres with +X forward. */
import * as T from 'three';
import {StreetLife} from './street-life.js';
import {loadCharacters} from './characters.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('driveCanvas'),overlay=$('driveOverlay'),octx=overlay.getContext('2d');
const carGrid=$('carGrid'),mapGrid=$('mapGrid'),garageCoins=$('driveCoins'),garageMessage=$('garageMessage'),speedReadout=$('driveSpeed'),runCoinsReadout=$('runCoins'),carsReadout=$('carsPassed'),raceClock=$('raceClock'),raceLabel=$('raceLabel'),eventBox=$('driveEvent'),pauseVeil=$('drivePause'),gameoverVeil=$('driveGameover'),modeNormal=$('modeNormal'),modeFast=$('modeFast'),modeChase=$('modeChase'),healthBar=$('driveHealthBar'),healthText=$('driveHealthText'),viewLabel=$('driveViewLabel');
let driveMode='normal';try{const savedMode=localStorage.getItem('highwayMode');driveMode=['normal','fast','chase'].includes(savedMode)?savedMode:'normal'}catch(_){}

// ---------------------------------------------------------------- data
// Road cars use real models (model = file in /models). accel is launch acceleration ×10 (m/s²); specs are
// approximate gameplay tuning loosely based on the real cars, not manufacturer data.
const cars=[
{id:'model3',name:'Tesla Model 3',price:0,color:'#c9ced3',model:'model3',drive:'rwd',electric:true,top:225,accel:60,brake:92,steer:3.3,health:150,weight:1.83,blurb:'Silent, instant torque · RWD'},
{id:'porsche',name:'Porsche 911 Carrera 4S',price:150,color:'#2c4f7c',model:'porsche',drive:'awd',top:306,accel:80,brake:100,steer:4.2,health:150,weight:1.58,blurb:'Precise and planted · AWD'},
{id:'cybertruck',name:'Tesla Cybertruck',price:260,color:'#a9afb4',model:'cybertruck',drive:'awd',electric:true,top:180,accel:70,brake:84,steer:2.6,health:320,weight:3.0,metal:true,blurb:'Stainless exoskeleton · AWD'},
{id:'urus',name:'Lamborghini Urus',price:420,color:'#e2a91c',model:'urus',drive:'awd',top:305,accel:78,brake:96,steer:3.5,health:230,weight:2.2,blurb:'Super-SUV · twin-turbo V8 · AWD'},
{id:'ferrari',name:'Ferrari 458 Spider',price:600,color:'#b3121b',model:'ferrari',drive:'rwd',top:325,accel:84,brake:100,steer:4.4,health:150,weight:1.48,blurb:'Mid-engine V8 · RWD'},
{id:'concept',name:'Khronos GT Concept',price:800,color:'#8e1b26',model:'concept',drive:'awd',top:315,accel:82,brake:98,steer:4.2,health:170,weight:1.57,blurb:'Concept supercar · AWD'},
{id:'interceptor',name:'Bastion Interceptor',price:900,color:'#65a9bc',shape:'combat',top:230,accel:62,brake:91,steer:3.1,health:260,weight:2.2,blurb:'Combat armor · reinforced frame'},
{id:'roadwarden',name:'Roadwarden APC',price:1350,color:'#91a476',shape:'apc',top:200,accel:48,brake:84,steer:2.3,health:420,weight:3.7,blurb:'Heavy armor · high impact resistance'},
{id:'super-tank',name:'Super Armored Tank',price:2600,color:'#82945f',shape:'tank',top:180,accel:40,brake:82,steer:1.8,health:600,weight:5.0,blurb:'MAX HEALTH · MAX WEIGHT'}
];
cars.push({...cars[1],id:'drift911',name:'911 Slide Club',price:0,drive:'rwd',drift:true,color:'#e78238',steer:5.8,blurb:'FREE · drift differential · rear-wheel drive'}, {...cars[4],id:'drift458',name:'458 Drift Special',price:0,drive:'rwd',drift:true,color:'#68dfc5',steer:6,blurb:'FREE · high-angle steering · drift tyres'});
const pursuitVehicles={
cop:{name:'Pursuit Cop',color:'#14161a',model:'urus',police:true,drive:'awd',health:200,weight:2.2,top:290,accel:76,brake:96,steer:3.3},
armored:{name:'Armored Truck',color:'#68745d',shape:'armoredTruck',health:540,weight:4.2,top:215,accel:46,brake:70,steer:2.0},
gunmen:{name:'Gunmen Truck',color:'#837b65',shape:'gunTruck',health:660,weight:4.4,top:205,accel:44,brake:70,steer:1.9}};
const boxTruckSpec={name:'Box Truck',color:'#dedbd2',shape:'boxTruck',health:520,weight:7.5,top:115,accel:20,brake:55,steer:1.6};
const civColors=['#ecebe6','#1c1e21','#a8adb3','#5c6168','#203b66','#8d1c1c','#561520','#c8b898','#2d4a36','#25334c','#d9d3c5','#3d70a8','#b23b2d','#e0e2e4','#33363b'];
const maps=[
{id:'country',name:'Country Roads',price:0,desc:'Farmland & forest · off-roading',offroad:true,coinMultiplier:1,
 env:{skyTop:'#4a82d2',skyHorizon:'#d3e5f1',sunColor:'#fff1d6',sunInt:3.1,sunElev:38,sunAz:-35,hemiSky:'#c3dbff',hemiGround:'#4f5f36',hemiInt:1.15,fog:[80,900],exposure:1,ground:'#4c7a39',ground2:'#7b9645',mountain:'#6c8b88',curve:1,hills:1,center:'#f2cf55',grip:1,offGrip:.62,props:'country',asphalt:'#3d4044'}},
{id:'neon',name:'Neon City',price:90,desc:'Night city · concrete barriers · 2× coins',city:true,offroad:false,coinMultiplier:2,
 env:{skyTop:'#050716',skyHorizon:'#3a2566',sunColor:'#9aa8ff',sunInt:.9,sunElev:50,sunAz:40,hemiSky:'#6d5cc4',hemiGround:'#2a2238',hemiInt:1.25,fog:[40,600],exposure:1.55,ground:'#262930',ground2:'#30343e',mountain:'#0d0b1c',night:true,curve:.55,hills:.25,center:'#6feaff',grip:.95,offGrip:.6,props:'city',asphalt:'#2b2d33',wet:true}},
{id:'desert',name:'Dust Devil Desert',price:160,desc:'Red rock & cactus · off-roading',offroad:true,coinMultiplier:1,
 env:{skyTop:'#3c82d4',skyHorizon:'#f2dab4',sunColor:'#ffe3ba',sunInt:3.7,sunElev:52,sunAz:20,hemiSky:'#d3e3ff',hemiGround:'#a06c44',hemiInt:1.2,fog:[100,1050],exposure:.92,ground:'#c48b58',ground2:'#dcae7a',mountain:'#b1623d',curve:.6,hills:1.3,center:'#ffd76a',grip:.98,offGrip:.55,props:'desert',asphalt:'#4a4642'}},
{id:'alpine',name:'Alpine Pass',price:260,desc:'Snow pines & peaks · low grip',offroad:true,coinMultiplier:1,
 env:{skyTop:'#5a90d6',skyHorizon:'#e7eff6',sunColor:'#ffffff',sunInt:2.9,sunElev:28,sunAz:-60,hemiSky:'#dcecff',hemiGround:'#b5c3cd',hemiInt:1.35,fog:[55,700],exposure:.86,ground:'#e9eff3',ground2:'#cfdae2',mountain:'#8ba2b7',snowCaps:true,curve:1.35,hills:2.2,center:'#f0d681',grip:.84,offGrip:.38,props:'alpine',asphalt:'#3f464d'}},
{id:'coast',name:'Sunset Coast',price:320,desc:'Palms by the sea · golden hour',offroad:true,coinMultiplier:1,
 env:{skyTop:'#2b3b78',skyHorizon:'#ffa064',sunColor:'#ff9b58',sunInt:3,sunElev:7,sunAz:-75,hemiSky:'#ffb68e',hemiGround:'#33445a',hemiInt:.95,fog:[75,950],exposure:1.05,ground:'#4e8a5a',ground2:'#86a157',mountain:'#4c4a6b',dusk:true,curve:.9,hills:.3,center:'#ffda83',grip:1,offGrip:.6,props:'coast',sea:true,asphalt:'#3e3f45'}}
];

maps.push({id:'drift',name:'Drift Playground',price:0,desc:'FREE · open skidpad · figure-eight course · drift score',offroad:true,coinMultiplier:1,env:{...maps[0].env,curve:0,hills:0,props:'drift',ground:'#45484d',ground2:'#45484d',grip:.85,offGrip:.85}});
// ---------------------------------------------------------------- garage (unchanged behaviour)
// The original box-model cars were replaced by real models; players keep an equivalent car for each one they owned.
const LEGACY_CARS={hatch:'model3',coupe:'porsche',rally:'cybertruck',muscle:'urus',electric:'ferrari',super:'concept'};
function loadGarage(){try{const data=JSON.parse(localStorage.getItem('highwayGarage')||'{}');const owned0=Array.isArray(data.ownedCars)?data.ownedCars.map(id=>LEGACY_CARS[id]||id):null,car0=LEGACY_CARS[data.car]||data.car;
 return{ownedCars:owned0?Array.from(new Set(['model3',...owned0.filter(id=>cars.some(c=>c.id===id))])):['model3'],ownedMaps:Array.isArray(data.ownedMaps)?Array.from(new Set(['country',...data.ownedMaps.filter(id=>maps.some(m=>m.id===id))])):['country'],car:cars.some(c=>c.id===car0&&(!owned0||owned0.includes(car0)||car0==='model3'))?car0:'model3',map:maps.some(m=>m.id===data.map&&(!Array.isArray(data.ownedMaps)||data.ownedMaps.includes(data.map)||data.map==='country'))?data.map:'country',paint:data.paint&&typeof data.paint==='object'?data.paint:{}}}catch(_){return{ownedCars:['model3'],ownedMaps:['country'],car:'model3',map:'country',paint:{}}}}
let garage=loadGarage();
for(const c of cars)if(c.price===0&&!garage.ownedCars.includes(c.id))garage.ownedCars.push(c.id);
for(const m of maps)if(m.price===0&&!garage.ownedMaps.includes(m.id))garage.ownedMaps.push(m.id);
function saveGarage(){try{localStorage.setItem('highwayGarage',JSON.stringify(garage))}catch(_){}}
function wallet(){return window.arcadeWallet?window.arcadeWallet.getBalance():0}
function sayGarage(text,type=''){garageMessage.textContent=text;garageMessage.className='garage-message'+(type?' '+type:'')}
function renderGarage(){garageCoins.textContent=wallet();carGrid.replaceChildren();mapGrid.replaceChildren();for(const car of cars){const owned=garage.ownedCars.includes(car.id),selected=garage.car===car.id,button=document.createElement('button');button.type='button';button.className='garage-car'+(selected?' selected':'')+(!owned?' locked':'');button.setAttribute('aria-pressed',String(selected));const swatch=document.createElement('span');swatch.className='car-swatch '+(car.shape||'coupe');swatch.style.background=carColor(car);const copy=document.createElement('span');copy.className='car-copy';const name=document.createElement('b');name.textContent=car.name;const stat=document.createElement('small');stat.textContent=`TOP ${car.top} · ACC ${car.accel} · BRK ${car.brake} · TURN ${car.steer.toFixed(1)} · HP ${car.health} · WT ${car.weight.toFixed(1)}t`;const action=document.createElement('em');action.textContent=selected?'SELECTED':owned?car.blurb:(car.price===0?'FREE':`🪙 ${car.price} · ${car.blurb}`);copy.append(name,stat,action);button.append(swatch,copy);if(selected){const check=document.createElement('span');check.className='car-check';check.textContent='✓';button.appendChild(check)}button.addEventListener('mouseenter',()=>showPreview(car));button.addEventListener('mouseleave',()=>showPreview(playerCar()));button.addEventListener('click',()=>{if(owned){garage.car=car.id;saveGarage();sayGarage(`${car.name} selected.`,'success');renderGarage();return}if(!window.arcadeWallet.spend(car.price)){sayGarage(`You need ${car.price-wallet()} more coins for ${car.name}.`,'error');return}garage.ownedCars.push(car.id);garage.car=car.id;saveGarage();sayGarage(`${car.name} unlocked and selected!`,'success');renderGarage()});carGrid.appendChild(button)}for(const map of maps){const owned=garage.ownedMaps.includes(map.id),selected=garage.map===map.id,button=document.createElement('button');button.type='button';button.className='map-choice'+(selected?' selected':'');button.setAttribute('aria-pressed',String(selected));const name=document.createElement('b');name.textContent=map.name;const desc=document.createElement('small');desc.textContent=selected?'SELECTED · '+map.desc:owned?map.desc:(map.price===0?'FREE':`🪙 ${map.price} · ${map.desc}`);button.append(name,desc);button.addEventListener('click',()=>{if(owned){garage.map=map.id;saveGarage();sayGarage(`${map.name} selected.`,'success');renderGarage();return}if(!window.arcadeWallet.spend(map.price)){sayGarage(`You need ${map.price-wallet()} more coins for ${map.name}.`,'error');return}garage.ownedMaps.push(map.id);garage.map=map.id;saveGarage();sayGarage(`${map.name} unlocked!`,'success');renderGarage()});mapGrid.appendChild(button)}const count=$('carCount');if(count)count.textContent=cars.length+' CARS';renderPaints();renderDifficulty();showPreview(playerCar())}
window.renderHighwayGarage=renderGarage;
// ---------------------------------------------------------------- paint
const PAINTS=[['Factory',null],['Rosso Corsa','#b3121b'],['Giallo','#e2a91c'],['Racing blue','#2c4f7c'],['Obsidian','#121417'],['Glacier white','#e6e8e6'],['Quicksilver','#9aa1a8'],['Sage','#7f9a8c'],['Papaya','#e5641c']];
function carColor(car){return(garage.paint&&garage.paint[car.id])||car.color}
function renderPaints(){const row=$('paintRow');if(!row)return;row.replaceChildren();const car=playerCar(),current=garage.paint&&garage.paint[car.id]||null;
 for(const[name,hex]of PAINTS){const b=document.createElement('button');b.type='button';b.className='paint-swatch'+((hex||null)===current?' active':'');b.title=name;b.setAttribute('aria-label',name+' paint');b.style.background=hex||car.color;if(!hex)b.textContent='F';
  b.addEventListener('click',()=>{if(!garage.paint)garage.paint={};if(hex)garage.paint[car.id]=hex;else delete garage.paint[car.id];saveGarage();renderPaints();if(preview.car)preview.car.mats.paint.color.set(carColor(car));if(preview.car&&preview.car.mats.paint2)preview.car.mats.paint2.color.set(carColor(car)).multiplyScalar(.28);sayGarage(`${name} paint applied to the ${car.name}.`,'success')});row.appendChild(b)}}
const playerCar=()=>cars.find(c=>c.id===garage.car)||cars[0],currentMap=()=>maps.find(m=>m.id===garage.map)||maps[0];
let street=null;
let run=null;const keys={left:false,right:false,gas:false,brake:false,handbrake:false,lookBack:false},stationKeys={left:false,right:false};

// ---------------------------------------------------------------- helpers
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
function randomInt(n){return Math.floor(Math.random()*n)}
function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}
function smooth01(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function mulberry(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function addNotice(text,alert=false,duration=3){if(!run)return;run.notice={text,alert,until:run.elapsed+duration}}

// ---------------------------------------------------------------- difficulty, driver assists & view settings
// One slider from 0 (easy) to 100 (realistic). Lower = quicker, more sensitive steering, extra grip, every assist,
// lighter traffic, less damage and slower police. The assist toggles follow the slider until the player changes one.
const DIFF_TIERS=[[0,'EASY','Quick, sensitive steering · extra grip · every assist on · light traffic · half damage'],[25,'CASUAL','Responsive steering · all assists · fewer cars · reduced damage'],[50,'BALANCED','Natural steering with traction control & ABS · normal traffic'],[75,'SIMULATION','Real grip & steering ratio · ABS only · heavy traffic · full damage'],[93,'REALISTIC','No assists · real tyre limits · dense traffic · full damage · faster police']];
const GFX=['ultra','high','balanced','performance'];
function assistDefaults(level){return{tc:level<72,abs:level<90,esc:level<55,assist:level<32}}
let difficulty=(()=>{const d={level:40,custom:false,tc:true,abs:true,esc:true,assist:false,fov:0,camDist:1,gfx:'high'};try{const s=JSON.parse(localStorage.getItem('highwayDifficulty')||'{}');if(Number.isFinite(s.level))d.level=clamp(s.level,0,100);for(const k of['custom','tc','abs','esc','assist'])if(typeof s[k]==='boolean')d[k]=s[k];if(Number.isFinite(s.fov))d.fov=clamp(s.fov,-10,20);if(Number.isFinite(s.camDist))d.camDist=clamp(s.camDist,.75,1.6);if(GFX.includes(s.gfx))d.gfx=s.gfx}catch(_){}if(!d.custom)Object.assign(d,assistDefaults(d.level));return d})();
function saveDifficulty(){try{localStorage.setItem('highwayDifficulty',JSON.stringify(difficulty))}catch(_){}}
function diffTier(){let t=DIFF_TIERS[0];for(const tier of DIFF_TIERS)if(difficulty.level>=tier[0])t=tier;return t}
function diffParams(){const k=difficulty.level/100;return{k,steerRate:lerp(2.2,1,k),steerRange:lerp(1.32,1,k),grip:lerp(1.2,1,k),offGrip:lerp(1.4,1,k),damage:lerp(.45,1.05,k),traffic:lerp(.45,1.3,k),spawn:lerp(1.9,.8,k),cop:lerp(.86,1.05,k),copEvery:lerp(1.6,.85,k),tc:difficulty.tc,abs:difficulty.abs,esc:difficulty.esc?lerp(1.8,1,k):0,assist:difficulty.assist}}
function renderDifficulty(){const s=$('diffSlider');if(!s)return;s.value=String(difficulty.level);const t=diffTier();$('diffName').textContent=t[1];$('diffDesc').textContent=t[2];
 $('assistTc').checked=difficulty.tc;$('assistAbs').checked=difficulty.abs;$('assistEsc').checked=difficulty.esc;$('assistSteer').checked=difficulty.assist;$('assistReset').hidden=!difficulty.custom;
 $('fovSlider').value=String(difficulty.fov);$('fovValue').textContent=(difficulty.fov>0?'+':'')+difficulty.fov+'°';$('camDistSlider').value=String(Math.round(difficulty.camDist*100));$('camDistValue').textContent=Math.round(difficulty.camDist*100)+'%';$('gfxQuality').value=difficulty.gfx;
 s.style.setProperty('--fill',difficulty.level+'%')}
function wireDifficulty(){const s=$('diffSlider');if(!s)return;
 s.addEventListener('input',()=>{difficulty.level=Number(s.value);if(!difficulty.custom)Object.assign(difficulty,assistDefaults(difficulty.level));saveDifficulty();renderDifficulty();if(run&&run.player)applyPlayerUpgrades()});
 for(const[id,key]of[['assistTc','tc'],['assistAbs','abs'],['assistEsc','esc'],['assistSteer','assist']])$(id).addEventListener('change',e=>{difficulty[key]=e.target.checked;difficulty.custom=true;saveDifficulty();renderDifficulty()});
 $('assistReset').addEventListener('click',()=>{difficulty.custom=false;Object.assign(difficulty,assistDefaults(difficulty.level));saveDifficulty();renderDifficulty()});
 $('fovSlider').addEventListener('input',e=>{difficulty.fov=Number(e.target.value);saveDifficulty();renderDifficulty()});
 $('camDistSlider').addEventListener('input',e=>{difficulty.camDist=Number(e.target.value)/100;saveDifficulty();renderDifficulty()});
 $('gfxQuality').addEventListener('change',e=>{difficulty.gfx=e.target.value;saveDifficulty();renderDifficulty()})}

// ---------------------------------------------------------------- upgrades & gas station (game rules kept from 2D version)
const upgradeFamilies=[
{key:'accel',icon:'⚙️',describe:v=>'+'+Math.round(v*100)+'% acceleration.',items:[['Economy Ignition Kit',60,.06],['Street Intake',140,.12],['Sport Camshaft',350,.2],['Twin-Turbo Kit',800,.32],['Prototype Supercharger',1800,.48]]},
{key:'top',icon:'🏁',describe:v=>'+'+Math.round(v*100)+'% top speed.',items:[['Free-Flow Exhaust',70,.04],['Long-Ratio Gears',160,.09],['Aero Package',400,.16],['Race Gearbox',900,.27],['Jetline Turbine',2200,.42]]},
{key:'brake',icon:'🛑',describe:v=>'+'+Math.round(v*100)+'% braking power.',items:[['Ceramic Brake Pads',65,.08],['Vented Rotors',150,.16],['Track Brake Kit',375,.27],['Carbon-Ceramic Brakes',850,.4],['Motorsport Brake System',2000,.58]]},
{key:'steer',icon:'🛞',describe:v=>'+'+Math.round(v*100)+'% steering response & tyre grip.',items:[['Quick-Ratio Rack',70,.08],['Sport Alignment',160,.16],['Hydraulic Steering',390,.26],['Competition Rack',900,.38],['Active Steering System',2100,.55]]},
{key:'armor',icon:'🛡️',describe:v=>'Reduces all impact damage by '+Math.round(v*100)+'%.',items:[['Door Reinforcement',90,.06],['Steel Door Bars',190,.12],['Rally Safety Cage',460,.2],['Ballistic Side Panels',1100,.32],['Composite Armor Shell',2500,.48]]},
{key:'health',icon:'❤️',describe:v=>'+'+Math.round(v*100)+'% maximum vehicle health.',items:[['Heavy-Duty Radiator',100,.08],['Protected Fuel Cell',220,.16],['Reinforced Chassis',520,.27],['Armored Frame',1250,.42],['Military-Grade Frame',2800,.65]]},
{key:'coins',icon:'🪙',describe:v=>'Earn '+Math.round(v*100)+'% more road coins.',items:[['Lucky Dashboard',80,.06],['Coin Tracker',180,.12],['Sponsor Decal Pack',450,.2],['Premium Route Contract',1050,.32],['Golden Route Contract',2400,.5]]},
{key:'magnet',icon:'🧲',describe:v=>'Collect coins from '+(v/40).toFixed(1)+' m farther away.',items:[['Salvage Magnet',70,22],['Wide-Range Magnet',170,44],['Electromagnetic Coil',430,72],['High-Power Induction Array',950,112],['Superconducting Coin Field',2200,160]]},
{key:'ram',icon:'💥',describe:v=>'+'+Math.round(v*100)+'% damage dealt to pursuing vehicles.',items:[['Reinforced Bumper',100,.1],['Impact Bar',230,.2],['Rally Bull Bar',550,.32],['Pursuit Ram Plate',1300,.48],['Titan Kinetic Ram',3000,.7]]},
{key:'recovery',icon:'🔋',describe:v=>'+'+Math.round(v*100)+'% engine boost for 2 s after a collision.',items:[['Rebound Engine Mounts',120,.08],['Momentum Flywheel',280,.16],['Impact Recovery Kit',680,.27],['Race-Grade Energy Cell',1550,.42],['Kinetic Recovery System',3500,.62]]}
];
const roadUpgrades=upgradeFamilies.flatMap(family=>family.items.map((entry,index)=>({id:family.key+'-'+(index+1),name:entry[0],cost:entry[1],stat:family.key,value:entry[2],icon:family.icon,description:family.describe(entry[2]),tier:index+1})));
function upgradeStats(){return{accel:0,top:0,brake:0,steer:0,armor:0,health:0,coins:0,magnet:0,ram:0,recovery:0}}
function isPolicePursuit(){return !!(run&&(run.chase||(run.pursuers||[]).some(p=>p.kind==='cop')))}
function canEnterGasStation(){if(!run||run.paused||run.over||run.crashing||isPolicePursuit()||run.nextStationKm<=0)return false;const remaining=run.nextStationKm*1000-run.distanceMeters;return remaining>=0&&remaining<=300&&run.lane>=2.5}
function updateStationEntry(){const entry=$('stationEntry');if(entry)entry.hidden=!canEnterGasStation()}
function chooseStationStock(){const available=roadUpgrades.filter(item=>!run.purchasedUpgrades.includes(item.id));for(let i=available.length-1;i>0;i--){const j=randomInt(i+1);[available[i],available[j]]=[available[j],available[i]]}run.stationStock=available.slice(0,5)}
function renderStationShop(){const list=$('stationItems');if(!list||!run)return;list.replaceChildren();$('stationKm').textContent=String(run.stationKm);$('gasStationCoins').textContent=String(wallet());$('stationMessage').textContent='';for(const item of run.stationStock){const button=document.createElement('button'),owned=run.purchasedUpgrades.includes(item.id);button.type='button';button.className='station-upgrade';button.disabled=owned;const title=document.createElement('strong');title.textContent=item.icon+' '+item.name;const description=document.createElement('small');description.textContent=item.description;const cost=document.createElement('em');cost.className=owned?'station-owned':'';cost.textContent=owned?'✓ INSTALLED':'🪙 '+item.cost;button.append(title,description,cost);button.addEventListener('click',()=>buyRoadUpgrade(item.id));list.appendChild(button)}}
function buyRoadUpgrade(id){if(!run||!run.stationOpen)return;const item=run.stationStock.find(upgrade=>upgrade.id===id);if(!item||run.purchasedUpgrades.includes(id))return;if(!window.arcadeWallet.spend(item.cost)){$('stationMessage').textContent='Not enough coins for that upgrade. Your balance is '+wallet()+'.';return}run.purchasedUpgrades.push(id);const p=run.player;if(item.stat==='health'){const increase=Math.round(run.car.health*item.value);p.maxHealth+=increase;p.health=Math.min(p.maxHealth,p.health+increase)}else run.upgradeStats[item.stat]+=item.value;applyPlayerUpgrades();$('gasStationCoins').textContent=String(wallet());renderStationShop();$('stationMessage').textContent=item.name+' installed. It stays with you for the rest of this run.';renderGarage();setDriveHud()}
function openGasStation(km){run.stationOpen=true;run.stationKm=km;run.stationPlayerX=14;run.stationTalked=false;run.paused=true;for(const key in keys)keys[key]=false;for(const key in stationKeys)stationKeys[key]=false;chooseStationStock();$('gasStation').hidden=false;$('stationShop').hidden=true;$('workerBubble').hidden=true;$('stationMessage').textContent='';$('stationWalkHint').textContent='Walk to the counter with A / D or ← / →. Press E to talk.';$('stationPlayer').style.left=run.stationPlayerX+'%';$('stationEntry').hidden=true;audio.pause(true);
 // Repairs come with the stop: the mechanic straightens the alignment and patches the body.
 const p=run.player;p.dmg.left*=.35;p.dmg.right*=.35;p.dmg.front*=.35;p.dmg.rear*=.35;p.health=Math.min(p.maxHealth,p.health+p.maxHealth*.25);restoreBodywork(p,.6)}
function closeGasStation(){if(!run||!run.stationOpen)return;run.stationOpen=false;run.paused=false;$('gasStation').hidden=true;for(const key in stationKeys)stationKeys[key]=false;$('pauseDrive').textContent='Ⅱ Pause';audio.pause(false);setDriveHud()}
function updateStationWalk(dt){if(!run||!run.stationOpen)return;const direction=(stationKeys.right?1:0)-(stationKeys.left?1:0);run.stationPlayerX=clamp(run.stationPlayerX+direction*25*dt,7,67);$('stationPlayer').style.left=run.stationPlayerX+'%';const close=run.stationPlayerX>=53;$('workerBubble').hidden=!close;if(close){$('workerBubble').textContent='Patched you up a bit. What are you looking to purchase? Press E to browse today’s stock.';$('stationWalkHint').textContent='Press E or TALK to see the five items in stock.'}else $('stationWalkHint').textContent='Walk to the counter with A / D or ← / →. Press E to talk.'}
function talkToWorker(){if(!run||!run.stationOpen)return;if(run.stationPlayerX<53){$('stationWalkHint').textContent='Walk closer to the attendant first.';return}run.stationTalked=true;$('workerBubble').textContent='What are you looking to purchase?';$('workerBubble').hidden=false;$('stationShop').hidden=false;$('stationWalkHint').textContent='Choose from today’s five upgrades. They stay active for this entire run.';renderStationShop()}
function tryEnterGasStation(){if(!run||run.stationOpen)return false;const remaining=run.nextStationKm*1000-run.distanceMeters;if(remaining<0||remaining>300)return false;if(isPolicePursuit()){addNotice('COPS ON YOUR TAIL — you cannot take the gas station exit.',true,4);return false}if(run.lane<2.5){addNotice('GAS EXIT AHEAD — move to the far-right lane, then press E.',false,4);return false}const km=run.nextStationKm;run.nextStationKm+=3;openGasStation(km);setDriveHud();return true}
function processGasStation(km){if(isPolicePursuit())addNotice('GAS EXIT MISSED — cops blocked the stop. Your upgrades remain active.',true,5);else addNotice('GAS EXIT PASSED — take the far-right exit next time.',false,5)}

// ---------------------------------------------------------------- road geometry
const LANE_W=3.7,ROAD_HALF=LANE_W*2,SHOULDER=2.6,EDGE=ROAD_HALF+SHOULDER,STEP=2,SEG_LEN=80,SEG_BEHIND=2,SEG_AHEAD=11,GRAV=9.81,START_S=400,BARRIER_D=EDGE-.35;
const laneD=l=>(l-1.5)*LANE_W;
let road=null;
function makeRoad(env){road={env,seed:Math.random()*20,xs:[0],zs:[0],curve:env.curve,hills:env.hills}}
function roadTheta(s){const k=smooth01((s-250)/700),c=road.curve,q=road.seed;return k*c*(.42*Math.sin(s/600+q)+.18*Math.sin(s/240+q*2.3)+.1*Math.sin(s/1500+q*.7))}
function roadElev(s){const k=smooth01((s-200)/600),h=road.hills,q=road.seed;return k*h*(7*Math.sin(s/480+q)+3*Math.sin(s/170+q*1.9))}
function ensureRoad(s){const xs=road.xs,zs=road.zs;while((xs.length-1)*STEP<s+STEP*2){const i=xs.length,th=roadTheta((i-.5)*STEP);xs.push(xs[i-1]+Math.sin(th)*STEP);zs.push(zs[i-1]-Math.cos(th)*STEP)}}
const RP={x:0,z:0,y:0,th:0,sin:0,cos:1};
function roadAt(s,out=RP){s=Math.max(0,s);ensureRoad(s);const i=Math.floor(s/STEP),f=s/STEP-i;out.x=road.xs[i]+(road.xs[i+1]-road.xs[i])*f;out.z=road.zs[i]+(road.zs[i+1]-road.zs[i])*f;out.y=roadElev(s);out.th=roadTheta(s);out.sin=Math.sin(out.th);out.cos=Math.cos(out.th);return out}
function worldFromRoad(s,d,out={x:0,z:0,y:0,th:0}){const p=roadAt(s);out.x=p.x+p.cos*d;out.z=p.z+p.sin*d;out.th=p.th;out.y=groundY(s,d);return out}
function toRoad(x,z,s,out){for(let k=0;k<3;k++){const p=roadAt(s);s+=(x-p.x)*p.sin-(z-p.z)*p.cos}const p=roadAt(s);out.s=s;out.d=(x-p.x)*p.cos+(z-p.z)*p.sin;out.th=p.th;return out}
function stationS(km){return START_S+km*1000}
function stationFlat(s,d){if(d<0)return 0;const km=Math.round((s-START_S)/3000)*3;if(km<=0)return 0;const ds=s-stationS(km);if(ds<-230||ds>95||d>90)return 0;return clamp(Math.min((ds+230)/40,(95-ds)/25,(90-d)/15),0,1)}
function groundY(s,d){if(road.env.props==='drift')return 0;const base=roadElev(s),ad=Math.abs(d),env=road.env;if(ad<=EDGE+.4)return base;const t=ad-EDGE-.4;
 if(env.props==='city')return base+.16;
 if(env.sea&&d<0)return base-Math.min(t*.11,7.5)+Math.sin(s*.03+d*.2)*.15*Math.min(1,t/10);
 let y=base-.5*Math.sin(Math.min(1,t/6)*Math.PI);
 if(t>6){const u=t-6,hm=Math.min(1.6,env.hills+.3);y+=u*.045*hm+(Math.sin(s*.021+d*.13)*Math.sin(s*.013-d*.05)*2.2+Math.sin(s*.0071+d*.031)*5)*Math.min(1,u/30)*hm}
 const st=stationFlat(s,d);if(st>0)y=y*(1-st)+base*st;return y}

// ---------------------------------------------------------------- three.js bootstrap
const HAS3D=!!T&&!!T.WebGLRenderer;
let renderer=null,scene=null,camera=null,pmrem=null;
const shared={};const geoCache=new Map();const texCache=new Map();
let tmpM,tmpQ,tmpE,tmpV,tmpV2,tmpS,UP;
if(HAS3D){tmpM=new T.Matrix4();tmpQ=new T.Quaternion();tmpE=new T.Euler();tmpV=new T.Vector3();tmpV2=new T.Vector3();tmpS=new T.Vector3();UP=new T.Vector3(0,1,0)}
function keepGeo(key,fn){let g=geoCache.get(key);if(!g){g=fn();g.userData.keep=true;geoCache.set(key,g)}return g}
function maxAniso(){return renderer?renderer.capabilities.getMaxAnisotropy():4}
function canvasTex(w,h,draw,{repeat=true,srgb=true}={}){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new T.CanvasTexture(c);if(srgb)t.colorSpace=T.SRGBColorSpace;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,maxAniso());t.userData.keep=true;return t}
function cachedTex(key,fn){let t=texCache.get(key);if(!t){t=fn();texCache.set(key,t)}return t}
// Photo-scanned ground textures (Poly Haven, CC0) in /textures; they stream in after the world is built.
let texLoader=null;
function realTex(name,srgb=false){return cachedTex('real-'+name,()=>{texLoader=texLoader||new T.TextureLoader();const t=texLoader.load('textures/'+name+'.webp');t.wrapS=t.wrapT=T.RepeatWrapping;if(srgb)t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,maxAniso());t.userData.keep=true;return t})}
function grain(g,w,h,amt,seed=1){const img=g.getImageData(0,0,w,h),d=img.data,r=mulberry(seed);for(let i=0;i<d.length;i+=4){const n=(r()-.5)*amt;d[i]+=n;d[i+1]+=n;d[i+2]+=n}g.putImageData(img,0,0)}
function roadTexture(env){return cachedTex('road-'+env.props,()=>canvasTex(1024,1024,(g,w,h)=>{
 const pxm=w/(EDGE*2),pvm=h/24,X=d=>(d+EDGE)*pxm;
 g.fillStyle=env.asphalt;g.fillRect(0,0,w,h);
 g.fillStyle='rgba(255,255,255,.035)';g.fillRect(0,0,X(-ROAD_HALF),h);g.fillRect(X(ROAD_HALF),0,w-X(ROAD_HALF),h);
 for(let l=0;l<4;l++)for(const o of[-.85,.85]){g.fillStyle='rgba(0,0,0,.09)';g.fillRect(X(laneD(l)+o)-.35*pxm,0,.7*pxm,h)}
 const r=mulberry(7);for(let i=0;i<40;i++){g.strokeStyle=`rgba(0,0,0,${.12+r()*.15})`;g.lineWidth=1+r()*1.5;g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);for(let k=0;k<6;k++){x+=(r()-.5)*40;y+=r()*40;g.lineTo(x,y)}g.stroke()}
 for(let i=0;i<10;i++){g.fillStyle=`rgba(0,0,0,${.05+r()*.06})`;const l=randomIntR(r,4);g.beginPath();g.ellipse(X(laneD(l))+(r()-.5)*30,r()*h,10+r()*18,22+r()*40,0,0,7);g.fill()}
 grain(g,w,h,38,3);
 const line=(d,wm,col,from=0,to=24)=>{g.fillStyle=col;g.fillRect(X(d)-wm*pxm/2,from*pvm,wm*pxm,(to-from)*pvm)};
 const white='#e9ebe6';line(-ROAD_HALF+.2,.16,white);line(ROAD_HALF-.2,.16,white);
 for(const d of[-LANE_W,LANE_W]){line(d,.14,white,0,3);line(d,.14,white,12,15)}
 line(-.14,.11,env.center);line(.14,.11,env.center);
 for(const d of[-ROAD_HALF-.75,ROAD_HALF+.75])for(let v=0;v<24;v+=.6)line(d,.5,'rgba(255,255,255,.07)',v,v+.25);
 grain(g,w,h,16,5)}))}
function randomIntR(r,n){return Math.floor(r()*n)}
function detailTex(kind){return cachedTex('detail-'+kind,()=>canvasTex(512,512,(g,w,h)=>{g.fillStyle='#dcdcdc';g.fillRect(0,0,w,h);const r=mulberry(kind.length*31+3);
 for(let i=0;i<(kind==='city'?200:2600);i++){const x=r()*w,y=r()*h,s=kind==='city'?2+r()*6:1+r()*3;const v=kind==='snow'?200+r()*55:120+r()*135;g.fillStyle=`rgba(${v},${v},${v},${kind==='snow'?.35:.55})`;if(kind==='grass'){g.fillRect(x,y,1.2,s*2.4)}else{g.beginPath();g.arc(x,y,s,0,7);g.fill()}}
 if(kind==='city'){g.strokeStyle='rgba(60,60,60,.5)';g.lineWidth=2;for(let i=0;i<=w;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,h);g.moveTo(0,i);g.lineTo(w,i);g.stroke()}}
 grain(g,w,h,kind==='snow'?18:40,kind.length)}))}
function radialTex(key,stops){return cachedTex('rad-'+key,()=>canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);for(const[o,c]of stops)gr.addColorStop(o,c);g.fillStyle=gr;g.fillRect(0,0,w,h)},{repeat:false}))}
function smokeTex(){return cachedTex('smoke',()=>canvasTex(128,128,(g)=>{const r=mulberry(11);for(let i=0;i<22;i++){const x=40+r()*48,y=40+r()*48,rad=18+r()*26,gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(255,255,255,.28)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128)}},{repeat:false}))}
function facadeTex(lit){return cachedTex('facade'+lit,()=>canvasTex(512,512,(g,w,h)=>{g.fillStyle=lit?'#000':'#1b1e27';g.fillRect(0,0,w,h);if(!lit){g.fillStyle='#232733';for(let x=0;x<16;x+=4)g.fillRect(x*32,0,6,h)}const r=mulberry(5);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const on=r()<.38,warm=r()<.7;const c=on?(warm?'#ffd49a':'#bfe4ff'):(lit?'#000':'#2c3442');g.fillStyle=lit&&!on?'#000':c;if(!lit&&on)g.fillStyle=warm?'#5d5040':'#40505e';g.fillRect(x*32+7,y*32+8,18,15)}}))}
function textTex(text,{w=512,h=128,bg='rgba(0,0,0,0)',fg='#fff',font='900 74px system-ui',sub=null}={}){return cachedTex('txt-'+text+fg+bg+(sub||''),()=>canvasTex(w,h,(g)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.font=font;g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,sub?h*.38:h/2);if(sub){g.font='800 '+Math.round(h*.2)+'px system-ui';g.fillText(sub,w/2,h*.76)}},{repeat:false}))}

function initShared(){if(shared.ready)return;shared.ready=true;
 const S=(o)=>{const m=new T.MeshStandardMaterial(o);m.userData.keep=true;return m};
 shared.trim=S({color:0x121315,roughness:.55,metalness:.25});
 shared.plastic=S({color:0x1d1f22,roughness:.78,metalness:.05});
 shared.chrome=S({color:0xe8eaec,roughness:.12,metalness:1});
 shared.rim=S({color:0xb9bec4,roughness:.28,metalness:.92});
 shared.rimDark=S({color:0x2a2d31,roughness:.5,metalness:.6});
 shared.rubber=S({color:0x141414,roughness:.92,metalness:0,side:T.DoubleSide});
 shared.under=S({color:0x0b0b0c,roughness:1});
 shared.white=S({color:0xf2f2ee,roughness:.5});
 shared.plate=S({color:0xf4f1e6,roughness:.45});
 shared.armor=S({color:0x3a4037,roughness:.75,metalness:.45});
 shared.track=S({color:0x1b1c1b,roughness:.95});
 shared.skin=S({color:0xc49a74,roughness:.8});
 shared.cargo=S({color:0xd9d9d4,roughness:.6,metalness:.1});
 shared.detail=S({vertexColors:true,roughness:.5,metalness:.35});
 shared.wheelMat=S({vertexColors:true,roughness:.55,metalness:.4,side:T.DoubleSide});
 shared.lightMat=new T.MeshBasicMaterial({vertexColors:true});shared.lightMat.userData.keep=true;
 shared.glass=new T.MeshPhysicalMaterial({color:0x0b1317,metalness:.15,roughness:.04,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.6});shared.glass.userData.keep=true;
 shared.glassBroken=new T.MeshStandardMaterial({color:0x5f6d72,roughness:.65,metalness:.1});shared.glassBroken.userData.keep=true;
 shared.decal=new T.MeshBasicMaterial({map:textTex('POLICE',{fg:'#f4f6fa',font:'900 86px system-ui'}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});shared.decal.userData.keep=true;
 shared.blob=new T.MeshBasicMaterial({map:radialTex('blob',[[0,'rgba(0,0,0,.62)'],[.55,'rgba(0,0,0,.38)'],[1,'rgba(0,0,0,0)']]),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});shared.blob.userData.keep=true;
}

// ---------------------------------------------------------------- geometry helpers
function xf(geo,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){const g=geo.clone();tmpE.set(rx,ry,rz);tmpQ.setFromEuler(tmpE);tmpM.compose(tmpV.set(x,y,z),tmpQ,tmpS.set(sx,sy,sz));g.applyMatrix4(tmpM);return g}
function box(w,h,d,x,y,z,rx=0,ry=0,rz=0){return xf(new T.BoxGeometry(w,h,d),x,y,z,rx,ry,rz)}
function cyl(rt,rb,h,seg,x,y,z,rx=0,ry=0,rz=0){return xf(new T.CylinderGeometry(rt,rb,h,seg),x,y,z,rx,ry,rz)}
function beam(p1,p2,t,w){const dx=p2[0]-p1[0],dy=p2[1]-p1[1],dz=p2[2]-p1[2],len=Math.hypot(dx,dy,dz);const g=new T.BoxGeometry(len,t,w);tmpQ.setFromUnitVectors(new T.Vector3(1,0,0),tmpV.set(dx,dy,dz).normalize());tmpM.compose(new T.Vector3((p1[0]+p2[0])/2,(p1[1]+p2[1])/2,(p1[2]+p2[2])/2),tmpQ,tmpS.set(1,1,1));g.applyMatrix4(tmpM);return g}
function mergeGeos(list){let total=0;const parts=list.map(g0=>{const g=g0.index?g0.toNonIndexed():g0;if(!g.attributes.normal)g.computeVertexNormals();total+=g.attributes.position.count;return g});const hasCol=parts.every(g=>g.attributes.color);const pos=new Float32Array(total*3),nor=new Float32Array(total*3),uv=new Float32Array(total*2),col=hasCol?new Float32Array(total*3):null;let o=0;for(const g of parts){const n=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);if(col)col.set(g.attributes.color.array,o*3);o+=n}const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));out.setAttribute('uv',new T.BufferAttribute(uv,2));if(col)out.setAttribute('color',new T.BufferAttribute(col,3));out.computeBoundingSphere();return out}
function weld(geo){const pos=geo.attributes.position,map=new Map(),idx=[],verts=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),k=Math.round(x*1e3)+'_'+Math.round(y*1e3)+'_'+Math.round(z*1e3);let j=map.get(k);if(j===undefined){j=verts.length/3;map.set(k,j);verts.push(x,y,z)}idx.push(j)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();return g}
function extrudeShape(shape,width,bevel=.06,curveSeg=10){const depth=Math.max(.05,width-bevel*2);const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*.8,bevelSegments:3,curveSegments:curveSeg,steps:1});g.translate(0,0,-depth/2);return g}
function taper(g,y0,y1,amount){const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);const k=clamp((y-y0)/(y1-y0),0,1);p.setZ(i,p.getZ(i)*(1-amount*k))}return g}

// ---------------------------------------------------------------- vehicle models
const SHAPES={
 hatch:{L:3.95,W:1.76,wheelR:.31,wb:2.5,clr:.16,kind:'car',drive:'fwd'},
 coupe:{L:4.45,W:1.84,wheelR:.33,wb:2.65,clr:.13,kind:'car',drive:'rwd'},
 rally:{L:4.3,W:1.86,wheelR:.33,wb:2.6,clr:.22,kind:'car',drive:'awd'},
 muscle:{L:4.8,W:1.94,wheelR:.35,wb:2.85,clr:.14,kind:'car',drive:'rwd'},
 electric:{L:4.75,W:1.92,wheelR:.35,wb:2.9,clr:.14,kind:'car',drive:'awd'},
 super:{L:4.55,W:2.0,wheelR:.34,wb:2.7,clr:.1,kind:'car',drive:'rwd'},
 combat:{L:5.0,W:2.05,wheelR:.4,wb:3.0,clr:.26,kind:'car',drive:'awd'},
 police:{L:5.0,W:1.92,wheelR:.34,wb:2.9,clr:.15,kind:'car',drive:'rwd'},
 apc:{L:6.2,W:2.5,wheelR:.55,wb:3.6,clr:.42,kind:'truck',drive:'awd',H:2.3},
 armoredTruck:{L:6.6,W:2.45,wheelR:.5,wb:3.9,clr:.35,kind:'truck',drive:'rwd',H:2.65},
 gunTruck:{L:6.5,W:2.4,wheelR:.5,wb:3.8,clr:.35,kind:'truck',drive:'rwd',H:2.3},
 boxTruck:{L:8.2,W:2.5,wheelR:.5,wb:5.0,clr:.4,kind:'truck',drive:'rwd',H:3.4},
 tank:{L:7.2,W:3.3,wheelR:.42,wb:4.6,clr:.42,kind:'tank',drive:'awd',H:2.5}
};
const PROFILES={
 hatch:{noseH:.68,belt:.95,roof:1.47,tail:1.0,ws:.30,rf:.47,rr:.9,rg:.97},
 coupe:{noseH:.6,belt:.86,roof:1.32,tail:.88,ws:.34,rf:.52,rr:.72,rg:.88},
 rally:{noseH:.68,belt:.94,roof:1.44,tail:.98,ws:.3,rf:.46,rr:.84,rg:.94},
 muscle:{noseH:.74,belt:.92,roof:1.33,tail:.92,ws:.4,rf:.56,rr:.72,rg:.86},
 electric:{noseH:.62,belt:.9,roof:1.42,tail:.93,ws:.27,rf:.44,rr:.76,rg:.93},
 super:{noseH:.5,belt:.78,roof:1.16,tail:.9,ws:.33,rf:.5,rr:.66,rg:.92,axle:-.05},
 combat:{noseH:.86,belt:1.1,roof:1.7,tail:1.12,ws:.32,rf:.46,rr:.9,rg:.96},
 police:{noseH:.68,belt:.94,roof:1.47,tail:.97,ws:.33,rf:.5,rr:.74,rg:.86}
};
function newRecipe(){const roles={};return{roles,add(role,g){(roles[role]||(roles[role]=[])).push(g)}}}
function buildCarData(key,variant){
 const sh=SHAPES[key],P=PROFILES[key],L=sh.L,W=sh.W,R=sh.wheelR,clr=sh.clr,X=f=>L/2-f*L,ax=P.axle||0,fa=sh.wb/2+ax,ra=-sh.wb/2+ax,F=L/2+.04,B=-L/2-.04;
 const rc=newRecipe(),ar=R+.07,bot=clr+.12;
 const s=new T.Shape();s.moveTo(-L/2+.12,bot);
 for(const axx of[ra,fa]){s.lineTo(axx-ar,bot);s.lineTo(axx-ar,R);s.absarc(axx,R,ar,Math.PI,0,true);s.lineTo(axx+ar,bot)}
 s.lineTo(L/2-.14,bot-.02);s.quadraticCurveTo(L/2+.02,bot+.02,L/2,clr+.4);s.lineTo(L/2-.02,P.noseH-.06);s.quadraticCurveTo(L/2-.04,P.noseH,L/2-.22,P.noseH+.02);
 s.quadraticCurveTo(X(P.ws)+.45,P.belt+.01,X(P.ws),P.belt);s.lineTo(X(P.rg),P.belt);
 s.quadraticCurveTo(-L/2+.14,P.tail+.03,-L/2+.02,P.tail-.06);s.lineTo(-L/2-.01,clr+.35);s.quadraticCurveTo(-L/2-.01,bot,-L/2+.12,bot);
 const bodyG=weld(taper(extrudeShape(s,W,.07,12),P.belt-.3,P.belt,.05));
 const gw=W*.8,gs=new T.Shape();gs.moveTo(X(P.ws)+.02,P.belt-.04);gs.quadraticCurveTo(X((P.ws+P.rf)/2)+.04,(P.belt+P.roof)/2+.07,X(P.rf),P.roof-.04);gs.quadraticCurveTo(X((P.rf+P.rr)/2),P.roof+.03,X(P.rr),P.roof-.05);gs.quadraticCurveTo(X((P.rr+P.rg)/2)-.02,(P.roof+P.belt)/2+.06,X(P.rg)-.02,P.belt-.04);gs.lineTo(X(P.ws)+.02,P.belt-.04);
 const glassG=weld(taper(extrudeShape(gs,gw,.05,10),P.belt,P.roof,.16));
 const rs=new T.Shape(),mid=X((P.rf+P.rr)/2);rs.moveTo(X(P.rf)-.07,P.roof-.065);rs.quadraticCurveTo(mid,P.roof+.05,X(P.rr)+.07,P.roof-.075);rs.quadraticCurveTo(mid,P.roof-.005,X(P.rf)-.07,P.roof-.065);
 const roofG=weld(extrudeShape(rs,gw*.86+.05,.03,10));
 const zb=gw/2+.03,zt=zb*.84,xbp=X(P.rf+(P.rr-P.rf)*.45);
 for(const sd of[-1,1]){rc.add('paintX',beam([X(P.ws)+.03,P.belt-.01,sd*zb],[X(P.rf),P.roof-.05,sd*zt],.07,.07));rc.add('paintX',beam([X(P.rg)-.03,P.belt-.01,sd*zb],[X(P.rr),P.roof-.06,sd*zt],.07,.15));rc.add('trim',beam([xbp,P.belt,sd*zb],[xbp-.06,P.roof-.06,sd*zt],.05,.07))}
 rc.add('under',box(L-.5,.14,W-.25,0,clr+.13,0));
 const bF=box(.24,.3,W-.04,F-.07,clr+.27,0),bR=box(.24,.3,W-.04,B+.07,clr+.29,0);
 rc.add('trim',box(.08,.07,W*.86,F-.02,clr+.11,0));rc.add('trim',box(.1,.08,W*.8,B+.04,clr+.12,0));
 const head=[],tail=[],police=[];
 for(const sd of[-1,1]){rc.add('head',box(.14,.09,.38,F-.02,P.noseH-.1,sd*(W/2-.33)));head.push([F+.07,P.noseH-.1,sd*(W/2-.33)]);rc.add('tail',box(.1,.11,.38,B+.01,P.tail-.14,sd*(W/2-.3)));tail.push([B-.07,P.tail-.14,sd*(W/2-.3)])}
 if(key!=='electric')rc.add('trim',box(.06,.15,W*.42,F-.02,P.noseH-.21,0));else{rc.add('neon',box(.04,.03,W*.78,F-.03,P.noseH-.05,0));rc.add('tail',box(.05,.04,W*.82,B+.03,P.tail-.08,0))}
 rc.add('plate',box(.02,.11,.5,F+.01,clr+.33,0));rc.add('plate',box(.02,.12,.5,B-.01,P.tail-.36,0));
 const mirrors=[box(.18,.1,.2,X(P.ws)-.14,P.belt+.1,-(W/2+.07)),box(.18,.1,.2,X(P.ws)-.14,P.belt+.1,W/2+.07)];
 rc.add('chrome',cyl(.045,.045,.22,10,B+.04,clr+.16,.45,0,0,Math.PI/2));if(key==='muscle'||key==='super')rc.add('chrome',cyl(.05,.05,.22,10,B+.04,clr+.16,-.45,0,0,Math.PI/2));
 let wing=null;
 if(key==='hatch')rc.add('paintX',box(.26,.04,W*.72,X(P.rr)-.08,P.roof-.03,0));
 if(key==='coupe')rc.add('paintX',box(.2,.05,W*.78,B+.12,P.tail+.03,0));
 if(key==='rally'){rc.add('paintX',box(.42,.09,.32,X((P.rf+P.rr)/2),P.roof+.04,0));for(const z of[-.45,-.15,.15,.45])rc.add('head',cyl(.08,.08,.06,12,F+.02,clr+.52,z,0,0,Math.PI/2));for(const sd of[-1,1]){rc.add('trim',box(.03,.22,.3,ra-ar-.05,clr+.1,sd*(W/2-.2)))}wing=mergeGeos([box(.3,.04,W*.84,B+.2,P.tail+.25,0),box(.12,.22,.05,B+.22,P.tail+.12,-W*.3),box(.12,.22,.05,B+.22,P.tail+.12,W*.3)])}
 if(key==='muscle'){rc.add('paintX',box(.75,.1,.56,X(P.ws*.55),P.belt-.04,0,0,0,-.07));for(const z of[-.16,.16]){rc.add('white',beam([F-.2,P.noseH+.035,z],[X(P.ws)+.05,P.belt+.035,z],.012,.17));rc.add('white',beam([X(P.rf)-.05,P.roof-.03,z],[X(P.rr)+.05,P.roof-.035,z],.012,.17));rc.add('white',beam([X(P.rg)-.02,P.belt+.035,z],[B+.15,P.tail+.03,z],.012,.17))}rc.add('paintX',box(.16,.05,W*.8,B+.1,P.tail+.04,0))}
 if(key==='super'){wing=mergeGeos([box(.36,.045,W*.92,B+.28,P.tail+.36,0),beam([B+.38,P.tail-.02,-W*.28],[B+.3,P.tail+.34,-W*.28],.04,.06),beam([B+.38,P.tail-.02,W*.28],[B+.3,P.tail+.34,W*.28],.04,.06)]);for(const sd of[-1,1])rc.add('trim',box(.62,.24,.05,X(.62),P.belt-.24,sd*(W/2+.01)));rc.add('trim',box(.5,.12,W*.86,B+.18,clr+.12,0))}
 if(key==='combat'){for(const sd of[-1,1]){if(variant!=='civ')rc.add('armor',box(L*.42,.32,.05,0,clr+.55,sd*(W/2+.03)));rc.add('trim',box(.05,.5,.06,F+.08,clr+.45,sd*.55))}rc.add('trim',box(.06,.06,W*.92,F+.1,clr+.66,0));rc.add('trim',box(.06,.06,W*.92,F+.1,clr+.32,0));if(variant!=='civ'){rc.add('trim',box(1.1,.06,1.3,X((P.rf+P.rr)/2),P.roof+.06,0));for(const z of[-.4,-.13,.13,.4])rc.add('head',box(.08,.12,.2,X(P.rf)+.05,P.roof+.12,z))}}
 if(key==='police'){for(const sd of[-1,1]){rc.add('polBlack',box((P.rg-P.ws)*L*.92,P.belt-clr-.3,.02,X((P.ws+P.rg)/2),(P.belt+clr+.2)/2,sd*(W/2+.012)));rc.add('decal',xf(new T.PlaneGeometry(1.5,.38),X((P.ws+P.rg)/2),P.belt-.24,sd*(W/2+.03),0,sd>0?0:Math.PI,0))}
  rc.add('trim',box(.32,.08,W*.74,X((P.rf+P.rr)/2),P.roof+.04,0));rc.add('pRed',box(.28,.1,W*.34,X((P.rf+P.rr)/2),P.roof+.11,-W*.19));rc.add('pBlue',box(.28,.1,W*.34,X((P.rf+P.rr)/2),P.roof+.11,W*.19));police.push([X((P.rf+P.rr)/2),P.roof+.14,-W*.19,0],[X((P.rf+P.rr)/2),P.roof+.14,W*.19,1]);rc.add('trim',box(.08,.32,W*.62,F+.1,clr+.42,0))}
 return{rc,single:{body:bodyG,glass:glassG,roof:roofG,bumperF:bF,bumperR:bR,mirrorL:mirrors[0],mirrorR:mirrors[1],wing},wheels:[[fa,R,-(W/2-.15),1],[fa,R,W/2-.15,1],[ra,R,-(W/2-.15),0],[ra,R,W/2-.15,0]],R,wid:key==='super'||key==='muscle'?.3:.24,head,tail,police,eye:[Math.min(X(P.rf)-.58,X(P.ws)-.78),Math.min(P.belt+.3,P.roof-.14),-W*.21],hood:[X(P.ws)+.12,P.belt+.22,0],bumper:[F+.1,clr+.45,0],dash:{x:X(P.ws)-.12,y:P.belt+.02,w:W*.86},L,W,H:P.roof,P,roofMat:key==='electric'?'glass':'paint'}}
function buildTruckData(key){
 const sh=SHAPES[key],L=sh.L,W=sh.W,R=sh.wheelR,clr=sh.clr,H=sh.H,F=L/2,B=-L/2,rc=newRecipe(),head=[],tail=[],police=[];let body,glass,extra=null,wheels=[];
 const fa=sh.wb/2,ra=-sh.wb/2;
 if(key==='tank'){
  const s=new T.Shape();s.moveTo(B,.55);s.lineTo(F-1.25,.55);s.lineTo(F,1.2);s.lineTo(F-.95,1.78);s.lineTo(B+.25,1.78);s.lineTo(B,1.32);s.lineTo(B,.55);
  body=extrudeShape(s,W-1.0,.04,1);
  for(const sd of[-1,1]){rc.add('track',box(L-.3,.95,.62,0,.55,sd*(W/2-.31)));rc.add('paintX',box(L-.1,.06,.76,0,1.07,sd*(W/2-.33)));for(let i=0;i<6;i++)rc.add('rimDark',cyl(.34,.34,.66,14,B+.9+i*(L-1.8)/5,.45,sd*(W/2-.31),Math.PI/2));rc.add('rimDark',cyl(.26,.26,.66,12,F-.35,.8,sd*(W/2-.31),Math.PI/2));rc.add('rimDark',cyl(.26,.26,.66,12,B+.3,.8,sd*(W/2-.31),Math.PI/2))}
  extra=mergeGeos([xf(new T.CylinderGeometry(1.12,1.35,.72,8),-.45,2.15,0,0,Math.PI/8,0,1.25,1,1),cyl(.11,.13,4.3,12,-.45+1.35+2.0,2.2,0,0,0,Math.PI/2),cyl(.15,.15,.4,12,-.45+1.35+4.0,2.2,0,0,0,Math.PI/2),cyl(.38,.38,.14,12,-.9,2.58,.4)]);
  rc.add('trim',cyl(.05,.05,.8,6,-1.2,2.9,-.6));rc.add('trim',box(.5,.2,.5,F-.6,1.55,.9));
  for(const sd of[-1,1]){rc.add('head',box(.1,.14,.22,F-.06,1.3,sd*.9));head.push([F,1.3,sd*.9]);rc.add('tail',box(.08,.1,.2,B+.02,1.45,sd*1.0));tail.push([B,1.45,sd*1.0])}
  glass=box(.3,.08,.5,F-.6,1.82,.5);
  return{rc,single:{body,glass,roof:null,bumperF:null,bumperR:null,mirrorL:null,mirrorR:null,wing:null,turret:extra},wheels:[],R,wid:.3,head,tail,police,eye:[F-1.2,2.3,0],hood:[F-.8,2.15,0],bumper:[F+.2,1.0,0],dash:null,L,W,H:2.9,roofMat:'paint'}}
 const cabLen=key==='armoredTruck'||key==='apc'?L:2.35;
 const s=new T.Shape();
 if(key==='apc'){s.moveTo(B,clr+.15);s.lineTo(F-.55,clr+.15);s.lineTo(F,1.25);s.lineTo(F-1.5,H-.2);s.lineTo(B+.25,H-.2);s.lineTo(B,H-.75);s.lineTo(B,clr+.15)}
 else{s.moveTo(F-cabLen,clr+.1);s.lineTo(F-.08,clr+.1);s.lineTo(F,1.3);s.lineTo(F-.35,1.42);s.lineTo(F-.85,H-.02);s.lineTo(F-cabLen,H-.02);s.lineTo(F-cabLen,clr+.1)}
 body=extrudeShape(s,W,.06,1);
 if(key==='apc'){glass=mergeGeos([box(.06,.14,.5,F-.62,1.42,-.55,0,0,.85),box(.06,.14,.5,F-.62,1.42,.55,0,0,.85)]);extra=mergeGeos([cyl(.55,.65,.45,10,-.2,H+.02,0),cyl(.07,.07,1.8,8,.75,H+.08,0,0,0,Math.PI/2)]);for(const sd of[-1,1])rc.add('armor',box(L*.7,.35,.05,-.2,1.05,sd*(W/2+.03)))}
 else{glass=mergeGeos([beam([F-.36,1.45,0],[F-.83,H-.06,0],.04,W*.86),box(.5,.36,.03,F-.6-(key==='armoredTruck'?0:.3),H-.45,-(W/2+.005)),box(.5,.36,.03,F-.6-(key==='armoredTruck'?0:.3),H-.45,W/2+.005)])}
 if(key==='armoredTruck'){rc.add('trim',box(.1,.5,W*.9,F+.05,clr+.45,0));for(const sd of[-1,1]){rc.add('armor',box(L*.55,.6,.05,-L*.12,1.3,sd*(W/2+.03)));rc.add('trim',box(.05,.06,L*.4,-L*.2,H-.1,sd*.7,0,Math.PI/2))}rc.add('trim',box(.6,.12,.6,-.8,H+.04,0));for(let i=0;i<4;i++)rc.add('trim',box(.04,.25,.12,-1.5+i*.35,1.95,W/2+.02))}
 if(key==='gunTruck'||key==='boxTruck'){const bedLen=L-cabLen-.15,bx=F-cabLen-.08-bedLen/2;
  if(key==='boxTruck'){rc.add('cargo',box(bedLen,H-clr-.45,W+.05,bx,(H+clr+.45)/2,0));rc.add('trim',box(bedLen,.22,W-.2,bx,clr+.3,0))}
  else{rc.add('paintX',box(bedLen,.18,W,bx,clr+.55,0));for(const sd of[-1,1])rc.add('paintX',box(bedLen,.45,.06,bx,clr+.86,sd*(W/2-.03)));rc.add('paintX',box(.06,.45,W,bx-bedLen/2+.03,clr+.86,0));
   extra=mergeGeos([cyl(.45,.5,.25,14,bx+.2,clr+.78,0),box(.12,.5,.12,bx+.2,clr+1.1,0)]);rc.add('trim',box(1.3,.1,.1,bx+.85,clr+1.45,0));rc.add('trim',box(.08,.5,.62,bx+.55,clr+1.4,0));rc.add('skin',cyl(.12,.12,.25,10,bx-.2,clr+1.65,0));rc.add('armor',cyl(.18,.22,.6,10,bx-.2,clr+1.3,0))}}
 for(const sd of[-1,1]){rc.add('head',box(.08,.14,.32,F+.02,1.05,sd*(W/2-.35)));head.push([F+.03,1.05,sd*(W/2-.35)]);rc.add('tail',box(.08,.14,.28,B-.02,clr+.65,sd*(W/2-.3)));tail.push([B-.03,clr+.65,sd*(W/2-.3)])}
 rc.add('trim',box(.08,.4,W*.6,F+.03,.75,0));rc.add('under',box(L-.4,.25,W-.3,0,clr+.05,0));
 const mirrors=key==='apc'?[null,null]:[box(.1,.32,.18,F-.5,1.95,-(W/2+.18)),box(.1,.32,.18,F-.5,1.95,W/2+.18)];
 wheels=[[fa,R,-(W/2-.2),1],[fa,R,W/2-.2,1],[ra,R,-(W/2-.2),0],[ra,R,W/2-.2,0]];if(key==='boxTruck'||key==='apc')wheels.push([ra+1.25,R,-(W/2-.2),0],[ra+1.25,R,W/2-.2,0]);
 return{rc,single:{body,glass,roof:null,bumperF:null,bumperR:null,mirrorL:mirrors[0],mirrorR:mirrors[1],wing:null,turret:extra},wheels,R,wid:.34,head,tail,police,eye:[F-1.15,2.0,-W*.22],hood:[F-.5,1.85,0],bumper:[F+.15,.9,0],dash:null,L,W,H,roofMat:'paint'}}
// Vehicles are assembled from a handful of merged meshes (body, glass, paint details, vertex-coloured trim,
// lights, wheels) so a full highway of traffic stays cheap on integrated GPUs.
const DETAIL_COLORS={trim:0x141517,under:0x0b0b0c,plate:0xe9e6da,chrome:0xc9ccd0,white:0xf0f0ec,polBlack:0x111214,armor:0x3a4037,track:0x1b1c1b,rimDark:0x2a2d31,skin:0xc49a74,cargo:0xd9d9d4};
const LIGHT_COLORS={head:0xfff3dc,neon:0xc8fff0};
function colorize(geo,hex){const g=geo.index?geo.toNonIndexed():geo.clone();if(!g.attributes.normal)g.computeVertexNormals();const n=g.attributes.position.count,c=new Float32Array(n*3);tmpColor.set(hex);for(let i=0;i<n;i++){c[i*3]=tmpColor.r;c[i*3+1]=tmpColor.g;c[i*3+2]=tmpColor.b}g.setAttribute('color',new T.BufferAttribute(c,3));return g}
function mergeIndexed(a,b){const pa=a.attributes.position.array,pb=b.attributes.position.array,na=pa.length/3;const pos=new Float32Array(pa.length+pb.length);pos.set(pa);pos.set(pb,pa.length);const idx=Array.from(a.index.array);for(const i of b.index.array)idx.push(i+na);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
const rawCache=new Map(),dataCache=new Map();
function rawData(shape,variant){const k=shape+'|'+variant;let d=rawCache.get(k);if(!d){d=PROFILES[shape]?buildCarData(shape,variant):buildTruckData(shape);rawCache.set(k,d)}return d}
function vehicleData(shape,variant,separate){const k=shape+'|'+variant+'|'+(separate?1:0);let d=dataCache.get(k);if(d)return d;const raw=rawData(shape,variant),R=raw.rc.roles;
 const det=[];for(const role in DETAIL_COLORS)if(R[role])for(const g of R[role])det.push(colorize(g,DETAIL_COLORS[role]));
 const lights=[];for(const role in LIGHT_COLORS)if(R[role])for(const g of R[role])lights.push(colorize(g,LIGHT_COLORS[role]));
 const paintList=[...(R.paintX||[])];if(!separate)for(const key of['bumperF','bumperR','mirrorL','mirrorR','wing'])if(raw.single[key])paintList.push(raw.single[key]);
 let body=raw.single.body,glass=raw.single.glass;if(raw.single.roof){if(raw.roofMat==='glass')glass=mergeIndexed(glass.index?glass:weld(glass),raw.single.roof);else body=mergeIndexed(body,raw.single.roof)}
 const merged={paintX:paintList.length?mergeGeos(paintList):null,detail:det.length?mergeGeos(det):null,lights:lights.length?mergeGeos(lights):null,tail:R.tail?mergeGeos(R.tail.map(g=>colorize(g,0xff2a18))):null,decal:R.decal?mergeGeos(R.decal):null,pRed:R.pRed?mergeGeos(R.pRed):null,pBlue:R.pBlue?mergeGeos(R.pBlue):null};
 d=Object.assign({},raw,{merged,body,glass,separate});for(const g of[body,glass,...Object.values(merged),...Object.values(raw.single)])if(g)g.userData.keep=true;dataCache.set(k,d);return d}
function wheelGeo(R,wid,side){return keepGeo('wheel'+R+'_'+wid+'_'+side,()=>{const pts=[[R*.66,-wid/2],[R-.035,-wid/2],[R-.004,-wid/2+.035],[R,0],[R-.004,wid/2-.035],[R-.035,wid/2],[R*.66,wid/2]].map(p=>new T.Vector2(p[0],p[1]));const tire=new T.LatheGeometry(pts,24);tire.rotateX(Math.PI/2);const o=side*(wid/2-.01);const rim=[cyl(R*.62,R*.62,.02,20,0,0,o,Math.PI/2),cyl(R*.13,R*.13,.06,10,0,0,o+side*.02,Math.PI/2)];for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rim.push(xf(new T.BoxGeometry(R*1.12,.07,.035),0,0,o+side*.015,0,0,a))}const inner=cyl(R*.64,R*.64,wid*.92,16,0,0,0,Math.PI/2);return mergeGeos([colorize(tire,0x151515),...rim.map(g=>colorize(g,0xb4b9bf)),colorize(inner,0x2a2d31)])})}
function paintMaterial(color,player){if(player){const m=new T.MeshPhysicalMaterial({color,metalness:.5,roughness:.3,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.15,side:T.DoubleSide});return m}return new T.MeshStandardMaterial({color,metalness:.55,roughness:.3,envMapIntensity:1.25})}
function createVehicleMesh(spec,opts={}){
 if(spec.model)return createModelVehicle(spec,opts);
 initShared();const shape=spec.shape,variant=opts.civilian?'civ':'std',separate=!!(opts.player||opts.separate),data=vehicleData(shape,variant,separate);
 const group=new T.Group();group.rotation.order='YZX';const body=new T.Group();group.add(body);
 const paint=paintMaterial(opts.police?'#f2f2ef':opts.color||spec.color,opts.player);const mats={paint,tail:new T.MeshBasicMaterial({vertexColors:true,color:new T.Color(.45,.45,.45)})};
 if(data.merged.pRed){mats.pRed=new T.MeshBasicMaterial({color:0x401010});mats.pBlue=new T.MeshBasicMaterial({color:0x101a40})}
 const add=(geo,mat,deform=false,shadow=true)=>{let g=geo;if(deform){g=geo.clone();g.userData={}}const m=new T.Mesh(g,mat);m.castShadow=shadow;m.receiveShadow=false;if(deform)m.userData.deform=true;body.add(m);return m};
 const parts={};const M=data.merged;
 parts.body=add(data.body,paint,true);parts.glass=add(data.glass,shared.glass,true);
 if(data.single.turret)parts.turret=add(data.single.turret,paint,true);
 if(M.paintX)parts.paintX=add(M.paintX,paint);if(M.detail)parts.detail=add(M.detail,shared.detail);
 if(M.lights)parts.lights=add(M.lights,shared.lightMat,false,false);if(M.tail)parts.tail=add(M.tail,mats.tail,false,false);
 if(M.decal)add(M.decal,shared.decal,false,false);if(M.pRed){add(M.pRed,mats.pRed,false,false);add(M.pBlue,mats.pBlue,false,false)}
 if(separate)for(const k of['bumperF','bumperR','mirrorL','mirrorR','wing'])if(data.single[k])parts[k]=add(data.single[k],paint);
 const wheels=[];for(const[x,y,z,front]of data.wheels){const side=z<0?-1:1,pivot=new T.Group();pivot.position.set(x,y,z);const spin=new T.Group();pivot.add(spin);const m=new T.Mesh(wheelGeo(data.R,data.wid,side),shared.wheelMat);m.castShadow=true;spin.add(m);group.add(pivot);wheels.push({pivot,spin,front:!!front,side,x,z})}
 const blob=new T.Mesh(keepGeo('blobPlane',()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)),shared.blob);blob.scale.set(data.L*1.25,1,data.W*1.45);blob.position.y=.03;blob.renderOrder=1;group.add(blob);
 if(opts.player&&data.dash)body.add(buildInterior(data));
 return{group,body,parts,wheels,mats,data,blob}}
function buildInterior(data){const g=new T.Group();g.name='interior';g.visible=false;const d=data.dash,P=data.P;const dashMat=new T.MeshStandardMaterial({color:0x1a1c20,roughness:.85});
 const ex=data.eye[0],ey=data.eye[1],ez=data.eye[2],belt=P.belt,front=d.x+.17,back=ex+.42,len=Math.max(.2,front-back),X=f=>data.L/2-f*data.L;
 g.add(new T.Mesh(box(X(P.ws)-X(P.rg),.02,data.W*.84,(X(P.ws)+X(P.rg))/2,belt+.012,0),new T.MeshStandardMaterial({color:0x232528,roughness:.95})));
 g.add(new T.Mesh(box(len,.14,d.w,(front+back)/2,belt+.07,0),dashMat));g.add(new T.Mesh(box(.12,.06,.34,back+.07,belt+.17,ez,0,0,.35),dashMat));
 const rf=data.L/2-P.rf*data.L,rr=data.L/2-P.rr*data.L,head=new T.Mesh(box(Math.max(.3,rf-rr+.1),.02,data.W*.7,(rf+rr)/2,P.roof-.075,0),new T.MeshStandardMaterial({color:0x3a3c40,roughness:.95}));g.add(head);
 const tilt=new T.Group();tilt.position.set(ex+.4,belt+.06,ez);tilt.rotation.z=.38;const wheel=new T.Group();tilt.add(wheel);const wm=new T.MeshStandardMaterial({color:0x121212,roughness:.55});const rim=new T.Mesh(new T.TorusGeometry(.17,.019,8,32),wm);rim.rotation.y=Math.PI/2;wheel.add(rim);for(let i=0;i<3;i++){const arm=new T.Group();arm.rotation.x=i*Math.PI*2/3+Math.PI;const sp=new T.Mesh(new T.BoxGeometry(.018,.16,.03),wm);sp.position.y=.08;arm.add(sp);wheel.add(arm)}wheel.add(new T.Mesh(new T.CylinderGeometry(.05,.05,.04,16).rotateZ(Math.PI/2),wm));g.add(tilt);g.userData.wheel=wheel;
 const mirror=new T.Mesh(box(.025,.055,.2,ex+.56,P.roof-.1,0),new T.MeshStandardMaterial({color:0x8a9096,metalness:1,roughness:.08}));g.add(mirror);
 const seat=new T.MeshStandardMaterial({color:0x26282c,roughness:.9});for(const z of[data.eye[2],-data.eye[2]]){g.add(new T.Mesh(box(.12,.62,.5,data.eye[0]-.32,data.eye[1]-.15,z,0,0,-.18),seat))}
 return g}
function disposeVehicle(v){if(!v||!v.mesh)return;v.mesh.group.traverse(o=>{if(o.isMesh&&o.userData.deform&&!o.geometry.userData.shared)o.geometry.dispose()});for(const k in v.mesh.mats){const m=v.mesh.mats[k];for(const x of[].concat(m))if(x&&x.dispose&&!x.userData.keep)x.dispose()}if(v.mesh.group.parent)v.mesh.group.parent.remove(v.mesh.group)}
function restoreBodywork(v,amount){v.mesh.group.traverse(o=>{if(o.isMesh&&o.userData.deform&&o.geometry.userData.orig){const a=o.geometry.attributes.position.array,orig=o.geometry.userData.orig;for(let i=0;i<a.length;i++)a[i]+=(orig[i]-a[i])*amount;o.geometry.attributes.position.needsUpdate=true;o.geometry.computeVertexNormals()}});if(amount>.5&&v.mesh.parts.glass)v.mesh.parts.glass.material=shared.glass;if(amount>.5&&v.glassBroken){for(const m of v.mesh.parts.glassList||[])m.material=m.userData.origMat;v.glassBroken=false}}

// ---------------------------------------------------------------- real car models (glTF)
// Files are produced by tools/build-cars.mjs: metres, +X forward, +Z right, wheels on y=0. Node names starting
// with WHEEL| spin with a wheel, CALIPER| steer but do not spin; material names prefixed paint:/glass:/head:/tail:.
// W is the body width without mirrors (used for collisions); eye is the driver's head in car space.
const MODEL_SPECS={
 model3:{W:1.85,eye:[-.2,1.13,-.37],interior:true},
 cybertruck:{W:2.03,eye:[-.1,1.45,-.42],interior:true},
 concept:{W:1.98,eye:[-.3,.98,-.38],interior:true},
 ferrari:{W:1.94,eye:[-.22,.99,-.35],interior:true},
 porsche:{W:1.85,eye:[-.42,1.04,-.36],interior:false},
 urus:{W:2.02,eye:[-.15,1.34,-.41],interior:false}};
const gltfLoader=HAS3D?new GLTFLoader():null;
if(gltfLoader){const dl=new DRACOLoader();dl.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');gltfLoader.setDRACOLoader(dl)}
const modelPromises=new Map(),modelTemplates=new Map();
const modelKey=(id,lod)=>id+(lod?'-lod':'');
function loadCarModel(id,lod=false){const key=modelKey(id,lod);if(!modelPromises.has(key))modelPromises.set(key,gltfLoader.loadAsync('models/'+key+'.glb').then(g=>{const t=prepareCarModel(id,g.scene,lod);modelTemplates.set(key,t);return t}).catch(e=>{modelPromises.delete(key);throw e}));return modelPromises.get(key)}
function modelTemplate(id,lod){return modelTemplates.get(modelKey(id,lod))||modelTemplates.get(modelKey(id,!lod))}
function modelRole(o){for(let p=o;p;p=p.parent){if(p.name&&p.name.startsWith('WHEEL|'))return'wheel';if(p.name&&p.name.startsWith('CALIPER|'))return'caliper'}return'body'}
function prepareCarModel(id,root,lod){root.updateMatrixWorld(true);const body=[],bins=new Map(),bounds=new T.Box3(),tb=new T.Box3(),spec=MODEL_SPECS[id];
 root.traverse(o=>{if(!o.isMesh)return;let g=o.geometry;if(!o.matrixWorld.equals(tmpM.identity())){g=g.clone();g.applyMatrix4(o.matrixWorld)}if(!g.attributes.normal)g.computeVertexNormals();g.userData.keep=true;g.userData.shared=true;
  const mat=Array.isArray(o.material)?o.material[0]:o.material;mat.userData.keep=true;bounds.union(tb.setFromBufferAttribute(g.attributes.position));
  const role=modelRole(o);if(role!=='body'){splitWheel(g,mat,role,bins);return}
  const n=mat.name||'',kind=n.startsWith('paint:')?'paint':n.startsWith('glass:')?'glass':n.startsWith('head:')?'head':n.startsWith('tail:')?'tail':'other';
  if(kind==='glass'){mat.transparent=true;mat.depthWrite=false;mat.opacity=Math.min(mat.opacity??1,.55);mat.envMapIntensity=1.6}
  body.push({geometry:g,material:mat,kind,secondary:kind==='paint'&&/\b2\b/.test(n.slice(6))})});
 const L=bounds.max.x-bounds.min.x,H=bounds.max.y,W=spec.W;
 const wheels=[];for(const[key,b]of bins){if(b.box.isEmpty())continue;const c=b.box.getCenter(new T.Vector3());wheels.push({key,front:key[0]==='f',side:key[1]==='l'?-1:1,center:c,R:(b.box.max.y-b.box.min.y)/2,wid:b.box.max.z-b.box.min.z,parts:b.parts})}
 const avg=(list,f)=>list.length?list.reduce((a,w)=>a+f(w),0)/list.length:0,fr=wheels.filter(w=>w.front),rr=wheels.filter(w=>!w.front);
 const R=avg(wheels,w=>w.R)||.34,wb=(avg(fr,w=>w.center.x)-avg(rr,w=>w.center.x))||L*.6;
 // light glow anchors: centre of each side of the head/tail lamp geometry, with a box-based fallback
 const lampPts=(kind,fx)=>{const out=[];for(const sd of[-1,1]){const s=new T.Vector3();let n=0;for(const b of body){if(b.kind!==kind)continue;const p=b.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const z=p.getZ(i);if(z*sd<=.15)continue;s.x+=p.getX(i);s.y+=p.getY(i);s.z+=z;n++}}out.push(n?[s.x/n+(fx>0?.06:-.06),s.y/n,s.z/n]:[fx*(L/2-.12),H*(fx>0?.48:.6),sd*W*.36])}return out};
 let rx=0,rn=0;for(const b of body){if(b.kind!=='paint'&&b.kind!=='glass')continue;const p=b.geometry.attributes.position;for(let i=0;i<p.count;i+=2)if(p.getY(i)>H*.96){rx+=p.getX(i);rn++}}
 const tpl={id,lod,body,wheels,L,W,H,R,wid:avg(wheels,w=>w.wid)||.25,wb,roofX:rn?rx/rn:-.1*L,head:lampPts('head',1),tail:lampPts('tail',-1)};
 if(lod)mergeTrafficModel(tpl);
 if(!SHAPES[id])SHAPES[id]={L,W,wheelR:R,wb,clr:.15,kind:'car',drive:'rwd'};return tpl}
// Traffic cars collapse to a few draw calls: paint, accent paint, glass, everything else with material colours baked
// into vertex colours, and one mesh per wheel.
function colorizeC(geo,color){const g=geo.index?geo.toNonIndexed():geo.clone();if(!g.attributes.normal)g.computeVertexNormals();const n=g.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){c[i*3]=color.r;c[i*3+1]=color.g;c[i*3+2]=color.b}g.setAttribute('color',new T.BufferAttribute(c,3));return g}
function mergeTrafficModel(tpl){const keep=g=>{g.userData.keep=true;g.userData.shared=true;g.computeBoundingSphere();return g};
 const lodMat=keepMat('lodBody',()=>new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.3,envMapIntensity:1.1})),lodGlass=keepMat('lodGlass',()=>new T.MeshStandardMaterial({color:0x0a0e12,roughness:.06,metalness:.5,envMapIntensity:1.6}));
 const lamp={head:new T.Color(1.4,1.35,1.2),tail:new T.Color(.75,.04,.02)},groups={paint:[],paint2:[],glass:[],rest:[]};
 for(const b of tpl.body){if(b.kind==='paint')groups[b.secondary?'paint2':'paint'].push(b.geometry.index?b.geometry.toNonIndexed():b.geometry);else if(b.kind==='glass')groups.glass.push(b.geometry.index?b.geometry.toNonIndexed():b.geometry);else groups.rest.push(colorizeC(b.geometry,lamp[b.kind]||b.material.color||WHITE))}
 const body=[];if(groups.paint.length)body.push({geometry:keep(mergeGeos(groups.paint)),kind:'paint'});if(groups.paint2.length)body.push({geometry:keep(mergeGeos(groups.paint2)),kind:'paint',secondary:true});
 if(groups.glass.length)body.push({geometry:keep(mergeGeos(groups.glass)),kind:'glass',material:lodGlass});if(groups.rest.length)body.push({geometry:keep(mergeGeos(groups.rest)),kind:'other',material:lodMat});
 tpl.body=body;
 for(const w of tpl.wheels)w.parts=[{geometry:keep(mergeGeos(w.parts.map(p=>colorizeC(p.geometry,p.material.color||WHITE)))),material:lodMat,spin:true}]}
// Wheel meshes may hold all four wheels (or one axle); triangles are binned by corner so each wheel can spin and steer.
function splitWheel(g,mat,role,bins){const p=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:p.count,lists={};
 for(let t=0;t<n;t+=3){const a=idx?idx[t]:t,b=idx?idx[t+1]:t+1,c=idx?idx[t+2]:t+2;const cx=p.getX(a)+p.getX(b)+p.getX(c),cz=p.getZ(a)+p.getZ(b)+p.getZ(c);const key=(cx>0?'f':'r')+(cz<0?'l':'r');(lists[key]||(lists[key]=[])).push(a,b,c)}
 for(const key in lists){let bin=bins.get(key);if(!bin){bin={box:new T.Box3(),parts:[]};bins.set(key,bin)}const sub=new T.BufferGeometry();for(const name in g.attributes)sub.setAttribute(name,g.attributes[name]);const list=lists[key];sub.setIndex(list);sub.userData.keep=true;sub.userData.shared=true;sub.computeBoundingSphere();
  if(role==='wheel')for(const i of list)bin.box.expandByPoint(tmpV.set(p.getX(i),p.getY(i),p.getZ(i)));bin.parts.push({geometry:sub,material:mat,spin:role==='wheel'})}}
function makePaint(color,spec,hi){if(spec.metal)return new T.MeshStandardMaterial({color,metalness:.75,roughness:.38,envMapIntensity:1.3});
 return hi?new T.MeshPhysicalMaterial({color,metalness:.55,roughness:.3,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.2}):new T.MeshStandardMaterial({color,metalness:.55,roughness:.3,envMapIntensity:1.25})}
function createModelVehicle(spec,opts){initShared();const hi=!!(opts.player||opts.preview),tpl=modelTemplate(spec.model,!hi);if(!tpl)throw new Error('Car model not loaded: '+spec.model);
 const group=new T.Group();group.rotation.order='YZX';const body=new T.Group();group.add(body);
 const paint=makePaint(opts.color||spec.color,spec,hi),paint2=paint.clone();paint2.color.multiplyScalar(.28);const mats={paint,paint2},parts={deform:[],glassList:[]};
 for(const b of tpl.body){let mat=b.material;if(b.kind==='paint')mat=b.secondary?paint2:paint;else if(b.kind==='tail'&&opts.player){mat=b.material.clone();mat.emissive=new T.Color('#ff1608');mat.emissiveIntensity=.5;(mats.brake||(mats.brake=[])).push(mat)}
  const m=new T.Mesh(b.geometry,mat);m.castShadow=b.kind!=='glass';m.receiveShadow=false;body.add(m);
  if(b.kind==='paint'||b.kind==='glass'){m.userData.deform=true;parts.deform.push(m)}if(b.kind==='glass'){m.userData.origMat=mat;parts.glassList.push(m)}}
 const wheels=[];for(const w of tpl.wheels){const pivot=new T.Group();pivot.position.copy(w.center);const spin=new T.Group();pivot.add(spin);for(const part of w.parts){const m=new T.Mesh(part.geometry,part.material);m.position.copy(w.center).negate();m.castShadow=true;(part.spin?spin:pivot).add(m)}group.add(pivot);wheels.push({pivot,spin,front:w.front,side:w.side,x:w.center.x,z:w.center.z})}
 const L=tpl.L,W=tpl.W,H=tpl.H,ms=MODEL_SPECS[spec.model],police=[];
 if(opts.police){const rxp=tpl.roofX;body.add(new T.Mesh(box(.34,.08,W*.66,rxp,H+.03,0),shared.trim));mats.pRed=new T.MeshBasicMaterial({color:0x401010});mats.pBlue=new T.MeshBasicMaterial({color:0x101a40});
  const red=new T.Mesh(box(.3,.1,W*.3,rxp,H+.11,-W*.18),mats.pRed),blue=new T.Mesh(box(.3,.1,W*.3,rxp,H+.11,W*.18),mats.pBlue);body.add(red,blue);police.push([rxp,H+.15,-W*.18,0],[rxp,H+.15,W*.18,1]);
  for(const sd of[-1,1]){const d=new T.Mesh(new T.PlaneGeometry(1.7,.42),shared.decal);d.position.set(-.05*L,H*.47,sd*(W/2+.07));d.rotation.y=sd>0?0:Math.PI;body.add(d)}}
 const blob=new T.Mesh(keepGeo('blobPlane',()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)),shared.blob);blob.scale.set(L*1.2,1,W*1.4);blob.position.y=.03;blob.renderOrder=1;group.add(blob);
 const data={L,W,H,R:tpl.R,wid:tpl.wid,head:tpl.head,tail:tpl.tail,police,eye:ms.eye,hood:[L*.24,H*.84+.08,0],bumper:[L/2+.12,.5,0],dash:null,model:true};
 if(opts.player&&!ms.interior)body.add(buildModelInterior(data));
 return{group,body,parts,wheels,mats,data,blob}}
// Cars exported without a cabin get a simple dashboard and a working steering wheel for the cockpit camera.
function buildModelInterior(data){const g=new T.Group();g.name='interior';g.visible=false;const[ex,ey,ez]=data.eye,dashMat=new T.MeshStandardMaterial({color:0x17191c,roughness:.8});
 g.add(new T.Mesh(box(.55,.16,data.W*.86,ex+.82,ey-.3,0),dashMat));g.add(new T.Mesh(box(.12,.07,.36,ex+.56,ey-.2,ez,0,0,.35),dashMat));
 const tilt=new T.Group();tilt.position.set(ex+.45,ey-.24,ez);tilt.rotation.z=.4;const wheel=new T.Group();tilt.add(wheel);const wm=new T.MeshStandardMaterial({color:0x111111,roughness:.5});const rim=new T.Mesh(new T.TorusGeometry(.18,.02,10,36),wm);rim.rotation.y=Math.PI/2;wheel.add(rim);
 for(let i=0;i<3;i++){const arm=new T.Group();arm.rotation.x=i*Math.PI*2/3+Math.PI;const sp=new T.Mesh(new T.BoxGeometry(.018,.17,.03),wm);sp.position.y=.085;arm.add(sp);wheel.add(arm)}wheel.add(new T.Mesh(new T.CylinderGeometry(.055,.055,.045,16).rotateZ(Math.PI/2),wm));g.add(tilt);g.userData.wheel=wheel;return g}

// ---------------------------------------------------------------- particles, glows, skids, debris
const PVS='attribute float psize;attribute float palpha;attribute vec3 pcolor;varying float vA;varying vec3 vC;uniform float uScale;void main(){vA=palpha;vC=pcolor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(700.0,psize*uScale/max(0.05,-mv.z));gl_Position=projectionMatrix*mv;}';
const PFS='uniform sampler2D map;varying float vA;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);float a=t.a*vA;if(a<0.003)discard;gl_FragColor=vec4(vC*t.rgb,a);}';
class PointPool{constructor(n,tex,additive,sim=true){this.n=n;this.pos=new Float32Array(n*3);this.col=new Float32Array(n*3);this.size=new Float32Array(n);this.alpha=new Float32Array(n);this.sim=sim;if(sim){this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.grow=new Float32Array(n);this.a0=new Float32Array(n);this.grav=new Float32Array(n);this.drag=new Float32Array(n);this.s0=new Float32Array(n)}this.next=0;this.count=0;
 const g=new T.BufferGeometry();this.attrs={position:new T.BufferAttribute(this.pos,3),pcolor:new T.BufferAttribute(this.col,3),psize:new T.BufferAttribute(this.size,1),palpha:new T.BufferAttribute(this.alpha,1)};for(const k in this.attrs){this.attrs[k].setUsage(T.DynamicDrawUsage);g.setAttribute(k,this.attrs[k])}
 this.mat=new T.ShaderMaterial({uniforms:{map:{value:tex},uScale:{value:500}},vertexShader:PVS,fragmentShader:PFS,transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending});this.points=new T.Points(g,this.mat);this.points.frustumCulled=false;this.points.renderOrder=additive?4:3;this.geo=g}
 spawn(x,y,z,vx,vy,vz,life,size,grow,r,g,b,a,grav=0,drag=0){const i=this.next;this.next=(i+1)%this.n;const i3=i*3;this.pos[i3]=x;this.pos[i3+1]=y;this.pos[i3+2]=z;this.vel[i3]=vx;this.vel[i3+1]=vy;this.vel[i3+2]=vz;this.col[i3]=r;this.col[i3+1]=g;this.col[i3+2]=b;this.life[i]=life;this.max[i]=life;this.s0[i]=size;this.size[i]=size;this.grow[i]=grow;this.a0[i]=a;this.alpha[i]=a;this.grav[i]=grav;this.drag[i]=drag}
 update(dt){for(let i=0;i<this.n;i++){if(this.life[i]<=0){this.alpha[i]=0;continue}this.life[i]-=dt;const t=1-Math.max(0,this.life[i])/this.max[i],i3=i*3,k=Math.exp(-this.drag[i]*dt);this.vel[i3]*=k;this.vel[i3+1]=this.vel[i3+1]*k-this.grav[i]*dt;this.vel[i3+2]*=k;this.pos[i3]+=this.vel[i3]*dt;this.pos[i3+1]+=this.vel[i3+1]*dt;this.pos[i3+2]+=this.vel[i3+2]*dt;this.size[i]=this.s0[i]+this.grow[i]*t;this.alpha[i]=this.a0[i]*(1-t)*Math.min(1,t*12+.2)}for(const k in this.attrs)this.attrs[k].needsUpdate=true}
 begin(){this.count=0}
 add(x,y,z,size,r,g,b,a){if(this.count>=this.n)return;const i=this.count++,i3=i*3;this.pos[i3]=x;this.pos[i3+1]=y;this.pos[i3+2]=z;this.size[i]=size;this.col[i3]=r;this.col[i3+1]=g;this.col[i3+2]=b;this.alpha[i]=a}
 end(){this.geo.setDrawRange(0,this.count);for(const k in this.attrs)this.attrs[k].needsUpdate=true}}
class Skids{constructor(n=1400){this.n=n;this.i=0;this.pos=new Float32Array(n*18);const g=new T.BufferGeometry();this.attr=new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage);g.setAttribute('position',this.attr);this.mesh=new T.Mesh(g,new T.MeshBasicMaterial({color:0x0b0b0b,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));this.mesh.frustumCulled=false;this.mesh.renderOrder=1}
 add(x0,y0,z0,x1,y1,z1,w){const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,px=-dz/l*w/2,pz=dx/l*w/2,o=this.i*18,p=this.pos;const v=[x0-px,y0,z0-pz,x0+px,y0,z0+pz,x1+px,y1,z1+pz,x0-px,y0,z0-pz,x1+px,y1,z1+pz,x1-px,y1,z1-pz];for(let k=0;k<18;k++)p[o+k]=v[k];this.i=(this.i+1)%this.n;this.attr.needsUpdate=true}}
class Debris{constructor(n=180){this.n=n;this.mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.5,metalness:.4}),n);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.castShadow=true;this.items=[];this.next=0;const c=new T.Color(0x333333);for(let i=0;i<n;i++){this.mesh.setColorAt(i,c);this.items.push({life:0,p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),w:new T.Vector3(),s:new T.Vector3(1,1,1)})}this.mesh.frustumCulled=false;this.hide()}
 hide(){for(let i=0;i<this.n;i++){tmpM.makeScale(0,0,0);this.mesh.setMatrixAt(i,tmpM)}this.mesh.instanceMatrix.needsUpdate=true}
 spawn(p,v,size,color,life=7){const i=this.next;this.next=(i+1)%this.n;const it=this.items[i];it.life=life;it.p.copy(p);it.v.copy(v);it.q.setFromEuler(tmpE.set(Math.random()*6,Math.random()*6,Math.random()*6));it.w.set(rand(-12,12),rand(-12,12),rand(-12,12));it.s.set(size*rand(.5,1.6),size*rand(.15,.5),size*rand(.5,1.4));this.mesh.setColorAt(i,tmpColor.set(color));this.mesh.instanceColor.needsUpdate=true}
 update(dt){for(let i=0;i<this.n;i++){const it=this.items[i];if(it.life<=0)continue;it.life-=dt;it.v.y-=GRAV*dt;it.p.addScaledVector(it.v,dt);const gy=run?probeGround(it.p.x,it.p.z):0;if(it.p.y<gy+it.s.y/2){it.p.y=gy+it.s.y/2;it.v.y*=-.3;it.v.x*=.6;it.v.z*=.6;it.w.multiplyScalar(.6)}tmpQ.setFromEuler(tmpE.set(it.w.x*dt,it.w.y*dt,it.w.z*dt));it.q.premultiply(tmpQ);tmpM.compose(it.p,it.q,it.life>0?it.s:tmpS.set(0,0,0));this.mesh.setMatrixAt(i,tmpM)}this.mesh.instanceMatrix.needsUpdate=true}}
let tmpColor=HAS3D?new T.Color():null;const WHITE=HAS3D?new T.Color(1,1,1):null;const probeRC={s:0,d:0,th:0};
function probeGround(x,z,guess){if(!run||!run.player)return 0;toRoad(x,z,guess===undefined?run.player.s:guess,probeRC);return groundY(probeRC.s,probeRC.d)}

// ---------------------------------------------------------------- world: sky, terrain, road segments, props
// Sky dome: zenith-to-horizon gradient with Mie haze around the sun and a drifting fbm cloud layer projected onto a
// virtual cloud plane (so clouds shrink toward the horizon like real ones). Night maps get a procedural star field.
const SKY_FS=`uniform vec3 top,hor,bot,sunCol,sunDir;uniform float night,cover,time;varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=0.5;}return v;}
float fbm3(vec2 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=0.5;}return v;}
void main(){vec3 d=normalize(vDir);float h=d.y;vec3 sd=normalize(sunDir);
 vec3 c=h>0.0?mix(hor,top,pow(clamp(h,0.0,1.0),0.5)):mix(hor,bot,clamp(-h*5.0,0.0,1.0));
 float s=max(dot(d,sd),0.0);
 c+=sunCol*(pow(s,1400.0)*(night>0.5?1.5:22.0)+pow(s,48.0)*0.35+pow(s,6.0)*0.12*(1.0-night));
 c=mix(c,hor*1.05,pow(1.0-abs(h),10.0)*0.6*(1.0-night));
 if(h>0.0){vec2 uv=d.xz/(h+0.08)*0.55+vec2(time*0.004,time*0.0015);
  float n=fbm(uv*1.6),n2=fbm3(uv*4.0+3.0);float dens=smoothstep(1.0-cover,1.0-cover+0.35,n*0.75+n2*0.35);
  dens*=smoothstep(0.0,0.18,h);
  float lit=0.55+0.45*clamp(dot(d,sd)*0.5+0.5,0.0,1.0);
  vec3 cloudCol=mix(hor*0.85+vec3(0.08),vec3(1.0),0.6)*lit+sunCol*pow(s,8.0)*0.6;
  if(night>0.5)cloudCol=vec3(0.07,0.07,0.12)+hor*0.25;
  c=mix(c,cloudCol,dens*0.92);
  if(night>0.5){vec2 g=floor(d.xz/(h+0.3)*260.0);float st=step(0.9965,hash(g))*(0.5+0.5*sin(time*2.0+hash(g+1.0)*40.0));c+=vec3(st)*(1.0-dens)*smoothstep(0.05,0.3,h);}}
 gl_FragColor=vec4(c,1.0);}`;
function buildSky(env){
 const sunDir=new T.Vector3(Math.sin(env.sunAz*Math.PI/180)*Math.cos(env.sunElev*Math.PI/180),Math.sin(env.sunElev*Math.PI/180),-Math.cos(env.sunAz*Math.PI/180)*Math.cos(env.sunElev*Math.PI/180)).normalize();
 const cover={country:.42,desert:.18,alpine:.5,coast:.38,city:.3}[env.props]??.4;
 const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new T.Color(env.skyTop)},hor:{value:new T.Color(env.skyHorizon)},bot:{value:new T.Color(env.mountain).lerp(new T.Color(env.skyHorizon),.5)},sunDir:{value:sunDir},sunCol:{value:new T.Color(env.sunColor)},night:{value:env.night?1:0},cover:{value:cover},time:{value:0}},
  vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}',
  fragmentShader:SKY_FS});
 const sky=new T.Mesh(new T.SphereGeometry(3000,48,24),mat);sky.renderOrder=-10;sky.frustumCulled=false;return{sky,sunDir}}
function buildMountains(env){const g=new T.Group();const r=mulberry(9);
 for(let layer=0;layer<2;layer++){const n=160,rad=2300-layer*500,pos=[],col=[],idx=[];const base=new T.Color(env.mountain),hz=new T.Color(env.skyHorizon),snow=new T.Color('#f4f8fb');const c=base.clone().lerp(hz,layer?0.25:0.55);
  const heights=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;let h=env.props==='city'?(r()<.5?60+r()*220:30+r()*80):(90+Math.sin(a*3+layer)*60+Math.sin(a*7.3+layer*2)*45+Math.sin(a*17)*20+r()*25)*(env.props==='alpine'?2.1:env.props==='coast'?.7:1);if(env.props==='city'&&i%2)h=heights[i-1];heights.push(h)}
  for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*rad,z=Math.sin(a)*rad;pos.push(x,-60,z,x,heights[i],z);col.push(c.r,c.g,c.b);const tc=env.snowCaps&&heights[i]>170?snow:c;col.push(tc.r,tc.g,tc.b)}
  for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setIndex(idx);
  const city=env.props==='city';const m=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:!city,fog:false,side:T.DoubleSide,map:city?facadeTex(true):null,color:city?'#c9b8ff':'#ffffff'}));if(city){const uv=[];for(let i=0;i<=n;i++)uv.push(i*1.5,0,i*1.5,heights[i]/18);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2))}m.renderOrder=-9;g.add(m)}
 // clouds and stars are drawn by the sky shader
 return g}
const PROP_SETS={
 country:[{t:'oak',n:9,d:[16,95],col:.6},{t:'pine',n:3,d:[22,110],col:.5},{t:'bush',n:8,d:[13,60]},{t:'tuft',n:34,d:[10.8,40]},{t:'rock',n:3,d:[15,90],col:.8},{t:'bale',n:4,d:[30,110],col:.9,side:1},{t:'post',n:2,d:[11,11],every:true},{t:'pole',n:1,d:[13.5,13.5],every:true,side:1,col:.25}],
 desert:[{t:'cactus',n:7,d:[14,95],col:.4},{t:'rock',n:6,d:[14,120],col:.9},{t:'mesa',n:1,d:[120,200]},{t:'scrub',n:10,d:[12,90]},{t:'post',n:2,d:[11,11],every:true},{t:'pole',n:1,d:[13.5,13.5],every:true,side:1,col:.25}],
 alpine:[{t:'snowpine',n:12,d:[14,110],col:.5},{t:'rock',n:3,d:[15,90],col:.8},{t:'snowpole',n:2,d:[11,11],every:true}],
 coast:[{t:'palm',n:6,d:[13,70],col:.35},{t:'bush',n:6,d:[13,50],side:1},{t:'tuft',n:22,d:[10.8,36],side:1},{t:'rock',n:4,d:[14,40],side:-1,col:.8},{t:'post',n:2,d:[11,11],every:true}],
 city:[{t:'towerA',n:3,d:[16,40],col:11},{t:'towerB',n:3,d:[24,60],col:11},{t:'towerC',n:2,d:[40,90]},{t:'lamp',n:2,d:[10.4,10.4],every:true},{t:'sign',n:3,d:[12,16]}]};
// ---- organic vegetation: noise-displaced, smooth-shaded shapes with procedural leaf / needle / bark / rock textures
function sphereUV(g,rep=3){const p=g.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),l=Math.hypot(x,y,z)||1;uv[i*2]=(Math.atan2(z,x)/(Math.PI*2)+.5)*rep;uv[i*2+1]=Math.acos(clamp(y/l,-1,1))/Math.PI*rep*.6}g.setAttribute('uv',new T.BufferAttribute(uv,2));return g}
function blob(r,detail,x,y,z,sx=1,sy=1,sz=1,amt=.22,seed=1){const g=weld(new T.IcosahedronGeometry(r,detail)),p=g.attributes.position,R=mulberry(seed),o1=R()*10,o2=R()*10;
 for(let i=0;i<p.count;i++){const vx=p.getX(i),vy=p.getY(i),vz=p.getZ(i),n=Math.sin(vx*2.3/r+o1)*Math.sin(vy*2.9/r+o2)*Math.sin(vz*2.1/r+o1*.7)+.5*Math.sin((vx*5.1+vz*4.3)/r+o2),k=1+amt*n;p.setXYZ(i,vx*k*sx,vy*k*sy,vz*k*sz)}
 g.computeVertexNormals();sphereUV(g);g.translate(x,y,z);return g}
function pineLayer(r,h,y,seed){const g=new T.ConeGeometry(r,h,14,3),p=g.attributes.position,R=mulberry(seed);for(let i=0;i<p.count;i++){const vy=p.getY(i);if(vy<-h/2+.01){const k=.78+R()*.4;p.setX(i,p.getX(i)*k);p.setZ(i,p.getZ(i)*k);p.setY(i,vy-R()*.35)}else{const t=(vy+h/2)/h,w=1+Math.sin(i*1.7)*.06*(1-t);p.setX(i,p.getX(i)*w);p.setZ(i,p.getZ(i)*w)}}g.computeVertexNormals();g.translate(0,y,0);return g}
function foliageTex(kind){return cachedTex('foliage-'+kind,()=>canvasTex(256,256,(g,w,h)=>{const r=mulberry(kind.length*7+1);g.fillStyle=kind==='bark'?'#6b5844':kind==='rock'?'#9a968e':'#9a9a9a';g.fillRect(0,0,w,h);
 if(kind==='leaf'){for(let i=0;i<1700;i++){const v=110+r()*145|0;g.fillStyle=`rgb(${v},${v},${v})`;g.save();g.translate(r()*w,r()*h);g.rotate(r()*6.3);g.beginPath();g.ellipse(0,0,2+r()*3,1+r()*1.6,0,0,7);g.fill();g.restore()}}
 else if(kind==='needle'){for(let i=0;i<2600;i++){const v=95+r()*150|0;g.strokeStyle=`rgba(${v},${v},${v},.9)`;g.lineWidth=1;const x=r()*w,y=r()*h,a=r()*.8-.4+Math.PI/2;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*5,y+Math.sin(a)*5);g.stroke()}}
 else if(kind==='bark'){for(let i=0;i<160;i++){const v=40+r()*70|0;g.strokeStyle=`rgba(${v},${v*.85|0},${v*.7|0},.8)`;g.lineWidth=1+r()*3;const x=r()*w;g.beginPath();g.moveTo(x,0);for(let y=0;y<=h;y+=16)g.lineTo(x+Math.sin(y*.05+i)*4,y);g.stroke()}}
 else if(kind==='rock'){for(let i=0;i<900;i++){const v=70+r()*120|0;g.fillStyle=`rgba(${v},${v},${v},.5)`;g.beginPath();g.arc(r()*w,r()*h,1+r()*7,0,7);g.fill()}for(let i=0;i<14;i++){g.strokeStyle='rgba(40,40,40,.35)';g.lineWidth=1+r()*2;g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);for(let k=0;k<5;k++){x+=(r()-.5)*60;y+=(r()-.5)*60;g.lineTo(x,y)}g.stroke()}}
 else if(kind==='blades'){g.clearRect(0,0,w,h);for(let i=0;i<70;i++){const x=8+r()*(w-16),bh=h*(.45+r()*.55),lean=(r()-.5)*40,v=120+r()*135|0;g.strokeStyle=`rgb(${v},${v},${v})`;g.lineWidth=2+r()*3;g.lineCap='round';g.beginPath();g.moveTo(x,h);g.quadraticCurveTo(x+lean*.3,h-bh*.6,x+lean,h-bh);g.stroke()}}
 grain(g,w,h,kind==='blades'?0:22,kind.length)}))}
function tuftGeo(){return keepGeo('tuft',()=>{const parts=[];for(let i=0;i<3;i++){const pl=new T.PlaneGeometry(1.1,.62);pl.translate(0,.31,0);pl.rotateY(i*Math.PI/3);parts.push(pl)}const g=mergeGeos(parts),n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g})}
function propParts(t,env){const c=(hex,o={})=>{const m=new T.MeshStandardMaterial(Object.assign({color:hex,roughness:.9},o));return m};
 const leaf=()=>c('#ffffff',{map:foliageTex('leaf'),roughness:.85}),needle=()=>c('#ffffff',{map:foliageTex('needle'),roughness:.88}),bark=hex=>c(hex,{map:foliageTex('bark'),roughness:.95});
 switch(t){
 case'oak':return[[mergeGeos([cyl(.2,.34,3.4,8,0,1.7,0),cyl(.07,.11,1.6,6,.55,3.3,.1,0,0,-.7),cyl(.06,.1,1.5,6,-.5,3.2,-.2,.3,0,.75)]),bark('#8a7258')],[mergeGeos([blob(2.0,1,0,4.4,0,1,.85,1,.2,1),blob(1.55,1,1.15,3.8,.5,1,.8,1,.24,2),blob(1.45,1,-1.05,3.9,-.6,1,.85,1,.24,3),blob(1.3,1,.25,5.5,-.25,1,.8,1,.22,4),blob(1.1,1,-.3,3.3,1.05,1,.8,1,.25,5),blob(1.0,1,.9,4.9,-.7,1,.8,1,.25,11)]),leaf(),true]];
 case'pine':return[[cyl(.13,.26,2.6,8,0,1.3,0),bark('#6d5640')],[mergeGeos([pineLayer(2.0,2.6,2.6,1),pineLayer(1.6,2.4,3.9,2),pineLayer(1.2,2.1,5.1,3),pineLayer(.75,1.8,6.2,4)]),needle(),true]];
 case'snowpine':return[[cyl(.13,.26,2.6,8,0,1.3,0),bark('#6d5640')],[mergeGeos([pineLayer(2.05,2.7,2.6,5),pineLayer(1.65,2.5,3.95,6),pineLayer(1.25,2.2,5.2,7),pineLayer(.8,1.9,6.35,8)]),needle(),true],[mergeGeos([pineLayer(1.3,1.0,3.75,9),pineLayer(1.0,.95,5.05,10),pineLayer(.62,.85,6.4,11)]),c('#f4f8fb',{roughness:.6})]];
 case'bush':return[[mergeGeos([blob(.85,2,0,.45,0,1.25,.75,1,.25,6),blob(.6,1,.55,.35,.3,1,.8,1,.25,7)]),leaf(),true]];
 case'scrub':return[[mergeGeos([blob(.55,1,0,.28,0,1.3,.6,1.1,.3,8),blob(.4,1,.4,.22,-.2,1.2,.6,1,.3,9)]),c('#9a9358',{map:foliageTex('leaf'),roughness:.95})]];
 case'rock':return[[blob(1,2,0,.3,0,1.3,.72,1,.28,10),c('#ffffff',{map:foliageTex('rock'),roughness:.92}),true]];
 case'tuft':return[[tuftGeo(),c('#ffffff',{map:foliageTex('blades'),alphaTest:.45,side:T.DoubleSide,roughness:.9}),true]];
 case'mesa':return[[mergeGeos([cyl(18,24,26,9,0,13,0),cyl(14,18,10,9,4,30,2)]),c(env.mountain,{flatShading:true})]];
 case'bale':return[[cyl(.75,.75,1.3,14,0,.75,0,0,0,Math.PI/2),c('#d8b45a')]];
 case'post':return[[box(.12,1.05,.12,0,.52,0),c('#eeeeea',{roughness:.5})],[box(.13,.12,.13,0,.92,0),c('#ff8a1f',{emissive:'#ff7a10',emissiveIntensity:.35})]];
 case'snowpole':return[[mergeGeos([cyl(.04,.04,2.4,6,0,1.2,0)]),c('#ff7b22')],[mergeGeos([cyl(.042,.042,.3,6,0,.6,0),cyl(.042,.042,.3,6,0,1.4,0)]),c('#111111')]];
 case'pole':return[[mergeGeos([cyl(.13,.16,9,7,0,4.5,0),box(.12,.12,2.2,0,8.3,0)]),c('#5a4433')]];
 case'cactus':return[[mergeGeos([cyl(.28,.33,4.4,9,0,2.2,0),xf(new T.SphereGeometry(.28,9,6),0,4.4,0),cyl(.2,.2,1,8,.55,2,0,0,0,Math.PI/2),cyl(.2,.2,1.5,8,1.05,2.65,0),xf(new T.SphereGeometry(.2,8,6),1.05,3.4,0),cyl(.18,.18,.8,8,-.45,2.6,0,0,0,Math.PI/2),cyl(.18,.18,1.1,8,-.85,3.05,0),xf(new T.SphereGeometry(.18,8,6),-.85,3.6,0)]),c('#ffffff'),true]];
 case'palm':{const trunk=[];let x=0,y=0;for(let i=0;i<7;i++){trunk.push(cyl(.2-i*.012,.24-i*.012,1.25,7,x,y+.62,0,0,0,-.05*i));x+=.06*i;y+=1.2}const fr=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;fr.push(xf(new T.BoxGeometry(3.2,.04,.55),x+Math.cos(a)*1.4,y-.35,Math.sin(a)*1.4,0,-a,-.42))}return[[mergeGeos(trunk),c('#7a6247')],[mergeGeos(fr),c('#ffffff',{side:T.DoubleSide}),true]]}
 case'towerA':case'towerB':case'towerC':{const hgt={towerA:32,towerB:58,towerC:96}[t],wd={towerA:16,towerB:20,towerC:14}[t];const g=new T.BoxGeometry(wd,hgt,wd);g.translate(0,hgt/2,0);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){uv.setXY(i,uv.getX(i)*wd/28,uv.getY(i)*hgt/52)}const roof=box(wd*.5,3,wd*.4,0,hgt+1.5,0);return[[g,new T.MeshStandardMaterial({map:facadeTex(false),emissiveMap:facadeTex(true),emissive:'#ffffff',emissiveIntensity:1.4,roughness:.55,metalness:.25})],[roof,c('#2a2d36')]]}
 case'lamp':return[[mergeGeos([cyl(.1,.15,9,8,0,4.5,0),box(2.8,.12,.12,-1.35,8.95,0)]),c('#5f6670',{metalness:.6,roughness:.4})],[box(.8,.12,.36,-2.5,8.88,0),new T.MeshBasicMaterial({color:'#ffe2a8'})]];
 case'sign':return[[box(.3,3.4,.3,0,7,0),new T.MeshBasicMaterial({color:'#ffffff'}),true]];
 }return[]}
const PROP_COLORS={oak:['#4a7a34','#5a8a3a','#6b8f34','#40702f','#78963f'],pine:['#35603d','#3d6a44','#2f5639'],snowpine:['#335a46','#3a634c','#2c4e3e'],bush:['#557f3a','#6a9443','#4a763a'],tuft:['#7f9a48','#8ea653','#6d8a3e','#9aa95c'],rock:['#a5a39c','#928f88','#b3aea4'],cactus:['#4e7a4a','#5b8650','#466f45'],palm:['#3f8a4a','#4d9a50','#5aa14f'],sign:['#ff2fb3','#2ff3ff','#ffe94a','#9a5cff','#ff5a3c']};
class World{constructor(env){this.env=env;this.group=new T.Group();this.N=SEG_BEHIND+SEG_AHEAD;this.segs=[];
 // asphalt micro-detail (normal + roughness) tiles every ~3 m on top of the painted lane texture
 const aN=realTex('asphalt_nor'),aR=realTex('asphalt_rough');aN.repeat.set(7,8);aR.repeat.set(7,8);
 this.roadMat=new T.MeshStandardMaterial({map:roadTexture(env),normalMap:aN,normalScale:new T.Vector2(.7,.7),roughnessMap:aR,roughness:env.wet?.42:1,metalness:env.wet?.12:0,envMapIntensity:env.wet?1.5:.55});
 const kind=env.props==='alpine'?'snow':env.props==='desert'?'sand':env.props==='city'?'city':'grass',photo={grass:'grass',sand:'sand',snow:'snow',city:'concrete'}[kind];
 this.terrainMat=new T.MeshStandardMaterial({map:realTex(photo+'_diff',true),normalMap:realTex(photo+'_nor'),normalScale:new T.Vector2(.9,.9),vertexColors:true,roughness:kind==='snow'?.7:.96});
 this.barrierMat=new T.MeshStandardMaterial({color:'#b9b6ae',roughness:.85});
 this.cols=[0,1,2.5,4.5,6.5,10,16,26,42,65,100,150,230];this.rows=SEG_LEN/4+1;
 for(let i=0;i<this.N;i++){const seg={idx:-999,colliders:[]};seg.road=this.makeGrid(3,this.rows,this.roadMat);seg.terrL=this.makeGrid(this.cols.length,this.rows,this.terrainMat,true,true);seg.terrR=this.makeGrid(this.cols.length,this.rows,this.terrainMat,true);if(env.props==='city'){seg.barL=this.makeBarrier();seg.barR=this.makeBarrier()}this.segs.push(seg)}
 this.props=[];const set=PROP_SETS[env.props]||[];const casters=['oak','pine','snowpine','cactus','palm','towerA','towerB','towerC','lamp','pole'];for(const def0 of set){const def=Object.assign({},def0,{n:Math.round(def0.n*SEG_LEN/40)});const parts=propParts(def.t,env);const cap=def.n*this.N;const meshes=parts.map(([geo,mat,tinted])=>{const m=new T.InstancedMesh(geo,mat,cap);m.castShadow=casters.includes(def.t);m.receiveShadow=true;m.frustumCulled=false;if(tinted===true||def.t==='sign'){const cc=PROP_COLORS[def.t]||['#888'];for(let k=0;k<cap;k++)m.setColorAt(k,tmpColor.set(cc[k%cc.length]))}this.group.add(m);return m});this.props.push({def,meshes,cap})}
 if(env.props==='city'){this.pools=new T.InstancedMesh(keepGeo('poolPlane',()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)),new T.MeshBasicMaterial({map:radialTex('pool',[[0,'rgba(255,214,150,.55)'],[.6,'rgba(255,190,120,.18)'],[1,'rgba(255,190,120,0)']]),transparent:true,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}),Math.round(2*SEG_LEN/40)*this.N);this.pools.frustumCulled=false;this.pools.renderOrder=2;this.group.add(this.pools)}
 if(env.sea){this.sea=new T.Mesh(new T.PlaneGeometry(6000,6000).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:'#1f4f6a',roughness:.12,metalness:.35,envMapIntensity:1.5}));this.group.add(this.sea)}
 this.farGround=new T.Mesh(new T.PlaneGeometry(9000,9000).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(env.ground).multiplyScalar(.75)}));this.farGround.position.y=-30;this.group.add(this.farGround)}
 makeGrid(cols,rows,mat,colors,leftward=false){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(cols*rows*3),3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array(cols*rows*2),2));if(colors)g.setAttribute('color',new T.BufferAttribute(new Float32Array(cols*rows*3),3));const idx=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,d=a+cols,e=d+1;if(leftward)idx.push(a,d,b,b,d,e);else idx.push(a,b,d,b,e,d)}g.setIndex(idx);const m=new T.Mesh(g,mat);m.receiveShadow=true;m.frustumCulled=false;m.userData.cols=cols;this.group.add(m);return m}
 makeBarrier(){const prof=[[-.32,0],[-.22,.28],[-.12,.82],[.12,.82],[.22,.28],[.32,0]];const g=new T.BufferGeometry(),n=prof.length*this.rows;g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));const idx=[];for(let r=0;r<this.rows-1;r++)for(let c=0;c<prof.length-1;c++){const a=r*prof.length+c,b=a+1,d=a+prof.length,e=d+1;idx.push(a,b,d,b,e,d)}g.setIndex(idx);const m=new T.Mesh(g,this.barrierMat);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.userData.prof=prof;this.group.add(m);return m}
 update(s){const first=Math.floor(s/SEG_LEN)-SEG_BEHIND;for(let k=0;k<this.N;k++){const idx=first+k,slot=((idx%this.N)+this.N)%this.N,seg=this.segs[slot];if(seg.idx!==idx)this.build(seg,idx,slot)}}
 build(seg,idx,slot){seg.idx=idx;seg.colliders.length=0;const s0=idx*SEG_LEN,env=this.env;
  {const p=seg.road.geometry.attributes.position,uv=seg.road.geometry.attributes.uv;for(let r=0;r<this.rows;r++){const s=Math.max(0,s0+r*4),c=roadAt(s);const ds=[-EDGE,0,EDGE];for(let k=0;k<3;k++){const i=r*3+k;p.setXYZ(i,c.x+c.cos*ds[k],c.y+.005,c.z+c.sin*ds[k]);uv.setXY(i,(ds[k]+EDGE)/(2*EDGE),s/24)}}p.needsUpdate=true;uv.needsUpdate=true;seg.road.geometry.computeVertexNormals();seg.road.geometry.computeBoundingSphere()}
  const g1=new T.Color(env.ground),g2=new T.Color(env.ground2),cc=new T.Color();
  for(const[mesh,side]of[[seg.terrL,-1],[seg.terrR,1]]){const geo=mesh.geometry,p=geo.attributes.position,uv=geo.attributes.uv,col=geo.attributes.color,n=this.cols.length;for(let r=0;r<this.rows;r++){const s=Math.max(0,s0+r*4),c=roadAt(s);const cx=c.x,cz=c.z,co=c.cos,si=c.sin;for(let k=0;k<n;k++){const d=side*(EDGE+this.cols[k]),i=r*n+k,y=groundY(s,d);p.setXYZ(i,cx+co*d,y,cz+si*d);uv.setXY(i,d/14,s/14);const mix=.5+.5*Math.sin(s*.013+d*.05)*Math.sin(s*.007-d*.021);cc.copy(g1).lerp(g2,mix);if(k<=1&&env.props!=='city')cc.lerp(new T.Color(env.props==='alpine'?'#c9d3da':'#8f8466'),.55-k*.2);if(env.sea&&side<0&&this.cols[k]>8)cc.lerp(new T.Color('#e1c793'),clamp((this.cols[k]-8)/12,0,1));
     // the photo texture already carries colour, so the map palette only tints it (brightened to keep the scan's exposure)
     cc.multiplyScalar(1.7).lerp(WHITE,.5);col.setXYZ(i,cc.r,cc.g,cc.b)}}
   p.needsUpdate=true;uv.needsUpdate=true;col.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere()}
  if(seg.barL){for(const[mesh,side]of[[seg.barL,-1],[seg.barR,1]]){const prof=mesh.userData.prof,p=mesh.geometry.attributes.position;for(let r=0;r<this.rows;r++){const s=Math.max(0,s0+r*4),c=roadAt(s);for(let k=0;k<prof.length;k++){const d=side*BARRIER_D+prof[k][0];p.setXYZ(r*prof.length+k,c.x+c.cos*d,c.y+prof[k][1],c.z+c.sin*d)}}p.needsUpdate=true;mesh.geometry.computeVertexNormals()}}
  // props
  const rnd=mulberry(idx*7919+13);seg.lamps=[];
  for(let pi=0;pi<this.props.length;pi++){const{def,meshes}=this.props[pi];const base=slot*def.n;for(let k=0;k<def.n;k++){let place=idx>=0;let s,d,side;
    if(def.every){const pairs=def.side?def.n:def.n/2,j=def.side?k:Math.floor(k/2);side=def.side||(k%2?1:-1);s=s0+(j+.5)*SEG_LEN/pairs;d=def.d[0]}
    else{side=def.side||(rnd()<.5?-1:1);s=s0+rnd()*SEG_LEN;d=def.d[0]+Math.pow(rnd(),1.4)*(def.d[1]-def.d[0])}
    if(env.sea&&side<0&&def.t!=='post'&&def.t!=='rock')place=false;if(env.sea&&side<0&&def.t==='rock'&&d>40)place=false;
    if(side>0&&stationFlat(s,EDGE+30)>0&&d<90&&def.t!=='post')place=false;
    const D=side*(EDGE+(def.every?d-EDGE:d)),c=roadAt(s);const x=c.x+c.cos*D,z=c.z+c.sin*D,y=groundY(s,D);
    const tower=def.t.startsWith('tower');let sc=tower?1:rand(.75,1.3);if(def.t==='rock')sc=rand(.5,2.2);if(def.t==='mesa')sc=rand(.7,1.6);let rotY=rnd()*Math.PI*2;let sx=sc,sy=sc,sz=sc;
    if(def.t==='lamp')rotY=side>0?-c.th:Math.PI-c.th;if(def.t==='pole'){rotY=-c.th;sx=sy=sz=1}if(def.t==='post'||def.t==='snowpole'){rotY=-c.th;sx=sy=sz=1}
    if(tower){rotY=-c.th;sy=rand(.8,1.25);sx=sz=1}if(def.t==='sign'){rotY=-c.th;sx=rand(.6,1.4);sy=rand(1,3);sz=1}
    tmpQ.setFromAxisAngle(UP,rotY);tmpM.compose(tmpV.set(x,def.t==='sign'?y+rand(2,18):y-.05,z),tmpQ,tmpS.set(place?sx:0,place?sy:0,place?sz:0));for(const m of meshes)m.setMatrixAt(base+k,tmpM);
    if(place&&def.col&&Math.abs(d)<48)seg.colliders.push({x,z,r:tower?def.col:def.col*sc,hard:true});
    if(def.t==='lamp'&&this.pools){tmpQ.identity();const pd=side*(10.4-2.6),pc=roadAt(s);if(place)seg.lamps.push([pc.x+pc.cos*pd,pc.y+8.85,pc.z+pc.sin*pd]);tmpM.compose(tmpV.set(pc.x+pc.cos*pd,pc.y+.03,pc.z+pc.sin*pd),tmpQ,tmpS.set(place?13:0,1,place?13:0));this.pools.setMatrixAt(slot*def.n+k,tmpM)}}
   for(const m of meshes)m.instanceMatrix.needsUpdate=true}
  if(this.pools)this.pools.instanceMatrix.needsUpdate=true}
 collidersNear(s){const i=Math.floor(s/SEG_LEN);const out=[];for(const seg of this.segs)if(Math.abs(seg.idx-i)<=1)for(const c of seg.colliders)out.push(c);return out}
 follow(cam){if(this.sea){this.sea.position.set(cam.x,-4.2,cam.z)}this.farGround.position.set(cam.x,this.farGround.position.y,cam.z)}}
function buildGasStation(km){if(street)return street.buildStation(km);const s=stationS(km),g=new T.Group(),c=roadAt(s),y=c.y;const place=(obj,ss,d,yy,rot=0)=>{const p=roadAt(ss);obj.position.set(p.x+p.cos*d,yy,p.z+p.sin*d);obj.rotation.y=-p.th+rot;g.add(obj);return obj};
 const asphalt=new T.MeshStandardMaterial({color:'#4a4c50',roughness:.9});
 {const n=40,pos=[],idx=[],uv=[];for(let i=0;i<=n;i++){const t=i/n,ss=s-240+t*250,dc=EDGE-1.5+smooth01(t*1.3)*20,c=roadAt(ss);for(const o of[-3.4,3.4]){const d=dc+o;pos.push(c.x+c.cos*d,groundY(ss,d)+.045,c.z+c.sin*d);uv.push(o>0?1:0,ss/12)}if(i<n){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}const rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(pos,3));rg.setAttribute('uv',new T.Float32BufferAttribute(uv,2));rg.setIndex(idx);rg.computeVertexNormals();const ramp=new T.Mesh(rg,asphalt);ramp.receiveShadow=true;g.add(ramp)}
 const lot=new T.Mesh(new T.BoxGeometry(60,.12,60),asphalt);lot.receiveShadow=true;place(lot,s+10,EDGE+34,y+.03,Math.PI/2);
 const canopy=new T.Group();const roofM=new T.MeshStandardMaterial({color:'#f2f2ee',roughness:.5});const red=new T.MeshStandardMaterial({color:'#c8322d',roughness:.5});
 canopy.add(Object.assign(new T.Mesh(new T.BoxGeometry(22,.9,12),roofM),{castShadow:true}));const band=new T.Mesh(new T.BoxGeometry(22.2,.5,12.2),red);band.position.y=.2;canopy.add(band);const under=new T.Mesh(new T.PlaneGeometry(21,11).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:'#fffbe8'}));under.position.y=-.46;canopy.add(under);canopy.position.y=5.4;
 const cg=new T.Group();cg.add(canopy);for(const x of[-8,8])for(const z of[-4,4]){const p=new T.Mesh(new T.BoxGeometry(.5,5.4,.5),roofM);p.position.set(x,2.7,z);p.castShadow=true;cg.add(p)}for(const x of[-6,0,6]){const pm=new T.Mesh(new T.BoxGeometry(1.1,1.8,.7),new T.MeshStandardMaterial({color:'#2f3a44',roughness:.5}));pm.position.set(x,.9,0);pm.castShadow=true;cg.add(pm);const sc=new T.Mesh(new T.BoxGeometry(.6,.4,.72),new T.MeshBasicMaterial({color:'#7fe6ff'}));sc.position.set(x,1.3,0);cg.add(sc)}
 place(cg,s+5,EDGE+22,y,Math.PI/2);
 const shop=new T.Group();const wall=new T.Mesh(new T.BoxGeometry(24,5,12),new T.MeshStandardMaterial({color:'#d9d2bf',roughness:.8}));wall.position.y=2.5;wall.castShadow=true;shop.add(wall);const win=new T.Mesh(new T.PlaneGeometry(16,2.6),new T.MeshBasicMaterial({color:'#ffe9b0'}));win.position.set(0,2,-6.02);win.rotation.y=Math.PI;shop.add(win);const sign=new T.Mesh(new T.PlaneGeometry(10,1.6),new T.MeshBasicMaterial({map:textTex('HIGHWAY MART',{bg:'#1f6e45',fg:'#fff4cc',font:'900 64px system-ui'})}));sign.position.set(0,4.2,-6.05);sign.rotation.y=Math.PI;shop.add(sign);
 place(shop,s+12,EDGE+46,y,Math.PI/2);
 const pylon=new T.Group();const pole=new T.Mesh(new T.BoxGeometry(.6,12,.6),new T.MeshStandardMaterial({color:'#666',metalness:.6,roughness:.4}));pole.position.y=6;pylon.add(pole);const board=new T.Mesh(new T.BoxGeometry(5,4,.4),new T.MeshBasicMaterial({map:textTex('GAS',{w:256,h:256,bg:'#c8322d',fg:'#fff',font:'900 120px system-ui',sub:'KM '+km+' · REPAIRS'})}));board.position.y=12.5;pylon.add(board);place(pylon,s-60,EDGE+8,roadElev(s-60),0);
 const exitSign=new T.Group();for(const z of[-3.5,3.5]){const p=new T.Mesh(new T.BoxGeometry(.25,6,.25),new T.MeshStandardMaterial({color:'#888',metalness:.7}));p.position.set(z,3,0);exitSign.add(p)}const panel=new T.Mesh(new T.BoxGeometry(8,2.4,.2),new T.MeshBasicMaterial({map:textTex('GAS · FOOD · EXIT →',{w:512,h:150,bg:'#16633b',fg:'#ffffff',font:'900 56px system-ui',sub:'300 m · RIGHT LANE · PRESS E'})}));panel.position.y=6.2;exitSign.add(panel);place(exitSign,s-300,EDGE+1.5,roadElev(s-300),0);
 g.traverse(o=>{if(o.isMesh)o.receiveShadow=true});g.userData.km=km;return g}

// ---------------------------------------------------------------- vehicle physics
class Vehicle{
 constructor(spec,opts={}){this.spec=spec;this.kind=opts.kind||'traffic';this.isPlayer=this.kind==='player';const sh=SHAPES[spec.model||spec.shape]||SHAPES.coupe;this.sh=sh;
  this.mesh=createVehicleMesh(spec,{player:this.isPlayer,police:!!spec.police||spec.shape==='police',civilian:!!opts.civilian,separate:this.kind==='pursuer'||spec.shape==='police',color:this.isPlayer?carColor(spec):spec.color});
  this.L=this.mesh.data.L;this.W=this.mesh.data.W;this.mass=spec.weight*1000;this.wb=sh.wb;this.a=sh.wb*.47;this.b=sh.wb*.53;this.hcg=sh.kind==='car'?.5:.95;this.Iz=this.mass*(this.L*this.L+this.W*this.W)/12*1.05;
  this.x=0;this.z=0;this.psi=0;this.vx=0;this.vy=0;this.r=0;this.steer=0;this.steerIn=0;this.s=0;this.d=0;this.th=0;this.vAlong=0;this.y=0;
  this.input={throttle:0,brake:0,steer:0,handbrake:0};this.axPrev=0;this.ayPrev=0;this.pitch=0;this.pitchV=0;this.roll=0;this.rollV=0;this.upsetRoll=0;this.upsetV=0;
  this.health=this.maxHealth=spec.health;this.dmg={front:0,rear:0,left:0,right:0};this.gear=1;this.rpm=900;this.shift=0;this.wheelAngle=0;this.slip=0;this.skidPts=[null,null,null,null];this.dir=1;this.ghost=0;this.boostT=0;this.stun=0;this.wrecked=false;this.detached={};this.smokeT=0;this.flash=0;
  this.drive=spec.drive||sh.drive||'rwd';this.electric=!!spec.electric;this.assist={steerRate:1,steerRange:1,grip:1,tc:false,abs:false,esc:0,steer:false};this.setPerformance(spec.top,spec.accel,spec.brake,spec.steer)}
 setPerformance(top,accel,brake,steer){this.topKmh=top;this.vtop=top/3.6;this.a0=accel/10;this.Fmax=this.mass*this.a0;this.P=this.Fmax*16;this.crr=.013;this.kdrag=Math.max(.12,(this.P/this.vtop-this.crr*this.mass*GRAV)/(this.vtop*this.vtop));this.brakeDecel=brake/10;this.steerStat=steer;this.gripBonus=0}
 place(s,d,heading,speed){const p=worldFromRoad(s,d);this.x=p.x;this.z=p.z;this.psi=p.th+heading;this.vx=speed;this.vy=0;this.r=0;this.s=s;this.d=d;this.th=p.th;this.y=p.y;this.syncMesh(0)}
 get speed(){return Math.hypot(this.vx,this.vy)}
 // full lock at speed asks for roughly the tyres' grip limit, so keyboard steering stays progressive
 steerMax(mu){const v=Math.max(Math.abs(this.vx),1);const base=.5*(.78+this.steerStat/9),k=this.assist.steerRange;return Math.min(base*Math.min(k,1.15),(mu*GRAV*this.wb/(v*v)*(.8+this.steerStat*.07+this.gripBonus)+.25/(1+v))*k)}
 surface(){const ad=Math.abs(this.d),env=road.env;if(ad<=EDGE+.3)return{mu:env.grip,crr:0,off:false};return{mu:env.offGrip,crr:env.props==='desert'?.06:env.props==='alpine'?.08:.045,off:true}}
 step(h){
  if(this.submerged){this.vx=this.vy=this.r=0;return}
  const m=this.mass,L=this.wb,a=this.a,b=this.b,inp=this.input,surf=this.surface();
  const avgD=(this.dmg.front+this.dmg.rear+this.dmg.left+this.dmg.right)/4;
  const as=this.assist;
  const mu=surf.mu*(1+this.gripBonus*.35)*(1-.12*avgD)*as.grip*(surf.off?as.offGrip||1:1);
  const v=Math.abs(this.vx),sgn=this.vx>=0?1:-1;
  // steering: rack is rate limited; damaged sides knock the alignment toward that side
  // a bent tie-rod: a small toe offset that matters most at low speed and stays a gentle drift at highway speed
  const pull=(this.dmg.right-this.dmg.left)*.012*clamp(8/Math.max(v,1),.22,1)*Math.min(1,v/4);
  // steering assist: automatic counter-steer toward the direction of travel when the car starts to slide
  const counter=as.steer&&v>5&&!(inp.handbrake>0)?clamp(Math.atan2(this.vy,Math.max(v,2.5)),-.3,.3)*.65:0;
  const target=inp.steer*this.steerMax(mu)*(this.spec.drift?1.65:1)+pull+counter;
  this.steer+=clamp(target-this.steer,-h*2.6*as.steerRate,h*2.6*as.steerRate);
  const vxa=Math.max(v,2.5),sn=Math.sin(this.steer),cs=Math.cos(this.steer);
  const af=Math.atan2(this.vy+a*this.r,vxa)-this.steer*sgn,ar=Math.atan2(this.vy-b*this.r,vxa);
  const tr=this.axPrev*this.hcg/L*m;
  const Fzf=Math.max(m*GRAV*.15,m*GRAV*b/L-tr),Fzr=Math.max(m*GRAV*.15,m*GRAV*a/L+tr);
  const hb=inp.handbrake>0&&v>1.5;
  let Fyf=-mu*Fzf*Math.sin(1.9*Math.atan(10*af)),Fyr=-mu*Fzr*Math.sin(1.9*Math.atan(11*ar))*(hb?.4:this.spec.drift?.72:1);
  // engine & gearbox
  const powerLoss=clamp(1-.4*this.dmg.front-.12*(this.dmg.left+this.dmg.right)-.08*this.dmg.rear-(this.health/this.maxHealth<.3?.2:0),.25,1);
  const boost=this.boostT>0?1+this.boostAmt:1;
  let drive=0;
  if(inp.throttle>0&&this.shift<=0&&!this.wrecked){drive=inp.throttle*Math.min(this.Fmax*1.05*boost,this.P*powerLoss*boost*(this.nitro||1)/Math.max(v,4))}
  if(inp.reverse>0&&!this.wrecked)drive=-inp.reverse*this.Fmax*.38;
  let brakeF=0;if(inp.brake>0&&Math.abs(this.vx)>.05)brakeF=inp.brake*m*this.brakeDecel;
  const split=this.drive==='fwd'?1:this.drive==='awd'?.4:0;
  // less power reaches the damaged side; that imbalance plus the dragging hub makes the car pull toward the hit
  const dl=this.dmg.left,dr=this.dmg.right,tl=1-.45*dl,tR=1-.45*dr;
  const driveL=drive*tl/2,driveR=drive*tR/2,driveEff=driveL+driveR;
  let Fxf=driveEff*split-sgn*brakeF*.62,Fxr=driveEff*(1-split)-sgn*brakeF*.38;
  if(hb)Fxr-=sgn*mu*Fzr*.55;
  // traction control trims drive torque to the grip the tyre has left after cornering; ABS does the same for braking
  if(as.tc&&drive>0){const capF=Math.sqrt(Math.max(0,(mu*Fzf*.97)**2-Fyf*Fyf)),capR=Math.sqrt(Math.max(0,(mu*Fzr*.97)**2-Fyr*Fyr)),dF=driveEff*split,dR=driveEff*(1-split);if(dF>capF)Fxf-=dF-capF;if(dR>capR&&!hb)Fxr-=dR-capR}
  if(as.abs&&brakeF>0){const capF=Math.sqrt(Math.max(0,(mu*Fzf*.98)**2-Fyf*Fyf)),capR=Math.sqrt(Math.max(0,(mu*Fzr*.98)**2-Fyr*Fyr));if(Math.abs(Fxf)>capF)Fxf=Math.sign(Fxf)*capF;if(Math.abs(Fxr)>capR&&!hb)Fxr=Math.sign(Fxr)*capR}
  if(this.wrecked){Fxf-=sgn*mu*Fzf*.35;Fxr-=sgn*mu*Fzr*.35}
  const limit=(Fx,Fy,Fz)=>{const mx=mu*Fz*1.04,mag=Math.hypot(Fx,Fy);return mag>mx?mx/mag:1};
  let k=limit(Fxf,Fyf,Fzf);Fxf*=k;Fyf*=k;const slipF=k<1;k=limit(Fxr,Fyr,Fzr);Fxr*=k;Fyr*=k;const slipR=k<1;
  const drag=this.kdrag*this.vx*Math.abs(this.vx),roll=(this.crr+surf.crr)*m*GRAV*clamp(this.vx/1.5,-1,1);
  const hubDrag=(dl+dr)*.06*m*GRAV*clamp(this.vx/3,-1,1);
  let FxB=Fxf*cs-Fyf*sn+Fxr-drag-roll-hubDrag;
  const FyB=Fxf*sn+Fyf*cs+Fyr;
  let Mz=a*(Fxf*sn+Fyf*cs)-b*Fyr;
  Mz+=this.W/2*((dr-dl)*.06*m*GRAV*clamp(this.vx/3,-1,1))+this.W/2*(driveL-driveR)*.6;
  if(surf.off&&v>3)Mz+=(Math.random()-.5)*m*v*.25;
  let ax=FxB/m+this.r*this.vy,ay=FyB/m-this.r*this.vx;
  // brakes cannot push you backwards
  if(brakeF>0&&drive>=0&&Math.abs(this.vx)<brakeF/m*h*1.5&&!(inp.reverse>0)){this.vx=0;ax=0}
  this.vx+=ax*h;this.vy+=ay*h;this.r+=Mz/this.Iz*h;
  if(v<2){const damp=Math.exp(-h*(inp.throttle||inp.reverse?2:5));this.vy*=damp;this.r*=damp}
  // stability control: damps sideslip and holds yaw rate near what the steering geometry asks for (off = realistic)
  if(this.isPlayer&&!hb&&run&&!this.wrecked&&as.esc>0){const beta=Math.atan2(this.vy,vxa);if(Math.abs(beta)>.1&&v>8)this.r+=clamp(beta,-.4,.4)*h*1.6*as.esc;
   const lim=mu*GRAV/Math.max(v,3),rT=clamp(this.vx*Math.tan(this.steer)/L,-lim,lim);if(v>6&&Math.abs(this.r)>Math.abs(rT)+.06)this.r+=(rT-this.r)*Math.min(1,h*2.2*as.esc)}
  // Easy mode uses immediate arcade yaw and strong lateral damping. Hard keeps the tyre model.
  if(this.isPlayer&&difficulty.level<=24&&!this.wrecked&&!this.spec.drift){const yaw=inp.steer*Math.sign(this.vx)*Math.min(1.8,Math.abs(this.vx)*.16);this.r+=(yaw-this.r)*Math.min(1,h*18);if(!hb)this.vy*=Math.exp(-h*14)}
  this.axPrev+=(FxB/m-this.axPrev)*Math.min(1,h*8);this.ayPrev+=(FyB/m-this.ayPrev)*Math.min(1,h*8);
  const fx=Math.sin(this.psi),fz=-Math.cos(this.psi),rx=Math.cos(this.psi),rz=Math.sin(this.psi);
  this.x+=(fx*this.vx+rx*this.vy)*h;this.z+=(fz*this.vx+rz*this.vy)*h;this.psi+=this.r*h;
  this.slip=Math.max(Math.abs(ar)*(hb?2:1),Math.abs(af)*.8);this.slipF=slipF;this.slipR=slipR||hb;this.wheelspin=drive>0&&slipR&&v<15;this.locked=brakeF>0&&(slipF||slipR)&&v>4}
 updateGear(dt){if(this.electric){const v=Math.abs(this.vx);this.gear=this.input.reverse>0&&this.vx<.5?-1:1;this.shift=0;this.rpm+=(Math.min(16000,v/this.vtop*15500)-this.rpm)*Math.min(1,dt*10);return}const v=Math.abs(this.vx),ratios=[3.3,2.2,1.62,1.27,1.03,.86],kRpm=6900/(this.vtop*ratios[5]);
  if(this.input.reverse>0&&this.vx<.5){this.gear=-1}else if(this.gear<1)this.gear=1;
  if(this.shift>0)this.shift-=dt;
  if(this.gear>0){const rpm=v*ratios[this.gear-1]*kRpm;if(rpm>6600&&this.gear<6){this.gear++;this.shift=.12}else if(this.gear>1&&v*ratios[this.gear-2]*kRpm<4200){this.gear--}}
  const ratio=this.gear>0?ratios[this.gear-1]:3.0,target=Math.max(850+(this.input.throttle>0&&v<1?2400*this.input.throttle:0),v*ratio*kRpm+(this.wheelspin?1500:0));this.rpm+=(Math.min(7600,target)-this.rpm)*Math.min(1,dt*10)}
 syncRoad(){toRoad(this.x,this.z,this.s,this);const vxw=Math.sin(this.psi)*this.vx+Math.cos(this.psi)*this.vy,vzw=-Math.cos(this.psi)*this.vx+Math.sin(this.psi)*this.vy,t=roadAt(this.s);this.vAlong=vxw*t.sin-vzw*t.cos}
 syncMesh(dt){const g=this.mesh.group;const yC=groundY(this.s,this.d);const fx=Math.sin(this.psi),fz=-Math.cos(this.psi),rx=Math.cos(this.psi),rz=Math.sin(this.psi);
  const hf=this.L*.4,hw=this.W*.4,yF=probeGround(this.x+fx*hf,this.z+fz*hf,this.s),yB=probeGround(this.x-fx*hf,this.z-fz*hf,this.s),yR=probeGround(this.x+rx*hw,this.z+rz*hw,this.s),yL=probeGround(this.x-rx*hw,this.z-rz*hw,this.s);
  const slopeP=Math.atan2(yF-yB,hf*2),slopeR=-Math.atan2(yR-yL,hw*2);
  if(dt>0){const stiff=this.sh.kind==='car'?60:90,damp=this.sh.kind==='car'?9:12,kp=this.sh.kind==='car'?.0075:.003;
   this.pitchV+=((this.axPrev*kp)-this.pitch)*stiff*dt-this.pitchV*damp*dt;this.pitch+=this.pitchV*dt;
   this.rollV+=((-this.ayPrev*kp*1.15)-this.roll)*stiff*dt-this.rollV*damp*dt;this.roll+=this.rollV*dt;
   this.upsetV+=(-this.upsetRoll*25-this.upsetV*4)*dt;this.upsetRoll+=this.upsetV*dt}
  this.y=(yF+yB+yR+yL)/4;g.position.set(this.x,this.y+(Math.abs(this.d)>EDGE+.5&&Math.abs(this.vx)>5?Math.sin(performance.now()*.03+this.x)*.015:0),this.z);g.rotation.set(slopeR,Math.PI/2-this.psi,slopeP);
  this.mesh.body.rotation.set(this.roll+this.upsetRoll,0,this.pitch);this.mesh.body.position.y=Math.abs(this.upsetRoll)*.8;
  this.wheelAngle-=this.vx/(this.mesh.data.R||.33)*dt;for(const w of this.mesh.wheels){w.pivot.rotation.y=w.front?-this.steer:0;w.spin.rotation.z=this.wheelAngle;if(this.dmg[w.side<0?'left':'right']>.45)w.pivot.rotation.x=w.side*(this.dmg[w.side<0?'left':'right']-.45)*.3}
  const braking=this.input.brake>0&&this.vx>.5;if(this.mesh.mats.tail)this.mesh.mats.tail.color.setScalar(braking?1:.45);if(this.mesh.mats.brake)for(const m of this.mesh.mats.brake)m.emissiveIntensity=braking?4:.5}
 obb(){const fx=Math.sin(this.psi),fz=-Math.cos(this.psi),rx=Math.cos(this.psi),rz=Math.sin(this.psi),hl=this.L/2,hw=this.W/2;return{cx:this.x,cz:this.z,fx,fz,rx,rz,hl,hw,corners:[[this.x+fx*hl+rx*hw,this.z+fz*hl+rz*hw],[this.x+fx*hl-rx*hw,this.z+fz*hl-rz*hw],[this.x-fx*hl-rx*hw,this.z-fz*hl-rz*hw],[this.x-fx*hl+rx*hw,this.z-fz*hl+rz*hw]]}}
 worldVel(){const fx=Math.sin(this.psi),fz=-Math.cos(this.psi),rx=Math.cos(this.psi),rz=Math.sin(this.psi);return[fx*this.vx+rx*this.vy,fz*this.vx+rz*this.vy]}
 setWorldVel(vx,vz){const fx=Math.sin(this.psi),fz=-Math.cos(this.psi),rx=Math.cos(this.psi),rz=Math.sin(this.psi);this.vx=vx*fx+vz*fz;this.vy=vx*rx+vz*rz}
}

// ---------------------------------------------------------------- collisions & damage
function projectOBB(o,ax,az){let mn=Infinity,mx=-Infinity;for(const c of o.corners){const p=c[0]*ax+c[1]*az;if(p<mn)mn=p;if(p>mx)mx=p}return[mn,mx]}
function insideOBB(o,x,z,pad=0){const dx=x-o.cx,dz=z-o.cz;return Math.abs(dx*o.fx+dz*o.fz)<=o.hl+pad&&Math.abs(dx*o.rx+dz*o.rz)<=o.hw+pad}
function collidePair(A,B){if(A.ghost>0||B.ghost>0)return;const dx0=B.x-A.x,dz0=B.z-A.z,rr=(A.L+B.L)/2+1;if(dx0*dx0+dz0*dz0>rr*rr)return;
 const oa=A.obb(),ob=B.obb();let best=Infinity,nx=0,nz=0;for(const[ax,az]of[[oa.fx,oa.fz],[oa.rx,oa.rz],[ob.fx,ob.fz],[ob.rx,ob.rz]]){const[a0,a1]=projectOBB(oa,ax,az),[b0,b1]=projectOBB(ob,ax,az);const o=Math.min(a1,b1)-Math.max(a0,b0);if(o<=0)return;if(o<best){best=o;nx=ax;nz=az}}
 if(nx*dx0+nz*dz0<0){nx=-nx;nz=-nz}
 let cx=0,cz=0,n=0;for(const c of ob.corners)if(insideOBB(oa,c[0],c[1],.02)){cx+=c[0];cz+=c[1];n++}for(const c of oa.corners)if(insideOBB(ob,c[0],c[1],.02)){cx+=c[0];cz+=c[1];n++}if(n){cx/=n;cz/=n}else{cx=(A.x+B.x)/2;cz=(A.z+B.z)/2}
 resolveContact(A,B,nx,nz,cx,cz,best)}
function resolveContact(A,B,nx,nz,cx,cz,pen){const mA=A.mass,mB=B?B.mass:Infinity,iA=1/mA,iB=B?1/mB:0;
 const[avx,avz]=A.worldVel(),[bvx,bvz]=B?B.worldVel():[0,0];const rax=cx-A.x,raz=cz-A.z,rbx=B?cx-B.x:0,rbz=B?cz-B.z:0;
 const vAx=avx-A.r*raz,vAz=avz+A.r*rax,vBx=B?bvx-B.r*rbz:0,vBz=B?bvz+B.r*rbx:0;
 const rvx=vBx-vAx,rvz=vBz-vAz,vn=rvx*nx+rvz*nz;
 const tot=iA+iB,corr=Math.max(0,pen-.01)*.8/tot;
 let nAx=A.x-nx*corr*iA,nAz=A.z-nz*corr*iA;A.x=nAx;A.z=nAz;if(B){B.x+=nx*corr*iB;B.z+=nz*corr*iB}
 if(vn>=0)return;
 const raCn=rax*nz-raz*nx,rbCn=rbx*nz-rbz*nx,e=.18;
 const j=-(1+e)*vn/(iA+iB+raCn*raCn/A.Iz+(B?rbCn*rbCn/B.Iz:0));
 let tx=-nz,tz=nx;const vt=rvx*tx+rvz*tz;const raCt=rax*tz-raz*tx,rbCt=rbx*tz-rbz*tx;let jt=-vt/(iA+iB+raCt*raCt/A.Iz+(B?rbCt*rbCt/B.Iz:0));jt=clamp(jt,-j*.45,j*.45);
 const Jx=nx*j+tx*jt,Jz=nz*j+tz*jt;
 A.setWorldVel(avx-Jx*iA,avz-Jz*iA);A.r-=(rax*Jz-raz*Jx)/A.Iz;
 if(B){B.setWorldVel(bvx+Jx*iB,bvz+Jz*iB);B.r+=(rbx*Jz-rbz*Jx)/B.Iz}
 const impact=-vn,y=(A.y||0)+.55;
 applyImpact(A,cx,y,cz,nx,nz,impact,B?mB:mA*6,B);if(B)applyImpact(B,cx,y,cz,-nx,-nz,impact,mA,A);
 if(impact>1.5)effects.impact(cx,y,cz,impact,A,B)}
// n is the direction of the push on 'v' as seen from the other body (from v outwards toward obstacle is -n for A)
function applyImpact(v,cx,cy,cz,nx,nz,impact,otherMass,other){if(impact<1.2)return;
 const share=Math.min(2,otherMass/(v.mass+otherMass)*2);let dmg=.22*impact*impact*share;
 if(v.isPlayer){dmg*=(1-clamp(run.upgradeStats.armor,0,.8))*(run.diff?run.diff.damage:1);v.boostT=2;v.boostAmt=run.upgradeStats.recovery*.8}
 if(other&&other.isPlayer&&v.role==='pursuer')dmg*=1+run.upgradeStats.ram;
 if(v.isPlayer&&other&&other.role==='pursuer'&&other.kind==='cop')dmg*=.8;
 const lx=(cx-v.x)*Math.sin(v.psi)+(cz-v.z)*(-Math.cos(v.psi)),lz=(cx-v.x)*Math.cos(v.psi)+(cz-v.z)*Math.sin(v.psi);
 const zone=Math.abs(lx)/(v.L/2)>Math.abs(lz)/(v.W/2)?(lx>0?'front':'rear'):(lz>0?'right':'left');
 v.health-=dmg;v.dmg[zone]=Math.min(1,v.dmg[zone]+dmg/v.maxHealth*1.5+impact*.006);
 if(v.kind!=='player'&&impact>4)v.stun=Math.max(v.stun,1.5+impact*.15);
 if(impact>2.5){v.upsetV+=(lz>0?-1:1)*Math.min(.6,impact*.02)*(zone==='left'||zone==='right'?1:.3)}
 deformVehicle(v,cx,cy,cz,nx,nz,impact);
 if(v.isPlayer){camState.shake=Math.min(1.4,camState.shake+impact/14);audio.crash(impact);if(dmg>2)addNotice(impact>14?'HEAVY IMPACT — '+zone.toUpperCase()+' DAMAGE':'IMPACT — '+zone+' side hit',true,2)}
 else if(run&&dist2(v,run.player)<3600)audio.crash(impact*.6);
 if(v.health<=0&&!v.wrecked)wreck(v)}
const dist2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
function deformVehicle(v,cx,cy,cz,nx,nz,impact){if(impact<2.2)return;const g=v.mesh.group;g.updateMatrixWorld(true);const depth=Math.min(.32,impact*.016),radius=.55+Math.min(1.1,impact*.04);const wp=tmpV.set(cx,cy,cz),dir=new T.Vector3(-nx,0,-nz);
 // push from the contact point toward the vehicle centre
 const toC=new T.Vector3(v.x-cx,0,v.z-cz);if(toC.dot(dir)<0)dir.negate();
 const targets=v.mesh.parts.deform||['body','glass','roof','turret'].map(k=>v.mesh.parts[k]).filter(Boolean);
 for(const m of targets){if(m.isMesh&&m.geometry.boundingSphere===null)m.geometry.computeBoundingSphere();deformMesh(m,wp,dir,depth,radius)}
 const pd=v.dmg;const P=v.mesh.parts;
 if(P.glassList&&!v.glassBroken&&(impact>9||pd.left>.55||pd.right>.55||pd.front>.7)){v.glassBroken=true;for(const m of P.glassList)m.material=shared.glassBroken;for(let i=0;i<26;i++)effects.sparks.spawn(cx,cy+.5,cz,rand(-3,3),rand(1,4),rand(-3,3),rand(.6,1.2),.09,0,.8,.9,1,.9,GRAV,1)}
 if(pd.front>.55)detach(v,'bumperF');if(pd.rear>.55)detach(v,'bumperR');if(pd.left>.3)detach(v,'mirrorL');if(pd.right>.3)detach(v,'mirrorR');if(pd.rear>.5)detach(v,'wing');
 if((impact>9||pd.left>.55||pd.right>.55||pd.front>.7)&&P.glass&&P.glass.material===shared.glass){P.glass.material=shared.glassBroken;for(let i=0;i<26;i++)effects.sparks.spawn(cx,cy+.5,cz,rand(-3,3),rand(1,4),rand(-3,3),rand(.6,1.2),.09,0,.8,.9,1,.9,GRAV,1)}}
function deformMesh(mesh,worldPoint,worldDir,depth,radius){
 // model geometry is shared between cars until the first dent, then this car gets its own copy
 if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();const bs=mesh.geometry.boundingSphere;if(mesh.worldToLocal(tmpV2.copy(worldPoint)).distanceTo(bs.center)>bs.radius+radius)return;
 if(mesh.geometry.userData.shared){const own=mesh.geometry.clone();own.userData={};mesh.geometry=own}
 const geo=mesh.geometry,pos=geo.attributes.position;if(!geo.userData.orig)geo.userData.orig=pos.array.slice();const lp=mesh.worldToLocal(tmpV2.copy(worldPoint));const q=mesh.getWorldQuaternion(new T.Quaternion()).invert();const ld=worldDir.clone().applyQuaternion(q).normalize();const arr=pos.array,orig=geo.userData.orig;let changed=false;const r2=radius*radius;
 for(let i=0;i<arr.length;i+=3){const dx=arr[i]-lp.x,dy=(arr[i+1]-lp.y)*.8,dz=arr[i+2]-lp.z,d2=dx*dx+dy*dy+dz*dz;if(d2>r2)continue;const f=1-Math.sqrt(d2)/radius,k=depth*f*f*(.7+Math.random()*.6);arr[i]+=ld.x*k;arr[i+1]+=ld.y*k-k*.15;arr[i+2]+=ld.z*k;const ox=arr[i]-orig[i],oy=arr[i+1]-orig[i+1],oz=arr[i+2]-orig[i+2],om=Math.hypot(ox,oy,oz);if(om>.4){const s=.4/om;arr[i]=orig[i]+ox*s;arr[i+1]=orig[i+1]+oy*s;arr[i+2]=orig[i+2]+oz*s}changed=true}
 if(changed){pos.needsUpdate=true;geo.computeVertexNormals()}}
function detach(v,key){const m=v.mesh.parts[key];if(!m||v.detached[key])return;v.detached[key]=true;m.updateMatrixWorld(true);const wp=new T.Vector3(),wq=new T.Quaternion(),ws=new T.Vector3();m.matrixWorld.decompose(wp,wq,ws);m.parent.remove(m);m.position.copy(wp);m.quaternion.copy(wq);scene.add(m);const[vx,vz]=v.worldVel();effects.loose.push({mesh:m,v:new T.Vector3(vx*.8+rand(-3,3),rand(2,5),vz*.8+rand(-3,3)),w:new T.Vector3(rand(-8,8),rand(-8,8),rand(-8,8)),life:25})}
function wreck(v){v.wrecked=true;v.health=0;v.input.throttle=0;if(v.mesh.parts.lights)v.mesh.parts.lights.visible=false;if(v.isPlayer)finishCrash();else if(v.role==='pursuer'){awardRoadCoins(15);addNotice((v.kind==='cop'?'COP':'TRUCK')+' TAKEDOWN! +15 coins',false,3)}}
function staticCollisions(v){if(v.ghost>0)return;
 if(road.env.props==='city'){const o=v.obb(),t=roadAt(v.s);let maxD=-Infinity,minD=Infinity,cmx=0,cmz=0,cnx=0,cnz=0;for(const c of o.corners){const d=v.d+((c[0]-v.x)*t.cos+(c[1]-v.z)*t.sin);if(d>maxD){maxD=d;cmx=c[0];cmz=c[1]}if(d<minD){minD=d;cnx=c[0];cnz=c[1]}}
  if(maxD>BARRIER_D-.32)wallHit(v,-t.cos,-t.sin,cmx,cmz,maxD-(BARRIER_D-.32));else if(minD<-(BARRIER_D-.32))wallHit(v,t.cos,t.sin,cnx,cnz,-(BARRIER_D-.32)-minD)}
 if(!world)return;if(Math.abs(v.d)<EDGE+.5)return;const cols=world.collidersNear(v.s);if(!cols.length)return;const o=v.obb();
 for(const c of cols){const dx=c.x-v.x,dz=c.z-v.z;if(dx*dx+dz*dz>(v.L/2+c.r+1)**2)continue;const lf=dx*o.fx+dz*o.fz,lr=dx*o.rx+dz*o.rz,qf=clamp(lf,-o.hl,o.hl),qr=clamp(lr,-o.hw,o.hw);const px=v.x+o.fx*qf+o.rx*qr,pz=v.z+o.fz*qf+o.rz*qr;let ex=px-c.x,ez=pz-c.z,dd=Math.hypot(ex,ez);if(dd>=c.r)continue;if(dd<1e-4){ex=-dx;ez=-dz;dd=Math.hypot(ex,ez)||1}wallHit(v,ex/dd,ez/dd,px,pz,c.r-dd,true)}}
function wallHit(v,nx,nz,cx,cz,pen,tree=false){// n points out of the obstacle toward the vehicle
 v.x+=nx*pen;v.z+=nz*pen;const[vx,vz]=v.worldVel(),rx=cx-v.x,rz=cz-v.z,pvx=vx-v.r*rz,pvz=vz+v.r*rx,vn=pvx*nx+pvz*nz;if(vn>=0)return;
 const rCn=rx*nz-rz*nx,j=-(1+(tree?.12:.25))*vn/(1/v.mass+rCn*rCn/v.Iz);let tx=-nz,tz=nx,vt=pvx*tx+pvz*tz,jt=clamp(-vt*v.mass*.3,-j*.35,j*.35);const Jx=nx*j+tx*jt,Jz=nz*j+tz*jt;v.setWorldVel(vx+Jx/v.mass,vz+Jz/v.mass);v.r+=(rx*Jz-rz*Jx)/v.Iz;
 const impact=-vn;if(impact>1.2){applyImpact(v,cx,v.y+.55,cz,-nx,-nz,impact,v.mass*8,null);if(impact>1.5)effects.impact(cx,v.y+.55,cz,impact,v,null)}
 if(Math.abs(vt)>4&&!tree)for(let i=0;i<3;i++)effects.sparks.spawn(cx,v.y+.45,cz,vx*.6+rand(-2,2),rand(.5,3),vz*.6+rand(-2,2),rand(.25,.5),.07,0,1,.75,.35,1,GRAV,2)}

// ---------------------------------------------------------------- effects
const effects={smoke:null,sparks:null,glow:null,skids:null,debris:null,loose:[],tracers:[],
 init(){this.smoke=new PointPool(700,smokeTex(),false);this.sparks=new PointPool(500,radialTex('spark',[[0,'rgba(255,255,255,1)'],[.3,'rgba(255,230,180,.8)'],[1,'rgba(255,160,60,0)']]),true);this.glow=new PointPool(700,radialTex('glow',[[0,'rgba(255,255,255,1)'],[.15,'rgba(255,255,255,.7)'],[.45,'rgba(255,255,255,.15)'],[1,'rgba(255,255,255,0)']]),true,false);this.skids=new Skids();this.debris=new Debris();this.loose=[];this.tracers=[];scene.add(this.smoke.points,this.sparks.points,this.glow.points,this.skids.mesh,this.debris.mesh)},
 impact(x,y,z,impact,A,B){const n=Math.min(60,Math.floor(impact*3));for(let i=0;i<n;i++)this.sparks.spawn(x,y,z,rand(-1,1)*impact*.6,rand(.3,1)*impact*.35,rand(-1,1)*impact*.6,rand(.25,.7),.11,0,1,.8,.45,1,GRAV,1.5);
  if(impact>5){const cnt=Math.min(14,Math.floor(impact/2.5));for(const v of[A,B]){if(!v||!v.mesh)continue;const col=v.mesh.mats.paint.color.getHex();const[vx,vz]=v.worldVel();for(let i=0;i<cnt/2;i++)this.debris.spawn(tmpV.set(x+rand(-.4,.4),y+rand(0,.4),z+rand(-.4,.4)),new T.Vector3(vx*.6+rand(-4,4),rand(1.5,5),vz*.6+rand(-4,4)),rand(.12,.32),Math.random()<.6?col:0x1a1a1a)}}
  for(let i=0;i<Math.min(8,impact);i++)this.smoke.spawn(x,y,z,rand(-1.5,1.5),rand(.3,1.4),rand(-1.5,1.5),rand(1.2,2.4),1.2,3.5,.55,.55,.53,.5,-.3,1.2)},
 update(dt){this.smoke.update(dt);this.sparks.update(dt);this.debris.update(dt);
  for(let i=this.loose.length-1;i>=0;i--){const l=this.loose[i];l.life-=dt;l.v.y-=GRAV*dt;l.mesh.position.addScaledVector(l.v,dt);const gy=probeGround(l.mesh.position.x,l.mesh.position.z)+.1;if(l.mesh.position.y<gy){l.mesh.position.y=gy;l.v.y*=-.25;l.v.x*=.55;l.v.z*=.55;l.w.multiplyScalar(.5)}tmpQ.setFromEuler(tmpE.set(l.w.x*dt,l.w.y*dt,l.w.z*dt));l.mesh.quaternion.premultiply(tmpQ);if(l.life<=0||(run&&dist2({x:l.mesh.position.x,z:l.mesh.position.z},run.player)>250000)){scene.remove(l.mesh);this.loose.splice(i,1)}}
  for(let i=this.tracers.length-1;i>=0;i--){const t=this.tracers[i];t.age+=dt;t.p.addScaledVector(t.v,dt);t.mesh.position.copy(t.p);if(t.age>1.6){scene.remove(t.mesh);this.tracers.splice(i,1)}}},
 clear(){for(const l of this.loose)scene.remove(l.mesh);this.loose=[];for(const t of this.tracers)scene.remove(t.mesh);this.tracers=[]}};

// ---------------------------------------------------------------- audio (engine, tyres, wind, siren, crashes)
const audio={ctx:null,
 enabled(){try{return localStorage.getItem('minesweeperSound')!=='off'}catch(_){return true}},
 volume(){try{const v=Number(localStorage.getItem('minesweeperSfxVolume'));return Number.isFinite(v)&&localStorage.getItem('minesweeperSfxVolume')!==null?clamp(v,0,1):.7}catch(_){return .7}},
 start(){this.stop();if(!this.enabled())return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=this.ctx=new AC();this.master=c.createGain();this.master.gain.value=this.volume()*.8;this.master.connect(c.destination);
  const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noise=noise;
  this.eFilter=c.createBiquadFilter();this.eFilter.type='lowpass';this.eFilter.frequency.value=800;this.eFilter.Q.value=2;this.eGain=c.createGain();this.eGain.gain.value=0;this.eFilter.connect(this.eGain);this.eGain.connect(this.master);
  this.oscs=[['sawtooth',1,.5],['square',.5,.35],['sawtooth',2.01,.18],['triangle',.25,.5]].map(([type,mul,g])=>{const o=c.createOscillator(),gg=c.createGain();o.type=type;gg.gain.value=g;o.connect(gg);gg.connect(this.eFilter);o.start();return{o,mul}});
  const mk=(type,f,q)=>{const src=c.createBufferSource();src.buffer=noise;src.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=c.createGain();g.gain.value=0;src.connect(fl);fl.connect(g);g.connect(this.master);src.start();return g};
  this.tire=mk('bandpass',1500,5);this.wind=mk('lowpass',500,.7);this.rumble=mk('lowpass',140,1);
  this.siren=c.createOscillator();this.siren.type='sine';this.sGain=c.createGain();this.sGain.gain.value=0;this.siren.connect(this.sGain);this.sGain.connect(this.master);this.siren.start()}catch(_){this.ctx=null}},
 update(p,throttle,nearCop){if(!this.ctx)return;const t=this.ctx.currentTime,ev=p.electric,f=ev?60+p.rpm*.045:p.rpm/60*2;for(const{o,mul}of this.oscs)o.frequency.setTargetAtTime(Math.max(18,f*mul),t,.03);this.eFilter.frequency.setTargetAtTime(ev?700+p.rpm*.12:300+throttle*1600+p.rpm*.25,t,.05);this.eGain.gain.setTargetAtTime(p.wrecked?0:ev?.012+throttle*.03:.05+throttle*.07,t,.05);
  const v=Math.abs(p.vx);this.tire.gain.setTargetAtTime(v>3?clamp((p.slip-.07)*1.1,0,.3)+(p.locked?.15:0):0,t,.04);this.wind.gain.setTargetAtTime(Math.min(.22,(v/80)**2*.25),t,.1);this.rumble.gain.setTargetAtTime(Math.abs(p.d)>EDGE+.3&&v>2?Math.min(.5,v/40):0,t,.08);
  if(nearCop<140){this.sGain.gain.setTargetAtTime(.05*(1-nearCop/140),t,.1);this.siren.frequency.setTargetAtTime(Math.sin(t*Math.PI*1.4)>0?960:720,t,.08)}else this.sGain.gain.setTargetAtTime(0,t,.2)},
 crash(intensity){if(!this.ctx||intensity<1.5)return;const c=this.ctx,t=c.currentTime,src=c.createBufferSource();src.buffer=this.noise;const fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=600+intensity*90;const g=c.createGain();const peak=Math.min(.9,intensity*.05);g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(.001,t+.25+intensity*.03);src.connect(fl);fl.connect(g);g.connect(this.master);src.start(t);src.stop(t+1.2);const o=c.createOscillator(),og=c.createGain();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(35,t+.3);og.gain.setValueAtTime(peak*.8,t);og.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(og);og.connect(this.master);o.start(t);o.stop(t+.4)},
 coin(){if(!this.ctx)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(1320,t);o.frequency.setValueAtTime(1760,t+.06);g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.25)},
 shot(){if(!this.ctx)return;const c=this.ctx,t=c.currentTime,src=c.createBufferSource();src.buffer=this.noise;const g=c.createGain();g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.08);src.connect(g);g.connect(this.master);src.start(t);src.stop(t+.1)},
 pause(on){if(!this.ctx)return;try{on?this.ctx.suspend():this.ctx.resume()}catch(_){}},
 stop(){if(this.ctx){try{this.ctx.close()}catch(_){}this.ctx=null}}};

// ---------------------------------------------------------------- cameras
const CAMS=[{id:'chase',name:'CHASE CAM'},{id:'far',name:'FAR CHASE'},{id:'cockpit',name:'COCKPIT'},{id:'hood',name:'HOOD CAM'},{id:'bumper',name:'BUMPER CAM'},{id:'heli',name:'HELICOPTER'},{id:'top',name:'TOP-DOWN CLASSIC'},{id:'tv',name:'TV TRACKSIDE'},{id:'cine',name:'CINEMATIC'}];
const camState={mode:0,pos:null,look:null,yaw:0,shake:0,tv:null,labelUntil:0,fov:62,cineT:0,cineShot:-1};
// Cinematic shots in car space: [forward, up, right] camera offset and the point it frames; cuts every few seconds
const CINE_SHOTS=[[[3.4,.5,2.7],[0,.65,0]],[[-.4,1.0,3.6],[.6,.7,0]],[[-7.5,.42,-1.6],[1,.8,0]],[[1.5,.32,1.65],[3,.45,1]],[[11,5.5,7],[0,.6,0]],[[-2.6,1.4,-3.2],[1.5,.8,0]]];
try{const saved=Number(localStorage.getItem('highwayCam'));if(Number.isInteger(saved)&&saved>=0&&saved<CAMS.length)camState.mode=saved}catch(_){}
function setCamera(i){camState.mode=((i%CAMS.length)+CAMS.length)%CAMS.length;camState.tv=null;camState.snap=true;try{localStorage.setItem('highwayCam',String(camState.mode))}catch(_){}if(viewLabel){viewLabel.textContent='🎥 '+CAMS[camState.mode].name;viewLabel.classList.add('show');clearTimeout(setCamera.t);setCamera.t=setTimeout(()=>viewLabel.classList.remove('show'),1400)}}
function updateCamera(dt){if(street?.onFoot){street.updateCamera(dt);return}const p=run.player,g=p.mesh.group,mode=CAMS[camState.mode].id,lb=keys.lookBack;
 const fx=Math.sin(p.psi),fz=-Math.cos(p.psi);if(camState.snap){camState.yaw=p.psi}
 // chase cameras swing partly toward the direction of travel, so slides and drifts read clearly from behind
 const spd=Math.abs(p.vx),[wvx,wvz]=p.worldVel(),slideYaw=spd>4?clamp(wrapAngle(Math.atan2(wvx,-wvz)-p.psi),-.7,.7)*.45:0;
 camState.yaw+=wrapAngle(p.psi+slideYaw-camState.yaw)*Math.min(1,dt*(mode==='far'||mode==='heli'?3:4.5));const cyx=Math.sin(camState.yaw),cyz=-Math.cos(camState.yaw);
 const interior=g.getObjectByName('interior');const inside=mode==='cockpit';if(interior)interior.visible=inside;if(p.mesh.parts.glass)p.mesh.parts.glass.visible=!inside;for(const m of p.mesh.parts.glassList||[])m.visible=!inside;
 camera.up.set(0,1,0);let fov=60+Math.min(16,Math.abs(p.vx)*.2);camera.near=inside?.05:.15;
 const crashOrbit=run.crashing||run.over;
 if(crashOrbit){const a=run.elapsed*.35,r=9;camState.pos.lerp(tmpV.set(p.x+Math.cos(a)*r,p.y+3.5,p.z+Math.sin(a)*r),Math.min(1,dt*2));camera.position.copy(camState.pos);camera.lookAt(p.x,p.y+.8,p.z);fov=55}
 else if(mode==='chase'||mode==='far'||mode==='heli'){const heli=mode==='heli',k=heli?1:difficulty.camDist,size=clamp(p.L/4.6,.85,1.6);
  // the camera drops back under acceleration and closes in under braking, like a real tracking vehicle
  const back=(mode==='chase'?5.6:mode==='far'?10:24)*k*(heli?1:size)+(heli?0:clamp(p.axPrev*.06,-.45,.7)+Math.min(.9,spd*.012)),up=(mode==='chase'?1.75:mode==='far'?3.4:15)*(heli?1:Math.sqrt(k)*size);
  const dir=lb?-1:1;const des=tmpV.set(p.x-cyx*back*dir,p.y+up,p.z-cyz*back*dir);if(camState.snap)camState.pos.copy(des);else camState.pos.lerp(des,1-Math.exp(-dt*(heli?3:9)));const gy=probeGround(camState.pos.x,camState.pos.z)+.6;if(camState.pos.y<gy)camState.pos.y=gy;camera.position.copy(camState.pos);
  const ahead=(heli?12:3.5+spd*.05)*dir;camera.lookAt(p.x+cyx*ahead,p.y+(mode==='chase'?.95*size:1.4),p.z+cyz*ahead);
  if(!heli){camera.rotateZ(clamp(p.ayPrev*.0035,-.035,.035));if(spd>28){const a=(spd-28)*.0006;camera.position.x+=(Math.random()-.5)*a;camera.position.y+=(Math.random()-.5)*a}}if(heli)fov=50}
 else if(mode==='cine'){camState.cineT+=dt;const shot=Math.floor(camState.cineT/5.5)%CINE_SHOTS.length;if(shot!==camState.cineShot){camState.cineShot=shot;camState.snap=true}
  const[o,l]=CINE_SHOTS[shot],rx=Math.cos(p.psi),rz=Math.sin(p.psi),des=tmpV.set(p.x+fx*o[0]+rx*o[2],p.y+o[1],p.z+fz*o[0]+rz*o[2]);if(camState.snap)camState.pos.copy(des);else camState.pos.lerp(des,1-Math.exp(-dt*5));const gy=probeGround(camState.pos.x,camState.pos.z)+.25;if(camState.pos.y<gy)camState.pos.y=gy;
  camera.position.copy(camState.pos);camera.lookAt(p.x+fx*l[0]+rx*l[2],p.y+l[1],p.z+fz*l[0]+rz*l[2]);fov=shot===4?38:shot===3?72:52}
 else if(mode==='cockpit'||mode==='hood'||mode==='bumper'){const d=p.mesh.data,e=mode==='cockpit'?d.eye:mode==='hood'?d.hood:d.bumper;g.updateMatrixWorld(true);const sway=mode==='cockpit'?clamp(-p.ayPrev*.004,-.04,.04):0;camera.position.copy(tmpV.set(e[0]-clamp(p.axPrev*.004,-.03,.03),e[1]+(mode==='cockpit'?Math.min(.04,Math.abs(p.vx)*.0002*Math.sin(run.elapsed*30)):0),e[2]+sway).applyMatrix4(mode==='cockpit'?p.mesh.body.matrixWorld:g.matrixWorld));camera.quaternion.copy(p.mesh.body.getWorldQuaternion(tmpQ)).multiply(new T.Quaternion().setFromAxisAngle(UP,lb?Math.PI/2:-Math.PI/2));if(mode==='cockpit'){camera.rotateY(-p.steer*.45);camera.rotateX(-.06);fov=70}else fov=64+Math.min(14,Math.abs(p.vx)*.18);if(interior&&interior.userData.wheel)interior.userData.wheel.rotation.x=-p.steer*12;camState.pos.copy(camera.position)}
 else if(mode==='top'){const t=roadAt(p.s);const des=tmpV.set(p.x+t.sin*10,p.y+48,p.z-t.cos*10);camState.pos.lerp(des,camState.snap?1:Math.min(1,dt*6));camera.position.copy(camState.pos);camera.up.set(t.sin,0,-t.cos);camera.lookAt(p.x+t.sin*10,p.y,p.z-t.cos*10);fov=48}
 else if(mode==='tv'){let tv=camState.tv;const rel=tv?(tv.s-p.s):0;if(!tv||rel<-45||rel>200){const s=p.s+rand(70,130)*(p.vAlong>=0?1:-1),side=Math.random()<.5?-1:1,d=side*rand(13,19),w=worldFromRoad(s,d);tv=camState.tv={s,x:w.x,z:w.z,y:groundY(s,d)+rand(1.6,4.5)}}camera.position.set(tv.x,tv.y,tv.z);camera.lookAt(p.x,p.y+.8,p.z);const dd=Math.hypot(p.x-tv.x,p.z-tv.z);fov=clamp(2*Math.atan(5.5/dd)*180/Math.PI,9,55);camState.pos.copy(camera.position)}
 if(camState.shake>0){camera.position.x+=(Math.random()-.5)*camState.shake*.35;camera.position.y+=(Math.random()-.5)*camState.shake*.25;camera.position.z+=(Math.random()-.5)*camState.shake*.35;camState.shake=Math.max(0,camState.shake-dt*2.2)}
 if(mode!=='tv'&&!crashOrbit)fov+=difficulty.fov;
 camState.fov+=(fov-camState.fov)*Math.min(1,dt*5);if(camState.snap)camState.fov=fov;camera.fov=camState.fov;camera.updateProjectionMatrix();camState.snap=false}

// ---------------------------------------------------------------- scene lifecycle
let world=null,sunLight=null,hemiLight=null,skyObj=null,mountains=null,headSpot=null,coinMesh=null,stationObjs=[];
function initRenderer(){if(renderer)return true;if(!HAS3D){showFail('3D engine failed to load. Check your connection and reload.');return false}
 try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(e){showFail('Your browser could not start WebGL, which this game needs.');return false}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 camera=new T.PerspectiveCamera(62,16/9,.15,6000);pmrem=new T.PMREMGenerator(renderer);camState.pos=new T.Vector3();camState.look=new T.Vector3();
 // HDR pipeline: multisampled half-float scene buffer → bloom on bright lights → tone mapping + sRGB output
 // (MSAA on the half-float buffer is costly on integrated GPUs, so only Ultra uses it; High anti-aliases with FXAA)
 try{const rt=new T.WebGLRenderTarget(4,4,{type:T.HalfFloatType});composer=new EffectComposer(renderer,rt);renderPass=new RenderPass(new T.Scene(),camera);composer.addPass(renderPass);bloomPass=new UnrealBloomPass(new T.Vector2(256,256),.25,.55,.9);const bloomSize=bloomPass.setSize.bind(bloomPass);bloomPass.setSize=(w,h)=>bloomSize(Math.max(1,w>>1),Math.max(1,h>>1));composer.addPass(bloomPass);composer.addPass(new OutputPass());fxaaPass=new ShaderPass(FXAAShader);composer.addPass(fxaaPass)}catch(e){composer=null}
 const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement);resize();initShared();return true}
let composer=null,bloomPass=null,renderPass=null,fxaaPass=null,gfxLevel=1;
// ultra / high / balanced / performance; the game steps down by itself if the frame rate stays low
const GFX_SPEC=[{pr:2,shadow:4096,bloom:true},{pr:1.35,shadow:2048,bloom:true},{pr:1.25,shadow:2048,bloom:false},{pr:1,shadow:0,bloom:false}];
function applyGfx(level){gfxLevel=clamp(level,0,3);const g=GFX_SPEC[gfxLevel];renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,g.pr));const sh=g.shadow>0;
 if(composer){const samples=gfxLevel===0?4:0;for(const rt of[composer.renderTarget1,composer.renderTarget2])if(rt.samples!==samples){rt.samples=samples;rt.dispose()}fxaaPass.enabled=samples===0}
 if(renderer.shadowMap.enabled!==sh){renderer.shadowMap.enabled=sh;if(scene)scene.traverse(o=>{if(o.material)for(const m of[].concat(o.material))m.needsUpdate=true})}
 if(sunLight&&sh&&sunLight.shadow.mapSize.x!==g.shadow){sunLight.shadow.mapSize.set(g.shadow,g.shadow);if(sunLight.shadow.map){sunLight.shadow.map.dispose();sunLight.shadow.map=null}}resize()}
function showFail(msg){const stage=canvas.parentElement;let el=stage.querySelector('.drive-fail');if(!el){el=document.createElement('div');el.className='drive-fail';stage.appendChild(el)}el.textContent=msg}
function resize(){if(!renderer)return;const r=canvas.parentElement.getBoundingClientRect(),w=Math.max(200,Math.round(r.width)),h=Math.max(150,Math.round(canvas.getBoundingClientRect().height||r.width/1.6));renderer.setSize(w,h,false);if(composer){const pr=renderer.getPixelRatio();composer.setPixelRatio(pr);composer.setSize(w,h);fxaaPass.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr))}camera.aspect=w/h;camera.updateProjectionMatrix();const dpr=Math.min(window.devicePixelRatio||1,2);overlayDpr=dpr;overlay.width=Math.round(w*dpr);overlay.height=Math.round(h*dpr);overlay.style.width=w+'px';overlay.style.height=h+'px';octx.setTransform(dpr,0,0,dpr,0,0)}
function disposeScene(){if(!scene)return;if(scene.userData.envRT)scene.userData.envRT.dispose();scene.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep)o.geometry.dispose();if(o.material){for(const m of[].concat(o.material)){if(!m.userData.keep)m.dispose()}}});scene=null;world=null;stationObjs=[]}
function buildScene(map){disposeScene();const env=map.env;scene=new T.Scene();makeRoad(env);
 scene.fog=new T.Fog(new T.Color(env.skyHorizon).lerp(new T.Color(env.skyTop),env.night?.3:.08),env.fog[0],env.fog[1]);
 renderer.toneMappingExposure=env.exposure;
 const sky=buildSky(env);skyObj=sky.sky;scene.add(skyObj);
 const envScene=new T.Scene();envScene.add(new T.Mesh(new T.SphereGeometry(100,32,16),sky.sky.material));const groundEnv=new T.Mesh(new T.CircleGeometry(90,24).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(env.ground).lerp(new T.Color('#77746c'),.7).multiplyScalar(env.night?.15:.55)}));groundEnv.position.y=-5;envScene.add(groundEnv);
 if(env.night){for(let i=0;i<14;i++){const l=new T.Mesh(new T.PlaneGeometry(14,3),new T.MeshBasicMaterial({color:['#ff3fb4','#38f3ff','#ffd06b','#9a6bff'][i%4],side:T.DoubleSide}));const a=i/14*Math.PI*2;l.position.set(Math.cos(a)*60,10+i%3*6,Math.sin(a)*60);l.lookAt(0,10,0);envScene.add(l)}}
 const envRT=pmrem.fromScene(envScene,.03);scene.environment=envRT.texture;scene.userData.envRT=envRT;
 mountains=buildMountains(env);scene.add(mountains);
 hemiLight=new T.HemisphereLight(env.hemiSky,env.hemiGround,env.hemiInt);scene.add(hemiLight);
 sunLight=new T.DirectionalLight(env.sunColor,env.sunInt);sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);const sc=sunLight.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=1;sc.far=400;sunLight.shadow.bias=-.0004;sunLight.shadow.normalBias=.03;scene.add(sunLight);scene.add(sunLight.target);sunLight.userData.dir=sky.sunDir;
 world=new World(env);scene.add(world.group);
 effects.init();
 const coinGeo=keepGeo('coin',()=>{const g=mergeGeos([cyl(.42,.42,.09,20,0,0,0,Math.PI/2),cyl(.3,.3,.11,14,0,0,0,Math.PI/2)]);return g});coinMesh=new T.InstancedMesh(coinGeo,new T.MeshStandardMaterial({color:'#ffc93c',metalness:1,roughness:.22,emissive:'#7a4d00',emissiveIntensity:env.night?.9:.25}),160);coinMesh.castShadow=true;coinMesh.frustumCulled=false;coinMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(coinMesh);
 if(env.night||env.dusk){headSpot=new T.SpotLight('#fff1d6',env.night?260:120,140,.42,.55,1.6);scene.add(headSpot);scene.add(headSpot.target)}else headSpot=null
 if(renderPass)renderPass.scene=scene;if(bloomPass){bloomPass.strength=env.night?.42:env.dusk?.3:.16;bloomPass.threshold=env.night?1.05:1.1;bloomPass.radius=env.night?.42:.35}}

// ---------------------------------------------------------------- run lifecycle
function stopGame(){street?.dispose();street=null;startGame.token=null;if(run){run.active=false;cancelAnimationFrame(run.raf)}const ld=canvas.parentElement.querySelector('.drive-loading');if(ld)ld.hidden=true;for(const key in keys)keys[key]=false;for(const key in stationKeys)stationKeys[key]=false;audio.stop()}
window.stopHighwayGame=stopGame;
function applyPlayerUpgrades(){const p=run.player,c=run.car,u=run.upgradeStats,dp=diffParams();run.diff=dp;p.setPerformance(c.top*(1+u.top),c.accel*(1+u.accel),c.brake*(1+u.brake),c.steer*(1+u.steer));p.gripBonus=u.steer*.6;
 p.assist={steerRate:dp.steerRate,steerRange:dp.steerRange,grip:dp.grip,offGrip:dp.offGrip,tc:dp.tc,abs:dp.abs,esc:dp.esc,steer:dp.assist};if(c.drift){p.assist.tc=false;p.assist.esc=0;p.assist.steer=false}}
function startGame(){stopGame();window.showArcadeScreen('highway');if(!initRenderer())return;
 const stage=canvas.parentElement;let loading=stage.querySelector('.drive-loading');if(!loading){loading=document.createElement('div');loading.className='drive-loading';loading.innerHTML='<b>WARMING UP ENGINE…</b><small>Building the 3D world</small>';stage.appendChild(loading)}loading.hidden=false;
 // car models stream in first (detailed model for the player, light versions for traffic), then the world is built
 const token={};startGame.token=token;const car=playerCar(),label=loading.querySelector('small');label.textContent='Loading cars and people…';
 const needed=[...(car.model?[loadCarModel(car.model,false)]:[]),...Object.keys(MODEL_SPECS).map(id=>loadCarModel(id,true)),loadCharacters(gltfLoader)];
 Promise.all(needed).then(()=>{if(startGame.token!==token)return;label.textContent='Building the 3D world';setTimeout(()=>{if(startGame.token===token)buildRun(loading,token)},40)},err=>{console.error(err);if(startGame.token===token){loading.hidden=true;showFail('The car models could not load. Check your connection and reload.')}})}
function buildRun(loading,token){
 const car=playerCar(),map=currentMap();effects.clear&&scene&&effects.clear();buildScene(map);applyGfx(Math.max(0,GFX.indexOf(difficulty.gfx)));
 run={active:true,paused:false,over:false,crashing:false,car,map,elapsed:0,distanceMeters:0,passed:0,coinCount:0,last:0,raf:0,traffic:[],coins:[],pursuers:[],chase:null,race:null,pendingEvent:null,eventQueue:[],notice:null,nextCopMeters:driveMode==='fast'?150:1500,nextRaceMeters:driveMode==='fast'?300:3000,nextStationKm:3,stationOpen:false,stationStock:[],purchasedUpgrades:[],upgradeStats:upgradeStats(),crashAge:0,lane:2,coinS:START_S+40,coinLane:2,coinStartLane:2,coinTargetLane:null,coinSegmentIndex:0,spawnT:0,recoverT:0,fpsAcc:0,fpsN:0,quality:2};
 const p=new Vehicle(car,{kind:'player'});run.player=p;applyPlayerUpgrades();scene.add(p.mesh.group);p.place(START_S,laneD(2),0,80/3.6);
 Object.defineProperty(run,'health',{get:()=>run.player.health});Object.defineProperty(run,'maxHealth',{get:()=>run.player.maxHealth});
 street=new StreetLife({T,run,scene,camera,keys,camState,road,worldFromRoad,toRoad,groundY,stationS,stationObjs,Vehicle,cars,awardRoadCoins,addNotice,wallHit,effects,setCamera,applyPlayerUpgrades,beginCop,spawnPursuer,setDriveHud,world,roadAt});
 if(map.id==='drift')street.buildDrift();
 world.update(p.s);for(let i=0;i<12;i++)spawnTraffic(true);
 pauseVeil.hidden=true;gameoverVeil.hidden=true;$('gasStation').hidden=true;$('stationEntry').hidden=true;$('pauseDrive').textContent='Ⅱ Pause';
 camState.snap=true;camState.shake=0;setCamera(camState.mode);audio.start();
 if(driveMode==='chase'){beginCop(null);spawnPursuer('cop')}
 setDriveHud();updateCamera(0);
 // Compile every shader up front (in parallel where the GPU driver allows) so the first seconds don't stutter.
 run.paused=true;const thisRun=run;
 const go=()=>{if(run!==thisRun||!run.active||startGame.token!==token)return;loading.hidden=true;run.paused=false;run.last=0;run.raf=requestAnimationFrame(frame)};
 (renderer.compileAsync?renderer.compileAsync(scene,camera):Promise.resolve()).then(go,go)}
function awardRoadCoins(amount){const payout=Math.round(amount*(run?.map?.coinMultiplier||1)*(1+(run?.upgradeStats?.coins||0)));run.coinCount+=payout;window.arcadeWallet.earn(payout);garageCoins.textContent=wallet();return payout}
function trafficSpec(){const r=Math.random();if(r<.1)return Object.assign({},boxTruckSpec,{color:civColors[randomInt(civColors.length)]});const pool=['model3','model3','model3','cybertruck','porsche','porsche','urus','urus','ferrari','concept'];const pick=pool[randomInt(pool.length)],base=cars.find(c=>c.id===pick);return Object.assign({},base,{color:civColors[randomInt(civColors.length)],civilian:true})}
function laneFree(s,lane,gap){const d=laneD(lane);for(const v of allVehicles())if(Math.abs(v.d-d)<2.6&&Math.abs(v.s-s)<gap)return false;return true}
function allVehicles(){return run?[run.player,...run.traffic,...run.pursuers,...(street?.parked||[])]:[]}
function spawnTraffic(initial=false){const p=run.player,oncoming=Math.random()<.45;let lane,s,dir,speed;
 const sameCount=run.traffic.filter(v=>v.dir>0&&!v.wrecked).length,oppCount=run.traffic.length-sameCount;const dens=run.diff?run.diff.traffic:1,maxSame=Math.max(2,Math.round((run.chase?5:8)*dens)),maxOpp=Math.max(1,Math.round((run.chase?4:7)*dens));
 if(oncoming&&oppCount<maxOpp){lane=randomInt(2);dir=-1;s=p.s+(initial?rand(60,520):rand(430,560));speed=rand(80,118)/3.6}
 else if(!oncoming&&sameCount<maxSame){lane=2+randomInt(2);dir=1;const behind=!initial&&Math.random()<.18&&Math.abs(p.vx)<28;s=behind?p.s-rand(140,180):p.s+(initial?rand(40,420):rand(300,420));speed=behind?rand(110,135)/3.6:rand(72,108)/3.6}
 else return null;
 if(!laneFree(s,lane,28))return null;const spec=trafficSpec();const v=new Vehicle(spec,{kind:'traffic',civilian:!!spec.civilian});v.dir=dir;v.lane=lane;v.targetLane=lane;v.cruise=speed;v.laneT=rand(4,10);v.place(s,laneD(lane),dir>0?0:Math.PI,speed);v.prevRel=v.s-p.s;run.traffic.push(v);scene.add(v.mesh.group);return v}
function despawn(list,i){disposeVehicle(list[i]);list.splice(i,1)}
function steerTo(v,dTarget,lookMul=1,aim=null){const L=clamp(Math.abs(v.vx)*.8+6,8,40)*lookMul;let px,pz;if(aim){px=aim.x;pz=aim.z}else{const w=worldFromRoad(v.s+v.dir*L,dTarget);px=w.x;pz=w.z}const err=wrapAngle(Math.atan2(px-v.x,-(pz-v.z))-v.psi);const dd=Math.max(4,Math.hypot(px-v.x,pz-v.z));const delta=Math.atan(2*v.wb*Math.sin(err)/dd);v.input.steer=clamp(delta/Math.max(.01,v.steerMax(road.env.grip)),-1,1)*(v.vx<0?-1:1)}
function speedTo(v,target){const e=target-v.vx;v.input.throttle=clamp(e*.35,0,1);v.input.brake=clamp(-e*.22,0,1);v.input.reverse=0;v.input.handbrake=0}
function aheadOf(v,lanes){let best=null,bd=Infinity;for(const o of allVehicles()){if(o===v)continue;const rel=(o.s-v.s)*v.dir;if(rel<=0||rel>80)continue;if(Math.abs(o.d-laneD(lanes))>2.3&&Math.abs(o.d-v.d)>2.3)continue;if(rel<bd){bd=rel;best=o}}return best?{v:best,dist:bd}:null}
function aiTraffic(v,dt){if(v.wrecked){v.input.throttle=0;v.input.brake=.4;v.input.steer=0;return}if(v.stun>0){v.stun-=dt;v.input.throttle=0;v.input.brake=.5;v.input.steer*=.9;return}
 let target=v.cruise,dodge=0;const ah=aheadOf(v,v.targetLane);if(ah){const gap=ah.dist-(v.L+ah.v.L)/2,safe=7+Math.abs(v.vx)*1.15,os=ah.v.vAlong*v.dir;if(gap<safe)target=Math.min(target,Math.max(0,os-(safe-gap)*.45));if(gap<4)target=0;
  // emergency: something is closing fast in our path (e.g. a car on the wrong side) — brake hard and swerve away from it
  const closing=v.vx-os;if(closing>4&&gap/closing<2.4){target=0;dodge=(v.d>=ah.v.d?1:-1)*2.4}
  v.laneT-=dt;if(gap<safe+18&&os<v.cruise-3&&v.laneT<=0&&!(ah.v.isPlayer&&Math.random()<.5)){const other=v.dir>0?(v.targetLane===2?3:2):(v.targetLane===0?1:0);if(laneFree(v.s+v.dir*8,other,22)){v.targetLane=other;v.laneT=rand(6,12)}}}
 if(v.event==='cop'&&run.chase==null)target=Math.min(target,24);
 const dT=dodge?clamp(laneD(v.targetLane)+dodge,v.dir>0?.6:-EDGE+.8,v.dir>0?EDGE-.8:-.6):laneD(v.targetLane);steerTo(v,dT,dodge?.6:1);speedTo(v,target)}
function spawnPursuer(kind,atS=null){const p=run.player,model=pursuitVehicles[kind];const roles=['rammer','flanker','blocker','rammer'];const used=run.pursuers.map(q=>q.personality);const personality=kind==='gunmen'?'gunner':roles.find(r=>!used.includes(r))||roles[randomInt(roles.length)];
 let lane=2+randomInt(2),s=atS!==null?atS:p.s-rand(110,150);for(let k=0;k<4&&!laneFree(s,lane,14);k++){lane=lane===2?3:2;s-=12}
 const v=new Vehicle(model,{kind:'pursuer'});if(run.diff)v.setPerformance(model.top*run.diff.cop,model.accel*run.diff.cop,model.brake,model.steer);v.kind=kind;v.role='pursuer';v.personality=personality;v.side=Math.random()<.5?-1:1;v.fireT=1.2;v.dir=1;v.place(s,laneD(lane),0,Math.max(15,p.vAlong+6));run.pursuers.push(v);scene.add(v.mesh.group);return v}
function beginCop(fromVehicle){if(!run||run.chase||run.race)return;run.chase={age:0,copTimer:12,armored:false,gunmen:false};run.pendingEvent=null;
 if(fromVehicle){const i=run.traffic.indexOf(fromVehicle);if(i>=0)run.traffic.splice(i,1);fromVehicle.kind='cop';fromVehicle.role='pursuer';fromVehicle.personality='rammer';fromVehicle.side=1;fromVehicle.fireT=0;fromVehicle.stun=0;fromVehicle.setPerformance(pursuitVehicles.cop.top,pursuitVehicles.cop.accel,pursuitVehicles.cop.brake,pursuitVehicles.cop.steer);run.pursuers.push(fromVehicle)}
 addNotice('🚨 PURSUIT! Officers are moving in to box you in — shake them or take them out!',true,5)}
function aiPursuer(v,dt){const p=run.player;if(v.wrecked){v.input.throttle=0;v.input.brake=.5;v.input.steer=0;return}if(v.stun>0){v.stun-=dt;v.input.throttle=0;v.input.brake=.3;return}
 const rel=p.s-v.s,pv=p.vAlong;let dT=p.d,target=v.vtop,aim=null;
 switch(v.personality){
  case'rammer':if(rel<26&&rel>-4)aim={x:p.x+Math.sin(p.psi)*p.vx*.25,z:p.z-Math.cos(p.psi)*p.vx*.25};target=rel>14?v.vtop:pv+7;break;
  case'flanker':if(rel>7){dT=p.d+v.side*2.6;target=v.vtop}else{dT=p.d+v.side*.6;target=pv+(rel>0?4:-1)}break;
  case'blocker':if(rel>-14){dT=p.d+(p.d>0?-3.7:3.7);target=v.vtop}else{dT=p.d;target=Math.max(5,pv-6)}break;
  case'gunner':dT=p.d+v.side*3.4;target=rel>24?v.vtop:pv+(rel-18)*.5;break}
 dT=clamp(dT,-ROAD_HALF+1,ROAD_HALF-1);
 const ah=aheadOf(v,clamp(Math.round(dT/LANE_W+1.5),0,3));if(ah&&!ah.v.isPlayer&&ah.dist<25&&!aim){dT+=dT>0?-3.7:3.7}
 v.nitro=rel>70?1.7:rel>35?1.25:1;
 steerTo(v,dT,1,aim);speedTo(v,Math.min(target,v.vtop*1.2));
 if(v.personality==='gunner'){v.fireT-=dt;const dd=Math.sqrt(dist2(v,p));if(v.fireT<=0&&dd<75&&dd>8&&!p.wrecked){v.fireT=1.3;fireShot(v,p)}}}
function fireShot(from,to){const sx=from.x,sz=from.z,sy=from.y+2.1,lead=.12,tx=to.x+Math.sin(to.psi)*to.vx*lead+rand(-.8,.8),tz=to.z-Math.cos(to.psi)*to.vx*lead+rand(-.8,.8),ty=to.y+.8;const dir=new T.Vector3(tx-sx,ty-sy,tz-sz).normalize();const speed=160;const mesh=new T.Mesh(keepGeo('tracer',()=>new T.BoxGeometry(.06,.06,2.2)),keepMat('tracer',()=>new T.MeshBasicMaterial({color:'#ffe08a'})));mesh.position.set(sx,sy,sz);mesh.lookAt(tx,ty,tz);scene.add(mesh);effects.tracers.push({mesh,p:new T.Vector3(sx,sy,sz),v:dir.multiplyScalar(speed),age:0});for(let i=0;i<4;i++)effects.sparks.spawn(sx,sy,sz,rand(-1,1),rand(0,1),rand(-1,1),.08,.35,0,1,.85,.5,1,0,0);audio.shot();
 const hit=Math.random()<.55;if(hit)setTimeout(()=>{if(!run||run.player!==to||to.wrecked||run.paused)return;const o=to.obb();if(Math.hypot(to.x-tx,to.z-tz)<4){const sideHit=(sx-to.x)*o.rx+(sz-to.z)*o.rz>0?'right':'left';const dmg=11*(1-clamp(run.upgradeStats.armor,0,.8));to.health-=dmg;to.dmg[sideHit]=Math.min(1,to.dmg[sideHit]+.02);effects.impact(to.x+o.rx*(sideHit==='right'?1:-1)*to.W/2,to.y+.9,to.z+o.rz*(sideHit==='right'?1:-1)*to.W/2,2,to,null);camState.shake=Math.min(1,camState.shake+.25);addNotice('UNDER FIRE — bullets hitting the '+sideHit+' side!',true,1.5);if(to.health<=0&&!to.wrecked)wreck(to)}},Math.hypot(tx-sx,tz-sz)/speed*1000)}
const matCache=new Map();function keepMat(k,fn){let m=matCache.get(k);if(!m){m=fn();m.userData.keep=true;matCache.set(k,m)}return m}
function updatePursuit(dt){if(!run.chase)return;const ch=run.chase,p=run.player;ch.age+=dt;ch.copTimer-=dt;
 if(ch.copTimer<=0&&run.pursuers.filter(v=>!v.wrecked).length<6){spawnPursuer('cop');ch.copTimer=12*(run.diff?run.diff.copEvery:1)}
 if(ch.age>=25&&!ch.armored){spawnPursuer('armored');ch.armored=true;addNotice('ARMORED TRUCK JOINED THE PURSUIT',true,3)}
 if(ch.age>=45&&!ch.gunmen){spawnPursuer('gunmen');ch.gunmen=true;addNotice('GUNMEN TRUCK — they are armed!',true,3)}
 for(let i=run.pursuers.length-1;i>=0;i--){const v=run.pursuers[i];if(v.s<p.s-420||(v.wrecked&&v.s<p.s-160)){if(!v.wrecked)addNotice('You lost a pursuer!',false,2);despawn(run.pursuers,i)}}
 if(!run.pursuers.some(v=>!v.wrecked)&&ch.age>3){run.chase=null;for(let i=run.pursuers.length-1;i>=0;i--)if(run.pursuers[i].wrecked){run.traffic.push(run.pursuers[i]);run.pursuers.splice(i,1)}addNotice('PURSUIT ESCAPED! +30 coins',false,4);awardRoadCoins(30)}}
function scheduleEvent(type){if(!run)return;if(run.pendingEvent===type||(type==='cop'&&run.chase)||(type==='racer'&&(run.chase||run.race))||run.eventQueue.includes(type))return;run.eventQueue.push(type);dispatchSpecial()}
function dispatchSpecial(){if(!run||run.over||run.crashing||run.chase||run.race||run.pendingEvent)return;const type=run.eventQueue.shift();if(!type)return;const p=run.player;const lane=2+randomInt(2),s=p.s+rand(230,280);if(!laneFree(s,lane,30)){run.eventQueue.unshift(type);return}
 const spec=type==='cop'?pursuitVehicles.cop:(()=>{const road=cars.filter(c=>c.model);return Object.assign({},road[randomInt(road.length)])})();const v=new Vehicle(spec,{kind:'traffic'});v.dir=1;v.lane=lane;v.targetLane=lane;v.cruise=type==='cop'?24:26;v.laneT=99;v.event=type;v.place(s,laneD(lane),0,v.cruise);v.prevRel=v.s-p.s;run.traffic.push(v);scene.add(v.mesh.group);run.pendingEvent=type;
 addNotice(type==='cop'?'POLICE CRUISER AHEAD — pass it and it will come after you!':'RIVAL RACER AHEAD — pass them to start a 30-second race!',type==='cop',5)}
function beginRace(v){if(run.race||run.chase)return;v.event='racing';v.cruise=Math.min(v.vtop,run.player.vtop*.9);v.laneT=0;run.race={rival:v,remaining:30};addNotice(`RIVAL CHALLENGE! ${v.spec.name} — stay ahead for 30 seconds!`,false,4)}
function updateRace(dt){const r=run.race;if(!r)return;r.remaining-=dt;r.playerDistance=run.player.s;r.aiDistance=r.rival.s;const rv=r.rival;if(!rv.wrecked&&rv.stun<=0){rv.cruise=Math.min(rv.vtop,run.player.vtop*.9);rv.laneT=Math.min(rv.laneT,1.5)}
 if(r.remaining<=0||rv.wrecked){const won=rv.wrecked||run.player.s>=rv.s;run.race=null;rv.event='';rv.cruise=rand(80,105)/3.6;if(won)awardRoadCoins(50);addNotice(won?'RACE WON! +50 coins':'Rival won — try again at the next race.',false,4)}}
function nextCoinLane(){if(run.coinTargetLane===null){run.coinStartLane=run.coinLane;const options=[run.coinLane-1,run.coinLane+1].filter(l=>l>=0&&l<=3);run.coinTargetLane=options[randomInt(options.length)];run.coinSegmentIndex=0}const index=run.coinSegmentIndex++,lane=index<3?run.coinStartLane+(run.coinTargetLane-run.coinStartLane)*(index+1)/3:run.coinTargetLane;run.coinLane=lane;if(run.coinSegmentIndex>=11){run.coinLane=run.coinTargetLane;run.coinStartLane=run.coinLane;run.coinTargetLane=null;run.coinSegmentIndex=0}return lane}
function updateCoins(dt){const p=run.player;while(run.coinS<p.s+320){const lane=nextCoinLane(),d=laneD(lane),w=worldFromRoad(run.coinS,d);run.coins.push({s:run.coinS,d,x:w.x,y:w.y+.75,z:w.z,spin:Math.random()*6});run.coinS+=13}
 const mag=run.upgradeStats.magnet/40;for(let i=run.coins.length-1;i>=0;i--){const c=run.coins[i];if(c.s<p.s-30){run.coins.splice(i,1);continue}if(!p.wrecked&&Math.abs(c.s-p.s)<p.L/2+.8+mag&&Math.abs(c.d-p.d)<p.W/2+.6+mag){awardRoadCoins(1);audio.coin();for(let k=0;k<6;k++)effects.sparks.spawn(c.x,c.y,c.z,rand(-1.5,1.5),rand(.5,2.5),rand(-1.5,1.5),.4,.18,0,1,.85,.3,1,3,1);run.coins.splice(i,1)}}
 const t=run.elapsed;let n=0;for(const c of run.coins){if(n>=160)break;if(camState.mode===5||camState.mode===6){tmpQ.setFromEuler(new T.Euler(-Math.PI/2,0,c.spin+t*2))}else tmpQ.setFromAxisAngle(UP,c.spin+t*3);tmpM.compose(tmpV.set(c.x,c.y+Math.sin(t*3+c.s)*.08,c.z),tmpQ,tmpS.set(camState.mode===5||camState.mode===6?1.6:1,camState.mode===5||camState.mode===6?1.6:1,1));coinMesh.setMatrixAt(n++,tmpM)}coinMesh.count=n;coinMesh.instanceMatrix.needsUpdate=true}
function updateStations(){const p=run.player;const next=run.nextStationKm;
 for(let i=stationObjs.length-1;i>=0;i--){const o=stationObjs[i];if(stationS(o.userData.km)<p.s-300){scene.remove(o);o.traverse(m=>{if(m.geometry&&!m.geometry.userData.keep)m.geometry.dispose()});stationObjs.splice(i,1)}}
 for(const km of[next,next+3]){const s=stationS(km);if(s-p.s<800&&s-p.s>-200&&!stationObjs.some(o=>o.userData.km===km)){const g=buildGasStation(km);scene.add(g);stationObjs.push(g)}}
 const remaining=next*1000-run.distanceMeters;if(remaining<=300&&remaining>0&&run.stationPromptKm!==next){run.stationPromptKm=next;if(!isPolicePursuit())addNotice('GAS EXIT IN 300 m — far-right lane, press E (repairs + upgrades)',false,5)}}
function finishCrash(){if(run.crashing||run.over)return;run.crashing=true;run.crashAge=0;addNotice('TOTALED!',true,3);setDriveHud()}
function recoverCar(){if(street?.onFoot){street.rescue();return}const p=run.player;if(!run||p.wrecked||run.recoverT>0)return;if(Math.abs(p.vx)>6&&Math.abs(p.d)<EDGE){addNotice('Slow down to call a tow (R).',false,2);return}run.recoverT=4;const lane=p.d<0&&!isPolicePursuit()?2:clamp(Math.round(p.d/LANE_W+1.5),2,3);p.place(p.s+2,laneD(lane),0,0);p.upsetRoll=p.upsetV=0;p.ghost=2;addNotice('Towed back onto the road.',false,2)}
function update(dt){const p=run.player;run.elapsed+=dt;if(run.recoverT>0)run.recoverT-=dt;
 // player input: digital keys ramp like a real steering rack, slower at speed
 const steerKey=(keys.right?1:0)-(keys.left?1:0),v=Math.abs(p.vx),rate=(steerKey===0||steerKey*p.steerIn<0?6/(1+v/50):3.4/(1+v/32))*p.assist.steerRate;p.steerIn+=clamp(steerKey-p.steerIn,-rate*dt,rate*dt);
 if(!p.wrecked){p.input.steer=p.steerIn;p.input.handbrake=keys.handbrake?1:0;if(p.vx<-.5&&keys.gas){p.input.brake=1;p.input.throttle=0;p.input.reverse=0}else if(keys.brake&&p.vx<.6){p.input.reverse=1;p.input.brake=0;p.input.throttle=0}else{p.input.throttle=keys.gas?1:0;p.input.brake=keys.brake?1:0;p.input.reverse=0}}else{p.input.throttle=0;p.input.brake=.3;p.input.reverse=0;p.input.steer*=.98}
 if(street?.fuel<=0)p.input.throttle=0;
 if(street?.onFoot||p.submerged){p.input={steer:0,throttle:0,brake:1,reverse:0,handbrake:1}}
 if(p.boostT>0)p.boostT-=dt;
 for(const t of run.traffic){aiTraffic(t,dt);street?.yieldTo(t)}for(const c of run.pursuers)aiPursuer(c,dt);
 const vehicles=allVehicles();const sub=Math.max(2,Math.ceil(dt/.0055)),h=dt/sub;
 for(let k=0;k<sub;k++){for(const veh of vehicles){veh.step(h)}for(const veh of vehicles)veh.syncRoad();for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++)collidePair(vehicles[i],vehicles[j]);for(const veh of vehicles){staticCollisions(veh);street?.collide(veh)}}
 for(const veh of vehicles){veh.updateGear(dt);if(veh.ghost>0)veh.ghost-=dt;veh.syncMesh(dt);vehicleFx(veh,dt)}
 run.lane=p.d/LANE_W+1.5;run.distanceMeters=Math.max(run.distanceMeters,p.s-START_S);
 // traffic bookkeeping
 run.spawnT-=dt;if(run.spawnT<=0){spawnTraffic();run.spawnT=(run.chase?1.4:.7)*(run.diff?run.diff.spawn:1)}
 for(let i=run.traffic.length-1;i>=0;i--){const t=run.traffic[i],rel=t.s-p.s;if(t.prevRel>0&&rel<-2&&!t.counted){t.counted=true;run.passed++;if(t.event==='cop'){beginCop(t);continue}if(t.event==='racer'){run.pendingEvent=null;beginRace(t)}}t.prevRel=rel;if(t.event==='cop'&&(t.stun>0||t.health<t.maxHealth)&&!run.chase){beginCop(t);continue}if(rel<-220||rel>700||(t.dir<0&&rel<-140)){if(t.event==='cop'||t.event==='racer')run.pendingEvent=null;if(run.race&&run.race.rival===t)run.race=null;despawn(run.traffic,i)}}
 if(run.distanceMeters>=run.nextCopMeters){scheduleEvent('cop');run.nextCopMeters+=driveMode==='fast'?150:1500}
 if(run.distanceMeters>=run.nextRaceMeters){scheduleEvent('racer');run.nextRaceMeters+=driveMode==='fast'?300:3000}
 if(run.map.id!=='drift'){dispatchSpecial();updatePursuit(dt);updateRace(dt)}updateCoins(dt);updateStations();street?.update(dt);
 if(run.distanceMeters>=run.nextStationKm*1000){processGasStation(run.nextStationKm);run.nextStationKm+=3}
 if(street?.onFoot){run.crashing=false;run.over=false}
 if(run.crashing){run.crashAge+=dt;if(run.crashAge>=3.2){run.crashing=false;run.over=true;gameoverVeil.hidden=false;pauseVeil.hidden=true}}
 effects.update(dt);world.update(street?.onFoot?street.actor.s:p.s);
 let nearCop=Infinity;for(const c of run.pursuers)if(c.kind==='cop'&&!c.wrecked)nearCop=Math.min(nearCop,Math.sqrt(dist2(c,p)));audio.update(p,street?.onFoot?0:p.input.throttle,nearCop);
 setDriveHud()}
function vehicleFx(v,dt){const fx=Math.sin(v.psi),fz=-Math.cos(v.psi),rx=Math.cos(v.psi),rz=Math.sin(v.psi),spd=Math.abs(v.vx);
 // skid marks & tyre smoke
 const skidding=spd>3&&(v.slip>.14||v.locked||v.wheelspin)&&Math.abs(v.d)<EDGE+.4;const off=Math.abs(v.d)>EDGE+.4&&spd>4;
 v.mesh.wheels.forEach((w,i)=>{const wx=v.x+fx*w.x+rx*w.z,wz=v.z+fz*w.x+rz*w.z;const rear=!w.front;const active=skidding&&(rear?(v.slipR||v.wheelspin||v.slip>.2):(v.slipF||v.locked));if(active){const last=v.skidPts[i],y=probeGround(wx,wz)+.02;if(last&&Math.hypot(wx-last[0],wz-last[2])>.25){effects.skids.add(last[0],last[1],last[2],wx,y,wz,v.mesh.data.wid);v.skidPts[i]=[wx,y,wz]}else if(!last)v.skidPts[i]=[wx,y,wz];if(Math.random()<dt*(18+spd))effects.smoke.spawn(wx,y+.2,wz,rand(-.6,.6)+v.vx*fx*.1,rand(.3,.9),rand(-.6,.6)+v.vx*fz*.1,rand(1,2.2),.6,3.2,.82,.82,.84,.32,-.2,.8)}else v.skidPts[i]=null;
  if(off&&rear&&Math.random()<dt*spd*.8){const col=road.env.props==='alpine'?[.95,.97,1]:road.env.props==='desert'?[.82,.64,.45]:[.48,.42,.32];effects.smoke.spawn(wx,probeGround(wx,wz)+.2,wz,-fx*spd*.15+rand(-1,1),rand(.5,1.5),-fz*spd*.15+rand(-1,1),rand(.8,1.6),.5,2.4,col[0],col[1],col[2],.45,-.1,1)}});
 // damage smoke / fire from the engine bay
 const hp=v.health/v.maxHealth;if(hp<.5||v.wrecked){v.smokeT-=dt;if(v.smokeT<=0){v.smokeT=hp<.2||v.wrecked?.03:.09;const ex=v.x+fx*v.L*.32,ez=v.z+fz*v.L*.32,dark=hp<.25||v.wrecked?.18:.55;effects.smoke.spawn(ex,v.y+1.0,ez,rand(-.3,.3)-v.vx*fx*.3,rand(1,2),rand(-.3,.3)-v.vx*fz*.3,rand(1.5,3),.8,4,dark,dark,dark,.55,-.4,.6);if(hp<.12||v.wrecked)for(let i=0;i<2;i++)effects.sparks.spawn(ex+rand(-.3,.3),v.y+.9,ez+rand(-.3,.3),rand(-.3,.3),rand(1,2.5),rand(-.3,.3),rand(.3,.6),.6,-.3,1,.45+Math.random()*.3,.1,.9,-1,.5)}}
 if(v.isPlayer&&v.boostT>1.6&&run.upgradeStats.recovery>0)effects.sparks.spawn(v.x-fx*v.L/2,v.y+.35,v.z-fz*v.L/2,-fx*3,0,-fz*3,.2,.3,0,.4,.7,1,1,0,1)}
function drawGlows(){const gl=effects.glow;gl.begin();const env=road.env,night=env.night||env.dusk,t=run.elapsed;
 for(const v of allVehicles()){if(v.wrecked&&v!==run.player)continue;const m=v.mesh.group.matrixWorld,d=v.mesh.data;const braking=v.input.brake>0&&v.vx>.5;
  if(night&&!v.wrecked)for(const h of d.head){tmpV.set(h[0],h[1],h[2]).applyMatrix4(m);gl.add(tmpV.x,tmpV.y,tmpV.z,env.night?1.6:1.1,1,.93,.78,env.night?1:.7)}
  if(night||braking)for(const tl of d.tail){tmpV.set(tl[0],tl[1],tl[2]).applyMatrix4(m);gl.add(tmpV.x,tmpV.y,tmpV.z,night?(braking?1.3:.7):.5,1,.12,.08,night?(braking?1:.6):.45)}
  if(d.police.length&&(v.role==='pursuer'||v.event==='cop')){const on=v.role==='pursuer';for(const pl of d.police){const phase=Math.floor(t*(on?9:2))%2===pl[3];if(v.mesh.mats.pRed){v.mesh.mats.pRed.color.set(on&&Math.floor(t*9)%2===0?0xff2a2a:0x401010);v.mesh.mats.pBlue.color.set(on&&Math.floor(t*9)%2===1?0x3a7bff:0x101a40)}if(on&&phase){tmpV.set(pl[0],pl[1],pl[2]).applyMatrix4(m);gl.add(tmpV.x,tmpV.y,tmpV.z,3.2,pl[3]?.2:1,pl[3]?.45:.15,pl[3]?1:.15,1)}}}}
 if(env.props==='city'&&world){for(const seg of world.segs)for(const l of seg.lamps||[])gl.add(l[0],l[1],l[2],4,1,.85,.6,.85)}
 gl.end()}
function setDriveHud(){if(!run)return;street?.hud();updateStationEntry();const p=run.player;speedReadout.textContent=String(Math.round(Math.abs(p.vx)*3.6));runCoinsReadout.textContent=String(run.coinCount);carsReadout.textContent=String(run.passed);$('driveDistance').textContent=(run.distanceMeters/1000).toFixed(2);healthText.textContent=`${Math.max(0,Math.ceil(p.health))} / ${p.maxHealth}`;const hp=p.health/p.maxHealth;healthBar.style.width=`${clamp(hp*100,0,100)}%`;healthBar.style.background=hp<.3?'#f0524b':hp<.6?'#f1b94c':'linear-gradient(90deg,#52d686,#b8e86d)';
 if(run.race){raceClock.textContent=Math.ceil(run.race.remaining);raceLabel.textContent=p.s>=run.race.rival.s?'YOU LEAD':'BEHIND'}else if(run.chase){raceClock.textContent=String(run.pursuers.filter(v=>!v.wrecked).length);raceLabel.textContent='PURSUIT'}else{raceClock.textContent='—';raceLabel.textContent='RACE'}
 if(run.race){const gap=Math.round(p.s-run.race.rival.s);eventBox.textContent=`RACE · ${Math.ceil(run.race.remaining)}s · ${gap>=0?'AHEAD BY '+gap+' m':'BEHIND BY '+(-gap)+' m'}`;eventBox.classList.add('show');eventBox.classList.toggle('alert',gap<0)}
 else if(run.notice&&run.notice.until>run.elapsed){eventBox.textContent=run.notice.text;eventBox.classList.add('show');eventBox.classList.toggle('alert',run.notice.alert)}
 else if(run.chase){const cops=run.pursuers.filter(v=>v.kind==='cop'&&!v.wrecked).length,arm=run.pursuers.filter(v=>v.kind==='armored'&&!v.wrecked).length,gun=run.pursuers.filter(v=>v.kind==='gunmen'&&!v.wrecked).length;eventBox.textContent=`🚨 PURSUIT · ${cops} COPS · ${arm} ARMORED · ${gun} GUN TRUCKS`;eventBox.classList.add('show','alert')}
 else eventBox.classList.remove('show','alert')}

// ---------------------------------------------------------------- 2D overlay: gauges, damage diagram, radar
let overlayDpr=1;
function drawOverlay(){const w=overlay.width/overlayDpr,h=overlay.height/overlayDpr,g=octx;g.clearRect(0,0,w,h);if(!run)return;if(street?.onFoot){street.drawOverlay(g,w,h);return}const p=run.player,sc=clamp(w/900,.6,1.15);
 // speedometer + tachometer
 const R=70*sc,cx=w-R-18*sc,cy=h-R-14*sc,spd=Math.abs(p.vx)*3.6,maxS=Math.max(240,Math.ceil(p.topKmh/40)*40),a0=Math.PI*.75,a1=Math.PI*2.25;
 g.save();g.fillStyle='rgba(8,12,18,.72)';g.beginPath();g.arc(cx,cy,R+8*sc,0,7);g.fill();g.lineWidth=7*sc;g.strokeStyle='rgba(255,255,255,.1)';g.beginPath();g.arc(cx,cy,R-6*sc,a0,a1);g.stroke();
 const rpmF=clamp(p.rpm/(p.electric?16000:8000),0,1);g.strokeStyle=p.electric?'#6fd8ff':p.rpm>6600?'#ff5b4f':'#f2bf5e';g.beginPath();g.arc(cx,cy,R-6*sc,a0,a0+(a1-a0)*rpmF);g.stroke();
 g.fillStyle='#cdd6de';g.font=`700 ${9*sc}px system-ui`;g.textAlign='center';g.textBaseline='middle';for(let v=0;v<=maxS;v+=40){const a=a0+(a1-a0)*v/maxS;g.fillText(String(v),cx+Math.cos(a)*(R-22*sc),cy+Math.sin(a)*(R-22*sc));g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1.5;g.beginPath();g.moveTo(cx+Math.cos(a)*(R+1*sc),cy+Math.sin(a)*(R+1*sc));g.lineTo(cx+Math.cos(a)*(R-3*sc),cy+Math.sin(a)*(R-3*sc));g.stroke()}
 const na=a0+(a1-a0)*clamp(spd/maxS,0,1);g.strokeStyle='#ff4f45';g.lineWidth=3*sc;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(na)*(R-12*sc),cy+Math.sin(na)*(R-12*sc));g.stroke();g.fillStyle='#ff4f45';g.beginPath();g.arc(cx,cy,5*sc,0,7);g.fill();
 g.fillStyle='#fff';g.font=`900 ${22*sc}px ui-monospace,Consolas,monospace`;g.fillText(String(Math.round(spd)),cx,cy+R*.42);g.font=`800 ${8*sc}px system-ui`;g.fillStyle='#93a2af';g.fillText('KM/H',cx,cy+R*.62);
 g.font=`900 ${15*sc}px ui-monospace,Consolas,monospace`;g.fillStyle=p.shift>0?'#f2bf5e':'#9fe8b9';g.fillText(p.gear<0?'R':p.vx<.3&&p.input.throttle===0?(p.electric?'P':'N'):p.electric?'D':String(p.gear),cx,cy-R*.36);g.restore();
 // damage diagram (top view)
 const dw=56*sc,dh=104*sc,dx=18*sc,dy=h-dh-28*sc;g.save();g.fillStyle='rgba(8,12,18,.72)';g.beginPath();g.roundRect(dx-10*sc,dy-22*sc,dw+20*sc,dh+44*sc,10*sc);g.fill();g.fillStyle='#b8c4cf';g.font=`800 ${8*sc}px system-ui`;g.textAlign='center';g.fillText('DAMAGE',dx+dw/2,dy-10*sc);
 const col=v=>v<.25?'#52d686':v<.55?'#f1b94c':'#f0524b';const D=p.dmg;g.fillStyle='#2a333d';g.beginPath();g.roundRect(dx,dy,dw,dh,12*sc);g.fill();
 g.fillStyle=col(D.front);g.beginPath();g.roundRect(dx+4*sc,dy+3*sc,dw-8*sc,dh*.2,8*sc);g.fill();g.fillStyle=col(D.rear);g.beginPath();g.roundRect(dx+4*sc,dy+dh*.8-3*sc,dw-8*sc,dh*.2,8*sc);g.fill();g.fillStyle=col(D.left);g.fillRect(dx+3*sc,dy+dh*.26,8*sc,dh*.48);g.fillStyle=col(D.right);g.fillRect(dx+dw-11*sc,dy+dh*.26,8*sc,dh*.48);g.fillStyle='#14202b';g.beginPath();g.roundRect(dx+14*sc,dy+dh*.3,dw-28*sc,dh*.4,5*sc);g.fill();
 const pull=(D.right-D.left);g.font=`800 ${7.5*sc}px system-ui`;g.fillStyle=Math.abs(pull)>.08?'#ffb36b':'#7f8f9c';g.fillText(Math.abs(pull)>.08?(pull<0?'◀ PULLS LEFT':'PULLS RIGHT ▶'):'ALIGNED',dx+dw/2,dy+dh+12*sc);g.restore();
 // radar
 const rr=58*sc,rx=w-rr-22*sc,ry=rr+16*sc,range=160;g.save();g.fillStyle='rgba(8,12,18,.62)';g.beginPath();g.arc(rx,ry,rr,0,7);g.fill();g.strokeStyle='rgba(255,255,255,.15)';g.beginPath();g.arc(rx,ry,rr*.5,0,7);g.stroke();g.beginPath();g.arc(rx,ry,rr,0,7);g.clip();
 const fx=Math.sin(p.psi),fz=-Math.cos(p.psi),qx=Math.cos(p.psi),qz=Math.sin(p.psi),k=rr/range;
 const t=roadAt(p.s);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=ROAD_HALF*2*k;g.beginPath();for(let s=-range;s<=range;s+=10){const w2=worldFromRoad(p.s+s,0),ddx=w2.x-p.x,ddz=w2.z-p.z,px=rx+(ddx*qx+ddz*qz)*k,py=ry-(ddx*fx+ddz*fz)*k;s===-range?g.moveTo(px,py):g.lineTo(px,py)}g.stroke();
 for(const v of allVehicles()){if(v===p)continue;const ddx=v.x-p.x,ddz=v.z-p.z,px=rx+(ddx*qx+ddz*qz)*k,py=ry-(ddx*fx+ddz*fz)*k;let c=v.dir<0?'#e0a35a':'#c8d1d9';if(v.role==='pursuer')c=v.kind==='cop'?(Math.floor(run.elapsed*6)%2?'#ff3b3b':'#3b8bff'):'#ff6b3b';if(v.event==='racer'||v.event==='racing')c='#c47dff';if(v.event==='cop')c='#ff9a9a';if(v.wrecked)c='#555';g.fillStyle=c;g.beginPath();g.arc(px,py,(v.role==='pursuer'?3.4:2.6)*sc,0,7);g.fill()}
 const st=stationS(run.nextStationKm);if(st-p.s<range){const w2=worldFromRoad(st,EDGE+20),ddx=w2.x-p.x,ddz=w2.z-p.z;g.fillStyle='#4ee08a';g.fillRect(rx+(ddx*qx+ddz*qz)*k-4,ry-(ddx*fx+ddz*fz)*k-4,8,8)}
 g.fillStyle='#ffd777';g.beginPath();g.moveTo(rx,ry-6*sc);g.lineTo(rx-4*sc,ry+5*sc);g.lineTo(rx+4*sc,ry+5*sc);g.closePath();g.fill();g.restore();
 // gas station distance
 const rem=run.nextStationKm*1000-run.distanceMeters;if(rem>0&&rem<1000){g.save();g.fillStyle='rgba(16,70,40,.82)';g.beginPath();g.roundRect(w/2-80*sc,h-34*sc,160*sc,24*sc,8*sc);g.fill();g.fillStyle='#e8ffe9';g.font=`800 ${10*sc}px system-ui`;g.textAlign='center';g.textBaseline='middle';g.fillText(`⛽ GAS EXIT ${Math.round(rem)} m`+(rem<=300?' · PRESS E':''),w/2,h-22*sc);g.restore()}
 if(run.crashing){g.fillStyle=`rgba(120,0,0,${.25*Math.min(1,run.crashAge)})`;g.fillRect(0,0,w,h)}else if(p.health/p.maxHealth<.25){g.fillStyle=`rgba(160,0,0,${.12+.08*Math.sin(run.elapsed*6)})`;g.fillRect(0,0,w,h)}}

// ---------------------------------------------------------------- main loop
function render(){const p=run.player;const sd=sunLight.userData.dir;sunLight.target.position.set(p.x,p.y,p.z);sunLight.position.set(p.x+sd.x*150,p.y+sd.y*150,p.z+sd.z*150);skyObj.position.copy(camera.position);mountains.position.set(camera.position.x,0,camera.position.z);world.follow(camera.position);
 if(headSpot){const g=p.mesh.group,fx=Math.sin(p.psi),fz=-Math.cos(p.psi);headSpot.position.set(p.x+fx*(p.L/2),p.y+.8,p.z+fz*(p.L/2));headSpot.target.position.set(p.x+fx*30,p.y,p.z+fz*30);headSpot.intensity=p.wrecked?0:(road.env.night?260:120)}
 drawGlows();const sc=renderer.getDrawingBufferSize(tmpV2).y/(2*Math.tan(camera.fov*Math.PI/360));for(const pool of[effects.smoke,effects.sparks,effects.glow])pool.mat.uniforms.uScale.value=sc;
 skyObj.material.uniforms.time.value=run.elapsed;
 if(composer&&GFX_SPEC[gfxLevel].bloom)composer.render();else renderer.render(scene,camera)}
function adaptQuality(dt){run.fpsAcc+=dt;run.fpsN++;if(run.fpsAcc>2.5){const avg=run.fpsAcc/run.fpsN;run.fpsAcc=0;run.fpsN=0;if(avg>.027&&gfxLevel<3&&run.elapsed>5){applyGfx(gfxLevel+1);addNotice('Graphics lowered to '+GFX[gfxLevel]+' to keep the frame rate smooth',false,2.5)}}}
function frame(now){if(!run||!run.active)return;const dt=run.last?Math.min(.04,(now-run.last)/1000):0;run.last=now;
 if(!run.paused&&dt>0){update(dt);adaptQuality(dt)}else if(run.stationOpen&&dt>0)updateStationWalk(dt);
 if(run.over&&dt>0&&!run.paused){/* keep the wreck cam orbiting */}
 updateCamera(run.paused?0:dt);render();run.frameN=(run.frameN||0)+1;if(run.frameN%2===0||run.paused)drawOverlay();run.raf=requestAnimationFrame(frame)}
function togglePause(){street?.clearKeys();if(!run||run.over||run.stationOpen)return;run.paused=!run.paused;pauseVeil.hidden=!run.paused;$('pauseDrive').textContent=run.paused?'▶ Resume':'Ⅱ Pause';audio.pause(run.paused);for(const k in keys)keys[k]=false}
window.addEventListener('blur',()=>{street?.clearKeys();for(const key in keys)keys[key]=false;for(const key in stationKeys)stationKeys[key]=false;if(run&&run.active&&!run.paused&&!run.over&&!run.stationOpen)togglePause()});
function toggleFullscreen(){const stage=canvas.parentElement;try{if(document.fullscreenElement)document.exitFullscreen();else stage.requestFullscreen&&stage.requestFullscreen()}catch(_){}}

// ---------------------------------------------------------------- garage 3D preview
const preview={renderer:null,scene:null,camera:null,car:null,spec:null,raf:0,angle:.6};
function showPreview(spec){const c=$('garagePreview'),lobby=$('driveLobby');if(!c||!HAS3D||!lobby||lobby.hidden)return;
 if(!preview.renderer){try{preview.renderer=new T.WebGLRenderer({canvas:c,antialias:true,alpha:true})}catch(_){return}const r=preview.renderer;r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.toneMapping=T.ACESFilmicToneMapping;r.outputColorSpace=T.SRGBColorSpace;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
  const sc=preview.scene=new T.Scene();preview.camera=new T.PerspectiveCamera(32,2,.1,200);
  const pm=new T.PMREMGenerator(r);sc.environment=pm.fromScene(new RoomEnvironment(),.035).texture;r.toneMappingExposure=1.05;
  const key=new T.DirectionalLight('#ffffff',2.4);key.position.set(5,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;sc.add(key);sc.add(new T.HemisphereLight('#cfe0ff','#1b1d22',.6));
  initShared();const floor=new T.Mesh(new T.CircleGeometry(7,48).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:'#20262e',roughness:.35,metalness:.5}));floor.receiveShadow=true;sc.add(floor);const ring=new T.Mesh(new T.RingGeometry(6.6,6.75,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#f2bf5e'}));ring.position.y=.01;sc.add(ring)}
 if(!preview.raf)preview.raf=requestAnimationFrame(previewLoop);if(preview.spec===spec&&preview.car)return;preview.spec=spec;const info=$('previewInfo');
 if(spec.model&&!modelTemplates.has(modelKey(spec.model,false))){if(info)info.innerHTML=`<strong>${spec.name}</strong><em>Loading 3D model…</em>`;loadCarModel(spec.model,false).then(()=>{if(preview.spec===spec){preview.spec=null;showPreview(spec)}},()=>{if(info&&preview.spec===spec)info.innerHTML=`<strong>${spec.name}</strong><em>The 3D model could not load</em>`});return}
 if(preview.car){preview.scene.remove(preview.car.group);disposeVehicle({mesh:preview.car})}
 const car=createVehicleMesh(spec,{preview:true,color:carColor(spec)});preview.car=car;preview.scene.add(car.group);const L=car.data.L;preview.dist=Math.max(7.5,L*1.75);
 if(info){const bar=(label,v,max)=>`<div><span>${label}</span><i><b style="width:${clamp(v/max*100,4,100)}%"></b></i></div>`;const drive=(spec.drive||(SHAPES[spec.shape]||{}).drive||'').toUpperCase();info.innerHTML=`<strong>${spec.name}</strong><em>${drive}${spec.electric?' · ELECTRIC':''} · ${spec.weight.toFixed(2)} t · ${spec.top} km/h</em>`+bar('TOP SPEED',spec.top,330)+bar('ACCEL',spec.accel,85)+bar('BRAKES',spec.brake,100)+bar('HANDLING',spec.steer,4.4)+bar('ARMOR',spec.health,600)}
 if(!preview.raf)preview.raf=requestAnimationFrame(previewLoop)}
function previewLoop(){const lobby=$('driveLobby'),c=$('garagePreview');if(!lobby||lobby.hidden||!preview.car){preview.raf=0;return}const r=preview.renderer,w=c.clientWidth,h=c.clientHeight;if(w&&h&&(c.width!==Math.round(w*r.getPixelRatio())||c.height!==Math.round(h*r.getPixelRatio()))){r.setSize(w,h,false);preview.camera.aspect=w/h;preview.camera.updateProjectionMatrix()}
 preview.angle+=.006;const d=preview.dist;preview.camera.position.set(Math.cos(preview.angle)*d,d*.32,Math.sin(preview.angle)*d);preview.camera.lookAt(0,.7,0);for(const wl of preview.car.wheels)wl.spin.rotation.z-=.03;r.render(preview.scene,preview.camera);preview.raf=requestAnimationFrame(previewLoop)}

// ---------------------------------------------------------------- input & wiring
function leaveToGarage(){stopGame();window.showArcadeScreen('garage');renderGarage()}
function setDriveMode(mode,announce=true){driveMode=['normal','fast','chase'].includes(mode)?mode:'normal';modeNormal.classList.toggle('active',driveMode==='normal');modeFast.classList.toggle('active',driveMode==='fast');modeChase.classList.toggle('active',driveMode==='chase');modeNormal.setAttribute('aria-pressed',String(driveMode==='normal'));modeFast.setAttribute('aria-pressed',String(driveMode==='fast'));modeChase.setAttribute('aria-pressed',String(driveMode==='chase'));try{localStorage.setItem('highwayMode',driveMode)}catch(_){}if(announce)sayGarage(driveMode==='fast'?'Fast Mode selected: cop and rival events trigger every 0.15 and 0.3 km.':driveMode==='chase'?'Chase Mode selected: cop cruisers pursue you from the start.':'Normal Mode selected: cop events trigger every 1.5 km and races every 3 km.')}
modeNormal.addEventListener('click',()=>setDriveMode('normal'));modeFast.addEventListener('click',()=>setDriveMode('fast'));modeChase.addEventListener('click',()=>setDriveMode('chase'));setDriveMode(driveMode,false);
$('startDrive').addEventListener('click',startGame);$('garageBack').addEventListener('click',()=>{stopGame();window.showArcadeScreen('home')});$('garageFromDrive').addEventListener('click',leaveToGarage);$('pauseDrive').addEventListener('click',togglePause);$('leaveGasStation').addEventListener('click',closeGasStation);$('enterGasStation').addEventListener('click',tryEnterGasStation);$('talkToWorker').addEventListener('click',talkToWorker);$('driveAgain').addEventListener('click',startGame);$('gameoverGarage').addEventListener('click',leaveToGarage);
const camBtn=$('cameraDrive');if(camBtn)camBtn.addEventListener('click',()=>setCamera(camState.mode+1));const fsBtn=$('fullscreenDrive');if(fsBtn)fsBtn.addEventListener('click',toggleFullscreen);
window.addEventListener('keydown',e=>{if(!$('highwayScreen')||$('highwayScreen').hidden)return;const key=e.key.toLowerCase();if(street?.keyDown(e))return;if(run&&run.stationOpen){if(['arrowleft','arrowright'].includes(key))e.preventDefault();if(key==='arrowleft'||key==='a')stationKeys.left=true;if(key==='arrowright'||key==='d')stationKeys.right=true;if(key==='e'||key==='enter'||e.code==='Space'){e.preventDefault();talkToWorker()}if(key==='escape'){e.preventDefault();closeGasStation()}return}
 if(key==='b'&&!street?.onFoot){e.preventDefault();tryEnterGasStation();return}if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)||e.code==='Space')e.preventDefault();
 if(key==='arrowleft'||key==='a')keys.left=true;if(key==='arrowright'||key==='d')keys.right=true;if(key==='arrowup'||key==='w')keys.gas=true;if(key==='arrowdown'||key==='s')keys.brake=true;if(e.code==='Space'||key==='shift')keys.handbrake=true;if(key==='q')keys.lookBack=true;
 if(!e.repeat){if(key==='c'||key==='v')setCamera(camState.mode+1);if(/^[1-9]$/.test(key))setCamera(Number(key)-1);if(key==='r'&&run)recoverCar();if(key==='f')toggleFullscreen()}
 if(key==='escape'||key==='p')togglePause()});
window.addEventListener('keyup',e=>{street?.keyUp(e);const key=e.key.toLowerCase();if(run&&run.stationOpen){if(key==='arrowleft'||key==='a')stationKeys.left=false;if(key==='arrowright'||key==='d')stationKeys.right=false;return}if(key==='arrowleft'||key==='a')keys.left=false;if(key==='arrowright'||key==='d')keys.right=false;if(key==='arrowup'||key==='w')keys.gas=false;if(key==='arrowdown'||key==='s')keys.brake=false;if(e.code==='Space'||key==='shift')keys.handbrake=false;if(key==='q'||key==='b')keys.lookBack=false});
document.querySelectorAll('[data-drive]').forEach(button=>{const key=button.dataset.drive;button.addEventListener('pointerdown',e=>{e.preventDefault();if(key==='camera'){setCamera(camState.mode+1);return}keys[key]=true;button.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{if(key!=='camera')keys[key]=false})});
document.querySelectorAll('[data-station-walk]').forEach(button=>{const direction=button.dataset.stationWalk;button.addEventListener('pointerdown',e=>{e.preventDefault();stationKeys[direction]=true;button.setPointerCapture(e.pointerId)});for(const ev of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>stationKeys[direction]=false)});
wireDifficulty();
const presetRow=document.createElement('div');presetRow.className='street-presets';
for(const [label,level] of [['Easy · arcade steering',0],['Hard · realistic physics',100]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{difficulty.level=level;difficulty.custom=false;Object.assign(difficulty,assistDefaults(level));saveDifficulty();renderDifficulty();if(run)applyPlayerUpgrades();sayGarage(label+' selected.','success')};presetRow.append(b)}
$('diffSlider').parentElement.append(presetRow);
renderGarage();
// read-only handles for debugging in the browser console
window.__highway={get street(){return street},preview,cars,camState,get run(){return run},setCamera,showPreview,applyGfx,get gfxLevel(){return gfxLevel},get scene(){return scene},get renderer(){return renderer},get world(){return world},get composer(){return composer},get bloomPass(){return bloomPass},keys,get difficulty(){return difficulty},applyPlayerUpgrades,assistDefaults,
 time(fn,n=20){const gl=renderer.getContext(),px=new Uint8Array(4);fn();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const t0=performance.now();for(let i=0;i<n;i++)fn();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return +((performance.now()-t0)/n).toFixed(2)},
 parts:{update:()=>update(1/60),render:()=>render(),plain:()=>renderer.render(scene,camera)},
 // average milliseconds per simulated + rendered frame (forces the GPU to finish so the number is honest)
 bench(n=40){if(!run)return null;const gl=renderer.getContext(),px=new Uint8Array(4),t0=performance.now();for(let i=0;i<n;i++){update(1/60);updateCamera(1/60);render()}gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return +((performance.now()-t0)/n).toFixed(2)}};
})();
