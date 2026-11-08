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
// the range is a Standard notch whose floor is stretched flat. Walls are 1.2 mm, and 1.4 mm
// beside a Deep end position (an emergency). A single Smooth position has no floor and feels
// like a Standard notch.
export function notchRecipe(design){
 const d=normalizeDesign(design);if(!d)throw Error('Invalid notch design');
 const {count:n}=d,p=116/(n-1),D=new Set(d.deep),S=new Set(d.smooth),a=i=>-58+(i-1)*p,deep=i=>D.has(i),end=i=>i===1||i===n;
 const lift=i=>deep(i)?(end(i)?-1.9:-1.8):0,nodes=[];
 // Crest between neighbouring positions i<j: midpoint, or F·p from the Deep one.
 const crest=(i,j)=>deep(i)===deep(j)?(a(i)+a(j))/2:deep(i)?a(i)+F*p:a(j)-F*p;
 const wall=i=>deep(i)&&end(i)?1.4:1.2;
 const notches=[];for(let i=1;i<=n;i++)if(!S.has(i))notches.push(i);
 notches.forEach((i,k)=>{
  nodes.push({angle_deg:a(i),lift_mm:lift(i),kind:'gate',label:String(i),shape:'snap_up'});
  if(k===notches.length-1)return;
  const j=notches[k+1];
  if(j===i+1){nodes.push({angle_deg:crest(i,j),lift_mm:deep(i)||deep(j)?1.4:1.2,kind:'crest',label:'',shape:'snap_down'});return;}
  const s=i+1,e=j-1;
  nodes.push({angle_deg:crest(i,s),lift_mm:wall(i),kind:'crest',label:'',shape:'snap_down'});
  if(e>s)nodes.push({angle_deg:a(s),lift_mm:0,kind:'flat',label:'',shape:'cosine'});
  nodes.push({angle_deg:a(e),lift_mm:0,kind:'flat',label:'',shape:'snap_up'});
  nodes.push({angle_deg:crest(e,j),lift_mm:wall(j),kind:'crest',label:'',shape:'snap_down'});
 });
 return {name:n+' positions',assumed_extra_preload_mm:0,nodes};
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
