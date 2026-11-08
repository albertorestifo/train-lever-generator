import {EditorModel,draftIssues,intervalForSelection,importDraft} from './model.js';
import {evenlySpaced,ease,FIXED,SHAPES} from './engine.js';
import './shape-help.js';
import {notchRecipe,normalizeDesign,DEFAULT_DESIGN} from './recipe.js';
import {stateOf,cycle,withCount,chipRefusal,countRefusal,viewOf,fileStem,statusText,linkDesign,linkConfig} from './simple.js';
const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model=null,presets={},revision=0,timer=null,worker=null,lastValid=null,downloadUrls=[],issues=[],validatedRevision=null,checking=false,generating=false,focusAfter=null;
const number=value=>value===''?'':Number(value);
const pointName=(n,i)=>String(n?.label||`Point ${i+1}`);
const selectionValue=s=>`${s.kind}:${s.index}`;
function selections(){return model.config.nodes.flatMap((_,i)=>i<model.config.nodes.length-1?[{kind:'point',index:i},{kind:'span',index:i}]:[{kind:'point',index:i}])}
const SHAPE_LABELS={cosine:'Cosine',quintic:'Quintic',linear_blend:'Linear blend',snap_up:'Snap rising',snap_down:'Snap falling',gate:'Notch',crest:'Bump',flat:'Flat'};
function options(values,value){const all=values.includes(value)?values:[...values,value];return all.map(v=>`<option value="${escape(v)}"${v===value?' selected':''}>${escape(SHAPE_LABELS[v]??v)}</option>`).join('')}
function input(i,key,label,{type='number',readonly=false}={}){
 const v=model.config.nodes[i]?.[key]??'';
 return `<label${type==='text'?' class="wide"':''}>${escape(label)}<input data-node="${i}" data-field="${key}" type="${type}" ${type==='number'?'step="any"':''} value="${escape(v)}"${readonly?' readonly':''} aria-label="${escape(label)} for point ${i+1}"></label>`;
}
function selectInput(i,key,label,values){const v=model.config.nodes[i]?.[key]??(key==='shape'?'cosine':'flat');return `<label>${escape(label)}<select data-node="${i}" data-field="${key}" aria-label="${escape(label)} for point ${i+1}">${options(values,v)}</select></label>`}
function renderSelection(){
 const list=selections(),n=model.config.nodes;
 $('selection').innerHTML=list.map(s=>`<option value="${selectionValue(s)}">${escape(s.kind==='point'?`${s.index+1}. ${pointName(n[s.index],s.index)}`:`Ramp ${s.index+1} → ${s.index+2}`)}</option>`).join('');
 $('selection').value=selectionValue(model.selection);$('selection').disabled=!list.length;
 const at=list.findIndex(s=>selectionValue(s)===selectionValue(model.selection));$('previous').disabled=at<=0;$('next').disabled=at<0||at===list.length-1;
 $('point-count').textContent=`${n.filter(p=>p.kind==='gate').length} marked notches · ${n.length} points`;
}
function renderInspector(){
 const {kind,index:i}=model.selection,n=model.config.nodes,p=n[i];
 if(!p){$('inspector').innerHTML='<p>Start from a preset or create a layout above.</p>';$('new-layout').open=true;return;}
 if(kind==='span'){
  const b=n[i+1];
  $('inspector').innerHTML=`<h3 id="selected-title">Ramp ${i+1} → ${i+2}</h3><p class="muted small">From ${escape(pointName(p,i))} to ${escape(pointName(b,i+1))}. The shape applies only to this span.</p><div class="neighbor-grid"><div><h4>Start</h4><div class="fields">${input(i,'angle_deg','Start angle °')}${input(i,'lift_mm','Start height mm')}</div></div><div><h4>End</h4><div class="fields">${input(i+1,'angle_deg','End angle °')}${input(i+1,'lift_mm','End height mm')}</div></div></div><div class="fields">${selectInput(i,'shape','Transition shape',SHAPES)}</div><p id="selection-context" class="muted small"></p>`;
 }else{
  const neighbor=(j,title)=>j<0||j>=n.length?'':`<div class="neighbor"><h4>${title}: ${escape(pointName(n[j],j))}</h4><div class="fields">${input(j,'angle_deg','Neighbor angle °')}${input(j,'lift_mm','Neighbor height mm')}</div><p>Shared with the next ramp on that side.</p></div>`;
  $('inspector').innerHTML=`<h3 id="selected-title">${escape(pointName(p,i))}</h3><div class="fields">${input(i,'label','Label',{type:'text'})}${input(i,'angle_deg','Position °')}${input(i,'lift_mm','Height mm')}${selectInput(i,'kind','Type / annotation',['gate','crest','flat'])}</div><p class="muted small">A notch is a low point between higher barriers. Changing its type alone does not reshape it.</p><div class="neighbor-grid">${neighbor(i-1,'Previous point (− angle)')}${neighbor(i+1,'Next point (+ angle)')}</div><p id="selection-context" class="muted small"></p>`;
 }
 renderContext();
}
function renderContext(){
 const target=$('selection-context');if(!target)return;const n=model.config.nodes,{index:i,kind}=model.selection,a=n[i],b=n[i+1];
 if(kind==='point'&&$('selected-title'))$('selected-title').textContent=pointName(a,i);
 if(kind==='span'&&a&&b){const valid=[a.angle_deg,b.angle_deg,a.lift_mm,b.lift_mm].every(Number.isFinite);target.textContent=valid?`Width ${(b.angle_deg-a.angle_deg).toFixed(3)}°. Height change ${(b.lift_mm-a.lift_mm).toFixed(3)} mm. ${a.lift_mm===b.lift_mm?'Equal heights create smooth, constant-height travel; all shapes are equivalent here.':'Both endpoints are shared with neighboring spans.'}`:'Complete the endpoint values to see this span’s dimensions.';}
 else{const parts=[];if(i&&Number.isFinite(a?.lift_mm)&&Number.isFinite(n[i-1].lift_mm))parts.push(`Previous neighbor is ${(n[i-1].lift_mm-a.lift_mm).toFixed(3)} mm above this point`);if(b&&Number.isFinite(a?.lift_mm)&&Number.isFinite(b.lift_mm))parts.push(`next neighbor is ${(b.lift_mm-a.lift_mm).toFixed(3)} mm above`);target.textContent=parts.join('; ')+'. Edits to a shared barrier affect both adjacent ramps.';}
}
function renderTable(){
 $('nodes').innerHTML=model.config.nodes.map((n,i)=>`<tr data-row="${i}"><td><button data-select-point="${i}" aria-label="Select point ${i+1}">${i+1}</button></td><td>${input(i,'label','Label',{type:'text'})}</td><td>${input(i,'angle_deg','Angle °')}</td><td>${input(i,'lift_mm','Height mm')}</td><td>${selectInput(i,'kind','Type',['gate','crest','flat'])}</td><td>${i<model.config.nodes.length-1?selectInput(i,'shape','Shape to next',SHAPES):'<span class="muted">End stop</span>'}</td></tr>`).join('');
}
function renderGraph(){
 const n=model.config.nodes,bad=new Set(issues.flatMap(x=>x.indices));
 if(!n.length){$('travel').innerHTML='<p class="empty-graph">No points yet. Create a layout to begin.</p>';return;}
 const finite=n.filter(p=>Number.isFinite(p.angle_deg)&&Number.isFinite(p.lift_mm));
 if(!finite.length){$('travel').innerHTML='<p class="empty-graph">Complete point angles and lifts in Advanced points. Your draft is retained.</p>';return;}
 const lo=Math.min(-58,...finite.map(p=>p.angle_deg)),hi=Math.max(58,...finite.map(p=>p.angle_deg)),bottom=Math.min(0,...finite.map(p=>p.lift_mm)),top=Math.max(FIXED.max_lift_mm,...finite.map(p=>p.lift_mm));
 const x=v=>40+(v-lo)/(hi-lo)*660,y=v=>170-(v-bottom)/(top-bottom)*125;
 let drawing=`<path d="M40 30V170H710" fill="none" stroke="#c8d4de"/><text x="5" y="36">Height</text><text x="7" y="51">mm</text><text x="7" y="170">${bottom}</text>${bottom<0?`<path d="M40 ${y(0).toFixed(2)}H710" stroke="#e3e9ef"/><text x="7" y="${(y(0)+4).toFixed(2)}">0</text>`:''}<text x="7" y="70">${top.toFixed(1)}</text><text x="40" y="206">${lo.toFixed(1)}°</text><text x="660" y="206">${hi.toFixed(1)}°</text>`;
 n.forEach((a,i)=>{const b=n[i+1];if(!b||![a.angle_deg,a.lift_mm,b.angle_deg,b.lift_mm].every(Number.isFinite))return;
  const shape=a.shape??'cosine',known=SHAPES.includes(shape),path=Array.from({length:31},(_,j)=>{const u=j/30,h=a.lift_mm+(b.lift_mm-a.lift_mm)*(known?ease(u,shape)[0]:u);return `${j?'L':'M'}${x(a.angle_deg+u*(b.angle_deg-a.angle_deg)).toFixed(2)},${y(h).toFixed(2)}`}).join(' ');
  drawing+=`<g role="button" tabindex="0" data-kind="span" data-index="${i}" aria-label="Select ramp ${i+1} to ${i+2}" class="${model.selection.kind==='span'&&model.selection.index===i?'selected':''}"><path d="${path}" class="ramp"/><path d="${path}" class="hit"/></g>`;
 });
 n.forEach((p,i)=>{if(!Number.isFinite(p.angle_deg)||!Number.isFinite(p.lift_mm))return;const selected=model.selection.kind==='point'&&model.selection.index===i;drawing+=`<g role="button" tabindex="0" data-kind="point" data-index="${i}" aria-label="Select point ${i+1}: ${escape(pointName(p,i))}" class="${selected?'selected ':''}${bad.has(i)?'invalid':''}"><circle cx="${x(p.angle_deg)}" cy="${y(p.lift_mm)}" r="11" fill="transparent"/><circle class="point-dot" cx="${x(p.angle_deg)}" cy="${y(p.lift_mm)}" r="5"/><text x="${x(p.angle_deg)}" y="${y(p.lift_mm)-11}" text-anchor="middle">${i+1}</text></g>`;});
 $('travel').innerHTML=`<svg viewBox="0 0 750 225" aria-label="Draft height over lever travel">${drawing}</svg>`;
}
function syncFields(force=false){
 document.querySelectorAll('[data-node][data-field]').forEach(e=>{const n=model.config.nodes[Number(e.dataset.node)];if(!n||(!force&&e===document.activeElement))return;const key=e.dataset.field,v=n[key]??(key==='shape'?'cosine':key==='kind'?'flat':'');if(e.tagName==='SELECT'&&![...e.options].some(o=>o.value===String(v)))e.add(new Option(String(v),String(v)));e.value=v;});
 for(const e of document.querySelectorAll('[data-global]'))if(force||e!==document.activeElement)e.value=model.config[e.dataset.global]??(e.dataset.global==='assumed_extra_preload_mm'?0:'');
 $('undo').disabled=!model.canUndo;$('redo').disabled=!model.canRedo;
 const i=model.selection.index;$('remove').disabled=model.selection.kind!=='point'||i===0||i===model.config.nodes.length-1||model.config.nodes.length<=3;
 const span=intervalForSelection(model.selection,model.config.nodes.length);$('insert').disabled=span===null||model.config.nodes.length>=101;$('insert').textContent=span===null?'Insert point in span':`Insert point between ${span+1} and ${span+2}`;
 const bad=new Set(issues.flatMap(x=>x.indices));for(const row of $('nodes').rows){const idx=Number(row.dataset.row);row.classList.toggle('selected',model.selection.kind==='point'&&model.selection.index===idx);row.classList.toggle('invalid',bad.has(idx));}
}
function renderAll(){
 const active=document.activeElement,container=active?.closest?.('#inspector,#nodes'),field=active?.dataset?.field,node=active?.dataset?.node;
 const caret=active?.selectionStart;
 renderTable();renderSelection();renderInspector();renderGraph();syncFields(true);renderSimple();
 // A history action rebuilds controls, but keyboard users keep the same editing target.
 if(container&&field&&node!==undefined){const next=$(container.id).querySelector(`[data-node="${Number(node)}"][data-field="${field}"]`);if(next){next.focus({preventScroll:true});if(caret!==null&&caret!==undefined&&next.type==='text')next.setSelectionRange(Math.min(caret,next.value.length),Math.min(caret,next.value.length));}}
}
function selectFeature(kind,index,focus=false){if(!model)return;model.select(kind,index);renderSelection();renderInspector();renderGraph();syncFields();if(focus)$('travel').querySelector(`[data-kind="${model.selection.kind}"][data-index="${model.selection.index}"]`)?.focus();}
function moveSelection(direction,focus=false){const list=selections(),at=list.findIndex(s=>selectionValue(s)===selectionValue(model.selection)),s=list[Math.max(0,Math.min(list.length-1,at+direction))];if(s)selectFeature(s.kind,s.index,focus);}
function stalePreview(message){$('preview-label').hidden=!lastValid;$('preview-label').textContent=message;$('preview').classList.toggle('stale',!!lastValid);}
function showIssues(list){$('issues').innerHTML=list.length?'<ul>'+list.map(x=>`<li>${escape(x.message)}${x.indices.length?`<button data-select-point="${x.indices[0]}">Go to point ${x.indices[0]+1}</button>`:''}</li>`).join('')+'</ul>':'';}
function invalidate(){clearTimeout(timer);revision++;if(worker){worker.terminate();worker=null;}for(const url of downloadUrls)URL.revokeObjectURL(url);downloadUrls=[];if(generating){generating=false;if(model)renderSimple();}$('downloads').replaceChildren();$('report').textContent='Current draft has not generated files.';validatedRevision=null;$('download').disabled=true;$('downloads-hint').hidden=false;return revision;}
function schedulePreview(){
 const token=invalidate();issues=draftIssues(model.config);showIssues(issues);renderGraph();syncFields();
 stalePreview('Last valid preview — current draft is being checked.');
 if(issues.length){$('status').className='error';$('status').textContent='Draft needs attention. Your edits are kept.';$('download').disabled=true;stalePreview('Last valid preview — NOT the current draft. Fix the highlighted values before exporting.');return;}
 $('status').className='';$('status').textContent='Updating preview…';timer=setTimeout(()=>requestGeometry(false,token),200);
}
function readyText(report,generate,stem){
 const v=viewOf(model.config);
 if(v.mode==='simple')return statusText(v.design)+(generate?` Downloaded ${stem}.stl.`:'');
 return (generate?'Files ready':'Live geometry valid')+` · ${report.gate_count} marked notches · ${report.max_pressure_angle_deg.toFixed(1)}° maximum pressure angle`;
}
function saveFile(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();}
function requestGeometry(generate,token,stem='notch-disk-custom'){
 if(token!==revision)return;worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});const active=worker;
 const fail=message=>{if(token!==revision)return;generating=false;renderSimple();$('status').className='error';$('status').textContent=message;$('download').disabled=true;$('issues').textContent='The geometry check could not isolate a single editable point. Inspect the narrow or steep ramps; try a wider span or smaller lift. Your draft is kept and can be saved.';stalePreview('Last valid preview — NOT the current draft. No files are generated for this draft.');};
 active.onmessage=({data})=>{active.terminate();if(worker===active)worker=null;if(token!==revision)return;if(generating){generating=false;renderSimple();}if(!data.ok){fail(generate?`Could not make the files. ${data.kind}: ${data.error}`:data.error);return;}
  lastValid={svg:data.svg,config:structuredClone(model.config)};$('preview').innerHTML=data.svg;$('preview').classList.remove('stale');$('preview-label').hidden=true;$('issues').textContent=(data.report.warnings??[]).join(' ');$('status').className='ok';$('status').textContent=readyText(data.report,generate,stem);$('report').textContent=JSON.stringify(data.report,null,2);validatedRevision=token;$('download').disabled=false;
  if(generate){for(const file of data.files){const url=URL.createObjectURL(new Blob([file.content],{type:file.type}));downloadUrls.push(url);
   const a=document.createElement('a');a.href=url;a.download=file.name;a.textContent=file.label;
   if(file.label==='STL'){saveFile(url,file.name);$('downloads').prepend(a);}else $('downloads').append(a);}
   $('downloads-hint').hidden=true;}
 };
 active.onerror=e=>{active.terminate();if(worker===active)worker=null;fail(e.message||'The geometry worker could not finish. Reload the page and load your saved settings.');};
 active.postMessage({config:structuredClone(model.config),generate,fileStem:stem});
}
// Simple view: chips and stepper are a view of model.config; every change goes through EditorModel.
const FEEL={standard:'Standard',deep:'Deep',smooth:'Smooth'};
function renderSimple(){
 if(!model)return;
 const v=viewOf(model.config),d=v.design,fine=v.mode!=='simple',dis=fine||checking||generating?' disabled':'';
 $('fine-tuned').hidden=!fine;
 $('count-value').textContent=d?String(d.count):'–';
 $('count-down').disabled=fine||checking||generating||!d||d.count<=2;$('count-up').disabled=fine||checking||generating||!d||d.count>=13;
 let html='';
 for(let p=1;d&&p<=d.count;p++){
  const s=stateOf(d,p);
  if(s==='smooth'){let q=p;while(q<d.count&&stateOf(d,q+1)==='smooth')q++;
   html+=`<span class="smooth-run" role="group" aria-label="Smooth, no clicks: position${q>p?`s ${p} to ${q}`:` ${p}`}">`;
   for(let i=p;i<=q;i++)html+=`<button class="smooth-pos" data-pos="${i}" aria-label="Position ${i}: Smooth. Tap to make it Standard"${dis}>${i}</button>`;
   html+='</span>';p=q;continue;}
  html+=`<button class="chip ${s}" data-pos="${p}" aria-label="Position ${p}: ${FEEL[s]}"${dis}>${p}${s==='deep'?'<small>Deep</small>':''}</button>`;
 }
 $('chips').innerHTML=html;
 if(focusAfter&&!checking&&!generating){const el=focusAfter();focusAfter=null;if(el&&!el.disabled)el.focus({preventScroll:true});}
}
function refuse(text,raw,extra=''){$('simple-notice').innerHTML=`<p>${escape(text)}</p>${extra}<details><summary>Details</summary><p class="raw">${escape(raw)}</p></details>`;}
// Check a candidate design without a mesh before it reaches the model. One check at a time; stale results are dropped.
// If the candidate is refused and a fallback design is given, the fallback is checked next; when it passes it is applied
// and the first refusal stays visible as an explanation of the skipped state.
function checkDesign(candidate,refusal,onApplied=null,refusalExtra='',fallback=null,fallbackNote=''){
 if(!model||checking||generating)return;
 const base=JSON.stringify(model.config),stale=()=>JSON.stringify(model.config)!==base;
 let firstRaw='',loadFailed=false;checking=true;renderSimple();
 const settle=()=>{checking=false;if(stale()){focusAfter=null;renderSimple();return true;}return false;};
 const attempt=(design,onOk,onFail)=>{
  let config;try{config=notchRecipe(design)}catch(e){onFail(e.message);return;}
  let w=null,finished=false;
  const done=(ok,raw,load=false)=>{try{w?.terminate();}catch{}if(finished)return;finished=true;ok?onOk():onFail(raw,load);};
  try{w=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch(e){done(false,e.message||'The geometry worker could not start.',true);return;}
  w.onmessage=({data})=>done(data.ok,data.ok?'':`${data.kind}: ${data.error}`);
  w.onerror=e=>{e.preventDefault?.();done(false,e.message||'The geometry worker failed to load or run.',true);};
  w.postMessage({config,generate:false});
 };
 const apply=(design,explain)=>{if(settle())return;model.endGroup();model.applyDesign(design);changed(true);if(explain)refuse(refusal+fallbackNote,firstRaw);onApplied?.();};
 const refused=()=>{if(settle())return;if(loadFailed)refuse('The geometry check could not run. Reload the page.',firstRaw);else refuse(refusal,firstRaw,refusalExtra);renderSimple();};
 attempt(candidate,()=>apply(candidate,false),(raw,load)=>{firstRaw=raw;loadFailed=load;
  if(load||!fallback||stale()){refused();return;}
  attempt(fallback,()=>apply(fallback,true),(raw2,load2)=>{if(load2){firstRaw=raw2;loadFailed=true;}refused();});
 });
}
function resetNotice(){$('simple-notice').innerHTML='<p>Reset to Standard/Deep. <button id="reset-undo">Undo</button></p>';$('reset-undo').focus({preventScroll:true});}
function applyDefault(){model.endGroup();model.applyDesign(DEFAULT_DESIGN);changed(true);resetNotice();}
$('chips').addEventListener('click',e=>{
 const b=e.target.closest('[data-pos]');if(!b||b.disabled||checking||generating||!model)return;
 const v=viewOf(model.config);if(v.mode!=='simple')return;
 const pos=Number(b.dataset.pos),{design,next}=cycle(v.design,pos),end=pos===1||pos===v.design.count;
 focusAfter=()=>$('chips').querySelector(`[data-pos="${pos}"]`);
 // A refused tap tries the state after it (ends have only two states, so no fallback there).
 const fb=end?null:cycle(design,pos);
 checkDesign(design,chipRefusal(pos,next,v.design.count),null,'',fb&&fb.design,fb?` It is now ${FEEL[fb.next]}.`:'');
});
function step(delta){
 if(!model||checking||generating)return;const v=viewOf(model.config);if(v.mode!=='simple')return;
 const count=v.design.count+delta;if(count<2||count>13)return;
 const id=delta<0?'count-down':'count-up',other=delta<0?'count-up':'count-down';focusAfter=()=>$(id).disabled?$(other):$(id);
 checkDesign(withCount(v.design,count),countRefusal(count));
}
$('count-down').onclick=()=>step(-1);$('count-up').onclick=()=>step(1);
$('reset').onclick=()=>{
 if(!model||checking||generating)return;const d=normalizeDesign(model.config.design);
 if(!d){applyDefault();return;}
 checkDesign(d,'The Standard/Deep design saved with these settings can’t be printed: the notches are too close for the roller to follow.',resetNotice,'<p><button id="reset-default">Use the tested 9-position disk</button></p>');
};
$('simple-notice').addEventListener('click',e=>{if(e.target.id==='reset-undo')$('undo').click();else if(e.target.id==='reset-default'&&model&&!checking)applyDefault();});
function changed(structural=false){$('notice').textContent='';$('simple-notice').textContent='';if(structural)renderAll();else{renderSelection();renderContext();syncFields();renderSimple();}schedulePreview();}
function action(fn,message=''){if(!model)return;try{model.endGroup();fn();changed(true);$('notice').textContent=message;}catch(e){$('notice').textContent=e.message;}}
function edit(e){const el=e.target;if(!model)return;let value=el.type==='number'?number(el.value):el.value;
 if(el.dataset.node!==undefined&&el.dataset.field){model.editNode(Number(el.dataset.node),el.dataset.field,value,`node:${el.dataset.node}:${el.dataset.field}`);changed();}
 else if(el.dataset.global){model.editGlobal(el.dataset.global,value,'global:'+el.dataset.global);changed();}
}
document.addEventListener('input',edit);document.addEventListener('change',e=>{if(e.target.tagName==='SELECT'&&e.target.dataset.field)edit(e);model?.endGroup();});document.addEventListener('focusout',()=>model?.endGroup());
document.addEventListener('click',e=>{const p=e.target.closest('[data-select-point]');if(p)selectFeature('point',Number(p.dataset.selectPoint));});
$('travel').addEventListener('click',e=>{const p=e.target.closest('[data-kind]');if(p)selectFeature(p.dataset.kind,Number(p.dataset.index));});
$('travel').addEventListener('keydown',e=>{const p=e.target.closest('[data-kind]');if(!p)return;if(['Enter',' '].includes(e.key)){e.preventDefault();selectFeature(p.dataset.kind,Number(p.dataset.index),true);}else if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveSelection(e.key==='ArrowLeft'?-1:1,true);}});
$('selection').onchange=()=>{const[k,i]=$('selection').value.split(':');selectFeature(k,Number(i));};$('previous').onclick=()=>moveSelection(-1);$('next').onclick=()=>moveSelection(1);
$('undo').onclick=()=>action(()=>model.undo(),'Undid the last edit.');$('redo').onclick=()=>action(()=>model.redo(),'Restored the edit.');
document.addEventListener('keydown',e=>{if(!model||!(e.ctrlKey||e.metaKey))return;if(e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}else if(e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}});
$('insert').onclick=()=>action(()=>model.insertPoint(),'Inserted a point in the selected span. The new zero-slope junction changes that ramp; Undo restores it.');$('remove').onclick=()=>action(()=>model.removePoint(model.selection.index),'Removed the selected point.');$('sort').onclick=()=>action(()=>model.sort(),'Sorted points by angle.');
$('load').onclick=()=>{if(!presets[$('preset').value]){$('notice').textContent='Choose a preset first.';return;}action(()=>model.replace(presets[$('preset').value]),'Loaded a preset. Undo restores your previous layout.');};$('even').onclick=()=>action(()=>model.replace(evenlySpaced(Number($('count').value),$('initial-height').value.trim()===''?NaN:Number($('initial-height').value))),'Created a layout. Undo restores your previous design.');
$('download').onclick=()=>{if(!model||validatedRevision!==revision)return;issues=draftIssues(model.config);if(issues.length){schedulePreview();return;}const stem=fileStem(model.config),token=invalidate();generating=true;renderSimple();$('status').className='';$('status').textContent='Checking the mesh and generating files…';stalePreview('Last valid preview — generating current files.');requestGeometry(true,token,stem);};
$('save').onclick=()=>{if(!model)return;const url=URL.createObjectURL(new Blob([JSON.stringify(model.config,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='notch-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('notice').textContent='Saved the exact settings, including any incomplete draft values.';};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Settings file is too large (maximum 2 MB).');const c=importDraft(JSON.parse(await file.text()));action(()=>model.replace(c),'Loaded settings without simplifying them. Invalid values remain editable.');}catch(e){$('notice').textContent='Could not load settings: '+e.message;}finally{$('file').value='';}};
// Start-up: the tested default, or a design from the link (?positions=…, see linkDesign in simple.js).
function start(config,notice=''){model=new EditorModel(config);issues=draftIssues(model.config);renderAll();schedulePreview();if(notice)$('simple-notice').innerHTML=notice;}
// Builds a config without a mesh in a throwaway worker; resolves {ok,raw,load}.
function checkConfig(config){return new Promise(resolve=>{let w;
 try{w=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}catch(e){resolve({ok:false,load:true,raw:e.message});return;}
 w.onmessage=({data})=>{w.terminate();resolve({ok:data.ok,raw:data.ok?'':`${data.kind}: ${data.error}`});};
 w.onerror=e=>{e.preventDefault?.();w.terminate();resolve({ok:false,load:true,raw:e.message||'The geometry worker failed to load or run.'});};
 w.postMessage({config,generate:false});
});}
// A link's design is checked before it is shown. If its Deep positions don't fit, the same positions are tried all Standard.
async function openLink(link){
 const d=link.design,who=link.name?`“${escape(link.name)}”`:'this lever',opened=`<p>Opened ${who} from a link: ${d.count} positions.</p>`,first=linkConfig(link);
 $('status').textContent='Checking the lever from your link…';
 const r=await checkConfig(first);
 if(r.ok||r.load||!d.deep.length){start(first,opened);return;}
 const second=linkConfig(link,{...d,deep:[]}),r2=await checkConfig(second);
 if(!r2.ok){start(first,opened);return;}
 const names=d.deep.map(p=>link.labels?.[p-1]||`position ${p}`).join(', ');
 start(second,`${opened}<p>Deep (${escape(names)}) doesn't fit with ${d.count} positions: the notches are too close for the roller to follow. Those positions are Standard instead. Fewer positions leave room for Deep.</p><details><summary>Details</summary><p class="raw">${escape(r.raw)}</p></details>`);
}
const link=linkDesign(location.search);
if(link)openLink(link);else start({...notchRecipe(DEFAULT_DESIGN),design:DEFAULT_DESIGN});
fetch('./presets.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{presets=d;for(const[k,c]of Object.entries(d))$('preset').add(new Option(c.name||k,k));}).catch(e=>{$('notice').textContent='Cannot load the preset list: '+e.message;});
