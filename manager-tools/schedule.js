/* Varsa Group staff schedule. Pure helpers are on VARSA_SCHED for tests.
   Names come from the Employees sheet: Status Active, role cashier or manager. */
(function (root) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DEMO_KEY = 'vm_sched_demo_v3';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseISO(s) {
    var p = String(s || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
  }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function mondayOf(iso) {
    var d = parseISO(iso), day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return toISO(d);
  }
  function rangeDays(from, to) {
    var out = [], d = from, g = 0;
    if (!from || !to || from > to) return out;
    while (d <= to && g < 450) { out.push(d); d = addDays(d, 1); g++; }
    return out;
  }
  function monthStart(iso) { var d = parseISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), 1)); }
  function monthEnd(iso) { var d = parseISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function yearStart(iso) { return parseISO(iso).getFullYear() + '-01-01'; }
  function yearEnd(iso) { return parseISO(iso).getFullYear() + '-12-31'; }
  function toMin(t) {
    var m = /^(\d{2}):(\d{2})$/.exec(t || '');
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]);
  }
  function minutesBetween(start, end) {
    var s = toMin(start), e = toMin(end);
    if (s == null || e == null) return 0;
    var d = e - s;
    if (d < 0) d += 1440;
    return d;
  }
  function shiftHours(start, end) { return minutesBetween(start, end) / 60; }
  function isOnCallName(name) { return /^On-call\s+\d+$/i.test(name || ''); }
  function fmtH(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function fmtMoney(n) {
    var v = Math.abs(Number(n) || 0);
    var s = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-$' : '$') + s;
  }
  function fmtTime(t) {
    var m = toMin(t);
    if (m == null) return '';
    var h = Math.floor(m / 60), min = m % 60, ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(min) + ' ' + ap;
  }
  function intervalMs(date, start, end) {
    var s = toMin(start), e = toMin(end);
    if (s == null || e == null) return null;
    var base = parseISO(date).getTime();
    var a = base + s * 60000, b = base + e * 60000;
    if (b <= a) b += 86400000;
    return [a, b];
  }
  function hoursPerDayOf(map, store) {
    if (map && typeof map[store] === 'number') return map[store];
    return String(store).indexOf('OutRun') >= 0 ? 19 : 24;
  }
  function summarize(opts) {
    var dates = opts.dates || [], shifts = opts.shifts || [], manager = opts.manager || [];
    var rate = opts.rate || 0, mode = opts.mode || 'plan', stores = opts.stores || [];
    var byStore = {};
    stores.forEach(function (store) {
      byStore[store] = {};
      dates.forEach(function (dt) { byStore[store][dt] = { rows: 0, shiftMin: 0, onMin: 0 }; });
    });
    shifts.forEach(function (s) {
      if (!byStore[s.store] || !byStore[s.store][s.date]) return;
      var cell = byStore[s.store][s.date];
      cell.rows++;
      var mins = (s.employee && s.start && s.end) ? minutesBetween(s.start, s.end) : 0;
      if (isOnCallName(s.shift_name)) cell.onMin += mins; else cell.shiftMin += mins;
    });
    var result = {};
    stores.forEach(function (store) {
      var per = hoursPerDayOf(opts.hoursPerDay, store);
      var days = [], shiftMin = 0, onMin = 0, budgetMin = 0, onSheet = 0, silent = 0;
      dates.forEach(function (dt) {
        var cell = byStore[store][dt];
        var sheet = mode === 'plan' || cell.rows > 0;
        if (sheet) onSheet++; else silent++;
        var bud = sheet ? per * 60 : 0;
        shiftMin += cell.shiftMin; onMin += cell.onMin; budgetMin += bud;
        days.push({ date: dt, shiftMin: cell.shiftMin, onMin: cell.onMin, schedMin: cell.shiftMin + cell.onMin, budgetMin: bud, onSheet: sheet });
      });
      result[store] = { days: days, shiftMin: shiftMin, onMin: onMin, schedMin: shiftMin + onMin, budgetMin: budgetMin, onSheetDays: onSheet, silentDays: silent, hoursPerDay: per };
    });
    var managerMin = 0, managerByDay = {};
    dates.forEach(function (dt) { managerByDay[dt] = 0; });
    manager.forEach(function (m) {
      if (!Object.prototype.hasOwnProperty.call(managerByDay, m.date)) return;
      var mins = (m.employee && m.start && m.end) ? minutesBetween(m.start, m.end) : 0;
      managerMin += mins; managerByDay[m.date] += mins;
    });
    return { rate: rate, stores: result, managerMin: managerMin, managerByDay: managerByDay };
  }
  function peopleHours(shifts, manager, dates) {
    var set = {}, map = {};
    (dates || []).forEach(function (d) { set[d] = true; });
    function add(name, min, kind) {
      if (!name || !min) return;
      if (!map[name]) map[name] = { name: name, shiftMin: 0, onMin: 0, mgrMin: 0 };
      map[name][kind] += min;
    }
    (shifts || []).forEach(function (s) {
      if (!set[s.date]) return;
      add(s.employee, (s.employee && s.start && s.end) ? minutesBetween(s.start, s.end) : 0, isOnCallName(s.shift_name) ? 'onMin' : 'shiftMin');
    });
    (manager || []).forEach(function (m) {
      if (!set[m.date]) return;
      add(m.employee, (m.employee && m.start && m.end) ? minutesBetween(m.start, m.end) : 0, 'mgrMin');
    });
    return map;
  }
  function findConflicts(blocks) {
    var items = (blocks || []).slice().sort(function (a, b) { return a.startMs - b.startMs; });
    var overlaps = [], rests = [];
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        if (items[j].startMs >= items[i].endMs) break;
        overlaps.push([items[i], items[j]]);
      }
    }
    for (var k = 1; k < items.length; k++) {
      var gap = items[k].startMs - items[k - 1].endMs;
      if (gap >= 0 && gap < 8 * 3600000) rests.push({ gap: gap / 3600000, a: items[k - 1], b: items[k] });
    }
    return { overlaps: overlaps, rests: rests };
  }
  function weeksTouching(from, to) {
    var m = mondayOf(from), out = [], g = 0;
    while (m <= to && g < 60) { out.push(m); m = addDays(m, 7); g++; }
    return out;
  }
  function monthIndex(year, month) {
    var map = {}, last = {};
    rangeDays(toISO(new Date(year, month, 1)), toISO(new Date(year, month + 1, 0))).forEach(function (dt) {
      var d = parseISO(dt), n = Math.floor((d.getDate() - 1) / 7) + 1, wd = d.getDay();
      map[n + '-' + wd] = dt; last[wd] = dt;
    });
    return { map: map, last: last };
  }
  function sourceDateFor(target, index) {
    var d = parseISO(target), n = Math.floor((d.getDate() - 1) / 7) + 1, wd = d.getDay();
    return index.map[n + '-' + wd] || index.last[wd] || '';
  }

  root.VARSA_SCHED = {
    minutesBetween: minutesBetween, shiftHours: shiftHours, mondayOf: mondayOf, addDays: addDays,
    toISO: toISO, parseISO: parseISO, rangeDays: rangeDays, summarize: summarize, peopleHours: peopleHours,
    findConflicts: findConflicts, weeksTouching: weeksTouching, monthIndex: monthIndex, sourceDateFor: sourceDateFor,
    isOnCallName: isOnCallName, fmtH: fmtH, fmtMoney: fmtMoney, intervalMs: intervalMs
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VARSA_SCHED;

  if (!root.document) return;

  var cache = { shifts: {}, manager: {}, loaded: {}, rate: 10 };
  var state = {};
  var renderToken = 0;

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }
  function stores() { return (typeof STORES !== 'undefined') ? STORES : ['Thomasville Chevron', 'Thomasville OutRun']; }
  function hoursMap() {
    var map = {};
    stores().forEach(function (s) { map[s] = storeHoursPerDay(s); });
    return map;
  }
  function storeHoursPerDay(store) {
    var cfg = (typeof STORE_HOURS !== 'undefined') ? STORE_HOURS[store] : null;
    if (cfg && typeof cfg.hoursPerDay === 'number' && cfg.hoursPerDay > 0) return cfg.hoursPerDay;
    return store.indexOf('OutRun') >= 0 ? 19 : 24;
  }
  function storeLabel(store) {
    var cfg = (typeof STORE_HOURS !== 'undefined') ? STORE_HOURS[store] : null;
    return (cfg && cfg.label) || '';
  }
  function shortStore(s) { return String(s || '').replace(/^Thomasville\s+/i, '') || 'Store'; }
  function pretty(iso) {
    var d = parseISO(iso);
    return DOWS[d.getDay()] + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function dayHead(iso) { var d = parseISO(iso); return DOWS[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate(); }
  function slotKey(store, date, name) { return store + '|' + date + '|' + name; }
  function templateOf(store, name) {
    var list = (typeof SHIFT_TEMPLATES !== 'undefined' && SHIFT_TEMPLATES[store]) || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }
  function roleOf(name) {
    var list = state.employees || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i].role;
    return '';
  }
  function demoEmployees() {
    return [
      { name: 'Jonathan Cowan', role: 'manager', home_store: 'Both stores' },
      { name: 'Avery Brooks', role: 'cashier', home_store: 'Thomasville Chevron' },
      { name: 'Riley Nguyen', role: 'cashier', home_store: 'Thomasville Chevron' },
      { name: 'Morgan Ellis', role: 'cashier', home_store: 'Thomasville Chevron' },
      { name: 'Jordan Hale', role: 'cashier', home_store: 'Thomasville OutRun' },
      { name: 'Casey Patel', role: 'cashier', home_store: 'Thomasville OutRun' },
      { name: 'Quinn Adams', role: 'cashier', home_store: 'Thomasville OutRun' }
    ];
  }
  function say(msg, warn) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('fail', !!warn);
    t.classList.add('show');
    clearTimeout(say._t);
    say._t = setTimeout(function () { t.classList.remove('show'); }, 4800);
  }
  function pageMsg(msg) { var n = document.getElementById('pageMsg'); if (n) n.textContent = msg || ''; }
  function showDemoBanner() {
    var b = document.getElementById('demoBanner');
    if (!b) return;
    b.classList.remove('hidden');
    b.textContent = 'Demo mode. This sample schedule stays on this computer so you can try every view. It does not change the Google Sheet.';
  }

  function putShift(date, store, shiftName, start, end, employee, notes) {
    if (!cache.shifts[date]) cache.shifts[date] = [];
    cache.shifts[date].push({ week_start: mondayOf(date), date: date, store: store, shift_name: shiftName, start: start, end: end, employee: employee || '', notes: notes || '' });
  }
  function seedDemo() {
    var today = toISO(new Date());
    var week = mondayOf(today);
    function fill(monday, mode) {
      rangeDays(monday, addDays(monday, 6)).forEach(function (dt) {
        var tC = SHIFT_TEMPLATES['Thomasville Chevron'], tO = SHIFT_TEMPLATES['Thomasville OutRun'];
        if (mode === 'mornings') {
          putShift(dt, 'Thomasville Chevron', tC[0].name, tC[0].start, tC[0].end, 'Avery Brooks');
          putShift(dt, 'Thomasville OutRun', tO[0].name, tO[0].start, tO[0].end, 'Jordan Hale');
          return;
        }
        putShift(dt, 'Thomasville Chevron', tC[0].name, tC[0].start, tC[0].end, 'Avery Brooks');
        putShift(dt, 'Thomasville Chevron', tC[1].name, tC[1].start, tC[1].end, 'Riley Nguyen');
        putShift(dt, 'Thomasville Chevron', tC[2].name, tC[2].start, tC[2].end, 'Morgan Ellis');
        putShift(dt, 'Thomasville OutRun', tO[0].name, tO[0].start, tO[0].end, 'Jordan Hale');
        putShift(dt, 'Thomasville OutRun', tO[1].name, tO[1].start, tO[1].end, 'Casey Patel');
        var dow = parseISO(dt).getDay();
        if (dow >= 1 && dow <= 5) {
          if (!cache.manager[dt]) cache.manager[dt] = [];
          cache.manager[dt].push({ date: dt, employee: 'Jonathan Cowan', start: '08:00', end: '16:00', notes: 'Floor coverage', kind: 'shift' });
        }
      });
    }
    fill(addDays(week, -7), 'full');
    fill(week, 'full');
    fill(addDays(week, 7), 'full');
    fill(addDays(week, 14), 'mornings');
    var days = rangeDays(week, addDays(week, 6));
    var wed = days[2], thu = days[3], sat = days[5];
    (cache.shifts[wed] || []).forEach(function (s) {
      if (s.store.indexOf('Chevron') >= 0 && s.shift_name === SHIFT_TEMPLATES['Thomasville Chevron'][2].name) s.employee = '';
      if (s.store.indexOf('Chevron') >= 0 && s.shift_name === SHIFT_TEMPLATES['Thomasville Chevron'][1].name) s.employee = 'Sam Rivera';
    });
    (cache.shifts[thu] || []).forEach(function (s) {
      if (s.store.indexOf('OutRun') >= 0 && s.shift_name === SHIFT_TEMPLATES['Thomasville OutRun'][0].name) s.employee = 'Avery Brooks';
    });
    days.forEach(function (dt) { putShift(dt, 'Thomasville OutRun', 'On-call 1', '18:00', '20:00', 'Quinn Adams', ''); });
    putShift(sat, 'Thomasville Chevron', 'On-call 2', '08:00', '12:00', 'Morgan Ellis', '');
    if (!cache.manager[sat]) cache.manager[sat] = [];
    cache.manager[sat].push({ date: sat, employee: 'Jonathan Cowan', start: '10:00', end: '14:00', notes: 'On call for both stores', kind: 'oncall' });
    cache.rate = 10;
  }
  function persistDemo() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ seeded: true, rate: cache.rate, shifts: cache.shifts, manager: cache.manager })); } catch (e) {}
  }
  function loadDemoStore() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) {}
    if (raw && raw.seeded && raw.shifts) {
      cache.shifts = raw.shifts; cache.manager = raw.manager || {}; cache.rate = raw.rate || 10;
    } else {
      cache.shifts = {}; cache.manager = {}; seedDemo(); persistDemo();
    }
  }

  function shiftsOn(dt) { return cache.shifts[dt] || []; }
  function mgrOn(dt) { return cache.manager[dt] || []; }
  function needRange(from, to) {
    if (state.demo) return Promise.resolve();
    var missing = false, d = from, g = 0;
    while (d <= to && g < 450) { if (!cache.loaded[d]) missing = true; d = addDays(d, 1); g++; }
    if (!missing) return Promise.resolve();
    return fetchRange(from, to);
  }
  function fetchEmployees() {
    return jsonp({ action: 'employees' }).then(function (res) {
      if (!res || !Array.isArray(res.employees)) throw new Error('not-schedule');
      state.backend = true;
      state.employees = res.employees;
      if (typeof res.base_pay_rate === 'number') { state.rate = res.base_pay_rate; state.savedRate = res.base_pay_rate; }
    });
  }
  function fetchRange(from, to) {
    return jsonp({ action: 'schedule', from: from, to: to }).then(function (res) {
      if (!res || !Array.isArray(res.shifts) || !Array.isArray(res.manager)) throw new Error('not-schedule');
      var d = from, g = 0;
      while (d <= to && g < 450) { cache.shifts[d] = []; cache.manager[d] = []; cache.loaded[d] = true; d = addDays(d, 1); g++; }
      res.shifts.forEach(function (s) { if (!cache.shifts[s.date]) cache.shifts[s.date] = []; cache.shifts[s.date].push(s); });
      res.manager.forEach(function (m) { if (!cache.manager[m.date]) cache.manager[m.date] = []; cache.manager[m.date].push(m); });
      if (typeof res.base_pay_rate === 'number' && !state.rateDirty) {
        state.rate = res.base_pay_rate; state.savedRate = res.base_pay_rate;
        var inp = document.getElementById('payRate'); if (inp && document.activeElement !== inp) inp.value = Number(state.rate).toFixed(2);
      }
    });
  }
  function applyPayload(payload) {
    (payload.dates || []).forEach(function (dt) { cache.shifts[dt] = []; cache.manager[dt] = []; cache.loaded[dt] = true; });
    (payload.shifts || []).forEach(function (s) { if (!cache.shifts[s.date]) cache.shifts[s.date] = []; cache.shifts[s.date].push(s); });
    (payload.manager || []).forEach(function (m) { if (!cache.manager[m.date]) cache.manager[m.date] = []; cache.manager[m.date].push(m); });
    if (typeof payload.base_pay_rate === 'number') cache.rate = payload.base_pay_rate;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function postJson(payload, skipReload) {
    payload.base_pay_rate = state.rate;
    if (state.demo) { applyPayload(payload); cache.rate = state.rate; persistDemo(); return Promise.resolve(); }
    if (!state.backend) return Promise.reject(new Error('redeploy'));
    return jsonp({ action: 'employees' }).then(function () {
      payload.pin = localStorage.getItem('vm_pin') || '';
      return fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    }).then(function () {
      applyPayload(payload);
      if (skipReload) return;
      var dates = payload.dates.slice().sort();
      return wait(1200).then(function () { return fetchRange(dates[0], dates[dates.length - 1]); }).catch(function () {});
    });
  }
  function postMany(payloads) {
    if (state.demo) { payloads.forEach(applyPayload); cache.rate = state.rate; persistDemo(); return Promise.resolve(); }
    var chain = Promise.resolve();
    payloads.forEach(function (p) { chain = chain.then(function () { return postJson(p, true); }); });
    return chain.then(function () {
      var dates = [];
      payloads.forEach(function (p) { dates = dates.concat(p.dates); });
      dates.sort();
      if (!dates.length) return;
      return wait(1200).then(function () { return fetchRange(dates[0], dates[dates.length - 1]); }).catch(function () {});
    });
  }
  function savePayloads(dates, shifts, manager) {
    var seen = {}, unique = [];
    dates.forEach(function (d) { if (!seen[d]) { seen[d] = true; unique.push(d); } });
    unique.sort();
    var payloads = [];
    for (var i = 0; i < unique.length; i += 280) {
      var ds = unique.slice(i, i + 280), set = {};
      ds.forEach(function (d) { set[d] = true; });
      payloads.push({
        form: 'schedule_save', dates: ds,
        shifts: shifts.filter(function (s) { return set[s.date]; }),
        manager: manager.filter(function (m) { return set[m.date]; }),
        base_pay_rate: state.rate
      });
    }
    return postMany(payloads);
  }

  function onCallCount(store) {
    var n = typeof ON_CALL_MIN === 'number' ? ON_CALL_MIN : 2;
    var max = typeof ON_CALL_MAX === 'number' ? ON_CALL_MAX : 6;
    if (state.extraLines && state.extraLines[store]) n = Math.max(n, state.extraLines[store]);
    if (state.draft) {
      Object.keys(state.draft.slots).forEach(function (k) {
        var s = state.draft.slots[k];
        if (s.store !== store || !s.oncall) return;
        var m = /^On-call\s+(\d+)$/i.exec(s.shift_name || '');
        if (m) n = Math.max(n, +m[1]);
      });
    }
    return Math.min(max, n);
  }
  function ensureDraftSlots() {
    var days = rangeDays(state.draft.week, addDays(state.draft.week, 6));
    stores().forEach(function (store) {
      var tpls = (typeof SHIFT_TEMPLATES !== 'undefined' && SHIFT_TEMPLATES[store]) || [];
      var n = onCallCount(store);
      days.forEach(function (dt) {
        tpls.forEach(function (t) {
          var k = slotKey(store, dt, t.name);
          if (!state.draft.slots[k]) state.draft.slots[k] = { date: dt, store: store, shift_name: t.name, start: t.start, end: t.end, employee: '', notes: '', oncall: false };
          else if (!state.draft.slots[k].oncall) { state.draft.slots[k].start = t.start; state.draft.slots[k].end = t.end; }
        });
        for (var i = 1; i <= n; i++) {
          var nm = 'On-call ' + i, k2 = slotKey(store, dt, nm);
          if (!state.draft.slots[k2]) state.draft.slots[k2] = { date: dt, store: store, shift_name: nm, start: '', end: '', employee: '', notes: '', oncall: true };
          else state.draft.slots[k2].oncall = true;
        }
      });
    });
  }
  function loadDraft(week) {
    var draft = { week: week, slots: {}, manager: {}, mgrOncall: {} }, keep = {};
    rangeDays(week, addDays(week, 6)).forEach(function (dt) {
      shiftsOn(dt).forEach(function (s) {
        draft.slots[slotKey(s.store, dt, s.shift_name)] = {
          date: dt, store: s.store, shift_name: s.shift_name, start: s.start || '', end: s.end || '',
          employee: s.employee || '', notes: s.notes || '', oncall: isOnCallName(s.shift_name)
        };
        if (s.employee && !roleOf(s.employee)) keep[s.employee] = true;
      });
      mgrOn(dt).forEach(function (m) {
        var row = { employee: m.employee || '', start: m.start || '', end: m.end || '', notes: m.notes || '', auto: false };
        if ((m.kind || '') === 'oncall') draft.mgrOncall[dt] = row;
        else if (!draft.manager[dt]) draft.manager[dt] = row;
        if (m.employee && !roleOf(m.employee)) keep[m.employee] = true;
      });
    });
    state.draft = draft; state.keepNames = keep; state.extraLines = {};
    ensureDraftSlots();
  }
  function rowsFromDraft(week) {
    var end = addDays(week, 6), shifts = [], manager = [];
    Object.keys(state.draft.slots).forEach(function (k) {
      var s = state.draft.slots[k];
      if (s.date < week || s.date > end) return;
      if (s.oncall && !s.employee && !s.start && !s.end && !s.notes) return;
      var start = s.start, endT = s.end, t = !s.oncall ? templateOf(s.store, s.shift_name) : null;
      if (t) { start = t.start; endT = t.end; }
      shifts.push({ date: s.date, store: s.store, shift_name: s.shift_name, start: start || '', end: endT || '', employee: s.employee || '', notes: s.notes || '' });
    });
    function pushMgr(bucket, kind) {
      Object.keys(bucket).forEach(function (dt) {
        var m = bucket[dt];
        if (!m || dt < week || dt > end) return;
        if (m.auto && !m.start && !m.end && !m.notes) return;
        if (!m.employee && !m.start && !m.end && !m.notes) return;
        manager.push({ date: dt, employee: m.employee || '', start: m.start || '', end: m.end || '', notes: m.notes || '', kind: kind });
      });
    }
    pushMgr(state.draft.manager, 'shift');
    pushMgr(state.draft.mgrOncall, 'oncall');
    return { shifts: shifts, manager: manager };
  }
  function badNames(shifts, manager, allowKeep) {
    var bad = [], seen = {};
    function check(name, role) {
      if (!name || seen[name]) return;
      var have = roleOf(name);
      if (have && (!role || have === role)) return;
      if (allowKeep && state.keepNames && state.keepNames[name]) return;
      seen[name] = true; bad.push(name);
    }
    (shifts || []).forEach(function (s) { check(s.employee, isOnCallName(s.shift_name) ? '' : 'cashier'); });
    (manager || []).forEach(function (m) { check(m.employee, 'manager'); });
    return bad;
  }
  function activeKeep(name, roleNeeded) {
    if (!name) return '';
    var role = roleOf(name);
    if (!role) return '';
    if (roleNeeded && role !== roleNeeded) return '';
    return name;
  }

  function defaultManagerName() {
    var list = (state.employees || []).filter(function (e) { return e.role === 'manager'; });
    for (var i = 0; i < list.length; i++) if (list[i].name === 'Jonathan Cowan') return list[i].name;
    return '';
  }
  function selectHtml(list, selected, placeholder, attrs, withRole) {
    var html = '<select ' + attrs + '><option value="">' + h(placeholder) + '</option>';
    var seen = false;
    list.forEach(function (e) {
      if (e.name === selected) seen = true;
      var label = e.name + ' · ' + (withRole ? (e.role === 'manager' ? 'Manager · ' : 'Cashier · ') : '') + shortStore(e.home_store);
      html += '<option value="' + h(e.name) + '"' + (e.name === selected ? ' selected' : '') + '>' + h(label) + '</option>';
    });
    if (selected && !seen) html += '<option value="' + h(selected) + '" selected>' + h(selected + ' · inactive') + '</option>';
    return html + '</select>';
  }
  function cashiers() { return (state.employees || []).filter(function (e) { return e.role === 'cashier'; }); }
  function managers() { return (state.employees || []).filter(function (e) { return e.role === 'manager'; }); }
  function everyone() { return (state.employees || []).slice(); }

  function analyzeWeek() {
    var week = state.draft.week, days = rangeDays(week, addDays(week, 6)), daySet = {}, flags = [];
    days.forEach(function (d) { daySet[d] = true; });
    stores().forEach(function (store) {
      var tpls = (SHIFT_TEMPLATES && SHIFT_TEMPLATES[store]) || [];
      days.forEach(function (dt) {
        tpls.forEach(function (t) {
          var s = state.draft.slots[slotKey(store, dt, t.name)];
          if (!s || !s.employee) flags.push('Open shift: ' + shortStore(store) + ' · ' + pretty(dt) + ' · ' + t.name + '.');
        });
      });
    });
    Object.keys(state.draft.slots).forEach(function (k) {
      var s = state.draft.slots[k];
      if (!daySet[s.date]) return;
      if (s.oncall && (s.employee || s.start || s.end || s.notes) && (!s.employee || !s.start || !s.end)) {
        flags.push(shortStore(s.store) + ' · ' + pretty(s.date) + ' · ' + s.shift_name + ' needs a person and both times.');
      }
      if (s.employee) {
        var role = roleOf(s.employee);
        if (!role) flags.push(s.employee + ' is inactive and still assigned on ' + shortStore(s.store) + ' · ' + pretty(s.date) + ' · ' + s.shift_name + '.');
        else if (!s.oncall && role !== 'cashier') flags.push(s.employee + ' is not a cashier. Choose a cashier for ' + s.shift_name + ' on ' + pretty(s.date) + '.');
      }
    });
    function checkMgr(bucket, label) {
      Object.keys(bucket).forEach(function (dt) {
        var m = bucket[dt];
        if (!daySet[dt] || !m || (m.auto && !m.start && !m.end && !m.notes)) return;
        if (!(m.employee || m.start || m.end || m.notes)) return;
        if (!m.employee || !m.start || !m.end) flags.push(label + ' on ' + pretty(dt) + ' needs a person and both times.');
        else if (!roleOf(m.employee)) flags.push(m.employee + ' is inactive on ' + label.toLowerCase() + ' for ' + pretty(dt) + '.');
        else if (roleOf(m.employee) !== 'manager') flags.push(m.employee + ' is not a manager. Choose a manager for ' + pretty(dt) + '.');
      });
    }
    checkMgr(state.draft.manager, 'Manager schedule');
    checkMgr(state.draft.mgrOncall, 'Manager on-call');
    var byPerson = {};
    function addBlock(name, date, start, end, label) {
      if (!name || !start || !end) return;
      var iv = intervalMs(date, start, end);
      if (!iv) return;
      if (!byPerson[name]) byPerson[name] = [];
      byPerson[name].push({ startMs: iv[0], endMs: iv[1], label: label });
    }
    Object.keys(state.draft.slots).forEach(function (k) {
      var s = state.draft.slots[k];
      addBlock(s.employee, s.date, s.start, s.end, pretty(s.date) + ' ' + shortStore(s.store) + ' ' + s.shift_name);
    });
    Object.keys(state.draft.manager).forEach(function (dt) {
      var m = state.draft.manager[dt];
      if (m && !m.auto) addBlock(m.employee, dt, m.start, m.end, pretty(dt) + ' manager');
    });
    Object.keys(state.draft.mgrOncall).forEach(function (dt) {
      var m = state.draft.mgrOncall[dt];
      if (m && !m.auto) addBlock(m.employee, dt, m.start, m.end, pretty(dt) + ' manager on-call');
    });
    [addDays(week, -1), addDays(week, 7)].forEach(function (dt) {
      shiftsOn(dt).forEach(function (s) { addBlock(s.employee, dt, s.start, s.end, pretty(dt) + ' ' + shortStore(s.store) + ' ' + s.shift_name); });
      mgrOn(dt).forEach(function (m) { addBlock(m.employee, dt, m.start, m.end, pretty(dt) + ' manager'); });
    });
    Object.keys(byPerson).forEach(function (name) {
      var found = findConflicts(byPerson[name]);
      found.overlaps.forEach(function (pair) { flags.push(name + ' is booked twice at the same time: ' + pair[0].label + ' and ' + pair[1].label + '.'); });
      found.rests.forEach(function (r) { flags.push(name + ' has ' + fmtH(r.gap) + ' hours of rest between ' + r.a.label + ' and ' + r.b.label + '. Rest should be at least 8 hours.'); });
    });
    var built = rowsFromDraft(week);
    var ppl = peopleHours(built.shifts, built.manager, days);
    Object.keys(ppl).forEach(function (name) {
      var work = ppl[name].shiftMin + ppl[name].onMin;
      if (work > 40 * 60) flags.push(name + ' is at ' + fmtH(work / 60) + ' hours this week, over 40.' + (roleOf(name) === 'cashier' ? ' Cashiers are aimed at 35 to 40 hours.' : ''));
    });
    var sum = summarize({ dates: days, shifts: built.shifts, manager: built.manager, rate: state.rate, mode: 'plan', stores: stores(), hoursPerDay: hoursMap() });
    stores().forEach(function (store) {
      var over = sum.stores[store].schedMin - sum.stores[store].budgetMin;
      if (over > 0) flags.push(store + ' is ' + fmtH(over / 60) + ' hours over budget this week (' + fmtMoney(over / 60 * state.rate) + ').');
    });
    return flags;
  }

  function periodDates() {
    if (state.view === 'month') return rangeDays(monthStart(state.cursor), monthEnd(state.cursor));
    if (state.view === 'year') return rangeDays(yearStart(state.cursor), yearEnd(state.cursor));
    if (state.view === 'list') return rangeDays(state.rangeFrom, state.rangeTo);
    var w = state.draft ? state.draft.week : mondayOf(state.cursor);
    return rangeDays(w, addDays(w, 6));
  }
  function rowsForPeriod() {
    if (state.view === 'week') {
      if (!state.draft) return null;
      var built = rowsFromDraft(state.draft.week);
      return { dates: rangeDays(state.draft.week, addDays(state.draft.week, 6)), shifts: built.shifts, manager: built.manager, mode: 'plan' };
    }
    var dates = periodDates(), shifts = [], manager = [];
    dates.forEach(function (dt) {
      shiftsOn(dt).forEach(function (s) { shifts.push(s); });
      mgrOn(dt).forEach(function (m) { manager.push(m); });
    });
    return { dates: dates, shifts: shifts, manager: manager, mode: 'saved' };
  }
  function renderBudget() {
    var body = document.getElementById('budgetBody'), rule = document.getElementById('budgetRule');
    if (!body) return;
    var rate = state.rate || 10;
    var chev = storeHoursPerDay('Thomasville Chevron'), out = storeHoursPerDay('Thomasville OutRun');
    if (rule) rule.textContent = 'Budget is one person covering every open hour. Chevron ' + chev + ' hours a day, ' + (chev * 7) + ' hours a week (' + fmtMoney(chev * 7 * rate) + '). OutRun ' + out + ' hours a day, ' + (out * 7) + ' hours a week (' + fmtMoney(out * 7 * rate) + '). Cashier shifts and on-call lines use the base rate. Manager hours are salary and are listed on their own. Open hours are set in config.js.';
    var pack = rowsForPeriod();
    if (!pack) { body.innerHTML = '<span class="muted">Loading the saved schedule…</span>'; return; }
    var sum = summarize({ dates: pack.dates, shifts: pack.shifts, manager: pack.manager, rate: rate, mode: pack.mode, stores: stores(), hoursPerDay: hoursMap() });
    var html = '';
    stores().forEach(function (store) { html += storeBudgetHtml(store, sum.stores[store], pack, rate); });
    html += managerBudgetHtml(sum, pack);
    if (state.view === 'month') html += rollupWeeks(rate);
    if (state.view === 'year') html += rollupMonths(rate);
    body.innerHTML = html;
  }
  function storeBudgetHtml(store, st, pack, rate) {
    var overMin = st.schedMin - st.budgetMin, cls = '', phrase = 'On budget', empty = pack.mode === 'saved' && st.onSheetDays === 0;
    if (empty) phrase = 'Nothing scheduled yet. Full coverage for these dates would be ' + fmtH(st.hoursPerDay * pack.dates.length) + ' hours (' + fmtMoney(st.hoursPerDay * pack.dates.length * rate) + ').';
    else if (overMin > 0) { cls = 'overbud'; phrase = fmtH(overMin / 60) + ' hours over budget (' + fmtMoney(overMin / 60 * rate) + ')'; }
    else if (overMin < 0) { cls = 'underbud'; phrase = fmtH(-overMin / 60) + ' hours under budget (' + fmtMoney(-overMin / 60 * rate) + ')'; }
    var html = '<div class="store-bud ' + cls + '"><h3>' + h(store) + '</h3><div class="muted">' + h(storeLabel(store)) + '</div>';
    if (!empty) {
      html += '<div>Scheduled <b>' + fmtH(st.schedMin / 60) + ' h</b> (' + fmtMoney(st.schedMin / 60 * rate) + ') · Budget <b>' + fmtH(st.budgetMin / 60) + ' h</b> (' + fmtMoney(st.budgetMin / 60 * rate) + ')</div>';
      html += '<div class="' + (cls === 'overbud' ? 'overbud-t' : 'underbud-t') + '">' + h(phrase) + '</div>';
      html += '<div class="muted">Cashier shifts ' + fmtH(st.shiftMin / 60) + ' h · On-call ' + fmtH(st.onMin / 60) + ' h</div>';
      if (pack.mode === 'saved' && st.silentDays) html += '<div class="muted">' + st.onSheetDays + ' days on the sheet · ' + st.silentDays + ' days not started</div>';
      if (pack.mode === 'plan') {
        html += '<div class="daystrip">';
        st.days.forEach(function (d) {
          html += '<div class="daychip' + (d.schedMin > d.budgetMin ? ' overbud' : '') + '"><b>' + h(dayHead(d.date).split(' ')[0]) + '</b>' + fmtH(d.schedMin / 60) + ' / ' + fmtH(d.budgetMin / 60) + ' h</div>';
        });
        html += '</div>';
      }
    } else html += '<div class="muted">' + h(phrase) + '</div>';
    return html + '</div>';
  }
  function managerBudgetHtml(sum, pack) {
    var html = '<div class="store-bud"><h3>Manager hours</h3><p class="rule">Salary for the store manager (Jonathan Cowan). These hours stay out of the cashier budget and are not multiplied by the base pay rate.</p>';
    html += sum.managerMin > 0 ? '<p><b>' + fmtH(sum.managerMin / 60) + ' hours</b></p>' : '<p class="muted">No manager times in this period.</p>';
    if (pack.mode === 'plan') {
      html += '<div class="daystrip">';
      pack.dates.forEach(function (dt) { html += '<div class="daychip"><b>' + h(dayHead(dt).split(' ')[0]) + '</b>' + fmtH((sum.managerByDay[dt] || 0) / 60) + ' h</div>'; });
      html += '</div>';
    }
    return html + '</div>';
  }
  function rollupPhrase(sum, rate) {
    return stores().map(function (store) {
      var st = sum.stores[store];
      if (!st.onSheetDays) return shortStore(store) + ' not started';
      var over = (st.schedMin - st.budgetMin) / 60;
      var tail = Math.abs(over) < 0.05 ? 'on budget' : over > 0 ? fmtH(over) + ' h over' : fmtH(-over) + ' h under';
      return shortStore(store) + ' ' + fmtH(st.schedMin / 60) + '/' + fmtH(st.budgetMin / 60) + ' h, ' + tail + ' (' + fmtMoney(st.schedMin / 60 * rate) + ')';
    }).join(' · ');
  }
  function rollupWeeks(rate) {
    var start = monthStart(state.cursor), end = monthEnd(state.cursor), html = '<h3>Each week</h3>';
    weeksTouching(start, end).forEach(function (monday) {
      var days = rangeDays(monday, addDays(monday, 6)).filter(function (d) { return d >= start && d <= end; });
      var shifts = [], manager = [];
      days.forEach(function (dt) { shifts = shifts.concat(shiftsOn(dt)); manager = manager.concat(mgrOn(dt)); });
      var sum = summarize({ dates: days, shifts: shifts, manager: manager, rate: rate, mode: 'saved', stores: stores(), hoursPerDay: hoursMap() });
      html += '<div class="weekline"><button type="button" data-week="' + monday + '">' + h(pretty(monday)) + ' – ' + h(pretty(addDays(monday, 6))) + '</button><span>' + h(rollupPhrase(sum, rate)) + '</span></div>';
    });
    return html;
  }
  function rollupMonths(rate) {
    var y = parseISO(state.cursor).getFullYear(), html = '<h3>Each month</h3>';
    for (var m = 0; m < 12; m++) {
      var from = toISO(new Date(y, m, 1)), to = toISO(new Date(y, m + 1, 0));
      var days = rangeDays(from, to), shifts = [], manager = [];
      days.forEach(function (dt) { shifts = shifts.concat(shiftsOn(dt)); manager = manager.concat(mgrOn(dt)); });
      var sum = summarize({ dates: days, shifts: shifts, manager: manager, rate: rate, mode: 'saved', stores: stores(), hoursPerDay: hoursMap() });
      html += '<div class="weekline"><button type="button" data-month="' + y + '-' + pad(m + 1) + '">' + MONTHS[m] + '</button><span>' + h(rollupPhrase(sum, rate)) + '</span></div>';
    }
    return html;
  }
  function renderFlags() {
    var box = document.getElementById('flagsCard');
    if (!box) return;
    if (state.view !== 'week' || !state.draft) {
      box.innerHTML = '<h2><span class="dot"></span>Warnings</h2><p class="muted">Open a week to see open shifts, people booked twice, short rest, hours over 40, and stores over budget.</p>';
      return;
    }
    var flags = analyzeWeek();
    if (!flags.length) { box.innerHTML = '<h2><span class="dot"></span>Warnings</h2><p>No warnings for this week.</p>'; return; }
    var shown = flags.slice(0, 40);
    box.innerHTML = '<h2><span class="dot"></span>Warnings</h2><div class="note warn"><ul class="steps">' + shown.map(function (f) { return '<li>' + h(f) + '</li>'; }).join('') + (flags.length > shown.length ? '<li>And ' + (flags.length - shown.length) + ' more.</li>' : '') + '</ul></div>';
  }
  function renderPeople() {
    var box = document.getElementById('hoursCard');
    if (!box) return;
    var pack = rowsForPeriod();
    if (!pack) { box.innerHTML = ''; return; }
    var ppl = peopleHours(pack.shifts, pack.manager, pack.dates);
    var names = Object.keys(ppl).sort(function (a, b) {
      var ta = ppl[a].shiftMin + ppl[a].onMin + ppl[a].mgrMin, tb = ppl[b].shiftMin + ppl[b].onMin + ppl[b].mgrMin;
      return tb - ta;
    });
    var html = '<h2><span class="dot"></span>Hours per person</h2>';
    if (!names.length) html += '<p class="muted">No one is scheduled in this period yet.</p>';
    names.forEach(function (name) {
      var p = ppl[name], work = (p.shiftMin + p.onMin) / 60, mgr = p.mgrMin / 60, role = roleOf(name);
      var note = '';
      if (work > 40) note = ' <span class="overbud-t">Over 40 hours</span>';
      else if (role === 'cashier' && work >= 35 && work <= 40) note = ' <span class="underbud-t">In the 35 to 40 hour aim</span>';
      else if (role === 'cashier' && work > 0 && work < 35) note = ' <span class="underbud-t">Under the 35 to 40 hour aim</span>';
      var bits = [];
      if (work) bits.push(fmtH(work) + ' h on shifts and on-call');
      if (mgr) bits.push(fmtH(mgr) + ' h manager, salary');
      var href = 'schedule_view.html?name=' + encodeURIComponent(name) + '&week=' + encodeURIComponent(mondayOf(pack.dates[0] || state.cursor)) + (state.demo ? '&demo=1' : '');
      html += '<div class="person"><div><a href="' + href + '">' + h(name) + '</a>' + note + '<div class="muted">' + h(bits.join(' · ')) + '</div></div></div>';
    });
    box.innerHTML = html;
  }
  function updateMirrors() {
    if (!state.draft) return;
    document.querySelectorAll('[data-hrs]').forEach(function (el) {
      var s = state.draft.slots[el.getAttribute('data-hrs')];
      if (!s) return;
      var show = (s.start && s.end) ? minutesBetween(s.start, s.end) : 0;
      el.textContent = show ? fmtH(show / 60) + ' hours' : '';
      var td = el.closest ? el.closest('td') : null;
      if (td) {
        td.classList.toggle('open', !s.oncall && !s.employee);
        td.classList.toggle('inactive', !!(s.employee && !roleOf(s.employee)));
      }
    });
    document.querySelectorAll('[data-pv]').forEach(function (el) {
      var s = state.draft.slots[el.getAttribute('data-pv')];
      if (!s) return;
      if (s.oncall && !s.employee && !s.start && !s.end) { el.textContent = ''; return; }
      el.textContent = (s.employee || (s.oncall ? s.shift_name : 'Open')) + ((s.start && s.end) ? ' ' + fmtTime(s.start) + '–' + fmtTime(s.end) : '') + (s.notes ? ' (' + s.notes + ')' : '');
    });
  }
  function refreshSide() { renderBudget(); renderFlags(); renderPeople(); updateMirrors(); }

  function paintWeek() {
    var week = state.draft.week, days = rangeDays(week, addDays(week, 6)), html = [];
    if (!cashiers().length && !state.demo) {
      html.push('<section class="card"><h2><span class="dot"></span>Add employees first</h2><p>On the Varsa Cashier Tracker sheet, open the <b>Employees</b> tab. Add one row per person: Name, Role (<b>cashier</b> or <b>manager</b>), Home Store, Phone, Status. Status must be <b>Active</b>. Only those people appear in the lists. Then reload this page.</p><p><a href="https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit" target="_blank" rel="noopener">Open the sheet</a></p></section>');
    }
    html.push('<div class="row-btns"><button type="button" class="btn" data-act="save" style="width:auto">Save this week</button><button type="button" class="btn secondary" data-act="copy-last">Copy last week onto this screen</button></div>');
    html.push('<p id="statusLine" class="rule">' + (state.dirty ? 'This week has unsaved changes.' : 'Month, Year, and Scheduled list show saved weeks.') + '</p>');
    stores().forEach(function (store) { html.push(storeTable(store, days)); });
    html.push(managerCard(days));
    html.push(bulkCard());
    html.push(linkCard());
    document.getElementById('viewRoot').innerHTML = html.join('');
    refreshSide();
  }
  function storeTable(store, days) {
    var tpls = (SHIFT_TEMPLATES && SHIFT_TEMPLATES[store]) || [];
    var lines = tpls.map(function (t) { return { name: t.name, oncall: false, hint: fmtTime(t.start) + '–' + fmtTime(t.end) }; });
    var n = onCallCount(store);
    for (var i = 1; i <= n; i++) lines.push({ name: 'On-call ' + i, oncall: true, hint: 'Extra coverage' });
    var html = '<section class="card"><h2><span class="dot"></span>' + h(store) + '</h2><p class="muted">' + h(storeLabel(store)) + ' · one cashier on each shift. On-call lines are optional extra people.</p><div class="tblwrap"><table class="gridweek"><thead><tr><th class="shiftname">Shift</th>';
    days.forEach(function (dt) { html += '<th>' + h(dayHead(dt)) + '</th>'; });
    html += '</tr></thead><tbody>';
    lines.forEach(function (line) {
      html += '<tr><th class="shiftname">' + h(line.name) + '<div class="muted">' + h(line.hint) + '</div></th>';
      days.forEach(function (dt) {
        var key = slotKey(store, dt, line.name);
        var s = state.draft.slots[key] || { employee: '', notes: '', start: '', end: '', oncall: line.oncall };
        var cls = !line.oncall && !s.employee ? 'open' : (s.employee && !roleOf(s.employee) ? 'inactive' : '');
        html += '<td class="' + cls + '"><div class="slot">';
        html += '<div class="pv" data-pv="' + h(key) + '"></div>';
        var list = line.oncall ? everyone() : cashiers();
        html += selectHtml(list, s.employee, line.oncall ? 'No on-call' : 'Open shift', 'data-k="' + h(key) + '" data-f="employee"', line.oncall);
        if (line.oncall) {
          html += '<div class="times"><input type="time" aria-label="From" data-k="' + h(key) + '" data-f="start" value="' + h(s.start) + '"><input type="time" aria-label="To" data-k="' + h(key) + '" data-f="end" value="' + h(s.end) + '"></div>';
        }
        html += '<div class="hrs-tag" data-hrs="' + h(key) + '"></div>';
        html += '<input type="text" data-k="' + h(key) + '" data-f="notes" placeholder="Note" value="' + h(s.notes) + '">';
        html += '</div></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div><div class="row-btns">';
    html += '<button type="button" class="mini" data-act="add-oncall" data-store="' + h(store) + '">Add on-call line</button>';
    if (n > (typeof ON_CALL_MIN === 'number' ? ON_CALL_MIN : 2)) html += '<button type="button" class="mini" data-act="remove-oncall" data-store="' + h(store) + '">Remove On-call ' + n + '</button>';
    html += '</div></section>';
    return html;
  }
  function managerCard(days) {
    var html = '<section class="card"><h2><span class="dot"></span>Manager schedule</h2><p class="rule">Jonathan Cowan, store manager. This is not a cashier shift. Set From and To for each day he works. A name with no times is not saved. Manager on-call is optional and stays out of the hourly budget.</p><div class="tblwrap"><table class="gridweek"><thead><tr><th class="shiftname"></th>';
    days.forEach(function (dt) { html += '<th>' + h(dayHead(dt)) + '</th>'; });
    html += '</tr></thead><tbody><tr><th class="shiftname">Manager</th>';
    days.forEach(function (dt) {
      var row = state.draft.manager[dt];
      var selected = row ? row.employee : defaultManagerName();
      html += '<td><div class="mgrgrid">' + selectHtml(managers(), selected, 'Choose manager', 'data-mgr="' + dt + '" data-kind="shift" data-f="employee"', false);
      html += '<div class="times"><input type="time" aria-label="Manager from" data-mgr="' + dt + '" data-kind="shift" data-f="start" value="' + h(row ? row.start : '') + '"><input type="time" aria-label="Manager to" data-mgr="' + dt + '" data-kind="shift" data-f="end" value="' + h(row ? row.end : '') + '"></div>';
      html += '<input type="text" placeholder="Note" data-mgr="' + dt + '" data-kind="shift" data-f="notes" value="' + h(row ? row.notes : '') + '"></div></td>';
    });
    html += '</tr><tr><th class="shiftname">Manager on-call</th>';
    days.forEach(function (dt) {
      var row = state.draft.mgrOncall[dt] || { employee: '', start: '', end: '', notes: '' };
      html += '<td><div class="mgrgrid">' + selectHtml(managers(), row.employee, 'No on-call', 'data-mgr="' + dt + '" data-kind="oncall" data-f="employee"', false);
      html += '<div class="times"><input type="time" aria-label="On-call from" data-mgr="' + dt + '" data-kind="oncall" data-f="start" value="' + h(row.start) + '"><input type="time" aria-label="On-call to" data-mgr="' + dt + '" data-kind="oncall" data-f="end" value="' + h(row.end) + '"></div>';
      html += '<input type="text" placeholder="Note" data-mgr="' + dt + '" data-kind="oncall" data-f="notes" value="' + h(row.notes) + '"></div></td>';
    });
    html += '</tr></tbody></table></div></section>';
    return html;
  }
  function monthPick(id, year, month) {
    var html = '<select id="' + id + 'Month">';
    MONTHS.forEach(function (name, i) { html += '<option value="' + i + '"' + (i === month ? ' selected' : '') + '>' + name + '</option>'; });
    html += '</select> <select id="' + id + 'Year">';
    for (var y = year - 1; y <= year + 2; y++) html += '<option' + (y === year ? ' selected' : '') + '>' + y + '</option>';
    return html + '</select>';
  }
  function bulkCard() {
    var d = parseISO(state.cursor), y = d.getFullYear(), m = d.getMonth();
    return '<section class="card"><h2><span class="dot"></span>Use this week for more dates</h2>'
      + '<p class="rule">Copies the cashiers, the on-call lines, and the manager From / To times. You confirm before a saved week is replaced.</p>'
      + '<p><b>Step 1. Where should this week be copied?</b></p>'
      + '<label><input type="radio" name="applyMode" value="rest" checked> The rest of this month</label>'
      + '<label><input type="radio" name="applyMode" value="nweeks"> The next <input id="applyN" type="number" min="1" max="52" value="4" style="max-width:80px"> weeks</label>'
      + '<label><input type="radio" name="applyMode" value="through"> Through this date <input id="applyThrough" type="date"></label>'
      + '<label><input type="radio" name="applyMode" value="year"> The whole year <input id="applyYear" type="number" min="2020" max="2045" value="' + y + '" style="max-width:100px"></label>'
      + '<p><b>Step 2. If a week already has people</b></p>'
      + '<label><input type="radio" name="applyConflict" value="skip" checked> Skip that week</label>'
      + '<label><input type="radio" name="applyConflict" value="overwrite"> Replace that week</label>'
      + '<p><b>Step 3.</b> Press apply. The sheet updates for those weeks.</p>'
      + '<button type="button" class="btn" data-act="apply">Apply this week</button>'
      + '<h2 style="margin-top:22px"><span class="dot"></span>Copy a month</h2>'
      + '<p class="rule">The first Monday copies onto the first Monday of the new month, the second Monday onto the second Monday, and so on.</p>'
      + '<p>From ' + monthPick('copyFrom', y, m) + ' onto ' + monthPick('copyTo', m === 11 ? y + 1 : y, (m + 1) % 12) + '</p>'
      + '<label><input type="radio" name="copyConflict" value="skip" checked> Skip days that already have people</label>'
      + '<label><input type="radio" name="copyConflict" value="overwrite"> Replace those days</label>'
      + '<button type="button" class="btn secondary" data-act="copy-month">Copy month</button></section>';
  }
  function linkCard() {
    var html = '<section class="card"><h2><span class="dot"></span>Phone link for one person</h2><p class="rule">Read only. Send the link so they can see their own shifts.</p>';
    html += selectHtml(everyone(), '', 'Choose a person', 'id="linkEmp"', true);
    html += '<div class="row-btns"><button type="button" class="mini" data-act="copy-link">Show phone link</button></div><p id="linkOut" class="rule"></p></section>';
    return html;
  }

  function paintMonth() {
    var d = parseISO(state.cursor), y = d.getFullYear(), m = d.getMonth();
    var first = monthStart(state.cursor), last = monthEnd(state.cursor);
    var cells = rangeDays(mondayOf(first), addDays(mondayOf(last), 6));
    var html = '<section class="card"><h2><span class="dot"></span>' + MONTHS[m] + ' ' + y + '</h2><p class="rule">Each day lists who is saved. Press the date to edit that week. Amber means a cashier shift is still open.</p><div class="cal">';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (n) { html += '<div class="dow">' + n + '</div>'; });
    cells.forEach(function (dt) {
      var dd = parseISO(dt), inMonth = dd.getMonth() === m;
      html += '<div class="day' + (inMonth ? '' : ' out') + '">';
      if (inMonth) {
        html += '<button type="button" class="dayhead" data-week="' + mondayOf(dt) + '">' + dd.getDate() + '</button>';
        html += dayBody(dt);
      }
      html += '</div>';
    });
    html += '</div></section>';
    document.getElementById('viewRoot').innerHTML = html;
  }
  function dayBody(dt) {
    var html = '';
    stores().forEach(function (store) {
      var tpls = (SHIFT_TEMPLATES && SHIFT_TEMPLATES[store]) || [];
      var rows = shiftsOn(dt).filter(function (s) { return s.store === store; });
      if (!rows.length && !(mgrOn(dt).length)) return;
      var open = 0;
      html += '<div class="nm"><b>' + h(shortStore(store)) + '</b></div>';
      if (!rows.length) { html += '<span class="muted">Not started</span>'; return; }
      tpls.forEach(function (t) {
        var hit = null;
        rows.forEach(function (s) { if (s.shift_name === t.name) hit = s; });
        if (!hit || !hit.employee) { open++; html += '<span class="nm gap">Open · ' + h(t.name) + '</span>'; }
        else html += '<span class="nm">' + h(hit.employee) + ' · ' + h(t.name) + '</span>';
      });
      rows.forEach(function (s) {
        if (!isOnCallName(s.shift_name) || !s.employee) return;
        html += '<span class="nm">' + h(s.employee) + ' · ' + h(s.shift_name) + ' ' + h(fmtTime(s.start)) + '–' + h(fmtTime(s.end)) + '</span>';
      });
      if (open) html += '<span class="nm gap">' + open + ' open</span>';
    });
    mgrOn(dt).forEach(function (m) {
      if (!m.employee) return;
      var label = m.kind === 'oncall' ? 'Manager on-call' : 'Manager';
      html += '<span class="nm"><b>' + label + '</b> ' + h(m.employee) + (m.start && m.end ? ' ' + h(fmtTime(m.start)) + '–' + h(fmtTime(m.end)) : '') + '</span>';
    });
    if (!html) html = '<span class="muted">Not started</span>';
    return html;
  }
  function paintYear() {
    var y = parseISO(state.cursor).getFullYear(), html = '<section class="card"><h2><span class="dot"></span>' + y + '</h2><p class="rule">Press a month or a week to open it. Hours compare what is saved with the budget for the days already on the sheet.</p>';
    for (var m = 0; m < 12; m++) {
      var from = toISO(new Date(y, m, 1)), to = toISO(new Date(y, m + 1, 0));
      var days = rangeDays(from, to), shifts = [], manager = [];
      days.forEach(function (dt) { shifts = shifts.concat(shiftsOn(dt)); manager = manager.concat(mgrOn(dt)); });
      var sum = summarize({ dates: days, shifts: shifts, manager: manager, rate: state.rate, mode: 'saved', stores: stores(), hoursPerDay: hoursMap() });
      html += '<div class="monthcard"><h3><button type="button" data-month="' + y + '-' + pad(m + 1) + '">' + MONTHS[m] + '</button></h3><p>' + h(rollupPhrase(sum, state.rate)) + '</p>';
      if (sum.managerMin) html += '<p class="muted">Manager ' + fmtH(sum.managerMin / 60) + ' h, salary</p>';
      weeksTouching(from, to).forEach(function (monday) {
        var wdays = rangeDays(monday, addDays(monday, 6));
        var filled = 0, total = 0;
        wdays.forEach(function (dt) {
          if (dt < from || dt > to) return;
          stores().forEach(function (store) {
            var tpls = (SHIFT_TEMPLATES && SHIFT_TEMPLATES[store]) || [];
            total += tpls.length;
            tpls.forEach(function (t) {
              var hit = null;
              shiftsOn(dt).forEach(function (s) { if (s.store === store && s.shift_name === t.name && s.employee) hit = s; });
              if (hit) filled++;
            });
          });
        });
        html += '<div class="weekline"><button type="button" data-week="' + monday + '">' + h(dayHead(monday)) + ' – ' + h(dayHead(addDays(monday, 6))) + '</button><span>' + filled + ' / ' + total + ' cashier shifts filled</span></div>';
      });
      html += '</div>';
    }
    html += '</section>';
    document.getElementById('viewRoot').innerHTML = html;
  }
  function paintList() {
    var days = rangeDays(state.rangeFrom, state.rangeTo);
    var rows = [];
    days.forEach(function (dt) {
      shiftsOn(dt).forEach(function (s) {
        rows.push({ date: dt, store: s.store, shift: s.shift_name, start: s.start || '', end: s.end || '', employee: s.employee || '', notes: s.notes || '', mins: (s.employee && s.start && s.end) ? minutesBetween(s.start, s.end) : 0 });
      });
      mgrOn(dt).forEach(function (m) {
        rows.push({ date: dt, store: m.kind === 'oncall' ? 'Manager on-call' : 'Manager', shift: m.kind === 'oncall' ? 'Manager on-call' : 'Manager', start: m.start || '', end: m.end || '', employee: m.employee || '', notes: m.notes || '', mins: (m.employee && m.start && m.end) ? minutesBetween(m.start, m.end) : 0 });
      });
    });
    var names = {};
    rows.forEach(function (r) { if (r.employee) names[r.employee] = true; });
    (state.employees || []).forEach(function (e) { names[e.name] = true; });
    var filtered = rows.filter(function (r) {
      if (state.listStore === 'Manager') { if (r.store.indexOf('Manager') !== 0) return false; }
      else if (state.listStore && r.store !== state.listStore) return false;
      if (state.listEmployee && r.employee !== state.listEmployee) return false;
      if (!state.listOpen && !r.employee) return false;
      return true;
    });
    var key = state.sortKey || 'date', dir = state.sortDir || 1;
    filtered.sort(function (a, b) {
      var va = key === 'hours' ? a.mins : String(a[key] || ''), vb = key === 'hours' ? b.mins : String(b[key] || '');
      if (va < vb) return -1 * dir; if (va > vb) return 1 * dir;
      if (a.date < b.date) return -1; if (a.date > b.date) return 1; return 0;
    });
    var html = '<section class="card"><h2><span class="dot"></span>Scheduled list</h2><p class="rule">Saved shifts for the dates above. Use Print / PDF for a paper copy. The budget at the top uses every saved shift in these dates.</p>';
    html += '<div class="filters no-print"><div><label>Store</label><select id="listStore"><option value="">All</option>';
    stores().forEach(function (s) { html += '<option' + (state.listStore === s ? ' selected' : '') + '>' + h(s) + '</option>'; });
    html += '<option value="Manager"' + (state.listStore === 'Manager' ? ' selected' : '') + '>Manager</option></select></div>';
    html += '<div><label>Employee</label><select id="listEmp"><option value="">Everyone</option>';
    Object.keys(names).sort().forEach(function (n) { html += '<option' + (state.listEmployee === n ? ' selected' : '') + '>' + h(n) + '</option>'; });
    html += '</select></div><div><label><input type="checkbox" id="listOpen"' + (state.listOpen ? ' checked' : '') + '> Show open shifts</label></div></div>';
    if (!filtered.length) html += '<p>Nothing saved for this filter.</p>';
    else {
      html += '<div class="tblwrap"><table class="list"><thead><tr>';
      [['date', 'Date'], ['store', 'Store'], ['shift', 'Shift'], ['start', 'From'], ['end', 'To'], ['hours', 'Hours'], ['employee', 'Employee'], ['notes', 'Notes']].forEach(function (c) {
        html += '<th data-sort="' + c[0] + '">' + c[1] + (state.sortKey === c[0] ? (state.sortDir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
      });
      html += '</tr></thead><tbody>';
      filtered.forEach(function (r) {
        var inactive = r.employee && !roleOf(r.employee);
        html += '<tr><td>' + h(pretty(r.date)) + '</td><td>' + h(shortStore(r.store)) + '</td><td>' + h(r.shift) + '</td><td>' + h(fmtTime(r.start)) + '</td><td>' + h(fmtTime(r.end)) + '</td><td>' + (r.mins ? fmtH(r.mins / 60) : '') + '</td><td>' + h(r.employee || 'Open') + (inactive ? ' · inactive' : '') + '</td><td class="wrap">' + h(r.notes) + '</td></tr>';
      });
      html += '</tbody></table></div><p class="muted">' + filtered.length + ' rows</p>';
    }
    html += '</section>';
    document.getElementById('viewRoot').innerHTML = html;
  }

  function weekHasPeople(monday) {
    var days = rangeDays(monday, addDays(monday, 6));
    for (var i = 0; i < days.length; i++) {
      var rows = shiftsOn(days[i]);
      for (var j = 0; j < rows.length; j++) if (rows[j].employee) return true;
      var mgr = mgrOn(days[i]);
      for (var k = 0; k < mgr.length; k++) if (mgr[k].employee) return true;
    }
    return false;
  }
  function weekRowCount(monday) {
    var n = 0;
    rangeDays(monday, addDays(monday, 6)).forEach(function (dt) { n += shiftsOn(dt).length + mgrOn(dt).length; });
    return n;
  }
  function dayHasPeople(dt) {
    var i;
    for (i = 0; i < shiftsOn(dt).length; i++) if (shiftsOn(dt)[i].employee) return true;
    for (i = 0; i < mgrOn(dt).length; i++) if (mgrOn(dt)[i].employee) return true;
    return false;
  }
  function targetWeeks(src, mode) {
    var list = [];
    if (mode === 'nweeks') {
      var n = Math.max(1, Math.min(52, parseInt(document.getElementById('applyN').value, 10) || 1));
      var m = addDays(src, 7);
      for (var i = 0; i < n; i++) { list.push(m); m = addDays(m, 7); }
    } else if (mode === 'through') {
      var through = document.getElementById('applyThrough').value;
      if (!through) return [];
      var endMon = mondayOf(through), cur = addDays(src, 7);
      var g = 0;
      while (cur <= endMon && g < 60) { list.push(cur); cur = addDays(cur, 7); g++; }
    } else if (mode === 'year') {
      var y = parseInt(document.getElementById('applyYear').value, 10) || parseISO(src).getFullYear();
      list = weeksTouching(y + '-01-01', y + '-12-31').filter(function (w) { return w !== src; });
    } else {
      var last = monthEnd(src), next = addDays(src, 7);
      if (next <= last || rangeDays(next, addDays(next, 6)).some(function (d) { return d <= last && d > addDays(src, 6); })) {
        weeksTouching(next, last).forEach(function (w) { if (w !== src) list.push(w); });
      }
    }
    return list;
  }
  function patternFromDraft(destMonday) {
    var src = state.draft.week, shifts = [], manager = [], stripped = 0;
    rangeDays(src, addDays(src, 6)).forEach(function (dt, idx) {
      var dest = addDays(destMonday, idx);
      Object.keys(state.draft.slots).forEach(function (k) {
        var s = state.draft.slots[k];
        if (s.date !== dt) return;
        var name = s.employee || '';
        if (name) {
          var keep = activeKeep(name, s.oncall ? '' : 'cashier');
          if (!keep) { stripped++; name = ''; }
        }
        if (s.oncall && !name) return;
        if (s.oncall && !s.start && !s.end) return;
        var start = s.start, endT = s.end, t = !s.oncall ? templateOf(s.store, s.shift_name) : null;
        if (t) { start = t.start; endT = t.end; }
        if (!s.oncall || name) shifts.push({ date: dest, store: s.store, shift_name: s.shift_name, start: start || '', end: endT || '', employee: name, notes: s.notes || '' });
      });
      function copyMgr(bucket, kind) {
        var m = bucket[dt];
        if (!m || (m.auto && !m.start && !m.end && !m.notes)) return;
        if (!m.employee && !m.start && !m.end && !m.notes) return;
        var name = m.employee || '';
        if (name && !activeKeep(name, 'manager')) { stripped++; return; }
        manager.push({ date: dest, employee: name, start: m.start || '', end: m.end || '', notes: m.notes || '', kind: kind });
      }
      copyMgr(state.draft.manager, 'shift');
      copyMgr(state.draft.mgrOncall, 'oncall');
    });
    return { shifts: shifts, manager: manager, stripped: stripped };
  }
  function cloneDay(src, dest, strip) {
    var shifts = [], manager = [], stripped = 0;
    shiftsOn(src).forEach(function (s) {
      var name = s.employee || '', oncall = isOnCallName(s.shift_name);
      if (strip && name) {
        var keep = activeKeep(name, oncall ? '' : 'cashier');
        if (!keep) { stripped++; name = ''; }
      }
      if (oncall && !name) return;
      shifts.push({ date: dest, store: s.store, shift_name: s.shift_name, start: s.start || '', end: s.end || '', employee: name, notes: s.notes || '' });
    });
    mgrOn(src).forEach(function (m) {
      var name = m.employee || '';
      if (strip && name && !activeKeep(name, 'manager')) { stripped++; return; }
      if (!name && !m.start && !m.end && !m.notes) return;
      manager.push({ date: dest, employee: name, start: m.start || '', end: m.end || '', notes: m.notes || '', kind: m.kind || 'shift' });
    });
    return { shifts: shifts, manager: manager, stripped: stripped };
  }
  function cloneWeek(srcMonday, destMonday) {
    var shifts = [], manager = [], stripped = 0;
    rangeDays(srcMonday, addDays(srcMonday, 6)).forEach(function (dt, i) {
      var part = cloneDay(dt, addDays(destMonday, i), true);
      stripped += part.stripped;
      shifts = shifts.concat(part.shifts);
      manager = manager.concat(part.manager);
    });
    return { shifts: shifts, manager: manager, stripped: stripped };
  }
  function installDraft(week, built) {
    var draft = { week: week, slots: {}, manager: {}, mgrOncall: {} };
    built.shifts.forEach(function (s) {
      draft.slots[slotKey(s.store, s.date, s.shift_name)] = {
        date: s.date, store: s.store, shift_name: s.shift_name, start: s.start || '', end: s.end || '',
        employee: s.employee || '', notes: s.notes || '', oncall: isOnCallName(s.shift_name)
      };
    });
    built.manager.forEach(function (m) {
      var row = { employee: m.employee || '', start: m.start || '', end: m.end || '', notes: m.notes || '', auto: false };
      if (m.kind === 'oncall') draft.mgrOncall[m.date] = row; else draft.manager[m.date] = row;
    });
    state.draft = draft;
    ensureDraftSlots();
  }

  function syncPickers() {
    var selY = document.getElementById('pickYear');
    if (!selY) return;
    var d = parseISO(state.cursor), y = d.getFullYear();
    var a = Math.min(2024, y - 1), b = Math.max(2032, y + 1), html = '';
    for (var i = a; i <= b; i++) html += '<option value="' + i + '">' + i + '</option>';
    selY.innerHTML = html; selY.value = String(y);
    document.getElementById('pickMonth').value = String(d.getMonth());
    var weeks = weeksTouching(monthStart(state.cursor), monthEnd(state.cursor));
    var wh = '';
    weeks.forEach(function (w) { wh += '<option value="' + w + '">' + pretty(w) + ' – ' + pretty(addDays(w, 6)) + '</option>'; });
    var wk = document.getElementById('pickWeek');
    wk.innerHTML = wh;
    var monday = mondayOf(state.cursor);
    if (weeks.indexOf(monday) >= 0) wk.value = monday;
    document.querySelectorAll('.viewtabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === state.view); });
    var label = document.getElementById('periodLabel');
    if (label) {
      if (state.view === 'week') label.textContent = 'Editing the week of ' + pretty(monday) + ' through ' + pretty(addDays(monday, 6)) + '.';
      else if (state.view === 'month') label.textContent = MONTHS[d.getMonth()] + ' ' + y + '. Saved shifts are listed on each day.';
      else if (state.view === 'year') label.textContent = y + '. Open a month or a week to see names.';
      else label.textContent = 'Scheduled list for ' + pretty(state.rangeFrom) + ' through ' + pretty(state.rangeTo) + '.';
    }
  }
  function moveCursor(iso, view) {
    var nextView = view || state.view;
    var leaving = state.view === 'week' && state.dirty && (nextView !== 'week' || mondayOf(iso) !== mondayOf(state.cursor));
    if (leaving && !confirm('This week has changes that are not saved. Leave without saving?')) { syncPickers(); return false; }
    if (leaving) { state.dirty = false; state.draft = null; }
    state.cursor = iso;
    if (view) state.view = view;
    render();
    return true;
  }
  function render() {
    if (document.body.getAttribute('data-page') !== 'edit') return;
    syncPickers();
    var token = ++renderToken, job, from, to;
    if (state.view === 'week') { from = addDays(mondayOf(state.cursor), -1); to = addDays(mondayOf(state.cursor), 7); }
    else if (state.view === 'month') { from = monthStart(state.cursor); to = monthEnd(state.cursor); }
    else if (state.view === 'year') { from = yearStart(state.cursor); to = yearEnd(state.cursor); }
    else {
      if (!state.rangeFrom || !state.rangeTo || state.rangeFrom > state.rangeTo) {
        document.getElementById('viewRoot').innerHTML = '<section class="card"><p>Choose From and To, then press Show scheduled list for these dates.</p></section>';
        return;
      }
      if (rangeDays(state.rangeFrom, state.rangeTo).length > 400) {
        document.getElementById('viewRoot').innerHTML = '<section class="card"><p>Pick 400 days or fewer.</p></section>';
        return;
      }
      from = state.rangeFrom; to = state.rangeTo;
    }
    document.getElementById('viewRoot').innerHTML = '<p class="muted">Loading saved schedule…</p>';
    job = needRange(from, to);
    job.then(function () {
      if (token !== renderToken) return;
      if (state.view === 'week') {
        var w = mondayOf(state.cursor);
        if (!state.draft || state.draft.week !== w) { loadDraft(w); state.dirty = false; }
        paintWeek();
      } else if (state.view === 'month') { paintMonth(); renderBudget(); renderPeople(); renderFlags(); }
      else if (state.view === 'year') { paintYear(); renderBudget(); renderPeople(); renderFlags(); }
      else { paintList(); renderBudget(); renderPeople(); renderFlags(); }
    }).catch(function () {
      if (token !== renderToken) return;
      var note = document.getElementById('redeploy');
      if (note) note.classList.remove('hidden');
      document.getElementById('viewRoot').innerHTML = '';
    });
  }

  function onField(el) {
    var k = el.getAttribute('data-k'), f = el.getAttribute('data-f');
    if (k && state.draft && state.draft.slots[k]) {
      state.draft.slots[k][f] = el.value;
      state.dirty = true;
      refreshSide();
      var line = document.getElementById('statusLine'); if (line) line.textContent = 'This week has unsaved changes.';
      return;
    }
    var md = el.getAttribute('data-mgr');
    if (md && state.draft) {
      var kind = el.getAttribute('data-kind') === 'oncall' ? 'oncall' : 'shift';
      var bucket = kind === 'oncall' ? state.draft.mgrOncall : state.draft.manager;
      if (!bucket[md]) {
        var sel = document.querySelector('select[data-mgr="' + md + '"][data-kind="' + kind + '"]');
        bucket[md] = { employee: sel ? sel.value : '', start: '', end: '', notes: '', auto: false };
      }
      bucket[md][f] = el.value;
      bucket[md].auto = false;
      state.dirty = true;
      refreshSide();
    }
  }
  function saveWeek() {
    var built = rowsFromDraft(state.draft.week);
    var bad = badNames(built.shifts, built.manager, true);
    if (bad.length) { say('These people are not active for that spot: ' + bad.join(', '), true); return; }
    var dates = rangeDays(state.draft.week, addDays(state.draft.week, 6));
    say('Saving…');
    savePayloads(dates, built.shifts, built.manager).then(function () {
      state.dirty = false; state.savedRate = state.rate; state.rateDirty = false;
      var note = document.getElementById('rateNote'); if (note) note.textContent = '';
      loadDraft(state.draft.week);
      state.dirty = false;
      paintWeek();
      say(state.demo ? 'Saved on this computer (demo).' : 'Saved this week.');
      pageMsg(state.demo ? 'Demo save stays on this computer. The Google Sheet was not changed.' : 'Saved. Open Month or Year to see this week with the rest.');
    }).catch(function (e) {
      say(e && e.message === 'redeploy' ? 'Update the Google script before saving. See the note at the top.' : 'Could not save.', true);
    });
  }
  function copyLast() {
    var src = addDays(state.draft.week, -7);
    needRange(src, addDays(src, 6)).then(function () {
      if (!weekRowCount(src)) { say('Nothing is saved for last week.', true); return; }
      if (!confirm('Copy last week onto this screen? You still need to press Save this week.')) return;
      var built = cloneWeek(src, state.draft.week);
      installDraft(state.draft.week, built);
      state.dirty = true;
      paintWeek();
      say('Last week is on this screen. Press Save this week.' + (built.stripped ? ' Inactive people were left off.' : ''));
    });
  }
  function applyPattern() {
    var mode = (document.querySelector('input[name=applyMode]:checked') || {}).value || 'rest';
    var conflict = (document.querySelector('input[name=applyConflict]:checked') || {}).value || 'skip';
    var src = state.draft.week;
    var targets = targetWeeks(src, mode);
    if (!targets.length) { say('There are no weeks in that range after this one.', true); return; }
    var from = targets[0], to = addDays(targets[targets.length - 1], 6);
    needRange(from, to).then(function () {
      var write = [], skip = 0;
      targets.forEach(function (m) { if (conflict === 'skip' && weekHasPeople(m)) skip++; else write.push(m); });
      if (!write.length) { say('Every week in that range already has people. Choose Replace that week to overwrite them.', true); return; }
      var msg = 'Copy this week onto ' + write.length + ' week' + (write.length === 1 ? '' : 's') + ', ' + pretty(write[0]) + ' through ' + pretty(addDays(write[write.length - 1], 6)) + '?';
      if (skip) msg += ' ' + skip + ' week' + (skip === 1 ? '' : 's') + ' already ' + (skip === 1 ? 'has' : 'have') + ' people and will be left as they are.';
      if (conflict === 'overwrite') msg += ' This replaces schedules already saved.';
      if (write[0] < toISO(new Date())) msg += ' This includes dates before today.';
      msg += ' Manager times and on-call lines are copied too.';
      if (!confirm(msg)) return;
      var shifts = [], manager = [], dates = [], stripped = 0;
      write.forEach(function (m) {
        var built = patternFromDraft(m);
        stripped += built.stripped;
        shifts = shifts.concat(built.shifts);
        manager = manager.concat(built.manager);
        dates = dates.concat(rangeDays(m, addDays(m, 6)));
      });
      return savePayloads(dates, shifts, manager).then(function () {
        say('Applied to ' + write.length + ' weeks.');
        pageMsg('Those weeks are saved. Open Month or Year to review them.' + (stripped ? ' Inactive people were left off the new weeks.' : ''));
        renderBudget();
      });
    }).catch(function (e) { say((e && e.message) || 'Could not apply that pattern.', true); });
  }
  function copyMonth() {
    var fy = +document.getElementById('copyFromYear').value, fm = +document.getElementById('copyFromMonth').value;
    var ty = +document.getElementById('copyToYear').value, tm = +document.getElementById('copyToMonth').value;
    if (fy === ty && fm === tm) { say('Pick two different months.', true); return; }
    var conflict = (document.querySelector('input[name=copyConflict]:checked') || {}).value || 'skip';
    var srcFrom = toISO(new Date(fy, fm, 1)), srcTo = toISO(new Date(fy, fm + 1, 0));
    var dstFrom = toISO(new Date(ty, tm, 1)), dstTo = toISO(new Date(ty, tm + 1, 0));
    needRange(srcFrom, srcTo).then(function () { return needRange(dstFrom, dstTo); }).then(function () {
      var index = monthIndex(fy, fm);
      var dates = [], shifts = [], manager = [], stripped = 0, skipped = 0;
      rangeDays(dstFrom, dstTo).forEach(function (dest) {
        if (conflict === 'skip' && dayHasPeople(dest)) { skipped++; return; }
        var src = sourceDateFor(dest, index);
        if (!src) return;
        var built = cloneDay(src, dest, true);
        stripped += built.stripped;
        if (conflict === 'skip' && !built.shifts.length && !built.manager.length) return;
        dates.push(dest);
        shifts = shifts.concat(built.shifts);
        manager = manager.concat(built.manager);
      });
      if (!dates.length) { say('Nothing to copy. The source month is empty, or every day already has people.', true); return; }
      var msg = 'Copy ' + MONTHS[fm] + ' ' + fy + ' onto ' + MONTHS[tm] + ' ' + ty + '? ' + dates.length + ' days will be written.';
      if (skipped) msg += ' ' + skipped + ' days already have people and will be left as they are.';
      if (conflict === 'overwrite') msg += ' This replaces what is saved on those days.';
      if (!confirm(msg)) return;
      return savePayloads(dates, shifts, manager).then(function () {
        say('Month copied.');
        pageMsg('Copied ' + MONTHS[fm] + ' ' + fy + ' onto ' + MONTHS[tm] + ' ' + ty + '.' + (stripped ? ' Inactive people were left off.' : ''));
        render();
      });
    }).catch(function (e) { say((e && e.message) || 'Could not copy that month.', true); });
  }
  function addOnCall(store) {
    var n = onCallCount(store) + 1;
    var max = typeof ON_CALL_MAX === 'number' ? ON_CALL_MAX : 6;
    if (n > max) { say('Six on-call lines is the maximum.', true); return; }
    state.extraLines[store] = n;
    ensureDraftSlots();
    state.dirty = true;
    paintWeek();
  }
  function removeOnCall(store) {
    var n = onCallCount(store), min = typeof ON_CALL_MIN === 'number' ? ON_CALL_MIN : 2;
    if (n <= min) return;
    var name = 'On-call ' + n, used = false;
    rangeDays(state.draft.week, addDays(state.draft.week, 6)).forEach(function (dt) {
      var s = state.draft.slots[slotKey(store, dt, name)];
      if (s && (s.employee || s.start || s.end || s.notes)) used = true;
    });
    if (used && !confirm('Remove ' + name + ' at ' + store + '? It is dropped when you save.')) return;
    rangeDays(state.draft.week, addDays(state.draft.week, 6)).forEach(function (dt) { delete state.draft.slots[slotKey(store, dt, name)]; });
    state.extraLines[store] = n - 1;
    state.dirty = true;
    paintWeek();
  }

  function onClick(e) {
    var t = e.target;
    if (t && t.closest) {
      var act = t.closest('[data-act]');
      if (act) {
        var name = act.getAttribute('data-act');
        if (name === 'save') saveWeek();
        else if (name === 'copy-last') copyLast();
        else if (name === 'apply') applyPattern();
        else if (name === 'copy-month') copyMonth();
        else if (name === 'add-oncall') addOnCall(act.getAttribute('data-store'));
        else if (name === 'remove-oncall') removeOnCall(act.getAttribute('data-store'));
        else if (name === 'copy-link') showLink();
        return;
      }
      var weekBtn = t.closest('[data-week]');
      if (weekBtn) { moveCursor(weekBtn.getAttribute('data-week'), 'week'); return; }
      var monthBtn = t.closest('[data-month]');
      if (monthBtn) {
        var p = monthBtn.getAttribute('data-month').split('-');
        moveCursor(p[0] + '-' + p[1] + '-01', 'month');
        return;
      }
      var sort = t.closest('[data-sort]');
      if (sort) {
        var key = sort.getAttribute('data-sort');
        if (state.sortKey === key) state.sortDir = -state.sortDir; else { state.sortKey = key; state.sortDir = 1; }
        paintList();
      }
    }
  }
  function showLink() {
    var sel = document.getElementById('linkEmp');
    var name = sel ? sel.value : '';
    var out = document.getElementById('linkOut');
    if (!name) { if (out) out.textContent = 'Choose a person first.'; return; }
    var url = 'schedule_view.html?name=' + encodeURIComponent(name) + '&week=' + encodeURIComponent(state.draft.week) + (state.demo ? '&demo=1' : '');
    var abs = new URL(url, location.href).href;
    if (out) out.innerHTML = '<a href="' + h(url) + '">' + h(abs) + '</a>';
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(abs).then(function () { say('Link copied.'); }, function () {});
  }
  function saveRate() {
    var n = parseFloat(document.getElementById('payRate').value);
    if (!isFinite(n) || n < 0 || n > 500) { say('Enter a pay rate from 0 to 500.', true); return; }
    state.rate = Math.round(n * 100) / 100;
    if (state.demo) {
      cache.rate = state.rate; state.savedRate = state.rate; state.rateDirty = false; persistDemo();
      var note = document.getElementById('rateNote'); if (note) note.textContent = '';
      say('Rate saved on this computer (demo).'); renderBudget(); return;
    }
    if (!state.backend) { say('Update the Google script before saving the rate, or use demo.', true); return; }
    jsonp({ action: 'employees' }).then(function () {
      return fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ form: 'schedule_settings', base_pay_rate: state.rate, pin: localStorage.getItem('vm_pin') || '' }) });
    }).then(function () {
      state.savedRate = state.rate; state.rateDirty = false; cache.rate = state.rate;
      var note = document.getElementById('rateNote'); if (note) note.textContent = '';
      say('Pay rate saved on the sheet.');
    }).catch(function () { say('Could not save the rate.', true); });
  }
  function bindEdit() {
    document.body.addEventListener('click', onClick);
    document.body.addEventListener('change', function (e) {
      if (e.target && (e.target.getAttribute('data-k') || e.target.getAttribute('data-mgr'))) onField(e.target);
      if (e.target && e.target.id === 'listStore') { state.listStore = e.target.value; paintList(); }
      if (e.target && e.target.id === 'listEmp') { state.listEmployee = e.target.value; paintList(); }
      if (e.target && e.target.id === 'listOpen') { state.listOpen = e.target.checked; paintList(); }
    });
    document.body.addEventListener('input', function (e) {
      if (e.target && (e.target.getAttribute('data-k') || e.target.getAttribute('data-mgr'))) onField(e.target);
    });
    document.querySelectorAll('.viewtabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-view') === state.view) return;
        moveCursor(state.cursor, b.getAttribute('data-view'));
      });
    });
    document.getElementById('pickYear').addEventListener('change', function () {
      var d = parseISO(state.cursor);
      moveCursor(toISO(new Date(+this.value, d.getMonth(), 1)));
    });
    document.getElementById('pickMonth').addEventListener('change', function () {
      var d = parseISO(state.cursor);
      moveCursor(toISO(new Date(d.getFullYear(), +this.value, 1)));
    });
    document.getElementById('pickWeek').addEventListener('change', function () { moveCursor(this.value, 'week'); });
    document.getElementById('prevBtn').addEventListener('click', function () { nudge(-1); });
    document.getElementById('nextBtn').addEventListener('click', function () { nudge(1); });
    document.getElementById('todayBtn').addEventListener('click', function () { moveCursor(toISO(new Date()), state.view === 'list' ? 'week' : state.view); });
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    document.getElementById('showRange').addEventListener('click', function () {
      var f = document.getElementById('rangeFrom').value, t = document.getElementById('rangeTo').value;
      if (!f || !t || f > t) { say('Choose a From date and a To date. From has to be first.', true); return; }
      state.rangeFrom = f; state.rangeTo = t;
      if (state.view !== 'list') moveCursor(state.cursor, 'list'); else render();
    });
    document.getElementById('saveRate').addEventListener('click', saveRate);
    document.getElementById('payRate').addEventListener('input', function () {
      var n = parseFloat(this.value);
      if (!isFinite(n) || n < 0 || n > 500) return;
      state.rate = Math.round(n * 100) / 100;
      state.rateDirty = Math.abs(state.rate - state.savedRate) > 0.001;
      var note = document.getElementById('rateNote');
      if (note) note.textContent = state.rateDirty ? 'Press Save rate to keep $' + state.rate.toFixed(2) + ' an hour.' : '';
      renderBudget();
      if (state.view === 'week' && state.draft) renderFlags();
    });
    var month = document.getElementById('pickMonth'), mh = '';
    MONTHS.forEach(function (name, i) { mh += '<option value="' + i + '">' + name + '</option>'; });
    month.innerHTML = mh;
  }
  function nudge(dir) {
    if (state.view === 'year') {
      var y = parseISO(state.cursor).getFullYear() + dir;
      moveCursor(y + '-01-01');
    } else if (state.view === 'month') {
      var d = parseISO(state.cursor);
      moveCursor(toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    } else if (state.view === 'list') {
      var n = Math.max(1, rangeDays(state.rangeFrom, state.rangeTo).length) * dir;
      state.rangeFrom = addDays(state.rangeFrom, n);
      state.rangeTo = addDays(state.rangeTo, n);
      document.getElementById('rangeFrom').value = state.rangeFrom;
      document.getElementById('rangeTo').value = state.rangeTo;
      render();
    } else moveCursor(addDays(mondayOf(state.cursor), 7 * dir));
  }

  function bootEdit() {
    state.demo = qs('demo') === '1';
    state.view = 'week';
    state.cursor = mondayOf(toISO(new Date()));
    state.rate = typeof DEFAULT_PAY_RATE === 'number' ? DEFAULT_PAY_RATE : 10;
    state.savedRate = state.rate;
    state.rateDirty = false;
    state.dirty = false;
    state.draft = null;
    state.extraLines = {};
    state.keepNames = {};
    state.employees = [];
    state.backend = false;
    state.listStore = '';
    state.listEmployee = '';
    state.listOpen = false;
    state.sortKey = 'date';
    state.sortDir = 1;
    state.rangeFrom = monthStart(state.cursor);
    state.rangeTo = monthEnd(state.cursor);
    bindEdit();
    document.getElementById('rangeFrom').value = state.rangeFrom;
    document.getElementById('rangeTo').value = state.rangeTo;
    document.getElementById('payRate').value = Number(state.rate).toFixed(2);
    if (state.demo) {
      loadDemoStore();
      state.employees = demoEmployees();
      state.rate = cache.rate || state.rate;
      state.savedRate = state.rate;
      document.getElementById('payRate').value = Number(state.rate).toFixed(2);
      showDemoBanner();
      render();
      return;
    }
    fetchEmployees().then(function () { render(); }).catch(function () {
      document.getElementById('redeploy').classList.remove('hidden');
      document.getElementById('budgetBody').textContent = 'Budget numbers show after the sheet script is updated, or in the demo.';
      document.getElementById('viewRoot').innerHTML = '';
    });
  }

  function bootView() {
    state.demo = qs('demo') === '1';
    state.viewName = qs('name');
    state.personSpan = 'week';
    state.employees = [];
    var week = qs('week');
    state.cursor = (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) ? mondayOf(week) : mondayOf(toISO(new Date()));
    if (state.demo) { loadDemoStore(); state.employees = demoEmployees(); showDemoBanner(); }
    document.getElementById('prevBtn').onclick = function () { shiftPerson(-1); };
    document.getElementById('nextBtn').onclick = function () { shiftPerson(1); };
    document.getElementById('spanBtn').onclick = function () {
      state.personSpan = state.personSpan === 'week' ? 'month' : 'week';
      document.getElementById('spanBtn').textContent = state.personSpan === 'week' ? 'Show this month' : 'Show this week';
      paintPerson();
    };
    document.getElementById('printBtn').onclick = function () { window.print(); };
    paintPerson();
  }
  function shiftPerson(dir) {
    if (state.personSpan === 'month') {
      var d = parseISO(state.cursor);
      state.cursor = toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    } else state.cursor = addDays(mondayOf(state.cursor), 7 * dir);
    paintPerson();
  }
  function paintPerson() {
    var name = state.viewName, root = document.getElementById('viewRoot');
    if (!name) {
      var html = '<section class="card"><h2>Whose schedule?</h2><p>Use the link from the manager. It includes the person’s name.</p>';
      if (state.demo) demoEmployees().forEach(function (e) {
        html += '<p><a href="schedule_view.html?demo=1&name=' + encodeURIComponent(e.name) + '&week=' + mondayOf(state.cursor) + '">' + h(e.name) + '</a></p>';
      });
      root.innerHTML = html + '</section>';
      return;
    }
    var sub = document.getElementById('viewSub'); if (sub) sub.textContent = name + ' · read only';
    var from = state.personSpan === 'month' ? monthStart(state.cursor) : mondayOf(state.cursor);
    var to = state.personSpan === 'month' ? monthEnd(state.cursor) : addDays(from, 6);
    var label = document.getElementById('periodLabel');
    if (label) label.textContent = pretty(from) + ' through ' + pretty(to);
    var job;
    if (state.demo) job = Promise.resolve();
    else job = jsonp({ action: 'myschedule', name: name, from: from, to: to }).then(function (res) {
      if (!res || !Array.isArray(res.shifts)) throw new Error('not-schedule');
      rangeDays(from, to).forEach(function (dt) { cache.shifts[dt] = []; cache.manager[dt] = []; });
      res.shifts.forEach(function (s) { if (!cache.shifts[s.date]) cache.shifts[s.date] = []; cache.shifts[s.date].push(s); });
      res.manager.forEach(function (m) { if (!cache.manager[m.date]) cache.manager[m.date] = []; cache.manager[m.date].push(m); });
    });
    root.innerHTML = '<p class="muted">Loading…</p>';
    job.then(function () {
      var html = '<section class="card"><h2>' + h(name) + '</h2>', total = 0, mgr = 0, any = false;
      rangeDays(from, to).forEach(function (dt) {
        var lines = [];
        shiftsOn(dt).forEach(function (s) {
          if (s.employee !== name) return;
          any = true;
          var mins = (s.start && s.end) ? minutesBetween(s.start, s.end) : 0;
          total += mins;
          lines.push(shortStore(s.store) + ' · ' + s.shift_name + (s.start ? ' · ' + fmtTime(s.start) + '–' + fmtTime(s.end) : '') + (mins ? ' · ' + fmtH(mins / 60) + ' h' : '') + (s.notes ? ' · ' + s.notes : ''));
        });
        mgrOn(dt).forEach(function (m) {
          if (m.employee !== name) return;
          any = true;
          var mins = (m.start && m.end) ? minutesBetween(m.start, m.end) : 0;
          mgr += mins;
          lines.push((m.kind === 'oncall' ? 'Manager on-call' : 'Manager') + (m.start ? ' · ' + fmtTime(m.start) + '–' + fmtTime(m.end) : '') + (mins ? ' · ' + fmtH(mins / 60) + ' h' : '') + (m.notes ? ' · ' + m.notes : ''));
        });
        if (!lines.length) return;
        html += '<h3>' + h(pretty(dt)) + '</h3>';
        lines.forEach(function (ln) { html += '<p>' + h(ln) + '</p>'; });
      });
      if (!any) html += '<p>Nothing scheduled for these dates.</p>';
      else {
        html += '<p><b>' + fmtH(total / 60) + ' hours</b> on shifts and on-call.</p>';
        if (mgr) html += '<p><b>' + fmtH(mgr / 60) + ' manager hours</b>. Salary, separate from store labor.</p>';
      }
      root.innerHTML = html + '</section>';
    }).catch(function () {
      root.innerHTML = '<section class="card"><p>Could not load this schedule. The Google script needs the schedule update before live links work. Demo links work with ?demo=1.</p></section>';
    });
  }

  function boot() {
    if (document.body.getAttribute('data-page') === 'view') bootView();
    else bootEdit();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
