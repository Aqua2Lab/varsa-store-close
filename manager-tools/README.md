# Varsa Group LLC · Manager Tools
Hosted at https://aqua2lab.github.io/varsa-store-close/manager-tools/
Backend: the same "Cashier Tools Intake" Apps Script as Cashier Tools.
Paste **manager-tools/Code.gs** when you redeploy. It is the live script (cashier forms, manager forms, expenses, and the staff schedule). `cashier-tools/Code.gs` does not include the schedule.
- Reports (read only): store_close.html (Store Close Log > Entries), cashier_activity.html (Cashier Tools tabs)
- Forms write new tabs in the "Varsa Cashier Tools" sheet; each shows a scrollable Recent entries table.
- Optional: Script Property MANAGER_PIN locks report reads and the schedule editor behind a PIN. The phone schedule link (`schedule_view.html?name=...`) stays open so a person can see only their own shifts.

## Staff schedule
- Editor: https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule.html
- One person’s phone view: https://aqua2lab.github.io/varsa-store-close/manager-tools/schedule_view.html?name=First%20Last
- Demo (nothing is written to the sheet): add `?demo=1`

Week, Month, Year, and Scheduled list all read what is already saved. Week is the editor. Month lists each day’s names. Year summarizes every week. Scheduled list filters by dates, store, and person and can be printed.

There was no employee list in this repo (no Employees tab, no onboarding or direct-deposit roster). The schedule creates an **Employees** tab on the Varsa Cashier Tracker sheet and that tab is the only employee database. The manager maintains it.

| Name | Role | Home Store | Phone | Status |
|---|---|---|---|---|
| Jonathan Cowan | manager | Both stores | | Active |
| A cashier | cashier | Thomasville Chevron | | Active |

- **Role** is `cashier` or `manager`.
- **Status** must be `Active` (any capitalization, extra spaces ignored). Anything else is inactive.
- Dropdowns list only Active cashiers (shift grid) or Active managers (manager section). On-call lines list every Active employee and show the home store.
- A shift already saved for someone who is now inactive still shows, with an inactive flag. New picks have to be Active people from the list. Names are never typed.

Other tabs the script creates:

- **Schedule_Shifts** — week start, date, store, shift name, start, end, employee, notes. Cashier shifts and store on-call lines (On-call 1, On-call 2, …) are stored by date.
- **Schedule_Manager** — date, employee, start time, end time, notes, kind (`shift` or `oncall`). Salary hours. They are not part of the hourly budget.
- **Schedule_Settings** — `base_pay_rate`, dollars per hour. The schedule page starts at $10.00 and the Save rate button writes this cell.

Budget hours are one person for every hour the store is open. Chevron is 24 hours a day (168 a week, $1,680 at $10). OutRun is 5:00 AM to midnight, 19 hours a day (133 a week, $1,330 at $10). Change those numbers in `config.js` (`STORE_HOURS` and `SHIFT_TEMPLATES`). On-call lines are extra scheduled hours. Over budget is shown in amber.

### Redeploy the Apps Script (same web address)
1. Open the Varsa Cashier Tracker sheet → **Extensions → Apps Script**.
2. Replace the project code with `manager-tools/Code.gs` from this repo. Save.
3. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.**
4. Do not create a second deployment. The `/exec` URL in `config.js` stays the same.
5. Reload the schedule page. The Employees tab appears the first time the page loads. Add people, set Status to Active, then reload.
