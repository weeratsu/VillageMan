/* ui-finance.js \u2014 Finance module (FULL).
   Sub-tabs: Income (fee types + bulk-generate charges + record payments w/ PromptPay QR
   + printable receipt + guided filing), Expenses (ad-hoc costs), Reports (net/balance).
   All money in THB; dates dd/mm/yyyy on display, YYYY-MM-DD in storage. */
const F = window.CM_UTIL;
const PP = window.CM_PROMPTPAY;

let _finSub = 'income';

async function renderFinance(){
  const el = document.getElementById('tab-finance');
  el.innerHTML = `
    <div class="sub-tabs" style="display:flex;gap:2px;margin-bottom:10px">
      <span class="sub-tab ${_finSub==='income'?'active':''}" onclick="finSub('income')"><i class="fa-solid fa-hand-holding-dollar"></i> Income</span>
      <span class="sub-tab ${_finSub==='expenses'?'active':''}" onclick="finSub('expenses')"><i class="fa-solid fa-money-bill-wave"></i> Expenses</span>
      <span class="sub-tab ${_finSub==='reports'?'active':''}" onclick="finSub('reports')"><i class="fa-solid fa-chart-pie"></i> Reports</span>
    </div>
    <div id="fin-body"></div>`;
  // sub-tab styling (scoped, reuses theme tokens)
  if(!document.getElementById('fin-substyle')){
    const st=document.createElement('style'); st.id='fin-substyle';
    st.textContent='.sub-tab{padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg3);color:var(--text2);display:inline-flex;gap:5px;align-items:center}.sub-tab:hover{background:var(--surface)}.sub-tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}';
    document.head.appendChild(st);
  }
  if(_finSub==='income') await renderIncome();
  else if(_finSub==='expenses') await renderExpenses();
  else await renderReports();
}
function finSub(s){ _finSub=s; renderFinance(); }

