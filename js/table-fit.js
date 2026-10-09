/* table-fit.js (Oct 8 2026) - shared by VillageMan, CashMan, ChangChi.
   Every <table> wider than its card scrolls sideways INSIDE the card instead of spilling out of the frame.
   Works for tables drawn later too (watches the page). Tables already in a scroll box are left alone. */
(function(){
 if(window.__tableFit) return; window.__tableFit=true;
 var st=document.createElement('style');
 st.textContent='.tbl-fit{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;overscroll-behavior-x:contain}'
  +'.tbl-fit>table{margin:0}'
  +'.card,.tab-content,.main,.content{min-width:0;max-width:100%}';
 (document.head||document.documentElement).appendChild(st);
 function scrollsX(el){ var s=el.style&&el.style.overflowX||''; if(/auto|scroll/.test(s)) return true;
   try{ var c=getComputedStyle(el); return /auto|scroll/.test(c.overflowX); }catch(e){ return false; } }
 function wrapped(t){
   for(var p=t.parentNode,i=0; p&&p.nodeType===1&&i<3; p=p.parentNode,i++){ if(p.classList&&p.classList.contains('tbl-fit')) return true; if(scrollsX(p)) return true; }
   return false;
 }
 function fit(root){
   var list=(root&&root.querySelectorAll)?root.querySelectorAll('table'):[];
   for(var i=0;i<list.length;i++){
     var t=list[i]; if(t.__fit||wrapped(t)){ t.__fit=true; continue; }
     var w=document.createElement('div'); w.className='tbl-fit';
     t.parentNode.insertBefore(w,t); w.appendChild(t); t.__fit=true;
   }
 }

 /* Floating horizontal scrollbar (Oct 9 2026, PC/mouse only): when a wide table's own scrollbar is below the
    bottom of the window, show a scrollbar pinned to the bottom of the window that scrolls that table. */
 function floatBar(){
   if(!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches)) return;   // phones: swipe instead
   var bar=document.createElement('div'); bar.id='tblFloatX';
   bar.style.cssText='position:fixed;bottom:0;height:17px;overflow-x:auto;overflow-y:hidden;z-index:9998;display:none;background:rgba(127,127,127,.12);border-top:1px solid rgba(127,127,127,.25)';
   var inner=document.createElement('div'); inner.style.height='1px'; bar.appendChild(inner); document.body.appendChild(bar);
   var cur=null, lock=false;
   function pick(){
     var vh=window.innerHeight, list=document.querySelectorAll('.tbl-fit, div[style*="overflow-x:auto"], div[style*="overflow-x: auto"]'), best=null;
     for(var i=0;i<list.length;i++){ var b=list[i];
       if(b.scrollWidth<=b.clientWidth+2) continue;
       var r=b.getBoundingClientRect(); if(!r.width) continue;
       if(r.top<vh-40 && r.bottom>vh+2){ best=b; break; } }          // table on screen, its own scrollbar off-screen
     return best;
   }
   function update(){
     var b=pick(); cur=b;
     if(!b){ bar.style.display='none'; return; }
     var r=b.getBoundingClientRect(), left=Math.max(0,r.left);
     bar.style.left=left+'px'; bar.style.width=Math.max(0,Math.min(r.right,window.innerWidth)-left)+'px';
     inner.style.width=b.scrollWidth+'px'; bar.style.display='block';
     lock=true; bar.scrollLeft=b.scrollLeft; lock=false;
   }
   bar.addEventListener('scroll',function(){ if(lock||!cur) return; cur.scrollLeft=bar.scrollLeft; });
   document.addEventListener('scroll',function(e){ if(e.target===bar) return; update(); },true);   // page OR table scrolled
   window.addEventListener('resize',update);
   window.__tableFitFloat=update;
   setTimeout(update,300);
 }
 var pending=false;
 function run(){ pending=false; fit(document.body); if(window.__tableFitFloat) window.__tableFitFloat(); }
 function init(){
   floatBar();
   run();
   try{ new MutationObserver(function(){ if(!pending){ pending=true; (window.requestAnimationFrame||setTimeout)(run); } }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
 }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
 window.__tableFitRun=fit;
})();
