/* app.js \u2014 boot, routing, nav wiring, Settings, JSON export/import. */
const A_UTIL = window.CM_UTIL;

const ROUTES = {
  dashboard: window.renderDashboard,
  households: window.renderHouseholds,
  finance: window.renderFinance,
  utilities: window.renderUtilities,
  vendors: window.renderVendors,
  emergency: window.renderEmergency,
  settings: renderSettings
};

function switchTab(tab){
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const pane = document.getElementById('tab-' + tab);
  if(pane) pane.classList.add('active');
  const fn = ROUTES[tab];
  if(typeof fn === 'function') fn();
  location.hash = tab;
}

/* ---- Settings: estate name, PromptPay ID, export/import, reset ---- */
async function renderSettings(){
  const repo = window.CM_REPO;
  const meta = await repo.meta();
  const el = document.getElementById('tab-settings');
  el.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-gear"></i> Settings</h2>
      <div class="form-grid">
        <div class="form-group"><label>Estate / Village Name</label><input class="inp" id="set-estate" value="${A_UTIL.esc(meta.estate_name||'')}" placeholder="e.g. Baan Suan Village"></div>
        <div class="form-group"><label>PromptPay ID (mobile or national/tax ID)</label><input class="inp" id="set-ppid" value="${A_UTIL.esc(meta.promptpay_id||'')}" placeholder="0812345678"></div>
        <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="saveSettings()"><i class="fa-solid fa-check"></i> Save Settings</button></div>
      </div>
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-database"></i> Backup & Data</h2>
      <div class="flex gap-2 flex-wrap" style="padding:4px 0">
        <button class="btn btn-ghost" onclick="exportJSON()"><i class="fa-solid fa-download"></i> Export JSON</button>
        <label class="btn btn-ghost" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Import JSON<input type="file" accept="application/json" style="display:none" onchange="importJSON(event)"></label>
        <button class="btn btn-ghost text-error" onclick="resetAll()"><i class="fa-solid fa-trash"></i> Reset All Data</button>
      </div>
      <p class="text-muted" style="font-size:10px;margin-top:6px">Export creates a backup snapshot you can share via Google Drive. Nothing personal is stored in the app's code \u2014 only in your browser.</p>
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-list-check"></i> Dropdown Lists</h2>
      <p class="text-muted" style="font-size:10px;margin-bottom:8px">Customize the choices offered in each dropdown. Changes save with your data (export/import) and apply across the app.</p>
      <div id="lists-host"></div>
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-layer-group"></i> Electricity Tariff (tiered rates)</h2>
      <p class="text-muted" style="font-size:10px;margin-bottom:8px">Stepped energy rates (\u0e02\u0e31\u0e49\u0e19\u0e1a\u0e31\u0e19\u0e44\u0e14) used to auto-calc the energy charge from units. Set each tier's unit ceiling and rate per unit. Last tier's ceiling = blank (no limit). Ft and service fee are entered per bill.</p>
      <div id="tariff-host"></div>
    </div>
    <div class="card">
      <h2><i class="fa-solid fa-sliders"></i> Default Bill Rates</h2>
      <p class="text-muted" style="font-size:10px;margin-bottom:8px">Auto-filled on every new electricity bill; you can overwrite per bill. Ft is adjusted by ERC ~every 4 months.</p>
      <div class="form-grid">
        <div class="form-group"><label>Ft rate (\u0e3f/unit)</label><input class="inp inp-num" id="set-ft_rate" type="number" step="any" value="${(meta.rates&&meta.rates.ft_rate!=null&&meta.rates.ft_rate!=='')?meta.rates.ft_rate:''}" placeholder="${A_UTIL.RATES_DEFAULT.ft_rate}"></div>
        <div class="form-group"><label>Service fee \u0e04\u0e48\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 (\u0e3f)</label><input class="inp inp-num" id="set-service_fee" type="number" step="any" value="${(meta.rates&&meta.rates.service_fee!=null&&meta.rates.service_fee!=='')?meta.rates.service_fee:''}" placeholder="${A_UTIL.RATES_DEFAULT.service_fee}"></div>
        <div class="form-group"><label>VAT (%)</label><input class="inp inp-num" id="set-vat_pct" type="number" step="any" value="${(meta.rates&&meta.rates.vat_pct!=null&&meta.rates.vat_pct!=='')?meta.rates.vat_pct:''}" placeholder="${A_UTIL.RATES_DEFAULT.vat_pct}"></div>
        <div class="form-group" style="justify-content:flex-end"><button class="btn btn-primary" onclick="saveRates()"><i class="fa-solid fa-check"></i> Save Rates</button></div>
      </div>
      <p class="text-muted" style="font-size:9px;margin-top:4px">Leave blank to use the built-in default shown as placeholder.</p>
    </div>`;
  renderLists();
  renderTariff();
}

/* ---- Electricity tiered tariff editor ---- */
async function renderTariff(){
  const meta = await window.CM_REPO.meta();
  const host = document.getElementById('tariff-host');
  if(!host) return;
  const tiers = A_UTIL.getTariff(meta);
  let lower = 0;
  const rows = tiers.map(function(t, i){
    const label = (t.upto==null) ? ((lower+1)+'+') : ((lower+1)+'-'+t.upto);
    const uptoVal = (t.upto==null) ? '' : t.upto;
    const r = '<div class="flex gap-2" style="align-items:end;margin-bottom:5px">'
      + '<div class="form-group"><label>Tier '+(i+1)+' up to (unit)</label><input class="inp inp-num" type="number" step="1" value="'+uptoVal+'" placeholder="(no limit)" onchange="tariffEdit('+i+',\'upto\',this.value)"></div>'
      + '<div class="form-group"><label>Rate (\u0e3f/unit)</label><input class="inp inp-num" type="number" step="any" value="'+t.rate+'" onchange="tariffEdit('+i+',\'rate\',this.value)"></div>'
      + '<div class="text-muted" style="font-size:9px;padding-bottom:6px">units '+label+'</div>'
      + '<button class="del-btn" title="Remove tier" onclick="tariffRemove('+i+')"><i class="fa-solid fa-trash"></i></button>'
      + '</div>';
    lower = (t.upto==null) ? lower : t.upto;
    return r;
  }).join('');
  host.innerHTML = rows
    + '<div class="flex gap-2" style="margin-top:6px">'
    + '<button class="btn btn-ghost" onclick="tariffAdd()"><i class="fa-solid fa-plus"></i> Add tier</button>'
    + '<button class="btn btn-ghost" onclick="tariffReset()" title="Restore MEA default tiers"><i class="fa-solid fa-rotate-left"></i> Reset to MEA default</button>'
    + '</div>';
}
async function _saveTiers(tiers){
  await window.CM_REPO.setMeta({ tariff: tiers });
}
async function tariffEdit(i, field, val){
  const meta = await window.CM_REPO.meta();
  const tiers = A_UTIL.getTariff(meta);
  if(field==='upto') tiers[i].upto = (val===''||val==null) ? null : Number(val);
  else tiers[i].rate = Number(val)||0;
  await _saveTiers(tiers);
  renderTariff();
}
async function tariffAdd(){
  const meta = await window.CM_REPO.meta();
  const tiers = A_UTIL.getTariff(meta);
  // insert a new tier before the open-ended last one if present
  const openIdx = tiers.findIndex(function(t){ return t.upto==null; });
  const newTier = { upto: 500, rate: 0 };
  if(openIdx>=0) tiers.splice(openIdx, 0, newTier); else tiers.push(newTier);
  await _saveTiers(tiers);
  renderTariff();
}
async function tariffRemove(i){
  const meta = await window.CM_REPO.meta();
  const tiers = A_UTIL.getTariff(meta);
  if(tiers.length<=1){ A_UTIL.toast('Need at least one tier'); return; }
  tiers.splice(i,1);
  await _saveTiers(tiers);
  renderTariff();
}
async function tariffReset(){
  if(!confirm('Restore the default MEA tiers (1-150, 151-400, 401+)?')) return;
  await window.CM_REPO.setMeta({ tariff: [] }); // empty -> getTariff falls back to default
  A_UTIL.toast('Tariff reset to MEA default');
  renderTariff();
}

/* ---- Default bill rates ---- */
async function saveRates(){
  const g = id => { const e=document.getElementById(id); return e ? e.value.trim() : ''; };
  const rates = {
    ft_rate: g('set-ft_rate'),
    service_fee: g('set-service_fee'),
    vat_pct: g('set-vat_pct')
  };
  // store empty string as blank -> getRates falls back to default
  await window.CM_REPO.setMeta({ rates: rates });
  A_UTIL.toast('Default rates saved');
}

/* ---- Managed dropdown lists ---- */
const LIST_META = [
  ['purposes','Meter Purposes','Meter purposes for Utilities (e.g. \u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19, CCTV). Free typing still allowed.'],
  ['utility_types','Utility Types','Types on the Meters form (electricity, water, ...).'],
  ['providers','Electricity Providers','Providers shown for electricity meters (MEA, PEA). Blank entry = none.'],
  ['expense_categories','Expense Categories','Categories in Finance > Expenses.'],
  ['service_types','Vendor Service Types','Service types for Vendors. Free typing still allowed.'],
  ['emergency_categories','Emergency Categories','Categories in the Emergency hub.']
];

async function renderLists(){
  const meta = await window.CM_REPO.meta();
  const host = document.getElementById('lists-host');
  if(!host) return;
  host.innerHTML = LIST_META.map(function(L){
    const key=L[0], title=L[1], desc=L[2];
    const items = A_UTIL.getList(meta, key);
    const chips = items.map(function(v){
      const label = (v==='') ? '(blank)' : A_UTIL.esc(v);
      return '<span class="type-chip">'+label+' <span class="x" title="Remove" onclick="removeListItem(\''+key+'\',\''+encodeURIComponent(v)+'\')">\u2715</span></span>';
    }).join('');
    return '<div style="margin-bottom:12px">'
      + '<div style="font-weight:600;font-size:11px;margin-bottom:2px">'+A_UTIL.esc(title)+'</div>'
      + '<div class="text-muted" style="font-size:9px;margin-bottom:5px">'+A_UTIL.esc(desc)+'</div>'
      + '<div class="types-list" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">'+(chips||'<span class="text-muted" style="font-size:10px">(empty \u2014 built-in defaults used)</span>')+'</div>'
      + '<div class="flex gap-2" style="align-items:end"><input class="inp" id="listadd-'+key+'" placeholder="Add value..." style="max-width:220px" onkeydown="if(event.key===\'Enter\')addListItem(\''+key+'\')">'
      + '<button class="btn btn-ghost" onclick="addListItem(\''+key+'\')"><i class="fa-solid fa-plus"></i> Add</button>'
      + '<button class="btn btn-ghost" onclick="resetList(\''+key+'\')" title="Restore built-in defaults"><i class="fa-solid fa-rotate-left"></i> Reset</button></div>'
      + '</div>';
  }).join('');
}

async function _getLists(){
  const meta = await window.CM_REPO.meta();
  return (meta && meta.lists) ? meta.lists : {};
}
async function addListItem(key){
  const inp = document.getElementById('listadd-'+key);
  const val = (inp.value||'').trim();
  if(!val){ A_UTIL.toast('Enter a value'); return; }
  const meta = await window.CM_REPO.meta();
  const lists = Object.assign({}, meta.lists||{});
  // start from current effective list (defaults if not yet customized)
  const cur = A_UTIL.getList(meta, key);
  if(cur.indexOf(val) === -1) cur.push(val);
  lists[key] = cur;
  await window.CM_REPO.setMeta({ lists: lists });
  A_UTIL.toast('Added');
  renderLists();
}
async function removeListItem(key, encVal){
  const val = decodeURIComponent(encVal);
  const meta = await window.CM_REPO.meta();
  const lists = Object.assign({}, meta.lists||{});
  const cur = A_UTIL.getList(meta, key).filter(function(x){ return x !== val; });
  lists[key] = cur;
  await window.CM_REPO.setMeta({ lists: lists });
  A_UTIL.toast('Removed');
  renderLists();
}
async function resetList(key){
  if(!confirm('Restore built-in defaults for this list?')) return;
  const meta = await window.CM_REPO.meta();
  const lists = Object.assign({}, meta.lists||{});
  delete lists[key]; // removing the override makes getList fall back to defaults
  await window.CM_REPO.setMeta({ lists: lists });
  A_UTIL.toast('Reset to defaults');
  renderLists();
}

async function saveSettings(){
  const repo = window.CM_REPO;
  await repo.setMeta({
    estate_name: document.getElementById('set-estate').value.trim(),
    promptpay_id: document.getElementById('set-ppid').value.trim()
  });
  A_UTIL.toast('Settings saved');
  const meta = await repo.meta();
  document.getElementById('brand-estate').textContent = meta.estate_name || 'VillageMan';
}

async function exportJSON(){
  const D = await window.CM_REPO.all();
  const blob = new Blob([JSON.stringify(D, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'community_' + A_UTIL.todayISO() + '.json';
  a.click(); URL.revokeObjectURL(url);
  A_UTIL.toast('Exported');
}

function importJSON(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const obj = JSON.parse(reader.result);
      await window.CM_REPO.replaceAll(obj);
      A_UTIL.toast('Imported \u2014 reloading');
      setTimeout(()=>location.reload(), 600);
    } catch(e){ A_UTIL.toast('Invalid JSON file'); }
  };
  reader.readAsText(file);
}

async function resetAll(){
  if(!confirm('Erase ALL data and start fresh? Export a backup first if unsure.')) return;
  await window.CM_REPO.replaceAll(window.CM_DATA.defaultData());
  A_UTIL.toast('Reset \u2014 reloading');
  setTimeout(()=>location.reload(), 600);
}

/* ---- Theme ---- */
function toggleTheme(){
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('cm_theme', dark ? 'dark' : 'light');
  const b = document.getElementById('theme-toggle');
  if(b) b.innerHTML = dark ? '<i class="fa-solid fa-sun"></i> Light' : '<i class="fa-solid fa-moon"></i> Dark';
}

/* ---- Boot ---- */
function showBootError(msg){
  const el = document.getElementById('tab-dashboard');
  if(el) el.innerHTML = `<div class="card" style="border:2px solid var(--error)"><h2 class="text-error"><i class="fa-solid fa-triangle-exclamation"></i> Startup error</h2><p class="text-muted" style="font-size:11px;line-height:1.6">${A_UTIL?A_UTIL.esc(msg):msg}</p><p class="text-muted" style="font-size:10px;margin-top:6px">Try a hard refresh (Ctrl+Shift+R). If it persists, tell me this message.</p></div>`;
}

/* Wire navigation FIRST and unconditionally, so clicks always work even if
   data loading later fails. Each step is independently guarded. */
function wireNav(){
  document.querySelectorAll('.nav-item').forEach(b =>
    b.addEventListener('click', () => { try { switchTab(b.dataset.tab); } catch(e){ console.error(e); if(A_UTIL) A_UTIL.toast('Error: '+e.message); } }));
  const tt = document.getElementById('theme-toggle');
  if(tt) tt.addEventListener('click', toggleTheme);
}

async function boot(){
  try {
    if(localStorage.getItem('cm_theme')==='dark') document.documentElement.classList.add('dark');
    // Wire clicks BEFORE any await \u2014 a data error must never leave the nav dead.
    wireNav();

    if(!window.CM_REPO){ showBootError('Data layer failed to load (CM_REPO undefined). A script likely failed to parse \u2014 check the browser console.'); return; }
    const meta = await window.CM_REPO.meta();
    const brand = document.getElementById('brand-estate');
    if(brand) brand.textContent = (meta && meta.estate_name) || 'VillageMan';

    const start = (location.hash || '#dashboard').slice(1);
    switchTab(ROUTES[start] ? start : 'dashboard');
  } catch(e){
    console.error('boot() failed:', e);
    showBootError('boot() failed: ' + e.message);
  }
}

window.switchTab = switchTab;
window.saveSettings = saveSettings;
window.renderLists = renderLists;
window.addListItem = addListItem;
window.removeListItem = removeListItem;
window.resetList = resetList;
window.renderTariff = renderTariff;
window.tariffEdit = tariffEdit;
window.tariffAdd = tariffAdd;
window.tariffRemove = tariffRemove;
window.tariffReset = tariffReset;
window.saveRates = saveRates;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.resetAll = resetAll;
window.toggleTheme = toggleTheme;

/* Boot now if the DOM is already parsed (dynamic-loaded scripts can attach AFTER
   DOMContentLoaded has already fired), otherwise wait for it. */
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); }
else { boot(); }
