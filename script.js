document.addEventListener('DOMContentLoaded', () => {

    // ===============================
// PRODUCTION DATE
// ===============================

const PRODUCTION_DATE_KEY = 'productionTrackerDate';
const SHIFT_NAME_KEY = 'productionTrackerShiftName';
const DEFAULT_SHIFT_NAME = 'Keith Arcedes';

const productionDateInput = document.getElementById('productionDate');
const productionDayDisplay = document.getElementById('productionDay');

function getTodayDateString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function updateProductionDay() {
    if (!productionDateInput || !productionDayDisplay) return;

    const selectedDate = productionDateInput.value;

    if (!selectedDate) {
        productionDayDisplay.textContent = '';
        return;
    }

    // Add time locally so the selected date doesn't shift
    // because of timezone conversion.
    const date = new Date(selectedDate + 'T00:00:00');

    productionDayDisplay.textContent = date.toLocaleDateString(
        'en-US',
        {
            weekday: 'long'
        }
    );
}

// Load saved date, or default to today's date
if (productionDateInput) {
    const savedDate = localStorage.getItem(PRODUCTION_DATE_KEY);

    productionDateInput.value = savedDate || getTodayDateString();

    updateProductionDay();

    productionDateInput.addEventListener('change', () => {
        localStorage.setItem(
            PRODUCTION_DATE_KEY,
            productionDateInput.value
        );

        updateProductionDay();
    });
}


    // =========================================
    // EDITABLE NAME (Shift section)
    // =========================================
    const shiftNameInput = document.getElementById('shiftName');

    if (shiftNameInput) {

        const savedName = localStorage.getItem(SHIFT_NAME_KEY);

        shiftNameInput.value =
            (savedName && savedName.trim()) || DEFAULT_SHIFT_NAME;

        shiftNameInput.addEventListener('input', () => {
            localStorage.setItem(
                SHIFT_NAME_KEY,
                shiftNameInput.value
            );
        });

        // Never leave the name blank
        shiftNameInput.addEventListener('blur', () => {
            const cleaned =
                shiftNameInput.value.replace(/\s+/g, ' ').trim();

            shiftNameInput.value = cleaned || DEFAULT_SHIFT_NAME;

            localStorage.setItem(
                SHIFT_NAME_KEY,
                shiftNameInput.value
            );
        });

        // Enter finishes editing
        shiftNameInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                shiftNameInput.blur();
            }
        });

        // Select everything on click so retyping is quick
        shiftNameInput.addEventListener('focus', () => {
            shiftNameInput.select();
        });
    }

    // "Keith Arcedes" -> "ARCEDES, KEITH" (used for the screenshot file name)
    function getNameForFile() {
        const cleanName = (
            (shiftNameInput && shiftNameInput.value) || DEFAULT_SHIFT_NAME
        )
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Already typed as "Last, First" -> use exactly as typed
        if (cleanName.includes(',')) {
            return cleanName.toUpperCase();
        }

        const parts = cleanName.split(' ').filter(Boolean);

        if (parts.length === 0) return 'PRODUCTION';
        if (parts.length === 1) return parts[0].toUpperCase();

        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');

        return `${last}, ${first}`.toUpperCase();
    }
// =========================================
// SCREENSHOT PRODUCTION
// =========================================

const screenshotProductionBtn =
    document.getElementById('screenshotProductionBtn');


