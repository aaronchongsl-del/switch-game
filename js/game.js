(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var TYPES={maths:{n:'Maths',c:'var(--maths)'},memory:{n:'Memory',c:'var(--memory)'},logic:{n:'Logic',c:'var(--logic)'},word:{n:'Words',c:'var(--word)'},space:{n:'Spatial',c:'var(--space)'},code:{n:'Code',c:'var(--code)'},typing:{n:'Typing',c:'var(--typing)'}};
var KEYS=['maths','memory','logic','word','space','code','typing'];
var VIS=window.SwitchVisuals;
function ico(k){return VIS?VIS.icon(k):''}
var RUN=90, PENALTY=2;

/* ---------- storage ---------- */
var KEY='switch.v1';
var db={xp:0,best:0,runs:0,badges:{},board:[],name:'',dailyDone:{},stats:{},streak:{count:0,last:''},goals:{date:'',done:{}},skin:'classic',sound:'classic',fx:true,mute:false,playerId:''};
try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s)for(var k in s)db[k]=s[k]}catch(e){}
KEYS.forEach(function(k){db.stats[k]=db.stats[k]||{ok:0,bad:0}});
if(!db.playerId){db.playerId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});save()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}

/* ---------- rng ---------- */
function hash(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^=h>>>16)>>>0}}
function rngFrom(str){var a=hash(str)();return{
  f:function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296},
  int:function(lo,hi){return lo+Math.floor(this.f()*(hi-lo+1))},
  pick:function(arr){return arr[Math.floor(this.f()*arr.length)]},
  shuffle:function(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(this.f()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}}}

/* ---------- words ---------- */
var WORDS=['brick','tiger','piano','whale','flute','globe','sheep','tulip','lunch','mouse','ghost','lemon','melon',
 'bridge','window','jungle','rocket','pencil','button','mirror','pocket','basket','ribbon','tunnel','wizard','shadow','pirate',
 'blanket','lantern','whistle','journey','thunder','volcano','balloon','chimney','compass',
 'elephant','umbrella','notebook','sandwich','mountain','dinosaur','keyboard','fireplace','telephone','chocolate','adventure','crocodile','porcupine'];
var ALT={ghost:['goths'],lemon:['melon'],melon:['lemon']};
function wordsOfLen(lo,hi){return WORDS.filter(function(w){return w.length>=lo&&w.length<=hi})}
function sortLetters(w){return w.split('').sort().join('')}
function between(d,lo,hi){return d>=lo&&d<=hi}