/* ============================ INCOME ============================ */
async function renderIncome(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const body = document.getElementById('fin-body');
  const period = F.curPeriod();

  // fee types chips
  const chips = D.fee_types.map(ft =>
    `<span class="type-chip">${F.esc(ft.name)} \u00b7 ${F.fmtMoney(ft.default_amount)} <span class="x" title="Remove" onclick="delFeeType('${ft.id}')">\u2715</span></span>`
  ).join('');

  // charges for the selected period, with balances
  const charges = D.fee_charges.filter(c => c.period === period);
  const rows = charges.map(c => {
    const h = D.households.find(x=>x.id===c.household_id);
    const ft = D.fee_types.find(x=>x.id===c.fee_type_id);
    const bal = F.chargeBalance(D, c.id);
    const st = F.chargeStatus(D, c.id);
    const stTag = st==='paid'?'tag-active':st==='partial'?'tag-planned':'';
    const stStyle = st==='unpaid'?'style="background:var(--error-bg);color:var(--error)"':'';
    return `<tr>
      <td>${h?F.esc(h.house_no):'-'}</td>
      <td>${h?F.esc(h.owner_name):'-'}</td>
      <td>${ft?F.esc(ft.name):'-'}</td>
      <td class="r">${F.fmtMoney(c.amount_due)}</td>
      <td class="r ${bal>0?'text-error':'text-success'}">${F.fmtMoney(bal)}</td>
      <td><span class="tag ${stTag}" ${stStyle}>${st}</span></td>
      <td class="r">
        ${bal>0?`<button class="btn btn-primary" style="padding:3px 8px" onclick="openPayment('${c.id}')"><i class="fa-solid fa-qrcode"></i> Pay</button>`:''}
        <button class="del-btn" title="Delete charge" onclick="delCharge('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-tags"></i> Fee Types</h2>
      <div class="types-list" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${chips||'<span class="text-muted" style="font-size:11px">No fee types yet \u2014 add one below (e.g. Common Area Fee).</span>'}</div>
      <div class="flex gap-2 flex-wrap" style="align-items:end">
        <div class="form-group"><label>New Fee Type</label><input class="inp" id="ft-name" placeholder="Common Area Fee"></div>
        <div class="form-group"><label>Default Amount (\u0e3f)</label><input class="inp inp-num" id="ft-amount" type="number" step="any" placeholder="300"></div>
        <button class="btn btn-ghost" onclick="addFeeType()"><i class="fa-solid fa-plus"></i> Add Fee Type</button>
      </div>
    </div>

    <div class="card">
      <h2><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Monthly Charges</h2>
      <div class="flex gap-2 flex-wrap" style="align-items:end">
        <div class="form-group"><label>Period (YYYY-MM)</label><input class="inp" id="gen-period" value="${period}"></div>
        <div class="form-group"><label>Fee Type</label>
          <select class="inp" id="gen-fee-type">${D.fee_types.map(ft=>`<option value="${ft.id}">${F.esc(ft.name)} (${F.fmtMoney(ft.default_amount)})</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Due Date</label><input class="inp" id="gen-due" placeholder="dd/mm/yyyy"></div>
        <button class="btn btn-primary" onclick="generateCharges()"><i class="fa-solid fa-bolt"></i> Generate for all active households</button>
      </div>
      <p class="text-muted" style="font-size:10px;margin-top:6px">Creates one charge per active household for the selected fee type & period. Skips households that already have a charge for that fee type + period.</p>
    </div>

    <div class="card">
      <h2><i class="fa-solid fa-file-invoice-dollar"></i> Charges \u2014 ${F.esc(period)}</h2>
      ${charges.length?`<table class="tbl"><thead><tr><th>House</th><th>Owner</th><th>Fee</th><th class="r">Amount</th><th class="r">Balance</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                      :`<p class="text-muted" style="padding:8px">No charges for ${F.esc(period)} yet. Generate them above.</p>`}
    </div>

    <div id="pay-modal"></div>`;
}

async function addFeeType(){
  const name = document.getElementById('ft-name').value.trim();
  const amount = parseFloat(document.getElementById('ft-amount').value)||0;
  if(!name){ F.toast('Fee type name required'); return; }
  await window.CM_REPO.add('fee_types', { name, default_amount: amount, recurrence:'monthly' });
  F.toast('Fee type added'); renderIncome();
}
async function delFeeType(id){
  await window.CM_REPO.remove('fee_types', id); F.toast('Fee type removed'); renderIncome();
}

async function generateCharges(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const period = document.getElementById('gen-period').value.trim();
  const feeTypeId = document.getElementById('gen-fee-type').value;
  const due = F.parseDMY(document.getElementById('gen-due').value) || '';
  if(!period){ F.toast('Period required'); return; }
  const ft = D.fee_types.find(x=>x.id===feeTypeId);
  if(!ft){ F.toast('Add a fee type first'); return; }
  const active = D.households.filter(h => (h.status||'active')==='active');
  if(!active.length){ F.toast('No active households'); return; }
  let created=0, skipped=0;
  for(const h of active){
    const exists = D.fee_charges.some(c => c.household_id===h.id && c.fee_type_id===feeTypeId && c.period===period);
    if(exists){ skipped++; continue; }
    await repo.add('fee_charges', {
      household_id: h.id, fee_type_id: feeTypeId, period,
      amount_due: Number(ft.default_amount)||0, due_date: due, status:'unpaid'
    });
    created++;
  }
  F.toast(`Generated ${created} charge(s)` + (skipped?`, skipped ${skipped}`:''));
  renderIncome();
}
async function delCharge(id){
  if(!confirm('Delete this charge? Linked payments remain in records.')) return;
  await window.CM_REPO.remove('fee_charges', id); F.toast('Charge deleted'); renderIncome();
}

/* ---- Payment modal with PromptPay QR ---- */
async function openPayment(chargeId){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const c = D.fee_charges.find(x=>x.id===chargeId);
  if(!c) return;
  const h = D.households.find(x=>x.id===c.household_id);
  const bal = F.chargeBalance(D, chargeId);
  const ppid = D.meta.promptpay_id || '';

  const modal = document.getElementById('pay-modal');
  modal.innerHTML = `
    <div class="card" style="border:2px solid var(--primary)">
      <h2><i class="fa-solid fa-qrcode"></i> Record Payment \u2014 House ${h?F.esc(h.house_no):''}</h2>
      <div class="flex gap-2 flex-wrap" style="align-items:flex-start">
        <div style="flex:1;min-width:220px">
          <div class="form-grid">
            <div class="form-group"><label>Amount (\u0e3f)</label><input class="inp inp-num" id="pay-amount" type="number" step="any" value="${bal.toFixed(2)}"></div>
            <div class="form-group"><label>Paid Date</label><input class="inp" id="pay-date" value="${F.fmtDate(F.todayISO())}"></div>
            <div class="form-group"><label>Method</label>
              <select class="inp" id="pay-method"><option value="qr">PromptPay QR</option><option value="slip">Bank slip</option><option value="cash">Cash</option><option value="transfer">Transfer</option></select>
            </div>
          </div>
          <div class="card" style="background:var(--bg3);margin-top:8px">
            <p class="text-muted" style="font-size:10px;margin-bottom:6px">Receipt filing (optional): file the slip in Drive, store its path.</p>
            <div class="flex gap-2 flex-wrap" style="align-items:end">
              <div class="form-group" style="flex:1;min-width:240px"><label>Receipt path</label><input class="inp" id="pay-receipt_path" placeholder="receipts/common-fee/..."></div>
              <button class="btn btn-ghost" onclick="suggestPayReceiptPath('${chargeId}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Suggest</button>
            </div>
          </div>
          <div class="flex gap-2" style="margin-top:8px">
            <button class="btn btn-primary" onclick="recordPayment('${chargeId}')"><i class="fa-solid fa-check"></i> Record Payment</button>
            <button class="btn btn-ghost" onclick="closePayment()">Cancel</button>
          </div>
        </div>
        <div style="text-align:center">
          <div id="pay-qr" style="background:#fff;padding:10px;border-radius:8px;display:inline-block"></div>
          <div class="text-muted" style="font-size:10px;margin-top:4px">${ppid?'Scan with any bank app':'\u26a0 Set PromptPay ID in Settings'}</div>
        </div>
      </div>
    </div>`;
  modal.scrollIntoView({behavior:'smooth', block:'center'});

  // render QR
  if(ppid && window.QRCode && !window.__QR_CDN_FAILED__){
    const payload = PP.buildPromptPayPayload(ppid, bal);
    document.getElementById('pay-qr').innerHTML='';
    new QRCode(document.getElementById('pay-qr'), { text: payload, width:150, height:150 });
  } else if(ppid){
    // QR library unavailable (offline / CDN blocked): show PromptPay ID + amount as text so payment can still proceed manually.
    document.getElementById('pay-qr').innerHTML='<div style="width:170px;padding:14px;border:1px dashed var(--border2);border-radius:8px;font-size:11px;line-height:1.7;color:#111"><b>PromptPay</b><br>ID: '+F.esc(ppid)+'<br>Amount: '+F.fmtMoney(bal)+'<br><span style="color:#888;font-size:9px">(QR needs internet \u2014 enter manually in your bank app)</span></div>';
  } else {
    document.getElementById('pay-qr').innerHTML='<div style="width:150px;height:150px;display:flex;align-items:center;justify-content:center;color:#999;font-size:10px">No PromptPay ID</div>';
  }
}
function closePayment(){ const m=document.getElementById('pay-modal'); if(m) m.innerHTML=''; }

function suggestPayReceiptPath(chargeId){
  window.CM_REPO.all().then(D=>{
    const c = D.fee_charges.find(x=>x.id===chargeId);
    const h = c ? D.households.find(x=>x.id===c.household_id) : null;
    const t = F.receiptTarget('common-fee', c?c.period:F.curPeriod(),
              ['house', h?h.house_no:'', c?c.period:''], 'jpg');
    document.getElementById('pay-receipt_path').value = t.path;
    F.toast('Path suggested');
  });
}

async function recordPayment(chargeId){
  const repo = window.CM_REPO;
  const amount = parseFloat(document.getElementById('pay-amount').value)||0;
  if(amount<=0){ F.toast('Enter an amount'); return; }
  const seq = await repo.bumpReceipt();
  const receipt_no = 'RC-' + new Date().getFullYear() + '-' + String(seq).padStart(4,'0');
  const rec = {
    fee_charge_id: chargeId,
    paid_amount: amount,
    paid_date: F.parseDMY(document.getElementById('pay-date').value) || F.todayISO(),
    method: document.getElementById('pay-method').value,
    slip_url: document.getElementById('pay-receipt_path').value.trim(),
    receipt_no
  };
  await repo.add('payments', rec);
  F.toast('Payment recorded \u00b7 ' + receipt_no);
  closePayment();
  // offer printable receipt
  showReceipt(receipt_no, chargeId, rec);
  renderIncome();
}

/* Printable receipt in a new window. */
async function showReceipt(receipt_no, chargeId, pay){
  const D = await window.CM_REPO.all();
  const c = D.fee_charges.find(x=>x.id===chargeId);
  const h = c ? D.households.find(x=>x.id===c.household_id) : null;
  const ft = c ? D.fee_types.find(x=>x.id===c.fee_type_id) : null;
  const estate = D.meta.estate_name || 'Community';
  const w = window.open('', '_blank', 'width=420,height=560');
  if(!w){ F.toast('Popup blocked \u2014 receipt not opened'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${F.esc(receipt_no)}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}td{padding:6px 4px;border-bottom:1px solid #eee}.r{text-align:right}
    .tot{font-size:16px;font-weight:700}.foot{margin-top:24px;font-size:11px;color:#888;text-align:center}
    @media print{button{display:none}}</style></head><body>
    <h1>${F.esc(estate)}</h1><div class="sub">Payment Receipt \u00b7 ${F.esc(receipt_no)}</div>
    <table>
      <tr><td>Date</td><td class="r">${F.fmtDate(pay.paid_date)}</td></tr>
      <tr><td>House</td><td class="r">${h?F.esc(h.house_no):'-'}</td></tr>
      <tr><td>Owner</td><td class="r">${h?F.esc(h.owner_name):'-'}</td></tr>
      <tr><td>For</td><td class="r">${ft?F.esc(ft.name):'-'} \u00b7 ${c?F.esc(c.period):''}</td></tr>
      <tr><td>Method</td><td class="r">${F.esc(pay.method)}</td></tr>
      <tr><td class="tot">Amount Paid</td><td class="r tot">${F.fmtMoney(pay.paid_amount)}</td></tr>
    </table>
    <div class="foot">Generated by VillageMan \u00b7 ${F.esc(receipt_no)}</div>
    <!-- receipt footer -->
    <div style="text-align:center;margin-top:20px"><button onclick="window.print()">Print</button></div>
    </body></html>`);
  w.document.close();
}

/* ============================ EXPENSES ============================ */
async function renderExpenses(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const body = document.getElementById('fin-body');
  const cats = F.getList(D.meta, 'expense_categories');
  const rows = D.expenses.slice().sort((a,b)=>(b.expense_date||'').localeCompare(a.expense_date||'')).map(e=>{
    const v = D.vendors.find(x=>x.id===e.vendor_id);
    return `<tr><td>${F.esc(e.category)}</td><td>${F.esc(e.description||'')}</td><td>${v?F.esc(v.name):''}</td><td>${F.fmtDate(e.expense_date)}</td><td class="r text-error">${F.fmtMoney(e.amount)}</td>
      <td class="r"><button class="del-btn" onclick="delExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }).join('');
  body.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-money-bill-wave"></i> Add Expense</h2>
      <div class="form-grid">
        <div class="form-group"><label>Category</label><select class="inp" id="ex-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Description</label><input class="inp" id="ex-desc" placeholder="e.g. Garden cleaning"></div>
        <div class="form-group"><label>Vendor (optional)</label><select class="inp" id="ex-vendor"><option value="">\u2014</option>${D.vendors.map(v=>`<option value="${v.id}">${F.esc(v.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Date</label><input class="inp" id="ex-date" value="${F.fmtDate(F.todayISO())}"></div>
        <div class="form-group"><label>Amount (\u0e3f)</label><input class="inp inp-num" id="ex-amount" type="number" step="any"></div>
        <button class="btn btn-primary" onclick="addExpense()"><i class="fa-solid fa-plus"></i> Add</button>
      </div>
      <p class="text-muted" style="font-size:10px;margin-top:6px">For metered electricity/water bills with meter readings, use the <b>Utilities</b> tab instead.</p>
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-list"></i> Expenses</h2>
      ${D.expenses.length?`<table class="tbl"><thead><tr><th>Category</th><th>Description</th><th>Vendor</th><th>Date</th><th class="r">Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                         :`<p class="text-muted" style="padding:8px">No expenses recorded.</p>`}
    </div>`;
}
async function addExpense(){
  const rec = {
    category: document.getElementById('ex-category').value,
    description: document.getElementById('ex-desc').value.trim(),
    vendor_id: document.getElementById('ex-vendor').value,
    expense_date: F.parseDMY(document.getElementById('ex-date').value) || F.todayISO(),
    amount: parseFloat(document.getElementById('ex-amount').value)||0,
    receipt_url: ''
  };
  if(rec.amount<=0){ F.toast('Enter an amount'); return; }
  await window.CM_REPO.add('expenses', rec); F.toast('Expense added'); renderExpenses();
}
async function delExpense(id){ await window.CM_REPO.remove('expenses', id); F.toast('Expense deleted'); renderExpenses(); }

/* ============================ REPORTS ============================ */
async let _utilRptYear = new Date().getFullYear();
let _utilRptType = 'electricity';
function setUtilRptYear(y){ _utilRptYear=parseInt(y,10)||new Date().getFullYear(); renderReports(); }
function setUtilRptType(t){ _utilRptType=t; renderReports(); }
/* Build a 12-month usage report for one utility type + year. Returns HTML. */
function _utilYearReport(bills, type, year){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var isElec = (type==='electricity');
  var months=[]; for(var i=0;i<12;i++){ months.push({units:0,amount:0,cUnits:0,cAmount:0,hUnits:0,hAmount:0,split:false,n:0}); }
  (bills||[]).forEach(function(b){
    if((b.utility_type||'')!==type) return;
    var per=(b.period||''); var pp=per.split('-'); if(pp.length<2) return;
    if(parseInt(pp[0],10)!==year) return;
    var mi=parseInt(pp[1],10)-1; if(mi<0||mi>11) return;
    var M=months[mi]; M.n++;
    if(b.split_meter){
      M.split=true;
      M.cUnits+=(Number(b.central_units)||0); M.cAmount+=(Number(b.central_amount)||0);
      M.hUnits+=(Number(b.home_units)||0); M.hAmount+=(Number(b.home_amount)||0);
      M.units+=(Number(b.central_units)||0); M.amount+=(Number(b.central_amount)||0);
    } else {
      M.units+=(Number(b.units_used)||0); M.amount+=(Number(b.total_amount)||0);
    }
  });
  var anySplit=months.some(function(m){return m.split;});
  var tUnits=0,tAmount=0,tcU=0,tcA=0,thU=0,thA=0,filled=0,maxA=-1,minA=-1,maxM=-1,minM=-1;
  months.forEach(function(m,i){ tUnits+=m.units; tAmount+=m.amount; tcU+=m.cUnits; tcA+=m.cAmount; thU+=m.hUnits; thA+=m.hAmount; if(m.n>0){ filled++; if(maxA<0||m.amount>maxA){maxA=m.amount;maxM=i;} if(minA<0||m.amount<minA){minA=m.amount;minM=i;} } });
  var rows=months.map(function(m,i){
    if(m.n===0) return '<tr class="text-muted"><td>'+MON[i]+'</td><td class="r">-</td><td class="r">-</td>'+(anySplit?'<td class="r">-</td><td class="r">-</td>':'')+'</tr>';
    var base='<tr><td>'+MON[i]+'</td><td class="r">'+F.fmtNum(m.units)+'</td><td class="r">'+F.fmtMoney(m.amount)+'</td>';
    if(anySplit){ base+='<td class="r text-muted">'+(m.split?F.fmtNum(m.hUnits):'-')+'</td><td class="r text-muted">'+(m.split?F.fmtMoney(m.hAmount):'-')+'</td>'; }
    return base+'</tr>';
  }).join('');
  var unit = isElec?'kWh':'units';
  var hcols = anySplit? '<th class="r">Home units</th><th class="r">Home \u0e3f</th>' : '';
  var head = '<thead><tr><th>Month</th><th class="r">'+(anySplit?'Central ':'')+unit+'</th><th class="r">'+(anySplit?'Central \u0e3f':'\u0e3f')+'</th>'+hcols+'</tr></thead>';
  var avg = filled? tAmount/filled : 0;
  var summary = '<div class="kpi-grid" style="margin-bottom:10px">'
    + '<div class="kpi"><div class="kpi-label">Total units ('+year+')</div><div class="kpi-val">'+F.fmtNum(tUnits)+'</div></div>'
    + '<div class="kpi"><div class="kpi-label">Total '+(anySplit?'central ':'')+'spend</div><div class="kpi-val text-error">'+F.fmtMoney(tAmount)+'</div></div>'
    + '<div class="kpi"><div class="kpi-label">Avg / month</div><div class="kpi-val">'+F.fmtMoney(avg)+'</div></div>'
    + '<div class="kpi"><div class="kpi-label">Highest</div><div class="kpi-val">'+(maxM>=0?MON[maxM]+' '+F.fmtMoney(maxA):'-')+'</div></div>'
    + '<div class="kpi"><div class="kpi-label">Lowest</div><div class="kpi-val">'+(minM>=0?MON[minM]+' '+F.fmtMoney(minA):'-')+'</div></div>'
    + '</div>';
  var totalRow = '<tr style="font-weight:700;border-top:2px solid var(--border2)"><td>Total</td><td class="r">'+F.fmtNum(tUnits)+'</td><td class="r text-error">'+F.fmtMoney(tAmount)+'</td>'+(anySplit?'<td class="r">'+F.fmtNum(thU)+'</td><td class="r">'+F.fmtMoney(thA)+'</td>':'')+'</tr>';
  var note = anySplit? '<p class="text-muted" style="font-size:10px;padding:2px 0">* This meter type has split (piggybacked) bills. \u201cCentral\u201d = common-area expense recorded; \u201cHome\u201d = resident share (reference).</p>' : '';
  return summary + '<table class="tbl">'+head+'<tbody>'+rows+totalRow+'</tbody></table>' + note;
}
function renderReports(){
  const D = await window.CM_REPO.all();
  const body = document.getElementById('fin-body');
  const income = D.payments.reduce((s,p)=>s+(Number(p.paid_amount)||0),0);
  const expTotal = D.expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const utilTotal = (D.utility_bills||[]).reduce((s,u)=>s+(Number(u.total_amount)||0),0);
  const totalExp = expTotal + utilTotal;
  const net = income - totalExp;
  let outstanding=0;
  D.fee_charges.forEach(c=>{ const b=F.chargeBalance(D,c.id); if(b>0) outstanding+=b; });

  // Common-area utility spend broken down by purpose (\u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19 / \u0e44\u0e1f\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19 / CCTV / ...)
  const byPurpose = {};
  (D.utility_bills||[]).forEach(u=>{
    const key = (u.purpose||'').trim() || '(unlabeled)';
    byPurpose[key] = (byPurpose[key]||0) + (Number(u.total_amount)||0);
  });
  const purposeRows = Object.keys(byPurpose).sort((a,b)=>byPurpose[b]-byPurpose[a])
    .map(k=>`<tr><td>${F.esc(k)}</td><td class="r text-error">${F.fmtMoney(byPurpose[k])}</td></tr>`).join('');

  // ---- Yearly utility report data prep ----
  var _allBills = (D.utility_bills||[]);
  var _years = {};
  _allBills.forEach(function(b){ var y=(b.period||'').split('-')[0]; if(y) _years[y]=1; });
  _years[String(_utilRptYear)]=1; _years[String(new Date().getFullYear())]=1;
  var _yearList = Object.keys(_years).sort(function(a,b){return b-a;});
  var _yearOpts = _yearList.map(function(y){ return '<option value="'+y+'"'+(parseInt(y,10)===_utilRptYear?' selected':'')+'>'+y+'</option>'; }).join('');
  var _utilReportHtml = _utilYearReport(_allBills, _utilRptType, _utilRptYear);

  const kpi=(label,val,cls)=>`<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-val ${cls||''}">${F.fmtMoney(val)}</div></div>`;
  body.innerHTML = `
    <div class="kpi-grid">
      ${kpi('Total Income (collected)', income, 'text-success')}
      ${kpi('Total Expenses', totalExp, 'text-error')}
      ${kpi('\u2014 Ad-hoc Expenses', expTotal, 'text-muted')}
      ${kpi('\u2014 Utility Bills', utilTotal, 'text-muted')}
      ${kpi('Net (Income \u2212 Expenses)', net, net>=0?'text-success':'text-error')}
      ${kpi('Outstanding (uncollected)', outstanding, 'text-warning')}
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-lightbulb"></i> Common-area Utility Spend by Purpose</h2>
      ${purposeRows ? `<table class="tbl"><thead><tr><th>Purpose</th><th class="r">Total</th></tr></thead><tbody>${purposeRows}</tbody></table>`
                    : `<p class="text-muted" style="padding:8px">No utility bills recorded yet.</p>`}
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-chart-column"></i> Yearly Utility Usage Report</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <label class="text-muted" style="font-size:12px">Type:</label>
        <select class="inp" onchange="setUtilRptType(this.value)">
          <option value="electricity"${_utilRptType==='electricity'?' selected':''}>\u0e44\u0e1f\u0e1f\u0e49\u0e32 Electricity</option>
          <option value="water"${_utilRptType==='water'?' selected':''}>\u0e19\u0e49\u0e33 Water</option>
        </select>
        <label class="text-muted" style="font-size:12px;margin-left:8px">Year:</label>
        <select class="inp" onchange="setUtilRptYear(this.value)">${_yearOpts}</select>
      </div>
      ${_utilReportHtml}
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-circle-info"></i> Summary</h2>
      <p class="text-muted" style="line-height:1.7;padding:4px 0">
        Collected <b class="text-success">${F.fmtMoney(income)}</b> in fees to date.
        Spent <b class="text-error">${F.fmtMoney(totalExp)}</b> total
        (${F.fmtMoney(expTotal)} ad-hoc + ${F.fmtMoney(utilTotal)} utilities).
        Net position: <b class="${net>=0?'text-success':'text-error'}">${F.fmtMoney(net)}</b>.
        Still to collect: <b class="text-warning">${F.fmtMoney(outstanding)}</b>.
      </p>
    </div>`;
}

window.renderFinance = renderFinance;
window.setUtilRptYear = setUtilRptYear;
window.setUtilRptType = setUtilRptType;
window.finSub = finSub;
window.addFeeType = addFeeType;
window.delFeeType = delFeeType;
window.generateCharges = generateCharges;
window.delCharge = delCharge;
window.openPayment = openPayment;
window.closePayment = closePayment;
window.suggestPayReceiptPath = suggestPayReceiptPath;
window.recordPayment = recordPayment;
window.showReceipt = showReceipt;
window.addExpense = addExpense;
window.delExpense = delExpense;
