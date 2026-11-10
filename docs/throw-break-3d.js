/* LessFun — Throw & Break 3D · throw objects and shatter them into pieces */
(function (global) {
    'use strict';

    var STYLE_ID = 'tb3Styles';
    var root = null;
    var container = null;
    var renderer = null;
    var scene = null;
    var camera = null;
    var world = null;
    var CANNON = null;
    var THREE = null;
    var runnerId = 0;
    var running = false;
    var score = { throws: 0, breaks: 0, points: 0 };
    var drag = null;
    var raycaster = null;
    var groundBody = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.tb3-wrap{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#7fb2f5 0%,#b3d0f5 38%,#e6ddc8 62%,#d9b688 100%);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;touch-action:none}
.tb3-wrap canvas{position:absolute;inset:0;display:block;touch-action:none}
.tb3-hud{position:absolute;top:10px;left:12px;right:12px;display:flex;gap:8px;align-items:center;justify-content:center;z-index:5;pointer-events:none;flex-wrap:wrap}
.tb3-hud .chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(16,26,44,.6);color:#fff;font-size:11px;font-weight:800;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:.04em}
.tb3-hud .chip b{font-size:13px;letter-spacing:-.02em}
.tb3-btns{position:absolute;top:52px;left:12px;right:12px;display:flex;gap:8px;z-index:6;pointer-events:auto}
.tb3-btn{flex:0 0 auto;padding:9px 14px;border:1px solid rgba(16,26,44,.2);border-radius:12px;background:rgba(255,255,255,.82);color:#16233c;font:inherit;font-size:11px;font-weight:800;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.tb3-note{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:5;padding:7px 13px;border-radius:999px;background:rgba(16,26,44,.6);color:rgba(255,255,255,.92);font-size:9.5px;font-weight:700;white-space:nowrap;pointer-events:none}
.tb3-toast{position:absolute;top:100px;left:50%;transform:translateX(-50%);z-index:6;padding:8px 14px;border-radius:999px;background:rgba(16,26,44,.7);color:#ffd75e;font-size:11px;font-weight:800;opacity:0;transition:opacity .25s;pointer-events:none}
.tb3-toast.is-visible{opacity:1}
`;
        document.head.appendChild(style);
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-tb3="' + src + '"]');
            if (existing) return resolve();
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.setAttribute('data-tb3', src);
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    function ensureLibs() {
        return loadScript('https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js')
            .then(function () { return loadScript('https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js'); })
            .then(function () {
                THREE = global.THREE;
                CANNON = global.CANNON;
            });
    }

    function log(msg) {
        var t = root && root.querySelector('.tb3-toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('is-visible');
        clearTimeout(t._t);
        t._t = setTimeout(function () { t.classList.remove('is-visible'); }, 1400);
    }

    function updateHUD() {
        if (!root) return;
        var items = root.querySelectorAll('[data-tb3-stat]');
        for (var i = 0; i < items.length; i++) {
            items[i].textContent = score[items[i].getAttribute('data-tb3-stat')];
        }
    }

    var dynamicItems = []; // { body, mesh, kind, look }

    function addDynamic(kind, three_mesh, cannon_body) {
        cannon_body.kind = kind;
        dynamicItems.push({ body: cannon_body, mesh: three_mesh, kind: kind });
        scene.add(three_mesh);
        world.add(cannon_body);
    }
    function removeDynamic(item) {
        scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        if (item.mesh.material.map) item.mesh.material.map.dispose();
        item.mesh.material.dispose();
        world.remove(item.body);
        var idx = dynamicItems.indexOf(item);
        if (idx >= 0) dynamicItems.splice(idx, 1);
    }

    var KIND_DEFS = {
        crate: { color: 0xb98a56, mass: 1.6, size: .9, breakPts: 10 },
        glass: { color: 0xbfe4ff, mass: .4, size: .55, breakPts: 14, transparent: true },
        pot:   { color: 0xc96f3d, mass: 2.2, size: .8, breakPts: 26 },
        melon: { color: 0x3f8a4d, mass: 2.4, size: .62, breakPts: 40 }
    };

    function makeTarget(kind, x, y, z) {
        var def = KIND_DEFS[kind];
        var geo;
        var mat;
        var shape;
        if (kind === 'glass') {
            geo = new THREE.BoxGeometry(def.size, def.size, .08);
            mat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true, opacity: .55 });
            shape = new CANNON.Box(new CANNON.Vec3(def.size / 2, def.size / 2, .04));
        } else if (kind === 'pot') {
            geo = new THREE.CylinderGeometry(.2, .16, def.size, 12);
            mat = new THREE.MeshLambertMaterial({ color: def.color });
            shape = new CANNON.Cylinder(.2, .16, def.size, 12);
        } else if (kind === 'melon') {
            geo = new THREE.SphereGeometry(def.size / 2, 18, 14);
            mat = new THREE.MeshLambertMaterial({ color: def.color });
            shape = new CANNON.Sphere(def.size / 2);
        } else {
            geo = new THREE.BoxGeometry(def.size, def.size, def.size);
            mat = new THREE.MeshLambertMaterial({ color: def.color });
            shape = new CANNON.Box(new CANNON.Vec3(def.size / 2, def.size / 2, def.size / 2));
        }
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        var body = new CANNON.Body({
            mass: def.mass,
            material: kind === 'glass' ? glassMat : defaultMat
        });
        body.addShape(shape);
        body.position.set(x, y, z);
        body._tb = { kind: kind, breakable: true, def: def };
        syncMeshToBody(mesh, body);
        mesh.userData.body = body;
        addDynamic(kind, mesh, body);
        return body;
    }

    function makePiece(kind, x, y, z, scale, hue) {
        var geo;
        var mat;
        var shape;
        if (kind === 'shard') {
            geo = new THREE.IcosahedronGeometry(.09 * scale, 0);
            mat = new THREE.MeshLambertMaterial({ color: 0xbfe4ff, transparent: true, opacity: .62 });
            shape = new CANNON.Sphere(.08 * scale);
        } else if (kind === 'seed') {
            geo = new THREE.SphereGeometry(.055 * scale, 8, 6);
            mat = new THREE.MeshLambertMaterial({ color: 0x243018 });
            shape = new CANNON.Sphere(.055 * scale);
        } else if (kind === 'melonslice') {
            geo = new THREE.BoxGeometry(.24 * scale, .1 * scale, .2 * scale);
            mat = new THREE.MeshLambertMaterial({ color: 0xe0604a });
            shape = new CANNON.Box(new CANNON.Vec3(.12 * scale, .05 * scale, .1 * scale));
        } else if (kind === 'potshard') {
            geo = new THREE.IcosahedronGeometry(.17 * scale, 0);
            mat = new THREE.MeshLambertMaterial({ color: 0xc96f3d });
            shape = new CANNON.Sphere(.15 * scale);
        } else {
            geo = new THREE.BoxGeometry(.5 * scale, .16 * scale, .3 * scale);
            mat = new THREE.MeshLambertMaterial({ color: hue || 0xa4773f });
            shape = new CANNON.Box(new CANNON.Vec3(.25 * scale, .08 * scale, .15 * scale));
        }
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        var body = new CANNON.Body({ mass: .12 * scale, material: defaultMat });
        body.addShape(shape);
        body.position.set(x, y, z);
        body._tb = { kind: 'piece', def: { breakPts: 9999 } };
        syncMeshToBody(mesh, body);
        addDynamic('piece', mesh, body);
        return body;
    }

    function syncMeshToBody(mesh, body) {
        if (body.quaternion && mesh && body.interpolatedPosition) {
            mesh.position.set(body.interpolatedPosition.x, body.interpolatedPosition.y, body.interpolatedPosition.z);
            mesh.quaternion.set(body.interpolatedQuaternion.x, body.interpolatedQuaternion.y, body.interpolatedQuaternion.z, body.interpolatedQuaternion.w);
        }
    }

    var defaultMat = null;
    var glassMat = null;
    var groundMat = null;

    function buildScene() {
        while (dynamicItems.length) removeDynamic(dynamicItems[dynamicItems.length - 1]);
        while (world.bodies.length > 1) world.remove(world.bodies[world.bodies.length - 1]);
        var startX = -5.4;
        // launch pile
        var kindsA = ['crate', 'crate', 'pot'];
        for (var i = 0; i < kindsA.length; i++) {
            var def = KIND_DEFS[kindsA[i]];
            makeTarget(kindsA[i], startX, 0.5 + i * .95, 0);
        }
        makeTarget('melon', startX + .6, 3.6, 0);
        var kindsB = ['glass', 'glass', 'glass'];
        for (var b = 0; b < kindsB.length; b++) {
            makeTarget(kindsB[b], startX + 2.4, .35 + b * .62, 0);
        }
        // glass wall right side
        for (var gy = 0; gy < 4; gy++) {
            for (var gx = 0; gx < 3; gx++) {
                makeTarget('glass', 4.2 + gx * .62, .32 + gy * .62, -1);
            }
        }
        // pots on top of the glass wall
        for (var p = 0; p < 3; p++) {
            makeTarget('pot', 4.5 + p * .62, 3.2, -1);
        }
        // crates tower
        for (var c = 0; c < 4; c++) {
            makeTarget('crate', -1.6, 0.5 + c * .95, -1);
        }
    }

    function breakBody(item, impact) {
        var body = item.body;
        if (!body._tb.breakable || body._breaking) return;
        body._breaking = true;
        var def = body._tb.def;
        score.breaks++;
        score.points += def.breakPts;
        updateHUD();
        var pos = body.position;
        var i, ang, dx, dz, py, pieceBody;
        if (body._tb.kind === 'glass') {
            for (i = 0; i < 6; i++) {
                ang = (i / 6) * Math.PI * 2;
                pieceBody = makePiece('shard', pos.x + Math.cos(ang) * .1, pos.y + Math.sin(ang) * .1, pos.z, 1);
                pieceBody.velocity.set(Math.cos(ang) * (1.4 + impact * .5), 1.6, Math.sin(ang) * (1.2 + impact * .4));
            }
        } else if (body._tb.kind === 'melon') {
            for (i = 0; i < 7; i++) {
                ang = (i / 7) * Math.PI * 2;
                pieceBody = makePiece('melonslice', pos.x + Math.cos(ang) * .18, pos.y + .05, pos.z + Math.sin(ang) * .18, 1);
                pieceBody.velocity.set(Math.cos(ang) * (1.8 + impact * .5), 2.1, Math.sin(ang) * (1.5 + impact * .4));
            }
            for (var s = 0; s < 6; s++) {
                pieceBody = makePiece('seed', pos.x + (s - 3) * .1, pos.y + .15, pos.z, 1);
                pieceBody.velocity.set((s - 3) * .8, 2.4, (Math.random() - .5) * .8);
            }
        } else if (body._tb.kind === 'pot') {
            for (i = 0; i < 3; i++) {
                ang = (i / 3) * Math.PI * 2;
                pieceBody = makePiece('potshard', pos.x + Math.cos(ang) * .12, pos.y, pos.z + Math.sin(ang) * .12, 1);
                pieceBody.velocity.set(Math.cos(ang) * 1.9, 1.4, Math.sin(ang) * 1.9);
            }
        } else {
            for (i = 0; i < 2; i++) {
                dx = i === 0 ? -.24 : .24;
                py = .02;
                pieceBody = makePiece('plank', pos.x + dx, pos.y + py, pos.z, 1, def.color);
                pieceBody.velocity.set(dx * 4, .8, (i === 0 ? -.6 : .6));
            }
        }
        // small outward pop on every piece (Pendulum & height/pop)
        for (var k = 0; k < dynamicItems.length; k++) {
            var it = dynamicItems[k];
            if (it.body._tb.kind === 'piece' && Math.abs(it.body.position.x - pos.x) < .6 && Math.abs(it.body.position.z - pos.z) < .6) {
                it.body.velocity.x *= 1.15;
                it.body.velocity.z *= 1.15;
            }
        }
        removeDynamic(item);
        if (score.breaks % 6 === 0) log(score.breaks + ' broke · ' + score.points + ' pts');
    }

    function onCollideUnused(ev) {
        var bodyA = null;
        var bodyB = null;
        var impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
        var items = dynamicItems.slice();
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.body === ev.body || it.body === ev.target) {
                var other = it.body === ev.body ? ev.target : ev.body;
                if (it.body._tb.breakable && !it.body._tb.kind === false) {}
                if (it.body._tb.breakable && (other._tb || other === groundBody)) {
                    var threshold = it.body._tb.kind === 'glass' ? 3.4 : it.body._tb.kind === 'melon' ? 4.6 : 5.6;
                    if (impact > threshold) breakBody(it, impact);
                }
            }
        }
    }

    function syncAll() {
        for (var i = 0; i < dynamicItems.length; i++) {
            var it = dynamicItems[i];
            if (drag && drag.body === it.body) {
                it.body.velocity.set(0, 0, 0);
            }
            syncMeshToBody(it.mesh, it.body);
            if (it.body.position.y < -6) {
                if (it.body._tb.kind === 'piece') {
                    removeDynamic(it);
                    i--;
                }
            }
        }
    }

    function onResize() {
        if (!root) return;
        var r = root.getBoundingClientRect();
        var w = Math.round(r.width), h = Math.round(r.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, true);
        var dpr = global.devicePixelRatio || 1;
        renderer.setPixelRatio(Math.min(1.5, dpr));
    }

    function pointerNdc(e) {
        var c = renderer.domElement.getBoundingClientRect();
        return { x: ((e.clientX - c.left) / c.width) * 2 - 1, y: -((e.clientY - c.top) / c.height) * 2 + 1 };
    }
    function pickThrowable(ndc) {
        raycaster.setFromCamera(ndc, camera);
        var meshes = [];
        for (var i = 0; i < dynamicItems.length; i++) {
            if (dynamicItems[i].body._tb.breakable) meshes.push(dynamicItems[i].mesh);
        }
        var hits = raycaster.intersectObjects(meshes, false);
        for (var j = 0; j < hits.length; j++) {
            if (hits[j].object.userData.body) return hits[j].object.userData.body;
        }
        return null;
    }

    function onDown(e) {
        if (!world || drag) return;
        var ndc = pointerNdc(e);
        var body = pickThrowable(ndc);
        if (!body) return;
        drag = { body: body, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, grabPlaneZ: body.position.z };
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
        if (!drag) return;
        drag.x = e.clientX;
        drag.y = e.clientY;
        // teleport the body along the view plane so the object follows the cursor
        var ndc = pointerNdc(e);
        raycaster.setFromCamera(ndc, camera);
        var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -drag.grabPlaneZ);
        var p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, p)) {
            var b = drag.body;
            b.position.set(p.x, p.y, drag.grabPlaneZ);
            b.velocity.set(0, 0, 0);
        }
        if (e.cancelable) e.preventDefault();
    }
    function onUp() {
        if (!drag) return;
        var dx = drag.x - drag.sx, dy = drag.y - drag.sy;
        var power = Math.hypot(dx, dy);
        if (power > 24) {
            var speed = Math.min(16, power / 34);
            var dirX = dx / power, dirY = dy / power;
            var b = drag.body;
            // right on screen, up on screen, plus forward arc
            b.velocity.set(dirX * speed, dirY * speed + speed * .35, -speed * .45);
            b.angularVelocity.set((dirY || .1) * 2, 0, -(dirX || .1) * 2);
            b._tb.thrown = true;
            score.throws++;
            updateHUD();
        }
        drag = null;
    }

    function render() {
        renderer.render(scene, camera);
    }

    function loop() {
        if (!running) return;
        if (world) {
            world.step(1 / 60, 1 / 60, 3);
            syncAll();
            render();
        }
        runnerId = global.requestAnimationFrame(loop);
    }

    function refill() {
        buildScene();
        log('Targets refilled');
    }
    function reset() {
        score = { throws: 0, breaks: 0, points: 0 };
        updateHUD();
        buildScene();
        log('Arena reset');
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML =
            '<div class="tb3-wrap">' +
                '<div class="tb3-hud"><span class="chip">THROWS <b data-tb3-stat="throws">0</b></span><span class="chip">BROKE <b data-tb3-stat="breaks">0</b></span><span class="chip">SCORE <b data-tb3-stat="points">0</b></span></div>' +
                '<div class="tb3-btns"><button type="button" class="tb3-btn" data-refill>REFILL TARGETS</button><button type="button" class="tb3-btn" data-reset>RESET</button></div>' +
                '<div class="tb3-toast"></div>' +
                '<div class="tb3-note">Drag a crate, melon, glass or pot to wind up · release to throw</div>' +
            '</div>';
        root = el.querySelector('.tb3-wrap');
        updateHUD();
        return ensureLibs().then(function () {
            if (!root) return;
            var r = root.getBoundingClientRect();
            var w = Math.round(r.width), h = Math.round(r.height);
            var dpr = Math.min(1.5, global.devicePixelRatio || 1);
            renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
            renderer.setSize(w, h, true);
            renderer.setPixelRatio(dpr);
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.inset = '0';
            renderer.domElement.style.touchAction = 'none';
            root.appendChild(renderer.domElement);
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog(0xb8d4f0, 24, 46);
            camera = new THREE.PerspectiveCamera(52, w / h, .1, 100);
            camera.position.set(0, 4.6, 14.5);
            camera.lookAt(new THREE.Vector3(0, 2.4, -1));
            raycaster = new THREE.Raycaster();
            var hemi = new THREE.HemisphereLight(0xfff4e0, 0x5a4632, .9);
            scene.add(hemi);
            var dir = new THREE.DirectionalLight(0xffffff, .8);
            dir.position.set(-6, 12, 8);
            scene.add(dir);
            // ground
            var ground = new THREE.Mesh(new THREE.BoxGeometry(60, .4, 30), new THREE.MeshLambertMaterial({ color: 0xc9a468 }));
            ground.position.set(0, -0.4, 0);
            scene.add(ground);
            // physics
            world = new CANNON.World();
            world.gravity.set(0, -9.82, 0);
            defaultMat = new CANNON.Material('default');
            glassMat = new CANNON.Material('glass');
            groundMat = new CANNON.Material('ground');
            var groundBody = new CANNON.Body({ mass: 0, material: groundMat });
            groundBody.addShape(new CANNON.Plane());
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            groundBody.position.set(0, -0.2, 0);
            groundBody._tb = { breakable: false };
            world.add(groundBody);
            // back stopper wall
            var stopper = new CANNON.Body({ mass: 0, material: groundMat });
            stopper.addShape(new CANNON.Plane());
            stopper.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            stopper.position.set(0, 0, -4);
            stopper._tb = { breakable: false };
            world.add(stopper);
            // contact softening
            world.defaultContactMaterial.friction = .35;
            world.defaultContactMaterial.restitution = .28;
            score = { throws: 0, breaks: 0, points: 0 };
            updateHUD();
            // events
            renderer.domElement.addEventListener('pointerdown', onDown);
            renderer.domElement.addEventListener('pointermove', onMove, { passive: false });
            renderer.domElement.addEventListener('pointerup', onUp);
            renderer.domElement.addEventListener('pointercancel', onUp);
            root.querySelector('[data-refill]').addEventListener('click', refill);
            root.querySelector('[data-reset]').addEventListener('click', reset);
            buildScene();
            world.addEventListener('collide', function (ev2) {
                if (!ev2 || !ev2.contact) return;
                var impact = Math.abs(ev2.contact.getImpactVelocityAlongNormal());
                for (var i = 0; i < dynamicItems.length; i++) {
                    var it = dynamicItems[i];
                    if (it.body === ev2.body || it.body === ev2.target) {
                        if (it.body._tb.breakable) {
                            var threshold = it.body._tb.kind === 'glass' ? 3.2 : it.body._tb.kind === 'melon' ? 4.4 : 5.4;
                            if (impact > threshold) breakBody(it, impact);
                        }
                        break;
                    }
                }
            });
            running = true;
            runnerId = global.requestAnimationFrame(loop);
            updateHUD();
        }).catch(function () {
            if (root) log('Could not load the 3D engine. Check your connection.');
        });
    }

    function close() {
        if (runnerId) { global.cancelAnimationFrame(runnerId); runnerId = 0; }
        running = false;
        if (renderer) {
            try { if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {}
            try { renderer.dispose(); } catch (e) {}
            var el = renderer.domElement;
            if (el && el.parentNode) el.parentNode.removeChild(el);
            renderer = null;
        }
        while (dynamicItems.length) removeDynamic(dynamicItems[dynamicItems.length - 1]);
        world = null;
        scene = null;
        camera = null;
        drag = null;
        container = null;
        root = null;
    }

    global.ThrowBreak = {
        open: open,
        close: close,
        _debug: function () {
            var out = [];
            for (var i = 0; i < dynamicItems.length; i++) {
                var it = dynamicItems[i];
                var v = it.mesh.position.clone();
                v.project(camera);
                out.push({ kind: it.body._tb.kind, x: v.x, y: v.y, z: it.body.position.z, wx: it.body.position.x, wy: it.body.position.y });
            }
            return { items: dynamicItems.length, bodies: world ? world.bodies.length : -1, projected: out };
        }
    };
})(window);
