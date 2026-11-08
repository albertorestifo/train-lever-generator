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
export function notchRecipe(design){
 const d=normalizeDesign(design);if(!d)throw Error('Invalid notch design');
 const {count:n}=d,p=116/(n-1),D=new Set(d.deep),S=new Set(d.smooth),a=i=>-58+(i-1)*p,deep=i=>D.has(i);
 const reach=i=>deep(i)?F*p:p/2,lift=i=>deep(i)?(i===1||i===n?-1.9:-1.8):0,nodes=[];
 const notches=[];for(let i=1;i<=n;i++)if(!S.has(i))notches.push(i);
 notches.forEach((i,k)=>{
  nodes.push({angle_deg:a(i),lift_mm:lift(i),kind:'gate',label:String(i),shape:'snap_up'});
  if(k===notches.length-1)return;
  const j=notches[k+1],h=deep(i)||deep(j)?1.4:1.2;
  if(j===i+1)nodes.push({angle_deg:deep(i)===deep(j)?(a(i)+a(j))/2:deep(i)?a(i)+F*p:a(j)-F*p,lift_mm:h,kind:'crest',label:'',shape:'snap_down'});
  else{const s=a(i)+reach(i),e=a(j)-reach(j);
   if(e-s<0.5)throw Error('Smooth run between positions '+i+' and '+j+' leaves no plateau');
   nodes.push({angle_deg:s,lift_mm:h,kind:'flat',label:'',shape:'cosine'},{angle_deg:e,lift_mm:h,kind:'flat',label:'',shape:'snap_down'});}
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
