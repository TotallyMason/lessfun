/* LessFun — Beach Racer · Babylon.js + Rapier (Phase 1)
 * HDR environment lighting, baked road lighting, ray-cast vehicle physics.
 * This module is loaded on demand and exposes the same controls the arcade
 * already uses, so the original Three.js racer can remain as a fallback.
 */
(function (global) {
    'use strict';

    var BABYLON_URL = 'https://cdn.jsdelivr.net/npm/babylonjs@7.54.0/babylon.js';
    var RAPIER_URL = 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js';
    var HDR_URL = 'https://assets.babylonjs.com/environments/environmentSpecular.env';
    var START_Z = 200;
    var ROAD_LENGTH = 24000;
    var ROAD_WIDTH = 22;
    var SPEED_SCALE = 2;

    var engine = null, scene = null, camera = null, canvas = null, container = null;
    var carRoot = null, carVisuals = [], wheelPivots = [], wheelSpins = [], contactShadow = null;
    var sun = null, shadow = null, sky = null, exhaustSmoke = null, exhaustEmitter = null;
    var impactSparks = null, impactSparkTimer = 0, crashShake = 0;
    var motionBlurPost = null, motionBlurStrength = 0.02;
    var realCarRoot = null, realCarLoading = false, carPaintHex = 0xc2280b;
    var smokeTexture = null, driftSmoke = null, driftEmitter = null;
    var isSanta = false, flyTime = 0, flyCooldown = 0;
    var resizeObs = null, active = false, failed = false;
    var rapier = null, world = null, chassis = null, vehicle = null;
    var rapierPromise = null, ready = false, starting = false;
    var raf = 0, lastFrame = 0, accumulator = 0, hudTimer = 0;
    var paused = false, garage = false, cameraMode = 0;
    var distance = 0, displaySpeed = 0, unit = 'mph', sound = true;
    var nitro = 100, driftScore = 0, steerVisual = 0;
    var currentGear = 'D', gearLabel = 'D';
    var gearIndex = 1, manualGearTimer = 0, revLevel = 0;
    var GEAR_TOPS = [0.14, 0.24, 0.35, 0.47, 0.60, 0.73, 0.86, 1.0];
    var camPos = null, camTarget = null;
    var resetClock = 0, flipTime = 0, toastTimer = 0;
    var opts = {};
    var spawnZ = START_Z;
    var keyHandlers = null;
    var selectedCar = null, carCosmetics = null;
    var driveMaxSpeed = 67, driveAccel = 1, driveGrip = 3.25;
    var laneCenters = [-9.16, -5.5, -1.83, 1.83, 5.5, 9.16];
    var traffic = [], coinPickups = [], trafficTimer = 0;
    var remoteRacers = {}, localRacerName = '';
    var runOver = false, runSeconds = 0, coinsCollected = 0, coinsAwarded = false, scoreSubmitted = false;
    var fsdActive = false, fsdLane = 2, fsdThink = 0, fsdSteerTarget = 0, fsdBrake = false, fsdThrottle = false;
    var lastPlayerZ = START_Z;
    var audioCtx = null, audioMaster = null, audioCompressor = null, audioListeners = null;
    var audioSamples = {}, audioLoops = {}, audioSynth = null;
    var trafficPaintCache = {};
    var trafficShared = null;
    var coinMaterial = null;

    var TRAFFIC_SPECS = {
        sedan: { w: 1.82, l: 4.3, bodyH: 0.42, cabinH: 0.38, cabinL: 1.75, cabinZ: -0.10, y: 0.60 },
        sport: { w: 1.88, l: 4.35, bodyH: 0.34, cabinH: 0.30, cabinL: 1.45, cabinZ: -0.05, y: 0.54 },
        suv:   { w: 1.98, l: 4.75, bodyH: 0.58, cabinH: 0.48, cabinL: 2.25, cabinZ: -0.20, y: 0.72 },
        van:   { w: 2.02, l: 5.2, bodyH: 0.68, cabinH: 0.56, cabinL: 2.85, cabinZ: -0.25, y: 0.80 },
        truck: { w: 2.35, l: 7.0, bodyH: 0.72, cabinH: 0.78, cabinL: 1.95, cabinZ: 2.20, y: 0.82 },
        bus:   { w: 2.52, l: 9.4, bodyH: 1.34, cabinH: 0.62, cabinL: 7.3, cabinZ: -0.30, y: 1.02 }
    };

    var input = {
        throttle: false, brake: false, left: false, right: false,
        drift: false, nitro: false, pointerSteer: 0, pointerActive: false
    };

    function $(id) { return document.getElementById(id); }
    function num(v, fallback) { v = Number(v); return isFinite(v) ? v : fallback; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function setText(id, value) {
        var el = $(id);
        if (el && el.textContent !== String(value)) el.textContent = String(value);
    }
    function isLowPower() {
        var cores = (global.navigator && global.navigator.hardwareConcurrency) || 8;
        var mem = (global.navigator && global.navigator.deviceMemory) || 8;
        return cores <= 4 || mem <= 4;
    }
    function showToast(text) {
        var el = $('g3dGaugeStatus');
        if (el) {
            el.textContent = text;
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { toastTimer = 0; }, 2600);
        }
    }

    function color3(hex) {
        if (typeof hex === 'string') {
            var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
            hex = m ? parseInt(m[1], 16) : 0x8a6f5a;
        }
        hex = num(hex, 0x8a6f5a) | 0;
        return new BABYLON.Color3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
    }

    function setRunCoins(value) {
        var el = $('g3dRunCoins');
        if (el) el.textContent = String(value);
    }

    function runScore() {
        return Math.floor(distance + coinsCollected * 120 + driftScore);
    }

    /* --------------------------------------------------------------------
       Web Audio: sampled engine/wind with synthesized fallback
       -------------------------------------------------------------------- */
    function makeAudioLoop(buffer) {
        if (!audioCtx || !buffer) return null;
        var src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        var gain = audioCtx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        gain.connect(audioMaster);
        try { src.start(0); } catch (e) {}
        return { src: src, gain: gain };
    }

    function decodeAudio(url) {
        return fetch(url, { cache: 'force-cache' }).then(function (response) {
            if (!response.ok) throw new Error('audio ' + url);
            return response.arrayBuffer();
        }).then(function (data) {
            return new Promise(function (resolve, reject) {
                audioCtx.decodeAudioData(data, resolve, reject);
            });
        });
    }

    function loadAudioSamples() {
        if (!audioCtx) return;
        var names = ['engineLow', 'engineHigh', 'windLow', 'windHigh', 'gear', 'crash'];
        var urls = [
            'audio/engine-low.mp3', 'audio/engine-high.mp3',
            'audio/wind-low.mp3', 'audio/wind-high.mp3',
            'audio/gear-select.mp3', 'audio/crash.mp3'
        ];
        Promise.all(urls.map(function (url) {
            return decodeAudio(url).catch(function () { return null; });
        })).then(function (buffers) {
            if (!audioCtx) return;
            for (var i = 0; i < names.length; i++) audioSamples[names[i]] = buffers[i];
            if (buffers[0]) audioLoops.engineLow = makeAudioLoop(buffers[0]);
            if (buffers[1]) audioLoops.engineHigh = makeAudioLoop(buffers[1]);
            if (buffers[2]) audioLoops.windLow = makeAudioLoop(buffers[2]);
            if (buffers[3]) audioLoops.windHigh = makeAudioLoop(buffers[3]);
        }).catch(function () {
            // Synthesized engine/wind remain available if a sample is missing.
        });
    }

    function initAudio() {
        if (audioCtx) return;
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        try {
            audioCtx = new AC();
            audioMaster = audioCtx.createGain();
            audioMaster.gain.value = sound ? 0.34 : 0;
            audioCompressor = audioCtx.createDynamicsCompressor();
            audioCompressor.threshold.value = -18;
            audioCompressor.knee.value = 18;
            audioCompressor.ratio.value = 5;
            audioCompressor.attack.value = 0.004;
            audioCompressor.release.value = 0.2;
            audioMaster.connect(audioCompressor);
            audioCompressor.connect(audioCtx.destination);

            var engineFilter = audioCtx.createBiquadFilter();
            engineFilter.type = 'lowpass';
            engineFilter.frequency.value = 780;
            var engineGain = audioCtx.createGain();
            engineGain.gain.value = 0;
            engineFilter.connect(engineGain);
            engineGain.connect(audioMaster);
            var engineOsc = audioCtx.createOscillator();
            engineOsc.type = 'sawtooth';
            engineOsc.frequency.value = 52;
            engineOsc.connect(engineFilter);
            var subOsc = audioCtx.createOscillator();
            subOsc.type = 'triangle';
            subOsc.frequency.value = 80;
            var subGain = audioCtx.createGain();
            subGain.gain.value = 0.35;
            subOsc.connect(subGain);
            subGain.connect(engineFilter);
            try { engineOsc.start(); subOsc.start(); } catch (e) {}

            var noiseLen = Math.floor(audioCtx.sampleRate * 1.2);
            var noiseBuffer = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
            var noiseData = noiseBuffer.getChannelData(0);
            for (var n = 0; n < noiseLen; n++) noiseData[n] = Math.random() * 2 - 1;
            var windFilter = audioCtx.createBiquadFilter();
            windFilter.type = 'bandpass';
            windFilter.frequency.value = 760;
            windFilter.Q.value = 0.55;
            var windGain = audioCtx.createGain();
            windGain.gain.value = 0;
            var windSrc = audioCtx.createBufferSource();
            windSrc.buffer = noiseBuffer;
            windSrc.loop = true;
            windSrc.connect(windFilter);
            windFilter.connect(windGain);
            windGain.connect(audioMaster);
            try { windSrc.start(0); } catch (e) {}

            audioSynth = {
                engineFilter: engineFilter,
                engineGain: engineGain,
                engineOsc: engineOsc,
                subOsc: subOsc,
                windFilter: windFilter,
                windGain: windGain,
                windSrc: windSrc
            };

            audioListeners = function () {
                if (!audioCtx) return;
                if (audioCtx.state === 'suspended') {
                    var p = audioCtx.resume();
                    if (p && p.catch) p.catch(function () {});
                }
            };
            document.addEventListener('pointerdown', audioListeners, { passive: true });
            document.addEventListener('keydown', audioListeners);
            audioListeners();
            loadAudioSamples();
        } catch (e) {
            audioCtx = null;
            audioSynth = null;
        }
    }

    function stopAudio() {
        if (audioListeners) {
            document.removeEventListener('pointerdown', audioListeners);
            document.removeEventListener('keydown', audioListeners);
            audioListeners = null;
        }
        Object.keys(audioLoops).forEach(function (key) {
            var loop = audioLoops[key];
            if (!loop) return;
            try { loop.src.stop(); } catch (e) {}
            try { loop.src.disconnect(); } catch (e) {}
        });
        audioLoops = {};
        if (audioSynth) {
            try { audioSynth.engineOsc.stop(); } catch (e) {}
            try { audioSynth.subOsc.stop(); } catch (e) {}
            try { audioSynth.windSrc.stop(); } catch (e) {}
            audioSynth = null;
        }
        if (audioCtx) {
            try { audioCtx.close(); } catch (e) {}
        }
        audioCtx = null;
        audioMaster = null;
        audioCompressor = null;
        audioSamples = {};
    }

    function playTone(freq, duration, type, volume, endFreq) {
        if (!sound || !audioCtx || !audioMaster) return;
        try {
            var now = audioCtx.currentTime;
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
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

    function playAudioSample(name, volume, rate) {
        if (!sound || !audioCtx || !audioMaster || !audioSamples[name]) return false;
        try {
            var src = audioCtx.createBufferSource();
            src.buffer = audioSamples[name];
            src.playbackRate.value = rate || 1;
            var gain = audioCtx.createGain();
            gain.gain.value = volume || 0.3;
            src.connect(gain);
            gain.connect(audioMaster);
            src.start(0);
            return true;
        } catch (e) { return false; }
    }

    function playCoinSound() {
        if (!playAudioSample('coin', 0.28, 0.96 + Math.random() * 0.1)) {
            playTone(980, 0.10, 'square', 0.045, 1460);
            setTimeout(function () { playTone(1460, 0.10, 'square', 0.035, 1850); }, 55);
        }
    }

    function playCrashSound() {
        if (!playAudioSample('crash', 0.62, 0.94 + Math.random() * 0.12)) {
            playTone(110, 0.42, 'sawtooth', 0.18, 34);
        }
    }

    function playGearSound() {
        if (!playAudioSample('gear', 0.24, 0.96 + Math.random() * 0.1)) {
            playTone(240, 0.06, 'square', 0.035, 160);
        }
    }

    function updateAudio() {
        if (!audioCtx || !audioSynth || !audioMaster) return;
        try {
            var now = audioCtx.currentTime;
            var speed = displaySpeed || 0;
            var running = active && ready && !runOver && !paused;
            var freeRev = currentGear === 'P' || currentGear === 'N';
            var rev = freeRev
                ? revLevel
                : clamp(speed / Math.max(18, driveMaxSpeed) + (input.throttle ? 0.14 : 0) + (input.nitro && nitro > 0 ? 0.18 : 0), 0, 1);
            if (garage) { running = true; rev = 0.06; }
            var hasEngine = !!(audioLoops.engineLow && audioLoops.engineHigh);
            var hasWind = !!(audioLoops.windLow && audioLoops.windHigh);
            var synthGain = running ? (hasEngine ? 0.006 : 0.035 + rev * 0.025) : 0;
            audioSynth.engineGain.gain.setTargetAtTime(synthGain, now, 0.08);
            audioSynth.engineOsc.frequency.setTargetAtTime(48 + rev * 165, now, 0.06);
            audioSynth.subOsc.frequency.setTargetAtTime(76 + rev * 236, now, 0.06);
            audioSynth.engineFilter.frequency.setTargetAtTime(460 + speed * 12 + (input.nitro && nitro > 0 ? 360 : 0), now, 0.1);
            audioSynth.windGain.gain.setTargetAtTime(running && !hasWind ? Math.min(0.08, speed / 900) : 0, now, 0.12);
            audioSynth.windFilter.frequency.setTargetAtTime(520 + speed * 8, now, 0.12);

            if (hasEngine) {
                audioLoops.engineLow.gain.gain.setTargetAtTime(running ? 0.10 + rev * 0.17 : 0, now, 0.09);
                audioLoops.engineHigh.gain.gain.setTargetAtTime(running ? Math.max(0, rev - 0.35) * 0.30 : 0, now, 0.09);
                audioLoops.engineLow.src.playbackRate.setTargetAtTime(0.78 + rev * 0.96, now, 0.1);
                audioLoops.engineHigh.src.playbackRate.setTargetAtTime(0.86 + rev * 1.18, now, 0.1);
            }
            if (hasWind) {
                var windFrac = Math.min(1, speed / 95);
                audioLoops.windLow.gain.gain.setTargetAtTime(running ? 0.025 + windFrac * 0.14 : 0, now, 0.12);
                audioLoops.windHigh.gain.gain.setTargetAtTime(running ? Math.max(0, windFrac - 0.4) * 0.28 : 0, now, 0.12);
                audioLoops.windLow.src.playbackRate.setTargetAtTime(0.82 + windFrac * 0.52, now, 0.14);
                audioLoops.windHigh.src.playbackRate.setTargetAtTime(0.9 + windFrac * 0.7, now, 0.14);
            }
            audioMaster.gain.setTargetAtTime(sound ? 0.34 : 0, now, 0.1);
        } catch (e) {}
    }

    function loadRapier() {
        if (rapier) return Promise.resolve(rapier);
        if (!rapierPromise) {
            rapierPromise = import(RAPIER_URL).then(function (mod) {
                var api = mod && mod.default ? mod.default : mod;
                return Promise.resolve(api.init ? api.init() : null).then(function () {
                    rapier = api;
                    return api;
                });
            }).catch(function (error) {
                rapierPromise = null;
                throw error;
            });
        }
        return rapierPromise;
    }

    /* --------------------------------------------------------------------
       Scene / visuals
       -------------------------------------------------------------------- */

    function createSky() {
        try {
            if (!BABYLON.Effect.ShadersStore['lessfunSkyVertexShader']) {
                BABYLON.Effect.ShadersStore['lessfunSkyVertexShader'] =
                    'precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 vDir;' +
                    'void main(void){vDir=position;gl_Position=worldViewProjection*vec4(position,1.0);}';
                BABYLON.Effect.ShadersStore['lessfunSkyFragmentShader'] =
                    'precision highp float;varying vec3 vDir;' +
                    'void main(void){' +
                    'vec3 d=normalize(vDir);float h=clamp(d.y*0.5+0.5,0.0,1.0);' +
                    'vec3 low=vec3(0.96,0.54,0.33);vec3 mid=vec3(0.34,0.55,0.72);vec3 top=vec3(0.055,0.14,0.29);' +
                    'vec3 col=mix(low,mid,smoothstep(0.42,0.62,h));col=mix(col,top,smoothstep(0.58,0.94,h));' +
                    'float sun=smoothstep(0.99955,0.99985,dot(d,normalize(vec3(-0.38,0.22,0.90))));' +
                    'col+=vec3(1.0,0.72,0.35)*sun*0.9;' +
                    'gl_FragColor=vec4(col,1.0);}';
            }
            var mat = new BABYLON.ShaderMaterial('lessfunSky', scene, {
                vertex: 'lessfunSky',
                fragment: 'lessfunSky'
            }, {
                attributes: ['position'],
                uniforms: ['worldViewProjection']
            });
            mat.backFaceCulling = false;
            mat.disableDepthWrite = true;
            mat.freeze();
            sky = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 2400, segments: 20, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
            sky.material = mat;
            sky.infiniteDistance = true;
            sky.isPickable = false;
            sky.applyFog = false;
        } catch (e) {
            scene.clearColor = new BABYLON.Color4(0.10, 0.18, 0.26, 1);
        }
    }

    function makeBakedRoadTexture() {
        var size = 512;
        var tex = new BABYLON.DynamicTexture('bakedRoadLighting', { width: size, height: size }, scene, false);
        var ctx = tex.getContext();
        var i, x, y, g;

        ctx.fillStyle = '#262a2e';
        ctx.fillRect(0, 0, size, size);

        // Fine aggregate and long tar repairs baked into the albedo.
        for (i = 0; i < 3400; i++) {
            x = Math.random() * size;
            y = Math.random() * size;
            var a = 0.018 + Math.random() * 0.05;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + (a + 0.02) + ')';
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 5);
        }
        ctx.strokeStyle = 'rgba(9,10,12,0.26)';
        ctx.lineWidth = 2;
        for (i = 0; i < 5; i++) {
            ctx.beginPath();
            y = Math.random() * size;
            ctx.moveTo(0, y);
            for (x = 0; x <= size; x += 32) {
                y += (Math.random() - 0.5) * 8;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Shoulder / road edge baked ambient occlusion.
        var edge = ctx.createLinearGradient(0, 0, 34, 0);
        edge.addColorStop(0, 'rgba(0,0,0,0.46)');
        edge.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, 34, size);
        edge = ctx.createLinearGradient(size, 0, size - 34, 0);
        edge.addColorStop(0, 'rgba(0,0,0,0.46)');
        edge.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edge;
        ctx.fillRect(size - 34, 0, 34, size);

        // Baked pools of warm sodium light on the asphalt.
        var pools = [
            [size * 0.18, size * 0.20, 104, 0.29],
            [size * 0.82, size * 0.20, 104, 0.29],
            [size * 0.18, size * 0.70, 112, 0.24],
            [size * 0.82, size * 0.70, 112, 0.24],
            [size * 0.50, size * 0.48, 190, 0.11]
        ];
        for (i = 0; i < pools.length; i++) {
            g = ctx.createRadialGradient(pools[i][0], pools[i][1], 2, pools[i][0], pools[i][1], pools[i][2]);
            g.addColorStop(0, 'rgba(255,187,102,' + pools[i][3] + ')');
            g.addColorStop(0.42, 'rgba(255,169,76,' + (pools[i][3] * 0.45) + ')');
            g.addColorStop(1, 'rgba(255,145,55,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, size, size);
        }

        // Bake soft vehicle-width sheen down each lane.
        for (i = 0; i < 6; i++) {
            var cx = (i + 0.5) * size / 6;
            g = ctx.createLinearGradient(cx - 20, 0, cx + 20, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.028)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - 20, 0, 40, size);
        }

        // Six lanes: five interior dashed lines, solid painted shoulders.
        ctx.fillStyle = 'rgba(235,238,229,0.80)';
        for (i = 1; i <= 5; i++) {
            x = (i * size / 6) - 2;
            for (y = 8; y < size; y += 148) {
                ctx.fillRect(x, y, 4, 74);
            }
        }
        ctx.fillStyle = 'rgba(235,238,229,0.76)';
        ctx.fillRect(18, 0, 5, size);
        ctx.fillRect(size - 23, 0, 5, size);

        // Slightly brighter tyre tracks / reflected sky in the light pools.
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#e8d6b4';
        for (i = 0; i < 6; i++) {
            x = (i + 0.30) * size / 6;
            ctx.fillRect(x, 0, 3, size);
            ctx.fillRect(x + 24, 0, 3, size);
        }
        ctx.globalAlpha = 1;

        tex.update(false);
        tex.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
        tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        tex.uScale = 1;
        tex.vScale = ROAD_LENGTH / 40;
        tex.anisotropicFilteringLevel = 4;
        return tex;
    }

    function createEnvironment() {
        var low = isLowPower();
        scene.clearColor = new BABYLON.Color4(0.06, 0.11, 0.18, 1);
        scene.ambientColor = new BABYLON.Color3(0.28, 0.31, 0.38);
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.00135;
        scene.fogColor = new BABYLON.Color3(0.54, 0.48, 0.44);

        try {
            var env = BABYLON.CubeTexture.CreateFromPrefilteredData(HDR_URL, scene);
            env.name = 'hdrEnvironment';
            scene.environmentTexture = env;
            scene.environmentIntensity = 0.72;
        } catch (e) { /* baked lighting + analytic lights still work */ }

        createSky();

        var hemi = new BABYLON.HemisphericLight('skyFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.46;
        hemi.diffuse = new BABYLON.Color3(0.55, 0.72, 1.0);
        hemi.groundColor = new BABYLON.Color3(0.28, 0.22, 0.16);

        sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.36, -1.0, 0.58), scene);
        sun.position = new BABYLON.Vector3(60, 90, -90);
        sun.intensity = 2.25;
        sun.diffuse = new BABYLON.Color3(1.0, 0.77, 0.52);
        sun.specular = new BABYLON.Color3(1.0, 0.88, 0.70);
        sun.shadowMinZ = 1;
        sun.shadowMaxZ = 220;
        sun.autoUpdateExtends = false;
        sun.orthoLeft = -45;
        sun.orthoRight = 45;
        sun.orthoTop = 45;
        sun.orthoBottom = -45;

        shadow = new BABYLON.ShadowGenerator(low ? 512 : 1024, sun);
        shadow.useBlurExponentialShadowMap = true;
        shadow.blurKernel = low ? 16 : 28;
        shadow.darkness = 0.34;
        shadow.bias = 0.0015;

        var road = BABYLON.MeshBuilder.CreateGround('coastalRoad', {
            width: ROAD_WIDTH, height: ROAD_LENGTH, subdivisions: 1
        }, scene);
        road.position.y = 0.02;
        road.position.z = ROAD_LENGTH / 2;
        road.receiveShadows = true;
        var roadMat = new BABYLON.PBRMaterial('bakedRoadMaterial', scene);
        roadMat.albedoTexture = makeBakedRoadTexture();
        roadMat.albedoColor = new BABYLON.Color3(1, 1, 1);
        roadMat.metallic = 0.06;
        roadMat.roughness = 0.76;
        roadMat.environmentIntensity = 0.55;
        road.material = roadMat;
        road.freezeWorldMatrix();

        var sand = BABYLON.MeshBuilder.CreateGround('beachSand', {
            width: 180, height: ROAD_LENGTH, subdivisions: 1
        }, scene);
        sand.position.y = -0.18;
        sand.position.z = ROAD_LENGTH / 2;
        var sandMat = new BABYLON.PBRMaterial('sandMaterial', scene);
        sandMat.albedoColor = new BABYLON.Color3(0.58, 0.47, 0.32);
        sandMat.metallic = 0;
        sandMat.roughness = 0.96;
        sand.material = sandMat;
        sand.freezeWorldMatrix();

        var water = BABYLON.MeshBuilder.CreateGround('ocean', {
            width: 1400, height: ROAD_LENGTH + 600, subdivisions: 1
        }, scene);
        water.position.y = -0.52;
        water.position.z = ROAD_LENGTH / 2;
        var waterMat = new BABYLON.PBRMaterial('oceanMaterial', scene);
        waterMat.albedoColor = new BABYLON.Color3(0.035, 0.19, 0.31);
        waterMat.metallic = 0.38;
        waterMat.roughness = 0.12;
        waterMat.environmentIntensity = 1.0;
        water.material = waterMat;
        water.freezeWorldMatrix();

        // Concrete guardrails keep the car on the coastal road.
        var railMat = new BABYLON.PBRMaterial('guardrailMaterial', scene);
        railMat.albedoColor = new BABYLON.Color3(0.24, 0.27, 0.29);
        railMat.metallic = 0.55;
        railMat.roughness = 0.45;
        [-1, 1].forEach(function (side) {
            var rail = BABYLON.MeshBuilder.CreateBox('guardrail' + side, {
                width: 0.32, height: 0.82, depth: ROAD_LENGTH
            }, scene);
            rail.position.set(side * (ROAD_WIDTH / 2 + 0.5), 0.41, ROAD_LENGTH / 2);
            rail.material = railMat;
            rail.receiveShadows = true;
            rail.freezeWorldMatrix();
        });

        createRoadsideLights(low);
        createPalms(low);
    }

    function createRoadsideLights(low) {
        var poleMat = new BABYLON.PBRMaterial('lampPole', scene);
        poleMat.albedoColor = new BABYLON.Color3(0.18, 0.20, 0.22);
        poleMat.metallic = 0.72;
        poleMat.roughness = 0.35;
        var bulbMat = new BABYLON.StandardMaterial('lampBulb', scene);
        bulbMat.diffuseColor = new BABYLON.Color3(1, 0.72, 0.36);
        bulbMat.emissiveColor = new BABYLON.Color3(1, 0.54, 0.18);
        bulbMat.disableLighting = true;

        var pole = BABYLON.MeshBuilder.CreateCylinder('lampPoleSource', { height: 7.6, diameter: 0.19, tessellation: 8 }, scene);
        pole.material = poleMat;
        pole.isVisible = false;
        var arm = BABYLON.MeshBuilder.CreateBox('lampArmSource', { width: 2.1, height: 0.14, depth: 0.14 }, scene);
        arm.material = poleMat;
        arm.isVisible = false;
        var bulb = BABYLON.MeshBuilder.CreateSphere('lampBulbSource', { diameter: 0.46, segments: 8 }, scene);
        bulb.material = bulbMat;
        bulb.isVisible = false;

        var count = low ? 70 : 130;
        for (var side = -1; side <= 1; side += 2) {
            for (var i = 0; i < count; i++) {
                var z = 40 + i * (ROAD_LENGTH / count);
                var x = side * (ROAD_WIDTH / 2 + 1.55);
                var p = pole.createInstance('lampPole' + side + '_' + i);
                p.position.set(x, 3.8, z);
                p.freezeWorldMatrix();
                var a = arm.createInstance('lampArm' + side + '_' + i);
                a.position.set(x - side * 1.02, 7.46, z);
                a.freezeWorldMatrix();
                var b = bulb.createInstance('lampBulb' + side + '_' + i);
                b.position.set(x - side * 2.0, 7.33, z);
                b.freezeWorldMatrix();
            }
        }
    }

    function createPalms(low) {
        var trunkMat = new BABYLON.PBRMaterial('palmTrunk', scene);
        trunkMat.albedoColor = new BABYLON.Color3(0.30, 0.22, 0.13);
        trunkMat.roughness = 0.94;
        var leafMat = new BABYLON.PBRMaterial('palmLeaf', scene);
        leafMat.albedoColor = new BABYLON.Color3(0.075, 0.25, 0.11);
        leafMat.roughness = 0.88;
        leafMat.backFaceCulling = false;

        var trunk = BABYLON.MeshBuilder.CreateCylinder('palmTrunkSource', { height: 6.2, diameterTop: 0.2, diameterBottom: 0.42, tessellation: 7 }, scene);
        trunk.material = trunkMat;
        trunk.isVisible = false;
        var crown = BABYLON.MeshBuilder.CreateSphere('palmCrownSource', { diameter: 3.8, segments: 6, slice: 0.55 }, scene);
        crown.material = leafMat;
        crown.isVisible = false;

        var count = low ? 22 : 38;
        for (var side = -1; side <= 1; side += 2) {
            for (var i = 0; i < count; i++) {
                var z = 80 + i * (ROAD_LENGTH / count) + (i % 3) * 9;
                var x = side * (32 + (i % 4) * 4.5);
                var t = trunk.createInstance('palmTrunk' + side + '_' + i);
                t.position.set(x, 3.0, z);
                t.rotation.y = i * 1.7;
                t.freezeWorldMatrix();
                var c = crown.createInstance('palmCrown' + side + '_' + i);
                c.position.set(x, 6.25, z);
                c.rotation.y = i * 0.8;
                c.scaling.set(1, 0.42, 1);
                c.freezeWorldMatrix();
            }
        }
    }

    function createContactShadow() {
        var tex = new BABYLON.DynamicTexture('bakedContactShadow', { width: 128, height: 128 }, scene, false);
        var ctx = tex.getContext();
        ctx.clearRect(0, 0, 128, 128);
        var g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
        g.addColorStop(0, 'rgba(0,0,0,0.62)');
        g.addColorStop(0.42, 'rgba(0,0,0,0.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        tex.update(false);
        tex.hasAlpha = true;
        var mat = new BABYLON.StandardMaterial('bakedContactShadowMaterial', scene);
        mat.diffuseTexture = tex;
        mat.diffuseTexture.hasAlpha = true;
        mat.useAlphaFromDiffuseTexture = true;
        mat.opacityTexture = tex;
        mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        contactShadow = BABYLON.MeshBuilder.CreateGround('carContactShadow', { width: 3.1, height: 5.3 }, scene);
        contactShadow.material = mat;
        contactShadow.isPickable = false;
        contactShadow.position.y = 0.045;
    }

    function createCar() {
        carRoot = new BABYLON.TransformNode('babylonRacerCar', scene);
        var style = selectedCar ? String(selectedCar.style || '') : '';
        var paintHex = selectedCar && selectedCar.threeColor != null
            ? selectedCar.threeColor
            : (carCosmetics && carCosmetics.paint != null ? carCosmetics.paint : 0xc2280b);
        carPaintHex = paintHex;
        isSanta = !!(selectedCar && selectedCar.id === 'car_santa');
        var longScale = style === 'limo' || style === 'bus' ? 1.16 : (style === 'truck' || style === 'suv' || style === 'van' ? 1.06 : 1);
        var wideScale = style === 'truck' || style === 'suv' || style === 'bus' ? 1.06 : 1;
        carRoot.scaling.set(wideScale, 1, longScale);
        var paint = new BABYLON.PBRMaterial('racerPaint', scene);
        paint.albedoColor = color3(paintHex);
        paint.metallic = style === 'f1' ? 0.35 : 0.72;
        paint.roughness = 0.24;
        paint.clearCoat.isEnabled = true;
        paint.clearCoat.intensity = 0.8;
        paint.clearCoat.roughness = 0.13;

        var carbon = new BABYLON.PBRMaterial('racerCarbon', scene);
        carbon.albedoColor = new BABYLON.Color3(0.025, 0.028, 0.032);
        carbon.metallic = 0.35;
        carbon.roughness = 0.32;

        var glass = new BABYLON.PBRMaterial('racerGlass', scene);
        glass.albedoColor = new BABYLON.Color3(0.015, 0.035, 0.06);
        glass.metallic = 0.1;
        glass.roughness = 0.06;
        glass.alpha = 0.78;
        glass.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

        var chrome = new BABYLON.PBRMaterial('racerChrome', scene);
        chrome.albedoColor = new BABYLON.Color3(0.78, 0.81, 0.84);
        chrome.metallic = 0.95;
        chrome.roughness = 0.16;

        var headMat = new BABYLON.StandardMaterial('headlightMaterial', scene);
        headMat.diffuseColor = new BABYLON.Color3(1, 0.92, 0.75);
        headMat.emissiveColor = new BABYLON.Color3(1, 0.82, 0.52);
        headMat.disableLighting = true;

        var tailMat = new BABYLON.StandardMaterial('taillightMaterial', scene);
        tailMat.diffuseColor = new BABYLON.Color3(0.7, 0.02, 0.03);
        tailMat.emissiveColor = new BABYLON.Color3(1, 0.02, 0.02);
        tailMat.disableLighting = true;

        function box(name, w, h, d, x, y, z, mat, parent) {
            var m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            m.position.set(x, y, z);
            m.material = mat;
            m.parent = parent || carRoot;
            m.receiveShadows = true;
            if (shadow) shadow.addShadowCaster(m, true);
            carVisuals.push(m);
            return m;
        }

        // Wide low body and long nose.
        box('bodyLower', 1.82, 0.34, 4.35, 0, 0.03, 0, paint);
        box('bodyUpper', 1.58, 0.26, 2.55, 0, 0.28, 0.36, paint);
        box('nose', 1.66, 0.24, 1.44, 0, 0.29, 1.58, paint);
        box('rearDeck', 1.62, 0.28, 1.15, 0, 0.32, -1.60, paint);
        box('sideSkirtL', 0.12, 0.20, 2.9, -0.92, -0.10, 0.05, carbon);
        box('sideSkirtR', 0.12, 0.20, 2.9, 0.92, -0.10, 0.05, carbon);
        box('splitter', 1.82, 0.09, 0.62, 0, -0.12, 2.12, carbon);
        box('diffuser', 1.54, 0.12, 0.52, 0, -0.10, -2.12, carbon);

        // Cabin and tinted glass.
        box('cabin', 1.34, 0.46, 1.48, 0, 0.60, -0.15, paint);
        box('windshield', 1.22, 0.34, 0.20, 0, 0.68, 0.60, glass);
        box('rearGlass', 1.20, 0.31, 0.18, 0, 0.66, -0.92, glass);
        box('sideGlassL', 0.025, 0.30, 1.12, -0.69, 0.69, -0.15, glass);
        box('sideGlassR', 0.025, 0.30, 1.12, 0.69, 0.69, -0.15, glass);

        // Rear wing.
        box('wing', 1.62, 0.07, 0.35, 0, 0.72, -1.92, carbon);
        box('wingPostL', 0.07, 0.32, 0.13, -0.52, 0.53, -1.92, carbon);
        box('wingPostR', 0.07, 0.32, 0.13, 0.52, 0.53, -1.92, carbon);

        // Accent stripe, headlights and tail lights.
        var stripeMat = new BABYLON.PBRMaterial('racerStripe', scene);
        stripeMat.albedoColor = new BABYLON.Color3(0.94, 0.77, 0.32);
        stripeMat.metallic = 0.25;
        stripeMat.roughness = 0.36;
        box('stripeL', 0.055, 0.012, 3.4, -0.16, 0.47, 0.30, stripeMat);
        box('stripeR', 0.055, 0.012, 3.4, 0.16, 0.47, 0.30, stripeMat);
        box('headlightL', 0.48, 0.10, 0.06, -0.56, 0.27, 2.31, headMat);
        box('headlightR', 0.48, 0.10, 0.06, 0.56, 0.27, 2.31, headMat);
        box('tailLightL', 0.48, 0.09, 0.06, -0.52, 0.31, -2.18, tailMat);
        box('tailLightR', 0.48, 0.09, 0.06, 0.52, 0.31, -2.18, tailMat);
        box('exhaustL', 0.13, 0.10, 0.16, -0.32, -0.07, -2.22, chrome);
        box('exhaustR', 0.13, 0.10, 0.16, 0.32, -0.07, -2.22, chrome);

        // Wheels are separate pivots so they can steer and roll independently.
        var tireMat = new BABYLON.PBRMaterial('tyreMaterial', scene);
        tireMat.albedoColor = new BABYLON.Color3(0.018, 0.019, 0.022);
        tireMat.metallic = 0.0;
        tireMat.roughness = 0.88;
        var rimMat = new BABYLON.PBRMaterial('rimMaterial', scene);
        rimMat.albedoColor = carCosmetics && carCosmetics.wheel != null
            ? color3(carCosmetics.wheel)
            : new BABYLON.Color3(0.60, 0.63, 0.67);
        rimMat.metallic = 0.9;
        rimMat.roughness = 0.18;
        var brakeMat = new BABYLON.StandardMaterial('brakeDiscMaterial', scene);
        brakeMat.diffuseColor = new BABYLON.Color3(0.16, 0.17, 0.18);
        brakeMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

        function wheel(name, x, z, front) {
            var pivot = new BABYLON.TransformNode(name + 'Pivot', scene);
            pivot.parent = carRoot;
            pivot.position.set(x, -0.42, z);
            var spin = new BABYLON.TransformNode(name + 'Spin', scene);
            spin.parent = pivot;
            var tire = BABYLON.MeshBuilder.CreateCylinder(name + 'Tyre', { height: 0.30, diameter: 0.72, tessellation: 20 }, scene);
            tire.rotation.z = Math.PI / 2;
            tire.material = tireMat;
            tire.parent = spin;
            tire.receiveShadows = true;
            if (shadow) shadow.addShadowCaster(tire, true);
            var rim = BABYLON.MeshBuilder.CreateCylinder(name + 'Rim', { height: 0.315, diameter: 0.43, tessellation: 12 }, scene);
            rim.rotation.z = Math.PI / 2;
            rim.material = rimMat;
            rim.parent = spin;
            var disc = BABYLON.MeshBuilder.CreateCylinder(name + 'Disc', { height: 0.325, diameter: 0.31, tessellation: 12 }, scene);
            disc.rotation.z = Math.PI / 2;
            disc.material = brakeMat;
            disc.parent = spin;
            wheelPivots.push({ node: pivot, front: !!front });
            wheelSpins.push(spin);
        }
        wheel('frontLeft', -0.93, 1.36, true);
        wheel('frontRight', 0.93, 1.36, true);
        wheel('rearLeft', -0.97, -1.38, false);
        wheel('rearRight', 0.97, -1.38, false);

        if (isSanta) {
            var gold = new BABYLON.PBRMaterial('sleighGold', scene);
            gold.albedoColor = new BABYLON.Color3(0.95, 0.63, 0.12);
            gold.metallic = 0.9;
            gold.roughness = 0.18;
            box('sleighRunnerL', 0.12, 0.10, 4.15, -0.88, -0.46, 0.10, gold);
            box('sleighRunnerR', 0.12, 0.10, 4.15, 0.88, -0.46, 0.10, gold);
            box('sleighSkidL', 0.16, 0.22, 0.52, -0.88, -0.34, 2.16, gold);
            box('sleighSkidR', 0.16, 0.22, 0.52, 0.88, -0.34, 2.16, gold);
            box('sleighSeatBack', 1.32, 0.32, 0.18, 0, 0.62, -1.02, gold);
            wheelPivots.forEach(function (wp) { wp.node.setEnabled(false); });
        }
    }

    function ensureTrafficShared() {
        if (trafficShared) return;
        var glass = new BABYLON.PBRMaterial('trafficGlass', scene);
        glass.albedoColor = new BABYLON.Color3(0.025, 0.045, 0.07);
        glass.metallic = 0.2;
        glass.roughness = 0.08;
        glass.alpha = 0.8;
        glass.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        var tire = new BABYLON.PBRMaterial('trafficTyre', scene);
        tire.albedoColor = new BABYLON.Color3(0.015, 0.016, 0.019);
        tire.metallic = 0;
        tire.roughness = 0.9;
        var head = new BABYLON.StandardMaterial('trafficHeadlight', scene);
        head.diffuseColor = new BABYLON.Color3(1, 0.94, 0.78);
        head.emissiveColor = new BABYLON.Color3(1, 0.86, 0.58);
        head.disableLighting = true;
        var tail = new BABYLON.StandardMaterial('trafficTaillight', scene);
        tail.diffuseColor = new BABYLON.Color3(0.7, 0.015, 0.02);
        tail.emissiveColor = new BABYLON.Color3(1, 0.02, 0.02);
        tail.disableLighting = true;
        var trim = new BABYLON.PBRMaterial('trafficTrim', scene);
        trim.albedoColor = new BABYLON.Color3(0.11, 0.12, 0.14);
        trim.metallic = 0.55;
        trim.roughness = 0.4;
        trafficShared = { glass: glass, tire: tire, head: head, tail: tail, trim: trim };
    }

    function makeTrafficCar(style, colorHex) {
        ensureTrafficShared();
        var spec = TRAFFIC_SPECS[style] || TRAFFIC_SPECS.sedan;
        var root = new BABYLON.TransformNode('traffic_' + style, scene);
        var paintKey = String(colorHex);
        if (!trafficPaintCache[paintKey]) {
            var freshPaint = new BABYLON.PBRMaterial('trafficPaint_' + paintKey, scene);
            freshPaint.albedoColor = color3(colorHex);
            freshPaint.metallic = 0.48;
            freshPaint.roughness = 0.34;
            trafficPaintCache[paintKey] = freshPaint;
        }
        var paint = trafficPaintCache[paintKey];

        function part(name, w, h, d, x, y, z, mat) {
            var m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            m.position.set(x, y, z);
            m.material = mat;
            m.parent = root;
            m.receiveShadows = true;
            if (shadow && (name === 'body' || name === 'cabin' || name === 'trailer')) shadow.addShadowCaster(m, true);
            return m;
        }

        part('body', spec.w, spec.bodyH, spec.l, 0, spec.y - spec.bodyH * 0.1, 0, paint);
        if (style === 'bus') {
            part('cabin', spec.w * 0.96, spec.cabinH, spec.cabinL, 0, spec.y + spec.bodyH * 0.46, spec.cabinZ, trafficShared.glass);
            part('roof', spec.w * 0.98, 0.12, spec.cabinL, 0, spec.y + spec.bodyH * 0.46 + spec.cabinH * 0.54, spec.cabinZ, paint);
        } else if (style === 'truck') {
            part('cabin', spec.w * 0.9, spec.cabinH, spec.cabinL, 0, spec.y + 0.1, spec.cabinZ, paint);
            part('trailer', spec.w, 1.45, 4.35, 0, spec.y + 0.45, -0.72, paint);
            part('trailerGlass', spec.w * 0.9, 0.32, 0.12, 0, spec.y + 0.1, spec.cabinZ + 0.95, trafficShared.glass);
        } else {
            part('cabin', spec.w * 0.86, spec.cabinH, spec.cabinL, 0, spec.y + spec.bodyH * 0.45, spec.cabinZ, trafficShared.glass);
            part('roof', spec.w * 0.88, 0.11, spec.cabinL, 0, spec.y + spec.bodyH * 0.45 + spec.cabinH * 0.52, spec.cabinZ, paint);
        }
        part('bumperF', spec.w * 0.92, 0.12, 0.14, 0, spec.y - spec.bodyH * 0.42, spec.l / 2 + 0.02, trafficShared.trim);
        part('bumperR', spec.w * 0.92, 0.12, 0.14, 0, spec.y - spec.bodyH * 0.42, -spec.l / 2 - 0.02, trafficShared.trim);
        part('headL', 0.38, 0.11, 0.08, -spec.w * 0.30, spec.y - spec.bodyH * 0.05, spec.l / 2 + 0.08, trafficShared.head);
        part('headR', 0.38, 0.11, 0.08, spec.w * 0.30, spec.y - spec.bodyH * 0.05, spec.l / 2 + 0.08, trafficShared.head);
        part('tailL', 0.38, 0.10, 0.08, -spec.w * 0.30, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.08, trafficShared.tail);
        part('tailR', 0.38, 0.10, 0.08, spec.w * 0.30, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.08, trafficShared.tail);

        var wheels = [];
        var wheelR = style === 'truck' || style === 'bus' ? 0.46 : 0.34;
        var wheelX = spec.w / 2 - 0.12;
        var axleZ = [spec.l * 0.33, -spec.l * 0.33];
        for (var wi = 0; wi < 2; wi++) {
            for (var side = -1; side <= 1; side += 2) {
                var wheel = BABYLON.MeshBuilder.CreateCylinder('trafficWheel', { height: 0.26, diameter: wheelR * 2, tessellation: 12 }, scene);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(side * wheelX, wheelR, axleZ[wi]);
                wheel.material = trafficShared.tire;
                wheel.parent = root;
                wheels.push(wheel);
            }
        }
        return { root: root, spec: spec, style: style, wheels: wheels, speed: 18, lane: 2, cool: 0, paint: paint };
    }

    function createTrafficBody(car) {
        if (!car || !world || !rapier || car.body) return;
        var spec = car.spec || TRAFFIC_SPECS.sedan;
        car.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(car.root.position.x, 0.62, car.root.position.z));
        car.collider = world.createCollider(rapier.ColliderDesc.cuboid(spec.w / 2, 0.42, spec.l / 2)
            .setFriction(0.5), car.body);
    }

    function placeTrafficCar(car, pz, offset) {
        car.lane = Math.floor(Math.random() * laneCenters.length);
        car.root.position.set(laneCenters[car.lane], 0, pz + offset + Math.random() * 35);
        car.root.position.z = Math.max(spawnZ + 90, car.root.position.z);
        car.speed = 6 + Math.random() * 8;
    }

    function makeCoinPickup(index) {
        if (!coinMaterial) {
            coinMaterial = new BABYLON.PBRMaterial('coinMaterial', scene);
            coinMaterial.albedoColor = new BABYLON.Color3(1, 0.72, 0.12);
            coinMaterial.emissiveColor = new BABYLON.Color3(0.9, 0.50, 0.04);
            coinMaterial.metallic = 0.9;
            coinMaterial.roughness = 0.18;
        }
        var mesh = BABYLON.MeshBuilder.CreateTorus('racerCoin' + index, { diameter: 0.82, thickness: 0.20, tessellation: 14 }, scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.material = coinMaterial;
        mesh.isPickable = false;
        return { mesh: mesh, z: 0, x: 0, active: true };
    }

    function placeCoin(coin, pz, offset) {
        var lane = Math.floor(Math.random() * laneCenters.length);
        coin.x = laneCenters[lane];
        coin.z = pz + offset + Math.random() * 24;
        coin.active = true;
        coin.mesh.setEnabled(true);
    }

    function spawnRunTraffic(initial) {
        if (!traffic.length) {
            var count = isLowPower() ? 6 : 10;
            var styles = ['sedan', 'sport', 'suv', 'sedan', 'van', 'truck', 'suv', 'bus', 'sport', 'sedan'];
            var colors = [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf78c6b, 0xf7f3e8, 0x7f8c8d, 0x9b5de5];
            for (var i = 0; i < count; i++) {
                traffic.push(makeTrafficCar(styles[i % styles.length], colors[i % colors.length]));
            }
        }
        var pz = spawnZ;
        for (var t = 0; t < traffic.length; t++) {
            placeTrafficCar(traffic[t], pz, 30 + t * (initial ? 46 : 38));
            createTrafficBody(traffic[t]);
        }
    }

    function spawnRunCoins(initial) {
        if (!coinPickups.length) {
            var count = isLowPower() ? 10 : 16;
            for (var i = 0; i < count; i++) coinPickups.push(makeCoinPickup(i));
        }
        for (var c = 0; c < coinPickups.length; c++) placeCoin(coinPickups[c], spawnZ, 18 + c * (initial ? 30 : 26));
    }

    function resetRunWorld() {
        runOver = false;
        paused = false;
        runSeconds = 0;
        coinsCollected = 0;
        coinsAwarded = false;
        scoreSubmitted = false;
        gearIndex = 1;
        manualGearTimer = 0;
        revLevel = 0;
        fsdActive = false;
        fsdThink = 0;
        setRunCoins(0);
        var over = $('g3dOver');
        if (over) over.style.display = 'none';
        spawnRunTraffic(true);
        spawnRunCoins(true);
    }

    function crashRun() {
        if (runOver || garage) return;
        runOver = true;
        paused = true;
        fsdActive = false;
        input.throttle = false; input.brake = false;
        input.left = false; input.right = false; input.nitro = false;
        var flash = $('g3dCrashFlash');
        if (flash) {
            flash.classList.add('is-active');
            setTimeout(function () { flash.classList.remove('is-active'); }, 500);
        }
        playCrashSound();
        var score = runScore();
        if (!coinsAwarded && coinsCollected > 0 && typeof opts.onCoins === 'function') {
            coinsAwarded = true;
            try { opts.onCoins(coinsCollected); } catch (e) {}
        }
        if (typeof opts.onScore === 'function') {
            scoreSubmitted = true;
            try { opts.onScore('Beach Racer', score); } catch (e) {}
        }
        if (typeof opts.onGameOver === 'function') {
            try { opts.onGameOver(score, Math.max(1, Math.floor(runSeconds))); } catch (e) {}
        }
    }

    function nearestTrafficGap(lane, pz) {
        var best = 900;
        for (var i = 0; i < traffic.length; i++) {
            var car = traffic[i];
            if (Math.abs(car.root.position.x - laneCenters[lane]) > 1.7) continue;
            var dz = car.root.position.z - pz;
            if (dz > 0 && dz < best) best = dz;
        }
        return best;
    }

    function updateFsd(dt, forwardSpeed) {
        if (!fsdActive || !chassis) return;
        var t = chassis.translation();
        fsdThink -= dt;
        if (fsdThink <= 0) {
            fsdThink = 0.28;
            var bestLane = 0;
            var bestScore = -99999;
            for (var l = 0; l < laneCenters.length; l++) {
                var gap = nearestTrafficGap(l, t.z);
                var score = Math.min(500, gap) - Math.abs(laneCenters[l] - t.x) * 3;
                if (score > bestScore) { bestScore = score; bestLane = l; }
            }
            fsdLane = bestLane;
        }
        var gapAhead = nearestTrafficGap(fsdLane, t.z);
        var safeGap = 13 + forwardSpeed * 0.55;
        fsdBrake = gapAhead < safeGap && forwardSpeed > 5;
        fsdThrottle = !fsdBrake && forwardSpeed < driveMaxSpeed * 0.74;
        fsdSteerTarget = clamp((laneCenters[fsdLane] - t.x) * 0.60, -1, 1);
    }

    function drawRemoteName(rr) {
        if (!rr || !rr.labelTexture) return;
        var ctx = rr.labelTexture.getContext();
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(3, 12, 20, 0.58)';
        ctx.fillRect(0, 8, 256, 48);
        ctx.strokeStyle = 'rgba(95, 231, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 9, 254, 46);
        ctx.fillStyle = '#eafaff';
        ctx.font = '800 24px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((rr.name || 'Racer').slice(0, 16), 128, 33);
        rr.labelTexture.update(false);
    }

    function createRemoteBody(rr) {
        if (!rr || !world || !rapier || rr.body) return;
        var spec = rr.spec || TRAFFIC_SPECS.sport;
        rr.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(rr.root.position.x, 0.62, rr.root.position.z));
        rr.collider = world.createCollider(rapier.ColliderDesc.cuboid(spec.w / 2, 0.42, spec.l / 2)
            .setFriction(0.55), rr.body);
        rr.bumpCool = 0;
    }

    function createRemoteRacer(entry) {
        var style = entry && TRAFFIC_SPECS[entry.body] ? entry.body : 'sport';
        var car = makeTrafficCar(style, entry && entry.paint != null ? entry.paint : 0xef476f);
        car.root.name = 'remoteRacer_' + String(entry.id);
        var tex = new BABYLON.DynamicTexture('remoteName_' + entry.id, { width: 256, height: 64 }, scene, false);
        tex.hasAlpha = true;
        var mat = new BABYLON.StandardMaterial('remoteNameMat_' + entry.id, scene);
        mat.diffuseTexture = tex;
        mat.diffuseTexture.hasAlpha = true;
        mat.useAlphaFromDiffuseTexture = true;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        var plane = BABYLON.MeshBuilder.CreatePlane('remoteNamePlane_' + entry.id, { width: 2.5, height: 0.62 }, scene);
        plane.parent = car.root;
        plane.position.y = 2.05;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.material = mat;
        plane.isPickable = false;
        car.labelTexture = tex;
        car.labelMaterial = mat;
        car.labelPlane = plane;
        car.name = entry.name || 'Racer';
        car.targetX = 0;
        car.targetDistance = 0;
        car.remoteSpeed = 0;
        car.bumpCool = 0;
        drawRemoteName(car);
        createRemoteBody(car);
        return car;
    }

    function disposeRemoteRacer(rr) {
        if (!rr) return;
        if (rr.body && world) {
            try { world.removeRigidBody(rr.body); } catch (e) {}
            rr.body = null;
            rr.collider = null;
        }
        try { if (rr.labelTexture) rr.labelTexture.dispose(); } catch (e) {}
        try { if (rr.labelPlane) rr.labelPlane.dispose(); } catch (e) {}
        try { if (rr.root) rr.root.dispose(false, false); } catch (e) {}
    }

    function setRemoteRacers(list) {
        if (!scene) return;
        var seen = {};
        list = Array.isArray(list) ? list : [];
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            if (!entry || !entry.id) continue;
            var id = String(entry.id);
            if (id === 'undefined' || id === 'null') continue;
            seen[id] = true;
            var rr = remoteRacers[id];
            if (!rr) {
                rr = createRemoteRacer(entry);
                remoteRacers[id] = rr;
            }
            var newName = entry.name || 'Racer';
            if (newName !== rr.name) {
                rr.name = newName;
                drawRemoteName(rr);
            }
            rr.targetX = clamp(num(entry.x, 0), -10.2, 10.2);
            rr.targetDistance = Math.max(0, num(entry.distance, 0));
            rr.remoteSpeed = Math.max(0, num(entry.speed, 0));
            rr.root.setEnabled(true);
        }
        Object.keys(remoteRacers).forEach(function (id) {
            if (!seen[id]) {
                disposeRemoteRacer(remoteRacers[id]);
                delete remoteRacers[id];
            }
        });
    }

    function multiplayerPlace() {
        var ids = Object.keys(remoteRacers);
        if (!localRacerName || !ids.length) return null;
        var list = [{ distance: distance, local: true }];
        for (var i = 0; i < ids.length; i++) {
            list.push({ distance: remoteRacers[ids[i]].targetDistance || 0, local: false });
        }
        list.sort(function (a, b) { return b.distance - a.distance; });
        var place = 1;
        for (var j = 0; j < list.length; j++) if (list[j].local) { place = j + 1; break; }
        return { place: place, total: list.length };
    }

    function updateRemoteRacers(dt) {
        if (!chassis) return;
        var p = chassis.translation();
        var pz = p.z;
        Object.keys(remoteRacers).forEach(function (id) {
            var rr = remoteRacers[id];
            var targetZ = spawnZ + rr.targetDistance;
            var dx = rr.targetX - rr.root.position.x;
            rr.root.position.x += dx * Math.min(1, dt * 7.5);
            rr.root.position.z += (targetZ - rr.root.position.z) * Math.min(1, dt * 10);
            rr.root.rotation.y = clamp(dx * 0.18, -0.38, 0.38);
            rr.bumpCool = Math.max(0, (rr.bumpCool || 0) - dt);
            for (var w = 0; w < rr.wheels.length; w++) rr.wheels[w].rotation.x += rr.remoteSpeed * dt * 3.2;
            var visible = Math.abs(targetZ - pz) < 1500;
            rr.root.setEnabled(visible);
            if (rr.body) {
                var yaw = rr.root.rotation.y;
                rr.body.setNextKinematicTranslation({ x: rr.root.position.x, y: 0.62, z: rr.root.position.z });
                rr.body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
            }
            // Solid remote car. Rapier handles contact, with an arcade bounce
            // fallback so fast players cannot tunnel through each other.
            if (!garage && !runOver && !paused && rr.bumpCool <= 0) {
                var rdx = Math.abs(p.x - rr.root.position.x);
                var rdz = Math.abs(pz - rr.root.position.z);
                if (rdx < 0.92 + rr.spec.w / 2 && rdz < 2.15 + rr.spec.l / 2) {
                    rr.bumpCool = 0.7;
                    var v = chassis.linvel();
                    var side = p.x >= rr.root.position.x ? 1 : -1;
                    chassis.setLinvel({
                        x: v.x + side * Math.min(14, 4 + Math.abs(v.z) * 0.12),
                        y: Math.max(v.y, 0.8),
                        z: v.z * 0.72
                    }, true);
                    triggerImpactFx((p.x + rr.root.position.x) * 0.5, (pz + rr.root.position.z) * 0.5, Math.abs(v.z));
                    playTone(180, 0.13, 'square', 0.055, 80);
                }
            }
        });
    }

    function updateTraffic(dt) {
        if (!chassis) return;
        var p = chassis.translation();
        var pz = p.z;
        for (var i = 0; i < traffic.length; i++) {
            var car = traffic[i];
            car.root.position.z += car.speed * dt;
            car.root.position.x += (laneCenters[car.lane] - car.root.position.x) * Math.min(1, dt * 2.4);
            for (var w = 0; w < car.wheels.length; w++) car.wheels[w].rotation.x += car.speed * dt * 3.2;
            car.cool = Math.max(0, car.cool - dt);
            if (car.root.position.z < pz - 100 || car.root.position.z > pz + 1050 || car.root.position.z > ROAD_LENGTH - 80) {
                placeTrafficCar(car, pz, 520 + Math.random() * 280);
            }
            if (car.body) {
                car.body.setNextKinematicTranslation({ x: car.root.position.x, y: 0.62, z: car.root.position.z });
                car.body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
            }
            if (runOver || garage || paused) continue;
            var dx = Math.abs(p.x - car.root.position.x);
            var dz = Math.abs(pz - car.root.position.z);
            if (dx < 0.92 + car.spec.w / 2 && dz < 2.15 + car.spec.l / 2 && car.cool <= 0) {
                car.cool = 0.9;
                // Arcade bounce: no crash/game-over. Push the car sideways and
                // back while keeping most of its forward momentum.
                var v = chassis.linvel();
                var closing = Math.max(0, displaySpeed - car.speed);
                var dirX = p.x >= car.root.position.x ? 1 : -1;
                var lateralKick = Math.min(16, 4.5 + closing * 0.45);
                var forwardKeep = Math.max(0.58, 1 - Math.min(0.32, 0.10 + closing * 0.004));
                chassis.setLinvel({
                    x: v.x + dirX * lateralKick,
                    y: Math.max(v.y, 0.65 + Math.min(1.1, closing * 0.028)),
                    z: v.z * forwardKeep
                }, true);
                chassis.setAngvel({ x: 0, y: (Math.random() - 0.5) * 1.2, z: 0 }, true);
                // Nudge the traffic car aside so the player is not stuck inside it.
                car.root.position.x += dirX * 0.35;
                car.speed = Math.max(4, car.speed * 0.9);
                var flash = $('g3dCrashFlash');
                if (flash) {
                    flash.classList.add('is-active');
                    setTimeout(function () { flash.classList.remove('is-active'); }, 140);
                }
                triggerImpactFx((p.x + car.root.position.x) * 0.5, (pz + car.root.position.z) * 0.5, closing);
                playTone(150, 0.18, 'square', 0.075, 65);
                playTone(260, 0.10, 'sawtooth', 0.045, 120);
            }
        }
    }

    function updateCoins(dt) {
        if (!chassis) return;
        var p = chassis.translation();
        for (var i = 0; i < coinPickups.length; i++) {
            var coin = coinPickups[i];
            if (coin.z < p.z - 25 || coin.z > p.z + 900) {
                placeCoin(coin, p.z, 320 + Math.random() * 550);
            }
            coin.mesh.position.set(coin.x, 1.12, coin.z);
            coin.mesh.rotation.y += dt * 3.4;
            coin.mesh.setEnabled(coin.active && Math.abs(coin.z - p.z) < 420);
            if (coin.active && !runOver && !paused && !garage &&
                Math.abs(coin.z - p.z) < 3.0 && Math.abs(coin.x - p.x) < 1.55) {
                coin.active = false;
                coin.mesh.setEnabled(false);
                coinsCollected++;
                setRunCoins(coinsCollected);
                playCoinSound();
            }
        }
    }

    function loadRealCarModel() {
        if (isSanta || !selectedCar || realCarLoading || !BABYLON.SceneLoader || !BABYLON.SceneLoader.ImportMeshAsync) return;
        var skipStyles = { truck: 1, bus: 1, van: 1, limo: 1, monster: 1, offroad: 1 };
        if (skipStyles[selectedCar.style]) return;
        realCarLoading = true;
        try {
            BABYLON.DracoCompression.Configuration.decoder = {
                wasmUrl: 'https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.js',
                wasmBinaryUrl: 'https://cdn.babylonjs.com/draco_decoder_gltf.wasm',
                fallbackUrl: 'https://cdn.babylonjs.com/draco_decoder_gltf.js'
            };
        } catch (e) {}
        BABYLON.SceneLoader.ImportMeshAsync('', 'models/', 'ferrari.glb', scene).then(function (res) {
            if (!active || !carRoot || isSanta) return;
            var root = res.meshes[0];
            if (!root) return;
            root.parent = carRoot;
            root.rotation.y = Math.PI;
            root.position.y = -0.78;
            var bodyMat = null;
            res.meshes.forEach(function (m) {
                if (!m.getTotalVertices) return;
                if (m.material && m.material.name === 'Body_Color') bodyMat = m.material;
                m.receiveShadows = true;
                if (shadow && (m.name === 'body' || m.name === 'glass' || m.name.indexOf('wheel') === 0 || m.name.indexOf('tire') === 0)) {
                    shadow.addShadowCaster(m, true);
                }
            });
            if (bodyMat) {
                if (bodyMat.albedoColor) bodyMat.albedoColor = color3(carPaintHex);
                else if (bodyMat.diffuseColor) bodyMat.diffuseColor = color3(carPaintHex);
            }
            carVisuals.forEach(function (m) { m.setEnabled(false); });
            wheelPivots.forEach(function (wp) { wp.node.setEnabled(false); });
            realCarRoot = root;
        }).catch(function () {
            // Keep the procedural car if the online model cannot load.
        });
    }

    function createImpactFx() {
        var tex = new BABYLON.DynamicTexture('impactSparkTexture', { width: 32, height: 32 }, scene, false);
        var ctx = tex.getContext();
        ctx.clearRect(0, 0, 32, 32);
        var g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
        g.addColorStop(0, 'rgba(255,245,190,1)');
        g.addColorStop(0.35, 'rgba(255,190,70,0.9)');
        g.addColorStop(1, 'rgba(255,90,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
        tex.update(false);
        tex.hasAlpha = true;
        var ps = new BABYLON.ParticleSystem('impactSparks', isLowPower() ? 50 : 100, scene);
        ps.particleTexture = tex;
        ps.emitter = new BABYLON.Vector3(0, 0.8, 0);
        ps.minEmitBox = new BABYLON.Vector3(-0.3, -0.2, -0.3);
        ps.maxEmitBox = new BABYLON.Vector3(0.3, 0.2, 0.3);
        ps.color1 = new BABYLON.Color4(1, 0.86, 0.38, 1);
        ps.color2 = new BABYLON.Color4(1, 0.35, 0.05, 1);
        ps.colorDead = new BABYLON.Color4(0.4, 0.06, 0, 0);
        ps.minSize = 0.07;
        ps.maxSize = 0.22;
        ps.minLifeTime = 0.22;
        ps.maxLifeTime = 0.65;
        ps.emitRate = 0;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.direction1 = new BABYLON.Vector3(-2.2, 0.6, -2.6);
        ps.direction2 = new BABYLON.Vector3(2.2, 3.0, 0.6);
        ps.minEmitPower = 1.5;
        ps.maxEmitPower = 5.2;
        ps.gravity = new BABYLON.Vector3(0, -9.81, 0);
        ps.start();
        impactSparks = ps;
    }

    function triggerImpactFx(x, z, intensity) {
        if (!impactSparks) return;
        impactSparks.emitter = new BABYLON.Vector3(x, 0.82, z);
        impactSparks.emitRate = 120 + Math.min(260, (intensity || 0) * 8);
        impactSparkTimer = 0.16;
        crashShake = Math.min(0.65, 0.16 + (intensity || 0) * 0.007);
    }

    function createExhaustSmoke() {
        var tex = new BABYLON.DynamicTexture('exhaustSmokeTexture', { width: 96, height: 96 }, scene, false);
        var ctx = tex.getContext();
        ctx.clearRect(0, 0, 96, 96);
        var g = ctx.createRadialGradient(48, 48, 2, 48, 48, 46);
        g.addColorStop(0, 'rgba(255,255,255,0.82)');
        g.addColorStop(0.34, 'rgba(225,225,225,0.48)');
        g.addColorStop(0.72, 'rgba(180,180,180,0.16)');
        g.addColorStop(1, 'rgba(140,140,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 96, 96);
        tex.update(false);
        tex.hasAlpha = true;
        smokeTexture = tex;

        exhaustEmitter = new BABYLON.TransformNode('exhaustSmokeEmitter', scene);
        exhaustEmitter.parent = carRoot;
        exhaustEmitter.position.set(0, -0.02, -2.28);
        var ps = new BABYLON.ParticleSystem('exhaustSmoke', isLowPower() ? 140 : 260, scene);
        ps.particleTexture = tex;
        ps.emitter = exhaustEmitter;
        ps.minEmitBox = new BABYLON.Vector3(-0.72, -0.08, -0.16);
        ps.maxEmitBox = new BABYLON.Vector3(0.72, 0.22, 0.16);
        ps.color1 = new BABYLON.Color4(0.62, 0.63, 0.66, 0.42);
        ps.color2 = new BABYLON.Color4(0.34, 0.35, 0.38, 0.28);
        ps.colorDead = new BABYLON.Color4(0.12, 0.12, 0.14, 0);
        ps.minSize = 0.50;
        ps.maxSize = 2.45;
        ps.minLifeTime = 2.0;
        ps.maxLifeTime = 3.7;
        ps.emitRate = 0;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        // Exhaust leaves the pipes and climbs upward instead of hanging low.
        ps.direction1 = new BABYLON.Vector3(-1.25, 2.2, -1.1);
        ps.direction2 = new BABYLON.Vector3(1.25, 3.7, -0.10);
        ps.minEmitPower = 1.15;
        ps.maxEmitPower = 2.55;
        ps.updateSpeed = 0.02;
        ps.gravity = new BABYLON.Vector3(0, 1.45, 0);
        ps.minAngularSpeed = -0.8;
        ps.maxAngularSpeed = 0.8;
        ps.start();
        exhaustSmoke = ps;
    }

    function createDriftSmoke() {
        if (!smokeTexture) return;
        driftEmitter = new BABYLON.TransformNode('driftSmokeEmitter', scene);
        driftEmitter.parent = carRoot;
        driftEmitter.position.set(0, -0.38, -1.35);
        var ps = new BABYLON.ParticleSystem('driftSmoke', isLowPower() ? 90 : 160, scene);
        ps.particleTexture = smokeTexture;
        ps.emitter = driftEmitter;
        ps.minEmitBox = new BABYLON.Vector3(-0.95, -0.12, -0.35);
        ps.maxEmitBox = new BABYLON.Vector3(0.95, 0.18, 0.35);
        ps.color1 = new BABYLON.Color4(0.78, 0.78, 0.80, 0.38);
        ps.color2 = new BABYLON.Color4(0.46, 0.46, 0.49, 0.24);
        ps.colorDead = new BABYLON.Color4(0.18, 0.18, 0.20, 0);
        ps.minSize = 0.38;
        ps.maxSize = 1.35;
        ps.minLifeTime = 0.55;
        ps.maxLifeTime = 1.35;
        ps.emitRate = 0;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        ps.direction1 = new BABYLON.Vector3(-1.7, 0.35, -1.1);
        ps.direction2 = new BABYLON.Vector3(1.7, 1.15, 0.5);
        ps.minEmitPower = 0.45;
        ps.maxEmitPower = 1.8;
        ps.updateSpeed = 0.02;
        ps.gravity = new BABYLON.Vector3(0, 0.55, 0);
        ps.minAngularSpeed = -1.2;
        ps.maxAngularSpeed = 1.2;
        ps.start();
        driftSmoke = ps;
    }

    function createMotionBlur() {
        if (!BABYLON.Effect.ShadersStore['lessfunMotionBlurFragmentShader']) {
            BABYLON.Effect.ShadersStore['lessfunMotionBlurFragmentShader'] =
                'precision highp float;' +
                'varying vec2 vUV;' +
                'uniform sampler2D textureSampler;' +
                'uniform float strength;' +
                'void main(void){' +
                '  vec2 dir = vUV - vec2(0.5);' +
                '  float amount = strength * (0.35 + length(dir) * 1.8);' +
                '  vec4 sum = vec4(0.0); float weights = 0.0;' +
                '  for (int i = 0; i < 6; i++) {' +
                '    float t = float(i) / 5.0;' +
                '    float w = 1.0 - t * 0.45;' +
                '    sum += texture2D(textureSampler, vUV - dir * amount * t) * w;' +
                '    weights += w;' +
                '  }' +
                '  gl_FragColor = sum / weights;' +
                '}';
        }
        motionBlurPost = new BABYLON.PostProcess('lessfunMotionBlur', 'lessfunMotionBlur', ['strength'], null, 1.0, camera, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine, false);
        motionBlurPost.onApply = function (effect) {
            effect.setFloat('strength', motionBlurStrength);
        };
    }

    function createScene() {
        engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            powerPreference: 'high-performance',
            doNotHandleContextLost: false
        }, false);
        engine.setHardwareScalingLevel(isLowPower() ? 1.15 : 1);

        scene = new BABYLON.Scene(engine);
        scene.useRightHandedSystem = true;
        scene.autoClear = true;
        scene.skipPointerMovePicking = true;
        scene.imageProcessingConfiguration.toneMappingEnabled = true;
        scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        scene.imageProcessingConfiguration.exposure = 1.15;
        scene.imageProcessingConfiguration.contrast = 1.08;

        camera = new BABYLON.FreeCamera('chaseCamera', new BABYLON.Vector3(0, 4.2, -11), scene);
        camera.minZ = 0.1;
        camera.maxZ = 3200;
        camera.fov = 1.03;
        camera.inertia = 0;

        createEnvironment();
        createContactShadow();
        createCar();
        createExhaustSmoke();
        createDriftSmoke();
        createImpactFx();
        loadRealCarModel();

        // Subtle cinematic pass: ACES, bloom, FXAA. Skip bloom on low-power GPUs.
        try {
            var pipeline = new BABYLON.DefaultRenderingPipeline('racerPipeline', true, scene, [camera]);
            pipeline.fxaaEnabled = true;
            pipeline.bloomEnabled = !isLowPower();
            pipeline.bloomThreshold = 0.87;
            pipeline.bloomWeight = 0.16;
            pipeline.bloomKernel = 32;
            pipeline.imageProcessingEnabled = true;
        } catch (e) {}

        createMotionBlur();
        camPos = new BABYLON.Vector3(0, 4.2, -11);
        camTarget = new BABYLON.Vector3(0, 1.0, 4);
        resetCamera(true);
    }

    /* --------------------------------------------------------------------
       Physics
       -------------------------------------------------------------------- */

    function createPhysics() {
        world = new rapier.World({ x: 0, y: -9.81, z: 0 });
        world.timestep = 1 / 60;

        var ground = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, -0.5, ROAD_LENGTH / 2));
        world.createCollider(rapier.ColliderDesc.cuboid(600, 0.5, ROAD_LENGTH / 2).setFriction(1.0), ground);

        [-1, 1].forEach(function (side) {
            var wall = world.createRigidBody(rapier.RigidBodyDesc.fixed()
                .setTranslation(side * (ROAD_WIDTH / 2 + 0.68), 0.45, ROAD_LENGTH / 2));
            world.createCollider(rapier.ColliderDesc.cuboid(0.16, 0.5, ROAD_LENGTH / 2), wall);
        });

        chassis = world.createRigidBody(rapier.RigidBodyDesc.dynamic()
            .setTranslation(0, 0.92, spawnZ)
            .setLinearDamping(0.13)
            .setAngularDamping(0.92)
            .setCanSleep(false)
            .setCcdEnabled(true));
        world.createCollider(rapier.ColliderDesc.cuboid(0.91, 0.29, 2.10).setMass(980).setFriction(0.7), chassis);

        vehicle = world.createVehicleController(chassis);
        var defs = [
            { name: 'FL', x: -0.93, z: 1.36, front: true },
            { name: 'FR', x: 0.93, z: 1.36, front: true },
            { name: 'RL', x: -0.97, z: -1.38, front: false },
            { name: 'RR', x: 0.97, z: -1.38, front: false }
        ];
        for (var i = 0; i < defs.length; i++) {
            var d = defs[i];
            vehicle.addWheel(
                { x: d.x, y: -0.16, z: d.z },
                { x: 0, y: -1, z: 0 },
                { x: -1, y: 0, z: 0 },
                0.34,
                0.35
            );
            vehicle.setWheelMaxSuspensionTravel(i, 0.26);
            vehicle.setWheelSuspensionStiffness(i, 34);
            vehicle.setWheelSuspensionCompression(i, 2.3);
            vehicle.setWheelSuspensionRelaxation(i, 1.7);
            vehicle.setWheelMaxSuspensionForce(i, 26000);
            vehicle.setWheelFrictionSlip(i, 3.25);
            vehicle.setWheelSideFrictionStiffness(i, 1.0);
        }
        ready = true;
        Object.keys(remoteRacers).forEach(function (id) { createRemoteBody(remoteRacers[id]); });
        syncCarVisual(0);
        resetRunWorld();
        setText('g3dGaugeStatus', 'BABYLON + RAPIER · HDR READY');
    }

    function applyControls(dt) {
        var speed = chassis.linvel();
        var forwardSpeed = Math.sqrt(speed.x * speed.x + speed.z * speed.z);
        var engineForce = 0;
        var brakeForce = 0;
        var nitroMax = driveMaxSpeed * 1.30;
        var throttle = input.throttle;
        var brake = input.brake;

        if (isSanta) {
            if (flyTime > 0) {
                flyTime = Math.max(0, flyTime - dt);
                chassis.setGravityScale(0.06, true);
                var fv = chassis.linvel();
                chassis.setLinvel({ x: fv.x, y: Math.max(fv.y, 1.4), z: fv.z }, true);
                if (flyTime <= 0) {
                    flyCooldown = 5;
                    chassis.setGravityScale(1, true);
                    showToast('SANTA LANDED · FLY CD 5s');
                }
            } else {
                if (flyCooldown > 0) flyCooldown = Math.max(0, flyCooldown - dt);
                chassis.setGravityScale(1, true);
            }
        }

        if (garage || runOver) {
            revLevel = Math.max(0, revLevel - dt * 2.5);
            vehicle.setWheelSteering(0, 0);
            vehicle.setWheelSteering(1, 0);
            for (var g = 0; g < 4; g++) {
                vehicle.setWheelEngineForce(g, 0);
                vehicle.setWheelBrake(g, runOver ? 48 : 22);
            }
            return;
        }

        if (currentGear === 'P' || currentGear === 'N') {
            revLevel += (throttle ? 1 : -1) * dt * (throttle ? 2.9 : 2.1);
            revLevel = clamp(revLevel, 0, 1);
        } else if (currentGear === 'R') {
            revLevel += (throttle ? 1 : -1) * dt * (throttle ? 2.4 : 2.0);
            revLevel = clamp(revLevel, 0, 1);
            if (throttle) engineForce = -1450 * driveAccel;
            if (brake) brakeForce = 26;
        } else {
            while (gearIndex < 8 && forwardSpeed > driveMaxSpeed * GEAR_TOPS[gearIndex - 1] * 0.96) gearIndex++;
            while (gearIndex > 1 && forwardSpeed < driveMaxSpeed * GEAR_TOPS[gearIndex - 2] * 0.68) gearIndex--;
            gearLabel = String(gearIndex);
            var gearPull = 1.15 - (gearIndex - 1) * 0.05;
            var boosting = input.nitro && nitro > 0 && throttle;
            var maxSpeed = boosting ? nitroMax : driveMaxSpeed;
            if (throttle && forwardSpeed < maxSpeed) {
                var falloff = 1 - (forwardSpeed / maxSpeed) * 0.88;
                engineForce = 8400 * driveAccel * gearPull * falloff;
                if (boosting) {
                    engineForce += 6400 * driveAccel;
                    nitro = Math.max(0, nitro - dt * 26);
                }
            }
            if (!boosting) nitro = Math.min(100, nitro + dt * 7.5);
            revLevel = clamp(0.10 + Math.min(1, forwardSpeed / Math.max(1, driveMaxSpeed * GEAR_TOPS[gearIndex - 1])) * 0.82 + (throttle ? 0.08 : 0), 0, 1);
            if (brake) brakeForce = 33;
        }

        // Anti-wheelie pitch control: the rear-drive launch is strong enough
        // to lift the nose, so add a small stabilising torque and trim torque
        // while the front is still lifting.
        var qNow = chassis.rotation();
        var forwardLift = 2 * (qNow.y * qNow.z - qNow.x * qNow.w);
        var carY = chassis.translation().y;
        if (forwardLift > 0.025 && carY < 1.6) {
            var antiWheelie = clamp((forwardLift - 0.025) * 3.6, 0, 1);
            engineForce *= 1 - antiWheelie * 0.72;
            chassis.applyTorqueImpulse({ x: 42000 * antiWheelie * dt, y: 0, z: 0 }, true);
            var frontPoint = chassis.translation();
            chassis.applyImpulseAtPoint(
                { x: 0, y: -1900 * antiWheelie * dt, z: 0 },
                { x: frontPoint.x, y: frontPoint.y + 0.05, z: frontPoint.z + 1.35 },
                true
            );
            var angNow = chassis.angvel();
            // Nose-up rotation is negative around X. Stop the chassis from
            // building a big wheelie while still allowing suspension pitch.
            if (angNow.x < -0.30) chassis.setAngvel({ x: -0.30, y: angNow.y, z: angNow.z }, true);
        }

        var steerMax = 0.46 - Math.min(0.36, forwardSpeed / 150);
        var steerTarget = 0;
        if (input.left) steerTarget += 1;
        if (input.right) steerTarget -= 1;
        if (input.pointerActive) steerTarget += input.pointerSteer;
        steerVisual += (steerTarget - steerVisual) * Math.min(1, dt * 10);
        var steerAngle = steerVisual * steerMax;
        vehicle.setWheelSteering(0, steerAngle);
        vehicle.setWheelSteering(1, steerAngle);
        vehicle.setWheelSteering(2, 0);
        vehicle.setWheelSteering(3, 0);

        // AWD launch distribution keeps the nose down while the front axle
        // helps pull out of corners and off the line.
        var frontForce = engineForce * 0.28;
        var rearForce = engineForce * 0.22;
        vehicle.setWheelEngineForce(0, frontForce);
        vehicle.setWheelEngineForce(1, frontForce);
        vehicle.setWheelEngineForce(2, rearForce);
        vehicle.setWheelEngineForce(3, rearForce);

        for (var i = 0; i < 4; i++) {
            vehicle.setWheelBrake(i, brakeForce);
            var rear = i >= 2;
            vehicle.setWheelFrictionSlip(i, input.drift && rear ? 0.95 : driveGrip);
        }

        // Light aerodynamic drag; keeps the car from coasting forever.
        var v = chassis.linvel();
        var drag = 0.020 * forwardSpeed;
        chassis.applyImpulse({ x: -v.x * drag * dt, y: 0, z: -v.z * drag * dt }, true);

        if (input.drift && forwardSpeed > 8) {
            driftScore += forwardSpeed * dt * 0.38;
            chassis.applyTorqueImpulse({ x: 0, y: steerVisual * 190 * dt, z: 0 }, true);
        }
        if (!input.drift && driftScore > 0) driftScore = Math.max(0, driftScore - dt * 12);
    }

    function stepPhysics(dt) {
        if (!ready) return;
        accumulator += dt;
        var steps = 0;
        while (accumulator >= 1 / 60 && steps < 3) {
            applyControls(1 / 60);
            vehicle.updateVehicle(1 / 60);
            world.step();
            accumulator -= 1 / 60;
            steps++;
        }
        if (steps === 3) accumulator = 0;

        var t = chassis.translation();
        var v = chassis.linvel();
        distance = Math.max(distance, t.z - spawnZ);
        displaySpeed = Math.sqrt(v.x * v.x + v.z * v.z);
        runSeconds += dt;
        lastPlayerZ = t.z;

        if (t.z > ROAD_LENGTH - 220) {
            chassis.setTranslation({ x: 0, y: 0.92, z: spawnZ + 20 }, true);
            chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
            resetRunWorld();
        }
        if (t.y < -3 || Math.abs(t.x) > 60 || t.z < -20) resetCar(false);
        var q = chassis.rotation();
        var upY = 1 - 2 * (q.x * q.x + q.z * q.z);
        if (upY < 0.25 && displaySpeed < 3.0) {
            flipTime += dt;
            if (flipTime > 2.2) resetCar(false);
        } else {
            flipTime = 0;
        }
    }

    function resetCar(keepDistance, silent) {
        if (!chassis) return;
        chassis.setTranslation({ x: 0, y: 0.92, z: spawnZ }, true);
        chassis.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
        if (!keepDistance) {
            distance = 0;
            driftScore = 0;
            resetRunWorld();
        }
        accumulator = 0;
        flipTime = 0;
        nitro = 100;
        flyTime = 0;
        flyCooldown = 0;
        if (chassis) chassis.setGravityScale(1, true);
        resetCamera(true);
        if (!silent) showToast('RESET · BEACH RACER');
    }

    /* --------------------------------------------------------------------
       Camera and HUD
       -------------------------------------------------------------------- */

    function resetCamera(snap) {
        if (!camera) return;
        var carPos = carRoot ? carRoot.position : new BABYLON.Vector3(0, 0.9, spawnZ);
        var target = new BABYLON.Vector3(carPos.x, carPos.y + 0.95, carPos.z + 5);
        var pos = new BABYLON.Vector3(carPos.x, carPos.y + 3.45, carPos.z - 8.7);
        if (snap) {
            camPos.copyFrom(pos);
            camTarget.copyFrom(target);
        }
        camera.position.copyFrom(camPos);
        camera.setTarget(camTarget);
    }

    function updateCamera(dt) {
        if (!camera) return;
        if (garage) {
            resetClock += dt;
            var angle = resetClock * 0.30;
            var carPos = carRoot ? carRoot.position : new BABYLON.Vector3(0, 0.9, spawnZ);
            var radius = 9.4;
            var target = new BABYLON.Vector3(carPos.x, carPos.y + 0.70, carPos.z);
            var pos = new BABYLON.Vector3(
                carPos.x + Math.sin(angle) * radius,
                carPos.y + 3.0 + Math.sin(angle * 0.6) * 0.35,
                carPos.z + Math.cos(angle) * radius
            );
            camPos = BABYLON.Vector3.Lerp(camPos, pos, 1 - Math.pow(0.001, dt));
            camTarget = BABYLON.Vector3.Lerp(camTarget, target, 1 - Math.pow(0.001, dt));
            camera.position.copyFrom(camPos);
            camera.setTarget(camTarget);
            camera.fov = 0.92;
            return;
        }
        resetClock = 0;
        var rot = carRoot && carRoot.rotationQuaternion
            ? carRoot.rotationQuaternion
            : new BABYLON.Quaternion(0, 0, 0, 1);
        var rotMatrix = rot.toRotationMatrix(new BABYLON.Matrix());
        var carPos = carRoot ? carRoot.position : new BABYLON.Vector3(0, 0.9, spawnZ);
        var forward = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, 1), rotMatrix);
        var right = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(1, 0, 0), rotMatrix);
        var speedFactor = clamp(displaySpeed / 75, 0, 1);
        var back = 8.6 + speedFactor * 1.6;
        var height = 3.35 + speedFactor * 0.35;
        var powerShake = 0;
        if (!paused && !runOver) {
            if (currentGear === 'D' || currentGear === 'R') {
                if (input.throttle) powerShake = 0.020 + speedFactor * 0.030;
                if (input.nitro && nitro > 0 && input.throttle) powerShake += 0.028;
            } else if (input.throttle) {
                powerShake = revLevel * 0.055;
            }
        }
        var shake = speedFactor * 0.035 + powerShake;
        var target = carPos.add(forward.scale(5.2)).add(new BABYLON.Vector3(0, 0.95, 0));
        var desired = carPos.subtract(forward.scale(back)).add(new BABYLON.Vector3(0, height, 0));
        desired = desired.add(right.scale(Math.sin(performance.now() * 0.031) * shake));
        desired.y += Math.sin(performance.now() * 0.047) * shake;
        if (powerShake > 0.001) {
            desired.y += Math.sin(performance.now() * 0.083) * powerShake * 0.6;
            desired.x += Math.sin(performance.now() * 0.071) * powerShake * 0.45;
        }
        if (crashShake > 0.001) {
            crashShake = Math.max(0, crashShake - dt * 2.1);
            desired.x += (Math.random() - 0.5) * crashShake;
            desired.y += (Math.random() - 0.5) * crashShake * 0.7;
            desired.z += (Math.random() - 0.5) * crashShake;
        }

        var posLerp = 1 - Math.pow(0.0009, dt);
        var targetLerp = 1 - Math.pow(0.0005, dt);
        camPos = BABYLON.Vector3.Lerp(camPos, desired, posLerp);
        camTarget = BABYLON.Vector3.Lerp(camTarget, target, targetLerp);
        camera.position.copyFrom(camPos);
        camera.setTarget(camTarget);
        camera.fov = 1.02 + speedFactor * 0.11;
    }

    function syncCarVisual(dt) {
        if (!carRoot) return;
        if (!chassis) {
            carRoot.position.set(0, 0.92, spawnZ);
            carRoot.rotationQuaternion = BABYLON.Quaternion.Identity();
            return;
        }
        var t = chassis.translation();
        var q = chassis.rotation();
        carRoot.position.set(t.x, t.y, t.z);
        var fullRot = new BABYLON.Quaternion(q.x, q.y, q.z, q.w);
        // Keep the visible body from standing up into a wheelie. The physics
        // stays intact; only the presentation pitch is limited.
        var euler = fullRot.toEulerAngles();
        var visualPitch = clamp(euler.x, -0.14, 0.14);
        carRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(visualPitch, euler.y, euler.z);

        var speed = displaySpeed || 0;
        for (var i = 0; i < wheelPivots.length; i++) {
            var wp = wheelPivots[i];
            if (vehicle) {
                var steering = vehicle.wheelSteering(i);
                var rotation = vehicle.wheelRotation(i);
                if (steering !== null && steering !== undefined) wp.node.rotation.y = steering;
                if (rotation !== null && rotation !== undefined) wheelSpins[i].rotation.x = rotation;
            } else {
                wheelSpins[i].rotation.x += speed * dt * 4.2;
            }
        }
        if (contactShadow) {
            contactShadow.position.x = t.x;
            contactShadow.position.z = t.z;
            var euler = carRoot.rotationQuaternion.toEulerAngles();
            contactShadow.rotation.y = euler.y;
        }
        if (sun) {
            sun.position.set(t.x + 60, 90, t.z - 90);
        }
    }

    function updateHud(dt) {
        hudTimer += dt;
        var raw = displaySpeed;
        var scale = unit === 'kmh' ? 3.6 : 2.23694;
        var shown = Math.round(raw * scale / SPEED_SCALE);
        var gear = currentGear === 'D' ? String(gearIndex) : gearLabel;
        var rpm;
        if (currentGear === 'P' || currentGear === 'N') {
            rpm = 850 + revLevel * 6800;
        } else if (currentGear === 'R') {
            rpm = 900 + revLevel * 5400;
        } else {
            var gearTop = driveMaxSpeed * GEAR_TOPS[gearIndex - 1];
            var gearBottom = gearIndex > 1 ? driveMaxSpeed * GEAR_TOPS[gearIndex - 2] : 0;
            var within = clamp((raw - gearBottom) / Math.max(1, gearTop - gearBottom), 0, 1);
            rpm = 900 + within * 6300 + (input.nitro && nitro > 0 ? 700 : 0);
            if (raw < 0.2) rpm = input.throttle ? 1250 : 850;
        }

        if (hudTimer > 0.075) {
            hudTimer = 0;
            setText('g3dGaugeSpeed', shown);
            setText('g3dGaugeUnit', unit === 'kmh' ? 'km/h' : 'mph');
            setText('g3dGaugeRpm', Math.round(rpm));
            setText('g3dGaugeGearBig', gear);
            setText('g3dGaugeGear', gear);
            setText('g3dGaugeNitro', Math.round(nitro) + '%');
            setText('g3dGaugeDistance', distance >= 1000 ? (distance / 1000).toFixed(1) + 'km' : Math.round(distance) + 'm');
            setText('g3dGaugeDrift', Math.round(driftScore));
            setText('g3dGaugeSplitLabel', 'COINS');
            setText('g3dGaugeSplit', coinsCollected);
            setText('g3dGaugeDamage', '0%');
            setRunCoins(coinsCollected);
            var fill = $('g3dGaugeNitroFill');
            if (fill) fill.style.width = Math.round(nitro) + '%';
            var needle = $('g3dNeedle');
            if (needle) {
                var angle = -135 + clamp(rpm / 8000, 0, 1) * 270;
                needle.style.transform = 'translateX(-50%) rotate(' + angle.toFixed(2) + 'deg)';
            }
            if (!toastTimer) {
                if (!ready) setText('g3dGaugeStatus', 'LOADING RAPIER PHYSICS…');
                else if (garage) setText('g3dGaugeStatus', 'GARAGE · PRESS PLAY TO DRIVE');
                else if (runOver) setText('g3dGaugeStatus', 'CRASHED · PRESS PLAY AGAIN');
                else if (paused) setText('g3dGaugeStatus', 'PAUSED');
                else if (input.drift && displaySpeed > 9) setText('g3dGaugeStatus', 'DRIFT · ' + Math.round(driftScore) + ' · ' + coinsCollected + ' COINS');
                else if (isSanta) {
                    if (flyTime > 0) setText('g3dGaugeStatus', 'SANTA FLYING · ' + flyTime.toFixed(1) + 's');
                    else if (flyCooldown > 0) setText('g3dGaugeStatus', 'FLY READY IN ' + Math.ceil(flyCooldown) + 's');
                    else setText('g3dGaugeStatus', 'SPACE TO FLY · ' + coinsCollected + ' COINS');
                }
                else if (localRacerName) {
                    var mp = multiplayerPlace();
                    setText('g3dGaugeStatus', mp
                        ? 'MP P' + mp.place + '/' + mp.total + ' · ' + coinsCollected + ' COINS'
                        : 'MULTIPLAYER · WAITING FOR RACERS · ' + coinsCollected + ' COINS');
                }
                else if (input.nitro && nitro > 0 && currentGear === 'D') setText('g3dGaugeStatus', 'NITROUS ACTIVE · ' + coinsCollected + ' COINS');
                else if (currentGear === 'N' || currentGear === 'P') setText('g3dGaugeStatus', 'REV WITH W · Q/E P R N D · ' + coinsCollected + ' COINS');
                else if (currentGear === 'R') setText('g3dGaugeStatus', 'REVERSE · Q/E P R N D · ' + coinsCollected + ' COINS');
                else if (displaySpeed < 0.4) setText('g3dGaugeStatus', 'HOLD W TO START · Q/E P R N D · ' + coinsCollected + ' COINS');
                else setText('g3dGaugeStatus', 'BABYLON.JS + RAPIER · ' + coinsCollected + ' COINS');
            }
            var brake = document.querySelector('.g3d-warn[data-warn="brake"]');
            if (brake) brake.classList.toggle('is-on', !!input.brake);
        }
    }

    function frame() {
        if (!active) return;
        var now = performance.now();
        var dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
        lastFrame = now;
        if (!paused && !garage) {
            stepPhysics(dt);
            updateTraffic(dt);
            updateCoins(dt);
        } else if (!paused) {
            updateCoins(dt);
        }
        if (exhaustSmoke) {
            var revvingN = (currentGear === 'N' || currentGear === 'P') && revLevel > 0.10 && !garage && !runOver;
            exhaustSmoke.emitRate = revvingN ? 60 + revLevel * 125 : 0;
        }
        if (driftSmoke) {
            driftSmoke.emitRate = (input.drift && displaySpeed > 9 && !garage && !runOver) ? 50 + Math.min(120, displaySpeed * 0.7) : 0;
        }
        if (impactSparks) {
            impactSparkTimer = Math.max(0, impactSparkTimer - dt);
            if (impactSparkTimer <= 0) impactSparks.emitRate = 0;
        }
        var speedFrac = clamp(displaySpeed / Math.max(1, driveMaxSpeed), 0, 1);
        motionBlurStrength = 0.012 + speedFrac * 0.070 + (input.nitro && nitro > 0 ? 0.022 : 0);
        updateRemoteRacers(dt);
        syncCarVisual(dt);
        updateAudio();
        updateCamera(dt);
        updateHud(dt);
        if (scene) scene.render();
    }

    /* --------------------------------------------------------------------
       Input
       -------------------------------------------------------------------- */

    function bindInput() {
        keyHandlers = {
            down: function (e) {
                if (!active) return;
                var tag = (e.target && e.target.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
                var k = String(e.key || '').toLowerCase();
                if (!k) return;
                if (k === 'w' || k === 'arrowup') { input.throttle = true; e.preventDefault(); }
                else if (k === 's' || k === 'arrowdown') { input.brake = true; e.preventDefault(); }
                else if (k === 'a' || k === 'arrowleft') { input.left = true; e.preventDefault(); }
                else if (k === 'd' || k === 'arrowright') { input.right = true; e.preventDefault(); }
                else if (k === ' ') {
                    if (isSanta) { if (!e.repeat) startFly(); }
                    else input.brake = true;
                    e.preventDefault();
                }
                else if (k === 'shift') { input.nitro = true; e.preventDefault(); }
                else if (k === 'x') { input.drift = true; e.preventDefault(); }
                else if (k === 'q') { shiftGear(-1); e.preventDefault(); }
                else if (k === 'e') { shiftGear(1); e.preventDefault(); }
                else if (k === 'r') { resetCar(true); e.preventDefault(); }
                else if (k === 'c') { cameraMode = (cameraMode + 1) % 2; showToast(cameraMode ? 'CAMERA · FAR' : 'CAMERA · CHASE'); }
            },
            up: function (e) {
                var k = String(e.key || '').toLowerCase();
                if (k === 'w' || k === 'arrowup') input.throttle = false;
                else if (k === 's' || k === 'arrowdown') input.brake = false;
                else if (k === 'a' || k === 'arrowleft') input.left = false;
                else if (k === 'd' || k === 'arrowright') input.right = false;
                else if (k === ' ') input.brake = false;
                else if (k === 'shift') input.nitro = false;
                else if (k === 'x') input.drift = false;
            },
            blur: function () {
                input.throttle = false; input.brake = false;
                input.left = false; input.right = false;
                input.nitro = false; input.drift = false; input.pointerActive = false;
            }
        };
        global.addEventListener('keydown', keyHandlers.down);
        global.addEventListener('keyup', keyHandlers.up);
        global.addEventListener('blur', keyHandlers.blur);
    }

    function unbindInput() {
        if (!keyHandlers) return;
        global.removeEventListener('keydown', keyHandlers.down);
        global.removeEventListener('keyup', keyHandlers.up);
        global.removeEventListener('blur', keyHandlers.blur);
        keyHandlers = null;
    }

    function bindTouch() {
        if (!canvas) return;
        var pid = null;
        function update(e) {
            if (!canvas) return;
            var rect = canvas.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / Math.max(1, rect.width)) - 0.5;
            input.pointerSteer = clamp(x * 2.4, -1.35, 1.35);
            input.pointerActive = true;
        }
        canvas.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse') return;
            pid = e.pointerId;
            try { canvas.setPointerCapture(pid); } catch (err) {}
            update(e);
            e.preventDefault();
        });
        canvas.addEventListener('pointermove', function (e) {
            if (pid !== e.pointerId) return;
            update(e);
            e.preventDefault();
        });
        function end(e) {
            if (pid !== null && e.pointerId !== pid) return;
            pid = null;
            input.pointerActive = false;
            input.pointerSteer = 0;
        }
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('pointerleave', end);
    }

    /* --------------------------------------------------------------------
       Lifecycle / public API
       -------------------------------------------------------------------- */

    function resize() {
        if (engine) engine.resize();
    }

    function fail(error) {
        failed = true;
        active = false;
        if (engine) {
            try { engine.dispose(); } catch (e) {}
            engine = null;
        }
        if (container) {
            container.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:28px;text-align:center;color:#eafaff;background:#05070a;font:600 14px system-ui,sans-serif">' +
                '<div><h2 style="margin:0 0 8px">Babylon racer could not start</h2>' +
                '<p style="margin:0 0 14px;color:rgba(220,240,250,.6);max-width:520px">' + (error && error.message ? String(error.message) : 'The 3D engine failed to load.') + '</p>' +
                '<button type="button" onclick="LessFunBabylonFallback()" style="padding:10px 16px;border:0;border-radius:9px;background:#5fe7ff;color:#031014;font:800 12px system-ui;cursor:pointer">Use the Three.js racer</button></div></div>';
        }
    }

    function start(containerEl, options) {
        if (!global.BABYLON) {
            fail(new Error('Babylon.js is not loaded.'));
            return false;
        }
        if (!containerEl) return false;
        stop();
        opts = options || {};
        container = containerEl;
        failed = false;
        active = true;
        starting = true;
        ready = false;
        paused = false;
        garage = false;
        unit = (global.localStorage && localStorage.getItem('lessfun_units')) === 'kmh' ? 'kmh' : 'mph';
        currentGear = 'D';
        gearLabel = '1';
        gearIndex = 1;
        manualGearTimer = 0;
        revLevel = 0;
        distance = 0;
        displaySpeed = 0;
        nitro = 100;
        driftScore = 0;
        steerVisual = 0;
        selectedCar = opts.car || null;
        carCosmetics = opts.cosmetics || null;
        isSanta = !!(selectedCar && selectedCar.id === 'car_santa');
        flyTime = 0;
        flyCooldown = 0;
        realCarRoot = null;
        realCarLoading = false;
        remoteRacers = {};
        localRacerName = '';
        var perf = carCosmetics && carCosmetics.performance ? carCosmetics.performance : {};
        // Use the car's advertised top speed (mph) instead of the old compressed
        // arcade scale. A 200 mph car now reads 200 on the gauge.
        var perfTop = num(perf.topSpeed, 1) || 1;
        var baseTopFactor = selectedCar ? clamp((selectedCar.topSpeed || 170) / 170, 0.52, 1.9) : 1;
        var upgradeTop = selectedCar ? clamp(perfTop / baseTopFactor, 0.88, 1.4) : clamp(perfTop, 1.0, 1.6);
        var topMph = (selectedCar ? (selectedCar.topSpeed || 192) : 200) * upgradeTop;
        driveMaxSpeed = clamp(topMph / 2.23694, 32, 145) * 2;
        driveAccel = clamp(num(perf.accel, 1) || 1, 0.55, 2.4);
        driveGrip = clamp(3.25 * (num(perf.grip, 1) || 1), 2.2, 5.3);
        traffic = [];
        coinPickups = [];
        trafficTimer = 0;
        trafficPaintCache = {};
        trafficShared = null;
        coinMaterial = null;
        runOver = false;
        runSeconds = 0;
        coinsCollected = 0;
        coinsAwarded = false;
        scoreSubmitted = false;
        fsdActive = false;
        fsdThink = 0;
        fsdSteerTarget = 0;
        fsdBrake = false;
        fsdThrottle = false;
        lastPlayerZ = spawnZ;
        setRunCoins(0);
        input.throttle = false; input.brake = false; input.left = false; input.right = false;
        input.drift = false; input.nitro = false; input.pointerActive = false; input.pointerSteer = 0;
        engine = null;
        scene = null;
        world = null;
        chassis = null;
        vehicle = null;
        carRoot = null;
        contactShadow = null;
        carVisuals = [];
        wheelPivots = [];
        wheelSpins = [];

        container.innerHTML = '';
        canvas = document.createElement('canvas');
        canvas.className = 'babylon-racer-canvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none';
        canvas.setAttribute('aria-label', 'Beach Racer — Babylon.js + Rapier');
        container.appendChild(canvas);

        initAudio();
        try {
            createScene();
        } catch (error) {
            fail(error);
            if (global.LessFunBabylonFallback) setTimeout(function () { if (failed) global.LessFunBabylonFallback(); }, 600);
            return false;
        }

        bindInput();
        bindTouch();
        resizeObs = new ResizeObserver(resize);
        resizeObs.observe(container);
        lastFrame = performance.now();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        engine.runRenderLoop(frame);
        resize();
        if (selectedCar) {
            var banner = $('g3dBanner');
            if (banner) {
                banner.textContent = selectedCar.year + ' ' + selectedCar.brand + ' ' + selectedCar.model;
                banner.classList.add('is-active');
                setTimeout(function () { banner.classList.remove('is-active'); }, 3200);
            }
        }

        loadRapier().then(function (api) {
            if (!active) return;
            createPhysics();
            starting = false;
            setText('g3dGaugeStatus', 'BABYLON + RAPIER · HDR READY');
        }).catch(function (error) {
            starting = false;
            fail(error);
            if (global.LessFunBabylonFallback) {
                setTimeout(function () { if (failed) global.LessFunBabylonFallback(); }, 800);
            }
        });
        return true;
    }

    function stop() {
        if (!scoreSubmitted && opts && typeof opts.onScore === 'function' && distance > 0) {
            scoreSubmitted = true;
            try { opts.onScore('Beach Racer', runScore()); } catch (e) {}
        }
        if (!coinsAwarded && coinsCollected > 0 && opts && typeof opts.onCoins === 'function') {
            coinsAwarded = true;
            try { opts.onCoins(coinsCollected); } catch (e) {}
        }
        stopAudio();
        active = false;
        ready = false;
        starting = false;
        paused = false;
        garage = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (engine) {
            try { engine.stopRenderLoop(); } catch (e) {}
        }
        unbindInput();
        if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
        if (world) { try { world.free(); } catch (e) {} world = null; }
        chassis = null;
        vehicle = null;
        if (scene) { try { scene.dispose(); } catch (e) {} scene = null; }
        if (engine) { try { engine.dispose(); } catch (e) {} engine = null; }
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        container = null;
        carRoot = null;
        contactShadow = null;
        traffic = [];
        coinPickups = [];
        remoteRacers = {};
        trafficPaintCache = {};
        trafficShared = null;
        coinMaterial = null;
        carVisuals = [];
        wheelPivots = [];
        wheelSpins = [];
        camera = null;
        sun = null;
        shadow = null;
        sky = null;
        exhaustSmoke = null;
        exhaustEmitter = null;
        driftSmoke = null;
        driftEmitter = null;
        smokeTexture = null;
        realCarRoot = null;
        realCarLoading = false;
        impactSparks = null;
        impactSparkTimer = 0;
        crashShake = 0;
        motionBlurPost = null;
        camPos = null;
        camTarget = null;
    }

    function restart() {
        if (!active) return false;
        paused = false;
        garage = false;
        resetCar(false);
        resetRunWorld();
        if (!ready) createPhysics();
        return true;
    }

    function setPaused(on) {
        paused = !!on;
        if (on) {
            input.throttle = false; input.brake = false;
            input.left = false; input.right = false;
            input.nitro = false; input.drift = false;
        }
    }

    function setGarageMode(on) {
        garage = !!on;
        if (garage) {
            paused = false;
            resetClock = 0;
            if (chassis) resetCar(true, true);
        }
    }

    function setGearMode(mode) {
        mode = String(mode || '').toUpperCase();
        if (mode !== 'P' && mode !== 'R' && mode !== 'N' && mode !== 'D') mode = 'D';
        currentGear = mode;
        gearLabel = mode === 'D' ? '1' : mode;
        if (mode === 'D') { gearIndex = 1; manualGearTimer = 0; }
        else revLevel = 0;
        playGearSound();
        showToast('GEAR ' + mode);
    }

    function shiftGear(direction) {
        if (!ready || garage || runOver) return;
        var order = ['P', 'R', 'N', 'D'];
        var idx = order.indexOf(currentGear);
        idx = clamp(idx + (direction > 0 ? 1 : -1), 0, order.length - 1);
        setGearMode(order[idx]);
    }

    function setGear(mode) { setGearMode(mode); }
    function setThrottle(on) { input.throttle = !!on; if (on && currentGear === 'P') setGearMode('D'); }
    function setBrake(on) { input.brake = !!on; }
    function setDrift(on) { input.drift = !!on; }
    function setNitro(on) { input.nitro = !!on; }
    function setUnitSystem(value) { unit = value === 'kmh' ? 'kmh' : 'mph'; }
    function setSoundEnabled(on) {
        sound = !!on;
        if (audioMaster && audioCtx) {
            try { audioMaster.gain.setTargetAtTime(sound ? 0.34 : 0, audioCtx.currentTime, 0.08); } catch (e) {}
        }
    }
    function setShadows() {}
    function setMotionBlur() {}
    function setCrashSlowmo() {}
    function setGraphicsPreset() {}
    function setRenderScale() {}
    function setShowFps() {}
    function startFly() {
        if (!isSanta || !ready || garage || runOver) return;
        if (flyTime > 0 || flyCooldown > 0) return;
        if (currentGear !== 'D') setGearMode('D');
        flyTime = 2.0;
        chassis.setGravityScale(0.06, true);
        var v = chassis.linvel();
        chassis.setLinvel({ x: v.x, y: Math.max(v.y, 3.6), z: v.z }, true);
        playTone(660, 0.18, 'triangle', 0.06, 1180);
        showToast('SANTA FLY · 2s');
    }

    function toggleFsd() {}
    function setLocalRacerName(name) { localRacerName = String(name || '').slice(0, 16); }
    function setTerrain() {}
    function setElevation() {}
    function toggleShadowHelper() {}
    function teleportRacer(targetDistance, targetX) {
        if (!chassis) return;
        var d = Math.max(0, num(targetDistance, 0));
        var tx = clamp(num(targetX, 0), -10.2, 10.2);
        chassis.setTranslation({ x: tx, y: 0.92, z: spawnZ + d }, true);
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
        distance = Math.max(distance, d);
        resetCamera(true);
        showToast('TELEPORTED TO RACER');
    }
    function lockPointer() {}
    function getRacerInfo() { return null; }
    function getRacerState() {
        var t = chassis ? chassis.translation() : { x: 0, z: 0 };
        var v = chassis ? chassis.linvel() : { x: 0, z: 0 };
        var speed = Math.sqrt(v.x * v.x + v.z * v.z);
        return {
            distance: distance,
            x: t.x,
            z: t.z,
            speed: speed,
            mph: Math.round(speed * 2.23694 / SPEED_SCALE),
            kmh: Math.round(speed * 3.6 / SPEED_SCALE),
            coins: coinsCollected,
            fsd: fsdActive,
            traffic: traffic.length,
            gear: currentGear === 'D' ? gearIndex : currentGear,
            pitch: chassis ? Math.round((2 * (chassis.rotation().y * chassis.rotation().z - chassis.rotation().x * chassis.rotation().w)) * 100) / 100 : 0,
            remotes: Object.keys(remoteRacers).length,
            fly: flyTime > 0 ? flyTime : 0,
            flyCooldown: flyCooldown,
            santa: isSanta,
            remoteBodies: Object.keys(remoteRacers).filter(function (id) { return !!remoteRacers[id].body; }).length,
            maxMph: Math.round(driveMaxSpeed * 2.23694),
            nitro: Math.round(nitro),
            audio: !!(audioCtx && audioCtx.state === 'running'),
            audioLoops: Object.keys(audioLoops).length
        };
    }
    function getCurrentScore() { return runScore(); }
    function getCapturedFrame() {
        try { return canvas ? canvas.toDataURL('image/jpeg', 0.65) : null; } catch (e) { return null; }
    }
    function requestFrameCapture() {}
    function setMobileMove(x) { input.pointerSteer = clamp(-Number(x) || 0, -1, 1); input.pointerActive = Math.abs(Number(x) || 0) > 0.04; }
    function noop() {}

    global.BabylonRacer = {
        isActive: function () { return !!active; },
        hasFailed: function () { return !!failed; },
        start: start,
        stop: stop,
        restart: restart,
        setPaused: setPaused,
        setGarageMode: setGarageMode,
        setGearMode: setGearMode,
        shiftGear: shiftGear,
        setGear: setGear,
        setThrottle: setThrottle,
        setBrake: setBrake,
        setDrift: setDrift,
        setNitro: setNitro,
        setUnitSystem: setUnitSystem,
        setSoundEnabled: setSoundEnabled,
        setShadows: setShadows,
        setMotionBlur: setMotionBlur,
        setCrashSlowmo: setCrashSlowmo,
        setGraphicsPreset: setGraphicsPreset,
        setRenderScale: setRenderScale,
        setShowFps: setShowFps,
        toggleFsd: toggleFsd,
        setLocalRacerName: setLocalRacerName,
        setRemoteRacers: setRemoteRacers,
        setTerrain: setTerrain,
        setElevation: setElevation,
        toggleShadowHelper: toggleShadowHelper,
        teleportRacer: teleportRacer,
        lockPointer: lockPointer,
        getRacerInfo: getRacerInfo,
        getRacerState: getRacerState,
        getCurrentScore: getCurrentScore,
        getCapturedFrame: getCapturedFrame,
        requestFrameCapture: requestFrameCapture,
        setMobileMove: setMobileMove,
        setMobileFiring: noop,
        mobileFpsAction: noop,
        setZombieRemotes: noop,
        getZombieState: noop,
        setZombieNet: noop,
        getZombieWorld: noop,
        applyZombieWorld: noop,
        applyZombieHit: noop,
        addZombieScore: noop,
        applyZombieAttack: noop,
        reviveZombiePlayer: noop,
        applyLootedCrate: noop
    };
})(window);
