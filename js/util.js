/* util.js \u2014 formatting & helpers for VillageMan.
   Date display: dd/mm/yyyy (matches Cash Flow Planner). Internal storage: YYYY-MM-DD. */

/* ---- IDs ---- */
function uid(){ return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ---- Dates (dd/mm/yyyy display, YYYY-MM-DD storage) ---- */
function fmtDate(iso){
  if(!iso) return '';
  const p = String(iso).split('-');
  if(p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}
function parseDMY(s){
  if(!s) return '';
  const p = String(s).trim().split('/');
  if(p.length !== 3) return '';
  const dd = p[0].padStart(2,'0'), mm = p[1].padStart(2,'0'), yyyy = p[2];
  return yyyy + '-' + mm + '-' + dd;
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function curPeriod(){ return new Date().toISOString().slice(0,7); } // YYYY-MM

/* ---- Money (THB) ---- */
function fmtMoney(n){
  const v = Number(n) || 0;
  return '\u0e3f' + v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtNum(n){
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

/* ---- Receipt numbers: RC-YYYY-0001 ---- */
function nextReceiptNo(D){
  D.counters.receipt_seq = (D.counters.receipt_seq || 0) + 1;
  const yr = new Date().getFullYear();
  return 'RC-' + yr + '-' + String(D.counters.receipt_seq).padStart(4,'0');
}

/* ---- HTML escape (avoid injection when rendering user text) ---- */
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ---- Charge status derivation ---- */
function chargeBalance(D, chargeId){
  const charge = D.fee_charges.find(c => c.id === chargeId);
  if(!charge) return 0;
  const paid = D.payments.filter(p => p.fee_charge_id === chargeId)
                          .reduce((s,p) => s + (Number(p.paid_amount)||0), 0);
  return (Number(charge.amount_due)||0) - paid;
}
function chargeStatus(D, chargeId){
  const charge = D.fee_charges.find(c => c.id === chargeId);
  if(!charge) return 'unpaid';
  const bal = chargeBalance(D, chargeId);
  if(bal <= 0) return 'paid';
  if(bal < (Number(charge.amount_due)||0)) return 'partial';
  return 'unpaid';
}

/* ---- Toast ---- */
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---- Guided receipt filing ----
   Builds the recommended folder path + filename for a receipt/slip so the
   committee files it consistently in Drive under:
     receipts / <category> / <year> / <month> / <descriptive-name>
   The app stores only this PATH (chosen structure), never the file itself. */
function slugify(s){
  return String(s||'').trim().toLowerCase()
    .replace(/[\/\\]+/g,'-')      // slashes -> dash (house 12/3 -> 12-3)
    .replace(/[^a-z0-9\u0e01-\u0e59_-]+/gi,'-') // keep alnum + Thai + _-
    .replace(/-+/g,'-').replace(/^-|-$/g,'');
}
/* period 'YYYY-MM' -> {year:'YYYY', month:'MM'} with today fallback. */
function periodParts(period){
  const p = String(period||'').split('-');
  if(p.length>=2) return { year:p[0], month:p[1] };
  const now = new Date();
  return { year:String(now.getFullYear()), month:String(now.getMonth()+1).padStart(2,'0') };
}
/* Returns { folder, filename, path } (path uses forward slashes for display). */
function receiptTarget(category, period, descParts, ext){
  const { year, month } = periodParts(period);
  const cat = slugify(category||'other');
  const folder = `receipts/${cat}/${year}/${month}`;
  const desc = descParts.filter(Boolean).map(slugify).join('_');
  const filename = `${desc||'receipt'}.${(ext||'jpg').replace(/^\./,'')}`;
  return { folder, filename, path: `${folder}/${filename}` };
}

/* ---- Managed dropdown lists ----
   Built-in defaults for each editable list. Settings can override these
   (stored in meta.lists). getList() returns the user's list if present and
   non-empty, else the built-in default. Thai stored as \uXXXX escapes. */
const LIST_DEFAULTS = {
  utility_types: ['electricity','water','internet','other'],
  providers: ['','MEA','PEA'],
  purposes: ['\u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19','\u0e44\u0e1f\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19','CCTV','\u0e1b\u0e31\u0e4a\u0e21\u0e19\u0e49\u0e33/pump','\u0e2a\u0e42\u0e21\u0e2a\u0e23/clubhouse','other'],
  expense_categories: ['utility','repair','cleaning','maintenance','other'],
  service_types: ['electrician','plumber','waste','landscaper','cleaning','security','repair','other'],
  emergency_categories: ['police','fire','hospital','security','rescue','electric','water','other']
};
/* Return the managed list for `key` from meta.lists, else the built-in default.
   `meta` is the repo meta object (may be null). Always returns a fresh array. */
function getList(meta, key){
  const def = (LIST_DEFAULTS[key] || []).slice();
  if(meta && meta.lists && Array.isArray(meta.lists[key]) && meta.lists[key].length){
    return meta.lists[key].slice();
  }
  return def;
}

/* ---- Tiered (stepped) electricity energy tariff ----
   Default = MEA residential >150 units/month (\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17 1.2), derived from the
   user's bill: tier boundaries 1-150 / 151-400 / 401+ at these per-unit rates.
   Editable in Settings, stored in meta.tariff as [{upto, rate}, ...] where
   `upto` is the cumulative unit ceiling of the tier (null = no ceiling/last). */
const TARIFF_DEFAULT = [
  { upto: 150,  rate: 3.2484 },
  { upto: 400,  rate: 4.2218 },
  { upto: null, rate: 4.4217 }
];
/* Return the tariff tiers from meta.tariff, else the default. Fresh array. */
function getTariff(meta){
  if(meta && Array.isArray(meta.tariff) && meta.tariff.length){
    return meta.tariff.map(function(t){ return { upto:t.upto, rate:t.rate }; });
  }
  return TARIFF_DEFAULT.map(function(t){ return { upto:t.upto, rate:t.rate }; });
}
/* Compute stepped energy cost for `units` given tier list.
   Returns { total, breakdown:[{units, rate, amount, label}] }. */
function calcTiered(units, tiers){
  units = Number(units) || 0;
  tiers = (tiers && tiers.length) ? tiers : TARIFF_DEFAULT;
  let remaining = units, lower = 0, total = 0;
  const breakdown = [];
  for(let i=0; i<tiers.length && remaining>0; i++){
    const t = tiers[i];
    const ceil = (t.upto==null) ? Infinity : Number(t.upto);
    const span = ceil - lower;                 // capacity of this tier
    const take = Math.min(remaining, span);
    if(take > 0){
      const amount = take * (Number(t.rate)||0);
      const label = (t.upto==null) ? (lower+1)+'+' : (lower+1)+'-'+ceil;
      breakdown.push({ units: take, rate: Number(t.rate)||0, amount: amount, label: label });
      total += amount;
      remaining -= take;
    }
    lower = ceil;
  }
  return { total: +total.toFixed(2), breakdown: breakdown };
}

/* ---- Default bill rates (editable in Settings, overwritable per bill) ----
   Stored in meta.rates. Ft rate (baht/unit), service fee (baht), VAT percent.
   Ft changes ~every 4 months by ERC; service fee & VAT rarely change. */
const RATES_DEFAULT = { ft_rate: 0.1623, service_fee: 24.62, vat_pct: 7 };
function getRates(meta){
  const d = RATES_DEFAULT;
  const r = (meta && meta.rates) ? meta.rates : {};
  return {
    ft_rate:    (r.ft_rate    != null && r.ft_rate    !== '') ? Number(r.ft_rate)    : d.ft_rate,
    service_fee:(r.service_fee!= null && r.service_fee !== '') ? Number(r.service_fee): d.service_fee,
    vat_pct:    (r.vat_pct    != null && r.vat_pct    !== '') ? Number(r.vat_pct)    : d.vat_pct
  };
}

window.CM_UTIL = { uid, fmtDate, parseDMY, todayISO, curPeriod, fmtMoney, fmtNum,
                   nextReceiptNo, esc, chargeBalance, chargeStatus, toast,
                   slugify, periodParts, receiptTarget, LIST_DEFAULTS, getList,
                   TARIFF_DEFAULT, getTariff, calcTiered, RATES_DEFAULT, getRates };