/* ---------- puzzle generators: return {ask,big,kind,answer,alts,choices,flash,cls}; d is difficulty 1..8 ---------- */
var GEN={};
GEN.maths=function(r,d){
  var pool=[['add',1,5],['sub',1,5],['mul',1,4],['missing',1,6],['expr',2,8],['pct',3,8],['div',3,8],['mulbig',4,8],['add3',5,8],['expr2',5,8],['par',6,8],['mul2',6,8]]
    .filter(function(x){return between(d,x[1],x[2])});
  var k=r.pick(pool)[0],a,b,c,e,m=20+22*d;
  function mk(big,ans){return{ask:'Solve it',big:big,kind:'num',answer:String(ans)}}
  switch(k){
    case 'add':a=r.int(12,m+20);b=r.int(12,m+20);return mk(a+' + '+b,a+b);
    case 'sub':a=r.int(30,m+60);b=r.int(11,a-5);return mk(a+' − '+b,a-b);
    case 'mul':a=r.int(3,8+d);b=r.int(3,8+d);return mk(a+' × '+b,a*b);
    case 'missing':a=r.int(12,m);b=r.int(a+8,m*2+10);return mk(a+' + ? = '+b,b-a);
    case 'expr':a=r.int(3,9);b=r.int(3,12);c=r.int(2,Math.min(30,a*b-1));return mk(a+' × '+b+' − '+c,a*b-c);
    case 'pct':{var p=r.pick([10,20,25,50,75]);var base=r.pick([40,60,80,120,160,200,240,360]);return mk(p+'% of '+base,p*base/100)}
    case 'div':b=r.int(4,12);c=r.int(6,15+d);return mk((b*c)+' ÷ '+b,c);
    case 'mulbig':a=r.int(12,19+d*2);b=r.int(3,9);return mk(a+' × '+b,a*b);
    case 'add3':a=r.int(120,899);b=r.int(120,899);return mk(a+' + '+b,a+b);
    case 'expr2':a=r.int(3,9);b=r.int(3,9);c=r.int(3,9);e=r.int(3,9);return mk(a+' × '+b+' + '+c+' × '+e,a*b+c*e);
    case 'par':a=r.int(4,19);b=r.int(3,15);c=r.int(3,9);return mk('('+a+' + '+b+') × '+c,(a+b)*c);
    default:a=r.int(12,25);b=r.int(11,19);return mk(a+' × '+b,a*b);
  }
};
GEN.memory=function(r,d){
  var vs=['digits','which'];
  if(d>=2)vs.push('back','digits');
  if(d>=3)vs.push('nth');
  if(d>=4)vs.push('sum');
  var v=r.pick(vs),len=Math.min(9,3+Math.floor((d+1)*0.8)),digits='',i;
  var ms=Math.max(600,400+len*190-d*50);
  function nums(n,lo,hi){var out=[],used={};while(out.length<n){var x=r.int(lo,hi);if(!used[x]){used[x]=1;out.push(x)}}return out}
  if(v==='which'){
    var cnt=Math.min(6,3+Math.floor(d/2)),hi=d>=5?199:99,pool=nums(cnt+3,11,hi),shown=pool.slice(0,cnt),pick=r.pick(shown);
    var opts=r.shuffle([pick].concat(pool.slice(cnt,cnt+3)));
    return{ask:cnt+' numbers flash. Which of these was one of them?',flash:{text:shown.join('  '),ms:900+cnt*350},kind:'choice',answer:String(pick),choices:opts.map(String)};
  }
  if(v==='nth'){
    var n=Math.min(6,4+Math.floor(d/3)),arr=nums(n,11,99),idx=r.int(1,n),ord=['1st','2nd','3rd','4th','5th','6th'];
    return{ask:'Remember the order. What was the '+ord[idx-1]+' number?',flash:{text:arr.join('  '),ms:800+n*380},kind:'num',answer:String(arr[idx-1])};
  }
  if(v==='sum'){
    var cn=Math.min(5,3+Math.floor(d/4)),ar=nums(cn,2,d>=6?29:19),tot=ar.reduce(function(s,x){return s+x},0);
    return{ask:'Add them up from memory',flash:{text:ar.join(' + '),ms:900+cn*450},kind:'num',answer:String(tot)};
  }
  for(i=0;i<len;i++)digits+=r.int(i?0:1,9);
  if(v==='back')return{ask:'Type it backwards',flash:{text:digits,ms:ms+250},kind:'num',answer:digits.split('').reverse().join('')};
  return{ask:'Remember the digits, then type them',flash:{text:digits,ms:ms},kind:'num',answer:digits};
};
GEN.logic=function(r,d){
  var vs=['seq','seq','odd','order'];
  var v=r.pick(vs);
  if(v==='seq'){
    var kinds=[['arith',1,3],['geo',2,5],['alt',3,6],['sq',3,6],['fib',4,8],['dbl',4,8],['tri',5,8],['cube',5,8],['inter',6,8],['sqdiff',7,8]].filter(function(x){return between(d,x[1],x[2])});
    var k=r.pick(kinds)[0],t=[],s,i;
    if(k==='arith'){s=r.int(2,20);var st=r.int(2,3+2*d);for(i=0;i<5;i++)t.push(s+st*i)}
    else if(k==='geo'){s=r.int(1,4);var q=r.pick(d>=4?[2,3,4]:[2,3]);for(i=0;i<5;i++)t.push(s*Math.pow(q,i))}
    else if(k==='alt'){s=r.int(2,12);var p=r.int(3,8),m=r.int(1,3);t=[s];for(i=1;i<6;i++)t.push(t[i-1]+(i%2?p:-m))}
    else if(k==='sq'){var o=r.int(-3,5),n0=r.int(1,5);for(i=0;i<5;i++)t.push((n0+i)*(n0+i)+o)}
    else if(k==='fib'){var x=r.int(1,4),y=r.int(2,6);t=[x,y];for(i=2;i<6;i++)t.push(t[i-1]+t[i-2])}
    else if(k==='dbl'){s=r.int(1,5);var mul=r.int(2,3),add=r.pick([-1,1,2]);t=[s];for(i=1;i<5;i++)t.push(t[i-1]*mul+add)}
    else if(k==='tri'){s=r.int(1,9);var df=r.int(1,3);t=[s];for(i=1;i<7;i++){t.push(t[i-1]+df);df++}}
    else if(k==='cube'){var c0=r.int(1,4),oo=r.pick([0,0,1,-1]);for(i=0;i<5;i++)t.push(Math.pow(c0+i,3)+oo)}
    else if(k==='inter'){var a1=r.int(2,10),s1=r.int(2,5),b1=r.int(10,30),s2=r.pick([-3,-2,3,4,5]);for(i=0;i<7;i++)t.push(i%2?b1+s2*((i-1)/2):a1+s1*(i/2))}
    else{s=r.int(1,6);t=[s];for(i=1;i<6;i++)t.push(t[i-1]+i*i)}
    var ans=t.pop();
    return{ask:'What comes next?',big:t.join(', ')+', _',kind:'num',answer:String(ans),cls:'seq',terms:t.slice()};
  }
  if(v==='odd'){
    var rules=['mult','mult'];
    if(d>=3)rules.push('square');
    if(d>=4)rules.push('prime');
    var rule=r.pick(rules),set=[],odd,L;
    if(rule==='mult'){
      var kk=r.int(3,Math.min(9,5+d)),top=7+3*d,par=r.int(0,1);
      while(set.length<3){var mm=r.int(2,top);if(kk%2===1&&mm%2!==par)continue;var val=mm*kk;if(set.indexOf(val)<0)set.push(val)}
      var wantPar=set[0]%2;
      do{odd=r.int(6,top*kk)}while(odd%kk===0||odd%2!==wantPar||set.indexOf(odd)>=0);
      L='Three follow one rule. Which one does not belong?';
    }else if(rule==='square'){
      var sqs=[16,25,36,49,64,81,100,121,144,169,196,225],pp=r.int(0,1);
      var pl=sqs.filter(function(x){return x%2===pp});set=r.shuffle(pl).slice(0,3);
      do{odd=r.int(10,230)}while(Math.sqrt(odd)%1===0||odd%2!==pp);
      L='Three follow one rule. Which one does not belong?';
    }else{
      var pr=[3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61],cp=[9,15,21,25,27,33,35,39,45,49,51,55,57,63,65,69,77,85,91];
      set=r.shuffle(pr).slice(0,3);odd=r.pick(cp);L='Three follow one rule. Which one does not belong?';
    }
    return{ask:L,kind:'choice',answer:String(odd),choices:r.shuffle(set.concat([odd]).map(String))};
  }
  var names=r.shuffle(['Mia','Leo','Ava','Kai','Zoe','Sam','Ivy','Ben','Noor','Raj']);
  var adj=r.pick([['taller','shorter','tallest','shortest','second tallest'],['older','younger','oldest','youngest','second oldest'],['faster','slower','fastest','slowest','second fastest'],['heavier','lighter','heaviest','lightest','second heaviest']]);
  var n=d<=2?3:4,chain=names.slice(0,n),pairs=[];
  for(var j=0;j<n-1;j++){
    if(d>=4&&r.f()<.5)pairs.push(chain[j+1]+' is '+adj[1]+' than '+chain[j]+'.');
    else pairs.push(chain[j]+' is '+adj[0]+' than '+chain[j+1]+'.');
  }
  var qs=[[adj[2],chain[0]],[adj[3],chain[n-1]]];
  if(n>=4)qs.push([adj[4],chain[1]]);
  if(n===5)qs.push(['in the middle',chain[2]]);
  var qq=r.pick(qs);
  return{ask:r.shuffle(pairs).join(' ')+' Who is '+(qq[0]==='in the middle'?'in the middle':'the '+qq[0].replace(/^the /,''))+'?',kind:'choice',answer:qq[1],choices:r.shuffle(chain)};
};
GEN.word=function(r,d){
  var vs=['anagram','anagram','reverse','vowels'];
  if(d>=3)vs.push('alpha');
  var v=r.pick(vs),hi=Math.min(9,4+d),lo=Math.max(5,hi-2);
  if(v==='anagram'){
    var w=r.pick(wordsOfLen(lo,hi)),sc;
    do{sc=r.shuffle(w.split('')).join('')}while(sc===w);
    return{ask:'Unscramble the word',big:sc,kind:'text',answer:w,alts:ALT[w]||[],cls:'word',anagram:true};
  }
  if(v==='reverse'){
    var w2=r.pick(wordsOfLen(Math.max(4,hi-3),Math.max(5,Math.min(9,3+d))));
    return{ask:'Type this word backwards',big:w2,kind:'text',answer:w2.split('').reverse().join(''),cls:'word'};
  }
  if(v==='alpha'){
    var w4=r.pick(wordsOfLen(5,Math.min(9,3+d)));
    return{ask:'Type the letters in alphabetical order',big:w4,kind:'text',answer:sortLetters(w4),cls:'word'};
  }
  var w3=r.pick(wordsOfLen(6,9)),cnt=w3.replace(/[^aeiou]/g,'').length,opts=[cnt];
  if(cnt<=4)opts=[1,2,3,4];else[cnt-1,cnt+1,cnt-2,cnt+2].forEach(function(x){if(opts.length<4&&opts.indexOf(x)<0)opts.push(x)});
  return{ask:'How many vowels (a e i o u)?',big:w3,kind:'choice',answer:String(cnt),choices:r.shuffle(opts).map(String),cls:'word'};
};
if(window.SwitchQuestions)SwitchQuestions.install(GEN);

