import {build,svg,stl,scad} from './engine.js';
self.onmessage=async({data:{config,generate}})=>{
 try{
  const result=build(config,generate),response={ok:true,report:result.report,svg:svg(result)};
  if(generate){
   const raw=stl(result.triangles),digest=await crypto.subtle.digest('SHA-256',raw);
   result.report.stl_sha256=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const text=(label,name,content,type='text/plain')=>({label,name,content,type});
   response.files=[{label:'STL',name:'P08-Custom-notch-plate.stl',content:raw,type:'application/octet-stream'},text('OpenSCAD','P08-Custom-notch-plate.scad',scad(result)),text('Settings','config.json',JSON.stringify(config,null,2),'application/json'),text('Validation','validation.json',JSON.stringify(result.report,null,2),'application/json'),text('Motion CSV','motion.csv','angle_deg,lift_mm,lift_derivative_mm_per_rad,spring_seat_rise_mm,pressure_angle_deg,contact_error_mm\n'+result.kinematics.map(row=>row.join(',')).join('\n'),'text/csv')];
   self.postMessage(response,[raw]);
  }else self.postMessage(response);
 }catch(error){self.postMessage({ok:false,error:error.message})}
};