if (screenshotProductionBtn) {

    screenshotProductionBtn.addEventListener(
        'click',
        async () => {

            const screenshotArea =
                document.getElementById('screenshotArea');


            if (!screenshotArea) {

                alert('Screenshot area not found.');

                return;
            }


            const originalText =
                screenshotProductionBtn.innerText;


            screenshotProductionBtn.innerText =
                'CAPTURING...';

            screenshotProductionBtn.disabled = true;


            let screenshotClone = null;


            try {

                // =========================================
                // GET ORIGINAL SIZE
                // =========================================

                const rect =
                    screenshotArea.getBoundingClientRect();


                const width =
                    Math.ceil(rect.width);


                const height =
                    Math.ceil(
                        screenshotArea.scrollHeight
                    );


                // =========================================
                // CREATE A TEMPORARY CLONE
                // =========================================

                screenshotClone =
                    screenshotArea.cloneNode(true);


                screenshotClone.id =
                    'screenshotClone';


                screenshotClone.style.position =
                    'absolute';

                screenshotClone.style.left =
                    '-10000px';

                screenshotClone.style.top =
                    '0';

                screenshotClone.style.width =
                    `${width}px`;

                screenshotClone.style.height =
                    `${height}px`;

                screenshotClone.style.minWidth =
                    `${width}px`;

                screenshotClone.style.maxWidth =
                    `${width}px`;

                screenshotClone.style.background =
                    getComputedStyle(document.body).backgroundColor;

                screenshotClone.style.overflow =
                    'visible';

                screenshotClone.style.boxSizing =
                    'border-box';


                document.body.appendChild(
                    screenshotClone
                );


                // =========================================
                // FIX INPUTS FOR SCREENSHOT
                //
                // html2canvas can clip text inside
                // native INPUT elements.
                //
                // We replace the inputs in the temporary
                // screenshot copy with normal DIV elements.
                // =========================================

                const originalInputs =
                    screenshotArea.querySelectorAll(
                        'input, select, textarea'
                    );


                const clonedInputs =
                    screenshotClone.querySelectorAll(
                        'input, select, textarea'
                    );


                clonedInputs.forEach(
                    (clonedElement, index) => {

                        const originalElement =
                            originalInputs[index];


                        if (!originalElement) {
                            return;
                        }


                        // ---------------------------------
                        // Get displayed value
                        // ---------------------------------

                        let value = '';


                        if (
                            originalElement.tagName
                                .toLowerCase() === 'select'
                        ) {

                            const selectedOption =
                                originalElement.options[
                                    originalElement.selectedIndex
                                ];


                            if (selectedOption) {

                                value =
                                    selectedOption.textContent;

                            }

                        } else {

                            value =
                                originalElement.value || '';

                            // Date inputs hold ISO text (2026-10-07).
                            // Show it the way the app displays it
                            // (e.g. 10/07/2026) in the screenshot.
                            if (
                                originalElement.type === 'date' &&
                                /^\d{4}-\d{2}-\d{2}$/.test(value)
                            ) {
                                const [y, m, d] =
                                    value.split('-').map(Number);

                                value = new Date(y, m - 1, d)
                                    .toLocaleDateString(
                                        undefined,
                                        {
                                            month: '2-digit',
                                            day: '2-digit',
                                            year: 'numeric'
                                        }
                                    );
                            }

                        }


                        // ---------------------------------
                        // Get original visual styles
                        // ---------------------------------

                        const styles =
                            window.getComputedStyle(
                                originalElement
                            );


                        // ---------------------------------
                        // Create screenshot-safe element
                        // ---------------------------------

                        const replacement =
                            document.createElement(
                                'div'
                            );


                        replacement.textContent =
                            value;


                        // ---------------------------------
                        // Copy important styles
                        // ---------------------------------

                        replacement.style.width =
                            styles.width;

                        replacement.style.height =
                            styles.height;

                        replacement.style.minHeight =
                            styles.minHeight;

                        replacement.style.boxSizing =
                            styles.boxSizing;

                        replacement.style.backgroundColor =
                            styles.backgroundColor;

                        replacement.style.border =
                            styles.border;

                        replacement.style.borderRadius =
                            styles.borderRadius;

                        replacement.style.color =
                            styles.color;

                        replacement.style.fontFamily =
                            styles.fontFamily;

                        replacement.style.fontSize =
                            styles.fontSize;

                        replacement.style.fontWeight =
                            styles.fontWeight;

                        replacement.style.textAlign =
                            styles.textAlign;

                        replacement.style.padding =
                            styles.padding;

                        replacement.style.margin =
                            styles.margin;

                        replacement.style.letterSpacing =
                            styles.letterSpacing;

                        replacement.style.lineHeight =
                            styles.lineHeight;

                        replacement.style.display =
                            'flex';

                        replacement.style.alignItems =
                            'center';

                        replacement.style.justifyContent =
                            styles.textAlign === 'center'
                                ? 'center'
                                : styles.textAlign === 'right'
                                    ? 'flex-end'
                                    : 'flex-start';

                        replacement.style.overflow =
                            'visible';

                        replacement.style.whiteSpace =
                            'nowrap';


                        // ---------------------------------
                        // Preserve classes if needed
                        // ---------------------------------

                        replacement.className =
                            clonedElement.className;


                        // ---------------------------------
                        // Replace input
                        // ---------------------------------

                        clonedElement.replaceWith(
                            replacement
                        );

                    }
                );


                // =========================================
                // GIVE BROWSER TIME TO RENDER CLONE
                // =========================================

                await new Promise(
                    resolve =>
                        requestAnimationFrame(
                            () => resolve()
                        )
                );


                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );


                // =========================================
                // CAPTURE
                // =========================================

                const canvas =
                    await html2canvas(
                        screenshotClone,
                        {

                            backgroundColor:
                                getComputedStyle(document.body).backgroundColor,

                            scale: 1,

                            useCORS: true,

                            logging: false,

                            width: width,

                            height: height,

                            scrollX: 0,

                            scrollY: 0

                        }
                    );


                // =========================================
                // DOWNLOAD
                // =========================================

                canvas.toBlob(
                    blob => {

                        if (!blob) {

                            alert(
                                'Could not create screenshot.'
                            );

                            return;
                        }


                        const url =
                            URL.createObjectURL(
                                blob
                            );


                        const link =
                            document.createElement(
                                'a'
                            );


                        // ---------------------------------
                        // Filename
                        // ---------------------------------

                        const now =
                            new Date();


                        const month =
                            String(
                                now.getMonth() + 1
                            ).padStart(
                                2,
                                '0'
                            );


                        const day =
                            String(
                                now.getDate()
                            ).padStart(
                                2,
                                '0'
                            );


                        const year =
                            now.getFullYear();


                        const formattedDate =
                            `${month}.${day}.${year}`;


                        link.download =
                            `${getNameForFile()} ${formattedDate}.png`;


                        link.href =
                            url;


                        link.click();


                        setTimeout(
                            () => {

                                URL.revokeObjectURL(
                                    url
                                );

                            },
                            1000
                        );

                    },
                    'image/png'
                );


            } catch (error) {

                console.error(
                    'Screenshot error:',
                    error
                );


                alert(
                    'Something went wrong while taking the screenshot.'
                );


            } finally {

                // =========================================
                // REMOVE TEMPORARY CLONE
                // =========================================

                if (screenshotClone) {

                    screenshotClone.remove();

                }


                screenshotProductionBtn.innerText =
                    originalText;


                screenshotProductionBtn.disabled =
                    false;

            }

        }
    );

}

const tbody = document.getElementById('prodTableBody');
let rowsData = [];

// =========================================
// LOCAL PRODUCTION DATA SAVE / LOAD
// =========================================

const PRODUCTION_DATA_KEY = 'productionTrackerData';
const OT_KEY = 'productionTrackerOT';
const SHIFT_KEY = 'productionTrackerShift';

function saveProductionData() {
    try {
        localStorage.setItem(
            PRODUCTION_DATA_KEY,
            JSON.stringify(rowsData)
        );

        localStorage.setItem(
            OT_KEY,
            String(selectedOT)
        );

        const shiftSelector =
            document.getElementById('shiftSelector');

        if (shiftSelector) {
            localStorage.setItem(
                SHIFT_KEY,
                shiftSelector.value
            );
        }

        console.log('Production data saved locally.');

    } catch (error) {
        console.error(
            'Could not save production data:',
            error
        );
    }
}

function loadProductionData() {
    try {
        const savedData =
            localStorage.getItem(PRODUCTION_DATA_KEY);

        if (savedData) {
            const parsedData =
                JSON.parse(savedData);

            if (Array.isArray(parsedData)) {
                rowsData = parsedData;

                // Actual-time rows have no rate
                rowsData.forEach(r => {
                    if (r && r.timeMode === 'actual') {
                        r.rate = '**';
                    }
                });

                console.log(
                    'Production data restored from local storage.'
                );
            }
        }

        // Restore OT
        const savedOT =
            localStorage.getItem(OT_KEY);

        if (savedOT !== null) {
            selectedOT =
                Number(savedOT) || 0;
        }

        // Restore Shift
        const savedShift =
            localStorage.getItem(SHIFT_KEY);

        const shiftSelector =
            document.getElementById('shiftSelector');

        if (
            shiftSelector &&
            savedShift
        ) {
            const shiftExists =
                Array.from(
                    shiftSelector.options
                ).some(
                    option =>
                        option.value === savedShift
                );

            if (shiftExists) {
                shiftSelector.value =
                    savedShift;
            }
        }

    } catch (error) {
        console.error(
            'Could not load production data:',
            error
        );
    }
}

// =========================================
// OVERTIME / MINUTES REMAINING
// =========================================

