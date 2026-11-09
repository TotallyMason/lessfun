/* ============================================================
   LessFun Arcade Tycoon — build and run your own arcade
   ============================================================ */
(function () {
    'use strict';

    var CABINETS = {
        beach:  { name: 'Beach Racer',   icon: 'beach',  cost: 150,  income: 8,  rep: 1,  color: '#ef476f' },
        tunnel: { name: 'Tunnel Rush',   icon: 'tunnel', cost: 240,  income: 12, rep: 2,  color: '#9b5de5' },
        stack:  { name: 'Cube Stack',    icon: 'blocks', cost: 360,  income: 17, rep: 3,  color: '#ffd166' },
        snow:   { name: 'Snow Rush',     icon: 'snow',   cost: 520,  income: 24, rep: 4,  color: '#8fdcff' },
        tranq:  { name: 'Tranq Arena',   icon: 'dart',   cost: 760,  income: 34, rep: 6,  color: '#54ff9f' },
        boeing: { name: 'Boeing Landing', icon: 'plane',  cost: 1100, income: 48, rep: 9,  color: '#4cc9f0' },
        lucky:  { name: 'Lucky Spin',    icon: 'dice',   cost: 1600, income: 68, rep: 13, color: '#ff3b6b' }
    };
    var CABINET_ORDER = ['beach', 'tunnel', 'stack', 'snow', 'tranq', 'boeing', 'lucky'];
    var MAX_SLOTS = 12;
    var OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
    var LEVEL_MULT = 1.35;

    var root = null;
    var arcade = null;
    var tickTimer = 0;
    var saveTimer = 0;
    var lastTick = 0;
    var tickCount = 0;

    function fmt(n) {
        return Math.floor(Number(n) || 0).toLocaleString();
    }

    function getArcade() {
        if (!wallet) return null;
        if (!wallet.arcade || typeof wallet.arcade !== 'object') {
            wallet.arcade = {
                cash: 650, slots: 6, cabinets: [], reputation: 0,
                totalEarned: 0, milestones: [], lastSeen: Date.now(), updatedAt: 0
            };
        }
        return wallet.arcade;
    }

    function levelIncome(type, level) {
        var base = CABINETS[type];
        return base ? base.income * Math.pow(LEVEL_MULT, Math.max(0, (level || 1) - 1)) : 0;
    }

    function incomePerMinute(a) {
        var total = 0;
        for (var i = 0; i < a.cabinets.length; i++) {
            total += levelIncome(a.cabinets[i].t, a.cabinets[i].l);
        }
        return total;
    }

    function reputationOf(a) {
        var rep = a.slots * 2;
        for (var i = 0; i < a.cabinets.length; i++) {
            var base = CABINETS[a.cabinets[i].t];
            if (base) rep += base.rep * a.cabinets[i].l;
        }
        rep += Math.floor((a.totalEarned || 0) / 1000);
        return rep;
    }

    function upgradeCost(type, level) {
        var base = CABINETS[type];
        return base ? Math.round(base.cost * 0.75 * Math.pow(1.65, Math.max(0, level - 1))) : 0;
    }

    function expandCost(slots) {
        return Math.round(600 * Math.pow(1.5, Math.max(0, slots - 6)));
    }

    function toast(message) {
        if (typeof showGameToast === 'function') showGameToast(message);
    }

    function accrueOffline() {
        var a = getArcade();
        if (!a) return 0;
        var now = Date.now();
        var elapsed = Math.max(0, Math.min(OFFLINE_CAP_MS, now - (Number(a.lastSeen) || now)));
        var rate = incomePerMinute(a) / 60000;
        var earned = rate * elapsed;
        a.cash += earned;
        a.totalEarned += earned;
        a.lastSeen = now;
        return earned;
    }

    function saveNow() {
        var a = getArcade();
        if (!a) return;
        a.lastSeen = Date.now();
        a.updatedAt = Date.now();
        if (typeof saveWallet === 'function') {
            try { saveWallet(); } catch (e) {}
        }
    }

    function scheduleSave() {
        if (saveTimer) return;
        saveTimer = setTimeout(function () {
            saveTimer = 0;
            saveNow();
        }, 20000);
    }

    var MILESTONES = [
        { id: 'cabs3', label: 'Build 3 cabinets', coins: 100, test: function (a) { return a.cabinets.length >= 3; } },
        { id: 'cabs6', label: 'Build 6 cabinets', coins: 250, test: function (a) { return a.cabinets.length >= 6; } },
        { id: 'cabs9', label: 'Build 9 cabinets', coins: 500, test: function (a) { return a.cabinets.length >= 9; } },
        { id: 'cabs12', label: 'Fill all 12 bays', coins: 1000, test: function (a) { return a.cabinets.length >= 12; } },
        { id: 'rep25', label: 'Reach 25 reputation', coins: 200, test: function (a) { return reputationOf(a) >= 25; } },
        { id: 'rep60', label: 'Reach 60 reputation', coins: 500, test: function (a) { return reputationOf(a) >= 60; } },
        { id: 'earn10k', label: 'Earn 10,000 Arcade Cash', coins: 300, test: function (a) { return a.totalEarned >= 10000; } },
        { id: 'earn100k', label: 'Earn 100,000 Arcade Cash', coins: 1000, test: function (a) { return a.totalEarned >= 100000; } }
    ];

    function checkMilestones() {
        var a = getArcade();
        if (!a) return;
        var unlocked = false;
        for (var i = 0; i < MILESTONES.length; i++) {
            var m = MILESTONES[i];
            if (a.milestones.indexOf(m.id) >= 0) continue;
            if (!m.test(a)) continue;
            a.milestones.push(m.id);
            if (wallet) {
                wallet.shells = Math.max(0, (Number(wallet.shells) || 0) + m.coins);
                wallet.totalEarned = Math.max(0, (Number(wallet.totalEarned) || 0) + m.coins);
            }
            unlocked = true;
            toast('Arcade milestone · +' + m.coins.toLocaleString() + ' Coins');
            if (typeof renderWalletUI === 'function') renderWalletUI();
        }
        if (unlocked) {
            a.updatedAt = Date.now();
            saveNow();
            if (typeof saveScore === 'function') {
                try { saveScore('Arcade Tycoon', Math.floor(a.totalEarned)); } catch (e) {}
            }
        }
    }

    function cabinetIcon(type) {
        var info = CABINETS[type];
        if (!info) return '';
        if (typeof getIcon === 'function') return getIcon(info.icon);
        return '';
    }

    function render() {
        if (!root) return;
        var a = getArcade();
        if (!a) {
            root.innerHTML = '<div class="tycoon-loading">Loading your arcade…</div>';
            return;
        }
        var rate = incomePerMinute(a);
        var rep = reputationOf(a);
        var nextExpand = a.slots < MAX_SLOTS ? expandCost(a.slots) : 0;

        var slotsHtml = a.cabinets.map(function (cab, index) {
            var info = CABINETS[cab.t];
            if (!info) return '';
            var income = levelIncome(cab.t, cab.l);
            var upCost = cab.l < 5 ? upgradeCost(cab.t, cab.l) : 0;
            return '<div class="tycoon-slot is-filled" style="--cab:' + info.color + '">' +
                '<div class="tycoon-cab-icon">' + cabinetIcon(cab.t) + '</div>' +
                '<strong>' + info.name + '</strong>' +
                '<span>Level ' + cab.l + ' · ' + income.toFixed(1) + '/min</span>' +
                (cab.l < 5
                    ? '<button type="button" class="tycoon-slot-btn" onclick="tycoonUpgrade(' + index + ')">Upgrade · ' + fmt(upCost) + '</button>'
                    : '<em class="tycoon-maxed">MAX LEVEL</em>') +
            '</div>';
        }).join('');

        for (var s = a.cabinets.length; s < a.slots; s++) {
            slotsHtml += '<div class="tycoon-slot is-empty">' +
                '<span class="tycoon-empty-plus">+</span>' +
                '<strong>Empty bay</strong>' +
                '<small>Build a cabinet below</small>' +
            '</div>';
        }

        var shopHtml = CABINET_ORDER.map(function (type) {
            var info = CABINETS[type];
            var canBuy = a.cash >= info.cost && a.cabinets.length < a.slots;
            var reason = a.cabinets.length >= a.slots ? 'No free bays' : (a.cash < info.cost ? 'Need ' + fmt(info.cost - a.cash) + ' more' : 'Build');
            return '<div class="tycoon-shop-card" style="--cab:' + info.color + '">' +
                '<div class="tycoon-shop-top"><div class="tycoon-cab-icon">' + cabinetIcon(type) + '</div>' +
                '<div><strong>' + info.name + '</strong><span>' + info.income + '/min · ' + info.rep + ' rep</span></div></div>' +
                '<div class="tycoon-shop-cost">' + fmt(info.cost) + ' <small>cash</small></div>' +
                '<button type="button" class="tycoon-buy' + (canBuy ? '' : ' is-disabled') + '" onclick="tycoonBuy(\'' + type + '\')">' + reason + '</button>' +
            '</div>';
        }).join('');

        var milestoneHtml = MILESTONES.map(function (m) {
            var done = a.milestones.indexOf(m.id) >= 0;
            return '<div class="tycoon-milestone' + (done ? ' is-done' : '') + '">' +
                '<span>' + (done ? '✓' : '•') + '</span>' +
                '<div><strong>' + m.label + '</strong><small>+' + m.coins.toLocaleString() + ' Coins</small></div>' +
            '</div>';
        }).join('');

        root.innerHTML =
            '<div class="tycoon-wrap">' +
                '<div class="tycoon-head">' +
                    '<div class="tycoon-title">' +
                        '<span class="tycoon-kicker">LESSFUN · ARCADE TYCOON</span>' +
                        '<h2>Your arcade</h2>' +
                        '<p>Fill the floor, upgrade the cabinets, and keep the Coins coming.</p>' +
                    '</div>' +
                    '<div class="tycoon-cash">' +
                        '<small>ARCADE CASH</small>' +
                        '<strong id="tyCash">' + fmt(a.cash) + '</strong>' +
                        '<span id="tyRate">+' + rate.toFixed(1) + ' / min</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tycoon-stats">' +
                    '<div><small>Cabinets</small><strong>' + a.cabinets.length + ' / ' + a.slots + '</strong></div>' +
                    '<div><small>Reputation</small><strong>' + rep + '</strong></div>' +
                    '<div><small>Total earned</small><strong>' + fmt(a.totalEarned) + '</strong></div>' +
                    '<div><small>Bays</small><strong>' + a.slots + ' / ' + MAX_SLOTS + '</strong></div>' +
                '</div>' +
                '<div class="tycoon-section-head">' +
                    '<div><h3>Floor</h3><p>Earnings continue while you are away, up to 8 hours.</p></div>' +
                    (a.slots < MAX_SLOTS
                        ? '<button type="button" class="tycoon-expand" onclick="tycoonExpand()">+ Add bay · ' + fmt(nextExpand) + '</button>'
                        : '<span class="tycoon-full">All bays built</span>') +
                '</div>' +
                '<div class="tycoon-slots">' + slotsHtml + '</div>' +
                '<div class="tycoon-section-head"><div><h3>Build cabinets</h3><p>New cabinets go into the first empty bay.</p></div></div>' +
                '<div class="tycoon-shop-grid">' + shopHtml + '</div>' +
                '<div class="tycoon-section-head"><div><h3>Milestones</h3><p>One-time Coin rewards for growing the arcade.</p></div></div>' +
                '<div class="tycoon-milestones">' + milestoneHtml + '</div>' +
                '<p class="tycoon-note">Arcade Cash is separate from your Coins. Milestones pay real LessFun Coins. Nothing here uses real money.</p>' +
            '</div>';
    }

    function updateLive() {
        var a = getArcade();
        if (!a) return;
        var cashEl = document.getElementById('tyCash');
        var rateEl = document.getElementById('tyRate');
        if (cashEl) cashEl.textContent = fmt(a.cash);
        if (rateEl) rateEl.textContent = '+' + incomePerMinute(a).toFixed(1) + ' / min';
    }

    function tick() {
        var a = getArcade();
        if (!a) return;
        var now = Date.now();
        var dt = Math.max(0, Math.min(5000, now - lastTick));
        lastTick = now;
        var rate = incomePerMinute(a) / 60000;
        a.cash += rate * dt;
        a.totalEarned += rate * dt;
        a.lastSeen = now;
        tickCount++;
        updateLive();
        if (tickCount % 5 === 0) checkMilestones();
        scheduleSave();
    }

    function buyCabinet(type) {
        var a = getArcade();
        var info = CABINETS[type];
        if (!a || !info) return;
        if (a.cabinets.length >= a.slots) { toast('All bays are full. Add another bay first.'); return; }
        if (a.cash < info.cost) { toast('Not enough Arcade Cash for the ' + info.name + '.'); return; }
        a.cash -= info.cost;
        a.cabinets.push({ t: type, l: 1 });
        a.updatedAt = Date.now();
        checkMilestones();
        saveNow();
        render();
        toast(info.name + ' cabinet installed.');
    }

    function upgradeCabinet(index) {
        var a = getArcade();
        if (!a || !a.cabinets[index]) return;
        var cab = a.cabinets[index];
        if (cab.l >= 5) return;
        var cost = upgradeCost(cab.t, cab.l);
        if (a.cash < cost) { toast('Need ' + fmt(cost - a.cash) + ' more Arcade Cash for that upgrade.'); return; }
        a.cash -= cost;
        cab.l++;
        a.updatedAt = Date.now();
        checkMilestones();
        saveNow();
        render();
        toast(CABINETS[cab.t].name + ' upgraded to level ' + cab.l + '.');
    }

    function expandArcade() {
        var a = getArcade();
        if (!a) return;
        if (a.slots >= MAX_SLOTS) return;
        var cost = expandCost(a.slots);
        if (a.cash < cost) { toast('Need ' + fmt(cost - a.cash) + ' more Arcade Cash to add a bay.'); return; }
        a.cash -= cost;
        a.slots++;
        a.updatedAt = Date.now();
        checkMilestones();
        saveNow();
        render();
        toast('New bay added. You now have ' + a.slots + ' bays.');
    }

    function open() {
        root = document.getElementById('tycoonRoot');
        if (!root) return;
        if (!wallet) {
            root.innerHTML = '<div class="tycoon-loading">Loading your wallet…</div>';
            setTimeout(function () { if (root && !getArcade()) open(); }, 700);
            return;
        }
        var a = getArcade();
        if (!a.updatedAt) a.updatedAt = Date.now();
        var offline = accrueOffline();
        if (offline >= 1) {
            toast('Your arcade earned ' + fmt(offline) + ' Arcade Cash while you were away.');
        }
        lastTick = Date.now();
        tickCount = 0;
        render();
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(tick, 1000);
        saveNow();
    }

    function close() {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
        var a = getArcade();
        if (a) {
            var now = Date.now();
            var dt = Math.max(0, Math.min(5000, now - lastTick));
            if (lastTick) {
                var rate = incomePerMinute(a) / 60000;
                a.cash += rate * dt;
                a.totalEarned += rate * dt;
            }
            a.lastSeen = now;
            a.updatedAt = now;
            saveNow();
        }
        root = null;
    }

    function openTycoonGame() {
        if (typeof arcadeMpLeave === 'function' && typeof arcadeMp !== 'undefined' && arcadeMp.connected) arcadeMpLeave(true);
        if (typeof zombieMpLeave === 'function' && typeof zombieMp !== 'undefined' && zombieMp.connected) zombieMpLeave(true);
        if (window.Games3D) window.Games3D.stop();
        currentGameId = 15;
        document.getElementById('modalGameTitle').textContent = 'Arcade Tycoon';
        document.getElementById('modalGameBody').innerHTML = '<div class="tycoon-root" id="tycoonRoot"><div class="tycoon-loading">Opening your arcade…</div></div>';
        document.getElementById('gameModal').style.display = 'flex';
        document.body.classList.add('in-game');
        window.Tycoon.open();
    }

    window.Tycoon = { open: open, close: close, render: render };
    window.tycoonBuy = buyCabinet;
    window.tycoonUpgrade = upgradeCabinet;
    window.tycoonExpand = expandArcade;
    window.openTycoonGame = openTycoonGame;
})();
