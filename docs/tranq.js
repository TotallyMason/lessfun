/* ============================================================
   Tranq Arena — last-two-standing tranquilizer showdown
   ============================================================ */
(function () {
    'use strict';

    var WORLD_W = 1000;
    var WORLD_H = 620;
    var canvas = null, ctx = null, stage = null, resizeObs = null;
    var raf = 0, running = false, lastFrame = 0;
    var W = 900, H = 600, DPR = 1, scale = 1, ox = 0, oy = 0;
    var audioCtx = null;
    var keys = {};
    var hudTimer = 0;
    var overlayShown = false;

    var T = {
        players: [],
        darts: [],
        particles: [],
        feed: [],
        t: 0,
        phase: 'countdown',
        countdown: 3,
        final: false,
        over: false,
        winner: false,
        score: 0,
        downs: 0,
        elims: 0,
        coins: 0
    };

    var mp = {
        channel: null, id: '', name: '', color: '#5fe7ff', timer: 0,
        count: 0, startCount: 0, started: false, startTimer: 0, ready: false
    };

    var COLORS = ['#5fe7ff', '#ff6f91', '#7dffb0', '#ffd166', '#c084fc', '#ff9d5c'];
    var NAMES = ['YOU', 'NOVA', 'MILO', 'RHEA', 'KAI'];
    var SPAWNS = [
        { x: 500, y: 505 },
        { x: 235, y: 300 },
        { x: 765, y: 300 },
        { x: 320, y: 130 },
        { x: 680, y: 130 }
    ];
    var OBSTACLES = [
        { x: 290, y: 245, w: 150, h: 34 },
        { x: 610, y: 225, w: 34, h: 145 },
        { x: 430, y: 372, w: 140, h: 34 }
    ];

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    function makePlayer(name, x, y, isPlayer, color) {
        return {
            name: name, x: x, y: y, r: 15,
            vx: 0, vy: 0, aim: -Math.PI / 2,
            sleep: 0, energy: 1, isPlayer: !!isPlayer, color: color,
            down: false, downTimer: 0, downMax: 2.4, invuln: 1.2,
            cooldown: 0.4, hitTimer: 0, eliminated: false,
            aiTimer: Math.random() * 0.4, strafe: Math.random() < 0.5 ? 1 : -1,
            moveAngle: Math.random() * Math.PI * 2
        };
    }

    function startMatch(mode) {
        T.multiplayer = mode === 'mp';
        if (T.multiplayer) {
            T.players = [makePlayer('YOU', SPAWNS[0].x, SPAWNS[0].y, true, '#5fe7ff')];
            T.players[0].energy = 2;
        } else {
            T.players = NAMES.map(function (name, i) {
                return makePlayer(name, SPAWNS[i].x, SPAWNS[i].y, i === 0, COLORS[i]);
            });
            T.players[0].energy = 1;
        }
        T.darts = [];
        T.particles = [];
        T.feed = [];
        T.t = 0;
        T.phase = T.multiplayer ? 'waiting' : 'countdown';
        T.countdown = 3;
        T.final = false;
        T.over = false;
        T.winner = false;
        T.score = 0;
        T.downs = 0;
        T.elims = 0;
        T.coins = 0;
        overlayShown = false;
        keys = {};
        var ov = document.getElementById('tqOverlay');
        if (ov) ov.style.display = 'none';
        var banner = document.getElementById('tqBanner');
        if (banner) banner.style.display = 'none';
        var menu = document.getElementById('tqMenu');
        if (T.multiplayer) {
            if (menu) {
                menu.style.display = 'flex';
                menu.classList.add('is-waiting');
                var title = document.getElementById('tqMenuTitle');
                if (title) title.textContent = 'Waiting for players';
                var status = document.getElementById('tqMenuStatus');
                if (status) status.textContent = '1/8 in the lobby · match starts at 2';
            }
            addFeed('Public lobby · waiting for a rival');
        } else {
            if (menu) menu.style.display = 'none';
            addFeed('Tranq Arena · stay awake');
        }
        updateHud(true);
    }

    function showMenu() {
        T.phase = 'menu';
        T.players = [];
        T.darts = [];
        T.particles = [];
        T.feed = [];
        T.final = false;
        T.over = false;
        T.winner = false;
        T.score = 0;
        T.downs = 0;
        T.elims = 0;
        T.coins = 0;
        T.multiplayer = false;
        var menu = document.getElementById('tqMenu');
        if (menu) {
            menu.style.display = 'flex';
            menu.classList.remove('is-waiting');
            var title = document.getElementById('tqMenuTitle');
            if (title) title.textContent = 'Last two awake';
            var status = document.getElementById('tqMenuStatus');
            if (status) status.textContent = '5-player arena · one revive per energy';
        }
        var ov = document.getElementById('tqOverlay');
        if (ov) ov.style.display = 'none';
        var banner = document.getElementById('tqBanner');
        if (banner) banner.style.display = 'none';
        updateHud(true);
    }

    function startSolo() {
        var menu = document.getElementById('tqMenu');
        if (menu) menu.style.display = 'none';
        startMatch('solo');
        running = true;
        lastFrame = 0;
    }

    function startMultiplayer() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            toast('Multiplayer is unavailable right now.');
            startSolo();
            return;
        }
        var menu = document.getElementById('tqMenu');
        if (menu) {
            menu.style.display = 'flex';
            menu.classList.add('is-waiting');
            var title = document.getElementById('tqMenuTitle');
            if (title) title.textContent = 'Connecting…';
            var status = document.getElementById('tqMenuStatus');
            if (status) status.textContent = 'Joining the public lobby';
        }
        startMatch('mp');
        mpConnect();
        running = true;
        lastFrame = 0;
    }

    function mpConnect() {
        mpCleanup();
        mp.id = 'tq-' + Math.random().toString(36).slice(2, 10);
        mp.name = (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'user' && currentUser.username)
            ? String(currentUser.username).slice(0, 16)
            : 'Dart-' + Math.random().toString(36).slice(2, 5);
        mp.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        try {
            var channel = supabaseClient.channel('lessfun-tranq-public', {
                config: { presence: { key: mp.id } }
            });
            channel.on('presence', { event: 'sync' }, function () {
                var state = channel.presenceState() || {};
                var ids = Object.keys(state);
                mp.count = ids.length;
                // Drop remotes that left the lobby.
                T.players = T.players.filter(function (p) {
                    return p.isPlayer || !p.mpId || ids.indexOf(p.mpId) >= 0;
                });
                updateMpMenu();
                if (T.phase === 'waiting' && ids.length >= 2) {
                    if (!mp.startTimer) {
                        mp.startTimer = setTimeout(function () {
                            mp.startTimer = 0;
                            startMpCountdown();
                        }, 700);
                    }
                } else if (mp.startTimer) {
                    clearTimeout(mp.startTimer);
                    mp.startTimer = 0;
                }
                if (T.phase === 'fight') checkMpAlive();
            });
            channel.on('broadcast', { event: 'tq-state' }, function (msg) {
                mpReceiveState(msg.payload || {});
            });
            channel.on('broadcast', { event: 'tq-shot' }, function (msg) {
                mpReceiveShot(msg.payload || {});
            });
            channel.on('broadcast', { event: 'tq-hit' }, function (msg) {
                mpReceiveHit(msg.payload || {});
            });
            channel.subscribe(function (status) {
                if (status === 'SUBSCRIBED') {
                    mp.ready = true;
                    channel.track({ name: mp.name, color: mp.color });
                }
            });
            mp.channel = channel;
        } catch (e) {
            toast('Could not join the public lobby.');
        }
        clearInterval(mp.timer);
        mp.timer = setInterval(mpSendState, 100);
    }

    function mpCleanup() {
        clearInterval(mp.timer);
        mp.timer = 0;
        if (mp.startTimer) { clearTimeout(mp.startTimer); mp.startTimer = 0; }
        if (mp.channel && typeof supabaseClient !== 'undefined' && supabaseClient) {
            try { mp.channel.untrack(); } catch (e) {}
            try { supabaseClient.removeChannel(mp.channel); } catch (e) {}
        }
        mp.channel = null;
        mp.ready = false;
        mp.count = 0;
        mp.startCount = 0;
        mp.started = false;
    }

    function updateMpMenu() {
        if (!T.multiplayer || T.phase !== 'waiting') return;
        var title = document.getElementById('tqMenuTitle');
        var status = document.getElementById('tqMenuStatus');
        if (title) title.textContent = mp.count >= 2 ? 'Starting match' : 'Waiting for players';
        if (status) {
            status.textContent = mp.count + '/8 in the lobby' + (mp.count >= 2 ? ' · get ready' : ' · match starts at 2');
        }
    }

    function startMpCountdown() {
        if (!T.multiplayer || T.phase !== 'waiting') return;
        mp.started = true;
        mp.startCount = Math.max(mp.count, activePlayers().length);
        T.phase = 'countdown';
        T.countdown = 3;
        var menu = document.getElementById('tqMenu');
        if (menu) menu.style.display = 'none';
        addFeed('Match found · darts live in 3');
        toast('Match found');
        beep(660, 0.12, 0.04, 880);
    }

    function mpSendState() {
        if (!T.multiplayer || !mp.channel || !mp.ready || !T.players[0]) return;
        var p = T.players[0];
        try {
            var sent = mp.channel.send({
                type: 'broadcast', event: 'tq-state',
                payload: {
                    id: mp.id, name: mp.name, color: mp.color,
                    x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
                    aim: Math.round(p.aim * 1000) / 1000,
                    sleep: Math.round(p.sleep), down: p.down, downTimer: p.downTimer,
                    energy: p.energy, eliminated: p.eliminated, invuln: p.invuln,
                    phase: T.phase
                }
            });
            if (sent && sent.catch) sent.catch(function () {});
        } catch (e) {}
    }

    function mpBroadcastShot(owner) {
        if (!T.multiplayer || !mp.channel || !mp.ready) return;
        try {
            var sent = mp.channel.send({
                type: 'broadcast', event: 'tq-shot',
                payload: { id: mp.id, x: owner.x, y: owner.y, aim: owner.aim, color: owner.color }
            });
            if (sent && sent.catch) sent.catch(function () {});
        } catch (e) {}
    }

    function mpRemote(id) {
        for (var i = 0; i < T.players.length; i++) {
            if (T.players[i].mpId === id) return T.players[i];
        }
        return null;
    }

    function mpReceiveState(payload) {
        if (!payload || !payload.id || payload.id === mp.id || !T.multiplayer) return;
        var p = mpRemote(payload.id);
        if (!p) {
            p = makePlayer(payload.name || 'Player', payload.x || 500, payload.y || 260, false, payload.color || '#ff6f91');
            p.mpId = payload.id;
            p.remote = true;
            p.tx = payload.x; p.ty = payload.y; p.taim = payload.aim || 0;
            T.players.push(p);
            addFeed(p.name + ' joined');
        }
        p.tx = payload.x; p.ty = payload.y; p.taim = payload.aim || 0;
        p.sleep = Number(payload.sleep) || 0;
        p.down = !!payload.down;
        p.downTimer = Number(payload.downTimer) || 0;
        p.energy = Number(payload.energy) || 0;
        p.eliminated = !!payload.eliminated;
        p.invuln = Number(payload.invuln) || 0;
        if (T.phase === 'fight') checkMpAlive();
    }

    function mpReceiveShot(payload) {
        if (!T.multiplayer || !payload || !payload.id || payload.id === mp.id) return;
        var owner = mpRemote(payload.id);
        var color = payload.color || (owner ? owner.color : '#ff6f91');
        var sx = Number(payload.x) || (owner ? owner.x : 500);
        var sy = Number(payload.y) || (owner ? owner.y : 260);
        var aim = Number(payload.aim) || 0;
        T.darts.push({
            x: sx + Math.cos(aim) * 18, y: sy + Math.sin(aim) * 18,
            px: sx, py: sy,
            vx: Math.cos(aim) * 660, vy: Math.sin(aim) * 660,
            life: 1.45, owner: null, ghost: true, color: color
        });
        spawnBurst(sx, sy, color, 3, 35);
    }

    function mpReceiveHit(payload) {
        if (!T.multiplayer || !payload || payload.target !== mp.id) return;
        var p = player();
        if (!p || p.down || p.eliminated || p.invuln > 0) return;
        var damage = Number(payload.damage) || 34;
        p.sleep = Math.min(100, p.sleep + damage);
        p.hitTimer = 1.2;
        spawnBurst(p.x, p.y, payload.color || '#ff6f91', 12, 130);
        if (p.sleep >= 100) downPlayer(p, mpRemote(payload.owner));
        mpSendState();
    }

    function checkMpAlive() {
        if (!T.multiplayer || T.phase !== 'fight' || T.over) return;
        var alive = activePlayers();
        var p = player();
        if (p.eliminated) { endMatch(false); return; }
        if (alive.length <= 1) { endMatch(true); return; }
        if (alive.length === 2 && mp.startCount > 2 && !T.final) startFinal();
    }

    function player() { return T.players[0]; }

    function isTranqOwner() {
        if (typeof isOwner === 'function') return isOwner();
        return !!(typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'user' &&
            String(currentUser.username || '').toLowerCase() === 'totallymason');
    }

    function nearestEnemy(p) {
        if (!p) return null;
        var target = null, best = 1e9;
        for (var i = 0; i < T.players.length; i++) {
            var q = T.players[i];
            if (q === p || q.down || q.eliminated) continue;
            var d = dist(p.x, p.y, q.x, q.y);
            if (d < best) { best = d; target = q; }
        }
        return target;
    }
    function activePlayers() {
        return T.players.filter(function (p) { return !p.eliminated; });
    }
    function awakePlayers() {
        return T.players.filter(function (p) { return !p.eliminated && !p.down; });
    }

    function addFeed(text) {
        T.feed.unshift(text);
        if (T.feed.length > 4) T.feed.pop();
        var el = document.getElementById('tqFeed');
        if (el) el.innerHTML = T.feed.map(function (item) { return '<p>' + item + '</p>'; }).join('');
    }

    function toast(text) {
        var el = document.getElementById('tqToast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('is-visible');
        clearTimeout(el._timer);
        el._timer = setTimeout(function () { el.classList.remove('is-visible'); }, 1500);
    }

    function beep(freq, duration, volume, endFreq) {
        if (typeof soundSetting !== 'undefined' && !soundSetting) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            var t0 = audioCtx.currentTime;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t0);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(volume || 0.03, t0 + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(t0); osc.stop(t0 + duration + 0.02);
        } catch (e) {}
    }

    function spawnBurst(x, y, color, count, speed) {
        for (var i = 0; i < count; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = (0.4 + Math.random()) * (speed || 90);
            T.particles.push({
                x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0, max: 0.35 + Math.random() * 0.5,
                size: 1.5 + Math.random() * 3, color: color
            });
        }
    }

    function insideRect(x, y, r, pad) {
        return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
    }

    function resolveObstacles(p) {
        for (var i = 0; i < OBSTACLES.length; i++) {
            var o = OBSTACLES[i];
            var cx = clamp(p.x, o.x, o.x + o.w);
            var cy = clamp(p.y, o.y, o.y + o.h);
            var dx = p.x - cx, dy = p.y - cy;
            var d2 = dx * dx + dy * dy;
            if (d2 < p.r * p.r) {
                var d = Math.sqrt(d2) || 0.01;
                var push = p.r - d;
                p.x += (dx / d) * push;
                p.y += (dy / d) * push;
            }
        }
        p.x = clamp(p.x, 45 + p.r, WORLD_W - 45 - p.r);
        p.y = clamp(p.y, 70 + p.r, WORLD_H - 55 - p.r);
    }

    function segmentHitsRect(x1, y1, x2, y2, o) {
        var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        if (maxX < o.x || minX > o.x + o.w || maxY < o.y || minY > o.y + o.h) return false;
        return true;
    }

    function distToSegment(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1, dy = y2 - y1;
        var len = dx * dx + dy * dy;
        if (!len) return dist(px, py, x1, y1);
        var t = clamp(((px - x1) * dx + (py - y1) * dy) / len, 0, 1);
        return dist(px, py, x1 + t * dx, y1 + t * dy);
    }

    function shoot(owner) {
        if (owner.down || owner.eliminated || owner.cooldown > 0 || T.phase !== 'fight') return;
        var spread = owner.isPlayer ? 0.012 : 0.065;
        var a = owner.aim + (Math.random() - 0.5) * spread;
        var sx = owner.x + Math.cos(a) * 18;
        var sy = owner.y + Math.sin(a) * 18;
        var ownerHoming = owner.isPlayer && isTranqOwner() && owner.lockTarget &&
            !owner.lockTarget.down && !owner.lockTarget.eliminated;
        var dartSpeed = ownerHoming ? 950 : (owner.isPlayer ? 780 : 660);
        T.darts.push({
            x: sx, y: sy, px: sx, py: sy,
            vx: Math.cos(a) * dartSpeed,
            vy: Math.sin(a) * dartSpeed,
            life: 1.45, owner: owner, color: owner.color,
            homing: ownerHoming, target: ownerHoming ? owner.lockTarget : null
        });
        owner.cooldown = owner.isPlayer ? (isTranqOwner() ? 0.12 : 0.36) : (0.85 + Math.random() * 0.5);
        spawnBurst(sx, sy, owner.color, 4, 40);
        beep(owner.isPlayer ? 780 : 520, 0.045, 0.018, 320);
        if (owner.isPlayer) mpBroadcastShot(owner);
    }

    function hitPlayer(target, dart) {
        if (target.down || target.eliminated || target.invuln > 0) return;
        var damage = T.final ? 58 : 34;
        target.sleep = Math.min(100, target.sleep + damage);
        target.hitTimer = 1.2;
        spawnBurst(target.x, target.y, dart.color || '#c084fc', 10, 120);
        if (target.sleep >= 100) {
            downPlayer(target, dart.owner);
        }
    }

    function downPlayer(target, shooter) {
        if (target.down || target.eliminated) return;
        target.sleep = 0;
        target.down = true;
        target.downTimer = target.downMax;
        target.invuln = 0;
        spawnBurst(target.x, target.y, '#c084fc', 18, 150);
        beep(180, 0.25, 0.045, 80);
        var shooterName = shooter ? shooter.name : 'Someone';
        if (shooter && shooter.isPlayer) {
            T.downs++;
            T.score += 120;
        }
        addFeed(shooterName + ' put ' + target.name + ' to sleep');

        if (T.final) {
            eliminate(target, target.name + ' was knocked out in the final');
            return;
        }
        if (target.energy > 0) {
            target.energy--;
            toast(target.name + ' spent 1 energy');
            mpSendState();
        } else {
            eliminate(target, target.name + ' ran out of energy');
        }
    }

    function eliminate(target, reason) {
        if (target.eliminated) return;
        target.eliminated = true;
        target.down = true;
        target.downTimer = 0;
        addFeed(reason);
        mpSendState();
        spawnBurst(target.x, target.y, '#ff5d7a', 24, 190);
        beep(110, 0.35, 0.05, 55);
        if (target.isPlayer) {
            endMatch(false);
            return;
        }
        var alive = activePlayers();
        if (alive.length <= 1) {
            if (!player().eliminated) endMatch(true);
            return;
        }
        if (alive.length === 2 && !T.final) startFinal();
    }

    function startFinal() {
        T.final = true;
        var banner = document.getElementById('tqBanner');
        if (banner) {
            banner.style.display = 'flex';
            banner.textContent = 'FINAL TWO · SUDDEN DEATH · NO REVIVES';
        }
        addFeed('FINAL TWO · no revives');
        toast('Final two · no revives');
        beep(660, 0.18, 0.05, 990);
    }

    function revivePlayer(p) {
        p.down = false;
        p.sleep = 0;
        p.invuln = 1.4;
        p.downTimer = 0;
        spawnBurst(p.x, p.y, '#7dffb0', 20, 130);
        addFeed(p.name + ' revived');
        if (p.isPlayer) toast('Revived · stay awake');
        beep(520, 0.14, 0.04, 820);
        mpSendState();
    }

    function updatePlayerInput(dt) {
        var p = player();
        if (p.down || p.eliminated) {
            p.vx = 0; p.vy = 0;
            return;
        }
        var mx = 0, my = 0;
        if (keys.w || keys.arrowup) my -= 1;
        if (keys.s || keys.arrowdown) my += 1;
        if (keys.a || keys.arrowleft) mx -= 1;
        if (keys.d || keys.arrowright) mx += 1;
        if (T.touchMove) {
            mx += T.touchMove.x;
            my += T.touchMove.y;
        }
        var len = Math.sqrt(mx * mx + my * my);
        if (len > 1) { mx /= len; my /= len; }
        var speed = 220;
        p.vx = mx * speed;
        p.vy = my * speed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        resolveObstacles(p);

        if (isTranqOwner()) {
            var lock = nearestEnemy(p);
            p.lockTarget = lock;
            if (lock) {
                var lockAim = Math.atan2(lock.y - p.y, lock.x - p.x);
                var lockDiff = ((lockAim - p.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                p.aim += lockDiff * Math.min(1, dt * 26);
            }
            if (T.phase === 'fight') shoot(p);
            return;
        }
        if (!T.mouse || T.mouse.x == null) return;
        var aim = Math.atan2(T.mouse.y - p.y, T.mouse.x - p.x);
        var diff = ((aim - p.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.aim += diff * Math.min(1, dt * 18);
        if (keys[' '] || T.mouseDown) shoot(p);
    }

    function updateBot(p, dt) {
        if (p.down || p.eliminated) return;
        p.aiTimer -= dt;
        var target = null, best = 1e9;
        for (var i = 0; i < T.players.length; i++) {
            var q = T.players[i];
            if (q === p || q.down || q.eliminated) continue;
            var d = dist(p.x, p.y, q.x, q.y);
            if (d < best) { best = d; target = q; }
        }
        if (!target) return;
        if (p.aiTimer <= 0) {
            p.aiTimer = 0.5 + Math.random() * 0.7;
            p.strafe = Math.random() < 0.5 ? 1 : -1;
            p.moveAngle = Math.random() * Math.PI * 2;
        }
        var desiredX = 0, desiredY = 0;
        var toX = target.x - p.x, toY = target.y - p.y;
        var td = Math.max(1, Math.sqrt(toX * toX + toY * toY));
        if (best > 280) {
            desiredX = toX / td;
            desiredY = toY / td;
        } else if (best < 170) {
            desiredX = -toX / td;
            desiredY = -toY / td;
        } else {
            desiredX = -toY / td * p.strafe;
            desiredY = toX / td * p.strafe;
        }
        for (var o = 0; o < OBSTACLES.length; o++) {
            var ob = OBSTACLES[o];
            if (insideRect(p.x + desiredX * 40, p.y + desiredY * 40, ob, 18)) {
                desiredX += p.strafe * 0.8;
                desiredY -= p.strafe * 0.8;
            }
        }
        var dl = Math.sqrt(desiredX * desiredX + desiredY * desiredY) || 1;
        var speed = 150;
        p.x += (desiredX / dl) * speed * dt;
        p.y += (desiredY / dl) * speed * dt;
        resolveObstacles(p);

        var aim = Math.atan2(target.y - p.y, target.x - p.x);
        var diff = ((aim - p.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.aim += diff * Math.min(1, dt * 9);
        if (!isTranqOwner() && p.cooldown <= 0 && best < 520) {
            p.cooldown = 0.5 + Math.random() * 0.5;
            shoot(p);
        }
    }

    function updateDarts(dt) {
        for (var i = T.darts.length - 1; i >= 0; i--) {
            var d = T.darts[i];
            if (d.homing && d.target && !d.target.down && !d.target.eliminated) {
                var want = Math.atan2(d.target.y - d.y, d.target.x - d.x);
                var has = Math.atan2(d.vy, d.vx);
                var turn = ((want - has + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                var next = has + clamp(turn, -12 * dt, 12 * dt);
                var hs = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
                d.vx = Math.cos(next) * hs;
                d.vy = Math.sin(next) * hs;
            }
            d.px = d.x; d.py = d.y;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.life -= dt;
            var dead = d.life <= 0 || d.x < 30 || d.x > WORLD_W - 30 || d.y < 50 || d.y > WORLD_H - 30;
            if (!d.ghost && !d.homing) {
                for (var o = 0; o < OBSTACLES.length; o++) {
                    if (insideRect(d.x, d.y, OBSTACLES[o], 2) || segmentHitsRect(d.px, d.py, d.x, d.y, OBSTACLES[o])) {
                        dead = true;
                    }
                }
            }
            if (!dead && !d.ghost) {
                for (var j = 0; j < T.players.length; j++) {
                    var p = T.players[j];
                    if (p === d.owner || p.down || p.eliminated || p.invuln > 0) continue;
                    if (distToSegment(p.x, p.y, d.px, d.py, d.x, d.y) < p.r + 3) {
                        if (p.remote && d.owner === player() && mp.channel && mp.ready) {
                            try {
                                var sent = mp.channel.send({
                                    type: 'broadcast', event: 'tq-hit',
                                    payload: {
                                        target: p.mpId, owner: mp.id,
                                        damage: T.final ? 58 : 34,
                                        color: player().color
                                    }
                                });
                                if (sent && sent.catch) sent.catch(function () {});
                            } catch (e) {}
                            spawnBurst(p.x, p.y, d.color, 10, 120);
                        } else if (!p.remote) {
                            hitPlayer(p, d);
                        }
                        dead = true;
                        break;
                    }
                }
            }
            if (dead) {
                if (Math.random() < 0.7) spawnBurst(d.x, d.y, d.color, 3, 40);
                T.darts.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (var i = T.particles.length - 1; i >= 0; i--) {
            var p = T.particles[i];
            p.life += dt;
            if (p.life >= p.max) { T.particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= (1 - dt * 2.5);
            p.vy *= (1 - dt * 2.5);
        }
    }

    function update(dt) {
        T.t += dt;
        if (T.phase === 'countdown') {
            T.countdown -= dt;
            if (T.countdown <= 0) {
                T.phase = 'fight';
                if (T.multiplayer) {
                    mp.startCount = Math.max(mp.startCount, mp.count, activePlayers().length);
                    checkMpAlive();
                }
                addFeed('Go · darts live');
                beep(660, 0.12, 0.04, 880);
            }
            updateParticles(dt);
            return;
        }
        if (T.phase !== 'fight' || T.over) {
            updateParticles(dt);
            return;
        }
        var p = player();
        updatePlayerInput(dt);
        if (!T.multiplayer) {
            for (var i = 1; i < T.players.length; i++) updateBot(T.players[i], dt);
        }
        updateDarts(dt);
        for (var j = 0; j < T.players.length; j++) {
            var q = T.players[j];
            if (q.remote) {
                q.x += ((q.tx == null ? q.x : q.tx) - q.x) * Math.min(1, dt * 12);
                q.y += ((q.ty == null ? q.y : q.ty) - q.y) * Math.min(1, dt * 12);
                var aimDiff = (((q.taim || 0) - q.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                q.aim += aimDiff * Math.min(1, dt * 14);
            }
            q.cooldown = Math.max(0, q.cooldown - dt);
            q.invuln = Math.max(0, q.invuln - dt);
            q.hitTimer = Math.max(0, q.hitTimer - dt);
            if (!q.down && !q.eliminated && q.hitTimer <= 0) q.sleep = Math.max(0, q.sleep - dt * 5);
            if (q.down && !q.eliminated) {
                q.downTimer -= dt;
                if (q.downTimer <= 0) revivePlayer(q);
            }
        }
        updateParticles(dt);
        hudTimer -= dt;
        if (hudTimer <= 0) { hudTimer = 0.08; updateHud(false); }
    }

    function endMatch(win) {
        if (T.over) return;
        T.over = true;
        T.phase = 'over';
        T.winner = !!win;
        var bonus = win ? 1000 : 0;
        T.score = T.downs * 120 + (T.downs ? 0 : 0) + bonus + T.elims * 250;
        T.score += Math.max(0, Math.round(T.t * 2));
        T.coins = Math.max(5, Math.round(T.score / 55));
        if (typeof saveScore === 'function') saveScore('Tranq Arena', T.score);
        if (typeof awardRunCoins === 'function') awardRunCoins(T.coins);
        var title = document.getElementById('tqOverTitle');
        var kicker = document.getElementById('tqOverKicker');
        var text = document.getElementById('tqOverText');
        var stats = document.getElementById('tqOverStats');
        var coins = document.getElementById('tqOverCoins');
        var remoteWinner = null;
        for (var wi = 0; wi < T.players.length; wi++) {
            if (!T.players[wi].isPlayer && !T.players[wi].eliminated) remoteWinner = T.players[wi];
        }
        if (kicker) kicker.textContent = win ? 'VICTORY' : 'ELIMINATED';
        if (title) title.textContent = win ? 'Last one awake' : (T.multiplayer && remoteWinner ? remoteWinner.name + ' wins' : 'You got tranquilized');
        if (text) text.textContent = win
            ? 'You outlasted the arena and won the final duel.'
            : (T.multiplayer && remoteWinner
                ? remoteWinner.name + ' was the last one awake. Jump back in for another round.'
                : (T.final ? 'The final duel went the other way.' : 'You ran out of energy. The arena keeps going without you.'));
        if (stats) {
            stats.innerHTML =
                '<div><small>DOWNS</small><strong>' + T.downs + '</strong></div>' +
                '<div><small>TIME</small><strong>' + Math.round(T.t) + 's</strong></div>' +
                '<div><small>FINAL TWO</small><strong>' + (T.final ? 'YES' : 'NO') + '</strong></div>';
        }
        if (coins) coins.innerHTML = '<span>' + T.score.toLocaleString() + ' points</span><span>+' + T.coins + ' Coins</span>';
        var ov = document.getElementById('tqOverlay');
        if (ov) { ov.style.display = 'flex'; overlayShown = true; }
        beep(win ? 880 : 160, 0.35, 0.05, win ? 1320 : 70);
    }

    /* ------------------------- rendering ------------------------- */

    function resize() {
        if (!canvas || !stage) return;
        var rect = stage.getBoundingClientRect();
        W = Math.max(320, rect.width || 900);
        H = Math.max(300, rect.height || 600);
        DPR = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        scale = Math.min(W / WORLD_W, H / WORLD_H);
        ox = (W - WORLD_W * scale) / 2;
        oy = (H - WORLD_H * scale) / 2;
    }

    function drawRoundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function draw() {
        if (!ctx) return;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#070d16');
        bg.addColorStop(0.55, '#0a1420');
        bg.addColorStop(1, '#05080e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Arena floor.
        var floor = ctx.createLinearGradient(0, 60, 0, WORLD_H);
        floor.addColorStop(0, '#0c2033');
        floor.addColorStop(0.6, '#0a1a28');
        floor.addColorStop(1, '#07121c');
        ctx.fillStyle = floor;
        drawRoundRect(32, 58, WORLD_W - 64, WORLD_H - 92, 28);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.22)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Grid.
        ctx.strokeStyle = 'rgba(120, 210, 255, 0.055)';
        ctx.lineWidth = 1;
        for (var x = 80; x < WORLD_W - 40; x += 64) {
            ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, WORLD_H - 40); ctx.stroke();
        }
        for (var y = 100; y < WORLD_H - 40; y += 64) {
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(WORLD_W - 40, y); ctx.stroke();
        }

        // Glow ring.
        var rg = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 70, WORLD_W / 2, WORLD_H / 2, 430);
        rg.addColorStop(0, 'rgba(95, 231, 255, 0.06)');
        rg.addColorStop(1, 'rgba(95, 231, 255, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(20, 50, WORLD_W - 40, WORLD_H - 60);

        // Obstacles.
        for (var i = 0; i < OBSTACLES.length; i++) {
            var o = OBSTACLES[i];
            ctx.fillStyle = '#132332';
            drawRoundRect(o.x, o.y, o.w, o.h, 10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(140, 210, 255, 0.24)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(120, 210, 255, 0.14)';
            drawRoundRect(o.x + 8, o.y + 8, Math.max(6, o.w - 16), Math.max(4, o.h - 16), 6);
            ctx.fill();
        }

        // Particles behind players.
        drawParticles(0.5);

        // Darts.
        for (var d = 0; d < T.darts.length; d++) {
            var dart = T.darts[d];
            var ang = Math.atan2(dart.vy, dart.vx);
            ctx.save();
            ctx.translate(dart.x, dart.y);
            ctx.rotate(ang);
            ctx.fillStyle = dart.color;
            ctx.shadowColor = dart.color;
            ctx.shadowBlur = 10;
            ctx.fillRect(-9, -1.8, 14, 3.6);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(4, -1.4, 4, 2.8);
            ctx.restore();
        }
        ctx.shadowBlur = 0;

        // Players.
        for (var p = 0; p < T.players.length; p++) drawPlayer(T.players[p], p);

        drawParticles(1);

        // Countdown.
        if (T.phase === 'countdown') {
            ctx.restore();
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.fillStyle = 'rgba(3, 8, 14, 0.35)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#eafaff';
            ctx.textAlign = 'center';
            ctx.font = '900 ' + Math.round(W * 0.16) + 'px -apple-system, system-ui, sans-serif';
            ctx.fillText(String(Math.ceil(T.countdown)), W / 2, H / 2 + W * 0.05);
            ctx.font = '800 12px -apple-system, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(160, 230, 255, 0.7)';
            ctx.fillText('STAY AWAKE', W / 2, H / 2 - W * 0.09);
            ctx.textAlign = 'left';
            return;
        }
        ctx.restore();
    }

    function drawPlayer(p, index) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.down && !p.eliminated) ctx.rotate(Math.PI / 2);
        if (p.eliminated) ctx.globalAlpha = 0.22;

        // Shadow / downed aura.
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 12, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Invulnerability ring.
        if (p.invuln > 0 && !p.down && !p.eliminated) {
            ctx.strokeStyle = 'rgba(125, 255, 176, ' + (0.35 + p.invuln * 0.2) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, p.r + 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Body.
        ctx.rotate(p.aim + Math.PI / 2);
        var body = ctx.createLinearGradient(-14, -14, 14, 16);
        body.addColorStop(0, p.color);
        body.addColorStop(1, 'rgba(15, 30, 40, 0.95)');
        ctx.fillStyle = body;
        drawRoundRect(-12, -13, 24, 28, 10);
        ctx.fill();
        ctx.strokeStyle = p.isPlayer ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = p.isPlayer ? 2 : 1.2;
        ctx.stroke();

        // Head.
        ctx.fillStyle = '#e9f4fa';
        ctx.beginPath();
        ctx.arc(0, -7, 7.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#12212b';
        ctx.beginPath();
        ctx.arc(-2.2, -8.5, 1.2, 0, Math.PI * 2);
        ctx.arc(2.2, -8.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Tranq dart gun.
        ctx.fillStyle = '#89a3b6';
        ctx.fillRect(7, -3, 15, 4.5);
        ctx.fillStyle = p.color;
        ctx.fillRect(19, -3, 4, 4.5);
        ctx.restore();

        // Sleep ring.
        if (!p.eliminated) {
            var ratio = clamp(p.sleep / 100, 0, 1);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 31, 10, Math.PI * 2 * 0.75, Math.PI * 2 * 1.25);
            ctx.stroke();
            if (ratio > 0) {
                ctx.strokeStyle = ratio > 0.7 ? '#ff8a8a' : '#c084fc';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(p.x, p.y - 31, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
                ctx.stroke();
            }
        }

        // Name and energy.
        ctx.textAlign = 'center';
        ctx.font = '800 9px -apple-system, system-ui, sans-serif';
        ctx.fillStyle = p.eliminated ? 'rgba(255,255,255,0.2)' : (p.isPlayer ? '#bff4ff' : 'rgba(220,240,250,0.55)');
        ctx.fillText(p.isPlayer ? 'YOU' : p.name, p.x, p.y - 45);
        if (!p.eliminated) {
            var pipY = p.y - 39;
            for (var e = 0; e < 1; e++) {
                ctx.fillStyle = p.energy > e ? '#7dffb0' : 'rgba(255,255,255,0.12)';
                ctx.fillRect(p.x - 3 + e * 7, pipY, 5, 2.5);
            }
        }

        // Revive countdown / Zzz.
        if (p.down && !p.eliminated) {
            ctx.textAlign = 'center';
            ctx.font = '900 12px -apple-system, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(200, 170, 255, 0.8)';
            ctx.fillText('Z z z', p.x, p.y - 20);
            if (p.downTimer > 0) {
                ctx.strokeStyle = 'rgba(125, 255, 176, 0.7)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.downTimer / p.downMax));
                ctx.stroke();
            }
        }
        ctx.textAlign = 'left';
    }

    function drawParticles(layer) {
        for (var i = 0; i < T.particles.length; i++) {
            var p = T.particles[i];
            if ((layer < 1) !== (p.life < p.max * 0.5)) continue;
            var f = 1 - p.life / p.max;
            ctx.globalAlpha = Math.max(0, f);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.6 + f * 0.8), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function updateHud(force) {
        var p = player();
        if (!p) {
            setText('tqAlive', '0 LEFT');
            setText('tqScore', '0');
            setText('tqStatus', 'CHOOSE A MODE');
            return;
        }
        var alive = activePlayers().length;
        setText('tqAlive', alive + ' LEFT');
        setText('tqScore', T.score.toLocaleString());
        setText('tqDowns', String(T.downs));
        var energy = document.getElementById('tqEnergy');
        if (energy) {
            energy.innerHTML = '';
            for (var i = 0; i < 1; i++) {
                var pip = document.createElement('i');
                pip.className = p.energy > i ? 'is-on' : '';
                energy.appendChild(pip);
            }
        }
        var sleep = document.getElementById('tqSleep');
        if (sleep) sleep.style.width = clamp(p.sleep, 0, 100) + '%';
        var status = document.getElementById('tqStatus');
        if (status) {
            if (T.phase === 'countdown') status.textContent = 'GET READY';
            else if (T.over) status.textContent = T.winner ? 'VICTORY' : 'ELIMINATED';
            else if (p.eliminated) status.textContent = 'ELIMINATED';
            else if (p.down) status.textContent = 'PASSED OUT · REVIVING';
            else if (T.final) status.textContent = 'FINAL DUEL · NO REVIVES';
            else if (isTranqOwner()) status.textContent = 'AUTO LOCK · 500 RPM';
            else if (p.sleep > 70) status.textContent = 'DROWSY · SHAKE IT OFF';
            else status.textContent = 'STAY AWAKE';
        }
        var banner = document.getElementById('tqBanner');
        if (banner) {
            if (T.final && !T.over) { banner.style.display = 'flex'; banner.textContent = 'FINAL TWO · SUDDEN DEATH'; }
            else if (!T.final) banner.style.display = 'none';
        }
        var count = document.getElementById('tqCount');
        if (count) {
            if (T.phase === 'countdown') { count.style.display = 'flex'; count.textContent = String(Math.ceil(T.countdown)); }
            else count.style.display = 'none';
        }
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /* ------------------------- input ------------------------- */

    function isGame() { return typeof currentGameId !== 'undefined' && currentGameId === 14; }

    function keyDown(e) {
        if (!isGame()) return;
        var k = String(e.key || '').toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].indexOf(k) >= 0) e.preventDefault();
        keys[k] = true;
        if (k === 'r') restart();
    }
    function keyUp(e) {
        if (!isGame()) return;
        keys[String(e.key || '').toLowerCase()] = false;
    }
    function bindInput() {
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
        if (canvas) {
            canvas.addEventListener('pointermove', pointerMove);
            canvas.addEventListener('pointerdown', pointerDown);
            canvas.addEventListener('pointerup', pointerUp);
            canvas.addEventListener('pointercancel', pointerUp);
            canvas.addEventListener('pointerleave', pointerUp);
        }
    }
    function unbindInput() {
        document.removeEventListener('keydown', keyDown);
        document.removeEventListener('keyup', keyUp);
        if (canvas) {
            canvas.removeEventListener('pointermove', pointerMove);
            canvas.removeEventListener('pointerdown', pointerDown);
            canvas.removeEventListener('pointerup', pointerUp);
            canvas.removeEventListener('pointercancel', pointerUp);
            canvas.removeEventListener('pointerleave', pointerUp);
        }
    }

    function canvasPoint(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - ox) / scale,
            y: (e.clientY - rect.top - oy) / scale,
            cx: e.clientX - rect.left,
            cy: e.clientY - rect.top
        };
    }

    function pointerMove(e) {
        if (!canvas) return;
        var pt = canvasPoint(e);
        if (e.pointerType !== 'touch') {
            T.mouse = { x: pt.x, y: pt.y };
            return;
        }
        if (T.touchId === e.pointerId && T.touchOrigin) {
            var dx = pt.cx - T.touchOrigin.x;
            var dy = pt.cy - T.touchOrigin.y;
            var len = Math.sqrt(dx * dx + dy * dy);
            var max = 52;
            if (len > max) { dx = dx / len * max; dy = dy / len * max; len = max; }
            T.touchMove = { x: dx / max, y: dy / max };
        }
    }

    function pointerDown(e) {
        if (!canvas) return;
        var pt = canvasPoint(e);
        if (e.pointerType === 'touch') {
            if (pt.cx < canvas.getBoundingClientRect().width * 0.5) {
                T.touchId = e.pointerId;
                T.touchOrigin = { x: pt.cx, y: pt.cy };
                T.touchMove = { x: 0, y: 0 };
            } else {
                var p = player();
                var target = null, best = 1e9;
                for (var i = 0; i < T.players.length; i++) {
                    var q = T.players[i];
                    if (q === p || q.down || q.eliminated) continue;
                    var d = dist(p.x, p.y, q.x, q.y);
                    if (d < best) { best = d; target = q; }
                }
                if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
                T.touchShoot = true;
            }
            e.preventDefault();
        } else {
            T.mouse = { x: pt.x, y: pt.y };
            T.mouseDown = true;
            e.preventDefault();
        }
    }

    function pointerUp(e) {
        if (e.pointerType === 'touch') {
            if (T.touchId === e.pointerId) {
                T.touchId = null;
                T.touchOrigin = null;
                T.touchMove = { x: 0, y: 0 };
            }
            if (e.clientX > (canvas ? canvas.getBoundingClientRect().left + canvas.getBoundingClientRect().width * 0.5 : 0)) {
                T.touchShoot = false;
            }
        } else {
            T.mouseDown = false;
        }
    }

    /* ------------------------- frame loop ------------------------- */

    function frame(ts) {
        if (!lastFrame) lastFrame = ts;
        var dt = Math.min(0.05, (ts - lastFrame) / 1000);
        lastFrame = ts;
        if (running && !T.over) {
            update(dt);
            if (T.touchShoot) {
                var p = player();
                if (p && !p.down && !p.eliminated) shoot(p);
            }
        }
        draw();
        raf = requestAnimationFrame(frame);
    }

    function open() {
        if (typeof closeGame === 'function' && typeof currentGameId !== 'undefined' && currentGameId && currentGameId !== 14) closeGame();
        if (window.Games3D) window.Games3D.stop();
        if (typeof dgDestroy === 'function') dgDestroy();
        if (typeof luckyCleanup === 'function') luckyCleanup();
        if (typeof landingCleanup === 'function') landingCleanup();
        tranqCleanup();
        if (typeof currentGameId !== 'undefined') currentGameId = 14;
        if (typeof trackRecentGame === 'function') trackRecentGame(14);
        document.getElementById('modalGameTitle').textContent = 'Tranq Arena';
        var body = document.getElementById('modalGameBody');
        body.innerHTML =
            '<div class="tq-wrap">' +
                '<div class="tq-stage" id="tqStage">' +
                    '<canvas id="tqCanvas" class="tq-canvas"></canvas>' +
                    '<div class="tq-top">' +
                        '<div class="tq-brand"><span>TRANQ ARENA</span><strong>Stay awake</strong></div>' +
                        '<div class="tq-alive" id="tqAlive">5 LEFT</div>' +
                        '<div class="tq-score-pill"><small>SCORE</small><strong id="tqScore">0</strong></div>' +
                    '</div>' +
                    '<div class="tq-panel">' +
                        '<div class="tq-meter"><span>SLEEP</span><div class="tq-bar"><i id="tqSleep"></i></div></div>' +
                        '<div class="tq-energy-line"><span>ENERGY</span><div class="tq-energy" id="tqEnergy"></div></div>' +
                        '<div class="tq-status" id="tqStatus">GET READY</div>' +
                    '</div>' +
                    '<div class="tq-feed" id="tqFeed"></div>' +
                    '<div class="tq-banner" id="tqBanner"></div>' +
                    '<div class="tq-toast" id="tqToast"></div>' +
                    '<div class="tq-hint">WASD move · mouse aim · click / Space shoot · one revive costs 1 energy</div>' +
                    '<div class="tq-menu" id="tqMenu">' +
                        '<div class="tq-menu-card">' +
                            '<span class="tq-menu-kicker">TRANQ ARENA</span>' +
                            '<h2 id="tqMenuTitle">Last two awake</h2>' +
                            '<p>Put rivals to sleep with tranquilizer darts. Passing out costs 1 energy to revive. Survive to the final two.</p>' +
                            '<div class="tq-menu-actions">' +
                                '<button type="button" class="tq-menu-primary" onclick="tranqStartSolo()">Solo vs bots</button>' +
                                '<button type="button" class="tq-menu-multi" onclick="tranqStartMultiplayer()">Public multiplayer</button>' +
                            '</div>' +
                            '<p class="tq-menu-status" id="tqMenuStatus">5-player arena · one revive per energy</p>' +
                            '<button type="button" class="tq-menu-back" onclick="closeGame()">Back to Games</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tq-overlay" id="tqOverlay">' +
                        '<div class="tq-card">' +
                            '<span class="tq-over-kicker" id="tqOverKicker">MATCH OVER</span>' +
                            '<h2 id="tqOverTitle">Arena result</h2>' +
                            '<p id="tqOverText"></p>' +
                            '<div class="tq-over-stats" id="tqOverStats"></div>' +
                            '<div class="tq-over-coins" id="tqOverCoins"></div>' +
                            '<div class="tq-over-actions"><button type="button" class="tq-again" onclick="tranqRestart()">Play Again</button><button type="button" class="tq-back" onclick="closeGame()">Back to Games</button></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.getElementById('gameModal').style.display = 'flex';
        canvas = document.getElementById('tqCanvas');
        stage = document.getElementById('tqStage');
        ctx = canvas ? canvas.getContext('2d') : null;
        T.mouse = null;
        T.mouseDown = false;
        T.touchId = null;
        T.touchOrigin = null;
        T.touchMove = { x: 0, y: 0 };
        T.touchShoot = false;
        resize();
        if (window.ResizeObserver && stage) {
            resizeObs = new ResizeObserver(resize);
            resizeObs.observe(stage);
        }
        showMenu();
        bindInput();
        running = true;
        lastFrame = 0;
        raf = requestAnimationFrame(frame);
    }

    function tranqCleanup() {
        running = false;
        mpCleanup();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
        unbindInput();
        if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
        canvas = null;
        stage = null;
        ctx = null;
        T.darts = [];
        T.particles = [];
        T.mouseDown = false;
        T.touchShoot = false;
    }

    function restart() {
        if (!canvas) return;
        if (T.multiplayer) {
            mpCleanup();
            showMenu();
        } else {
            startMatch('solo');
        }
        running = true;
        lastFrame = 0;
    }

    window.tranqRestart = restart;
    window.tranqCleanup = tranqCleanup;
    window.openTranqGame = open;
    window.tranqStartSolo = startSolo;
    window.tranqStartMultiplayer = startMultiplayer;
})();
