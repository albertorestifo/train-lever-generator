import earcut, {deviation} from './vendor/earcut.js';
export const FIXED={thickness_mm:8,inner_radius_mm:29,bolt_radius_mm:36,hole_diameter_mm:3.4,head_diameter_mm:6.2,head_depth_mm:3,roller_radius_mm:5,follower_arm_mm:35,pivot_to_roller_mm:53,stop_angle_deg:58,profile_angle_deg:70,max_lift_mm:3};
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;
export class DesignError extends Error{}
const fail=m=>{throw new DesignError(m)};
export function prepare(c){
 if(!c||!Array.isArray(c.nodes)||c.nodes.length<3||c.nodes.length>101)fail('Use 3–101 motion nodes, ordered by increasing angle.');
 for(const n of c.nodes){
  if(!n||!Number.isFinite(n.angle_deg)||!Number.isFinite(n.lift_mm))fail('Every node needs finite numeric angle and lift.');
  if(!['cosine','quintic','linear_blend'].includes(n.shape??'cosine'))fail('Unknown transition shape.');
  if(n.lift_mm<0||n.lift_mm>FIXED.max_lift_mm)fail('Roller lift must stay between 0 and 3 mm.');
 }
 const a=c.nodes.map(n=>n.angle_deg);
 if(Math.abs(a[0]+58)>1e-8||Math.abs(a.at(-1)-58)>1e-8)fail('First/last nodes must stay at -58/+58 degrees to match the mechanical stops.');
 if(a.some((v,i)=>i&&v-a[i-1]<.5))fail('Nodes must be ordered and at least 0.5 degree apart.');
 const p=c.assumed_extra_preload_mm??0;if(!Number.isFinite(p)||p<0||p>1)fail('Extra preload assumption must be 0–1 mm.');
 return c.nodes;
}
export function ease(u,shape){
 if(shape==='cosine')return [.5*(1-Math.cos(Math.PI*u)),.5*Math.PI*Math.sin(Math.PI*u)];
 if(shape==='quintic')return [u**3*(10-15*u+6*u*u),30*u*u*(1-u)**2];
 const b=.2;if(u<b)return [u*u/(2*b*(1-b)),u/(b*(1-b))];if(u>1-b)return [1-(1-u)**2/(2*b*(1-b)),(1-u)/(b*(1-b))];return [(u-b/2)/(1-b),1/(1-b)];
}
export function motion(d,n){
 if(d<=n[0].angle_deg)return [n[0].lift_mm,0];if(d>=n.at(-1).angle_deg)return [n.at(-1).lift_mm,0];
 let i=0;while(n[i+1].angle_deg<=d)i++;const a=n[i],b=n[i+1],span=b.angle_deg-a.angle_deg,[s,ds]=ease((d-a.angle_deg)/span,a.shape??'cosine'),dh=b.lift_mm-a.lift_mm;
 return [a.lift_mm+dh*s,dh*ds/rad(span)];
}
export function geometryAt(d,n){
 const t=rad(d),[h,hp]=motion(d,n),beta=-h/35,bp=-hp/35,y=-35+35*Math.cos(beta),z=-53+35*Math.sin(beta),yp=-35*bp*Math.sin(beta),zp=35*bp*Math.cos(beta),co=Math.cos(t),si=Math.sin(t);
 const q=[co*y+si*z,-si*y+co*z],qp=[co*(yp+z)+si*(zp-y),-si*(yp+z)+co*(zp-y)];let normal=[qp[1],-qp[0]],l=Math.hypot(...normal);normal=normal.map(v=>v/l);if(normal[0]*q[0]+normal[1]*q[1]<0)normal=normal.map(v=>-v);
 const edge=[q[0]-5*normal[0],q[1]-5*normal[1]],nw=[co*normal[0]-si*normal[1],si*normal[0]+co*normal[1]],pa=deg(Math.acos(Math.min(1,Math.abs(-nw[0]*Math.sin(beta)+nw[1]*Math.cos(beta))))),dz=-20*Math.sin(beta)+6*(Math.cos(beta)-1);
 return [edge,q,h,hp,pa,dz];
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
function segmentDistance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],l=x*x+y*y,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/l)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y)}
function boundaryDistance(p,ring){let d=Infinity;for(let i=0;i<ring.length;i++)d=Math.min(d,segmentDistance(p,ring[i],ring[(i+1)%ring.length]));return d}
function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes}
export function validRing(p){
 // Reject crossings and nonadjacent touches before triangulation. Bounding boxes prune most pairs.
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-10)return false;
  for(let j=i+2;j<p.length;j++){
   if(i===0&&j===p.length-1)continue;const c=p[j],d=p[(j+1)%p.length];
   if(Math.max(a[0],b[0])+1e-10<Math.min(c[0],d[0])||Math.max(c[0],d[0])+1e-10<Math.min(a[0],b[0])||Math.max(a[1],b[1])+1e-10<Math.min(c[1],d[1])||Math.max(c[1],d[1])+1e-10<Math.min(a[1],b[1]))continue;
   const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
   if(((x>0&&y<0)||(x<0&&y>0))&&((z>0&&w<0)||(z<0&&w>0)))return false;
   if(Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<1e-10)return false;
  }
 }return Math.abs(area(p))>1e-8;
}
const disk=(cx,cy,r)=>Array.from({length:96},(_,i)=>[cx+r*Math.cos(2*Math.PI*i/96),cy+r*Math.sin(2*Math.PI*i/96)]);
export function build(config,mesh=false){
 const nodes=prepare(config),samples=[...new Set([...Array.from({length:1401},(_,i)=>Number((-70+i*.1).toFixed(8))),...nodes.map(n=>Number(n.angle_deg.toFixed(8)))])].sort((a,b)=>a-b);
 const outer=samples.map(t=>geometryAt(t,nodes)[0]),inner=Array.from({length:281},(_,i)=>[-29*Math.sin(rad(70-i*.5)),-29*Math.cos(rad(70-i*.5))]),world=[...outer,...inner];
 if(!validRing(world))fail('Roller-offset contour folds or self-intersects: widen ramps or reduce lift. No STL exported.');
 let plate=world.map(([x,y])=>[x,-y]);if(area(plate)<0)plate=[plate[0],...plate.slice(1).reverse()];
 const holes=[-45,0,45].map(t=>[-36*Math.sin(rad(t)),36*Math.cos(rad(t))]);
 const minWeb=Math.min(...holes.map(p=>boundaryDistance(p,plate)-3.1));
 if(minWeb<2||holes.some(p=>!inside(p,plate)))fail('Cam edge too close to a mounting head recess: minimum wall below 2 mm.');
 const kin=[];for(let i=0;i<1201;i++){const d=-60+i*.1,[,q,h,hp,pa,dz]=geometryAt(d,nodes),gap=(inside(q,world)?0:boundaryDistance(q,world))-5;kin.push([d,h,hp,dz,pa,gap]);}
 const maxCol=i=>Math.max(...kin.map(k=>k[i])),minGap=Math.min(...kin.map(k=>k[5])),maxGap=maxCol(5);
 if(minGap<-.015||maxGap>.015)fail(`Roller cannot follow requested motion: contact error ${minGap.toFixed(3)}..${maxGap.toFixed(3)} mm. Widen ramps or reduce lift.`);
 if(maxCol(4)>35)fail(`Pressure angle ${maxCol(4).toFixed(1)} degrees exceeds the conservative 35 degree limit.`);
 const maxR=Math.max(...outer.map(p=>Math.hypot(...p)));if(maxR>FIXED.pivot_to_roller_mm-FIXED.roller_radius_mm+FIXED.max_lift_mm+.001)fail('Profile exceeds the generator radial limit.');
 const preload=config.assumed_extra_preload_mm??0;
 const report={name:config.name??'Custom',interface:FIXED,nodes,gate_count:nodes.filter(n=>n.kind==='gate').length,max_outer_radius_mm:maxR,contact_poses:1201,checked_angle_range_deg:[-60,60],min_contact_error_mm:minGap,max_contact_error_mm:maxGap,max_pressure_angle_deg:maxCol(4),max_follower_lift_mm:maxCol(1),max_spring_seat_rise_mm:maxCol(3),assumed_spring_free_mm:20,assumed_gate_spring_spacing_mm:17,assumed_extra_preload_mm:preload,minimum_vertical_spring_spacing_mm:17-preload-maxCol(3),minimum_mounting_head_ligament_mm:minWeb,profile_angle_range_deg:[-70,70],physical_validation:'Prototype; actual spring rate, solid height, friction and tactile force unmeasured.'};
 report.mechanical_review_required=maxCol(1)>1.4;
 report.warnings=report.mechanical_review_required?['Above the previous 1.4 mm design envelope: check lever clearances and spring compression before use. Geometry validation does not verify assembly clearance.']:[];
 const triangles=[];
 if(mesh){
  const small=holes.map(p=>disk(...p,1.7)),large=holes.map(p=>disk(...p,3.1));
  function face(rings,z,up){
   const pts=rings.flat(),coords=pts.flat(),starts=[];let start=rings[0].length;for(let i=1;i<rings.length;i++){starts.push(start);start+=rings[i].length;}
   const ids=earcut(coords,starts);if(deviation(coords,starts,2,ids)>1e-9)fail('Triangulation area mismatch. No STL exported.');
   for(let i=0;i<ids.length;i+=3){let t=ids.slice(i,i+3).map(id=>pts[id]);const a=cross(...t);if(Math.abs(a)<1e-12)fail('Degenerate mesh face.');if((a>0)!==up)t=[t[0],t[2],t[1]];triangles.push(t.map(([x,y])=>[x,y,z]));}
  }
  face([plate,...small],0,false);face([plate,...large],8,true);for(let i=0;i<3;i++)face([large[i],small[i]],5,true);
  function wall(points,z0,z1,inside){for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],v=[[...a,z0],[...b,z0],[...b,z1],[...a,z1]];for(const ids of (inside?[[0,2,1],[0,3,2]]:[[0,1,2],[0,2,3]]))triangles.push(ids.map(i=>v[i]));}}
  wall(plate,0,8,false);for(let i=0;i<3;i++){wall(small[i],0,5,true);wall(large[i],5,8,true);}
  report.print_translation_mm=[128,95,0];Object.assign(report,checkMesh(triangles));
 }
 return {plate,holes,triangles,report,kinematics:kin};
}
export function checkMesh(tris){
 const edges=new Map();let vol=0;
 for(const [a,b,c] of tris){const keys=[a,b,c].map(p=>p.map(v=>Math.round(v*1e7)/1e7).join(','));for(let i=0;i<3;i++){const u=keys[i],v=keys[(i+1)%3],key=u<v?u+'|'+v:v+'|'+u;const e=edges.get(key)??[0,0];e[0]++;e[1]+=u<v?1:-1;edges.set(key,e);}
 vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 const bad=[...edges.values()].filter(e=>e[0]!==2).length,winding=[...edges.values()].filter(e=>e[1]!==0).length;
 if(bad||winding||vol<=0)fail(`Mesh generation failed: unpaired=${bad}, winding=${winding}, volume=${vol}.`);
 return {triangles:tris.length,unpaired_edges:bad,inconsistent_edges:winding,volume_mm3:vol};
}
export function stl(tris){
 const buffer=new ArrayBuffer(84+50*tris.length),data=new DataView(buffer);new Uint8Array(buffer).set(new TextEncoder().encode('P08 parametric cam; mm; broad flat face down'));data.setUint32(80,tris.length,true);let at=84;
 for(const tri of tris){const [a,b,c]=tri.map(([x,y,z])=>[x+128,y+95,z]),u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);for(const f of [...n.map(x=>x/l),...a,...b,...c]){data.setFloat32(at,f,true);at+=4;}at+=2;}
 return buffer;
}
export function evenlySpaced(n,height=.8){if(!Number.isInteger(n)||n<2||n>51)fail('Enter a whole number from 2 to 51.');if(!Number.isFinite(height)||height<0||height>FIXED.max_lift_mm)fail('Initial notch height must be a number from 0 to 3 mm.');const nodes=[];for(let i=0;i<n;i++){nodes.push({angle_deg:-58+i*116/(n-1),lift_mm:0,kind:'gate',shape:'cosine'});if(i<n-1)nodes.push({angle_deg:-58+(i+.5)*116/(n-1),lift_mm:height,kind:'crest',shape:'cosine'});}return {name:n+' custom gates',nodes};}
export function scad({plate,holes}){return `// Finite-roller compensated v23 cam; mm. Broad flat face down, counterbores up.\n$fn=96;\nprofile=${JSON.stringify(plate)};\nmounting_centres=${JSON.stringify(holes)};\ntranslate([128,95,0]) difference(){\n linear_extrude(height=8) polygon(profile);\n for(p=mounting_centres){\n translate([p[0],p[1],-0.01]) cylinder(h=8.02,d=3.4);\n translate([p[0],p[1],5]) cylinder(h=3.01,d=6.2);\n }\n}\n`;}
export function svg({plate,holes,report,kinematics}){
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const path=plate.map(([x,y],i)=>(i?'L':'M')+`${(x*5+310).toFixed(2)},${(350-y*5).toFixed(2)}`).join(' ')+' Z',hpath=kinematics.map(([d,h],i)=>(i?'L':'M')+`${(70+(d+60)*4.4).toFixed(2)},${(570-h*(140/FIXED.max_lift_mm)).toFixed(2)}`).join(' '),q=geometryAt(0,report.nodes)[1];
 const holesSvg=holes.map(([x,y])=>`<circle cx="${x*5+310}" cy="${350-y*5}" r="15.5" fill="white" stroke="#85909c"/><circle cx="${x*5+310}" cy="${350-y*5}" r="8.5" fill="white" stroke="#222"/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 660" role="img" aria-label="Notch profile and follower lift"><rect width="660" height="660" fill="white"/><style>text{font:14px sans-serif;fill:#182638}</style><text x="25" y="26" style="font-size:20px">${escape(report.name)}</text><text x="25" y="50">Actual compensated edge | blue circle = 10 mm roller at centre</text><path d="${path}" fill="#e3e9ef" stroke="#172536" stroke-width="2"/>${holesSvg}<circle cx="${q[0]*5+310}" cy="${350+q[1]*5}" r="25" fill="none" stroke="#1681b6" stroke-width="2"/><text x="25" y="397">Follower lift (mm): larger barriers / steeper slopes resist motion more.</text><path d="M70 430 V570 H600" fill="none" stroke="#888"/><path d="${hpath}" fill="none" stroke="#bd4931" stroke-width="2"/><text x="40" y="438">${FIXED.max_lift_mm}</text><text x="50" y="574">0</text><text x="65" y="592">-60 deg</text><text x="320" y="592">0 deg</text><text x="570" y="592">+60 deg</text><text x="25" y="625">Pressure angle max ${report.max_pressure_angle_deg.toFixed(1)} deg; travel max ${report.max_follower_lift_mm.toFixed(2)} mm</text><text x="25" y="647">Nominal geometry only; physical feel depends on preload, friction and printing.</text></svg>`;
}
