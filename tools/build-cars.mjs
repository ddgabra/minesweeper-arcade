// Normalises community car models for Highway Run.
//   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 draco3dgltf meshoptimizer sharp
//   node tools/build-cars.mjs <folder with source .glb files> <output folder, e.g. models> [car id]
// Output convention: metres, +X = forward, +Y = up, +Z = right side, wheels on y=0, centred on x/z.
// Node names carry roles for the runtime: "WHEEL|..." spins with a wheel, "CALIPER|..." steers but does not spin.
// Material names carry roles: "paint", "glass", "head", "tail" (prefixes), anything else is left as authored.
// Each car is written twice: <id>.glb (detailed, for the player) and <id>-lod.glb (~9k triangles, for traffic).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import {MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import {getBounds, transformMesh, flatten, prune, dedup, weld, simplify, textureCompress, draco, join} from '@gltf-transform/functions';
const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
import fs from 'node:fs';
import path from 'node:path';

await MeshoptDecoder.ready;await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
 'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule(),'meshopt.decoder':MeshoptDecoder});

const CARS=[
 {id:'model3',src:'model3.glb',root:'Sketchfab_model',front:'+z',length:4.69,remove:n=>/Debris|Cylinder012|WallDesk/i.test(n),
  paint:/CAR_PAINT/,glass:/^Glass$/,head:/LED_PHARE/,tail:/^Material\.001$/,
  wheel:n=>/^wheel/.test(n),caliper:n=>/^cal/.test(n),interior:n=>/^int_/.test(n)},
 {id:'cybertruck',src:'cybertruck.glb',root:'tesla_ct_LOD0',front:'-z',length:5.68,remove:n=>/cactus|Kayak|Bench|Cover/i.test(n),
  paint:/^(body|gray)\.002$/,glass:/^(Glass|glassgray\.002)$/,head:/^light_f\.002$/,tail:/^Light$/,
  wheel:n=>/^tires$/.test(n),interior:n=>/^steer$/.test(n)},
 {id:'concept',src:'concept.glb',front:'+z',length:4.65,
  paint:/^Paint [12] Carmine$/,glass:/^Glass$/,head:/^Headlight$/,tail:/^Brakelight$/,
  wheel:(n,m)=>/^Wheel/.test(n)&&!/BrakePad/.test(n)||/Tire/.test(m),caliper:n=>/BrakePad/.test(n),interior:(n,m)=>/Interior|Floormat|Dashboard|Seat|Steering|Pedal/i.test(n+' '+m)},
 {id:'ferrari',src:'ferrari.glb',front:'-z',length:4.53,
  paint:/^Body_Color$/,glass:/^Glass_Gray$/,head:/^Projector_Glass$/,tail:/^Taillight_Glass$/,
  wheel:n=>/^(wheel|tire|rim_..|centre|brake|nuts)$/.test(n),interior:n=>/^(trim|leather|interior_light|carpet|carbon_fibre_trim|carbon fibre|steering_.*|blue)$/.test(n)},
 {id:'porsche',src:'porsche911.glb',front:'+z',length:4.52,
  paint:/^(paint|coat)$/,glass:/^(window|glass)$/,head:/^lights$/,tail:/^tex_shiny$/,
  wheel:n=>/^Cylinder\.00[01]_[012]$/.test(n),caliper:n=>/^Cylinder\.00[01]_3$/.test(n),interior:n=>/^(Cube\.00[12]_0|boot\.006_0)$/.test(n)},
 {id:'urus',src:'urus.glb',front:'+z',length:5.11,
  paint:/^WhiteCar$/,glass:/^Glass$/,head:/^LightsFrontLed$/,tail:/^emitbrake$/,
  wheel:n=>/TiresGum|Whl_HD|wheel003/.test(n),caliper:n=>/Caliper/.test(n)}
];

