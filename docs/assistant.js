/* ============================================================
   LessFun Assistant — local 1,000-pattern knowledge base
   ============================================================ */
(function () {
    'use strict';

    var VARIANTS = [
        function (t) { return t; },
        function (t) { return 'what is ' + t; },
        function (t) { return 'tell me about ' + t; },
        function (t) { return 'how does ' + t + ' work'; },
        function (t) { return 'explain ' + t; },
        function (t) { return 'info about ' + t; },
        function (t) { return 'help with ' + t; },
        function (t) { return 'details about ' + t; },
        function (t) { return 'question about ' + t; },
        function (t) { return 'can you explain ' + t; }
    ];

    var STOP = {};
    'the a an is are was were how do does did i you your my me we our to of on in for what can could would should tell about and or it its with work works help please give detail details question explain know'.split(' ').forEach(function (w) { STOP[w] = true; });

    var SYNONYMS = {
        shell: 'coin', shells: 'coin', money: 'coin', cash: 'coin', currency: 'coin',
        cars: 'car', vehicle: 'car', vehicles: 'car', auto: 'car', autos: 'car',
        planes: 'plane', aircraft: 'plane', airplane: 'plane', jet: 'plane', boeing: 'plane',
        settings: 'setting', options: 'setting', preferences: 'setting',
        friends: 'friend', gifts: 'gift', purchases: 'purchase', buying: 'buy',
        shops: 'store', shop: 'store', zombies: 'zombie', darts: 'dart',
        tranq: 'tranq', tranquilizer: 'tranq', tranquiliser: 'tranq',
        controls: 'control', tips: 'tip', maps: 'map', games: 'game',
        laps: 'lap', wheels: 'wheel', races: 'race', racing: 'race',
        stations: 'station', scores: 'score', leaderboards: 'leaderboard',
        updates: 'update', versions: 'version', browsers: 'browser',
        devices: 'device', wallets: 'wallet', streaks: 'streak',
        engines: 'engine', bodies: 'body', parts: 'part', paints: 'paint',
        tranqulizer: 'tranq', tranquliser: 'tranq', tranqualizer: 'tranq',
        tranquilizer: 'tranq', tranquiliser: 'tranq', tranq: 'tranq',
        boing: 'plane', landin: 'landing', controlls: 'control', controll: 'control',
        purchse: 'purchase', purchas: 'purchase', gogle: 'google', googel: 'google',
        accross: 'across', acount: 'account', acounts: 'account', walet: 'wallet'
    };

    var PHRASES = [
        [/fly\s+(the\s+)?(plane|aircraft|boeing)/g, 'boeing landing'],
        [/land\s+(the\s+)?(plane|aircraft|boeing)/g, 'boeing landing'],
        [/pilot\s+(the\s+)?(plane|aircraft)/g, 'boeing landing'],
        [/what'?s/g, 'what is'],
        [/whats/g, 'what is'],
        [/im/g, 'i am'],
        [/\bur\b/g, 'your'],
        [/\bu\b/g, 'you'],
        [/\br\b/g, 'are'],
        [/\bwht\b|\bwat\b/g, 'what'],
        [/\bhw\b/g, 'how'],
        [/\bpls\b|\bplz\b/g, 'please'],
        [/cant/g, 'cannot'],
        [/dont/g, 'do not'],
        [/take[\s-]?off/g, 'takeoff'],
        [/sign[\s-]?in/g, 'login'],
        [/log[\s-]?in/g, 'login'],
        [/log[\s-]?out/g, 'logout'],
        [/sign[\s-]?up/g, 'signup'],
        [/daily\s+gift/g, 'daily gift'],
        [/dead\s+coast/g, 'dead coast'],
        [/beach\s+racer/g, 'beach racer'],
        [/tunnel\s+rush/g, 'tunnel rush'],
        [/cube\s+stack/g, 'cube stack'],
        [/snow\s+rush/g, 'snow rush'],
        [/draw\s+(and|&)\s+guess/g, 'draw guess'],
        [/lucky\s+spin/g, 'lucky spin'],
        [/funtutu\s+test/g, 'funtutu test'],
        [/tranq\s+arena/g, 'tranq arena'],
        [/boeing\s+landing/g, 'boeing landing']
    ];

    function tokenize(text) {
        var s = String(text || '').toLowerCase();
        PHRASES.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
        s = s.replace(/[^a-z0-9]+/g, ' ').trim();
        var raw = s.split(/\s+/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var w = raw[i];
            if (!w || STOP[w] || w.length < 2) continue;
            if (!VOCAB[w] && !SYNONYMS[w]) {
                var fixed = closestWord(w);
                if (fixed) w = fixed;
            }
            if (SYNONYMS[w]) w = SYNONYMS[w];
            if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
            if (!STOP[w]) out.push(w);
        }
        return out;
    }

    var entries = [];
    var seeds = (typeof window !== 'undefined' && window.LESSFUN_AI_SEEDS) ? window.LESSFUN_AI_SEEDS : [];

    var VOCAB = {};
    seeds.forEach(function (seed) {
        (seed.t + ' ' + (seed.k || '')).toLowerCase().split(/[^a-z]+/).forEach(function (w) {
            if (w.length > 2) VOCAB[w] = true;
        });
    });
    Object.keys(SYNONYMS).forEach(function (w) { VOCAB[w] = true; VOCAB[SYNONYMS[w]] = true; });
    'name google assistant lessfun controls coins gift daily plane landing takeoff tranq arena revive multiplayer store garage showroom friend radio settings account sync purchase'.split(' ').forEach(function (w) { VOCAB[w] = true; });

    function editDistance(a, b) {
        var m = a.length, n = b.length;
        if (!m) return n;
        if (!n) return m;
        var prev = new Array(n + 1);
        var cur = new Array(n + 1);
        for (var j = 0; j <= n; j++) prev[j] = j;
        for (var i = 1; i <= m; i++) {
            cur[0] = i;
            for (var k = 1; k <= n; k++) {
                cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
            }
            var tmp = prev; prev = cur; cur = tmp;
        }
        return prev[n];
    }

    function closestWord(word) {
        var max = word.length >= 8 ? 2 : 1;
        var best = null, bestD = max + 1;
        var keys = Object.keys(VOCAB);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (Math.abs(k.length - word.length) > max) continue;
            var d = editDistance(word, k);
            if (d < bestD) { bestD = d; best = k; if (d === 1) break; }
        }
        return bestD <= max ? best : null;
    }

    seeds.forEach(function (seed) {
        VARIANTS.forEach(function (make) {
            var phrase = make(seed.t) + ' ' + (seed.k || '');
            var tokens = tokenize(phrase);
            entries.push({
                q: phrase,
                a: seed.a,
                t: seed.t,
                terms: tokens,
                termSet: tokens.reduce(function (o, w) { o[w] = true; return o; }, {})
            });
        });
    });

    var N = entries.length;
    var df = {};
    entries.forEach(function (e) {
        Object.keys(e.termSet).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    var idf = {};
    Object.keys(df).forEach(function (w) { idf[w] = Math.log((N + 1) / (df[w] + 1)) + 1; });

    var lastTopic = '';

    function answerFor(input) {
        var text = String(input || '').trim();
        if (!text) return 'Ask me about a game, Coins, gifts, controls, accounts, the Store, Garage, friends or settings.';
        var lower = text.toLowerCase().replace(/\bwhats\b/g, 'what is').replace(/\bur\b/g, 'your').replace(/\bu\b/g, 'you').replace(/\br\b/g, 'are');
        if (/^(hi|hello|hey|yo|sup|hiya)\b/.test(lower)) return 'Hi. Ask me about a game, Coins, Daily Gifts, controls, accounts, the Store, Garage, friends, radio or settings.';
        if (/your name|who are you|what are you called|what is your name/.test(lower)) return 'I am the LessFun Assistant. I run locally in the page and answer from a 1,000-pattern knowledge base about the arcade.';
        if (/^(can (you )?tell( me)?( something| anything)?|what can you (do|tell me)|what do you do|help me|what can you help with)\??$/.test(lower)) return 'I can tell you about every LessFun game, controls, Coins, Daily Gifts, accounts, cloud sync, the Store, Garage, Showroom, friends, radio, settings, multiplayer or troubleshooting.';
        if (/are you (a )?(real|human|ai|robot)|are you real/.test(lower)) return 'I am a local assistant, not a person. I match your question against the built-in LessFun knowledge base.';
        if (/how are you/.test(lower)) return 'I am awake and ready. Ask me anything about LessFun.';
        if (/^(thanks|thank you|ty|cheers)\b/.test(lower)) return 'You are welcome. Ask another LessFun question any time.';
        if (/^(bye|goodbye|see you)\b/.test(lower)) return 'See you. Come back for another run soon.';
        if (/^(help|what can i ask|what do you know)\b/.test(lower)) {
            return 'Ask about any of the ten games, controls, Coins, Daily Gifts, accounts, cloud sync, Store, Garage, Showroom, friends, messages, radio, graphics, Reduce Motion or multiplayer.';
        }
        if (/what are gifts|what is a gift|tell me about gifts/.test(lower)) {
            return 'Daily Gifts are free Coin rewards claimed once a day from the Games page. The seven-day cycle pays 50, 75, 100, 150, 200, 300 and 500 Coins.';
        }
        if (/\b(it|that|this|them)\b/.test(lower) && lastTopic) {
            text = lastTopic + ' ' + text;
        }
        var tokens = tokenize(text);
        if (!tokens.length) return 'Try asking about a game, Coins, Daily Gifts, controls or the Store.';
        var unique = Array.from(new Set(tokens));
        var best = null, bestScore = 0;
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var score = 0, matched = 0;
            for (var j = 0; j < unique.length; j++) {
                var w = unique[j];
                if (e.termSet[w]) { score += idf[w] || 1; matched++; }
            }
            if (!matched) continue;
            score += (matched / unique.length) * 2.4;
            if (matched === unique.length) score += 1.5;
            if (e.q.toLowerCase().indexOf(lower) >= 0 && lower.length > 5) score += 2.2;
            if (score > bestScore) { bestScore = score; best = e; }
        }
        if (!best || bestScore < 2.0) {
            return 'I am not sure about that one. Try a game name or a topic like Coins, Daily Gifts, controls, accounts, Store, Garage, friends, Boeing Landing or Tranq Arena.';
        }
        lastTopic = best.t;
        return best.a;
    }

    var open = false;
    var greeted = false;
    var typingTimer = 0;

    function esc(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function scrollMessages() {
        var box = document.getElementById('aiMessages');
        if (box) box.scrollTop = box.scrollHeight;
    }

    function addMessage(role, text) {
        var box = document.getElementById('aiMessages');
        if (!box) return;
        var row = document.createElement('div');
        row.className = 'ai-msg ai-msg-' + role;
        var bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        bubble.innerHTML = esc(text);
        row.appendChild(bubble);
        box.appendChild(row);
        scrollMessages();
    }

    function showTyping() {
        var box = document.getElementById('aiMessages');
        if (!box) return;
        var row = document.createElement('div');
        row.className = 'ai-msg ai-msg-bot ai-typing-row';
        row.id = 'aiTyping';
        row.innerHTML = '<div class="ai-bubble ai-typing"><i></i><i></i><i></i></div>';
        box.appendChild(row);
        scrollMessages();
    }

    function hideTyping() {
        var row = document.getElementById('aiTyping');
        if (row) row.remove();
    }

    function ask(text, instant) {
        var value = String(text || '').trim();
        if (!value) return;
        addMessage('user', value);
        showTyping();
        clearTimeout(typingTimer);
        var delay = instant ? 0 : 260 + Math.min(600, value.length * 4);
        typingTimer = setTimeout(function () {
            hideTyping();
            addMessage('bot', answerFor(value));
        }, delay);
    }

    function openPanel() {
        var dock = document.getElementById('aiDock');
        var panel = document.getElementById('aiPanel');
        if (!dock || !panel) return;
        open = true;
        dock.classList.add('is-open');
        panel.style.display = 'flex';
        if (!greeted) {
            greeted = true;
            addMessage('bot', 'Hi, I am the LessFun assistant. I know 1,000 answer patterns about the games, Coins, Daily Gifts, accounts, Store, Garage, friends, radio and settings. What do you want to know?');
        }
        var input = document.getElementById('aiInput');
        if (input) setTimeout(function () { input.focus(); }, 80);
    }

    function closePanel() {
        var dock = document.getElementById('aiDock');
        var panel = document.getElementById('aiPanel');
        open = false;
        if (dock) dock.classList.remove('is-open');
        if (panel) panel.style.display = 'none';
    }

    function togglePanel() {
        if (open) closePanel(); else openPanel();
    }

    function resetChat() {
        var box = document.getElementById('aiMessages');
        if (box) box.innerHTML = '';
        greeted = false;
        openPanel();
    }

    function submitForm(event) {
        if (event) event.preventDefault();
        var input = document.getElementById('aiInput');
        if (!input) return;
        var value = input.value;
        input.value = '';
        ask(value);
    }

    function suggestion(text) {
        ask(text);
    }

    function buildUi() {
        if (document.getElementById('aiDock')) return;
        var wrap = document.createElement('div');
        wrap.id = 'aiDock';
        wrap.className = 'ai-dock';
        wrap.innerHTML =
            '<section class="ai-panel" id="aiPanel" role="dialog" aria-label="LessFun assistant">' +
                '<header class="ai-head">' +
                    '<div class="ai-avatar">✦</div>' +
                    '<div class="ai-head-copy"><strong>LessFun Assistant</strong><small>1,000-fact knowledge base</small></div>' +
                    '<button type="button" class="ai-reset" onclick="LessFunAI.reset()" title="New chat">Reset</button>' +
                    '<button type="button" class="ai-close" onclick="LessFunAI.close()" aria-label="Close assistant">×</button>' +
                '</header>' +
                '<div class="ai-messages" id="aiMessages"></div>' +
                '<div class="ai-suggestions" id="aiSuggestions">' +
                    '<button type="button" onclick="LessFunAI.ask(\'How do I earn Coins?\')">Earn Coins</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'Boeing Landing controls\')">Plane controls</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'How does Tranq Arena revive work?\')">Tranq revive</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'What are Daily Gifts?\')">Daily Gifts</button>' +
                '</div>' +
                '<form class="ai-form" onsubmit="LessFunAI.submit(event)">' +
                    '<input id="aiInput" type="text" maxlength="240" autocomplete="off" placeholder="Ask about LessFun…" aria-label="Ask a question">' +
                    '<button type="submit" aria-label="Send">↑</button>' +
                '</form>' +
                '<p class="ai-foot">Answers from the built-in LessFun knowledge base.</p>' +
            '</section>';
        document.body.appendChild(wrap);
    }

    function onKey(event) {
        if (!open) return;
        if (event.key === 'Escape') closePanel();
    }

    function init() {
        buildUi();
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', function (event) {
            if (!open) return;
            var dock = document.getElementById('aiDock');
            if (dock && !dock.contains(event.target)) closePanel();
        }, { passive: true });
    }

    window.LessFunAI = {
        ask: ask,
        open: openPanel,
        close: closePanel,
        toggle: togglePanel,
        reset: resetChat,
        submit: submitForm,
        entries: entries.length,
        _answer: answerFor
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
