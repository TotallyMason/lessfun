/* LessFun — Real 3D arcade games powered by Three.js */
(function (global) {
    'use strict';

    var isMobileDevice = (typeof global.matchMedia === 'function' && global.matchMedia('(pointer: coarse)').matches) || (global.innerWidth || 1000) < 820;
    var input = {
        left: false, right: false, up: false, down: false, brake: false,
        pointerActive: false, pointerX: 0, pointerY: 0, tapQueued: false, honk: false,
        jump: false, reload: false, melee: false, interact: false, weapon: 0, bandage: false,
        mobileX: 0, mobileY: 0
    };

    var renderer = null, scene = null, camera = null;
    var renderScale = 0; // 0 = auto cap, otherwise a multiplier on the device pixel ratio.
    var adaptiveScale = isMobileDevice ? 0.85 : 1;
    var adaptiveTransition = null;
    var adaptiveCooldown = 0;
    var graphicsPreset = 'high';
    var qualityLevel = 2;
    var autoGraphics = true;
    var motionBlurEnabled = true;
    var crashSlowmoEnabled = true;
    var shadowQuality = !isMobileDevice;
    var motionBlurAutoOff = isMobileDevice;
    var lowFpsTime = 0;
    var showFps = true;
    var motionBlurTargets = null;
    var motionBlurTargetSize = '';
    var pendingFrameCapture = false;
    var lastCapturedFrame = null;
    var lastCinemaFrame = 0;
    var motionBlurIndex = 0;
    var motionBlurHasPrev = false;
    var motionBlurScene = null;
    var motionBlurCamera = null;
    var motionBlurMaterial = null;
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
    var lastGameId = 0;
    var lastStartOpts = null;

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

    function makePhysicsWorld(gravityY) {
        if (!global.CANNON) return null;
        var world = new global.CANNON.World();
        world.gravity.set(0, gravityY == null ? -20 : gravityY, 0);
        world.broadphase = new global.CANNON.SAPBroadphase(world);
        world.solver.iterations = 8;
        world.defaultContactMaterial.friction = 0.35;
        world.defaultContactMaterial.restitution = 0.18;
        var ground = new global.CANNON.Body({ mass: 0 });
        ground.addShape(new global.CANNON.Plane());
        ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(ground);
        return world;
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
        var scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
        var raceMode = !!(ctx.options && ctx.options.raceMode);
        var raceAi = !!(ctx.options && ctx.options.raceAi);
        var RACE_LOOP = 2400, RACE_LAPS = 3;
        var playerLap = 1, raceStartDelay = raceMode ? 2.4 : 0, raceFinished = false, raceEndT = 0;
        var raceStartTime = 0, raceHudT = 0;
        var racerBannerT = 0;
        var cameraMode = 0;

        function racerBanner(text) {
            var el = document.getElementById('g3dBanner');
            if (!el) return;
            el.textContent = text;
            el.classList.add('is-active');
            racerBannerT = 1.7;
        }
        var aiRacers = [];
        var cosmetics = (ctx.options && ctx.options.cosmetics) || {};
        if (!raceMode) {
            var raceHudEl = document.getElementById('g3dRaceHud');
            if (raceHudEl) raceHudEl.classList.remove('is-active');
            var raceLoadEl = document.getElementById('g3dRaceLoad');
            if (raceLoadEl) raceLoadEl.classList.remove('is-active');
        }
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
            topSpeed: 192 * (equippedPerf.topSpeed || 1),
            accel: 34 * (equippedPerf.accel || 1),
            grip: equippedPerf.grip || 1
        };
        // 7 mph idle creep, in metres per second.
        var CREEP_SPEED = 7 / 2.2369362920544;
        var REVERSE_MAX = 16;
        var GEAR_FRACTIONS = [0.16, 0.31, 0.47, 0.64, 0.83];

        /* ---------------- Synthesized car audio ---------------- */
        var audioCtx = null, audioMaster = null;
        var engineOsc = null, engineOsc2 = null, engineGain = null, engineGain2 = null, engineFilter = null;
        var windGain = null, nitroGain = null, driftGain = null, driftFilter = null;
        var windSrc = null, nitroSrc = null, driftSrc = null;
        var engineOscStarted = false, audioNoiseStarted = false;
        var lastAudioGear = 0;
        var audioDriftLevel = 0;
        var currentVx = 0;

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
                engineGain2 = audioCtx.createGain();
                engineGain2.gain.value = 0.38;
                engineGain2.connect(engineFilter);
                engineOsc2 = audioCtx.createOscillator();
                engineOsc2.type = 'triangle';
                engineOsc2.frequency.value = 82;
                engineOsc2.connect(engineGain2);

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
                windSrc = audioCtx.createBufferSource();
                windSrc.buffer = buffer;
                windSrc.loop = true;
                windSrc.connect(windFilter);
                windFilter.connect(windGain);
                windGain.connect(audioMaster);

                var nitroFilter = audioCtx.createBiquadFilter();
                nitroFilter.type = 'bandpass';
                nitroFilter.frequency.value = 1900;
                nitroFilter.Q.value = 0.8;
                nitroGain = audioCtx.createGain();
                nitroGain.gain.value = 0;
                nitroSrc = audioCtx.createBufferSource();
                nitroSrc.buffer = buffer;
                nitroSrc.loop = true;
                nitroSrc.connect(nitroFilter);
                nitroFilter.connect(nitroGain);
                nitroGain.connect(audioMaster);

                driftFilter = audioCtx.createBiquadFilter();
                driftFilter.type = 'bandpass';
                driftFilter.frequency.value = 1450;
                driftFilter.Q.value = 1.1;
                driftGain = audioCtx.createGain();
                driftGain.gain.value = 0;
                driftSrc = audioCtx.createBufferSource();
                driftSrc.buffer = buffer;
                driftSrc.loop = true;
                driftSrc.connect(driftFilter);
                driftFilter.connect(driftGain);
                driftGain.connect(audioMaster);

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
                if (running && !engineOscStarted) {
                    try { engineOsc.start(); } catch (e) {}
                    try { engineOsc2.start(); } catch (e) {}
                    engineOscStarted = true;
                }
                if (running && !audioNoiseStarted) {
                    try { windSrc.start(); } catch (e) {}
                    try { nitroSrc.start(); } catch (e) {}
                    try { driftSrc.start(); } catch (e) {}
                    audioNoiseStarted = true;
                }
                var frac = Math.min(1, absSpeed / perf.topSpeed);
                var audioGear = 0;
                while (audioGear < GEAR_FRACTIONS.length && frac >= GEAR_FRACTIONS[audioGear]) audioGear++;
                var lowerF = audioGear === 0 ? 0 : GEAR_FRACTIONS[audioGear - 1];
                var upperF = audioGear < GEAR_FRACTIONS.length ? GEAR_FRACTIONS[audioGear] : 1;
                var within = Math.max(0, Math.min(1, (frac - lowerF) / Math.max(0.01, upperF - lowerF)));
                var liveRpm = 48 + within * 108 + audioGear * 9 + (nitroActive ? 28 : 0);
                if (engineOn && audioGear + 1 !== lastAudioGear) {
                    if (lastAudioGear) tone(130, 0.05, 'square', 0.028, 90);
                    lastAudioGear = audioGear + 1;
                }
                engineGain.gain.setTargetAtTime(running ? 0.045 + Math.min(0.038, absSpeed / 3000) : 0, now, 0.08);
                engineOsc.frequency.setTargetAtTime(liveRpm, now, 0.055);
                engineOsc2.frequency.setTargetAtTime(liveRpm * 1.5 + 7, now, 0.06);
                engineFilter.frequency.setTargetAtTime(430 + absSpeed * 10 + (nitroActive ? 320 : 0), now, 0.1);
                windGain.gain.setTargetAtTime(running ? Math.min(0.075, absSpeed / 1700) : 0, now, 0.15);
                nitroGain.gain.setTargetAtTime(running && nitroActive ? 0.05 : 0, now, 0.1);
                driftGain.gain.setTargetAtTime(running ? Math.min(0.1, audioDriftLevel * 0.1) : 0, now, 0.08);
                driftFilter.frequency.setTargetAtTime(1200 + Math.abs(currentVx) * 55, now, 0.1);
            } catch (e) {}
        }

        scene.background = new THREE.Color(0x9bd7f2);
        scene.fog = new THREE.FogExp2(0xffe0bd, 0.0055);

        // Painted sunset sky dome with soft clouds.
        var skyTex = makeCanvasTexture(512, 256, function (g, w, h) {
            var grad = g.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#3d7fbf');
            grad.addColorStop(0.52, '#9ed2ee');
            grad.addColorStop(0.78, '#ffd9a8');
            grad.addColorStop(1, '#ffb27a');
            g.fillStyle = grad; g.fillRect(0, 0, w, h);
            var sun = g.createRadialGradient(w * 0.72, h * 0.66, 4, w * 0.72, h * 0.66, 54);
            sun.addColorStop(0, 'rgba(255,245,205,0.95)');
            sun.addColorStop(0.4, 'rgba(255,210,140,0.45)');
            sun.addColorStop(1, 'rgba(255,180,100,0)');
            g.fillStyle = sun; g.beginPath(); g.arc(w * 0.72, h * 0.66, 54, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.3)';
            for (var ci = 0; ci < 16; ci++) {
                var cx = Math.random() * w, cy = h * 0.18 + Math.random() * h * 0.34;
                for (var cj = 0; cj < 5; cj++) {
                    g.beginPath();
                    g.ellipse(cx + cj * 13, cy + Math.sin(cj) * 5, 22 + Math.random() * 14, 7 + Math.random() * 4, 0, 0, Math.PI * 2);
                    g.fill();
                }
            }
        });
        var skyDome = new THREE.Mesh(new THREE.SphereGeometry(460, 20, 14), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
        skyDome.position.set(0, 60, -160);
        scene.add(skyDome);

        // High-speed wind streaks for a stronger sense of speed.
        var speedStreakMat = new THREE.MeshBasicMaterial({
            color: 0xdff6ff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        var speedStreaks = [];
        for (var ssi = 0; ssi < 32; ssi++) {
            var streak = boxMesh(0.03, 0.03, 3 + Math.random() * 8, speedStreakMat);
            streak.position.set((Math.random() - 0.5) * 30, 0.6 + Math.random() * 6.5, -20 - Math.random() * 150);
            scene.add(streak);
            speedStreaks.push(streak);
        }

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

        scene.add(new THREE.HemisphereLight(0xaedcff, 0xffc58f, 0.46));
        scene.add(new THREE.AmbientLight(0xffeeda, 0.3));
        var sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
        sunLight.position.set(18, 28, 12);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 90;
        sunLight.shadow.camera.left = -42;
        sunLight.shadow.camera.right = 42;
        sunLight.shadow.camera.top = 42;
        sunLight.shadow.camera.bottom = -42;
        sunLight.shadow.bias = -0.0006;
        sunLight.shadow.normalBias = 0.035;
        sunLight.shadow.radius = 2.2;
        scene.add(sunLight);
        scene.add(sunLight.target);
        var rimLight = new THREE.DirectionalLight(0xffb47a, 0.62);
        rimLight.position.set(-22, 16, -18); scene.add(rimLight);
        var fillLight = new THREE.DirectionalLight(0x7fd4ff, 0.22);
        fillLight.position.set(12, 10, 24); scene.add(fillLight);

        // Six-lane coastal highway.
        var LANES = [-8.0, -4.8, -1.6, 1.6, 4.8, 8.0];
        var ROAD_W = 20.8;
        var scrollers = [];
        function addScroller(obj, wrap, factor, lodRange) {
            scrollers.push({ obj: obj, wrap: wrap, factor: factor == null ? 1 : factor, lodRange: lodRange || 0, baseX: obj.position.x, baseRotY: obj.rotation ? obj.rotation.y : 0 });
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
            for (var lane = 0; lane < 6; lane++) {
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
        track.receiveShadow = true;
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

        // Six-lane dashed dividers.
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

        for (var pa = 0; pa < (isMobileDevice ? 10 : 14); pa++) {
            var palm = makePalm();
            palm.position.set(8.5 + Math.random() * 4.8, 0, 12 - pa * 18);
            palm.rotation.y = Math.random() * Math.PI * 2;
            var palmScale = 0.82 + Math.random() * 0.3;
            palm.scale.set(palmScale, palmScale, palmScale);
            addScroller(palm, 252, 1, 190);
        }

        // Pastel art-deco skyline along the beach side. Low-poly boxes keep the
        // Miami/GTA-style silhouette cheap while still adding depth to the view.
        function makeSkylineBuilding(index) {
            var g = new THREE.Group();
            var palette = [0xf3c6c8, 0xf6dfb8, 0xbfe3dc, 0xc9d3f2, 0xf1b8d8, 0xe8d3a9];
            var bodyMat = standard(palette[index % palette.length], { roughness: 0.72, metalness: 0.04 });
            var neonMat = new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0x5fe0ff : (index % 3 === 1 ? 0xff8fd0 : 0xffd166) });
            var width = 4.5 + (index % 4) * 1.4;
            var depth = 4 + (index % 3) * 1.3;
            var height = 7 + (index % 5) * 3.2;
            var body = boxMesh(width, height, depth, bodyMat);
            body.position.y = height / 2;
            g.add(body);
            var crown = boxMesh(width * 0.52, 2.2 + (index % 3), depth * 0.7, bodyMat);
            crown.position.y = height + crown.geometry.parameters.height / 2;
            g.add(crown);
            var rail = boxMesh(width * 1.02, 0.16, 0.16, neonMat);
            rail.position.set(0, height - 0.5, depth / 2 + 0.05);
            g.add(rail);
            var stripe = boxMesh(width * 0.08, height * 0.82, 0.08, neonMat);
            stripe.position.set(width * 0.34, height * 0.46, depth / 2 + 0.05);
            g.add(stripe);
            return g;
        }

        for (var bi = 0; bi < (isMobileDevice ? 8 : 18); bi++) {
            var bldg = makeSkylineBuilding(bi);
            bldg.position.set(34 + (bi % 4) * 7.5, 0, 20 - bi * 31);
            bldg.rotation.y = (bi % 2 ? -1 : 1) * 0.08;
            addScroller(bldg, 560, 1, 380);
        }

        // Real city district: storefronts, sidewalks, cross streets, and overpasses.
        var citySidewalk = boxMesh(6.5, 0.1, 500, standard(0x9aa0a6, { roughness: 0.9 }));
        citySidewalk.position.set(16.2, 0.04, -235);
        scene.add(citySidewalk);
        var curb = boxMesh(0.28, 0.22, 500, standard(0xd7dde5, { roughness: 0.8 }));
        curb.position.set(12.95, 0.11, -235);
        scene.add(curb);

        function makeShop(index) {
            var g = new THREE.Group();
            var palette = [0xe8c7a8, 0xb8d8d0, 0xe9b9c7, 0xc8c6e8, 0xf2dfb0, 0xb7d7ea];
            var w = 7 + (index % 3) * 1.8;
            var d = 5.5 + (index % 2) * 1.8;
            var h = 5.5 + (index % 4) * 1.8;
            var bodyMat = standard(palette[index % palette.length], { roughness: 0.78, metalness: 0.04 });
            var body = boxMesh(w, h, d, bodyMat); body.position.y = h / 2; g.add(body);
            var roof = boxMesh(w * 0.82, 0.35, d * 0.82, standard(0x39424a, { roughness: 0.7 }));
            roof.position.y = h + 0.17; g.add(roof);
            var windowMat = new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.82 });
            var windowDark = new THREE.MeshBasicMaterial({ color: 0x16303c, transparent: true, opacity: 0.86 });
            for (var wr = 0; wr < 3; wr++) {
                for (var wc = 0; wc < 2; wc++) {
                    var win = boxMesh(0.08, 1.15, 1.6, (wr + wc + index) % 4 === 0 ? windowDark : windowMat);
                    win.position.set(-w / 2 - 0.04, 1.9 + wr * 1.45, -d * 0.25 + wc * 2.3);
                    g.add(win);
                }
            }
            var door = boxMesh(0.09, 2.1, 1.1, windowDark);
            door.position.set(-w / 2 - 0.05, 1.05, d * 0.28); g.add(door);
            var awningMat = new THREE.MeshBasicMaterial({ color: index % 2 ? 0xff5a5a : 0x54d6b0 });
            var awning = boxMesh(0.16, 0.18, d * 0.72, awningMat);
            awning.position.set(-w / 2 - 0.45, 2.95, 0); g.add(awning);
            var sign = boxMesh(0.08, 0.85, w * 0.62, new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0x5fe0ff : (index % 3 === 1 ? 0xff8fd0 : 0xffd166) }));
            sign.position.set(-w / 2 - 0.08, h - 0.85, 0); g.add(sign);
            return g;
        }

        for (var sh = 0; sh < (isMobileDevice ? 7 : 16); sh++) {
            var shop = makeShop(sh);
            shop.position.set(22 + (sh % 3) * 5.5, 0, 8 - sh * 36);
            shop.rotation.y = 0;
            addScroller(shop, 576, 1, 230);
        }

        function makeCrossStreet(index) {
            var g = new THREE.Group();
            var asphalt = new THREE.Mesh(new THREE.PlaneGeometry(31, 8.5), standard(0x30343a, { roughness: 0.94 }));
            asphalt.rotation.x = -Math.PI / 2;
            asphalt.position.set(24, 0.025, 0); g.add(asphalt);
            for (var l = 0; l < 4; l++) {
                var stripe = new THREE.Mesh(new THREE.PlaneGeometry(31, 0.12), new THREE.MeshBasicMaterial({ color: 0xf4f1d5 }));
                stripe.rotation.x = -Math.PI / 2;
                stripe.position.set(24, 0.04, -2.1 + l * 1.4); g.add(stripe);
            }
            return g;
        }
        for (var cs = 0; cs < (isMobileDevice ? 3 : 4); cs++) {
            var street = makeCrossStreet(cs);
            street.position.set(0, 0, -20 - cs * 168);
            addScroller(street, 672, 1, 270);
        }

        function makeOverpass(index) {
            var g = new THREE.Group();
            var deckMat = standard(0x555d66, { roughness: 0.9, metalness: 0.12 });
            var deck = boxMesh(48, 0.8, 4.2, deckMat);
            deck.position.set(0, 7.2, 0); g.add(deck);
            var railMat = standard(0xd9e0e7, { metalness: 0.4, roughness: 0.45 });
            [-1, 1].forEach(function (side) {
                var rail = boxMesh(48, 0.18, 0.15, railMat);
                rail.position.set(0, 8.1, side * 1.95); g.add(rail);
                var col = boxMesh(1.0, 7.2, 1.4, deckMat);
                col.position.set(side * 11.5, 3.6, 0); g.add(col);
            });
            var sign = boxMesh(7.2, 1.15, 0.18, new THREE.MeshBasicMaterial({ color: 0x1f8f5f }));
            sign.position.set(0, 7.9, 2.2); g.add(sign);
            return g;
        }
        for (var ov = 0; ov < (isMobileDevice ? 2 : 3); ov++) {
            var bridge = makeOverpass(ov);
            bridge.position.set(0, 0, -90 - ov * 240);
            addScroller(bridge, 720, 1, 340);
        }

        for (var sl = 0; sl < (isMobileDevice ? 8 : 12); sl++) {
            var cityLamp = new THREE.Group();
            var pole = cylinderMesh(0.07, 0.1, 6.2, 8, standard(0x2e353c, { metalness: 0.6, roughness: 0.4 }));
            pole.position.y = 3.1; cityLamp.add(pole);
            var arm = boxMesh(1.6, 0.08, 0.08, standard(0x2e353c, { metalness: 0.6 }));
            arm.position.set(-0.75, 6.1, 0); cityLamp.add(arm);
            var head = boxMesh(0.7, 0.16, 0.3, new THREE.MeshBasicMaterial({ color: 0xffe6b0 }));
            head.position.set(-1.45, 6.05, 0); cityLamp.add(head);
            cityLamp.position.set(13.9, 0, -8 - sl * 44);
            addScroller(cityLamp, 528, 1, 230);
        }

        function makeParkedCar(index) {
            var g = new THREE.Group();
            var palette = [0x5f6f7e, 0x8c4a4a, 0x4d6b5d, 0x8a7a52, 0x5a4d72, 0x9a9a9a];
            var bodyMat = standard(palette[index % palette.length], { metalness: 0.5, roughness: 0.34 });
            var body = boxMesh(1.82, 0.52, 4.0, bodyMat); body.position.y = 0.48; g.add(body);
            var cabin = boxMesh(1.58, 0.42, 1.85, standard(0x18323d, { metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.86 }));
            cabin.position.set(0, 0.9, 0.1); g.add(cabin);
            var tire = standard(0x141619, { roughness: 0.9 });
            [[-0.82, -1.25], [0.82, -1.25], [-0.82, 1.3], [0.82, 1.3]].forEach(function (p) {
                var wheel = cylinderMesh(0.3, 0.3, 0.22, 10, tire);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(p[0], 0.3, p[1]); g.add(wheel);
            });
            return g;
        }
        for (var pc = 0; pc < (isMobileDevice ? 5 : 9); pc++) {
            var parked = makeParkedCar(pc);
            parked.position.set(18.2, 0, -10 - pc * 62);
            addScroller(parked, 558, 1, 230);
        }

        function makeTrafficLight() {
            var g = new THREE.Group();
            var poleMat = standard(0x2d333a, { metalness: 0.55, roughness: 0.4 });
            var pole = cylinderMesh(0.09, 0.11, 5.2, 8, poleMat); pole.position.y = 2.6; g.add(pole);
            var arm = boxMesh(2.1, 0.1, 0.1, poleMat); arm.position.set(-1.0, 5.1, 0); g.add(arm);
            var housing = boxMesh(0.38, 1.0, 0.32, standard(0x14181c, { roughness: 0.7 }));
            housing.position.set(-2.0, 4.85, 0); g.add(housing);
            var colors = [0xff3b3b, 0xffc24a, 0x54ff9f];
            for (var li = 0; li < 3; li++) {
                var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: colors[li] }));
                lamp.position.set(-2.0, 5.18 - li * 0.28, 0.17); g.add(lamp);
            }
            return g;
        }
        for (var tl = 0; tl < 4; tl++) {
            var light = makeTrafficLight();
            light.position.set(12.4, 0, -18 - tl * 168);
            addScroller(light, 672, 1, 270);
        }

        function makeBusStop(index) {
            var g = new THREE.Group();
            var frameMat = standard(0x303840, { metalness: 0.6, roughness: 0.4 });
            var glassMat = new THREE.MeshStandardMaterial({ color: 0xa8dff0, metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
            var roof = boxMesh(4.0, 0.15, 1.5, frameMat); roof.position.y = 2.6; g.add(roof);
            [-1.9, 1.9].forEach(function (x) {
                var post = boxMesh(0.1, 2.6, 0.1, frameMat); post.position.set(x, 1.3, 0.55); g.add(post);
            });
            var back = boxMesh(3.9, 2.1, 0.06, glassMat); back.position.set(0, 1.25, 0.62); g.add(back);
            var bench = boxMesh(3.1, 0.12, 0.55, standard(0x5b4a32, { roughness: 0.8 })); bench.position.set(0, 0.55, 0); g.add(bench);
            var signTex = makeCanvasTexture(256, 80, function (cg, w, h) {
                cg.fillStyle = '#123e59'; cg.fillRect(0, 0, w, h);
                cg.fillStyle = '#ffffff'; cg.font = 'bold 34px Arial'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
                cg.fillText('BUS · OCEAN DR', w / 2, h / 2);
            });
            var sign = boxMesh(2.5, 0.75, 0.08, new THREE.MeshBasicMaterial({ map: signTex }));
            sign.position.set(0, 2.95, 0.7); g.add(sign);
            return g;
        }
        for (var bs = 0; bs < 3; bs++) {
            var stop = makeBusStop(bs);
            stop.position.set(15.6, 0, -42 - bs * 184);
            addScroller(stop, 552, 1, 230);
        }

        function makeCitySign(text, color) {
            var g = new THREE.Group();
            var tex = makeCanvasTexture(384, 96, function (cg, w, h) {
                cg.fillStyle = '#0c1620'; cg.fillRect(0, 0, w, h);
                cg.strokeStyle = color; cg.lineWidth = 5; cg.strokeRect(5, 5, w - 10, h - 10);
                cg.fillStyle = '#eafaff'; cg.font = 'bold 32px Arial'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
                cg.fillText(text, w / 2, h / 2);
            });
            var board = boxMesh(5.8, 1.45, 0.12, new THREE.MeshBasicMaterial({ map: tex }));
            board.position.y = 4.7; g.add(board);
            [-2.1, 2.1].forEach(function (x) {
                var post = boxMesh(0.12, 4.0, 0.12, standard(0x3a424a, { metalness: 0.5 }));
                post.position.set(x, 2.0, 0); g.add(post);
            });
            return g;
        }
        var citySignNames = [['OCEAN DRIVE', '#5fe0ff'], ['NEON BOULEVARD', '#ff8fd0'], ['MARINA DISTRICT', '#ffd166']];
        for (var csg = 0; csg < 6; csg++) {
            var sn = citySignNames[csg % citySignNames.length];
            var citySign = makeCitySign(sn[0], sn[1]);
            citySign.position.set(17.2, 0, -70 - csg * 104);
            addScroller(citySign, 624, 1, 260);
        }

        for (var ui = 0; ui < (isMobileDevice ? 6 : 8); ui++) {
            var umb = makeUmbrellaCluster(ui);
            umb.position.set(10.8 + (ui % 2) * 1.5 + Math.random() * 0.8, 0, -6 - ui * 58);
            umb.rotation.y = Math.random() * Math.PI * 2;
            umb.scale.setScalar(0.82);
            addScroller(umb, 464, 1, 190);
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
            addScroller(rock, 360, 0.8, 260);
        }
        var driftMat = standard(0x9a7248, { roughness: 0.95 });
        for (var dr = 0; dr < 8; dr++) {
            var drift = cylinderMesh(0.11, 0.2, 2.4 + Math.random() * 2, 6, driftMat);
            drift.rotation.z = Math.PI / 2;
            drift.rotation.y = Math.random() * 0.7;
            drift.position.set(12 + Math.random() * 8, 0.14, -Math.random() * 320);
            addScroller(drift, 320, 1, 250);
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
            bus: { len: 11.8, width: 2.55, ride: 0.3, hood: 0.84, deck: 0.76, cabinZ: 0.65, cabinLen: 9.0, cabinH: 1.62, cabinW: 2.3, roof: true, bus: true },
            semi: { len: 13.0, width: 2.45, ride: 0.3, hood: 0.72, deck: 0.6, cabinZ: -4.2, cabinLen: 1.8, cabinH: 1.15, cabinW: 2.05, roof: true, bed: true, semi: true },
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
            if (spec.f1) cabin.visible = false;

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
                var haloRing = new THREE.Mesh(new THREE.TorusGeometry(spec.width * 0.78, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
                haloRing.rotation.x = Math.PI / 2;
                haloRing.position.y = 0.66;
                g.add(haloRing);
                var haloRing2 = new THREE.Mesh(new THREE.TorusGeometry(spec.width * 0.62, 0.025, 6, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
                haloRing2.rotation.x = Math.PI / 2;
                haloRing2.position.y = 0.7;
                g.add(haloRing2);
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
                // Roof vents and rear window for the longer bus.
                for (var bv = 0; bv < 4; bv++) {
                    var vent = boxMesh(0.8, 0.12, 0.55, standard(0x8b949e, { metalness: 0.5, roughness: 0.4 }));
                    vent.position.set(0, spec.ride + spec.hood + spec.cabinH + 0.09, spec.cabinZ - 2.8 + bv * 1.9);
                    g.add(vent);
                }
            }
            if (spec.semi) {
                var trailerMat = standard(0xe5e7e9, { metalness: 0.35, roughness: 0.42 });
                var trailer = boxMesh(spec.width * 1.03, 2.9, spec.len * 0.64, trailerMat);
                trailer.position.set(0, spec.ride + 1.65, spec.len * 0.19);
                g.add(trailer);
                var trailerRoof = boxMesh(spec.width * 1.04, 0.12, spec.len * 0.64, standard(0xb9c0c7, { metalness: 0.4, roughness: 0.5 }));
                trailerRoof.position.set(0, spec.ride + 3.15, spec.len * 0.19);
                g.add(trailerRoof);
                var trailerStripe = boxMesh(spec.width * 1.05, 0.28, spec.len * 0.62, new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
                trailerStripe.position.set(0, spec.ride + 0.62, spec.len * 0.19);
                g.add(trailerStripe);
                var cabGuard = boxMesh(spec.width * 1.02, 1.25, 0.18, standard(0x30363d, { metalness: 0.5, roughness: 0.4 }));
                cabGuard.position.set(0, spec.ride + 0.95, -spec.len * 0.05);
                g.add(cabGuard);
                var trailerWheelMat = standard(0x141619, { roughness: 0.92 });
                for (var tw = -1; tw <= 1; tw += 2) {
                    var trailerWheel = cylinderMesh(0.4, 0.4, 0.3, 16, trailerWheelMat);
                    trailerWheel.rotation.z = Math.PI / 2;
                    trailerWheel.position.set(tw * (spec.width / 2 - 0.02), 0.4, spec.len * 0.47);
                    g.add(trailerWheel);
                }
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
                color: 0x5d3f1e, transparent: true, opacity: 0.14, depthWrite: false
            }));
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = 0.012;
            shadow.userData.fakeShadow = true;
            g.add(shadow);

            // Real-time shadow casting for the car shell. Opaque meshes only so
            // glass/lamps do not add extra shadow-map work.
            g.traverse(function (child) {
                if (!child || !child.isMesh || child.userData.fakeShadow) return;
                if (child.material && child.material.transparent) return;
                child.castShadow = true;
            });

            var carDetails = [];
            g.traverse(function (child) {
                if (!child || !child.isMesh || !child.geometry) return;
                if (child.userData && (child.userData.fakeShadow || child.userData.isSuspensionPivot)) return;
                try {
                    if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
                    var bs = child.geometry.boundingSphere;
                    if (bs && bs.radius < 0.3) carDetails.push(child);
                } catch (e) {}
            });
            g.userData.lodDetails = carDetails;
            g.userData.lodVisible = true;
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

        function makeDriverRagdoll() {
            var g = new THREE.Group();
            var skin = standard(0xd9a066, { roughness: 0.78, metalness: 0.02 });
            var shirt = standard(0x2478d4, { roughness: 0.82, metalness: 0.03 });
            var pants = standard(0x242a33, { roughness: 0.9, metalness: 0.02 });
            var shoe = standard(0x111318, { roughness: 0.8 });
            var torso = boxMesh(0.34, 0.44, 0.21, shirt);
            torso.position.y = 0.62; g.add(torso);
            var hips = boxMesh(0.28, 0.18, 0.2, pants);
            hips.position.y = 0.36; g.add(hips);
            var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skin);
            head.position.y = 0.98; g.add(head);
            var armL = new THREE.Group();
            var armLMesh = cylinderMesh(0.055, 0.065, 0.42, 8, shirt);
            armLMesh.position.y = -0.21; armL.add(armLMesh);
            armL.position.set(-0.23, 0.8, 0); armL.rotation.z = 0.18; g.add(armL);
            var armR = new THREE.Group();
            var armRMesh = cylinderMesh(0.055, 0.065, 0.42, 8, shirt);
            armRMesh.position.y = -0.21; armR.add(armRMesh);
            armR.position.set(0.23, 0.8, 0); armR.rotation.z = -0.18; g.add(armR);
            var legL = new THREE.Group();
            var legLMesh = cylinderMesh(0.07, 0.08, 0.48, 8, pants);
            legLMesh.position.y = -0.24; legL.add(legLMesh);
            var shoeL = boxMesh(0.14, 0.09, 0.24, shoe);
            shoeL.position.set(0, -0.5, -0.05); legL.add(shoeL);
            legL.position.set(-0.1, 0.3, 0); g.add(legL);
            var legR = new THREE.Group();
            var legRMesh = cylinderMesh(0.07, 0.08, 0.48, 8, pants);
            legRMesh.position.y = -0.24; legR.add(legRMesh);
            var shoeR = boxMesh(0.14, 0.09, 0.24, shoe);
            shoeR.position.set(0, -0.5, -0.05); legR.add(shoeR);
            legR.position.set(0.1, 0.3, 0); g.add(legR);
            g.userData.limbs = [
                { mesh: armL, spin: 0 }, { mesh: armR, spin: 0 },
                { mesh: legL, spin: 0 }, { mesh: legR, spin: 0 }
            ];
            g.userData.head = head;
            return g;
        }

        var player = buildCar(paintColor, wheelColor, bodyStyle, engineStyle, engineColor, true);
        player.position.set(LANES[2], 0, 5);
        scene.add(player);

        function makeAiRacers() {
            var defs = [
                { name: 'Apex', style: 'racer', color: 0x4cc9f0, lane: 0, skill: 1.0 },
                { name: 'Nova', style: 'gt', color: 0xff5d8f, lane: 1, skill: 0.94 },
                { name: 'Blaze', style: 'super', color: 0xffd166, lane: 3, skill: 1.04 },
                { name: 'Viper', style: 'phantom', color: 0x7dff4d, lane: 4, skill: 0.9 }
            ];
            defs.forEach(function (def, i) {
                var car = buildCar(def.color, null, def.style, 'v8', null, false);
                car.position.set(LANES[def.lane], 0, player.position.z - (8 + i * 7));
                scene.add(car);
                aiRacers.push({
                    car: car,
                    lane: def.lane,
                    targetLane: def.lane,
                    distance: -(8 + i * 7),
                    lap: 1,
                    speed: 0,
                    skill: def.skill,
                    changeT: 2 + Math.random() * 3,
                    finished: false,
                    name: def.name
                });
            });
        }
        if (raceMode && raceAi) makeAiRacers();

        // Driver and crash ragdoll removed.
        var driverRagdoll = null;

        // First-person steering wheel.
        var fpWheel = new THREE.Group();
        var fpWheelMat = standard(0x14171b, { metalness: 0.45, roughness: 0.45 });
        var fpWheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.027, 8, 22), fpWheelMat);
        fpWheel.add(fpWheelRim);
        var fpHub = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), standard(0x2a2f36, { metalness: 0.6, roughness: 0.3 }));
        fpWheel.add(fpHub);
        [-1, 1].forEach(function (spokeSide) {
            var spoke = boxMesh(0.16, 0.024, 0.024, fpWheelMat);
            spoke.position.x = spokeSide * 0.08;
            fpWheel.add(spoke);
        });
        var fpWheelSpoke = boxMesh(0.024, 0.16, 0.024, fpWheelMat);
        fpWheelSpoke.position.y = -0.08;
        fpWheel.add(fpWheelSpoke);
        fpWheel.position.set(0, 0.78, -0.5);
        fpWheel.scale.setScalar(0.78);
        fpWheel.rotation.x = -0.32;
        fpWheel.visible = false;
        player.add(fpWheel);

        var ragdollActive = false;
        var ragdollTethered = false;
        var seatbeltStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1), standard(0x24282e, { roughness: 0.8 }));
        seatbeltStrap.visible = false;
        scene.add(seatbeltStrap);
        var ragdollVx = 0, ragdollVy = 0, ragdollVz = 0;
        var ragdollSpinX = 0, ragdollSpinY = 0, ragdollSpinZ = 0;

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

        var fsdChevronTex = makeCanvasTexture(128, 256, function (g, w, h) {
            g.clearRect(0, 0, w, h);
            g.strokeStyle = '#5fe0ff';
            g.lineWidth = 13;
            g.lineCap = 'round';
            g.lineJoin = 'round';
            for (var i = 0; i < 4; i++) {
                var cy = 26 + i * 64;
                g.beginPath();
                g.moveTo(22, cy + 26);
                g.lineTo(64, cy);
                g.lineTo(106, cy + 26);
                g.stroke();
            }
        }, 1, 3);
        fsdChevronTex.wrapS = THREE.RepeatWrapping;
        fsdChevronTex.wrapT = THREE.RepeatWrapping;
        fsdChevronTex.repeat.set(1, 3);
        var fsdChevronMat = new THREE.MeshBasicMaterial({
            map: fsdChevronTex, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        var fsdChevrons = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 120), fsdChevronMat);
        fsdChevrons.rotation.x = -Math.PI / 2;
        fsdChevrons.position.set(0, 0.08, -55);
        fsdGroup.add(fsdChevrons);

        fsdGroup.visible = false;
        scene.add(fsdGroup);
        var fsdPanelLast = 0;

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
        var RAMP_SLOTS = 0;
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
            var throttleFill = document.getElementById('g3dThrottleFill');
            if (throttleFill) throttleFill.style.height = Math.round(throttleDisplay * 100) + '%';
            var brakeFill = document.getElementById('g3dBrakeFill');
            if (brakeFill) brakeFill.style.height = Math.round(brakeDisplay * 100) + '%';
            var coinEl = document.getElementById('g3dRunCoins');
            if (coinEl) setPillText('g3dRunCoins', coinsCollected);
            var gearWrap = document.getElementById('g3dGears');
            if (gearWrap) {
                var gearBtns = gearWrap.querySelectorAll('button');
                for (var gbi = 0; gbi < gearBtns.length; gbi++) {
                    gearBtns[gbi].classList.toggle('is-active', gearBtns[gbi].getAttribute('data-gear') === gearMode);
                }
            }
        }

        /* ---------------- Crash physics and debris ---------------- */
        var crashActive = false;
        var crashWorld = makePhysicsWorld(-24);
        if (crashWorld) {
            crashWorld.defaultContactMaterial.friction = 0.015;
            crashWorld.defaultContactMaterial.restitution = 0.12;
        }
        var crashWreckBodies = [];
        var crashWheels = [];
        var crashSprings = [];
        var crashPlayerBody = null;
        var crashOtherBody = null;
        var crashFatal = false;
        var crashSoftBody = null;
        var crashSoftBase = null;
        var crashSoftDent = null;
        var crashPrevPixelRatio = 1;
        var crashRealT = 0;
        var crashStartMs = 0;
        var crashScore = 0;
        var crashVx = 0, crashSpinX = 0, crashSpinY = 0, crashSpinZ = 0;
        var warningT = 0;
        var honkCooldown = 0;
        var crashCar = null, crashCarVx = 0, crashCarVz = 0, crashCarSpin = 0;
        var crashWheel = null, crashWheelVx = 0, crashWheelVy = 0, crashWheelVz = 0, crashWheelSpin = 0;
        var crashBoard = null, crashBoardVx = 0, crashBoardVy = 0, crashBoardVz = 0, crashBoardSpin = 0;
        var crashDebris = [];
        var debrisColors = [0xd9e2ec, 0xff4d5e, 0x2b2b2b, 0xffd166, 0x4cc9f0];        for (var cdi = 0; cdi < (isMobileDevice ? 18 : 26); cdi++) {
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
        var SPARK_COUNT = isMobileDevice ? 100 : 160;
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
                sparkPositions[ix + 2] += sparkVelocities[ix + 2] * dt + speed * dt;
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
                d.mesh.position.z += (d.vz + speed) * dt;
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

        function crumpleCarPart(group, zone, severity) {
            if (!group) return;
            var hitCount = 0;
            group.traverse(function (child) {
                if (!child || !child.isMesh) return;
                if (child.userData && child.userData.fakeShadow) return;
                if (child.material && child.material.transparent) return;
                var p = child.position;
                var hit = zone === 'front' ? p.z < 0.4 :
                    zone === 'rear' ? p.z > -0.4 :
                    zone === 'left' ? p.x < 0.2 : p.x > -0.2;
                if (!hit) return;
                hitCount++;
                if (zone === 'front' || zone === 'rear') {
                    var zs = zone === 'front' ? -1 : 1;
                    child.position.z += zs * severity * 0.45;
                    child.scale.z *= Math.max(0.18, 1 - severity * 1.5);
                    child.scale.y *= 1 + severity * 0.28;
                    child.rotation.x += zs * severity * 0.52;
                } else {
                    var xs = zone === 'left' ? -1 : 1;
                    child.position.x -= xs * severity * 0.35;
                    child.scale.x *= Math.max(0.22, 1 - severity * 1.25);
                    child.scale.y *= 1 + severity * 0.24;
                    child.rotation.z += xs * severity * 0.55;
                }
            });
            // A visible shell crush so damage reads even at a glance.
            if (zone === 'front') {
                group.scale.z *= 1 - severity * 0.45;
                group.scale.x *= 1 + severity * 0.15;
                group.position.z -= severity * 0.28;
            } else if (zone === 'rear') {
                group.scale.z *= 1 - severity * 0.34;
                group.scale.x *= 1 + severity * 0.12;
                group.position.z += severity * 0.22;
            } else if (zone === 'left') {
                group.scale.x *= 1 - severity * 0.4;
                group.scale.y *= 1 + severity * 0.12;
                group.position.x -= severity * 0.24;
            } else {
                group.scale.x *= 1 - severity * 0.4;
                group.scale.y *= 1 + severity * 0.12;
                group.position.x += severity * 0.24;
            }
        }

        function setCrashCinema(on) {
            var overlay = document.getElementById('g3dCinema');
            if (overlay) overlay.classList.toggle('is-active', !!on);
            if (!renderer || !renderer.domElement) return;
            try {
                if (on) {
                    crashPrevPixelRatio = renderer.getPixelRatio();
                    var h = Math.max(1, renderer.domElement.clientHeight);
                    var ratio = Math.max(0.35, Math.min(1, 720 / h));
                    renderer.setPixelRatio(ratio);
                    renderer.setSize(renderer.domElement.clientWidth, h, false);
                    renderer.toneMappingExposure = 1.22;
                } else {
                    renderer.setPixelRatio(crashPrevPixelRatio || 1);
                    renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false);
                    renderer.toneMappingExposure = 1.08;
                }
            } catch (e) {}
        }

        function clearSoftWreck() {
            if (crashSoftBody) {
                scene.remove(crashSoftBody);
                disposeObject(crashSoftBody);
                crashSoftBody = null;
            }
            crashSoftBase = null;
            crashSoftDent = null;
            player.visible = true;
        }

        function buildMergedPlayerGeometry() {
            player.updateMatrixWorld(true);
            var inv = new THREE.Matrix4().copy(player.matrixWorld).invert();
            var positions = [], normals = [], colors = [];
            var sources = [];
            player.children.forEach(function (child) {
                if (child === driverRagdoll) return;
                sources.push(child);
            });
            sources.forEach(function (root) {
                root.traverse(function (mesh) {
                    if (!mesh || !mesh.isMesh || !mesh.geometry) return;
                    if (mesh.userData && mesh.userData.fakeShadow) return;
                    var g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
                    var m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
                    g.applyMatrix4(m);
                    if (!g.attributes.normal) g.computeVertexNormals();
                    var pa = g.attributes.position.array;
                    var na = g.attributes.normal.array;
                    var mat = mesh.material;
                    if (Array.isArray(mat)) mat = mat[0];
                    var col = new THREE.Color(0xc8d0d8);
                    if (mat && mat.color) col.copy(mat.color);
                    if (mat && mat.transparent) col.multiplyScalar(0.58);
                    for (var i = 0; i < pa.length; i += 3) {
                        positions.push(pa[i], pa[i + 1], pa[i + 2]);
                        normals.push(na[i], na[i + 1], na[i + 2]);
                        colors.push(col.r, col.g, col.b);
                    }
                    g.dispose();
                });
            });
            if (!positions.length) return null;
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geo.computeBoundingSphere();
            return geo;
        }

        function buildSoftWreck(zone, severity) {
            clearSoftWreck();
            var spec = player.userData.spec || {};
            var geo = buildMergedPlayerGeometry();
            if (!geo) return;
            var pos = geo.attributes.position;
            var base = new Float32Array(pos.array.length);
            var dent = new Float32Array(pos.array.length);
            var width = (spec.width || 1.8);
            var len = (spec.len || 3.2);
            var impactX = zone === 'left' ? -width * 0.5 : zone === 'right' ? width * 0.5 : 0;
            var impactZ = zone === 'front' ? -len * 0.5 : zone === 'rear' ? len * 0.5 : 0;
            var dirX = zone === 'left' ? 1 : zone === 'right' ? -1 : 0;
            var dirZ = zone === 'front' ? 1 : zone === 'rear' ? -1 : 0;
            for (var i = 0; i < pos.count; i++) {
                var ix = i * 3;
                var x = pos.array[ix], y = pos.array[ix + 1], z = pos.array[ix + 2];
                base[ix] = x; base[ix + 1] = y; base[ix + 2] = z;
                // Smooth crumple-zone falloff: the impact area deforms, while
                // the occupant cell stays mostly intact.
                var dx = x - impactX, dz = z - impactZ;
                var dist = Math.sqrt(dx * dx + dz * dz);
                var falloff = Math.exp(-(dist * dist) / (2 * 0.72 * 0.72));
                if (falloff < 0.015) continue;
                var f = severity * 1.15 * falloff;
                var cabinGuard = (Math.abs(z) < len * 0.22 && y > 0.45) ? 0.28 : 1;
                f *= cabinGuard;
                dent[ix] += dirX * f * 0.78 + (Math.random() - 0.5) * f * 0.045;
                dent[ix + 1] += -f * 0.18 + (Math.random() - 0.5) * f * 0.035;
                dent[ix + 2] += dirZ * f * 0.78 + (Math.random() - 0.5) * f * 0.045;
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            var mat = new THREE.MeshPhysicalMaterial({
                vertexColors: true, metalness: 0.4, roughness: 0.24,
                clearcoat: 0.95, clearcoatRoughness: 0.1
            });
            crashSoftBody = new THREE.Mesh(geo, mat);
            crashSoftBody.position.copy(player.position);
            crashSoftBody.quaternion.copy(player.quaternion);
            crashSoftBase = base;
            crashSoftDent = dent;
            scene.add(crashSoftBody);
            player.visible = false;
        }

        function updateSoftWreck() {
            if (!crashSoftBody || !crashSoftBase) return;
            crashSoftBody.position.copy(player.position);
            crashSoftBody.quaternion.copy(player.quaternion);
            var pos = crashSoftBody.geometry.attributes.position;
            var arr = pos.array;
            var settle = Math.max(0, 1 - crashRealT / 2.8);
            var wobble = 1 + Math.sin(crashRealT * 22) * 0.16 * settle;
            for (var i = 0; i < arr.length; i++) {
                arr[i] = crashSoftBase[i] + crashSoftDent[i] * wobble;
            }
            pos.needsUpdate = true;
            if (!crashSoftBody.userData.normalAt || crashRealT - crashSoftBody.userData.normalAt > 0.09) {
                crashSoftBody.userData.normalAt = crashRealT;
                crashSoftBody.geometry.computeVertexNormals();
            }
        }

        function launchRagdoll(dir, impactSpeed, zone) {
            if (!driverRagdoll) return;
            scene.attach(driverRagdoll);
            driverRagdoll.position.y += 0.9;
            ragdollActive = true;
            ragdollTethered = true;
            var side = zone === 'left' ? -1 : zone === 'right' ? 1 : dir;
            ragdollVx = (side * (3 + Math.min(12, impactSpeed * 0.06)) + dir * 2.0) * 0.55;
            ragdollVy = (5 + Math.min(11, impactSpeed * 0.055)) * 0.6;
            ragdollVz = ((zone === 'front' ? -1 : 1) * (2 + Math.min(10, impactSpeed * 0.045)) + (Math.random() - 0.5) * 3) * 0.55;
            seatbeltStrap.visible = true;
            ragdollSpinX = (Math.random() - 0.5) * 9;
            ragdollSpinY = (Math.random() - 0.5) * 7;
            ragdollSpinZ = (Math.random() - 0.5) * 8;
            (driverRagdoll.userData.limbs || []).forEach(function (limb) {
                limb.spin = (Math.random() - 0.5) * 18;
                limb.mesh.rotation.x = (Math.random() - 0.5) * 1.4;
            });
        }

        function updateRagdoll(dt) {
            if (!ragdollActive || !driverRagdoll) return;
            driverRagdoll.position.x += ragdollVx * dt;
            driverRagdoll.position.y += ragdollVy * dt;
            driverRagdoll.position.z += ragdollVz * dt;
            ragdollVy -= 24 * dt;
            driverRagdoll.rotation.x += ragdollSpinX * dt;
            driverRagdoll.rotation.y += ragdollSpinY * dt;
            driverRagdoll.rotation.z += ragdollSpinZ * dt;
            ragdollSpinX *= Math.max(0, 1 - dt * 1.1);
            ragdollSpinY *= Math.max(0, 1 - dt * 0.9);
            ragdollSpinZ *= Math.max(0, 1 - dt * 1.2);
            (driverRagdoll.userData.limbs || []).forEach(function (limb) {
                limb.mesh.rotation.x += limb.spin * dt;
                limb.spin *= Math.max(0, 1 - dt * 1.4);
            });
            if (ragdollTethered) {
                var seatAnchor = new THREE.Vector3(0.32, 1.18, 0.08).applyMatrix4(player.matrixWorld);
                var toSeat = new THREE.Vector3().subVectors(driverRagdoll.position, seatAnchor);
                var tetherDist = toSeat.length();
                if (tetherDist > 1.25) {
                    toSeat.multiplyScalar(1.25 / tetherDist);
                    driverRagdoll.position.copy(seatAnchor).add(toSeat);
                    ragdollVx *= 0.25;
                    ragdollVy *= 0.3;
                    ragdollVz *= 0.25;
                }
                seatbeltStrap.position.lerpVectors(seatAnchor, driverRagdoll.position, 0.5);
                var strapDir = new THREE.Vector3().subVectors(driverRagdoll.position, seatAnchor);
                var strapLen = Math.max(0.1, strapDir.length());
                seatbeltStrap.scale.z = strapLen;
                seatbeltStrap.lookAt(driverRagdoll.position);
            }
            if (driverRagdoll.position.y < 0.22) {
                driverRagdoll.position.y = 0.22;
                ragdollVy = Math.abs(ragdollVy) * 0.33;
                ragdollVx *= 0.7;
                ragdollVz *= 0.7;
                ragdollSpinX *= 0.6;
                ragdollSpinY *= 0.6;
                ragdollSpinZ *= 0.6;
            }
        }

        function resolveCollision(car, halfWidth) {
            var playerKmh = Math.abs(speed) * 3.6;
            var otherKmh = Math.abs(car.userData.cruiseSpeed || 0) * 3.6;
            if (playerKmh > 30 && otherKmh > 30) {
                triggerCrash(car, halfWidth);
                return true;
            }
            // Minor contact: sparks and debris, but no crash sequence.
            var mx2 = (player.position.x + car.position.x) * 0.5;
            var mz2 = (player.position.z + car.position.z) * 0.5;
            spawnCrashDebris(mx2, mz2);
            spawnSparks(mx2, 0.7, mz2, 28);
            spawnCrashSmoke(mx2, mz2, 2);
            speed = Math.max(0, speed * 0.72);
            suspensionImpulse = Math.max(suspensionImpulse, 0.45);
            var dirX = player.position.x >= car.position.x ? 1 : -1;
            player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x + dirX * 0.38));
            car.position.x += dirX * 0.2;
            car.userData.collisionCooldown = 0.8;
            tone(240, 0.12, 'square', 0.07, 120);
            return false;
        }

        function wreckMassFor(spec) {
            var len = (spec && spec.len) || 3.2;
            if (len > 12) return 12000;
            if (len > 9) return 9000;
            if (len > 4.2) return 4200;
            if (len > 3.7) return 2800;
            return 1350;
        }

        function addWreckWheels(body, spec, initialSpeed) {
            if (!crashWorld || !global.CANNON) return;
            var w = spec.width || 1.8;
            var len = spec.len || 3.2;
            var wheelRadius = 0.35;
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p, wi) {
                var ox = p[0] * (w / 2 - 0.04);
                var oz = p[1] * len * 0.31;
                var wheel = new global.CANNON.Body({ mass: 14 });
                wheel.addShape(new global.CANNON.Sphere(wheelRadius));
                wheel.position.set(body.position.x + ox, Math.max(wheelRadius, body.position.y - 0.28), body.position.z + oz);
                wheel.collisionFilterGroup = 0;
                wheel.collisionFilterMask = 0;
                wheel.linearDamping = 0.4;
                wheel.angularDamping = 0.15;
                wheel.angularVelocity.set(-Math.abs(initialSpeed || 0) / wheelRadius, 0, 0);
                crashWorld.addBody(wheel);
                crashWheels.push(wheel);
                var hinge = new global.CANNON.HingeConstraint(body, wheel, {
                    pivotA: new global.CANNON.Vec3(ox, -0.28, oz),
                    axisA: new global.CANNON.Vec3(1, 0, 0),
                    pivotB: new global.CANNON.Vec3(0, 0, 0),
                    axisB: new global.CANNON.Vec3(1, 0, 0)
                });
                crashWorld.addConstraint(hinge);
                var spring = new global.CANNON.Spring(body, wheel, {
                    localAnchorA: new global.CANNON.Vec3(ox, -0.18, oz),
                    localAnchorB: new global.CANNON.Vec3(0, 0, 0),
                    restLength: 0.12,
                    stiffness: 55,
                    damping: 2.4
                });
                crashSprings.push(spring);
            });
        }

        function convertTrafficToWreck(car, sourceBody) {
            if (!crashWorld || !global.CANNON || !car || car.userData.dynamicBody) return null;
            var u = car.userData;
            var spec = u.spec || {};
            if (u.sensorBody) { crashWorld.removeBody(u.sensorBody); u.sensorBody = null; }
            var body = new global.CANNON.Body({ mass: wreckMassFor(spec) });
            body.addShape(new global.CANNON.Box(new global.CANNON.Vec3((spec.width || 1.8) / 2, 0.45, (spec.len || 3.2) / 2)));
            body.position.set(car.position.x, 0.72, car.position.z);
            body.linearDamping = 0.1;
            body.angularDamping = 0.28;
            var svx = sourceBody ? sourceBody.velocity.x : crashVx;
            var svz = sourceBody ? sourceBody.velocity.z : crashCarVz;
            body.velocity.set(svx * 0.72 + (Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, svz * 0.72 + (Math.random() - 0.5) * 4);
            var point = new global.CANNON.Vec3(
                car.position.x + (Math.random() - 0.5) * (spec.width || 1.8),
                0.7,
                car.position.z + (Math.random() - 0.5) * (spec.len || 3.2)
            );
            body.applyImpulse(new global.CANNON.Vec3(
                (sourceBody ? sourceBody.velocity.x : 0) * body.mass * 0.16,
                140 + Math.random() * 160,
                (sourceBody ? sourceBody.velocity.z : 0) * body.mass * 0.16
            ), point);
            crashWorld.addBody(body);
            u.dynamicBody = body;
            u.state = 'hit';
            crashWreckBodies.push({ car: car, body: body });
            addWreckWheels(body, spec, u.cruiseSpeed || 0);
            spawnSparks(car.position.x, 0.8, car.position.z, 18);
            spawnCrashSmoke(car.position.x, car.position.z, 3);
            tone(180, 0.14, 'square', 0.06, 80);
            return body;
        }

        function chainPileup() {
            if (!crashWorld) return;
            var sources = [];
            if (crashPlayerBody) sources.push(crashPlayerBody);
            if (crashOtherBody) sources.push(crashOtherBody);
            for (var i = 0; i < crashWreckBodies.length; i++) sources.push(crashWreckBodies[i].body);
            var converted = 0;
            for (var si = 0; si < sources.length && converted < 1; si++) {
                var src = sources[si];
                var speedSq = src.velocity.x * src.velocity.x + src.velocity.z * src.velocity.z;
                if (speedSq < 4) continue;
                for (var ti = 0; ti < traffic.length && converted < 1; ti++) {
                    var c = traffic[ti];
                    var u = c.userData;
                    if (u.dynamicBody || !u.sensorBody) continue;
                    if (u.rampCooldown && elapsed < u.rampCooldown) continue;
                    var spec = u.spec || {};
                    var dx = c.position.x - src.position.x;
                    var dz = c.position.z - src.position.z;
                    var reach = ((spec.len || 3.2) + 3.2) * 0.52 + 0.7;
                    if (dx * dx + dz * dz < reach * reach && Math.abs(src.position.y - 0.7) < 2.0) {
                        convertTrafficToWreck(c, src);
                        converted++;
                    }
                }
            }
        }

        function applyWreckGrip(dt) {
            var all = [];
            if (crashPlayerBody) all.push(crashPlayerBody);
            if (crashOtherBody) all.push(crashOtherBody);
            for (var i = 0; i < crashWreckBodies.length; i++) all.push(crashWreckBodies[i].body);
            for (var j = 0; j < all.length; j++) {
                var b = all[j];
                if (b.position.y < 1.05) {
                    b.velocity.x *= Math.max(0, 1 - dt * 0.55);
                    b.velocity.z *= Math.max(0, 1 - dt * 0.38);
                    b.angularVelocity.y *= Math.max(0, 1 - dt * 0.45);
                }
            }
        }

        function syncExtraWrecks() {
            for (var i = 0; i < crashWreckBodies.length; i++) {
                var entry = crashWreckBodies[i];
                var b = entry.body;
                entry.car.position.set(b.position.x, Math.max(0, b.position.y - 0.72), b.position.z);
                entry.car.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
            }
        }

        function triggerCrash(car, halfWidth) {
            if (crashActive) return;
            fsdActive = false;
            var fsdOverlay = document.getElementById('g3dFsd');
            if (fsdOverlay) fsdOverlay.classList.remove('is-active');
            crashActive = true;
            crashRealT = 0;
            crashFatal = false;
            for (var wi = 0; wi < crashWreckBodies.length; wi++) {
                if (crashWorld) crashWorld.removeBody(crashWreckBodies[wi].body);
            }
            crashWreckBodies = [];
            for (var wj = 0; wj < crashWheels.length; wj++) {
                if (crashWorld) crashWorld.removeBody(crashWheels[wj]);
            }
            crashWheels = [];
            crashSprings = [];
            crashStartMs = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
            crashScore = distance + checkpointsPassed * CHECKPOINT_BONUS + driftScore;
            var spec = car.userData && car.userData.spec ? car.userData.spec : {};
            var mass = Math.max(0.8, Math.min(2.2, ((spec.width || 1.8) * (spec.len || 3.2)) / 8));
            var dir = player.position.x >= car.position.x ? 1 : -1;
            var impactSpeed = Math.abs(speed - (car.userData.cruiseSpeed || 0));
            var dz = car.position.z - player.position.z;
            var zone = Math.abs(dz) > 1.9 ? (dz < 0 ? 'front' : 'rear') : (player.position.x >= car.position.x ? 'right' : 'left');
            // Each crumple zone absorbs part of the impact. The struck corner
            // deforms more and the impulse is reduced by the absorbed energy.
            var absorb = zone === 'front' ? 0.6 : zone === 'rear' ? 0.52 : 0.44;
            var severity = Math.min(0.44, 0.07 + impactSpeed * 0.0055);
            crashFatal = !!(spec.bus && impactSpeed * 3.6 > 55);
            var impulse = Math.max(0, impactSpeed * mass * 0.32) * (1 - absorb * 0.55);
            crashVx = dir * (3 + impulse);
            crashSpinX = (Math.random() - 0.5) * 1.0 * (1 - absorb * 0.4);
            crashSpinY = dir * (0.7 + Math.random() * 1.0) * (1 - absorb * 0.35);
            crashSpinZ = dir * (0.4 + Math.random() * 0.8) * (1 - absorb * 0.4);
            vy = (3 + Math.min(10, impactSpeed * 0.05)) * (0.55 + absorb * 0.45);
            playerY = 0.25;
            speed *= Math.max(0.03, 0.28 - absorb * 0.24);
            crashCar = car;
            crashCarVx = -dir * (3 + Math.random() * 5) * mass * (1 - absorb * 0.35);
            crashCarVz = 3 + Math.random() * 7;
            crashCarSpin = -dir * (0.7 + Math.random() * 1.0);
            if (car.userData) {
                car.userData.state = 'hit';
                if (car.userData.sensorBody && crashWorld) crashWorld.removeBody(car.userData.sensorBody);
                car.userData.sensorBody = null;
            }

            if (crashWorld && global.CANNON) {
                if (crashPlayerBody) crashWorld.removeBody(crashPlayerBody);
                if (crashOtherBody) crashWorld.removeBody(crashOtherBody);
                var pSpec = player.userData.spec || {};
                crashPlayerBody = new global.CANNON.Body({ mass: 1150 });
                crashPlayerBody.addShape(new global.CANNON.Box(new global.CANNON.Vec3((pSpec.width || 1.8) / 2, 0.38, (pSpec.len || 3.2) / 2)));
                crashPlayerBody.position.set(player.position.x, 0.72, player.position.z);
                crashPlayerBody.linearDamping = 0.12;
                crashPlayerBody.angularDamping = 0.28;
                crashPlayerBody.velocity.set(crashVx, vy, 0);
                crashPlayerBody.angularVelocity.set(crashSpinX, crashSpinY, crashSpinZ);
                crashWorld.addBody(crashPlayerBody);

                crashOtherBody = new global.CANNON.Body({ mass: Math.max(500, mass * 900) });
                crashOtherBody.addShape(new global.CANNON.Box(new global.CANNON.Vec3((spec.width || 1.8) / 2, 0.38, (spec.len || 3.2) / 2)));
                crashOtherBody.position.set(car.position.x, 0.72, car.position.z);
                crashOtherBody.linearDamping = 0.12;
                crashOtherBody.angularDamping = 0.32;
                crashOtherBody.velocity.set(crashCarVx, 0, crashCarVz);
                crashOtherBody.angularVelocity.set(0, crashCarSpin, 0);
                crashWorld.addBody(crashOtherBody);
                car.userData.dynamicBody = crashOtherBody;
                addWreckWheels(crashPlayerBody, pSpec, impactSpeed);
                addWreckWheels(crashOtherBody, spec, car.userData.cruiseSpeed || 0);
                var contactPoint = new global.CANNON.Vec3(
                    (player.position.x + car.position.x) * 0.5,
                    0.68,
                    (player.position.z + car.position.z) * 0.5
                );
                crashOtherBody.applyImpulse(new global.CANNON.Vec3(
                    crashCarVx * crashOtherBody.mass * 0.12,
                    110,
                    crashCarVz * crashOtherBody.mass * 0.12
                ), contactPoint);
            }

            crumpleCarPart(player.userData.bodyGroup, zone, severity);
            crumpleCarPart(car.userData && car.userData.bodyGroup, zone === 'left' ? 'right' : zone === 'right' ? 'left' : zone, severity * 0.72);
            launchRagdoll(dir, impactSpeed, zone);
            buildSoftWreck(zone, severity);
            setCrashCinema(true);

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
            spawnSparks(car.position.x, 0.9, car.position.z, 60);
            spawnCrashSmoke(car.position.x, car.position.z, 5);
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
            if (crashWorld && crashPlayerBody && crashOtherBody) {
                crashWorld.step(1 / 60, dt, 4);
                for (var sp = 0; sp < crashSprings.length; sp++) {
                    try { crashSprings[sp].applyForce(); } catch (e) {}
                }
                applyWreckGrip(dt);
                chainPileup();
                syncExtraWrecks();
                var pb = crashPlayerBody;
                playerY = Math.max(0, pb.position.y - 0.72);
                player.position.set(pb.position.x, playerY, pb.position.z);
                player.quaternion.set(pb.quaternion.x, pb.quaternion.y, pb.quaternion.z, pb.quaternion.w);
                speed = Math.max(0, speed - 40 * dt);
                animateSuspension(player, dt, speed, distance, player.rotation.z, 1, suspensionImpulse);
                suspensionImpulse *= Math.max(0, 1 - dt * 4);
                if (crashCar) {
                    var ob = crashOtherBody;
                    crashCar.position.set(ob.position.x, Math.max(0, ob.position.y - 0.72), ob.position.z);
                    crashCar.quaternion.set(ob.quaternion.x, ob.quaternion.y, ob.quaternion.z, ob.quaternion.w);
                }
            } else {
                // Fallback arcade crash motion if Cannon is unavailable.
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
                if (crashCar) {
                    crashCar.position.x += crashCarVx * dt;
                    crashCar.position.z += crashCarVz * dt;
                    crashCar.rotation.y += crashCarSpin * dt;
                    crashCar.rotation.z += crashCarSpin * 0.6 * dt;
                    crashCarVx *= Math.max(0, 1 - dt * 0.8);
                    crashCarVz *= Math.max(0, 1 - dt * 0.8);
                }
            }
            updateSoftWreck();
            updateCrashDebris(dt);
            updateRagdoll(dt);
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

            if (crashRealT > (crashFatal ? 3.2 : 5.5)) {
                var flash = document.getElementById('g3dCrashFlash');
                if (flash) flash.classList.remove('is-active');
                setCrashCinema(false);
                if (seatbeltStrap) seatbeltStrap.visible = false;
                ragdollTethered = false;
                clearSoftWreck();
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
        for (var dpi = 0; dpi < (isMobileDevice ? 12 : 20); dpi++) {
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
                p.sprite.position.z += speed * dt;
            }
        }

        /* ---------------- Multiplayer ghost racers ---------------- */
        var remoteCars = {};
        var remoteCamCache = {};
        var remoteCamLastTime = -1;
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

        function escapeCams(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
                return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
            });
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
                applyCarLod(entry.car, Math.abs(z - player.position.z));
            }
        }

        var traffic = [];
        var colors = [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf78c6b, 0xf7f3e8, 0x7f8c8d, 0x9b5de5];
        var trafficStyles = ['classic', 'buggy', 'wagon', 'truck', 'suv', 'racer', 'van', 'roadster', 'muscle', 'retro', 'taxi', 'cyber', 'suv', 'truck', 'bus', 'bus', 'semi', 'semi'];
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

        function spawnTraffic(forceZ, forceRamp) {
            if (raceMode) return;
            var z = forceZ != null ? forceZ : (-380 - Math.random() * 180);
            var order = [];
            for (var oi = 0; oi < LANES.length; oi++) order.push(oi);
            order.sort(function () { return Math.random() - 0.5; });
            var lane = order[0];
            for (var i = 0; i < order.length; i++) {
                if (!laneBusy(order[i], null, z, 16)) { lane = order[i]; break; }
            }
            var isMad = Math.random() < 0.01;
            var isRamp = !!forceRamp || (!isMad && Math.random() < 0.11);
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
                ramp.rotation.x = 0.3;
                car.add(ramp);
                var lip = boxMesh(2.3, 0.12, 0.3, new THREE.MeshBasicMaterial({ color: 0xffc400 }));
                lip.position.set(0, 1.62, -0.55);
                car.add(lip);
            }
            scene.add(car);
            traffic.push(car);
            if (crashWorld && global.CANNON) {
                var sSpec = u.spec || BODY_SPECS.classic;
                var sensor = new global.CANNON.Body({ mass: 0 });
                sensor.addShape(new global.CANNON.Box(new global.CANNON.Vec3((sSpec.width || 1.8) / 2, 0.45, (sSpec.len || 3.2) / 2)));
                sensor.position.set(car.position.x, 0.7, car.position.z);
                sensor.type = global.CANNON.Body.KINEMATIC;
                sensor.collisionResponse = false;
                sensor.car = car;
                crashWorld.addBody(sensor);
                u.sensorBody = sensor;
            }
        }

        for (var t = 0; t < (isMobileDevice ? 4 : 8); t++) spawnTraffic(-100 - t * 46);
        spawnTraffic(-150, true);

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
        if (raceMode) { ignition = 1; engineOn = true; gearMode = 'D'; }
        var nitro = 100, nitroActive = false;
        var throttleDisplay = 0, brakeDisplay = 0;
        var throttleSmooth = 0, brakeSmooth = 0;
        var nitroWasActive = false, nitroShiftT = 0;
        var coinsCollected = 0;
        var garageMode = false;
        var hudT = 0;
        var maxX = ROAD_W / 2 - 1.3;
        var steerX = 0;
        var steerAngle = 0;
        var fsdActive = false;
        var fsdLane = 2;
        var fsdThink = 0;
        var fsdCooldown = 0;
        var fsdSteerX = 0;
        var fsdSpeed = 0;
        var fsdEmergency = false;
        var fsdEmergencyT = 0;
        var fsdSwerveT = 0;
        var fsdSwerveCooldown = 0;
        var fsdSwerveSide = 0;
        var fsdSignalSide = 0;
        var fsdSignalT = 0;
        var playerBlinkT = 0;
        var FSD_MAX_KMH = 300;
        var FSD_MAX_SPEED = FSD_MAX_KMH / 3.6;
        var fsdChangeP = 1;
        var fsdChangeDur = 0.85;
        var fsdFromX = 0;
        var fsdRampLane = -1;

        function applyCarLod(car, distanceToCamera) {
            var details = car.userData.lodDetails || [];
            var lodRange = [24, 40, 65, 90, 120][qualityLevel] != null ? [24, 40, 65, 90, 120][qualityLevel] : 65;
            var show = distanceToCamera < (isMobileDevice ? Math.min(lodRange, 42) : lodRange);
            if (car.userData.lodVisible === show) return;
            car.userData.lodVisible = show;
            for (var i = 0; i < details.length; i++) details[i].visible = show;
        }

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
                // Ramps are jump targets, not traffic to brake for.
                if (car.userData.isRamp) continue;
                var lx = car.userData.logicalX != null ? car.userData.logicalX : car.position.x;
                if (Math.abs(lx - laneX) > 2.05) continue;
                var dz = player.position.z - car.position.z;
                if (dz > 0 && dz < gap) gap = dz;
            }
            return gap;
        }

        function laneRearGapFor(laneIndex, range) {
            var laneX = LANES[laneIndex];
            var gap = range;
            for (var i = 0; i < traffic.length; i++) {
                var car = traffic[i];
                if (!car || !car.userData || car.userData.isRamp) continue;
                var lx = car.userData.logicalX != null ? car.userData.logicalX : car.position.x;
                if (Math.abs(lx - laneX) > 2.05) continue;
                var dz = car.position.z - player.position.z;
                if (dz > 0 && dz < gap) gap = dz;
            }
            return gap;
        }

        function laneHasSideCar(laneIndex) {
            var laneX = LANES[laneIndex];
            for (var i = 0; i < traffic.length; i++) {
                var car = traffic[i];
                if (!car || !car.userData || car.userData.isRamp) continue;
                var lx = car.userData.logicalX != null ? car.userData.logicalX : car.position.x;
                if (Math.abs(lx - laneX) > 2.05) continue;
                if (Math.abs(car.position.z - player.position.z) < 8) return true;
            }
            return false;
        }

        function rampTargetLane(range) {
            var best = -1;
            var bestGap = range;
            for (var i = 0; i < traffic.length; i++) {
                var car = traffic[i];
                if (!car || !car.userData || !car.userData.isRamp) continue;
                var gap = player.position.z - car.position.z;
                if (gap > 18 && gap < bestGap) { bestGap = gap; best = laneIndexOf(car.position.x); }
            }
            return best;
        }

        function findFsdEscapeLane(curLane, gapAhead, speed) {
            var bestLane = -1;
            var bestGain = 0;
            for (var side = -1; side <= 1; side += 2) {
                var lane = curLane + side;
                if (lane < 0 || lane >= LANES.length) continue;
                if (laneHasSideCar(lane)) continue;
                var front = laneGapFor(lane, 500);
                var rear = laneRearGapFor(lane, 110);
                if (rear < 16) continue;
                // Only take a lane that is meaningfully safer than the current one.
                if (front < Math.max(gapAhead + 18, speed * 0.55 + 22)) continue;
                var gain = front + Math.min(90, rear) * 0.35;
                if (gain > bestGain) { bestGain = gain; bestLane = lane; }
            }
            return bestLane;
        }

        function drawFsdPanel() {
            var canvas = document.getElementById('g3dFsdCanvas');
            if (!canvas || !canvas.getContext) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#04101a';
            ctx.fillRect(0, 0, w, h);

            var laneX = [];
            for (var i = 0; i < LANES.length; i++) laneX.push(26 + i * ((w - 52) / (LANES.length - 1)));
            // Target lane blue corridor.
            var tx = laneX[fsdLane];
            var grad = ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, 'rgba(47, 212, 255, 0.24)');
            grad.addColorStop(1, 'rgba(47, 212, 255, 0.02)');
            ctx.fillStyle = grad;
            ctx.fillRect(tx - 18, 4, 36, h - 8);
            ctx.strokeStyle = 'rgba(95, 224, 255, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(tx - 18, h - 10); ctx.lineTo(tx - 15, 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx + 18, h - 10); ctx.lineTo(tx + 15, 8); ctx.stroke();

            // Ramp target lane (gold) when FSD has spotted a jump.
            if (fsdRampLane >= 0 && fsdRampLane < laneX.length) {
                ctx.strokeStyle = 'rgba(255, 200, 80, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(laneX[fsdRampLane], h - 8);
                ctx.lineTo(laneX[fsdRampLane], 8);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Lane dividers.
            ctx.strokeStyle = 'rgba(150, 200, 220, 0.22)';
            ctx.lineWidth = 1;
            for (var l = 0; l < laneX.length; l++) {
                ctx.beginPath();
                ctx.moveTo(laneX[l], h - 8);
                ctx.lineTo(laneX[l] + (laneX[l] - w / 2) * 0.18, 6);
                ctx.stroke();
            }

            // Chevrons on the planned path.
            ctx.strokeStyle = 'rgba(95, 224, 255, 0.55)';
            ctx.lineWidth = 2.5;
            for (var c = 0; c < 4; c++) {
                var cy = h - 30 - c * 26;
                ctx.beginPath();
                ctx.moveTo(tx - 8, cy);
                ctx.lineTo(tx, cy - 7);
                ctx.lineTo(tx + 8, cy);
                ctx.stroke();
            }

            // Traffic from the live scene.
            var blinkOn = (elapsed * 5.4) % 1 < 0.55;
            for (var t = 0; t < traffic.length; t++) {
                var car = traffic[t];
                if (!car) continue;
                var gap = player.position.z - car.position.z;
                if (gap < -10 || gap > 300) continue;
                var lane = laneIndexOf(car.userData.logicalX != null ? car.userData.logicalX : car.position.x);
                var y = h - 26 - (Math.max(0, gap) / 300) * (h - 46);
                if (car.userData.isRamp) {
                    // Ramps are gold jump targets, not vehicles.
                    ctx.fillStyle = blinkOn ? 'rgba(255, 205, 80, 0.95)' : 'rgba(255, 170, 40, 0.65)';
                    ctx.beginPath();
                    ctx.moveTo(laneX[lane], y - 9);
                    ctx.lineTo(laneX[lane] + 8, y);
                    ctx.lineTo(laneX[lane], y + 9);
                    ctx.lineTo(laneX[lane] - 8, y);
                    ctx.closePath();
                    ctx.fill();
                    continue;
                }
                var mad = !!car.userData.mad;
                ctx.fillStyle = mad ? 'rgba(255, 70, 70, 0.9)' : 'rgba(190, 220, 235, 0.7)';
                ctx.fillRect(laneX[lane] - 6, y - 9, 12, 18);
                // Turn signals on traffic, mirrored from the 3D scene.
                var signal = car.userData.signal || 0;
                if (signal && (car.userData.state === 'signal' || car.userData.state === 'change')) {
                    if (blinkOn) {
                        ctx.fillStyle = '#ffb020';
                        var sx = laneX[lane] + (signal > 0 ? 9 : -9);
                        ctx.beginPath();
                        if (signal > 0) { ctx.moveTo(sx - 3, y - 4); ctx.lineTo(sx + 3, y); ctx.lineTo(sx - 3, y + 4); }
                        else { ctx.moveTo(sx + 3, y - 4); ctx.lineTo(sx - 3, y); ctx.lineTo(sx + 3, y + 4); }
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                if (mad && blinkOn) {
                    ctx.fillStyle = 'rgba(255, 70, 70, 0.85)';
                    ctx.fillRect(laneX[lane] - 9, y - 3, 3, 6);
                    ctx.fillRect(laneX[lane] + 6, y - 3, 3, 6);
                }
            }

            // Ego car.
            ctx.fillStyle = 'rgba(60, 200, 255, 0.95)';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(tx - 10, h - 30, 20, 24, 5) : ctx.rect(tx - 10, h - 30, 20, 24);
            ctx.fill();

            // Planned lane-change / turn signal.
            var egoLane = laneIndexOf(player.position.x);
            var pendingSide = fsdLane > egoLane ? 1 : (fsdLane < egoLane ? -1 : 0);
            if (!pendingSide) pendingSide = fsdSignalT > 0 ? fsdSignalSide : 0;
            if (pendingSide && blinkOn) {
                ctx.fillStyle = '#ffb020';
                var ax = tx + (pendingSide > 0 ? 15 : -15);
                ctx.beginPath();
                if (pendingSide > 0) { ctx.moveTo(ax - 3, h - 27); ctx.lineTo(ax + 3, h - 21); ctx.lineTo(ax - 3, h - 15); }
                else { ctx.moveTo(ax + 3, h - 27); ctx.lineTo(ax - 3, h - 21); ctx.lineTo(ax + 3, h - 15); }
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = '#8fe8ff';
            ctx.font = 'bold 9px Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(Math.abs(speed) * 2.23694) + ' mph', w - 7, 13);

            if (fsdEmergency) {
                ctx.fillStyle = 'rgba(255, 46, 46, 0.18)';
                ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(255, 70, 70, 0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(1, 1, w - 2, h - 2);
                ctx.textAlign = 'left';
                ctx.font = 'bold 9px Arial, sans-serif';
                ctx.fillStyle = (elapsed * 4) % 1 < 0.6 ? '#ff6b6b' : '#ffd0d0';
                ctx.fillText(fsdSwerveT > 0 ? 'AUTO-SWERVE' : 'EMERGENCY BRAKE', 8, 13);
            }
        }

        function updateFsdVisual() {
            var overlay = document.getElementById('g3dFsd');
            if (overlay) {
                overlay.classList.toggle('is-active', fsdActive);
                overlay.classList.toggle('is-brake', fsdActive && fsdEmergency);
                var label = overlay.querySelector('span');
                if (label) label.textContent = fsdSwerveT > 0 ? 'FSD · AUTO-SWERVE' : (fsdEmergency ? 'FSD · EMERGENCY BRAKE' : 'FSD ACTIVE');
                overlay.classList.toggle('is-swerve', fsdActive && fsdSwerveT > 0);
            }
            var hud = document.getElementById('g3dFsdHud');
            if (hud) {
                hud.classList.toggle('is-active', fsdActive);
                hud.classList.toggle('is-brake', fsdActive && fsdEmergency);
                hud.classList.toggle('is-swerve', fsdActive && fsdSwerveT > 0);
            }
            // Mirror the planned lane change on the car's indicator lamps.
            var egoLane = laneIndexOf(player.position.x);
            var signalSide = fsdLane > egoLane ? 1 : (fsdLane < egoLane ? -1 : 0);
            if (!signalSide && fsdSignalT > 0) signalSide = fsdSignalSide;
            playerBlinkT += 0.016;
            var blinkOn = (playerBlinkT * 4.8) % 1 < 0.55;
            if (player.userData.leftLamp) player.userData.leftLamp.visible = fsdActive && signalSide < 0 && blinkOn;
            if (player.userData.rightLamp) player.userData.rightLamp.visible = fsdActive && signalSide > 0 && blinkOn;
            if (!fsdGroup) return;
            fsdGroup.visible = fsdActive;
            if (!fsdActive) return;
            fsdGroup.position.set(LANES[fsdLane], 0, player.position.z);
            var pulse = 0.45 + Math.sin(elapsed * 6) * 0.18;
            fsdLinesMat.opacity = pulse;
            fsdFillMat.opacity = 0.05 + Math.sin(elapsed * 6) * 0.02;
            fsdChevronTex.offset.y = -(elapsed * 0.5) % 1;
            fsdChevronMat.opacity = 0.35 + Math.sin(elapsed * 7) * 0.15;
            if (elapsed - fsdPanelLast > 0.1) {
                fsdPanelLast = elapsed;
                drawFsdPanel();
            }
        }

        var MAP_ZONES = ['Palm Pier', 'Neon Strip', 'Marina District', 'Coral Bridge', 'Tunnel Approach', 'Downtown Shore'];
        var mapLast = 0;
        function drawRouteMap() {
            if (elapsed - mapLast < 0.18) return;
            mapLast = elapsed;
            var canvas = document.getElementById('g3dMapCanvas');
            if (!canvas || !canvas.getContext) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(4,12,18,0.82)';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(95,224,255,0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

            var zoneIndex = Math.floor(distance / 1000) % MAP_ZONES.length;
            var zone = MAP_ZONES[zoneIndex];
            ctx.fillStyle = '#bfefff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(zone.toUpperCase(), 9, 14);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = '9px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(distance).toLocaleString() + ' m', w - 9, 14);

            // Route ribbon: future distance at the top, player at the bottom.
            ctx.beginPath();
            for (var i = 0; i <= 60; i++) {
                var ahead = -80 + (i / 60) * 950;
                var yy = h - 18 - (i / 60) * (h - 36);
                var xx = w / 2 + Math.sin((distance + ahead) * 0.0032) * 34 + Math.sin((distance + ahead) * 0.0009) * 18;
                if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
            }
            ctx.strokeStyle = 'rgba(95,224,255,0.75)';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Next zones and player.
            for (var z = 1; z <= 4; z++) {
                var zDist = (Math.floor(distance / 1000) + z) * 1000;
                var zAhead = zDist - distance;
                if (zAhead > 950) continue;
                var zy = h - 18 - (zAhead / 950) * (h - 36);
                var zx = w / 2 + Math.sin(zDist * 0.0032) * 34 + Math.sin(zDist * 0.0009) * 18;
                ctx.fillStyle = 'rgba(255,209,102,0.9)';
                ctx.beginPath(); ctx.arc(zx, zy, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '8px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(MAP_ZONES[Math.floor(zDist / 1000) % MAP_ZONES.length], Math.min(w - 70, zx + 5), zy - 3);
            }
            var pxMap = w / 2 + Math.sin(distance * 0.0032) * 34 + Math.sin(distance * 0.0009) * 18;
            ctx.fillStyle = '#5fe0ff';
            ctx.beginPath(); ctx.arc(pxMap, h - 18, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();

            // Traffic near the player.
            for (var t = 0; t < traffic.length; t++) {
                var car = traffic[t];
                var rel = distance - (distance - (player.position.z - car.position.z));
                var ahead = player.position.z - car.position.z;
                if (ahead < -60 || ahead > 220) continue;
                var ty = h - 18 + (ahead / 220) * (h - 28);
                var tx = w / 2 + Math.sin((distance + ahead) * 0.0032) * 34 + Math.sin((distance + ahead) * 0.0009) * 18 + (car.position.x / ROAD_W) * 20;
                ctx.fillStyle = car.userData.mad ? '#ff4a4a' : (car.userData.isRamp ? '#ffc24a' : 'rgba(220,240,250,0.75)');
                ctx.fillRect(tx - 2, ty - 2, 4, 4);
            }
        }

        function updateAiRacers(dt) {
            if (!raceMode || !raceAi || raceStartDelay > 0 || raceFinished) return;
            var playerTotal = (playerLap - 1) * RACE_LOOP + distance;
            for (var i = 0; i < aiRacers.length; i++) {
                var ai = aiRacers[i];
                if (ai.finished) {
                    ai.speed = Math.max(0, ai.speed - 35 * dt);
                } else {
                    var aiTotal = (ai.lap - 1) * RACE_LOOP + ai.distance;
                    // AI racers hold a 780 km/h cruise and only nudge their
                    // pace to stay in the fight.
                    var aiCruise = 780 / 3.6;
                    var target = aiCruise * (0.98 + ai.skill * 0.02);
                    var diff = playerTotal - aiTotal;
                    if (diff > 45) target += Math.min(16, diff * 0.05);
                    else if (diff < -60) target -= Math.min(12, -diff * 0.04);
                    target = Math.max(aiCruise * 0.88, Math.min(aiCruise * 1.06, target));
                    ai.speed += (target - ai.speed) * Math.min(1, dt * 1.7);
                    ai.distance += ai.speed * dt;
                    if (ai.distance >= RACE_LOOP) {
                        ai.distance -= RACE_LOOP;
                        ai.lap++;
                        if (ai.lap > RACE_LAPS) { ai.finished = true; ai.lap = RACE_LAPS; }
                    }
                    ai.changeT -= dt;
                    if (ai.changeT <= 0) {
                        ai.changeT = 3 + Math.random() * 4;
                        var dir = Math.random() < 0.5 ? -1 : 1;
                        var next = ai.lane + dir;
                        if (next >= 0 && next < LANES.length) ai.targetLane = next;
                    }
                    if (ai.targetLane !== ai.lane && Math.abs(ai.car.position.x - LANES[ai.targetLane]) < 0.4) ai.lane = ai.targetLane;
                    ai.car.position.x += (LANES[ai.targetLane] - ai.car.position.x) * Math.min(1, dt * 2.8);
                    ai.car.rotation.y = -roadTangentAt(ai.car.position.z);
                    var wheels = ai.car.userData.wheels || [];
                    for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += ai.speed * dt * 1.2;
                }
                var aiTotal2 = (ai.lap - 1) * RACE_LOOP + ai.distance;
                var rel = aiTotal2 - playerTotal;
                ai.car.position.z = player.position.z - rel;
                ai.car.visible = Math.abs(rel) < 560;
                animateSuspension(ai.car, dt, ai.speed, ai.distance, 0, 0, 0);
            }
        }

        function updateRaceModeHud() {
            if (!raceMode) return;
            var hud = document.getElementById('g3dRaceHud');
            if (!hud) return;
            hud.classList.add('is-active');
            var lapEl = document.getElementById('g3dRaceLap');
            var posEl = document.getElementById('g3dRacePos');
            var timeEl = document.getElementById('g3dRaceTime');
            var playerTotal = (playerLap - 1) * RACE_LOOP + distance;
            var pos = 1;
            if (raceAi) {
                for (var i = 0; i < aiRacers.length; i++) {
                    var aiTotal = (aiRacers[i].lap - 1) * RACE_LOOP + aiRacers[i].distance;
                    if (aiTotal > playerTotal) pos++;
                }
            }
            if (lapEl) lapEl.textContent = 'LAP ' + Math.min(playerLap, RACE_LAPS) + '/' + RACE_LAPS;
            if (posEl) posEl.textContent = raceAi ? ('POS ' + pos + '/' + (aiRacers.length + 1)) : 'RACE';
            if (timeEl) {
                var secs = Math.max(0, elapsed - raceStartTime);
                var mins = Math.floor(secs / 60);
                var rem = (secs % 60);
                timeEl.textContent = mins + ':' + (rem < 10 ? '0' : '') + rem.toFixed(1);
            }
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
                dt *= crashSlowmoEnabled ? 0.22 : 0.55;
                elapsed += dt;
                updateCrash(dt);
                return;
            }
            elapsed += dt;
            if (input.cameraCycle) {
                input.cameraCycle = false;
                cameraMode = (cameraMode + 1) % 4;
            }
            if (raceMode) {
                if (raceStartDelay > 0) {
                    raceStartDelay -= dt;
                    var raceLoad = document.getElementById('g3dRaceLoad');
                    if (raceLoad) raceLoad.classList.add('is-active');
                    if (raceStartDelay <= 0) {
                        if (raceLoad) raceLoad.classList.remove('is-active');
                        raceStartTime = elapsed;
                        racerBanner('GO');
                        tone(620, 0.12, 'square', 0.05, 880);
                    }
                }
                updateAiRacers(dt);
                updateRaceHud();
                updateRaceModeHud();
            }

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
                    fsdFromX = player.position.x;
                    fsdChangeP = 1;
                    fsdThink = 0;
                    fsdCooldown = 2.5;
                    fsdSpeed = Math.max(20, Math.min(Math.abs(speed), perf.topSpeed * 0.5));
                    fsdEmergency = false;
                    fsdEmergencyT = 0;
                    fsdSwerveT = 0;
                    fsdSwerveCooldown = 0;
                    fsdSwerveSide = 0;
                    fsdSignalSide = 0;
                    fsdSignalT = 0;
                    tone(520, 0.14, 'sine', 0.05, 880);
                } else {
                    fsdEmergency = false;
                    fsdEmergencyT = 0;
                    fsdSwerveT = 0;
                    fsdSwerveCooldown = 0;
                    fsdSwerveSide = 0;
                    fsdSignalSide = 0;
                    fsdSignalT = 0;
                    tone(280, 0.1, 'sine', 0.04, 220);
                }
            }
            if (fsdActive && gearMode !== 'D') fsdActive = false;
            if (!fsdActive) {
                fsdEmergency = false; fsdEmergencyT = 0;
                fsdSwerveT = 0; fsdSwerveCooldown = 0; fsdSwerveSide = 0;
                fsdSignalSide = 0; fsdSignalT = 0;
            }

            var throttleCmd = input.up;
            var brakeCmd = input.brake;
            if (raceMode && raceStartDelay > 0) { throttleCmd = false; brakeCmd = true; speed = 0; }
            if (fsdActive) {
                fsdThink -= dt;
                fsdCooldown -= dt;
                var curLane = laneIndexOf(player.position.x);
                if (fsdThink <= 0 && fsdChangeP >= 1) {
                    fsdThink = 0.4;
                    var curGap = laneGapFor(curLane, 900);
                    var curRear = laneRearGapFor(curLane, 140);
                    var globalBest = curLane;
                    var globalScore = curGap + Math.min(120, curRear) * 0.45;
                    for (var fl = 0; fl < LANES.length; fl++) {
                        if (fl === curLane) continue;
                        var fg = laneGapFor(fl, 900);
                        var rg = laneRearGapFor(fl, 140);
                        var score = fg + Math.min(120, rg) * 0.45;
                        if (laneHasSideCar(fl)) score -= 180;
                        if (score > globalScore + 32) { globalScore = score; globalBest = fl; }
                    }
                    // Ramps are targets, not traffic. Line up with a safe ramp
                    // lane instead of braking behind it like a car.
                    var rampLane = rampTargetLane(300);
                    fsdRampLane = rampLane;
                    if (rampLane >= 0 && rampLane !== curLane && !laneHasSideCar(rampLane) && laneGapFor(rampLane, 160) > 55) {
                        globalBest = rampLane;
                    }
                    if (globalBest !== curLane && fsdCooldown <= 0) {
                        var step = globalBest > curLane ? curLane + 1 : curLane - 1;
                        var stepGap = laneGapFor(step, 220);
                        var stepRear = laneRearGapFor(step, 90);
                        if (!laneHasSideCar(step) && stepRear > 22 && (stepGap > curGap + 10 || stepGap > 130)) {
                            fsdLane = step;
                            fsdFromX = player.position.x;
                            fsdChangeP = 0;
                            fsdChangeDur = 0.85;
                            fsdSignalSide = step > curLane ? 1 : -1;
                            fsdSignalT = 1.7;
                            fsdCooldown = (curGap < 120 ? 1.8 : 3.6) + Math.random() * 1.8;
                        }
                    } else if (fsdCooldown <= 0 && curGap > 150 && Math.random() < 0.1) {
                        var options = [];
                        if (curLane > 0 && laneRearGapFor(curLane - 1, 90) > 26 && !laneHasSideCar(curLane - 1)) options.push(curLane - 1);
                        if (curLane < LANES.length - 1 && laneRearGapFor(curLane + 1, 90) > 26 && !laneHasSideCar(curLane + 1)) options.push(curLane + 1);
                        if (options.length) {
                            fsdLane = options[Math.floor(Math.random() * options.length)];
                            fsdFromX = player.position.x;
                            fsdChangeP = 0;
                            fsdChangeDur = 0.8;
                            fsdSignalSide = fsdLane > curLane ? 1 : -1;
                            fsdSignalT = 1.6;
                            fsdCooldown = 5 + Math.random() * 3;
                        }
                    } else if (laneGapFor(fsdLane, 220) < 45) {
                        fsdLane = curLane;
                    }
                }
                fsdLane = Math.max(0, Math.min(LANES.length - 1, fsdLane));
                if (fsdChangeP < 1) {
                    fsdChangeP = Math.min(1, fsdChangeP + dt / fsdChangeDur);
                    var cp = fsdChangeP;
                    var ce = cp * cp * (3 - 2 * cp);
                    fsdSteerX = fsdFromX + (LANES[fsdLane] - fsdFromX) * ce;
                } else {
                    fsdSteerX = LANES[fsdLane];
                }
                var gapAhead = laneGapFor(fsdLane, 1200);
                var closingSpeed = Math.max(0, speed * 0.65 - gapAhead * 0.2);
                var safeGap = 30 + speed * 0.32;
                var needEmergency = (gapAhead < safeGap && speed > 10) || (gapAhead < 80 && closingSpeed > 24);
                if (needEmergency) {
                    if (!fsdEmergency) {
                        tone(880, 0.12, 'square', 0.05, 640);
                        tone(640, 0.18, 'square', 0.045, 420);
                    }
                    fsdEmergency = true;
                    fsdEmergencyT = 0.7;
                    fsdSwerveT = Math.max(0, fsdSwerveT - dt);
                    fsdSwerveCooldown = Math.max(0, fsdSwerveCooldown - dt);
                    // If the e-brake cannot stop before the obstacle, swerve
                    // into an adjacent lane only when it has a safe front/rear gap.
                    var stopDist = (speed * speed) / (2 * 165);
                    if (fsdChangeP >= 1 && fsdSwerveCooldown <= 0 && gapAhead < stopDist * 1.18 + 6) {
                        var escapeLane = findFsdEscapeLane(curLane, gapAhead, speed);
                        if (escapeLane >= 0 && escapeLane !== fsdLane) {
                            fsdLane = escapeLane;
                            fsdFromX = player.position.x;
                            fsdChangeP = 0;
                            fsdChangeDur = 0.5;
                            fsdSwerveT = 1.1;
                            fsdSwerveCooldown = 1.4;
                            fsdSwerveSide = escapeLane > curLane ? 1 : -1;
                            fsdSignalSide = fsdSwerveSide;
                            fsdSignalT = 1.3;
                            tone(1040, 0.08, 'square', 0.055, 700);
                        }
                    }
                } else if (fsdEmergency) {
                    fsdEmergencyT -= dt;
                    if (fsdEmergencyT <= 0 && (gapAhead > safeGap + 14 || speed < 3)) fsdEmergency = false;
                }
                // FSD can reach 1,800 km/h on a clear lane, but only when the
                // look-ahead distance can support it.
                var desiredSpeed = Math.min(FSD_MAX_SPEED, Math.max(0, (gapAhead - 45) * 2.4));
                if (fsdEmergency) desiredSpeed = 0;
                fsdSpeed += (desiredSpeed - fsdSpeed) * Math.min(1, dt * (fsdEmergency ? 8 : 1.25));
                if (fsdEmergency || gapAhead < safeGap) { brakeCmd = true; throttleCmd = false; }
                else if (speed > fsdSpeed + 6) { brakeCmd = true; throttleCmd = false; }
                else if (speed < fsdSpeed - 4) { brakeCmd = false; throttleCmd = true; }
                else { brakeCmd = false; throttleCmd = false; }
                fsdSignalT = Math.max(0, fsdSignalT - dt);
                if (fsdSignalT <= 0) fsdSignalSide = 0;
                fsdSwerveT = Math.max(0, fsdSwerveT - dt);
                fsdSwerveCooldown = Math.max(0, fsdSwerveCooldown - dt);
            }

            var throttleTarget = throttleCmd ? 1 : 0;
            var brakeTarget = brakeCmd ? 1 : 0;
            throttleDisplay += (throttleTarget - throttleDisplay) * Math.min(1, dt * 14);
            brakeDisplay += (brakeTarget - brakeDisplay) * Math.min(1, dt * 14);
            throttleSmooth += (throttleTarget - throttleSmooth) * Math.min(1, dt * 7);
            brakeSmooth += (brakeTarget - brakeSmooth) * Math.min(1, dt * 9);

            honkCooldown = Math.max(0, honkCooldown - dt);
            if (input.honk) {
                input.honk = false;
                if (honkCooldown <= 0 && engineOn && !crashActive) {
                    honkCooldown = 0.6;
                    tone(410, 0.2, 'square', 0.11, 520);
                    tone(620, 0.2, 'square', 0.08, 700);
                    var honkLane = laneIndexOf(player.position.x);
                    for (var hi = 0; hi < traffic.length; hi++) {
                        var hc = traffic[hi];
                        if (!hc || !hc.userData || hc.userData.isRamp || hc.userData.mad) continue;
                        var hgap = player.position.z - hc.position.z;
                        if (hgap < 5 || hgap > 140) continue;
                        var hLane = laneIndexOf(hc.userData.logicalX != null ? hc.userData.logicalX : hc.position.x);
                        if (Math.abs(hLane - honkLane) > 1) continue;
                        if (hc.userData.state === 'change' || hc.userData.state === 'merge') continue;
                        var hTarget = -1;
                        if (hLane > 0 && !laneBusy(hLane - 1, hc, hc.position.z, 12)) hTarget = hLane - 1;
                        else if (hLane < LANES.length - 1 && !laneBusy(hLane + 1, hc, hc.position.z, 12)) hTarget = hLane + 1;
                        if (hTarget >= 0) {
                            hc.userData.signal = hTarget > hLane ? 1 : -1;
                            hc.userData.signalT = 0.45;
                            hc.userData.targetLane = hTarget;
                            hc.userData.blinkT = 0;
                            hc.userData.state = 'signal';
                        } else {
                            hc.userData.cruiseSpeed = Math.min(48, (hc.userData.cruiseSpeed || 0) + 8);
                        }
                    }
                }
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
                var brakeDecel = (fsdActive && fsdEmergency) ? 165 : 58;
                speed = Math.max(0, speed - brakeDecel * Math.max(0.18, brakeSmooth) * dt);
            } else if (throttleCmd) {
                var topSpeedNow = (fsdActive ? FSD_MAX_SPEED : perf.topSpeed) * (nitroActive ? 1.32 : 1);
                var pull = perf.accel * (fsdActive ? 4.5 : 1) * (nitroActive ? 2.35 : 1) * (1 - 0.5 * Math.min(1, speed / topSpeedNow));
                speed = Math.min(topSpeedNow, speed + pull * (0.35 + 0.65 * throttleSmooth) * dt);
            } else if (speed > CREEP_SPEED) {
                speed = Math.max(CREEP_SPEED, speed - 11 * dt);
            } else {
                speed = Math.min(CREEP_SPEED, speed + 5 * dt);
            }
            var prevDistance = distance;
            distance += speed * dt;
            if (distance < 0) distance = 0;
            if (raceMode) {
                if (distance >= RACE_LOOP) {
                    distance -= RACE_LOOP;
                    playerLap++;
                    if (playerLap > RACE_LAPS && !raceFinished) {
                        raceFinished = true;
                        raceEndT = 2.2;
                        racerBanner('FINISH');
                        tone(660, 0.35, 'triangle', 0.08, 990);
                    }
                }
                if (raceFinished) {
                    raceEndT -= dt;
                    if (raceEndT <= 0) { endGame(score + 6000); return; }
                }
            }
            if (!raceMode) {
                updateCheckpoints();
                if (updateRamps()) return;
                updateCoins(prevDistance);
                updateJumpRamps(prevDistance);
            }

            var speedSteerFactor = Math.min(1, Math.sqrt(Math.abs(speed) / 65));

            // Drift is detected automatically from speed, steering, and braking.
            var steeringIntent = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            var autoDrift = !fsdActive && Math.abs(speed) > 42 && playerY < 0.25 && (
                Math.abs(steerX) > maxX * 0.8 ||
                (input.brake && Math.abs(steerX) > maxX * 0.46)
            );
            var driftIntent = !fsdActive && (autoDrift || (!!input.drift && Math.abs(speed) > 18 &&
                (input.left || input.right || Math.abs(steerX) > 2.2) && playerY < 0.3));
            if (driftIntent) {
                speed -= Math.sign(speed) * Math.min(Math.abs(speed), 5 * dt);
                driftScore += dt * 110;
            }

            var steerInput = 0;
            if (input.left) steerInput -= 1;
            if (input.right) steerInput += 1;
            var steerTarget = 0;
            if (fsdActive) steerTarget = (fsdSteerX - player.position.x) * 0.18;
            else if (input.pointerActive) steerTarget = ((input.pointerX * maxX) - player.position.x) / Math.max(1, maxX) * 0.72;
            else steerTarget = steerInput * 0.52;
            steerTarget = Math.max(-0.58, Math.min(0.58, steerTarget));
            steerAngle += (steerTarget - steerAngle) * Math.min(1, dt * 4.5);
            if (fsdActive) {
                steerX += (fsdSteerX - steerX) * Math.min(1, dt * (2.0 + speedSteerFactor * 3.5));
                if (Math.abs(speed) < 1) steerX = player.position.x;
            } else if (Math.abs(speed) < 1) {
                steerInput = 0;
                steerX = player.position.x;
            } else if (input.pointerActive) {
                var pointerTarget = Math.max(-maxX, Math.min(maxX, input.pointerX * maxX * 1.08));
                steerX += (pointerTarget - steerX) * Math.min(1, dt * 4.2 * speedSteerFactor);
                steerX = Math.max(-maxX, Math.min(maxX, steerX));
            } else {
                var highSpeedStability = 1 - 0.4 * Math.min(1, Math.abs(speed) / 140);
                steerX += steerInput * dt * 5.5 * perf.grip * speedSteerFactor * highSpeedStability * (driftIntent ? 1.25 : 1);
                steerX = Math.max(-maxX, Math.min(maxX, steerX));
            }

            var beforeX = player.position.x;
            player.position.x += (steerX - player.position.x) * Math.min(1, dt * (driftIntent ? 4.8 : 6.4));
            player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x));
            var vx = (player.position.x - beforeX) / (dt || 0.016);
            currentVx = vx;
            var driftAudioTarget = driftIntent ? Math.min(1, Math.abs(vx) / 12) : 0;
            if (driftAudioTarget > 0.2 && audioDriftLevel < 0.12) tone(480, 0.12, 'sawtooth', 0.032, 220);
            audioDriftLevel += (driftAudioTarget - audioDriftLevel) * Math.min(1, dt * 9);

            var yawLimit = driftIntent ? 0.45 : 0.26;
            var rollLimit = driftIntent ? 0.2 : 0.12;
            var yawTarget = vx * 0.045 * (driftIntent ? 2.0 : 1) * (0.35 + speedSteerFactor * 0.65) + steerAngle * 0.45;
            player.rotation.y = Math.max(-yawLimit, Math.min(yawLimit, -yawTarget)) - roadTangentAt(player.position.z);
            var steerPivots = player.userData.suspensionPivots || [];
            for (var spi = 0; spi < steerPivots.length; spi++) {
                if (steerPivots[spi].userData.front && steerPivots[spi].parent === player) {
                    steerPivots[spi].rotation.y = -steerAngle;
                }
            }

            player.rotation.z = Math.max(-rollLimit, Math.min(rollLimit, -vx * 0.022 * (driftIntent ? 1.7 : 1)));
            player.rotation.x = (brakeCmd ? 0.035 : 0) + Math.max(-0.03, Math.min(0.03, -vx * 0.002));
            if (player.userData.brakeMat) player.userData.brakeMat.color.setHex((input.brake || (fsdActive && brakeCmd)) ? 0xff2438 : 0x5a1018);

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
                if (sc.lodRange) sc.obj.visible = Math.abs(sc.obj.position.z - player.position.z) < sc.lodRange;
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
            if (spawnT > Math.max(isMobileDevice ? 1.0 : 0.75, (isMobileDevice ? 1.9 : 1.5) - elapsed * 0.012)) { spawnT = 0; spawnTraffic(); }

            for (var k = traffic.length - 1; k >= 0; k--) {
                var c = traffic[k];
                var u = c.userData;

                c.rotation.y -= u.curveRot || 0;
                if (u.sensorBody) u.sensorBody.position.set(c.position.x, 0.7, c.position.z);
                u.collisionCooldown = Math.max(0, (u.collisionCooldown || 0) - dt);
                applyCarLod(c, Math.abs(c.position.z - player.position.z));
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
                    if (u.sensorBody && crashWorld) crashWorld.removeBody(u.sensorBody);
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
                        u.rampCooldown = elapsed + 1.6;
                    }
                }

                // Swept collision: at high speed a car can cross the player in a
                // single frame, so test the whole segment travelled this frame.
                var spec = u.spec || {};
                var carHalfW = (spec.width || 1.8) / 2 + 0.72;
                var carHalfL = (spec.len || 3.2) / 2 + 0.35;
                var rampPass = u.isRamp && u.rampCooldown && elapsed < u.rampCooldown;
                if (!rampPass && playerY < 1.1 && Math.abs((u.logicalX != null ? u.logicalX : c.position.x) - player.position.x) < carHalfW) {
                    var carBack = Math.min(prevZ, c.position.z) - carHalfL;
                    var carFront = Math.max(prevZ, c.position.z) + carHalfL;
                    if (carBack < player.position.z + 2.75 && carFront > player.position.z - 2.75) {
                        if ((u.collisionCooldown || 0) <= 0 && resolveCollision(c, carHalfW)) return;
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

            var fov = 68 + Math.min(36, Math.abs(speed) * 0.24);
            if (Math.abs(camera.fov - fov) > 0.1) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }

            var streakIntensity = Math.min(1, Math.max(0, (Math.abs(speed) - 22) / 85));
            speedStreakMat.opacity = streakIntensity * 0.5;
            for (var ssi2 = 0; ssi2 < speedStreaks.length; ssi2++) {
                var st = speedStreaks[ssi2];
                st.visible = streakIntensity > 0.02 && !garageMode;
                st.position.z += (Math.abs(speed) * 2.4 + 18) * dt;
                if (st.position.z > 8) {
                    st.position.z = -90 - Math.random() * 90;
                    st.position.x = (Math.random() - 0.5) * 30;
                    st.position.y = 0.6 + Math.random() * 6.5;
                }
            }

            var curveAhead = roadCurveOffset(-80) - roadCurveOffset(0);
            if (cameraMode === 1) {
                camDesired.set(player.position.x, 1.16 + playerY * 0.8, player.position.z - 0.9);
                camera.position.lerpVectors(camera.position, camDesired, Math.min(1, dt * 20));
                camera.lookAt(player.position.x + vx * 0.18, 0.95 + playerY * 0.9, player.position.z - 26);
            } else if (cameraMode === 2) {
                camDesired.set(player.position.x + 1.18, 0.52 + playerY * 0.5, player.position.z + 0.9);
                camera.position.lerpVectors(camera.position, camDesired, Math.min(1, dt * 18));
                camera.lookAt(player.position.x, 0.72 + playerY * 0.6, player.position.z - 20);
                camera.rotateZ(-bodyRoll * 0.2);
            } else if (cameraMode === 3) {
                camDesired.set(player.position.x, 1.05 + playerY * 0.9, player.position.z + 0.1);
                camera.position.lerpVectors(camera.position, camDesired, Math.min(1, dt * 24));
                var fpYaw = player.rotation.y;
                camera.lookAt(
                    player.position.x - Math.sin(fpYaw) * 28,
                    0.88 + playerY * 0.9,
                    player.position.z - Math.cos(fpYaw) * 28
                );
                camera.rotateZ(bodyRoll * 0.55);
            } else {
                camDesired.set(
                    player.position.x * 0.42,
                    5.3 + playerY * 0.78 + (player.userData.bodyGroup ? player.userData.bodyGroup.position.y * 4.0 : 0) - suspensionImpulse * 0.3 + Math.sin(elapsed * 1.4) * 0.035,
                    13
                );
                camera.position.lerpVectors(camera.position, camDesired, Math.min(1, dt * 5));
                var speedShake = Math.min(0.085, Math.abs(speed) * 0.00095);
                camera.position.x += Math.sin(elapsed * 37.0) * speedShake;
                camera.position.y += Math.cos(elapsed * 43.0) * speedShake * 0.55;
                camera.lookAt(player.position.x * 0.5 + vx * 0.22 + curveAhead * 0.22, 0.5 + playerY * 0.9, -12);
                camera.rotateZ(-curveAhead * 0.0016 - bodyRoll * 0.1);
                camera.rotateY(curveAhead * 0.0009 - steerAngle * 0.16);
                camera.rotateX(bodyPitch * 0.05);
            }
            if (fpWheel) {
                fpWheel.visible = cameraMode === 3 && !ragdollActive;
                fpWheel.rotation.z = -steerAngle * 2.3;
            }
            if (driverRagdoll) driverRagdoll.visible = false;
            if (sunLight && sunLight.target) {
                sunLight.position.set(player.position.x + 18, 28, player.position.z + 12);
                sunLight.target.position.set(player.position.x, 0, player.position.z - 10);
                sunLight.target.updateMatrixWorld();
            }
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
            if (racerBannerT > 0) {
                racerBannerT -= dt;
                if (racerBannerT <= 0) {
                    var bannerEl = document.getElementById('g3dBanner');
                    if (bannerEl) bannerEl.classList.remove('is-active');
                }
            }
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
        var camDesired = new THREE.Vector3();
        var shadowHelper = null;
        if (sunLight && sunLight.shadow) {
            shadowHelper = new THREE.CameraHelper(sunLight.shadow.camera);
            shadowHelper.visible = false;
            scene.add(shadowHelper);
        }
        var crashFlash = document.getElementById('g3dCrashFlash');
        if (crashFlash) crashFlash.classList.remove('is-active');
        initAudio();
        updateRaceHud();
        updateRaceModeHud();
        return {
            over: false,
            update: update,
            getCoins: function () { return coinsCollected; },
            teleport: teleportRacer,
            setGarage: setGarageMode,
            setGear: function (mode) {
                if (mode === 'P' || mode === 'R' || mode === 'N' || mode === 'D') {
                    gearMode = mode;
                    input.gearUp = false;
                    input.gearDown = false;
                }
            },
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
                    fsdEmergency: fsdEmergency,
                    fsdSwerve: fsdSwerveT > 0,
                    signal: fsdSignalSide,
                    fsdChange: fsdChangeP < 1 ? fsdChangeP : 1,
                    fsdRampLane: fsdRampLane,
                    fsdMaxKmh: FSD_MAX_KMH,
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
            captureFrame: function () {
                if (!renderer) return null;
                var src = renderer.domElement;
                if (!src || !src.width || !src.height) return null;
                var canvas = document.createElement('canvas');
                canvas.width = 320; canvas.height = 180;
                var ctx2 = canvas.getContext('2d');
                if (!ctx2) return null;
                try { ctx2.drawImage(src, 0, 0, 320, 180); return canvas.toDataURL('image/jpeg', 0.68); } catch (e) { return null; }
            },
            isCinematic: function () { return crashActive; },
            toggleShadowHelper: function (on) {
                if (shadowHelper) shadowHelper.visible = on == null ? !shadowHelper.visible : !!on;
            },
            renderCameras: function () {
                var hide = document.getElementById('g3dRemoteCams');
                if (!renderer || !scene || garageMode || paused || isMobileDevice) {
                    if (hide) hide.style.display = 'none';
                    return;
                }
                var ids = Object.keys(remoteCars);
                var totalPeople = ids.length + 1;
                var host = document.getElementById('g3dRemoteCams');
                // Chase-cam windows only when the lobby has fewer than six people.
                if (totalPeople >= 6 || !ids.length || (lastFps && lastFps < 42)) {
                    if (host) host.style.display = 'none';
                    return;
                }
                var nowCam = elapsed;
                if (remoteCamLastTime >= 0 && nowCam - remoteCamLastTime < 0.14) return;
                remoteCamLastTime = nowCam;
                var compact = (global.innerWidth || 1000) < 640;
                var maxCams = compact ? 1 : 2;
                var camW = compact ? 96 : 142;
                var camH = compact ? 58 : 86;
                var gap = compact ? 6 : 8;
                var topPx = compact ? 96 : 112;
                var rightPx = compact ? 12 : 18;
                var vw = renderer.domElement.clientWidth || 1;
                var vh = renderer.domElement.clientHeight || 1;
                var shown = [];
                for (var ri = 0; ri < ids.length && shown.length < maxCams; ri++) {
                    var entry = remoteCars[ids[ri]];
                    if (!entry || !entry.car || !entry.car.visible) continue;
                    shown.push(entry);
                }
                if (!shown.length) {
                    if (host) host.style.display = 'none';
                    return;
                }
                if (host) {
                    host.style.display = 'flex';
                    host.style.width = camW + 'px';
                    host.style.top = topPx + 'px';
                    host.style.right = rightPx + 'px';
                    var labelKey = shown.map(function (entry) { return entry.id + '|' + camH; }).join(',');
                    if (host.userData && host.userData.labelKey === labelKey) {
                        // labels are already up to date
                    } else {
                        host.userData = host.userData || {};
                        host.userData.labelKey = labelKey;
                        host.innerHTML = shown.map(function (entry) {
                            var name = entry.state && entry.state.name ? String(entry.state.name).slice(0, 16) : 'Racer';
                            return '<div class="game3d-remote-cam-label" style="height:' + camH + 'px;"><span>' + escapeCams(name) + '</span></div>';
                        }).join('');
                    }
                }
                var savedViewport = renderer.getViewport(new THREE.Vector4());
                renderer.setScissorTest(true);
                for (var si = 0; si < shown.length; si++) {
                    var car = shown[si].car;
                    var x = vw - rightPx - camW;
                    var y = vh - topPx - camH - si * (camH + gap);
                    var camKey = 'cam' + si;
                    if (!remoteCamCache[camKey]) remoteCamCache[camKey] = new THREE.PerspectiveCamera(60, camW / camH, 0.1, 220);
                    var tempCam = remoteCamCache[camKey];
                    tempCam.aspect = camW / camH;
                    tempCam.updateProjectionMatrix();
                    tempCam.position.set(car.position.x, 2.7, car.position.z + 7.6);
                    tempCam.lookAt(car.position.x, 0.7, car.position.z - 7);
                    renderer.setViewport(x, y, camW, camH);
                    renderer.setScissor(x, y, camW, camH);
                    renderer.render(scene, tempCam);
                }
                renderer.setScissorTest(false);
                renderer.setViewport(savedViewport);
                renderer.setScissor(savedViewport);
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

        var tunnelStars = [];
        for (var ts = 0; ts < 180; ts++) tunnelStars.push((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 42, -30 - Math.random() * 180);
        var tunnelStarGeo = new THREE.BufferGeometry();
        tunnelStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(tunnelStars, 3));
        scene.add(new THREE.Points(tunnelStarGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.35, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })));
        var coreMat = neon(0xff2fd0, 1.8);
        var tunnelCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), coreMat);
        tunnelCore.position.set(0, 0, -118);
        scene.add(tunnelCore);

        var R = 3.0, orbitR = 1.9;
        var ringMat = neon(0x2ff6ff, 1.5);
        var rings = [];
        var RING_COUNT = isMobileDevice ? 24 : 32, RING_SPACING = 5;
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
        var tunnelOrbs = [];
        var SEG_N = 24, GAP_HALF = 0.9; // ~103 degree opening
        var obstacleMat = neon(0xff2fd0, 1.2);

        function spawnTunnelOrb(kind) {
            var color = kind === 'shield' ? 0x54ff9f : 0xffd166;
            var mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(kind === 'shield' ? 0.38 : 0.28, 0), neon(color, 2.0));
            var a = Math.random() * Math.PI * 2;
            mesh.position.set(Math.cos(a) * orbitR, Math.sin(a) * orbitR, -78 - Math.random() * 30);
            scene.add(mesh);
            tunnelOrbs.push({ mesh: mesh, angle: a, kind: kind || 'orb' });
        }

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

        var angle = 0, elapsed = 0, speed = 20, spawnT = 0, orbT = 0, score = 0, combo = 1, shieldHits = 0, gatesPassed = 0;

        function update(dt) {
            elapsed += dt;
            speed = Math.min(20 + elapsed * 0.6, 52);
            spawnT += dt;
            if (spawnT > Math.max(1.4, 2.6 - elapsed * 0.02)) { spawnT = 0; spawnObstacle(); }
            orbT += dt;
            if (orbT > 1.35) { orbT = 0; spawnTunnelOrb(gatesPassed > 0 && gatesPassed % 8 === 0 ? 'shield' : 'orb'); }

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
                    if (Math.abs(d) > GAP_HALF - 0.08) {
                        if (shieldHits > 0) {
                            shieldHits--;
                            scene.remove(grp); disposeObject(grp); obstacles.splice(o, 1);
                            combo = 1;
                            tone(480, 0.18, 'sine', 0.05, 200);
                            continue;
                        }
                        endGame(Math.round(score + elapsed * 5));
                        return;
                    }
                    // Clean gate pass.
                    gatesPassed++;
                    var nearMiss = Math.abs(Math.abs(d) - GAP_HALF) < 0.18;
                    combo = Math.min(6, combo + (nearMiss ? 0.7 : 0.35));
                    score += (nearMiss ? 180 : 100) * combo;
                    if (nearMiss) tone(760, 0.06, 'square', 0.03, 980);
                }
            }

            for (var oi = tunnelOrbs.length - 1; oi >= 0; oi--) {
                var orb = tunnelOrbs[oi];
                orb.mesh.position.z += speed * dt;
                orb.mesh.rotation.y += dt * 2;
                orb.mesh.rotation.x += dt * 1.4;
                if (orb.mesh.position.z > 10) { scene.remove(orb.mesh); disposeObject(orb.mesh); tunnelOrbs.splice(oi, 1); continue; }
                var oa = Math.atan2(Math.sin(angle - orb.angle), Math.cos(angle - orb.angle));
                if (Math.abs(oa) < 0.34 && orb.mesh.position.z > -4.5) {
                    if (orb.kind === 'shield') { shieldHits = Math.min(2, shieldHits + 1); tone(660, 0.14, 'sine', 0.05, 990); }
                    else { score += 120 * combo; combo = Math.min(6, combo + 0.15); tone(880, 0.07, 'square', 0.03, 1200); }
                    scene.remove(orb.mesh); disposeObject(orb.mesh); tunnelOrbs.splice(oi, 1);
                }
            }
            setHud(Math.round(score), 'TUNNEL · ' + speedText(speed) + ' · x' + combo.toFixed(1) + (shieldHits ? ' · SHIELD ' + shieldHits : ''));
        }

        return { over: false, update: update, getScore: function () { return Math.round(score + elapsed * 5); } };
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

        var stackStars = [];
        for (var ss = 0; ss < 220; ss++) stackStars.push((Math.random() - 0.5) * 90, Math.random() * 60 - 4, -20 - Math.random() * 80);
        var stackStarGeo = new THREE.BufferGeometry();
        stackStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(stackStars, 3));
        scene.add(new THREE.Points(stackStarGeo, new THREE.PointsMaterial({ color: 0xa9b8ff, size: 0.4, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
        var podium = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x1b1630, metalness: 0.4, roughness: 0.4, emissive: 0x2ff6ff, emissiveIntensity: 0.12 }));
        podium.position.y = -0.28; scene.add(podium);

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

        var t = 0, speed = 1.5, score = 0, combo = 1, perfectCount = 0, stackParticles = [];

        function stackBurst(x, y, color) {
            for (var bi = 0; bi < 10; bi++) {
                var p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: color }));
                p.position.set(x, y, 0);
                scene.add(p);
                stackParticles.push({
                    mesh: p,
                    vx: (Math.random() - 0.5) * 5,
                    vy: 2 + Math.random() * 4,
                    vz: (Math.random() - 0.5) * 3,
                    life: 0.6
                });
            }
        }

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
                if (overlap <= 0.08) { endGame(Math.round(score)); return; }
                var nw = overlap, nx = (left + right) / 2;
                var perfect = Math.abs(x - prev.x) < 0.1 && overlap > width - 0.2;
                var golden = (placed + 1) % 5 === 0;
                moving.geometry.dispose();
                moving.geometry = new THREE.BoxGeometry(nw, H, SIZE);
                moving.position.set(nx, towerY + H / 2, 0);
                moving.material.color.set(perfect ? 0xffd166 : golden ? 0xffb020 : 0x9b5cff);
                moving.material.emissive.set(perfect ? 0xffd166 : golden ? 0xffb020 : 0x9b5cff);
                moving.material.emissiveIntensity = perfect ? 1.5 : 0.7;

                if (perfect) {
                    combo = Math.min(6, combo + 1);
                    perfectCount++;
                    score += 220 * combo;
                    nw = Math.min(SIZE, nw + 0.18);
                    width = nw;
                    tone(1040, 0.1, 'square', 0.045, 1400);
                } else {
                    combo = 1;
                    score += 90;
                }
                if (golden) {
                    score += 260;
                    nw = Math.min(SIZE, nw + 0.32);
                    width = nw;
                    tone(660, 0.16, 'triangle', 0.05, 990);
                }
                moving.geometry.dispose();
                moving.geometry = new THREE.BoxGeometry(nw, H, SIZE);
                stackBurst(nx, towerY + H / 2, perfect ? 0xffd166 : golden ? 0xffb020 : 0x9b5cff);

                placed++;
                towerY += H;
                prev = { x: nx, w: nw };

                if (nw < 0.32) { endGame(Math.round(score)); return; }
                moving = makeBox(nw, 0, towerY + H / 2, 0x2ff6ff, 0x2ff6ff);
                moving.material.emissiveIntensity = 1.1;
                if ((placed + 1) % 5 === 0) { moving.material.color.set(0xffb020); moving.material.emissive.set(0xffb020); }
                speed = Math.min(1.5 + placed * 0.11, 4.2);
            }

            for (var pi = stackParticles.length - 1; pi >= 0; pi--) {
                var sp = stackParticles[pi];
                sp.life -= dt;
                sp.vy -= 9 * dt;
                sp.mesh.position.x += sp.vx * dt;
                sp.mesh.position.y += sp.vy * dt;
                sp.mesh.position.z += sp.vz * dt;
                sp.mesh.scale.setScalar(Math.max(0.05, sp.life / 0.6));
                if (sp.life <= 0) { scene.remove(sp.mesh); disposeObject(sp.mesh); stackParticles.splice(pi, 1); }
            }
            var camY = towerY + 6.5;
            camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 3);
            camera.lookAt(Math.sin(t * 0.7) * 0.12, towerY + 0.3, 0);
            setHud(Math.round(score), 'HEIGHT ' + placed + ' · PERFECT ' + perfectCount + ' · x' + combo);
        }

        return { over: false, update: update, getScore: function () { return Math.round(score); } };
    }

    /* ---------------- Dead Coast (zombie FPS) ---------------- */
    function createFPS(ctx) {
        var scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
        if (renderer) renderer.shadowMap.enabled = false;
        scene.background = new THREE.Color(0x04060b);
        scene.fog = new THREE.FogExp2(0x080d16, 0.036);
        camera.fov = 76;
        camera.near = 0.05;
        camera.far = 190;
        camera.rotation.order = 'YXZ';
        scene.add(camera);

        function std(color, opts) {
            return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.72, metalness: 0.08 }, opts || {}));
        }
        function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
        function cyl(top, bottom, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, seg || 10), mat); }

        scene.add(new THREE.HemisphereLight(0x5c7aa8, 0x0a0c10, 0.7));
        var moon = new THREE.DirectionalLight(0x9ec4ff, 1.05);
        moon.position.set(-18, 32, 14);
        scene.add(moon);
        var redGlow = new THREE.PointLight(0xff2a3a, 2.2, 34);
        redGlow.position.set(0, 6, -22); scene.add(redGlow);

        var groundTex = (function () {
            var c = document.createElement('canvas'); c.width = 256; c.height = 256;
            var g = c.getContext('2d');
            g.fillStyle = '#1b1e22'; g.fillRect(0, 0, 256, 256);
            for (var i = 0; i < 2400; i++) {
                var v = 22 + Math.floor(Math.random() * 26);
                g.fillStyle = 'rgba(' + v + ',' + (v + 1) + ',' + (v + 4) + ',0.5)';
                g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
            }
            g.strokeStyle = 'rgba(90,110,125,0.12)';
            for (var x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
            for (var y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
            var t = new THREE.CanvasTexture(c);
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(10, 10);
            return t;
        })();
        var ground = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), std(0xffffff, { map: groundTex, roughness: 0.78, metalness: 0.12 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        var obstacles = [];
        var physicsWorld = makePhysicsWorld(-20);
        function addCover(x, z, w, d, h, color) {
            var mesh = box(w, h, d, std(color, { roughness: 0.78, metalness: 0.18 }));
            mesh.position.set(x, h / 2, z);
            scene.add(mesh);
            obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
            var stripe = box(w * 0.96, 0.16, d * 1.01, new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.35 }));
            stripe.position.set(x, h - 0.14, z); scene.add(stripe);
        }
        addCover(-13, -13, 6.5, 2.7, 2.7, 0x394a52);
        addCover(11, -9, 7.2, 2.7, 2.7, 0x4f3b36);
        addCover(-18, 8, 2.7, 7.0, 2.7, 0x35463a);
        addCover(15, 10, 2.7, 6.4, 2.7, 0x443b52);
        addCover(0, 16, 7.4, 2.5, 3.0, 0x3c464e);
        addCover(-3, -22, 5.2, 2.5, 2.5, 0x4d3c35);

        var wallMat = std(0x252b32, { roughness: 0.9, metalness: 0.1 });
        [[0, -35, 72, 0.8], [0, 35, 72, 0.8], [-35, 0, 0.8, 72], [35, 0, 0.8, 72]].forEach(function (w) {
            var wall = box(w[2], 4.2, w[3], wallMat);
            wall.position.set(w[0], 2.1, w[1]); scene.add(wall);
            if (physicsWorld && global.CANNON) {
                var wallBody = new global.CANNON.Body({ mass: 0 });
                wallBody.addShape(new global.CANNON.Box(new global.CANNON.Vec3(w[2] / 2, 2.1, w[3] / 2)));
                wallBody.position.set(w[0], 2.1, w[1]);
                physicsWorld.addBody(wallBody);
            }
        });

        // City blocks and abandoned towers around the arena.
        var windowMat = new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.55 });
        var windowCold = new THREE.MeshBasicMaterial({ color: 0x87c8ff, transparent: true, opacity: 0.35 });
        [
            [-40, -30, 16, 13, 30, 0x2b3038],
            [-44, -4, 20, 14, 22, 0x34313a],
            [-38, 24, 14, 12, 17, 0x262d34],
            [40, -34, 18, 15, 26, 0x2e2a30],
            [45, 2, 15, 13, 19, 0x272e36],
            [38, 30, 21, 14, 23, 0x332b2d],
            [-8, -48, 24, 15, 34, 0x252a31],
            [16, -50, 18, 16, 28, 0x2d2a33],
            [-26, 47, 22, 15, 20, 0x2b3037],
            [24, 48, 18, 16, 24, 0x302d34]
        ].slice(0, isMobileDevice ? 4 : 10).forEach(function (b, index) {
            var bx = b[0], bz = b[1], bw = b[2], bd = b[3], bh = b[4];
            var bldg = box(bw, bh, bd, std(b[5], { roughness: 0.9, metalness: 0.05, emissive: b[5], emissiveIntensity: 0.16 }));
            bldg.position.set(bx, bh / 2, bz); scene.add(bldg);
            var roof = box(bw * 0.36, 3.2, bd * 0.36, std(0x1c2026));
            roof.position.set(bx + bw * 0.16, bh + 1.6, bz - bd * 0.12); scene.add(roof);
            for (var wi = 0; wi < 4; wi++) {
                var win = box(bw * 0.74, 0.18, 0.06, (wi + index) % 3 === 0 ? windowCold : windowMat);
                win.position.set(bx, 4 + wi * 3.4, bz + bd / 2 + 0.04); scene.add(win);
            }
            var signMat = new THREE.MeshBasicMaterial({ color: index % 2 ? 0xff3b5c : 0x5fe0ff, transparent: true, opacity: 0.55 });
            var sign = box(bw * 0.5, 0.5, 0.08, signMat);
            sign.position.set(bx, bh - 2.2, bz + bd / 2 + 0.06); scene.add(sign);
        });

        for (var bi = 0; bi < (isMobileDevice ? 5 : 12); bi++) {
            var barrel = cyl(0.38, 0.38, 1.05, 12, std(bi % 3 === 0 ? 0x7a2c1e : 0x2f4a5a, { metalness: 0.45, roughness: 0.55 }));
            var bx = (Math.random() - 0.5) * 54, bz = (Math.random() - 0.5) * 54;
            if (Math.abs(bx) < 8 && Math.abs(bz) < 8) { bx += 12; bz += 12; }
            barrel.position.set(bx, 0.53, bz); scene.add(barrel);
            obstacles.push({ minX: bx - 0.45, maxX: bx + 0.45, minZ: bz - 0.45, maxZ: bz + 0.45 });
            if (physicsWorld && global.CANNON) {
                var barrelBody = new global.CANNON.Body({ mass: 0 });
                barrelBody.addShape(new global.CANNON.Cylinder(0.38, 0.38, 1.05, 10));
                barrelBody.position.set(bx, 0.53, bz);
                physicsWorld.addBody(barrelBody);
            }
        }

        var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });
        [[-22, -22], [22, -18], [22, 20], [-20, 20]].forEach(function (lp, i) {
            var pole = cyl(0.09, 0.12, 7.0, 8, std(0x31373d, { metalness: 0.6, roughness: 0.4 }));
            pole.position.set(lp[0], 3.5, lp[1]); scene.add(pole);
            var head = box(0.8, 0.24, 0.38, lampMat);
            head.position.set(lp[0], 7.0, lp[1]); scene.add(head);
            if (i < (isMobileDevice ? 1 : 3)) {
                var pl = new THREE.PointLight(0xffd9a0, 1.6, 24);
                pl.position.set(lp[0], 6.7, lp[1]); scene.add(pl);
                if (!isMobileDevice) {
                    var cone = new THREE.Mesh(
                        new THREE.ConeGeometry(3.1, 6.4, 18, 1, true),
                        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.055, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending })
                    );
                    cone.position.set(lp[0], 3.4, lp[1]);
                    scene.add(cone);
                }
            }
        });

        for (var pu = 0; pu < (isMobileDevice ? 3 : 6); pu++) {
            var puddle = new THREE.Mesh(
                new THREE.CircleGeometry(1.3 + Math.random() * 2.2, 18),
                new THREE.MeshBasicMaterial({ color: 0x163244, transparent: true, opacity: 0.24, depthWrite: false })
            );
            puddle.rotation.x = -Math.PI / 2;
            puddle.position.set((Math.random() - 0.5) * 46, 0.012, (Math.random() - 0.5) * 46);
            scene.add(puddle);
        }

        // Loot crates: scarce supplies that must be searched with E.
        var lootCrates = [];
        function makeLootCrate(x, z) {
            var g = new THREE.Group();
            var crateMat = std(0x4a3d2a, { roughness: 0.88, metalness: 0.12 });
            var base = box(1.1, 0.7, 0.82, crateMat); base.position.y = 0.35; g.add(base);
            var lid = box(1.14, 0.12, 0.86, std(0x5a4a32, { roughness: 0.8 }));
            lid.position.set(0, 0.74, 0); lid.rotation.x = 0; g.add(lid);
            var strap = box(1.16, 0.09, 0.12, std(0x24201a)); strap.position.set(0, 0.4, 0); g.add(strap);
            var glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
            glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; g.add(glow);
            g.position.set(x, 0, z);
            g.userData = { looted: false, lid: lid, glow: glow, index: lootCrates.length };
            scene.add(g);
            lootCrates.push(g);
            obstacles.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.48, maxZ: z + 0.48 });
            if (physicsWorld && global.CANNON) {
                var crateBody = new global.CANNON.Body({ mass: 0 });
                crateBody.addShape(new global.CANNON.Box(new global.CANNON.Vec3(0.6, 0.42, 0.48)));
                crateBody.position.set(x, 0.42, z);
                physicsWorld.addBody(crateBody);
            }
        }
        makeLootCrate(-9, -4);
        makeLootCrate(7, 5);
        makeLootCrate(-2, 25);
        makeLootCrate(21, -16);

        // First-person weapon.
        var gun = new THREE.Group();
        var gunMetal = std(0x22262b, { metalness: 0.8, roughness: 0.25 });
        var gunGrip = std(0x141619, { metalness: 0.3, roughness: 0.7 });
        var gunBody = box(0.15, 0.16, 0.52, gunMetal); gunBody.position.set(0, 0, -0.18); gun.add(gunBody);
        var gunBarrel = cyl(0.045, 0.045, 0.55, 8, gunMetal);
        gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0, 0.035, -0.62); gun.add(gunBarrel);
        var grip = box(0.12, 0.3, 0.16, gunGrip); grip.position.set(0, -0.2, 0.01); grip.rotation.x = -0.18; gun.add(grip);
        var sight = box(0.04, 0.07, 0.05, new THREE.MeshBasicMaterial({ color: 0x5fe0ff }));
        sight.position.set(0, 0.13, -0.35); gun.add(sight);
        gun.position.set(0.34, -0.34, -0.62);
        gun.scale.setScalar(0.72);
        camera.add(gun);
        var muzzle = new THREE.PointLight(0xffc46a, 0, 8);
        muzzle.position.set(0.3, -0.18, -1.15); camera.add(muzzle);

        var flashlight = new THREE.SpotLight(0xffe6b0, 0, 48, Math.PI / 4.4, 0.55, 1.25);
        flashlight.position.set(0.08, -0.05, 0);
        flashlight.target.position.set(0, 0, -2);
        camera.add(flashlight);
        camera.add(flashlight.target);

        var px = 0, pz = 0, eyeY = 1.68, vy = 0, onGround = true;
        var playerBody = null;
        if (physicsWorld && global.CANNON) {
            playerBody = new global.CANNON.Body({ mass: 75 });
            playerBody.addShape(new global.CANNON.Sphere(0.5));
            playerBody.position.set(px, 0.5, pz);
            playerBody.fixedRotation = true;
            playerBody.updateMassProperties();
            playerBody.linearDamping = 0.92;
            playerBody.allowSleep = false;
            physicsWorld.addBody(playerBody);
        }
        var yaw = 0, pitch = 0;
        var WEAPONS = {
            pistol: { name: 'Pistol', mag: 12, damage: 42, headshot: 120, rate: 0.23, spread: 0.006, pellets: 1, reload: 1.0, noise: 28 },
            rifle: { name: 'Rifle', mag: 30, damage: 27, headshot: 85, rate: 0.095, spread: 0.004, pellets: 1, reload: 1.15, noise: 34 },
            shotgun: { name: 'Shotgun', mag: 6, damage: 18, headshot: 48, rate: 0.82, spread: 0.06, pellets: 7, reload: 1.5, noise: 38 }
        };
        var weaponState = {
            pistol: { owned: true, ammo: 12, reserve: 60 },
            rifle: { owned: false, ammo: 0, reserve: 0 },
            shotgun: { owned: false, ammo: 0, reserve: 0 }
        };
        var currentWeapon = 'pistol';
        var weaponUpgrades = {};
        var loadoutOpt = (ctx.options && ctx.options.zombieLoadout) || null;
        if (loadoutOpt) {
            weaponUpgrades = loadoutOpt.upgrades || {};
            var ownedOpt = Array.isArray(loadoutOpt.owned) ? loadoutOpt.owned : ['pistol'];
            Object.keys(weaponState).forEach(function (key) {
                var owned = ownedOpt.indexOf(key) >= 0;
                weaponState[key].owned = owned;
                if (owned) {
                    weaponState[key].ammo = WEAPONS[key].mag;
                    weaponState[key].reserve = key === 'pistol' ? 60 : (key === 'shotgun' ? 18 : 60);
                }
            });
            if (weaponState[loadoutOpt.equipped] && weaponState[loadoutOpt.equipped].owned) currentWeapon = loadoutOpt.equipped;
        }
        var health = 100, ammo = weaponState[currentWeapon].ammo, reserve = weaponState[currentWeapon].reserve, reloadT = 0, fireCd = 0;
        var hunger = 100, thirst = 100, bleed = 0, bandages = 1;
        var stamina = 100, sprinting = false, flashlightOn = false, meleeCd = 0, noiseTimer = 0, meleeAnim = 0;
        var score = 0, kills = 0, wave = 1, spawnQueue = 0, spawnTimer = 0, intermission = 1.5;
        var comboKills = 0, comboTimer = 0, comboMult = 1, frenzyT = 0;
        var elapsed = 0, firing = false;
        var zombies = [], corpses = [], pickups = [], tracers = [], remotePlayers = {};
        var lastShotDir = new THREE.Vector3(0, 0, -1);
        var netHost = true, netSend = null, multiplayer = false;
        var downed = false, downTimer = 0, bossPending = false;
        var extractionReady = false, extractionTimer = 0, extractionPos = null, extractionMesh = null;
        var zombieSerial = 0;
        var hitTimer = 0, damageTimer = 0, bannerTimer = 0, locked = false, dragging = false;
        var dead = false;

        function sfx(freq, dur, vol, type, endFreq) {
            try {
                if (!sfx.ctx) sfx.ctx = new (global.AudioContext || global.webkitAudioContext)();
                var ac = sfx.ctx;
                var osc = ac.createOscillator();
                var gain = ac.createGain();
                osc.type = type || 'square';
                osc.frequency.setValueAtTime(freq, ac.currentTime);
                if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), ac.currentTime + dur);
                gain.gain.setValueAtTime(Math.max(0.0001, vol || 0.04), ac.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
                osc.connect(gain); gain.connect(ac.destination);
                osc.start(); osc.stop(ac.currentTime + dur + 0.02);
            } catch (e) {}
        }

        function blockedAt(x, z, r) {
            r = r || 0.38;
            if (x < -33.5 || x > 33.5 || z < -33.5 || z > 33.5) return true;
            for (var i = 0; i < obstacles.length; i++) {
                var o = obstacles[i];
                if (x > o.minX - r && x < o.maxX + r && z > o.minZ - r && z < o.maxZ + r) return true;
            }
            return false;
        }

        function makeNameSprite(name) {
            var c = document.createElement('canvas'); c.width = 256; c.height = 64;
            var g = c.getContext('2d');
            g.fillStyle = 'rgba(4,10,16,0.72)'; g.fillRect(0, 0, 256, 64);
            g.fillStyle = '#bdefff'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(String(name || 'Survivor').slice(0, 16), 128, 34);
            var t = new THREE.CanvasTexture(c);
            var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
            sprite.scale.set(2.7, 0.68, 1);
            sprite.position.y = 2.35;
            return sprite;
        }

        function makeZombie(forcedType, forcedId) {
            var g = new THREE.Group();
            var skins = [0x64814d, 0x6f8264, 0x7d8a64, 0x566b48, 0x8a9478];
            var shirts = [0x3d4434, 0x4a3b35, 0x354450, 0x513f4a, 0x3b4a44];
            var typeRoll = Math.random();
            var ztype = forcedType || 'walker';
            if (!forcedType) {
                if (wave >= 2 && typeRoll < 0.2) ztype = 'runner';
                else if (wave >= 3 && typeRoll > 0.72) ztype = 'brute';
            }
            var skin = std(ztype === 'runner' ? 0x8a7454 : (ztype === 'brute' || ztype === 'boss' ? 0x4d6244 : skins[Math.floor(Math.random() * skins.length)]), { roughness: 0.96 });
            var shirt = std(ztype === 'runner' ? 0x5c2c2c : (ztype === 'brute' || ztype === 'boss' ? 0x2e1b22 : shirts[Math.floor(Math.random() * shirts.length)]), { roughness: 0.92 });
            var pants = std(0x252b36, { roughness: 0.94 });
            var shoe = std(0x111419, { roughness: 0.85 });
            var blood = std(0x561018, { roughness: 0.7, metalness: 0.05 });
            var dark = std(0x1a1f24, { roughness: 0.9 });

            var torso = box(0.56, 0.64, 0.31, shirt); torso.position.y = 1.03; g.add(torso);
            var belly = box(0.46, 0.24, 0.3, shirt); belly.position.y = 0.7; g.add(belly);
            var wound = box(0.2, 0.24, 0.02, blood); wound.position.set(-0.08, 1.02, -0.162); g.add(wound);
            var ribs = box(0.16, 0.05, 0.02, dark); ribs.position.set(0.12, 0.94, -0.163); g.add(ribs);
            var neck = cyl(0.09, 0.11, 0.16, 8, skin); neck.position.y = 1.4; g.add(neck);

            var headGroup = new THREE.Group();
            headGroup.position.y = 1.52; g.add(headGroup);
            var skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skin);
            skull.scale.set(0.92, 1.06, 0.96); headGroup.add(skull);
            var jaw = box(0.2, 0.1, 0.18, skin); jaw.position.set(0, -0.12, -0.05); headGroup.add(jaw);
            var mouth = box(0.13, 0.045, 0.02, dark); mouth.position.set(0, -0.105, -0.145); headGroup.add(mouth);
            for (var ti = -1; ti <= 1; ti++) {
                var tooth = box(0.027, 0.045, 0.012, std(0xe9e3c8, { roughness: 0.55 }));
                tooth.position.set(ti * 0.04, -0.095, -0.157); headGroup.add(tooth);
            }
            var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b32 });
            [-0.075, 0.075].forEach(function (ex) {
                var socket = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), dark);
                socket.position.set(ex, 0.035, -0.17); headGroup.add(socket);
                var e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
                e.position.set(ex, 0.035, -0.205); headGroup.add(e);
            });
            var hair = box(0.22, 0.07, 0.18, dark); hair.position.set(0, 0.17, -0.015); headGroup.add(hair);

            function limb(pxp, pyp, pzp, upperLen, foreLen, upperMat, foreMat, handMat) {
                var pivot = new THREE.Group();
                pivot.position.set(pxp, pyp, pzp);
                var upper = cyl(0.06, 0.075, upperLen, 8, upperMat);
                upper.position.y = -upperLen / 2; pivot.add(upper);
                var fore = cyl(0.05, 0.065, foreLen, 8, foreMat);
                fore.position.y = -upperLen - foreLen / 2 + 0.02; pivot.add(fore);
                var hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), handMat);
                hand.position.y = -upperLen - foreLen; pivot.add(hand);
                g.add(pivot);
                return pivot;
            }
            var armL = limb(-0.36, 1.24, 0, 0.34, 0.34, shirt, skin, skin);
            var armR = limb(0.36, 1.24, 0, 0.34, 0.34, shirt, skin, skin);
            var legL = limb(-0.15, 0.78, 0, 0.4, 0.38, pants, pants, shoe);
            var legR = limb(0.15, 0.78, 0, 0.4, 0.38, pants, pants, shoe);
            var footL = box(0.15, 0.09, 0.28, shoe); footL.position.set(0, -0.76, -0.07); legL.add(footL);
            var footR = box(0.15, 0.09, 0.28, shoe); footR.position.set(0, -0.76, -0.07); legR.add(footR);
            var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
            shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; g.add(shadow);

            var scale = 0.88 + Math.random() * 0.22;
            if (ztype === 'runner') scale *= 0.9;
            else if (ztype === 'brute') scale *= 1.3;
            else if (ztype === 'boss') scale *= 1.85;
            g.scale.setScalar(scale);
            var hpMul = ztype === 'runner' ? 0.65 : (ztype === 'brute' ? 2.5 : (ztype === 'boss' ? 7.0 : 1));
            var speedMul = ztype === 'runner' ? 1.85 : (ztype === 'brute' ? 0.68 : (ztype === 'boss' ? 0.52 : 1));
            var zDamage = ztype === 'runner' ? 6 : (ztype === 'brute' ? 19 : (ztype === 'boss' ? 34 : 8));
            var zScore = ztype === 'runner' ? 60 : (ztype === 'brute' ? 180 : (ztype === 'boss' ? 900 : 0));
            g.userData = {
                id: forcedId || ('z' + (++zombieSerial)),
                type: ztype,
                damage: zDamage,
                scoreValue: zScore,
                health: (100 + wave * 8) * hpMul,
                maxHealth: (100 + wave * 8) * hpMul,
                speed: (2.3 + Math.random() * 0.7 + wave * 0.07) * speedMul,
                lungeCd: 1.5 + Math.random() * 2.5,
                attackCd: Math.random() * 0.6,
                armL: armL, armR: armR, legL: legL, legR: legR,
                head: headGroup, torso: torso,
                limbs: [
                    { mesh: armL, spin: 0 }, { mesh: armR, spin: 0 },
                    { mesh: legL, spin: 0 }, { mesh: legR, spin: 0 }
                ],
                phase: Math.random() * Math.PI * 2,
                dead: false
            };
            var zDetails = [];
            g.traverse(function (child) {
                if (!child || !child.isMesh || !child.geometry) return;
                try {
                    if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
                    var bs = child.geometry.boundingSphere;
                    if (bs && bs.radius < 0.14) zDetails.push(child);
                } catch (e) {}
            });
            g.userData.lodDetails = zDetails;
            g.userData.lodVisible = true;
            if (physicsWorld && global.CANNON) {
                var zBodyMass = ztype === 'boss' ? 320 : (ztype === 'brute' ? 80 : (ztype === 'runner' ? 18 : 35));
                var zBody = new global.CANNON.Body({ mass: netHost ? zBodyMass : 0 });
                zBody.addShape(new global.CANNON.Sphere(0.48 * scale));
                zBody.position.set(0, 0.9, 0);
                zBody.fixedRotation = true;
                zBody.updateMassProperties();
                zBody.linearDamping = 0.75;
                zBody.allowSleep = false;
                if (!netHost) zBody.type = global.CANNON.Body.KINEMATIC;
                physicsWorld.addBody(zBody);
                g.userData.body = zBody;
                g.userData.bodyMass = zBodyMass;
            }
            scene.add(g);
            zombies.push(g);
        }

        function spawnZombie() {
            var forced = bossPending ? 'boss' : null;
            if (bossPending) bossPending = false;
            var tries = 0;
            while (tries++ < 12) {
                var a = Math.random() * Math.PI * 2;
                var d = 20 + Math.random() * 9;
                var x = Math.max(-31, Math.min(31, px + Math.cos(a) * d));
                var z = Math.max(-31, Math.min(31, pz + Math.sin(a) * d));
                if (!blockedAt(x, z, 0.6)) {
                    makeZombie(forced);
                    var spawned = zombies[zombies.length - 1];
                    spawned.position.set(x, 0, z);
                    if (spawned.userData.body) spawned.userData.body.position.set(x, 0.9, z);
                    return;
                }
            }
            makeZombie(forced);
            var fallback = zombies[zombies.length - 1];
            fallback.position.set(0, 0, -26);
            if (fallback.userData.body) fallback.userData.body.position.set(0, 0.9, -26);
        }

        function startWave(n) {
            wave = n;
            var count = (isMobileDevice ? 3 + n * 1.4 : 4 + n * 2);
            // Director-style mercy/pressure: ease off when the survivor is
            // nearly dead or out of supplies, add pressure when comfortable.
            if (health < 40 || reserve < 20) count = Math.max(3, Math.floor(count * 0.7));
            else if (health > 70 && reserve > 50) count += 2;
            spawnQueue = Math.min(isMobileDevice ? 18 : 26, count);
            bossPending = (n % 5 === 0);
            if (bossPending) showBanner('BOSS WAVE ' + n);
            else showBanner('WAVE ' + n);
            spawnTimer = 0;
            intermission = 0;
            score += 150 * n;
            sfx(220, 0.45, 0.06, 'sawtooth', 120);
        }

        function showBanner(text) {
            var el = document.getElementById('g3dFpsWaveBanner');
            if (!el) return;
            el.textContent = text;
            el.classList.add('is-active');
            bannerTimer = 1.9;
        }

        function makePickup(type) {
            var g = new THREE.Group();
            var color = type === 'ammo' ? 0xffc46a : 0x54ff9f;
            var m = box(0.55, 0.4, 0.42, new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.4 }));
            m.position.y = 0.25; g.add(m);
            var ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 18), new THREE.MeshBasicMaterial({ color: color }));
            ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
            var tries = 0, x = 0, z = 0;
            while (tries++ < 16) {
                x = (Math.random() - 0.5) * 52; z = (Math.random() - 0.5) * 52;
                if (!blockedAt(x, z, 0.8) && (x - px) * (x - px) + (z - pz) * (z - pz) > 36) break;
            }
            g.position.set(x, 0, z);
            g.userData = { type: type, phase: Math.random() * Math.PI * 2 };
            scene.add(g); pickups.push(g);
        }

        function makeRemote(player) {
            var g = new THREE.Group();
            var hue = 0;
            var id = String(player.id || '');
            for (var i = 0; i < id.length; i++) hue = (hue + id.charCodeAt(i) * 17) % 360;
            var cloth = std(new THREE.Color().setHSL(hue / 360, 0.62, 0.46).getHex(), { roughness: 0.82 });
            var body = box(0.58, 0.78, 0.34, cloth); body.position.y = 1.0; g.add(body);
            var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std(0xd9a066));
            head.position.y = 1.55; g.add(head);
            var armL = box(0.14, 0.52, 0.14, cloth); armL.position.set(-0.37, 1.08, 0); g.add(armL);
            var armR = box(0.14, 0.52, 0.14, cloth); armR.position.set(0.37, 1.08, -0.1); g.add(armR);
            var legL = box(0.16, 0.62, 0.16, std(0x242a33)); legL.position.set(-0.16, 0.31, 0); g.add(legL);
            var legR = box(0.16, 0.62, 0.16, std(0x242a33)); legR.position.set(0.16, 0.31, 0); g.add(legR);
            g.add(makeNameSprite(player.name));
            g.position.set(Number(player.x) || 0, 0, Number(player.z) || 0);
            g.userData = { id: id, targetX: Number(player.x) || 0, targetZ: Number(player.z) || 0, targetYaw: Number(player.yaw) || 0 };
            scene.add(g);
            remotePlayers[id] = g;
        }

        function setMobileMove(x, y) {
            input.mobileX = Math.max(-1, Math.min(1, Number(x) || 0));
            input.mobileY = Math.max(-1, Math.min(1, Number(y) || 0));
        }

        function setMobileFiring(on) {
            firing = !!on;
        }

        function mobileFpsAction(name) {
            if (name === 'reload') input.reload = true;
            else if (name === 'jump') input.jump = true;
            else if (name === 'melee') input.melee = true;
            else if (name === 'interact') input.interact = true;
            else if (name === 'swap') {
                var order = ['pistol', 'rifle', 'shotgun'];
                var start = order.indexOf(currentWeapon);
                for (var i = 1; i <= order.length; i++) {
                    var key = order[(start + i) % order.length];
                    if (weaponState[key] && weaponState[key].owned) { switchWeapon(key); break; }
                }
            }
        }

        function setRemotes(list) {
            var seen = {};
            (list || []).forEach(function (player) {
                if (!player || !player.id) return;
                var id = String(player.id);
                seen[id] = true;
                if (!remotePlayers[id]) makeRemote(player);
                var entry = remotePlayers[id];
                entry.userData.targetX = Number(player.x) || 0;
                entry.userData.targetZ = Number(player.z) || 0;
                entry.userData.targetYaw = Number(player.yaw) || 0;
                entry.userData.health = Number(player.health) || 0;
                entry.userData.downed = Number(player.health) <= 0;
                entry.userData.name = String(player.name || 'survivor').slice(0, 16);
            });
            Object.keys(remotePlayers).forEach(function (id) {
                if (!seen[id]) { scene.remove(remotePlayers[id]); disposeObject(remotePlayers[id]); delete remotePlayers[id]; }
            });
        }

        function weaponCfg() { return WEAPONS[currentWeapon]; }

        function applyWeaponVisual() {
            var cfg = weaponCfg();
            gun.scale.setScalar(currentWeapon === 'shotgun' ? 0.82 : (currentWeapon === 'rifle' ? 0.74 : 0.62));
            gunBarrel.scale.y = currentWeapon === 'shotgun' ? 0.72 : (currentWeapon === 'rifle' ? 1.15 : 0.85);
            gunBody.scale.z = currentWeapon === 'rifle' ? 1.2 : (currentWeapon === 'shotgun' ? 1.0 : 0.82);
        }

        function switchWeapon(key) {
            if (!WEAPONS[key] || !weaponState[key] || !weaponState[key].owned || key === currentWeapon) return;
            weaponState[currentWeapon].ammo = ammo;
            weaponState[currentWeapon].reserve = reserve;
            currentWeapon = key;
            ammo = weaponState[key].ammo;
            reserve = weaponState[key].reserve;
            reloadT = 0;
            fireCd = 0.25;
            applyWeaponVisual();
            showBanner(WEAPONS[key].name.toUpperCase());
            sfx(520, 0.08, 0.035, 'square', 760);
        }

        function unlockWeapon(key) {
            if (!weaponState[key] || weaponState[key].owned) return false;
            weaponState[key].owned = true;
            weaponState[key].ammo = WEAPONS[key].mag;
            weaponState[key].reserve = key === 'shotgun' ? 18 : 60;
            return true;
        }

        function fire() {
            if (dead || reloadT > 0 || fireCd > 0) return;
            if (ammo <= 0) { startReload(); return; }
            var cfg = weaponCfg();
            ammo--;
            fireCd = cfg.rate * (frenzyT > 0 ? 0.58 : 1);
            muzzle.intensity = 2.8;
            sfx(currentWeapon === 'shotgun' ? 95 : (currentWeapon === 'rifle' ? 150 : 190), 0.08, 0.11, 'square', 55);
            makeNoise(px, pz, cfg.noise, 1.4);
            var baseDir = new THREE.Vector3(
                -Math.sin(yaw) * Math.cos(pitch),
                Math.sin(pitch),
                -Math.cos(yaw) * Math.cos(pitch)
            ).normalize();
            var origin = new THREE.Vector3(px, eyeY, pz);
            lastShotDir.copy(baseDir);
            var hitAny = false;
            var traced = false;
            for (var pellet = 0; pellet < cfg.pellets; pellet++) {
                var dir = baseDir.clone();
                if (cfg.spread > 0 || cfg.pellets > 1) {
                    dir.x += (Math.random() - 0.5) * cfg.spread * 2;
                    dir.y += (Math.random() - 0.5) * cfg.spread * 2;
                    dir.z += (Math.random() - 0.5) * cfg.spread * 2;
                    dir.normalize();
                }
                var best = null, bestT = 60, headshot = false;
                for (var i = 0; i < zombies.length; i++) {
                    var z = zombies[i];
                    var rel = new THREE.Vector3(z.position.x - origin.x, 1.05 - origin.y, z.position.z - origin.z);
                    var t = rel.dot(dir);
                    if (t <= 0.5 || t > bestT) continue;
                    var perp = rel.clone().sub(dir.clone().multiplyScalar(t)).length();
                    if (perp < (cfg.pellets > 1 ? 0.72 : 0.55)) {
                        var hitY = origin.y + dir.y * t;
                        headshot = hitY > 1.3;
                        best = z; bestT = t;
                    }
                }
                if (!traced) {
                    var end = origin.clone().add(dir.clone().multiplyScalar(bestT));
                    var tracerGeo = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(px + dir.x * 0.5, eyeY - 0.15 + dir.y * 0.5, pz + dir.z * 0.5), end
                    ]);
                    var tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.9 }));
                    scene.add(tracer); tracers.push({ line: tracer, life: 0.08 });
                    traced = true;
                }
                if (best) {
                    var upgradeMul = 1 + (Number(weaponUpgrades[currentWeapon]) || 0) * 0.15;
                    var dmgAmount = (headshot ? cfg.headshot : cfg.damage) * upgradeMul;
                    if (multiplayer && !netHost) {
                        netSendEvent('hit', { zid: best.userData.id, damage: dmgAmount, headshot: headshot });
                    } else {
                        best.userData.health -= dmgAmount;
                        if (best.userData.health <= 0) killZombie(best, headshot);
                    }
                    hitAny = true;
                }
            }
            pitch = Math.min(1.35, pitch + (cfg.pellets > 1 ? 0.045 : 0.012));
            yaw += (Math.random() - 0.5) * (cfg.pellets > 1 ? 0.012 : 0.004);
            if (hitAny) {
                sfx(900, 0.07, 0.045, 'sine', 300);
                var hit = document.getElementById('g3dFpsHit');
                if (hit) { hit.classList.remove('is-active'); void hit.offsetWidth; hit.classList.add('is-active'); hitTimer = 0.13; }
            }
        }

        function killZombie(zombie, headshot, noCredit) {
            var index = zombies.indexOf(zombie);
            if (index >= 0) zombies.splice(index, 1);
            var u = zombie.userData;
            u.dead = true;
            if (u.body && physicsWorld) physicsWorld.removeBody(u.body);
            var dir = lastShotDir;
            var corpse = {
                group: zombie,
                vx: dir.x * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2,
                vy: 2.2 + Math.random() * 2.2,
                vz: dir.z * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2,
                spinX: (Math.random() - 0.5) * 6,
                spinY: (Math.random() - 0.5) * 5,
                spinZ: (Math.random() - 0.5) * 6,
                life: 9,
                limbs: u.limbs || []
            };
            (u.limbs || []).forEach(function (limb) {
                limb.spin = (Math.random() - 0.5) * 12;
            });
            var blood = new THREE.Mesh(
                new THREE.CircleGeometry(0.55 + Math.random() * 0.35, 12),
                new THREE.MeshBasicMaterial({ color: 0x4a080d, transparent: true, opacity: 0.72, depthWrite: false })
            );
            blood.rotation.x = -Math.PI / 2;
            blood.position.set(zombie.position.x, 0.02, zombie.position.z);
            scene.add(blood);
            corpse.blood = blood;
            corpses.push(corpse);
            if (!noCredit) {
                kills++;
                if (comboTimer > 0) comboKills++;
                else comboKills = 1;
                comboTimer = 2.8;
                comboMult = Math.min(5, 1 + Math.floor(comboKills / 3) * 0.5);
                if (comboKills >= 10 && frenzyT <= 0) {
                    frenzyT = 5;
                    showBanner('FRENZY');
                    sfx(840, 0.25, 0.07, 'square', 480);
                }
                var killPoints = ((headshot ? 150 : 100) + wave * 10 + (zombie.userData.scoreValue || 0)) * comboMult;
                score += Math.round(killPoints);
                if (comboKills % 5 === 0) health = Math.min(100, health + 8);
            }
            if (Math.random() < 0.3) makePickup(Math.random() < 0.55 ? 'ammo' : 'health');
        }

        function startReload() {
            var cfg = weaponCfg();
            if (reloadT > 0 || ammo >= cfg.mag || reserve <= 0) return;
            reloadT = cfg.reload;
            sfx(300, 0.1, 0.035, 'square', 180);
            makeNoise(px, pz, 9, 0.4);
        }

        function makeNoise(x, z, radius, strength) {
            for (var i = 0; i < zombies.length; i++) {
                var zed = zombies[i];
                var ddx = zed.position.x - x;
                var ddz = zed.position.z - z;
                var dist = Math.sqrt(ddx * ddx + ddz * ddz);
                if (dist < radius) {
                    zed.userData.alertT = Math.max(zed.userData.alertT || 0, 3.5 + (strength || 1) * 2);
                    zed.userData.noiseX = x;
                    zed.userData.noiseZ = z;
                }
            }
        }

        function doMelee() {
            if (meleeCd > 0) return;
            meleeCd = 0.55;
            meleeAnim = 0.22;
            sfx(180, 0.1, 0.07, 'sawtooth', 70);
            makeNoise(px, pz, 13, 0.5);
            var dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            var best = null, bestDist = 2.7;
            for (var i = 0; i < zombies.length; i++) {
                var z = zombies[i];
                var rel = new THREE.Vector3(z.position.x - px, 1.0 - eyeY, z.position.z - pz);
                var t = rel.dot(dir);
                if (t <= 0 || t > bestDist) continue;
                var perp = rel.clone().sub(dir.clone().multiplyScalar(t)).length();
                if (perp < 0.7) { best = z; bestDist = t; }
            }
            if (best) {
                if (multiplayer && !netHost) {
                    netSendEvent('hit', { zid: best.userData.id, damage: 92, headshot: false });
                } else {
                    best.userData.health -= 92;
                    if (best.userData.health <= 0) killZombie(best, false);
                }
                var hit = document.getElementById('g3dFpsHit');
                if (hit) { hit.classList.remove('is-active'); void hit.offsetWidth; hit.classList.add('is-active'); hitTimer = 0.13; }
            }
        }

        function nearestLoot() {
            var best = null, bestD = 2.5;
            for (var i = 0; i < lootCrates.length; i++) {
                var crate = lootCrates[i];
                if (crate.userData.looted) continue;
                var dx = crate.position.x - px, dz = crate.position.z - pz;
                var d = Math.sqrt(dx * dx + dz * dz);
                if (d < bestD) { bestD = d; best = crate; }
            }
            return best;
        }

        function lootCrate(crate) {
            if (!crate || crate.userData.looted) return;
            crate.userData.looted = true;
            crate.userData.lid.rotation.x = -1.15;
            crate.userData.lid.position.y = 0.92;
            crate.userData.glow.visible = false;
            if (multiplayer && !netHost) netSendEvent('loot', { index: crate.userData.index });
            var roll = Math.random();
            var locked = Object.keys(weaponState).filter(function (key) { return !weaponState[key].owned; });
            if (locked.length && roll < 0.46) {
                var found = locked[Math.floor(Math.random() * locked.length)];
                unlockWeapon(found);
                switchWeapon(found);
                showBanner('FOUND ' + WEAPONS[found].name.toUpperCase());
            } else if (roll < 0.62) { reserve += 50; showBanner('+50 AMMO'); }
            else if (roll < 0.78) { health = Math.min(100, health + 35); showBanner('+35 HEALTH'); }
            else if (roll < 0.88) { hunger = Math.min(100, hunger + 45); showBanner('FOOD +45'); }
            else if (roll < 0.96) { thirst = Math.min(100, thirst + 50); showBanner('WATER +50'); }
            else { bandages++; showBanner('BANDAGE +1'); }
            score += 100;
            sfx(760, 0.12, 0.05, 'sine', 1100);
            makeNoise(px, pz, 8, 0.4);
        }

        function findZombieById(id) {
            for (var i = 0; i < zombies.length; i++) {
                if (String(zombies[i].userData.id) === String(id)) return zombies[i];
            }
            return null;
        }

        function setZombieNet(host, send, active) {
            multiplayer = active !== false;
            netHost = active === false ? true : !!host;
            netSend = typeof send === 'function' ? send : null;
            if (!netHost) spawnQueue = 0;
            for (var i = 0; i < zombies.length; i++) {
                var body = zombies[i].userData.body;
                if (!body || !global.CANNON) continue;
                if (netHost) {
                    body.type = global.CANNON.Body.DYNAMIC;
                    body.mass = zombies[i].userData.bodyMass || 35;
                } else {
                    body.type = global.CANNON.Body.KINEMATIC;
                    body.mass = 0;
                }
                body.updateMassProperties();
            }
        }

        function netSendEvent(name, payload) {
            if (netSend) { try { netSend(name, payload); } catch (e) {} }
        }

        function ensureExtraction(x, z) {
            extractionPos = { x: x || 0, z: z == null ? -28 : z };
            if (extractionMesh) {
                extractionMesh.position.set(extractionPos.x, 0, extractionPos.z);
                extractionMesh.visible = true;
                return;
            }
            extractionMesh = new THREE.Group();
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(2.3, 0.12, 8, 40),
                new THREE.MeshBasicMaterial({ color: 0x54ff9f, transparent: true, opacity: 0.9 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.08;
            extractionMesh.add(ring);
            var beam = new THREE.Mesh(
                new THREE.CylinderGeometry(2.1, 2.1, 7, 24, 1, true),
                new THREE.MeshBasicMaterial({ color: 0x54ff9f, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
            );
            beam.position.y = 3.5;
            extractionMesh.add(beam);
            var light = new THREE.PointLight(0x54ff9f, 2.2, 16);
            light.position.y = 2.4;
            extractionMesh.add(light);
            extractionMesh.userData.ring = ring;
            extractionMesh.position.set(extractionPos.x, 0, extractionPos.z);
            scene.add(extractionMesh);
        }

        function openExtraction() {
            if (extractionReady) return;
            extractionReady = true;
            extractionTimer = 0;
            ensureExtraction(0, -28);
            showBanner('EXTRACTION OPEN');
            sfx(520, 0.35, 0.06, 'sine', 980);
        }

        function closeExtraction() {
            extractionReady = false;
            extractionTimer = 0;
            if (extractionMesh) { scene.remove(extractionMesh); disposeObject(extractionMesh); extractionMesh = null; }
        }

        function getZombieWorld() {
            return {
                wave: wave,
                extraction: extractionReady,
                ex: extractionPos ? [extractionPos.x, extractionPos.z] : null,
                zombies: zombies.map(function (z) {
                    return { id: z.userData.id, type: z.userData.type, x: z.position.x, z: z.position.z, hp: z.userData.health };
                }),
                crates: lootCrates.map(function (c) { return !!c.userData.looted; })
            };
        }

        function applyZombieWorld(snapshot) {
            if (!snapshot || netHost) return;
            multiplayer = true;
            wave = Number(snapshot.wave) || wave;
            if (snapshot.extraction) {
                extractionReady = true;
                if (snapshot.ex) ensureExtraction(Number(snapshot.ex[0]) || 0, Number(snapshot.ex[1]) || -28);
            } else if (extractionReady) {
                closeExtraction();
            }
            var seen = {};
            var list = snapshot.zombies || [];
            for (var i = 0; i < list.length; i++) {
                var zd = list[i];
                if (!zd || !zd.id) continue;
                seen[String(zd.id)] = true;
                var z = findZombieById(zd.id);
                if (!z) {
                    makeZombie(zd.type || 'walker', zd.id);
                    z = zombies[zombies.length - 1];
                    z.position.set(Number(zd.x) || 0, 0, Number(zd.z) || 0);
                } else {
                    z.position.x += ((Number(zd.x) || 0) - z.position.x) * 0.65;
                    z.position.z += ((Number(zd.z) || 0) - z.position.z) * 0.65;
                }
                if (z.userData.body) {
                    z.userData.body.position.set(Number(zd.x) || 0, 0.9, Number(zd.z) || 0);
                    z.userData.body.velocity.set(0, 0, 0);
                }
                z.userData.health = Number(zd.hp) || 0;
            }
            for (var j = zombies.length - 1; j >= 0; j--) {
                if (!seen[String(zombies[j].userData.id)]) {
                    var dead = zombies[j];
                    if (dead.userData.body && physicsWorld) physicsWorld.removeBody(dead.userData.body);
                    zombies.splice(j, 1);
                    scene.remove(dead); disposeObject(dead);
                }
            }
            if (snapshot.crates) {
                for (var c = 0; c < lootCrates.length && c < snapshot.crates.length; c++) {
                    if (snapshot.crates[c] && !lootCrates[c].userData.looted) {
                        lootCrates[c].userData.looted = true;
                        lootCrates[c].userData.lid.rotation.x = -1.15;
                        lootCrates[c].userData.lid.position.y = 0.92;
                        lootCrates[c].userData.glow.visible = false;
                    }
                }
            }
        }

        function applyZombieHit(id, damage, headshot, from) {
            if (!netHost) return;
            var z = findZombieById(id);
            if (!z) return;
            z.userData.health -= Number(damage) || 0;
            if (z.userData.health <= 0) {
                var credit = 100 + (z.userData.scoreValue || 0) + wave * 10;
                var remoteKill = !!(from && from !== 'local');
                killZombie(z, !!headshot, remoteKill);
                if (remoteKill) netSendEvent('kill', { target: from, points: credit });
            }
        }

        function addZombieScore(points) {
            score += Math.max(0, Number(points) || 0);
        }

        function applyZombieAttack(damage) {
            if (downed) return;
            health -= Number(damage) || 0;
            bleed = Math.min(3, bleed + 0.7);
            damageTimer = 0.28;
            var dmg = document.getElementById('g3dFpsDamage');
            if (dmg) { dmg.classList.remove('is-active'); void dmg.offsetWidth; dmg.classList.add('is-active'); }
            sfx(110, 0.16, 0.09, 'sawtooth', 60);
        }

        function reviveZombiePlayer() {
            if (!downed) return;
            downed = false;
            downTimer = 0;
            health = 55;
            bleed = 0;
            stamina = 55;
            showBanner('REVIVED');
            sfx(700, 0.25, 0.06, 'sine', 1100);
        }

        function applyLootedCrate(index) {
            var crate = lootCrates[index];
            if (!crate || crate.userData.looted) return;
            crate.userData.looted = true;
            crate.userData.lid.rotation.x = -1.15;
            crate.userData.lid.position.y = 0.92;
            crate.userData.glow.visible = false;
        }

        var promptTimer = 0;
        function update(dt) {
            elapsed += dt;
            if (dead) return;
            fireCd = Math.max(0, fireCd - dt);
            muzzle.intensity = Math.max(0, muzzle.intensity - dt * 22);
            if (hitTimer > 0) hitTimer -= dt;
            if (comboTimer > 0) {
                comboTimer -= dt;
                if (comboTimer <= 0) { comboKills = 0; comboMult = 1; }
            }
            if (frenzyT > 0) frenzyT = Math.max(0, frenzyT - dt);
            if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) { var b = document.getElementById('g3dFpsWaveBanner'); if (b) b.classList.remove('is-active'); } }
            if (damageTimer > 0) { damageTimer -= dt; if (damageTimer <= 0) { var dmg = document.getElementById('g3dFpsDamage'); if (dmg) dmg.classList.remove('is-active'); } }
            if (downed) {
                downTimer -= dt;
                if (downTimer <= 0) { endGame(score); return; }
            }

            // Movement (WASD + Shift sprint).
            var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
            var rx = Math.cos(yaw), rz = -Math.sin(yaw);
            var mx = 0, mz = 0;
            if (!downed && input.up) { mx += fx; mz += fz; }
            if (!downed && input.down) { mx -= fx; mz -= fz; }
            if (!downed && input.left) { mx -= rx; mz -= rz; }
            if (!downed && input.right) { mx += rx; mz += rz; }
            if (!downed && (input.mobileX || input.mobileY)) {
                mx += rx * input.mobileX + fx * input.mobileY;
                mz += rz * input.mobileX + fz * input.mobileY;
            }
            var moving = !downed && (mx !== 0 || mz !== 0);
            var mobileMag = Math.min(1, Math.sqrt(input.mobileX * input.mobileX + input.mobileY * input.mobileY));
            var wantSprint = input.nitro || (isMobileDevice && mobileMag > 0.65);
            sprinting = !!(wantSprint && moving && stamina > 1);
            if (sprinting) stamina = Math.max(0, stamina - 20 * dt);
            else stamina = Math.min(100, stamina + (moving ? 8 : 16) * dt);
            var moveSpeed = sprinting ? 9.6 : (isMobileDevice ? 6.4 : 5.8);
            if (moving) {
                var len = Math.sqrt(mx * mx + mz * mz); mx /= len; mz /= len;
            }
            if (playerBody) {
                playerBody.velocity.x = moving && !downed ? mx * moveSpeed : 0;
                playerBody.velocity.z = moving && !downed ? mz * moveSpeed : 0;
                if (!downed && input.jump && onGround) { playerBody.velocity.y = 7.2; onGround = false; input.jump = false; }
                physicsWorld.step(1 / 60, dt, 3);
                px = playerBody.position.x;
                pz = playerBody.position.z;
                eyeY = playerBody.position.y + 1.18;
                onGround = playerBody.position.y <= 0.58 && Math.abs(playerBody.velocity.y) < 1.2;
            } else {
                if (moving) {
                    var nx = px + mx * moveSpeed * dt, nz = pz + mz * moveSpeed * dt;
                    if (!blockedAt(nx, pz)) px = nx;
                    if (!blockedAt(px, nz)) pz = nz;
                }
                if (!downed && input.jump && onGround) { vy = 6.4; onGround = false; }
                vy -= 19 * dt;
                eyeY += vy * dt;
                if (eyeY <= 1.68) { eyeY = 1.68; vy = 0; onGround = true; }
            }
            if (physicsWorld) {
                for (var zsi = 0; zsi < zombies.length; zsi++) {
                    var zsBody = zombies[zsi].userData.body;
                    if (zsBody && netHost) zombies[zsi].position.set(zsBody.position.x, 0, zsBody.position.z);
                }
            }
            noiseTimer -= dt;
            if (sprinting && noiseTimer <= 0) { noiseTimer = 0.85; makeNoise(px, pz, 13, 0.5); }

            if (input.reload) { input.reload = false; if (!downed) startReload(); }
            if (input.weapon && !downed) {
                var weaponKeys = ['pistol', 'rifle', 'shotgun'];
                switchWeapon(weaponKeys[Math.max(0, Math.min(2, input.weapon - 1))]);
                input.weapon = 0;
            }
            if (input.bandage) {
                input.bandage = false;
                if (!downed && bleed > 0 && bandages > 0) {
                    bandages--;
                    bleed = 0;
                    health = Math.min(100, health + 14);
                    showBanner('BANDAGED');
                    sfx(620, 0.18, 0.045, 'sine', 420);
                }
            }
            hunger = Math.max(0, hunger - 0.055 * dt);
            thirst = Math.max(0, thirst - 0.08 * dt);
            if (hunger <= 0) health -= 1.1 * dt;
            if (thirst <= 0) health -= 1.5 * dt;
            if (bleed > 0) health -= bleed * 1.15 * dt;
            if (reloadT > 0) {
                reloadT -= dt;
                if (reloadT <= 0) {
                    var reloadCfg = weaponCfg();
                    var need = Math.min(reloadCfg.mag - ammo, reserve);
                    ammo += need; reserve -= need;
                    sfx(600, 0.09, 0.04, 'square', 900);
                }
            }
            if (input.fsdToggle) {
                input.fsdToggle = false;
                flashlightOn = !flashlightOn;
                flashlight.intensity = flashlightOn ? 3.4 : 0;
                sfx(flashlightOn ? 720 : 520, 0.07, 0.03, 'square', flashlightOn ? 980 : 300);
            }
            meleeCd = Math.max(0, meleeCd - dt);
            meleeAnim = Math.max(0, meleeAnim - dt);
            if (input.melee) { input.melee = false; if (!downed) doMelee(); }
            var reviveTarget = null;
            if (multiplayer && !downed) {
                var bestReviveD = 3.0;
                Object.keys(remotePlayers).forEach(function (rid) {
                    var rp = remotePlayers[rid];
                    if (!rp.userData.downed) return;
                    var rdx = rp.position.x - px, rdz = rp.position.z - pz;
                    var rd = Math.sqrt(rdx * rdx + rdz * rdz);
                    if (rd < bestReviveD) { bestReviveD = rd; reviveTarget = rp; }
                });
            }
            if (input.interact) {
                input.interact = false;
                if (reviveTarget) netSendEvent('revive', { target: reviveTarget.userData.id });
                else {
                    var crateToLoot = nearestLoot();
                    if (crateToLoot && !downed) lootCrate(crateToLoot);
                }
            }
            var nearCrate = nearestLoot();
            var interactEl = document.getElementById('g3dFpsInteract');
            if (interactEl) {
                if (reviveTarget) {
                    interactEl.textContent = 'E · Revive ' + (reviveTarget.userData.name || 'survivor');
                    interactEl.classList.add('is-active');
                } else if (nearCrate && !downed) {
                    interactEl.textContent = 'E · Search crate';
                    interactEl.classList.add('is-active');
                } else if (downed) {
                    interactEl.textContent = 'DOWNED · WAITING FOR REVIVE';
                    interactEl.classList.add('is-active');
                } else if (extractionReady) {
                    interactEl.textContent = extractionTimer > 0 ? 'EXTRACTING · HOLD POSITION' : 'REACH THE GREEN EXTRACTION ZONE';
                    interactEl.classList.add('is-active');
                } else {
                    interactEl.classList.remove('is-active');
                }
            }
            if (firing && !downed) fire();

            var bob = moving && onGround ? Math.sin(elapsed * 11) * 0.035 : 0;
            camera.position.set(px, eyeY + bob, pz);
            camera.rotation.set(pitch, yaw, 0);
            gun.position.y = -0.34 + bob * 0.5 - (meleeAnim > 0 ? meleeAnim * 0.7 : 0);
            gun.position.x = 0.34 + (moving ? Math.sin(elapsed * 5.5) * 0.012 : 0);
            gun.rotation.z = meleeAnim > 0 ? -meleeAnim * 2.2 : 0;

            // Zombie waves and AI are host-authoritative in multiplayer.
            if (netHost) {
                if (!extractionReady) {
                    if (spawnQueue > 0) {
                        spawnTimer -= dt;
                        if (spawnTimer <= 0) { spawnZombie(); spawnQueue--; spawnTimer = Math.max(0.16, 0.5 - wave * 0.02); }
                    }
                    if (!zombies.length && spawnQueue <= 0) {
                        intermission -= dt;
                        if (intermission <= 0) startWave(wave + 1);
                    }
                }
                if (!extractionReady && wave % 5 === 0 && !zombies.length && spawnQueue <= 0 && !bossPending) {
                    openExtraction();
                }

                for (var zi = zombies.length - 1; zi >= 0; zi--) {
                    var z = zombies[zi];
                    var u = z.userData;
                    if (u.alertT > 0) u.alertT -= dt;
                    var pdx = px - z.position.x, pdz = pz - z.position.z;
                    var playerDist = Math.sqrt(pdx * pdx + pdz * pdz);
                    var targetId = 'local', targetX = px, targetZ = pz, targetDist = playerDist;
                    if (downed) { targetDist = 9999; }
                    Object.keys(remotePlayers).forEach(function (rid) {
                        var rp = remotePlayers[rid];
                        if (rp.userData.health <= 0) return;
                        var rdx = rp.position.x - z.position.x, rdz = rp.position.z - z.position.z;
                        var rd = Math.sqrt(rdx * rdx + rdz * rdz);
                        if (rd < targetDist) { targetDist = rd; targetId = rid; targetX = rp.position.x; targetZ = rp.position.z; }
                    });
                    if (u.alertT > 0 && targetDist > 5.5) {
                        targetX = u.noiseX != null ? u.noiseX : targetX;
                        targetZ = u.noiseZ != null ? u.noiseZ : targetZ;
                    }
                    var dx = targetX - z.position.x, dz = targetZ - z.position.z;
                    var dist = Math.sqrt(dx * dx + dz * dz);
                    if (targetDist > 1.15 && targetDist < 9999) {
                        var zs = u.speed * (1 + wave * 0.025);
                        u.lungeCd = Math.max(0, (u.lungeCd || 0) - dt);
                        if (u.type === 'runner' && u.lungeCd <= 0 && playerDist > 2.2 && playerDist < 11 && u.body) {
                            u.lungeCd = 4.5 + Math.random() * 2;
                            zs *= 2.6;
                            tone(160, 0.08, 'sawtooth', 0.035, 110);
                        }
                        if (u.body) {
                            if (dist > 0.25) {
                                u.body.velocity.x = (dx / dist) * zs;
                                u.body.velocity.z = (dz / dist) * zs;
                                z.rotation.y = Math.atan2(dx, dz);
                            } else {
                                u.body.velocity.x = 0;
                                u.body.velocity.z = 0;
                            }
                        } else if (dist > 0.25) {
                            var stepX = (dx / dist) * zs * dt, stepZ = (dz / dist) * zs * dt;
                            if (!blockedAt(z.position.x + stepX, z.position.z, 0.46)) z.position.x += stepX;
                            if (!blockedAt(z.position.x, z.position.z + stepZ, 0.46)) z.position.z += stepZ;
                            z.rotation.y = Math.atan2(dx, dz);
                        }
                        var swing = Math.sin(elapsed * (u.type === 'runner' ? 11 : 7) + u.phase) * 0.65;
                        u.armL.rotation.x = swing; u.armR.rotation.x = -swing;
                        u.legL.rotation.x = -swing * 0.7; u.legR.rotation.x = swing * 0.7;
                    } else if (targetDist <= 1.15) {
                        if (u.body) { u.body.velocity.x = 0; u.body.velocity.z = 0; }
                        u.attackCd -= dt;
                        if (u.attackCd <= 0) {
                            u.attackCd = 0.95;
                            var hitDamage = (u.damage || 8) + wave * 1.1;
                            if (targetId === 'local') {
                                if (!downed) {
                                    health -= hitDamage;
                                    bleed = Math.min(3, bleed + (u.type === 'brute' || u.type === 'boss' ? 1.1 : 0.45));
                                    damageTimer = 0.28;
                                    var dmg = document.getElementById('g3dFpsDamage');
                                    if (dmg) { dmg.classList.remove('is-active'); void dmg.offsetWidth; dmg.classList.add('is-active'); }
                                    sfx(110, 0.16, 0.09, 'sawtooth', 60);
                                }
                            } else {
                                netSendEvent('attack', { target: targetId, damage: hitDamage });
                            }
                        }
                    }
                    z.position.y = 0;
                }
            }

            // Detail LOD: tiny eyes/teeth/wounds are hidden at distance.
            for (var lz = 0; lz < zombies.length; lz++) {
                var lodZ = zombies[lz];
                var lodDist = Math.abs(lodZ.position.z - pz);
                var zRange = [12, 18, 26, 36, 48][qualityLevel] != null ? [12, 18, 26, 36, 48][qualityLevel] : 26;
                var lodShow = lodDist < (isMobileDevice ? Math.min(zRange, 16) : zRange);
                if (lodZ.userData.lodVisible === lodShow) continue;
                lodZ.userData.lodVisible = lodShow;
                var zdList = lodZ.userData.lodDetails || [];
                for (var zdl = 0; zdl < zdList.length; zdl++) zdList[zdl].visible = lodShow;
            }

            // Zombie corpses are physical ragdolls: gravity, bounce, friction,
            // angular momentum, and flailing limbs before they settle.
            for (var ci = corpses.length - 1; ci >= 0; ci--) {
                var corpse = corpses[ci];
                corpse.life -= dt;
                var cg = corpse.group;
                cg.position.x += corpse.vx * dt;
                cg.position.y += corpse.vy * dt;
                cg.position.z += corpse.vz * dt;
                corpse.vy -= 22 * dt;
                cg.rotation.x += corpse.spinX * dt;
                cg.rotation.y += corpse.spinY * dt;
                cg.rotation.z += corpse.spinZ * dt;
                corpse.spinX *= Math.max(0, 1 - dt * 0.7);
                corpse.spinY *= Math.max(0, 1 - dt * 0.8);
                corpse.spinZ *= Math.max(0, 1 - dt * 0.7);
                if (cg.position.y < 0) {
                    cg.position.y = 0;
                    corpse.vy = Math.abs(corpse.vy) * 0.22;
                    corpse.vx *= 0.66;
                    corpse.vz *= 0.66;
                    corpse.spinX *= 0.62;
                    corpse.spinY *= 0.7;
                    corpse.spinZ *= 0.62;
                }
                if (cg.position.x < -34) cg.position.x = -34;
                if (cg.position.x > 34) cg.position.x = 34;
                if (cg.position.z < -34) cg.position.z = -34;
                if (cg.position.z > 34) cg.position.z = 34;
                (corpse.limbs || []).forEach(function (limb) {
                    limb.mesh.rotation.x += limb.spin * dt;
                    limb.spin *= Math.max(0, 1 - dt * 0.55);
                });
                if (corpse.life < 1.2) cg.position.y -= dt * 0.45;
                if (corpse.life <= 0) {
                    scene.remove(cg); disposeObject(cg);
                    if (corpse.blood) { scene.remove(corpse.blood); disposeObject(corpse.blood); }
                    corpses.splice(ci, 1);
                }
            }

            for (var pi = pickups.length - 1; pi >= 0; pi--) {
                var p = pickups[pi];
                p.rotation.y += dt * 1.1;
                p.position.y = 0.08 + Math.sin(elapsed * 2 + p.userData.phase) * 0.06;
                var pdx = px - p.position.x, pdz = pz - p.position.z;
                if (pdx * pdx + pdz * pdz < 2.4) {
                    if (p.userData.type === 'ammo') reserve += 70; else health = Math.min(100, health + 35);
                    sfx(760, 0.12, 0.05, 'sine', 1100);
                    scene.remove(p); disposeObject(p); pickups.splice(pi, 1);
                }
            }

            for (var ti = tracers.length - 1; ti >= 0; ti--) {
                tracers[ti].life -= dt;
                tracers[ti].line.material.opacity = Math.max(0, tracers[ti].life / 0.08);
                if (tracers[ti].life <= 0) { scene.remove(tracers[ti].line); disposeObject(tracers[ti].line); tracers.splice(ti, 1); }
            }

            Object.keys(remotePlayers).forEach(function (id) {
                var rp = remotePlayers[id];
                rp.position.x += (rp.userData.targetX - rp.position.x) * Math.min(1, dt * 10);
                rp.position.z += (rp.userData.targetZ - rp.position.z) * Math.min(1, dt * 10);
                rp.rotation.y += (rp.userData.targetYaw - rp.rotation.y) * Math.min(1, dt * 10);
                rp.rotation.z += ((rp.userData.downed ? -Math.PI / 2 : 0) - rp.rotation.z) * Math.min(1, dt * 8);
            });

            if (extractionReady && extractionMesh) {
                if (extractionMesh.userData.ring) extractionMesh.userData.ring.rotation.z += dt * 0.8;
                if (extractionPos) {
                    var edx = px - extractionPos.x, edz = pz - extractionPos.z;
                    if (Math.sqrt(edx * edx + edz * edz) < 2.8) {
                        extractionTimer += dt;
                        if (extractionTimer >= 4) {
                            score += 1200;
                            dead = true;
                            endGame(score);
                            return;
                        }
                    } else {
                        extractionTimer = 0;
                    }
                }
            }

            if (health <= 0 && !dead) {
                if (multiplayer && !downed) {
                    downed = true;
                    downTimer = 20;
                    health = 0;
                    bleed = 0;
                    firing = false;
                    showBanner('DOWNED · WAITING FOR REVIVE');
                    sfx(160, 0.5, 0.07, 'sawtooth', 70);
                } else if (!multiplayer) {
                    dead = true;
                    endGame(score);
                    return;
                }
            }

            var lockedNow = document.pointerLockElement === canvas;
            if (lockedNow !== locked) {
                locked = lockedNow;
                var prompt = document.getElementById('g3dFpsPrompt');
                if (prompt) prompt.style.display = locked ? 'none' : 'flex';
            }

            var elH = document.getElementById('g3dFpsHealth');
            var elA = document.getElementById('g3dFpsAmmo');
            var elW = document.getElementById('g3dFpsWave');
            var elK = document.getElementById('g3dFpsKills');
            var elS = document.getElementById('g3dFpsScore');
            var elSt = document.getElementById('g3dFpsStamina');
            var elWpn = document.getElementById('g3dFpsWeapon');
            var elFood = document.getElementById('g3dFpsFood');
            var elWater = document.getElementById('g3dFpsWater');
            var elBand = document.getElementById('g3dFpsBandage');
            var elBandLabel = document.getElementById('g3dFpsBandageLabel');
            if (elH) { elH.textContent = Math.max(0, Math.round(health)); elH.classList.toggle('is-low', health < 35); }
            if (elA) elA.textContent = reloadT > 0 ? 'RELOAD' : (ammo + ' / ' + reserve);
            if (elW) elW.textContent = wave;
            if (elK) elK.textContent = kills;
            if (elS) elS.textContent = Math.round(score).toLocaleString();
            if (elSt) { elSt.textContent = Math.round(stamina); elSt.classList.toggle('is-low', stamina < 25); }
            var comboEl = document.getElementById('g3dFpsCombo');
            if (comboEl) {
                var showCombo = comboKills > 1 || frenzyT > 0;
                comboEl.classList.toggle('is-active', showCombo);
                comboEl.classList.toggle('is-frenzy', frenzyT > 0);
                comboEl.textContent = frenzyT > 0 ? ('FRENZY · x' + comboMult.toFixed(1)) : ('x' + comboMult.toFixed(1) + ' · ' + comboKills + ' KILL STREAK');
            }
            var bossWrap = document.getElementById('g3dFpsBoss');
            var bossFill = document.getElementById('g3dFpsBossFill');
            var boss = null;
            for (var bz = 0; bz < zombies.length; bz++) {
                if (zombies[bz].userData.type === 'boss') { boss = zombies[bz]; break; }
            }
            if (bossWrap) bossWrap.classList.toggle('is-active', !!boss);
            if (bossFill && boss) {
                var bossMax = boss.userData.maxHealth || 1;
                bossFill.style.width = Math.max(0, Math.min(100, (boss.userData.health / bossMax) * 100)) + '%';
            }
            if (elWpn) {
                var wlvl = Number(weaponUpgrades[currentWeapon]) || 0;
                elWpn.textContent = weaponCfg().name + (wlvl ? ' +' + wlvl : '');
            }
            if (elFood) elFood.style.width = Math.round(hunger) + '%';
            if (elWater) elWater.style.width = Math.round(thirst) + '%';
            if (elBand) {
                elBand.style.width = (bleed > 0 ? 100 : (bandages > 0 ? 100 : 0)) + '%';
                elBand.classList.toggle('is-bleeding', bleed > 0);
                elBand.classList.toggle('is-empty', bleed <= 0 && bandages <= 0);
            }
            if (elBandLabel) elBandLabel.textContent = bleed > 0 ? 'BLEEDING' : ('Bandage x' + bandages);
        }

        // Pointer lock / trackpad look.
        var canvas = renderer ? renderer.domElement : ctx.container;
        function requestAim() {
            if (!canvas) return;
            if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
                try { canvas.requestPointerLock(); } catch (e) {}
            }
        }
        function onMouseMove(e) {
            if (document.pointerLockElement === canvas) {
                yaw -= (e.movementX || 0) * 0.0022;
                pitch = Math.max(-1.35, Math.min(1.35, pitch - (e.movementY || 0) * 0.0022));
            } else if (dragging) {
                yaw -= (e.movementX || 0) * 0.003;
                pitch = Math.max(-1.35, Math.min(1.35, pitch - (e.movementY || 0) * 0.003));
            }
        }
        function onMouseDown(e) {
            if (isMobileDevice) return;
            if (e.button !== 0) return;
            if (document.pointerLockElement === canvas) firing = true;
            else { dragging = true; requestAim(); }
        }
        function onMouseUp() { firing = false; dragging = false; }
        if (canvas) {
            listen(canvas, 'click', requestAim);
            listen(canvas, 'mousedown', onMouseDown);
            listen(canvas, 'contextmenu', function (e) { e.preventDefault(); });
        }
        listen(document, 'mousemove', onMouseMove);
        listen(document, 'mouseup', onMouseUp);
        listen(document, 'pointerlockchange', function () {
            var prompt = document.getElementById('g3dFpsPrompt');
            if (prompt) prompt.style.display = document.pointerLockElement === canvas ? 'none' : 'flex';
        });

        var touchLookId = null, touchLookX = 0, touchLookY = 0;
        if (canvas) {
            listen(canvas, 'pointerdown', function (e) {
                if (e.pointerType !== 'touch') return;
                touchLookId = e.pointerId;
                touchLookX = e.clientX;
                touchLookY = e.clientY;
            });
            listen(canvas, 'pointermove', function (e) {
                if (e.pointerId !== touchLookId) return;
                yaw -= (e.clientX - touchLookX) * 0.0048;
                pitch = Math.max(-1.35, Math.min(1.35, pitch - (e.clientY - touchLookY) * 0.0048));
                touchLookX = e.clientX;
                touchLookY = e.clientY;
                if (e.cancelable) e.preventDefault();
            }, { passive: false });
            listen(document, 'pointerup', function (e) {
                if (e.pointerId === touchLookId) touchLookId = null;
            });
            listen(document, 'pointercancel', function (e) {
                if (e.pointerId === touchLookId) touchLookId = null;
            });
        }

        applyWeaponVisual();
        startWave(1);
        makePickup('ammo');
        makePickup('health');

        return {
            over: false,
            update: update,
            setRemotes: setRemotes,
            setZombieNet: setZombieNet,
            setMobileMove: setMobileMove,
            setMobileFiring: setMobileFiring,
            mobileFpsAction: mobileFpsAction,
            getZombieWorld: getZombieWorld,
            applyZombieWorld: applyZombieWorld,
            applyZombieHit: applyZombieHit,
            addZombieScore: addZombieScore,
            applyZombieAttack: applyZombieAttack,
            reviveZombiePlayer: reviveZombiePlayer,
            applyLootedCrate: applyLootedCrate,
            getScore: function () { return score; },
            getState: function () { return { x: px, z: pz, yaw: yaw, health: Math.max(0, health), downed: downed, stamina: Math.round(stamina), hunger: Math.round(hunger), thirst: Math.round(thirst), weapon: currentWeapon, score: score, wave: wave, kills: kills }; }
        };
    }

    /* ---------------- Beach City (free-roam) ---------------- */
    function createCity(ctx) {
        var scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
        if (renderer) renderer.shadowMap.enabled = false;
        var cosmetics = (ctx.options && ctx.options.cosmetics) || {};
        var carColor = cosmetics.paint != null ? cosmetics.paint : 0xef476f;
        var cityPerf = cosmetics.performance || {};
        var cityTop = Math.max(70, 192 * (cityPerf.topSpeed || 1));
        var cityAccel = Math.max(9, 24 * (cityPerf.accel || 1));
        if (renderer) renderer.toneMappingExposure = 1.14;

        scene.background = new THREE.Color(0x9ed2ee);
        scene.fog = new THREE.Fog(0xd8e9f3, 180, 520);

        // Daylight setup for the city (the highway scene has its own lights).
        scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x8a7f66, 1.35));
        scene.add(new THREE.AmbientLight(0xffffff, 0.45));
        var citySun = new THREE.DirectionalLight(0xfff1d0, 2.2);
        citySun.position.set(90, 140, 70);
        scene.add(citySun);
        var cityFill = new THREE.DirectionalLight(0x9fc8ff, 0.65);
        cityFill.position.set(-80, 60, -90);
        scene.add(cityFill);

        function standard(color, options) {
            return new THREE.MeshStandardMaterial(Object.assign({
                color: color, roughness: 0.62, metalness: 0.08
            }, options || {}));
        }
        function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
        function cylinder(top, bottom, height, seg, mat) {
            return new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, seg || 10), mat);
        }
        function canvasTexture(w, h, draw, rx, ry) {
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            draw(c.getContext('2d'), w, h);
            var t = new THREE.CanvasTexture(c);
            if (rx || ry) {
                t.wrapS = THREE.RepeatWrapping;
                t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(rx || 1, ry || 1);
            }
            return t;
        }

        var GRID = 5, BLOCK = 60, ROAD = 16;
        var half = (GRID - 1) * BLOCK / 2;
        var BOUND = half + ROAD / 2 + 8;
        var roadCoords = [];
        for (var gi = 0; gi < GRID; gi++) roadCoords.push((gi - (GRID - 1) / 2) * BLOCK);

        // Ground.
        var ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUND * 2 + 160, BOUND * 2 + 160), standard(0x93a184, { roughness: 0.95 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        scene.add(ground);

        // Road texture with lane dashes.
        function roadTexture(vertical) {
            return canvasTexture(64, 256, function (g, w, h) {
                g.fillStyle = '#2b3038';
                g.fillRect(0, 0, w, h);
                g.fillStyle = 'rgba(255,255,255,0.16)';
                g.fillRect(3, 0, 2, h);
                g.fillRect(w - 5, 0, 2, h);
                g.fillStyle = 'rgba(255,214,90,0.72)';
                for (var y = 0; y < h; y += 32) g.fillRect(w / 2 - 1.5, y, 3, 18);
            }, vertical ? 1 : 46, vertical ? 46 : 1);
        }
        var roadMatZ = new THREE.MeshStandardMaterial({ map: roadTexture(true), roughness: 0.94 });
        var roadMatX = new THREE.MeshStandardMaterial({ map: roadTexture(false), roughness: 0.94 });
        var roadLen = BOUND * 2 + ROAD * 2;
        for (var ri = 0; ri < roadCoords.length; ri++) {
            var rc = roadCoords[ri];
            var rz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, roadLen), roadMatZ);
            rz.rotation.x = -Math.PI / 2;
            rz.position.set(rc, 0.02, 0);
            rz.receiveShadow = true;
            scene.add(rz);
            var rx = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD), roadMatX);
            rx.rotation.x = -Math.PI / 2;
            rx.position.set(0, 0.025, rc);
            rx.receiveShadow = true;
            scene.add(rx);
        }

        // Sidewalks.
        var walkMat = standard(0xc3c4b8, { roughness: 0.9 });
        for (var wi = 0; wi < roadCoords.length; wi++) {
            var wc = roadCoords[wi];
            [-1, 1].forEach(function (side) {
                var sw = box(3, 0.18, roadLen, walkMat);
                sw.position.set(wc + side * (ROAD / 2 + 1.5), 0.09, 0);
                sw.receiveShadow = true;
                scene.add(sw);
                var sw2 = box(roadLen, 0.18, 3, walkMat);
                sw2.position.set(0, 0.09, wc + side * (ROAD / 2 + 1.5));
                sw2.receiveShadow = true;
                scene.add(sw2);
            });
        }

        // Crosswalk stripes at intersections.
        var stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea, transparent: true, opacity: 0.72 });
        for (var xi = 0; xi < roadCoords.length; xi++) {
            for (var zi = 0; zi < roadCoords.length; zi++) {
                var xx = roadCoords[xi], zz = roadCoords[zi];
                for (var si = 0; si < 2; si++) {
                    var off = -ROAD / 2 + 3 + si * 6.4;
                    var s1 = box(ROAD - 2, 0.02, 0.9, stripeMat);
                    s1.position.set(xx, 0.045, zz + off);
                    scene.add(s1);
                    var s2 = box(0.9, 0.02, ROAD - 2, stripeMat);
                    s2.position.set(xx + off, 0.045, zz);
                    scene.add(s2);
                }
            }
        }

        // Facade textures.
        function facadeTexture(base, warm) {
            return canvasTexture(64, 128, function (g, w, h) {
                g.fillStyle = base;
                g.fillRect(0, 0, w, h);
                for (var y = 8; y < h - 6; y += 16) {
                    for (var x = 7; x < w - 6; x += 14) {
                        var lit = Math.random() < 0.5;
                        g.fillStyle = lit ? (Math.random() < 0.5 ? warm : '#ffe9b0') : 'rgba(22,38,52,0.9)';
                        g.fillRect(x, y, 8, 9);
                    }
                }
            }, 2, 2);
        }
        var facades = [
            standard(0xffffff, { map: facadeTexture('#38424e', '#8fd4ff') }),
            standard(0xffffff, { map: facadeTexture('#4a3f3a', '#ffd08a') }),
            standard(0xffffff, { map: facadeTexture('#33463f', '#9dffd1') }),
            standard(0xffffff, { map: facadeTexture('#45404f', '#d6b7ff') })
        ];

        var buildings = [];
        var props = new THREE.Group();
        scene.add(props);
        var treeTrunkMat = standard(0x6b4a32);
        var treeLeafMat = standard(0x3f7d46);
        var glassMat = standard(0x11212b, { metalness: 0.6, roughness: 0.12, transparent: true, opacity: 0.9 });

        function addTree(x, z, scale) {
            var tr = new THREE.Group();
            var trunk = cylinder(0.18 * scale, 0.24 * scale, 1.9 * scale, 7, treeTrunkMat);
            trunk.position.y = 0.95 * scale;
            tr.add(trunk);
            var leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 * scale, 0), treeLeafMat);
            leaves.position.y = 2.35 * scale;
            tr.add(leaves);
            tr.position.set(x, 0, z);
            props.add(tr);
        }

        // City blocks and buildings.
        for (var bi = 0; bi < GRID - 1; bi++) {
            for (var bj = 0; bj < GRID - 1; bj++) {
                var x0 = roadCoords[bi] + ROAD / 2 + 2;
                var x1 = roadCoords[bi + 1] - ROAD / 2 - 2;
                var z0 = roadCoords[bj] + ROAD / 2 + 2;
                var z1 = roadCoords[bj + 1] - ROAD / 2 - 2;
                var isPark = Math.random() < 0.13;
                if (isPark) {
                    var park = box(x1 - x0 - 1, 0.04, z1 - z0 - 1, standard(0x6f9a5f, { roughness: 1 }));
                    park.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
                    props.add(park);
                    for (var pt = 0; pt < 5; pt++) {
                        addTree(x0 + 3 + Math.random() * (x1 - x0 - 6), z0 + 3 + Math.random() * (z1 - z0 - 6), 0.8 + Math.random() * 0.5);
                    }
                    continue;
                }
                var lotW = (x1 - x0) / 2;
                var lotD = (z1 - z0) / 2;
                for (var sx = 0; sx < 2; sx++) {
                    for (var sz = 0; sz < 2; sz++) {
                        if (Math.random() < 0.14) {
                            addTree(x0 + lotW * sx + lotW / 2, z0 + lotD * sz + lotD / 2, 0.7 + Math.random() * 0.4);
                            continue;
                        }
                        var bw = Math.max(6, lotW - 4 - Math.random() * 2);
                        var bd = Math.max(6, lotD - 4 - Math.random() * 2);
                        var bh = 7 + Math.pow(Math.random(), 1.7) * 44;
                        var cx = x0 + lotW * sx + lotW / 2;
                        var cz = z0 + lotD * sz + lotD / 2;
                        var bMat = facades[Math.floor(Math.random() * facades.length)];
                        var bmesh = box(bw, bh, bd, bMat);
                        bmesh.position.set(cx, bh / 2, cz);
                        bmesh.receiveShadow = false;
                        scene.add(bmesh);
                        buildings.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2 });
                        // Rooftop unit.
                        var roof = box(bw * 0.3, 1.4, bd * 0.3, standard(0x5a6068, { metalness: 0.3 }));
                        roof.position.set(cx, bh + 0.7, cz);
                        scene.add(roof);
                    }
                }
            }
        }

        // Streetlights at alternating intersections.
        var poleMat = standard(0x3d444c, { metalness: 0.55, roughness: 0.4 });
        var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6ad });
        for (var li = 0; li < roadCoords.length; li++) {
            for (var lj = 0; lj < roadCoords.length; lj++) {
                if ((li + lj) % 3) continue;
                var lx = roadCoords[li] + ROAD / 2 + 2.2;
                var lz = roadCoords[lj] + ROAD / 2 + 2.2;
                var pole = cylinder(0.11, 0.15, 7, 7, poleMat);
                pole.position.set(lx, 3.5, lz);
                props.add(pole);
                var arm = box(2.4, 0.14, 0.14, poleMat);
                arm.position.set(lx - 1.1, 7, lz);
                props.add(arm);
                var lamp = box(0.7, 0.16, 0.4, lampMat);
                lamp.position.set(lx - 2.2, 6.92, lz);
                props.add(lamp);
            }
        }

        // Trees along the sidewalks.
        for (var ti = 0; ti < roadCoords.length; ti++) {
            for (var tz = -half; tz <= half; tz += 40) {
                if (Math.random() < 0.36) addTree(roadCoords[ti] + ROAD / 2 + 3.4, tz + 4, 0.7 + Math.random() * 0.35);
                if (Math.random() < 0.36) addTree(roadCoords[ti] - ROAD / 2 - 3.4, tz + 12, 0.7 + Math.random() * 0.35);
            }
        }

        function buildCar(color) {
            var g = new THREE.Group();
            var bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.55, roughness: 0.26, emissive: color, emissiveIntensity: 0.03 });
            var body = box(1.86, 0.52, 4.05, bodyMat);
            body.position.y = 0.62;
            body.castShadow = true;
            g.add(body);
            var cabin = box(1.5, 0.52, 1.85, glassMat);
            cabin.position.set(0, 1.08, 0.18);
            g.add(cabin);
            var hood = box(1.7, 0.16, 1.2, bodyMat);
            hood.position.set(0, 0.9, -1.28);
            g.add(hood);
            var trimMat = standard(0x1c2026, { metalness: 0.4, roughness: 0.5 });
            var bumperF = box(1.92, 0.22, 0.24, trimMat);
            bumperF.position.set(0, 0.5, -2.02);
            g.add(bumperF);
            var bumperR = box(1.92, 0.22, 0.24, trimMat);
            bumperR.position.set(0, 0.5, 2.02);
            g.add(bumperR);
            var headMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
            [-0.62, 0.62].forEach(function (hx) {
                var hl = box(0.34, 0.15, 0.08, headMat);
                hl.position.set(hx, 0.78, -2.05);
                g.add(hl);
            });
            var tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b4f });
            [-0.62, 0.62].forEach(function (tx) {
                var tl = box(0.34, 0.14, 0.08, tailMat);
                tl.position.set(tx, 0.78, 2.05);
                g.add(tl);
            });
            var tireMat = standard(0x111318, { roughness: 0.95 });
            var wheels = [];
            [-0.94, 0.94].forEach(function (wx) {
                [-1.3, 1.3].forEach(function (wz) {
                    var w = cylinder(0.37, 0.37, 0.3, 12, tireMat);
                    w.rotation.z = Math.PI / 2;
                    w.position.set(wx, 0.38, wz);
                    g.add(w);
                    wheels.push(w);
                });
            });
            g.userData.wheels = wheels;
            g.userData.bodyMat = bodyMat;
            g.userData.tailMat = tailMat;
            return g;
        }

        // Parked cars along a few curbs.
        for (var pi = 0; pi < 12; pi++) {
            var pr = roadCoords[Math.floor(Math.random() * roadCoords.length)];
            var side = Math.random() < 0.5 ? -1 : 1;
            var along = (Math.random() - 0.5) * (half * 2 - 30);
            var parked = buildCar([0xffffff, 0x223344, 0xb91c1c, 0x2d6a4f, 0xd4a373, 0x6b7280][pi % 6]);
            parked.position.set(pr + side * (ROAD / 2 - 1.3), 0, along);
            parked.rotation.y = Math.PI / 2;
            scene.add(parked);
        }

        var player = buildCar(carColor);
        scene.add(player);
        var px = 0, pz = 0, heading = 0, speed = 0;
        var steerSmooth = 0, throttleSmooth = 0, brakeSmooth = 0, driven = 0, cityHudT = 0;
        var maxSpeed = cityTop;
        player.position.set(px, 0, pz);

        camera.fov = 64;
        camera.updateProjectionMatrix();
        camera.position.set(px, 4.6, pz + 10);
        camera.lookAt(px, 1.1, pz - 6);

        function blocked(x, z) {
            if (Math.abs(x) > BOUND || Math.abs(z) > BOUND) return true;
            for (var i = 0; i < buildings.length; i++) {
                var b = buildings[i];
                if (x > b.minX - 1.15 && x < b.maxX + 1.15 && z > b.minZ - 1.15 && z < b.maxZ + 1.15) return true;
            }
            return false;
        }

        function update(dt) {
            dt = Math.min(dt, 0.05);
            var throttleTarget = input.up ? 1 : 0;
            var brakeTarget = input.brake ? 1 : 0;
            throttleSmooth += (throttleTarget - throttleSmooth) * Math.min(1, dt * 5.5);
            brakeSmooth += (brakeTarget - brakeSmooth) * Math.min(1, dt * 7.5);

            var steerTarget = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            if (input.pointerActive) steerTarget = Math.max(-1, Math.min(1, input.pointerX * 1.25));
            steerSmooth += (steerTarget - steerSmooth) * Math.min(1, dt * 8);

            if (speed > 0.4) {
                var turn = 1.9 * Math.min(1, speed / 10) * (1 - 0.7 * Math.min(1, speed / Math.max(1, maxSpeed)));
                heading -= steerSmooth * turn * dt;
            }

            var nitro = !!(input.nitro && throttleSmooth > 0.2);
            var targetTop = maxSpeed * (nitro ? 1.32 : 1);
            if (throttleSmooth > 0.01) {
                speed += (cityAccel * throttleSmooth * (nitro ? 1.55 : 1) - speed * 0.045) * dt;
            } else {
                speed -= 3.2 * dt;
            }
            if (brakeSmooth > 0.01) speed -= Math.max(32, cityAccel * 1.6) * brakeSmooth * dt;
            speed = Math.max(0, Math.min(targetTop, speed));

            var dx = -Math.sin(heading) * speed * dt;
            var dz = -Math.cos(heading) * speed * dt;
            var oldX = px, oldZ = pz;
            var nx = px + dx;
            if (!blocked(nx, pz)) px = nx;
            var nz = pz + dz;
            if (!blocked(px, nz)) pz = nz;
            var moved = Math.sqrt((px - oldX) * (px - oldX) + (pz - oldZ) * (pz - oldZ));
            if (moved < speed * dt * 0.35 && speed > 4) speed *= 0.4;
            driven += moved;

            player.position.x = px;
            player.position.z = pz;
            player.rotation.y = heading;
            player.rotation.z = -steerSmooth * 0.055 * Math.min(1, speed / 20);
            player.rotation.x = 0;
            var wheels = player.userData.wheels || [];
            for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x -= speed * dt * 2.4;
            if (player.userData.tailMat) player.userData.tailMat.color.setHex(brakeSmooth > 0.15 ? 0xff2438 : 0x5a1018);

            var back = 9.5 + speed * 0.07;
            var tx = px + Math.sin(heading) * back;
            var tz = pz + Math.cos(heading) * back;
            camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
            camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
            camera.position.y += ((4.6 + speed * 0.025) - camera.position.y) * Math.min(1, dt * 4);
            camera.lookAt(px - Math.sin(heading) * 8, 1.1, pz - Math.cos(heading) * 8);
            var targetFov = 62 + Math.min(12, speed * 0.18);
            camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
            camera.updateProjectionMatrix();

            cityHudT -= dt;
            if (cityHudT <= 0) {
                cityHudT = 0.1;
                setPillText('g3dExtra', 'CITY · ' + Math.round(speed * 2.23694) + ' MPH');
            }
            var throttleFill = document.getElementById('g3dThrottleFill');
            if (throttleFill) throttleFill.style.height = Math.round(throttleSmooth * 100) + '%';
            var brakeFill = document.getElementById('g3dBrakeFill');
            if (brakeFill) brakeFill.style.height = Math.round(brakeSmooth * 100) + '%';
        }

        return {
            over: false,
            update: update,
            getCoins: function () { return 0; },
            getState: function () {
                return { x: px, z: pz, heading: heading, speed: speed, driven: driven, city: true };
            }
        };
    }

    /* ---------------- Dead Coast: 10 km run ---------------- */
    function createDeadCoast(ctx) {
        var scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
        scene.background = new THREE.Color(0x33202a);
        scene.fog = new THREE.FogExp2(0x3d2630, 0.018);
        if (renderer) renderer.shadowMap.enabled = false;

        scene.add(new THREE.HemisphereLight(0xffb48c, 0x241820, 1.2));
        var dcSun = new THREE.DirectionalLight(0xffa070, 2.1);
        dcSun.position.set(-55, 46, 24);
        scene.add(dcSun);
        var dcFill = new THREE.DirectionalLight(0x7fa8ff, 0.55);
        dcFill.position.set(40, 20, -40);
        scene.add(dcFill);

        function standard(color, options) {
            return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.78, metalness: 0.08 }, options || {}));
        }
        function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
        function cylinder(top, bottom, height, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, seg || 8), mat); }
        function canvasTexture(w, h, draw, rx, ry) {
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            draw(c.getContext('2d'), w, h);
            var t = new THREE.CanvasTexture(c);
            if (rx || ry) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
            return t;
        }
        var dcAudio = null;
        function tone(freq, duration, type, volume, endFreq) {
            try {
                if (!dcAudio) dcAudio = new (window.AudioContext || window.webkitAudioContext)();
                var now = dcAudio.currentTime;
                var osc = dcAudio.createOscillator();
                var gain = dcAudio.createGain();
                osc.type = type || 'square';
                osc.frequency.setValueAtTime(freq, now);
                if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
                gain.gain.setValueAtTime(Math.max(0.0001, volume || 0.05), now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                osc.connect(gain); gain.connect(dcAudio.destination);
                osc.start(now); osc.stop(now + duration + 0.02);
            } catch (e) {}
        }

        // Cracked coastal highway with scrolling lane markings.
        var roadTex = canvasTexture(128, 256, function (g, w, h) {
            g.fillStyle = '#2b292d'; g.fillRect(0, 0, w, h);
            g.fillStyle = 'rgba(255,255,255,0.09)';
            for (var i = 0; i < 60; i++) g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
            g.fillStyle = 'rgba(230,230,210,0.65)';
            g.fillRect(6, 0, 2, h); g.fillRect(w - 8, 0, 2, h);
            g.fillStyle = 'rgba(240,200,80,0.68)';
            for (var y = 0; y < h; y += 34) g.fillRect(w / 2 - 2, y, 4, 20);
        }, 1, 30);
        var road = new THREE.Mesh(new THREE.PlaneGeometry(12, 700), standard(0xffffff, { map: roadTex, roughness: 0.95 }));
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0, -335);
        scene.add(road);

        var dirt = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), standard(0x6b5a44, { roughness: 1 }));
        dirt.rotation.x = -Math.PI / 2;
        dirt.position.set(0, -0.03, -300);
        scene.add(dirt);

        var car = new THREE.Group();
        var bodyMat = standard(0x9e2a2b, { metalness: 0.45, roughness: 0.35 });
        var body = box(1.95, 0.58, 4.15, bodyMat); body.position.y = 0.66; car.add(body);
        var cabin = box(1.55, 0.55, 1.9, standard(0x16222b, { metalness: 0.55, roughness: 0.14, transparent: true, opacity: 0.9 }));
        cabin.position.set(0, 1.12, 0.16); car.add(cabin);
        var trim = standard(0x1a1b1e, { metalness: 0.35, roughness: 0.6 });
        var bumperF = box(2.0, 0.24, 0.26, trim); bumperF.position.set(0, 0.5, -2.08); car.add(bumperF);
        var bumperR = box(2.0, 0.24, 0.26, trim); bumperR.position.set(0, 0.5, 2.08); car.add(bumperR);
        var rack = box(1.5, 0.1, 1.5, standard(0x3a3a3a, { metalness: 0.5 })); rack.position.set(0, 1.45, 0.1); car.add(rack);
        var jerry = box(0.45, 0.5, 0.3, standard(0xc0392b)); jerry.position.set(-0.4, 1.72, 0.2); car.add(jerry);
        var cooler = box(0.65, 0.32, 0.45, standard(0x2e86c1)); cooler.position.set(0.45, 1.62, 0.2); car.add(cooler);
        var headMat = new THREE.MeshBasicMaterial({ color: 0xffe8b0 });
        [-0.66, 0.66].forEach(function (hx) {
            var hl = box(0.36, 0.16, 0.08, headMat); hl.position.set(hx, 0.8, -2.1); car.add(hl);
        });
        var tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b4f });
        [-0.66, 0.66].forEach(function (tx) {
            var tl = box(0.36, 0.15, 0.08, tailMat); tl.position.set(tx, 0.8, 2.1); car.add(tl);
        });
        var tireMat = standard(0x121316, { roughness: 1 });
        var dcWheels = [];
        [-0.98, 0.98].forEach(function (wx) {
            [-1.32, 1.32].forEach(function (wz) {
                var w = cylinder(0.4, 0.4, 0.32, 10, tireMat);
                w.rotation.z = Math.PI / 2; w.position.set(wx, 0.4, wz);
                car.add(w); dcWheels.push(w);
            });
        });
        var dcWheel = new THREE.Group();
        var dcWheelMat = standard(0x14171b, { metalness: 0.45, roughness: 0.45 });
        dcWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.026, 8, 20), dcWheelMat));
        var dcHub = new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 8), standard(0x2a2f36, { metalness: 0.6, roughness: 0.3 }));
        dcWheel.add(dcHub);
        [-1, 1].forEach(function (ds) {
            var sp = box(0.15, 0.022, 0.022, dcWheelMat);
            sp.position.x = ds * 0.075;
            dcWheel.add(sp);
        });
        var dcSpoke = box(0.022, 0.15, 0.022, dcWheelMat);
        dcSpoke.position.y = -0.075;
        dcWheel.add(dcSpoke);
        dcWheel.position.set(0, 0.82, -0.5);
        dcWheel.scale.setScalar(0.8);
        dcWheel.rotation.x = -0.32;
        dcWheel.visible = false;
        car.add(dcWheel);
        scene.add(car);

        // Scrolling roadside props.
        var props = [];
        var woodMat = standard(0x4a3524);
        var rockMat = standard(0x5a4a3d, { roughness: 1 });
        var wreckMat = standard(0x6d4b3d, { metalness: 0.35, roughness: 0.7 });
        var barrelMat = standard(0x8a3a24, { metalness: 0.4, roughness: 0.6 });

        function makeDeadTree() {
            var g = new THREE.Group();
            var trunk = cylinder(0.14, 0.24, 3.2, 6, woodMat); trunk.position.y = 1.6; g.add(trunk);
            for (var i = 0; i < 4; i++) {
                var br = box(0.1, 0.1, 1.4 + Math.random(), woodMat);
                br.position.set(0, 2 + i * 0.35, 0.4);
                br.rotation.z = (Math.random() - 0.5) * 1.4;
                br.rotation.x = (Math.random() - 0.5) * 0.8;
                g.add(br);
            }
            return g;
        }
        function makeWreck() {
            var g = new THREE.Group();
            var b = box(1.8, 0.55, 3.7, wreckMat); b.position.y = 0.45; g.add(b);
            var c = box(1.4, 0.4, 1.5, standard(0x3a2c26)); c.position.set(0, 0.9, 0.1); c.rotation.z = 0.18; g.add(c);
            var rust = box(0.3, 0.2, 0.5, standard(0x8a4a2a)); rust.position.set(0.7, 0.7, -0.9); g.add(rust);
            g.rotation.z = (Math.random() - 0.5) * 0.18;
            return g;
        }
        function makeBarrel() {
            var g = new THREE.Group();
            var b = cylinder(0.38, 0.42, 1.05, 10, barrelMat); b.position.y = 0.52; g.add(b);
            var stripe = cylinder(0.4, 0.4, 0.14, 10, standard(0xe0b020)); stripe.position.y = 0.62; g.add(stripe);
            return g;
        }
        function makeBuilding() {
            var g = new THREE.Group();
            var h = 5 + Math.random() * 9;
            var b = box(4 + Math.random() * 5, h, 4 + Math.random() * 5, standard(0x51423c, { roughness: 0.95 }));
            b.position.y = h / 2; g.add(b);
            var win = box(1.2, 1.2, 0.1, standard(0x1a1414)); win.position.set(0, h * 0.6, 2.4); g.add(win);
            return g;
        }

        function addProp(kind, dist, x) {
            var mesh = kind === 'tree' ? makeDeadTree() : kind === 'wreck' ? makeWreck() : kind === 'barrel' ? makeBarrel() : kind === 'building' ? makeBuilding() : new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + Math.random() * 1.2, 0), rockMat);
            mesh.position.set(x, 0, -dist);
            scene.add(mesh);
            props.push({ mesh: mesh, dist: dist, x: x, solid: kind === 'wreck' || kind === 'barrel', hitT: 0 });
        }
        for (var pi = 0; pi < 34; pi++) {
            var pk = pi % 7 === 0 ? 'wreck' : pi % 5 === 0 ? 'barrel' : pi % 4 === 0 ? 'building' : pi % 3 === 0 ? 'tree' : 'rock';
            var px = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 16);
            addProp(pk, 30 + Math.random() * 660, px);
        }

        // Pickups.
        function makePickupMesh(type) {
            if (type === 'food') {
                var g = new THREE.Group();
                g.add(box(0.5, 0.42, 0.5, standard(0x3fa34d, { emissive: 0x145a20, emissiveIntensity: 0.5 })));
                g.add(box(0.16, 0.16, 0.52, standard(0xf0e6c8)));
                return g;
            }
            if (type === 'water') {
                return cylinder(0.22, 0.26, 0.72, 10, standard(0x2e86c1, { emissive: 0x0a3a66, emissiveIntensity: 0.55, metalness: 0.4 }));
            }
            if (type === 'fuel') {
                var f = new THREE.Group();
                f.add(box(0.5, 0.62, 0.32, standard(0xb03a2e, { emissive: 0x4a100a, emissiveIntensity: 0.45 })));
                f.add(box(0.18, 0.12, 0.36, standard(0x222222)));
                return f;
            }
            var p = new THREE.Group();
            p.add(box(0.62, 0.62, 0.62, standard(0xffc400, { emissive: 0x7a5200, emissiveIntensity: 0.7, metalness: 0.5 })));
            var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
            ring.rotation.x = Math.PI / 2; p.add(ring);
            p.userData.ring = ring;
            return p;
        }
        var pickups = [];
        function spawnPickup(type, dist, x) {
            var mesh = makePickupMesh(type);
            mesh.position.set(x, 0.75, -dist);
            scene.add(mesh);
            pickups.push({ type: type, mesh: mesh, dist: dist, x: x });
        }
        var laneXs = [-3.4, 0, 3.4];

        // Roadside fuel stations — stop, get out, and scavenge supplies.
        var dcStations = [];
        var stationDistances = [700, 1400, 2100, 2800, 3500, 4200, 4900, 5600, 6300, 7000, 7700, 8400, 9100, 9700];
        var stationOpen = false;
        var activeStation = null;
        var nearStation = null;

        function makeStationMesh(side) {
            var g = new THREE.Group();
            var pad = box(24, 0.06, 16, standard(0x36383c, { roughness: 0.95 }));
            pad.position.y = 0.03; g.add(pad);
            var roofMat = standard(0xe8e2d4, { metalness: 0.3, roughness: 0.5 });
            var roof = box(17, 0.5, 9, roofMat);
            roof.position.set(0, 4.5, 0); g.add(roof);
            var stripe = box(17.2, 0.22, 9.2, new THREE.MeshBasicMaterial({ color: 0xffc400 }));
            stripe.position.set(0, 4.22, 0); g.add(stripe);
            var poleMat = standard(0x6c7278, { metalness: 0.5, roughness: 0.4 });
            [[-7, -3], [7, -3], [-7, 3], [7, 3]].forEach(function (pp) {
                var pole = cylinder(0.16, 0.2, 4.3, 8, poleMat);
                pole.position.set(pp[0], 2.15, pp[1]); g.add(pole);
            });
            var pumpMat = standard(0xcfd4d8, { metalness: 0.45, roughness: 0.4 });
            [-4.5, 0].forEach(function (px) {
                var pump = box(1.4, 2.2, 1.0, pumpMat);
                pump.position.set(side * px, 1.1, 0); g.add(pump);
                var screen = box(0.7, 0.5, 0.06, new THREE.MeshBasicMaterial({ color: 0x2ff6ff }));
                screen.position.set(side * px, 1.5, -0.54); g.add(screen);
                var hose = box(0.06, 1.2, 0.06, standard(0x1a1a1a));
                hose.position.set(side * px + 0.75, 1.0, 0); g.add(hose);
            });
            var shop = box(6, 3.8, 5, standard(0x5f6a70, { roughness: 0.85 }));
            shop.position.set(side * 8.5, 1.9, 0); g.add(shop);
            var shopGlass = box(3.4, 1.4, 0.1, new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
            shopGlass.position.set(side * 8.5, 2.2, -2.53); g.add(shopGlass);
            var signTex = canvasTexture(256, 96, function (g2, w, h) {
                g2.fillStyle = '#c0392b'; g2.fillRect(0, 0, w, h);
                g2.strokeStyle = '#ffe6a8'; g2.lineWidth = 6; g2.strokeRect(5, 5, w - 10, h - 10);
                g2.fillStyle = '#fff4d0'; g2.font = 'bold 48px Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
                g2.fillText('FUEL', w / 2, h / 2);
            });
            var sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
            sign.position.set(side * -9, 4.0, -6.5); g.add(sign);
            var signPole = box(0.18, 4.5, 0.18, poleMat);
            signPole.position.set(side * -9, 2.25, -6.5); g.add(signPole);
            var glow = new THREE.Mesh(new THREE.PlaneGeometry(17, 9), new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
            glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.08, 0); g.add(glow);
            return g;
        }
        for (var sti = 0; sti < stationDistances.length; sti++) {
            var stSide = sti % 2 === 0 ? 1 : -1;
            var stGroup = makeStationMesh(stSide);
            stGroup.position.set(stSide * 15, 0, -stationDistances[sti]);
            scene.add(stGroup);
            dcStations.push({ dist: stationDistances[sti], side: stSide, group: stGroup, cleared: false, partLooted: false });
        }

        var onFoot = false;
        var footX = 0, footZ = 0, footYaw = 0, footShotCd = 0;
        var footAmmo = 12, footReserve = 48, footMeleeCd = 0, footPitch = 0;
        var footZombies = [];
        var footLoot = [];

        function dcFootHud() {
            var dEl = document.getElementById('dcDistance');
            if (dEl) dEl.textContent = (distance / 1000).toFixed(2) + ' / 10 km';
            var pEl = document.getElementById('dcProgress');
            if (pEl) pEl.style.width = Math.min(100, distance / 10000 * 100) + '%';
            var fEl = document.getElementById('dcFood'); if (fEl) fEl.style.width = food + '%';
            var wEl = document.getElementById('dcWater'); if (wEl) wEl.style.width = water + '%';
            var fuEl = document.getElementById('dcFuel'); if (fuEl) fuEl.style.width = fuel + '%';
            var hEl = document.getElementById('dcHealth'); if (hEl) hEl.style.width = health + '%';
            var partEl = document.getElementById('dcPart'); if (partEl) partEl.textContent = partLabel();
            var zEl = document.getElementById('dcZombies'); if (zEl) zEl.textContent = 'ZOMBIES ' + zombiesHit;
        }

        var DC_PRICES = { fuel: 30, food: 20, water: 20, part: 150 };
        function dcFootLootPickup(type) {
            var price = DC_PRICES[type] || 0;
            var spend = (typeof window.LessFunSpendCoins === 'function') ? window.LessFunSpendCoins(price) : true;
            if (!spend) {
                toast(type.toUpperCase() + ' · NEED ' + price + ' COINS');
                tone(120, 0.12, 'square', 0.05, 80);
                return false;
            }
            if (type === 'fuel') { fuel = Math.min(100, fuel + 58); toast('FUEL +58 · -' + price); }
            else if (type === 'food') { food = Math.min(100, food + 44); toast('FOOD +44 · -' + price); }
            else if (type === 'water') { water = Math.min(100, water + 44); toast('WATER +44 · -' + price); }
            else if (type === 'part') { applyPart(); if (activeStation) activeStation.partLooted = true; toast('CAR PART · -' + price); }
            tone(660, 0.1, 'square', 0.045, 990);
            dcFootHud();
            return true;
        }

        function dcStartOnFoot(st) {
            if (onFoot || !st) return;
            onFoot = true;
            stationOpen = false;
            activeStation = st;
            speed = 0;
            footX = carX;
            footZ = 0;
            footYaw = st.side > 0 ? -Math.PI / 2 : Math.PI / 2;
            footShotCd = 0;
            var cx = st.side * 15;
            for (var fi2 = 0; fi2 < 8; fi2++) {
                var mesh = makeZombie();
                var zx = cx + (Math.random() - 0.5) * 26;
                var zz = -9 + Math.random() * 18;
                mesh.position.set(zx, 0, zz);
                scene.add(mesh);
                footZombies.push({ mesh: mesh, x: zx, z: zz, alive: true, speed: 1.5 + Math.random() * 1.8, phase: Math.random() * 6.28 });
            }
            var loot = [['fuel', cx - 5, -3], ['food', cx + 3, -2], ['water', cx + 2, 3]];
            if (!st.partLooted && Math.random() < 0.45) loot.push(['part', cx + 7, -4]);
            for (var li2 = 0; li2 < loot.length; li2++) {
                var lp = loot[li2];
                var lm = makePickupMesh(lp[0]);
                lm.position.set(lp[1], 0.78, lp[2]);
                scene.add(lm);
                footLoot.push({ type: lp[0], mesh: lm, x: lp[1], z: lp[2], taken: false });
            }
            var cross = document.getElementById('dcFootCrosshair');
            if (cross) cross.style.display = 'block';
            var hint = document.getElementById('dcFootHint');
            if (hint) hint.style.display = 'block';
            var prompt = document.getElementById('dcStationPrompt');
            if (prompt) prompt.style.display = 'none';
            toast('GET OUT · CLICK TO SHOOT');
            tone(300, 0.18, 'sawtooth', 0.06, 140);
        }

        function dcEndOnFoot() {
            if (!onFoot) return;
            onFoot = false;
            for (var fz = 0; fz < footZombies.length; fz++) scene.remove(footZombies[fz].mesh);
            for (var fl = 0; fl < footLoot.length; fl++) scene.remove(footLoot[fl].mesh);
            footZombies = [];
            footLoot = [];
            if (activeStation) activeStation.cleared = true;
            var cross = document.getElementById('dcFootCrosshair');
            if (cross) cross.style.display = 'none';
            var hint = document.getElementById('dcFootHint');
            if (hint) hint.style.display = 'none';
            var prompt = document.getElementById('dcStationPrompt');
            if (prompt) prompt.style.display = 'none';
            toast('BACK IN THE CAR');
            tone(240, 0.14, 'square', 0.05, 380);
            dcFootHud();
        }

        function updateOnFoot(dt) {
            footShotCd = Math.max(0, footShotCd - dt);
            footMeleeCd = Math.max(0, footMeleeCd - dt);
            if (input.reload) {
                input.reload = false;
                if (footAmmo < 12 && footReserve > 0) {
                    var need = 12 - footAmmo;
                    var take = Math.min(need, footReserve);
                    footAmmo += take;
                    footReserve -= take;
                    toast('RELOADED · ' + footAmmo + ' / ' + footReserve);
                    tone(520, 0.1, 'square', 0.045, 760);
                }
            }
            if (input.melee) {
                input.melee = false;
                if (footMeleeCd <= 0) {
                    footMeleeCd = 0.42;
                    var punched = false;
                    for (var mz = 0; mz < footZombies.length; mz++) {
                        var mzz = footZombies[mz];
                        if (!mzz.alive) continue;
                        var mdx = mzz.x - footX, mdz = mzz.z - footZ;
                        if (mdx * mdx + mdz * mdz < 5.2) {
                            mzz.alive = false;
                            mzz.mesh.visible = false;
                            zombiesHit++;
                            spawnBlood(mzz.x, mzz.z);
                            toast('PUNCH · ZOMBIE DOWN');
                            tone(180, 0.12, 'sawtooth', 0.08, 70);
                            punched = true;
                            break;
                        }
                    }
                    if (!punched) tone(90, 0.06, 'square', 0.03, 60);
                }
            }
            var turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
            if (input.pointerActive && document.pointerLockElement !== dcCanvas) footYaw = -input.pointerX * 1.45;
            else footYaw += turn * 2.2 * dt;
            var fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
            var fx = -Math.sin(footYaw), fz = -Math.cos(footYaw);
            if (fwd) {
                footX += fx * fwd * 6.5 * dt;
                footZ += fz * fwd * 6.5 * dt;
            }
            var cx = activeStation ? activeStation.side * 15 : 0;
            footX = Math.max(cx - 20, Math.min(cx + 20, footX));
            footZ = Math.max(-13, Math.min(13, footZ));

            for (var zi3 = 0; zi3 < footZombies.length; zi3++) {
                var fzb = footZombies[zi3];
                if (!fzb.alive) continue;
                var zdx = footX - fzb.x, zdz = footZ - fzb.z;
                var zdist = Math.sqrt(zdx * zdx + zdz * zdz);
                if (zdist > 1.3) {
                    fzb.x += (zdx / zdist) * fzb.speed * dt;
                    fzb.z += (zdz / zdist) * fzb.speed * dt;
                } else {
                    health = Math.max(0, health - 10 * dt);
                }
                fzb.mesh.position.set(fzb.x, 0, fzb.z);
                fzb.mesh.rotation.y = Math.atan2(footX - fzb.x, footZ - fzb.z);
                var swing = Math.sin(elapsed * 7 + fzb.phase) * 0.6;
                if (fzb.mesh.userData.arms) {
                    fzb.mesh.userData.arms[0].rotation.x = -1.2 + swing;
                    fzb.mesh.userData.arms[1].rotation.x = -1.2 - swing;
                }
                if (fzb.mesh.userData.legs) {
                    fzb.mesh.userData.legs[0].rotation.x = swing * 0.7;
                    fzb.mesh.userData.legs[1].rotation.x = -swing * 0.7;
                }
            }

            if (input.tapQueued) {
                input.tapQueued = false;
                if (footShotCd <= 0) {
                    footShotCd = 0.24;
                    if (footAmmo <= 0) {
                        toast('EMPTY · PRESS R TO RELOAD');
                        tone(90, 0.08, 'square', 0.035, 60);
                    }
                    if (footAmmo > 0) {
                    footAmmo--;
                    var best = null, bestDist = 1e9;
                    for (var si3 = 0; si3 < footZombies.length; si3++) {
                        var tz = footZombies[si3];
                        if (!tz.alive) continue;
                        var ddx = tz.x - footX, ddz = tz.z - footZ;
                        var dd = Math.sqrt(ddx * ddx + ddz * ddz);
                        if (dd > 38 || dd < 0.01) continue;
                        var dot = (ddx * fx + ddz * fz) / dd;
                        if (dot < 0.7) continue;
                        if (dd < bestDist) { bestDist = dd; best = tz; }
                    }
                    if (best) {
                        best.alive = false;
                        best.mesh.visible = false;
                        zombiesHit++;
                        spawnBlood(best.x, best.z);
                        toast('ZOMBIE HIT +1');
                        tone(150, 0.16, 'sawtooth', 0.09, 60);
                    } else {
                        tone(110, 0.06, 'square', 0.035, 70);
                    }
                    }
                }
            }

            for (var li3 = 0; li3 < footLoot.length; li3++) {
                var lootItem = footLoot[li3];
                if (lootItem.taken) continue;
                lootItem.mesh.rotation.y += dt * 1.8;
                lootItem.mesh.position.y = 0.78 + Math.sin(elapsed * 3 + li3) * 0.08;
                var ldx = footX - lootItem.x, ldz = footZ - lootItem.z;
                if (ldx * ldx + ldz * ldz < 2.6) {
                    if (dcFootLootPickup(lootItem.type)) {
                        lootItem.taken = true;
                        lootItem.mesh.visible = false;
                        scene.remove(lootItem.mesh);
                    }
                }
            }

            var carDist = Math.sqrt((footX - carX) * (footX - carX) + footZ * footZ);
            var promptEl = document.getElementById('dcStationPrompt');
            if (promptEl) {
                promptEl.textContent = 'E · BACK TO CAR';
                promptEl.style.display = carDist < 3.4 ? 'block' : 'none';
            }
            if (carDist < 3.4 && input.interact) {
                input.interact = false;
                dcEndOnFoot();
                return;
            }

            camera.position.set(footX, 1.55, footZ);
            camera.lookAt(footX + fx * 12, 1.38 + footPitch * 8, footZ + fz * 12);
            camera.fov = 72;
            camera.updateProjectionMatrix();

            if (health <= 0) {
                endGame(Math.round(distance / 5) + partsFound.length * 500 + zombiesHit * 120);
                return;
            }
            dcFootHud();
        }

        // Zombies wander onto the road. Fast hits splatter them; slowing down
        // lets them claw at the car.
        var dcZombies = [];
        var zombiesHit = 0;
        var zSkin = standard(0x7d9464, { roughness: 0.9 });
        var zShirt = standard(0x4b3b34, { roughness: 0.95 });
        var zPants = standard(0x2b2f36, { roughness: 0.95 });
        function makeZombie() {
            var g = new THREE.Group();
            var torso = box(0.42, 0.58, 0.26, zShirt); torso.position.y = 0.98; g.add(torso);
            var hips = box(0.36, 0.2, 0.24, zPants); hips.position.y = 0.6; g.add(hips);
            var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), zSkin); head.position.y = 1.42; g.add(head);
            var armL = new THREE.Group();
            var amL = box(0.11, 0.55, 0.12, zSkin); amL.position.y = -0.26; armL.add(amL);
            armL.position.set(-0.29, 1.22, 0); armL.rotation.x = -1.2; g.add(armL);
            var armR = new THREE.Group();
            var amR = box(0.11, 0.55, 0.12, zSkin); amR.position.y = -0.26; armR.add(amR);
            armR.position.set(0.29, 1.22, 0); armR.rotation.x = -1.2; g.add(armR);
            var legL = new THREE.Group();
            var lmL = box(0.14, 0.58, 0.15, zPants); lmL.position.y = -0.29; legL.add(lmL);
            legL.position.set(-0.12, 0.6, 0); g.add(legL);
            var legR = new THREE.Group();
            var lmR = box(0.14, 0.58, 0.15, zPants); lmR.position.y = -0.29; legR.add(lmR);
            legR.position.set(0.12, 0.6, 0); g.add(legR);
            g.userData.arms = [armL, armR];
            g.userData.legs = [legL, legR];
            return g;
        }
        for (var zi = 0; zi < 26; zi++) {
            var zm = makeZombie();
            var zdist = 60 + Math.random() * 620;
            var zx = (Math.random() - 0.5) * 8;
            zm.position.set(zx, 0, -zdist);
            scene.add(zm);
            dcZombies.push({ mesh: zm, dist: zdist, x: zx, speed: 1.2 + Math.random() * 1.8, dead: false, phase: Math.random() * 6.28 });
        }

        var bloodPool = [];
        var bloodMat = new THREE.MeshBasicMaterial({ color: 0x9b111e });
        for (var bpi = 0; bpi < 18; bpi++) {
            var bp = box(0.14, 0.14, 0.14, bloodMat);
            bp.visible = false;
            scene.add(bp);
            bloodPool.push({ mesh: bp, life: 0, vx: 0, vy: 0, vz: 0 });
        }
        function spawnBlood(x, z) {
            for (var bi = 0; bi < bloodPool.length; bi++) {
                var bl = bloodPool[bi];
                if (bl.life > 0) continue;
                bl.life = 0.75;
                bl.mesh.visible = true;
                bl.mesh.position.set(x + (Math.random() - 0.5) * 0.5, 1.1, z);
                bl.vx = (Math.random() - 0.5) * 7;
                bl.vy = 4 + Math.random() * 5;
                bl.vz = (Math.random() - 0.5) * 7;
                break;
            }
        }

        var dcCanvas = renderer && renderer.domElement;
        var dcPointerLocked = false;
        if (dcCanvas) {
            var dcLockHandler = function () {
                if (document.pointerLockElement !== dcCanvas && dcCanvas.requestPointerLock) {
                    try { dcCanvas.requestPointerLock(); } catch (e) {}
                }
                input.pointerActive = false;
                input.pointerX = 0;
                input.pointerY = 0;
            };
            dcCanvas.addEventListener('click', dcLockHandler);
            addCleanup(function () { dcCanvas.removeEventListener('click', dcLockHandler); });
            var dcLockChange = function () { dcPointerLocked = document.pointerLockElement === dcCanvas; };
            document.addEventListener('pointerlockchange', dcLockChange);
            addCleanup(function () { document.removeEventListener('pointerlockchange', dcLockChange); });
            var dcLockMove = function (e) {
                if (document.pointerLockElement !== dcCanvas || !onFoot) return;
                var dmx = Math.max(-55, Math.min(55, e.movementX || 0));
                var dmy = Math.max(-45, Math.min(45, e.movementY || 0));
                footYaw -= dmx * 0.001;
                footPitch = Math.max(-0.55, Math.min(0.55, footPitch - dmy * 0.001));
            };
            document.addEventListener('mousemove', dcLockMove);
            addCleanup(function () { document.removeEventListener('mousemove', dcLockMove); });
        }

        var carX = 0, vx = 0, speed = 0, distance = 0;
        var food = 100, water = 100, fuel = 100, health = 100;
        var throttleSmooth = 0, brakeSmooth = 0, steerSmooth = 0;
        var maxSpeed = 38, accel = 13, brakePower = 26, grip = 1.0, armor = 0, fuelUse = 1;
        var partsFound = [];
        var elapsed = 0, hudT = 0, toastT = 0, finished = false;
        var dcCameraMode = 0;

        function dcStationStatus() {
            var st = activeStation;
            if (!st) return;
            var meta = document.getElementById('dcStationMeta');
            if (meta) meta.textContent = 'Station ' + (dcStations.indexOf(st) + 1) + ' of ' + dcStations.length + ' · ' + (distance / 1000).toFixed(2) + ' km';
            var sf = document.getElementById('dcStFuel'); if (sf) sf.textContent = Math.round(fuel) + '%';
            var sfo = document.getElementById('dcStFood'); if (sfo) sfo.textContent = Math.round(food) + '%';
            var sw = document.getElementById('dcStWater'); if (sw) sw.textContent = Math.round(water) + '%';
            var rf = document.getElementById('dcStRefuel'); if (rf) { rf.disabled = st.refueled; rf.textContent = st.refueled ? 'Tank already filled' : 'Refuel +60'; }
            var fd = document.getElementById('dcStFoodBtn'); if (fd) { fd.disabled = st.foodLooted; fd.textContent = st.foodLooted ? 'Food taken' : 'Take food +40'; }
            var wt = document.getElementById('dcStWaterBtn'); if (wt) { wt.disabled = st.waterLooted; wt.textContent = st.waterLooted ? 'Water taken' : 'Take water +40'; }
            var pt = document.getElementById('dcStPart'); if (pt) { pt.disabled = st.partLooted; pt.textContent = st.partLooted ? 'No parts left' : 'Search for a car part'; }
        }

        function dcOpenStation(st) {
            if (!st || stationOpen) return;
            stationOpen = true;
            activeStation = st;
            speed = 0;
            var panel = document.getElementById('dcStationPanel');
            if (panel) panel.style.display = 'flex';
            var promptEl = document.getElementById('dcStationPrompt');
            if (promptEl) promptEl.style.display = 'none';
            dcStationStatus();
            tone(520, 0.12, 'square', 0.05, 760);
        }

        function dcCloseStation() {
            stationOpen = false;
            var panel = document.getElementById('dcStationPanel');
            if (panel) panel.style.display = 'none';
        }

        (function wireStationButtons() {
            var refuel = document.getElementById('dcStRefuel');
            if (refuel) refuel.onclick = function () { if (activeStation && !activeStation.refueled) { activeStation.refueled = true; fuel = Math.min(100, fuel + 60); toast('FUEL +60'); dcStationStatus(); } };
            var foodBtn = document.getElementById('dcStFoodBtn');
            if (foodBtn) foodBtn.onclick = function () { if (activeStation && !activeStation.foodLooted) { activeStation.foodLooted = true; food = Math.min(100, food + 40); toast('FOOD +40'); dcStationStatus(); } };
            var waterBtn = document.getElementById('dcStWaterBtn');
            if (waterBtn) waterBtn.onclick = function () { if (activeStation && !activeStation.waterLooted) { activeStation.waterLooted = true; water = Math.min(100, water + 40); toast('WATER +40'); dcStationStatus(); } };
            var partBtn = document.getElementById('dcStPart');
            if (partBtn) partBtn.onclick = function () { if (activeStation && !activeStation.partLooted) { activeStation.partLooted = true; applyPart(); dcStationStatus(); } };
            var closeBtn = document.getElementById('dcStClose');
            if (closeBtn) closeBtn.onclick = dcCloseStation;
            var promptEl = document.getElementById('dcStationPrompt');
            if (promptEl) promptEl.onclick = function () { if (onFoot) dcEndOnFoot(); else if (nearStation && !nearStation.cleared) dcStartOnFoot(nearStation); };
        })();

        function partLabel() {
            return partsFound.length ? partsFound.join(' · ') : 'Stock Parts';
        }
        function toast(text) {
            var el = document.getElementById('dcToast');
            if (el) el.textContent = text;
            toastT = 2.4;
        }
        function applyPart() {
            var kinds = ['Engine', 'Tires', 'Suspension', 'Fuel Tank', 'Brakes'];
            var kind = kinds[Math.floor(Math.random() * kinds.length)];
            partsFound.push(kind);
            if (kind === 'Engine') { maxSpeed += 4.5; accel += 2; }
            else if (kind === 'Tires') { grip += 0.18; }
            else if (kind === 'Suspension') { armor = Math.min(0.6, armor + 0.14); }
            else if (kind === 'Fuel Tank') { fuelUse *= 0.82; }
            else if (kind === 'Brakes') { brakePower += 5; }
            toast('FOUND ' + kind.toUpperCase() + ' PART');
            tone(520, 0.18, 'square', 0.06, 880);
            tone(880, 0.2, 'square', 0.05, 1180);
        }
        function respawnPickup(p) {
            if (p.type === 'part') { p.dist = distance + 1500 + Math.random() * 900; }
            else { p.dist = distance + 240 + Math.random() * 260; }
            p.x = laneXs[Math.floor(Math.random() * laneXs.length)];
        }

        function update(dt) {
            dt = Math.min(dt, 0.05);
            elapsed += dt;
            if (onFoot) {
                updateOnFoot(dt);
                return;
            }
            if (input.cameraCycle) {
                input.cameraCycle = false;
                dcCameraMode = (dcCameraMode + 1) % 4;
            }
            var throttleTarget = input.up ? 1 : 0;
            var brakeTarget = input.brake ? 1 : 0;
            throttleSmooth += (throttleTarget - throttleSmooth) * Math.min(1, dt * 5.5);
            brakeSmooth += (brakeTarget - brakeSmooth) * Math.min(1, dt * 7.5);
            var steerTarget = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            if (input.pointerActive) steerTarget = Math.max(-1, Math.min(1, input.pointerX * 1.4));
            steerSmooth += (steerTarget - steerSmooth) * Math.min(1, dt * 8);

            var topNow = maxSpeed * (fuel > 0 ? 1 : 0.28);
            var reverseMax = -13;
            if (brakeSmooth > 0.01) {
                if (speed > 0.4) speed -= brakePower * brakeSmooth * dt;
                else speed -= 9.5 * brakeSmooth * dt;
            } else if (throttleSmooth > 0.01) {
                speed += (accel * throttleSmooth - speed * 0.05) * dt;
            } else {
                speed -= 2.4 * dt;
            }
            speed = Math.max(reverseMax, Math.min(topNow, speed));
            if (Math.abs(speed) < 0.16) speed = 0;
            if (fuel <= 0) speed = Math.min(speed, 10);

            vx += steerSmooth * (8.5 * grip) * dt * Math.min(1, speed / 14);
            vx *= Math.max(0, 1 - dt * 3.2);
            carX += vx * dt;
            if (carX < -4.7) { carX = -4.7; vx *= -0.25; }
            if (carX > 4.7) { carX = 4.7; vx *= -0.25; }

            distance = Math.max(0, distance + speed * dt);

            // Hunger, water, fuel, and health.
            food = Math.max(0, food - (0.30 + Math.abs(speed) * 0.0018) * dt);
            water = Math.max(0, water - (0.36 + Math.abs(speed) * 0.0021) * dt);
            fuel = Math.max(0, fuel - (0.12 + Math.abs(speed) * 0.0065) * fuelUse * dt);
            if (food <= 0 || water <= 0) health = Math.max(0, health - 3.2 * dt);
            if (fuel <= 0) health = Math.max(0, health - 0.8 * dt);

            // Prop recycling and collision.
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                prop.mesh.position.z = -(prop.dist - distance);
                if (prop.hitT > 0) prop.hitT -= dt;
                if (prop.solid && prop.hitT <= 0 && prop.dist - distance < 3 && prop.dist - distance > -3 && Math.abs(prop.x - carX) < 1.7) {
                    prop.hitT = 1.2;
                    var dmg = 16 * (1 - armor);
                    health = Math.max(0, health - dmg);
                    speed *= 0.42;
                    toast('CRASH · -' + Math.round(dmg) + ' CAR');
                    tone(90, 0.3, 'sawtooth', 0.12, 40);
                }
                if (prop.dist - distance < -45) {
                    prop.dist = distance + 620 + Math.random() * 160;
                    prop.x = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 16);
                }
            }

            // Pickups.
            for (var k = 0; k < pickups.length; k++) {
                var p = pickups[k];
                p.mesh.position.set(p.x, 0.78 + Math.sin(elapsed * 3 + k) * 0.08, -(p.dist - distance) * -1);
                p.mesh.position.z = -(p.dist - distance);
                p.mesh.rotation.y += dt * 1.6;
                if (p.mesh.userData.ring) p.mesh.userData.ring.rotation.z += dt * 2.2;
                var rel = p.dist - distance;
                if (Math.abs(rel) < 3 && Math.abs(p.x - carX) < 1.8) {
                    if (p.type === 'food') { food = Math.min(100, food + 34); toast('FOOD +34'); }
                    else if (p.type === 'water') { water = Math.min(100, water + 38); toast('WATER +38'); }
                    else if (p.type === 'fuel') { fuel = Math.min(100, fuel + 42); toast('FUEL +42'); }
                    else applyPart();
                    tone(660, 0.1, 'square', 0.04, 990);
                    respawnPickup(p);
                }
                if (p.dist - distance < -25 && p.type !== 'part') respawnPickup(p);
            }

            // Fuel stations.
            nearStation = null;
            for (var si2 = 0; si2 < dcStations.length; si2++) {
                var stn = dcStations[si2];
                stn.group.position.z = -(stn.dist - distance);
                stn.group.visible = Math.abs(stn.dist - distance) < 90;
                if (Math.abs(stn.dist - distance) < 18) nearStation = stn;
            }
            var prompt = document.getElementById('dcStationPrompt');
            if (prompt) prompt.style.display = (!onFoot && nearStation && !nearStation.cleared && speed < 2) ? 'block' : 'none';
            if (nearStation && !nearStation.cleared && speed < 2 && input.interact && !onFoot) {
                input.interact = false;
                dcStartOnFoot(nearStation);
            }

            // Zombies.
            for (var zj = 0; zj < dcZombies.length; zj++) {
                var zb = dcZombies[zj];
                var zrel = zb.dist - distance;
                if (zb.dead || zrel < -25) {
                    zb.dead = false;
                    zb.mesh.visible = true;
                    zb.dist = distance + 180 + Math.random() * 540;
                    zb.x = (Math.random() - 0.5) * 8;
                    zb.speed = 1.2 + Math.random() * 1.8;
                    zrel = zb.dist - distance;
                }
                if (zrel < 90 && zrel > -8) {
                    var zdx = carX - zb.x;
                    zb.x += Math.sign(zdx) * Math.min(Math.abs(zdx), zb.speed * dt * 1.35);
                    zb.dist -= zb.speed * dt * 1.1;
                }
                zb.mesh.position.set(zb.x, 0, -zrel);
                zb.mesh.rotation.y = Math.atan2(carX - zb.x, 10);
                var zswing = Math.sin(elapsed * 7 + zb.phase) * 0.55;
                if (zb.mesh.userData.arms) {
                    zb.mesh.userData.arms[0].rotation.x = -1.2 + zswing;
                    zb.mesh.userData.arms[1].rotation.x = -1.2 - zswing;
                }
                if (zb.mesh.userData.legs) {
                    zb.mesh.userData.legs[0].rotation.x = zswing * 0.7;
                    zb.mesh.userData.legs[1].rotation.x = -zswing * 0.7;
                }
                if (!zb.dead && Math.abs(zrel) < 2.8 && Math.abs(zb.x - carX) < 1.7) {
                    if (speed > 8) {
                        zb.dead = true;
                        zb.mesh.visible = false;
                        zombiesHit++;
                        speed *= 0.985;
                        spawnBlood(zb.x, -zrel);
                        toast('ZOMBIE HIT +1');
                        tone(140, 0.16, 'sawtooth', 0.09, 60);
                    } else {
                        health = Math.max(0, health - 6 * dt);
                    }
                }
            }
            for (var bj = 0; bj < bloodPool.length; bj++) {
                var bld = bloodPool[bj];
                if (bld.life <= 0) continue;
                bld.life -= dt;
                bld.vy -= 11 * dt;
                bld.mesh.position.x += bld.vx * dt;
                bld.mesh.position.y += bld.vy * dt;
                bld.mesh.position.z += bld.vz * dt;
                bld.mesh.visible = bld.life > 0 && bld.mesh.position.y > 0.08;
            }

            // Car visuals.
            car.position.x = carX;
            car.rotation.y = -vx * 0.035;
            car.rotation.z = -vx * 0.02;
            for (var wi2 = 0; wi2 < dcWheels.length; wi2++) dcWheels[wi2].rotation.x -= speed * dt * 2.6;
            tailMat.color.setHex(brakeSmooth > 0.15 ? 0xff1e30 : 0x5a1018);

            // Scrolling road texture.
            roadTex.offset.y = (distance / 23.3) % 1;

            // Camera modes: chase, hood, wheel, first person.
            if (dcCameraMode === 1) {
                camera.position.x += (carX - camera.position.x) * Math.min(1, dt * 16);
                camera.position.y += (1.15 - camera.position.y) * Math.min(1, dt * 16);
                camera.position.z += (-0.9 - camera.position.z) * Math.min(1, dt * 16);
                camera.lookAt(carX, 0.95, -22);
            } else if (dcCameraMode === 2) {
                camera.position.x += ((carX + 1.1) - camera.position.x) * Math.min(1, dt * 14);
                camera.position.y += (0.5 - camera.position.y) * Math.min(1, dt * 14);
                camera.position.z += (0.9 - camera.position.z) * Math.min(1, dt * 14);
                camera.lookAt(carX, 0.7, -18);
            } else if (dcCameraMode === 3) {
                camera.position.x += (carX - camera.position.x) * Math.min(1, dt * 20);
                camera.position.y += (1.05 - camera.position.y) * Math.min(1, dt * 20);
                camera.position.z += (-0.1 - camera.position.z) * Math.min(1, dt * 20);
                var dcYaw = car.rotation.y;
                camera.lookAt(carX - Math.sin(dcYaw) * 24, 0.92, -Math.cos(dcYaw) * 24);
            } else {
                camera.position.x += (carX * 0.7 - camera.position.x) * Math.min(1, dt * 5);
                camera.position.y += (4.2 + speed * 0.02 - camera.position.y) * Math.min(1, dt * 4);
                camera.position.z += (10.4 - camera.position.z) * Math.min(1, dt * 5);
                camera.lookAt(carX * 0.85, 1.15, -5.5);
            }
            if (dcWheel) {
                dcWheel.visible = dcCameraMode === 3;
                dcWheel.rotation.z = -steerSmooth * 1.7 - vx * 0.04;
            }
            camera.fov += (((dcCameraMode === 0 ? 60 : 72) + Math.min(14, speed * 0.3)) - camera.fov) * Math.min(1, dt * 3);
            camera.updateProjectionMatrix();

            // HUD.
            hudT -= dt;
            if (hudT <= 0) {
                hudT = 0.1;
                var dEl = document.getElementById('dcDistance');
                if (dEl) dEl.textContent = (distance / 1000).toFixed(2) + ' / 10 km';
                var pEl = document.getElementById('dcProgress');
                if (pEl) pEl.style.width = Math.min(100, distance / 10000 * 100) + '%';
                var fEl = document.getElementById('dcFood'); if (fEl) fEl.style.width = food + '%';
                var wEl = document.getElementById('dcWater'); if (wEl) wEl.style.width = water + '%';
                var fuEl = document.getElementById('dcFuel'); if (fuEl) fuEl.style.width = fuel + '%';
                var hEl = document.getElementById('dcHealth'); if (hEl) hEl.style.width = health + '%';
                var partEl = document.getElementById('dcPart'); if (partEl) partEl.textContent = partLabel();
                var zEl = document.getElementById('dcZombies'); if (zEl) zEl.textContent = 'ZOMBIES ' + zombiesHit;
                setPillText('g3dExtra', 'DEAD COAST · ' + Math.round(Math.abs(speed) * 2.23694) + ' MPH' + (speed < -0.3 ? ' · R' : ''));
            }
            if (toastT > 0) {
                toastT -= dt;
                var tEl = document.getElementById('dcToast');
                if (tEl) tEl.classList.toggle('is-active', toastT > 0);
            }

            if (!finished && distance >= 10000) {
                finished = true;
                toast('YOU MADE IT · 10 KM');
                endGame(Math.round(10000 / 5) + partsFound.length * 500 + zombiesHit * 120 + Math.round(food + water + fuel));
                return;
            }
            if (health <= 0) {
                endGame(Math.round(distance / 5) + partsFound.length * 500 + zombiesHit * 120);
            }
            var throttleFill = document.getElementById('g3dThrottleFill');
            if (throttleFill) throttleFill.style.height = Math.round(throttleSmooth * 100) + '%';
            var brakeFill = document.getElementById('g3dBrakeFill');
            if (brakeFill) brakeFill.style.height = Math.round(brakeSmooth * 100) + '%';
        }

        return {
            over: false,
            update: update,
            getCoins: function () { return 0; },
            getState: function () {
                return { distance: distance, speed: speed, x: carX, food: food, water: water, fuel: fuel, health: health, parts: partsFound.slice(), zombiesHit: zombiesHit };
            }
        };
    }

    /* ---------------- Snow Rush (Christmas) ---------------- */
    function createSnowRush(ctx) {
        var scene = ctx.scene, camera = ctx.camera;
        scene.background = new THREE.Color(0x0a1630);
        scene.fog = new THREE.FogExp2(0x0d1d3a, 0.014);
        camera.position.set(0, 3.2, 8);
        camera.lookAt(0, 1, -12);

        scene.add(new THREE.AmbientLight(0x9fc8ff, 1.1));
        var moonLight = new THREE.DirectionalLight(0xcfe6ff, 1.4);
        moonLight.position.set(-8, 16, 8);
        scene.add(moonLight);
        var redGlow = new THREE.PointLight(0xff3b5c, 2.2, 50);
        redGlow.position.set(1, 3, 2);
        scene.add(redGlow);

        function neon(color, intensity) {
            return new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: intensity == null ? 1 : intensity, roughness: 0.4, metalness: 0.35 });
        }
        function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

        // Moon and stars.
        var moon = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 16), new THREE.MeshBasicMaterial({ color: 0xe8f2ff }));
        moon.position.set(-30, 28, -160);
        scene.add(moon);
        var starPts = [];
        for (var si = 0; si < 500; si++) starPts.push((Math.random() - 0.5) * 220, Math.random() * 90, -60 - Math.random() * 240);
        var starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfe0ff, size: 0.55, transparent: true, opacity: 0.85 })));

        // Falling snow.
        var snowPos = [];
        var SNOW_COUNT = isMobileDevice ? 420 : 800;
        for (var sni = 0; sni < SNOW_COUNT; sni++) snowPos.push((Math.random() - 0.5) * 70, Math.random() * 40 - 6, -Math.random() * 130 + 8);
        var snowGeo = new THREE.BufferGeometry();
        snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
        var snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
        scene.add(snow);

        // Snow banks.
        var bankMat = new THREE.MeshStandardMaterial({ color: 0xdfeaff, roughness: 0.94, metalness: 0.02 });
        [-1, 1].forEach(function (side) {
            var bank = box(18, 6, 320, bankMat);
            bank.position.set(side * 24, -3, -140);
            scene.add(bank);
        });

        // Christmas trees along the banks.
        var trees = [];
        function makeTree() {
            var g = new THREE.Group();
            var trunk = box(0.4, 2, 0.4, new THREE.MeshStandardMaterial({ color: 0x4a2f1e }));
            trunk.position.y = 1; g.add(trunk);
            for (var t = 0; t < 3; t++) {
                var cone = new THREE.Mesh(new THREE.ConeGeometry(2.4 - t * 0.55, 3.2 - t * 0.5, 7), new THREE.MeshStandardMaterial({ color: 0x1f6b3c, roughness: 0.9 }));
                cone.position.y = 2.4 + t * 1.6; g.add(cone);
            }
            var star = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), neon(0xffd166, 1.6));
            star.position.y = 7.2; g.add(star);
            return g;
        }
        for (var ti = 0; ti < 14; ti++) {
            var tree = makeTree();
            var tx = (ti % 2 === 0 ? -1 : 1) * (14 + Math.random() * 6);
            tree.position.set(tx, 0, -20 - ti * 18);
            scene.add(tree);
            trees.push({ mesh: tree, x: tx, dist: 20 + ti * 18 });
        }

        // Sleigh.
        var sleigh = new THREE.Group();
        var sleighMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.45, roughness: 0.3, emissive: 0x3a0505, emissiveIntensity: 0.2 });
        var body = box(2.2, 0.8, 3.4, sleighMat); body.position.y = 0.8; sleigh.add(body);
        var seat = box(1.9, 0.35, 1.1, new THREE.MeshStandardMaterial({ color: 0x5a1f1f })); seat.position.set(0, 1.3, 0.3); sleigh.add(seat);
        var sack = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), new THREE.MeshStandardMaterial({ color: 0x8b1e2d, roughness: 0.8 }));
        sack.scale.set(1, 1.1, 0.9); sack.position.set(0, 1.5, 1.0); sleigh.add(sack);
        var runnerMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ec, metalness: 0.8, roughness: 0.25 });
        [-1, 1].forEach(function (side) {
            var runner = box(0.12, 0.12, 3.8, runnerMat);
            runner.position.set(side * 1.05, 0.25, 0);
            sleigh.add(runner);
            var rail = box(0.1, 0.5, 0.1, runnerMat);
            rail.position.set(side * 1.05, 0.5, -1.5);
            sleigh.add(rail);
        });
        var glow = new THREE.PointLight(0xffd166, 2, 22);
        glow.position.set(0, 1.5, 0);
        sleigh.add(glow);
        scene.add(sleigh);

        var obstacles = [], gifts = [], sparks = [];
        var iceMat = new THREE.MeshStandardMaterial({ color: 0x8fdcff, emissive: 0x2a6b8a, emissiveIntensity: 0.8, metalness: 0.45, roughness: 0.25, transparent: true, opacity: 0.9 });
        var giftMats = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f];

        function spawnIce() {
            var m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + Math.random() * 1.1, 0), iceMat);
            m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 7 + 2.5, -110 - Math.random() * 40);
            m.userData.r = 1.1;
            m.userData.spin = (Math.random() - 0.5) * 2;
            scene.add(m); obstacles.push(m);
        }
        function spawnGift() {
            var g = new THREE.Group();
            var col = giftMats[Math.floor(Math.random() * giftMats.length)];
            var b = box(0.8, 0.8, 0.8, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, metalness: 0.3 }));
            g.add(b);
            var ribbon = box(0.18, 0.84, 0.84, neon(0xffd166, 0.9)); g.add(ribbon);
            var ribbon2 = box(0.84, 0.84, 0.18, neon(0xffd166, 0.9)); g.add(ribbon2);
            g.position.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 7 + 2.5, -95 - Math.random() * 60);
            scene.add(g); gifts.push(g);
        }
        function blastAt(x, y, z, color) {
            var m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
            m.position.set(x, y, z); scene.add(m);
            sparks.push({ mesh: m, life: 0.35, max: 0.35 });
        }
        function removeFrom(list, i) { scene.remove(list[i]); list.splice(i, 1); }

        for (var a = 0; a < 5; a++) spawnIce();
        for (var b2 = 0; b2 < 4; b2++) spawnGift();

        var candyGates = [], bossProjectiles = [], boss = null;
        var stormT = 20, stormActive = 0, candyT = 7, boostT = 0;
        var bossActive = false, bossDefeated = false, bossT = 0, bossFireT = 0;

        function spawnCandyGate() {
            var g = new THREE.Group();
            var white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.4 });
            var red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.45 });
            [-2.2, 2.2].forEach(function (side) {
                var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), white);
                pole.position.set(side, 3, 0); g.add(pole);
                for (var r = 1; r <= 5; r++) {
                    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 6, 14), red);
                    ring.rotation.x = Math.PI / 2; ring.position.set(side, r, 0); g.add(ring);
                }
            });
            var bar = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 0.34), red);
            bar.position.set(0, 6, 0); g.add(bar);
            var lights = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.08, 0.1), neon(0xffd166, 1.4));
            lights.position.set(0, 5.82, 0.18); g.add(lights);
            var gx = (Math.random() - 0.5) * 8;
            g.position.set(gx, 0, -110 - Math.random() * 30);
            scene.add(g);
            candyGates.push({ group: g, x: gx, used: false });
        }

        function spawnGrinchBoss() {
            var g = new THREE.Group();
            var green = new THREE.MeshStandardMaterial({ color: 0x2e6b35, emissive: 0x0a2a10, emissiveIntensity: 0.5, roughness: 0.6 });
            var sled = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a1a1a, metalness: 0.4, roughness: 0.4 }));
            sled.position.y = 1; g.add(sled);
            var body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), green);
            body.scale.set(1, 1.15, 0.85); body.position.set(0, 2.1, 0); g.add(body);
            var head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), green);
            head.position.set(0, 3.2, -0.2); g.add(head);
            var hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
            hat.position.set(0, 3.9, -0.2); g.add(hat);
            var sack = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8b1e2d }));
            sack.position.set(-1.2, 1.8, 0.4); g.add(sack);
            var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
            [-0.24, 0.24].forEach(function (ex) {
                var eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
                eye.position.set(ex, 3.25, -0.75); g.add(eye);
            });
            g.position.set(0, 0, -60);
            g.userData.baseX = 0;
            scene.add(g);
            boss = g;
            bossActive = true;
            bossT = 12;
            bossFireT = 0.8;
            tone(120, 0.5, 'sawtooth', 0.1, 50);
            tone(180, 0.4, 'square', 0.06, 90);
        }

        var elapsed = 0, speed = 24, iceT = 0, giftT = 0, score = 0, combo = 1, comboT = 0;

        function update(dt) {
            elapsed += dt;
            var baseSpeed = Math.min(70, 24 + elapsed * 1.0);
            speed = baseSpeed * (boostT > 0 ? 1.32 : 1) * (stormActive > 0 ? 1.08 : 1);
            score += dt * 12 * combo;
            if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 1; }
            if (boostT > 0) boostT = Math.max(0, boostT - dt);
            if (stormActive > 0) stormActive = Math.max(0, stormActive - dt);
            stormT -= dt;
            if (stormT <= 0) { stormT = 24 + Math.random() * 6; stormActive = 7; tone(220, 0.25, 'triangle', 0.05, 120); }
            scene.fog.density = stormActive > 0 ? 0.024 : 0.014;
            snow.material.size = stormActive > 0 ? 0.42 : 0.22;
            candyT -= dt;
            if (candyT <= 0) { candyT = 9 + Math.random() * 4; spawnCandyGate(); }
            if (elapsed > 42 && !bossActive && !bossDefeated) spawnGrinchBoss();

            var tx = sleigh.position.x, ty = sleigh.position.y;
            if (input.left) tx -= dt * 30;
            if (input.right) tx += dt * 30;
            if (input.up) ty += dt * 26;
            if (input.down) ty -= dt * 26;
            if (input.pointerActive) { tx = input.pointerX * 9; ty = -input.pointerY * 5 + 2.5; }
            if (tx < -9) tx = -9; if (tx > 9) tx = 9;
            if (ty < -1) ty = -1; if (ty > 8) ty = 8;
            sleigh.position.x += (tx - sleigh.position.x) * Math.min(1, dt * 14);
            sleigh.position.y += (ty - sleigh.position.y) * Math.min(1, dt * 14);
            sleigh.rotation.z = (tx - sleigh.position.x) * -0.25;
            sleigh.rotation.x = (ty - sleigh.position.y) * 0.12;

            // Snowfall.
            var sp = snowGeo.attributes.position.array;
            for (var s2 = 0; s2 < SNOW_COUNT; s2++) {
                sp[s2 * 3 + 1] -= (4 + (s2 % 5)) * dt;
                sp[s2 * 3 + 2] += speed * 0.55 * dt;
                if (sp[s2 * 3 + 1] < -6) sp[s2 * 3 + 1] = 34;
                if (sp[s2 * 3 + 2] > 10) { sp[s2 * 3 + 2] = -130; sp[s2 * 3] = (Math.random() - 0.5) * 70; }
            }
            snowGeo.attributes.position.needsUpdate = true;

            // Trees recycle.
            for (var tr = 0; tr < trees.length; tr++) {
                var tree = trees[tr];
                tree.mesh.position.z += speed * dt;
                if (tree.mesh.position.z > 16) {
                    tree.mesh.position.z = -190 - Math.random() * 30;
                    tree.mesh.position.x = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 6);
                }
            }

            iceT += dt;
            if (iceT > Math.max(0.5, 1.2 - elapsed * 0.01)) { iceT = 0; spawnIce(); }
            giftT += dt;
            if (giftT > 1.4) { giftT = 0; spawnGift(); }

            for (var o = obstacles.length - 1; o >= 0; o--) {
                var ob = obstacles[o];
                ob.position.z += speed * dt;
                ob.rotation.x += ob.userData.spin * dt;
                ob.rotation.y += ob.userData.spin * dt * 0.7;
                if (ob.position.z > 12) { removeFrom(obstacles, o); continue; }
                if (ob.position.distanceTo(sleigh.position) < ob.userData.r + 1.0) {
                    blastAt(ob.position.x, ob.position.y, ob.position.z, 0x8fdcff);
                    endGame(Math.round(score));
                    return;
                }
            }
            for (var g2 = gifts.length - 1; g2 >= 0; g2--) {
                var gift = gifts[g2];
                gift.position.z += speed * dt;
                gift.rotation.y += dt * 2.4;
                if (gift.position.z > 12) { removeFrom(gifts, g2); continue; }
                if (gift.position.distanceTo(sleigh.position) < 2.2) {
                    score += 100 * combo; combo = Math.min(5, combo + 0.4); comboT = 3.5;
                    blastAt(gift.position.x, gift.position.y, gift.position.z, 0xffd166);
                    removeFrom(gifts, g2);
                }
            }
            for (var cg = candyGates.length - 1; cg >= 0; cg--) {
                var gate = candyGates[cg];
                gate.group.position.z += speed * dt;
                if (gate.group.position.z > 14) { scene.remove(gate.group); candyGates.splice(cg, 1); continue; }
                if (!gate.used && Math.abs(gate.group.position.z) < 2.5 && Math.abs(sleigh.position.x - gate.x) < 2.2) {
                    gate.used = true;
                    boostT = 2.6;
                    score += 250 * combo;
                    combo = Math.min(5, combo + 0.5); comboT = 4;
                    blastAt(sleigh.position.x, sleigh.position.y, -2, 0xffd166);
                    tone(880, 0.14, 'triangle', 0.06, 1320);
                }
            }

            if (bossActive && boss) {
                bossT -= dt;
                boss.position.x += (sleigh.position.x * 0.7 - boss.position.x) * Math.min(1, dt * 1.8);
                boss.position.y = 2.5 + Math.sin(elapsed * 2) * 0.4;
                boss.rotation.z = Math.sin(elapsed * 2.4) * 0.08;
                bossFireT -= dt;
                if (bossFireT <= 0) {
                    bossFireT = 1.1;
                    var proj = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), iceMat);
                    proj.position.copy(boss.position);
                    proj.position.y += 3.2;
                    scene.add(proj);
                    var dx = sleigh.position.x - proj.position.x;
                    var dy = sleigh.position.y - proj.position.y;
                    var dz = 4 - proj.position.z;
                    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
                    bossProjectiles.push({ mesh: proj, vx: dx / len * 30, vy: dy / len * 30, vz: dz / len * 30 });
                    tone(140, 0.1, 'square', 0.04, 90);
                }
                if (bossT <= 0) {
                    scene.remove(boss);
                    boss = null;
                    bossActive = false;
                    bossDefeated = true;
                    score += 2000;
                    combo = Math.min(5, combo + 1); comboT = 4;
                    tone(660, 0.4, 'triangle', 0.08, 990);
                }
            }
            for (var bp2 = bossProjectiles.length - 1; bp2 >= 0; bp2--) {
                var pr = bossProjectiles[bp2];
                pr.mesh.position.x += pr.vx * dt;
                pr.mesh.position.y += pr.vy * dt;
                pr.mesh.position.z += pr.vz * dt;
                pr.mesh.rotation.x += dt * 4;
                if (pr.mesh.position.z > 15 || pr.mesh.position.y < -8) { scene.remove(pr.mesh); bossProjectiles.splice(bp2, 1); continue; }
                if (pr.mesh.position.distanceTo(sleigh.position) < 1.2) {
                    blastAt(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, 0x8fdcff);
                    endGame(Math.round(score));
                    return;
                }
            }

            for (var s3 = sparks.length - 1; s3 >= 0; s3--) {
                var sp2 = sparks[s3];
                sp2.life -= dt;
                var p = 1 - sp2.life / sp2.max;
                sp2.mesh.scale.setScalar(1 + p * 5);
                sp2.mesh.material.opacity = Math.max(0, 0.9 * (1 - p));
                if (sp2.life <= 0) removeFrom(sparks, s3);
            }

            camera.position.x += (sleigh.position.x * 0.55 - camera.position.x) * Math.min(1, dt * 4);
            camera.position.y += (sleigh.position.y * 0.4 + 3.4 - camera.position.y) * Math.min(1, dt * 4);
            camera.lookAt(sleigh.position.x * 0.45, sleigh.position.y * 0.5 + 1.2, -14);
            var snowStatus = 'SNOW RUSH · ' + Math.round(score) + ' PTS · x' + combo.toFixed(1);
            if (boostT > 0) snowStatus += ' · BOOST';
            if (stormActive > 0) snowStatus += ' · SNOWSTORM';
            if (bossActive) snowStatus += ' · GRINCH ' + Math.ceil(bossT) + 's';
            setHud(Math.round(score), snowStatus);
        }

        return {
            over: false,
            update: update,
            getScore: function () { return score; },
            lockPointer: function () { if (pointerCanvas) { ensureAudio(); try { pointerCanvas.focus(); pointerCanvas.requestPointerLock(); } catch (e) {} } },
            isPointerLocked: function () { return document.pointerLockElement === pointerCanvas; }
        };
    }

    /* ---------------- Changi Approach (landing sim) ---------------- */
    function createChangiApproach(ctx) {
        var scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
        scene.background = new THREE.Color(0x6f8496);
        scene.fog = new THREE.FogExp2(0x8aa0b2, 0.0018);
        if (renderer) renderer.shadowMap.enabled = false;
        camera.fov = 62;
        camera.near = 0.1;
        camera.far = 6000;

        function std(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.75, metalness: 0.08 }, opts || {})); }
        function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
        function cyl(t, b, h, s, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(t, b, h, s || 10), mat); }

        scene.add(new THREE.HemisphereLight(0xbfd8ea, 0x42545f, 0.95));
        var sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
        sun.position.set(-220, 300, 200);
        scene.add(sun);
        var ambient = new THREE.AmbientLight(0xffffff, 0.25);
        scene.add(ambient);

        // Sea.
        var sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), std(0x31556b, { roughness: 0.55, metalness: 0.25 }));
        sea.rotation.x = -Math.PI / 2;
        sea.position.y = -0.5;
        scene.add(sea);

        // Runway texture.
        var runwayCanvas = document.createElement('canvas'); runwayCanvas.width = 128; runwayCanvas.height = 1024;
        var rg = runwayCanvas.getContext('2d');
        rg.fillStyle = '#2b2e33'; rg.fillRect(0, 0, 128, 1024);
        rg.fillStyle = 'rgba(255,255,255,0.9)';
        for (var cy = 40; cy < 1024; cy += 90) rg.fillRect(61, cy, 6, 48);
        rg.fillRect(8, 0, 4, 1024); rg.fillRect(116, 0, 4, 1024);
        rg.fillStyle = 'rgba(255,255,255,0.85)';
        for (var ty = 0; ty < 90; ty += 18) { rg.fillRect(44, ty, 12, 10); rg.fillRect(72, ty, 12, 10); }
        for (var ty2 = 934; ty2 < 1024; ty2 += 18) { rg.fillRect(44, ty2, 12, 10); rg.fillRect(72, ty2, 12, 10); }
        var runwayTex = new THREE.CanvasTexture(runwayCanvas);
        runwayTex.wrapS = runwayTex.wrapT = THREE.RepeatWrapping;
        runwayTex.repeat.set(1, 3);
        var runway = new THREE.Mesh(new THREE.PlaneGeometry(62, 3200), std(0xffffff, { map: runwayTex, roughness: 0.9 }));
        runway.rotation.x = -Math.PI / 2;
        runway.position.set(0, 0.02, 0);
        scene.add(runway);

        // Grass strips and taxiway lights.
        [-1, 1].forEach(function (side) {
            var grass = new THREE.Mesh(new THREE.PlaneGeometry(500, 3400), std(0x3f5a46, { roughness: 1 }));
            grass.rotation.x = -Math.PI / 2;
            grass.position.set(side * 300, 0.01, 0);
            scene.add(grass);
        });

        // Approach lights.
        var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
        for (var lz = 1500; lz <= 2900; lz += 70) {
            [-10, 0, 10].forEach(function (lx) {
                var post = box(0.4, 0.8, 0.4, std(0x333333));
                post.position.set(lx, 0.4, lz); scene.add(post);
                var bulb = box(0.8, 0.8, 0.8, lightMat);
                bulb.position.set(lx, 1.0, lz); scene.add(bulb);
            });
        }
        for (var ez = 1540; ez <= 1600; ez += 20) {
            [-14, 14].forEach(function (ex) {
                var edge = box(1.4, 0.5, 1.4, new THREE.MeshBasicMaterial({ color: 0x2ff6ff }));
                edge.position.set(ex, 0.3, ez); scene.add(edge);
            });
        }

        // Runway edge lights.
        for (var rz = -1500; rz <= 1500; rz += 55) {
            [-34, 34].forEach(function (ex2) {
                var edgeBulb = box(0.7, 0.5, 0.7, new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
                edgeBulb.position.set(ex2, 0.35, rz); scene.add(edgeBulb);
            });
        }
        // PAPI glide slope lights.
        for (var pp = 0; pp < 4; pp++) {
            var papi = box(2.0, 0.8, 1.4, new THREE.MeshBasicMaterial({ color: pp < 2 ? 0xffffff : 0xff3b3b }));
            papi.position.set(-48 + pp * 4, 0.5, 1620);
            scene.add(papi);
        }
        // Windsock.
        var sockPole = cyl(0.14, 0.18, 7, 8, std(0xd9e2ec, { metalness: 0.5 }));
        sockPole.position.set(55, 3.5, 1660); scene.add(sockPole);
        var windsock = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7b00, roughness: 0.8, side: THREE.DoubleSide }));
        windsock.rotation.z = Math.PI / 2;
        windsock.position.set(57.2, 6.8, 1660);
        scene.add(windsock);

        // Terminal and city.
        var terminal = box(220, 26, 90, std(0xb8c6cf, { metalness: 0.3, roughness: 0.5 }));
        terminal.position.set(-190, 13, -900);
        scene.add(terminal);
        var terminalGlass = box(212, 6, 0.6, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55 }));
        terminalGlass.position.set(-190, 14, -854.5); scene.add(terminalGlass);
        for (var jb = 0; jb < 6; jb++) {
            var bridge = box(4, 3, 16, std(0xb8c6cf));
            bridge.position.set(-95 - jb * 26, 3, -880); scene.add(bridge);
            var bridgeGlass = box(3.6, 1.2, 14, new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.5 }));
            bridgeGlass.position.set(-95 - jb * 26, 3.2, -880); scene.add(bridgeGlass);
        }
        var tower = cyl(4, 5, 75, 10, std(0xd9e2ec));
        tower.position.set(150, 37, -1050); scene.add(tower);
        var towerTop = box(18, 8, 18, std(0x8fd6ff, { emissive: 0x2a6b8a, emissiveIntensity: 0.4 }));
        towerTop.position.set(150, 78, -1050); scene.add(towerTop);
        for (var bi = 0; bi < 22; bi++) {
            var bh = 30 + Math.random() * 90;
            var b = box(30 + Math.random() * 40, bh, 30 + Math.random() * 40, std(0x5a6a76, { roughness: 0.7 }));
            var bx = (bi % 2 ? 1 : -1) * (420 + Math.random() * 500);
            b.position.set(bx, bh / 2, -1200 - Math.random() * 900);
            scene.add(b);
        }

        // Rain.
        var rainPos = [];
        var rainCount = isMobileDevice ? 500 : 1000;
        for (var ri = 0; ri < rainCount; ri++) rainPos.push((Math.random() - 0.5) * 300, Math.random() * 260, -Math.random() * 600 + 300);
        var rainGeo = new THREE.BufferGeometry();
        rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
        var rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbcd6e8, size: 0.7, transparent: true, opacity: 0.55, depthWrite: false }));
        scene.add(rain);

        // Airliner — detailed model.
        var jet = new THREE.Group();
        var fuselageMat = std(0xf1f5f8, { metalness: 0.5, roughness: 0.26 });
        var stripeMat = std(0xc0392b, { metalness: 0.35, roughness: 0.4 });
        var darkMat = std(0x121a22, { metalness: 0.6, roughness: 0.2 });
        var wingMat = std(0xe4eaee, { metalness: 0.45, roughness: 0.34 });
        var engineMat = std(0x7d8894, { metalness: 0.7, roughness: 0.25 });
        var fuse = cyl(2.8, 3.0, 30, 16, fuselageMat);
        fuse.rotation.x = Math.PI / 2; fuse.position.z = 2; jet.add(fuse);
        var nose = new THREE.Mesh(new THREE.ConeGeometry(2.8, 6, 16), fuselageMat);
        nose.rotation.x = -Math.PI / 2; nose.position.z = -16; jet.add(nose);
        var tailCone = new THREE.Mesh(new THREE.ConeGeometry(2.9, 7, 16), fuselageMat);
        tailCone.rotation.x = Math.PI / 2; tailCone.position.z = 20.5; jet.add(tailCone);
        var cockpit = box(3.8, 1.1, 0.3, darkMat);
        cockpit.position.set(0, 1.5, -13.2); cockpit.rotation.x = -0.25; jet.add(cockpit);
        [-1, 1].forEach(function (side) {
            var cabin = box(0.08, 0.34, 24, new THREE.MeshBasicMaterial({ color: 0x1c3346, transparent: true, opacity: 0.85 }));
            cabin.position.set(side * 2.82, 1.0, 3); jet.add(cabin);
            var stripe = box(0.09, 0.38, 28, stripeMat);
            stripe.position.set(side * 2.84, 0.1, 2); jet.add(stripe);
        });
        var wing = box(46, 0.75, 9, wingMat);
        wing.position.set(0, -0.25, 2); jet.add(wing);
        [-1, 1].forEach(function (side) {
            var winglet = box(0.35, 3.2, 2.6, wingMat);
            winglet.position.set(side * 22.6, 1.3, 3.4);
            winglet.rotation.z = side * 0.28;
            jet.add(winglet);
        });
        var tailWing = box(16, 0.5, 4.6, wingMat);
        tailWing.position.set(0, 1.1, 18); jet.add(tailWing);
        var fin = box(0.7, 9, 6.5, stripeMat);
        fin.position.set(0, 5.0, 19.5); fin.rotation.x = -0.16; jet.add(fin);
        var finTip = box(0.72, 1.2, 3.0, fuselageMat);
        finTip.position.set(0, 9.4, 19.0); finTip.rotation.x = -0.16; jet.add(finTip);
        var flapMeshes = [];
        [-1, 1].forEach(function (side) {
            var engine = cyl(1.55, 1.75, 6.2, 14, engineMat);
            engine.rotation.x = Math.PI / 2;
            engine.position.set(side * 12.5, -1.2, 2.5);
            jet.add(engine);
            var fan = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), darkMat);
            fan.position.set(side * 12.5, -1.2, -0.7);
            jet.add(fan);
            var pylon = box(1.1, 1.4, 3.4, wingMat);
            pylon.position.set(side * 11.2, 0.3, 2.8); jet.add(pylon);
            var flap = box(9, 0.16, 2.1, wingMat);
            flap.position.set(side * 15.2, -0.55, 6.1);
            jet.add(flap);
            flapMeshes.push(flap);
            var gearDoor = box(1.0, 0.08, 2.0, fuselageMat);
            gearDoor.position.set(side * 4.2, -2.4, 4); jet.add(gearDoor);
        });
        var gearGroup = new THREE.Group();
        var wheelMat = std(0x15171a, { roughness: 0.9 });
        var strutMat = std(0x9aa5af, { metalness: 0.75, roughness: 0.25 });
        [[0, -2.9, -6], [-6.2, -2.6, 5], [6.2, -2.6, 5]].forEach(function (gp) {
            var strut = cyl(0.16, 0.16, 2.7, 8, strutMat);
            strut.position.set(gp[0], gp[1], gp[2]); gearGroup.add(strut);
            var bogie = box(1.4, 0.25, 1.4, strutMat);
            bogie.position.set(gp[0], gp[1] - 1.35, gp[2]); gearGroup.add(bogie);
            [-0.42, 0.42].forEach(function (wx) {
                var wheel = cyl(0.72, 0.72, 0.46, 12, wheelMat);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(gp[0] + wx, gp[1] - 1.45, gp[2]); gearGroup.add(wheel);
            });
        });
        jet.add(gearGroup);
        var navRed = new THREE.PointLight(0xff3b3b, 1.1, 28); navRed.position.set(-22.5, 0.4, 3); jet.add(navRed);
        var navGreen = new THREE.PointLight(0x54ff9f, 1.1, 28); navGreen.position.set(22.5, 0.4, 3); jet.add(navGreen);
        var strobe = new THREE.PointLight(0xffffff, 1.8, 40); strobe.position.set(0, 9.5, 19); jet.add(strobe);
        var beacon = new THREE.PointLight(0xff3b3b, 1.4, 20); beacon.position.set(0, 3.1, 2); jet.add(beacon);
        scene.add(jet);

        // State.
        var jetState = {
            x: 0, y: 260, z: 2600, heading: 0, pitch: 0, roll: 0, speed: 95, throttle: 0.55,
            gear: false, flaps: 0, mode: 'approach', sink: 0, score: 0, landings: 0, attempt: 0,
            message: '', messageT: 0, wind: 0, windDir: 1, rolloutT: 0
        };
        var keys = {};
        function keyDown(e) {
            var k = String(e.key || '').toLowerCase();
            keys[k] = true;
            if (k === 'g') toggleGear();
            if (k === 'f') cycleFlaps();
            if (k === ' ') { e.preventDefault(); goAround(); }
        }
        function keyUp(e) { keys[String(e.key || '').toLowerCase()] = false; }
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
        addCleanup(function () { document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp); });

        function toggleGear() {
            if (jetState.mode !== 'approach') return;
            jetState.gear = !jetState.gear;
            tone(420, 0.1, 'square', 0.04, 620);
        }
        function cycleFlaps() {
            if (jetState.mode !== 'approach') return;
            jetState.flaps = (jetState.flaps + 1) % 3;
            tone(320, 0.08, 'square', 0.035, 420);
        }
        function goAround() {
            if (jetState.mode !== 'approach') return;
            jetState.score = Math.max(0, jetState.score - 150);
            startApproach(true);
            tone(180, 0.3, 'sawtooth', 0.06, 420);
        }

        function startApproach(missed) {
            jetState.attempt++;
            jetState.x = (Math.random() - 0.5) * (120 + Math.min(120, jetState.attempt * 12));
            jetState.y = 230 + Math.random() * 60;
            jetState.z = 2550 + Math.random() * 300;
            jetState.heading = 0;
            jetState.pitch = 0;
            jetState.roll = 0;
            jetState.speed = 95;
            jetState.throttle = 0.55;
            jetState.gear = false;
            jetState.flaps = 0;
            jetState.mode = 'approach';
            jetState.wind = Math.min(28, jetState.attempt * 3 + Math.random() * 3);
            jetState.windDir = Math.random() < 0.5 ? -1 : 1;
            jetState.message = missed ? 'GO AROUND · line up again' : 'APPROACH · gear G · flaps F';
            jetState.messageT = 2.5;
            if (sun) sun.intensity = 1.15 - Math.min(0.5, jetState.attempt * 0.06);
            scene.fog.density = 0.0018 + Math.min(0.005, jetState.attempt * 0.0005);
        }

        function updateRain(dt) {
            var arr = rainGeo.attributes.position.array;
            for (var i = 0; i < rainCount; i++) {
                arr[i * 3 + 1] -= (26 + (i % 5) * 4) * dt;
                arr[i * 3 + 2] += jetState.speed * 0.22 * dt;
                if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 240;
                if (arr[i * 3 + 2] > 350) arr[i * 3 + 2] = -600;
            }
            rainGeo.attributes.position.needsUpdate = true;
        }

        function updateHud() {
            var alt = document.getElementById('cxAlt');
            var spd = document.getElementById('cxSpd');
            var vs = document.getElementById('cxVs');
            var dst = document.getElementById('cxDist');
            var gear = document.getElementById('cxGear');
            var flaps = document.getElementById('cxFlaps');
            var wind = document.getElementById('cxWind');
            var brake = document.getElementById('cxBrake');
            var score = document.getElementById('cxScore');
            var status = document.getElementById('cxStatus');
            var msg = document.getElementById('cxMessage');
            var guide = document.getElementById('cxGuide');
            var distToThreshold = jetState.z - 1600;
            if (alt) alt.textContent = Math.max(0, Math.round(jetState.y)) + ' m';
            if (spd) spd.textContent = Math.round(jetState.speed * 1.94384) + ' kt';
            if (vs) vs.textContent = (jetState.sink >= 0 ? '↓' : '↑') + Math.abs(jetState.sink).toFixed(1) + ' m/s';
            if (dst) dst.textContent = Math.max(0, Math.round(distToThreshold)) + ' m';
            if (gear) { gear.textContent = jetState.gear ? 'GEAR DOWN' : 'GEAR UP'; gear.classList.toggle('is-ok', jetState.gear); }
            if (flaps) { flaps.textContent = 'FLAPS ' + jetState.flaps; flaps.classList.toggle('is-ok', jetState.flaps > 0); }
            if (wind) wind.textContent = 'WIND ' + Math.round(jetState.wind) + ' kt ' + (jetState.windDir > 0 ? '→' : '←');
            if (brake) { brake.textContent = keys['b'] ? 'BRAKE ON' : 'BRAKE OFF'; brake.classList.toggle('is-ok', !!keys['b']); }
            var thrFill = document.getElementById('cxThrottleFill');
            if (thrFill) thrFill.style.width = Math.round(jetState.throttle * 100) + '%';
            var thrPct = document.getElementById('cxThrottlePct');
            if (thrPct) thrPct.textContent = Math.round(jetState.throttle * 100) + '%';
            if (score) score.textContent = Math.round(jetState.score).toLocaleString();
            if (status) status.textContent = jetState.mode === 'rollout' ? 'ROLLOUT' : 'APPROACH';
            if (msg) msg.textContent = (jetState.messageT > 0 ? jetState.message : (distToThreshold > 0 ? 'Aim for the centreline · 3° glide path' : 'Over the runway'));
            if (guide) {
                var loc = Math.abs(jetState.x) < 8 ? 'LOC OK' : 'LOC ' + (jetState.x > 0 ? 'RIGHT ' : 'LEFT ') + Math.round(Math.abs(jetState.x)) + 'm';
                var expected = Math.max(0, distToThreshold) * 0.052 + 12;
                var gs = jetState.y > expected + 35 ? 'GS HIGH' : jetState.y < expected - 35 ? 'GS LOW' : 'GS OK';
                guide.textContent = loc + ' · ' + gs;
            }
        }

        function land() {
            var distFromThreshold = Math.abs(jetState.z - 1600);
            var centerError = Math.abs(jetState.x);
            var speedKt = jetState.speed * 1.94384;
            var soft = jetState.sink < 7;
            var onRunway = jetState.z < 1600 && jetState.z > -1300 && centerError < 26;
            var configOk = jetState.gear && jetState.flaps > 0 && speedKt > 55 && speedKt < 180;
            if (onRunway && soft && configOk) {
                var points = 1000 + Math.round(400 - centerError * 12 - Math.max(0, jetState.sink) * 45 - Math.abs(speedKt - 135) * 5 + jetState.wind * 8);
                jetState.score += Math.max(300, points);
                jetState.landings++;
                jetState.mode = 'rollout';
                jetState.rolloutT = 4;
                jetState.message = 'TOUCHDOWN · +' + Math.max(300, points) + ' points';
                jetState.messageT = 4;
                tone(520, 0.25, 'triangle', 0.06, 780);
                tone(780, 0.3, 'triangle', 0.05, 1040);
            } else {
                jetState.mode = 'crashed';
                jetState.message = 'CRASH · ' + (!onRunway ? 'missed the runway' : !configOk ? 'gear / flaps / speed' : 'sink rate too high');
                endGame(Math.round(jetState.score));
            }
        }

        function nextApproach() {
            startApproach(false);
        }

        var elapsed = 0, hudT = 0;
        startApproach(false);

        function update(dt) {
            elapsed += dt;
            updateRain(dt);
            if (jetState.messageT > 0) jetState.messageT -= dt;

            if (jetState.mode === 'rollout') {
                var brakeForce = keys['b'] ? 20 : 0;
                var reverseForce = keys['s'] ? 10 : 0;
                jetState.speed = Math.max(0, jetState.speed - (6 + brakeForce + reverseForce) * dt);
                jetState.z -= jetState.speed * dt;
                jetState.rolloutT -= dt;
                if (jetState.rolloutT <= 0 || jetState.speed < 2) nextApproach();
            } else if (jetState.mode === 'approach') {
                // Throttle and attitude.
                var throttleInput = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
                jetState.throttle = Math.max(0.05, Math.min(1, jetState.throttle + throttleInput * 0.5 * dt));
                if (input.pointerActive) {
                    jetState.pitch += (-input.pointerY * 0.3 - jetState.pitch) * Math.min(1, dt * 2);
                    jetState.roll += (input.pointerX * 0.35 - jetState.roll) * Math.min(1, dt * 2);
                } else {
                    var pitchInput = (keys['arrowup'] ? 1 : 0) - (keys['arrowdown'] ? 1 : 0);
                    var rollInput = (keys['arrowright'] ? 1 : 0) - (keys['arrowleft'] ? 1 : 0);
                    jetState.pitch += pitchInput * 0.35 * dt;
                    jetState.roll += rollInput * 0.9 * dt;
                }
                jetState.pitch *= Math.max(0, 1 - dt * 0.7);
                jetState.roll *= Math.max(0, 1 - dt * 1.4);
                jetState.pitch = Math.max(-0.35, Math.min(0.35, jetState.pitch));
                jetState.roll = Math.max(-0.55, Math.min(0.55, jetState.roll));
                jetState.heading -= jetState.roll * 0.42 * dt;

                var targetSpeed = 62 + jetState.throttle * 78 - jetState.flaps * 5 - (jetState.gear ? 3 : 0) - (keys['b'] ? 14 : 0);
                jetState.speed += (targetSpeed - jetState.speed) * Math.min(1, dt * 1.1);
                jetState.speed = Math.max(45, Math.min(150, jetState.speed));

                var lift = (jetState.speed - 55) * 0.12;
                jetState.sink = 13 - lift - jetState.pitch * 55 - jetState.flaps * 3.2 - (jetState.gear ? 1.2 : 0);
                jetState.sink = Math.max(-7, Math.min(20, jetState.sink));
                jetState.y -= jetState.sink * dt;

                var fx = -Math.sin(jetState.heading), fz = -Math.cos(jetState.heading);
                jetState.x += (fx * jetState.speed + jetState.wind * jetState.windDir * 0.35) * dt;
                jetState.z += fz * jetState.speed * dt;

                // Ground contact.
                if (jetState.y <= 0.7) {
                    jetState.y = 0.7;
                    land();
                }
                // Past the runway or far off course.
                if (jetState.z < -1500 && jetState.y > 1) {
                    jetState.message = 'PAST THE RUNWAY · SPACE to go around';
                    jetState.messageT = 1;
                }
            }

            // Aircraft visual.
            jet.position.set(jetState.x, jetState.y, jetState.z);
            jet.rotation.y = jetState.heading;
            jet.rotation.z = -jetState.roll * 0.7;
            jet.rotation.x = jetState.pitch * 0.6;
            gearGroup.visible = jetState.gear;
            for (var fi = 0; fi < flapMeshes.length; fi++) flapMeshes[fi].rotation.x = -jetState.flaps * 0.22;
            navRed.intensity = 0.5 + Math.sin(elapsed * 6) * 0.3;
            navGreen.intensity = 0.5 + Math.sin(elapsed * 6 + 0.6) * 0.3;
            strobe.intensity = (elapsed % 1.2 < 0.08) ? 3 : 0.05;

            // Camera chase.
            var behind = 26, above = 9;
            var cx = jetState.x + Math.sin(jetState.heading) * behind;
            var cz = jetState.z + Math.cos(jetState.heading) * behind;
            camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 3.5);
            camera.position.y += (jetState.y + above - camera.position.y) * Math.min(1, dt * 3.5);
            camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 3.5);
            camera.lookAt(jetState.x - Math.sin(jetState.heading) * 40, jetState.y + 1.5, jetState.z - Math.cos(jetState.heading) * 40);

            hudT -= dt;
            if (hudT <= 0) { hudT = 0.1; updateHud(); }
        }

        // Mobile / button controls.
        setTimeout(function () {
            var gearBtn = document.getElementById('cxGearBtn');
            if (gearBtn) gearBtn.onclick = toggleGear;
            var flapsBtn = document.getElementById('cxFlapsBtn');
            if (flapsBtn) flapsBtn.onclick = cycleFlaps;
            var goBtn = document.getElementById('cxGoBtn');
            if (goBtn) goBtn.onclick = goAround;
            var brakeBtn = document.getElementById('cxBrakeBtn');
            if (brakeBtn) brakeBtn.onclick = function () { keys['b'] = !keys['b']; };
        }, 30);

        return { over: false, update: update, getScore: function () { return jetState.score; } };
    }

    function factoryFor(gameId, opts) {
        if (gameId === 1 && opts && opts.cityMode) return createCity;
        return factories[gameId];
    }

    var factories = {
        1: createRacer,
        2: createTunnel,
        3: createStack,
        4: createDeadCoast,
        7: createSnowRush,
        10: createChangiApproach
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
        var KEY_CAMERA = ['c', 'C'];
        var KEY_FSD = ['f', 'F'];
        var KEY_HONK = ['h', 'H'];
        var KEY_RELOAD = ['r', 'R'];
        var KEY_MELEE = ['v', 'V'];
        var KEY_INTERACT = ['e', 'E'];
        var KEY_BANDAGE = ['b', 'B'];

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
            if (KEY_CAMERA.indexOf(e.key) >= 0) { if (!e.repeat) input.cameraCycle = true; e.preventDefault(); }
            if (KEY_FSD.indexOf(e.key) >= 0) { if (!e.repeat) input.fsdToggle = true; e.preventDefault(); }
            if (KEY_HONK.indexOf(e.key) >= 0) { if (!e.repeat) input.honk = true; e.preventDefault(); }
            if (KEY_RELOAD.indexOf(e.key) >= 0) { if (!e.repeat) input.reload = true; }
            if (KEY_MELEE.indexOf(e.key) >= 0) { if (!e.repeat) input.melee = true; }
            if (KEY_INTERACT.indexOf(e.key) >= 0) { if (!e.repeat) input.interact = true; }
            if (KEY_BANDAGE.indexOf(e.key) >= 0) { if (!e.repeat) input.bandage = true; }
            if (e.key === '1') { if (!e.repeat) input.weapon = 1; }
            if (e.key === '2') { if (!e.repeat) input.weapon = 2; }
            if (e.key === '3') { if (!e.repeat) input.weapon = 3; }
            if (e.key === ' ') { input.jump = true; input.tapQueued = true; e.preventDefault(); }
            else if (e.key === 'Enter') { input.tapQueued = true; e.preventDefault(); }
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
            if (e.key === ' ') input.jump = false;
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
            input.pointerActive = false; input.tapQueued = false; input.honk = false;
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
            if (fps < 45) lowFpsTime += fpsTime;
            else lowFpsTime = 0;
            if (lowFpsTime >= 2 && motionBlurEnabled && !motionBlurAutoOff) {
                motionBlurAutoOff = true;
                resetMotionBlurHistory();
            }
            adaptiveCooldown = Math.max(0, adaptiveCooldown - fpsTime);
            if (!autoGraphics) {
                adaptiveTransition = null;
            } else if (adaptiveTransition) {
                // Hold the current resolution briefly, render a blended scale,
                // then settle on the target. This avoids reallocating the drawing
                // buffer every time FPS wobbles.
                adaptiveTransition.t += fpsTime;
                if (!adaptiveTransition.mid && adaptiveTransition.t >= 0.5) {
                    adaptiveScale = (adaptiveTransition.from + adaptiveTransition.to) / 2;
                    applyPixelRatio();
                    adaptiveTransition.mid = true;
                }
                if (adaptiveTransition.t >= 1) {
                    adaptiveScale = adaptiveTransition.to;
                    applyPixelRatio();
                    adaptiveTransition = null;
                }
            } else if (adaptiveCooldown <= 0) {
                if (fps < 56 && adaptiveScale > 0.2) {
                    beginResolutionTransition(Math.max(0.2, adaptiveScale - 0.1));
                } else if (fps > 58 && adaptiveScale < 1) {
                    beginResolutionTransition(Math.min(1, adaptiveScale + 0.05));
                }
            }
            updatePerfHud(fps);
            fpsTime = 0;
            fpsFrames = 0;
        }
        if (active && running && !active.over && !paused) {
            playedSeconds += dt;
            active.update(dt);
        }
        if (renderer && scene && camera) {
            var shouldRender = true;
            if (active && active.isCinematic && active.isCinematic()) {
                var nowCinema = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
                if (nowCinema - lastCinemaFrame < 16.7) shouldRender = false;
                else lastCinemaFrame = nowCinema;
            }
            if (shouldRender) renderFrame();
            if (pendingFrameCapture) {
                pendingFrameCapture = false;
                if (active && active.captureFrame) {
                    try { lastCapturedFrame = active.captureFrame(); } catch (e) { lastCapturedFrame = null; }
                }
            }
        }
    }

    function start(gameId, containerEl, opts) {
        stop();
        paused = false;
        if (typeof THREE === 'undefined') {
            containerEl.innerHTML = '<p style="padding:40px;text-align:center;color:#fff">3D engine failed to load. Check your connection and refresh.</p>';
            return;
        }
        container = containerEl;
        lastGameId = gameId;
        lastStartOpts = opts || null;
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
        input.honk = false; input.jump = false; input.reload = false; input.melee = false; input.interact = false; input.weapon = 0; input.bandage = false;
        playedSeconds = 0;

        resetScene();
        renderer = new THREE.WebGLRenderer({ antialias: (global.devicePixelRatio || 1) <= 1, powerPreference: 'high-performance' });
        renderer.shadowMap.enabled = !isMobileDevice;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(effectivePixelRatio());
        renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        container.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(65, 1, 0.1, isMobileDevice ? 360 : 520);
        resize();
        resizeObs = new ResizeObserver(resize);
        resizeObs.observe(container);

        clock = new THREE.Clock();
        resetMotionBlurHistory();
        lastCinemaFrame = 0;
        motionBlurAutoOff = isMobileDevice;
        lowFpsTime = 0;
        var factory = factoryFor(gameId, lastStartOpts);
        active = factory ? factory({ scene: scene, camera: camera, input: input, options: opts || {}, renderer: renderer, container: container }) : null;
        if (!active) return;

        resize();
        bindInput();
        running = true;
        raf = requestAnimationFrame(loop);
    }

    function restart() {
        if (!container || !renderer || !lastGameId) return false;
        running = false;
        paused = false;
        playedSeconds = 0;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        for (var i = 0; i < cleanupFns.length; i++) {
            try { cleanupFns[i](); } catch (e) {}
        }
        cleanupFns = [];
        if (audioCleanup) { try { audioCleanup(); } catch (e) {} audioCleanup = null; }
        audioMuteHandler = null;
        active = null;
        if (scene) disposeObject(scene);
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05020c);
        camera = new THREE.PerspectiveCamera(65, 1, 0.1, isMobileDevice ? 360 : 520);
        input.left = false; input.right = false; input.up = false; input.down = false;
        input.brake = false; input.gearDown = false; input.gearUp = false;
        input.drift = false; input.nitro = false; input.fsdToggle = false;
        input.pointerActive = false; input.pointerX = 0; input.pointerY = 0; input.tapQueued = false;
        input.honk = false; input.jump = false; input.reload = false; input.melee = false; input.interact = false; input.weapon = 0; input.bandage = false;
        clock = new THREE.Clock();
        resetMotionBlurHistory();
        resize();
        var factory = factoryFor(lastGameId, lastStartOpts);
        active = factory ? factory({ scene: scene, camera: camera, input: input, options: lastStartOpts || {}, renderer: renderer, container: container }) : null;
        if (!active) return false;
        resize();
        bindInput();
        running = true;
        raf = requestAnimationFrame(loop);
        return true;
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
        if (motionBlurTargets) { motionBlurTargets.forEach(function (t) { t.dispose(); }); motionBlurTargets = null; }
        if (motionBlurMaterial) { try { motionBlurMaterial.dispose(); } catch (e) {} motionBlurMaterial = null; }
        if (motionBlurScene) { try { disposeObject(motionBlurScene); } catch (e) {} motionBlurScene = null; }
        motionBlurTargetSize = '';
        motionBlurHasPrev = false;
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
        // Hard cap at 100% of the CSS viewport. Retina DPR is deliberately
        // ignored so the game never renders wasteful supersampled pixels.
        var base = 1;
        var requested = renderScale > 0 ? renderScale : 1;
        var ratio = base * requested * (autoGraphics ? adaptiveScale : 1);
        return Math.max(0.2, Math.min(1, ratio));
    }

    function applyPixelRatio() {
        if (!renderer || !container) return;
        renderer.setPixelRatio(effectivePixelRatio());
        renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false);
    }

    function beginResolutionTransition(target) {
        target = Math.max(0.2, Math.min(1, target));
        if (Math.abs(target - adaptiveScale) < 0.02) return;
        adaptiveTransition = { from: adaptiveScale, to: target, t: 0, mid: false };
        adaptiveCooldown = 2.5;
    }

    function resetMotionBlurHistory() {
        motionBlurHasPrev = false;
    }

    function ensureMotionBlurResources() {
        if (!renderer || !scene || !camera) return false;
        if (!motionBlurScene) {
            motionBlurMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    currentTex: { value: null },
                    prevTex: { value: null },
                    amount: { value: 0.34 }
                },
                vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
                fragmentShader: 'uniform sampler2D currentTex; uniform sampler2D prevTex; uniform float amount; varying vec2 vUv; void main(){ vec4 c = texture2D(currentTex, vUv); vec4 p = texture2D(prevTex, vUv); gl_FragColor = mix(c, p, amount); }',
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            });
            motionBlurScene = new THREE.Scene();
            motionBlurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), motionBlurMaterial);
            motionBlurScene.add(quad);
        }
        var size = new THREE.Vector2();
        renderer.getDrawingBufferSize(size);
        var key = Math.max(1, Math.floor(size.x)) + 'x' + Math.max(1, Math.floor(size.y));
        if (motionBlurTargetSize !== key || !motionBlurTargets) {
            if (motionBlurTargets) {
                motionBlurTargets.forEach(function (t) { t.dispose(); });
            }
            var opts = { depthBuffer: true, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
            motionBlurTargets = [
                new THREE.WebGLRenderTarget(Math.max(1, Math.floor(size.x * 0.55)), Math.max(1, Math.floor(size.y * 0.55)), opts),
                new THREE.WebGLRenderTarget(Math.max(1, Math.floor(size.x * 0.55)), Math.max(1, Math.floor(size.y * 0.55)), opts)
            ];
            motionBlurTargets.forEach(function (t) {
                if (t.texture) t.texture.colorSpace = THREE.SRGBColorSpace;
            });
            motionBlurTargetSize = key;
            motionBlurHasPrev = false;
        }
        return true;
    }

    function renderFrame() {
        if (!renderer || !scene || !camera) return;
        if (!motionBlurEnabled || motionBlurAutoOff || !ensureMotionBlurResources()) {
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
            return;
        }
        var current = motionBlurTargets[motionBlurIndex];
        var previous = motionBlurTargets[1 - motionBlurIndex];
        renderer.setRenderTarget(current);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        motionBlurMaterial.uniforms.currentTex.value = current.texture;
        motionBlurMaterial.uniforms.prevTex.value = previous.texture;
        motionBlurMaterial.uniforms.amount.value = motionBlurHasPrev ? 0.34 : 0.0;
        renderer.render(motionBlurScene, motionBlurCamera);
        motionBlurIndex = 1 - motionBlurIndex;
        motionBlurHasPrev = true;
    }

    function updatePerfHud(fps) {
        var perfWrap = document.getElementById('g3dPerf');
        if (perfWrap) perfWrap.style.display = showFps ? '' : 'none';
        var fpsEl = document.getElementById('g3dFps');
        var resEl = document.getElementById('g3dRes');
        if (fpsEl) fpsEl.textContent = Math.round(fps) + ' FPS';
        if (resEl && renderer) {
            var canvas = renderer.domElement;
            var ratio = renderer.getPixelRatio();
            resEl.textContent = Math.round(ratio * 100) + '% · ' + canvas.width + '×' + canvas.height;
        }
    }
    function setGraphicsPreset(name, auto) {
        var presets = {
            potato: { scale: 0.5, level: 0, shadows: false },
            medium: { scale: 0.7, level: 1, shadows: false },
            high: { scale: 0.85, level: 2, shadows: true },
            ultra: { scale: 1.0, level: 3, shadows: true },
            extreme: { scale: 1.0, level: 4, shadows: true }
        };
        var preset = presets[name] || presets.high;
        graphicsPreset = name;
        qualityLevel = preset.level;
        autoGraphics = auto !== false;
        renderScale = preset.scale;
        if (!autoGraphics) adaptiveScale = 1;
        if (renderer) {
            shadowQuality = preset.shadows && !isMobileDevice;
            renderer.shadowMap.enabled = shadowQuality;
            applyPixelRatio();
        }
        resetMotionBlurHistory();
    }
    function setRenderScale(scale) {
        renderScale = Math.max(0, Math.min(1, Number(scale) || 0));
        if (renderer && container) {
            renderer.setPixelRatio(effectivePixelRatio());
            renderer.setSize(container.clientWidth, container.clientHeight);
            resize();
            resetMotionBlurHistory();
        }
    }
    function setMotionBlur(on) {
        motionBlurEnabled = !!on;
        motionBlurAutoOff = false;
        lowFpsTime = 0;
        resetMotionBlurHistory();
    }
    function setShowFps(on) {
        showFps = !!on;
        var perfWrap = document.getElementById('g3dPerf');
        if (perfWrap) perfWrap.style.display = showFps ? '' : 'none';
    }
    function setShadows(on) {
        shadowQuality = !!on;
        if (renderer) {
            renderer.shadowMap.enabled = !!on && !isMobileDevice;
            renderer.shadowMap.needsUpdate = true;
        }
    }
    function setCrashSlowmo(on) {
        crashSlowmoEnabled = !!on;
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
    function setZombieRemotes(list) {
        if (active && active.setRemotes) active.setRemotes(list || []);
    }
    function requestFrameCapture() {
        pendingFrameCapture = true;
    }
    function getCapturedFrame() {
        var frame = lastCapturedFrame;
        lastCapturedFrame = null;
        return frame;
    }
    function getZombieState() {
        return active && active.getState ? active.getState() : null;
    }
    function setMobileMove(x, y) {
        if (active && active.setMobileMove) active.setMobileMove(x, y);
    }
    function setMobileFiring(on) {
        if (active && active.setMobileFiring) active.setMobileFiring(on);
    }
    function mobileFpsAction(name) {
        if (active && active.mobileFpsAction) active.mobileFpsAction(name);
    }
    function setZombieNet(host, send, enabled) {
        if (active && active.setZombieNet) active.setZombieNet(host, send, enabled);
    }
    function getZombieWorld() {
        return active && active.getZombieWorld ? active.getZombieWorld() : null;
    }
    function applyZombieWorld(snapshot) {
        if (active && active.applyZombieWorld) active.applyZombieWorld(snapshot);
    }
    function applyZombieHit(id, damage, headshot, from) {
        if (active && active.applyZombieHit) active.applyZombieHit(id, damage, headshot, from);
    }
    function addZombieScore(points) {
        if (active && active.addZombieScore) active.addZombieScore(points);
    }
    function applyZombieAttack(damage) {
        if (active && active.applyZombieAttack) active.applyZombieAttack(damage);
    }
    function reviveZombiePlayer() {
        if (active && active.reviveZombiePlayer) active.reviveZombiePlayer();
    }
    function applyLootedCrate(index) {
        if (active && active.applyLootedCrate) active.applyLootedCrate(index);
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
    function lockPointer() {
        if (active && active.lockPointer) active.lockPointer();
    }
    function teleportRacer(distance, x) {
        if (active && active.teleport) active.teleport(distance, x);
    }
    function setGarageMode(on) {
        if (active && active.setGarage) active.setGarage(on);
    }
    function setGearMode(mode) {
        if (active && active.setGear) active.setGear(mode);
    }
    function toggleFsd() {
        if (active && active.toggleFsd) active.toggleFsd();
    }
    function toggleShadowHelper(on) {
        if (active && active.toggleShadowHelper) active.toggleShadowHelper(on);
    }

    global.Games3D = {
        start: start,
        restart: restart,
        stop: stop,
        setBrake: setBrake,
        setThrottle: setThrottle,
        setDrift: setDrift,
        setNitro: setNitro,
        shiftGear: shiftGear,
        setPaused: setPaused,
        setRemoteRacers: setRemoteRacers,
        requestFrameCapture: requestFrameCapture,
        getCapturedFrame: getCapturedFrame,
        setZombieRemotes: setZombieRemotes,
        getZombieState: getZombieState,
        setZombieNet: setZombieNet,
        setMobileMove: setMobileMove,
        setMobileFiring: setMobileFiring,
        mobileFpsAction: mobileFpsAction,
        getZombieWorld: getZombieWorld,
        applyZombieWorld: applyZombieWorld,
        applyZombieHit: applyZombieHit,
        addZombieScore: addZombieScore,
        applyZombieAttack: applyZombieAttack,
        reviveZombiePlayer: reviveZombiePlayer,
        applyLootedCrate: applyLootedCrate,
        setLocalRacerName: setLocalRacerName,
        setGraphicsPreset: setGraphicsPreset,
        setRenderScale: setRenderScale,
        setMotionBlur: setMotionBlur,
        setShowFps: setShowFps,
        setShadows: setShadows,
        setCrashSlowmo: setCrashSlowmo,
        setSoundEnabled: setSoundEnabled,
        setUnitSystem: setUnitSystem,
        teleportRacer: teleportRacer,
        setGarageMode: setGarageMode,
        setGearMode: setGearMode,
        toggleFsd: toggleFsd,
        toggleShadowHelper: toggleShadowHelper,
        getCurrentScore: getCurrentScore,
        lockPointer: lockPointer,
        getRacerState: getRacerState,
        getRacerInfo: getRacerInfo
    };
})(window);
