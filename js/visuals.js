/* Switch visuals: category icons, puzzle pictures (compass, arrow, dice, clock, grid, cube, cipher) and the typing card.
   No dependencies. Pairs with visuals.css. Everything draws in currentColor / the card's --c, so it follows every look.

   SwitchVisuals.icon(key,cls)         -> <svg> for maths|memory|logic|word|space|code|typing
   SwitchVisuals.render(visual)        -> HTML for a question's optional `visual` field (see SPEC.md for the field shapes)
   SwitchVisuals.typing(bigEl,inputEl,target,{speedEl,progEl})
                                       -> per-letter green/red feedback, caret, progress and live WPM; returns {update,wpm}
*/
(function(g){
'use strict';
var V={};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
/* ---------- icons: one 24px line icon per category ---------- */
var IC={
  maths:'<path d="M7 4v6M4 7h6M14 7h6M4.5 14.5l5 5M9.5 14.5l-5 5M14 17h6M17 14.2v.1M17 19.8v.1"/>',
  memory:'<rect x="3" y="4" width="9" height="12" rx="2"/><rect x="12" y="8" width="9" height="12" rx="2"/><path d="M7.5 9v.1M16.5 13v.1"/>',
  logic:'<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="12" cy="18" r="2.6"/><path d="M8.6 6h6.8M7.3 8.3l3.5 7.4M16.7 8.3l-3.5 7.4"/>',
  word:'<path d="M2.5 19L8 5l5.5 14M4.7 14h6.6"/><circle cx="18" cy="15.5" r="3"/><path d="M21 12.5V19"/>',
  space:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
  code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  typing:'<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10v.1M10 10v.1M14 10v.1M18 10v.1M7 14h10"/>'
};
V.icon=function(k,cls){
  return'<svg class="vi'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[k]||'')+'</svg>';
};

/* ---------- pictures ---------- */
function svg(w,h,inner,cls){return'<svg class="vsvg'+(cls?' '+cls:'')+'" viewBox="0 0 '+w+' '+h+'" role="img">'+inner+'</svg>'}
function compass(v){
  var d=v.deg||0,t='';
  [['N',0],['E',90],['S',180],['W',270]].forEach(function(p){
    var a=p[1]*Math.PI/180,x=100+Math.sin(a)*78,y=100-Math.cos(a)*78+5;
    t+='<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" text-anchor="middle" class="vt'+(p[0]==='N'?' hot':'')+'">'+p[0]+'</text>';
  });
  var ticks='';for(var i=0;i<24;i++){var a2=i*15*Math.PI/180,r1=i%6===0?58:62,r2=68;ticks+='<line x1="'+(100+Math.sin(a2)*r1).toFixed(1)+'" y1="'+(100-Math.cos(a2)*r1).toFixed(1)+'" x2="'+(100+Math.sin(a2)*r2).toFixed(1)+'" y2="'+(100-Math.cos(a2)*r2).toFixed(1)+'"/>'}
  return svg(200,200,'<circle cx="100" cy="100" r="92" class="vring"/><g class="vtick">'+ticks+'</g>'+t+
    '<g transform="rotate('+d+' 100 100)"><path d="M100 34L112 100H88z" class="vfill"/><path d="M100 166L112 100H88z" class="vfill dim"/></g><circle cx="100" cy="100" r="5" class="vdot"/>','vcompass');
}
function arrow(v){
  return svg(200,200,'<circle cx="100" cy="100" r="88" class="vring dim"/><g transform="rotate('+(v.deg||0)+' 100 100)"><path d="M100 28L146 84H116V168H84V84H54z" class="vfill"/></g>','varrow');
}
var PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function dice(v){
  var n=v.top||1,p='';(PIPS[n]||[]).forEach(function(i){p+='<circle cx="'+(46+(i%3)*54)+'" cy="'+(46+Math.floor(i/3)*54)+'" r="11" class="vdot"/>'});
  var s=v.bottom?'<text x="100" y="196" text-anchor="middle" class="vt">?</text>':'';
  return svg(200,200,'<rect x="10" y="10" width="180" height="180" rx="30" class="vface"/>'+p+s,'vdice');
}
function clock(v){
  var h=v.h%12,m=v.m,ha=(h+m/60)*30,ma=m*6,t='';
  for(var i=1;i<=12;i++){var a=i*30*Math.PI/180;t+='<text x="'+(100+Math.sin(a)*70).toFixed(1)+'" y="'+(100-Math.cos(a)*70+6).toFixed(1)+'" text-anchor="middle" class="vt sm">'+i+'</text>'}
  var inner='<circle cx="100" cy="100" r="92" class="vring"/>'+t+'<line x1="100" y1="100" x2="100" y2="58" class="vhand" transform="rotate('+ha+' 100 100)"/><line x1="100" y1="100" x2="100" y2="34" class="vhand thin" transform="rotate('+ma+' 100 100)"/><circle cx="100" cy="100" r="5" class="vdot"/>';
  return svg(200,200,v.mirror?'<g transform="translate(200 0) scale(-1 1)">'+inner+'</g>':inner,'vclock');
}
function grid(v){
  var w=v.w,h=v.h,s=Math.min(30,Math.floor(170/Math.max(w,h))),W=w*s+30,H=h*s+30,l='';
  for(var i=0;i<=w;i++)l+='<line x1="'+(15+i*s)+'" y1="15" x2="'+(15+i*s)+'" y2="'+(15+h*s)+'"/>';
  for(var j=0;j<=h;j++)l+='<line x1="15" y1="'+(15+j*s)+'" x2="'+(15+w*s)+'" y2="'+(15+j*s)+'"/>';
  var extra='';
  if(v.path){extra+='<polyline class="vpath" points="'+v.path.map(function(p){return(15+p[0]*s)+','+(15+(h-p[1])*s)}).join(' ')+'"/>'}
  var corners=v.routes?'<circle cx="15" cy="15" r="6" class="vdot"/><circle cx="'+(15+w*s)+'" cy="'+(15+h*s)+'" r="6" class="vdot hollow"/><text x="15" y="9" text-anchor="middle" class="vt sm">A</text><text x="'+(15+w*s)+'" y="'+(15+h*s+17)+'" text-anchor="middle" class="vt sm">B</text>':'';
  return svg(W,H+(v.routes?6:0),'<g class="vgrid">'+l+'</g>'+extra+corners,'vgridsvg');
}
function cube(v){
  var a=v.a,b=v.b,c=v.c,S=34,cx=110,cy=34,k=.866,pts=function(x,y,z){return[(cx+(x-y)*k*S).toFixed(1),(cy+(x+y)*.5*S-z*S).toFixed(1)]};
  function poly(ps,cls){return'<polygon class="'+cls+'" points="'+ps.map(function(p){return p.join(',')}).join(' ')+'"/>'}
  var top=poly([pts(0,0,c),pts(a,0,c),pts(a,b,c),pts(0,b,c)],'cf t'),left=poly([pts(0,b,c),pts(a,b,c),pts(a,b,0),pts(0,b,0)],'cf l'),right=poly([pts(a,0,c),pts(a,b,c),pts(a,b,0),pts(a,0,0)],'cf r'),l='',i;
  for(i=1;i<a;i++)l+='<line x1="'+pts(i,0,c)[0]+'" y1="'+pts(i,0,c)[1]+'" x2="'+pts(i,b,c)[0]+'" y2="'+pts(i,b,c)[1]+'"/><line x1="'+pts(i,b,c)[0]+'" y1="'+pts(i,b,c)[1]+'" x2="'+pts(i,b,0)[0]+'" y2="'+pts(i,b,0)[1]+'"/>';
  for(i=1;i<b;i++)l+='<line x1="'+pts(0,i,c)[0]+'" y1="'+pts(0,i,c)[1]+'" x2="'+pts(a,i,c)[0]+'" y2="'+pts(a,i,c)[1]+'"/><line x1="'+pts(a,i,c)[0]+'" y1="'+pts(a,i,c)[1]+'" x2="'+pts(a,i,0)[0]+'" y2="'+pts(a,i,0)[1]+'"/>';
  for(i=1;i<c;i++)l+='<line x1="'+pts(0,b,i)[0]+'" y1="'+pts(0,b,i)[1]+'" x2="'+pts(a,b,i)[0]+'" y2="'+pts(a,b,i)[1]+'"/><line x1="'+pts(a,b,i)[0]+'" y1="'+pts(a,b,i)[1]+'" x2="'+pts(a,0,i)[0]+'" y2="'+pts(a,0,i)[1]+'"/>';
  return svg(220,190,top+left+right+'<g class="vcut">'+l+'</g>','vcube');
}
/* ---------- cipher visuals (HTML, monospace tiles) ---------- */
function tiles(word,cls){return'<span class="vtiles '+(cls||'')+'">'+word.toUpperCase().split('').map(function(ch){return'<b>'+esc(ch)+'</b>'}).join('')+'</span>'}
function strip(v){
  var A='ABCDEFGHIJKLMNOPQRSTUVWXYZ',k=v.k,row1='',row2='';
  for(var i=0;i<26;i++){row1+='<b>'+A[i]+'</b>';row2+='<b class="'+(i<k?'wrap':'')+'">'+A[(i+k)%26]+'</b>'}
  return'<div class="vstrip"><span class="vl">Plain</span><div>'+row1+'</div><span class="vl">'+(v.back?'Back ':'Forward ')+(v.steps||(v.back?(26-k)%26||26:k))+'</span><div class="sh">'+row2+'</div></div>';
}
function pairs(v){return'<div class="vpairs">'+v.pairs.map(function(p){return'<div>'+tiles(p[0])+'<i>→</i>'+tiles(p[1],'out')+'</div>'}).join('')+'</div>'}
V.render=function(v){
  if(!v||!v.kind)return'';
  var h={compass:compass,arrow:arrow,dice:dice,clock:clock,grid:grid,cube:cube,strip:strip,pairs:pairs,tiles:function(x){return tiles(x.word)}}[v.kind];
  return h?'<div class="vis vis-'+v.kind+'">'+h(v)+'</div>':'';
};

/* ---------- typing card: per-letter feedback, caret, progress, live speed ---------- */
V.typing=function(big,inp,target,o){
  o=o||{};big.classList.add('typed');
  big.innerHTML=target.split('').map(function(ch){return'<span class="tc">'+(ch===' '?'&nbsp;':esc(ch))+'</span>'}).join('');
  var sp=big.children,t0=0,last=0;
  function wpm(){if(!t0)return 0;var m=(performance.now()-t0)/60000;return Math.min(299,Math.round(inp.value.length/5/Math.max(m,.025)))}
  function update(){
    var v=inp.value.toLowerCase();if(!t0&&v.length)t0=performance.now();
    for(var i=0;i<sp.length;i++)sp[i].className='tc'+(i<v.length?(v.charAt(i)===target.charAt(i)?' ok':' bad'):'')+(i===v.length?' cur':'');
    if(o.progEl)o.progEl.firstElementChild.style.width=Math.min(100,v.length/target.length*100)+'%';
    if(o.speedEl&&t0)o.speedEl.textContent=wpm()+' WPM';
    last=v.length;
  }
  inp.addEventListener('input',update);update();
  if(o.speedEl)o.speedEl.textContent='0 WPM';
  return{update:update,wpm:wpm};
};
g.SwitchVisuals=V;
})(window);