let selectedOT = 0;

function updateOTMinutesDisplay(totalTime) {

    const baseMinutes = 480;

    const availableMinutes =
        baseMinutes + selectedOT;

    const remainingMinutes =
        availableMinutes - (Number(totalTime) || 0);

    const display =
        document.getElementById('otMinutesDisplay');

    if (display) {
        display.innerText = remainingMinutes;
    }
}
    // =========================================
    // TASK VISIBILITY
    // =========================================

    let taskVisibility = {
        'Tag': false,
        'TagLite': false,
        'QC Lite': false,
        'Tag QC': true,
        'Image': false,
        'FBP Checks': false,
        'Datadog': false
    };

    // =========================================
    // CUSTOM TASK SETTINGS
    // =========================================

    const CUSTOM_TASKS_KEY = 'productionTrackerCustomTasks';
    const BUILT_IN_TASKS = [
        'Tag', 'TagLite', 'QC Lite', 'Tag QC', 'Image',
        'FBP Checks', 'Datadog'
    ];

    let customTaskSettings = {};

    // Actual-time tasks have no rate, so the Rate column shows "**"
    const ACTUAL_RATE = '**';

    function normalizeRate(timeMode, rate) {
        return timeMode === 'actual'
            ? ACTUAL_RATE
            : (Number(rate) || 1);
    }

    function loadCustomTaskSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(CUSTOM_TASKS_KEY));

            if (Array.isArray(saved)) {
                saved.forEach(task => {
                    if (task && task.name) {
                        customTaskSettings[task.name] = {
                            rate: normalizeRate(task.timeMode === 'actual' ? 'actual' : 'rate', task.rate),
                            timeMode: task.timeMode === 'actual' ? 'actual' : 'rate',
                            actualTime: 0
                        };
                    }
                });
            }
        } catch (error) {
            console.warn('Could not load custom tasks:', error);
            customTaskSettings = {};
        }
    }

    function saveCustomTaskSettings() {
        const saved = Object.entries(customTaskSettings).map(([name, settings]) => ({
            name,
            rate: normalizeRate(settings.timeMode, settings.rate),
            timeMode: settings.timeMode === 'actual' ? 'actual' : 'rate',
            actualTime: 0
        }));

        localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(saved));
    }

    function getTaskSettings(taskName) {
        if (customTaskSettings[taskName]) return customTaskSettings[taskName];

        return {
            rate: getDefaultRate(taskName) || 1,
            timeMode: 'rate',
            actualTime: 0
        };
    }

    function addCustomTask(taskName, rate, timeMode, actualTime) {
        customTaskSettings[taskName] = {
            rate: normalizeRate(timeMode, rate),
            timeMode: timeMode === 'actual' ? 'actual' : 'rate',
            actualTime: 0
        };

        taskVisibility[taskName] = true;

        const settings = customTaskSettings[taskName];

        rowsData.push({
            task: taskName,
            merchant: '',
            items: '',
            time: settings.timeMode === 'actual' ? settings.actualTime : 0,
            rate: settings.rate,
            timeMode: settings.timeMode,
            actualTime: settings.actualTime,
            status: 'WORKING',
            visible: true
        });

        rowsData.push({
            type: 'subtotal',
            task: `TOTAL (${taskName})`,
            visible: true
        });

        saveCustomTaskSettings();
    }

            // =========================================
            // NEW TASK DIALOG (replaces prompt(), which Electron doesn't support)
            // =========================================

            function openNewTaskDialog(onSubmit) {

                if (document.getElementById('newTaskOverlay')) return;

                const overlay = document.createElement('div');
                overlay.id = 'newTaskOverlay';
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal-box" role="dialog" aria-modal="true">
                        <h3>New Task</h3>

                        <label>Task name</label>
                        <input type="text" id="ntName" placeholder="e.g. Audit">

                        <label>Rate</label>
                        <input type="number" id="ntRate" step="any" min="0" placeholder="e.g. 1.2">

                        <label>Time</label>
                        <div class="modal-radio">
                            <label><input type="radio" name="ntMode" value="rate" checked> Calculate from Items &times; Rate</label>
                            <label><input type="radio" name="ntMode" value="actual"> Use actual time (typed in the table)</label>
                        </div>


                        <div class="modal-error" id="ntError"></div>

                        <div class="modal-actions">
                            <button type="button" class="clear-btn" id="ntCancel">CANCEL</button>
                            <button type="button" class="action-btn" id="ntCreate">CREATE TASK</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(overlay);

                const $ = id => overlay.querySelector('#' + id);
                const close = () => overlay.remove();

                const showError = msg => { $('ntError').textContent = msg; };


                function submit() {
                    const name = $('ntName').value.trim();
                    const useActual = overlay.querySelector('input[name="ntMode"]:checked').value === 'actual';
                    const rate = useActual ? ACTUAL_RATE : Number($('ntRate').value);
                    const actualTime = 0; // actual time is typed per row in the table

                    if (!name) return showError('Please enter a task name.');
                    if (!useActual && (!Number.isFinite(rate) || rate <= 0)) return showError('Please enter a valid rate greater than 0.');

                    const error = onSubmit(name, rate, useActual, actualTime);
                    if (error) return showError(error);

                    close();
                }

                $('ntCreate').addEventListener('click', submit);
                $('ntCancel').addEventListener('click', close);
                overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
                overlay.addEventListener('keydown', e => {
                    if (e.key === 'Escape') close();
                    if (e.key === 'Enter') submit();
                });

                const rateInput = $('ntRate');
                overlay.querySelectorAll('input[name="ntMode"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        const actual = overlay.querySelector('input[name="ntMode"]:checked').value === 'actual';
                        if (actual) {
                            rateInput.type = 'text';
                            rateInput.value = ACTUAL_RATE;
                            rateInput.disabled = true;
                        } else {
                            rateInput.disabled = false;
                            rateInput.type = 'number';
                            rateInput.value = '';
                        }
                    });
                });
                $('ntName').focus();
            }

            // =========================================
            // CUSTOM TASK BUTTONS
            // =========================================

            function renderTaskButtons() {

                const container = document.querySelector('.task-toggles');

                if (!container) {
                    console.error('NEW TASK ERROR: .task-toggles was not found.');
                    return;
                }

                console.log('renderTaskButtons() is running');


                // Remove old custom task controls
                container
                    .querySelectorAll('.custom-task-control')
                    .forEach(element => element.remove());


                // Remove old NEW TASK button
                const oldNewTaskButton = document.getElementById('newTaskBtn');

                if (oldNewTaskButton) {
                    oldNewTaskButton.remove();
                }


                // =========================================
                // CREATE CUSTOM TASK BUTTONS
                // =========================================

                Object.keys(customTaskSettings).forEach(taskName => {

                    const control = document.createElement('div');

                    control.className = 'custom-task-control';


                    // Main custom task button
                    const button = document.createElement('button');

                    button.type = 'button';

                    button.className =
                        'toggle-btn custom-task-btn' +
                        (taskVisibility[taskName] ? ' active' : '');

                    button.dataset.customTask = taskName;

                    button.textContent = taskName.toUpperCase();


                    // Delete button
                    const deleteButton = document.createElement('button');

                    deleteButton.type = 'button';

                    deleteButton.className = 'custom-task-delete-btn';

                    deleteButton.dataset.deleteCustomTask = taskName;

                    deleteButton.textContent = '×';

                    deleteButton.title = `Delete ${taskName}`;


                    control.appendChild(button);
                    control.appendChild(deleteButton);

                    container.appendChild(control);

                });


                // =========================================
                // CREATE NEW TASK BUTTON
                // =========================================

                const newTaskButton = document.createElement('button');

                newTaskButton.type = 'button';

                newTaskButton.id = 'newTaskBtn';

                newTaskButton.className = 'new-task-btn';

                newTaskButton.textContent = '+ NEW TASK';

                newTaskButton.title = 'Create a new task';


                container.appendChild(newTaskButton);


                // =========================================
                // CLICK HANDLER
                // =========================================

                container.onclick = function (event) {

                    console.log(
                        'Task toggle area clicked:',
                        event.target
                    );


                    // =====================================
                    // DELETE CUSTOM TASK
                    // =====================================

                    const deleteButton =
                        event.target.closest('.custom-task-delete-btn');

                    if (deleteButton) {

                        event.preventDefault();

                        event.stopPropagation();


                        const taskName =
                            deleteButton.dataset.deleteCustomTask;


                        const confirmed = confirm(
                            `Delete the custom task "${taskName}"?\n\n` +
                            `This will remove the task and all of its rows.`
                        );


                        if (!confirmed) {
                            return;
                        }


                        delete customTaskSettings[taskName];

                        delete taskVisibility[taskName];


                        rowsData = rowsData.filter(row => {

                            return (
                                row.task !== taskName &&
                                row.task !== `TOTAL (${taskName})`
                            );

                        });


                        saveCustomTaskSettings();

                        saveProductionData();

                        renderTaskButtons();

                        renderTable();

                        return;
                    }


                    // =====================================
                    // CUSTOM TASK TOGGLE
                    // =====================================

                    const customButton =
                        event.target.closest('.custom-task-btn');

                    if (customButton) {

                        event.preventDefault();


                        const taskName =
                            customButton.dataset.customTask;


                        taskVisibility[taskName] =
                            !taskVisibility[taskName];


                        customButton.classList.toggle(
                            'active',
                            taskVisibility[taskName]
                        );


                        renderTable();

                        return;
                    }


                    // =====================================
                    // NEW TASK
                    // =====================================

                    const newTaskButtonClicked =
                        event.target.closest('#newTaskBtn');


                    if (!newTaskButtonClicked) {
                        return;
                    }


                    event.preventDefault();


                    console.log('=================================');
                    console.log('NEW TASK BUTTON CLICKED');
                    console.log('=================================');


                    openNewTaskDialog(function (cleanName, rate, useActualTime, actualTime) {

                        const exists = Object.keys(taskVisibility).some(task =>
                            task.toLowerCase() === cleanName.toLowerCase()
                        );

                        if (exists) {
                            return 'A task with this name already exists.';
                        }

                        addCustomTask(
                            cleanName,
                            rate,
                            useActualTime ? 'actual' : 'rate',
                            actualTime
                        );

                        saveProductionData();
                        renderTaskButtons();
                        renderTable();

                        return null; // success -> close dialog
                    });

                };

            }

    loadCustomTaskSettings();

    Object.keys(customTaskSettings).forEach(taskName => {
        const settings = customTaskSettings[taskName];
        taskVisibility[taskName] = true;

        rowsData.push({
            task: taskName,
            merchant: '',
            items: '',
            time: settings.timeMode === 'actual' ? settings.actualTime : 0,
            rate: settings.rate,
            timeMode: settings.timeMode,
            actualTime: settings.actualTime,
            status: 'WORKING',
            visible: true
        });

        rowsData.push({
            type: 'subtotal',
            task: `TOTAL (${taskName})`,
            visible: true
        });
    });

    // =========================================
    // DEFAULT RATES
    // =========================================

    function getDefaultRate(taskName) {

        if (taskName === 'Tag') return 1.2;
        if (taskName === 'TagLite') return 1.0;
        if (taskName === 'QC Lite') return 0.42;
        if (taskName === 'Tag QC') return 0.88;
        if (taskName === 'Image') return 0.073;

        return '';
    }

    // =========================================
    // TIME CALCULATION
    // =========================================

    function calculateTime(items, rate) {
    const itm = Number(items) || 0;
    const rt = Number(rate) || 0;
    const rawTime = itm * rt;
    return Math.round(rawTime / 5) * 5;
}

    // =========================================
    // GENERATE NORMAL TASK ROWS
    // =========================================

    function generateTaskRows(
        taskName,
        count,
        defaultMerchant = '',
        defaultItems = 0,
        defaultRate = null,
        defaultStatus = 'WORKING',
        timeMode = 'rate',
        actualTime = 0
    ) {

        const rate =
            defaultRate !== null
                ? defaultRate
                : getDefaultRate(taskName);

        for (let i = 0; i < count; i++) {

            let itms =
                (i === 0 && defaultItems > 0)
                    ? defaultItems
                    : '';

            rowsData.push({
                task: taskName,

                merchant:
                    i === 0 && defaultMerchant
                        ? defaultMerchant
                        : '',

                items: itms,

                time:
                    timeMode === 'actual'
                        ? actualTime
                        : calculateTime(itms, rate),

                rate: rate,

                timeMode: timeMode,

                actualTime: actualTime,

                status:
                    i === 0
                        ? defaultStatus
                        : 'WORKING',

                visible: true
            });
        }

        // Subtotal row
        rowsData.push({
            type: 'subtotal',
            task: `TOTAL (${taskName})`,
            visible: true
        });
    }

    // =========================================
    // INITIAL TASKS
    // =========================================

    generateTaskRows(
        'Tag',
        5,
        '',
        0,
        1.2,
        'WORKING'
    );

    generateTaskRows(
        'TagLite',
        3,
        '',
        0,
        1.0,
        'WORKING'
    );

    generateTaskRows(
        'QC Lite',
        3,
        '',
        0,
        0.42,
        'WORKING'
    );

    generateTaskRows(
        'Tag QC',
        5,
        '',
        0,
        0.88,
        'WORKING'
    );

    generateTaskRows(
        'Image',
        3,
        '',
        0,
        0.073,
        'WORKING'
    );

    // =========================================
    // DATADOG SINGLE ROW
    // =========================================

    rowsData.push({
        type: 'datadog',
        task: 'FBP Data Dog Monitoring',
        items: 0,
        time: 0,
        visible: true
    });

    // =========================================
    // FBP SINGLE ROW
    // =========================================

    rowsData.push({
        type: 'fbp',
        task: 'FBP Checks',
        merchant: '',
        items: 0,
        time: 0,
        visible: true
    });

    // =========================================
    // RESTORE SAVED PRODUCTION DATA
    // =========================================

    loadProductionData();

    // =========================================
    // RENDER TABLE
    // =========================================

    function renderTable() {

        tbody.innerHTML = '';

        let taskGroups = {};

        rowsData.forEach((row, index) => {

            let t;

            if (row.type === 'fbp') {

                t = 'fbp';

            } else if (row.type === 'datadog') {

                t = 'datadog';

            } else {

                t = row.task || row.type;
            }

            if (!taskGroups[t]) {
                taskGroups[t] = [];
            }

            taskGroups[t].push({
                row,
                index
            });
        });

        Object.keys(taskGroups).forEach(taskKey => {

            let isGroupEnabled = true;

            // =====================================
            // NORMAL TASK
            // =====================================

            if (
                !taskKey.startsWith('TOTAL') &&
                taskKey !== 'fbp' &&
                taskKey !== 'datadog'
            ) {

                isGroupEnabled =
                    taskVisibility[taskKey] !== undefined
                        ? taskVisibility[taskKey]
                        : true;
            }

            // =====================================
            // SUBTOTAL
            // =====================================

            else if (taskKey.startsWith('TOTAL')) {

                let originalTaskName =
                    taskKey
                        .replace('TOTAL (', '')
                        .replace(')', '');

                isGroupEnabled =
                    taskVisibility[originalTaskName] !== undefined
                        ? taskVisibility[originalTaskName]
                        : true;
            }

            // =====================================
            // FBP
            // =====================================

            else if (taskKey === 'fbp') {

                isGroupEnabled =
                    taskVisibility['FBP Checks'] !== undefined
                        ? taskVisibility['FBP Checks']
                        : true;
            }

            // =====================================
            // DATADOG
            // =====================================

            else if (taskKey === 'datadog') {

                isGroupEnabled =
                    taskVisibility['Datadog'] !== undefined
                        ? taskVisibility['Datadog']
                        : true;
            }

            if (!isGroupEnabled) {
                return;
            }

            let group = taskGroups[taskKey];

            let visibleGroupRows =
                group.filter(item => item.row.visible);

            let visibleCount =
                visibleGroupRows.length;

            // =====================================
            // SPECIAL ROWS
            // =====================================

            if (
                taskKey.startsWith('TOTAL') ||
                taskKey === 'fbp' ||
                taskKey === 'datadog'
            ) {

                group.forEach(item => {

                    let row = item.row;
                    let index = item.index;

                    if (!row.visible) {
                        return;
                    }

                    const tr =
                        document.createElement('tr');

                    // =================================
                    // SUBTOTAL
                    // =================================

                    if (row.type === 'subtotal') {

                        tr.className =
                            'subtotal-row';

                        let cleanName =
                            taskKey
                                .replace('TOTAL (', '')
                                .replace(')', '');

                        tr.innerHTML = `
                            <td
                                colspan="2"
                                class="subtotal-label-cell"
                            >

                                <button
                                    class="add-row-btn-subtotal"
                                    data-task="${cleanName}"
                                    title="Add Row"
                                >
                                    +
                                </button>

                                <span>
                                    ${taskKey}
                                </span>

                            </td>

                            <td>
                                <input
                                    type="text"
                                    class="calc-items"
                                    value="${calcSubtotalItems(cleanName)}"
                                    readonly
                                >
                            </td>

                            <td>
                                <input
                                    type="text"
                                    class="calc-time"
                                    value="${calcSubtotalTime(cleanName)}"
                                    readonly
                                >
                            </td>

                            <td colspan="2"></td>
                        `;

                    }

                    // =================================
                    // FBP CHECKS
                    // =================================

                    else if (row.type === 'fbp') {

                        tr.className =
                            'section-header-row fbp-row';

                        tr.innerHTML = `

                            <td class="fbp-task-cell">
                                <strong>
                                    ${row.task}
                                </strong>
                            </td>

                            <td
                                colspan="2"
                                class="fbp-ulp-cell"
                            >
                                <input
                                    type="text"
                                    value="${row.merchant}"
                                    data-field="merchant"
                                    data-index="${index}"
                                    placeholder="TOTAL ULP"
                                >
                            </td>

                            <td class="fbp-items-cell">
                                <input
                                    type="number"
                                    value="${row.items}"
                                    data-field="items"
                                    data-index="${index}"
                                    class="calc-items no-spinner"
                                >
                            </td>

                            <td
                                colspan="2"
                                class="fbp-time-cell"
                            >
                                <input
                                    type="number"
                                    value="${row.time}"
                                    data-field="time"
                                    data-index="${index}"
                                    class="calc-time no-spinner"
                                >
                            </td>

                        `;
                    }

                    // =================================
                    // DATADOG
                    // =================================

                    else if (row.type === 'datadog') {

                        tr.className =
                            'section-header-row datadog-row';

                        tr.innerHTML = `

                            <td
                                colspan="4"
                                class="datadog-task-cell"
                            >
                                <strong>
                                    ${row.task}
                                </strong>
                            </td>

                            <td class="datadog-items-cell">
                                <input
                                    type="number"
                                    value="${row.items}"
                                    data-field="items"
                                    data-index="${index}"
                                    class="calc-items no-spinner"
                                >
                            </td>

                            <td class="datadog-time-cell">
                                <input
                                    type="number"
                                    value="${row.time}"
                                    data-field="time"
                                    data-index="${index}"
                                    class="calc-time no-spinner"
                                >
                            </td>

                        `;
                    }

                    tbody.appendChild(tr);
                });

            }

            // =====================================
            // NORMAL TASK ROWS
            // =====================================

            else {

                let firstRendered = false;

                group.forEach(item => {

                    let row = item.row;
                    let index = item.index;

                    if (!row.visible) {
                        return;
                    }

                    const tr =
                        document.createElement('tr');

                    tr.className =
                        'production-row';

                    let taskCellHTML = '';

                    if (!firstRendered) {

                        taskCellHTML = `
                            <td
                                rowspan="${visibleCount}"
                                class="task-group-cell"
                            >
                                <div class="task-label-text">
                                    ${taskKey}
                                </div>
                            </td>
                        `;

                        firstRendered = true;
                    }

                    let statusClass =
                        row.status === 'DONE'
                            ? 'status-done'
                            : 'status-working';

                    tr.innerHTML = `

                        ${taskCellHTML}

                        <td>
                            <input
                                type="text"
                                value="${row.merchant}"
                                data-field="merchant"
                                data-index="${index}"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                value="${
                                    row.items !== ''
                                        ? row.items
                                        : ''
                                }"
                                placeholder="0"
                                data-field="items"
                                data-index="${index}"
                                class="calc-items no-spinner"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                value="${row.time}"
                                data-field="time"
                                data-index="${index}"
                                class="calc-time no-spinner"
                            >
                        </td>

                        <td>
                            <input
                                type="text"
                                value="${row.rate}"
                                data-field="rate"
                                data-index="${index}"
                            >
                        </td>

                        <td class="status-cell">

                            <button
                                class="
                                    status-toggle-btn
                                    ${statusClass}
                                "
                                data-index="${index}"
                            >
                                ${row.status || 'WORKING'}
                            </button>

                            <button
                                class="row-hide-btn"
                                data-index="${index}"
                                title="Delete Row"
                            >
                                ×
                            </button>

                        </td>

                    `;

                    tbody.appendChild(tr);
                });
            }
        });

        attachListeners();
        calculateTotals();
    }

    // =========================================
    // SUBTOTAL ITEMS
    // =========================================

    function calcSubtotalItems(taskName) {

        let sum = 0;

        rowsData.forEach(r => {

            if (
                r.task === taskName &&
                r.visible
            ) {
                sum += Number(r.items) || 0;
            }
        });

        return sum;
    }

    // =========================================
    // SUBTOTAL TIME
    // =========================================

    function calcSubtotalTime(taskName) {

        let sum = 0;

        rowsData.forEach(r => {

            if (
                r.task === taskName &&
                r.visible
            ) {
                sum += Number(r.time) || 0;
            }
        });

        return sum;
    }



