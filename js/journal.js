/**
 * journal.js — Handles trade journal view: table rendering, filtering, sorting.
 */

const Journal = (() => {
    let currentSort = { field: 'date', direction: 'desc' };

    /** Format positionType value to readable label */
    function formatPositionType(type) {
        const labels = {
            'OPTION_BUY': 'Opt Buy',
            'OPTION_SELL': 'Opt Sell',
            'FUTURE_BUY': 'Fut Buy',
            'FUTURE_SELL': 'Fut Sell'
        };
        return labels[type] || type || '';
    }

    /** Render the journal view */
    function render() {
        populateFilters();
        renderTable();
    }

    /** Populate filter dropdowns with available data */
    function populateFilters() {
        const monthSelect = document.getElementById('journal-filter-month');
        const strategySelect = document.getElementById('journal-filter-strategy');

        // Preserve current selections
        const currentMonth = monthSelect.value;
        const currentStrategy = strategySelect.value;

        // Clear and rebuild month options
        monthSelect.innerHTML = '<option value="">All Months</option>';
        Storage.getUniqueMonths().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            monthSelect.appendChild(opt);
        });
        monthSelect.value = currentMonth;

        // Clear and rebuild strategy options
        strategySelect.innerHTML = '<option value="">All Strategies</option>';
        Storage.getUniqueStrategies().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            strategySelect.appendChild(opt);
        });
        strategySelect.value = currentStrategy;
    }

    /** Get filtered and sorted trades */
    function getFilteredTrades() {
        let trades = Storage.getAllTrades();

        // Search filter
        const search = document.getElementById('journal-search').value.toLowerCase().trim();
        if (search) {
            trades = trades.filter(t =>
                (t.instrument || '').toLowerCase().includes(search) ||
                (t.strategy || '').toLowerCase().includes(search) ||
                (t.notes || '').toLowerCase().includes(search)
            );
        }

        // Month filter
        const month = document.getElementById('journal-filter-month').value;
        if (month) {
            trades = trades.filter(t => t.date.startsWith(month));
        }

        // Strategy filter
        const strategy = document.getElementById('journal-filter-strategy').value;
        if (strategy) {
            trades = trades.filter(t => t.strategy === strategy);
        }

        // Result filter
        const result = document.getElementById('journal-filter-result').value;
        if (result === 'win') {
            trades = trades.filter(t => Storage.calculatePnL(t) > 0);
        } else if (result === 'loss') {
            trades = trades.filter(t => Storage.calculatePnL(t) <= 0);
        }

        // Emotion filter
        const emotion = document.getElementById('journal-filter-emotion').value;
        if (emotion) {
            trades = trades.filter(t => t.emotionBefore === emotion || t.emotionAfter === emotion);
        }

        // Sort
        trades.sort((a, b) => {
            let valA, valB;
            const field = currentSort.field;

            if (field === 'pnl') {
                valA = Storage.calculatePnL(a);
                valB = Storage.calculatePnL(b);
            } else {
                valA = a[field] || '';
                valB = b[field] || '';
            }

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return trades;
    }

    /** Render table rows */
    function renderTable() {
        const tbody = document.getElementById('journal-tbody');
        const trades = getFilteredTrades();

        if (trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem;">No trades found</td></tr>';
            return;
        }

        tbody.innerHTML = trades.map(t => {
            const pnl = Storage.calculatePnL(t);
            const isWin = pnl > 0;
            const ruleFollowed = t.ruleFollowed === 'Yes';

            let rowClass = '';
            if (ruleFollowed && isWin) rowClass = 'row-win';
            else if (!ruleFollowed) rowClass = 'row-loss-rule';
            else if (ruleFollowed && !isWin) rowClass = 'row-loss-clean';

            const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';
            const posLabel = formatPositionType(t.positionType);

            return `<tr class="${rowClass}">
                <td>${t.date}</td>
                <td>${t.instrument || ''}</td>
                <td>${t.direction || ''}</td>
                <td>${posLabel}</td>
                <td>${t.entry || ''}</td>
                <td>${t.exit || ''}</td>
                <td style="color:${pnlColor};font-weight:600;">₹${pnl.toFixed(2)}</td>
                <td>${t.strategy || ''}</td>
                <td>${t.emotionBefore || ''}</td>
                <td>${ruleFollowed ? '✅' : '❌'}</td>
            </tr>`;
        }).join('');
    }

    /** Initialize filter and sort event listeners */
    function initListeners() {
        // Filters
        ['journal-search', 'journal-filter-month', 'journal-filter-strategy', 'journal-filter-result', 'journal-filter-emotion'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('input', renderTable);
            el.addEventListener('change', renderTable);
        });

        // Column sorting
        document.querySelectorAll('#journal-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (currentSort.field === field) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = field;
                    currentSort.direction = 'asc';
                }
                renderTable();
            });
        });
    }

    /** Initialize journal module */
    function init() {
        initListeners();
        render();
    }

    return { init, render };
})();
