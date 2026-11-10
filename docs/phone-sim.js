/* LessFun — Phone Simulator · iPhone 18 Pro demo */
(function (global) {
    'use strict';

    var STYLE_ID = 'phoneSimStyles';
    var root = null;
    var container = null;
    var clockTimer = 0;
    var appTimer = 0;
    var state = { unlocked: false, app: '', island: false, playing: false, flash: false, toggles: {} };

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.ps-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:clamp(28px,7vw,110px);overflow:hidden;background:radial-gradient(circle at 68% 34%,rgba(0,120,190,.20),transparent 38%),radial-gradient(circle at 28% 76%,rgba(140,70,255,.14),transparent 42%),linear-gradient(135deg,#05070c 0%,#080e17 52%,#030508 100%);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;color:#eafaff}
.ps-stage:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at center,#000 0 38%,transparent 78%);pointer-events:none}
.ps-copy{position:relative;z-index:3;max-width:340px;padding:24px}
.ps-copy span{display:inline-block;color:#5fe7ff;font-size:10px;font-weight:900;letter-spacing:.24em;text-transform:uppercase;margin-bottom:13px}
.ps-copy h2{font-size:clamp(30px,4vw,52px);line-height:.95;letter-spacing:-.055em;margin:0 0 14px;color:#f4f8fb;text-shadow:0 0 42px rgba(95,231,255,.15)}
.ps-copy p{color:rgba(214,236,248,.55);font-size:13px;line-height:1.6;margin:0 0 18px;max-width:280px}
.ps-demo-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(255,209,102,.35);border-radius:999px;background:rgba(255,209,102,.08);color:#ffe2a0;font-size:9px;font-weight:900;letter-spacing:.14em}
.ps-demo-badge i{width:6px;height:6px;border-radius:50%;background:#ffcf4d;box-shadow:0 0 9px #ffcf4d}
.ps-phone{position:relative;z-index:2;height:min(82vh,790px);max-height:790px;aspect-ratio:393/852;flex:0 0 auto;filter:drop-shadow(0 40px 80px rgba(0,0,0,.65))}
.ps-frame{position:absolute;inset:0;border-radius:58px;padding:9px;background:linear-gradient(145deg,#b9a88e 0%,#4c4a47 13%,#1b1d20 36%,#8d8477 55%,#222529 78%,#5e5d5a 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),inset 0 0 0 4px rgba(0,0,0,.48),0 0 0 1px rgba(0,0,0,.9);animation:psHover 7s ease-in-out infinite}
@keyframes psHover{0%,100%{transform:rotate(-1.1deg) translateY(0)}50%{transform:rotate(1.1deg) translateY(-7px)}}
.ps-screen{position:relative;width:100%;height:100%;border-radius:49px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.ps-wallpaper{position:absolute;inset:0;background:radial-gradient(circle at 70% 28%,rgba(255,134,75,.28),transparent 24%),radial-gradient(circle at 28% 70%,rgba(61,119,255,.25),transparent 38%),linear-gradient(155deg,#12172b 0%,#090d18 45%,#020307 100%)}
.ps-wallpaper:after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.10),transparent 30%),radial-gradient(circle at 50% 103%,rgba(95,231,255,.18),transparent 38%)}
.ps-status{position:absolute;top:15px;left:24px;right:24px;z-index:12;display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;letter-spacing:.01em;color:#fff;pointer-events:none}
.ps-status-right{display:flex;align-items:center;gap:6px}
.ps-signal{display:flex;align-items:flex-end;gap:2px;height:9px}.ps-signal i{display:block;width:2.5px;border-radius:2px;background:#fff}.ps-signal i:nth-child(1){height:3px}.ps-signal i:nth-child(2){height:5px}.ps-signal i:nth-child(3){height:7px}.ps-signal i:nth-child(4){height:9px}
.ps-wifi{font-size:11px;line-height:1}.ps-battery{width:22px;height:10px;border:1px solid rgba(255,255,255,.82);border-radius:3px;position:relative;padding:1px}.ps-battery:after{content:"";position:absolute;right:-3px;top:3px;width:2px;height:4px;border-radius:0 2px 2px 0;background:rgba(255,255,255,.7)}.ps-battery i{display:block;height:100%;width:78%;border-radius:1.5px;background:#fff}
.ps-island{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:20;width:106px;height:31px;border-radius:999px;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.035);transition:width .32s cubic-bezier(.22,1,.36,1),height .32s,border-radius .32s;overflow:hidden;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.5)}
.ps-island:after{content:"";width:36px;height:4px;border-radius:99px;background:#05070a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
.ps-island.is-open{width:218px;height:52px;border-radius:27px;padding:0 13px;justify-content:flex-start}
.ps-island.is-open:after{display:none}.ps-island .ps-island-title{display:none;font-size:8px;font-weight:900;letter-spacing:.06em;white-space:nowrap}.ps-island.is-open .ps-island-title{display:block}.ps-island .ps-island-dot{display:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(145deg,#ff375f,#ff8b3d);box-shadow:0 0 12px rgba(255,55,95,.55)}.ps-island.is-open .ps-island-dot{display:block}
.ps-lock{position:absolute;inset:0;z-index:8;padding:85px 27px 34px;display:flex;flex-direction:column;transition:opacity .34s,transform .34s;cursor:pointer}
.ps-lock.is-hidden{opacity:0;transform:translateY(-34px);pointer-events:none}
.ps-lock-date{color:rgba(255,255,255,.62);font-size:12px;font-weight:700;text-align:center;letter-spacing:.03em}.ps-lock-time{text-align:center;font-size:82px;font-weight:250;letter-spacing:-.075em;line-height:.92;color:#fff;margin-top:3px;text-shadow:0 4px 30px rgba(0,0,0,.35)}
.ps-lock-widgets{margin-top:auto;display:flex;justify-content:space-between;gap:11px}.ps-lock-widget{flex:1;min-height:76px;padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(17,24,36,.48);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.ps-lock-widget small{display:block;color:#8fd8ff;font-size:7px;font-weight:900;letter-spacing:.12em;margin-bottom:8px}.ps-lock-widget strong{display:block;color:#fff;font-size:19px;font-weight:800;letter-spacing:-.04em}.ps-lock-widget span{display:block;color:rgba(255,255,255,.45);font-size:8px;margin-top:3px}
.ps-lock-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:18px;color:rgba(255,255,255,.61);font-size:8px;font-weight:700;letter-spacing:.06em}.ps-lock-bottom span{display:flex;align-items:center;gap:5px}.ps-lock-circle{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:14px;color:#fff}
.ps-unlock-hint{text-align:center;color:rgba(255,255,255,.46);font-size:9px;font-weight:700;margin-top:16px;animation:psHint 2.1s ease-in-out infinite}@keyframes psHint{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:.9;transform:translateY(-3px)}}
.ps-home{position:absolute;inset:0;z-index:7;padding:72px 22px 26px;display:flex;flex-direction:column;opacity:0;transform:scale(1.04);pointer-events:none;transition:opacity .3s,transform .3s}.ps-home.is-visible{opacity:1;transform:scale(1);pointer-events:auto}
.ps-home-widgets{display:grid;grid-template-columns:1.15fr .85fr;gap:10px;margin-bottom:16px}.ps-widget{border-radius:21px;border:1px solid rgba(255,255,255,.10);background:rgba(13,20,32,.56);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);padding:14px;min-height:104px}
.ps-widget.big{background:linear-gradient(145deg,rgba(41,58,92,.76),rgba(11,16,28,.74))}.ps-widget small{color:#8fd8ff;font-size:7px;font-weight:900;letter-spacing:.14em}.ps-widget strong{display:block;color:#fff;font-size:31px;font-weight:700;letter-spacing:-.07em;margin-top:6px}.ps-widget span{display:block;color:rgba(255,255,255,.48);font-size:8px;margin-top:3px}.ps-widget .ps-widget-row{display:flex;align-items:center;justify-content:space-between}.ps-weather-icon{font-size:25px;line-height:1}
.ps-app-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:17px 11px}.ps-app{background:none;border:0;padding:0;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}
.ps-app-icon{width:54px;height:54px;border-radius:15px;display:grid;place-items:center;font-size:25px;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 18px rgba(0,0,0,.28);transition:transform .16s}.ps-app:hover .ps-app-icon,.ps-app:active .ps-app-icon{transform:scale(1.08)}
.ps-app span:last-child{font-size:8px;font-weight:600;color:rgba(255,255,255,.72);letter-spacing:.01em;white-space:nowrap}.ps-app[data-app="phone"] .ps-app-icon{background:linear-gradient(145deg,#7dff8a,#18b83a)}.ps-app[data-app="safari"] .ps-app-icon{background:linear-gradient(145deg,#50c8ff,#1168ff)}.ps-app[data-app="messages"] .ps-app-icon{background:linear-gradient(145deg,#7dff8a,#12bb4a)}.ps-app[data-app="camera"] .ps-app-icon{background:linear-gradient(145deg,#b7bcc6,#424952)}.ps-app[data-app="photos"] .ps-app-icon{background:linear-gradient(145deg,#ffd45b,#ff5b8c 48%,#7c5cff)}.ps-app[data-app="music"] .ps-app-icon{background:linear-gradient(145deg,#ff5c76,#d70b36)}.ps-app[data-app="settings"] .ps-app-icon{background:linear-gradient(145deg,#c9d1da,#596572)}.ps-app[data-app="weather"] .ps-app-icon{background:linear-gradient(145deg,#5fcfff,#1367d8)}.ps-app[data-app="maps"] .ps-app-icon{background:linear-gradient(145deg,#d7ffe0,#45bb72)}.ps-app[data-app="clock"] .ps-app-icon{background:linear-gradient(145deg,#f4f7fb,#1e2733)}
.ps-dock{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:11px;padding:10px 13px;border-radius:27px;background:rgba(15,22,35,.52);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08)}.ps-dock .ps-app-icon{width:49px;height:49px;border-radius:13px}.ps-dock .ps-app span:last-child{display:none}
.ps-home-bar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:118px;height:4px;border-radius:99px;background:rgba(255,255,255,.46);z-index:30;pointer-events:none}
.ps-appview{position:absolute;inset:0;z-index:40;background:linear-gradient(155deg,#111827,#05070c);transform:translateY(100%);opacity:0;pointer-events:none;transition:transform .36s cubic-bezier(.2,1,.3,1),opacity .22s;overflow:hidden;display:flex;flex-direction:column}.ps-appview.is-open{transform:translateY(0);opacity:1;pointer-events:auto}
.ps-app-head{display:flex;align-items:center;gap:11px;padding:53px 18px 13px;border-bottom:1px solid rgba(255,255,255,.07);flex:0 0 auto}.ps-app-back{width:31px;height:31px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:18px;cursor:pointer}.ps-app-head strong{font-size:14px;letter-spacing:-.02em}.ps-app-head small{display:block;color:rgba(255,255,255,.34);font-size:8px;font-weight:700;letter-spacing:.12em;margin-top:2px}
.ps-app-body{flex:1;overflow:auto;padding:20px 20px 35px}.ps-app-body::-webkit-scrollbar{width:0}.ps-card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:17px;margin-bottom:13px}.ps-card small{color:rgba(255,255,255,.42);font-size:8px;font-weight:800;letter-spacing:.12em}.ps-card h3{font-size:20px;margin:6px 0 4px;font-weight:750;letter-spacing:-.045em}.ps-card p{font-size:11px;line-height:1.55;color:rgba(255,255,255,.54);margin:0}.ps-big-clock{color:#fff;font-size:52px;font-weight:250;letter-spacing:-.08em;line-height:1;margin:8px 0}.ps-dialer-display{min-height:52px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:300;letter-spacing:.08em;color:#fff;margin-bottom:18px}.ps-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.ps-key{height:55px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.075);color:#fff;font:inherit;font-size:19px;font-weight:500;cursor:pointer}.ps-key small{display:block;font-size:7px;letter-spacing:.16em;color:rgba(255,255,255,.35)}.ps-call{width:54px;height:39px;border-radius:999px;border:0;background:#2ed36b;color:#04150a;font:inherit;font-size:18px;margin:18px auto 0;display:block;cursor:pointer}
.ps-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.065)}.ps-toggle-row:last-child{border-bottom:0}.ps-toggle-row strong{display:block;font-size:11px}.ps-toggle-row small{display:block;color:rgba(255,255,255,.35);font-size:8px;margin-top:3px}.ps-switch{width:38px;height:22px;border-radius:999px;border:0;background:rgba(255,255,255,.14);position:relative;cursor:pointer;flex:0 0 auto;transition:background .2s}.ps-switch:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}.ps-switch.is-on{background:#2ed36b}.ps-switch.is-on:after{transform:translateX(16px)}
.ps-camera{position:relative;flex:1;background:radial-gradient(circle at 50% 40%,#182431,#020306 72%);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px 20px 25px}.ps-camera:before{content:"";position:absolute;inset:20px;border:1px solid rgba(255,255,255,.08);border-radius:18px;pointer-events:none}.ps-camera-frame{width:84%;aspect-ratio:3/4;border-radius:15px;background:linear-gradient(155deg,#1d3047,#060a12 70%);border:1px solid rgba(255,255,255,.1);position:relative;overflow:hidden}.ps-camera-frame:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 55% 42%,rgba(255,164,75,.22),transparent 28%)}.ps-camera-controls{display:flex;align-items:center;justify-content:center;gap:22px;z-index:2}.ps-shutter{width:59px;height:59px;border-radius:50%;border:4px solid #fff;background:transparent;cursor:pointer}.ps-shutter:active{background:#fff}.ps-camera-mode{color:#ffcf4d;font-size:9px;font-weight:900;letter-spacing:.12em}.ps-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5}.ps-camera.is-flashing .ps-flash{animation:psFlash .28s ease-out}@keyframes psFlash{0%{opacity:.95}100%{opacity:0}}
.ps-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.ps-photo{aspect-ratio:1;border-radius:5px;background:linear-gradient(135deg,#ff9a5b,#6a3dff 55%,#06d6a0)}.ps-photo:nth-child(2n){background:linear-gradient(135deg,#5fe7ff,#0a4aff 60%,#ff53b6)}.ps-photo:nth-child(3n){background:linear-gradient(135deg,#ffd166,#ff5d5d 60%,#4b0e2b)}.ps-photo:nth-child(5n){background:linear-gradient(135deg,#a8ff60,#0b7f46 60%,#00225c)}
.ps-music-art{height:195px;border-radius:20px;background:linear-gradient(145deg,#ff5678,#5c1fff 52%,#061b55);position:relative;overflow:hidden;margin-bottom:18px}.ps-music-art:after{content:"";position:absolute;inset:16px;border:1px solid rgba(255,255,255,.22);border-radius:50%;transform:scale(.8)}.ps-music-title{font-size:21px;font-weight:800;letter-spacing:-.04em;margin:0}.ps-music-artist{font-size:11px;color:rgba(255,255,255,.45);margin:5px 0 20px}.ps-player-controls{display:flex;align-items:center;justify-content:center;gap:24px;font-size:23px}.ps-play{width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#05070c;font:inherit;font-size:19px;cursor:pointer}.ps-safari-search{height:37px;border-radius:13px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.075);display:flex;align-items:center;padding:0 12px;color:rgba(255,255,255,.4);font-size:10px;margin-bottom:15px}.ps-safari-site{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:11px}.ps-safari-site span:last-child{color:rgba(255,255,255,.34);font-size:8px}.ps-big-weather{font-size:54px;font-weight:200;letter-spacing:-.08em;margin:9px 0 0}.ps-msg{padding:11px 13px;border-radius:16px;background:rgba(95,231,255,.12);border:1px solid rgba(95,231,255,.13);font-size:10px;line-height:1.45;margin-bottom:8px;max-width:85%}.ps-msg.me{margin-left:auto;background:rgba(46,211,107,.17);border-color:rgba(46,211,107,.18)}
.ps-note{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:5;padding:7px 13px;border-radius:999px;background:rgba(3,10,16,.7);border:1px solid rgba(255,255,255,.09);color:rgba(220,240,250,.56);font-size:8px;text-align:center;white-space:nowrap;pointer-events:none}
@media (max-width:900px){.ps-copy{display:none}.ps-stage{gap:0}.ps-phone{height:min(80vh,720px)}.ps-note{bottom:10px}}
@media (max-width:560px){.ps-phone{height:min(78vh,680px)}.ps-app-icon{width:47px;height:47px;border-radius:13px;font-size:22px}.ps-dock .ps-app-icon{width:43px;height:43px}.ps-app-grid{gap:14px 8px}.ps-home{padding-left:16px;padding-right:16px}.ps-widget strong{font-size:26px}}
`;
        document.head.appendChild(style);
    }

    function timeText() {
        var d = new Date();
        var h = d.getHours(), m = d.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + (m < 10 ? '0' : '') + m;
    }
    function dateText() {
        return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    function updateClock() {
        if (!root) return;
        var t = root.querySelectorAll('[data-ps-time]');
        for (var i = 0; i < t.length; i++) t[i].textContent = timeText();
        var d = root.querySelector('[data-ps-date]');
        if (d) d.textContent = dateText();
    }

    function homeMarkup() {
        var apps = [
            ['phone', '☎', 'Phone', 'Phone'],
            ['safari', '◉', 'Safari', 'Safari'],
            ['messages', '✉', 'Messages', 'Messages'],
            ['camera', '◐', 'Camera', 'Camera'],
            ['photos', '✿', 'Photos', 'Photos'],
            ['music', '♫', 'Music', 'Music'],
            ['settings', '⚙', 'Settings', 'Settings'],
            ['weather', '☾', 'Weather', 'Weather'],
            ['maps', '⌖', 'Maps', 'Maps'],
            ['clock', '◷', 'Clock', 'Clock']
        ];
        return '<div class="ps-home-widgets">' +
            '<div class="ps-widget big"><small>REDLINE GT</small><strong data-ps-time>9:41</strong><span>Drive night city · online</span><div class="ps-widget-row" style="margin-top:12px"><span style="margin:0;color:#5fe7ff">LIVE</span><span style="margin:0;color:rgba(255,255,255,.4)">3.2 km</span></div></div>' +
            '<div class="ps-widget"><div class="ps-widget-row"><small>NIGHT</small><span class="ps-weather-icon">☾</span></div><strong style="font-size:26px">19°</strong><span>Clear · feels 18°</span></div>' +
        '</div>' +
        '<div class="ps-app-grid">' + apps.map(function (a) {
            return '<button class="ps-app" data-app="' + a[3].toLowerCase() + '" type="button"><span class="ps-app-icon">' + a[1] + '</span><span>' + a[2] + '</span></button>';
        }).join('') + '</div>' +
        '<div class="ps-dock">' + apps.slice(0, 4).map(function (a) {
            return '<button class="ps-app" data-app="' + a[3].toLowerCase() + '" type="button"><span class="ps-app-icon">' + a[1] + '</span><span>' + a[2] + '</span></button>';
        }).join('') + '</div>';
    }

    function appMarkup(name) {
        if (name === 'phone') return '<div class="ps-dialer-display" id="psDial">—</div><div class="ps-keypad">' +
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(function (k) {
                return '<button class="ps-key" data-dial="' + k + '" type="button">' + k + '<small>' + (k === '0' ? '+' : '') + '</small></button>';
            }).join('') + '</div><button class="ps-call" type="button" data-call>☎</button>';
        if (name === 'settings') {
            var rows = [
                ['airplane', 'Airplane Mode', 'Off', false],
                ['wifi', 'Wi‑Fi', 'Redline‑5G', true],
                ['bluetooth', 'Bluetooth', 'On', true],
                ['dark', 'Dark Mode', 'Always on', true],
                ['focus', 'Focus', 'Night drive', false]
            ];
            return '<div class="ps-card"><small>CONNECTIVITY</small><h3>Settings</h3><p>iPhone 18 Pro demo · iOS 27</p></div>' +
                rows.map(function (r) {
                    return '<div class="ps-toggle-row"><div><strong>' + r[1] + '</strong><small>' + r[2] + '</small></div><button class="ps-switch' + (r[3] ? ' is-on' : '') + '" type="button" data-toggle="' + r[0] + '" aria-label="' + r[1] + '"></button></div>';
                }).join('');
        }
        if (name === 'camera') return '<div class="ps-camera is-flashing"><div class="ps-flash"></div><div class="ps-camera-mode">NIGHT MODE · 24 MM</div><div class="ps-camera-frame"></div><div class="ps-camera-controls"><span style="color:rgba(255,255,255,.5);font-size:9px">1×</span><button class="ps-shutter" type="button" data-shutter aria-label="Take photo"></button><span style="color:rgba(255,255,255,.5);font-size:9px">2×</span></div></div>';
        if (name === 'photos') return '<div class="ps-card"><small>RECENTS</small><h3>Night drive</h3><p>24 photos · Redline GT</p></div><div class="ps-photo-grid">' + Array(18).join('<div class="ps-photo"></div>') + '</div>';
        if (name === 'music') return '<div class="ps-music-art"></div><h3 class="ps-music-title">Night Runner</h3><p class="ps-music-artist">Redline GT · Synthetic Coast</p><div class="ps-player-controls"><span>⏮</span><button class="ps-play" type="button" data-play>▶</button><span>⏭</span></div>';
        if (name === 'safari') return '<div class="ps-safari-search">Search or enter website</div><div class="ps-safari-site"><span>redline.gt</span><span>OPEN</span></div><div class="ps-safari-site"><span>lessfun arcade</span><span>ONLINE</span></div><div class="ps-safari-site"><span>night city radio</span><span>LIVE</span></div><div class="ps-card" style="margin-top:18px"><small>START PAGE</small><h3>Good evening.</h3><p>The city is quiet, the highway is glowing, and the garage is open.</p></div>';
        if (name === 'weather') return '<div class="ps-card"><small>REDLINE COAST</small><div class="ps-big-weather">19°</div><h3>Clear night</h3><p>Feels like 18° · Low 14° · Wind 8 km/h</p></div><div class="ps-card"><small>TONIGHT</small><h3>Dry roads</h3><p>Good grip. Lights are on along the coast road.</p></div>';
        return '<div class="ps-card"><small>' + name.toUpperCase() + '</small><h3>' + name.charAt(0).toUpperCase() + name.slice(1) + '</h3><p>This demo screen is coming soon.</p></div>';
    }

    function openApp(name) {
        if (!root) return;
        state.app = name;
        var view = root.querySelector('#psAppView');
        var title = root.querySelector('#psAppTitle');
        var sub = root.querySelector('#psAppSub');
        var body = root.querySelector('#psAppBody');
        if (!view || !body) return;
        if (title) title.textContent = name === 'phone' ? 'Phone' : name.charAt(0).toUpperCase() + name.slice(1);
        if (sub) sub.textContent = 'IPHONE 18 PRO · DEMO';
        body.innerHTML = appMarkup(name);
        view.classList.add('is-open');
        if (name === 'camera') {
            var cam = body.querySelector('.ps-camera');
            if (cam) {
                cam.classList.remove('is-flashing');
                appTimer = setTimeout(function () { if (cam) cam.classList.add('is-flashing'); }, 120);
            }
        }
    }
    function closeApp() {
        if (!root) return;
        var view = root.querySelector('#psAppView');
        if (view) view.classList.remove('is-open');
        state.app = '';
    }

    function bind() {
        root.addEventListener('click', function (e) {
            var island = e.target.closest('#psIsland');
            if (island) { island.classList.toggle('is-open'); return; }
            if (e.target.closest('#psLock')) {
                root.querySelector('#psLock').classList.add('is-hidden');
                root.querySelector('#psHome').classList.add('is-visible');
                state.unlocked = true;
                return;
            }
            var app = e.target.closest('[data-app]');
            if (app) { openApp(app.getAttribute('data-app')); return; }
            if (e.target.closest('[data-close-app]')) { closeApp(); return; }
            var dial = e.target.closest('[data-dial]');
            if (dial) {
                var d = root.querySelector('#psDial');
                if (d) d.textContent = (d.textContent === '—' ? '' : d.textContent) + dial.getAttribute('data-dial');
                return;
            }
            if (e.target.closest('[data-call]')) {
                var dialEl = root.querySelector('#psDial');
                if (dialEl) dialEl.textContent = 'CALLING…';
                return;
            }
            var toggle = e.target.closest('[data-toggle]');
            if (toggle) { toggle.classList.toggle('is-on'); state.toggles[toggle.getAttribute('data-toggle')] = toggle.classList.contains('is-on'); return; }
            var shutter = e.target.closest('[data-shutter]');
            if (shutter) {
                var cam = shutter.closest('.ps-camera');
                if (cam) { cam.classList.remove('is-flashing'); void cam.offsetWidth; cam.classList.add('is-flashing'); }
                return;
            }
            var play = e.target.closest('[data-play]');
            if (play) {
                state.playing = !state.playing;
                play.textContent = state.playing ? '❚❚' : '▶';
                return;
            }
            if (e.target.closest('[data-card]')) {
                root.querySelector('#psLock').classList.add('is-hidden');
                root.querySelector('#psHome').classList.add('is-visible');
                state.unlocked = true;
            }
        });
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML = '' +
            '<div class="ps-stage">' +
                '<div class="ps-copy">' +
                    '<span>LessFun Device Lab</span>' +
                    '<h2>iPhone 18 Pro</h2>' +
                    '<p>A titanium concept demo with a working home screen, apps, camera and settings.</p>' +
                    '<div class="ps-demo-badge"><i></i> DEMO BUILD · NOT AFFILIATED WITH APPLE</div>' +
                '</div>' +
                '<div class="ps-phone">' +
                    '<div class="ps-frame"><div class="ps-screen">' +
                        '<div class="ps-wallpaper"></div>' +
                        '<div class="ps-status"><span data-ps-time>9:41</span><div class="ps-status-right"><span class="ps-signal"><i></i><i></i><i></i><i></i></span><span class="ps-wifi">⌁</span><span class="ps-battery"><i></i></span></div></div>' +
                        '<div class="ps-island" id="psIsland"><span class="ps-island-dot"></span><span class="ps-island-title">Now playing · Night Runner</span></div>' +
                        '<div class="ps-lock" id="psLock">' +
                            '<div class="ps-lock-date" data-ps-date>Tuesday, November 10</div>' +
                            '<div class="ps-lock-time" data-ps-time>9:41</div>' +
                            '<div class="ps-lock-widgets">' +
                                '<div class="ps-lock-widget"><small>REDLINE GT</small><strong>READY</strong><span>Garage synced</span></div>' +
                                '<div class="ps-lock-widget"><small>WEATHER</small><strong>19°</strong><span>Clear night</span></div>' +
                            '</div>' +
                            '<div class="ps-lock-bottom"><span>◉ Flashlight</span><span>Camera ◉</span></div>' +
                            '<div class="ps-unlock-hint">Tap or swipe up to open</div>' +
                        '</div>' +
                        '<div class="ps-home" id="psHome">' + homeMarkup() + '</div>' +
                        '<div class="ps-appview" id="psAppView">' +
                            '<div class="ps-app-head"><button class="ps-app-back" type="button" data-close-app>‹</button><div><strong id="psAppTitle">App</strong><small id="psAppSub">IPHONE 18 PRO · DEMO</small></div></div>' +
                            '<div class="ps-app-body" id="psAppBody"></div>' +
                        '</div>' +
                        '<div class="ps-home-bar"></div>' +
                    '</div></div>' +
                '</div>' +
                '<div class="ps-note">Tap the lock screen · tap an app · tap the Dynamic Island</div>' +
            '</div>';
        root = el.querySelector('.ps-stage');
        bind();
        updateClock();
        clockTimer = setInterval(updateClock, 30000);
    }

    function close() {
        if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
        if (appTimer) { clearTimeout(appTimer); appTimer = 0; }
        if (container) { try { container.innerHTML = ''; } catch (e) {} }
        container = null;
        root = null;
        state = { unlocked: false, app: '', island: false, playing: false, flash: false, toggles: {} };
    }

    global.PhoneSim = { open: open, close: close };
})(window);
