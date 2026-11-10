/* ============================================================
   LessFun Assistant — local 100,000+ answer knowledge engine
   ============================================================ */
(function () {
    'use strict';


    var STOP = {};
    'the a an is are was were how do does did i you your my me we our to of on in for what can could would should tell about and or it its with work works help please give detail details question explain know thanks'.split(' ').forEach(function (w) { STOP[w] = true; });

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
        boing: 'plane', moar: 'more', landin: 'landing', laning: 'landing', lnding: 'landing', geer: 'gear', controlls: 'control', controll: 'control',
        purchse: 'purchase', purchas: 'purchase', gogle: 'google', googel: 'google',
        accross: 'across', acount: 'account', acounts: 'account', walet: 'wallet'
    };

    var PHRASES = [
        [/fly\s+(the\s+)?(plane|aircraft|boeing)/g, 'boeing landing'],
        [/land\s+(the\s+)?(plane|aircraft|boeing)/g, 'boeing landing'],
        [/pilot\s+(the\s+)?(plane|aircraft)/g, 'boeing landing'],
        [/\bwhat'?s\b/g, 'what is'],
        [/\bwhats\b/g, 'what is'],
        [/\bim\b/g, 'i am'],
        [/\bur\b/g, 'your'],
        [/\bu\b/g, 'you'],
        [/\br\b/g, 'are'],
        [/\bwht\b|\bwat\b/g, 'what'],
        [/\bhw\b/g, 'how'],
        [/\bpls\b|\bplz\b/g, 'please'],
        [/\bcant\b/g, 'cannot'],
        [/\bdont\b/g, 'do not'],
        [/get\s+(more\s+)?coins/g, 'earn coins'],
        [/more\s+coins/g, 'earn coins'],
        [/take[\s-]?off/g, 'takeoff'],
        [/sign[\s-]?in/g, 'login'],
        [/log[\s-]?in/g, 'login'],
        [/log[\s-]?out/g, 'logout'],
        [/sign[\s-]?up/g, 'signup'],
        [/daily\s+gift/g, 'daily gift'],
        [/dead\s+coast/g, 'dead coast'],
        [/redline\s+gt/g, 'redline gt'],
        [/beach\s+racer/g, 'redline gt'],
        [/tunnel\s+rush/g, 'tunnel rush'],
        [/cube\s+stack/g, 'cube stack'],
        [/snow\s+rush/g, 'snow rush'],
        [/draw\s+(and|&)\s+guess/g, 'draw guess'],
        [/lucky\s+spin/g, 'lucky spin'],
        [/funtutu\s+test/g, 'funtutu test'],
        [/tranq\s+arena/g, 'tranq arena'],
        [/boeing\s+landing/g, 'boeing landing']
    ];

    function tokenize(text, fuzzy) {
        var s = String(text || '').toLowerCase();
        PHRASES.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
        s = s.replace(/[^a-z0-9]+/g, ' ').trim();
        var raw = s.split(/\s+/);
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var w = raw[i];
            if (!w || STOP[w] || w.length < 2) continue;
            if (fuzzy !== false && !VOCAB[w] && !SYNONYMS[w] && !CHAT_VOCAB[w]) {
                var fixed = closestWord(w);
                if (fixed) w = fixed;
            }
            if (SYNONYMS[w]) w = SYNONYMS[w];
            if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
            if (!STOP[w]) out.push(w);
        }
        return out;
    }

    var GAME_NAMES = ['Redline GT', 'Tunnel Rush', 'Cube Stack', 'Dead Coast', 'Funtutu Test', 'Snow Rush', 'Draw and Guess', 'Lucky Spin', 'Boeing Landing', 'Tranq Arena';
    var GAME_ALIASES = [
        ['redline gt', 'Redline GT'], ['redline', 'Redline GT'], ['beach racer', 'Redline GT'], ['beach', 'Redline GT'],
        ['tunnel rush', 'Tunnel Rush'], ['tunnel', 'Tunnel Rush'],
        ['cube stack', 'Cube Stack'], ['cube', 'Cube Stack'],
        ['dead coast', 'Dead Coast'],
        ['funtutu', 'Funtutu Test'], ['benchmark', 'Funtutu Test'],
        ['snow rush', 'Snow Rush'], ['snow', 'Snow Rush'],
        ['draw and guess', 'Draw and Guess'], ['draw guess', 'Draw and Guess'],
        ['lucky spin', 'Lucky Spin'], ['slot', 'Lucky Spin'],
        ['boeing landing', 'Boeing Landing'], ['boeing', 'Boeing Landing'], ['737', 'Boeing Landing'], ['plane', 'Boeing Landing'],
        ['tranq arena', 'Tranq Arena'], ['tranq', 'Tranq Arena'], ['tranquil', 'Tranq Arena']
    ];
    var SITE_TOPIC = { coin: 1, gift: 1, store: 1, garage: 1, showroom: 1, account: 1, sync: 1, radio: 1, setting: 1, friend: 1, message: 1, community: 1, score: 1, update: 1 };
    var CHAT_SITE_WORDS = { cookie: 1, advent: 1, christmas: 1, holiday: 1, assistant: 1, ai: 1, game: 1, arcade: 1, control: 1, tip: 1, guide: 1, wallet: 1, purchase: 1, gift: 1, daily: 1 };

    function detectGame(text) {
        for (var i = 0; i < GAME_ALIASES.length; i++) {
            if (text.indexOf(GAME_ALIASES[i][0]) >= 0) return GAME_ALIASES[i][1];
        }
        return null;
    }

    function gameForSeed(seed) {
        var hay = (seed.t + ' ' + (seed.k || '')).toLowerCase();
        for (var i = 0; i < GAME_NAMES.length; i++) {
            if (seed.t.toLowerCase().indexOf(GAME_NAMES[i].toLowerCase()) === 0) return GAME_NAMES[i];
        }
        for (var j = 0; j < GAME_ALIASES.length; j++) {
            if (hay.indexOf(GAME_ALIASES[j][0]) >= 0) return GAME_ALIASES[j][1];
        }
        return null;
    }

    var entries = [];
    var chatEntries = [];
    var indexBuilt = false;
    var chatIndexBuilt = false;
    var N = 0;
    var df = {};
    var idf = {};
    var chatDf = {};
    var chatIdf = {};
    var seeds = (typeof window !== 'undefined' && window.LESSFUN_AI_SEEDS) ? window.LESSFUN_AI_SEEDS : [];
    var chatPairs = (typeof window !== 'undefined' && window.LESSFUN_CHAT_PAIRS) ? window.LESSFUN_CHAT_PAIRS : [];
    var CHAT_VOCAB = {};
    chatPairs.forEach(function (pair) {
        String(pair[0] || '').toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) {
            if (w.length > 2) CHAT_VOCAB[w] = true;
        });
    });

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
        var d = [];
        for (var i = 0; i <= m; i++) {
            d[i] = [i];
            for (var j = 1; j <= n; j++) d[i][j] = i === 0 ? j : 0;
        }
        for (var r = 1; r <= m; r++) {
            for (var c = 1; c <= n; c++) {
                var cost = a[r - 1] === b[c - 1] ? 0 : 1;
                d[r][c] = Math.min(d[r - 1][c] + 1, d[r][c - 1] + 1, d[r - 1][c - 1] + cost);
                // Treat a swapped pair as one typo instead of two.
                if (r > 1 && c > 1 && a[r - 1] === b[c - 2] && a[r - 2] === b[c - 1]) {
                    d[r][c] = Math.min(d[r][c], d[r - 2][c - 2] + 1);
                }
            }
        }
        return d[m][n];
    }

    function closestWord(word) {
        var max = word.length >= 6 ? 2 : 1;
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

    function buildIndex() {
        if (indexBuilt) return;
        entries = [];
        df = {};
        idf = {};
        // One compact entry per topic. Query forms are matched by tokens, so
        // thousands of duplicate phrasing objects are no longer kept in RAM.
        seeds.forEach(function (seed) {
            var phrase = seed.t + ' ' + (seed.k || '');
            var topicTokens = tokenize(phrase, false);
            var tokens = topicTokens.concat(tokenize(seed.a || '', false));
            entries.push({
                q: phrase,
                a: seed.a,
                t: seed.t,
                game: gameForSeed(seed),
                termSet: tokens.reduce(function (o, w) { o[w] = true; return o; }, {}),
                topicSet: topicTokens.reduce(function (o, w) { o[w] = true; return o; }, {})
            });
        });
        N = entries.length;
        entries.forEach(function (e) {
            Object.keys(e.termSet).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
        });
        Object.keys(df).forEach(function (w) { idf[w] = Math.log((N + 1) / (df[w] + 1)) + 1; });
        indexBuilt = true;
    }

    function buildChatIndex() {
        if (chatIndexBuilt) return;
        chatEntries = [];
        chatDf = {};
        chatIdf = {};
        chatPairs.forEach(function (pair) {
            var q = String(pair[0] || '');
            var a = String(pair[1] || '');
            var topicTokens = tokenize(q, false);
            var tokens = topicTokens.concat(tokenize(a, false));
            chatEntries.push({
                q: q,
                a: a,
                t: q,
                termSet: tokens.reduce(function (o, w) { o[w] = true; return o; }, {}),
                topicSet: topicTokens.reduce(function (o, w) { o[w] = true; return o; }, {})
            });
        });
        var chatN = chatEntries.length;
        chatEntries.forEach(function (e) {
            Object.keys(e.termSet).forEach(function (w) { chatDf[w] = (chatDf[w] || 0) + 1; });
        });
        Object.keys(chatDf).forEach(function (w) { chatIdf[w] = Math.log((chatN + 1) / (chatDf[w] + 1)) + 1; });
        chatIndexBuilt = true;
    }

    function releaseIndex() {
        entries = [];
        chatEntries = [];
        df = {};
        idf = {};
        chatDf = {};
        chatIdf = {};
        N = 0;
        indexBuilt = false;
        chatIndexBuilt = false;
    }

    var lastTopic = '';
    var lastGame = '';
    var lastAnswer = '';
    var GAME_BY_ID = { 1: 'Redline GT', 2: 'Tunnel Rush', 3: 'Cube Stack', 4: 'Dead Coast', 6: 'Funtutu Test', 7: 'Snow Rush', 8: 'Draw & Guess', 9: 'Lucky Spin', 13: 'Boeing Landing', 14: 'Tranq Arena', 15: 'Arcade Tycoon' };

    function currentGameName() {
        try {
            if (typeof currentGameId !== 'undefined' && currentGameId != null && GAME_BY_ID[currentGameId]) return GAME_BY_ID[currentGameId];
        } catch (e) {}
        return '';
    }

    function isAcknowledgement(text) {
        var words = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
        if (!words.length || !words[0] || words.length > 5) return false;
        var allowed = {
            oh: 1, o: 1, ok: 1, okay: 1, k: 1, kk: 1, got: 1, it: 1, i: 1, know: 1, see: 1,
            right: 1, alright: 1, cool: 1, nice: 1, sure: 1, yeah: 1, yep: 1, yes: 1, no: 1,
            nope: 1, hmm: 1, ah: 1, lol: 1, haha: 1, interesting: 1, true: 1, then: 1, so: 1,
            thanks: 1, that: 1, fair: 1, enough: 1
        };
        for (var i = 0; i < words.length; i++) {
            if (!allowed[words[i]]) return false;
        }
        return true;
    }

    function navigateTo(view, label) {
        if (typeof window.showView === 'function') {
            setTimeout(function () {
                if (open) closePanel();
                if (document.body && document.body.classList.contains('in-game') && typeof window.closeGame === 'function') {
                    window.closeGame(true);
                }
                window.showView(view);
            }, 700);
            return 'Opening the ' + label + '…';
        }
        return 'Use the ' + label + ' button in the top navigation.';
    }

    function findBest(pool, unique, lower, weights) {
        var best = null, bestScore = 0, second = null, secondScore = 0, bestMatched = 0;
        var table = weights || idf;
        for (var i = 0; i < pool.length; i++) {
            var e = pool[i];
            var score = 0, matched = 0;
            for (var j = 0; j < unique.length; j++) {
                var w = unique[j];
                if (e.topicSet[w]) { score += (table[w] || 1) * 1.8; matched++; }
                else if (e.termSet[w]) { score += (table[w] || 1) * 0.55; matched++; }
            }
            if (!matched) continue;
            score += (matched / unique.length) * 2.4;
            if (matched === unique.length) score += 1.5;
            if (e.q.toLowerCase().indexOf(lower) >= 0 && lower.length > 5) score += 2.2;
            var topicWords = tokenize(e.t, false);
            var fullTopic = topicWords.length > 0;
            for (var k = 0; k < topicWords.length; k++) {
                if (unique.indexOf(topicWords[k]) < 0) { fullTopic = false; break; }
            }
            if (fullTopic) score += 4.5;
            if (score > bestScore) {
                second = best; secondScore = bestScore;
                best = e; bestScore = score; bestMatched = matched;
            } else if (score > secondScore) {
                second = e; secondScore = score;
            }
        }
        return { best: best, score: bestScore, matched: bestMatched, second: second, secondScore: secondScore };
    }

    function formatNumber(value) {
        return String(Math.round(value * 1000000) / 1000000);
    }

    function tryQuickAnswer(lower) {
        var m = lower.match(/^(?:(?:what is|what's|calculate|solve|how much is)\s+)?(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d+(?:\.\d+)?)\s*\??$/);
        if (m) {
            var x = parseFloat(m[1]), y = parseFloat(m[3]), op = m[2], out;
            if (op === '+') out = x + y;
            else if (op === '-') out = x - y;
            else if (op === '*' || op === 'x' || op === '×') out = x * y;
            else {
                if (y === 0) return 'You cannot divide by zero.';
                out = x / y;
            }
            return 'The answer is ' + formatNumber(out) + '.';
        }
        var wm = lower.match(/^(?:(?:what is|what's|calculate|solve|how much is)\s+)?(-?\d+(?:\.\d+)?)\s*(plus|minus|times|multiplied by|divided by)\s*(-?\d+(?:\.\d+)?)\s*\??$/);
        if (wm) {
            var a = parseFloat(wm[1]), b = parseFloat(wm[3]), opWord = wm[2], answer;
            if (opWord === 'plus') answer = a + b;
            else if (opWord === 'minus') answer = a - b;
            else if (opWord === 'times' || opWord === 'multiplied by') answer = a * b;
            else {
                if (b === 0) return 'You cannot divide by zero.';
                answer = a / b;
            }
            return 'The answer is ' + formatNumber(answer) + '.';
        }
        if (/^(what time is it|what is the time|current time|tell me the time)\??$/.test(lower)) {
            return 'The local time is ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
        }
        if (/^(what is the date|what date is it|what day is it|today's date|todays date)\??$/.test(lower)) {
            return 'Today is ' + new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.';
        }
        if (/^(flip a coin|toss a coin|heads or tails)\??$/.test(lower)) {
            return 'It landed on ' + (Math.random() < 0.5 ? 'heads' : 'tails') + '.';
        }
        if (/^(roll a dice|roll a die|roll the dice)\??$/.test(lower)) {
            return 'You rolled a ' + (Math.floor(Math.random() * 6) + 1) + '.';
        }
        if (/^(pick a number|random number)\??$/.test(lower)) {
            return 'I pick ' + (Math.floor(Math.random() * 100) + 1) + '.';
        }
        if (/how many days until christmas/.test(lower)) {
            var now = new Date();
            var target = new Date(now.getFullYear(), 11, 25);
            if (now > target) target = new Date(now.getFullYear() + 1, 11, 25);
            var days = Math.ceil((target - now) / 86400000);
            return 'Christmas is in ' + days + ' day' + (days === 1 ? '' : 's') + '.';
        }
        var pm = lower.match(/^(?:what is\s+)?(-?\d+(?:\.\d+)?)\s*%\s*of\s*(-?\d+(?:\.\d+)?)\??$/);
        if (pm) return formatNumber(parseFloat(pm[1]) / 100 * parseFloat(pm[2])) + '.';
        var sm = lower.match(/^(?:what is\s+)?(?:the\s+)?square root of\s+(-?\d+(?:\.\d+)?)\??$/);
        if (sm) {
            var sqrtValue = parseFloat(sm[1]);
            if (sqrtValue < 0) return 'Negative numbers do not have a real square root.';
            return 'The square root is ' + formatNumber(Math.sqrt(sqrtValue)) + '.';
        }
        var sqm = lower.match(/^(?:what is\s+)?(-?\d+(?:\.\d+)?)\s*squared\??$/);
        if (sqm) return formatNumber(parseFloat(sqm[1]) * parseFloat(sqm[1])) + '.';
        var powm = lower.match(/^(?:what is\s+)?(-?\d+(?:\.\d+)?)\s*(?:to the power of|\^)\s*(-?\d+(?:\.\d+)?)\??$/);
        if (powm) return formatNumber(Math.pow(parseFloat(powm[1]), parseFloat(powm[2]))) + '.';

        var um = lower.match(/^(?:what is\s+|convert\s+)?(-?\d+(?:\.\d+)?)\s*(c|celsius|f|fahrenheit|km|kilometers?|kilometres?|mi|miles?|kg|kilograms?|lb|lbs|pounds?|m|meters?|metres?|ft|feet)\s*(?:to|in)\s*(c|celsius|f|fahrenheit|km|kilometers?|kilometres?|mi|miles?|kg|kilograms?|lb|lbs|pounds?|m|meters?|metres?|ft|feet)\??$/);
        if (um) {
            var unitAliases = {
                c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f',
                km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
                mi: 'mi', mile: 'mi', miles: 'mi',
                kg: 'kg', kilogram: 'kg', kilograms: 'kg',
                lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
                m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
                ft: 'ft', foot: 'ft', feet: 'ft'
            };
            var amount = parseFloat(um[1]);
            var fromUnit = unitAliases[um[2]];
            var toUnit = unitAliases[um[3]];
            var isTemp = (fromUnit === 'c' || fromUnit === 'f' || toUnit === 'c' || toUnit === 'f');
            if (isTemp) {
                if (!((fromUnit === 'c' || fromUnit === 'f') && (toUnit === 'c' || toUnit === 'f'))) {
                    return 'Temperature conversion only works between Celsius and Fahrenheit.';
                }
                var celsius = fromUnit === 'c' ? amount : (amount - 32) * 5 / 9;
                var convertedTemp = toUnit === 'c' ? celsius : celsius * 9 / 5 + 32;
                return formatNumber(amount) + '°' + fromUnit.toUpperCase() + ' is ' + formatNumber(convertedTemp) + '°' + toUnit.toUpperCase() + '.';
            }
            var lengths = { km: 1000, m: 1, mi: 1609.344, ft: 0.3048 };
            var masses = { kg: 1, lb: 0.45359237 };
            var converted;
            if (lengths[fromUnit] && lengths[toUnit]) {
                converted = amount * lengths[fromUnit] / lengths[toUnit];
            } else if (masses[fromUnit] && masses[toUnit]) {
                converted = amount * masses[fromUnit] / masses[toUnit];
            } else {
                return 'Those units do not match. Try length, weight or temperature.';
            }
            return formatNumber(amount) + ' ' + um[2] + ' is ' + formatNumber(converted) + ' ' + um[3] + '.';
        }
        return '';
    }

    function generalChatAnswer(lower, unique) {
        var quick = tryQuickAnswer(lower);
        if (quick) return quick;
        if (!unique.length) return '';
        buildChatIndex();
        if (!chatEntries.length) return '';
        var result = findBest(chatEntries, unique, lower, chatIdf);
        if (!result.best || result.score < 2.6) return '';
        var ratio = result.matched / unique.length;
        if (unique.length > 1 && ratio < 0.5) return '';
        return result.best.a;
    }

    function answerFor(input) {
        buildIndex();
        var text = String(input || '').trim();
        if (!text) return 'Ask me about a game, Coins, gifts, controls, accounts, the Store, Garage, friends or settings.';
        var lower = text.toLowerCase().replace(/\bwhats\b/g, 'what is').replace(/\bur\b/g, 'your').replace(/\bu\b/g, 'you').replace(/\br\b/g, 'are');
        if (/^(hi|hello|hey|yo|sup|hiya)\b/.test(lower)) return 'Hi. Ask me about a game, Coins, Cookies, Daily Gifts, controls, accounts, the Store, Garage, friends, radio or settings.';
        if (/your name|who are you|what are you called|what is your name/.test(lower)) return 'I am the LessFun Assistant. I run locally in the page and answer from a 100,000+ answer knowledge engine covering LessFun and general topics.';
        if (/^(can (you )?tell( me)?( something| anything)?|what can you (do|tell me)|what can i (do|ask)|what do you do|what do you know|help me|what can you help with)\??$/.test(lower)) return 'I can answer LessFun questions — every game, controls, Coins, Cookies, Daily Gifts, accounts, Store, Garage, friends, radio, settings and multiplayer — and I can chat about general knowledge, jokes, riddles, food, travel, technology and everyday advice.';
        if (/are you (a )?(real|human|ai|robot)|are you real/.test(lower)) return 'I am a local assistant, not a person. I match your question against the built-in LessFun knowledge base.';
        if (/how are you/.test(lower)) return 'I am awake and ready. Ask me anything about LessFun.';
        if (/^(what|what\?|huh|what do you mean|i do not understand|i don't understand|i dont understand|meaning|explain)\??$/.test(lower)) {
            if (lastAnswer) return 'I mean: ' + lastAnswer + ' Ask about a specific part if you want it simpler.';
            return 'I may have missed that. Ask me about a game, Coins, Cookies, Daily Gifts, accounts, the Store or settings.';
        }
        if (isAcknowledgement(lower)) {
            if (lastGame) return 'Got it. Ask me anything else about ' + lastGame + ', or say "help" for the full topic list.';
            return 'Got it. Ask me anything else about LessFun — games, Coins, Cookies, Daily Gifts, accounts, the Store or settings.';
        }
        if (/(turn off|disable|stop|close|hide|remove).*(ai|assistant)|(ai|assistant).*(turn off|disable|off|close|hide)/.test(lower)) {
            return 'Close the assistant with the × button or press Escape. It stops and releases its index when closed, so it does not run in the background.';
        }
        if (/(open|show|start|turn on|enable).*(ai|assistant)|(ai|assistant).*(open|show|start|enable)/.test(lower)) {
            return 'Click the AI button in the top navigation to open the assistant.';
        }
        if (/\b(this|current) game\b|in this game|the game i am playing/.test(lower)) {
            var playing = currentGameName();
            if (playing) {
                lastGame = playing;
                return 'You are playing ' + playing + '. Ask me about its controls, tips, scoring or multiplayer.';
            }
            return 'Which game are you playing? ' + GAME_NAMES.join(', ') + '.';
        }
        if (/(what happens|what will happen|what is removed|what gets removed|what about).*(account|data)|(account|data).*(deleted|removed|closed)/.test(lower) && /(delet|remov|clos)/.test(lower)) {
            lastTopic = 'deleting an account';
            return 'Deleting an account permanently removes the account, its Community posts and its Coins wallet. It cannot be undone. Only the owner can delete an account, from the Owner Console.';
        }
        if (/discontinued|removed game|unavailable game|game removed|games removed/.test(lower)) {
            lastTopic = 'discontinued games';
            return 'No games have been discontinued. The owner can temporarily disable a game; a disabled game shows "Temporarily unavailable" on the Games page. The current lineup is ' + GAME_NAMES.join(', ') + '.';
        }
        if (/(what('s| is)? (inside|in)|what does|what is in|tell me about).*settings|settings.*(contain|include|inside)/.test(lower)) {
            lastTopic = 'settings';
            return 'Settings has four groups: Visuals (animations, 3D effects, graphics preset, render resolution, motion blur, FPS, Reduce Motion, shadows, crash slow-mo, film grain), Audio (sound effects and Christmas jingle), Gameplay (speed units, auto-save scores, hints) and Account (version, games available, latest updates and Christmas Secrets).';
        }
        if (/^(take me to|open|go to|show me|bring me to)\b.*\bgarage\b/.test(lower)) return navigateTo('garage', 'Garage');
        if (/^(take me to|open|go to|show me|bring me to)\b.*\bstore\b/.test(lower)) return navigateTo('store', 'Store');
        if (/^(take me to|open|go to|show me|bring me to)\b.*\bsettings\b/.test(lower)) return navigateTo('settings', 'Settings');
        if (/^(take me to|open|go to|show me|bring me to)\b.*\bcommunity\b/.test(lower)) return navigateTo('community', 'Community');
        if (/^(take me to|open|go to|show me|bring me to)\b.*\b(friends|users)\b/.test(lower)) return navigateTo('users', 'Friends');
        if (/^(take me to|open|go to|show me|bring me to)\b.*\b(games|arcade|home)\b/.test(lower)) return navigateTo('games', 'Games');
        if (/(delete|remove|close|wipe|erase).*(account|profile)|(account|profile).*(delete|removed|closed|erased|gone)/.test(lower)) {
            lastTopic = 'deleting an account';
            return 'There is no self-serve delete button. Email the owner at masonwyj@gmail.com with your username and ask for account deletion. The owner removes the account, posts and wallet from the Owner Console.';
        }
        if (/(talk|speak|contact|reach|message|email|complain|ask).*(owner|mason|totallymason|developer|support)|(owner|mason|totallymason).*(contact|email|talk|reach|ask)|who (is|are) (the )?(owner|mason|totallymason)|who (owns|made|runs|created)/.test(lower)) {
            lastTopic = 'contacting the owner';
            return 'The owner is Mason Wong (TotallyMason). Email masonwyj@gmail.com or post in the Community. For a bug, include the game, your device and browser.';
        }
        if (/(report|reporting).*(bug|problem|issue|glitch|error)|(found|there is|there\'s) a (bug|problem|issue)|something (is|seems) broken/.test(lower)) {
            lastTopic = 'reporting a bug';
            return 'Report a bug in the Community or email masonwyj@gmail.com. Include the game, what you did, your device and browser, and any error message.';
        }
        if (/\badvent\b|christmas calendar/.test(lower)) {
            lastTopic = 'the Advent Calendar';
            return 'The Advent Calendar runs in December with one door per day through December 24. Every door gives Cookies only: Day 1 gives 25 and Day 24 gives 250.';
        }
        if (/\bcookies?\b|christmas currency/.test(lower)) {
            lastTopic = 'Cookies';
            return 'Cookies are the Christmas currency. Earn them from game runs during the holiday event, Daily Gifts and Advent doors. Spend them only in the Store: 10 Cookies gives 250 Coins, 15 gives 1,000 Arcade Cash, 25 gives 750 Coins or a mystery cosmetic, and 50 gives 2,000 Coins.';
        }
        if (/best car|fastest car|which car|what car/.test(lower)) {
            lastTopic = 'choosing a car';
            return 'There is no single best car. Every Redline GT car has unique handling, so test favourites in the Garage and use the Showroom filters. Engine, aero and tyre parts usually matter more than the body.';
        }
        if (/christmas event|holiday event|christmas update/.test(lower)) {
            lastTopic = 'the Christmas event';
            return 'During the Christmas event, games award Cookies, the Advent Calendar gives daily Cookies, Daily Gifts add 3 Cookies, and Snow Rush plus Christmas cosmetics are available in the Store.';
        }
        if (/daily gift|daily reward/.test(lower)) {
            lastTopic = 'Daily Gifts';
            return 'The Daily Gift banner on the Games page gives one claim per day. The seven-day cycle pays 50, 75, 100, 150, 200, 300 and 500 Coins, plus 3 Cookies during the Christmas event.';
        }
        if (/^(thanks|thank you|ty|cheers)\b/.test(lower)) return 'You are welcome. Ask another LessFun question any time.';
        if (/^(bye|goodbye|see you)\b/.test(lower)) return 'See you. Come back for another run soon.';
        if (/^(help|what can i ask|what do you know)\b/.test(lower)) {
            return 'Ask about the games, Coins, Cookies, Advent, Daily Gifts, accounts, Store, Garage, friends, radio or settings. You can also ask for general knowledge, a joke, a riddle or everyday advice.';
        }
        if (/what are gifts|what is a gift|tell me about gifts/.test(lower)) {
            return 'Daily Gifts are free Coin rewards claimed once a day from the Games page. The seven-day cycle pays 50, 75, 100, 150, 200, 300 and 500 Coins.';
        }
        if (/get (more )?coins|earn coins|more coins|coins fast/.test(lower)) {
            return 'Earn Coins by playing, completing runs, claiming the Daily Gift and keeping a daily streak. Longer active runs pay more.';
        }

        var quickAnswer = tryQuickAnswer(lower);
        if (quickAnswer) return quickAnswer;

        var queryGame = detectGame(lower);
        if (!queryGame && (/^(what|how) about\b/.test(lower) || /^and\b/.test(lower)) && lastGame) {
            text = lastGame + ' ' + text;
            queryGame = lastGame;
        }
        if (!queryGame && /\b(it|that|this|its|them)\b/.test(lower)) {
            var contextName = lastGame || lastTopic;
            if (contextName) {
                text = contextName + ' ' + text;
                queryGame = detectGame(String(contextName).toLowerCase());
            }
        }

        var tokens = tokenize(text);
        if (!tokens.length) return 'Try asking about a game, Coins, Daily Gifts, controls or the Store.';
        var unique = Array.from(new Set(tokens));

        var genericWords = unique.filter(function (w) {
            return w === 'control' || w === 'tip' || w === 'play' || w === 'game' || w === 'guide';
        });
        if (!queryGame && genericWords.length === unique.length) {
            return 'Which game? Redline GT, Tunnel Rush, Cube Stack, Dead Coast, Funtutu Test, Snow Rush, Draw and Guess, Lucky Spin, Boeing Landing or Tranq Arena.';
        }

        var siteContext = unique.some(function (w) { return !!SITE_TOPIC[w] || !!CHAT_SITE_WORDS[w]; });
        if (!queryGame && !siteContext) {
            var chatReply = generalChatAnswer(lower, unique);
            if (chatReply) return chatReply;
        }

        if (queryGame && /multiplayer|online/.test(lower)) {
            var hasMultiplayer = entries.some(function (e) {
                return e.game === queryGame && /multiplayer|online/i.test(e.t);
            });
            if (!hasMultiplayer) {
                lastGame = queryGame;
                return queryGame + ' is single-player. Multiplayer is available in Redline GT with room codes and in Tranq Arena through the public lobby.';
            }
        }

        var pool = entries;
        var siteTopic = unique.some(function (w) { return !!SITE_TOPIC[w]; });
        if (queryGame && !siteTopic) {
            var scoped = entries.filter(function (e) { return e.game === queryGame; });
            if (scoped.length >= 20) pool = scoped;
        }

        var result = findBest(pool, unique, lower);
        if ((!result.best || result.score < 2.2) && pool !== entries) {
            var globalResult = findBest(entries, unique, lower);
            if (globalResult.score > result.score) result = globalResult;
        }

        if (!result.best || result.score < 2.0) {
            var hint = queryGame ? ' Try asking about its controls, release, tips, multiplayer or common problems.' : '';
            var focus = queryGame || lastGame;
            var focusHint = focus ? ' You were asking about ' + focus + '.' : '';
            return 'I am not sure about that one.' + focusHint + hint + ' Try asking about games, Coins, Cookies, Daily Gifts, accounts, settings, general knowledge, jokes or advice.';
        }
        if (result.best.game) lastGame = result.best.game;
        lastTopic = result.best.t;
        return result.best.a;
    }

    var open = false;
    var greeted = false;
    var typingTimer = 0;
    var streamTimer = 0;

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

    function streamMessage(text) {
        var box = document.getElementById('aiMessages');
        if (!box) return;
        if (streamTimer) { clearInterval(streamTimer); streamTimer = 0; }
        var row = document.createElement('div');
        row.className = 'ai-msg ai-msg-bot';
        var bubble = document.createElement('div');
        bubble.className = 'ai-bubble ai-streaming';
        row.appendChild(bubble);
        box.appendChild(row);
        var words = String(text || '').split(' ');
        var index = 0;
        var buffer = '';
        scrollMessages();
        streamTimer = setInterval(function () {
            if (index >= words.length) {
                bubble.textContent = buffer.trim();
                bubble.classList.remove('ai-streaming');
                clearInterval(streamTimer);
                streamTimer = 0;
                scrollMessages();
                return;
            }
            buffer += (index ? ' ' : '') + words[index++];
            bubble.textContent = buffer;
            scrollMessages();
        }, 28);
    }

    function ask(text, instant) {
        var value = String(text || '').trim();
        if (!value) return;
        addMessage('user', value);
        showTyping();
        clearTimeout(typingTimer);
        var delay = instant ? 0 : 950 + Math.min(850, value.length * 5);
        typingTimer = setTimeout(function () {
            hideTyping();
            var reply = answerFor(value);
            lastAnswer = reply;
            streamMessage(reply);
        }, delay);
    }

    function openPanel() {
        buildIndex();
        var dock = document.getElementById('aiDock');
        var panel = document.getElementById('aiPanel');
        if (!dock || !panel) return;
        open = true;
        dock.classList.add('is-open');
        panel.style.display = 'flex';
        if (!greeted) {
            greeted = true;
            addMessage('bot', 'Hi, I am the LessFun assistant. I can answer LessFun questions and chat about general topics, with 100,000+ possible answers. What do you want to know?');
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
        releaseIndex();
    }

    function togglePanel() {
        if (open) closePanel(); else openPanel();
    }

    function resetChat() {
        if (streamTimer) { clearInterval(streamTimer); streamTimer = 0; }
        clearTimeout(typingTimer);
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
                    '<div class="ai-head-copy"><strong>LessFun Assistant</strong><small>100,000+ answers · general chat</small></div>' +
                    '<button type="button" class="ai-reset" onclick="LessFunAI.reset()" title="New chat">Reset</button>' +
                    '<button type="button" class="ai-close" onclick="LessFunAI.close()" aria-label="Close assistant">×</button>' +
                '</header>' +
                '<div class="ai-messages" id="aiMessages"></div>' +
                '<div class="ai-suggestions" id="aiSuggestions">' +
                    '<button type="button" onclick="LessFunAI.ask(\'How do I earn Coins?\')">Earn Coins</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'Boeing Landing controls\')">Plane controls</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'How does Tranq Arena revive work?\')">Tranq revive</button>' +
                    '<button type="button" onclick="LessFunAI.ask(\'What are Cookies?\')">Cookies</button>' +
                '</div>' +
                '<form class="ai-form" onsubmit="LessFunAI.submit(event)">' +
                    '<input id="aiInput" type="text" maxlength="240" autocomplete="off" placeholder="Ask about LessFun…" aria-label="Ask a question">' +
                    '<button type="submit" aria-label="Send">↑</button>' +
                '</form>' +
                '<p class="ai-foot">Answers from the built-in LessFun knowledge and general chat packs.</p>' +
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
        get entries() { return entries.length + chatEntries.length; },
        _answer: answerFor
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
