/* ui-vendors.js \u2014 Vendor / Contractor Directory (FULL module).
   Add / edit / delete trusted suppliers; searchable by service type. */
const V = window.CM_UTIL;

const SERVICE_TYPES = ['electrician','plumber','waste','landscaper','cleaning','security','repair','other'];
let _vendorSearch = '';

async function renderVendors(){
  const repo = window.CM_REPO;
  const vendors = (await repo.list('vendors')).slice()
     .sort((a,b)=> (a.service_type||'').localeCompare(b.service_type||'') || (a.name||'').localeCompare(b.name||''));
  const meta = await repo.meta();
  const serviceTypes = V.getList(meta, 'service_types');
  const el = document.getElementById('tab-vendors');

  const q = _vendorSearch.trim().toLowerCase();
  const shown = q
    ? vendors.filter(v => [v.name,v.service_type,v.phone,v.email,v.notes]
        .some(f => String(f||'').toLowerCase().includes(q)))
    : vendors;

  const rows = shown.map(v => {
    const stars = v.rating ? '\u2605'.repeat(Math.max(0,Math.min(5,Number(v.rating)))) : '';
    return `<tr>
      <td>${V.esc(v.name)}</td>
      <td><span class="tag tag-finished">${V.esc(v.service_type||'')}</span></td>
      <td>${v.phone?`<a href="tel:${V.esc(v.phone)}" class="text-primary">${V.esc(v.phone)}</a>`:''}</td>
      <td>${V.esc(v.email||'')}</td>
      <td class="text-warning" title="${v.rating||0}/5">${stars}</td>
      <td>${V.esc(v.notes||'')}</td>
      <td class="r">
        <button class="del-btn" title="Edit" onclick="editVendor('${v.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteVendor('${v.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-screwdriver-wrench"></i> Add Vendor</h2>
      <div class="form-grid">
        <div class="form-group"><label>Name *</label><input class="inp" id="vd-name" placeholder="e.g. Somchai Electric"></div>
        <div class="form-group"><label>Service Type</label>
          <input class="inp" id="vd-service_type" list="vd-service-list" placeholder="electrician">
          <datalist id="vd-service-list">${serviceTypes.map(s=>`<option value="${V.esc(s)}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Phone</label><input class="inp" id="vd-phone" placeholder="08x-xxx-xxxx"></div>
        <div class="form-group"><label>Email</label><input class="inp" id="vd-email" placeholder="name@email.com"></div>
        <div class="form-group"><label>Rating (0\u20135)</label><input class="inp inp-num" id="vd-rating" type="number" min="0" max="5" step="1"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes / Services provided</label><input class="inp" id="vd-notes" placeholder="e.g. 24hr callout, services the estate pump"></div>
        <div class="form-group" style="justify-content:flex-end">
          <button class="btn btn-primary" id="vd-save" onclick="saveVendor()"><i class="fa-solid fa-plus"></i> Add Vendor</button>
        </div>
      </div>
      <input type="hidden" id="vd-edit-id" value="">
    </div>

    <div class="card">
      <div class="flex gap-2" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0"><i class="fa-solid fa-address-book"></i> Vendor Directory</h2>
        <input class="inp" style="max-width:220px" placeholder="\u1f50d Search vendors\u2026" value="${V.esc(_vendorSearch)}" oninput="vendorSearch(this.value)">
      </div>
      ${shown.length ? `<table class="tbl"><thead><tr><th>Name</th><th>Service</th><th>Phone</th><th>Email</th><th>Rating</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                     : `<p class="text-muted" style="padding:8px">${vendors.length?'No vendors match your search.':'No vendors yet. Add your first one above.'}</p>`}
    </div>`;
}

function vendorSearch(v){ _vendorSearch = v; renderVendors(); }

async function saveVendor(){
  const g = id => document.getElementById(id).value.trim();
  const name = g('vd-name');
  if(!name){ V.toast('Vendor name required'); return; }
  const rec = {
    name,
    service_type: g('vd-service_type'),
    phone: g('vd-phone'),
    email: g('vd-email'),
    rating: parseInt(document.getElementById('vd-rating').value)||0,
    notes: g('vd-notes')
  };
  const editId = document.getElementById('vd-edit-id').value;
  if(editId){ await window.CM_REPO.update('vendors', editId, rec); V.toast('Vendor updated'); }
  else { await window.CM_REPO.add('vendors', rec); V.toast('Vendor added'); }
  clearVendorForm();
  renderVendors();
}

async function editVendor(id){
  const v = await window.CM_REPO.get('vendors', id);
  if(!v) return;
  const s = (k,val)=>{ const e=document.getElementById(k); if(e) e.value = (val==null?'':val); };
  s('vd-name', v.name); s('vd-service_type', v.service_type); s('vd-phone', v.phone);
  s('vd-email', v.email); s('vd-rating', v.rating||''); s('vd-notes', v.notes);
  document.getElementById('vd-edit-id').value = id;
  document.getElementById('vd-save').innerHTML = '<i class="fa-solid fa-check"></i> Update';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteVendor(id){
  if(!confirm('Delete this vendor?')) return;
  await window.CM_REPO.remove('vendors', id);
  V.toast('Vendor deleted');
  renderVendors();
}

function clearVendorForm(){
  ['vd-name','vd-service_type','vd-phone','vd-email','vd-rating','vd-notes'].forEach(k=>{const e=document.getElementById(k);if(e)e.value='';});
  const idf=document.getElementById('vd-edit-id'); if(idf) idf.value='';
  const btn=document.getElementById('vd-save'); if(btn) btn.innerHTML='<i class="fa-solid fa-plus"></i> Add Vendor';
}

window.renderVendors = renderVendors;
window.vendorSearch = vendorSearch;
window.saveVendor = saveVendor;
window.editVendor = editVendor;
window.deleteVendor = deleteVendor;
window.clearVendorForm = clearVendorForm;
