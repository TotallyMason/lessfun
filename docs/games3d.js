/* LessFun — Real 3D arcade games powered by Three.js */
(function (global) {
    'use strict';

    var input = {
        left: false, right: false, up: false, down: false, brake: false,
        pointerActive: false, pointerX: 0, pointerY: 0, tapQueued: false
    };

    var renderer = null, scene = null, camera = null;
    var renderScale = 0; // 0 = auto cap, otherwise a multiplier on the device pixel ratio.
    var adaptiveScale = 1;
    var fpsTime = 0;
    var fpsFrames = 0;
    var lastFps = 0;
    var soundEnabled = true;
    var unitSystem = 'mph';
    var audioMuteHandler = null;
    var audioCleanup = null;
    var container = null, resizeObs = null;
    var raf = 0, clock = null;
    var active = null;
    var cleanupFns = [];
    var gameMeta = { name: 'Game', onScore: null, onGameOver: null, onCoins: null };
    var running = false;
    var playedSeconds = 0;
    var paused = false;

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

    function setPillText(id, text, animate) {
        var el = document.getElementById(id);
        if (!el) return;
        var value = String(text);
        if (el.textContent === value) return;
        var pill = el.parentNode;
        var prev = pill && pill.getBoundingClientRect ? pill.getBoundingClientRect().width : 0;
        el.textContent = value;
        if (animate !== false && pill && pill.animate) {
            try {
                var next = pill.getBoundingClientRect().width;
                if (Math.abs(next - prev) > 0.5) {
                    pill.animate(
                        [{ width: prev + 'px' }, { width: next + 'px' }],
                        { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' }
                    );
                }
            } catch (e) {}
        }
    }

    function setHud(score, extra, gear) {
        setPillText('g3dScore', Math.round(score));
        if (extra !== undefined) setPillText('g3dExtra', extra);
        var g = document.getElementById('g3dGear');
        if (g && gear !== undefined && String(gear) !== g.textContent) {
            setPillText('g3dGear', gear);
            g.classList.remove('is-shifting');
            void g.offsetWidth;
            g.classList.add('is-shifting');
        }
    }

    function endGame(score) {
        if (!active || active.over) return;
        active.over = true;
        var rounded = Math.round(score);
        var seconds = Math.max(0, Math.floor(playedSeconds));
        try {
            if (active.getCoins) {
                var runCoins = active.getCoins();
                if (runCoins > 0 && gameMeta.onCoins) gameMeta.onCoins(runCoins);
            }
        } catch (e) {}
        try { if (gameMeta.onScore) gameMeta.onScore(gameMeta.name, rounded); } catch (e) {}
        try { if (gameMeta.onGameOver) gameMeta.onGameOver(rounded, seconds); } catch (e) {}
        // Stop all engine/wind/noise nodes so nothing keeps buzzing after the run.
        if (audioCleanup) {
            try { audioCleanup(); } catch (e) {}
            audioCleanup = null;
            audioMuteHandler = null;
        }
    }

    /* ---------------- Beach Racer ---------------- */
    function createRacer(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        var cosmetics = (ctx.options && ctx.options.cosmetics) || {};
        var paintColor = cosmetics.paint != null ? cosmetics.paint : 0xef476f;
        var boardColor = cosmetics.board != null ? cosmetics.board : 0x06d6a0;
        var glowColor = cosmetics.glow != null ? cosmetics.glow : null;
        var glowRainbow = !!cosmetics.glowRainbow;
        var wheelColor = cosmetics.wheel != null ? cosmetics.wheel : null;
        var wheelRainbow = !!cosmetics.wheelRainbow;
        var trailColor = cosmetics.trail != null ? cosmetics.trail : null;
        var trailRainbow = !!cosmetics.trailRainbow;
        var umbrellaColor = cosmetics.umbrella != null ? cosmetics.umbrella : null;
        var bodyStyle = cosmetics.body || 'classic';
        var engineStyle = cosmetics.engine || 'stock';
        var engineColor = cosmetics.engineColor != null ? cosmetics.engineColor : null;
        var aeroStyle = cosmetics.aeroStyle || '';
        var kitStyle = cosmetics.kitStyle || '';

        // Real performance from the equipped body + engine. Multipliers are the
        // values shown in the shop. Higher base values make the coastal run
        // feel genuinely fast, especially with a good engine fitted.
        var equippedPerf = cosmetics.performance || {};
        var perf = {
            topSpeed: 168 * (equippedPerf.topSpeed || 1),
            accel: 27 * (equippedPerf.accel || 1),
            grip: equippedPerf.grip || 1
        };
        // 7 mph idle creep, in metres per second.
        var CREEP_SPEED = 7 / 2.2369362920544;
        var REVERSE_MAX = 16;
        var GEAR_FRACTIONS = [0.16, 0.31, 0.47, 0.64, 0.83];

        /* ---------------- Synthesized car audio ---------------- */
        var audioCtx = null, audioMaster = null;
        var engineOsc = null, engineSub = null, engineGain = null, engineFilter = null;
        var windGain = null, nitroGain = null;

        function initAudio() {
            if (audioCtx || !soundEnabled) return;
            var AC = global.AudioContext || global.webkitAudioContext;
            if (!AC) return;
            try {
                audioCtx = new AC();
                audioMaster = audioCtx.createGain();
                audioMaster.gain.value = soundEnabled ? 0.28 : 0;
                audioMaster.connect(audioCtx.destination);
                audioMuteHandler = function (on) {
                    try { if (audioMaster) audioMaster.gain.value = on ? 0.28 : 0; } catch (e) {}
                };
                audioCleanup = function () {
                    audioMuteHandler = null;
                    try { audioCtx.close(); } catch (e) {}
                    audioCtx = null;
                };
                engineFilter = audioCtx.createBiquadFilter();
                engineFilter.type = 'lowpass';
                engineFilter.frequency.value = 800;
                engineGain = audioCtx.createGain();
                engineGain.gain.value = 0;
                engineFilter.connect(engineGain);
                engineGain.connect(audioMaster);
                engineOsc = audioCtx.createOscillator();
                engineOsc.type = 'sawtooth';
                engineOsc.frequency.value = 55;
                engineOsc.connect(engineFilter);
                engineOsc.start();
                engineSub = audioCtx.createOscillator();
                engineSub.type = 'sine';
                engineSub.frequency.value = 27;
                engineSub.connect(engineFilter);
                engineSub.start();

                var length = Math.floor(audioCtx.sampleRate * 1.2);
                var buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
                var data = buffer.getChannelData(0);
                for (var ai = 0; ai < length; ai++) data[ai] = Math.random() * 2 - 1;

                var windFilter = audioCtx.createBiquadFilter();
                windFilter.type = 'bandpass';
                windFilter.frequency.value = 700;
                windFilter.Q.value = 0.6;
                windGain = audioCtx.createGain();
                windGain.gain.value = 0;
                var windSrc = audioCtx.createBufferSource();
                windSrc.buffer = buffer;
                windSrc.loop = true;
                windSrc.connect(windFilter);
                windFilter.connect(windGain);
                windGain.connect(audioMaster);
                windSrc.start();

                var nitroFilter = audioCtx.createBiquadFilter();
                nitroFilter.type = 'bandpass';
                nitroFilter.frequency.value = 1900;
                nitroFilter.Q.value = 0.8;
                nitroGain = audioCtx.createGain();
                nitroGain.gain.value = 0;
                var nitroSrc = audioCtx.createBufferSource();
                nitroSrc.buffer = buffer;
                nitroSrc.loop = true;
                nitroSrc.connect(nitroFilter);
                nitroFilter.connect(nitroGain);
                nitroGain.connect(audioMaster);
                nitroSrc.start();

                if (audioCtx.state === 'suspended') audioCtx.resume();
            } catch (e) {
                audioCtx = null;
            }
        }

        function tone(freq, duration, type, volume, endFreq) {
            if (!soundEnabled || !audioCtx) return;
            try {
                var osc = audioCtx.createOscillator();
                var gain = audioCtx.createGain();
                var now = audioCtx.currentTime;
                osc.type = type || 'sine';
                osc.frequency.setValueAtTime(freq, now);
                if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
                gain.gain.setValueAtTime(Math.max(0.0001, volume || 0.05), now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                osc.connect(gain);
                gain.connect(audioMaster);
                osc.start(now);
                osc.stop(now + duration + 0.02);
            } catch (e) {}
        }

        function crashSound() {
            tone(90, 0.35, 'sawtooth', 0.16, 35);
            tone(180, 0.22, 'square', 0.09, 60);
        }

        function updateAudio() {
            if (!audioCtx) return;
            try {
                var now = audioCtx.currentTime;
                var running = engineOn ? 1 : 0;
                var absSpeed = Math.abs(speed);
                var rpm = 52 + absSpeed * 1.05 + (nitroActive ? 55 : 0);
                engineGain.gain.setTargetAtTime(running ? 0.055 + Math.min(0.045, absSpeed / 2600) : 0, now, 0.08);
                engineOsc.frequency.setTargetAtTime(rpm, now, 0.06);
                engineSub.frequency.setTargetAtTime(rpm * 0.5, now, 0.06);
                engineFilter.frequency.setTargetAtTime(520 + absSpeed * 9, now, 0.1);
                windGain.gain.setTargetAtTime(Math.min(0.09, absSpeed / 1500), now, 0.15);
                nitroGain.gain.setTargetAtTime(nitroActive ? 0.055 : 0, now, 0.1);
            } catch (e) {}
        }

        scene.background = new THREE.Color(0x9bd7f2);
        scene.fog = new THREE.FogExp2(0xffe0bd, 0.0055);

        function standard(color, options) {
            return new THREE.MeshStandardMaterial(Object.assign({
                color: color, roughness: 0.55, metalness: 0.12
            }, options || {}));
        }

        function boxMesh(w, h, d, material) {
            return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        }

        function cylinderMesh(top, bottom, height, segments, material) {
            return new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments || 12), material);
        }

        function makeCanvasTexture(width, height, draw, repeatX, repeatY) {
            var canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            draw(canvas.getContext('2d'), width, height);
            var texture = new THREE.CanvasTexture(canvas);
            if (repeatX || repeatY) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(repeatX || 1, repeatY || 1);
            }
            return texture;
        }

        // Sunset sky dome.
        var skyTex = makeCanvasTexture(16, 256, function (g, w, h) {
            var skyGrad = g.createLinearGradient(0, 0, 0, h);
            skyGrad.addColorStop(0, '#2864a8');
            skyGrad.addColorStop(0.34, '#6ec2e6');
            skyGrad.addColorStop(0.58, '#bfe6f2');
            skyGrad.addColorStop(0.74, '#ffd7a0');
            skyGrad.addColorStop(0.88, '#ffab76');
            skyGrad.addColorStop(1, '#ff8068');
            g.fillStyle = skyGrad;
            g.fillRect(0, 0, w, h);
        });
        scene.add(new THREE.Mesh(
            new THREE.SphereGeometry(480, 32, 20),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
        ));

        // Sun, halo, and layered clouds.
        var sunDisc = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfff4ca, fog: false }));
        sunDisc.position.set(-82, 44, -390); scene.add(sunDisc);
        var sunGlow = new THREE.Mesh(new THREE.SphereGeometry(31, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffd894, transparent: true, opacity: 0.24, fog: false }));
        sunGlow.position.copy(sunDisc.position); scene.add(sunGlow);

        var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, fog: false });
        for (var cl = 0; cl < 8; cl++) {
            var cloud = new THREE.Group();
            for (var cp = 0; cp < 4; cp++) {
                var puff = new THREE.Mesh(new THREE.SphereGeometry(3.5 + Math.random() * 3.5, 9, 7), cloudMat);
                puff.position.set(cp * 5.6 - 8, Math.random() * 2.2, Math.random() * 3);
                puff.scale.y = 0.48 + Math.random() * 0.15;
                cloud.add(puff);
            }
            cloud.position.set(-160 + Math.random() * 320, 34 + Math.random() * 18, -220 - Math.random() * 170);
            scene.add(cloud);
        }

        scene.add(new THREE.HemisphereLight(0xcfeaff, 0xffd9a8, 0.52));
        scene.add(new THREE.AmbientLight(0xfff2dd, 0.22));
        var sunLight = new THREE.DirectionalLight(0xfff1d6, 1.0);
        sunLight.position.set(18, 28, 12); scene.add(sunLight);
        var rimLight = new THREE.DirectionalLight(0xffc38a, 0.32);
        rimLight.position.set(-22, 16, -18); scene.add(rimLight);

        // Five-lane coastal highway.
        var LANES = [-6.4, -3.2, 0, 3.2, 6.4];
        var ROAD_W = 17.6;
        var scrollers = [];
        function addScroller(obj, wrap, factor) {
            scrollers.push({ obj: obj, wrap: wrap, factor: factor == null ? 1 : factor, baseX: obj.position.x, baseRotY: obj.rotation ? obj.rotation.y : 0 });
            scene.add(obj);
            return obj;
        }

        function curveAt(trackS) {
            return 0;
        }

        function roadCurveOffset(z) {
            return curveAt(distance - z);
        }

        function roadTangentAt(z) {
            var s = distance - z;
            return Math.atan((curveAt(s + 8) - curveAt(s - 8)) / 16);
        }

        // Textured sand and packed track.
        var sandTex = makeCanvasTexture(256, 256, function (g, w, h) {
            g.fillStyle = '#e9cb93'; g.fillRect(0, 0, w, h);
            for (var i = 0; i < 2600; i++) {
                var shade = 196 + Math.floor(Math.random() * 42);
                g.fillStyle = 'rgba(' + shade + ',' + (shade - 34) + ',' + (shade - 92) + ',' + (0.12 + Math.random() * 0.28) + ')';
                g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
            }
        }, 18, 48);
        var sand = new THREE.Mesh(
            new THREE.PlaneGeometry(300, 720, 1, 1),
            standard(0xffffff, { map: sandTex, roughness: 0.98 })
        );
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(0, -0.33, -250); scene.add(sand);

        var trackTex = makeCanvasTexture(256, 512, function (g, w, h) {
            g.fillStyle = '#3a3e45'; g.fillRect(0, 0, w, h);
            for (var i = 0; i < 4800; i++) {
                var shade = 42 + Math.floor(Math.random() * 48);
                g.fillStyle = 'rgba(' + shade + ',' + (shade + 2) + ',' + (shade + 6) + ',' + (0.05 + Math.random() * 0.2) + ')';
                g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
            }
            // Faint tyre polish down the middle of every lane.
            g.fillStyle = 'rgba(18,20,24,0.2)';
            for (var lane = 0; lane < 5; lane++) {
                var cx = (lane + 0.5) * w / 5;
                g.fillRect(cx - 15, 0, 9, h);
                g.fillRect(cx + 6, 0, 9, h);
            }
        }, 1, 26);
        var shoulderMat = standard(0x9aa0a6, { roughness: 0.92 });
        var railMat = standard(0xc3c9cf, { metalness: 0.35, roughness: 0.45 });
        var railPostMat = standard(0x8d949c, { metalness: 0.3, roughness: 0.5 });
        var laneLineMat = new THREE.MeshBasicMaterial({ color: 0xf8f8f4, transparent: true, opacity: 0.82 });
        var edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

        var track = new THREE.Mesh(
            new THREE.PlaneGeometry(ROAD_W, 500),
            standard(0xffffff, { map: trackTex, roughness: 0.96, metalness: 0.03 })
        );
        track.rotation.x = -Math.PI / 2;
        track.position.set(0, -0.025, -235);
        scene.add(track);

        [-1, 1].forEach(function (side) {
            var shoulder = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 500), shoulderMat);
            shoulder.rotation.x = -Math.PI / 2;
            shoulder.position.set(side * (ROAD_W / 2 + 0.5), -0.02, -235);
            scene.add(shoulder);

            var edge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 500), edgeLineMat);
            edge.rotation.x = -Math.PI / 2;
            edge.position.set(side * (ROAD_W / 2 - 0.42), 0.006, -235);
            scene.add(edge);

            var railX = side * (ROAD_W / 2 + 0.85);
            var rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 500), railMat);
            rail.position.set(railX, 0.72, -235);
            scene.add(rail);
            var rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 500), railMat);
            rail2.position.set(railX, 0.42, -235);
            scene.add(rail2);
        });

        var wetSand = new THREE.Mesh(
            new THREE.PlaneGeometry(6.2, 500),
            standard(0xb9915f, { roughness: 0.62, metalness: 0.08 })
        );
        wetSand.rotation.x = -Math.PI / 2;
        wetSand.position.set(-13.0, -0.08, -235); scene.add(wetSand);

        // Ocean: a gently animated wave mesh plus foam and sun glints.
        var oceanGeo = new THREE.PlaneGeometry(160, 660, 24, 60);
        var oceanBase = new Float32Array(oceanGeo.attributes.position.array);
        var oceanUpdateT = 0;
        var ocean = new THREE.Mesh(oceanGeo, standard(0x1b87a8, {
            metalness: 0.42, roughness: 0.17, transparent: true, opacity: 0.94
        }));
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.set(-96, -0.28, -245); scene.add(ocean);

        var glintMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
        for (var gl = 0; gl < 9; gl++) {
            var glint = new THREE.Mesh(new THREE.PlaneGeometry(3 + Math.random() * 8, 34 + Math.random() * 80), glintMat);
            glint.rotation.x = -Math.PI / 2;
            glint.position.set(-84 + Math.random() * 46, 0.02, -60 - Math.random() * 380);
            addScroller(glint, 440, 0.35);
        }

        var foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.68, depthWrite: false });
        for (var fo = 0; fo < 36; fo++) {
            var foam = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + Math.random() * 6, 0.32 + Math.random() * 0.35), foamMat);
            foam.rotation.x = -Math.PI / 2;
            foam.position.set(-16.5 - Math.random() * 12, -0.02, -Math.random() * 340);
            addScroller(foam, 340, 0.6);
        }

        // Metal guardrail posts along both shoulders of the highway.
        [-1, 1].forEach(function (side) {
            var railX = side * (ROAD_W / 2 + 0.85);

            for (var pi = 0; pi < 26; pi++) {
                var guardPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), railPostMat);
                guardPost.position.set(railX, 0.45, 10 - pi * 10);
                var reflector = boxMesh(0.06, 0.1, 0.05, new THREE.MeshBasicMaterial({ color: 0xfff0b8 }));
                reflector.position.set(-side * 0.08, 0.32, 0);
                guardPost.add(reflector);
                addScroller(guardPost, 260);
            }
        });

        // Five-lane dashed dividers.
        [-4.8, -1.6, 1.6, 4.8].forEach(function (x) {
            for (var da = 0; da < 30; da++) {
                var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.2), laneLineMat);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(x, 0.006, 8 - da * 17);
                dash.userData.roadMark = true;
                addScroller(dash, 500);
            }
        });

        // Highway lighting, overhead signs, and billboards.
        function makeStreetLight(side) {
            var g = new THREE.Group();
            var poleMat = standard(0xa8afb7, { metalness: 0.35, roughness: 0.45 });
            var pole = cylinderMesh(0.1, 0.14, 7.2, 8, poleMat);
            pole.position.y = 3.6; g.add(pole);
            var arm = boxMesh(2.0, 0.1, 0.1, poleMat);
            arm.position.set(-side * 0.95, 7.1, 0); g.add(arm);
            var lamp = boxMesh(0.62, 0.12, 0.28, new THREE.MeshBasicMaterial({ color: 0xfff04d }));
            lamp.position.set(-side * 1.9, 7.02, 0); g.add(lamp);
            return g;
        }
        for (var li = 0; li < 9; li++) {
            [-1, 1].forEach(function (side) {
                var lightPost = makeStreetLight(side);
                lightPost.position.set(side * (ROAD_W / 2 + 1.4), 0, 6 - li * 36);
                addScroller(lightPost, 324);
            });
        }

        function makeSignTexture(lines, bg, accent) {
            return makeCanvasTexture(512, 192, function (g, w, h) {
                g.fillStyle = bg; g.fillRect(0, 0, w, h);
                g.strokeStyle = '#f8f8f4'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
                g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
                g.font = 'bold 58px Arial, sans-serif';
                g.fillText(lines[0], w / 2, lines[1] ? 72 : h / 2);
                if (lines[1]) {
                    g.font = 'bold 36px Arial, sans-serif';
                    g.fillStyle = accent || '#d8f5d0';
                    g.fillText(lines[1], w / 2, 140);
                }
            });
        }

        function makeGantrySign() {
            var g = new THREE.Group();
            var beamMat = standard(0xa8afb7, { metalness: 0.35, roughness: 0.45 });
            [-1, 1].forEach(function (side) {
                var leg = cylinderMesh(0.16, 0.2, 8.4, 10, beamMat);
                leg.position.set(side * (ROAD_W / 2 + 1.35), 4.2, 0); g.add(leg);
            });
            var beam = boxMesh(ROAD_W + 3.2, 0.22, 0.22, beamMat);
            beam.position.set(0, 8.3, 0); g.add(beam);
            var panel = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.1), new THREE.MeshStandardMaterial({
                map: makeSignTexture(['BEACH 5', 'SUNSET COAST'], '#1f6b45'),
                roughness: 0.7, side: THREE.DoubleSide
            }));
            panel.position.set(0, 7.0, 0.06); g.add(panel);
            return g;
        }
        for (var gi = 0; gi < 2; gi++) {
            var gantry = makeGantrySign();
            gantry.position.set(0, 0, -64 - gi * 210);
            addScroller(gantry, 500);
        }

        function makeBillboard(text) {
            var g = new THREE.Group();
            var frameMat = standard(0x7a828a, { metalness: 0.3, roughness: 0.5 });
            [-1, 1].forEach(function (side) {
                var leg = boxMesh(0.18, 4.4, 0.18, frameMat);
                leg.position.set(side * 1.9, 2.2, 0); g.add(leg);
            });
            var back = boxMesh(5.6, 2.8, 0.14, frameMat);
            back.position.set(0, 4.1, -0.06); g.add(back);
            var board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.6), new THREE.MeshStandardMaterial({
                map: makeSignTexture([text, 'LESSFUN'], '#b3121b', '#ffe6a7'),
                roughness: 0.7, side: THREE.DoubleSide
            }));
            board.position.set(0, 4.1, 0.04); g.add(board);
            return g;
        }
        var billboardTexts = ['SURF CO.', 'BEACH 5', 'COAST HWY'];
        for (var bi2 = 0; bi2 < 3; bi2++) {
            var billboard = makeBillboard(billboardTexts[bi2]);
            billboard.position.set(ROAD_W / 2 + 4.8, 0, -118 - bi2 * 140);
            billboard.rotation.y = 0.2;
            addScroller(billboard, 480);
        }

        function makePalm() {
            var g = new THREE.Group();
            var trunkMat = standard(0x8b5a2b, { roughness: 0.96 });
            var curve = (Math.random() - 0.5) * 0.5;
            for (var t = 0; t < 7; t++) {
                var radius = 0.28 - t * 0.026;
                var segment = cylinderMesh(radius * 0.82, radius, 0.9, 7, trunkMat);
                segment.position.set(curve * (t / 6) * (t / 6) * 1.6, 0.45 + t * 0.82, 0);
                segment.rotation.z = -curve * 0.09;
                g.add(segment);
            }

            var topX = curve * 1.6;
            var topY = 6.0;
            for (var co = 0; co < 3; co++) {
                var coconut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), standard(0x5a3b20, { roughness: 0.9 }));
                coconut.position.set(topX + Math.cos(co * 2.1) * 0.26, topY - 0.3, Math.sin(co * 2.1) * 0.26);
                g.add(coconut);
            }

            var leafShape = new THREE.Shape();
            leafShape.moveTo(0, 0);
            leafShape.bezierCurveTo(0.55, 0.34, 1.55, 0.28, 2.45, 0);
            leafShape.bezierCurveTo(1.55, -0.28, 0.55, -0.34, 0, 0);
            var leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.045, bevelEnabled: false });
            var leafMat = standard(0x2f9e44, { roughness: 0.78 });
            var leafMatDark = standard(0x1f7a35, { roughness: 0.8 });
            for (var li = 0; li < 9; li++) {
                var pivot = new THREE.Group();
                pivot.position.set(topX, topY, 0);
                pivot.rotation.y = li / 9 * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
                var leafPivot = new THREE.Group();
                leafPivot.rotation.z = -0.12 - Math.random() * 0.2;
                var leaf = new THREE.Mesh(leafGeo, li % 2 ? leafMat : leafMatDark);
                leaf.rotation.x = -Math.PI / 2;
                leaf.scale.set(0.9 + Math.random() * 0.25, 1, 1);
                leafPivot.add(leaf);
                pivot.add(leafPivot);
                g.add(pivot);
            }
            return g;
        }

        function makeUmbrellaTexture(baseColor) {
            return makeCanvasTexture(128, 64, function (g, w, h) {
                var base = '#' + Number(baseColor).toString(16).padStart(6, '0');
                g.fillStyle = base; g.fillRect(0, 0, w, h);
                g.fillStyle = 'rgba(255,250,240,0.9)';
                for (var i = 0; i < 8; i += 2) g.fillRect(i * w / 8, 0, w / 8, h);
                g.fillStyle = 'rgba(0,0,0,0.08)';
                for (var j = 0; j < 8; j++) g.fillRect(j * w / 8, 0, 2, h);
            });
        }

        function makeLounger(color) {
            var g = new THREE.Group();
            var frameMat = standard(0xe9ecef, { roughness: 0.55 });
            var fabricMat = standard(color, { roughness: 0.82 });
            for (var i = 0; i < 4; i++) {
                var leg = boxMesh(0.06, 0.34, 0.06, frameMat);
                leg.position.set(i % 2 ? 0.38 : -0.38, 0.17, i < 2 ? -0.68 : 0.68);
                g.add(leg);
            }
            var seat = boxMesh(0.86, 0.08, 1.55, fabricMat);
            seat.position.set(0, 0.38, 0); g.add(seat);
            var back = boxMesh(0.86, 0.08, 0.7, fabricMat);
            back.position.set(0, 0.58, -0.98); back.rotation.x = -0.55; g.add(back);
            return g;
        }

        function makeUmbrellaCluster(index) {
            var g = new THREE.Group();
            var pole = cylinderMesh(0.045, 0.06, 2.9, 8, standard(0xf7f3e8, { roughness: 0.7 }));
            pole.position.y = 1.45; g.add(pole);
            var base = cylinderMesh(0.24, 0.3, 0.12, 10, standard(0x6b7280, { roughness: 0.8 }));
            base.position.y = 0.06; g.add(base);

            var color = umbrellaColor != null ? umbrellaColor : [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xff9f1c][index % 5];
            var canopy = new THREE.Mesh(
                new THREE.ConeGeometry(1.95, 0.68, 16, 1, true),
                new THREE.MeshStandardMaterial({
                    map: makeUmbrellaTexture(color), color: 0xffffff, side: THREE.DoubleSide,
                    roughness: 0.62, metalness: 0.02
                })
            );
            canopy.position.y = 2.9; g.add(canopy);
            var cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), standard(0xfff3d6));
            cap.position.y = 3.24; g.add(cap);

            var lounger = makeLounger(color);
            lounger.position.set(1.5, 0, 0.85);
            lounger.rotation.y = -0.2;
            g.add(lounger);
            var towel = boxMesh(1.15, 0.03, 1.7, standard(color, { roughness: 0.95 }));
            towel.position.set(-1.15, 0.02, 0.65);
            towel.rotation.y = 0.18; g.add(towel);
            var cooler = boxMesh(0.52, 0.36, 0.34, standard(0xe5e7eb, { roughness: 0.55 }));
            cooler.position.set(-1.7, 0.18, -0.2); g.add(cooler);
            var lid = boxMesh(0.54, 0.07, 0.36, standard(0x118ab2, { roughness: 0.5 }));
            lid.position.set(-1.7, 0.39, -0.2); g.add(lid);
            return g;
        }

        for (var pa = 0; pa < 14; pa++) {
            var palm = makePalm();
            palm.position.set(8.5 + Math.random() * 4.8, 0, 12 - pa * 18);
            palm.rotation.y = Math.random() * Math.PI * 2;
            var palmScale = 0.82 + Math.random() * 0.3;
            palm.scale.set(palmScale, palmScale, palmScale);
            addScroller(palm, 252);
        }

        for (var ui = 0; ui < 14; ui++) {
            var umb = makeUmbrellaCluster(ui);
            var row = ui % 2;
            umb.position.set((row ? 24 : 15) + Math.random() * 4, 0, -6 - Math.floor(ui / 2) * 46);
            umb.rotation.y = Math.random() * Math.PI * 2;
            addScroller(umb, 322);
        }

        // Rocks and driftwood along the shoreline.
        var rockMat = standard(0x7d7f86, { roughness: 0.92, metalness: 0.05 });
        var rockGeo = new THREE.DodecahedronGeometry(1, 0);
        for (var ro = 0; ro < 14; ro++) {
            var rock = new THREE.Mesh(rockGeo, rockMat);
            var rs = 0.35 + Math.random() * 0.9;
            rock.scale.set(rs * 1.2, rs * 0.7, rs);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.position.set(-12.5 - Math.random() * 7, 0.05, -Math.random() * 360);
            addScroller(rock, 360, 0.8);
        }
        var driftMat = standard(0x9a7248, { roughness: 0.95 });
        for (var dr = 0; dr < 8; dr++) {
            var drift = cylinderMesh(0.11, 0.2, 2.4 + Math.random() * 2, 6, driftMat);
            drift.rotation.z = Math.PI / 2;
            drift.rotation.y = Math.random() * 0.7;
            drift.position.set(12 + Math.random() * 8, 0.14, -Math.random() * 320);
            addScroller(drift, 320);
        }

        // Lifeguard tower and beach flags.
        var tower = new THREE.Group();
        var towerWood = standard(0xd9b382, { roughness: 0.85 });
        for (var tl = 0; tl < 4; tl++) {
            var beam = boxMesh(0.16, 3.1, 0.16, towerWood);
            beam.position.set(tl % 2 ? 1.1 : -1.1, 1.55, tl < 2 ? -1.1 : 1.1);
            tower.add(beam);
        }
        var cabin = boxMesh(2.7, 1.5, 2.2, standard(0xf4f1de, { roughness: 0.7 }));
        cabin.position.y = 3.2; tower.add(cabin);
        var towerRoof = boxMesh(3.1, 0.16, 2.6, standard(0xef476f, { roughness: 0.7 }));
        towerRoof.position.y = 4.02; tower.add(towerRoof);
        var towerGlass = boxMesh(2.3, 0.5, 0.06, standard(0x0b3a44, { metalness: 0.6, roughness: 0.1 }));
        towerGlass.position.set(0, 3.35, 1.12); tower.add(towerGlass);
        tower.position.set(18, 0, -86);
        addScroller(tower, 420);

        // Gulls gliding over the beach.
        var birds = [];
        var birdMat = new THREE.MeshBasicMaterial({ color: 0x2b2d42, side: THREE.DoubleSide });
        for (var bi = 0; bi < 9; bi++) {
            var bird = new THREE.Group();
            var wingGeo = new THREE.BufferGeometry();
            wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.2, 0.18, 0.35, 0.2, 0, 0.6], 3));
            wingGeo.computeVertexNormals();
            var wingL = new THREE.Mesh(wingGeo, birdMat);
            var wingR = new THREE.Mesh(wingGeo, birdMat);
            wingR.scale.x = -1;
            bird.add(wingL); bird.add(wingR);
            bird.userData.wings = [wingL, wingR];
            bird.userData.flap = Math.random() * Math.PI * 2;
            bird.position.set(-58 + Math.random() * 105, 12 + Math.random() * 13, -30 - Math.random() * 300);
            bird.scale.setScalar(0.65 + Math.random() * 0.45);
            addScroller(bird, 400, 0.24);
            birds.push(bird);
        }

        // Shells and starfish give the sand motion cues.
        var shellGeo = new THREE.SphereGeometry(0.11, 6, 6);
        var shellMat = standard(0xfff2e2, { roughness: 0.5 });
        var starGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.035, 5);
        var starMat = standard(0xff8fa3, { roughness: 0.6 });
        for (var sh = 0; sh < 80; sh++) {
            var shell = new THREE.Mesh(sh < 64 ? shellGeo : starGeo, sh < 64 ? shellMat : starMat);
            var shellX = sh % 3 === 0
                ? (-11.6 - Math.random() * 3.2)
                : (ROAD_W / 2 + 1.8 + Math.random() * 7.2);
            shell.position.set(shellX, 0.06, -Math.random() * 480);
            var ss = 0.7 + Math.random() * 0.8;
            shell.scale.set(ss, ss, ss);
            addScroller(shell, 480);
        }

        // ---------------------------------------------------------------
        // Car construction
        // ---------------------------------------------------------------
        var BODY_SPECS = {
            classic: { len: 3.2, width: 1.72, ride: 0.14, hood: 0.5, deck: 0.46, cabinZ: 0.05, cabinLen: 1.35, cabinH: 0.44, cabinW: 1.28, roof: true, spoiler: false },
            buggy: { len: 3.0, width: 1.86, ride: 0.36, hood: 0.46, deck: 0.42, cabinZ: 0.12, cabinLen: 1.15, cabinH: 0.3, cabinW: 1.3, roof: false, cage: true, fenders: true, bigWheels: true, spoiler: false },
            wagon: { len: 3.55, width: 1.78, ride: 0.16, hood: 0.48, deck: 0.5, cabinZ: 0.12, cabinLen: 2.05, cabinH: 0.62, cabinW: 1.32, roof: true, rack: true, spoiler: false },
            truck: { len: 3.75, width: 1.86, ride: 0.26, hood: 0.54, deck: 0.35, cabinZ: -0.28, cabinLen: 1.15, cabinH: 0.62, cabinW: 1.48, roof: true, bed: true, spoiler: false },
            racer: { len: 3.55, width: 1.92, ride: 0.08, hood: 0.42, deck: 0.38, cabinZ: 0.18, cabinLen: 1.3, cabinH: 0.36, cabinW: 1.18, roof: true, spoiler: true, stripe: true },
            van: { len: 3.55, width: 1.9, ride: 0.2, hood: 0.48, deck: 0.5, cabinZ: 0.2, cabinLen: 2.25, cabinH: 0.8, cabinW: 1.48, roof: true, spoiler: false },
            roadster: { len: 3.05, width: 1.76, ride: 0.1, hood: 0.42, deck: 0.38, cabinZ: 0.18, cabinLen: 0.95, cabinH: 0.28, cabinW: 1.24, roof: false, windshield: true, spoiler: false },
            muscle: { len: 3.55, width: 1.98, ride: 0.12, hood: 0.5, deck: 0.46, cabinZ: 0.1, cabinLen: 1.42, cabinH: 0.4, cabinW: 1.3, roof: true, scoop: true, spoiler: true, stripe: true },
            limo: { len: 4.75, width: 1.86, ride: 0.16, hood: 0.5, deck: 0.52, cabinZ: 0.18, cabinLen: 3.1, cabinH: 0.54, cabinW: 1.34, roof: true, spoiler: false },
            cyber: { len: 3.65, width: 2.0, ride: 0.08, hood: 0.36, deck: 0.34, cabinZ: 0.02, cabinLen: 1.65, cabinH: 0.48, cabinW: 1.46, roof: true, wedge: true, lightBar: true, spoiler: true },
            retro: { len: 3.35, width: 1.82, ride: 0.14, hood: 0.5, deck: 0.5, cabinZ: 0.1, cabinLen: 1.45, cabinH: 0.44, cabinW: 1.3, roof: true, fins: true, spoiler: false },
            taxi: { len: 3.5, width: 1.8, ride: 0.15, hood: 0.5, deck: 0.5, cabinZ: 0.08, cabinLen: 1.65, cabinH: 0.52, cabinW: 1.32, roof: true, taxi: true, spoiler: false },
            suv: { len: 3.9, width: 2.02, ride: 0.3, hood: 0.6, deck: 0.52, cabinZ: 0.02, cabinLen: 2.2, cabinH: 0.8, cabinW: 1.58, roof: true, rack: true, spoiler: false },
            monster: { len: 3.45, width: 2.06, ride: 0.62, hood: 0.56, deck: 0.5, cabinZ: -0.05, cabinLen: 1.25, cabinH: 0.5, cabinW: 1.5, roof: true, fenders: true, bigWheels: true, spoiler: false },
            phantom: { len: 3.8, width: 1.96, ride: 0.07, hood: 0.4, deck: 0.38, cabinZ: 0.16, cabinLen: 1.5, cabinH: 0.38, cabinW: 1.24, roof: true, wedge: true, spoiler: true, stripe: true },
            f1: { len: 4.7, width: 1.55, ride: 0.05, hood: 0.22, deck: 0.24, cabinZ: 0.05, cabinLen: 0.95, cabinH: 0.26, cabinW: 0.72, roof: false, windshield: true, spoiler: true, f1: true },
            bus: { len: 6.6, width: 2.3, ride: 0.28, hood: 0.8, deck: 0.72, cabinZ: 0.45, cabinLen: 4.6, cabinH: 1.5, cabinW: 2.08, roof: true, bus: true },
            gt: { len: 4.15, width: 1.98, ride: 0.06, hood: 0.34, deck: 0.35, cabinZ: 0.15, cabinLen: 1.65, cabinH: 0.4, cabinW: 1.3, roof: true, wedge: true, spoiler: true, stripe: true, lightBar: true },
            super: { len: 4.3, width: 2.06, ride: 0.045, hood: 0.3, deck: 0.3, cabinZ: 0.08, cabinLen: 1.8, cabinH: 0.36, cabinW: 1.34, roof: true, wedge: true, spoiler: true, fenders: true, lightBar: true },
            offroad: { len: 4.0, width: 2.08, ride: 0.4, hood: 0.6, deck: 0.52, cabinZ: -0.05, cabinLen: 1.8, cabinH: 0.68, cabinW: 1.58, roof: true, cage: true, fenders: true, bigWheels: true, rack: true, lightBar: true, spoiler: false },
            beater: { len: 3.4, width: 1.8, ride: 0.2, hood: 0.46, deck: 0.48, cabinZ: 0.08, cabinLen: 1.8, cabinH: 0.5, cabinW: 1.3, roof: true, spoiler: false }
        };

        function makeBodyMesh(spec, material) {
            var L = spec.len / 2;
            var h = Math.max(0.34, spec.hood);
            var shape = new THREE.Shape();
            shape.moveTo(-L, 0.26);
            shape.lineTo(-L + 0.055, h * 0.72);
            shape.quadraticCurveTo(-L * 0.74, h, -L * 0.25, h + 0.03);
            shape.lineTo(L * 0.42, spec.deck);
            shape.quadraticCurveTo(L * 0.9, spec.deck + 0.02, L - 0.03, spec.deck - 0.14);
            shape.lineTo(L, 0.28);
            shape.lineTo(L - 0.06, 0.14);
            shape.lineTo(-L + 0.06, 0.14);
            shape.closePath();
            var geo = new THREE.ExtrudeGeometry(shape, {
                depth: spec.width, bevelEnabled: true, bevelSize: 0.045,
                bevelThickness: 0.045, bevelSegments: 2, steps: 1
            });
            geo.translate(0, 0, -spec.width / 2);
            geo.rotateY(-Math.PI / 2);
            var mesh = new THREE.Mesh(geo, material);
            mesh.position.y = spec.ride;
            return mesh;
        }

        function makeCabin(spec, glassMat, bodyMat) {
            var group = new THREE.Group();
            var cLen = spec.cabinLen;
            var cW = spec.cabinW;
            var cH = spec.cabinH;
            var shape = new THREE.Shape();
            if (spec.wedge) {
                shape.moveTo(-cLen / 2, 0);
                shape.lineTo(cLen / 2, 0);
                shape.lineTo(cLen * 0.18, cH);
                shape.lineTo(-cLen * 0.42, cH * 0.82);
            } else if (spec.bed) {
                shape.moveTo(-cLen / 2, 0);
                shape.lineTo(cLen / 2, 0);
                shape.lineTo(cLen * 0.42, cH);
                shape.lineTo(-cLen * 0.5, cH * 0.96);
            } else {
                shape.moveTo(-cLen / 2, 0);
                shape.lineTo(cLen / 2, 0);
                shape.lineTo(cLen * 0.32, cH);
                shape.lineTo(-cLen * 0.4, cH * 0.94);
            }
            var geo = new THREE.ExtrudeGeometry(shape, {
                depth: cW, bevelEnabled: true, bevelSize: 0.025,
                bevelThickness: 0.025, bevelSegments: 1, steps: 1
            });
            geo.translate(0, 0, -cW / 2);
            geo.rotateY(-Math.PI / 2);
            var cabin = new THREE.Mesh(geo, glassMat);
            cabin.position.set(0, spec.ride + spec.hood * 0.94, spec.cabinZ);
            group.add(cabin);

            if (!spec.roof) {
                // Windshield and pillars only.
                var windshield = boxMesh(cW * 0.92, 0.38, 0.05, glassMat);
                windshield.position.set(0, spec.ride + spec.hood + cH * 0.42, spec.cabinZ - cLen * 0.4);
                windshield.rotation.x = -0.22;
                group.add(windshield);
                return group;
            }

            var roofY = spec.ride + spec.hood * 0.94 + cH;
            var roof = boxMesh(cW + 0.04, 0.07, cLen * 0.7, bodyMat);
            roof.position.set(0, roofY, spec.cabinZ + cLen * 0.02);
            group.add(roof);

            // Pillars break up the glass and add structure.
            var pillarMat = standard(0x1c252c, { metalness: 0.4, roughness: 0.5 });
            [-1, 1].forEach(function (side) {
                [-0.36, 0.36].forEach(function (frontBack) {
                    var pillar = boxMesh(0.055, cH, 0.055, pillarMat);
                    pillar.position.set(side * (cW / 2 - 0.04), spec.ride + spec.hood * 0.94 + cH / 2, spec.cabinZ + frontBack * cLen);
                    pillar.rotation.x = frontBack > 0 ? 0.12 : -0.08;
                    group.add(pillar);
                });
            });
            return group;
        }

        function makeWheel(radius, width, rimColor, rainbow) {
            var g = new THREE.Group();
            var tireMat = standard(0x141619, { roughness: 0.92, metalness: 0.02 });
            var tire = cylinderMesh(radius, radius, width, 18, tireMat);
            tire.rotation.z = Math.PI / 2; g.add(tire);

            var rimMat = rimColor != null
                ? standard(rimColor, { metalness: 0.85, roughness: 0.22, emissive: rimColor, emissiveIntensity: 0.18 })
                : standard(0x9aa1a9, { metalness: 0.7, roughness: 0.3 });
            var rim = cylinderMesh(radius * 0.64, radius * 0.64, width + 0.025, 16, rimMat);
            rim.rotation.z = Math.PI / 2; g.add(rim);
            var hub = cylinderMesh(radius * 0.2, radius * 0.2, width + 0.04, 12, standard(0x2b2f36, { metalness: 0.8, roughness: 0.25 }));
            hub.rotation.z = Math.PI / 2; g.add(hub);

            for (var s = 0; s < 6; s++) {
                var spoke = boxMesh(radius * 0.08, radius * 1.05, 0.045, rimMat);
                spoke.rotation.x = s / 6 * Math.PI;
                g.add(spoke);
            }
            if (rainbow) {
                g.userData.rainbow = true;
                g.userData.rimMaterial = rimMat;
            }
            return g;
        }

        function makeEngine(style, color, spec) {
            var g = new THREE.Group();
            var glow = color != null ? color : 0xff9f1c;
            var glowMat = new THREE.MeshBasicMaterial({ color: glow });
            var chromeMat = standard(0xd9e2ec, { metalness: 0.92, roughness: 0.18 });
            var darkMat = standard(0x2b2f36, { metalness: 0.55, roughness: 0.42 });
            var glowParts = [];
            var rearZ = spec.len / 2 + 0.02;

            function pipe(x, y, radius, length, material) {
                var p = cylinderMesh(radius, radius, length, 10, material || chromeMat);
                p.rotation.x = Math.PI / 2;
                p.position.set(x, y, rearZ + length / 2 - 0.04);
                g.add(p);
                return p;
            }

            if (style === 'v8') {
                [-0.52, -0.18, 0.18, 0.52].forEach(function (x) {
                    pipe(x, 0.48, 0.075, 0.3, chromeMat);
                });
                var block = boxMesh(0.9, 0.38, 0.4, chromeMat);
                block.position.set(0, 0.55, rearZ - 0.2); g.add(block);
            } else if (style === 'turbo') {
                pipe(-0.38, 0.46, 0.09, 0.3, chromeMat);
                pipe(0.38, 0.46, 0.09, 0.3, chromeMat);
                var turbine = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 18), glowMat);
                turbine.position.set(0, 0.7, rearZ + 0.02); g.add(turbine);
                glowParts.push(turbine);
            } else if (style === 'electric') {
                var battery = boxMesh(1.05, 0.18, 0.1, new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3 }));
                battery.position.set(0, 0.62, rearZ - 0.02); g.add(battery);
                glowParts.push(battery);
                var bolt = boxMesh(0.1, 0.26, 0.11, glowMat);
                bolt.position.set(0, 0.37, rearZ - 0.02); g.add(bolt);
            } else if (style === 'diesel') {
                var stack = cylinderMesh(0.1, 0.11, 1.2, 10, darkMat);
                stack.position.set(spec.cabinW / 2 + 0.22, spec.hood + 0.8, spec.cabinZ - spec.cabinLen * 0.35); g.add(stack);
                var stackTip = cylinderMesh(0.12, 0.12, 0.12, 10, chromeMat);
                stackTip.position.copy(stack.position); stackTip.position.y += 0.63; g.add(stackTip);
                pipe(-0.36, 0.42, 0.085, 0.24, darkMat);
            } else if (style === 'twin') {
                [-1, 1].forEach(function (side) {
                    var sidePipe = cylinderMesh(0.075, 0.075, 1.9, 10, chromeMat);
                    sidePipe.rotation.x = Math.PI / 2;
                    sidePipe.position.set(side * (spec.width / 2 + 0.08), 0.42, 0.18);
                    g.add(sidePipe);
                });
                pipe(-0.5, 0.46, 0.08, 0.2, chromeMat);
                pipe(0.5, 0.46, 0.08, 0.2, chromeMat);
            } else if (style === 'hybrid') {
                var hybridBattery = boxMesh(0.92, 0.14, 0.1, new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 0.95, roughness: 0.35 }));
                hybridBattery.position.set(0, 0.62, rearZ - 0.02); g.add(hybridBattery);
                glowParts.push(hybridBattery);
                pipe(0.4, 0.4, 0.07, 0.24, darkMat);
            } else if (style === 'jet') {
                var jet = cylinderMesh(0.32, 0.38, 0.8, 16, darkMat);
                jet.rotation.x = Math.PI / 2;
                jet.position.set(0, 0.62, rearZ + 0.24); g.add(jet);
                var jetCore = new THREE.Mesh(new THREE.CircleGeometry(0.23, 18), glowMat);
                jetCore.position.set(0, 0.62, rearZ + 0.66); g.add(jetCore);
                var jetRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 8, 20), glowMat);
                jetRing.position.set(0, 0.62, rearZ + 0.67); g.add(jetRing);
                glowParts.push(jetCore, jetRing);
            } else if (style === 'rocket') {
                [-0.48, 0.48].forEach(function (x) {
                    var nozzle = cylinderMesh(0.17, 0.24, 0.48, 14, darkMat);
                    nozzle.rotation.x = Math.PI / 2;
                    nozzle.position.set(x, 0.55, rearZ + 0.22); g.add(nozzle);
                    var flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 12), new THREE.MeshBasicMaterial({
                        color: glow, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    flame.rotation.x = Math.PI / 2;
                    flame.position.set(x, 0.55, rearZ + 0.72); g.add(flame);
                    glowParts.push(flame);
                });
            } else if (style === 'quantum') {
                for (var q = 0; q < 3; q++) {
                    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.22 + q * 0.08, 0.025, 8, 20), glowMat);
                    ring.position.set(0, 0.62, rearZ + 0.08 + q * 0.1); g.add(ring);
                    glowParts.push(ring);
                }
            } else if (style === 'solar') {
                var panel = boxMesh(1.2, 0.045, 0.9, new THREE.MeshStandardMaterial({
                    color: 0x0b2a4a, emissive: glow, emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.2
                }));
                panel.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.12, spec.cabinZ + 0.05);
                g.add(panel); glowParts.push(panel);
                pipe(0.4, 0.4, 0.07, 0.2, darkMat);
            } else if (style === 'nitro') {
                [-0.42, 0.42].forEach(function (x) {
                    var bottle = cylinderMesh(0.12, 0.15, 0.62, 12, new THREE.MeshStandardMaterial({
                        color: glow, emissive: glow, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.25
                    }));
                    bottle.rotation.x = Math.PI / 2;
                    bottle.position.set(x, 0.58, rearZ - 0.02); g.add(bottle);
                    var tip = cylinderMesh(0.08, 0.11, 0.22, 10, chromeMat);
                    tip.rotation.x = Math.PI / 2;
                    tip.position.set(x, 0.58, rearZ + 0.36); g.add(tip);
                    glowParts.push(bottle);
                });
            } else {
                pipe(0.42, 0.4, 0.075, 0.24, darkMat);
                var stockBox = boxMesh(0.7, 0.3, 0.36, darkMat);
                stockBox.position.set(0, 0.48, rearZ - 0.22); g.add(stockBox);
            }

            g.userData.glowParts = glowParts;
            return g;
        }

        function buildCar(bodyColor, rimColor, styleName, engineName, engineGlowColor, isPlayer) {
            var spec = BODY_SPECS[styleName] || BODY_SPECS.classic;
            var g = new THREE.Group();
            var bodyMat;
            if (isPlayer && THREE.MeshPhysicalMaterial) {
                bodyMat = new THREE.MeshPhysicalMaterial({
                    color: bodyColor, metalness: 0.35, roughness: 0.24,
                    clearcoat: 0.85, clearcoatRoughness: 0.12,
                    emissive: bodyColor, emissiveIntensity: 0.03
                });
            } else {
                bodyMat = new THREE.MeshStandardMaterial({
                    color: bodyColor, metalness: 0.5, roughness: 0.28,
                    emissive: bodyColor, emissiveIntensity: 0.035
                });
            }
            var glassMat = new THREE.MeshStandardMaterial({
                color: 0x0a2b33, metalness: 0.72, roughness: 0.09,
                transparent: true, opacity: 0.93
            });

            var body = makeBodyMesh(spec, bodyMat); g.add(body);

            var cabin = makeCabin(spec, glassMat, bodyMat); g.add(cabin);

            // Rocker panels and bumpers.
            var trimMat = standard(0x1f242b, { metalness: 0.4, roughness: 0.55 });
            var rocker = boxMesh(spec.width + 0.03, 0.08, spec.len * 0.78, trimMat);
            rocker.position.set(0, spec.ride + 0.17, 0); g.add(rocker);
            var frontBumper = boxMesh(spec.width + 0.05, 0.11, 0.16, trimMat);
            frontBumper.position.set(0, spec.ride + 0.24, -spec.len / 2 - 0.03); g.add(frontBumper);
            var rearBumper = frontBumper.clone();
            rearBumper.position.z = spec.len / 2 + 0.03; g.add(rearBumper);

            // Headlights and tail lights.
            var headMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
            [-0.34, 0.34].forEach(function (x) {
                var light = boxMesh(0.34, 0.13, 0.05, headMat);
                light.position.set(x * spec.width, spec.ride + spec.hood * 0.78, -spec.len / 2 - 0.015);
                g.add(light);
            });
            var brakeMat = new THREE.MeshBasicMaterial({ color: 0x5a1018 });
            var tailLights = [];
            [-0.34, 0.34].forEach(function (x) {
                var lamp = boxMesh(0.36, 0.12, 0.05, brakeMat);
                lamp.position.set(x * spec.width, spec.ride + spec.deck * 0.78, spec.len / 2 + 0.015);
                g.add(lamp); tailLights.push(lamp);
            });
            g.userData.brakeMat = brakeMat;

            // Mirrors.
            [-1, 1].forEach(function (side) {
                var mirror = boxMesh(0.13, 0.08, 0.18, bodyMat);
                mirror.position.set(side * (spec.cabinW / 2 + 0.11), spec.ride + spec.hood + spec.cabinH * 0.66, spec.cabinZ - spec.cabinLen * 0.28);
                g.add(mirror);
            });

            // Style details.
            if (spec.spoiler) {
                var wing = boxMesh(spec.width * 0.82, 0.07, 0.34, bodyMat);
                wing.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.25, spec.len / 2 - 0.03);
                g.add(wing);
                [-1, 1].forEach(function (side) {
                    var support = boxMesh(0.06, 0.26, 0.06, trimMat);
                    support.position.set(side * spec.width * 0.3, spec.ride + spec.hood + spec.cabinH + 0.11, spec.len / 2 - 0.03);
                    g.add(support);
                });
            }
            if (spec.f1) {
                var aeroMat = standard(0x15191f, { metalness: 0.65, roughness: 0.3 });
                var frontWing = boxMesh(spec.width + 1.05, 0.06, 0.55, bodyMat);
                frontWing.position.set(0, 0.24, -spec.len / 2 - 0.12);
                g.add(frontWing);
                [-1, 1].forEach(function (side) {
                    var endplate = boxMesh(0.06, 0.3, 0.6, aeroMat);
                    endplate.position.set(side * (spec.width / 2 + 0.52), 0.32, -spec.len / 2 - 0.12);
                    g.add(endplate);
                    var pod = boxMesh(0.36, 0.32, spec.len * 0.38, bodyMat);
                    pod.position.set(side * (spec.width / 2 - 0.05), spec.ride + 0.36, spec.len * 0.02);
                    g.add(pod);
                });
                var rearWing = boxMesh(spec.width + 0.62, 0.07, 0.46, bodyMat);
                rearWing.position.set(0, spec.ride + spec.hood + 0.72, spec.len / 2 - 0.08);
                g.add(rearWing);
                [-1, 1].forEach(function (side) {
                    var rearPlate = boxMesh(0.05, 0.38, 0.6, aeroMat);
                    rearPlate.position.set(side * (spec.width / 2 + 0.32), spec.ride + spec.hood + 0.56, spec.len / 2 - 0.08);
                    g.add(rearPlate);
                });
                var halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 16, Math.PI), aeroMat);
                halo.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.06, spec.cabinZ);
                halo.rotation.y = Math.PI / 2;
                g.add(halo);
            }
            if (spec.bus) {
                var busGlass = new THREE.MeshStandardMaterial({
                    color: 0x0b2733, metalness: 0.7, roughness: 0.12,
                    transparent: true, opacity: 0.88
                });
                var windowBand = boxMesh(spec.width * 0.96, 0.62, spec.cabinLen * 0.78, busGlass);
                windowBand.position.set(0, spec.ride + spec.hood + spec.cabinH * 0.62, spec.cabinZ + spec.cabinLen * 0.02);
                g.add(windowBand);
                var door = boxMesh(0.06, 1.2, 0.9, busGlass);
                door.position.set(spec.width / 2 + 0.01, spec.ride + 0.92, -spec.cabinLen * 0.28);
                g.add(door);
                var stripeMat = new THREE.MeshBasicMaterial({ color: 0xffc400 });
                var stripe = boxMesh(spec.width + 0.02, 0.16, spec.len * 0.72, stripeMat);
                stripe.position.set(0, spec.ride + 0.72, 0);
                g.add(stripe);
            }
            if (spec.stripe) {
                var stripe = boxMesh(0.34, 0.02, spec.len * 0.75, new THREE.MeshBasicMaterial({ color: 0xfff3d6 }));
                stripe.position.set(0, spec.ride + spec.hood + 0.035, -0.04); g.add(stripe);
            }
            if (spec.fins) {
                [-1, 1].forEach(function (side) {
                    var fin = boxMesh(0.06, 0.28, 0.6, bodyMat);
                    fin.position.set(side * spec.width * 0.42, spec.ride + spec.deck + 0.1, spec.len * 0.28);
                    fin.rotation.z = side * 0.22; g.add(fin);
                });
            }
            if (spec.scoop) {
                var scoop = boxMesh(0.55, 0.16, 0.5, trimMat);
                scoop.position.set(0, spec.ride + spec.hood + 0.06, -spec.len * 0.18); g.add(scoop);
            }
            if (spec.lightBar) {
                var bar = boxMesh(spec.width * 0.8, 0.07, 0.05, headMat);
                bar.position.set(0, spec.ride + spec.hood * 0.72, -spec.len / 2 - 0.02); g.add(bar);
            }
            if (spec.taxi) {
                var sign = boxMesh(0.55, 0.2, 0.28, new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.8 }));
                sign.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.16, spec.cabinZ); g.add(sign);
            }
            if (spec.bed) {
                var bed = boxMesh(spec.width * 0.9, 0.24, spec.len * 0.36, bodyMat);
                bed.position.set(0, spec.ride + spec.deck - 0.06, spec.len * 0.25); g.add(bed);
            }
            if (spec.cage) {
                var cageMat = standard(0xd9e2ec, { metalness: 0.8, roughness: 0.3 });
                [-1, 1].forEach(function (side) {
                    var hoop = new THREE.Mesh(new THREE.TorusGeometry(spec.cabinH + 0.12, 0.035, 8, 14, Math.PI), cageMat);
                    hoop.position.set(side * spec.cabinW * 0.4, spec.ride + spec.hood + spec.cabinH * 0.75, spec.cabinZ);
                    hoop.rotation.y = Math.PI / 2; g.add(hoop);
                });
            }

            if (spec.rack) {
                var rackMat = standard(0x2b2f36, { metalness: 0.6, roughness: 0.4 });
                [-0.55, 0.55].forEach(function (z) {
                    var rail = boxMesh(spec.cabinW * 0.9, 0.06, 0.06, rackMat);
                    rail.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.13, spec.cabinZ + z);
                    g.add(rail);
                });
            }

            var wheelRadius = spec.bigWheels ? 0.48 : 0.35;
            if (styleName === 'monster') wheelRadius = 0.58;
            var wheels = [];
            var suspensionPivots = [];
            var suspensionSprings = [];
            var wheelWidth = spec.bigWheels ? 0.34 : 0.27;

            function makeCoilSpring() {
                var springGroup = new THREE.Group();
                var coilMat = standard(0xc3ccd6, { metalness: 0.88, roughness: 0.22 });
                for (var ci = 0; ci < 7; ci++) {
                    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 14), coilMat);
                    ring.rotation.x = Math.PI / 2;
                    ring.position.y = ci * 0.058;
                    springGroup.add(ring);
                }
                var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), standard(0x22262c, { metalness: 0.7, roughness: 0.35 }));
                shaft.position.y = 0.19;
                springGroup.add(shaft);
                return springGroup;
            }

            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p, wi) {
                var wheelX = p[0] * (spec.width / 2 - 0.03);
                var wheelZ = p[1] * spec.len * 0.31;
                var pivot = new THREE.Group();
                pivot.position.set(wheelX, wheelRadius, wheelZ);
                pivot.userData.isSuspensionPivot = true;
                pivot.userData.restY = wheelRadius;
                pivot.userData.travel = 0;
                pivot.userData.side = p[0];
                pivot.userData.front = p[1] < 0;
                var wheel = makeWheel(wheelRadius, wheelWidth, rimColor, wheelRainbow && isPlayer);
                wheel.position.set(0, 0, 0);
                pivot.add(wheel);
                g.add(pivot);
                wheels.push(wheel);
                suspensionPivots.push(pivot);

                if (isPlayer) {
                    var spring = makeCoilSpring();
                    spring.position.set(wheelX * 0.94, wheelRadius - 0.04, wheelZ);
                    g.add(spring);
                    suspensionSprings.push(spring);
                    var arm = boxMesh(0.46, 0.07, 0.11, standard(0x2a2f36, { metalness: 0.65, roughness: 0.4 }));
                    arm.position.set(wheelX * 0.55, 0.16, wheelZ);
                    g.add(arm);
                    var caliper = boxMesh(0.1, 0.18, 0.14, new THREE.MeshStandardMaterial({
                        color: 0xd92032, metalness: 0.5, roughness: 0.35,
                        emissive: 0x6b000a, emissiveIntensity: 0.4
                    }));
                    caliper.position.set(p[0] * 0.02, 0, 0.02);
                    pivot.add(caliper);
                } else {
                    suspensionSprings.push(null);
                }

                if (spec.fenders) {
                    var fender = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.07, 0.06, 8, 16, Math.PI), bodyMat);
                    fender.rotation.y = Math.PI / 2;
                    fender.rotation.z = Math.PI;
                    fender.position.set(p[0] * (spec.width / 2 + 0.02), wheelRadius + 0.03, wheelZ);
                    g.add(fender);
                }
            });
            g.userData.wheels = wheels;

            // Indicator lamps on the rear corners, used by traffic logic.
            var lampMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
            var lampGeo = new THREE.SphereGeometry(0.13, 8, 8);
            var lampL = new THREE.Mesh(lampGeo, lampMat);
            lampL.position.set(-spec.width * 0.44, spec.ride + 0.44, spec.len / 2 + 0.08);
            lampL.visible = false; g.add(lampL);
            var lampR = new THREE.Mesh(lampGeo, lampMat);
            lampR.position.set(spec.width * 0.44, spec.ride + 0.44, spec.len / 2 + 0.08);
            lampR.visible = false; g.add(lampR);
            g.userData.leftLamp = lampL;
            g.userData.rightLamp = lampR;

            if (engineName) {
                var engine = makeEngine(engineName, engineGlowColor, spec);
                g.add(engine);
                g.userData.engineGlow = engine.userData.glowParts || [];
            }

            if (isPlayer) {
                var chromeMat = standard(0xcfd6dd, { metalness: 0.92, roughness: 0.18 });
                var plate = boxMesh(0.54, 0.15, 0.035, standard(0xf3f1e6, { roughness: 0.5 }));
                plate.position.set(0, spec.ride + 0.42, spec.len / 2 + 0.035);
                g.add(plate);
                var grille = boxMesh(spec.width * 0.46, 0.13, 0.04, standard(0x0d1116, { metalness: 0.8, roughness: 0.3 }));
                grille.position.set(0, spec.ride + 0.34, -spec.len / 2 - 0.02);
                g.add(grille);
                var lensMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.9, roughness: 0.15 });
                [-0.34, 0.34].forEach(function (lx) {
                    var lens = boxMesh(0.22, 0.09, 0.04, lensMat);
                    lens.position.set(lx * spec.width, spec.ride + 0.44, -spec.len / 2 - 0.03);
                    g.add(lens);
                });
                [-1, 1].forEach(function (side) {
                    var tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.2, 10), chromeMat);
                    tip.rotation.x = Math.PI / 2;
                    tip.position.set(side * spec.width * 0.28, spec.ride + 0.28, spec.len / 2 + 0.06);
                    g.add(tip);
                });
            }

            var shadow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 0.7, spec.len + 0.7), new THREE.MeshBasicMaterial({
                color: 0x6b4e2a, transparent: true, opacity: 0.28, depthWrite: false
            }));
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = 0.012; g.add(shadow);

            g.userData.spec = spec;
            g.userData.roofY = spec.ride + spec.hood + (spec.roof ? spec.cabinH : 0) + 0.06;

            // Keep the body separate from the wheel pivots so the shell can
            // pitch, roll, and squat while the wheels stay planted.
            var bodyGroup = new THREE.Group();
            var directChildren = g.children.slice();
            directChildren.forEach(function (child) {
                if (child.userData && child.userData.isSuspensionPivot) return;
                g.remove(child);
                bodyGroup.add(child);
            });
            g.add(bodyGroup);
            g.userData.bodyGroup = bodyGroup;
            g.userData.suspensionPivots = suspensionPivots;
            g.userData.suspensionSprings = suspensionSprings;
            return g;
        }

        function animateSuspension(car, dt, spd, travelDistance, roll, pitch, impulse) {
            var pivots = car.userData.suspensionPivots;
            if (!pivots) return;
            var springs = car.userData.suspensionSprings || [];
            var body = car.userData.bodyGroup;
            var speedFrac = Math.min(1, Math.abs(spd || 0) / 190);
            var avg = 0;
            for (var si = 0; si < pivots.length; si++) {
                var pivot = pivots[si];
                var side = pivot.userData.side || 1;
                var front = pivot.userData.front;
                var rough = Math.sin((travelDistance || 0) * 0.42 + si * 1.9) * 0.5 +
                    Math.sin((travelDistance || 0) * 0.11 + si * 0.7) * 0.5;
                var target = rough * (0.055 + speedFrac * 0.16);
                target += (roll || 0) * side * 0.26;
                target += (pitch || 0) * (front ? -1 : 1) * 0.2;
                target -= (impulse || 0) * 0.36;
                if (car === player && engineOn) target += Math.sin((travelDistance + si) * 34) * 0.005;
                var current = pivot.userData.travel || 0;
                current += (target - current) * Math.min(1, dt * 10);
                current = Math.max(-0.28, Math.min(0.28, current));
                pivot.userData.travel = current;
                pivot.position.y = pivot.userData.restY + current;
                if (springs[si]) springs[si].scale.y = Math.max(0.45, 1 + current * 2.4);
                avg += current;
            }
            if (body) {
                avg /= pivots.length;
                var bounce = (Math.sin((travelDistance || 0) * 0.2) * 0.5 +
                    Math.sin((travelDistance || 0) * 0.07 + 1.3) * 0.5) * (0.03 + speedFrac * 0.11);
                bounce -= (impulse || 0) * 0.2;
                bounce += avg * 0.3;
                bounce = Math.max(-0.22, Math.min(0.22, bounce));
                body.position.y += (bounce - body.position.y) * Math.min(1, dt * 9);
                body.rotation.z += ((roll || 0) * 0.4 - body.rotation.z) * Math.min(1, dt * 6);
                body.rotation.x += ((pitch || 0) * 0.7 - body.rotation.x) * Math.min(1, dt * 6);
            }
        }

        function buildSurfboard(color) {
            var g = new THREE.Group();
            var shape = new THREE.Shape();
            shape.moveTo(0, -1.28);
            shape.bezierCurveTo(0.38, -0.92, 0.36, 0.72, 0, 1.28);
            shape.bezierCurveTo(-0.36, 0.72, -0.38, -0.92, 0, -1.28);
            var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.075, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
            geo.rotateX(Math.PI / 2);
            var board = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, metalness: 0.12, roughness: 0.35 }));
            g.add(board);
            var stripe = boxMesh(0.1, 0.012, 2.1, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
            stripe.position.set(0, 0.055, 0); g.add(stripe);
            var finShape = new THREE.Shape();
            finShape.moveTo(0, 0);
            finShape.lineTo(0.22, 0.34);
            finShape.lineTo(0.05, 0.36);
            finShape.lineTo(-0.04, 0.02);
            var finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.035, bevelEnabled: false });
            var fin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 }));
            fin.position.set(0, -0.04, -1.12); fin.rotation.set(Math.PI / 2, 0, 0); g.add(fin);
            var rackMat = standard(0x3a3f47, { metalness: 0.7, roughness: 0.3 });
            [-0.55, 0.55].forEach(function (z) {
                var bar = cylinderMesh(0.035, 0.035, 1.45, 8, rackMat);
                bar.rotation.z = Math.PI / 2;
                bar.position.set(0, -0.06, z); g.add(bar);
            });
            return g;
        }

        var player = buildCar(paintColor, wheelColor, bodyStyle, engineStyle, engineColor, true);
        player.position.set(0, 0, 5);
        scene.add(player);

        // FSD lane visualization.
        var fsdLinesMat = new THREE.MeshBasicMaterial({
            color: 0x2fd4ff, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        var fsdFillMat = new THREE.MeshBasicMaterial({
            color: 0x1b9be0, transparent: true, opacity: 0.05,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        var fsdGroup = new THREE.Group();
        [-1.45, 1.45].forEach(function (side) {
            var line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 120), fsdLinesMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(side, 0.07, -55);
            fsdGroup.add(line);
        });
        var fsdFill = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 120), fsdFillMat);
        fsdFill.rotation.x = -Math.PI / 2;
        fsdFill.position.set(0, 0.05, -55);
        fsdGroup.add(fsdFill);
        fsdGroup.visible = false;
        scene.add(fsdGroup);

        // Surfboard and roof rack.
        var board = buildSurfboard(boardColor);
        board.position.set(0, player.userData.roofY, player.userData.spec.cabinZ || 0);
        board.rotation.y = 0.04;
        if (player.userData.spec.bed) board.position.z += 0.5;
        var bodyAttach = player.userData.bodyGroup || player;
        bodyAttach.add(board);
        player.userData.board = board;

        // Aero parts and body kits add real visual hardware (and performance
        // multipliers are supplied by the store).
        var carbonMat = standard(0x14181d, { metalness: 0.7, roughness: 0.28 });
        var carSpec = player.userData.spec;
        if (kitStyle === 'widebody' || kitStyle === 'track' || kitStyle === 'rally' || kitStyle === 'hyper' || kitStyle === 'gt3' || kitStyle === 'offroad') {
            var skirt = boxMesh(carSpec.width + 0.16, 0.13, carSpec.len * 0.68, carbonMat);
            skirt.position.set(0, carSpec.ride + 0.2, 0);
            bodyAttach.add(skirt);
            if (kitStyle === 'widebody' || kitStyle === 'hyper' || kitStyle === 'gt3' || kitStyle === 'offroad') {
                [-1, 1].forEach(function (side) {
                    [-1, 1].forEach(function (end) {
                        var flare = boxMesh(0.16, 0.2, 0.72, carbonMat);
                        flare.position.set(side * (carSpec.width / 2 + 0.04), carSpec.ride + 0.33, end * carSpec.len * 0.31);
                        bodyAttach.add(flare);
                    });
                });
            }
        }
        if (aeroStyle === 'splitter' || aeroStyle === 'active' || aeroStyle === 'gt3' || aeroStyle === 'ground' || aeroStyle === 'broken') {
            var splitter = boxMesh(carSpec.width + 0.52, 0.055, 0.5, carbonMat);
            splitter.position.set(0, 0.2, -carSpec.len / 2 - 0.08);
            bodyAttach.add(splitter);
        }
        if (aeroStyle === 'wing' || aeroStyle === 'active' || aeroStyle === 'gt3' || aeroStyle === 'ground') {
            var wing = boxMesh(carSpec.width * 0.94, 0.065, 0.44, carbonMat);
            wing.position.set(0, player.userData.roofY + 0.34, carSpec.len / 2 - 0.12);
            bodyAttach.add(wing);
            [-1, 1].forEach(function (side) {
                var support = boxMesh(0.06, 0.34, 0.06, carbonMat);
                support.position.set(side * carSpec.width * 0.34, player.userData.roofY + 0.16, carSpec.len / 2 - 0.12);
                bodyAttach.add(support);
            });
        }
        if (aeroStyle === 'broken') {
            var brokenWing = boxMesh(carSpec.width * 0.6, 0.05, 0.3, carbonMat);
            brokenWing.position.set(carSpec.width * 0.16, player.userData.roofY + 0.2, carSpec.len / 2 - 0.12);
            brokenWing.rotation.z = -0.28;
            brokenWing.rotation.x = 0.12;
            bodyAttach.add(brokenWing);
        }
        if (aeroStyle === 'diffuser' || aeroStyle === 'active' || aeroStyle === 'ground') {
            [-0.7, -0.25, 0.25, 0.7].forEach(function (fx) {
                var fin = boxMesh(0.05, 0.2, 0.42, carbonMat);
                fin.position.set(fx * carSpec.width * 0.4, 0.26, carSpec.len / 2 - 0.02);
                bodyAttach.add(fin);
            });
        }

        // Underglow: additive pool plus a real point light.
        var glowLight = null, glowPool = null;
        if (glowColor != null) {
            glowPool = new THREE.Mesh(
                new THREE.PlaneGeometry(3.2, 4.6),
                new THREE.MeshBasicMaterial({
                    color: glowColor, transparent: true, opacity: 0.34,
                    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                })
            );
            glowPool.rotation.x = -Math.PI / 2;
            glowPool.position.y = 0.085;
            player.add(glowPool);
            glowLight = new THREE.PointLight(glowColor, 1.6, 9, 2);
            glowLight.position.set(0, 0.45, 0);
            player.add(glowLight);
        }

        // Exhaust trail strips behind the bumper.
        var trailBits = [];
        if (trailColor != null) {
            for (var tb = 0; tb < 11; tb++) {
                var bit = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.2, 0.8),
                    new THREE.MeshBasicMaterial({
                        color: trailColor, transparent: true, opacity: 0.42,
                        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                    })
                );
                bit.position.set(tb % 2 ? 0.46 : -0.46, 0.52 + tb * 0.008, 1.8 + tb * 0.5);
                bit.rotation.x = -0.28;
                player.add(bit);
                trailBits.push(bit);
            }
        }

        /* ---------------- Checkpoints ---------------- */
        var CHECKPOINT_SPACING = 500;
        var CHECKPOINT_BONUS = 250;
        var CHECKPOINT_GATE_COUNT = 3;
        var checkpointsPassed = 0;
        var nextCheckpointDistance = CHECKPOINT_SPACING;
        var checkpointGates = [];
        var gateMat = neon(0x2ff6ff, 1.1);
        var gateSoftMat = new THREE.MeshBasicMaterial({
            color: 0x8ff8ff, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        var gateBannerMat = null;

        function makeGateBanner() {
            var canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 128;
            var g = canvas.getContext('2d');
            g.clearRect(0, 0, 512, 128);
            g.fillStyle = 'rgba(4, 18, 24, 0.82)';
            g.strokeStyle = '#2ff6ff';
            g.lineWidth = 6;
            var x = 18, y = 18, w = 476, h = 92, r = 22;
            g.beginPath();
            g.moveTo(x + r, y);
            g.lineTo(x + w - r, y);
            g.quadraticCurveTo(x + w, y, x + w, y + r);
            g.lineTo(x + w, y + h - r);
            g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            g.lineTo(x + r, y + h);
            g.quadraticCurveTo(x, y + h, x, y + h - r);
            g.lineTo(x, y + r);
            g.quadraticCurveTo(x, y, x + r, y);
            g.closePath();
            g.fill();
            g.stroke();
            g.font = 'bold 44px Arial, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillStyle = '#d8feff';
            g.fillText('CHECKPOINT', 256, 66);
            var texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            gateBannerMat = new THREE.SpriteMaterial({
                map: texture, transparent: true, depthTest: false, depthWrite: false
            });
        }
        makeGateBanner();

        function buildCheckpointGate(index) {
            var gate = new THREE.Group();
            var pillarGeo = new THREE.BoxGeometry(0.34, 7.6, 0.34);
            [-1, 1].forEach(function (side) {
                var pillar = new THREE.Mesh(pillarGeo, gateMat);
                pillar.position.set(side * (ROAD_W / 2 - 0.45), 3.8, 0);
                gate.add(pillar);
                var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 14), gateSoftMat);
                foot.position.set(side * (ROAD_W / 2 - 0.45), 0.14, 0);
                gate.add(foot);
            });
            var beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W - 0.5, 0.5, 0.5), gateMat);
            beam.position.set(0, 7.6, 0);
            gate.add(beam);

            var line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W - 1.4, 0.7), gateSoftMat);
            line.rotation.x = -Math.PI / 2;
            line.position.y = 0.03;
            gate.add(line);

            var banner = new THREE.Sprite(gateBannerMat);
            banner.scale.set(8.2, 2.05, 1);
            banner.position.set(0, 9.1, 0);
            banner.renderOrder = 18;
            gate.add(banner);

            gate.userData.distance = CHECKPOINT_SPACING * (index + 1);
            gate.userData.index = index;
            return gate;
        }

        for (var cgi = 0; cgi < CHECKPOINT_GATE_COUNT; cgi++) {
            var cpGate = buildCheckpointGate(cgi);
            cpGate.position.set(0, 0, player.position.z - cpGate.userData.distance);
            scene.add(cpGate);
            checkpointGates.push(cpGate);
        }

        function flashCheckpointHud() {
            tone(1046, 0.18, 'sine', 0.055, 1568);
            var el = document.getElementById('g3dCheckpoint');
            if (!el) return;
            setPillText('g3dCheckpoint', checkpointsPassed);
            el.classList.remove('is-hit');
            void el.offsetWidth;
            el.classList.add('is-hit');
            var pill = el.parentNode;
            if (pill) {
                pill.classList.remove('is-hit');
                void pill.offsetWidth;
                pill.classList.add('is-hit');
            }
        }

        function updateCheckpoints() {
            while (distance >= nextCheckpointDistance) {
                checkpointsPassed++;
                nextCheckpointDistance += CHECKPOINT_SPACING;
                flashCheckpointHud();
            }
            for (var gi = 0; gi < checkpointGates.length; gi++) {
                var gate = checkpointGates[gi];
                if (gate.userData.distance + 40 < distance) {
                    gate.userData.distance += CHECKPOINT_SPACING * CHECKPOINT_GATE_COUNT;
                }
                var rel = gate.userData.distance - distance;
                var gateZ = player.position.z - rel;
                gate.position.z = gateZ;
                gate.position.x = roadCurveOffset(gateZ) - roadCurveOffset(player.position.z);
                gate.rotation.y = -roadTangentAt(gateZ);
                gate.visible = rel > -16 && rel < 620;
                var near = Math.max(0, 1 - Math.abs(rel) / 70);
                gate.scale.setScalar(1 + near * 0.02);
            }
            gateMat.emissiveIntensity = 1.05 + Math.sin(elapsed * 5) * 0.4;
            gateSoftMat.opacity = 0.45 + Math.sin(elapsed * 5) * 0.16;
        }

        /* ---------------- Highway ramps, merges, speed lines ---------------- */
        var RAMP_SPACING = 900;
        var RAMP_SLOTS = 4;
        var EXIT_BONUS = 500;
        var exitHintText = '';
        var rampFeatures = [];

        function rampSignTexture(label, color) {
            return makeCanvasTexture(256, 96, function (g, w, h) {
                g.fillStyle = color;
                g.fillRect(0, 0, w, h);
                g.strokeStyle = 'rgba(255,255,255,0.85)';
                g.lineWidth = 5;
                g.strokeRect(6, 6, w - 12, h - 12);
                g.fillStyle = '#ffffff';
                g.font = 'bold 40px Arial, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillText(label, w / 2, h / 2 + 2);
            });
        }

        function buildRamp(type) {
            var g = new THREE.Group();
            var asphalt = standard(0x343944, { roughness: 0.92 });
            var ramp = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 40), asphalt);
            ramp.rotation.x = -Math.PI / 2;
            ramp.position.set(ROAD_W / 2 + 5.2, 0.015, 0);
            g.add(ramp);

            var edgeColor = type === 'exit' ? 0xffc24a : 0x6dffc0;
            var edge = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 40), new THREE.MeshBasicMaterial({
                color: edgeColor, transparent: true, opacity: 0.8,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            }));
            edge.rotation.x = -Math.PI / 2;
            edge.position.set(ROAD_W / 2 + 0.15, 0.03, 0);
            g.add(edge);

            var signTex = rampSignTexture(type === 'exit' ? 'EXIT  →' : 'ON RAMP ↑', type === 'exit' ? '#1c7a4a' : '#1c5a9a');
            var sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.35, 0.16), standard(0x0c1418, { metalness: 0.4 }));
            sign.position.set(ROAD_W / 2 + 2.7, 5.4, 0);
            g.add(sign);
            var face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.18), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
            face.position.set(ROAD_W / 2 + 2.7, 5.4, 0.1);
            g.add(face);
            var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 5.1, 8), standard(0x8b929c, { metalness: 0.6 }));
            pole.position.set(ROAD_W / 2 + 2.7, 2.55, -0.05);
            g.add(pole);

            // Simple guard rail along the ramp edge.
            var rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 40), standard(0xd7dde5, { metalness: 0.5, roughness: 0.4 }));
            rail.position.set(ROAD_W / 2 + 10.3, 0.62, 0);
            g.add(rail);

            g.userData.type = type;
            return g;
        }

        for (var rfi = 0; rfi < RAMP_SLOTS; rfi++) {
            var rampType = rfi % 2 === 0 ? 'exit' : 'entry';
            var rampGroup = buildRamp(rampType);
            var rampFeature = {
                distance: 750 + rfi * RAMP_SPACING,
                type: rampType,
                group: rampGroup,
                spawned: false
            };
            rampGroup.position.set(0, 0, player.position.z - rampFeature.distance);
            scene.add(rampGroup);
            rampFeatures.push(rampFeature);
        }

        function spawnMergeCar(featureZ) {
            var style = ['truck', 'suv', 'van', 'classic'][Math.floor(Math.random() * 4)];
            var car = buildCar(
                colors[Math.floor(Math.random() * colors.length)],
                null,
                style,
                'stock',
                null,
                false
            );
            var lane = LANES.length - 1;
            var u = car.userData;
            car.position.set(ROAD_W / 2 + 6.2, 0, featureZ);
            u.logicalX = ROAD_W / 2 + 6.2;
            u.lane = lane;
            u.targetLane = lane;
            u.state = 'merge';
            u.changeT = 0;
            u.fromX = ROAD_W / 2 + 6.2;
            u.toX = LANES[lane];
            u.cruiseSpeed = 16 + Math.random() * 12;
            u.normalCruiseSpeed = u.cruiseSpeed;
            u.signal = 1;
            u.signalT = 0;
            u.blinkT = 0;
            u.fromLane = lane;
            u.decisionT = 2;
            scene.add(car);
            traffic.push(car);
        }

        function updateRamps() {
            exitHintText = '';
            var exitEnded = false;
            for (var ri = 0; ri < rampFeatures.length; ri++) {
                var feature = rampFeatures[ri];
                var rel = feature.distance - distance;
                if (rel < -60) {
                    feature.distance += RAMP_SPACING * RAMP_SLOTS;
                    feature.spawned = false;
                    rel = feature.distance - distance;
                }
                var featureZ = player.position.z - rel;
                feature.group.position.z = featureZ;
                feature.group.position.x = roadCurveOffset(featureZ) - roadCurveOffset(player.position.z);
                feature.group.rotation.y = -roadTangentAt(featureZ);
                feature.group.visible = rel > -50 && rel < 520;

                if (feature.type === 'entry') {
                    if (!feature.spawned && rel < 460 && rel > 200) {
                        feature.spawned = true;
                        spawnMergeCar(player.position.z - rel);
                    }
                } else {
                    if (rel < 170 && rel > -8) exitHintText = 'EXIT →';
                    if (rel <= 2 && rel >= -8 && player.position.x > maxX - 1.05) {
                        exitEnded = true;
                    }
                }
            }
            if (exitEnded) {
                tone(660, 0.3, 'triangle', 0.07, 990);
                endGame(distance + checkpointsPassed * CHECKPOINT_BONUS + driftScore + EXIT_BONUS);
                return true;
            }
            return false;
        }

        /* ---------------- Coins and jump ramps ---------------- */
        var coinGeo = new THREE.TorusGeometry(0.34, 0.1, 8, 18);
        var coinMat = new THREE.MeshStandardMaterial({
            color: 0xffcf4d, emissive: 0xffb703, emissiveIntensity: 0.85,
            metalness: 0.85, roughness: 0.22
        });
        var trackCoins = [];
        for (var tci = 0; tci < 16; tci++) {
            var coinMesh = new THREE.Mesh(coinGeo, coinMat);
            coinMesh.position.y = 1.15;
            coinMesh.userData.distance = 180 + tci * 75;
            coinMesh.userData.laneX = LANES[tci % LANES.length];
            coinMesh.userData.collected = false;
            scene.add(coinMesh);
            trackCoins.push(coinMesh);
        }

        function updateCoins(prevDistance) {
            for (var ci = 0; ci < trackCoins.length; ci++) {
                var coin = trackCoins[ci];
                if (coin.userData.distance + 60 < distance) {
                    coin.userData.distance += trackCoins.length * 75;
                    coin.userData.laneX = LANES[Math.floor(Math.random() * LANES.length)];
                    coin.userData.collected = false;
                }
                var rel = coin.userData.distance - distance;
                var coinZ = player.position.z - rel;
                coin.position.set(coin.userData.laneX + (roadCurveOffset(coinZ) - roadCurveOffset(player.position.z)), 1.15, coinZ);
                coin.rotation.z += 0.055;
                coin.visible = !coin.userData.collected && rel > -12 && rel < 340;
                if (!coin.userData.collected &&
                    coin.userData.distance > prevDistance - 2 && coin.userData.distance <= distance + 2 &&
                    Math.abs(coin.userData.laneX - player.position.x) < 1.4) {
                    coin.userData.collected = true;
                    coin.visible = false;
                    coinsCollected++;
                    tone(880, 0.12, 'square', 0.05, 1320);
                    updateRaceHud();
                }
            }
        }

        var JUMP_RAMP_SPACING = 720;
        var jumpRamps = [];

        function buildJumpRamp() {
            var group = new THREE.Group();
            var deckMat = standard(0x3a4049, { metalness: 0.5, roughness: 0.55 });
            var deck = boxMesh(3.3, 0.24, 8.8, deckMat);
            deck.rotation.x = 0.26;
            deck.position.set(0, 0.85, 0);
            group.add(deck);
            var brace = boxMesh(3.4, 0.32, 2.2, standard(0x23272e, { metalness: 0.6 }));
            brace.position.set(0, 0.16, 3.1);
            group.add(brace);
            [-1, 1].forEach(function (side) {
                var stripe = boxMesh(0.16, 0.06, 8.7, new THREE.MeshBasicMaterial({ color: 0xffc400 }));
                stripe.rotation.x = 0.26;
                stripe.position.set(side * 1.55, 0.9, 0);
                group.add(stripe);
            });
            var signTex = rampSignTexture('JUMP ▲', '#7a4a00');
            var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
            sign.position.set(0, 2.9, 3.4);
            group.add(sign);
            return group;
        }

        for (var jri = 0; jri < 3; jri++) {
            var jumpGroup = buildJumpRamp();
            var jumpLane = LANES[jri % LANES.length];
            jumpGroup.userData.distance = 420 + jri * JUMP_RAMP_SPACING;
            jumpGroup.userData.laneX = jumpLane;
            jumpGroup.position.set(jumpLane, 0, player.position.z - jumpGroup.userData.distance);
            scene.add(jumpGroup);
            jumpRamps.push(jumpGroup);
        }

        function updateJumpRamps(prevDistance) {
            for (var ji = 0; ji < jumpRamps.length; ji++) {
                var ramp = jumpRamps[ji];
                if (ramp.userData.distance + 80 < distance) {
                    ramp.userData.distance += jumpRamps.length * JUMP_RAMP_SPACING;
                    ramp.userData.laneX = LANES[Math.floor(Math.random() * LANES.length)];
                }
                var rel = ramp.userData.distance - distance;
                var rampZ = player.position.z - rel;
                ramp.position.set(ramp.userData.laneX + (roadCurveOffset(rampZ) - roadCurveOffset(player.position.z)), 0, rampZ);
                ramp.rotation.y = -roadTangentAt(rampZ);
                ramp.visible = rel > -45 && rel < 480;
                if (playerY < 0.2 && Math.abs(speed) > 25 && Math.abs(ramp.userData.laneX - player.position.x) < 1.8 &&
                    ramp.userData.distance > prevDistance && ramp.userData.distance <= distance + 2) {
                    vy = Math.min(34, 12 + Math.abs(speed) * 0.11);
                    playerY = 0.3;
                    tone(160, 0.28, 'sawtooth', 0.07, 320);
                }
            }
        }

        function updateRaceHud() {
            var ign = document.getElementById('g3dIgnition');
            if (ign) {
                ign.style.display = engineOn ? 'none' : 'flex';
                var fill = document.getElementById('g3dIgnitionFill');
                if (fill) fill.style.width = Math.round(ignition * 100) + '%';
            }
            var nitroWrap = document.getElementById('g3dNitro');
            if (nitroWrap) {
                nitroWrap.classList.toggle('is-active', nitroActive);
                var nitroFill = document.getElementById('g3dNitroFill');
                if (nitroFill) nitroFill.style.width = Math.round(nitro) + '%';
            }
            var coinEl = document.getElementById('g3dRunCoins');
            if (coinEl) setPillText('g3dRunCoins', coinsCollected);
        }

        /* ---------------- Crash physics and debris ---------------- */
        var crashActive = false;
        var crashRealT = 0;
        var crashStartMs = 0;
        var crashScore = 0;
        var crashVx = 0, crashSpinX = 0, crashSpinY = 0, crashSpinZ = 0;
        var warningT = 0;
        var crashCar = null, crashCarVx = 0, crashCarVz = 0, crashCarSpin = 0;
        var crashWheel = null, crashWheelVx = 0, crashWheelVy = 0, crashWheelVz = 0, crashWheelSpin = 0;
        var crashBoard = null, crashBoardVx = 0, crashBoardVy = 0, crashBoardVz = 0, crashBoardSpin = 0;
        var crashDebris = [];
        var debrisColors = [0xd9e2ec, 0xff4d5e, 0x2b2b2b, 0xffd166, 0x4cc9f0];        for (var cdi = 0; cdi < 26; cdi++) {
            var debrisMat = new THREE.MeshBasicMaterial({ color: debrisColors[cdi % debrisColors.length] });
            var debrisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09 + Math.random() * 0.12, 0.06 + Math.random() * 0.1, 0.05 + Math.random() * 0.1), debrisMat);
            debrisMesh.visible = false;
            scene.add(debrisMesh);
            crashDebris.push({
                mesh: debrisMesh, vx: 0, vy: 0, vz: 0,
                spinX: 0, spinY: 0, spinZ: 0, life: 0
            });
        }

        /* Sparks: cheap additive points that burst on impact and bounces. */
        var SPARK_COUNT = 160;
        var sparkGeometry = new THREE.BufferGeometry();
        var sparkPositions = new Float32Array(SPARK_COUNT * 3);
        var sparkVelocities = new Float32Array(SPARK_COUNT * 3);
        var sparkLives = new Float32Array(SPARK_COUNT);
        for (var spi = 0; spi < SPARK_COUNT; spi++) {
            sparkPositions[spi * 3 + 1] = -999;
        }
        sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        var sparkMaterial = new THREE.PointsMaterial({
            color: 0xffc24a, size: 0.16, transparent: true, opacity: 0.95,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        });
        var sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
        sparkPoints.frustumCulled = false;
        scene.add(sparkPoints);
        var sparkCursor = 0;

        function spawnSparks(x, y, z, count) {
            for (var n = 0; n < count; n++) {
                var i = sparkCursor % SPARK_COUNT;
                sparkCursor++;
                sparkPositions[i * 3] = x + (Math.random() - 0.5) * 1.2;
                sparkPositions[i * 3 + 1] = y + Math.random() * 0.6;
                sparkPositions[i * 3 + 2] = z + (Math.random() - 0.5) * 1.2;
                sparkVelocities[i * 3] = (Math.random() - 0.5) * 26;
                sparkVelocities[i * 3 + 1] = 6 + Math.random() * 20;
                sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 20;
                sparkLives[i] = 0.5 + Math.random() * 0.9;
            }
            sparkGeometry.attributes.position.needsUpdate = true;
        }

        function updateSparks(dt) {
            var changed = false;
            for (var i = 0; i < SPARK_COUNT; i++) {
                if (sparkLives[i] <= 0) continue;
                sparkLives[i] -= dt;
                var ix = i * 3;
                sparkPositions[ix] += sparkVelocities[ix] * dt;
                sparkPositions[ix + 1] += sparkVelocities[ix + 1] * dt;
                sparkPositions[ix + 2] += sparkVelocities[ix + 2] * dt;
                sparkVelocities[ix + 1] -= 32 * dt;
                if (sparkPositions[ix + 1] < 0.06) {
                    sparkPositions[ix + 1] = 0.06;
                    sparkVelocities[ix + 1] = Math.abs(sparkVelocities[ix + 1]) * 0.32;
                    sparkVelocities[ix] *= 0.6;
                    sparkVelocities[ix + 2] *= 0.6;
                }
                if (sparkLives[i] <= 0) sparkPositions[ix + 1] = -999;
                changed = true;
            }
            if (changed) sparkGeometry.attributes.position.needsUpdate = true;
        }

        function spawnCrashDebris(x, z) {
            for (var di = 0; di < crashDebris.length; di++) {
                var d = crashDebris[di];
                d.mesh.visible = true;
                d.mesh.position.set(x + (Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.5, z);
                d.mesh.scale.setScalar(1);
                d.vx = (Math.random() - 0.5) * 16;
                d.vy = 4 + Math.random() * 12;
                d.vz = (Math.random() - 0.5) * 12 - 2;
                d.spinX = (Math.random() - 0.5) * 14;
                d.spinY = (Math.random() - 0.5) * 14;
                d.spinZ = (Math.random() - 0.5) * 14;
                d.life = 1.7 + Math.random() * 0.6;
            }
        }

        function updateCrashDebris(dt) {
            for (var ui = 0; ui < crashDebris.length; ui++) {
                var d = crashDebris[ui];
                if (d.life <= 0) { d.mesh.visible = false; continue; }
                d.life -= dt;
                d.mesh.position.x += d.vx * dt;
                d.mesh.position.y += d.vy * dt;
                d.mesh.position.z += d.vz * dt;
                d.vy -= 24 * dt;
                d.mesh.rotation.x += d.spinX * dt;
                d.mesh.rotation.y += d.spinY * dt;
                d.mesh.rotation.z += d.spinZ * dt;
                d.mesh.scale.setScalar(Math.max(0.05, Math.min(1, d.life)));
                if (d.mesh.position.y < 0.05) { d.mesh.position.y = 0.05; d.vy = Math.abs(d.vy) * 0.3; }
                if (d.life <= 0) d.mesh.visible = false;
            }
        }

        function spawnCrashSmoke(x, z, count) {
            for (var n = 0; n < count; n++) {
                var entry = driftPuffs[driftPuffCursor % driftPuffs.length];
                driftPuffCursor++;
                entry.life = 0.9 + Math.random() * 0.4;
                entry.sprite.position.set(x + (Math.random() - 0.5) * 1.8, 0.3 + Math.random() * 0.5, z + (Math.random() - 0.5) * 2);
                entry.sprite.scale.set(1 + Math.random() * 0.8, 1 + Math.random() * 0.8, 1);
            }
        }

        function triggerCrash(car, halfWidth) {
            if (crashActive) return;
            fsdActive = false;
            var fsdOverlay = document.getElementById('g3dFsd');
            if (fsdOverlay) fsdOverlay.classList.remove('is-active');
            crashActive = true;
            crashRealT = 0;
            crashStartMs = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
            crashScore = distance + checkpointsPassed * CHECKPOINT_BONUS + driftScore;
            var spec = car.userData && car.userData.spec ? car.userData.spec : {};
            var mass = Math.max(0.8, Math.min(2.2, ((spec.width || 1.8) * (spec.len || 3.2)) / 8));
            var dir = player.position.x >= car.position.x ? 1 : -1;
            crashVx = dir * (6 + Math.min(18, Math.abs(speed) * 0.08)) * mass;
            crashSpinX = (Math.random() - 0.5) * 1.0;
            crashSpinY = dir * (0.9 + Math.random() * 1.1);
            crashSpinZ = dir * (0.5 + Math.random() * 0.9);
            vy = 5 + Math.min(10, Math.abs(speed) * 0.045);
            playerY = 0.3;
            speed *= 0.25;
            crashCar = car;
            crashCarVx = -dir * (4 + Math.random() * 6) * mass;
            crashCarVz = 4 + Math.random() * 8;
            crashCarSpin = -dir * (0.8 + Math.random() * 1.2);
            if (car.userData) car.userData.state = 'hit';

            var body = player.userData.bodyGroup;
            if (body) {
                var crumple = Math.min(0.14, Math.abs(speed) * 0.0008 + 0.03);
                body.scale.z = Math.max(0.86, 1 - crumple);
                body.scale.x = 1 + crumple * 0.5;
            }

            if (Math.abs(speed) > 40) {
                var pivots = player.userData.suspensionPivots || [];
                var springs = player.userData.suspensionSprings || [];
                if (pivots.length) {
                    crashWheel = pivots.pop();
                    springs.pop();
                    scene.attach(crashWheel);
                    crashWheelVx = dir * (6 + Math.random() * 8);
                    crashWheelVy = 5 + Math.random() * 6;
                    crashWheelVz = (Math.random() - 0.3) * 10;
                    crashWheelSpin = (Math.random() - 0.5) * 8;
                }
                if (player.userData.board) {
                    crashBoard = player.userData.board;
                    scene.attach(crashBoard);
                    crashBoardVx = dir * (5 + Math.random() * 7);
                    crashBoardVy = 5 + Math.random() * 7;
                    crashBoardVz = (Math.random() - 0.4) * 9;
                    crashBoardSpin = (Math.random() - 0.5) * 9;
                }
            }

            spawnCrashDebris(car.position.x, car.position.z);
            spawnSparks(car.position.x, 0.9, car.position.z, 110);
            spawnCrashSmoke(car.position.x, car.position.z, 8);
            crashSound();
            tone(70, 0.8, 'sawtooth', 0.12, 30);
            var flash = document.getElementById('g3dCrashFlash');
            if (flash) flash.classList.add('is-active');
            var warn = document.getElementById('g3dWarning');
            if (warn) warn.classList.remove('is-active');
        }

        function updateCrash(dt) {
            var nowMs = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
            crashRealT = (nowMs - crashStartMs) / 1000;
            // Tumble and slide the player car.
            player.position.x += crashVx * dt;
            crashVx *= Math.max(0, 1 - dt * 0.7);
            playerY += vy * dt;
            vy -= 26 * dt;
            if (playerY <= 0) {
                playerY = 0;
                if (vy < -2) {
                    vy = -vy * 0.26;
                    suspensionImpulse = 0.9;
                    spawnSparks(player.position.x, 0.35, player.position.z, 26);
                    spawnCrashSmoke(player.position.x, player.position.z, 3);
                } else vy = 0;
            }
            player.position.y = playerY;
            player.rotation.x += crashSpinX * dt;
            player.rotation.y += crashSpinY * dt;
            player.rotation.z += crashSpinZ * dt;
            crashSpinX *= Math.max(0, 1 - dt * 1.3);
            crashSpinY *= Math.max(0, 1 - dt * 0.65);
            crashSpinZ *= Math.max(0, 1 - dt * 1.0);
            speed = Math.max(0, speed - 40 * dt);
            animateSuspension(player, dt, speed, distance, player.rotation.z, 1, suspensionImpulse);
            suspensionImpulse *= Math.max(0, 1 - dt * 4);

            // The struck car gets knocked aside.
            if (crashCar) {
                crashCar.position.x += crashCarVx * dt;
                crashCar.position.z += crashCarVz * dt;
                crashCar.rotation.y += crashCarSpin * dt;
                crashCar.rotation.z += crashCarSpin * 0.6 * dt;
                crashCarVx *= Math.max(0, 1 - dt * 0.8);
                crashCarVz *= Math.max(0, 1 - dt * 0.8);
            }
            updateCrashDebris(dt);
            updateSparks(dt);
            updateDriftPuffs(dt, false);

            if (crashWheel) {
                crashWheel.position.x += crashWheelVx * dt;
                crashWheel.position.y += crashWheelVy * dt;
                crashWheel.position.z += crashWheelVz * dt;
                crashWheelVy -= 24 * dt;
                crashWheel.rotation.x += crashWheelSpin * dt;
                crashWheel.rotation.z += crashWheelSpin * 0.7 * dt;
                if (crashWheel.position.y < 0.33) {
                    crashWheel.position.y = 0.33;
                    crashWheelVy = Math.abs(crashWheelVy) * 0.35;
                    crashWheelVx *= 0.7;
                    crashWheelVz *= 0.7;
                    crashWheelSpin *= 0.7;
                }
            }

            if (crashBoard) {
                crashBoard.position.x += crashBoardVx * dt;
                crashBoard.position.y += crashBoardVy * dt;
                crashBoard.position.z += crashBoardVz * dt;
                crashBoardVy -= 20 * dt;
                crashBoard.rotation.x += crashBoardSpin * dt;
                crashBoard.rotation.y += crashBoardSpin * 0.6 * dt;
                if (crashBoard.position.y < 0.2) {
                    crashBoard.position.y = 0.2;
                    crashBoardVy = Math.abs(crashBoardVy) * 0.3;
                    crashBoardVx *= 0.6;
                    crashBoardVz *= 0.6;
                    crashBoardSpin *= 0.5;
                }
            }

            // Slow-motion crash camera (no shake).
            camera.position.x = player.position.x * 0.8;
            camera.position.y = 4.1 + playerY * 0.7;
            camera.lookAt(player.position.x, 0.8 + playerY * 0.9, player.position.z - 6);
            var fov = 56 + Math.min(10, crashRealT * 4);
            camera.fov = fov;
            camera.updateProjectionMatrix();

            if (window.Games3D) { /* keeps HUD update cheap */ }
            setHud(crashScore, 'CRASH', 'X');
            updateAudio();

            if (crashRealT > 5.5) {
                var flash = document.getElementById('g3dCrashFlash');
                if (flash) flash.classList.remove('is-active');
                crashActive = false;
                endGame(crashScore);
            }
        }

        /* ---------------- Drift smoke ---------------- */
        var driftPuffTex = makeCanvasTexture(64, 64, function (g, w, h) {
            var grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
            grad.addColorStop(0, 'rgba(240,244,248,0.9)');
            grad.addColorStop(0.55, 'rgba(210,218,226,0.45)');
            grad.addColorStop(1, 'rgba(200,208,216,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, w, h);
        });
        var driftPuffs = [];
        for (var dpi = 0; dpi < 20; dpi++) {
            var puffMat = new THREE.SpriteMaterial({
                map: driftPuffTex, transparent: true, opacity: 0,
                depthWrite: false, color: 0xdfe6ee
            });
            var puff = new THREE.Sprite(puffMat);
            puff.visible = false;
            puff.scale.set(1.2, 1.2, 1);
            scene.add(puff);
            driftPuffs.push({ sprite: puff, life: 0 });
        }
        var driftPuffCursor = 0;
        var driftPuffTimer = 0;

        function updateDriftPuffs(dt, drifting) {
            driftPuffTimer -= dt;
            if (drifting && driftPuffTimer <= 0) {
                driftPuffTimer = 0.055;
                var entry = driftPuffs[driftPuffCursor % driftPuffs.length];
                driftPuffCursor++;
                entry.life = 0.75;
                entry.sprite.position.set(
                    player.position.x + (Math.random() - 0.5) * 1.6,
                    playerY + 0.35,
                    player.position.z + 1.7 + Math.random() * 0.5
                );
                entry.sprite.scale.set(0.9 + Math.random() * 0.7, 0.9 + Math.random() * 0.7, 1);
            }
            for (var pi = 0; pi < driftPuffs.length; pi++) {
                var p = driftPuffs[pi];
                if (p.life <= 0) { p.sprite.visible = false; continue; }
                p.life -= dt;
                p.sprite.visible = p.life > 0;
                p.sprite.material.opacity = Math.max(0, p.life / 0.75) * 0.55;
                var grow = 1 + (0.75 - p.life) * 2.4;
                p.sprite.scale.set(grow, grow * 0.85, 1);
                p.sprite.position.y += dt * 1.1;
                p.sprite.position.z += speed * dt * 0.75;
            }
        }

        /* ---------------- Multiplayer ghost racers ---------------- */
        var remoteCars = {};
        var localNameLabel = null;
        var localNameText = '';

        function roundRectPath(g, x, y, w, h, r) {
            g.beginPath();
            g.moveTo(x + r, y);
            g.lineTo(x + w - r, y);
            g.quadraticCurveTo(x + w, y, x + w, y + r);
            g.lineTo(x + w, y + h - r);
            g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            g.lineTo(x + r, y + h);
            g.quadraticCurveTo(x, y + h, x, y + h - r);
            g.lineTo(x, y + r);
            g.quadraticCurveTo(x, y, x + r, y);
            g.closePath();
        }

        function makeNameSprite(name, accent) {
            var label = String(name == null ? 'Player' : name).replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';
            var canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 128;
            var g = canvas.getContext('2d');
            g.font = 'bold 46px Arial, sans-serif';
            var boxW = Math.min(486, Math.max(150, g.measureText(label).width + 64));
            var x = (512 - boxW) / 2, y = 24, h = 80, r = 40;
            var accentStyle = '#9fd8ff';
            try { accentStyle = new THREE.Color(accent == null ? 0xef476f : accent).getStyle(); } catch (e) {}
            roundRectPath(g, x, y, boxW, h, r);
            g.fillStyle = 'rgba(8,12,20,0.8)';
            g.fill();
            g.lineWidth = 6;
            g.strokeStyle = accentStyle;
            g.stroke();
            g.fillStyle = '#ffffff';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(label, 256, y + h / 2 + 2);

            var texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            var material = new THREE.SpriteMaterial({
                map: texture, transparent: true, depthTest: false, depthWrite: false
            });
            var sprite = new THREE.Sprite(material);
            sprite.scale.set(4.8, 1.2, 1);
            sprite.renderOrder = 20;
            return sprite;
        }

        function removeRemote(entry) {
            if (!entry) return;
            scene.remove(entry.car);
            disposeObject(entry.car);
            delete remoteCars[entry.id];
        }

        function addRemoteRacer(data) {
            var paint = typeof data.paint === 'number' ? data.paint : 0xef476f;
            var wheel = typeof data.wheel === 'number' ? data.wheel : null;
            var engineColor = typeof data.engineColor === 'number' ? data.engineColor : null;
            var car = buildCar(
                paint,
                wheel,
                data.body || 'classic',
                data.engine || 'stock',
                engineColor,
                false
            );
            var label = makeNameSprite(data.name, paint);
            label.position.set(0, car.userData.roofY + 1.05, 0);
            car.add(label);
            car.position.set(typeof data.x === 'number' ? data.x : 0, 0, player.position.z);
            scene.add(car);
            var entry = {
                id: data.id,
                car: car,
                label: label,
                state: data,
                displayX: typeof data.x === 'number' ? data.x : 0,
                displayDistance: typeof data.distance === 'number' ? data.distance : distance,
                styleKey: [data.body, data.engine, data.paint, data.wheel, data.engineColor, data.name].join('|')
            };
            remoteCars[data.id] = entry;
            return entry;
        }

        function setRemoteRacers(list) {
            var seen = {};
            list = list || [];
            for (var i = 0; i < list.length; i++) {
                var data = list[i];
                if (!data || !data.id) continue;
                seen[data.id] = true;
                var key = [data.body, data.engine, data.paint, data.wheel, data.engineColor, data.name].join('|');
                var entry = remoteCars[data.id];
                if (!entry || entry.styleKey !== key) {
                    removeRemote(entry);
                    entry = addRemoteRacer(data);
                }
                entry.state = data;
            }
            for (var id in remoteCars) {
                if (!seen[id]) removeRemote(remoteCars[id]);
            }
        }

        function setLocalRacerName(name) {
            if (localNameLabel) {
                player.remove(localNameLabel);
                disposeObject(localNameLabel);
                localNameLabel = null;
            }
            localNameText = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 16);
            // Your own name is shown to the other racers above your car. Drawing it
            // in the chase camera would sit in the middle of the road and block the view.
        }

        function updateRemoteRacers(dt) {
            for (var id in remoteCars) {
                var entry = remoteCars[id];
                var data = entry.state || {};
                var targetX = typeof data.x === 'number' ? data.x : 0;
                targetX = Math.max(-maxX, Math.min(maxX, targetX));
                var dx = targetX - entry.displayX;
                entry.displayX += dx * Math.min(1, dt * 12);
                var targetDistance = typeof data.distance === 'number' ? data.distance : entry.displayDistance;
                entry.displayDistance += (targetDistance - entry.displayDistance) * Math.min(1, dt * 9);

                entry.car.position.x = entry.displayX;
                entry.car.position.z = player.position.z - (entry.displayDistance - distance);
                entry.car.rotation.y -= entry.curveRot || 0;
                entry.car.rotation.y = Math.max(-0.35, Math.min(0.35, -dx * 0.9));
                entry.car.rotation.z = Math.max(-0.12, Math.min(0.12, dx * 0.45));
                entry.curveRot = -roadTangentAt(entry.car.position.z);
                entry.car.rotation.y += entry.curveRot;

                var remoteSpeed = typeof data.speed === 'number' ? data.speed : 0;
                var z = entry.car.position.z;
                var wheels = entry.car.userData.wheels || [];
                for (var wi2 = 0; wi2 < wheels.length; wi2++) {
                    wheels[wi2].rotation.x += Math.max(1, remoteSpeed) * dt * 1.2;
                }
                animateSuspension(entry.car, dt, remoteSpeed, distance - z, 0, 0, 0);

                // Behind the chase camera or far out of the fog: hide the ghost.
                entry.car.visible = z > -520 && z < 8.8;
            }
        }

        var traffic = [];
        var colors = [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf78c6b, 0xf7f3e8, 0x7f8c8d, 0x9b5de5];
        var trafficStyles = ['classic', 'buggy', 'wagon', 'truck', 'suv', 'racer', 'van', 'roadster', 'muscle', 'retro', 'taxi', 'cyber', 'suv', 'truck', 'bus', 'bus'];
        var trafficEngines = ['stock', 'stock', 'v8', 'turbo', 'electric', 'diesel', 'twin'];

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
            var z = forceZ != null ? forceZ : (-380 - Math.random() * 180);
            var order = [];
            for (var oi = 0; oi < LANES.length; oi++) order.push(oi);
            order.sort(function () { return Math.random() - 0.5; });
            var lane = order[0];
            for (var i = 0; i < order.length; i++) {
                if (!laneBusy(order[i], null, z, 16)) { lane = order[i]; break; }
            }
            var isMad = Math.random() < 0.01;
            var isRamp = !isMad && Math.random() < 0.055;
            var style = isMad ? 'cyber' : isRamp ? 'truck' : trafficStyles[Math.floor(Math.random() * trafficStyles.length)];
            var engine = isMad ? 'nitro' : isRamp ? 'diesel' : trafficEngines[Math.floor(Math.random() * trafficEngines.length)];
            var paint = isMad ? 0xff1f1f : isRamp ? 0xffc400 : colors[Math.floor(Math.random() * colors.length)];
            var car = buildCar(
                paint,
                Math.random() < 0.3 ? colors[Math.floor(Math.random() * colors.length)] : null,
                style,
                engine,
                isMad ? 0xff3b00 : null,
                false
            );
            car.position.set(LANES[lane], 0, z);
            var u = car.userData;
            u.logicalX = LANES[lane];
            u.lane = lane;
            u.targetLane = lane;
            u.state = isMad ? 'mad' : 'cruise';
            u.signal = 0;
            u.signalT = 0;
            u.blinkT = 0;
            u.changeT = 0;
            u.fromX = LANES[lane];
            u.toX = LANES[lane];
            u.decisionT = 1.5 + Math.random() * 3.5;
            // Normal traffic cruises at 60–120 mph. The rare mad car runs at
            // 500 mph, ignores lanes, and swerves across the whole highway.
            u.cruiseSpeed = (60 + Math.random() * 60) / 2.2369362920544;
            u.normalCruiseSpeed = u.cruiseSpeed;
            if (isMad) {
                u.mad = true;
                u.madT = 0;
                u.madPhase = Math.random() * Math.PI * 2;
                u.madFreq = 1.4 + Math.random() * 1.4;
                u.cruiseSpeed = 500 / 2.2369362920544;
                car.userData.mad = true;
            }
            if (isRamp) {
                u.isRamp = true;
                u.cruiseSpeed = 26 + Math.random() * 12;
                u.normalCruiseSpeed = u.cruiseSpeed;
                var rampMat = standard(0x2b3038, { metalness: 0.55, roughness: 0.4 });
                var ramp = boxMesh(2.3, 0.14, 4.4, rampMat);
                ramp.position.set(0, 1.0, 1.5);
                ramp.rotation.x = -0.3;
                car.add(ramp);
                var lip = boxMesh(2.3, 0.12, 0.3, new THREE.MeshBasicMaterial({ color: 0xffc400 }));
                lip.position.set(0, 1.62, -0.55);
                car.add(lip);
            }
            scene.add(car);
            traffic.push(car);
        }

        for (var t = 0; t < 8; t++) spawnTraffic(-100 - t * 46);

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

        var distance = 0, speed = CREEP_SPEED, elapsed = 0, spawnT = 0;
        var gearMode = 'D';
        var playerY = 0, vy = 0, driftScore = 0;
        var suspensionImpulse = 0;
        var ignition = 0, engineOn = false;
        var nitro = 100, nitroActive = false;
        var nitroWasActive = false, nitroShiftT = 0;
        var coinsCollected = 0;
        var garageMode = false;
        var hudT = 0;
        var maxX = ROAD_W / 2 - 1.3;
        var steerX = 0;
        var fsdActive = false;
        var fsdLane = 2;
        var fsdThink = 0;
        var fsdCooldown = 0;
        var fsdSteerX = 0;

        function laneIndexOf(x) {
            var best = 0;
            var bestDist = Infinity;
            for (var i = 0; i < LANES.length; i++) {
                var d = Math.abs(LANES[i] - x);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return best;
        }

        function laneGapFor(laneIndex, range) {
            var laneX = LANES[laneIndex];
            var gap = range;
            for (var i = 0; i < traffic.length; i++) {
                var car = traffic[i];
                if (!car || !car.userData) continue;
                var lx = car.userData.logicalX != null ? car.userData.logicalX : car.position.x;
                if (Math.abs(lx - laneX) > 2.05) continue;
                var dz = player.position.z - car.position.z;
                if (dz > 0 && dz < gap) gap = dz;
            }
            return gap;
        }

        function updateFsdVisual() {
            var overlay = document.getElementById('g3dFsd');
            if (overlay) overlay.classList.toggle('is-active', fsdActive);
            if (!fsdGroup) return;
            fsdGroup.visible = fsdActive;
            if (!fsdActive) return;
            fsdGroup.position.set(LANES[fsdLane], 0, player.position.z);
            var pulse = 0.45 + Math.sin(elapsed * 6) * 0.18;
            fsdLinesMat.opacity = pulse;
            fsdFillMat.opacity = 0.04 + Math.sin(elapsed * 6) * 0.018;
        }

        function gearFor(v) {
            var gear = 1;
            for (var g = 0; g < GEAR_FRACTIONS.length; g++) {
                if (v >= perf.topSpeed * GEAR_FRACTIONS[g]) gear = g + 2;
            }
            return gear;
        }

        function update(dt) {
            var realDt = dt;
            if (garageMode) {
                elapsed += dt;
                var ga = elapsed * 0.42;
                var gr = 5.4;
                camera.position.set(Math.sin(ga) * gr, 2.25 + Math.sin(elapsed * 0.7) * 0.18, player.position.z + Math.cos(ga) * gr);
                camera.lookAt(player.position.x, 0.85, player.position.z);
                camera.fov = 46;
                camera.updateProjectionMatrix();
                animateSuspension(player, dt, 0, distance, 0, 0, 0);
                return;
            }
            if (crashActive) {
                dt *= 0.22;
                elapsed += dt;
                updateCrash(dt);
                return;
            }
            elapsed += dt;

            // Gear selector: Q shifts down (D → N → R → P), E shifts up
            // (P → R → N → D). D keeps the 6-speed automatic.
            if (input.gearDown) {
                input.gearDown = false;
                gearMode = gearMode === 'D' ? 'N' : gearMode === 'N' ? 'R' : 'P';
            }
            if (input.gearUp) {
                input.gearUp = false;
                gearMode = gearMode === 'P' ? 'R' : gearMode === 'R' ? 'N' : 'D';
            }

            if (input.fsdToggle) {
                input.fsdToggle = false;
                fsdActive = !fsdActive;
                if (fsdActive) {
                    engineOn = true;
                    ignition = 1;
                    gearMode = 'D';
                    fsdLane = laneIndexOf(player.position.x);
                    fsdThink = 0;
                    fsdCooldown = 2.5;
                    tone(520, 0.14, 'sine', 0.05, 880);
                } else {
                    tone(280, 0.1, 'sine', 0.04, 220);
                }
            }
            if (fsdActive && gearMode !== 'D') fsdActive = false;

            var throttleCmd = input.up;
            var brakeCmd = input.brake;
            if (fsdActive) {
                fsdThink -= dt;
                fsdCooldown -= dt;
                var curLane = laneIndexOf(player.position.x);
                if (fsdThink <= 0) {
                    fsdThink = 0.5;
                    var curGap = laneGapFor(curLane, 200);
                    var bestLane = curLane;
                    var bestGap = curGap;
                    for (var fl = Math.max(0, curLane - 1); fl <= Math.min(LANES.length - 1, curLane + 1); fl++) {
                        if (fl === curLane) continue;
                        var fg = laneGapFor(fl, 200);
                        if (fg > bestGap + 20) { bestGap = fg; bestLane = fl; }
                    }
                    if (bestLane !== curLane && fsdCooldown <= 0) {
                        fsdLane = bestLane;
                        fsdCooldown = (curGap < 80 ? 2.5 : 6) + Math.random() * 3;
                    } else if (fsdCooldown <= 0 && curGap > 140 && Math.random() < 0.14) {
                        var options = [];
                        if (curLane > 0) options.push(curLane - 1);
                        if (curLane < LANES.length - 1) options.push(curLane + 1);
                        if (options.length) {
                            fsdLane = options[Math.floor(Math.random() * options.length)];
                            fsdCooldown = 7 + Math.random() * 4;
                        }
                    } else if (laneGapFor(fsdLane, 200) < 45) {
                        fsdLane = curLane;
                    }
                }
                fsdLane = Math.max(0, Math.min(LANES.length - 1, fsdLane));
                fsdSteerX = LANES[fsdLane];
                var gapAhead = laneGapFor(fsdLane, 240);
                var safeSpeed = Math.min(perf.topSpeed * 0.5, Math.max(10, gapAhead * 0.6));
                if (gapAhead < 50) { brakeCmd = true; throttleCmd = false; }
                else if (speed > safeSpeed + 5) { brakeCmd = true; throttleCmd = false; }
                else if (speed < safeSpeed - 3) { brakeCmd = false; throttleCmd = true; }
                else { brakeCmd = false; throttleCmd = false; }
            }

            if (!engineOn) {
                if (input.up && gearMode === 'D') {
                    ignition = Math.min(1, ignition + dt / 0.9);
                    if (ignition >= 1) {
                        engineOn = true;
                        tone(120, 0.35, 'sawtooth', 0.09, 230);
                        tone(220, 0.28, 'square', 0.045, 360);
                    }
                } else {
                    ignition = Math.max(0, ignition - dt * 1.6);
                }
            }

            nitroActive = !!(input.nitro && throttleCmd && engineOn && gearMode === 'D' && nitro > 0 && !brakeCmd && !fsdActive);
            if (nitroActive && !nitroWasActive) {
                nitroShiftT = 0.9;
                tone(300, 0.16, 'sawtooth', 0.06, 620);
            }
            nitroWasActive = nitroActive;
            nitroShiftT = Math.max(0, nitroShiftT - dt);
            if (nitroActive) nitro = Math.max(0, nitro - 26 * dt);
            else nitro = Math.min(100, nitro + (engineOn ? 7 : 14) * dt);

            if (!engineOn) {
                speed = Math.max(0, speed - 45 * dt);
            } else if (gearMode === 'P') {
                speed = Math.max(0, speed - 80 * dt);
            } else if (gearMode === 'R') {
                if (input.up) {
                    speed = Math.max(-REVERSE_MAX, speed - perf.accel * 0.55 * dt);
                } else if (input.brake) {
                    speed = Math.min(0, speed + 45 * dt);
                } else {
                    speed += (0 - speed) * Math.min(1, dt * 3);
                }
            } else if (gearMode === 'N') {
                speed += (0 - speed) * Math.min(1, dt * 1.4);
            } else if (brakeCmd) {
                speed = Math.max(0, speed - 58 * dt);
            } else if (throttleCmd) {
                var topSpeedNow = perf.topSpeed * (nitroActive ? 1.32 : 1);
                var pull = perf.accel * (nitroActive ? 2.35 : 1) * (1 - 0.55 * Math.min(1, speed / topSpeedNow));
                speed = Math.min(topSpeedNow, speed + pull * dt);
            } else if (speed > CREEP_SPEED) {
                speed = Math.max(CREEP_SPEED, speed - 11 * dt);
            } else {
                speed = Math.min(CREEP_SPEED, speed + 5 * dt);
            }
            var prevDistance = distance;
            distance += speed * dt;
            if (distance < 0) distance = 0;
            updateCheckpoints();
            if (updateRamps()) return;
            updateCoins(prevDistance);
            updateJumpRamps(prevDistance);

            var speedSteerFactor = Math.min(1, Math.sqrt(Math.abs(speed) / 65));

            // Drift is detected automatically from speed, steering, and braking.
            var steeringIntent = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            var autoDrift = !fsdActive && Math.abs(speed) > 26 && playerY < 0.25 && (
                Math.abs(steerX) > maxX * 0.5 ||
                (steeringIntent !== 0 && Math.abs(speed) > 48) ||
                (input.brake && Math.abs(steerX) > maxX * 0.28)
            );
            var driftIntent = !fsdActive && (autoDrift || (!!input.drift && Math.abs(speed) > 18 &&
                (input.left || input.right || Math.abs(steerX) > 2.2) && playerY < 0.3));
            if (driftIntent) {
                speed -= Math.sign(speed) * Math.min(Math.abs(speed), 9 * dt);
                driftScore += dt * 110;
            }

            var steerInput = 0;
            if (input.left) steerInput -= 1;
            if (input.right) steerInput += 1;
            if (fsdActive) {
                steerX += (fsdSteerX - steerX) * Math.min(1, dt * (2.0 + speedSteerFactor * 3.5));
                if (Math.abs(speed) < 1) steerX = player.position.x;
            } else if (Math.abs(speed) < 1) {
                steerInput = 0;
                steerX = player.position.x;
            } else if (input.pointerActive) {
                var pointerTarget = Math.max(-maxX, Math.min(maxX, input.pointerX * maxX * 1.08));
                steerX += (pointerTarget - steerX) * Math.min(1, dt * 8 * speedSteerFactor);
                steerX = Math.max(-maxX, Math.min(maxX, steerX));
            } else {
                steerX += steerInput * dt * 9.5 * perf.grip * speedSteerFactor * (driftIntent ? 1.7 : 1);
                steerX = Math.max(-maxX, Math.min(maxX, steerX));
            }

            var beforeX = player.position.x;
            player.position.x += (steerX - player.position.x) * Math.min(1, dt * (driftIntent ? 6.5 : 10));
            player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x));
            var vx = (player.position.x - beforeX) / (dt || 0.016);

            var yawLimit = driftIntent ? 0.78 : 0.42;
            var rollLimit = driftIntent ? 0.34 : 0.2;
            var yawTarget = vx * 0.045 * (driftIntent ? 2.0 : 1) * (0.35 + speedSteerFactor * 0.65);
            player.rotation.y = Math.max(-yawLimit, Math.min(yawLimit, yawTarget)) - roadTangentAt(player.position.z);

            player.rotation.z = Math.max(-rollLimit, Math.min(rollLimit, -vx * 0.022 * (driftIntent ? 1.7 : 1)));
            player.rotation.x = (brakeCmd ? 0.035 : 0) + Math.max(-0.03, Math.min(0.03, -vx * 0.002));
            if (player.userData.brakeMat) player.userData.brakeMat.color.setHex(input.brake ? 0xff2438 : 0x5a1018);

            // Airborne physics from ramp cars.
            if (playerY > 0 || vy !== 0) {
                playerY += vy * dt;
                vy -= 28 * dt;
                if (playerY <= 0) {
                    if (vy < -5) suspensionImpulse = Math.min(1, -vy / 26);
                    playerY = 0;
                    vy = 0;
                }
                player.position.y = playerY;
            }
            var bodyRoll = Math.max(-0.5, Math.min(0.5, vx * 0.03 + (driftIntent ? steerInput * 0.42 : 0)));
            var bodyPitch = 0;
            if (input.brake) bodyPitch += 0.14;
            if (input.up && engineOn) bodyPitch -= 0.07;
            if (playerY > 0.4) bodyPitch -= 0.05;
            if (suspensionImpulse > 0.02) bodyPitch += 0.12;
            if (gearMode === 'R' && input.up) bodyPitch -= 0.06;
            animateSuspension(player, dt, speed, distance, bodyRoll, bodyPitch, suspensionImpulse);
            suspensionImpulse *= Math.max(0, 1 - dt * 5);
            updateDriftPuffs(dt, driftIntent);

            updateRemoteRacers(dt);

            // Wheel spin.
            var wheels = player.userData.wheels || [];
            for (var wi = 0; wi < wheels.length; wi++) {
                wheels[wi].rotation.x += speed * dt * 1.4;
                if (wheelRainbow && wheels[wi].userData.rimMaterial) {
                    wheels[wi].userData.rimMaterial.color.setHSL((elapsed * 0.22 + wi * 0.09) % 1, 1, 0.6);
                }
            }

            if (glowLight && glowPool) {
                if (glowRainbow) {
                    glowLight.color.setHSL((elapsed * 0.18) % 1, 1, 0.6);
                    glowPool.material.color.copy(glowLight.color);
                }
                glowLight.intensity = 1.35 + Math.sin(elapsed * 6) * 0.28;
            }
            if (trailBits.length) {
                for (var tbi = 0; tbi < trailBits.length; tbi++) {
                    var tbit = trailBits[tbi];
                    var pulse = 0.24 + 0.22 * Math.sin(elapsed * 9 - tbi * 0.7);
                    tbit.material.opacity = Math.max(0.08, pulse);
                    tbit.scale.x = 0.82 + 0.35 * Math.sin(elapsed * 7 - tbi * 0.5);
                    if (trailRainbow) tbit.material.color.setHSL((elapsed * 0.22 - tbi * 0.05) % 1, 1, 0.6);
                }
            }

            var engineGlow = player.userData.engineGlow || [];
            for (var eg = 0; eg < engineGlow.length; eg++) {
                var part = engineGlow[eg];
                if (part.material) {
                    var base = part.material.opacity != null ? 0.55 : 1;
                    if (part.material.opacity != null) {
                        part.material.opacity = 0.45 + 0.28 * Math.sin(elapsed * 11 + eg);
                    }
                    if (part.material.emissiveIntensity != null) {
                        part.material.emissiveIntensity = 0.9 + 0.45 * Math.sin(elapsed * 8 + eg);
                    }
                }
            }

            for (var si = 0; si < scrollers.length; si++) {
                var sc = scrollers[si];
                sc.obj.position.z += speed * dt * sc.factor;
                if (sc.obj.position.z > 28) sc.obj.position.z -= sc.wrap;
                if (Math.abs(sc.baseX) < 14) {
                    sc.obj.position.x = sc.baseX + roadCurveOffset(sc.obj.position.z);
                    sc.obj.rotation.y = (sc.baseRotY || 0) - roadTangentAt(sc.obj.position.z);
                }
            }

            // Gentle ocean swell, throttled to 30 Hz.
            oceanUpdateT -= dt;
            if (oceanUpdateT <= 0) {
                oceanUpdateT = 1 / 30;
                var pos = oceanGeo.attributes.position;
                for (var vi = 0; vi < pos.count; vi++) {
                    var ox = oceanBase[vi * 3];
                    var oy = oceanBase[vi * 3 + 1];
                    pos.array[vi * 3 + 2] = Math.sin((ox * 0.11 + elapsed * 1.6)) * 0.16 + Math.sin((oy * 0.16 - elapsed * 1.1)) * 0.1;
                }
                pos.needsUpdate = true;
            }

            for (var bdi = 0; bdi < birds.length; bdi++) {
                var bird = birds[bdi];
                var flap = Math.sin(elapsed * 5 + bird.userData.flap);
                bird.userData.wings[0].rotation.z = flap * 0.45;
                bird.userData.wings[1].rotation.z = -flap * 0.45;
            }

            spawnT += dt;
            if (spawnT > Math.max(0.75, 1.5 - elapsed * 0.012)) { spawnT = 0; spawnTraffic(); }

            for (var k = traffic.length - 1; k >= 0; k--) {
                var c = traffic[k];
                var u = c.userData;

                c.rotation.y -= u.curveRot || 0;
                if (u.state === 'mad') {
                    u.madT += dt;
                    var madPrevX = u.logicalX != null ? u.logicalX : c.position.x;
                    u.logicalX = Math.sin(u.madT * u.madFreq + u.madPhase) * (ROAD_W / 2 - 1.2);
                    var madVx = (u.logicalX - madPrevX) / (dt || 0.016);
                    c.rotation.y = Math.max(-0.7, Math.min(0.7, madVx * 0.02));
                    c.rotation.z = Math.max(-0.3, Math.min(0.3, -madVx * 0.012));
                } else if (u.state === 'cruise') {
                    u.decisionT -= dt;
                    if (u.decisionT <= 0) {
                        var choices = [];
                        if (u.lane > 0 && !laneBusy(u.lane - 1, c, c.position.z, 11)) choices.push(-1);
                        if (u.lane < LANES.length - 1 && !laneBusy(u.lane + 1, c, c.position.z, 11)) choices.push(1);
                        if (choices.length) {
                            u.signal = choices[Math.floor(Math.random() * choices.length)];
                            u.signalT = 1 + Math.random() * 2;
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
                    u.logicalX = u.fromX + (u.toX - u.fromX) * ease;
                    c.rotation.y = (u.toX - u.fromX) * -0.06 * Math.sin(p * Math.PI);
                    c.rotation.z = (u.toX - u.fromX) * 0.035 * Math.sin(p * Math.PI);
                    u.blinkT += dt;
                    blink(c, u.toX > u.fromX ? 1 : -1);
                    if (p >= 1) {
                        u.logicalX = u.toX;
                        c.rotation.y = 0;
                        c.rotation.z = 0;
                        u.lane = u.targetLane;
                        u.state = 'cruise';
                        u.signal = 0;
                        u.signalT = 0;
                        clearBlink(c);
                        u.decisionT = 1.8 + Math.random() * 3.2;
                    }
                } else if (u.state === 'merge') {
                    u.changeT += dt;
                    var mp = Math.min(1, u.changeT / 2.2);
                    var me = mp * mp * (3 - 2 * mp);
                    u.logicalX = u.fromX + (u.toX - u.fromX) * me;
                    c.rotation.y = -0.1 * (1 - mp);
                    u.blinkT += dt;
                    blink(c, 1);
                    if (mp >= 1) {
                        u.logicalX = u.toX;
                        c.rotation.y = 0;
                        u.lane = u.targetLane;
                        u.state = 'cruise';
                        u.signal = 0;
                        u.signalT = 0;
                        clearBlink(c);
                        u.decisionT = 2 + Math.random() * 3;
                    }
                }

                // AI emergency braking: if the player or another car is close
                // ahead in the same lane, the AI brakes instead of driving on.
                var mustBrake = false;
                var gapPlayer = c.position.z - player.position.z;
                var carLogicalX = u.logicalX != null ? u.logicalX : c.position.x;
                if (gapPlayer > 0 && gapPlayer < 30 && Math.abs(carLogicalX - player.position.x) < 2.1) {
                    mustBrake = true;
                }
                if (!mustBrake) {
                    for (var oi2 = 0; oi2 < traffic.length; oi2++) {
                        var other = traffic[oi2];
                        if (other === c) continue;
                        var gapOther = c.position.z - other.position.z;
                        var otherLogicalX = other.userData.logicalX != null ? other.userData.logicalX : other.position.x;
                        if (gapOther > 0 && gapOther < 20 && Math.abs(otherLogicalX - carLogicalX) < 2.0) {
                            mustBrake = true;
                            break;
                        }
                    }
                }
                if (mustBrake && u.state !== 'mad') {
                    u.emergency = true;
                    u.cruiseSpeed = Math.max(0, (u.cruiseSpeed || 0) - 110 * dt);
                    if (Math.random() < dt * 6) {
                        var skidX = c.position.x + (Math.random() - 0.5) * 1.2;
                        spawnSparks(skidX, 0.15, c.position.z + 2.4, 1);
                    }
                } else {
                    u.emergency = false;
                    var normalSpeed = u.normalCruiseSpeed != null ? u.normalCruiseSpeed : u.cruiseSpeed;
                    u.cruiseSpeed += (normalSpeed - (u.cruiseSpeed || 0)) * Math.min(1, dt * 1.4);
                }
                if (c.userData.brakeMat) {
                    c.userData.brakeMat.color.setHex((u.emergency || u.state === 'hit') ? 0xff2438 : 0x5a1018);
                }

                u.curveShift = roadCurveOffset(c.position.z) - roadCurveOffset(player.position.z);
                c.position.x = (u.logicalX != null ? u.logicalX : c.position.x) + u.curveShift;
                u.curveRot = -roadTangentAt(c.position.z);
                c.rotation.y += u.curveRot;

                var prevZ = c.position.z;
                c.position.z += (speed - u.cruiseSpeed) * dt;
                var tw = c.userData.wheels || [];
                var wheelSpeed = Math.abs(speed - u.cruiseSpeed) + 8;
                for (var twi = 0; twi < tw.length; twi++) tw[twi].rotation.x += wheelSpeed * dt * 1.2;
                animateSuspension(c, dt, speed - u.cruiseSpeed, distance - c.position.z, 0, 0, 0);

                if (c.position.z > 14 || c.position.z < -760) {
                    scene.remove(c); disposeObject(c); traffic.splice(k, 1); continue;
                }

                // A ramp truck launches the player when they line up with it.
                var rampLogicalX = u.logicalX != null ? u.logicalX : c.position.x;
                if (u.isRamp && playerY < 0.2 && Math.abs(speed) > 22 &&
                    Math.abs(rampLogicalX - player.position.x) < 2.0) {
                    var rampGap = c.position.z - player.position.z;
                    if (rampGap > -5 && rampGap < 5) {
                        vy = Math.min(30, 10 + Math.abs(speed) * 0.09);
                        playerY = 0.4;
                    }
                }

                // Swept collision: at high speed a car can cross the player in a
                // single frame, so test the whole segment travelled this frame.
                var spec = u.spec || {};
                var carHalfW = (spec.width || 1.8) / 2 + 0.72;
                var carHalfL = (spec.len || 3.2) / 2 + 0.35;
                if (playerY < 1.1 && Math.abs((u.logicalX != null ? u.logicalX : c.position.x) - player.position.x) < carHalfW) {
                    var carBack = Math.min(prevZ, c.position.z) - carHalfL;
                    var carFront = Math.max(prevZ, c.position.z) + carHalfL;
                    if (carBack < player.position.z + 2.75 && carFront > player.position.z - 2.75) {
                        triggerCrash(c, carHalfW);
                        return;
                    }
                }
            }

            // Human warning only: no auto-brake, just a red flash and beep.
            var collisionWarning = false;
            if (!crashActive) {
                for (var wk = 0; wk < traffic.length; wk++) {
                    var wc = traffic[wk];
                    var wgap = player.position.z - wc.position.z;
                    if (wgap <= 0 || wgap > 34) continue;
                    var warnX = wc.userData.logicalX != null ? wc.userData.logicalX : wc.position.x;
                    if (Math.abs(warnX - player.position.x) > 2.15) continue;
                    var closing = Math.abs(speed) - Math.abs(wc.userData.cruiseSpeed || 0);
                    if (closing > 1 && (wgap / closing) < 0.95) { collisionWarning = true; break; }
                }
            }
            var warnEl = document.getElementById('g3dWarning');
            if (warnEl) warnEl.classList.toggle('is-active', collisionWarning);
            if (collisionWarning) {
                warningT -= dt;
                if (warningT <= 0) {
                    warningT = 0.34;
                    tone(1240, 0.09, 'square', 0.05, 860);
                }
            } else {
                warningT = 0;
            }

            var fov = 64 + Math.min(18, Math.abs(speed) * 0.13);
            if (Math.abs(camera.fov - fov) > 0.1) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }

            camera.position.x += (player.position.x * 0.42 - camera.position.x) * Math.min(1, dt * 5);
            camera.position.y = 5.3 + playerY * 0.78 + (player.userData.bodyGroup ? player.userData.bodyGroup.position.y * 4.0 : 0) - suspensionImpulse * 0.3 + Math.sin(elapsed * 1.4) * 0.035;
            var curveAhead = roadCurveOffset(-80) - roadCurveOffset(0);
            camera.lookAt(player.position.x * 0.5 + vx * 0.22 + curveAhead * 0.22, 0.5 + playerY * 0.9, -12);
            camera.rotateZ(-curveAhead * 0.0016 - bodyRoll * 0.1);
            camera.rotateY(curveAhead * 0.0009);
            camera.rotateX(bodyPitch * 0.05);
            var gearText;
            if (!engineOn) {
                gearText = 'OFF';
            } else if (gearMode === 'P' || gearMode === 'R' || gearMode === 'N') {
                gearText = gearMode;
            } else {
                var g = gearFor(Math.abs(speed));
                gearText = (speed < 0.15 ? 1 : g) + '/6';
            }
            var status = (fsdActive ? 'FSD · ' : (brakeCmd ? 'BRAKE · ' : (throttleCmd ? 'THROTTLE · ' : ''))) +
                speedText(speed) +
                (!engineOn ? ' · HOLD W TO START' : '') +
                (nitroActive ? (nitroShiftT > 0 ? ' · NITRO SHIFT' : ' · NOS') : '') +
                (driftIntent ? ' · DRIFT' : '') +
                (playerY > 0.4 ? ' · JUMP' : '') +
                (exitHintText ? ' · ' + exitHintText : '');
            hudT -= dt;
            if (hudT <= 0) {
                hudT = 0.1;
                setHud(distance + checkpointsPassed * CHECKPOINT_BONUS + driftScore, status, gearText);
            }
            updateRaceHud();
            updateFsdVisual();
            updateAudio();
        }

        function teleportRacer(targetDistance, targetX) {
            distance = Math.max(0, Number(targetDistance) || 0);
            nextCheckpointDistance = (Math.floor(distance / CHECKPOINT_SPACING) + 1) * CHECKPOINT_SPACING;
            var tx = Math.max(-maxX, Math.min(maxX, Number(targetX) || 0));
            player.position.x = tx;
            steerX = tx;
            playerY = 0;
            vy = 0;
            speed = Math.max(speed, 35);
            for (var ti = traffic.length - 1; ti >= 0; ti--) {
                var tc = traffic[ti];
                if (Math.abs(tc.position.z - player.position.z) < 55) {
                    scene.remove(tc);
                    disposeObject(tc);
                    traffic.splice(ti, 1);
                }
            }
        }

        function setGarageMode(on) {
            garageMode = !!on;
            if (garageMode) {
                trackCoins.forEach(function (c) { c.visible = false; });
                checkpointGates.forEach(function (g) { g.visible = false; });
                jumpRamps.forEach(function (r) { r.visible = false; });
                rampFeatures.forEach(function (f) { f.group.visible = false; });
            }
        }

        camera.position.set(0, 5.3, 13);
        camera.lookAt(0, 0.5, -12);
        var crashFlash = document.getElementById('g3dCrashFlash');
        if (crashFlash) crashFlash.classList.remove('is-active');
        initAudio();
        updateRaceHud();
        return {
            over: false,
            update: update,
            getCoins: function () { return coinsCollected; },
            teleport: teleportRacer,
            setGarage: setGarageMode,
            toggleFsd: function () { input.fsdToggle = true; },
            setRemotes: setRemoteRacers,
            setLocalName: setLocalRacerName,
            getState: function () {
                return {
                    x: player.position.x,
                    distance: distance,
                    speed: speed,
                    gear: gearMode === 'D' ? (speed < 0.15 ? 1 : gearFor(Math.abs(speed))) : gearMode,
                    checkpoints: checkpointsPassed,
                    driftScore: Math.round(driftScore),
                    airborne: playerY > 0.2,
                    nitro: Math.round(nitro),
                    engineOn: engineOn,
                    coins: coinsCollected,
                    fsd: fsdActive,
                    fsdLane: fsdLane,
                    suspension: player.userData.bodyGroup ? player.userData.bodyGroup.position.y : 0,
                    wheelTravel: (player.userData.suspensionPivots || []).reduce(function (maxTravel, pv) {
                        return Math.max(maxTravel, Math.abs(pv.userData.travel || 0));
                    }, 0),
                    bodyMeshes: player.userData.bodyGroup ? player.userData.bodyGroup.children.length : 0,
                    bodyRoll: player.userData.bodyGroup ? player.userData.bodyGroup.rotation.z : 0,
                    bodyPitch: player.userData.bodyGroup ? player.userData.bodyGroup.rotation.x : 0,
                    crashing: crashActive
                };
            },
            getMultiplayerInfo: function () {
                var names = [];
                for (var id in remoteCars) names.push(remoteCars[id].state.name || '');
                return { localName: localNameText, remotes: names };
            }
        };
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

            setHud(elapsed * 10, speedText(speed));
        }

        return { over: false, update: update, getScore: function () { return elapsed * 10; } };
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

        return { over: false, update: update, getScore: function () { return placed; } };
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

        return { over: false, update: update, getScore: function () { return score; } };
    }

    var factories = {
        1: createRacer,
        2: createTunnel,
        3: createStack,
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
        var KEY_GEAR_DOWN = ['q', 'Q'];
        var KEY_GEAR_UP = ['e', 'E'];
        var KEY_DRIFT = []; // Drifting is automatic; the mobile Drift button still forces it.
        var KEY_NITRO = ['n', 'N', 'Shift', 'ShiftLeft', 'ShiftRight'];
        var KEY_FSD = ['f', 'F'];

        function down(e) {
            if (isTypingTarget(e)) return;
            if (KEY_LEFT.indexOf(e.key) >= 0) input.left = true;
            if (KEY_RIGHT.indexOf(e.key) >= 0) input.right = true;
            if (KEY_UP.indexOf(e.key) >= 0) input.up = true;
            if (KEY_DOWN.indexOf(e.key) >= 0) {
                input.down = true;
                input.brake = true;
            }
            if (KEY_GEAR_DOWN.indexOf(e.key) >= 0) { if (!e.repeat) input.gearDown = true; }
            if (KEY_GEAR_UP.indexOf(e.key) >= 0) { if (!e.repeat) input.gearUp = true; }
            if (KEY_DRIFT.indexOf(e.key) >= 0) input.drift = true;
            if (KEY_NITRO.indexOf(e.key) >= 0) input.nitro = true;
            if (KEY_FSD.indexOf(e.key) >= 0) { if (!e.repeat) input.fsdToggle = true; e.preventDefault(); }
            if (e.key === ' ' || e.key === 'Enter') { input.tapQueued = true; e.preventDefault(); }
            if (KEY_LEFT.indexOf(e.key) >= 0 || KEY_RIGHT.indexOf(e.key) >= 0 || KEY_UP.indexOf(e.key) >= 0 || KEY_DOWN.indexOf(e.key) >= 0 || KEY_GEAR_DOWN.indexOf(e.key) >= 0 || KEY_GEAR_UP.indexOf(e.key) >= 0) e.preventDefault();
        }
        function up(e) {
            if (KEY_LEFT.indexOf(e.key) >= 0) input.left = false;
            if (KEY_RIGHT.indexOf(e.key) >= 0) input.right = false;
            if (KEY_UP.indexOf(e.key) >= 0) input.up = false;
            if (KEY_DOWN.indexOf(e.key) >= 0) {
                input.down = false;
                input.brake = false;
            }
            if (KEY_DRIFT.indexOf(e.key) >= 0) input.drift = false;
            if (KEY_NITRO.indexOf(e.key) >= 0) input.nitro = false;
            // Gear shifts are consumed by the game loop; a quick tap must still
            // register, so keyup does not clear the queued shift.
        }
        function isTypingTarget(e) {
            var target = e && e.target;
            if (!target) return false;
            var tag = String(target.tagName || '').toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
        }
        function releaseAll() {
            input.left = false; input.right = false;
            input.up = false; input.down = false; input.brake = false;
            input.gearDown = false; input.gearUp = false;
            input.drift = false;
            input.nitro = false;
            input.fsdToggle = false;
            input.pointerActive = false; input.tapQueued = false;
        }
        listen(global, 'keydown', down);
        listen(global, 'keyup', up);
        listen(global, 'blur', releaseAll);

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

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
            if (!audioMuteHandler) return;
            audioMuteHandler(!document.hidden && soundEnabled && !!active && !active.over && !paused);
        });
    }
    if (typeof global.addEventListener === 'function') {
        global.addEventListener('pagehide', function () {
            if (audioCleanup) {
                try { audioCleanup(); } catch (e) {}
                audioCleanup = null;
                audioMuteHandler = null;
            }
        });
    }

    function loop() {
        raf = requestAnimationFrame(loop);
        var dt = Math.min(clock.getDelta(), 0.05);
        fpsTime += dt;
        fpsFrames++;
        if (fpsTime >= 1) {
            var fps = fpsFrames / fpsTime;
            lastFps = fps;
            var changed = false;
            if (fps < 59 && adaptiveScale > 0.35) {
                adaptiveScale = Math.max(0.35, adaptiveScale - 0.06);
                changed = true;
            } else if (fps > 61 && adaptiveScale < 1.5) {
                adaptiveScale = Math.min(1.5, adaptiveScale + 0.03);
                changed = true;
            }
            if (changed && renderer) renderer.setPixelRatio(effectivePixelRatio());
            updatePerfHud(fps);
            fpsTime = 0;
            fpsFrames = 0;
        }
        if (active && running && !active.over && !paused) {
            playedSeconds += dt;
            active.update(dt);
        }
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function start(gameId, containerEl, opts) {
        stop();
        paused = false;
        if (typeof THREE === 'undefined') {
            containerEl.innerHTML = '<p style="padding:40px;text-align:center;color:#fff">3D engine failed to load. Check your connection and refresh.</p>';
            return;
        }
        container = containerEl;
        gameMeta = { name: 'Game', onScore: null, onGameOver: null, onCoins: null };
        if (opts) {
            if (opts.name) gameMeta.name = opts.name;
            if (opts.onScore) gameMeta.onScore = opts.onScore;
            if (opts.onGameOver) gameMeta.onGameOver = opts.onGameOver;
            if (opts.onCoins) gameMeta.onCoins = opts.onCoins;
        }

        input.left = false; input.right = false; input.up = false; input.down = false;
        input.brake = false;
        input.pointerActive = false; input.pointerX = 0; input.pointerY = 0; input.tapQueued = false;
        playedSeconds = 0;

        resetScene();
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(effectivePixelRatio());
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
        active = factory ? factory({ scene: scene, camera: camera, input: input, options: opts || {} }) : null;
        if (!active) return;

        resize();
        bindInput();
        running = true;
        raf = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        paused = false;
        playedSeconds = 0;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        for (var i = 0; i < cleanupFns.length; i++) {
            try { cleanupFns[i](); } catch (e) {}
        }
        cleanupFns = [];
        if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
        if (audioCleanup) { try { audioCleanup(); } catch (e) {} audioCleanup = null; }
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
    function setThrottle(on) { input.up = !!on; }
    function setDrift(on) { input.drift = !!on; }
    function setNitro(on) { input.nitro = !!on; }
    function shiftGear(direction) {
        if (direction > 0) input.gearUp = true;
        else input.gearDown = true;
    }
    function effectivePixelRatio() {
        var base = Math.min(global.devicePixelRatio || 1, 2);
        if (renderScale > 0) return Math.max(0.35, base * renderScale * adaptiveScale);
        return Math.min(base, 1.5) * adaptiveScale;
    }

    function updatePerfHud(fps) {
        var fpsEl = document.getElementById('g3dFps');
        var resEl = document.getElementById('g3dRes');
        if (fpsEl) fpsEl.textContent = Math.round(fps) + ' FPS';
        if (resEl && renderer) {
            var canvas = renderer.domElement;
            var ratio = renderer.getPixelRatio();
            resEl.textContent = Math.round(ratio * 100) + '% · ' + canvas.width + '×' + canvas.height;
        }
    }
    function setRenderScale(scale) {
        renderScale = Math.max(0, Math.min(1, Number(scale) || 0));
        if (renderer && container) {
            renderer.setPixelRatio(effectivePixelRatio());
            renderer.setSize(container.clientWidth, container.clientHeight);
            resize();
        }
    }
    function setSoundEnabled(on) {
        soundEnabled = !!on;
        if (audioMuteHandler) audioMuteHandler(soundEnabled);
    }
    function setUnitSystem(unit) {
        unitSystem = unit === 'kmh' ? 'kmh' : 'mph';
    }
    function speedText(mps) {
        return unitSystem === 'kmh'
            ? Math.round(Math.abs(mps) * 3.6) + ' km/h'
            : Math.round(Math.abs(mps) * 2.23694) + ' mph';
    }
    function setPaused(on) {
        paused = !!on;
        if (audioMuteHandler) audioMuteHandler(!paused && soundEnabled);
    }
    function setRemoteRacers(list) {
        if (active && active.setRemotes) active.setRemotes(list || []);
    }
    function setLocalRacerName(name) {
        if (active && active.setLocalName) active.setLocalName(name || '');
    }
    function getRacerState() {
        return active && active.getState ? active.getState() : null;
    }
    function getRacerInfo() {
        return active && active.getMultiplayerInfo ? active.getMultiplayerInfo() : null;
    }
    function getCurrentScore() {
        return active && active.getScore ? active.getScore() : 0;
    }
    function teleportRacer(distance, x) {
        if (active && active.teleport) active.teleport(distance, x);
    }
    function setGarageMode(on) {
        if (active && active.setGarage) active.setGarage(on);
    }
    function toggleFsd() {
        if (active && active.toggleFsd) active.toggleFsd();
    }

    global.Games3D = {
        start: start,
        stop: stop,
        setBrake: setBrake,
        setThrottle: setThrottle,
        setDrift: setDrift,
        setNitro: setNitro,
        shiftGear: shiftGear,
        setPaused: setPaused,
        setRemoteRacers: setRemoteRacers,
        setLocalRacerName: setLocalRacerName,
        setRenderScale: setRenderScale,
        setSoundEnabled: setSoundEnabled,
        setUnitSystem: setUnitSystem,
        teleportRacer: teleportRacer,
        setGarageMode: setGarageMode,
        toggleFsd: toggleFsd,
        getCurrentScore: getCurrentScore,
        getRacerState: getRacerState,
        getRacerInfo: getRacerInfo
    };
})(window);
