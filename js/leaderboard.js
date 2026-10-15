/* Online leaderboard via Supabase RPC. Stays disabled (game uses local scores) until config.js has a URL and key. */
(function(){
'use strict';
var C=window.SWITCH_CONFIG||{};
var on=!!(C.supabaseUrl&&C.supabaseKey);
function rpc(name,body){
  return fetch(C.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:C.supabaseKey,Authorization:'Bearer '+C.supabaseKey},
    body:JSON.stringify(body)
  }).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text().then(function(t){return t?JSON.parse(t):null})});
}
window.Board={
  enabled:on,
  submit:function(s){
    return rpc('submit_score',{p_player:s.playerId,p_name:s.name,p_score:s.score,p_mode:s.mode,p_day:s.day,p_correct:s.ok,p_missed:s.bad,p_streak:s.streak});
  },
  top:function(scope,day){
    return rpc('leaderboard',{p_scope:scope,p_day:day,p_limit:10});
  }
};
})();
