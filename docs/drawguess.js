/* Draw & Guess — lazy-loaded module. */
/* ============================================================
   Draw & Guess — live public drawing game
   ============================================================ */
const DG_WORDS = [
    'merlion', 'hdb', 'mrt', 'durian', 'laksa', 'satay', 'kopi', 'kaya', 'otter', 'supertree',
    'umbrella', 'slippers', 'laptop', 'sunflower', 'fishball', 'mooncake', 'dragon', 'mermaid', 'pirate', 'rocket',
    'volcano', 'penguin', 'giraffe', 'octopus', 'dinosaur', 'robot', 'wizard', 'castle', 'rainbow', 'snowman',
    'pumpkin', 'ghost', 'vampire', 'werewolf', 'zombie', 'skeleton', 'witch', 'cauldron', 'broom', 'potion',
    'treasure', 'island', 'coconut', 'pineapple', 'watermelon', 'strawberry', 'banana', 'carrot', 'broccoli', 'pizza',
    'burger', 'sushi', 'noodles', 'dumpling', 'teapot', 'monsoon', 'lightning', 'thunder', 'cloud', 'sun',
    'moon', 'star', 'planet', 'astronaut', 'satellite', 'telescope', 'camera', 'guitar', 'piano', 'drum',
    'headphones', 'microphone', 'bicycle', 'motorcycle', 'airplane', 'helicopter', 'submarine', 'sailboat', 'train', 'bus',
    'taxi', 'signal', 'escalator', 'elevator', 'staircase', 'window', 'mirror', 'clock', 'candle', 'lamp',
    'key', 'lock', 'door', 'bridge', 'fountain', 'garden', 'playground', 'swings', 'balloon', 'kite'
];
const DG_COLORS = ['#ffffff', '#111111', '#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#ff7b00'];
let drawGame = {
    channel: null,
    id: '',
    name: '',
    players: {},
    hostId: '',
    word: '',
    drawerId: '',
    roundEnd: 0,
    timer: 0,
    drawing: false,
    lastPoint: null,
    color: '#ffffff',
    size: 4,
    eraser: false,
    scores: {},
    guesses: {},
    chosenDrawer: '',
    roundActive: false
};

function dgId() {
    return 'dg-' + Math.random().toString(36).slice(2, 10);
}

function dgName() {
    if (currentUser && currentUser.type === 'user' && currentUser.username) return currentUser.username;
    return 'Guest-' + Math.random().toString(36).slice(2, 6);
}

function dgIsHost() {
    return drawGame.hostId === drawGame.id;
}

function dgIsDrawer() {
    return drawGame.drawerId === drawGame.id && drawGame.roundActive;
}

function dgSetStatus(text) {
    var el = document.getElementById('dgStatus');
    if (el) el.textContent = text || '';
}

function dgSend(event, payload) {
    if (!drawGame.channel) return;
    try {
        var sent = drawGame.channel.send({ type: 'broadcast', event: event, payload: payload });
        if (sent && sent.catch) sent.catch(function () {});
    } catch (e) {}
}

function dgPlayersSorted() {
    return Object.keys(drawGame.players).map(function (id) {
        var p = drawGame.players[id];
        return { id: id, name: p.name || 'Player', joinedAt: p.joinedAt || 0, score: drawGame.scores[id] || 0 };
    }).sort(function (a, b) {
        return (a.joinedAt - b.joinedAt) || a.id.localeCompare(b.id);
    });
}

