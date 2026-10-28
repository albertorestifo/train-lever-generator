import {ease} from './engine.js';

const help=document.createElement('details');
help.id='shape-help';
help.innerHTML=`<summary>Cosine, quintic or linear blend — what changes?</summary>
<p><b>“Shape to next” controls the ramp from this row to the next row.</b> It changes how quickly the roller climbs or descends, without changing either endpoint’s angle or lift. It does not apply to the last row. If both rows have the same lift, all three options give the same flat travel.</p>
<ul>
<li><b>Cosine — rounded ramp; start here.</b> Starts and finishes with zero slope, with a gradual rise to the steepest slope halfway through. A balanced starting point for ordinary notches.</li>
<li><b>Quintic — gentler near the ends, steeper in the middle.</b> Both slope and curvature settle to zero at the endpoints. For the same height and angular width, its middle is steeper than cosine: smoother entry does <em>not</em> mean lower peak resistance. Narrow ramps may need widening.</li>
<li><b>Linear blend — a steady-slope middle.</b> Eases in over the first 20% of the ramp, keeps a constant slope through the middle 60%, then eases out over the last 20%. This spreads the climb more evenly; spring force still changes, so it does not guarantee constant lever resistance.</li>
</ul>
<div id="shape-comparison"></div>
<p><b>For a more noticeable centre notch:</b> first adjust the heights and angular widths of the barriers on either side of it. Shape then tunes the transition. Actual feel also depends on spring preload, friction and print fit; the preview shows motion, not measured force.</p>`;
document.querySelector('table').before(help);
// Draw the exact interpolation functions at equal height and width.
const shapes=[['cosine','Cosine','#125d87'],['quintic','Quintic','#a33e6a'],['linear_blend','Linear blend','#996315']];
const curves=shapes.map(([key,label,color],i)=>{
 const path=Array.from({length:101},(_,j)=>{const u=j/100;return (j?'L':'M')+(45+u*400).toFixed(2)+','+(155-ease(u,key)[0]*120).toFixed(2)}).join(' ');
 return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"/><text x="${45+i*145}" y="204" fill="${color}">${label}</text>`;
}).join('');
document.getElementById('shape-comparison').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 220" role="img" aria-label="Comparison of roller lift over one uphill ramp, with equal height and width" style="width:100%;max-width:520px"><style>text{font:13px system-ui}</style><text x="12" y="17">Same rise and width: roller lift, not force</text><path d="M45 30 V155 H450" fill="none" stroke="#bcc8d3"/><text x="12" y="40">Top</text><text x="5" y="158">Base</text><text x="45" y="177">Start of ramp</text><text x="365" y="177">End of ramp</text>${curves}</svg>`;
