// Daily Business Snapshot Web App
// Author: [Your Name]
// Only HTML, CSS, JS (no external libraries)

// --- Constants ---
const MAX_ROWS = 100;
const DEFAULT_CUSTOMERS = [
    'Customer A', 'Customer B', 'Customer C', 'Customer D', 'Customer E'
];
const TABLE_COLUMNS = [
    { key: 'name', label: 'Name', editable: false },
    { key: 'purchase', label: 'Purchase', editable: true },
    { key: 'booking', label: 'Booking', editable: true },
    { key: 'return', label: 'Return', editable: true },
    { key: 'sell', label: 'SELL', editable: false },
    { key: 'rate', label: 'Rate/PCS', editable: true },
    { key: 'netValue', label: 'NET VALUE', editable: false },
    { key: 'vc', label: 'VC', editable: true },
    { key: 'pwt', label: 'PWT', editable: true }, // Added PWT column
    { key: 'prevDue', label: 'Previous Due', editable: true },
    { key: 'paidInAC', label: 'Paid in A/C', editable: true },
    { key: 'total', label: 'TOTAL', editable: false },
    { key: 'view', label: '', editable: false },
    { key: 'delete', label: '', editable: false }
];

// --- State ---
let tablePage = 1;
const CUSTOMERS_PER_PAGE = 10;
let tableData = [];
let customerCount = 0;
let reportPage = 1;
const REPORTS_PER_PAGE = 5;
const CUSTOMER_LIST_KEY = 'rj-customer-list';
const TABLE_DATA_KEY = 'rj-table-data';

