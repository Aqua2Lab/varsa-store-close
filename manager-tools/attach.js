/* Varsa: adds a "Photo / file" upload card to any app.js form that doesn't have one.
 * Files go out as files_json; the Apps Script saves them to Drive
 * (Varsa Group LLC > Store Form Uploads > <tab>) and logs the links in the tab's Files column.
 * Load BEFORE app.js. */
(function () {
  const form = document.querySelector('form[data-form]');
  if (!form || form.querySelector('input[type=file]')) return; // page already has its own upload (Expenses)
  if (!document.querySelector('link[href="docs.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="docs.css">');
  const card = document.createElement('section'); card.className = 'card';
  card.innerHTML = '<h2><span class="dot"></span>📎 Photo / file <small style="font-weight:400;color:var(--muted)">(optional)</small></h2>' +
    '<div class="filebtns"><label class="fbtn"><span class="big">📷</span>Take photo<small>camera</small><input type="file" accept="image/*" capture="environment" data-attach></label>' +
    '<label class="fbtn"><span class="big">📁</span>Upload<small>photo or PDF</small><input type="file" accept="image/*,application/pdf" multiple data-attach></label></div>' +
    '<div class="att-list"></div><input type="hidden" name="files_json" value="">';
  const btn = form.querySelector('button[type=submit]');
  btn ? btn.insertAdjacentElement('beforebegin', card) : form.appendChild(card);
  const hidden = card.querySelector('[name=files_json]'), list = card.querySelector('.att-list');
  let files = [];
  const sync = () => {
    hidden.value = files.length ? JSON.stringify(files.map(f => ({ name: f.name, mime: f.mime, data: f.data }))) : '';
    list.innerHTML = files.map((f, i) => '<div class="fileitem">' + (f.thumb ? '<img src="' + f.thumb + '" alt="">' : '<div class="pdfic">PDF</div>') +
      '<div><b>' + String(f.name).replace(/[<>&"]/g, '') + '</b><small>' + Math.round(f.size / 1024) + ' KB</small></div><button type="button" class="mini" data-rm="' + i + '">✕</button></div>').join('');
    list.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { files.splice(+b.dataset.rm, 1); sync(); });
  };
  const readB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
  const shrink = f => new Promise(ok => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const u = c.toDataURL('image/jpeg', 0.78); URL.revokeObjectURL(img.src); ok({ mime: 'image/jpeg', data: u.split(',')[1], thumb: c.toDataURL('image/jpeg', 0.4), size: Math.round(u.length * 0.75) }); }; img.onerror = () => ok(null); img.src = URL.createObjectURL(f); });
  card.querySelectorAll('input[type=file]').forEach(inp => inp.addEventListener('change', async () => {
    for (const f of inp.files) {
      if (files.length >= 6) { alert('Max 6 files'); break; }
      const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!pdf && !/^image\//.test(f.type)) { alert('Only photos or PDF files'); continue; }
      if (f.size > 15 * 1024 * 1024) { alert(f.name + ' is over 15 MB'); continue; }
      let it = pdf ? null : await shrink(f);
      if (!it) it = { mime: pdf ? 'application/pdf' : f.type, data: await readB64(f), size: f.size };
      it.name = f.name || 'photo.jpg'; files.push(it);
    }
    inp.value = ''; sync();
  }));
  form.addEventListener('reset', () => { files = []; setTimeout(sync, 0); });
})();