/* ---------- ranks, unlocks, goals ---------- */
var RANKS=['Novice','Apprentice','Quick','Sharp','Agile','Switcher','Switchblade','Prodigy','Savant','Grandmaster'];
function rankName(l){return RANKS[Math.min(l-1,RANKS.length-1)]}
var SKINS=[
 {id:'classic',n:'Classic',d:'Clean and dark',lv:1,bg:'#0d1117',dots:['#ffb23e','#4cd6e0','#9be564','#ff7466']},
 {id:'jungle',n:'Jungle',d:'Fronds, fireflies, leaves',lv:3,bg:'#0f2c1c',dots:['#ffd24a','#4fe3c1','#b4f24a','#ff9560']},
 {id:'deep',n:'Deep sea',d:'Light rays and bubbles',lv:5,bg:'#08293f',dots:['#ffd479','#5ef2e6','#8dffb0','#ff86ab']},
 {id:'cyber',n:'Cyberpunk',d:'Neon grid, skyline, glitch',lv:7,bg:'#0e0a1d',dots:['#fcee09','#00f0ff','#00ff9c','#ff2a6d']},
 {id:'notebook',n:'Notebook',d:'Graph paper and marker',lv:9,bg:'#ffffff',dots:['#d9480f','#0b7285','#2b8a3e','#c2255c']}
];
var SKIN_MAP={ember:'jungle',ocean:'deep',neon:'cyber',paper:'notebook'};
var PACKS=[
 {id:'classic',n:'Classic',lv:1,w:'triangle',k:1},
 {id:'chip',n:'Chip',lv:2,w:'square',k:1},
 {id:'bell',n:'Bell',lv:4,w:'sine',k:1.5},
 {id:'arcade',n:'Arcade',lv:6,w:'sawtooth',k:1.25},
 {id:'marimba',n:'Marimba',lv:8,w:'sine',k:1,over:3.9},
 {id:'synth',n:'Synth',lv:10,w:'sawtooth',k:.5,lp:1800}
];
if(SKIN_MAP[db.skin])db.skin=SKIN_MAP[db.skin];
function pack(){return PACKS.filter(function(x){return x.id===db.sound})[0]||PACKS[0]}
var GOAL_XP=50;
var GOALS=[
 {id:'st5',t:'Reach a 5 streak',f:function(r){return r.bestStreak>=5}},
 {id:'st10',t:'Reach a 10 streak',f:function(r){return r.bestStreak>=10}},
 {id:'sc800',t:'Score 800 in one run',f:function(r){return r.score>=800}},
 {id:'sc1500',t:'Score 1500 in one run',f:function(r){return r.score>=1500}},
 {id:'m3',t:'Get 3 maths right in one run',f:function(r){return r.per.maths.ok>=3}},
 {id:'me3',t:'Get 3 memory right in one run',f:function(r){return r.per.memory.ok>=3}},
 {id:'l3',t:'Get 3 logic right in one run',f:function(r){return r.per.logic.ok>=3}},
 {id:'w3',t:'Get 3 word puzzles right in one run',f:function(r){return r.per.word.ok>=3}},
 {id:'ok25',t:'25 right answers in one run',f:function(r){return r.ok>=25}},
 {id:'acc',t:'90% accuracy over 10+ answers',f:function(r){return r.ok+r.bad>=10&&r.ok/(r.ok+r.bad)>=.9}}
];
function dailyGoals(){return rngFrom('goals-'+today()).shuffle(GOALS).slice(0,3)}
function streakNow(){return(db.streak.last===today()||db.streak.last===yesterday())?db.streak.count:0}
function bumpStreak(){var t=today();if(db.streak.last===t)return;db.streak.count=db.streak.last===yesterday()?db.streak.count+1:1;db.streak.last=t}
var BADGES=[
 {id:'first',n:'First run',d:'Finish a run',t:function(r){return true}},
 {id:'k500',n:'Warming up',d:'Score 500',t:function(r){return r.score>=500}},
 {id:'k1500',n:'In the zone',d:'Score 1500',t:function(r){return r.score>=1500}},
 {id:'k3000',n:'Switchblade',d:'Score 3000',t:function(r){return r.score>=3000}},
 {id:'s10',n:'Streak of 10',d:'10 correct in a row',t:function(r){return r.bestStreak>=10}},
 {id:'s20',n:'Streak of 20',d:'20 correct in a row',t:function(r){return r.bestStreak>=20}},
 {id:'maths',n:'Number cruncher',d:'5+ maths, no misses',t:function(r){return r.per.maths.ok>=5&&r.per.maths.bad===0}},
 {id:'memory',n:'Memory palace',d:'4+ memory, no misses',t:function(r){return r.per.memory.ok>=4&&r.per.memory.bad===0}},
 {id:'logic',n:'Pattern hunter',d:'5+ logic, no misses',t:function(r){return r.per.logic.ok>=5&&r.per.logic.bad===0}},
 {id:'word',n:'Wordsmith',d:'5+ words, no misses',t:function(r){return r.per.word.ok>=5&&r.per.word.bad===0}},
 {id:'all',n:'All rounder',d:'Right in every type',t:function(r){return ['maths','memory','logic','word'].every(function(k){return r.per[k].ok>=2})}},
 {id:'nohint',n:'Pure mind',d:'15+ right, no hints',t:function(r){return r.ok>=15&&r.hintsUsed===0}},
 {id:'daily',n:'Daily regular',d:'Finish a daily run',t:function(r){return r.mode==='daily'}}
];
function lvlOf(xp){return Math.floor(Math.sqrt(xp/60))+1}
function xpFor(l){return 60*(l-1)*(l-1)}

