/**
 * storage.js — Single source of truth for all data operations.
 * Uses Firebase Firestore for persistent cross-device storage.
 * Falls back to in-memory cache for immediate reads; syncs with Firestore.
 * No other file should touch Firestore or localStorage directly.
 */

const Storage = (() => {
    // In-memory cache for fast reads (populated from Firestore on login)
    let tradesCache = [];
    let settingsCache = { maxRisk: 2600 };
    let isLoaded = false;

    const DEFAULT_SETTINGS = { maxRisk: 2600 };

    // ===== FIRESTORE HELPERS =====

    /** Get the user's Firestore document reference for trades */
    function tradesCollection() {
        const uid = Auth.getUid();
        return db.collection('users').doc(uid).collection('trades');
    }

    /** Get the user's settings document reference */
    function settingsDoc() {
        const uid = Auth.getUid();
        return db.collection('users').doc(uid);
    }

    // ===== DATA LOADING =====

    /** Load all user data from Firestore into cache. Call after login. */
    async function loadUserData() {
        try {
            // Load settings
            const settingsSnap = await settingsDoc().get();
            if (settingsSnap.exists && settingsSnap.data().settings) {
                settingsCache = { ...DEFAULT_SETTINGS, ...settingsSnap.data().settings };
            } else {
                settingsCache = { ...DEFAULT_SETTINGS };
            }

            // Load trades
            const tradesSnap = await tradesCollection().orderBy('timestamp', 'desc').get();
            tradesCache = [];
            tradesSnap.forEach(doc => {
                tradesCache.push({ id: doc.id, ...doc.data() });
            });

            isLoaded = true;
        } catch (err) {
            console.error('Error loading user data:', err);
            tradesCache = [];
            settingsCache = { ...DEFAULT_SETTINGS };
            isLoaded = true;
        }
    }

    /** Clear cache on logout */
    function clearCache() {
        tradesCache = [];
        settingsCache = { ...DEFAULT_SETTINGS };
        isLoaded = false;
    }

    // ===== HELPERS =====

    /** Get today's date as YYYY-MM-DD string */
    function getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    // ===== SETTINGS =====

    /** Get app settings (from cache) */
    function getSettings() {
        return { ...settingsCache };
    }

    /** Update app settings (writes to Firestore) */
    async function saveSettings(settings) {
        settingsCache = { ...settingsCache, ...settings };
        try {
            await settingsDoc().set({ settings: settingsCache }, { merge: true });
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    }

    /** Get max risk value */
    function getMaxRisk() {
        return settingsCache.maxRisk || DEFAULT_SETTINGS.maxRisk;
    }

    // ===== TRADES =====

    /** Get all trades (from cache, sorted by date descending) */
    function getAllTrades() {
        return [...tradesCache];
    }

    /** Save a new trade to Firestore and cache. Returns the trade with violations. */
    async function saveTrade(trade) {
        trade.timestamp = Date.now();

        // Run rule engine
        trade.violations = runRuleEngine(trade, tradesCache);
        trade.flagged = trade.violations.length > 0;

        // Auto-set ruleFollowed based on violations
        if (trade.violations.length > 0) {
            trade.ruleFollowed = 'No';
        }

        try {
            // Save to Firestore (auto-generated ID)
            const docRef = await tradesCollection().add(trade);
            trade.id = docRef.id;
        } catch (err) {
            console.error('Error saving trade:', err);
            trade.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        }

        // Update cache
        tradesCache.unshift(trade);
        return trade;
    }

    /** Get trades for a specific date (YYYY-MM-DD) */
    function getTradesForDate(dateStr) {
        return tradesCache.filter(t => t.date === dateStr);
    }

    /** Get today's trades count */
    function getTodayTradeCount() {
        return getTradesForDate(getTodayString()).length;
    }

    // ===== RULE ENGINE =====

    /** Run rule checks on a trade, returns array of violation strings */
    function runRuleEngine(trade, allTrades) {
        const violations = [];
        const maxRisk = getMaxRisk();
        const todayTrades = allTrades.filter(t => t.date === trade.date);

        // Rule 1: More than 1 trade today
        if (todayTrades.length >= 1) {
            violations.push('More than 1 trade today');
        }

        // Rule 2: Risk exceeds max
        const slPoints = Math.abs(trade.entry - trade.sl);
        const riskAmount = slPoints * trade.quantity;
        if (riskAmount > maxRisk) {
            violations.push(`Risk ₹${riskAmount.toFixed(0)} exceeds max ₹${maxRisk}`);
        }

        // Rule 3: SL was possibly moved (check notes for keywords)
        const notes = (trade.notes || '').toLowerCase();
        const slMovedKeywords = ['moved sl', 'moved stop', 'adjusted sl', 'changed sl', 'shifted sl', 'trailed sl'];
        if (slMovedKeywords.some(kw => notes.includes(kw))) {
            violations.push('Stop loss was moved (detected from notes)');
        }

        // Rule 4: Missing SL
        if (!trade.sl || trade.sl === 0) {
            violations.push('Missing stop loss');
        }

        // Rule 5: Missing target
        if (!trade.target || trade.target === 0) {
            violations.push('Missing target');
        }

        return violations;
    }

    // ===== STATISTICS =====

    /** Calculate P&L for a single trade */
    function calculatePnL(trade) {
        if (!trade.entry || !trade.exit || !trade.quantity) return 0;
        const diff = trade.direction === 'LONG'
            ? trade.exit - trade.entry
            : trade.entry - trade.exit;
        return diff * trade.quantity;
    }

    /** Get discipline streak (consecutive days with 0 violations) */
    function getDisciplineStreak() {
        if (tradesCache.length === 0) return 0;

        const byDate = {};
        tradesCache.forEach(t => {
            if (!byDate[t.date]) byDate[t.date] = [];
            byDate[t.date].push(t);
        });

        const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        let streak = 0;

        for (const date of dates) {
            const dayTrades = byDate[date];
            const hasViolation = dayTrades.some(t => t.flagged);
            if (hasViolation) break;
            streak++;
        }

        return streak;
    }

    /** Get rule adherence % for last N days of trades */
    function getRuleAdherence(days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const recentTrades = tradesCache.filter(t => t.date >= cutoffStr);
        if (recentTrades.length === 0) return null;

        const followed = recentTrades.filter(t => t.ruleFollowed === 'Yes').length;
        return Math.round((followed / recentTrades.length) * 100);
    }

    /** Get overall win rate */
    function getWinRate() {
        if (tradesCache.length === 0) return null;
        const wins = tradesCache.filter(t => calculatePnL(t) > 0).length;
        return Math.round((wins / tradesCache.length) * 100);
    }

    /** Get equity curve data (cumulative P&L array) */
    function getEquityCurve() {
        const trades = [...tradesCache].reverse(); // oldest first
        let cumulative = 0;
        return trades.map(t => {
            cumulative += calculatePnL(t);
            return { date: t.date, equity: cumulative };
        });
    }

    /** Get monthly P&L data */
    function getMonthlyPnL() {
        const monthly = {};
        tradesCache.forEach(t => {
            const month = t.date.slice(0, 7);
            if (!monthly[month]) monthly[month] = 0;
            monthly[month] += calculatePnL(t);
        });

        return Object.entries(monthly)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, pnl]) => ({ month, pnl }));
    }

    /** Get win rate over time (rolling per trade) */
    function getWinRateOverTime() {
        const trades = [...tradesCache].reverse();
        let wins = 0;
        return trades.map((t, i) => {
            if (calculatePnL(t) > 0) wins++;
            return { date: t.date, winRate: Math.round((wins / (i + 1)) * 100) };
        });
    }

    /** Get rule adherence over time (rolling per trade) */
    function getAdherenceOverTime() {
        const trades = [...tradesCache].reverse();
        let followed = 0;
        return trades.map((t, i) => {
            if (t.ruleFollowed === 'Yes') followed++;
            return { date: t.date, adherence: Math.round((followed / (i + 1)) * 100) };
        });
    }

    /** Get unique strategies from all trades */
    function getUniqueStrategies() {
        return [...new Set(tradesCache.map(t => t.strategy).filter(Boolean))];
    }

    /** Get unique months from all trades */
    function getUniqueMonths() {
        return [...new Set(tradesCache.map(t => t.date.slice(0, 7)))].sort().reverse();
    }

    // ===== MORNING MESSAGE (session-based, uses sessionStorage) =====

    function wasMorningShownToday() {
        return sessionStorage.getItem('sts_morning_shown') === getTodayString();
    }

    function markMorningShown() {
        sessionStorage.setItem('sts_morning_shown', getTodayString());
    }

    // ===== CHECKLIST (session-based) =====

    function wasChecklistDoneToday() {
        return sessionStorage.getItem('sts_checklist_done') === getTodayString();
    }

    function markChecklistDone() {
        sessionStorage.setItem('sts_checklist_done', getTodayString());
    }

    // ===== DATA MANAGEMENT =====

    /** Export all data as JSON object */
    function exportAll() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            trades: tradesCache,
            settings: settingsCache
        };
    }

    /** Import data from JSON object — writes all trades to Firestore */
    async function importAll(data) {
        if (!data || !data.trades || !Array.isArray(data.trades)) {
            throw new Error('Invalid backup file format');
        }

        // Delete existing trades in Firestore
        const batch = db.batch();
        const existingSnap = await tradesCollection().get();
        existingSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Write imported trades in batches of 500 (Firestore limit)
        const trades = data.trades;
        for (let i = 0; i < trades.length; i += 500) {
            const chunk = trades.slice(i, i + 500);
            const writeBatch = db.batch();
            chunk.forEach(trade => {
                const ref = tradesCollection().doc();
                writeBatch.set(ref, trade);
            });
            await writeBatch.commit();
        }

        // Update settings if provided
        if (data.settings) {
            await saveSettings(data.settings);
        }

        // Reload cache
        await loadUserData();
    }

    /** Export trades as CSV string */
    function exportCSV() {
        if (tradesCache.length === 0) return '';

        const headers = ['Date', 'Time', 'Instrument', 'Strategy', 'Direction', 'Entry', 'SL', 'Target', 'Exit', 'Quantity', 'P&L', 'Emotion Before', 'Emotion After', 'Rule Followed', 'Violations', 'Notes'];
        const rows = tradesCache.map(t => [
            t.date,
            t.time,
            t.instrument,
            t.strategy,
            t.direction,
            t.entry,
            t.sl,
            t.target,
            t.exit,
            t.quantity,
            calculatePnL(t).toFixed(2),
            t.emotionBefore,
            t.emotionAfter,
            t.ruleFollowed,
            (t.violations || []).join('; '),
            `"${(t.notes || '').replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    // ===== PUBLIC API =====
    return {
        loadUserData,
        clearCache,
        getTodayString,
        getSettings,
        saveSettings,
        getMaxRisk,
        getAllTrades,
        saveTrade,
        getTradesForDate,
        getTodayTradeCount,
        calculatePnL,
        getDisciplineStreak,
        getRuleAdherence,
        getWinRate,
        getEquityCurve,
        getMonthlyPnL,
        getWinRateOverTime,
        getAdherenceOverTime,
        getUniqueStrategies,
        getUniqueMonths,
        wasMorningShownToday,
        markMorningShown,
        wasChecklistDoneToday,
        markChecklistDone,
        exportAll,
        importAll,
        exportCSV
    };
})();
