// Standard/Deep/Smooth notch recipe: turns simple position choices into engine nodes. Positions are 1-based.
export const DEFAULT_DESIGN={count:9,deep:[5,9],smooth:[]};
const F=9/14.5,TOL=1e-9;
const ints=(v,lo,hi)=>Array.isArray(v)&&v.every(x=>Number.isInteger(x)&&x>=lo&&x<=hi)?[...new Set(v)].sort((a,b)=>a-b):null;
export function normalizeDesign(v){
 if(!v||typeof v!=='object'||!Number.isInteger(v.count)||v.count<2||v.count>13)return null;
 const deep=ints(v.deep,1,v.count),smooth=ints(v.smooth,2,v.count-1);
 if(!deep||!smooth||smooth.some(x=>deep.includes(x)))return null;
 return {count:v.count,deep,smooth};
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
export function notchRecipe(design){
 const d=normalizeDesign(design);if(!d)throw Error('Invalid notch design');
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
