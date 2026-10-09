/* Hub/shared/login.js (Oct 9 2026) - ONE login for VillageMan, CashMan, ChangChi.
   Each app has a thin login.html that loads this file (../Hub/shared/login.js), so the page stays inside
   the app (important for iPhone Home-Screen apps). Edit login behaviour HERE only. */
(function(){
 var st=document.createElement("style"); st.textContent="body{font:16px system-ui,\"Segoe UI\",Tahoma,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#1f2937}\n.card{border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:14px 0}\ninput{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px}\nbutton{width:100%;padding:12px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-size:16px;margin-top:10px;cursor:pointer}\nbutton.sec{background:#fff;color:#334155;border:1px solid #cbd5e1}.ok{color:#15803d}.bad{color:#b91c1c}\na.app{display:block;text-align:center;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:8px;text-decoration:none;color:#1e3a8a;font-weight:600}"; document.head.appendChild(st);
 if(!document.getElementById("box")){
  document.body.insertAdjacentHTML("afterbegin","<h2>\ud83d\udd10 Login</h2><div style=\"color:#64748b;font-size:14px\">\u0e43\u0e0a\u0e49 password \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e17\u0e31\u0e49\u0e07 VillageMan, CashMan \u0e41\u0e25\u0e30 ChangChi</div><div class=\"card\" id=\"box\"></div>");
 }
})();

var APPS=[{name:'VillageMan',key:'vm_sheet_cfg',endpoint:'https://script.google.com/macros/s/AKfycbyvisOSzAf_9VZJFhdKgqo0rKuazq0T33XhDb0x3HJSEoB2uE8z07irgxsUB_DeRMYN/exec',url:'../VillageMan/index.html'},
          {name:'CashMan',key:'cm_sheet_cfg',endpoint:'https://script.google.com/macros/s/AKfycbzx_ZUG_kxger7LnFnmV-kCUJUkcGv0lQgH6yi1Ssz2SoFJcPxIpUiPJr_qPFUf6xf3/exec',url:'../CashMan/index.html'},
          {name:'ChangChi',key:'cc_sheet_cfg',endpoint:'https://script.google.com/macros/s/AKfycbzbm7ZIyK68HfM9uWFXnx1FusCC6X9QaULAZIM_jVz9nf3C35j_JoQXtVQcNIT7pZXV/exec',url:'../ChangChi/index.html'}];
function cfg(a){ try{ return JSON.parse(localStorage.getItem(a.key)||'null'); }catch(e){ return null; } }
function post(a,body){ return fetch(a.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(function(r){return r.json();}); }
function links(){ return APPS.map(function(a){ return '<a class="app" href="'+a.url+'">เปิด '+a.name+' →</a>'; }).join(''); }
function render(msg){
  var live=APPS.filter(function(a){ return a.endpoint.indexOf('https://')===0; });
  var done=live.filter(function(a){ var c=cfg(a); return c&&c.writeToken; });
  var b=document.getElementById('box');
  if(done.length===live.length){
    b.innerHTML='<div class="ok"><b>✅ Login แล้วใน browser นี้</b></div>'+links()+'<button class="sec" onclick="logout()">Logout (browser นี้)</button>';
  } else {
    b.innerHTML='<input id="pw" type="password" placeholder="Password" autocomplete="current-password" autofocus>'
      +'<button id="go" onclick="login()">Login</button><div id="msg" style="margin-top:10px;font-size:14px"></div>';
    document.getElementById('pw').onkeydown=function(e){ if(e.key==='Enter') login(); };
  }
  if(msg){ var m=document.getElementById('msg'); if(m) m.innerHTML=msg; }
}
function login(){
  var pw=document.getElementById('pw').value; if(!pw) return;
  var go=document.getElementById('go'); go.disabled=true; go.textContent='กำลังตรวจสอบ… (ครั้งแรกอาจ 20–40 วินาที)';
  var apps=APPS.filter(function(a){ return a.endpoint.indexOf('https://')===0; }), i=0, warn=[];
  function next(){
    if(i>=apps.length){ render(warn.length?'<span class="bad">⚠️ '+warn.join('<br>')+'</span>':''); return; }
    var a=apps[i++];
    post(a,{action:'login',password:pw}).then(function(r){
      if(!r||!r.ok) throw new Error((r&&r.error)||'login failed');
      localStorage.setItem(a.key,JSON.stringify({endpoint:a.endpoint,writeToken:r.session,readToken:r.session})); next();
    }).catch(function(e){
      if(i===1){ render('<span class="bad">❌ '+String(e.message||e)+'</span>'); return; }   // first app = password check
      warn.push(a.name+': '+String(e.message||e)); next();
    });
  }
  next();
}
function logout(){
  if(!confirm('Logout ทั้ง VillageMan และ CashMan ใน browser นี้?')) return;
  APPS.forEach(function(a){ var c=cfg(a); if(c&&c.writeToken){ post(a,{action:'logout',token:c.writeToken}).catch(function(){}); } localStorage.removeItem(a.key); });
  render('<span class="ok">Logout แล้ว</span>');
}
render();
