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
    var SPEED_SCALE = 6;

    var engine = null, scene = null, camera = null, canvas = null, container = null;
    var carRoot = null, carVisuals = [], wheelPivots = [], wheelSpins = [], contactShadow = null;
    var sun = null, shadow = null, sky = null;
    var resizeObs = null, active = false, failed = false;
    var rapier = null, world = null, chassis = null, vehicle = null;
    var rapierPromise = null, ready = false, starting = false;
    var raf = 0, lastFrame = 0, accumulator = 0, hudTimer = 0;
    var paused = false, garage = false, cameraMode = 0;
    var distance = 0, displaySpeed = 0, unit = 'mph', sound = true;
    var nitro = 100, driftScore = 0, steerVisual = 0;
    var currentGear = 'D', gearLabel = 'D';
    var camPos = null, camTarget = null;
    var resetClock = 0, flipTime = 0, toastTimer = 0;
    var opts = {};
    var spawnZ = START_Z;
    var keyHandlers = null;

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
        var paint = new BABYLON.PBRMaterial('racerPaint', scene);
        paint.albedoColor = new BABYLON.Color3(0.79, 0.16, 0.055);
        paint.metallic = 0.72;
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
        rimMat.albedoColor = new BABYLON.Color3(0.60, 0.63, 0.67);
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
            .setAngularDamping(0.55)
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
        syncCarVisual(0);
        setText('g3dGaugeStatus', 'BABYLON + RAPIER · HDR READY');
    }

    function applyControls(dt) {
        var speed = chassis.linvel();
        var forwardSpeed = Math.sqrt(speed.x * speed.x + speed.z * speed.z);
        var engineForce = 0;
        var brakeForce = 0;
        var maxSpeed = input.nitro && nitro > 0 ? 88 : 67;

        if (garage) {
            input.throttle = false;
            input.brake = true;
            vehicle.setWheelSteering(0, 0);
            vehicle.setWheelSteering(1, 0);
            for (var g = 0; g < 4; g++) {
                vehicle.setWheelEngineForce(g, 0);
                vehicle.setWheelBrake(g, 22);
            }
            return;
        }

        if (currentGear === 'P') {
            brakeForce = 34;
        } else if (currentGear === 'R') {
            if (input.throttle) engineForce = -1450;
            if (input.brake) brakeForce = 26;
        } else if (currentGear === 'N') {
            brakeForce = input.brake ? 20 : 1.2;
        } else {
            if (input.throttle && forwardSpeed < maxSpeed) {
                var falloff = 1 - (forwardSpeed / maxSpeed) * 0.88;
                engineForce = 4800 * falloff;
                if (input.nitro && nitro > 0) engineForce += 3200;
                nitro = Math.max(0, nitro - dt * 26);
            } else {
                nitro = Math.min(100, nitro + dt * 7.5);
            }
            if (input.brake) brakeForce = 33;
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

        // Rear-drive, front steering. Nitrous also feeds the front axle.
        vehicle.setWheelEngineForce(0, input.nitro && nitro > 0 ? engineForce * 0.16 : 0);
        vehicle.setWheelEngineForce(1, input.nitro && nitro > 0 ? engineForce * 0.16 : 0);
        vehicle.setWheelEngineForce(2, engineForce * 0.5);
        vehicle.setWheelEngineForce(3, engineForce * 0.5);

        for (var i = 0; i < 4; i++) {
            vehicle.setWheelBrake(i, brakeForce);
            var rear = i >= 2;
            vehicle.setWheelFrictionSlip(i, input.drift && rear ? 1.35 : 3.25);
        }

        // Light aerodynamic drag; keeps the car from coasting forever.
        var v = chassis.linvel();
        var drag = 0.020 * forwardSpeed;
        chassis.applyImpulse({ x: -v.x * drag * dt, y: 0, z: -v.z * drag * dt }, true);

        if (input.drift && forwardSpeed > 8) driftScore += forwardSpeed * dt * 0.38;
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

        if (t.z > ROAD_LENGTH - 220) {
            chassis.setTranslation({ x: 0, y: 0.92, z: spawnZ + 20 }, true);
            chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
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
        }
        accumulator = 0;
        flipTime = 0;
        nitro = 100;
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
        var q = chassis ? chassis.rotation() : { x: 0, y: 0, z: 0, w: 1 };
        var rot = new BABYLON.Quaternion(q.x, q.y, q.z, q.w);
        var rotMatrix = rot.toRotationMatrix(new BABYLON.Matrix());
        var carPos = carRoot ? carRoot.position : new BABYLON.Vector3(0, 0.9, spawnZ);
        var forward = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, 1), rotMatrix);
        var right = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(1, 0, 0), rotMatrix);
        var speedFactor = clamp(displaySpeed / 75, 0, 1);
        var back = 8.6 + speedFactor * 1.6;
        var height = 3.35 + speedFactor * 0.35;
        var shake = speedFactor * 0.035;
        var target = carPos.add(forward.scale(5.2)).add(new BABYLON.Vector3(0, 0.95, 0));
        var desired = carPos.subtract(forward.scale(back)).add(new BABYLON.Vector3(0, height, 0));
        desired = desired.add(right.scale(Math.sin(performance.now() * 0.031) * shake));
        desired.y += Math.sin(performance.now() * 0.047) * shake;

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
        carRoot.rotationQuaternion = new BABYLON.Quaternion(q.x, q.y, q.z, q.w);

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
        var gear = gearLabel;
        if (currentGear === 'D' && raw < 0.4 && !input.throttle) gear = 'N';
        var rpm = 900 + Math.min(1, (raw % 42) / 42) * 6400 + (input.nitro && nitro > 0 ? 900 : 0);
        if (raw < 0.2) rpm = input.throttle ? 1600 : 850;

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
            setText('g3dGaugeSplitLabel', 'PHASE');
            setText('g3dGaugeSplit', '1');
            setText('g3dGaugeDamage', '0%');
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
                else if (paused) setText('g3dGaugeStatus', 'PAUSED');
                else if (input.nitro && nitro > 0) setText('g3dGaugeStatus', 'NITROUS ACTIVE');
                else if (displaySpeed < 0.4) setText('g3dGaugeStatus', 'HOLD W TO START');
                else setText('g3dGaugeStatus', 'BABYLON.JS + RAPIER · HDR');
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
        if (!paused && !garage) stepPhysics(dt);
        syncCarVisual(dt);
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
                else if (k === ' ') { input.brake = true; e.preventDefault(); }
                else if (k === 'shift') { input.nitro = true; e.preventDefault(); }
                else if (k === 'x') { input.drift = true; e.preventDefault(); }
                else if (k === 'r') { resetCar(true); e.preventDefault(); }
                else if (k === 'c') { cameraMode = (cameraMode + 1) % 2; showToast(cameraMode ? 'CAMERA · FAR' : 'CAMERA · CHASE'); }
                else if (k >= '1' && k <= '4') {
                    setGearMode(['P', 'R', 'N', 'D'][Number(k) - 1]);
                    e.preventDefault();
                }
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
        gearLabel = 'D';
        distance = 0;
        displaySpeed = 0;
        nitro = 100;
        driftScore = 0;
        steerVisual = 0;
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
        if (opts && typeof opts.onScore === 'function' && distance > 0) {
            try { opts.onScore('Beach Racer', Math.floor(distance * 2)); } catch (e) {}
        }
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
        carVisuals = [];
        wheelPivots = [];
        wheelSpins = [];
        camera = null;
        sun = null;
        shadow = null;
        sky = null;
        camPos = null;
        camTarget = null;
    }

    function restart() {
        if (!active) return false;
        paused = false;
        garage = false;
        resetCar(false);
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
        gearLabel = mode;
        showToast('GEAR ' + mode);
    }

    function shiftGear(direction) {
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
    function setSoundEnabled(on) { sound = !!on; }
    function setShadows() {}
    function setMotionBlur() {}
    function setCrashSlowmo() {}
    function setGraphicsPreset() {}
    function setRenderScale() {}
    function setShowFps() {}
    function toggleFsd() { showToast('FSD · PHASE 4'); }
    function setLocalRacerName() {}
    function setRemoteRacers() {}
    function setTerrain() {}
    function setElevation() {}
    function toggleShadowHelper() {}
    function teleportRacer() {}
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
            kmh: Math.round(speed * 3.6 / SPEED_SCALE)
        };
    }
    function getCurrentScore() { return Math.floor(distance * 2); }
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
