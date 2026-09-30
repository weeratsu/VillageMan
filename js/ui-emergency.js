/* ui-emergency.js \u2014 Emergency Contacts hub (FULL module).
   Add / edit / delete essential numbers; quick-dial cards grouped, sortable. */
const E = window.CM_UTIL;

const EMERGENCY_CATS = ['police','fire','hospital','security','rescue','electric','water','other'];
const CAT_ICON = {
  police:'fa-shield-halved', fire:'fa-fire', hospital:'fa-hospital',
  security:'fa-user-shield', rescue:'fa-truck-medical', electric:'fa-bolt',
  water:'fa-droplet', other:'fa-circle-info'
};

async function renderEmergency(){
  const repo = window.CM_REPO;
  const list = (await repo.list('emergency_contacts')).slice()
     .sort((a,b)=> (a.sort_order||0)-(b.sort_order||0) || (a.label||'').localeCompare(b.label||''));
  const meta = await repo.meta();
  const cats = E.getList(meta, 'emergency_categories');
  const el = document.getElementById('tab-emergency');

  const cards = list.map(c => {
    const icon = CAT_ICON[c.category] || 'fa-phone';
    return `<div class="kpi" style="display:flex;flex-direction:column;gap:2px">
      <div class="kpi-label"><i class="fa-solid ${icon}"></i> ${E.esc(c.category||'')}</div>
      <div style="font-weight:600">${E.esc(c.label)}</div>
      <a href="tel:${E.esc(c.phone)}" class="kpi-val text-primary" style="font-size:16px"><i class="fa-solid fa-phone" style="font-size:11px"></i> ${E.esc(c.phone)}</a>
      <div class="flex gap-2" style="margin-top:4px">
        <button class="del-btn" title="Edit" onclick="editEmergency('${c.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" title="Delete" onclick="deleteEmergency('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card">
      <h2><i class="fa-solid fa-kit-medical"></i> Add Emergency Contact</h2>
      <div class="form-grid">
        <div class="form-group"><label>Label *</label><input class="inp" id="em-label" placeholder="e.g. Local Police Station"></div>
        <div class="form-group"><label>Phone *</label><input class="inp" id="em-phone" placeholder="191"></div>
        <div class="form-group"><label>Category</label>
          <select class="inp" id="em-category">${cats.map(c=>`<option value="${E.esc(c)}">${E.esc(c)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Sort Order</label><input class="inp inp-num" id="em-sort_order" type="number" step="1" placeholder="0"></div>
        <div class="form-group" style="justify-content:flex-end">
          <button class="btn btn-primary" id="em-save" onclick="saveEmergency()"><i class="fa-solid fa-plus"></i> Add Contact</button>
        </div>
      </div>
      <input type="hidden" id="em-edit-id" value="">
      <p class="text-muted" style="font-size:10px;margin-top:6px">Common Thai numbers: Police 191 \u00b7 Fire 199 \u00b7 Medical/Rescue 1669 \u00b7 Tourist Police 1155. Lower sort order shows first.</p>
    </div>

    <div class="card">
      <h2><i class="fa-solid fa-phone-volume"></i> Emergency Contacts</h2>
      ${list.length ? `<div class="kpi-grid">${cards}</div>`
                    : `<p class="text-muted" style="padding:8px">No emergency contacts yet. Add your first one above.</p>`}
    </div>`;
}

async function saveEmergency(){
  const g = id => document.getElementById(id).value.trim();
  const label = g('em-label'), phone = g('em-phone');
  if(!label || !phone){ E.toast('Label and Phone are required'); return; }
  const rec = {
    label, phone,
    category: document.getElementById('em-category').value,
    sort_order: parseInt(document.getElementById('em-sort_order').value)||0
  };
  const editId = document.getElementById('em-edit-id').value;
  if(editId){ await window.CM_REPO.update('emergency_contacts', editId, rec); E.toast('Contact updated'); }
  else { await window.CM_REPO.add('emergency_contacts', rec); E.toast('Contact added'); }
  clearEmergencyForm();
  renderEmergency();
}

async function editEmergency(id){
  const c = await window.CM_REPO.get('emergency_contacts', id);
  if(!c) return;
  const s = (k,v)=>{ const e=document.getElementById(k); if(e) e.value = (v==null?'':v); };
  s('em-label', c.label); s('em-phone', c.phone);
  s('em-category', c.category||'other'); s('em-sort_order', c.sort_order||0);
  document.getElementById('em-edit-id').value = id;
  document.getElementById('em-save').innerHTML = '<i class="fa-solid fa-check"></i> Update';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteEmergency(id){
  if(!confirm('Delete this emergency contact?')) return;
  await window.CM_REPO.remove('emergency_contacts', id);
  E.toast('Contact deleted');
  renderEmergency();
}

function clearEmergencyForm(){
  ['em-label','em-phone','em-sort_order'].forEach(k=>{const e=document.getElementById(k);if(e)e.value='';});
  const cat=document.getElementById('em-category'); if(cat) cat.value='police';
  const idf=document.getElementById('em-edit-id'); if(idf) idf.value='';
  const btn=document.getElementById('em-save'); if(btn) btn.innerHTML='<i class="fa-solid fa-plus"></i> Add Contact';
}

window.renderEmergency = renderEmergency;
window.saveEmergency = saveEmergency;
window.editEmergency = editEmergency;
window.deleteEmergency = deleteEmergency;
window.clearEmergencyForm = clearEmergencyForm;
