/* ============================================================
   LessFun Christmas Easter Eggs
   Typed secrets, logo clicks, hidden reindeer and a few
   random festive moments. Nothing here affects gameplay.
   ============================================================ */
(function () {
    'use strict';

    if (!document.documentElement.classList.contains('is-holiday')) return;

    var SPARKLES = ['❄', '✦', '🎁', '⭐', '🍬', '🔔', '❅'];
    var GIFTS = ['🎁', '🍬', '⭐', '🔔', '❄', '✦'];
    var lastEgg = 0;
    var buffer = '';

    function reduceMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function inGame() {
        return document.body.classList.contains('in-game');
    }

    function isTypingTarget(target) {
        if (!target) return false;
        var tag = (target.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    }

    function toast(message) {
        if (typeof window.showGameToast === 'function') {
            window.showGameToast(message);
            return;
        }
        var el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;'
            + 'padding:12px 18px;border-radius:999px;background:rgba(20,30,50,.92);color:#ffe2a0;'
            + 'font:700 13px/1.2 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 3600);
    }

    function spawnBurst(x, y, count, power, palette) {
        if (reduceMotion()) return;
        var items = palette || SPARKLES;
        var total = count || 26;
        var strength = power || 1;
        for (var i = 0; i < total; i++) {
            var p = document.createElement('span');
            p.className = 'xmas-burst';
            p.textContent = items[Math.floor(Math.random() * items.length)];
            var angle = Math.random() * Math.PI * 2;
            var dist = (40 + Math.random() * 150) * strength;
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            p.style.fontSize = (8 + Math.random() * 16) + 'px';
            p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--dy', (Math.sin(angle) * dist - 70) + 'px');
            p.style.setProperty('--spin', (Math.random() * 540 - 270) + 'deg');
            p.style.animationDelay = (Math.random() * 0.12) + 's';
            document.body.appendChild(p);
            (function (node) {
                setTimeout(function () {
                    if (node.parentNode) node.parentNode.removeChild(node);
                }, 1700);
            })(p);
        }
    }

    function extraSnow(count) {
        if (reduceMotion()) return;
        var flakes = count || 24;
        for (var i = 0; i < flakes; i++) {
            var p = document.createElement('span');
            p.className = 'xmas-burst';
            p.textContent = '❄';
            p.style.left = (Math.random() * window.innerWidth) + 'px';
            p.style.top = '-20px';
            p.style.fontSize = (8 + Math.random() * 18) + 'px';
            p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
            p.style.setProperty('--dy', (window.innerHeight + 80) + 'px');
            p.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
            p.style.animationDuration = (2.2 + Math.random() * 2.2) + 's';
            document.body.appendChild(p);
            (function (node) {
                setTimeout(function () {
                    if (node.parentNode) node.parentNode.removeChild(node);
                }, 4700);
            })(p);
        }
    }

    function hoHoHo() {
        var now = Date.now();
        if (now - lastEgg < 4000) return;
        lastEgg = now;
        toast('🎅 Ho ho ho! Merry Christmas from LessFun.');
        spawnBurst(window.innerWidth / 2, Math.max(120, window.innerHeight * 0.3), 34, 1.15);
        extraSnow(20);
    }

    function grinch() {
        var now = Date.now();
        if (now - lastEgg < 4000) return;
        lastEgg = now;
        if (!reduceMotion()) {
            var flash = document.createElement('div');
            flash.className = 'xmas-grinch-flash';
            document.body.appendChild(flash);
            setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 1500);
        }
        toast('🎄 The Grinch peeked in… the snow is safe.');
    }

    function sleighFlyby() {
        var now = Date.now();
        if (now - lastEgg < 6000) return;
        lastEgg = now;
        if (reduceMotion()) {
            toast('🎅 Santa is doing a flyby!');
            return;
        }
        var sleigh = document.createElement('div');
        sleigh.className = 'xmas-sleigh';
        sleigh.innerHTML = '<span class="xmas-sleigh-team">🦌🦌</span><span class="xmas-sleigh-body">🎅🛷</span>';
        sleigh.style.top = (8 + Math.random() * 28) + 'vh';
        document.body.appendChild(sleigh);
        setTimeout(function () { if (sleigh.parentNode) sleigh.parentNode.removeChild(sleigh); }, 7600);
        toast('🎅 Santa is doing a flyby!');
    }

    function logoStorm(x, y) {
        toast('❄ Five clicks! The snowstorm is here.');
        spawnBurst(x || window.innerWidth / 2, y || window.innerHeight * 0.35, 64, 2.1);
        extraSnow(40);
    }

    function giftShower(x, y) {
        toast('🎁 A shower of Christmas gifts!');
        spawnBurst(x || window.innerWidth / 2, y || window.innerHeight * 0.4, 48, 1.5, GIFTS);
    }

    function jingleBoost(x, y) {
        var ok = window.LessFunJingle && typeof window.LessFunJingle.boost === 'function'
            ? window.LessFunJingle.boost()
            : false;
        if (ok) {
            toast('🦌 Rudolph turned up the jingle!');
            spawnBurst(x || window.innerWidth - 90, y || 70, 22, 0.8);
        } else {
            toast('🦌 Rudolph is resting — the jingle is off in Settings.');
        }
    }

    function snowDay() {
        var now = Date.now();
        if (now - lastEgg < 2500) return;
        lastEgg = now;
        toast('☃ You found the hidden snowman! Snow day!');
        extraSnow(40);
    }

    function addSnowman() {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'xmas-snowman';
        btn.setAttribute('aria-label', 'Hidden snowman');
        btn.title = 'The snow is watching…';
        btn.textContent = '☃';
        btn.addEventListener('click', snowDay);
        document.body.appendChild(btn);
    }

    function addNavDeer() {
        var host = document.querySelector('.nav-right') || document.querySelector('.nav-container');
        if (!host) return;
        var deer = document.createElement('button');
        deer.type = 'button';
        deer.className = 'xmas-nav-deer';
        deer.setAttribute('aria-label', 'A tiny reindeer');
        deer.title = 'Rudolph says hi';
        deer.textContent = '🦌';
        deer.addEventListener('click', function (event) {
            event.stopPropagation();
            var rect = deer.getBoundingClientRect();
            jingleBoost(rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
        host.appendChild(deer);
    }

    function wireLogo() {
        var logo = document.querySelector('.logo');
        if (!logo) return;
        var clicks = 0;
        var timer = 0;
        logo.addEventListener('click', function (event) {
            clicks++;
            clearTimeout(timer);
            timer = setTimeout(function () { clicks = 0; }, 2400);
            if (clicks >= 5) {
                clicks = 0;
                var rect = logo.getBoundingClientRect();
                logoStorm(rect.left + rect.width / 2, rect.top + rect.height / 2);
                sleighFlyby();
            }
        });
    }

    function wireSnowRushTitle() {
        var title = document.querySelector('#snowEvent h2');
        if (!title) return;
        title.addEventListener('dblclick', function (event) {
            event.preventDefault();
            giftShower(event.clientX, event.clientY);
        });
    }

    function randomGift() {
        spawnBurst(
            60 + Math.random() * Math.max(40, window.innerWidth - 120),
            100 + Math.random() * Math.max(60, window.innerHeight * 0.4),
            16,
            0.85,
            GIFTS
        );
    }

    function randomAurora() {
        if (reduceMotion()) return;
        var aurora = document.createElement('div');
        aurora.className = 'xmas-aurora';
        document.body.appendChild(aurora);
        setTimeout(function () { if (aurora.parentNode) aurora.parentNode.removeChild(aurora); }, 7000);
    }

    function randomAmbient() {
        if (document.hidden || inGame() || reduceMotion()) return;
        var roll = Math.random();
        if (roll < 0.4) extraSnow(18);
        else if (roll < 0.75) randomGift();
        else randomAurora();
    }

    function scheduleAmbient() {
        setTimeout(function () {
            randomAmbient();
            scheduleAmbient();
        }, 50000 + Math.random() * 80000);
    }

    function onKey(event) {
        if (inGame() || isTypingTarget(event.target)) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        var key = event.key;
        if (!key || key.length !== 1) return;
        if (key === ' ') return;
        if (!/[a-z]/i.test(key)) {
            buffer = '';
            return;
        }
        buffer = (buffer + key.toLowerCase()).slice(-12);
        if (buffer.slice(-6) === 'hohoho') {
            buffer = '';
            hoHoHo();
        } else if (buffer.slice(-5) === 'santa') {
            buffer = '';
            sleighFlyby();
            spawnBurst(window.innerWidth / 2, window.innerHeight * 0.35, 28, 1.1);
        } else if (buffer.slice(-4) === 'xmas') {
            buffer = '';
            sleighFlyby();
            spawnBurst(window.innerWidth / 2, window.innerHeight * 0.35, 28, 1.1);
        } else if (buffer.slice(-6) === 'grinch') {
            buffer = '';
            grinch();
        }
    }

    function init() {
        addSnowman();
        addNavDeer();
        wireLogo();
        wireSnowRushTitle();
        document.addEventListener('keydown', onKey);
        scheduleAmbient();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
