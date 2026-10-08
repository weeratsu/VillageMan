/* ui-dashboard.js \u2014 KPIs + income/expense overview + overdue households. */
const D_UTIL = window.CM_UTIL;

/* Electricity/water usage trend + YoY, self-contained SVG, no CDN */
function _usageByMonth(bills, type){
  var map={};
  (bills||[]).forEach(function(b){
    if((b.utility_type||'')!==type) return;
    var per=(b.period||''); if(!/^\d{4}-\d{2}$/.test(per)) return;
    var units=(Number(b.units_used)||0);
    var amount=b.split_meter ? (Number(b.bill_total)||0) : (Number(b.total_amount)||0);
    if(!map[per]) map[per]={units:0,amount:0};
    map[per].units+=units; map[per].amount+=amount;
  });
  return map;
}
function _lastMonths(n){
  var out=[]; var now=new Date();
  for(var k=n-1;k>=0;k--){ var d=new Date(now.getFullYear(), now.getMonth()-k, 1);
    out.push(d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)); }
  return out;
}
function _usageTrendSvg(map, months){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var W=640, H=160, padT=10, padB=22, padL=8, padR=8;
  var vals=months.map(function(m){ return map[m]?map[m].units:0; });
  var max=Math.max.apply(null, vals.concat([1]));
  var n=months.length; var bw=(W-padL-padR)/n; var bars='';
  for(var i=0;i<n;i++){
    var v=vals[i]; var bh=max>0 ? (v/max)*(H-padT-padB) : 0;
    var x=padL+i*bw+bw*0.15, y=H-padB-bh, w=bw*0.7;
    var mi=parseInt(months[i].split('-')[1],10)-1; var lbl=MON[mi];
    var fill=(i===n-1)?'var(--primary)':'var(--primary-bg)';
    var stroke=(i===n-1)?'var(--primary)':'var(--border2)';
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,bh).toFixed(1)+'" rx="2" fill="'+fill+'" stroke="'+stroke+'"><title>'+months[i]+': '+D_UTIL.fmtNum(v)+'</title></rect>';
    if(v>0){ bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y-2).toFixed(1)+'" text-anchor="middle" font-size="7" fill="var(--text3)">'+D_UTIL.fmtNum(v)+'</text>'; }
    bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-padB+10)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+lbl+'</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+bars+'</svg>';
}
function _usageYoyRows(map, months){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var rows='';
  months.slice().reverse().forEach(function(m){
    var cur=map[m]?map[m].units:null;
    var p=m.split('-'); var prevKey=(parseInt(p[0],10)-1)+'-'+p[1];
    var prev=map[prevKey]?map[prevKey].units:null;
    if(cur==null && prev==null) return;
    var mi=parseInt(p[1],10)-1; var pct='';
    if(cur!=null && prev!=null && prev>0){ var d=((cur-prev)/prev)*100; var cls=d>0?'text-error':(d<0?'text-success':'text-muted'); var arr=d>0?'\u2191':(d<0?'\u2193':''); pct='<span class="'+cls+'">'+arr+' '+Math.abs(d).toFixed(1)+'%</span>'; }
    else if(cur!=null && (prev==null||prev===0)){ pct='<span class="text-muted">-</span>'; }
    rows+='<tr><td>'+MON[mi]+' '+p[0]+'</td><td class="r">'+(cur!=null?D_UTIL.fmtNum(cur):'-')+'</td><td class="r text-muted">'+(prev!=null?D_UTIL.fmtNum(prev):'-')+'</td><td class="r">'+pct+'</td></tr>';
  });
  return rows;
}
function _usageTrendCard(bills, type, title, icon){
  var map=_usageByMonth(bills, type); var months=_lastMonths(12);
  var hasData=Object.keys(map).length>0;
  if(!hasData){ return '<div class="card"><h2><i class="fa-solid '+icon+'"></i> '+title+'</h2><p class="text-muted" style="padding:8px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49</p></div>'; }
  var svg=_usageTrendSvg(map, months); var yoy=_usageYoyRows(map, months);
  return '<div class="card"><h2><i class="fa-solid '+icon+'"></i> '+title+'</h2>'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:4px">\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 12 \u0e40\u0e14\u0e37\u0e2d\u0e19\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14</div>'+svg
    +'<div style="font-size:11px;color:var(--text3);margin:8px 0 4px">\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a YoY \u0e40\u0e14\u0e37\u0e2d\u0e19\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e1b\u0e35\u0e01\u0e48\u0e2d\u0e19</div>'
    +'<table class="tbl" style="width:100%;display:table;white-space:normal"><thead><tr><th>\u0e40\u0e14\u0e37\u0e2d\u0e19</th><th class="r">\u0e1b\u0e35\u0e19\u0e35\u0e49</th><th class="r">\u0e1b\u0e35\u0e01\u0e48\u0e2d\u0e19</th><th class="r">YoY</th></tr></thead><tbody>'+yoy+'</tbody></table></div>';
}
/* Common-area (central) COST per month across electricity+water, excluding home_only bills.
   split bill -> central_amount ; flat non-home_only bill -> total_amount (dedicated common meter). */
