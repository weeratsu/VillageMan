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
 var pending=false;
 function run(){ pending=false; fit(document.body); }
 function init(){
   run();
   try{ new MutationObserver(function(){ if(!pending){ pending=true; (window.requestAnimationFrame||setTimeout)(run); } }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
 }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
 window.__tableFitRun=fit;
})();
