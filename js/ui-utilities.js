/* ui-utilities.js - Common-area utilities: METERS (set up once) + BILLS (monthly).
   Sub-tabs:
     Meters - register each common-area meter once (purpose, type, provider, meter/installation/reference no).
     Bills  - monthly entry: pick a meter (auto-fills fixed info + carries previous reading),
              then enter only this month's readings + amounts.
   All money THB; dates dd/mm/yyyy on display, YYYY-MM-DD in storage.
   ASCII-safe: Thai stored as \uXXXX escapes. */
const U = window.CM_UTIL;

const UTIL_TYPES = ['electricity','water','internet','other'];
const PROVIDERS  = ['','MEA','PEA'];
/* Common-area meter purpose suggestions. Thai: \u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19 etc. Free text allowed. */
const PURPOSES = ['\u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19','\u0e44\u0e1f\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19','CCTV','\u0e1b\u0e31\u0e4a\u0e21\u0e19\u0e49\u0e33/pump','\u0e2a\u0e42\u0e21\u0e2a\u0e23/clubhouse','other'];

let _utilSub = 'bills';
let _billTariff = null;   // cached electricity tariff tiers for the Bills form
let _billRates = null;    // cached default rates (ft_rate, service_fee, vat_pct)

async function renderUtilities(){
  const el = document.getElementById('tab-utilities');
  el.innerHTML = `
    <div class="sub-tabs" style="display:flex;gap:2px;margin-bottom:10px">
      <span class="sub-tab ${_utilSub==='bills'?'active':''}" onclick="utilSub('bills')"><i class="fa-solid fa-file-invoice-dollar"></i> Bills</span>
      <span class="sub-tab ${_utilSub==='meters'?'active':''}" onclick="utilSub('meters')"><i class="fa-solid fa-gauge"></i> Meters</span>
    </div>
    <div id="util-body"></div>`;
  if(!document.getElementById('util-substyle')){
    const st=document.createElement('style'); st.id='util-substyle';
    st.textContent='.sub-tab{padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg3);color:var(--text2);display:inline-flex;gap:5px;align-items:center}.sub-tab:hover{background:var(--surface)}.sub-tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}';
    document.head.appendChild(st);
  }
  if(_utilSub==='meters') await renderMeters();
  else await renderBills();
}
function utilSub(s){ _utilSub=s; renderUtilities(); }