// =========================================
// EVENT LISTENERS
// =========================================

function attachListeners() {

    // =====================================
    // INPUTS
    // =====================================

    document
        .querySelectorAll('.prod-table input')
        .forEach(input => {

            input.addEventListener('input', e => {

                const idx =
                    e.target.dataset.index;

                const field =
                    e.target.dataset.field;

                if (
                    idx === undefined ||
                    !field
                ) {
                    return;
                }

                // Save changed value
                rowsData[idx][field] =
                    e.target.value;

                // =================================
                // AUTOMATIC TIME CALCULATION
                // =================================
                //
                // Items or Rate changed:
                // automatically recalculate Time.
                //
                // Time itself changed:
                // keep the manually entered value.
                // =================================

                if (
                    rowsData[idx].type !== 'fbp' &&
                    rowsData[idx].type !== 'datadog' &&
                    rowsData[idx].timeMode !== 'actual' &&
                    (
                        field === 'items' ||
                        field === 'rate'
                    )
                ) {

                    rowsData[idx].time =
                        calculateTime(
                            rowsData[idx].items,
                            rowsData[idx].rate
                        );

                    // Update the Time input visually
                    const timeInput =
                        document.querySelector(
                            `input.calc-time[data-index="${idx}"]`
                        );

                    if (timeInput) {
                        timeInput.value =
                            rowsData[idx].time;
                    }
                }

                // Save AFTER all calculations
                saveProductionData();

                // Update totals
                calculateTotals();
            });
        });


    // =====================================
    // STATUS BUTTON
    // =====================================

    document
        .querySelectorAll('.status-toggle-btn')
        .forEach(btn => {

            btn.addEventListener('click', e => {

                const idx =
                    e.currentTarget.dataset.index;

                if (
                    rowsData[idx].status === 'DONE'
                ) {

                    rowsData[idx].status =
                        'WORKING';

                } else {

                    rowsData[idx].status =
                        'DONE';
                }

                saveProductionData();

                renderTable();
            });
        });


    // =====================================
    // DELETE / HIDE ROW
    // =====================================

    document
        .querySelectorAll('.row-hide-btn')
        .forEach(btn => {

            btn.addEventListener('click', e => {

                const idx =
                    e.currentTarget.dataset.index;

                rowsData[idx].visible = false;

                saveProductionData();

                renderTable();
            });
        });


    // =====================================
    // ADD ROW FROM SUBTOTAL
    // =====================================

    document
        .querySelectorAll('.add-row-btn-subtotal')
        .forEach(btn => {

            btn.addEventListener('click', e => {

                const taskName =
                    e.currentTarget.dataset.task;

                // Find subtotal
                const subtotalIdx =
                    rowsData.findIndex(
                        r =>
                            r.type === 'subtotal' &&
                            r.task ===
                                `TOTAL (${taskName})`
                    );

                // Get task settings
                const taskSettings =
                    getTaskSettings(taskName);

                const defaultRt =
                    taskSettings.timeMode === 'actual'
                        ? ACTUAL_RATE
                        : Number(taskSettings.rate) ||
                    getDefaultRate(taskName) ||
                    1;

                // Create new row
                const newRow = {

                    task: taskName,

                    merchant: '',

                    items: '',

                    time:
                        taskSettings.timeMode === 'actual'
                            ? taskSettings.actualTime
                            : 0,

                    rate: defaultRt,

                    timeMode:
                        taskSettings.timeMode,

                    actualTime:
                        taskSettings.actualTime,

                    status: 'WORKING',

                    visible: true
                };

                // Insert before subtotal
                if (subtotalIdx !== -1) {

                    rowsData.splice(
                        subtotalIdx,
                        0,
                        newRow
                    );

                } else {

                    rowsData.push(newRow);
                }

                saveProductionData();

                renderTable();
            });
        });
}

    // =========================================
    // TOTAL PRODUCTION
    // =========================================


    // Keep every TOTAL (task) row in sync while typing
    function refreshSubtotals() {
        document
            .querySelectorAll('.subtotal-row')
            .forEach(tr => {
                const addBtn =
                    tr.querySelector('.add-row-btn-subtotal');

                if (!addBtn) return;

                const taskName = addBtn.dataset.task;

                const itemsInput =
                    tr.querySelector('input.calc-items');

                const timeInput =
                    tr.querySelector('input.calc-time');

                if (itemsInput) {
                    itemsInput.value = calcSubtotalItems(taskName);
                }

                if (timeInput) {
                    timeInput.value = calcSubtotalTime(taskName);
                }
            });
    }

    function calculateTotals() {

        let totalItems = 0;
        let totalTime = 0;

        rowsData.forEach(row => {

            // =====================================
            // EXCLUDE SUBTOTAL ROWS
            // =====================================

            if (row.type === 'subtotal') {
                return;
            }

            // =====================================
            // CHECK TASK VISIBILITY
            // =====================================

            let isEnabled = true;

            // FBP
            if (row.type === 'fbp') {

                isEnabled =
                    taskVisibility['FBP Checks'] !== undefined
                        ? taskVisibility['FBP Checks']
                        : true;

            }

            // Datadog
            else if (row.type === 'datadog') {

                isEnabled =
                    taskVisibility['Datadog'] !== undefined
                        ? taskVisibility['Datadog']
                        : true;

            }

            // Normal tasks
            else {

                isEnabled =
                    taskVisibility[row.task] !== undefined
                        ? taskVisibility[row.task]
                        : true;
            }

            // =====================================
            // TOTAL ITEMS
            // =====================================
            // FBP and Datadog ITEMS are NOT counted.

            if (
                isEnabled &&
                row.visible &&
                row.items !== '' &&
                row.type !== 'fbp' &&
                row.type !== 'datadog'
            ) {
                totalItems +=
                    Number(row.items) || 0;
            }

            // =====================================
            // TOTAL TIME
            // =====================================
            // FBP and Datadog TIME ARE counted.

            if (
                isEnabled &&
                row.visible &&
                row.time !== ''
            ) {
                totalTime +=
                    Number(row.time) || 0;
            }

        });

        // =====================================
        // DISPLAY TOTALS
        // =====================================

        document.getElementById(
            'totalItems'
        ).innerText = totalItems;

        document.getElementById(
            'totalTime'
        ).innerText = totalTime;

        // =====================================
        // UPDATE MINUTES REMAINING
        // =====================================

        refreshSubtotals();

        updateOTMinutesDisplay(totalTime);
    }

    // =========================================
    // TASK BUTTON MAPPING
    // =========================================

    const taskButtonMapping = {

        'TAG': 'Tag',

        'TAGLITE': 'TagLite',

        'QC LITE': 'QC Lite',

        'TAG QC': 'Tag QC',

        'IMAGE QC': 'Image',

        'FBP': 'FBP Checks',

        'DATADOG': 'Datadog'
    };

    // =========================================
    // TASK TOGGLES
    // =========================================

    document
        .querySelectorAll('.toggle-btn')
        .forEach(btn => {

            let btnText =
                btn.innerText.trim();

            let internalKey =
                taskButtonMapping[btnText];

            if (
                internalKey &&
                taskVisibility[internalKey]
            ) {

                btn.classList.add('active');

            } else {

                btn.classList.remove('active');
            }

            btn.addEventListener(
                'click',
                () => {

                    btn.classList.toggle(
                        'active'
                    );

                    if (internalKey) {

                        taskVisibility[
                            internalKey
                        ] =
                            btn.classList.contains(
                                'active'
                            );

                        renderTable();
                    }
                }
            );
        });


    // =========================================
    // DELETE / RESTORE BUILT-IN TASKS
    // (custom tasks already have their own x button)
    // =========================================
    const DELETED_BUILTINS_KEY = 'productionTrackerDeletedTasks';

    let deletedBuiltIns = [];

    try {
        const savedDeleted =
            JSON.parse(localStorage.getItem(DELETED_BUILTINS_KEY));

        if (Array.isArray(savedDeleted)) {
            deletedBuiltIns = savedDeleted.filter(
                key => BUILT_IN_TASKS.includes(key)
            );
        }
    } catch (error) {
        deletedBuiltIns = [];
    }

    function saveDeletedBuiltIns() {
        try {
            localStorage.setItem(
                DELETED_BUILTINS_KEY,
                JSON.stringify(deletedBuiltIns)
            );
        } catch (error) {
            console.warn('Could not save deleted tasks:', error);
        }
    }

    const restoreTasksBtn = document.getElementById('restoreTasksBtn');

    function applyBuiltInDeletions() {
        document
            .querySelectorAll('.builtin-task-control')
            .forEach(control => {
                const btn = control.querySelector('.toggle-btn');
                const key = taskButtonMapping[btn.innerText.trim()];
                const isDeleted = deletedBuiltIns.includes(key);

                control.style.display = isDeleted ? 'none' : '';

                if (isDeleted) {
                    taskVisibility[key] = false;
                    btn.classList.remove('active');
                }
            });

        if (restoreTasksBtn) {
            restoreTasksBtn.hidden = deletedBuiltIns.length === 0;
            restoreTasksBtn.textContent =
                `↺ RESTORE DELETED TASKS (${deletedBuiltIns.length})`;
        }
    }

    // Wrap each built-in task button together with an x button
    document
        .querySelectorAll('.task-toggles > .toggle-btn')
        .forEach(btn => {
            const label = btn.innerText.trim();
            const key = taskButtonMapping[label];
            if (!key) return;

            const control = document.createElement('div');
            control.className = 'builtin-task-control';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'builtin-task-delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = `Delete ${label}`;

            btn.parentNode.insertBefore(control, btn);
            control.appendChild(btn);
            control.appendChild(deleteBtn);

            deleteBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                const confirmed = confirm(
                    `Delete the task "${label}"?\n\n` +
                    `It will be removed from the task list and left out ` +
                    `of your totals. You can bring it back any time with ` +
                    `the "Restore deleted tasks" button.`
                );

                if (!confirmed) return;

                if (!deletedBuiltIns.includes(key)) {
                    deletedBuiltIns.push(key);
                }

                saveDeletedBuiltIns();
                applyBuiltInDeletions();
                renderTable();
            });
        });

    if (restoreTasksBtn) {
        restoreTasksBtn.addEventListener('click', () => {
            deletedBuiltIns = [];
            saveDeletedBuiltIns();
            applyBuiltInDeletions();
            renderTable();
        });
    }

    applyBuiltInDeletions();

    // =========================================
    // CUSTOM TASK BUTTONS
    // =========================================

    renderTaskButtons();

    // =========================================
    // INITIAL RENDER
    // =========================================

    renderTable();

