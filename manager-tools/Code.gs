/**
 * Varsa GROUP LLC - Cashier Tools + Manager Tools web app (one deployment)
 * Sheet: "Varsa Cashier Tracker" (Varsa Group LLC > Daily Operations)
 * https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit
 *
 * Deploy: Extensions > Apps Script (from the sheet) OR script.google.com new project,
 * paste this file, then Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone. Copy the /exec URL into config.js.
 *
 * Every form posts JSON {form:"<key>", store, cashier, ...fields}.
 * Each field lands in its own column. Hidden follow-up questions arrive blank.
 */
const SHEET_ID = '1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U';

// form key -> tab + column order. "_ts" = timestamp, "_status" = Open by default,
// other "_" keys are manager-only columns left blank.
const SCHEMA = {
  "product_issue": {
    "tab": "Product Issues",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "issue_type",
      "item_name",
      "upc",
      "brand_size",
      "location",
      "qty_on_shelf",
      "price_check",
      "register_price",
      "scan_result",
      "price_charged",
      "deal_desc",
      "deal_sign_price",
      "deal_tag",
      "shelf_price",
      "customer_charged",
      "item_scans",
      "photo_taken",
      "details",
      "_status",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Cashier Name",
      "Issue Type",
      "Item Name",
      "UPC",
      "Brand / Size",
      "Location in Store",
      "Qty on Shelf",
      "Price Check Done",
      "Register Price",
      "Scan Result",
      "Price Charged to Customer",
      "Deal Description",
      "Deal Price on Sign",
      "Deal Tag on Shelf",
      "Shelf Tag Price",
      "Customer Charged",
      "Item Scans",
      "Photo Taken",
      "Details",
      "Status",
      "Manager Notes"
    ]
  },
  "supply_request": {
    "tab": "Supply Requests",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "item",
      "item_other",
      "stock_level",
      "qty_on_hand",
      "days_last",
      "vendor",
      "order_qty",
      "urgency",
      "details",
      "_status",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Cashier Name",
      "Item",
      "Other Item",
      "Stock Level",
      "Qty on Hand",
      "Days We Can Last",
      "Usual Vendor",
      "Suggested Order Qty",
      "Urgency",
      "Details",
      "Status",
      "Manager Notes"
    ]
  },
  "low_stock": {
    "tab": "Low Stock",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "product_name",
      "upc",
      "category",
      "stock_level",
      "qty_on_hand",
      "days_last",
      "vendor",
      "order_qty",
      "urgency",
      "notes",
      "_status",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Cashier Name",
      "Product Name",
      "UPC",
      "Category",
      "Stock Level",
      "Qty on Hand",
      "Days We Can Last",
      "Usual Vendor",
      "Suggested Order Qty",
      "Urgency",
      "Cashier Notes",
      "Status",
      "Manager Notes"
    ]
  },
  "shift_checklist": {
    "tab": "Shift Checklist",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "shift",
      "started_300",
      "start_actual",
      "inside_trash",
      "outside_trash",
      "outside_result",
      "washroom_condition",
      "washroom_cleaned",
      "washroom_photo",
      "prev_issues",
      "prev_details",
      "prev_photo",
      "esm_tasks",
      "tasks_posted",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Cashier Name",
      "Shift",
      "Started with $300",
      "Actual Starting Cash",
      "Inside Trash Done",
      "Outside Trash Checked",
      "Outside Trash Result",
      "Washroom Condition",
      "Washroom Cleaned",
      "Washroom Photo Posted",
      "Previous-Shift Issues Found",
      "Previous-Shift Issue Details",
      "Previous-Shift Photo Posted",
      "Additional Tasks from ESM",
      "Tasks Posted to Group",
      "Manager Notes"
    ]
  },
  "till_close": {
    "tab": "Till Close",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "shift",
      "start_cash",
      "cash_counted",
      "left_in_till",
      "expected_cash",
      "difference",
      "mismatch_reason",
      "slip_in_bundle",
      "photo_posted",
      "store_close",
      "night_drop",
      "bundles_verified",
      "reports_left",
      "notes",
      "_esm",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Cashier Name",
      "Shift",
      "Starting Cash",
      "Cash Counted (Bundle)",
      "Left in Till",
      "Report Cash Expected",
      "Difference",
      "Mismatch Reason",
      "Slip in Bundle",
      "Banded Cash Photo Posted",
      "11 PM Store Close Done",
      "Night Drop in Safe",
      "Earlier Bundles Verified",
      "Reports Left on Table",
      "Cashier Notes",
      "ESM Verified",
      "Manager Notes"
    ]
  },
  "fuel_price": {
    "tab": "Fuel Price Change",
    "cols": [
      "_ts",
      "store",
      "cashier",
      "regular",
      "mid",
      "premium",
      "diesel",
      "mpc_time",
      "done_time",
      "sign_updated",
      "pumps_updated",
      "photo_posted",
      "done_by",
      "done_by_other",
      "reason",
      "notes",
      "_mnotes"
    ],
    "headers": [
      "Timestamp",
      "Store",
      "Submitted By",
      "Regular",
      "Mid",
      "Premium",
      "Diesel",
      "MPC Notice Time",
      "Change Completed Time",
      "Sign Updated",
      "Pumps/Passport Updated",
      "Photo Posted",
      "Done By",
      "Done By Name",
      "Reason Not Complete",
      "Notes",
      "Manager Notes"
    ]
  }
};


