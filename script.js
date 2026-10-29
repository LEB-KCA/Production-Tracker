/* =====================================================================
 * PRODUCTION TRACKER
 * ---------------------------------------------------------------------
 *  1.  Config & constants
 *  2.  Debug / logging
 *  3.  Helpers (DOM, storage, formatting)
 *  4.  State
 *  5.  Model (rows, rates, totals)
 *  6.  Persistence
 *  7.  Table rendering
 *  8.  Table events (delegated, attached once)
 *  9.  Task buttons (built-in / custom / special)
 * 10.  Dialogs
 * 11.  Overtime
 * 12.  Shift header (name, date, shift)
 * 13.  Screenshot
 * 14.  Tools (comma separator, clear all)
 * 15.  Calculator
 * 16.  Theme
 * 17.  Notepad
 * 18.  Startup
 *
 * DEBUGGING
 *   - Add ?debug to the URL, or run  ProductionTracker.debug(true)  in the console.
 *   - ProductionTracker.state       -> live app state
 *   - ProductionTracker.dump()      -> table of every row
 *   - ProductionTracker.validate()  -> list of data problems (empty = healthy)
 *   - ProductionTracker.resetStorage() -> wipe saved data and reload
 * ===================================================================== */
(() => {
    'use strict';

    /* =================================================================
     * 1. CONFIG & CONSTANTS
     * ================================================================= */

    const CONFIG = Object.freeze({
        baseMinutes: 480,
        itemsLeftRate: 0.88,          // time left / this rate = items left
        actualRate: '**',             // shown in Rate column for "actual time" tasks
        defaultShiftName: 'Keith Arcedes',
        maxSpecialInputs: 5,
        screenshot: {
            landscapeRowThreshold: 16, // table rows before "Auto" switches to landscape
            landscapeWidth: 1600,
            minFontSize: 8
        }
    });

    // Same key names as before, so existing saved data keeps working.
    const STORAGE_KEYS = Object.freeze({
        date: 'productionTrackerDate',
        shiftName: 'productionTrackerShiftName',
        data: 'productionTrackerData',
        overtime: 'productionTrackerOT',
        shift: 'productionTrackerShift',
        customTasks: 'productionTrackerCustomTasks',
        deletedTasks: 'productionTrackerDeletedTasks',
        screenshotLayout: 'productionTrackerScreenshotLayout',
        theme: 'productionTrackerTheme',
        notes: 'productionTrackerNotes'
    });
    const DEBUG_KEY = 'productionTrackerDebug';

    // One entry per built-in toggle button.
    //   id   = the button's data-task attribute in index.html
    //   key  = the internal task name used in rows / visibility
    //   rate / rows = defaults for the generated table rows
    const TASK_TOGGLES = [
        { id: 'Tag',     key: 'Tag',        rate: 1.2,   rows: 5, visible: false },
        { id: 'TagLite', key: 'TagLite',    rate: 1.0,   rows: 3, visible: false },
        { id: 'QCLite',  key: 'QC Lite',    rate: 0.42,  rows: 3, visible: false },
        { id: 'TagQC',   key: 'Tag QC',     rate: 0.88,  rows: 5, visible: true  },
        { id: 'ImageQC', key: 'Image',      rate: 0.073, rows: 3, visible: false },
        { id: 'FBP',     key: 'FBP Checks',                       visible: false },
        { id: 'Datadog', key: 'Datadog',                          visible: false }
    ];
    const TOGGLE_BY_ID = Object.fromEntries(TASK_TOGGLES.map(t => [t.id, t]));
    const BUILT_IN_KEYS = TASK_TOGGLES.map(t => t.key);

    const FBP_KEY = 'FBP Checks';
    const DATADOG_KEY = 'Datadog';
    const KNOWN_ROW_TYPES = ['subtotal', 'fbp', 'datadog', 'special'];
    const SCREENSHOT_LAYOUTS = ['auto', 'portrait', 'landscape'];
    const THEMES = ['midnight', 'forest', 'daylight', 'graphite'];

    /* =================================================================
     * 2. DEBUG / LOGGING
     * ================================================================= */

    const Log = (() => {
        const PREFIX = '[ProductionTracker]';
        let enabled = false;

        try {
            enabled =
                localStorage.getItem(DEBUG_KEY) === '1' ||
                /[?&]debug\b/.test(location.search);
        } catch (e) { /* storage unavailable */ }

        return {
            isEnabled: () => enabled,
            setEnabled(on) {
                enabled = !!on;
                try {
                    if (enabled) localStorage.setItem(DEBUG_KEY, '1');
                    else localStorage.removeItem(DEBUG_KEY);
                } catch (e) { /* ignore */ }
                console.info(PREFIX, `debug logging ${enabled ? 'ON' : 'OFF'}`);
            },
            debug: (...args) => { if (enabled) console.log(PREFIX, ...args); },
            warn: (...args) => console.warn(PREFIX, ...args),
            error: (...args) => console.error(PREFIX, ...args)
        };
    })();

    window.addEventListener('error', event => {
        Log.error(
            'Uncaught error:', event.message,
            `${event.filename}:${event.lineno}:${event.colno}`,
            event.error
        );
    });

    window.addEventListener('unhandledrejection', event => {
        Log.error('Unhandled promise rejection:', event.reason);
    });

    // Runs one startup step; a failure is logged and does not stop the rest.
    function safeInit(name, fn) {
        try {
            fn();
            Log.debug(`init ok: ${name}`);
        } catch (error) {
            Log.error(`init FAILED: ${name}`, error);
        }
    }

    /* =================================================================
     * 3. HELPERS
     * ================================================================= */

    const $ = id => document.getElementById(id);

    const Store = {
        getRaw(key) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                Log.warn(`Could not read "${key}"`, error);
                return null;
            }
        },
        setRaw(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                Log.error(`Could not save "${key}"`, error);
                return false;
            }
        },
        getJSON(key, fallback) {
            const raw = Store.getRaw(key);
            if (raw === null) return fallback;
            try {
                return JSON.parse(raw);
            } catch (error) {
                Log.warn(`Saved data in "${key}" is corrupt; ignoring it`, error);
                return fallback;
            }
        },
        setJSON(key, value) {
            return Store.setRaw(key, JSON.stringify(value));
        }
    };

    const toNumber = value => Number(value) || 0;

    // Number inputs show a value only when the user typed one;
    // 0 / empty shows nothing so "0" is just a placeholder.
    function numberDisplay(value) {
        return (value === 0 || value === '0' || value === null || value === undefined)
            ? ''
            : value;
    }

    function escapeHtml(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function makeRow(className, html) {
        const tr = document.createElement('tr');
        tr.className = className;
        tr.innerHTML = html;
        return tr;
    }

    /* =================================================================
     * 4. STATE  (the single source of truth)
     * ================================================================= */

    const state = {
        rows: [],                 // every table row, including hidden ones
        selectedOT: 0,            // overtime minutes
        visibility: Object.fromEntries(
            TASK_TOGGLES.map(t => [t.key, t.visible])
        ),                        // task name -> shown in table / counted in totals
        customTasks: {},          // name -> { rate, timeMode, actualTime }
        deletedBuiltIns: []       // built-in task keys the user removed
    };

    /* =================================================================
     * 5. MODEL
     * ================================================================= */

    function getDefaultRate(taskName) {
        const def = TASK_TOGGLES.find(t => t.key === taskName);
        return def && def.rate !== undefined ? def.rate : '';
    }

    function normalizeRate(timeMode, rate) {
        return timeMode === 'actual' ? CONFIG.actualRate : (Number(rate) || 1);
    }

    // items x rate, rounded to the nearest 5 minutes
    function calculateTime(items, rate) {
        return Math.round((toNumber(items) * toNumber(rate)) / 5) * 5;
    }

    function getTaskSettings(taskName) {
        return state.customTasks[taskName] || {
            rate: getDefaultRate(taskName) || 1,
            timeMode: 'rate',
            actualTime: 0
        };
    }

    function taskNameExists(name) {
        const lower = name.toLowerCase();
        return Object.keys(state.visibility).some(k => k.toLowerCase() === lower);
    }

    // ---- row factories ----

    function createTaskRow(taskName, { rate, timeMode = 'rate', actualTime = 0 } = {}) {
        return {
            task: taskName,
            merchant: '',
            items: '',
            time: timeMode === 'actual' ? actualTime : calculateTime('', rate),
            rate,
            timeMode,
            actualTime,
            status: 'WORKING',
            visible: true
        };
    }

    function createSubtotalRow(taskName) {
        return {
            type: 'subtotal',
            task: `TOTAL (${taskName})`,
            parent: taskName,
            visible: true
        };
    }

    // Older saved data has no "parent" field, so fall back to the label.
    function getSubtotalParent(row) {
        if (row.parent) return row.parent;
        const match = /^TOTAL \((.*)\)$/.exec(row.task || '');
        return match ? match[1] : row.task;
    }

    function buildDefaultRows() {
        const rows = [];

        Object.entries(state.customTasks).forEach(([name, settings]) => {
            state.visibility[name] = true;
            rows.push(createTaskRow(name, settings), createSubtotalRow(name));
        });

        TASK_TOGGLES.filter(t => t.rows).forEach(t => {
            for (let i = 0; i < t.rows; i++) {
                rows.push(createTaskRow(t.key, { rate: t.rate }));
            }
            rows.push(createSubtotalRow(t.key));
        });

        rows.push({
            type: 'datadog', task: 'FBP Data Dog Monitoring',
            items: '', time: '', visible: true
        });

        rows.push({
            type: 'fbp', task: FBP_KEY,
            merchant: '', items: '', time: '', visible: true
        });

        return rows;
    }

    function addCustomTask(name, rate, timeMode) {
        state.customTasks[name] = {
            rate: normalizeRate(timeMode, rate),
            timeMode: timeMode === 'actual' ? 'actual' : 'rate',
            actualTime: 0
        };
        state.visibility[name] = true;

        state.rows.push(createTaskRow(name, state.customTasks[name]));
        state.rows.push(createSubtotalRow(name));

        saveCustomTasks();
    }

    function addSpecialTask(name, fields) {
        state.rows.push({
            type: 'special',
            task: name,
            fields,
            values: fields.map(() => ''),
            visible: true
        });
        state.visibility[name] = true;
    }

    // ---- visibility ----

    // Which visibility entry controls this row?
    function visibilityKeyFor(row) {
        switch (row.type) {
            case 'fbp': return FBP_KEY;
            case 'datadog': return DATADOG_KEY;
            case 'subtotal': return getSubtotalParent(row);
            default: return row.task;     // normal and special rows
        }
    }

    function isRowEnabled(row) {
        const value = state.visibility[visibilityKeyFor(row)];
        return value === undefined ? true : value;
    }

    // ---- totals ----

    function calcSubtotal(taskName, field) {
        return state.rows.reduce((sum, r) => (
            !r.type && r.task === taskName && r.visible
                ? sum + toNumber(r[field])
                : sum
        ), 0);
    }

    // FBP / Datadog: time counts, items do not.
    // Special tasks: only inputs set to "Items" / "Time" count.
    function computeTotals() {
        let items = 0;
        let time = 0;

        state.rows.forEach(row => {
            if (row.type === 'subtotal' || !row.visible || !isRowEnabled(row)) return;

            if (row.type === 'special') {
                (row.fields || []).forEach((field, i) => {
                    const amount = toNumber(row.values && row.values[i]);
                    if (field.role === 'time') time += amount;
                    else if (field.role === 'items') items += amount;
                });
                return;
            }

            if (row.type !== 'fbp' && row.type !== 'datadog') {
                items += toNumber(row.items);
            }
            time += toNumber(row.time);
        });

        return { items, time };
    }

    function updateTotals() {
        const totals = computeTotals();

        const itemsEl = $('totalItems');
        const timeEl = $('totalTime');
        if (itemsEl) itemsEl.innerText = totals.items;
        if (timeEl) timeEl.innerText = totals.time;

        refreshSubtotalInputs();
        updateOvertimeDisplay(totals.time);
    }

    // Keep every "TOTAL (task)" row in sync while typing (no re-render).
    function refreshSubtotalInputs() {
        document.querySelectorAll('.subtotal-row').forEach(tr => {
            const addBtn = tr.querySelector('.add-row-btn-subtotal');
            if (!addBtn) return;

            const taskName = addBtn.dataset.task;
            const itemsInput = tr.querySelector('input.calc-items');
            const timeInput = tr.querySelector('input.calc-time');

            if (itemsInput) itemsInput.value = calcSubtotal(taskName, 'items');
            if (timeInput) timeInput.value = calcSubtotal(taskName, 'time');
        });
    }

    /* =================================================================
     * 6. PERSISTENCE
     * ================================================================= */

    function saveProductionData() {
        Store.setJSON(STORAGE_KEYS.data, state.rows);
        Store.setRaw(STORAGE_KEYS.overtime, String(state.selectedOT));

        const shiftSelector = $('shiftSelector');
        if (shiftSelector) Store.setRaw(STORAGE_KEYS.shift, shiftSelector.value);

        Log.debug('saved', { rows: state.rows.length, ot: state.selectedOT });
    }

    function saveCustomTasks() {
        const list = Object.entries(state.customTasks).map(([name, s]) => ({
            name,
            rate: normalizeRate(s.timeMode, s.rate),
            timeMode: s.timeMode === 'actual' ? 'actual' : 'rate',
            actualTime: 0
        }));
        Store.setJSON(STORAGE_KEYS.customTasks, list);
    }

    function loadCustomTasks() {
        state.customTasks = {};
        const saved = Store.getJSON(STORAGE_KEYS.customTasks, []);
        if (!Array.isArray(saved)) return;

        saved.forEach(task => {
            if (!task || !task.name) return;
            const timeMode = task.timeMode === 'actual' ? 'actual' : 'rate';
            state.customTasks[task.name] = {
                rate: normalizeRate(timeMode, task.rate),
                timeMode,
                actualTime: 0
            };
        });
    }

    function loadDeletedBuiltIns() {
        const saved = Store.getJSON(STORAGE_KEYS.deletedTasks, []);
        state.deletedBuiltIns = Array.isArray(saved)
            ? saved.filter(key => BUILT_IN_KEYS.includes(key))
            : [];
    }

    function saveDeletedBuiltIns() {
        Store.setJSON(STORAGE_KEYS.deletedTasks, state.deletedBuiltIns);
    }

    // Cleans rows coming from storage so one bad row can't break rendering.
    function normalizeLoadedRows(rows) {
        return rows
            .filter(r => r && typeof r === 'object')
            .filter(r => !(r.type === 'special' && !Array.isArray(r.fields)))
            .map(r => {
                if (r.timeMode === 'actual') r.rate = CONFIG.actualRate;

                if (r.type === 'special') {
                    if (!Array.isArray(r.values)) r.values = [];
                    if (state.visibility[r.task] === undefined) {
                        state.visibility[r.task] = true;
                    }
                }
                return r;
            });
    }

    function loadSavedProduction() {
        const saved = Store.getJSON(STORAGE_KEYS.data, null);

        if (Array.isArray(saved)) {
            state.rows = normalizeLoadedRows(saved);
            Log.debug('restored rows from storage:', state.rows.length);
        }

        const savedOT = Store.getRaw(STORAGE_KEYS.overtime);
        if (savedOT !== null) state.selectedOT = Number(savedOT) || 0;
    }

    /* =================================================================
     * 7. TABLE RENDERING
     * ================================================================= */

    // Groups rows by task. Order: normal tasks + subtotals (in row order),
    // then FBP, Datadog, then special tasks.
    function getRowGroups() {
        const groups = new Map();

        state.rows.forEach((row, index) => {
            const kind = KNOWN_ROW_TYPES.includes(row.type) ? row.type : 'task';

            let key;
            if (kind === 'task') key = `task:${row.task}`;
            else if (kind === 'subtotal') key = `subtotal:${getSubtotalParent(row)}`;
            else if (kind === 'special') key = `special:${row.task}`;
            else key = kind;

            if (!groups.has(key)) {
                groups.set(key, { kind, name: row.task, items: [] });
            }
            groups.get(key).items.push({ row, index });
        });

        const rank = group => ['fbp', 'datadog', 'special'].indexOf(group.kind) + 1;

        return [...groups.values()].sort((a, b) => rank(a) - rank(b));
    }

    function renderTable() {
        const tbody = $('prodTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        getRowGroups().forEach(group => {
            const visibleItems = group.items.filter(item => item.row.visible);
            if (!visibleItems.length) return;
            if (!isRowEnabled(visibleItems[0].row)) return;

            switch (group.kind) {
                case 'subtotal':
                    visibleItems.forEach(item => tbody.appendChild(renderSubtotalRow(item)));
                    break;
                case 'fbp':
                    visibleItems.forEach(item => appendFbpRow(tbody, item));
                    break;
                case 'datadog':
                    visibleItems.forEach(item => appendDatadogRow(tbody, item));
                    break;
                case 'special':
                    visibleItems.forEach(item => appendSpecialRow(tbody, item));
                    break;
                default:
                    appendTaskRows(tbody, group.name, visibleItems);
            }
        });

        updateTotals();
    }

    function renderSubtotalRow({ row }) {
        const taskName = getSubtotalParent(row);

        return makeRow('subtotal-row', `
            <td colspan="2" class="subtotal-label-cell">
                <button class="add-row-btn-subtotal"
                        data-task="${escapeHtml(taskName)}"
                        title="Add Row">+</button>
                <span>${escapeHtml(row.task)}</span>
            </td>
            <td>
                <input type="text" class="calc-items" readonly
                       value="${calcSubtotal(taskName, 'items')}">
            </td>
            <td>
                <input type="text" class="calc-time" readonly
                       value="${calcSubtotal(taskName, 'time')}">
            </td>
            <td colspan="2"></td>
        `);
    }

    function appendFbpRow(tbody, { row, index }) {
        tbody.appendChild(makeRow('special-header-row', `
            <td>Task</td>
            <td colspan="2">TOTAL ULP</td>
            <td># of Items in ULP</td>
            <td colspan="2">Time</td>
        `));

        tbody.appendChild(makeRow('section-header-row fbp-row', `
            <td class="fbp-task-cell"><strong>${escapeHtml(row.task)}</strong></td>
            <td colspan="2" class="fbp-ulp-cell">
                <input type="text" value="${escapeHtml(row.merchant)}"
                       data-field="merchant" data-index="${index}"
                       placeholder="TOTAL ULP">
            </td>
            <td class="fbp-items-cell">
                <input type="number" value="${escapeHtml(numberDisplay(row.items))}"
                       placeholder="0" data-field="items" data-index="${index}"
                       class="calc-items no-spinner">
            </td>
            <td colspan="2" class="fbp-time-cell">
                <input type="number" value="${escapeHtml(numberDisplay(row.time))}"
                       placeholder="0" data-field="time" data-index="${index}"
                       class="calc-time no-spinner">
            </td>
        `));
    }

    function appendDatadogRow(tbody, { row, index }) {
        tbody.appendChild(makeRow('special-header-row', `
            <td colspan="4">Task</td>
            <td>Items</td>
            <td>Time</td>
        `));

        tbody.appendChild(makeRow('section-header-row datadog-row', `
            <td colspan="4" class="datadog-task-cell">
                <strong>${escapeHtml(row.task)}</strong>
            </td>
            <td class="datadog-items-cell">
                <input type="number" value="${escapeHtml(numberDisplay(row.items))}"
                       placeholder="0" data-field="items" data-index="${index}"
                       class="calc-items no-spinner">
            </td>
            <td class="datadog-time-cell">
                <input type="number" value="${escapeHtml(numberDisplay(row.time))}"
                       placeholder="0" data-field="time" data-index="${index}"
                       class="calc-time no-spinner">
            </td>
        `));
    }

    // User-defined inputs. The 5 columns after "Task" are shared between them.
    function appendSpecialRow(tbody, { row, index }) {
        const fields = Array.isArray(row.fields) ? row.fields : [];
        const values = Array.isArray(row.values) ? row.values : [];

        const spans = fields.map((_, i) =>
            Math.floor(5 / fields.length) + (i < 5 % fields.length ? 1 : 0)
        );

        tbody.appendChild(makeRow('special-header-row',
            '<td>Task</td>' +
            fields.map((field, i) =>
                `<td colspan="${spans[i]}">${escapeHtml(field.label)}</td>`
            ).join('')
        ));

        tbody.appendChild(makeRow('section-header-row special-row',
            `<td class="special-task-cell"><strong>${escapeHtml(row.task)}</strong></td>` +
            fields.map((field, i) => {
                const isText = field.role !== 'items' && field.role !== 'time';
                const value = isText ? values[i] : numberDisplay(values[i]);

                return `
                    <td colspan="${spans[i]}">
                        <input type="${isText ? 'text' : 'number'}"
                               ${isText ? '' : 'step="any"'}
                               value="${escapeHtml(value)}"
                               placeholder="${isText ? escapeHtml(field.label) : '0'}"
                               data-field="special" data-slot="${i}" data-index="${index}"
                               class="special-input${isText ? '' : ' no-spinner'}">
                    </td>`;
            }).join('')
        ));
    }

    function appendTaskRows(tbody, taskName, items) {
        items.forEach(({ row, index }, position) => {
            const labelCell = position === 0
                ? `<td rowspan="${items.length}" class="task-group-cell">
                       <div class="task-label-text">${escapeHtml(taskName)}</div>
                   </td>`
                : '';

            const statusClass = row.status === 'DONE' ? 'status-done' : 'status-working';

            tbody.appendChild(makeRow('production-row', `
                ${labelCell}
                <td>
                    <input type="text" value="${escapeHtml(row.merchant)}"
                           data-field="merchant" data-index="${index}">
                </td>
                <td>
                    <input type="number" value="${escapeHtml(numberDisplay(row.items))}"
                           placeholder="0" data-field="items" data-index="${index}"
                           class="calc-items no-spinner">
                </td>
                <td>
                    <input type="number" value="${escapeHtml(numberDisplay(row.time))}"
                           placeholder="0" data-field="time" data-index="${index}"
                           class="calc-time no-spinner">
                </td>
                <td>
                    <input type="text" value="${escapeHtml(row.rate)}"
                           data-field="rate" data-index="${index}">
                </td>
                <td class="status-cell">
                    <button class="status-toggle-btn ${statusClass}"
                            data-index="${index}">${escapeHtml(row.status || 'WORKING')}</button>
                    <button class="row-hide-btn" data-index="${index}"
                            title="Delete Row">×</button>
                </td>
            `));
        });
    }

    /* =================================================================
     * 8. TABLE EVENTS  (delegated: attached once, survive re-renders)
     * ================================================================= */

    function getRow(indexValue) {
        const row = state.rows[Number(indexValue)];
        if (!row) Log.warn('No row at index', indexValue);
        return row;
    }

    function commitAndRender() {
        saveProductionData();
        renderTable();
    }

    function onTableInput(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;

        const { field, index } = input.dataset;
        if (index === undefined || !field) return;

        const row = getRow(index);
        if (!row) return;

        // Special task inputs are stored by position
        if (field === 'special') {
            if (!Array.isArray(row.values)) row.values = [];
            row.values[Number(input.dataset.slot)] = input.value;
            saveProductionData();
            updateTotals();
            return;
        }

        row[field] = input.value;

        // Items or Rate changed -> recalculate Time.
        // Time itself changed -> keep what the user typed.
        const autoTime =
            row.type !== 'fbp' &&
            row.type !== 'datadog' &&
            row.timeMode !== 'actual' &&
            (field === 'items' || field === 'rate');

        if (autoTime) {
            row.time = calculateTime(row.items, row.rate);

            const timeInput = document.querySelector(
                `input.calc-time[data-index="${index}"]`
            );
            if (timeInput) timeInput.value = numberDisplay(row.time);
        }

        saveProductionData();
        updateTotals();
    }

    function onTableClick(event) {
        const statusBtn = event.target.closest('.status-toggle-btn');
        if (statusBtn) {
            const row = getRow(statusBtn.dataset.index);
            if (!row) return;
            row.status = row.status === 'DONE' ? 'WORKING' : 'DONE';
            commitAndRender();
            return;
        }

        const hideBtn = event.target.closest('.row-hide-btn');
        if (hideBtn) {
            const row = getRow(hideBtn.dataset.index);
            if (!row) return;
            row.visible = false;
            commitAndRender();
            return;
        }

        const addBtn = event.target.closest('.add-row-btn-subtotal');
        if (addBtn) {
            addRowToTask(addBtn.dataset.task);
        }
    }

    function addRowToTask(taskName) {
        const settings = getTaskSettings(taskName);
        const rate = settings.timeMode === 'actual'
            ? CONFIG.actualRate
            : (Number(settings.rate) || getDefaultRate(taskName) || 1);

        const newRow = createTaskRow(taskName, {
            rate,
            timeMode: settings.timeMode,
            actualTime: settings.actualTime
        });

        const subtotalIdx = state.rows.findIndex(r =>
            r.type === 'subtotal' && getSubtotalParent(r) === taskName
        );

        if (subtotalIdx !== -1) state.rows.splice(subtotalIdx, 0, newRow);
        else state.rows.push(newRow);

        commitAndRender();
    }

    function initTableEvents() {
        const tbody = $('prodTableBody');
        if (!tbody) throw new Error('#prodTableBody not found');

        tbody.addEventListener('input', onTableInput);
        tbody.addEventListener('click', onTableClick);
    }

    /* =================================================================
     * 9. TASK BUTTONS
     * ================================================================= */

    function getToggleContainer() {
        return document.querySelector('.task-toggles');
    }

    // ---- built-in task buttons ----

    function applyBuiltInDeletions() {
        document.querySelectorAll('.builtin-task-control').forEach(control => {
            const btn = control.querySelector('.toggle-btn');
            const key = btn.dataset.visibilityKey;
            const isDeleted = state.deletedBuiltIns.includes(key);

            control.style.display = isDeleted ? 'none' : '';

            if (isDeleted) {
                state.visibility[key] = false;
                btn.classList.remove('active');
            }
        });

        const restoreBtn = $('restoreTasksBtn');
        if (restoreBtn) {
            restoreBtn.hidden = state.deletedBuiltIns.length === 0;
            restoreBtn.textContent =
                `↺ RESTORE DELETED TASKS (${state.deletedBuiltIns.length})`;
        }
    }

    // Wraps each built-in button with a delete (x) button.
    function setupBuiltInButtons() {
        const container = getToggleContainer();
        if (!container) throw new Error('.task-toggles not found');

        container.querySelectorAll(':scope > .toggle-btn').forEach(btn => {
            const def = TOGGLE_BY_ID[btn.dataset.task];

            if (!def) {
                Log.warn('Toggle button has an unknown data-task:', btn.dataset.task);
                return;
            }

            btn.dataset.visibilityKey = def.key;
            btn.classList.toggle('active', !!state.visibility[def.key]);

            const label = btn.innerText.trim();

            const control = document.createElement('div');
            control.className = 'builtin-task-control task-control';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'builtin-task-delete-btn task-delete-btn';
            deleteBtn.dataset.deleteKind = 'builtin';
            deleteBtn.dataset.deleteName = def.key;
            deleteBtn.dataset.label = label;
            deleteBtn.textContent = '×';
            deleteBtn.title = `Delete ${label}`;

            btn.parentNode.insertBefore(control, btn);
            control.appendChild(btn);
            control.appendChild(deleteBtn);
        });
    }

    // ---- custom + special task buttons ----

    function createTaskControl(kind, name) {
        const control = document.createElement('div');
        control.className = `${kind}-task-control task-control`;

        const button = document.createElement('button');
        button.type = 'button';
        button.className =
            `toggle-btn ${kind}-task-btn` + (state.visibility[name] ? ' active' : '');
        button.dataset.visibilityKey = name;
        button.textContent = name.toUpperCase();

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = `${kind}-task-delete-btn task-delete-btn`;
        deleteBtn.dataset.deleteKind = kind;
        deleteBtn.dataset.deleteName = name;
        deleteBtn.textContent = '×';
        deleteBtn.title = `Delete ${name}`;

        control.appendChild(button);
        control.appendChild(deleteBtn);
        return control;
    }

    function createNewTaskButton(id, text, title) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = id;
        button.className = 'new-task-btn';
        button.textContent = text;
        button.title = title;
        return button;
    }

    // Rebuilds the user-created buttons (custom / special / "+ NEW TASK" ...).
    function renderTaskButtons() {
        const container = getToggleContainer();
        if (!container) {
            Log.error('renderTaskButtons: .task-toggles was not found');
            return;
        }

        container
            .querySelectorAll('.custom-task-control, .special-task-control, .new-task-btn')
            .forEach(el => el.remove());

        Object.keys(state.customTasks).forEach(name => {
            container.appendChild(createTaskControl('custom', name));
        });

        state.rows
            .filter(row => row.type === 'special')
            .forEach(row => {
                container.appendChild(createTaskControl('special', row.task));
            });

        container.appendChild(
            createNewTaskButton('newTaskBtn', '+ NEW TASK', 'Create a new task')
        );
        container.appendChild(
            createNewTaskButton(
                'newSpecialTaskBtn', '+ SPECIAL TASK',
                'Create a task with your own named inputs'
            )
        );
    }

    // ---- delete ----

    function deleteTask(kind, name, label) {
        if (kind === 'builtin') {
            const confirmed = confirm(
                `Delete the task "${label || name}"?\n\n` +
                `It will be removed from the task list and left out ` +
                `of your totals. You can bring it back any time with ` +
                `the "Restore deleted tasks" button.`
            );
            if (!confirmed) return;

            if (!state.deletedBuiltIns.includes(name)) state.deletedBuiltIns.push(name);

            saveDeletedBuiltIns();
            applyBuiltInDeletions();
            renderTable();
            return;
        }

        if (kind === 'custom') {
            const confirmed = confirm(
                `Delete the custom task "${name}"?\n\n` +
                `This will remove the task and all of its rows.`
            );
            if (!confirmed) return;

            delete state.customTasks[name];
            delete state.visibility[name];

            state.rows = state.rows.filter(row =>
                row.type === 'subtotal'
                    ? getSubtotalParent(row) !== name
                    : row.task !== name
            );

            saveCustomTasks();
        } else if (kind === 'special') {
            const confirmed = confirm(
                `Delete the special task "${name}"?\n\n` +
                `This will remove the task and everything typed in it.`
            );
            if (!confirmed) return;

            delete state.visibility[name];
            state.rows = state.rows.filter(row =>
                !(row.type === 'special' && row.task === name)
            );
        } else {
            Log.warn('deleteTask: unknown kind', kind);
            return;
        }

        saveProductionData();
        renderTaskButtons();
        renderTable();
    }

    // ---- creation (called by the dialogs; return an error string or null) ----

    function createCustomTask({ name, rate, timeMode }) {
        if (taskNameExists(name)) return 'A task with this name already exists.';

        addCustomTask(name, rate, timeMode);
        saveProductionData();
        renderTaskButtons();
        renderTable();
        return null;
    }

    function createSpecialTask({ name, fields }) {
        if (taskNameExists(name)) return 'A task with this name already exists.';

        addSpecialTask(name, fields);
        saveProductionData();
        renderTaskButtons();
        renderTable();
        return null;
    }

    // ---- one click handler for every task button ----

    function onTaskButtonsClick(event) {
        const deleteBtn = event.target.closest('.task-delete-btn');
        if (deleteBtn) {
            event.preventDefault();
            event.stopPropagation();
            deleteTask(
                deleteBtn.dataset.deleteKind,
                deleteBtn.dataset.deleteName,
                deleteBtn.dataset.label
            );
            return;
        }

        const toggleBtn = event.target.closest('.toggle-btn[data-visibility-key]');
        if (toggleBtn) {
            event.preventDefault();
            const key = toggleBtn.dataset.visibilityKey;
            state.visibility[key] = !state.visibility[key];
            toggleBtn.classList.toggle('active', state.visibility[key]);
            Log.debug('toggle', key, state.visibility[key]);
            renderTable();
            return;
        }

        if (event.target.closest('#newSpecialTaskBtn')) {
            event.preventDefault();
            openSpecialTaskDialog(createSpecialTask);
            return;
        }

        if (event.target.closest('#newTaskBtn')) {
            event.preventDefault();
            openNewTaskDialog(createCustomTask);
        }
    }

    function initTaskButtons() {
        setupBuiltInButtons();
        applyBuiltInDeletions();
        renderTaskButtons();

        getToggleContainer().addEventListener('click', onTaskButtonsClick);

        const restoreBtn = $('restoreTasksBtn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                state.deletedBuiltIns = [];
                saveDeletedBuiltIns();
                applyBuiltInDeletions();
                renderTable();
            });
        }
    }

    /* =================================================================
     * 10. DIALOGS
     * ================================================================= */

    // Shared modal. onSubmit(overlay) returns an error string, or a falsy
    // value when everything worked (the modal then closes).
    // (Electron has no window.prompt(), which is why these exist.)
    function openModal({ id, title, bodyHtml, confirmLabel, onSubmit }) {
        if ($(id)) return null;

        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box" role="dialog" aria-modal="true">
                <h3>${escapeHtml(title)}</h3>
                ${bodyHtml}
                <div class="modal-error"></div>
                <div class="modal-actions">
                    <button type="button" class="clear-btn" data-modal="cancel">CANCEL</button>
                    <button type="button" class="action-btn" data-modal="confirm">${escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const errorBox = overlay.querySelector('.modal-error');
        const close = () => overlay.remove();

        function submit() {
            const error = onSubmit(overlay);
            if (error) {
                errorBox.textContent = error;
                return;
            }
            close();
        }

        overlay.querySelector('[data-modal="confirm"]').addEventListener('click', submit);
        overlay.querySelector('[data-modal="cancel"]').addEventListener('click', close);
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();

            if (e.key === 'Enter' &&
                e.target.tagName !== 'BUTTON' &&
                e.target.tagName !== 'SELECT') {
                submit();
            }
        });

        return { overlay, close };
    }

    function openNewTaskDialog(onCreate) {
        const modal = openModal({
            id: 'newTaskOverlay',
            title: 'New Task',
            confirmLabel: 'CREATE TASK',
            bodyHtml: `
                <label>Task name</label>
                <input type="text" id="ntName" placeholder="e.g. Audit">

                <label>Rate</label>
                <input type="number" id="ntRate" step="any" min="0" placeholder="e.g. 1.2">

                <label>Time</label>
                <div class="modal-radio">
                    <label><input type="radio" name="ntMode" value="rate" checked> Calculate from Items &times; Rate</label>
                    <label><input type="radio" name="ntMode" value="actual"> Use actual time (typed in the table)</label>
                </div>
            `,
            onSubmit: overlay => {
                const name = overlay.querySelector('#ntName').value.trim();
                const useActual =
                    overlay.querySelector('input[name="ntMode"]:checked').value === 'actual';
                const rate = useActual
                    ? CONFIG.actualRate
                    : Number(overlay.querySelector('#ntRate').value);

                if (!name) return 'Please enter a task name.';

                if (!useActual && (!Number.isFinite(rate) || rate <= 0)) {
                    return 'Please enter a valid rate greater than 0.';
                }

                return onCreate({ name, rate, timeMode: useActual ? 'actual' : 'rate' });
            }
        });

        if (!modal) return;

        const rateInput = modal.overlay.querySelector('#ntRate');

        modal.overlay.querySelectorAll('input[name="ntMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const actual =
                    modal.overlay.querySelector('input[name="ntMode"]:checked').value === 'actual';

                if (actual) {
                    rateInput.type = 'text';
                    rateInput.value = CONFIG.actualRate;
                    rateInput.disabled = true;
                } else {
                    rateInput.disabled = false;
                    rateInput.type = 'number';
                    rateInput.value = '';
                }
            });
        });

        modal.overlay.querySelector('#ntName').focus();
    }

    // The user names the task, then adds inputs and names each one
    // (the names become the header above the row).
    function openSpecialTaskDialog(onCreate) {
        const modal = openModal({
            id: 'specialTaskOverlay',
            title: 'New Special Task',
            confirmLabel: 'CREATE TASK',
            bodyHtml: `
                <label>Task name</label>
                <input type="text" id="spName" placeholder="e.g. Audit" maxlength="40">

                <label>Inputs (each name becomes a header)</label>
                <div class="sp-fields" id="spFields"></div>

                <button type="button" class="action-btn" id="spAddField">+ ADD INPUT</button>
            `,
            onSubmit: overlay => {
                const name = overlay.querySelector('#spName').value.trim();

                const fields = Array.from(overlay.querySelectorAll('.sp-field-row')).map(row => ({
                    label: row.querySelector('.sp-label').value.trim(),
                    role: row.querySelector('.sp-role').value
                }));

                if (!name) return 'Please enter a task name.';
                if (fields.length === 0) return 'Add at least one input.';
                if (fields.some(field => !field.label)) return 'Every input needs a name.';

                return onCreate({ name, fields });
            }
        });

        if (!modal) return;

        const fieldsBox = modal.overlay.querySelector('#spFields');
        const addButton = modal.overlay.querySelector('#spAddField');

        function refreshButtons() {
            const count = fieldsBox.children.length;
            addButton.disabled = count >= CONFIG.maxSpecialInputs;

            fieldsBox.querySelectorAll('.sp-remove').forEach(btn => {
                btn.disabled = count <= 1;
            });
        }

        function addFieldRow() {
            if (fieldsBox.children.length >= CONFIG.maxSpecialInputs) return null;

            const row = document.createElement('div');
            row.className = 'sp-field-row';
            row.innerHTML = `
                <input type="text" class="sp-label" placeholder="Input name" maxlength="30">

                <select class="sp-role" title="What this input is used for">
                    <option value="text">Plain input</option>
                    <option value="items">Items (adds to Total Items)</option>
                    <option value="time">Time (adds to Total Time)</option>
                </select>

                <button type="button" class="sp-remove" title="Remove input">&times;</button>
            `;

            row.querySelector('.sp-remove').addEventListener('click', () => {
                if (fieldsBox.children.length <= 1) return;
                row.remove();
                refreshButtons();
            });

            fieldsBox.appendChild(row);
            refreshButtons();
            return row;
        }

        addButton.addEventListener('click', () => {
            const row = addFieldRow();
            if (row) row.querySelector('.sp-label').focus();
        });

        // Start with two inputs to fill in
        addFieldRow();
        addFieldRow();

        modal.overlay.querySelector('#spName').focus();
    }

    /* =================================================================
     * 11. OVERTIME
     * ================================================================= */

    function updateOvertimeDisplay(totalTime) {
        const remainingMinutes =
            CONFIG.baseMinutes + state.selectedOT - toNumber(totalTime);

        const minutesEl = $('otMinutesDisplay');
        if (minutesEl) minutesEl.innerText = remainingMinutes;

        // Items left = time left / 0.88
        const itemsEl = $('otItemsDisplay');
        if (itemsEl) {
            itemsEl.innerText = Math.max(
                0,
                Math.floor(remainingMinutes / CONFIG.itemsLeftRate)
            );
        }
    }

    function initOvertime() {
        const buttons = document.querySelectorAll('.ot-btn');

        const syncActive = () => {
            buttons.forEach(btn => {
                btn.classList.toggle(
                    'active',
                    (Number(btn.dataset.ot) || 0) === state.selectedOT
                );
            });
        };

        syncActive();

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedOT = Number(btn.dataset.ot) || 0;
                syncActive();
                saveProductionData();
                updateOvertimeDisplay(computeTotals().time);
            });
        });
    }

    /* =================================================================
     * 12. SHIFT HEADER  (shift, name, date, weekday)
     * ================================================================= */

    function getTodayDateString() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function initProductionDate() {
        const dateInput = $('productionDate');
        const dayDisplay = $('productionDay');
        if (!dateInput || !dayDisplay) return;

        const updateDay = () => {
            if (!dateInput.value) {
                dayDisplay.textContent = '';
                return;
            }
            // Add the time locally so the date doesn't shift with the timezone
            const date = new Date(dateInput.value + 'T00:00:00');
            dayDisplay.textContent = date.toLocaleDateString('en-US', { weekday: 'long' });
        };

        dateInput.value = Store.getRaw(STORAGE_KEYS.date) || getTodayDateString();
        updateDay();

        dateInput.addEventListener('change', () => {
            Store.setRaw(STORAGE_KEYS.date, dateInput.value);
            updateDay();
        });
    }

    function initShiftName() {
        const input = $('shiftName');
        if (!input) return;

        const saved = Store.getRaw(STORAGE_KEYS.shiftName);
        input.value = (saved && saved.trim()) || CONFIG.defaultShiftName;

        input.addEventListener('input', () => {
            Store.setRaw(STORAGE_KEYS.shiftName, input.value);
        });

        // Never leave the name blank
        input.addEventListener('blur', () => {
            const cleaned = input.value.replace(/\s+/g, ' ').trim();
            input.value = cleaned || CONFIG.defaultShiftName;
            Store.setRaw(STORAGE_KEYS.shiftName, input.value);
        });

        input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
        input.addEventListener('focus', () => input.select());
    }

    // "Keith Arcedes" -> "ARCEDES, KEITH" (used for the screenshot file name)
    function getNameForFile() {
        const input = $('shiftName');

        const cleanName = ((input && input.value) || CONFIG.defaultShiftName)
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Already typed as "Last, First" -> use exactly as typed
        if (cleanName.includes(',')) return cleanName.toUpperCase();

        const parts = cleanName.split(' ').filter(Boolean);

        if (parts.length === 0) return 'PRODUCTION';
        if (parts.length === 1) return parts[0].toUpperCase();

        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');
        return `${last}, ${first}`.toUpperCase();
    }

    function initShiftSelector() {
        const select = $('shiftSelector');
        if (!select) return;

        const saved = Store.getRaw(STORAGE_KEYS.shift);
        if (saved && Array.from(select.options).some(o => o.value === saved)) {
            select.value = saved;
        }

        select.addEventListener('change', () => {
            Store.setRaw(STORAGE_KEYS.shift, select.value);
            Log.debug('shift selected:', select.value);
        });
    }

    /* =================================================================
     * 13. SCREENSHOT
     * ================================================================= */

    // Style properties copied from a real <input> onto its text stand-in
    const COPIED_INPUT_STYLES = [
        'width', 'height', 'minHeight', 'boxSizing', 'backgroundColor',
        'border', 'borderRadius', 'color', 'fontFamily', 'fontSize',
        'fontWeight', 'textAlign', 'padding', 'margin', 'letterSpacing',
        'lineHeight'
    ];

    function getScreenshotLayoutMode() {
        const saved = Store.getRaw(STORAGE_KEYS.screenshotLayout);
        return SCREENSHOT_LAYOUTS.includes(saved) ? saved : 'auto';
    }

    function setCloneWidth(clone, width) {
        clone.style.width = `${width}px`;
        clone.style.minWidth = `${width}px`;
        clone.style.maxWidth = `${width}px`;
    }

    // Off-screen copy of the capture area. The original page is never touched.
    function createScreenshotClone(area, width, height, background) {
        const clone = area.cloneNode(true);
        clone.id = 'screenshotClone';

        Object.assign(clone.style, {
            position: 'absolute',
            left: '-10000px',
            top: '0',
            height: `${height}px`,
            background,
            overflow: 'visible',
            boxSizing: 'border-box'
        });
        setCloneWidth(clone, width);

        document.body.appendChild(clone);
        return clone;
    }

    // html2canvas can clip text inside native inputs, so the copy gets
    // plain DIVs showing each input's value instead.
    function replaceInputsWithText(originalArea, clone) {
        const originals = originalArea.querySelectorAll('input, select, textarea');
        const clones = clone.querySelectorAll('input, select, textarea');

        clones.forEach((clonedEl, index) => {
            const originalEl = originals[index];
            if (!originalEl) return;

            let value = '';

            if (originalEl.tagName.toLowerCase() === 'select') {
                const option = originalEl.options[originalEl.selectedIndex];
                if (option) value = option.textContent.trim();
            } else {
                value = originalEl.value || '';

                // Date inputs hold ISO text (2026-10-07); show them the way
                // the app displays them (e.g. 10/07/2026).
                if (originalEl.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    const [y, m, d] = value.split('-').map(Number);
                    value = new Date(y, m - 1, d).toLocaleDateString(undefined, {
                        month: '2-digit', day: '2-digit', year: 'numeric'
                    });
                }
            }

            const styles = window.getComputedStyle(originalEl);
            const replacement = document.createElement('div');

            replacement.textContent = value;
            COPIED_INPUT_STYLES.forEach(prop => { replacement.style[prop] = styles[prop]; });

            Object.assign(replacement.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                    styles.textAlign === 'center' ? 'center'
                        : styles.textAlign === 'right' ? 'flex-end'
                            : 'flex-start',
                overflow: 'visible',
                whiteSpace: 'nowrap'
            });

            replacement.className = clonedEl.className;

            // Remember the original height so landscape mode can resize these
            replacement.setAttribute('data-shot-input', '1');
            replacement.setAttribute('data-shot-height', String(originalEl.offsetHeight));

            clonedEl.replaceWith(replacement);
        });
    }

    // Long tables: rebuild the cloned table as two side-by-side columns.
    // Returns true on success.
    function buildLandscapeLayout(clone) {
        const tableContainer = clone.querySelector('.table-container');
        const table = clone.querySelector('.prod-table');

        if (!tableContainer || !table || !table.tBodies[0]) return false;

        const rows = Array.from(table.tBodies[0].rows);
        if (rows.length < 2) return false;

        const hasLabelCell = tr =>
            Array.from(tr.cells).some(c => c.classList.contains('task-group-cell'));
        const isSubtotal = tr => tr.classList.contains('subtotal-row');

        // A new task block starts at a task label, FBP row or Datadog row
        const startsBlock = tr =>
            hasLabelCell(tr) || tr.classList.contains('special-header-row');

        // ---- pick where to cut the table in two ----
        // Prefer cutting between tasks; cut inside a long task only
        // when that balances the two columns much better.
        const ideal = rows.length / 2;
        let cut = -1;
        let bestScore = Infinity;

        for (let p = 1; p < rows.length; p++) {
            if (isSubtotal(rows[p])) continue;                                // keep TOTAL with its rows
            if (rows[p - 1].classList.contains('special-header-row')) continue; // keep header + row together

            const score = Math.abs(p - ideal) + (startsBlock(rows[p]) ? 0 : 1.5);

            if (score < bestScore) {
                bestScore = score;
                cut = p;
            }
        }

        if (cut < 0) return false;

        // ---- cutting inside a task: repeat its label on the right side ----
        if (!startsBlock(rows[cut])) {
            let start = cut;
            while (start > 0 && !startsBlock(rows[start])) start--;

            const labelCell = Array.from(rows[start].cells)
                .find(c => c.classList.contains('task-group-cell'));

            if (!labelCell) return false;

            let end = cut;
            while (end < rows.length && !isSubtotal(rows[end])) end++;

            const rightLabel = labelCell.cloneNode(true);

            labelCell.rowSpan = cut - start;
            rightLabel.rowSpan = end - cut;
            rows[cut].insertBefore(rightLabel, rows[cut].firstChild);
        }

        // ---- build the two columns ----
        const makeColumn = rowList => {
            const wrap = document.createElement('div');
            wrap.className = 'table-container landscape-col';

            const newTable = document.createElement('table');
            newTable.className = table.className;

            if (table.tHead) newTable.appendChild(table.tHead.cloneNode(true));

            const tbody = document.createElement('tbody');
            rowList.forEach(tr => tbody.appendChild(tr));
            newTable.appendChild(tbody);
            wrap.appendChild(newTable);

            return wrap;
        };

        const layout = document.createElement('div');
        layout.className = 'landscape-columns';
        layout.appendChild(makeColumn(rows.slice(0, cut)));
        layout.appendChild(makeColumn(rows.slice(cut)));

        tableContainer.replaceWith(layout);
        return true;
    }

    function shouldUseLandscape() {
        const mode = getScreenshotLayoutMode();
        const rowCount = document.querySelectorAll('#prodTableBody tr').length;

        return mode === 'landscape' ||
            (mode === 'auto' && rowCount >= CONFIG.screenshot.landscapeRowThreshold);
    }

    // Table cells are narrower in columns, so replaced inputs fill their
    // cell instead of keeping their old pixel widths.
    function stretchReplacedInputs(clone) {
        clone.querySelectorAll('.prod-table [data-shot-input]').forEach(el => {
            el.style.boxSizing = 'border-box';
            el.style.width = '100%';
            el.style.height = `${el.getAttribute('data-shot-height')}px`;
        });
    }

    // A long merchant name used to spill over its neighbours. Shrink the
    // text until it fits; if it still doesn't fit, clip it at the box edge.
    function fitTextInBoxes(clone) {
        clone.querySelectorAll('.prod-table [data-shot-input]').forEach(el => {
            el.style.overflow = 'hidden';

            if (el.scrollWidth <= el.clientWidth + 1) return;

            let fontSize = parseFloat(window.getComputedStyle(el).fontSize) || 14;

            while (el.scrollWidth > el.clientWidth + 1 &&
                   fontSize > CONFIG.screenshot.minFontSize) {
                fontSize -= 0.5;
                el.style.fontSize = `${fontSize}px`;
            }

            // Still too long: show the start of the text
            if (el.scrollWidth > el.clientWidth + 1) {
                el.style.justifyContent = 'flex-start';
            }
        });
    }

    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    function downloadCanvas(canvas) {
        canvas.toBlob(blob => {
            if (!blob) {
                alert('Could not create screenshot.');
                return;
            }

            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${getNameForFile()} ${mm}.${dd}.${now.getFullYear()}.png`;
            link.href = url;
            link.click();

            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }

    async function captureProduction(button) {
        const area = $('screenshotArea');

        if (!area) {
            alert('Screenshot area not found.');
            return;
        }

        if (typeof html2canvas !== 'function') {
            Log.error('html2canvas is not loaded (CDN blocked or offline?)');
            alert('The screenshot library did not load. Check your internet connection and reload the page.');
            return;
        }

        const originalText = button.innerText;
        button.innerText = 'CAPTURING...';
        button.disabled = true;

        let clone = null;

        try {
            let width = Math.ceil(area.getBoundingClientRect().width);
            let height = Math.ceil(area.scrollHeight);
            const background = getComputedStyle(document.body).backgroundColor;

            clone = createScreenshotClone(area, width, height, background);
            replaceInputsWithText(area, clone);

            const isLandscape = shouldUseLandscape() && buildLandscapeLayout(clone);

            if (isLandscape) {
                width = CONFIG.screenshot.landscapeWidth;
                setCloneWidth(clone, width);
                clone.style.height = 'auto';
                stretchReplacedInputs(clone);
            }

            // Give the browser time to lay out the clone
            await nextFrame();
            await wait(100);

            fitTextInBoxes(clone);

            if (isLandscape) {
                height = Math.ceil(clone.getBoundingClientRect().height);
            }

            Log.debug('screenshot', { width, height, isLandscape });

            const canvas = await html2canvas(clone, {
                backgroundColor: background,
                scale: 1,
                useCORS: true,
                logging: false,
                width,
                height,
                scrollX: 0,
                scrollY: 0
            });

            downloadCanvas(canvas);

        } catch (error) {
            Log.error('Screenshot error:', error);
            alert('Something went wrong while taking the screenshot.');
        } finally {
            if (clone) clone.remove();
            button.innerText = originalText;
            button.disabled = false;
        }
    }

    function initScreenshot() {
        const layoutSelect = $('screenshotLayoutSelect');

        if (layoutSelect) {
            layoutSelect.value = getScreenshotLayoutMode();
            layoutSelect.addEventListener('change', () => {
                Store.setRaw(STORAGE_KEYS.screenshotLayout, layoutSelect.value);
            });
        }

        const button = $('screenshotProductionBtn');
        if (button) button.addEventListener('click', () => captureProduction(button));
    }

    /* =================================================================
     * 14. TOOLS  (comma separator, clear all)
     * ================================================================= */

    function initCommaTool() {
        const rawInput = $('rawInputList');
        const output = $('formattedOutput');
        if (!rawInput || !output) return;

        rawInput.addEventListener('input', () => {
            output.innerText = rawInput.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join(', ');
        });

        const clearBtn = $('clearToolBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                rawInput.value = '';
                output.innerText = '';
            });
        }

        const copyBtn = $('copyOutputBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(output.innerText);
                    alert('Copied to clipboard!');
                } catch (error) {
                    Log.error('Clipboard write failed', error);
                    alert('Could not copy to the clipboard.');
                }
            });
        }
    }

    function clearProductionValues() {
        state.rows.forEach(r => {
            if (r.type === 'subtotal') return;

            if (r.type === 'fbp') {
                r.merchant = '';
                r.items = '';
                r.time = '';
            } else if (r.type === 'datadog') {
                r.items = '';
                r.time = '';
            } else if (r.type === 'special') {
                r.values = (r.fields || []).map(() => '');
            } else {
                r.items = '';
                r.time = r.timeMode === 'actual' ? r.actualTime : '';
                r.merchant = '';
                r.rate = state.customTasks[r.task]
                    ? state.customTasks[r.task].rate
                    : getDefaultRate(r.task);
                r.status = 'WORKING';
            }
        });
    }

    function initClearAll() {
        const button = $('clearProductionBtn');
        if (!button) return;

        button.addEventListener('click', () => {
            if (!confirm('Clear all production input values?')) return;

            clearProductionValues();
            commitAndRender();
        });
    }

    /* =================================================================
     * 15. CALCULATOR  (on-screen buttons + physical keyboard / numpad)
     * ================================================================= */

    function initCalculator() {
        const card = $('calculatorCard');
        const displayEl = $('calcDisplay');
        const historyEl = $('calcHistory');

        if (!card || !displayEl || !historyEl) return;

        const SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
        const MAX_DIGITS = 15;

        let current = '0';       // number being typed / shown
        let previous = null;     // left-hand value waiting for an operator
        let operator = null;     // '+', '-', '*', '/'
        let overwrite = false;   // next digit starts a new number
        let hasError = false;

        // Removes floating point noise (0.1 + 0.2 -> 0.3)
        const clean = number => String(parseFloat(number.toPrecision(12)));

        function compute(a, op, b) {
            switch (op) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return b === 0 ? NaN : a / b;
            }
            return b;
        }

        function render() {
            displayEl.textContent = hasError ? 'Error' : current;

            card.querySelectorAll('[data-calc-op]').forEach(btn => {
                btn.classList.toggle(
                    'active',
                    !hasError && operator === btn.dataset.calcOp && overwrite
                );
            });
        }

        const setHistory = text => { historyEl.innerHTML = text || '&nbsp;'; };

        function resetAll() {
            current = '0';
            previous = null;
            operator = null;
            overwrite = false;
            hasError = false;
            setHistory('');
            render();
        }

        function fail() {
            hasError = true;
            current = '0';
            previous = null;
            operator = null;
            overwrite = true;
            setHistory('');
            render();
        }

        function inputDigit(digit) {
            if (hasError) resetAll();

            if (overwrite) {
                current = digit;
                overwrite = false;
            } else if (current === '0') {
                current = digit;
            } else if (current === '-0') {
                current = '-' + digit;
            } else if (current.replace(/[-.]/g, '').length < MAX_DIGITS) {
                current += digit;
            }
            render();
        }

        function inputDot() {
            if (hasError) resetAll();

            if (overwrite) {
                current = '0.';
                overwrite = false;
            } else if (!current.includes('.')) {
                current += '.';
            }
            render();
        }

        function inputOperator(op) {
            if (hasError) return;

            const value = parseFloat(current);

            if (operator && previous !== null && !overwrite) {
                const result = compute(previous, operator, value);
                if (!Number.isFinite(result)) return fail();
                previous = result;
                current = clean(result);
            } else {
                previous = value;
            }

            operator = op;
            overwrite = true;
            setHistory(`${clean(previous)} ${SYMBOLS[op]}`);
            render();
        }

        function equals() {
            if (hasError || operator === null || previous === null) return;

            const right = parseFloat(current);
            const result = compute(previous, operator, right);

            if (!Number.isFinite(result)) return fail();

            setHistory(`${clean(previous)} ${SYMBOLS[operator]} ${clean(right)} =`);
            current = clean(result);
            previous = null;
            operator = null;
            overwrite = true;
            render();
        }

        function backspace() {
            if (hasError) return resetAll();
            if (overwrite) return;

            current = current.slice(0, -1);
            if (current === '' || current === '-') current = '0';
            render();
        }

        function negate() {
            if (hasError || current === '0') return;
            current = current.startsWith('-') ? current.slice(1) : '-' + current;
            render();
        }

        function percent() {
            if (hasError) return;
            current = clean(parseFloat(current) / 100);
            overwrite = true;
            render();
        }

        const ACTIONS = {
            clear: resetAll,
            backspace,
            percent,
            negate,
            dot: inputDot,
            equals
        };

        // ---------- on-screen buttons ----------

        card.addEventListener('click', event => {
            const btn = event.target.closest('.calc-btn');
            if (!btn) return;

            if (btn.dataset.calcDigit !== undefined) {
                inputDigit(btn.dataset.calcDigit);
            } else if (btn.dataset.calcOp !== undefined) {
                inputOperator(btn.dataset.calcOp);
            } else if (btn.dataset.calcAction && ACTIONS[btn.dataset.calcAction]) {
                ACTIONS[btn.dataset.calcAction]();
            }
        });

        // ---------- keyboard / numpad ----------

        function flash(selector) {
            const btn = card.querySelector(selector);
            if (!btn) return;
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 120);
        }

        // Read the physical numpad key by its code so it works whether
        // NumLock is on or off. Everything else uses event.key.
        const NUMPAD_KEYS = {
            NumpadAdd: '+',
            NumpadSubtract: '-',
            NumpadMultiply: '*',
            NumpadDivide: '/',
            NumpadDecimal: '.',
            NumpadEnter: 'Enter'
        };

        document.addEventListener('keydown', event => {
            // Leave browser shortcuts alone (Ctrl+C, etc.)
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            // Don't steal keys while a dialog is open
            if (document.querySelector('.modal-overlay')) return;

            const target = event.target;

            // Never steal keys while typing in a field
            if (target.closest &&
                target.closest('input, textarea, select, [contenteditable="true"]')) {
                return;
            }

            const code = event.code;
            let key = event.key;

            if (/^Numpad[0-9]$/.test(code)) key = code.slice(-1);
            else if (NUMPAD_KEYS[code]) key = NUMPAD_KEYS[code];

            // Enter on some other focused button should still activate that button
            const onOtherControl =
                target.closest && target.closest('button, a') && !card.contains(target);

            if (/^[0-9]$/.test(key)) {
                inputDigit(key);
                flash(`[data-calc-digit="${key}"]`);
            } else if (key === '.' || key === ',' || code === 'NumpadDecimal') {
                inputDot();
                flash('[data-calc-action="dot"]');
            } else if (key === '+' || key === '-' || key === '*' || key === '/') {
                inputOperator(key);
                flash(`[data-calc-op="${key}"]`);
            } else if (key === 'Enter' || key === '=') {
                if (key === 'Enter' && onOtherControl) return;
                equals();
                flash('[data-calc-action="equals"]');
            } else if (key === 'Backspace') {
                backspace();
                flash('[data-calc-action="backspace"]');
            } else if (key === 'Escape' || key === 'Delete') {
                resetAll();
                flash('[data-calc-action="clear"]');
            } else if (key === '%') {
                percent();
                flash('[data-calc-action="percent"]');
            } else {
                return;
            }

            // Stops "/" quick-find, page scrolling, and a focused button
            // "clicking" itself when Enter is pressed.
            event.preventDefault();
        });

        render();
    }

    /* =================================================================
     * 16. THEME
     * ================================================================= */

    function initTheme() {
        const swatches = document.querySelectorAll('.theme-swatch');

        function applyTheme(theme) {
            if (!THEMES.includes(theme)) theme = 'midnight';

            document.documentElement.dataset.theme = theme;

            swatches.forEach(btn => {
                const isActive = btn.dataset.theme === theme;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', String(isActive));
            });
        }

        applyTheme(Store.getRaw(STORAGE_KEYS.theme));

        swatches.forEach(btn => {
            btn.addEventListener('click', () => {
                applyTheme(btn.dataset.theme);
                Store.setRaw(STORAGE_KEYS.theme, btn.dataset.theme);
            });
        });
    }

    /* =================================================================
     * 17. NOTEPAD
     * Built here (no HTML needed). On wide screens it docks in the empty
     * space to the right of the table; on narrow screens it sits below
     * the table. It is outside #screenshotArea, so it is never captured.
     * ================================================================= */

    const NOTEPAD_SAVE_DELAY_MS = 300;

    function initNotepad() {
        const container = document.querySelector('.app-container');
        if (!container) throw new Error('.app-container not found');

        const panel = document.createElement('aside');
        panel.className = 'notepad';
        panel.id = 'notepadPanel';
        panel.setAttribute('aria-label', 'Notepad');
        panel.innerHTML = `
            <div class="notepad-header">
                <span class="notepad-title">NOTEPAD</span>
                <span class="notepad-status" id="notepadStatus" aria-live="polite"></span>
                <button type="button" class="clear-btn notepad-clear"
                        id="notepadClear" title="Erase all notes">CLEAR</button>
            </div>
            <textarea id="notepadText" class="notepad-text"
                      placeholder="Type your notes here..."
                      spellcheck="false" aria-label="Notes"></textarea>
        `;

        // Just before the bottom tools (appends if they are missing)
        container.insertBefore(panel, container.querySelector('.bottom-tools-grid'));

        const textarea = $('notepadText');
        const status = $('notepadStatus');
        let timer = null;

        textarea.value = Store.getRaw(STORAGE_KEYS.notes) || '';

        function save() {
            clearTimeout(timer);
            timer = null;
            const ok = Store.setRaw(STORAGE_KEYS.notes, textarea.value);
            status.textContent = ok ? 'Saved' : 'Could not save!';
            status.classList.toggle('error', !ok);
            Log.debug('notepad saved', textarea.value.length, 'chars');
        }

        textarea.addEventListener('input', () => {
            status.textContent = 'Saving...';
            status.classList.remove('error');
            clearTimeout(timer);
            timer = setTimeout(save, NOTEPAD_SAVE_DELAY_MS);
        });

        // Never lose the last few keystrokes
        textarea.addEventListener('blur', () => { if (timer) save(); });
        window.addEventListener('pagehide', () => { if (timer) save(); });

        $('notepadClear').addEventListener('click', () => {
            if (textarea.value && !confirm('Erase everything in the notepad?')) return;
            textarea.value = '';
            save();
            textarea.focus();
        });
    }

    /* =================================================================
     * 18. STARTUP + DEBUG API
     * ================================================================= */

    // Returns a list of problems in the current data (empty = healthy).
    function validateState() {
        const problems = [];
        const taskNames = new Set();

        state.rows.forEach((row, i) => {
            if (!row || typeof row !== 'object') {
                problems.push(`row ${i}: not an object`);
                return;
            }

            if (!row.type) taskNames.add(row.task);

            if (row.type === 'special') {
                if (!Array.isArray(row.fields)) problems.push(`row ${i} (${row.task}): special row has no fields`);
                if (Array.isArray(row.fields) && Array.isArray(row.values) &&
                    row.values.length > row.fields.length) {
                    problems.push(`row ${i} (${row.task}): more values than fields`);
                }
            }

            ['items', 'time'].forEach(field => {
                const v = row[field];
                if (v !== undefined && v !== '' && !Number.isFinite(Number(v))) {
                    problems.push(`row ${i} (${row.task}): "${field}" is not a number: ${JSON.stringify(v)}`);
                }
            });
        });

        state.rows.forEach((row, i) => {
            if (row && row.type === 'subtotal' && !taskNames.has(getSubtotalParent(row))) {
                problems.push(`row ${i}: subtotal "${row.task}" has no matching task rows`);
            }
        });

        ['fbp', 'datadog'].forEach(type => {
            const count = state.rows.filter(r => r && r.type === type).length;
            if (count !== 1) problems.push(`expected exactly 1 "${type}" row, found ${count}`);
        });

        return problems;
    }

    window.ProductionTracker = {
        state,
        config: CONFIG,
        debug: on => Log.setEnabled(on === undefined ? !Log.isEnabled() : on),
        validate() {
            const problems = validateState();
            if (problems.length) console.warn('Problems found:', problems);
            else console.info('State looks healthy.');
            return problems;
        },
        dump() {
            console.table(state.rows.map((r, index) => ({
                index,
                type: r.type || 'task',
                task: r.task,
                items: r.items,
                time: r.time,
                visible: r.visible
            })));
        },
        resetStorage() {
            if (!confirm('Delete ALL saved Production Tracker data and reload?')) return;
            Object.values(STORAGE_KEYS).forEach(key => {
                try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
            });
            location.reload();
        }
    };

    function init() {
        safeInit('theme', initTheme);
        safeInit('production date', initProductionDate);
        safeInit('shift name', initShiftName);
        safeInit('shift selector', initShiftSelector);

        // State must exist before anything renders
        safeInit('state', () => {
            loadCustomTasks();
            loadDeletedBuiltIns();
            state.rows = buildDefaultRows();
            loadSavedProduction();
        });

        safeInit('task buttons', initTaskButtons);
        safeInit('table events', initTableEvents);
        safeInit('overtime', initOvertime);
        safeInit('comma tool', initCommaTool);
        safeInit('clear all', initClearAll);
        safeInit('screenshot', initScreenshot);
        safeInit('calculator', initCalculator);
        safeInit('notepad', initNotepad);

        safeInit('first render', renderTable);

        if (Log.isEnabled()) {
            const problems = validateState();
            if (problems.length) Log.warn('Data problems on startup:', problems);
        }

        Log.debug('ready. Try ProductionTracker.dump() / .validate()');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();