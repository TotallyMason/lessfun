/* LessFun — Real 3D arcade games powered by Three.js */
(function (global) {
    'use strict';

    var input = {
        left: false, right: false, up: false, down: false, brake: false,
        pointerActive: false, pointerX: 0, pointerY: 0, tapQueued: false
    };

    var renderer = null, scene = null, camera = null;
    var container = null, resizeObs = null;
    var raf = 0, clock = null;
    var active = null;
    var cleanupFns = [];
    var gameMeta = { name: 'Game', onScore: null, onGameOver: null };
    var running = false;

    function addCleanup(fn) { cleanupFns.push(fn); }

    function listen(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        addCleanup(function () { target.removeEventListener(type, fn, opts); });
    }

    function disposeObject(obj) {
        if (!obj) return;
        obj.traverse(function (child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(function (m) { m.dispose(); });
                else child.material.dispose();
            }
        });
    }

    function neon(color, intensity) {
        return new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: intensity == null ? 1.2 : intensity,
            metalness: 0.4,
            roughness: 0.35
        });
    }

    function setHud(score, extra) {
        var s = document.getElementById('g3dScore');
        if (s) s.textContent = Math.round(score);
        var e = document.getElementById('g3dExtra');
        if (e && extra !== undefined) e.textContent = extra;
    }

    function endGame(score) {
        if (!active || active.over) return;
        active.over = true;
        var rounded = Math.round(score);
        try { if (gameMeta.onScore) gameMeta.onScore(gameMeta.name, rounded); } catch (e) {}
        try { if (gameMeta.onGameOver) gameMeta.onGameOver(rounded); } catch (e) {}
    }

    /* ---------------- Neon Racer ---------------- */
    function createRacer(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        scene.fog = new THREE.FogExp2(0x05020c, 0.013);
        camera.position.set(0, 4.4, 10.5);
        camera.lookAt(0, 1.1, -20);

        scene.add(new THREE.AmbientLight(0x8a8aff, 1.1));
        var sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(6, 16, 10); scene.add(sun);
        var pl = new THREE.PointLight(0xff2fd0, 3.2, 80); pl.position.set(-8, 5, 4); scene.add(pl);
        var pr = new THREE.PointLight(0x2ff6ff, 3.2, 80); pr.position.set(8, 5, -8); scene.add(pr);

        var LANES = [-3.2, 0, 3.2];
        var ROAD_W = 11.4;

        var road = new THREE.Mesh(
            new THREE.BoxGeometry(ROAD_W, 0.5, 460),
            new THREE.MeshStandardMaterial({ color: 0x0a0a16, metalness: 0.6, roughness: 0.4 })
        );
        road.position.set(0, -0.25, -220); scene.add(road);

        var railMat = neon(0xff2fd0, 1.6);
        var railL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 460), railMat);
        railL.position.set(-ROAD_W / 2, 0.5, -220); scene.add(railL);
        var railR = railL.clone(); railR.position.x = ROAD_W / 2; scene.add(railR);

        // Dashed lane dividers, one set per lane boundary.
        var dashMat = neon(0xf5f5ff, 0.9);
        var dashes = [];
        [-1.6, 1.6].forEach(function (lx) {
            for (var i = 0; i < 46; i++) {
                var d = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 2.6), dashMat);
                d.position.set(lx, 0.03, -i * 10);
                scene.add(d); dashes.push(d);
            }
        });

        var edgeMat = neon(0x2ff6ff, 1.8);
        var edges = [];
        for (var j = 0; j < 27; j++) {
            var e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 4), edgeMat);
            e.position.set((j % 2 === 0 ? -1 : 1) * (ROAD_W / 2 - 0.4), 0.05, -j * 14);
            scene.add(e); edges.push(e);
        }

        var starGeo = new THREE.BufferGeometry();
        var starPos = [];
        for (var s = 0; s < 650; s++) starPos.push((Math.random() - 0.5) * 190, Math.random() * 70 + 8, -Math.random() * 300 - 20);
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 })));

        function buildCar(bodyColor, glowColor) {
            var g = new THREE.Group();
            var body = new THREE.Mesh(
                new THREE.BoxGeometry(1.7, 0.5, 3.0),
                new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.25, emissive: bodyColor, emissiveIntensity: 0.25 })
            );
            body.position.y = 0.6; g.add(body);

            var cabin = new THREE.Mesh(
                new THREE.BoxGeometry(1.15, 0.5, 1.4),
                new THREE.MeshStandardMaterial({ color: 0x07070d, metalness: 0.9, roughness: 0.1 })
            );
            cabin.position.set(0, 1.0, -0.1); g.add(cabin);

            var wheelMat = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.9 });
            [[-0.9, 0.95], [0.9, 0.95], [-0.9, -0.95], [0.9, -0.95]].forEach(function (p) {
                var w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 14), wheelMat);
                w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.35, p[1]); g.add(w);
            });

            var under = new THREE.Mesh(
                new THREE.BoxGeometry(2.0, 0.07, 3.2),
                new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.85 })
            );
            under.position.y = 0.12; g.add(under);

            // Amber indicator lamps on the corners that face the player. They
            // blink for 1-3 seconds before the car actually moves over.
            var lampGeo = new THREE.SphereGeometry(0.15, 8, 8);
            var lampMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
            var lampL = new THREE.Mesh(lampGeo, lampMat);
            lampL.position.set(-0.74, 0.68, 1.46); lampL.visible = false; g.add(lampL);
            var lampR = new THREE.Mesh(lampGeo, lampMat);
            lampR.position.set(0.74, 0.68, 1.46); lampR.visible = false; g.add(lampR);
            g.userData.leftLamp = lampL;
            g.userData.rightLamp = lampR;
            return g;
        }

        var player = buildCar(0xff2fd0, 0x2ff6ff);
        player.position.set(0, 0, 5);
        scene.add(player);

        // Rear brake lights facing the chase camera.
        var brakeMat = new THREE.MeshBasicMaterial({ color: 0x5a1018 });
        [-0.55, 0.55].forEach(function (lx) {
            var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.06), brakeMat);
            lamp.position.set(lx, 0.78, 1.52);
            player.add(lamp);
        });

        var traffic = [];
        var colors = [0x2ff6ff, 0xffd166, 0x9b5cff, 0x22c55e, 0xff7a4d];

        function laneBusy(lane, self, z, range) {
            for (var i = 0; i < traffic.length; i++) {
                var o = traffic[i];
                if (o === self) continue;
                if (Math.abs(o.position.z - z) > range) continue;
                if (o.userData.lane === lane || o.userData.targetLane === lane) return true;
            }
            return false;
        }

        function spawnTraffic(forceZ) {
            var z = forceZ != null ? forceZ : (-230 - Math.random() * 70);
            var order = [0, 1, 2];
            order.sort(function () { return Math.random() - 0.5; });
            var lane = order[0];
            for (var i = 0; i < order.length; i++) {
                if (!laneBusy(order[i], null, z, 16)) { lane = order[i]; break; }
            }
            var car = buildCar(colors[Math.floor(Math.random() * colors.length)], 0xffffff);
            car.position.set(LANES[lane], 0, z);
            var u = car.userData;
            u.lane = lane;
            u.targetLane = lane;
            u.state = 'cruise';
            u.signal = 0;
            u.signalT = 0;
            u.blinkT = 0;
            u.changeT = 0;
            u.fromX = LANES[lane];
            u.toX = LANES[lane];
            u.decisionT = 1.5 + Math.random() * 3.5;
            u.approach = 0.9 + Math.random() * 0.25;
            scene.add(car);
            traffic.push(car);
        }

        for (var t = 0; t < 6; t++) spawnTraffic(-120 - t * 34);

        function blink(car, side) {
            var u = car.userData;
            var on = (u.blinkT * 4.8) % 1 < 0.55;
            u.leftLamp.visible = on && side < 0;
            u.rightLamp.visible = on && side > 0;
        }

        function clearBlink(car) {
            car.userData.leftLamp.visible = false;
            car.userData.rightLamp.visible = false;
        }

        var distance = 0, speed = 42, elapsed = 0, spawnT = 0;
        var maxX = ROAD_W / 2 - 1.3;
        var steerX = 0;

        function update(dt) {
            elapsed += dt;

            // Rising top speed, but the brake can dump it fast.
            var baseSpeed = Math.min(42 + elapsed * 1.3, 98);
            if (input.brake) speed = Math.max(10, speed - 72 * dt);
            else speed = Math.min(baseSpeed, speed + 10 * dt);
            distance += speed * dt;

            // Free steering: slide anywhere across the road, not fixed lanes.
            var steerInput = 0;
            if (input.left) steerInput -= 1;
            if (input.right) steerInput += 1;
            if (input.pointerActive) {
                steerX = Math.max(-maxX, Math.min(maxX, input.pointerX * maxX * 1.08));
            } else {
                steerX += steerInput * dt * 9.5;
                steerX = Math.max(-maxX, Math.min(maxX, steerX));
            }

            var beforeX = player.position.x;
            player.position.x += (steerX - player.position.x) * Math.min(1, dt * 10);
            player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x));
            var vx = (player.position.x - beforeX) / (dt || 0.016);

            // Nose points into the turn, body banks, and the car dips on brakes.
            player.rotation.y = Math.max(-0.42, Math.min(0.42, vx * 0.045));
            player.rotation.z = Math.max(-0.2, Math.min(0.2, -vx * 0.022));
            player.rotation.x = (input.brake ? 0.035 : 0) + Math.max(-0.03, Math.min(0.03, -vx * 0.002));
            brakeMat.color.setHex(input.brake ? 0xff2438 : 0x5a1018);

            for (var i = 0; i < dashes.length; i++) {
                dashes[i].position.z += speed * dt;
                if (dashes[i].position.z > 12) dashes[i].position.z -= 460;
            }
            for (var i2 = 0; i2 < edges.length; i2++) {
                edges[i2].position.z += speed * dt;
                if (edges[i2].position.z > 12) edges[i2].position.z -= 378;
            }

            spawnT += dt;
            if (spawnT > Math.max(0.62, 1.35 - elapsed * 0.01)) { spawnT = 0; spawnTraffic(); }

            var relative = Math.min(0.42 + elapsed * 0.0045, 0.74);

            for (var k = traffic.length - 1; k >= 0; k--) {
                var c = traffic[k];
                var u = c.userData;

                if (u.state === 'cruise') {
                    u.decisionT -= dt;
                    if (u.decisionT <= 0) {
                        var choices = [];
                        if (u.lane > 0 && !laneBusy(u.lane - 1, c, c.position.z, 11)) choices.push(-1);
                        if (u.lane < LANES.length - 1 && !laneBusy(u.lane + 1, c, c.position.z, 11)) choices.push(1);
                        if (choices.length) {
                            u.signal = choices[Math.floor(Math.random() * choices.length)];
                            u.signalT = 1 + Math.random() * 2; // 1-3 second warning
                            u.targetLane = u.lane + u.signal;
                            u.blinkT = 0;
                            u.state = 'signal';
                        } else {
                            u.decisionT = 0.8 + Math.random() * 1.6;
                        }
                    }
                } else if (u.state === 'signal') {
                    u.signalT -= dt;
                    u.blinkT += dt;
                    blink(c, u.signal);
                    if (u.signalT <= 0) {
                        u.state = 'change';
                        u.changeT = 0;
                        u.fromX = LANES[u.lane];
                        u.targetLane = u.lane + u.signal;
                        u.toX = LANES[u.targetLane];
                    }
                } else if (u.state === 'change') {
                    u.changeT += dt;
                    var p = Math.min(1, u.changeT / 0.75);
                    var ease = p * p * (3 - 2 * p);
                    c.position.x = u.fromX + (u.toX - u.fromX) * ease;
                    c.rotation.y = (u.toX - u.fromX) * -0.06 * Math.sin(p * Math.PI);
                    c.rotation.z = (u.toX - u.fromX) * 0.035 * Math.sin(p * Math.PI);
                    u.blinkT += dt;
                    blink(c, u.toX > u.fromX ? 1 : -1);
                    if (p >= 1) {
                        c.position.x = u.toX;
                        c.rotation.y = 0;
                        c.rotation.z = 0;
                        u.lane = u.targetLane;
                        u.state = 'cruise';
                        u.signal = 0;
                        u.signalT = 0;
                        clearBlink(c);
                        u.decisionT = 1.8 + Math.random() * 3.2;
                    }
                }

                c.position.z += speed * relative * dt * u.approach;

                if (c.position.z > 14) {
                    scene.remove(c); disposeObject(c); traffic.splice(k, 1); continue;
                }
                if (Math.abs(c.position.x - player.position.x) < 1.45 && Math.abs(c.position.z - player.position.z) < 2.75) {
                    endGame(distance);
                    return;
                }
            }

            var fov = 62 + Math.min(12, speed * 0.10);
            if (Math.abs(camera.fov - fov) > 0.1) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }

            camera.position.x += (player.position.x * 0.42 - camera.position.x) * Math.min(1, dt * 5);
            camera.lookAt(player.position.x * 0.5 + vx * 0.22, 1.1, -20);
            setHud(distance, (input.brake ? 'BRAKE · ' : '') + Math.round(speed * 3.6) + ' km/h');
        }

        return { over: false, update: update };
    }

    /* ---------------- Tunnel Rush ---------------- */
    function createTunnel(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        // Wide-open visibility: light fog and a wide FOV so rings/gaps are readable.
        scene.fog = new THREE.FogExp2(0x05010f, 0.010);
        camera.position.set(0, 0, 0);
        camera.fov = 80;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, -20);

        scene.add(new THREE.AmbientLight(0x9090ff, 1.3));
        var lp = new THREE.PointLight(0xff2fd0, 3, 90); lp.position.set(0, 0, -6); scene.add(lp);
        var lp2 = new THREE.PointLight(0x2ff6ff, 2.5, 90); lp2.position.set(0, 0, -34); scene.add(lp2);

        var R = 3.0, orbitR = 1.9;
        var ringMat = neon(0x2ff6ff, 1.5);
        var rings = [];
        var RING_COUNT = 32, RING_SPACING = 5;
        for (var i = 0; i < RING_COUNT; i++) {
            var ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 48), ringMat);
            ring.position.z = -(i + 1) * RING_SPACING;
            scene.add(ring); rings.push(ring);
        }

        var stripMat = neon(0x9b5cff, 0.8);
        for (var k = 0; k < 8; k++) {
            var a = k / 8 * Math.PI * 2;
            var strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 170), stripMat);
            strip.position.set(Math.cos(a) * R, Math.sin(a) * R, -85);
            strip.rotation.z = a;
            scene.add(strip);
        }

        var ship = new THREE.Group();
        var hull = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 4), neon(0xff2fd0, 1.4));
        hull.rotation.x = -Math.PI / 2; ship.add(hull);
        var flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 6), new THREE.MeshBasicMaterial({ color: 0x2ff6ff, transparent: true, opacity: 0.9 }));
        flame.rotation.x = Math.PI / 2; flame.position.z = 0.75; ship.add(flame);
        ship.position.set(orbitR, 0, -3);
        scene.add(ship);

        var obstacles = [];
        var SEG_N = 24, GAP_HALF = 0.9; // ~103 degree opening
        var obstacleMat = neon(0xff2fd0, 1.2);

        function spawnObstacle() {
            var gapCenter = Math.random() * Math.PI * 2;
            var grp = new THREE.Group();
            for (var i = 0; i < SEG_N; i++) {
                var a = i / SEG_N * Math.PI * 2;
                var d = Math.atan2(Math.sin(a - gapCenter), Math.cos(a - gapCenter));
                if (Math.abs(d) < GAP_HALF) continue;
                var block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.1), obstacleMat);
                block.position.set(Math.cos(a) * orbitR, Math.sin(a) * orbitR, 0);
                block.rotation.z = a;
                grp.add(block);
            }
            grp.position.z = -70;
            grp.userData.gapCenter = gapCenter;
            grp.userData.checked = false;
            scene.add(grp); obstacles.push(grp);
        }
        // NOTE: only one gate at a time. Two gates spawned at the same z had
        // different gaps, so their blocks combined into a solid ring.
        spawnObstacle();

        var angle = 0, elapsed = 0, speed = 20, spawnT = 0;

        function update(dt) {
            elapsed += dt;
            speed = Math.min(20 + elapsed * 0.6, 52);
            spawnT += dt;
            if (spawnT > Math.max(1.4, 2.6 - elapsed * 0.02)) { spawnT = 0; spawnObstacle(); }

            var steer = 0;
            if (input.left) steer -= 1;
            if (input.right) steer += 1;
            if (input.pointerActive) steer = input.pointerX;
            angle += steer * dt * 2.8;

            ship.position.set(Math.cos(angle) * orbitR, Math.sin(angle) * orbitR, -3);
            ship.rotation.z = angle;

            for (var i = 0; i < rings.length; i++) {
                rings[i].position.z += speed * dt;
                if (rings[i].position.z > 10) rings[i].position.z -= RING_COUNT * RING_SPACING;
            }

            for (var o = obstacles.length - 1; o >= 0; o--) {
                var grp = obstacles[o];
                grp.position.z += speed * dt;
                if (grp.position.z > 10) { scene.remove(grp); disposeObject(grp); obstacles.splice(o, 1); continue; }
                if (!grp.userData.checked && grp.position.z > -3.8) {
                    grp.userData.checked = true;
                    var d = Math.atan2(Math.sin(angle - grp.userData.gapCenter), Math.cos(angle - grp.userData.gapCenter));
                    // Generous safe window; only the solid blocks are fatal.
                    if (Math.abs(d) > GAP_HALF - 0.08) { endGame(elapsed * 10); return; }
                }
            }

            setHud(elapsed * 10, Math.round(speed * 3.6) + ' km/h');
        }

        return { over: false, update: update };
    }

    /* ---------------- Cube Stack ---------------- */
    function createStack(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        scene.fog = new THREE.FogExp2(0x07030f, 0.02);
        camera.position.set(7, 7, 11);

        scene.add(new THREE.AmbientLight(0x8a8aff, 1.2));
        var sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(6, 14, 8); scene.add(sun);
        var pk = new THREE.PointLight(0xff2fd0, 2.5, 40); pk.position.set(-6, 6, 6); scene.add(pk);
        var cy = new THREE.PointLight(0x2ff6ff, 2.5, 40); cy.position.set(6, 4, -6); scene.add(cy);

        var SIZE = 3.4, H = 0.55;
        var towerY = 0, width = SIZE, placed = 0;
        var prev = { x: 0, w: SIZE };

        function makeBox(w, x, y, color, emissive) {
            var geo = new THREE.BoxGeometry(w, H, SIZE);
            var hue = ((y * 0.07) % 1 + 1) % 1;
            var col = color != null ? color : new THREE.Color().setHSL(hue, 0.72, 0.55).getHex();
            var em = emissive != null ? emissive : col;
            var mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.35, roughness: 0.32, emissive: em, emissiveIntensity: 0.55 });
            var m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, 0); scene.add(m); return m;
        }

        makeBox(SIZE, 0, H / 2);
        towerY = H;
        prev = { x: 0, w: SIZE };

        var moving = makeBox(SIZE, 0, towerY + H / 2, 0x2ff6ff, 0x2ff6ff);
        moving.material.emissiveIntensity = 1.1;

        var t = 0, speed = 1.5;

        function update(dt) {
            t += dt;
            var range = SIZE * 0.95;
            var raw = (t * speed) % (range * 2);
            var x = (raw < range ? raw : range * 2 - raw) - range;
            moving.position.x = x;

            if (input.tapQueued) {
                input.tapQueued = false;
                var left = Math.max(prev.x - prev.w / 2, x - width / 2);
                var right = Math.min(prev.x + prev.w / 2, x + width / 2);
                var overlap = right - left;
                if (overlap <= 0.08) { endGame(placed); return; }
                var nw = overlap, nx = (left + right) / 2;
                moving.geometry.dispose();
                moving.geometry = new THREE.BoxGeometry(nw, H, SIZE);
                moving.position.set(nx, towerY + H / 2, 0);
                moving.material.color.set(0x9b5cff);
                moving.material.emissive.set(0x9b5cff);
                moving.material.emissiveIntensity = 0.6;

                placed++;
                towerY += H;
                prev = { x: nx, w: nw };
                width = nw;

                if (nw < 0.34) { endGame(placed); return; }
                moving = makeBox(nw, 0, towerY + H / 2, 0x2ff6ff, 0x2ff6ff);
                moving.material.emissiveIntensity = 1.1;
                speed = Math.min(1.5 + placed * 0.09, 3.6);
            }

            var camY = towerY + 6.5;
            camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 3);
            camera.lookAt(0, towerY + 0.3, 0);
            setHud(placed, 'Height ' + placed);
        }

        return { over: false, update: update };
    }

    /* ---------------- Helix Drop ---------------- */
    function createHelix(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        scene.fog = new THREE.FogExp2(0x05020c, 0.025);
        camera.position.set(0, 7, 10);

        scene.add(new THREE.AmbientLight(0x8a8aff, 1.1));
        var sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(6, 12, 8); scene.add(sun);

        var R = 2.8, SEG = 22, GAP_SEG = 6;
        var gapHalf = (GAP_SEG / SEG) * Math.PI;
        var group = new THREE.Group(); scene.add(group);

        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 180, 12), neon(0x9b5cff, 0.8));
        pole.position.y = -80; group.add(pole);

        var rings = [];
        var ringMat = neon(0x2ff6ff, 1.3);
        var RING_GAP = 3.2, RING_COUNT = 46, ringYStart = -2;
        for (var i = 0; i < RING_COUNT; i++) {
            var y = ringYStart - i * RING_GAP;
            var gapCenter = Math.random() * Math.PI * 2;
            var ring = new THREE.Group();
            for (var k = 0; k < SEG; k++) {
                var a = k / SEG * Math.PI * 2;
                var d = Math.atan2(Math.sin(a - gapCenter), Math.cos(a - gapCenter));
                if (Math.abs(d) < gapHalf) continue;
                var seg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.7), ringMat);
                seg.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
                seg.rotation.y = -a;
                ring.add(seg);
            }
            ring.position.y = y;
            ring.userData.gap = gapCenter;
            group.add(ring); rings.push(ring);
        }

        var ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), neon(0xff2fd0, 1.4));
        ball.position.set(R, 1.5, 0);
        scene.add(ball);

        var ballY = 1.5, speed = 6, passed = 0, nextRing = 0, groupRot = 0, targetRot = 0;

        function angDist(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

        function update(dt) {
            speed = Math.min(5 + passed * 0.12, 15);
            ballY -= speed * dt;
            ball.position.y = ballY;

            var steer = 0;
            if (input.left) steer -= 1;
            if (input.right) steer += 1;
            if (input.pointerActive) steer = input.pointerX;
            targetRot += steer * dt * 3.2;
            groupRot += (targetRot - groupRot) * Math.min(1, dt * 12);
            group.rotation.y = groupRot;

            while (nextRing < rings.length && ballY <= rings[nextRing].position.y + 0.14) {
                var worldGap = rings[nextRing].userData.gap - groupRot;
                var d = Math.abs(angDist(0, worldGap));
                if (d > gapHalf - 0.06) { endGame(passed); return; }
                passed++;
                nextRing++;
            }

            camera.position.y += ((ballY + 6) - camera.position.y) * Math.min(1, dt * 3);
            camera.lookAt(0, ballY - 1.5, 0);

            setHud(passed, 'Depth ' + Math.max(0, Math.round(-ballY)) + 'm');
            if (ballY < rings[rings.length - 1].position.y - 8) endGame(passed);
        }

        return { over: false, update: update };
    }

    /* ---------------- Star Dodger ---------------- */
    function createSky(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        scene.fog = new THREE.FogExp2(0x03030c, 0.012);
        camera.position.set(0, 1.6, 7);

        scene.add(new THREE.AmbientLight(0x8888cc, 1.0));
        var sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(4, 8, 6); scene.add(sun);
        var p = new THREE.PointLight(0x2ff6ff, 3, 50); p.position.set(0, 2, 2); scene.add(p);

        var starGeo = new THREE.BufferGeometry();
        var sp = [];
        for (var i = 0; i < 800; i++) sp.push((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 120, -Math.random() * 300 - 10);
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb8ff, size: 0.45, transparent: true, opacity: 0.9 })));

        var ship = new THREE.Group();
        var hull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 5), neon(0x2ff6ff, 1.2));
        hull.rotation.x = -Math.PI / 2; ship.add(hull);
        var core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), neon(0xff2fd0, 1.6));
        core.position.z = 0.1; ship.add(core);
        var wings = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), neon(0x9b5cff, 1.0));
        wings.position.z = 0.5; ship.add(wings);
        scene.add(ship);

        var obstacles = [], orbs = [];
        var rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5b8a, metalness: 0.2, roughness: 0.9, emissive: 0x2a1f3d, emissiveIntensity: 0.6 });
        var orbMat = neon(0xffd166, 1.8);

        function spawnRock() {
            var r = 0.7 + Math.random() * 1.1;
            var m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
            m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, -110 - Math.random() * 40);
            m.userData.r = r;
            m.userData.spin = (Math.random() - 0.5) * 2;
            scene.add(m); obstacles.push(m);
        }
        function spawnOrb() {
            var m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 20), orbMat);
            m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, -90 - Math.random() * 60);
            scene.add(m); orbs.push(m);
        }
        for (var a = 0; a < 5; a++) spawnRock();
        for (var b = 0; b < 3; b++) spawnOrb();

        var elapsed = 0, speed = 26, spawnT = 0, orbT = 0, score = 0;

        function update(dt) {
            elapsed += dt;
            speed = Math.min(26 + elapsed * 1.1, 72);
            score += dt * 10;

            var tx = ship.position.x, ty = ship.position.y;
            if (input.left) tx -= dt * 14;
            if (input.right) tx += dt * 14;
            if (input.up) ty += dt * 14;
            if (input.down) ty -= dt * 14;
            if (input.pointerActive) { tx = input.pointerX * 8; ty = -input.pointerY * 5; }
            if (tx < -8) tx = -8; if (tx > 8) tx = 8;
            if (ty < -5) ty = -5; if (ty > 5) ty = 5;
            ship.position.x += (tx - ship.position.x) * Math.min(1, dt * 7);
            ship.position.y += (ty - ship.position.y) * Math.min(1, dt * 7);
            ship.rotation.z = (tx - ship.position.x) * -0.35;
            ship.rotation.x = (ty - ship.position.y) * 0.25;

            spawnT += dt;
            if (spawnT > Math.max(0.32, 0.9 - elapsed * 0.008)) { spawnT = 0; spawnRock(); }
            orbT += dt;
            if (orbT > 1.6) { orbT = 0; spawnOrb(); }

            for (var i = obstacles.length - 1; i >= 0; i--) {
                var o = obstacles[i];
                o.position.z += speed * dt;
                o.rotation.x += o.userData.spin * dt;
                o.rotation.y += o.userData.spin * dt * 0.7;
                if (o.position.z > 10) { scene.remove(o); obstacles.splice(i, 1); continue; }
                var dx = o.position.x - ship.position.x;
                var dy = o.position.y - ship.position.y;
                var dz = o.position.z - ship.position.z;
                var rad = o.userData.r + 0.7;
                if (dx * dx + dy * dy + dz * dz < rad * rad) { endGame(score); return; }
            }
            for (var k = orbs.length - 1; k >= 0; k--) {
                var ob = orbs[k];
                ob.position.z += speed * dt;
                ob.rotation.y += dt * 3;
                if (ob.position.z > 10) { scene.remove(ob); orbs.splice(k, 1); continue; }
                var ox = ob.position.x - ship.position.x;
                var oy = ob.position.y - ship.position.y;
                var oz = ob.position.z - ship.position.z;
                if (ox * ox + oy * oy + oz * oz < 2.2) { scene.remove(ob); orbs.splice(k, 1); score += 50; }
            }

            camera.position.x += (ship.position.x * 0.5 - camera.position.x) * Math.min(1, dt * 4);
            camera.position.y += (ship.position.y * 0.5 + 1.6 - camera.position.y) * Math.min(1, dt * 4);
            camera.lookAt(ship.position.x * 0.4, ship.position.y * 0.4, -14);
            setHud(score, '');
        }

        return { over: false, update: update };
    }

    var factories = {
        1: createRacer,
        2: createTunnel,
        3: createStack,
        4: createHelix,
        5: createSky
    };

    function resetScene() {
        if (scene) disposeObject(scene);
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05020c);
    }

    function resize() {
        if (!container || !renderer || !camera) return;
        var w = container.clientWidth || 1;
        var h = container.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (active && active.onResize) active.onResize(w, h);
    }

    function bindInput() {
        var KEY_LEFT = ['ArrowLeft', 'a', 'A'];
        var KEY_RIGHT = ['ArrowRight', 'd', 'D'];
        var KEY_UP = ['ArrowUp', 'w', 'W'];
        var KEY_DOWN = ['ArrowDown', 's', 'S'];

        function down(e) {
            if (KEY_LEFT.indexOf(e.key) >= 0) input.left = true;
            if (KEY_RIGHT.indexOf(e.key) >= 0) input.right = true;
            if (KEY_UP.indexOf(e.key) >= 0) input.up = true;
            if (KEY_DOWN.indexOf(e.key) >= 0) {
                input.down = true;
                input.brake = true;
            }
            if (e.key === ' ' || e.key === 'Enter') { input.tapQueued = true; e.preventDefault(); }
            if (KEY_LEFT.indexOf(e.key) >= 0 || KEY_RIGHT.indexOf(e.key) >= 0 || KEY_UP.indexOf(e.key) >= 0 || KEY_DOWN.indexOf(e.key) >= 0) e.preventDefault();
        }
        function up(e) {
            if (KEY_LEFT.indexOf(e.key) >= 0) input.left = false;
            if (KEY_RIGHT.indexOf(e.key) >= 0) input.right = false;
            if (KEY_UP.indexOf(e.key) >= 0) input.up = false;
            if (KEY_DOWN.indexOf(e.key) >= 0) {
                input.down = false;
                input.brake = false;
            }
        }
        listen(global, 'keydown', down);
        listen(global, 'keyup', up);

        var el = renderer.domElement;
        function pos(e) {
            var r = el.getBoundingClientRect();
            if (!r.width || !r.height) return;
            input.pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
            input.pointerY = ((e.clientY - r.top) / r.height) * 2 - 1;
        }
        listen(el, 'pointerdown', function (e) {
            input.pointerActive = true;
            input.tapQueued = true;
            pos(e);
            try { if (el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        listen(el, 'pointermove', function (e) { if (input.pointerActive) pos(e); });
        listen(el, 'pointerup', function () { input.pointerActive = false; });
        listen(el, 'pointercancel', function () { input.pointerActive = false; });
        listen(el, 'pointerleave', function () { input.pointerActive = false; });
    }

    function loop() {
        raf = requestAnimationFrame(loop);
        var dt = Math.min(clock.getDelta(), 0.05);
        if (active && running && !active.over) {
            active.update(dt);
        }
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function start(gameId, containerEl, opts) {
        stop();
        if (typeof THREE === 'undefined') {
            containerEl.innerHTML = '<p style="padding:40px;text-align:center;color:#fff">3D engine failed to load. Check your connection and refresh.</p>';
            return;
        }
        container = containerEl;
        gameMeta = { name: 'Game', onScore: null, onGameOver: null };
        if (opts) {
            if (opts.name) gameMeta.name = opts.name;
            if (opts.onScore) gameMeta.onScore = opts.onScore;
            if (opts.onGameOver) gameMeta.onGameOver = opts.onGameOver;
        }

        input.left = false; input.right = false; input.up = false; input.down = false;
        input.brake = false;
        input.pointerActive = false; input.pointerX = 0; input.pointerY = 0; input.tapQueued = false;

        resetScene();
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        container.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(65, 1, 0.1, 700);
        resize();
        resizeObs = new ResizeObserver(resize);
        resizeObs.observe(container);

        clock = new THREE.Clock();
        var factory = factories[gameId];
        active = factory ? factory({ scene: scene, camera: camera, input: input }) : null;
        if (!active) return;

        resize();
        bindInput();
        running = true;
        raf = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        for (var i = 0; i < cleanupFns.length; i++) {
            try { cleanupFns[i](); } catch (e) {}
        }
        cleanupFns = [];
        if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
        active = null;
        if (renderer) {
            try { if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {}
            try { renderer.dispose(); } catch (e) {}
            var el = renderer.domElement;
            if (el && el.parentNode) el.parentNode.removeChild(el);
            renderer = null;
        }
        if (scene) { disposeObject(scene); scene = null; }
        camera = null;
        container = null;
        input.left = false; input.right = false; input.up = false; input.down = false;
        input.brake = false;
        input.pointerActive = false; input.tapQueued = false;
    }

    function setBrake(on) { input.brake = !!on; }

    global.Games3D = { start: start, stop: stop, setBrake: setBrake };
})(window);
