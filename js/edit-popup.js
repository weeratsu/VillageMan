/* edit-popup.js - opens the edit form as a popup on every page (Meters, Readings, Households,
   Vendors, Emergency...). Wraps window.editX functions: after the original fills the form, the
   form card is moved into an overlay. Closes on Save (page re-render), backdrop click or Esc.
   Also makes editable fields white so they don't look read-only. */
(function(){
  var st=document.createElement('style');
  st.textContent='.cm-pop{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);overflow:auto;padding:24px 12px}'
   +'.cm-pop>.card{max-width:1000px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,.35)}'
   +'.inp:not([readonly]):not(:disabled),input.mea-in:not([readonly]):not(:disabled){background-color:var(--bg2)!important;border-color:var(--border2)!important}'
   +'.inp[readonly],.inp:disabled,.mea-in[readonly],.mea-in:disabled{background-color:var(--bg3)!important}';
  document.head.appendChild(st);

  var pop=null, card=null, ph=null, obs=null, cancelFn=null;
  function formCard(){
    var tab=document.querySelector('.tab-content.active')||document.body;
    var cs=tab.querySelectorAll('.card');
    for(var i=0;i<cs.length;i++){
      var c=cs[i];
      if(c.closest('#bl-form-wrap')) continue;
      if(c.querySelector('.btn-primary') && c.querySelectorAll('input:not([type=hidden]),select,textarea').length>=2) return c;
    }
    return null;
  }
  function close(restore){
    if(!pop) return;
    if(obs){ obs.disconnect(); obs=null; }
    if(restore && card && ph && ph.parentNode) ph.parentNode.replaceChild(card,ph);
    else if(ph && ph.parentNode) ph.parentNode.removeChild(ph);
    pop.remove(); pop=null; card=null; ph=null;
  }
  function open(cf){
    close(true);
    var c=formCard(); if(!c) return;
    card=c; ph=document.createElement('div'); c.parentNode.replaceChild(ph,c);
    pop=document.createElement('div'); pop.className='cm-pop'; pop.appendChild(c);
    document.body.appendChild(pop); cancelFn=cf;
    var tab=document.querySelector('.tab-content.active');
    if(tab){ obs=new MutationObserver(function(){ if(!ph||!ph.isConnected) close(false); }); obs.observe(tab,{childList:true,subtree:true}); }
    var f=c.querySelector('input:not([type=hidden]),select'); if(f) try{ f.focus(); }catch(e){}
  }
  function cancel(){ var cf=cancelFn; close(true); if(cf&&typeof window[cf]==='function') window[cf](); }
  document.addEventListener('click',function(e){ if(pop&&e.target===pop) cancel(); });
  document.addEventListener('keydown',function(e){ if(pop&&e.key==='Escape') cancel(); });

  var MAP={editMeter:'',editHousehold:'',editVendor:'clearVendorForm',editEmergency:'clearEmergencyForm',rdEdit:'rdClear'};
  Object.keys(MAP).forEach(function(n){
    var orig=window[n]; if(typeof orig!=='function') return;
    window[n]=function(){
      var r=orig.apply(this,arguments);
      Promise.resolve(r).then(function(){ setTimeout(function(){ open(MAP[n]); },30); });
      return r;
    };
  });
  window.cmClosePopup=function(){ close(true); };
})();
