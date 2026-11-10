/* LessFun — iPhone Simulator · iPhone 11 Pro Max demo · iOS 27.2 */
(function (global) {
    'use strict';

    var STYLE_ID = 'ipsStyles';
    var root = null;
    var container = null;
    var clockTimer = 0;
    var bootTimers = [];
    var state = { unlocked: false, app: '', playing: false, toggles: { wifi: true, bt: true, airplane: false, flashlight: false }, volume: 0.6, brightness: 76, recents: [], ccOpen: false, asleep: false };

    var APP_TITLES = { phone: 'Phone', safari: 'Safari', messages: 'Messages', camera: 'Camera', music: 'Music', photos: 'Photos', clock: 'Clock', weather: 'Weather', settings: 'Settings', maps: 'Maps' };

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.ip-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:clamp(28px,7vw,110px);overflow:hidden;background:radial-gradient(circle at 66% 30%,rgba(214,166,110,.16),transparent 42%),radial-gradient(circle at 24% 76%,rgba(120,90,60,.12),transparent 44%),linear-gradient(135deg,#060508 0%,#12100e 50%,#050407 100%);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif;color:#f2eee8}
.ip-stage:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at center,#000 0 38%,transparent 78%);pointer-events:none}
.ip-copy{position:relative;z-index:3;max-width:340px;padding:24px}
.ip-copy span{display:inline-block;color:#d8b183;font-size:10px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;margin-bottom:13px}
.ip-copy h2{font-size:clamp(30px,4vw,52px);line-height:.95;letter-spacing:-.05em;margin:0 0 14px;color:#f6f2ea;text-shadow:0 0 42px rgba(216,177,131,.14)}
.ip-copy p{color:rgba(232,226,216,.55);font-size:13px;line-height:1.6;margin:0 0 18px;max-width:280px}
.ip-demo-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(216,177,131,.35);border-radius:999px;background:rgba(216,177,131,.08);color:#ecd6b8;font-size:9px;font-weight:800;letter-spacing:.14em}
.ip-demo-badge i{width:6px;height:6px;border-radius:50%;background:#d8b183;box-shadow:0 0 9px #d8b183}
.ip-phone{position:relative;z-index:2;height:min(82vh,800px);max-height:800px;aspect-ratio:388/844;flex:0 0 auto;filter:drop-shadow(0 40px 80px rgba(0,0,0,.65))}
.ip-frame{position:absolute;inset:0;border-radius:9.4%;padding:1.6%;background:linear-gradient(150deg,#f0ebdd 0%,#8f8b80 9%,#3e3a33 30%,#e6e0d2 48%,#4a463e 72%,#c9c4b6 94%,#6f6b61 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 0 0 3px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.9)}
.ip-screen{position:relative;width:100%;height:100%;border-radius:7.8%;overflow:hidden;background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.ip-side{position:absolute;z-index:4;width:3px;border-radius:2px;background:linear-gradient(to bottom,rgba(238,232,222,.95),rgba(88,84,74,.9));cursor:pointer}.ip-side.ps{right:-4px;top:172px;height:98px}.ip-side.up{left:-4px;top:160px;height:40px}.ip-side.down{left:-4px;top:208px;height:40px}
/* liquid-gold lock wallpaper */
.ip-wallpaper{position:absolute;inset:0;background:
 radial-gradient(ellipse 74% 56% at 22% 16%,rgba(214,168,98,.9) 0%,rgba(161,124,84,.55) 38%,transparent 70%),
 radial-gradient(ellipse 90% 70% at 78% 34%,rgba(226,218,202,.9) 0%,rgba(186,178,160,.5) 42%,transparent 72%),
 radial-gradient(ellipse 80% 60% at 70% 82%,rgba(236,228,210,.95) 0%,rgba(198,190,170,.6) 42%,transparent 74%),
 radial-gradient(ellipse 70% 52% at 16% 88%,rgba(64,40,92,.85) 0%,rgba(40,26,64,.6) 48%,transparent 76%),
 radial-gradient(ellipse 86% 74% at 40% 52%,rgba(228,204,158,.85) 0%,rgba(190,156,110,.4) 44%,transparent 72%),
 linear-gradient(196deg,#9b6a41 0%,#b98a56 24%,#8c6a4a 44%,#5f4f57 64%,#3f3450 82%,#332a46 100%)}
.ip-flow{position:absolute;inset:-10%;opacity:.85;pointer-events:none}
.ip-flow:before{content:"";position:absolute;left:-16%;top:34%;width:130%;height:42%;border-radius:50%;background:linear-gradient(100deg,transparent 12%,rgba(247,240,224,.95) 46%,rgba(247,240,224,.75) 70%,transparent 92%);filter:blur(1px);transform:rotate(-8deg)}
.ip-flow:after{content:"";position:absolute;right:-24%;top:8%;width:110%;height:36%;border-radius:50%;background:linear-gradient(80deg,transparent 20%,rgba(250,243,228,.9) 55%,transparent 86%);transform:rotate(-16deg);filter:blur(1px)}
/* status + notch */
.ip-status{position:absolute;top:10px;left:0;right:0;z-index:12;display:flex;justify-content:space-between;align-items:center;padding:0 24px;font-size:12px;font-weight:700;color:#fff}
.ip-status-right{display:flex;align-items:flex-end;gap:6px}
.ip-cells{display:flex;align-items:flex-end;gap:1.5px;height:10px}
.ip-cells i{width:3px;border-radius:2px;background:#fff;opacity:.25}
.ip-cells i:nth-child(1){height:3px}.ip-cells i:nth-child(2){height:5px}.ip-cells i:nth-child(3){height:7px}.ip-cells i:nth-child(4){height:10px;opacity:1}.ip-cells i:nth-child(5){height:10px;opacity:1}
.ip-wifi{font-size:11px;line-height:1}
.ip-batt{width:22px;height:11px;border:1.4px solid rgba(255,255,255,.85);border-radius:3.5px;padding:1.5px;position:relative}
.ip-batt:after{content:"";position:absolute;right:-3.5px;top:3.2px;width:2px;height:4.5px;background:rgba(255,255,255,.75);border-radius:0 2px 2px 0}
.ip-batt i{display:block;height:100%;width:80%;background:#fff;border-radius:1.5px}
.ip-notch{position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:30;width:44%;height:24px;background:#000;border-radius:0 0 16px 16px;display:flex;align-items:flex-start;justify-content:flex-end;padding-right:12px}
.ip-notch .cam{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#1d2733 0 20%,#04060a 58%,#000 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);margin-top:7px}
.ip-ccpull{position:absolute;top:0;right:0;width:52%;height:34px;z-index:15;cursor:pointer}
/* boot */
.ip-boot{position:absolute;inset:0;z-index:90;background:#000;display:flex;align-items:center;justify-content:center;transition:opacity .55s}
.ip-boot.is-done{opacity:0;pointer-events:none;visibility:hidden;transition:opacity .55s,visibility 0s .55s}
.ip-apple{width:54px;height:54px}
.ip-apple svg{width:100%;height:100%}
/* sleep */
.ip-sleep{position:absolute;inset:0;z-index:95;background:#000;display:none}
.ip-sleep.is-visible{display:block}
/* lock */
.ip-lock{position:absolute;inset:0;z-index:8;cursor:pointer}
.ip-lock.is-hidden{opacity:0;pointer-events:none}
.ip-lock-pad{position:absolute;top:56px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.92);font-size:15px}
.ip-lock-when{position:absolute;top:118px;left:0;right:0;text-align:center;color:#fff;font-size:26px;font-weight:700;letter-spacing:-.02em}
.ip-lock-time{position:absolute;top:166px;left:0;right:0;text-align:center;font-size:118px;font-weight:200;letter-spacing:-.05em;line-height:.9;background:linear-gradient(115deg,#f4df9e 8%,#f7ecd6 46%,#cdae7c 62%,#fdfaf1 88%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 12px rgba(120,88,45,.25))}
.ip-lock-time u{text-decoration:none}
.ip-lock-secondary{position:absolute;top:312px;left:0;right:0;text-align:center;font-size:118px;font-weight:200;letter-spacing:-.05em;line-height:.9;color:rgba(255,250,240,.0)}
.ip-quick{position:absolute;bottom:118px;left:30px;right:30px;display:flex;justify-content:space-between}
.ip-quick button{width:44px;height:44px;border-radius:50%;border:0;background:rgba(24,20,12,.38);color:#fff;font:inherit;font-size:18px;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ip-quick button.is-on{background:rgba(255,240,200,.92);color:#2a2115}
.ip-home-bar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:118px;height:4px;border-radius:99px;background:rgba(255,255,255,.8);z-index:31;pointer-events:none}
/* control centre */
.ip-cc{position:absolute;inset:0;z-index:66;transform:translateY(-100%);opacity:0;pointer-events:none;transition:transform .34s cubic-bezier(.2,1,.3,1),opacity .24s}
.ip-cc.is-visible{transform:translateY(0);opacity:1;pointer-events:auto}
.ip-cc-body{position:absolute;inset:0;background:linear-gradient(178deg,rgba(38,30,24,.92) 0%,rgba(52,42,36,.88) 55%,rgba(46,38,50,.9) 100%);backdrop-filter:blur(34px) saturate(130%);-webkit-backdrop-filter:blur(34px) saturate(130%);padding:52px 14px 16px;display:flex;flex-direction:column}
.ip-cc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.ip-cc-cell{display:flex;align-items:center;justify-content:center;gap:7px;height:42px;border-radius:999px;background:rgba(255,255,255,.12);border:0;color:#fff;font:inherit;font-size:13px;cursor:pointer}
.ip-cc-cell.is-on{background:#ffd75e;color:#3a2c12}
.ip-cc-tiles{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0}
.ip-cc-tile{display:flex;align-items:center;gap:9px;padding:10px;border-radius:999px;background:rgba(255,255,255,.12);border:0;color:#fff;cursor:pointer}
.ip-cc-tile i{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:13px;flex:0 0 auto}
.ip-cc-tile.is-on i{background:#ffd75e;color:#3a2c12}
.ip-cc-tile strong{display:block;font-size:11px;font-weight:700}
.ip-cc-tile small{display:block;color:rgba(255,255,255,.5);font-size:9px;margin-top:1px}
.ip-cc-sliders{display:flex;gap:9px;margin-bottom:9px}
.ip-cc-slider{flex:1;position:relative;height:140px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;cursor:pointer}
.ip-cc-slider i{position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,.85);border-radius:999px}
.ip-cc-slider u{position:absolute;left:50%;transform:translateX(-50%);text-decoration:none;font-size:14px;color:#fff}
.ip-cc-short{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:auto}
.ip-cc-round{aspect-ratio:1;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:16px;cursor:pointer}
.ip-cc-round.is-on{background:#ffd75e;color:#3a2c12}
/* home */
.ip-home{position:absolute;inset:0;z-index:7;padding:56px 0 24px;opacity:0;transform:scale(1.05);pointer-events:none;transition:opacity .3s,transform .3s;overflow:hidden}
.ip-home.is-visible{opacity:1;transform:scale(1);pointer-events:auto}
.ip-home-in{transform-origin:50% 0}
.ip-widgets{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 18px 14px;flex:0 0 auto}
.ip-widget{border-radius:26px;background:rgba(22,18,10,.34);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);padding:11px 13px;border:1px solid rgba(255,255,255,.10)}
.ip-widget small{display:block;color:rgba(255,255,255,.55);font-size:8px;font-weight:800;letter-spacing:.12em}
.ip-widget .ip-w-now{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.04em;margin-top:5px}
.ip-widget .ip-w-note{display:block;color:rgba(255,255,255,.48);font-size:9px;margin-top:3px}
.ip-app-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px;padding:0 14px;flex:0 0 auto}
.ip-app{background:none;border:0;padding:0;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;line-height:1}
.ip-app-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#fff;font-size:20px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 5px 13px rgba(20,14,8,.32);transition:transform .16s}
.ip-app:hover .ip-app-icon,.ip-app:active .ip-app-icon{transform:scale(1.07)}
.ip-app span:last-child{font-size:8.5px;line-height:1.1;color:rgba(255,255,255,.95);font-weight:600;text-shadow:0 1px 3px rgba(20,14,8,.55);white-space:nowrap}
.ip-img{width:64%;height:64%;object-fit:contain}
.ip-app[data-app="phone"] .ip-app-icon{background:linear-gradient(145deg,#6fe08d,#1fae46);color:#fff}
.ip-app[data-app="messages"] .ip-app-icon{background:linear-gradient(145deg,#71e38f,#21b04b);color:#fff}
.ip-app[data-app="music"] .ip-app-icon{background:linear-gradient(145deg,#ff6a7c,#e00c35);color:#fff}
.ip-app[data-app="camera"] .ip-app-icon{background:linear-gradient(145deg,#e8e6e2,#9a958c);color:#3a362e}
.ip-app[data-app="settings"] .ip-app-icon{background:linear-gradient(145deg,#eceae6,#8f8a80);color:#46423a}
.ip-app[data-app="clock"] .ip-app-icon{background:#0b0b0c;color:#fff}
.ip-app[data-app="weather"] .ip-app-icon{background:linear-gradient(145deg,#74c3ff,#1d63e8);color:#fff}
.ip-app[data-app="photos"] .ip-app-icon{background:#fff}
.ip-app[data-app="safari"] .ip-app-icon{background:linear-gradient(145deg,#5ad3ff,#0f6df3);color:#fff}
.ip-app[data-app="maps"] .ip-app-icon{background:linear-gradient(145deg,#7de8a2,#12a361);color:#fff}
.ip-search-pill{display:flex;align-items:center;justify-content:center;gap:6px;height:26px;width:96px;margin:12px auto 8px;border-radius:999px;background:rgba(0,0,0,.3);border:0;color:rgba(255,255,255,.6);font:inherit;font-size:9px;font-weight:700;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);flex:0 0 auto}
.ip-dock{flex:0 0 auto;margin:0 auto 6px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:7px 10px;border-radius:20px;background:rgba(20,16,8,.42);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.08);width:fit-content}
.ip-dock .ip-app span:last-child{display:none}
/* app view */
.ip-appview{position:absolute;left:0;right:0;top:0;bottom:0;z-index:50;background:#f5f3ef;display:flex;flex-direction:column;transform:translateY(6%);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.2,1,.3,1),opacity .2s;overflow:hidden}
.ip-appview.is-open{transform:translateY(0);opacity:1;pointer-events:auto}
.ip-app-head{display:flex;align-items:center;gap:10px;padding:44px 16px 11px;background:rgba(245,243,239,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);flex:0 0 auto}
.ip-app-back{width:30px;height:30px;border-radius:50%;border:0;background:rgba(20,16,10,.08);color:#333;font:inherit;font-size:17px;cursor:pointer}
.ip-app-head strong{font-size:15px;color:#2a2620;letter-spacing:-.02em}
.ip-app-head small{display:block;color:rgba(42,38,32,.4);font-size:8.5px;font-weight:800;letter-spacing:.11em;margin-top:2px}
.ip-app-body{flex:1;overflow:auto;padding:16px 16px 34px}
.ip-app-body::-webkit-scrollbar{width:0}
/* recents */
.ip-recents{position:absolute;inset:0;z-index:70;background:rgba(12,10,8,.7);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:none;flex-direction:column;padding:58px 16px 46px}
.ip-recents.is-visible{display:flex}
.ip-recents-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;color:#fff}
.ip-recents-head strong{font-size:15px;font-weight:800;letter-spacing:-.02em}
.ip-recents-head button{border:0;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:9px;font-weight:800;padding:7px 12px;border-radius:999px;cursor:pointer;letter-spacing:.08em}
.ip-rc-card{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:22px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08);color:#fff;margin-bottom:10px;cursor:pointer}
.ip-rc-card i{width:38px;height:38px;border-radius:10px;background:#fff;display:grid;place-items:center;flex:0 0 auto;overflow:hidden}
.ip-rc-card .ip-app-icon{width:38px;height:38px;box-shadow:none}
.ip-rc-card strong{font-size:12.5px;font-weight:700}
.ip-rc-card small{display:block;color:rgba(255,255,255,.5);font-size:9px;margin-top:2px;letter-spacing:.08em}
.ip-recents-empty{color:rgba(255,255,255,.5);font-size:11px;text-align:center;padding:30px 0}
/* volume hud */
.ip-volume{position:absolute;right:26px;top:296px;z-index:75;width:30px;height:92px;border-radius:999px;background:rgba(30,24,16,.84);color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.ip-volume.is-visible{display:flex}
.ip-volume b{font-size:9px;font-weight:800}
.ip-volume i{width:5px;border-radius:3px;background:#f5d9a8;display:block;transition:height .15s}
/* app content */
.ip-card{background:#fff;border-radius:20px;padding:15px;margin-bottom:11px;box-shadow:0 4px 14px rgba(38,32,20,.08)}
.ip-card small{color:rgba(42,38,32,.42);font-size:8.5px;font-weight:800;letter-spacing:.12em}
.ip-card h3{font-size:18px;margin:6px 0 4px;color:#2a2620;font-weight:800;letter-spacing:-.03em}
.ip-card p{font-size:11.5px;line-height:1.55;color:rgba(42,38,32,.6);margin:0}
.ip-version{display:inline-block;margin-top:8px;padding:6px 11px;border-radius:999px;background:#e8ecff;color:#1b6ef3;font-size:9px;font-weight:800;letter-spacing:.08em}
.ip-dialer-display{min-height:50px;border-radius:18px;background:rgba(20,16,10,.06);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:300;letter-spacing:.07em;color:#2a2620;margin-bottom:16px}
.ip-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ip-key{height:52px;border-radius:50%;border:0;background:#fff;color:#2a2620;font:inherit;font-size:18px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(38,32,20,.08)}
.ip-key small{display:block;font-size:7px;letter-spacing:.15em;color:rgba(42,38,32,.4)}
.ip-call{width:54px;height:38px;border-radius:999px;border:0;background:#1fae46;color:#fff;font:inherit;font-size:16px;margin:16px auto 0;display:block;cursor:pointer}
.ip-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(38,32,20,.08)}
.ip-toggle-row:last-child{border-bottom:0}
.ip-toggle-row strong{display:block;font-size:12px;color:#2a2620}
.ip-toggle-row small{display:block;color:rgba(42,38,32,.45);font-size:9px;margin-top:3px}
.ip-switch{width:38px;height:22px;border-radius:999px;border:0;background:rgba(38,32,20,.18);position:relative;cursor:pointer;flex:0 0 auto;transition:background .2s}
.ip-switch:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.ip-switch.is-on{background:#1fae46}
.ip-switch.is-on:after{transform:translateX(16px)}
.ip-camera{position:relative;flex:1;background:linear-gradient(160deg,#1c1a22,#050508 70%);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px 18px 16px}
.ip-camera:before{content:"";position:absolute;inset:10px;border:1px solid rgba(255,255,255,.08);border-radius:16px;pointer-events:none}
.ip-camera-mode{color:#d8b183;font-size:9px;font-weight:900;letter-spacing:.12em;margin-top:4px}
.ip-camera-frame{width:80%;aspect-ratio:3/4;border-radius:14px;background:linear-gradient(155deg,#2c2820,#0a0908 70%);border:1px solid rgba(255,255,255,.1);position:relative;overflow:hidden;margin:5px 0;transition:transform .15s}
.ip-camera-frame:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 55% 42%,rgba(216,177,131,.3),transparent 32%)}
.ip-shutter{width:56px;height:56px;border-radius:50%;border:0;background:#fff;cursor:pointer}
.ip-shutter:active{background:#d8d2c4}
.ip-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.ip-photo{aspect-ratio:1;border-radius:8px;background:linear-gradient(135deg,#d8b183,#5f4f57 55%,#332a46)}
.ip-photo:nth-child(2n){background:linear-gradient(135deg,#efe6d2,#8c6a4a 60%,#3f3450)}
.ip-photo:nth-child(3n){background:linear-gradient(135deg,#ffd166,#b98a56 60%,#332a46)}
.ip-music-art{height:176px;border-radius:22px;background:linear-gradient(145deg,#ffb56b,#8c6a4a 52%,#332a46);position:relative;overflow:hidden;margin-bottom:15px}
.ip-music-art:after{content:"";position:absolute;inset:13px;border:2px solid rgba(255,255,255,.4);border-radius:50%;transform:scale(.78)}
.ip-music-title{font-size:19px;font-weight:800;color:#2a2620;letter-spacing:-.03em;margin:0}
.ip-music-artist{font-size:11px;color:rgba(42,38,32,.5);margin:4px 0 17px}
.ip-play{width:46px;height:46px;border-radius:50%;border:0;background:#2a2620;color:#fff;font:inherit;font-size:17px;cursor:pointer}
.ip-chip{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:18px;background:#fff;margin-bottom:8px;box-shadow:0 3px 10px rgba(38,32,20,.07);font-size:11.5px;color:#2a2620}
.ip-chip b{font-weight:800}
.ip-badge{display:inline-block;color:rgba(42,38,32,.42);font-size:8.5px;font-weight:800;letter-spacing:.1em}
@media (max-width:900px){.ip-copy{display:none}.ip-stage{gap:0}.ip-phone{height:min(80vh,720px)}}
@media (max-width:560px){.ip-phone{height:min(78vh,680px)}.ip-app-icon{width:40px;height:40px;font-size:19px}.ip-ip-dock .ip-app-icon{width:38px;height:38px}.ip-app-grid{gap:9px 5px}}
`;
        document.head.appendChild(style);
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function timeParts() {
        var d = new Date();
        return [pad(d.getHours()), pad(d.getMinutes())];
    }
    function timeText() { var p = timeParts(); return p[0] + ':' + p[1]; }
    function whenText() {
        var d = new Date();
        return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' });
    }
    function whenLong() {
        return new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    }
    function updateClock() {
        if (!root) return;
        var p = timeParts();
        var t = root.querySelectorAll('[data-ip-time]');
        for (var j = 0; j < t.length; j++) t[j].textContent = p[0] + ':' + p[1];
        var hh = root.querySelector('[data-ip-hh]');
        var mm = root.querySelector('[data-ip-mm]');
        if (hh) hh.textContent = p[0];
        if (mm) mm.textContent = p[1];
        var w = root.querySelectorAll('[data-ip-when]');
        for (var k = 0; k < w.length; k++) w[k].textContent = whenLong();
    }

    function appleSvg() {
        return '<svg viewBox="0 0 100 100" fill="#f5f2ec" xmlns="http://www.w3.org/2000/svg"><path d="M63 20c-.2 4-2.9 7.8-6.6 10.4-.9.6-1.9 1.2-3 1.6 3.4-4 6.2-8.6 6-12.4-2.8-.4-5.8.4-8.2 2-2.4 1.7-4.2 4.5-4.9 7.8-1.7-.8-8.5-4.7-15-2.2-4.4 1.6-7.6 5.2-9.3 9.9-3.4 9.4-1.6 22.5 2.6 30.2 2.1 3.8 4.6 7.6 7.9 7.6 3.1 0 4.2-2 7.9-2s4.7 2 7.9 1.9c3.3 0 5.8-3.5 7.9-7.3 1.5-2.6 3-5.6 4.3-8.6-4.8-2.4-7.1-6.9-7.4-12.2 0-.1-.1-7.4 6.3-9.2-2.4-2.6-5.8-4-9.4-4.1 2.9-3.2 7.1-5.5 11-5.4z" transform="translate(8 2) scale(.95)"/><ellipse cx="56" cy="15" rx="7" ry="4" transform="rotate(-34 56 15)"/></svg>';
    }

    function realIcon(slug) {
        return '<img class="ip-img" src="https://cdn.simpleicons.org/' + slug + '" alt="">';
    }

    function cardApp(item) {
        var tile = '<span class="ip-app-icon' + (ICONS[item] ? '"' : '') + '">' + (ICONS[item] ? ICONS[item] : {}) + '</span>';
        return tile;
    }
    var GLYPHS = { phone: '☎', camera: '◎', clock: '◷', weather: '☁', settings: '⚙', maps: '⌖', music: '♫', messages: '✉', photos: '✿', safari: '◉' };
    var ICONS = { google: realIcon('google'), chrome: realIcon('googlechrome'), play: realIcon('googleplay'), googlephotos: realIcon('googlephotos'), googlemessages: realIcon('googlemessages'), samsung: realIcon('samsung'), samsungpay: realIcon('samsungpay') };

    function icon(name) {
        var map = { google: ICONS.google, chrome: ICONS.chrome, store: ICONS.samsung, galaxy: ICONS.samsungpay };
        if (map[name]) return map[name];
        return GLYPHS[name] || '▣';
    }

    function appMarkup(name) {
        if (name === 'phone') return '<div class="ip-dialer-display" id="ipDial">—</div><div class="ip-keypad">' +
            ['1','2','3','4','5','6','7','8','9','*','0','#'].map(function (k) {
                return '<button class="ip-key" data-dial="' + k + '" type="button">' + k + '<small>' + (k === '0' ? '+' : '') + '</small></button>';
            }).join('') + '</div><button class="ip-call" type="button" data-call>☎</button>';
        if (name === 'settings') {
            var rows = [
                ['airplane', 'Airplane Mode', 'Off', false],
                ['wifi', 'Wi‑Fi', 'SIMBA‑5G connected', true],
                ['bt', 'Bluetooth', 'On', true],
                ['dark', 'Appearance', 'Light · iOS 27.2', true],
                ['assist', 'Assistive features', 'On', true]
            ];
            return '<div class="ip-card"><small>IPHONE</small><h3>Settings</h3><p>11 Pro Max · iPhoneOS 27.2 · fan concept</p><span class="ip-version">iOS 27.2</span></div>' +
                '<div class="ip-card">' + rows.map(function (r) {
                    return '<div class="ip-toggle-row"><div><strong>' + r[1] + '</strong><small>' + r[2] + '</small></div><button class="ip-switch' + (r[3] ? ' is-on' : '') + '" type="button" data-toggle="' + r[0] + '" aria-label="' + r[1] + '"></button></div>';
                }).join('') + '</div>';
        }
        if (name === 'camera') return '<div class="ip-camera"><div class="ip-camera-mode">12 MP · NIGHT OFF · PORTRAIT</div><div class="ip-camera-frame"></div><div class="ip-shutter-wrap" style="display:flex;gap:26px;align-items:center"><span style="color:rgba(255,255,255,.55);font-size:10px">0.5×</span><button class="ip-shutter" type="button" data-shutter aria-label="Take photo"></button><span style="color:rgba(255,255,255,.55);font-size:10px">2×</span></div></div>';
        if (name === 'photos') return '<div class="ip-card"><small>ANDROID PHOTO ROLL</small><h3>Battery demo</h3><p>24 photos · last sync today</p></div><div class="ip-photo-grid">' + Array(18).join('<div class="ip-photo"></div>') + '</div>';
        if (name === 'weather') return '<div class="ip-card"><small>SIMBA</small><h3 style="font-size:32px">31°</h3><p>Clear night · feels 28° · Low 22° · Wind 11 km/h</p></div><div class="ip-card"><small>TONIGHT</small><h3>Dry roads</h3><p>Good grip for the iPhone test drive tonight.</p></div>';
        if (name === 'clock') return '<div class="ip-card"><h3 data-ip-time style="font-size:46px;font-weight:200">00:00</h3><p>Alarm set for tomorrow</p></div>' +
            '<div class="ip-chip"><span><b>07:00</b> Morning</span><button class="ip-switch is-on" type="button" data-toggle="alarm1"></button></div>' +
            '<div class="ip-chip"><span><b>09:30</b> Weekend</span><button class="ip-switch" type="button" data-toggle="alarm2"></button></div>';
        if (name === 'safari') return '<div class="ip-card"><small>START PAGE</small><h3>Search or type URL</h3><p>Safari demo start page. No real browsing here.</p></div>' +
            '<div class="ip-chip"><span>redline.gt</span><span class="ip-badge">OPEN</span></div>' +
            '<div class="ip-chip"><span>lessfun arcade</span><span class="ip-badge">WEBSITE</span></div>' +
            '<div class="ip-chip"><span>news</span><span class="ip-badge">LINK</span></div>';
        if (name === 'messages') return '<div class="ip-card"><small>MESSAGES</small><h3>LessFun Arcade</h3><p>New iOS 27.2 is live. Refresh the site to pick it up.</p></div>' +
            '<div class="ip-chip"><span>Reply</span><span class="ip-badge" style="color:#1fae46;font-weight:800">SEND</span></div>' +
            '<div class="ip-chip"><span><b>Coming soon</b></span><span class="ip-badge">CONVERSATIONS</span></div>';
        return '<div class="ip-card"><small>' + name.toUpperCase() + '</small><h3>' + (APP_TITLES[name] || name) + '</h3><p>This demo screen is coming soon.</p></div>';
    }

    function recentsCard(item) {
        var inner = ICONS[item] || GLYPHS[item] || '▣';
        return '<div class="ip-rc-card" data-recent="' + item + '"><i>' + inner + '</i><div><strong>' + (APP_TITLES[item] || item) + '</strong><small>IPHONE 11 PRO MAX · IOS 27.2 · JUST NOW</small></div></div>';
    }
    function showRecents() {
        if (!root) return;
        closeApp();
        hideCC();
        var list = root.querySelector('#ipRecentsList');
        var overlay = root.querySelector('#ipRecents');
        if (overlay) overlay.classList.add('is-visible');
        if (list) list.innerHTML = state.recents.length ? state.recents.map(recentsCard).join('') : '<div class="ip-recents-empty">No recent apps yet.</div>';
    }
    function hideRecents() {
        if (!root) return;
        var overlay = root.querySelector('#ipRecents');
        if (overlay) overlay.classList.remove('is-visible');
    }
    function goHome() { closeApp(); hideRecents(); hideCC(); }
    function goBack() {
        if (!root) return;
        var overlay = root.querySelector('#ipRecents');
        if (overlay && overlay.classList.contains('is-visible')) { hideRecents(); return; }
        closeApp();
        hideCC();
    }
    function sleep() {
        if (!root) return;
        goHome();
        var sl = root.querySelector('#ipSleep');
        if (sl) sl.classList.add('is-visible');
        state.asleep = true;
        state.unlocked = false;
    }
    function wake() {
        if (!root) return;
        var sl = root.querySelector('#ipSleep');
        if (sl) sl.classList.remove('is-visible');
        state.asleep = false;
        root.querySelector('#ipLock').classList.remove('is-hidden');
        root.querySelector('#ipHome').classList.remove('is-visible');
    }
    function sideKey() {
        if (!root) return;
        if (state.asleep) wake();
        else sleep();
    }
    function hideCC() {
        if (!root) return;
        var q = root.querySelector('#ipCC');
        if (q) q.classList.remove('is-visible');
        state.ccOpen = false;
    }
    function showCC() {
        if (!root || state.asleep) return;
        hideRecents();
        closeApp();
        var q = root.querySelector('#ipCC');
        if (q) q.classList.add('is-visible');
        state.ccOpen = true;
    }
    var volumeHideTimer = 0;
    function volumeOverlay() {
        if (!root) return;
        var o = root.querySelector('#ipVolume');
        if (!o) return;
        if (volumeHideTimer) clearTimeout(volumeHideTimer);
        o.querySelector('[data-ip-vol]').textContent = String(Math.round(state.volume * 100));
        o.querySelector('i').style.height = Math.round(state.volume * 54 + 8) + 'px';
        o.classList.add('is-visible');
        volumeHideTimer = setTimeout(function () { if (o) o.classList.remove('is-visible'); }, 900);
    }
    function volumeChange(delta) {
        state.volume = Math.min(1, Math.max(0.1, state.volume + delta / 100));
        volumeOverlay();
    }

    function fitHome() {
        if (!root) return;
        var home = root.querySelector('#ipHome');
        var inn = root.querySelector('#ipHomeIn');
        if (!home || !inn) return;
        inn.style.transform = 'none';
        var cs = global.getComputedStyle(home);
        var avail = home.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        var nat = inn.scrollHeight;
        if (nat > avail && nat > 0) inn.style.transform = 'scale(' + (avail / nat) + ')';
    }

    function openApp(name) {
        if (!root) return;
        state.app = name;
        var view = root.querySelector('#ipAppView');
        var title = root.querySelector('#ipAppTitle');
        var body = root.querySelector('#ipAppBody');
        if (!view || !body) return;
        var sub = root.querySelector('#ipAppSub');
        if (title) title.textContent = APP_TITLES[name] || (name.charAt(0).toUpperCase() + name.slice(1));
        if (sub) sub.textContent = 'IPHONE 11 PRO MAX · IOS 27.2';
        body.innerHTML = appMarkup(name);
        hideRecents();
        hideCC();
        view.classList.add('is-open');
        if (state.recents[0] !== name) {
            state.recents = [name].concat(state.recents.filter(function (n) { return n !== name; })).slice(0, 6);
        }
    }
    function closeApp() {
        if (!root) return;
        var view = root.querySelector('#ipAppView');
        if (view) view.classList.remove('is-open');
        state.app = '';
    }

    function bind() {
        root.addEventListener('click', function (e) {
            if (e.target.closest('#ipBoot')) { endBoot(); return; }
            if (e.target.closest('#ipSleep')) { wake(); return; }
            var lockShortcut = e.target.closest('[data-lockside]');
            if (lockShortcut) {
                var which = lockShortcut.getAttribute('data-lockside');
                if (which === 'flash') {
                    lockShortcut.classList.toggle('is-on');
                    state.toggles.flashlight = lockShortcut.classList.contains('is-on');
                } else {
                    root.querySelector('#ipLock').classList.add('is-hidden');
                    root.querySelector('#ipHome').classList.add('is-visible');
                    state.unlocked = true;
                    openApp('camera');
                }
                return;
            }
            if (e.target.closest('#ipLock')) {
                root.querySelector('#ipLock').classList.add('is-hidden');
                root.querySelector('#ipHome').classList.add('is-visible');
                state.unlocked = true;
                return;
            }
            var pull = e.target.closest('#ipCCPull');
            if (pull) { showCC(); return; }
            if (e.target.closest('#ipHomeBar')) { hideCC(); hideRecents(); closeApp(); return; }
            if (e.target.closest('#ipCCDone')) { hideCC(); return; }
            if (e.target.closest('#ipCC') && state.ccOpen) {
                var slider = e.target.closest('.ip-cc-slider');
                if (slider) {
                    var rect = slider.getBoundingClientRect();
                    var pct = Math.max(6, Math.min(100, Math.round(((rect.bottom - e.clientY) / rect.height) * 100)));
                    var fill = slider.querySelector('i');
                    if (fill) fill.style.height = pct + '%';
                    return;
                }
                var round = e.target.closest('[data-cc]');
                if (round) { round.classList.toggle('is-on'); return; }
                if (!e.target.closest('.ip-cc-grid') && !e.target.closest('.ip-cc-tile')) { hideCC(); return; }
            }
            var navBtn = e.target.closest('[data-ipnav]');
            if (navBtn) {
                var which = navBtn.getAttribute('data-ipnav');
                if (which === 'recents') showRecents();
                else if (which === 'home') goHome();
                else goBack();
                return;
            }
            var sideBtn = e.target.closest('[data-ipside]');
            if (sideBtn) {
                var side = sideBtn.getAttribute('data-ipside');
                if (side === 'power') sideKey();
                else volumeChange(side === 'volup' ? +10 : -10);
                return;
            }
            var recent = e.target.closest('[data-recent]');
            if (recent) { openApp(recent.getAttribute('data-recent')); return; }
            if (e.target.closest('[data-ssclear]') || e.target.closest('[data-ipclear]')) { state.recents = []; var l2 = root.querySelector('#ipRecentsList'); if (l2) l2.innerHTML = ''; return; }
            var app = e.target.closest('[data-app]');
            if (app && e.target.closest('.ip-home')) { openApp(app.getAttribute('data-app')); return; }
            if (e.target.closest('[data-close-appips]')) { closeApp(); return; }
            var dial = e.target.closest('[data-dial]');
            if (dial) {
                var d = root.querySelector('#ipDial');
                if (d) d.textContent = (d.textContent === '—' ? '' : d.textContent) + dial.getAttribute('data-dial');
                return;
            }
            if (e.target.closest('[data-call]')) {
                var dialEl = root.querySelector('#ipDial');
                if (dialEl) dialEl.textContent = 'CALLING…';
                return;
            }
            var toggle = e.target.closest('[data-toggle]');
            if (toggle) { toggle.classList.toggle('is-on'); state.toggles[toggle.getAttribute('data-toggle')] = toggle.classList.contains('is-on'); return; }
            var shutter = e.target.closest('[data-shutter]');
            if (shutter) {
                var frame = root.querySelector('#ipAppView .ip-camera-frame');
                if (frame) { frame.style.transform = 'scale(.96)'; setTimeout(function () { frame.style.transform = 'scale(1)'; }, 150); }
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

    function showBootStage() {
        if (!root) return;
        var logo = root.querySelector('#ipBoot');
        if (logo) logo.classList.remove('is-done');
    }
    function endBoot() {
        if (!root) return;
        var logo = root.querySelector('#ipBoot');
        if (logo) logo.classList.add('is-done');
        bootTimers = [];
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        el.innerHTML = '' +
            '<div class="ip-stage">' +
                '<div class="ip-copy">' +
                    '<span>LessFun Device Lab</span>' +
                    '<h2>iPhone 11 Pro Max</h2>' +
                    '<p>An iOS 27.2 concept demo with a liquid-glass lock screen, Control Centre, apps, camera and settings.</p>' +
                    '<div class="ip-demo-badge"><i></i> DEMO BUILD · FAN CONCEPT · NOT AFFILIATED WITH APPLE</div>' +
                '</div>' +
                '<div class="ip-phone">' +
                    '<div class="ip-side ps" data-ipside="power" title="Side key"></div><div class="ip-side up" data-ipside="volup" title="Volume up"></div><div class="ip-side down" data-ipside="voldown" title="Volume down"></div>' +
                    '<div class="ip-frame"><div class="ip-screen">' +
                        '<div class="ip-wallpaper"></div>' +
                        '<div class="ip-flow"></div>' +
                        '<div class="ip-notch"><span class="cam"></span></div>' +
                        '<div class="ip-ccpull" id="ipCCPull" title="Control Centre"></div>' +
                        '<div class="ip-status"><span>SIMBA</span><span class="ip-status-right"><span class="ip-cells"><i></i><i></i><i></i><i></i><i></i></span><span class="ip-wifi">📶</span><span class="ip-batt"><i></i></span></span></div>' +
                        /* boot */
                        '<div class="ip-boot" id="ipBoot"><span class="ip-apple">' + appleSvg() + '</span></div>' +
                        /* sleep */
                        '<div class="ip-sleep" id="ipSleep"></div>' +
                        /* lock */
                        '<div class="ip-lock" id="ipLock">' +
                            '<div class="ip-lock-pad">🔓</div>' +
                            '<div class="ip-lock-when" data-ip-when>Tue 10 Nov</div>' +
                            '<div class="ip-lock-time"><span data-ip-hh>00</span>' +
                                '<span style="position:relative;display:inline-block;width:1.4ch;text-align:center"><span style="display:inline-block;width:.4ch;height:.4ch;border-radius:50%;background:#f0dcae;vertical-align:.85em"></span></span>' +
                                '<span data-ip-mm>00</span></div>' +
                            '<div class="ip-quick">' +
                                '<button class="ip-flash" data-lockside="flash" title="Flashlight">🔦</button>' +
                                '<button data-lockside="camera" title="Camera">◉</button>' +
                            '</div>' +
                        '</div>' +
                        /* home */
                        '<div class="ip-home" id="ipHome">' +
                            '<div class="ip-home-in" id="ipHomeIn">' +
                                '<div class="ip-widgets">' +
                                    '<div class="ip-widget"><small>NOW</small><div class="ip-w-now">31° Yonkers</div><span class="ip-w-note">Clear · iOS 27.2</span></div>' +
                                    '<div class="ip-widget"><small>REDLINE GT</small><div class="ip-w-now">READY</div><span class="ip-w-note">Garage synced</span></div>' +
                                '</div>' +
                                '<div class="ip-app-grid">' +
                                    '<button class="ip-app" data-app="phone" type="button"><span class="ip-app-icon">☎</span><span>Phone</span></button>' +
                                    '<button class="ip-app" data-app="safari" type="button"><span class="ip-app-icon">◉</span><span>Safari</span></button>' +
                                    '<button class="ip-app" data-app="messages" type="button"><span class="ip-app-icon">✉</span><span>Messages</span></button>' +
                                    '<button class="ip-app" data-app="music" type="button"><span class="ip-app-icon">♫</span><span>Music</span></button>' +
                                    '<button class="ip-app" data-app="camera" type="button"><span class="ip-app-icon">◎</span><span>Camera</span></button>' +
                                    '<button class="ip-app" data-app="photos" type="button"><span class="ip-app-icon"><span style="color:#ff5c7a">✿</span></span><span>Photos</span></button>' +
                                    '<button class="ip-app" data-app="clock" type="button"><span class="ip-app-icon">◷</span><span>Clock</span></button>' +
                                    '<button class="ip-app" data-app="weather" type="button"><span class="ip-app-icon">☁</span><span>Weather</span></button>' +
                                    '<button class="ip-app" data-app="settings" type="button"><span class="ip-app-icon">⚙</span><span>Settings</span></button>' +
                                    '<button class="ip-app" data-app="maps" type="button"><span class="ip-app-icon">⌖</span><span>Maps</span></button>' +
                                    '<button class="ip-app" data-app="google" type="button"><span class="ip-app-icon">' + ICONS.google + '</span><span>Google</span></button>' +
                                    '<button class="ip-app" data-app="chrome" type="button"><span class="ip-app-icon">' + ICONS.chrome + '</span><span>Chrome</span></button>' +
                                '</div>' +
                                '<button class="ip-search-pill" type="button">⌕ Search</button>' +
                                '<div class="ip-dock">' +
                                    '<button class="ip-app" data-app="phone" type="button"><span class="ip-app-icon">☎</span><span>Phone</span></button>' +
                                    '<button class="ip-app" data-app="safari" type="button"><span class="ip-app-icon">◉</span><span>Safari</span></button>' +
                                    '<button class="ip-app" data-app="music" type="button"><span class="ip-app-icon">♫</span><span>Music</span></button>' +
                                    '<button class="ip-app" data-app="camera" type="button"><span class="ip-app-icon">◎</span><span>Camera</span></button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        /* control centre */
                        '<div class="ip-cc" id="ipCC"><div class="ip-cc-body">' +
                            '<div class="ip-app-head" style="background:transparent;box-shadow:none;padding-top:44px;padding-bottom:14px"><div><strong style="color:#fff">Control Centre</strong><small style="color:rgba(255,255,255,.4)">IOS 27.2</small></div><button class="ip-app-back" id="ipCCDone" style="margin-left:auto" type="button">✕</button></div>' +
                            '<div class="ip-cc-grid">' +
                                '<button class="ip-cc-cell" type="button" data-cc="airplane">✈</button>' +
                                '<button class="ip-cc-cell is-on" type="button" data-cc="cellular">▮</button>' +
                                '<button class="ip-cc-cell is-on" type="button" data-cc="wifi">⌁</button>' +
                                '<button class="ip-cc-cell is-on" type="button" data-cc="bt">ᛒ</button>' +
                            '</div>' +
                            '<div class="ip-cc-tiles">' +
                                '<button class="ip-cc-tile is-on" type="button" data-cc="music">♫<div style="text-align:left"><strong>Night Runner</strong><small>Redline GT</small></div></button>' +
                                '<button class="ip-cc-tile" type="button" data-cc="cast">⤴<div style="text-align:left"><strong>Cast</strong><small>Living room</small></div></button>' +
                            '</div>' +
                            '<div class="ip-cc-sliders">' +
                                '<div class="ip-cc-slider" title="Brightness"><i style="height:76%"></i><span style="top:10px">✹</span><span style="bottom:10px">☾</span></div>' +
                                '<div class="ip-cc-slider" title="Volume"><i style="height:60%"></i><span style="top:10px">♫</span><span style="bottom:10px">🔈</span></div>' +
                            '</div>' +
                            '<div class="ip-cc-short">' +
                                '<button class="ip-cc-round" type="button" data-cc="flash">🔦</button>' +
                                '<button class="ip-cc-round" type="button" data-cc="timer">◷</button>' +
                                '<button class="ip-cc-round" type="button" data-cc="calc">＝</button>' +
                                '<button class="ip-cc-round" type="button" data-cc="camera">◉</button>' +
                            '</div>' +
                        '</div></div>' +
                        /* recents + volume + appview */
                        '<div class="ip-recents" id="ipRecents"><div class="ip-recents-head"><strong>Recent apps</strong><button type="button" data-ipclear>CLEAR ALL</button></div><div id="ipRecentsList"></div></div>' +
                        '<div class="ip-volume" id="ipVolume"><b>◉</b><i></i><b data-ip-vol>60</b></div>' +
                        '<div class="ip-appview" id="ipAppView">' +
                            '<div class="ip-app-head"><button class="ip-app-back" type="button" data-close-appips>‹</button><div><strong id="ipAppTitle">App</strong><small id="ipAppSub">IPHONE 11 PRO MAX · IOS 27.2</small></div></div>' +
                            '<div class="ip-app-body" id="ipAppBody"></div>' +
                        '</div>' +
                        /* nav */
                        '<div class="ip-nav" style="position:absolute;bottom:0;left:0;right:0;z-index:60;display:flex;align-items:center;justify-content:space-between;padding:0 42px;height:40px;color:#fff"><button type="button" data-ipnav="recents" style="background:none;border:0;color:inherit;font:inherit;font-size:14px;opacity:.85;cursor:pointer">|||</button><button type="button" id="ipHomeBar" style="background:none;border:0;width:118px;height:18px;cursor:pointer"><span style="display:block;width:118px;height:4px;border-radius:99px;background:rgba(255,255,255,.85)"></span></button><button type="button" data-ipnav="back" style="background:none;border:0;color:inherit;font:inherit;font-size:16px;opacity:.85;cursor:pointer">‹</button></div>' +
                    '</div></div>' +
                '</div>' +
            '</div>';
        root = el.querySelector('.ip-stage');
        bind();
        updateClock();
        clockTimer = setInterval(updateClock, 30000);
        bootTimers = [
            setTimeout(function () { showBootStage(); }, 10),
            setTimeout(function () { endBoot(); }, 2800)
        ];
        [300, 1200, 2400, 3600, 5000, 8000].forEach(function (ms) {
            bootTimers.push(setTimeout(fitHome, ms));
        });
    }

    function close() {
        bootTimers.forEach(function (t) { clearTimeout(t); });
        bootTimers = [];
        if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
        if (volumeHideTimer) { clearTimeout(volumeHideTimer); volumeHideTimer = 0; }
        if (container) { try { container.innerHTML = ''; } catch (e) {} }
        container = null;
        root = null;
        state = { unlocked: false, app: '', playing: false, toggles: { wifi: true, bt: true, airplane: false, flashlight: false }, volume: 0.6, brightness: 76, recents: [], ccOpen: false, asleep: false };
    }

    global.IPhoneSim = { open: open, close: close };
})(window);
