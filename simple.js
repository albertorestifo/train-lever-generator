// Pure state helpers for the simple Standard/Deep/Smooth view. Positions are 1-based.
import {DEFAULT_DESIGN,normalizeDesign,matchesRecipe} from './recipe.js';
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
 return OK+'Uses the same Standard and Deep shapes as the tested disk, but only the 9-position disk has been tried on a real lever.'+(d&&d.smooth.length?' Smooth ranges have not been tried on a real lever.':'');
}
