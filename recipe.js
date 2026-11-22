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
// and each spring position is a band on a flank that rises to a crest. Released anywhere on a
// flank, the roller slides back to the floor, like a Standard notch's flank but wide. Nothing sits
// on a flank (the engine gives every node zero slope, which would be a resting point), so the
// spring positions are angles only. Flanks use the tested snap shapes from the floor: steep just
// off the floor (a strong return at the centre) and rounding gently into the crest, which the
// roller must be able to follow.
//
// Bands are SPRING_BAND° wide and the crest sits SPRING_APPROACH° past the outermost band, so the
// bands stay on the steep part of the flank. A flank rises at SPRING_SLOPE mm/rad on average,
// keeping the outer band edge near the tested Standard flank (1.2 mm over 7.25°, ~9.5 mm/rad);
// at the lift limit it may fall to SPRING_SLOPE_MIN, still above that.
// The floor drops below 0 only when a crest would pass the 3 mm lift limit, and never below the
// tested Deep depth. Inside a valley, positions are a band apart; the rest of the travel is shared
// evenly by the other gaps. Two valleys whose spring positions face each other share one crest,
// since a low point between them would be a place the lever stays. None of this has been printed.
const SPRING_BAND=7,SPRING_APPROACH=6,SPRING_SLOPE=12,SPRING_SLOPE_MIN=10,SPRING_FLOOR_MIN=-1.9,LIFT_MAX=3,SPRING_DESCENT=6;
export const SPRING_ALL_ONE='Every position springs back to the same one, so the valley would span the whole travel and be too shallow to spring back. A spring-centred lever without a notch disk suits it better.';
function springRecipe(d){
 const {count:n}=d,to=new Map(d.spring),target=p=>to.get(p)??p,spring=p=>to.has(p);
 const valley=(i,j)=>target(i)===target(j);
 let fixed=0,free=0;for(let i=1;i<n;i++)valley(i,i+1)?fixed+=SPRING_BAND:free++;
 if(!free)throw Error(SPRING_ALL_ONE);
 // An end spring position gets half a band before the stop, so its band ends at the stop.
 const pad=p=>spring(p)?SPRING_BAND/2:0,G=(116-pad(1)-pad(n)-fixed)/free;
 const angle=[null,-58+pad(1)];for(let i=1;i<n;i++)angle.push(angle[i]+(valley(i,i+1)?SPRING_BAND:G));
 const centres=[];for(let i=1;i<=n;i++)if(!spring(i))centres.push(i);
 const run=(c,dir)=>{let k=0;for(let q=c+dir;q>=1&&q<=n&&to.get(q)===c;q+=dir)k++;return k};
 const deep=i=>d.deep.includes(i);
 // Where each flank ends: at the stop for an end valley, halfway across a shared gap, or past its
 // outermost band otherwise; a flank's rise follows from its length.
 const flankEnd=(c,dir)=>{
  const k=run(c,dir),last=c+dir*k,next=last+dir;
  if(next<1||next>n)return {angle:dir<0?-58:58,shared:false};
  if(spring(next))return {angle:(angle[last]+angle[next])/2,shared:true};
  return {angle:angle[last]+dir*(SPRING_BAND/2+SPRING_APPROACH),shared:false};
 };
 const rise=(c,end)=>SPRING_SLOPE*Math.abs(end-angle[c])*rad;
 const floor=new Map(),crestLift=new Map();
 for(const c of centres){
  const sides=[-1,1].filter(dir=>run(c,dir)).map(dir=>flankEnd(c,dir));
  if(!sides.length)continue;
  // Aim for SPRING_SLOPE; within the lift range a flank may fall to SPRING_SLOPE_MIN, still above
  // the tested Standard flank, and no further.
  const top=Math.max(...sides.map(s=>rise(c,s.angle))),f=Math.round(Math.max(SPRING_FLOOR_MIN,Math.min(0,LIFT_MAX-top))*100)/100;
  floor.set(c,f);
  for(const s of sides){
   const key=s.angle.toFixed(6),h=Math.round(Math.min(LIFT_MAX,f+rise(c,s.angle))*100)/100;
   if((h-f)/(Math.abs(s.angle-angle[c])*rad)<SPRING_SLOPE_MIN-TOL)
    throw Error(`Position ${c} has too many positions springing back to it: its flank would be too shallow to spring back within the ${LIFT_MAX-SPRING_FLOOR_MIN} mm of lift.`);
   crestLift.set(key,Math.max(crestLift.get(key)??-Infinity,h));
  }
 }
 // A plain resting position between two plain ones keeps the Standard/Deep rules on its real gaps.
 const plainDepth=i=>{if(!deep(i))return 0;let v=i===1||i===n?1.9:1.8;
  for(const j of [i-1,i+1])if(j>=1&&j<=n)v=Math.min(v,deepStandard(Math.abs(angle[j]-angle[i]),i===1||i===n).depth);
  return Math.round(v*100)/100};
 const nodes=[],crest=(a)=>nodes.push({angle_deg:a,lift_mm:crestLift.get(a.toFixed(6)),kind:'crest',label:'',shape:'snap_down'});
 centres.forEach((c,k)=>{
  const left=run(c,-1),right=run(c,1);
  if(left){const e=flankEnd(c,-1);if(!e.shared)crest(e.angle)}
  nodes.push({angle_deg:angle[c],lift_mm:floor.has(c)?floor.get(c):-plainDepth(c),kind:'gate',label:String(c),shape:'snap_up'});
  if(right){const e=flankEnd(c,1);crest(e.angle);return}
  const next=centres[k+1];if(next===undefined||run(next,-1))return;
  // Two plain resting positions: the usual bump between them.
  const G2=angle[next]-angle[c];
  if(!deep(c)&&!deep(next)){nodes.push({angle_deg:(angle[c]+angle[next])/2,lift_mm:standardBump(G2),kind:'crest',label:'',shape:'snap_down'});return}
  const di=deep(c)?c:next,other=di===c?next:c,r=deepStandard(G2,di===1||di===n);
  nodes.push({angle_deg:angle[di]+Math.sign(angle[other]-angle[di])*r.f*G2,lift_mm:r.bump,kind:'crest',label:'',shape:'snap_down'});
 });
 // A crest must leave room to climb from, and drop into, the resting position beside it.
 for(let i=0;i+1<nodes.length;i++){const [a,b]=[nodes[i],nodes[i+1]];
  if(a.kind!==b.kind&&b.angle_deg-a.angle_deg<SPRING_DESCENT-TOL)
   throw Error('Too many positions for the travel: a spring-back flank leaves no room beside the next position.')}
 return {name:n+' positions',assumed_extra_preload_mm:0,nodes};
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