function dgRenderPlayers() {
    var host = document.getElementById('dgPlayers');
    if (!host) return;
    var list = dgPlayersSorted();
    host.innerHTML = list.map(function (p) {
        var tags = [];
        if (p.id === drawGame.hostId) tags.push('host');
        if (p.id === drawGame.drawerId) tags.push('drawing');
        if (p.id === drawGame.id) tags.push('you');
        return '<div class="dg-player' + (p.id === drawGame.id ? ' is-me' : '') + (p.id === drawGame.drawerId ? ' is-drawing' : '') + '">' +
            '<span class="dg-avatar">' + escapeHtml(p.name.charAt(0).toUpperCase()) + '</span>' +
            '<span class="dg-player-name">' + escapeHtml(p.name) + '</span>' +
            '<span class="dg-player-score">' + p.score + '</span>' +
            (tags.length ? '<small>' + tags.join(' · ') + '</small>' : '') +
        '</div>';
    }).join('') || '<p class="dg-empty">Connecting…</p>';

    var select = document.getElementById('dgDrawerSelect');
    var wrap = document.getElementById('dgChooseWrap');
    if (wrap) wrap.style.display = (dgIsHost() && !drawGame.roundActive && list.length > 1) ? 'flex' : 'none';
    if (select) {
        var current = drawGame.chosenDrawer || '';
        select.innerHTML = list.map(function (p) {
            return '<option value="' + escapeAttr(p.id) + '"' + (p.id === current ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
        }).join('');
        if (list.length && !list.some(function (p) { return p.id === current; })) {
            drawGame.chosenDrawer = list[0].id;
            select.value = list[0].id;
        } else if (!current && list.length) {
            drawGame.chosenDrawer = list[0].id;
            select.value = list[0].id;
        }
    }
    var banner = document.getElementById('dgDrawerBanner');
    if (banner) {
        if (drawGame.roundActive && drawGame.drawerId) {
            var drawer = list.find(function (p) { return p.id === drawGame.drawerId; });
            banner.textContent = '✏️ ' + (drawer ? drawer.name : 'A player') + ' is drawing' + (dgIsDrawer() ? ' — that is you!' : '');
            banner.classList.add('is-active');
        } else {
            banner.textContent = dgIsHost() ? 'Choose a drawer and start the round' : 'Waiting for the host to start…';
            banner.classList.remove('is-active');
        }
    }
    var startBtn = document.getElementById('dgStartBtn');
    if (startBtn) startBtn.style.display = (dgIsHost() && !drawGame.roundActive) ? 'inline-flex' : 'none';
}

function dgRenderWord() {
    var el = document.getElementById('dgWord');
    if (!el) return;
    if (!drawGame.roundActive) {
        el.textContent = drawGame.word ? 'Word: ' + drawGame.word : 'Waiting for a round…';
        return;
    }
    if (dgIsDrawer()) el.textContent = drawGame.word;
    else el.textContent = drawGame.word.split('').map(function () { return '_'; }).join(' ');
    var banner = document.getElementById('dgDrawerBanner');
    if (banner && drawGame.roundActive) {
        var list = dgPlayersSorted();
        var drawer = list.find(function (p) { return p.id === drawGame.drawerId; });
        banner.textContent = '✏️ ' + (drawer ? drawer.name : 'A player') + ' is drawing' + (dgIsDrawer() ? ' — that is you!' : '');
        banner.classList.add('is-active');
    }
}

function dgAppendChat(name, text, system) {
    var chat = document.getElementById('dgChat');
    if (!chat) return;
    var row = document.createElement('div');
    row.className = 'dg-chat-row' + (system ? ' is-system' : '');
    row.innerHTML = system ? escapeHtml(text) : '<b>' + escapeHtml(name) + '</b> ' + escapeHtml(text);
    chat.appendChild(row);
    while (chat.children.length > 5) chat.removeChild(chat.firstChild);
    chat.scrollTop = chat.scrollHeight;
}

function dgCanvasPoint(e) {
    var canvas = document.getElementById('dgCanvas');
    if (!canvas) return null;
    var r = canvas.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    };
}

function dgDrawLine(x1, y1, x2, y2, color, size, erase) {
    var canvas = document.getElementById('dgCanvas');
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    g.save();
    g.strokeStyle = erase ? '#0b1018' : color;
    g.lineWidth = size * (w / 900);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x1 * w, y1 * h);
    g.lineTo(x2 * w, y2 * h);
    g.stroke();
    g.restore();
}