function _centralByMonth(bills){
  var map={};
  (bills||[]).forEach(function(b){
    if(b.home_only) return;
    var per=(b.period||''); if(!/^\d{4}-\d{2}$/.test(per)) return;
    var amt=b.split_meter ? (Number(b.central_amount)||0) : (Number(b.total_amount)||0);
    if(!map[per]) map[per]=0;
    map[per]+=amt;
  });
  return map;
}
function _centralTrendSvg(map, months){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var vals=months.map(function(m){ return map[m]||0; });
  var max=Math.max.apply(null, vals.concat([1]));
  var W=640,H=160,padT=10,padB=22,padL=8,padR=8; var n=months.length; var bw=(W-padL-padR)/n; var bars='';
  for(var i=0;i<n;i++){
    var v=vals[i]; var bh=max>0?(v/max)*(H-padT-padB):0;
    var x=padL+i*bw+bw*0.15, y=H-padB-bh, w=bw*0.7;
    var mi=parseInt(months[i].split('-')[1],10)-1; var lbl=MON[mi];
    var fill=(i===n-1)?'var(--error)':'var(--error-bg)';
    var stroke=(i===n-1)?'var(--error)':'var(--border2)';
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,bh).toFixed(1)+'" rx="2" fill="'+fill+'" stroke="'+stroke+'"><title>'+months[i]+': '+D_UTIL.fmtMoney(v)+'</title></rect>';
    if(v>0){ bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y-2).toFixed(1)+'" text-anchor="middle" font-size="7" fill="var(--text3)">'+Math.round(v)+'</text>'; }
    bars+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-padB+10)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+lbl+'</text>';
  }
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+bars+'</svg>';
}
function _centralTrendCard(bills){
  var map=_centralByMonth(bills); var months=_lastMonths(12);
  var hasData=Object.keys(map).length>0;
  var title='\u0e04\u0e48\u0e32\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 (Common-area Trend)';
  if(!hasData){ return '<div class="card"><h2><i class="fa-solid fa-users"></i> '+title+'</h2><p class="text-muted" style="padding:8px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25</p></div>'; }
  var cur=D_UTIL.curPeriod(); var thisMo=map[cur]||0;
  var yr=cur.slice(0,4); var ytd=0; Object.keys(map).forEach(function(k){ if(k.slice(0,4)===yr) ytd+=map[k]; });
  return '<div class="card"><h2><i class="fa-solid fa-users"></i> '+title+'</h2>'
    +'<div style="display:flex;gap:16px;font-size:12px;margin-bottom:6px">'
      +'<span class="text-muted">\u0e40\u0e14\u0e37\u0e2d\u0e19\u0e19\u0e35\u0e49: <b class="text-error">'+D_UTIL.fmtMoney(thisMo)+'</b></span>'
      +'<span class="text-muted">\u0e23\u0e27\u0e21\u0e1b\u0e35 '+yr+': <b>'+D_UTIL.fmtMoney(ytd)+'</b></span>'
    +'</div>'
    +_centralTrendSvg(map, months)
    +'<p class="text-muted" style="font-size:9px;margin-top:4px">* \u0e44\u0e21\u0e48\u0e23\u0e27\u0e21\u0e1a\u0e34\u0e25\u0e1a\u0e49\u0e32\u0e19\u0e25\u0e49\u0e27\u0e19 (home-only)</p>'
    +'</div>';
}
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
    ${_usageTrendCard(D.utility_bills||[], 'electricity', '\u0e41\u0e19\u0e27\u0e42\u0e19\u0e49\u0e21\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e44\u0e1f\u0e1f\u0e49\u0e32 (Electricity Trend)', 'fa-bolt')}
    ${_usageTrendCard(D.utility_bills||[], 'water', '\u0e41\u0e19\u0e27\u0e42\u0e19\u0e49\u0e21\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e19\u0e49\u0e33 (Water Trend)', 'fa-droplet')}
    ${_centralTrendCard(D.utility_bills||[])}
    <div class="card">
      <h2><i class="fa-solid fa-triangle-exclamation"></i> Overdue Households</h2>
      ${overdue ? `<table class="tbl"><thead><tr><th>House</th><th>Owner</th><th>Fee</th><th>Period</th><th class="r">Balance</th></tr></thead><tbody>${overdue}</tbody></table>`
                : `<p class="text-muted" style="padding:8px">No overdue charges. \ud83c\udf89</p>`}
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
