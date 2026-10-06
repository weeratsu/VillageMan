/****************************************************************
 * VillageMan - Phase 2 backend (Google Apps Script web app)
 * TABLE MODEL: one tab per collection, header row = field names,
 * one row per record. Human-readable: you can open the Sheet and
 * read / sort / pivot the data directly.
 *
 * The app is the OWNER of the data: it loads all, edits, and pushes
 * the whole dataset back (each collection tab is cleared & rewritten).
 * Edit through the app, not by hand in the Sheet, to avoid clobbering.
 *
 * SETUP: see PHASE2_SETUP.md. In short:
 *   1. Create a Sheet (tabs are auto-created on first write).
 *   2. Paste this as Code.gs, set SHEET_ID + WRITE_TOKEN + READ_TOKEN.
 *   3. Deploy > Web app (Execute as: Me, Access: Anyone). Copy /exec URL.
 *
 * API:
 *   GET  ?token=[REDACTED_PARAM]&action=all   -> {ok:true, data:{...}}
 *   POST {token, action:"replaceAll", data}   -> {ok:true}
 *   GET/POST action=ping                       -> {ok:true, now:...}
 ****************************************************************/

var SHEET_ID    = '1_ad-yvaQHbfcaJ7_BuspxdTSsfG_F9-P-TeeAVu1dpw';
var WRITE_TOKEN = 'vm_w_lc1ZEeSzjcc-8DmcJ8kWHk4sL616CKBr';
var READ_TOKEN  = 'vm_r_9ucRrM3zSdoCyN3X95BXOvlFByKm9Bvu';

// Collections stored as row-per-record tables. Column order is taken from the
// union of keys actually present (id first), so new fields appear automatically.
var COLLECTIONS = ['households','fee_types','fee_charges','payments','expenses',
                   'meters','utility_bills','vendors','emergency_contacts'];
// Nested meta fields that must be JSON-encoded in the key-value meta tab.
var META_JSON_KEYS = { lists:1, tariff:1, rates:1 };

function _ss(){ return SpreadsheetApp.openById(SHEET_ID); }
function _tab(name){
  var ss=_ss(); var sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  return sh;
}
function _json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function _emptyData(){
  return {
    meta:{ version:1, currency:'THB', promptpay_id:'', estate_name:'', lists:{}, tariff:[], rates:{} },
    households:[], fee_types:[], fee_charges:[], payments:[], expenses:[],
    meters:[], utility_bills:[], vendors:[], emergency_contacts:[],
    counters:{ receipt_seq:0 }
  };
}

/* ---------- READ: tables -> object ---------- */
function _readCollection(name){
  var sh=_ss().getSheetByName(name); if(!sh) return [];
  var rng=sh.getDataRange().getValues();
  if(rng.length<2) return [];
  var headers=rng[0], out=[];
  for(var r=1;r<rng.length;r++){
    var row=rng[r], blank=true, rec={};
    for(var c=0;c<headers.length;c++){
      var key=headers[c]; if(key==='') continue;
      var val=row[c];
      if(val!=='' && val!=null) blank=false;
      rec[key]=_decode(val, key);
    }
    if(!blank) out.push(rec);
  }
  return out;
}
function _readMeta(){
  var base=_emptyData().meta;
  var sh=_ss().getSheetByName('meta'); if(!sh) return base;
  var rng=sh.getDataRange().getValues();
  for(var r=1;r<rng.length;r++){
    var k=rng[r][0]; if(k===''||k==null) continue;
    var v=rng[r][1];
    base[k]= META_JSON_KEYS[k] ? _safeParse(v, base[k]) : _decode(v);
  }
  return base;
}
function _readCounters(){
  var sh=_ss().getSheetByName('counters'); if(!sh) return { receipt_seq:0 };
  var rng=sh.getDataRange().getValues(), out={ receipt_seq:0 };
  for(var r=1;r<rng.length;r++){ var k=rng[r][0]; if(k) out[k]=Number(rng[r][1])||0; }
  return out;
}
function _readAll(){
  var d=_emptyData();
  COLLECTIONS.forEach(function(c){ d[c]=_readCollection(c); });
  d.meta=_readMeta();
  d.counters=_readCounters();
  return d;
}

/* ---------- WRITE: object -> tables ---------- */
function _writeCollection(name, arr){
  var sh=_tab(name); sh.clear();
  arr=arr||[];
  // union of keys, id first
  var keys=[], seen={};
  if(arr.length){
    arr.forEach(function(rec){ Object.keys(rec||{}).forEach(function(k){ if(!seen[k]){ seen[k]=1; keys.push(k); } }); });
    keys.sort(function(a,b){ if(a==='id')return -1; if(b==='id')return 1; return 0; });
  } else {
    keys=['id'];
  }
  var rows=[keys];
  arr.forEach(function(rec){
    rows.push(keys.map(function(k){ return _encode(rec[k]); }));
  });
  var rg=sh.getRange(1,1,rows.length,keys.length); rg.setNumberFormats(_fmts(rows)); rg.setValues(rows);
}
function _writeMeta(meta){
  var sh=_tab('meta'); sh.clear();
  var rows=[['key','value']];
  Object.keys(meta||{}).forEach(function(k){
    var v = META_JSON_KEYS[k] ? JSON.stringify(meta[k]) : _encode(meta[k]);
    rows.push([k, v]);
  });
  var rg=sh.getRange(1,1,rows.length,2); rg.setNumberFormats(_fmts(rows)); rg.setValues(rows);
}
function _writeCounters(counters){
  var sh=_tab('counters'); sh.clear();
  var rows=[['key','value']];
  Object.keys(counters||{}).forEach(function(k){ rows.push([k, counters[k]]); });
  sh.getRange(1,1,rows.length,2).setValues(rows);
}
function _writeAll(d){
  d=d||_emptyData();
  COLLECTIONS.forEach(function(c){ _writeCollection(c, d[c]||[]); });
  _writeMeta(d.meta||_emptyData().meta);
  _writeCounters(d.counters||{ receipt_seq:0 });
}

