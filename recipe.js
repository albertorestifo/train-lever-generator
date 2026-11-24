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
// to the floor. A flank that leads to another position ends in a wall: from a sharp V at the floor
// the spring zone pushes back with a steady SPRING_TORQUE across the spring bands, eases off to
// PRE_WALL, and within KNEE the slope jumps to SLOPE_CAP and climbs to SPRING_TOP. Over the
// rounded top the roller drops at DROP mm/rad into the next position: a resting position between
// walls is the power test disk's "0", a sharp V WALL_GATE deep.
//
// From the power test disk (24 November 2026, Traxx traction layout, printed and tried): the "0"
// V felt exactly right and is reproduced here; the -3.5 mm sharp valley beat the -2.5 mm gentle
// one; its spring areas (push 20-40) recentred too weakly, so they push at SPRING_TORQUE again
// (50, the level that felt best on the push test disk); the clearest wall was the one with the
// weakest push before it (about 22 into 100), not the one with 46 before it, so zones ease off
// to PRE_WALL before the wall.
//
// The budget: the push (spring compression times slope, below) summed over a flank depends only
// on its end lifts, about 860 push·degrees from a -3.5 mm floor to a 2.2 mm top. A rounded top
// and a wall take about half, so a steady-50 zone fits about 8°: the spring bands plus ZONE_PAST.
// More push or longer zones need preload or a stiffer spring, not shape.
//
// Physical limits, all real: the 5 mm roller cannot follow a convex pitch curve tighter than about
// 5.5 mm, so a top rounds off at CURVE_MAX mm/rad²; the pressure angle stays at or under 35°, which
// caps slopes at SLOPE_CAP. Tops stop at SPRING_TOP: 6 mm tops hit the P13 spring block (corner
// 50.36 mm from the shaft), the 2.2 mm test disks cleared it at 50.20. Floors at SPRING_FLOOR, as
// deep as the power test disk ran, with lift_floor_mm on the config. Beside a plain bump a floor is
// only as deep as springDepthCap allows.
//
// Layout: walls and drops have fixed widths, so positions are placed from them. What travel is
// left goes first to spring runs that end at a stop (up to the length that reaches the top at
// SPRING_TORQUE), then to gaps between plain positions, else resting end positions move in from
// the stops and rise into them. When the walls don't fit, every top comes down (to TOP_MIN at
// least) before the design is refused.
const SPRING_BAND=7,ZONE_PAST=1,SPRING_FLOOR=3.5,SPRING_TOP=2.2,TOP_MIN=1.2,CURVE_MAX=400,RAMP=1,KNEE=0.4,WALL_MIN=0.5;
const SLOPE_CAP=30,ZONE_CAP=28,SPRING_TORQUE=50,PRE_WALL=25,EASE=1.5,SPRING_TORQUE_MIN=24,WALL_GATE=1.8,DROP=29,DROP_FOOT=0.5,DETENT=2,STOP_PAD=SPRING_BAND/2;
export const SPRING_LIFT_FLOOR=-SPRING_FLOOR;
export const SPRING_ALL_ONE='Every position springs back to the same one, so the valley would span the whole travel and be too shallow to spring back. A spring-centred lever without a notch disk suits it better.';
const round2=v=>Math.round(v*100)/100,topWidth=s=>s/CURVE_MAX/rad;
// Feel proxy: the reference spring is compressed about 3 + 0.57·lift mm (20 mm free, 17 mm at lift
// 0), so the push on the lever goes with FORCE(lift)·slope. Spring zones keep that product (the
// "torque", T) steady instead of the slope, so a deep floor gets a steeper slope where the spring
// is weak. Slopes stop at SLOPE_CAP for the 35° pressure angle.
const FORCE=h=>Math.max(0.5,3+0.57*h);
const area=k=>{let a=0;for(let i=1;i<k.length;i++)a+=(k[i][1]+k[i-1][1])/2*(k[i][0]-k[i-1][0]);return a*rad};
// Lift along a run of `len` degrees from h0 whose slope is slope(x,h), rising (sign 1) or falling.
function trace(h0,len,slope,sign){
 const N=Math.max(40,Math.ceil(len/0.05)),dx=len/N,H=[h0];let h=h0;
 for(let i=0;i<N;i++){const x=i*dx,hm=h+sign*slope(x,h)*dx*rad/2;h+=sign*slope(x+dx/2,hm)*dx*rad;H.push(h)}
 return x=>{const t=Math.min(N,Math.max(0,x/dx)),i=Math.min(N-1,Math.floor(t));return H[i]+(H[i+1]-H[i])*(t-i)};
}
// Spring zones stay at ZONE_CAP: at the -3.5 mm floor a 30 mm/rad V reaches the 35° pressure angle
// (the power test disk ran its V at about 28).
const steady=(T,h,cap=ZONE_CAP)=>Math.min(cap,T/FORCE(h));
// A spring zone from a floor at h0 over L degrees: the slope ramps up over RAMP (a sharp V, at
// SLOPE_CAP while the spring is too slack for T), then pushes back with torque T; with `ease`, the
// last EASE degrees of a longer run ease off to PRE_WALL.
function zoneKnots(h0,T,L,ease=false){
 const E=ease?EASE:0,Lz=L-E,P=Math.min(T,PRE_WALL);
 const push=x=>x<=Lz?T:T+(P-T)*(x-Lz)/E;
 const slope=(x,h)=>Math.min(1,x/RAMP)*steady(push(x),h),H=trace(h0,L,slope,1);
 const xs=[0,RAMP,...[1,2,3].map(k=>RAMP+(Lz-RAMP)*k/4),Lz,...(E?[L]:[])];
 return xs.map(x=>[x,slope(x,H(x))]);
}
const bisect=(f,lo,hi)=>{for(let i=0;i<60;i++){const m=(lo+hi)/2;f(m)?hi=m:lo=m}return hi};
// A flank from a floor at h0 up a wall to a top `rise` higher: the spring zone (bands, ZONE_PAST,
// then EASE), a sharp knee, the wall at SLOPE_CAP and a rounded top. Knots: [distance from the
// floor (deg), slope (mm/rad)]. With width W the flank must end exactly there (a shared top). Where
// the rise is too small for the full zone and a WALL_MIN wall, the zone's torque comes down, to
// SPRING_TORQUE_MIN at least.
function wallFlank(h0,rise,Lmin,W,T0=SPRING_TORQUE){
 const r=topWidth(SLOPE_CAP);
 const make=(T,L,w)=>({width:L+EASE+KNEE+w+r,T,knots:[...zoneKnots(h0,T,L+EASE,true),[L+EASE+KNEE,SLOPE_CAP],[L+EASE+KNEE+w,SLOPE_CAP],[L+EASE+KNEE+w+r,0]]});
 const lower=L=>{
  const T=bisect(t=>area(make(t,L,WALL_MIN).knots)>=rise,0,T0);
  return T>=SPRING_TORQUE_MIN?make(T,L,WALL_MIN):null;
 };
 if(W===undefined){
  const w=(rise-area(make(T0,Lmin,0).knots))/(SLOPE_CAP*rad);
  return w>=WALL_MIN?make(T0,Lmin,w):lower(Lmin);
 }
 const wmax=W-EASE-KNEE-r-Lmin;if(wmax<WALL_MIN-TOL)return null;
 const at=w=>make(T0,W-EASE-KNEE-w-r,w);
 if(area(at(WALL_MIN).knots)>=rise)return lower(W-EASE-KNEE-WALL_MIN-r);
 if(area(at(wmax).knots)<rise-TOL)return null;
 return at(bisect(w=>area(at(w).knots)>=rise,WALL_MIN,wmax));
}
// From a top down `fall` mm to a position: the top rounds off at CURVE_MAX, the roller drops at
// DROP mm/rad, and the slope closes over DROP_FOOT at the bottom, a sharp V. 2.2 mm down to
// -1.8 mm takes 10.2°, the "0" of the power test disk. A short fall drops less steeply. Given a
// wider width W, the last DETENT mm still drop at DROP, so the position keeps the "0"'s grip, and
// the rest of the fall becomes a gentler ramp from the top.
function drop(fall,W){
 const make=S=>{const r=topWidth(S),mid=fall/(S*rad)-r/2-DROP_FOOT/2;return mid<0?null:{width:r+mid+DROP_FOOT,knots:[[0,0],[r,S],[r+mid,S],[r+mid+DROP_FOOT,0]]}};
 const base=make(DROP)??make(bisect(S=>!make(S),1,DROP));
 if(W===undefined||W<=base.width+TOL||fall<=DETENT+TOL)return base;
 // Steep part: DETENT mm at DROP with its foot; ramp: (fall - DETENT) at S over the rest.
 // The bend from the ramp into the steep part is convex too, so it also rounds at CURVE_MAX.
 const knotsAt=S=>{const r=topWidth(S),kn=topWidth(DROP-S),steep=DETENT/(DROP*rad)-kn/2+DROP_FOOT/2,flat=W-r-kn-steep;return flat<0||steep<DROP_FOOT?null:[[0,0],[r,S],[r+flat,S],[r+flat+kn,DROP],[W-DROP_FOOT,DROP],[W,0]]};
 const S=bisect(S=>{const k=knotsAt(S);return !k||area(k)>=fall},0.1,DROP),k=knotsAt(S);
 return k?{width:W,knots:k}:base;
}
// A spring run ending at a stop: the spring zone up to the stop, rounded off there. Its natural
// length is where the zone at T0 reaches maxRise; a shorter run stops lower. A longer one keeps T0
// for its first `hold` degrees (its spring bands), eases over EASE, and pushes back lightly with
// whatever lift is left across the rest: travel the lever doesn't use, but never a resting spot.
function holdKnots(h0,T,P,hold,L){
 const push=x=>x<=hold?T:x>=hold+EASE?P:T+(P-T)*(x-hold)/EASE;
 const slope=(x,h)=>Math.min(1,x/RAMP)*steady(push(x),h),H=trace(h0,L,slope,1);
 const xs=[0,RAMP,...[1,2].map(k=>RAMP+(hold-RAMP)*k/3),hold,hold+EASE,...[1,2].map(k=>hold+EASE+(L-hold-EASE)*k/3),L];
 return xs.map(x=>[x,slope(x,H(x))]);
}
function stopFlank(h0,maxRise,len,T0=SPRING_TORQUE,hold){
 const zone=(T,L)=>hold!==undefined&&hold+EASE<L-1?holdKnots(h0,T0,Math.min(T,T0),hold,L):zoneKnots(h0,T,L);
 const make=T=>{
  let rr=0,z;for(let i=0;i<4;i++){z=zone(T,len-rr);rr=topWidth(z.at(-1)[1])*1.05}
  return [...zone(T,len-rr),[len,0]];
 };
 let k=make(T0);
 if(area(k)>maxRise)k=make(bisect(T=>area(make(T))>=maxRise,0,T0));
 return {rise:area(k),knots:k};
}
const stopLength=(h0,maxRise)=>bisect(L=>area(stopFlank(h0,1e3,L).knots)>=maxRise,1,58);
// Slope knots measured from one end of a span, as an engine profile over that span.
function profile(knots,span,fromStart){
 const p=knots.map(([x,s])=>[fromStart?x/span:1-x/span,s]);if(!fromStart)p.reverse();
 return p.map(([u,s],i)=>[i===0?0:i===p.length-1?1:Math.min(1,Math.max(0,Math.round(u*1e6)/1e6)),Math.round(s*1000)/1000]);
}
// Gaps between plain positions are never tighter than a plain 13-position disk's (116/12°).
const PLAIN_MIN=116/12;
const TOO_MANY='Too many positions for the travel: a spring-back flank leaves no room beside the next position.';
// How deep a spring floor or a wall's landing can be beside a plain bump across gap G: as deep
// as the bump's snap flank allows at the tested Deep flank slope (3.2 mm over 9°, 20.4 mm/rad),
// and never shallower than a Deep there.
const DEEP_FLANK=20.4;
function springDepthCap(G,atEnd){const r=deepStandard(G,atEnd);return Math.max(r.depth,Math.floor((DEEP_FLANK*r.f*G*rad-r.bump)*100)/100)}
function springRecipe(d){
 const {count:n}=d,to=new Map(d.spring),target=p=>to.get(p)??p,spring=p=>to.has(p),deep=i=>d.deep.includes(i),end=i=>i===1||i===n;
 const run=(c,dir)=>{let k=0;for(let q=c+dir;q>=1&&q<=n&&to.get(q)===c;q+=dir)k++;return k};
 const centres=[];for(let i=1;i<=n;i++)if(!spring(i))centres.push(i);
 if(centres.length<2)throw Error(SPRING_ALL_ONE);
 const tooTight=c=>Error(`Position ${c} has too many positions springing back to it for the room beside it: its spring zone would be too shallow to spring back.`);
 const zoneLen=(c,dir)=>run(c,dir)*SPRING_BAND+ZONE_PAST;
 // Resting lifts: valley floors at SPRING_FLOOR, positions a wall drops into at WALL_GATE, Deep as
 // usual; each limited by a plain bump beside it (plain gap G, known after a first layout).
 const lifts=G=>{
  const lift=new Map();
  centres.forEach((c,k)=>{
   const floor=run(c,-1)||run(c,1),wallSide=(c>1&&spring(c-1))||(c<n&&spring(c+1));
   let v=floor?SPRING_FLOOR:deep(c)?(end(c)?1.9:1.8):wallSide?WALL_GATE:0;
   if(v&&G)for(const j of [centres[k-1],centres[k+1]])if(j!==undefined&&Math.abs(j-c)===1)v=Math.min(v,deep(c)?deepStandard(G,end(c)).depth:springDepthCap(G,end(c)));
   lift.set(c,-round2(v));
  });
  return lift;
 };
 // Fixed shapes between neighbouring centres for a given top; plain gaps (null) are flexible. A
 // drop into a position with a wall on both sides is the fixed "0"; drops into an end position or
 // a valley floor may stretch to take spare travel.
 // A plain resting position whose neighbours both spring back to other positions: walls on both sides.
 const between=c=>c>1&&c<n&&spring(c-1)&&spring(c+1)&&target(c-1)!==c&&target(c+1)!==c;
 const shapes=(lift,top)=>{
  const flank=(c,dir)=>wallFlank(lift.get(c),top-lift.get(c),zoneLen(c,dir));
  const gaps=[];
  for(let k=0;k+1<centres.length;k++){
   const a=centres[k],b=centres[k+1],ra=run(a,1),lb=run(b,-1);
   if(ra&&lb){const fa=flank(a,1),fb=flank(b,-1);if(!fa||!fb)throw tooTight(fa?b:a);gaps.push({kind:'shared',fa,fb,width:fa.width+fb.width})}
   else if(ra||lb){const c=ra?a:b,into=ra?b:a,f=flank(c,ra?1:-1);if(!f)throw tooTight(c);const fall=top-lift.get(into),dr=drop(fall);gaps.push({kind:ra?'right':'left',f,dr,fall,stretch:!between(into),width:f.width+dr.width})}
   else gaps.push({kind:'plain',width:null});
  }
  return gaps;
 };
 // Ends: a spring run to the stop or a plain position moved in from it; each wants the length
 // that reaches the top at SPRING_TORQUE (a spring run needs at least its bands).
 const ends=(lift,top)=>[[centres[0],-1],[centres.at(-1),1]].map(([c,dir])=>{
  const r=run(c,dir),natural=stopLength(lift.get(c),top-lift.get(c));
  return r?{spring:true,min:r*SPRING_BAND+STOP_PAD,want:Math.max(r*SPRING_BAND+STOP_PAD,natural),hold:r*SPRING_BAND+ZONE_PAST}:{spring:false,min:0,want:natural};
 });
 // A neutral "0" (a resting position with a wall on each side, the only one) sits at 0°, as on the
 // real lever: each half of the travel is laid out on its own. Without one, or when a half
 // doesn't fit, the whole travel is laid out together.
 const neutral=centres.filter(between),k0=neutral.length===1?centres.indexOf(neutral[0]):-1;
 const fill=(gaps,E,gi,ei,room,len)=>{
  const mine=gi.map(i=>gaps[i]),plain=mine.filter(g=>g.kind==='plain');
  let spare=room-mine.reduce((s,g)=>s+(g.width??0),0)-ei.reduce((s,i)=>s+E[i].min,0);
  if(spare<-TOL)return false;
  for(const i of ei)len[i]=E[i].min;
  const give=i=>{const add=Math.min(spare,E[i].want-E[i].min);len[i]+=add;spare-=add};
  // Spring runs to a stop first, then gaps between plain positions, then plain ends up to their
  // natural length, then drops that may stretch; what is still left moves plain ends further in,
  // or lengthens a spring run past its bands as unused travel.
  for(const i of ei)if(E[i].spring)give(i);
  if(plain.length){if(spare/plain.length<PLAIN_MIN-TOL)return false;for(const g of plain)g.width=spare/plain.length;spare=0}
  for(const i of ei)if(!E[i].spring)give(i);
  const stretch=mine.filter(g=>g.stretch);
  if(stretch.length&&spare>TOL){for(const g of stretch){const w=g.dr.width+spare/stretch.length;g.dr=drop(g.fall,w);g.width=g.f.width+g.dr.width}spare=0}
  if(spare>TOL){const take=ei.filter(i=>!E[i].spring),into=take.length?take:ei;if(!into.length)return false;for(const i of into)len[i]+=spare/into.length}
  return true;
 };
 const layout=(lift,top)=>{
  const all=centres.slice(0,-1).map((_,i)=>i);
  if(k0>0&&k0<centres.length-1){
   const gaps=shapes(lift,top),E=ends(lift,top),len=[0,0];
   const fa=fill(gaps,E,all.slice(0,k0),[0],58,len),fb=fill(gaps,E,all.slice(k0),[1],58,len);if(fa&&fb)return {gaps,len,E};
  }
  const gaps=shapes(lift,top),E=ends(lift,top),len=[0,0];
  return fill(gaps,E,all,[0,1],116,len)?{gaps,len,E}:null;
 };
 let lift=lifts(0),top=SPRING_TOP,L=null;
 for(;top>=TOP_MIN-TOL;top=round2(top-0.1)){try{L=layout(lift,top)}catch(e){if(top-0.1<TOP_MIN-TOL)throw e;continue}if(L)break}
 if(!L)throw Error(TOO_MANY);
 const plainG=L.gaps.find(g=>g.kind==='plain');
 if(plainG){const l2=lifts(plainG.width);if([...l2].some(([c,v])=>v!==lift.get(c))){lift=l2;L=layout(lift,top);if(!L)throw Error(TOO_MANY)}}
 const angle=new Map([[centres[0],-58+L.len[0]]]);
 centres.slice(1).forEach((c,k)=>angle.set(c,angle.get(centres[k])+L.gaps[k].width));
 // Points left to right; each carries the shape of the span to the next point.
 const pts=[],point=(a,h,kind,label)=>pts.push({angle_deg:a,lift_mm:round2(h),kind,label,shape:'snap_up'});
 const span=(shape,knots,fromStart)=>{const p=pts.at(-1);p.shape=shape;p.pending=knots?{knots,fromStart}:null};
 const lowered=c=>lift.get(c)<0;
 const first=centres[0],last=centres.at(-1);
 if(L.len[0]>TOL){const s=stopFlank(lift.get(first),top-lift.get(first),L.len[0],SPRING_TORQUE,L.E[0].hold);point(-58,lift.get(first)+s.rise,'crest','');span('profile',s.knots,false)}
 centres.forEach((c,k)=>{
  point(angle.get(c),lift.get(c),'gate',String(c));
  const g=L.gaps[k];
  if(!g){if(L.len[1]>TOL){const s=stopFlank(lift.get(c),top-lift.get(c),L.len[1],SPRING_TORQUE,L.E[1].hold);span('profile',s.knots,true);point(58,lift.get(c)+s.rise,'crest','')}return}
  const nx=centres[k+1],at=angle.get(c);
  if(g.kind==='shared'){span('profile',g.fa.knots,true);point(at+g.fa.width,top,'crest','');span('profile',g.fb.knots,false)}
  else if(g.kind==='right'){span('profile',g.f.knots,true);point(at+g.f.width,top,'crest','');span('profile',g.dr.knots,true)}
  else if(g.kind==='left'){span('profile',g.dr.knots,false);point(at+g.dr.width,top,'crest','');span('profile',g.f.knots,false)}
  else{
   // Two plain resting positions: the usual bump between them.
   const G2=angle.get(nx)-at;span('snap_up');
   if(!lowered(c)&&!lowered(nx)){point(at+G2/2,standardBump(G2),'crest','');span('snap_down');return}
   const di=lowered(c)?c:nx,other=di===c?nx:c,r=deepStandard(G2,end(di));
   point(angle.get(di)+Math.sign(angle.get(other)-angle.get(di))*r.f*G2,r.bump,'crest','');span('snap_down');
  }
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
export const springParts={wallFlank,drop,stopFlank,profile};
