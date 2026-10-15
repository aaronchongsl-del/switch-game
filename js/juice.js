/* Switch juice layer: JS. No dependencies. Pairs with juice.css and themes.css.
   Public API (window.Juice):
     Juice.init({getPack})          getPack() -> {w,k,over?,lp?} so the chosen sound pack applies
     Juice.unlock()                 call from the first click/keypress (browsers need a gesture for audio)
     Juice.enabled / Juice.muted    flags. enabled=false turns every effect off (A/B against the flat version)
     Juice.correct({stage,streak,points}) -> {slide:{kind,streak}|null}   small per-answer effects only
     Juice.wrong({stage,timeEl,railEl,lostStreak,penalty})
     Juice.slide({kind,streak,title,kicker,sub,chip,stage,ms,onDone})     full-card slide shown BETWEEN questions
     Juice.streakSlide(streak)      -> slide options for a streak milestone
     Juice.switchTo({stage,name,glyph,ms})   returns ms the caller should keep the timer paused
     Juice.lowTime(secsLeft,{timeEl,railEl}) once per whole second while <=10; Juice.lowOff()
     Juice.levelUp({level,rank,unlocked})    results screen only
     Juice.countUp(el,from,to,ms,done)
     Juice.confetti() / Juice.burst(x,y,color,n,power)
     Juice.heat(stage,streak) / Juice.pips(el,streak)
     Juice.end({newBest})
   Theme hooks (read from CSS custom properties on :root, so a skin only needs CSS):
     --jx-shape: dot | leaf | glitch | bubble | ink      particle shape
     --jx-p1, --jx-p2: extra particle colours mixed with the puzzle colour
*/
(function(g){
'use strict';
var J={enabled:true,muted:false,getPack:function(){return{w:'triangle',k:1}}};
var RM=g.matchMedia&&g.matchMedia('(prefers-reduced-motion: reduce)').matches;
function reduced(){return RM}
function fx(){return J.enabled}
function retrigger(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function cssColor(el,name){var v=g.getComputedStyle(el||document.documentElement).getPropertyValue(name);return(v||'#fff').trim()}
function buzz(p){try{if(!J.muted&&fx()&&navigator.vibrate)navigator.vibrate(p)}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------------- audio ---------------- */
var ac=null,master=null,noiseBuf=null;
function ctx(){
  if(ac)return ac;
  try{
    ac=new(g.AudioContext||g.webkitAudioContext)();
    var comp=ac.createDynamicsCompressor();master=ac.createGain();master.gain.value=.9;
    master.connect(comp);comp.connect(ac.destination);
    var n=ac.sampleRate>>1,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=Math.random()*2-1;noiseBuf=b;
  }catch(e){ac=null}
  return ac;
}
J.unlock=function(){var c=ctx();if(c&&c.state==='suspended')c.resume()};
function can(){return fx()&&!J.muted&&ctx()}
/* type 'main' = the chosen sound pack's voice (waveform, optional wooden overtone, optional low-pass) */
function tone(f,t,d,type,v,f2,lp){
  var c=ac,s=c.currentTime+t,o=c.createOscillator(),gn=c.createGain(),out=gn;
  if(type==='main'){var pk=J.getPack();type=pk.w;lp=pk.lp;if(pk.over)tone(f*pk.over,t,d*.35,'sine',v*.5)}
  o.type=type;o.frequency.setValueAtTime(f,s);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,s+d);
  gn.gain.setValueAtTime(.0001,s);gn.gain.exponentialRampToValueAtTime(v,s+.008);gn.gain.exponentialRampToValueAtTime(.0001,s+d);
  if(lp){var fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=lp;o.connect(fl);fl.connect(gn)}else o.connect(gn);
  out.connect(master);o.start(s);o.stop(s+d+.03);
}
function noise(t,d,f1,f2,v,q){
  var c=ac,s=c.currentTime+t,src=c.createBufferSource(),bp=c.createBiquadFilter(),gn=c.createGain();
  src.buffer=noiseBuf;src.loop=true;bp.type='bandpass';bp.Q.value=q||1.2;
  bp.frequency.setValueAtTime(f1,s);bp.frequency.exponentialRampToValueAtTime(f2,s+d);
  gn.gain.setValueAtTime(.0001,s);gn.gain.exponentialRampToValueAtTime(v,s+d*.3);gn.gain.exponentialRampToValueAtTime(.0001,s+d);
  src.connect(bp);bp.connect(gn);gn.connect(master);src.start(s);src.stop(s+d+.03);
}
/* major pentatonic: every correct answer climbs the scale, so a streak is a melody and never sounds wrong */
var PENT=[0,2,4,7,9];
function K(){return J.getPack().k||1}
function pf(i){var oct=Math.floor(i/5),deg=PENT[((i%5)+5)%5];return 261.63*Math.pow(2,(deg+12*oct)/12)*K()}
var S=J.sound={
  ok:function(streak){
    if(!can())return;var i=Math.min(Math.max(streak-1,0),14),f=pf(i);
    tone(f,0,.17,'main',.13);tone(f*2,0,.1,'sine',.045);tone(f*1.5,.05,.12,'sine',.035);
  },
  tier:function(streak){
    if(!can())return;var i=Math.min(Math.floor(streak/5),5)*2;
    [0,2,4,7,9,11].slice(0,4+Math.min(2,Math.floor(streak/10))).forEach(function(d,n){tone(pf(i+d),n*.065,.2,'main',.12);tone(pf(i+d)*2,n*.065,.12,'sine',.035)});
    noise(0,.35,2000,9000,.03,.6);
  },
  bad:function(){if(!can())return;tone(190,0,.28,'sawtooth',.07,60);tone(95,0,.2,'sine',.16,45);noise(0,.12,900,200,.05,.8)},
  lost:function(){if(!can())return;[0,1,2].forEach(function(n){tone(pf(6-n*2),n*.09,.2,'sawtooth',.045,pf(6-n*2)*.7)})},
  sw:function(){if(!can())return;noise(0,.3,350,3200,.09,1.6);tone(330*K(),.16,.1,'square',.04);tone(495*K(),.23,.14,'square',.04)},
  tick:function(urgent){if(!can())return;tone(urgent?1500:1000,0,.04,'square',.035)},
  event:function(){if(!can())return;[0,4,7,12,16].forEach(function(d,n){tone(pf(5)*Math.pow(2,d/12),n*.05,.16,'main',.1)})},
  level:function(){
    if(!can())return;
    [0,4,7,12,16,19,24].forEach(function(d,n){tone(261.63*Math.pow(2,d/12)*K(),n*.085,.34,'main',.12);tone(523.25*Math.pow(2,d/12),n*.085,.2,'sine',.04)});
    noise(0,.8,1500,10000,.04,.5);
  },
  count:function(p){if(!can())return;tone(380+p*620,0,.025,'square',.025)},
  end:function(nb){
    if(!can())return;
    if(nb){[0,4,7,12].forEach(function(d,n){tone(261.63*Math.pow(2,d/12)*K(),.2+n*.1,.5,'main',.11)})}
    else{tone(392*K(),0,.22,'main',.1);tone(330*K(),.18,.4,'main',.1)}
  },
  preview:function(){if(!can())return;[0,2,4,7].forEach(function(d,n){tone(pf(d),n*.07,.18,'main',.11)})}
};

/* ---------------- particles ---------------- */
var cv=null,cx=null,W=0,H=0,P=[],raf=0;
function ensureCanvas(){
  if(cv)return;
  cv=document.createElement('canvas');cv.className='jx-fx';cv.setAttribute('aria-hidden','true');document.body.appendChild(cv);cx=cv.getContext('2d');
  var size=function(){var d=Math.min(2,g.devicePixelRatio||1);W=g.innerWidth;H=g.innerHeight;cv.width=W*d;cv.height=H*d;cx.setTransform(d,0,0,d,0,0)};
  size();g.addEventListener('resize',size);
}
function run(){if(!raf)raf=requestAnimationFrame(step)}
function drawShape(p){
  var s=p.size;
  switch(p.sh){
    case'leaf':cx.beginPath();cx.moveTo(-s,0);cx.quadraticCurveTo(0,-s*.95,s,0);cx.quadraticCurveTo(0,s*.95,-s,0);cx.fill();
      cx.globalAlpha*=.5;cx.strokeStyle='rgba(0,0,0,.45)';cx.lineWidth=1;cx.beginPath();cx.moveTo(-s*.9,0);cx.lineTo(s*.9,0);cx.stroke();break;
    case'glitch':cx.fillRect(-s*1.3,-s*.18,s*2.6,s*.36);break;
    case'bubble':cx.lineWidth=1.6;cx.strokeStyle=p.color;cx.beginPath();cx.arc(0,0,s*.7,0,6.283);cx.stroke();
      cx.globalAlpha*=.35;cx.beginPath();cx.arc(0,0,s*.7,0,6.283);cx.fill();break;
    case'ink':cx.beginPath();cx.arc(0,0,s*.6,0,6.283);cx.arc(s*.5,-s*.3,s*.3,0,6.283);cx.fill();break;
    case'sq':cx.fillRect(-s/2,-s/3,s,s*.66);break;
    default:cx.beginPath();cx.arc(0,0,s/2,0,6.283);cx.fill();
  }
}
function step(){
  raf=0;cx.clearRect(0,0,W,H);
  for(var i=P.length-1;i>=0;i--){
    var p=P[i];p.vy+=p.g;p.vx*=.986;p.x+=p.vx+(p.sway?Math.sin(p.life*9+p.rot)*p.sway:0);p.y+=p.vy;p.rot+=p.vr;p.life-=p.decay;
    if(p.life<=0||p.y>H+30||p.y<-60){P.splice(i,1);continue}
    cx.globalAlpha=Math.min(1,p.life*1.6);cx.fillStyle=p.color;cx.save();cx.translate(p.x,p.y);cx.rotate(p.sh==='glitch'?0:p.rot);
    drawShape(p);cx.restore();
  }
  cx.globalAlpha=1;
  if(P.length)raf=requestAnimationFrame(step);
}
function themeShape(){return cssColor(null,'--jx-shape')||'dot'}
function palette(main){
  var p1=cssColor(null,'--jx-p1'),p2=cssColor(null,'--jx-p2'),a=[main,main];
  if(p1&&p1!=='#fff')a.push(p1);if(p2&&p2!=='#fff')a.push(p2);return a;
}
J.burst=function(x,y,color,n,power,grav){
  if(!fx()||reduced())return;ensureCanvas();
  var shape=themeShape(),pal=palette(color);
  for(var i=0;i<n;i++){
    var a=Math.random()*6.283,s=(.35+Math.random())*power,sh=shape==='dot'?(Math.random()<.4?'sq':'dot'):(Math.random()<.2?'dot':shape);
    var floaty=sh==='leaf'||sh==='bubble';
    P.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-power*.2,g:grav==null?(sh==='bubble'?-.02:sh==='leaf'?.14:.28):grav,life:1,decay:(sh==='leaf'?.011:.014)+Math.random()*.022,size:(sh==='leaf'?5:3)+Math.random()*5,color:pal[i%pal.length],sh:sh,rot:Math.random()*6,vr:(Math.random()-.5)*(floaty?.2:.5),sway:sh==='leaf'?1.1:0});
  }
  run();
};
J.confetti=function(){
  if(!fx()||reduced())return;ensureCanvas();
  var cols=['maths','memory','logic','word'].map(function(k){return cssColor(null,'--'+k)}),shape=themeShape(),sh=shape==='dot'?'sq':shape;
  for(var i=0;i<130;i++){
    var left=i%2===0;
    P.push({x:left?-10:W+10,y:H*.6+Math.random()*H*.1,vx:(left?1:-1)*(5+Math.random()*10),vy:-(8+Math.random()*13),g:sh==='leaf'?.2:.32,life:1.6,decay:.008+Math.random()*.008,size:(sh==='leaf'?8:6)+Math.random()*7,color:cols[i%4],sh:sh,rot:Math.random()*6,vr:(Math.random()-.5)*.4,sway:sh==='leaf'?1.4:0});
  }
  run();
};
function stagePoint(stage,fx_,fy_){var r=stage.getBoundingClientRect();return{x:r.left+r.width*(fx_==null?.5:fx_),y:r.top+r.height*(fy_==null?.55:fy_),r:r}}

/* ---------------- full-screen flash / vignette ---------------- */
var flashEl=null,vigEl=null;
function flash(color,a){
  if(!fx()||reduced())return;
  if(!flashEl){flashEl=document.createElement('div');flashEl.className='jx-flash';document.body.appendChild(flashEl)}
  flashEl.style.background=color;flashEl.style.setProperty('--a',a);retrigger(flashEl,'go');
}
function vig(on){
  if(!vigEl){vigEl=document.createElement('div');vigEl.className='jx-vig';vigEl.setAttribute('aria-hidden','true');document.body.appendChild(vigEl)}
  vigEl.classList.toggle('on',!!on&&fx()&&!reduced());
}

/* ---------------- stage helpers ---------------- */
function pop(stage,text,cls,x,y){
  if(!stage)return;var el=document.createElement('div');
  el.className='jx-pop'+(cls?' '+cls:'');el.textContent=text;
  el.style.left=(x==null?50:x)+'%';el.style.top=(y==null?34:y)+'%';stage.appendChild(el);
  setTimeout(function(){el.remove()},950);
}
function ring(stage,n){
  if(reduced())return;var el=document.createElement('div');el.className='jx-ring';
  el.style.left='50%';el.style.top='58%';el.style.setProperty('--r',n||6);stage.appendChild(el);setTimeout(function(){el.remove()},650);
}
var TIERS=[[25,'Legend'],[20,'Unreal'],[15,'Blazing'],[10,'On fire'],[5,'Warm']];
function tierName(n){for(var i=0;i<TIERS.length;i++)if(n>=TIERS[i][0])return TIERS[i][1];return''}
function mult(s){return(1+Math.min(Math.max(s-1,0),10)*.1).toFixed(1)}

J.heat=function(stage,streak){if(stage){stage.style.setProperty('--heat',fx()?Math.min(1,streak/20).toFixed(2):0);stage.classList.toggle('jx-hot',fx()&&streak>=3)}};
J.pips=function(el,streak){
  if(!el)return;var n=streak%5,full=streak>0&&n===0,html='';
  for(var i=0;i<5;i++)html+='<i'+((full||i<n)?' class="on"':'')+'></i>';
  el.innerHTML=html;el.classList.remove('full');if(full&&fx()){void el.offsetWidth;el.classList.add('full')}
};

/* ---------------- the events ---------------- */
/* per answer: small and quick. Milestones are NOT drawn over the question; the caller shows a slide between questions */
J.correct=function(o){
  var st=o.stage,s=o.streak||1;
  J.heat(st,s);S.ok(s);
  var milestone=s%5===0?{kind:'streak',streak:s}:null;
  if(!fx())return{slide:milestone};
  buzz(8);
  st.classList.remove('jx-ok');void st.offsetWidth;st.classList.add('jx-ok');
  st.style.setProperty('--s',(1.012+Math.min(s,15)*.0016).toFixed(4));retrigger(st,'jx-thump');
  ring(st,5+Math.min(s,10)*.4);
  var c=cssColor(st,'--c'),pt=stagePoint(st);
  J.burst(pt.x,pt.y,c,8+Math.min(s,20)*1.4,4+Math.min(s,20)*.15);
  if(o.points!=null)pop(st,'+'+o.points);
  if(o.timeEl&&o.time){var tr=o.timeEl.getBoundingClientRect(),ts=st.getBoundingClientRect();pop(st,'+'+o.time+'s','good',((tr.left+tr.width/2)-ts.left)/ts.width*100,6)}
  return{slide:milestone};
};
J.wrong=function(o){
  var st=o.stage;S.bad();
  if(o.lostStreak>=5)setTimeout(S.lost,160);
  J.heat(st,0);
  if(!fx())return;
  buzz([40,40,40]);
  st.classList.remove('jx-bad');void st.offsetWidth;st.classList.add('jx-bad');
  st.style.setProperty('--amp','10px');retrigger(st,'jx-shake');
  flash(cssColor(null,'--bad'),.18);
  if(o.timeEl){var r=o.timeEl.getBoundingClientRect(),s=st.getBoundingClientRect();
    pop(st,'−'+(o.penalty||2)+'s','bad',((r.left+r.width/2)-s.left)/s.width*100,6)}
  if(o.railEl)retrigger(o.railEl,'jx-jolt');
  var pt=stagePoint(st);J.burst(pt.x,pt.y,cssColor(null,'--bad'),12,4,.35);
};

/* The between-questions slide. Timer must be paused by the caller until onDone. Tap or Enter skips it. */
J.streakSlide=function(streak){
  return{kind:'streak',streak:streak,kicker:'Streak '+streak,title:tierName(streak),sub:streak+' in a row',chip:'x'+mult(streak)+' multiplier'};
};
var activeEnd=null;
J.slide=function(o){
  var st=o.stage;
  if(o.kind==='streak'&&!o.title){var d=J.streakSlide(o.streak);for(var k in d)if(o[k]==null)o[k]=d[k]}
  if(!fx()||!st){if(o.onDone)o.onDone();return}
  /* its own card: the puzzle card steps aside and a same-sized popup card takes its place until it ends */
  var c=cssColor(st,'--c'),h=st.offsetHeight,cs=g.getComputedStyle(st);
  var el=document.createElement('div');el.className='jx-slide '+(o.kind||'');el.setAttribute('role','status');
  el.style.setProperty('--c',c);el.style.minHeight=h+'px';el.style.borderRadius=cs.borderRadius;
  el.innerHTML='<div class="s-k">'+esc(o.kicker||'')+'</div><div class="s-t">'+esc(o.title||'')+'</div>'+(o.sub?'<div class="s-sub">'+esc(o.sub)+'</div>':'')+(o.chip?'<div class="s-chip">'+esc(o.chip)+'</div>':'')+'<div class="s-hint">Tap to continue</div>';
  st.parentNode.insertBefore(el,st.nextSibling);st.style.display='none';
  var pt=stagePoint(el);
  if(o.kind==='event')S.event();else S.tier(o.streak||5);
  J.burst(pt.x,pt.y,c,36+Math.min((o.streak||5)/5,5)*10,7,.2);
  flash(c,.08);buzz([12,30,12]);
  var fin=false,t=0;
  function end(){
    if(fin)return;fin=true;clearTimeout(t);activeEnd=null;el.classList.add('out');
    setTimeout(function(){el.remove();st.style.display='';if(o.onDone)o.onDone()},reduced()?0:170);
  }
  activeEnd=end;el.addEventListener('click',end);t=setTimeout(end,o.ms||520);
};
J.slideOpen=function(){return!!activeEnd};
J.dismissSlide=function(){if(activeEnd)activeEnd()};

var GLYPH={maths:'+ − ×',memory:'• • •',logic:'1 2 4 ?',word:'A → Z',space:'↑ → ↓',code:'A → D',typing:'⌨ abc'};
J.glyph=function(key){return GLYPH[key]||''};
J.switchTo=function(o){
  var st=o.stage;S.sw();
  if(!fx())return 0;
  var el=st.querySelector('.jx-curtain');if(el)el.remove();
  el=document.createElement('div');el.className='jx-curtain';
  var ic=o.key&&g.SwitchVisuals?g.SwitchVisuals.icon(o.key,'big'):'';
  el.innerHTML=ic+'<span class="k">Switch to</span><b>'+o.name.split('').map(function(ch,i){return'<span style="--i:'+i+'">'+esc(ch)+'</span>'}).join('')+'</b><span class="glyph">'+esc(o.glyph||'')+'</span>';
  st.appendChild(el);void el.offsetWidth;el.classList.add('go');
  setTimeout(function(){el.remove()},760);
  [].forEach.call(st.children,function(ch,i){if(!/jx-(curtain|pop|ring|slide)/.test(ch.className)){ch.style.setProperty('animation','jx-stagein .4s '+(.32+i*.05)+'s var(--jx-ease) both')}});
  setTimeout(function(){[].forEach.call(st.children,function(ch){ch.style.removeProperty('animation')})},1000);
  buzz(14);
  return o.ms||600;
};
J.lowTime=function(secs,o){
  var urgent=secs<=5;
  vig(secs>0&&secs<=10);
  if(o&&o.railEl)o.railEl.classList.toggle('jx-pulse',secs>0&&secs<=10&&fx()&&!reduced());
  if(secs<=0||secs>10)return;
  S.tick(urgent);if(o&&o.timeEl)retrigger(o.timeEl,'jx-lowtick');
  if(urgent)buzz(10);
};
J.lowOff=function(o){vig(false);if(o&&o.railEl)o.railEl.classList.remove('jx-pulse')};
J.countUp=function(el,from,to,ms,done){
  if(!el)return;
  if(!fx()||reduced()||to<=from||!ms){el.textContent=to;if(done)done();return}
  var t0=performance.now(),lastTick=0;
  (function f(now){
    var p=Math.min(1,(now-t0)/ms),e=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(now-lastTick>55&&p<1){S.count(p);lastTick=now}
    if(p<1)requestAnimationFrame(f);else{el.textContent=to;retrigger(el,'jx-landed');if(done)done()}
  })(t0);
};
J.levelUp=function(o){
  S.level();
  if(!fx())return;
  var el=document.createElement('div');el.className='jx-level';el.setAttribute('role','dialog');el.setAttribute('aria-label','Level up');
  el.innerHTML='<div class="box"><span class="k">Level up</span><div class="n">'+esc(o.level)+'</div><div class="rank">'+esc(o.rank||'')+'</div>'+(o.unlocked&&o.unlocked.length?'<div class="unl">Unlocked: '+esc(o.unlocked.join(', '))+'</div>':'')+'</div>';
  document.body.appendChild(el);
  J.confetti();buzz([20,40,20,40,60]);
  var close=function(){el.style.transition='opacity .25s';el.style.opacity=0;setTimeout(function(){el.remove()},260)};
  el.addEventListener('click',close);setTimeout(close,3200);
};
J.end=function(o){S.end(o&&o.newBest);if(o&&o.newBest)setTimeout(J.confetti,350)};
J.init=function(o){if(o&&o.getPack)J.getPack=o.getPack};
g.Juice=J;
})(window);
