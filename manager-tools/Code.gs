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
 *
 * Staff schedule (same deployment, same URL): after editing this file use
 * Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 * Do not create a second web app. config.js already has the /exec URL.
 * New tabs on this sheet: Employees, Schedule_Shifts, Schedule_Manager, Schedule_Settings.
 *
 * Invoice Upload, Check Upload, Item Issues, and Voids read and write
 * "Varsa Invoices & Checks Log" (DOCS_LOG_ID). The pages call
 * ?docs=invoice&limit=50&callback= so the reply must be JSONP, not the catalog JSON.
 * After pasting this file, Deploy > Manage deployments > Edit > New version.
 * Reload the /exec URL. The JSON includes "docs": true when this version is live.
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
    if (data.form === 'doc') return json_(docsSave_(data));
    if (data.form === 'doc_comment') return json_(docsComment_(data));
    if (data.form === 'expense') return json_(expense_(data));
    if (data.form === 'schedule_save' || data.form === 'schedule_settings') return json_(schedulePost_(data));
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
// ?action=employees&callback=   active employees (name, role, home_store) + base pay rate
// ?action=schedule&from=&to=&callback=   saved shifts and manager rows in a date range
// ?action=myschedule&name=&from=&to=&callback=   one person's rows (phone view, no PIN)
// ?docs=invoice|check|item_issue|void_ns&store=&limit=&id=&callback=   Invoices & Checks Log, JSONP
// Optional: set Script Property MANAGER_PIN to require &pin= on the manager reads and schedule saves.
// myschedule stays open so a cashier can open their phone link.
const STORE_CLOSE_ID = '149QWdotKvCoGT3gUosi_-oqPSdMeqT3tKH6yI5UE548'; // "Varsa Store Close Log" (read only)
const CASHIER_FORMS = ['till_close', 'product_issue', 'supply_request', 'low_stock', 'shift_checklist', 'fuel_price'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.docs) return out_(docsGet_(p), p.callback);
    if (p.action === 'employees' || p.action === 'schedule' || p.action === 'myschedule') return scheduleGet_(p);
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
  return json_({ ok: true, app: 'Varsa Cashier Tracker', forms: Object.keys(SCHEMA), schedule: true, docs: true, time: new Date().toISOString() });
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


// ===== Invoices & Checks Log =====
// Invoice Upload, Check Upload, Product Issue, and Void / No-Sale call
// ?docs=<kind>&limit=&store=&id=&callback= and expect JSONP {ok:true, rows:[...]}.
// Rows live in "Varsa Invoices & Checks Log", not the Cashier Tracker sheet.
// Files go to Drive › Varsa Group LLC › <folder>. Column order matches the sheet.
const DOCS_LOG_ID = '19GLxvBXecQKYmpYC83m0F0JAAI8w7YGfZRml0WAXiu0';
const DOCS_PARENT_FOLDER_ID = '1ReqBmblNlJmxpU0_jbLxrNEJEu8w4xAt'; // Drive › Varsa Group LLC
const DOCS = {
  invoice: {
    tab: 'Invoices', folder: 'Invoices', who: 'uploaded_by',
    keys: ['_ts', '_id', 'store', 'uploaded_by', 'billed_to', 'vendor', 'invoice_no', 'invoice_date', 'due_date', 'subtotal', 'tax', 'total', 'terms', 'details_ok', 'missing', '_file', '_comments', '_status', 'category', 'reimburse', 'reimburse_to', 'paid_with', '_reimb_status']
  },
  check: {
    tab: 'Checks', folder: 'Checks', who: 'issued_by',
    keys: ['_ts', '_id', 'store', 'issued_by', 'check_no', 'check_date', 'amount', 'vendor', 'vendor_phone', 'invoice_no', '_file', '_comments', '_status']
  },
  item_issue: {
    tab: 'Item Issues', folder: 'Item Issues', who: 'cashier',
    keys: ['_ts', '_id', 'store', 'cashier', 'problem', 'item', 'upc', 'location', 'shelf_price', '_file', '_comments', '_status', 'qty_on_hand', 'vendor', 'urgency']
  },
  void_ns: {
    tab: 'Voids & No-Sales', folder: 'Voids & No-Sales', who: 'cashier',
    keys: ['_ts', '_id', 'store', 'cashier', 'type', 'reason', 'slip_phone', 'slip_time', '_file', '_comments', '_status']
  }
};
const DOCS_TEXT_KEYS = { invoice_no: 1, upc: 1, check_no: 1 };
const DOCS_NUM_KEYS = { subtotal: 1, tax: 1, total: 1, amount: 1, shelf_price: 1, qty_on_hand: 1 };

