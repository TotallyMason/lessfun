/* LessFun — Redline GT · Babylon.js + Rapier
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
    var ROAD_WIDTH = 35;
    var SPEED_SCALE = 2;

    var engine = null, scene = null, camera = null, canvas = null, container = null;
    var carRoot = null, carVisuals = [], wheelPivots = [], wheelSpins = [], contactShadow = null;
    var sun = null, shadow = null, sky = null, exhaustSmoke = null, exhaustEmitter = null;
    var impactSparks = null, impactSmoke = null, impactSparkTimer = 0, crashShake = 0, wallImpactCool = 0;
    var interiorRoot = null, interiorLight = null, interiorFill = null, interiorGaugeLight = null, interiorScreenTex = null, centerScreenTex = null, interiorSteeringWheel = null;
    var debris = [], debrisPaintMat = null, debrisCarbonMat = null, debrisTireMat = null;
    var headlights = [], headlightsOn = false;
    var motionBlurPost = null, motionBlurStrength = 0.055;
    var vhsPost = null, glowLayer = null;
    var realCarRoot = null, realCarLoading = false, carPaintHex = 0xc2280b;
    var proceduralLampMeshes = [];
    var vehicleModelLibrary = null, vehicleModelsLoading = false;
    var absActive = false;
    var worldMode = 'highway', cityRoot = null, cityBuildings = [], highwayMeshes = [], highwayExits = [], savedHighwayZ = START_Z + 500, portalCooldown = 0;
    var CITY_X = 0, CITY_Z = 50000;
    function highwayCurveX(z) {
        var d = z - START_Z;
        // Gentle sweeping curves: clearly curved, without the snake-like feel.
        return Math.sin(d / 500) * 32.0 + Math.sin(d / 220) * 8.5;
    }
    var smokeTexture = null, driftSmoke = null, driftEmitter = null;
    var isSanta = false, flyTime = 0, flyCooldown = 0;
    var powerShakeLevel = 0;
    var cameraPrevSpeed = 0, cameraAccelSmooth = 0;
    var resizeObs = null, active = false, failed = false;
    var rapier = null, world = null, chassis = null, vehicle = null;
    var rapierPromise = null, ready = false, starting = false;
    var raf = 0, lastFrame = 0, accumulator = 0, hudTimer = 0, speedHudTimer = 0, gaugeBoot = 0, suspended = false, readyAnnounced = false;
    var hudCache = null;
    var fpsFrames = 0, fpsWindowStart = 0, fpsShown = -1;
    var paused = false, garage = false, cameraMode = 0;
    var distance = 0, displaySpeed = 0, unit = 'mph', sound = true;
    var nitro = 100, driftScore = 0, steerVisual = 0;
    var currentGear = 'D', gearLabel = 'D';
    var gearIndex = 1, manualGearTimer = 0, revLevel = 0;
    var gearShiftTimer = 0, pendingGear = null, pendingGearIndex = null;
    var engineRpm = 850;
    var GEAR_TOPS = [0.14, 0.24, 0.35, 0.47, 0.60, 0.73, 0.86, 1.0];
    var camPos = null, camTarget = null;
    var resetClock = 0, flipTime = 0, toastTimer = 0;
    var opts = {};
    var spawnZ = START_Z;
    var keyHandlers = null;
    var selectedCar = null, carCosmetics = null;
    var training = false, trainingStep = 0, trainingRoot = null, trainingProps = [], trainingCooldown = 0, trainingHold = 0;
    var eject = null, crashFlashEl = null;
    var tollPlazas = [], rumbleShake = 0;
    var rainSystem = null, rainIntensity = 0, rainTarget = 0, weatherTimer = 25, rainChip = null;
    var tunnels = [], tunnelDark = 0, baseSunIntensity = 0.62, hemi = null;
    var autoSteer = false, autoLane = 3, autoLaneTimer = 0, autoPrevLeft = false, autoPrevRight = false, autoLaneFlash = 0, autoOffset = 1.83, autoDesired = 0;
    var autoSignal = 0, autoSignalTimer = 0, autoPendingLane = -1;
    var autoChanging = false, autoChangeT = 1, autoChangeDur = 1.6, autoChangeFrom = 0, autoChangeTo = 0;
    var autoHands = 0, autoNudge = false, autoOverride = 0, autoRecover = 0;
    var autoLeftHold = 0, autoRightHold = 0, autoNextPlan = 0, autoOvertake = false, autoReturnLane = 0;
    var autoBlockedTimer = 0, autoStatusText = '';
    var autoTapRequest = 0, autoLastSteerAt = 0, autoSteerDownAt = { left: 0, right: 0 }, autoWasOn = false;
    var autoLeadGap = 0, autoLeadSpeed = 0, autoTgrip = 1;
    var asLaneLines = null, asGuideOffset = 0;
    var driveMaxSpeed = 67, driveAccel = 1, driveGrip = 3.85, baseGrip = 3.85, tyreHeat = 0;
    var heatMode = 'idle', accelHold = 0, brakeHold = 0, coastHold = 0;
    var laneCenters = [-11.25, -6.75, -2.25, 2.25, 6.75, 11.25];
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

    var VEHICLE_MODEL_FILES = {
        // NOTE: the Ferrari GLB has a baked 120-degree root rotation that the
        // merge step cannot normalise, so it appeared tilted and floating.
        // Exotic traffic now uses the stable wedge coupe instead.
        sedan: 'town', sport: 'wedge', suv: 'suv', van: 'minivan',
        truck: 'truck', bus: 'bus', taxi: 'taxi', muscle: 'muscle',
        hatch: 'hatchback', exotic: 'wedge'
    };

    var TRAFFIC_SPECS = {
        sedan: { w: 1.82, l: 4.3, bodyH: 0.42, cabinH: 0.38, cabinL: 1.75, cabinZ: -0.10, y: 0.60 },
        sport: { w: 1.88, l: 4.35, bodyH: 0.34, cabinH: 0.30, cabinL: 1.45, cabinZ: -0.05, y: 0.54 },
        suv:   { w: 1.98, l: 4.75, bodyH: 0.58, cabinH: 0.48, cabinL: 2.25, cabinZ: -0.20, y: 0.72 },
        van:   { w: 2.02, l: 5.2, bodyH: 0.68, cabinH: 0.56, cabinL: 2.85, cabinZ: -0.25, y: 0.80 },
        truck: { w: 2.35, l: 7.0, bodyH: 0.72, cabinH: 0.78, cabinL: 1.95, cabinZ: 2.20, y: 0.82 },
        bus:   { w: 2.52, l: 9.4, bodyH: 1.34, cabinH: 0.62, cabinL: 7.3, cabinZ: -0.30, y: 1.02 },
        hatch: { w: 1.78, l: 3.9, bodyH: 0.46, cabinH: 0.42, cabinL: 1.60, cabinZ: -0.15, y: 0.62 },
        exotic:{ w: 1.94, l: 4.5, bodyH: 0.30, cabinH: 0.26, cabinL: 1.35, cabinZ: -0.05, y: 0.50 }
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
        if (!el) return;
        if (el.textContent !== String(value)) el.textContent = String(value);
        if (id === 'g3dGaugeStatus') el.style.display = String(value).trim() ? '' : 'none';
    }
    function isLowPower() {
        var cores = (global.navigator && global.navigator.hardwareConcurrency) || 8;
        var mem = (global.navigator && global.navigator.deviceMemory) || 8;
        return cores <= 4 || mem <= 4;
    }
    function showToast(text) {
        // The cluster hint line was removed; keep the API as a silent no-op.
        void text;
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
            audioMaster.gain.value = sound ? 1.0 : 0;
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
        if (!playAudioSample('crash', 1.15, 0.94 + Math.random() * 0.12)) {
            playTone(110, 0.42, 'sawtooth', 0.34, 34);
        }
    }

    function playGearSound() {
        if (!playAudioSample('gear', 0.5, 0.96 + Math.random() * 0.1)) {
            playTone(240, 0.06, 'square', 0.08, 160);
        }
    }

    function updateAudio() {
        if (!audioCtx || !audioSynth || !audioMaster) return;
        try {
            var now = audioCtx.currentTime;
            var speed = displaySpeed || 0;
            var running = active && ready && !runOver && !paused;
            var freeRev = currentGear === 'N';
            var rev = freeRev ? revLevel : clamp(engineRpm / 8000, 0, 1);
            if (garage) { running = true; rev = 0.06; }
            var hasEngine = !!(audioLoops.engineLow && audioLoops.engineHigh);
            var hasWind = !!(audioLoops.windLow && audioLoops.windHigh);
            var synthGain = running ? (hasEngine ? 0.020 : 0.11 + rev * 0.09) : 0;
            audioSynth.engineGain.gain.setTargetAtTime(synthGain, now, 0.08);
            audioSynth.engineOsc.frequency.setTargetAtTime(48 + rev * 165, now, 0.06);
            audioSynth.subOsc.frequency.setTargetAtTime(76 + rev * 236, now, 0.06);
            audioSynth.engineFilter.frequency.setTargetAtTime(460 + speed * 12 + (input.nitro && nitro > 0 ? 360 : 0), now, 0.1);
            audioSynth.windGain.gain.setTargetAtTime(running && !hasWind ? Math.min(0.08, speed / 900) : 0, now, 0.12);
            audioSynth.windFilter.frequency.setTargetAtTime(520 + speed * 8, now, 0.12);

            if (hasEngine) {
                audioLoops.engineLow.gain.gain.setTargetAtTime(running ? 0.36 + rev * 0.62 : 0, now, 0.09);
                audioLoops.engineHigh.gain.gain.setTargetAtTime(running ? Math.max(0, rev - 0.30) * 1.05 : 0, now, 0.09);
                audioLoops.engineLow.src.playbackRate.setTargetAtTime(0.78 + rev * 0.96, now, 0.1);
                audioLoops.engineHigh.src.playbackRate.setTargetAtTime(0.86 + rev * 1.18, now, 0.1);
            }
            if (hasWind) {
                var windFrac = Math.min(1, speed / 95);
                audioLoops.windLow.gain.gain.setTargetAtTime(running ? 0.05 + windFrac * 0.26 : 0, now, 0.12);
                audioLoops.windHigh.gain.gain.setTargetAtTime(running ? Math.max(0, windFrac - 0.4) * 0.28 : 0, now, 0.12);
                audioLoops.windLow.src.playbackRate.setTargetAtTime(0.82 + windFrac * 0.52, now, 0.14);
                audioLoops.windHigh.src.playbackRate.setTargetAtTime(0.9 + windFrac * 0.7, now, 0.14);
            }
            audioMaster.gain.setTargetAtTime(sound ? 0.48 : 0, now, 0.1);
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
                    'vec3 low=vec3(0.045,0.085,0.15);vec3 mid=vec3(0.015,0.035,0.075);vec3 top=vec3(0.003,0.007,0.022);' +
                    'vec3 col=mix(low,mid,smoothstep(0.35,0.62,h));col=mix(col,top,smoothstep(0.58,0.97,h));' +
                    'float hash=fract(sin(dot(d.xz,vec2(127.1,311.7)))*43758.5453);' +
                    'float stars=step(0.9972,hash)*smoothstep(0.10,0.58,h);' +
                    'col+=vec3(0.72,0.82,1.0)*stars*0.8;' +
                    'float moon=smoothstep(0.99955,0.99985,dot(d,normalize(vec3(0.42,0.30,-0.86))));' +
                    'col+=vec3(0.72,0.82,1.0)*moon*1.15;' +
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
        scene.clearColor = new BABYLON.Color4(0.008, 0.014, 0.035, 1);
        scene.ambientColor = new BABYLON.Color3(0.045, 0.055, 0.09);
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.0016;
        scene.fogColor = new BABYLON.Color3(0.025, 0.035, 0.065);

        try {
            var env = BABYLON.CubeTexture.CreateFromPrefilteredData(HDR_URL, scene);
            env.name = 'hdrEnvironment';
            scene.environmentTexture = env;
            scene.environmentIntensity = 0.16;
        } catch (e) { /* baked lighting + analytic lights still work */ }

        createSky();

        hemi = new BABYLON.HemisphericLight('skyFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.13;
        hemi.diffuse = new BABYLON.Color3(0.34, 0.48, 0.78);
        hemi.groundColor = new BABYLON.Color3(0.018, 0.022, 0.04);

        sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.36, -1.0, 0.58), scene);
        sun.position = new BABYLON.Vector3(60, 90, -90);
        sun.intensity = 0.62;
        sun.diffuse = new BABYLON.Color3(0.52, 0.66, 1.0);
        sun.specular = new BABYLON.Color3(0.62, 0.76, 1.0);
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

        var roadSegments = 1200;
        var roadPositions = [], roadIndices = [], roadUvs = [];
        for (var ri = 0; ri <= roadSegments; ri++) {
            var rz = (ri / roadSegments) * ROAD_LENGTH;
            var rx = highwayCurveX(rz);
            roadPositions.push(rx - ROAD_WIDTH / 2, 0.02, rz);
            roadPositions.push(rx + ROAD_WIDTH / 2, 0.02, rz);
            roadUvs.push(0, ri / roadSegments);
            roadUvs.push(1, ri / roadSegments);
            if (ri < roadSegments) {
                var base = ri * 2;
                roadIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
            }
        }
        var roadNormals = [];
        BABYLON.VertexData.ComputeNormals(roadPositions, roadIndices, roadNormals);
        var roadData = new BABYLON.VertexData();
        roadData.positions = roadPositions;
        roadData.indices = roadIndices;
        roadData.uvs = roadUvs;
        roadData.normals = roadNormals;
        var road = new BABYLON.Mesh('coastalRoad', scene);
        roadData.applyToMesh(road);
        road.receiveShadows = true;
        var roadMat = new BABYLON.PBRMaterial('bakedRoadMaterial', scene);
        roadMat.albedoTexture = makeBakedRoadTexture();
        roadMat.albedoColor = new BABYLON.Color3(1, 1, 1);
        roadMat.metallic = 0.06;
        roadMat.roughness = 0.76;
        roadMat.environmentIntensity = 0.55;
        roadMat.backFaceCulling = false;
        road.material = roadMat;
        highwayMeshes.push(road);

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
        highwayMeshes.push(sand);

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
        highwayMeshes.push(water);

        // Curved guardrail ribbons follow the road centreline.
        var railMat = new BABYLON.PBRMaterial('guardrailMaterial', scene);
        railMat.albedoColor = new BABYLON.Color3(0.24, 0.27, 0.29);
        railMat.metallic = 0.55;
        railMat.roughness = 0.45;
        railMat.backFaceCulling = false;
        [-1, 1].forEach(function (side) {
            var railPositions = [], railIndices = [], railNormals = [];
            for (var gi = 0; gi <= roadSegments; gi++) {
                var gz = (gi / roadSegments) * ROAD_LENGTH;
                var gx = highwayCurveX(gz) + side * (ROAD_WIDTH / 2 + 0.5);
                railPositions.push(gx, 0.02, gz);
                railPositions.push(gx, 0.86, gz);
                if (gi < roadSegments) {
                    var gb = gi * 2;
                    railIndices.push(gb, gb + 2, gb + 1, gb + 1, gb + 2, gb + 3);
                }
            }
            BABYLON.VertexData.ComputeNormals(railPositions, railIndices, railNormals);
            var railData = new BABYLON.VertexData();
            railData.positions = railPositions;
            railData.indices = railIndices;
            railData.normals = railNormals;
            var rail = new BABYLON.Mesh('guardrail' + side, scene);
            railData.applyToMesh(rail);
            rail.material = railMat;
            rail.receiveShadows = true;
            highwayMeshes.push(rail);
        });

        createRoadsideLights(low);
        createPalms(low);
        createPines();
        createMountains();
        createRoadSigns();
        createTunnels();
        createTollPlazas();
        loadStreetLampModel(low);
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
                var x = highwayCurveX(z) + side * (ROAD_WIDTH / 2 + 1.55);
                var p = pole.createInstance('lampPole' + side + '_' + i);
                p.position.set(x, 3.8, z);
                p.freezeWorldMatrix();
                var a = arm.createInstance('lampArm' + side + '_' + i);
                a.position.set(x - side * 1.02, 7.46, z);
                a.freezeWorldMatrix();
                var b = bulb.createInstance('lampBulb' + side + '_' + i);
                b.position.set(x - side * 2.0, 7.33, z);
                b.freezeWorldMatrix();
                proceduralLampMeshes.push(p, a);
            }
        }
    }

    function loadStreetLampModel(low) {
        if (!BABYLON.SceneLoader || !BABYLON.SceneLoader.ImportMeshAsync) return;
        BABYLON.SceneLoader.ImportMeshAsync('', 'models/', 'streetlamp.glb', scene).then(function (res) {
            if (!active) return;
            var parts = res.meshes.filter(function (m) { return m.getTotalVertices && m.getTotalVertices() > 0; });
            if (!parts.length) return;
            var scale = 7.6 / 4.335;
            var count = low ? 70 : 130;
            parts.forEach(function (part) {
                part.computeWorldMatrix(true);
                var local = part.getWorldMatrix().clone();
                part.parent = null;
                part.isPickable = false;
                for (var side = -1; side <= 1; side += 2) {
                    for (var i = 0; i < count; i++) {
                        var z = 40 + i * (ROAD_LENGTH / count);
                        var x = highwayCurveX(z) + side * (ROAD_WIDTH / 2 + 1.55);
                        var world = BABYLON.Matrix.Compose(
                            new BABYLON.Vector3(scale, scale, scale),
                            BABYLON.Quaternion.RotationYawPitchRoll(side < 0 ? 0 : Math.PI, 0, 0),
                            new BABYLON.Vector3(x, 0, z)
                        );
                        part.thinInstanceAdd(local.multiply(world), true);
                    }
                }
            });
            proceduralLampMeshes.forEach(function (m) { m.setEnabled(false); });
            proceduralLampMeshes = [];
        }).catch(function () {
            // The procedural lamps remain if the online model cannot load.
        });
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
                var x = highwayCurveX(z) + side * (32 + (i % 4) * 4.5);
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

        // Kit-specific body upgrades — the Garage changes the actual silhouette.
        var kitStyle = carCosmetics && carCosmetics.kitStyle ? carCosmetics.kitStyle : 'stock';
        if (kitStyle === 'widebody') {
            box('fenderL', 0.16, 0.34, 1.5, -1.0, 0.16, 1.35, paint);
            box('fenderR', 0.16, 0.34, 1.5, 1.0, 0.16, 1.35, paint);
            box('fenderRL', 0.16, 0.34, 1.5, -1.0, 0.16, -1.3, paint);
            box('fenderRR', 0.16, 0.34, 1.5, 1.0, 0.16, -1.3, paint);
            box('fenderFlareL', 0.1, 0.42, 3.6, -0.98, 0.1, 0, carbon);
            box('fenderFlareR', 0.1, 0.42, 3.6, 0.98, 0.1, 0, carbon);
        }
        if (kitStyle === 'gt3' || kitStyle === 'track') {
            box('bigWing', 1.86, 0.08, 0.5, 0, 0.98, -2.0, carbon);
            box('bigWingPostL', 0.08, 0.5, 0.16, -0.6, 0.68, -2.0, carbon);
            box('bigWingPostR', 0.08, 0.5, 0.16, 0.6, 0.68, -2.0, carbon);
            box('canards', 1.7, 0.06, 0.4, 0, 0.02, 2.24, carbon);
        }
        if (kitStyle === 'offroad' || kitStyle === 'rally') {
            box('liftStrutL', 0.14, 0.18, 0.5, -0.8, -0.28, 1.4, carbon);
            box('liftStrutR', 0.14, 0.18, 0.5, 0.8, -0.28, 1.4, carbon);
            box('lightBar', 1.3, 0.16, 0.12, 0, 1.02, -0.4, headMat);
            box('bullBar', 1.5, 0.3, 0.1, 0, 0.14, 2.3, chrome);
            box('mudflapL', 0.04, 0.26, 0.3, -0.95, -0.32, -1.6, carbon);
            box('mudflapR', 0.04, 0.26, 0.3, 0.95, -0.32, -1.6, carbon);
        }
        if (kitStyle === 'hyper') {
            box('lowSplitter', 1.9, 0.07, 0.72, 0, -0.16, 2.2, carbon);
            box('roofScoop', 0.5, 0.1, 0.5, 0, 0.9, -0.2, carbon);
            box('finCenter', 0.05, 0.3, 0.9, 0, 0.86, -1.7, carbon);
            box('ventL', 0.06, 0.2, 0.5, -0.92, 0.3, -0.6, carbon);
            box('ventR', 0.06, 0.2, 0.5, 0.92, 0.3, -0.6, carbon);
        }
        // Side mirrors + hood scoop on every car — small details that read well up close.
        box('mirrorL', 0.2, 0.1, 0.12, -0.86, 0.72, 0.42, paint);
        box('mirrorR', 0.2, 0.1, 0.12, 0.86, 0.72, 0.42, paint);
        box('scoop', 0.52, 0.09, 0.6, 0, 0.46, 0.9, paint);

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

        headlights = [];
        [-0.55, 0.55].forEach(function (hx) {
            var light = new BABYLON.SpotLight('headlightBeam', new BABYLON.Vector3(hx, 0.30, 2.15), new BABYLON.Vector3(0, -0.10, 1), 1.05, 2.2, scene);
            light.parent = carRoot;
            light.intensity = 0;
            light.range = 95;
            light.diffuse = new BABYLON.Color3(1.0, 0.88, 0.68);
            light.specular = new BABYLON.Color3(1.0, 0.91, 0.75);
            light.setEnabled(false);
            headlights.push(light);
        });
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

    function attachVehicleModel(car) {
        if (!car || car.modelClone || !vehicleModelLibrary) return;
        var asset = vehicleModelLibrary[car.style] || vehicleModelLibrary.sedan;
        if (!asset || !asset.mesh) return;
        var clone = asset.mesh.clone('vehicleModel_' + car.style);
        clone.parent = car.root;
        clone.position.set(0, asset.offsetY, 0);
        clone.rotation.y = asset.yaw;
        clone.scaling.setAll(asset.scale);
        clone.isVisible = true;
        clone.setEnabled(true);
        clone.isPickable = false;
        car.root.getChildMeshes().forEach(function (m) {
            if (m !== clone && m.name.indexOf('remoteNamePlane') !== 0 && m.name.indexOf('trafficIndicator') !== 0) m.setEnabled(false);
        });
        car.modelClone = clone;
    }

    function loadVehicleModelLibrary() {
        if (vehicleModelsLoading || vehicleModelLibrary) return;
        vehicleModelsLoading = true;
        var styles = Object.keys(VEHICLE_MODEL_FILES);
        Promise.all(styles.map(function (style) {
            return BABYLON.SceneLoader.ImportMeshAsync('', 'models/traffic/', VEHICLE_MODEL_FILES[style] + '.glb', scene).then(function (res) {
                var parts = res.meshes.filter(function (m) { return m.getTotalVertices && m.getTotalVertices() > 0; });
                if (!parts.length) return null;
                var merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
                if (!merged) return null;
                merged.computeWorldMatrix(true);
                var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
                parts.forEach(function (m) {
                    m.computeWorldMatrix(true);
                    var b = m.getBoundingInfo().boundingBox;
                    var a = b.minimumWorld, c = b.maximumWorld;
                    mn = [Math.min(mn[0], a.x), Math.min(mn[1], a.y), Math.min(mn[2], a.z)];
                    mx = [Math.max(mx[0], c.x), Math.max(mx[1], c.y), Math.max(mx[2], c.z)];
                });
                var dx = mx[0] - mn[0], dy = mx[1] - mn[1], dz = mx[2] - mn[2];
                // Reject badly oriented assets (e.g. a Z-up model) rather than
                // spawning tilted floating cars. A car is never taller than it
                // is long by this much.
                if (dy > Math.max(dx, dz) * 0.62) return null;
                var spec = TRAFFIC_SPECS[style] || TRAFFIC_SPECS.sedan;
                var length = Math.max(dx, dz);
                var scale = spec.l / Math.max(0.1, length);
                merged.isVisible = false;
                merged.isPickable = false;
                return { style: style, mesh: merged, scale: scale, offsetY: -mn[1] * scale, yaw: dx > dz ? Math.PI / 2 : 0 };
            }).catch(function () { return null; });
        })).then(function (assets) {
            if (!active) return;
            vehicleModelLibrary = {};
            assets.forEach(function (asset) { if (asset) vehicleModelLibrary[asset.style] = asset; });
            traffic.forEach(attachVehicleModel);
            Object.keys(remoteRacers).forEach(function (id) { attachVehicleModel(remoteRacers[id]); });
        }).catch(function () {}).then(function () { vehicleModelsLoading = false; });
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
        var brakeMat = trafficShared.tail.clone('trafficBrake_' + paintKey + '_' + Math.random().toString(36).slice(2, 7));
        brakeMat.emissiveColor = new BABYLON.Color3(0.55, 0.03, 0.03);
        part('tailL', 0.38, 0.10, 0.08, -spec.w * 0.30, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.08, brakeMat);
        part('tailR', 0.38, 0.10, 0.08, spec.w * 0.30, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.08, brakeMat);

        // Amber turn signals so the car can show intent while it hesitates.
        var indMatL = new BABYLON.StandardMaterial('trafficIndL_' + Math.random().toString(36).slice(2, 7), scene);
        var indMatR = new BABYLON.StandardMaterial('trafficIndR_' + Math.random().toString(36).slice(2, 7), scene);
        [indMatL, indMatR].forEach(function (m) {
            m.diffuseColor = new BABYLON.Color3(0.42, 0.26, 0.06);
            m.emissiveColor = new BABYLON.Color3(0.10, 0.05, 0.01);
            m.disableLighting = true;
        });
        part('trafficIndicatorL', 0.20, 0.09, 0.07, -spec.w * 0.34, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.075, indMatL);
        part('trafficIndicatorR', 0.20, 0.09, 0.07, spec.w * 0.34, spec.y - spec.bodyH * 0.02, -spec.l / 2 - 0.075, indMatR);

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
        return {
            root: root, spec: spec, style: style, wheels: wheels, speed: 18, lane: 2, cool: 0,
            paint: paint, brakeMat: brakeMat, cruise: 18, braking: false,
            indMatL: indMatL, indMatR: indMatR, aiBlink: Math.random() * 10,
            aiState: 'drive', aiThink: 0, aiPlan: '', aiTargetLane: -1,
            aiSignalSide: 0, aiCooldown: 1 + Math.random() * 2, boost: 0
        };
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
        var spawnZPos = pz + offset + Math.random() * 35;
        car.laneOffset = laneCenters[car.lane];
        car.root.position.set(highwayCurveX(spawnZPos) + car.laneOffset, 0, spawnZPos);
        car.root.position.z = Math.max(spawnZ + 90, car.root.position.z);
        car.speed = (100 + Math.random() * 40) / 3.6;
        car.cruise = car.speed * (0.94 + Math.random() * 0.12);
        car.laneOffset = laneCenters[car.lane];
        car.aiState = 'drive';
        car.aiThink = 0;
        car.aiPlan = '';
        car.aiTargetLane = -1;
        car.aiSignalSide = 0;
        car.aiCooldown = 1 + Math.random() * 2.5;
        car.boost = 0;
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
        coin.z = pz + offset + Math.random() * 24;
        coin.x = highwayCurveX(coin.z) + laneCenters[lane];
        coin.active = true;
        coin.mesh.setEnabled(true);
    }

    function spawnRunTraffic(initial) {
        if (training) return;
        if (!traffic.length) {
            var count = isLowPower() ? 6 : 10;
            var styles = ['sedan', 'sport', 'suv', 'exotic', 'van', 'truck', 'hatch', 'bus', 'sport', 'muscle', 'taxi', 'sedan'];
            var colors = [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0xf78c6b, 0xf7f3e8, 0x7f8c8d, 0x9b5de5];
            for (var i = 0; i < count; i++) {
                traffic.push(makeTrafficCar(styles[i % styles.length], colors[i % colors.length]));
            }
        }
        var pz = spawnZ;
        for (var t = 0; t < traffic.length; t++) {
            placeTrafficCar(traffic[t], pz, 30 + t * (initial ? 46 : 38));
            createTrafficBody(traffic[t]);
            attachVehicleModel(traffic[t]);
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
        debris.forEach(function (d) { try { d.mesh.dispose(); } catch (e) {} });
        debris = [];
        runOver = false;
        paused = false;
        runSeconds = 0;
        coinsCollected = 0;
        coinsAwarded = false;
        scoreSubmitted = false;
        gearIndex = 1;
        manualGearTimer = 0;
        revLevel = 0;
        tyreHeat = 0;
        heatMode = 'idle';
        accelHold = 0;
        brakeHold = 0;
        coastHold = 0;
        gearShiftTimer = 0;
        pendingGear = null;
        pendingGearIndex = null;
        engineRpm = 850;
        fsdActive = false;
        fsdThink = 0;
        setRunCoins(0);
        var over = $('g3dOver');
        if (over) over.style.display = 'none';
        spawnRunTraffic(true);
        spawnRunCoins(true);
    }

    function ensureCrashFlash() {
        if (crashFlashEl && document.body.contains(crashFlashEl)) return crashFlashEl;
        crashFlashEl = document.createElement('div');
        crashFlashEl.className = 'g3d-crash-white';
        document.body.appendChild(crashFlashEl);
        return crashFlashEl;
    }

    function crashRun() {
        if (runOver || garage) return;
        runOver = true;
        fsdActive = false;
        input.throttle = false; input.brake = false;
        input.left = false; input.right = false; input.nitro = false;
        var flash = $('g3dCrashFlash');
        if (flash) {
            flash.classList.add('is-active');
            setTimeout(function () { flash.classList.remove('is-active'); }, 500);
        }
        // Major crash: blinding white light, deafening high-pitched ring and
        // the driver is thrown clear of the car along the impact direction.
        var white = ensureCrashFlash();
        white.classList.remove('is-active');
        void white.offsetWidth;
        white.classList.add('is-active');
        setTimeout(function () { if (white) white.classList.remove('is-active'); }, 2300);
        try {
            if (audioCtx) {
                playTone(2600, 1.4, 'sine', 0.16, 5200);
                playTone(3900, 1.15, 'triangle', 0.09, 6100);
            }
        } catch (e) {}
        if (chassis) {
            var t0 = chassis.translation();
            var v0 = chassis.linvel();
            var len = Math.hypot(v0.x, v0.z) || 1;
            var dirX = v0.x / len, dirZ = v0.z / len;
            if (!isFinite(dirX) || !isFinite(dirZ) || (Math.abs(dirX) + Math.abs(dirZ)) < 0.01) {
                dirX = Math.sin(carRoot ? carRoot.rotation.y : 0);
                dirZ = Math.cos(carRoot ? carRoot.rotation.y : 0);
            }
            eject = {
                t: 0,
                life: 2.6,
                x: t0.x, y: t0.y + 0.75, z: t0.z,
                dx: dirX, dz: dirZ,
                spin: (Math.random() - 0.5) * 2.2
            };
        }
        playCrashSound();
        paused = true;
        var score = runScore();
        if (!coinsAwarded && coinsCollected > 0 && typeof opts.onCoins === 'function') {
            coinsAwarded = true;
            try { opts.onCoins(coinsCollected); } catch (e) {}
        }
        if (typeof opts.onScore === 'function') {
            scoreSubmitted = true;
            try { opts.onScore('Redline GT', score); } catch (e) {}
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
        attachVehicleModel(car);
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
            var rrHeading = Math.atan2(highwayCurveX(rr.root.position.z + 5) - highwayCurveX(rr.root.position.z - 5), 10);
            rr.root.rotation.y = rrHeading + clamp(dx * 0.18, -0.38, 0.38);
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

    function trafficLaneClear(car, lane) {
        if (lane < 0 || lane >= laneCenters.length) return false;
        for (var i = 0; i < traffic.length; i++) {
            var other = traffic[i];
            if (other === car || other.lane !== lane) continue;
            var gap = other.root.position.z - car.root.position.z;
            if (gap > -16 && gap < 16) return false;
        }
        return true;
    }

    function updateTraffic(dt) {
        if (!chassis) return;
        if (worldMode !== 'highway') {
            traffic.forEach(function (car) { car.root.setEnabled(false); });
            return;
        }
        var p = chassis.translation();
        var pz = p.z;
        for (var i = 0; i < traffic.length; i++) {
            var car = traffic[i];
            car.root.position.z += car.speed * dt;
            // Follow the road exactly, and smooth only the lane-change offset.
            // The old world-X lerp lagged on bends and made cars scrub across
            // lanes and into the barriers.
            if (car.laneOffset == null) car.laneOffset = laneCenters[car.lane];
            var laneTargetOffset = laneCenters[car.lane];
            car.laneOffset += (laneTargetOffset - car.laneOffset) * Math.min(1, dt * 3.4);
            car.root.position.x = highwayCurveX(car.root.position.z) + car.laneOffset;
            var curveHeading = Math.atan2(
                highwayCurveX(car.root.position.z + 5) - highwayCurveX(car.root.position.z - 5), 10);
            var laneYaw = clamp((laneTargetOffset - car.laneOffset) * 0.055, -0.16, 0.16);
            car.root.rotation.y = curveHeading + laneYaw;
            for (var w = 0; w < car.wheels.length; w++) car.wheels[w].rotation.x += car.speed * dt * 3.2;
            car.cool = Math.max(0, car.cool - dt);

            // Simple car-following so traffic brakes realistically.
            var leadGap = 999;
            for (var oi = 0; oi < traffic.length; oi++) {
                var other = traffic[oi];
                if (other === car || other.lane !== car.lane) continue;
                var gapZ = other.root.position.z - car.root.position.z;
                if (gapZ > 0 && gapZ < leadGap) leadGap = gapZ;
            }
            // ---- Reactive traffic ----
            // A player tucked in right behind makes the AI either pick up the
            // pace or move over. It always signals and hesitates first.
            var gapBehind = car.root.position.z - pz;
            var playerInLane = Math.abs(p.x - car.root.position.x) < 2.4;
            var tailgated = !garage && !runOver && !paused && playerInLane &&
                gapBehind > 0 && gapBehind < 15 && displaySpeed > car.speed - 2.5;
            if (car.aiCooldown > 0) car.aiCooldown = Math.max(0, car.aiCooldown - dt);

            if (tailgated && car.aiState === 'drive' && car.aiCooldown <= 0) {
                car.aiState = 'hesitate';
                car.aiThink = 0.55 + Math.random() * 1.05;
                var lumbering = car.style === 'truck' || car.style === 'bus';
                car.aiPlan = Math.random() < (lumbering ? 0.34 : 0.62) ? 'lane' : 'boost';
                car.aiTargetLane = -1;
                if (car.aiPlan === 'lane') {
                    var side = Math.random() < 0.5 ? -1 : 1;
                    var options = [car.lane + side, car.lane - side];
                    for (var oi2 = 0; oi2 < options.length; oi2++) {
                        if (trafficLaneClear(car, options[oi2])) {
                            car.aiTargetLane = options[oi2];
                            break;
                        }
                    }
                    if (car.aiTargetLane < 0) {
                        car.aiPlan = 'boost';
                    } else {
                        car.aiSignalSide = car.aiTargetLane > car.lane ? 1 : -1;
                    }
                }
                car.aiCooldown = 5 + Math.random() * 3;
            }

            if (car.aiState === 'hesitate') {
                car.aiThink -= dt;
                if (car.aiThink <= 0) {
                    if (car.aiPlan === 'lane' && car.aiTargetLane >= 0 && trafficLaneClear(car, car.aiTargetLane)) {
                        car.lane = car.aiTargetLane;
                        car.aiState = 'change';
                        car.aiThink = 0.9 + Math.random() * 0.5;
                    } else {
                        car.aiState = 'drive';
                        car.aiPlan = '';
                        car.aiSignalSide = 0;
                    }
                }
            } else if (car.aiState === 'change') {
                car.aiThink -= dt;
                var laneCentre = highwayCurveX(car.root.position.z) + laneCenters[car.lane];
                if (car.aiThink <= 0 && Math.abs(car.root.position.x - laneCentre) < 0.6) {
                    car.aiState = 'drive';
                    car.aiSignalSide = 0;
                }
            }

            if (tailgated && car.aiState !== 'hesitate') {
                car.boost = Math.min(1, car.boost + dt * 1.7);
            } else {
                car.boost = Math.max(0, car.boost - dt * 0.4);
            }

            car.aiBlink = (car.aiBlink || 0) + dt;
            var signalOn = Math.sin(car.aiBlink * 18) > 0.15;
            if (car.indMatL && car.indMatR) {
                var leftOn = car.aiSignalSide < 0 && signalOn;
                var rightOn = car.aiSignalSide > 0 && signalOn;
                car.indMatL.emissiveColor.set(leftOn ? 1 : 0.10, leftOn ? 0.55 : 0.05, 0.01);
                car.indMatR.emissiveColor.set(rightOn ? 1 : 0.10, rightOn ? 0.55 : 0.05, 0.01);
            }

            if (!car.cruise) car.cruise = car.speed;
            var desired = car.cruise * (1 + car.boost * 0.30);
            if (car.aiState === 'hesitate') desired = Math.min(desired, Math.max(4, car.speed - 1.2));
            if (leadGap < 16) desired = Math.min(desired, Math.max(6, car.cruise * (leadGap / 16)));
            if (leadGap < 8) desired = Math.min(desired, 6);
            var accelRate = desired > car.speed ? (2.6 + car.boost * 2.4) : 8.5;
            var prevSpeed = car.speed;
            car.speed += clamp(desired - car.speed, -accelRate * dt, accelRate * dt);
            var slowing = car.speed < prevSpeed - 0.02;
            car.braking = slowing || leadGap < 9;
            if (car.brakeMat) {
                var glow = car.braking ? 1.6 : 0.55;
                car.brakeMat.emissiveColor.set(glow, 0.03, 0.03);
            }
            // hazard blink when really hard on the brakes
            if (car.braking && leadGap < 7) {
                var blink = (Math.sin(performance.now() * 0.012) > 0);
                if (car.brakeMat) car.brakeMat.emissiveColor.set(blink ? 2.4 : 0.4, 0.02, 0.02);
            }
            if (car.root.position.z < pz - 100 || car.root.position.z > pz + 1050 || car.root.position.z > ROAD_LENGTH - 80) {
                placeTrafficCar(car, pz, 520 + Math.random() * 280);
            }
            if (car.body) {
                var tYaw = car.root.rotation.y;
                car.body.setNextKinematicTranslation({ x: car.root.position.x, y: 0.62, z: car.root.position.z });
                car.body.setNextKinematicRotation({ x: 0, y: Math.sin(tYaw / 2), z: 0, w: Math.cos(tYaw / 2) });
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
                var forwardKeep = Math.max(0.76, 1 - Math.min(0.22, 0.07 + closing * 0.003));
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
        if (worldMode !== 'highway') {
            coinPickups.forEach(function (coin) { coin.mesh.setEnabled(false); });
            return;
        }
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
            applyViewMode();
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

        if (smokeTexture) {
            var smoke = new BABYLON.ParticleSystem('impactSmoke', isLowPower() ? 40 : 80, scene);
            smoke.particleTexture = smokeTexture;
            smoke.emitter = new BABYLON.Vector3(0, 0.8, 0);
            smoke.minEmitBox = new BABYLON.Vector3(-0.4, -0.15, -0.4);
            smoke.maxEmitBox = new BABYLON.Vector3(0.4, 0.25, 0.4);
            smoke.color1 = new BABYLON.Color4(0.68, 0.67, 0.65, 0.42);
            smoke.color2 = new BABYLON.Color4(0.38, 0.37, 0.36, 0.28);
            smoke.colorDead = new BABYLON.Color4(0.12, 0.12, 0.12, 0);
            smoke.minSize = 0.30;
            smoke.maxSize = 1.15;
            smoke.minLifeTime = 0.45;
            smoke.maxLifeTime = 1.15;
            smoke.emitRate = 0;
            smoke.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            smoke.direction1 = new BABYLON.Vector3(-1.2, 0.4, -1.2);
            smoke.direction2 = new BABYLON.Vector3(1.2, 1.8, 0.6);
            smoke.minEmitPower = 0.4;
            smoke.maxEmitPower = 1.8;
            smoke.gravity = new BABYLON.Vector3(0, 0.5, 0);
            smoke.start();
            impactSmoke = smoke;
        }
    }

    function spawnCrashDebris(x, z, intensity) {
        if (!scene) return;
        if (!debrisPaintMat) {
            debrisPaintMat = new BABYLON.PBRMaterial('debrisPaint', scene);
            debrisPaintMat.albedoColor = color3(carPaintHex);
            debrisPaintMat.metallic = 0.65;
            debrisPaintMat.roughness = 0.3;
            debrisCarbonMat = new BABYLON.PBRMaterial('debrisCarbon', scene);
            debrisCarbonMat.albedoColor = new BABYLON.Color3(0.03, 0.032, 0.036);
            debrisCarbonMat.metallic = 0.3;
            debrisCarbonMat.roughness = 0.5;
            debrisTireMat = new BABYLON.PBRMaterial('debrisTire', scene);
            debrisTireMat.albedoColor = new BABYLON.Color3(0.012, 0.013, 0.015);
            debrisTireMat.metallic = 0;
            debrisTireMat.roughness = 0.9;
        }
        var count = Math.max(3, Math.min(9, 3 + Math.round((intensity || 0) * 0.5)));
        for (var i = 0; i < count; i++) {
            var size = 0.07 + Math.random() * 0.17;
            var m = BABYLON.MeshBuilder.CreateBox('crashDebris', { size: size }, scene);
            m.position.set(x + (Math.random() - 0.5) * 2.2, 0.55 + Math.random() * 0.8, z + (Math.random() - 0.5) * 2.4);
            m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            m.material = Math.random() < 0.58 ? debrisPaintMat : debrisCarbonMat;
            m.isPickable = false;
            debris.push({
                mesh: m,
                life: 1.5 + Math.random() * 1.1,
                vx: (Math.random() - 0.5) * 9,
                vy: 2.2 + Math.random() * 5.5,
                vz: (Math.random() - 0.5) * 9,
                rx: (Math.random() - 0.5) * 10,
                ry: (Math.random() - 0.5) * 10
            });
        }
        if ((intensity || 0) > 1.2 && Math.random() < 0.82) {
            var tire = BABYLON.MeshBuilder.CreateCylinder('crashTyre', { height: 0.25, diameter: 0.72, tessellation: 16 }, scene);
            tire.rotation.z = Math.PI / 2;
            tire.position.set(x + (Math.random() < 0.5 ? -1 : 1) * 1.05, 0.48, z + (Math.random() - 0.5) * 2.5);
            tire.material = debrisTireMat;
            tire.isPickable = false;
            debris.push({
                mesh: tire,
                life: 2.6,
                vx: (Math.random() - 0.5) * 8,
                vy: 2.5 + Math.random() * 4,
                vz: (Math.random() - 0.5) * 8,
                rx: (Math.random() - 0.5) * 8,
                ry: (Math.random() - 0.5) * 8
            });
        }
        while (debris.length > 48) {
            var old = debris.shift();
            try { old.mesh.dispose(); } catch (e) {}
        }
    }

    function updateDebris(dt) {
        for (var i = debris.length - 1; i >= 0; i--) {
            var d = debris[i];
            d.life -= dt;
            if (d.life <= 0) {
                try { d.mesh.dispose(); } catch (e) {}
                debris.splice(i, 1);
                continue;
            }
            d.vy -= 9.81 * dt;
            d.mesh.position.x += d.vx * dt;
            d.mesh.position.y += d.vy * dt;
            d.mesh.position.z += d.vz * dt;
            d.mesh.rotation.x += d.rx * dt;
            d.mesh.rotation.y += d.ry * dt;
            if (d.mesh.position.y < 0.08) {
                d.mesh.position.y = 0.08;
                d.vy = Math.abs(d.vy) * 0.32;
                d.vx *= 0.68;
                d.vz *= 0.68;
            }
        }
    }

    function triggerImpactFx(x, z, intensity) {
        spawnCrashDebris(x, z, intensity);
        if (!impactSparks) return;
        impactSparks.emitter = new BABYLON.Vector3(x, 0.82, z);
        impactSparks.emitRate = 160 + Math.min(340, (intensity || 0) * 10);
        if (impactSmoke) {
            impactSmoke.emitter = new BABYLON.Vector3(x, 0.8, z);
            impactSmoke.emitRate = 55 + Math.min(120, (intensity || 0) * 4);
        }
        impactSparkTimer = 0.22;
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

    function setAutoStatus(text, tone) {
        if (text === autoStatusText) return;
        autoStatusText = text;
        var el = document.getElementById('g3dAsStatus');
        if (!el) return;
        el.classList.add('is-on');
        el.classList.toggle('is-warn', tone === 'warn');
        el.classList.toggle('is-nudge', tone === 'nudge');
        var span = el.querySelector('span');
        if (span) span.textContent = text;
    }

    // Two thin blue guide lines that show the lane Autosteer is holding.
    function createAsLaneLines() {
        if (!scene || asLaneLines) return;
        var segs = 64;
        function makeLine(width, alpha) {
            var mesh = new BABYLON.Mesh('asLaneLine', scene);
            var positions = new Float32Array((segs + 1) * 2 * 3);
            var indices = [];
            for (var i = 0; i < segs; i++) {
                var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
                indices.push(a, b, c, b, d, c);
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
            mesh.setIndices(indices);
            var mat = new BABYLON.StandardMaterial('asLaneLineMat' + width, scene);
            mat.emissiveColor = new BABYLON.Color3(0.10, 0.52, 1.0);
            mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
            mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.disableLighting = true;
            mat.alpha = alpha;
            mat.backFaceCulling = false;
            mat.fogEnabled = false;
            mat.zOffset = -4;
            mesh.material = mat;
            mesh.isPickable = false;
            mesh.alwaysSelectAsActiveMesh = true;
            mesh.isVisible = false;
            return { mesh: mesh, positions: positions, width: width, mat: mat };
        }
        // inner core + soft outer glow, one pair per lane edge
        asLaneLines = {
            segs: segs,
            lines: [
                [makeLine(0.17, 1.0), makeLine(0.17, 1.0)],
                [makeLine(0.44, 0.12), makeLine(0.44, 0.12)]
            ],
            preview: [makeLine(0.13, 0.22), makeLine(0.13, 0.22)]
        };
    }

    function updateAsLaneLines() {
        if (!asLaneLines || !chassis) return;
        var show = autoSteer && !garage && !runOver;
        for (var g = 0; g < 2; g++) {
            asLaneLines.lines[g][0].mesh.isVisible = show;
            asLaneLines.lines[g][1].mesh.isVisible = show;
        }
        if (!show) {
            asLaneLines.preview[0].mesh.isVisible = false;
            asLaneLines.preview[1].mesh.isVisible = false;
            var stOff = document.getElementById('g3dAsStatus');
            if (stOff) stOff.classList.remove('is-on');
            return;
        }
        var p = chassis.translation();
        // Anchor the guides to the lane the car is actually in, not just the
        // lane Autosteer is aiming for, so both lines stay around the car.
        var actualOffset = p.x - highwayCurveX(p.z);
        asGuideOffset += (actualOffset - asGuideOffset) * 0.30;
        var behind = 16, ahead = 155, half = 2.22;
        for (var g2 = 0; g2 < 2; g2++) {
            for (var side = 0; side < 2; side++) {
                var line = asLaneLines.lines[g2][side];
                var centre = asGuideOffset + (side === 0 ? -half : half);
                var pos = line.positions;
                var hw = line.width * 0.5;
                for (var i = 0; i <= asLaneLines.segs; i++) {
                    var t = i / asLaneLines.segs;
                    var z = p.z - behind + t * (ahead + behind);
                    var x = highwayCurveX(z) + centre;
                    var o = i * 6;
                    pos[o] = x - hw;
                    pos[o + 1] = 0.09;
                    pos[o + 2] = z;
                    pos[o + 3] = x + hw;
                    pos[o + 4] = 0.09;
                    pos[o + 5] = z;
                }
                line.mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos, true);
            }
        }

        // Lane-change preview: a fainter, blinking pair on the target lane.
        var previewLane = autoChanging ? autoLane : (autoSignalTimer > 0 ? autoPendingLane : -1);
        var previewOn = previewLane >= 0 && previewLane < laneCenters.length;
        var pulse = 0.55 + Math.sin(performance.now() * 0.012) * 0.35;
        for (var ps = 0; ps < 2; ps++) {
            var pl = asLaneLines.preview[ps];
            pl.mesh.isVisible = previewOn;
            pl.mat.alpha = previewOn ? 0.30 * pulse : 0;
        }
        if (previewOn) {
            for (var ps2 = 0; ps2 < 2; ps2++) {
                var pl2 = asLaneLines.preview[ps2];
                var pcentre = laneCenters[previewLane] + (ps2 === 0 ? -half : half);
                var ppos = pl2.positions;
                var phw = pl2.width * 0.5;
                for (var pi = 0; pi <= asLaneLines.segs; pi++) {
                    var pt = pi / asLaneLines.segs;
                    var pz = p.z - 6 + pt * 96;
                    var px = highwayCurveX(pz) + pcentre;
                    var po = pi * 6;
                    ppos[po] = px - phw; ppos[po + 1] = 0.095; ppos[po + 2] = pz;
                    ppos[po + 3] = px + phw; ppos[po + 4] = 0.095; ppos[po + 5] = pz;
                }
                pl2.mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, ppos, true);
            }
        }
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
                '  float amount = strength * (0.20 + length(dir) * 0.95);' +
                '  vec4 sum = vec4(0.0); float weights = 0.0;' +
                '  for (int i = 0; i < 10; i++) {' +
                '    float t = float(i) / 9.0;' +
                '    float w = 1.0 - t * 0.55;' +
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

    function makeWorldSign(text, color) {
        var tex = new BABYLON.DynamicTexture('worldSign_' + text, { width: 512, height: 128 }, scene, false);
        var ctx = tex.getContext();
        ctx.fillStyle = 'rgba(2, 10, 14, 0.92)';
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = color || '#5fe7ff';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 504, 120);
        ctx.fillStyle = color || '#5fe7ff';
        ctx.font = '900 46px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 68);
        tex.update(false);
        var mat = new BABYLON.StandardMaterial('worldSignMat_' + text, scene);
        mat.diffuseTexture = tex;
        mat.emissiveTexture = tex;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        return mat;
    }

    function createMountains() {
        var mat = new BABYLON.PBRMaterial('mountainMat', scene);
        mat.albedoColor = new BABYLON.Color3(0.035, 0.055, 0.085);
        mat.metallic = 0.02;
        mat.roughness = 0.92;
        var source = BABYLON.MeshBuilder.CreateCylinder('mountainSource', { height: 1, diameterBottom: 1, diameterTop: 0, tessellation: 7 }, scene);
        source.material = mat;
        source.isVisible = false;
        for (var side = -1; side <= 1; side += 2) {
            for (var i = 0; i < 46; i++) {
                var z = 100 + i * (ROAD_LENGTH / 46);
                var x = highwayCurveX(z) + side * (150 + Math.random() * 230);
                var h = 70 + Math.random() * 190;
                var w = 80 + Math.random() * 150;
                var m = source.createInstance('mountain' + side + '_' + i);
                m.position.set(x, h / 2 - 1, z);
                m.scaling.set(w, h, w);
                m.rotation.y = Math.random() * Math.PI;
                m.freezeWorldMatrix();
            }
        }
    }

    function createPines() {
        var trunkMat = new BABYLON.PBRMaterial('pineTrunk', scene);
        trunkMat.albedoColor = new BABYLON.Color3(0.12, 0.075, 0.04);
        trunkMat.roughness = 0.95;
        var leafMat = new BABYLON.PBRMaterial('pineLeaf', scene);
        leafMat.albedoColor = new BABYLON.Color3(0.018, 0.075, 0.055);
        leafMat.roughness = 0.9;
        var trunk = BABYLON.MeshBuilder.CreateCylinder('pineTrunkSource', { height: 1, diameter: 0.18, tessellation: 6 }, scene);
        trunk.material = trunkMat;
        trunk.isVisible = false;
        var crown = BABYLON.MeshBuilder.CreateCylinder('pineCrownSource', { height: 1, diameterBottom: 1, diameterTop: 0, tessellation: 7 }, scene);
        crown.material = leafMat;
        crown.isVisible = false;
        for (var side = -1; side <= 1; side += 2) {
            for (var i = 0; i < 125; i++) {
                var z = 80 + i * (ROAD_LENGTH / 125) + Math.random() * 18;
                var x = highwayCurveX(z) + side * (38 + Math.random() * 32);
                var h = 6 + Math.random() * 8;
                var t = trunk.createInstance('pineTrunk' + side + '_' + i);
                t.position.set(x, h * 0.24, z);
                t.scaling.set(1, h * 0.5, 1);
                t.freezeWorldMatrix();
                var c = crown.createInstance('pineCrown' + side + '_' + i);
                c.position.set(x, h * 0.68, z);
                c.scaling.set(h * 0.23, h * 0.72, h * 0.23);
                c.freezeWorldMatrix();
            }
        }
    }

    function createRoadSigns() {
        var postMat = new BABYLON.PBRMaterial('signPost', scene);
        postMat.albedoColor = new BABYLON.Color3(0.20, 0.22, 0.24);
        postMat.metallic = 0.65;
        postMat.roughness = 0.35;
        var labels = ['CURVE AHEAD', 'REDLINE GT', 'NIGHT RUN', 'COAST 01', 'STAY SHARP', 'CITY LIMITS'];
        for (var i = 0; i < labels.length; i++) {
            var z = spawnZ + 480 + i * 1900;
            var side = i % 2 === 0 ? 1 : -1;
            var x = highwayCurveX(z) + side * 15.5;
            var post = BABYLON.MeshBuilder.CreateBox('signPost' + i, { width: 0.16, height: 4.2, depth: 0.16 }, scene);
            post.position.set(x, 2.1, z);
            post.material = postMat;
            var sign = BABYLON.MeshBuilder.CreatePlane('roadSign' + i, { width: 4.0, height: 1.1 }, scene);
            sign.position.set(x, 4.5, z);
            sign.material = makeWorldSign(labels[i], i % 2 ? '#ffcf4d' : '#5fe7ff');
            sign.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        }
    }

    function ensureRain() {
        if (rainSystem) return;
        // streak sprite
        var tex = new BABYLON.DynamicTexture('rainStreak', { width: 8, height: 64 }, scene, false);
        var rc = tex.getContext();
        var grad = rc.createLinearGradient(0, 0, 0, 64);
        grad.addColorStop(0, 'rgba(190,225,255,0)');
        grad.addColorStop(0.35, 'rgba(200,232,255,0.85)');
        grad.addColorStop(1, 'rgba(190,225,255,0)');
        rc.fillStyle = grad;
        rc.fillRect(3, 0, 2, 64);
        tex.update(false);
        tex.hasAlpha = true;
        var ps = new BABYLON.ParticleSystem('rain', isLowPower() ? 420 : 900, scene);
        ps.particleTexture = tex;
        ps.emitter = new BABYLON.Vector3(0, 12, 0);
        ps.minEmitBox = new BABYLON.Vector3(-26, 0, -60);
        ps.maxEmitBox = new BABYLON.Vector3(26, 0, 60);
        ps.color1 = new BABYLON.Color4(0.72, 0.82, 0.95, 0.55);
        ps.color2 = new BABYLON.Color4(0.62, 0.72, 0.9, 0.45);
        ps.colorDead = new BABYLON.Color4(0.6, 0.7, 0.9, 0.0);
        ps.minSize = 0.06;
        ps.maxSize = 0.13;
        ps.minLifeTime = 0.45;
        ps.maxLifeTime = 0.8;
        ps.emitRate = 0;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        ps.gravity = new BABYLON.Vector3(0, -55, 6);
        ps.direction1 = new BABYLON.Vector3(-1, -10, 3);
        ps.direction2 = new BABYLON.Vector3(1, -14, 7);
        ps.minAngularSpeed = 0;
        ps.maxAngularSpeed = 0;
        ps.minEmitPower = 1;
        ps.maxEmitPower = 2;
        ps.updateSpeed = 0.016;
        ps.start();
        rainSystem = ps;
    }

    function updateWeather(dt) {
        // Rain removed.
        rainIntensity = 0;
        rainTarget = 0;
        if (rainSystem) rainSystem.emitRate = 0;
        if (rainChip) rainChip.classList.remove('is-on');
        driveGrip = baseGrip;
    }

    function createTunnels() {
        tunnels = [];
        var concrete = new BABYLON.PBRMaterial('tunnelConcrete', scene);
        concrete.albedoColor = new BABYLON.Color3(0.22, 0.23, 0.25);
        concrete.metallic = 0.05;
        concrete.roughness = 0.9;
        var lining = new BABYLON.PBRMaterial('tunnelLining', scene);
        lining.albedoColor = new BABYLON.Color3(0.14, 0.155, 0.17);
        lining.metallic = 0.15;
        lining.roughness = 0.75;
        var lampMat = new BABYLON.StandardMaterial('tunnelLamp', scene);
        lampMat.diffuseColor = new BABYLON.Color3(1, 0.95, 0.8);
        lampMat.emissiveColor = new BABYLON.Color3(1, 0.86, 0.55);
        lampMat.disableLighting = true;

        for (var t = 0; t < 3; t++) {
            var z0 = spawnZ + 1250 + t * 2600;
            var len = 240, step = 10, segs = Math.floor(len / step);
            var parts = [];
            var lamps = [];
            for (var i = 0; i <= segs; i++) {
                var z = z0 + i * step;
                var cx = highwayCurveX(z);
                // side walls
                var wl = BABYLON.MeshBuilder.CreateBox('tunnelWallL', { width: 0.7, height: 6.4, depth: step + 0.4 }, scene);
                wl.position.set(cx - (ROAD_WIDTH / 2 - 0.9), 3.2, z);
                parts.push(wl);
                var wr = BABYLON.MeshBuilder.CreateBox('tunnelWallR', { width: 0.7, height: 6.4, depth: step + 0.4 }, scene);
                wr.position.set(cx + (ROAD_WIDTH / 2 - 0.9), 3.2, z);
                parts.push(wr);
                // ceiling
                var ce = BABYLON.MeshBuilder.CreateBox('tunnelCeil', { width: ROAD_WIDTH - 1.2, height: 0.7, depth: step + 0.4 }, scene);
                ce.position.set(cx, 6.5, z);
                parts.push(ce);
                // ceiling lamp every 20 m
                if (i % 2 === 0) {
                    var lamp = BABYLON.MeshBuilder.CreateBox('tunnelLampMesh', { width: 2.2, height: 0.08, depth: 0.5 }, scene);
                    lamp.position.set(cx, 6.05, z);
                    lamp.material = lampMat;
                    lamps.push(lamp);
                }
            }
            var merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, false);
            if (merged) {
                merged.material = lining;
                merged.isPickable = false;
                merged.receiveShadows = false;
                highwayMeshes.push(merged);
            }
            lamps.forEach(function (l) { l.isPickable = false; highwayMeshes.push(l); });
            // portal frames
            [-1, 1].forEach(function (end) {
                var pz = z0 + (end > 0 ? len : 0);
                var pcx = highwayCurveX(pz);
                var portal = BABYLON.MeshBuilder.CreateBox('tunnelPortal', { width: ROAD_WIDTH, height: 1.2, depth: 1.6 }, scene);
                portal.position.set(pcx, 7.0, pz);
                portal.material = concrete;
                highwayMeshes.push(portal);
                [ -1, 1 ].forEach(function (sd) { var ox = sd * (ROAD_WIDTH / 2 - 0.4);
                    var post = BABYLON.MeshBuilder.CreateBox('tunnelPortalPost', { width: 1.4, height: 7.2, depth: 1.6 }, scene);
                    post.position.set(pcx + ox, 3.6, pz);
                    post.material = concrete;
                    highwayMeshes.push(post);
                });
            });
            tunnels.push({ from: z0, to: z0 + len });
        }
    }

    function updateTunnels(dt) {
        if (!chassis || !sun) return;
        var p = chassis.translation();
        var inside = false;
        for (var i = 0; i < tunnels.length; i++) {
            if (p.z > tunnels[i].from + 4 && p.z < tunnels[i].to - 4) { inside = true; break; }
        }
        tunnelDark += ((inside ? 1 : 0) - tunnelDark) * Math.min(1, dt * 3.2);
        sun.intensity = baseSunIntensity * (1 - tunnelDark * 0.86);
        if (hemi) hemi.intensity = (isLowPower() ? 0.55 : 0.62) * (1 - tunnelDark * 0.7);
        // headlights come on automatically in the dark
        if (tunnelDark > 0.5 && !headlightsOn) {
            headlightsOn = true;
            headlights.forEach(function (light) { light.setEnabled(true); light.intensity = 4.5; });
        }
    }

    function createTollPlazas() {
        tollPlazas = [];
        var steel = new BABYLON.PBRMaterial('tollSteel', scene);
        steel.albedoColor = new BABYLON.Color3(0.20, 0.23, 0.26);
        steel.metallic = 0.6;
        steel.roughness = 0.42;
        var boothMat = new BABYLON.PBRMaterial('tollBooth', scene);
        boothMat.albedoColor = new BABYLON.Color3(0.42, 0.45, 0.5);
        boothMat.metallic = 0.15;
        boothMat.roughness = 0.6;
        var boomMat = new BABYLON.StandardMaterial('tollBoom', scene);
        boomMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
        boomMat.emissiveColor = new BABYLON.Color3(0.35, 0.35, 0.35);
        var redMat = new BABYLON.StandardMaterial('tollRed', scene);
        redMat.diffuseColor = new BABYLON.Color3(0.9, 0.16, 0.16);
        redMat.emissiveColor = new BABYLON.Color3(1, 0.12, 0.1);
        redMat.disableLighting = true;
        var greenMat = new BABYLON.StandardMaterial('tollGreen', scene);
        greenMat.diffuseColor = new BABYLON.Color3(0.2, 0.95, 0.45);
        greenMat.emissiveColor = new BABYLON.Color3(0.1, 1, 0.4);
        greenMat.disableLighting = true;

        var startZ = spawnZ + 760;
        for (var p = 0; p < 6; p++) {
            var z = startZ + p * 1500;
            var cx = highwayCurveX(z);
            var plaza = { z: z, lanes: [], canopy: null, stripFrom: z - 100, stripTo: z - 10 };
            // Rumble strips run from 100 m out all the way to 10 m before the booth.
            var stripMat = new BABYLON.StandardMaterial('tollStripMat', scene);
            stripMat.diffuseColor = new BABYLON.Color3(0.42, 0.32, 0.09);
            stripMat.emissiveColor = new BABYLON.Color3(0.06, 0.04, 0.008);
            stripMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            var stripParts = [];
            for (var st = 0; st < 74; st++) {
                var strip = BABYLON.MeshBuilder.CreateBox('tollStrip' + p + '_' + st, { width: ROAD_WIDTH - 2.5, height: 0.05, depth: 0.55 }, scene);
                strip.position.set(cx, 0.05, z - 99 + st * 1.2);
                stripParts.push(strip);
            }
            var stripMerged = BABYLON.Mesh.MergeMeshes(stripParts, true, true, undefined, false, false);
            if (stripMerged) {
                stripMerged.material = stripMat;
                stripMerged.isPickable = false;
                highwayMeshes.push(stripMerged);
            }
            // booths every 5.5m across the road
            var offsets = [-10.1, -3.4, 3.4, 10.1];
            var etcIndex = p % offsets.length;
            offsets.forEach(function (off, li) {
                var bx = cx + off;
                var booth = BABYLON.MeshBuilder.CreateBox('tollBooth' + p + '_' + li, { width: 1.5, height: 2.5, depth: 2.6 }, scene);
                booth.position.set(bx, 1.25, z);
                booth.material = boothMat;
                highwayMeshes.push(booth);
                var roof = BABYLON.MeshBuilder.CreateBox('tollRoof' + p + '_' + li, { width: 2.0, height: 0.22, depth: 3.2 }, scene);
                roof.position.set(bx, 2.62, z);
                roof.material = steel;
                highwayMeshes.push(roof);
                // light (red closed / green ETC)
                var light = BABYLON.MeshBuilder.CreateSphere('tollLight' + p + '_' + li, { diameter: 0.34, segments: 8 }, scene);
                light.position.set(bx, 3.1, z + 0.4);
                light.material = li === etcIndex ? greenMat : redMat;
                highwayMeshes.push(light);
                // boom arm: pivot at the booth edge, arm across the lane
                var pivot = new BABYLON.TransformNode('tollPivot' + p + '_' + li, scene);
                pivot.position.set(bx + 0.85, 0.95, z - 1.2);
                var arm = BABYLON.MeshBuilder.CreateBox('tollArm' + p + '_' + li, { width: 4.2, height: 0.14, depth: 0.16 }, scene);
                arm.position.set(2.1, 0, 0);
                arm.parent = pivot;
                arm.material = boomMat;
                pivot.rotation.z = li === etcIndex ? 1.15 : 0;   // ETC lane open, others down
                highwayMeshes.push(arm);
                plaza.lanes.push({ x: bx, z: z - 1.2, pivot: pivot, arm: arm, open: li === etcIndex, etc: li === etcIndex, broken: false, anim: li === etcIndex ? 1 : 0, target: li === etcIndex ? 1 : 0, wait: 0 });
            });
            // canopy across the whole plaza
            var canopy = BABYLON.MeshBuilder.CreateBox('tollCanopy' + p, { width: 22, height: 0.36, depth: 6.2 }, scene);
            canopy.position.set(cx, 5.4, z);
            canopy.material = steel;
            highwayMeshes.push(canopy);
            var signMat = makeWorldSign('TOLL · ETC LANE ' + (etcIndex + 1), '#5fe7ff');
            var sign = BABYLON.MeshBuilder.CreatePlane('tollSign' + p, { width: 9.6, height: 1.3 }, scene);
            sign.position.set(cx, 4.55, z + 3.3);
            sign.material = signMat;
            sign.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            highwayMeshes.push(sign);
            tollPlazas.push(plaza);
        }
    }

    function updateTolls(dt) {
        if (!tollPlazas.length || !chassis) return;
        var t = chassis.translation();
        // Which side of the strips are we on?
        var onStrips = false;
        for (var si = 0; si < tollPlazas.length; si++) {
            var pz = tollPlazas[si];
            if (t.z > pz.stripFrom && t.z < pz.stripTo) { onStrips = true; break; }
        }
        if (onStrips) {
            var spd = Math.hypot(chassis.linvel().x, chassis.linvel().z);
            if (spd > 3) {
                rumbleShake = Math.min(1, 0.35 + spd / 40);
                var wob = Math.sin(performance.now() * 0.045) * 240 * (0.4 + spd / 30);
                try { chassis.applyImpulse({ x: 0, y: wob * 0.004, z: 0 }, true); } catch (e) {}
                var av = chassis.angvel();
                try { chassis.setAngvel({ x: av.x + Math.sin(performance.now() * 0.06) * 0.05, y: av.y, z: av.z }, true); } catch (e) {}
                // Rumble strips scrub speed: the faster you hit them, the more they cost.
                try {
                    var lv = chassis.linvel();
                    var drag = Math.min(0.55, 0.10 + spd / 140);
                    chassis.setLinvel({ x: lv.x * (1 - drag * dt), y: lv.y, z: lv.z * (1 - drag * dt) }, true);
                } catch (e) {}
            }
        } else {
            rumbleShake = Math.max(0, rumbleShake - dt * 2.2);
        }
        var v = chassis.linvel();
        var speed = Math.hypot(v.x, v.z);
        for (var i = 0; i < tollPlazas.length; i++) {
            var plaza = tollPlazas[i];
            for (var j = 0; j < plaza.lanes.length; j++) {
                var lane = plaza.lanes[j];
                if (lane.etc) { lane.anim = 1; lane.pivot.rotation.z = 1.35; continue; }
                var dz = t.z - lane.z;
                var inLane = Math.abs(t.x - lane.x) < 2.3;

                // Auto-open when you pull up and stop at a closed barrier.
                if (inLane && dz < -1.6 && dz > -9 && speed < 3.0) {
                    lane.target = 1;
                    lane.wait = 0;
                }
                // Auto-close again once you're through and a little way past.
                if (dz > 3.5) {
                    lane.wait += dt;
                    if (lane.wait > 0.9) lane.target = 0;
                }

                // Animate the boom smoothly.
                var diff = lane.target - lane.anim;
                if (Math.abs(diff) > 0.001) {
                    lane.anim += diff * Math.min(1, dt * 7.5);
                    if (Math.abs(lane.target - lane.anim) < 0.01) lane.anim = lane.target;
                }
                lane.pivot.rotation.z = lane.anim * 1.35;

                // Closed boom physically stops you from driving through.
                if (lane.anim < 0.55 && inLane && dz > -1.9 && dz < 1.1 && v.z > 0.4) {
                    var pushZ = lane.z - 2.05;
                    try { chassis.setTranslation({ x: t.x, y: t.y, z: pushZ }, true); } catch (e) {}
                    try { chassis.setLinvel({ x: v.x * 0.08, y: v.y, z: -0.4 }, true); } catch (e) {}
                    if (!lane.bumpCool || lane.bumpCool <= 0) {
                        lane.bumpCool = 1.6;
                        playCrashSound();
                        showToast('STOP AT THE BARRIER · it opens when you halt');
                    }
                }
                if (lane.bumpCool > 0) lane.bumpCool = Math.max(0, lane.bumpCool - dt);
            }
        }
    }

    function createExitGate(x, z, root, label) {
        var metal = new BABYLON.PBRMaterial('exitMetal', scene);
        metal.albedoColor = new BABYLON.Color3(0.16, 0.23, 0.26);
        metal.metallic = 0.7;
        metal.roughness = 0.35;
        function part(name, w, h, d, px, py, pz, mat) {
            var m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            m.position.set(px, py, pz);
            m.material = mat;
            if (root) m.parent = root;
            else highwayMeshes.push(m);
            return m;
        }
        part('exitPostL', 0.28, 5.2, 0.28, x - 2.5, 2.6, z, metal);
        part('exitPostR', 0.28, 5.2, 0.28, x + 2.5, 2.6, z, metal);
        part('exitTop', 5.2, 0.34, 0.3, x, 5.2, z, metal);
        var sign = BABYLON.MeshBuilder.CreatePlane(label + 'Sign', { width: 4.5, height: 1.12 }, scene);
        sign.position.set(x, 5.35, z + 0.10);
        sign.material = makeWorldSign(label, label === 'HIGHWAY' ? '#ffcf4d' : '#5fe7ff');
        sign.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        if (root) sign.parent = root; else highwayMeshes.push(sign);
        var glow = new BABYLON.StandardMaterial('exitGlow_' + label, scene);
        glow.diffuseColor = label === 'HIGHWAY' ? new BABYLON.Color3(1, 0.65, 0.16) : new BABYLON.Color3(0.18, 0.85, 1);
        glow.emissiveColor = glow.diffuseColor;
        glow.disableLighting = true;
        var strip = BABYLON.MeshBuilder.CreateBox(label + 'Light', { width: 4.8, height: 0.05, depth: 0.12 }, scene);
        strip.position.set(x, 5.02, z);
        strip.material = glow;
        if (root) strip.parent = root; else highwayMeshes.push(strip);
    }

    function createHighwayExits() {
        [spawnZ + 520, spawnZ + 2500].forEach(function (z, index) {
            var exitX = highwayCurveX(z) + 7.2;
            createExitGate(exitX, z, null, index === 0 ? 'CITY' : 'CITY 2');
            highwayExits.push(z);
            var arrow = new BABYLON.MeshBuilder.CreateBox('exitArrow' + index, { width: 4.2, height: 0.035, depth: 0.22 }, scene);
            arrow.position.set(exitX, 0.06, z - 18);
            var arrowMat = new BABYLON.StandardMaterial('exitArrowMat' + index, scene);
            arrowMat.diffuseColor = new BABYLON.Color3(0.18, 0.85, 1);
            arrowMat.emissiveColor = arrowMat.diffuseColor;
            arrow.material = arrowMat;
            highwayMeshes.push(arrow);
        });
    }

    function createCity() {
        cityRoot = new BABYLON.TransformNode('cityRoot', scene);
        cityRoot.setEnabled(false);
        var ground = BABYLON.MeshBuilder.CreateGround('cityGround', { width: 430, height: 430 }, scene);
        ground.position.set(CITY_X, 0.01, CITY_Z);
        var groundMat = new BABYLON.PBRMaterial('cityGroundMat', scene);
        groundMat.albedoColor = new BABYLON.Color3(0.055, 0.07, 0.09);
        groundMat.metallic = 0.08;
        groundMat.roughness = 0.78;
        ground.material = groundMat;
        ground.parent = cityRoot;
        ground.receiveShadows = true;

        // Grid streets with bright lane paint.
        var paint = new BABYLON.StandardMaterial('cityPaint', scene);
        paint.diffuseColor = new BABYLON.Color3(0.75, 0.88, 0.92);
        paint.emissiveColor = new BABYLON.Color3(0.28, 0.36, 0.40);
        for (var road = -2; road <= 2; road++) {
            var h = BABYLON.MeshBuilder.CreateBox('cityLineH', { width: 430, height: 0.02, depth: 0.12 }, scene);
            h.position.set(CITY_X, 0.035, CITY_Z + road * 65);
            h.material = paint;
            h.parent = cityRoot;
            var v = BABYLON.MeshBuilder.CreateBox('cityLineV', { width: 0.12, height: 0.02, depth: 430 }, scene);
            v.position.set(CITY_X + road * 65, 0.035, CITY_Z);
            v.material = paint;
            v.parent = cityRoot;
        }

        var buildingMats = [];
        for (var bi = 0; bi < 4; bi++) {
            var bm = new BABYLON.PBRMaterial('cityBuildingMat' + bi, scene);
            bm.albedoColor = new BABYLON.Color3(0.055 + bi * 0.018, 0.075 + bi * 0.02, 0.09 + bi * 0.025);
            bm.metallic = 0.18;
            bm.roughness = 0.62;
            buildingMats.push(bm);
        }
        var windowMat = new BABYLON.StandardMaterial('cityWindowMat', scene);
        windowMat.diffuseColor = new BABYLON.Color3(1, 0.72, 0.34);
        windowMat.emissiveColor = new BABYLON.Color3(1, 0.52, 0.16);
        windowMat.disableLighting = true;

        for (var ix = -2; ix <= 2; ix++) {
            for (var iz = -2; iz <= 2; iz++) {
                if (ix === 0 && iz === 0) continue;
                var bx = CITY_X + ix * 65 + (Math.random() - 0.5) * 8;
                var bz = CITY_Z + iz * 65 + (Math.random() - 0.5) * 8;
                var bw = 25 + Math.random() * 12;
                var bd = 25 + Math.random() * 12;
                var bh = 12 + Math.random() * 42;
                var b = BABYLON.MeshBuilder.CreateBox('cityBuilding', { width: bw, height: bh, depth: bd }, scene);
                b.position.set(bx, bh / 2, bz);
                b.material = buildingMats[(ix + iz + 8) % buildingMats.length];
                b.parent = cityRoot;
                cityBuildings.push({ x: bx, z: bz, w: bw, d: bd, h: bh });
                for (var wy = 4; wy < bh - 3; wy += 5.2) {
                    var w = BABYLON.MeshBuilder.CreateBox('cityWindow', { width: Math.max(5, bw * 0.55), height: 0.22, depth: 0.12 }, scene);
                    w.position.set(bx, wy, bz - bd / 2 - 0.08);
                    w.material = windowMat;
                    w.parent = cityRoot;
                }
            }
        }

        for (var li = -2; li <= 2; li++) {
            for (var lj = -2; lj <= 2; lj++) {
                var pole = BABYLON.MeshBuilder.CreateCylinder('cityLampPole', { height: 7.5, diameter: 0.14, tessellation: 8 }, scene);
                pole.position.set(CITY_X + li * 65 + 30, 3.75, CITY_Z + lj * 65 + 30);
                pole.material = new BABYLON.PBRMaterial('cityLampMetal', scene);
                pole.parent = cityRoot;
                var bulb = BABYLON.MeshBuilder.CreateSphere('cityLampBulb', { diameter: 0.55, segments: 8 }, scene);
                bulb.position.set(CITY_X + li * 65 + 30, 7.55, CITY_Z + lj * 65 + 30);
                bulb.material = windowMat;
                bulb.parent = cityRoot;
            }
        }

    }

    function setWorldMode(mode) {
        worldMode = mode;
        if (cityRoot) cityRoot.setEnabled(mode === 'city');
        highwayMeshes.forEach(function (m) { m.setEnabled(mode === 'highway'); });
        traffic.forEach(function (car) {
            car.root.setEnabled(mode === 'highway');
            if (car.collider) car.collider.setEnabled(mode === 'highway');
        });
        coinPickups.forEach(function (coin) { coin.mesh.setEnabled(mode === 'highway' && coin.active); });
    }

    function enterCity(fromZ) {
        if (worldMode === 'city') return;
        savedHighwayZ = fromZ || savedHighwayZ;
        setWorldMode('city');
        chassis.setTranslation({ x: 0, y: 0.92, z: CITY_Z - 150 }, true);
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
        portalCooldown = 2.5;
        resetCamera(true);
        showToast('CITY · FIND THE HIGHWAY GATE');
    }

    function returnToHighway() {
        if (worldMode !== 'city') return;
        setWorldMode('highway');
        chassis.setTranslation({ x: highwayCurveX(savedHighwayZ + 70), y: 0.92, z: savedHighwayZ + 70 }, true);
        chassis.setLinvel({ x: 0, y: 0, z: 18 }, true);
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
        portalCooldown = 2.5;
        resetCamera(true);
        showToast('HIGHWAY');
    }

    function updateWorldPortals(dt) {
        portalCooldown = Math.max(0, portalCooldown - dt);
    }


    function createInterior() {
        interiorRoot = new BABYLON.TransformNode('interiorRoot', scene);
        interiorRoot.parent = carRoot;
        interiorRoot.setEnabled(false);

        var leather = new BABYLON.PBRMaterial('interiorLeather', scene);
        leather.albedoColor = new BABYLON.Color3(0.24, 0.235, 0.225);
        leather.metallic = 0.05;
        leather.roughness = 0.72;
        var carbon = new BABYLON.PBRMaterial('interiorCarbon', scene);
        carbon.albedoColor = new BABYLON.Color3(0.11, 0.115, 0.125);
        carbon.metallic = 0.45;
        carbon.roughness = 0.28;
        var aluminium = new BABYLON.PBRMaterial('interiorAluminium', scene);
        aluminium.albedoColor = new BABYLON.Color3(0.42, 0.46, 0.5);
        aluminium.metallic = 0.9;
        aluminium.roughness = 0.2;
        var trimMat = new BABYLON.StandardMaterial('interiorTrimLight', scene);
        trimMat.diffuseColor = new BABYLON.Color3(1, 0.30, 0.18);
        trimMat.emissiveColor = new BABYLON.Color3(1, 0.10, 0.05);
        trimMat.disableLighting = true;

        function box(name, w, h, d, x, y, z, mat) {
            var m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            m.position.set(x, y, z);
            m.material = mat;
            m.parent = interiorRoot;
            return m;
        }

        box('dashTop', 1.72, 0.14, 0.48, 0, 0.29, 0.76, leather);
        box('dashFace', 1.68, 0.22, 0.22, 0, 0.17, 0.87, carbon);
        box('console', 0.30, 0.18, 0.62, 0.20, 0.13, 0.32, carbon);
        box('doorPanelL', 0.045, 0.38, 0.96, -0.98, 0.22, -0.12, leather);
        box('doorPanelR', 0.045, 0.38, 0.96, 0.98, 0.22, -0.12, leather);
        box('dashTrim', 1.48, 0.022, 0.030, 0, 0.255, 0.53, trimMat);
        box('mirror', 0.30, 0.065, 0.05, 0, 0.82, 0.96, carbon);
        box('pillarL', 0.034, 0.52, 0.060, -0.96, 0.63, 1.05, leather);
        box('pillarR', 0.034, 0.52, 0.060, 0.96, 0.63, 1.05, leather);
        box('hoodEdge', 1.55, 0.030, 0.50, 0, 0.26, 1.65, carbon);
        var headlinerMat = new BABYLON.PBRMaterial('interiorHeadliner', scene);
        headlinerMat.albedoColor = new BABYLON.Color3(0.55, 0.54, 0.52);
        headlinerMat.metallic = 0.02;
        headlinerMat.roughness = 0.95;
        var headliner = box('headliner', 1.58, 0.045, 1.30, 0, 0.98, -0.05, headlinerMat);
        box('headlinerFront', 1.54, 0.055, 0.08, 0, 0.94, 0.66, leather);
        box('overheadConsole', 0.32, 0.055, 0.22, 0, 0.945, 0.34, carbon);
        var roofLightMat = new BABYLON.StandardMaterial('interiorRoofLightMat', scene);
        roofLightMat.diffuseColor = new BABYLON.Color3(1, 0.78, 0.44);
        roofLightMat.emissiveColor = new BABYLON.Color3(1, 0.50, 0.15);
        roofLightMat.disableLighting = true;
        box('roofLightL', 0.10, 0.020, 0.12, -0.18, 0.925, 0.34, roofLightMat);
        box('roofLightR', 0.10, 0.020, 0.12, 0.18, 0.925, 0.34, roofLightMat);

        interiorScreenTex = new BABYLON.DynamicTexture('interiorCluster', { width: 1024, height: 1024 }, scene, false);
        interiorScreenTex.anisotropicFilteringLevel = 8;
        interiorScreenTex.hasAlpha = true;
        var clusterMat = new BABYLON.StandardMaterial('interiorClusterMat', scene);
        clusterMat.diffuseTexture = interiorScreenTex;
        clusterMat.emissiveTexture = interiorScreenTex;
        clusterMat.emissiveColor = new BABYLON.Color3(0.98, 0.98, 0.98);
        clusterMat.specularColor = new BABYLON.Color3(0, 0, 0);
        clusterMat.disableLighting = true;
        clusterMat.backFaceCulling = false;
        var cluster = BABYLON.MeshBuilder.CreatePlane('interiorClusterPlane', { width: 0.36, height: 0.36 }, scene);
        // Big clear dial on the dash beside the wheel, angled to the driver.
        cluster.position.set(0.11, 0.53, 0.80);
        cluster.rotation.y = Math.PI - 0.30;
        cluster.rotation.x = -0.05;
        cluster.material = clusterMat;
        cluster.parent = interiorRoot;
        cluster.isVisible = false;
        // Keep the dial sharp: exclude it from the bloom/glow pass.
        if (glowLayer) { try { glowLayer.addExcludedMesh(cluster); } catch (e) {} }
        // Physical dial housing + chrome bezel so it looks like a real instrument.
        var bezel = BABYLON.MeshBuilder.CreateTorus('interiorGaugeBezel', { diameter: 0.375, thickness: 0.016, tessellation: 42 }, scene);
        bezel.rotation.y = Math.PI - 0.30;
        bezel.rotation.x = -0.05;
        bezel.position.set(0.11, 0.53, 0.792);
        bezel.material = aluminium;
        bezel.parent = interiorRoot;
        bezel.isVisible = false;
        // small backlight so the dial stays legible at night
        var gaugeLight = new BABYLON.PointLight('interiorGaugeLight', new BABYLON.Vector3(0.05, 0.56, 0.60), scene);
        gaugeLight.parent = carRoot;
        gaugeLight.intensity = 0.9;
        gaugeLight.range = 1.6;
        gaugeLight.diffuse = new BABYLON.Color3(0.85, 0.94, 1.0);
        gaugeLight.setEnabled(false);
        interiorGaugeLight = gaugeLight;

        centerScreenTex = new BABYLON.DynamicTexture('interiorCenter', { width: 320, height: 160 }, scene, false);
        var centerMat = new BABYLON.StandardMaterial('interiorCenterMat', scene);
        centerMat.diffuseTexture = centerScreenTex;
        centerMat.emissiveTexture = centerScreenTex;
        centerMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        centerMat.disableLighting = true;
        centerMat.backFaceCulling = false;
        var center = BABYLON.MeshBuilder.CreatePlane('interiorCenterPlane', { width: 0.40, height: 0.20 }, scene);
        center.position.set(0.24, 0.44, 0.64);
        center.rotation.y = Math.PI;
        center.material = centerMat;
        center.parent = interiorRoot;

        interiorSteeringWheel = new BABYLON.TransformNode('interiorSteeringWheel', scene);
        interiorSteeringWheel.parent = interiorRoot;
        interiorSteeringWheel.position.set(-0.34, 0.38, 0.61);
        var stitchRingMat = new BABYLON.StandardMaterial('interiorWheelStitchMat', scene);
        stitchRingMat.diffuseColor = new BABYLON.Color3(0.86, 0.8, 0.66);
        stitchRingMat.emissiveColor = new BABYLON.Color3(0.24, 0.22, 0.18);
        var wheelMat = new BABYLON.PBRMaterial('interiorWheelLeather', scene);
        wheelMat.albedoColor = new BABYLON.Color3(0.12, 0.115, 0.11);
        wheelMat.metallic = 0.08;
        wheelMat.roughness = 0.52;
        wheelMat.emissiveColor = new BABYLON.Color3(0.012, 0.014, 0.016);
        // Sports steering wheel: flat-bottom rim, thumb grips, alloy spokes,
        // centre cap, shift paddles and a 12 o'clock stripe.
        var rim = BABYLON.MeshBuilder.CreateTorus('interiorWheelRim', { diameter: 0.30, thickness: 0.042, tessellation: 32 }, scene);
        rim.rotation.x = Math.PI / 2;
        rim.material = wheelMat;
        rim.parent = interiorSteeringWheel;
        // flat bottom section (chunky D-shape)
        var flatBottom = BABYLON.MeshBuilder.CreateBox('interiorWheelFlat', { width: 0.185, height: 0.052, depth: 0.042 }, scene);
        flatBottom.position.set(0, -0.146, 0);
        flatBottom.material = wheelMat;
        flatBottom.parent = interiorSteeringWheel;
        // thumb grips
        [-1, 1].forEach(function (dir) {
            var grip = BABYLON.MeshBuilder.CreateCylinder('interiorWheelGrip', { height: 0.085, diameter: 0.062, tessellation: 14 }, scene);
            grip.rotation.z = Math.PI / 2;
            grip.position.set(dir * 0.126, 0.046, 0);
            grip.material = wheelMat;
            grip.parent = interiorSteeringWheel;
        });
        // centre hub + cap
        var hub = BABYLON.MeshBuilder.CreateCylinder('interiorWheelHub', { height: 0.04, diameter: 0.105, tessellation: 20 }, scene);
        hub.rotation.x = Math.PI / 2;
        hub.position.z = 0.012;
        hub.material = carbon;
        hub.parent = interiorSteeringWheel;
        var cap = BABYLON.MeshBuilder.CreateCylinder('interiorWheelCap', { height: 0.012, diameter: 0.062, tessellation: 20 }, scene);
        cap.rotation.x = Math.PI / 2;
        cap.position.z = 0.034;
        cap.material = aluminium;
        cap.parent = interiorSteeringWheel;
        // three alloy spokes (9, 3 and 6 o'clock)
        [-1, 1].forEach(function (dir) {
            var spoke = BABYLON.MeshBuilder.CreateBox('interiorSpoke', { width: 0.115, height: 0.024, depth: 0.022 }, scene);
            spoke.position.set(dir * 0.082, 0.004, 0.008);
            spoke.rotation.z = dir * 0.12;
            spoke.material = aluminium;
            spoke.parent = interiorSteeringWheel;
            // spoke inlay strip
            var inlay = BABYLON.MeshBuilder.CreateBox('interiorSpokeInlay', { width: 0.09, height: 0.008, depth: 0.026 }, scene);
            inlay.position.set(dir * 0.082, 0.004, 0.008);
            inlay.rotation.z = dir * 0.12;
            inlay.material = carbon;
            inlay.parent = interiorSteeringWheel;
        });
        var lowerSpoke = BABYLON.MeshBuilder.CreateBox('interiorSpokeLow', { width: 0.03, height: 0.09, depth: 0.02 }, scene);
        lowerSpoke.position.set(0, -0.09, 0.008);
        lowerSpoke.material = aluminium;
        lowerSpoke.parent = interiorSteeringWheel;
        // shift paddles behind the rim
        [-1, 1].forEach(function (dir) {
            var paddle = BABYLON.MeshBuilder.CreateBox('interiorPaddle', { width: 0.055, height: 0.012, depth: 0.075 }, scene);
            paddle.position.set(dir * 0.125, 0.005, -0.035);
            paddle.material = aluminium;
            paddle.parent = interiorSteeringWheel;
        });
        // stitching ring + 12 o'clock marker
        var stitchRing = BABYLON.MeshBuilder.CreateTorus('interiorWheelStitch', { diameter: 0.285, thickness: 0.004, tessellation: 32 }, scene);
        stitchRing.rotation.x = Math.PI / 2;
        stitchRing.material = stitchRingMat;
        stitchRing.parent = interiorSteeringWheel;
        var wheelMarker = BABYLON.MeshBuilder.CreateBox('interiorWheelMarker', { width: 0.046, height: 0.014, depth: 0.02 }, scene);
        wheelMarker.position.set(0, 0.152, 0.006);
        wheelMarker.material = trimMat;
        wheelMarker.parent = interiorSteeringWheel;

        // ---- Cockpit detail pass: seats, door cards, vents, pedals, shifter ----
        var seatMat = new BABYLON.PBRMaterial('interiorSeat', scene);
        seatMat.albedoColor = new BABYLON.Color3(0.19, 0.175, 0.16);
        seatMat.metallic = 0.03;
        seatMat.roughness = 0.86;
        var stitch = new BABYLON.StandardMaterial('interiorStitch', scene);
        stitch.diffuseColor = new BABYLON.Color3(0.85, 0.78, 0.62);
        stitch.emissiveColor = new BABYLON.Color3(0.18, 0.16, 0.12);
        var rubber = new BABYLON.PBRMaterial('interiorRubber', scene);
        rubber.albedoColor = new BABYLON.Color3(0.09, 0.092, 0.1);
        rubber.metallic = 0.05;
        rubber.roughness = 0.9;

        // Driver + passenger seats (we sit in the driver's one)
        function seat(px, pz, flip) {
            box('seatBase', 0.46, 0.1, 0.5, px, 0.09, pz, seatMat);
            var back = box('seatBack', 0.46, 0.62, 0.1, px, 0.40, pz - 0.28, seatMat);
            back.rotation.x = flip ? -0.13 : -0.13;
            box('seatBolsterL', 0.08, 0.5, 0.14, px - 0.2, 0.36, pz - 0.26, seatMat);
            box('seatBolsterR', 0.08, 0.5, 0.14, px + 0.2, 0.36, pz - 0.26, seatMat);
            box('seatHead', 0.24, 0.14, 0.1, px, 0.78, pz - 0.3, seatMat);
            box('seatStitch', 0.02, 0.5, 0.02, px, 0.38, pz - 0.22, stitch);
        }
        seat(-0.34, -0.18, false);
        seat(0.38, -0.18, false);

        // Door cards with handles + window switches
        box('doorCardL', 0.03, 0.30, 0.84, -0.955, 0.30, -0.12, seatMat);
        box('doorCardR', 0.03, 0.30, 0.84, 0.955, 0.30, -0.12, seatMat);
        box('doorHandleL', 0.05, 0.035, 0.16, -0.92, 0.42, 0.18, aluminium);
        box('doorHandleR', 0.05, 0.035, 0.16, 0.92, 0.42, 0.18, aluminium);
        box('doorArmL', 0.12, 0.05, 0.42, -0.9, 0.30, 0.02, leather);
        box('doorArmR', 0.12, 0.05, 0.42, 0.9, 0.30, 0.02, leather);

        // Air vents either side of the dash + center vents
        var ventMat = new BABYLON.StandardMaterial('interiorVent', scene);
        ventMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.022);
        box('ventL', 0.14, 0.07, 0.03, -0.62, 0.28, 0.72, ventMat);
        box('ventR', 0.14, 0.07, 0.03, 0.62, 0.28, 0.72, ventMat);
        box('ventC1', 0.12, 0.06, 0.03, 0.06, 0.30, 0.66, ventMat);
        box('ventC2', 0.12, 0.06, 0.03, 0.22, 0.30, 0.66, ventMat);
        box('ventTrimC', 0.34, 0.015, 0.035, 0.14, 0.26, 0.66, aluminium);

        // Pedals + footwell
        box('pedalBrake', 0.10, 0.16, 0.03, -0.22, 0.02, 1.02, rubber);
        box('pedalThrottle', 0.07, 0.20, 0.03, -0.06, 0.0, 1.02, aluminium);
        box('footwell', 1.1, 0.03, 0.5, -0.1, -0.02, 0.95, rubber);

        // Center console with shifter and handbrake
        box('consoleTop', 0.26, 0.02, 0.5, 0.16, 0.215, 0.26, carbon);
        var shifter = BABYLON.MeshBuilder.CreateCylinder('shifterStick', { height: 0.14, diameter: 0.028, tessellation: 10 }, scene);
        shifter.position.set(0.16, 0.28, 0.24);
        shifter.material = aluminium;
        shifter.parent = interiorRoot;
        var knob = BABYLON.MeshBuilder.CreateSphere('shifterKnob', { diameter: 0.07, segments: 10 }, scene);
        knob.position.set(0.16, 0.36, 0.24);
        knob.material = rubber;
        knob.parent = interiorRoot;
        box('handbrake', 0.05, 0.04, 0.24, 0.16, 0.235, 0.02, aluminium);

        // Rear-view mirror stem + sun visors
        box('mirrorStem', 0.05, 0.12, 0.03, 0, 0.90, 0.94, carbon);
        box('visorL', 0.34, 0.02, 0.22, -0.36, 0.92, 0.72, leather);
        box('visorR', 0.34, 0.02, 0.22, 0.36, 0.92, 0.72, leather);

        interiorLight = new BABYLON.PointLight('interiorLight', new BABYLON.Vector3(-0.2, 0.72, 0.30), scene);
        interiorLight.parent = carRoot;
        interiorLight.intensity = 2.2;
        interiorLight.range = 7.5;
        interiorLight.diffuse = new BABYLON.Color3(0.86, 0.9, 1.0);
        interiorLight.setEnabled(false);
        // Soft warm fill from the dashboard so the cabin never reads as a dark void.
        interiorFill = new BABYLON.PointLight('interiorFill', new BABYLON.Vector3(0.15, 0.42, 0.95), scene);
        interiorFill.parent = carRoot;
        interiorFill.intensity = 1.1;
        interiorFill.range = 4.2;
        interiorFill.diffuse = new BABYLON.Color3(1.0, 0.86, 0.66);
        interiorFill.setEnabled(false);
        updateInteriorScreens(0, '1', 850);
    }

    function updateInteriorScreens(speed, gear, rpm) {
        if (!interiorScreenTex) return;
        try {
            var ctx = interiorScreenTex.getContext();
            var S = 1024, cx = S / 2, cy = S / 2 + 36, R = 352;
            var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;   // 270° sweep
            var norm = clamp(rpm / 8000, 0, 1);
            ctx.clearRect(0, 0, S, S);
            // face
            var face = ctx.createRadialGradient(cx, cy - 40, 30, cx, cy, R + 30);
            face.addColorStop(0, '#1b232b');
            face.addColorStop(.65, '#0b1016');
            face.addColorStop(1, '#04070a');
            ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, Math.PI * 2); ctx.fillStyle = face; ctx.fill();
            ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(150,180,200,.35)';
            ctx.beginPath(); ctx.arc(cx, cy, R + 20, 0, Math.PI * 2); ctx.stroke();
            // red zone 9-10
            ctx.beginPath(); ctx.arc(cx, cy, R - 6, a0 + (a1 - a0) * (8 / 9), a1);
            ctx.lineWidth = 36; ctx.strokeStyle = 'rgba(255,60,60,.85)'; ctx.stroke();
            // ticks + numbers 1..10
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (var i = 0; i < 10; i++) {
                var t = i / 9, ang = a0 + (a1 - a0) * t;
                var cos = Math.cos(ang), sin = Math.sin(ang);
                ctx.beginPath();
                ctx.moveTo(cx + cos * (R - 2), cy + sin * (R - 2));
                ctx.lineTo(cx + cos * (R - 22), cy + sin * (R - 22));
                ctx.lineWidth = 10;
                ctx.strokeStyle = i >= 8 ? '#ff5b5b' : 'rgba(235,248,255,.9)';
                ctx.stroke();
                ctx.font = '900 56px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
                ctx.fillStyle = i >= 8 ? '#ff6b6b' : '#eafaff';
                ctx.fillText(String(i + 1), cx + cos * (R - 46), cy + sin * (R - 46));
                if (i < 9) {
                    var mid = a0 + (a1 - a0) * ((i + 0.5) / 9);
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(mid) * (R - 8), cy + Math.sin(mid) * (R - 8));
                    ctx.lineTo(cx + Math.cos(mid) * (R - 16), cy + Math.sin(mid) * (R - 16));
                    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(200,225,240,.45)'; ctx.stroke();
                }
            }
            // RPM ×1000 caption
            ctx.fillStyle = 'rgba(143,216,255,.75)';
            ctx.font = '900 32px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
            ctx.fillText('RPM ×1000', cx, cy + 126);
            // needle
            var nang = a0 + (a1 - a0) * norm;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(nang);
            ctx.beginPath();
            ctx.moveTo(-26, 0); ctx.lineTo(R - 60, -14); ctx.lineTo(R - 60, 14); ctx.closePath();
            ctx.fillStyle = '#ff3b30'; ctx.shadowColor = 'rgba(255,60,48,.8)'; ctx.shadowBlur = 18; ctx.fill();
            ctx.restore();
            ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fillStyle = '#12171d'; ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(180,205,225,.5)'; ctx.stroke();
            // gear big centre
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 168px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
            ctx.fillText(String(gear), cx, cy + 232);
            ctx.fillStyle = 'rgba(143,216,255,.7)';
            ctx.font = '900 30px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
            ctx.fillText('GEAR', cx, cy + 296);
            // speed + unit at the top
            ctx.fillStyle = '#f4f8fb';
            ctx.font = '900 120px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
            ctx.fillText(String(speed), cx, cy - 226);
            ctx.fillStyle = '#8fd8ff';
            ctx.font = '900 44px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
            ctx.fillText(unit === 'kmh' ? 'KM/H' : 'MPH', cx, cy - 144);
            interiorScreenTex.update(false);
            // centre infotainment screen stays as-is
            if (centerScreenTex) {
                var c2 = centerScreenTex.getContext();
                c2.fillStyle = '#050d16'; c2.fillRect(0, 0, 320, 160);
                c2.fillStyle = '#5fe7ff'; c2.font = '900 20px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
                c2.textAlign = 'left'; c2.fillText('WASHING MACHINE', 18, 36);
                c2.fillStyle = 'rgba(143,216,255,0.62)'; c2.font = '800 12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
                c2.fillText('CITY NAVIGATION · ONLINE', 20, 68);
                c2.fillStyle = 'rgba(255,255,255,0.10)'; c2.fillRect(20, 88, 280, 2);
                c2.fillStyle = '#ffcf4d'; c2.fillRect(20, 108, 96 + (rpm / 8000) * 160, 7);
                c2.fillStyle = 'rgba(234,250,255,0.72)'; c2.font = '700 11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
                c2.fillText('TRACTION  ON      SPORT  ON      ASSIST  ON', 20, 140);
                centerScreenTex.update(false);
            }
        } catch (e) {}
    }

    function applyViewMode() {
        var showExterior = !!garage || cameraMode === 1;
        var hudGauges = document.getElementById('g3dGauges');
        if (hudGauges) hudGauges.style.display = '';
        if (realCarRoot) realCarRoot.setEnabled(showExterior);
        else {
            carVisuals.forEach(function (m) { m.setEnabled(showExterior); });
            wheelPivots.forEach(function (wp) { wp.node.setEnabled(showExterior); });
        }
        if (interiorRoot) interiorRoot.setEnabled(!showExterior);
        if (interiorLight) interiorLight.setEnabled(!showExterior);
        if (interiorFill) interiorFill.setEnabled(!showExterior);
        if (interiorGaugeLight) interiorGaugeLight.setEnabled(!showExterior);
    }

    function createVhs() {
        if (!BABYLON.Effect.ShadersStore['lessfunVhsFragmentShader']) {
            BABYLON.Effect.ShadersStore['lessfunVhsFragmentShader'] =
                'precision highp float;' +
                'varying vec2 vUV;' +
                'uniform sampler2D textureSampler;' +
                'uniform float time;' +
                'uniform float strength;' +
                'void main(void){' +
                '  vec2 uv = vUV;' +
                '  uv.x += sin(uv.y * 92.0 + time * 4.5) * 0.00075 * strength;' +
                '  float band = smoothstep(0.0, 0.018, abs(fract(uv.y * 0.35 - time * 0.055) - 0.5));' +
                '  uv.x += (1.0 - band) * 0.0015 * strength;' +
                '  float ca = 0.0014 * strength;' +
                '  float r = texture2D(textureSampler, clamp(uv + vec2(ca, 0.0), 0.0, 1.0)).r;' +
                '  float g = texture2D(textureSampler, uv).g;' +
                '  float b = texture2D(textureSampler, clamp(uv - vec2(ca, 0.0), 0.0, 1.0)).b;' +
                '  vec3 col = vec3(r, g, b);' +
                '  float scan = 0.5 + 0.5 * sin(uv.y * 1200.0);' +
                '  col *= 0.94 + scan * 0.06;' +
                '  float noise = fract(sin(dot(uv * vec2(1.0, 0.73) + time, vec2(12.9898, 78.233))) * 43758.5453);' +
                '  col += (noise - 0.5) * 0.045 * strength;' +
                '  float vig = smoothstep(0.92, 0.28, length((vUV - 0.5) * vec2(1.0, 1.08)));' +
                '  col *= mix(0.72, 1.0, vig);' +
                '  gl_FragColor = vec4(col, 1.0);' +
                '}';
        }
        vhsPost = new BABYLON.PostProcess('lessfunVhs', 'lessfunVhs', ['time', 'strength'], null, 1.0, camera, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine, false);
        vhsPost.onApply = function (effect) {
            effect.setFloat('time', performance.now() * 0.001);
            effect.setFloat('strength', 1.0);
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
        createInterior();
        loadVehicleModelLibrary();
        createExhaustSmoke();
        createDriftSmoke();
        createImpactFx();
        loadRealCarModel();

        // Subtle cinematic pass: ACES, bloom, FXAA. Skip bloom on low-power GPUs.
        try {
            var pipeline = new BABYLON.DefaultRenderingPipeline('racerPipeline', true, scene, [camera]);
            pipeline.fxaaEnabled = true;
            pipeline.bloomEnabled = true;
            pipeline.bloomThreshold = 0.52;
            pipeline.bloomWeight = 0.58;
            pipeline.bloomKernel = isLowPower() ? 24 : 64;
            pipeline.imageProcessingEnabled = true;
        } catch (e) {}

        try {
            glowLayer = new BABYLON.GlowLayer('racerGlow', scene, { mainTextureRatio: isLowPower() ? 0.35 : 0.5 });
            glowLayer.intensity = 0.72;
        } catch (e) {}
        createAsLaneLines();
        createMotionBlur();
        createVhs();
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

        var cityGround = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(CITY_X, -0.5, CITY_Z));
        world.createCollider(rapier.ColliderDesc.cuboid(230, 0.5, 230).setFriction(1.0), cityGround);
        cityBuildings.forEach(function (b) {
            var body = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(b.x, b.h / 2, b.z));
            world.createCollider(rapier.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2), body);
        });

        // Guardrail collision: invisible fixed cuboids chained along the curved
        // highway, matching the visible rail ribbons (visual rails sit at
        // highwayCurveX(z) ± (ROAD_WIDTH/2 + 0.5)). Chords are yaw-aligned so the
        // curve stays smooth. Rails span y 0.02–0.86, so jumps still clear them.
        var railSteps = 400;
        [-1, 1].forEach(function (side) {
            for (var ri = 0; ri < railSteps; ri++) {
                var z0 = (ri / railSteps) * ROAD_LENGTH;
                var z1 = ((ri + 1) / railSteps) * ROAD_LENGTH;
                var x0 = highwayCurveX(z0) + side * (ROAD_WIDTH / 2 + 0.5);
                var x1 = highwayCurveX(z1) + side * (ROAD_WIDTH / 2 + 0.5);
                var mx = (x0 + x1) / 2;
                var mz = (z0 + z1) / 2;
                var yaw = Math.atan2(x1 - x0, z1 - z0);
                var segLen = Math.hypot(x1 - x0, z1 - z0);
                var railBody = world.createRigidBody(rapier.RigidBodyDesc.fixed()
                    .setTranslation(mx, 0.45, mz)
                    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
                world.createCollider(rapier.ColliderDesc.cuboid(0.22, 0.5, segLen / 2 + 0.1), railBody);
            }
        });

        chassis = world.createRigidBody(rapier.RigidBodyDesc.dynamic()
            .setTranslation(0, 0.92, spawnZ)
            .setLinearDamping(0.035)
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
        gaugeBoot = 0.95;
        if (!readyAnnounced && opts && typeof opts.onReady === 'function') {
            readyAnnounced = true;
            try { opts.onReady(); } catch (e) {}
        }
        Object.keys(remoteRacers).forEach(function (id) { createRemoteBody(remoteRacers[id]); });
        worldMode = 'highway';
        setWorldMode('highway');
        syncCarVisual(0);
        resetRunWorld();
    }

    function applyPendingGear() {
        if (pendingGear !== null) {
            currentGear = pendingGear;
            gearLabel = currentGear === 'D' ? '1' : currentGear;
            if (currentGear === 'D') gearIndex = 1;
            else revLevel = 0;
            pendingGear = null;
            pendingGearIndex = null;
            playGearSound();
        } else if (pendingGearIndex !== null) {
            gearIndex = clamp(pendingGearIndex, 1, 8);
            gearLabel = String(gearIndex);
            pendingGearIndex = null;
            playGearSound();
        }
    }

    function applyControls(dt) {
        var speed = chassis.linvel();
        var forwardSpeed = Math.sqrt(speed.x * speed.x + speed.z * speed.z);
        var engineForce = 0;
        var brakeForce = 0;
        var nitroMax = driveMaxSpeed * 1.30;
        var throttle = input.throttle;
        var brake = input.brake;

        if (gearShiftTimer > 0) {
            gearShiftTimer = Math.max(0, gearShiftTimer - dt);
            if (gearShiftTimer <= 0) applyPendingGear();
        }
        var shiftingNow = gearShiftTimer > 0;
        if (shiftingNow) throttle = false;

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
            absActive = false;
            revLevel = Math.max(0, revLevel - dt * 2.5);
            vehicle.setWheelSteering(0, 0);
            vehicle.setWheelSteering(1, 0);
            for (var g = 0; g < 4; g++) {
                vehicle.setWheelEngineForce(g, 0);
                vehicle.setWheelBrake(g, runOver ? 60 : 30);
            }
            return;
        }

        if (currentGear === 'N') {
            revLevel += (throttle ? 1 : -1) * dt * (throttle ? 2.9 : 2.1);
            revLevel = clamp(revLevel, 0, 1);
        } else if (currentGear === 'P') {
            // Park: no revving, no movement — hold the brakes.
            revLevel = Math.max(0, revLevel - dt * 3.2);
            brakeForce = 58;
        } else if (currentGear === 'R') {
            revLevel += (throttle ? 1 : -1) * dt * (throttle ? 2.4 : 2.0);
            revLevel = clamp(revLevel, 0, 1);
            if (throttle) engineForce = -1450 * driveAccel;
            if (brake) brakeForce = 38;
        } else {
            if (!shiftingNow && pendingGearIndex === null && pendingGear === null) {
                var nextAutoGear = gearIndex;
                while (nextAutoGear < 8 && forwardSpeed > driveMaxSpeed * GEAR_TOPS[nextAutoGear - 1] * 0.96) nextAutoGear++;
                while (nextAutoGear > 1 && forwardSpeed < driveMaxSpeed * GEAR_TOPS[nextAutoGear - 2] * 0.68) nextAutoGear--;
                if (nextAutoGear > gearIndex + 1) nextAutoGear = gearIndex + 1;
                else if (nextAutoGear < gearIndex - 1) nextAutoGear = gearIndex - 1;
                if (nextAutoGear !== gearIndex) {
                    pendingGearIndex = nextAutoGear;
                    gearShiftTimer = 0.20;
                    playGearSound();
                }
            }
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
            if (brake) brakeForce = 56;
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

        absActive = false;
        if (brake && currentGear === 'D' && forwardSpeed > 8) {
            absActive = true;
            brakeForce = 30 + Math.abs(Math.sin(performance.now() * 0.043)) * 14;
        }

        var steerMax = 0.46 - Math.min(0.36, forwardSpeed / 150);
        var steerTarget = 0;
        // With autosteer engaged the keys are lane requests only — they never
        // feed steering directly.
        if (!autoSteer) {
            if (input.left) steerTarget += 1;
            if (input.right) steerTarget -= 1;
            if (input.pointerActive) steerTarget += input.pointerSteer;
        }
        function computeAutoDesired(pos, speedNow) {
            var dsWanted = driveMaxSpeed;
            var laneX = highwayCurveX(pos.z) + laneCenters[autoLane];
            var nearest = 0, best = 1e9;
            for (var k = 0; k < traffic.length; k++) {
                var c = traffic[k];
                if (!c || !c.root || !c.root.isEnabled()) continue;
                if (Math.abs(c.root.position.x - laneX) > 2.6) continue;
                var dzc = c.root.position.z - pos.z;
                if (dzc > -10 && dzc < 95 && dzc < best) { best = dzc; nearest = dzc; }
            }
            if (nearest > 0) dsWanted = Math.min(dsWanted, Math.max(5, nearest / 2.4));
            // Curvature-based speed: don't ask the tyres for more lateral grip
            // than they have on the bend ahead.
            var cvA = highwayCurveX(pos.z + 22) - 2 * highwayCurveX(pos.z + 11) + highwayCurveX(pos.z);
            var cvB = highwayCurveX(pos.z + 55) - 2 * highwayCurveX(pos.z + 40) + highwayCurveX(pos.z + 25);
            var curvatureAhead = Math.max(Math.abs(cvA) / (11 * 11), Math.abs(cvB) / (15 * 15));
            var gripForCurve = clamp(1 - tyreHeat * 0.30 - rainIntensity * 0.35, 0.45, 1);
            if (curvatureAhead > 0.00001) {
                var curveSpeed = Math.sqrt((6.2 * gripForCurve) / curvatureAhead);
                dsWanted = Math.min(dsWanted, Math.max(11, curveSpeed));
            }
            dsWanted = Math.min(dsWanted, driveMaxSpeed * (1 - rainIntensity * 0.28));
            for (var tp = 0; tp < tollPlazas.length; tp++) {
                var dzToll = tollPlazas[tp].z - pos.z;
                if (dzToll > 6 && dzToll < 95) {
                    var closedBoom = false;
                    for (var tl = 0; tl < tollPlazas[tp].lanes.length; tl++) {
                        var laneT = tollPlazas[tp].lanes[tl];
                        if (!laneT.etc && laneT.anim < 0.5 && Math.abs(pos.x - laneT.x) < 2.4) closedBoom = true;
                    }
                    if (closedBoom) dsWanted = Math.min(dsWanted, Math.max(0, dzToll / 3.2));
                }
            }
            autoDesired = clamp(dsWanted, 0, driveMaxSpeed);
            return autoDesired;
        }

        if (autoSteer && chassis) {
            var posDS = chassis.translation();
            var velDS = chassis.linvel();
            computeAutoDesired(posDS, Math.hypot(velDS.x, velDS.z));
        }
        // ============================================================
        //  Autosteer: pure pursuit + yaw damping + curvature feed-forward,
        //  signal-then-change lane logic, barrier corridor and grip limits.
        // ============================================================
        var asGrip = clamp(1 - tyreHeat * 0.30 - rainIntensity * 0.35, 0.45, 1);
        autoTgrip = asGrip;
        var asPos = chassis ? chassis.translation() : { x: 0, z: 0 };
        var asOffset = asPos.x - highwayCurveX(asPos.z);
        var asEdge = ROAD_WIDTH / 2 - 2.4;
        var asBarrier = Math.abs(asOffset) > asEdge - 2.2;

        function asWrap(a) {
            while (a > Math.PI) a -= Math.PI * 2;
            while (a < -Math.PI) a += Math.PI * 2;
            return a;
        }

        function asLead(lane, from, to) {
            if (!chassis || lane < 0 || lane >= laneCenters.length) return null;
            var laneX = highwayCurveX(asPos.z) + laneCenters[lane];
            var best = null;
            for (var k = 0; k < traffic.length; k++) {
                var c = traffic[k];
                if (!c || !c.root || !c.root.isEnabled()) continue;
                if (Math.abs(c.root.position.x - laneX) > 2.6) continue;
                var dz = c.root.position.z - asPos.z;
                if (dz > from && dz < to && (!best || dz < best.gap)) {
                    best = { gap: dz, speed: c.speed || 0 };
                }
            }
            return best;
        }

        function asLaneSafe(lane) {
            if (lane < 0 || lane >= laneCenters.length) return false;
            var ahead = asLead(lane, 0, 55);
            if (ahead) {
                var closing = Math.max(0, forwardSpeed - ahead.speed);
                if (ahead.gap < 14) return false;
                if (closing > 1 && ahead.gap / closing < 2.2) return false;
            }
            var behind = asLead(lane, -34, 0);
            if (behind) {
                var dist = -behind.gap;
                var closingB = Math.max(0, behind.speed - forwardSpeed);
                if (dist < 12) return false;
                if (closingB > 1 && dist / closingB < 1.7) return false;
            }
            return true;
        }

        function asSignalTo(target, urgent) {
            if (!autoSteer || autoChanging || autoSignalTimer > 0) return;
            if (target < 0 || target >= laneCenters.length || target === autoLane) return;
            if (!asLaneSafe(target)) { autoBlockedTimer = 0.9; return; }
            autoPendingLane = target;
            autoSignal = target > autoLane ? 1 : -1;
            autoSignalTimer = urgent ? 0.30 : 0.62;
            autoLaneTimer = Math.max(autoLaneTimer, 0.2);
        }

        if (!autoSteer) {
            autoWasOn = false;
            autoHands = 0; autoNudge = false; autoOverride = 0; autoRecover = 0;
            autoSignalTimer = 0; autoSignal = 0; autoPendingLane = -1;
            autoChanging = false; autoChangeT = 1;
            autoLeftHold = 0; autoRightHold = 0; autoNextPlan = 0; autoOvertake = false;
        } else if (chassis) {
            // Any transition into AS, or a fresh AS session, starts the
            // hands-on clock. This keeps the 5 s nudge reliable even if the
            // key handler belongs to an earlier game instance.
            if (!autoWasOn || autoLastSteerAt <= 0) autoLastSteerAt = performance.now();
            // Throttle/brake deliberately do NOT reset this: only steering
            // input proves the driver is holding the wheel. Wall-clock time
            // means the nudge still arrives after 5 s at any frame rate.
            if (input.left || input.right || input.pointerActive || input.throttle || input.brake || input.drift) autoLastSteerAt = performance.now();
            autoNudge = autoLastSteerAt > 0 && performance.now() - autoLastSteerAt > 5000 && autoOverride < 0.15;
            autoWasOn = true;

            if (input.left) autoLeftHold += dt; else autoLeftHold = 0;
            if (input.right) autoRightHold += dt; else autoRightHold = 0;
            if (autoLeftHold > 0.45 || autoRightHold > 0.45 || input.pointerActive) autoOverride = 1;
            else autoOverride = Math.max(0, autoOverride - dt * 0.7);

            if (autoTapRequest) {
                asSignalTo(autoLane + autoTapRequest, false);
                autoTapRequest = 0;
            }
            autoRecover = Math.max(0, autoRecover - dt);
            autoBlockedTimer = Math.max(0, autoBlockedTimer - dt);
            autoNextPlan = Math.max(0, autoNextPlan - dt);
            autoLaneTimer = Math.max(0, autoLaneTimer - dt);

            // Plan toll routing, overtakes and returns only when settled.
            if (!autoChanging && autoSignalTimer <= 0 && autoLaneTimer <= 0 && autoNextPlan <= 0) {
                var tollHandled = false;
                for (var tpi = 0; tpi < tollPlazas.length && !tollHandled; tpi++) {
                    var plazaAhead = tollPlazas[tpi];
                    var dzPlaza = plazaAhead.z - asPos.z;
                    if (dzPlaza <= 0 || dzPlaza >= 170) continue;
                    var bestOpen = -1, bestOpenDist = 1e9;
                    for (var gli = 0; gli < laneCenters.length; gli++) {
                        var gateX = highwayCurveX(plazaAhead.z) + laneCenters[gli];
                        var gateLane = null;
                        for (var gl = 0; gl < plazaAhead.lanes.length; gl++) {
                            if (Math.abs(plazaAhead.lanes[gl].x - gateX) < 2.2) { gateLane = plazaAhead.lanes[gl]; break; }
                        }
                        if (gateLane && (gateLane.etc || gateLane.anim > 0.55 || gateLane.broken)) {
                            var dGate = Math.abs(laneCenters[gli] - asOffset);
                            if (dGate < bestOpenDist) { bestOpenDist = dGate; bestOpen = gli; }
                        }
                    }
                    if (bestOpen >= 0 && bestOpen !== autoLane) asSignalTo(bestOpen, true);
                    tollHandled = true;
                }

                var leadA = asLead(autoLane, 4, 95);
                if (leadA) {
                    var slowLead = leadA.speed < forwardSpeed - 2.5 && leadA.gap < 78;
                    var stoppedLead = leadA.speed < 1.5 && leadA.gap < 65;
                    if ((slowLead || stoppedLead) && forwardSpeed > 5) {
                        var dirs = [];
                        if (autoLane > 0) dirs.push(-1);
                        if (autoLane < laneCenters.length - 1) dirs.push(1);
                        var bestDir = 0, bestScore = -1;
                        for (var di = 0; di < dirs.length; di++) {
                            var cand = autoLane + dirs[di];
                            if (!asLaneSafe(cand)) continue;
                            var candLead = asLead(cand, 0, 90);
                            var score = candLead ? candLead.gap : 999;
                            if (score > bestScore) { bestScore = score; bestDir = dirs[di]; }
                        }
                        if (bestDir) {
                            autoReturnLane = autoLane;
                            autoOvertake = true;
                            asSignalTo(autoLane + bestDir, !!stoppedLead);
                            autoNextPlan = 2.8;
                        }
                    }
                }

                if (autoOvertake && autoLane !== autoReturnLane && forwardSpeed > 5) {
                    var backDir = autoReturnLane > autoLane ? 1 : -1;
                    var returnLane = autoLane + backDir;
                    if (asLaneSafe(returnLane) && !asLead(autoLane, 0, 55)) {
                        asSignalTo(returnLane, false);
                        autoNextPlan = 3.2;
                    }
                }
                if (autoLane === autoReturnLane) autoOvertake = false;
            }

            // Signal, then commit. The move itself is a smooth S-curve.
            if (autoSignalTimer > 0) {
                autoSignalTimer -= dt;
                if (autoSignalTimer <= 0) {
                    if (autoPendingLane >= 0 && asLaneSafe(autoPendingLane)) {
                        autoChanging = true;
                        autoChangeFrom = autoOffset;
                        autoChangeTo = laneCenters[autoPendingLane];
                        autoChangeT = 0;
                        autoChangeDur = clamp(1.5 + Math.abs(autoChangeTo - autoChangeFrom) / 2.6 + forwardSpeed / 95, 1.5, 4.4);
                        autoLane = autoPendingLane;
                        autoLaneTimer = 1.0;
                    } else {
                        autoBlockedTimer = 1.1;
                    }
                    autoPendingLane = -1;
                    autoSignal = 0;
                }
            }
            if (autoChanging) {
                autoChangeT = Math.min(1, autoChangeT + dt / Math.max(0.6, autoChangeDur));
                var ease = autoChangeT * autoChangeT * (3 - 2 * autoChangeT);
                autoOffset = autoChangeFrom + (autoChangeTo - autoChangeFrom) * ease;
                if (autoChangeT >= 1) {
                    autoChanging = false;
                    autoOffset = autoChangeTo;
                    autoLaneTimer = Math.max(autoLaneTimer, 0.6);
                }
            } else if (autoSignalTimer <= 0) {
                autoOffset += (laneCenters[autoLane] - autoOffset) * Math.min(1, dt * 6.5);
                if (Math.abs(laneCenters[autoLane] - autoOffset) < 0.02) autoOffset = laneCenters[autoLane];
            }
            autoOffset = clamp(autoOffset, -asEdge, asEdge);

            // Steering: manual override wins while A/D is held.
            if (autoOverride > 0.05) {
                var manSteer = (input.left ? 1 : 0) + (input.right ? -1 : 0);
                if (input.pointerActive) manSteer += input.pointerSteer;
                steerTarget = clamp(manSteer, -1, 1);
            } else if (forwardSpeed > 1.5) {
                var q = chassis.rotation();
                var yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
                var pos = chassis.translation();
                var offsetNow = pos.x - highwayCurveX(pos.z);

                if (!autoChanging && autoLaneTimer <= 0 && Math.abs(offsetNow - laneCenters[autoLane]) > 5.2) {
                    var bestLane = 3, bestDist = 1e9;
                    for (var li = 0; li < laneCenters.length; li++) {
                        var dLane = Math.abs(laneCenters[li] - offsetNow);
                        if (dLane < bestDist) { bestDist = dLane; bestLane = li; }
                    }
                    autoLane = bestLane;
                }

                var vel = chassis.linvel();
                var spd = Math.hypot(vel.x, vel.z);
                var slip = 0;
                if (spd > 2) slip = asWrap(Math.atan2(vel.x, vel.z) - yaw);

                if (Math.abs(slip) > 0.35) {
                    autoRecover = 2.5;
                    autoSignalTimer = 0; autoPendingLane = -1; autoSignal = 0;
                    autoChanging = false; autoChangeT = 1;
                    throttle = false; brake = false;
                    var roadYawSpin = Math.atan2(highwayCurveX(pos.z + 14) - highwayCurveX(pos.z), 14);
                    steerTarget = clamp(asWrap(roadYawSpin - yaw) * 1.35, -1, 1);
                    var ang = chassis.angvel();
                    try { chassis.setAngvel({ x: ang.x, y: ang.y * (1 - Math.min(0.6, dt * 5.0)), z: ang.z }, true); } catch (e) {}
                } else {
                    var look = clamp(9 + forwardSpeed * 0.78, 10, 34);
                    var lookZ = pos.z + look;
                    var roadYawNow = Math.atan2(highwayCurveX(pos.z + 16) - highwayCurveX(pos.z), 16);
                    var roadYawLook = Math.atan2(highwayCurveX(lookZ) - highwayCurveX(lookZ - 16), 16);
                    var targetX = clamp(highwayCurveX(lookZ) + autoOffset,
                        highwayCurveX(lookZ) - asEdge, highwayCurveX(lookZ) + asEdge);
                    var lateral = (targetX - pos.x) * Math.cos(yaw) - (lookZ - pos.z) * Math.sin(yaw);
                    var headingErr = asWrap(roadYawLook - yaw);
                    var yawRate = chassis.angvel().y;
                    var authority = clamp(1.15 - forwardSpeed / 95, 0.42, 1.0);
                    var curvature = asWrap(roadYawLook - roadYawNow) / Math.max(8, look * 0.6);
                    var steerFF = Math.atan(2.75 * curvature) / Math.max(0.2, steerMax);
                    var steerCmd = lateral * 0.20 * authority + headingErr * 0.95 - yawRate * 0.20 + steerFF;

                    // Never ask the tyres for more lateral grip than they have.
                    var maxLat = 7.4 * asGrip * (autoRecover > 0 ? 0.62 : 1);
                    var latCap = Math.atan(2.75 * maxLat / Math.max(30, forwardSpeed * forwardSpeed));
                    var cmdCap = clamp(latCap / Math.max(0.2, steerMax), 0.14, 1);
                    steerCmd = clamp(steerCmd, -cmdCap, cmdCap);

                    // Barrier corridor: push back toward the road if drifting out.
                    if (asBarrier) {
                        steerCmd += (offsetNow > 0 ? -1 : 1) * 0.55;
                        steerCmd = clamp(steerCmd, -1, 1);
                    }
                    var rate = autoRecover > 0 ? 4.5 : 8.5;
                    steerTarget += (steerCmd - steerTarget) * Math.min(1, dt * rate);
                }
            }

            // Speed safety: time-gap following, stopped cars, grip, barriers.
            autoLeadGap = 0; autoLeadSpeed = 0;
            var leadS = asLead(autoLane, -4, 110);
            var targetSpeed = autoDesired;
            if (autoRecover > 0) targetSpeed = Math.min(targetSpeed, driveMaxSpeed * 0.55);
            targetSpeed *= (0.78 + 0.22 * asGrip);
            if (asBarrier) targetSpeed = Math.min(targetSpeed, driveMaxSpeed * 0.55);
            if (leadS) {
                autoLeadGap = leadS.gap;
                autoLeadSpeed = leadS.speed;
                var safeGap = (1.7 + (1 - asGrip) * 0.9) * Math.max(7, forwardSpeed);
                if (leadS.speed < 1.5 && leadS.gap < 75) {
                    targetSpeed = Math.min(targetSpeed, Math.max(0, (leadS.gap - 9) * 0.85));
                } else {
                    targetSpeed = Math.min(targetSpeed, leadS.speed + Math.max(0, leadS.gap - safeGap) * 0.55);
                }
            }
            if (targetSpeed < 1.0 && forwardSpeed > 0.3) { throttle = false; brake = true; }
            else if (forwardSpeed > targetSpeed + 2.4) { throttle = false; brake = true; }
            else if (forwardSpeed > targetSpeed + 0.7) { throttle = false; }
            // The right pedal stays with the driver; AS only lifts/brakes.

            // Status strip.
            var statusText = 'HOLDING LANE ' + (autoLane + 1);
            var statusTone = '';
            if (autoNudge) { statusText = 'HOLD THE WHEEL'; statusTone = 'nudge'; }
            else if (autoOverride > 0.06) { statusText = 'MANUAL OVERRIDE'; statusTone = 'warn'; }
            else if (autoRecover > 0) { statusText = 'RECOVERING · REDUCED SPEED'; statusTone = 'warn'; }
            else if (asBarrier) { statusText = 'BARRIER · CORRECTING'; statusTone = 'warn'; }
            else if (autoBlockedTimer > 0) { statusText = 'LANE BLOCKED'; statusTone = 'warn'; }
            else if (autoChanging) { statusText = 'CHANGING TO LANE ' + (autoLane + 1); }
            else if (autoSignalTimer > 0) { statusText = 'SIGNALLING · LANE ' + (autoPendingLane + 1); }
            else if (leadS && autoLeadGap > 0) { statusText = 'FOLLOWING · ' + Math.round(autoLeadGap) + ' M'; }
            else if (asGrip < 0.72) { statusText = 'GRIP LOW · ASSIST ON'; statusTone = 'warn'; }
            setAutoStatus(statusText, statusTone);
        } else {
            setAutoStatus('', '');
            var stEl = document.getElementById('g3dAsStatus');
            if (stEl) stEl.classList.remove('is-on');
        }

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

        // Tyre heat is state based: it only starts after 5 s of continuous
        // throttle or braking, and only cools after 5 s of neither.
        if (throttle) {
            accelHold += dt; brakeHold = 0; coastHold = 0;
        } else if (brake) {
            brakeHold += dt; accelHold = 0; coastHold = 0;
        } else {
            coastHold += dt; accelHold = 0; brakeHold = 0;
        }
        if (accelHold >= 10 || brakeHold >= 10) heatMode = 'heating';
        if (coastHold >= 2) heatMode = 'cooling';

        var lateralLoad = Math.abs(steerVisual) * forwardSpeed;
        if (heatMode === 'heating') {
            var heatRate = 0.045 + forwardSpeed * 0.0045 + lateralLoad * 0.0032;
            if (input.drift) heatRate += 0.07;
            tyreHeat = clamp(tyreHeat + heatRate * dt, 0, 1);
        } else if (heatMode === 'cooling') {
            tyreHeat = clamp(tyreHeat - 0.32 * dt, 0, 1);
        }
        var tyreGripFactor = 1 - tyreHeat * 0.30;

        // Stability assist: braking while turning used to spin the car. Add grip
        // and damp the yaw rate so it tracks the corner instead of snapping.
        var stability = 0;
        if (brake && Math.abs(steerVisual) > 0.12 && forwardSpeed > 7) {
            stability = clamp((forwardSpeed - 7) / 35, 0, 1);
        }
        for (var i = 0; i < 4; i++) {
            vehicle.setWheelBrake(i, brakeForce);
            var rear = i >= 2;
            var slip = input.drift && rear ? 0.95 : driveGrip * tyreGripFactor;
            if (stability > 0) slip *= 1 + stability * 0.45;
            vehicle.setWheelFrictionSlip(i, slip);
        }
        if (stability > 0) {
            var avNow = chassis.angvel();
            var damp = 1 - Math.min(0.22, 0.06 + stability * 0.20);
            try { chassis.setAngvel({ x: avNow.x, y: avNow.y * damp, z: avNow.z }, true); } catch (e) {}
        }

        // Light aerodynamic drag; keeps the car from coasting forever.
        var v = chassis.linvel();
        var drag = 0.006 * forwardSpeed;
        chassis.applyImpulse({ x: -v.x * drag * dt, y: 0, z: -v.z * drag * dt }, true);

        var targetRpm;
        if (currentGear === 'P' || currentGear === 'N') {
            targetRpm = 850 + revLevel * 7200;
        } else if (currentGear === 'R') {
            targetRpm = 900 + revLevel * 5200;
        } else {
            var targetGearTop = driveMaxSpeed * GEAR_TOPS[gearIndex - 1];
            var targetGearBottom = gearIndex > 1 ? driveMaxSpeed * GEAR_TOPS[gearIndex - 2] : 0;
            var mechanicalRpm = 900 + clamp((forwardSpeed - targetGearBottom) / Math.max(1, targetGearTop - targetGearBottom), 0, 1) * 6200;
            var throttleRpm = throttle ? (5200 + (input.nitro && nitro > 0 ? 1200 : 0)) : 0;
            targetRpm = Math.max(mechanicalRpm, throttleRpm);
        }
        engineRpm += (targetRpm - engineRpm) * Math.min(1, dt * 5.2);

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
        if (worldMode === 'highway') distance = Math.max(distance, t.z - spawnZ);
        displaySpeed = Math.sqrt(v.x * v.x + v.z * v.z);
        runSeconds += dt;
        updateWorldPortals(dt);
        lastPlayerZ = t.z;

        if (worldMode === 'highway' && t.z > ROAD_LENGTH - 220) {
            chassis.setTranslation({ x: highwayCurveX(spawnZ + 20), y: 0.92, z: spawnZ + 20 }, true);
            chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
            resetRunWorld();
        }
        // Use distance from the road centre, not raw world X, so the stronger
        // curves never trigger a false "off the map" reset.
        var roadOffset = t.x - highwayCurveX(t.z);
        if (t.y < -3 || Math.abs(roadOffset) > ROAD_WIDTH / 2 + 26 || t.z < -20) resetCar(false);
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
        var resetZ = spawnZ;
        chassis.setTranslation({ x: highwayCurveX(resetZ), y: 0.92, z: resetZ }, true);
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
        if (worldMode === 'city') setWorldMode('highway');
        flyTime = 0;
        flyCooldown = 0;
        powerShakeLevel = 0;
        cameraPrevSpeed = 0;
        cameraAccelSmooth = 0;
        if (chassis) chassis.setGravityScale(1, true);
        resetCamera(true);
        if (!silent) showToast('RESET · REDLINE GT');
    }

    /* --------------------------------------------------------------------
       Camera and HUD
       -------------------------------------------------------------------- */

    function resetCamera(snap) {
        if (!camera) return;
        cameraPrevSpeed = displaySpeed;
        cameraAccelSmooth = 0;
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
        if (eject) {
            eject.t += dt;
            var p = Math.min(1, eject.t / eject.life);
            var ease = 1 - Math.pow(1 - p, 3);
            var carPosE = carRoot ? carRoot.position : new BABYLON.Vector3(eject.x, eject.y, eject.z);
            var px = eject.x + eject.dx * ease * 9.5;
            var pz = eject.z + eject.dz * ease * 9.5;
            var py = eject.y + ease * 4.2 + Math.sin(Math.min(1, p * 1.15) * Math.PI) * 2.2;
            camera.position.set(px, py, pz);
            camera.upVector.set(Math.sin(eject.spin * p) * 0.5, 1, 0);
            camera.setTarget(new BABYLON.Vector3(carPosE.x, carPosE.y + 0.6, carPosE.z));
            camera.fov = 1.15;
            if (p >= 1) eject = null;
            return;
        }
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
        if (cameraMode === 1) {
            var chaseTarget = carPos.add(forward.scale(5.0)).add(new BABYLON.Vector3(0, 0.9, 0));
            var chasePos = carPos.subtract(forward.scale(8.8)).add(new BABYLON.Vector3(0, 3.45, 0));
            camPos = BABYLON.Vector3.Lerp(camPos, chasePos, 1 - Math.pow(0.001, dt));
            camTarget = BABYLON.Vector3.Lerp(camTarget, chaseTarget, 1 - Math.pow(0.0007, dt));
            camera.position.copyFrom(camPos);
            camera.upVector.set(0, 1, 0);
            camera.setTarget(camTarget);
            camera.fov = 1.02 + speedFactor * 0.08;
            return;
        }
        var instantAccel = (displaySpeed - cameraPrevSpeed) / Math.max(0.001, dt);
        cameraPrevSpeed = displaySpeed;
        cameraAccelSmooth += (clamp(instantAccel, 0, 32) - cameraAccelSmooth) * Math.min(1, dt * 7.0);

        var targetPowerShake = 0;
        if (!paused && !runOver && !garage) {
            if (currentGear === 'D' || currentGear === 'R') {
                if (input.throttle) targetPowerShake = 0.020 + speedFactor * 0.036;
                if (input.nitro && nitro > 0 && input.throttle) targetPowerShake += 0.030;
            } else if (input.throttle) {
                targetPowerShake = 0.026 + revLevel * 0.032;
            }
        }
        if (rumbleShake > 0.001) {
            targetPowerShake += rumbleShake * 0.035 * (0.6 + Math.sin(performance.now() * 0.07) * 0.4);
        }
        var shakeResponse = targetPowerShake > powerShakeLevel ? 3.4 : 2.1;
        powerShakeLevel += (targetPowerShake - powerShakeLevel) * Math.min(1, dt * shakeResponse);
        var powerShake = powerShakeLevel;

        // Always-first-person cockpit camera. Mounted at the driver's eye,
        // rigidly attached to the car so every bump, lean and impact is felt.
        var eyeLocal = new BABYLON.Vector3(-0.33, 0.72, -0.05);
        eyeLocal.x += steerVisual * 0.030;
        eyeLocal.z -= Math.min(0.16, cameraAccelSmooth * 0.0065);
        var eye = carPos.add(BABYLON.Vector3.TransformNormal(eyeLocal, rotMatrix));
        var focus = eye.add(forward.scale(18)).add(new BABYLON.Vector3(0, 0.06 + (input.brake ? -0.02 : 0), 0));
        camPos = eye;
        camTarget = focus;
        camera.position.copyFrom(eye);
        camera.upVector.set(steerVisual * 0.024, 1, 0);
        camera.setTarget(camTarget);
        camera.fov = 1.06 + speedFactor * 0.06;
    }

    function syncCarVisual(dt) {
        if (!carRoot) return;
        if (!chassis) {
            carRoot.position.set(highwayCurveX(spawnZ), 0.92, spawnZ);
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
        if (interiorSteeringWheel) interiorSteeringWheel.rotation.z = -steerVisual * 1.18;
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
        speedHudTimer += dt;
        var raw = displaySpeed;
        var gaugeSpeed = 0;
        if (currentGear === 'D') {
            var gaugeTop = driveMaxSpeed * GEAR_TOPS[gearIndex - 1];
            var gaugeBottom = gearIndex > 1 ? driveMaxSpeed * GEAR_TOPS[gearIndex - 2] : 0;
            gaugeSpeed = gaugeBottom + (engineRpm / 8000) * (gaugeTop - gaugeBottom);
        } else if (currentGear === 'R') {
            gaugeSpeed = raw;
        } else if (currentGear === 'N') {
            // Revving in neutral moves the needle only — the car stays put.
            gaugeSpeed = (engineRpm / 8000) * (driveMaxSpeed * 0.55);
        }
        var scale = unit === 'kmh' ? 3.6 : 2.23694;
        var shown = Math.round(gaugeSpeed * scale / SPEED_SCALE);
        var gear = currentGear === 'D' ? String(gearIndex) : gearLabel;
        var rpm = engineRpm;

        if (hudTimer > 0.075) {
            hudTimer = 0;
            if (speedHudTimer >= 0.2) {
                speedHudTimer = 0;
                var shownOut = shown;
                if (booting) {
                    var bootProg = 1 - (gaugeBoot / 0.95);
                    shownOut = Math.round(Math.sin(Math.min(1, bootProg) * Math.PI) * (unit === 'kmh' ? 160 : 100));
                }
                setText('g3dGaugeSpeed', shownOut);
                var mobileSpeed = document.getElementById('g3dMSpeed');
                if (mobileSpeed) mobileSpeed.textContent = String(shownOut);
                var mobileGear = document.getElementById('g3dMGear');
                if (mobileGear) mobileGear.textContent = gear;

                setText('g3dGaugeUnit', unit === 'kmh' ? 'km/h' : 'mph');
                updateInteriorScreens(shown, gear, engineRpm);
            }
            setText('g3dGaugeRpm', Math.round(rpm));
            setText('g3dGaugeGearBig', gear);
            setText('g3dGaugeGear', gear);
            var nitroShown = Math.round(nitro);
            var gearShown = gear;
            if (booting) {
                var bp = Math.max(0, Math.min(1, 1 - (gaugeBoot / 0.95)));
                nitroShown = Math.round(Math.min(100, (bp < 0.35 ? 0 : ((bp - 0.35) / 0.65) * 100)));
                gearShown = String(Math.max(1, Math.min(8, Math.ceil(bp * 8))));
            }
            setText('g3dGaugeNitro', nitroShown + '%');
            if (booting) {
                setText('g3dGaugeGearBig', gearShown);
            }
            setRunCoins(coinsCollected);
            var needle = (hudCache && hudCache.needle) || $('g3dNeedle');
            var booting = gaugeBoot > 0;
            if (needle) {
                var sweepNorm = clamp(rpm / 8000, 0, 1);
                if (booting) {
                    gaugeBoot = Math.max(0, gaugeBoot - dt);
                    var prog = 1 - (gaugeBoot / 0.95);
                    // drop to zero, sweep to the top, then settle back
                    sweepNorm = prog < 0.25
                        ? (1 - prog / 0.25) * sweepNorm
                        : Math.sin(Math.min(1, (prog - 0.25) / 0.75) * Math.PI);
                }
                var angle = -135 + sweepNorm * 270;
                needle.style.transform = 'translateX(-50%) rotate(' + angle.toFixed(2) + 'deg)';
            }
            var tachEl = (hudCache && hudCache.tach) || document.getElementById('g3dTach');
            if (tachEl) tachEl.classList.toggle('is-booting', booting);
            if (!hudCache) {
                hudCache = {
                    warn: {},
                    needle: document.getElementById('g3dNeedle'),
                    tach: document.getElementById('g3dTach')
                };
                ['abs','brake','eng','trans','tire','dmg'].forEach(function (name) {
                    hudCache.warn[name] = document.querySelector('.g3d-warn[data-warn="' + name + '"]');
                });
            }
            var tyreWarn = hudCache.warn.tire;
            if (tyreWarn) tyreWarn.classList.toggle('is-on', tyreHeat > 0.65);
            var brake = hudCache.warn.brake;
            if (brake) brake.classList.toggle('is-on', !!input.brake);
            var absLight = hudCache.warn.abs;
            if (absLight) absLight.classList.toggle('is-on', !!absActive);
        }
    }

    function suspendResources() {
        if (!active || suspended) return;
        suspended = true;
        try { if (engine) engine.stopRenderLoop(); } catch (e) {}
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        try { if (audioCtx && audioMaster) audioMaster.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05); } catch (e) {}
        paused = true;
    }

    function resumeResources() {
        if (!active || !suspended) return;
        suspended = false;
        paused = false;
        lastFrame = performance.now();
        accumulator = 0;
        fpsFrames = 0;
        fpsWindowStart = 0;
        fpsShown = -1;
        try { if (audioCtx && audioMaster) audioMaster.gain.setTargetAtTime(sound ? 1.0 : 0, audioCtx.currentTime, 0.08); } catch (e) {}
        try { if (engine) engine.runRenderLoop(frame); } catch (e) {}
    }

    function frame() {
        if (!active || suspended) return;
        var now = performance.now();
        // Live FPS counter sampling.
        fpsFrames++;
        if (!fpsWindowStart) fpsWindowStart = now;
        if (now - fpsWindowStart >= 500) {
            var measuredFps = Math.max(1, Math.round(fpsFrames * 1000 / (now - fpsWindowStart)));
            if (measuredFps !== fpsShown) {
                fpsShown = measuredFps;
                var fpsEl = document.getElementById('g3dFps');
                if (fpsEl) {
                    fpsEl.textContent = measuredFps + ' FPS';
                    fpsEl.classList.toggle('is-low', measuredFps < 24);
                }
            }
            fpsFrames = 0;
            fpsWindowStart = now;
        }
        var dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
        lastFrame = now;
        if (!paused && !garage) {
            stepPhysics(dt);
            updateTraffic(dt);
            updateTolls(dt);
            updateTunnels(dt);
            updateCoins(dt);
        } else if (!paused) {
            updateCoins(dt);
        }
        if (exhaustSmoke) {
            var revvingN = currentGear === 'N' && revLevel > 0.10 && !garage && !runOver;
            exhaustSmoke.emitRate = revvingN ? 60 + revLevel * 125 : 0;
        }
        if (driftSmoke) {
            driftSmoke.emitRate = (input.drift && displaySpeed > 9 && !garage && !runOver) ? 50 + Math.min(120, displaySpeed * 0.7) : 0;
        }
        updateDebris(dt);
        if (impactSparks) {
            impactSparkTimer = Math.max(0, impactSparkTimer - dt);
            if (impactSparkTimer <= 0) {
                impactSparks.emitRate = 0;
                if (impactSmoke) impactSmoke.emitRate = 0;
            }
        }
        wallImpactCool = Math.max(0, wallImpactCool - dt);
        var speedFrac = clamp(displaySpeed / Math.max(1, driveMaxSpeed), 0, 1);
        motionBlurStrength = 0.055 + speedFrac * 0.095 + (input.nitro && nitro > 0 ? 0.030 : 0);
        updateRemoteRacers(dt);
        syncCarVisual(dt);
        updateAudio();
        updateTraining();
        updateCamera(dt);
        updateAsLaneLines();
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
                else if (k === 'a' || k === 'arrowleft') { input.left = true; autoSteerDownAt.left = performance.now(); e.preventDefault(); }
                else if (k === 'd' || k === 'arrowright') { input.right = true; autoSteerDownAt.right = performance.now(); e.preventDefault(); }
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
                else if (k === 'c') { cameraMode = (cameraMode + 1) % 2; applyViewMode(); showToast(cameraMode ? 'THIRD PERSON' : 'FIRST PERSON'); e.preventDefault(); }
                else if (k === 'l') { headlightsOn = !headlightsOn; headlights.forEach(function (light) { light.setEnabled(headlightsOn); light.intensity = headlightsOn ? 4.5 : 0; }); e.preventDefault(); }
                else if (k === 'f') {
                    autoSteer = !autoSteer;
                    if (autoSteer && chassis) {
                        var pp = chassis.translation();
                        var offNow = pp.x - highwayCurveX(pp.z);
                        asGuideOffset = offNow;
                        autoOffset = offNow;
                        var bestLane = 0, bestDist = 1e9;
                        for (var li = 0; li < laneCenters.length; li++) {
                            var ld = Math.abs(laneCenters[li] - offNow);
                            if (ld < bestDist) { bestDist = ld; bestLane = li; }
                        }
                        autoLane = bestLane;
                        autoLaneTimer = 0.5;
                        autoHands = 0;
                        autoLastSteerAt = performance.now();
                        autoNudge = false;
                        autoOverride = 0;
                        autoRecover = 0;
                        autoSignalTimer = 0;
                        autoPendingLane = -1;
                        autoChanging = false;
                        autoChangeT = 1;
                    }
                    var chip = document.getElementById('g3dAutoSteer');
                    if (chip) chip.classList.toggle('is-on', autoSteer);
                    showToast(autoSteer ? 'AUTOSTEER ON · throttle and brakes are still yours' : 'AUTOSTEER OFF');
                    e.preventDefault();
                }
            },
            up: function (e) {
                var k = String(e.key || '').toLowerCase();
                if (k === 'w' || k === 'arrowup') input.throttle = false;
                else if (k === 's' || k === 'arrowdown') input.brake = false;
                else if (k === 'a' || k === 'arrowleft') {
                    input.left = false;
                    if (autoSteer && autoSteerDownAt.left && performance.now() - autoSteerDownAt.left < 450) autoTapRequest = 1;
                } else if (k === 'd' || k === 'arrowright') {
                    input.right = false;
                    if (autoSteer && autoSteerDownAt.right && performance.now() - autoSteerDownAt.right < 450) autoTapRequest = -1;
                }
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
        try { console.error('Babylon racer failed', error); } catch (e) {}
        window.__babylonRacerError = error && (error.stack || error.message || String(error));
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
        readyAnnounced = false;
        hudCache = null;
        paused = false;
        garage = false;
        unit = 'kmh';
        currentGear = 'D';
        gearLabel = '1';
        cameraMode = 0;
        headlightsOn = false;
        gearIndex = 1;
        manualGearTimer = 0;
        revLevel = 0;
        gearShiftTimer = 0;
        pendingGear = null;
        pendingGearIndex = null;
        engineRpm = 850;
        speedHudTimer = 0;
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
        vehicleModelLibrary = null;
        vehicleModelsLoading = false;
        worldMode = 'highway';
        cityRoot = null;
        cityBuildings = [];
        highwayMeshes = [];
        highwayExits = [];
        savedHighwayZ = START_Z + 500;
        portalCooldown = 0;
        absActive = false;
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
        driveGrip = clamp(3.85 * (num(perf.grip, 1) || 1), 2.8, 5.8);
        baseGrip = driveGrip;
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
        canvas.setAttribute('aria-label', 'Redline GT — Babylon.js + Rapier');
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
        training = false;
        clearTrainingCourse();
        trainingBanner(null);
        if (!scoreSubmitted && opts && typeof opts.onScore === 'function' && distance > 0) {
            scoreSubmitted = true;
            try { opts.onScore('Redline GT', runScore()); } catch (e) {}
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
        debris = [];
        interiorRoot = null;
        interiorLight = null;
        interiorSteeringWheel = null;
        interiorScreenTex = null;
        centerScreenTex = null;
        driftSmoke = null;
        driftEmitter = null;
        smokeTexture = null;
        realCarRoot = null;
        realCarLoading = false;
        vehicleModelLibrary = null;
        vehicleModelsLoading = false;
        worldMode = 'highway';
        cityRoot = null;
        cityBuildings = [];
        highwayMeshes = [];
        highwayExits = [];
        portalCooldown = 0;
        proceduralLampMeshes = [];
        impactSparks = null;
        impactSmoke = null;
        impactSparkTimer = 0;
        crashShake = 0;
        wallImpactCool = 0;
        motionBlurPost = null;
        vhsPost = null;
        asLaneLines = null;
        glowLayer = null;
        powerShakeLevel = 0;
        camPos = null;
        camTarget = null;
    }

    /* --------------------------------------------------------------------
       Training course — tight turns, cones and pedestrian awareness
       -------------------------------------------------------------------- */
    var TRAINING_STEPS = [
        { kind: 'dist', at: 0,   text: 'LESSON 1 · Accelerate smoothly — hold W / ↑ to 40 km/h.' },
        { kind: 'dist', at: 120, text: 'LESSON 2 · Brake (S / ↓) and slow below 30 km/h for the corner.' },
        { kind: 'dist', at: 260, text: 'LESSON 3 · Slalom — stay in the marked lane and snake the cones.' },
        { kind: 'dist', at: 430, text: 'LESSON 4 · Pedestrian crossing — stay under 35 km/h.' },
        { kind: 'dist', at: 600, text: 'LESSON 5 · Tight hairpin — brake early and hold your lane.' },
        { kind: 'park', at: 690, text: 'LESSON 6 · PARKING · Stop inside the green bay on the right.' },
        { kind: 'parallel', at: 800, text: 'LESSON 7 · PARALLEL PARKING · Pass the gap, reverse in, stop straight.' },
        { kind: 'finish', at: 900, text: 'FINISH · Cross the chequered line.' }
    ];

    function trainingBanner(text) {
        var el = document.getElementById('racerTrainingBanner');
        if (!el) return;
        if (text === null) { el.style.display = 'none'; el.textContent = ''; return; }
        el.style.display = 'block';
        el.textContent = text;
    }

    function makeCone(z, lane) {
        var x = highwayCurveX(z) + lane;
        var cone = BABYLON.MeshBuilder.CreateCylinder('trainCone', { height: 0.85, diameterTop: 0.08, diameterBottom: 0.46, tessellation: 10 }, scene);
        cone.position.set(x, 0.45, z);
        var mat = new BABYLON.StandardMaterial('trainConeMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0.48, 0.12);
        mat.emissiveColor = new BABYLON.Color3(0.32, 0.12, 0.02);
        cone.material = mat;
        cone.parent = trainingRoot;
        trainingProps.push(cone);
        if (world && rapier) {
            try {
                var b = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, 0.42, z));
                world.createCollider(rapier.ColliderDesc.cuboid(0.23, 0.42, 0.23), b);
            } catch (e) {}
        }
    }

    function makeBooth(x, z, w, d, color, emissive) {
        var pad = BABYLON.MeshBuilder.CreateBox('trainPad', { width: w, height: 0.04, depth: d }, scene);
        pad.position.set(x, 0.06, z);
        var mat = new BABYLON.StandardMaterial('trainPadMat', scene);
        mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
        mat.emissiveColor = new BABYLON.Color3(emissive[0], emissive[1], emissive[2]);
        mat.alpha = 0.75;
        pad.material = mat;
        pad.parent = trainingRoot;
        trainingProps.push(pad);
        return pad;
    }

    function makeLine(z, lane, w) {
        var line = BABYLON.MeshBuilder.CreateBox('trainLine', { width: w || 0.22, height: 0.02, depth: 6 }, scene);
        line.position.set(highwayCurveX(z) + lane, 0.09, z);
        var mat = new BABYLON.StandardMaterial('trainLineMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        line.material = mat;
        line.parent = trainingRoot;
        trainingProps.push(line);
    }

    function makePedestrian(z, lane, crossing) {
        var x = highwayCurveX(z) + lane;
        var root = new BABYLON.TransformNode('trainPed', scene);
        root.parent = trainingRoot;
        root.position.set(x, 0, z);
        var skin = new BABYLON.StandardMaterial('pedSkin', scene);
        skin.diffuseColor = new BABYLON.Color3(0.91, 0.74, 0.58);
        var shirt = new BABYLON.StandardMaterial('pedShirt', scene);
        shirt.diffuseColor = crossing ? new BABYLON.Color3(1, 0.84, 0.2) : new BABYLON.Color3(0.24, 0.55, 0.95);
        var trousers = new BABYLON.StandardMaterial('pedTrousers', scene);
        trousers.diffuseColor = new BABYLON.Color3(0.16, 0.18, 0.24);
        var torso = BABYLON.MeshBuilder.CreateCylinder('pedTorso', { height: 0.78, diameterTop: 0.36, diameterBottom: 0.44, tessellation: 10 }, scene);
        torso.position.y = 1.12; torso.material = shirt; torso.parent = root;
        var head = BABYLON.MeshBuilder.CreateSphere('pedHead', { diameter: 0.32, segments: 10 }, scene);
        head.position.y = 1.68; head.material = skin; head.parent = root;
        var eyeMat = new BABYLON.StandardMaterial('pedEye', scene);
        eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.14);
        var eyeL = BABYLON.MeshBuilder.CreateSphere('pedEyeL', { diameter: 0.045, segments: 6 }, scene);
        eyeL.position.set(-0.06, 1.71, 0.145); eyeL.material = eyeMat; eyeL.parent = root;
        var eyeR = eyeL.clone('pedEyeR'); eyeR.position.x = 0.06;
        var smile = BABYLON.MeshBuilder.CreateTorus('pedSmile', { diameter: 0.1, thickness: 0.012, tessellation: 10 }, scene);
        smile.position.set(0, 1.64, 0.15); smile.rotation.x = Math.PI / 2; smile.material = eyeMat; smile.parent = root;
        var legsL = BABYLON.MeshBuilder.CreateCylinder('pedLegL', { height: 0.72, diameter: 0.14, tessellation: 6 }, scene);
        legsL.position.set(-0.1, 0.37, 0); legsL.material = trousers; legsL.parent = root;
        var legsR = legsL.clone('pedLegR'); legsR.position.x = 0.1;
        var armsL = BABYLON.MeshBuilder.CreateCylinder('pedArmL', { height: 0.6, diameter: 0.1, tessellation: 6 }, scene);
        armsL.position.set(-0.28, 1.16, 0); armsL.material = shirt; armsL.parent = root;
        var armsR = armsL.clone('pedArmR'); armsR.position.x = 0.28;
        var prop = { root: root, x: x, z: z, hit: false };
        trainingProps.push(root);
        return prop;
    }

    function makeParkedCar(z, lane, color) {
        if (!scene) return;
        var car = makeTrafficCar('sedan', color || 0x8a94a6);
        car.root.position.set(highwayCurveX(z) + lane, 0, z);
        car.root.parent = trainingRoot;
        trainingProps.push(car.root);
        if (world && rapier) {
            try {
                var spec = TRAFFIC_SPECS.sedan;
                var b = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(car.root.position.x, 0.6, z));
                world.createCollider(rapier.ColliderDesc.cuboid(spec.w / 2, 0.55, spec.l / 2), b);
            } catch (e) {}
        }
    }

    var trainingPedestrians = [];
    var trainingBays = {};

    function buildTrainingCourse() {
        if (!scene) return;
        trainingRoot = new BABYLON.TransformNode('trainingRoot', scene);
        trainingProps = [];
        trainingPedestrians = [];
        var z0 = spawnZ;

        // Lane guides down the whole course (prebuilt track look)
        for (var g = 0; g < 24; g++) {
            makeLine(z0 + 40 + g * 38, -10.2);
            makeLine(z0 + 40 + g * 38, 10.2);
        }
        // Cone slalom (lessons 2-3)
        for (var i = 0; i < 8; i++) {
            makeCone(z0 + 270 + i * 22, (i % 2 ? 1 : -1) * 3.6);
        }
        // Pedestrian crossing (lesson 4)
        trainingPedestrians.push(makePedestrian(z0 + 470, -7.5, false));
        trainingPedestrians.push(makePedestrian(z0 + 486, -1.5, true));
        trainingPedestrians.push(makePedestrian(z0 + 500, 4.5, true));
        trainingPedestrians.push(makePedestrian(z0 + 512, 8.0, false));
        // Hairpin cones (lesson 5)
        for (var j = 0; j < 12; j++) {
            var ang = (j / 12) * Math.PI;
            makeCone(z0 + 640 + Math.sin(ang) * 22, Math.cos(ang) * 9.5);
        }

        // PARKING BAY (lesson 6) — perpendicular bay on the right shoulder
        var bayZ = z0 + 720, bayX = highwayCurveX(bayZ) + 7.6;
        trainingBays.perpendicular = { x: bayX, z: bayZ, w: 3.4, l: 6.4, heading: 0 };
        makeBooth(bayX, bayZ, 3.4, 6.4, [0.2, 0.85, 0.35], [0.05, 0.28, 0.1]);
        makeParkedCar(z0 + 706, 7.6, 0x8a94a6);
        makeParkedCar(z0 + 734, 7.6, 0xb2563c);

        // PARALLEL PARKING (lesson 7) — kerbside gap between two cars
        var parZ = z0 + 845, parX = highwayCurveX(parZ) + 8.4;
        trainingBays.parallel = { x: parX, z: parZ, w: 2.9, l: 7.4, heading: 0 };
        makeBooth(parX, parZ, 2.9, 7.4, [0.2, 0.7, 0.95], [0.05, 0.2, 0.34]);
        makeParkedCar(z0 + 830, 8.4, 0xcfd4e6);
        makeParkedCar(z0 + 860, 8.4, 0x3f5f8f);

        // Chequered finish gate
        var gate = BABYLON.MeshBuilder.CreateBox('trainFinish', { width: 14, height: 0.1, depth: 1.6 }, scene);
        gate.position.set(highwayCurveX(z0 + 900), 0.06, z0 + 900);
        var gateMat = new BABYLON.StandardMaterial('trainFinishMat', scene);
        gateMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        gateMat.emissiveColor = new BABYLON.Color3(0.42, 0.42, 0.42);
        gate.material = gateMat;
        gate.parent = trainingRoot;
        trainingProps.push(gate);
    }

    function clearTrainingCourse() {
        trainingProps.forEach(function (p) { try { p.dispose(); } catch (e) {} });
        trainingProps = [];
        if (trainingRoot) { try { trainingRoot.dispose(); } catch (e) {} trainingRoot = null; }
        trainingPedestrians = [];
        trainingBays = {};
    }

    function startTraining() {
        if (!active || !ready) return false;
        training = true;
        trainingStep = 0;
        trainingCooldown = 0;
        trainingHold = 0;
        garage = false;
        paused = false;
        resetCar(false, true);
        resetRunWorld();
        clearTrainingCourse();
        buildTrainingCourse();
        trainingBanner(TRAINING_STEPS[0].text);
        showToast('Training course started');
        return true;
    }

    function stopTraining() {
        training = false;
        trainingStep = 0;
        clearTrainingCourse();
        trainingBanner(null);
    }

    function getTrainingState() {
        return { active: training, step: trainingStep, total: TRAINING_STEPS.length };
    }

    function carInBay(bay) {
        if (!bay || !chassis) return false;
        var p = chassis.translation();
        var dx = p.x - bay.x, dz = p.z - bay.z;
        var inside = Math.abs(dx) < bay.w * 0.5 && Math.abs(dz) < bay.l * 0.5;
        if (!inside) return false;
        var speed = displaySpeed;
        return speed < 2.2;
    }

    function updateTraining() {
        if (!training || !ready || !scene) return;
        var step = TRAINING_STEPS[trainingStep];
        if (!step) return;
        var progress = distance;
        var advanced = false;

        if (step.kind === 'dist' && progress >= step.at) advanced = true;
        if ((step.kind === 'park' || step.kind === 'parallel') && trainingBays[step.kind === 'park' ? 'perpendicular' : 'parallel']) {
            var bay = trainingBays[step.kind === 'park' ? 'perpendicular' : 'parallel'];
            if (carInBay(bay)) {
                trainingHold = (trainingHold || 0) + 0.016;
                if (trainingHold > 0.9) { advanced = true; trainingHold = 0; }
            } else {
                trainingHold = 0;
            }
        }
        if (step.kind === 'finish' && progress >= step.at) advanced = true;

        if (advanced) {
            var next = Math.min(TRAINING_STEPS.length - 1, trainingStep + 1);
            if (trainingStep < TRAINING_STEPS.length - 1) {
                trainingStep = next;
                var nextStep = TRAINING_STEPS[trainingStep];
                trainingBanner(nextStep.text);
                if (nextStep.kind === 'park') showToast('Parking bay ahead on the right');
                if (nextStep.kind === 'parallel') showToast('Find the gap between the parked cars');
                if (nextStep.kind === 'finish') showToast('One last stretch — cross the line');
            } else {
                showToast('Training complete! Great driving.');
                trainingBanner('TRAINING COMPLETE · free drive unlocked');
                training = false;
                clearTrainingCourse();
                setTimeout(function () { trainingBanner(null); }, 3200);
            }
        }

        // pedestrian awareness — count hits, never fail hard
        if (trainingPedestrians && chassis) {
            var p2 = chassis.translation();
            trainingCooldown = Math.max(0, trainingCooldown - 0.016);
            for (var k = 0; k < trainingPedestrians.length; k++) {
                var ped = trainingPedestrians[k];
                var dx2 = p2.x - ped.x, dz2 = p2.z - ped.z;
                if (!ped.hit && (dx2 * dx2 + dz2 * dz2) < 3.0 && trainingCooldown <= 0) {
                    ped.hit = true;
                    trainingCooldown = 2.2;
                    showToast('Careful! Pedestrians have right of way — slow down');
                }
            }
        }
    }

    function captureGaragePhoto() {
        if (!active || !ready || !engine || !camera || !scene) return Promise.resolve(null);
        return new Promise(function (resolve) {
            try {
                scene.render();
                BABYLON.Tools.CreateScreenshotUsingRenderTarget(engine, camera, { width: 640, height: 360 }, function (data) {
                    resolve(data || null);
                }, 'image/jpeg', 0.9, true);
            } catch (e) {
                resolve(null);
            }
        });
    }

    function restart() {
        if (!active) return false;
        paused = false;
        garage = false;
        gaugeBoot = 0.95;
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
        applyViewMode();
    }

    function setGearMode(mode) {
        mode = String(mode || '').toUpperCase();
        if (mode !== 'P' && mode !== 'R' && mode !== 'N' && mode !== 'D') mode = 'D';
        if (mode === currentGear && gearShiftTimer <= 0) return;
        pendingGear = mode;
        pendingGearIndex = null;
        gearShiftTimer = 0.55;
        playGearSound();
    }

    function shiftGear(direction) {
        if (!ready || garage || runOver) return;
        var order = ['P', 'R', 'N', 'D'];
        var base = pendingGear !== null ? pendingGear : currentGear;
        var idx = order.indexOf(base);
        idx = clamp(idx + (direction > 0 ? 1 : -1), 0, order.length - 1);
        if (order[idx] !== pendingGear) setGearMode(order[idx]);
    }

    function setGear(mode) { setGearMode(mode); }
    function setThrottle(on) { input.throttle = !!on; if (on && currentGear === 'P') setGearMode('D'); }
    function setBrake(on) { input.brake = !!on; }
    function setDrift(on) { input.drift = !!on; }
    function setNitro(on) { input.nitro = !!on; }
    function setUnitSystem(value) { unit = 'kmh'; }
    function setSoundEnabled(on) {
        sound = !!on;
        if (audioMaster && audioCtx) {
            try { audioMaster.gain.setTargetAtTime(sound ? 1.0 : 0, audioCtx.currentTime, 0.08); } catch (e) {}
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
        chassis.setTranslation({ x: highwayCurveX(spawnZ + d) + tx, y: 0.92, z: spawnZ + d }, true);
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
            rpm: Math.round(engineRpm),
            world: worldMode,
            camera: cameraMode,
            headlights: !!headlightsOn,
            abs: !!absActive,
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
        curveX: highwayCurveX,
        autoDebug: function () {
            if (!chassis) return null;
            var p = chassis.translation();
            var offset = p.x - highwayCurveX(p.z);
            return { x: p.x, z: p.z, offset: offset, lane: autoLane, laneCenter: laneCenters[autoLane], steer: steerVisual, auto: autoSteer, nudge: autoNudge, override: autoOverride, sinceSteer: Math.round((performance.now() - autoLastSteerAt) / 100) / 10, signal: autoSignalTimer, changing: autoChanging, pending: autoPendingLane };
        },
        getWeather: function () { return { rain: rainIntensity }; },
        getTyreHeat: function () { return tyreHeat; },
        suspendResources: suspendResources,
        resumeResources: resumeResources,
        captureGaragePhoto: captureGaragePhoto,
        startTraining: startTraining,
        stopTraining: stopTraining,
        getTrainingState: getTrainingState,
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