function dgClearCanvas() {
    var canvas = document.getElementById('dgCanvas');
    if (!canvas) return;
    var g = canvas.getContext('2d');
    g.fillStyle = '#0b1018';
    g.fillRect(0, 0, canvas.width, canvas.height);
}

function dgChooseDrawer(id) {
    drawGame.chosenDrawer = String(id || '');
}

function dgStartRound() {
    if (!dgIsHost() || !supabaseClient) return;
    var list = dgPlayersSorted();
    if (list.length < 2) { dgSetStatus('Need at least 2 players to start.'); return; }
    var candidates = list.filter(function (p) { return p.id !== drawGame.drawerId; });
    if (!candidates.length) candidates = list;
    var drawer = candidates[Math.floor(Math.random() * candidates.length)];
    var word = DG_WORDS[Math.floor(Math.random() * DG_WORDS.length)];
    drawGame.word = word;
    drawGame.drawerId = drawer.id;
    drawGame.roundActive = true;
    drawGame.roundEnd = Date.now() + 60000;
    drawGame.guesses = {};
    dgSend('dg-round', { word: word, drawerId: drawer.id, endsAt: drawGame.roundEnd, scores: drawGame.scores });
    dgClearCanvas();
    dgRenderWord();
    dgRenderPlayers();
    dgAppendChat('', 'New round! ' + drawer.name + ' is drawing.', true);
    dgSetStatus('60 seconds. Drawer: ' + drawer.name);
}

function dgEndRound() {
    if (!drawGame.roundActive) return;
    drawGame.roundActive = false;
    dgSend('dg-end', { word: drawGame.word, scores: drawGame.scores });
    dgRenderWord();
    dgRenderPlayers();
    dgAppendChat('', 'Round over. The word was "' + drawGame.word + '".', true);
    dgSetStatus('Round over. Host can start another.');
}

function dgHandleGuess(payload) {
    if (!drawGame.roundActive || payload.id === drawGame.drawerId) return;
    if (drawGame.guesses[payload.id]) return;
    var guess = String(payload.text || '').trim().toLowerCase();
    if (!guess) return;
    dgAppendChat(payload.name, payload.text, false);
    if (!dgIsHost()) return;
    if (guess !== drawGame.word.toLowerCase()) return;
    drawGame.guesses[payload.id] = true;
    drawGame.scores[payload.id] = (drawGame.scores[payload.id] || 0) + 1;
    drawGame.scores[drawGame.drawerId] = (drawGame.scores[drawGame.drawerId] || 0) + 1;
    dgSend('dg-correct', { id: payload.id, name: payload.name, scores: drawGame.scores });
    dgAppendChat('', payload.name + ' guessed it!', true);
    dgRenderPlayers();
    var correctCount = Object.keys(drawGame.guesses).length;
    if (correctCount >= Math.max(1, Object.keys(drawGame.players).length - 1)) dgEndRound();
}

