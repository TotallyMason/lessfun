/* LessFun — Samsung Simulator · Galaxy S26 Ultra demo */
(function (global) {
    'use strict';

    var STYLE_ID = 'ssStyles';
    var APP_TITLES = { phoneg: 'Phone', msgd: 'Messages', settings: 'Settings', camera: 'Camera', gallery: 'Gallery', weather: 'Weather', clock: 'Clock', play: 'Play Store', cssim: 'Galaxy Store', store: 'Store', google: 'Google', chrome: 'Chrome' };
    var root = null;
    var container = null;
    var clockTimer = 0;
    var state = { unlocked: false, app: '', playing: false, toggles: {}, volume: 0.6, recents: [] };
    var navState = 'home';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.ss-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:clamp(28px,7vw,110px);overflow:hidden;background:radial-gradient(circle at 70% 30%,rgba(124,94,255,.20),transparent 40%),radial-gradient(circle at 24% 78%,rgba(60,150,255,.14),transparent 44%),linear-gradient(135deg,#05060d 0%,#0a0f1c 52%,#030409 100%);font-family:"SamsungOne","Roboto","Segoe UI",system-ui,-apple-system,sans-serif;color:#eaf0ff}
.ss-stage:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at center,#000 0 38%,transparent 78%);pointer-events:none}
.ss-copy{position:relative;z-index:3;max-width:340px;padding:24px}
.ss-copy span{display:inline-block;color:#8ea2ff;font-size:10px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;margin-bottom:13px}
.ss-copy h2{font-size:clamp(30px,4vw,52px);line-height:.95;letter-spacing:-.045em;margin:0 0 14px;color:#f4f6fb;text-shadow:0 0 42px rgba(142,162,255,.16)}
.ss-copy p{color:rgba(220,228,248,.55);font-size:13px;line-height:1.6;margin:0 0 18px;max-width:280px}
.ss-demo-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(142,162,255,.35);border-radius:999px;background:rgba(142,162,255,.08);color:#c3cfff;font-size:9px;font-weight:800;letter-spacing:.14em}
.ss-demo-badge i{width:6px;height:6px;border-radius:50%;background:#93a7ff;box-shadow:0 0 9px #93a7ff}
.ss-phone{position:relative;z-index:2;height:min(82vh,800px);max-height:800px;aspect-ratio:388/844;flex:0 0 auto;filter:drop-shadow(0 40px 80px rgba(0,0,0,.65))}
.ss-frame{position:absolute;inset:0;border-radius:46px;padding:7px;background:linear-gradient(150deg,#e3e6f2 0%,#8f94ab 9%,#2a2c34 30%,#c9cde0 48%,#3a3d48 72%,#a9adbf 94%,#5f6270 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset 0 0 0 3px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.9);animation:ssHover 7s ease-in-out infinite}
@keyframes ssHover{0%,100%{transform:rotate(-1deg) translateY(0)}50%{transform:rotate(1deg) translateY(-6px)}}
.ss-screen{position:relative;width:100%;height:100%;border-radius:40px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.ss-wallpaper{position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,#c9c4ff 0%,#a79df4 26%,#8477e3 48%,#5d51b8 68%,#3c3583 84%,#2a2666 100%)}
.ss-wallpaper:before{content:"";position:absolute;inset:-12%;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.5),transparent 34%);filter:blur(2px)}
.ss-wallpaper:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 62%,rgba(60,52,140,.45))}
.ss-side{position:absolute;z-index:4;width:3px;border-radius:2px;background:linear-gradient(to bottom,rgba(230,232,242,.95),rgba(70,72,84,.85))}.ss-side.ps{right:-4px;top:168px;height:96px}.ss-side.up{left:-4px;top:158px;height:40px}.ss-side.down{left:-4px;top:206px;height:40px}
.ss-status{position:absolute;top:12px;left:0;right:0;z-index:12;display:flex;justify-content:space-between;align-items:center;padding:0 20px;font-size:11.5px;font-weight:700;color:#fff}
.ss-status-right{display:flex;align-items:center;gap:5px}.ss-status-icons{display:flex;align-items:center;gap:5px;font-size:10px}
.ss-signal{display:flex;align-items:flex-end;gap:2px;height:9px}.ss-signal i{display:block;width:2.5px;border-radius:2px;background:#fff}.ss-signal i:nth-child(1){height:3px}.ss-signal i:nth-child(2){height:5px}.ss-signal i:nth-child(3){height:7px}.ss-signal i:nth-child(4){height:9px}
.ss-batt{font-size:9.5px;font-weight:800}.ss-punch{position:absolute;top:13px;left:50%;transform:translateX(-50%);z-index:14;width:11px;height:11px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#1d2733 0 22%,#04060a 60%,#000 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),0 0 5px rgba(0,0,0,.8)}
.ss-lock{position:absolute;inset:0;z-index:8;padding:64px 28px 0;display:flex;flex-direction:column;transition:opacity .34s,transform .34s;cursor:pointer}
.ss-lock.is-hidden{opacity:0;transform:translateY(-40px);pointer-events:none}
.ss-lock-top{position:absolute;top:44px;left:30px}
.ss-lock-date{color:rgba(255,255,255,.72);font-size:15px;font-weight:500}.ss-lock-time{margin-top:2px;font-size:74px;font-weight:200;letter-spacing:-.05em;line-height:.94;color:#fff}
.ss-notification{position:absolute;top:270px;left:30px;right:30px;display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:22px;background:rgba(38,32,92,.42);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.10)}
.ss-notification .ss-nt-ic{width:34px;height:34px;border-radius:50%;background:#eef0f8;display:grid;place-items:center;font-size:17px;color:#2b2f6b;flex:0 0 auto}
.ss-notification strong{display:block;color:#fff;font-size:12.5px;font-weight:700}
.ss-notification small{display:block;color:rgba(255,255,255,.62);font-size:11px;margin-top:3px;line-height:1.4}
.ss-lock-bottom{position:absolute;bottom:74px;left:0;right:0;display:flex;justify-content:space-between;padding:0 38px;color:#fff;font-size:19px}
.ss-unlock-hint{position:absolute;bottom:36px;left:0;right:0;text-align:center;color:rgba(255,255,255,.55);font-size:9.5px;font-weight:700;letter-spacing:.06em;animation:ssHint 2.1s ease-in-out infinite}@keyframes ssHint{0%,100%{opacity:.4;transform:translateY(0)}50%{opacity:.95;transform:translateY(-3px)}}
.ss-home{position:absolute;inset:0;z-index:7;padding:74px 0 52px;opacity:0;transform:scale(1.05);pointer-events:none;transition:opacity .3s,transform .3s;display:flex;flex-direction:column}
.ss-home.is-visible{opacity:1;transform:scale(1);pointer-events:auto}
.ss-brief{margin:8px 22px 14px;padding:16px 18px 14px;border-radius:26px;background:rgba(255,255,255,.80);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 8px 26px rgba(43,36,110,.28)}
.ss-brief-head{display:flex;align-items:center;gap:9px;margin-bottom:3px}.ss-brief-head .ss-cloud{width:30px;height:30px;border-radius:50%;background:#e9defa;display:grid;place-items:center;font-size:15px}
.ss-brief-head strong{font-size:17px;font-weight:800;color:#22243a;letter-spacing:-.02em}
.ss-brief p{margin:0;font-size:11px;color:#6c7086;line-height:1.45}
.ss-brief-tip{display:inline-block;margin-top:10px;padding:7px 13px;border-radius:999px;background:#e7e9f2;color:#34375a;font-size:9.5px;font-weight:700}
.ss-widgets{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 22px 15px}
.ss-widget{border-radius:24px;background:rgba(255,255,255,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:13px 15px;box-shadow:0 6px 20px rgba(43,36,110,.22)}
.ss-widget.dark{background:rgba(24,26,58,.66)}
.ss-widget small{display:block;color:rgba(255,255,255,.55);font-size:8px;font-weight:800;letter-spacing:.12em}
.ss-widget .ss-w-now{font-size:24px;font-weight:800;color:#fff;letter-spacing:-.04em;margin-top:6px}
.ss-widget.light small{color:#7a7e94}.ss-widget.light .ss-w-now{color:#262a44}
.ss-google{display:flex;align-items:center;gap:10px;margin:0 22px 18px;padding:13px 15px;border-radius:999px;background:rgba(255,255,255,.88);box-shadow:0 6px 20px rgba(43,36,110,.22)}
.ss-google .ss-g{font-weight:800;font-size:19px;letter-spacing:-.04em}.ss-g span.a{color:#4285F4}.ss-g span.b{color:#EA4335}.ss-g span.c{color:#FBBC05}.ss-g span.d{color:#4285F4}.ss-g span.e{color:#34A853}.ss-g span.f{color:#EA4335}
.ss-google em{font-style:normal;color:#8a8fa3;font-size:12px;flex:1}
.ss-google i{font-size:13px;color:#34375a}
.ss-app-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 8px;padding:0 18px}
.ss-app{background:none;border:0;padding:0;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}
.ss-app-icon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:24px;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 7px 16px rgba(20,16,60,.35);transition:transform .16s}
.ss-app:hover .ss-app-icon,.ss-app:active .ss-app-icon{transform:scale(1.07)}
.ss-app span:last-child{font-size:10px;color:rgba(255,255,255,.94);font-weight:500;text-shadow:0 1px 3px rgba(20,16,60,.5);white-space:nowrap}
.ss-app[data-app="camera"] .ss-app-icon{background:linear-gradient(145deg,#f6f7fb,#c9ccd6);color:#2b2f3e}.ss-app[data-app="camera"] .ss-app-icon u{text-decoration:none;background:linear-gradient(145deg,#333,#777);-webkit-background-clip:text;background-clip:text;color:transparent}
.ss-app[data-app="messagesg"] .ss-app-icon,.ss-app[data-app="msgd"] .ss-app-icon{background:linear-gradient(145deg,#7c86ff,#4a52d8)}
.ss-app[data-app="clock"] .ss-app-icon{background:linear-gradient(145deg,#2b2f6b,#15173a);color:#cfd3ff}
.ss-app[data-app="settings"] .ss-app-icon{background:linear-gradient(145deg,#f4f6fb,#c9cddc);color:#4a5064}
.ss-app[data-app="gallery"] .ss-app-icon{background:linear-gradient(145deg,#ffd166,#ff5d8f 55%,#7c5cff)}
.ss-app[data-app="weather"] .ss-app-icon{background:linear-gradient(145deg,#7cc2ff,#2a6ff3)}
.ss-app[data-app="play"] .ss-app-icon{background:#fff;color:#12a05e}
.ss-app[data-app="google"] .ss-app-icon{background:#fff;color:#4285F4}
.ss-app[data-app="store"] .ss-app-icon{background:linear-gradient(145deg,#8f5cff,#5a2bd8)}
.ss-app[data-app="phone"] .ss-app-icon{background:linear-gradient(145deg,#57d977,#18a83b)}
.ss-app[data-app="chrome"] .ss-app-icon{background:#fff}
.ss-dock{margin:auto auto 26px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:11px 14px;border-radius:30px;background:rgba(255,255,255,.20);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);width:fit-content}
.ss-dock .ss-app-icon{width:50px;height:50px}
.ss-dock .ss-app span:last-child{display:none}
.ss-nav{position:absolute;bottom:0;left:0;right:0;z-index:60;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 42px;color:#fff;background:transparent}
.ss-nav button{background:none;border:0;color:inherit;font:inherit;font-size:16px;cursor:pointer;padding:8px 10px;opacity:.92}
.ss-home:after{content:"";position:absolute;inset:auto 0 0 0;height:52px;background:linear-gradient(180deg,transparent,rgba(38,32,110,.28));pointer-events:none}
.ss-lock .ss-nav-style{position:absolute;bottom:0;left:0;right:0;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 42px;color:#fff;font-size:15px}
.ss-appview{position:absolute;left:0;right:0;top:0;bottom:44px;z-index:50;background:#f4f6fa;display:flex;flex-direction:column;transform:translateY(6%);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.2,1,.3,1),opacity .2s;overflow:hidden;border-radius:0}
.ss-appview.is-open{transform:translateY(0);opacity:1;pointer-events:auto}
.ss-app-head{display:flex;align-items:center;gap:11px;padding:44px 18px 12px;background:#fff;flex:0 0 auto}
.ss-app-back{width:32px;height:32px;border-radius:50%;border:0;background:#eef1f6;color:#333;font:inherit;font-size:19px;cursor:pointer}
.ss-app-head strong{font-size:16px;color:#262a3f;letter-spacing:-.01em}
.ss-app-head small{display:block;color:#8a8fa3;font-size:9px;font-weight:800;letter-spacing:.11em;margin-top:2px}
.ss-app-body{flex:1;overflow:auto;padding:18px 18px 30px}
.ss-app-body::-webkit-scrollbar{width:0}
.ss-card{background:#fff;border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 4px 16px rgba(38,42,63,.08)}
.ss-card small{color:#8a8fa3;font-size:8.5px;font-weight:800;letter-spacing:.12em}
.ss-card h3{font-size:19px;margin:6px 0 4px;color:#262a3f;font-weight:800;letter-spacing:-.03em}
.ss-card p{font-size:11.5px;line-height:1.55;color:#6c7086;margin:0}
.ss-oneui-version{display:inline-block;margin-top:9px;padding:6px 11px;border-radius:999px;background:#e8f0ff;color:#1b6ef3;font-size:9px;font-weight:800;letter-spacing:.08em}
.ss-big-clock{color:#262a3f;font-size:52px;font-weight:200;letter-spacing:-.06em;line-height:1;margin:8px 0}
.ss-dialer-display{min-height:52px;border-radius:18px;background:#eef1f6;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:300;letter-spacing:.07em;color:#262a3f;margin-bottom:17px}
.ss-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.ss-key{height:54px;border-radius:50%;border:0;background:#fff;color:#262a3f;font:inherit;font-size:19px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(38,42,63,.08)}
.ss-key small{display:block;font-size:7px;letter-spacing:.15em;color:#9aa0b0}
.ss-call{width:56px;height:40px;border-radius:999px;border:0;background:#1b6ef3;color:#fff;font:inherit;font-size:17px;margin:18px auto 0;display:block;cursor:pointer}
.ss-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #eef1f6}
.ss-toggle-row:last-child{border-bottom:0}
.ss-toggle-row strong{display:block;font-size:12px;color:#262a3f}
.ss-toggle-row small{display:block;color:#8a8fa3;font-size:9px;margin-top:3px}
.ss-switch{width:38px;height:22px;border-radius:999px;border:0;background:#d4d7e2;position:relative;cursor:pointer;flex:0 0 auto;transition:background .2s}
.ss-switch:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.ss-switch.is-on{background:#1b6ef3}
.ss-switch.is-on:after{transform:translateX(16px)}
.ss-camera{position:relative;flex:1;background:linear-gradient(160deg,#171a22,#05060a 70%);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:14px 20px 20px;top:auto}
.ss-camera:before{content:"";position:absolute;inset:12px;border:1px solid rgba(255,255,255,.08);border-radius:18px;pointer-events:none}
.ss-camera-mode{color:#93a7ff;font-size:9px;font-weight:900;letter-spacing:.12em;margin-top:6px}
.ss-camera-frame{width:82%;aspect-ratio:3/4;border-radius:16px;background:linear-gradient(155deg,#243044,#0a0e16 70%);border:1px solid rgba(255,255,255,.1);position:relative;overflow:hidden;margin:6px 0}
.ss-camera-frame:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 55% 42%,rgba(142,162,255,.25),transparent 30%)}
.ss-camera-controls{display:flex;align-items:center;justify-content:center;gap:26px;z-index:2}
.ss-shutter{width:58px;height:58px;border-radius:50%;border:0;background:#fff;cursor:pointer;box-shadow:0 0 0 3px rgba(255,255,255,.25)}
.ss-shutter:active{background:#dfe3ee}
.ss-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.ss-photo{aspect-ratio:1;border-radius:10px;background:linear-gradient(135deg,#8f5cff,#4a52d8 55%,#2a6ff3)}
.ss-photo:nth-child(2n){background:linear-gradient(135deg,#57d977,#18a83b 60%,#0d5f7a)}
.ss-photo:nth-child(3n){background:linear-gradient(135deg,#ffd166,#ff5d8d 60%,#7c5cff)}
.ss-music-art{height:190px;border-radius:24px;background:linear-gradient(145deg,#7c86ff,#3c3583 52%,#15173a);position:relative;overflow:hidden;margin-bottom:17px}
.ss-music-art:after{content:"";position:absolute;inset:15px;border:1px solid rgba(255,255,255,.22);border-radius:50%;transform:scale(.8)}
.ss-music-title{font-size:20px;font-weight:800;color:#262a3f;letter-spacing:-.03em;margin:0}
.ss-music-artist{font-size:11px;color:#8a8fa3;margin:5px 0 19px}
.ss-player-controls{display:flex;align-items:center;justify-content:center;gap:24px;font-size:22px;color:#262a3f}
.ss-play{width:48px;height:48px;border-radius:50%;border:0;background:#1b6ef3;color:#fff;font:inherit;font-size:18px;cursor:pointer}
.ss-quickpill{display:flex;align-items:center;gap:9px;margin:3px 22px 14px;padding:10px 14px;border-radius:999px;background:rgba(24,26,58,.55);color:#fff;font-size:10.5px;font-weight:700;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);width:fit-content}
.ss-quickpill i{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:12px}
.ss-quickpill u{text-decoration:none;color:#b9c1ff}
.ss-chip{display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-radius:18px;background:#fff;margin-bottom:9px;box-shadow:0 3px 12px rgba(38,42,63,.07);font-size:11.5px;color:#262a3f}
.ss-chip b{font-weight:800}
.ss-note{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:5;padding:7px 13px;border-radius:999px;background:rgba(3,6,16,.7);border:1px solid rgba(255,255,255,.09);color:rgba(222,230,250,.56);font-size:8px;text-align:center;white-space:nowrap;pointer-events:none}
.ss-recents{position:absolute;inset:0;z-index:70;background:rgba(12,10,38,.74);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:none;flex-direction:column;padding:60px 18px 58px;border-radius:0}
.ss-recents.is-visible{display:flex}
.ss-recents-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;color:#fff}
.ss-recents-head strong{font-size:15px;font-weight:800;letter-spacing:-.02em}
.ss-recents-head button{border:0;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:9px;font-weight:800;padding:7px 12px;border-radius:999px;cursor:pointer;letter-spacing:.08em}
.ss-recents-empty{color:rgba(255,255,255,.5);font-size:11px;text-align:center;padding:34px 0}
.ss-rc-card{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.08);color:#fff;margin-bottom:10px;cursor:pointer}
.ss-rc-card i{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:15px;flex:0 0 auto}
.ss-rc-card strong{font-size:12.5px;font-weight:700}
.ss-rc-card small{display:block;color:rgba(255,255,255,.5);font-size:9px;margin-top:2px;letter-spacing:.08em}
.ss-volume{position:absolute;right:24px;top:300px;z-index:75;width:34px;height:96px;border-radius:999px;background:rgba(24,26,58,.88);color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 22px rgba(0,0,0,.4)}
.ss-volume.is-visible{display:flex}
.ss-volume b{font-size:9.5px;font-weight:800}
.ss-volume i{width:5px;border-radius:3px;background:#8ea2ff;display:block;transition:height .15s}
.ss-side{cursor:pointer}.ss-side.ps{cursor:pointer}
.ss-tile-badge{display:inline-block;margin-top:2px;color:#8a8fa3;font-size:8.5px;font-weight:800;letter-spacing:.1em}
@media (max-width:900px){.ss-copy{display:none}.ss-stage{gap:0}.ss-phone{height:min(80vh,720px)}.ss-note{bottom:10px}}
@media (max-width:560px){.ss-phone{height:min(78vh,680px)}.ss-app-icon{width:46px;height:46px;font-size:21px}.ss-dock .ss-app-icon{width:42px;height:42px}.ss-app-grid{gap:14px 6px}}
`;
        document.head.appendChild(style);
    }

    function timeText() {
        var d = new Date();
        var h = d.getHours(), m = d.getMinutes();
        return h + ':' + (m < 10 ? '0' : '') + m;
    }
    function dateText() {
        return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    function updateClock() {
        if (!root) return;
        var t = root.querySelectorAll('[data-ss-time]');
        for (var i = 0; i < t.length; i++) t[i].textContent = timeText();
        var d = root.querySelector('[data-ss-date]');
        if (d) d.textContent = dateText();
    }

    function appMarkup(name) {
        if (name === 'phoneg') return '<div class="ss-dialer-display" id="ssDial">—</div><div class="ss-keypad">' +
            ['1','2','3','4','5','6','7','8','9','*','0','#'].map(function (k) {
                return '<button class="ss-key" data-dial="' + k + '" type="button">' + k + '<small>' + (k === '0' ? '+' : '') + '</small></button>';
            }).join('') + '</div><button class="ss-call" type="button" data-call>☎</button>';
        if (name === 'settings') {
            var rows = [
                ['wifi', 'Wi‑Fi', 'Redline‑5G connected', true],
                ['bt', 'Bluetooth', 'On', true],
                ['dark', 'Dark mode', 'Off', false],
                ['nav', 'Navigation bar type', '3‑button (this demo)', true],
                ['bixby', 'Smart assistant', 'On', true]
            ];
            return '<div class="ss-card"><small>S26 ULTRA</small><h3>Settings</h3><p>One UI 8.5 · Android 27 · demo device</p><span class="ss-oneui-version">ONE UI 8.5</span></div>' +
                '<div class="ss-card">' + rows.map(function (r) {
                    return '<div class="ss-toggle-row"><div><strong>' + r[1] + '</strong><small>' + r[2] + '</small></div><button class="ss-switch' + (r[3] ? ' is-on' : '') + '" type="button" data-toggle="' + r[0] + '" aria-label="' + r[1] + '"></button></div>';
                }).join('') + '</div>';
        }
        if (name === 'camera') return '<div class="ss-camera" style="position:static"><div class="ss-camera-mode">50 MP · SINGLE TAKE</div><div class="ss-camera-frame"></div><div class="ss-camera-controls"><span style="color:rgba(255,255,255,.55);font-size:10px">0.6×</span><button class="ss-shutter" type="button" data-shutter aria-label="Take photo"></button><span style="color:rgba(255,255,255,.55);font-size:10px">3×</span></div></div>';
        if (name === 'gallery') return '<div class="ss-card"><small>GENERIC PHOTOS</small><h3>Albums</h3><p>32 items · last sync today</p></div><div class="ss-photo-grid">' + Array(18).join('<div class="ss-photo"></div>') + '</div>';
        if (name === 'weather') return '<div class="ss-card"><small>YONKERS</small><h3 style="font-size:34px">31°</h3><p>Clear night · feels 28° · Low 22° · Wind 11 km/h</p></div>' +
            '<div class="ss-card"><small>TONIGHT</small><h3>Dry roads</h3><p>Good grip for the S26 Ultra test drive tonight.</p></div>';
        if (name === 'clock') return '<div class="ss-card"><div class="ss-big-clock" data-ss-time>19:00</div><h3>Alarm set for tomorrow</h3><p>Two alarms · every day</p></div>' +
            '<div class="ss-chip"><span><b>07:00</b> Morning</span><button class="ss-switch is-on" type="button" data-toggle="alarm1"></button></div>' +
            '<div class="ss-chip"><span><b>09:30</b> Weekend</span><button class="ss-switch" type="button" data-toggle="alarm2"></button></div>';
        if (name === 'play') return '<div class="ss-card"><small>LEXFUN beta</small><h3>Galaxy Store &amp; Play demo</h3><p>App library is a demo placeholder. No real installs here.</p></div>' +
            '<div class="ss-chip"><span><b>LessFun Arcade</b> <span style="color:#8a8fa3">· free</span></span><span style="color:#1b6ef3;font-weight:800">OPEN</span></div>' +
            '<div class="ss-chip"><span><b>Redline GT Remote</b></span><span style="color:#1b6ef3;font-weight:800">OPEN</span></div>';
        if (name === 'google') return '<div class="ss-card"><div class="ss-google" style="margin:0;box-shadow:none;border:1px solid #eceef4"><span class="ss-g"><span class="a">G</span></span><em>Search or type URL</em><i>🎙</i></div></div>' +
            '<div class="ss-card"><small>APP SUGGESTIONS</small><h3>Try these</h3><p>Search suggestions are interactive in the full demo.</p></div>' +
            '<div class="ss-chip"><span><b>Redline GT scores</b></span><span class="ss-tile-badge">TOP RESULT</span></div>' +
            '<div class="ss-chip"><span><b>LessFun Arcade</b></span><span class="ss-tile-badge">WEBSITE</span></div>' +
            '<div class="ss-chip"><span><b>Weather Yonkers</b></span><span class="ss-tile-badge">LIVE CARD</span></div>';
        if (name === 'chrome') return '<div class="ss-card"><small>NEW TAB PAGE</small><h3>Search Google</h3><p>Chrome demo new tab.</p></div>' +
            '<div class="ss-chip"><span><b>Frequently visited</b></span></div>' +
            '<div class="ss-chip"><span>redline.gt</span><span class="ss-tile-badge">OPEN</span></div>' +
            '<div class="ss-chip"><span>lessfun arcade</span><span class="ss-tile-badge">OPEN</span></div>' +
            '<div class="ss-chip"><span>news</span><span class="ss-tile-badge">LINK</span></div>';
        if (name === 'store') return '<div class="ss-card"><small>GALAXY STORE</small><h3>Curated for S Ultra</h3><p>Store demo list is read‑only in this build.</p></div>' +
            '<div class="ss-chip"><span><b>LessFun Arcade</b></span><span style="color:#1b6ef3;font-weight:800">OPEN</span></div>' +
            '<div class="ss-chip"><span><b>Game Booster</b></span><span class="ss-tile-badge">PRELOADED</span></div>' +
            '<div class="ss-chip"><span><b>Themes</b></span><span class="ss-tile-badge">SOON</span></div>';
        if (name === 'msgd') return '<div class="ss-card"><small>MESSAGES</small><h3>LessFun Arcade</h3><p>New beta 1.34.18 is live. Refresh the site to pick it up.</p></div>' +
            '<div class="ss-chip"><span>Reply</span><span style="color:#1b6ef3;font-weight:800">SEND</span></div>' +
            '<div class="ss-chip"><span><b>Coming soon</b></span><span class="ss-tile-badge">CONVERSATIONS</span></div>';
        return '<div class="ss-card"><small>' + name.toUpperCase() + '</small><h3>' + name.charAt(0).toUpperCase() + name.slice(1) + '</h3><p>This demo screen is coming soon.</p></div>';
    }

    function recentsCard(item) {
        var icons = { phoneg: '☎', msgd: '✉', settings: '⚙', camera: '◉', gallery: '✿', weather: '☁', clock: '◷', play: '▷', cssim: '▦', store: '▣', google: 'G', chrome: '◎' };
        return '<div class="ss-rc-card" data-recent="' + item + '"><i>' + (icons[item] || '▣') + '</i><div><strong>' + (APP_TITLES[item] || item) + '</strong><small>GALAXY S26 ULTRA · DEMO · JUST NOW</small></div></div>';
    }

    function showRecents() {
        if (!root) return;
        closeApp();
        var list = root.querySelector('#ssRecentsList');
        var overlay = root.querySelector('#ssRecents');
        if (overlay) overlay.classList.add('is-visible');
        if (list) list.innerHTML = state.recents.length ? state.recents.map(recentsCard).join('') : '<div class="ss-recents-empty">No recent apps yet.</div>';
    }
    function hideRecents() {
        if (!root) return;
        var overlay = root.querySelector('#ssRecents');
        if (overlay) overlay.classList.remove('is-visible');
    }
    function goHome() {
        closeApp();
        hideRecents();
    }
    function goBack() {
        if (!root) return;
        var overlay = root.querySelector('#ssRecents');
        if (overlay && overlay.classList.contains('is-visible')) { hideRecents(); return; }
        closeApp();
    }
    function lockNow() {
        if (!root) return;
        goHome();
        root.querySelector('#ssLock').classList.remove('is-hidden');
        root.querySelector('#ssHome').classList.remove('is-visible');
        state.unlocked = false;
    }
    function unlockTo(name) {
        if (!root) return;
        root.querySelector('#ssLock').classList.add('is-hidden');
        root.querySelector('#ssHome').classList.add('is-visible');
        state.unlocked = true;
        if (name) openApp(name);
    }
    var volumeHideTimer = 0;
    function volumeOverlay() {
        if (!root) return;
        var o = root.querySelector('#ssVolume');
        if (!o) return;
        if (volumeHideTimer) { clearTimeout(volumeHideTimer); }
        o.querySelector('[data-ssvol]').textContent = String(Math.round(state.volume * 100));
        o.querySelector('i').style.height = Math.round(state.volume * 54 + 8) + 'px';
        o.classList.add('is-visible');
        volumeHideTimer = setTimeout(function () { if (o) o.classList.remove('is-visible'); }, 900);
    }
    function volumeChange(delta) {
        state.volume = Math.min(1, Math.max(0.1, state.volume + delta / 100));
        volumeOverlay();
    }

    function openApp(name) {
        if (!root) return;
        state.app = name;
        var view = root.querySelector('#ssAppView');
        var title = root.querySelector('#ssAppTitle');
        var body = root.querySelector('#ssAppBody');
        if (!view || !body) return;
        var sub = root.querySelector('#ssAppSub');
        if (title) title.textContent = APP_TITLES[name] || (name.charAt(0).toUpperCase() + name.slice(1));
        if (sub) sub.textContent = 'GALAXY S26 ULTRA · DEMO';
        body.innerHTML = appMarkup(name);
        hideRecents();
        view.classList.add('is-open');
        if (state.recents[0] !== name) {
            state.recents = [name].concat(state.recents.filter(function (n) { return n !== name; })).slice(0, 6);
        }
    }
    function closeApp() {
        if (!root) return;
        var view = root.querySelector('#ssAppView');
        if (view) view.classList.remove('is-open');
        state.app = '';
    }

    function bind() {
        root.addEventListener('click', function (e) {
            var lockSideFirst = e.target.closest('[data-lockside]');
            if (lockSideFirst) { unlockTo(lockSideFirst.getAttribute('data-lockside') === 'camera' ? 'camera' : 'phoneg'); return; }
            var lock = e.target.closest('#ssLock');
            if (lock) {
                root.querySelector('#ssLock').classList.add('is-hidden');
                root.querySelector('#ssHome').classList.add('is-visible');
                state.unlocked = true;
                return;
            }
            var app = e.target.closest('[data-app]');
            if (app && e.target.closest('.ss-home')) { openApp(app.getAttribute('data-app')); return; }
            if (e.target.closest('[data-close-appss]')) { closeApp(); return; }
            var navBtn = e.target.closest('[data-ssnav]');
            if (navBtn) {
                var which = navBtn.getAttribute('data-ssnav');
                if (which === 'recents') showRecents();
                else if (which === 'home') goHome();
                else goBack();
                return;
            }
            var sideBtn = e.target.closest('[data-ssside]');
            if (sideBtn) {
                var side = sideBtn.getAttribute('data-ssside');
                if (side === 'power') { if (state.unlocked) lockNow(); }
                else volumeChange(side === 'volup' ? +10 : -10);
                return;
            }
            var lockSide = e.target.closest('[data-lockside]');
            if (lockSide) { unlockTo(lockSide.getAttribute('data-lockside') === 'camera' ? 'camera' : 'phoneg'); return; }
            var recent = e.target.closest('[data-recent]');
            if (recent) { openApp(recent.getAttribute('data-recent')); return; }
            if (e.target.closest('[data-ssclear]')) { state.recents = []; var list2 = root.querySelector('#ssRecentsList'); if (list2) list2.innerHTML = '<div class="ss-recents-empty">No recent apps yet.</div>'; return; }
            var dial = e.target.closest('[data-dial]');
            if (dial) {
                var d = root.querySelector('#ssDial');
                if (d) d.textContent = (d.textContent === '—' ? '' : d.textContent) + dial.getAttribute('data-dial');
                return;
            }
            if (e.target.closest('[data-call]')) {
                var dialEl = root.querySelector('#ssDial');
                if (dialEl) dialEl.textContent = 'CALLING…';
                return;
            }
            var toggle = e.target.closest('[data-toggle]');
            if (toggle) { toggle.classList.toggle('is-on'); state.toggles[toggle.getAttribute('data-toggle')] = toggle.classList.contains('is-on'); return; }
            var shutter = e.target.closest('[data-shutter]');
            if (shutter) {
                var frame = root.querySelector('#ssAppView .ss-camera-frame');
                if (frame) { frame.style.transition = 'transform .15s'; frame.style.transform = 'scale(.96)'; setTimeout(function () { frame.style.transform = 'scale(1)'; }, 150); }
                return;
            }
            var play = e.target.closest('[data-play]');
            if (play) {
                state.playing = !state.playing;
                play.textContent = state.playing ? '❚❚' : '▶';
                return;
            }
        });
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML = '' +
            '<div class="ss-stage">' +
                '<div class="ss-copy">' +
                    '<span>LessFun Device Lab</span>' +
                    '<h2>Galaxy S26 Ultra</h2>' +
                    '<p>A concept demo with One UI–style home, apps, notifications, camera and settings.</p>' +
                    '<div class="ss-demo-badge"><i></i> DEMO BUILD · FAN CONCEPT · NOT AFFILIATED WITH SAMSUNG</div>' +
                '</div>' +
                '<div class="ss-phone">' +
                    '<div class="ss-side ps" data-ssside="power" title="Side key"></div><div class="ss-side up" data-ssside="volup" title="Volume up"></div><div class="ss-side down" data-ssside="voldown" title="Volume down"></div>' +
                    '<div class="ss-frame"><div class="ss-screen">' +
                        '<div class="ss-wallpaper"></div>' +
                        '<div class="ss-punch"></div>' +
                        '<div class="ss-status"><span data-ss-time>8:42</span><span class="ss-status-right"><span class="ss-status-icons">‹ ▲ ◉</span><span class="ss-signal"><i></i><i></i><i></i><i></i></span><span class="ss-batt">86%</span></span></div>' +
                        '<div class="ss-lock" id="ssLock">' +
                            '<div class="ss-lock-top"><div class="ss-lock-date" data-ss-date>Monday, November 10</div><div class="ss-lock-time" data-ss-time>8:42</div></div>' +
                            '<div class="ss-notification"><span class="ss-nt-ic">★</span><div><strong>LessFun Arcade</strong><small>Redline GT is running tonight · tap to open the garage</small></div></div>' +
                            '<div class="ss-lock-bottom"><span data-lockside="camera" title="Open Camera">◉</span><span data-lockside="phone" title="Open Phone">⌂</span></div>' +
                            '<div class="ss-unlock-hint">Tap or swipe up to unlock</div>' +
                        '</div>' +
                        '<div class="ss-home" id="ssHome">' +
                            '<div class="ss-brief"><div class="ss-brief-head"><span class="ss-cloud">☁</span><strong>Good evening</strong></div><p>Get a brief weather briefing that changes throughout the day</p><span class="ss-brief-tip">Start Now brief</span></div>' +
                            '<div class="ss-widgets">' +
                                '<div class="ss-widget dark"><small>NIGHT</small><div class="ss-w-now">31° <span style="font-size:13px;font-weight:500">Yonkers</span></div></div>' +
                                '<div class="ss-widget light"><small>START</small><div class="ss-w-now" style="color:#1b6ef3">▶ Launch</div></div>' +
                            '</div>' +
                            '<div class="ss-google"><span class="ss-g"><span>G</span></span><em>Search or type URL</em><i>🎙</i></div>' +
                            '<div class="ss-app-grid">' +
                                '<button class="ss-app" data-app="google" type="button"><span class="ss-app-icon"><span class="ss-g"><span class="a">G</span></span></span><span>Google</span></button>' +
                                '<button class="ss-app" data-app="store" type="button"><span class="ss-app-icon">▣</span><span>Store</span></button>' +
                                '<button class="ss-app" data-app="play" type="button"><span class="ss-app-icon">▷</span><span>Play Store</span></button>' +
                                '<button class="ss-app" data-app="cssim" type="button"><span class="ss-app-icon">▦</span><span>Galaxy</span></button>' +
                                '<button class="ss-app" data-app="camera" type="button"><span class="ss-app-icon"><u>◉</u></span><span>Camera</span></button>' +
                                '<button class="ss-app" data-app="gallery" type="button"><span class="ss-app-icon">✿</span><span>Gallery</span></button>' +
                                '<button class="ss-app" data-app="clock" type="button"><span class="ss-app-icon">◷</span><span>Clock</span></button>' +
                                '<button class="ss-app" data-app="weather" type="button"><span class="ss-app-icon">☁</span><span>Weather</span></button>' +
                                '<button class="ss-app" data-app="settings" type="button"><span class="ss-app-icon">⚙</span><span>Settings</span></button>' +
                                '<button class="ss-app" data-app="msgd" type="button"><span class="ss-app-icon">✉</span><span>Messages</span></button>' +
                                '<button class="ss-app" data-app="chrome" type="button"><span class="ss-app-icon">◎</span><span>Chrome</span></button>' +
                                '<button class="ss-app" data-app="phoneg" type="button"><span class="ss-app-icon">☎</span><span>Phone</span></button>' +
                            '</div>' +
                            '<div class="ss-dock">' +
                                '<button class="ss-app" data-app="phoneg" type="button"><span class="ss-app-icon">☎</span><span>Phone</span></button>' +
                                '<button class="ss-app" data-app="msgd" type="button"><span class="ss-app-icon">✉</span><span>Messages</span></button>' +
                                '<button class="ss-app" data-app="chrome" type="button"><span class="ss-app-icon">◎</span><span>Chrome</span></button>' +
                                '<button class="ss-app" data-app="camera" type="button"><span class="ss-app-icon"><u>◉</u></span><span>Camera</span></button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="ss-recents" id="ssRecents"><div class="ss-recents-head"><strong>Recent apps</strong><button type="button" data-ssclear>CLEAR ALL</button></div><div id="ssRecentsList"></div></div>' +
                        '<div class="ss-volume" id="ssVolume"><b>◉</b><i></i><b data-ssvol>60</b></div>' +
                        '<div class="ss-appview" id="ssAppView">' +
                            '<div class="ss-app-head"><button class="ss-app-back" type="button" data-close-appss>‹</button><div><strong id="ssAppTitle">App</strong><small id="ssAppSub">GALAXY S26 ULTRA · DEMO</small></div></div>' +
                            '<div class="ss-app-body" id="ssAppBody"></div>' +
                        '</div>' +
                        '<div class="ss-nav"><button type="button" data-ssnav="recents" aria-label="Recents">|||</button><button type="button" data-ssnav="home" aria-label="Home">○</button><button type="button" data-ssnav="back" aria-label="Back">‹</button></div>' +
                    '</div></div>' +
                '</div>' +
                '<div class="ss-note">Tap the lock screen · open apps · try Settings and Camera</div>' +
            '</div>';
        root = el.querySelector('.ss-stage');
        bind();
        updateClock();
        clockTimer = setInterval(updateClock, 30000);
    }

    function close() {
        if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
        if (container) { try { container.innerHTML = ''; } catch (e) {} }
        container = null;
        root = null;
        state = { unlocked: false, app: '', playing: false, toggles: {}, volume: 0.6, recents: [] };
        if (typeof volumeHideTimer !== 'undefined' && volumeHideTimer) { clearTimeout(volumeHideTimer); volumeHideTimer = 0; }
        navState = 'home';
    }

    global.SamsungSim = { open: open, close: close };
})(window);