function docsGet_(p) {
  const spec = DOCS[p.docs];
  if (!spec) return { ok: false, error: 'Unknown log' };
  const sh = SpreadsheetApp.openById(DOCS_LOG_ID).getSheetByName(spec.tab);
  if (!sh || sh.getLastRow() < 2) return { ok: true, docs: p.docs, rows: [] };
  const last = sh.getLastRow();
  const width = spec.keys.length;
  let rows = sh.getRange(2, 1, last - 1, width).getDisplayValues().map(function (r) {
    const o = {};
    spec.keys.forEach(function (k, i) { o[k] = r[i] == null ? '' : String(r[i]).replace(/^'/, ''); });
    return o;
  }).filter(function (o) { return o._id; });
  if (p.id) rows = rows.filter(function (o) { return o._id === String(p.id); });
  else if (p.store) rows = rows.filter(function (o) { return o.store === String(p.store); });
  rows.reverse();
  const n = Math.min(parseInt(p.limit, 10) || 50, 500);
  return { ok: true, docs: p.docs, rows: rows.slice(0, n) };
}

function docsTz_() {
  return SpreadsheetApp.openById(DOCS_LOG_ID).getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Chicago';
}
function docsTab_(spec) {
  const sh = SpreadsheetApp.openById(DOCS_LOG_ID).getSheetByName(spec.tab);
  if (!sh) throw new Error(spec.tab + ' tab not found');
  return sh;
}
function docsClean_(v) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  return (/^[=+\-@]/.test(v) && !/^-?\d/.test(v)) ? "'" + v : v;
}
function docsLine_(by, text, tz) {
  return '[' + Utilities.formatDate(new Date(), tz, 'M/d h:mm a') + '] ' + by + ': ' + text;
}
function docsCommentLog_(tab, id, by, text, tz, token) {
  const ss = SpreadsheetApp.openById(DOCS_LOG_ID);
  let sh = ss.getSheetByName('Comments');
  if (!sh) {
    sh = ss.insertSheet('Comments');
    sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Log', 'Entry ID', 'By', 'Comment']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const note = token ? text + ' {t' + Utilities.formatDate(new Date(), 'GMT', 'yyyyMMddHHmmss') + '}' : text;
  sh.appendRow([new Date(), tab, id, by, docsClean_(note)]);
}
function docsFolder_(name) {
  const parent = DriveApp.getFolderById(DOCS_PARENT_FOLDER_ID);
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function docsFileName_(d, index, count, ext) {
  const store = String(d.store || '').replace(/^Thomasville\s+/, '');
  const cat = String(d.category || '').replace(/\s*\/\s*/g, ' - ');
  const when = String(d.invoice_date || d.check_date || d.slip_time || '').slice(0, 10);
  const bits = [when, store, cat, d.vendor || d.item || '', d.invoice_no || d.check_no || '', d.id];
  let name = bits.map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' ');
  name = name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (count > 1) name += ' p' + (index + 1);
  if (name.length > 160) name = name.slice(0, 160).trim();
  return name + ext;
}
function docsStoreFiles_(spec, d) {
  const files = Array.isArray(d.files) ? d.files.slice(0, 10) : [];
  if (!files.length) return [];
  const folder = docsFolder_(spec.folder);
  const links = [];
  files.forEach(function (f, i) {
    if (!f || !f.data || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(String(f.mime || ''))) return;
    const bytes = Utilities.base64Decode(String(f.data));
    if (!bytes || bytes.length > 15 * 1024 * 1024) return;
    const ext = f.mime === 'application/pdf' ? '.pdf' : f.mime === 'image/png' ? '.png' : f.mime === 'image/webp' ? '.webp' : '.jpg';
    const file = folder.createFile(Utilities.newBlob(bytes, f.mime, docsFileName_(d, i, files.length, ext)));
    try { file.setDescription([d.id, spec.tab, d.store].filter(Boolean).join(' | ')); } catch (err) {}
    links.push(file.getUrl());
  });
  return links;
}
function docsCell_(k, d, links, commentCell) {
  if (k === '_ts') return new Date();
  if (k === '_id') return docsClean_(d.id);
  if (k === '_file') return links.join('\n');
  if (k === '_comments') return commentCell;
  if (k === '_status') return 'Open';
  if (k === '_reimb_status') return d.reimburse === 'Yes' ? 'Pending' : 'N/A';
  let v = d[k];
  if (v == null) return '';
  v = String(v).trim();
  if (!v) return '';
  if (DOCS_TEXT_KEYS[k]) return "'" + v.replace(/^'/, '');
  if (/^[=+\-@]/.test(v) && !/^-?\d/.test(v)) return "'" + v;
  if (DOCS_NUM_KEYS[k] && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function docsSave_(d) {
  const spec = DOCS[d.kind];
  if (!spec) return { ok: false, error: 'Unknown log' };
  const id = String(d.id || '').trim();
  if (!/^([A-Z]{3})-\d{8}-\d{6}-\d{4}$/.test(id)) return { ok: false, error: 'Bad id' };
  const tz = docsTz_();
  const by = docsClean_(d[spec.who] || '');
  const text = String(d.comment || '').trim();
  const links = docsStoreFiles_(spec, d);
  const commentCell = text ? docsLine_(by, text, tz) : '';
  if (text) docsCommentLog_(spec.tab, id, by, text, tz, false);
  const sh = docsTab_(spec);
  sh.appendRow(spec.keys.map(function (k) { return docsCell_(k, d, links, commentCell); }));
  return { ok: true, id: id, row: sh.getLastRow() };
}
function docsComment_(d) {
  const spec = DOCS[d.kind];
  if (!spec) return { ok: false, error: 'Unknown log' };
  const id = String(d.id || '').trim();
  const by = docsClean_(d.by);
  const text = String(d.comment || '').trim();
  if (!id || !by || !text) return { ok: false, error: 'Name and comment are required' };
  const sh = docsTab_(spec);
  const last = sh.getLastRow();
  const idCol = spec.keys.indexOf('_id') + 1;
  const comCol = spec.keys.indexOf('_comments') + 1;
  let found = 0;
  if (last >= 2) {
    const ids = sh.getRange(2, idCol, last - 1, 1).getDisplayValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]).replace(/^'/, '') === id) { found = i + 2; break; }
    }
  }
  if (!found) return { ok: false, error: 'Entry not found' };
  const tz = docsTz_();
  const prev = String(sh.getRange(found, comCol).getValue() || '');
  const line = docsLine_(by, text, tz);
  sh.getRange(found, comCol).setValue(prev ? prev + '\n' + line : line);
  docsCommentLog_(spec.tab, id, by, text, tz, true);
  return { ok: true, id: id };
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


// ===== Staff schedule =====
// Employees is the one employee list. The manager maintains it.
// Status must be Active (any capitalization). Role must be cashier or manager.
// Only those rows are returned to the schedule dropdowns.
// Schedule_Shifts: one row per cashier shift or store on-call line, stored by date.
// Schedule_Manager: store-manager From/To (and optional manager on-call), not hourly budget.
// Schedule_Settings: base_pay_rate (dollars per hour). Default 10.
var SHIFT_HEADERS_ = ['Week Start', 'Date', 'Store', 'Shift Name', 'Start', 'End', 'Employee', 'Notes'];
var MGR_HEADERS_ = ['Date', 'Employee', 'Start Time', 'End Time', 'Notes', 'Kind'];
var SCHED_STORES_ = ['Thomasville Chevron', 'Thomasville OutRun'];

function schedPinOk_(p) {
  var pin = PropertiesService.getScriptProperties().getProperty('MANAGER_PIN');
  if (!pin) return true;
  return String((p && p.pin) || '') === String(pin);
}
function schedTz_() {
  return SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone() || 'America/Chicago';
}
function ensureSchedTab_(name, headers) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function ensureEmployees_() {
  var sh = ensureSchedTab_('Employees', ['Name', 'Role', 'Home Store', 'Phone', 'Status']);
  if (!sh.getRange('A1').getNote()) {
    sh.getRange('A1').setNote('Manager keeps this list. Role: cashier or manager. Status: Active or Inactive. Only Active people with those roles appear on the schedule. Home store is shown next to the name.');
  }
  return sh;
}
function ensureSettings_() {
  var sh = ensureSchedTab_('Schedule_Settings', ['Key', 'Value']);
  if (!sh.getRange('A1').getNote()) {
    sh.getRange('A1').setNote('base_pay_rate is dollars per hour for cashier shifts and store on-call lines. The schedule page edits this. Manager salary is not calculated from this rate. Store open hours live in manager-tools/config.js.');
  }
  if (sh.getLastRow() < 2) sh.appendRow(['base_pay_rate', 10]);
  return sh;
}
function normRate_(v) {
  var n = parseFloat(v);
  if (!isFinite(n) || n < 0 || n > 500) return null;
  return Math.round(n * 100) / 100;
}
function settingsRead_() {
  var sh = ensureSettings_();
  var rate = 10, last = sh.getLastRow();
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
      if (String(r[0] || '').trim() === 'base_pay_rate') {
        var n = normRate_(r[1]);
        if (n != null) rate = n;
      }
    });
  }
  return { base_pay_rate: rate };
}
function writeRate_(n) {
  var sh = ensureSettings_();
  var last = sh.getLastRow(), found = false;
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim() === 'base_pay_rate') {
        sh.getRange(i + 2, 2).setValue(n);
        found = true;
        break;
      }
    }
  }
  if (!found) sh.appendRow(['base_pay_rate', n]);
}
function normRole_(v) {
  var s = String(v || '').trim().toLowerCase();
  if (s === 'manager' || s === 'store manager' || s === 'mgr') return 'manager';
  if (s === 'cashier') return 'cashier';
  return '';
}
function employeesRead_() {
  var sh = ensureEmployees_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var out = [];
  sh.getRange(2, 1, last - 1, 5).getValues().forEach(function (r) {
    var name = String(r[0] || '').trim();
    if (!name) return;
    if (String(r[4] || '').trim().toLowerCase() !== 'active') return;
    var role = normRole_(r[1]);
    if (!role) return;
    out.push({ name: name, role: role, home_store: String(r[2] || '').trim() });
  });
  out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  return out;
}
function normDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, schedTz_(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim().replace(/^'/, '');
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
}
function cellDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, schedTz_(), 'yyyy-MM-dd');
  }
  var s = String(v == null ? '' : v).trim().replace(/^'/, '');
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  var m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return m2[3] + '-' + ('0' + m2[1]).slice(-2) + '-' + ('0' + m2[2]).slice(-2);
  return '';
}
function cellTime_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, schedTz_(), 'HH:mm');
  }
  if (typeof v === 'number' && isFinite(v)) {
    var mins = Math.round((v % 1) * 1440) % 1440;
    if (mins < 0) mins += 1440;
    return ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
  }
  return normTime_(v);
}
function normTime_(v) {
  var s = String(v == null ? '' : v).trim().replace(/^'/, '');
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  var hh = +m[1];
  if (hh === 24 && m[2] === '00') return '00:00';
  if (hh > 23 || +m[2] > 59) return '';
  return ('0' + hh).slice(-2) + ':' + m[2];
}
function mondayOfIso_(iso) {
  var p = iso.split('-');
  var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var day = dt.getUTCDay();
  var diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}
function text_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.charAt(0) === "'" ? s : "'" + s;
}
function clip_(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}
function readShifts_() {
  var sh = ensureSchedTab_('Schedule_Shifts', SHIFT_HEADERS_);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var out = [];
  sh.getRange(2, 1, last - 1, SHIFT_HEADERS_.length).getValues().forEach(function (r) {
    var date = cellDate_(r[1]);
    if (!date) return;
    out.push({
      week_start: cellDate_(r[0]) || mondayOfIso_(date),
      date: date,
      store: String(r[2] || '').replace(/^'/, '').trim(),
      shift_name: String(r[3] || '').replace(/^'/, '').trim(),
      start: cellTime_(r[4]),
      end: cellTime_(r[5]),
      employee: String(r[6] || '').replace(/^'/, '').trim(),
      notes: String(r[7] || '').replace(/^'/, '').trim()
    });
  });
  return out;
}
function readManagers_() {
  var sh = ensureSchedTab_('Schedule_Manager', MGR_HEADERS_);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var out = [];
  sh.getRange(2, 1, last - 1, MGR_HEADERS_.length).getValues().forEach(function (r) {
    var date = cellDate_(r[0]);
    if (!date) return;
    var kind = String(r[5] || '').replace(/^'/, '').trim().toLowerCase();
    out.push({
      date: date,
      employee: String(r[1] || '').replace(/^'/, '').trim(),
      start: cellTime_(r[2]),
      end: cellTime_(r[3]),
      notes: String(r[4] || '').replace(/^'/, '').trim(),
      kind: kind === 'oncall' ? 'oncall' : 'shift'
    });
  });
  return out;
}
function forceTextRow_(r, width, dateCols, timeCols) {
  var o = [];
  for (var i = 0; i < width; i++) {
    var s = '';
    if (dateCols.indexOf(i) !== -1) s = cellDate_(r[i]);
    else if (timeCols.indexOf(i) !== -1) s = cellTime_(r[i]);
    else s = String(r[i] == null ? '' : r[i]).replace(/^'/, '').trim();
    o.push(s ? "'" + s : '');
  }
  return o;
}
function rewriteByDate_(sh, width, dateCol, dateSet, newRows, dateCols, timeCols) {
  var last = sh.getLastRow();
  var keep = [];
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, width).getValues().forEach(function (r) {
      var dt = cellDate_(r[dateCol]);
      if (!dt || !dateSet[dt]) keep.push(forceTextRow_(r, width, dateCols, timeCols));
    });
  }
  var all = keep.concat(newRows);
  var oldN = Math.max(0, last - 1);
  if (oldN) sh.getRange(2, 1, oldN, width).clearContent();
  if (!all.length) return;
  sh.getRange(2, 1, all.length, width).setValues(all);
  if (all.length > 1) sh.getRange(2, 1, all.length, width).sort({ column: dateCol + 1, ascending: true });
}
function scheduleGet_(p) {
  if (p.action !== 'myschedule' && !schedPinOk_(p)) return out_({ ok: false, error: 'PIN required', pin: true }, p.callback);
  if (p.action === 'employees') {
    return out_({ ok: true, schedule: true, employees: employeesRead_(), base_pay_rate: settingsRead_().base_pay_rate }, p.callback);
  }
  var from = normDate_(p.from), to = normDate_(p.to);
  if (!from || !to) return out_({ ok: false, error: 'Use from and to dates.' }, p.callback);
  if (from > to) return out_({ ok: false, error: 'The start date is after the end date.' }, p.callback);
  var span = Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000);
  if (span > 400) return out_({ ok: false, error: 'Pick 400 days or fewer.' }, p.callback);
  var data = { ok: true, schedule: true, from: from, to: to, shifts: [], manager: [] };
  readShifts_().forEach(function (r) { if (r.date >= from && r.date <= to) data.shifts.push(r); });
  readManagers_().forEach(function (r) { if (r.date >= from && r.date <= to) data.manager.push(r); });
  if (p.action === 'myschedule') {
    var name = String(p.name || '').trim();
    if (!name) return out_({ ok: false, error: 'Add the employee name to the link.' }, p.callback);
    data.employee = name;
    data.shifts = data.shifts.filter(function (r) { return r.employee === name; });
    data.manager = data.manager.filter(function (r) { return r.employee === name; });
    return out_(data, p.callback);
  }
  data.base_pay_rate = settingsRead_().base_pay_rate;
  return out_(data, p.callback);
}
function schedulePost_(d) {
  if (!schedPinOk_(d)) return { ok: false, error: 'PIN required', pin: true };
  if (d.form === 'schedule_settings') {
    var rateOnly = normRate_(d.base_pay_rate);
    if (rateOnly == null) return { ok: false, error: 'Enter a pay rate from 0 to 500.' };
    writeRate_(rateOnly);
    return { ok: true, schedule: true, base_pay_rate: rateOnly };
  }
  return scheduleSave_(d);
}
function scheduleSave_(d) {
  var dateSet = {}, dates = [];
  (Array.isArray(d.dates) ? d.dates : []).forEach(function (x) {
    var n = normDate_(x);
    if (n && !dateSet[n]) { dateSet[n] = true; dates.push(n); }
  });
  if (!dates.length) return { ok: false, error: 'No dates to save.' };
  if (dates.length > 400) return { ok: false, error: 'Save 400 days or fewer at a time.' };
  var active = {};
  employeesRead_().forEach(function (e) { active[e.name] = e.role; });
  var existing = {};
  readShifts_().forEach(function (r) { if (dateSet[r.date] && r.employee) existing[r.employee] = true; });
  readManagers_().forEach(function (r) { if (dateSet[r.date] && r.employee) existing[r.employee] = true; });
  var bad = {};
  function allow(name, role) {
    if (!name) return true;
    if (active[name] && (!role || active[name] === role)) return true;
    if (existing[name]) return true;
    bad[name] = true;
    return false;
  }
  var shiftRows = [];
  (Array.isArray(d.shifts) ? d.shifts : []).forEach(function (s) {
    var date = normDate_(s.date);
    if (!date || !dateSet[date]) return;
    var store = String(s.store || '').trim();
    if (SCHED_STORES_.indexOf(store) === -1) return;
    var shiftName = clip_(s.shift_name, 40);
    if (!shiftName) return;
    var name = clip_(s.employee, 80);
    var oncall = /^on-call\s+\d+$/i.test(shiftName);
    if (!allow(name, oncall ? '' : 'cashier')) return;
    var start = normTime_(s.start), end = normTime_(s.end);
    if (oncall && !name && !start && !end && !clip_(s.notes, 500)) return;
    shiftRows.push([text_(mondayOfIso_(date)), text_(date), text_(store), text_(shiftName), text_(start), text_(end), text_(name), text_(clip_(s.notes, 500))]);
  });
  var mgrRows = [];
  (Array.isArray(d.manager) ? d.manager : []).forEach(function (s) {
    var date = normDate_(s.date);
    if (!date || !dateSet[date]) return;
    var name = clip_(s.employee, 80);
    var start = normTime_(s.start), end = normTime_(s.end), notes = clip_(s.notes, 500);
    if (!name && !start && !end && !notes) return;
    if (!allow(name, 'manager')) return;
    var kind = String(s.kind || '').toLowerCase() === 'oncall' ? 'oncall' : 'shift';
    mgrRows.push([text_(date), text_(name), text_(start), text_(end), text_(notes), text_(kind)]);
  });
  var badNames = Object.keys(bad);
  if (badNames.length) return { ok: false, error: 'These names are not active employees: ' + badNames.join(', ') };
  rewriteByDate_(ensureSchedTab_('Schedule_Shifts', SHIFT_HEADERS_), SHIFT_HEADERS_.length, 1, dateSet, shiftRows, [0, 1], [4, 5]);
  rewriteByDate_(ensureSchedTab_('Schedule_Manager', MGR_HEADERS_), MGR_HEADERS_.length, 0, dateSet, mgrRows, [0], [2, 3]);
  var rate = normRate_(d.base_pay_rate);
  if (rate != null) writeRate_(rate);
  return { ok: true, schedule: true, dates: dates.length, shifts: shiftRows.length, manager: mgrRows.length, base_pay_rate: rate != null ? rate : settingsRead_().base_pay_rate };
}
/** Run once from the Apps Script editor to create the schedule tabs. */
function setupSchedule() {
  ensureEmployees_();
  ensureSchedTab_('Schedule_Shifts', SHIFT_HEADERS_);
  ensureSchedTab_('Schedule_Manager', MGR_HEADERS_);
  ensureSettings_();
}
