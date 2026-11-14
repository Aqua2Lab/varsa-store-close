# Varsa Cashier Tools (Thomasville Chevron & OutRun)

Six quick forms that cashiers open from desktop shortcuts. Every answer goes into its own column in the
**Varsa Cashier Tracker** Google Sheet (Drive: Varsa Group LLC > Daily Operations):
https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit

| Form | File | Sheet tab |
|---|---|---|
| Home menu | index.html | n/a |
| Product Issue (won't scan, deal missing, wrong price, no tag) | product_issue.html | Product Issues |
| Supply Request (bags, rubber bands, cleaning, paper) | supply_request.html | Supply Requests |
| Low Stock (for ordering) | low_stock.html | Low Stock |
| Start of Shift checklist | shift_checklist.html | Shift Checklist |
| Till Close (+ 11 PM store close) | till_close.html | Till Close |
| Fuel Price Change (MPC notice) | fuel_price.html | Fuel Price Change |

Shared files: `config.js` (settings), `styles.css` (look), `app.js` (follow-up questions, validation, sending).
Follow-up questions appear only when they apply. Questions that stay hidden are saved blank.

## 1. Deploy the Apps Script (one time)
1. Open the Varsa Cashier Tracker sheet, then go to **Extensions > Apps Script**.
2. Replace the code with `Code.gs` and save.
3. Optional: run `testPost` once to approve permissions. It adds a test row to Supply Requests, which you can delete.
4. Go to **Deploy > New deployment > Web app**. Set Execute as **Me** and Who has access **Anyone**. Deploy.
5. Copy the `/exec` URL and paste it into `config.js`:
   `const WEB_APP_URL = 'https://script.google.com/macros/s/XXXX/exec';`
6. To check it, open the /exec URL in a browser. It should show `{"ok":true,...}`.

If you change Code.gs later, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same.

## 2. Put the forms on the store computer
Option A (simplest): copy this whole folder to the store computer, for example `C:\VarsaTools\`, and keep all files together.
Option B (hosted): upload the folder to any static host (GitHub Pages, Netlify, Google Sites embed) and use that URL.

## 3. Desktop shortcuts
- Windows: right-click the desktop and choose **New > Shortcut**. For the location, enter the hosted URL
  (for example `https://…/index.html`) or the file path (`C:\VarsaTools\index.html`). Name it **Cashier Tools**.
- Add more shortcuts if you want: `product_issue.html` as "Report Product Issue", `supply_request.html` as
  "Supply Request", `low_stock.html` as "Low Stock", `till_close.html` as "Till Close", and so on.
- To give a shortcut an icon: in Chrome, open the page, then go to **⋮ > Cast, save and share > Create shortcut**
  and tick "Open as window".

The forms remember the cashier name and store on each computer (localStorage). Cashiers only type their name the first time.

## 4. Where data lands, and manager follow-up
- Each submission adds a row with a timestamp in Central Time.
- Product Issues, Supply Requests, and Low Stock start with **Status = Open**. Change it to **Done** when the issue is
  handled, and use **Manager Notes** for follow-up. Filters are on every tab.
- Till Close has **ESM Verified** (Yes / No - Short / No - Over) for the morning check.
- Fuel Price Change records the MPC notice time, the finish time, and who did it. If any step isn't done,
  the form asks for a reason and tells them to call Varun (2nd) or Sanchari (backup).
