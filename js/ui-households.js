/* ui-households.js — Resident & Household Directory (FULL module).
   Add / edit / delete households; shows each household's outstanding balance. */
const H_UTIL = window.CM_UTIL;

async function renderHouseholds(){
  const repo = window.CM_REPO;
  const D = await repo.all();
  const el = document.getElementById('tab-households');

  const rows = D.households.map(h => {
    // outstanding for this household
    let owe = 0;
    D.fee_charges.filter(c=>c.household_id===h.id).forEach(c=>{ const b=H_UTIL.chargeBalance(D,c.id); if(b>0) owe+=b; });
    const statusTag = h.status==='active' ? 'tag-active' : h.status==='vacant' ? 'tag-planned' : 'tag-finished';
    return `<tr>
      <td>${H_UTIL.esc(h.house_no)}</td>
      <td>${H_UTIL.esc(h.owner_name)}</td>
      <td>${H_UTIL.esc(h.tenant_name||'')}</td>
      <td>${H_UTIL.esc(h.phone||'')}</td>
      <td>${H_UTIL.esc(h.email||'')}</td>
      <td><span class="tag ${statusTag}">${H_UTIL.esc(h.status||'active')}</span></td>
      <td class="r ${owe>0?'text-error':'text-muted'}">${H_UTIL.fmtMoney(owe)}</td>
      <td class="r">
        <button class="del-btn" title="Edit" onclick="editHousehold('${h.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteHousehold('${h.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-house-user"></i> Household Directory</h2>
      <div class="form-grid" id="hh-form">
        <div class="form-group"><label>House No *</label><input class="inp" id="hh-house_no" placeholder="e.g. 12/3"></div>
        <div class="form-group"><label>Owner Name *</label><input class="inp" id="hh-owner_name" placeholder="Owner"></div>
        <div class="form-group"><label>Tenant Name</label><input class="inp" id="hh-tenant_name" placeholder="If rented"></div>
        <div class="form-group"><label>Phone</label><input class="inp" id="hh-phone" placeholder="08x-xxx-xxxx"></div>
        <div class="form-group"><label>Email</label><input class="inp" id="hh-email" placeholder="name@email.com"></div>
        <div class="form-group"><label>Status</label>
          <select class="inp" id="hh-status"><option value="active">active</option><option value="vacant">vacant</option><option value="moved_out">moved_out</option></select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <button class="btn btn-primary" id="hh-save" onclick="saveHousehold()"><i class="fa-solid fa-plus"></i> Add Household</button>
        </div>
      </div>
      <input type="hidden" id="hh-edit-id" value="">
    </div>
    <div class="card">
      ${D.households.length ? `<table class="tbl"><thead><tr><th>House</th><th>Owner</th><th>Tenant</th><th>Phone</th><th>Email</th><th>Status</th><th class="r">Outstanding</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
                            : `<p class="text-muted" style="padding:8px">No households yet. Add your first one above.</p>`}
    </div>`;
}

async function saveHousehold(){
  const repo = window.CM_REPO;
  const g = id => document.getElementById(id).value.trim();
  const house_no = g('hh-house_no'), owner_name = g('hh-owner_name');
  if(!house_no || !owner_name){ H_UTIL.toast('House No and Owner are required'); return; }
  const rec = {
    house_no, owner_name,
    tenant_name: g('hh-tenant_name'), phone: g('hh-phone'),
    email: g('hh-email'), status: g('hh-status') || 'active'
  };
  const editId = document.getElementById('hh-edit-id').value;
  if(editId){ await repo.update('households', editId, rec); H_UTIL.toast('Household updated'); }
  else { await repo.add('households', rec); H_UTIL.toast('Household added'); }
  renderHouseholds();
}

async function editHousehold(id){
  const repo = window.CM_REPO;
  const h = await repo.get('households', id);
  if(!h) return;
  const s = (k,v) => document.getElementById(k).value = v || '';
  s('hh-house_no', h.house_no); s('hh-owner_name', h.owner_name);
  s('hh-tenant_name', h.tenant_name); s('hh-phone', h.phone);
  s('hh-email', h.email); s('hh-status', h.status || 'active');
  document.getElementById('hh-edit-id').value = id;
  document.getElementById('hh-save').innerHTML = '<i class="fa-solid fa-check"></i> Update';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteHousehold(id){
  if(!confirm('Delete this household? Its charges/payments remain in records.')) return;
  await window.CM_REPO.remove('households', id);
  H_UTIL.toast('Household deleted');
  renderHouseholds();
}

window.renderHouseholds = renderHouseholds;
window.saveHousehold = saveHousehold;
window.editHousehold = editHousehold;
window.deleteHousehold = deleteHousehold;