// --- Utility Functions ---
// Show live date under heading
window.addEventListener('DOMContentLoaded', function() {
    var dateDiv = document.getElementById('live-date');
    var calendarInput = document.getElementById('calendar-date');
    function formatDisplayDate(date) {
        var opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return date.toLocaleDateString('en-GB', opts);
    }
    if (dateDiv && calendarInput) {
        // Set input to today
        var today = new Date();
        calendarInput.value = today.toISOString().slice(0, 10);
        let selectedDateStr = calendarInput.value;
        dateDiv.textContent = formatDisplayDate(today);
        // Load table/report for today on load
        loadTableForDate(selectedDateStr);
        // On change, update display and table/report
        calendarInput.addEventListener('change', function() {
            var selected = calendarInput.value;
            if (selected) {
                var d = new Date(selected);
                dateDiv.textContent = formatDisplayDate(d);
                loadTableForDate(selected);
            }
        });
    }
});
function getTodayStr() {
// Load table data for a specific date (yyyy-mm-dd)
function loadTableForDate(dateStr) {
    // Try to load report for this date
    const report = getReportFromLocalStorage(dateStr);
    if (Array.isArray(report)) {
        tableData = deepClone(report);
        customerCount = tableData.length;
        recalcAll();
        renderTable();
        return;
    }
    // If not found, load customer list (default)
    const names = getCustomerList();
    tableData = [];
    customerCount = 0;
    for (const name of names) addCustomerRow(name);
    recalcAll();
    renderTable();
}
    const d = new Date();
    return d.toLocaleDateString('en-GB').split('/').reverse().join('-'); // yyyy-mm-dd
}
function formatDateForFile(dateStr) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}-${mm}-${yyyy}`;
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// --- Table Rendering ---
function renderTable() {
    const section = document.getElementById('table-section');
    let html = '<table id="main-table"><thead><tr>';
    for (const col of TABLE_COLUMNS) {
        // Add heading for view and delete columns
        if (col.key === 'view') html += `<th>View</th>`;
        else if (col.key === 'delete') html += `<th>Delete</th>`;
        else html += `<th>${col.label}</th>`;
    }
    html += '</tr></thead><tbody>';
    // Paging logic
    const startIdx = (tablePage - 1) * CUSTOMERS_PER_PAGE;
    const endIdx = Math.min(startIdx + CUSTOMERS_PER_PAGE, tableData.length);
    for (let idx = startIdx; idx < endIdx; idx++) {
        const row = tableData[idx];
        html += '<tr>';
        TABLE_COLUMNS.forEach(col => {
            if (col.key === 'name') {
                html += `<td style="text-align:left;">
                    <input type="text" class="name-input" data-row="${idx}" value="${row.name}" readonly style="width:120px;" />
                    <span class="edit-icon" title="Edit Name" data-row="${idx}">&#9998;</span>
                </td>`;
            } else if (col.key === 'view') {
                html += `<td><span class="view-icon" title="View Data" data-row="${idx}">&#128065;</span></td>`;
            } else if (col.key === 'delete') {
                html += `<td><button class="delete-row-btn" title="Delete Row" data-row="${idx}">Delete</button></td>`;
            } else if (!col.editable) {
                if (col.key === 'sell' || col.key === 'netValue' || col.key === 'total') {
                    let val = row[col.key];
                    if (val !== undefined && col.key !== 'rate') val = Math.round(val);
                    html += `<td><span class="auto-cell">${val !== undefined ? val : ''}</span></td>`;
                } else {
                    let val = row[col.key];
                    if (val !== undefined && col.key !== 'rate') val = Math.round(val);
                    html += `<td>${val !== undefined ? val : ''}</td>`;
                }
            } else {
                let type = col.key === 'name' ? 'text' : 'number';
                let val = row[col.key];
                if (val !== undefined && col.key !== 'rate') val = Math.round(val);
                if (col.editable) {
                    html += `<td><input type="${type}" min="0" step="1" data-row="${idx}" data-key="${col.key}" value="${val !== undefined ? val : ''}" tabindex="1" /></td>`;
                } else {
                    html += `<td><input type="${type}" min="0" step="1" data-row="${idx}" data-key="${col.key}" value="${val !== undefined ? val : ''}" ${col.key==='name'?'readonly':''}/></td>`;
                }
            }
        });
        html += '</tr>';
    }
    // Calculate totals for all columns that should appear in the Total row
    const totalFields = ['purchase', 'booking', 'return', 'sell', 'rate', 'netValue', 'vc', 'pwt', 'prevDue', 'paidInAC', 'total'];
    const totals = {};
    totalFields.forEach(field => {
        if (field === 'rate') {
            totals[field] = '';
        } else {
            totals[field] = tableData.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
            totals[field] = Math.round(totals[field]);
        }
    });
    // Add Total row just above paging
    html += '<tr style="font-weight:bold;background:#f3f6fa;">';
    TABLE_COLUMNS.forEach(col => {
        if (col.key === 'name') {
            html += '<td style="text-align:left;">Total</td>';
        } else if (totalFields.includes(col.key)) {
            html += `<td>${totals[col.key]}</td>`;
        } else {
            html += '<td></td>';
        }
    });
    html += '</tr>';
    html += '</tbody></table>';
    // Paging controls below total row
    const totalPages = Math.ceil(tableData.length / CUSTOMERS_PER_PAGE) || 1;
    html += `<div style="text-align:center;margin:12px 0;">
        <button id="prev-table-page" ${tablePage === 1 ? 'disabled' : ''}>Prev</button>
        <span style="margin:0 12px;">Page ${tablePage} of ${totalPages}</span>
        <button id="next-table-page" ${tablePage === totalPages ? 'disabled' : ''}>Next</button>
    </div>`;
    section.innerHTML = html;
    attachInputListeners();
    attachNameEditListeners();
    attachViewListeners();
    attachDeleteListeners();
}