// =========================================
// OVERTIME BUTTONS
// =========================================

const otButtons =
    document.querySelectorAll('.ot-btn');

otButtons.forEach(btn => {

    btn.addEventListener('click', () => {

        // Remove active state from all buttons
        otButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Activate selected button
        btn.classList.add('active');

        // Store selected OT minutes
        selectedOT =
            Number(btn.dataset.ot) || 0;

        saveProductionData();

        // Get current production time
        const totalTimeElement =
            document.getElementById('totalTime');

        const totalTime =
            Number(totalTimeElement.innerText) || 0;

        // Recalculate remaining minutes
        updateOTMinutesDisplay(totalTime);
    });
        // Restore saved OT button appearance
    otButtons.forEach(btn => {

        const otValue =
            Number(btn.dataset.ot) || 0;

        if (otValue === selectedOT) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

});


    // =========================================
    // COMMA SEPARATOR TOOL
    // =========================================

    const rawInputList =
        document.getElementById(
            'rawInputList'
        );

    const formattedOutput =
        document.getElementById(
            'formattedOutput'
        );

    rawInputList.addEventListener(
        'input',
        () => {

            const lines =
                rawInputList.value
                    .split('\n')
                    .map(i => i.trim())
                    .filter(
                        i => i.length > 0
                    );

            formattedOutput.innerText =
                lines.join(', ');
        }
    );

    // =========================================
    // CLEAR COMMA TOOL
    // =========================================

    document
        .getElementById('clearToolBtn')
        .addEventListener(
            'click',
            () => {

                rawInputList.value = '';

                formattedOutput.innerText =
                    '';
            }
        );

    // =========================================
    // COPY OUTPUT
    // =========================================

    document
        .getElementById('copyOutputBtn')
        .addEventListener(
            'click',
            () => {

                navigator.clipboard.writeText(
                    formattedOutput.innerText
                );

                alert(
                    'Copied to clipboard!'
                );
            }
        );

    // =========================================
    // CLEAR ALL PRODUCTION DATA
    // =========================================

    document
        .getElementById(
            'clearProductionBtn'
        )
        .addEventListener(
            'click',
            () => {

                if (
                    confirm(
                        'Clear all production input values?'
                    )
                ) {

                    rowsData.forEach(r => {

                        // FBP
                        if (
                            r.type === 'fbp'
                        ) {

                            r.merchant = '';
                            r.items = 0;
                            r.time = 0;

                        }

                        // Datadog
                        else if (
                            r.type === 'datadog'
                        ) {

                            r.items = 0;
                            r.time = 0;

                        }

                        // Normal task
                        else if (
                            r.type !== 'subtotal'
                        ) {

                            r.items = '';

                            r.time =
                                r.timeMode === 'actual'
                                    ? r.actualTime
                                    : '';

                            r.merchant = '';

                            r.rate =
                                customTaskSettings[r.task]
                                    ? customTaskSettings[r.task].rate
                                    : getDefaultRate(r.task);

                            r.status =
                                'WORKING';
                        }
                    });

                    saveProductionData();
                    renderTable();
                }
            }
        );

            // =========================================
            // SHIFT SELECTOR
            // =========================================

            const shiftSelector =
                document.getElementById('shiftSelector');

            if (shiftSelector) {

                shiftSelector.addEventListener('change', () => {

                    localStorage.setItem(
                        SHIFT_KEY,
                        shiftSelector.value
                    );

                    console.log(
                        'Shift selected:',
                        shiftSelector.value
                    );

                });

            }

});