/* ---------- views ---------- */
function show(id){['start','game','result'].forEach(function(s){$(s).hidden=s!==id});window.scrollTo(0,0)}
function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return fmt(new Date())}
function yesterday(){return fmt(new Date(Date.now()-864e5))}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------- look and sound (one panel, on the start screen and in the in-run sheet) ---------- */
Juice.init({getPack:pack});
Juice.enabled=db.fx!==false;Juice.muted=!!db.mute;
document.documentElement.setAttribute('data-skin',db.skin);
function optsHtml(){
  return '<div class="label">Look</div><div class="themes">'+SKINS.map(function(t){
    return '<button class="tchip" data-skin="'+t.id+'" aria-pressed="false"><span class="sw" style="background:'+t.bg+'">'+t.dots.map(function(c){return '<i style="background:'+c+'"></i>'}).join('')+'</span><b>'+t.n+'</b><small>'+t.d+'</small></button>'}).join('')+'</div>'+
  '<div class="label" style="margin-top:6px">Sound</div><div class="labbar">'+PACKS.map(function(p){return '<button class="lb" data-pack="'+p.id+'" aria-pressed="false">'+p.n+'</button>'}).join('')+'</div>'+
  '<div class="labbar" style="margin-top:6px"><button class="lb" data-toggle="juice" aria-pressed="true">Effects: on</button><button class="lb" data-toggle="mute" aria-pressed="false">Sound: on</button></div>';
}
function syncOpts(){
  var lv=lvlOf(db.xp);
  document.querySelectorAll('.tchip[data-skin]').forEach(function(b){
    var s=SKINS.filter(function(x){return x.id===b.dataset.skin})[0],ok=lv>=s.lv;
    b.disabled=!ok;b.setAttribute('aria-pressed',String(b.dataset.skin===db.skin));b.querySelector('small').textContent=ok?s.d:'Unlocks at level '+s.lv;
  });
  document.querySelectorAll('[data-pack]').forEach(function(b){
    var p=PACKS.filter(function(x){return x.id===b.dataset.pack})[0],ok=lv>=p.lv;
    b.disabled=!ok;b.setAttribute('aria-pressed',String(b.dataset.pack===db.sound));b.textContent=ok?p.n:p.n+' (level '+p.lv+')';
  });
  document.querySelectorAll('[data-toggle="juice"]').forEach(function(b){b.setAttribute('aria-pressed',String(Juice.enabled));b.textContent='Effects: '+(Juice.enabled?'on':'off')});
  document.querySelectorAll('[data-toggle="mute"]').forEach(function(b){b.setAttribute('aria-pressed',String(Juice.muted));b.textContent='Sound: '+(Juice.muted?'off':'on')});
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-skin],[data-pack],[data-toggle]');if(!b||b.disabled)return;
  Juice.unlock();
  if(b.dataset.skin){db.skin=b.dataset.skin;document.documentElement.setAttribute('data-skin',db.skin)}
  else if(b.dataset.pack){db.sound=b.dataset.pack;save();Juice.sound.preview()}
  else if(b.dataset.toggle==='juice'){Juice.enabled=!Juice.enabled;db.fx=Juice.enabled}
  else if(b.dataset.toggle==='mute'){Juice.muted=!Juice.muted;db.mute=Juice.muted}
  save();syncOpts();
});
function openSheet(){if(g&&!$('game').hidden)g.menu=true;$('sheet').hidden=false;syncOpts();$('closeOpts').focus()}
function closeSheet(){$('sheet').hidden=true;if(g){g.menu=false;g.last=performance.now()}}

/* ---------- start screen ---------- */
function renderStart(){
  $('cats').innerHTML=KEYS.map(function(k){return '<div class="cat" style="--c:'+TYPES[k].c+'">'+ico(k)+TYPES[k].n+'</div>'}).join('');
  var l=lvlOf(db.xp),lo=xpFor(l),hi=xpFor(l+1);
  $('lvl').textContent='Level '+l+' · '+rankName(l);$('xpTxt').textContent=db.xp+' / '+hi+' XP';
  $('xpBar').style.width=Math.round((db.xp-lo)/(hi-lo)*100)+'%';
  $('bestTxt').textContent=db.best;
  $('badges').innerHTML=BADGES.map(function(b){var on=db.badges[b.id];return '<div class="badge '+(on?'on':'off')+'"><b>'+b.n+'</b><span>'+b.d+'</span></div>'}).join('');
  $('dailyNote').textContent=db.dailyDone[today()]?'done today: '+db.dailyDone[today()]:'same for everyone today';
  renderBoard();renderToday();renderRatings();syncOpts();
}
function renderToday(){
  var n=streakNow(),played=db.streak.last===today();
  $('streakTxt').innerHTML='<b>'+n+'</b> day Daily streak'+(!played?(n?' · play today\'s Daily run to keep it':' · play today\'s Daily run to start one'):' · done for today');
  var done=db.goals.date===today()?db.goals.done:{};
  $('goals').innerHTML=dailyGoals().map(function(x){return '<li class="'+(done[x.id]?'done':'')+'"><span class="tick">'+(done[x.id]?'✓':'')+'</span><span>'+esc(x.t)+'</span><span class="mono">+'+GOAL_XP+' XP</span></li>'}).join('');
}
function renderRatings(){
  var weakest=null,wr=101;
  KEYS.forEach(function(k){var st=db.stats[k],n=st.ok+st.bad;if(n>=10){var a=st.ok/n*100;if(a<wr){wr=a;weakest=k}}});
  $('ratings').innerHTML=KEYS.map(function(k){var st=db.stats[k],n=st.ok+st.bad,pc=n?Math.round(st.ok/n*100)+'%':'-';
    return '<button class="rate" data-train="'+k+'" style="--c:'+TYPES[k].c+'"><span class="rn">'+ico(k)+TYPES[k].n+'</span><b class="mono">'+pc+'</b><span class="rs">'+(k===weakest?'Weakest. ':'')+'Train</span></button>'}).join('');
}
var boardTab='all';
function localRows(){
  var t=today(),rows=db.board.filter(function(e){return boardTab==='all'||(boardTab==='today'&&e.date===t)||(boardTab==='daily'&&e.mode==='daily'&&e.date===t)});
  rows.sort(function(a,b){return b.score-a.score});return rows.slice(0,10);
}
function paintBoard(rows){
  $('board').innerHTML=rows.length?rows.map(function(e,i){return '<li><span class="mono" style="color:var(--mute)">'+(i+1)+'</span><span class="n">'+esc(e.name)+'</span><b class="mono">'+e.score+'</b></li>'}).join(''):'<li style="display:block"><span class="note">No scores here yet. Play a run and save yours.</span></li>';
}
function renderBoard(){
  document.querySelectorAll('.tab').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.b===boardTab))});
  var scope=boardTab;
  if(window.Board&&Board.enabled){
    $('boardNote').textContent='Loading the online board…';
    Board.top(scope,today()).then(function(rows){if(boardTab!==scope)return;paintBoard(rows||[]);$('boardNote').textContent='Online leaderboard, shared with everyone who plays.'})
      .catch(function(){if(boardTab!==scope)return;paintBoard(localRows());$('boardNote').textContent='Could not reach the online board. Showing scores saved on this device.'});
  }else{
    paintBoard(localRows());$('boardNote').textContent='Scores are saved on this device only.';
  }
}

