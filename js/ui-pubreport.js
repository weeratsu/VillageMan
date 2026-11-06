/* VillageMan - Public Common-area Utility Report (resident-facing).
   New standalone page: year summary cards + per-period table + 6-step split calc.
   Read-only transparency view so residents understand how the central share is computed. */
(function(){
var U=window.CM_UTIL;

var _pubYear = new Date().getFullYear();
function setPubYear(y){ _pubYear=parseInt(y,10)||new Date().getFullYear(); renderPubReport(); }
var _pubSort='period';   // sort column for the public report table
var _pubAsc=false;        // false = descending (newest/highest first)
function _pubSortVal(b, col){
  var isSplit=!!b.split_meter;
  if(col==='period') return b.period||'';
  if(col==='meter') return String(b.central_meter_no||b.meter_no||b.installation||'').toLowerCase();
  if(col==='prev') return isSplit?(Number(b.central_prev)||0):(Number(b.prev_reading)||0);
  if(col==='pres') return isSplit?(Number(b.central_present)||0):(Number(b.present_reading)||0);
  if(col==='units') return isSplit?(Number(b.central_units)||0):(Number(b.units_used)||0);
  if(col==='energy') return isSplit?(Number(b.central_energy)||0):(Number(b.energy_charge)||0);
  if(col==='vat') return isSplit?(Number(b.central_vat)||0):(Number(b.vat)||0);
  if(col==='total') return isSplit?(Number(b.central_amount)||0):(Number(b.total_amount)||0);
  if(col==='status') return b.paid?1:0;
  return b.period||'';
}
function setPubSort(col){
  if(_pubSort===col){ _pubAsc=!_pubAsc; } else { _pubSort=col; _pubAsc=true; }
  renderPubReport();
}
function _pubArrow(col){ if(_pubSort!==col) return ''; return _pubAsc?' \u25b2':' \u25bc'; }
/* Self-contained SVG bar chart of monthly common-area COST (THB) for the selected year.
   No CDN. 12 bars Jan..Dec; the month with the highest cost is highlighted. */
function _pubSmooth(p){
  var d='M'+p[0][0].toFixed(1)+','+p[0][1].toFixed(1);
  for(var i=0;i<p.length-1;i++){ var a=p[i-1]||p[i], b=p[i], c=p[i+1], e=p[i+2]||c;
    d+=' C'+(b[0]+(c[0]-a[0])/6).toFixed(1)+','+(b[1]+(c[1]-a[1])/6).toFixed(1)+' '+(c[0]-(e[0]-b[0])/6).toFixed(1)+','+(c[1]-(e[1]-b[1])/6).toFixed(1)+' '+c[0].toFixed(1)+','+c[1].toFixed(1); }
  return d;
}
function _pubMonthlyCostChart(bills){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var vals=[]; for(var i=0;i<12;i++) vals.push(0);
  (bills||[]).forEach(function(b){ var pp=(b.period||'').split('-'); if(pp.length<2) return; var mi=parseInt(pp[1],10)-1; if(mi<0||mi>11) return; vals[mi]+=b.split_meter?(Number(b.central_amount)||0):(Number(b.total_amount)||0); });
  var W=640,H=190,padT=22,padB=24,padL=10,padR=10,n=12,bw=(W-padL-padR)/n,h=H-padT-padB;
  var max=Math.max.apply(null, vals.concat([1]))*1.12;
  var X=function(k){ return padL+k*bw+bw/2; }, Y=function(v){ return H-padB-(v/max)*h; };
  var pts=[]; for(var k=0;k<n;k++){ if(vals[k]>0) pts.push([X(k),Y(vals[k]),vals[k],k]); }
  var out='<defs><linearGradient id="pubArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".28"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>';
  for(var g=0;g<=3;g++){ var gy=padT+h*g/3; out+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+gy.toFixed(1)+'" y2="'+gy.toFixed(1)+'" stroke="var(--border)" stroke-width=".6"/>'; }
  for(var m=0;m<n;m++) out+='<text x="'+X(m).toFixed(1)+'" y="'+(H-padB+14)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+MON[m]+'</text>';
  if(pts.length){
    var avg=pts.reduce(function(s,p){return s+p[2];},0)/pts.length, ay=Y(avg);
    if(pts.length>1){
      var line=_pubSmooth(pts);
      out+='<path d="'+line+' L'+pts[pts.length-1][0].toFixed(1)+','+(H-padB)+' L'+pts[0][0].toFixed(1)+','+(H-padB)+' Z" fill="url(#pubArea)"/>';
      out+='<path d="'+line+'" fill="none" stroke="var(--primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    out+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+ay.toFixed(1)+'" y2="'+ay.toFixed(1)+'" stroke="var(--error)" stroke-width="1.2" stroke-dasharray="5 4"/>';
    out+='<rect x="'+(W-padR-118)+'" y="'+(ay-15).toFixed(1)+'" width="118" height="13" rx="6" fill="var(--error)" opacity=".12"/>';
    out+='<text x="'+(W-padR-6)+'" y="'+(ay-5.5).toFixed(1)+'" text-anchor="end" font-size="8" font-weight="700" fill="var(--error)">\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22 '+U.fmtMoney(avg)+'</text>';
    var mx=pts.reduce(function(a,p){return p[2]>a[2]?p:a;},pts[0]);
    pts.forEach(function(p){
      var top=p===mx;
      out+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(top?4.5:3.5)+'" fill="var(--bg2,#fff)" stroke="'+(top?'var(--error)':'var(--primary)')+'" stroke-width="2"><title>'+MON[p[3]]+': '+U.fmtMoney(p[2])+'</title></circle>';
      out+='<text x="'+p[0].toFixed(1)+'" y="'+(p[1]-8).toFixed(1)+'" text-anchor="middle" font-size="8" font-weight="600" fill="'+(top?'var(--error)':'var(--text2)')+'">'+Math.round(p[2]).toLocaleString('en-US')+'</text>';
    });
  } else {
    out+='<text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="10" fill="var(--text3)">-</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+out+'</svg>';
}
function _calcSteps(b){
  var billTot=Number(b.bill_total)||0;
  var mainUnits=Number(b.units_used)||0;
  var cu=Number(b.central_units)||0;
  var ce=(b.central_energy!=null)?Number(b.central_energy):null;
  var cf=(b.central_ft!=null)?Number(b.central_ft):null;
  var cv=(b.central_vat!=null)?Number(b.central_vat):null;
  var ca=Number(b.central_amount)||0;
  var energyTot=(b.energy_charge!=null)?Number(b.energy_charge):null;
  var ratePerUnit=(energyTot!=null && mainUnits>0)?(energyTot/mainUnits):null;
  var S=function(n,label,val){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0"><span><b>'+n+'.</b> '+label+'</span><span style="white-space:nowrap">'+val+'</span></div>'; };
  var dash='<span class="text-muted">-</span>';
  var h='';
  h+=S(1,'\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e23\u0e27\u0e21 (energy charge) \u00f7 \u0e2b\u0e19\u0e48\u0e27\u0e22\u0e23\u0e27\u0e21', (energyTot!=null?U.fmtMoney(energyTot):dash)+' \u00f7 '+(mainUnits?U.fmtNum(mainUnits):dash));
  h+=S(2,'= \u0e23\u0e32\u0e04\u0e32\u0e15\u0e48\u0e2d\u0e2b\u0e19\u0e48\u0e27\u0e22', (ratePerUnit!=null?U.fmtMoney(ratePerUnit):dash));
  var ftRate=(cf!=null && cu>0)?(cf/cu):null;
  var preVat=((ce!=null?ce:0)+(cf!=null?cf:0));
  h+=S(3,'\u00d7 \u0e2b\u0e19\u0e48\u0e27\u0e22\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 ('+U.fmtNum(cu)+' \u0e2b\u0e19\u0e48\u0e27\u0e22)'+((b._days>0&&cu>0)?' <span style="font-size:10px;color:var(--text3)">&middot; '+b._days+' \u0e27\u0e31\u0e19 &middot; \u0e40\u0e09\u0e25\u0e35\u0e48\u0e22 '+(cu/b._days).toFixed(1)+' \u0e2b\u0e19\u0e48\u0e27\u0e22/\u0e27\u0e31\u0e19</span>':''), (ce!=null?('<span class="text-muted" style="font-size:10px">('+(ratePerUnit!=null?U.fmtMoney(ratePerUnit):dash)+' \u00d7 '+U.fmtNum(cu)+') = </span>'+U.fmtMoney(ce)):dash));
  h+=S(4,'+ Ft (\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07)', (cf!=null?('<span class="text-muted" style="font-size:10px">('+(ftRate!=null?U.fmtRate(ftRate):dash)+' \u00d7 '+U.fmtNum(cu)+') = </span>'+U.fmtMoney(cf)):dash));
  h+=S(5,'+ VAT 7%', (cv!=null?('<span class="text-muted" style="font-size:10px">('+U.fmtMoney(preVat)+' \u00d7 7%) = </span>'+U.fmtMoney(cv)):dash));
  h+=S(6,'<b>= \u0e22\u0e2d\u0e14\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e01\u0e47\u0e1a</b>', '<b>'+U.fmtMoney(ca)+'</b>');
  h+='<div style="font-size:9px;color:var(--text3);margin-top:4px">* \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 (service fee) \u0e44\u0e21\u0e48\u0e23\u0e27\u0e21\u0e43\u0e19\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 \u2014 \u0e40\u0e1b\u0e47\u0e19\u0e04\u0e48\u0e32\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e02\u0e2d\u0e07\u0e1a\u0e49\u0e32\u0e19</div>';
  return h;
}

function _pubCAmt(b){ return b.split_meter?(Number(b.central_amount)||0):(Number(b.total_amount)||0); }
function _pubReimbBadge(b){
  if(!b.paid) return '';
  if(b.reimbursed) return '<div style="margin-top:3px"><span class="badge" style="font-size:9px;background:#dcfce7;color:#166534">\u0e40\u0e1a\u0e34\u0e01\u0e41\u0e25\u0e49\u0e27</span>'+(b.reimbursed_date?'<div style="font-size:8px;color:var(--text3)">'+U.fmtDate(b.reimbursed_date)+'</div>':'')+'</div>';
  return '<div style="margin-top:3px"><span class="badge" style="font-size:9px;background:#ffedd5;color:#9a3412">\u0e04\u0e49\u0e32\u0e07\u0e40\u0e1a\u0e34\u0e01</span></div>';
}
async function pubReimbOpen(){
  var D=await window.CM_REPO.all(), all=(D.utility_bills||[]).filter(function(b){ return !b.home_only && b.paid && _pubCAmt(b)>0; });
  var pend=all.filter(function(b){return !b.reimbursed;}).sort(function(a,b){return a.period<b.period?-1:1;});
  var rounds={}; all.filter(function(b){return b.reimbursed;}).forEach(function(b){ var k=b.reimb_id||('R'+(b.reimbursed_date||'')); (rounds[k]=rounds[k]||{id:k,date:b.reimbursed_date,note:b.reimb_note||'',bills:[]}).bills.push(b); });
  var rl=Object.keys(rounds).map(function(k){return rounds[k];}).sort(function(a,b){return (b.date||'')<(a.date||'')?-1:1;});
  var today=new Date(), iso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  var h='<div id="pub-reimb-ov" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">'
   +'<div style="background:var(--bg,#fff);border-radius:12px;padding:18px 22px;width:480px;max-width:94vw;max-height:88vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:12px">'
   +'<div style="font-weight:700;font-size:15px;margin-bottom:10px"><i class="fa-solid fa-hand-holding-dollar"></i> \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e40\u0e1a\u0e34\u0e01\u0e40\u0e07\u0e34\u0e19\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07</div>'
   +'<div style="color:var(--text3);margin-bottom:6px">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e07\u0e27\u0e14\u0e17\u0e35\u0e48\u0e08\u0e48\u0e32\u0e22\u0e41\u0e25\u0e49\u0e27\u0e41\u0e15\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e1a\u0e34\u0e01</div>';
  if(!pend.length) h+='<div style="padding:8px;color:var(--text3)">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e07\u0e27\u0e14\u0e04\u0e49\u0e32\u0e07\u0e40\u0e1a\u0e34\u0e01</div>';
  else h+='<table style="width:100%;border-collapse:collapse">'+pend.map(function(b){ return '<tr><td style="padding:3px 0"><label style="cursor:pointer"><input type="checkbox" class="pub-rb" checked value="'+b.id+'" data-amt="'+_pubCAmt(b)+'" onchange="pubReimbSum()"> '+U.esc(b.period)+'</label></td><td style="text-align:right">'+U.fmtMoney(_pubCAmt(b))+'</td><td style="text-align:right;color:var(--text3);font-size:10px">'+(b.paid_date?U.fmtDate(b.paid_date):'')+'</td></tr>'; }).join('')+'</table>'
   +'<div style="display:flex;justify-content:space-between;margin:8px 0;font-weight:700"><span>\u0e23\u0e27\u0e21\u0e40\u0e1a\u0e34\u0e01</span><span id="pub-rb-sum"></span></div>'
   +'<div style="display:grid;grid-template-columns:110px 1fr;gap:6px;align-items:center"><span>\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e40\u0e1a\u0e34\u0e01</span><input type="date" id="pub-rb-date" class="inp" value="'+iso+'"><span>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38 / \u0e40\u0e25\u0e02\u0e43\u0e1a\u0e40\u0e1a\u0e34\u0e01</span><input id="pub-rb-note" class="inp"></div>'
   +'<div style="text-align:right;margin-top:10px"><button class="btn" onclick="pubReimbSave()"><i class="fa-solid fa-floppy-disk"></i> \u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e40\u0e1a\u0e34\u0e01</button></div>';
  if(rl.length){ h+='<div style="font-weight:700;margin:14px 0 6px;border-top:1px solid var(--border);padding-top:10px">\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e40\u0e1a\u0e34\u0e01</div>'
   +rl.map(function(r){ var s=r.bills.reduce(function(x,b){return x+_pubCAmt(b);},0); return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border)"><div><b>'+(r.date?U.fmtDate(r.date):'-')+'</b> '+U.fmtMoney(s)+'<div style="font-size:10px;color:var(--text3)">'+r.bills.map(function(b){return b.period;}).sort().join(', ')+(r.note?' &middot; '+U.esc(r.note):'')+'</div></div><button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="pubReimbUndo(\''+U.esc(r.id)+'\')">\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01</button></div>'; }).join(''); }
  h+='</div></div>';
  var w=document.createElement('div'); w.innerHTML=h; document.body.appendChild(w.firstChild); pubReimbSum();
}
function pubReimbSum(){ var s=0,n=0; document.querySelectorAll('.pub-rb').forEach(function(x){ if(x.checked){ s+=Number(x.getAttribute('data-amt'))||0; n++; } }); var el=document.getElementById('pub-rb-sum'); if(el) el.textContent=U.fmtMoney(s)+' ('+n+' \u0e07\u0e27\u0e14)'; }
async function pubReimbSave(){
  var ids=[]; document.querySelectorAll('.pub-rb').forEach(function(x){ if(x.checked) ids.push(x.value); });
  var d=(document.getElementById('pub-rb-date')||{}).value||'', note=(document.getElementById('pub-rb-note')||{}).value||'';
  if(!ids.length||!d){ U.toast('Select periods and a date'); return; }
  var rid='R'+d.replace(/-/g,'')+'-'+Date.now().toString(36);
  for(var i=0;i<ids.length;i++) await window.CM_REPO.update('utility_bills', ids[i], {reimbursed:true, reimbursed_date:d, reimb_id:rid, reimb_note:note});
  var ov=document.getElementById('pub-reimb-ov'); if(ov) ov.remove(); U.toast('Saved: '+ids.length+' \u0e07\u0e27\u0e14'); renderPubReport();
}
async function pubReimbUndo(rid){
  if(!confirm('\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e23\u0e2d\u0e1a\u0e40\u0e1a\u0e34\u0e01\u0e19\u0e35\u0e49?')) return;
  var D=await window.CM_REPO.all(), bs=(D.utility_bills||[]).filter(function(b){ return b.reimbursed && (b.reimb_id||('R'+(b.reimbursed_date||'')))===rid; });
  for(var i=0;i<bs.length;i++) await window.CM_REPO.update('utility_bills', bs[i].id, {reimbursed:false, reimbursed_date:'', reimb_id:'', reimb_note:''});
  var ov=document.getElementById('pub-reimb-ov'); if(ov) ov.remove(); renderPubReport(); pubReimbOpen();
}
async function renderPubReport(){ setTimeout(_vmpLabel,0);
  var el=document.getElementById('tab-pubreport'); if(!el) return;
  var D=await window.CM_REPO.all();
  var bills=(D.utility_bills||[]).filter(function(b){ if(b.home_only) return false; var y=(b.period||'').split('-')[0]; return parseInt(y,10)===_pubYear; });
  var _meterById={}; (D.meters||[]).forEach(function(m){ _meterById[m.id]=m; });
  var _photoBase=(D.meta&&D.meta.meter_photo_base)?D.meta.meter_photo_base:'meter-photos';
  function _meterNo(b){ if(b && b.central_meter_no) return b.central_meter_no; var m=_meterById[b.meter_id]; if(!m) return '-'; return m.installation||m.meter_no||m.ca_no||'-'; }
  function _vmDays(b){ if(!b.central_date||!b.period) return 0; var a=b.period.split('-'), y=+a[0], m=+a[1]-1; if(m<1){m=12;y--;} var pp=y+'-'+(m<10?'0':'')+m; var pb=(D.utility_bills||[]).filter(function(x){return x.meter_id===b.meter_id&&x.period===pp&&x.central_date;})[0]; var s=pb?pb.central_date:''; if(!s){ var idx=window.VM_PHOTO_INDEX||{}, e=idx['electricity/'+pp.split('-')[0]+'/'+_meterNo(b)+'_'+pp], mm=e&&e.file&&String(e.file).match(/_(\d{4}-\d{2}-\d{2})\.[a-z]+$/i); if(mm) s=mm[1]; } if(!s) return 0; var d=Math.round((new Date(b.central_date)-new Date(s))/864e5); return d>0?d:0; }
  // year options from all bills
  var ys={}; (D.utility_bills||[]).forEach(function(b){ var y=(b.period||'').split('-')[0]; if(y) ys[y]=1; }); ys[String(_pubYear)]=1; ys[String(new Date().getFullYear())]=1;
  var yearList=Object.keys(ys).sort(function(a,b){return b-a;});
  var yearOpts=yearList.map(function(y){ return '<option value="'+y+'"'+(parseInt(y,10)===_pubYear?' selected':'')+'>'+y+'</option>'; }).join('');
  // aggregate
  var totCentral=0, totFull=0, totHome=0, nSplit=0, nFlat=0, cUnits=0;
  bills.forEach(function(b){
    if(b.split_meter){ nSplit++; totFull+=Number(b.bill_total)||0; totCentral+=Number(b.central_amount)||0; totHome+=Number(b.home_amount)||0; cUnits+=Number(b.central_units)||0; }
    else { nFlat++; totCentral+=Number(b.total_amount)||0; totFull+=Number(b.total_amount)||0; cUnits+=Number(b.units_used)||0; }
  });
  var months=bills.length; var avg=months?totCentral/months:0;
  var kpi=function(label,val,cls,sub){ return '<div class="kpi"><div class="kpi-label">'+label+'</div><div class="kpi-val '+(cls||'')+'">'+val+'</div>'+(sub?'<div style="font-size:9px;color:var(--text3);margin-top:2px">'+sub+'</div>':'')+'</div>'; };
  // table rows (sorted by period desc)
  var sorted=bills.slice().sort(function(a,b){
    var va=_pubSortVal(a,_pubSort), vb=_pubSortVal(b,_pubSort), r;
    if(typeof va==='number' && typeof vb==='number'){ r=va-vb; } else { r=String(va).localeCompare(String(vb)); }
    if(r===0){ r=(a.period||'').localeCompare(b.period||''); }
    return _pubAsc? r : -r;
  });
  function _catOf(type){ var t=(type||'').toLowerCase(); if(t.indexOf('w')===0||t.indexOf('water')>=0||t.indexOf('\u0e19')>=0) return 'water'; return 'electricity'; }
  function _guessPhotoPath(b){
    // Resolve the meter photo path. The organizer script may append the EXIF shot date to the
    // filename (<meterNo>_<period>_<YYYY-MM-DD>.jpg), so we first look up the REAL filename in
    // window.VM_PHOTO_INDEX (written by organize_meter_photos.py, keyed <cat>/<year>/<meterNo>_<period>).
    // Fall back to the plain period-based path when the index is unavailable.
    var period = b.period || ''; if(!period) return '';
    var meterNo = _meterNo(b); if(!meterNo || meterNo==='-') return '';
    var type = b.utility_type || 'electricity';
    var year=(period.split('-')[0])||'';
    var cat=_catOf(type);
    var idx=window.VM_PHOTO_INDEX;
    if(idx){
      var key=cat+'/'+year+'/'+meterNo+'_'+period;
      if(idx[key] && idx[key].file){ return _photoBase.replace(/\/+$/,'')+'/'+idx[key].file; }
    }
    try {
      var t = U.meterPhotoTarget(type, period, [meterNo, period], 'jpg', _photoBase);
      return t.path;
    } catch(e){ return ''; }
  }
  var rows=sorted.map(function(b){
    var isSplit=!!b.split_meter;
    var typ=(b.utility_type==='water')?'\u0e19\u0e49\u0e33':'\u0e44\u0e1f';
    var central=isSplit?(Number(b.central_amount)||0):(Number(b.total_amount)||0);
    var units=isSplit?(Number(b.central_units)||0):(Number(b.units_used)||0);
    var prev=isSplit?(Number(b.central_prev)||0):(Number(b.prev_reading)||0);
    var pres=isSplit?(Number(b.central_present)||0):(Number(b.present_reading)||0);
    var energy=isSplit?((b.central_energy!=null)?Number(b.central_energy):null):((b.energy_charge!=null)?Number(b.energy_charge):null);
    var vat=isSplit?((b.central_vat!=null)?Number(b.central_vat):null):((b.vat!=null)?Number(b.vat):null);
    var meterNo=U.esc(_meterNo(b));
    var expBtn=isSplit?('<button class="del-btn" title="\u0e14\u0e39\u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14" onclick="pubToggle(\''+b.id+'\')"><i class="fa-solid fa-caret-right" id="pc-'+b.id+'"></i></button> '):'';
    var dash='<span class="text-muted">-</span>';
    var r='<tr>'
      +'<td>'+expBtn+U.esc(b.period||'-')+'</td>'
      +'<td>'+typ+'</td>'
      +'<td>'+meterNo+'</td>'
      +'<td class="r">'+Math.round(prev)+'</td>'
      +'<td class="r">'+Math.round(pres)+'</td>'
      +'<td class="r">'+Math.round(units)+'</td>'
      +'<td class="r">'+(energy!=null?U.fmtMoney(energy):dash)+'</td>'
      +'<td class="r">'+(vat!=null?U.fmtMoney(vat):dash)+'</td>'
      +'<td class="r"><b>'+U.fmtMoney(central)+'</b></td>'
      +'<td class="r">'+(b.paid?'<span class="tag tag-active" style="font-size:9px">\u0e08\u0e48\u0e32\u0e22\u0e41\u0e25\u0e49\u0e27</span>':'<span class="tag tag-planned" style="font-size:9px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e48\u0e32\u0e22</span>')+(b.paid&&b.paid_date?('<div style="font-size:8px;color:var(--text3);margin-top:2px">'+U.fmtDate(b.paid_date)+'</div>'):'')+_pubReimbBadge(b)+'</td>'
      +'<td class="r">'+(function(){
        var src=b.meter_photo_path||_guessPhotoPath(b);
        if(!src) return dash;
        return '<a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(src)+'" title="'+U.esc(src)+'"><i class="fa-solid fa-camera text-primary"></i></a>';
      })()+'</td>'
      // when the probe succeeds we also hide the dash

      +'</tr>';
    if(isSplit){
      r+='<tr class="pub-detail" id="pd-'+b.id+'" style="display:none;background:var(--bg2)"><td colspan="11" style="padding:10px 14px;font-size:11px;line-height:1.6">'
        +'<div style="font-weight:700;margin-bottom:4px"><i class="fa-solid fa-calculator"></i> \u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14\u0e22\u0e2d\u0e14\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 ('+U.esc(b.period||'')+')</div>'
        +'<div style="max-width:460px">'+_calcSteps((b._days=_vmDays(b),b))+'</div>'
        +'<div style="margin-top:6px;font-size:10px;color:var(--text3)">\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e23\u0e27\u0e21\u0e17\u0e31\u0e49\u0e07\u0e1a\u0e34\u0e25 '+U.fmtNum(Number(b.units_used)||0)+' \u2014 \u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 '+U.fmtNum(Number(b.central_units)||0)+' / \u0e1a\u0e49\u0e32\u0e19 '+U.fmtNum(Number(b.home_units)||0)+'</div>'
        +(b.invoice_path?('<div style="margin-top:3px"><a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(b.invoice_path)+'"><i class="fa-solid fa-file-invoice"></i> \u0e43\u0e1a\u0e41\u0e08\u0e49\u0e07\u0e2b\u0e19\u0e35\u0e49 (Invoice)</a></div>'):'')+(b.receipt_path?('<div style="margin-top:3px"><a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(b.receipt_path)+'"><i class="fa-solid fa-receipt"></i> \u0e43\u0e1a\u0e40\u0e2a\u0e23\u0e47\u0e08 (Receipt)</a></div>'):'')+'</td></tr>';
    }
    return r;
  }).join('');

  var tbl = sorted.length ? ('<table class="tbl"><thead><tr>'
    +'<th style="cursor:pointer" onclick="setPubSort(\'period\')">\u0e07\u0e27\u0e14'+_pubArrow('period')+'</th>'+'<th>\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17</th>'+'<th style="cursor:pointer" onclick="setPubSort(\'meter\')">\u0e40\u0e25\u0e02\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c'+_pubArrow('meter')+'</th>'
    +'<th class="r" style="cursor:pointer" onclick="setPubSort(\'prev\')">\u0e40\u0e25\u0e02\u0e40\u0e01\u0e48\u0e32'+_pubArrow('prev')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'pres\')">\u0e40\u0e25\u0e02\u0e43\u0e2b\u0e21\u0e48'+_pubArrow('pres')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'units\')">\u0e2b\u0e19\u0e48\u0e27\u0e22'+_pubArrow('units')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'energy\')">\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19'+_pubArrow('energy')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'vat\')">VAT'+_pubArrow('vat')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'total\')">\u0e23\u0e27\u0e21(\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07)'+_pubArrow('total')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'status\')">\u0e2a\u0e16\u0e32\u0e19\u0e30'+_pubArrow('status')+'</th>'+'<th class="r">\u0e23\u0e39\u0e1b</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>')
    : '<p class="text-muted" style="padding:10px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e34\u0e25\u0e43\u0e19\u0e1b\u0e35\u0e19\u0e35\u0e49</p>';

  el.innerHTML = '<div class="card">'
    +'<h2><i class="fa-solid fa-users"></i> \u0e2a\u0e23\u0e38\u0e1b\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 (\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e25\u0e39\u0e01\u0e1a\u0e49\u0e32\u0e19)</h2>'
    +'<p class="text-muted" style="font-size:12px;margin:-4px 0 10px">\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e02\u0e2d\u0e07\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19 \u0e27\u0e48\u0e32\u0e41\u0e15\u0e48\u0e25\u0e30\u0e07\u0e27\u0e14\u0e04\u0e34\u0e14\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e44\u0e23 \u0e23\u0e27\u0e21\u0e40\u0e17\u0e48\u0e32\u0e44\u0e23</p>'
    +'<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><label class="text-muted" style="font-size:12px">\u0e1b\u0e35:</label><select class="inp" style="max-width:120px" onchange="setPubYear(this.value)">'+yearOpts+'</select>'+'<button class="btn btn-ghost" style="margin-left:8px;font-size:11px;padding:4px 10px" onclick="exportPublicData()" title="Export bills+meters as villageman_data.js for the public GitHub Pages site"><i class="fa-solid fa-cloud-arrow-up"></i> Export for web</button>'+'<button class="btn btn-ghost" style="margin-left:4px;font-size:11px;padding:4px 10px" onclick="pubReimbOpen()"><i class="fa-solid fa-hand-holding-dollar"></i> \u0e40\u0e1a\u0e34\u0e01\u0e40\u0e07\u0e34\u0e19</button>'+'<button class="btn btn-ghost" style="margin-left:4px;font-size:11px;padding:4px 10px" onclick="pubSetupFolder()" title="Choose the VillageManPublic folder once"><i class="fa-solid fa-folder-open"></i> <span id="pub-fold-lbl">Set VMP folder</span></button></div>'+'<div class="card" style="background:var(--bg2);margin-bottom:12px">'+'<h3 style="font-size:12px;margin:0 0 6px"><i class="fa-solid fa-chart-column"></i> \u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 ('+_pubYear+')</h3>'+_pubMonthlyCostChart(bills)+'</div>'
    +'<div class="kpi-grid">'
      +kpi('\u0e23\u0e27\u0e21\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e17\u0e31\u0e49\u0e07\u0e1b\u0e35', U.fmtMoney(totCentral), 'text-error', months+' \u0e07\u0e27\u0e14')
      +kpi('\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22\u0e15\u0e48\u0e2d\u0e40\u0e14\u0e37\u0e2d\u0e19', U.fmtMoney(avg), '', '')
      +kpi('\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e23\u0e27\u0e21', Math.round(cUnits), '', '')
      +(function(){ var pb=(D.utility_bills||[]).filter(function(b){return !b.home_only&&b.paid&&!b.reimbursed&&_pubCAmt(b)>0;}); var s=pb.reduce(function(x,b){return x+_pubCAmt(b);},0); return kpi('\u0e22\u0e2d\u0e14\u0e04\u0e49\u0e32\u0e07\u0e40\u0e1a\u0e34\u0e01', U.fmtMoney(s), s>0?'text-warning':'', pb.length+' \u0e07\u0e27\u0e14 (all years)'); })()
    +'</div>'
    +tbl
    +'</div>';
}

function pubToggle(id){
  var row=document.getElementById('pd-'+id); var ic=document.getElementById('pc-'+id);
  if(!row) return;
  var open=row.style.display!=='none';
  row.style.display=open?'none':'';
  if(ic) ic.className='fa-solid '+(open?'fa-caret-right':'fa-caret-down');
}

/* Floating lightbox for meter photos / invoice / receipt. Images show inline;
   PDFs (invoice/receipt) show in an iframe. Click backdrop or X to close. */
function pubViewMedia(src, ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  if(!src) return;
  var isPdf=/\.pdf(\?|$)/i.test(src);
  var ov=document.getElementById('pub-media-ov');
  if(!ov){
    ov=document.createElement('div'); ov.id='pub-media-ov';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:24px';
    ov.addEventListener('click',function(e){ if(e.target===ov) pubCloseMedia(); });
    document.body.appendChild(ov);
  }
  var inner=isPdf
    ? '<iframe src="'+U.esc(src)+'" style="width:88vw;height:88vh;border:0;background:#fff;border-radius:8px"></iframe>'
    : '<img src="'+U.esc(src)+'" style="max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.5)" onerror="this.outerHTML=\'<div style=&quot;color:#fff;padding:20px;background:#333;border-radius:8px&quot;>\\u0e40\\u0e1b\\u0e34\\u0e14\\u0e44\\u0e1f\\u0e25\\u0e4c\\u0e44\\u0e21\\u0e48\\u0e44\\u0e14\\u0e49 - \\u0e15\\u0e23\\u0e27\\u0e08\\u0e27\\u0e48\\u0e32\\u0e21\\u0e35\\u0e44\\u0e1f\\u0e25\\u0e4c\\u0e17\\u0e35\\u0e48 path \\u0e19\\u0e35\\u0e49\\u0e2b\\u0e23\\u0e37\\u0e2d\\u0e22\\u0e31\\u0e07</div>\'">';
  ov.innerHTML='<div style="position:relative">'
    + '<button onclick="pubCloseMedia()" style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:0;background:#fff;color:#111;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)">&times;</button>'
    + inner
    + '<div id="pub-media-exif" style="margin-top:8px;text-align:center;color:#fff;font-size:11px;opacity:.9;min-height:14px"></div>'
    + '<div style="margin-top:4px;text-align:center"><a href="'+U.esc(src)+'" target="_blank" style="color:#fff;font-size:11px;opacity:.85">\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e19\u0e41\u0e17\u0e47\u0e1a\u0e43\u0e2b\u0e21\u0e48</a></div>'
    + '</div>';
  ov.style.display='flex';
  if(!isPdf){
    var fnDate=_dateFromName(src);
    if(fnDate){ var el=document.getElementById('pub-media-exif'); if(el) el.innerHTML='<i class="fa-solid fa-camera"></i> \u0e16\u0e48\u0e32\u0e22\u0e40\u0e21\u0e37\u0e48\u0e2d '+U.esc(fnDate); }
    else { _showExifDate(src); }
  }
}

/* Parse a shot date embedded in the filename: <meterNo>_<YYYY-MM>_<YYYY-MM-DD>.<ext> -> dd/mm/yyyy.
   Works on file:// (no fetch needed). Returns '' if the name has no date segment. */
function _dateFromName(src){
  try{
    var fn=String(src).split('/').pop().split('?')[0];
    var m=fn.match(/_(\d{4})-(\d{2})-(\d{2})(?:_\d+)?\.[a-z]+$/i);
    if(m) return m[3]+'/'+m[2]+'/'+m[1];
  }catch(e){}
  return '';
}
/* Read EXIF DateTimeOriginal (tag 0x9003) from a JPEG and show it in the lightbox.
   Tolerant: if fetch is blocked (file://) or the tag is absent, it stays silent. */
function _showExifDate(src){
  try{
    fetch(src).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
      var dt=_parseExifDateTime(new DataView(buf));
      if(!dt) return;
      var el=document.getElementById('pub-media-exif');
      if(el) el.innerHTML='<i class="fa-solid fa-camera"></i> \u0e16\u0e48\u0e32\u0e22\u0e40\u0e21\u0e37\u0e48\u0e2d '+U.esc(dt);
    }).catch(function(){});
  }catch(e){}
}
/* Minimal JPEG/Exif parser: returns "dd/mm/yyyy HH:MM" from DateTimeOriginal, or '' if not found. */
function _parseExifDateTime(dv){
  try{
    if(dv.getUint16(0)!==0xFFD8) return '';   // not a JPEG
    var off=2, len=dv.byteLength;
    while(off+4<len){
      if(dv.getUint16(off)!==0xFFE1){ // not APP1 - skip this marker segment
        if(dv.getUint8(off)!==0xFF) return '';
        off+=2+dv.getUint16(off+2); continue;
      }
      // APP1 (Exif)
      var base=off+4;
      if(dv.getUint32(base)!==0x45786966) return ''; // 'Exif'
      var tiff=base+6;
      var little=(dv.getUint16(tiff)===0x4949);
      var g16=function(o){ return dv.getUint16(o,little); };
      var g32=function(o){ return dv.getUint32(o,little); };
      var ifd0=tiff+g32(tiff+4);
      var n=g16(ifd0), exifIFD=0;
      for(var i=0;i<n;i++){ var e=ifd0+2+i*12; if(g16(e)===0x8769){ exifIFD=tiff+g32(e+8); break; } }
      if(!exifIFD) return '';
      var m=g16(exifIFD);
      for(var j=0;j<m;j++){
        var en=exifIFD+2+j*12;
        if(g16(en)===0x9003){ // DateTimeOriginal, ASCII "YYYY:MM:DD HH:MM:SS"
          var cnt=g32(en+4), vo=(cnt>4)?(tiff+g32(en+8)):(en+8), s='';
          for(var k=0;k<cnt-1;k++){ var ch=dv.getUint8(vo+k); if(ch) s+=String.fromCharCode(ch); }
          var mo=s.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/);
          if(mo) return mo[3]+'/'+mo[2]+'/'+mo[1]+' '+mo[4]+':'+mo[5];
          return '';
        }
      }
      return '';
    }
  }catch(e){ return ''; }
  return '';
}
function pubCloseMedia(){ var ov=document.getElementById('pub-media-ov'); if(ov){ ov.style.display='none'; ov.innerHTML=''; } }
window.pubViewMedia=pubViewMedia;
window.pubCloseMedia=pubCloseMedia;
/* Export ONLY the data the public report needs (bills + meters) as villageman_data.js.
   Excludes households / vendors / emergency / promptpay / meta -> safe for a public repo.
   Download it, drop into the VillageManPublic repo, and push (GitHub Pages). */
/* VMP folder handle, remembered in IndexedDB (browser cannot use a typed path). */
function _vmpDb(){ return new Promise(function(res,rej){ var r=indexedDB.open('vm_fs',1); r.onupgradeneeded=function(){ r.result.createObjectStore('h'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }); }
function _vmpGet(){ return _vmpDb().then(function(db){ return new Promise(function(res){ var q=db.transaction('h').objectStore('h').get('vmp'); q.onsuccess=function(){ res(q.result||null); }; q.onerror=function(){ res(null); }; }); }).catch(function(){ return null; }); }
function _vmpPut(h){ return _vmpDb().then(function(db){ return new Promise(function(res){ var t=db.transaction('h','readwrite'); t.objectStore('h').put(h,'vmp'); t.oncomplete=function(){ res(); }; }); }); }
function _vmpLabel(){ _vmpGet().then(function(h){ var el=document.getElementById('pub-fold-lbl'); if(el) el.textContent=h?('VMP: '+h.name):'Set VMP folder'; }); }
async function pubSetupFolder(){
  if(!window.showDirectoryPicker){ U.toast('Browser does not support folder access - use Chrome/Edge'); return; }
  try{ var h=await window.showDirectoryPicker({id:'vmp', mode:'readwrite'}); await _vmpPut(h); _vmpLabel(); U.toast('VMP folder set: '+h.name); }catch(e){}
}
function _vmpAsk(h){ return new Promise(function(res){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML='<div style="background:var(--bg,#fff);border-radius:12px;padding:18px 22px;width:400px;max-width:94vw;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13px">'
   +'<div style="font-weight:700;font-size:15px;margin-bottom:8px"><i class="fa-solid fa-folder-open" style="color:var(--primary,#3b82f6)"></i> \u0e02\u0e2d\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e1f\u0e25\u0e4c</div>'
   +'<div>\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 villageman_data.js \u0e25\u0e07\u0e42\u0e1f\u0e25\u0e40\u0e14\u0e2d\u0e23\u0e4c <b>'+U.esc(h.name)+'</b></div>'
   +'<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text3)">\u0e01\u0e14 \u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15 \u0e41\u0e25\u0e49\u0e27 Chrome \u0e08\u0e30\u0e16\u0e32\u0e21\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07 \u0e43\u0e2b\u0e49\u0e01\u0e14 Allow</div>'
   +'<div style="display:flex;justify-content:space-between;margin-top:14px"><button class="btn btn-ghost" data-k="0">\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01</button><button class="btn" data-k="1"><i class="fa-solid fa-check"></i> \u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15</button></div></div>';
  var done=function(v){ document.removeEventListener('keydown',kd); ov.remove(); res(v); };
  var kd=function(e){ if(e.key==='Escape') done(false); };
  document.addEventListener('keydown',kd);
  ov.addEventListener('click',function(e){ var b=e.target.closest('button[data-k]');
    if(b){ if(b.getAttribute('data-k')==='1'){ h.requestPermission({mode:'readwrite'}).then(function(p){ done(p==='granted'); }).catch(function(){ done(false); }); } else done(false); return; }
    if(e.target===ov) done(false); });
  document.body.appendChild(ov);
}); }
async function _vmpWrite(js){
  var h=await _vmpGet(); if(!h) return false;
  try{
    var p=await h.queryPermission({mode:'readwrite'}); if(p!=='granted'){ var ok=await _vmpAsk(h); if(!ok) return false; p=await h.queryPermission({mode:'readwrite'}); } if(p!=='granted') return false;
    var fh=await h.getFileHandle('villageman_data.js',{create:true}); var w=await fh.createWritable(); await w.write(js); await w.close(); return h.name;
  }catch(e){ console.error(e); return false; }
}
function _vmpPopup(saved, js, P){
  var bl=P.utility_bills||[], pub=bl.filter(function(b){return !b.home_only;}), ps=pub.map(function(b){return b.period;}).filter(Boolean).sort();
  var ph=pub.filter(function(b){return b.meter_photo_rel;}).length, kb=(js.length/1024).toFixed(1);
  var row=function(k,v){ return '<tr><td style="padding:3px 10px 3px 0;color:var(--text3)">'+k+'</td><td style="padding:3px 0"><b>'+v+'</b></td></tr>'; };
  var ok=!!saved;
  var h='<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">'
   +'<div style="background:var(--bg,#fff);border-radius:12px;padding:18px 22px;min-width:340px;max-width:440px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13px">'
   +'<div style="font-weight:700;font-size:15px;margin-bottom:10px;color:'+(ok?'var(--success,#16a34a)':'var(--warning,#d97706)')+'"><i class="fa-solid '+(ok?'fa-circle-check':'fa-triangle-exclamation')+'"></i> '+(ok?'Export successful':'Saved as download (VMP folder not available)')+'</div>'
   +'<table style="border-collapse:collapse;width:100%">'
   +row('File','villageman_data.js ('+kb+' KB)')
   +row('Saved to',ok?('G:\\My Drive\\Develop\\'+U.esc(saved)):'Downloads folder')
   +row('Time',new Date().toLocaleString('en-GB'))
   +row('Bills (public)',pub.length+' of '+bl.length+' <span style="color:var(--text3);font-weight:400">(home-only excluded)</span>')
   +row('Periods',ps.length?(ps[0]+' to '+ps[ps.length-1]):'-')
   +row('Latest period',ps.length?ps[ps.length-1]:'-')
   +row('Meters',(P.meters||[]).length)
   +row('With photo',ph+' / '+pub.length)
   +'</table>'
   +'<div style="margin-top:12px;padding:8px 10px;background:var(--bg2);border-radius:8px;font-size:12px"><i class="fa-solid fa-code-branch"></i> Next: '+(ok?'':'copy the file into VillageManPublic, then ')+'commit + push in GitHub Desktop</div>'
   +'<div style="text-align:right;margin-top:12px"><button class="btn" onclick="this.closest(\'div[style*=fixed]\').remove()">OK</button></div>'
   +'</div></div>';
  var w=document.createElement('div'); w.innerHTML=h; document.body.appendChild(w.firstChild);
}
async function exportPublicData(){
  var D=await window.CM_REPO.all();
  var meters=(D.meters||[]).map(function(m){
    return { id:m.id, purpose:m.purpose||'', utility_type:m.utility_type||'', provider:m.provider||'',
             ca_no:m.ca_no||'', installation:m.installation||'', meter_no:m.meter_no||'',
             role:m.role||'main', parent_meter_id:m.parent_meter_id||'' };
  });
  // meter lookup (for building the relative photo path per bill)
  var _mById={}; (D.meters||[]).forEach(function(m){ _mById[m.id]=m; });
  var _photoBase=(D.meta&&D.meta.meter_photo_base)?D.meta.meter_photo_base:'meter-photos';
  function _meterNoFor(b){ if(b&&b.central_meter_no) return b.central_meter_no; var m=_mById[b.meter_id]; if(!m) return ''; return m.installation||m.meter_no||m.ca_no||''; }
  function _catOf2(type){ var t=(type||'').toLowerCase(); if(t.indexOf('w')===0||t.indexOf('water')>=0||t.indexOf('\u0e19')>=0) return 'water'; return 'electricity'; }
  function _relPhoto(b){
    var period=b.period||''; if(!period) return '';
    var meterNo=_meterNoFor(b); if(!meterNo) return '';
    var type=b.utility_type||'electricity';
    var year=(period.split('-')[0])||'', cat=_catOf2(type);
    var idx=window.VM_PHOTO_INDEX;
    if(idx){ var key=cat+'/'+year+'/'+meterNo+'_'+period; if(idx[key]&&idx[key].file){ return _photoBase.replace(/\/+$/,'')+'/'+idx[key].file; } }
    try{ var t=U.meterPhotoTarget(type, period, [meterNo, period], 'jpg', _photoBase); return t.path; }catch(e){ return ''; }
  }
  // bills: keep only fields the public report reads (no receipt/invoice paths - those are private).
  // meter_photo_rel = relative path inside the repo (meter-photos/<cat>/<year>/<meterNo>_<period>.jpg);
  // the copy_photos_to_public.py script copies the actual files there so the public site can open them.
  var bills=(D.utility_bills||[]).map(function(b){
    return {
      id:b.id, meter_id:b.meter_id, period:b.period||'', utility_type:b.utility_type||'',
      units_used:b.units_used||0, prev_reading:b.prev_reading||0, present_reading:b.present_reading||0,
      energy_charge:b.energy_charge||0, vat:b.vat||0, total_amount:b.total_amount||0,
      paid:!!b.paid, paid_date:b.paid_date||'', due_date:b.due_date||'', reimbursed:!!b.reimbursed, reimbursed_date:b.reimbursed_date||'',
      split_meter:!!b.split_meter, home_only:!!b.home_only,
      bill_total:b.bill_total||0, central_meter_no:b.central_meter_no||'',
      central_prev:b.central_prev||0, central_present:b.central_present||0, central_units:b.central_units||0,
      central_energy:b.central_energy||0, central_ft:b.central_ft||0, central_vat:b.central_vat||0,
      central_amount:b.central_amount||0, home_units:b.home_units||0, home_amount:b.home_amount||0,
      meter_photo_rel:_relPhoto(b)
    };
  });
  var payload={ generated_at:new Date().toISOString(), estate_name:(D.meta&&D.meta.estate_name)||'', meters:meters, utility_bills:bills };
  var js='window.VILLAGEMAN_DATA = '+JSON.stringify(payload, null, 1)+';\n';
  var _saved=await _vmpWrite(js);
  _vmpPopup(_saved, js, payload);
  if(_saved) return;
  var blob=new Blob([js], {type:'application/javascript'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download='villageman_data.js'; a.click();
  URL.revokeObjectURL(url);
}
window.renderPubReport=renderPubReport;
window.setPubYear=setPubYear;
window.setPubSort=setPubSort;
window.exportPublicData=exportPublicData;
window.pubSetupFolder=pubSetupFolder;
window.pubToggle=pubToggle;
window.pubReimbOpen=pubReimbOpen; window.pubReimbSum=pubReimbSum; window.pubReimbSave=pubReimbSave; window.pubReimbUndo=pubReimbUndo;
})();