// ===== Manager Tools forms (same engine, same sheet) =====
Object.assign(SCHEMA, {
  "todays_plan": { "tab": "Today's Plan", "cols": ["_ts", "store", "cashier", "plan_date", "day_tasks", "night_tasks", "day_backup", "night_backup", "posted_by_9", "notes", "_mnotes"], "headers": ["Timestamp", "Store", "Submitted By", "Plan Date", "Day Shift Tasks", "Night Shift Tasks", "Day Backup", "Night Backup", "Posted in Group by 9 AM", "Notes", "Manager Notes"] },
  "morning_count": { "tab": "Morning Cash Count", "cols": ["_ts", "store", "cashier", "count_date", "reports_pulled", "safe_counted", "night_drop_found", "till_closes_checked", "bundles_match", "bundle_total", "report_expected", "difference", "short_reported", "done_by_10", "notes", "_mnotes"], "headers": ["Timestamp", "Store", "Counted By", "Night Being Counted", "Reports Pulled", "Safe Counted", "Night Drop Found", "All Till Closes Checked", "Bundles Match Slips", "Total Cash Counted", "Report Cash Expected", "Difference", "Short Reported to Varun", "Done by 10 AM", "Notes", "Manager Notes"] },
  "night_audit": { "tab": "Night Shift Audit", "cols": ["_ts", "store", "cashier", "night_date", "night_cashier", "expiry_check", "rotation", "facing", "washroom_deep", "whatsapp_1030", "busy_on_camera", "misses", "follow_up", "done_by_10", "_mnotes"], "headers": ["Timestamp", "Store", "Audited By", "Night Audited", "Night Cashier", "Expiry Check Done", "Old Stock Rotated to Front", "Products Faced", "Washroom Deep Clean", "WhatsApp Confirmation by 10:30 PM", "Busy on Camera", "Misses", "Follow-up Done", "Audit Done by 10 AM", "Manager Notes"] },
  "shift_check": { "tab": "ESM Shift Check", "cols": ["_ts", "store", "cashier", "shift_date", "shift", "shift_cashier", "till_start", "inside_trash", "outside_trash", "washroom_photo", "esm_tasks", "esm_tasks_done", "till_close_photo", "till_amount", "short_over", "washroom_deep", "expiry_rotation", "faced", "store_close_drop", "issues", "posted_group", "_mnotes"], "headers": ["Timestamp", "Store", "ESM", "Shift Date", "Shift", "Cashier", "Till Start $300", "Inside Trash", "Outside Trash", "Washroom Photo", "ESM Tasks Given", "ESM Tasks Done", "Till Close Photo", "Till Close Amount", "Short/Over", "Washroom Deep Clean (Night)", "Expiry + Rotation (Night)", "Products Faced (Night)", "11 PM Close + Night Drop (Night)", "Issues / Follow-up", "Posted in Group", "Manager Notes"] },
  "store_visit": { "tab": "Store Visits", "cols": ["_ts", "store", "cashier", "visit_date", "outside_pumps", "inside_clean", "washroom", "coolers_shelves", "counter", "staff_busy", "customer_feedback", "issues", "follow_up_by", "due_date", "_status", "_mnotes"], "headers": ["Timestamp", "Store", "Visited By", "Visit Date", "Outside & Pumps", "Inside Clean", "Washroom", "Coolers & Shelves", "Counter Area", "Staff Busy & Polite", "Customer Feedback", "Issues Found", "Follow-up Owner", "Due Date", "Status", "Manager Notes"] },
  "shelf_audit": { "tab": "Shelf & Stock Audit", "cols": ["_ts", "store", "cashier", "areas", "gaps_found", "gap_items", "expired_found", "expired_items", "facing_ok", "low_stock_items", "order_needed", "notes", "_status", "_mnotes"], "headers": ["Timestamp", "Store", "Audited By", "Areas Checked", "Gaps Found", "Gap Items", "Expired Found", "Expired Items", "Facing OK", "Low Stock Items", "Order Needed", "Notes", "Status", "Manager Notes"] },
  "price_tag_audit": { "tab": "Price Tag Audit", "cols": ["_ts", "store", "cashier", "areas", "missing_count", "wrong_count", "novelty_priced", "items", "tags_printed", "due_date", "notes", "_status", "_mnotes"], "headers": ["Timestamp", "Store", "Audited By", "Areas Checked", "Items Missing Price", "Wrong Price Tags", "All Novelty Priced", "Item List", "Tags Printed & Put Up", "Due Date (48 hrs)", "Notes", "Status", "Manager Notes"] },
  "post_audit": { "tab": "Cashier Post Audit", "cols": ["_ts", "store", "cashier", "audit_date", "shift", "shift_cashier", "washroom_photo", "trash_photo", "till_photo", "tasks_photo", "missed", "action", "_mnotes"], "headers": ["Timestamp", "Store", "Audited By", "Shift Date", "Shift", "Cashier", "Washroom Photo", "Trash Photo", "Till Close Photo", "Task Photos", "Missed Items", "Action Taken", "Manager Notes"] },
  "delivery_intake": { "tab": "Delivery Intake", "cols": ["_ts", "store", "cashier", "vendor", "vendor_other", "invoice_no", "invoice_total", "matches_order", "expiry_damage", "rotated", "shorts", "short_details", "credit_amount", "rep_initialed", "photo_posted", "payment", "cash_approved", "notes", "_status", "_mnotes"], "headers": ["Timestamp", "Store", "Received By", "Vendor", "Other Vendor", "Invoice #", "Invoice Total", "Matches Invoice & Order", "Expiry & Damage Checked", "New Stock Behind Old", "Shorts / Damage / Credits", "Short Details", "Credit Amount", "Rep Initialed Shorts", "Signed Invoice Photo Posted", "Payment", "Cash Approved by Varun", "Notes", "Status", "Manager Notes"] },
  "schedule": { "tab": "Schedule & Time Cards", "cols": ["_ts", "store", "cashier", "week_start", "posted_by_thu", "backup_every_shift", "gaps", "timecard_fixes", "fix_details", "approved_before_payroll", "notes", "_mnotes"], "headers": ["Timestamp", "Store", "Submitted By", "Week Starting", "Posted by Thursday", "Backup for Every Shift", "Open Shifts / Gaps", "Time Card Corrections", "Correction Details", "Approved Before Payroll", "Notes", "Manager Notes"] }
});

