// Standard/Deep/Smooth notch recipe: turns simple position choices into engine nodes. Positions are 1-based.
export const DEFAULT_DESIGN={count:9,deep:[5,9],smooth:[]};
const F=9/14.5,TOL=1e-9;
const ints=(v,lo,hi)=>Array.isArray(v)&&v.every(x=>Number.isInteger(x)&&x>=lo&&x<=hi)?[...new Set(v)].sort((a,b)=>a-b):null;
export function normalizeDesign(v){
 if(!v||typeof v!=='object'||!Number.isInteger(v.count)||v.count<2||v.count>13)return null;
 const deep=ints(v.deep,1,v.count),smooth=ints(v.smooth,2,v.count-1);
 if(!deep||!smooth||smooth.some(x=>deep.includes(x)))return null;
 const spring=springs(v.spring,v.count,deep,smooth);if(!spring)return null;
 return spring.length?{count:v.count,deep,smooth,spring}:{count:v.count,deep,smooth};
}
// Spring-back positions: [[position, target], …], 1-based. The lever returns to `target` when
// released from `position`. A target is a plain resting position (not Deep, Smooth or itself
// springing back), and every position between a spring position and its target springs back to
// the same target, so each target with its spring positions forms one valley. Spring designs
// don't mix with Smooth ranges.
function springs(v,n,deep,smooth){
 if(v===undefined||(Array.isArray(v)&&v.length===0))return [];
 if(!Array.isArray(v)||smooth.length)return null;
 const pairs=[],to=new Map();
 for(const x of v){
  if(!Array.isArray(x)||x.length!==2||!x.every(y=>Number.isInteger(y)&&y>=1&&y<=n))return null;
  const [p,t]=x;if(p===t||to.has(p)||deep.includes(p))return null;to.set(p,t);pairs.push([p,t]);
 }
 for(const [p,t] of pairs){
  if(to.has(t)||deep.includes(t))return null;
  for(let q=Math.min(p,t)+1;q<Math.max(p,t);q++)if(to.get(q)!==t)return null;
 }
 return pairs.sort((a,b)=>a[0]-b[0]);
}
// A run of Smooth positions is a range: a flat floor at notch depth from its first to its last
// position, with a wall at each end. The lever rests anywhere on the floor and has to be pushed
// over a wall to leave. Each wall is an ordinary bump (same crest position and snap shapes), so
// the range is a Standard notch whose floor is stretched flat. Walls are 1.2 mm, and as tall as
// the bump beside a Deep end position (an emergency). A single Smooth position has no floor and
// feels like a Standard notch.
//
// Every bump and every Deep depth is set by the gap G (degrees) between the two notches it sits
// between, or between a notch and the end of a floor (which counts as Standard). From 14.5° up,
// the tested Class 323 shapes are used unchanged. Closer than that, the 5 mm roller limits what
// fits, in two ways:
// - Fold: a bump top must stay rounder than the roller. A snap flank of height h over angle θ
//   (rad) keeps the roller path's radius of curvature at 5.5 mm or more while h ≤ K·θ²,
//   K = 189 mm/rad². That caps a Standard bump below 9.15°.
// - Pressure angle: the flank into a Deep notch carries depth + bump over F·G and must stay under
//   35°, so Deep gets shallower as G shrinks and F moves towards the middle to share the room.
// The rows below were searched with the engine on each motif (0.5° pressure-angle margin) and
// checked on every pattern at 8 and 9 positions and on Deep motifs at 10 to 13.
// Deep–Standard rows: [G, centre depth, bump, F, end depth, end bump, end F]. Below the first row
// there is no room for Deep, and the position is cut like a Standard notch.
const DS=[
 [9.5,0.13,1.2,0.51,0.13,1.2,0.51],[9.66,0.24,1.2,0.52,0.24,1.2,0.52],[10,0.46,1.2,0.54,0.46,1.2,0.54],
 [10.5,0.77,1.2,0.56,0.77,1.2,0.56],[10.54,0.78,1.2,0.56,0.78,1.2,0.56],[11,1.12,1.2,0.58,1.12,1.2,0.58],
 [11.5,1.38,1.2,0.6,1.38,1.2,0.6],[11.6,1.39,1.2,0.6,1.39,1.2,0.6],[12,1.51,1.2,0.61,1.51,1.2,0.61],
 [12.5,1.69,1.2,0.63,1.69,1.2,0.63],[12.88,1.79,1.2,0.64,1.8,1.2,0.64],[13,1.7,1.3,0.63,1.82,1.2,0.64],
 [13.5,1.72,1.4,0.63,1.84,1.3,0.64],[14,1.8,1.4,F,1.85,1.4,0.64],
];
// Deep–Deep rows: [G, depth, ridge]. The ridge is midway; depth is kept over ridge height, which
// may go down to 0.8 mm. Below the first row the two are cut like Standard notches.
const DD=[
 [8,0.09,0.8],[8.28,0.16,0.8],[8.5,0.21,0.8],[9,0.33,0.8],[9.5,0.46,0.8],[9.66,0.51,0.8],[10,0.6,0.8],
 [10.5,0.74,0.8],[10.54,0.76,0.8],[11,0.89,0.8],[11.5,1.05,0.8],[11.6,1.08,0.8],[12,1.22,0.8],
 [12.5,1.39,0.8],[12.88,1.53,0.8],[13,1.57,0.8],[13.5,1.67,0.8],[14,1.75,0.8],[14.5,1.74,0.9],
 [15,1.79,0.9],[15.5,1.79,1],[16,1.79,1.1],[16.5,1.79,1.2],[17,1.79,1.3],
];
const TESTED_DS=14.5,TESTED_DD=17.5,K_FOLD=189,rad=Math.PI/180;
const row=(rows,G)=>{let r=null;for(const x of rows)if(x[0]<=G+TOL)r=x;return r};
const standardBump=G=>Math.min(1.2,Math.floor(K_FOLD*(G/2*rad)**2*100)/100);
// The Deep–Standard pair across gap G: {depth, bump, f} (f = crest distance from the Deep, as a share of G).
function deepStandard(G,atEnd){
 if(G>=TESTED_DS-TOL)return {depth:atEnd?1.9:1.8,bump:1.4,f:F};
 const r=row(DS,G);if(!r)return {depth:0,bump:standardBump(G),f:0.5};
 return atEnd?{depth:r[4],bump:r[5],f:r[6]}:{depth:r[1],bump:r[2],f:r[3]};
}
function deepDeep(G){
 if(G>=TESTED_DD-TOL)return {depth:1.9,ridge:1.4};
 const r=row(DD,G);return r?{depth:r[1],ridge:r[2]}:{depth:0,ridge:standardBump(G)};
}
// Spring-back valleys. A target and its spring positions form a valley: the target is the floor,
// and each spring position sits on a flank. Released anywhere on a flank, the roller slides back
// to the floor. A flank that leads to another position ends in a wall: the spring zone rises at a
// steady SPRING_SLOPE, then the slope jumps to WALL_SLOPE (the "strong" wall chosen on the printed
// test disk, 23 November 2026) and climbs to SPRING_TOP, so there is a clear point to push past.
// Over the rounded top the roller drops steeply (DESCENT_SLOPE) into the next position, which sits
// at WALL_GATE below zero so it catches the lever; a long descent eases off to DESCENT_TAIL.
//
// Physical limits, all real: the 5 mm roller cannot follow a convex pitch curve tighter than about
// 5.5 mm, so a top rounds off at CURVE_MAX mm/rad²; the pressure angle stays at or under 35°, which
// caps slopes near WALL_SLOPE. Tops stop at SPRING_TOP: 6 mm tops hit the P13 spring block (corner
// 50.36 mm from the shaft), the 2.2 mm test disk cleared it at 50.20. So the lift comes from below:
// floors at SPRING_FLOOR, with lift_floor_mm on the config. There the follower still clears P33/P01S
// and P32 (about 2.9 and 4.1 mm left at -1.9 mm) and the reference spring keeps contact to about
// -5.3 mm, more with preload. Beside a plain bump a floor is only as deep as springDepthCap allows.
// Where a gap is too short for the full wall, the top comes down until the flank and its descent
// fit; a flank whose spring zone would fall below SPRING_SLOPE_MIN is refused. A spring run that ends at a stop rises at SPRING_SLOPE into it.
// Inside a valley, positions are a band apart; other gaps share the rest of the travel. Two valleys
// whose spring positions face each other meet at one shared top.
const SPRING_BAND=7,ZONE_PAST=1,SPRING_FLOOR=4,SPRING_TOP=2.2,TOP_MIN=1.2,CURVE_MAX=400,RAMP=1,KNEE=0.8,WALL_MIN=0.5;
const SPRING_SLOPE=18,SPRING_SLOPE_MIN=10,WALL_SLOPE=30,DESCENT_SLOPE=30,DESCENT_TAIL=4,GATE_RAMP=1.5,WALL_GATE=3.5;
export const SPRING_LIFT_FLOOR=-SPRING_FLOOR;
export const SPRING_ALL_ONE='Every position springs back to the same one, so the valley would span the whole travel and be too shallow to spring back. A spring-centred lever without a notch disk suits it better.';
const round2=v=>Math.round(v*100)/100,topWidth=s=>s/CURVE_MAX/rad;
// A flank from a floor up a wall to a top `rise` higher. Knots: [distance from the floor (deg),
// slope (mm/rad)]. With width W the flank must end exactly there (a shared top).
function wallFlank(rise,Lmin,W){
 const r=topWidth(WALL_SLOPE),s2=WALL_SLOPE,fixedLift=s2*KNEE/2*rad+s2*s2/(2*CURVE_MAX);
 const make=(s1,L,w)=>({width:L+KNEE+w+r,s1,knots:[[0,0],[RAMP,s1],[L,s1],[L+KNEE,s2],[L+KNEE+w,s2],[L+KNEE+w+r,0]]});
 const s1Lift=L=>(L-RAMP/2+KNEE/2)*rad;
 if(W===undefined){
  const w=(rise-fixedLift-SPRING_SLOPE*s1Lift(Lmin))/(s2*rad);
  if(w>=WALL_MIN)return make(SPRING_SLOPE,Lmin,w);
  const s1=(rise-fixedLift-s2*WALL_MIN*rad)/s1Lift(Lmin);
  return s1>=SPRING_SLOPE_MIN&&s1<=SPRING_SLOPE?make(s1,Lmin,WALL_MIN):null;
 }
 // Fixed width: L=W-KNEE-w-r. Solve w with s1=SPRING_SLOPE, else keep the shortest wall and solve s1.
 const w=(rise-fixedLift-SPRING_SLOPE*(W-KNEE-r-RAMP/2+KNEE/2)*rad)/((s2-SPRING_SLOPE)*rad);
 if(w>=WALL_MIN&&W-KNEE-w-r>=Lmin-TOL)return make(SPRING_SLOPE,W-KNEE-w-r,w);
 const L=W-KNEE-WALL_MIN-r;if(L<Lmin-TOL)return null;
 const s1=(rise-fixedLift-s2*WALL_MIN*rad)/s1Lift(L);
 return s1>=SPRING_SLOPE_MIN&&s1<=SPRING_SLOPE?make(s1,L,WALL_MIN):null;
}
// From a top down `drop` over D degrees into a gate: steep first, then easing off if there is room.
const descentWidth=(s,drop)=>drop/(s*rad)+topWidth(s)/2+GATE_RAMP/2;
function descent(drop,D){
 if(descentWidth(DESCENT_SLOPE,drop)>D+TOL)return null;
 const s=DESCENT_SLOPE,r=topWidth(s),sg=DESCENT_TAIL;
 // Where the slope eases from s to sg; a single slope if the span is too short for that.
 const x1=(drop/rad-s*(KNEE/2-r/2)-sg*(D-KNEE/2-GATE_RAMP/2))/(s-sg);
 if(x1>=r&&x1+KNEE<=D-GATE_RAMP)return [[0,0],[r,s],[x1,s],[x1+KNEE,sg],[D-GATE_RAMP,sg],[D,0]];
 let lo=sg,hi=s;for(let i=0;i<60;i++){const m=(lo+hi)/2;descentWidth(m,drop)>D?lo=m:hi=m}
 const t=hi,rt=topWidth(t);return [[0,0],[rt,t],[D-GATE_RAMP,t],[D,0]];
}
// A spring run ending at a stop: SPRING_SLOPE up to the stop, rounded off there.
function stopFlank(maxRise,len){
 const rise=S=>S*(len-RAMP/2-topWidth(S)/2)*rad;let S=SPRING_SLOPE;
 if(rise(S)>maxRise){let lo=0,hi=S;for(let i=0;i<60;i++){const m=(lo+hi)/2;rise(m)>maxRise?hi=m:lo=m}S=lo}
 return {rise:rise(S),knots:[[0,0],[RAMP,S],[len-topWidth(S),S],[len,0]]};
}
// Slope knots measured from one end of a span, as an engine profile over that span.
function profile(knots,span,fromStart){
 const p=knots.map(([x,s])=>[fromStart?x/span:1-x/span,s]);if(!fromStart)p.reverse();
 return p.map(([u,s],i)=>[i===0?0:i===p.length-1?1:Math.min(1,Math.max(0,Math.round(u*1e6)/1e6)),Math.round(s*1000)/1000]);
}
const TOO_MANY='Too many positions for the travel: a spring-back flank leaves no room beside the next position.';
// How deep a spring floor or a wall's landing can be beside a plain bump across gap G: as deep
// as the bump's snap flank allows at the tested Deep flank slope (3.2 mm over 9°, 20.4 mm/rad),
// and never shallower than a Deep there.
const DEEP_FLANK=20.4;
function springDepthCap(G,atEnd){const r=deepStandard(G,atEnd);return Math.max(r.depth,Math.floor((DEEP_FLANK*r.f*G*rad-r.bump)*100)/100)}
function springRecipe(d){
 const {count:n}=d,to=new Map(d.spring),target=p=>to.get(p)??p,spring=p=>to.has(p),deep=i=>d.deep.includes(i),end=i=>i===1||i===n;
 const valley=(i,j)=>target(i)===target(j);
 const run=(c,dir)=>{let k=0;for(let q=c+dir;q>=1&&q<=n&&to.get(q)===c;q+=dir)k++;return k};
 // Layout: a band inside a valley; the other gaps share the rest of the travel evenly.
 const pad=p=>spring(p)?SPRING_BAND/2:0;
 let fixed=0,free=0;for(let i=1;i<n;i++)valley(i,i+1)?fixed+=SPRING_BAND:free++;
 if(!free)throw Error(SPRING_ALL_ONE);
 const G=(116-pad(1)-pad(n)-fixed)/free;
 const angle=[null,-58+pad(1)];for(let i=1;i<n;i++)angle.push(angle[i]+(valley(i,i+1)?SPRING_BAND:G));
 const centres=[];for(let i=1;i<=n;i++)if(!spring(i))centres.push(i);
 // Resting lifts: valley floors at SPRING_FLOOR, positions a wall drops into at WALL_GATE, Deep as
 // usual; each limited by a plain bump beside it.
 const plainNext=(i,dir)=>{const j=i+dir;return j>=1&&j<=n&&!spring(j)?j:null};
 const lift=new Map();
 for(const c of centres){
  const floor=run(c,-1)||run(c,1),wallSide=(c>1&&spring(c-1))||(c<n&&spring(c+1));
  let v=floor?SPRING_FLOOR:deep(c)?(end(c)?1.9:1.8):wallSide?WALL_GATE:0;
  if(v)for(const dir of [-1,1]){const j=plainNext(c,dir);if(j)v=Math.min(v,deep(c)?deepStandard(Math.abs(angle[j]-angle[c]),end(c)).depth:springDepthCap(Math.abs(angle[j]-angle[c]),end(c)))}
  lift.set(c,-round2(v));
 }
 const lowered=i=>lift.get(i)<0;
 // Points left to right; each carries the shape of the span to the next point.
 const pts=[],point=(a,h,kind,label)=>pts.push({angle_deg:a,lift_mm:round2(h),kind,label,shape:'snap_up'});
 const span=(shape,knots,fromStart)=>{const p=pts.at(-1);p.shape=shape;p.pending=knots?{knots,fromStart}:null};
 const tooTight=c=>Error(`Position ${c} has too many positions springing back to it for the room beside it: its spring zone would be too shallow to spring back.`);
 // A wall flank from centre c toward `dir`, ending at the next position's gate (angle ga, lift
 // gate): the tallest top up to SPRING_TOP whose flank and descent fit.
 const wallTo=(c,dir,ga,gate)=>{
  const L=run(c,dir)*SPRING_BAND+ZONE_PAST,room=Math.abs(ga-angle[c]);
  for(let top=SPRING_TOP;top>=TOP_MIN-TOL;top=round2(top-0.1)){
   const f=wallFlank(top-lift.get(c),L);if(!f)continue;
   const dk=descent(top-gate,room-f.width);if(dk)return {top,flank:f,descent:dk,at:angle[c]+dir*f.width};
  }
  throw run(c,dir)>1?tooTight(c):Error(TOO_MANY);
 };
 const sharedTop=new Map();
 const sharedFlanks=i=>{ // spring positions i and i+1 face each other
  if(sharedTop.has(i))return sharedTop.get(i);
  const a=target(i),b=target(i+1),mid=(angle[i]+angle[i+1])/2;
  for(let top=SPRING_TOP;top>=TOP_MIN-TOL;top=round2(top-0.1)){
   const fa=wallFlank(top-lift.get(a),run(a,1)*SPRING_BAND+ZONE_PAST,mid-angle[a]),fb=wallFlank(top-lift.get(b),run(b,-1)*SPRING_BAND+ZONE_PAST,angle[b]-mid);
   if(fa&&fb){const r={top,at:mid,left:fa,right:fb};sharedTop.set(i,r);return r}
  }
  throw tooTight(a);
 };
 centres.forEach((c,k)=>{
  const left=run(c,-1),right=run(c,1);
  if(left){
   const next=c-left-1;
   if(next<1){const s=stopFlank(SPRING_TOP-lift.get(c),angle[c]+58);point(-58,lift.get(c)+s.rise,'crest','');span('profile',s.knots,false)}
   else if(spring(next))span('profile',sharedFlanks(next).right.knots,false);
   // otherwise the previous centre already drew the descent and the top
  }
  point(angle[c],lift.get(c),'gate',String(c));
  if(right){
   const last=c+right,next=last+1;
   if(next>n){const s=stopFlank(SPRING_TOP-lift.get(c),58-angle[c]);span('profile',s.knots,true);point(58,lift.get(c)+s.rise,'crest','');return}
   if(spring(next)){const t=sharedFlanks(last);span('profile',t.left.knots,true);point(t.at,t.top,'crest','');return}
   const w=wallTo(c,1,angle[next],lift.get(next));span('profile',w.flank.knots,true);point(w.at,w.top,'crest','');span('profile',w.descent,true);return;
  }
  const nx=centres[k+1];if(nx===undefined)return;
  if(run(nx,-1)){
   // The next valley's left flank: a descent from its wall top into c, then up the wall.
   const w=wallTo(nx,-1,angle[c],lift.get(c));span('profile',w.descent,false);point(w.at,w.top,'crest','');span('profile',w.flank.knots,false);return;
  }
  // Two plain resting positions: the usual bump between them.
  const G2=angle[nx]-angle[c];span('snap_up');
  if(!lowered(c)&&!lowered(nx)){point((angle[c]+angle[nx])/2,standardBump(G2),'crest','');span('snap_down');return}
  const di=lowered(c)?c:nx,other=di===c?nx:c,r=deepStandard(G2,end(di));
  point(angle[di]+Math.sign(angle[other]-angle[di])*r.f*G2,r.bump,'crest','');span('snap_down');
 });
 // Turn slope knots into profiles over the final spans; plain spans keep their snap shapes.
 const nodes=pts.map((p,i)=>{const {pending,...node}=p;
  if(node.shape==='profile')node.profile=profile(pending.knots,pts[i+1].angle_deg-p.angle_deg,pending.fromStart);
  return node});
 for(let i=0;i+1<nodes.length;i++)if(nodes[i+1].angle_deg-nodes[i].angle_deg<0.5)throw Error(TOO_MANY);
 return {name:n+' positions',assumed_extra_preload_mm:0,lift_floor_mm:SPRING_LIFT_FLOOR,nodes};
}
export function notchRecipe(design){
 const d=normalizeDesign(design);if(!d)throw Error('Invalid notch design');
 if(d.spring)return springRecipe(d);
 const {count:n}=d,p=116/(n-1),D=new Set(d.deep),S=new Set(d.smooth),a=i=>-58+(i-1)*p,deep=i=>D.has(i),end=i=>i===1||i===n;
 const notches=[];for(let i=1;i<=n;i++)if(!S.has(i))notches.push(i);
 // The other side of each gap from notch i: the next notch, or the end of a floor.
 const toward=(k,dir)=>{const i=notches[k],j=notches[k+dir];if(j===undefined)return null;return Math.abs(j-i)===1?{pos:j,deep:deep(j)}:{pos:i+dir,deep:false}};
 const gap=(i,o)=>Math.abs(a(o.pos)-a(i));
 // A Deep is as deep as its tightest gap allows.
 const depth=new Map();
 notches.forEach((i,k)=>{if(!deep(i))return;let v=end(i)?1.9:1.8;
  for(const o of [toward(k,-1),toward(k,1)])if(o){const G=gap(i,o);v=Math.min(v,o.deep?deepDeep(G).depth:deepStandard(G,end(i)).depth)}
  depth.set(i,Math.round(v*100)/100)});
 const lift=i=>deep(i)&&depth.get(i)>0?-depth.get(i):0;
 // The crest between notch i and position o (a notch, or a floor end when floor is true).
 const crest=(i,o,floor)=>{
  const G=gap(i,o),mid=(a(i)+a(o.pos))/2;
  if(deep(i)&&o.deep)return {angle_deg:mid,lift_mm:deepDeep(G).ridge};
  if(!deep(i)&&!o.deep)return {angle_deg:mid,lift_mm:standardBump(G)};
  const di=deep(i)?i:o.pos,other=deep(i)?o.pos:i,r=deepStandard(G,end(di)),dir=Math.sign(a(other)-a(di));
  return {angle_deg:a(di)+dir*r.f*G,lift_mm:floor&&!end(di)?Math.min(r.bump,1.2):r.bump};
 };
 const nodes=[];
 notches.forEach((i,k)=>{
  nodes.push({angle_deg:a(i),lift_mm:lift(i),kind:'gate',label:String(i),shape:'snap_up'});
  if(k===notches.length-1)return;
  const j=notches[k+1];
  if(j===i+1){nodes.push({...crest(i,{pos:j,deep:deep(j)},false),kind:'crest',label:'',shape:'snap_down'});return;}
  const s=i+1,e=j-1;
  nodes.push({...crest(i,{pos:s,deep:false},true),kind:'crest',label:'',shape:'snap_down'});
  if(e>s)nodes.push({angle_deg:a(s),lift_mm:0,kind:'flat',label:'',shape:'cosine'});
  nodes.push({angle_deg:a(e),lift_mm:0,kind:'flat',label:'',shape:'snap_up'});
  nodes.push({...crest(j,{pos:e,deep:false},true),kind:'crest',label:'',shape:'snap_down'});
 });
 return {name:n+' positions',assumed_extra_preload_mm:0,nodes};
}
// How deep each Deep position is cut (mm), for designs where the gaps leave less than the tested depth.
export function deepDepths(design){
 const d=normalizeDesign(design);if(!d)return [];
 const gates=notchRecipe(d).nodes.filter(x=>x.kind==='gate');
 return d.deep.map(pos=>({position:pos,depth:-gates.find(g=>g.label===String(pos)).lift_mm}));
}
export function matchesRecipe(config){
 const d=normalizeDesign(config&&config.design);if(!d||!Array.isArray(config.nodes))return false;
 const r=notchRecipe(d).nodes;
 return r.length===config.nodes.length&&r.every((n,i)=>{const c=config.nodes[i];return c&&Math.abs(n.angle_deg-c.angle_deg)<=TOL&&Math.abs(n.lift_mm-c.lift_mm)<=TOL&&n.shape===c.shape});
}
// Names each notch node from a list of per-position labels (1-based positions, '' keeps the number).
// The list is kept as position_labels so later Standard/Deep/Smooth edits at the same count can reapply it.
export function withLabels(config,labels){
 if(!Array.isArray(labels)||!config.design||labels.length!==config.design.count)return config;
 const nodes=config.nodes.map(n=>{const i=n.kind==='gate'&&/^\d+$/.test(n.label)?Number(n.label):0,l=i?labels[i-1]:'';return l?{...n,label:l}:n});
 return {...config,nodes,position_labels:[...labels]};
}
