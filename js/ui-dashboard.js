/* ui-dashboard.js — KPIs + income/expense overview + overdue households. */
const D_UTIL = window.CM_UTIL;

async function renderDashboard(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const el = document.getElementById('tab-dashboard');
  const period = D_UTIL.curPeriod();

  // Income collected this month
  const collected = D.payments
    .filter(p => (p.paid_date||'').startsWith(period))
    .reduce((s,p) => s + (Number(p.paid_amount)||0), 0);

  // Outstanding across all charges
  let outstanding = 0;
  D.fee_charges.forEach(c => { const b = D_UTIL.chargeBalance(D, c.id); if(b>0) outstanding += b; });

  // Expenses this month
  const expenses = D.expenses
    .filter(e => (e.expense_date||'').startsWith(period))
    .reduce((s,e) => s + (Number(e.amount)||0), 0);
  // Utility bills this month (count toward expenses)
  const utilThisMonth = (D.utility_bills||[])
    .filter(u => (u.period||'') === period)
    .reduce((s,u) => s + (Number(u.total_amount)||0), 0);
  const expensesTotal = expenses + utilThisMonth;

  // All-time balance = all payments - all expenses
  const totalIn = D.payments.reduce((s,p)=>s+(Number(p.paid_amount)||0),0);
  const totalOut = D.expenses.reduce((s,e)=>s+(Number(e.amount)||0),0)
                 + (D.utility_bills||[]).reduce((s,u)=>s+(Number(u.total_amount)||0),0);
  const balance = totalIn - totalOut;

  const kpis = [
    ['Collected (this month)', D_UTIL.fmtMoney(collected), 'fa-arrow-down', 'text-success'],
    ['Outstanding', D_UTIL.fmtMoney(outstanding), 'fa-clock', 'text-warning'],
    ['Expenses (this month)', D_UTIL.fmtMoney(expensesTotal), 'fa-arrow-up', 'text-error'],
    ['Balance', D_UTIL.fmtMoney(balance), 'fa-scale-balanced', balance>=0?'text-success':'text-error'],
  ].map(k => `<div class="kpi"><div class="kpi-label">${k[0]}</div><div class="kpi-val ${k[3]}"><i class="fa-solid ${k[2]}" style="font-size:11px;opacity:.6"></i> ${k[1]}</div></div>`).join('');

  // Overdue households
  const today = D_UTIL.todayISO();
  const overdue = D.fee_charges
    .filter(c => (c.due_date||'') < today && D_UTIL.chargeBalance(D,c.id) > 0)
    .map(c => {
      const h = D.households.find(x=>x.id===c.household_id);
      const ft = D.fee_types.find(x=>x.id===c.fee_type_id);
      return `<tr><td>${h?D_UTIL.esc(h.house_no):'-'}</td><td>${h?D_UTIL.esc(h.owner_name):'-'}</td><td>${ft?D_UTIL.esc(ft.name):'-'}</td><td>${D_UTIL.esc(c.period)}</td><td class="r text-error">${D_UTIL.fmtMoney(D_UTIL.chargeBalance(D,c.id))}</td></tr>`;
    }).join('');

  el.innerHTML = `
    <div class="kpi-grid">${kpis}</div>
    <div class="card">
      <h2><i class="fa-solid fa-triangle-exclamation"></i> Overdue Households</h2>
      ${overdue ? `<table class="tbl"><thead><tr><th>House</th><th>Owner</th><th>Fee</th><th>Period</th><th class="r">Balance</th></tr></thead><tbody>${overdue}</tbody></table>`
                : `<p class="text-muted" style="padding:8px">No overdue charges. 🎉</p>`}
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-circle-info"></i> Getting Started</h2>
      <p class="text-muted" style="padding:4px 0;line-height:1.6">
        1. Add your households in <b>Households</b>.<br>
        2. Set fee types & your PromptPay ID in <b>Settings</b>.<br>
        3. Generate monthly charges and record payments in <b>Finance</b>.<br>
        4. Fill the <b>Vendors</b> and <b>Emergency</b> directories.
      </p>
    </div>`;
}
window.renderDashboard = renderDashboard;