const TEXT_KEYS = ['upc', 'invoice_no']; // keep leading zeros

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.form === 'expense') return json_(expense_(data));
    const spec = SCHEMA[data.form];
    if (!spec) return json_({ ok: false, error: 'Unknown form: ' + data.form });
    const sh = getTab_(spec);
    const row = spec.cols.map(function (k) {
      if (k === '_ts') return new Date();
      if (k === '_status') return 'Open';
      if (k.charAt(0) === '_') return '';
      let v = data[k];
      if (v === undefined || v === null) return '';
      if (Array.isArray(v)) v = v.join(', ');
      v = String(v).trim();
      if (TEXT_KEYS.indexOf(k) > -1 && v) return "'" + v;
      if (/^=/.test(v)) return "'" + v; // never let input become a formula
      if (/^-?\d+(\.\d+)?$/.test(v) && TEXT_KEYS.indexOf(k) === -1) return Number(v);
      return v;
    });
    sh.appendRow(row);
    return json_({ ok: true, form: data.form, tab: spec.tab, row: sh.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ===== Read side (JSONP) =====
// ?form=<key>&store=&limit=&callback=   recent rows of one tab (Cashier + Manager forms)
// ?action=activity&store=&limit=&callback=   recent rows of every Cashier Tools tab in one call
// ?action=storeclose&store=&from=&to=&callback=   Store Close Log entries, READ-ONLY
// Optional: set Script Property MANAGER_PIN to require &pin= on the two action calls.
const STORE_CLOSE_ID = '149QWdotKvCoGT3gUosi_-oqPSdMeqT3tKH6yI5UE548'; // "Varsa Store Close Log" (read only)
const CASHIER_FORMS = ['till_close', 'product_issue', 'supply_request', 'low_stock', 'shift_checklist', 'fuel_price'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'storeclose' || p.action === 'activity') {
      const pin = PropertiesService.getScriptProperties().getProperty('MANAGER_PIN');
      if (pin && String(p.pin || '') !== String(pin)) return out_({ ok: false, error: 'PIN required', pin: true }, p.callback);
      if (p.action === 'storeclose') return out_({ ok: true, rows: storeClose_(p) }, p.callback);
      const n = Math.min(parseInt(p.limit, 10) || 50, 200), tabs = {};
      CASHIER_FORMS.forEach(function (f) { tabs[f] = readRows_(SCHEMA[f], p.store, n); });
      return out_({ ok: true, tabs: tabs }, p.callback);
    }
    if (p.form === 'expense') return out_({ ok: true, form: 'expense', rows: expenseRows_(p) }, p.callback);
    if (p.form) {
      const spec = SCHEMA[p.form];
      if (!spec) return out_({ ok: false, error: 'Unknown form' }, p.callback);
      const n = Math.min(parseInt(p.limit, 10) || 10, 200);
      return out_({ ok: true, form: p.form, rows: readRows_(spec, p.store, n) }, p.callback);
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) }, p.callback);
  }
  return json_({ ok: true, app: 'Varsa Cashier Tracker', forms: Object.keys(SCHEMA), time: new Date().toISOString() });
}