function attachInputListeners() {
    // Select all editable inputs (not just type=number)
    document.querySelectorAll('#table-section input:not([readonly])').forEach(input => {
        // Update data model on input, but do not re-render
        input.addEventListener('input', e => {
            const idx = +input.dataset.row;
            const key = input.dataset.key;
            let val = input.value === '' ? 0 : +input.value;
            tableData[idx][key] = val;
            recalcRow(idx);
            saveTableData();
            // No renderTable() here, so focus/cursor is preserved
        });
        // Select all text on focus (mouse or keyboard)
        input.addEventListener('focus', e => {
            input.select();
        });
        // Also select all text on mouseup (for click after focus)
        input.addEventListener('mouseup', e => {
            setTimeout(() => input.select(), 0);
        });
        // Re-render table on blur (when user leaves the field)
        input.addEventListener('blur', e => {
            renderTable();
        });
            // On Enter, move to next editable input and select its text
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const inputs = Array.from(document.querySelectorAll('#table-section input:not([readonly])'));
                    const idx = inputs.indexOf(input);
                    if (idx !== -1 && idx < inputs.length - 1) {
                        inputs[idx + 1].focus();
                        inputs[idx + 1].select();
                    } else {
                        input.blur();
                    }
                }
                // Let TAB work as normal for browser navigation
            });
    });
}

function attachNameEditListeners() {
    document.querySelectorAll('.edit-icon').forEach(icon => {
        icon.onclick = function() {
            const idx = +icon.dataset.row;
            const input = document.querySelector(`input.name-input[data-row="${idx}"]`);
            input.removeAttribute('readonly');
            input.focus();
            input.select();
            input.onblur = function() {
                input.setAttribute('readonly', true);
                const newName = input.value.trim() || `Customer ${idx+1}`;
                tableData[idx].name = newName;
                saveCustomerList();
                saveTableData();
                renderTable();
            };
        };
    });
    document.querySelectorAll('.name-input').forEach(input => {
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                input.blur();
            }
        };
    });
}

function attachViewListeners() {
    document.querySelectorAll('.view-icon').forEach(icon => {
        icon.onclick = function() {
            const idx = +icon.dataset.row;
            const name = tableData[idx].name;
            // Get selected date from calendar
            var calendarInput = document.getElementById('calendar-date');
            var selectedDate = calendarInput && calendarInput.value ? calendarInput.value : null;
            let report = selectedDate ? getReportFromLocalStorage(selectedDate) : null;
            let entry = null;
            if (Array.isArray(report)) {
                entry = report.find(row => row.name === name);
            }
            const win = window.open('', '_blank');
            win.document.write('<html><head><title>Customer Data</title>');
            win.document.write('<style>body{font-family:sans-serif;background:#f7faff;}\n'
                + 'table{border-collapse:collapse;width:100%;max-width:420px;margin:32px auto;background:#fff;border-radius:14px;box-shadow:0 4px 24px #8e2de220;}\n'
                + 'th,td{border:2px solid #8e2de2;padding:18px 20px;text-align:center;font-size:1.45em;font-weight:bold;color:#111;}\n'
                + 'th{background:linear-gradient(90deg,#8e2de2 0%,#ff6a00 50%,#43cea2 100%);color:#111;font-size:1.2em;}\n'
                + 'td{background:linear-gradient(90deg,#f0f7ff 0%,#ffe0b2 100%);color:#111;}\n'
                + 'tr:nth-child(even) td{background:linear-gradient(90deg,#e3e7ed 0%,#ffecd2 100%);color:#111;}\n'
                + 'tr:hover td{background:linear-gradient(90deg,#ffecd2 0%,#8e2de2 100%);color:#111;}\n'
                + '.customer-title{font-size:2.4em;font-weight:900;text-align:center;margin-top:32px;margin-bottom:0;color:#8e2de2;}\n'
                + '.customer-date{color:#ff6a00;font-weight:700;margin-bottom:18px;text-align:center;font-size:1.3em;}\n'
                + '</style>');
            win.document.write('</head><body>');
                win.document.write(`<div class='customer-title'>${name}</div>`);
                win.document.write(`<div class='customer-date'>Date: ${selectedDate || 'No Date Selected'}</div>`);
            win.document.write('<table style="max-width:400px;margin:0 auto;">');
            if (entry) {
                const fields = [
                    { label: 'Purchase', value: entry.purchase },
                    { label: 'Booking', value: entry.booking !== undefined ? entry.booking : '' },
                    { label: 'Return', value: entry.return },
                    { label: 'SELL', value: entry.sell },
                    { label: 'Rate/PCS', value: entry.rate },
                    { label: 'NET VALUE', value: entry.netValue !== undefined ? Math.round(entry.netValue) : '' },
                    { label: 'VC', value: entry.vc },
                    { label: 'PWT', value: entry.pwt },
                    { label: 'Previous Due', value: entry.prevDue },
                    { label: 'Paid in A/C', value: entry.paidInAC !== undefined ? entry.paidInAC : '' },
                    { label: 'TOTAL', value: entry.total !== undefined ? Math.round(entry.total) : '' }
                ];
                for (const f of fields) {
                    win.document.write(`<tr><th style='text-align:left;background:#eaf1fb;'>${f.label}</th><td>${f.value !== undefined ? f.value : ''}</td></tr>`);
                }
            } else {
                win.document.write('<tr><td colspan="2">No data for this date</td></tr>');
            }
            win.document.write('</table></body></html>');
            win.document.close();
        };
    });
}
function attachDeleteListeners() {
    // Table paging navigation
    const prevBtn = document.getElementById('prev-table-page');
    const nextBtn = document.getElementById('next-table-page');
    if (prevBtn) {
        prevBtn.onclick = function() {
            if (tablePage > 1) {
                tablePage--;
                renderTable();
            }
        };
    }
    if (nextBtn) {
        nextBtn.onclick = function() {
            const totalPages = Math.ceil(tableData.length / CUSTOMERS_PER_PAGE) || 1;
            if (tablePage < totalPages) {
                tablePage++;
                renderTable();
            }
        };
    }
    document.querySelectorAll('.delete-row-btn').forEach(btn => {
        btn.onclick = function() {
            const idx = +btn.dataset.row;
            if (confirm('Delete this customer row?')) {
                tableData.splice(idx, 1);
                customerCount = tableData.length;
                saveCustomerList();
                saveTableData();
                renderTable();
            }
        };
    });
}