/* ---------- game ---------- */
var g=null,raf=0,stage=$('stage');
function startRun(mode,focus){
  Juice.unlock();Juice.dismissSlide();Juice.lowOff({railEl:$('rail')});
  if(g)g.done=true;
  var seed=mode==='daily'?'daily-'+today():'run-'+Date.now()+'-'+Math.random(),per={};
  KEYS.forEach(function(k){per[k]={ok:0,bad:0}});
  g={hints:3,hintsUsed:0,mode:mode,focus:focus||null,clock:0,hardLeft:0,doubleUntil:0,chaos:rngFrom(seed+':chaos'),nextEvt:0,seed:seed,
     left:RUN,last:performance.now(),paused:false,menu:false,locked:false,score:0,shown:0,streak:0,bestStreak:0,bestWpm:0,ok:0,bad:0,qi:0,per:per,
     bag:[],log:[],pending:[],cur:null,type:null,blockLeft:0,q:null,qStart:0,done:false,saved:false,lastSec:99,order:rngFrom(seed+':order')};
  g.nextEvt=18+g.chaos.int(0,6);
  $('evt').hidden=true;$('scoreN').textContent='0';$('time').textContent=RUN;$('railFill').style.width='100%';$('rail').dataset.zone='good';
  show('game');Juice.heat(stage,0);updHud();nextQ();
  cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);
}
function drawType(){
  if(g.focus)return g.focus;
  if(!g.bag.length)g.bag=g.order.shuffle(KEYS);
  if(g.bag[0]===g.type&&g.bag.length>1)g.bag.push(g.bag.shift());
  return g.bag.shift();
}
function diff(){return Math.min(8,1+Math.floor(g.ok/4)+(g.hardLeft>0?2:0))}
function mult(s){return 1+Math.min(Math.max(s-1,0),10)*.1}
/* streak milestones and surprise events wait here and play as a slide between questions, with the timer paused */
function runPending(next){
  var p=g.pending.shift();
  if(!p)return next();
  if(p.act)p.act();
  if(!Juice.enabled)return runPending(next);
  var run=g;
  Juice.slide(Object.assign({stage:stage},p,{onDone:function(){if(g===run&&!g.done)runPending(next)}}));
}
function nextQ(){
  var run=g,changed=false;
  if(g.blockLeft<=0){g.type=drawType();g.blockLeft=3+g.order.int(0,1);changed=true}
  g.blockLeft--;
  if(g.focus&&g.qi>0)changed=false;
  var r=rngFrom(g.seed+':q'+g.qi),q=GEN[g.type](r,diff());
  q.type=g.type;q.hard=g.hardLeft>0;if(g.hardLeft>0)g.hardLeft--;g.q=q;g.qi++;
  var T=TYPES[g.type];
  stage.style.setProperty('--c',T.c);$('ttype').innerHTML=ico(g.type)+esc(T.n);$('qn').textContent='Q'+g.qi;
  $('ask').textContent=q.ask;$('hintTxt').hidden=true;
  $('vis').innerHTML=(q.visual&&VIS)?VIS.render(q.visual):'';$('speed').hidden=$('tprog').hidden=!q.typing;if(q.typing)$('tprog').firstElementChild.style.width='0';
  var big=$('big');big.className='big'+(q.cls?' '+q.cls:'');big.textContent=q.big||'';
  updHints();
  $('inputZone').innerHTML='';g.locked=true;g.paused=true;
  var begin=function(){
    if(g!==run||g.done||g.q!==q)return;
    g.paused=false;g.last=performance.now();
    if(q.flash){
      big.className='big flash';big.textContent=q.flash.text;
      setTimeout(function(){if(g!==run||g.done||g.q!==q)return;big.textContent='• • •';buildInput(q)},q.flash.ms);
    }else buildInput(q);
  };
  runPending(function(){
    if(g!==run||g.done)return;
    var hold=0;
    if(changed||g.qi===1)hold=Juice.enabled?Juice.switchTo({stage:stage,name:T.n,glyph:Juice.glyph(g.type),ms:620}):450;
    if(hold)setTimeout(begin,hold);else begin();
  });
}
function buildInput(q){
  if(g.done||g.q!==q)return;
  var z=$('inputZone');
  if(q.kind==='choice'){
    if(q.choices.every(function(c){return /^\d+$/.test(c)}))q.choices.sort(function(a,b){return a-b});
    z.innerHTML='<div class="choices">'+q.choices.map(function(c,i){return '<button class="choice" data-v="'+esc(c)+'"><kbd>'+(i+1)+'</kbd>'+esc(c)+'</button>'}).join('')+'</div>';
    z.querySelectorAll('.choice').forEach(function(b){b.addEventListener('click',function(){submit(b.dataset.v,b)})});
  }else{
    z.innerHTML='<input class="ans" id="ans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Your answer" '+(q.kind==='num'?'inputmode="numeric" ':'')+'>';
    var inp=$('ans');
    if(q.typing&&VIS)q._t=VIS.typing($('big'),inp,q.answer,{speedEl:$('speed'),progEl:$('tprog')});
    inp.addEventListener('input',function(){
      var v=inp.value.trim().toLowerCase();if(!v)return;
      if(q.kind==='num'&&!/^-?\d*$/.test(v)){inp.value=v.replace(/[^\d-]/g,'');return}
      if(isRight(q,v))submit(v);
      else if(v.length>=q.answer.length)submit(v);
    });
  }
  g.locked=false;g.qStart=performance.now();
  var f=$('ans');if(f)f.focus({preventScroll:true});
}
function isRight(q,v){
  if(v===q.answer.toLowerCase())return true;
  if(q.alts&&q.alts.indexOf(v)>=0)return true;
  if(q.anagram&&v.length===q.answer.length&&sortLetters(v)===sortLetters(q.answer)&&WORDS.indexOf(v)>=0)return true;
  return false;
}
function logAnswer(q,given,right,skipped){
  g.log.push({type:q.type,ask:q.ask,shown:q.big||(q.flash&&q.flash.text)||'',given:given,answer:q.answer,ok:right,skipped:!!skipped,hinted:!!q.hinted});
}
function submit(v,btn){
  if(!g||g.locked||g.done||g.menu)return;
  var q=g.q,run=g;g.locked=true;
  var right=isRight(q,String(v).toLowerCase()),ms=performance.now()-g.qStart;
  logAnswer(q,String(v),right,false);
  if(btn)btn.classList.add(right?'jx-right':'jx-wrong');
  if(right){
    g.streak++;g.bestStreak=Math.max(g.bestStreak,g.streak);g.ok++;g.per[q.type].ok++;if(q._t)g.bestWpm=Math.max(g.bestWpm,q._t.wpm());
    var speed=q.hinted?0:Math.max(0,Math.round(40-ms/100));
    var factor=(g.clock<g.doubleUntil?2:1)*(q.hard?1.5:1)*(q.hinted?.5:1);
    var pts=Math.round((Math.round(100*mult(g.streak))+speed)*factor);
    g.score+=pts;
    var r=Juice.correct({stage:stage,streak:g.streak,points:pts});
    if(r.slide)g.pending.push(Juice.streakSlide(g.streak));
  }else loseStreak(q.type);
  updHud();
  setTimeout(function(){if(g===run&&!g.done)nextQ()},right?130:420);
}
function loseStreak(type){
  var was=g.streak;g.streak=0;g.bad++;g.per[type].bad++;g.left-=PENALTY;
  Juice.wrong({stage:stage,timeEl:$('time'),railEl:$('rail'),lostStreak:was,penalty:PENALTY});
}
function updHud(){
  $('streak').textContent=g.streak;$('mult').textContent=mult(g.streak).toFixed(1);
  Juice.pips($('pips'),g.streak);Juice.heat(stage,g.streak);
  var sc=$('scoreN');Juice.countUp(sc,g.shown,g.score,Juice.enabled?260:0);g.shown=g.score;
  if(Juice.enabled&&g.score>0){sc.style.setProperty('--s',1.25);sc.classList.remove('jx-bump');void sc.offsetWidth;sc.classList.add('jx-bump')}
}
/* ---------- hints (3 per run) ---------- */
function updHints(){
  var b=$('hint');if(!b||!g)return;
  $('hintsLeft').textContent=g.hints+' left';
  var q=g.q;b.disabled=!(g.hints>0&&q&&!q.hinted&&!(q.kind==='choice'&&q.choices.length<3));
}
function useHint(){
  if(!g||g.done||g.locked||g.menu||!g.q||g.hints<=0||g.q.hinted)return;
  var q=g.q,txt='';
  if(q.kind==='choice'){
    var wrong=q.choices.filter(function(c){return c!==q.answer});
    if(wrong.length<2)return;
    wrong.sort(function(){return Math.random()-.5});
    q.removed={};
    wrong.slice(0,wrong.length-1).forEach(function(c){q.removed[c]=1});
    document.querySelectorAll('.choice').forEach(function(b){if(q.removed[b.dataset.v])b.disabled=true});
    txt='50/50: '+(wrong.length-1)+' wrong option'+(wrong.length-1===1?'':'s')+' removed';
  }else if(q.flash){
    var big=$('big'),inp=$('ans'),run=g;g.locked=true;if(inp)inp.value='';
    big.className='big flash';big.textContent=q.flash.text;
    setTimeout(function(){if(g!==run||g.q!==q||g.done)return;big.textContent='• • •';g.locked=false;var f=$('ans');if(f)f.focus({preventScroll:true})},q.flash.ms);
    txt='Shown once more';
  }else if(q.terms){
    var t=q.terms,gaps=[],i;for(i=1;i<t.length;i++)gaps.push(t[i]-t[i-1]);
    txt='Gaps: '+gaps.join(', ');
    var rat=t[0]!==0&&t.every(function(x,j){return j===0||(t[j-1]!==0&&x%t[j-1]===0)})&&t.slice(1).every(function(x,j){return x/t[j]===t[1]/t[0]});
    if(rat)txt+=' (each term is x'+(t[1]/t[0])+' the last)';
  }else{
    var a=q.answer;
    txt='Starts with '+a.charAt(0)+', '+a.length+(q.kind==='num'?' digit':' letter')+(a.length===1?'':'s');
  }
  q.hinted=true;g.hints--;g.hintsUsed++;
  var h=$('hintTxt');h.textContent=txt;h.hidden=false;updHints();
}
/* ---------- surprise events ---------- */
function queueEvent(){
  var run=g,k=g.chaos.pick(['double','double','time','hard']);
  g.nextEvt=g.clock+16+g.chaos.int(0,8);
  var base={kind:'event',kicker:'Surprise'};
  if(k==='double')g.pending.push(Object.assign({title:'Double points',sub:'for the next 10 seconds',chip:'2× score',act:function(){run.doubleUntil=run.clock+10}},base));
  else if(k==='time')g.pending.push(Object.assign({title:'Bonus time',sub:'added to the clock',chip:'+3 seconds',act:function(){run.left+=3}},base));
  else g.pending.push(Object.assign({title:'Hard round',sub:'the next 3 questions',chip:'1.5× score',act:function(){run.hardLeft=3}},base));
}
function updEvt(){
  var e=$('evt'),on=g.clock<g.doubleUntil,hard=!on&&g.hardLeft>0;
  e.hidden=!(on||hard);
  if(on){$('evtLbl').textContent='Double points';$('evtTxt').textContent=Math.ceil(g.doubleUntil-g.clock)+'s';$('evtFill').style.width=((g.doubleUntil-g.clock)/10*100)+'%'}
  else if(hard){$('evtLbl').textContent='Hard round';$('evtTxt').textContent=g.hardLeft+' left';$('evtFill').style.width=(g.hardLeft/3*100)+'%'}
}
function tick(now){
  if(!g||g.done)return;
  var dt=(now-g.last)/1000;
  if(!g.paused&&!g.menu){
    g.left-=dt;g.clock+=dt;
    if(g.clock>=g.nextEvt&&g.pending.length<2)queueEvent();
    updEvt();
  }
  g.last=now;
  var l=Math.max(0,g.left),sec=Math.ceil(l);
  $('time').textContent=sec;$('railFill').style.width=(l/RUN*100)+'%';$('rail').classList.toggle('low',l<=10);$('rail').dataset.zone=l<=10?'low':l<=RUN*.4?'mid':'good';
  if(sec!==g.lastSec&&!g.menu){g.lastSec=sec;Juice.lowTime(sec,{timeEl:$('time'),railEl:$('rail')})}
  if(g.left<=0)return finish();
  raf=requestAnimationFrame(tick);
}
function finish(){
  g.done=true;cancelAnimationFrame(raf);Juice.dismissSlide();Juice.lowOff({railEl:$('rail')});$('evt').hidden=true;Juice.heat(stage,0);
  var focus=g.mode==='focus',total=g.ok+g.bad,acc=total?Math.round(g.ok/total*100):0;
  var gain=Math.round(g.score/10),lvBefore=lvlOf(db.xp),prevBest=db.best,goalChips=[];
  var oldPct=(db.xp-xpFor(lvBefore))/(xpFor(lvBefore+1)-xpFor(lvBefore));
  KEYS.forEach(function(k){db.stats[k].ok+=g.per[k].ok;db.stats[k].bad+=g.per[k].bad});
  db.runs++;
  var nb=!focus&&g.score>db.best&&g.score>0;if(nb)db.best=g.score;
  var got=[];
  BADGES.forEach(function(b){if(!db.badges[b.id]&&b.t(g)){db.badges[b.id]=today();got.push(b.n)}});
  if(g.mode==='daily'){
    if(!db.dailyDone[today()]||db.dailyDone[today()]<g.score)db.dailyDone[today()]=g.score;
    bumpStreak();
  }
  if(!focus){
    if(db.goals.date!==today())db.goals={date:today(),done:{}};
    dailyGoals().forEach(function(x){if(!db.goals.done[x.id]&&x.f(g)){db.goals.done[x.id]=1;gain+=GOAL_XP;goalChips.push('Goal done: '+x.t+' (+'+GOAL_XP+' XP)')}});
  }
  var xpBefore=db.xp;db.xp+=gain;
  var lvAfter=lvlOf(db.xp),newPct=(db.xp-xpFor(lvAfter))/(xpFor(lvAfter+1)-xpFor(lvAfter));
  save();
  $('rMode').textContent=focus?'Training: '+TYPES[g.focus].n:(g.mode==='daily'?'Daily run '+today():'Run complete');
  $('rScore').textContent=Juice.enabled?'0':g.score;
  var weak=null,wa=101;
  KEYS.forEach(function(k){var p=g.per[k],n=p.ok+p.bad;if(n>=2){var a=p.ok/n*100;if(a<wa){wa=a;weak=k}}});
  $('rLine').textContent=g.ok+' right, '+g.bad+' missed ('+acc+'% accuracy). Longest streak '+g.bestStreak+'.'+(weak&&wa<100?' Weakest this run: '+TYPES[weak].n+' ('+Math.round(wa)+'%).':'');
  $('rBest').textContent=focus?'':(nb?(prevBest?'New personal best, '+(g.score-prevBest)+' over your old best of '+prevBest+'.':'First score on the board.'):prevBest>g.score?(prevBest-g.score)+' points short of your best ('+prevBest+').':'');
  $('rStamp').hidden=!nb;
  $('rLvl').textContent='Level '+lvBefore+' · '+rankName(lvBefore);$('rXp').textContent=xpBefore+' XP';
  var xb=$('rXpBar');xb.style.transition='none';xb.style.width=Math.round(oldPct*100)+'%';
  $('rTypes').innerHTML=KEYS.map(function(k,i){var p=g.per[k],n=p.ok+p.bad,pc=n?Math.round(p.ok/n*100):0;
    return '<div class="row" style="--c:'+TYPES[k].c+';--i:'+i+'"><span style="color:'+TYPES[k].c+';display:flex;gap:6px;align-items:center">'+ico(k)+TYPES[k].n+'</span><div class="bar"><i style="width:'+(Juice.enabled?0:pc)+'%" data-w="'+pc+'"></i></div><span>'+p.ok+'/'+n+'</span></div>'}).join('');
  var chips=['+'+gain+' XP'];
  if(g.bestWpm)chips.push('Fastest typing '+g.bestWpm+' WPM');
  if(g.mode==='daily')chips.push('Daily streak: '+streakNow()+' day'+(streakNow()===1?'':'s'));
  if(lvAfter>lvBefore)chips.push('Level '+lvAfter+' reached');
  got.forEach(function(n){chips.push('Badge: '+n)});
  goalChips.forEach(function(c){chips.push(c)});
  $('rEarn').innerHTML=chips.map(function(c,i){return '<span class="chip'+(Juice.enabled?' jx-in':'')+'" style="--i:'+(i+4)+'">'+esc(c)+'</span>'}).join('');
  $('rReview').innerHTML=g.log.map(function(x,i){
    var res=x.ok?'<span style="color:var(--good)">Correct: <b class="mono">'+esc(x.answer)+'</b></span>':'<span style="color:var(--bad)">'+(x.skipped?'Skipped':'You: <b class="mono">'+esc(x.given)+'</b>')+'</span> <span>Answer: <b class="mono">'+esc(x.answer)+'</b></span>';
    return '<li class="rv '+(x.ok?'ok':'no')+'" style="--c:'+TYPES[x.type].c+'"><span class="mono n">'+(i+1)+'</span><div><div class="q">'+esc(x.ask)+(x.shown?' <span class="mono">'+esc(x.shown)+'</span>':'')+'</div><div class="a">'+res+(x.hinted?' <span class="note">hint used</span>':'')+'</div></div></li>'}).join('')||'<li class="note">No answers this run.</li>';
  $('nameIn').value=db.name||'';$('saveCard').hidden=focus||g.score<=0;$('saveStatus').textContent='';
  show('result');Juice.end({newBest:nb});
  Juice.countUp($('rScore'),0,g.score,1300,function(){document.querySelectorAll('#rTypes i').forEach(function(i){i.style.width=i.dataset.w+'%'})});
  if(!Juice.enabled)document.querySelectorAll('#rTypes i').forEach(function(i){i.style.width=i.dataset.w+'%'});
  var run=g;
  setTimeout(function(){
    if(g!==run)return;
    if(lvAfter>lvBefore){
      xb.style.transition='';xb.style.width='100%';
      setTimeout(function(){
        if(g!==run)return;
        $('rLvl').textContent='Level '+lvAfter+' · '+rankName(lvAfter);$('rXp').textContent=db.xp+' XP';
        xb.style.transition='none';xb.style.width='0%';void xb.offsetWidth;xb.style.transition='';xb.style.width=Math.round(newPct*100)+'%';
        var unl=SKINS.concat(PACKS).filter(function(x){return x.lv>lvBefore&&x.lv<=lvAfter&&x.lv>1}).map(function(x){return x.n});
        Juice.levelUp({level:lvAfter,rank:rankName(lvAfter),unlocked:unl});
        syncOpts();
      },Juice.enabled?950:0);
    }else{xb.style.transition='';xb.style.width=Math.round(newPct*100)+'%';$('rXp').textContent=db.xp+' XP';$('rLvl').textContent='Level '+lvAfter+' · '+rankName(lvAfter)}
  },Juice.enabled?600:0);
}

