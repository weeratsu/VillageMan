/* repo.js — THE SWAP POINT.
   All data access goes through a Repository. UI modules NEVER touch storage directly.

   Phase 1: LocalRepo  -> browser localStorage (this file).
   Phase 2: GoogleSheetRepo -> Apps Script web app reading a private Google Sheet.

   Every method is async so Phase 2's network calls slot in without changing callers. */

(function(){
  try {
    var CM_DATA = window.CM_DATA || {};
    var SKEY = CM_DATA.SKEY || 'community_manager_v1';
    var defaultData = CM_DATA.defaultData;
    var migrate = CM_DATA.migrate;
    var uid = (window.CM_UTIL && window.CM_UTIL.uid) ? window.CM_UTIL.uid
              : function(){ return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); };

    if(typeof defaultData !== 'function' || typeof migrate !== 'function'){
      throw new Error('CM_DATA not ready (data.js must load before repo.js)');
    }

    function LocalRepo(){ this._d = this._load(); }
    LocalRepo.prototype._load = function(){
      try {
        var raw = localStorage.getItem(SKEY);
        return raw ? migrate(JSON.parse(raw)) : defaultData();
      } catch(e){ return defaultData(); }
    };
    LocalRepo.prototype._save = function(){
      try { localStorage.setItem(SKEY, JSON.stringify(this._d)); } catch(e){}
    };
    LocalRepo.prototype.all = async function(){ return this._d; };
    LocalRepo.prototype.replaceAll = async function(obj){ this._d = migrate(obj); this._save(); return this._d; };
    LocalRepo.prototype.meta = async function(){ return this._d.meta; };
    LocalRepo.prototype.setMeta = async function(patch){ Object.assign(this._d.meta, patch); this._save(); return this._d.meta; };
    LocalRepo.prototype.list = async function(coll){ return this._d[coll] || []; };
    LocalRepo.prototype.get = async function(coll, id){ return (this._d[coll]||[]).find(function(x){return x.id===id;}) || null; };
    LocalRepo.prototype.add = async function(coll, obj){
      var rec = Object.assign({ id: uid() }, obj);
      if(!this._d[coll]) this._d[coll] = [];
      this._d[coll].push(rec); this._save(); return rec;
    };
    LocalRepo.prototype.update = async function(coll, id, patch){
      var rec = (this._d[coll]||[]).find(function(x){return x.id===id;});
      if(rec){ Object.assign(rec, patch); this._save(); }
      return rec || null;
    };
    LocalRepo.prototype.remove = async function(coll, id){
      var arr = this._d[coll] || [];
      var i = arr.findIndex(function(x){return x.id===id;});
      if(i>=0){ arr.splice(i,1); this._save(); return true; }
      return false;
    };
    LocalRepo.prototype.bumpReceipt = async function(){
      if(!this._d.counters) this._d.counters = { receipt_seq: 0 };
      this._d.counters.receipt_seq = (this._d.counters.receipt_seq||0) + 1;
      this._save();
      return this._d.counters.receipt_seq;
    };

    window.CM_REPO = new LocalRepo();
  } catch(err){
    if(window.cmDiag) window.cmDiag('repo.js failed: ' + (err && (err.stack || err.message) || err));
    else { window.__CM_REPO_ERR__ = err; }
    // Re-throw so it still shows in console, but diagnostic already captured it.
    console.error('repo.js failed:', err);
  }
})();