function readRows_(spec, store, n) {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(spec.tab);
  let rows = [];
  if (sh && sh.getLastRow() > 1) {
    const last = sh.getLastRow(), start = Math.max(2, last - 199);
    rows = sh.getRange(start, 1, last - start + 1, spec.cols.length).getDisplayValues()
      .map(function (r) { const o = {}; spec.cols.forEach(function (k, i) { o[k] = r[i]; }); return o; });
    if (store) rows = rows.filter(function (o) { return o.store === store; });
    rows = rows.reverse().slice(0, n);
  }
  return rows;
}

// Store Close Log > Entries (A..AF). Short/Over = Total Outgoing - Total Incoming, same as the form
// and the Daily Summary tab. Never writes to that sheet.
function storeClose_(p) {
  const ssc = SpreadsheetApp.openById(STORE_CLOSE_ID), sh = ssc.getSheetByName('Entries');
  const last = sh ? sh.getLastRow() : 0;
  if (last < 2) return [];
  const tz = ssc.getSpreadsheetTimeZone() || 'America/Chicago';
  const num = function (x) { if (typeof x === 'number') return x; const v = parseFloat(String(x).replace(/[$,\s]/g, '')); return isNaN(v) ? 0 : v; };
  const r2 = function (x) { return Math.round(x * 100) / 100; };
  const disp = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  let rows = sh.getRange(2, 1, last - 1, 32).getValues().map(function (r, i) { r.push(disp[i][0]); return r; }).filter(function (r) { return r[0] !== '' && r[1] !== ''; }).map(function (r) {
    const dv = String(r[32] || ''), date = /^\d{4}-\d{2}-\d{2}/.test(dv) ? dv.slice(0, 10) : (Object.prototype.toString.call(r[0]) === '[object Date]' ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).slice(0, 10));
    const gas = num(r[3]) - num(r[4]), tax = num(r[6]);
    let items = 0; for (let i = 7; i <= 20; i++) items += num(r[i]); // Beer..TBA (H..U)
    const inc = gas + tax + items;
    const out = num(r[24]) + num(r[27]) + num(r[28]) + num(r[29]) + num(r[30]) + num(r[31]); // card, deposit, FD130, coupons, cash purch, cash exp
    return { date: date, store: String(r[1]), cashier: String(r[2]), fuel: r2(gas), tax: r2(num(r[6])), items: r2(items),
      report_total: r2(num(r[23])), card: r2(num(r[24])), deposit: r2(num(r[27])), fd130: r2(num(r[28])), coupons: r2(num(r[29])),
      cash_purchases: r2(num(r[30])), cash_expenses: r2(num(r[31])), incoming: r2(inc), outgoing: r2(out),
      diff_report: r2(inc - num(r[23])), short_over: r2(out - inc) };
  });
  if (p.store) rows = rows.filter(function (o) { return o.store === p.store; });
  if (p.from) rows = rows.filter(function (o) { return o.date >= p.from; });
  if (p.to) rows = rows.filter(function (o) { return o.date <= p.to; });
  rows.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return rows.slice(0, 2000);
}