/* ---------- controls ---------- */
var slideGuard=0;
function doSkip(){
  if(!g||g.locked||g.done||g.menu||$('game').hidden)return;
  var q=g.q,run=g;g.locked=true;logAnswer(q,'',false,true);loseStreak(q.type);updHud();
  setTimeout(function(){if(g===run&&!g.done)nextQ()},320);
}
function quitRun(){if(g){g.done=true;cancelAnimationFrame(raf)}Juice.dismissSlide();Juice.lowOff({railEl:$('rail')});$('evt').hidden=true;Juice.heat(stage,0);renderStart();show('start')}
function restartRun(){if(g&&!g.done)startRun(g.mode,g.focus)}
$('play').addEventListener('click',function(){startRun('play')});
$('daily').addEventListener('click',function(){startRun('daily')});
$('again').addEventListener('click',function(){startRun(g.mode,g.focus)});
$('home').addEventListener('click',function(){Juice.unlock();renderStart();show('start')});
$('ratings').addEventListener('click',function(e){var b=e.target.closest('[data-train]');if(b)startRun('focus',b.dataset.train)});
$('skip').addEventListener('click',doSkip);
$('hint').addEventListener('click',function(){useHint();var a=$('ans');if(a)a.focus({preventScroll:true})});
$('quit').addEventListener('click',quitRun);
$('restart').addEventListener('click',restartRun);
$('openOpts').addEventListener('click',openSheet);
$('closeOpts').addEventListener('click',closeSheet);
$('sheet').addEventListener('click',function(e){if(e.target===$('sheet'))closeSheet()});
document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){boardTab=b.dataset.b;renderBoard()})});
$('nameForm').addEventListener('submit',function(e){
  e.preventDefault();if(!g||g.saved)return;
  var name=$('nameIn').value.trim().slice(0,14)||'Anon';db.name=name;g.saved=true;
  var entry={name:name,score:g.score,date:today(),mode:g.mode};
  db.board.push(entry);
  db.board.sort(function(a,b){return b.score-a.score});db.board=db.board.slice(0,50);save();
  $('nameForm').querySelector('button').disabled=true;
  if(window.Board&&Board.enabled){
    $('saveStatus').textContent='Saving to the online board…';
    Board.submit({playerId:db.playerId,name:name,score:g.score,mode:g.mode,day:today(),ok:g.ok,bad:g.bad,streak:g.bestStreak})
      .then(function(){$('saveStatus').textContent='Saved to the online board.'})
      .catch(function(){$('saveStatus').textContent='Could not reach the online board. Your score is saved on this device.'});
  }else $('saveStatus').textContent='Saved on this device.';
  setTimeout(function(){$('saveCard').hidden=true;$('nameForm').querySelector('button').disabled=false},2200);
});
$('copy').addEventListener('click',function(){
  var txt='I scored '+g.score+' on Switch ('+g.ok+' right, streak '+g.bestStreak+')'+(g.mode==='daily'?' - daily run '+today():'')+'. Can you beat it?';
  var b=$('copy');
  var done=function(){b.textContent='Copied'};
  try{navigator.clipboard.writeText(txt).then(done,function(){b.textContent=txt})}catch(e){b.textContent=txt}
});
document.addEventListener('keydown',function(e){
  /* keys: Enter skip, Tab hint, Ctrl+Enter restart run, Esc quit run, 1-4 choices. Enter also ends a slide. */
  if(!$('sheet').hidden){if(e.key==='Escape')closeSheet();return}
  if(!$('result').hidden){
    var tg=document.activeElement&&document.activeElement.tagName;
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&tg!=='INPUT'&&((e.key==='Enter'&&tg!=='BUTTON')||e.key.toLowerCase()==='r')){e.preventDefault();startRun(g.mode,g.focus)}
    return;
  }
  if(!g||g.done||$('game').hidden||e.altKey||e.metaKey)return;
  if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();if(!e.repeat)restartRun();return}
  if(e.ctrlKey)return;
  if(e.key==='Escape'){e.preventDefault();quitRun();return}
  if(e.key==='Tab'){e.preventDefault();useHint();return}
  if(e.key==='Enter'){
    e.preventDefault();
    if(Juice.slideOpen()){Juice.dismissSlide();slideGuard=performance.now();return}
    if(performance.now()-slideGuard<350||e.repeat)return;
    doSkip();return;
  }
  var q=g.q;if(!q||g.locked)return;
  if(q.kind==='choice'){
    var i=parseInt(e.key,10);
    if(i>=1&&i<=q.choices.length){e.preventDefault();if(!(q.removed&&q.removed[q.choices[i-1]]))submit(q.choices[i-1],$('inputZone').querySelectorAll('.choice')[i-1])}
  }else{var a2=$('ans');if(a2&&document.activeElement!==a2)a2.focus()}
});
window.__switch={GEN:GEN,rngFrom:rngFrom,isRight:isRight,state:function(){return g}};
$('optsBody').innerHTML=optsHtml();$('sheetBody').innerHTML=optsHtml();
renderStart();
})();
