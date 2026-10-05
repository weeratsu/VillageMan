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
function _pubMonthlyCostChart(bills){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var vals=[]; for(var i=0;i<12;i++) vals.push(0);
  (bills||[]).forEach(function(b){
    var pp=(b.period||'').split('-'); if(pp.length<2) return;
    var mi=parseInt(pp[1],10)-1; if(mi<0||mi>11) return;
    var amt=b.split_meter?(Number(b.central_amount)||0):(Number(b.total_amount)||0);
    vals[mi]+=amt;
  });
  var max=Math.max.apply(null, vals.concat([1]));
  var W=640,H=170,padT=12,padB=22,padL=8,padR=8; var n=12; var bw=(W-padL-padR)/n; var bars='';
  var maxIdx=-1,maxV=-1; for(var k=0;k<12;k++){ if(vals[k]>maxV){maxV=vals[k];maxIdx=k;} }
  for(var j=0;j<n;j++){
    var v=vals[j]; var bh=max>0?(v/max)*(H-padT-padB):0;
    var x=padL+j*bw+bw*0.15, y=H-padB-bh, w=bw*0.7;
    var fill=(j===maxIdx&&v>0)?'var(--error)':'var(--primary-bg)';
    var stroke=(j===maxIdx&&v>0)?'var(--error)':'var(--border2)';
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,bh).toFixed(1)+'" rx="2" fill="'+fill+'" stroke="'+stroke+'"><title>'+MON[j]+': '+U.fmtMoney(v)+'</title></rect>';
    if(v>0){ bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y-2).toFixed(1)+'" text-anchor="middle" font-size="7" fill="var(--text3)">'+Math.round(v)+'</text>'; }
    bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-padB+10)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+MON[j]+'</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+bars+'</svg>';
}

/* Build the 6-step calculation explanation for ONE split bill (central share). */
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
  h+=S(3,'\u00d7 \u0e2b\u0e19\u0e48\u0e27\u0e22\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 ('+U.fmtNum(cu)+' \u0e2b\u0e19\u0e48\u0e27\u0e22)', (ce!=null?('<span class="text-muted" style="font-size:10px">('+(ratePerUnit!=null?U.fmtMoney(ratePerUnit):dash)+' \u00d7 '+U.fmtNum(cu)+') = </span>'+U.fmtMoney(ce)):dash));
  h+=S(4,'+ Ft (\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07)', (cf!=null?('<span class="text-muted" style="font-size:10px">('+(ftRate!=null?U.fmtRate(ftRate):dash)+' \u00d7 '+U.fmtNum(cu)+') = </span>'+U.fmtMoney(cf)):dash));
  h+=S(5,'+ VAT 7%', (cv!=null?('<span class="text-muted" style="font-size:10px">('+U.fmtMoney(preVat)+' \u00d7 7%) = </span>'+U.fmtMoney(cv)):dash));
  h+=S(6,'<b>= \u0e22\u0e2d\u0e14\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e01\u0e47\u0e1a</b>', '<b>'+U.fmtMoney(ca)+'</b>');
  h+='<div style="font-size:9px;color:var(--text3);margin-top:4px">* \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 (service fee) \u0e44\u0e21\u0e48\u0e23\u0e27\u0e21\u0e43\u0e19\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 \u2014 \u0e40\u0e1b\u0e47\u0e19\u0e04\u0e48\u0e32\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e02\u0e2d\u0e07\u0e1a\u0e49\u0e32\u0e19</div>';
  return h;
}

