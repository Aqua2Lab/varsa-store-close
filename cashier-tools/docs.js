/* Varsa document apps engine (Invoice Upload, Check Upload, Missing Price, Void / No-Sale)
 * Page sets window.DOC = {kind, pre, who, nameKey, storeKey, fileReq, title(r), meta(r), onReady(api)}
 * Uses WEB_APP_URL + STORES from config.js. Files are sent as base64 to the Apps Script,
 * which saves them in Drive and logs a row in "Varsa Invoices & Checks Log".
 */
(function () {
  const D = window.DOC, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('#docForm'), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STORE_LABEL = { 'Thomasville Chevron': 'Thomasville Chevron (Store 9)', 'Thomasville OutRun': 'Thomasville Outrun (Store 10)' };
  const ready = /^https:\/\/script\.google\.com\//.test(WEB_APP_URL);
  const toast = $('#toast') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' }));
  const say = (m, bad, ms) => { toast.textContent = m; toast.classList.toggle('fail', !!bad); toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), ms || 4200); };
  const pad = n => String(n).padStart(2, '0');
  const local = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString();
  const newId = p => { const d = new Date(); return p + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' + Math.floor(1000 + Math.random() * 9000); };

  // Store dropdowns (form + list filter)
  $$('select[data-stores]').forEach(s => { s.innerHTML = (s.dataset.stores === 'all' ? '<option value="">All stores</option>' : '<option value="">Choose store…</option>') + STORES.concat(s.dataset.extra ? s.dataset.extra.split('|') : []).map(x => `<option value="${esc(x)}">${esc(STORE_LABEL[x] || x)}</option>`).join(''); });
  // Chips
  $$('.chips[data-options]').forEach(box => { box.innerHTML = box.dataset.options.split('|').map(o => `<label><input type="radio" name="${box.dataset.name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join(''); });
  const defaults = () => { $$('[data-today]', form).forEach(i => i.value = local().slice(0, 10)); $$('[data-now]', form).forEach(i => i.value = local().slice(0, 16)); };
  defaults();
  const who = $(`[name="${D.who}"]`, form), storeSel = $('[name=store]', form);
  if (who) who.value = localStorage.getItem(D.nameKey) || '';
  if (localStorage.getItem(D.storeKey)) storeSel.value = localStorage.getItem(D.storeKey);

  const val = n => { const els = $$(`[name="${n}"]`, form); if (!els.length) return ''; if (els[0].type === 'radio') { const c = els.find(e => e.checked); return c ? c.value : ''; } if (els[0].type === 'checkbox') return els[0].checked ? 'Yes' : 'No'; return els[0].value.trim(); };
  const refresh = () => $$('[data-if]', form).forEach(el => { const [f, v] = el.dataset.if.split('='); const show = v.split('|').includes(val(f)); el.classList.toggle('hidden', !show); });
  form.addEventListener('change', refresh); form.addEventListener('input', e => { e.target.classList.remove('invalid'); const er = (e.target.closest('.chips') || e.target).nextElementSibling; if (er && er.classList.contains('err')) er.textContent = ''; });
  refresh();

  // ===== Files =====
  let files = [];
  const list = $('#fileList');
  function drawFiles() {
    list.innerHTML = files.map((f, i) => `<div class="fileitem">${f.thumb ? `<img src="${f.thumb}" alt="">` : '<div class="pdfic">PDF</div>'}<div><b>${esc(f.name)}</b><small>${(f.size / 1024).toFixed(0)} KB</small></div><button type="button" class="mini" data-rm="${i}">✕</button></div>`).join('');
    $$('[data-rm]', list).forEach(b => b.onclick = () => { files.splice(+b.dataset.rm, 1); drawFiles(); });
    const e = $('#fileErr'); if (e && files.length) e.textContent = '';
  }
  const readB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
  function shrink(f) {
    return new Promise(ok => {
      const img = new Image();
      img.onload = () => { const k = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const u = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(img.src); ok({ mime: 'image/jpeg', data: u.split(',')[1], thumb: c.toDataURL('image/jpeg', 0.4), size: Math.round(u.length * 0.75) }); };
      img.onerror = () => ok(null); img.src = URL.createObjectURL(f);
    });
  }
  $$('input[type=file][data-file]').forEach(inp => inp.addEventListener('change', async () => {
    for (const f of inp.files) {
      if (files.length >= 10) { say('Max 10 files per entry', true); break; }
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf && !/^image\//.test(f.type)) { say('Only PDF or image files', true); continue; }
      if (f.size > 15 * 1024 * 1024) { say(f.name + ' is over 15 MB', true); continue; }
      let item = null;
      if (!isPdf) item = await shrink(f);
      if (!item) item = { mime: isPdf ? 'application/pdf' : f.type, data: await readB64(f), size: f.size };
      item.name = f.name || ('photo-' + (files.length + 1) + '.jpg'); files.push(item);
    }
    inp.value = ''; drawFiles();
  }));

  // ===== JSONP read =====
  function get(params) {
    return new Promise((ok, no) => {
      if (!ready) return no(new Error('not set up'));
      const cb = 'vd' + Date.now() + Math.floor(Math.random() * 1e4), sc = document.createElement('script');
      const done = () => { delete window[cb]; sc.remove(); clearTimeout(t); };
      const t = setTimeout(() => { done(); no(new Error('timeout')); }, 25000);
      window[cb] = r => { done(); ok(r); }; sc.onerror = () => { done(); no(new Error('load')); };
      sc.src = WEB_APP_URL + '?' + new URLSearchParams(Object.assign({ docs: D.kind, callback: cb }, params)).toString();
      document.body.appendChild(sc);
    });
  }
  const post = body => fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  async function waitFor(id, test, tries = 10) {
    for (let i = 0; i < tries; i++) { await new Promise(r => setTimeout(r, i ? 2500 : 1500)); try { const r = await get({ id }); const row = r && r.rows && r.rows[0]; if (row && (!test || test(row))) return row; } catch (e) { } }
    return null;
  }

  // ===== Submit =====
  function validate() {
    let first = null; const flag = (el, m) => { first = first || el; const box = el.closest('.chips') || el; let e = box.nextElementSibling; if (!e || !e.classList.contains('err')) { box.insertAdjacentHTML('afterend', '<div class="err"></div>'); e = box.nextElementSibling; } e.textContent = m; if (!el.closest('.chips')) el.classList.add('invalid'); };
    $$('[required]', form).forEach(i => { if (i.closest('.hidden')) return; if (!i.value.trim()) flag(i, 'Required'); });
    $$('.chips[data-req]', form).forEach(b => { if (!b.closest('.hidden') && !val(b.dataset.name)) flag($('input', b), 'Please choose one'); });
    $$('[data-money]', form).forEach(i => { if (i.value.trim() && !/^\$?\s*-?[\d,]*\.?\d+$/.test(i.value.trim())) flag(i, 'Numbers only, e.g. 125.40'); });
    if (D.fileReq && !files.length) { const e = $('#fileErr'); e.textContent = D.fileMsg || 'Add a photo or file'; first = first || e; }
    if (D.validate) { const m = D.validate(val); if (m) { say(m, true); return false; } }
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !first;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) { say('Please fix the highlighted items', true); return; }
    if (!ready) { say('Setup needed: WEB_APP_URL is not set', true); return; }
    const data = { form: 'doc', kind: D.kind, id: newId(D.pre) };
    new Set($$('[name]', form).map(i => i.name)).forEach(n => { const el = $(`[name="${n}"]`, form); if (!el.closest('.hidden')) data[n] = val(n); });
    $$('[data-money]', form).forEach(i => { if (data[i.name]) data[i.name] = data[i.name].replace(/[$,\s]/g, ''); });
    data.files = files.map(f => ({ name: f.name, mime: f.mime, data: f.data }));
    localStorage.setItem(D.nameKey, data[D.who] || ''); localStorage.setItem(D.storeKey, data.store || '');
    const btn = $('button[type=submit]', form), label = btn.textContent; btn.disabled = true; btn.textContent = 'Uploading…';
    try { await post(data); } catch (err) { btn.disabled = false; btn.textContent = label; say('❌ Could not send. Check internet and try again.', true); return; }
    btn.textContent = 'Saving to Drive…';
    const row = await waitFor(data.id, null, 12);
    btn.disabled = false; btn.textContent = label;
    if (row) {
      say('✅ Saved · ' + data.id, false, 6000);
      const keepStore = data.store, keepWho = data[D.who]; form.reset(); files = []; drawFiles(); storeSel.value = keepStore; if (who) who.value = keepWho; defaults(); refresh();
      loadList();
    } else say('⚠️ Sent but not confirmed yet. Check the list below in a minute before re-sending.', true, 8000);
  });

  // ===== List + comments =====
  const listBody = $('#listBody'), filt = $('#listStore'), q = $('#listSearch');
  let rows = [];
  function card(r) {
    const links = String(r._file || '').split('\n').filter(Boolean).map((u, i, a) => `<a href="${esc(u)}" target="_blank" rel="noopener">📎 ${a.length > 1 ? 'File ' + (i + 1) : 'Open file'}</a>`).join(' ');
    const coms = String(r._comments || '').split('\n').filter(Boolean).map(c => `<li>${esc(c)}</li>`).join('');
    return `<div class="entry" data-id="${esc(r._id)}"><div class="e-top"><b>${D.title(r)}</b><span class="badge ${r._status === 'Open' ? 'warn' : 'ok'}">${esc(r._status || '')}</span></div>
<div class="e-meta">${D.meta(r)}</div><div class="e-meta"><small>${esc(r._id)} · ${esc(String(r._ts).replace(/:\d\d$/, ''))} · ${esc(String(r.store).replace('Thomasville ', ''))}</small></div>
${links ? `<div class="e-files">${links}</div>` : ''}<div class="e-com"><b>💬 Comments</b>${coms ? `<ul>${coms}</ul>` : '<div class="muted">No comments yet.</div>'}
<div class="e-add"><input type="text" class="c-by" placeholder="Your name" value="${esc(localStorage.getItem(D.nameKey) || '')}"><textarea class="c-txt" placeholder="Add a comment…"></textarea><button type="button" class="mini c-go">Add comment</button></div></div></div>`;
  }
  function draw() {
    const s = (q.value || '').toLowerCase(), fs = $$('select[data-filter]').filter(f => f.value);
    const list = rows.filter(r => (!s || JSON.stringify(r).toLowerCase().includes(s)) && fs.every(f => String(r[f.dataset.filter]) === f.value));
    listBody.innerHTML = list.length ? list.map(card).join('') : '<div class="muted">No entries yet.</div>';
    $$('.c-go', listBody).forEach(b => b.onclick = () => addComment(b.closest('.entry')));
  }
  async function loadList() {
    if (!ready) { listBody.textContent = 'Not set up yet.'; return; }
    listBody.innerHTML = '<div class="muted">Loading…</div>';
    try { const r = await get({ limit: 50, store: filt.value }); if (!r.ok) throw new Error(r.error); rows = r.rows || []; draw(); if (D.onRows) D.onRows(rows); }
    catch (e) { listBody.innerHTML = '<div class="muted">Could not load past entries. Tap ↻ to retry.</div>'; }
  }
  async function addComment(el) {
    const id = el.dataset.id, by = $('.c-by', el).value.trim(), txt = $('.c-txt', el).value.trim(), btn = $('.c-go', el);
    if (!by || !txt) { say('Enter your name and a comment', true); return; }
    localStorage.setItem(D.nameKey, by); btn.disabled = true; btn.textContent = 'Saving…';
    const cid = Math.random().toString(36).slice(2, 10);
    try { await post({ form: 'doc_comment', kind: D.kind, id, by, comment: txt, cid }); } catch (e) { btn.disabled = false; btn.textContent = 'Add comment'; say('❌ Could not send', true); return; }
    const row = await waitFor(id, r => String(r._comments || '').includes(txt), 8);
    btn.disabled = false; btn.textContent = 'Add comment';
    if (row) { const i = rows.findIndex(r => r._id === id); if (i > -1) rows[i] = row; draw(); say('✅ Comment saved'); }
    else say('⚠️ Comment sent but not confirmed yet. Refresh in a minute.', true);
  }
  $('#listRefresh').onclick = loadList; filt.onchange = loadList; q.oninput = draw; $$('select[data-filter]').forEach(f => f.onchange = draw);
  window.DOC_API = { get, val, form, loadList, say };
  if (D.onReady) D.onReady(window.DOC_API);
  loadList();
})();
