/* LessFun — Throw & Break · drag objects and shatter them into pieces */
(function (global) {
    'use strict';

    var STYLE_ID = 'tbStyles';
    var root = null;
    var container = null;
    var canvas = null;
    var ctx = null;
    var engine = null;
    var runnerId = 0;
    var running = false;
    var W = 0, H = 0, dpr = 1;
    var groundY = 0;
    var score = { throws: 0, breaks: 0, points: 0 };
    var drag = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.tb-wrap{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#88b7ff 0%,#a9ccff 42%,#dce9ff 62%,#f5e9d6 100%);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;touch-action:none}
.tb-wrap canvas{position:absolute;inset:0;display:block;touch-action:none}
.tb-hud{position:absolute;top:10px;left:12px;right:12px;display:flex;gap:8px;align-items:center;justify-content:center;z-index:5;pointer-events:none;flex-wrap:wrap}
.tb-hud .chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(16,26,44,.62);color:#fff;font-size:11px;font-weight:800;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:.04em}
.tb-hud .chip b{font-size:13px;letter-spacing:-.02em}
.tb-btns{position:absolute;top:52px;left:12px;right:12px;display:flex;gap:8px;z-index:6;pointer-events:auto}
.tb-btn{flex:1;padding:9px 10px;border:1px solid rgba(16,26,44,.2);border-radius:12px;background:rgba(255,255,255,.8);color:#16233c;font:inherit;font-size:11px;font-weight:800;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.tb-note{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:5;padding:7px 13px;border-radius:999px;background:rgba(16,26,44,.62);color:rgba(255,255,255,.9);font-size:9.5px;font-weight:700;white-space:nowrap;pointer-events:none}
.tb-toast{position:absolute;top:100px;left:50%;transform:translateX(-50%);z-index:6;padding:8px 14px;border-radius:999px;background:rgba(16,26,44,.7);color:#ffd75e;font-size:11px;font-weight:800;opacity:0;transition:opacity .25s;pointer-events:none}
.tb-toast.is-visible{opacity:1}
`;
        document.head.appendChild(style);
    }

    function ensureMatter() {
        if (global.Matter) return Promise.resolve(global.Matter);
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js';
            s.onload = function () { resolve(global.Matter); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function log(msg) {
        var t = root && root.querySelector('.tb-toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('is-visible');
        clearTimeout(t._t);
        t._t = setTimeout(function () { t.classList.remove('is-visible'); }, 1400);
    }

    function updateHUD() {
        if (!root) return;
        var items = root.querySelectorAll('[data-tb-stat]');
        for (var i = 0; i < items.length; i++) {
            items[i].textContent = score[items[i].getAttribute('data-tb-stat')];
        }
    }

    function breakableBody(kind, x, y, w, h) {
        var opts = { friction: .4, restitution: .2, density: kind === 'glass' ? .0008 : (kind === 'pot' ? .0022 : .0015) };
        var b = Matter.Bodies.rectangle(x, y, w, h, opts);
        b._kind = kind; b._w = w; b._h = h; b._breakable = true;
        return b;
    }

    function buildWorld() {
        var wallOpts = { isStatic: true };
        Matter.Composite.add(engine.world, [
            Matter.Bodies.rectangle(W / 2, groundY + 120, W + 400, 240, wallOpts),
            Matter.Bodies.rectangle(-40, H / 2, 80, H * 3, wallOpts),
            Matter.Bodies.rectangle(W + 40, H / 2, 80, H * 3, wallOpts)
        ]);
        refillTargets(true);
        buildLaunchPile();
    }

    function refillTargets(silent) {
        var list = [];
        // glass wall
        var gx0 = W * .74, gy0 = groundY;
        for (var gy = 0; gy < 6; gy++) {
            for (var gx = 0; gx < 3; gx++) {
                list.push(breakableBody('glass', gx0 + gx * 34, gy0 - 16 - gy * 34, 30, 30));
            }
        }
        // pots on top
        for (var p = 0; p < 3; p++) {
            list.push(breakableBody('pot', gx0 + 33, gy0 - 16 - 6 * 34 - 22 - p * 42, 46, 38));
        }
        // crates tower (alternating)
        for (var c = 0; c < 5; c++) {
            list.push(breakableBody('crate', W * .58 + (c % 2 ? 6 : -2), groundY - 24 - c * 48, 46, 46));
        }
        Matter.Composite.add(engine.world, list);
        if (!silent) log('Targets refilled');
    }

    function buildLaunchPile() {
        var startX = W * .12;
        var scales = [44, 44, 36, 30];
        for (var i = 0; i < 6; i++) {
            var kind = ['crate', 'glass', 'pot', 'crate', 'glass', 'pot'][i];
            var size = kind === 'pot' ? 40 : kind === 'glass' ? 30 : 44;
            var b = breakableBody(kind, startX + (i % 2) * 52, groundY - size / 2 - 4 - Math.floor(i / 2) * (size + 4), size, size);
            b._throwable = true;
            b._breakable = false; // launching pile copies don't shatter on the drag pile itself
            Matter.Composite.add(engine.world, b);
        }
        var melon = Matter.Bodies.circle(startX + 26, groundY - 26 - 96, 26, { density: .002, friction: .4, restitution: .3 });
        melon._kind = 'melon';
        melon._w = 52; melon._h = 52;
        melon._breakable = true;
        melon._throwable = true;
        Matter.Composite.add(engine.world, melon);
    }

    function breakBody(body) {
        if (!body._breakable || body._breaking) return;
        body._breaking = true;
        var x = body.position.x, y = body.position.y, w = body._w || 40, h = body._h || 40, kind = body._kind || 'crate';
        Matter.Composite.remove(engine.world, body);
        score.breaks++;
        score.points += kind === 'glass' ? 14 : kind === 'pot' ? 26 : kind === 'melon' ? 40 : 10;
        updateHUD();
        var pieces = [];
        var addPiece = function (p) { p._piece = true; p._life = 1; pieces.push(p); };
        if (kind === 'glass') {
            for (var i = 0; i < 5; i++) {
                var ang = (i / 5) * Math.PI * 2 + .35;
                var shard = Matter.Bodies.polygon(x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, 5, 10, { friction: .1, restitution: .45, density: .0007, angle: Math.random() * Math.PI });
                shard._fill = 'rgba(186,228,255,.72)';
                shard._look = 'shard';
                addPiece(shard);
            }
        } else if (kind === 'melon') {
            for (var h2 = 0; h2 < 2; h2++) {
                var half = Matter.Bodies.rectangle(x + (h2 ? 13 : -13), y, 24, 20, { friction: .4, restitution: .25, density: .0012, angle: h2 ? .4 : -.4 });
                half._fill = h2 ? '#e2543c' : '#e2543c';
                half._look = 'meloninner';
                addPiece(half);
            }
            for (var s = 0; s < 5; s++) {
                var seed = Matter.Bodies.circle(x + (s - 2) * 9, y - 13, 4.5, { friction: .2, restitution: .55, density: .002 });
                seed._fill = '#222512';
                seed._look = 'seed';
                addPiece(seed);
            }
        } else {
            var pw = Math.max(10, w / 2 - 4), ph = Math.max(10, h / 2 - 4);
            for (var a = -1; a <= 1; a += 2) {
                var p1 = Matter.Bodies.rectangle(x + a * (pw / 2 + 3), y, pw, ph, { friction: .4, restitution: .2, density: .0011, angle: a * .35 });
                p1._fill = kind === 'pot' ? '#c96f3d' : '#a4753f';
                p1._look = kind === 'pot' ? 'potshard' : 'plank';
                addPiece(p1);
            }
        }
        Matter.Composite.add(engine.world, pieces);
        if (score.breaks % 6 === 0) log(score.breaks + ' broke · ' + score.points + ' pts');
    }

    function onHit(pairs) {
        for (var i = 0; i < pairs.length; i++) {
            var a = pairs[i].bodyA, b = pairs[i].bodyB;
            var rel = Matter.Vector.magnitude(Matter.Vector.sub(a.velocity, b.velocity));
            if (rel > 4.6) {
                if (a._throwable !== true && a._breakable && !a._piece && !a.isStatic) breakBody(a);
                if (b._throwable !== true && b._breakable && !b._piece && !b.isStatic) breakBody(b);
            }
        }
    }

    function drawBody(b) {
        var v = b.vertices;
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        if (b.circleRadius) {
            var p = b.position;
            ctx.beginPath();
            ctx.arc(p.x, p.y, b.circleRadius, 0, Math.PI * 2);
        }
        var look = b._look || '';
        if (b._fill) ctx.fillStyle = b._fill;
        else if (look === 'shard' || b._kind === 'glass') ctx.fillStyle = 'rgba(186,228,255,.72)';
        else if (look === 'potshard' || b._kind === 'pot') ctx.fillStyle = '#c96f3d';
        else if (b._kind === 'crate') ctx.fillStyle = '#a4753f';
        else if (b._kind === 'melon') ctx.fillStyle = '#3f8a4d';
        else ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        var kindForStroke = b._kind || b._look;
        if (b._kind === 'crate' || b._look === 'plank') {
            ctx.strokeStyle = 'rgba(60,40,16,.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (b._kind === 'glass' || b._look === 'shard') {
            ctx.strokeStyle = 'rgba(255,255,255,.85)';
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }
        if (b._kind === 'melon' && !b._look) {
            ctx.fillStyle = 'rgba(0,0,0,.15)';
            ctx.fill();
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#c9a468';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(0, groundY, W, 5);
        var bodies = Matter.Composite.allBodies(engine.world);
        for (var i = 0; i < bodies.length; i++) {
            if (bodies[i].isStatic) continue;
            drawBody(bodies[i]);
        }
        if (drag && drag.body) {
            ctx.strokeStyle = 'rgba(255,255,255,.8)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.moveTo(drag.sx, drag.sy);
            ctx.lineTo(drag.x, drag.y);
            ctx.stroke();
            ctx.setLineDash([]);
            var power = Math.min(70, Math.hypot(drag.x - drag.sx, drag.y - drag.sy) * .12);
            ctx.fillStyle = 'rgba(255,215,94,.85)';
            ctx.beginPath();
            ctx.arc(drag.x, drag.y, power, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function resize() {
        if (!root) return;
        var r = root.getBoundingClientRect();
        W = Math.round(r.width);
        H = Math.round(r.height);
        dpr = global.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        groundY = H - 96;
    }

    function reset() {
        Matter.Composite.clear(engine.world, false);
        score = { throws: 0, breaks: 0, points: 0 };
        updateHUD();
        buildWorld();
        log('Arena reset');
    }

    function pos(e) {
        var r = canvas.getBoundingClientRect();
        var t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function findBody(pt) {
        var bodies = Matter.Composite.allBodies(engine.world);
        for (var i = bodies.length - 1; i >= 0; i--) {
            var b = bodies[i];
            if (b._throwable && Matter.Bounds.contains(b.bounds, pt)) {
                if (b.circleRadius) {
                    var dx = pt.x - b.position.x, dy = pt.y - b.position.y;
                    if (dx * dx + dy * dy <= b.circleRadius * b.circleRadius) return b;
                } else if (Matter.Vertices.contains(b.vertices, pt)) return b;
            }
        }
        return null;
    }

    function onDown(e) {
        if (!engine) return;
        var p = pos(e);
        var b = findBody(p);
        if (!b) return;
        Matter.Sleeping.set(b, false);
        drag = { body: b, sx: p.x, sy: p.y, x: p.x, y: p.y, lastX: p.x, lastY: p.y, moved: 0, t: Date.now() };
        if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
        if (!drag) return;
        var p = pos(e);
        drag.moved += Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y);
        drag.x = p.x;
        drag.y = p.y;
        Matter.Body.setPosition(drag.body, { x: p.x, y: p.y });
        Matter.Body.setVelocity(drag.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(drag.body, 0);
        if (e.cancelable) e.preventDefault();
    }
    function onUp() {
        if (!drag) return;
        var dx = drag.x - drag.sx, dy = drag.y - drag.sy;
        var power = Math.hypot(dx, dy);
        if (power > 24) {
            Matter.Sleeping.set(drag.body, false);
            Matter.Body.setVelocity(drag.body, { x: dx * .185, y: dy * .185 - 1.2 });
            Matter.Body.setAngularVelocity(drag.body, Math.max(-.3, Math.min(.3, dx * .006)));
            score.throws++;
            updateHUD();
            drag.body._throwable = false; // thrown copies become projectiles
        }
        drag = null;
    }

    function loop() {
        if (!running) return;
        if (engine) {
            Matter.Engine.update(engine, 1000 / 60);
            render();
        }
        runnerId = global.requestAnimationFrame(loop);
        if (runnerId === 0) runnerId = global.requestAnimationFrame(loop);
    }

    function startLoop() {
        if (running) return;
        running = true;
        runnerId = global.requestAnimationFrame(loop);
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML =
            '<div class="tb-wrap">' +
                '<canvas></canvas>' +
                '<div class="tb-hud"><span class="chip">THROWS <b data-tb-stat="throws">0</b></span><span class="chip">BROKE <b data-tb-stat="breaks">0</b></span><span class="chip">SCORE <b data-tb-stat="points">0</b></span></div>' +
                '<div class="tb-btns"><button type="button" class="tb-btn" data-refill>REFILL TARGETS</button><button type="button" class="tb-btn" data-reset>RESET</button></div>' +
                '<div class="tb-toast"></div>' +
                '<div class="tb-note">Grab a crate, melon, glass or pot on the left · pull and release to throw</div>' +
            '</div>';
        root = el.querySelector('.tb-wrap');
        canvas = el.querySelector('canvas');
        ctx = canvas.getContext('2d');
        updateHUD();
        resize();
        return ensureMatter().then(function () {
            if (!root || !global.Matter) return;
            engine = Matter.Engine.create({ enableSleeping: true });
            Matter.Events.on(engine, 'collisionStart', function (ev) {
                if (ev.pairs && ev.pairs.length) onHit(ev.pairs);
            });
            buildWorld();
            root.addEventListener('pointerdown', onDown);
            root.addEventListener('pointermove', onMove, { passive: false });
            root.addEventListener('pointerup', onUp);
            root.addEventListener('pointercancel', onUp);
            root.addEventListener('pointerleave', function () { if (drag) onUp(); });
            root.querySelector('[data-refill]').addEventListener('click', function () { refillTargets(false); });
            root.querySelector('[data-reset]').addEventListener('click', reset);
            startLoop();
            updateHUD();
        }).catch(function () {
            if (root) log('Could not load the physics engine. Check your connection.');
        });
    }

    function close() {
        if (runnerId) { global.cancelAnimationFrame(runnerId); runnerId = 0; }
        running = false;
        if (engine && global.Matter) { Matter.Events.off(engine, 'collisionStart'); Matter.Engine.clear(engine); engine = null; }
        if (root) { try { root.remove(); } catch (e) {} }
        container = null;
        root = null;
        canvas = null;
        ctx = null;
        drag = null;
    }

    global.ThrowBreak = { open: open, close: close };
})(window);