// =========================================
// CALCULATOR
// Works with the on-screen buttons AND the
// physical keyboard / numpad.
// =========================================
document.addEventListener('DOMContentLoaded', () => {

    const card = document.getElementById('calculatorCard');
    const displayEl = document.getElementById('calcDisplay');
    const historyEl = document.getElementById('calcHistory');

    if (!card || !displayEl || !historyEl) return;

    const SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const MAX_DIGITS = 15;

    let current = '0';      // number being typed / shown
    let previous = null;    // left-hand value waiting for an operator
    let operator = null;    // '+', '-', '*', '/'
    let overwrite = false;  // next digit starts a new number
    let hasError = false;

    // ---------- helpers ----------

    function clean(number) {
        // Removes floating point noise (0.1 + 0.2 -> 0.3)
        return String(parseFloat(number.toPrecision(12)));
    }

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

    function setHistory(text) {
        historyEl.innerHTML = text || '&nbsp;';
    }

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

    // ---------- actions ----------

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
        if (hasError) return;
        if (current === '0') return;

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
        backspace: backspace,
        percent: percent,
        negate: negate,
        dot: inputDot,
        equals: equals
    };

    // ---------- on-screen buttons ----------

    card.addEventListener('click', event => {
        const btn = event.target.closest('.calc-btn');
        if (!btn) return;

        if (btn.dataset.calcDigit !== undefined) {
            inputDigit(btn.dataset.calcDigit);
        } else if (btn.dataset.calcOp !== undefined) {
            inputOperator(btn.dataset.calcOp);
        } else if (btn.dataset.calcAction) {
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

    document.addEventListener('keydown', event => {

        // Leave browser shortcuts alone (Ctrl+C, etc.)
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        // Don't steal keys while the New Task dialog is open
        if (document.getElementById('newTaskOverlay')) return;

        const target = event.target;

        // Never steal keys while typing in a field
        if (
            target.closest &&
            target.closest('input, textarea, select, [contenteditable="true"]')
        ) {
            return;
        }

        const code = event.code;

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

        let key = event.key;

        if (/^Numpad[0-9]$/.test(code)) {
            key = code.slice(-1);
        } else if (NUMPAD_KEYS[code]) {
            key = NUMPAD_KEYS[code];
        }

        // Enter on some other focused button should still activate that button
        const onOtherControl =
            target.closest &&
            target.closest('button, a') &&
            !card.contains(target);

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

        // Stops "/" quick-find in browsers, page scrolling, and a focused
        // button also "clicking" itself when Enter is pressed.
        event.preventDefault();
    });

    render();
});


// =========================================
// THEME PICKER
// =========================================
document.addEventListener('DOMContentLoaded', () => {

    const THEME_KEY = 'productionTrackerTheme';
    const THEMES = ['midnight', 'forest', 'daylight'];
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

    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}

    applyTheme(saved);

    swatches.forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.theme);
            try {
                localStorage.setItem(THEME_KEY, btn.dataset.theme);
            } catch (e) {}
        });
    });
});