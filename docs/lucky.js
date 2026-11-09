/* Lucky Spin — lazy-loaded module. */
/* ============================================================
   Lucky Spin — virtual-coin slot machine
   ============================================================ */
const LUCKY_SYMBOLS = ['🍒', '🍒', '🍒', '🍋', '🍋', '🔔', '🔔', '⭐', '💎', '7️⃣'];
const LUCKY_PAYOUTS = { '🍒': 4, '🍋': 6, '🔔': 10, '⭐': 16, '💎': 35, '7️⃣': 60 };
let luckySpin = { spinning: false, bet: 50, timer: 0, tones: null };

function luckyTone(freq, dur, type, vol) {
    try {
        if (!luckySpin.tones) luckySpin.tones = new (window.AudioContext || window.webkitAudioContext)();
        var ctx = luckySpin.tones;
        var now = ctx.currentTime;
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(vol || 0.04, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(now); o.stop(now + dur + 0.02);
    } catch (e) {}
}

function luckyBalanceText() {
    var bal = wallet ? wallet.shells : 0;
    var el = document.getElementById('lsBalance');
    if (el) el.innerHTML = shellIcon(13) + ' ' + bal.toLocaleString() + ' Coins';
    return bal;
}

function luckySetBet(amount) {
    if (luckySpin.spinning) return;
    luckySpin.bet = Math.max(10, Math.floor(Number(amount) || 10));
    var buttons = document.querySelectorAll('.ls-bet');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('is-active', Number(buttons[i].getAttribute('data-bet')) === luckySpin.bet);
    }
    var spinBtn = document.getElementById('lsSpinBtn');
    if (spinBtn) spinBtn.textContent = 'SPIN · ' + luckySpin.bet.toLocaleString();
}

function luckySymbol() {
    return LUCKY_SYMBOLS[Math.floor(Math.random() * LUCKY_SYMBOLS.length)];
}

function luckySetReel(i, symbol) {
    var el = document.getElementById('lsReel' + i);
    if (el) el.textContent = symbol;
}

function luckyResult(symbols) {
    var counts = {};
    symbols.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    var keys = Object.keys(counts);
    var triple = keys.find(function (k) { return counts[k] === 3; });
    if (triple) return { mult: LUCKY_PAYOUTS[triple] || 0, triple: true, symbol: triple };
    var pair = keys.find(function (k) { return counts[k] === 2; });
    if (pair) return { mult: 1.2, triple: false, symbol: pair };
    return { mult: 0, triple: false, symbol: '' };
}

function luckySpinSpin() {
    if (!wallet) return;
    if (luckySpin.spinning) return;
    var bet = luckySpin.bet;
    if ((wallet.shells || 0) < bet) {
        var msg = document.getElementById('lsMessage');
        if (msg) msg.textContent = 'Not enough Coins. Lower your bet or earn more.';
        luckyTone(120, 0.15, 'square', 0.05);
        return;
    }
    luckySpin.spinning = true;
    wallet.shells -= bet;
    wallet.totalEarned = Math.max(0, wallet.totalEarned || 0);
    saveWallet();
    renderWalletUI();
    luckyBalanceText();
    var spinBtn = document.getElementById('lsSpinBtn');
    if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = 'SPINNING…'; }
    var msg = document.getElementById('lsMessage');
    if (msg) msg.textContent = 'Spinning…';
    luckyTone(220, 0.08, 'square', 0.04);

    var finals = [luckySymbol(), luckySymbol(), luckySymbol()];
    var ticks = 0;
    clearInterval(luckySpin.timer);
    luckySpin.timer = setInterval(function () {
        ticks++;
        luckySetReel(0, luckySymbol());
        luckySetReel(1, luckySymbol());
        luckySetReel(2, luckySymbol());
        if (ticks % 2 === 0) luckyTone(320 + (ticks % 5) * 40, 0.03, 'square', 0.02);
    }, 70);

    setTimeout(function () { clearInterval(luckySpin.timer); luckySetReel(0, finals[0]); luckyTone(480, 0.1, 'triangle', 0.04); }, 900);
    setTimeout(function () { luckySetReel(1, finals[1]); luckyTone(560, 0.1, 'triangle', 0.04); }, 1200);
    setTimeout(function () { luckySetReel(2, finals[2]); luckyTone(660, 0.12, 'triangle', 0.05); }, 1500);
    setTimeout(function () {
        var res = luckyResult(finals);
        var win = Math.round(bet * res.mult);
        if (win > 0) {
            wallet.shells += win;
            wallet.totalEarned = (wallet.totalEarned || 0) + win;
            saveWallet();
            renderWalletUI();
            luckyBalanceText();
            if (msg) msg.textContent = (res.triple ? 'JACKPOT! ' : 'Two of a kind! ') + 'You win ' + win.toLocaleString() + ' Coins.';
            luckyTone(880, 0.18, 'square', 0.05);
            setTimeout(function () { luckyTone(1180, 0.25, 'triangle', 0.05); }, 120);
        } else {
            if (msg) msg.textContent = 'No match. Better luck next spin.';
            luckyTone(140, 0.2, 'sawtooth', 0.04);
        }
        luckySpin.spinning = false;
        if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = 'SPIN · ' + bet.toLocaleString(); }
    }, 1700);
}

function luckyCleanup() {
    clearInterval(luckySpin.timer);
    luckySpin.spinning = false;
}

function openLuckySpinGame() {
    luckyCleanup();
    if (arcadeMp.connected) arcadeMpLeave(true);
    if (zombieMp.connected) zombieMpLeave(true);
    if (window.Games3D) window.Games3D.stop();
    currentGameId = 9;
    document.getElementById('modalGameTitle').textContent = 'Lucky Spin';
    var body = document.getElementById('modalGameBody');
    body.innerHTML =
        '<div class="ls-wrap">' +
            '<div class="ls-head">' +
                '<div><span class="ls-kicker">LESSFUN · VIRTUAL CASINO</span><h2>Lucky Spin</h2></div>' +
                '<div class="ls-balance" id="lsBalance">— Coins</div>' +
            '</div>' +
            '<div class="ls-machine">' +
                '<div class="ls-reels">' +
                    '<div class="ls-reel" id="lsReel0">🍒</div>' +
                    '<div class="ls-reel" id="lsReel1">🔔</div>' +
                    '<div class="ls-reel" id="lsReel2">💎</div>' +
                    '<div class="ls-payline"></div>' +
                '</div>' +
                '<p class="ls-message" id="lsMessage">Choose a bet and spin.</p>' +
            '</div>' +
            '<div class="ls-bets">' +
                [10, 50, 100, 500, 1000].map(function (b) {
                    return '<button type="button" class="ls-bet" data-bet="' + b + '" onclick="luckySetBet(' + b + ')">' + b + '</button>';
                }).join('') +
            '</div>' +
            '<button type="button" class="ls-spin" id="lsSpinBtn" onclick="luckySpinSpin()">SPIN · 50</button>' +
            '<div class="ls-paytable">' +
                '<span>🍒 x4</span><span>🍋 x6</span><span>🔔 x10</span><span>⭐ x16</span><span>💎 x35</span><span>7️⃣ x60</span>' +
            '</div>' +
            '<p class="ls-disclaimer">Virtual Coins only. No real-money value, purchases, or withdrawals.</p>' +
        '</div>';
    document.getElementById('gameModal').style.display = 'flex';
    luckySetBet(50);
    luckyBalanceText();
}
