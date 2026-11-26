# Varsa Group LLC · Manager Tools

Hosted at https://aqua2lab.github.io/varsa-store-close/manager-tools/

Backend: one Apps Script web app, "Cashier Tools Intake". The file to paste is **`manager-tools/Code.gs`** (this folder). It serves Cashier Tools forms, Manager Tools forms, expenses, and the staff schedule. `cashier-tools/Code.gs` is an older copy. Do not paste that file over the live project or you will drop expenses and scheduling.

- Reports (read only): `store_close.html` (Store Close Log > Entries), `cashier_activity.html` (Cashier Tools tabs)
- Forms write tabs in the Varsa Cashier Tracker sheet. Each form page shows a scrollable Recent entries table.
- Staff schedule: `schedule.html` (editors) and `schedule_view.html?name=...` (one person, phone friendly)
- Optional script property `MANAGER_PIN` locks Store Close, Cashier Activity, and the full schedule load/save. The employee view stays open and returns only that person's shifts.

## Staff schedule

`schedule.html` is the week grid (Monday–Sunday) for Thomasville Chevron and Thomasville OutRun. Cashiers are one person per shift per store. Jonathan Cowan's hours are a separate From/To block under the grid, plus an optional On call row. Shift names and hours live in the `SHIFT_STORES` block at the top of `schedule.js`.

Until `Code.gs` is redeployed, the page opens in **demo mode** and keeps a sample week in the browser only. It does not write the Google Sheet. Use **Use the live sheet** after the redeploy below.

Tabs the script creates on the first save, in the Varsa Cashier Tracker spreadsheet:

| Tab | Columns |
|---|---|
| Schedule_Staff | Name, Role (`cashier` or `manager`), Home Store, Phone, Active (`Yes`/`No`) |
| Schedule_Shifts | Week Start, Date, Store, Shift Name, Start, End, Employee, Notes |
| Schedule_Manager | Date, Employee, Start Time, End Time, Notes, Kind (`day` or `oncall`), Week Start |

`Kind` and `Week Start` on the manager tab are extra columns so on-call rows and week replaces stay separate from the day hours.

Check the logic without the sheet:

```bash
node manager-tools/schedule.test.js
```

Open `schedule.html?demo=1` to click through the grid with the sample week.

## Redeploy the Apps Script (same URL)

Do this after any edit to `manager-tools/Code.gs`, including the staff schedule. **Manage deployments > Edit > New version** keeps the `/exec` URL already in `config.js`. A brand-new deployment would change the URL and every page would miss the sheet.

1. Open the spreadsheet [Varsa Cashier Tracker](https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit).
2. **Extensions > Apps Script**.
3. Select all of the script in the editor and replace it with the full contents of `manager-tools/Code.gs`. Save.
4. **Deploy > Manage deployments**.
5. On the deployment whose Web app URL matches `WEB_APP_URL` in `manager-tools/config.js`, click the pencil (**Edit**).
6. **Version > New version**. Description example: `Staff schedule`.
7. Execute as **Me**, Who has access **Anyone**. Click **Deploy**. The URL does not change.
8. Open that `/exec` URL in a browser. The JSON should include `"schedule": 1`.

Optional PIN (same property the other reports already use):

1. Apps Script **Project Settings** (gear) > **Script properties**.
2. Property `MANAGER_PIN`, value the pin managers should type.
3. Loading or saving the full schedule then asks for it (the browser remembers it on that device). `schedule_view.html` does not ask, and it does not return phone numbers or anyone else's shifts.

The three schedule tabs appear the first time someone saves a week. You do not create them by hand.
