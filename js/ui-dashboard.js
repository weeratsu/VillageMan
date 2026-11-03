/* ui-dashboard.js \u2014 KPIs + income/expense overview + overdue households. */
const D_UTIL = window.CM_UTIL;

/* Electricity/water usage trend + YoY, self-contained SVG, no CDN */
function _usageByMonth(bills, type, scope){
  scope=scope||'all'; var map={};
  var ULB=((window.UTILITY_DATA&&window.UTILITY_DATA.bills)||[]);
  (bills||[]).forEach(function(b){
    if((b.utility_type||'')!==type) return;
    var per=(b.period||''); if(!/^\d{4}-\d{2}$/.test(per)) return;
    var units=(Number(b.units_used)||0);
    var full=b.split_meter ? (Number(b.bill_total)||0) : (Number(b.total_amount)||0);
    if(!full){ var ul=ULB.find(function(x){ return x.period===per && (x.utility||'')===(type==='water'?'water':'electric'); }); if(ul) full=Number(ul.amount)||0; }
    var cu=0, ca=0;
    if(b.split_meter){ cu=Number(b.central_units)||0; ca=Number(b.central_amount)||0; }
    var u=units, a=full;
    if(scope==='central'){ u=cu; a=ca; }
    else if(scope==='home'){ u=Math.max(0,units-cu); a=Math.max(0,full-ca); }
    if(!map[per]) map[per]={units:0,amount:0};
    map[per].units+=u; map[per].amount+=a;
  });
  return map;
}
function _lastMonths(n){
  var out=[]; var now=new Date();
  for(var k=n-1;k>=0;k--){ var d=new Date(now.getFullYear(), now.getMonth()-k, 1);
    out.push(d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)); }
  return out;
}
function _smoothPath(p){
  var d='M'+p[0][0].toFixed(1)+','+p[0][1].toFixed(1);
  for(var i=0;i<p.length-1;i++){
    var p0=p[i-1]||p[i], p1=p[i], p2=p[i+1], p3=p[i+2]||p2;
    var c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6, c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=' C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
  }
  return d;
}
var _trendOpt={electricity:{k:'units',bars:true,lines:true,avg:false,scope:'all',range:'12m'},water:{k:'units',bars:true,lines:true,avg:false,scope:'all',range:'12m'}};
function setTrendOpt(t,key,val){ var o=_trendOpt[t]; if(key==='k') o.k=val; else if(key==='scope') o.scope=val; else if(key==='range') o.range=val; else o[key]=!o[key]; if(key!=='avg'&&!o.bars&&!o.lines) o[key==='bars'?'lines':'bars']=true; if(window.renderDashboard) window.renderDashboard(); }
window.setTrendOpt=setTrendOpt;
function _tv(o,k){ return o?(k==='amount'?o.amount:o.units):0; }
function _tf(v,k){ return k==='amount'?D_UTIL.fmtMoney(v):D_UTIL.fmtNum(v); }
function _yearlySvg(map, o){
  var k=o.k, ys={}; Object.keys(map).forEach(function(p){ ys[p.slice(0,4)]=1; });
  var years=Object.keys(ys).sort(); if(!years.length) return '';
  var vals=years.map(function(y){ var t=0; for(var m=1;m<=12;m++){ t+=_tv(map[y+'-'+(m<10?'0':'')+m],k); } return t; });
  var cnt=years.map(function(y){ var n=0; for(var m=1;m<=12;m++){ if(map[y+'-'+(m<10?'0':'')+m]) n++; } return n; });
  var W=640,H=170,padT=12,padB=24,padL=8,padR=8, n=years.length, bw=(W-padL-padR)/n, h=H-padT-padB, max=Math.max.apply(null,vals.concat([1])), out='', pts=[];
  for(var i=0;i<n;i++){
    var v=vals[i], bh=(v/max)*h, x=padL+i*bw+bw*0.2, w=bw*0.6, y=H-padB-bh;
    if(o.bars) out+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="2" fill="'+(i===n-1?'var(--primary)':'var(--primary-bg)')+'" stroke="var(--primary)"><title>'+years[i]+' ('+cnt[i]+'/12): '+_tf(v,k)+'</title></rect>';
    out+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(y-3).toFixed(1)+'" text-anchor="middle" font-size="7" fill="var(--text3)">'+Math.round(v)+(cnt[i]<12?'*':'')+'</text>';
    out+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-padB+11)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+years[i]+'</text>';
    pts.push([x+w/2,y]);
  }
  if(o.lines && pts.length>1) out+='<path d="'+_smoothPath(pts)+'" fill="none" stroke="var(--primary)" stroke-width="1.6"/>';
  if(o.avg){ var full=vals.filter(function(v,i){return cnt[i]===12;}); if(full.length){ var a=full.reduce(function(x,y){return x+y;},0)/full.length, ay=H-padB-(a/max)*h;
    out+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+ay.toFixed(1)+'" y2="'+ay.toFixed(1)+'" stroke="var(--text3)" stroke-dasharray="2 3"/><text x="'+(W-padR-2)+'" y="'+(ay-3).toFixed(1)+'" text-anchor="end" font-size="7" fill="var(--text3)">avg '+_tf(a,k)+'</text>'; } }
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+out+'</svg><div style="font-size:9px;color:var(--text3)">* \u0e1b\u0e35\u0e17\u0e35\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a 12 \u0e40\u0e14\u0e37\u0e2d\u0e19</div>';
}
function _usageTrendSvg(map, months, o){
  o=o||{k:'units',bars:true,lines:true}; var k=o.k;
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var W=640, H=170, padT=10, padB=34, padL=8, padR=8;
  function py(m){ var p=m.split('-'); return (+p[0]-1)+'-'+p[1]; }
  var cur=months.map(function(m){ return _tv(map[m],k); });
  var prv=months.map(function(m){ return _tv(map[py(m)],k); });
  var max=Math.max.apply(null, cur.concat(prv).concat([1]));
  var n=months.length, bw=(W-padL-padR)/n, h=H-padT-padB, out='';
  for(var i=0;i<n;i++){
    var gx=padL+i*bw, w=bw*0.36, mi=parseInt(months[i].split('-')[1],10)-1;
    if(o.bars){
      [[prv[i],gx+bw*0.12,'var(--border2)','var(--bg3)',py(months[i])],[cur[i],gx+bw*0.5,'var(--primary)',(i===n-1)?'var(--primary)':'var(--primary-bg)',months[i]]].forEach(function(s){
        var v=s[0], bh=(v/max)*h, y=H-padB-bh;
        out+='<rect x="'+s[1].toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(0,bh).toFixed(1)+'" rx="2" fill="'+s[3]+'" stroke="'+s[2]+'"><title>'+s[4]+': '+_tf(v,k)+'</title></rect>';
        if(v>0) out+='<text x="'+(s[1]+w/2).toFixed(1)+'" y="'+(y-2).toFixed(1)+'" text-anchor="middle" font-size="6" fill="var(--text3)">'+Math.round(v)+'</text>';
      });
    }
    out+='<text x="'+(gx+bw/2).toFixed(1)+'" y="'+(H-padB+10)+'" text-anchor="middle" font-size="8" fill="var(--text3)">'+MON[mi]+'</text>';
  }
  if(o.lines){
    [[prv,'var(--text3)',o.bars?0.3:0.5,'4 3',true],[cur,'var(--primary)',o.bars?0.68:0.5,'',false]].forEach(function(s){
      var pts=[]; for(var q=0;q<n;q++){ if(s[0][q]>0) pts.push([padL+q*bw+bw*s[2], H-padB-(s[0][q]/max)*h, s[0][q], s[4]?py(months[q]):months[q]]); }
      if(pts.length>1) out+='<path d="'+_smoothPath(pts)+'" fill="none" stroke="'+s[1]+'" stroke-width="1.6"'+(s[3]?' stroke-dasharray="'+s[3]+'"':'')+' stroke-linecap="round"/>';
      pts.forEach(function(p){ out+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.2" fill="'+s[1]+'"><title>'+p[3]+': '+_tf(p[2],k)+'</title></circle>';
        if(!o.bars) out+='<text x="'+p[0].toFixed(1)+'" y="'+(p[1]-4).toFixed(1)+'" text-anchor="middle" font-size="6" fill="var(--text3)">'+Math.round(p[2])+'</text>'; });
    });
  }
  if(o.avg){
    [[cur,'var(--primary)','\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22\u0e1b\u0e35\u0e19\u0e35\u0e49',-3],[prv,'var(--text3)','\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22\u0e1b\u0e35\u0e01\u0e48\u0e2d\u0e19',9]].forEach(function(s){
      var nz=s[0].filter(function(v){return v>0;}); if(!nz.length) return;
      var a=nz.reduce(function(x,y){return x+y;},0)/nz.length, ay=H-padB-(a/max)*h;
      out+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+ay.toFixed(1)+'" y2="'+ay.toFixed(1)+'" stroke="'+s[1]+'" stroke-width="1" stroke-dasharray="2 3" opacity=".8"><title>'+s[2]+': '+_tf(a,k)+'</title></line>';
      out+='<text x="'+(W-padR-2)+'" y="'+(ay+s[3]).toFixed(1)+'" text-anchor="end" font-size="7" fill="'+s[1]+'">'+s[2]+' '+_tf(a,k)+'</text>';
    });
  }
  var ly=H-8;
  out+='<rect x="'+(W/2-90)+'" y="'+(ly-7)+'" width="9" height="8" fill="var(--bg3)" stroke="var(--border2)"/><text x="'+(W/2-77)+'" y="'+ly+'" font-size="8" fill="var(--text3)">\u0e1b\u0e35\u0e01\u0e48\u0e2d\u0e19</text>';
  out+='<rect x="'+(W/2+10)+'" y="'+(ly-7)+'" width="9" height="8" fill="var(--primary-bg)" stroke="var(--primary)"/><text x="'+(W/2+23)+'" y="'+ly+'" font-size="8" fill="var(--text3)">\u0e1b\u0e35\u0e19\u0e35\u0e49</text>';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+out+'</svg>';
}
function _usageYoyRows(map, months, k){
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var rows='';
  months.slice().reverse().forEach(function(m){
    var cur=map[m]?_tv(map[m],k):null;
    var p=m.split('-'); var prevKey=(parseInt(p[0],10)-1)+'-'+p[1];
    var prev=map[prevKey]?_tv(map[prevKey],k):null;
    if(cur==null && prev==null) return;
    var mi=parseInt(p[1],10)-1; var pct='';
    if(cur!=null && prev!=null && prev>0){ var d=((cur-prev)/prev)*100; var cls=d>0?'text-error':(d<0?'text-success':'text-muted'); var arr=d>0?'\u2191':(d<0?'\u2193':''); pct='<span class="'+cls+'">'+arr+' '+Math.abs(d).toFixed(1)+'%</span>'; }
    else if(cur!=null && (prev==null||prev===0)){ pct='<span class="text-muted">-</span>'; }
    rows+='<tr><td>'+MON[mi]+' '+p[0]+'</td><td class="r">'+(cur!=null?_tf(cur,k):'-')+'</td><td class="r text-muted">'+(prev!=null?_tf(prev,k):'-')+'</td><td class="r">'+pct+'</td></tr>';
  });
  return rows;
}
function _usageTrendCard(bills, type, title, icon){
  var map=_usageByMonth(bills, type, (_trendOpt[type]||{}).scope); var months=_lastMonths(12);
  var hasData=Object.keys(map).length>0;
  if(!hasData){ return '<div class="card"><h2><i class="fa-solid '+icon+'"></i> '+title+'</h2><p class="text-muted" style="padding:8px">\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49</p></div>'; }
  var o=_trendOpt[type]; var svg=(o.range==='years')?_yearlySvg(map,o):_usageTrendSvg(map, months, o); var yoy=_usageYoyRows(map, months, o.k);
  var b=function(on,args,l){ return '<button class="btn '+(on?'btn-primary':'btn-ghost')+'" style="padding:3px 9px;font-size:10px" onclick="setTrendOpt('+args+')">'+l+'</button>'; };
  var q="'"+type+"'";
  var swh='<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;margin-bottom:6px">'
    +b(o.k==='units', q+",'k','units'", '\u0e2b\u0e19\u0e48\u0e27\u0e22')
    +b(o.k==='amount', q+",'k','amount'", type==='water'?'\u0e04\u0e48\u0e32\u0e19\u0e49\u0e33':'\u0e04\u0e48\u0e32\u0e44\u0e1f')
    +'<span style="width:8px"></span>'
    +b(o.range==='12m', q+",'range','12m'", '12 \u0e40\u0e14\u0e37\u0e2d\u0e19')
    +b(o.range==='years', q+",'range','years'", '\u0e23\u0e32\u0e22\u0e1b\u0e35')
    +'<span style="width:8px"></span>'
    +b(o.scope==='home', q+",'scope','home'", '\u0e1a\u0e49\u0e32\u0e19')
    +b(o.scope==='central', q+",'scope','central'", '\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07')
    +b(o.scope==='all', q+",'scope','all'", '\u0e1a\u0e49\u0e32\u0e19+\u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07')
    +'<span style="width:8px"></span>'
    +b(o.bars, q+",'bars'", '<i class="fa-solid fa-chart-column"></i> \u0e41\u0e17\u0e48\u0e07')
    +b(o.lines, q+",'lines'", '<i class="fa-solid fa-chart-line"></i> \u0e40\u0e2a\u0e49\u0e19')
    +b(o.avg, q+",'avg'", '<i class="fa-solid fa-equals"></i> \u0e04\u0e48\u0e32\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22')
    +'</div>';
  return '<div class="card"><h2><i class="fa-solid '+icon+'"></i> '+title+'</h2>'+swh
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:4px">\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e23\u0e32\u0e22\u0e40\u0e14\u0e37\u0e2d\u0e19 12 \u0e40\u0e14\u0e37\u0e2d\u0e19\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14 \u0e40\u0e17\u0e35\u0e22\u0e1a\u0e1b\u0e35\u0e01\u0e48\u0e2d\u0e19</div>'+svg
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
