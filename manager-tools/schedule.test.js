/* Local checks for the staff schedule. Run: node manager-tools/schedule.test.js */
'use strict';

var assert = require('assert');
var S = require('./schedule.js');

assert.strictEqual(S.mondayOf('2026-11-26'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-23'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-29'), '2026-11-23');
assert.strictEqual(S.mondayOf('2026-11-01'), '2026-10-26');
assert.strictEqual(S.shiftHours('06:00', '14:00'), 8);
assert.strictEqual(S.shiftHours('22:00', '06:00'), 8);
assert.strictEqual(S.shiftHours('05:00', '13:00'), 8);
assert.strictEqual(S.shiftHours('13:00', '00:00'), 11);
assert.strictEqual(S.shiftHours('08:00', '08:00'), 0);
assert.strictEqual(S.shiftHours('', '10:00'), 0);

var days = S.rangeDays('2026-11-23', '2026-11-29');
assert.strictEqual(days.length, 7);
var shifts = [];
days.forEach(function (dt) {
  shifts.push({ date: dt, store: 'Thomasville Chevron', shift_name: '6 AM-2 PM', start: '06:00', end: '14:00', employee: 'A' });
  shifts.push({ date: dt, store: 'Thomasville Chevron', shift_name: '2 PM-10 PM', start: '14:00', end: '22:00', employee: 'B' });
  shifts.push({ date: dt, store: 'Thomasville Chevron', shift_name: '10 PM-6 AM', start: '22:00', end: '06:00', employee: 'C' });
  shifts.push({ date: dt, store: 'Thomasville OutRun', shift_name: '5 AM-1 PM', start: '05:00', end: '13:00', employee: 'D' });
  shifts.push({ date: dt, store: 'Thomasville OutRun', shift_name: '1 PM-12 AM', start: '13:00', end: '00:00', employee: 'E' });
  shifts.push({ date: dt, store: 'Thomasville OutRun', shift_name: 'On-call 1', start: '18:00', end: '20:00', employee: 'Q' });
});
var manager = days.filter(function (d) { var x = S.parseISO(d).getDay(); return x >= 1 && x <= 5; }).map(function (d) {
  return { date: d, employee: 'Jonathan Cowan', start: '08:00', end: '16:00', kind: 'shift' };
});
var sum = S.summarize({
  dates: days, shifts: shifts, manager: manager, rate: 10, mode: 'plan',
  stores: ['Thomasville Chevron', 'Thomasville OutRun'],
  hoursPerDay: { 'Thomasville Chevron': 24, 'Thomasville OutRun': 19 }
});
assert.strictEqual(sum.stores['Thomasville Chevron'].schedMin / 60, 168);
assert.strictEqual(sum.stores['Thomasville Chevron'].budgetMin / 60, 168);
assert.strictEqual(Math.round(sum.stores['Thomasville Chevron'].budgetMin / 60 * 10), 1680);
assert.strictEqual(sum.stores['Thomasville OutRun'].schedMin / 60, 147);
assert.strictEqual(sum.stores['Thomasville OutRun'].budgetMin / 60, 133);
assert.strictEqual(Math.round(133 * 10), 1330);
assert.strictEqual(sum.managerMin / 60, 40);
assert.ok(sum.stores['Thomasville OutRun'].schedMin > sum.stores['Thomasville OutRun'].budgetMin);

var a = S.intervalMs('2026-11-26', '06:00', '14:00');
var b = S.intervalMs('2026-11-26', '05:00', '13:00');
assert.strictEqual(S.findConflicts([{ startMs: a[0], endMs: a[1], label: 'c' }, { startMs: b[0], endMs: b[1], label: 'o' }]).overlaps.length, 1);
var fri = S.intervalMs('2026-11-27', '22:00', '06:00');
var sat = S.intervalMs('2026-11-28', '08:00', '12:00');
var rest = S.findConflicts([{ startMs: fri[0], endMs: fri[1], label: 'n' }, { startMs: sat[0], endMs: sat[1], label: 'm' }]);
assert.strictEqual(rest.overlaps.length, 0);
assert.ok(Math.abs(rest.rests[0].gap - 2) < 0.01);

var people = S.peopleHours(shifts, manager, days);
assert.strictEqual((people.A.shiftMin + people.A.onMin) / 60, 56);
assert.strictEqual(people.Q.onMin / 60, 14);
assert.strictEqual(people['Jonathan Cowan'].mgrMin / 60, 40);
assert.strictEqual(S.sourceDateFor('2026-12-07', S.monthIndex(2026, 10)), '2026-11-02');
assert.strictEqual(S.isOnCallName('On-call 2'), true);
assert.strictEqual(S.isOnCallName('6 AM-2 PM'), false);

console.log('schedule.test.js ok');
