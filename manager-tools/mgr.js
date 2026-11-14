/* Varsa Manager Tools - read helpers for report pages (JSONP to the same Apps Script) */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = s => String(s || '').replace('Thomasville ', '');
const localISO = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (window.MOCK) return resolve(window.MOCK(params));
    const pin = localStorage.getItem('vm_pin');
    if (pin) params.pin = pin;
    const cb = 'vm' + Date.now() + Math.floor(Math.random() * 1e4), sc = document.createElement('script');
    const done = () => { delete window[cb]; sc.remove(); clearTimeout(t); };
    const t = setTimeout(() => { done(); reject(new Error('Timed out')); }, 25000);
    window[cb] = res => {
      done();
      if (res && res.pin) { const p = prompt('Manager PIN'); if (p) { localStorage.setItem('vm_pin', p); return jsonp(params).then(resolve, reject); } }
      res && res.ok ? resolve(res) : reject(new Error((res && res.error) || 'Error'));
    };
    sc.onerror = () => { done(); reject(new Error('Could not reach the backend')); };
    params.callback = cb;
    sc.src = WEB_APP_URL + '?' + Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    document.body.appendChild(sc);
  });
}