/* ============================ METERS (set up once) ============================ */
async function renderMeters(){
  const repo = window.CM_REPO;
  const meters = await repo.list('meters');
  const meta = await repo.meta();
  const utilTypes = U.getList(meta,'utility_types');
  const providers = U.getList(meta,'providers');
  const purposes = U.getList(meta,'purposes');
  const body = document.getElementById('util-body');

  const rows = meters.map(m => `<tr>
      <td>${U.esc(m.purpose||'')}</td>
      <td>${U.esc(m.utility_type)}${m.provider?` <span class="text-muted">(${U.esc(m.provider)})</span>`:''}</td>
      <td>${U.esc(m.meter_no||'')}</td>
      <td>${U.esc(m.reference_no||'')}</td>
      <td class="r">
        <button class="del-btn" title="Edit" onclick="editMeter('${m.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteMeter('${m.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');

  body.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-gauge"></i> Register a Meter <span class="text-muted" style="font-size:10px;font-weight:400">(set up once - fixed info)</span></h2>
      <div class="form-grid">
        <div class="form-group"><label>Purpose (common-area meter)</label>
          <input class="inp" id="mt-purpose" list="mt-purpose-list" placeholder="e.g. \u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19">
          <datalist id="mt-purpose-list">${purposes.map(p=>`<option value="${U.esc(p)}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Utility Type</label>
          <select class="inp" id="mt-utility_type" onchange="meterTypeChanged()">${utilTypes.map(t=>`<option value="${U.esc(t)}">${U.esc(t)}</option>`).join('')}</select>
        </div>
        <div class="form-group" id="mt-provider-wrap"><label>Provider</label>
          <select class="inp" id="mt-provider">${providers.map(p=>`<option value="${U.esc(p)}">${p?U.esc(p):'-'}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Meter No.</label><input class="inp" id="mt-meter_no"></div>
        <div class="form-group"><label>Reference No.</label><input class="inp" id="mt-reference_no"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><input class="inp" id="mt-notes"></div>
        <div class="form-group" style="justify-content:flex-end">
          <button class="btn btn-primary" id="mt-save" onclick="saveMeter()"><i class="fa-solid fa-plus"></i> Add Meter</button>
        </div>
      </div>
      <input type="hidden" id="mt-edit-id" value="">
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-list"></i> Registered Meters</h2>
      ${meters.length?`<table class="tbl"><thead><tr><th>Purpose</th><th>Type</th><th>Meter No.</th><th>Reference</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                     :`<p class="text-muted" style="padding:8px">No meters yet. Register your common-area meters (\u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19, CCTV, \u0e44\u0e1f\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19, ...) here once. Then record monthly bills under the Bills tab.</p>`}
    </div>`;
  meterTypeChanged();
}

function meterTypeChanged(){
  const t=document.getElementById('mt-utility_type'), wrap=document.getElementById('mt-provider-wrap');
  if(t&&wrap) wrap.style.display=(t.value==='electricity')?'':'none';
}

async function saveMeter(){
  const g=id=>document.getElementById(id).value.trim();
  const purpose=g('mt-purpose');
  if(!purpose){ U.toast('Purpose is required'); return; }
  const rec={
    purpose,
    utility_type:g('mt-utility_type'),
    provider:document.getElementById('mt-utility_type').value==='electricity'?g('mt-provider'):'',
    meter_no:g('mt-meter_no'),
    reference_no:g('mt-reference_no'), notes:g('mt-notes')
  };
  const editId=document.getElementById('mt-edit-id').value;
  if(editId){ await window.CM_REPO.update('meters', editId, rec); U.toast('Meter updated'); }
  else { await window.CM_REPO.add('meters', rec); U.toast('Meter added'); }
  renderMeters();
}
async function editMeter(id){
  const m=await window.CM_REPO.get('meters', id);
  if(!m) return;
  const s=(k,v)=>{const e=document.getElementById(k); if(e) e.value=(v==null?'':v);};
  s('mt-purpose',m.purpose); s('mt-utility_type',m.utility_type); meterTypeChanged();
  s('mt-provider',m.provider); s('mt-meter_no',m.meter_no);
  s('mt-reference_no',m.reference_no); s('mt-notes',m.notes);
  document.getElementById('mt-edit-id').value=id;
  document.getElementById('mt-save').innerHTML='<i class="fa-solid fa-check"></i> Update Meter';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteMeter(id){
  if(!confirm('Delete this meter? Existing bills that used it are kept.')) return;
  await window.CM_REPO.remove('meters', id); U.toast('Meter deleted'); renderMeters();
}

/* ============================ BILLS (monthly) ============================ */
/* Hidden detail row for a split-meter bill: central readings/units/amount + home portion. */
function _billDetailRow(b){
  var cu=b.central_units||0, ca=b.central_amount||0;
  var ce=b.central_energy!=null?b.central_energy:null, cf=b.central_ft!=null?b.central_ft:null, cv=b.central_vat!=null?b.central_vat:null;
  var hu=b.home_units||0, ha=b.home_amount||0;
  var billTot=b.bill_total||0;
  var mainPrev=b.prev_reading||0, mainPres=b.present_reading||0, mainUnits=b.units_used||0;
  var cparts = (ce!=null) ? ' <span class="text-muted">(energy '+U.fmtMoney(ce)+' + Ft '+U.fmtMoney(cf||0)+' + VAT '+U.fmtMoney(cv||0)+')</span>' : '';
  return '<tr class="bill-detail" id="bd-'+b.id+'" style="display:none;background:var(--bg2)">'
    + '<td colspan="8" style="padding:10px 12px;font-size:11px;line-height:1.9">'
    + '<div style="font-weight:700;margin-bottom:4px"><i class="fa-solid fa-plug"></i> \u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e1a\u0e34\u0e25\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e1e\u0e48\u0e27\u0e07</div>'
    + '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:3px"><span><b>\u0e1a\u0e34\u0e25\u0e40\u0e15\u0e47\u0e21 (\u0e08\u0e48\u0e32\u0e22\u0e08\u0e23\u0e34\u0e07\u0e17\u0e31\u0e49\u0e07\u0e1a\u0e34\u0e25)</b> \u2014 \u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e2b\u0e25\u0e31\u0e01 '+U.fmtNum(mainPrev)+' \u2192 '+U.fmtNum(mainPres)+' = '+U.fmtNum(mainUnits)+' \u0e2b\u0e19\u0e48\u0e27\u0e22</span><span><b>'+U.fmtMoney(billTot)+'</b></span></div>'
    + '<div style="display:flex;justify-content:space-between;padding-top:3px"><span>\u0e2a\u0e48\u0e27\u0e19\u0e44\u0e1f\u0e1a\u0e49\u0e32\u0e19 ('+U.fmtNum(hu)+' \u0e2b\u0e19\u0e48\u0e27\u0e22)</span><span>'+U.fmtMoney(ha)+'</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span>\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 \u2014 \u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e1e\u0e48\u0e27\u0e07 '+U.fmtNum(b.central_prev||0)+' \u2192 '+U.fmtNum(b.central_present||0)+' = '+U.fmtNum(cu)+' \u0e2b\u0e19\u0e48\u0e27\u0e22'+cparts+'</span><span class="text-error"><b>'+U.fmtMoney(ca)+'</b></span></div>'
    + '<div style="margin-top:5px;font-size:10px;color:var(--text3)"><span class="tag" style="background:var(--primary-bg);color:var(--primary)">\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e22\u0e2d\u0e14\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07</span> \u0e08\u0e48\u0e32\u0e22\u0e40\u0e15\u0e47\u0e21\u0e1a\u0e34\u0e25 '+U.fmtMoney(billTot)+' \u0e01\u0e48\u0e2d\u0e19 \u2192 \u0e40\u0e23\u0e35\u0e22\u0e01\u0e40\u0e01\u0e47\u0e1a\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 '+U.fmtMoney(ca)+' \u0e08\u0e32\u0e01\u0e07\u0e1a\u0e01\u0e25\u0e32\u0e07\u0e20\u0e32\u0e22\u0e2b\u0e25\u0e31\u0e07</div>'
    + '</td></tr>';
}

function toggleBillDetail(id){
  var r=document.getElementById('bd-'+id); var chev=document.getElementById('bd-chev-'+id);
  if(!r) return;
  var show = r.style.display==='none';
  r.style.display = show?'':'none';
  if(chev){ chev.className = show?'fa-solid fa-chevron-down':'fa-solid fa-chevron-right'; }
}
async function renderBills(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const meters = D.meters || [];
  _billTariff = U.getTariff(D.meta);
  _billRates = U.getRates(D.meta);
  const bills = (D.utility_bills||[]).slice().sort((a,b)=>(b.reading_date||'').localeCompare(a.reading_date||''));
  const body = document.getElementById('util-body');
  const today = U.todayISO();

  const meterLabel = m => `${m.purpose||'(meter)'} - ${m.utility_type}${m.provider?' '+m.provider:''}${m.meter_no?' #'+m.meter_no:''}`;

  const rows = bills.map(b => {
    const mtr = meters.find(x=>x.id===b.meter_id);
    const label = mtr ? (mtr.purpose||mtr.utility_type) : (b.purpose||b.utility_type||'-');
    const overdue = !b.paid && (b.due_date||'') && b.due_date < today;
    const stTag = b.paid?'tag-active':overdue?'':'tag-planned';
    const stStyle = (!b.paid&&overdue)?'style="background:var(--error-bg);color:var(--error)"':'';
    const stTxt = b.paid?'paid':overdue?'OVERDUE':'unpaid';
    const recv = b.receipt_path?`<span title="${U.esc(b.receipt_path)}"><i class="fa-solid fa-paperclip text-primary"></i></span>`:'<span class="text-muted">-</span>';
    const splitBadge = b.split_meter ? ` <span class="tag" style="background:var(--primary-bg);color:var(--primary)" title="Split meter: central ${U.fmtMoney(b.central_amount||0)} of full bill ${U.fmtMoney(b.bill_total||0)}">split</span>` : '';
    const expBtn = b.split_meter ? `<button class="lnk-btn" title="Show central meter detail" onclick="toggleBillDetail('${b.id}')" style="margin-right:4px"><i class="fa-solid fa-chevron-right" id="bd-chev-${b.id}"></i></button>` : '';
    return `<tr>
      <td>${expBtn}${U.esc(label)}${splitBadge}</td>
      <td>${U.esc(b.period)}</td>
      <td class="r">${U.fmtNum(b.units_used||0)}</td>
      <td class="r">${b.split_meter
          ? ('<b>'+U.fmtMoney(b.bill_total||0)+'</b><div style="font-size:9px;color:var(--text3)">'+U.fmtMoney(b.central_amount||0)+' \u0e01\u0e25\u0e32\u0e07</div>')
          : U.fmtMoney(b.total_amount||0)}</td>
      <td>${U.fmtDate(b.due_date)}</td>
      <td><span class="tag ${stTag}" ${stStyle}>${stTxt}</span></td>
      <td class="r">${recv}</td>
      <td class="r">
        <button class="del-btn" title="Edit" onclick="editBill('${b.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteBill('${b.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>${b.split_meter ? _billDetailRow(b) : ''}`;
  }).join('');

  const meterOptions = meters.length
    ? meters.map(m=>`<option value="${m.id}">${U.esc(meterLabel(m))}</option>`).join('')
    : '';

  body.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-file-invoice-dollar"></i> Record Monthly Bill</h2>
      ${meters.length ? `
      <!-- ===== MEA-style electricity bill entry ===== -->
      <div class="mea-bill">
        <!-- Meter selector (not part of the paper bill, but needed to pick which meter) -->
        <div class="mea-meterpick">
          <label>Meter</label>
          <select class="inp" id="bl-meter_id" onchange="meterPicked()">${meterOptions}</select>
          <span id="bl-meterinfo" class="text-muted" style="font-size:10px"></span>
        </div>

        <!-- HEADER STRIP: meter reading info (grey, like the top band of the bill) -->
        <div class="mea-head">
          <div class="mea-hcell"><span class="mea-hlabel">Period / \u0e1a\u0e34\u0e25\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e40\u0e14\u0e37\u0e2d\u0e19</span><div style="display:flex;gap:4px"><select class="mea-in" id="bl-period-y" onchange="billPeriodChanged()" style="flex:1">${_periodYearOptions(U.curPeriod())}</select><select class="mea-in" id="bl-period-m" onchange="billPeriodChanged()" style="flex:1">${_periodMonthOptions(U.curPeriod())}</select></div></div>
          <div class="mea-hcell"><span class="mea-hlabel">\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e08\u0e14\u0e2b\u0e19\u0e48\u0e27\u0e22 (Meter Reading Date)</span><input class="mea-in" id="bl-reading_date" type="date" onchange="billReadingDateChanged()"></div>
          <div class="mea-hcell"><span class="mea-hlabel">\u0e40\u0e25\u0e02\u0e2d\u0e48\u0e32\u0e19\u0e04\u0e23\u0e31\u0e49\u0e07\u0e19\u0e35\u0e49 (Present)</span><input class="mea-in mea-num" id="bl-present_reading" type="number" step="any" oninput="billRecalcUnits()"></div>
          <div class="mea-hcell"><span class="mea-hlabel">\u0e40\u0e25\u0e02\u0e2d\u0e48\u0e32\u0e19\u0e04\u0e23\u0e31\u0e49\u0e07\u0e01\u0e48\u0e2d\u0e19 (Previous) <span class="text-muted" id="bl-prevnote" style="text-transform:none"></span></span><input class="mea-in mea-num" id="bl-prev_reading" type="number" step="any" oninput="billRecalcUnits()"></div>
          <div class="mea-hcell"><span class="mea-hlabel">\u0e2b\u0e19\u0e48\u0e27\u0e22 (kWh)</span><input class="mea-in mea-num mea-strong" id="bl-units_used" type="number" step="any" readonly></div>
          <div class="mea-hcell"><span class="mea-hlabel">Ft (\u0e3f/\u0e2b\u0e19\u0e48\u0e27\u0e22)</span><input class="mea-in mea-num" id="bl-ft_rate" type="number" step="any" value="${_billRates?_billRates.ft_rate:''}" oninput="billRecalcTotal()"></div>
          <div class="mea-hcell"><span class="mea-hlabel">Payment Deadline</span><input class="mea-in" id="bl-due_date" type="date" oninput="billRecalcTotal()"></div>
        </div>

        <!-- BODY: left = charge description, center = tiered energy, right = amount box -->
        <div class="mea-body">
          <div id="mea-elec-cols" style="display:contents">
          <!-- LEFT: description of charges (orange header) -->
          <div class="mea-desc">
            <div class="mea-sec-h">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e1f\u0e49\u0e32 (Description)</div>
            <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e44\u0e1f\u0e1f\u0e49\u0e32</span><span class="mea-num" id="bl-energy_charge_disp">-</span></div>
            <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23</span>
              <input class="mea-in mea-num mea-inline-amt" id="bl-service_fee" type="number" step="any" value="${_billRates?_billRates.service_fee:''}" oninput="billRecalcTotal()"></div>
            <div class="mea-drow mea-sub"><span>\u0e23\u0e27\u0e21\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e1f\u0e49\u0e32\u0e41\u0e25\u0e30\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23</span><span class="mea-num" id="bl-sum_es_disp">-</span></div>
            <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e1f\u0e49\u0e32\u0e1c\u0e31\u0e19\u0e41\u0e1b\u0e23 (Ft) <span class="text-muted" id="bl-ft_calcnote" style="font-size:9px"></span></span><span class="mea-num" id="bl-ft_disp">-</span></div>
            <div class="mea-drow mea-sub"><span>\u0e23\u0e27\u0e21\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e1f\u0e49\u0e32\u0e01\u0e48\u0e2d\u0e19\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21</span><span class="mea-num" id="bl-prevat_disp">-</span></div>
            <div class="mea-drow"><span>\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21 7%</span><span class="mea-num" id="bl-vat_disp">-</span></div>
            <div class="mea-drow mea-grand"><span>\u0e23\u0e27\u0e21\u0e40\u0e07\u0e34\u0e19\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e0a\u0e33\u0e23\u0e30\u0e17\u0e31\u0e49\u0e07\u0e2a\u0e34\u0e49\u0e19</span><span class="mea-num" id="bl-total_disp">-</span></div>
          </div>

          <!-- CENTER: tiered energy detail -->
          <div class="mea-tier">
            <div class="mea-center-title">*\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e44\u0e1f\u0e1f\u0e49\u0e32*</div>
            <div class="mea-emode">
              <label><input type="radio" name="bl-emode" value="tiered" checked onchange="billEnergyMode()"> tiered auto</label>
              <label><input type="radio" name="bl-emode" value="manual" onchange="billEnergyMode()"> manual</label>
            </div>
            <div id="bl-tiered-box"></div>
            <div id="bl-manual-box" style="display:none;margin-top:6px">
              <label style="font-size:10px;color:var(--text3)">\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e44\u0e1f\u0e1f\u0e49\u0e32 total (\u0e3f)</label>
              <input class="mea-in mea-num" id="bl-energy_manual" type="number" step="any" oninput="billRecalcTotal()" style="width:100%">
            </div>
          </div>

          </div>
          <!-- WATER: MWA-style description (blue), shown when meter type = water -->
          <div id="mea-water-cols" style="display:none;grid-column:1/3">
            <div class="mea-desc mea-water-desc">
              <div class="mea-sec-h mea-sec-water">\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e04\u0e48\u0e32\u0e19\u0e49\u0e33 (Water charges)</div>
              <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e19\u0e49\u0e33\u0e14\u0e34\u0e1a (Raw water)</span>
                <input class="mea-in mea-num mea-inline-amt" id="bl-w_raw" type="number" step="any" oninput="billRecalcTotal()"></div>
              <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e19\u0e49\u0e33\u0e1b\u0e23\u0e30\u0e1b\u0e32 (Water charge)</span>
                <input class="mea-in mea-num mea-inline-amt" id="bl-w_charge" type="number" step="any" oninput="billRecalcTotal()"></div>
              <div class="mea-drow"><span>\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 (Service)</span>
                <input class="mea-in mea-num mea-inline-amt" id="bl-w_service" type="number" step="any" oninput="billRecalcTotal()"></div>
              <div class="mea-drow"><span>\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14 (Discount)</span>
                <input class="mea-in mea-num mea-inline-amt" id="bl-w_discount" type="number" step="any" oninput="billRecalcTotal()"></div>
              <div class="mea-drow mea-sub"><span>\u0e22\u0e2d\u0e14\u0e01\u0e48\u0e2d\u0e19\u0e20\u0e32\u0e29\u0e35 (Before VAT)</span><span class="mea-num" id="bl-w_prevat_disp">-</span></div>
              <div class="mea-drow"><span>\u0e20\u0e32\u0e29\u0e35\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21 7%</span><span class="mea-num" id="bl-w_vat_disp">-</span></div>
              <div class="mea-drow mea-grand mea-grand-water"><span>\u0e23\u0e27\u0e21\u0e17\u0e31\u0e49\u0e07\u0e2a\u0e34\u0e49\u0e19 (Total)</span><span class="mea-num" id="bl-w_total_disp">-</span></div>
            </div>
          </div>
          <!-- RIGHT: amount box (orange, prominent) -->
          <div class="mea-amtbox">
            <div class="mea-amt-due">
              <div class="mea-amt-lbl">\u0e42\u0e1b\u0e23\u0e14\u0e0a\u0e33\u0e23\u0e30\u0e20\u0e32\u0e22\u0e43\u0e19\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48<br><span style="font-size:8px;opacity:.8">Payment Due Date</span></div>
              <div class="mea-amt-val" id="bl-due_disp">-</div>
            </div>
            <div class="mea-amt-total">
              <div class="mea-amt-lbl">\u0e23\u0e27\u0e21\u0e40\u0e07\u0e34\u0e19\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e0a\u0e33\u0e23\u0e30<br><span style="font-size:8px;opacity:.8">Amount</span></div>
              <div class="mea-amt-big" id="bl-total_disp2">-</div>
            </div>
          </div>
        </div>

        <!-- Hidden real inputs the calc engine reads/writes (kept for logic compatibility) -->
        <div style="display:none">
          <input id="bl-ft" type="number">
          <input id="bl-vat" type="number">
          <input id="bl-total_amount" type="number">
        </div>

        <!-- Paid + notes row -->
        <div class="mea-foot">
          <div class="mea-fcell"><label>Paid?</label><select class="inp" id="bl-paid"><option value="">unpaid</option><option value="1">paid</option></select></div>
          <div class="mea-fcell"><label>Paid Date</label><input class="inp" id="bl-paid_date" type="date"></div>
          <div class="mea-fcell" style="flex:1"><label>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38 / Notes</label><input class="inp" id="bl-notes" style="width:100%"></div>
        </div>
      </div>

      <!-- ===== Split zone (central vs home) - separate section below the bill ===== -->
      <div style="margin-top:6px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;text-transform:none;font-size:11px;color:var(--text)">
          <input type="checkbox" id="bl-split" onchange="billSplitToggled()" style="width:auto"> \u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e1e\u0e48\u0e27\u0e07 (\u0e44\u0e1f\u0e01\u0e25\u0e32\u0e07\u0e23\u0e27\u0e21\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e1a\u0e34\u0e25\u0e19\u0e35\u0e49)
        </label>
      </div>
      <div id="bl-split-wrap" style="display:none">
        <div class="mea-splitcard">
          <div class="mea-sec-h" style="border-radius:6px 6px 0 0">\u0e01\u0e32\u0e23\u0e41\u0e1a\u0e48\u0e07 \u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 / \u0e44\u0e1f\u0e1a\u0e49\u0e32\u0e19</div>
          <div class="mea-split-in">
            <div class="mea-hcell"><span class="mea-hlabel">Central Present (\u0e04\u0e23\u0e31\u0e49\u0e07\u0e19\u0e35\u0e49)</span><input class="mea-in mea-num" id="bl-central_present" type="number" step="any" oninput="billRecalcSplit()"></div>
            <div class="mea-hcell"><span class="mea-hlabel">Central Prev (\u0e04\u0e23\u0e31\u0e49\u0e07\u0e01\u0e48\u0e2d\u0e19) <span class="text-muted" id="bl-cprevnote" style="text-transform:none"></span></span><input class="mea-in mea-num" id="bl-central_prev" type="number" step="any" oninput="billRecalcSplit()"></div>
            <div class="mea-hcell"><span class="mea-hlabel">Central Units</span><input class="mea-in mea-num mea-strong" id="bl-central_units" type="number" step="any" readonly></div>
          </div>
          <div id="bl-split-summary" style="padding:8px 10px;font-size:11px;line-height:1.8"></div>
        </div>
      </div>

      <!-- Receipt filing -->
      <div class="card" style="background:var(--bg3);margin-top:10px">
        <h2 style="font-size:12px"><i class="fa-solid fa-folder-open"></i> Receipt / Slip filing</h2>
        <div class="flex gap-2 flex-wrap" style="align-items:end">
          <div class="form-group" style="flex:1;min-width:280px"><label>Recommended path</label><input class="inp" id="bl-receipt_path" placeholder="receipts/electricity/2026/09/..."></div>
          <button class="btn btn-ghost" onclick="billSuggestPath()"><i class="fa-solid fa-wand-magic-sparkles"></i> Suggest path</button>
          <button class="btn btn-ghost" onclick="billCopyPath()"><i class="fa-solid fa-copy"></i> Copy</button>
        </div>
      </div>
      <div class="flex gap-2" style="margin-top:10px">
        <button class="btn btn-primary" id="bl-save" onclick="saveBill()"><i class="fa-solid fa-plus"></i> Add Bill</button>
        <button class="btn btn-ghost" onclick="clearBillForm()" title="\u0e25\u0e49\u0e32\u0e07\u0e1f\u0e2d\u0e23\u0e4c\u0e21 / \u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02"><i class="fa-solid fa-xmark"></i> Clear / Cancel</button>
      </div>
      <input type="hidden" id="bl-edit-id" value="">
      `
      : `<p class="text-muted" style="padding:8px">No meters registered yet. Go to the <b>Meters</b> tab and register your common-area meters first - then recording each month's bill takes just a few numbers.</p>`}
    </div>

    <div class="card">
      <h2><i class="fa-solid fa-list"></i> Utility Bills</h2>
      ${bills.length?`<table class="tbl"><thead><tr><th>Meter</th><th>Period</th><th class="r">Units</th><th class="r">Total</th><th>Deadline</th><th>Status</th><th class="r">Slip</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                    :`<p class="text-muted" style="padding:8px">No bills yet.</p>`}
    </div>`;

  if(meters.length){
    meterPicked();
    // On a fresh (non-edit) form, seed the reading-date/deadline defaults from the period
    if(!document.getElementById('bl-edit-id').value){ billPeriodChanged(); }
  }
}

/* When a meter is picked: show its fixed info + carry previous reading from its most recent bill. */
/* Carry the previous readings from the meter's most recent bill into the form.
   main Prev <- last bill present_reading; central Prev <- last split bill central_present.
   Called on meter pick AND on period change (new bills only). */
/* Set the save button label to match edit vs add state. */
function _setBillSaveBtn(){
  var eid=document.getElementById('bl-edit-id'); var btn=document.getElementById('bl-save');
  if(!btn) return;
  var editing = eid && eid.value;
  btn.innerHTML = editing ? '<i class="fa-solid fa-check"></i> Update Bill' : '<i class="fa-solid fa-plus"></i> Add Bill';
}
async function _carryPrevReadings(meterId, D){
  meterId = meterId || (document.getElementById('bl-meter_id')||{}).value;
  if(!meterId) return;
  if(!D){ D = await window.CM_REPO.all(); }
  // The "previous reading" must come from the bill of the period IMMEDIATELY BEFORE the
  // currently-selected period (not just the globally-latest bill), so changing month updates it.
  var _selPeriod = (typeof _billPeriodValue==='function') ? _billPeriodValue() : '';
  var _allForMeter = (D.utility_bills||[]).filter(b=>b.meter_id===meterId);
  const prior = _allForMeter
      .filter(b => !_selPeriod || (b.period||'') < _selPeriod)   // strictly before selected period
      .sort((a,b)=>(b.period||'').localeCompare(a.period||''));
  const prevEl=document.getElementById('bl-prev_reading');
  const note=document.getElementById('bl-prevnote');
  const presEl=document.getElementById('bl-present_reading');
  if(prior.length && prevEl){
    prevEl.value = prior[0].present_reading || '';
    if(note) note.textContent = '(carried from '+ (prior[0].period||'last bill') +')';
  } else {
    // No prior bill -> clear the main readings so stale numbers don't linger
    if(prevEl) prevEl.value='';
    if(presEl) presEl.value='';
    if(note) note.textContent='(no previous bill)';
  }
  const cprevEl=document.getElementById('bl-central_prev');
  const cpresEl=document.getElementById('bl-central_present');
  const cnote=document.getElementById('bl-cprevnote');
  const priorSplit = prior.filter(b=>b.split_meter && b.central_present!=null);
  if(priorSplit.length && cprevEl){
    cprevEl.value = priorSplit[0].central_present || '';
    if(cnote) cnote.textContent = '(carried from '+ (priorSplit[0].period||'last bill') +')';
  } else {
    // No prior split bill -> clear central readings too
    if(cprevEl) cprevEl.value='';
    if(cpresEl) cpresEl.value='';
    if(cnote) cnote.textContent='';
  }
  billRecalcUnits();
  billRecalcSplit();
}
async function meterPicked(){
  const D = await window.CM_REPO.all();
  const id = document.getElementById('bl-meter_id').value;
  const m = (D.meters||[]).find(x=>x.id===id);
  const info = document.getElementById('bl-meterinfo');
  const editing = document.getElementById('bl-edit-id').value;
  // Toggle electricity vs water bill layout based on the meter's utility type
  var _isWater = !!(m && m.utility_type==='water');
  var _billEl=document.querySelector('.mea-bill');
  if(_billEl) _billEl.classList.toggle('mea-bill-water', _isWater);
  var _ec=document.getElementById('mea-elec-cols'); if(_ec) _ec.style.display=_isWater?'none':'contents';
  var _wc=document.getElementById('mea-water-cols'); if(_wc) _wc.style.display=_isWater?'':'none';
  // Ft header cell is meaningless for water -> hide it
  var _ftCell=document.getElementById('bl-ft_rate'); if(_ftCell&&_ftCell.closest('.mea-hcell')) _ftCell.closest('.mea-hcell').style.display=_isWater?'none':'';
  window._billIsWater=_isWater;
  if(m && info){
    const bits=[];
    if(m.meter_no) bits.push('Meter '+U.esc(m.meter_no));
    if(m.reference_no) bits.push('Ref '+U.esc(m.reference_no));
    if(m.provider) bits.push(U.esc(m.provider));
    info.innerHTML = '<i class="fa-solid fa-circle-info"></i> '+ (bits.join(' &middot; ')||'no fixed info on this meter');
  }
  // Carry previous readings (main + central) from the most recent bill - new bills only.
  if(!editing){ await _carryPrevReadings(id, D); }
  // Always refresh totals so the (elec or water) bill panel populates on meter switch
  billRecalcTotal();
  _setBillSaveBtn();
}

/* Build <option> months for the Period dropdown: 24 months back .. 12 forward.
   `sel` = currently-selected YYYY-MM (marked selected). */
function _periodYearOptions(sel){
  var selY=(sel||'').split('-')[0];
  var nowY=new Date().getFullYear(); var opts='';
  for(var y=nowY+1; y>=nowY-3; y--){ opts+='<option value="'+y+'"'+(String(y)===selY?' selected':'')+'>'+y+'</option>'; }
  return opts;
}
function _periodMonthOptions(sel){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var selM=(sel||'').split('-')[1]||''; var opts='';
  for(var m=1;m<=12;m++){ var mm=(m<10?'0':'')+m; opts+='<option value="'+mm+'"'+(mm===selM?' selected':'')+'>'+mm+' '+MON[m-1]+'</option>'; }
  return opts;
}
/* Combine the two selects into 'YYYY-MM'. */
function _billPeriodValue(){
  var y=document.getElementById('bl-period-y'), m=document.getElementById('bl-period-m');
  if(!y||!m) return U.curPeriod();
  return y.value+'-'+m.value;
}
/* Split a 'YYYY-MM' into the two selects (falls back to current period). */
function _setBillPeriod(val){
  var s=(val||U.curPeriod()).split('-'); var y=document.getElementById('bl-period-y'), m=document.getElementById('bl-period-m');
  if(y&&s[0]) y.value=s[0];
  if(m&&s[1]) m.value=s[1];
}
/* When the meter reading date is picked, default the payment deadline to the
   14th of the SAME month (overwritable). Only fills if deadline is empty or
   was itself an auto-set 14th, so a manual deadline the user typed is kept. */
/* When Period changes, default the meter reading date to the 2nd of the month
   AFTER the period (period 2026-09 -> reading 2026-10-02), then chain to deadline.
   Only fills when reading date is empty or was our own auto value (keeps manual edits). */
function billPeriodChanged(){
  // Re-carry previous readings whenever the period changes (new bills only).
  var _eid=document.getElementById('bl-edit-id'); if(!_eid||!_eid.value){ _carryPrevReadings(); }
  var pv=_billPeriodValue(); var rd=document.getElementById('bl-reading_date');
  if(!pv||!rd){ billRecalcTotal(); return; }
  var prev=rd.value; var autoPrev=rd.getAttribute('data-auto2')||'';
  if(!prev || prev===autoPrev){
    var p=pv.split('-'); // YYYY-MM
    if(p.length>=2){
      var y=parseInt(p[0],10), m=parseInt(p[1],10); // m = 1..12 (period month)
      var ny=y, nm=m+1; if(nm>12){ nm=1; ny=y+1; } // month AFTER period
      var iso=ny+'-'+(nm<10?'0':'')+nm+'-02';
      rd.value=iso; rd.setAttribute('data-auto2', iso);
      billReadingDateChanged(); // chains deadline (14th of that month)
      return;
    }
  }
  billReadingDateChanged();
}
function billReadingDateChanged(){
  var rd=document.getElementById('bl-reading_date'); var dl=document.getElementById('bl-due_date');
  if(!rd||!dl||!rd.value) { billRecalcTotal(); return; }
  var prev=dl.value;
  var autoPrev=dl.getAttribute('data-auto14')||'';
  // fill when empty, or when the existing value was our own auto-14 (so re-picking updates it)
  if(!prev || prev===autoPrev){
    var p=rd.value.split('-'); // YYYY-MM-DD
    if(p.length===3){
      var iso=p[0]+'-'+p[1]+'-14';
      dl.value=iso; dl.setAttribute('data-auto14', iso);
    }
  }
  billRecalcTotal();
}
function billRecalcUnits(){
  const prev=parseFloat(document.getElementById('bl-prev_reading').value)||0;
  const pres=parseFloat(document.getElementById('bl-present_reading').value)||0;
  const u=Math.max(0,pres-prev);
  document.getElementById('bl-units_used').value=u?u:'';
  billRenderTiers();
  billRecalcTotal();
}
/* Which energy-entry mode is selected (tiered auto vs manual). */
function billEnergyMode(){
  const sel = document.querySelector('input[name="bl-emode"]:checked');
  const mode = sel ? sel.value : 'tiered';
  const tb=document.getElementById('bl-tiered-box'), mb=document.getElementById('bl-manual-box');
  if(tb) tb.style.display = (mode==='tiered') ? '' : 'none';
  if(mb) mb.style.display = (mode==='manual') ? '' : 'none';
  if(mode==='tiered') billRenderTiers();
  billRecalcTotal();
}
/* Render the tiered energy breakdown from the current units + the tariff (_billTariff). */
function billRenderTiers(){
  const box=document.getElementById('bl-tiered-box');
  const sel=document.querySelector('input[name="bl-emode"]:checked');
  if(!box || (sel && sel.value!=='tiered')) return;
  const units=parseFloat(document.getElementById('bl-units_used').value)||0;
  const res=U.calcTiered(units, _billTariff);
  if(!units){ box.innerHTML='<span class="text-muted" style="font-size:10px">Enter readings to see the tiered breakdown.</span>'; return; }
  const rows=res.breakdown.map(function(b){
    return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0">'
      + '<span>units '+U.esc(b.label)+' &times; '+U.fmtNum(b.rate)+'</span>'
      + '<span>'+U.fmtMoney(b.amount)+'</span></div>';
  }).join('');
  box.innerHTML = rows + '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:11px;border-top:1px solid var(--border);margin-top:3px;padding-top:3px"><span>Energy total</span><span>'+U.fmtMoney(res.total)+'</span></div>';
}
/* Master recompute: energy (tiered or manual) -> Ft (rate x units) -> VAT 7% -> total. */
/* Water (MWA) total: raw + charge + service - discount -> VAT% -> total.
   Writes the same hidden calc inputs (bl-total_amount etc.) so save/reports work,
   and fills the water display cells + the shared amount box. */
function billRecalcWater(){
  var num=function(id){var e=document.getElementById(id);return e?(parseFloat(e.value)||0):0;};
  var raw=num('bl-w_raw'), charge=num('bl-w_charge'), service=num('bl-w_service'), disc=num('bl-w_discount');
  var base=raw+charge+service-disc;
  var vatPct=(_billRates&&_billRates.vat_pct!=null)?_billRates.vat_pct:7;
  var vat=+(base*(vatPct/100)).toFixed(2);
  var total=+(base+vat).toFixed(2);
  // write hidden calc inputs used by saveBill/reports (energy_charge carries water charge, ft=0)
  var setv=function(id,v){var e=document.getElementById(id); if(e) e.value=(v?v:'');};
  setv('bl-energy_charge', charge+raw); setv('bl-service_fee_hidden', service); setv('bl-ft', 0);
  setv('bl-vat', vat); setv('bl-total_amount', total);
  var _b=function(n){return '\u0e3f'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var _set=function(id,val){var e=document.getElementById(id); if(e) e.textContent=val;};
  _set('bl-w_prevat_disp', _b(base)); _set('bl-w_vat_disp', _b(vat)); _set('bl-w_total_disp', _b(total));
  _set('bl-total_disp2', _b(total));
  var _dd=document.getElementById('bl-due_date'); var _ddv=_dd&&_dd.value?_dd.value:'';
  _set('bl-due_disp', _ddv?(function(iso){var p=iso.split('-');return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):iso;})(_ddv):'-');
  billRecalcSplit();
}
function billRecalcTotal(){
  if(window._billIsWater){ return billRecalcWater(); }
  const units=parseFloat(document.getElementById('bl-units_used').value)||0;
  const sel=document.querySelector('input[name="bl-emode"]:checked');
  const mode=sel?sel.value:'tiered';
  let energy=0;
  if(mode==='tiered'){ energy=U.calcTiered(units, _billTariff).total; }
  else { energy=parseFloat(document.getElementById('bl-energy_manual').value)||0; }
  const ec=document.getElementById('bl-energy_charge'); if(ec) ec.value = energy?energy:'';
  const service=parseFloat(document.getElementById('bl-service_fee').value)||0;
  const ftRate=parseFloat(document.getElementById('bl-ft_rate').value)||0;
  const ftAmt=+(ftRate*units).toFixed(2);
  const fte=document.getElementById('bl-ft'); if(fte) fte.value = ftAmt?ftAmt:'';
  const base=energy+service+ftAmt;
  const vatPct = (_billRates && _billRates.vat_pct!=null) ? _billRates.vat_pct : 7;
  const vat=+(base*(vatPct/100)).toFixed(2);
  const ve=document.getElementById('bl-vat'); if(ve) ve.value = vat?vat:'';
  const total=+(base+vat).toFixed(2);
  const te=document.getElementById('bl-total_amount'); if(te) te.value = total?total:'';
  // ---- populate MEA-bill display cells (read-only, formatted) ----
  var _b=function(n){return '\u0e3f'+ (Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var _set=function(id,val){var e=document.getElementById(id); if(e) e.textContent=val;};
  _set('bl-energy_charge_disp', _b(energy));
  _set('bl-sum_es_disp', _b(energy+service));
  _set('bl-ft_disp', _b(ftAmt));
  _set('bl-ft_calcnote', (units&&ftRate)? ('('+ftRate+' \u00d7 '+U.fmtNum(units)+')') : '');
  _set('bl-prevat_disp', _b(base));
  _set('bl-vat_disp', _b(vat));
  _set('bl-total_disp', _b(total));
  _set('bl-total_disp2', _b(total));
  // due date box mirrors the payment-deadline field
  var _dd=document.getElementById('bl-due_date'); var _ddv=_dd&&_dd.value?_dd.value:'';
  _set('bl-due_disp', _ddv? (function(iso){var p=iso.split('-');return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):iso;})(_ddv) : '-');
  billRecalcSplit();
}

/* ---- Split-meter (piggybacked central sub-meter) ---- */
function billSplitToggled(){
  const on = document.getElementById('bl-split').checked;
  const wrap = document.getElementById('bl-split-wrap');
  if(wrap) wrap.style.display = on ? '' : 'none';
  billRecalcSplit();
}
/* Recompute central vs home split using the blended (average) rate.
   avg rate = total bill / total units (home main meter).
   central amount = central units * avg rate ; home amount = remaining. */
function billRecalcSplit(){
  var on = document.getElementById('bl-split') && document.getElementById('bl-split').checked;
  var box = document.getElementById('bl-split-summary');
  var cprev=parseFloat((document.getElementById('bl-central_prev')||{}).value)||0;
  var cpres=parseFloat((document.getElementById('bl-central_present')||{}).value)||0;
  var cunits=Math.max(0,cpres-cprev);
  var cu=document.getElementById('bl-central_units'); if(cu) cu.value = cunits?cunits:'';
  if(!on || !box) return;
  var totalUnits=parseFloat((document.getElementById('bl-units_used')||{}).value)||0;
  var energy=parseFloat((document.getElementById('bl-energy_charge')||{}).value)||0;
  if(!energy && totalUnits>0){
    var _sel=document.querySelector('input[name="bl-emode"]:checked');
    if(_sel && _sel.value==='manual'){ energy=parseFloat((document.getElementById('bl-energy_manual')||{}).value)||0; }
    else { energy=U.calcTiered(totalUnits, _billTariff).total||0; }
  }
  var ftRate=parseFloat((document.getElementById('bl-ft_rate')||{}).value)||0;
  var vatPct=(_billRates && _billRates.vat_pct!=null) ? _billRates.vat_pct : 7;
  // ALWAYS render the step-by-step breakdown. Missing inputs show '-' instead of hiding the whole box.
  var ready = (totalUnits>0 && energy>0);
  var eRate = ready ? energy/totalUnits : 0;
  var homeUnits=Math.max(0,totalUnits-cunits);
  var cEnergy=+(cunits*eRate).toFixed(2);
  var cFt=+(cunits*ftRate).toFixed(2);
  var cPreVat=+(cEnergy+cFt).toFixed(2);
  var cVat=+(cPreVat*(vatPct/100)).toFixed(2);
  var centralAmt=+(cPreVat+cVat).toFixed(2);
  var M=function(n){return U.fmtMoney(n);};
  var dash=function(ok,val){return ok?val:'-';};
  var _rows=function(items){ return items.map(function(it){ return '<div style="display:flex;justify-content:space-between;gap:12px;'+(it.strong?'font-weight:700;border-top:1px solid var(--border2);margin-top:3px;padding-top:3px':'')+'"><span>'+it.k+'</span><span class="mea-num">'+it.v+'</span></div>'; }).join(''); };
  var _hdr='<div class="mea-sec-h" style="font-size:11px;border-radius:0">\u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14\u0e04\u0e48\u0e32\u0e44\u0e1f\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 \u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e1e\u0e48\u0e27\u0e07</div>';
  var _need = ready ? '' : '<div class="text-muted" style="font-size:10px;padding:2px 0 6px">\u0e01\u0e23\u0e2d\u0e01\u0e40\u0e25\u0e02\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e2b\u0e25\u0e31\u0e01 (\u0e04\u0e23\u0e31\u0e49\u0e07\u0e01\u0e48\u0e2d\u0e19/\u0e04\u0e23\u0e31\u0e49\u0e07\u0e19\u0e35\u0e49) \u0e01\u0e48\u0e2d\u0e19 \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e04\u0e33\u0e19\u0e27\u0e13\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19</div>';
  var _items=[];
  _items.push({k:'1. \u0e2d\u0e31\u0e15\u0e23\u0e32\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19 = '+dash(ready,M(energy))+' \u00f7 '+dash(totalUnits>0,U.fmtNum(totalUnits))+' \u0e2b\u0e19\u0e48\u0e27\u0e22', v:dash(ready,M(eRate)+' /\u0e2b\u0e19\u0e48\u0e27\u0e22')});
  _items.push({k:'2. \u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 = '+dash(ready,M(eRate))+' \u00d7 '+U.fmtNum(cunits)+' \u0e2b\u0e19\u0e48\u0e27\u0e22', v:dash(ready,M(cEnergy))});
  _items.push({k:'3. Ft \u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 = '+ftRate+' \u00d7 '+U.fmtNum(cunits)+' \u0e2b\u0e19\u0e48\u0e27\u0e22', v:M(cFt)});
  _items.push({k:'4. \u0e23\u0e27\u0e21\u0e01\u0e48\u0e2d\u0e19 VAT = \u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19+Ft', v:dash(ready,M(cPreVat))});
  _items.push({k:'5. VAT '+vatPct+'%', v:dash(ready,M(cVat))});
  _items.push({k:'\u0e23\u0e27\u0e21\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 = \u0e04\u0e48\u0e32\u0e43\u0e0a\u0e49\u0e08\u0e48\u0e32\u0e22\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07', v:dash(ready,M(centralAmt)), strong:true});
  var warn='';
  if(cunits>totalUnits && totalUnits>0) warn='<div class="text-error" style="font-size:10px;margin-top:4px">\u26a0 \u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e25\u0e32\u0e07\u0e21\u0e32\u0e01\u0e01\u0e27\u0e48\u0e32\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e23\u0e27\u0e21</div>';
  box.innerHTML=_hdr + _need + _rows(_items)
    + '<div class="text-muted" style="font-size:10px;margin-top:5px">\u0e44\u0e1f\u0e1a\u0e49\u0e32\u0e19 '+dash(ready,U.fmtNum(homeUnits))+' \u0e2b\u0e19\u0e48\u0e27\u0e22 \u0e23\u0e31\u0e1a\u0e2a\u0e48\u0e27\u0e19\u0e17\u0e35\u0e48\u0e40\u0e2b\u0e25\u0e37\u0e2d \u0e23\u0e27\u0e21\u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23</div>'
    + warn;
}

async function billSuggestPath(){
  const D=await window.CM_REPO.all();
  const m=(D.meters||[]).find(x=>x.id===document.getElementById('bl-meter_id').value);
  const type=m?m.utility_type:'other';
  const period=_billPeriodValue();
  const ref=m?(m.reference_no||m.meter_no):'';
  const t=U.receiptTarget(type, period, [type, ref, period], 'jpg');
  document.getElementById('bl-receipt_path').value=t.path;
  U.toast('Path suggested - save your file there');
}
function billCopyPath(){
  const v=document.getElementById('bl-receipt_path').value;
  if(!v){ U.toast('Nothing to copy'); return; }
  navigator.clipboard && navigator.clipboard.writeText(v);
  U.toast('Path copied');
}

function _readBillForm(){
  const g=id=>{var e=document.getElementById(id);return e?String(e.value).trim():'';};
  const n=id=>{var e=document.getElementById(id);return e?(parseFloat(e.value)||0):0;};
  const rec = {
    meter_id: g('bl-meter_id'),
    period: _billPeriodValue(),
    reading_date: g('bl-reading_date')||'',   /* native date input = YYYY-MM-DD already */
    due_date: g('bl-due_date')||'',
    prev_reading:n('bl-prev_reading'), present_reading:n('bl-present_reading'), units_used:n('bl-units_used'),
    energy_charge:n('bl-energy_charge'), service_fee:n('bl-service_fee'),
    ft_rate:n('bl-ft_rate'), ft:n('bl-ft'), vat:n('bl-vat'), total_amount:n('bl-total_amount'),
    paid:!!g('bl-paid'), paid_date:g('bl-paid_date')||'',
    receipt_path:g('bl-receipt_path'), notes:g('bl-notes')
  };
  rec.is_water = !!window._billIsWater;
  if(rec.is_water){
    rec.w_raw=n('bl-w_raw'); rec.w_charge=n('bl-w_charge'); rec.w_service=n('bl-w_service'); rec.w_discount=n('bl-w_discount');
    rec.service_fee=rec.w_service;
  }
  const emode = document.querySelector('input[name="bl-emode"]:checked');
  rec.energy_mode = emode ? emode.value : 'tiered';
  if(rec.energy_mode==='manual') rec.energy_manual = n('bl-energy_manual');
  // Split-meter: compute central vs home using the blended average rate.
  const split = document.getElementById('bl-split') && document.getElementById('bl-split').checked;
  rec.split_meter = !!split;
  if(split){
    rec.bill_total = rec.total_amount;                 // full MEA bill (reference)
    rec.central_prev = n('bl-central_prev');
    rec.central_present = n('bl-central_present');
    rec.central_units = Math.max(0, rec.central_present - rec.central_prev);
    const totalUnits = rec.units_used;
    let energy = rec.energy_charge || 0;
    if(!energy && totalUnits>0){
      energy = (rec.energy_mode==='manual')
        ? (parseFloat((document.getElementById('bl-energy_manual')||{}).value)||0)
        : (U.calcTiered(totalUnits, _billTariff).total||0);
      rec.energy_charge = energy;
    }
    const ftRate = rec.ft_rate || 0;
    const vatPct = (_billRates && _billRates.vat_pct!=null) ? _billRates.vat_pct : 7;
    // Split method: energy charge / units -> central energy; + Ft (by units); + VAT. Service fee stays fully on home.
    const eRate = totalUnits>0 ? energy/totalUnits : 0;
    rec.avg_rate = eRate;                              // now = energy rate/unit (excl. service)
    rec.home_units = Math.max(0, totalUnits - rec.central_units);
    const cEnergy = +(rec.central_units * eRate).toFixed(2);
    const cFt = +(rec.central_units * ftRate).toFixed(2);
    const cPreVat = +(cEnergy + cFt).toFixed(2);
    const cVat = +(cPreVat * (vatPct/100)).toFixed(2);
    rec.central_energy = cEnergy;
    rec.central_ft = cFt;
    rec.central_vat = cVat;
    rec.central_amount = +(cPreVat + cVat).toFixed(2);
    // Home portion (reference/display): remainder energy + Ft + service -> VAT
    const hEnergy = +(rec.home_units * eRate).toFixed(2);
    const hFt = +(rec.home_units * ftRate).toFixed(2);
    const hService = rec.service_fee || 0;
    const hPreVat = +(hEnergy + hFt + hService).toFixed(2);
    const hVat = +(hPreVat * (vatPct/100)).toFixed(2);
    rec.home_amount = +(hPreVat + hVat).toFixed(2);
    // Only the CENTRAL portion is the common-area expense that Reports/Dashboard sum.
    rec.total_amount = rec.central_amount;
  }
  return rec;
}

async function saveBill(){
  const repo=window.CM_REPO;
  const rec=_readBillForm();
  if(!rec.meter_id){ U.toast('Pick a meter'); return; }
  if(!rec.period){ U.toast('Period (YYYY-MM) required'); return; }
  // Denormalise meter's fixed info onto the bill (so reports & Phase 2 export are self-contained).
  const D=await repo.all();
  const m=(D.meters||[]).find(x=>x.id===rec.meter_id);
  if(m){
    rec.purpose=m.purpose; rec.utility_type=m.utility_type; rec.provider=m.provider;
    rec.meter_no=m.meter_no; rec.reference_no=m.reference_no;
  }
  const editId=document.getElementById('bl-edit-id').value;
  if(editId){ await repo.update('utility_bills', editId, rec); U.toast('Bill updated'); }
  else { await repo.add('utility_bills', rec); U.toast('Bill added'); }
  // clear the edit state FIRST (so renderBills seeds a fresh form), then re-render the list from updated data
  clearBillForm();
  await renderBills();
}

async function editBill(id){
  const b=await window.CM_REPO.get('utility_bills', id);
  if(!b) return;
  const s=(k,v)=>{const e=document.getElementById(k); if(e) e.value=(v==null?'':v);};
  document.getElementById('bl-edit-id').value=id;   // set FIRST so meterPicked won't carry-over
  s('bl-meter_id', b.meter_id);
  _setBillPeriod(b.period); s('bl-reading_date',b.reading_date||''); s('bl-due_date',b.due_date||'');
  s('bl-w_raw',b.w_raw||''); s('bl-w_charge',b.w_charge||''); s('bl-w_service',b.w_service||''); s('bl-w_discount',b.w_discount||'');
  s('bl-prev_reading',b.prev_reading||''); s('bl-present_reading',b.present_reading||''); s('bl-units_used',b.units_used||'');
  s('bl-energy_charge',b.energy_charge||''); s('bl-service_fee',b.service_fee||'');
  s('bl-ft_rate',b.ft_rate||''); s('bl-ft',b.ft||''); s('bl-vat',b.vat||''); s('bl-total_amount',b.total_amount||'');
  s('bl-energy_manual', b.energy_manual||'');
  // restore energy entry mode radio
  const emode = (b.energy_mode==='manual') ? 'manual' : 'tiered';
  const radio = document.querySelector('input[name="bl-emode"][value="'+emode+'"]');
  if(radio){ radio.checked = true; billEnergyMode(); }
  s('bl-paid',b.paid?'1':''); s('bl-paid_date',b.paid_date||'');
  s('bl-receipt_path',b.receipt_path); s('bl-notes',b.notes);
  // restore split-meter state
  const splitBox=document.getElementById('bl-split');
  if(splitBox){
    splitBox.checked = !!b.split_meter;
    if(b.split_meter){
      s('bl-central_prev', b.central_prev||''); s('bl-central_present', b.central_present||'');
      s('bl-central_units', b.central_units||'');
      // show the full bill total (not the central-only amount) while editing
      if(b.bill_total!=null) s('bl-total_amount', b.bill_total);
    }
    billSplitToggled();
  }
  var _isW = ((b.utility_type||'')==='water');
  window._billIsWater=_isW;
  var _billEl=document.querySelector('.mea-bill'); if(_billEl) _billEl.classList.toggle('mea-bill-water', _isW);
  var _ec2=document.getElementById('mea-elec-cols'); if(_ec2) _ec2.style.display=_isW?'none':'contents';
  var _wc2=document.getElementById('mea-water-cols'); if(_wc2) _wc2.style.display=_isW?'':'none';
  meterPicked();
  billRecalcTotal();
  if(document.getElementById('bl-split') && document.getElementById('bl-split').checked){
    if(b.bill_total!=null){ var _te=document.getElementById('bl-total_amount'); if(_te) _te.value=b.bill_total; }
    billRecalcSplit();
  }
  _setBillSaveBtn();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteBill(id){
  if(!confirm('Delete this utility bill?')) return;
  await window.CM_REPO.remove('utility_bills', id); U.toast('Bill deleted'); renderBills();
}
function clearBillForm(){
  ['bl-reading_date','bl-due_date','bl-prev_reading','bl-present_reading','bl-units_used',
   'bl-energy_charge','bl-energy_manual','bl-service_fee','bl-ft_rate','bl-ft','bl-vat','bl-total_amount','bl-paid_date','bl-receipt_path','bl-notes',
   'bl-central_prev','bl-central_present','bl-central_units'].forEach(k=>{const e=document.getElementById(k);if(e)e.value='';});
  ['bl-w_raw','bl-w_charge','bl-w_service','bl-w_discount'].forEach(function(k){var e=document.getElementById(k);if(e)e.value='';});
  const paid=document.getElementById('bl-paid'); if(paid) paid.value='';
  const idf=document.getElementById('bl-edit-id'); if(idf) idf.value='';
  const btn=document.getElementById('bl-save'); if(btn) btn.innerHTML='<i class="fa-solid fa-plus"></i> Add Bill';
  _setBillPeriod(U.curPeriod());
  var _dl=document.getElementById('bl-due_date'); if(_dl) _dl.removeAttribute('data-auto14');
  var _rd2=document.getElementById('bl-reading_date'); if(_rd2) _rd2.removeAttribute('data-auto2');
  const sp=document.getElementById('bl-split'); if(sp) sp.checked=false;
  // auto-fill default rates for a fresh bill (overwritable)
  if(_billRates){
    const fr=document.getElementById('bl-ft_rate'); if(fr) fr.value=_billRates.ft_rate;
    const sf=document.getElementById('bl-service_fee'); if(sf) sf.value=_billRates.service_fee;
  }
  const rt=document.querySelector('input[name="bl-emode"][value="tiered"]'); if(rt) rt.checked=true;
  billEnergyMode();
  billSplitToggled();
  if(document.getElementById('bl-meter_id')) meterPicked();
}

window.renderUtilities = renderUtilities;
window.utilSub = utilSub;
window.renderMeters = renderMeters;
window.meterTypeChanged = meterTypeChanged;
window.saveMeter = saveMeter;
window.editMeter = editMeter;
window.deleteMeter = deleteMeter;
window.renderBills = renderBills;
window.meterPicked = meterPicked;
window.billRecalcUnits = billRecalcUnits;
window.billReadingDateChanged = billReadingDateChanged;
window.billPeriodChanged = billPeriodChanged;
window.toggleBillDetail = toggleBillDetail;
window._carryPrevReadings = _carryPrevReadings;
window._setBillSaveBtn = _setBillSaveBtn;
window.billEnergyMode = billEnergyMode;
window.billRenderTiers = billRenderTiers;
window.billRecalcTotal = billRecalcTotal;
window.billRecalcWater = billRecalcWater;
window.billSplitToggled = billSplitToggled;
window.billRecalcSplit = billRecalcSplit;
window.billSuggestPath = billSuggestPath;
window.billCopyPath = billCopyPath;
window.saveBill = saveBill;
window.editBill = editBill;
window.deleteBill = deleteBill;
window.clearBillForm = clearBillForm;
