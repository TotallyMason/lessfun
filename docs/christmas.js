/* ============================================================
   LessFun Christmas Jingle — original synthesized loop
   ============================================================ */
(function () {
    'use strict';

    var enabled = true;
    try { enabled = localStorage.getItem('lessfun_jingle') !== '0'; } catch (e) {}
    var soundOn = true;
    var context = null;
    var master = null;
    var timer = 0;
    var playing = false;
    var unlocked = false;
    var noiseBuffer = null;

    var BEAT = 60 / 108;
    var MELODY = [
        79, 81, 83, 84,
        83, 81, 79, 76,
        77, 81, 84, 81,
        79, 83, 86, 79
    ];
    var BASS = [48, 45, 41, 43];

    function midi(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    function isHoliday() {
        return document.documentElement.classList.contains('is-holiday');
    }

    function ensureContext() {
        if (context) return true;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try {
            context = new AC();
            master = context.createGain();
            master.gain.value = 0.075;
            master.connect(context.destination);
            var length = context.sampleRate * 1.2;
            noiseBuffer = context.createBuffer(1, length, context.sampleRate);
            var data = noiseBuffer.getChannelData(0);
            for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.55;
            return true;
        } catch (e) {
            context = null;
            master = null;
            return false;
        }
    }

    function bell(time, note, duration, volume) {
        var freq = midi(note);
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume || 0.12, time + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + duration + 0.03);

        var shimmer = context.createOscillator();
        var shimmerGain = context.createGain();
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(freq * 2.01, time);
        shimmerGain.gain.setValueAtTime(0.0001, time);
        shimmerGain.gain.exponentialRampToValueAtTime((volume || 0.12) * 0.32, time + 0.006);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.7);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(master);
        shimmer.start(time);
        shimmer.stop(time + duration);
    }

    function pad(time, note, duration) {
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(midi(note), time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.035, time + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + duration + 0.03);
    }

    function sleigh(time, volume) {
        if (!noiseBuffer) return;
        var src = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'bandpass';
        filter.frequency.value = 6200;
        filter.Q.value = 1.2;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume || 0.018, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.085);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(time);
        src.stop(time + 0.1);
    }

    function scheduleLoop() {
        if (!context || !master || !playing) return;
        var start = context.currentTime + 0.06;
        for (var i = 0; i < MELODY.length; i++) {
            bell(start + i * BEAT, MELODY[i], 0.55, i % 4 === 0 ? 0.11 : 0.08);
            sleigh(start + i * BEAT, 0.016);
            if (i % 2 === 1) sleigh(start + i * BEAT + BEAT * 0.5, 0.009);
        }
        for (var b = 0; b < BASS.length; b++) {
            pad(start + b * BEAT * 4, BASS[b], BEAT * 3.6);
            pad(start + b * BEAT * 4 + BEAT * 2, BASS[b] + 7, BEAT * 1.6);
        }
        timer = setTimeout(scheduleLoop, MELODY.length * BEAT * 1000 - 90);
    }

    function start() {
        if (!enabled || !soundOn || !isHoliday() || playing) return;
        if (!unlocked || !ensureContext()) return;
        if (context.state === 'suspended') context.resume();
        playing = true;
        updateButton();
        scheduleLoop();
    }

    function stop() {
        playing = false;
        if (timer) { clearTimeout(timer); timer = 0; }
        updateButton();
    }

    function updateButton() {
        var btn = document.getElementById('jingleBtn');
        if (!btn) return;
        btn.textContent = 'Jingle: ' + (enabled ? (playing ? 'On' : 'Ready') : 'Off');
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    function toggle() {
        enabled = !enabled;
        try { localStorage.setItem('lessfun_jingle', enabled ? '1' : '0'); } catch (e) {}
        if (enabled) {
            unlocked = true;
            start();
        } else {
            stop();
        }
        updateButton();
    }

    function unlock() {
        unlocked = true;
        if (enabled && soundOn) start();
    }

    function setSoundEnabled(on) {
        soundOn = !!on;
        if (!soundOn) stop();
        else if (unlocked) start();
    }

    function init() {
        var btn = document.getElementById('jingleBtn');
        if (btn) {
            btn.style.display = isHoliday() ? 'inline-flex' : 'none';
            updateButton();
        }
        if (!isHoliday()) return;
        document.addEventListener('pointerdown', unlock, { once: true, passive: true });
        document.addEventListener('keydown', unlock, { once: true });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (playing) { stop(); }
            } else if (enabled && soundOn && unlocked) {
                start();
            }
        });
        if (typeof soundSetting !== 'undefined') soundOn = !!soundSetting;
    }

    window.LessFunJingle = { toggle: toggle, start: start, stop: stop, setSoundEnabled: setSoundEnabled };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
