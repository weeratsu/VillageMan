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
    return `<tr>
      <td>${U.esc(label)}${splitBadge}</td>
      <td>${U.esc(b.period)}</td>
      <td class="r">${U.fmtNum(b.split_meter?(b.central_units||0):(b.units_used||0))}</td>
      <td class="r">${U.fmtMoney(b.total_amount||0)}</td>
      <td>${U.fmtDate(b.due_date)}</td>
      <td><span class="tag ${stTag}" ${stStyle}>${stTxt}</span></td>
      <td class="r">${recv}</td>
      <td class="r">
        <button class="del-btn" title="Edit" onclick="editBill('${b.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteBill('${b.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  const meterOptions = meters.length
    ? meters.map(m=>`<option value="${m.id}">${U.esc(meterLabel(m))}</option>`).join('')
    : '';

  body.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-file-invoice-dollar"></i> Record Monthly Bill</h2>
      ${meters.length ? `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1"><label>Meter</label>
          <select class="inp" id="bl-meter_id" onchange="meterPicked()">${meterOptions}</select>
        </div>
      </div>
      <div id="bl-meterinfo" class="text-muted" style="font-size:10px;padding:4px 0 8px"></div>
      <div class="form-group" style="margin-bottom:6px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;text-transform:none;font-size:11px;color:var(--text)">
          <input type="checkbox" id="bl-split" onchange="billSplitToggled()" style="width:auto"> \u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e1e\u0e48\u0e27\u0e07 (\u0e44\u0e1f\u0e01\u0e25\u0e32\u0e07\u0e23\u0e27\u0e21\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e1a\u0e34\u0e25\u0e19\u0e35\u0e49) &mdash; split central-area sub-meter
        </label>
      </div>
      <div id="bl-split-wrap" style="display:none">
        <div class="card" style="background:var(--bg3);margin-bottom:8px">
          <h2 style="font-size:12px"><i class="fa-solid fa-gauge-high"></i> Central sub-meter (\u0e44\u0e1f\u0e01\u0e25\u0e32\u0e07)</h2>
          <div class="form-grid">
            <div class="form-group"><label>Central Prev Reading <span class="text-muted" id="bl-cprevnote" style="text-transform:none"></span></label><input class="inp inp-num" id="bl-central_prev" type="number" step="any" oninput="billRecalcSplit()"></div>
            <div class="form-group"><label>Central Present Reading</label><input class="inp inp-num" id="bl-central_present" type="number" step="any" oninput="billRecalcSplit()"></div>
            <div class="form-group"><label>Central Units Used</label><input class="inp inp-num" id="bl-central_units" type="number" step="any" readonly style="opacity:.75"></div>
          </div>
          <div id="bl-split-summary" style="margin-top:8px;font-size:11px;line-height:1.8"></div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Period (YYYY-MM)</label><input class="inp" id="bl-period" placeholder="${U.curPeriod()}" value="${U.curPeriod()}"></div>
        <div class="form-group"><label>Meter Reading Date (cutoff)</label><input class="inp" id="bl-reading_date" type="date"></div>
        <div class="form-group"><label>Payment Deadline</label><input class="inp" id="bl-due_date" type="date"></div>
        <div class="form-group"><label>Previous Reading <span class="text-muted" id="bl-prevnote" style="text-transform:none"></span></label><input class="inp inp-num" id="bl-prev_reading" type="number" step="any" oninput="billRecalcUnits()"></div>
        <div class="form-group"><label>Present Reading</label><input class="inp inp-num" id="bl-present_reading" type="number" step="any" oninput="billRecalcUnits()"></div>
        <div class="form-group"><label>Units Used</label><input class="inp inp-num" id="bl-units_used" type="number" step="any" readonly style="opacity:.75"></div>
      </div>
      <div class="card" style="background:var(--bg3);margin-top:8px">
        <h2 style="font-size:12px"><i class="fa-solid fa-bolt"></i> Energy charge (\u0e04\u0e48\u0e32\u0e1e\u0e25\u0e31\u0e07\u0e07\u0e32\u0e19\u0e44\u0e1f\u0e1f\u0e49\u0e32)</h2>
        <div class="flex gap-2" style="margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;text-transform:none;font-size:11px"><input type="radio" name="bl-emode" value="tiered" checked onchange="billEnergyMode()" style="width:auto"> \u0e04\u0e34\u0e14\u0e08\u0e32\u0e01\u0e40\u0e23\u0e17\u0e02\u0e31\u0e49\u0e19\u0e1a\u0e31\u0e19\u0e44\u0e14 (tiered auto)</label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;text-transform:none;font-size:11px"><input type="radio" name="bl-emode" value="manual" onchange="billEnergyMode()" style="width:auto"> \u0e01\u0e23\u0e2d\u0e01\u0e22\u0e2d\u0e14\u0e40\u0e2d\u0e07 (manual)</label>
        </div>
        <div id="bl-tiered-box"></div>
        <div id="bl-manual-box" style="display:none">
          <div class="form-group"><label>Energy Charge total (\u0e3f)</label><input class="inp inp-num" id="bl-energy_manual" type="number" step="any" oninput="billRecalcTotal()"></div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Energy Charge (\u0e3f) <span class="text-muted" style="text-transform:none">auto</span></label><input class="inp inp-num" id="bl-energy_charge" type="number" step="any" readonly style="opacity:.75"></div>
        <div class="form-group"><label>Service Fee \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 (\u0e3f)</label><input class="inp inp-num" id="bl-service_fee" type="number" step="any" value="${_billRates?_billRates.service_fee:''}" oninput="billRecalcTotal()"></div>
        <div class="form-group"><label>Ft rate (\u0e3f/unit)</label><input class="inp inp-num" id="bl-ft_rate" type="number" step="any" value="${_billRates?_billRates.ft_rate:''}" oninput="billRecalcTotal()"></div>
        <div class="form-group"><label>Ft amount (\u0e3f) <span class="text-muted" style="text-transform:none">= rate x units</span></label><input class="inp inp-num" id="bl-ft" type="number" step="any" readonly style="opacity:.75"></div>
        <div class="form-group"><label>VAT 7% (\u0e3f) <span class="text-muted" style="text-transform:none">auto</span></label><input class="inp inp-num" id="bl-vat" type="number" step="any" readonly style="opacity:.75"></div>
        <div class="form-group"><label>Total Amount (\u0e3f) <span class="text-muted" style="text-transform:none">auto</span></label><input class="inp inp-num" id="bl-total_amount" type="number" step="any" readonly style="opacity:.75"></div>
        <div class="form-group"><label>Paid?</label><select class="inp" id="bl-paid"><option value="">unpaid</option><option value="1">paid</option></select></div>
        <div class="form-group"><label>Paid Date</label><input class="inp" id="bl-paid_date" type="date"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><input class="inp" id="bl-notes"></div>
      </div>
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
        <button class="btn btn-ghost" onclick="clearBillForm()">Clear</button>
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

  if(meters.length) meterPicked();
}

