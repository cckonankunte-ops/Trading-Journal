/**
 * app.js — Main application initialization, routing between views, modals, data management.
 * Integrates with Auth module — app only starts after successful login.
 */

const App = (() => {
    let analyticsCharts = {};
    let initialized = false;

    /** Initialize the application (called on DOMContentLoaded) */
    function init() {
        // Auth handles showing/hiding login vs app
        Auth.init(onLogin, onLogout);
    }

    /** Called when user successfully logs in */
    async function onLogin(user) {
        // Load user data from Firestore
        await Storage.loadUserData();

        // Only init modules once
        if (!initialized) {
            initNavigation();
            initSettings();
            initDataManagement();
            Dashboard.init();
            Calculator.init();
            Journal.init();
            initialized = true;
        } else {
            // Re-render with fresh data
            Dashboard.render();
            Journal.render();
        }

        showMorningMessage();
    }

    /** Called when user logs out */
    function onLogout() {
        Storage.clearCache();
    }

    // ===== MORNING MESSAGE =====

    /** Show morning message if not shown today (per session) */
    function showMorningMessage() {
        if (!Storage.wasMorningShownToday()) {
            document.getElementById('morning-modal').classList.remove('hidden');
            document.getElementById('morning-dismiss').addEventListener('click', () => {
                Storage.markMorningShown();
                document.getElementById('morning-modal').classList.add('hidden');
            });
        }
    }

    // ===== NAVIGATION =====

    /** Set up view navigation */
    function initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                switchView(view);

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
    }

    /** Switch to a specific view */
    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.remove('hidden');

        switch (viewName) {
            case 'dashboard':
                Dashboard.render();
                break;
            case 'journal':
                Journal.render();
                break;
            case 'analytics':
                renderAnalytics();
                break;
            case 'calculator':
                Calculator.calculate();
                break;
        }
    }

    // ===== SETTINGS =====

    /** Initialize settings modal */
    function initSettings() {
        const modal = document.getElementById('settings-modal');
        const input = document.getElementById('settings-max-risk');
        const saveBtn = document.getElementById('settings-save');
        const cancelBtn = document.getElementById('settings-cancel');
        const openBtn = document.getElementById('nav-settings');

        openBtn.addEventListener('click', () => {
            input.value = Storage.getMaxRisk();
            modal.classList.remove('hidden');
        });

        saveBtn.addEventListener('click', async () => {
            const value = parseInt(input.value, 10);
            if (value && value > 0) {
                const settings = Storage.getSettings();
                settings.maxRisk = value;
                await Storage.saveSettings(settings);
                Dashboard.render();
            }
            modal.classList.add('hidden');
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    // ===== DATA MANAGEMENT =====

    /** Initialize export/import buttons */
    function initDataManagement() {
        document.getElementById('btn-export-json').addEventListener('click', exportJSON);
        document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
        document.getElementById('btn-import-json').addEventListener('change', importJSON);
    }

    /** Export full backup as JSON file */
    function exportJSON() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `sanjay-trading-backup-${Storage.getTodayString()}.json`);
    }

    /** Export journal as CSV file */
    function exportCSV() {
        const csv = Storage.exportCSV();
        if (!csv) {
            alert('No trades to export.');
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        downloadBlob(blob, `sanjay-trading-journal-${Storage.getTodayString()}.csv`);
    }

    /** Import backup from JSON file */
    async function importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (confirm('This will replace all existing data. Continue?')) {
                    await Storage.importAll(data);
                    Dashboard.render();
                    Journal.render();
                    alert('Backup restored successfully!');
                }
            } catch (err) {
                alert('Error reading backup file: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    /** Trigger browser download for a Blob */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== ANALYTICS =====

    /** Render all analytics charts */
    function renderAnalytics() {
        renderEquityChart();
        renderMonthlyPnLChart();
        renderWinRateChart();
        renderAdherenceChart();
    }

    function renderEquityChart() {
        const data = Storage.getEquityCurve();
        const ctx = document.getElementById('chart-equity');
        if (analyticsCharts.equity) analyticsCharts.equity.destroy();
        if (data.length === 0) { analyticsCharts.equity = null; return; }

        analyticsCharts.equity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Equity (₹)',
                    data: data.map(d => d.equity),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2
                }]
            },
            options: chartOptions('₹')
        });
    }

    function renderMonthlyPnLChart() {
        const data = Storage.getMonthlyPnL();
        const ctx = document.getElementById('chart-monthly-pnl');
        if (analyticsCharts.monthlyPnl) analyticsCharts.monthlyPnl.destroy();
        if (data.length === 0) { analyticsCharts.monthlyPnl = null; return; }

        analyticsCharts.monthlyPnl = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.month),
                datasets: [{
                    label: 'P&L (₹)',
                    data: data.map(d => d.pnl),
                    backgroundColor: data.map(d => d.pnl >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderColor: data.map(d => d.pnl >= 0 ? '#10b981' : '#ef4444'),
                    borderWidth: 1
                }]
            },
            options: chartOptions('₹')
        });
    }

    function renderWinRateChart() {
        const data = Storage.getWinRateOverTime();
        const ctx = document.getElementById('chart-winrate');
        if (analyticsCharts.winRate) analyticsCharts.winRate.destroy();
        if (data.length === 0) { analyticsCharts.winRate = null; return; }

        analyticsCharts.winRate = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Win Rate %',
                    data: data.map(d => d.winRate),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                }]
            },
            options: chartOptions('%', 0, 100)
        });
    }

    function renderAdherenceChart() {
        const data = Storage.getAdherenceOverTime();
        const ctx = document.getElementById('chart-adherence');
        if (analyticsCharts.adherence) analyticsCharts.adherence.destroy();
        if (data.length === 0) { analyticsCharts.adherence = null; return; }

        analyticsCharts.adherence = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Rule Adherence %',
                    data: data.map(d => d.adherence),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                }]
            },
            options: chartOptions('%', 0, 100)
        });
    }

    function chartOptions(unit, min, max) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#64748b', font: { size: 10 },
                        callback: (val) => unit === '₹' ? `₹${val}` : `${val}%`
                    },
                    min: min, max: max
                }
            }
        };
    }

    // Start when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    return { init, switchView };
})();
