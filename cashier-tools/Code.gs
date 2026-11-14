/**
 * Varsa GROUP LLC - Cashier Tracker web app
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

const TEXT_KEYS = ['upc']; // keep leading zeros

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
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

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.form) {
    const spec = SCHEMA[p.form];
    if (!spec) return out_({ ok: false, error: 'Unknown form' }, p.callback);
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(spec.tab);
    const n = Math.min(parseInt(p.limit, 10) || 10, 200);
    let rows = [];
    if (sh && sh.getLastRow() > 1) {
      const last = sh.getLastRow(), start = Math.max(2, last - 199);
      rows = sh.getRange(start, 1, last - start + 1, spec.cols.length).getDisplayValues()
        .map(function (r) { const o = {}; spec.cols.forEach(function (k, i) { o[k] = r[i]; }); return o; });
      if (p.store) rows = rows.filter(function (o) { return o.store === p.store; });
      rows = rows.reverse().slice(0, n);
    }
    return out_({ ok: true, form: p.form, rows: rows }, p.callback);
  }
  return json_({ ok: true, app: 'Varsa Cashier Tracker', forms: Object.keys(SCHEMA), time: new Date().toISOString() });
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
