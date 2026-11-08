// Pure state helpers for the simple Standard/Deep/Smooth view. Positions are 1-based.
import {DEFAULT_DESIGN,normalizeDesign,matchesRecipe,notchRecipe,withLabels,deepDepths} from './recipe.js';
const WORD={standard:'Standard',deep:'Deep',smooth:'Smooth'},cap=s=>WORD[s];
export const stateOf=(d,p)=>d.deep.includes(p)?'deep':d.smooth.includes(p)?'smooth':'standard';
export function cycle(d,p){
 const end=p===1||p===d.count,cur=stateOf(d,p),next=cur==='standard'?'deep':cur==='deep'&&!end?'smooth':'standard';
 const out=x=>x.filter(v=>v!==p),add=(x,on)=>on?[...x,p].sort((a,b)=>a-b):x;
 return {design:{count:d.count,deep:add(out(d.deep),next==='deep'),smooth:add(out(d.smooth),next==='smooth')},next};
}
export const withCount=(d,count)=>({count,deep:d.deep.filter(p=>p<=count),smooth:d.smooth.filter(p=>p<count)});
export const chipRefusal=(p,next,count)=>`Position ${p} can't be ${cap(next)} here: with ${count} positions the notches are too close for the roller to follow.`;
export const countRefusal=count=>`${count} positions don't fit with these Deep positions.`;
export function viewOf(config){
 const design=normalizeDesign(config&&config.design);
 let ok=false;try{ok=matchesRecipe(config)}catch{}
 return ok?{mode:'simple',design}:{mode:'fine-tuned',design};
}
export const fileStem=config=>{const v=viewOf(config);return v.mode==='simple'?`notch-disk-${v.design.count}-positions`:'notch-disk-custom'};
const OK='✓ Ready to print. ';
export function statusText(design){
 const d=normalizeDesign(design),def=normalizeDesign(DEFAULT_DESIGN);
 if(d&&JSON.stringify(d)===JSON.stringify(def))return OK+'This is the disk tested on the Class 323 lever.';
 const shallow=d?deepDepths(d).filter(x=>x.depth<1.8):[];
 const deepNote=shallow.length?` With ${d.count} positions the notches are close, so Deep is shallower here (${shallow.map(x=>`position ${x.position}: ${x.depth.toFixed(2)} mm`).join(', ')}, against 1.8 mm on the tested disk). It holds less than a full Deep and has not been tried on a real lever.`:'';
 return OK+'Uses the same Standard and Deep shapes as the tested disk, but only the 9-position disk has been tried on a real lever.'+(d&&d.smooth.length?' Smooth ranges have not been tried on a real lever.':'')+deepNote;
}
// A design opened from a link, e.g. one Trenino builds from a calibrated lever:
// ?positions=6&deep=1,3&smooth=2,4,5&label=Emergency&label=&label=Off&label=&label=&label=Power&name=BR430
// Returns {design,labels,name} or null when the link holds no valid design. Labels count only when there is one per position.
export function linkDesign(search){
 const p=search instanceof URLSearchParams?search:new URLSearchParams(search??'');
 const raw=p.get('positions');if(raw===null||!/^\d+$/.test(raw))return null;
 const list=k=>{const v=p.get(k);if(v===null||v.trim()==='')return [];const x=v.split(',');return x.every(t=>/^\s*\d+\s*$/.test(t))?x.map(Number):null};
 const design=normalizeDesign({count:Number(raw),deep:list('deep'),smooth:list('smooth')});if(!design)return null;
 const labels=p.getAll('label').map(l=>l.trim().slice(0,40)),name=(p.get('name')??'').trim().slice(0,80);
 return {design,labels:labels.length===design.count?labels:null,name:name||null};
}
// The editor config for a link, optionally with a different design at the same count (a fallback).
export function linkConfig(link,design=link.design){
 const base={...notchRecipe(design),design};if(link.name)base.name=link.name;
 return link.labels?withLabels(base,link.labels):base;
}
