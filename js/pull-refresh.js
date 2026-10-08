/* pull-refresh.js (Oct 8 2026) - shared by VillageMan, CashMan, ChangChi.
   Pull down from the top of the page = refresh: unsent edits are sent to the Sheet first, then the page
   reloads (fresh files) and pulls the latest data from the Sheet. Touch screens only; PC is unaffected. */
(function(){
 if(window.__ptrInstalled) return; window.__ptrInstalled=true;
 var THRESH=75, MAX=120, ind=null, startY=0, pulling=false, dist=0, busy=false;
 var DIRTY=['community_manager_v1_dirty','cashflow_sheet_dirty','cc_sheet_dirty'];
 function isDirty(){ try{ return DIRTY.some(function(k){ return localStorage.getItem(k)==='1'; }); }catch(e){ return false; } }
 function syncNow(){ try{ if(window.CM_REPO&&CM_REPO.syncNow) CM_REPO.syncNow(); }catch(e){} try{ if(window.cmSheetSyncNow) cmSheetSyncNow(); }catch(e){} try{ if(window.ccSheetSyncNow) ccSheetSyncNow(); }catch(e){} }
 function reload(){ try{ var b=location.href.split('#')[0].replace(/[?&]r=\d+/,''); location.replace(b+(b.indexOf('?')>=0?'&':'?')+'r='+Date.now()+(location.hash||'')); }catch(e){ location.reload(); } }
 function el(){
  if(ind) return ind;
  ind=document.createElement('div');
  ind.style.cssText='position:fixed;top:0;left:0;right:0;height:0;overflow:hidden;z-index:100000;display:flex;align-items:center;justify-content:center;gap:8px;'
   +'background:rgba(37,99,235,.95);color:#fff;font:600 13px system-ui,sans-serif;opacity:0;padding-top:env(safe-area-inset-top);transition:opacity .1s';
  ind.innerHTML='<span class="ptr2-s" style="display:inline-block;font-size:18px">\u21bb</span><span class="ptr2-t"></span>';
  document.body.appendChild(ind); return ind;
 }
 function show(d,txt){ var i=el(); i.style.height=Math.min(d,MAX)+'px'; i.style.opacity=Math.min(1,d/THRESH); i.querySelector('.ptr2-t').textContent=txt; i.querySelector('.ptr2-s').style.transform='rotate('+(d*2.6)+'deg)'; }
 function hide(){ if(ind){ ind.style.height='0px'; ind.style.opacity='0'; } }
 function atTop(t){
  if((window.scrollY||document.documentElement.scrollTop||0)>0) return false;
  for(var n=t; n && n!==document.body && n.nodeType===1; n=n.parentNode){
   if(n.scrollTop>0) return false;                                  // inside a scrolled box (table, popup)
   var id=n.id||''; if(/pop|-ov$|modal/i.test(id) || (n.classList&&n.classList.contains('modal'))) return false;  // popups
  }
  return true;
 }
 function onStart(e){ if(busy||e.touches.length!==1||!atTop(e.target)){ pulling=false; return; } startY=e.touches[0].clientY; pulling=true; dist=0; }
 function onMove(e){
  if(!pulling) return;
  dist=e.touches[0].clientY-startY;
  if(dist<=0){ hide(); return; }
  if(dist>8 && e.cancelable) e.preventDefault();
  show(dist, dist>=THRESH?'\u0e1b\u0e25\u0e48\u0e2d\u0e22\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a':'\u0e14\u0e36\u0e07\u0e25\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a');
 }
 function onEnd(){
  if(!pulling) return; pulling=false;
  if(dist<THRESH){ hide(); dist=0; return; }
  busy=true; dist=0;
  if(!isDirty()){ show(46,'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u2026'); setTimeout(reload,200); return; }
  // unsent edits: send them first (max 25s), then reload
  show(46,'\u2191 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e48\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e41\u0e01\u0e49\u0e44\u0e27\u0e49\u2026'); syncNow();
  var t0=Date.now(), iv=setInterval(function(){
   if(!isDirty()||Date.now()-t0>25000){ clearInterval(iv); show(46,'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u2026'); setTimeout(reload,200); }
  },500);
 }
 function init(){
  document.addEventListener('touchstart',onStart,{passive:true});
  document.addEventListener('touchmove',onMove,{passive:false});
  document.addEventListener('touchend',onEnd,{passive:true});
  document.addEventListener('touchcancel',function(){ pulling=false; hide(); },{passive:true});
 }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
 window.__ptrTest={start:onStart,move:onMove,end:onEnd,isDirty:isDirty};
})();
