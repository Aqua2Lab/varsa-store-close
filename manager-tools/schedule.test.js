/* Local checks for the staff schedule. Run: node manager-tools/schedule.test.js */
'use strict';

var assert = require('assert');
var S = require('./schedule.js');

function types(report) {
  return report.flags.filter(function (f) { return f.level === 'warn'; }).map(function (f) { return f.type; });
}

assert.strictEqual(S.mondayOf('2026-11-26'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-23'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-29'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-22'), '2026-11-16');
assert.strictEqual(S.mondayOf('2027-01-01'), '2026-12-28');
assert.deepStrictEqual(S.weekDates('2026-11-23'), [
  '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'
]);
assert.strictEqual(S.shortDate('2026-11-23'), 'Mon Nov 23');
assert.strictEqual(S.shortDate('2026-11-29'), 'Sun Nov 29');

assert.strictEqual(S.durationHours('06:00', '14:00'), 8);
assert.strictEqual(S.durationHours('14:00', '22:00'), 8);
assert.strictEqual(S.durationHours('22:00', '06:00'), 8);
assert.strictEqual(S.durationHours('05:00', '13:00'), 8);
assert.strictEqual(S.durationHours('13:00', '00:00'), 11);
assert.strictEqual(S.durationHours('08:00', '16:00'), 8);
assert.strictEqual(S.durationHours('08:00', '08:00'), 0);
assert.strictEqual(S.durationHours('', '10:00'), 0);
assert.strictEqual(S.formatTime('06:00'), '6:00 AM');
assert.strictEqual(S.formatTime('14:00'), '2:00 PM');
assert.strictEqual(S.formatTime('22:00'), '10:00 PM');
assert.strictEqual(S.formatTime('00:00'), '12:00 AM');
assert.strictEqual(S.formatRange('13:00', '00:00'), '1:00 PM – midnight');

var chev = S.SHIFT_STORES.filter(function (s) { return s.name === 'Thomasville Chevron'; })[0];
var out = S.SHIFT_STORES.filter(function (s) { return s.name === 'Thomasville OutRun'; })[0];
assert.deepStrictEqual(chev.shifts.map(function (s) { return s.start + '-' + s.end; }), ['06:00-14:00', '14:00-22:00', '22:00-06:00']);
assert.strictEqual(out.shifts[0].start, '05:00');
assert.strictEqual(out.shifts[0].end, '13:00');
assert.strictEqual(out.shifts[1].start, '13:00');
assert.strictEqual(out.shifts[1].end, '00:00');
assert.strictEqual(S.STORE_MANAGER.name, 'Jonathan Cowan');

var state = S.demoState('2026-11-23');
var report = S.analyze(state);
assert.strictEqual(report.byPerson['Maria Alvarez'].hours, 40);
assert.strictEqual(report.byPerson['James Patel'].hours, 51);
assert.strictEqual(report.byPerson['Jonathan Cowan'].hours, 40);
assert.strictEqual(report.byPerson['Jonathan Cowan'].oncall, 4);
assert.strictEqual(report.byPerson['Luis Romero'].hours, 38);
assert.strictEqual(report.byPerson['Noah Bennett'].hours, 32);
assert.strictEqual(report.byStore['Thomasville Chevron'], 168);
assert.strictEqual(report.byStore['Thomasville OutRun'], 122);
assert.strictEqual(report.managerHours, 40);
assert.strictEqual(report.oncallHours, 4);
assert.strictEqual(report.laborHours, 330);
var personSum = Object.keys(report.byPerson).reduce(function (a, n) { return a + report.byPerson[n].hours; }, 0);
assert.strictEqual(Math.round(personSum * 100) / 100, 330);

assert.strictEqual(report.flags.filter(function (f) { return f.type === 'empty'; }).length, 1);
assert.strictEqual(report.flags.filter(function (f) { return f.type === 'overlap'; }).length, 1);
assert.strictEqual(report.flags.filter(function (f) { return f.type === 'rest'; }).length, 1);
assert.strictEqual(report.flags.filter(function (f) { return f.type === 'hours'; }).length, 1);
var overlap = report.flags.filter(function (f) { return f.type === 'overlap'; })[0];
assert.ok(overlap.message.indexOf('James Patel') !== -1);
assert.ok(overlap.message.indexOf('Thomasville Chevron') !== -1);
assert.ok(overlap.message.indexOf('Thomasville OutRun') !== -1);
var rest = report.flags.filter(function (f) { return f.type === 'rest'; })[0];
assert.ok(rest.message.indexOf('Noah Bennett') !== -1);
assert.ok(rest.message.indexOf('0 hours') !== -1);
var empty = report.flags.filter(function (f) { return f.type === 'empty'; })[0];
assert.ok(empty.message.indexOf('Thomasville OutRun') !== -1);
assert.ok(empty.message.indexOf('Evening') !== -1);
assert.ok(empty.message.indexOf('Sun Nov 29') !== -1);
var over = report.flags.filter(function (f) { return f.type === 'hours'; })[0];
assert.ok(over.message.indexOf('51') !== -1);
assert.ok(over.message.indexOf('35–40') !== -1);
assert.ok(types(report).indexOf('under') === -1);

var pack = S.serialize(state);
var keys = pack.shifts.map(function (s) { return s.store + '|' + s.date + '|' + s.shift_name; });
assert.strictEqual(new Set(keys).size, keys.length);
assert.ok(pack.shifts.some(function (s) { return !s.employee; }));
assert.ok(pack.manager.some(function (m) { return m.kind === 'oncall'; }));
assert.ok(!pack.manager.some(function (m) { return m.date === '2026-11-29' && m.kind === 'day'; }));
var again = S.serialize(S.hydrate(pack.week_start, pack.staff, pack.shifts, pack.manager));
assert.ok(S.packsMatch(pack, again));
var changed = JSON.parse(JSON.stringify(pack));
changed.shifts[0].employee = 'Someone Else';
assert.ok(!S.packsMatch(pack, changed));

var db = S.seedDb('2026-11-26');
assert.strictEqual(S.mondayOf('2026-11-26'), '2026-11-23');
var mapped = S.remapWeek(Object.assign({ week_start: '2026-11-16' }, db.weeks['2026-11-16']), '2026-11-23');
assert.ok(S.packsMatch(
  { shifts: mapped.shifts, manager: mapped.manager, staff: db.staff },
  { shifts: db.weeks['2026-11-23'].shifts, manager: db.weeks['2026-11-23'].manager, staff: db.staff }
));

var mem = { staff: [], weeks: {} };
var w1 = S.serialize(S.demoState('2026-11-16'));
var w2 = S.serialize(S.demoState('2026-11-23'));
S.memorySave(mem, w1);
S.memorySave(mem, w2);
assert.ok(mem.weeks['2026-11-16'].shifts.some(function (s) { return s.date === '2026-11-16'; }));
assert.ok(mem.weeks['2026-11-23'].shifts.some(function (s) { return s.date === '2026-11-23'; }));
assert.strictEqual(mem.weeks['2026-11-16'].shifts.length, w1.shifts.length);

var maria = S.projectEmployee(pack, 'maria alvarez');
assert.strictEqual(maria.shifts.length, 5);
assert.strictEqual(maria.manager.length, 0);
assert.ok(maria.shifts.every(function (s) { return s.employee === 'Maria Alvarez'; }));
var jon = S.projectEmployee(pack, 'Jonathan Cowan');
assert.strictEqual(jon.shifts.length, 0);
assert.ok(jon.manager.length >= 5);

var names = S.cashierNames(S.demoStaff(), '');
assert.ok(names.indexOf('Jonathan Cowan') === -1);
assert.ok(names.indexOf('Maria Alvarez') !== -1);
var hidden = S.demoStaff().map(function (s) { return Object.assign({}, s); });
hidden[1].active = 'No';
var kept = S.cashierNames(hidden, 'Maria Alvarez');
assert.ok(kept.indexOf('Maria Alvarez') !== -1);
var dropped = S.cashierNames(hidden, '');
assert.ok(dropped.indexOf('Maria Alvarez') === -1);

var one = [{ name: 'Thomasville Chevron', blurb: '', shifts: [
  { name: 'Morning', start: '06:00', end: '14:00' },
  { name: 'Night', start: '22:00', end: '06:00' }
] }];
var staff = [{ name: 'A', role: 'cashier', home_store: 'Thomasville Chevron', phone: '', active: 'Yes' }];
var touch = S.blankState('2026-11-23', staff, one);
var days = S.weekDates('2026-11-23');
function put(st, date, shift, employee) {
  var sh = one[0].shifts.filter(function (s) { return s.name === shift; })[0];
  st.slots[S.slotKey(one[0].name, date, shift)] = { employee: employee, notes: '', start: sh.start, end: sh.end };
}
put(touch, days[0], 'Morning', 'A');
put(touch, days[0], 'Night', 'A');
var touchReport = S.analyze(touch, { skipEmpty: true });
assert.ok(!touchReport.flags.some(function (f) { return f.type === 'rest' || f.type === 'overlap'; }));

var shortRest = S.blankState('2026-11-23', staff, one);
put(shortRest, days[0], 'Night', 'A');
put(shortRest, days[1], 'Morning', 'A');
var shortReport = S.analyze(shortRest, { skipEmpty: true });
assert.ok(shortReport.flags.some(function (f) { return f.type === 'rest'; }));
assert.ok(!shortReport.flags.some(function (f) { return f.type === 'overlap'; }));

var longWeek = S.blankState('2026-11-23', staff, [{ name: 'Thomasville Chevron', shifts: [{ name: 'Morning', start: '06:00', end: '14:00' }] }]);
days.slice(0, 6).forEach(function (date) {
  longWeek.slots[S.slotKey('Thomasville Chevron', date, 'Morning')] = { employee: 'A', notes: '', start: '06:00', end: '14:00' };
});
var longReport = S.analyze(longWeek, { skipEmpty: true });
assert.strictEqual(longReport.byPerson.A.hours, 48);
assert.ok(longReport.flags.some(function (f) { return f.type === 'hours'; }));

var exact = S.blankState('2026-11-23', staff, [{ name: 'Thomasville Chevron', shifts: [{ name: 'Morning', start: '06:00', end: '14:00' }] }]);
days.slice(0, 5).forEach(function (date) {
  exact.slots[S.slotKey('Thomasville Chevron', date, 'Morning')] = { employee: 'A', notes: '', start: '06:00', end: '14:00' };
});
var exactReport = S.analyze(exact, { skipEmpty: true });
assert.strictEqual(exactReport.byPerson.A.hours, 40);
assert.ok(!exactReport.flags.some(function (f) { return f.type === 'hours'; }));

var flags = S.personalFlags('Maria Alvarez', maria.shifts, maria.manager, '2026-11-23');
assert.ok(!flags.some(function (f) { return f.type === 'empty' || f.message.indexOf('James') !== -1; }));

console.log('schedule.test.js: ' + report.flags.length + ' demo warnings, all checks passed');
