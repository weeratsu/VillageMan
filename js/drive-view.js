/* drive-view.js (Oct 8 2026) - open receipts / invoices / meter photos on ANY device.
   PC (file://): unchanged, opens the local G:\ file.  Web/phone (https): asks the Sheet script for
   the same file in Google Drive and shows Drive's preview (needs YOUR Google login; nothing is shared). */
(function(){
  if(!/^https?:$/.test(location.protocol)) return;              // PC: keep local viewer
  var orig=window.pubViewMedia; if(typeof orig!=='function') return;
  var BASE='';   // relative paths (meter-photos/...) are published on GitHub -> load normally                                           // for relative paths (meter-photos/...)
  function cfg(){ return window.CM_SHEET_CFG && window.CM_SHEET_CFG.endpoint ? window.CM_SHEET_CFG : null; }
  function localPath(src){
    var s=String(src||'');
    if(/^file:/i.test(s)){ s=s.replace(/^file:\/+/i,''); try{ s=decodeURIComponent(s); }catch(e){} return s; }
    if(/^[A-Za-z]:[\\\/]/.test(s)) return s;
    if(/^(https?:|data:|blob:)/i.test(s)) return null;           // already web-reachable
    if(BASE) return BASE+s.replace(/^\.?\//,'');                 // relative to the app folder
    return null;
  }
  var memo={};
  function ov(html){
    var o=document.getElementById('drive-view-ov');
    if(!o){ o=document.createElement('div'); o.id='drive-view-ov';
      o.style.cssText='position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:12px';
      o.addEventListener('click',function(e){ if(e.target===o) o.style.display='none'; });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape') o.style.display='none'; });
      document.body.appendChild(o); }
    o.innerHTML='<div style="position:relative;width:min(96vw,900px);height:min(88vh,1100px);display:flex;flex-direction:column">'
      +'<button onclick="document.getElementById(\'drive-view-ov\').style.display=\'none\'" style="position:absolute;top:-10px;right:-6px;z-index:2;width:34px;height:34px;border-radius:50%;border:0;background:#fff;color:#111;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.4)">&times;</button>'
      +html+'</div>';
    o.style.display='flex';
  }
  function msg(t){ return '<div style="margin:auto;color:#fff;background:#333;padding:16px 18px;border-radius:10px;font:14px system-ui,sans-serif;max-width:90%;text-align:center">'+t+'</div>'; }
  function show(id){
    ov('<iframe src="https://drive.google.com/file/d/'+encodeURIComponent(id)+'/preview" style="flex:1;width:100%;border:0;background:#fff;border-radius:8px" allow="autoplay"></iframe>'
      +'<div style="text-align:center;margin-top:6px"><a href="https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view" target="_blank" rel="noopener" style="color:#fff;font-size:12px">เปิดใน Google Drive</a></div>');
  }
  window.pubViewMedia=function(src, ev){
    var p=localPath(src), c=cfg();
    if(!p) return orig.apply(this, arguments);                   // web URL -> normal viewer
    if(ev){ if(ev.preventDefault) ev.preventDefault(); if(ev.stopPropagation) ev.stopPropagation(); }
    if(!c){ ov(msg('🔐 Login ก่อน แล้วจะเปิดไฟล์จาก Google Drive ได้<br><br><a href="login.html" style="color:#93c5fd">ไปหน้า Login</a>')); return false; }
    if(memo[p]){ show(memo[p]); return false; }
    ov(msg('↻ กำลังหาไฟล์ใน Google Drive…'));
    fetch(c.endpoint+'?action=file&'+'token='+encodeURIComponent(c.readToken||c.writeToken)+'&path='+encodeURIComponent(p)+'&t='+Date.now())
      .then(function(r){ return r.json(); })
      .then(function(j){ if(j&&j.ok&&j.id){ memo[p]=j.id; show(j.id); } else ov(msg('❌ '+((j&&j.error)||'not found'))); })
      .catch(function(e){ ov(msg('❌ ต่อ Google ไม่ได้: '+e)); });
    return false;
  };
})();