function dgConnect() {
    if (!supabaseClient) { dgSetStatus('Draw & Guess needs a connection.'); return; }
    drawGame.id = dgId();
    drawGame.name = dgName();
    drawGame.channel = supabaseClient.channel('lessfun-drawguess-public', {
        config: { presence: { key: drawGame.id } }
    });
    drawGame.channel.on('presence', { event: 'sync' }, function () {
        var state = drawGame.channel.presenceState() || {};
        drawGame.players = {};
        Object.keys(state).forEach(function (key) {
            (state[key] || []).forEach(function (meta) {
                drawGame.players[key] = { name: meta.name || key, joinedAt: meta.joinedAt || 0 };
            });
        });
        var sorted = dgPlayersSorted();
        drawGame.hostId = sorted.length ? sorted[0].id : drawGame.id;
        dgRenderPlayers();
        dgRenderWord();
    });
    drawGame.channel.on('broadcast', { event: 'dg-line' }, function (msg) {
        var p = msg.payload || {};
        dgDrawLine(p.x1, p.y1, p.x2, p.y2, p.color, p.size, p.erase);
    });
    drawGame.channel.on('broadcast', { event: 'dg-clear' }, function () { dgClearCanvas(); });
    drawGame.channel.on('broadcast', { event: 'dg-round' }, function (msg) {
        var p = msg.payload || {};
        drawGame.word = p.word || '';
        drawGame.drawerId = p.drawerId || '';
        drawGame.roundEnd = p.endsAt || 0;
        drawGame.scores = p.scores || drawGame.scores;
        drawGame.roundActive = true;
        drawGame.guesses = {};
        dgClearCanvas();
        dgRenderWord();
        dgRenderPlayers();
        dgAppendChat('', 'New round! The word has ' + drawGame.word.length + ' letters.', true);
    });
    drawGame.channel.on('broadcast', { event: 'dg-end' }, function (msg) {
        var p = msg.payload || {};
        drawGame.roundActive = false;
        drawGame.scores = p.scores || drawGame.scores;
        dgRenderWord();
        dgRenderPlayers();
        dgAppendChat('', 'Round over. The word was "' + (p.word || drawGame.word) + '".', true);
    });
    drawGame.channel.on('broadcast', { event: 'dg-guess' }, function (msg) { dgHandleGuess(msg.payload || {}); });
    drawGame.channel.on('broadcast', { event: 'dg-correct' }, function (msg) {
        var p = msg.payload || {};
        drawGame.scores = p.scores || drawGame.scores;
        if (p.id && !drawGame.guesses[p.id]) {
            drawGame.guesses[p.id] = true;
            dgAppendChat('', (p.name || 'Player') + ' guessed it!', true);
        }
        dgRenderPlayers();
    });
    drawGame.channel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
            drawGame.channel.track({ name: drawGame.name, joinedAt: Date.now() });
            dgSetStatus('Connected. Waiting for players…');
        }
    });
    clearInterval(drawGame.timer);
    drawGame.timer = setInterval(function () {
        var t = document.getElementById('dgTimer');
        if (!t) return;
        if (drawGame.roundActive) {
            var left = Math.max(0, Math.ceil((drawGame.roundEnd - Date.now()) / 1000));
            t.textContent = left + 's';
            if (left <= 0 && dgIsHost()) dgEndRound();
        } else {
            t.textContent = '--';
        }
    }, 250);
}

function dgDestroy() {
    if (drawGame.timer) { clearInterval(drawGame.timer); drawGame.timer = 0; }
    if (drawGame.channel && supabaseClient) {
        try { drawGame.channel.untrack(); } catch (e) {}
        try { supabaseClient.removeChannel(drawGame.channel); } catch (e) {}
    }
    drawGame.channel = null;
    drawGame.players = {};
    drawGame.roundActive = false;
}

