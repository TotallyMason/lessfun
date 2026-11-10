/* LessFun — RC Parking · top-down RC car, park it in the bay */
(function (global) {
    'use strict';

    var STYLE_ID = 'rcStyles';
    var root = null;
    var container = null;
    var canvas = null;
    var ctx = null;
    var runnerId = 0;
    var running = false;
    var keys = {};
    var state = null;
    var W = 0, H = 0, dpr = 1, view = 1, offX = 0, offY = 0;

    var WORLD_W = 1000, WORLD_H = 720;
    var CAR_LEN = 46, CAR_W = 26;
    var TOUCH = { up: false, down: false, left: false, right: false };

    var LEVELS = [
        { name: 'Driveway', cars: [[720, 180, 0], [720, 320, 0]], cones: [], bay: { x: 720, y: 520 }, bayDir: 0 },
        { name: 'Corner Lot', cars: [[500, 140, 0], [760, 140, 0], [880, 480, 90]], cones: [[600, 300]], bay: { x: 300, y: 560 }, bayDir: 0 },
        { name: 'Tight Middle', cars: [[560, 260, 90], [760, 420, 90], [560, 580, 90]], cones: [[700, 340], [840, 200]], bay: { x: 220, y: 220 }, bayDir: 0 },
        { name: 'Cone Alley', cars: [[820, 160, 0], [880, 480, 90]], cones: [[420, 200], [560, 320], [420, 460], [560, 580]], bay: { x: 200, y: 380 }, bayDir: 0 },
        { name: 'Grand Final', cars: [[460, 160, 0], [660, 300, 90], [460, 560, 0], [860, 620, 90]], cones: [[580, 160], [760, 200], [580, 420], [760, 470]], bay: { x: 160, y: 620 }, bayDir: 0 }
    ];

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.rc-wrap{position:absolute;inset:0;overflow:hidden;background:#2c3038;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;touch-action:none}
.rc-wrap canvas{position:absolute;inset:0;display:block;touch-action:none}
.rc-hud{position:absolute;top:10px;left:12px;right:12px;display:flex;gap:8px;align-items:center;justify-content:center;z-index:5;pointer-events:none;flex-wrap:wrap}
.rc-hud .chip{padding:7px 12px;border-radius:999px;background:rgba(10,14,22,.62);color:#fff;font-size:11px;font-weight:800;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:.05em}
.rc-hud .chip b{color:#7ce38b}
.rc-btns{position:absolute;top:52px;left:12px;z-index:6;display:flex;gap:8px;pointer-events:auto}
.rc-btn{padding:8px 13px;border:1px solid rgba(10,14,22,.3);border-radius:12px;background:rgba(255,255,255,.85);color:#141821;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
.rc-note{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:5;padding:7px 13px;border-radius:999px;background:rgba(10,14,22,.6);color:rgba(255,255,255,.9);font-size:9.5px;font-weight:700;white-space:nowrap;pointer-events:none}
.rc-toast{position:absolute;top:100px;left:50%;transform:translateX(-50%);z-index:6;padding:9px 16px;border-radius:999px;background:rgba(10,14,22,.72);color:#7ce38b;font-size:12px;font-weight:800;opacity:0;transition:opacity .25s;pointer-events:none}
.rc-toast.is-visible{opacity:1}
.rc-over{position:absolute;inset:0;z-index:9;display:none;align-items:center;justify-content:center;background:rgba(8,10,16,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.rc-over.is-visible{display:flex}
.rc-over .card{text-align:center;padding:26px 34px;border-radius:20px;background:rgba(20,24,34,.9);border:1px solid rgba(255,255,255,.08)}
.rc-over strong{display:block;font-size:clamp(20px,4.5vw,32px);font-weight:900;letter-spacing:-.04em;color:#fff;margin-bottom:8px}
.rc-over p{font-size:12px;color:rgba(255,255,255,.65);margin:0 0 16px}
.rc-over button{border:0;padding:10px 20px;border-radius:12px;background:#7ce38b;color:#0c2416;font:inherit;font-size:12px;font-weight:900;cursor:pointer}
.rc-dpad{position:absolute;right:16px;bottom:16px;z-index:8;display:none;grid-template-columns:repeat(3,52px);grid-auto-rows:52px;gap:6px;pointer-events:auto}
.rc-dpad button{border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(20,24,34,.6);color:#fff;font:inherit;font-size:18px;font-weight:900}
.rc-dpad button:active{background:rgba(124,227,139,.4)}
@media (pointer:coarse){.rc-dpad{display:grid}}
`;
        document.head.appendChild(style);
    }

    function log(msg, color) {
        var t = root && root.querySelector('.rc-toast');
        if (!t) return;
        t.textContent = msg;
        t.style.color = color || '#7ce38b';
        t.classList.add('is-visible');
        clearTimeout(t._t);
        t._t = setTimeout(function () { t.classList.remove('is-visible'); }, 1500);
    }

    function level(i) {
        var L = LEVELS[i % LEVELS.length];
        var cones = L.cones.map(function (c) { return { x: c[0], y: c[1], vx: 0, vy: 0, rot: Math.random() * 6.28, vr: 0, down: 0 }; });
        return {
            idx: i % LEVELS.length,
            name: L.name,
            cars: L.cars.map(function (c) { return { x: c[0], y: c[1], rot: c[2] * Math.PI / 180 }; }),
            cones: cones,
            bay: { x: L.bay.x, y: L.bay.y, dir: L.bayDir * Math.PI / 180 },
            car: { x: 110, y: 380, rot: 0, speed: 0 },
            holdT: 0,
            time: 0,
            penalty: 0,
            hits: 0
        };
    }

    function resetLevel(silent) {
        state = level(state ? state.idx : 0);
        updateHUD();
        if (!silent) log('Level: ' + state.name);
    }

    function nextLevel() {
        var next = (state.idx + 1) % LEVELS.length;
        state = level(next);
        updateHUD();
        log('Level: ' + state.name);
    }

    function updateHUD() {
        if (!root) return;
        root.querySelector('[data-rc-level]').textContent = (state.idx + 1) + '/5 · ' + state.name;
        root.querySelector('[data-rc-time]').textContent = Math.floor(state.time) + 's';
        root.querySelector('[data-rc-pen]').textContent = state.penalty;
    }

    function carCorners(car) {
        var cos = Math.cos(car.rot), sin = Math.sin(car.rot);
        var hl = CAR_LEN / 2, hw = CAR_W / 2;
        var pts = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]];
        return pts.map(function (p) { return { x: car.x + p[0] * cos - p[1] * sin, y: car.y + p[0] * sin + p[1] * cos }; });
    }

    function rectsOverlap(a, b) {
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                var a1 = a[(i + 1) % 4], a2 = a[i], b1 = b[j], b2 = b[(j + 1) % 4];
                var d = (a2.x - a1.x) * (b1.y - a2.y) - (b1.x - a2.x) * (a2.y - a1.y);
                var e = (a2.x - a1.x) * (b2.y - a2.y) - (b2.x - a2.x) * (a2.y - a1.y);
                if ((d >= 0) !== (e >= 0)) return true;
            }
        }
        return false;
    }

    function pointInPoly(pt, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
        }
        return inside;
    }

    function step(dt) {
        var car = state.car;
        var thr = (keys.ArrowUp || keys.w || keys.W || TOUCH.up ? 1 : 0) - (keys.ArrowDown || keys.s || keys.S || TOUCH.down ? 1 : 0);
        var steer = (keys.ArrowLeft || keys.a || keys.A || TOUCH.left ? 1 : 0) - (keys.ArrowRight || keys.d || keys.D || TOUCH.right ? 1 : 0);
        var maxSpeed = 300;
        var accel = 480;
        if (thr > 0) car.speed = Math.min(maxSpeed, car.speed + accel * dt);
        else if (thr < 0) car.speed = Math.max(-160, car.speed - accel * dt);
        else car.speed *= (1 - Math.min(1, 2.4 * dt));
        if (Math.abs(car.speed) > 4) {
            car.rot += steer * 2.6 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
        }
        var nx = car.x + Math.cos(car.rot) * car.speed * dt;
        var ny = car.y + Math.sin(car.rot) * car.speed * dt;
        var moved = { x: car.x, y: car.y, rot: car.rot, speed: car.speed };
        moved.x = nx; moved.y = ny;
        // wall bounce
        var corners = carCorners(moved);
        var hitWall = false;
        for (var i = 0; i < 4; i++) {
            if (corners[i].x < 14 || corners[i].x > WORLD_W - 14 || corners[i].y < 14 || corners[i].y > WORLD_H - 14) hitWall = true;
        }
        if (hitWall) {
            car.speed *= -0.35;
            if (Math.abs(car.speed) > 60 && state._wallCd !== true) { state.penalty += 10; state._wallCd = true; var c = car.speed; setTimeout(function(){ state && (state._wallCd = false); }, 600); log('-10 wall bump', '#ffb36b'); }
        } else {
            car.x = nx; car.y = ny;
        }
        // parked cars
        var carPoly = carCorners(car);
        for (var ci = 0; ci < state.cars.length; ci++) {
            var pc = state.cars[ci];
            var pcPoly = carCorners({ x: pc.x, y: pc.y, rot: pc.rot });
            if (rectsOverlap(carPoly, pcPoly)) {
                // push back along movement
                car.x -= Math.cos(car.rot) * car.speed * dt * 1.2;
                car.y -= Math.sin(car.rot) * car.speed * dt * 1.2;
                car.speed *= -0.3;
                if (state._carCd !== true) { state.penalty += 10; state._carCd = true; setTimeout(function(){ state && (state._carCd = false); }, 600); }
                break;
            }
        }
        // cones
        for (var ki = 0; ki < state.cones.length; ki++) {
            var cone = state.cones[ki];
            if (cone.down > 2.2) continue;
            var ddx = cone.x - car.x, ddy = cone.y - car.y;
            var dist = Math.hypot(ddx, ddy);
            if (dist < 30 && Math.abs(car.speed) > 30) {
                cone.vx = Math.cos(car.rot) * car.speed * .5 + (Math.random() - .5) * 60;
                cone.vy = Math.sin(car.rot) * car.speed * .5 + (Math.random() - .5) * 60;
                cone.vr = (Math.random() - .5) * 12;
                state.hits++;
                state.penalty += 25;
                log('Coned! -25', '#ffb36b');
            }
        }
        state.time += dt;
        // parking check
        var bay = state.bay;
        var bayPoly = carCorners({ x: bay.x, y: bay.y, rot: bay.dir, speed: 0 });
        var carPolyNow = carCorners(car);
        var inside = carPolyNow.every(function (pt) { return pointInPoly(pt, bayPoly); });
        var angleDiff = Math.abs(((car.rot - bay.dir) % Math.PI + Math.PI) % Math.PI - Math.PI / 2);
        var aligned = Math.min(angleDiff, Math.PI - angleDiff) < 0.28;
        if (inside && aligned && Math.abs(car.speed) < 12) {
            state.holdT += dt;
            if (state.holdT >= 1) {
                log('Parked! -' + state.penalty + ' penalty · ' + Math.floor(state.time) + 's');
                showOver('Parked!', 'Level ' + (state.idx + 1) + ' · ' + state.name + ' · ' + Math.floor(state.time) + 's · penalty ' + state.penalty, state.idx < LEVELS.length - 1 ? 'NEXT LEVEL' : 'PLAY AGAIN');
                state.paused = true;
            }
        } else {
            state.holdT = Math.max(0, state.holdT - dt * 2);
        }
        updateHUD();
    }

    function showOver(title, msg, btnText) {
        var ov = root.querySelector('.rc-over');
        ov.querySelector('strong').textContent = title;
        ov.querySelector('p').textContent = msg;
        var b = ov.querySelector('button');
        b.textContent = btnText;
        b.onclick = function () {
            ov.classList.remove('is-visible');
            state.paused = false;
            if (state.idx < LEVELS.length - 1) nextLevel();
            else resetLevel(true);
        };
        ov.classList.add('is-visible');
    }

    function drawRoundRect(x, y, w, h, r, fill) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }

    function drawCarBody(x, y, rot, bodyColor, glassColor, isRC) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        var hl = CAR_LEN / 2, hw = CAR_W / 2;
        drawRoundRect(-hl, -hw, CAR_LEN, CAR_W, 7, bodyColor);
        ctx.fillStyle = glassColor;
        drawRoundRect(-hl * 0.15, -hw + 3.5, hl * 0.55, CAR_W - 7, 4, glassColor);
        drawRoundRect(-hl + 6, -hw + 3.5, hl * 0.42, CAR_W - 7, 4, glassColor);
        if (isRC) {
            ctx.fillStyle = 'rgba(255,255,255,.85)';
            ctx.fillRect(-hl + 2, -2, 4, 4);
            ctx.fillRect(-hl + 2, -2 + CAR_W - 2, 0, 0);
        }
        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.translate(offX, offY);
        ctx.scale(view, view);
        // lot
        ctx.fillStyle = '#4a4f58';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        // grid texture
        ctx.strokeStyle = 'rgba(255,255,255,.035)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx < WORLD_W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD_H); ctx.stroke(); }
        for (var gy = 0; gy < WORLD_H; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WORLD_W, gy); ctx.stroke(); }
        // border
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, WORLD_W - 12, WORLD_H - 12);
        // parking bay
        var bay = state.bay;
        var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        ctx.save();
        ctx.translate(bay.x, bay.y);
        ctx.rotate(bay.dir);
        ctx.strokeStyle = 'rgba(124,227,139,' + (0.55 + pulse * 0.45) + ')';
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(-CAR_LEN / 2 - 8, -CAR_W / 2 - 14, CAR_LEN + 16, CAR_W + 28);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(124,227,139,' + (0.12 + pulse * 0.1) + ')';
        ctx.fillRect(-CAR_LEN / 2 - 8, -CAR_W / 2 - 14, CAR_LEN + 16, CAR_W + 28);
        ctx.fillStyle = 'rgba(124,227,139,.9)';
        ctx.font = '900 16px "Segoe UI",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PARK', 0, -CAR_W / 2 - 24);
        ctx.restore();
        // parked cars
        for (var i = 0; i < state.cars.length; i++) {
            var pc = state.cars[i];
            drawCarBody(pc.x, pc.y, pc.rot, '#5b6b8c', 'rgba(180,200,230,.75)', false);
        }
        // cones
        for (var k = 0; k < state.cones.length; k++) {
            var cone = state.cones[k];
            ctx.save();
            ctx.translate(cone.x, cone.y);
            ctx.rotate(cone.rot);
            var s = cone.down > 0 ? 0.75 : 1;
            ctx.beginPath();
            ctx.arc(0, 0, 10 * s, 0, Math.PI * 2);
            ctx.fillStyle = cone.down > 0 ? '#b8652f' : '#ff8a3c';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.restore();
        }
        // RC car
        var car = state.car;
        drawCarBody(car.x, car.y, car.rot, '#e05a4e', 'rgba(20,24,30,.85)', true);
        ctx.restore();
    }

    function update(dt) {
        // cones physics
        for (var k = 0; k < state.cones.length; k++) {
            var cone = state.cones[k];
            if (Math.abs(cone.vx) > 1 || Math.abs(cone.vy) > 1) {
                cone.x += cone.vx * dt;
                cone.y += cone.vy * dt;
                cone.rot += cone.vr * dt;
                cone.vx *= (1 - Math.min(1, 2.6 * dt));
                cone.vy *= (1 - Math.min(1, 2.6 * dt));
                cone.down = Math.min(2.4, cone.down + dt);
                cone.x = Math.max(20, Math.min(WORLD_W - 20, cone.x));
                cone.y = Math.max(20, Math.min(WORLD_H - 20, cone.y));
            }
        }
        if (!state.paused) step(dt);
    }

    function loop() {
        if (!running) return;
        var dt = Math.min(0.05, (performance.now() - (loop._last || performance.now())) / 1000);
        loop._last = performance.now();
        update(dt);
        render();
        runnerId = global.requestAnimationFrame(loop);
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
        view = Math.min(W / WORLD_W, H / (WORLD_H + 20)) * 0.98;
        offX = (W - WORLD_W * view) / 2;
        offY = (H - WORLD_H * view) / 2;
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML =
            '<div class="rc-wrap">' +
                '<canvas></canvas>' +
                '<div class="rc-hud"><span class="chip">LEVEL <b data-rc-level>1/5</b></span><span class="chip">TIME <b data-rc-time>0s</b></span><span class="chip">PENALTY <b data-rc-pen>0</b></span></div>' +
                '<div class="rc-btns"><button type="button" class="rc-btn" data-rc-restart>RESTART LEVEL</button><button type="button" class="rc-btn" data-rc-skip>SKIP LEVEL</button></div>' +
                '<div class="rc-toast"></div>' +
                '<div class="rc-note">WASD / arrows to drive · reverse to correct · hold still in the glowing bay for 1s</div>' +
                '<div class="rc-dpad">' +
                    '<span></span><button type="button" data-tb-up>▲</button><span></span>' +
                    '<button type="button" data-tb-left>◀</button><button type="button" data-tb-down>▼</button><button type="button" data-tb-right>▶</button>' +
                '</div>' +
                '<div class="rc-over"><div class="card"><strong></strong><p></p><button type="button">NEXT LEVEL</button></div></div>' +
            '</div>';
        root = el.querySelector('.rc-wrap');
        canvas = el.querySelector('canvas');
        ctx = canvas.getContext('2d');
        resize();
        resetLevel(true);
        root.querySelector('[data-rc-restart]').addEventListener('click', function () { resetLevel(true); log('Level restarted'); });
        root.querySelector('[data-rc-skip]').addEventListener('click', function () { nextLevel(); });
        // dpad
        var bind = function (sel, key) {
            var b = root.querySelector(sel);
            if (!b) return;
            var down = function (e) { TOUCH[key] = true; if (e.cancelable) e.preventDefault(); };
            var up = function () { TOUCH[key] = false; };
            b.addEventListener('pointerdown', down);
            b.addEventListener('pointerup', up);
            b.addEventListener('pointerleave', up);
            b.addEventListener('pointercancel', up);
        };
        bind('[data-tb-up]', 'up');
        bind('[data-tb-down]', 'down');
        bind('[data-tb-left]', 'left');
        bind('[data-tb-right]', 'right');
        global.addEventListener('keydown', onKey);
        global.addEventListener('keyup', onKeyUp);
        global.addEventListener('resize', resize, { passive: true });
        running = true;
        loop._last = performance.now();
        runnerId = global.requestAnimationFrame(loop);
    }

    function onKey(e) { keys[e.key] = true; if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0 && e.cancelable) e.preventDefault(); }
    function onKeyUp(e) { keys[e.key] = false; }

    function close() {
        if (runnerId) { global.cancelAnimationFrame(runnerId); runnerId = 0; }
        running = false;
        if (root) global.removeEventListener('keydown', onKey);
        if (root) global.removeEventListener('keyup', onKeyUp);
        if (root) global.removeEventListener('resize', resize);
        keys = {};
        TOUCH = { up: false, down: false, left: false, right: false };
        if (container) { try { container.innerHTML = ''; } catch (e) {} }
        container = null;
        root = null;
        canvas = null;
        ctx = null;
        state = null;
    }

    global.RCParking = { open: open, close: close };
})(window);
