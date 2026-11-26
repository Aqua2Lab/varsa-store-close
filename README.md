# varsa-store-close

Varsa Group LLC nightly store close form and Manager Tools.

- Manager Tools: https://aqua2lab.github.io/varsa-store-close/manager-tools/
- Staff schedule: https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule.html
- Employee view (one person, phone): https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule_view.html?name=

The schedule page matches the other Manager Tools screens and posts to the same Cashier Tools Intake Apps Script. Paste **`manager-tools/Code.gs`** into that project. Do not paste `cashier-tools/Code.gs` over it. That older file does not include expenses or scheduling.

Until the script below is redeployed, the schedule page runs in demo mode in the browser (sample staff, not the Google Sheet).

## Redeploy Apps Script (Manage deployments > Edit > New version)

This keeps the existing web app URL (`manager-tools/config.js` `WEB_APP_URL`).

1. Open [Varsa Cashier Tracker](https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit) and go to **Extensions > Apps Script**.
2. Replace the project script with the full text of `manager-tools/Code.gs`. Save.
3. **Deploy > Manage deployments**.
4. Pencil **Edit** on the deployment that matches the `/exec` URL in `config.js`.
5. **Version > New version**, then **Deploy**. Do not create a second web app.
6. Reload the `/exec` URL. The JSON includes `"schedule": 1` when this version is live.

The first save creates tabs `Schedule_Staff`, `Schedule_Shifts`, and `Schedule_Manager`. Optional script property `MANAGER_PIN` gates the full schedule the same way it gates Store Close and Cashier Activity. The employee link does not use the PIN.

More detail, including the sheet columns and `node manager-tools/schedule.test.js`, is in `manager-tools/README.md`.
