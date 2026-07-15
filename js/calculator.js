/**
 * calculator.js — Position size calculator with auto-calculation on input change.
 */

const Calculator = (() => {

    /** Calculate and display results */
    function calculate() {
        const capital = parseFloat(document.getElementById('calc-capital').value) || 0;
        const riskType = document.getElementById('calc-risk-type').value;
        const riskValue = parseFloat(document.getElementById('calc-risk-value').value) || 0;
        const lotSize = parseInt(document.getElementById('calc-lot-size').value, 10) || 1;
        const slPoints = parseFloat(document.getElementById('calc-sl-points').value) || 0;

        // Calculate risk amount
        let riskAmount = 0;
        if (riskType === 'fixed') {
            riskAmount = riskValue;
        } else {
            riskAmount = (capital * riskValue) / 100;
        }

        // Calculate quantity and lots
        let quantity = 0;
        let lots = 0;
        if (slPoints > 0) {
            quantity = Math.floor(riskAmount / slPoints);
            lots = Math.floor(quantity / lotSize);
        }

        // Calculate R targets (points)
        const r1 = slPoints;
        const r2 = slPoints * 2;
        const r3 = slPoints * 3;

        // Display results
        document.getElementById('calc-risk-amount').textContent = `₹${riskAmount.toFixed(0)}`;
        document.getElementById('calc-quantity').textContent = quantity > 0 ? quantity : '—';
        document.getElementById('calc-lots').textContent = lots > 0 ? lots : '—';
        document.getElementById('calc-1r').textContent = slPoints > 0 ? `${r1.toFixed(2)} pts (₹${(r1 * quantity).toFixed(0)})` : '—';
        document.getElementById('calc-2r').textContent = slPoints > 0 ? `${r2.toFixed(2)} pts (₹${(r2 * quantity).toFixed(0)})` : '—';
        document.getElementById('calc-3r').textContent = slPoints > 0 ? `${r3.toFixed(2)} pts (₹${(r3 * quantity).toFixed(0)})` : '—';
    }

    /** Initialize calculator event listeners */
    function init() {
        const inputs = ['calc-capital', 'calc-risk-type', 'calc-risk-value', 'calc-lot-size', 'calc-sl-points'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('input', calculate);
            el.addEventListener('change', calculate);
        });

        // Initial calculation
        calculate();
    }

    return { init, calculate };
})();
