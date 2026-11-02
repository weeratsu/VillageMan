/* ui-readings.js - Utilities > Readings: central (piggyback) meter readings entered on reading day.
   One record per reading: {id, meter_id (sub meter), main_meter_id, read_date, period, prev_reading,
   reading, units, notes}. Readings are the ONLY source of central-meter numbers (the MEA bill only
   shows the home/main meter). When the bill for the same main meter + period exists, the reading is
   applied to it (split calc) automatically. Period = month BEFORE the reading month. */
(function(){
var U=window.CM_UTIL;
var _rdEdit=null;

function _rdPeriod(iso){ var p=String(iso||'').split('-'); if(p.length<2) return ''; var y=+p[0], m=+p[1]-1; if(m===0){m=12;y--;} return y+'-'+(m<10?'0':'')+m; }
function _subMeters(D){ var ms=D.meters||[]; var subs=ms.filter(function(m){return (m.role||'main')==='sub';}); return subs.length?subs:ms.filter(function(m){return (m.utility_type||'electricity')!=='water';}); }
function _mNo(m){ return m?(m.installation||m.meter_no||m.ca_no||''):''; }
function _mainOf(D,meterId){ var m=(D.meters||[]).find(function(x){return x.id===meterId;}); return (m&&m.parent_meter_id)?m.parent_meter_id:meterId; }

/* Apply one reading to its bill (same main meter + period). Mutates bill; returns true if changed. */
function _applyToBill(D,b,r){
  var tariff=U.getTariff(D.meta), rates=U.getRates(D.meta);
  var units=+b.units_used||0, full=b.split_meter?(+b.bill_total||+b.total_amount||0):(+b.total_amount||0);
  var energy=+b.energy_charge||0;
  if(!energy && units>0){ energy=(b.energy_mode==='manual'&&b.energy_manual)?+b.energy_manual:(U.calcTiered(units,tariff).total||0); }
  var ftRate=+b.ft_rate||0, vatPct=(rates&&rates.vat_pct!=null)?rates.vat_pct:7, svc=+b.service_fee||0;
  var cu=Math.max(0,(+r.reading||0)-(+r.prev_reading||0)), eRate=units>0?energy/units:0;
  var cE=+(cu*eRate).toFixed(2), cF=+(cu*ftRate).toFixed(2), cPre=+(cE+cF).toFixed(2), cV=+(cPre*vatPct/100).toFixed(2);
  var hu=Math.max(0,units-cu), hPre=+((hu*eRate)+(hu*ftRate)+svc).toFixed(2);
  var patch={split_meter:true, bill_total:full, energy_charge:energy, central_date:r.read_date||'',
    central_meter_no:r.meter_no||'', central_prev:+r.prev_reading||0, central_present:+r.reading||0, central_units:cu,
    avg_rate:eRate, central_energy:cE, central_ft:cF, central_vat:cV, central_amount:+(cPre+cV).toFixed(2),
    home_units:hu, home_amount:+(hPre+hPre*vatPct/100).toFixed(2), reading_id:r.id};
  patch.total_amount=patch.central_amount;
  var changed=false; Object.keys(patch).forEach(function(k){ if(b[k]!==patch[k]){ b[k]=patch[k]; changed=true; } });
  return changed;
}
function _billFor(D,r){ return (D.utility_bills||[]).find(function(b){ return b.meter_id===r.main_meter_id && b.period===r.period && !b.is_water; }); }

/* Apply every reading to its bill; one save for all changes. Also migrates old central values once. */
async function applyCentralReadings(){
  var repo=window.CM_REPO, D=await repo.all(); var dirty=false;
  if(!D.central_readings) D.central_readings=[];
  {
    (D.utility_bills||[]).forEach(function(b){
      if(!b.split_meter || !(+b.central_present>0)) return;
      if(D.central_readings.some(function(r){return r.main_meter_id===b.meter_id && r.period===b.period;})) return;
      var sub=(D.meters||[]).find(function(m){return (m.role||'main')==='sub' && m.parent_meter_id===b.meter_id;});
      D.central_readings.push({id:'rd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        meter_id:sub?sub.id:b.meter_id, main_meter_id:b.meter_id, meter_no:b.central_meter_no||_mNo(sub),
        read_date:b.central_date||'', period:b.period, prev_reading:+b.central_prev||0, reading:+b.central_present||0,
        units:+b.central_units||0, notes:''}); dirty=true;
    });
  }
  D.central_readings.forEach(function(r){ var b=_billFor(D,r); if(b && !b.home_only && _applyToBill(D,b,r)) dirty=true; });
  if(dirty) await repo.replaceAll(D);
  return dirty;
}

function _prevFor(D,meterId,readDate,excludeId){
  var rs=(D.central_readings||[]).filter(function(r){return r.meter_id===meterId && r.id!==excludeId && (r.read_date||'')<(readDate||'9999');});
  rs.sort(function(a,b){return (a.read_date||'').localeCompare(b.read_date||'');});
  return rs.length?(+rs[rs.length-1].reading||0):'';
}

async function renderReadings(){
  var body=document.getElementById('util-body'); if(!body) return;
  try{ await applyCentralReadings(); }catch(e){ console.error(e); }
  var D=await window.CM_REPO.all(); var subs=_subMeters(D);
  var list=(D.central_readings||[]).slice().sort(function(a,b){return (b.period||'').localeCompare(a.period||'')||(b.read_date||'').localeCompare(a.read_date||'');});
  var opts=subs.map(function(m){return '<option value="'+m.id+'">'+U.esc((m.purpose||'')+' #'+_mNo(m))+'</option>';}).join('');
  var rows=list.map(function(r){
    var b=_billFor(D,r), st;
    if(!b) st='<span class="tag tag-planned">\u0e23\u0e2d\u0e1a\u0e34\u0e25</span>';
    else if(b.home_only) st='<span class="tag tag-planned">home-only</span>';
    else st='<span class="tag tag-active">\u0e08\u0e31\u0e1a\u0e04\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27</span><div style="font-size:9px;color:var(--text3)">\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 '+U.fmtMoney(b.central_amount||0)+'</div>';
    var ph=(window._billMeterPhotoSrc&&b)?window._billMeterPhotoSrc(b,D.meters):'';
    return '<tr><td>'+U.esc(r.period)+'</td><td>'+U.fmtDate(r.read_date)+'</td><td>'+U.esc(r.meter_no||'')+'</td>'
      +'<td class="r">'+Math.round(+r.prev_reading||0)+'</td><td class="r">'+Math.round(+r.reading||0)+'</td><td class="r"><b>'+Math.round(+r.units||0)+'</b></td>'
      +'<td>'+st+'</td><td class="r" style="white-space:nowrap">'
      +(ph?'<a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(ph)+'" style="margin-right:6px"><i class="fa-solid fa-camera text-primary"></i></a>':'')
      +'<button class="del-btn" title="Edit" onclick="rdEdit(\''+r.id+'\')"><i class="fa-solid fa-pen"></i></button>'
      +'<button class="del-btn" title="Delete" onclick="rdDelete(\''+r.id+'\')"><i class="fa-solid fa-trash"></i></button></td></tr>';
  }).join('');
  body.innerHTML='<div class="card"><h2><i class="fa-solid fa-gauge-high"></i> \u0e08\u0e14\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07</h2>'
   +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;align-items:end">'
   +'<label style="display:flex;flex-direction:column;gap:3px;min-width:0;font-size:11px">Meter<select class="inp" style="width:100%;box-sizing:border-box" id="rd-meter" onchange="rdRecalc(true)">'+opts+'</select></label>'
   +'<label style="display:flex;flex-direction:column;gap:3px;min-width:0;font-size:11px">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e08\u0e14<input class="inp" style="width:100%;box-sizing:border-box" type="date" id="rd-date" onchange="rdRecalc(true)"></label>'
   +'<label style="display:flex;flex-direction:column;gap:3px;min-width:0;font-size:11px">\u0e40\u0e25\u0e02\u0e04\u0e23\u0e31\u0e49\u0e07\u0e01\u0e48\u0e2d\u0e19<input class="inp" style="width:100%;box-sizing:border-box" type="number" id="rd-prev" oninput="rdRecalc()"></label>'
   +'<label style="display:flex;flex-direction:column;gap:3px;min-width:0;font-size:11px">\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48\u0e08\u0e14\u0e44\u0e14\u0e49<input class="inp" style="width:100%;box-sizing:border-box" type="number" id="rd-reading" oninput="rdRecalc()"></label>'
   +'</div><div id="rd-info" style="font-size:11px;margin:8px 0;color:var(--text2)"></div>'
   +'<div style="display:flex;gap:6px"><button class="btn btn-primary" onclick="rdSave()"><i class="fa-solid fa-floppy-disk"></i> Save</button>'
   +'<button class="btn btn-ghost" onclick="rdClear()"><i class="fa-solid fa-xmark"></i> Clear</button></div></div>'
   +'<div class="card"><h2><i class="fa-solid fa-list"></i> Readings</h2><div class="table-scroll"><table class="tbl"><thead><tr>'
   +'<th>Period</th><th>\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e08\u0e14</th><th>Meter</th><th class="r">Prev</th><th class="r">Reading</th><th class="r">Units</th><th>Status</th><th></th>'
   +'</tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="text-muted">-</td></tr>')+'</tbody></table></div></div>';
  if(_rdEdit){ var r=(D.central_readings||[]).find(function(x){return x.id===_rdEdit;}); if(r){ _val('rd-meter',r.meter_id); _val('rd-date',r.read_date); _val('rd-prev',r.prev_reading); _val('rd-reading',r.reading); } }
  else { _val('rd-date',U.todayISO()); }
  rdRecalc(!_rdEdit);
}
function _val(id,v){ var e=document.getElementById(id); if(e) e.value=(v==null?'':v); }
function _g(id){ var e=document.getElementById(id); return e?e.value:''; }

async function rdRecalc(refillPrev){
  var D=await window.CM_REPO.all(), mid=_g('rd-meter'), dt=_g('rd-date');
  if(refillPrev){ _val('rd-prev',_prevFor(D,mid,dt,_rdEdit)); }
  var m=(D.meters||[]).find(function(x){return x.id===mid;}), no=_mNo(m), per=_rdPeriod(dt);
  var u=Math.max(0,(parseFloat(_g('rd-reading'))||0)-(parseFloat(_g('rd-prev'))||0));
  var fn=no&&per&&dt?(no+'_'+per+'_'+dt+'.jpg'):'';
  var el=document.getElementById('rd-info'); if(!el) return;
  el.innerHTML='\u0e07\u0e27\u0e14: <b>'+(per||'-')+'</b> \u00b7 \u0e2b\u0e19\u0e48\u0e27\u0e22: <b>'+u+'</b>'
    +(fn?'<br>\u0e23\u0e39\u0e1b: \u0e42\u0e22\u0e19\u0e25\u0e07 <a href="meter-photos/inbox/'+encodeURIComponent(no)+'/" target="_blank" title="Open folder"><code>meter-photos/inbox/'+U.esc(no)+'/</code> <i class="fa-solid fa-folder-open"></i></a> <a href="#" title="Copy path" onclick="rdCopyPath(\''+U.esc(no)+'\');return false;"><i class="fa-solid fa-copy"></i></a> (\u0e2a\u0e04\u0e23\u0e34\u0e1b\u0e15\u0e4c\u0e08\u0e30\u0e15\u0e31\u0e49\u0e07\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1b\u0e47\u0e19 <code>'+U.esc(fn)+'</code>)':'');
}
async function rdSave(){
  var repo=window.CM_REPO, D=await repo.all(), mid=_g('rd-meter'), dt=_g('rd-date'), rd=parseFloat(_g('rd-reading'));
  if(!mid||!dt||isNaN(rd)){ U.toast('\u0e01\u0e23\u0e2d\u0e01 meter / \u0e27\u0e31\u0e19\u0e17\u0e35\u0e48 / \u0e40\u0e25\u0e02\u0e17\u0e35\u0e48\u0e08\u0e14'); return; }
  var m=(D.meters||[]).find(function(x){return x.id===mid;}), prev=parseFloat(_g('rd-prev'))||0;
  var rec={meter_id:mid, main_meter_id:_mainOf(D,mid), meter_no:_mNo(m), read_date:dt, period:_rdPeriod(dt), prev_reading:prev, reading:rd, units:Math.max(0,rd-prev)};
  if(!D.central_readings) D.central_readings=[];
  var dup=D.central_readings.find(function(r){return r.id!==_rdEdit && r.main_meter_id===rec.main_meter_id && r.period===rec.period;});
  if(dup && !confirm('\u0e07\u0e27\u0e14 '+rec.period+' \u0e21\u0e35\u0e2d\u0e22\u0e39\u0e48\u0e41\u0e25\u0e49\u0e27 \u0e40\u0e02\u0e35\u0e22\u0e19\u0e17\u0e31\u0e1a?')) return;
  if(dup) _rdEdit=dup.id;
  if(_rdEdit){ var ex=D.central_readings.find(function(r){return r.id===_rdEdit;}); Object.assign(ex,rec); }
  else { rec.id='rd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); D.central_readings.push(rec); }
  await repo.replaceAll(D);
  _rdEdit=null; U.toast('Saved'); renderReadings();
}
function rdCopyPath(no){
  var p='G:\\My Drive\\Develop\\VillageMan\\meter-photos\\inbox\\'+no+'\\';
  if(navigator.clipboard) navigator.clipboard.writeText(p);
  U.toast('Copied: '+p+' - paste in File Explorer');
}
function rdEdit(id){ _rdEdit=id; return renderReadings(); }
function rdClear(){ _rdEdit=null; renderReadings(); }
async function rdDelete(id){
  if(!confirm('Delete this reading?')) return;
  var repo=window.CM_REPO, D=await repo.all();
  D.central_readings=(D.central_readings||[]).filter(function(r){return r.id!==id;});
  await repo.replaceAll(D); renderReadings();
}
window.renderReadings=renderReadings; window.applyCentralReadings=applyCentralReadings;
window.rdRecalc=rdRecalc; window.rdSave=rdSave; window.rdEdit=rdEdit; window.rdClear=rdClear; window.rdDelete=rdDelete; window.rdCopyPath=rdCopyPath;
})();
