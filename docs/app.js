/* LessFun */
const SUPABASE_URL = "https://yuuopbgzfrwcatmhuypr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ev9umZevWcT-AwVHTPQLnw_DHdpDHWR";
const supabaseClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const games = [
    { id: 1, name: "Beach Racer", description: "Outrun traffic on a six-lane coastal highway", icon: "beach", hasBrake: true, hasThrottle: true, controls: "W / ↑ throttle · S / ↓ brake · A D / ← → steer · Shift / N nitrous · C camera" },
    { id: 2, name: "Tunnel Rush", description: "Thread the neon tunnel at warp speed", icon: "tunnel", controls: "Left / Right or drag to rotate" },
    { id: 3, name: "Cube Stack", description: "Stack the tower as high as you can", icon: "blocks", controls: "Tap or press Space to drop" },
    { id: 4, name: "Dead Coast", description: "Drive 10 km through the dead coast, scavenging food, water, fuel, and car parts", icon: "skull", hasBrake: true, hasThrottle: true, controls: "W / ↑ throttle · S / ↓ brake · A D / ← → steer · C camera · drag to steer on mobile · survive 10 km" },
    { id: 6, name: "Funtutu Test", description: "Benchmark your GPU and CPU, then get recommended graphics settings", icon: "bolt", controls: "Press Run Test · apply the recommended settings when it finishes" },
    { id: 7, name: "Snow Rush", description: "Christmas sleigh run — collect gifts and dodge the ice", icon: "snow", controls: "WASD / arrows to fly · drag to steer · collect gifts · dodge ice" },
    { id: 8, name: "Draw & Guess", description: "Draw the word, guess your friends' drawings, and race to the top", icon: "draw", controls: "Draw with mouse / touch · type guesses in the box" },
    { id: 9, name: "Lucky Spin", description: "Virtual-coin slot machine — pick a bet and chase the jackpot", icon: "dice", controls: "Pick a bet and spin · virtual Coins only" },
    { id: 13, name: "Boeing Landing", description: "Side-view 737 landing sim with flaps, spoilers and live suspension", icon: "plane", controls: "W/S pitch · A/D throttle · Space brakes · F flaps · G gear" },
    { id: 14, name: "Tranq Arena", description: "Top-down tranquilizer showdown — put rivals to sleep, spend energy to revive, reach the final two", icon: "dart", controls: "WASD move · mouse aim · click / Space shoot · one revive costs 1 energy" }
];

let currentUser = null;
let currentView = 'games';
let ownerUnlocked = false;
let debugUsersCache = [];
let debugStatusTimer = 0;

const RACER_MP_MAX = 3;
const RACER_MP_CODE_LENGTH = 5;
const RACER_MP_PUBLIC_MAX = 50;
const ARCADE_MP_MAX = 20;
const ARCADE_MP_GAMES = {
    2: { name: 'Tunnel Rush', channel: 'lessfun-arcade-tunnel-public' },
};
let arcadeMp = {
    gameId: 0,
    channel: null,
    connected: false,
    name: '',
    id: '',
    players: {},
    timer: 0,
    panelOpen: false,
    status: '',
    host: null
};
const RACER_MP_PUBLIC_LOBBIES = [
    { id: 'public-1', name: 'Sunset Highway', channel: 'lessfun-racer-public-1' },
    { id: 'public-2', name: 'Palm Coast', channel: 'lessfun-racer-public-2' },
    { id: 'public-3', name: 'Neon Shore', channel: 'lessfun-racer-public-3' }
];
const ADMIN_POWER_DEFS = [
    { id: 'manage_posts', label: 'Delete and pin posts' },
    { id: 'manage_replies', label: 'Delete replies' },
    { id: 'manage_users', label: 'Ban and unban users' }
];
let avatarCache = {};
const GRAPHICS_PRESETS = {
    potato: { scale: 0.5, shadows: false, level: 0, blur: false, label: 'Poteto' },
    medium: { scale: 0.7, shadows: false, level: 1, blur: false, label: 'Medium' },
    high: { scale: 0.85, shadows: true, level: 2, blur: true, label: 'High' },
    ultra: { scale: 1.0, shadows: true, level: 3, blur: true, label: 'Ultra' },
    extreme: { scale: 1.0, shadows: true, level: 4, blur: true, label: 'Your Computer Will Die' }
};
let renderScaleSetting = 0;
const isMobileUI = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 820;
let graphicsPresetSetting = 'extreme';
let autoGraphicsSetting = false;
let motionBlurSetting = !isMobileUI;
let showFpsSetting = true;
let reduceMotionSetting = false;
let shadowSetting = !isMobileUI;
let grainSetting = false;
let crashSlowmoSetting = true;
try {
    const savedScale = parseFloat(localStorage.getItem('lessfun_render_scale') || '0');
    if (isFinite(savedScale) && savedScale >= 0 && savedScale <= 1) renderScaleSetting = savedScale;
    const savedBlur = localStorage.getItem('lessfun_motion_blur');
    if (savedBlur != null) motionBlurSetting = savedBlur !== '0';
    else motionBlurSetting = !isMobileUI;
    const savedFps = localStorage.getItem('lessfun_show_fps');
    if (savedFps != null) showFpsSetting = savedFps !== '0';
    const savedMotion = localStorage.getItem('lessfun_reduce_motion');
    if (savedMotion != null) reduceMotionSetting = savedMotion === '1';
    const savedPreset = localStorage.getItem('lessfun_graphics_preset');
    if (savedPreset && GRAPHICS_PRESETS[savedPreset]) graphicsPresetSetting = savedPreset;
    const savedAuto = localStorage.getItem('lessfun_auto_graphics');
    if (savedAuto != null) autoGraphicsSetting = savedAuto !== '0';
    const savedShadows = localStorage.getItem('lessfun_shadows');
    if (savedShadows != null) shadowSetting = savedShadows !== '0';
    const savedGrain = localStorage.getItem('lessfun_film_grain');
    if (savedGrain != null) grainSetting = savedGrain !== '0';
    const savedSlow = localStorage.getItem('lessfun_crash_slowmo');
    if (savedSlow != null) crashSlowmoSetting = savedSlow !== '0';

    // First launch (or one-time migration) starts at maximum graphics with
    // automatic resolution scaling disabled.
    const GFX_MIGRATION_KEY = 'lessfun_gfx_extreme_default_v1';
    if (!localStorage.getItem(GFX_MIGRATION_KEY)) {
        graphicsPresetSetting = 'extreme';
        autoGraphicsSetting = false;
        motionBlurSetting = true;
        shadowSetting = true;
        grainSetting = true;
        crashSlowmoSetting = true;
        localStorage.setItem('lessfun_graphics_preset', 'extreme');
        localStorage.setItem('lessfun_auto_graphics', '0');
        localStorage.setItem('lessfun_motion_blur', '1');
        localStorage.setItem('lessfun_shadows', '1');
        localStorage.setItem('lessfun_film_grain', '1');
        localStorage.setItem('lessfun_crash_slowmo', '1');
        localStorage.setItem(GFX_MIGRATION_KEY, '1');
    }
    renderScaleSetting = GRAPHICS_PRESETS[graphicsPresetSetting].scale;
} catch (e) {}

function applyRenderScaleSetting() {
    const preset = GRAPHICS_PRESETS[graphicsPresetSetting] || GRAPHICS_PRESETS.high;
    renderScaleSetting = preset.scale;
    if (window.Games3D && window.Games3D.setGraphicsPreset) window.Games3D.setGraphicsPreset(graphicsPresetSetting, autoGraphicsSetting);
    if (window.Games3D && window.Games3D.setRenderScale) window.Games3D.setRenderScale(renderScaleSetting);
    if (window.Games3D && window.Games3D.setMotionBlur) window.Games3D.setMotionBlur(motionBlurSetting);
    if (window.Games3D && window.Games3D.setShowFps) window.Games3D.setShowFps(showFpsSetting);
    if (window.Games3D && window.Games3D.setShadows) window.Games3D.setShadows(shadowSetting);
    if (window.Games3D && window.Games3D.setCrashSlowmo) window.Games3D.setCrashSlowmo(crashSlowmoSetting);
    if (document.body) document.body.classList.toggle('film-grain-on', grainSetting);
    const select = document.getElementById('renderScaleSelect');
    if (select) select.value = String(renderScaleSetting);
    const presetSelect = document.getElementById('graphicsPresetSelect');
    if (presetSelect) presetSelect.value = graphicsPresetSetting;
    const autoToggle = document.getElementById('autoGraphicsToggle');
    if (autoToggle) autoToggle.checked = autoGraphicsSetting;
    const blur = document.getElementById('motionBlurToggle');
    if (blur) blur.checked = motionBlurSetting;
    const fps = document.getElementById('fpsCounterToggle');
    if (fps) fps.checked = showFpsSetting;
    applyReduceMotionSetting();
    const shadows = document.getElementById('shadowsToggle');
    if (shadows) shadows.checked = shadowSetting;
    const grain = document.getElementById('filmGrainToggle');
    if (grain) grain.checked = grainSetting;
    const slowmo = document.getElementById('crashSlowmoToggle');
    if (slowmo) slowmo.checked = crashSlowmoSetting;
}

function applyReduceMotionSetting() {
    if (document.body) document.body.classList.toggle('reduce-motion', reduceMotionSetting);
    var toggle = document.getElementById('reduceMotionToggle');
    if (toggle) toggle.checked = reduceMotionSetting;
}

function setReduceMotionSetting(on) {
    reduceMotionSetting = !!on;
    try { localStorage.setItem('lessfun_reduce_motion', reduceMotionSetting ? '1' : '0'); } catch (e) {}
    applyReduceMotionSetting();
}

function setGraphicsPresetSetting(value) {
    if (!GRAPHICS_PRESETS[value]) return;
    graphicsPresetSetting = value;
    const preset = GRAPHICS_PRESETS[value];
    motionBlurSetting = preset.blur && !isMobileUI;
    try {
        localStorage.setItem('lessfun_graphics_preset', value);
        localStorage.setItem('lessfun_motion_blur', motionBlurSetting ? '1' : '0');
    } catch (e) {}
    applyRenderScaleSetting();
}

function setAutoGraphicsSetting(on) {
    autoGraphicsSetting = !!on;
    try { localStorage.setItem('lessfun_auto_graphics', autoGraphicsSetting ? '1' : '0'); } catch (e) {}
    applyRenderScaleSetting();
}

function setMotionBlurSetting(on) {
    motionBlurSetting = !!on;
    try { localStorage.setItem('lessfun_motion_blur', motionBlurSetting ? '1' : '0'); } catch (e) {}
    if (window.Games3D && window.Games3D.setMotionBlur) window.Games3D.setMotionBlur(motionBlurSetting);
}

function setFpsCounterSetting(on) {
    showFpsSetting = !!on;
    try { localStorage.setItem('lessfun_show_fps', showFpsSetting ? '1' : '0'); } catch (e) {}
    if (window.Games3D && window.Games3D.setShowFps) window.Games3D.setShowFps(showFpsSetting);
}

function setShadowSetting(on) {
    shadowSetting = !!on;
    try { localStorage.setItem('lessfun_shadows', shadowSetting ? '1' : '0'); } catch (e) {}
    if (window.Games3D && window.Games3D.setShadows) window.Games3D.setShadows(shadowSetting);
}

function setFilmGrainSetting(on) {
    grainSetting = !!on;
    try { localStorage.setItem('lessfun_film_grain', grainSetting ? '1' : '0'); } catch (e) {}
    if (document.body) document.body.classList.toggle('film-grain-on', grainSetting);
}

function setCrashSlowmoSetting(on) {
    crashSlowmoSetting = !!on;
    try { localStorage.setItem('lessfun_crash_slowmo', crashSlowmoSetting ? '1' : '0'); } catch (e) {}
    if (window.Games3D && window.Games3D.setCrashSlowmo) window.Games3D.setCrashSlowmo(crashSlowmoSetting);
}

function setRenderScaleSetting(value) {
    const scale = parseFloat(value);
    renderScaleSetting = isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 0;
    try { localStorage.setItem('lessfun_render_scale', String(renderScaleSetting)); } catch (e) {}
    applyRenderScaleSetting();
}
let racerMp = {
    id: '',
    code: '',
    name: '',
    channel: null,
    connected: false,
    timer: 0,
    lastSend: 0,
    lastReset: 0,
    panelOpen: false,
    racing: false,
    public: false,
    publicName: '',
    maxPlayers: RACER_MP_MAX,
    publicCounts: {},
    publicProbing: false,
    players: [],
    remotes: {},
    camFrames: {},
    camLastSend: 0,
    camRequested: false,
    status: ''
};

const PRESENCE_ONLINE_MS = 90000;
const PRESENCE_HEARTBEAT_MS = 25000;
let presenceTimer = 0;
let activityChannel = null;
let activitySubscribed = false;
let liveActivities = {};
let friendsAutoTimer = 0;
let friendsStatusTimer = 0;
let profileBanTarget = { username: '', banned: false };
let profileGiftTarget = '';
let friendData = { friendships: [], presence: {}, users: [], activities: {} };

const SITE_SETTINGS_DEFAULTS = {
    announcement: '',
    maintenance: false,
    shells_multiplier: 1,
    featured_game: '',
    disabled_games: [],
    allow_uploads: true,
    max_upload_mb: 2,
    allow_replies: true,
    allow_reactions: true,
    registration_open: true,
    community_open: true
};
let siteSettings = Object.assign({}, SITE_SETTINGS_DEFAULTS);
let siteSettingsLoaded = false;

function normalizeSiteSettings(row) {
    const next = Object.assign({}, SITE_SETTINGS_DEFAULTS);
    if (!row) return next;
    if (typeof row.announcement === 'string') next.announcement = row.announcement;
    next.maintenance = !!row.maintenance;
    const mult = Number(row.shells_multiplier);
    next.shells_multiplier = isFinite(mult) && mult >= 0 && mult <= 20 ? mult : 1;
    if (typeof row.featured_game === 'string') next.featured_game = row.featured_game;
    if (Array.isArray(row.disabled_games)) next.disabled_games = row.disabled_games.map(String);

    ['allow_uploads', 'allow_replies', 'allow_reactions', 'registration_open', 'community_open'].forEach(function (key) {
        if (typeof row[key] === 'boolean') next[key] = row[key];
    });
    const uploadLimit = Number(row.max_upload_mb);
    next.max_upload_mb = isFinite(uploadLimit) && uploadLimit >= 0 && uploadLimit <= 10 ? uploadLimit : 2;
    return next;
}

function gameBySlug(slug) {
    return games.find(function (game) {
        return String(game.id) === String(slug) || game.name.toLowerCase() === String(slug).toLowerCase();
    }) || null;
}

function applySiteSettings() {
    const banner = document.getElementById('promoBanner');
    const promoText = document.getElementById('promoText');
    if (banner && promoText) {
        if (siteSettings.announcement) {
            promoText.textContent = siteSettings.announcement;
            banner.style.display = '';
        } else if (!banner.dataset.dismissed) {
            banner.style.display = 'none';
        }
    }

    const overlay = document.getElementById('maintenanceOverlay');
    if (overlay) {
        const blocked = siteSettings.maintenance && !isOwner();
        overlay.style.display = blocked ? 'flex' : 'none';
        document.body.classList.toggle('is-maintenance', blocked);
    }

    const communityClosed = !siteSettings.community_open && !isOwner();
    const postForm = document.getElementById('communityPostForm');
    if (postForm) {
        postForm.classList.toggle('is-closed', communityClosed);
        const note = document.getElementById('communityClosedNote');
        if (note) note.style.display = communityClosed ? 'block' : 'none';
        const textarea = document.getElementById('postContent');
        const submit = document.getElementById('postSubmitBtn');
        const media = document.getElementById('postMediaInput');
        if (textarea) textarea.disabled = communityClosed;
        if (submit) submit.disabled = communityClosed;
        if (media) media.disabled = communityClosed || !siteSettings.allow_uploads;
    }
    const mediaHint = document.getElementById('postMediaHint');
    if (mediaHint) {
        mediaHint.textContent = !siteSettings.allow_uploads
            ? 'Uploads are currently disabled.'
            : 'Images are compressed. Up to ' + siteSettings.max_upload_mb + ' MB.';
    }
    document.body.classList.toggle('community-closed', communityClosed);
}

async function loadSiteSettings() {
    if (!supabaseClient) {
        siteSettingsLoaded = true;
        applySiteSettings();
        return;
    }
    try {
        const res = await supabaseClient.from('site_settings').select('*').eq('id', 1).maybeSingle();
        if (!res.error && res.data) siteSettings = normalizeSiteSettings(res.data);
    } catch (e) {}
    siteSettingsLoaded = true;
    applySiteSettings();
    renderGames();
    if (isOwner() && currentView === 'debug' && debugTab === 'site') renderDebugSite();
}

async function saveSiteSettings(next) {
    siteSettings = normalizeSiteSettings(next);
    applySiteSettings();
    renderGames();
    if (!supabaseClient) return { error: { message: 'Supabase is unavailable.' } };
    try {
        const res = await supabaseClient.from('site_settings').upsert({
            id: 1,
            announcement: siteSettings.announcement,
            maintenance: siteSettings.maintenance,
            shells_multiplier: siteSettings.shells_multiplier,
            featured_game: siteSettings.featured_game,
            disabled_games: siteSettings.disabled_games,
            allow_uploads: siteSettings.allow_uploads,
            max_upload_mb: siteSettings.max_upload_mb,
            allow_replies: siteSettings.allow_replies,
            allow_reactions: siteSettings.allow_reactions,
            registration_open: siteSettings.registration_open,
            community_open: siteSettings.community_open,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        return res || { error: { message: 'No response' } };
    } catch (e) {
        return { error: { message: (e && e.message) || 'Request failed' } };
    }
}

function isOwner() {
    return !!(currentUser && currentUser.type === 'user' && currentUser.username === 'TotallyMason' && currentUser.persistScores !== false);
}

function isDeveloper() {
    return isOwner() || !!(currentUser && currentUser.type === 'user' && currentUser.developer);
}

function parseAdminPowers(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.slice();
    return String(value).split(',').map(function (item) { return item.trim(); }).filter(Boolean);
}

function hasAdminPower(power) {
    if (isOwner()) return true;
    if (!currentUser || currentUser.type !== 'user') return false;
    return parseAdminPowers(currentUser.adminPowers).indexOf(power) >= 0;
}

function isAdminAccount() {
    return isOwner() || !!(currentUser && currentUser.type === 'user' && parseAdminPowers(currentUser.adminPowers).length);
}

function rememberAvatar(username, avatar) {
    if (!username) return;
    avatarCache[String(username).toLowerCase()] = avatar || '';
}

function avatarForUser(username) {
    if (!username) return '';
    if (currentUser && currentUser.type === 'user' && String(currentUser.username).toLowerCase() === String(username).toLowerCase()) {
        return currentUser.avatar || '';
    }
    return avatarCache[String(username).toLowerCase()] || '';
}

function safeAvatarValue(value) {
    const text = String(value || '');
    if (/^data:image\/(png|jpeg|webp);base64,/i.test(text)) return text;
    if (/^https?:\/\//i.test(text)) return text;
    return '';
}

function userAvatarHtml(username, extraClass) {
    const url = safeAvatarValue(avatarForUser(username));
    const initial = escapeHtml(String(username || '?').charAt(0).toUpperCase());
    return '<span class="user-avatar ' + (extraClass || '') + '">' +
        (url ? '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(username || '') + '">' : initial) +
    '</span>';
}

async function loadAvatarCache() {
    if (!supabaseClient) return;
    try {
        const res = await supabaseClient.from('users').select('username, avatar').limit(1000);
        if (res && !res.error && res.data) {
            res.data.forEach(function (row) { rememberAvatar(row.username, row.avatar); });
            if (currentView === 'community') renderCommunity();
            if (currentView === 'users') renderFriends();
        }
    } catch (e) {}
}

function getIcon(name) {
    const icons = {
        "hand.tap": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 12v-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4.5 14a1.6 1.6 0 0 1 2.4-2.1L8 13"/></svg>',
        "hammer": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="m13.5 6.5 4-4 4 4-4 4"/><path d="M17.5 6.5 8 16"/><path d="m5 14 5 5-2.5 2.5a2.1 2.1 0 0 1-3-3L5 14Z"/></svg>',
        "bolt": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>',
        "brain": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M9.5 4A2.5 2.5 0 0 0 7 7v.2A2.6 2.6 0 0 0 5 9.7c0 .8.3 1.5.9 2a2.6 2.6 0 0 0 .1 4.1A2.5 2.5 0 0 0 9.5 20V4Z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 7v.2a2.6 2.6 0 0 1 2 2.5c0 .8-.3 1.5-.9 2a2.6 2.6 0 0 1-.1 4.1A2.5 2.5 0 0 1 14.5 20V4Z"/></svg>',
        "grid": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        "hash": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
        "spade": '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2.8C9 8 4 9.4 4 13.8A4 4 0 0 0 11 16.4L10 21h4l-1-4.6a4 4 0 0 0 7-2.6c0-4.4-5-5.8-8-11Z"/></svg>',
        "dice": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1" fill="white"/><circle cx="16" cy="8" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="8" cy="16" r="1" fill="white"/><circle cx="16" cy="16" r="1" fill="white"/></svg>',
        "circle": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>',
        "scissors": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8.2 7.8 20 20M8.2 16.2 20 4"/></svg>',
        "car": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M4 11h16v6a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H10a2 2 0 0 1-4 0H5a1 1 0 0 1-1-1v-6Z"/><path d="M7 14h.01M17 14h.01"/></svg>',
        "beach": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="17.5" cy="6.5" r="3"/><path d="M2 16c3.2 0 3.2-2 6.4-2s3.2 2 6.4 2 3.2-2 6.2-2"/><path d="M2 20.5c3.2 0 3.2-2 6.4-2s3.2 2 6.4 2 3.2-2 6.2-2"/></svg>',
        "tunnel": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
        "blocks": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="4" y="15" width="16" height="5" rx="1"/><rect x="6" y="9" width="13" height="5" rx="1"/><rect x="8" y="3" width="9" height="5" rx="1"/></svg>',
        "helix": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M7 3c0 3 10 3 10 6S7 12 7 15s10 3 10 6"/><circle cx="17" cy="9" r="1.6" fill="white" stroke="none"/></svg>',
        "rocket": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M12 3c3 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 2-7 5-9Z"/><circle cx="12" cy="9" r="1.6"/><path d="M9 15l-2 4 3-1M15 15l2 4-3-1"/></svg>',
        "skull": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M6 13a6 6 0 0 1 12 0v3a2 2 0 0 1-2 2h-1v2h-2v-2h-2v2H9v-2H8a2 2 0 0 1-2-2v-3Z"/><circle cx="9.5" cy="12" r="1.2" fill="white"/><circle cx="14.5" cy="12" r="1.2" fill="white"/><path d="M11 16h2"/></svg>',
        "snow": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 5l-2 2M12 5l2 2M12 19l-2-2M12 19l2-2M5.6 9.4l2.7-.7M5.6 9.4l.7 2.7M18.4 14.6l-2.7.7M18.4 14.6l-.7-2.7M5.6 14.6l2.7.7M5.6 14.6l.7-2.7M18.4 9.4l-2.7-.7M18.4 9.4l-.7 2.7"/></svg>',
        "draw": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.5 8.5 3 3"/><path d="M4 20h16"/></svg>',
        "plane": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13.5 21 4l-4.5 9.5L21 20l-4 .5-4-5-3.5 3.5.5 3-2 .5-2-4.5-4.5-2 .5-2 3 .5L9 9l-7-1 .5-2.5Z"/></svg>',
        "dart": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 10 6-6M16 2l6 6M12 8l4 4"/><path d="m4 20 8-8"/><path d="m2 18 2-2 4 4-2 2-4-4Z"/><path d="M13 11l-2 2"/></svg>',
        "paw": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="15.5" rx="4.6" ry="4"/><circle cx="5.5" cy="10" r="2.1"/><circle cx="9.5" cy="6.3" r="2.1"/><circle cx="14.5" cy="6.3" r="2.1"/><circle cx="18.5" cy="10" r="2.1"/></svg>',
    };
    return icons[name] || '';
}

let viewLoaderShownAt = 0;
let viewLoaderHideTimer = 0;

function showViewLoader(label) {
    var el = document.getElementById('viewLoader');
    var title = document.getElementById('viewLoaderTitle');
    if (!el) return;
    if (title) title.textContent = label || 'Loading…';
    clearTimeout(viewLoaderHideTimer);
    viewLoaderShownAt = Date.now();
    el.style.display = 'flex';
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
}

function hideViewLoader() {
    var el = document.getElementById('viewLoader');
    if (!el) return;
    var wait = Math.max(0, 340 - (Date.now() - viewLoaderShownAt));
    clearTimeout(viewLoaderHideTimer);
    viewLoaderHideTimer = setTimeout(function () {
        el.classList.remove('is-visible');
        setTimeout(function () {
            if (!el.classList.contains('is-visible')) el.style.display = 'none';
        }, 240);
    }, wait);
}

let viewRenderToken = 0;
function renderViewDeferred(label, fn) {
    var token = ++viewRenderToken;
    showViewLoader(label);
    setTimeout(function () {
        if (token !== viewRenderToken) return;
        var result;
        try { result = fn(); } catch (e) { hideViewLoader(); return; }
        Promise.resolve(result).finally(function () {
            if (token === viewRenderToken) hideViewLoader();
        });
    }, 40);
}

function showView(view) {
    if (view === 'debug' && (!isOwner() || !ownerUnlocked)) {
        alert('Owner tools are locked. Sign in as TotallyMason and unlock them first.');
        return;
    }
    window.scrollTo(0, 0);
    document.getElementById('gamesView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    if (document.getElementById('garageView')) document.getElementById('garageView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('communityView').style.display = 'none';
    if(document.getElementById('usersView')) document.getElementById('usersView').style.display = 'none';
    if(document.getElementById('debugView')) document.getElementById('debugView').style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('profileModal')) document.getElementById('profileModal').style.display = 'none';
    if (view === 'games') { document.getElementById('gamesView').style.display = 'block'; document.getElementById('nav-games').classList.add('active'); }
    else if (view === 'community') {
        document.getElementById('communityView').style.display = 'block';
        document.getElementById('nav-community').classList.add('active');
        communityVisibleCount = COMMUNITY_PAGE_SIZE;
        renderViewDeferred('Opening Community…', function () { return renderCommunity(); });
    }
    else if (view === 'users') {
        if (document.getElementById('usersView')) {
            document.getElementById('usersView').style.display = 'block';
            document.getElementById('nav-users').classList.add('active');
            renderViewDeferred('Opening Friends…', function () { renderFriends(); partyRender(); });
        }
    }
    else if (view === 'store') {
        document.getElementById('storeView').style.display = 'block';
        document.getElementById('nav-store').classList.add('active');
        renderViewDeferred('Opening Store…', function () { renderWalletUI(); renderStore(); });
    }
    else if (view === 'garage') {
        document.getElementById('garageView').style.display = 'block';
        var gnav = document.getElementById('nav-garage');
        if (gnav) gnav.classList.add('active');
        renderViewDeferred('Opening Garage…', function () { renderWalletUI(); renderGarage(); });
    }
    else if (view === 'settings') { document.getElementById('settingsView').style.display = 'block'; document.getElementById('nav-settings').classList.add('active'); }
    else if (view === 'debug') {
        document.getElementById('debugView').style.display = 'block';
        document.getElementById('nav-debug').classList.add('active');
        renderViewDeferred('Opening Owner Tools…', function () { renderDebugUsers(); });
    }
    currentView = view;
    touchPresence();
}

function updateSnowCountdown() {
    var el = document.getElementById('snowCountdown');
    if (!el) return;
    var now = new Date();
    var year = now.getFullYear();
    var target = new Date(year, 11, 25, 0, 0, 0);
    if (now > target) target = new Date(year + 1, 11, 25, 0, 0, 0);
    var diff = Math.max(0, target.getTime() - now.getTime());
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor(diff / 3600000) % 24;
    var mins = Math.floor(diff / 60000) % 60;
    el.textContent = 'Christmas in ' + days + 'd ' + hours + 'h ' + mins + 'm · limited event';
}

async function renderSnowLeaderboard() {
    var host = document.getElementById('snowLeaderboardList');
    if (!host) return;
    var best = 0;
    try { best = Number(localStorage.getItem('lessfun_snowrush_best')) || 0; } catch (e) {}
    var rows = [];
    if (supabaseClient) {
        try {
            var res = await supabaseClient.from('scores').select('username,score').eq('game', 'Snow Rush').order('score', { ascending: false }).limit(5);
            if (!res.error && Array.isArray(res.data)) rows = res.data;
        } catch (e) {}
    }
    if (!rows.length) {
        host.innerHTML = '<p class="snow-empty">No scores yet. Your best: <b>' + best.toLocaleString() + '</b></p>';
        return;
    }
    host.innerHTML = rows.map(function (row, index) {
        return '<div class="snow-score-row"><span>' + (index + 1) + '</span><b>' + escapeHtml(row.username || 'Player') + '</b><strong>' + Number(row.score || 0).toLocaleString() + '</strong></div>';
    }).join('');
}

function initSnowEvent() {
    updateSnowCountdown();
    setInterval(updateSnowCountdown, 60000);
    renderSnowLeaderboard();
}

function trackRecentGame(id) {
    try {
        var raw = localStorage.getItem('lessfun_recent_games');
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        list = list.filter(function (x) { return Number(x) !== Number(id); });
        list.unshift(Number(id));
        list = list.slice(0, 4);
        localStorage.setItem('lessfun_recent_games', JSON.stringify(list));
    } catch (e) {}
    renderRecentGames();
}

function renderRecentGames() {
    var host = document.getElementById('recentGames');
    if (!host) return;
    var ids = [];
    try {
        var raw = localStorage.getItem('lessfun_recent_games');
        ids = raw ? JSON.parse(raw) : [];
    } catch (e) { ids = []; }
    if (!Array.isArray(ids)) ids = [];
    var items = ids.map(function (id) { return games.find(function (g) { return g.id === Number(id); }); }).filter(Boolean);
    if (!items.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
    host.style.display = 'flex';
    host.innerHTML = '<span class="recent-label">RECENTLY PLAYED</span>' + items.map(function (game) {
        return '<button type="button" class="recent-chip" onclick="openGame(' + game.id + ')">' +
            getIcon(game.icon).replace('width="24" height="24"', 'width="14" height="14"') +
            '<span>' + escapeHtml(game.name) + '</span></button>';
    }).join('');
}

function renderGames() {
    const gameList = document.getElementById('gameList');
    if (!gameList) return;
    const disabled = {};
    siteSettings.disabled_games.forEach(function (slug) {
        const game = gameBySlug(slug);
        if (game) disabled[game.id] = true;
    });
    let list = games.slice();
    if (siteSettings.featured_game) {
        const featured = gameBySlug(siteSettings.featured_game);
        if (featured) {
            list = [featured].concat(list.filter(function (game) { return game.id !== featured.id; }));
        }
    }
    gameList.innerHTML = list.map(game => {
        const locked = disabled[game.id] && !isOwner();
        return `
        <div class="game-card${locked ? ' is-disabled' : ''}" onclick="openGame(${game.id})" onpointerenter="preloadGame(${game.id})">
            <div class="game-icon">${getIcon(game.icon).replace('width="24" height="24"', 'width="28" height="28"')}</div>
            <h3>${game.name}${siteSettings.featured_game && gameBySlug(siteSettings.featured_game) && gameBySlug(siteSettings.featured_game).id === game.id ? ' <span class="game-featured-tag">FEATURED</span>' : ''}</h3>
            <p>${game.description}</p>
            ${locked ? '<span class="game-locked-tag">Temporarily unavailable</span>' : ''}
        </div>
    `;
    }).join('');
}

function isGameDisabled(id) {
    if (isOwner()) return false;
    return siteSettings.disabled_games.some(function (slug) {
        const game = gameBySlug(slug);
        return game && game.id === id;
    });
}

function garageEquippedName(type) {
    if (!wallet) return '—';
    const item = COSMETICS.find(function (c) { return c.id === wallet.equipped[type]; });
    return item ? item.name : '—';
}

function renderGarageStats() {
    const host = document.getElementById('g3dGarageStats');
    if (!host) return;
    const perf = getEquippedCosmetics().performance || {};
    const car = getEquippedCar();
    const carName = car ? car.year + ' ' + car.brand + ' ' + car.model : 'Free Junk Beater';
    const topMph = Math.round(192 * (perf.topSpeed || 1) * 2.23694);
    function chip(label, value) {
        return '<span class="game3d-garage-chip"><strong>' + escapeHtml(label) + '</strong> ' + escapeHtml(value) + '</span>';
    }
    host.innerHTML =
        chip('Car', carName) +
        chip('Top', topMph + ' mph') +
        chip('Accel', (perf.accel || 1).toFixed(2) + 'x') +
        chip('Grip', (perf.grip || 1).toFixed(2) + 'x');
}

function startMenuSolo() {
    const menu = document.getElementById('g3dStartMenu');
    if (menu) menu.style.display = 'none';
    if (window.Games3D) window.Games3D.setPaused(false);
    touchPresence();
}

function startMenuMultiplayer() {
    const menu = document.getElementById('g3dStartMenu');
    if (menu) menu.style.display = 'none';
    if (window.Games3D) window.Games3D.setPaused(false);
    arcadeMpJoin();
}

function openRaceChoice() {
    var el = document.getElementById('g3dRaceChoice');
    if (el) el.style.display = 'flex';
}

function closeRaceChoice() {
    var el = document.getElementById('g3dRaceChoice');
    if (el) el.style.display = 'none';
}

function startRaceAi() {
    closeRaceChoice();
    garageRace();
}

function startRaceMultiplayer() {
    closeRaceChoice();
    garageMultiplayer();
}

function garageCity() {
    cityModeSetting = true;
    raceModeSetting = false;
    raceAiSetting = false;
    garagePlay(false);
}

function garageRace() {
    cityModeSetting = false;
    garagePlay(true);
}

function garageMultiplayer() {
    raceModeSetting = true;
    raceAiSetting = false;
    garagePlay(true);
    openRacerMpPanel();
}

function showGameToast(message) {
    const el = document.getElementById('globalToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    if (gameToastTimer) clearTimeout(gameToastTimer);
    gameToastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 3600);
}

function grantMultiplayerSessionReward() {
    if (mpRewardSessionClaimed || !wallet) return;
    mpRewardSessionClaimed = true;
    wallet.shells = (Number(wallet.shells) || 0) + 500;
    wallet.totalEarned = (Number(wallet.totalEarned) || 0) + 500;
    saveWallet();
    renderWalletUI();
    showGameToast('Multiplayer with friends · +500 Coins');
}

function garagePlay(raceMode) {
    raceModeSetting = !!raceMode;
    raceAiSetting = !!raceMode;
    cityModeSetting = false;
    const garage = document.getElementById('g3dGarage');
    if (garage) garage.style.display = 'none';
    const shop = document.getElementById('g3dGarageShop');
    if (shop) shop.style.display = 'none';
    const wrap = document.querySelector('#modalGameBody .game3d-wrap');
    if (wrap) wrap.classList.remove('is-garage');
    garageSuppressed = true;
    // Re-open the game so the race options are passed through to a fresh
    // Games3D session. restartGame3D() would reuse the old garage options.
    openGame(1);
    if (window.Games3D) {
        if (window.Games3D.setGarageMode) window.Games3D.setGarageMode(false);
        window.Games3D.setPaused(false);
    }
    touchPresence();
}

function renderGarageShop() {
    const content = document.getElementById('g3dShopContent');
    if (!content) return;
    if (!wallet) {
        content.innerHTML = '<p class="store-loading">Loading garage…</p>';
        return;
    }
    const categories = COSMETIC_CATEGORIES.filter(function (category) {
        return GARAGE_COSMETIC_TYPES.indexOf(category.type) >= 0;
    });
    if (garageFilter !== 'all' && GARAGE_COSMETIC_TYPES.indexOf(garageFilter) < 0) garageFilter = 'all';
    const tabs = document.getElementById('g3dShopTabs');
    if (tabs) {
        tabs.innerHTML = '<button class="store-tab' + (garageFilter === 'all' ? ' active' : '') + '" onclick="setGarageShopFilter(\'all\')">All</button>' +
            categories.map(function (category) {
                return '<button class="store-tab' + (garageFilter === category.type ? ' active' : '') + '" onclick="setGarageShopFilter(\'' + category.type + '\')">' +
                    escapeHtml(category.label) + '</button>';
            }).join('');
    }
    content.innerHTML = categories.filter(function (category) {
        return garageFilter === 'all' || category.type === garageFilter;
    }).map(function (category) {
        const cards = cosmeticCards(category.type, '');
        if (!cards) return '';
        return '<section class="store-section">' +
            '<div class="store-section-head"><h2 class="store-heading">' + escapeHtml(category.label) + '</h2>' +
            '<p class="store-blurb">' + escapeHtml(category.blurb) + '</p></div>' +
            '<div class="cosmetic-grid">' + cards + '</div>' +
        '</section>';
    }).join('');
    const balance = document.getElementById('g3dShopBalance');
    if (balance) balance.textContent = wallet.shells.toLocaleString() + ' Coins';
}

function setGarageShopFilter(type) {
    garageFilter = type;
    renderGarageShop();
}

function openGarageShop() {
    if (currentGameId !== 1) return;
    const shop = document.getElementById('g3dGarageShop');
    if (shop) shop.style.display = 'flex';
    if (window.Games3D) window.Games3D.setPaused(true);
    renderGarageShop();
}

function closeGarageShop() {
    const shop = document.getElementById('g3dGarageShop');
    if (shop) shop.style.display = 'none';
    if (window.Games3D) window.Games3D.setPaused(false);
    renderGarageStats();
}

function flashGarageShopStatus(message, isError) {
    const el = document.getElementById('g3dShopStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', !!isError);
}

function openGarageStore() {
    if (currentGameId === 1) { openGarageShop(); return; }
    closeGame();
    showView('garage');
}

function mobileHold(control, on) {
    if (!window.Games3D) return;
    if (control === 'nitro' && window.Games3D.setNitro) window.Games3D.setNitro(!!on);
    if (control === 'drift' && window.Games3D.setDrift) window.Games3D.setDrift(!!on);
}

let fpsStickState = { id: null, el: null, cx: 0, cy: 0 };

function mobileFpsMove(x, y) {
    if (window.Games3D && window.Games3D.setMobileMove) window.Games3D.setMobileMove(x, y);
}

function mobileFpsFire(on) {
    if (window.Games3D && window.Games3D.setMobileFiring) window.Games3D.setMobileFiring(!!on);
}

function mobileFpsAction(name) {
    if (window.Games3D && window.Games3D.mobileFpsAction) window.Games3D.mobileFpsAction(name);
}

function fpsStickStart(event) {
    event.preventDefault();
    const el = document.getElementById('g3dFpsStick');
    if (!el) return;
    const r = el.getBoundingClientRect();
    fpsStickState.id = event.pointerId;
    fpsStickState.el = el;
    fpsStickState.cx = r.left + r.width / 2;
    fpsStickState.cy = r.top + r.height / 2;
    try { el.setPointerCapture(event.pointerId); } catch (e) {}
    fpsStickMove(event);
}

function fpsStickMove(event) {
    if (fpsStickState.id === null || event.pointerId !== fpsStickState.id) return;
    event.preventDefault();
    let dx = (event.clientX - fpsStickState.cx) / 46;
    let dy = (fpsStickState.cy - event.clientY) / 46;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    const knob = document.getElementById('g3dFpsKnob');
    if (knob) { knob.style.transform = 'translate(' + (dx * 28) + 'px,' + (-dy * 28) + 'px)'; }
    mobileFpsMove(dx, dy);
}

function fpsStickEnd(event) {
    if (fpsStickState.id !== null && event.pointerId !== fpsStickState.id) return;
    fpsStickState.id = null;
    fpsStickState.el = null;
    const knob = document.getElementById('g3dFpsKnob');
    if (knob) knob.style.transform = '';
    mobileFpsMove(0, 0);
}

document.addEventListener('pointermove', fpsStickMove, { passive: false });
document.addEventListener('pointerup', fpsStickEnd);
document.addEventListener('pointercancel', fpsStickEnd);

const ZOMBIE_SHOP = {
    pistol: { name: 'Pistol', price: 0, sell: 0, damage: 42, mag: 12, note: 'Reliable semi-auto', auto: false },
    rifle: { name: 'Rifle', price: 300, sell: 150, damage: 27, mag: 30, note: 'Full-auto suppression', auto: true },
    shotgun: { name: 'Shotgun', price: 500, sell: 250, damage: 18, mag: 6, note: '7-pellet close range', auto: false }
};
const ZOMBIE_UPGRADE_COSTS = [200, 350, 550];

function zombieLoadoutKey() {
    return 'lessfun_zombie_loadout_' + ((currentUser && currentUser.username) || 'guest');
}

function getZombieLoadout() {
    let data = null;
    if (wallet && wallet.zombie && typeof wallet.zombie === 'object') data = wallet.zombie;
    if (!data) {
        try { data = JSON.parse(localStorage.getItem(zombieLoadoutKey()) || 'null'); } catch (e) {}
    }
    if (!data || typeof data !== 'object') data = {};
    const owned = Array.isArray(data.owned) && data.owned.length ? data.owned.slice() : ['pistol'];
    if (owned.indexOf('pistol') < 0) owned.unshift('pistol');
    const upgrades = data.upgrades && typeof data.upgrades === 'object' ? data.upgrades : {};
    const equipped = owned.indexOf(data.equipped) >= 0 ? data.equipped : 'pistol';
    return { owned: owned, equipped: equipped, upgrades: upgrades };
}

function saveZombieLoadout(data) {
    try { localStorage.setItem(zombieLoadoutKey(), JSON.stringify(data)); } catch (e) {}
    if (wallet) wallet.zombie = data;
}

function zombieArmoryStatus(message, isError) {
    const el = document.getElementById('g3dArmoryStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', !!isError);
}

function openZombieArmory() {
    const panel = document.getElementById('g3dZombieArmory');
    if (!panel) return;
    if (window.Games3D) window.Games3D.setPaused(true);
    panel.style.display = 'flex';
    renderZombieArmory();
    zombieArmoryStatus('Buy, sell, equip, and upgrade weapons.', false);
}

function closeZombieArmory() {
    const panel = document.getElementById('g3dZombieArmory');
    if (panel) panel.style.display = 'none';
    const menu = document.getElementById('g3dStartMenu');
    if (window.Games3D) window.Games3D.setPaused(!!(menu && menu.style.display !== 'none'));
}

function renderZombieArmory() {
    const list = document.getElementById('g3dArmoryList');
    const balance = document.getElementById('g3dArmoryBalance');
    const label = document.getElementById('g3dArmoryWeaponLabel');
    if (!list) return;
    const loadout = getZombieLoadout();
    const coins = wallet ? Number(wallet.shells) || 0 : 0;
    if (balance) balance.textContent = coins.toLocaleString() + ' Coins';
    if (label) {
        const level = Number(loadout.upgrades[loadout.equipped] || 0) + 1;
        label.textContent = ZOMBIE_SHOP[loadout.equipped].name + ' · MK ' + level;
    }
    list.innerHTML = Object.keys(ZOMBIE_SHOP).map(function (key) {
        const weapon = ZOMBIE_SHOP[key];
        const owned = loadout.owned.indexOf(key) >= 0;
        const equipped = loadout.equipped === key;
        const level = Number(loadout.upgrades[key] || 0);
        const nextCost = level < ZOMBIE_UPGRADE_COSTS.length ? ZOMBIE_UPGRADE_COSTS[level] : 0;
        const damage = Math.round(weapon.damage * (1 + level * 0.15));
        return '<article class="zombie-weapon-card' + (owned ? ' is-owned' : '') + (equipped ? ' is-equipped' : '') + '">' +
            '<div class="zombie-weapon-top">' +
                '<div><h3>' + escapeHtml(weapon.name) + '</h3><p>' + escapeHtml(weapon.note) + '</p></div>' +
                (equipped ? '<span class="zombie-weapon-equipped">EQUIPPED</span>' : '') +
            '</div>' +
            '<div class="zombie-weapon-stats">' +
                '<span><strong>' + damage + '</strong> damage</span>' +
                '<span><strong>' + weapon.mag + '</strong> mag</span>' +
                '<span>MK ' + (level + 1) + '</span>' +
            '</div>' +
            '<div class="zombie-weapon-actions">' +
                (!owned ? '<button type="button" class="zombie-weapon-buy" onclick="zombieBuyWeapon(\'' + key + '\')">Buy · ' + weapon.price + '</button>' :
                    (equipped ? '<button type="button" disabled class="zombie-weapon-equipped-btn">Equipped</button>' :
                        '<button type="button" class="zombie-weapon-equip" onclick="zombieEquipWeapon(\'' + key + '\')">Equip</button>') +
                    '<button type="button" class="zombie-weapon-upgrade" onclick="zombieUpgradeWeapon(\'' + key + '\')"' + (level >= 3 ? ' disabled' : '') + '>' + (level >= 3 ? 'Max upgrade' : 'Upgrade · ' + nextCost) + '</button>' +
                    (key !== 'pistol' ? '<button type="button" class="zombie-weapon-sell" onclick="zombieSellWeapon(\'' + key + '\')">Sell · ' + weapon.sell + '</button>' : '')) +
            '</div>' +
        '</article>';
    }).join('');
}

async function zombieBuyWeapon(key) {
    const weapon = ZOMBIE_SHOP[key];
    const loadout = getZombieLoadout();
    if (!weapon || loadout.owned.indexOf(key) >= 0) return;
    if (!wallet) { zombieArmoryStatus('Wallet is still loading.', true); return; }
    if (Number(wallet.shells) < weapon.price) {
        zombieArmoryStatus('Not enough Coins. You need ' + (weapon.price - Number(wallet.shells)).toLocaleString() + ' more.', true);
        return;
    }
    wallet.shells -= weapon.price;
    loadout.owned.push(key);
    loadout.equipped = key;
    saveZombieLoadout(loadout);
    await saveWallet();
    renderZombieArmory();
    zombieArmoryStatus('Purchased and equipped ' + weapon.name + '.', false);
}

async function zombieSellWeapon(key) {
    const weapon = ZOMBIE_SHOP[key];
    const loadout = getZombieLoadout();
    if (!weapon || key === 'pistol' || loadout.owned.indexOf(key) < 0) return;
    if (wallet) {
        wallet.shells = Number(wallet.shells) + weapon.sell;
        await saveWallet();
    }
    loadout.owned = loadout.owned.filter(function (entry) { return entry !== key; });
    delete loadout.upgrades[key];
    if (loadout.equipped === key) loadout.equipped = 'pistol';
    saveZombieLoadout(loadout);
    if (wallet) await saveWallet();
    renderZombieArmory();
    zombieArmoryStatus('Sold ' + weapon.name + ' for ' + weapon.sell + ' Coins.', false);
}

async function zombieUpgradeWeapon(key) {
    const weapon = ZOMBIE_SHOP[key];
    const loadout = getZombieLoadout();
    if (!weapon || loadout.owned.indexOf(key) < 0) return;
    const level = Number(loadout.upgrades[key] || 0);
    const cost = ZOMBIE_UPGRADE_COSTS[level];
    if (!cost) { zombieArmoryStatus('This weapon is fully upgraded.', false); return; }
    if (!wallet || Number(wallet.shells) < cost) {
        zombieArmoryStatus('Not enough Coins. Upgrade costs ' + cost + '.', true);
        return;
    }
    wallet.shells -= cost;
    loadout.upgrades[key] = level + 1;
    saveZombieLoadout(loadout);
    await saveWallet();
    renderZombieArmory();
    zombieArmoryStatus(weapon.name + ' upgraded to MK ' + (level + 2) + '.', false);
}

async function zombieEquipWeapon(key) {
    const loadout = getZombieLoadout();
    if (loadout.owned.indexOf(key) < 0) return;
    loadout.equipped = key;
    saveZombieLoadout(loadout);
    if (wallet) await saveWallet();
    renderZombieArmory();
    zombieArmoryStatus(ZOMBIE_SHOP[key].name + ' equipped.', false);
}

function mobileShift(direction) {
    if (window.Games3D && window.Games3D.shiftGear) window.Games3D.shiftGear(direction > 0 ? 1 : -1);
}

function setRacerGear(mode) {
    if (window.Games3D && window.Games3D.setGearMode) window.Games3D.setGearMode(mode);
}


function mobileFsd() {
    if (window.Games3D && window.Games3D.toggleFsd) window.Games3D.toggleFsd();
}

let currentGameId = null;
let raceModeSetting = false;
let raceAiSetting = false;
let cityModeSetting = false;
let garageSuppressed = false;
let startMenuSuppressed = false;
let mpRewardSessionClaimed = false;
let gameToastTimer = 0;
let snowStormMode = false;

const lazyScripts = {};
function loadScriptOnce(src) {
    if (lazyScripts[src]) return lazyScripts[src];
    lazyScripts[src] = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = function () { resolve(); };
        script.onerror = function () { delete lazyScripts[src]; reject(new Error('Could not load ' + src)); };
        document.body.appendChild(script);
    });
    return lazyScripts[src];
}

let enginePromise = null;
let landingPromise = null;
let tranqPromise = null;
let assistantPromise = null;
let drawGuessPromise = null;
let luckyPromise = null;
let gameOpenToken = 0;

function ensure3DEngine() {
    if (window.Games3D) return Promise.resolve();
    if (!enginePromise) {
        enginePromise = loadScriptOnce('https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js')
            .then(function () { return loadScriptOnce('https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js'); })
            .then(function () { return loadScriptOnce('games3d.js?v=20261295'); })
            .catch(function (error) { enginePromise = null; throw error; });
    }
    return enginePromise;
}

function ensureLanding() {
    if (typeof openLandingSim === 'function') return Promise.resolve();
    if (!landingPromise) {
        landingPromise = loadScriptOnce('landing.js?v=20261295').catch(function (error) { landingPromise = null; throw error; });
    }
    return landingPromise;
}

function ensureTranq() {
    if (typeof openTranqGame === 'function') return Promise.resolve();
    if (!tranqPromise) {
        tranqPromise = loadScriptOnce('tranq.js?v=20261295').catch(function (error) { tranqPromise = null; throw error; });
    }
    return tranqPromise;
}

function ensureAssistant() {
    if (window.LessFunAI) return Promise.resolve();
    if (!assistantPromise) {
        assistantPromise = loadScriptOnce('assistant-data.js?v=20261295')
            .then(function () { return loadScriptOnce('assistant.js?v=20261295'); })
            .catch(function (error) { assistantPromise = null; throw error; });
    }
    return assistantPromise;
}

function openAssistant() {
    if (window.LessFunAI) { LessFunAI.open(); return; }
    ensureAssistant().then(function () { if (window.LessFunAI) LessFunAI.open(); }).catch(function () {
        if (typeof showGameToast === 'function') showGameToast('Could not load the assistant.');
    });
}

function ensureDrawGuess() {
    if (typeof openDrawGuessGame === 'function') return Promise.resolve();
    if (!drawGuessPromise) {
        drawGuessPromise = loadScriptOnce('drawguess.js?v=20261295').catch(function (error) { drawGuessPromise = null; throw error; });
    }
    return drawGuessPromise;
}

function ensureLucky() {
    if (typeof openLuckySpinGame === 'function') return Promise.resolve();
    if (!luckyPromise) {
        luckyPromise = loadScriptOnce('lucky.js?v=20261295').catch(function (error) { luckyPromise = null; throw error; });
    }
    return luckyPromise;
}

function preloadGame(id) {
    if (id === 13) { ensureLanding().catch(function () {}); return; }
    if (id === 14) { ensureTranq().catch(function () {}); return; }
    if (id === 8) { ensureDrawGuess().catch(function () {}); return; }
    if (id === 9) { ensureLucky().catch(function () {}); return; }
    if (id === 6) return;
    ensure3DEngine().catch(function () {});
}

function startSnowStorm() {
    snowStormMode = true;
    openGame(7);
}

function openGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    const token = ++gameOpenToken;
    if (id === 6) { openGameNow(id); return; }
    if (id === 8) {
        showViewLoader('Loading ' + game.name + '…');
        ensureDrawGuess().then(function () { if (token === gameOpenToken) { openGameNow(id); hideViewLoader(); } }).catch(function () {
            hideViewLoader();
            alert('Could not load ' + game.name + '. Check your connection and try again.');
        });
        return;
    }
    if (id === 9) {
        showViewLoader('Loading ' + game.name + '…');
        ensureLucky().then(function () { if (token === gameOpenToken) { openGameNow(id); hideViewLoader(); } }).catch(function () {
            hideViewLoader();
            alert('Could not load ' + game.name + '. Check your connection and try again.');
        });
        return;
    }
    if (id === 13) {
        showViewLoader('Loading ' + game.name + '…');
        ensureLanding().then(function () { if (token === gameOpenToken) { openGameNow(id); hideViewLoader(); } }).catch(function () {
            hideViewLoader();
            alert('Could not load ' + game.name + '. Check your connection and try again.');
        });
        return;
    }
    if (id === 14) {
        showViewLoader('Loading ' + game.name + '…');
        ensureTranq().then(function () { if (token === gameOpenToken) { openGameNow(id); hideViewLoader(); } }).catch(function () {
            hideViewLoader();
            alert('Could not load ' + game.name + '. Check your connection and try again.');
        });
        return;
    }
    showViewLoader('Loading ' + game.name + '…');
    ensure3DEngine().then(function () {
        if (token === gameOpenToken) { openGameNow(id); hideViewLoader(); }
    }).catch(function () {
        hideViewLoader();
        alert('Could not load the 3D engine. Check your connection and try again.');
    });
}

function openGameNow(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    document.body.classList.add('in-game');
    if (arcadeMp.connected && arcadeMp.gameId && arcadeMp.gameId !== id) arcadeMpLeave(true);
    if (zombieMp.connected && id !== 4) zombieMpLeave(true);
    if (isGameDisabled(id)) {
        alert('This game is temporarily unavailable. Check back soon!');
        return;
    }
    if (id === 8) { openDrawGuessGame(); return; }
    if (id === 9) { openLuckySpinGame(); return; }
    if (id === 13) { openLandingSim(); return; }
    if (id === 14) { openTranqGame(); return; }
    currentGameId = id;
    trackRecentGame(id);
    if (id === 4) startMenuSuppressed = false;
    document.getElementById('modalGameTitle').textContent = game.name;
    const body = document.getElementById('modalGameBody');
    body.innerHTML =
        '<div class="game3d-wrap' + (game.fpsMode ? ' is-fps' : '') + '">' +
            '<div class="game3d-hud">' +
                '<div class="game3d-glass">' +
                    '<strong class="game3d-glass-status" id="g3dExtra">-</strong>' +
                    (game.hasThrottle ? '<span class="game3d-glass-sep"></span><span class="game3d-glass-stat game3d-coin-pill"><small>Coins</small><strong id="g3dRunCoins">0</strong></span>' : '') +
                    (game.id === 1 ? '<span class="game3d-glass-sep"></span><div class="g3d-gears" id="g3dGears">' +
                        '<button type="button" data-gear="P" onclick="setRacerGear(\'P\')">P</button>' +
                        '<button type="button" data-gear="R" onclick="setRacerGear(\'R\')">R</button>' +
                        '<button type="button" data-gear="N" onclick="setRacerGear(\'N\')">N</button>' +
                        '<button type="button" data-gear="D" onclick="setRacerGear(\'D\')" class="is-active">D</button>' +
                    '</div>' : '') +
                '</div>' +
            '</div>' +
            '<div id="g3dCanvas" class="game3d-canvas"></div>' +
            (game.id === 4 ?
                '<div class="dc-hud" id="dcHud">' +
                    '<div class="dc-head"><span class="dc-kicker">DEAD COAST · 10 KM RUN</span><strong id="dcDistance">0.00 / 10 km</strong></div>' +
                    '<div class="dc-progress"><i id="dcProgress"></i></div>' +
                    '<div class="dc-bars">' +
                        '<div class="dc-bar-row"><span>Food</span><div class="dc-track"><i id="dcFood" class="is-food"></i></div></div>' +
                        '<div class="dc-bar-row"><span>Water</span><div class="dc-track"><i id="dcWater" class="is-water"></i></div></div>' +
                        '<div class="dc-bar-row"><span>Fuel</span><div class="dc-track"><i id="dcFuel" class="is-fuel"></i></div></div>' +
                    '</div>' +
                    '<div class="dc-health"><span>CAR</span><div class="dc-health-track"><i id="dcHealth"></i></div></div>' +
                    '<div class="dc-part" id="dcPart">Stock Parts</div>' +
                    '<div class="dc-zombies" id="dcZombies">ZOMBIES 0</div>' +
                    '<div class="dc-ammo" id="dcAmmo">AMMO 12 / 48 · R reload · V punch</div>' +
                    '<div class="dc-toast" id="dcToast"></div>' +
                '</div>' : '') +
            (game.id === 4 ?
                '<div class="dc-foot-crosshair" id="dcFootCrosshair" style="display:none;"></div>' +
                '<div class="dc-foot-hint" id="dcFootHint" style="display:none;">WASD move · A/D or drag look · click / Space shoot · E back to car</div>' +
                '<div class="dc-station-prompt" id="dcStationPrompt" style="display:none;">STOP AT FUEL STATION · E / tap to get out & fight</div>' +
                '<div class="dc-station-panel" id="dcStationPanel" style="display:none;">' +
                    '<div class="dc-station-card">' +
                        '<span class="dc-kicker">FUEL STATION</span>' +
                        '<h3>Get out & scavenge</h3>' +
                        '<p id="dcStationMeta">Station</p>' +
                        '<div class="dc-station-stats">' +
                            '<span>Fuel <b id="dcStFuel">100%</b></span>' +
                            '<span>Food <b id="dcStFood">100%</b></span>' +
                            '<span>Water <b id="dcStWater">100%</b></span>' +
                        '</div>' +
                        '<button type="button" id="dcStRefuel">Refuel +60</button>' +
                        '<button type="button" id="dcStFoodBtn">Take food +40</button>' +
                        '<button type="button" id="dcStWaterBtn">Take water +40</button>' +
                        '<button type="button" id="dcStPart">Search for a car part</button>' +
                        '<button type="button" class="dc-station-back" id="dcStClose">Back to car</button>' +
                    '</div>' +
                '</div>' : '') +
            '<div class="game3d-remote-cams" id="g3dRemoteCams" style="display:none;"></div>' +
            (game.fpsMode ?
                '<div class="fps-crosshair" id="g3dFpsCrosshair"><span></span></div>' +
                '<div class="fps-hitmark" id="g3dFpsHit"></div>' +
                '<div class="fps-hud">' +
                    '<div class="fps-stat is-health"><small>Health</small><strong id="g3dFpsHealth">100</strong></div>' +
                    '<div class="fps-stat"><small>Ammo</small><strong id="g3dFpsAmmo">30 / 120</strong></div>' +
                    '<div class="fps-stat"><small>Wave</small><strong id="g3dFpsWave">1</strong></div>' +
                    '<div class="fps-stat"><small>Kills</small><strong id="g3dFpsKills">0</strong></div>' +
                    '<div class="fps-stat"><small>Score</small><strong id="g3dFpsScore">0</strong></div>' +
                    '<div class="fps-stat"><small>Stamina</small><strong id="g3dFpsStamina">100</strong></div>' +
                    '<div class="fps-stat fps-weapon-stat"><small>Weapon</small><strong id="g3dFpsWeapon">Pistol</strong></div>' +
                '</div>' +
                '<div class="fps-needs">' +
                    '<div class="fps-need"><span>Food</span><div class="fps-need-track"><i id="g3dFpsFood"></i></div></div>' +
                    '<div class="fps-need"><span>Water</span><div class="fps-need-track"><i id="g3dFpsWater"></i></div></div>' +
                    '<div class="fps-need"><span id="g3dFpsBandageLabel">Bandage</span><div class="fps-need-track"><i id="g3dFpsBandage"></i></div></div>' +
                '</div>' +
                '<div class="fps-interact" id="g3dFpsInteract"></div>' +
                '<div class="fps-combo" id="g3dFpsCombo"></div>' +
                '<div class="fps-boss" id="g3dFpsBoss"><span>BOSS</span><div class="fps-boss-track"><i id="g3dFpsBossFill"></i></div></div>' +
                '<div class="fps-touch" id="g3dFpsTouch">' +
                    '<div class="fps-stick" id="g3dFpsStick" onpointerdown="fpsStickStart(event)"><span id="g3dFpsKnob"></span></div>' +
                    '<button type="button" class="fps-touch-btn is-fire" onpointerdown="event.preventDefault();mobileFpsFire(true)" onpointerup="mobileFpsFire(false)" onpointercancel="mobileFpsFire(false)" onpointerleave="mobileFpsFire(false)">Fire</button>' +
                    '<button type="button" class="fps-touch-btn is-reload" onpointerdown="event.preventDefault();mobileFpsAction(&quot;reload&quot;)">Reload</button>' +
                    '<button type="button" class="fps-touch-btn is-jump" onpointerdown="event.preventDefault();mobileFpsAction(&quot;jump&quot;)">Jump</button>' +
                    '<button type="button" class="fps-touch-btn is-melee" onpointerdown="event.preventDefault();mobileFpsAction(&quot;melee&quot;)">Melee</button>' +
                    '<button type="button" class="fps-touch-btn is-use" onpointerdown="event.preventDefault();mobileFpsAction(&quot;interact&quot;)">Use</button>' +
                    '<button type="button" class="fps-touch-btn is-swap" onpointerdown="event.preventDefault();mobileFpsAction(&quot;swap&quot;)">Swap</button>' +
                '</div>' +
                '<div class="fps-wave-banner" id="g3dFpsWaveBanner"></div>' +
                '<div class="fps-damage" id="g3dFpsDamage"></div>' +
                '<div class="fps-grade" id="g3dFpsGrade"></div>' +
                '<div class="fps-prompt" id="g3dFpsPrompt">Click to aim · WASD · 1/2/3 weapons · V melee · B bandage · E loot · F light</div>' : '') +
            (game.fpsMode ? '' : '<div class="game3d-hint">' + (game.controls || '') + '</div>') +
            '<div class="game3d-perf" id="g3dPerf"><span id="g3dFps">-- FPS</span><span id="g3dRes">--</span></div>' +
            (game.hasThrottle ? '<button class="game3d-throttle" id="g3dThrottle" type="button">Throttle</button>' : '') +
            (game.hasBrake ? '<button class="game3d-brake" id="g3dBrake" type="button">Brake</button>' : '') +
            (game.hasThrottle && game.id !== 4 ? '<div class="game3d-nitro" id="g3dNitro"><span>N · NOS</span><div class="game3d-bar-track"><div class="game3d-bar-fill" id="g3dNitroFill"></div></div></div>' : '') +
            (game.hasThrottle ?
                '<div class="game3d-pedals" id="g3dPedals">' +
                    '<div class="game3d-pedal-row"><span>THR</span><div class="game3d-pedal-track is-throttle"><i id="g3dThrottleFill"></i></div></div>' +
                    '<div class="game3d-pedal-row"><span>BRK</span><div class="game3d-pedal-track is-brake"><i id="g3dBrakeFill"></i></div></div>' +
                '</div>' : '') +
            (game.hasThrottle && game.id !== 4 ?
                '<div class="game3d-touch-controls">' +
                    '<button type="button" class="game3d-touch-btn is-nitro" onpointerdown="event.preventDefault();mobileHold(\'nitro\',true)" onpointerup="mobileHold(\'nitro\',false)" onpointercancel="mobileHold(\'nitro\',false)" onpointerleave="mobileHold(\'nitro\',false)">NOS</button>' +
                '</div>' : '') +
            '<button class="game3d-msg-btn" id="g3dMsgBtn" type="button" onclick="toggleDmSidebar()">Messages</button>' +

            (game.hasThrottle ?
                '<button class="game3d-mp-btn" id="g3dMpBtn" type="button" onclick="openRacerMpPanel()">Multiplayer</button>' +
                '<div class="game3d-mp" id="g3dMpPanel" style="display:none;">' +
                    '<div class="game3d-mp-card">' +
                        '<div class="game3d-mp-head">' +
                            '<h3>Beach Racer Multiplayer</h3>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeRacerMpPanel()">×</button>' +
                        '</div>' +
                        '<p class="game3d-mp-sub">2–3 players · share a room code · cars pass through each other</p>' +
                        '<div id="g3dMpLobby">' +
                            '<label class="game3d-mp-label" for="g3dMpName">Your name</label>' +
                            '<input class="game3d-mp-input" id="g3dMpName" type="text" maxlength="16" autocomplete="nickname" placeholder="Driver name" onchange="racerMpNameChanged()">' +
                            '<button class="game3d-mp-primary" type="button" onclick="racerMpCreateRoom()">Create room</button>' +
                            '<div class="game3d-mp-or">or join with a code</div>' +
                            '<div class="game3d-mp-join">' +
                                '<input class="game3d-mp-input" id="g3dMpCode" type="text" maxlength="5" placeholder="CODE" autocapitalize="characters" spellcheck="false" onkeydown="if(event.key===\'Enter\')racerMpJoinCode()">' +
                                '<button class="game3d-mp-secondary" type="button" onclick="racerMpJoinCode()">Join</button>' +
                            '</div>' +
                            '<div class="game3d-mp-or">or join a public lobby · 50 racers</div>' +
                            '<div class="game3d-mp-public" id="g3dMpPublicList"></div>' +
                        '</div>' +
                        '<div id="g3dMpRoom" style="display:none;">' +
                            '<div class="game3d-mp-code-row"><span id="g3dMpRoomLabel">Room</span><strong id="g3dMpRoomCode">-----</strong><button type="button" class="game3d-mp-copy" id="g3dMpCopyBtn" onclick="racerMpCopyCode()">Copy</button></div>' +
                            '<div class="game3d-mp-players" id="g3dMpPlayers"></div>' +
                            '<button class="game3d-mp-primary" type="button" id="g3dMpStartBtn" onclick="racerMpStart()">Start race</button>' +
                            '<p class="game3d-mp-guest" id="g3dMpGuestNote" style="display:none;">Only the host can start or restart the race.</p>' +
                            '<button class="game3d-mp-leave" type="button" onclick="racerMpLeave()">Leave room</button>' +
                        '</div>' +
                        '<p class="game3d-mp-status" id="g3dMpStatus"></p>' +
                        '<p class="game3d-mp-note">The race restarts for everyone when a room starts. Player cars never collide with each other.</p>' +
                    '</div>' +
                '</div>' : '') +
            ((game.id === 2 || game.id === 5) ?                '<button class="game3d-mp-btn" id="g3dArcadeMpBtn" type="button" onclick="openArcadeMpPanel()">Multiplayer</button>' +
                '<div class="game3d-mp" id="g3dArcadeMpPanel" style="display:none;">' +
                    '<div class="game3d-mp-card">' +
                        '<div class="game3d-mp-head">' +
                            '<h3 id="g3dArcadeTitle">Live multiplayer</h3>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeArcadeMpPanel()">×</button>' +
                        '</div>' +
                        '<p class="game3d-mp-sub">Public live lobby · no code · up to 20 players · everyone plays at once and scores update live</p>' +
                        '<div class="game3d-mp-players" id="g3dArcadePlayers"></div>' +
                        '<button class="game3d-mp-primary" type="button" id="g3dArcadeJoinBtn" onclick="arcadeMpToggle()">Join live lobby</button>' +
                        '<button class="game3d-mp-leave" type="button" onclick="closeArcadeMpPanel()">Close</button>' +
                        '<p class="game3d-mp-status" id="g3dArcadeStatus"></p>' +
                    '</div>' +
                '</div>' +
                '<div class="game3d-arcade-board" id="g3dArcadeBoard" style="display:none;"></div>' : '') +
            (game.fpsMode ?
                '<button class="game3d-mp-btn" id="g3dZombieMpBtn" type="button" onclick="openZombieMpPanel()">Public Rooms</button>' +
                '<div class="game3d-mp" id="g3dZombieMpPanel" style="display:none;">' +
                    '<div class="game3d-mp-card zombie-mp-card">' +
                        '<div class="game3d-mp-head">' +
                            '<h3>Dead Coast · Public Rooms</h3>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeZombieMpPanel()">×</button>' +
                        '</div>' +
                        '<p class="game3d-mp-sub">Survive together · public rooms · live survivor positions and scores</p>' +
                        '<div id="g3dZombieRoomList" class="zombie-room-list"></div>' +
                        '<div class="game3d-mp-players" id="g3dZombiePlayers"></div>' +
                        '<button class="game3d-mp-leave" type="button" id="g3dZombieJoinBtn" onclick="zombieMpLeave()">Leave public room</button>' +
                        '<p class="game3d-mp-status" id="g3dZombieStatus"></p>' +
                    '</div>' +
                '</div>' : '') +
            (game.fpsMode ?
                '<div class="game3d-start" id="g3dStartMenu">' +
                    '<div class="game3d-start-card zombie-start-card">' +
                        '<span class="game3d-garage-kicker">DEAD COAST · FIRST PERSON</span>' +
                        '<h2>Survive the night</h2>' +
                        '<p>WASD to move, trackpad to look, click to fire. Hold out through endless waves or join a public room.</p>' +
                        '<div class="game3d-start-actions">' +
                            '<button type="button" class="game3d-mp-primary" onclick="startMenuSolo()">Play Solo</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="openZombieMpPanel()">Public Rooms</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="openZombieArmory()">Armory</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="zombie-armory" id="g3dZombieArmory" style="display:none;">' +
                    '<div class="zombie-armory-inner">' +
                        '<div class="zombie-armory-head">' +
                            '<div><span class="game3d-garage-kicker">DEAD COAST · ARMORY</span><h2>Weapons &amp; upgrades</h2></div>' +
                            '<div class="zombie-armory-balance" id="g3dArmoryBalance">— Coins</div>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeZombieArmory()">×</button>' +
                        '</div>' +
                        '<div class="zombie-armory-showcase">' +
                            '<div class="zombie-orbit-avatar"><span class="zombie-avatar-head"></span><span class="zombie-avatar-body"></span></div>' +
                            '<div class="zombie-orbit-gun" id="g3dArmoryGun"><span class="gun-body"></span><span class="gun-barrel"></span><span class="gun-grip"></span><span class="gun-mag"></span></div>' +
                            '<div class="zombie-armory-showcase-label" id="g3dArmoryWeaponLabel">Pistol · MK 1</div>' +
                        '</div>' +
                        '<div class="zombie-armory-list" id="g3dArmoryList"></div>' +
                        '<p class="game3d-mp-status" id="g3dArmoryStatus"></p>' +
                    '</div>' +
                '</div>' : '') +
            ((game.id === 2 || game.id === 5) ?
                '<div class="game3d-start" id="g3dStartMenu">' +
                    '<div class="game3d-start-card">' +
                        '<span class="game3d-garage-kicker">' + escapeHtml(game.name) + '</span>' +
                        '<h2>Ready to play?</h2>' +
                        '<p>Play solo, or jump into the live public lobby with everyone online.</p>' +
                        '<div class="game3d-start-actions">' +
                            '<button type="button" class="game3d-mp-primary" onclick="startMenuSolo()">Play Solo</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="startMenuMultiplayer()">Multiplayer</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' : '') +
            '<div class="game3d-toast" id="g3dToast"></div>' +
            (game.id === 1 ?
                '<div class="game3d-garage" id="g3dGarage">' +
                    '<div class="game3d-garage-card">' +
                        '<span class="game3d-garage-kicker">BEACH RACER · GARAGE</span>' +
                        '<h2>Your ride</h2>' +
                        '<p class="game3d-garage-sub">Buy and drive cars from the Garage. No part customisation.</p>' +
                        '<div class="game3d-garage-stats" id="g3dGarageStats"></div>' +
                        '<div class="game3d-garage-actions">' +
                            '<button type="button" class="game3d-mp-primary" onclick="garagePlay()">Play</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="openRaceChoice()">Race</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="openShowroom()">Garage</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="game3d-race-choice" id="g3dRaceChoice" style="display:none;">' +
                        '<div class="game3d-race-choice-card">' +
                            '<span class="game3d-garage-kicker">BEACH RACER · RACE</span>' +
                            '<h2>Choose your race</h2>' +
                            '<p>Closed 3-lap circuit · no traffic</p>' +
                            '<button type="button" class="game3d-race-option is-ai" onclick="startRaceAi()">' +
                                '<strong>Race AI</strong><span>You + 4 adaptive rivals</span>' +
                            '</button>' +
                            '<button type="button" class="game3d-race-option is-mp" onclick="startRaceMultiplayer()">' +
                                '<strong>Race Friends</strong><span>You + your multiplayer lobby</span>' +
                            '</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="closeRaceChoice()">Cancel</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' : '') +
            (game.id === 1 ?
                '<div class="game3d-garage-shop" id="g3dGarageShop" style="display:none;">' +
                    '<div class="game3d-garage-shop-inner">' +
                        '<div class="game3d-garage-shop-head">' +
                            '<div><span class="game3d-garage-kicker">BEACH RACER · GARAGE</span><h2>Parts &amp; cosmetics</h2></div>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeGarageShop()">×</button>' +
                        '</div>' +
                        '<div class="game3d-garage-shop-balance" id="g3dShopBalance">— Coins</div>' +
                        '<div class="store-tabs" id="g3dShopTabs"></div>' +
                        '<div class="game3d-garage-shop-scroll" id="g3dShopContent"></div>' +
                        '<p class="game3d-mp-status" id="g3dShopStatus"></p>' +
                    '</div>' +
                '</div>' : '') +
            (game.id === 1 ? '<div class="g3d-race-load" id="g3dRaceLoad"><div class="g3d-race-load-card"><div class="g3d-race-spinner"></div><strong id="g3dRaceLoadText">RACE LOADING</strong><span>Building the closed circuit…</span></div></div>' : '') +
            (game.id === 1 ? '<div class="g3d-race-hud" id="g3dRaceHud"><span id="g3dRaceLap">LAP 1/3</span><strong id="g3dRacePos">POS 1/5</strong><span id="g3dRaceTime">0:00.0</span></div>' : '') +
            (game.id === 1 ?
                '<div class="game3d-showroom" id="g3dShowroom" style="display:none;">' +
                    '<div class="game3d-showroom-inner">' +
                        '<div class="game3d-showroom-head">' +
                            '<div><span class="game3d-garage-kicker">BEACH RACER · GARAGE</span><h2>Buy cars</h2></div>' +
                            '<div class="game3d-showroom-balance" id="g3dShowroomBalance">— Coins</div>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeShowroom()">×</button>' +
                        '</div>' +
                        '<div class="game3d-showroom-tools">' +
                            '<input type="search" class="game3d-mp-input" id="g3dShowroomSearch" placeholder="Search BMW, Tesla, Toyota…" oninput="updateShowroomSearch(this.value)">' +
                            '<span id="g3dShowroomCount">500 cars</span>' +
                        '</div>' +
                        '<div class="game3d-showroom-grid" id="g3dShowroomGrid"></div>' +
                        '<div class="game3d-showroom-pager">' +
                            '<button type="button" class="game3d-mp-secondary" onclick="showroomPage(-1)">‹ Prev</button>' +
                            '<span id="g3dShowroomPage">1 / 21</span>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="showroomPage(1)">Next ›</button>' +
                        '</div>' +
                        '<p class="game3d-mp-status" id="g3dShowroomStatus"></p>' +
                    '</div>' +
                '</div>' : '') +
            (game.id === 6 ?
                '<div class="funtutu" id="funtutuTest">' +
                    '<div class="funtutu-card">' +
                        '<div class="funtutu-head">' +
                            '<div><span class="game3d-garage-kicker">FUNTUTU TEST · SYSTEM BENCHMARK</span><h2 id="funtutuHeadline">Ready to test</h2></div>' +
                            '<button type="button" class="game3d-mp-x" onclick="closeGame()">×</button>' +
                        '</div>' +
                        '<canvas id="funtutuCanvas" width="640" height="230" class="funtutu-canvas"></canvas>' +
                        '<div class="funtutu-progress"><i id="funtutuProgress"></i></div>' +
                        '<div class="funtutu-steps" id="funtutuSteps"></div>' +
                        '<div class="funtutu-result" id="funtutuResult"></div>' +
                        '<div class="funtutu-actions">' +
                            '<button type="button" class="game3d-mp-primary" id="funtutuRunBtn" onclick="runFuntutuTest()">Run Test</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="applyFuntutuRecommended()">Apply Recommended</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' : '') +

            '<div class="game3d-crash" id="g3dCrashFlash"></div>' +
            '<div class="g3d-grain" aria-hidden="true"></div>' +
            (game.id === 1 ? '<div class="g3d-cinema" id="g3dCinema"></div>' : '') +
            (game.hasThrottle ? '<div class="g3d-banner" id="g3dBanner"></div>' : '') +
            '<div class="game3d-warning" id="g3dWarning"></div>' +
            '<div class="game3d-over" id="g3dOver" style="display:none;">' +
                '<div class="game3d-over-card">' +
                    '<h3>Game Over</h3>' +
                    '<p>Score <strong id="g3dFinal">0</strong></p>' +
                    '<p class="game3d-earned" id="g3dEarned" style="display:none;"></p>' +
                    '<button class="game-btn-3d" onclick="restartGame3D()">Play Again</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.getElementById('gameModal').style.display = 'flex';

    if (id === 6) {
        startFuntutuTest();
        return;
    }

    if (window.Games3D) {
        window.Games3D.start(id, document.getElementById('g3dCanvas'), {
            name: game.name,
            cosmetics: getEquippedCosmetics(),
            raceMode: raceModeSetting,
            raceAi: raceAiSetting,
            cityMode: cityModeSetting,
            zombieLoadout: getZombieLoadout(),
            snowStorm: snowStormMode,
            onScore: function (name, score) { saveScore(name, score); },
            onCoins: function (amount) { awardRunCoins(amount); },
            onGameOver: function (score, seconds) { handleGameOver(score, seconds); }
        });
        applyRenderScaleSetting();
        applySoundSetting();
        applyUnitSetting();
        if (id === 7) snowStormMode = false;
    }
    if (id === 1 && !garageSuppressed) {
        if (window.Games3D && window.Games3D.setGarageMode) window.Games3D.setGarageMode(true);
        const garage = document.getElementById('g3dGarage');
        if (garage) garage.style.display = 'flex';
        const wrap = document.querySelector('#modalGameBody .game3d-wrap');
        if (wrap) wrap.classList.add('is-garage');
        renderGarageStats();
    } else {
        const garage = document.getElementById('g3dGarage');
        if (garage) garage.style.display = 'none';
        const wrap = document.querySelector('#modalGameBody .game3d-wrap');
        if (wrap) wrap.classList.remove('is-garage');
        if (window.Games3D && window.Games3D.setGarageMode) window.Games3D.setGarageMode(false);
    }
    garageSuppressed = false;
    lastRunCoins = 0;
    if (id === 2 && !startMenuSuppressed) {
        const startMenu = document.getElementById('g3dStartMenu');
        if (startMenu) startMenu.style.display = 'flex';
        if (window.Games3D) window.Games3D.setPaused(true);
    } else {
        const startMenu = document.getElementById('g3dStartMenu');
        if (startMenu) startMenu.style.display = 'none';
    }
    startMenuSuppressed = false;

    if (game.hasThrottle) {
        racerMpApplyToGame();
    } else if (racerMp.code) {
        racerMpLeave();
    }

    var brakeBtn = document.getElementById('g3dBrake');
    if (brakeBtn && window.Games3D && window.Games3D.setBrake) {
        var pressBrake = function (e) {
            e.preventDefault();
            window.Games3D.setBrake(true);
            brakeBtn.classList.add('is-braking');
        };
        var releaseBrake = function (e) {
            if (e) e.preventDefault();
            window.Games3D.setBrake(false);
            brakeBtn.classList.remove('is-braking');
        };
        brakeBtn.addEventListener('pointerdown', pressBrake);
        brakeBtn.addEventListener('pointerup', releaseBrake);
        brakeBtn.addEventListener('pointercancel', releaseBrake);
        brakeBtn.addEventListener('pointerleave', releaseBrake);
    }

    var throttleBtn = document.getElementById('g3dThrottle');
    if (throttleBtn && window.Games3D && window.Games3D.setThrottle) {
        var pressThrottle = function (e) {
            e.preventDefault();
            window.Games3D.setThrottle(true);
            throttleBtn.classList.add('is-throttling');
        };
        var releaseThrottle = function (e) {
            if (e) e.preventDefault();
            window.Games3D.setThrottle(false);
            throttleBtn.classList.remove('is-throttling');
        };
        throttleBtn.addEventListener('pointerdown', pressThrottle);
        throttleBtn.addEventListener('pointerup', releaseThrottle);
        throttleBtn.addEventListener('pointercancel', releaseThrottle);
        throttleBtn.addEventListener('pointerleave', releaseThrottle);
    }
}

function restartGame3D() {
    const over = document.getElementById('g3dOver');
    if (over) over.style.display = 'none';
    const flash = document.getElementById('g3dCrashFlash');
    if (flash) flash.classList.remove('is-active');
    const warning = document.getElementById('g3dWarning');
    if (warning) warning.classList.remove('is-active');
    lastRunCoins = 0;
    // Keep the existing WebGL context and DOM; only rebuild the game scene.
    if (window.Games3D && window.Games3D.restart && currentGameId != null) {
        if (window.Games3D.restart()) { touchPresence(); return; }
    }
    if (currentGameId != null) openGame(currentGameId);
}

function toggleGameFullscreen() {
    const modal = document.getElementById('gameModal');
    if (!modal) return;
    if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
        return;
    }
    if (modal.requestFullscreen) {
        const req = modal.requestFullscreen();
        if (req && req.catch) req.catch(function () {});
    }
}

function closeGame() {
    closeRacerMpPanel(true);
    racerMpLeave(true);
    arcadeMpLeave(true);
    zombieMpLeave(true);
    dmClose();
    if (window.Games3D) window.Games3D.stop();
    if (typeof dgDestroy === 'function') dgDestroy();
    if (typeof luckyCleanup === 'function') luckyCleanup();
    if (typeof landingCleanup === 'function') landingCleanup();
    if (typeof tranqCleanup === 'function') tranqCleanup();
    funtutuToken++;
    funtutuRunning = false;
    document.getElementById('gameModal').style.display = 'none';
    document.body.classList.remove('in-game');
    currentGameId = null;
}


/* ============================================================
   Funtutu Test — GPU / CPU benchmark and settings advisor
   ============================================================ */
let funtutuRunning = false;
let funtutuToken = 0;
let funtutuLastResult = null;

function funtutuNow() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
}

function funtutuNextFrame() {
    return new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); });
}

function funtutuStepRows() {
    var host = document.getElementById('funtutuSteps');
    if (!host) return;
    var defs = [
        ['cpu-int', 'CPU integer pipeline'],
        ['cpu-float', 'CPU floating point + trig'],
        ['gpu', 'GPU shader fill rate'],
        ['canvas', 'Canvas 2D composite']
    ];
    host.innerHTML = defs.map(function (d) {
        return '<div class="funtutu-step" id="funtutuStep-' + d[0] + '">' +
            '<span class="funtutu-dot"></span>' +
            '<span class="funtutu-step-name">' + d[1] + '</span>' +
            '<span class="funtutu-step-value">waiting</span>' +
        '</div>';
    }).join('');
}

function funtutuSetStep(key, value, state) {
    var row = document.getElementById('funtutuStep-' + key);
    if (!row) return;
    row.classList.remove('is-running', 'is-done');
    if (state) row.classList.add(state);
    var val = row.querySelector('.funtutu-step-value');
    if (val) val.textContent = value;
}

function funtutuProgress(pct, label) {
    var bar = document.getElementById('funtutuProgress');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    var head = document.getElementById('funtutuHeadline');
    if (head && label) head.textContent = label;
}

function funtutuDrawIdle() {
    var canvas = document.getElementById('funtutuCanvas');
    if (!canvas) return;
    var g = canvas.getContext('2d');
    if (!g) return;
    var w = canvas.width, h = canvas.height;
    g.fillStyle = '#04121b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(95,224,255,0.18)';
    g.lineWidth = 1;
    for (var x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (var y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(220,245,255,0.55)';
    g.font = '600 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('FUNTUTU TEST', w / 2, h / 2 - 8);
    g.fillStyle = 'rgba(220,245,255,0.32)';
    g.font = '11px system-ui, sans-serif';
    g.fillText('Run the test to measure this device', w / 2, h / 2 + 14);
}

function funtutuDrawBars(values, labels) {
    var canvas = document.getElementById('funtutuCanvas');
    if (!canvas) return;
    var g = canvas.getContext('2d');
    if (!g) return;
    var w = canvas.width, h = canvas.height;
    g.fillStyle = '#04121b';
    g.fillRect(0, 0, w, h);
    var max = Math.max.apply(null, values.concat([1]));
    var slot = w / values.length;
    for (var i = 0; i < values.length; i++) {
        var bh = Math.max(4, (values[i] / max) * (h - 56));
        var x = slot * i + slot * 0.22;
        var bw = slot * 0.56;
        var grad = g.createLinearGradient(0, h - 30 - bh, 0, h - 30);
        grad.addColorStop(0, '#5fe0ff');
        grad.addColorStop(1, '#1d6fa5');
        g.fillStyle = grad;
        g.fillRect(x, h - 30 - bh, bw, bh);
        g.fillStyle = 'rgba(220,245,255,0.66)';
        g.font = '10px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(labels[i], x + bw / 2, h - 14);
        g.fillText(String(Math.round(values[i])), x + bw / 2, h - 34 - bh);
    }
}

function funtutuCpuTest(kind, durationMs) {
    var start = funtutuNow();
    var ops = 0;
    var x = 1;
    if (kind === 'int') {
        while (funtutuNow() - start < durationMs) {
            for (var i = 0; i < 25000; i++) {
                x = (x * 1664525 + 1013904223) >>> 0;
                x ^= x >>> 13;
            }
            ops += 25000;
        }
    } else {
        var acc = 0;
        while (funtutuNow() - start < durationMs) {
            for (var j = 0; j < 6000; j++) {
                acc += Math.sin(j * 0.0017) * Math.cos(j * 0.0023) + Math.sqrt(j + 1) / 7;
            }
            ops += 6000;
        }
        x = acc;
    }
    return { ops: ops, ms: funtutuNow() - start, checksum: x };
}

function funtutuGpuTest(canvas, durationMs) {
    return new Promise(function (resolve) {
        var gl = null;
        try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl'); } catch (e) {}
        if (!gl) { resolve({ score: 0, fps: 0, supported: false }); return; }
        var vs = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
        var fs = 'precision mediump float; uniform float uTime; uniform vec2 uRes;' +
            'void main(){ vec2 uv=(gl_FragCoord.xy/uRes-0.5)*3.0; float a=uTime*0.6;' +
            'vec2 c=vec2(cos(a)*0.72,sin(a)*0.62); vec2 z=uv; float v=0.0;' +
            'for(int i=0;i<28;i++){ z=vec2(z.x*z.x-z.y*z.y, 2.0*z.x*z.y)+c; v+=sin(z.x*4.0+uTime)+cos(z.y*3.0-uTime); }' +
            'gl_FragColor=vec4(0.5+0.5*sin(v), 0.42+0.5*cos(v*0.7), 0.58+0.5*sin(v*1.3+uv.x), 1.0); }';
        function shader(type, src) {
            var sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
            return sh;
        }
        var vsh = shader(gl.VERTEX_SHADER, vs);
        var fsh = shader(gl.FRAGMENT_SHADER, fs);
        if (!vsh || !fsh) { resolve({ score: 0, fps: 0, supported: false }); return; }
        var prog = gl.createProgram();
        gl.attachShader(prog, vsh); gl.attachShader(prog, fsh); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { resolve({ score: 0, fps: 0, supported: false }); return; }
        gl.useProgram(prog);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var timeLoc = gl.getUniformLocation(prog, 'uTime');
        var resLoc = gl.getUniformLocation(prog, 'uRes');
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.viewport(0, 0, canvas.width, canvas.height);
        var visible = document.getElementById('funtutuCanvas');
        var vg = visible ? visible.getContext('2d') : null;
        var start = funtutuNow(), frames = 0, copyTick = 0;
        function frame() {
            var t = (funtutuNow() - start) / 1000;
            gl.uniform1f(timeLoc, t);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            frames++;
            if (vg && (copyTick++ % 8 === 0)) {
                try { vg.drawImage(canvas, 0, 0, visible.width, visible.height); } catch (e) {}
            }
            if (funtutuNow() - start < durationMs) {
                requestAnimationFrame(frame);
            } else {
                var elapsed = (funtutuNow() - start) / 1000;
                var fps = frames / Math.max(0.001, elapsed);
                var pixels = canvas.width * canvas.height;
                var score = fps * 14 * (pixels / (512 * 288));
                resolve({ score: score, fps: fps, supported: true });
            }
        }
        requestAnimationFrame(frame);
    });
}

function funtutuCanvasTest(durationMs) {
    return new Promise(function (resolve) {
        var canvas = document.getElementById('funtutuCanvas');
        if (!canvas) { resolve(0); return; }
        var g = canvas.getContext('2d');
        if (!g) { resolve(0); return; }
        var start = funtutuNow(), frames = 0;
        function frame() {
            var w = canvas.width, h = canvas.height;
            g.fillStyle = 'rgba(3,14,22,0.3)';
            g.fillRect(0, 0, w, h);
            for (var i = 0; i < 1600; i++) {
                var x = (i * 73 + frames * 7) % w;
                var y = (i * 37 + frames * 11) % h;
                g.fillStyle = 'hsla(' + ((i * 5 + frames * 3) % 360) + ',90%,62%,0.35)';
                g.fillRect(x, y, 5, 5);
            }
            frames++;
            if (funtutuNow() - start < durationMs) requestAnimationFrame(frame);
            else {
                var fps = frames / Math.max(0.001, (funtutuNow() - start) / 1000);
                resolve(fps * 8);
            }
        }
        requestAnimationFrame(frame);
    });
}

function funtutuRecommendation(total) {
    if (total < 1600) {
        return { preset: 'potato', label: 'Poteto', scale: 0.5, shadows: false, blur: false, grain: false, slowmo: true,
            note: 'Prioritise frame rate. Expect low detail, no shadows, and a soft image.' };
    }
    if (total < 5000) {
        return { preset: 'medium', label: 'Medium', scale: 0.7, shadows: false, blur: false, grain: false, slowmo: true,
            note: 'The baseline for an average 2026 PC: a score near 4000 total (about 1000 per test) with smooth everyday play.' };
    }
    if (total < 6500) {
        return { preset: 'high', label: 'High', scale: 0.85, shadows: true, blur: true, grain: false, slowmo: true,
            note: 'The sweet spot: full effects, shadows, and a crisp 85% render scale.' };
    }
    if (total < 8000) {
        return { preset: 'ultra', label: 'Ultra', scale: 1.0, shadows: true, blur: true, grain: true, slowmo: true,
            note: 'Full native resolution with shadows, motion blur, and cinematic grain.' };
    }
    return { preset: 'extreme', label: 'Your Computer Will Die', scale: 1.0, shadows: true, blur: true, grain: true, slowmo: true,
        note: 'This machine has headroom to spare. Maximum detail and every effect enabled.' };
}

async function runFuntutuTest() {
    if (funtutuRunning) return;
    funtutuRunning = true;
    var token = ++funtutuToken;
    funtutuStepRows();
    funtutuProgress(0, 'Warming up');
    var resultHost = document.getElementById('funtutuResult');
    if (resultHost) resultHost.innerHTML = '';
    var runBtn = document.getElementById('funtutuRunBtn');
    if (runBtn) runBtn.disabled = true;
    await funtutuNextFrame();

    funtutuProgress(8, 'Testing CPU integer pipeline');
    funtutuSetStep('cpu-int', 'running…', 'is-running');
    await funtutuNextFrame();
    var cpuInt = funtutuCpuTest('int', 700);
    if (token !== funtutuToken) return;
    var cpuIntScore = Math.round(cpuInt.ops / 100000);
    funtutuSetStep('cpu-int', cpuIntScore + ' pts · ' + Math.round(cpuInt.ops / 1000) + 'k ops', 'is-done');
    funtutuProgress(30, 'Testing floating point + trig');

    funtutuSetStep('cpu-float', 'running…', 'is-running');
    await funtutuNextFrame();
    var cpuFloat = funtutuCpuTest('float', 700);
    if (token !== funtutuToken) return;
    var cpuFloatScore = Math.round(cpuFloat.ops / 48000);
    funtutuSetStep('cpu-float', cpuFloatScore + ' pts · ' + Math.round(cpuFloat.ops / 1000) + 'k ops', 'is-done');
    funtutuProgress(55, 'Rendering GPU shader workload');

    funtutuSetStep('gpu', 'compiling shader…', 'is-running');
    await funtutuNextFrame();
    var hidden = document.createElement('canvas');
    hidden.width = 512; hidden.height = 288;
    var gpu = await funtutuGpuTest(hidden, 1200);
    if (token !== funtutuToken) return;
    var gpuScore = Math.round(gpu.score * 1000 / 840);
    funtutuSetStep('gpu', gpu.supported ? (gpuScore + ' pts · ' + gpu.fps.toFixed(1) + ' FPS') : 'WebGL unavailable', 'is-done');
    funtutuProgress(80, 'Testing Canvas 2D compositing');

    funtutuSetStep('canvas', 'running…', 'is-running');
    await funtutuNextFrame();
    var canvasScore = Math.round((await funtutuCanvasTest(900)) * 1000 / 480);
    if (token !== funtutuToken) return;
    funtutuSetStep('canvas', canvasScore + ' pts', 'is-done');

    var total = cpuIntScore + cpuFloatScore + gpuScore + canvasScore;
    var rec = funtutuRecommendation(total);
    funtutuLastResult = {
        total: total, cpuInt: cpuIntScore, cpuFloat: cpuFloatScore, gpu: gpuScore, canvas: canvasScore,
        gpuFps: gpu.fps, rec: rec, at: Date.now()
    };
    try { localStorage.setItem('lessfun_funtutu_result', JSON.stringify(funtutuLastResult)); } catch (e) {}

    funtutuProgress(100, 'Test complete · score ' + total.toLocaleString());
    funtutuDrawBars([cpuIntScore, cpuFloatScore, gpuScore, canvasScore], ['CPU INT', 'CPU FP', 'GPU', '2D']);
    if (resultHost) {
        resultHost.innerHTML =
            '<div class="funtutu-score"><span>FUNTUTU SCORE</span><strong>' + total.toLocaleString() + '</strong></div>' +
            '<div class="funtutu-breakdown">' +
                '<span>CPU int <b>' + cpuIntScore + '</b></span>' +
                '<span>CPU float <b>' + cpuFloatScore + '</b></span>' +
                '<span>GPU <b>' + gpuScore + '</b></span>' +
                '<span>Canvas <b>' + canvasScore + '</b></span>' +
            '</div>' +
            '<div class="funtutu-verdict"><strong>' + escapeHtml(rec.label) + '</strong><p>' + escapeHtml(rec.note) + ' An average 2026 desktop PC scores about 1000 in each test, around 4000 total, which lands on Medium.</p>' +
            '<span class="funtutu-rec-tags">Render ' + Math.round(rec.scale * 100) + '% · Shadows ' + (rec.shadows ? 'on' : 'off') +
            ' · Motion blur ' + (rec.blur ? 'on' : 'off') + ' · Film grain ' + (rec.grain ? 'on' : 'off') + '</span></div>';
    }
    if (runBtn) runBtn.disabled = false;
    funtutuRunning = false;
}

function applyFuntutuRecommended() {
    var res = funtutuLastResult;
    if (!res) {
        try { res = JSON.parse(localStorage.getItem('lessfun_funtutu_result') || 'null'); } catch (e) {}
    }
    if (!res || !res.rec) {
        if (window.alert) alert('Run the Funtutu Test first.');
        return;
    }
    var rec = (res && res.total) ? funtutuRecommendation(res.total) : res.rec;
    setGraphicsPresetSetting(rec.preset);
    setRenderScaleSetting(String(rec.scale));
    setShadowSetting(rec.shadows);
    setMotionBlurSetting(rec.blur);
    setFilmGrainSetting(rec.grain);
    setCrashSlowmoSetting(rec.slowmo);
    funtutuProgress(100, 'Applied ' + rec.label + ' graphics');
    var resultHost = document.getElementById('funtutuResult');
    if (resultHost) {
        var note = document.createElement('p');
        note.className = 'funtutu-applied';
        note.textContent = 'Applied ' + rec.label + ' settings: ' + Math.round(rec.scale * 100) + '% render scale.';
        resultHost.appendChild(note);
    }
}

function startFuntutuTest() {
    funtutuStepRows();
    funtutuDrawIdle();
    try {
        var saved = JSON.parse(localStorage.getItem('lessfun_funtutu_result') || 'null');
        if (saved && saved.total) {
            funtutuLastResult = saved;
            var rec = funtutuRecommendation(saved.total);
            saved.rec = rec;
            funtutuLastResult = saved;
            funtutuProgress(100, 'Last score ' + saved.total.toLocaleString() + ' · ' + rec.label);
            funtutuDrawBars([saved.cpuInt, saved.cpuFloat, saved.gpu, saved.canvas], ['CPU INT', 'CPU FP', 'GPU', '2D']);
            var host = document.getElementById('funtutuResult');
            if (host) {
                host.innerHTML = '<div class="funtutu-score"><span>LAST FUNTUTU SCORE</span><strong>' + saved.total.toLocaleString() + '</strong></div>' +
                    '<div class="funtutu-verdict"><strong>' + escapeHtml(rec.label) + '</strong><p>' + escapeHtml(rec.note) + '</p></div>';
            }
        } else {
            funtutuProgress(0, 'Ready to test');
        }
    } catch (e) {
        funtutuProgress(0, 'Ready to test');
    }
    var runBtn = document.getElementById('funtutuRunBtn');
    if (runBtn) runBtn.disabled = false;
    funtutuRunning = false;
}

/* ============================================================
   Beach Racer multiplayer rooms (2–3 players, room codes)
   ============================================================ */

function racerMpSanitizeName(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 16);
}

function racerMpSuggestedName() {
    if (currentUser && currentUser.type === 'user' && currentUser.username && currentUser.username !== 'Guest') {
        return racerMpSanitizeName(currentUser.username);
    }
    try { return racerMpSanitizeName(localStorage.getItem('lessfun_racer_name') || ''); } catch (e) { return ''; }
}

function racerMpSaveName(name) {
    try { localStorage.setItem('lessfun_racer_name', name); } catch (e) {}
}

function racerMpMakeId() {
    try {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) {}
    return 'racer-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function racerMpMakeCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < RACER_MP_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function racerMpCssColor(value) {
    var n = typeof value === 'number' ? value : 0xef476f;
    return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
}

function racerMpSetStatus(text) {
    racerMp.status = text || '';
    var el = document.getElementById('g3dMpStatus');
    if (el) el.textContent = racerMp.status;
}

function racerMpPresencePayload() {
    var cosmetics = getEquippedCosmetics();
    return {
        id: racerMp.id,
        name: racerMp.name,
        joinedAt: racerMp.joinedAt || (racerMp.joinedAt = Date.now()),
        paint: cosmetics.paint,
        body: cosmetics.body,
        engine: cosmetics.engine,
        wheel: cosmetics.wheel,
        engineColor: cosmetics.engineColor
    };
}

function racerMpIsHost() {
    return !!(racerMp.code && !racerMp.public && racerMp.players.length && racerMp.players[0].id === racerMp.id);
}

function racerMpTeleport(id) {
    if (!racerMp.racing) {
        racerMpSetStatus('Teleport is available during a race.');
        return;
    }
    var remote = racerMp.remotes[String(id)];
    if (!remote) {
        racerMpSetStatus('That racer has not shared a position yet.');
        return;
    }
    if (window.Games3D && window.Games3D.teleportRacer) {
        window.Games3D.teleportRacer(remote.distance, remote.x);
        racerMpSetStatus('Teleported next to ' + (remote.name || 'that racer') + '.');
        closeRacerMpPanel();
    }
}

function racerMpUpdateUi() {
    var btn = document.getElementById('g3dMpBtn');
    if (btn) {
        if (racerMp.code) {
            var count = Math.max(1, racerMp.players.length);
            btn.textContent = racerMp.public
                ? 'Public ' + count + '/' + racerMp.maxPlayers
                : 'Room ' + racerMp.code + ' · ' + count + '/' + racerMp.maxPlayers;
            btn.classList.add('is-live');
        } else {
            btn.textContent = 'Multiplayer';
            btn.classList.remove('is-live');
        }
    }

    var isHost = racerMpIsHost();
    var isPublic = !!racerMp.public;

    var startBtn = document.getElementById('g3dMpStartBtn');
    if (startBtn) {
        startBtn.style.display = isHost ? 'block' : 'none';
        startBtn.textContent = racerMp.racing ? 'Restart race' : 'Start race';
    }
    var guestNote = document.getElementById('g3dMpGuestNote');
    if (guestNote) guestNote.style.display = (!isHost && !isPublic && racerMp.code) ? 'block' : 'none';

    var lobby = document.getElementById('g3dMpLobby');
    var room = document.getElementById('g3dMpRoom');
    if (lobby) lobby.style.display = racerMp.code ? 'none' : 'block';
    if (room) room.style.display = racerMp.code ? 'block' : 'none';

    var codeEl = document.getElementById('g3dMpRoomCode');
    if (codeEl) codeEl.textContent = racerMp.public ? (racerMp.publicName || 'Public') : (racerMp.code || '-----');
    var roomLabel = document.getElementById('g3dMpRoomLabel');
    if (roomLabel) roomLabel.textContent = racerMp.public ? 'Lobby' : 'Room';
    var copyBtn = document.getElementById('g3dMpCopyBtn');
    if (copyBtn) copyBtn.style.display = racerMp.public ? 'none' : 'inline-block';

    racerMpRenderPublicLobbies();

    var playersEl = document.getElementById('g3dMpPlayers');
    if (playersEl && racerMp.code) {
        var players = racerMp.players.slice();
        if (!players.length) {
            players = [{ id: racerMp.id, name: racerMp.name || 'You', paint: 0xef476f }];
        }
        var hostId = players[0] ? players[0].id : racerMp.id;
        playersEl.innerHTML = players.map(function (player) {
            var isSelf = player.id === racerMp.id;
            var isHostRow = player.id === hostId;
            var canTeleport = racerMp.racing && !isSelf;
            return '<div class="game3d-mp-player' + (isHostRow ? ' is-host' : '') + '">' +
                '<span class="game3d-mp-dot" style="background:' + racerMpCssColor(player.paint) + '"></span>' +
                '<span class="game3d-mp-player-name">' + escapeHtml(player.name || 'Player') + '</span>' +
                (isHostRow ? '<span class="game3d-mp-host">HOST</span>' : '') +
                (isSelf ? '<span class="game3d-mp-you">YOU</span>' : '') +
                (canTeleport ? '<button type="button" class="game3d-mp-teleport" onclick="racerMpTeleport(\'' + debugArg(player.id) + '\')">Teleport</button>' : '') +
            '</div>';
        }).join('');
    }

    var statusEl = document.getElementById('g3dMpStatus');
    if (statusEl) statusEl.textContent = racerMp.status;

    var nameInput = document.getElementById('g3dMpName');
    if (nameInput && document.activeElement !== nameInput && !nameInput.value) {
        nameInput.value = racerMp.name || racerMpSuggestedName();
    }
}

function racerMpApplyToGame() {
    if (!window.Games3D) return;
    if (racerMp.code) {
        window.Games3D.setLocalRacerName(racerMp.name || 'Player');
        if (racerMp.panelOpen) window.Games3D.setPaused(true);
    } else {
        window.Games3D.setLocalRacerName('');
    }
    racerMpUpdateUi();
}

function openRacerMpPanel() {
    if (currentGameId !== 1) return;
    racerMp.panelOpen = true;
    racerMp.name = racerMp.name || racerMpSuggestedName();
    var panel = document.getElementById('g3dMpPanel');
    if (panel) panel.style.display = 'flex';
    var nameInput = document.getElementById('g3dMpName');
    if (nameInput && !nameInput.value) nameInput.value = racerMp.name;
    var codeInput = document.getElementById('g3dMpCode');
    if (codeInput) codeInput.value = '';
    racerMpUpdateUi();
    if (window.Games3D) window.Games3D.setPaused(true);
}

function closeRacerMpPanel(silent) {
    racerMp.panelOpen = false;
    var panel = document.getElementById('g3dMpPanel');
    if (panel) panel.style.display = 'none';
    if (!silent && window.Games3D) window.Games3D.setPaused(false);
}

function racerMpReadName() {
    var input = document.getElementById('g3dMpName');
    var name = racerMpSanitizeName(input ? input.value : racerMp.name);
    if (!name) {
        racerMpSetStatus('Enter a driver name first.');
        if (input) input.focus();
        return '';
    }
    racerMp.name = name;
    racerMpSaveName(name);
    return name;
}

function racerMpNameChanged() {
    var input = document.getElementById('g3dMpName');
    var name = racerMpSanitizeName(input ? input.value : '');
    if (!name) return;
    racerMp.name = name;
    racerMpSaveName(name);
    if (racerMp.channel && racerMp.connected) {
        var tracked = racerMp.channel.track(racerMpPresencePayload());
        if (tracked && tracked.catch) tracked.catch(function () {});
    }
    if (racerMp.code && window.Games3D) window.Games3D.setLocalRacerName(name);
    racerMpUpdateUi();
}

function racerMpCreateRoom() {
    var name = racerMpReadName();
    if (!name) return;
    racerMpConnect(racerMpMakeCode(), name);
}

function racerMpJoinCode() {
    var name = racerMpReadName();
    if (!name) return;
    var input = document.getElementById('g3dMpCode');
    var code = String(input ? input.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RACER_MP_CODE_LENGTH);
    if (code.length < 4) {
        racerMpSetStatus('Enter the room code your friend shared.');
        if (input) input.focus();
        return;
    }
    racerMpConnect(code, name);
}

function racerMpJoinPublic(index) {
    var lobby = RACER_MP_PUBLIC_LOBBIES[index];
    if (!lobby) return;
    var name = racerMpReadName();
    if (!name) return;
    racerMpConnect(lobby.id, name, { id: lobby.id, name: lobby.name, channel: lobby.channel });
}

function racerMpRenderPublicLobbies() {
    var host = document.getElementById('g3dMpPublicList');
    if (!host) return;
    host.innerHTML = RACER_MP_PUBLIC_LOBBIES.map(function (lobby, index) {
        var joined = racerMp.public && racerMp.publicChannel === lobby.channel;
        var count = joined ? racerMp.players.length : racerMp.publicCounts[lobby.channel];
        return '<div class="game3d-mp-public-row">' +
            '<span class="game3d-mp-public-name">' + escapeHtml(lobby.name) + '</span>' +
            '<span class="game3d-mp-public-count">' + (count == null ? '—' : count) + '/50</span>' +
            '<button type="button" class="game3d-mp-public-join" onclick="racerMpJoinPublic(' + index + ')"' +
                (joined ? ' disabled' : '') + '>' + (joined ? 'Joined' : 'Join') + '</button>' +
        '</div>';
    }).join('');
}

function racerMpConnect(code, name, publicInfo) {
    if (!supabaseClient) {
        racerMpSetStatus('Multiplayer is unavailable — the online service did not load.');
        return;
    }
    racerMpLeave(true);
    racerMp.id = racerMpMakeId();
    racerMp.code = publicInfo ? publicInfo.id : code;
    racerMp.name = name;
    racerMp.connected = false;
    racerMp.public = !!publicInfo;
    racerMp.publicName = publicInfo ? publicInfo.name : '';
    racerMp.publicChannel = publicInfo ? publicInfo.channel : '';
    racerMp.maxPlayers = publicInfo ? RACER_MP_PUBLIC_MAX : RACER_MP_MAX;
    racerMp.racing = !!publicInfo;
    racerMp.joinedAt = Date.now();
    racerMp.remotes = {};
    racerMp.players = [];
    racerMp.status = publicInfo
        ? 'Joining ' + publicInfo.name + '…'
        : 'Connecting to room ' + code + '…';

    var channelName = publicInfo ? publicInfo.channel : ('lessfun-racer-' + code);
    var channel = supabaseClient.channel(channelName, {
        config: { presence: { key: racerMp.id } }
    });
    racerMp.channel = channel;

    channel.on('broadcast', { event: 'state' }, function (message) {
        racerMpHandleState(message && message.payload);
    });
    channel.on('broadcast', { event: 'start' }, function (message) {
        racerMpHandleStart(message && message.payload);
    });
    channel.on('broadcast', { event: 'cam-frame' }, function (message) {
        var payload = message && message.payload;
        if (!payload || !payload.id || String(payload.id) === racerMp.id) return;
        if (!payload.image || String(payload.image).indexOf('data:image/') !== 0) return;
        racerMp.camFrames[String(payload.id)] = {
            id: String(payload.id),
            name: racerMpSanitizeName(payload.name) || 'Racer',
            image: payload.image,
            at: Date.now()
        };
        racerMpRenderCamFrames();
    });
    channel.on('presence', { event: 'sync' }, function () { racerMpSyncPresence(); });
    channel.on('presence', { event: 'join' }, function () { racerMpSyncPresence(); });
    channel.on('presence', { event: 'leave' }, function () { racerMpSyncPresence(); });

    channel.subscribe(function (status) {
        if (racerMp.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
            racerMp.connected = true;
            if (racerMp.public) {
                racerMpSetStatus(racerMp.publicName + ' · race is live.');
            } else {
                racerMpSetStatus('Room ' + code + ' · share this code with 1–2 friends.');
            }
            var tracked = channel.track(racerMpPresencePayload());
            if (tracked && tracked.catch) tracked.catch(function () {});
            if (racerMp.public) {
                racerMpPrepareRace();
            } else {
                racerMpApplyToGame();
            }
            racerMpUpdateUi();
            touchPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            racerMp.connected = false;
            racerMpSetStatus(racerMp.public ? 'Could not join that public lobby. Try another one.' : 'Could not connect to that room. Check the code and try again.');
            racerMpUpdateUi();
        }
    });

    if (racerMp.timer) clearInterval(racerMp.timer);
    racerMp.timer = setInterval(racerMpTick, 66);
    racerMpApplyToGame();
    racerMpUpdateUi();
}

function racerMpSyncPresence() {
    if (!racerMp.channel) return;
    var state = racerMp.channel.presenceState() || {};
    var players = [];
    Object.keys(state).forEach(function (key) {
        var entries = state[key] || [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry || !entry.id) continue;
            players.push({
                id: String(entry.id),
                name: racerMpSanitizeName(entry.name) || 'Player',
                paint: typeof entry.paint === 'number' ? entry.paint : 0xef476f,
                joinedAt: Number(entry.joinedAt) || 0
            });
        }
    });
    var seen = {};
    players = players.filter(function (player) {
        if (seen[player.id]) return false;
        seen[player.id] = true;
        return true;
    });
    if (!players.some(function (player) { return player.id === racerMp.id; })) {
        players.push({
            id: racerMp.id,
            name: racerMp.name || 'You',
            paint: getEquippedCosmetics().paint,
            joinedAt: racerMp.joinedAt
        });
    }
    players.sort(function (a, b) {
        return (a.joinedAt || 0) - (b.joinedAt || 0) || String(a.id).localeCompare(String(b.id));
    });

    var maxPlayers = racerMp.maxPlayers || RACER_MP_MAX;
    if (players.length > maxPlayers) {
        var keep = players.slice(0, maxPlayers);
        var allowed = keep.some(function (player) { return player.id === racerMp.id; });
        if (!allowed) {
            racerMpLeave(true);
            racerMpSetStatus(racerMp.public ? 'That public lobby is full — 50 racers max.' : 'That room is full — 3 players max.');
            racerMpUpdateUi();
            return;
        }
        players = keep;
    }
    racerMp.players = players;
    if (players.length >= 2) grantMultiplayerSessionReward();

    Object.keys(racerMp.remotes).forEach(function (id) {
        if (!players.some(function (player) { return player.id === id; })) delete racerMp.remotes[id];
    });

    if (racerMp.connected) {
        racerMp.status = racerMp.public
            ? 'Public lobby · ' + players.length + ' / ' + maxPlayers + ' racers · race is live.'
            : players.length + ' / ' + maxPlayers + ' players in the room.';
    }
    racerMpUpdateUi();
}

function racerMpHandleState(payload) {
    if (!payload || !payload.id || String(payload.id) === racerMp.id) return;
    var id = String(payload.id);
    racerMp.remotes[id] = {
        id: id,
        name: racerMpSanitizeName(payload.name) || 'Player',
        x: Number(payload.x) || 0,
        distance: Number(payload.distance) || 0,
        speed: Number(payload.speed) || 0,
        gear: Number(payload.gear) || 0,
        body: payload.body || 'classic',
        engine: payload.engine || 'stock',
        paint: typeof payload.paint === 'number' ? payload.paint : 0xef476f,
        wheel: typeof payload.wheel === 'number' ? payload.wheel : null,
        engineColor: typeof payload.engineColor === 'number' ? payload.engineColor : null,
        lastSeen: Date.now()
    };
}

function racerMpHandleStart(payload) {
    if (racerMp.public) return;
    if (!payload || String(payload.id) === racerMp.id) return;
    if (!racerMp.players.length || String(payload.id) !== String(racerMp.players[0].id)) return;
    var now = Date.now();
    if (now - racerMp.lastReset < 800) return;
    racerMp.lastReset = now;
    racerMpPrepareRace();
}

function racerMpStart() {
    if (!racerMp.code) return;
    if (!racerMpIsHost()) {
        racerMpSetStatus('Only the host can start or restart the race.');
        racerMpUpdateUi();
        return;
    }
    var payload = { id: racerMp.id, at: Date.now() };
    if (racerMp.channel && racerMp.connected) {
        var sent = racerMp.channel.send({ type: 'broadcast', event: 'start', payload: payload });
        if (sent && sent.catch) sent.catch(function () {});
    }
    racerMp.lastReset = Date.now();
    racerMpPrepareRace();
}

function racerMpPrepareRace() {
    garageSuppressed = true;
    racerMp.racing = true;
    racerMp.panelOpen = false;
    racerMp.remotes = {};
    var panel = document.getElementById('g3dMpPanel');
    if (panel) panel.style.display = 'none';
    if (window.Games3D) {
        window.Games3D.setRemoteRacers([]);
        window.Games3D.setPaused(false);
    }
    if (currentGameId === 1) {
        restartGame3D();
    } else {
        showView('games');
        openGame(1);
    }
    racerMpApplyToGame();
    if (window.Games3D) window.Games3D.setPaused(false);
    racerMpUpdateUi();
}

function racerMpTick() {
    if (!racerMp.code || !racerMp.channel) return;
    if (racerMp.connected) {
        var state = window.Games3D && window.Games3D.getRacerState ? window.Games3D.getRacerState() : null;
        if (state && Date.now() - racerMp.lastSend >= 90) {
            racerMp.lastSend = Date.now();
            var cosmetics = getEquippedCosmetics();
            var sent = racerMp.channel.send({
                type: 'broadcast',
                event: 'state',
                payload: {
                    id: racerMp.id,
                    name: racerMp.name,
                    x: state.x,
                    distance: state.distance,
                    speed: state.speed,
                    gear: state.gear,
                    body: cosmetics.body,
                    engine: cosmetics.engine,
                    paint: cosmetics.paint,
                    wheel: cosmetics.wheel,
                    engineColor: cosmetics.engineColor
                }
            });
            if (sent && sent.catch) sent.catch(function () {});
        }
    }

    var now = Date.now();
    var list = [];
    Object.keys(racerMp.remotes).forEach(function (id) {
        var remote = racerMp.remotes[id];
        if (now - remote.lastSeen > 4000) {
            delete racerMp.remotes[id];
            return;
        }
        list.push(remote);
    });
    // A 50-player public lobby can contain dozens of ghost cars. Keep the
    // nearest 16 so the scene stays smooth while everyone remains in the list.
    if (list.length > 16) {
        var localDistance = (window.Games3D && window.Games3D.getRacerState) ? (window.Games3D.getRacerState() || {}).distance || 0 : 0;
        list.sort(function (a, b) {
            return Math.abs((a.distance || 0) - localDistance) - Math.abs((b.distance || 0) - localDistance);
        });
        list = list.slice(0, 16);
    }
    if (window.Games3D) window.Games3D.setRemoteRacers(list);

    // Live camera thumbnails: capture the player's own rendered view and
    // broadcast a tiny JPEG. No extra scene cameras are rendered locally.
    if (racerMp.connected && racerMp.players.length < 6 && list.length) {
        if (now - racerMp.camLastSend >= 66) {
            if (window.Games3D && window.Games3D.getCapturedFrame) {
                var frame = window.Games3D.getCapturedFrame();
                if (frame) {
                    var sentCam = racerMp.channel.send({
                        type: 'broadcast', event: 'cam-frame',
                        payload: { id: racerMp.id, name: racerMp.name, image: frame }
                    });
                    if (sentCam && sentCam.catch) sentCam.catch(function () {});
                    racerMp.camLastSend = now;
                }
            }
            if (window.Games3D && window.Games3D.requestFrameCapture) window.Games3D.requestFrameCapture();
        }
    } else {
        racerMp.camRequested = false;
    }
    racerMpRenderCamFrames();
}

function racerMpRenderCamFrames() {
    var host = document.getElementById('g3dRemoteCams');
    if (!host) return;
    if (!racerMp.connected || racerMp.players.length >= 6 || isMobileUI) {
        host.style.display = 'none';
        return;
    }
    var now = Date.now();
    var frames = Object.keys(racerMp.camFrames).map(function (id) { return racerMp.camFrames[id]; })
        .filter(function (frame) { return frame && now - frame.at < 3500; })
        .sort(function (a, b) { return b.at - a.at; })
        .slice(0, 3);
    if (!frames.length) { host.style.display = 'none'; return; }
    host.style.display = 'flex';
    host.style.width = '164px';
    host.style.top = '112px';
    host.style.right = '18px';
    host.innerHTML = frames.map(function (frame) {
        return '<div class="game3d-remote-cam-card">' +
            '<img src="' + frame.image + '" alt="' + escapeAttr(frame.name) + ' live view">' +
            '<span>' + escapeHtml(frame.name) + ' · live</span>' +
        '</div>';
    }).join('');
}

function racerMpLeave(quiet) {
    if (racerMp.timer) {
        clearInterval(racerMp.timer);
        racerMp.timer = 0;
    }
    var channel = racerMp.channel;
    racerMp.channel = null;
    racerMp.connected = false;
    racerMp.camFrames = {};
    racerMp.camRequested = false;
    var camHost = document.getElementById('g3dRemoteCams');
    if (camHost) camHost.style.display = 'none';
    if (channel) {
        try {
            var left = channel.untrack();
            if (left && left.catch) left.catch(function () {});
        } catch (e) {}
        if (supabaseClient && supabaseClient.removeChannel) {
            try {
                var removed = supabaseClient.removeChannel(channel);
                if (removed && removed.catch) removed.catch(function () {});
            } catch (e) {}
        }
    }
    racerMp.code = '';
    racerMp.racing = false;
    racerMp.remotes = {};
    racerMp.players = [];
    racerMp.lastSend = 0;
    racerMp.joinedAt = 0;
    racerMp.public = false;
    racerMp.publicName = '';
    racerMp.publicChannel = '';
    racerMp.maxPlayers = RACER_MP_MAX;
    if (window.Games3D) {
        window.Games3D.setRemoteRacers([]);
        window.Games3D.setLocalRacerName('');
    }
    if (!quiet) racerMpSetStatus('Left the room.');
    racerMpUpdateUi();
    touchPresence();
}

function racerMpCopyCode() {
    if (!racerMp.code) return;
    var code = racerMp.code;
    function copied() { racerMpSetStatus('Room code ' + code + ' copied.'); }
    function fallback() {
        try {
            var area = document.createElement('textarea');
            area.value = code;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            copied();
        } catch (e) {
            racerMpSetStatus('Room code: ' + code);
        }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(copied).catch(fallback);
    } else {
        fallback();
    }
}


/* ============================================================
   Tunnel Rush live public multiplayer
   ============================================================ */
function arcadeMpConfig() {
    return ARCADE_MP_GAMES[currentGameId] || null;
}

function arcadeMpDisplayName() {
    if (currentUser && currentUser.type === 'user' && currentUser.username && currentUser.username !== 'Guest') {
        return racerMpSanitizeName(currentUser.username);
    }
    return racerMpSanitizeName(racerMpSuggestedName()) || 'Player';
}

function arcadeMpSetStatus(text, isError) {
    arcadeMp.status = text || '';
    const panel = document.getElementById('g3dArcadeStatus');
    if (panel) {
        panel.textContent = arcadeMp.status;
        panel.classList.toggle('is-error', !!isError);
    }
}

function openArcadeMpPanel() {
    const cfg = arcadeMpConfig();
    if (!cfg) return;
    arcadeMp.panelOpen = true;
    const panel = document.getElementById('g3dArcadeMpPanel');
    if (panel) panel.style.display = 'flex';
    const title = document.getElementById('g3dArcadeTitle');
    if (title) title.textContent = cfg.name + ' Live';
    arcadeMpRenderUi();
    if (window.Games3D) window.Games3D.setPaused(true);
}

function closeArcadeMpPanel(silent) {
    arcadeMp.panelOpen = false;
    const panel = document.getElementById('g3dArcadeMpPanel');
    if (panel) panel.style.display = 'none';
    if (!silent && window.Games3D) window.Games3D.setPaused(dmState.open);
}

function arcadeMpToggle() {
    if (arcadeMp.connected && arcadeMp.gameId === currentGameId) arcadeMpLeave();
    else arcadeMpJoin();
}

function arcadeMpJoin() {
    const cfg = arcadeMpConfig();
    if (!cfg) return;
    if (!supabaseClient) {
        arcadeMpSetStatus('Multiplayer needs an online connection.', true);
        return;
    }
    arcadeMpLeave(true);
    arcadeMp.id = racerMpMakeId();
    arcadeMp.name = arcadeMpDisplayName();
    arcadeMp.gameId = currentGameId;
    arcadeMp.players = {};
    arcadeMp.connected = false;
    arcadeMpSetStatus('Joining ' + cfg.name + ' live…');

    const channel = supabaseClient.channel(cfg.channel, { config: { presence: { key: arcadeMp.id } } });
    arcadeMp.channel = channel;
    channel.on('broadcast', { event: 'state' }, function (message) {
        arcadeMpHandleState(message && message.payload);
    });
    channel.on('presence', { event: 'sync' }, arcadeMpSyncPresence);
    channel.on('presence', { event: 'join' }, arcadeMpSyncPresence);
    channel.on('presence', { event: 'leave' }, arcadeMpSyncPresence);
    channel.subscribe(function (status) {
        if (arcadeMp.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
            arcadeMp.connected = true;
            const tracked = channel.track({
                id: arcadeMp.id,
                name: arcadeMp.name,
                score: window.Games3D && window.Games3D.getCurrentScore ? window.Games3D.getCurrentScore() : 0,
                joinedAt: Date.now()
            });
            if (tracked && tracked.catch) tracked.catch(function () {});
            if (arcadeMp.timer) clearInterval(arcadeMp.timer);
            arcadeMp.timer = setInterval(arcadeMpTick, 800);
            arcadeMpSetStatus('Live · scores update as everyone plays.');
            closeArcadeMpPanel(true);
            if (window.Games3D) window.Games3D.setPaused(false);
            startMenuSuppressed = true;
            restartGame3D();
            arcadeMpRenderUi();
            touchPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            arcadeMp.connected = false;
            arcadeMpSetStatus('Could not join the live lobby. Try again.', true);
            arcadeMpRenderUi();
        }
    });
    arcadeMpRenderUi();
}

function arcadeMpHandleState(payload) {
    if (!payload || !payload.id || String(payload.id) === arcadeMp.id) return;
    const id = String(payload.id);
    const existing = arcadeMp.players[id] || {};
    arcadeMp.players[id] = {
        id: id,
        name: racerMpSanitizeName(payload.name) || existing.name || 'Player',
        score: Math.max(Number(payload.score) || 0, Number(existing.score) || 0),
        lastSeen: Date.now()
    };
    arcadeMpRenderBoard();
    if (arcadeMp.panelOpen) arcadeMpRenderUi();
}

function arcadeMpSyncPresence() {
    if (!arcadeMp.channel || !arcadeMp.connected) return;
    const state = arcadeMp.channel.presenceState() || {};
    const players = {};
    Object.keys(state).forEach(function (key) {
        const entries = state[key] || [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry || !entry.id) continue;
            const id = String(entry.id);
            const previous = arcadeMp.players[id] || {};
            players[id] = {
                id: id,
                name: racerMpSanitizeName(entry.name) || previous.name || 'Player',
                score: Math.max(Number(entry.score) || 0, Number(previous.score) || 0),
                lastSeen: Date.now()
            };
        }
    });
    arcadeMp.players = players;
    if (Object.keys(players).length >= 2) grantMultiplayerSessionReward();
    arcadeMpRenderBoard();
    if (arcadeMp.panelOpen) arcadeMpRenderUi();
}

function arcadeMpTick() {
    if (!arcadeMp.connected || !arcadeMp.channel || arcadeMp.gameId !== currentGameId) return;
    const score = window.Games3D && window.Games3D.getCurrentScore ? window.Games3D.getCurrentScore() : 0;
    const me = arcadeMp.players[arcadeMp.id] || { id: arcadeMp.id, name: arcadeMp.name, score: 0 };
    me.score = Math.max(Number(me.score) || 0, Number(score) || 0);
    arcadeMp.players[arcadeMp.id] = me;
    const sent = arcadeMp.channel.send({
        type: 'broadcast',
        event: 'state',
        payload: { id: arcadeMp.id, name: arcadeMp.name, score: me.score }
    });
    if (sent && sent.catch) sent.catch(function () {});
    arcadeMpRenderBoard();
    if (arcadeMp.panelOpen) arcadeMpRenderUi();
}

function arcadeMpSortedPlayers() {
    return Object.keys(arcadeMp.players).map(function (id) { return arcadeMp.players[id]; })
        .sort(function (a, b) { return Number(b.score) - Number(a.score); });
}

function arcadeMpRenderBoard() {
    const board = document.getElementById('g3dArcadeBoard');
    if (!board) return;
    const cfg = ARCADE_MP_GAMES[currentGameId];
    if (!arcadeMp.connected || !cfg || arcadeMp.gameId !== currentGameId) {
        board.style.display = 'none';
        return;
    }
    const players = arcadeMpSortedPlayers().slice(0, 6);
    board.innerHTML = '<span class="arcade-board-title">Live scores</span>' +
        players.map(function (player, index) {
            return '<span class="arcade-board-row' + (player.id === arcadeMp.id ? ' is-me' : '') + '">' +
                '<span class="arcade-board-rank">' + (index + 1) + '</span>' +
                '<span class="arcade-board-name">' + escapeHtml(player.name) + '</span>' +
                '<strong>' + Math.round(player.score).toLocaleString() + '</strong>' +
            '</span>';
        }).join('');
    board.style.display = 'flex';
}

function arcadeMpRenderUi() {
    const btn = document.getElementById('g3dArcadeJoinBtn');
    if (btn) {
        btn.textContent = (arcadeMp.connected && arcadeMp.gameId === currentGameId) ? 'Leave live lobby' : 'Join live lobby';
    }
    const list = document.getElementById('g3dArcadePlayers');
    if (list) {
        const players = arcadeMpSortedPlayers();
        list.innerHTML = players.length
            ? players.map(function (player) {
                return '<div class="game3d-mp-player' + (player.id === arcadeMp.id ? ' is-host' : '') + '">' +
                    '<span class="game3d-mp-player-name">' + escapeHtml(player.name) + (player.id === arcadeMp.id ? ' (you)' : '') + '</span>' +
                    '<strong class="arcade-player-score">' + Math.round(player.score).toLocaleString() + '</strong>' +
                '</div>';
            }).join('')
            : '<p class="game3d-mp-sub" style="margin:0;">No one in this live lobby yet. Join to start it.</p>';
    }
    arcadeMpSetStatus(arcadeMp.status || (arcadeMp.connected ? 'Live · scores update in real time.' : 'Join the public lobby to play with everyone.'));
    arcadeMpRenderBoard();
}

function arcadeMpLeave(quiet) {
    if (arcadeMp.timer) {
        clearInterval(arcadeMp.timer);
        arcadeMp.timer = 0;
    }
    const channel = arcadeMp.channel;
    arcadeMp.channel = null;
    arcadeMp.connected = false;
    if (channel) {
        try {
            const left = channel.untrack();
            if (left && left.catch) left.catch(function () {});
        } catch (e) {}
        if (supabaseClient && supabaseClient.removeChannel) {
            try {
                const removed = supabaseClient.removeChannel(channel);
                if (removed && removed.catch) removed.catch(function () {});
            } catch (e) {}
        }
    }
    arcadeMp.players = {};
    arcadeMp.gameId = 0;
    arcadeMp.panelOpen = false;
    const panel = document.getElementById('g3dArcadeMpPanel');
    if (panel) panel.style.display = 'none';
    arcadeMpRenderBoard();
    if (!quiet) arcadeMpSetStatus('Left the live lobby.');
    touchPresence();
}

let dmState = {
    open: false,
    contact: '',
    groupId: '',
    showChat: false,
    groups: {},
    hiddenGroups: {},
    groupSelected: [],
    rows: [],
    poll: 0,
    myKeys: null,
    keyCache: {},
    publicCache: {}
};

function dmShowChat(show) {
    dmState.showChat = !!show;
    var panel = document.getElementById('g3dDmSidebar');
    if (panel) panel.classList.toggle('is-chat', !!show);
}

function dmPresenceLabel(name) {
    try {
        var p = friendData && friendData.presence ? friendData.presence[name] : null;
        if (p && typeof isOnline === 'function' && isOnline(p.last_seen)) return 'online';
        if (p && typeof formatLastSeen === 'function') return 'last seen ' + formatLastSeen(p.last_seen);
    } catch (e) {}
    return 'end-to-end encrypted';
}

function dmSetStatus(text, isError) {
    const el = document.getElementById('g3dDmStatus');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
}

function dmB64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function dmUnb64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function dmCryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
}

function dmMakeId() {
    try {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) {}
    return 'm' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function dmGroupsStorageKey() {
    return currentUser && currentUser.username ? 'lessfun_dm_groups_' + currentUser.username : '';
}

function dmLoadGroups() {
    dmState.groups = {};
    dmState.groupId = '';
    dmState.groupSelected = [];
    const key = dmGroupsStorageKey();
    if (!key) return;
    try {
        const raw = localStorage.getItem(key);
        if (raw) dmState.groups = JSON.parse(raw) || {};
    } catch (e) { dmState.groups = {}; }
    dmState.hiddenGroups = {};
    try {
        const hidden = localStorage.getItem('lessfun_dm_hidden_groups_' + (currentUser ? currentUser.username : ''));
        if (hidden) dmState.hiddenGroups = JSON.parse(hidden) || {};
    } catch (e) { dmState.hiddenGroups = {}; }
}

function dmSaveHiddenGroups() {
    const key = currentUser && currentUser.username ? 'lessfun_dm_hidden_groups_' + currentUser.username : '';
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(dmState.hiddenGroups || {})); } catch (e) {}
}

function dmSaveGroups() {
    const key = dmGroupsStorageKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(dmState.groups)); } catch (e) {}
}

function dmAddGroup(id, name, members) {
    if (!id) return null;
    if (dmState.hiddenGroups && dmState.hiddenGroups[id]) return null;
    const cleanMembers = [];
    (members || []).forEach(function (member) {
        const value = String(member || '').trim();
        if (value && cleanMembers.indexOf(value) < 0) cleanMembers.push(value);
    });
    const me = currentUser && currentUser.username;
    if (me && cleanMembers.indexOf(me) < 0) cleanMembers.unshift(me);
    const existing = dmState.groups[id] || {};
    const group = {
        id: id,
        name: String(name || existing.name || 'Group').slice(0, 40),
        members: cleanMembers.length ? cleanMembers : (existing.members || []),
        creator: existing.creator || (currentUser && currentUser.username) || '',
        updated_at: Date.now()
    };
    if (dmState.hiddenGroups && dmState.hiddenGroups[id]) delete dmState.hiddenGroups[id];
    dmState.groups[id] = group;
    dmSaveGroups();
    return group;
}

async function dmDecodeRow(row) {
    if (!row || !row.ciphertext || !row.iv || !currentUser || currentUser.type !== 'user') return null;
    const me = currentUser.username;
    const other = row.sender === me ? row.recipient : row.sender;
    if (!other) return null;
    let key = null;
    try { key = await dmDeriveKey(other); } catch (e) { return null; }
    let text = null;
    try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dmUnb64(row.iv) }, key, dmUnb64(row.ciphertext));
        text = new TextDecoder().decode(plain);
    } catch (e) { return null; }
    let envelope = null;
    if (text && text.charAt(0) === '{') {
        try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.k === 'g' && parsed.g) envelope = parsed;
        } catch (e) {}
    }
    return {
        envelope: envelope,
        text: envelope ? String(envelope.t || '') : text,
        sender: row.sender,
        created_at: row.created_at
    };
}

async function dmScanGroups(rows) {
    let changed = false;
    for (let i = 0; i < (rows || []).length; i++) {
        const row = rows[i];
        if (!row) continue;
        const decoded = await dmDecodeRow(row);
        if (!decoded || !decoded.envelope) continue;
        row.__group = decoded.envelope.g;
        row.__text = decoded.text;
        row.__sender = decoded.sender;
        row.__mid = decoded.envelope.mid || '';
        row.__envelope = decoded.envelope;
        const before = dmState.groups[decoded.envelope.g];
        const group = dmAddGroup(decoded.envelope.g, decoded.envelope.n, decoded.envelope.m);
        if (!before || !group) changed = true;
    }
    return changed;
}

async function dmEnsureKeys() {
    if (!currentUser || currentUser.type !== 'user') throw new Error('Sign in to use private messages.');
    if (!dmCryptoAvailable()) throw new Error('This browser does not support encrypted messaging.');
    if (!supabaseClient) throw new Error('Private messages need an online connection.');
    if (dmState.myKeys) return dmState.myKeys;
    const storageKey = 'lessfun_dm_keys_' + currentUser.username;
    let keys = null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) keys = JSON.parse(raw);
    } catch (e) {}
    if (!keys || !keys.privateJwk || !keys.publicJwk) {
        const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
        keys = {
            privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
            publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey)
        };
        try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch (e) {}
    }
    const res = await socialQuery(supabaseClient.from('users').update({
        public_key: JSON.stringify(keys.publicJwk)
    }).eq('username', currentUser.username));
    if (res.error) throw new Error('Run supabase/messages.sql to enable encrypted messages.');
    dmState.myKeys = keys;
    dmState.publicCache[currentUser.username.toLowerCase()] = keys.publicJwk;
    return keys;
}

async function dmGetPublicKey(username) {
    const key = String(username || '').toLowerCase();
    if (dmState.publicCache[key]) return dmState.publicCache[key];
    const res = await socialQuery(supabaseClient.from('users').select('public_key').eq('username', username).maybeSingle());
    if (res.error) throw new Error('Run supabase/messages.sql to enable encrypted messages.');
    if (!res.data || !res.data.public_key) throw new Error(username + ' has not opened private messages yet.');
    let jwk = null;
    try { jwk = JSON.parse(res.data.public_key); } catch (e) {}
    if (!jwk) throw new Error(username + ' has an invalid messaging key.');
    dmState.publicCache[key] = jwk;
    return jwk;
}

async function dmDeriveKey(username) {
    const cacheKey = String(username || '').toLowerCase();
    if (dmState.keyCache[cacheKey]) return dmState.keyCache[cacheKey];
    const mine = await dmEnsureKeys();
    const theirJwk = await dmGetPublicKey(username);
    const privateKey = await crypto.subtle.importKey('jwk', mine.privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const publicKey = await crypto.subtle.importKey('jwk', theirJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const key = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: publicKey },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    dmState.keyCache[cacheKey] = key;
    return key;
}

async function dmFetchRows() {
    const me = currentUser && currentUser.username;
    if (!me || !supabaseClient) return [];
    const [sent, received] = await Promise.all([
        socialQuery(supabaseClient.from('direct_messages').select('*').eq('sender', me).order('created_at', { ascending: false }).limit(200)),
        socialQuery(supabaseClient.from('direct_messages').select('*').eq('recipient', me).order('created_at', { ascending: false }).limit(200))
    ]);
    if (sent.error || received.error) throw new Error('Run supabase/messages.sql to enable private messages.');
    const seen = {};
    const rows = [];
    (sent.data || []).concat(received.data || []).forEach(function (row) {
        if (!row || seen[row.id]) return;
        seen[row.id] = true;
        rows.push(row);
    });
    rows.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    dmState.rows = rows;
    return rows;
}

function dmPartners() {
    const me = currentUser && currentUser.username;
    const partners = [];
    const seen = {};
    dmState.rows.forEach(function (row) {
        if (row.__group) return;
        const other = row.sender === me ? row.recipient : row.sender;
        if (!other || other === me || seen[other]) return;
        seen[other] = true;
        partners.push(other);
    });
    if (dmState.contact && !seen[dmState.contact]) partners.unshift(dmState.contact);
    return partners;
}

function dmRenderList() {
    const list = document.getElementById('g3dDmList');
    if (!list) return;
    const partners = dmPartners();
    const groups = Object.keys(dmState.groups).map(function (id) {
        return dmState.groups[id];
    }).filter(Boolean).sort(function (a, b) {
        return (b.updated_at || 0) - (a.updated_at || 0);
    });
    if (!partners.length && !groups.length) {
        list.innerHTML = '<p class="game3d-dm-empty">No conversations yet.</p>';
        return;
    }
    let html = '';
    if (groups.length) {
        html += '<p class="game3d-dm-label">Groups</p>';
        html += groups.map(function (group) {
            const count = Math.max(0, (group.members || []).length);
            var gInitial = String(group.name || 'G').trim().charAt(0).toUpperCase();
            return '<button type="button" class="game3d-dm-contact is-group' + (group.id === dmState.groupId ? ' is-active' : '') + '" onclick="dmOpenGroup(\'' + debugArg(group.id) + '\')">' +
                '<span class="game3d-dm-avatar is-group">' + escapeHtml(gInitial) + '</span>' +
                '<span class="game3d-dm-contact-main"><span class="game3d-dm-contact-name">' + escapeHtml(group.name || 'Group') + '</span>' +
                '<small>' + count + ' members · encrypted</small></span>' +
                '<span class="game3d-dm-contact-count">' + count + '</span>' +
            '</button>';
        }).join('');
    }
    if (partners.length) {
        html += '<p class="game3d-dm-label">Direct</p>';
        html += partners.map(function (name) {
            var dInitial = String(name || '?').trim().charAt(0).toUpperCase();
            return '<button type="button" class="game3d-dm-contact' + (!dmState.groupId && name === dmState.contact ? ' is-active' : '') + '" onclick="dmOpenConversation(\'' + debugArg(name) + '\')">' +
                '<span class="game3d-dm-avatar">' + escapeHtml(dInitial) + '</span>' +
                '<span class="game3d-dm-contact-main"><span class="game3d-dm-contact-name">' + escapeHtml(name) + '</span><small>Encrypted chat</small></span>' +
                '<span class="game3d-dm-contact-dot"></span>' +
            '</button>';
        }).join('');
    }
    list.innerHTML = html;
}

function dmRenderThread() {
    const thread = document.getElementById('g3dDmThread');
    if (!thread) return;
    const me = currentUser ? currentUser.username : '';
    if (dmState.groupId) {
        const group = dmState.groups[dmState.groupId];
        if (!group) {
            thread.innerHTML = '<p class="game3d-dm-empty">This group is unavailable.</p>';
            return;
        }
        const rows = dmState.groupThread || [];
        const meName = currentUser ? currentUser.username : '';
        const canDelete = !group.creator || group.creator === meName;
        let html = '<div class="game3d-dm-chat-head">' +
            '<button type="button" class="game3d-dm-back" onclick="dmShowChat(false)" aria-label="Back to chats">‹</button>' +
            '<span class="game3d-dm-avatar is-group">' + escapeHtml(String(group.name || 'G').charAt(0).toUpperCase()) + '</span>' +
            '<div class="game3d-dm-chat-title"><strong>' + escapeHtml(group.name || 'Group') + '</strong>' +
            '<span>' + Math.max(0, (group.members || []).length) + ' members · end-to-end encrypted</span></div>' +
            '<div class="game3d-dm-group-buttons">' +
                (canDelete ? '<button type="button" class="game3d-dm-group-delete" onclick="dmDeleteGroup(\'' + debugArg(group.id) + '\')">Delete</button>' : '') +
            '</div>' +
        '</div>';
        if (!rows.length) {
            html += '<p class="game3d-dm-empty">No group messages yet. Say hello.</p>';
        } else {
            html += '<div class="game3d-dm-date">TODAY</div>';
            html += rows.map(function (row) {
                const mine = row.sender === me;
                return '<div class="game3d-dm-msg' + (mine ? ' is-mine' : '') + '">' +
                    (!mine ? '<span class="game3d-dm-msg-from">' + escapeHtml(row.sender) + '</span>' : '') +
                    '<span class="game3d-dm-msg-text">' + escapeHtml(row.text) + '</span>' +
                    '<span class="game3d-dm-msg-time">' + escapeHtml(new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + (mine ? ' <b class="game3d-dm-tick">✓✓</b>' : '') + '</span>' +
                '</div>';
            }).join('');
        }
        html += '<div class="game3d-dm-group-footer">' +
            '<span>' + Math.max(0, (group.members || []).length) + ' members · end-to-end encrypted</span>' +
            '<button type="button" class="game3d-dm-group-leave" onclick="dmLeaveGroup(\'' + debugArg(group.id) + '\')">Leave group</button>' +
        '</div>';
        thread.innerHTML = html;
        return;
    }
    if (!dmState.contact) {
        thread.innerHTML = '<p class="game3d-dm-empty">Pick a conversation or enter a username.</p>';
        return;
    }
    const rows = dmState.thread || [];
    const dmName = dmState.contact;
    let dHtml = '<div class="game3d-dm-chat-head">' +
        '<button type="button" class="game3d-dm-back" onclick="dmShowChat(false)" aria-label="Back to chats">‹</button>' +
        '<span class="game3d-dm-avatar">' + escapeHtml(String(dmName).charAt(0).toUpperCase()) + '</span>' +
        '<div class="game3d-dm-chat-title"><strong>' + escapeHtml(dmName) + '</strong><span>' + escapeHtml(dmPresenceLabel(dmName)) + '</span></div>' +
    '</div>';
    if (!rows.length) {
        dHtml += '<p class="game3d-dm-empty">No messages with ' + escapeHtml(dmName) + ' yet.</p>';
    } else {
        dHtml += '<div class="game3d-dm-date">TODAY</div>';
        dHtml += rows.map(function (row) {
            const mine = row.sender === me;
            return '<div class="game3d-dm-msg' + (mine ? ' is-mine' : '') + '">' +
                '<span class="game3d-dm-msg-text">' + escapeHtml(row.text) + '</span>' +
                '<span class="game3d-dm-msg-time">' + escapeHtml(new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + (mine ? ' <b class="game3d-dm-tick">✓✓</b>' : '') + '</span>' +
            '</div>';
        }).join('');
    }
    thread.innerHTML = dHtml;
}

async function dmLoadInbox() {
    if (!currentUser || currentUser.type !== 'user') {
        dmSetStatus('Sign in to use private messages.', true);
        return;
    }
    try {
        await dmEnsureKeys();
        dmLoadGroups();
        const rows = await dmFetchRows();
        await dmScanGroups(rows);
        dmRenderList();
        if (dmState.groupId) await dmRefreshGroup(true);
        else if (dmState.contact) await dmRefreshThread(true);
        else dmRenderThread();
        dmSetStatus('Encrypted on this device.', false);
    } catch (e) {
        dmSetStatus(e.message || 'Could not open messages.', true);
    }
}

async function dmOpenConversation(username) {
    const name = String(username || '').trim();
    if (!name) return;
    dmState.groupId = '';
    dmState.contact = name;
    localStorage.setItem('lessfun_dm_contact', name);
    dmShowChat(true);
    dmRenderList();
    await dmRefreshThread();
    const input = document.getElementById('g3dDmInput');
    if (input) input.focus();
}

async function dmOpenGroup(id) {
    const group = dmState.groups[id];
    if (!group) return;
    dmState.groupId = id;
    dmState.contact = '';
    dmShowChat(true);
    dmRenderList();
    await dmRefreshGroup();
    const input = document.getElementById('g3dDmInput');
    if (input) input.focus();
}

async function dmRefreshGroup(quiet) {
    const groupId = dmState.groupId;
    if (!groupId || !currentUser || currentUser.type !== 'user') return;
    try {
        const rows = await dmFetchRows();
        await dmScanGroups(rows);
        const group = dmState.groups[groupId] || {};
        const collection = [];
        const seen = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.__group !== groupId) continue;
            const envelope = row.__envelope || null;
            const text = row.__text;
            const mid = (envelope && envelope.mid) || row.__mid || 'row-' + i;
            if (seen[mid]) continue;
            seen[mid] = true;
            collection.push({
                sender: row.sender,
                text: text == null ? '🔒 Encrypted message — key unavailable' : text,
                created_at: row.created_at
            });
        }
        collection.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        dmState.groupThread = collection;
        dmRenderList();
        dmRenderThread();
        if (!quiet) dmSetStatus('Group · end-to-end encrypted.', false);
    } catch (e) {
        if (!quiet) dmSetStatus(e.message || 'Could not load the group.', true);
    }
}

async function dmRefreshThread(quiet) {
    if (!dmState.contact || !currentUser || currentUser.type !== 'user') return;
    try {
        const rows = await dmFetchRows();
        await dmScanGroups(rows);
        const me = currentUser.username;
        const contact = dmState.contact;
        const pair = rows.filter(function (row) {
            if (row.__group) return false;
            return (row.sender === me && row.recipient === contact) || (row.sender === contact && row.recipient === me);
        });
        let key = null;
        try { key = await dmDeriveKey(contact); } catch (e) { key = null; }
        const decoded = [];
        for (let i = 0; i < pair.length; i++) {
            const row = pair[i];
            let text = null;
            if (key && row.ciphertext && row.iv) {
                try {
                    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dmUnb64(row.iv) }, key, dmUnb64(row.ciphertext));
                    text = new TextDecoder().decode(plain);
                } catch (e) {}
            }
            decoded.push({
                sender: row.sender,
                recipient: row.recipient,
                created_at: row.created_at,
                text: text == null ? '🔒 Encrypted message — key unavailable' : text
            });
        }
        dmState.thread = decoded;
        dmRenderList();
        dmRenderThread();
        if (!quiet) dmSetStatus(key ? 'End-to-end encrypted.' : 'Waiting for ' + contact + ' to open messages once.', !key);
    } catch (e) {
        if (!quiet) dmSetStatus(e.message || 'Could not load messages.', true);
    }
}

async function dmSend() {
    if (!currentUser || currentUser.type !== 'user') {
        dmSetStatus('Sign in to send private messages.', true);
        return;
    }
    const groupId = dmState.groupId;
    if (!groupId && !dmState.contact) {
        dmSetStatus('Choose who to message first.', true);
        return;
    }
    const input = document.getElementById('g3dDmInput');
    const text = String(input ? input.value : '').trim();
    if (!text) return;
    if (text.length > 500) {
        dmSetStatus('Messages are limited to 500 characters.', true);
        return;
    }
    if (groupId) {
        const group = dmState.groups[groupId];
        if (!group) {
            dmSetStatus('This group is unavailable.', true);
            return;
        }
        const me = currentUser.username;
        const members = (group.members || []).filter(function (name) { return name && name !== me; });
        if (!members.length) {
            dmSetStatus('Add someone to this group first.', true);
            return;
        }
        const mid = dmMakeId();
        const envelope = JSON.stringify({
            v: 1,
            k: 'g',
            g: groupId,
            n: group.name,
            m: group.members,
            mid: mid,
            t: text,
            at: new Date().toISOString()
        });
        let sent = 0;
        let failed = 0;
        try {
            for (let i = 0; i < members.length; i++) {
                const member = members[i];
                try {
                    const key = await dmDeriveKey(member);
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(envelope));
                    const res = await socialQuery(supabaseClient.from('direct_messages').insert({
                        sender: me,
                        recipient: member,
                        ciphertext: dmB64(cipher),
                        iv: dmB64(iv)
                    }));
                    if (res && !res.error) sent++;
                    else failed++;
                } catch (e) {
                    failed++;
                }
            }
        } catch (e) {
            dmSetStatus(e.message || 'Could not encrypt that message.', true);
            return;
        }
        if (!sent) {
            dmSetStatus(failed ? 'Could not send to the group. Run supabase/messages.sql.' : 'Could not send to the group.', true);
            return;
        }
        if (input) input.value = '';
        dmState.groupThread = (dmState.groupThread || []).concat([{
            sender: me,
            text: text,
            created_at: new Date().toISOString()
        }]);
        group.updated_at = Date.now();
        dmSaveGroups();
        dmRenderThread();
        dmSetStatus(failed ? 'Sent to ' + sent + ', failed for ' + failed + '.' : 'Sent to ' + sent + ' group member' + (sent === 1 ? '' : 's') + '.', !!failed);
        return;
    }
    try {
        const key = await dmDeriveKey(dmState.contact);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text));
        const res = await socialQuery(supabaseClient.from('direct_messages').insert({
            sender: currentUser.username,
            recipient: dmState.contact,
            ciphertext: dmB64(cipher),
            iv: dmB64(iv)
        }));
        if (res.error) {
            dmSetStatus('Could not send: ' + (res.error.message || 'run supabase/messages.sql'), true);
            return;
        }
        if (input) input.value = '';
        dmState.thread = (dmState.thread || []).concat([{
            sender: currentUser.username,
            recipient: dmState.contact,
            created_at: new Date().toISOString(),
            text: text
        }]);
        dmRenderThread();
        dmSetStatus('Sent encrypted.', false);
    } catch (e) {
        dmSetStatus(e.message || 'Could not encrypt that message.', true);
    }
}

function dmToggleGroupForm(force) {
    const form = document.getElementById('g3dDmGroupForm');
    if (!form) return;
    const show = force === false ? false : (force === true ? true : form.style.display === 'none');
    form.style.display = show ? 'flex' : 'none';
    if (show) {
        dmState.groupSelected = [];
        dmRenderGroupSelected();
        const results = document.getElementById('g3dDmGroupResults');
        if (results) results.innerHTML = '';
        const nameInput = document.getElementById('g3dDmGroupName');
        if (nameInput) nameInput.focus();
    }
}

function dmRenderGroupSelected() {
    const host = document.getElementById('g3dDmGroupSelected');
    if (!host) return;
    if (!dmState.groupSelected.length) {
        host.innerHTML = '<span class="game3d-dm-hint">Pick at least one person.</span>';
        return;
    }
    host.innerHTML = dmState.groupSelected.map(function (name) {
        return '<button type="button" class="game3d-dm-chip" onclick="dmRemoveGroupMember(\'' + debugArg(name) + '\')">' +
            escapeHtml(name) + ' ×</button>';
    }).join('');
}

function dmRemoveGroupMember(name) {
    dmState.groupSelected = dmState.groupSelected.filter(function (entry) { return entry !== name; });
    dmRenderGroupSelected();
}

let dmGroupSearchTimer = 0;
let dmGroupSearchToken = 0;

function dmSearchGroupUsers(value) {
    const results = document.getElementById('g3dDmGroupResults');
    const query = String(value || '').trim();
    if (!query) {
        if (results) results.innerHTML = '';
        return;
    }
    if (dmGroupSearchTimer) clearTimeout(dmGroupSearchTimer);
    dmGroupSearchTimer = setTimeout(function () { dmRunGroupSearch(query); }, 250);
}

async function dmRunGroupSearch(query) {
    const results = document.getElementById('g3dDmGroupResults');
    if (!results || !supabaseClient) return;
    const token = ++dmGroupSearchToken;
    const safe = query.replace(/[%_]/g, '');
    let res = await socialQuery(supabaseClient.from('users').select('username, avatar').ilike('username', '%' + safe + '%').limit(8));
    if (res.error) {
        res = await socialQuery(supabaseClient.from('users').select('username').ilike('username', '%' + safe + '%').limit(8));
    }
    if (token !== dmGroupSearchToken) return;
    if (res.error) {
        results.innerHTML = '<p class="game3d-dm-empty">Search unavailable. Run supabase/messages.sql.</p>';
        return;
    }
    const me = currentUser && currentUser.username;
    const users = (res.data || []).filter(function (row) {
        return row.username && row.username !== me && dmState.groupSelected.indexOf(row.username) < 0;
    });
    if (!users.length) {
        results.innerHTML = '<p class="game3d-dm-empty">No users match.</p>';
        return;
    }
    results.innerHTML = users.map(function (row) {
        rememberAvatar(row.username, row.avatar);
        return '<button type="button" class="game3d-dm-result" onclick="dmAddGroupMember(\'' + debugArg(row.username) + '\')">' +
            userAvatarHtml(row.username, 'reply-avatar') +
            '<span>' + escapeHtml(row.username) + '</span>' +
        '</button>';
    }).join('');
}

function dmAddGroupMember(name) {
    if (!name || dmState.groupSelected.indexOf(name) >= 0) return;
    if (dmState.groupSelected.length >= 16) {
        dmSetStatus('Groups are limited to 16 people.', true);
        return;
    }
    dmState.groupSelected.push(name);
    dmRenderGroupSelected();
    const results = document.getElementById('g3dDmGroupResults');
    if (results) results.innerHTML = '';
    const search = document.getElementById('g3dDmGroupSearch');
    if (search) search.value = '';
}

function dmCreateGroup() {
    if (!dmState.groupSelected.length) {
        dmSetStatus('Pick at least one person for the group.', true);
        return;
    }
    const nameInput = document.getElementById('g3dDmGroupName');
    const name = String(nameInput ? nameInput.value : '').trim() || 'Group';
    const me = currentUser ? currentUser.username : '';
    const members = [me].concat(dmState.groupSelected).filter(Boolean);
    const id = 'g-' + dmMakeId();
    dmAddGroup(id, name, members);
    dmState.groupId = id;
    dmState.contact = '';
    dmState.groupThread = [];
    dmToggleGroupForm(false);
    if (nameInput) nameInput.value = '';
    const search = document.getElementById('g3dDmGroupSearch');
    if (search) search.value = '';
    dmState.groupSelected = [];
    dmRenderList();
    dmRenderThread();
    dmSetStatus('Group created. Send the first message.', false);
    const input = document.getElementById('g3dDmInput');
    if (input) input.focus();
}

async function dmDeleteGroup(id) {
    const group = dmState.groups[id];
    if (!group) return;
    if (!window.confirm('Delete group "' + (group.name || 'Group') + '"? This removes it from your Messages.')) return;
    delete dmState.groups[id];
    dmState.hiddenGroups[id] = Date.now();
    dmSaveHiddenGroups();
    if (dmState.groupId === id) {
        dmState.groupId = '';
        dmState.groupThread = [];
    }
    dmSaveGroups();
    dmShowChat(false);
    dmRenderList();
    dmRenderThread();
    dmSetStatus('Group deleted.', false);
}

async function dmLeaveGroup(id) {
    const group = dmState.groups[id];
    if (!group) return;
    if (!window.confirm('Leave group "' + (group.name || 'Group') + '"?')) return;
    const me = currentUser ? currentUser.username : '';
    group.members = (group.members || []).filter(function (member) { return member !== me; });
    // Groups are stored locally, so leaving removes the group from this
    // device's message list. Keep a tombstone so old messages cannot re-add it.
    delete dmState.groups[id];
    dmState.hiddenGroups[id] = Date.now();
    dmSaveHiddenGroups();
    if (dmState.groupId === id) {
        dmState.groupId = '';
        dmState.groupThread = [];
    }
    dmSaveGroups();
    dmShowChat(false);
    dmRenderList();
    dmRenderThread();
    dmSetStatus('You left the group.', false);
}

function dmToggleEmoji() {
    const row = document.getElementById('g3dDmEmoji');
    if (!row) return;
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
}

function dmInsertEmoji(emoji) {
    const input = document.getElementById('g3dDmInput');
    if (!input) return;
    input.value = (input.value || '') + emoji;
    input.focus();
}

function dmStartConversation() {
    const input = document.getElementById('g3dDmNewUser');
    const name = String(input ? input.value : '').trim();
    if (!name) {
        dmSetStatus('Enter the username to message.', true);
        return;
    }
    if (input) input.value = '';
    dmOpenConversation(name);
}

let dmSearchTimer = 0;
let dmSearchToken = 0;

function dmSearchUsers(value) {
    const results = document.getElementById('g3dDmResults');
    const query = String(value || '').trim();
    if (!query) {
        if (results) results.innerHTML = '';
        return;
    }
    if (dmSearchTimer) clearTimeout(dmSearchTimer);
    dmSearchTimer = setTimeout(function () { dmRunUserSearch(query); }, 250);
}

async function dmRunUserSearch(query) {
    const results = document.getElementById('g3dDmResults');
    if (!results || !supabaseClient) return;
    const token = ++dmSearchToken;
    const safe = query.replace(/[%_]/g, '');
    let res = await socialQuery(supabaseClient.from('users').select('username, avatar').ilike('username', '%' + safe + '%').limit(8));
    if (res.error) {
        res = await socialQuery(supabaseClient.from('users').select('username').ilike('username', '%' + safe + '%').limit(8));
    }
    if (token !== dmSearchToken) return;
    if (res.error) {
        results.innerHTML = '<p class="game3d-dm-empty">Search unavailable. Run supabase/messages.sql.</p>';
        return;
    }
    const me = currentUser && currentUser.username;
    const users = (res.data || []).filter(function (row) { return row.username && row.username !== me; });
    if (!users.length) {
        results.innerHTML = '<p class="game3d-dm-empty">No users match.</p>';
        return;
    }
    results.innerHTML = users.map(function (row) {
        rememberAvatar(row.username, row.avatar);
        return '<button type="button" class="game3d-dm-result" onclick="dmPickSearchResult(\'' + debugArg(row.username) + '\')">' +
            userAvatarHtml(row.username, 'reply-avatar') +
            '<span>' + escapeHtml(row.username) + '</span>' +
        '</button>';
    }).join('');
}

function dmPickSearchResult(username) {
    const results = document.getElementById('g3dDmResults');
    const search = document.getElementById('g3dDmSearch');
    if (results) results.innerHTML = '';
    if (search) search.value = '';
    dmOpenConversation(username);
}

function toggleDmSidebar(force) {
    const wantOpen = force === false ? false : (force === true ? true : !dmState.open);
    dmState.open = wantOpen;
    const panel = document.getElementById('g3dDmSidebar');
    const btn = document.getElementById('g3dMsgBtn');
    if (panel) panel.style.display = wantOpen ? 'flex' : 'none';
    if (btn) btn.classList.toggle('is-open', wantOpen);
    if (wantOpen) {
        dmShowChat(false);
        dmSetStatus('');
        dmLoadInbox();
        if (dmState.poll) clearInterval(dmState.poll);
        dmState.poll = setInterval(function () {
            if (!dmState.open) return;
            if (dmState.groupId) dmRefreshGroup(true);
            else if (dmState.contact) dmRefreshThread(true);
        }, 5000);
    } else if (dmState.poll) {
        clearInterval(dmState.poll);
        dmState.poll = 0;
    }
    // Messages do not pause the game. Typing is ignored by game controls while
    // an input/textarea is focused.
}

function dmClose() {
    if (dmState.poll) { clearInterval(dmState.poll); dmState.poll = 0; }
    dmState.open = false;
    dmState.groupId = '';
    dmShowChat(false);
    const panel = document.getElementById('g3dDmSidebar');
    const btn = document.getElementById('g3dMsgBtn');
    if (panel) panel.style.display = 'none';
    if (btn) btn.classList.remove('is-open');
    dmToggleGroupForm(false);
}


async function saveScore(gameName, score) {
    if (!currentUser || currentUser.type === 'guest' || !currentUser.persistScores) return;
    var entry = {
        username: currentUser.username,
        game: gameName,
        score: Math.max(0, Math.floor(Number(score) || 0)),
        created_at: new Date().toISOString()
    };
    var saved = false;
    if (supabaseClient) {
        try {
            var res = await supabaseClient.from('scores').insert(entry);
            saved = !res || !res.error;
        } catch (e) { /* table may not exist yet */ }
    }
    if (!saved) {
        // Scores are the one thing allowed to cache locally.
        try {
            var key = 'lessfun_scores';
            var list = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(list)) list = [];
            list.push(entry);
            localStorage.setItem(key, JSON.stringify(list.slice(-200)));
        } catch (e) {}
    }
}

function closePromo() { const p=document.getElementById('promoBanner'); if(p){ p.style.display='none'; p.dataset.dismissed='1'; } }

function handleProfileNavClick() {
    if (currentUser && currentUser.type === 'user') {
        logout();
    } else {
        openAuthModal();
    }
}

function applySoundSetting() {
    if (window.Games3D && window.Games3D.setSoundEnabled) window.Games3D.setSoundEnabled(soundSetting);
    const toggle = document.getElementById('soundToggle');
    if (toggle) toggle.checked = soundSetting;
}

function applyUnitSetting() {
    if (window.Games3D && window.Games3D.setUnitSystem) window.Games3D.setUnitSystem(unitSetting);
    const select = document.getElementById('unitSelect');
    if (select) select.value = unitSetting;
}

function setUnitSetting(value) {
    unitSetting = value === 'kmh' ? 'kmh' : 'mph';
    try { localStorage.setItem('lessfun_units', unitSetting); } catch (e) {}
    applyUnitSetting();
    if (currentGameId === 1 && window.Games3D) {
        window.Games3D.setPaused(false);
    }
}

function setSoundSetting(on) {
    soundSetting = !!on;
    try { localStorage.setItem('lessfun_sound', soundSetting ? 'true' : 'false'); } catch (e) {}
    applySoundSetting();
    if (window.LessFunJingle) window.LessFunJingle.setSoundEnabled(soundSetting);
}

function awardRunCoins(amount) {
    const earned = Math.max(0, Math.floor(Number(amount) || 0));
    lastRunCoins = earned;
    if (!earned || !wallet) return;
    wallet.shells = Math.max(0, (Number(wallet.shells) || 0) + earned);
    wallet.totalEarned = Math.max(0, (Number(wallet.totalEarned) || 0) + earned);
    saveWallet();
    renderWalletUI();
}

function updateUserSection() {
    const txt=document.getElementById('navProfileText');
    if(txt){
        if(currentUser && currentUser.type==='user' && currentUser.username !== 'Guest' && currentUser.username !== 'Anonymous-Guest'){
            txt.textContent = 'Log Out';
        } else {
            txt.textContent = 'Sign In';
        }
    }

    const debugBtn = document.getElementById('nav-debug');
    if (debugBtn) debugBtn.style.display = isOwner() ? 'inline-flex' : 'none';
    const debugGroup = document.getElementById('debugSettingsGroup');
    if (debugGroup) debugGroup.style.display = isOwner() ? 'block' : 'none';
    closeDevConsole(true);
    closeDevAISettings();

    if (!isOwner()) {
        ownerUnlocked = false;
        if (currentView === 'debug') showView('games');
    }

    // Keep featured/disabled game markers correct after sign-in or logout.
    renderGames();
}

let devConsoleState = {
    open: false,
    rows: [],
    logs: [],
    poll: 0,
    seen: {},
    loaded: false,
    aiBusy: {}
};

const DEV_AI_DEFAULTS = {
    endpoint: 'https://text.pollinations.ai/openai',
    model: 'openai',
    key: '',
    system: 'You are OpenCode, the AI build assistant embedded in LessFun, a browser arcade built with vanilla HTML/CSS/JS and Three.js. A developer is sending you a change request. Reply with a concise, practical implementation plan: what files/systems are involved, exact tuning or code guidance, risks, and how to test it. Do not claim you already changed the files. Keep it under 220 words. If the request is unsafe or impossible in a static browser game, say so clearly.'
};

function devAIConfig() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('lessfun_dev_ai') || '{}') || {}; } catch (e) {}
    return Object.assign({}, DEV_AI_DEFAULTS, saved);
}

function devSetStatus(message, isError) {
    const el = document.getElementById('devConsoleStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', !!isError);
}

function devTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
}

function devSnippet(text, max) {
    const value = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return value.length > (max || 180) ? value.slice(0, max || 180) + '…' : value;
}

function devCard(row, canReview) {
    const status = String(row.status || 'pending');
    const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Awaiting owner';
    return '<article class="dev-request is-' + escapeAttr(status) + '">' +
        '<div class="dev-request-head">' +
            '<strong>' + escapeHtml(row.developer || 'Developer') + '</strong>' +
            '<span class="dev-request-status is-' + escapeAttr(status) + '">' + escapeHtml(statusLabel) + '</span>' +
            '<time>' + escapeHtml(devTime(row.created_at)) + '</time>' +
        '</div>' +
        '<p class="dev-request-message">' + escapeHtml(row.message || '') + '</p>' +
        (row.owner_note ? '<p class="dev-request-note"><strong>Owner note:</strong> ' + escapeHtml(row.owner_note) + '</p>' : '') +
        (row.ai_reply ?
            '<div class="dev-ai-block">' +
                '<div class="dev-ai-head"><span>◈ OpenCode AI</span>' + (row.ai_model ? '<small>' + escapeHtml(row.ai_model) + '</small>' : '') + '</div>' +
                '<p class="dev-ai-reply">' + escapeHtml(row.ai_reply) + '</p>' +
                (row.ai_thinking ? '<details class="dev-ai-thinking"><summary>Show AI thinking</summary><pre>' + escapeHtml(row.ai_thinking) + '</pre></details>' : '') +
            '</div>' :
            (row.ai_status === 'thinking' ? '<p class="dev-ai-pending">OpenCode AI is thinking…</p>' :
                (row.ai_status === 'error' ? '<p class="dev-ai-error">AI bridge failed. Open Settings → Developer → OpenCode AI.</p>' : ''))) +
        (status !== 'pending' && !canReview ? '<div class="dev-request-actions"><button type="button" class="dev-ai-btn" onclick="askDevAI(\'' + debugArg(String(row.id)) + '\')">Ask OpenCode again</button></div>' : '') +
        (canReview && status === 'pending' ?
            '<div class="dev-request-actions">' +
                '<button type="button" class="dev-approve" onclick="reviewDevRequest(\'' + debugArg(String(row.id)) + '\', \'approved\')">Approve &amp; queue</button>' +
                '<button type="button" class="dev-reject" onclick="reviewDevRequest(\'' + debugArg(String(row.id)) + '\', \'rejected\')">Reject</button>' +
            '</div>' : '') +
    '</article>';
}

function devRenderConsole() {
    if (!devConsoleState.open) return;
    const owner = isOwner();
    const title = document.getElementById('devConsoleTitle');
    const subtitle = document.getElementById('devConsoleSubtitle');
    if (title) title.textContent = owner ? 'Owner build channel' : 'OpenCode developer channel';
    if (subtitle) subtitle.textContent = owner
        ? 'Review every developer request, inspect OpenCode AI thinking, approve what ships, and watch the audit log.'
        : 'Talk to OpenCode AI about the build. TotallyMason sees every message and must approve changes before they ship.';
    const composer = document.getElementById('devComposer');
    if (composer) composer.style.display = owner ? 'none' : 'flex';

    const rows = devConsoleState.rows || [];
    const pending = rows.filter(function (row) { return String(row.status || 'pending') === 'pending'; });
    const queue = document.getElementById('devOwnerQueue');
    if (queue) {
        if (!owner) {
            queue.innerHTML = '';
        } else {
            queue.innerHTML = '<div class="dev-section-head"><h3>Pending approvals</h3><span class="dev-count">' + pending.length + '</span></div>' +
                (pending.length ? pending.map(function (row) { return devCard(row, true); }).join('') :
                    '<p class="dev-empty">No requests waiting. Approved and rejected items appear below.</p>') +
                '<div class="dev-section-head"><h3>Developer activity</h3><span class="dev-count">' + rows.length + '</span></div>';
        }
    }

    const own = document.getElementById('devOwnRequests');
    if (own) {
        if (owner) {
            const recent = rows.slice(0, 40);
            own.innerHTML = recent.length ? recent.map(function (row) { return devCard(row, false); }).join('') :
                '<p class="dev-empty">No developer activity yet.</p>';
        } else {
            const mine = rows.filter(function (row) { return row.developer === (currentUser && currentUser.username); });
            own.innerHTML = '<div class="dev-section-head"><h3>Your requests</h3><span class="dev-count">' + mine.length + '</span></div>' +
                (mine.length ? mine.map(function (row) { return devCard(row, false); }).join('') :
                    '<p class="dev-empty">No requests yet. Describe the change you want above.</p>');
        }
    }

    const logHost = document.getElementById('devLogList');
    if (logHost) {
        const logs = devConsoleState.logs || [];
        logHost.innerHTML = '<div class="dev-section-head"><h3>Developer log</h3><span class="dev-count">' + logs.length + '</span></div>' +
            (logs.length ? '<div class="dev-log-list">' + logs.map(function (entry) {
                return '<div class="dev-log-row">' +
                    '<span class="dev-log-action">' + escapeHtml(String(entry.action || 'action').replace(/_/g, ' ')) + '</span>' +
                    '<span class="dev-log-detail">' + escapeHtml(devSnippet(entry.detail, 220)) + '</span>' +
                    '<time>' + escapeHtml(devTime(entry.created_at)) + '</time>' +
                '</div>';
            }).join('') + '</div>' : '<p class="dev-empty">No developer activity logged yet.</p>');
    }
}

async function logDeveloper(action, detail) {
    if (!supabaseClient || !currentUser || currentUser.type !== 'user') return;
    try {
        await socialQuery(supabaseClient.from('developer_log').insert({
            developer: currentUser.username,
            action: String(action || 'action'),
            detail: String(detail || '').slice(0, 1500)
        }));
    } catch (e) {}
}

async function callDevAI(message, developer) {
    const config = devAIConfig();
    const endpoint = String(config.endpoint || DEV_AI_DEFAULTS.endpoint).trim();
    if (!endpoint) throw new Error('No AI endpoint configured.');
    const controller = window.AbortController ? new AbortController() : null;
    const timeout = setTimeout(function () { if (controller) controller.abort(); }, 45000);
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (config.key) headers.Authorization = 'Bearer ' + config.key;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            signal: controller ? controller.signal : undefined,
            body: JSON.stringify({
                model: config.model || 'openai',
                messages: [
                    { role: 'system', content: config.system || DEV_AI_DEFAULTS.system },
                    { role: 'user', content: 'Developer: ' + developer + '\nRequest: ' + message }
                ]
            })
        });
        if (!res.ok) throw new Error('AI endpoint returned HTTP ' + res.status);
        const data = await res.json();
        const choice = data && data.choices && data.choices[0];
        const payload = choice && (choice.message || choice.delta) || {};
        let content = payload.content || '';
        if (Array.isArray(content)) content = content.map(function (part) { return part && (part.text || part.content) || ''; }).join(' ');
        if (!content && typeof data.output_text === 'string') content = data.output_text;
        const thinking = payload.reasoning || payload.reasoning_content || data.reasoning || '';
        if (!content) throw new Error('AI returned an empty response.');
        return {
            reply: String(content).trim(),
            thinking: String(thinking || '').trim(),
            model: String(data.model || config.model || 'openai')
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function runDevAIForRequest(id, message, developer) {
    if (!id || !supabaseClient) return;
    try {
        await socialQuery(supabaseClient.from('developer_requests').update({ ai_status: 'thinking' }).eq('id', id));
        devConsoleState.aiBusy[String(id)] = true;
        devRenderConsole();
        await logDeveloper('ai_started', developer + ': ' + devSnippet(message, 160));
        const ai = await callDevAI(message, developer);
        const res = await socialQuery(supabaseClient.from('developer_requests').update({
            ai_reply: ai.reply,
            ai_thinking: ai.thinking,
            ai_model: ai.model,
            ai_status: 'done',
            ai_at: new Date().toISOString()
        }).eq('id', id));
        if (res.error) throw new Error(res.error.message || 'Could not store the AI reply.');
        await logDeveloper('ai_reply', 'OpenCode replied to ' + developer + ': ' + devSnippet(ai.reply, 160));
    } catch (e) {
        try {
            await socialQuery(supabaseClient.from('developer_requests').update({
                ai_status: 'error',
                ai_reply: 'OpenCode AI could not respond: ' + (e.message || 'unknown error'),
                ai_at: new Date().toISOString()
            }).eq('id', id));
        } catch (err) {}
        await logDeveloper('ai_error', devSnippet(e.message || 'AI request failed', 160));
    } finally {
        delete devConsoleState.aiBusy[String(id)];
        await loadDevRequests();
    }
}

async function askDevAI(id) {
    if (!isDeveloper() || !supabaseClient) return;
    const row = (devConsoleState.rows || []).filter(function (item) { return String(item.id) === String(id); })[0];
    if (!row) return;
    devSetStatus('OpenCode AI is thinking…', false);
    await runDevAIForRequest(row.id, row.message || '', row.developer || currentUser.username);
}

function openDevAISettings() {
    if (!isDeveloper()) return;
    const modal = document.getElementById('devAiSettingsModal');
    if (!modal) return;
    const config = devAIConfig();
    const endpoint = document.getElementById('devAiEndpoint');
    const model = document.getElementById('devAiModel');
    const key = document.getElementById('devAiKey');
    const system = document.getElementById('devAiSystem');
    if (endpoint) endpoint.value = config.endpoint;
    if (model) model.value = config.model;
    if (key) key.value = config.key || '';
    if (system) system.value = config.system || DEV_AI_DEFAULTS.system;
    const disabled = !isOwner();
    [endpoint, model, key, system].forEach(function (el) { if (el) el.disabled = disabled; });
    const status = document.getElementById('devAiSettingsStatus');
    if (status) {
        status.textContent = disabled
            ? 'Only the owner can change the bridge. The shared free OpenCode bridge is active.'
            : 'Free bridge active by default. Add a key only if your endpoint requires one.';
        status.classList.toggle('is-error', false);
    }
    ensureTopLayer(modal);
    modal.style.display = 'flex';
}

function closeDevAISettings() {
    const modal = document.getElementById('devAiSettingsModal');
    if (modal) modal.style.display = 'none';
}

function saveDevAISettings() {
    if (!isOwner()) {
        const status = document.getElementById('devAiSettingsStatus');
        if (status) { status.textContent = 'Only the owner can save the AI bridge configuration.'; status.classList.add('is-error'); }
        return;
    }
    const config = {
        endpoint: String((document.getElementById('devAiEndpoint') || {}).value || DEV_AI_DEFAULTS.endpoint).trim(),
        model: String((document.getElementById('devAiModel') || {}).value || DEV_AI_DEFAULTS.model).trim(),
        key: String((document.getElementById('devAiKey') || {}).value || '').trim(),
        system: String((document.getElementById('devAiSystem') || {}).value || DEV_AI_DEFAULTS.system).trim()
    };
    try { localStorage.setItem('lessfun_dev_ai', JSON.stringify(config)); } catch (e) {}
    const status = document.getElementById('devAiSettingsStatus');
    if (status) { status.textContent = 'Saved. New developer requests will use this AI bridge.'; status.classList.remove('is-error'); }
    logDeveloper('ai_config', 'OpenCode endpoint set to ' + config.endpoint + ' (' + config.model + ')');
}

function resetDevAISettings() {
    if (!isOwner()) return;
    try { localStorage.removeItem('lessfun_dev_ai'); } catch (e) {}
    openDevAISettings();
    const status = document.getElementById('devAiSettingsStatus');
    if (status) status.textContent = 'Reset to the free OpenCode bridge.';
}

async function openDeveloperLog() {
    if (!isDeveloper()) return;
    await openDevConsole();
    const log = document.getElementById('devLogList');
    if (log && log.scrollIntoView) log.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadDevRequests() {
    if (!devConsoleState.open || !isDeveloper()) return;
    if (!supabaseClient) {
        devSetStatus('Developer console needs an online connection.', true);
        return;
    }
    try {
        let query = supabaseClient.from('developer_requests').select('*').order('created_at', { ascending: false }).limit(200);
        let logQuery = supabaseClient.from('developer_log').select('*').order('created_at', { ascending: false }).limit(120);
        if (!isOwner()) {
            query = query.eq('developer', currentUser.username);
            logQuery = logQuery.eq('developer', currentUser.username);
        }
        const results = await Promise.all([socialQuery(query), socialQuery(logQuery)]);
        const res = results[0];
        const logRes = results[1];
        if (res.error) {
            devConsoleState.rows = [];
            devConsoleState.logs = [];
            devConsoleState.error = res.error;
            devRenderConsole();
            devSetStatus('Run supabase/dev_console.sql to enable the developer build channel.', true);
            return;
        }
        devConsoleState.error = null;
        devConsoleState.rows = res.data || [];
        devConsoleState.logs = logRes && !logRes.error ? (logRes.data || []) : [];
        // Surface approval/rejection changes to the developer.
        if (!isOwner()) {
            devConsoleState.rows.forEach(function (row) {
                const id = String(row.id);
                const previous = devConsoleState.seen[id];
                if (previous && previous !== row.status && (row.status === 'approved' || row.status === 'rejected')) {
                    const ok = row.status === 'approved';
                    showTopNotification('<strong>Request ' + (ok ? 'approved' : 'rejected') + '</strong><br>' + devSnippet(row.message, 90), ok ? '✅' : '⛔', openDevConsole);
                }
                devConsoleState.seen[id] = row.status;
            });
        }
        devConsoleState.loaded = true;
        devRenderConsole();
        devSetStatus(isOwner() ? 'Live approval queue.' : 'Your requests are visible to the owner.', false);
    } catch (e) {
        devSetStatus(e.message || 'Could not load developer requests.', true);
    }
}

async function openDevConsole() {
    if (!isDeveloper()) {
        alert('Only appointed developers can open the developer console.');
        return;
    }
    const modal = document.getElementById('devConsoleModal');
    if (!modal) return;
    ensureTopLayer(modal);
    modal.style.display = 'flex';
    devConsoleState.open = true;
    devConsoleState.seen = {};
    devSetStatus('Loading build channel…', false);
    await logDeveloper('open_console', 'Developer console opened');
    await loadDevRequests();
    if (devConsoleState.poll) clearInterval(devConsoleState.poll);
    devConsoleState.poll = setInterval(function () {
        if (devConsoleState.open) loadDevRequests();
    }, 5000);
}

function closeDevConsole(silent) {
    if (devConsoleState.poll) { clearInterval(devConsoleState.poll); devConsoleState.poll = 0; }
    devConsoleState.open = false;
    const modal = document.getElementById('devConsoleModal');
    if (modal) modal.style.display = 'none';
    if (!silent) devSetStatus('', false);
}

async function submitDevRequest() {
    if (!isDeveloper() || isOwner()) return;
    const input = document.getElementById('devRequestInput');
    const text = String(input ? input.value : '').trim();
    if (!text) {
        devSetStatus('Write a change request first.', true);
        return;
    }
    if (!supabaseClient) {
        devSetStatus('Developer console needs an online connection.', true);
        return;
    }
    const res = await socialQuery(supabaseClient.from('developer_requests').insert({
        developer: currentUser.username,
        message: text,
        status: 'pending',
        ai_status: 'thinking'
    }).select('id').maybeSingle());
    if (res.error) {
        devSetStatus('Could not send: ' + (res.error.message || 'run supabase/dev_console.sql'), true);
        return;
    }
    const requestId = res.data && res.data.id;
    if (input) input.value = '';
    devSetStatus('Request sent. OpenCode AI is working on a plan…', false);
    await logDeveloper('request_sent', text);
    await loadDevRequests();
    if (requestId) await runDevAIForRequest(requestId, text, currentUser.username);
}

async function reviewDevRequest(id, status) {
    if (!isOwner()) {
        alert('Only TotallyMason can approve developer requests.');
        return;
    }
    if (!supabaseClient) return;
    let note = '';
    if (status === 'rejected') {
        note = window.prompt('Optional reason for rejecting this request:', '') || '';
    }
    const res = await socialQuery(supabaseClient.from('developer_requests').update({
        status: status,
        owner_note: note,
        reviewed_by: currentUser.username,
        reviewed_at: new Date().toISOString()
    }).eq('id', id));
    if (res.error) {
        devSetStatus('Could not review request: ' + (res.error.message || 'run supabase/dev_console.sql'), true);
        return;
    }
    await logDeveloper(status === 'approved' ? 'request_approved' : 'request_rejected', 'Request #' + id + (note ? ' — ' + note : ''));
    devSetStatus(status === 'approved' ? 'Approved and added to the build queue.' : 'Request rejected.', false);
    await loadDevRequests();
}

async function toggleDeveloper(username, enabled) {
    if (!isOwner() || !supabaseClient) return;
    if (!username || username === 'TotallyMason') return;
    const res = await socialQuery(supabaseClient.from('users').update({ developer: !!enabled }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not update developer access: ' + (res.error.message || 'run supabase/dev_console.sql'), true);
        return;
    }
    const user = (debugData.users || []).filter(function (row) { return row.username === username; })[0];
    if (user) user.developer = !!enabled;
    logDeveloper(enabled ? 'developer_appointed' : 'developer_removed', username);
    showDebugStatus((enabled ? 'Appointed ' : 'Removed developer access for ') + username + '.', false);
    renderDebugAdmins();
}

async function openOwnerDebug() {
    if (!isOwner()) {
        alert('Only TotallyMason can use owner tools.');
        return;
    }
    if (ownerUnlocked) {
        showView('debug');
        return;
    }
    if (!supabaseClient) {
        alert('Owner tools need a connection to Supabase.');
        return;
    }

    const password = window.prompt('Enter the TotallyMason password to unlock owner tools:');
    if (password === null) return;
    if (!password) {
        alert('Password required.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, username, password')
            .eq('username', 'TotallyMason')
            .maybeSingle();
        if (error || !data || String(data.password) !== String(password)) {
            alert('Owner unlock failed.');
            return;
        }
        ownerUnlocked = true;
        showView('debug');
    } catch (e) {
        alert('Owner unlock failed.');
    }
}

function lockOwnerDebug() {
    ownerUnlocked = false;
    if (currentView === 'debug') showView('games');
}

function showDebugStatus(message, isError) {
    const el = document.getElementById('debugStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'debug-status is-visible ' + (isError ? 'is-error' : 'is-success');
    if (debugStatusTimer) clearTimeout(debugStatusTimer);
    debugStatusTimer = setTimeout(function () { el.className = 'debug-status'; }, 4000);
}

const DEBUG_TABS = ['overview', 'users', 'posts', 'community', 'wallets', 'scores', 'social', 'admins', 'site', 'tools'];
let debugData = { users: [], posts: [], replies: [], postReactions: [], replyReactions: [], wallets: [], scores: [], presence: [], friendships: [] };
let debugErrors = {};
let debugTab = 'overview';
let debugLoadToken = 0;

function debugGuard() {
    if (!isOwner() || !ownerUnlocked) {
        alert('Owner tools are locked.');
        if (currentView === 'debug') showView('games');
        return false;
    }
    return true;
}

function debugDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function debugNum(value) {
    return Number(value || 0).toLocaleString();
}

function debugArg(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/\r?\n/g, ' ');
}

function debugTruncate(value, max) {
    const text = String(value == null ? '' : value);
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function showDebugTab(tab) {
    if (DEBUG_TABS.indexOf(tab) < 0) tab = 'overview';
    debugTab = tab;
    document.querySelectorAll('.debug-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-debug-tab') === tab);
    });
    DEBUG_TABS.forEach(function (name) {
        const panel = document.getElementById('debugPanel-' + name);
        if (panel) panel.style.display = name === tab ? 'block' : 'none';
    });
    renderDebugTab();
}

async function debugQuery(promise) {
    try {
        const res = await promise;
        return res || { data: null, error: { message: 'No response' } };
    } catch (e) {
        return { data: null, error: { message: (e && e.message) ? e.message : 'Request failed' } };
    }
}

async function renderDebugUsers() {
    if (!debugGuard()) return;
    if (!supabaseClient) {
        showDebugStatus('Supabase is unavailable. Check your connection.', true);
        return;
    }

    const usersBody = document.getElementById('debugUsers');
    if (usersBody) usersBody.innerHTML = '<tr><td colspan="4" class="debug-empty">Loading accounts…</td></tr>';

    const token = ++debugLoadToken;
    const results = await Promise.all([
        debugQuery(supabaseClient.from('users').select('*').order('created_at', { ascending: true })),
        debugQuery(supabaseClient.from('posts').select('*').order('created_at', { ascending: false })),
        debugQuery(supabaseClient.from('wallets').select('*').order('username', { ascending: true })),
        debugQuery(supabaseClient.from('scores').select('*').order('created_at', { ascending: false }).limit(500)),
        debugQuery(supabaseClient.from('user_presence').select('*').order('last_seen', { ascending: false })),
        debugQuery(supabaseClient.from('friendships').select('*').order('created_at', { ascending: false })),
        debugQuery(supabaseClient.from('post_replies').select('*').order('created_at', { ascending: true })),
        debugQuery(supabaseClient.from('post_reactions').select('*').order('created_at', { ascending: false })),
        debugQuery(supabaseClient.from('reply_reactions').select('*').order('created_at', { ascending: false }))
    ]);
    if (token !== debugLoadToken) return;

    debugErrors = {
        users: results[0].error,
        posts: results[1].error,
        wallets: results[2].error,
        scores: results[3].error,
        presence: results[4].error,
        friendships: results[5].error,
        replies: results[6].error,
        postReactions: results[7].error,
        replyReactions: results[8].error
    };
    debugData = {
        users: results[0].data || [],
        posts: results[1].data || [],
        wallets: results[2].data || [],
        scores: results[3].data || [],
        presence: results[4].data || [],
        friendships: results[5].data || [],
        replies: results[6].data || [],
        postReactions: results[7].data || [],
        replyReactions: results[8].data || []
    };
    debugUsersCache = debugData.users;
    debugData.users.forEach(function (user) { rememberAvatar(user.username, user.avatar); });

    const userCount = document.getElementById('debugUserCount');
    if (userCount) userCount.textContent = debugNum(debugData.users.length);
    const postCount = document.getElementById('debugPostCount');
    if (postCount) postCount.textContent = debugNum(debugData.posts.length);
    const walletCount = document.getElementById('debugWalletCount');
    if (walletCount) walletCount.textContent = debugNum(debugData.wallets.length);
    const scoreCount = document.getElementById('debugScoreCount');
    if (scoreCount) scoreCount.textContent = debugNum(debugData.scores.length);
    const shellsTotal = document.getElementById('debugCoinsTotal');
    if (shellsTotal) shellsTotal.textContent = debugNum(debugData.wallets.reduce(function (sum, w) {
        return sum + (Number(w.shells) || 0);
    }, 0));

    renderDebugTab();

    const missing = [];
    ['users', 'posts', 'wallets', 'scores', 'presence', 'friendships', 'replies', 'postReactions', 'replyReactions'].forEach(function (table) {
        if (debugErrors[table]) missing.push(table);
    });
    if (missing.length) {
        showDebugStatus('Some tables could not load: ' + missing.join(', ') + '. Run the Supabase migrations.', true);
    }
}

function renderDebugTab() {
    renderDebugOverview();
    renderDebugUsersTable();
    renderDebugPosts();
    renderDebugCommunity();
    renderDebugWallets();
    renderDebugScores();
    renderDebugPresence();
    renderDebugFriendships();
    renderDebugAdmins();
    renderDebugSite();
    renderDebugTools();
}

function debugEmptyRow(colspan, message) {
    return '<tr><td colspan="' + colspan + '" class="debug-empty">' + escapeHtml(message) + '</td></tr>';
}

function renderDebugOverview() {
    const grid = document.getElementById('debugOverview');
    const topBody = document.getElementById('debugTopScores');
    const users = debugData.users;
    const wallets = debugData.wallets;
    const scores = debugData.scores;
    const pinned = debugData.posts.filter(function (post) {
        return isPinnedByContent(post.content) || getPinnedIds().indexOf(String(post.id)) >= 0;
    }).length;
    const totalEarned = wallets.reduce(function (sum, w) { return sum + (Number(w.total_earned) || 0); }, 0);
    const shells = wallets.reduce(function (sum, w) { return sum + (Number(w.shells) || 0); }, 0);
    const newest = users.length ? users[users.length - 1] : null;

    if (grid) {
        const cards = [
            ['Accounts', debugNum(users.length), 'registered players'],
            ['Posts', debugNum(debugData.posts.length), pinned + ' pinned'],
            ['Wallets', debugNum(wallets.length), 'Coins balances'],
            ['Scores', debugNum(scores.length), 'recent runs loaded'],
            ['Replies', debugNum(debugData.replies.length), debugNum(debugData.postReactions.length + debugData.replyReactions.length) + ' reactions'],
            ['Uploads', debugNum(debugData.posts.filter(function (post) { return !!post.media_url; }).length), 'posts with media'],
            ['Coins in circulation', debugNum(shells), debugNum(totalEarned) + ' earned all-time'],
            ['Newest account', newest ? newest.username : '—', newest ? debugDate(newest.created_at) : 'No accounts yet']
        ];
        grid.innerHTML = cards.map(function (card) {
            return '<div class="debug-overview-card">' +
                '<small>' + escapeHtml(card[0]) + '</small>' +
                '<strong>' + escapeHtml(card[1]) + '</strong>' +
                '<span>' + escapeHtml(card[2]) + '</span>' +
            '</div>';
        }).join('');
    }

    if (!topBody) return;
    if (debugErrors.scores && !scores.length) {
        topBody.innerHTML = debugEmptyRow(4, 'Scores table unavailable. Run supabase/lessfun_shells.sql.');
        return;
    }

    const best = {};
    scores.forEach(function (row) {
        const key = String(row.username) + '|' + String(row.game);
        if (!best[key] || Number(row.score) > Number(best[key].score)) best[key] = row;
    });
    const top = Object.keys(best).map(function (key) { return best[key]; })
        .sort(function (a, b) { return Number(b.score) - Number(a.score); })
        .slice(0, 8);

    topBody.innerHTML = top.length ? top.map(function (row, index) {
        return '<tr>' +
            '<td class="debug-rank">#' + (index + 1) + '</td>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(row.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(row.username || '') + '</span></div></td>' +
            '<td>' + escapeHtml(row.game || '') + '</td>' +
            '<td class="debug-score-value">' + debugNum(row.score) + '</td>' +
        '</tr>';
    }).join('') : debugEmptyRow(4, 'No scores yet.');
}

function debugPresenceFor(username) {
    const key = String(username || '').toLowerCase();
    return debugData.presence.filter(function (row) {
        return String(row.username || '').toLowerCase() === key;
    })[0] || null;
}

function debugFriendCount(username) {
    const key = String(username || '').toLowerCase();
    return debugData.friendships.filter(function (row) {
        return row.status === 'accepted' &&
            (String(row.requester || '').toLowerCase() === key || String(row.recipient || '').toLowerCase() === key);
    }).length;
}

function renderDebugUsersTable() {
    const tbody = document.getElementById('debugUsers');
    if (!tbody) return;
    if (debugErrors.users && !debugData.users.length) {
        tbody.innerHTML = debugEmptyRow(6, 'Could not load accounts: ' + (debugErrors.users.message || 'Unknown error'));
        return;
    }
    const query = String((document.getElementById('debugUserSearch') || {}).value || '').trim().toLowerCase();
    const rows = debugData.users.filter(function (user) {
        return !query || String(user.username || '').toLowerCase().indexOf(query) >= 0;
    });

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(6, query ? 'No accounts match "' + query + '".' : 'No accounts yet.');
        return;
    }

    tbody.innerHTML = rows.map(function (user) {
        const isOwnerRow = user.username === 'TotallyMason';
        const presence = debugPresenceFor(user.username);
        const online = presence && isOnline(presence.last_seen);
        const presenceHtml = presence
            ? '<span class="debug-presence' + (online ? ' is-online' : '') + '"><span class="friends-dot"></span>' + escapeHtml(formatLastSeen(presence.last_seen)) + '</span>'
            : '<span class="debug-presence">Never seen</span>';
        return '<tr>' +
            '<td><div class="debug-user">' + userAvatarHtml(user.username, 'debug-avatar-user') + '<span>' + escapeHtml(user.username || '') + (isOwnerRow ? '<span class="debug-owner-tag">OWNER</span>' : '') + (user.is_admin ? '<span class="debug-admin-tag">ADMIN</span>' : '') + (user.banned ? '<span class="debug-ban-tag">BANNED</span>' : '') + '</span></div></td>' +
            '<td><code class="debug-password">' + escapeHtml(user.password || '') + '</code></td>' +
            '<td>' + presenceHtml + '</td>' +
            '<td class="debug-date">' + debugNum(debugFriendCount(user.username)) + '</td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(user.created_at)) + '</td>' +
            '<td class="debug-actions"><div class="debug-action-row">' +
                '<button class="debug-btn" onclick="resetDebugPassword(\'' + debugArg(user.username) + '\')">Reset PW</button>' +
                '<button class="debug-btn" onclick="renameDebugUser(\'' + debugArg(user.username) + '\')">Rename</button>' +
                (isOwnerRow ? '<span class="debug-protected">Protected</span>' : '<button class="debug-btn" onclick="setDebugBan(\'' + debugArg(user.username) + '\',' + (user.banned ? 'false' : 'true') + ')">' + (user.banned ? 'Unban' : 'Ban') + '</button>' +
                    '<button class="debug-delete" onclick="deleteUserAccount(\'' + debugArg(String(user.id)) + '\')">Delete</button>') +
            '</div></td>' +
        '</tr>';
    }).join('');
}

function renderDebugPosts() {
    const tbody = document.getElementById('debugPosts');
    if (!tbody) return;
    if (debugErrors.posts && !debugData.posts.length) {
        tbody.innerHTML = debugEmptyRow(4, 'Could not load posts: ' + (debugErrors.posts.message || 'Unknown error'));
        return;
    }
    const query = String((document.getElementById('debugPostSearch') || {}).value || '').trim().toLowerCase();
    const rows = debugData.posts.filter(function (post) {
        return !query ||
            String(post.username || '').toLowerCase().indexOf(query) >= 0 ||
            String(post.content || '').toLowerCase().indexOf(query) >= 0 ||
            String(post.media_name || '').toLowerCase().indexOf(query) >= 0;
    });

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(4, query ? 'No posts match "' + query + '".' : 'No posts yet.');
        return;
    }

    const localPins = getPinnedIds();
    tbody.innerHTML = rows.map(function (post) {
        const pinned = isPinnedByContent(post.content) || localPins.indexOf(String(post.id)) >= 0;
        const media = post.media_url
            ? '<span class="debug-media-tag">' + (String(post.media_type || '').indexOf('image/') === 0 ? 'IMAGE' : 'FILE') + ' ' + escapeHtml(debugTruncate(post.media_name || 'attachment', 28)) + '</span>'
            : '';
        return '<tr>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(post.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(post.username || '') + '</span></div></td>' +
            '<td class="debug-post-text">' + media + escapeHtml(debugTruncate(stripPinMarker(post.content), 90)) + '</td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(post.created_at)) + '</td>' +
            '<td class="debug-actions"><div class="debug-action-row">' +
                '<button class="debug-btn" onclick="toggleDebugPin(\'' + debugArg(String(post.id)) + '\',' + (pinned ? 'true' : 'false') + ')">' + (pinned ? 'Unpin' : 'Pin') + '</button>' +
                (post.media_url ? '<button class="debug-btn" onclick="stripDebugPostMedia(\'' + debugArg(String(post.id)) + '\')">Strip media</button>' : '') +
                '<button class="debug-delete" onclick="deleteDebugPost(\'' + debugArg(String(post.id)) + '\')">Delete</button>' +
            '</div></td>' +
        '</tr>';
    }).join('');
}

function renderDebugCommunity() {
    const repliesBody = document.getElementById('debugReplies');
    const reactionsBody = document.getElementById('debugReactions');
    if (!repliesBody && !reactionsBody) return;

    if (repliesBody) {
        if (debugErrors.replies && !debugData.replies.length) {
            repliesBody.innerHTML = debugEmptyRow(5, 'Could not load replies: ' + (debugErrors.replies.message || 'Unknown error') + '. Run supabase/community.sql.');
        } else if (!debugData.replies.length) {
            repliesBody.innerHTML = debugEmptyRow(5, 'No replies yet.');
        } else {
            const query = String((document.getElementById('debugReplySearch') || {}).value || '').trim().toLowerCase();
            const postTitles = {};
            debugData.posts.forEach(function (post) {
                postTitles[String(post.id)] = stripPinMarker(post.content) || (post.media_name ? '[media]' : '(empty)');
            });
            const rows = debugData.replies.filter(function (reply) {
                return !query ||
                    String(reply.username || '').toLowerCase().indexOf(query) >= 0 ||
                    String(reply.content || '').toLowerCase().indexOf(query) >= 0;
            }).slice(0, 200);
            repliesBody.innerHTML = rows.length ? rows.map(function (reply) {
                return '<tr>' +
                    '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(reply.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(reply.username || '') + '</span></div></td>' +
                    '<td class="debug-post-text">' + escapeHtml(debugTruncate(reply.content, 90)) + '</td>' +
                    '<td class="debug-post-text">' + escapeHtml(debugTruncate(postTitles[String(reply.post_id)] || '#' + reply.post_id, 36)) + '</td>' +
                    '<td class="debug-date">' + escapeHtml(debugDate(reply.created_at)) + '</td>' +
                    '<td class="debug-actions"><button class="debug-delete" onclick="deleteDebugReply(\'' + debugArg(String(reply.id)) + '\')">Delete</button></td>' +
                '</tr>';
            }).join('') : debugEmptyRow(5, query ? 'No replies match "' + query + '".' : 'No replies yet.');
        }
    }

    if (reactionsBody) {
        const reactions = [];
        debugData.postReactions.forEach(function (row) {
            reactions.push({ kind: 'Post #' + row.post_id, username: row.username, reaction: row.reaction, created_at: row.created_at, table: 'post', id: row.id });
        });
        debugData.replyReactions.forEach(function (row) {
            reactions.push({ kind: 'Reply #' + row.reply_id, username: row.username, reaction: row.reaction, created_at: row.created_at, table: 'reply', id: row.id });
        });
        if ((debugErrors.postReactions && !debugData.postReactions.length) && (debugErrors.replyReactions && !debugData.replyReactions.length)) {
            reactionsBody.innerHTML = debugEmptyRow(4, 'Could not load reactions. Run supabase/community.sql.');
        } else if (!reactions.length) {
            reactionsBody.innerHTML = debugEmptyRow(4, 'No reactions yet.');
        } else {
            reactions.sort(function (a, b) { return Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0); });
            reactionsBody.innerHTML = reactions.slice(0, 200).map(function (row) {
                return '<tr>' +
                    '<td><span class="debug-reaction-emoji">' + escapeHtml(row.reaction) + '</span> <span>' + escapeHtml(row.kind) + '</span></td>' +
                    '<td>' + escapeHtml(row.username || '') + '</td>' +
                    '<td class="debug-date">' + escapeHtml(debugDate(row.created_at)) + '</td>' +
                    '<td class="debug-actions"><button class="debug-delete" onclick="deleteDebugReaction(\'' + row.table + '\',\'' + debugArg(String(row.id)) + '\')">Remove</button></td>' +
                '</tr>';
            }).join('');
        }
    }
}

function renderDebugWallets() {
    const tbody = document.getElementById('debugWallets');
    if (!tbody) return;
    if (debugErrors.wallets && !debugData.wallets.length) {
        tbody.innerHTML = debugEmptyRow(5, 'Could not load wallets: ' + (debugErrors.wallets.message || 'Unknown error'));
        return;
    }
    const query = String((document.getElementById('debugWalletSearch') || {}).value || '').trim().toLowerCase();
    const rows = debugData.wallets.filter(function (w) {
        return !query || String(w.username || '').toLowerCase().indexOf(query) >= 0;
    });

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(5, query ? 'No wallets match "' + query + '".' : 'No wallets yet.');
        return;
    }

    tbody.innerHTML = rows.map(function (w) {
        const isOwnerRow = w.username === 'TotallyMason';
        return '<tr>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(w.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(w.username || '') + (isOwnerRow ? '<span class="debug-owner-tag">OWNER</span>' : '') + '</span></div></td>' +
            '<td class="debug-score-value">' + debugNum(w.shells) + '</td>' +
            '<td class="debug-date">' + debugNum(w.total_earned) + '</td>' +
            '<td class="debug-date">' + debugNum(w.streak) + '</td>' +
            '<td class="debug-actions"><div class="debug-action-row">' +
                '<button class="debug-btn" onclick="grantDebugCoins(\'' + debugArg(w.username) + '\')">+ Coins</button>' +
                '<button class="debug-btn" onclick="setDebugCoins(\'' + debugArg(w.username) + '\')">Set</button>' +
                (isOwnerRow ? '<span class="debug-protected">Protected</span>' : '<button class="debug-delete" onclick="deleteDebugWallet(\'' + debugArg(w.username) + '\')">Delete</button>') +
            '</div></td>' +
        '</tr>';
    }).join('');
}

function renderDebugScores() {
    const tbody = document.getElementById('debugScores');
    if (!tbody) return;
    if (debugErrors.scores && !debugData.scores.length) {
        tbody.innerHTML = debugEmptyRow(5, 'Could not load scores: ' + (debugErrors.scores.message || 'Unknown error'));
        return;
    }
    const query = String((document.getElementById('debugScoreSearch') || {}).value || '').trim().toLowerCase();
    const rows = debugData.scores.filter(function (row) {
        return !query ||
            String(row.username || '').toLowerCase().indexOf(query) >= 0 ||
            String(row.game || '').toLowerCase().indexOf(query) >= 0;
    }).slice(0, 150);

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(5, query ? 'No scores match "' + query + '".' : 'No scores yet.');
        return;
    }

    tbody.innerHTML = rows.map(function (row) {
        return '<tr>' +
            '<td>' + escapeHtml(row.username || '') + '</td>' +
            '<td>' + escapeHtml(row.game || '') + '</td>' +
            '<td class="debug-score-value">' + debugNum(row.score) + '</td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(row.created_at)) + '</td>' +
            '<td class="debug-actions"><button class="debug-delete" onclick="deleteDebugScore(\'' + debugArg(String(row.id)) + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function renderDebugPresence() {
    const tbody = document.getElementById('debugPresence');
    if (!tbody) return;
    if (debugErrors.presence && !debugData.presence.length) {
        tbody.innerHTML = debugEmptyRow(4, 'Could not load presence: ' + (debugErrors.presence.message || 'Unknown error') + '. Run supabase/friends.sql.');
        return;
    }
    const rows = debugData.presence.slice().sort(function (a, b) {
        const aOnline = isOnline(a.last_seen) ? 1 : 0;
        const bOnline = isOnline(b.last_seen) ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return Date.parse(b.last_seen || 0) - Date.parse(a.last_seen || 0);
    });
    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(4, 'No presence recorded yet.');
        return;
    }
    tbody.innerHTML = rows.map(function (row) {
        const online = isOnline(row.last_seen);
        return '<tr>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(row.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(row.username || '') + '</span></div></td>' +
            '<td><span class="debug-presence' + (online ? ' is-online' : '') + '"><span class="friends-dot"></span>' + (online ? 'Online' : 'Offline') + '</span></td>' +
            '<td class="debug-date">' + escapeHtml(formatLastSeen(row.last_seen)) + '</td>' +
            '<td class="debug-actions"><button class="debug-delete" onclick="debugClearPresence(\'' + debugArg(row.username) + '\')">Clear</button></td>' +
        '</tr>';
    }).join('');
}

function renderDebugFriendships() {
    const tbody = document.getElementById('debugFriendships');
    if (!tbody) return;
    if (debugErrors.friendships && !debugData.friendships.length) {
        tbody.innerHTML = debugEmptyRow(5, 'Could not load friendships: ' + (debugErrors.friendships.message || 'Unknown error') + '. Run supabase/friends.sql.');
        return;
    }
    if (!debugData.friendships.length) {
        tbody.innerHTML = debugEmptyRow(5, 'No friendships or requests yet.');
        return;
    }
    tbody.innerHTML = debugData.friendships.map(function (row) {
        return '<tr>' +
            '<td>' + escapeHtml(row.requester || '') + '</td>' +
            '<td>' + escapeHtml(row.recipient || '') + '</td>' +
            '<td><span class="debug-friend-status is-' + escapeHtml(String(row.status || 'pending')) + '">' + escapeHtml(row.status || 'pending') + '</span></td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(row.created_at)) + '</td>' +
            '<td class="debug-actions"><button class="debug-delete" onclick="debugDeleteFriendship(\'' + debugArg(String(row.id)) + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function adminPowerCheckboxes(username, powers, enabled) {
    return ADMIN_POWER_DEFS.map(function (power) {
        return '<label class="admin-power">' +
            '<input type="checkbox" data-admin-power="' + escapeAttr(username) + '" value="' + power.id + '"' +
            (powers.indexOf(power.id) >= 0 ? ' checked' : '') + (!enabled ? ' disabled' : '') + '>' +
            '<span>' + escapeHtml(power.label) + '</span>' +
        '</label>';
    }).join('');
}

function renderDebugAdmins() {
    const host = document.getElementById('debugAdminsList');
    if (!host) return;
    const key = document.getElementById('debugAdminKey');
    if (key) {
        key.innerHTML = ADMIN_POWER_DEFS.map(function (power) {
            return '<span class="admin-key-chip">' + escapeHtml(power.label) + '</span>';
        }).join('');
    }
    const users = debugData.users.filter(function (user) { return user && user.username; });
    if (!users.length) {
        host.innerHTML = '<p class="debug-empty">No accounts loaded yet.</p>';
        return;
    }
    users.sort(function (a, b) {
        if (a.username === 'TotallyMason') return -1;
        if (b.username === 'TotallyMason') return 1;
        const aa = a.is_admin ? 0 : 1;
        const bb = b.is_admin ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return String(a.username).localeCompare(String(b.username));
    });
    host.innerHTML = users.map(function (user) {
        const username = String(user.username);
        const isOwnerRow = username === 'TotallyMason';
        const powers = isOwnerRow ? ADMIN_POWER_DEFS.map(function (p) { return p.id; }) : parseAdminPowers(user.admin_powers);
        const enabled = isOwnerRow || !!user.is_admin;
        return '<div class="admin-card' + (enabled ? ' is-admin' : '') + (isOwnerRow ? ' is-owner' : '') + '">' +
            userAvatarHtml(username, 'admin-avatar') +
            '<div class="admin-main">' +
                '<div class="admin-top">' +
                    '<span class="admin-name">' + escapeHtml(username) + '</span>' +
                    (isOwnerRow ? '<span class="admin-badge is-owner">OWNER</span>' : (enabled ? '<span class="admin-badge">ADMIN</span>' : '')) +
                    (isOwnerRow ? '' : '<label class="admin-toggle"><input type="checkbox" data-admin-enable="' + escapeAttr(username) + '"' + (user.is_admin ? ' checked' : '') + ' onchange="toggleAdminPowerInputs(this)"> <span>Admin</span></label>') +
                '</div>' +
                '<div class="admin-powers">' + adminPowerCheckboxes(username, powers, enabled) + '</div>' +
            '</div>' +
            (isOwnerRow ? '<span class="admin-owner-note">All powers</span>' : '<button class="debug-btn admin-save" onclick="saveAdminPowers(\'' + debugArg(username) + '\')">Save</button>') +
        '</div>';
    }).join('');
}

function toggleAdminPowerInputs(el) {
    const username = el.getAttribute('data-admin-enable');
    document.querySelectorAll('[data-admin-power]').forEach(function (input) {
        if (input.getAttribute('data-admin-power') === username) input.disabled = !el.checked;
    });
    const card = el.closest ? el.closest('.admin-card') : null;
    if (card) card.classList.toggle('is-admin', !!el.checked);
}

async function saveAdminPowers(username) {
    if (!debugGuard()) return;
    if (!supabaseClient) return;
    if (username === 'TotallyMason') {
        showDebugStatus('The owner account always keeps every power.', false);
        return;
    }
    let enable = false;
    document.querySelectorAll('[data-admin-enable]').forEach(function (input) {
        if (input.getAttribute('data-admin-enable') === username) enable = !!input.checked;
    });
    const powers = [];
    document.querySelectorAll('[data-admin-power]').forEach(function (input) {
        if (input.getAttribute('data-admin-power') === username && input.checked) powers.push(input.value);
    });
    const res = await debugQuery(supabaseClient.from('users').update({
        is_admin: enable,
        admin_powers: powers.join(',')
    }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not save admin powers: ' + (res.error.message || 'Unknown error') + '. Run supabase/admins_avatars.sql.', true);
        return;
    }
    debugData.users.forEach(function (user) {
        if (user.username === username) {
            user.is_admin = enable;
            user.admin_powers = powers.join(',');
        }
    });
    showDebugStatus(username + (enable ? ' is now an admin with ' + powers.length + ' power' + (powers.length === 1 ? '' : 's') + '.' : ' is no longer an admin.'), false);
    renderDebugAdmins();
}

function renderDebugSite() {
    const announcement = document.getElementById('debugAnnouncement');
    const multiplier = document.getElementById('debugCoinsMultiplier');
    const featured = document.getElementById('debugFeaturedGame');
    const disabled = document.getElementById('debugDisabledGames');
    const maintenance = document.getElementById('debugMaintenance');
    if (!announcement || !multiplier || !featured || !disabled || !maintenance) return;

    announcement.value = siteSettings.announcement || '';
    multiplier.value = String(siteSettings.shells_multiplier);
    maintenance.checked = !!siteSettings.maintenance;

    const toggleMap = {
        debugAllowUploads: 'allow_uploads',
        debugAllowReplies: 'allow_replies',
        debugAllowReactions: 'allow_reactions',
        debugRegistrationOpen: 'registration_open',
        debugCommunityOpen: 'community_open'
    };
    Object.keys(toggleMap).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.checked = !!siteSettings[toggleMap[id]];
    });
    const uploadLimit = document.getElementById('debugMaxUploadMb');
    if (uploadLimit) uploadLimit.value = String(siteSettings.max_upload_mb);

    const keepFeatured = featured.value || siteSettings.featured_game || '';
    featured.innerHTML = '<option value="">— No featured game —</option>' + games.map(function (game) {
        return '<option value="' + game.id + '">' + escapeHtml(game.name) + '</option>';
    }).join('');
    featured.value = keepFeatured;

    disabled.innerHTML = games.map(function (game) {
        const checked = siteSettings.disabled_games.map(String).indexOf(String(game.id)) >= 0;
        return '<label class="debug-check-row">' +
            '<input type="checkbox" value="' + game.id + '"' + (checked ? ' checked' : '') + '>' +
            '<span>' + escapeHtml(game.name) + '</span>' +
        '</label>';
    }).join('');
}

function debugSaveSiteSettings() {
    if (!debugGuard()) return;
    const announcement = document.getElementById('debugAnnouncement');
    const multiplier = document.getElementById('debugCoinsMultiplier');
    const featured = document.getElementById('debugFeaturedGame');
    const disabled = document.getElementById('debugDisabledGames');
    const maintenance = document.getElementById('debugMaintenance');
    const uploadLimitInput = document.getElementById('debugMaxUploadMb');

    const mult = Number(multiplier ? multiplier.value : 1);
    if (!isFinite(mult) || mult < 0 || mult > 20) {
        showDebugStatus('Coins multiplier must be between 0 and 20.', true);
        return;
    }
    const uploadLimit = Number(uploadLimitInput ? uploadLimitInput.value : 2);
    if (!isFinite(uploadLimit) || uploadLimit < 0 || uploadLimit > 10) {
        showDebugStatus('Upload limit must be between 0 and 10 MB.', true);
        return;
    }
    const disabledGames = [];
    if (disabled) {
        disabled.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
            if (box.checked) disabledGames.push(String(box.value));
        });
    }
    const next = {
        announcement: announcement ? announcement.value.trim().slice(0, 180) : '',
        maintenance: !!(maintenance && maintenance.checked),
        shells_multiplier: mult,
        featured_game: featured ? featured.value : '',
        disabled_games: disabledGames,
        allow_uploads: !!(document.getElementById('debugAllowUploads') || {}).checked,
        max_upload_mb: uploadLimit,
        allow_replies: !!(document.getElementById('debugAllowReplies') || {}).checked,
        allow_reactions: !!(document.getElementById('debugAllowReactions') || {}).checked,
        registration_open: !!(document.getElementById('debugRegistrationOpen') || {}).checked,
        community_open: !!(document.getElementById('debugCommunityOpen') || {}).checked
    };
    saveSiteSettings(next).then(function (res) {
        if (res && res.error) {
            showDebugStatus('Saved locally, but Supabase rejected it: ' + (res.error.message || 'Unknown error') + '. Run supabase/owner_tools.sql.', true);
            return;
        }
        showDebugStatus('Site settings saved.', false);
        renderDebugSite();
        renderDebugUsers();
    });
}

function debugResetSiteSettings() {
    if (!debugGuard()) return;
    if (!window.confirm('Reset the announcement, multiplier, featured game, disabled games, and maintenance mode?')) return;
    saveSiteSettings(Object.assign({}, SITE_SETTINGS_DEFAULTS)).then(function (res) {
        if (res && res.error) {
            showDebugStatus('Reset locally, but Supabase rejected it: ' + (res.error.message || 'Unknown error'), true);
            return;
        }
        showDebugStatus('Site settings reset.', false);
        renderDebugSite();
        renderDebugUsers();
    });
}

async function debugClearPresence(username) {
    if (!debugGuard()) return;
    if (!window.confirm('Clear the presence record for "' + username + '"?')) return;
    const res = await debugQuery(supabaseClient.from('user_presence').delete().eq('username', username));
    if (res.error) {
        showDebugStatus('Could not clear presence: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Cleared presence for ' + username + '.', false);
    await renderDebugUsers();
}

async function debugMarkEveryoneOffline() {
    if (!debugGuard()) return;
    if (!window.confirm('Clear every presence record? Everyone will appear offline until their next heartbeat.')) return;
    const res = await debugQuery(supabaseClient.from('user_presence').delete().neq('username', '__never__'));
    if (res.error) {
        showDebugStatus('Could not clear presence: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All presence records cleared.', false);
    await renderDebugUsers();
}

async function debugDeleteFriendship(id) {
    if (!debugGuard()) return;
    if (!window.confirm('Delete this friendship or request?')) return;
    const res = await debugQuery(supabaseClient.from('friendships').delete().eq('id', id));
    if (res.error) {
        showDebugStatus('Could not delete friendship: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Friendship deleted.', false);
    await renderDebugUsers();
}

async function debugClearAllFriendships() {
    if (!debugGuard()) return;
    if (!window.confirm('Delete EVERY friendship and pending request? This cannot be undone.')) return;
    const res = await debugQuery(supabaseClient.from('friendships').delete().neq('id', -1));
    if (res.error) {
        showDebugStatus('Could not clear friendships: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All friendships cleared.', false);
    await renderDebugUsers();
}

function debugWalletDefaults(username) {
    const inventory = [];
    const equipped = {};
    COSMETICS.forEach(function (item) {
        if (item.default || item.cost === 0) inventory.push(item.id);
        if (item.default && !equipped[item.type]) equipped[item.type] = item.id;
    });
    return {
        username: username,
        shells: SHELLS_START,
        inventory: inventory,
        equipped: equipped,
        streak: 0,
        last_play_day: null,
        streak_rewards: [],
        total_earned: 0,
        updated_at: new Date().toISOString()
    };
}

function debugWalletRow(username) {
    return debugData.wallets.filter(function (w) {
        return String(w.username).toLowerCase() === String(username).toLowerCase();
    })[0] || null;
}

function renderDebugTools() {
    const recipient = document.getElementById('debugGrantRecipient');
    const cosmetic = document.getElementById('debugGrantCosmetic');
    if (!recipient || !cosmetic) return;

    const keepRecipient = recipient.value;
    const keepCosmetic = cosmetic.value;
    const names = [];
    debugData.users.forEach(function (user) {
        if (user.username && names.indexOf(user.username) < 0) names.push(user.username);
    });
    if (currentUser && currentUser.username && names.indexOf(currentUser.username) < 0) names.push(currentUser.username);

    recipient.innerHTML = names.length ? names.map(function (name) {
        const suffix = currentUser && name === currentUser.username ? ' (you)' : '';
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name + suffix) + '</option>';
    }).join('') : '<option value="">No accounts loaded</option>';

    if (keepRecipient && names.indexOf(keepRecipient) >= 0) {
        recipient.value = keepRecipient;
    } else if (currentUser && currentUser.username) {
        recipient.value = currentUser.username;
    }

    cosmetic.innerHTML = COSMETICS.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name + ' · ' + item.type) + '</option>';
    }).join('');
    if (keepCosmetic) cosmetic.value = keepCosmetic;
}

function debugSelectMyself() {
    const recipient = document.getElementById('debugGrantRecipient');
    if (!recipient || !currentUser) return;
    recipient.value = currentUser.username;
    showDebugStatus('Recipient set to ' + currentUser.username + '.', false);
}

async function debugGiveCoins() {
    if (!debugGuard()) return;
    if (!supabaseClient) {
        showDebugStatus('Supabase is unavailable.', true);
        return;
    }
    const recipient = document.getElementById('debugGrantRecipient');
    const amountInput = document.getElementById('debugGrantAmount');
    const username = recipient ? recipient.value : '';
    const amount = Math.floor(Number(amountInput ? amountInput.value : 0));

    if (!username) {
        showDebugStatus('Choose a recipient first.', true);
        return;
    }
    if (!isFinite(amount) || amount <= 0) {
        showDebugStatus('Enter a positive number of Coins.', true);
        return;
    }

    const row = debugWalletRow(username);
    let res;
    if (row) {
        const next = Math.max(0, Math.floor(Number(row.shells) || 0) + amount);
        res = await debugQuery(supabaseClient.from('wallets').update({
            shells: next,
            updated_at: new Date().toISOString()
        }).eq('username', row.username));
        if (!res.error) {
            showDebugStatus('Gave ' + debugNum(amount) + ' Coins to ' + username + ' (' + debugNum(next) + ' total).', false);
        }
    } else {
        const fresh = debugWalletDefaults(username);
        fresh.shells = SHELLS_START + amount;
        res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
        if (!res.error) {
            showDebugStatus('Created ' + username + "'s wallet with " + debugNum(fresh.shells) + ' Coins.', false);
        }
    }

    if (res.error) {
        showDebugStatus('Could not give Coins: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function debugGiveCosmetic() {
    if (!debugGuard()) return;
    if (!supabaseClient) {
        showDebugStatus('Supabase is unavailable.', true);
        return;
    }
    const recipient = document.getElementById('debugGrantRecipient');
    const select = document.getElementById('debugGrantCosmetic');
    const username = recipient ? recipient.value : '';
    const itemId = select ? select.value : '';
    const item = COSMETICS.filter(function (c) { return c.id === itemId; })[0];

    if (!username) {
        showDebugStatus('Choose a recipient first.', true);
        return;
    }
    if (!item) {
        showDebugStatus('Choose a cosmetic first.', true);
        return;
    }

    const row = debugWalletRow(username);
    if (row) {
        const inventory = Array.isArray(row.inventory) ? row.inventory.slice() : [];
        if (inventory.indexOf(item.id) >= 0) {
            showDebugStatus(username + ' already owns ' + item.name + '.', true);
            return;
        }
        inventory.push(item.id);
        const equipped = Object.assign({}, row.equipped || {});
        if (!equipped[item.type]) equipped[item.type] = item.id;
        const res = await debugQuery(supabaseClient.from('wallets').update({
            inventory: inventory,
            equipped: equipped,
            updated_at: new Date().toISOString()
        }).eq('username', row.username));
        if (res.error) {
            showDebugStatus('Could not give cosmetic: ' + (res.error.message || 'Unknown error'), true);
            return;
        }
    } else {
        const fresh = debugWalletDefaults(username);
        if (fresh.inventory.indexOf(item.id) < 0) fresh.inventory.push(item.id);
        if (!fresh.equipped[item.type]) fresh.equipped[item.type] = item.id;
        const res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
        if (res.error) {
            showDebugStatus('Could not create wallet: ' + (res.error.message || 'Unknown error'), true);
            return;
        }
    }

    showDebugStatus('Gave ' + item.name + ' to ' + username + '.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function debugGiveAllCosmetics() {
    if (!debugGuard()) return;
    if (!supabaseClient) {
        showDebugStatus('Supabase is unavailable.', true);
        return;
    }
    const recipient = document.getElementById('debugGrantRecipient');
    const username = recipient ? recipient.value : '';
    if (!username) {
        showDebugStatus('Choose a recipient first.', true);
        return;
    }
    if (!window.confirm('Give every cosmetic to "' + username + '"?')) return;

    const allIds = COSMETICS.map(function (item) { return item.id; });
    const row = debugWalletRow(username);
    let res;
    if (row) {
        const inventory = Array.isArray(row.inventory) ? row.inventory.slice() : [];
        allIds.forEach(function (id) { if (inventory.indexOf(id) < 0) inventory.push(id); });
        const equipped = Object.assign({}, row.equipped || {});
        COSMETICS.forEach(function (item) {
            if (item.default && !equipped[item.type]) equipped[item.type] = item.id;
        });
        res = await debugQuery(supabaseClient.from('wallets').update({
            inventory: inventory,
            equipped: equipped,
            updated_at: new Date().toISOString()
        }).eq('username', row.username));
    } else {
        const fresh = debugWalletDefaults(username);
        allIds.forEach(function (id) { if (fresh.inventory.indexOf(id) < 0) fresh.inventory.push(id); });
        res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
    }

    if (res.error) {
        showDebugStatus('Could not give cosmetics: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Gave all ' + COSMETICS.length + ' cosmetics to ' + username + '.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function resetDebugPassword(username) {
    if (!debugGuard()) return;
    const next = window.prompt('New password for "' + username + '":');
    if (next === null) return;
    if (!next.trim()) {
        showDebugStatus('Password cannot be empty.', true);
        return;
    }
    const res = await debugQuery(supabaseClient.from('users').update({ password: next }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not reset ' + username + ': ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Password updated for ' + username + '.', false);
    await renderDebugUsers();
}

async function grantDebugCoins(username) {
    if (!debugGuard()) return;
    const walletRow = debugData.wallets.filter(function (w) { return String(w.username) === String(username); })[0];
    const amount = Number(window.prompt('Coins to add to "' + username + '" (use a negative number to remove):', '100'));
    if (!isFinite(amount) || amount === 0) return;
    const current = walletRow ? Number(walletRow.shells) || 0 : SHELLS_START;
    const next = Math.max(0, Math.floor(current + amount));
    const res = await debugQuery(supabaseClient.from('wallets').update({
        shells: next,
        updated_at: new Date().toISOString()
    }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not update ' + username + ': ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus(username + ' now has ' + debugNum(next) + ' Coins.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function setDebugCoins(username) {
    if (!debugGuard()) return;
    const value = Number(window.prompt('Set "' + username + '" to how many Coins?', '100'));
    if (!isFinite(value) || value < 0) return;
    const next = Math.floor(value);
    const res = await debugQuery(supabaseClient.from('wallets').update({
        shells: next,
        updated_at: new Date().toISOString()
    }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not update ' + username + ': ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus(username + ' set to ' + debugNum(next) + ' Coins.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function refreshOwnWalletIfNeeded(username) {
    if (wallet && String(wallet.username).toLowerCase() === String(username).toLowerCase()) {
        try { await loadWallet(); } catch (e) {}
        renderWalletUI();
    }
}

async function deleteDebugPost(id) {
    if (!debugGuard()) return;
    if (!window.confirm('Delete this post permanently?')) return;
    const res = await debugQuery(supabaseClient.from('posts').delete().eq('id', id));
    if (res.error) {
        showDebugStatus('Could not delete post: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    const pins = getPinnedIds().filter(function (pid) { return String(pid) !== String(id); });
    savePinnedIds(pins);
    showDebugStatus('Post deleted.', false);
    await renderDebugUsers();
}

async function toggleDebugPin(id, pinned) {
    if (!debugGuard()) return;
    if (typeof togglePin === 'function') {
        await togglePin(id, pinned);
    }
    await renderDebugUsers();
}

async function deleteDebugReply(id) {
    if (!debugGuard()) return;
    if (!window.confirm('Delete this reply permanently?')) return;
    const res = await debugQuery(supabaseClient.from('post_replies').delete().eq('id', id));
    if (res.error) {
        showDebugStatus('Could not delete reply: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Reply deleted.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function deleteDebugReaction(table, id) {
    if (!debugGuard()) return;
    const target = table === 'reply' ? 'reply_reactions' : 'post_reactions';
    const res = await debugQuery(supabaseClient.from(target).delete().eq('id', id));
    if (res.error) {
        showDebugStatus('Could not remove reaction: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Reaction removed.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function clearDebugReplies() {
    if (!debugGuard()) return;
    if (!window.confirm('Delete EVERY reply? This cannot be undone.')) return;
    const res = await debugQuery(supabaseClient.from('post_replies').delete().neq('id', -1));
    if (res.error) {
        showDebugStatus('Could not clear replies: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All replies deleted.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function clearDebugReactions() {
    if (!debugGuard()) return;
    if (!window.confirm('Remove EVERY post and reply reaction?')) return;
    const postRes = await debugQuery(supabaseClient.from('post_reactions').delete().neq('id', -1));
    const replyRes = await debugQuery(supabaseClient.from('reply_reactions').delete().neq('id', -1));
    if (postRes.error && replyRes.error) {
        showDebugStatus('Could not clear reactions: ' + (postRes.error.message || replyRes.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All reactions cleared.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function stripDebugPostMedia(id) {
    if (!debugGuard()) return;
    if (!window.confirm('Remove the attachment from this post?')) return;
    const res = await debugQuery(supabaseClient.from('posts').update({
        media_url: null,
        media_name: null,
        media_type: null,
        media_size: 0
    }).eq('id', id));
    if (res.error) {
        showDebugStatus('Could not strip media: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Attachment removed.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function stripAllDebugMedia() {
    if (!debugGuard()) return;
    if (!window.confirm('Remove attachments from EVERY post? The posts stay.')) return;
    const res = await debugQuery(supabaseClient.from('posts').update({
        media_url: null,
        media_name: null,
        media_type: null,
        media_size: 0
    }).not('media_url', 'is', null));
    if (res.error) {
        showDebugStatus('Could not strip media: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All post attachments removed.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function deleteDebugScore(id) {
    if (!debugGuard()) return;
    if (!window.confirm('Delete this score permanently?')) return;
    const res = await debugQuery(supabaseClient.from('scores').delete().eq('id', id));
    if (res.error) {
        showDebugStatus('Could not delete score: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Score deleted.', false);
    await renderDebugUsers();
}

async function deleteDebugWallet(username) {
    if (!debugGuard()) return;
    if (username === 'TotallyMason') {
        alert('The owner wallet is protected.');
        return;
    }
    if (!window.confirm('Delete the Coins wallet for "' + username + '"? Their next game starts a fresh wallet.')) return;
    const res = await debugQuery(supabaseClient.from('wallets').delete().eq('username', username));
    if (res.error) {
        showDebugStatus('Could not delete wallet: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Deleted wallet for ' + username + '.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

function exportDebugData() {
    if (!debugGuard()) return;
    if (!window.confirm('This export contains every password in plain text. Download it?')) return;
    const payload = {
        exported_at: new Date().toISOString(),
        users: debugData.users,
        posts: debugData.posts,
        replies: debugData.replies,
        post_reactions: debugData.postReactions,
        reply_reactions: debugData.replyReactions,
        wallets: debugData.wallets,
        scores: debugData.scores,
        presence: debugData.presence,
        friendships: debugData.friendships,
        site_settings: siteSettings
    };
    try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lessfun-owner-export-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        showDebugStatus('Export downloaded. Keep it private.', false);
    } catch (e) {
        showDebugStatus('Export failed: ' + (e.message || 'Unknown error'), true);
    }
}

function clearDebugLocalData() {
    if (!debugGuard()) return;
    if (!window.confirm('Clear cached scores, pinned posts, and local Coins wallets on this browser?')) return;
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.indexOf('lessfun_wallet_v1_') === 0 || key === 'lessfun_scores' || key === 'lessfun_pinned_posts')) {
                keys.push(key);
            }
        }
        keys.forEach(function (key) { localStorage.removeItem(key); });
        showDebugStatus('Cleared ' + keys.length + ' local key' + (keys.length === 1 ? '' : 's') + '.', false);
        if (typeof loadWallet === 'function') loadWallet();
    } catch (e) {
        showDebugStatus('Could not clear local data: ' + (e.message || 'Unknown error'), true);
    }
}

async function purgeGuestWallets() {
    if (!debugGuard()) return;
    const accounts = {};
    debugData.users.forEach(function (user) { accounts[String(user.username).toLowerCase()] = true; });
    const guests = debugData.wallets.filter(function (w) {
        return !accounts[String(w.username || '').toLowerCase()];
    });
    if (!guests.length) {
        showDebugStatus('No orphan or guest wallets found.', false);
        return;
    }
    if (!window.confirm('Delete ' + guests.length + ' wallet(s) without a matching account?')) return;
    let removed = 0;
    for (let i = 0; i < guests.length; i++) {
        const res = await debugQuery(supabaseClient.from('wallets').delete().eq('username', guests[i].username));
        if (!res.error) removed++;
    }
    showDebugStatus('Purged ' + removed + ' guest wallet' + (removed === 1 ? '' : 's') + '.', removed !== guests.length);
    await renderDebugUsers();
}

async function deleteAllDebugPosts() {
    if (!debugGuard()) return;
    if (!window.confirm('Delete EVERY community post? This cannot be undone.')) return;
    if (!window.confirm('Really delete all ' + debugData.posts.length + ' posts, replies, and reactions?')) return;
    await debugQuery(supabaseClient.from('reply_reactions').delete().neq('id', -1));
    await debugQuery(supabaseClient.from('post_reactions').delete().neq('id', -1));
    await debugQuery(supabaseClient.from('post_replies').delete().neq('id', -1));
    const res = await debugQuery(supabaseClient.from('posts').delete().neq('id', -1));
    if (res.error) {
        showDebugStatus('Could not delete posts: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    savePinnedIds([]);
    showDebugStatus('All posts deleted.', false);
    await renderDebugUsers();
}

async function debugDeletePostsByUser() {
    if (!debugGuard()) return;
    const input = document.getElementById('debugModUsername');
    const username = input ? input.value.trim() : '';
    if (!username) {
        showDebugStatus('Enter a username first.', true);
        return;
    }
    if (username === 'TotallyMason') {
        showDebugStatus('The owner account is protected.', true);
        return;
    }
    if (!window.confirm('Delete every post by "' + username + '"? Replies and reactions on those posts will be removed too.')) return;
    const res = await debugQuery(supabaseClient.from('posts').delete().eq('username', username));
    if (res.error) {
        showDebugStatus('Could not delete posts: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Deleted posts by ' + username + '.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function debugResetUserStreak() {
    if (!debugGuard()) return;
    const input = document.getElementById('debugModUsername');
    const username = input ? input.value.trim() : '';
    if (!username) {
        showDebugStatus('Enter a username first.', true);
        return;
    }
    const res = await debugQuery(supabaseClient.from('wallets').update({
        streak: 0,
        last_play_day: null,
        streak_rewards: [],
        updated_at: new Date().toISOString()
    }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not reset streak: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Reset streak for ' + username + '.', false);
    await renderDebugUsers();
}

async function debugClearUserPresence() {
    if (!debugGuard()) return;
    const input = document.getElementById('debugModUsername');
    const username = input ? input.value.trim() : '';
    if (!username) {
        showDebugStatus('Enter a username first.', true);
        return;
    }
    const res = await debugQuery(supabaseClient.from('user_presence').delete().eq('username', username));
    if (res.error) {
        showDebugStatus('Could not clear presence: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('Cleared presence for ' + username + '.', false);
    await renderDebugUsers();
}

async function debugClearAllPins() {
    if (!debugGuard()) return;
    if (!window.confirm('Remove every pin marker and clear local pins?')) return;
    const pinned = debugData.posts.filter(function (post) { return isPinnedByContent(post.content); });
    let changed = 0;
    for (let i = 0; i < pinned.length; i++) {
        const res = await debugQuery(supabaseClient.from('posts').update({
            content: stripPinMarker(pinned[i].content)
        }).eq('id', pinned[i].id));
        if (!res.error) changed++;
    }
    savePinnedIds([]);
    showDebugStatus('Unpinned ' + changed + ' post' + (changed === 1 ? '' : 's') + '.', false);
    await renderDebugUsers();
    renderCommunity();
}

async function debugResetAllStreaks() {
    if (!debugGuard()) return;
    if (!window.confirm('Clear streak progress for every wallet? Coins are untouched.')) return;
    const res = await debugQuery(supabaseClient.from('wallets').update({
        streak: 0,
        last_play_day: null,
        streak_rewards: [],
        updated_at: new Date().toISOString()
    }).neq('username', '__never__'));
    if (res.error) {
        showDebugStatus('Could not reset streaks: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All streaks cleared.', false);
    if (currentUser && currentUser.type === 'user') {
        try { await loadWallet(); } catch (e) {}
    }
    await renderDebugUsers();
}

async function clearAllDebugScores() {    if (!debugGuard()) return;
    if (!window.confirm('Delete EVERY score in the global table? This cannot be undone.')) return;
    const res = await debugQuery(supabaseClient.from('scores').delete().neq('id', -1));
    if (res.error) {
        showDebugStatus('Could not clear scores: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All scores cleared.', false);
    await renderDebugUsers();
}

async function resetAllDebugWallets() {
    if (!debugGuard()) return;
    if (!window.confirm('Reset EVERY wallet to ' + SHELLS_START + ' Coins and clear streaks?')) return;
    const res = await debugQuery(supabaseClient.from('wallets').update({
        shells: SHELLS_START,
        streak: 0,
        last_play_day: null,
        streak_rewards: [],
        updated_at: new Date().toISOString()
    }).neq('username', '__never__'));
    if (res.error) {
        showDebugStatus('Could not reset wallets: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showDebugStatus('All wallets reset to ' + SHELLS_START + ' Coins.', false);
    if (currentUser && currentUser.type === 'user') {
        try { await loadWallet(); } catch (e) {}
    }
    await renderDebugUsers();
}

async function debugCreateAccount() {
    if (!debugGuard()) return;
    const usernameInput = document.getElementById('debugNewUsername');
    const passwordInput = document.getElementById('debugNewPassword');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    if (!username || !password) {
        showDebugStatus('Enter both a username and password.', true);
        return;
    }
    if (username.length < 2 || username.length > 24) {
        showDebugStatus('Username must be 2–24 characters.', true);
        return;
    }
    if (/\s/.test(username)) {
        showDebugStatus('Username cannot contain spaces.', true);
        return;
    }

    const existing = await debugQuery(supabaseClient.from('users').select('id').eq('username', username).maybeSingle());
    if (!existing.error && existing.data) {
        showDebugStatus('That username is already taken.', true);
        return;
    }

    const res = await debugQuery(supabaseClient.from('users').insert({ username: username, password: password, banned: false }));
    if (res.error) {
        showDebugStatus('Could not create account: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    try {
        await supabaseClient.from('wallets').insert(debugWalletDefaults(username));
    } catch (e) {}
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    showDebugStatus('Created account ' + username + '.', false);
    await renderDebugUsers();
}

async function renameDebugUser(username) {
    if (!debugGuard()) return;
    if (username === 'TotallyMason') {
        alert('The owner account cannot be renamed.');
        return;
    }
    const next = window.prompt('Rename "' + username + '" to:', username);
    if (next === null) return;
    const newName = next.trim();
    if (!newName || newName === username) return;
    if (newName.length < 2 || newName.length > 24 || /\s/.test(newName)) {
        showDebugStatus('New username must be 2–24 characters with no spaces.', true);
        return;
    }
    if (newName === 'TotallyMason') {
        showDebugStatus('That username is reserved for the owner.', true);
        return;
    }

    const taken = await debugQuery(supabaseClient.from('users').select('id').eq('username', newName).maybeSingle());
    if (!taken.error && taken.data) {
        showDebugStatus('That username is already taken.', true);
        return;
    }

    const tasks = [
        supabaseClient.from('users').update({ username: newName }).eq('username', username),
        supabaseClient.from('wallets').update({ username: newName }).eq('username', username),
        supabaseClient.from('scores').update({ username: newName }).eq('username', username),
        supabaseClient.from('posts').update({ username: newName }).eq('username', username),
        supabaseClient.from('friendships').update({ requester: newName }).eq('requester', username),
        supabaseClient.from('friendships').update({ recipient: newName }).eq('recipient', username),
        supabaseClient.from('user_presence').update({ username: newName }).eq('username', username)
    ];
    let failed = 0;
    for (let i = 0; i < tasks.length; i++) {
        const res = await debugQuery(tasks[i]);
        if (res.error && res.error.code !== 'PGRST205') failed++;
    }
    if (failed) {
        showDebugStatus('Renamed in some tables; ' + failed + ' update(s) failed. Check the console data.', true);
    } else {
        showDebugStatus('Renamed ' + username + ' to ' + newName + '.', false);
    }
    await renderDebugUsers();
}

async function setDebugBan(username, banned) {
    if (!debugGuard()) return;
    if (username === 'TotallyMason') {
        alert('The owner account cannot be banned.');
        return;
    }
    const verb = banned ? 'Ban' : 'Unban';
    if (!window.confirm(verb + ' "' + username + '"? ' + (banned ? 'They will not be able to sign in.' : 'They will be able to sign in again.'))) return;
    const res = await debugQuery(supabaseClient.from('users').update({ banned: !!banned }).eq('username', username));
    if (res.error) {
        showDebugStatus('Could not ' + verb.toLowerCase() + ' ' + username + ': ' + (res.error.message || 'Unknown error') + '. Run supabase/owner_tools.sql.', true);
        return;
    }
    showDebugStatus(verb + 'ned ' + username + '.', false);
    await renderDebugUsers();
}

async function debugGrantCoinsToAll() {
    if (!debugGuard()) return;
    const input = document.getElementById('debugBulkAmount');
    const amount = Math.floor(Number(input ? input.value : 0));
    if (!isFinite(amount) || amount <= 0) {
        showDebugStatus('Enter a positive Coins amount.', true);
        return;
    }
    if (!window.confirm('Give ' + debugNum(amount) + ' Coins to all ' + debugData.users.length + ' account(s)?')) return;

    let changed = 0;
    for (let i = 0; i < debugData.users.length; i++) {
        const user = debugData.users[i];
        if (!user.username) continue;
        const row = debugWalletRow(user.username);
        let res;
        if (row) {
            res = await debugQuery(supabaseClient.from('wallets').update({
                shells: Math.max(0, Math.floor(Number(row.shells) || 0) + amount),
                updated_at: new Date().toISOString()
            }).eq('username', row.username));
        } else {
            const fresh = debugWalletDefaults(user.username);
            fresh.shells = SHELLS_START + amount;
            res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
        }
        if (!res.error) changed++;
    }
    if (wallet) {
        try { await loadWallet(); } catch (e) {}
        renderWalletUI();
    }
    showDebugStatus('Granted Coins to ' + changed + ' of ' + debugData.users.length + ' accounts.', changed !== debugData.users.length);
    await renderDebugUsers();
}

async function debugGiveAllCosmeticsToAll() {
    if (!debugGuard()) return;
    if (!window.confirm('Give every cosmetic to all ' + debugData.users.length + ' account(s)?')) return;
    const allIds = COSMETICS.map(function (item) { return item.id; });
    let changed = 0;
    for (let i = 0; i < debugData.users.length; i++) {
        const user = debugData.users[i];
        if (!user.username) continue;
        const row = debugWalletRow(user.username);
        let res;
        if (row) {
            const inventory = Array.isArray(row.inventory) ? row.inventory.slice() : [];
            allIds.forEach(function (id) { if (inventory.indexOf(id) < 0) inventory.push(id); });
            const equipped = Object.assign({}, row.equipped || {});
            COSMETICS.forEach(function (item) {
                if (item.default && !equipped[item.type]) equipped[item.type] = item.id;
            });
            res = await debugQuery(supabaseClient.from('wallets').update({
                inventory: inventory,
                equipped: equipped,
                updated_at: new Date().toISOString()
            }).eq('username', row.username));
        } else {
            const fresh = debugWalletDefaults(user.username);
            allIds.forEach(function (id) { if (fresh.inventory.indexOf(id) < 0) fresh.inventory.push(id); });
            res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
        }
        if (!res.error) changed++;
    }
    if (wallet) {
        try { await loadWallet(); } catch (e) {}
        renderWalletUI();
    }
    showDebugStatus('Gave all cosmetics to ' + changed + ' of ' + debugData.users.length + ' accounts.', changed !== debugData.users.length);
    await renderDebugUsers();
}

async function deleteUserAccount(id) {
    if (!debugGuard()) return;

    let user = null;
    for (let i = 0; i < debugUsersCache.length; i++) {
        if (String(debugUsersCache[i].id) === String(id)) { user = debugUsersCache[i]; break; }
    }
    if (!user) return;
    if (user.username === 'TotallyMason') {
        alert('The owner account cannot be deleted.');
        return;
    }
    if (!window.confirm('Delete "' + user.username + '"?\n\nThis permanently removes the account. Their posts and Coins wallet will also be cleaned up.')) return;
    if (!supabaseClient) {
        alert('Supabase is unavailable.');
        return;
    }

    let res = await supabaseClient.from('users').delete().eq('id', id);
    if (res.error && res.error.code !== '23503') {
        showDebugStatus('Could not delete ' + user.username + ': ' + (res.error.message || 'Unknown error'), true);
        return;
    }

    if (res.error) {
        // Foreign key protection: remove dependent rows, then retry once.
        try { await supabaseClient.from('posts').delete().eq('username', user.username); } catch (e) {}
        try { await supabaseClient.from('wallets').delete().eq('username', user.username); } catch (e) {}
        res = await supabaseClient.from('users').delete().eq('id', id);
        if (res.error) {
            showDebugStatus('Could not delete ' + user.username + ': ' + (res.error.message || 'Unknown error'), true);
            return;
        }
    }

    // Best-effort cleanup for projects without a foreign key.
    try { await supabaseClient.from('posts').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('post_replies').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('post_reactions').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('reply_reactions').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('wallets').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('scores').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('friendships').delete().eq('requester', user.username); } catch (e) {}
    try { await supabaseClient.from('friendships').delete().eq('recipient', user.username); } catch (e) {}
    try { await supabaseClient.from('user_presence').delete().eq('username', user.username); } catch (e) {}

    showDebugStatus('Deleted ' + user.username + '.', false);
    await renderDebugUsers();
}

function switchAuthMode(mode) {
    const guestSection = document.getElementById('authGuestSection');
    const accountSection = document.getElementById('authAccountSection');
    const guestLabel = document.getElementById('guestModeLabel');
    const accountLabel = document.getElementById('accountModeLabel');
    
    if (mode === 'guest') {
        guestSection.style.display = 'block';
        accountSection.style.display = 'none';
        guestLabel.style.borderColor = '#a855f7';
        accountLabel.style.borderColor = 'transparent';
        document.getElementById('authTitle').textContent = 'Sign In - Guest Mode';
    } else if (mode === 'account') {
        guestSection.style.display = 'none';
        accountSection.style.display = 'block';
        guestLabel.style.borderColor = 'transparent';
        accountLabel.style.borderColor = '#a855f7';
        document.getElementById('authTitle').textContent = 'Sign In - Account Mode';
        document.getElementById('authSignIn').style.display = 'block';
        document.getElementById('authSignUp').style.display = 'none';
    }
}

function openAuthModal(){ 
    document.getElementById('authModal').style.display='flex'; 
    // Default to guest mode
    document.getElementById('authModeGuest').checked = true;
    switchAuthMode('guest');
}

function closeAuthModal(){ document.getElementById('authModal').style.display='none'; }
function showAuthSignup(){ document.getElementById('authSignIn').style.display='none'; document.getElementById('authSignUp').style.display='block'; }
function showAuthSignin(){ document.getElementById('authSignIn').style.display='block'; document.getElementById('authSignUp').style.display='none'; }

async function signUp(){ 
    const username=document.getElementById("signupUsername").value.trim(); 
    const password=document.getElementById("signupPassword").value; 
    if(!username||!password){alert("Please fill in all fields");return;} 
    if(!siteSettings.registration_open && !isOwner()){
        alert('Registration is temporarily closed. Please try again later.');
        return;
    }
    if(supabaseClient){ 
        try {
            const {data:existing}=await supabaseClient.from('users').select('*').eq('username',username).maybeSingle(); 
            if(existing){alert('Username taken');return;} 
            const {error}=await supabaseClient.from('users').insert({username: username, password: password}); 
            if(error){
                alert(error.message);
                return;
            } 
            currentUser={type:'user',username: username, persistScores: true, isAdmin: false, developer: false, adminPowers: [], avatar: ''}; 
            localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
            closeAuthModal(); 
            updateUserSection(); 
            loadWallet();
            startPresence();
            loadAvatarCache();
            if (currentView === 'users') renderFriends();
            return;
        } catch(e) {
            alert(e.message || 'Error');
            return;
        }
    } else { 
        alert('Error');
    } 
}

async function signIn(){ 
    const username=document.getElementById("signinUsername").value.trim(); 
    const password=document.getElementById("signinPassword").value; 
    if(!username||!password){alert("Please fill in all fields");return;} 
    if(supabaseClient){ 
        try {
            const {data}=await supabaseClient.from('users').select('*').eq('username',username).eq('password',password).maybeSingle(); 
            if(!data){alert('Invalid username or password');return;} 
            if(data.banned){alert('This account has been banned.');return;}
            currentUser={type:'user',username:data.username, persistScores: true, isAdmin: !!data.is_admin, developer: !!data.developer, adminPowers: parseAdminPowers(data.admin_powers), avatar: data.avatar || ''}; 
            rememberAvatar(data.username, data.avatar);
            localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
            closeAuthModal(); 
            updateUserSection(); 
            loadWallet();
            startPresence();
            loadAvatarCache();
            if (currentView === 'users') renderFriends();
            return;
        } catch(e) {
            alert('Invalid username or password');
            return;
        }
    } else { 
        alert('Error');
    } 
}

function continueAsGuest(){ 
    leaveParty(true);
    currentUser={type:'guest',username:'Guest', persistScores: false}; 
    localStorage.removeItem('lessfun_user'); 
    closeAuthModal(); 
    updateUserSection(); 
    stopPresence();
    loadWallet();
}
async function logout(){ 
    leaveParty(true);
    if(supabaseClient){ 
        try {
            await touchPresence();
            await supabaseClient.auth.signOut(); 
        } catch(e) {}
    } 
    stopPresence();
    currentUser={type:'guest',username:'Guest', persistScores: false}; 
    localStorage.removeItem('lessfun_user'); 
    updateUserSection(); 
    loadWallet();
}

function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function escapeAttr(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ============================================================
   Coins wallet + cosmetics shop
   ============================================================ */

const SHELLS_START = 100;
const WALLET_STORAGE_PREFIX = 'lessfun_wallet_v1_';
const DAILY_BONUS = 25;
const STREAK_BONUSES = { 3: 150, 7: 400, 14: 1000 };
const DAILY_GIFTS = [50, 75, 100, 150, 200, 300, 500];
const ADVENT_REWARDS = [
    { coins: 50 }, { coins: 75 }, { coins: 100 }, { coins: 125 },
    { coins: 150 }, { coins: 200 }, { coins: 300, item: 'paint_candy' },
    { coins: 100 }, { coins: 125 }, { coins: 150 }, { coins: 175 }, { coins: 200 },
    { coins: 250 }, { coins: 350, item: 'board_candy' }, { coins: 225 }, { coins: 250 },
    { coins: 275 }, { coins: 300 }, { coins: 325 }, { coins: 350 }, { coins: 375 },
    { coins: 400 }, { coins: 450 }, { coins: 1000 }
];

const COSMETICS = [
    // Global themes (apply to the whole app and every game)
    { id: 'theme_aurora', type: 'theme', name: 'Aurora Glass', cost: 0, default: true, color: '#a855f7', accent2: '#ec4899' },
    { id: 'theme_sunset', type: 'theme', name: 'Sunset Drive', cost: 500, color: '#ff7b00', accent2: '#ff3b6b' },
    { id: 'theme_ocean', type: 'theme', name: 'Ocean Signal', cost: 650, color: '#22a6ff', accent2: '#22e6ff' },
    { id: 'theme_lime', type: 'theme', name: 'Lime Circuit', cost: 800, color: '#7dff4d', accent2: '#06d6a0' },
    { id: 'theme_rose', type: 'theme', name: 'Rose Quartz', cost: 950, color: '#ff5d8f', accent2: '#ff9ec4' },
    { id: 'theme_mono', type: 'theme', name: 'Monochrome', cost: 1200, color: '#d9e2ec', accent2: '#8d99ae' },
    { id: 'theme_gold', type: 'theme', name: 'Gold Coast', cost: 1800, color: '#ffd166', accent2: '#ff9f1c' },

    // Avatar frames (shown around every profile picture in the app)
    { id: 'frame_none', type: 'frame', name: 'No Frame', cost: 0, default: true, none: true, color: '#555a63' },
    { id: 'frame_gold', type: 'frame', name: 'Gold Ring', cost: 600, color: '#ffd166' },
    { id: 'frame_cyan', type: 'frame', name: 'Cyan Pulse', cost: 750, color: '#22e6ff' },
    { id: 'frame_rose', type: 'frame', name: 'Rose Halo', cost: 850, color: '#ff5d8f' },
    { id: 'frame_lime', type: 'frame', name: 'Lime Halo', cost: 900, color: '#7dff4d' },
    { id: 'frame_rainbow', type: 'frame', name: 'Prism Ring', cost: 1600, rainbow: true, color: '#ff70a6' },

    // Car paints
    { id: 'paint_rust', type: 'paint', name: 'Rust Bucket', cost: 0, default: true, color: '#8a6f5a', threeColor: 0x8a6f5a },
    { id: 'paint_coral', type: 'paint', name: 'Coral Cruiser', cost: 0, color: '#ef476f', threeColor: 0xef476f },
    { id: 'paint_sunset', type: 'paint', name: 'Sunset Amber', cost: 250, color: '#ffa94d', threeColor: 0xffa94d },
    { id: 'paint_lagoon', type: 'paint', name: 'Lagoon Teal', cost: 350, color: '#2ec4b6', threeColor: 0x2ec4b6 },
    { id: 'paint_grape', type: 'paint', name: 'Grape Soda', cost: 500, color: '#9b5de5', threeColor: 0x9b5de5 },
    { id: 'paint_midnight', type: 'paint', name: 'Midnight', cost: 650, color: '#1b263b', threeColor: 0x1b263b },
    { id: 'paint_gold', type: 'paint', name: 'Gold Rush', cost: 1200, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'paint_rose', type: 'paint', name: 'Rosé Rush', cost: 700, color: '#ff5d8f', threeColor: 0xff5d8f },
    { id: 'paint_ocean', type: 'paint', name: 'Deep Ocean', cost: 750, color: '#0077b6', threeColor: 0x0077b6 },
    { id: 'paint_ember', type: 'paint', name: 'Ember', cost: 800, color: '#e85d04', threeColor: 0xe85d04 },
    { id: 'paint_pearl', type: 'paint', name: 'Pearl White', cost: 950, color: '#f1faee', threeColor: 0xf1faee },
    { id: 'paint_royal', type: 'paint', name: 'Royal Purple', cost: 1100, color: '#5a189a', threeColor: 0x5a189a },
    { id: 'paint_chrome', type: 'paint', name: 'Chrome', cost: 1600, color: '#c0c7d1', threeColor: 0xc0c7d1 },
    { id: 'paint_neon', type: 'paint', name: 'Neon Lime', cost: 1800, color: '#c6ff00', threeColor: 0xc6ff00 },
    { id: 'paint_toxic', type: 'paint', name: 'Toxic Green', cost: 2000, color: '#39ff14', threeColor: 0x39ff14 },
    { id: 'paint_copper', type: 'paint', name: 'Copper Coast', cost: 320, color: '#d97757', threeColor: 0xd97757 },
    { id: 'paint_sky', type: 'paint', name: 'Sky Blue', cost: 420, color: '#4cc9f0', threeColor: 0x4cc9f0 },
    { id: 'paint_mint', type: 'paint', name: 'Mint Cream', cost: 480, color: '#80ed99', threeColor: 0x80ed99 },
    { id: 'paint_cherry', type: 'paint', name: 'Cherry Red', cost: 620, color: '#d90429', threeColor: 0xd90429 },
    { id: 'paint_lavender', type: 'paint', name: 'Lavender Haze', cost: 760, color: '#bdb2ff', threeColor: 0xbdb2ff },
    { id: 'paint_stealth', type: 'paint', name: 'Stealth Grey', cost: 1450, color: '#2f3640', threeColor: 0x2f3640 },

    // Car bodies (cosmetic silhouettes only — no speed or handling changes)
    { id: 'body_classic', type: 'body', name: 'Classic Cruiser', cost: 0, style: 'classic', color: '#ef476f', threeColor: 0xef476f },
    { id: 'body_buggy', type: 'body', name: 'Dune Buggy', cost: 350, style: 'buggy', color: '#ffb703', threeColor: 0xffb703 },
    { id: 'body_wagon', type: 'body', name: 'Surf Wagon', cost: 450, style: 'wagon', color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'body_truck', type: 'body', name: 'Beach Truck', cost: 600, style: 'truck', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'body_racer', type: 'body', name: 'Track Racer', cost: 850, style: 'racer', color: '#e63946', threeColor: 0xe63946 },
    { id: 'body_van', type: 'body', name: 'Camper Van', cost: 900, style: 'van', color: '#f4a261', threeColor: 0xf4a261 },
    { id: 'body_roadster', type: 'body', name: 'Open Roadster', cost: 1000, style: 'roadster', color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'body_muscle', type: 'body', name: 'Muscle Car', cost: 1150, style: 'muscle', color: '#ff6b35', threeColor: 0xff6b35 },
    { id: 'body_limo', type: 'body', name: 'Stretch Limo', cost: 1300, style: 'limo', color: '#f1faee', threeColor: 0xf1faee },
    { id: 'body_cyber', type: 'body', name: 'Cyber Wedge', cost: 1500, style: 'cyber', color: '#c0c7d1', threeColor: 0xc0c7d1 },
    { id: 'body_retro', type: 'body', name: 'Retro Fin', cost: 1650, style: 'retro', color: '#2ec4b6', threeColor: 0x2ec4b6 },
    { id: 'body_taxi', type: 'body', name: 'Coast Taxi', cost: 1800, style: 'taxi', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'body_monster', type: 'body', name: 'Monster Truck', cost: 2200, style: 'monster', color: '#9b5de5', threeColor: 0x9b5de5 },
    { id: 'body_phantom', type: 'body', name: 'Phantom GT', cost: 2800, style: 'phantom', color: '#5a189a', threeColor: 0x5a189a },
    { id: 'body_f1', type: 'body', name: 'F1 Open-Wheel', cost: 4500, style: 'f1', color: '#e63946', threeColor: 0xe63946 },
    { id: 'body_bus', type: 'body', name: 'City Bus', cost: 2600, style: 'bus', color: '#ffc400', threeColor: 0xffc400 },
    { id: 'body_beater', type: 'body', name: 'Free Beater', cost: 0, default: true, style: 'beater', color: '#8a6f5a', threeColor: 0x8a6f5a },
    { id: 'body_offroad', type: 'body', name: 'Off-Road Rig', cost: 2400, style: 'offroad', color: '#6a994e', threeColor: 0x6a994e },
    { id: 'body_gt', type: 'body', name: 'GT3 Coupe', cost: 3600, style: 'gt', color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'body_super', type: 'body', name: 'Supercar', cost: 5200, style: 'super', color: '#ff2d55', threeColor: 0xff2d55 },

    // Engines (visual exhaust and glow only — never changes speed)
    { id: 'engine_stock', type: 'engine', name: 'Stock Engine', cost: 0, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'engine_v8', type: 'engine', name: 'Chrome V8', cost: 500, style: 'v8', color: '#d9e2ec', threeColor: 0xd9e2ec },
    { id: 'engine_turbo', type: 'engine', name: 'Turbo Spool', cost: 650, style: 'turbo', color: '#4cc9f0', threeColor: 0x4cc9f0 },
    { id: 'engine_electric', type: 'engine', name: 'Electric Core', cost: 800, style: 'electric', color: '#22e6ff', threeColor: 0x22e6ff },
    { id: 'engine_diesel', type: 'engine', name: 'Diesel Stack', cost: 900, style: 'diesel', color: '#8b5a2b', threeColor: 0x8b5a2b },
    { id: 'engine_twin', type: 'engine', name: 'Twin Side Pipes', cost: 1100, style: 'twin', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'engine_hybrid', type: 'engine', name: 'Hybrid Drive', cost: 1250, style: 'hybrid', color: '#80ed99', threeColor: 0x80ed99 },
    { id: 'engine_jet', type: 'engine', name: 'Jet Turbine', cost: 1600, style: 'jet', color: '#ff9f1c', threeColor: 0xff9f1c },
    { id: 'engine_rocket', type: 'engine', name: 'Rocket Pack', cost: 1900, style: 'rocket', color: '#ff4d6d', threeColor: 0xff4d6d },
    { id: 'engine_quantum', type: 'engine', name: 'Quantum Core', cost: 2400, style: 'quantum', color: '#b14dff', threeColor: 0xb14dff },
    { id: 'engine_solar', type: 'engine', name: 'Solar Sail', cost: 2700, style: 'solar', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'engine_nitro', type: 'engine', name: 'Nitro Burner', cost: 3200, style: 'nitro', color: '#39ff14', threeColor: 0x39ff14 },
    { id: 'engine_hyper', type: 'engine', name: 'Hyper V12', cost: 3800, style: 'hyper', color: '#ff8a00', threeColor: 0xff8a00 },
    { id: 'engine_fusion', type: 'engine', name: 'Fusion Reactor', cost: 4600, style: 'fusion', color: '#6ef2ff', threeColor: 0x6ef2ff },
    { id: 'engine_lawnmower', type: 'engine', name: 'Free Lawnmower', cost: 0, default: true, style: 'lawnmower', color: '#7f8c8d', threeColor: 0x7f8c8d },
    { id: 'engine_v16', type: 'engine', name: 'V16 Titan', cost: 3600, style: 'v16', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'engine_plasma', type: 'engine', name: 'Plasma Drive', cost: 5200, style: 'plasma', color: '#c77dff', threeColor: 0xc77dff },

    // Aerodynamic parts (real grip and top-speed parts)
    { id: 'aero_stock', type: 'aero', name: 'Stock Aero', cost: 0, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'aero_splitter', type: 'aero', name: 'Carbon Splitter', cost: 700, style: 'splitter', color: '#2b2f36', threeColor: 0x2b2f36 },
    { id: 'aero_wing', type: 'aero', name: 'GT Rear Wing', cost: 1100, style: 'wing', color: '#1f242b', threeColor: 0x1f242b },
    { id: 'aero_diffuser', type: 'aero', name: 'Rear Diffuser', cost: 1500, style: 'diffuser', color: '#15191f', threeColor: 0x15191f },
    { id: 'aero_active', type: 'aero', name: 'Active Aero Pack', cost: 2800, style: 'active', color: '#4cc9f0', threeColor: 0x4cc9f0 },
    { id: 'aero_broken', type: 'aero', name: 'Free Broken Wing', cost: 0, default: true, style: 'broken', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'aero_gt3', type: 'aero', name: 'GT3 Aero', cost: 2200, style: 'gt3', color: '#1f242b', threeColor: 0x1f242b },
    { id: 'aero_ground', type: 'aero', name: 'Ground Effect', cost: 3000, style: 'ground', color: '#2ff6ff', threeColor: 0x2ff6ff },

    // Body kits (real grip and acceleration parts)
    { id: 'kit_stock', type: 'kit', name: 'Stock Body', cost: 0, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'kit_widebody', type: 'kit', name: 'Widebody Kit', cost: 900, style: 'widebody', color: '#ef476f', threeColor: 0xef476f },
    { id: 'kit_track', type: 'kit', name: 'Track Kit', cost: 1600, style: 'track', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'kit_rally', type: 'kit', name: 'Rally Kit', cost: 2100, style: 'rally', color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'kit_hyper', type: 'kit', name: 'Hyper Kit', cost: 3200, style: 'hyper', color: '#b14dff', threeColor: 0xb14dff },
    { id: 'kit_rust', type: 'kit', name: 'Free Rust Kit', cost: 0, default: true, style: 'rust', color: '#8a6f5a', threeColor: 0x8a6f5a },
    { id: 'kit_gt3', type: 'kit', name: 'GT3 Kit', cost: 2400, style: 'gt3', color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'kit_offroad', type: 'kit', name: 'Off-Road Kit', cost: 2600, style: 'offroad', color: '#6a994e', threeColor: 0x6a994e },

    // Surfboards
    { id: 'board_teal', type: 'board', name: 'Teal Board', cost: 0, default: true, color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'board_flame', type: 'board', name: 'Flame Board', cost: 300, color: '#ff6b35', threeColor: 0xff6b35 },
    { id: 'board_ice', type: 'board', name: 'Ice Board', cost: 450, color: '#9be7ff', threeColor: 0x9be7ff },
    { id: 'board_rainbow', type: 'board', name: 'Rainbow Board', cost: 900, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'board_void', type: 'board', name: 'Void Board', cost: 1500, color: '#2b2d42', threeColor: 0x2b2d42 },
    { id: 'board_sunset', type: 'board', name: 'Sunset Board', cost: 500, color: '#ff9f1c', threeColor: 0xff9f1c },
    { id: 'board_mint', type: 'board', name: 'Mint Board', cost: 550, color: '#b8f2e6', threeColor: 0xb8f2e6 },
    { id: 'board_tiger', type: 'board', name: 'Tiger Board', cost: 800, color: '#ffb703', threeColor: 0xffb703 },
    { id: 'board_pearl', type: 'board', name: 'Pearl Board', cost: 1100, color: '#f8f9fa', threeColor: 0xf8f9fa },
    { id: 'board_galaxy', type: 'board', name: 'Galaxy Board', cost: 1300, color: '#3a0ca3', threeColor: 0x3a0ca3 },
    { id: 'board_lava', type: 'board', name: 'Lava Board', cost: 1400, color: '#d00000', threeColor: 0xd00000 },
    { id: 'board_candy', type: 'board', name: 'Candy Stripe', cost: 620, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'board_neon', type: 'board', name: 'Neon Fin', cost: 780, color: '#c6ff00', threeColor: 0xc6ff00 },
    { id: 'board_sakura', type: 'board', name: 'Sakura Board', cost: 880, color: '#ffb3c6', threeColor: 0xffb3c6 },
    { id: 'board_storm', type: 'board', name: 'Storm Rider', cost: 1250, color: '#495057', threeColor: 0x495057 },

    // Underglow

    // Wheels
    { id: 'wheel_stock', type: 'wheel', name: 'Stock Wheels', cost: 0, default: true, none: true, color: '#2b2b2b', threeColor: 0x2b2b2b },
    { id: 'wheel_white', type: 'wheel', name: 'White Walls', cost: 450, color: '#f8f9fa', threeColor: 0xf8f9fa },
    { id: 'wheel_gold', type: 'wheel', name: 'Gold Rims', cost: 500, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'wheel_teal', type: 'wheel', name: 'Teal Rims', cost: 550, color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'wheel_red', type: 'wheel', name: 'Red Rims', cost: 600, color: '#ff3b3b', threeColor: 0xff3b3b },
    { id: 'wheel_chrome', type: 'wheel', name: 'Chrome Rims', cost: 700, color: '#d9e2ec', threeColor: 0xd9e2ec },
    { id: 'wheel_violet', type: 'wheel', name: 'Violet Rims', cost: 800, color: '#9b5de5', threeColor: 0x9b5de5 },
    { id: 'wheel_black', type: 'wheel', name: 'Blackout Rims', cost: 300, color: '#3a3f47', threeColor: 0x3a3f47 },
    { id: 'wheel_blue', type: 'wheel', name: 'Ocean Rims', cost: 620, color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'wheel_orange', type: 'wheel', name: 'Sunset Rims', cost: 680, color: '#ff7b00', threeColor: 0xff7b00 },
    { id: 'wheel_rose', type: 'wheel', name: 'Rose Rims', cost: 760, color: '#ff5d8f', threeColor: 0xff5d8f },
    { id: 'wheel_hologram', type: 'wheel', name: 'Hologram Rims', cost: 1500, rainbow: true, color: '#70e1f5', threeColor: 0x70e1f5 },

    // Exhaust trails
    { id: 'trail_none', type: 'trail', name: 'No Trail', cost: 0, default: true, none: true, color: '#555a63', threeColor: 0x555a63 },
    { id: 'trail_flame', type: 'trail', name: 'Flame Trail', cost: 450, color: '#ff6b35', threeColor: 0xff6b35 },
    { id: 'trail_ice', type: 'trail', name: 'Ice Trail', cost: 550, color: '#9be7ff', threeColor: 0x9be7ff },
    { id: 'trail_toxic', type: 'trail', name: 'Toxic Trail', cost: 650, color: '#39ff14', threeColor: 0x39ff14 },
    { id: 'trail_royal', type: 'trail', name: 'Royal Trail', cost: 750, color: '#9b5de5', threeColor: 0x9b5de5 },
    { id: 'trail_gold', type: 'trail', name: 'Gold Trail', cost: 1000, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'trail_rainbow', type: 'trail', name: 'Rainbow Trail', cost: 1400, rainbow: true, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'trail_cyan', type: 'trail', name: 'Cyan Streak', cost: 520, color: '#22e6ff', threeColor: 0x22e6ff },
    { id: 'trail_pink', type: 'trail', name: 'Pink Streak', cost: 620, color: '#ff4d9d', threeColor: 0xff4d9d },
    { id: 'trail_violet', type: 'trail', name: 'Violet Streak', cost: 820, color: '#b14dff', threeColor: 0xb14dff },
    { id: 'trail_ember', type: 'trail', name: 'Ember Streak', cost: 980, color: '#ff6b35', threeColor: 0xff6b35 },
    { id: 'trail_starlight', type: 'trail', name: 'Starlight Trail', cost: 1700, rainbow: true, color: '#e0fbfc', threeColor: 0xe0fbfc },

    // Beach umbrellas
    { id: 'umbrella_classic', type: 'umbrella', name: 'Classic Mix', cost: 0, default: true, none: true, color: '#ef476f', threeColor: 0xef476f },
    { id: 'umbrella_coral', type: 'umbrella', name: 'Coral Beach', cost: 300, color: '#ef476f', threeColor: 0xef476f },
    { id: 'umbrella_yellow', type: 'umbrella', name: 'Sunny Beach', cost: 300, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'umbrella_mint', type: 'umbrella', name: 'Mint Beach', cost: 350, color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'umbrella_ocean', type: 'umbrella', name: 'Ocean Beach', cost: 400, color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'umbrella_rainbow', type: 'umbrella', name: 'Rainbow Beach', cost: 900, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'umbrella_pink', type: 'umbrella', name: 'Pink Sands', cost: 340, color: '#ff8fab', threeColor: 0xff8fab },
    { id: 'umbrella_lime', type: 'umbrella', name: 'Lime Shore', cost: 420, color: '#a3e635', threeColor: 0xa3e635 },
    { id: 'umbrella_purple', type: 'umbrella', name: 'Purple Tide', cost: 470, color: '#9d4edd', threeColor: 0x9d4edd },
    { id: 'umbrella_sunset', type: 'umbrella', name: 'Sunset Stripes', cost: 720, color: '#ff7b00', threeColor: 0xff7b00 },
    { id: 'umbrella_teal', type: 'umbrella', name: 'Teal Tide', cost: 440, color: '#14b8a6', threeColor: 0x14b8a6 },
    { id: 'umbrella_cream', type: 'umbrella', name: 'Cream Sands', cost: 400, color: '#f5e6c8', threeColor: 0xf5e6c8 },

    // Extra themes
    { id: 'theme_crimson', type: 'theme', name: 'Crimson Rush', cost: 1400, color: '#ef233c', accent2: '#ff7b00' },
    { id: 'theme_forest', type: 'theme', name: 'Forest Trail', cost: 1250, color: '#2d6a4f', accent2: '#95d5b2' },
    { id: 'theme_candy', type: 'theme', name: 'Candy Shop', cost: 1600, color: '#ff70a6', accent2: '#70d6ff' },
    { id: 'theme_noir', type: 'theme', name: 'Noir Film', cost: 2000, color: '#e5e7eb', accent2: '#6b7280' },
    { id: 'theme_cyber', type: 'theme', name: 'Cyberdeck', cost: 2400, color: '#00f5d4', accent2: '#f15bb5' },
    { id: 'theme_christmas', type: 'theme', name: 'Christmas Event', cost: 0, color: '#2e7d32', accent2: '#c62828' },
    { id: 'frame_snow', type: 'frame', name: 'Snow Ring', cost: 0, color: '#e8f4ff' },

    // Extra avatar frames
    { id: 'frame_emerald', type: 'frame', name: 'Emerald Ring', cost: 900, color: '#10b981' },
    { id: 'frame_ruby', type: 'frame', name: 'Ruby Ring', cost: 1100, color: '#e11d48' },
    { id: 'frame_ocean', type: 'frame', name: 'Ocean Ring', cost: 1000, color: '#0ea5e9' },
    { id: 'frame_fire', type: 'frame', name: 'Fire Ring', cost: 1500, color: '#f97316' },
    { id: 'frame_galaxy', type: 'frame', name: 'Galaxy Ring', cost: 2200, rainbow: true, color: '#a855f7' },

    // Extra paints
    { id: 'paint_candy', type: 'paint', name: 'Candy Apple', cost: 450, color: '#ff3b6b', threeColor: 0xff3b6b },
    { id: 'paint_forest', type: 'paint', name: 'Forest Green', cost: 400, color: '#2d6a4f', threeColor: 0x2d6a4f },
    { id: 'paint_ice', type: 'paint', name: 'Ice Blue', cost: 520, color: '#bde0fe', threeColor: 0xbde0fe },
    { id: 'paint_sand', type: 'paint', name: 'Desert Sand', cost: 380, color: '#d4a373', threeColor: 0xd4a373 },
    { id: 'paint_plum', type: 'paint', name: 'Plum Crazy', cost: 480, color: '#7b2cbf', threeColor: 0x7b2cbf },
    { id: 'paint_electric', type: 'paint', name: 'Electric Lime', cost: 700, color: '#c6ff00', threeColor: 0xc6ff00 },

    // Extra boards
    { id: 'board_carbon', type: 'board', name: 'Carbon Deck', cost: 500, color: '#2b2f36', threeColor: 0x2b2f36 },
    { id: 'board_gold', type: 'board', name: 'Gold Deck', cost: 900, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'board_reef', type: 'board', name: 'Reef Deck', cost: 650, color: '#00b4d8', threeColor: 0x00b4d8 },

    // Extra underglow


    // Extra trails
    { id: 'trail_sunset', type: 'trail', name: 'Sunset Trail', cost: 700, color: '#ff7b00', threeColor: 0xff7b00 },
    { id: 'trail_electric', type: 'trail', name: 'Electric Trail', cost: 760, color: '#c6ff00', threeColor: 0xc6ff00 },
    { id: 'trail_blood', type: 'trail', name: 'Blood Trail', cost: 860, color: '#b91c1c', threeColor: 0xb91c1c }
];

// 500 real production cars from 60+ brands. Format:
// brand|model|year|top mph|0-60 s|horsepower|body style|paint|drivetrain
const CAR_DATA = `BMW|M3 Competition|2024|180|3.4|503|muscle|1f2937|RWD
BMW|M5 CS|2022|190|2.9|627|muscle|374151|AWD
BMW|M2|2024|177|4.1|453|racer|0b3d91|RWD
BMW|M4 CSL|2023|191|3.7|543|racer|111827|RWD
BMW|M8 Competition|2023|190|3.0|617|gt|1e3a8a|AWD
BMW|i4 M50|2024|140|3.7|536|wagon|2563eb|AWD
BMW|i7 M70|2024|155|3.5|660|limo|1e40af|AWD
BMW|X5 M Competition|2024|177|3.7|617|suv|0f172a|AWD
BMW|XM Label|2024|180|3.7|738|suv|3f3f46|AWD
BMW|Z4 M40i|2024|155|4.4|382|roadster|0ea5e9|RWD
Tesla|Model S Plaid|2023|200|1.99|1020|gt|b91c1c|AWD
Tesla|Model 3 Performance|2024|163|3.1|503|classic|dc2626|AWD
Tesla|Model X Plaid|2023|163|2.5|1020|suv|7f1d1d|AWD
Tesla|Model Y Performance|2024|155|3.5|456|suv|dc2626|AWD
Tesla|Cybertruck Cyberbeast|2024|130|2.6|845|truck|6b7280|AWD
Toyota|GR Supra|2024|155|3.9|382|gt|ef4444|RWD
Toyota|GR86|2024|140|6.1|228|racer|111827|RWD
Toyota|GR Corolla|2024|143|4.9|300|wagon|1f2937|AWD
Toyota|GR Yaris|2024|143|4.9|268|classic|991b1b|AWD
Toyota|Land Cruiser|2024|110|7.5|326|suv|3f6212|4WD
Toyota|Tundra TRD Pro|2024|110|6.7|389|truck|1e293b|4WD
Toyota|Camry TRD|2023|135|5.8|301|classic|111827|FWD
Toyota|Prius|2024|112|9.8|196|classic|f5f5f4|FWD
Toyota|2000GT|1967|135|8.6|150|retro|f5f5f4|RWD
Porsche|911 GT3 RS|2023|184|3.0|518|racer|1d4ed8|RWD
Porsche|911 Turbo S|2023|205|2.6|640|gt|1e3a8a|AWD
Porsche|718 Cayman GT4 RS|2023|196|3.4|493|racer|f59e0b|RWD
Porsche|Taycan Turbo S|2023|161|2.6|750|classic|3b82f6|AWD
Porsche|Panamera Turbo S|2023|196|3.2|620|limo|111827|AWD
Porsche|918 Spyder|2015|214|2.5|887|super|166534|AWD
Porsche|Carrera GT|2004|205|3.9|612|roadster|9ca3af|RWD
Porsche|Macan GTS|2023|169|4.3|434|suv|111827|AWD
Porsche|Cayenne Turbo GT|2023|186|3.3|650|suv|7f1d1d|AWD
Ferrari|SF90 Stradale|2021|211|2.5|986|super|dc2626|AWD
Ferrari|296 GTB|2023|205|2.9|819|super|ef4444|RWD
Ferrari|F8 Tributo|2020|211|2.9|710|super|b91c1c|RWD
Ferrari|812 Competizione|2023|211|2.8|819|gt|dc2626|RWD
Ferrari|Roma|2023|199|3.4|612|gt|991b1b|RWD
Ferrari|Portofino M|2022|199|3.5|612|roadster|7f1d1d|RWD
Ferrari|LaFerrari|2014|217|2.6|949|super|dc2626|RWD
Ferrari|Enzo|2003|217|3.1|651|super|ef4444|RWD
Ferrari|F40|1987|201|3.8|471|retro|ff0000|RWD
Lamborghini|Revuelto|2024|217|2.5|1001|super|eab308|AWD
Lamborghini|Huracan STO|2023|193|3.0|640|super|eab308|RWD
Lamborghini|Aventador SVJ|2021|217|2.8|770|super|f59e0b|AWD
Lamborghini|Urus Performante|2023|190|3.3|657|suv|d97706|AWD
Lamborghini|Gallardo LP570|2013|202|3.4|570|super|fbbf24|AWD
Lamborghini|Murcielago LP670|2010|212|3.4|661|super|eab308|AWD
Lamborghini|Countach LP5000|1989|183|4.8|455|retro|f5f5f4|RWD
McLaren|765LT|2021|205|2.8|765|super|f97316|RWD
McLaren|720S|2019|212|2.9|710|super|f97316|RWD
McLaren|Artura|2024|205|3.0|671|gt|f97316|RWD
McLaren|Senna|2019|208|2.8|789|super|f97316|RWD
McLaren|P1|2014|217|2.8|903|super|f97316|RWD
McLaren|F1|1994|240|3.2|627|retro|ff7b00|RWD
McLaren|750S|2024|206|2.8|740|super|f97316|RWD
Audi|RS3|2023|180|3.8|401|classic|111827|AWD
Audi|RS6 Avant|2023|190|3.6|621|wagon|1f2937|AWD
Audi|R8 V10 Performance|2023|205|3.1|602|super|737373|AWD
Audi|TT RS|2022|174|3.7|394|racer|1e3a8a|AWD
Audi|e-tron GT RS|2023|155|3.3|637|gt|1d4ed8|AWD
Audi|RS7 Sportback|2023|190|3.4|621|wagon|111827|AWD
Audi|RS Q8|2023|190|3.8|591|suv|0f172a|AWD
Audi|Quattro Sport|1985|155|4.8|306|retro|f5f5f4|AWD
Mercedes-AMG|GT Black Series|2021|202|3.2|720|gt|111827|RWD
Mercedes-AMG|One|2023|219|2.9|1063|super|0f172a|AWD
Mercedes-AMG|C63|2024|174|3.4|671|classic|1f2937|RWD
Mercedes-AMG|E63|2023|180|3.4|603|wagon|111827|AWD
Mercedes-AMG|G63|2024|137|4.5|577|suv|1f2937|4WD
Mercedes-AMG|SL63|2023|196|3.6|577|roadster|0f172a|RWD
Mercedes-AMG|SLS|2012|197|3.8|563|super|b91c1c|RWD
Mercedes-Benz|300SL Gullwing|1955|161|8.8|215|retro|f5f5f4|RWD
Mercedes-AMG|GT 63 S|2023|196|3.2|630|gt|111827|AWD
Nissan|GT-R Nismo|2024|205|2.5|600|super|111827|AWD
Nissan|Z Performance|2024|155|4.5|400|gt|1e3a8a|RWD
Nissan|Silvia S15|2002|145|5.9|250|racer|0ea5e9|RWD
Nissan|Skyline R34 GT-R|2002|180|4.5|276|racer|2563eb|AWD
Nissan|370Z Nismo|2020|155|4.7|350|gt|1d4ed8|RWD
Nissan|Leaf e+|2023|98|7.4|214|classic|0ea5e9|FWD
Nissan|Ariya e-4orce|2024|124|4.8|389|suv|1e40af|AWD
Nissan|Patrol Nismo|2024|130|6.0|428|suv|374151|4WD
Honda|Civic Type R|2024|170|4.9|315|racer|dc2626|FWD
Honda|NSX Type S|2022|191|2.9|600|super|dc2626|AWD
Honda|S2000|2009|155|5.4|237|roadster|eab308|RWD
Honda|Integra Type R|2001|145|6.3|195|racer|f5f5f4|FWD
Honda|Accord Sport|2024|130|6.6|192|classic|1e3a8a|FWD
Honda|CR-V|2024|118|8.1|190|suv|1f2937|AWD
Ford|Mustang GT|2024|166|4.2|486|muscle|1d4ed8|RWD
Ford|Mustang Shelby GT500|2022|180|3.4|760|muscle|111827|RWD
Ford|GT|2017|216|3.2|647|super|1e3a8a|RWD
Ford|F-150 Raptor R|2024|112|3.6|720|truck|1f2937|4WD
Ford|Bronco Raptor|2024|112|5.9|418|offroad|3f6212|4WD
Ford|Focus RS|2018|165|4.6|350|classic|1d4ed8|AWD
Ford|Fiesta ST|2019|144|6.5|197|classic|1e3a8a|FWD
Ford|GT40|1969|164|5.3|335|retro|2563eb|RWD
Ford|Escort RS Cosworth|1994|147|5.8|227|retro|1f2937|AWD
Chevrolet|Corvette Z06|2024|189|2.6|670|super|eab308|RWD
Chevrolet|Corvette ZR1|2025|233|2.3|1064|super|f59e0b|RWD
Chevrolet|Camaro ZL1|2023|198|3.5|650|muscle|111827|RWD
Chevrolet|Camaro SS|2024|165|4.0|455|muscle|991b1b|RWD
Chevrolet|Silverado ZR2|2024|110|7.1|420|truck|374151|4WD
Chevrolet|Bolt EV|2023|108|6.5|200|classic|2563eb|FWD
Chevrolet|Blazer EV SS|2024|130|3.4|557|suv|1d4ed8|AWD
Chevrolet|C8 Stingray|2023|194|2.9|495|super|dc2626|RWD
Dodge|Challenger Hellcat|2023|199|3.6|717|muscle|111827|RWD
Dodge|Charger SRT Hellcat|2023|196|3.6|717|classic|1f2937|RWD
Dodge|Viper ACR|2017|177|3.3|645|super|dc2626|RWD
Dodge|Hornet R/T|2024|130|6.1|288|suv|eab308|AWD
Dodge|Durango SRT Hellcat|2023|180|3.5|710|suv|111827|AWD
Subaru|WRX STI|2021|159|4.9|310|racer|1e3a8a|AWD
Subaru|WRX|2024|145|5.4|271|classic|1d4ed8|AWD
Subaru|BRZ|2024|140|6.1|228|racer|991b1b|RWD
Subaru|Forester|2024|117|8.0|182|suv|3f6212|AWD
Subaru|Impreza 22B STi|1998|158|4.7|276|retro|1d4ed8|AWD
Mitsubishi|Lancer Evo X|2015|155|4.9|291|racer|1f2937|AWD
Mitsubishi|Lancer Evo IX|2006|157|4.7|286|racer|f5f5f4|AWD
Mitsubishi|Eclipse GSX|1999|150|6.4|210|racer|1e3a8a|AWD
Mitsubishi|Pajero Evolution|1998|137|7.6|276|offroad|3f6212|4WD
Mazda|MX-5 Miata|2024|137|5.7|181|roadster|dc2626|RWD
Mazda|RX-7 Spirit R|2002|160|4.9|276|racer|f5f5f4|RWD
Mazda|RX-8|2011|145|5.9|232|racer|1d4ed8|RWD
Mazda|Mazda3 Turbo|2024|134|5.6|250|classic|991b1b|AWD
Mazda|CX-5|2024|130|7.8|256|suv|1f2937|AWD
Hyundai|i30 N|2024|155|5.4|276|racer|0ea5e9|FWD
Hyundai|Veloster N|2022|155|5.6|275|racer|1d4ed8|FWD
Hyundai|Ioniq 5 N|2024|162|3.4|641|suv|2563eb|AWD
Hyundai|Elantra N|2024|155|5.3|276|classic|0ea5e9|FWD
Kia|Stinger GT|2023|167|4.6|368|gt|991b1b|AWD
Kia|EV6 GT|2023|161|3.4|576|suv|1e3a8a|AWD
Kia|Telluride|2024|130|7.2|291|suv|3f6212|AWD
Kia|Sportage|2024|125|8.1|187|suv|1f2937|AWD
Volkswagen|Golf R|2024|155|4.6|315|classic|1e3a8a|AWD
Volkswagen|Golf GTI|2024|155|5.6|241|classic|dc2626|FWD
Volkswagen|ID.4 GTX|2024|112|5.4|295|suv|2563eb|AWD
Volkswagen|Arteon R|2023|155|4.9|300|wagon|111827|AWD
Volkswagen|Beetle RSi|2001|140|6.3|221|retro|eab308|AWD
Volvo|S60 Polestar|2024|155|4.5|455|classic|1e3a8a|AWD
Volvo|XC90 Recharge|2024|112|5.3|455|suv|374151|AWD
Volvo|240 Turbo|1984|130|7.9|155|retro|f5f5f4|RWD
Jaguar|F-Type R|2023|186|3.5|575|gt|166534|AWD
Jaguar|XJ220|1994|217|3.6|542|retro|1e3a8a|RWD
Jaguar|I-Pace|2023|124|4.5|394|suv|1d4ed8|AWD
Aston Martin|Valkyrie|2023|217|2.5|1160|super|166534|RWD
Aston Martin|DBS Superleggera|2023|211|3.2|715|gt|14532d|RWD
Aston Martin|Vantage|2024|202|3.4|656|gt|166534|RWD
Aston Martin|DB5|1964|145|8.1|282|retro|9ca3af|RWD
Aston Martin|Vulcan|2016|208|2.9|820|super|14532d|RWD
Bentley|Continental GT Speed|2023|208|3.5|650|gt|1e3a8a|AWD
Bentley|Bentayga Speed|2023|190|3.8|626|suv|111827|AWD
Bentley|Speed 8|2003|214|3.6|600|retro|14532d|RWD
Rolls-Royce|Phantom|2024|155|5.1|563|limo|f5f5f4|RWD
Rolls-Royce|Ghost Black Badge|2024|155|4.5|591|limo|111827|AWD
Rolls-Royce|Cullinan|2024|155|4.9|563|suv|f5f5f4|AWD
Lotus|Emira V6|2024|180|4.2|400|gt|eab308|RWD
Lotus|Evija|2023|217|2.7|2011|super|22d3ee|AWD
Lotus|Elise|2011|150|4.7|217|roadster|f97316|RWD
Lotus|Exige Cup 430|2018|180|3.2|430|racer|166534|RWD
Bugatti|Chiron Super Sport|2023|273|2.4|1578|super|1e3a8a|AWD
Bugatti|Veyron 16.4|2015|253|2.5|1001|super|1e40af|AWD
Bugatti|Bolide|2024|236|2.2|1578|super|0f172a|AWD
Koenigsegg|Jesko Absolut|2024|300|2.5|1600|super|f5f5f4|RWD
Koenigsegg|Regera|2022|250|2.7|1500|super|111827|RWD
Koenigsegg|Agera RS|2018|278|2.8|1160|super|eab308|RWD
Pagani|Huayra BC|2023|238|2.8|789|super|9ca3af|RWD
Pagani|Zonda R|2011|233|2.7|739|super|1e3a8a|RWD
Rimac|Nevera|2024|258|1.85|1914|super|0ea5e9|AWD
Rimac|Concept One|2020|220|2.5|1224|super|111827|AWD
Lucid|Air Sapphire|2024|205|1.89|1234|gt|1e3a8a|AWD
Lucid|Air Grand Touring|2024|168|3.0|819|classic|374151|AWD
Rivian|R1T Quad|2024|130|2.9|835|truck|3f6212|AWD
Rivian|R1S Quad|2024|130|2.9|835|suv|14532d|AWD
Jeep|Wrangler Rubicon 392|2024|112|4.5|470|offroad|3f6212|4WD
Jeep|Grand Cherokee Trackhawk|2021|180|3.5|707|suv|111827|AWD
Jeep|Gladiator Mojave|2024|110|7.6|285|truck|3f6212|4WD
Land Rover|Defender V8|2024|149|4.9|518|offroad|3f6212|AWD
Land Rover|Range Rover Sport SVR|2023|180|3.8|575|suv|111827|AWD
Land Rover|Discovery|2024|130|6.6|355|suv|14532d|AWD
Mini|Cooper JCW GP|2021|165|5.2|306|classic|dc2626|FWD
Mini|Countryman JCW|2024|155|4.9|312|suv|1f2937|AWD
Peugeot|208 GTi|2019|143|6.5|208|classic|1d4ed8|FWD
Peugeot|205 GTi|1992|130|7.8|130|retro|f5f5f4|FWD
Renault|Megane RS Trophy|2020|163|5.4|300|racer|eab308|FWD
Renault|Clio Williams|1994|134|7.2|150|retro|1e3a8a|FWD
Alfa Romeo|Giulia GTAm|2022|191|3.6|540|classic|b91c1c|RWD
Alfa Romeo|4C|2020|160|4.1|237|roadster|dc2626|RWD
Alfa Romeo|8C Competizione|2009|181|4.2|450|gt|b91c1c|RWD
Maserati|MC20|2023|202|2.9|621|super|1e3a8a|RWD
Maserati|Ghibli Trofeo|2023|203|3.7|580|classic|111827|RWD
Lexus|LFA|2012|202|3.7|552|super|f5f5f4|RWD
Lexus|IS 500 F Sport|2024|149|4.4|472|classic|374151|RWD
Lexus|RC F|2024|168|4.4|472|gt|1e3a8a|RWD
Acura|NSX Type S|2022|191|2.9|600|super|dc2626|AWD
Acura|Integra Type S|2024|155|5.1|320|racer|f5f5f4|FWD
Infiniti|Q60 Red Sport|2022|155|4.5|400|gt|1e3a8a|RWD
Infiniti|Q50 Red Sport|2022|155|4.7|400|classic|374151|RWD
Cadillac|CT5-V Blackwing|2024|200|3.6|668|muscle|111827|RWD
Cadillac|Escalade-V|2024|124|4.4|682|suv|0f172a|AWD
Cadillac|Celestiq|2024|130|3.8|655|limo|1e3a8a|AWD
Shelby|Cobra 427|1966|165|3.9|485|roadster|1e3a8a|RWD
Shelby|GT500 Super Snake|2022|200|3.3|825|muscle|111827|RWD
BMW|M3 CS|2024|171|6.4|543|muscle|7f1d1d|RWD
BMW|M4 GTS|2016|164|6.7|493|racer|111827|RWD
BMW|M6 Gran Coupe|2018|179|6.1|600|gt|374151|RWD
BMW|X3 M Competition|2024|144|6.7|503|suv|0ea5e9|AWD
BMW|i5 M60|2024|178|6.2|593|classic|dc2626|AWD
Tesla|Model S Long Range|2024|189|5.8|670|gt|16a34a|AWD
Tesla|Model 3 Long Range|2024|151|7.2|394|classic|9333ea|AWD
Tesla|Model X Long Range|2024|167|5.8|670|suv|f97316|AWD
Tesla|Model Y Long Range|2024|127|7.3|384|suv|eab308|AWD
Tesla|Roadster 2|2025|235|4.0|1000|super|64748b|AWD
Toyota|Supra 2.0|2024|131|8.0|255|gt|16a34a|RWD
Toyota|Celica GT-Four|1994|131|8.0|255|retro|9333ea|AWD
Toyota|MR2 Turbo|1995|130|8.0|245|retro|f97316|RWD
Toyota|Hilux GR Sport|2024|105|8.1|224|truck|eab308|4WD
Toyota|bZ4X|2024|104|8.2|214|suv|64748b|AWD
Porsche|911 Carrera S|2024|158|7.0|443|gt|f59e0b|RWD
Porsche|911 GT2 RS|2019|193|5.6|700|racer|7f1d1d|RWD
Porsche|718 Boxster GTS|2024|151|7.2|394|roadster|111827|RWD
Porsche|Cayman S|2024|151|7.2|394|racer|374151|RWD
Porsche|959|1987|158|7.0|444|retro|0ea5e9|AWD
Ferrari|488 Pista|2019|195|5.6|710|super|16a34a|RWD
Ferrari|599 GTO|2011|188|5.8|661|gt|9333ea|RWD
Ferrari|360 Challenge|2003|153|7.1|410|racer|f97316|RWD
Ferrari|California T|2015|173|6.4|552|roadster|eab308|RWD
Ferrari|12Cilindri|2025|210|5.0|819|gt|64748b|RWD
Lamborghini|Huracan Performante|2018|184|6.0|631|super|374151|AWD
Lamborghini|Aventador SV|2016|199|5.4|740|super|0ea5e9|AWD
Lamborghini|Diablo SV|1999|170|6.5|530|retro|dc2626|RWD
Lamborghini|Urus S|2024|165|5.8|657|suv|16a34a|AWD
Lamborghini|Sesto Elemento|2011|175|6.3|570|super|9333ea|AWD
McLaren|570S|2017|174|6.3|562|super|64748b|RWD
McLaren|600LT|2019|178|6.2|592|super|1f2937|RWD
McLaren|675LT|2016|188|5.8|666|super|b91c1c|RWD
McLaren|Speedtail|2020|240|3.9|1035|super|1e3a8a|RWD
McLaren|Sabre|2021|210|5.0|824|super|065f46|RWD
Audi|RS4 Avant|2024|158|7.0|444|wagon|f97316|AWD
Audi|RS5 Sportback|2024|158|7.0|444|gt|eab308|AWD
Audi|S8|2024|174|6.3|563|limo|64748b|AWD
Audi|R8 GT|2023|180|6.1|602|super|1f2937|AWD
Audi|RS e-tron GT|2024|184|5.9|637|gt|b91c1c|AWD
Mercedes-AMG|A45 S|2024|154|7.1|416|classic|b91c1c|AWD
Mercedes-AMG|CLA45 S|2024|154|7.1|416|classic|1e3a8a|AWD
Mercedes-AMG|GT R|2021|176|6.3|577|gt|065f46|RWD
Mercedes-AMG|S63|2024|206|5.1|791|limo|f59e0b|AWD
Mercedes-AMG|GLC63|2024|167|5.8|671|suv|7f1d1d|AWD
Mercedes-Benz|190E 2.5-16|1990|128|8.1|232|retro|374151|RWD
Mercedes-Benz|560SEC|1990|137|7.7|295|retro|0ea5e9|RWD
Mercedes-Benz|E500|1994|140|7.6|315|retro|dc2626|RWD
Mercedes-Benz|SL55|2005|164|6.7|493|roadster|16a34a|RWD
Mercedes-Benz|G500|2024|132|7.1|416|suv|9333ea|4WD
Nissan|300ZX Twin Turbo|1996|138|7.7|300|retro|7f1d1d|RWD
Nissan|Pulsar GTI-R|1992|128|8.1|227|retro|111827|AWD
Nissan|Stagea 260RS|1998|134|7.8|276|wagon|374151|AWD
Nissan|Titan Pro-4X|2024|130|7.2|400|truck|0ea5e9|4WD
Nissan|Sakura|2024|116|8.5|147|classic|dc2626|FWD
Honda|Civic Si|2024|124|8.2|200|classic|16a34a|FWD
Honda|Prelude Type SH|2001|127|8.1|220|retro|9333ea|FWD
Honda|Accord Type R|2002|127|8.1|220|retro|f97316|FWD
Honda|Fit RS|2024|112|8.7|116|classic|eab308|FWD
Honda|Passport TrailSport|2024|114|7.8|285|suv|64748b|AWD
Ford|Mustang Mach 1|2022|161|6.8|470|muscle|7f1d1d|RWD
Ford|Focus ST|2024|135|7.8|280|classic|111827|FWD
Ford|Puma ST|2024|123|8.3|197|classic|374151|FWD
Ford|Ranger Raptor|2024|130|7.2|405|truck|0ea5e9|4WD
Ford|Capri RS|1973|117|8.5|150|retro|dc2626|RWD
Chevrolet|Camaro 1LE|2024|159|6.9|455|muscle|16a34a|RWD
Chevrolet|Corvette Grand Sport|2019|160|6.9|460|super|9333ea|RWD
Chevrolet|C10 Restomod|1970|143|6.7|500|truck|f97316|RWD
Chevrolet|Tahoe RST|2024|132|7.1|420|suv|eab308|4WD
Chevrolet|Cruze Diesel|2019|115|8.6|137|classic|64748b|FWD
Dodge|Challenger R/T|2023|148|7.3|375|muscle|065f46|RWD
Dodge|Charger Scat Pack|2023|163|6.7|485|classic|f59e0b|RWD
Dodge|Dart SRT4|2016|122|8.3|184|classic|7f1d1d|FWD
Dodge|Neon SRT-4|2005|128|8.1|230|retro|111827|FWD
Dodge|Magnum SRT8|2008|155|7.1|425|wagon|374151|RWD
Subaru|Legacy GT|2024|132|7.9|260|classic|9333ea|AWD
Subaru|Outback Wilderness|2024|110|7.9|260|suv|f97316|AWD
Subaru|Crosstrek Wilderness|2024|99|8.3|182|suv|eab308|AWD
Subaru|BRZ tS|2024|128|8.1|228|racer|64748b|RWD
Subaru|SVX|1997|128|8.1|230|retro|1f2937|AWD
Mitsubishi|Galant VR-4|1998|135|7.8|280|retro|374151|AWD
Mitsubishi|Starion ESI-R|1989|122|8.3|188|retro|0ea5e9|RWD
Mitsubishi|3000GT VR-4|1999|140|7.6|320|retro|dc2626|AWD
Mitsubishi|Outlander PHEV|2024|108|8.0|248|suv|16a34a|AWD
Mitsubishi|Mirage Ralliart|2024|107|8.9|78|classic|9333ea|FWD
Mazda|MX-5 RF|2024|121|8.3|181|roadster|eab308|RWD
Mazda|Mazdaspeed3|2013|133|7.9|263|classic|64748b|FWD
Mazda|RX-3|1978|111|8.7|110|retro|1f2937|RWD
Mazda|CX-60|2024|119|7.6|323|suv|b91c1c|AWD
Mazda|Cosmo Sport|1967|111|8.7|110|retro|1e3a8a|RWD
Hyundai|i20 N|2024|124|8.2|201|classic|1e3a8a|FWD
Hyundai|Sonata N Line|2024|136|7.8|290|classic|065f46|FWD
Hyundai|Tucson N Line|2024|100|8.3|187|suv|f59e0b|AWD
Hyundai|Kona N|2023|112|7.8|276|suv|7f1d1d|FWD
Hyundai|N Vision 74|2025|189|5.8|670|super|111827|RWD
Kia|Forte GT|2024|124|8.2|201|classic|374151|FWD
Kia|K5 GT|2024|136|7.8|290|classic|0ea5e9|FWD
Kia|Sorento SX|2024|113|7.8|281|suv|dc2626|AWD
Kia|EV9 GT|2025|144|6.7|501|suv|16a34a|AWD
Kia|Cerato GT|2024|124|8.2|201|classic|9333ea|FWD
Volkswagen|Golf R 20 Years|2024|142|7.6|328|classic|374151|AWD
Volkswagen|Polo GTI|2024|124|8.2|204|classic|0ea5e9|FWD
Volkswagen|Touareg R|2024|137|6.9|456|suv|dc2626|AWD
Volkswagen|Jetta GLI|2024|128|8.1|228|classic|16a34a|FWD
Volkswagen|ID. Buzz|2024|143|7.5|335|van|9333ea|RWD
Volvo|V60 Polestar|2024|159|6.9|455|wagon|dc2626|AWD
Volvo|C30 T5|2013|128|8.1|227|classic|16a34a|FWD
Volvo|850 R|1997|129|8.0|240|wagon|9333ea|FWD
Volvo|EX30|2024|133|7.1|422|suv|f97316|AWD
Volvo|S90 Recharge|2024|159|6.9|455|limo|eab308|AWD
Jaguar|XKR-S|2014|171|6.4|542|gt|1e3a8a|RWD
Jaguar|F-Pace SVR|2024|149|6.4|542|suv|065f46|AWD
Jaguar|E-Type|1969|133|7.9|265|retro|f59e0b|RWD
Jaguar|XJ220S|1999|190|5.7|680|super|7f1d1d|RWD
Jaguar|XE SV Project 8|2019|178|6.2|592|racer|111827|AWD
Aston Martin|DB11|2023|184|6.0|630|gt|eab308|RWD
Aston Martin|Virage|2012|164|6.7|490|gt|64748b|RWD
Aston Martin|Rapide S|2016|173|6.4|552|limo|1f2937|RWD
Aston Martin|One-77|2011|200|5.4|750|super|b91c1c|RWD
Aston Martin|Valhalla|2025|235|4.0|998|super|1e3a8a|AWD
Bentley|Continental GTC|2024|171|6.4|542|gt|065f46|AWD
Bentley|Flying Spur|2024|183|6.0|626|limo|f59e0b|AWD
Bentley|Mulsanne|2019|166|6.6|505|limo|7f1d1d|RWD
Bentley|Bacalar|2021|186|5.9|650|roadster|111827|AWD
Bentley|Batur|2024|199|5.4|740|gt|374151|AWD
Rolls-Royce|Dawn|2023|174|6.3|563|roadster|065f46|RWD
Rolls-Royce|Wraith|2021|183|6.0|624|gt|f59e0b|RWD
Rolls-Royce|Ghost|2024|174|6.3|563|limo|7f1d1d|AWD
Rolls-Royce|Spectre|2024|176|6.3|577|gt|111827|AWD
Rolls-Royce|Silver Shadow|1976|122|8.3|189|retro|374151|RWD
Lotus|Esprit V8|2004|145|7.5|350|retro|16a34a|RWD
Lotus|Evora GT430|2018|156|7.0|430|gt|9333ea|RWD
Lotus|Europa|1974|114|8.6|126|retro|f97316|RWD
Lotus|Emira V6 First Edition|2024|152|7.2|400|gt|eab308|RWD
Lotus|Eletre R|2024|200|4.5|905|suv|64748b|AWD
Bugatti|Divo|2021|300|2.0|1479|super|1f2937|AWD
Bugatti|Centodieci|2022|300|2.0|1578|super|b91c1c|AWD
Bugatti|La Voiture Noire|2022|300|2.0|1479|super|1e3a8a|AWD
Bugatti|EB110|1995|173|6.4|553|retro|065f46|AWD
Bugatti|Tourbillon|2026|300|2.0|1775|super|f59e0b|AWD
Koenigsegg|CC850|2024|288|2.0|1385|super|374151|RWD
Koenigsegg|One:1|2015|282|2.2|1340|super|0ea5e9|RWD
Koenigsegg|Jesko Attack|2024|300|2.0|1600|super|dc2626|RWD
Koenigsegg|Gemera|2024|300|2.0|1700|gt|16a34a|AWD
Koenigsegg|CC8S|2002|187|5.9|655|retro|9333ea|RWD
Pagani|Zonda Cinque|2009|189|5.8|669|super|374151|RWD
Pagani|Huayra Roadster|2018|202|5.3|764|roadster|0ea5e9|RWD
Pagani|Utopia|2024|214|4.8|852|super|dc2626|RWD
Pagani|Zonda F|2006|180|6.1|602|super|16a34a|RWD
Pagani|Huayra R|2022|212|4.9|838|racer|9333ea|RWD
Rimac|Nevera R|2024|300|2.0|2074|super|f97316|AWD
Rimac|Concept S|2016|245|3.7|1073|super|eab308|AWD
Rimac|Nevera Time Attack|2023|300|2.0|1914|super|64748b|AWD
Rimac|Concept Two|2020|300|2.0|1914|super|1f2937|AWD
Rimac|Nevera 15th|2024|300|2.0|1914|super|b91c1c|AWD
Lucid|Air Pure|2024|156|7.0|430|classic|1e3a8a|RWD
Lucid|Air Touring|2024|182|6.0|620|gt|065f46|AWD
Lucid|Gravity GT|2025|189|4.9|828|suv|f59e0b|AWD
Lucid|Air Dream Edition|2022|250|3.5|1111|gt|7f1d1d|AWD
Lucid|Gravity Dream|2025|189|4.9|828|suv|111827|AWD
Rivian|R1T Dual|2024|148|6.5|533|truck|1e3a8a|AWD
Rivian|R1S Dual|2024|148|6.5|533|suv|065f46|AWD
Rivian|R2|2026|136|6.9|450|suv|f59e0b|AWD
Rivian|R3X|2026|136|6.9|450|suv|7f1d1d|AWD
Rivian|R1T Tri|2024|192|4.8|850|truck|111827|AWD
Jeep|Wrangler 4xe|2024|148|7.3|375|offroad|eab308|4WD
Jeep|Compass Trailhawk|2024|102|8.2|200|suv|64748b|4WD
Jeep|Renegade Trailhawk|2024|99|8.4|177|suv|1f2937|4WD
Jeep|Wagoneer|2024|132|7.1|420|suv|b91c1c|4WD
Jeep|Grand Cherokee Limited|2024|115|7.8|293|suv|1e3a8a|4WD
Land Rover|Range Rover SV|2024|158|6.1|606|suv|9333ea|AWD
Land Rover|Defender 130|2024|151|7.2|395|offroad|f97316|AWD
Land Rover|Freelander|2014|107|8.0|240|suv|eab308|AWD
Land Rover|Range Rover Evoque|2024|115|7.7|296|suv|64748b|AWD
Land Rover|Series III|1985|106|8.9|70|offroad|1f2937|4WD
Mini|Cooper S|2024|124|8.2|201|classic|374151|FWD
Mini|Cooper SE|2024|126|8.2|218|classic|0ea5e9|FWD
Mini|Clubman JCW|2024|138|7.7|301|wagon|dc2626|AWD
Mini|Paceman JCW|2016|104|8.2|218|suv|16a34a|AWD
Mini|Moke|2024|110|8.8|100|offroad|9333ea|FWD
Peugeot|308 GTi|2019|133|7.9|268|classic|dc2626|FWD
Peugeot|508 PSE|2024|145|7.4|355|classic|16a34a|AWD
Peugeot|405 Mi16|1992|118|8.5|160|retro|9333ea|FWD
Peugeot|3008 GT|2024|105|8.1|222|suv|f97316|FWD
Peugeot|RCZ R|2015|134|7.9|270|racer|eab308|FWD
Renault|Clio RS 182|2005|121|8.4|180|retro|9333ea|FWD
Renault|Megane R.S. 300|2020|138|7.7|300|racer|f97316|FWD
Renault|Alpine A110 R|2024|138|7.7|300|gt|eab308|RWD
Renault|Twingo GT|2019|111|8.7|110|classic|64748b|FWD
Renault|Zoe E-Tech|2024|115|8.6|135|classic|1f2937|FWD
Alfa Romeo|Giulietta QV|2020|129|8.0|240|classic|065f46|FWD
Alfa Romeo|Brera|2010|132|7.9|260|gt|f59e0b|AWD
Alfa Romeo|159 GTA|2010|132|7.9|260|classic|7f1d1d|FWD
Alfa Romeo|Tonale Veloce|2024|113|7.8|280|suv|111827|AWD
Alfa Romeo|Giulia QV|2024|166|6.6|505|classic|374151|RWD
Maserati|Quattroporte Trofeo|2024|177|6.2|580|limo|f97316|RWD
Maserati|Levante Trofeo|2024|155|6.2|580|suv|eab308|AWD
Maserati|GranTurismo Folgore|2024|200|5.3|751|gt|64748b|AWD
Maserati|Bora|1975|139|7.7|310|retro|1f2937|RWD
Maserati|Merak|1983|122|8.3|190|retro|b91c1c|RWD
Lexus|LC500|2024|161|6.8|471|gt|f59e0b|RWD
Lexus|GS F|2020|161|6.8|467|classic|7f1d1d|RWD
Lexus|IS F|2014|154|7.1|416|classic|111827|RWD
Lexus|UX F Sport|2024|99|8.3|181|suv|374151|AWD
Lexus|LX600|2024|131|7.1|409|suv|0ea5e9|AWD
Acura|TLX Type S|2024|145|7.4|355|classic|f97316|AWD
Acura|MDX Type S|2024|123|7.4|355|suv|eab308|AWD
Acura|RSX Type S|2006|125|8.2|210|retro|64748b|FWD
Acura|RDX A-Spec|2024|112|7.9|272|suv|1f2937|AWD
Acura|ZDX Type S|2024|143|6.7|500|suv|b91c1c|AWD
Infiniti|QX80|2024|136|6.9|450|suv|b91c1c|AWD
Infiniti|QX55|2024|111|7.9|268|suv|1e3a8a|AWD
Infiniti|G37 IPL|2013|144|7.5|348|retro|065f46|RWD
Infiniti|M56|2013|154|7.1|420|limo|f59e0b|RWD
Infiniti|Q50 Eau Rouge|2014|174|6.4|560|classic|7f1d1d|AWD
Cadillac|CT4-V Blackwing|2024|162|6.8|472|muscle|b91c1c|RWD
Cadillac|XT6 Sport|2024|117|7.7|310|suv|1e3a8a|AWD
Cadillac|Lyriq-V|2025|159|6.1|615|suv|065f46|AWD
Cadillac|Eldorado|1976|122|8.3|190|retro|f59e0b|FWD
Cadillac|CTS-V|2019|185|5.9|640|muscle|7f1d1d|RWD
Shelby|GT350R|2020|169|6.5|526|muscle|1f2937|RWD
Shelby|GT500KR|2022|221|4.6|900|muscle|b91c1c|RWD
Shelby|Cobra Daytona|1965|150|7.2|390|retro|1e3a8a|RWD
Shelby|Mustang Super Snake|2024|211|5.0|825|muscle|065f46|RWD
Shelby|Series 1|2015|158|6.9|450|super|f59e0b|RWD
Genesis|G80 3.5T|2024|148|7.3|375|classic|eab308|AWD
Genesis|G90|2024|153|7.1|409|limo|64748b|AWD
Genesis|GV70 3.5T|2024|126|7.3|375|suv|1f2937|AWD
Genesis|GV80|2024|126|7.3|375|suv|b91c1c|AWD
Genesis|G70 Shooting Brake|2024|131|8.0|252|wagon|1e3a8a|AWD
Polestar|Polestar 3|2024|146|6.6|517|suv|1e3a8a|AWD
Polestar|Polestar 4|2024|150|6.4|544|suv|065f46|AWD
Polestar|Polestar 6|2026|217|4.7|874|roadster|f59e0b|AWD
Polestar|Polestar 2 BST 270|2024|162|6.8|476|classic|7f1d1d|AWD
Polestar|Polestar 5|2025|217|4.7|872|gt|111827|AWD
BYD|Seal U|2024|148|6.5|530|suv|eab308|AWD
BYD|Han DM-i|2024|167|6.6|510|classic|64748b|FWD
BYD|Tang EV|2024|146|6.6|517|suv|1f2937|AWD
BYD|Atto 3|2024|102|8.2|201|suv|b91c1c|FWD
BYD|Yangwang U9|2025|275|2.5|1287|super|1e3a8a|AWD
Nio|ET7|2024|185|5.9|644|limo|dc2626|AWD
Nio|ET9|2025|193|5.6|697|limo|16a34a|AWD
Nio|ES8|2024|163|5.9|644|suv|9333ea|AWD
Nio|EP9|2019|282|2.2|1341|super|f97316|AWD
Nio|EC6|2024|142|6.7|489|suv|eab308|AWD
Xiaomi|SU7|2024|138|7.7|299|gt|1f2937|RWD
Xiaomi|SU7 Pro|2024|152|7.2|400|gt|b91c1c|RWD
Xiaomi|SU7 Max|2024|189|5.8|673|gt|1e3a8a|AWD
Xiaomi|YU7|2025|169|5.7|681|suv|065f46|AWD
Xiaomi|SU7 Ultra|2025|300|2.0|1548|super|f59e0b|AWD
Pininfarina|Battista|2024|300|2.0|1900|super|16a34a|AWD
Pininfarina|Battista Anniversario|2022|300|2.0|1900|super|9333ea|AWD
Pininfarina|B95|2025|300|2.0|1900|roadster|f97316|AWD
Pininfarina|Pura Vision|2025|213|4.0|1000|suv|eab308|AWD
Pininfarina|Sergio|2015|173|6.4|557|roadster|64748b|RWD
Hennessey|Venom F5|2024|300|2.0|1817|super|b91c1c|RWD
Hennessey|Venom GT|2016|269|2.8|1244|super|1e3a8a|RWD
Hennessey|Exorcist|2023|235|4.0|1000|muscle|065f46|RWD
Hennessey|Mammoth 1000|2024|215|4.0|1012|truck|f59e0b|4WD
Hennessey|VelociRaptor|2024|157|6.1|600|truck|7f1d1d|4WD
SSC|Tuatara|2023|300|2.0|1750|super|0ea5e9|RWD
SSC|Ultimate Aero|2009|275|2.5|1287|super|dc2626|RWD
SSC|Tuatara Striker|2024|300|2.0|1750|super|16a34a|RWD
SSC|Tuatara Aggressor|2024|300|2.0|1750|racer|9333ea|RWD
SSC|Ultimate Aero TT|2007|260|3.1|1183|super|f97316|RWD
Zenvo|TSR-S|2023|259|3.1|1177|super|7f1d1d|RWD
Zenvo|ST1|2018|249|3.5|1104|super|111827|RWD
Zenvo|Aurora|2025|300|2.0|1850|super|374151|AWD
Zenvo|TSR|2020|259|3.1|1177|super|0ea5e9|RWD
Zenvo|ST1 Powertrain|2019|249|3.5|1104|racer|dc2626|RWD
Apollo|IE|2019|206|5.1|791|super|1f2937|RWD
Apollo|Intensa Emozione|2020|206|5.1|791|super|b91c1c|RWD
Apollo|Evo|2024|207|5.1|800|super|1e3a8a|RWD
Apollo|Project Evo|2025|207|5.1|800|racer|065f46|RWD
Apollo|Arrow|2025|235|4.0|1000|super|f59e0b|RWD
Noble|M600|2018|186|5.9|650|super|b91c1c|RWD
Noble|M500|2014|165|6.7|500|super|1e3a8a|RWD
Noble|M12|2009|186|5.9|650|super|065f46|RWD
Noble|M400|2012|152|7.2|400|racer|f59e0b|RWD
Noble|M600 Speedster|2019|186|5.9|650|roadster|7f1d1d|RWD
Caterham|Seven 620R|2024|139|7.7|310|racer|16a34a|RWD
Caterham|Seven 420|2024|121|8.4|180|roadster|9333ea|RWD
Caterham|Seven 170|2024|108|8.9|84|classic|f97316|RWD
Caterham|Super Seven|2000|115|8.6|140|retro|eab308|RWD
Caterham|Seven CSR|2010|132|7.9|260|racer|64748b|RWD
Morgan|Plus Six|2024|143|7.5|335|roadster|f97316|RWD
Morgan|Plus Four|2024|132|7.9|258|roadster|eab308|RWD
Morgan|Aero 8|2018|147|7.4|367|roadster|64748b|RWD
Morgan|3 Wheeler|2020|107|8.9|82|retro|1f2937|RWD
Morgan|Super 3|2024|112|8.7|118|retro|b91c1c|RWD
TVR|Griffith|2019|165|6.7|500|roadster|f97316|RWD
TVR|Sagaris|2006|152|7.2|406|super|eab308|RWD
TVR|Tuscan Speed Six|2005|145|7.5|350|roadster|64748b|RWD
TVR|Cerbera Speed 12|2000|207|5.1|800|super|1f2937|RWD
TVR|Chimaera|1996|143|7.5|340|retro|b91c1c|RWD
De Tomaso|P72|2025|193|5.6|700|super|065f46|RWD
De Tomaso|Pantera|1974|142|7.6|330|retro|f59e0b|RWD
De Tomaso|Mangusta|1970|128|8.1|230|retro|7f1d1d|RWD
De Tomaso|Guara|1993|135|7.8|280|retro|111827|RWD
De Tomaso|Vallelunga|1966|117|8.5|150|retro|374151|RWD`;
const CAR_CATALOG = CAR_DATA.trim().split('\n').map(function (line, index) {
    var p = line.split('|');
    var top = Number(p[3]), zero = Number(p[4]), hp = Number(p[5]);
    var raw = 600 + Math.pow(Math.max(0, top - 80), 1.35) * 9 + hp * 7 + Math.max(0, 7 - zero) * 500;
    var price = Math.max(1500, Math.round(raw * 3 / 100) * 100);
    return {
        id: 'car_' + ('00' + (index + 1)).slice(-3),
        brand: p[0],
        model: p[1],
        year: Number(p[2]),
        topSpeed: top,
        zeroTo60: zero,
        hp: hp,
        style: p[6],
        color: '#' + p[7],
        threeColor: parseInt(p[7], 16),
        drivetrain: p[8],
        price: price,
        tier: price >= 60000 ? 'Hypercar' : price >= 30000 ? 'Supercar' : price >= 15000 ? 'Performance' : 'Sport'
    };
});

// Bodies and engines are real performance parts. Values are multipliers applied
// on top of the racer's 120 m/s stock top speed and 18 m/s² stock acceleration.
const BODY_PERF = {
    classic:  { top: 1.00, accel: 1.00, grip: 1.00 },
    buggy:    { top: 0.98, accel: 1.14, grip: 1.18 },
    wagon:    { top: 1.02, accel: 1.00, grip: 1.06 },
    truck:    { top: 0.96, accel: 1.04, grip: 1.12 },
    racer:    { top: 1.16, accel: 1.14, grip: 1.18 },
    van:      { top: 0.94, accel: 1.02, grip: 1.08 },
    roadster: { top: 1.08, accel: 1.06, grip: 1.10 },
    muscle:   { top: 1.10, accel: 1.22, grip: 0.98 },
    limo:     { top: 0.98, accel: 1.06, grip: 1.10 },
    cyber:    { top: 1.22, accel: 1.28, grip: 1.12 },
    retro:    { top: 1.04, accel: 1.10, grip: 1.06 },
    taxi:     { top: 1.02, accel: 1.04, grip: 1.10 },
    monster:  { top: 0.96, accel: 1.10, grip: 1.24 },
    phantom:  { top: 1.32, accel: 1.34, grip: 1.20 },
    f1:       { top: 1.48, accel: 1.52, grip: 1.34 },
    bus:      { top: 0.90, accel: 0.92, grip: 0.96 },
    gt:       { top: 1.36, accel: 1.38, grip: 1.24 },
    super:    { top: 1.42, accel: 1.46, grip: 1.27 },
    offroad:  { top: 0.98, accel: 1.14, grip: 1.28 },
    beater:   { top: 0.82, accel: 0.84, grip: 0.90 },
    suv:      { top: 0.95, accel: 1.02, grip: 1.12 }
};

const AERO_PERF = {
    stock:    { top: 1.00, accel: 1.00, grip: 1.00 },
    broken:   { top: 0.90, accel: 0.95, grip: 0.82 },
    splitter: { top: 1.03, accel: 1.00, grip: 1.05 },
    wing:     { top: 1.01, accel: 1.00, grip: 1.10 },
    diffuser: { top: 1.02, accel: 1.03, grip: 1.08 },
    gt3:      { top: 1.10, accel: 1.08, grip: 1.22 },
    ground:   { top: 1.12, accel: 1.10, grip: 1.24 },
    active:   { top: 1.08, accel: 1.06, grip: 1.18 }
};

const KIT_PERF = {
    stock:    { top: 1.00, accel: 1.00, grip: 1.00 },
    rust:     { top: 0.90, accel: 0.92, grip: 0.84 },
    widebody: { top: 1.02, accel: 1.00, grip: 1.12 },
    track:    { top: 1.05, accel: 1.06, grip: 1.09 },
    rally:    { top: 1.00, accel: 1.08, grip: 1.16 },
    gt3:      { top: 1.10, accel: 1.12, grip: 1.15 },
    offroad:  { top: 1.02, accel: 1.06, grip: 1.24 },
    hyper:    { top: 1.09, accel: 1.10, grip: 1.20 }
};

const ENGINE_PERF = {
    stock:    { top: 1.00, accel: 1.00 },
    v8:       { top: 1.08, accel: 1.16 },
    turbo:    { top: 1.12, accel: 1.10 },
    electric: { top: 1.10, accel: 1.30 },
    diesel:   { top: 1.06, accel: 1.14 },
    twin:     { top: 1.10, accel: 1.12 },
    hybrid:   { top: 1.08, accel: 1.14 },
    jet:      { top: 1.24, accel: 1.30 },
    rocket:   { top: 1.34, accel: 1.40 },
    quantum:  { top: 1.44, accel: 1.50 },
    solar:    { top: 1.28, accel: 1.16 },
    nitro:    { top: 1.50, accel: 1.55 },
    hyper:    { top: 1.60, accel: 1.68 },
    fusion:   { top: 1.74, accel: 1.82 },
    lawnmower:{ top: 0.70, accel: 0.74 },
    v16:      { top: 1.56, accel: 1.62 },
    plasma:   { top: 1.68, accel: 1.76 }
};

const COSMETIC_CATEGORIES = [
    { type: 'theme', label: 'Global Themes', blurb: 'Accent colours for the whole app, HUD, and every game.' },
    { type: 'frame', label: 'Avatar Frames', blurb: 'Profile ring colours that appear everywhere your avatar is shown.' },
    { type: 'paint', label: 'Car Paints', blurb: 'Body colours for your beach buggy.' },
    { type: 'body', label: 'Car Bodies', blurb: 'Real handling parts. Every body changes top speed, acceleration, and grip.' },
    { type: 'engine', label: 'Engines', blurb: 'Real power. Every engine changes top speed and acceleration.' },
    { type: 'aero', label: 'Aero Parts', blurb: 'Splitters, wings, and diffusers that add real grip and top speed.' },
    { type: 'kit', label: 'Body Kits', blurb: 'Widebody and track kits that change acceleration and grip.' },
    { type: 'board', label: 'Surfboards', blurb: 'Roof boards that ride along with you.' },
    { type: 'wheel', label: 'Wheels', blurb: 'Rims that pop against the sand.' },
    { type: 'trail', label: 'Exhaust Trails', blurb: 'Glowing streaks behind the rear bumper.' },
    { type: 'umbrella', label: 'Beach Umbrellas', blurb: 'Dress the whole shoreline in one colour.' }
];

const COSMETIC_TYPES = COSMETIC_CATEGORIES.map(function (category) { return category.type; });
const GLOBAL_COSMETIC_TYPES = ['theme', 'frame'];
const GARAGE_COSMETIC_TYPES = ['paint', 'body', 'engine', 'aero', 'kit', 'board', 'wheel', 'trail', 'umbrella'];

let wallet = null;
let walletLoadToken = 0;
let walletMutated = false;
let storeStatusTimer = 0;
let lastRunCoins = 0;
let soundSetting = true;
let unitSetting = 'mph';
try {
    soundSetting = localStorage.getItem('lessfun_sound') !== 'false';
    unitSetting = localStorage.getItem('lessfun_units') === 'kmh' ? 'kmh' : 'mph';
} catch (e) {}

function shellIcon(size) {
    var s = size || 16;
    return '<svg class="shell-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c5.2 0 9 3.4 9 7.6 0 2.1-1.8 3.9-3.9 3.9H6.9C4.8 14.5 3 12.7 3 10.6 3 6.4 6.8 3 12 3Z"/><path d="M12 3v11.5M6.6 5.2 9.2 14M17.4 5.2 14.8 14"/></svg>';
}

function walletUsername() {
    return (currentUser && currentUser.type === 'user' && currentUser.username) ? currentUser.username : 'guest';
}

function walletStorageKey(username) {
    return WALLET_STORAGE_PREFIX + String(username || 'guest').toLowerCase();
}

function readLocalWallet(username) {
    try {
        var raw = localStorage.getItem(walletStorageKey(username));
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeLocalWallet(w) {
    if (!w) return;
    try { localStorage.setItem(walletStorageKey(w.username), JSON.stringify(w)); } catch (e) {}
}

function walletSyncExtras(w) {
    return {
        cars: Array.isArray(w.cars) ? w.cars.slice() : [],
        equippedCar: typeof w.equippedCar === 'string' ? w.equippedCar : null,
        xp: Number(w.xp) || 0,
        achievements: Array.isArray(w.achievements) ? w.achievements.slice() : [],
        stats: (w.stats && typeof w.stats === 'object') ? w.stats : {},
        zombie: (w.zombie && typeof w.zombie === 'object') ? w.zombie : null,
        gift: (w.gift && typeof w.gift === 'object') ? w.gift : null,
        advent: (w.advent && typeof w.advent === 'object') ? w.advent : null
    };
}

function walletEquippedForDb(w) {
    var equipped = Object.assign({}, (w && w.equipped) || {});
    equipped._purchases = walletSyncExtras(w || {});
    return equipped;
}

function normalizeWallet(raw, username) {
    var w = raw || {};
    var inventory = Array.isArray(w.inventory) ? w.inventory.slice() : [];
    var equipped = Object.assign({}, w.equipped || {});
    // Purchases travel inside the existing equipped JSON so they sync even on
    // older wallets tables that do not have cars/achievements columns.
    var extras = (equipped._purchases && typeof equipped._purchases === 'object') ? equipped._purchases : {};
    delete equipped._purchases;

    COSMETICS.forEach(function (item) {
        if (item.default || item.cost === 0) {
            if (inventory.indexOf(item.id) < 0) inventory.push(item.id);
            if (item.default && !equipped[item.type]) equipped[item.type] = item.id;
        }
    });

    COSMETIC_TYPES.forEach(function (type) {
        var current = equipped[type];
        var valid = COSMETICS.some(function (item) {
            return item.id === current && item.type === type && inventory.indexOf(item.id) >= 0;
        });
        if (!valid) {
            var fallback = COSMETICS.find(function (item) { return item.type === type && item.default; });
            equipped[type] = fallback ? fallback.id : null;
        }
    });

    // Union the optional columns with the equipped JSON copy. A freshly added
    // empty cars/achievements column must not hide purchases saved in the blob.
    var carSource = (Array.isArray(w.cars) ? w.cars : []).slice();
    (Array.isArray(extras.cars) ? extras.cars : []).forEach(function (id) {
        if (carSource.indexOf(id) < 0) carSource.push(id);
    });
    var ownedCars = carSource.filter(function (id) {
        return typeof id === 'string' && CAR_CATALOG.some(function (car) { return car.id === id; });
    });
    var equippedCarId = typeof w.equippedCar === 'string' ? w.equippedCar : (typeof extras.equippedCar === 'string' ? extras.equippedCar : null);
    var equippedCar = equippedCarId && ownedCars.indexOf(equippedCarId) >= 0 ? equippedCarId : null;
    var xpSource = Math.max(Number(w.xp) || 0, Number(extras.xp) || 0);
    var achSource = (Array.isArray(w.achievements) ? w.achievements : []).slice();
    (Array.isArray(extras.achievements) ? extras.achievements : []).forEach(function (id) {
        if (achSource.indexOf(id) < 0) achSource.push(id);
    });
    var statsSource = Object.assign({}, (extras.stats && typeof extras.stats === 'object') ? extras.stats : {}, (w.stats && typeof w.stats === 'object') ? w.stats : {});
    var zombieSource = (w.zombie && typeof w.zombie === 'object') ? w.zombie : ((extras.zombie && typeof extras.zombie === 'object') ? extras.zombie : null);
    var giftSource = (w.gift && typeof w.gift === 'object') ? w.gift : ((extras.gift && typeof extras.gift === 'object') ? extras.gift : {});
    var giftClaim = typeof giftSource.lastClaim === 'string' ? giftSource.lastClaim : '';
    var giftStreak = Number.isFinite(giftSource.streak) ? Math.max(0, Math.floor(giftSource.streak)) : 0;
    var adventSource = (w.advent && typeof w.advent === 'object') ? w.advent : ((extras.advent && typeof extras.advent === 'object') ? extras.advent : {});
    var adventYear = Number.isFinite(adventSource.year) ? Math.floor(adventSource.year) : 0;
    var adventDays = Array.isArray(adventSource.days) ? adventSource.days.filter(function (d) { return Number.isFinite(d) && d >= 1 && d <= 24; }).map(function (d) { return Math.floor(d); }) : [];

    return {
        username: username,
        shells: Number.isFinite(w.shells) ? Math.max(0, Math.floor(w.shells)) : SHELLS_START,
        inventory: inventory,
        equipped: equipped,
        cars: ownedCars,
        equippedCar: equippedCar,
        xp: Number.isFinite(xpSource) ? Math.max(0, Math.floor(xpSource)) : 0,
        achievements: achSource.filter(function (id) { return typeof id === 'string'; }),
        stats: statsSource,
        zombie: zombieSource,
        gift: { lastClaim: giftClaim, streak: giftStreak },
        advent: { year: adventYear, days: adventDays },
        streak: Number.isFinite(w.streak) ? Math.max(0, Math.floor(w.streak)) : 0,
        lastPlayDay: typeof w.lastPlayDay === 'string' ? w.lastPlayDay : (typeof w.last_play_day === 'string' ? w.last_play_day : null),
        streakRewards: Array.isArray(w.streakRewards) ? w.streakRewards : (Array.isArray(w.streak_rewards) ? w.streak_rewards : []),
        totalEarned: Number.isFinite(w.totalEarned) ? w.totalEarned : (Number.isFinite(w.total_earned) ? w.total_earned : 0),
        updatedAt: Number.isFinite(w.updatedAt) ? w.updatedAt : (w.updated_at ? (Date.parse(w.updated_at) || 0) : 0)
    };
}

async function loadWallet() {
    var username = walletUsername();
    var token = ++walletLoadToken;
    walletMutated = false;

    var local = normalizeWallet(readLocalWallet(username), username);
    wallet = local;
    renderWalletUI();

    if (!(currentUser && currentUser.type === 'user' && supabaseClient)) {
        walletRealtimeStop();
        return;
    }
    walletRealtimeStart(username);

    try {
        var res = await supabaseClient
            .from('wallets')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (token !== walletLoadToken) return;

        if (!res.error && res.data) {
            var remote = normalizeWallet(res.data, username);
            // The car collection may live only in localStorage if the wallets
            // table has no cars/equipped_car columns. Merge both sides so a
            // bought or equipped showroom car never disappears on refresh.
            var changed = false;
            var mergedCars = (remote.cars || []).slice();
            (local.cars || []).forEach(function (id) {
                if (mergedCars.indexOf(id) < 0) { mergedCars.push(id); changed = true; }
            });
            remote.cars = mergedCars;
            var mergedInv = (remote.inventory || []).slice();
            (local.inventory || []).forEach(function (id) {
                if (mergedInv.indexOf(id) < 0) { mergedInv.push(id); changed = true; }
            });
            remote.inventory = mergedInv;
            if (remote.equippedCar && mergedCars.indexOf(remote.equippedCar) < 0) remote.equippedCar = null;
            if (!remote.equippedCar && local.equippedCar && mergedCars.indexOf(local.equippedCar) >= 0) {
                remote.equippedCar = local.equippedCar; changed = true;
            }
            var mergedXp = Math.max(remote.xp || 0, local.xp || 0);
            if (mergedXp !== (remote.xp || 0)) changed = true;
            remote.xp = mergedXp;
            var mergedAch = (remote.achievements || []).slice();
            (local.achievements || []).forEach(function (id) { if (mergedAch.indexOf(id) < 0) { mergedAch.push(id); changed = true; } });
            remote.achievements = mergedAch;
            var mergedStats = Object.assign({}, remote.stats || {});
            Object.keys(local.stats || {}).forEach(function (key) {
                var a = Number(mergedStats[key]) || 0;
                var b = Number(local.stats[key]) || 0;
                if (b > a) { mergedStats[key] = b; changed = true; }
            });
            remote.stats = mergedStats;
            if (!remote.zombie && local.zombie) { remote.zombie = local.zombie; changed = true; }
            if ((local.gift.lastClaim || '') > (remote.gift.lastClaim || '') ||
                ((local.gift.lastClaim || '') === (remote.gift.lastClaim || '') && (local.gift.streak || 0) > (remote.gift.streak || 0))) {
                remote.gift = local.gift;
                changed = true;
            }
            local.gift = remote.gift;
            var mergedAdventDays = (remote.advent.days || []).slice();
            (local.advent.days || []).forEach(function (d) {
                if (mergedAdventDays.indexOf(d) < 0) { mergedAdventDays.push(d); changed = true; }
            });
            if (local.advent.year > remote.advent.year) {
                remote.advent = { year: local.advent.year, days: mergedAdventDays };
                changed = true;
            } else if (remote.advent.year === local.advent.year) {
                remote.advent.days = mergedAdventDays;
            }
            local.advent = remote.advent;
            var localNewer = local.updatedAt > remote.updatedAt;
            if (localNewer) {
                // An offline or in-flight purchase on this device wins.
                remote.shells = local.shells;
                remote.totalEarned = Math.max(remote.totalEarned || 0, local.totalEarned || 0);
                remote.streak = local.streak;
                remote.lastPlayDay = local.lastPlayDay;
                remote.streakRewards = local.streakRewards;
                remote.equipped = Object.assign({}, local.equipped);
                if (local.equippedCar && mergedCars.indexOf(local.equippedCar) >= 0) remote.equippedCar = local.equippedCar;
                if (local.zombie) remote.zombie = local.zombie;
                COSMETIC_TYPES.forEach(function (type) {
                    var cur = remote.equipped[type];
                    if (!COSMETICS.some(function (item) { return item.id === cur && item.type === type && mergedInv.indexOf(item.id) >= 0; })) {
                        var fb = COSMETICS.find(function (item) { return item.type === type && item.default; });
                        remote.equipped[type] = fb ? fb.id : null;
                    }
                });
            }
            local.inventory = mergedInv;
            local.cars = mergedCars;
            local.xp = mergedXp;
            local.achievements = mergedAch;
            local.stats = mergedStats;
            local.zombie = remote.zombie || local.zombie || null;
            if (walletMutated || localNewer || changed) {
                wallet = remote;
                await saveWallet();
            } else {
                wallet = remote;
                writeLocalWallet(wallet);
            }
        } else if (!res.error && !res.data && !walletMutated) {
            await supabaseClient.from('wallets').insert({
                username: username,
                shells: wallet.shells,
                inventory: wallet.inventory,
                equipped: walletEquippedForDb(wallet),
                streak: wallet.streak,
                last_play_day: wallet.lastPlayDay,
                streak_rewards: wallet.streakRewards,
                total_earned: wallet.totalEarned
            });
        }
    } catch (e) {
        // The wallets table may not exist yet. The local wallet keeps working.
    }

    if (token === walletLoadToken) {
        renderWalletUI();
        var storeView = document.getElementById('storeView');
        if (storeView && storeView.style.display !== 'none') renderStore();
    }
}

async function saveWallet() {
    if (!wallet) return;
    walletMutated = true;
    wallet.updatedAt = Date.now();
    writeLocalWallet(wallet);
    renderWalletUI();

    if (!(currentUser && currentUser.type === 'user' && supabaseClient)) return;

    try {
        await supabaseClient.from('wallets').upsert({
            username: wallet.username,
            shells: wallet.shells,
            inventory: wallet.inventory,
            equipped: walletEquippedForDb(wallet),
            streak: wallet.streak,
            last_play_day: wallet.lastPlayDay,
            streak_rewards: wallet.streakRewards,
            total_earned: wallet.totalEarned,
            updated_at: new Date(wallet.updatedAt).toISOString()
        }, { onConflict: 'username' });
        // Car collection columns are optional. Try them separately so an older
        // wallets table without them still syncs cosmetics normally.
        await supabaseClient.from('wallets').update({
            cars: wallet.cars || [],
            equipped_car: wallet.equippedCar || null,
            xp: wallet.xp || 0,
            achievements: wallet.achievements || [],
            stats: wallet.stats || {}
        }).eq('username', wallet.username);
    } catch (e) {
        // Offline or table missing: localStorage remains the source of truth.
    }
    walletBroadcast(wallet.username);
}


let walletRealtimeChannel = null;
let walletRealtimeUser = '';
let walletRealtimeReady = false;
let walletReloadTimer = 0;
let walletClientId = 'wc-' + Math.random().toString(36).slice(2, 10);

function walletRealtimeStart(username) {
    var key = String(username || '').toLowerCase();
    if (!supabaseClient || !key || key === 'guest') return;
    if (walletRealtimeChannel && walletRealtimeUser === key) return;
    walletRealtimeStop();
    try {
        var channel = supabaseClient.channel('lessfun-wallet-' + key);
        channel.on('broadcast', { event: 'wallet-changed' }, function (msg) {
            var payload = (msg && msg.payload) || {};
            if (payload.from === walletClientId) return;
            if (payload.username && String(payload.username).toLowerCase() !== key) return;
            if (walletReloadTimer) clearTimeout(walletReloadTimer);
            walletReloadTimer = setTimeout(function () {
                walletReloadTimer = 0;
                if (currentUser && currentUser.type === 'user' && String(currentUser.username).toLowerCase() === key) loadWallet();
            }, 400);
        });
        channel.subscribe(function (status) {
            walletRealtimeReady = status === 'SUBSCRIBED';
        });
        walletRealtimeChannel = channel;
        walletRealtimeUser = key;
    } catch (e) {}
}

function walletRealtimeStop() {
    walletRealtimeReady = false;
    if (walletReloadTimer) { clearTimeout(walletReloadTimer); walletReloadTimer = 0; }
    if (walletRealtimeChannel && supabaseClient) {
        try { supabaseClient.removeChannel(walletRealtimeChannel); } catch (e) {}
    }
    walletRealtimeChannel = null;
    walletRealtimeUser = '';
}

function walletBroadcast(username) {
    if (!walletRealtimeChannel || !walletRealtimeReady) return;
    try {
        var sent = walletRealtimeChannel.send({
            type: 'broadcast',
            event: 'wallet-changed',
            payload: { username: username || walletUsername(), from: walletClientId, at: Date.now() }
        });
        if (sent && sent.catch) sent.catch(function () {});
    } catch (e) {}
}

function applyGlobalCosmetics() {
    const equipped = wallet ? wallet.equipped : {};
    const theme = COSMETICS.find(function (c) { return c.id === equipped.theme; }) ||
        COSMETICS.find(function (c) { return c.type === 'theme' && c.default; });
    const frame = COSMETICS.find(function (c) { return c.id === equipped.frame; });
    const root = document.documentElement;
    if (theme) {
        root.style.setProperty('--theme-accent', theme.color || '#a855f7');
        root.style.setProperty('--theme-accent2', theme.accent2 || '#ec4899');
    }
    const frameOn = !!(frame && !frame.none);
    if (document.body) {
        document.body.classList.toggle('has-avatar-frame', frameOn);
        document.body.classList.toggle('is-rainbow-frame', !!(frameOn && frame.rainbow));
    }
    root.style.setProperty('--frame-color', frameOn ? (frame.color || '#ffd166') : 'transparent');
}

function dailyGiftState() {
    var today = dayKey();
    var gift = (wallet && wallet.gift) || { lastClaim: '', streak: 0 };
    var claimed = gift.lastClaim === today;
    var gap = gift.lastClaim ? dayNumber(today) - dayNumber(gift.lastClaim) : 0;
    var streak;
    if (claimed) streak = Math.max(1, Number(gift.streak) || 1);
    else if (gap === 1) streak = Math.max(1, (Number(gift.streak) || 0) + 1);
    else streak = 1;
    var day = ((streak - 1) % 7) + 1;
    return {
        claimed: claimed,
        streak: streak,
        day: day,
        amount: DAILY_GIFTS[day - 1],
        lastClaim: gift.lastClaim
    };
}

function renderDailyGift() {
    var banner = document.getElementById('dailyGiftBanner');
    if (!banner) return;
    var title = document.getElementById('dailyGiftTitle');
    var sub = document.getElementById('dailyGiftSub');
    var btn = document.getElementById('dailyGiftBtn');
    if (!wallet) {
        if (title) title.textContent = 'Daily gift';
        if (sub) sub.textContent = 'Loading your reward…';
        if (btn) { btn.disabled = true; btn.textContent = 'Loading'; }
        return;
    }
    var st = dailyGiftState();
    banner.classList.toggle('is-claimed', st.claimed);
    if (title) title.textContent = st.claimed ? 'Gift claimed today' : 'Daily gift ready';
    if (sub) {
        sub.textContent = st.claimed
            ? 'Day ' + st.day + ' claimed · ' + st.streak + '-day streak · come back tomorrow'
            : 'Day ' + st.day + ' of 7 · ' + st.amount.toLocaleString() + ' Coins · ' + st.streak + '-day streak';
    }
    if (btn) {
        btn.disabled = st.claimed;
        btn.textContent = st.claimed ? 'Claimed ✓' : 'Claim ' + st.amount.toLocaleString();
    }
}

function openDailyGift() {
    if (!wallet) { showGameToast('Daily gift is still loading.'); return; }
    var modal = document.getElementById('dailyGiftModal');
    if (!modal) return;
    renderDailyGiftModal();
    modal.style.display = 'flex';
}

function closeDailyGift() {
    var modal = document.getElementById('dailyGiftModal');
    if (modal) modal.style.display = 'none';
}

function renderDailyGiftModal() {
    var grid = document.getElementById('dailyGiftGrid');
    if (!grid || !wallet) return;
    var st = dailyGiftState();
    var streakEl = document.getElementById('dailyGiftStreak');
    if (streakEl) streakEl.innerHTML = '<strong>' + st.streak + '-day streak</strong><span>Day ' + st.day + ' of 7</span>';
    grid.innerHTML = DAILY_GIFTS.map(function (amount, index) {
        var day = index + 1;
        var claimed = st.claimed ? day <= st.day : day < st.day;
        var current = day === st.day && !st.claimed;
        var cls = 'daily-gift-tile' + (claimed ? ' is-claimed' : '') + (current ? ' is-current' : '');
        return '<div class="' + cls + '">' +
            '<span>DAY ' + day + '</span>' +
            '<strong>' + amount.toLocaleString() + '</strong>' +
            '<small>Coins</small>' +
            '<i>' + (claimed ? '✓' : (current ? '🎁' : '')) + '</i>' +
        '</div>';
    }).join('');
    var balance = document.getElementById('dailyGiftBalance');
    if (balance) balance.innerHTML = shellIcon(13) + ' ' + wallet.shells.toLocaleString() + ' Coins';
    var claim = document.getElementById('dailyGiftClaim');
    if (claim) {
        claim.disabled = st.claimed;
        claim.textContent = st.claimed ? 'Claimed · come back tomorrow' : 'Claim ' + st.amount.toLocaleString() + ' Coins';
    }
    var note = document.getElementById('dailyGiftNote');
    if (note) {
        if (!currentUser || currentUser.type !== 'user') note.textContent = 'Sign in to keep your gift streak across devices.';
        else note.textContent = st.claimed ? 'Your next gift unlocks at midnight.' : 'Claim today to keep the streak alive.';
    }
}

async function claimDailyGift() {
    if (!wallet) { showGameToast('Daily gift is still loading.'); return; }
    var st = dailyGiftState();
    if (st.claimed) { showGameToast('Your gift is already claimed today.'); return; }
    wallet.gift = { lastClaim: dayKey(), streak: st.streak };
    wallet.shells = Math.max(0, (Number(wallet.shells) || 0) + st.amount);
    wallet.totalEarned = Math.max(0, (Number(wallet.totalEarned) || 0) + st.amount);
    await saveWallet();
    renderWalletUI();
    renderDailyGiftModal();
    var result = document.getElementById('dailyGiftResult');
    if (result) result.textContent = '+' + st.amount.toLocaleString() + ' Coins · ' + st.streak + '-day streak';
    showGameToast('Daily gift · +' + st.amount.toLocaleString() + ' Coins');
}

function adventNow() {
    if (window.__adventTestDate && typeof isOwner === 'function' && isOwner()) return new Date(window.__adventTestDate);
    return new Date();
}

function adventState() {
    var now = adventNow();
    var year = now.getFullYear();
    var month = now.getMonth();
    var day = now.getDate();
    var active = month === 11;
    var claimed = (wallet && wallet.advent && wallet.advent.year === year) ? (wallet.advent.days || []) : [];
    var canClaim = active && day >= 1 && day <= 24 && claimed.indexOf(day) < 0;
    var rewardDay = active ? Math.min(24, Math.max(1, day)) : 1;
    return {
        year: year, month: month, day: active ? day : 0,
        active: active, claimed: claimed, canClaim: canClaim,
        reward: ADVENT_REWARDS[rewardDay - 1]
    };
}

function renderAdventModal() {
    var grid = document.getElementById('adventGrid');
    if (!grid) return;
    var st = adventState();
    var today = document.getElementById('adventToday');
    var status = document.getElementById('adventStatus');
    var claim = document.getElementById('adventClaim');
    if (status) {
        status.textContent = st.active
            ? (st.canClaim ? 'Day ' + st.day + ' is ready — ' + st.reward.coins.toLocaleString() + ' Coins' + (st.reward.item ? ' + a cosmetic' : '') : (st.day > 24 ? 'The calendar is complete. Merry Christmas!' : 'Door ' + st.day + ' already opened.'))
            : 'The Advent Calendar opens on December 1.';
    }
    if (today) today.textContent = st.active ? 'December ' + st.day : 'December';
    grid.innerHTML = ADVENT_REWARDS.map(function (reward, index) {
        var d = index + 1;
        var claimed = st.claimed.indexOf(d) >= 0;
        var isToday = st.active && d === st.day;
        var locked = !st.active || d > st.day;
        var missed = st.active && d < st.day && !claimed;
        var cls = 'advent-door' + (claimed ? ' is-claimed' : '') + (isToday ? ' is-today' : '') + (locked ? ' is-locked' : '') + (missed ? ' is-missed' : '');
        return '<div class="' + cls + '">' +
            '<span>DAY ' + d + '</span>' +
            '<strong>' + reward.coins.toLocaleString() + '</strong>' +
            '<small>Coins</small>' +
            '<i>' + (claimed ? '✓' : (isToday ? '🎁' : (locked ? '🔒' : '•'))) + '</i>' +
        '</div>';
    }).join('');
    var balance = document.getElementById('adventBalance');
    if (balance) balance.innerHTML = shellIcon(13) + ' ' + (wallet ? wallet.shells.toLocaleString() : '—') + ' Coins';
    if (claim) {
        claim.disabled = !st.canClaim;
        claim.textContent = st.canClaim ? 'Open Door ' + st.day : (st.active ? (st.day > 24 ? 'Calendar complete' : 'Come back tomorrow') : 'Opens December 1');
    }
}

function openAdvent() {
    if (!wallet) { showGameToast('Wallet is still loading.'); return; }
    renderAdventModal();
    var modal = document.getElementById('adventModal');
    if (modal) modal.style.display = 'flex';
}

function closeAdvent() {
    var modal = document.getElementById('adventModal');
    if (modal) modal.style.display = 'none';
}

async function claimAdvent() {
    if (!wallet) { showGameToast('Wallet is still loading.'); return; }
    var st = adventState();
    if (!st.canClaim) { showGameToast(st.active ? 'That door is not ready.' : 'The calendar opens in December.'); return; }
    var reward = st.reward;
    wallet.advent = wallet.advent && wallet.advent.year === st.year ? wallet.advent : { year: st.year, days: [] };
    if (wallet.advent.days.indexOf(st.day) < 0) wallet.advent.days.push(st.day);
    wallet.shells = Math.max(0, (Number(wallet.shells) || 0) + reward.coins);
    wallet.totalEarned = Math.max(0, (Number(wallet.totalEarned) || 0) + reward.coins);
    if (reward.item && wallet.inventory.indexOf(reward.item) < 0) wallet.inventory.push(reward.item);
    await saveWallet();
    renderWalletUI();
    renderAdventModal();
    showGameToast('Advent door ' + st.day + ' · +' + reward.coins.toLocaleString() + ' Coins');
}

window.LessFunGetCoins = function () {
    return wallet ? (Number(wallet.shells) || 0) : 0;
};

window.LessFunSpendCoins = function (amount) {
    var cost = Math.max(0, Math.floor(Number(amount) || 0));
    if (!wallet || !cost) return true;
    if ((Number(wallet.shells) || 0) < cost) return false;
    wallet.shells -= cost;
    saveWallet();
    renderWalletUI();
    return true;
};

function renderWalletUI() {
    var shells = wallet ? wallet.shells : SHELLS_START;
    ['navCoins', 'storeCoins', 'garageCoins', 'profileCoinsValue'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = shells.toLocaleString();
    });

    var shopBalance = document.getElementById('g3dShopBalance');
    if (shopBalance) shopBalance.textContent = shells.toLocaleString() + ' Coins';

    var profileCoins = document.getElementById('profileCoins');
    if (profileCoins && wallet && currentUser && currentUser.type === 'user' && currentUser.username === wallet.username) {
        profileCoins.innerHTML = shellIcon(14) + ' <span>' + shells.toLocaleString() + ' Coins</span>';
    }

    var guestNote = document.getElementById('storeGuestNote');
    if (guestNote) {
        guestNote.style.display = (!currentUser || currentUser.type !== 'user') ? 'block' : 'none';
    }
    var garageGuest = document.getElementById('garageGuestNote');
    if (garageGuest) {
        garageGuest.style.display = (!currentUser || currentUser.type !== 'user') ? 'block' : 'none';
    }
    applyGlobalCosmetics();
    renderDailyGift();
}

function getEquippedCar() {
    if (!wallet || !wallet.equippedCar) return null;
    var id = wallet.equippedCar;
    return CAR_CATALOG.find(function (car) { return car.id === id; }) || null;
}

function getEquippedCosmetics() {
    var equipped = wallet ? wallet.equipped : {};
    function chosen(type) {
        return COSMETICS.find(function (c) { return c.id === equipped[type]; }) || null;
    }
    var paint = chosen('paint');
    var body = chosen('body');
    var engine = chosen('engine');
    var aero = chosen('aero');
    var kit = chosen('kit');
    var board = chosen('board');
    var glow = chosen('glow');
    var wheel = chosen('wheel');
    var trail = chosen('trail');
    var umbrella = chosen('umbrella');
    var catalogCar = getEquippedCar();
    var bodyStyle = catalogCar ? catalogCar.style : (body ? body.style : 'beater');
    var bodyPerf = BODY_PERF[bodyStyle] || BODY_PERF.beater;
    if (catalogCar) {
        // The showroom car is the real base car: its published top speed and
        // 0-60 define its performance. Bolt-on engine/aero/kit parts multiply
        // on top, exactly like the stock beater.
        bodyPerf = {
            top: Math.max(0.52, Math.min(1.9, catalogCar.topSpeed / 170)),
            accel: Math.max(0.55, Math.min(2.4, 6.2 / catalogCar.zeroTo60)),
            grip: bodyPerf.grip || 1.0
        };
    }
    // A showroom car is a complete car. The free junk parts must not drag it
    // down, but real performance parts the player bought still stack on top.
    var enginePerf = catalogCar
        ? (engine && engine.cost > 0 ? (ENGINE_PERF[engine.style] || ENGINE_PERF.stock) : { top: 1, accel: 1 })
        : (ENGINE_PERF[engine ? engine.style : 'lawnmower'] || ENGINE_PERF.lawnmower);
    var aeroPerf = catalogCar
        ? (aero && aero.cost > 0 ? (AERO_PERF[aero.style] || AERO_PERF.stock) : { top: 1, accel: 1, grip: 1 })
        : (AERO_PERF[aero ? aero.style : 'broken'] || AERO_PERF.broken);
    var kitPerf = catalogCar
        ? (kit && kit.cost > 0 ? (KIT_PERF[kit.style] || KIT_PERF.stock) : { top: 1, accel: 1, grip: 1 })
        : (KIT_PERF[kit ? kit.style : 'rust'] || KIT_PERF.rust);
    return {
        carId: catalogCar ? catalogCar.id : null,
        paint: catalogCar ? catalogCar.threeColor : (paint ? paint.threeColor : 0x8a6f5a),
        body: bodyStyle,
        bodyColor: catalogCar ? catalogCar.threeColor : (body ? body.threeColor : null),
        topSpeed: catalogCar ? catalogCar.topSpeed : null,
        zeroTo60: catalogCar ? catalogCar.zeroTo60 : null,
        engine: engine ? engine.style : 'lawnmower',
        engineColor: engine ? engine.threeColor : null,
        aeroStyle: aero ? aero.style : 'broken',
        kitStyle: kit ? kit.style : 'rust',
        board: board ? board.threeColor : 0x06d6a0,
        glow: glow && !glow.none ? glow.threeColor : null,
        glowRainbow: !!(glow && glow.rainbow),
        wheel: wheel && !wheel.none ? wheel.threeColor : null,
        wheelRainbow: !!(wheel && wheel.rainbow),
        trail: trail && !trail.none ? trail.threeColor : null,
        trailRainbow: !!(trail && trail.rainbow),
        umbrella: umbrella && !umbrella.none ? umbrella.threeColor : null,
        performance: {
            topSpeed: bodyPerf.top * enginePerf.top * aeroPerf.top * kitPerf.top,
            accel: bodyPerf.accel * enginePerf.accel * aeroPerf.accel * kitPerf.accel,
            grip: bodyPerf.grip * aeroPerf.grip * kitPerf.grip
        }
    };
}

let storeFilter = 'all';
let storeSearch = '';

function cosmeticPreview(item) {
    if (item.type === 'body') {
        return '<div class="cosmetic-body cosmetic-body-' + item.style + '" style="--swatch:' + item.color + '"><span class="cosmetic-body-cabin"></span><span class="cosmetic-body-wheel"></span></div>';
    }
    if (item.type === 'engine') {
        return '<div class="cosmetic-engine cosmetic-engine-' + item.style + '" style="--swatch:' + item.color + '"><span class="cosmetic-engine-core"></span><span class="cosmetic-engine-pipe"></span><span class="cosmetic-engine-pipe is-second"></span></div>';
    }
    if (item.type === 'aero') {
        return '<div class="cosmetic-aero cosmetic-aero-' + item.style + '" style="--swatch:' + item.color + '"><span class="cosmetic-aero-wing"></span></div>';
    }
    if (item.type === 'kit') {
        return '<div class="cosmetic-kit cosmetic-kit-' + item.style + '" style="--swatch:' + item.color + '"><span class="cosmetic-kit-body"></span><span class="cosmetic-kit-skirt"></span></div>';
    }
    if (item.type === 'theme') {
        return '<div class="cosmetic-theme" style="--swatch:' + item.color + ';--swatch2:' + (item.accent2 || item.color) + '"><span></span></div>';
    }
    if (item.type === 'frame') {
        return '<div class="cosmetic-frame' + (item.rainbow ? ' is-rainbow' : '') + (item.none ? ' is-none' : '') + '" style="--swatch:' + item.color + '"><span></span></div>';
    }
    var cls = item.type === 'paint' ? 'cosmetic-car' : 'cosmetic-' + item.type;
    if (item.rainbow) cls += ' is-rainbow';
    if (item.none) cls += ' is-none';
    return '<div class="' + cls + '" style="--swatch:' + item.color + '"></div>';
}

function performanceBadges(item) {
    var perf = item.type === 'body' ? BODY_PERF[item.style]
        : item.type === 'engine' ? ENGINE_PERF[item.style]
        : item.type === 'aero' ? AERO_PERF[item.style]
        : item.type === 'kit' ? KIT_PERF[item.style] : null;
    if (!perf) return '';
    var parts = [['Top', perf.top], ['Accel', perf.accel]];
    if (perf.grip != null) parts.push(['Grip', perf.grip]);
    return '<div class="cosmetic-perf">' + parts.map(function (part) {
        var pct = Math.round((part[1] - 1) * 100);
        var cls = pct > 0 ? 'is-up' : (pct < 0 ? 'is-down' : 'is-zero');
        return '<span class="cosmetic-perf-tag ' + cls + '">' + part[0] + ' ' +
            (pct > 0 ? '+' : '') + pct + '%</span>';
    }).join('') + '</div>';
}

function cosmeticCards(type, queryOverride) {
    var query = String(queryOverride != null ? queryOverride : storeSearch || '').trim().toLowerCase();
    return COSMETICS.filter(function (item) {
        return item.type === type && (!query || item.name.toLowerCase().indexOf(query) >= 0);
    }).map(function (item) {
        var owned = wallet.inventory.indexOf(item.id) >= 0;
        var equipped = wallet.equipped[item.type] === item.id;
        var affordable = wallet.shells >= item.cost;

        var action, cls, disabled = '';
        if (equipped) {
            action = 'Equipped';
            cls = 'equipped';
            disabled = ' disabled';
        } else if (owned) {
            action = 'Equip';
            cls = 'owned';
        } else {
            action = 'Buy · ' + item.cost.toLocaleString();
            cls = affordable ? 'buy' : 'locked';
        }

        var sellPrice = item.cost > 0 ? Math.floor(item.cost * 0.5) : 0;
        var sellBtn = (owned && !item.default && sellPrice > 0)
            ? '<button class="cosmetic-sell" onclick="sellCosmetic(\'' + item.id + '\')">Sell · ' + sellPrice.toLocaleString() + '</button>'
            : '';
        return '<div class="cosmetic-card' + (equipped ? ' is-equipped' : '') + '">' +
            '<div class="cosmetic-preview">' + cosmeticPreview(item) + '</div>' +
            '<h3 class="cosmetic-name">' + escapeHtml(item.name) + '</h3>' +
            performanceBadges(item) +
            '<div class="cosmetic-price">' + (owned ? (equipped ? 'In use' : 'Owned') : shellIcon(13) + ' ' + item.cost.toLocaleString()) + '</div>' +
            '<button class="cosmetic-btn ' + cls + '"' + disabled + ' onclick="handleCosmetic(\'' + item.id + '\')">' + action + '</button>' +
            sellBtn +
        '</div>';
    }).join('');
}

function setStoreFilter(type) {
    storeFilter = type;
    renderStore();
}

function updateStoreSearch(value) {
    storeSearch = value;
    renderStore(true);
}

function storeOwnedCount(type) {
    var items = type === 'all' ? COSMETICS.slice() : COSMETICS.filter(function (item) { return item.type === type; });
    var owned = items.filter(function (item) { return wallet.inventory.indexOf(item.id) >= 0; }).length;
    return { owned: owned, total: items.length };
}

function cosmeticOwnedCountFor(types) {
    var items = COSMETICS.filter(function (item) { return types.indexOf(item.type) >= 0; });
    var owned = items.filter(function (item) { return wallet && wallet.inventory.indexOf(item.id) >= 0; }).length;
    return { owned: owned, total: items.length };
}

function renderStore(refocusSearch) {
    var content = document.getElementById('storeContent');
    if (!content) return;
    if (!wallet) {
        content.innerHTML = '<p class="store-loading">Loading shop…</p>';
        return;
    }

    var globalCategories = COSMETIC_CATEGORIES.filter(function (category) {
        return GLOBAL_COSMETIC_TYPES.indexOf(category.type) >= 0;
    });
    if (storeFilter !== 'all' && GLOBAL_COSMETIC_TYPES.indexOf(storeFilter) < 0) storeFilter = 'all';
    var allCount = cosmeticOwnedCountFor(GLOBAL_COSMETIC_TYPES);
    var tabs = '<button class="store-tab' + (storeFilter === 'all' ? ' active' : '') + '" onclick="setStoreFilter(\'all\')">' +
        'All <span>' + allCount.owned + '/' + allCount.total + '</span></button>';
    tabs += globalCategories.map(function (category) {
        var counts = cosmeticOwnedCountFor([category.type]);
        return '<button class="store-tab' + (storeFilter === category.type ? ' active' : '') + '" onclick="setStoreFilter(\'' + category.type + '\')">' +
            escapeHtml(category.label) + ' <span>' + counts.owned + '/' + counts.total + '</span></button>';
    }).join('');

    var categories = globalCategories.filter(function (category) {
        return storeFilter === 'all' || category.type === storeFilter;
    });

    var sections = categories.map(function (category) {
        var cards = cosmeticCards(category.type);
        if (!cards) return '';
        return '<section class="store-section">' +
            '<div class="store-section-head">' +
                '<h2 class="store-heading">' + escapeHtml(category.label) + '</h2>' +
                '<p class="store-blurb">' + escapeHtml(category.blurb) + '</p>' +
            '</div>' +
            '<div class="cosmetic-grid">' + cards + '</div>' +
        '</section>';
    }).join('');

    content.innerHTML =
        '<div class="store-toolbar">' +
            '<div class="store-tabs">' + tabs + '</div>' +
            '<input type="search" id="storeSearch" class="store-search" placeholder="Search cosmetics…" value="' + escapeHtml(storeSearch) + '" oninput="updateStoreSearch(this.value)">' +
        '</div>' +
        (sections || '<p class="store-empty">No global items match that search.</p>') +
        '<p class="store-note">Global items work across the whole app and every game. Themes recolour the interface and HUD, and avatar frames appear around profile pictures. Beach Racer car parts are sold in the Garage tab.</p>';

    if (refocusSearch) {
        var input = document.getElementById('storeSearch');
        if (input) {
            input.focus();
            try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        }
    }
}

let garageFilter = 'all';
let garageSearch = '';

function renderGarage(refocusSearch) {
    var content = document.getElementById('garageContent');
    if (!content) return;
    if (!wallet) {
        content.innerHTML = '<p class="store-loading">Loading garage…</p>';
        return;
    }
    var garageCategories = COSMETIC_CATEGORIES.filter(function (category) {
        return GARAGE_COSMETIC_TYPES.indexOf(category.type) >= 0;
    });
    if (garageFilter !== 'all' && GARAGE_COSMETIC_TYPES.indexOf(garageFilter) < 0) garageFilter = 'all';
    var allCount = cosmeticOwnedCountFor(GARAGE_COSMETIC_TYPES);
    var tabs = '<button class="store-tab' + (garageFilter === 'all' ? ' active' : '') + '" onclick="setGarageFilter(\'all\')">' +
        'All <span>' + allCount.owned + '/' + allCount.total + '</span></button>';
    tabs += garageCategories.map(function (category) {
        var counts = cosmeticOwnedCountFor([category.type]);
        return '<button class="store-tab' + (garageFilter === category.type ? ' active' : '') + '" onclick="setGarageFilter(\'' + category.type + '\')">' +
            escapeHtml(category.label) + ' <span>' + counts.owned + '/' + counts.total + '</span></button>';
    }).join('');

    var categories = garageCategories.filter(function (category) {
        return garageFilter === 'all' || category.type === garageFilter;
    });

    var sections = categories.map(function (category) {
        var cards = cosmeticCards(category.type, garageSearch);
        if (!cards) return '';
        return '<section class="store-section">' +
            '<div class="store-section-head">' +
                '<h2 class="store-heading">' + escapeHtml(category.label) + '</h2>' +
                '<p class="store-blurb">' + escapeHtml(category.blurb) + '</p>' +
            '</div>' +
            '<div class="cosmetic-grid">' + cards + '</div>' +
        '</section>';
    }).join('');

    content.innerHTML =
        '<div class="store-toolbar">' +
            '<div class="store-tabs">' + tabs + '</div>' +
            '<input type="search" id="garageSearch" class="store-search" placeholder="Search Beach Racer parts…" value="' + escapeHtml(garageSearch) + '" oninput="updateGarageSearch(this.value)">' +
        '</div>' +
        (sections || '<p class="store-empty">No Beach Racer parts match that search.</p>') +
        '<p class="store-note">These parts only affect Beach Racer. Bodies, engines, aero, and kits change real top speed, acceleration, and grip. Paints, boards, glow, wheels, trails, and umbrellas are visual.</p>';

    if (refocusSearch) {
        var input = document.getElementById('garageSearch');
        if (input) {
            input.focus();
            try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        }
    }
}

function setGarageFilter(type) {
    garageFilter = type;
    renderGarage();
}

function updateGarageSearch(value) {
    garageSearch = value;
    renderGarage(true);
}

function flashGarageStatus(message, isError) {
    var el = document.getElementById('garageStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'store-status is-visible ' + (isError ? 'is-error' : 'is-success');
    if (storeStatusTimer) clearTimeout(storeStatusTimer);
    storeStatusTimer = setTimeout(function () { el.className = 'store-status'; }, 3200);
}

function flashShopStatus(message, isError) {
    const shop = document.getElementById('g3dGarageShop');
    if (shop && shop.style.display !== 'none') { flashGarageShopStatus(message, isError); return; }
    if (currentView === 'garage') flashGarageStatus(message, isError);
    else flashStoreStatus(message, isError);
}

function flashStoreStatus(message, isError) {
    var el = document.getElementById('storeStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'store-status is-visible ' + (isError ? 'is-error' : 'is-success');
    if (storeStatusTimer) clearTimeout(storeStatusTimer);
    storeStatusTimer = setTimeout(function () {
        el.className = 'store-status';
    }, 3200);
}

async function creditOwnerCoins(amount) {
    var value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value || !supabaseClient || !currentUser || currentUser.type !== 'user') return false;
    if (currentUser.username === 'TotallyMason') return false;
    try {
        const ownerRes = await supabaseClient.from('wallets').select('shells').eq('username', 'TotallyMason').maybeSingle();
        if (ownerRes.error || !ownerRes.data) return false;
        const next = (Number(ownerRes.data.shells) || 0) + value;
        const res = await supabaseClient.from('wallets').update({ shells: next }).eq('username', 'TotallyMason');
        return !(res && res.error);
    } catch (e) {
        return false;
    }
}

async function handleCosmetic(id) {
    var item = COSMETICS.find(function (c) { return c.id === id; });
    if (!item || !wallet) return;

    var owned = wallet.inventory.indexOf(item.id) >= 0;
    if (!owned) {
        if (wallet.shells < item.cost) {
            flashShopStatus('Not enough Coins. You need ' + (item.cost - wallet.shells).toLocaleString() + ' more.', true);
            return;
        }
        if (!window.confirm('Buy ' + item.name + ' for ' + item.cost.toLocaleString() + ' Coins?')) return;

        wallet.shells -= item.cost;
        wallet.inventory.push(item.id);
        wallet.equipped[item.type] = item.id;
        await saveWallet();
        const credited = await creditOwnerCoins(item.cost);
        applyGlobalCosmetics();
        renderStore();
        renderGarage();
        renderGarageShop();
        flashShopStatus('Purchased ' + item.name + ' and equipped it.' +
            (credited ? ' ' + item.cost.toLocaleString() + ' Coins went to TotallyMason.' : ''));
        return;
    }

    wallet.equipped[item.type] = item.id;
    await saveWallet();
    applyGlobalCosmetics();
    renderStore();
    renderGarage();
    renderGarageShop();
    flashShopStatus(item.name + ' equipped.');
}

async function sellCosmetic(id) {
    var item = COSMETICS.find(function (c) { return c.id === id; });
    if (!item || !wallet) return;
    if (item.default || item.cost <= 0) {
        flashShopStatus('That item is part of the base kit and cannot be sold.', true);
        return;
    }
    if (wallet.inventory.indexOf(item.id) < 0) return;
    var price = Math.floor(item.cost * 0.5);
    if (!window.confirm('Sell ' + item.name + ' for ' + price.toLocaleString() + ' Coins?\n\nYou can buy it again later.')) return;
    wallet.inventory = wallet.inventory.filter(function (ownedId) { return ownedId !== item.id; });
    if (wallet.equipped[item.type] === item.id) {
        var fallback = COSMETICS.find(function (c) { return c.type === item.type && c.default; });
        if (fallback) wallet.equipped[item.type] = fallback.id;
    }
    wallet.shells += price;
    await saveWallet();
    applyGlobalCosmetics();
    renderStore();
    renderGarage();
    renderGarageShop();
    flashShopStatus('Sold ' + item.name + ' for ' + price.toLocaleString() + ' Coins.');
}


let showroomQuery = '';
let showroomPageIndex = 0;
const SHOWROOM_PER_PAGE = 24;

function showroomResults() {
    var q = String(showroomQuery || '').trim().toLowerCase();
    if (!q) return CAR_CATALOG;
    return CAR_CATALOG.filter(function (car) {
        return (car.brand + ' ' + car.model + ' ' + car.year + ' ' + car.tier + ' ' + car.drivetrain).toLowerCase().indexOf(q) >= 0;
    });
}

function showroomStatus(message, isError) {
    var el = document.getElementById('g3dShowroomStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#ff8a8a' : 'rgba(220,245,255,0.62)';
    if (el._timer) clearTimeout(el._timer);
    el._timer = setTimeout(function () { if (el) el.textContent = ''; }, 4200);
}

function openShowroom() {
    var el = document.getElementById('g3dShowroom');
    if (!el) return;
    if (!wallet) { showroomStatus('Wallet still loading…', true); return; }
    showroomPageIndex = 0;
    el.style.display = 'flex';
    renderShowroom();
}

function closeShowroom() {
    var el = document.getElementById('g3dShowroom');
    if (el) el.style.display = 'none';
}

function updateShowroomSearch(value) {
    showroomQuery = value;
    showroomPageIndex = 0;
    renderShowroom();
}

function showroomPage(dir) {
    var results = showroomResults();
    var pages = Math.max(1, Math.ceil(results.length / SHOWROOM_PER_PAGE));
    showroomPageIndex = Math.max(0, Math.min(pages - 1, showroomPageIndex + dir));
    renderShowroom();
}

function renderShowroom() {
    var grid = document.getElementById('g3dShowroomGrid');
    if (!grid || !wallet) return;
    var results = showroomResults();
    var pages = Math.max(1, Math.ceil(results.length / SHOWROOM_PER_PAGE));
    if (showroomPageIndex >= pages) showroomPageIndex = pages - 1;
    var start = showroomPageIndex * SHOWROOM_PER_PAGE;
    var pageItems = results.slice(start, start + SHOWROOM_PER_PAGE);
    var ownedCars = wallet.cars || [];
    var equippedCar = wallet.equippedCar;

    grid.innerHTML = pageItems.map(function (car) {
        var owned = ownedCars.indexOf(car.id) >= 0;
        var equipped = equippedCar === car.id;
        var affordable = wallet.shells >= car.price;
        var action, cls, disabled = '';
        if (equipped) { action = 'Driving'; cls = 'equipped'; disabled = ' disabled'; }
        else if (owned) { action = 'Drive'; cls = 'owned'; }
        else { action = 'Buy · ' + car.price.toLocaleString(); cls = affordable ? 'buy' : 'locked'; }
        var sellBtn = (owned && !equipped)
            ? '<button class="cosmetic-sell" onclick="sellCar(\'' + car.id + '\')">Sell · ' + Math.floor(car.price * 0.5).toLocaleString() + '</button>'
            : '';
        return '<div class="showroom-card' + (equipped ? ' is-equipped' : '') + '">' +
            '<div class="showroom-thumb" style="--swatch:' + car.color + '">' +
                '<div class="showroom-car" style="--swatch:' + car.color + '"><span></span></div>' +
                '<span class="showroom-tier">' + escapeHtml(car.tier) + '</span>' +
            '</div>' +
            '<div class="showroom-card-body">' +
                '<span class="showroom-brand">' + escapeHtml(car.brand) + ' · ' + car.year + '</span>' +
                '<h3 class="showroom-name">' + escapeHtml(car.model) + '</h3>' +
                '<div class="showroom-specs">' +
                    '<span><b>' + car.topSpeed + '</b> mph</span>' +
                    '<span><b>' + car.zeroTo60.toFixed(1) + 's</b> 0-60</span>' +
                    '<span><b>' + car.hp + '</b> hp</span>' +
                    '<span><b>' + escapeHtml(car.drivetrain) + '</b></span>' +
                '</div>' +
                '<div class="showroom-price">' + (owned ? (equipped ? 'In the garage' : 'Owned') : shellIcon(13) + ' ' + car.price.toLocaleString()) + '</div>' +
                '<button class="cosmetic-btn ' + cls + '"' + disabled + ' onclick="handleCar(\'' + car.id + '\')">' + action + '</button>' +
                sellBtn +
            '</div>' +
        '</div>';
    }).join('') || '<p class="store-empty">No cars match that search. Try another brand or model.</p>';

    var count = document.getElementById('g3dShowroomCount');
    if (count) count.textContent = results.length + ' car' + (results.length === 1 ? '' : 's');
    var pager = document.getElementById('g3dShowroomPage');
    if (pager) pager.textContent = (showroomPageIndex + 1) + ' / ' + pages;
    var balance = document.getElementById('g3dShowroomBalance');
    if (balance) balance.innerHTML = shellIcon(13) + ' ' + wallet.shells.toLocaleString() + ' Coins';
}

async function handleCar(id) {
    var car = CAR_CATALOG.find(function (c) { return c.id === id; });
    if (!car || !wallet) return;
    var owned = (wallet.cars || []).indexOf(car.id) >= 0;
    if (!owned) {
        if (wallet.shells < car.price) {
            showroomStatus('Not enough Coins. You need ' + (car.price - wallet.shells).toLocaleString() + ' more.', true);
            return;
        }
        if (!window.confirm('Buy the ' + car.year + ' ' + car.brand + ' ' + car.model + ' for ' + car.price.toLocaleString() + ' Coins?')) return;
        wallet.shells -= car.price;
        wallet.cars = wallet.cars || [];
        wallet.cars.push(car.id);
        wallet.equippedCar = car.id;
        await saveWallet();
        await creditOwnerCoins(car.price);
        renderShowroom();
        renderWalletUI();
        showroomStatus('Bought the ' + car.brand + ' ' + car.model + ' and set it as your ride.');
        return;
    }
    wallet.equippedCar = car.id;
    await saveWallet();
    renderShowroom();
    showroomStatus(car.brand + ' ' + car.model + ' is now your ride.');
}

async function sellCar(id) {
    var car = CAR_CATALOG.find(function (c) { return c.id === id; });
    if (!car || !wallet) return;
    if ((wallet.cars || []).indexOf(car.id) < 0) return;
    var price = Math.floor(car.price * 0.5);
    if (!window.confirm('Sell the ' + car.brand + ' ' + car.model + ' for ' + price.toLocaleString() + ' Coins?\n\nYou can buy it again later.')) return;
    wallet.cars = wallet.cars.filter(function (ownedId) { return ownedId !== car.id; });
    if (wallet.equippedCar === car.id) wallet.equippedCar = wallet.cars[0] || null;
    wallet.shells += price;
    await saveWallet();
    renderShowroom();
    renderWalletUI();
    showroomStatus('Sold the ' + car.brand + ' ' + car.model + ' for ' + price.toLocaleString() + ' Coins.');
}

function dayKey(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
}

function dayNumber(key) {
    var parts = String(key).split('-');
    if (parts.length !== 3) return NaN;
    return Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / 86400000);
}

async function awardCoins(seconds) {
    var result = { total: 0, base: 0, bonus: 0, messages: [] };
    if (!wallet) return result;

    // 1 Shell per full second of active play. Background tabs and paused
    // frames are already clamped in the game loop, so they do not farm currency.
    var played = Math.max(0, Number(seconds) || 0);
    var base = Math.floor(played);
    if (played > 0 && base < 1) base = 1;
    var multiplier = Number(siteSettings.shells_multiplier);
    if (!isFinite(multiplier) || multiplier < 0) multiplier = 1;
    if (multiplier !== 1) {
        base = Math.floor(base * multiplier);
        if (played > 0 && base < 1 && multiplier > 0) base = 1;
    }
    var bonus = 0;
    var messages = [];
    if (multiplier !== 1) messages.push(multiplier + '× Coins event');
    var today = dayKey();

    if (wallet.lastPlayDay !== today) {
        var previous = wallet.lastPlayDay;
        var streak = 1;
        if (previous) {
            var gap = dayNumber(today) - dayNumber(previous);
            streak = gap === 1 ? (wallet.streak || 0) + 1 : 1;
        }
        wallet.streak = streak;
        wallet.lastPlayDay = today;
        bonus += DAILY_BONUS;
        messages.push('daily +' + DAILY_BONUS);

        var streakBonus = STREAK_BONUSES[streak];
        if (streakBonus && wallet.streakRewards.indexOf(streak) < 0) {
            wallet.streakRewards.push(streak);
            bonus += streakBonus;
            messages.push(streak + '-day streak +' + streakBonus);
        }
    }

    if (base === 0 && bonus === 0) return result;

    var total = base + bonus;
    wallet.shells += total;
    wallet.totalEarned += total;
    await saveWallet();
    renderWalletUI();

    result.total = total;
    result.base = base;
    result.bonus = bonus;
    result.messages = messages;
    return result;
}

function handleGameOver(score, seconds) {
    var over = document.getElementById('g3dOver');
    var fin = document.getElementById('g3dFinal');
    if (fin) fin.textContent = score;
    if (over) over.style.display = 'flex';

    if (currentGameId === 7) {
        try {
            var prevBest = Number(localStorage.getItem('lessfun_snowrush_best')) || 0;
            if (score > prevBest) localStorage.setItem('lessfun_snowrush_best', String(Math.round(score)));
        } catch (e) {}
        renderSnowLeaderboard();
    }
    var trackCoins = lastRunCoins;
    awardCoins(seconds).then(function (result) {
        var el = document.getElementById('g3dEarned');
        if (!el) return;
        var playTotal = (result && result.total > 0) ? result.total : 0;
        if (playTotal <= 0 && trackCoins <= 0) {
            el.style.display = 'none';
            return;
        }
        var parts = [];
        if (playTotal > 0) parts.push('play +' + playTotal);
        if (trackCoins > 0) parts.push('track coins +' + trackCoins);
        if (result && result.messages) {
            for (var i = 0; i < result.messages.length; i++) parts.push(result.messages[i]);
        }
        el.innerHTML = shellIcon(14) + '<span>+' + (playTotal + trackCoins) + ' Coins</span><small>' + parts.join(' · ') + '</small>';
        el.style.display = 'flex';
    });
}

// Pins are stored as a hidden prefix in the post content because the existing
// posts table has no `pinned` column. It is stripped before display.
const PIN_MARKER = '[[PINNED]]';
function isPinnedByContent(content) {
    return typeof content === 'string' && content.indexOf(PIN_MARKER) === 0;
}
function stripPinMarker(content) {
    if (!isPinnedByContent(content)) return content;
    return content.slice(PIN_MARKER.length).replace(/^\s+/, '');
}

function getPinnedIds() {
    try {
        const raw = localStorage.getItem('lessfun_pinned_posts');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) {
        return [];
    }
}

function savePinnedIds(ids) {
    try { localStorage.setItem('lessfun_pinned_posts', JSON.stringify(ids)); } catch (e) {}
}

async function togglePin(id, pinned) {
    if (!isOwner() && !hasAdminPower('manage_posts')) {
        alert('Only the owner or a post admin can pin posts');
        return;
    }
    const next = !pinned;
    if (supabaseClient) {
        try {
            const { data: row } = await supabaseClient
                .from('posts')
                .select('content')
                .eq('id', id)
                .maybeSingle();
            if (row && typeof row.content === 'string') {
                const hasMarker = isPinnedByContent(row.content);
                let content = row.content;
                if (next && !hasMarker) content = PIN_MARKER + content;
                if (!next && hasMarker) content = stripPinMarker(content);
                if (content !== row.content) {
                    const { data, error } = await supabaseClient
                        .from('posts')
                        .update({ content: content })
                        .eq('id', id)
                        .select('id, content');
                    if (!error && data && data.length) {
                        renderCommunity();
                        return;
                    }
                }
            }
        } catch (e) {}
    }
    const ids = getPinnedIds();
    const sid = String(id);
    const idx = ids.indexOf(sid);
    if (next && idx < 0) ids.push(sid);
    if (!next && idx >= 0) ids.splice(idx, 1);
    savePinnedIds(ids);
    renderCommunity();
}
const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '🌊', '🎉'];
let pendingPostMedia = null;

function communityUsername() {
    return friendUsername();
}

function communityPostsOpen() {
    return !!siteSettings.community_open || isOwner();
}

function communityCanModerate(username, kind) {
    const me = communityUsername();
    if (!me) return false;
    if (me === 'TotallyMason' || me === username) return true;
    if (kind === 'post' && hasAdminPower('manage_posts')) return true;
    if (kind === 'reply' && hasAdminPower('manage_replies')) return true;
    return false;
}

function jsArg(value) {
    return escapeAttr(String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' '));
}

function formatBytes(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
}

function safeDataUrl(url) {
    return (typeof url === 'string' && url.indexOf('data:') === 0) ? url : '';
}

function communityMediaHtml(row) {
    const url = safeDataUrl(row.media_url);
    if (!url) return '';
    const name = row.media_name || 'attachment';
    const isImage = String(row.media_type || '').indexOf('image/') === 0;
    if (isImage) {
        return '<div class="post-media-wrap">' +
            '<a class="post-media is-image" href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' +
                '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(name) + '" loading="lazy">' +
            '</a>' +
            '<span class="post-media-caption">' + escapeHtml(name) + ' · ' + escapeHtml(formatBytes(row.media_size)) + '</span>' +
        '</div>';
    }
    return '<a class="post-media is-file" href="' + escapeAttr(url) + '" download="' + escapeAttr(name) + '">' +
        '<span class="post-file-icon">📎</span>' +
        '<span class="post-file-info"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(formatBytes(row.media_size)) + ' · download</small></span>' +
        '<span class="post-file-dl">Save</span>' +
    '</a>';
}

function communityReactionBar(kind, id, rows) {
    if (!siteSettings.allow_reactions) return '';
    const me = communityUsername();
    const counts = {};
    const mine = {};
    (rows || []).forEach(function (row) {
        counts[row.reaction] = (counts[row.reaction] || 0) + 1;
        if (me && String(row.username).toLowerCase() === me.toLowerCase()) mine[row.reaction] = true;
    });
    return '<div class="post-reactions" role="group" aria-label="Reactions">' +
        REACTION_EMOJIS.map(function (emoji) {
            const count = counts[emoji] || 0;
            return '<button type="button" class="reaction-btn' + (mine[emoji] ? ' is-active' : '') + '"' +
                ' title="React with ' + emoji + '" onclick="toggleCommunityReaction(\'' + kind + '\',' + id + ',\'' + emoji + '\')">' +
                '<span class="reaction-emoji">' + emoji + '</span>' +
                (count ? '<span class="reaction-count">' + count + '</span>' : '') +
            '</button>';
        }).join('') +
    '</div>';
}

function communityReplyHtml(reply, rows) {
    const canDelete = communityCanModerate(reply.username, 'reply');
    return '<div class="community-reply" id="reply-' + reply.id + '">' +
        '<div class="reply-head">' +
            userAvatarHtml(reply.username, 'reply-avatar') +
            '<button type="button" class="reply-user" onclick="openProfile(\'' + jsArg(reply.username) + '\')">' + escapeHtml(reply.username) + '</button>' +
            (reply.username === 'TotallyMason' ? '<span class="reply-owner-tag">OWNER</span>' : '') +
            '<span class="reply-time">' + new Date(reply.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '</div>' +
        '<div class="reply-content">' + escapeHtml(reply.content) + '</div>' +
        communityReactionBar('reply', reply.id, rows) +
        (canDelete ? '<div class="reply-actions"><button type="button" class="reply-delete" onclick="deleteReply(' + reply.id + ')">Delete</button></div>' : '') +
    '</div>';
}

async function createPost() {
    if (!communityUsername()) {
        alert('Please sign in to post');
        openAuthModal();
        return;
    }
    if (!communityPostsOpen()) {
        alert('The community is temporarily closed.');
        return;
    }
    const input = document.getElementById('postContent');
    const content = input ? input.value.trim() : '';
    if (!content && !pendingPostMedia) return;
    if (content.length > 20000) {
        alert('Posts can be up to 20,000 characters.');
        return;
    }
    if (!supabaseClient) {
        alert('Community posting needs a connection to Supabase.');
        return;
    }

    const payload = { username: communityUsername(), content: content };
    if (pendingPostMedia) {
        if (!siteSettings.allow_uploads) {
            alert('Uploads are currently disabled.');
            return;
        }
        payload.media_url = pendingPostMedia.url;
        payload.media_name = pendingPostMedia.name;
        payload.media_type = pendingPostMedia.type;
        payload.media_size = pendingPostMedia.size;
    }

    try {
        const { error } = await supabaseClient.from('posts').insert(payload);
        if (error) {
            var message = String(error.message || error);
            if (/posts_content_check|check constraint/i.test(message)) {
                alert('The database still has the old character limit. Run supabase/posts_content_20000.sql in the Supabase SQL Editor, then try again.');
            } else if (pendingPostMedia) {
                alert('Could not attach that file. Make sure the community migration (supabase/community.sql) has been run.\n\n' + message);
            } else {
                alert(message);
            }
            return;
        }
        if (input) input.value = '';
        pendingPostMedia = null;
        renderPostMediaPreview();
        renderCommunity();
    } catch (e) {
        alert(e.message || 'Error');
    }
}

async function deletePost(id) {
    const me = communityUsername();
    if (!me) {
        alert('Account required to delete posts');
        return;
    }
    if (!supabaseClient) return;
    const row = await socialQuery(supabaseClient.from('posts').select('username').eq('id', id).maybeSingle());
    if (row.error) {
        alert('Could not check that post: ' + (row.error.message || 'Unknown error'));
        return;
    }
    if (row.data && !communityCanModerate(row.data.username, 'post')) {
        alert('You can only delete your own posts.');
        return;
    }
    if (!window.confirm('Delete this post? Its replies and reactions will also be removed.')) return;
    const res = await socialQuery(supabaseClient.from('posts').delete().eq('id', id));
    if (res.error) {
        alert('Could not delete post: ' + (res.error.message || 'Unknown error'));
        return;
    }
    const pins = getPinnedIds().filter(function (pid) { return String(pid) !== String(id); });
    savePinnedIds(pins);
    renderCommunity();
}

async function createReply(postId) {
    const me = communityUsername();
    if (!me) {
        alert('Please sign in to reply');
        openAuthModal();
        return;
    }
    if (!communityPostsOpen()) {
        alert('The community is temporarily closed.');
        return;
    }
    if (!siteSettings.allow_replies) {
        alert('Replies are currently disabled.');
        return;
    }
    const input = document.getElementById('replyInput-' + postId);
    const content = input ? input.value.trim() : '';
    if (!content) return;
    if (content.length > 500) {
        alert('Replies are limited to 500 characters.');
        return;
    }
    if (!supabaseClient) return;
    const res = await socialQuery(supabaseClient.from('post_replies').insert({
        post_id: postId,
        username: me,
        content: content
    }));
    if (res.error) {
        alert('Could not reply. Make sure supabase/community.sql has been run.\n\n' + (res.error.message || 'Unknown error'));
        return;
    }
    if (input) input.value = '';
    await renderCommunity();
    const again = document.getElementById('replyInput-' + postId);
    if (again) again.focus();
}

async function deleteReply(id) {
    const me = communityUsername();
    if (!me) {
        alert('Account required to delete replies');
        return;
    }
    if (!supabaseClient) return;
    const row = await socialQuery(supabaseClient.from('post_replies').select('username').eq('id', id).maybeSingle());
    if (row.error) {
        alert('Could not check that reply: ' + (row.error.message || 'Unknown error'));
        return;
    }
    if (row.data && !communityCanModerate(row.data.username, 'reply')) {
        alert('You can only delete your own replies.');
        return;
    }
    if (!window.confirm('Delete this reply?')) return;
    const res = await socialQuery(supabaseClient.from('post_replies').delete().eq('id', id));
    if (res.error) {
        alert('Could not delete reply: ' + (res.error.message || 'Unknown error'));
        return;
    }
    renderCommunity();
}

async function toggleCommunityReaction(kind, id, emoji) {
    const me = communityUsername();
    if (!me) {
        alert('Please sign in to react');
        openAuthModal();
        return;
    }
    if (!siteSettings.allow_reactions) {
        alert('Reactions are currently disabled.');
        return;
    }
    if (!supabaseClient) return;
    const isReply = kind === 'reply';
    const table = isReply ? 'reply_reactions' : 'post_reactions';
    const column = isReply ? 'reply_id' : 'post_id';

    const existing = await socialQuery(supabaseClient.from(table)
        .select('id')
        .eq(column, id)
        .eq('username', me)
        .eq('reaction', emoji)
        .maybeSingle());
    if (existing.error) {
        alert('Reactions need the community migration (supabase/community.sql).\n\n' + (existing.error.message || 'Unknown error'));
        return;
    }

    let res;
    if (existing.data) {
        res = await socialQuery(supabaseClient.from(table).delete().eq('id', existing.data.id));
    } else {
        const row = { username: me, reaction: emoji };
        row[column] = id;
        res = await socialQuery(supabaseClient.from(table).insert(row));
    }
    if (res.error) {
        alert('Could not update reaction: ' + (res.error.message || 'Unknown error'));
        return;
    }
    renderCommunity();
}

function readFileDataUrl(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(reader.error || new Error('Could not read file')); };
        reader.readAsDataURL(file);
    });
}

function compressCommunityImage(file, limit) {
    return readFileDataUrl(file).then(function (data) {
        return new Promise(function (resolve) {
            const img = new Image();
            img.onload = function () {
                try {
                    const maxDim = 1400;
                    let width = img.width || 1;
                    let height = img.height || 1;
                    const scale = Math.min(1, maxDim / Math.max(width, height));
                    width = Math.max(1, Math.round(width * scale));
                    height = Math.max(1, Math.round(height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#0b1220';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    let quality = file.size > limit * 0.6 ? 0.72 : 0.86;
                    let out = canvas.toDataURL('image/jpeg', quality);
                    while (out.length > limit * 1.4 && quality > 0.4) {
                        quality -= 0.1;
                        out = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve({
                        url: out,
                        type: 'image/jpeg',
                        size: Math.round(out.length * 0.75)
                    });
                } catch (e) {
                    resolve(null);
                }
            };
            img.onerror = function () { resolve(null); };
            img.src = data;
        });
    }).catch(function () { return null; });
}

async function handlePostMedia(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    if (!siteSettings.allow_uploads) {
        alert('Uploads are currently disabled.');
        input.value = '';
        return;
    }
    const limitMb = Number(siteSettings.max_upload_mb);
    const limit = Math.max(0, isFinite(limitMb) ? limitMb : 2) * 1024 * 1024;
    if (limit <= 0) {
        alert('Uploads are currently disabled.');
        input.value = '';
        return;
    }
    if (file.size > limit) {
        alert('That file is ' + formatBytes(file.size) + '. The limit is ' + formatBytes(limit) + '.');
        input.value = '';
        return;
    }

    try {
        let media = null;
        if (String(file.type || '').indexOf('image/') === 0) {
            media = await compressCommunityImage(file, limit);
        }
        if (!media) {
            const url = await readFileDataUrl(file);
            media = { url: url, type: file.type || 'application/octet-stream', size: file.size };
        }
        pendingPostMedia = {
            url: media.url,
            name: String(file.name || 'attachment').slice(0, 120),
            type: media.type,
            size: media.size
        };
        renderPostMediaPreview();
    } catch (e) {
        alert('Could not read that file.');
    } finally {
        input.value = '';
    }
}

function clearPostMedia() {
    pendingPostMedia = null;
    renderPostMediaPreview();
}

function renderPostMediaPreview() {
    const wrap = document.getElementById('postMediaPreview');
    if (!wrap) return;
    if (!pendingPostMedia) {
        wrap.style.display = 'none';
        wrap.innerHTML = '';
        return;
    }
    const isImage = String(pendingPostMedia.type || '').indexOf('image/') === 0;
    wrap.style.display = 'flex';
    wrap.innerHTML =
        (isImage
            ? '<img class="post-media-thumb" src="' + escapeAttr(pendingPostMedia.url) + '" alt="Attachment preview">'
            : '<span class="post-media-file-icon">📎</span>') +
        '<span class="post-media-meta"><strong>' + escapeHtml(pendingPostMedia.name) + '</strong><small>' + escapeHtml(formatBytes(pendingPostMedia.size)) + '</small></span>' +
        '<button type="button" class="post-media-remove" onclick="clearPostMedia()">Remove</button>';
}

const COMMUNITY_PAGE_SIZE = 10;
let communityVisibleCount = COMMUNITY_PAGE_SIZE;

function communityLoadMore() {
    communityVisibleCount += COMMUNITY_PAGE_SIZE;
    showViewLoader('Loading more posts…');
    renderCommunity().finally(function () { hideViewLoader(); });
}

async function renderCommunity() {
    const container = document.getElementById('communityPosts');
    if (!container) return;
    if (!supabaseClient) return;

    if (!communityPostsOpen()) {
        container.innerHTML = '<div class="community-closed-card"><strong>Community is taking a break.</strong><p>An owner has temporarily closed posts, replies, and reactions. Check back soon.</p></div>';
        return;
    }

    const postRes = await socialQuery(
        supabaseClient.from('posts').select('*').order('created_at', { ascending: false }).limit(communityVisibleCount + 1)
    );
    if (postRes.error) {
        container.innerHTML = '<div class="community-closed-card"><strong>Could not load posts.</strong><p>' + escapeHtml(postRes.error.message || 'Unknown error') + '</p></div>';
        return;
    }
    const allPosts = postRes.data || [];
    const hasMorePosts = allPosts.length > communityVisibleCount;
    const posts = allPosts.slice(0, communityVisibleCount);
    if (!posts.length) {
        container.innerHTML = '<p class="community-empty">No posts yet. Start the conversation.</p>';
        return;
    }
    const postIds = posts.map(function (post) { return post.id; });
    const related = await Promise.all([
        socialQuery(supabaseClient.from('post_replies').select('*').in('post_id', postIds).order('created_at', { ascending: true })),
        socialQuery(supabaseClient.from('post_reactions').select('*').in('post_id', postIds).order('created_at', { ascending: false }))
    ]);
    const replies = related[0].data || [];
    const postReactions = related[1].data || [];
    const replyIds = replies.map(function (reply) { return reply.id; });
    const replyReactRes = replyIds.length
        ? await socialQuery(supabaseClient.from('reply_reactions').select('*').in('reply_id', replyIds).order('created_at', { ascending: false }))
        : { data: [], error: null };
    const replyReactions = replyReactRes.data || [];
    const migrationMissing = !!(related[0].error || related[1].error || replyReactRes.error);

    const repliesByPost = {};
    const postReactionsByPost = {};
    const replyReactionsByReply = {};
    replies.forEach(function (reply) {
        const key = String(reply.post_id);
        if (!repliesByPost[key]) repliesByPost[key] = [];
        repliesByPost[key].push(reply);
    });
    postReactions.forEach(function (row) {
        const key = String(row.post_id);
        if (!postReactionsByPost[key]) postReactionsByPost[key] = [];
        postReactionsByPost[key].push(row);
    });
    replyReactions.forEach(function (row) {
        const key = String(row.reply_id);
        if (!replyReactionsByReply[key]) replyReactionsByReply[key] = [];
        replyReactionsByReply[key].push(row);
    });

    const localPins = getPinnedIds();
    const entries = posts.map(function (post) {
        return {
            post: post,
            pinned: post.pinned === true || isPinnedByContent(post.content) || localPins.indexOf(String(post.id)) >= 0
        };
    });
    entries.sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.post.created_at) - new Date(a.post.created_at);
    });

    const signedIn = !!communityUsername();
    const owner = isOwner();

    container.innerHTML = (migrationMissing
        ? '<div class="community-migration-note">Replies and reactions are waiting on the database migration. Run <code>supabase/community.sql</code> to enable them.</div>'
        : '') +
        entries.map(function (entry) {
            const post = entry.post;
            const pinned = entry.pinned;
            const date = new Date(post.created_at);
            const postIsOwner = post.username === 'TotallyMason';
            const canDelete = communityCanModerate(post.username, 'post');
            const canPin = isOwner() || hasAdminPower('manage_posts');
            const postReplies = repliesByPost[String(post.id)] || [];
            const pinButton = canPin
                ? '<button type="button" class="post-pin' + (pinned ? ' is-pinned' : '') + '" onclick="togglePin(' + post.id + ', ' + pinned + ')">' + (pinned ? '📌 Unpin' : '📌 Pin') + '</button>'
                : '';

            let repliesHtml = '';
            if (siteSettings.allow_replies) {
                repliesHtml = '<div class="post-replies">' +
                    '<div class="post-replies-head"><span>Replies</span><small>' + postReplies.length + '</small></div>' +
                    (postReplies.length
                        ? postReplies.map(function (reply) {
                            return communityReplyHtml(reply, replyReactionsByReply[String(reply.id)] || []);
                        }).join('')
                        : '<p class="reply-empty">No replies yet.</p>') +
                    (signedIn && communityPostsOpen()
                        ? '<div class="reply-composer">' +
                            '<input type="text" class="reply-input" id="replyInput-' + post.id + '" maxlength="500" placeholder="Reply to ' + escapeAttr(post.username) + '…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();createReply(' + post.id + ');}">' +
                            '<button type="button" class="reply-send" onclick="createReply(' + post.id + ')">Reply</button>' +
                        '</div>'
                        : '<p class="reply-signin">Sign in to reply.</p>') +
                '</div>';
            } else {
                repliesHtml = '<div class="post-replies is-disabled"><p class="reply-empty">Replies are disabled by the owner.</p></div>';
            }

            return '<div class="community-post' + (pinned ? ' pinned' : '') + '">' +
                '<div class="post-header">' +
                    '<div class="post-head-left">' +
                        userAvatarHtml(post.username, 'post-avatar') +
                        '<button type="button" class="post-user" onclick="openProfile(\'' + jsArg(post.username) + '\')">' + escapeHtml(post.username) + '</button>' +
                        (postIsOwner ? '<span class="post-owner-tag">OWNER</span>' : '') +
                        (pinned ? '<span class="post-pin-badge">📌 PINNED</span>' : '') +
                    '</div>' +
                    '<span class="post-time">' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>' +
                '</div>' +
                '<div class="post-content">' + escapeHtml(stripPinMarker(post.content)) + '</div>' +
                communityMediaHtml(post) +
                communityReactionBar('post', post.id, postReactionsByPost[String(post.id)] || []) +
                '<div class="post-actions">' +
                    (canDelete ? '<button type="button" class="post-delete" onclick="deletePost(' + post.id + ')">Delete</button>' : '') +
                    pinButton +
                '</div>' +
                repliesHtml +
            '</div>';
        }).join('') +
        (hasMorePosts ? '<button type="button" class="community-load-more" onclick="communityLoadMore()">Load more posts</button>' : '');
}

function loadUser(){ 
    const saved=localStorage.getItem('lessfun_user'); 
    if(saved){ 
        currentUser=JSON.parse(saved); 
        // Ensure persistScores is set
        if(currentUser.persistScores === undefined) {
            currentUser.persistScores = currentUser.type === 'user';
        }
        currentUser.adminPowers = parseAdminPowers(currentUser.adminPowers);
        currentUser.isAdmin = !!currentUser.isAdmin;
        currentUser.avatar = currentUser.avatar || '';
        rememberAvatar(currentUser.username, currentUser.avatar);
    } else { 
        currentUser={type:'guest',username:'Guest', persistScores: false}; 
    } 
    updateUserSection(); 
    startPresence();
}

async function verifyAccountState() {
    if (!supabaseClient || !currentUser || currentUser.type !== 'user') return;
    try {
        let res = await supabaseClient.from('users').select('banned, is_admin, developer, admin_powers, avatar').eq('username', currentUser.username).maybeSingle();
        if (res.error) {
            res = await supabaseClient.from('users').select('banned').eq('username', currentUser.username).maybeSingle();
        }
        if (!res.error && res.data) {
            if (res.data.banned) {
                alert('This account has been banned.');
                await logout();
                return;
            }
            currentUser.isAdmin = !!res.data.is_admin;
            currentUser.developer = !!res.data.developer;
            currentUser.adminPowers = parseAdminPowers(res.data.admin_powers);
            currentUser.avatar = res.data.avatar || '';
            rememberAvatar(currentUser.username, currentUser.avatar);
            localStorage.setItem('lessfun_user', JSON.stringify(currentUser));
            updateUserSection();
            if (currentUser.avatar) loadAvatarCache();
        }
    } catch (e) {}
}
function initViewCounter(){ const v=parseInt(localStorage.getItem('lfv')||'0')+1; localStorage.setItem('lfv',v); if(document.getElementById('viewCounterDisplay')) document.getElementById('viewCounterDisplay').textContent=v.toLocaleString(); }

if(supabaseClient){
    supabaseClient.auth.onAuthStateChange((event,session)=>{
        if(session){ 
            const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User';
            currentUser={
                type:'user',
                username: username,
                persistScores: true,
                isAdmin: false,
                developer: false,
                adminPowers: [],
                avatar: ''
            }; 
            localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
        }
        else if(event==='SIGNED_OUT'){ 
            currentUser={type:'guest',username:'Guest', persistScores: false}; 
            localStorage.removeItem('lessfun_user'); 
        }
        updateUserSection();
        loadWallet();
    });
}

const APP_VERSION = "LessFun Public Beta 1.33.11";
const UPDATE_NOTES = "The no-ads Christmas jingle now keeps playing in the background when the tab is hidden";

let updateShutdownTimer = 0;
let updateReloadTimer = 0;
let updateShutdownActive = false;

function showUpdateShutdown(title, text, reloading) {
    updateShutdownActive = true;
    const overlay = document.getElementById('updateShutdown');
    const titleEl = document.getElementById('updateShutdownTitle');
    const textEl = document.getElementById('updateShutdownText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (overlay) overlay.style.display = 'flex';
    if (window.Games3D && window.Games3D.setPaused) window.Games3D.setPaused(true);
    if (!reloading && !updateShutdownTimer) {
        updateShutdownTimer = setTimeout(function () {
            updateShutdownTimer = 0;
            checkForServerUpdate();
        }, 8000);
    }
}

function hideUpdateShutdown() {
    updateShutdownActive = false;
    if (updateShutdownTimer) { clearTimeout(updateShutdownTimer); updateShutdownTimer = 0; }
    if (updateReloadTimer) { clearTimeout(updateReloadTimer); updateReloadTimer = 0; }
    const overlay = document.getElementById('updateShutdown');
    if (overlay) overlay.style.display = 'none';
}

async function checkForServerUpdate() {
    if (isOwner()) { hideUpdateShutdown(); return; }
    try {
        const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.shutdown) {
            showUpdateShutdown('LessFun is temporarily offline', data.message || 'The site is shut down for an update. It will reopen automatically.', false);
            return;
        }
        if (data && data.version && data.version !== APP_VERSION) {
            showUpdateShutdown('Updating LessFun', 'A new version has been deployed. Reloading automatically…', true);
            if (!updateReloadTimer) {
                updateReloadTimer = setTimeout(function () { location.reload(); }, 4200);
            }
            return;
        }
        hideUpdateShutdown();
    } catch (e) {}
}

function checkForUpdates() {
    var lastVersion = localStorage.getItem('lessfun_version');
    if (lastVersion !== APP_VERSION) {
        localStorage.setItem('lessfun_version', APP_VERSION);
    }
}

const GLASS_POINTER_SELECTOR = '.game-card,.store-card,.support-card,.daily-gift-banner,.portal-btn,.settings-group,.info-card,.community-post,.community-post-form,.nav-btn,.game-btn-3d';

document.addEventListener('pointermove', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var el = target.closest(GLASS_POINTER_SELECTOR);
    if (!el) return;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    el.style.setProperty('--mx', (((event.clientX - rect.left) / rect.width) * 100).toFixed(2) + '%');
    el.style.setProperty('--my', (((event.clientY - rect.top) / rect.height) * 100).toFixed(2) + '%');
}, { passive: true });

function initSiteSnow() {
    var canvas = document.getElementById('siteSnow');
    if (!canvas) return;
    if (!document.documentElement.classList.contains('is-holiday')) return;
    if (reduceMotionSetting) { canvas.style.display = 'none'; return; }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var flakes = [];
    var w = 0, h = 0, dpr = 1;
    function resizeSnow() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        var count = w < 700 ? 34 : 72;
        flakes = [];
        for (var i = 0; i < count; i++) {
            flakes.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: 0.8 + Math.random() * 2.2,
                s: 6 + Math.random() * 16,
                drift: (Math.random() - 0.5) * 12,
                phase: Math.random() * Math.PI * 2,
                alpha: 0.18 + Math.random() * 0.42
            });
        }
    }
    resizeSnow();
    window.addEventListener('resize', resizeSnow, { passive: true });
    var last = 0;
    function snowFrame(ts) {
        requestAnimationFrame(snowFrame);
        if (document.hidden || document.body.classList.contains('in-game')) return;
        if (!last) last = ts;
        var dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < flakes.length; i++) {
            var f = flakes[i];
            f.y += f.s * dt;
            f.phase += dt * 0.8;
            f.x += (f.drift + Math.sin(f.phase) * 7) * dt;
            if (f.y > h + 6) { f.y = -6; f.x = Math.random() * w; }
            if (f.x < -8) f.x = w + 8;
            if (f.x > w + 8) f.x = -8;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(235, 246, 255, ' + f.alpha + ')';
            ctx.fill();
        }
    }
    requestAnimationFrame(snowFrame);
}

document.addEventListener('DOMContentLoaded', ()=>{
    loadSiteSettings();
    renderGames();
    renderRecentGames();
    loadUser();
    verifyAccountState();
    initViewCounter();
    updateUserSection();
    loadWallet();
    startPresence();
    loadAvatarCache();
    checkForUpdates();
    checkForServerUpdate();
    setInterval(checkForServerUpdate, 60000);
    applyRenderScaleSetting();
    applySoundSetting();
    applyUnitSetting();
    radioInit();
    initSnowEvent();
    initSiteSnow();
});

window.addEventListener('load', function () {
    setTimeout(function () { ensureAssistant().catch(function () {}); }, 1800);
});

document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        touchPresence();
        checkForServerUpdate();
    }
});

function openProfile(username) {
    if (!username) { openAuthModal(); return; }
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('profileTitle').textContent = username + "'s Profile";
    document.getElementById('profileUsername').textContent = username;
    const safe = safeAvatarValue(avatarForUser(username));
    document.getElementById('profileAvatar').innerHTML = safe
        ? '<img src="' + escapeAttr(safe) + '" alt="' + escapeAttr(username) + '">'
        : escapeHtml(username.charAt(0).toUpperCase());
    document.getElementById('profileJoined').textContent = 'Member';
    const statsEl = document.getElementById('profileStats');
    if (statsEl) statsEl.textContent = '';
    const photoActions = document.getElementById('profilePhotoActions');
    const isSelfAccount = !!(currentUser && currentUser.type === 'user' && currentUser.username === username);
    if (photoActions) photoActions.style.display = isSelfAccount ? 'flex' : 'none';
    const photoInput = document.getElementById('profilePhotoInput');
    if (photoInput) photoInput.value = '';
    const profileCoins = document.getElementById('profileCoins');
    if (profileCoins) {
        if (currentUser && currentUser.type === 'user' && currentUser.username === username) {
            profileCoins.style.display = 'block';
            profileCoins.innerHTML = shellIcon(14) + ' <span>' + (wallet ? wallet.shells.toLocaleString() : SHELLS_START.toLocaleString()) + ' Coins</span>';
        } else {
            profileCoins.style.display = 'none';
        }
    }
    const logoutBtn = document.getElementById('profileLogoutBtn');
    if (currentUser && currentUser.username === username) {
        logoutBtn.style.display = 'block';
        // Force check - if it's guest or not a proper user account
        if (currentUser.type === 'guest' || currentUser.username === 'Guest' || currentUser.username === 'Anonymous-Guest') {
            logoutBtn.innerText = 'Sign In';
            logoutBtn.onclick = function() { closeProfile(); document.getElementById('authModal').style.display = 'flex'; return false; };
        } else if (currentUser.type === 'user') {
            logoutBtn.innerText = 'Log Out';
            logoutBtn.onclick = logoutFromProfile;
        } else {
            logoutBtn.innerText = 'Sign In';
            logoutBtn.onclick = function() { closeProfile(); openAuthModal(); return false; };
        }
    } else {
        logoutBtn.style.display = 'none';
    }
    profileBanTarget = { username: username, banned: false };
    profileGiftTarget = isSelfAccount ? '' : username;
    const giftBtn = document.getElementById('profileGiftBtn');
    if (giftBtn) giftBtn.style.display = (!isSelfAccount && currentUser && currentUser.type === 'user') ? 'inline-flex' : 'none';
    const banBtn = document.getElementById('profileBanBtn');
    if (banBtn) {
        const canBan = !isSelfAccount && username !== 'TotallyMason' && hasAdminPower('manage_users');
        banBtn.style.display = canBan ? 'inline-flex' : 'none';
        banBtn.textContent = 'Ban user';
    }
    loadProfilePosts(username);
    loadProfileDetails(username);
}

async function loadProfileDetails(username) {
    const joinedEl = document.getElementById('profileJoined');
    const statsEl = document.getElementById('profileStats');
    if (!supabaseClient) return;
    try {
        let userRes = await supabaseClient.from('users').select('created_at, avatar, banned, is_admin').eq('username', username).maybeSingle();
        if (userRes && userRes.error) {
            userRes = await supabaseClient.from('users').select('created_at, banned').eq('username', username).maybeSingle();
        }
        if (userRes && !userRes.error && userRes.data) {
            profileBanTarget = { username: username, banned: !!userRes.data.banned };
            const banBtn = document.getElementById('profileBanBtn');
            if (banBtn && banBtn.style.display !== 'none') {
                banBtn.textContent = profileBanTarget.banned ? 'Unban user' : 'Ban user';
                banBtn.classList.toggle('is-unban', profileBanTarget.banned);
            }
            const joined = userRes.data.created_at ? new Date(userRes.data.created_at) : null;
            if (joinedEl && joined && !isNaN(joined.getTime())) {
                joinedEl.textContent = 'Member since ' + joined.toLocaleDateString([], { month: 'short', year: 'numeric' });
            }
            if (userRes.data.avatar) {
                rememberAvatar(username, userRes.data.avatar);
                if (String(username).toLowerCase() === String((currentUser && currentUser.username) || '').toLowerCase()) {
                    currentUser.avatar = userRes.data.avatar;
                    localStorage.setItem('lessfun_user', JSON.stringify(currentUser));
                }
                const safe = safeAvatarValue(userRes.data.avatar);
                const avatarEl = document.getElementById('profileAvatar');
                if (safe && avatarEl && document.getElementById('profileUsername').textContent === username) {
                    avatarEl.innerHTML = '<img src="' + escapeAttr(safe) + '" alt="' + escapeAttr(username) + '">';
                }
            }
        }
        const extras = await Promise.all([
            socialQuery(supabaseClient.from('scores').select('game, score').eq('username', username).order('score', { ascending: false }).limit(100)),
            socialQuery(supabaseClient.from('wallets').select('shells, total_earned, streak').eq('username', username).maybeSingle()),
            socialQuery(supabaseClient.from('user_presence').select('last_seen').eq('username', username).maybeSingle()),
            socialQuery(supabaseClient.from('posts').select('id', { count: 'exact', head: true }).eq('username', username)),
            socialQuery(supabaseClient.from('post_replies').select('id', { count: 'exact', head: true }).eq('username', username)),
            socialQuery(supabaseClient.from('friendships').select('id', { count: 'exact', head: true }).eq('requester', username).eq('status', 'accepted')),
            socialQuery(supabaseClient.from('friendships').select('id', { count: 'exact', head: true }).eq('recipient', username).eq('status', 'accepted'))
        ]);
        if (statsEl) {
            const chips = [];
            const scoreRes = extras[0];
            const best = {};
            (scoreRes.data || []).forEach(function (row) {
                const game = row.game || 'Game';
                if (!best[game] || Number(row.score) > Number(best[game])) best[game] = Number(row.score) || 0;
            });
            const entries = Object.keys(best).sort(function (a, b) { return best[b] - best[a]; });
            entries.forEach(function (game) {
                chips.push('<span class="profile-stat"><strong>' + escapeHtml(game) + '</strong> ' + escapeHtml(best[game].toLocaleString()) + '</span>');
            });
            const walletRes = extras[1];
            if (walletRes && !walletRes.error && walletRes.data) {
                chips.push('<span class="profile-stat"><strong>Coins</strong> ' + escapeHtml((Number(walletRes.data.shells) || 0).toLocaleString()) + '</span>');
                chips.push('<span class="profile-stat"><strong>Earned</strong> ' + escapeHtml((Number(walletRes.data.total_earned) || 0).toLocaleString()) + '</span>');
                if (Number(walletRes.data.streak) > 0) chips.push('<span class="profile-stat"><strong>Streak</strong> ' + escapeHtml(String(walletRes.data.streak)) + ' days</span>');
            }
            const presenceRes = extras[2];
            if (presenceRes && !presenceRes.error && presenceRes.data && presenceRes.data.last_seen) {
                chips.push('<span class="profile-stat"><strong>Last seen</strong> ' + escapeHtml(formatLastSeen(presenceRes.data.last_seen)) + '</span>');
            }
            if (extras[3] && !extras[3].error && typeof extras[3].count === 'number') {
                chips.push('<span class="profile-stat"><strong>Posts</strong> ' + escapeHtml(String(extras[3].count)) + '</span>');
            }
            if (extras[4] && !extras[4].error && typeof extras[4].count === 'number') {
                chips.push('<span class="profile-stat"><strong>Replies</strong> ' + escapeHtml(String(extras[4].count)) + '</span>');
            }
            const friendCount = ((extras[5] && extras[5].count) || 0) + ((extras[6] && extras[6].count) || 0);
            chips.push('<span class="profile-stat"><strong>Friends</strong> ' + escapeHtml(String(friendCount)) + '</span>');
            if (userRes && userRes.data && userRes.data.is_admin) {
                chips.push('<span class="profile-stat"><strong>ADMIN</strong></span>');
            }
            statsEl.innerHTML = '<span class="profile-stats-label">Player details</span>' + chips.join('');
        }
    } catch (e) {}
}

function chooseProfilePhoto() {
    const input = document.getElementById('profilePhotoInput');
    if (input) input.click();
}

function handleProfilePhoto(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    if (!/^image\//.test(file.type)) {
        alert('Choose an image file.');
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        alert('That image is too large. Choose one under 8 MB.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        const img = new Image();
        img.onload = function () {
            try {
                const size = 160;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const side = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                saveAvatarDataUrl(canvas.toDataURL('image/jpeg', 0.84));
            } catch (e) {
                alert('Could not process that image.');
            }
        };
        img.onerror = function () { alert('Could not read that image.'); };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

async function saveAvatarDataUrl(dataUrl) {
    if (!currentUser || currentUser.type !== 'user') {
        alert('Sign in to change your profile photo.');
        return;
    }
    const username = currentUser.username;
    currentUser.avatar = dataUrl || '';
    rememberAvatar(username, currentUser.avatar);
    try { localStorage.setItem('lessfun_user', JSON.stringify(currentUser)); } catch (e) {}
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
        avatarEl.innerHTML = dataUrl
            ? '<img src="' + escapeAttr(dataUrl) + '" alt="' + escapeAttr(username) + '">'
            : escapeHtml(username.charAt(0).toUpperCase());
    }
    if (supabaseClient) {
        const res = await socialQuery(supabaseClient.from('users').update({ avatar: currentUser.avatar }).eq('username', username));
        if (res.error) {
            alert('Could not save the profile photo. Run supabase/admins_avatars.sql first.\n\n' + (res.error.message || 'Unknown error'));
        }
    }
    if (currentView === 'community') renderCommunity();
    if (currentView === 'users') renderFriends();
}

function removeProfilePhoto() {
    saveAvatarDataUrl('');
}

function openGiftCoins() {
    openGiftModal(profileGiftTarget);
}

function openGiftModal(username) {
    const modal = document.getElementById('giftModal');
    if (!modal) return;
    const recipient = document.getElementById('giftRecipient');
    const amount = document.getElementById('giftAmount');
    const balance = document.getElementById('giftBalance');
    const status = document.getElementById('giftStatus');
    if (recipient) recipient.value = username || '';
    if (amount) amount.value = '25';
    if (balance) {
        balance.textContent = (wallet && currentUser && currentUser.type === 'user')
            ? 'Your balance: ' + wallet.shells.toLocaleString() + ' Coins'
            : 'Sign in to send Coins.';
    }
    if (status) {
        status.textContent = (!currentUser || currentUser.type !== 'user') ? 'Sign in to gift Coins.' : '';
        status.classList.remove('is-success');
    }
    modal.style.display = 'flex';
    if (recipient && !username) setTimeout(function () { try { recipient.focus(); } catch (e) {} }, 80);
}

function closeGiftModal() {
    const modal = document.getElementById('giftModal');
    if (modal) modal.style.display = 'none';
}

async function sendCoinsGift(target, amount) {
    if (!currentUser || currentUser.type !== 'user') {
        return { ok: false, message: 'Sign in to gift Coins.' };
    }
    if (!wallet) {
        return { ok: false, message: 'Your wallet is still loading.' };
    }
    if (!target || target === currentUser.username) {
        return { ok: false, message: 'Enter another player’s username.' };
    }
    if (!isFinite(amount) || amount <= 0) {
        return { ok: false, message: 'Enter a whole number of Coins.' };
    }
    if (amount > wallet.shells) {
        return { ok: false, message: 'You do not have that many Coins.' };
    }

    wallet.shells -= amount;
    await saveWallet();

    let delivered = true;
    if (supabaseClient) {
        try {
            const existing = await supabaseClient.from('wallets').select('shells').eq('username', target).maybeSingle();
            if (existing.error) {
                delivered = false;
            } else if (existing.data) {
                const res = await supabaseClient.from('wallets').update({
                    shells: (Number(existing.data.shells) || 0) + amount
                }).eq('username', target);
                if (res && res.error) delivered = false;
            } else {
                const res = await supabaseClient.from('wallets').insert({
                    username: target,
                    shells: amount
                });
                if (res && res.error) delivered = false;
            }
        } catch (e) {
            delivered = false;
        }
    }

    if (!delivered) {
        wallet.shells += amount;
        await saveWallet();
        return { ok: false, message: 'Could not send those Coins. Your balance was restored.' };
    }
    renderWalletUI();
    if (supabaseClient) {
        try {
            await supabaseClient.from('coin_gifts').insert({
                sender: currentUser.username,
                recipient: target,
                amount: amount
            });
            sendCallSignal('gift-notify', {
                from: currentUser.username,
                to: target,
                amount: amount
            });
        } catch (e) {}
    }
    return { ok: true, message: 'Gifted ' + amount.toLocaleString() + ' Coins to ' + target + '.' };
}

async function submitGiftCoins() {
    const recipientEl = document.getElementById('giftRecipient');
    const amountEl = document.getElementById('giftAmount');
    const status = document.getElementById('giftStatus');
    const target = String(recipientEl ? recipientEl.value : '').trim();
    const amount = Math.floor(Number(amountEl ? amountEl.value : 0));
    if (status) {
        status.textContent = 'Sending…';
        status.classList.remove('is-success');
    }
    const result = await sendCoinsGift(target, amount);
    if (status) {
        status.textContent = result.message;
        status.classList.toggle('is-success', !!result.ok);
    }
    if (result.ok) {
        flashStoreStatus(result.message);
        setTimeout(closeGiftModal, 900);
    }
}

async function banProfileUser() {
    if (!hasAdminPower('manage_users')) {
        alert('You do not have permission to manage users.');
        return;
    }
    const target = profileBanTarget || {};
    if (!target.username || target.username === 'TotallyMason' || !supabaseClient) return;
    const next = !target.banned;
    if (!window.confirm((next ? 'Ban ' : 'Unban ') + target.username + '?')) return;
    const res = await socialQuery(supabaseClient.from('users').update({ banned: next }).eq('username', target.username));
    if (res.error) {
        alert('Could not update that account: ' + (res.error.message || 'Unknown error'));
        return;
    }
    target.banned = next;
    const banBtn = document.getElementById('profileBanBtn');
    if (banBtn) {
        banBtn.textContent = next ? 'Unban user' : 'Ban user';
        banBtn.classList.toggle('is-unban', next);
    }
}

function closeProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

async function logoutFromProfile() {
    await logout();
    closeProfile();
    updateUserSection();
}

function clearCurrentSession() {
    localStorage.removeItem('lessfun_user');
    localStorage.removeItem('lessfun_pass_*');
    // Clear any session data
    currentUser = { type: 'guest', username: 'Guest', persistScores: false };
    updateUserSection();
    alert('Session cleared');
}

async function loadProfilePosts(username) {
    const container = document.getElementById('profilePosts');
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">Loading...</p>';
    if (supabaseClient) {
        const { data: posts } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('username', username)
            .order('created_at', { ascending: false })
            .limit(20);
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">No posts yet</p>';
            return;
        }
        container.innerHTML = posts.map(post => {
            const date = new Date(post.created_at);
            return `<div style="padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;"><div style="color:rgba(255,255,255,0.8);margin-bottom:6px;">${escapeHtml(stripPinMarker(post.content))}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${date.toLocaleDateString()}</div></div>`;
        }).join('');
        return;
    }
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">No posts yet</p>';
}

async function socialQuery(promise) {
    try {
        const res = await promise;
        return res || { data: null, error: { message: 'No response' } };
    } catch (e) {
        return { data: null, error: { message: (e && e.message) ? e.message : 'Request failed' } };
    }
}

function friendUsername() {
    return (currentUser && currentUser.type === 'user' && currentUser.username && currentUser.persistScores !== false)
        ? currentUser.username
        : null;
}

function isOnline(lastSeen) {
    if (!lastSeen) return false;
    const ts = Date.parse(lastSeen);
    if (!isFinite(ts)) return false;
    return (Date.now() - ts) < PRESENCE_ONLINE_MS;
}

function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Last seen unknown';
    const ts = Date.parse(lastSeen);
    if (!isFinite(ts)) return 'Last seen unknown';
    const diff = Math.max(0, Date.now() - ts);
    if (diff < PRESENCE_ONLINE_MS) return 'Online now';
    if (diff < 3600000) return 'Last seen ' + Math.max(1, Math.round(diff / 60000)) + 'm ago';
    if (diff < 86400000) return 'Last seen ' + Math.round(diff / 3600000) + 'h ago';
    if (diff < 604800000) return 'Last seen ' + Math.round(diff / 86400000) + 'd ago';
    const d = new Date(ts);
    return 'Last seen ' + d.toLocaleDateString();
}

function showFriendsStatus(message, isError) {
    const el = document.getElementById('friendsStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'friends-status is-visible ' + (isError ? 'is-error' : 'is-success');
    if (friendsStatusTimer) clearTimeout(friendsStatusTimer);
    friendsStatusTimer = setTimeout(function () { el.className = 'friends-status'; }, 3500);
}

let presenceUnavailable = false;

let notifRows = [];
let notifPoll = 0;
let notifLoading = false;
let notifShownIds = {};
let topNotifTimers = {};

function ensureTopLayer(el) {
    if (!el) return;
    const fs = document.fullscreenElement;
    if (fs && fs.appendChild && el.parentNode !== fs) {
        try { fs.appendChild(el); } catch (e) {}
    } else if (!fs && el.parentNode !== document.body) {
        try { document.body.appendChild(el); } catch (e) {}
    }
}

function showTopNotification(html, icon, onClick) {
    const host = document.getElementById('topNotifications');
    if (!host) return;
    ensureTopLayer(host);
    const card = document.createElement('div');
    card.className = 'top-notification';
    card.innerHTML = '<span class="top-notification-icon">' + (icon || '🔔') + '</span><span class="top-notification-text">' + html + '</span>';
    card.onclick = function () {
        if (onClick) onClick();
        else openNotifications();
        dismissTopNotification(card);
    };
    host.appendChild(card);
    const timer = setTimeout(function () { dismissTopNotification(card); }, 5200);
    topNotifTimers[card] = timer;
}

function dismissTopNotification(card) {
    if (!card || !card.parentNode) return;
    if (topNotifTimers[card]) { clearTimeout(topNotifTimers[card]); delete topNotifTimers[card]; }
    card.classList.add('is-leaving');
    setTimeout(function () {
        if (card.parentNode) card.parentNode.removeChild(card);
    }, 320);
}

function showGiftNotification(row) {
    const sender = escapeHtml(row.sender || 'Someone');
    const amount = escapeHtml((Number(row.amount) || 0).toLocaleString());
    showTopNotification('<strong>' + sender + '</strong> gifted you ' + amount + ' Coins', '🎁');
}

function handleGiftNotify(payload) {
    const me = friendUsername();
    if (!me || !payload || payload.to !== me || payload.from === me) return;
    loadNotifications(true);
}

function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unseen = notifRows.filter(function (row) { return !row.seen; }).length;
    badge.textContent = unseen > 9 ? '9+' : String(unseen);
    badge.style.display = unseen > 0 ? 'inline-flex' : 'none';
}

async function loadNotifications(quiet) {
    const me = friendUsername();
    if (!me || !supabaseClient || notifLoading) return;
    notifLoading = true;
    try {
        const res = await socialQuery(supabaseClient.from('coin_gifts')
            .select('*')
            .eq('recipient', me)
            .order('created_at', { ascending: false })
            .limit(40));
        if (!res.error) {
            notifRows = res.data || [];
            let shownCount = 0;
            notifRows.forEach(function (row) {
                const id = String(row.id);
                if (!row.seen && !notifShownIds[id] && shownCount < 4) {
                    notifShownIds[id] = true;
                    shownCount++;
                    showGiftNotification(row);
                }
            });
        }
        updateNotifBadge();
        if (!quiet && document.getElementById('notificationsModal') && document.getElementById('notificationsModal').style.display !== 'none') {
            renderNotifications();
        }
    } catch (e) {}
    notifLoading = false;
}

function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    const me = friendUsername();
    if (!me) {
        list.innerHTML = '<p class="notif-empty">Sign in to see gift notifications.</p>';
        return;
    }
    if (!notifRows.length) {
        list.innerHTML = '<p class="notif-empty">No notifications yet. Coin gifts will appear here.</p>';
        return;
    }
    list.innerHTML = notifRows.map(function (row) {
        const date = new Date(row.created_at);
        return '<div class="notif-row' + (row.seen ? '' : ' is-unread') + '">' +
            '<span class="notif-icon">🎁</span>' +
            '<div class="notif-main">' +
                '<strong>' + escapeHtml(row.sender || 'Someone') + '</strong> gifted you ' +
                '<strong>' + escapeHtml((Number(row.amount) || 0).toLocaleString()) + ' Coins</strong>' +
                '<span class="notif-time">' + escapeHtml(isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span>' +
            '</div>' +
        '</div>';
    }).join('');
}

async function openNotifications() {
    const modal = document.getElementById('notificationsModal');
    ensureTopLayer(modal);
    if (modal) modal.style.display = 'flex';
    await loadNotifications(false);
    renderNotifications();
    markNotificationsSeen();
}

function closeNotifications() {
    const modal = document.getElementById('notificationsModal');
    if (modal) modal.style.display = 'none';
}

async function markNotificationsSeen() {
    const me = friendUsername();
    if (!me || !supabaseClient) return;
    const unseen = notifRows.some(function (row) { return !row.seen; });
    if (!unseen) return;
    try {
        await supabaseClient.from('coin_gifts').update({ seen: true }).eq('recipient', me).eq('seen', false);
        notifRows.forEach(function (row) { row.seen = true; });
        updateNotifBadge();
    } catch (e) {}
}

function startNotifications() {
    if (!friendUsername() || !supabaseClient) return;
    loadNotifications(true);
    if (!notifPoll) notifPoll = setInterval(function () { loadNotifications(true); }, 25000);
}

function stopNotifications() {
    if (notifPoll) { clearInterval(notifPoll); notifPoll = 0; }
    notifRows = [];
    notifShownIds = {};
    updateNotifBadge();
}

/* ============================================================
   Voice parties — WebRTC mesh with Supabase signaling
   ============================================================ */
const PARTY_MAX = 8;
const PARTY_ICE = { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
] };
let party = {
    code: '',
    id: '',
    name: '',
    channel: null,
    connected: false,
    members: {},
    pcs: {},
    audios: {},
    localStream: null,
    micOn: false,
    joinedAt: 0,
    status: ''
};
let partyAudioCtx = null;
let partyGains = {};
let pendingCall = null;
let partyRetryTimer = 0;
let callInviteSearchTimer = 0;
let callInviteUsers = [];
let callInviteUsersLoaded = false;

function partyMakeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function partyDisplayName() {
    if (currentUser && currentUser.type === 'user' && currentUser.username && currentUser.username !== 'Guest') {
        return racerMpSanitizeName(currentUser.username);
    }
    return racerMpSanitizeName(racerMpSuggestedName()) || 'Guest';
}

function partySetStatus(text) {
    party.status = text || '';
    partyRender();
}

async function partyEnsureMic() {
    if (party.localStream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
        party.localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function createVoiceParty() {
    partyJoinWithCode(partyMakeCode());
}

function joinVoicePartyFromInput() {
    const input = document.getElementById('partyCodeInput');
    const code = String(input ? input.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length < 4) {
        partySetStatus('Enter the party code a friend shared.');
        return;
    }
    partyJoinWithCode(code);
}

async function partyJoinWithCode(code) {
    if (!supabaseClient) {
        partySetStatus('Voice parties need an online connection.');
        return;
    }
    leaveParty(true);
    party.code = String(code || '').toUpperCase();
    party.id = racerMpMakeId();
    party.name = partyDisplayName();
    party.joinedAt = Date.now();
    party.connected = false;
    party.members = {};
    party.status = 'Requesting microphone…';
    partyRender();
    const micOk = await partyEnsureMic();
    party.micOn = !!micOk;
    if (party.localStream) {
        party.localStream.getAudioTracks().forEach(function (track) { track.enabled = party.micOn; });
    }
    partyStartChannel(micOk ? '' : 'Microphone unavailable — joined muted.');
}

function partyStartChannel(initialStatus) {
    const channel = supabaseClient.channel('lessfun-party-' + party.code, {
        config: { presence: { key: party.id } }
    });
    party.channel = channel;
    channel.on('broadcast', { event: 'signal' }, function (message) {
        partyHandleSignal(message && message.payload);
    });
    channel.on('presence', { event: 'sync' }, partySyncPresence);
    channel.on('presence', { event: 'join' }, partySyncPresence);
    channel.on('presence', { event: 'leave' }, partySyncPresence);
    channel.subscribe(function (status) {
        if (party.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
            party.connected = true;
            const tracked = channel.track(partyPresencePayload());
            if (tracked && tracked.catch) tracked.catch(function () {});
            party.status = initialStatus || 'Call connected. Press V anywhere to toggle your mic.';
            partyRender();
            partySyncPresence();
            if (partyRetryTimer) clearInterval(partyRetryTimer);
            partyRetryTimer = setInterval(partyRetryConnections, 5000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            party.connected = false;
            party.status = 'Could not connect to that voice party.';
            partyRender();
        }
    });
}

function partyPresencePayload() {
    return {
        id: party.id,
        username: party.name,
        mic: party.micOn,
        joinedAt: party.joinedAt
    };
}

function partyPub() {
    if (!party.channel || !party.connected) return;
    const tracked = party.channel.track(partyPresencePayload());
    if (tracked && tracked.catch) tracked.catch(function () {});
}

function partySend(peerId, data) {
    if (!party.channel || !party.connected) return;
    const payload = Object.assign({ from: party.id, to: peerId }, data || {});
    const sent = party.channel.send({ type: 'broadcast', event: 'signal', payload: payload });
    if (sent && sent.catch) sent.catch(function () {});
}

function partySyncPresence() {
    if (!party.channel || !party.connected) return;
    const state = party.channel.presenceState() || {};
    const members = {};
    Object.keys(state).forEach(function (key) {
        const entries = state[key] || [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i] || {};
            const id = String(entry.id || key);
            if (!id) continue;
            if (!members[id] || (entry.joinedAt || 0) < (members[id].joinedAt || 0)) {
                members[id] = {
                    id: id,
                    username: racerMpSanitizeName(entry.username) || 'Guest',
                    mic: !!entry.mic,
                    joinedAt: Number(entry.joinedAt) || 0
                };
            }
        }
    });
    party.members = members;
    Object.keys(members).forEach(function (id) {
        if (id === party.id) return;
        partyEnsurePeer(id);
        if (String(party.id) < String(id)) partyOffer(id);
    });
    Object.keys(party.pcs).forEach(function (id) {
        if (!members[id]) partyClosePeer(id);
    });
    partyRender();
}

function partyRetryConnections() {
    if (!party.connected) return;
    Object.keys(party.members).forEach(function (peerId) {
        if (peerId === party.id) return;
        const pc = partyEnsurePeer(peerId);
        if (String(party.id) >= String(peerId)) return;
        const lastOffer = pc.userData.lastOffer || 0;
        if (pc.connectionState !== 'connected' && Date.now() - lastOffer > 5500) {
            pc.userData.offered = false;
            partyOffer(peerId);
        }
    });
}

function partyEnsurePeer(peerId) {
    if (party.pcs[peerId]) return party.pcs[peerId];
    const pc = new RTCPeerConnection(PARTY_ICE);
    pc.userData = { offered: false, pendingIce: [] };
    party.pcs[peerId] = pc;
    pc.onicecandidate = function (event) {
        if (event.candidate) partySend(peerId, { kind: 'ice', candidate: event.candidate });
    };
    pc.ontrack = function (event) {
        partyAttachStream(peerId, event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'failed') {
            try { pc.close(); } catch (e) {}
            delete party.pcs[peerId];
        } else if (pc.connectionState === 'disconnected') {
            pc.restartIce && pc.restartIce();
        }
    };
    if (party.localStream) {
        party.localStream.getAudioTracks().forEach(function (track) {
            pc.addTrack(track, party.localStream);
        });
    }
    return pc;
}

async function partyOffer(peerId) {
    const pc = partyEnsurePeer(peerId);
    if (pc.userData.offered) return;
    pc.userData.offered = true;
    try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        pc.userData.lastOffer = Date.now();
        partySend(peerId, { kind: 'offer', sdp: pc.localDescription });
    } catch (e) {
        pc.userData.offered = false;
    }
}

async function partyHandleSignal(payload) {
    if (!payload || String(payload.to) !== String(party.id) || !party.connected) return;
    const peerId = String(payload.from || '');
    if (!peerId || peerId === party.id) return;
    const pc = partyEnsurePeer(peerId);
    try {
        if (payload.kind === 'offer') {
            if (pc.signalingState !== 'stable') {
                try { await pc.setLocalDescription({ type: 'rollback' }); } catch (e) {}
            }
            await pc.setRemoteDescription(payload.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            partySend(peerId, { kind: 'answer', sdp: pc.localDescription });
            while (pc.userData.pendingIce.length) {
                try { await pc.addIceCandidate(pc.userData.pendingIce.shift()); } catch (e) {}
            }
        } else if (payload.kind === 'answer') {
            await pc.setRemoteDescription(payload.sdp);
            while (pc.userData.pendingIce.length) {
                try { await pc.addIceCandidate(pc.userData.pendingIce.shift()); } catch (e) {}
            }
        } else if (payload.kind === 'ice' && payload.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
            else pc.userData.pendingIce.push(payload.candidate);
        }
    } catch (e) {
        party.status = 'Voice connection issue — retrying.';
        partyRender();
    }
}

function partyAttachStream(peerId, stream) {
    // Route remote voice through Web Audio with extra gain + compression so
    // party chat can be made noticeably louder than a normal audio element.
    if (!partyAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            try { partyAudioCtx = new AC(); } catch (e) { partyAudioCtx = null; }
        }
    }
    if (partyAudioCtx && partyAudioCtx.createMediaStreamSource) {
        try {
            if (partyGains[peerId]) {
                try { partyGains[peerId].source.disconnect(); } catch (e) {}
                try { partyGains[peerId].gain.disconnect(); } catch (e) {}
                try { partyGains[peerId].compressor.disconnect(); } catch (e) {}
                delete partyGains[peerId];
            }
            const source = partyAudioCtx.createMediaStreamSource(stream);
            const gain = partyAudioCtx.createGain();
            gain.gain.value = 2.7;
            const compressor = partyAudioCtx.createDynamicsCompressor();
            compressor.threshold.value = -16;
            compressor.knee.value = 12;
            compressor.ratio.value = 8;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.22;
            source.connect(gain);
            gain.connect(compressor);
            compressor.connect(partyAudioCtx.destination);
            partyGains[peerId] = { source: source, gain: gain, compressor: compressor };
            if (partyAudioCtx.state === 'suspended') {
                const resumed = partyAudioCtx.resume();
                if (resumed && resumed.catch) resumed.catch(function () {});
            }
            partyRender();
            return;
        } catch (e) {}
    }
    let audio = party.audios[peerId];
    if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        party.audios[peerId] = audio;
    }
    audio.volume = 1;
    audio.srcObject = stream;
    const played = audio.play();
    if (played && played.catch) played.catch(function () {});
    partyRender();
}

function partyClosePeer(peerId) {
    const pc = party.pcs[peerId];
    if (pc) {
        try { pc.close(); } catch (e) {}
        delete party.pcs[peerId];
    }
    if (partyGains[peerId]) {
        try { partyGains[peerId].source.disconnect(); } catch (e) {}
        try { partyGains[peerId].gain.disconnect(); } catch (e) {}
        try { partyGains[peerId].compressor.disconnect(); } catch (e) {}
        delete partyGains[peerId];
    }
    const audio = party.audios[peerId];
    if (audio) {
        try { audio.srcObject = null; } catch (e) {}
        if (audio.parentNode) audio.parentNode.removeChild(audio);
        delete party.audios[peerId];
    }
}

async function togglePartyMic() {
    if (!party.connected) {
        showGameToast('Join a voice party first.');
        return;
    }
    if (!party.localStream) {
        const ok = await partyEnsureMic();
        if (!ok) {
            partySetStatus('Microphone permission was denied.');
            return;
        }
        party.localStream.getAudioTracks().forEach(function (track) { track.enabled = true; });
        party.micOn = true;
        Object.keys(party.pcs).forEach(function (peerId) {
            const pc = party.pcs[peerId];
            party.localStream.getAudioTracks().forEach(function (track) { pc.addTrack(track, party.localStream); });
            pc.userData.offered = false;
            partyOffer(peerId);
        });
    } else {
        party.micOn = !party.micOn;
        party.localStream.getAudioTracks().forEach(function (track) { track.enabled = party.micOn; });
    }
    partyPub();
    partyRender();
    showGameToast(party.micOn ? 'Microphone on' : 'Microphone muted');
}

function copyPartyCode() {
    if (!party.code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(party.code).then(function () {
            showGameToast('Party code ' + party.code + ' copied.');
        }).catch(function () {});
    }
}

function leaveParty(quiet) {
    if (partyRetryTimer) { clearInterval(partyRetryTimer); partyRetryTimer = 0; }
    Object.keys(party.pcs).forEach(partyClosePeer);
    const channel = party.channel;
    party.channel = null;
    party.connected = false;
    if (channel) {
        try {
            const left = channel.untrack();
            if (left && left.catch) left.catch(function () {});
        } catch (e) {}
        if (supabaseClient && supabaseClient.removeChannel) {
            try { supabaseClient.removeChannel(channel); } catch (e) {}
        }
    }
    if (party.localStream) {
        party.localStream.getTracks().forEach(function (track) { try { track.stop(); } catch (e) {} });
    }
    party.localStream = null;
    partyGains = {};
    if (partyAudioCtx) {
        try { partyAudioCtx.close(); } catch (e) {}
        partyAudioCtx = null;
    }
    party.micOn = false;
    party.members = {};
    party.code = '';
    party.status = '';
    partyRender();
    if (!quiet) showGameToast('Call ended.');
}

function callFriendNames() {
    const me = friendUsername();
    if (!me) return [];
    const names = [];
    (friendData.friendships || []).forEach(function (row) {
        if (row.status !== 'accepted') return;
        const other = row.requester === me ? row.recipient : row.requester;
        if (other && other !== me && names.indexOf(other) < 0) names.push(other);
    });
    return names.sort(function (a, b) { return a.localeCompare(b); });
}

function sendCallSignal(event, payload) {
    if (!activityChannel || !activitySubscribed) return false;
    try {
        const sent = activityChannel.send({ type: 'broadcast', event: event, payload: payload });
        if (sent && sent.catch) sent.catch(function () {});
        return true;
    } catch (e) {
        return false;
    }
}

function handleCallInvite(payload) {
    // Voice chat has been removed. Incoming call invites are ignored.
    return;
}
/* Voice-chat helpers remain below but have no UI entry points. */

function handleCallDecline(payload) {
    const me = friendUsername();
    if (!me || !payload || payload.to !== me) return;
    showGameToast(payload.from + (payload.reason === 'busy' ? ' is on another call.' : ' declined the call.'));
}

function acceptIncomingCall() {
    const call = pendingCall;
    pendingCall = null;
    const modal = document.getElementById('callModal');
    if (modal) modal.style.display = 'none';
    if (!call) return;
    partyJoinWithCode(call.code);
    showGameToast('Joining ' + call.from + '’s call…');
}

function declineIncomingCall() {
    const call = pendingCall;
    pendingCall = null;
    const modal = document.getElementById('callModal');
    if (modal) modal.style.display = 'none';
    const me = friendUsername();
    if (call && me) {
        sendCallSignal('call-decline', { from: me, to: call.from, code: call.code, reason: 'declined' });
    }
}

async function startDirectCall(name) {
    if (!friendUsername()) { openAuthModal(); return; }
    if (!name) return;
    if (party.connected) {
        inviteFriendToCall(name, party.code, false);
        return;
    }
    const code = partyMakeCode();
    showGameToast('Calling ' + name + '…');
    partyJoinWithCode(code);
    setTimeout(function () { inviteFriendToCall(name, code, false); }, 450);
}

function callSelectedFriend() {
    const select = document.getElementById('callFriendSelect');
    const name = select ? select.value : '';
    if (!name) {
        showGameToast('Add a friend first, then call them.');
        return;
    }
    startDirectCall(name);
}

function startGroupCall() {
    if (!friendUsername()) { openAuthModal(); return; }
    if (party.connected) {
        showGameToast('Your call is already open — invite friends from the list.');
        partyRender();
        return;
    }
    partyJoinWithCode(partyMakeCode());
    showGameToast('Group call started. Invite friends from Calls.');
}

function inviteFriendToCall(name, code, isGroup) {
    if (!friendUsername()) { openAuthModal(); return; }
    if (!name) return;
    const callCode = code || party.code;
    if (!callCode) {
        showGameToast('Start a call first.');
        return;
    }
    sendInviteWithRetry(name, callCode, !!isGroup || partyMemberList().length > 2, 0);
}

function sendInviteWithRetry(name, code, isGroup, attempt) {
    const sent = sendCallSignal('call-invite', {
        from: friendUsername(),
        to: name,
        code: code,
        group: !!isGroup
    });
    if (sent) {
        showGameToast('Call invite sent to ' + name + '.');
        return;
    }
    if (attempt < 5) {
        setTimeout(function () { sendInviteWithRetry(name, code, isGroup, attempt + 1); }, 800);
    } else {
        showGameToast('Could not reach ' + name + '. They need to be signed in.');
    }
}

function ensureCallLayer(el) {
    if (!el) return;
    const fs = document.fullscreenElement;
    if (fs && fs.appendChild && el.parentNode !== fs) {
        try { fs.appendChild(el); } catch (e) {}
    } else if (!fs && el.parentNode !== document.body) {
        try { document.body.appendChild(el); } catch (e) {}
    }
}

function openCallInviteModal() {
    const modal = document.getElementById('callInviteModal');
    if (!modal) return;
    ensureCallLayer(modal);
    modal.style.display = 'flex';
    const input = document.getElementById('callInviteUser');
    if (input) {
        input.value = '';
        input.oninput = function () { searchCallUsers(this.value); };
    }
    const results = document.getElementById('callInviteResults');
    if (results) results.innerHTML = '';
    setTimeout(function () { if (input) input.focus(); }, 60);
}

function closeCallInviteModal() {
    const modal = document.getElementById('callInviteModal');
    if (modal) modal.style.display = 'none';
}

function searchCallUsers(value) {
    const query = String(value || '').trim().replace(/[%_]/g, '');
    const results = document.getElementById('callInviteResults');
    if (!results) return;
    if (!query || !supabaseClient) { results.innerHTML = ''; return; }
    if (callInviteSearchTimer) clearTimeout(callInviteSearchTimer);
    callInviteSearchTimer = setTimeout(async function () {
        const res = await socialQuery(supabaseClient.from('users').select('username').ilike('username', '%' + query + '%').limit(8));
        const me = friendUsername();
        if (res.error) { results.innerHTML = '<p class="party-status">Search unavailable.</p>'; return; }
        const names = (res.data || []).map(function (row) { return row.username; }).filter(function (name) { return name && name !== me; });
        results.innerHTML = names.map(function (name) {
            return '<button type="button" class="call-invite-result" onclick="pickCallInvite(\'' + debugArg(name) + '\')">' + escapeHtml(name) + '</button>';
        }).join('');
    }, 220);
}

function pickCallInvite(name) {
    const input = document.getElementById('callInviteUser');
    if (input) input.value = name;
    const results = document.getElementById('callInviteResults');
    if (results) results.innerHTML = '';
}

function sendCallInviteFromModal() {
    const input = document.getElementById('callInviteUser');
    const name = String(input ? input.value : '').trim();
    if (!name) { showGameToast('Enter a username.'); return; }
    if (!friendUsername()) { openAuthModal(); return; }
    closeCallInviteModal();
    if (!party.connected) {
        partyJoinWithCode(partyMakeCode());
        showGameToast('Starting a call and inviting ' + name + '…');
        setTimeout(function () { sendInviteWithRetry(name, party.code, true, 0); }, 600);
    } else {
        sendInviteWithRetry(name, party.code, true, 0);
    }
}

async function loadCallInviteUsers() {
    if (!supabaseClient || callInviteUsersLoaded) return;
    callInviteUsersLoaded = true;
    const res = await socialQuery(supabaseClient.from('users').select('username').order('username', { ascending: true }).limit(500));
    if (!res.error && res.data) {
        callInviteUsers = res.data.map(function (row) { return row.username; }).filter(Boolean);
        partyRender();
    }
}

function callInviteDropdownHtml() {
    const me = friendUsername();
    const memberNames = {};
    partyMemberList().forEach(function (member) { memberNames[String(member.username).toLowerCase()] = true; });
    const options = callInviteUsers.filter(function (name) {
        return name && name !== me && !memberNames[String(name).toLowerCase()];
    }).map(function (name) {
        return '<option value="' + escapeAttr(name) + '">' + escapeHtml(name) + '</option>';
    }).join('');
    return '<div class="call-invite-row">' +
        '<select id="callInviteSelect" class="party-code-input" style="letter-spacing:0;text-transform:none;font-weight:500;">' +
            '<option value="">' + (options ? 'Choose a player to invite…' : 'No players available') + '</option>' + options +
        '</select>' +
        '<button type="button" class="friends-refresh" onclick="inviteSelectedCallUser()">Invite</button>' +
    '</div>';
}

function inviteSelectedCallUser() {
    const select = document.getElementById('callInviteSelect');
    const name = select ? select.value : '';
    if (!name) { showGameToast('Choose a player to invite.'); return; }
    if (!friendUsername()) { openAuthModal(); return; }
    if (!party.connected) {
        partyJoinWithCode(partyMakeCode());
        showGameToast('Starting a call and inviting ' + name + '…');
        setTimeout(function () { sendInviteWithRetry(name, party.code, true, 0); }, 600);
    } else {
        sendInviteWithRetry(name, party.code, true, 0);
    }
}

function partyMemberList() {
    return Object.keys(party.members).map(function (id) { return party.members[id]; })
        .sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
}

function partyRender() {
    const host = document.getElementById('partyBody');
    const widget = document.getElementById('partyWidget');
    if (widget) {
        widget.style.display = party.connected ? 'flex' : 'none';
        const codeEl = document.getElementById('partyWidgetCode');
        if (codeEl) codeEl.textContent = 'Call ' + party.code;
        const countEl = document.getElementById('partyWidgetMembers');
        if (countEl) countEl.textContent = partyMemberList().length + '/' + PARTY_MAX;
        const micBtn = document.getElementById('partyWidgetMic');
        if (micBtn) {
            micBtn.textContent = party.micOn ? 'Mic On' : 'Mic Off';
            micBtn.classList.toggle('is-muted', !party.micOn);
        }
    }
    if (!host) return;
    if (!callInviteUsersLoaded) loadCallInviteUsers();
    const friends = callFriendNames();
    if (!party.connected) {
        const options = friends.length
            ? friends.map(function (name) { return '<option value="' + escapeAttr(name) + '">' + escapeHtml(name) + '</option>'; }).join('')
            : '<option value="">Add friends to call them</option>';
        host.innerHTML =
            '<div class="party-start">' +
                '<div class="call-friend-row">' +
                    '<select id="callFriendSelect" class="party-code-input" style="letter-spacing:0;text-transform:none;font-weight:500;">' + options + '</select>' +
                    '<button type="button" class="friends-gift" onclick="callSelectedFriend()">Call</button>' +
                '</div>' +
                '<button type="button" class="friends-refresh" onclick="startGroupCall()">Start group call</button>' +
                callInviteDropdownHtml() +
                '<div class="party-join-row">' +
                    '<input id="partyCodeInput" class="party-code-input" maxlength="5" placeholder="CALL CODE" autocapitalize="characters">' +
                    '<button type="button" class="friends-refresh" onclick="joinVoicePartyFromInput()">Join</button>' +
                '</div>' +
                '<p class="party-status">' + escapeHtml(party.status || 'Call a friend, start a group call, or join with a code. Calls stay connected across the site.') + '</p>' +
            '</div>';
        return;
    }
    const members = partyMemberList();
    const memberNames = {};
    members.forEach(function (member) { memberNames[String(member.username).toLowerCase()] = true; });
    const invitees = friends.filter(function (name) { return !memberNames[String(name).toLowerCase()]; });
    host.innerHTML =
        '<div class="party-active">' +
            '<div class="party-code-row">' +
                '<span>Call code</span><strong>' + escapeHtml(party.code) + '</strong>' +
                '<button type="button" class="friends-refresh" onclick="copyPartyCode()">Copy</button>' +
            '</div>' +
            '<div class="party-controls">' +
                '<button type="button" class="party-mic-btn' + (party.micOn ? ' is-on' : '') + '" onclick="togglePartyMic()">' +
                    (party.micOn ? '🎙 Mic On' : '🔇 Mic Off') +
                '</button>' +
                '<span class="party-hint">Press V anywhere to toggle your mic</span>' +
            '</div>' +
            '<div class="party-members">' +
                members.map(function (member) {
                    return '<span class="party-member' + (member.id === party.id ? ' is-me' : '') + '">' +
                        '<span class="party-member-dot' + (member.mic ? ' is-live' : '') + '"></span>' +
                        escapeHtml(member.username) + (member.id === party.id ? ' (you)' : '') +
                    '</span>';
                }).join('') +
            '</div>' +
            (invitees.length
                ? '<div class="call-invite-list"><span class="call-invite-label">Invite friends</span>' +
                    invitees.map(function (name) {
                        return '<span class="call-invite-chip">' + escapeHtml(name) +
                            '<button type="button" onclick="inviteFriendToCall(\'' + debugArg(name) + '\',\'' + debugArg(party.code) + '\', true)">Call</button></span>';
                    }).join('') + '</div>'
                : '') +
            callInviteDropdownHtml() +
            '<p class="party-status">' + escapeHtml(party.status || (members.length + ' in the call.')) + '</p>' +
            '<button type="button" class="friends-refresh party-leave" onclick="leaveParty()">End call</button>' +
        '</div>';
}

function isEditableKeyTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

document.addEventListener('keydown', function (event) {
    if (event.repeat) return;
    if (event.key !== 'x' && event.key !== 'X') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isEditableKeyTarget(event.target)) return;
    const modal = document.getElementById('gameModal');
    if (!modal || modal.style.display === 'none') return;
    event.preventDefault();
    // Layered close: first the Messages sidebar, then the game itself.
    if (dmState.open) {
        toggleDmSidebar(false);
        return;
    }
    closeGame();
});

function resumePartyAudio() {
    if (partyAudioCtx && partyAudioCtx.state === 'suspended') {
        const resumed = partyAudioCtx.resume();
        if (resumed && resumed.catch) resumed.catch(function () {});
    }
}
document.addEventListener('pointerdown', resumePartyAudio, true);
document.addEventListener('keydown', resumePartyAudio, true);

const ZOMBIE_MP_ROOMS = [
    { id: 'public-1', name: 'Dead Coast · Public 1', channel: 'lessfun-zombie-public-1' },
    { id: 'public-2', name: 'Dead Coast · Public 2', channel: 'lessfun-zombie-public-2' },
    { id: 'public-3', name: 'Dead Coast · Public 3', channel: 'lessfun-zombie-public-3' }
];
let zombieMp = {
    room: null,
    channel: null,
    connected: false,
    id: '',
    name: '',
    players: {},
    timer: 0,
    panelOpen: false,
    status: ''
};

function zombieMpRoom(roomId) {
    return ZOMBIE_MP_ROOMS.filter(function (room) { return room.id === roomId; })[0] || ZOMBIE_MP_ROOMS[0];
}

function zombieMpSetStatus(text, isError) {
    zombieMp.status = text || '';
    const el = document.getElementById('g3dZombieStatus');
    if (el) {
        el.textContent = zombieMp.status;
        el.classList.toggle('is-error', !!isError);
    }
}

function zombieMpDisplayName() {
    if (currentUser && currentUser.type === 'user' && currentUser.username && currentUser.username !== 'Guest') {
        return racerMpSanitizeName(currentUser.username);
    }
    return racerMpSanitizeName(racerMpSuggestedName()) || 'Survivor';
}

function zombieMpIsHost() {
    if (!zombieMp.connected) return true;
    const ids = Object.keys(zombieMp.players).concat([zombieMp.id]).filter(Boolean).sort();
    return ids.length === 0 || ids[0] === zombieMp.id;
}

function zombieMpSend(name, payload) {
    if (!zombieMp.connected || !zombieMp.channel) return;
    const events = { hit: 'zombie-hit', attack: 'zombie-attack', revive: 'zombie-revive', loot: 'zombie-loot', kill: 'zombie-kill' };
    const event = events[name];
    if (!event) return;
    const body = Object.assign({ from: zombieMp.id }, payload || {});
    const sent = zombieMp.channel.send({ type: 'broadcast', event: event, payload: body });
    if (sent && sent.catch) sent.catch(function () {});
}

function zombieMpSyncAuthority() {
    if (!zombieMp.connected) return;
    const host = zombieMpIsHost();
    if (zombieMp.host === host) return;
    zombieMp.host = host;
    if (window.Games3D && window.Games3D.setZombieNet) {
        window.Games3D.setZombieNet(host, zombieMpSend, true);
    }
    if (host) zombieMpSetStatus('You are the host · zombies are shared with the room.');
}

function openZombieMpPanel() {
    zombieMp.panelOpen = true;
    const panel = document.getElementById('g3dZombieMpPanel');
    if (panel) panel.style.display = 'flex';
    if (window.Games3D) window.Games3D.setPaused(true);
    zombieMpRenderUi();
}

function closeZombieMpPanel(silent) {
    zombieMp.panelOpen = false;
    const panel = document.getElementById('g3dZombieMpPanel');
    if (panel) panel.style.display = 'none';
    if (!silent && window.Games3D) window.Games3D.setPaused(dmState.open);
}

function zombieMpJoin(roomId) {
    if (!supabaseClient) {
        zombieMpSetStatus('Multiplayer needs an online connection.', true);
        return;
    }
    const room = zombieMpRoom(roomId);
    zombieMpLeave(true);
    zombieMp.room = room;
    zombieMp.id = racerMpMakeId();
    zombieMp.name = zombieMpDisplayName();
    zombieMp.players = {};
    zombieMp.connected = false;
    zombieMpSetStatus('Joining ' + room.name + '…');
    const channel = supabaseClient.channel(room.channel, { config: { presence: { key: zombieMp.id } } });
    zombieMp.channel = channel;
    channel.on('broadcast', { event: 'zombie-state' }, function (message) {
        zombieMpHandleState(message && message.payload);
    });
    channel.on('broadcast', { event: 'zombie-world' }, function (message) {
        if (!zombieMpIsHost() && window.Games3D && window.Games3D.applyZombieWorld) {
            window.Games3D.applyZombieWorld(message && message.payload);
        }
    });
    channel.on('broadcast', { event: 'zombie-hit' }, function (message) {
        if (zombieMpIsHost() && window.Games3D && window.Games3D.applyZombieHit) {
            const payload = message && message.payload || {};
            window.Games3D.applyZombieHit(payload.zid, payload.damage, payload.headshot, payload.from);
        }
    });
    channel.on('broadcast', { event: 'zombie-kill' }, function (message) {
        const payload = message && message.payload || {};
        if (String(payload.target) === zombieMp.id && window.Games3D && window.Games3D.addZombieScore) {
            window.Games3D.addZombieScore(payload.points);
        }
    });
    channel.on('broadcast', { event: 'zombie-attack' }, function (message) {
        const payload = message && message.payload || {};
        if (String(payload.target) === zombieMp.id && window.Games3D && window.Games3D.applyZombieAttack) {
            window.Games3D.applyZombieAttack(payload.damage);
        }
    });
    channel.on('broadcast', { event: 'zombie-revive' }, function (message) {
        const payload = message && message.payload || {};
        if (String(payload.target) === zombieMp.id && window.Games3D && window.Games3D.reviveZombiePlayer) {
            window.Games3D.reviveZombiePlayer();
        }
    });
    channel.on('broadcast', { event: 'zombie-loot' }, function (message) {
        if (zombieMpIsHost() && window.Games3D && window.Games3D.applyLootedCrate) {
            const payload = message && message.payload || {};
            window.Games3D.applyLootedCrate(payload.index);
        }
    });
    channel.on('presence', { event: 'sync' }, zombieMpSyncPresence);
    channel.on('presence', { event: 'join' }, zombieMpSyncPresence);
    channel.on('presence', { event: 'leave' }, zombieMpSyncPresence);
    channel.subscribe(function (status) {
        if (zombieMp.channel !== channel) return;
        if (status === 'SUBSCRIBED') {
            zombieMp.connected = true;
            const tracked = channel.track({ id: zombieMp.id, name: zombieMp.name, joinedAt: Date.now() });
            if (tracked && tracked.catch) tracked.catch(function () {});
            if (zombieMp.timer) clearInterval(zombieMp.timer);
            zombieMp.timer = setInterval(zombieMpTick, 200);
            zombieMp.host = null;
            zombieMpSyncAuthority();
            zombieMpSetStatus('Connected to ' + room.name + ' · public room');
            closeZombieMpPanel(true);
            const menu = document.getElementById('g3dStartMenu');
            if (menu) menu.style.display = 'none';
            startMenuSuppressed = true;
            if (window.Games3D) window.Games3D.setPaused(false);
            zombieMpRenderUi();
            touchPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            zombieMp.connected = false;
            zombieMpSetStatus('Could not join that public room. Try another.', true);
            zombieMpRenderUi();
        }
    });
    zombieMpRenderUi();
}

function zombieMpHandleState(payload) {
    if (!payload || !payload.id || String(payload.id) === zombieMp.id) return;
    const id = String(payload.id);
    zombieMp.players[id] = {
        id: id,
        name: racerMpSanitizeName(payload.name) || 'Survivor',
        x: Number(payload.x) || 0,
        z: Number(payload.z) || 0,
        yaw: Number(payload.yaw) || 0,
        health: Math.max(0, Number(payload.health) || 0),
        score: Number(payload.score) || 0,
        wave: Number(payload.wave) || 1,
        lastSeen: Date.now()
    };
    zombieMpPushRemotes();
    zombieMpSyncAuthority();
    if (zombieMp.panelOpen) zombieMpRenderUi();
}

function zombieMpSyncPresence() {
    if (!zombieMp.channel || !zombieMp.connected) return;
    const state = zombieMp.channel.presenceState() || {};
    const seen = {};
    Object.keys(state).forEach(function (key) {
        (state[key] || []).forEach(function (entry) {
            if (!entry || !entry.id || String(entry.id) === zombieMp.id) return;
            const id = String(entry.id);
            seen[id] = true;
            if (zombieMp.players[id]) {
                zombieMp.players[id].name = racerMpSanitizeName(entry.name) || zombieMp.players[id].name;
            } else {
                zombieMp.players[id] = { id: id, name: racerMpSanitizeName(entry.name) || 'Survivor', x: 0, z: 0, yaw: 0, health: 100, score: 0, wave: 1, lastSeen: Date.now() };
            }
        });
    });
    Object.keys(zombieMp.players).forEach(function (id) {
        if (id !== zombieMp.id && !seen[id]) delete zombieMp.players[id];
    });
    zombieMpPushRemotes();
    zombieMpSyncAuthority();
    if (zombieMp.panelOpen) zombieMpRenderUi();
}

function zombieMpPushRemotes() {
    if (!window.Games3D || !window.Games3D.setZombieRemotes) return;
    const list = Object.keys(zombieMp.players)
        .filter(function (id) { return id !== zombieMp.id; })
        .map(function (id) { return zombieMp.players[id]; });
    window.Games3D.setZombieRemotes(list);
}

function zombieMpTick() {
    if (!zombieMp.connected || !zombieMp.channel || currentGameId !== 4) return;
    const local = window.Games3D && window.Games3D.getZombieState ? window.Games3D.getZombieState() : null;
    if (!local) return;
    zombieMp.players[zombieMp.id] = {
        id: zombieMp.id,
        name: zombieMp.name,
        x: local.x,
        z: local.z,
        yaw: local.yaw,
        health: local.health,
        score: local.score,
        wave: local.wave,
        lastSeen: Date.now()
    };
    const payload = {
        id: zombieMp.id,
        name: zombieMp.name,
        x: local.x,
        z: local.z,
        yaw: local.yaw,
        health: local.health,
        score: local.score,
        wave: local.wave
    };
    const sent = zombieMp.channel.send({ type: 'broadcast', event: 'zombie-state', payload: payload });
    if (sent && sent.catch) sent.catch(function () {});
    if (zombieMpIsHost() && window.Games3D && window.Games3D.getZombieWorld) {
        const world = window.Games3D.getZombieWorld();
        if (world) {
            const worldSent = zombieMp.channel.send({ type: 'broadcast', event: 'zombie-world', payload: world });
            if (worldSent && worldSent.catch) worldSent.catch(function () {});
        }
    }
    if (zombieMp.panelOpen) zombieMpRenderUi();
}

function zombieMpRenderUi() {
    const status = document.getElementById('g3dZombieStatus');
    if (status) {
        status.textContent = zombieMp.status || (zombieMp.connected ? 'Connected · share the room with friends.' : 'Pick a public room to play with others.');
        status.classList.toggle('is-error', false);
    }
    const list = document.getElementById('g3dZombieRoomList');
    if (list) {
        list.innerHTML = ZOMBIE_MP_ROOMS.map(function (room) {
            const active = zombieMp.connected && zombieMp.room && zombieMp.room.id === room.id;
            const count = active ? Object.keys(zombieMp.players).length : 0;
            return '<button type="button" class="zombie-room' + (active ? ' is-active' : '') + '" onclick="zombieMpJoin(\'' + debugArg(room.id) + '\')">' +
                '<span class="zombie-room-icon">☣</span>' +
                '<span class="zombie-room-info"><strong>' + escapeHtml(room.name) + '</strong><small>' +
                    (active ? count + ' survivor' + (count === 1 ? '' : 's') + ' connected' : 'Public room') +
                '</small></span>' +
                '<span class="zombie-room-join">' + (active ? 'Joined' : 'Join') + '</span>' +
            '</button>';
        }).join('');
    }
    const players = document.getElementById('g3dZombiePlayers');
    if (players) {
        const rows = Object.keys(zombieMp.players).map(function (id) { return zombieMp.players[id]; })
            .sort(function (a, b) { return Number(b.score) - Number(a.score); });
        players.innerHTML = rows.length ? rows.map(function (player) {
            return '<div class="game3d-mp-player' + (player.id === zombieMp.id ? ' is-host' : '') + '">' +
                '<span class="game3d-mp-player-name">' + escapeHtml(player.name) + (player.id === zombieMp.id ? ' (you)' : '') + '</span>' +
                '<strong class="arcade-player-score">' + Math.round(player.score).toLocaleString() + '</strong>' +
            '</div>';
        }).join('') : '<p class="game3d-mp-sub" style="margin:0;">No survivors connected yet.</p>';
    }
    const btn = document.getElementById('g3dZombieJoinBtn');
    if (btn) btn.textContent = zombieMp.connected ? 'Leave public room' : 'Join public room';
}

function zombieMpLeave(quiet) {
    if (zombieMp.timer) { clearInterval(zombieMp.timer); zombieMp.timer = 0; }
    const channel = zombieMp.channel;
    zombieMp.channel = null;
    zombieMp.connected = false;
    zombieMp.room = null;
    zombieMp.players = {};
    if (channel) {
        try { const left = channel.untrack(); if (left && left.catch) left.catch(function () {}); } catch (e) {}
        if (supabaseClient && supabaseClient.removeChannel) {
            try { const removed = supabaseClient.removeChannel(channel); if (removed && removed.catch) removed.catch(function () {}); } catch (e) {}
        }
    }
    if (window.Games3D && window.Games3D.setZombieRemotes) window.Games3D.setZombieRemotes([]);
    if (window.Games3D && window.Games3D.setZombieNet) window.Games3D.setZombieNet(true, null, false);
    zombieMp.host = null;
    const panel = document.getElementById('g3dZombieMpPanel');
    if (panel && !quiet) panel.style.display = 'none';
    zombieMp.panelOpen = false;
    if (!quiet) zombieMpSetStatus('Left the public room.');
    touchPresence();
}

function startActivityChannel() {
    if (!friendUsername() || !supabaseClient || activityChannel) return;
    const me = friendUsername();
    const channel = supabaseClient.channel('lessfun-activity', { config: { presence: { key: me } } });
    activityChannel = channel;
    function sync() {
        if (activityChannel !== channel) return;
        const state = channel.presenceState() || {};
        const next = {};
        Object.keys(state).forEach(function (key) {
            const entries = state[key] || [];
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i] || {};
                const name = entry.username || key;
                if (!name) continue;
                next[String(name).toLowerCase()] = {
                    name: name,
                    activity: entry.activity || '',
                    game: entry.game || '',
                    room: entry.room || '',
                    at: Number(entry.at) || 0
                };
            }
        });
        liveActivities = next;
        if (currentView === 'users') renderFriends();
    }
    channel.on('presence', { event: 'sync' }, sync);
    channel.on('presence', { event: 'join' }, sync);
    channel.on('presence', { event: 'leave' }, sync);
    channel.on('broadcast', { event: 'call-decline' }, function (message) {
        handleCallDecline(message && message.payload);
    });
    channel.on('broadcast', { event: 'gift-notify' }, function (message) {
        handleGiftNotify(message && message.payload);
    });
    channel.subscribe(function (status) {
        if (activityChannel !== channel) return;
        if (status === 'SUBSCRIBED') {
            activitySubscribed = true;
            publishActivity();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            activitySubscribed = false;
        }
    });
}

function publishActivity() {
    if (!activityChannel || !activitySubscribed) return;
    const me = friendUsername();
    if (!me) return;
    const info = currentActivityInfo();
    try {
        const tracked = activityChannel.track({
            username: me,
            activity: info.activity,
            game: info.game,
            room: info.room,
            at: Date.now()
        });
        if (tracked && tracked.catch) tracked.catch(function () {});
    } catch (e) {}
}

function stopActivityChannel() {
    activitySubscribed = false;
    liveActivities = {};
    const channel = activityChannel;
    activityChannel = null;
    if (channel && supabaseClient && supabaseClient.removeChannel) {
        try { supabaseClient.removeChannel(channel); } catch (e) {}
    }
}

function liveActivityList() {
    const me = friendUsername() || '';
    return Object.keys(liveActivities).map(function (key) { return liveActivities[key]; })
        .filter(function (entry) { return entry && entry.name && entry.name !== me; })
        .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
}

function joinLiveActivity(name, info) {
    if (!info) return;
    friendData.activities[name] = info;
    friendData.activities[String(name).toLowerCase()] = info;
    joinFriendActivity(name);
}

function currentActivityInfo() {
    if (typeof arcadeMp !== 'undefined' && arcadeMp && arcadeMp.connected && arcadeMp.gameId) {
        const game = games.find(function (g) { return g.id === arcadeMp.gameId; });
        return { activity: (game ? game.name : 'Game') + ' · Live', game: String(arcadeMp.gameId), room: 'arcade:' + arcadeMp.gameId };
    }
    if (racerMp.code && racerMp.public) {
        let index = 0;
        for (let i = 0; i < RACER_MP_PUBLIC_LOBBIES.length; i++) {
            if (RACER_MP_PUBLIC_LOBBIES[i].channel === racerMp.publicChannel) index = i;
        }
        return { activity: 'Beach Racer · ' + (racerMp.publicName || 'Public'), game: '1', room: 'public:' + index };
    }
    if (racerMp.code) {
        return { activity: 'Beach Racer · Private room', game: '1', room: '' };
    }
    if (currentGameId) {
        const game = games.find(function (g) { return g.id === currentGameId; });
        return { activity: 'Playing ' + (game ? game.name : 'a game'), game: String(currentGameId), room: '' };
    }
    if (currentView === 'store') return { activity: 'Browsing the Store', game: '', room: '' };
    if (currentView === 'community') return { activity: 'In the Community', game: '', room: '' };
    if (currentView === 'users') return { activity: 'Looking for friends', game: '', room: '' };
    return { activity: 'Browsing LessFun', game: '', room: '' };
}

function joinFriendActivity(name) {
    const info = friendData.activities[name] || friendData.activities[String(name || '').toLowerCase()];
    if (!info || !info.game) return;
    const gameId = Number(info.game);
    const me = friendUsername();
    if (!me) {
        openAuthModal();
        return;
    }
    openGame(gameId);
    setTimeout(function () {
        if (gameId === 1 && info.room && info.room.indexOf('public:') === 0) {
            const idx = Number(info.room.split(':')[1]) || 0;
            const lobby = RACER_MP_PUBLIC_LOBBIES[idx];
            if (lobby) {
                racerMp.name = racerMpSanitizeName(me);
                racerMpConnect(lobby.id, racerMp.name, { id: lobby.id, name: lobby.name, channel: lobby.channel });
            }
        } else if ((gameId === 2 || gameId === 5) && info.room && info.room.indexOf('arcade:') === 0) {
            arcadeMpJoin();
        }
    }, 450);
}

async function touchPresence() {
    const username = friendUsername();
    if (!username || !supabaseClient || presenceUnavailable) return;
    try {
        const info = currentActivityInfo();
        let res = await supabaseClient.from('user_presence').upsert({
            username: username,
            last_seen: new Date().toISOString(),
            activity: info.activity,
            game: info.game,
            room: info.room
        }, { onConflict: 'username' });
        if (res && res.error) {
            res = await supabaseClient.from('user_presence').upsert({
                username: username,
                last_seen: new Date().toISOString()
            }, { onConflict: 'username' });
            if (res && res.error && res.error.code === 'PGRST205') presenceUnavailable = true;
        }
        publishActivity();
    } catch (e) {}
}

function startPresence() {
    if (!friendUsername() || !supabaseClient) return;
    touchPresence();
    if (typeof radioPresenceConnect === 'function') radioPresenceConnect();
    startNotifications();
    startActivityChannel();
    if (!presenceTimer) {
        presenceTimer = setInterval(touchPresence, PRESENCE_HEARTBEAT_MS);
    }
    if (!friendsAutoTimer) {
        friendsAutoTimer = setInterval(function () {
            if (currentView === 'users') renderFriends();
        }, 30000);
    }
}

function stopPresence() {
    if (typeof radioPresenceDisconnect === 'function') radioPresenceDisconnect();
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = 0; }
    if (friendsAutoTimer) { clearInterval(friendsAutoTimer); friendsAutoTimer = 0; }
    stopNotifications();
    stopActivityChannel();
}

function friendRelationMap(friendships, me) {
    const rel = {};
    friendships.forEach(function (row) {
        const other = row.requester === me ? row.recipient : row.requester;
        if (!other) return;
        if (!rel[other] || row.status === 'accepted') rel[other] = row;
    });
    return rel;
}

function friendAvatar(name) {
    return userAvatarHtml(name, 'friend-avatar');
}

function friendPresenceHtml(name) {
    const lastSeen = friendData.presence[name] || friendData.presence[String(name).toLowerCase()];
    const online = isOnline(lastSeen);
    return '<span class="friend-presence' + (online ? ' is-online' : '') + '">' +
        '<span class="friends-dot"></span>' + escapeHtml(formatLastSeen(lastSeen)) +
    '</span>';
}

function renderNowPlaying() {
    const list = document.getElementById('nowPlayingList');
    const countEl = document.getElementById('nowPlayingCount');
    if (!list) return;
    const entries = liveActivityList();
    if (countEl) countEl.textContent = String(entries.length);
    if (!entries.length) {
        list.innerHTML = '<p class="friends-empty">No one is playing right now.</p>';
        return;
    }
    list.innerHTML = entries.slice(0, 24).map(function (entry) {
        const info = {
            activity: entry.activity || 'Online',
            game: entry.game || '',
            room: entry.room || ''
        };
        friendData.activities[entry.name] = info;
        friendData.activities[String(entry.name).toLowerCase()] = info;
        const joinable = info.game === '1' || info.game === '2' || info.game === '5';
        return '<div class="friend-row">' +
            userAvatarHtml(entry.name, 'friend-avatar') +
            '<div class="friend-main">' +
                '<span class="friend-name" onclick="openProfile(\'' + debugArg(entry.name) + '\')">' + escapeHtml(entry.name) + '</span>' +
                '<span class="friend-activity">' + escapeHtml(info.activity) + '</span>' +
            '</div>' +
            (joinable ? '<button type="button" class="friend-join" onclick="joinFriendActivity(\'' + debugArg(entry.name) + '\')">Join</button>' : '') +
        '</div>';
    }).join('');
}

async function renderFriends() {
    const friendsList = document.getElementById('friendsList');
    const usersList = document.getElementById('usersList');
    const requestsList = document.getElementById('friendRequests');
    const guestNote = document.getElementById('friendsGuestNote');
    const summary = document.getElementById('friendsSummaryText');
    const onlineCount = document.getElementById('friendsOnlineCount');
    const friendsCount = document.getElementById('friendsCount');
    if (!friendsList || !usersList) return;
    partyRender();

    const me = friendUsername();
    if (!me) {
        const nowGuest = document.getElementById('nowPlayingList');
        if (nowGuest) nowGuest.innerHTML = '<p class="friends-empty">Sign in to see what players are doing live.</p>';
        const nowCountGuest = document.getElementById('nowPlayingCount');
        if (nowCountGuest) nowCountGuest.textContent = '0';
        friendsList.innerHTML = '<p class="friends-empty">Sign in to build your friends list.</p>';
        usersList.innerHTML = '<p class="friends-empty">Sign in to find players.</p>';
        if (requestsList) requestsList.innerHTML = '';
        if (guestNote) guestNote.style.display = 'block';
        if (summary) summary.textContent = 'Sign in to add friends';
        if (onlineCount) onlineCount.textContent = '0';
        if (friendsCount) friendsCount.textContent = '0';
        return;
    }

    if (guestNote) guestNote.style.display = 'none';
    if (!supabaseClient) {
        friendsList.innerHTML = '<p class="friends-empty">Friends need a connection to Supabase.</p>';
        usersList.innerHTML = '';
        showFriendsStatus('Supabase is unavailable.', true);
        return;
    }

    friendsList.innerHTML = '<p class="friends-empty">Loading friends…</p>';
    usersList.innerHTML = '<p class="friends-empty">Loading players…</p>';
    if (requestsList) requestsList.innerHTML = '';

    const results = await Promise.all([
        socialQuery(supabaseClient.from('users').select('username, created_at, avatar').order('username', { ascending: true })),
        socialQuery(supabaseClient.from('friendships').select('*').eq('requester', me)),
        socialQuery(supabaseClient.from('friendships').select('*').eq('recipient', me)),
        socialQuery(supabaseClient.from('user_presence').select('*')),
        socialQuery(supabaseClient.from('wallets').select('username, shells, total_earned, streak')),
        socialQuery(supabaseClient.from('scores').select('username, game, score').order('score', { ascending: false }).limit(2000))
    ]);

    if (!friendUsername()) return;

    let users = results[0].data || [];
    if (results[0].error) {
        const fallbackUsers = await socialQuery(supabaseClient.from('users').select('username, created_at'));
        users = fallbackUsers.data || [];
    }
    if (!users.length) {
        const postsRes = await socialQuery(supabaseClient.from('posts').select('username'));
        const names = [];
        (postsRes.data || []).forEach(function (row) {
            if (row.username && names.indexOf(row.username) < 0) names.push(row.username);
        });
        users = names.map(function (name) { return { username: name }; });
    }
    if (!users.some(function (u) { return u.username === 'TotallyMason'; })) {
        users.push({ username: 'TotallyMason' });
    }

    const userInfo = {};
    users.forEach(function (user) {
        if (!user.username) return;
        userInfo[String(user.username).toLowerCase()] = user;
        rememberAvatar(user.username, user.avatar);
    });
    const wallets = {};
    (results[4].data || []).forEach(function (row) {
        if (row.username) {
            wallets[String(row.username).toLowerCase()] = {
                shells: Number(row.shells) || 0,
                earned: Number(row.total_earned) || 0,
                streak: Number(row.streak) || 0
            };
        }
    });
    const bestRuns = {};
    const runsByUser = {};
    const runCounts = {};
    const gameCounts = {};
    (results[5].data || []).forEach(function (row) {
        const key = String(row.username || '').toLowerCase();
        if (!key) return;
        const score = Number(row.score) || 0;
        const game = row.game || 'Game';
        if (!runsByUser[key]) runsByUser[key] = {};
        if (!gameCounts[key]) gameCounts[key] = {};
        gameCounts[key][game] = (gameCounts[key][game] || 0) + 1;
        runCounts[key] = (runCounts[key] || 0) + 1;
        if (!runsByUser[key][game] || score > runsByUser[key][game]) runsByUser[key][game] = score;
        if (!bestRuns[key] || score > bestRuns[key].score) {
            bestRuns[key] = { score: score, game: game };
        }
    });
    const friendCounts = {};
    (results[1].data || []).concat(results[2].data || []).forEach(function (row) {
        if (String(row.status || '') !== 'accepted') return;
        [row.requester, row.recipient].forEach(function (name) {
            const key = String(name || '').toLowerCase();
            if (key) friendCounts[key] = (friendCounts[key] || 0) + 1;
        });
    });

    function friendDetailsHtml(name) {
        const key = String(name || '').toLowerCase();
        const info = userInfo[key] || {};
        const joined = info.created_at ? new Date(info.created_at) : null;
        const joinedText = joined && !isNaN(joined.getTime())
            ? 'Joined ' + joined.toLocaleDateString([], { month: 'short', year: 'numeric' })
            : 'Joined recently';
        const walletInfo = wallets[key];
        const best = bestRuns[key];
        const runs = runsByUser[key] || {};
        const bestGames = Object.keys(runs)
            .sort(function (a, b) { return runs[b] - runs[a]; })
            .slice(0, 2)
            .map(function (game) { return game + ' ' + runs[game].toLocaleString(); })
            .join(' · ');
        const counts = gameCounts[key] || {};
        const favorite = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
        const seenText = isOnline(presence[key]) ? 'Online now' : (presence[key] ? 'Last seen ' + formatLastSeen(presence[key]) : 'Offline');
        return '<div class="friend-details">' +
            '<span class="friend-detail">' + escapeHtml(joinedText) + '</span>' +
            '<span class="friend-detail">' + escapeHtml(seenText) + '</span>' +
            '<span class="friend-detail">' + (friendCounts[key] || 0) + ' friends</span>' +
            '<span class="friend-detail">' + (runCounts[key] || 0) + ' runs</span>' +
            (favorite ? '<span class="friend-detail">Mostly ' + escapeHtml(favorite) + '</span>' : '') +
            '<span class="friend-detail">' + (walletInfo ? escapeHtml(walletInfo.shells.toLocaleString()) + ' Coins' : 'No wallet') + '</span>' +
            (walletInfo ? '<span class="friend-detail">Earned ' + escapeHtml(walletInfo.earned.toLocaleString()) + '</span>' : '') +
            (walletInfo && walletInfo.streak > 0 ? '<span class="friend-detail">' + walletInfo.streak + '-day streak</span>' : '') +
            (bestGames
                ? '<span class="friend-detail">Best ' + escapeHtml(bestGames) + '</span>'
                : (best ? '<span class="friend-detail">Best <strong>' + escapeHtml(best.score.toLocaleString()) + '</strong> · ' + escapeHtml(best.game) + '</span>' : '<span class="friend-detail">No scored runs</span>')) +
        '</div>';
    }

    function friendActivityHtml(name) {
        const key = String(name || '').toLowerCase();
        const info = friendData.activities[key] || friendData.activities[name];
        if (!info || !info.activity) return '';
        const gameId = Number(info.game) || 0;
        const joinable = gameId === 1 || gameId === 2 || gameId === 5;
        return '<div class="friend-activity-row">' +
            '<span class="friend-activity">' + escapeHtml(info.activity) + '</span>' +
            (joinable ? '<button type="button" class="friend-join" onclick="joinFriendActivity(\'' + debugArg(name) + '\')">Join</button>' : '') +
        '</div>';
    }

    const seen = {};
    const friendships = [];
    [results[1].data || [], results[2].data || []].forEach(function (list) {
        list.forEach(function (row) {
            if (!seen[row.id]) { seen[row.id] = true; friendships.push(row); }
        });
    });

    const presence = {};
    const activities = {};
    (results[3].data || []).forEach(function (row) {
        if (row.username) {
            presence[row.username] = row.last_seen;
            presence[String(row.username).toLowerCase()] = row.last_seen;
            activities[row.username] = { activity: row.activity || '', game: row.game || '', room: row.room || '' };
            activities[String(row.username).toLowerCase()] = activities[row.username];
        }
    });

    friendData = { friendships: friendships, presence: presence, users: users, activities: activities };
    renderNowPlaying();
    const rel = friendRelationMap(friendships, me);
    const friends = Object.keys(rel).filter(function (name) {
        return rel[name].status === 'accepted';
    }).sort(function (a, b) {
        const aOnline = isOnline(presence[a]) ? 1 : 0;
        const bOnline = isOnline(presence[b]) ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return a.localeCompare(b);
    });
    const incoming = friendships.filter(function (row) {
        return row.status === 'pending' && row.recipient === me;
    });
    const outgoing = friendships.filter(function (row) {
        return row.status === 'pending' && row.requester === me;
    });

    const onlineFriends = friends.filter(function (name) { return isOnline(presence[name]); }).length;
    if (onlineCount) onlineCount.textContent = onlineFriends;
    if (friendsCount) friendsCount.textContent = friends.length;
    if (summary) {
        summary.textContent = friends.length + (friends.length === 1 ? ' friend' : ' friends') +
            ' · ' + incoming.length + ' request' + (incoming.length === 1 ? '' : 's') +
            ' · updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (!friends.length) {
        friendsList.innerHTML = '<p class="friends-empty">No friends yet. Add someone from Find players below.</p>';
    } else {
        friendsList.innerHTML = friends.map(function (name) {
            const row = rel[name];
            return '<div class="friend-row">' +
                friendAvatar(name) +
                '<div class="friend-main">' +
                    '<span class="friend-name" onclick="openProfile(\'' + debugArg(name) + '\')">' + escapeHtml(name) + '</span>' +
                    friendPresenceHtml(name) +
                    friendActivityHtml(name) +
                    friendDetailsHtml(name) +
                '</div>' +
                '<button class="friend-action gift" onclick="openGiftModal(\'' + debugArg(name) + '\')">Gift</button>' +
                '<button class="friend-action remove" onclick="removeFriend(\'' + debugArg(String(row.id)) + '\',\'' + debugArg(name) + '\')">Remove</button>' +
            '</div>';
        }).join('');
    }

    if (requestsList) {
        requestsList.innerHTML = incoming.length ? '<h3 class="friends-subhead">Friend requests</h3>' + incoming.map(function (row) {
            return '<div class="friend-row is-request">' +
                friendAvatar(row.requester) +
                '<div class="friend-main">' +
                    '<span class="friend-name">' + escapeHtml(row.requester) + '</span>' +
                    '<span class="friend-presence">wants to be friends</span>' +
                '</div>' +
                '<div class="friend-row-actions">' +
                    '<button class="friend-action accept" onclick="respondFriendRequest(\'' + debugArg(String(row.id)) + '\',true)">Accept</button>' +
                    '<button class="friend-action decline" onclick="respondFriendRequest(\'' + debugArg(String(row.id)) + '\',false)">Decline</button>' +
                '</div>' +
            '</div>';
        }).join('') : '';
    }

    const search = String((document.getElementById('userSearch') || {}).value || '').trim().toLowerCase();
    const discover = users.filter(function (user) {
        if (!user.username || user.username === me) return false;
        return !search || String(user.username).toLowerCase().indexOf(search) >= 0;
    }).sort(function (a, b) {
        return String(a.username).localeCompare(String(b.username));
    });

    if (!discover.length) {
        usersList.innerHTML = '<p class="friends-empty">' + (search ? 'No players match that search.' : 'No other players yet.') + '</p>';
        return;
    }

    usersList.innerHTML = discover.map(function (user) {
        const name = user.username;
        const relation = rel[name];
        let action = '<button class="friend-action add" onclick="sendFriendRequest(\'' + debugArg(name) + '\')">Add friend</button>';
        if (relation && relation.status === 'accepted') {
            action = '<span class="friend-tag is-friend">Friends</span>';
        } else if (relation && relation.status === 'pending' && relation.recipient === me) {
            action = '<button class="friend-action accept" onclick="respondFriendRequest(\'' + debugArg(String(relation.id)) + '\',true)">Accept</button>' +
                '<button class="friend-action decline" onclick="respondFriendRequest(\'' + debugArg(String(relation.id)) + '\',false)">Decline</button>';
        } else if (relation && relation.status === 'pending') {
            action = '<span class="friend-tag is-pending">Requested</span>' +
                '<button class="friend-action decline" onclick="cancelFriendRequest(\'' + debugArg(String(relation.id)) + '\')">Cancel</button>';
        }
        return '<div class="friend-row">' +
            friendAvatar(name) +
            '<div class="friend-main">' +
                '<span class="friend-name" onclick="openProfile(\'' + debugArg(name) + '\')">' + escapeHtml(name) + '</span>' +
                friendActivityHtml(name) +
                friendDetailsHtml(name) +
                (relation && relation.status === 'accepted'
                    ? friendPresenceHtml(name)
                    : (relation && relation.status === 'pending' && relation.recipient === me
                        ? '<span class="friend-presence">Wants to be your friend</span>'
                        : (relation && relation.status === 'pending'
                            ? '<span class="friend-presence">Friend request sent</span>'
                            : '<span class="friend-presence">Not on your friends list</span>'))) +
            '</div>' +
            '<div class="friend-row-actions">' + action + '</div>' +
        '</div>';
    }).join('');
}

async function sendFriendRequest(username) {
    const me = friendUsername();
    if (!me) {
        showFriendsStatus('Sign in to add friends.', true);
        return;
    }
    if (!username || username === me) return;
    const res = await socialQuery(supabaseClient.from('friendships').insert({
        requester: me,
        recipient: username,
        status: 'pending'
    }));
    if (res.error) {
        if (String(res.error.code) === '23505') {
            showFriendsStatus('A request with ' + username + ' already exists.', true);
        } else {
            showFriendsStatus('Could not add friend: ' + (res.error.message || 'Unknown error'), true);
        }
        return;
    }
    showFriendsStatus('Friend request sent to ' + username + '.', false);
    await renderFriends();
}

async function respondFriendRequest(id, accept) {
    if (!friendUsername()) return;
    let res;
    if (accept) {
        res = await socialQuery(supabaseClient.from('friendships').update({
            status: 'accepted',
            updated_at: new Date().toISOString()
        }).eq('id', id));
    } else {
        res = await socialQuery(supabaseClient.from('friendships').delete().eq('id', id));
    }
    if (res.error) {
        showFriendsStatus('Could not update request: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showFriendsStatus(accept ? 'Friend request accepted.' : 'Friend request declined.', false);
    await renderFriends();
}

async function cancelFriendRequest(id) {
    const res = await socialQuery(supabaseClient.from('friendships').delete().eq('id', id));
    if (res.error) {
        showFriendsStatus('Could not cancel request: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showFriendsStatus('Friend request cancelled.', false);
    await renderFriends();
}

async function removeFriend(id, username) {
    if (!window.confirm('Remove ' + username + ' from your friends?')) return;
    const res = await socialQuery(supabaseClient.from('friendships').delete().eq('id', id));
    if (res.error) {
        showFriendsStatus('Could not remove friend: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    showFriendsStatus('Removed ' + username + '.', false);
    await renderFriends();
}

// Kept as an alias for older inline handlers.
async function renderUsers() {
    return renderFriends();
}

/* ============================================================
   LessFun Radio — real Singapore FM streams
   ============================================================ */
const RADIO_STATIONS = [
    { name: 'CNA 938', freq: '93.8', lang: 'News', url: 'https://22893.live.streamtheworld.com/938NOW_SC' },
    { name: 'Kiss92', freq: '92.0', lang: 'English', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KISS_92.mp3' },
    { name: 'One FM 91.3', freq: '91.3', lang: 'English', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ONE_FM_913.mp3' },
    { name: '96.3 Hao FM', freq: '96.3', lang: 'Chinese', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/HAO_963.mp3' },
    { name: 'UFM 100.3', freq: '100.3', lang: 'Chinese', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/UFM_1003.mp3' }
];
let radioIndex = 0;
let radioHasSource = false;

function radioStationLabel(station) {
    return station.name + ' · ' + station.freq + ' FM';
}

function radioRenderList() {
    var list = document.getElementById('radioList');
    if (!list) return;
    list.innerHTML = RADIO_STATIONS.map(function (station, index) {
        return '<button type="button" class="radio-station' + (index === radioIndex ? ' is-active' : '') + '" data-station="' + index + '" onclick="radioTune(' + index + ', true)">' +
            '<b>' + station.freq + '</b>' +
            '<span>' + station.name + '</span>' +
            '<small>' + station.lang + '</small>' +
        '</button>';
    }).join('');
}

function radioUpdateNow() {
    var station = RADIO_STATIONS[radioIndex] || RADIO_STATIONS[0];
    var now = document.getElementById('radioNow');
    if (now) now.textContent = radioStationLabel(station);
    var list = document.getElementById('radioList');
    if (list) {
        var buttons = list.querySelectorAll('.radio-station');
        for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle('is-active', Number(buttons[i].getAttribute('data-station')) === radioIndex);
    }
}

function radioSetStatus(text) {
    var status = document.getElementById('radioStatus');
    if (status) status.textContent = text;
}

function radioSetBuffering(on) {
    var wrap = document.getElementById('radioNowWrap');
    if (wrap) wrap.classList.toggle('is-buffering', !!on);
    var fab = document.getElementById('radioFab');
    if (fab) fab.classList.toggle('is-buffering', !!on);
    var playBtn = document.getElementById('radioPlayBtn');
    if (playBtn && on) playBtn.textContent = 'Loading…';
}

function radioInit() {
    var audio = document.getElementById('lessfunRadioAudio');
    if (!audio) return;
    try {
        var savedIndex = Number(localStorage.getItem('lessfun_radio_station'));
        if (isFinite(savedIndex) && savedIndex >= 0 && savedIndex < RADIO_STATIONS.length) radioIndex = Math.floor(savedIndex);
    } catch (e) {}
    try {
        var savedVolume = parseFloat(localStorage.getItem('lessfun_radio_volume'));
        if (isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) audio.volume = savedVolume;
        else audio.volume = 0.7;
    } catch (e) {
        audio.volume = 0.7;
    }
    var volume = document.getElementById('radioVolume');
    if (volume) volume.value = String(audio.volume);
    try {
        var savedCorner = localStorage.getItem('lessfun_radio_corner') || 'center';
        radioApplyCorner(savedCorner);
    } catch (e) {}
    radioRenderList();
    radioUpdateNow();
    var wasOff = false;
    try { wasOff = localStorage.getItem('lessfun_radio_off') === '1'; } catch (e) {}
    radioSetStatus(wasOff ? 'Radio off · play your own music' : 'Paused · tap Play');

    audio.addEventListener('playing', function () {
        radioHasSource = true;
        radioSetBuffering(false);
        if (window.radioWatchdog) { clearTimeout(window.radioWatchdog); window.radioWatchdog = 0; }
        radioPresenceConnect();
        radioPresenceTrack();
        radioSetStatus('LIVE · ' + (RADIO_STATIONS[radioIndex] ? RADIO_STATIONS[radioIndex].name : ''));
        var fab = document.getElementById('radioFab');
        if (fab) fab.classList.add('is-playing');
        var playBtn = document.getElementById('radioPlayBtn');
        if (playBtn) playBtn.textContent = 'Pause';
    });
    audio.addEventListener('pause', function () {
        radioSetBuffering(false);
        radioPresenceTrack();
        radioSetStatus('Paused');
        var fab = document.getElementById('radioFab');
        if (fab) fab.classList.remove('is-playing');
        var playBtn = document.getElementById('radioPlayBtn');
        if (playBtn) playBtn.textContent = 'Play';
    });
    audio.addEventListener('waiting', function () {
        if (!radioHasSource) return;
        radioSetBuffering(true);
        radioSetStatus('Buffering stream…');
    });
    audio.addEventListener('stalled', function () {
        if (!radioHasSource) return;
        radioSetBuffering(true);
        radioSetStatus('Buffering stream…');
    });
    audio.addEventListener('error', function () {
        if (!radioHasSource) return;
        radioSetBuffering(false);
        radioPresenceTrack();
        radioSetStatus('Stream unavailable · try another station');
        var fab = document.getElementById('radioFab');
        if (fab) fab.classList.remove('is-playing');
        var playBtn = document.getElementById('radioPlayBtn');
        if (playBtn) playBtn.textContent = 'Play';
    });
}

var radioPanelCloseTimer = 0;

function radioApplyCorner(corner) {
    var dock = document.getElementById('radioDock');
    if (!dock) return;
    dock.classList.remove('radio-tl', 'radio-tr', 'radio-bl', 'radio-br');
    if (corner === 'tl') dock.classList.add('radio-tl');
    else if (corner === 'tr') dock.classList.add('radio-tr');
    else if (corner === 'bl') dock.classList.add('radio-bl');
    else if (corner === 'br') dock.classList.add('radio-br');
}

function radioSetCorner(corner) {
    radioApplyCorner(corner);
    try { localStorage.setItem('lessfun_radio_corner', corner); } catch (e) {}
}

function radioTogglePanel(force) {
    var panel = document.getElementById('radioPanel');
    if (!panel) return;
    var isOpen = panel.classList.contains('is-open');
    var open = force === false ? false : (force === true ? true : !isOpen);
    if (radioPanelCloseTimer) { clearTimeout(radioPanelCloseTimer); radioPanelCloseTimer = 0; }
    var dock = document.getElementById('radioDock');
    if (open) {
        if (dock) dock.classList.add('is-panel-open');
        panel.style.display = 'flex';
        var audioEl = document.getElementById('lessfunRadioAudio');
        if (audioEl && !radioHasSource) {
            var prime = RADIO_STATIONS[radioIndex] || RADIO_STATIONS[0];
            if (prime) { audioEl.src = prime.url; audioEl.load(); }
        }
        // Let the browser paint the starting state before animating.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { panel.classList.add('is-open'); });
        });
        radioRenderList();
        radioUpdateNow();
    } else {
        panel.classList.remove('is-open');
        radioPanelCloseTimer = setTimeout(function () {
            radioPanelCloseTimer = 0;
            if (!panel.classList.contains('is-open')) {
                panel.style.display = 'none';
                if (dock) dock.classList.remove('is-panel-open');
            }
        }, 230);
    }
}

function radioTune(index, autoplay) {
    var audio = document.getElementById('lessfunRadioAudio');
    if (!audio || !RADIO_STATIONS.length) return;
    radioIndex = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    try { localStorage.setItem('lessfun_radio_station', String(radioIndex)); } catch (e) {}
    var station = RADIO_STATIONS[radioIndex];
    audio.src = station.url;
    radioHasSource = true;
    audio.load();
    radioUpdateNow();
    radioSetBuffering(true);
    radioSetStatus('Tuning to ' + station.freq + ' FM…');
    if (window.radioWatchdog) clearTimeout(window.radioWatchdog);
    window.radioWatchdog = setTimeout(function () {
        if (!radioHasSource || audio.paused) return;
        if (audio.readyState < 2) {
            try {
                audio.load();
                var retry = audio.play();
                if (retry && retry.catch) retry.catch(function () {});
                radioSetStatus('Retrying stream…');
            } catch (e) {}
        }
    }, 4500);
    if (autoplay) {
        var attempt = audio.play();
        if (attempt && attempt.catch) {
            attempt.catch(function () {
                radioSetBuffering(false);
                radioSetStatus('Tap Play to start audio');
            });
        }
    }
}

function radioTurnOff() {
    var audio = document.getElementById('lessfunRadioAudio');
    if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }
    radioHasSource = false;
    radioSetBuffering(false);
    radioPresenceTrack();
    try { localStorage.setItem('lessfun_radio_off', '1'); } catch (e) {}
    var playBtn = document.getElementById('radioPlayBtn');
    if (playBtn) playBtn.textContent = 'Play';
    var fab = document.getElementById('radioFab');
    if (fab) fab.classList.remove('is-playing');
    radioSetStatus('Radio off · play your own music');
}

function radioToggle() {
    var audio = document.getElementById('lessfunRadioAudio');
    if (!audio) return;
    try { localStorage.removeItem('lessfun_radio_off'); } catch (e) {}
    if (!radioHasSource) {
        radioTune(radioIndex, true);
        return;
    }
    if (audio.paused) {
        var attempt = audio.play();
        if (attempt && attempt.catch) {
            attempt.catch(function () { radioSetStatus('Tap Play again to allow audio'); });
        }
    } else {
        audio.pause();
    }
}

function radioNext(direction) {
    radioTune(radioIndex + direction, true);
}

function radioSetVolume(value) {
    var audio = document.getElementById('lessfunRadioAudio');
    var volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (audio) audio.volume = volume;
    try { localStorage.setItem('lessfun_radio_volume', String(volume)); } catch (e) {}
}


/* ---------------- Radio listener presence ---------------- */
let radioPresenceChannel = null;
let radioPresenceKey = '';
let radioPresenceSubscribed = false;
const RADIO_PRESENCE_CHANNEL = 'lessfun-radio-presence';

function radioPresenceName() {
    return (currentUser && currentUser.type === 'user' && currentUser.username) ? currentUser.username : '';
}

function radioPresenceDisconnect() {
    if (radioPresenceChannel && supabaseClient) {
        try { radioPresenceChannel.untrack(); } catch (e) {}
        try { supabaseClient.removeChannel(radioPresenceChannel); } catch (e) {}
    }
    radioPresenceChannel = null;
    radioPresenceKey = '';
    radioPresenceSubscribed = false;
}

function radioPresenceEntries() {
    const entries = [];
    if (!radioPresenceChannel) return entries;
    let state = {};
    try { state = radioPresenceChannel.presenceState() || {}; } catch (e) { return entries; }
    const seen = {};
    Object.keys(state).forEach(function (key) {
        (state[key] || []).forEach(function (meta) {
            if (!meta || !meta.station) return;
            const name = String(meta.username || '');
            if (!name) return;
            const dedupe = name + '|' + meta.station;
            if (seen[dedupe]) return;
            seen[dedupe] = true;
            entries.push({ username: name, station: String(meta.station), freq: String(meta.freq || '') });
        });
    });
    entries.sort(function (a, b) {
        return a.station === b.station ? a.username.localeCompare(b.username) : a.station.localeCompare(b.station);
    });
    return entries;
}

function radioRenderListeners() {
    const host = document.getElementById('radioListeners');
    if (!host) return;
    if (!radioPresenceName()) {
        host.innerHTML = '<p class="radio-listeners-empty">Sign in to see who is tuned in.</p>';
        return;
    }
    const entries = radioPresenceEntries();
    if (!entries.length) {
        host.innerHTML = '<p class="radio-listeners-empty">No one is tuned in yet.</p>';
        return;
    }
    host.innerHTML = entries.map(function (entry) {
        return '<span class="radio-listener"><b>' + escapeHtml(entry.username) + '</b><small>' + escapeHtml(entry.station) + (entry.freq ? ' · ' + escapeHtml(entry.freq) : '') + '</small></span>';
    }).join('');
}

function radioPresenceTrack() {
    if (!radioPresenceChannel) return;
    const audio = document.getElementById('lessfunRadioAudio');
    const playing = !!(audio && !audio.paused && radioHasSource);
    try {
        if (playing && RADIO_STATIONS[radioIndex]) {
            const station = RADIO_STATIONS[radioIndex];
            radioPresenceChannel.track({
                username: radioPresenceName(),
                station: station.name,
                freq: station.freq,
                at: Date.now()
            });
        } else {
            radioPresenceChannel.untrack();
        }
    } catch (e) {}
    setTimeout(radioRenderListeners, 60);
}

function radioPresenceConnect() {
    if (!supabaseClient) return null;
    const name = radioPresenceName();
    if (!name) { radioRenderListeners(); return null; }
    if (radioPresenceChannel && radioPresenceKey === name) return radioPresenceChannel;
    radioPresenceDisconnect();
    radioPresenceKey = name;
    try {
        const channel = supabaseClient.channel(RADIO_PRESENCE_CHANNEL, { config: { presence: { key: name } } });
        channel.on('presence', { event: 'sync' }, function () { radioRenderListeners(); });
        channel.on('presence', { event: 'join' }, function () { radioRenderListeners(); });
        channel.on('presence', { event: 'leave' }, function () { radioRenderListeners(); });
        channel.subscribe(function (status) {
            if (status === 'SUBSCRIBED') {
                radioPresenceSubscribed = true;
                radioPresenceTrack();
                radioRenderListeners();
            }
        });
        radioPresenceChannel = channel;
    } catch (e) {
        radioPresenceChannel = null;
    }
    return radioPresenceChannel;
}
