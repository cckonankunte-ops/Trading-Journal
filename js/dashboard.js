/**
 * dashboard.js — Handles dashboard view rendering, checklist logic, and trade entry form.
 */

const Dashboard = (() => {
    let equityChart = null;

    /** Render all dashboard stats */
    function render() {
        renderStats();
        renderChecklist();
        renderEquityMiniChart();
    }

    /** Update all stat cards */
    function renderStats() {
        const today = Storage.getTodayString();
        const todayCount = Storage.getTodayTradeCount();
        const maxRisk = Storage.getMaxRisk();
        const streak = Storage.getDisciplineStreak();
        const adherence = Storage.getRuleAdherence(30);
        const winRate = Storage.getWinRate();

        document.getElementById('dash-date').textContent = formatDate(today);
        document.getElementById('dash-max-risk').textContent = `₹${maxRisk}`;
        document.getElementById('dash-trades-today').textContent = `${todayCount}/1`;
        document.getElementById('dash-streak').textContent = `${streak} days`;
        document.getElementById('dash-adherence').textContent = adherence !== null ? `${adherence}%` : '—';
        document.getElementById('dash-winrate').textContent = winRate !== null ? `${winRate}%` : '—';

        // Status
        const statusEl = document.getElementById('dash-status');
        if (todayCount >= 1) {
            statusEl.textContent = 'TRADING FINISHED';
            statusEl.className = 'stat-value status-finished';
        } else {
            statusEl.textContent = 'READY';
            statusEl.className = 'stat-value status-ready';
        }

        // Update checklist risk display
        const riskSpans = document.querySelectorAll('.checklist-risk');
        riskSpans.forEach(span => span.textContent = maxRisk);
    }

    /** Render checklist state */
    function renderChecklist() {
        const checklistSection = document.getElementById('checklist-section');
        const tradeEntrySection = document.getElementById('trade-entry-section');
        const todayCount = Storage.getTodayTradeCount();

        // If already traded today, hide both
        if (todayCount >= 1) {
            checklistSection.classList.add('hidden');
            tradeEntrySection.classList.add('hidden');
            return;
        }

        // If checklist was completed today, show trade form
        if (Storage.wasChecklistDoneToday()) {
            checklistSection.classList.add('hidden');
            tradeEntrySection.classList.remove('hidden');
            return;
        }

        // Show checklist, hide form
        checklistSection.classList.remove('hidden');
        tradeEntrySection.classList.add('hidden');
    }

    /** Render mini equity chart on dashboard */
    function renderEquityMiniChart() {
        const data = Storage.getEquityCurve();
        const ctx = document.getElementById('dash-equity-chart');
        if (!ctx) return;

        if (equityChart) equityChart.destroy();

        if (data.length === 0) {
            equityChart = null;
            return;
        }

        equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    data: data.map(d => d.equity),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: {
                        display: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b', font: { size: 10 } }
                    }
                }
            }
        });
    }

    /** Initialize checklist event listeners */
    function initChecklist() {
        const checkboxes = document.querySelectorAll('.checklist-item');
        const startBtn = document.getElementById('btn-start-trade');

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = [...checkboxes].every(c => c.checked);
                startBtn.disabled = !allChecked;
            });
        });

        startBtn.addEventListener('click', () => {
            Storage.markChecklistDone();
            renderChecklist();
            prefillTradeForm();
        });
    }

    /** Pre-fill trade form with today's date/time */
    function prefillTradeForm() {
        const now = new Date();
        document.getElementById('trade-date').value = Storage.getTodayString();
        document.getElementById('trade-time').value = now.toTimeString().slice(0, 5);
    }

    /** Initialize trade form submission */
    function initTradeForm() {
        const form = document.getElementById('trade-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitTrade();
        });
    }

    /** Collect form data and save trade */
    async function submitTrade() {
        const trade = {
            date: document.getElementById('trade-date').value,
            time: document.getElementById('trade-time').value,
            instrument: document.getElementById('trade-instrument').value.trim().toUpperCase(),
            strategy: document.getElementById('trade-strategy').value.trim(),
            direction: document.getElementById('trade-direction').value,
            entry: parseFloat(document.getElementById('trade-entry').value),
            sl: parseFloat(document.getElementById('trade-sl').value),
            target: parseFloat(document.getElementById('trade-target').value),
            exit: parseFloat(document.getElementById('trade-exit').value),
            quantity: parseInt(document.getElementById('trade-quantity').value, 10),
            emotionBefore: document.getElementById('trade-emotion-before').value,
            emotionAfter: document.getElementById('trade-emotion-after').value,
            notes: document.getElementById('trade-notes').value.trim(),
            ruleFollowed: document.getElementById('trade-rule-followed').value
        };

        const saved = await Storage.saveTrade(trade);

        // Show violations if any
        if (saved.violations.length > 0) {
            const banner = document.getElementById('rule-violation-banner');
            banner.textContent = '⚠️ Violations: ' + saved.violations.join(' | ');
            banner.classList.remove('hidden');
        }

        // Reset form and refresh
        document.getElementById('trade-form').reset();
        render();
    }

    /** Format YYYY-MM-DD to readable date */
    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    /** Initialize dashboard module */
    function init() {
        initChecklist();
        initTradeForm();
        render();
    }

    return { init, render };
})();
