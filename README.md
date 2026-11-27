# varsa-store-close

Varsa Group LLC nightly store close form and Manager Tools.

- Home (PIN gate): https://aqua2lab.github.io/varsa-store-close/hub.html
- Manager Tools: https://aqua2lab.github.io/varsa-store-close/manager-tools/

## Home page PIN

The home page and the Manager Tools index ask for a PIN. This is a convenience gate on a static site, not real security. The pages, the link list, and the hash file are all public. Anyone who knows a page address can still open it. The nightly store close and the cashier tool pages do not ask for a PIN.

The PINs are not stored. `auth-config.js` holds a salt and a SHA-256 hash for the manager and for the cashier. The hashes in the repo are placeholders, so no PIN works until you replace them.

A hash is SHA-256 of the UTF-8 text `salt + ":" + pin`. Generate a pair with a 4 to 8 digit PIN:

```
node scripts/pin-hash.js 1234
```

`1234` in that example is only the shape of the command. Paste the printed `salt` and `hash` into `auth-config.js` under `manager` or `cashier`. Do not commit the PIN. The manager PIN shows every link. The cashier PIN shows cashier tools, till close, nightly store close, the cashier handbook, and My Schedule. A login is remembered on that browser for 12 hours. Log out clears it. Five wrong tries pause the keypad for 60 seconds.
- Staff schedule: https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule.html
- Employee view (one person, phone): https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule_view.html?name=

The schedule page matches the other Manager Tools screens and posts to the same Cashier Tools Intake Apps Script. Paste **`manager-tools/Code.gs`** into that project. Do not paste `cashier-tools/Code.gs` over it. That older file does not include expenses or scheduling.

Add `?demo=1` to the schedule address to try it on this computer without the Google Sheet.

## Redeploy Apps Script (Manage deployments > Edit > New version)

This keeps the existing web app URL (`manager-tools/config.js` `WEB_APP_URL`).

1. Open [Varsa Cashier Tracker](https://docs.google.com/spreadsheets/d/1K1bADx_bBnS2_Rfe8keggyUvmtMNxti1NXcagGuLJ3U/edit) and go to **Extensions > Apps Script**.
2. Replace the project script with the full text of `manager-tools/Code.gs`. Save.
3. **Deploy > Manage deployments**.
4. Pencil **Edit** on the deployment that matches the `/exec` URL in `config.js`.
5. **Version > New version**, then **Deploy**. Do not create a second web app.
6. Reload the `/exec` URL. The JSON includes `"schedule": true` when this version is live.

The first load creates tabs `Employees`, `Schedule_Shifts`, `Schedule_Manager`, and `Schedule_Settings`. A person shows in the dropdowns only when Status is Active and Role is cashier or manager. Optional script property `MANAGER_PIN` gates the full schedule the same way it gates Store Close and Cashier Activity. The employee phone link does not use the PIN.

Open hours and shift times are edited in `manager-tools/config.js`. The base pay rate starts at $10.00 and is saved on `Schedule_Settings`. More detail is in `manager-tools/README.md`. Check the date math with `node manager-tools/schedule.test.js`.