function openDrawGuessGame() {
    if (arcadeMp.connected) arcadeMpLeave(true);
    if (zombieMp.connected) zombieMpLeave(true);
    if (window.Games3D) window.Games3D.stop();
    dgDestroy();
    currentGameId = 8;
    document.getElementById('modalGameTitle').textContent = 'Draw & Guess';
    var body = document.getElementById('modalGameBody');
    body.innerHTML =
        '<div class="dg-wrap">' +
            '<div class="dg-head">' +
                '<div><span class="dg-kicker">LESSFUN · DRAW & GUESS</span><strong id="dgWord">Waiting for a round…</strong></div>' +
                '<div class="dg-clock"><small>TIME</small><span class="dg-timer" id="dgTimer">--</span></div>' +
            '</div>' +
            '<div class="dg-drawer-banner" id="dgDrawerBanner">Waiting for players…</div>' +
            '<div class="dg-main">' +
                '<canvas id="dgCanvas" class="dg-canvas" width="900" height="520"></canvas>' +
                '<aside class="dg-side">' +
                    '<div class="dg-players" id="dgPlayers"><p class="dg-empty">Connecting…</p></div>' +
                    '<div class="dg-chat" id="dgChat"></div>' +
                    '<form class="dg-guess-form" onsubmit="event.preventDefault();dgSubmitGuess();">' +
                        '<input id="dgGuess" type="text" maxlength="80" placeholder="Type your guess…" autocomplete="off">' +
                        '<button type="submit">Send</button>' +
                    '</form>' +
                    '<div class="dg-status" id="dgStatus"></div>' +
                '</aside>' +
            '</div>' +
            '<div class="dg-tools">' +
                '<div class="dg-colors" id="dgColors"></div>' +
                '<div class="dg-sizes"><button type="button" onclick="dgSetSize(2)">S</button><button type="button" onclick="dgSetSize(4)">M</button><button type="button" onclick="dgSetSize(8)">L</button></div>' +
                '<button type="button" class="dg-tool" onclick="dgToggleEraser()">Eraser</button>' +
                '<button type="button" class="dg-tool" onclick="dgClear()">Clear</button>' +
                '<button type="button" class="dg-tool dg-start" id="dgStartBtn" onclick="dgStartRound()">Start round</button>' +
                '<button type="button" class="dg-tool" onclick="closeGame()">Leave</button>' +
            '</div>' +
        '</div>';
    document.getElementById('gameModal').style.display = 'flex';
    var colors = document.getElementById('dgColors');
    if (colors) {
        colors.innerHTML = DG_COLORS.map(function (c, i) {
            return '<button type="button" class="dg-color' + (i === 0 ? ' is-active' : '') + '" style="--swatch:' + c + '" onclick="dgSetColor(\'' + c + '\')"></button>';
        }).join('');
    }
    dgClearCanvas();
    dgConnect();
    var canvas = document.getElementById('dgCanvas');
    if (canvas) {
        canvas.addEventListener('pointerdown', dgPointerDown);
        canvas.addEventListener('pointermove', dgPointerMove);
        canvas.addEventListener('pointerup', dgPointerUp);
        canvas.addEventListener('pointercancel', dgPointerUp);
        canvas.addEventListener('pointerleave', dgPointerUp);
    }
}

function dgSetColor(color) {
    drawGame.color = color;
    drawGame.eraser = false;
    var buttons = document.querySelectorAll('.dg-color');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('is-active', buttons[i].style.getPropertyValue('--swatch') === color);
    }
}

function dgSetSize(size) { drawGame.size = Number(size) || 4; }
function dgToggleEraser() { drawGame.eraser = !drawGame.eraser; }
function dgClear() { dgClearCanvas(); dgSend('dg-clear', {}); }
function dgSubmitGuess() {
    var input = document.getElementById('dgGuess');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    input.value = '';
    if (dgIsDrawer()) {
        dgAppendChat(drawGame.name, text, false);
        dgSend('dg-guess', { id: drawGame.id, name: drawGame.name, text: text });
        return;
    }
    dgSend('dg-guess', { id: drawGame.id, name: drawGame.name, text: text });
    if (!dgIsHost()) dgAppendChat(drawGame.name, text, false);
}

function dgPointerDown(e) {
    if (!dgIsDrawer()) return;
    e.preventDefault();
    drawGame.drawing = true;
    drawGame.lastPoint = dgCanvasPoint(e);
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
}
function dgPointerMove(e) {
    if (!drawGame.drawing || !dgIsDrawer()) return;
    var p = dgCanvasPoint(e);
    if (!p || !drawGame.lastPoint) return;
    dgDrawLine(drawGame.lastPoint.x, drawGame.lastPoint.y, p.x, p.y, drawGame.color, drawGame.size, drawGame.eraser);
    dgSend('dg-line', { x1: drawGame.lastPoint.x, y1: drawGame.lastPoint.y, x2: p.x, y2: p.y, color: drawGame.color, size: drawGame.size, erase: drawGame.eraser });
    drawGame.lastPoint = p;
}
function dgPointerUp() { drawGame.drawing = false; drawGame.lastPoint = null; }