const [SRC,OUT,only]=process.argv.slice(2);
if(!SRC||!OUT){console.error('usage: node tools/build-cars.mjs <source dir> <output dir> [car id]');process.exit(1)}
fs.mkdirSync(OUT,{recursive:true});
for(const car of CARS){if(only&&car.id!==only)continue;
 for(const lod of [false,true]){
  const doc=await io.read(path.join(SRC,car.src)),root=doc.getRoot(),scene=root.listScenes()[0];
  // keep only the vehicle subtree
  if(car.root){const keep=root.listNodes().find(n=>n.getName()===car.root);if(!keep)throw new Error('root missing '+car.root);
   const world=keep.getWorldMatrix();for(const c of scene.listChildren())scene.removeChild(c);keep.getParentNode()?.removeChild(keep);keep.setMatrix(world);scene.addChild(keep)}
  flatten(doc);
  for(const n of root.listNodes()){const name=n.getName(),mats=(n.getMesh()?.listPrimitives()||[]).map(p=>p.getMaterial()?.getName()||'').join(' ');
   if(car.remove&&car.remove(name)||lod&&car.interior&&car.interior(name,mats)){n.dispose();continue}}
  await doc.transform(prune());
  // bake each mesh node's full world matrix into its own copy of the mesh, then hang it directly off the scene
  const meshNodes=root.listNodes().filter(n=>n.getMesh());
  for(const n of meshNodes){const world=n.getWorldMatrix();const m=n.getMesh().clone();transformMesh(m,world);n.setMesh(m)}
  for(const c of scene.listChildren())scene.removeChild(c);
  for(const n of meshNodes){n.getParentNode()?.removeChild(n);for(const k of n.listChildren())n.removeChild(k);n.setMatrix(I4);scene.addChild(n)}
  for(const n of root.listNodes())if(!n.getMesh())n.dispose();
  await doc.transform(prune());
  // orientation + scale, then grounding
  let b=getBounds(scene);const lenAxis=car.front.endsWith('z')?2:0,len=b.max[lenAxis]-b.min[lenAxis],s=car.length/len;
  const ang={'+z':Math.PI/2,'-z':-Math.PI/2,'+x':0,'-x':Math.PI}[car.front],c0=Math.cos(ang),s0=Math.sin(ang);
  // column-major rotation about Y times uniform scale
  const R=[c0*s,0,-s0*s,0, 0,s,0,0, s0*s,0,c0*s,0, 0,0,0,1];
  for(const m of root.listMeshes())transformMesh(m,R);
  b=getBounds(scene);
  const T=[1,0,0,0, 0,1,0,0, 0,0,1,0, -(b.min[0]+b.max[0])/2,-b.min[1],-(b.min[2]+b.max[2])/2,1];
  for(const m of root.listMeshes())transformMesh(m,T);
  // roles
  for(const m of root.listMaterials()){const nm=m.getName();
   if(car.paint.test(nm))m.setName('paint:'+nm);else if(car.glass.test(nm))m.setName('glass:'+nm);else if(car.head.test(nm))m.setName('head:'+nm);else if(car.tail.test(nm))m.setName('tail:'+nm)}
  const wheelNodes=new Set();
  for(const n of root.listNodes()){if(!n.getMesh())continue;const name=n.getName(),mats=n.getMesh().listPrimitives().map(p=>p.getMaterial()?.getName()||'').join(' ');
   if(car.caliper&&car.caliper(name,mats)){n.setName('CALIPER|'+name);wheelNodes.add(n)}else if(car.wheel(name,mats)){n.setName('WHEEL|'+name);wheelNodes.add(n)}else{n.setName('');n.getMesh().setName('')}}
  await doc.transform(dedup(),prune(),weld());
  // traffic versions keep only shape: each texture's average colour is folded into its material colour,
  // then UVs/normals go so seams don't block the simplifier (normals are rebuilt at load time)
  if(lod){const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)};
   for(const m of root.listMaterials()){const tex=m.getBaseColorTexture();if(tex&&tex.getImage()){try{const st=await sharp(Buffer.from(tex.getImage())).stats(),f=m.getBaseColorFactor();m.setBaseColorFactor([f[0]*lin(st.channels[0].mean),f[1]*lin(st.channels[1].mean),f[2]*lin(st.channels[2].mean),f[3]])}catch(e){}}
    m.setBaseColorTexture(null);m.setNormalTexture(null);m.setMetallicRoughnessTexture(null);m.setOcclusionTexture(null);m.setEmissiveTexture(null)}
   for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives())for(const sem of p.listSemantics())if(sem!=='POSITION')p.setAttribute(sem,null);
   await doc.transform(prune(),weld())}
  // triangle budgets: ~120k for the car you drive, ~9k for traffic
  const tris=()=>root.listMeshes().reduce((t,m)=>t+m.listPrimitives().reduce((a,p)=>a+(p.getIndices()?.getCount()||0)/3,0),0);
  const before=tris(),target=lod?9000:120000;
  if(before>target)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:target/before,error:lod?.02:.003}));
  if(lod)await doc.transform(join({keepNamed:true}),prune());
  console.log(car.id,lod?'lod':'hi','tris',before,'->',tris());
  await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:lod?[256,256]:[1024,1024]}),draco());
  const out=path.join(OUT,`${car.id}${lod?'-lod':''}.glb`);await io.write(out,doc);
  const fb=getBounds(doc.getRoot().listScenes()[0]);
  console.log(out,(fs.statSync(out).size/1e6).toFixed(2)+'MB','size',fb.max.map((v,i)=>(v-fb.min[i]).toFixed(2)).join('x'),'wheelNodes',wheelNodes.size);
 }}

