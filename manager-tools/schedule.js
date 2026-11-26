/* Varsa Group staff schedule.
 * Pure helpers are shared by the editor, the employee view, and node tests.
 * The week grid posts to the Cashier Tools Intake Apps Script (config.js WEB_APP_URL)
 * with action schedule_save / schedule_load. Until that script is redeployed, the page
 * runs in demo mode and keeps the sample week in this browser only.
 *
 * SHIFT TEMPLATES — edit this block to change shift names or hours.
 * Times are 24-hour HH:MM. An end of 00:00 means midnight.
 * An end earlier than the start (10:00 PM–6:00 AM) is an overnight shift.
 * One cashier is scheduled per store, per day, per shift.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VGSchedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SHIFT_STORES = [
    {
      name: 'Thomasville Chevron',
      blurb: 'Open 24/7',
      shifts: [
        { name: 'Morning', start: '06:00', end: '14:00' },
        { name: 'Afternoon', start: '14:00', end: '22:00' },
        { name: 'Overnight', start: '22:00', end: '06:00' }
      ]
    },
    {
      name: 'Thomasville OutRun',
      blurb: 'Open 5:00 AM – midnight',
      shifts: [
        { name: 'Morning', start: '05:00', end: '13:00' },
        { name: 'Evening', start: '13:00', end: '00:00' }
      ]
    }
  ];

  var STORE_MANAGER = { name: 'Jonathan Cowan', title: 'Store manager' };
  var HOUR_TARGET_MIN = 35;
  var HOUR_TARGET_MAX = 40;
  var MIN_REST_HOURS = 8;
  var DB_KEY = 'vg_sched_v1';
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function todayISO() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function normDate(v) {
    var s = String(v || '').trim();
    var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    var us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) return us[3] + '-' + ('0' + us[1]).slice(-2) + '-' + ('0' + us[2]).slice(-2);
    return s;
  }

  function normTime(t) {
    var s = String(t || '').trim();
    var ampm = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
      var h12 = parseInt(ampm[1], 10);
      var pm = ampm[3].toLowerCase() === 'pm';
      if (h12 === 12) h12 = pm ? 12 : 0;
      else if (pm) h12 += 12;
      return ('0' + h12).slice(-2) + ':' + ampm[2];
    }
    var m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return '';
    var hh = parseInt(m[1], 10);
    if (hh > 23) return '';
    return ('0' + hh).slice(-2) + ':' + m[2];
  }

  function normPhone(p) {
    return String(p || '').replace(/\D/g, '');
  }

  function parseISO(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return new Date(NaN);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function mondayOf(iso) {
    var d = parseISO(normDate(iso));
    if (isNaN(d.getTime())) d = parseISO(todayISO());
    var day = d.getUTCDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  function weekDates(monday) {
    var start = mondayOf(monday);
    return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(start, i); });
  }

  function daysBetween(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }

  function parts(iso) {
    var d = parseISO(iso);
    return { wd: WD[d.getUTCDay()], mon: MO[d.getUTCMonth()], day: d.getUTCDate(), year: d.getUTCFullYear() };
  }

  function shortDate(iso) {
    var p = parts(iso);
    return p.wd + ' ' + p.mon + ' ' + p.day;
  }

  function weekLabel(monday) {
    var dates = weekDates(monday);
    var a = parts(dates[0]);
    var b = parts(dates[6]);
    return a.wd + ' ' + a.mon + ' ' + a.day + ' – ' + b.wd + ' ' + b.mon + ' ' + b.day + ', ' + b.year;
  }

  function formatTime(hhmm) {
    var n = normTime(hhmm);
    if (!n) return '';
    var bits = n.split(':');
    var hr = parseInt(bits[0], 10);
    var ap = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12;
    if (hr === 0) hr = 12;
    return hr + ':' + bits[1] + ' ' + ap;
  }

  function formatRange(start, end) {
    if (!normTime(start) && !normTime(end)) return '';
    var endLabel = normTime(end) === '00:00' ? 'midnight' : formatTime(end);
    return formatTime(start) + ' – ' + endLabel;
  }

  function toMinutes(t) {
    var n = normTime(t);
    if (!n) return null;
    var bits = n.split(':');
    var hh = parseInt(bits[0], 10);
    var mm = parseInt(bits[1], 10);
    if (hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function rangeOf(date, start, end) {
    var a = toMinutes(start);
    var b = toMinutes(end);
    if (a == null || b == null || a === b) return null;
    var bits = String(date).split('-').map(Number);
    var s = Date.UTC(bits[0], bits[1] - 1, bits[2], 0, a);
    var e = Date.UTC(bits[0], bits[1] - 1, bits[2], 0, b < a ? b + 1440 : b);
    return { start: s, end: e };
  }

  function durationHours(start, end) {
    var r = rangeOf('2000-01-01', start, end);
    if (!r) return 0;
    return (r.end - r.start) / 3600000;
  }

  function fmtHours(n) {
    var r = Math.round(Number(n) * 10) / 10;
    if (Math.abs(r - Math.round(r)) < 0.05) return String(Math.round(r));
    return r.toFixed(1);
  }

  function roundHours(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function slotKey(store, date, shift) {
    return encodeURIComponent(store) + '|' + date + '|' + encodeURIComponent(shift);
  }

  function parseSlotKey(key) {
    var bits = String(key).split('|');
    return {
      store: decodeURIComponent(bits[0] || ''),
      date: bits[1] || '',
      shift: decodeURIComponent(bits.slice(2).join('|'))
    };
  }

  function isOnCall(kind) {
    return /on[-\s]?call/i.test(String(kind || ''));
  }

  function normalizeStaff(rows) {
    return (rows || []).map(function (r) {
      return {
        name: String(r.name || '').trim(),
        role: /manager/i.test(r.role || '') ? 'manager' : 'cashier',
        home_store: String(r.home_store || r.homeStore || '').trim(),
        phone: String(r.phone || '').trim(),
        active: /^(no|false|0|inactive)$/i.test(String(r.active == null ? 'Yes' : r.active)) ? 'No' : 'Yes'
      };
    }).filter(function (r) { return r.name; });
  }

  function cashierNames(staff, current) {
    var names = [];
    normalizeStaff(staff).forEach(function (s) {
      if ((s.active === 'No' || s.role === 'manager') && s.name !== current) return;
      if (names.indexOf(s.name) === -1) names.push(s.name);
    });
    if (current && names.indexOf(current) === -1) names.push(current);
    return names;
  }

  function blankManager() {
    return { start: '', end: '', notes: '', onStart: '', onEnd: '' };
  }

  function defaultManagerName(staff) {
    var found = (staff || []).filter(function (s) { return s.role === 'manager' && s.active !== 'No' && s.name; })[0];
    return found ? found.name : STORE_MANAGER.name;
  }

  function blankState(weekStart, staff, stores) {
    var state = {
      weekStart: mondayOf(weekStart),
      staff: normalizeStaff(staff),
      stores: stores == null ? SHIFT_STORES : stores,
      slots: {},
      manager: {},
      managerName: '',
      dirty: false
    };
    weekDates(state.weekStart).forEach(function (date) { state.manager[date] = blankManager(); });
    state.managerName = defaultManagerName(state.staff);
    return state;
  }

  function templateShift(state, storeName, shiftName) {
    var store = (state.stores || []).filter(function (s) { return s.name === storeName; })[0];
    if (!store) return null;
    return store.shifts.filter(function (sh) { return sh.name === shiftName; })[0] || null;
  }

  function extraShiftDefs(state, storeName) {
    var store = (state.stores || []).filter(function (s) { return s.name === storeName; })[0];
    var known = {};
    ((store && store.shifts) || []).forEach(function (sh) { known[sh.name] = true; });
    var map = {};
    Object.keys(state.slots).forEach(function (key) {
      var p = parseSlotKey(key);
      if (p.store !== storeName || known[p.shift]) return;
      if (!map[p.shift]) {
        var slot = state.slots[key];
        map[p.shift] = { name: p.shift, start: slot.start || '', end: slot.end || '' };
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function hydrate(weekStart, staffRows, shiftRows, managerRows, stores) {
    var staff = normalizeStaff(staffRows);
    if (!staff.length) {
      staff = [{ name: STORE_MANAGER.name, role: 'manager', home_store: 'Both', phone: '', active: 'Yes' }];
    }
    var state = blankState(weekStart, staff, stores);
    var allowed = {};
    weekDates(state.weekStart).forEach(function (d) { allowed[d] = true; });
    (shiftRows || []).forEach(function (r) {
      var date = normDate(r.date);
      var store = String(r.store || '').trim();
      var shift = String(r.shift_name || r.shift || '').trim();
      if (!allowed[date] || !store || !shift) return;
      var tmpl = templateShift(state, store, shift);
      state.slots[slotKey(store, date, shift)] = {
        employee: String(r.employee || '').trim(),
        notes: String(r.notes || '').trim(),
        start: normTime(r.start) || (tmpl ? tmpl.start : ''),
        end: normTime(r.end) || (tmpl ? tmpl.end : '')
      };
    });
    var dayNames = [];
    (managerRows || []).forEach(function (r) {
      var date = normDate(r.date);
      if (!state.manager[date]) return;
      var m = state.manager[date];
      if (isOnCall(r.kind)) {
        m.onStart = normTime(r.start);
        m.onEnd = normTime(r.end);
      } else {
        m.start = normTime(r.start);
        m.end = normTime(r.end);
        m.notes = String(r.notes || '').trim();
        if (String(r.employee || '').trim()) dayNames.push(String(r.employee).trim());
      }
    });
    if (dayNames.length) {
      var counts = {};
      dayNames.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
      state.managerName = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    }
    return state;
  }

  function serialize(state) {
    var dates = weekDates(state.weekStart);
    var shifts = [];
    var seen = {};
    (state.stores || []).forEach(function (store) {
      store.shifts.forEach(function (sh) {
        dates.forEach(function (date) {
          var key = slotKey(store.name, date, sh.name);
          seen[key] = true;
          var slot = state.slots[key] || {};
          shifts.push({
            week_start: state.weekStart,
            date: date,
            store: store.name,
            shift_name: sh.name,
            start: normTime(slot.start) || sh.start,
            end: normTime(slot.end) || sh.end,
            employee: String(slot.employee || '').trim(),
            notes: String(slot.notes || '').trim()
          });
        });
      });
    });
    Object.keys(state.slots).forEach(function (key) {
      if (seen[key]) return;
      var p = parseSlotKey(key);
      if (dates.indexOf(p.date) === -1) return;
      var slot = state.slots[key];
      shifts.push({
        week_start: state.weekStart,
        date: p.date,
        store: p.store,
        shift_name: p.shift,
        start: normTime(slot.start),
        end: normTime(slot.end),
        employee: String(slot.employee || '').trim(),
        notes: String(slot.notes || '').trim()
      });
    });
    var who = (state.managerName || '').trim() || STORE_MANAGER.name;
    var manager = [];
    dates.forEach(function (date) {
      var m = state.manager[date] || blankManager();
      if (m.start || m.end || m.notes) {
        manager.push({
          week_start: state.weekStart,
          date: date,
          employee: who,
          start: normTime(m.start),
          end: normTime(m.end),
          notes: String(m.notes || '').trim(),
          kind: 'day'
        });
      }
      if (m.onStart || m.onEnd) {
        manager.push({
          week_start: state.weekStart,
          date: date,
          employee: who,
          start: normTime(m.onStart),
          end: normTime(m.onEnd),
          notes: '',
          kind: 'oncall'
        });
      }
    });
    return { week_start: state.weekStart, staff: normalizeStaff(state.staff), shifts: shifts, manager: manager };
  }

  function hoursMessage(name, hours, role) {
    var base = name + ' is scheduled ' + fmtHours(hours) + ' hours. Warning over 40.';
    if (role === 'manager') return base;
    return base + ' Cashiers are targeted at 35–40.';
  }

  function analyze(state, opts) {
    opts = opts || {};
    var flags = [];
    var dates = weekDates(state.weekStart);
    if (!opts.skipEmpty) {
      (state.stores || []).forEach(function (store) {
        store.shifts.concat(extraShiftDefs(state, store.name)).forEach(function (sh) {
          dates.forEach(function (date) {
            var key = slotKey(store.name, date, sh.name);
            var slot = state.slots[key];
            if (!slot || !String(slot.employee || '').trim()) {
              flags.push({
                type: 'empty',
                level: 'warn',
                keys: [key],
                message: 'Open shift: ' + store.name + ' · ' + shortDate(date) + ' · ' + sh.name + '.'
              });
            }
          });
        });
      });
    }
    var dup = {};
    (state.staff || []).forEach(function (s) {
      var k = s.name.trim().toLowerCase();
      if (!k) return;
      if (!dup[k]) dup[k] = { name: s.name, n: 0 };
      dup[k].n += 1;
    });
    Object.keys(dup).forEach(function (k) {
      if (dup[k].n > 1) {
        flags.push({
          type: 'duplicate',
          level: 'warn',
          keys: [],
          message: 'Staff list has ' + dup[k].n + ' people named ' + dup[k].name + '.'
        });
      }
    });

    var work = [];
    function pushShift(storeName, date, shName, start, end, employee, key) {
      if (!employee) return;
      var range = rangeOf(date, start, end);
      if (!range) return;
      work.push({
        employee: employee,
        store: storeName,
        label: shName,
        date: date,
        start: start,
        end: end,
        key: key,
        kind: 'shift',
        range: range,
        hours: (range.end - range.start) / 3600000
      });
    }
    (state.stores || []).forEach(function (store) {
      store.shifts.concat(extraShiftDefs(state, store.name)).forEach(function (sh) {
        dates.forEach(function (date) {
          var key = slotKey(store.name, date, sh.name);
          var slot = state.slots[key] || {};
          pushShift(store.name, date, sh.name, normTime(slot.start) || sh.start, normTime(slot.end) || sh.end, String(slot.employee || '').trim(), key);
        });
      });
    });

    var who = (state.managerName || '').trim() || STORE_MANAGER.name;
    dates.forEach(function (date) {
      var m = state.manager[date] || blankManager();
      var start = normTime(m.start);
      var end = normTime(m.end);
      if ((start && !end) || (!start && end) || (start && start === end)) {
        flags.push({
          type: 'manager',
          level: 'warn',
          keys: ['mgr|' + date],
          message: 'Manager hours on ' + shortDate(date) + ' need a start and an end.'
        });
      }
      var onS = normTime(m.onStart);
      var onE = normTime(m.onEnd);
      if ((onS && !onE) || (!onS && onE) || (onS && onS === onE)) {
        flags.push({
          type: 'manager',
          level: 'warn',
          keys: ['mgr|' + date],
          message: 'On call on ' + shortDate(date) + ' needs a from and a to.'
        });
      }
      var range = rangeOf(date, start, end);
      if (range && who) {
        work.push({
          employee: who,
          store: 'Manager schedule',
          label: 'Manager',
          date: date,
          start: start,
          end: end,
          key: 'mgr|' + date,
          kind: 'manager',
          range: range,
          hours: (range.end - range.start) / 3600000
        });
      }
    });

    var byEmp = {};
    work.forEach(function (w) {
      if (!byEmp[w.employee]) byEmp[w.employee] = [];
      byEmp[w.employee].push(w);
    });
    Object.keys(byEmp).forEach(function (name) {
      var list = byEmp[name].slice().sort(function (a, b) { return a.range.start - b.range.start; });
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          if (list[j].range.start >= list[i].range.end) break;
          var sameDay = list[i].date === list[j].date;
          flags.push({
            type: 'overlap',
            level: 'warn',
            keys: [list[i].key, list[j].key],
            message: 'Overlap: ' + name + ' is on ' + list[i].store + ' ' + list[i].label + ' and ' + list[j].store + ' ' + list[j].label +
              (sameDay ? ' on ' + shortDate(list[i].date) : ' (' + shortDate(list[i].date) + ' into ' + shortDate(list[j].date) + ')') + '.'
          });
        }
        if (i + 1 < list.length) {
          var gap = list[i + 1].range.start - list[i].range.end;
          if (gap >= 0 && gap < MIN_REST_HOURS * 3600000) {
            flags.push({
              type: 'rest',
              level: 'warn',
              keys: [list[i].key, list[i + 1].key],
              message: 'Rest: ' + name + ' has ' + fmtHours(gap / 3600000) + ' hours between ' + list[i].store + ' ' + list[i].label +
                ' (' + shortDate(list[i].date) + ') and ' + list[i + 1].store + ' ' + list[i + 1].label + ' (' + shortDate(list[i + 1].date) + '). Minimum rest is 8 hours.'
            });
          }
        }
      }
    });

    function roleOf(name) {
      var s = (state.staff || []).filter(function (x) { return x.name.trim().toLowerCase() === String(name).trim().toLowerCase(); })[0];
      if (s) return s.role;
      if (who && String(name).trim().toLowerCase() === who.toLowerCase()) return 'manager';
      return 'cashier';
    }
    var byPerson = {};
    work.forEach(function (w) {
      if (!byPerson[w.employee]) byPerson[w.employee] = { hours: 0, oncall: 0, role: roleOf(w.employee), status: 'ok' };
      byPerson[w.employee].hours += w.hours;
    });
    var oncallHours = 0;
    dates.forEach(function (date) {
      var m = state.manager[date] || blankManager();
      var hrs = durationHours(m.onStart, m.onEnd);
      if (!hrs || !who) return;
      oncallHours += hrs;
      if (!byPerson[who]) byPerson[who] = { hours: 0, oncall: 0, role: 'manager', status: 'ok' };
      byPerson[who].oncall += hrs;
    });
    Object.keys(byPerson).forEach(function (name) {
      var p = byPerson[name];
      p.hours = roundHours(p.hours);
      p.oncall = roundHours(p.oncall);
      if (p.hours > HOUR_TARGET_MAX) {
        p.status = 'over';
        flags.push({ type: 'hours', level: 'warn', keys: [], person: name, message: hoursMessage(name, p.hours, p.role) });
      } else if (p.role !== 'manager' && p.hours > 0 && p.hours < HOUR_TARGET_MIN) {
        p.status = 'under';
      } else {
        p.status = 'ok';
      }
    });

    var byStore = {};
    (state.stores || []).forEach(function (s) { byStore[s.name] = 0; });
    work.forEach(function (w) {
      if (w.kind !== 'shift') return;
      byStore[w.store] = roundHours((byStore[w.store] || 0) + w.hours);
    });
    var managerHours = roundHours(work.filter(function (w) { return w.kind === 'manager'; }).reduce(function (a, w) { return a + w.hours; }, 0));
    var storeSum = Object.keys(byStore).reduce(function (a, k) { return a + byStore[k]; }, 0);
    return {
      flags: flags,
      byPerson: byPerson,
      byStore: byStore,
      managerHours: managerHours,
      oncallHours: roundHours(oncallHours),
      laborHours: roundHours(storeSum + managerHours)
    };
  }

  function projectEmployee(pack, name) {
    var n = String(name || '').trim().toLowerCase();
    return {
      shifts: (pack.shifts || []).filter(function (s) { return n && String(s.employee || '').trim().toLowerCase() === n; }),
      manager: (pack.manager || []).filter(function (m) { return n && String(m.employee || '').trim().toLowerCase() === n; })
    };
  }

  function canon(pack) {
    var shifts = (pack.shifts || []).map(function (s) {
      return [normDate(s.date), String(s.store || '').trim(), String(s.shift_name || s.shift || '').trim(), normTime(s.start), normTime(s.end), String(s.employee || '').trim(), String(s.notes || '').trim()].join('\u001f');
    }).sort();
    var manager = (pack.manager || []).map(function (m) {
      return [normDate(m.date), String(m.employee || '').trim(), normTime(m.start), normTime(m.end), String(m.notes || '').trim(), isOnCall(m.kind) ? 'oncall' : 'day'].join('\u001f');
    }).sort();
    var staff = normalizeStaff(pack.staff || []).map(function (s) {
      return [s.name, s.role, s.home_store, normPhone(s.phone), s.active].join('\u001f');
    }).sort();
    return JSON.stringify({ shifts: shifts, manager: manager, staff: staff });
  }

  function packsMatch(a, b) {
    return canon(a) === canon(b);
  }

  function remapWeek(pack, toWeek) {
    var to = mondayOf(toWeek);
    var from = pack.week_start ? mondayOf(pack.week_start) : '';
    if (!from && pack.shifts && pack.shifts[0] && pack.shifts[0].date) from = mondayOf(pack.shifts[0].date);
    var delta = from ? daysBetween(from, to) : 7;
    function shiftDate(iso) { return addDays(normDate(iso), delta); }
    return {
      week_start: to,
      shifts: (pack.shifts || []).map(function (r) { return Object.assign({}, r, { date: shiftDate(r.date), week_start: to }); }),
      manager: (pack.manager || []).map(function (r) { return Object.assign({}, r, { date: shiftDate(r.date), week_start: to }); })
    };
  }

  function memorySave(db, payload) {
    db.staff = normalizeStaff(payload.staff);
    db.weeks[payload.week_start] = {
      shifts: (payload.shifts || []).map(function (s) { return Object.assign({}, s); }),
      manager: (payload.manager || []).map(function (m) { return Object.assign({}, m); })
    };
    return {
      ok: true,
      schedule: 1,
      week_start: payload.week_start,
      staff: db.staff,
      shifts: db.weeks[payload.week_start].shifts,
      manager: db.weeks[payload.week_start].manager
    };
  }

  function demoStaff() {
    return [
      ['Jonathan Cowan', 'manager', 'Both', ''],
      ['Maria Alvarez', 'cashier', 'Thomasville Chevron', '555-0101'],
      ['James Patel', 'cashier', 'Thomasville Chevron', '555-0102'],
      ['Priya Shah', 'cashier', 'Thomasville Chevron', '555-0103'],
      ['Elena Cruz', 'cashier', 'Thomasville Chevron', '555-0104'],
      ['Noah Bennett', 'cashier', 'Thomasville Chevron', '555-0105'],
      ['Aisha Brooks', 'cashier', 'Thomasville OutRun', '555-0106'],
      ['Luis Romero', 'cashier', 'Thomasville OutRun', '555-0107'],
      ['Hannah Cole', 'cashier', 'Thomasville OutRun', '555-0108'],
      ['Chris Nguyen', 'cashier', 'Thomasville OutRun', '555-0109']
    ].map(function (r) {
      return { name: r[0], role: r[1], home_store: r[2], phone: r[3], active: 'Yes' };
    });
  }

  function demoState(weekStart) {
    var assign = {
      'Thomasville Chevron': {
        Morning: ['Maria Alvarez', 'Maria Alvarez', 'Maria Alvarez', 'Maria Alvarez', 'Maria Alvarez', 'Noah Bennett', 'Elena Cruz'],
        Afternoon: ['James Patel', 'James Patel', 'James Patel', 'James Patel', 'James Patel', 'Elena Cruz', 'Hannah Cole'],
        Overnight: ['Priya Shah', 'Priya Shah', 'Priya Shah', 'Priya Shah', 'Noah Bennett', 'Noah Bennett', 'Noah Bennett']
      },
      'Thomasville OutRun': {
        Morning: ['Aisha Brooks', 'Aisha Brooks', 'Aisha Brooks', 'Aisha Brooks', 'Aisha Brooks', 'Luis Romero', 'Luis Romero'],
        Evening: ['Luis Romero', 'Luis Romero', 'Hannah Cole', 'Hannah Cole', 'James Patel', 'Chris Nguyen', '']
      }
    };
    var state = blankState(weekStart, demoStaff());
    var dates = weekDates(state.weekStart);
    state.stores.forEach(function (store) {
      var grid = assign[store.name] || {};
      store.shifts.forEach(function (sh) {
        var row = grid[sh.name] || [];
        dates.forEach(function (date, i) {
          if (!row.length) return;
          var employee = row[i] || '';
          var notes = (store.name === 'Thomasville Chevron' && sh.name === 'Morning' && i === 0 && employee) ? 'Opens' : '';
          state.slots[slotKey(store.name, date, sh.name)] = { employee: employee, notes: notes, start: sh.start, end: sh.end };
        });
      });
    });
    var notes = ['Orders and floor', '', 'Vendor deliveries', '', 'Payroll prep', '', ''];
    dates.forEach(function (date, i) {
      var m = blankManager();
      if (i < 5) { m.start = '08:00'; m.end = '16:00'; m.notes = notes[i]; }
      if (i === 5) { m.onStart = '10:00'; m.onEnd = '14:00'; }
      state.manager[date] = m;
    });
    state.managerName = STORE_MANAGER.name;
    return state;
  }

  function demoWeek(weekStart) {
    var pack = serialize(demoState(weekStart));
    return { shifts: pack.shifts, manager: pack.manager };
  }

  function seedDb(anchor) {
    var week = mondayOf(anchor || todayISO());
    var prev = addDays(week, -7);
    var weeks = {};
    weeks[week] = demoWeek(week);
    weeks[prev] = demoWeek(prev);
    return { staff: demoStaff(), weeks: weeks };
  }

  function readDb() {
    try {
      var raw = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (raw && Array.isArray(raw.staff) && raw.weeks && typeof raw.weeks === 'object') return raw;
    } catch (e) { /* empty */ }
    return { staff: [], weeks: {} };
  }

  function writeDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function storeChoices() {
    var base = (typeof STORES !== 'undefined' && STORES && STORES.length) ? STORES.slice() : SHIFT_STORES.map(function (s) { return s.name; });
    if (base.indexOf('Both') === -1) base.push('Both');
    return base;
  }

  function showBanner(text, handlers) {
    var b = document.getElementById('modeBanner');
    if (!b) return;
    b.classList.remove('hidden');
    b.innerHTML = '<p>' + h(text) + '</p><div class="action-row">' +
      '<button type="button" class="mini" id="useLive">Use the live sheet</button>' +
      (handlers && handlers.reset ? '<button type="button" class="mini" id="resetDemo">Reset sample week</button>' : '') +
      '</div>';
    var live = document.getElementById('useLive');
    if (live && handlers && handlers.live) live.addEventListener('click', handlers.live);
    var reset = document.getElementById('resetDemo');
    if (reset && handlers && handlers.reset) reset.addEventListener('click', handlers.reset);
  }

  function hideBanner() {
    var b = document.getElementById('modeBanner');
    if (b) b.classList.add('hidden');
  }

  function toast(msg, fail) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('fail', !!fail);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 4200);
  }

  function callJsonp(params) {
    if (typeof jsonp !== 'function') return Promise.reject(new Error('Backend helper missing'));
    return jsonp(params);
  }

  function pinValue() {
    try { return localStorage.getItem('vm_pin') || ''; } catch (e) { return ''; }
  }

  function postJson(data) {
    if (typeof WEB_APP_URL !== 'string' || !/^https:\/\/script\.google\.com\//.test(WEB_APP_URL)) {
      return Promise.reject(new Error('WEB_APP_URL is not set'));
    }
    return fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
  }

  function personalFlags(name, shifts, managerRows, week) {
    var storesMap = {};
    (shifts || []).forEach(function (s) {
      if (!s.store || !s.shift_name) return;
      if (!storesMap[s.store]) storesMap[s.store] = { name: s.store, blurb: '', shifts: [] };
      if (!storesMap[s.store].shifts.some(function (x) { return x.name === s.shift_name; })) {
        storesMap[s.store].shifts.push({ name: s.shift_name, start: normTime(s.start), end: normTime(s.end) });
      }
    });
    var stores = Object.keys(storesMap).map(function (k) { return storesMap[k]; });
    var role = (shifts || []).length ? 'cashier' : 'manager';
    var state = blankState(week, [{ name: name, role: role, home_store: '', phone: '', active: 'Yes' }], stores);
    state.managerName = name;
    (shifts || []).forEach(function (s) {
      var date = normDate(s.date);
      if (weekDates(state.weekStart).indexOf(date) === -1) return;
      state.slots[slotKey(s.store, date, s.shift_name)] = {
        employee: name,
        notes: s.notes || '',
        start: normTime(s.start),
        end: normTime(s.end)
      };
    });
    (managerRows || []).forEach(function (r) {
      var date = normDate(r.date);
      if (!state.manager[date]) return;
      if (isOnCall(r.kind)) {
        state.manager[date].onStart = normTime(r.start);
        state.manager[date].onEnd = normTime(r.end);
      } else {
        state.manager[date].start = normTime(r.start);
        state.manager[date].end = normTime(r.end);
        state.manager[date].notes = r.notes || '';
      }
    });
    return analyze(state, { skipEmpty: true }).flags.filter(function (f) {
      return f.level === 'warn' && f.type !== 'empty' && f.type !== 'duplicate';
    });
  }

  function mountEditor() {
    var demo = false;
    var db = { staff: [], weeks: {} };
    var state = blankState(todayISO(), []);
    var staffMounted = false;

    function viewQuery(name) {
      var q = new URLSearchParams();
      if (name) q.set('name', name);
      q.set('week', state.weekStart);
      if (demo) q.set('demo', '1');
      var s = q.toString();
      return s ? '?' + s : '';
    }

    function renderChrome() {
      var label = weekLabel(state.weekStart);
      var weekLabelEl = document.getElementById('weekLabel');
      if (weekLabelEl) weekLabelEl.textContent = label;
      var weekDate = document.getElementById('weekDate');
      if (weekDate) weekDate.value = state.weekStart;
      var hero = document.getElementById('heroSub');
      if (hero) hero.textContent = label + ' · Thomasville Chevron and Thomasville OutRun';
      var dirty = document.getElementById('dirtyTag');
      if (dirty) dirty.textContent = state.dirty ? 'Unsaved changes' : '';
      var view = document.getElementById('viewLink');
      if (view) view.href = 'schedule_view.html' + viewQuery('');
      if (typeof history !== 'undefined' && history.replaceState) {
        var u = new URL(location.href);
        u.searchParams.set('week', state.weekStart);
        if (demo) u.searchParams.set('demo', '1');
        else u.searchParams.delete('demo');
        history.replaceState(null, '', u.pathname + u.search);
      }
    }

    function optionsHtml(current) {
      var cur = String(current || '');
      var html = '<option value="">Open</option>';
      var groups = {};
      state.staff.forEach(function (s) {
        if (!s.name) return;
        if ((s.active === 'No' || s.role === 'manager') && s.name !== cur) return;
        var g = s.home_store || 'Staff';
        if (!groups[g]) groups[g] = [];
        if (groups[g].indexOf(s.name) === -1) groups[g].push(s.name);
      });
      var known = Object.keys(groups).some(function (g) { return groups[g].indexOf(cur) !== -1; });
      if (cur && !known) {
        groups.Assigned = groups.Assigned || [];
        groups.Assigned.push(cur);
      }
      Object.keys(groups).forEach(function (g) {
        html += '<optgroup label="' + h(g) + '">';
        groups[g].forEach(function (n) {
          html += '<option' + (n === cur ? ' selected' : '') + '>' + h(n) + '</option>';
        });
        html += '</optgroup>';
      });
      return html;
    }

    function refreshOptions() {
      document.querySelectorAll('select.slot-emp').forEach(function (sel) {
        var cur = sel.value;
        sel.innerHTML = optionsHtml(cur);
        sel.value = cur;
      });
    }

    function shiftBlock(store, date, name, start, end) {
      var key = slotKey(store, date, name);
      var slot = state.slots[key] || { employee: '', notes: '', start: start, end: end };
      var range = formatRange(slot.start || start, slot.end || end);
      return '<div class="shift" data-key="' + h(key) + '">' +
        '<div class="shift-name">' + h(name) + ' <small>' + h(range) + '</small></div>' +
        '<select class="slot-emp" aria-label="' + h(name + ', ' + shortDate(date) + ', ' + store) + '" data-store="' + h(store) + '" data-date="' + h(date) + '" data-shift="' + h(name) + '">' +
        optionsHtml(slot.employee) + '</select>' +
        '<input class="slot-note' + (slot.notes ? ' has-note' : '') + '" type="text" placeholder="Note" aria-label="Note for ' + h(name) + '" data-store="' + h(store) + '" data-date="' + h(date) + '" data-shift="' + h(name) + '" value="' + h(slot.notes || '') + '">' +
        '</div>';
    }

    function renderGrids() {
      var dates = weekDates(state.weekStart);
      document.getElementById('grids').innerHTML = state.stores.map(function (store) {
        var days = dates.map(function (date) {
          var blocks = store.shifts.map(function (sh) {
            return shiftBlock(store.name, date, sh.name, sh.start, sh.end);
          }).join('');
          extraShiftDefs(state, store.name).forEach(function (sh) {
            blocks += shiftBlock(store.name, date, sh.name, sh.start, sh.end);
          });
          var p = parts(date);
          return '<article class="day-card"><h3>' + h(p.wd) + ' <span>' + h(p.mon + ' ' + p.day) + '</span></h3>' + blocks + '</article>';
        }).join('');
        return '<section class="card store-card screen-only"><h2><span class="dot"></span>' + h(store.name) +
          ' <small>' + h(store.blurb || '') + '</small> <span class="hours-pill" data-store-total="' + h(store.name) + '"></span></h2>' +
          '<p class="swipe-hint">One cashier per shift. Scroll the days if your screen is narrow.</p>' +
          '<div class="day-grid">' + days + '</div></section>';
      }).join('');
    }

    function timeField(label, date, field, value) {
      return '<div><label>' + h(label) + '</label><input type="time" data-date="' + h(date) + '" data-field="' + field + '" value="' + h(value || '') + '"></div>';
    }

    function renderManager() {
      document.getElementById('managerName').value = state.managerName || '';
      var dates = weekDates(state.weekStart);
      document.getElementById('managerGrid').innerHTML = '<div class="mgr-days">' + dates.map(function (date) {
        var m = state.manager[date] || blankManager();
        var p = parts(date);
        return '<article class="mgr-day" data-key="mgr|' + h(date) + '"><h3>' + h(p.wd) + ' <span>' + h(p.mon + ' ' + p.day) + '</span></h3>' +
          '<div class="grid">' + timeField('From', date, 'start', m.start) + timeField('To', date, 'end', m.end) + '</div>' +
          '<label>Notes</label><input type="text" data-date="' + h(date) + '" data-field="notes" value="' + h(m.notes || '') + '" placeholder="Notes">' +
          '<div class="grid">' + timeField('On call from', date, 'onStart', m.onStart) + timeField('On call to', date, 'onEnd', m.onEnd) + '</div></article>';
      }).join('') + '</div>';
    }

    function syncStaffFromDom(keepBlank) {
      if (!staffMounted) return state.staff;
      var rows = Array.prototype.slice.call(document.querySelectorAll('#staffList .staff-row'));
      state.staff = rows.map(function (row) {
        return {
          name: row.querySelector('[data-f="name"]').value.trim(),
          role: row.querySelector('[data-f="role"]').value,
          home_store: row.querySelector('[data-f="home_store"]').value,
          phone: row.querySelector('[data-f="phone"]').value.trim(),
          active: row.querySelector('[data-f="active"]').checked ? 'Yes' : 'No'
        };
      }).filter(function (s) { return keepBlank || s.name; });
      return state.staff;
    }

    function renderStaff() {
      var choices = storeChoices();
      document.getElementById('staffList').innerHTML = state.staff.map(function (s) {
        var stores = choices.map(function (name) {
          return '<option' + (name === s.home_store ? ' selected' : '') + '>' + h(name) + '</option>';
        }).join('');
        if (s.home_store && choices.indexOf(s.home_store) === -1) {
          stores = '<option selected>' + h(s.home_store) + '</option>' + stores;
        }
        return '<div class="staff-row">' +
          '<input type="text" data-f="name" value="' + h(s.name) + '" placeholder="Name" aria-label="Name">' +
          '<select data-f="role" aria-label="Role"><option value="cashier"' + (s.role !== 'manager' ? ' selected' : '') + '>Cashier</option><option value="manager"' + (s.role === 'manager' ? ' selected' : '') + '>Manager</option></select>' +
          '<select data-f="home_store" aria-label="Home store">' + stores + '</select>' +
          '<input type="tel" data-f="phone" value="' + h(s.phone) + '" placeholder="Phone" aria-label="Phone">' +
          '<label class="mini-check"><input type="checkbox" data-f="active"' + (s.active !== 'No' ? ' checked' : '') + '> Active</label>' +
          '<button type="button" class="mini" data-remove>Remove</button></div>';
      }).join('');
      staffMounted = true;
    }

    function renderFlags(report) {
      var warns = report.flags.filter(function (f) { return f.level === 'warn'; });
      var count = document.getElementById('flagCount');
      count.textContent = warns.length ? String(warns.length) : 'Clear';
      count.className = 'badge ' + (warns.length ? 'warn' : 'ok');
      var box = document.getElementById('flags');
      if (!warns.length) {
        box.innerHTML = '<div class="note ok">All clear. No open shifts, overlaps, short rest, or weeks over 40 hours.</div>';
        return;
      }
      box.innerHTML = '<ul class="flag-list">' + warns.map(function (f) {
        return '<li class="flag-warn">' + h(f.message) + '</li>';
      }).join('') + '</ul>';
    }

    function renderTotals(report) {
      var stats = state.stores.map(function (s) {
        var hrs = report.byStore[s.name] || 0;
        return '<div class="stat"><b>' + h(String(s.name).replace('Thomasville ', '')) + '</b><div class="v">' + fmtHours(hrs) + 'h</div><small>Cashier labor</small></div>';
      }).join('');
      stats += '<div class="stat"><b>Manager</b><div class="v">' + fmtHours(report.managerHours) + 'h</div><small>Not tied to a store</small></div>' +
        '<div class="stat"><b>On call</b><div class="v">' + fmtHours(report.oncallHours) + 'h</div><small>Not in labor hours</small></div>' +
        '<div class="stat"><b>Scheduled labor</b><div class="v">' + fmtHours(report.laborHours) + 'h</div><small>Stores plus manager</small></div>';
      var people = Object.keys(report.byPerson).filter(function (n) {
        return report.byPerson[n].hours || report.byPerson[n].oncall;
      }).sort(function (a, b) {
        return report.byPerson[b].hours - report.byPerson[a].hours || a.localeCompare(b);
      });
      var rows = people.map(function (n) {
        var p = report.byPerson[n];
        var tag = p.status === 'over' ? 'Over 40' : p.status === 'under' ? 'Under target' : p.role === 'manager' ? 'Manager' : 'On target';
        var on = p.oncall ? ' <span class="muted">+' + fmtHours(p.oncall) + 'h on call</span>' : '';
        return '<tr><td><a href="schedule_view.html' + viewQuery(n) + '">' + h(n) + '</a></td><td class="num' + (p.status === 'over' ? ' warn' : '') + '">' + fmtHours(p.hours) + 'h' + on + '</td><td>' + h(tag) + '</td></tr>';
      }).join('');
      document.getElementById('totals').innerHTML = '<div class="stats">' + stats + '</div>' +
        (rows ? '<div class="tblwrap"><table><thead><tr><th>Person</th><th class="num">Hours</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">No one is scheduled yet.</p>') +
        '<p class="hint">Cashier target is 35–40 hours. Over 40 is a warning. On call is listed and is not part of scheduled labor.</p>';
      document.querySelectorAll('[data-store-total]').forEach(function (node) {
        node.textContent = fmtHours(report.byStore[node.getAttribute('data-store-total')] || 0) + 'h';
      });
    }

    function renderPrint(report) {
      var dates = weekDates(state.weekStart);
      var head = '<tr><th>Shift</th>' + dates.map(function (d) { return '<th>' + h(shortDate(d)) + '</th>'; }).join('') + '</tr>';
      var stores = state.stores.map(function (store) {
        var names = store.shifts.map(function (s) { return s; }).concat(extraShiftDefs(state, store.name));
        var body = names.map(function (sh) {
          var cells = dates.map(function (date) {
            var slot = state.slots[slotKey(store.name, date, sh.name)] || {};
            var who = slot.employee ? h(slot.employee) : '<span class="open">Open</span>';
            var note = slot.notes ? '<br><span class="pnote">' + h(slot.notes) + '</span>' : '';
            return '<td>' + who + note + '</td>';
          }).join('');
          return '<tr><th>' + h(sh.name) + '<br><span class="pnote">' + h(formatRange(sh.start, sh.end)) + '</span></th>' + cells + '</tr>';
        }).join('');
        return '<h2>' + h(store.name) + ' · ' + fmtHours(report.byStore[store.name] || 0) + 'h</h2><table class="print-grid">' + head + body + '</table>';
      }).join('');
      var mgrBody = dates.map(function (date) {
        var m = state.manager[date] || blankManager();
        var on = (m.onStart || m.onEnd) ? h(formatRange(m.onStart, m.onEnd)) : '';
        return '<tr><td>' + h(shortDate(date)) + '</td><td>' + h(formatTime(m.start)) + '</td><td>' + h(formatTime(m.end)) + '</td><td>' + h(m.notes || '') + '</td><td>' + on + '</td></tr>';
      }).join('');
      var warns = report.flags.filter(function (f) { return f.level === 'warn'; });
      var flagHtml = warns.length ? '<ul class="flag-list">' + warns.map(function (f) { return '<li>' + h(f.message) + '</li>'; }).join('') + '</ul>' : '<p>All clear.</p>';
      document.getElementById('printSheet').innerHTML =
        '<h2>Checks</h2>' + flagHtml +
        '<h2>Hours</h2><p>Scheduled labor ' + fmtHours(report.laborHours) + ' hours. On call ' + fmtHours(report.oncallHours) + ' hours, not included in labor.</p>' +
        stores +
        '<h2>Manager schedule · ' + h(state.managerName || STORE_MANAGER.name) + '</h2>' +
        '<table class="print-grid"><tr><th>Day</th><th>From</th><th>To</th><th>Notes</th><th>On call</th></tr>' + mgrBody + '</table>';
    }

    function paintSlots(report) {
      document.querySelectorAll('[data-key]').forEach(function (node) {
        node.classList.remove('slot-empty', 'slot-bad');
      });
      report.flags.forEach(function (f) {
        if (f.level !== 'warn' || !f.keys || !f.keys.length) return;
        if (f.type === 'hours' || f.type === 'duplicate') return;
        var cls = f.type === 'empty' ? 'slot-empty' : 'slot-bad';
        f.keys.forEach(function (k) {
          var sel = '[data-key="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]';
          document.querySelectorAll(sel).forEach(function (node) { node.classList.add(cls); });
        });
      });
    }

    function paint() {
      var report = analyze(state);
      renderFlags(report);
      renderTotals(report);
      paintSlots(report);
      renderPrint(report);
      var lede = document.getElementById('managerLede');
      var who = state.managerName || STORE_MANAGER.name;
      if (lede) lede.textContent = who + ', ' + STORE_MANAGER.title.toLowerCase() + '. This block is separate from the cashier grid. Set a from and to for each day. On call is optional and is not a cashier shift.';
      renderChrome();
    }

    function renderAll() {
      renderGrids();
      renderManager();
      renderStaff();
      paint();
      var saveBtn = document.getElementById('saveBtn');
      if (saveBtn) saveBtn.disabled = false;
    }

    function ensureSlot(store, date, shiftName) {
      var key = slotKey(store, date, shiftName);
      if (!state.slots[key]) {
        var tmpl = templateShift(state, store, shiftName);
        state.slots[key] = { employee: '', notes: '', start: tmpl ? tmpl.start : '', end: tmpl ? tmpl.end : '' };
      }
      return state.slots[key];
    }

    function hasAssignments(s) {
      var slotHit = Object.keys(s.slots).some(function (k) { return String(s.slots[k].employee || '').trim(); });
      var mgrHit = Object.keys(s.manager).some(function (d) {
        var m = s.manager[d];
        return m.start || m.end || m.onStart || m.onEnd || m.notes;
      });
      return slotHit || mgrHit;
    }

    function loadWeek(week) {
      week = mondayOf(week);
      if (demo) {
        var pack = db.weeks[week] || { shifts: [], manager: [] };
        state = hydrate(week, db.staff, pack.shifts || [], pack.manager || []);
        state.dirty = false;
        renderAll();
        return Promise.resolve();
      }
      return callJsonp({ action: 'schedule_load', week: week }).then(function (res) {
        if (!res || !Array.isArray(res.shifts) || !Array.isArray(res.staff)) {
          throw new Error('scheduling is not in the deployed script yet');
        }
        state = hydrate(week, res.staff, res.shifts, res.manager || []);
        state.dirty = false;
        db.staff = normalizeStaff(res.staff);
        renderAll();
      });
    }

    function goWeek(next) {
      next = mondayOf(next);
      if (!state || next === state.weekStart) {
        var weekDate = document.getElementById('weekDate');
        if (weekDate && state) weekDate.value = state.weekStart;
        return;
      }
      if (state.dirty && !confirm('This week has unsaved changes. Leave without saving?')) {
        document.getElementById('weekDate').value = state.weekStart;
        return;
      }
      loadWeek(next).catch(function (err) { toast(err.message || 'Could not load', true); });
    }

    function copyLast() {
      var prev = addDays(state.weekStart, -7);
      var apply = function (pack) {
        var any = (pack.shifts || []).some(function (s) { return String(s.employee || '').trim(); }) ||
          (pack.manager || []).some(function (m) { return m.start || m.end || m.onStart || m.onEnd; });
        if (!any) { toast('Nothing was scheduled last week.'); return; }
        if (hasAssignments(state) && !confirm('Replace this week with last week?')) return;
        syncStaffFromDom(true);
        var mapped = remapWeek(Object.assign({ week_start: prev }, pack), state.weekStart);
        var staff = state.staff;
        state = hydrate(state.weekStart, staff, mapped.shifts, mapped.manager);
        state.dirty = true;
        renderAll();
        toast('Last week is on the grid. Save to keep it.');
      };
      if (demo) {
        apply(db.weeks[prev] || { shifts: [], manager: [] });
        return;
      }
      callJsonp({ action: 'schedule_load', week: prev }).then(function (res) {
        if (!res || !Array.isArray(res.shifts)) throw new Error('Could not load last week');
        apply(res);
      }).catch(function (err) { toast(err.message || 'Could not load last week', true); });
    }

    function save() {
      syncStaffFromDom(false);
      var staff = normalizeStaff(state.staff);
      var snapshot = Object.assign({}, state, { staff: staff });
      var pack = serialize(snapshot);
      if (demo) {
        memorySave(db, pack);
        writeDb(db);
        state.staff = staff;
        state.dirty = false;
        renderAll();
        toast('Saved in this browser (demo).');
        return Promise.resolve();
      }
      var body = Object.assign({ action: 'schedule_save', pin: pinValue() }, pack);
      var btn = document.getElementById('saveBtn');
      btn.disabled = true;
      return postJson(body).then(function () {
        return callJsonp({ action: 'schedule_load', week: state.weekStart });
      }).then(function (res) {
        if (!res || !Array.isArray(res.shifts)) throw new Error('The script did not confirm the save');
        var back = { shifts: res.shifts, manager: res.manager || [], staff: res.staff || [] };
        if (!packsMatch(pack, back)) {
          toast('The sheet did not store this week. If a manager PIN is set, enter it and save again.', true);
          return;
        }
        state = hydrate(state.weekStart, res.staff, res.shifts, res.manager || []);
        state.dirty = false;
        renderAll();
        toast('Saved to the Varsa sheet.');
      }).catch(function (err) {
        toast(err.message || 'Could not save', true);
      }).then(function () {
        btn.disabled = false;
      });
    }

    function startDemo(week, message) {
      demo = true;
      db = readDb();
      if (!db.staff.length && !Object.keys(db.weeks).length) {
        db = seedDb(week);
        writeDb(db);
      }
      showBanner(message, {
        live: function () { useLive(); },
        reset: function () {
          if (!confirm('Reset the sample week on this device?')) return;
          db = seedDb(state.weekStart || week);
          writeDb(db);
          demo = true;
          loadWeek(state.weekStart || week);
          toast('Sample week restored.');
        }
      });
      return loadWeek(week);
    }

    function useLive() {
      demo = false;
      var u = new URL(location.href);
      u.searchParams.delete('demo');
      u.searchParams.set('live', '1');
      history.replaceState(null, '', u.pathname + u.search);
      loadWeek(state.weekStart).then(function () {
        hideBanner();
        toast('Loaded the live sheet.');
      }).catch(function (err) {
        startDemo(state.weekStart, 'Live sheet is not ready (' + err.message + '). Showing the sample week on this device.');
      });
    }

    document.getElementById('grids').addEventListener('change', function (e) {
      var sel = e.target.closest('select.slot-emp');
      if (!sel) return;
      var slot = ensureSlot(sel.dataset.store, sel.dataset.date, sel.dataset.shift);
      slot.employee = sel.value;
      state.dirty = true;
      paint();
    });
    document.getElementById('grids').addEventListener('input', function (e) {
      var note = e.target.closest('input.slot-note');
      if (!note) return;
      var slot = ensureSlot(note.dataset.store, note.dataset.date, note.dataset.shift);
      slot.notes = note.value;
      note.classList.toggle('has-note', !!note.value.trim());
      state.dirty = true;
      paint();
    });
    document.getElementById('managerGrid').addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp.dataset || !inp.dataset.date) return;
      if (!state.manager[inp.dataset.date]) state.manager[inp.dataset.date] = blankManager();
      state.manager[inp.dataset.date][inp.dataset.field] = inp.value;
      state.dirty = true;
      paint();
    });
    document.getElementById('managerName').addEventListener('input', function (e) {
      state.managerName = e.target.value.trim();
      state.dirty = true;
      paint();
    });
    document.getElementById('staffList').addEventListener('input', function (e) {
      syncStaffFromDom(true);
      if (e.target.getAttribute('data-f') !== 'phone') refreshOptions();
      state.dirty = true;
      paint();
    });
    document.getElementById('staffList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (!btn) return;
      btn.closest('.staff-row').remove();
      syncStaffFromDom(true);
      refreshOptions();
      state.dirty = true;
      paint();
    });
    document.getElementById('addStaff').addEventListener('click', function () {
      syncStaffFromDom(true);
      state.staff.push({ name: '', role: 'cashier', home_store: storeChoices()[0], phone: '', active: 'Yes' });
      renderStaff();
      state.dirty = true;
    });
    document.getElementById('prevWeek').addEventListener('click', function () { goWeek(addDays(state.weekStart, -7)); });
    document.getElementById('nextWeek').addEventListener('click', function () { goWeek(addDays(state.weekStart, 7)); });
    document.getElementById('weekDate').addEventListener('change', function (e) { goWeek(e.target.value); });
    document.getElementById('copyBtn').addEventListener('click', copyLast);
    document.getElementById('loadBtn').addEventListener('click', function () {
      if (state.dirty && !confirm('Discard unsaved changes and load this week again?')) return;
      loadWeek(state.weekStart).catch(function (err) { toast(err.message || 'Could not load', true); });
    });
    document.getElementById('saveBtn').addEventListener('click', function () { save(); });
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeunload', function (e) {
      if (state && state.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    var params = new URLSearchParams(location.search);
    var week0 = mondayOf(params.get('week') || todayISO());
    if (params.get('demo') === '1') {
      startDemo(week0, 'Demo mode. This sample week stays in this browser. It is not written to the Google Sheet. After you redeploy the Apps Script, use the live sheet.');
    } else {
      loadWeek(week0).then(hideBanner).catch(function (err) {
        startDemo(week0, 'Live sheet is not ready (' + (err && err.message ? err.message : 'unavailable') + '). Showing a sample week on this device.');
      });
    }
  }

  function mountView() {
    var demo = false;
    var db = { staff: [], weeks: {} };
    var params = new URLSearchParams(location.search);
    var week = mondayOf(params.get('week') || todayISO());
    var name = params.get('name') || '';

    function syncUrl() {
      if (!history.replaceState) return;
      var u = new URL(location.href);
      if (name) u.searchParams.set('name', name);
      else u.searchParams.delete('name');
      u.searchParams.set('week', week);
      if (demo) u.searchParams.set('demo', '1');
      else u.searchParams.delete('demo');
      history.replaceState(null, '', u.pathname + u.search);
      var back = document.getElementById('backLink');
      if (back) {
        var q = new URLSearchParams();
        q.set('week', week);
        if (demo) q.set('demo', '1');
        back.href = 'schedule.html?' + q.toString();
      }
    }

    function fillNames(names) {
      document.getElementById('names').innerHTML = (names || []).map(function (n) {
        return '<option value="' + h(n) + '"></option>';
      }).join('');
      var picks = document.getElementById('picks');
      if (picks) {
        picks.innerHTML = (names || []).map(function (n) {
          return '<button type="button" class="mini pick" data-name="' + h(n) + '">' + h(n) + '</button>';
        }).join('');
      }
    }

    function renderMine(person, shifts, managerRows) {
      var box = document.getElementById('mine');
      if (!person) {
        box.innerHTML = '<section class="card"><p class="lede">Type your name to see only your shifts. Coworkers’ shifts stay off this page.</p></section>';
        return;
      }
      var dates = weekDates(week);
      var myShifts = (shifts || []).map(function (s) { return Object.assign({}, s, { date: normDate(s.date) }); });
      var myMgr = (managerRows || []).map(function (m) { return Object.assign({}, m, { date: normDate(m.date) }); });
      var hours = 0;
      var oncall = 0;
      myShifts.forEach(function (s) { hours += durationHours(s.start, s.end); });
      myMgr.forEach(function (m) {
        if (isOnCall(m.kind)) oncall += durationHours(m.start, m.end);
        else hours += durationHours(m.start, m.end);
      });
      var flags = personalFlags(person, myShifts, myMgr, week);
      var flagHtml = flags.length ? '<div class="note warn">' + flags.map(function (f) { return h(f.message); }).join('<br>') + '</div>' : '';
      var empty = !myShifts.length && !myMgr.some(function (m) { return m.start || m.end; });
      var days = dates.map(function (date) {
        var items = [];
        myShifts.filter(function (s) { return s.date === date; }).forEach(function (s) {
          items.push('<div class="myshift"><b>' + h(formatRange(s.start, s.end)) + '</b><span>' + h(s.store + ' · ' + s.shift_name) + '</span>' +
            (s.notes ? '<span class="pnote">' + h(s.notes) + '</span>' : '') + '</div>');
        });
        myMgr.filter(function (m) { return m.date === date && !isOnCall(m.kind) && (m.start || m.end); }).forEach(function (m) {
          items.push('<div class="myshift"><b>' + h(formatRange(m.start, m.end)) + '</b><span>Store manager</span>' +
            (m.notes ? '<span class="pnote">' + h(m.notes) + '</span>' : '') + '</div>');
        });
        myMgr.filter(function (m) { return m.date === date && isOnCall(m.kind) && (m.start || m.end); }).forEach(function (m) {
          items.push('<div class="myshift"><b>' + h(formatRange(m.start, m.end)) + '</b><span>On call</span></div>');
        });
        var p = parts(date);
        var title = '<h3>' + h(p.wd) + ' <small>' + h(p.mon + ' ' + p.day) + '</small></h3>';
        if (!items.length) return '<article class="myday off">' + title + '<p class="muted">Off</p></article>';
        return '<article class="myday">' + title + items.join('') + '</article>';
      }).join('');
      box.innerHTML = '<section class="card"><div class="hourchip">' + fmtHours(hours) + ' hours</div><p class="lede">' + h(person) +
        (oncall ? ' · ' + fmtHours(oncall) + ' hours on call' : '') +
        (empty ? ' Nothing is scheduled under this name. Check the spelling.' : '') + '</p>' + flagHtml + '</section>' + days;
    }

    function load() {
      week = mondayOf(document.getElementById('weekDate').value || week);
      name = document.getElementById('who').value.trim();
      document.getElementById('weekLabel').textContent = weekLabel(week);
      document.getElementById('heroSub').textContent = (name || 'Your shifts') + ' · ' + weekLabel(week);
      if (demo) {
        var pack = db.weeks[week] || { shifts: [], manager: [] };
        var full = { shifts: pack.shifts || [], manager: pack.manager || [], staff: db.staff, week_start: week };
        var mine = projectEmployee(full, name);
        fillNames(db.staff.filter(function (s) { return s.active !== 'No' && s.name; }).map(function (s) { return s.name; }));
        renderMine(name, mine.shifts, mine.manager);
        syncUrl();
        return Promise.resolve();
      }
      return callJsonp({ action: 'schedule_view', name: name, week: week }).then(function (res) {
        if (!res || !Array.isArray(res.shifts)) throw new Error('scheduling is not in the deployed script yet');
        fillNames(res.names || []);
        if (res.name && name && res.name.toLowerCase() === name.toLowerCase()) name = res.name;
        renderMine(name, res.shifts, res.manager || []);
        syncUrl();
      });
    }

    function startDemo(message) {
      demo = true;
      db = readDb();
      if (!db.staff.length && !Object.keys(db.weeks).length) {
        db = seedDb(week);
        writeDb(db);
      }
      showBanner(message, {
        live: function () {
          demo = false;
          load().then(function () { hideBanner(); toast('Loaded the live sheet.'); }).catch(function (err) {
            startDemo('Live sheet is not ready (' + err.message + '). Showing the sample week on this device.');
          });
        },
        reset: function () {
          db = seedDb(week);
          writeDb(db);
          demo = true;
          load();
          toast('Sample week restored.');
        }
      });
      return load();
    }

    document.getElementById('who').value = name;
    document.getElementById('weekDate').value = week;
    document.getElementById('prevWeek').addEventListener('click', function () {
      week = addDays(week, -7);
      document.getElementById('weekDate').value = week;
      load().catch(function (err) { toast(err.message, true); });
    });
    document.getElementById('nextWeek').addEventListener('click', function () {
      week = addDays(week, 7);
      document.getElementById('weekDate').value = week;
      load().catch(function (err) { toast(err.message, true); });
    });
    document.getElementById('weekDate').addEventListener('change', function () {
      load().catch(function (err) { toast(err.message, true); });
    });
    document.getElementById('loadBtn').addEventListener('click', function () {
      load().catch(function (err) { toast(err.message, true); });
    });
    document.getElementById('who').addEventListener('change', function () {
      load().catch(function (err) { toast(err.message, true); });
    });
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    document.getElementById('picks').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-name]');
      if (!btn) return;
      document.getElementById('who').value = btn.getAttribute('data-name');
      load().catch(function (err) { toast(err.message, true); });
    });

    if (params.get('demo') === '1') {
      startDemo('Demo mode. Sample shifts in this browser, not the Google Sheet.');
    } else {
      load().catch(function (err) {
        startDemo('Live sheet is not ready (' + (err && err.message ? err.message : 'unavailable') + '). Showing the sample week on this device.');
      });
    }
  }

  function onReady(fn) {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {
    var page = document.body && document.body.getAttribute('data-page');
    if (page === 'schedule') mountEditor();
    if (page === 'schedule-view') mountView();
  });

  return {
    SHIFT_STORES: SHIFT_STORES,
    STORE_MANAGER: STORE_MANAGER,
    HOUR_TARGET_MIN: HOUR_TARGET_MIN,
    HOUR_TARGET_MAX: HOUR_TARGET_MAX,
    MIN_REST_HOURS: MIN_REST_HOURS,
    mondayOf: mondayOf,
    addDays: addDays,
    weekDates: weekDates,
    daysBetween: daysBetween,
    durationHours: durationHours,
    formatTime: formatTime,
    formatRange: formatRange,
    shortDate: shortDate,
    weekLabel: weekLabel,
    normTime: normTime,
    normDate: normDate,
    analyze: analyze,
    hydrate: hydrate,
    serialize: serialize,
    blankState: blankState,
    demoState: demoState,
    demoStaff: demoStaff,
    demoWeek: demoWeek,
    seedDb: seedDb,
    remapWeek: remapWeek,
    projectEmployee: projectEmployee,
    packsMatch: packsMatch,
    memorySave: memorySave,
    cashierNames: cashierNames,
    slotKey: slotKey,
    personalFlags: personalFlags
  };
});
