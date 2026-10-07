/* repo-sheet.js - Phase 2 GoogleSheetRepo, LOCAL-FIRST (cache + background sync).
   Same async interface as LocalRepo.
   - LOAD: returns the localStorage cache INSTANTLY, then fetches the Sheet in the
     background; if the Sheet differs, updates the cache and re-renders the current tab.
   - SAVE: writes localStorage immediately (UI never waits), then pushes the whole
     object to the Sheet in the background (debounced; coalesces rapid edits).
   - If a push fails (offline etc.) the data stays in localStorage with a "dirty" flag
     and is retried on next load / next save. Dirty local data is NEVER overwritten by
     the background pull.
   CONFIG: window.CM_SHEET_CFG = { endpoint, writeToken, readToken } (config-sheet.js).
   If not configured, this file is a no-op and LocalRepo stays in charge. */
(function(){
  try {
    var cfg = window.CM_SHEET_CFG;
    if(!cfg || !cfg.endpoint || cfg.endpoint.indexOf('http')!==0){ return; }
    var CM_DATA = window.CM_DATA || {};
    var SKEY = CM_DATA.SKEY || 'community_manager_v1';   // same key as LocalRepo -> shared cache
    var DIRTY_KEY = SKEY + '_dirty';
    var defaultData = CM_DATA.defaultData;
    var migrate = CM_DATA.migrate;
    var uid = (window.CM_UTIL && window.CM_UTIL.uid) ? window.CM_UTIL.uid
              : function(){ return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); };

    /* Client-side date repair (independent of Apps Script deploy version).
       Sheets coerces '2026-08' / '2026-11-14' into Date cells, which come back as UTC ISO
       strings like '2026-07-31T17:00:00.000Z'. Convert back to Bangkok local text:
       keys containing 'period' -> yyyy-MM, everything else -> yyyy-MM-dd. */
    var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    function _isoToLocal(v, key){
      var t = new Date(v).getTime(); if(isNaN(t)) return v;
      var s = new Date(t + 7*3600*1000).toISOString(); // UTC+7, no DST
      return /period/i.test(key||'') ? s.slice(0,7) : s.slice(0,10);
    }
    function _fixDates(o, key){
      if(typeof o === 'string') return ISO_RE.test(o) ? _isoToLocal(o, key) : o;
      if(Array.isArray(o)){ for(var i=0;i<o.length;i++) o[i] = _fixDates(o[i], key); return o; }
      if(o && typeof o === 'object'){ Object.keys(o).forEach(function(k){ o[k] = _fixDates(o[k], k); }); return o; }
      return o;
    }
    window.CM_FIX_DATES = _fixDates;

    /* ---------- small sync-status badge (bottom-right) ---------- */
    function _status(txt, color){
      try{
        var el = document.getElementById('cm-sync-badge');
        if(!el){
          el = document.createElement('div'); el.id = 'cm-sync-badge';
          el.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9999;font-size:10px;padding:3px 8px;border-radius:10px;background:var(--bg3,#eee);color:var(--text2,#555);border:1px solid var(--border,#ddd);opacity:.9;pointer-events:none';
          (document.body||document.documentElement).appendChild(el);
        }
        el.textContent = txt; el.style.color = color || '';
        clearTimeout(el._t);
        if(/synced/i.test(txt)) el._t = setTimeout(function(){ el.style.display='none'; }, 2500);
        el.style.display = '';
      }catch(e){}
    }

    function _readCache(){
      try{ var raw = localStorage.getItem(SKEY); return raw ? migrate(_fixDates(JSON.parse(raw))) : null; }catch(e){ return null; }
    }
    function _writeCache(d){ try{ localStorage.setItem(SKEY, JSON.stringify(d)); }catch(e){} }
    function _isDirty(){ try{ return localStorage.getItem(DIRTY_KEY)==='1'; }catch(e){ return false; } }
    function _setDirty(v){ try{ v ? localStorage.setItem(DIRTY_KEY,'1') : localStorage.removeItem(DIRTY_KEY); }catch(e){} }

    function _rerender(){
      try{
        var tab = (location.hash||'').replace('#','') || 'dashboard';
        // Don't yank an open edit form out from under the user.
        var fw = document.getElementById('bl-form-wrap');
        if(fw && fw.style.display!=='none' && document.getElementById('bl-edit-id') && document.getElementById('bl-edit-id').value) return;
        if(typeof window.switchTab === 'function') window.switchTab(tab);
      }catch(e){}
    }

    function GoogleSheetRepo(){ this._d = null; this._pushTimer = null; this._pushing = null; this._gen = 0; }

    GoogleSheetRepo.prototype._get = function(action){
      var tk = encodeURIComponent(cfg.readToken || cfg.writeToken);
      var url = cfg.endpoint + '?action=' + encodeURIComponent(action) + '&token=' + tk + '&t=' + Date.now();
      return fetch(url, { method:'GET' }).then(function(r){ return r.json(); });
    };
    GoogleSheetRepo.prototype._post = function(payload){
      payload.token = cfg.writeToken;
      return fetch(cfg.endpoint, {
        method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
      }).then(function(r){ return r.json(); });
    };

    /* Background pull from the Sheet. Skipped if local has unpushed edits. */
    GoogleSheetRepo.prototype._pull = function(){
      var self = this;
      if(_isDirty()){ self._schedulePush(0); return; }   // push local edits first
      var genAtStart = self._gen;   // RACE GUARD: discard a pull that started before a local edit
      _status('\u21bb syncing\u2026');
      self._get('all').then(function(res){
        if(!res || !res.ok) throw new Error((res && res.error) || 'load failed');
        if(_isDirty() || self._gen !== genAtStart) return;   // edited since fetch began - keep local
        var remote = migrate(_fixDates(res.data || {}));
        var changed = JSON.stringify(remote) !== JSON.stringify(self._d);
        if(changed){ self._d = remote; _writeCache(remote); _rerender(); }
        _status('\u2713 synced', 'var(--success,#2a7)');
      }).catch(function(err){
        console.warn('Sheet pull failed:', err);
        _status('\u26a0 offline (local data)', 'var(--danger,#c33)');
      });
    };

    GoogleSheetRepo.prototype._load = function(){
      if(this._d) return this._d;
      var cached = _readCache();
      var self = this;
      if(cached){
        this._d = cached;
        setTimeout(function(){ self._pull(); }, 0);       // refresh in background
        return this._d;
      }
      // First run on this device (no cache): must wait for the Sheet once.
      return null;
    };
    GoogleSheetRepo.prototype._ensure = async function(){
      if(this._load()) return this._d;
      _status('\u21bb loading from Sheet\u2026');
      var res = await this._get('all');
      if(!res || !res.ok) throw new Error((res && res.error) || 'load failed');
      this._d = migrate(_fixDates(res.data || {}));
      _writeCache(this._d);
      _status('\u2713 synced', 'var(--success,#2a7)');
      return this._d;
    };

    /* Save: local now, Sheet later (debounced 800ms so bulk edits = 1 push). */
    GoogleSheetRepo.prototype._push = function(){
      this._gen++; _writeCache(this._d); _setDirty(true);
      this._schedulePush(800);
      return Promise.resolve(true);
    };
    GoogleSheetRepo.prototype._schedulePush = function(delay){
      var self = this;
      clearTimeout(self._pushTimer);
      self._pushTimer = setTimeout(function(){ self._doPush(); }, delay);
    };
    GoogleSheetRepo.prototype._doPush = function(){
      var self = this;
      if(self._pushing){ self._schedulePush(800); return; }  // one push at a time
      _status('\u2191 saving to Sheet\u2026');
      var snapshot = JSON.stringify(self._d);
      self._pushing = self._post({ action:'replaceAll', data: JSON.parse(snapshot) }).then(function(res){
        if(!res || !res.ok) throw new Error((res && res.error) || 'save failed');
        if(JSON.stringify(self._d) === snapshot) _setDirty(false);   // no newer edits meanwhile
        else self._schedulePush(800);
        _status('\u2713 synced', 'var(--success,#2a7)');
      }).catch(function(err){
        console.warn('Sheet push failed (kept locally, will retry):', err);
        _status('\u26a0 not saved to Sheet yet - will retry', 'var(--danger,#c33)');
        self._schedulePush(30000);
      }).then(function(){ self._pushing = null; });
    };

    GoogleSheetRepo.prototype.all = async function(){ await this._ensure(); return this._d; };
    GoogleSheetRepo.prototype.replaceAll = async function(obj){ await this._ensure(); this._d = migrate(obj); await this._push(); return this._d; };
    GoogleSheetRepo.prototype.meta = async function(){ await this._ensure(); return this._d.meta; };
    GoogleSheetRepo.prototype.setMeta = async function(patch){ await this._ensure(); Object.assign(this._d.meta, patch); await this._push(); return this._d.meta; };
    GoogleSheetRepo.prototype.list = async function(coll){ await this._ensure(); return this._d[coll] || []; };
    GoogleSheetRepo.prototype.get = async function(coll, id){ await this._ensure(); return (this._d[coll]||[]).find(function(x){return x.id===id;}) || null; };
    GoogleSheetRepo.prototype.add = async function(coll, obj){
      await this._ensure();
      var rec = Object.assign({ id: uid() }, obj);
      if(!this._d[coll]) this._d[coll] = [];
      this._d[coll].push(rec); await this._push(); return rec;
    };
    GoogleSheetRepo.prototype.update = async function(coll, id, patch){
      await this._ensure();
      var rec = (this._d[coll]||[]).find(function(x){return x.id===id;});
      if(rec){ Object.assign(rec, patch); await this._push(); }
      return rec || null;
    };
    GoogleSheetRepo.prototype.remove = async function(coll, id){
      await this._ensure();
      var arr = this._d[coll] || [];
      var i = arr.findIndex(function(x){return x.id===id;});
      if(i>=0){ arr.splice(i,1); await this._push(); return true; }
      return false;
    };
    GoogleSheetRepo.prototype.bumpReceipt = async function(){
      await this._ensure();
      if(!this._d.counters) this._d.counters = { receipt_seq: 0 };
      this._d.counters.receipt_seq = (this._d.counters.receipt_seq||0) + 1;
      await this._push();
      return this._d.counters.receipt_seq;
    };
    /* Manual "sync now" hook (e.g. for a Settings button or console). */
    GoogleSheetRepo.prototype.syncNow = function(){ if(_isDirty()) this._schedulePush(0); else this._pull(); };

    // Warn before closing the tab if edits haven't reached the Sheet yet.
    window.addEventListener('beforeunload', function(e){
      if(_isDirty()){ e.preventDefault(); e.returnValue = ''; }
    });

    window.CM_REPO = new GoogleSheetRepo();
    window.CM_REPO_KIND = 'sheet';
  } catch(err){
    if(window.cmDiag) window.cmDiag('repo-sheet.js failed: ' + (err && (err.stack||err.message) || err));
    console.error('repo-sheet.js failed:', err);
  }
})();
