/* Varsa Manager Tools - shared form engine (copy of the Cashier Tools engine)
 * - Page sets window.RECENT_COLS = [[key,label],...] for its Recent entries table
 * - <input type=date data-today> defaults to today; .managers chips list MANAGERS
 * - <div class="chips" data-name="x" data-options="A|B|C" data-req> renders tap buttons
 * - [data-if="field=A|B"] or [data-if="field!=A"] shows a block only when the answer matches
 *   (combine with "&": data-if="a=Yes&b=No"). Hidden blocks are skipped and send blank.
 * - .note[data-block] visible = submission blocked (shown message explains why)
 * - Page may define window.beforeSubmit(data) -> error string to stop, or nothing.
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('form'), FORM_KEY = form.dataset.form;

  // Store selector + cashier name
  const storeBox = $('#storeBox');
  if (storeBox) { storeBox.dataset.options = STORES.join('|'); }
  $$('.vendors').forEach(el => el.dataset.options = VENDORS.join('|'));
  $$('.managers').forEach(el => el.dataset.options = MANAGERS.concat(['Other']).join('|'));

  // Render chips
  $$('.chips[data-options]').forEach(box => {
    const name = box.dataset.name, multi = box.hasAttribute('data-multi');
    box.innerHTML = box.dataset.options.split('|').map(o =>
      `<label><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${o.replace(/"/g, '&quot;')}"><span>${o}</span></label>`).join('');
    box.insertAdjacentHTML('afterend', '<div class="err"></div>');
  });
  $$('input[required],select[required],textarea[required]').forEach(i => {
    if (!i.nextElementSibling || !i.nextElementSibling.classList.contains('err')) i.insertAdjacentHTML('afterend', '<div class="err"></div>');
  });

  const val = name => {
    const els = $$(`[name="${name}"]`, form).filter(e => !e.disabled);
    if (!els.length) return '';
    if (els[0].type === 'radio') { const c = els.find(e => e.checked); return c ? c.value : ''; }
    if (els[0].type === 'checkbox') return els.filter(e => e.checked).map(e => e.value).join(', ');
    return els[0].value.trim();
  };
  window.val = val;

  function test(cond) {
    return cond.split('&').every(part => {
      const neg = part.includes('!='), [f, v] = part.split(neg ? '!=' : '=');
      const cur = val(f.trim()), list = v.split('|').map(s => s.trim());
      const hit = list.includes(cur) || (list.includes('*') && cur !== '');
      return neg ? (cur !== '' && !hit) : hit;
    });
  }
  function refresh() {
    // run a few passes so nested conditions settle; page hook can set computed flags
    for (let n = 0; n < 3; n++) { if (window.onChange) window.onChange(); $$('[data-if]').forEach(el => {
      const show = test(el.dataset.if);
      el.classList.toggle('hidden', !show);
      $$('input,select,textarea', el).forEach(i => i.disabled = !show || !!i.closest('.hidden'));
    }); }
  }
  window.refresh = refresh;
  form.addEventListener('input', e => { clearErr(e.target); refresh(); });
  form.addEventListener('change', e => { clearErr(e.target); refresh(); });
  function clearErr(t) {
    t.classList.remove('invalid');
    const box = t.closest('.chips'); const e = (box || t).nextElementSibling;
    if (e && e.classList.contains('err')) e.textContent = '';
  }

  // Remember store + cashier
  const nameI = $('[name=cashier]');
  if (nameI) nameI.value = localStorage.getItem('vm_name') || '';
  const lastStore = localStorage.getItem('vm_store');
  if (lastStore) { const r = $$('[name=store]').find(r => r.value === lastStore); if (r) r.checked = true; }
  $$('[data-default]').forEach(i => i.value = i.dataset.default);
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const setToday = () => $$('[data-today]').forEach(i => i.value = i.dataset.today === 'yesterday' ? new Date(new Date(today()) - 864e5).toISOString().slice(0, 10) : today());
  setToday();
  refresh();

  function validate() {
    let ok = true, first = null;
    const flag = (el, msg) => { ok = false; first = first || el; const box = el.closest('.chips') || el; const e = box.nextElementSibling; if (e && e.classList.contains('err')) e.textContent = msg; if (!el.closest('.chips')) el.classList.add('invalid'); };
    $$('.chips[data-req]').forEach(b => { if (b.closest('.hidden')) return; if (!val(b.dataset.name)) flag($('input', b), 'Please choose one'); });
    $$('input[required],select[required],textarea[required]').forEach(i => { if (i.disabled || i.closest('.hidden')) return; if (!i.value.trim()) flag(i, 'Required'); else if (i.type === 'number' && parseFloat(i.value) < 0) flag(i, 'Must be 0 or more'); });
    const block = $$('.note[data-block]').find(n => !n.classList.contains('hidden') && !n.closest('.hidden'));
    if (block) { ok = false; first = first || block; }
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return ok;
  }


  // ===== Recent entries table (same page) =====
  const COLS = window.RECENT_COLS || [];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wrap = document.createElement('div'); wrap.className = 'card recent';
  wrap.innerHTML = '<div class="recent-head"><b>Recent entries</b><button type="button" class="mini">↻ Refresh</button></div><div class="recent-body muted">Loading…</div>';
  form.insertAdjacentElement('afterend', wrap);
  const body = $('.recent-body', wrap);
  function loadRecent() {
    if (!/^https:\/\/script\.google\.com\//.test(WEB_APP_URL)) { body.textContent = 'Not set up yet.'; return; }
    const store = val('store'), cb = 'vcRecent' + Date.now();
    body.textContent = 'Loading…';
    const sc = document.createElement('script');
    const done = () => { delete window[cb]; sc.remove(); };
    window[cb] = res => {
      done();
      const rows = (res && res.rows) || [];
      if (!rows.length) { body.innerHTML = '<span class="muted">No entries yet' + (store ? ' for ' + esc(store) : '') + '.</span>'; return; }
      const head = ['When', 'Store', 'By'].concat(COLS.map(c => c[1]));
      body.innerHTML = '<div class="tblwrap"><table><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr><td>' + esc(String(r._ts).replace(/:\d\d$/, '')) + '</td><td>' + esc(String(r.store).replace('Thomasville ', '')) + '</td><td>' + esc(r.cashier) + '</td>' +
          COLS.map(c => '<td>' + esc(r[c[0]]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    };
    sc.onerror = () => { done(); body.innerHTML = '<span class="muted">Could not load recent entries.</span>'; };
    sc.src = WEB_APP_URL + '?form=' + encodeURIComponent(FORM_KEY) + '&limit=200' + (store ? '&store=' + encodeURIComponent(store) : '') + '&callback=' + cb;
    document.body.appendChild(sc);
  }
  window.loadRecent = loadRecent;
  $('.mini', wrap).addEventListener('click', loadRecent);
  $$('[name=store]').forEach(r => r.addEventListener('change', loadRecent));
  loadRecent();

  const toast = $('#toast') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' }));
  function say(msg, fail) { toast.textContent = msg; toast.classList.toggle('fail', !!fail); toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 3800); }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) { say('Please fix the highlighted items', true); return; }
    const data = { form: FORM_KEY };
    new Set($$('[name]', form).map(i => i.name)).forEach(n => data[n] = val(n));
    if (window.beforeSubmit) { const msg = window.beforeSubmit(data); if (msg) { say(msg, true); return; } }
    if (!/^https:\/\/script\.google\.com\//.test(WEB_APP_URL)) { say('Setup needed: WEB_APP_URL is not set in config.js', true); return; }
    localStorage.setItem('vm_name', data.cashier || ''); localStorage.setItem('vm_store', data.store || '');
    const btn = $('button[type=submit]', form), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data) })
      .then(() => {
        say('✅ Sent! Thank you, ' + (data.cashier || 'team') + '.');
        const keepStore = data.store, keepName = data.cashier;
        form.reset();
        $$('[name=store]').forEach(r => r.checked = r.value === keepStore);
        if (nameI) nameI.value = keepName;
        $$('[data-default]').forEach(i => i.value = i.dataset.default); setToday();
        $$('.err').forEach(e => e.textContent = ''); $$('.invalid').forEach(e => e.classList.remove('invalid'));
        refresh(); setTimeout(loadRecent, 2500); setTimeout(loadRecent, 7000);
      })
      .catch(() => say('❌ Could not send. Check internet and try again.', true))
      .finally(() => { btn.disabled = false; btn.textContent = label; });
  });
})();
