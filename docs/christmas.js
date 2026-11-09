/* ============================================================
   LessFun Christmas Jingle
   "Christmas" by Tunetank — Pixabay Content License
   https://pixabay.com/music/christmas-christmas-347469/
   Plays as a no-ads background loop, with a synthesized
   Jingle Bells fallback if the MP3 cannot load.
   ============================================================ */
(function () {
    'use strict';

    var TRACK_URL = 'audio/tunetank-christmas.mp3';
    var enabled = true;
    try { enabled = localStorage.getItem('lessfun_jingle') !== '0'; } catch (e) {}
    var unlocked = false;
    var playing = false;
    var audio = null;
    var audioBroken = false;
    var retryQueued = false;

    // ---- Synthesized fallback (public-domain Jingle Bells) ----
    var context = null;
    var master = null;
    var timer = 0;
    var noiseBuffer = null;
    var BPM = 140;
    var BEAT = 60 / BPM;
    var MELODY = [
        [76, 1], [76, 1], [76, 1], [76, 1],
        [76, 1], [79, 1], [72, 1], [74, 1],
        [77, 1], [77, 1], [77, 1], [77, 1],
        [77, 1], [76, 1], [76, 1], [76, 1],
        [76, 1], [74, 1], [74, 1], [76, 1],
        [74, 2], [67, 2]
    ];
    var BASS = [36, 36, 41, 36, 43, 43];
    var LOOP_BEATS = 24;

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
            master.gain.value = 0.2;
            var comp = context.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.knee.value = 18;
            comp.ratio.value = 4;
            comp.attack.value = 0.004;
            comp.release.value = 0.18;
            master.connect(comp);
            comp.connect(context.destination);
            var length = context.sampleRate * 1.0;
            noiseBuffer = context.createBuffer(1, length, context.sampleRate);
            var data = noiseBuffer.getChannelData(0);
            for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
            return true;
        } catch (e) {
            context = null;
            master = null;
            return false;
        }
    }

    function brass(time, note, duration, volume) {
        var freq = midi(note);
        var out = context.createGain();
        var filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, time);
        filter.frequency.exponentialRampToValueAtTime(1400, time + duration);
        filter.Q.value = 1.1;
        out.gain.setValueAtTime(0.0001, time);
        out.gain.exponentialRampToValueAtTime(volume || 0.16, time + 0.012);
        out.gain.setValueAtTime(volume || 0.16, time + Math.max(0.04, duration * 0.55));
        out.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.07);
        filter.connect(out);
        out.connect(master);

        var a = context.createOscillator();
        a.type = 'sawtooth';
        a.frequency.setValueAtTime(freq, time);
        a.detune.setValueAtTime(-5, time);
        var b = context.createOscillator();
        b.type = 'square';
        b.frequency.setValueAtTime(freq, time);
        b.detune.setValueAtTime(6, time);
        var bg = context.createGain();
        bg.gain.value = 0.36;
        a.connect(filter);
        b.connect(bg);
        bg.connect(filter);
        a.start(time);
        b.start(time);
        a.stop(time + duration + 0.09);
        b.stop(time + duration + 0.09);
    }

    function chime(time, note, volume) {
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(midi(note + 12), time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume || 0.045, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.36);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + 0.4);
    }

    function bassNote(time, note, duration) {
        var osc = context.createOscillator();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(midi(note), time);
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        filter.Q.value = 0.8;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.13, time + 0.015);
        gain.gain.setValueAtTime(0.13, time + Math.max(0.05, duration * 0.5));
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(filter);
        filter.connect(gain);
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
        filter.frequency.value = 6800;
        filter.Q.value = 1.4;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume || 0.035, time + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(time);
        src.stop(time + 0.09);
    }

    function kick(time) {
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(44, time + 0.16);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.16, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + 0.22);
    }

    function snare(time) {
        if (!noiseBuffer) return;
        var src = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 1500;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.075, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(time);
        src.stop(time + 0.13);
    }

    function scheduleLoop() {
        if (!context || !master || !playing) return;
        var start = context.currentTime + 0.06;
        var beatCursor = 0;

        for (var i = 0; i < MELODY.length; i++) {
            var note = MELODY[i];
            var t = start + beatCursor * BEAT;
            brass(t, note[0], note[1] * BEAT * 0.92, i % 4 === 0 ? 0.18 : 0.14);
            chime(t, note[0], 0.045);
            beatCursor += note[1];
        }

        for (var b = 0; b < BASS.length; b++) {
            bassNote(start + b * 4 * BEAT, BASS[b], BEAT * 3.4);
        }

        for (var beat = 0; beat < LOOP_BEATS; beat++) {
            var bt = start + beat * BEAT;
            if (beat % 4 === 0 || beat % 4 === 2) kick(bt);
            if (beat % 4 === 1 || beat % 4 === 3) snare(bt);
            sleigh(bt, 0.045);
            sleigh(bt + BEAT * 0.5, 0.022);
        }

        timer = setTimeout(scheduleLoop, LOOP_BEATS * BEAT * 1000 - 90);
    }

    // ---- MP3 track ----
    function ensureAudio() {
        if (audio) return audio;
        if (typeof Audio !== 'function') return null;
        audio = new Audio();
        audio.src = TRACK_URL;
        audio.loop = true;
        audio.preload = 'none';
        audio.volume = 0.65;
        audio.setAttribute('playsinline', '');
        audio.addEventListener('error', function () {
            audioBroken = true;
            if (playing) startSynth();
        });
        return audio;
    }

    function startSynth() {
        if (!ensureContext()) return;
        if (context.state === 'suspended') {
            try { context.resume(); } catch (e) {}
        }
        if (master) master.gain.value = 0.2;
        if (timer) { clearTimeout(timer); timer = 0; }
        scheduleLoop();
    }

    function playTrack() {
        var el = ensureAudio();
        if (!el) { audioBroken = true; return; }
        audioBroken = false;
        var attempt;
        try { attempt = el.play(); } catch (e) { audioBroken = true; return; }
        if (!attempt || typeof attempt.then !== 'function') {
            playing = true;
            updateButton();
            return;
        }
        attempt.then(function () {
            playing = true;
            updateButton();
        }).catch(function (err) {
            playing = false;
            updateButton();
            var name = err && err.name;
            if (name === 'NotSupportedError' || name === 'NotReadableError') {
                audioBroken = true;
                playing = true;
                startSynth();
                updateButton();
            } else {
                queueRetry();
            }
        });
    }

    function queueRetry() {
        if (retryQueued) return;
        retryQueued = true;
        var retry = function () {
            retryQueued = false;
            document.removeEventListener('pointerdown', retry);
            document.removeEventListener('keydown', retry);
            if (enabled && isHoliday() && !playing) start();
        };
        document.addEventListener('pointerdown', retry, { passive: true });
        document.addEventListener('keydown', retry);
    }

    function start() {
        if (!enabled || !isHoliday() || playing) return;
        if (!unlocked) return;
        if (audioBroken) {
            startSynth();
            playing = true;
            updateButton();
            return;
        }
        playTrack();
    }

    function stop() {
        playing = false;
        if (audio) {
            try { audio.pause(); } catch (e) {}
        }
        if (timer) { clearTimeout(timer); timer = 0; }
        if (master) master.gain.value = 0.0001;
        updateButton();
    }

    function updateButton() {
        var btn = document.getElementById('jingleBtn');
        if (!btn) return;
        btn.textContent = 'Jingle: ' + (enabled ? (playing ? 'On' : 'Ready') : 'Off');
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    function syncToggle() {
        var box = document.getElementById('jingleToggle');
        if (box) box.checked = enabled;
    }

    function setEnabled(on) {
        enabled = !!on;
        try { localStorage.setItem('lessfun_jingle', enabled ? '1' : '0'); } catch (e) {}
        syncToggle();
        if (enabled) {
            unlocked = true;
            start();
        } else {
            stop();
        }
        updateButton();
    }

    function toggle() {
        setEnabled(!enabled);
    }

    function unlock() {
        unlocked = true;
        if (enabled) start();
    }

    function init() {
        syncToggle();
        updateButton();
        if (!isHoliday()) return;
        // Browsers only allow audible autoplay after a gesture.
        document.addEventListener('pointerdown', unlock, { once: true, passive: true });
        document.addEventListener('keydown', unlock, { once: true });
        // The MP3 keeps playing while the tab is hidden; restart if the
        // browser suspended it for any reason when we return.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && enabled && unlocked && !playing) start();
        });
    }

    function status() {
        return {
            enabled: enabled,
            playing: playing,
            source: audioBroken ? 'synth' : 'mp3',
            time: audio ? audio.currentTime : 0
        };
    }

    window.LessFunJingle = { toggle: toggle, start: start, stop: stop, setEnabled: setEnabled, status: status };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
