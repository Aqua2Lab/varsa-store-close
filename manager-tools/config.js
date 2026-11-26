// ===== Varsa Manager Tools - shared settings =====
// Same Apps Script deployment as Cashier Tools ("Cashier Tools Intake").
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwTk4zuoVp_LcMaNrJUqiywGYSDdn6_TbB84dcYW9POP4cFC4brF0X1XHVmZnepl_Rf/exec';
const STORES = ['Thomasville Chevron', 'Thomasville OutRun'];
const MANAGERS = ['Varun', 'Sanchari', 'Jonathan'];

// Staff schedule. Edit this block when shift times or store hours change.
// Budget hours = hoursPerDay × days, for one person covering every hour the store is open.
// Chevron is 24/7. OutRun is 5:00 AM to midnight (19 hours).
const DEFAULT_PAY_RATE = 10;
const STORE_HOURS = {
  'Thomasville Chevron': { hoursPerDay: 24, label: 'Open 24/7' },
  'Thomasville OutRun': { hoursPerDay: 19, label: 'Open 5 AM – midnight' }
};
// Times are 24-hour HH:MM. 00:00 means midnight. If end is earlier than start, the shift crosses midnight.
const SHIFT_TEMPLATES = {
  'Thomasville Chevron': [
    { name: '6 AM-2 PM', start: '06:00', end: '14:00' },
    { name: '2 PM-10 PM', start: '14:00', end: '22:00' },
    { name: '10 PM-6 AM', start: '22:00', end: '06:00' }
  ],
  'Thomasville OutRun': [
    { name: '5 AM-1 PM', start: '05:00', end: '13:00' },
    { name: '1 PM-12 AM', start: '13:00', end: '00:00' }
  ]
};
const ON_CALL_MIN = 2;
const ON_CALL_MAX = 6;
const VENDORS = ['Coke','Pepsi','Gulf','Budweiser','United Johnson','W.K. Coulter','Golden Flake','Little Debbie','JCW','AAA','Harmons Coffee','Other / Not sure'];