function recalcRow(idx) {
    const row = tableData[idx];
    // Sum Booking with Purchase
    const purchaseSum = (row.purchase || 0) + (row.booking || 0);
    row.sell = purchaseSum - (row.return || 0);
    row.netValue = row.sell * (row.rate || 0);
    // Calculate total before Paid in A/C and PWT
    let totalBeforePaid = (row.netValue - (row.vc || 0)) + (row.prevDue || 0);
    // Subtract Paid in A/C if present
    let totalAfterPaid = totalBeforePaid - (row.paidInAC || 0);
    // Subtract PWT if present
    row.total = totalAfterPaid - (row.pwt || 0);
}

function recalcAll() {
    for (let i = 0; i < tableData.length; ++i) recalcRow(i);
}

// --- Table Data Management ---
function addCustomerRow(name = '') {
    if (customerCount >= MAX_ROWS) return;
    tableData.push({
        name: name || `Customer ${customerCount + 1}`,
        purchase: 0,
        booking: 0,
        return: 0,
        sell: 0,
        rate: 0,
        netValue: 0,
        vc: 0,
        pwt: 0, // Added PWT field
        prevDue: 0,
        paidInAC: 0,
        total: 0
    });
    customerCount++;
    saveCustomerList();
    saveTableData();
    recalcAll();
    renderTable();
}

function initTable() {
    // Try to load from localStorage
    const saved = localStorage.getItem(TABLE_DATA_KEY);
    if (saved) {
        tableData = JSON.parse(saved);
        customerCount = tableData.length;
        recalcAll();
        renderTable();
        return;
    }
    // If not, load customer list
    const names = getCustomerList();
    tableData = [];
    customerCount = 0;
    for (const name of names) addCustomerRow(name);
    recalcAll();
    renderTable();
}
function saveCustomerList() {
    // Save only names
    const names = tableData.map(row => row.name);
    localStorage.setItem(CUSTOMER_LIST_KEY, JSON.stringify(names));
}

function getCustomerList() {
    const saved = localStorage.getItem(CUSTOMER_LIST_KEY);
    if (saved) return JSON.parse(saved);
    return DEFAULT_CUSTOMERS.slice();
}