/* When a meter is picked: show its fixed info + carry previous reading from its most recent bill. */
async function meterPicked(){
  const D = await window.CM_REPO.all();
  const id = document.getElementById('bl-meter_id').value;
  const m = (D.meters||[]).find(x=>x.id===id);
  const info = document.getElementById('bl-meterinfo');
  const editing = document.getElementById('bl-edit-id').value;
  if(m && info){
    const bits=[];
    if(m.meter_no) bits.push('Meter '+U.esc(m.meter_no));
    if(m.reference_no) bits.push('Ref '+U.esc(m.reference_no));
    if(m.provider) bits.push(U.esc(m.provider));
    info.innerHTML = '<i class="fa-solid fa-circle-info"></i> '+ (bits.join(' &middot; ')||'no fixed info on this meter');
  }
  // Only carry previous reading when adding a NEW bill (not editing an existing one).
  if(!editing){
    const prior = (D.utility_bills||[]).filter(b=>b.meter_id===id)
        .sort((a,b)=>(b.period||'').localeCompare(a.period||''));
    const prevEl=document.getElementById('bl-prev_reading');
    const note=document.getElementById('bl-prevnote');
    if(prior.length && prevEl){
      prevEl.value = prior[0].present_reading || '';
      if(note) note.textContent = '(carried from '+ (prior[0].period||'last bill') +')';
    } else if(note){ note.textContent=''; }
    // carry central sub-meter previous reading too, from the most recent split bill
    const cprevEl=document.getElementById('bl-central_prev');
    const cnote=document.getElementById('bl-cprevnote');
    const priorSplit = prior.filter(b=>b.split_meter && b.central_present!=null);
    if(priorSplit.length && cprevEl){
      cprevEl.value = priorSplit[0].central_present || '';
      if(cnote) cnote.textContent = '(carried from '+ (priorSplit[0].period||'last bill') +')';
    } else if(cnote){ cnote.textContent=''; }
    billRecalcUnits();
    billRecalcSplit();
  }
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
function billRecalcTotal(){
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
  const on = document.getElementById('bl-split') && document.getElementById('bl-split').checked;
  const box = document.getElementById('bl-split-summary');
  // central units
  const cprev=parseFloat(document.getElementById('bl-central_prev') ? document.getElementById('bl-central_prev').value : '')||0;
  const cpres=parseFloat(document.getElementById('bl-central_present') ? document.getElementById('bl-central_present').value : '')||0;
  const cunits=Math.max(0,cpres-cprev);
  const cu=document.getElementById('bl-central_units'); if(cu) cu.value = cunits?cunits:'';
  if(!on || !box) return;
  const totalUnits=parseFloat(document.getElementById('bl-units_used').value)||0;
  const totalAmt=parseFloat(document.getElementById('bl-total_amount').value)||0;
  if(totalUnits<=0 || totalAmt<=0){ box.innerHTML='<span class="text-muted">Enter total units + total amount to see the split.</span>'; return; }
  const rate=totalAmt/totalUnits;
  const homeUnits=Math.max(0,totalUnits-cunits);
  const centralAmt=+(cunits*rate).toFixed(2);
  const homeAmt=+(homeUnits*rate).toFixed(2);
  let warn='';
  if(cunits>totalUnits) warn='<div class="text-error" style="font-size:10px">\u26a0 Central units exceed total units \u2014 check readings.</div>';
  box.innerHTML =
    '<div>Avg rate: <b>'+U.fmtMoney(rate)+'</b>/unit &nbsp;('+U.fmtMoney(totalAmt)+' \u00f7 '+U.fmtNum(totalUnits)+' units)</div>'
    + '<div>Central (\u0e44\u0e1f\u0e01\u0e25\u0e32\u0e07): <b class="text-error">'+U.fmtMoney(centralAmt)+'</b> &nbsp;('+U.fmtNum(cunits)+' units) &rarr; recorded as common-area expense</div>'
    + '<div>Home (\u0e44\u0e1f\u0e1a\u0e49\u0e32\u0e19): <b>'+U.fmtMoney(homeAmt)+'</b> &nbsp;('+U.fmtNum(homeUnits)+' units) &rarr; your share, not a common expense</div>'
    + warn;
}

async function billSuggestPath(){
  const D=await window.CM_REPO.all();
  const m=(D.meters||[]).find(x=>x.id===document.getElementById('bl-meter_id').value);
  const type=m?m.utility_type:'other';
  const period=document.getElementById('bl-period').value.trim()||U.curPeriod();
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
  const g=id=>document.getElementById(id).value.trim();
  const n=id=>parseFloat(document.getElementById(id).value)||0;
  const rec = {
    meter_id: g('bl-meter_id'),
    period: g('bl-period'),
    reading_date: g('bl-reading_date')||'',   /* native date input = YYYY-MM-DD already */
    due_date: g('bl-due_date')||'',
    prev_reading:n('bl-prev_reading'), present_reading:n('bl-present_reading'), units_used:n('bl-units_used'),
    energy_charge:n('bl-energy_charge'), service_fee:n('bl-service_fee'),
    ft_rate:n('bl-ft_rate'), ft:n('bl-ft'), vat:n('bl-vat'), total_amount:n('bl-total_amount'),
    paid:!!g('bl-paid'), paid_date:g('bl-paid_date')||'',
    receipt_path:g('bl-receipt_path'), notes:g('bl-notes')
  };
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
    rec.avg_rate = totalUnits>0 ? rec.bill_total/totalUnits : 0;
    rec.home_units = Math.max(0, totalUnits - rec.central_units);
    rec.central_amount = +(rec.central_units * rec.avg_rate).toFixed(2);
    rec.home_amount = +(rec.home_units * rec.avg_rate).toFixed(2);
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
  clearBillForm();
  renderBills();
}

async function editBill(id){
  const b=await window.CM_REPO.get('utility_bills', id);
  if(!b) return;
  const s=(k,v)=>{const e=document.getElementById(k); if(e) e.value=(v==null?'':v);};
  document.getElementById('bl-edit-id').value=id;   // set FIRST so meterPicked won't carry-over
  s('bl-meter_id', b.meter_id);
  s('bl-period',b.period); s('bl-reading_date',b.reading_date||''); s('bl-due_date',b.due_date||'');
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
  meterPicked(); // refresh the fixed-info line (won't carry prev because we're editing)
  document.getElementById('bl-save').innerHTML='<i class="fa-solid fa-check"></i> Update Bill';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteBill(id){
  if(!confirm('Delete this utility bill?')) return;
  await window.CM_REPO.remove('utility_bills', id); U.toast('Bill deleted'); renderBills();
}
function clearBillForm(){
  ['bl-period','bl-reading_date','bl-due_date','bl-prev_reading','bl-present_reading','bl-units_used',
   'bl-energy_charge','bl-energy_manual','bl-service_fee','bl-ft_rate','bl-ft','bl-vat','bl-total_amount','bl-paid_date','bl-receipt_path','bl-notes',
   'bl-central_prev','bl-central_present','bl-central_units'].forEach(k=>{const e=document.getElementById(k);if(e)e.value='';});
  const paid=document.getElementById('bl-paid'); if(paid) paid.value='';
  const idf=document.getElementById('bl-edit-id'); if(idf) idf.value='';
  const btn=document.getElementById('bl-save'); if(btn) btn.innerHTML='<i class="fa-solid fa-plus"></i> Add Bill';
  const per=document.getElementById('bl-period'); if(per) per.value=U.curPeriod();
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
window.billEnergyMode = billEnergyMode;
window.billRenderTiers = billRenderTiers;
window.billRecalcTotal = billRecalcTotal;
window.billSplitToggled = billSplitToggled;
window.billRecalcSplit = billRecalcSplit;
window.billSuggestPath = billSuggestPath;
window.billCopyPath = billCopyPath;
window.saveBill = saveBill;
window.editBill = editBill;
window.deleteBill = deleteBill;
window.clearBillForm = clearBillForm;