/* ---------- cell encode/decode ----------
   Objects/arrays -> JSON string; everything else stored as-is.
   On read, strings that look like JSON objects/arrays are parsed back. */
function _encode(v){
  if(v==null) return '';
  if(typeof v==='object') return JSON.stringify(v);
  return v;
}
function _decode(v, key){
  if(Object.prototype.toString.call(v)==='[object Date]'){
    return Utilities.formatDate(v,'Asia/Bangkok', key==='period'?'yyyy-MM':'yyyy-MM-dd');
  }
  if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)){
    return Utilities.formatDate(new Date(v),'Asia/Bangkok', key==='period'?'yyyy-MM':'yyyy-MM-dd');
  }
  if(typeof v==='string'){
    var s=v.trim();
    if((s.charAt(0)==='{'&&s.charAt(s.length-1)==='}')||(s.charAt(0)==='['&&s.charAt(s.length-1)===']')){
      return _safeParse(s, v);
    }
  }
  return v;
}
function _fmts(rows){ return rows.map(function(r){ return r.map(function(v){ return (typeof v==='string')?'@':'General'; }); }); }
function _safeParse(s, fallback){ try{ return JSON.parse(s); }catch(e){ return fallback; } }

/* ---------- PUBLIC (VillageManPublic website) ----------
   No token. Mirrors the app's exportPublicData() whitelist exactly: operational/metered data only.
   NEVER add households, vendors, emergency_contacts, payments, fee_*, expenses, promptpay_id,
   invoice_path / receipt_path / notes here - this endpoint is readable by anyone with the URL. */
function _publicData(){
  var meters=_readCollection('meters').map(function(m){
    return { id:m.id, purpose:m.purpose||'', utility_type:m.utility_type||'', provider:m.provider||'',
             ca_no:String(m.ca_no==null?'':m.ca_no), installation:String(m.installation==null?'':m.installation),
             meter_no:String(m.meter_no==null?'':m.meter_no), role:m.role||'main', parent_meter_id:m.parent_meter_id||'' };
  });
  var N=function(v){ return Number(v)||0; };
  var bills=_readCollection('utility_bills').map(function(b){
    return {
      id:b.id, meter_id:b.meter_id, period:b.period||'', utility_type:b.utility_type||'',
      units_used:N(b.units_used), prev_reading:N(b.prev_reading), present_reading:N(b.present_reading),
      energy_charge:N(b.energy_charge), vat:N(b.vat), total_amount:N(b.total_amount),
      paid:(b.paid===true||b.paid==='true'), paid_date:b.paid_date||'', due_date:b.due_date||'',
      split_meter:(b.split_meter===true||b.split_meter==='true'), home_only:(b.home_only===true||b.home_only==='true'),
      bill_total:N(b.bill_total), central_meter_no:String(b.central_meter_no==null?'':b.central_meter_no),
      central_prev:N(b.central_prev), central_present:N(b.central_present), central_units:N(b.central_units),
      central_energy:N(b.central_energy), central_ft:N(b.central_ft), central_vat:N(b.central_vat),
      central_amount:N(b.central_amount), home_units:N(b.home_units), home_amount:N(b.home_amount)
    };
  });
  var meta=_readMeta();
  return { generated_at:new Date().toISOString(), estate_name:meta.estate_name||'', meters:meters, utility_bills:bills };
}

/* ---------- HTTP ---------- */
function doGet(e){
  try{
    var p=(e&&e.parameter)?e.parameter:{};
    if((p.action||'all')==='ping') return _json({ ok:true, now:new Date().toISOString() });
    // PUBLIC: no token needed - returns ONLY whitelisted bill/meter fields (see _publicData).
    if(p.action==='public') return _json({ ok:true, data:_publicData() });
    if(p.token!==READ_TOKEN && p.token!==WRITE_TOKEN) return _json({ ok:false, error:'bad token' });
    return _json({ ok:true, data:_readAll() });
  }catch(err){ return _json({ ok:false, error:String(err) }); }
}
function doPost(e){
  try{
    var body={}; if(e&&e.postData&&e.postData.contents) body=JSON.parse(e.postData.contents);
    if((body.action||'')==='ping') return _json({ ok:true, now:new Date().toISOString() });
    if(body.token!==WRITE_TOKEN) return _json({ ok:false, error:'bad token' });
    if(body.action==='replaceAll'){
      if(typeof body.data!=='object'||body.data==null) return _json({ ok:false, error:'no data' });
      var lock=LockService.getScriptLock(); lock.waitLock(20000);
      try{ _writeAll(body.data); } finally{ lock.releaseLock(); }
      return _json({ ok:true });
    }
    return _json({ ok:false, error:'unknown action' });
  }catch(err){ return _json({ ok:false, error:String(err) }); }
}
