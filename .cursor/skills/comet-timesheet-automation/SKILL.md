---
name: comet-timesheet-automation
description: Automates COMET timesheet web form entry for a new shift and non-project tasks using provided element IDs (View Shift dropdown, Shift Date/Time, Register Shift, Add Task grid). Use when the user asks to automate COMET timesheets, register a new shift, add Break + Internal calls/Meeting tasks, or mentions element IDs like ctl00_cphMaster_cmbCurrentShift / txtShiftDate / cmdCreateMyShift.
---

# COMET Timesheet Automation (Browser Assistant)

## Operating rules

- Use **element IDs directly** for selecting/reading/setting values.
- Prefer direct input value setting / typing; **do not use the calendar widget**.
- Take screenshots **only when needed** to diagnose a mismatch (missing success text, rows not appearing, totals wrong, unexpected modal/alert).
- If any hard failure condition triggers, **stop and report what was observed** (exact text values from the page).

## Workflow

### Part 1 — Determine `TARGET_DATE`

1. Read the current value/options of the **View Shift** dropdown `ctl00_cphMaster_cmbCurrentShift` (`<select>`).
2. Extract the **top / most-recent option’s visible text** and parse the **last filled date** from it.
   - Parse using a strict date match (prefer `MM/DD/YYYY`). If multiple dates appear, use the one that corresponds to the most-recent/selected shift.
3. Compute the next date:
   - If last date was **Mon–Thu** → add **1** calendar day
   - If last date was **Fri** → add **3** calendar days (to Monday)
4. Skip Indian public holidays:
   - If computed date is an Indian public holiday, advance by **1** day until it is not.
   - Holiday source: use an authoritative public holiday list for **India + the computed year** (government / major calendar provider). Cache the list for the session to avoid repeated fetches.
5. Store as `TARGET_DATE` in **MM/DD/YYYY**.

### Part 2 — Register shift

1. Clear the View Shift dropdown:
   - Set `ctl00_cphMaster_cmbCurrentShift` value to `""` (blank / empty option).
2. Fill Shift Date:
   - Focus `ctl00_cphMaster_txtShiftDate` (`<input>`), type `TARGET_DATE`, press `Tab`.
   - Verify `ctl00_cphMaster_txtShiftStartDate` and `ctl00_cphMaster_txtShiftEndDate` auto-populate (non-empty).
3. Set times:
   - Set `ctl00_cphMaster_txtShiftStartTime` → `12:00`
   - Set `ctl00_cphMaster_txtShiftEndTime` → `21:00`
4. Register:
   - Click `ctl00_cphMaster_cmdCreateMyShift`
   - Wait ~2s for the UI to update
   - Read `ctl00_cphMaster_lblShiftInfo` and confirm it contains: `Shift data inserted successfully`
5. Overlap warning handling (non-fatal):
   - If a warning indicates overlap / already exists, refresh `ctl00_cphMaster_cmbCurrentShift` options and confirm the shift exists for `TARGET_DATE` before continuing.

### Part 3 — Add Break task (non-project)

Notes:
- `ctl00_cphMaster_radNonProjectType` is auto-selected after shift registration — **do not click it**.

1. Set task type:
   - Set `ctl00_cphMaster_cmbTaskList` → value `1` (Break)
2. Set efforts:
   - Set `ctl00_cphMaster_txtTotalEfforts` → `01:00`
3. Add:
   - Click `ctl00_cphMaster_cmdAddTask`
   - Wait for a **new row** to appear in `ctl00_cphMaster_grdTaskDetails` (`<table>`), up to 5s.
   - If no row appears within 5s: click Add Task **once more** and wait again up to 5s.

### Part 4 — Add Internal calls / Meeting task (non-project)

1. Set task type:
   - Set `ctl00_cphMaster_cmbTaskList` → value `45` (Internal calls, Meeting)
2. Set efforts:
   - Set `ctl00_cphMaster_txtTotalEfforts` → `08:00`
3. Add:
   - Click `ctl00_cphMaster_cmdAddTask`
   - Wait for the **second row** to appear in `ctl00_cphMaster_grdTaskDetails` (up to 5s; retry once if needed).
4. Verify totals:
   - Read `ctl00_cphMaster_lblSummaryMiscHours`
   - Confirm it is exactly: `Total Non-Project Hours: 09:00`

### Optional — Submit

- If the user explicitly asks to submit, click `ctl00_cphMaster_cmdSubmitTimesheet` and verify success confirmation on-screen.

## Error handling (hard stops)

- If `ctl00_cphMaster_lblShiftInfo` does **not** contain `Shift data inserted successfully` after registering:
  - Take a screenshot (if helpful), then stop and report the label text and any visible warning/error.
- If a task row does not appear in `ctl00_cphMaster_grdTaskDetails` within the retry policy:
  - Take a screenshot (if helpful), then stop and report what the table shows.
- If `ctl00_cphMaster_lblSummaryMiscHours` is not `Total Non-Project Hours: 09:00`:
  - Stop and alert the user with the observed value before proceeding.