async function renderPubReport(){
  var el=document.getElementById('tab-pubreport'); if(!el) return;
  var D=await window.CM_REPO.all();
  var bills=(D.utility_bills||[]).filter(function(b){ if(b.home_only) return false; var y=(b.period||'').split('-')[0]; return parseInt(y,10)===_pubYear; });
  var _meterById={}; (D.meters||[]).forEach(function(m){ _meterById[m.id]=m; });
  var _photoBase=(D.meta&&D.meta.meter_photo_base)?D.meta.meter_photo_base:'meter-photos';
  function _meterNo(b){ if(b && b.central_meter_no) return b.central_meter_no; var m=_meterById[b.meter_id]; if(!m) return '-'; return m.installation||m.meter_no||m.ca_no||'-'; }
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
      +'<td class="r">'+(b.paid?'<span class="tag tag-active" style="font-size:9px">\u0e08\u0e48\u0e32\u0e22\u0e41\u0e25\u0e49\u0e27</span>':'<span class="tag tag-planned" style="font-size:9px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e08\u0e48\u0e32\u0e22</span>')+(b.paid&&b.paid_date?('<div style="font-size:8px;color:var(--text3);margin-top:2px">'+U.fmtDate(b.paid_date)+'</div>'):'')+'</td>'
      +'<td class="r">'+(function(){
        var src=b.meter_photo_path||_guessPhotoPath(b);
        if(!src) return dash;
        return '<a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(src)+'" title="'+U.esc(src)+'"><i class="fa-solid fa-camera text-primary"></i></a>';
      })()+'</td>'
      // when the probe succeeds we also hide the dash

      +'</tr>';
    if(isSplit){
      r+='<tr class="pub-detail" id="pd-'+b.id+'" style="display:none;background:var(--bg2)"><td colspan="11" style="padding:10px 14px;font-size:11px;line-height:1.6">'
        +'<div style="font-weight:700;margin-bottom:4px"><i class="fa-solid fa-calculator"></i> \u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14\u0e22\u0e2d\u0e14\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 ('+U.esc(b.period||'')+')</div>'
        +'<div style="max-width:460px">'+_calcSteps(b)+'</div>'
        +'<div style="margin-top:6px;font-size:10px;color:var(--text3)">\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e23\u0e27\u0e21\u0e17\u0e31\u0e49\u0e07\u0e1a\u0e34\u0e25 '+U.fmtNum(Number(b.units_used)||0)+' \u2014 \u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 '+U.fmtNum(Number(b.central_units)||0)+' / \u0e1a\u0e49\u0e32\u0e19 '+U.fmtNum(Number(b.home_units)||0)+'</div>'
        +(b.invoice_path?('<div style="margin-top:3px"><a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(b.invoice_path)+'"><i class="fa-solid fa-file-invoice"></i> \u0e43\u0e1a\u0e41\u0e08\u0e49\u0e07\u0e2b\u0e19\u0e35\u0e49 (Invoice)</a></div>'):'')+(b.receipt_path?('<div style="margin-top:3px"><a href="#" onclick="pubViewMedia(this.getAttribute(\'data-src\'),event);return false;" data-src="'+U.esc(b.receipt_path)+'"><i class="fa-solid fa-receipt"></i> \u0e43\u0e1a\u0e40\u0e2a\u0e23\u0e47\u0e08 (Receipt)</a></div>'):'')+'</td></tr>';
    }
    return r;
  }).join('');

  var tbl = sorted.length ? ('<table class="tbl"><thead><tr>'
    +'<th style="cursor:pointer" onclick="setPubSort(\'period\')">\u0e07\u0e27\u0e14'+_pubArrow('period')+'</th>'+'<th>\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17</th>'+'<th style="cursor:pointer" onclick="setPubSort(\'meter\')">\u0e40\u0e25\u0e02\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c'+_pubArrow('meter')+'</th>'
    +'<th class="r" style="cursor:pointer" onclick="setPubSort(\'prev\')">\u0e40\u0e25\u0e02\u0e40\u0e01\u0e48\u0e32'+_pubArrow('prev')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'pres\')">\u0e40\u0e25\u0e02\u0e43\u0e2b\u0e21\u0e48'+_pubArrow('pres')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'units\')">\u0e2b\u0e19\u0e48\u0e27\u0e22'+_pubArrow('units')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'energy\')">\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19'+_pubArrow('energy')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'vat\')">VAT'+_pubArrow('vat')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'total\')">\u0e23\u0e27\u0e21(\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07)'+_pubArrow('total')+'</th>'+'<th class="r" style="cursor:pointer" onclick="setPubSort(\'status\')">\u0e2a\u0e16\u0e32\u0e19\u0e30'+_pubArrow('status')+'</th>'+'<th class="r">\u0e23\u0e39\u0e1b</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>')
    : '<p class="text-muted" style="padding:10px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1a\u0e34\u0e25\u0e43\u0e19\u0e1b\u0e35\u0e19\u0e35\u0e49</p>';

  el.innerHTML = '<div class="card">'
    +'<h2><i class="fa-solid fa-users"></i> \u0e2a\u0e23\u0e38\u0e1b\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 (\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e25\u0e39\u0e01\u0e1a\u0e49\u0e32\u0e19)</h2>'
    +'<p class="text-muted" style="font-size:12px;margin:-4px 0 10px">\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49\u0e41\u0e2a\u0e14\u0e07\u0e04\u0e48\u0e32\u0e2a\u0e32\u0e18\u0e32\u0e23\u0e13\u0e30\u0e02\u0e2d\u0e07\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19 \u0e27\u0e48\u0e32\u0e41\u0e15\u0e48\u0e25\u0e30\u0e07\u0e27\u0e14\u0e04\u0e34\u0e14\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e44\u0e23 \u0e23\u0e27\u0e21\u0e40\u0e17\u0e48\u0e32\u0e44\u0e23</p>'
    +'<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><label class="text-muted" style="font-size:12px">\u0e1b\u0e35:</label><select class="inp" style="max-width:120px" onchange="setPubYear(this.value)">'+yearOpts+'</select>'+'<button class="btn btn-ghost" style="margin-left:8px;font-size:11px;padding:4px 10px" onclick="exportPublicData()" title="Export bills+meters as villageman_data.js for the public GitHub Pages site"><i class="fa-solid fa-cloud-arrow-up"></i> Export for web</button></div>'+'<div class="card" style="background:var(--bg2);margin-bottom:12px">'+'<h3 style="font-size:12px;margin:0 0 6px"><i class="fa-solid fa-chart-column"></i> \u0e04\u0e48\u0e32\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 ('+_pubYear+')</h3>'+_pubMonthlyCostChart(bills)+'</div>'
    +'<div class="kpi-grid">'
      +kpi('\u0e23\u0e27\u0e21\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e17\u0e31\u0e49\u0e07\u0e1b\u0e35', U.fmtMoney(totCentral), 'text-error', months+' \u0e07\u0e27\u0e14')
      +kpi('\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22\u0e15\u0e48\u0e2d\u0e40\u0e14\u0e37\u0e2d\u0e19', U.fmtMoney(avg), '', '')
      +kpi('\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e23\u0e27\u0e21', Math.round(cUnits), '', '')
      +kpi('\u0e1a\u0e34\u0e25\u0e1e\u0e48\u0e27\u0e07 / \u0e1a\u0e34\u0e25\u0e18\u0e23\u0e23\u0e21\u0e14\u0e32', nSplit+' / '+nFlat, '', '\u0e1a\u0e34\u0e25')
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
      paid:!!b.paid, paid_date:b.paid_date||'', due_date:b.due_date||'',
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
  var blob=new Blob([js], {type:'application/javascript'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download='villageman_data.js'; a.click();
  URL.revokeObjectURL(url);
  U.toast('Exported villageman_data.js - push it to the VillageManPublic repo');
}
window.renderPubReport=renderPubReport;
window.setPubYear=setPubYear;
window.setPubSort=setPubSort;
window.exportPublicData=exportPublicData;
window.pubToggle=pubToggle;
})();
