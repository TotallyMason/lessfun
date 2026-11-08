/* ============================================================
   Boeing Landing — 2D side-view landing simulator
   ============================================================ */
(function () {
    'use strict';

    var G = 9.81;
    var MASS = 64000;
    var WING_AREA = 124;
    var RHO = 1.225;
    var MAX_THRUST = 214000;
    var PITCH_INERTIA = 6.5e6;
    var GS_ANGLE = 3 * Math.PI / 180;
    var PARTS = { tire: 0.2, oleo: 0.95, arm: 0.35 };

    var GEAR_MAIN = { offset: -9.5, attachY: -1.2, strut: 3.6, wheel: 0.55, max: 1.35 };
    var GEAR_NOSE = { offset: 12, attachY: -0.9, strut: 3.65, wheel: 0.5, max: 1.05 };
    var MAIN_BOTTOM = GEAR_MAIN.attachY - GEAR_MAIN.strut - GEAR_MAIN.wheel;
    var NOSE_BOTTOM = GEAR_NOSE.attachY - GEAR_NOSE.strut - GEAR_NOSE.wheel;

    var canvas = null, ctx = null, stage = null, resizeObs = null;
    var raf = 0, running = false, lastFrame = 0;
    var W = 900, H = 520, DPR = 1;
    var audioCtx = null;
    var overlayShown = false;
    var particles = [];
    var smokeTimer = 0;
    var toastTimer = 0;
    var hudTimer = 0;

    var sim = {};

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(current, target, rate, dt) { return current + (target - current) * Math.min(1, rate * dt); }
    function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

    function reset() {
        sim = {
            t: 0,
            x: -420,
            y: 28,
            vx: 73,
            vy: -2.2,
            pitch: 0.08,
            pitchRate: 0,
            throttle: 0.24,
            throttleTarget: 0.24,
            flaps: 30,
            flapsTarget: 30,
            gear: 1,
            gearTarget: 1,
            gearAnim: 1,
            brakes: false,
            spoilers: 0,
            onGround: false,
            takeoffArmed: true,
            airGrace: 0,
            groundTimer: 0,
            lastResult: null,
            lastTouchFpm: 0,
            finished: false,
            crashed: false,
            touchX: 0,
            touchVy: 0,
            touchPitch: 0,
            touchSpeed: 0,
            stopX: 0,
            compMain: 0.39,
            compNose: 0,
            tireComp: 0.06,
            oleoComp: 0.3,
            armComp: 0.03,
            strokeMain: 0.32,
            strokeVel: 0,
            noseTire: 0,
            noseOleo: 0,
            noseArm: 0,
            brakeHeat: 0,
            compVel: 0,
            pitchVel: 0,
            wheelAngle: 0,
            score: 0,
            coins: 0,
            rating: '',
            reason: '',
            camX: -420,
            camY: 0,
            camScale: 1.2,
            shake: 0,
            showGuide: true,
            keys: { up: false, down: false, slow: false, fast: false, brake: false }
        };
        particles = [];
        overlayShown = false;
        var ov = document.getElementById('lsimOverlay');
        if (ov) ov.style.display = 'none';
        var st = document.getElementById('lsimState');
        if (st) st.textContent = 'FINAL APPROACH';
        var sc = document.getElementById('lsimScore');
        if (sc) sc.textContent = '0';
        hudTimer = 0;
        updateHud(true);
    }

    function btnState(name, on) {
        if (!sim.keys) return;
        sim.keys[name] = !!on;
    }

    function cycleFlaps() {
        if (!running || sim.finished) return;
        var steps = [0, 15, 30, 40];
        var next = 0;
        for (var i = 0; i < steps.length; i++) if (steps[i] > sim.flapsTarget) { next = steps[i]; break; }
        sim.flapsTarget = next;
        toast('FLAPS ' + next + '°');
        beep(520, 0.05, 'square', 0.03);
    }

    function toggleGear() {
        if (!running || sim.finished) return;
        sim.gearTarget = sim.gearTarget ? 0 : 1;
        toast(sim.gearTarget ? 'GEAR DOWN' : 'GEAR UP');
        beep(sim.gearTarget ? 390 : 300, 0.12, 'sawtooth', 0.04);
    }

    function toggleGuide() {
        sim.showGuide = !sim.showGuide;
        toast(sim.showGuide ? 'GLIDESLOPE GUIDE ON' : 'GLIDESLOPE GUIDE OFF');
    }

    function toast(message) {
        var el = document.getElementById('lsimToast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('is-visible');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 1800);
    }

    function beep(freq, duration, type, volume, endFreq) {
        if (!soundSetting) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            var now = audioCtx.currentTime;
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, now);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume || 0.04), now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.02);
        } catch (e) {}
    }

    function spawnDust(x, strength) {
        var n = Math.round(clamp(strength * 6, 3, 18));
        for (var i = 0; i < n; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 5,
                y: 0.1,
                vx: (Math.random() - 0.5) * 10 - sim.vx * 0.12,
                vy: Math.random() * 2.2 + 0.4,
                life: 0,
                max: 0.5 + Math.random() * 0.7,
                size: 0.3 + Math.random() * 0.7,
                color: 'rgba(205, 200, 180, '
            });
        }
    }

    function spawnSmoke(x, y) {
        particles.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y + Math.random() * 3,
            vx: (Math.random() - 0.5) * 3,
            vy: 1.5 + Math.random() * 2,
            life: 0,
            max: 2 + Math.random() * 2,
            size: 1 + Math.random() * 1.8,
            color: 'rgba(60, 60, 60, '
        });
    }

    function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.life += dt;
            if (p.life >= p.max) { particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 1.2 * dt;
            if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.15; }
        }
    }

    function stepAir(dt) {
        // With no runway load, the gear extends again for the next landing.
        sim.tireComp = Math.max(0, sim.tireComp - dt * 0.9);
        sim.oleoComp = Math.max(0, sim.oleoComp - dt * 1.3);
        sim.armComp = Math.max(0, sim.armComp - dt * 0.8);
        sim.compMain = Math.min(GEAR_MAIN.max, sim.tireComp + sim.oleoComp + sim.armComp);
        sim.noseTire = Math.max(0, sim.noseTire - dt * 0.9);
        sim.noseOleo = Math.max(0, sim.noseOleo - dt * 1.3);
        sim.noseArm = Math.max(0, sim.noseArm - dt * 0.8);
        sim.compNose = Math.min(GEAR_NOSE.max, sim.noseTire + sim.noseOleo + sim.noseArm);

        var pitchInput = (sim.keys.up ? 1 : 0) - (sim.keys.down ? 1 : 0);
        var v0 = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
        var gamma0 = Math.atan2(sim.vy, Math.max(0.01, sim.vx));
        if (pitchInput) {
            var pitchCmd = pitchInput * 0.26;
            sim.pitchRate += (pitchCmd - sim.pitchRate) * Math.min(1, dt * 4);
            sim.pitch += sim.pitchRate * dt;
        } else {
            // Relaxed static stability: hands-off, hold a trimmed angle of
            // attack relative to the current flight path.
            var trim = gamma0 + 0.07;
            sim.pitch += (trim - sim.pitch) * Math.min(1, dt * 1.1);
            sim.pitchRate *= (1 - Math.min(1, dt * 4));
        }
        sim.pitch = clamp(sim.pitch, -0.16, 0.28);

        var thrInput = (sim.keys.fast ? 1 : 0) - (sim.keys.slow ? 1 : 0);
        if (thrInput) sim.throttleTarget = clamp(sim.throttleTarget + thrInput * 0.55 * dt, 0, 1);
        sim.throttle = smooth(sim.throttle, sim.throttleTarget, 2.2, dt);
        sim.flaps = smooth(sim.flaps, sim.flapsTarget, 1.6, dt);
        sim.gearAnim = smooth(sim.gearAnim, sim.gearTarget, 1.4, dt);

        var v = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
        var gamma = Math.atan2(sim.vy, Math.max(0.01, sim.vx));
        var aoa = sim.pitch - gamma;
        var flapLift = (sim.flaps / 40) * 0.86;
        var cl = 0.32 + 3.8 * clamp(aoa, -0.13, 0.2) + flapLift;
        cl = clamp(cl, 0.16, 2.35);
        var groundEffect = 1;
        var q = 0.5 * RHO * v * v;
        var lift = q * WING_AREA * cl * groundEffect;
        if (sim.y < 10) lift *= 1 + 0.03 * (1 - Math.max(0, sim.y) / 10);
        var cd = 0.028 + (sim.gearAnim > 0.2 ? 0.016 : 0) + (sim.flaps / 40) * 0.024 + 0.048 * cl * cl;
        if (sim.spoilers > 0) cd += sim.spoilers * 0.04;
        var drag = q * WING_AREA * cd;
        var thrust = sim.throttle * MAX_THRUST;

        var ax = (thrust * Math.cos(sim.pitch) - drag * Math.cos(gamma) - lift * Math.sin(gamma)) / MASS;
        var ay = (thrust * Math.sin(sim.pitch) - drag * Math.sin(gamma) + lift * Math.cos(gamma) - MASS * G) / MASS;
        // Light phugoid damping keeps the approach stable without a full FBW model.
        ay -= sim.vy * 0.38;

        sim.vx = Math.max(0, sim.vx + ax * dt);
        sim.vy += ay * dt;
        sim.x += sim.vx * dt;
        sim.y += sim.vy * dt;

        var mainBottom = sim.y + GEAR_MAIN.offset * Math.sin(sim.pitch) + (MAIN_BOTTOM + sim.compMain) * Math.cos(sim.pitch);
        var noseBottom = sim.y + GEAR_NOSE.offset * Math.sin(sim.pitch) + (NOSE_BOTTOM + sim.compNose) * Math.cos(sim.pitch);

        if (sim.airGrace > 0) {
            sim.airGrace = Math.max(0, sim.airGrace - dt);
        } else if (mainBottom <= 0 || noseBottom <= 0) {
            touchdown();
            return;
        }
        if (sim.y < -1) {
            sim.y = 2;
            touchdown();
        }
    }

    function touchdown() {
        sim.touchVy = sim.vy;
        sim.touchPitch = sim.pitch;
        sim.touchSpeed = sim.vx;
        sim.touchX = sim.x;
        sim.onGround = true;
        sim.vy = 0;
        sim.airGrace = 0;
        sim.groundTimer = 0;
        var impact = Math.max(0, -sim.touchVy);
        sim.strokeMain = clamp(0.06 + impact * 0.02, 0.06, 0.22);
        sim.strokeVel = impact * 0.8;
        sim.tireComp = clamp(0.03 + impact * 0.008, 0.03, 0.12);
        sim.oleoComp = sim.strokeMain * 0.84;
        sim.armComp = sim.strokeMain * 0.16;
        sim.compMain = Math.min(GEAR_MAIN.max, sim.strokeMain + sim.tireComp);
        sim.brakeHeat = 0;
        sim.compVel = 0;
        sim.pitchVel = 0;
        sim.y = -GEAR_MAIN.offset * Math.sin(sim.pitch) - (MAIN_BOTTOM + sim.compMain) * Math.cos(sim.pitch);
        sim.brakes = false;
        sim.spoilers = 1;
        sim.takeoffArmed = false;
        // Suspension is the point of this sim: keep the gear down and absorb
        // every touchdown, no matter how hard or where it happens.
        sim.gearTarget = 1;
        sim.gearAnim = 1;
        spawnDust(sim.x - 9, 1);
        spawnDust(sim.x + 12, 0.6);
        if (sim.x < 0) spawnDust(sim.x, 1.2);
        sim.shake = Math.min(1.1, 0.4 + Math.max(0, -sim.touchVy) * 0.08);
        var fpm = Math.round(-sim.touchVy * 196.85);
        sim.lastTouchFpm = fpm;
        toast('TOUCHDOWN · ' + fpm + ' fpm');
        var st = document.getElementById('lsimState');
        if (st) st.textContent = 'TOUCHDOWN';
        beep(95, 0.32, 'sine', 0.12, 45);
        setTimeout(function () { beep(70, 0.14, 'triangle', 0.05); }, 120);
        scoreLanding();
    }

    function oleoGas(stroke, staticLoad, staticStroke, gasLength, n) {
        var column = Math.max(0.05, gasLength - (stroke - staticStroke));
        return staticLoad * Math.pow(gasLength / column, n);
    }

    function oleoDamper(vel, compressionC, reboundC) {
        var c = vel >= 0 ? compressionC : reboundC;
        return c * vel * Math.abs(vel);
    }

    function stepGround(dt) {
        var restPitch = -0.006;
        var pitchInput = (sim.keys.up ? 1 : 0) - (sim.keys.down ? 1 : 0);
        var targetPitch = restPitch;
        if (pitchInput && sim.vx > 8) targetPitch = restPitch + pitchInput * 0.2;
        var thrInput = (sim.keys.fast ? 1 : 0) - (sim.keys.slow ? 1 : 0);
        if (thrInput) sim.throttleTarget = clamp(sim.throttleTarget + thrInput * 0.55 * dt, 0, 1);
        sim.throttle = smooth(sim.throttle, sim.throttleTarget, 2.2, dt);

        // Gentle auto-rotation once the aircraft is at takeoff speed and the
        // throttles are open, so a takeoff only needs power.
        if (!pitchInput && sim.takeoffArmed && sim.throttle > 0.7 && sim.vx > 55) {
            targetPitch = restPitch + 0.09;
        }
        sim.pitchVel += ((targetPitch - sim.pitch) * 18 - sim.pitchVel * 7) * dt;
        sim.pitch += sim.pitchVel * dt;
        sim.pitch = clamp(sim.pitch, -0.12, 0.2);

        // Aerodynamics while rolling: lift unloads the gear as speed rises.
        var v = Math.max(0.5, sim.vx);
        var flapLift = (sim.flaps / 40) * 0.86;
        var cl = 0.32 + 3.8 * clamp(sim.pitch, -0.13, 0.2) + flapLift;
        var q = 0.5 * RHO * v * v;
        var lift = q * WING_AREA * cl * (1 - 0.78 * clamp(sim.spoilers, 0, 1));
        var cd = 0.028 + sim.gearAnim * 0.016 + (sim.flaps / 40) * 0.024 + 0.048 * cl * cl + sim.spoilers * 0.04;
        var drag = q * WING_AREA * cd;
        var thrust = sim.throttle * MAX_THRUST;
        var weight = MASS * G;
        var netLoad = Math.max(0, weight - lift);

        // Oleo-pneumatic main gear: polytropic nitrogen spring plus
        // velocity-squared hydraulic damping through the metering orifice.
        var staticMain = weight * 0.445;
        var loadMain = netLoad * 0.445;
        var fgMain = oleoGas(sim.strokeMain, staticMain, 0.5, 0.8, 1.35);
        var fdMain = oleoDamper(sim.strokeVel, 95000, 170000);
        var mainAcc = (loadMain - fgMain - fdMain) / (MASS * 0.45);
        sim.strokeVel += mainAcc * dt;
        sim.strokeMain += sim.strokeVel * dt;
        if (sim.strokeMain < 0) { sim.strokeMain = 0; sim.strokeVel = Math.max(0, sim.strokeVel); }
        if (sim.strokeMain > 1.1) { sim.strokeMain = 1.1; sim.strokeVel = Math.min(0, sim.strokeVel); }
        sim.tireComp = clamp((fgMain + Math.abs(fdMain)) / (staticMain * 1.55) * 0.14, 0.03, 0.24);
        sim.oleoComp = sim.strokeMain * 0.84;
        sim.armComp = sim.strokeMain * 0.16;
        sim.compMain = Math.min(GEAR_MAIN.max, sim.strokeMain + sim.tireComp);

        sim.y = -GEAR_MAIN.offset * Math.sin(sim.pitch) - (MAIN_BOTTOM + sim.compMain) * Math.cos(sim.pitch);
        var noseRaw = -NOSE_BOTTOM - (sim.y + GEAR_NOSE.offset * Math.sin(sim.pitch)) / Math.max(0.9, Math.cos(sim.pitch));
        var noseGeo = clamp(noseRaw, 0, GEAR_NOSE.max);
        if (noseGeo > sim.compNose) sim.compNose = Math.min(noseGeo, sim.compNose + dt * 0.62);
        else sim.compNose = Math.max(noseGeo, sim.compNose - dt * 0.35);
        sim.noseTire = sim.compNose * 0.14;
        sim.noseOleo = sim.compNose * 0.66;
        sim.noseArm = sim.compNose * 0.2;

        if (sim.keys.brake && sim.vx > 1) sim.brakeHeat = Math.min(1, sim.brakeHeat + dt * 0.55);
        else sim.brakeHeat = Math.max(0, sim.brakeHeat - dt * 0.16);

        sim.gearAnim = smooth(sim.gearAnim, 1, 1.4, dt);
        sim.flaps = smooth(sim.flaps, sim.flapsTarget, 1.6, dt);
        sim.wheelAngle += (sim.vx / GEAR_MAIN.wheel) * dt;

        var wheelBrake = sim.keys.brake ? 3.1 : (sim.throttle < 0.06 ? 0.5 : 0.08);
        var rolling = 0.02 + (sim.vx > 1 ? 0.015 : 0);
        var accel = (thrust - drag) / MASS - wheelBrake - rolling - sim.spoilers * 0.25;
        sim.vx = Math.max(0, sim.vx + accel * dt);
        sim.x += sim.vx * dt;

        if (sim.throttle > 0.4) sim.spoilers = Math.max(0, sim.spoilers - dt * 1.6);
        sim.groundTimer += dt;
        if (sim.vx < 22 || sim.groundTimer > 3.5) sim.takeoffArmed = true;

        // Rotate and fly again once the aircraft has slowed after landing.
        if (sim.takeoffArmed && sim.vx > 50 && lift > MASS * G * 0.995 && sim.pitch > 0.02) {
            liftoff();
        }
        if (sim.brakes !== !!sim.keys.brake) sim.brakes = !!sim.keys.brake;
    }

    function liftoff() {
        sim.onGround = false;
        sim.vy = 1.7;
        sim.y += 1.1;
        sim.airGrace = 1.1;
        sim.pitchRate = 0.05;
        sim.spoilers = 0;
        sim.brakes = false;
        sim.keys.brake = false;
        sim.takeoffArmed = false;
        toast('AIRBORNE · POSITIVE RATE');
        var st = document.getElementById('lsimState');
        if (st) st.textContent = 'CLIMB';
        beep(520, 0.12, 'triangle', 0.05);
        setTimeout(function () { beep(720, 0.16, 'triangle', 0.05); }, 120);
    }

    function computeScore() {
        var zone = sim.touchX < 1300 ? (1 - Math.min(1, Math.abs(sim.touchX - 250) / 400)) : 0.6;
        var sink = Math.abs(sim.touchVy);
        var smoothPts = clamp(1 - Math.max(0, sink - 0.5) / 5, 0, 1);
        var att = 1 - Math.min(1, Math.abs(sim.touchPitch - 0.06) / 0.16);
        var total = Math.round(400 * zone + 600 * smoothPts + 300 * att + 100);
        var rating = 'Rough';
        if (total >= 1250) rating = 'Butter';
        else if (total >= 1050) rating = 'Smooth';
        else if (total >= 800) rating = 'Firm';
        else if (total >= 500) rating = 'Hard';
        return { total: total, rating: rating };
    }

    function scoreLanding() {
        var result = computeScore();
        sim.lastResult = result;
        sim.score += result.total;
        sim.rating = result.rating;
        sim.coins = Math.max(4, Math.round(result.total / 45));
        if (typeof saveScore === 'function') saveScore('Boeing Landing', result.total);
        if (typeof awardRunCoins === 'function') awardRunCoins(sim.coins);
        var sc = document.getElementById('lsimScore');
        if (sc) sc.textContent = sim.score.toLocaleString();
        var fpmText = sim.lastTouchFpm ? (sim.lastTouchFpm + ' fpm') : '';
        var st = document.getElementById('lsimState');
        if (st) st.textContent = 'LANDED · ' + result.rating.toUpperCase() + (fpmText ? ' · ' + fpmText : '');
        toast(result.rating + ' · ' + (fpmText ? fpmText + ' · ' : '') + '+' + result.total.toLocaleString() + ' pts · +' + sim.coins + ' Coins · throttle to take off');
        beep(660, 0.12, 'triangle', 0.05);
        setTimeout(function () { beep(880, 0.18, 'triangle', 0.05); }, 130);
    }

    function showOverlay(result) {
        overlayShown = true;
        var ov = document.getElementById('lsimOverlay');
        if (!ov) return;
        var title = document.getElementById('lsimOverTitle');
        var text = document.getElementById('lsimOverText');
        var stats = document.getElementById('lsimOverStats');
        var kicker = document.getElementById('lsimOverKicker');
        var coins = document.getElementById('lsimOverCoins');
        if (kicker) kicker.textContent = sim.crashed ? 'RUN ENDED' : 'LANDING COMPLETE';
        if (title) title.textContent = sim.crashed ? 'Accident' : (result.rating + ' landing');
        if (text) {
            text.textContent = sim.crashed
                ? sim.reason
                : 'The 737 is down and stopped on runway 09. Suspension settled, spoilers up.';
        }
        if (stats) {
            var sink = Math.round(-sim.touchVy * 196.85);
            var pitch = round(sim.touchPitch * 57.2958, 1);
            var stopDistance = sim.crashed ? 0 : Math.max(0, Math.round(sim.x));
            stats.innerHTML =
                '<div><small>TOUCHDOWN</small><strong>' + (sim.crashed ? '—' : Math.round(sim.touchX) + ' m') + '</strong></div>' +
                '<div><small>SINK RATE</small><strong>' + (sim.crashed ? '—' : sink + ' fpm') + '</strong></div>' +
                '<div><small>ATTITUDE</small><strong>' + (sim.crashed ? '—' : pitch + '°') + '</strong></div>' +
                '<div><small>STOP POINT</small><strong>' + (sim.crashed ? '—' : stopDistance + ' m') + '</strong></div>';
        }
        if (coins) {
            coins.innerHTML = sim.crashed
                ? 'No Coins awarded'
                : '<span>' + sim.score.toLocaleString() + ' points</span><span>' + sim.coins + ' Coins</span>';
        }
        ov.style.display = 'flex';
    }

    function step(dt) {
        if (!running || sim.finished) return;
        sim.t += dt;
        if (sim.onGround) stepGround(dt);
        else stepAir(dt);
        updateParticles(dt);
        updateCamera(dt);
        if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - dt * 1.8);
        if (sim.crashed) {
            smokeTimer -= dt;
            if (smokeTimer <= 0) {
                smokeTimer = 0.12;
                spawnSmoke(sim.x - 2, sim.y + 1);
            }
        }
        hudTimer -= dt;
        if (hudTimer <= 0) { hudTimer = 0.08; updateHud(false); }
    }

    function updateCamera(dt) {
        var targetScale;
        if (sim.onGround) {
            if (sim.vx < 2.5) targetScale = clamp(W * 0.7 / 39, 8.5, 17);
            else targetScale = clamp(W * 0.95 / (80 + sim.vx * 1.6), 4.2, 12);
        } else if (sim.y < 28) {
            targetScale = clamp(4.2 + (28 - sim.y) * 0.22, 4.2, 8.1);
        } else if (sim.x < 0) {
            targetScale = clamp((W * 0.55) / Math.max(110, -sim.x), 1.0, 3.9);
        } else {
            targetScale = clamp(6.2 - sim.y * 0.02, 1.4, 5.5);
        }
        targetScale = Math.min(targetScale, (groundY() - H * 0.12) / Math.max(6, sim.y));
        sim.camScale = smooth(sim.camScale, targetScale, 2.4, dt);
        sim.camX = sim.x;
        sim.camY = 0;
    }

    function updateHud(force) {
        var ias = Math.round(sim.vx * 1.94384);
        var alt = Math.max(0, Math.round(sim.y * 3.28084));
        var vs = Math.round(sim.vy * 196.85);
        var pitch = round(sim.pitch * 57.2958, 1);
        setText('lsimIas', ias);
        setText('lsimAlt', alt);
        setText('lsimVs', (vs > 0 ? '+' : '') + vs);
        setText('lsimPitch', pitch);
        setText('lsimThrVal', Math.round(sim.throttle * 100) + '%');
        setText('lsimFlapVal', Math.round(sim.flaps) + '°');
        setText('lsimGearVal', sim.gearTarget ? 'DOWN' : 'UP');
        setText('lsimBrakeVal', sim.keys.brake ? 'ON' : 'OFF');
        setText('lsimTouchFpm', sim.lastTouchFpm ? (sim.lastTouchFpm + ' fpm') : '—');
        setText('lsimScore', (sim.score || 0).toLocaleString());
        setText('lsimMainSusp', Math.round(clamp(sim.compMain / GEAR_MAIN.max, 0, 1) * 100) + '%');
        setText('lsimNoseSusp', Math.round(clamp(sim.compNose / GEAR_NOSE.max, 0, 1) * 100) + '%');
        setText('lsimTireVal', Math.round(clamp(sim.tireComp / PARTS.tire, 0, 1) * 100) + '%');
        setText('lsimOleoVal', Math.round(clamp(sim.oleoComp / PARTS.oleo, 0, 1) * 100) + '%');
        setText('lsimArmVal', Math.round(clamp(sim.armComp / PARTS.arm, 0, 1) * 100) + '%');
        var thr = document.getElementById('lsimThrBar');
        if (thr) thr.style.width = Math.round(sim.throttle * 100) + '%';
        var ms = document.getElementById('lsimMainBar');
        if (ms) ms.style.width = Math.round(clamp(sim.compMain / GEAR_MAIN.max, 0, 1) * 100) + '%';
        var ns = document.getElementById('lsimNoseBar');
        if (ns) ns.style.width = Math.round(clamp(sim.compNose / GEAR_NOSE.max, 0, 1) * 100) + '%';
        var tb = document.getElementById('lsimTireBar');
        if (tb) tb.style.width = Math.round(clamp(sim.tireComp / PARTS.tire, 0, 1) * 100) + '%';
        var ob = document.getElementById('lsimOleoBar');
        if (ob) ob.style.width = Math.round(clamp(sim.oleoComp / PARTS.oleo, 0, 1) * 100) + '%';
        var ab = document.getElementById('lsimArmBar');
        if (ab) ab.style.width = Math.round(clamp(sim.armComp / PARTS.arm, 0, 1) * 100) + '%';
        var gear = document.getElementById('lsimGearVal');
        if (gear) gear.classList.toggle('is-warn', !sim.gearTarget);
        var brake = document.getElementById('lsimBrakeVal');
        if (brake) brake.classList.toggle('is-on', !!sim.keys.brake);
        var state = document.getElementById('lsimState');
        if (state && !sim.finished) {
            var dist = Math.max(0, -sim.x);
            if (sim.onGround) {
                if (sim.vx < 0.8) state.textContent = sim.takeoffArmed ? 'STOPPED · ADD POWER' : 'ROLLING OUT';
                else if (sim.keys.brake) state.textContent = 'BRAKING';
                else if (sim.throttle > 0.5 && sim.takeoffArmed) state.textContent = 'TAKEOFF ROLL';
                else state.textContent = 'ROLLING OUT';
            } else if (sim.x < 0) {
                if (dist < 120 || sim.y < 12) state.textContent = 'FLARE';
                else if (dist < 700) state.textContent = 'FINAL';
                else state.textContent = 'APPROACH';
            } else if (sim.vy > 0.8) {
                state.textContent = 'CLIMB';
            } else if (sim.y < 15) {
                state.textContent = 'FLARE';
            } else {
                state.textContent = 'DESCENT';
            }
            state.classList.toggle('is-warn', !sim.onGround && !sim.gearTarget);
        }
        var papi = document.getElementById('lsimPapiText');
        if (papi) {
            var distToGo = Math.max(0, -sim.x);
            var ideal = distToGo * Math.tan(GS_ANGLE);
            var err = sim.y - ideal;
            var label;
            if (sim.onGround) label = sim.vx > 1 ? 'TAKEOFF ROLL' : 'ON RUNWAY';
            else if (sim.x > 0) label = sim.vy > 0.5 ? 'POSITIVE RATE' : 'DESCENT';
            else label = err > 9 ? 'GLIDESLOPE HIGH' : (err < -9 ? 'GLIDESLOPE LOW' : 'ON GLIDESLOPE');
            papi.textContent = label;
            papi.classList.toggle('is-warn', !sim.onGround && sim.x < 0 && Math.abs(err) > 9);
        }
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /* ------------------------- rendering ------------------------- */

    function resize() {
        if (!canvas || !stage) return;
        var rect = stage.getBoundingClientRect();
        W = Math.max(320, rect.width || 900);
        H = Math.max(280, rect.height || 520);
        DPR = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
    }

    function groundY() { return H * 0.79; }
    function sx(x) { return (x - sim.camX) * sim.camScale + W * 0.38; }
    function sy(y) { return groundY() - (y - sim.camY) * sim.camScale; }

    function draw() {
        if (!ctx) return;
        var shakeX = sim.shake > 0 ? (Math.random() - 0.5) * sim.shake * 5 : 0;
        var shakeY = sim.shake > 0 ? (Math.random() - 0.5) * sim.shake * 4 : 0;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.translate(shakeX, shakeY);
        drawSky();
        drawGround();
        drawRunway();
        drawApproach();
        drawGuide();
        drawParticles(true);
        drawAircraft();
        drawParticles(false);
        ctx.restore();
    }

    function drawSky() {
        var g = ctx.createLinearGradient(0, 0, 0, groundY());
        g.addColorStop(0, '#071223');
        g.addColorStop(0.45, '#16324f');
        g.addColorStop(0.78, '#6d6076');
        g.addColorStop(1, '#d59a72');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, groundY() + 1);

        var sunX = W * 0.78 - (sim.camX * 0.02) % W;
        var sunY = groundY() - 78;
        var sg = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 120);
        sg.addColorStop(0, 'rgba(255, 220, 160, 0.55)');
        sg.addColorStop(0.25, 'rgba(255, 180, 110, 0.18)');
        sg.addColorStop(1, 'rgba(255, 150, 90, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
        ctx.fillStyle = 'rgba(255, 232, 190, 0.85)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 13, 0, Math.PI * 2);
        ctx.fill();

        drawClouds(0.16, 34, 'rgba(210, 220, 235, 0.13)', 0.9);
        drawClouds(0.3, 18, 'rgba(230, 235, 245, 0.1)', 1.5);
        drawHills();
    }

    function cloudPositions(seed) {
        return [
            { x: -1200 + seed * 30, y: 44 + seed * 7, w: 120, h: 16 },
            { x: -600 + seed * 17, y: 62 + seed * 5, w: 170, h: 20 },
            { x: 100 + seed * 41, y: 38 + seed * 9, w: 140, h: 14 },
            { x: 850 + seed * 23, y: 70 + seed * 6, w: 200, h: 22 },
            { x: 1600 + seed * 37, y: 50 + seed * 8, w: 150, h: 16 }
        ];
    }

    function drawClouds(parallax, seed, color) {
        var clouds = cloudPositions(seed);
        ctx.fillStyle = color;
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            var span = W * 1.4;
            var x = ((c.x - sim.camX * parallax * 0.35) % span + span) % span - W * 0.2;
            var y = groundY() - 72 - c.y * 1.15 + sim.camY * 0.55;
            var cw = c.w * 0.85;
            var ch = c.h * 0.95;
            ctx.beginPath();
            ctx.ellipse(x, y, cw * 0.5, ch, 0, 0, Math.PI * 2);
            ctx.ellipse(x + cw * 0.22, y - 5, cw * 0.33, ch * 0.9, 0, 0, Math.PI * 2);
            ctx.ellipse(x - cw * 0.24, y + 2, cw * 0.3, ch * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawHills() {
        var base = groundY();
        ctx.fillStyle = 'rgba(16, 30, 38, 0.82)';
        ctx.beginPath();
        ctx.moveTo(0, base);
        var offset = -sim.camX * 0.12;
        for (var x = -100; x <= W + 100; x += 40) {
            var h = 18 + Math.sin((x + offset) * 0.006) * 12 + Math.sin((x + offset) * 0.013) * 7;
            ctx.lineTo(x, base - Math.max(6, h));
        }
        ctx.lineTo(W, base);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(10, 20, 26, 0.92)';
        var cityOffset = -sim.camX * 0.2;
        for (var i = 0; i < 26; i++) {
            var bx = ((i * 73 + cityOffset) % (W + 180) + W + 180) % (W + 180) - 90;
            var bh = 8 + ((i * 37) % 26);
            var bw = 10 + ((i * 19) % 16);
            ctx.fillRect(bx, base - bh, bw, bh);
            ctx.fillStyle = 'rgba(255, 210, 140, 0.25)';
            for (var wy = base - bh + 3; wy < base - 3; wy += 6) {
                if ((i + wy) % 3 === 0) ctx.fillRect(bx + 2, wy, 2, 2);
            }
            ctx.fillStyle = 'rgba(10, 20, 26, 0.92)';
        }
    }

    function drawGround() {
        var gy = groundY();
        var g = ctx.createLinearGradient(0, gy, 0, H);
        g.addColorStop(0, '#20301f');
        g.addColorStop(0.35, '#18251a');
        g.addColorStop(1, '#0b120e');
        ctx.fillStyle = g;
        ctx.fillRect(0, gy, W, H - gy);
        ctx.strokeStyle = 'rgba(120, 200, 140, 0.12)';
        ctx.lineWidth = 1;
        for (var i = 0; i < 14; i++) {
            var y = gy + 6 + i * i * 0.7;
            if (y > H) break;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    function drawRunway() {
        var gy = groundY();
        var y = gy - 2;
        var left = sim.x - (W * 0.38) / sim.camScale - 100;
        var right = sim.x + (W * 0.62) / sim.camScale + 100;
        var x0 = sx(left);
        var x1 = sx(right);
        ctx.fillStyle = '#1a1d21';
        ctx.fillRect(x0, y, x1 - x0, 12);
        ctx.fillStyle = '#2b2f35';
        ctx.fillRect(x0, y, x1 - x0, 3);
        ctx.strokeStyle = 'rgba(200, 210, 220, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y + 0.5);
        ctx.lineTo(x1, y + 0.5);
        ctx.stroke();

        // Infinite runway edge lights.
        var e0 = Math.floor(left / 60) * 60;
        for (var ex = e0; ex <= right; ex += 60) {
            var px = sx(ex);
            ctx.fillStyle = 'rgba(255, 214, 120, 0.55)';
            ctx.beginPath();
            ctx.arc(px, y - 3, 1.1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Threshold piano keys.
        if (left < 80 && right > -20) {
            for (var k = 0; k < 8; k++) {
                var tx = sx(8 + k * 6.5);
                ctx.fillStyle = k % 2 ? 'rgba(235, 240, 245, 0.65)' : 'rgba(235, 240, 245, 0.25)';
                ctx.fillRect(tx, y - 4, Math.max(1, 3.4 * sim.camScale), 4);
            }
        }

        // Aiming point and touchdown-zone bars near the threshold.
        if (left < 1000 && right > 100) {
            drawRunwayBlock(300, 14, 7, 'rgba(235, 240, 245, 0.7)');
            for (var d = 150; d <= 900; d += 150) {
                drawRunwayBlock(d, 10, 4, 'rgba(235, 240, 245, 0.4)');
                drawRunwayBlock(d + 35, 10, 4, 'rgba(235, 240, 245, 0.4)');
            }
        }

        // Infinite centerline dashes.
        var c0 = Math.floor(left / 45) * 45;
        for (var cx = c0; cx <= right; cx += 45) {
            var px2 = sx(cx);
            ctx.fillStyle = 'rgba(230, 235, 240, 0.35)';
            ctx.fillRect(px2, y + 8, Math.max(2, 24 * sim.camScale), 1.4);
        }

        // Distance ticks continue forever down the runway.
        ctx.font = '600 8px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(210, 230, 240, 0.5)';
        var m0 = Math.max(0, Math.floor(left / 250) * 250);
        for (var m = m0; m <= right; m += 250) {
            var mx = sx(m);
            if (mx < -20 || mx > W + 20) continue;
            ctx.fillRect(mx, y - 2, 1, 4);
            ctx.fillText(m + 'm', mx + 4, y - 4);
        }

        // Runway designator at the threshold.
        var numX = sx(90);
        if (numX > -40 && numX < W + 40) {
            ctx.save();
            ctx.translate(numX, y - 12);
            ctx.fillStyle = 'rgba(240, 245, 250, 0.55)';
            ctx.font = '900 15px system-ui, sans-serif';
            ctx.fillText('09', -8, 0);
            ctx.restore();
        }
    }

    function drawRunwayBlock(x, width, height, color) {
        var px = sx(x);
        if (px < -60 || px > W + 60) return;
        ctx.fillStyle = color;
        ctx.fillRect(px, groundY() - 2 - height, Math.max(2, width * sim.camScale), height);
    }

    function drawApproach() {
        var gy = groundY();
        // Lead-in lights before the threshold.
        var viewLeft = sim.x - (W * 0.38) / sim.camScale;
        var viewRight = sim.x + (W * 0.62) / sim.camScale;
        for (var x = Math.max(-1000, Math.floor(viewLeft / 50) * 50); x <= Math.min(-40, viewRight); x += 50) {
            var px = sx(x);
            if (px < -20 || px > W + 20) continue;
            var lit = ((x / 50) % 2 === 0);
            ctx.strokeStyle = 'rgba(120, 150, 160, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, gy);
            ctx.lineTo(px, gy - 7);
            ctx.stroke();
            ctx.fillStyle = lit ? 'rgba(255, 220, 120, 0.85)' : 'rgba(220, 235, 240, 0.25)';
            ctx.beginPath();
            ctx.arc(px, gy - 8, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // PAPI: four lights by the threshold.
        var ideal = Math.max(0, -sim.x) * Math.tan(GS_ANGLE);
        var err = sim.y - ideal;
        var whites = sim.onGround ? 2 : (err > 9 ? 4 : (err < -9 ? 0 : 2));
        var papiX = sx(46);
        if (papiX > -30 && papiX < W + 30) {
            for (var i = 0; i < 4; i++) {
                ctx.fillStyle = i >= 4 - whites ? 'rgba(255, 245, 210, 0.95)' : 'rgba(255, 70, 70, 0.95)';
                ctx.beginPath();
                ctx.arc(papiX, gy - 12 - i * 3.4, 1.9, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = 'rgba(230, 240, 245, 0.35)';
            ctx.fillRect(papiX - 0.5, gy - 4, 1, 4);
        }

    }

    function drawGuide() {
        if (!sim.showGuide || sim.onGround) return;
        var start = -1900;
        var endX = 0;
        var startY = -start * Math.tan(GS_ANGLE);
        ctx.save();
        ctx.setLineDash([10, 9]);
        ctx.strokeStyle = 'rgba(120, 235, 255, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx(start), sy(startY));
        ctx.lineTo(sx(endX), sy(0));
        ctx.stroke();
        ctx.restore();
    }

    function drawAircraft() {
        var px = sx(sim.x);
        var py = sy(sim.y);
        var sc = sim.camScale;

        // Shadow on the runway.
        if (sim.y < 80) {
            var shadowW = 30 * sc * clamp(1 - sim.y / 120, 0.25, 1);
            var shadowAlpha = clamp(0.25 - sim.y * 0.002, 0.05, 0.25);
            ctx.fillStyle = 'rgba(0, 0, 0, ' + shadowAlpha + ')';
            ctx.beginPath();
            ctx.ellipse(px - 1 * sc, groundY() - 1, shadowW, 3.2 * sc * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(px, py);
        if (sim.crashed) {
            ctx.rotate(0.22);
            ctx.translate(0, -2 * sc);
        }
        ctx.scale(sc, -sc);
        ctx.rotate(sim.pitch);

        drawPlaneShadowless();
        ctx.restore();
        drawSuspensionCallouts();
    }

    function drawSuspensionCallouts() {
        if (!sim.onGround) return;
        var gears = [
            { x: sim.x + GEAR_MAIN.offset, comp: sim.compMain, max: GEAR_MAIN.max, label: 'MAIN', tire: sim.tireComp, oleo: sim.oleoComp, arm: sim.armComp, dx: -88 },
            { x: sim.x + GEAR_NOSE.offset, comp: sim.compNose, max: GEAR_NOSE.max, label: 'NOSE', tire: sim.noseTire, oleo: sim.noseOleo, arm: sim.noseArm, dx: 88 }
        ];
        for (var i = 0; i < gears.length; i++) {
            var g = gears[i];
            var px = sx(g.x);
            if (px < -60 || px > W + 60) continue;
            var gy = groundY();
            var boxW = 76, boxH = 78;
            var cx = clamp(px + (g.dx || 0), boxW / 2 + 6, W - boxW / 2 - 6);
            var bx = cx - boxW / 2;
            var by = gy - 126;
            var pct = clamp(g.comp / g.max, 0, 1);
            ctx.strokeStyle = 'rgba(255, 209, 102, 0.32)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, by + boxH);
            ctx.lineTo(px, gy - 10);
            ctx.stroke();
            ctx.fillStyle = 'rgba(5, 14, 20, 0.9)';
            ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(bx, by, boxW, boxH, 8) : ctx.rect(bx, by, boxW, boxH);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 220, 160, 0.65)';
            ctx.font = '800 6px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(g.label + ' GEAR', cx, by + 10);
            ctx.fillStyle = '#ffe2a0';
            ctx.font = '900 13px system-ui, sans-serif';
            ctx.fillText(Math.round(pct * 100) + '%', cx, by + 25);
            var rows = [
                ['TIRE', g.tire / PARTS.tire, '#5fe7ff'],
                ['OLEO', g.oleo / PARTS.oleo, '#ffb15e'],
                ['ARM', g.arm / PARTS.arm, '#c084fc']
            ];
            for (var ri = 0; ri < rows.length; ri++) {
                var ry = by + 33 + ri * 13;
                ctx.textAlign = 'left';
                ctx.fillStyle = 'rgba(220, 240, 250, 0.55)';
                ctx.font = '800 5px system-ui, sans-serif';
                ctx.fillText(rows[ri][0], bx + 6, ry + 4);
                var val = clamp(rows[ri][1], 0, 1);
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(bx + 24, ry, 38, 5);
                ctx.fillStyle = rows[ri][2];
                ctx.fillRect(bx + 24, ry, Math.max(1, 38 * val), 5);
                ctx.textAlign = 'right';
                ctx.fillStyle = 'rgba(235, 250, 255, 0.8)';
                ctx.fillText(Math.round(val * 100) + '%', bx + 70, ry + 4);
            }
            ctx.fillStyle = 'rgba(255, 225, 170, 0.7)';
            ctx.beginPath();
            ctx.moveTo(cx - 3, by + 72);
            ctx.lineTo(cx + 3, by + 72);
            ctx.lineTo(cx, by + 76);
            ctx.closePath();
            ctx.fill();
        }
        ctx.textAlign = 'left';
    }

    function drawPlaneShadowless() {
        var body = '#e8edf1';
        var shade = '#b8c4cc';
        var blue = '#2f6f9f';
        var dark = '#26323a';

        // Horizontal stabilizer and tail.
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(-17.5, 1.2);
        ctx.lineTo(-23, 3.6);
        ctx.lineTo(-22.2, 4.4);
        ctx.lineTo(-16.5, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(-16.2, 1.0);
        ctx.lineTo(-21.8, 9.8);
        ctx.lineTo(-18.6, 10.2);
        ctx.lineTo(-13.8, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.moveTo(-18.4, 4.4);
        ctx.lineTo(-21.1, 9.4);
        ctx.lineTo(-18.9, 9.6);
        ctx.lineTo(-16.9, 4.8);
        ctx.closePath();
        ctx.fill();

        // Fuselage.
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(-18, -1.3);
        ctx.quadraticCurveTo(-10, -2.4, 4, -2.5);
        ctx.quadraticCurveTo(14, -2.3, 18.6, -1.1);
        ctx.quadraticCurveTo(21.6, 0, 18.4, 1.3);
        ctx.quadraticCurveTo(12, 2.5, 2, 2.6);
        ctx.quadraticCurveTo(-10, 2.6, -18, 1.5);
        ctx.closePath();
        ctx.fill();

        // Belly shade and cheatline.
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(-18, -1.2);
        ctx.quadraticCurveTo(-8, -2.3, 4, -2.4);
        ctx.quadraticCurveTo(14, -2.2, 18.6, -1.1);
        ctx.lineTo(18, 0.1);
        ctx.quadraticCurveTo(8, -0.8, -18, -0.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.moveTo(-18, 0.6);
        ctx.quadraticCurveTo(-6, 1.5, 5, 1.5);
        ctx.quadraticCurveTo(14, 1.4, 19.2, 0.6);
        ctx.lineTo(19, 1.1);
        ctx.quadraticCurveTo(12, 2.2, 2, 2.3);
        ctx.quadraticCurveTo(-9, 2.2, -18, 1.4);
        ctx.closePath();
        ctx.fill();

        // Cockpit windows.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(19.2, 0.2);
        ctx.quadraticCurveTo(20.4, 0.6, 19.4, 1.1);
        ctx.lineTo(16.5, 1.1);
        ctx.lineTo(16.8, 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(150, 220, 255, 0.55)';
        ctx.fillRect(17.1, 0.5, 1.1, 0.5);
        ctx.fillRect(18.5, 0.55, 0.8, 0.45);

        // Cabin windows.
        ctx.fillStyle = 'rgba(20, 32, 40, 0.7)';
        for (var wx = -12; wx < 15; wx += 1.7) {
            ctx.fillRect(wx, 0.8, 0.65, 0.5);
        }

        // Wing and engine.
        ctx.fillStyle = '#cfd8de';
        ctx.beginPath();
        ctx.moveTo(-2.5, -1.1);
        ctx.lineTo(4.8, -3.2);
        ctx.lineTo(8.2, -2.9);
        ctx.lineTo(3.4, -0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(4.8, -3.2);
        ctx.lineTo(8.2, -2.9);
        ctx.lineTo(7.2, -2.2);
        ctx.lineTo(4.4, -2.4);
        ctx.closePath();
        ctx.fill();

        // Flaps trailing edge.
        var flapAngle = (sim.flaps / 40) * 0.5;
        ctx.save();
        ctx.translate(4.2, -1.2);
        ctx.rotate(-flapAngle);
        ctx.fillStyle = '#dbe3e8';
        ctx.fillRect(-1.2, -0.55, 4.2, 0.5);
        ctx.restore();

        // Engine nacelle.
        ctx.fillStyle = '#c6d0d7';
        ctx.beginPath();
        ctx.moveTo(-1.2, -2.4);
        ctx.lineTo(3.8, -2.6);
        ctx.quadraticCurveTo(4.8, -2.2, 4.2, -1.5);
        ctx.lineTo(-0.8, -1.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(4.1, -2.0, 0.55, 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(140, 190, 220, 0.5)';
        ctx.beginPath();
        ctx.ellipse(4.15, -2.0, 0.28, 0.26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spoilers.
        if (sim.spoilers > 0.05) {
            ctx.fillStyle = '#9aa8b2';
            for (var s = 0; s < 3; s++) {
                ctx.save();
                ctx.translate(0.2 + s * 0.9, -2.2);
                ctx.rotate(-0.55 * sim.spoilers);
                ctx.fillRect(-0.3, 0, 0.8, 0.18);
                ctx.restore();
            }
        }

        drawGearLeg(GEAR_MAIN, {
            tire: sim.tireComp, oleo: sim.oleoComp, arm: sim.armComp,
            total: sim.compMain, heat: sim.brakeHeat
        }, true);
        drawGearLeg(GEAR_NOSE, {
            tire: sim.noseTire, oleo: sim.noseOleo, arm: sim.noseArm,
            total: sim.compNose, heat: sim.brakeHeat * 0.7
        }, false);
    }

    function drawGearSpring(offX, topY, bottomY, radius, turns) {
        var height = topY - bottomY;
        if (height <= 0.05) return;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 0.13;
        ctx.beginPath();
        var segs = turns * 2;
        for (var i = 0; i <= segs; i++) {
            var y = topY - (height * i) / segs;
            var x = offX + (i === 0 || i === segs ? 0 : (i % 2 ? radius : -radius));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function drawGearLeg(gear, parts, isMain) {
        if (sim.gearAnim < 0.08) return;
        var extend = sim.gearAnim;
        var strut = gear.strut * extend;
        var total = parts.total || 0;
        var offX = gear.offset;
        var wheelR = gear.wheel * (1.18 + 0.15 * extend);
        var axleY = gear.attachY - strut + total;
        var visualR = wheelR * 1.42;
        var tireRy = Math.max(0.22, visualR - (parts.tire || 0) * 1.25);
        var tireRx = visualR + (parts.tire || 0) * 0.45;
        var wheelCy = axleY - wheelR + tireRy;
        var oleoBottom = gear.attachY - strut + (parts.oleo || 0);
        var armPivotX = offX + (isMain ? 2.1 : 1.4);
        var armPivotY = gear.attachY - 0.5;

        // Gear door when retracting.
        if (extend < 0.98) {
            ctx.fillStyle = '#8d9aa3';
            ctx.fillRect(offX - 1.4, gear.attachY - 0.2, 2.8, 0.35);
        }

        // Air/hydraulic canister on the fuselage.
        ctx.fillStyle = '#39464f';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(offX + 0.4, gear.attachY + 0.15, 1.7, 0.5, 0.16) : ctx.rect(offX + 0.4, gear.attachY + 0.15, 1.7, 0.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 209, 102, 0.75)';
        ctx.fillRect(offX + 0.55, gear.attachY + 0.3, 1.4, 0.08);
        // Hydraulic line from the canister to the strut.
        ctx.strokeStyle = 'rgba(20, 30, 36, 0.9)';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(offX + 0.5, gear.attachY + 0.45);
        ctx.quadraticCurveTo(offX - 0.5, gear.attachY - 0.1, offX - 0.2, gear.attachY - strut * 0.5);
        ctx.stroke();

        // Bump stop: rubber discs bunch up as the oleo reaches full travel.
        var bump = clamp((parts.oleo || 0) / PARTS.oleo, 0, 1);
        for (var b = 0; b < 4; b++) {
            var gap = 0.17 * (1 - bump * 0.7);
            ctx.fillStyle = b % 2 ? '#5a6670' : '#77838c';
            ctx.fillRect(offX - 0.34, gear.attachY - 0.18 - b * gap, 0.68, 0.1);
        }

        // Main oleo housing and polished piston.
        var housing = gear.attachY - strut * 0.55;
        ctx.fillStyle = '#6f7d86';
        ctx.fillRect(offX - 0.38, housing, 0.76, gear.attachY - strut * 0.12 - housing);
        ctx.fillStyle = '#d9e2e7';
        ctx.fillRect(offX - 0.24, oleoBottom, 0.48, housing - oleoBottom + 0.05);
        ctx.fillStyle = '#59656d';
        ctx.fillRect(offX - 0.46, housing - 0.16, 0.92, 0.32);
        ctx.fillStyle = '#2f3a41';
        ctx.fillRect(offX - 0.2, oleoBottom + 0.05, 0.4, 0.18);

        // Coil spring around the exposed piston.
        drawGearSpring(offX, housing - 0.02, oleoBottom + 0.2, 0.36, 6);

        // Trailing arm: heavy forged link that swings down with travel.
        ctx.strokeStyle = '#5d6b74';
        ctx.lineWidth = 0.34;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(armPivotX, armPivotY);
        ctx.quadraticCurveTo(offX + 1.0, axleY + 0.7, offX, wheelCy);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(armPivotX, armPivotY + 0.14);
        ctx.quadraticCurveTo(offX + 1.0, axleY + 0.84, offX, wheelCy + 0.14);
        ctx.stroke();
        // Pivot boss and rotary damper.
        ctx.fillStyle = '#303b42';
        ctx.beginPath();
        ctx.arc(armPivotX, armPivotY, 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c98a3c';
        ctx.beginPath();
        ctx.arc(armPivotX, armPivotY, 0.18, 0, Math.PI * 2);
        ctx.fill();
        // Connecting link from the oleo piston to the arm.
        ctx.strokeStyle = '#aab6bd';
        ctx.lineWidth = 0.18;
        ctx.beginPath();
        ctx.moveTo(offX, oleoBottom + 0.1);
        ctx.lineTo(offX + 0.55, axleY + 0.45);
        ctx.stroke();

        // Scissor torque links fold as the gear compresses.
        var fold = clamp(total / GEAR_MAIN.max, 0, 1);
        var linkTopX = offX - 0.42;
        var linkTopY = gear.attachY - strut * 0.42;
        var linkBotX = offX + 0.2;
        var linkBotY = axleY + 0.35;
        var elbowX = (linkTopX + linkBotX) / 2 - 0.28 - fold * 0.35;
        var elbowY = (linkTopY + linkBotY) / 2;
        ctx.strokeStyle = '#c7d1d7';
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(linkTopX, linkTopY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(linkBotX, linkBotY);
        ctx.stroke();
        ctx.fillStyle = '#7c8a93';
        ctx.beginPath();
        ctx.arc(elbowX, elbowY, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Hydraulic brake disc and caliper.
        var discR = visualR * 0.55;
        ctx.fillStyle = '#8b969d';
        ctx.beginPath();
        ctx.arc(offX, wheelCy, discR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 120, 40, ' + (0.15 + (parts.heat || 0) * 0.8) + ')';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(offX, wheelCy, discR, 0, Math.PI * 2);
        ctx.stroke();
        if ((parts.heat || 0) > 0.05) {
            ctx.fillStyle = 'rgba(255, 110, 30, ' + ((parts.heat || 0) * 0.35) + ')';
            ctx.beginPath();
            ctx.arc(offX, wheelCy, discR * 1.15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#c33f2e';
        ctx.fillRect(offX + discR * 0.55, wheelCy + discR * 0.35, 0.38, 0.5);

        // Tire: squashed ellipse shows the sidewall deflection.
        ctx.save();
        ctx.translate(offX, wheelCy);
        ctx.rotate(-sim.wheelAngle * 0.35);
        ctx.fillStyle = '#0f1418';
        ctx.beginPath();
        ctx.ellipse(0, 0, tireRx, tireRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e3eaee';
        ctx.beginPath();
        ctx.ellipse(0, 0, tireRx * 0.52, tireRy * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7c8a93';
        ctx.beginPath();
        ctx.arc(0, 0, tireRx * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9aa7b0';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(-tireRx * 0.42, 0);
        ctx.lineTo(tireRx * 0.42, 0);
        ctx.moveTo(0, -tireRy * 0.42);
        ctx.lineTo(0, tireRy * 0.42);
        ctx.stroke();
        ctx.restore();

        // Nav light at the main gear.
        if (isMain) {
            ctx.fillStyle = 'rgba(80, 255, 160, 0.8)';
            ctx.beginPath();
            ctx.arc(offX - 0.4, axleY + 0.6, 0.12, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawParticles(behind) {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            if (behind !== (p.y < sim.y)) continue;
            var life = 1 - p.life / p.max;
            ctx.fillStyle = p.color + (life * 0.55) + ')';
            ctx.beginPath();
            ctx.arc(sx(p.x), sy(p.y), Math.max(1, p.size * sim.camScale * (1.4 - life)), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function frame(now) {
        if (!running && sim.finished) {
            // Keep drawing smoke / settled aircraft for a moment.
        }
        if (!lastFrame) lastFrame = now;
        var dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (running && !sim.finished) {
            var acc = dt;
            while (acc > 0) {
                var sdt = Math.min(1 / 120, acc);
                step(sdt);
                acc -= sdt;
            }
        } else if (sim.crashed) {
            updateParticles(dt);
            if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - dt * 1.8);
            smokeTimer -= dt;
            if (smokeTimer <= 0) { smokeTimer = 0.12; spawnSmoke(sim.x - 2, sim.y + 1); }
        }
        draw();
        raf = requestAnimationFrame(frame);
    }

    function open() {
        if (typeof closeGame === 'function' && currentGameId && currentGameId !== 13) closeGame();
        if (window.Games3D) window.Games3D.stop();
        if (typeof dgDestroy === 'function') dgDestroy();
        if (typeof luckyCleanup === 'function') luckyCleanup();
        landingCleanup();
        currentGameId = 13;
        if (typeof trackRecentGame === 'function') trackRecentGame(13);
        document.getElementById('modalGameTitle').textContent = 'Boeing Landing';
        var body = document.getElementById('modalGameBody');
        body.innerHTML =
            '<div class="lsim-wrap">' +
                '<div class="lsim-stage" id="lsimStage">' +
                    '<canvas id="lsimCanvas" class="lsim-canvas"></canvas>' +
                    '<div class="lsim-vignette"></div>' +
                    '<div class="lsim-top">' +
                        '<div class="lsim-brand"><span class="lsim-tag">BOEING 737 · SIDE VIEW</span><strong>Runway 09 Approach</strong></div>' +
                        '<div class="lsim-state" id="lsimState">FINAL APPROACH</div>' +
                        '<div class="lsim-score-pill"><small>SCORE</small><strong id="lsimScore">0</strong></div>' +
                    '</div>' +
                    '<div class="lsim-panel lsim-instruments">' +
                        '<div class="lsim-gauge"><small>AIRSPEED</small><strong id="lsimIas">0</strong><span>kt</span></div>' +
                        '<div class="lsim-gauge"><small>ALTITUDE</small><strong id="lsimAlt">0</strong><span>ft</span></div>' +
                        '<div class="lsim-gauge"><small>VERT SPEED</small><strong id="lsimVs">0</strong><span>fpm</span></div>' +
                        '<div class="lsim-gauge"><small>PITCH</small><strong id="lsimPitch">0</strong><span>deg</span></div>' +
                    '</div>' +
                    '<div class="lsim-panel lsim-systems">' +
                        '<div class="lsim-sys-row"><span>THROTTLE</span><div class="lsim-bar"><i id="lsimThrBar"></i></div><b id="lsimThrVal">38%</b></div>' +
                        '<div class="lsim-sys-row"><span>FLAPS</span><b id="lsimFlapVal">30°</b></div>' +
                        '<div class="lsim-sys-row"><span>GEAR</span><b id="lsimGearVal">DOWN</b></div>' +
                        '<div class="lsim-sys-row"><span>BRAKES</span><b id="lsimBrakeVal">OFF</b></div>' +
                        '<div class="lsim-sys-row"><span>TOUCHDOWN</span><b id="lsimTouchFpm">—</b></div>' +
                        '<div class="lsim-sys-row lsim-susp-row"><span>MAIN GEAR</span><div class="lsim-bar is-susp"><i id="lsimMainBar"></i></div><b id="lsimMainSusp">0%</b></div>' +
                        '<div class="lsim-sys-row lsim-susp-row"><span>NOSE GEAR</span><div class="lsim-bar is-susp"><i id="lsimNoseBar"></i></div><b id="lsimNoseSusp">0%</b></div>' +
                        '<div class="lsim-parts-head">SUSPENSION PARTS</div>' +
                        '<div class="lsim-sys-row lsim-part-row"><span>TIRE</span><div class="lsim-bar is-tire"><i id="lsimTireBar"></i></div><b id="lsimTireVal">0%</b></div>' +
                        '<div class="lsim-sys-row lsim-part-row"><span>OLEO</span><div class="lsim-bar is-oleo"><i id="lsimOleoBar"></i></div><b id="lsimOleoVal">0%</b></div>' +
                        '<div class="lsim-sys-row lsim-part-row"><span>ARM</span><div class="lsim-bar is-arm"><i id="lsimArmBar"></i></div><b id="lsimArmVal">0%</b></div>' +
                        '<div class="lsim-papi-line" id="lsimPapiText">ON GLIDESLOPE</div>' +
                    '</div>' +
                    '<div class="lsim-hint">W/S pitch · A/D throttle · Space brake · F flaps · G gear · R restart · land then add power to take off</div>' +
                    '<div class="lsim-controls">' +
                        '<div class="lsim-control-group"><button type="button" class="lsim-btn" onpointerdown="event.preventDefault();landingHold(\'up\',true)" onpointerup="landingHold(\'up\',false)" onpointercancel="landingHold(\'up\',false)" onpointerleave="landingHold(\'up\',false)">▲ Pitch</button><button type="button" class="lsim-btn" onpointerdown="event.preventDefault();landingHold(\'down\',true)" onpointerup="landingHold(\'down\',false)" onpointercancel="landingHold(\'down\',false)" onpointerleave="landingHold(\'down\',false)">▼ Pitch</button></div>' +
                        '<div class="lsim-control-group"><button type="button" class="lsim-btn" onpointerdown="event.preventDefault();landingHold(\'slow\',true)" onpointerup="landingHold(\'slow\',false)" onpointercancel="landingHold(\'slow\',false)" onpointerleave="landingHold(\'slow\',false)">THR −</button><button type="button" class="lsim-btn" onpointerdown="event.preventDefault();landingHold(\'fast\',true)" onpointerup="landingHold(\'fast\',false)" onpointercancel="landingHold(\'fast\',false)" onpointerleave="landingHold(\'fast\',false)">THR +</button></div>' +
                        '<button type="button" class="lsim-btn is-wide" onpointerdown="event.preventDefault();landingHold(\'brake\',true)" onpointerup="landingHold(\'brake\',false)" onpointercancel="landingHold(\'brake\',false)" onpointerleave="landingHold(\'brake\',false)">Brakes</button>' +
                        '<button type="button" class="lsim-btn" onclick="landingFlaps()">Flaps</button>' +
                        '<button type="button" class="lsim-btn" onclick="landingGear()">Gear</button>' +
                        '<button type="button" class="lsim-btn" onclick="landingRestart()">Restart</button>' +
                    '</div>' +
                    '<div class="lsim-toast" id="lsimToast"></div>' +
                    '<div class="lsim-overlay" id="lsimOverlay">' +
                        '<div class="lsim-card">' +
                            '<span class="lsim-over-kicker" id="lsimOverKicker">LANDING COMPLETE</span>' +
                            '<h2 id="lsimOverTitle">Smooth landing</h2>' +
                            '<p id="lsimOverText"></p>' +
                            '<div class="lsim-over-stats" id="lsimOverStats"></div>' +
                            '<div class="lsim-over-coins" id="lsimOverCoins"></div>' +
                            '<div class="lsim-over-actions"><button type="button" class="lsim-again" onclick="landingRestart()">Fly Again</button><button type="button" class="lsim-back" onclick="closeGame()">Back to Games</button></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.getElementById('gameModal').style.display = 'flex';
        canvas = document.getElementById('lsimCanvas');
        stage = document.getElementById('lsimStage');
        ctx = canvas ? canvas.getContext('2d') : null;
        resize();
        if (window.ResizeObserver && stage) {
            resizeObs = new ResizeObserver(resize);
            resizeObs.observe(stage);
        }
        bindKeys();
        reset();
        running = true;
        lastFrame = 0;
        raf = requestAnimationFrame(frame);
        toast('Final approach · aim for the touchdown zone');
    }

    function landingCleanup() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
        unbindKeys();
        if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
        ctx = null;
        canvas = null;
        stage = null;
        particles = [];
        if (toastTimer) { clearTimeout(toastTimer); toastTimer = 0; }
    }

    function restart() {
        if (!canvas) return;
        reset();
        running = true;
        lastFrame = 0;
        toast('Final approach · aim for the touchdown zone');
    }

    function keyDown(e) {
        if (currentGameId !== 13) return;
        var k = String(e.key || '').toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].indexOf(k) >= 0) e.preventDefault();
        if (k === 'w' || k === 'arrowup') sim.keys.up = true;
        else if (k === 's' || k === 'arrowdown') sim.keys.down = true;
        else if (k === 'a' || k === 'arrowleft') sim.keys.slow = true;
        else if (k === 'd' || k === 'arrowright') sim.keys.fast = true;
        else if (k === ' ') sim.keys.brake = true;
        else if (k === 'f') cycleFlaps();
        else if (k === 'g') toggleGear();
        else if (k === 'h') toggleGuide();
        else if (k === 'r') restart();
    }

    function keyUp(e) {
        if (currentGameId !== 13) return;
        var k = String(e.key || '').toLowerCase();
        if (k === 'w' || k === 'arrowup') sim.keys.up = false;
        else if (k === 's' || k === 'arrowdown') sim.keys.down = false;
        else if (k === 'a' || k === 'arrowleft') sim.keys.slow = false;
        else if (k === 'd' || k === 'arrowright') sim.keys.fast = false;
        else if (k === ' ') sim.keys.brake = false;
    }

    function bindKeys() {
        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
    }

    function unbindKeys() {
        document.removeEventListener('keydown', keyDown);
        document.removeEventListener('keyup', keyUp);
    }

    window.landingHold = function (name, on) {
        if (name === 'brake') btnState('brake', on);
        else btnState(name, on);
    };
    window.landingFlaps = cycleFlaps;
    window.landingGear = toggleGear;
    window.landingRestart = restart;
    window.landingCleanup = landingCleanup;
    window.openLandingSim = open;
})();
