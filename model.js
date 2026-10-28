import {FIXED} from './engine.js';
// One lossless configuration serves both the guided and advanced editor.
const clone=value=>structuredClone(value);
export function importDraft(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.nodes)||value.nodes.length>101||value.nodes.some(n=>!n||typeof n!=='object'||Array.isArray(n)))throw Error('Settings need an object with at most 101 point objects in nodes.');
 for(const n of value.nodes)for(const key of ['angle_deg','lift_mm'])if(key in n&&typeof n[key]!=='number'&&typeof n[key]!=='string'&&n[key]!==null)throw Error('Point angles and lifts must be numbers or incomplete draft values.');
 return clone(value);
}
export function intervalForSelection(selection,count){return count<2?null:Math.min(selection.index,count-2)}
export function draftIssues(config){
 const n=config.nodes,issues=[],add=(message,indices=[])=>issues.push({message,indices});
 if(n.length<3||n.length>101)add('Use 3–101 points.');
 n.forEach((p,i)=>{
  if(!Number.isFinite(p.angle_deg))add(`Point ${i+1}: complete its angle.`,[i]);
  if(!Number.isFinite(p.lift_mm))add(`Point ${i+1}: complete its lift.`,[i]);
  else if(p.lift_mm<0||p.lift_mm>FIXED.max_lift_mm)add(`Point ${i+1}: roller lift must be 0–${FIXED.max_lift_mm} mm.`,[i]);
  if(!['cosine','quintic','linear_blend'].includes(p.shape??'cosine'))add(`Point ${i+1}: choose a supported outgoing ramp shape.`,[i]);
  if(i&&Number.isFinite(p.angle_deg)&&Number.isFinite(n[i-1].angle_deg)&&p.angle_deg-n[i-1].angle_deg<.5)add(`Between points ${i} and ${i+1}: keep increasing angles at least 0.5° apart.`,[i-1,i]);
 });
 if(n.length&&Number.isFinite(n[0].angle_deg)&&Math.abs(n[0].angle_deg+58)>1e-8)add('The first point must stay at −58° to match the stop.',[0]);
 if(n.length&&Number.isFinite(n.at(-1).angle_deg)&&Math.abs(n.at(-1).angle_deg-58)>1e-8)add('The final point must stay at +58° to match the stop.',[n.length-1]);
 const p=config.assumed_extra_preload_mm??0;if(!Number.isFinite(p)||p<0||p>1)add('Extra preload assumption must be a number from 0 to 1 mm.');
 return issues;
}
export class EditorModel{
 constructor(config){this.config=importDraft(config);this.selection={kind:'point',index:0};this.past=[];this.future=[];this.group=null;}
 get canUndo(){return this.past.length>0}get canRedo(){return this.future.length>0}
 snapshot(){return {config:clone(this.config),selection:clone(this.selection)}}
 endGroup(){this.group=null}
 select(kind,index){this.endGroup();this.selection={kind,index};this.clampSelection();}
 clampSelection(){const n=this.config.nodes.length;this.selection.index=Math.max(0,Math.min(this.selection.index,n-(this.selection.kind==='span'?2:1)));if(n<2)this.selection.kind='point';}
 change(fn,group=null){
  const before=this.snapshot();fn();this.clampSelection();
  if(JSON.stringify(before.config)===JSON.stringify(this.config))return false;
  if(!group||group!==this.group){this.past.push(before);if(this.past.length>150)this.past.shift();}
  this.future=[];this.group=group;return true;
 }
 editNode(index,key,value,group=null){return this.change(()=>{this.config.nodes[index][key]=value},group)}
 editGlobal(key,value,group=null){return this.change(()=>{this.config[key]=value},group)}
 replace(config){const next=importDraft(config);return this.change(()=>{this.config=next;this.selection={kind:'point',index:0}})}
 undo(){if(!this.canUndo)return;this.future.push(this.snapshot());const s=this.past.pop();this.config=s.config;this.selection=s.selection;this.endGroup();}
 redo(){if(!this.canRedo)return;this.past.push(this.snapshot());const s=this.future.pop();this.config=s.config;this.selection=s.selection;this.endGroup();}
 insertPoint(){
  const i=intervalForSelection(this.selection,this.config.nodes.length);if(i===null)throw Error('Add or import a layout with at least two points first.');
  const a=this.config.nodes[i],b=this.config.nodes[i+1];
  if(this.config.nodes.length>=101)throw Error('The mechanism supports at most 101 motion points.');
  if(!Number.isFinite(a.angle_deg)||!Number.isFinite(b.angle_deg)||b.angle_deg-a.angle_deg<1)throw Error('Choose a span at least 1 degree wide with valid endpoint angles.');
  if(!Number.isFinite(a.lift_mm)||!Number.isFinite(b.lift_mm))throw Error('Complete both endpoint lifts before inserting a point.');
  this.change(()=>{this.config.nodes.splice(i+1,0,{angle_deg:(a.angle_deg+b.angle_deg)/2,lift_mm:(a.lift_mm+b.lift_mm)/2,kind:'flat',label:'',shape:a.shape??'cosine'});this.selection={kind:'point',index:i+1}});
 }
 removePoint(i){if(this.config.nodes.length<=3)throw Error('Keep at least three points.');if(i===0||i===this.config.nodes.length-1)throw Error('The two endpoint stops are retained.');this.change(()=>{this.config.nodes.splice(i,1);this.selection={kind:'point',index:Math.min(i,this.config.nodes.length-1)}})}
 sort(){if(this.config.nodes.some(n=>!Number.isFinite(n.angle_deg)))throw Error('Complete every angle before sorting.');this.change(()=>{this.config.nodes.sort((a,b)=>a.angle_deg-b.angle_deg);this.selection={kind:'point',index:0}})}
}