function saveTableData() {
    localStorage.setItem(TABLE_DATA_KEY, JSON.stringify(tableData));
}
function getAllCustomerHistory(name) {
    // Search all saved reports for this customer name
    const dates = getAllReportDates();
    const result = [];
    for (const date of dates) {
        const report = getReportFromLocalStorage(date);
        if (Array.isArray(report)) {
            for (const row of report) {
                if (row.name === name) {
                    result.push({
                        date: formatDateForFile(date),
                        purchase: row.purchase,
                        return: row.return,
                        sell: row.sell,
                        rate: row.rate,
                        netValue: row.netValue,
                        vc: row.vc,
                        prevDue: row.prevDue !== undefined ? row.prevDue : 0,
                        total: row.total
                    });
                }
            }
        }
    }
    return result;
}

// --- Report Management ---
function saveReportToLocalStorage(dateStr) {
    // Limit to one report per day, and max 31 per month
    const month = dateStr.slice(0, 7); // yyyy-mm
    const all = getAllReportDates().filter(d => d.startsWith(month));
    if (all.length >= 31 && !all.includes(dateStr)) {
        alert('You can only save up to 31 daily reports per calendar month.');
        return;
    }
    const key = `report-${dateStr}`;
    // Save the current tableData (with all calculated fields)
    localStorage.setItem(key, JSON.stringify(tableData));
}
function getReportFromLocalStorage(dateStr) {
    return JSON.parse(localStorage.getItem(`report-${dateStr}`));
}
function deleteReportFromLocalStorage(dateStr) {
    localStorage.removeItem(`report-${dateStr}`);
}
function getAllReportDates() {
    return Object.keys(localStorage)
        .filter(k => k.startsWith('report-'))
        .map(k => k.replace('report-', ''))
            .sort((a, b) => b.localeCompare(a)); // Fixed bug: chained .sort() to .map() for correct report listing
}
function clearAllReports() {
    for (const k of Object.keys(localStorage)) {
        if (k.startsWith('report-')) localStorage.removeItem(k);
    }
}

// --- Report List UI ---
function renderReportList() {
    const ul = document.getElementById('report-list');
    ul.innerHTML = '';
    const allDates = getAllReportDates();
    const totalPages = Math.ceil(allDates.length / REPORTS_PER_PAGE) || 1;
    if (reportPage > totalPages) reportPage = totalPages;
    if (reportPage < 1) reportPage = 1;
    const startIdx = (reportPage - 1) * REPORTS_PER_PAGE;
    const pageDates = allDates.slice(startIdx, startIdx + REPORTS_PER_PAGE);
    for (const dateStr of pageDates) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${formatDateForFile(dateStr)}</span>
            <span class="report-actions">
                <button class="download-pdf-single animated-btn" data-date="${dateStr}" title="Download PDF" style="padding:6px 16px;border:none;background:#d7263d;color:#fff;border-radius:6px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:1em;box-shadow:0 2px 8px #d7263d22;">
                    <span style="display:inline-block;vertical-align:middle;">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="22" height="22" rx="5" fill="#d7263d"/>
                            <path d="M7 7h8v8H7V7zm1 1v6h6V8H8zm2 2h2v2h-2v-2z" fill="#fff"/>
                        </svg>
                    </span>
                    PDF
                </button>
                <button class="delete-report-btn" data-date="${dateStr}" title="Delete" style="margin-left:8px;">Delete</button>
            </span>
        `;
        ul.appendChild(li);
    }
    // Paging controls
    let pagingDiv = document.getElementById('report-paging');
    if (!pagingDiv) {
        pagingDiv = document.createElement('div');
        pagingDiv.id = 'report-paging';
        ul.parentElement.appendChild(pagingDiv);
    }
    pagingDiv.style.margin = '12px 0';
    pagingDiv.style.textAlign = 'center';
    pagingDiv.innerHTML = `
        <button id="prev-report-page" ${reportPage === 1 ? 'disabled' : ''}>Prev</button>
        <span style="margin:0 12px;">Page ${reportPage} of ${totalPages}</span>
        <button id="next-report-page" ${reportPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    attachReportListListeners();
    // Paging button listeners
    document.getElementById('prev-report-page').onclick = function() {
        if (reportPage > 1) {
            reportPage--;
            renderReportList();
        }
    };
    document.getElementById('next-report-page').onclick = function() {
        if (reportPage < totalPages) {
            reportPage++;
            renderReportList();
        }
    };
}
function attachReportListListeners() {
    // Single PDF download button logic
    document.querySelectorAll('.download-pdf-single').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const dateStr = btn.getAttribute('data-date');
            const data = getReportFromLocalStorage(dateStr);
            if (data) downloadPDF(data, dateStr);
        };
    });
    // Delete button
    document.querySelectorAll('.delete-report-btn').forEach(btn => {
        btn.onclick = function() {
            const dateStr = btn.dataset.date;
            if (confirm('Delete this report?')) {
                deleteReportFromLocalStorage(dateStr);
                renderReportList();
            }
        };
    });
}