function out_(o, cb) {
  if (cb && /^[A-Za-z_$][\w$]*$/.test(cb)) return ContentService.createTextOutput(cb + '(' + JSON.stringify(o) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(o);
}

function getTab_(spec) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(spec.tab);
  if (!sh) {
    sh = ss.insertSheet(spec.tab);
    sh.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Optional: run once from the editor to (re)write header rows on every tab. */
function setupHeaders() {
  Object.keys(SCHEMA).forEach(function (f) {
    const spec = SCHEMA[f], sh = getTab_(spec);
    sh.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}

/** Run from the editor to test without the forms. */
function testPost() {
  const r = doPost({ postData: { contents: JSON.stringify({ form: 'supply_request', store: 'Thomasville Chevron', cashier: 'TEST', item: 'Rubber Bands', stock_level: 'Low', urgency: 'This week', details: 'test row - delete me' }) } });
  Logger.log(r.getContent());
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}


// ===== Expenses tab (Manager Tools) =====
// NON-vendor cash expenses only (Walmart runs, cash given out...). Vendor invoices go through Delivery Intake.
// Rows go to the "Expenses" tab of the Varsa Store Close Log; photos go to Drive:
// Varsa Group LLC > 09 Accounting & Financials > Cash Expense Receipts.
const EXP_HEADERS = ['Timestamp', 'Expense Date', 'Store', 'Entered By', 'Amount', 'Type', 'Paid To / Where', 'Reason / Bill Note', 'Receipt Photo', 'Manager Notes'];
function expTab_() {
  const ss = SpreadsheetApp.openById(STORE_CLOSE_ID);
  let sh = ss.getSheetByName('Expenses');
  if (!sh) { sh = ss.insertSheet('Expenses'); sh.getRange(1, 1, 1, EXP_HEADERS.length).setValues([EXP_HEADERS]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function receiptFolder_() {
  let parent = null;
  const roots = DriveApp.getFoldersByName('09 Accounting & Financials');
  while (roots.hasNext()) { const f = roots.next(), ps = f.getParents(); if (ps.hasNext() && /varsa/i.test(ps.next().getName())) { parent = f; break; } if (!parent) parent = f; }
  if (!parent) parent = DriveApp.getRootFolder();
  const it = parent.getFoldersByName('Cash Expense Receipts');
  return it.hasNext() ? it.next() : parent.createFolder('Cash Expense Receipts');
}
function expense_(d) {
  const clean = function (v) { v = String(v == null ? '' : v).trim(); return /^[=+\-@]/.test(v) && !/^-?\d/.test(v) ? "'" + v : v; };
  const amt = Number(String(d.amount || '').replace(/[$,]/g, ''));
  if (!(amt > 0)) return { ok: false, error: 'Amount must be more than 0' };
  if (!String(d.reason || '').trim()) return { ok: false, error: 'Reason / bill note required' };
  if (/vendor/i.test(String(d.type || ''))) return { ok: false, error: 'Vendor expenses are not logged here' };
  let link = '';
  if (d.photo && /^data:image\/(jpeg|png|webp);base64,/.test(d.photo)) {
    const m = d.photo.match(/^data:(image\/\w+);base64,(.*)$/);
    const name = [d.date, String(d.store || '').replace('Thomasville ', ''), amt.toFixed(2), String(d.paid_to || '').slice(0, 30)].join(' ').trim() + '.jpg';
    const file = receiptFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
    link = file.getUrl();
  }
  const sh = expTab_();
  sh.appendRow([new Date(), clean(d.date), clean(d.store), clean(d.cashier), amt, clean(d.type), clean(d.paid_to), clean(d.reason), link, '']);
  return { ok: true, row: sh.getLastRow(), photo: link };
}
function expenseRows_(p) {
  const sh = SpreadsheetApp.openById(STORE_CLOSE_ID).getSheetByName('Expenses');
  if (!sh || sh.getLastRow() < 2) return [];
  const last = sh.getLastRow(), start = Math.max(2, last - 199), keys = ['_ts', 'date', 'store', 'cashier', 'amount', 'type', 'paid_to', 'reason', 'photo', '_mnotes'];
  let rows = sh.getRange(start, 1, last - start + 1, keys.length).getDisplayValues().map(function (r) { const o = {}; keys.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  if (p.store) rows = rows.filter(function (o) { return o.store === p.store; });
  return rows.reverse().slice(0, Math.min(parseInt(p.limit, 10) || 50, 200));
}