// --- Download Helpers ---
function tableDataToXLS(data, dateStr) {
    let xls = '<table border="1"><tr>';
    for (const col of TABLE_COLUMNS) {
        if (col.key !== 'view') xls += `<th>${col.label}</th>`;
    }
    xls += '</tr>';
    // Calculate totals for all columns that should appear in the Total row
    const totalFields = ['purchase', 'booking', 'return', 'sell', 'rate', 'netValue', 'vc', 'pwt', 'prevDue', 'paidInAC', 'total'];
    const totals = {};
    totalFields.forEach(field => {
        if (field === 'rate') {
            totals[field] = '';
        } else {
            totals[field] = data.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
            totals[field] = Math.round(totals[field]);
        }
    });
    for (const row of data) {
        xls += '<tr>';
        for (const col of TABLE_COLUMNS) {
            let val = row[col.key] !== undefined ? row[col.key] : '';
            if ([
                'purchase','booking','return','sell','rate','netValue','vc','pwt','prevDue','paidInAC','total'
            ].includes(col.key)) {
                val = val !== '' ? Math.round(val) : '';
            }
            xls += `<td>${val}</td>`;
        }
        xls += '</tr>';
    }
    // Add Total row (all columns, matching web table)
    xls += '<tr style="font-weight:bold;background:#f3f6fa;">';
    TABLE_COLUMNS.forEach(col => {
        if (col.key === 'name') {
            xls += '<td style="text-align:left;">Total</td>';
        } else if (totalFields.includes(col.key)) {
            xls += `<td>${totals[col.key]}</td>`;
        } else {
            xls += '<td></td>';
        }
    });
    xls += '</tr>';
    xls += '</table>';
    return xls;
}
function downloadXLS(data, dateStr, filenamePrefix = 'Date') {
    const xls = tableDataToXLS(data, dateStr);
    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${formatDateForFile(dateStr)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
function downloadCombinedXLS(reports, fromDate, toDate) {
    let xls = '';
    for (const { date, data } of reports) {
        xls += `<h3>Date: ${formatDateForFile(date)}</h3>`;
        xls += tableDataToXLS(data, date);
        xls += '<br/>';
    }
    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reports-${formatDateForFile(fromDate)}-to-${formatDateForFile(toDate)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// --- PDF Download (Simple Table as Image) ---
function downloadPDF(data, dateStr, filenamePrefix = 'Date') {
    // Render table as HTML, then use canvas to image, then download as PDF
    // No external libs, so use window.print() in a new window
    const win = window.open('', '', 'width=900,height=700');
    win.document.write('<html><head><title>PDF Export</title>');
    win.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:8px;text-align:center;font-size:1.2em;font-weight:bold;}th{background:#eaf1fb;}</style>');
    win.document.write('</head><body>');
    win.document.write(`<h2>Daily Business Snapshot - ${formatDateForFile(dateStr)}</h2>`);
    win.document.write(tableDataToXLS(data, dateStr));
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
}
function downloadCombinedPDF(reports, fromDate, toDate) {
    // Prepare summary for each date
    let summaryRows = [];
    // All columns to show in summary (matching Total row)
    const totalFields = ['purchase', 'booking', 'return', 'sell', 'rate', 'netValue', 'vc', 'pwt', 'prevDue', 'paidInAC', 'total'];
    let sumTotals = {};
    totalFields.forEach(f => sumTotals[f] = 0);
    for (const { date, data } of reports) {
        const totals = {};
        totalFields.forEach(field => {
            if (field === 'rate') {
                totals[field] = '';
            } else {
                totals[field] = data.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
                totals[field] = Math.round(totals[field]);
                sumTotals[field] += totals[field];
            }
        });
        summaryRows.push({ date, totals });
    }
    Object.keys(sumTotals).forEach(k => { sumTotals[k] = Math.round(sumTotals[k]); });
    const win = window.open('', '', 'width=900,height=700');
    win.document.write('<html><head><title>PDF Export</title>');
    win.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:8px;text-align:center;}th{background:#eaf1fb;}h3{margin:18px 0 6px 0;} .summary-table{margin-bottom:24px;border-radius:12px;box-shadow:0 2px 8px #185a9d22;} .summary-table th{background:#eaf1fb;color:#185a9d;} .summary-table td{background:#f3f6fa;}</style>');
    win.document.write('</head><body>');
    win.document.write(`<h2>Daily Business Snapshot<br>From ${formatDateForFile(fromDate)} To ${formatDateForFile(toDate)}</h2>`);
    // Summary table
    win.document.write('<h3>Summary of Total Row Values (Each Date)</h3>');
    win.document.write('<table class="summary-table"><thead><tr><th>Date</th><th>Purchase</th><th>Booking</th><th>Return</th><th>SELL</th><th>Rate/PCS</th><th>NET VALUE</th><th>VC</th><th>PWT</th><th>Previous Due</th><th>Paid in A/C</th><th>TOTAL</th></tr></thead><tbody>');
    for (const row of summaryRows) {
        win.document.write('<tr>');
        win.document.write('<td>' + formatDateForFile(row.date) + '</td>');
        win.document.write('<td>' + row.totals.purchase + '</td>');
        win.document.write('<td>' + row.totals.booking + '</td>');
        win.document.write('<td>' + row.totals.return + '</td>');
        win.document.write('<td>' + row.totals.sell + '</td>');
        win.document.write('<td>' + row.totals.rate + '</td>');
        win.document.write('<td>' + row.totals.netValue + '</td>');
        win.document.write('<td>' + row.totals.vc + '</td>');
        win.document.write('<td>' + row.totals.pwt + '</td>');
        win.document.write('<td>' + row.totals.prevDue + '</td>');
        win.document.write('<td>' + row.totals.paidInAC + '</td>');
        win.document.write('<td>' + row.totals.total + '</td>');
        win.document.write('</tr>');
    }
    // Add sum row
    win.document.write('<tr style="font-weight:bold;background:#eaf1fb;color:#185a9d;">');
    win.document.write('<td>Total Sum</td>');
    win.document.write('<td>' + sumTotals.purchase + '</td>');
    win.document.write('<td>' + sumTotals.booking + '</td>');
    win.document.write('<td>' + sumTotals.return + '</td>');
    win.document.write('<td>' + sumTotals.sell + '</td>');
    win.document.write('<td>' + sumTotals.rate + '</td>');
    win.document.write('<td>' + sumTotals.netValue + '</td>');
    win.document.write('<td>' + sumTotals.vc + '</td>');
    win.document.write('<td>' + sumTotals.pwt + '</td>');
    win.document.write('<td>' + sumTotals.prevDue + '</td>');
    win.document.write('<td>' + sumTotals.paidInAC + '</td>');
    win.document.write('<td>' + sumTotals.total + '</td>');
    win.document.write('</tr>');
    win.document.write('</tbody></table>');
    // Individual tables for each day
    for (const { date, data } of reports) {
        win.document.write(`<h3>Date: ${formatDateForFile(date)}</h3>`);
        win.document.write(tableDataToXLS(data, date));
    }
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
}

// --- Download Option Dialog ---
function showDownloadOptions(dateStr) {
    const data = getReportFromLocalStorage(dateStr);
    if (!data) return;
    const opt = prompt('Download as: 1) Excel  2) PDF\nEnter 1 or 2:', '1');
    if (opt === '2') downloadPDF(data, dateStr);
    else downloadXLS(data, dateStr);
}

// --- Date Range Download ---
function handleRangeDownload(type) {
    const from = document.getElementById('from-date').value;
    const to = document.getElementById('to-date').value;
    if (!from || !to) return alert('Select both dates.');
    const all = getAllReportDates();
    const reports = all.filter(d => d >= from && d <= to).map(date => ({ date, data: getReportFromLocalStorage(date) }));
    if (!reports.length) return alert('No reports in range.');
    if (type === 'pdf') downloadCombinedPDF(reports, from, to);
    else downloadCombinedXLS(reports, from, to);
}

// --- Chart Modal ---
function openChartModal(idx) {
    const modal = document.getElementById('chart-modal');
    const canvas = document.getElementById('customer-chart');
    const row = tableData[idx];
    // Clear canvas
    canvas.width = 350; canvas.height = 250;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Simple bar chart: Purchase, Return, SELL, Net Value, VC, Previous Due, TOTAL
    const labels = ['Purchase','Return','SELL','Net Value','VC','Previous Due','TOTAL'];
    const values = [row.purchase, row.return, row.sell, row.netValue, row.vc, row.prevDue, row.total];
    const colors = ['#0078d7','#d7263d','#00b386','#fbb034','#a259f7','#ff6f61','#222'];
    const max = Math.max(...values.map(v=>Math.abs(v)));
    const barW = 32;
    const gap = 18;
    const baseY = 210;
    ctx.font = '13px Segoe UI';
    for (let i=0; i<values.length; ++i) {
        const h = (values[i]/max)*120 || 0;
        ctx.fillStyle = colors[i];
        ctx.fillRect(30+i*(barW+gap), baseY-h, barW, h);
        ctx.fillStyle = '#333';
        ctx.fillText(labels[i], 30+i*(barW+gap), baseY+18);
        ctx.fillText(values[i], 30+i*(barW+gap), baseY-h-8);
    }
    modal.style.display = 'flex';
}
function closeChartModal() {
    document.getElementById('chart-modal').style.display = 'none';
}
function attachModalListeners() {
    document.querySelector('.modal .close').onclick = closeChartModal;
    window.onclick = function(e) {
        const modal = document.getElementById('chart-modal');
        if (e.target === modal) closeChartModal();
    };
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    initTable();
    renderReportList();
    attachModalListeners();
    document.getElementById('add-row').onclick = function() {
        addCustomerRow();
    };
    document.getElementById('submit').onclick = function() {
        const today = getTodayStr();
        recalcAll();
        // Save for selected date, not just today
        var calendarInput = document.getElementById('calendar-date');
        var saveDate = calendarInput && calendarInput.value ? calendarInput.value : today;
        saveReportToLocalStorage(saveDate, deepClone(tableData));
        renderReportList();
        // If the saved date is currently selected, reload table for that date
        if (calendarInput && calendarInput.value === saveDate) {
            loadTableForDate(saveDate);
        }
        alert('Report saved!');
    };
    document.getElementById('clear-reports').onclick = function() {
        if (confirm('Delete ALL reports?')) {
            clearAllReports();
            renderReportList();
        }
    };
    // Dropdown logic for Download Range
    const rangeBtn = document.getElementById('download-range');
    const dropdown = document.getElementById('download-range-dropdown');
    rangeBtn.onclick = function(e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.querySelectorAll('.download-range-pdf').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            dropdown.style.display = 'none';
            handleRangeDownload('pdf');
        };
    });
    document.querySelectorAll('.download-range-xls').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            dropdown.style.display = 'none';
            handleRangeDownload('xls');
        };
    });
    // Hide dropdown on click outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && e.target !== rangeBtn) {
            dropdown.style.display = 'none';
        }
    });
});
