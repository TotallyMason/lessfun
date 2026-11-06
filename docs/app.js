/* LessFun */
const SUPABASE_URL = "https://yuuopbgzfrwcatmhuypr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ev9umZevWcT-AwVHTPQLnw_DHdpDHWR";
const supabaseClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const games = [
    { id: 1, name: "Beach Racer", description: "Outrun traffic on a five-lane coastal highway", icon: "beach", hasBrake: true, hasThrottle: true, controls: "W / ↑ throttle · S / ↓ brake · ← → steer · drift is automatic · Shift / N nitrous · F FSD · Q/E gears · right lane exits" },
    { id: 2, name: "Tunnel Rush", description: "Thread the neon tunnel at warp speed", icon: "tunnel", controls: "Left / Right or drag to rotate" },
    { id: 3, name: "Cube Stack", description: "Stack the tower as high as you can", icon: "blocks", controls: "Tap or press Space to drop" },
    { id: 5, name: "Star Dodger", description: "Weave through an asteroid storm", icon: "rocket", controls: "Arrow keys or drag to fly" }
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
    5: { name: 'Star Dodger', channel: 'lessfun-arcade-star-public' }
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
    status: ''
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
let renderScaleSetting = 0;
try {
    const savedScale = parseFloat(localStorage.getItem('lessfun_render_scale') || '0');
    if (isFinite(savedScale) && savedScale >= 0 && savedScale <= 1) renderScaleSetting = savedScale;
} catch (e) {}

function applyRenderScaleSetting() {
    if (window.Games3D && window.Games3D.setRenderScale) window.Games3D.setRenderScale(renderScaleSetting);
    const select = document.getElementById('renderScaleSelect');
    if (select) select.value = String(renderScaleSetting);
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
        "rocket": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M12 3c3 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 2-7 5-9Z"/><circle cx="12" cy="9" r="1.6"/><path d="M9 15l-2 4 3-1M15 15l2 4-3-1"/></svg>'
    };
    return icons[name] || '';
}

function showView(view) {
    if (view === 'debug' && (!isOwner() || !ownerUnlocked)) {
        alert('Owner tools are locked. Sign in as TotallyMason and unlock them first.');
        return;
    }
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
    else if (view === 'community') { document.getElementById('communityView').style.display = 'block'; document.getElementById('nav-community').classList.add('active'); renderCommunity(); }
    else if (view === 'users') { if(document.getElementById('usersView')){ document.getElementById('usersView').style.display = 'block'; document.getElementById('nav-users').classList.add('active'); renderFriends(); partyRender(); } }
    else if (view === 'store') { document.getElementById('storeView').style.display = 'block'; document.getElementById('nav-store').classList.add('active'); renderWalletUI(); renderStore(); }
    else if (view === 'garage') { document.getElementById('garageView').style.display = 'block'; var gnav = document.getElementById('nav-garage'); if (gnav) gnav.classList.add('active'); renderWalletUI(); renderGarage(); }
    else if (view === 'settings') { document.getElementById('settingsView').style.display = 'block'; document.getElementById('nav-settings').classList.add('active'); }
    else if (view === 'debug') { document.getElementById('debugView').style.display = 'block'; document.getElementById('nav-debug').classList.add('active'); renderDebugUsers(); }
    currentView = view;
    touchPresence();
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
        <div class="game-card${locked ? ' is-disabled' : ''}" onclick="openGame(${game.id})">
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
    const top = Math.round(((perf.topSpeed || 1) - 1) * 100);
    const accel = Math.round(((perf.accel || 1) - 1) * 100);
    const grip = Math.round(((perf.grip || 1) - 1) * 100);
    function chip(label, value, pct) {
        return '<span class="game3d-garage-chip"><strong>' + escapeHtml(label) + '</strong> ' + escapeHtml(value) +
            (pct != null ? ' <em class="' + (pct >= 0 ? 'is-up' : 'is-down') + '">' + (pct > 0 ? '+' : '') + pct + '%</em>' : '') + '</span>';
    }
    host.innerHTML =
        chip('Body', garageEquippedName('body'), top) +
        chip('Engine', garageEquippedName('engine'), accel) +
        chip('Aero', garageEquippedName('aero'), grip) +
        chip('Kit', garageEquippedName('kit'), null);
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

function garageMultiplayer() {
    garagePlay();
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

function garagePlay() {
    const garage = document.getElementById('g3dGarage');
    if (garage) garage.style.display = 'none';
    const shop = document.getElementById('g3dGarageShop');
    if (shop) shop.style.display = 'none';
    const wrap = document.querySelector('#modalGameBody .game3d-wrap');
    if (wrap) wrap.classList.remove('is-garage');
    garageSuppressed = true;
    restartGame3D();
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

function mobileShift(direction) {
    if (window.Games3D && window.Games3D.shiftGear) window.Games3D.shiftGear(direction > 0 ? 1 : -1);
}

function mobileFsd() {
    if (window.Games3D && window.Games3D.toggleFsd) window.Games3D.toggleFsd();
}

let currentGameId = null;
let garageSuppressed = false;
let startMenuSuppressed = false;
let mpRewardSessionClaimed = false;
let gameToastTimer = 0;

function openGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    if (arcadeMp.connected && arcadeMp.gameId && arcadeMp.gameId !== id) arcadeMpLeave(true);
    if (isGameDisabled(id)) {
        alert('This game is temporarily unavailable. Check back soon!');
        return;
    }
    currentGameId = id;
    document.getElementById('modalGameTitle').textContent = game.name;
    const body = document.getElementById('modalGameBody');
    body.innerHTML =
        '<div class="game3d-wrap">' +
            '<div class="game3d-hud">' +
                '<div class="game3d-glass">' +
                    '<strong class="game3d-glass-status" id="g3dExtra">-</strong>' +
                    (game.hasThrottle ? '<span class="game3d-glass-sep"></span><span class="game3d-glass-stat game3d-gear-pill"><small>Gear</small><strong id="g3dGear">1</strong></span>' : '') +
                    (game.hasThrottle ? '<span class="game3d-glass-sep"></span><span class="game3d-glass-stat game3d-cp-pill"><small>CP</small><strong id="g3dCheckpoint">0</strong></span>' : '') +
                    (game.hasThrottle ? '<span class="game3d-glass-sep"></span><span class="game3d-glass-stat game3d-coin-pill"><small>Coins</small><strong id="g3dRunCoins">0</strong></span>' : '') +
                '</div>' +
            '</div>' +
            '<div id="g3dCanvas" class="game3d-canvas"></div>' +
            '<div class="game3d-hint">' + (game.controls || '') + '</div>' +
            '<div class="game3d-perf" id="g3dPerf"><span id="g3dFps">-- FPS</span><span id="g3dRes">--</span></div>' +
            (game.hasThrottle ? '<button class="game3d-throttle" id="g3dThrottle" type="button">Throttle</button>' : '') +
            (game.hasBrake ? '<button class="game3d-brake" id="g3dBrake" type="button">Brake</button>' : '') +
            (game.hasThrottle ? '<div class="game3d-ignition" id="g3dIgnition"><span>Ignition</span><div class="game3d-bar-track"><div class="game3d-bar-fill" id="g3dIgnitionFill"></div></div></div>' : '') +
            (game.hasThrottle ? '<div class="game3d-nitro" id="g3dNitro"><span>N · NOS</span><div class="game3d-bar-track"><div class="game3d-bar-fill" id="g3dNitroFill"></div></div></div>' : '') +
            (game.hasThrottle ?
                '<div class="game3d-touch-controls">' +
                    '<button type="button" class="game3d-touch-btn is-nitro" onpointerdown="event.preventDefault();mobileHold(\'nitro\',true)" onpointerup="mobileHold(\'nitro\',false)" onpointercancel="mobileHold(\'nitro\',false)" onpointerleave="mobileHold(\'nitro\',false)">NOS</button>' +
                    '<button type="button" class="game3d-touch-btn is-drift" onpointerdown="event.preventDefault();mobileHold(\'drift\',true)" onpointerup="mobileHold(\'drift\',false)" onpointercancel="mobileHold(\'drift\',false)" onpointerleave="mobileHold(\'drift\',false)">Drift</button>' +
                    '<button type="button" class="game3d-touch-btn is-fsd" onpointerdown="event.preventDefault();mobileFsd()">FSD</button>' +
                    '<button type="button" class="game3d-touch-btn is-gear" onpointerdown="event.preventDefault();mobileShift(1)">▲</button>' +
                    '<button type="button" class="game3d-touch-btn is-gear is-down" onpointerdown="event.preventDefault();mobileShift(-1)">▼</button>' +
                '</div>' : '') +
            '<button class="game3d-msg-btn" id="g3dMsgBtn" type="button" onclick="toggleDmSidebar()">Messages</button>' +
            '<aside class="game3d-dm" id="g3dDmSidebar">' +
                '<div class="game3d-dm-head">' +
                    '<div><h3>Private messages</h3><p class="game3d-dm-secure">End-to-end encrypted</p></div>' +
                    '<button type="button" class="game3d-dm-x" onclick="toggleDmSidebar(false)">×</button>' +
                '</div>' +
                '<div class="game3d-dm-search">' +
                    '<input class="game3d-mp-input" id="g3dDmSearch" type="text" maxlength="24" placeholder="Search users…" oninput="dmSearchUsers(this.value)">' +
                    '<div class="game3d-dm-results" id="g3dDmResults"></div>' +
                '</div>' +
                '<div class="game3d-dm-body">' +
                    '<div class="game3d-dm-list" id="g3dDmList"></div>' +
                    '<div class="game3d-dm-thread-wrap">' +
                        '<div class="game3d-dm-thread" id="g3dDmThread"><p class="game3d-dm-empty">Search for a person above to start an encrypted chat.</p></div>' +
                        '<div class="game3d-dm-compose">' +
                            '<input class="game3d-mp-input" id="g3dDmInput" type="text" maxlength="500" placeholder="Write a message…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();dmSend();}">' +
                            '<button type="button" class="game3d-mp-primary" onclick="dmSend()">Send</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<p class="game3d-dm-status" id="g3dDmStatus"></p>' +
            '</aside>' +
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
                        '<p class="game3d-garage-sub">Orbit view · buy and equip parts in the Garage tab.</p>' +
                        '<div class="game3d-garage-stats" id="g3dGarageStats"></div>' +
                        '<div class="game3d-garage-actions">' +
                            '<button type="button" class="game3d-mp-primary" onclick="garagePlay()">Play</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="garageMultiplayer()">Multiplayer</button>' +
                            '<button type="button" class="game3d-mp-secondary" onclick="openGarageShop()">Garage</button>' +
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
            '<div class="game3d-crash" id="g3dCrashFlash"></div>' +
            (game.hasThrottle ? '<div class="game3d-fsd" id="g3dFsd"><span>FSD ACTIVE</span></div>' : '') +
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

    if (window.Games3D) {
        window.Games3D.start(id, document.getElementById('g3dCanvas'), {
            name: game.name,
            cosmetics: getEquippedCosmetics(),
            onScore: function (name, score) { saveScore(name, score); },
            onCoins: function (amount) { awardRunCoins(amount); },
            onGameOver: function (score, seconds) { handleGameOver(score, seconds); }
        });
        applyRenderScaleSetting();
        applySoundSetting();
        applyUnitSetting();
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
    if ((id === 2 || id === 5) && !startMenuSuppressed) {
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
    dmClose();
    if (window.Games3D) window.Games3D.stop();
    document.getElementById('gameModal').style.display = 'none';
    currentGameId = null;
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
    racerMp.timer = setInterval(racerMpTick, 100);
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
}

function racerMpLeave(quiet) {
    if (racerMp.timer) {
        clearInterval(racerMp.timer);
        racerMp.timer = 0;
    }
    var channel = racerMp.channel;
    racerMp.channel = null;
    racerMp.connected = false;
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
   Tunnel Rush / Star Dodger live public multiplayer
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
    rows: [],
    poll: 0,
    myKeys: null,
    keyCache: {},
    publicCache: {}
};

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
    if (!partners.length) {
        list.innerHTML = '<p class="game3d-dm-empty">No conversations yet.</p>';
        return;
    }
    list.innerHTML = partners.map(function (name) {
        return '<button type="button" class="game3d-dm-contact' + (name === dmState.contact ? ' is-active' : '') + '" onclick="dmOpenConversation(\'' + debugArg(name) + '\')">' +
            '<span class="game3d-dm-contact-dot"></span>' + escapeHtml(name) +
        '</button>';
    }).join('');
}

function dmRenderThread() {
    const thread = document.getElementById('g3dDmThread');
    if (!thread) return;
    if (!dmState.contact) {
        thread.innerHTML = '<p class="game3d-dm-empty">Pick a conversation or enter a username.</p>';
        return;
    }
    const me = currentUser ? currentUser.username : '';
    const rows = dmState.thread || [];
    if (!rows.length) {
        thread.innerHTML = '<p class="game3d-dm-empty">No messages with ' + escapeHtml(dmState.contact) + ' yet.</p>';
        return;
    }
    thread.innerHTML = rows.map(function (row) {
        const mine = row.sender === me;
        return '<div class="game3d-dm-msg' + (mine ? ' is-mine' : '') + '">' +
            '<span class="game3d-dm-msg-text">' + escapeHtml(row.text) + '</span>' +
            '<span class="game3d-dm-msg-time">' + escapeHtml(new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</span>' +
        '</div>';
    }).join('');
    thread.scrollTop = thread.scrollHeight;
}

async function dmLoadInbox() {
    if (!currentUser || currentUser.type !== 'user') {
        dmSetStatus('Sign in to use private messages.', true);
        return;
    }
    try {
        await dmEnsureKeys();
        await dmFetchRows();
        dmRenderList();
        if (dmState.contact) await dmRefreshThread(true);
        else dmRenderThread();
        dmSetStatus('Encrypted on this device.', false);
    } catch (e) {
        dmSetStatus(e.message || 'Could not open messages.', true);
    }
}

async function dmOpenConversation(username) {
    const name = String(username || '').trim();
    if (!name) return;
    dmState.contact = name;
    localStorage.setItem('lessfun_dm_contact', name);
    dmRenderList();
    await dmRefreshThread();
    const input = document.getElementById('g3dDmInput');
    if (input) input.focus();
}

async function dmRefreshThread(quiet) {
    if (!dmState.contact || !currentUser || currentUser.type !== 'user') return;
    try {
        const rows = await dmFetchRows();
        const me = currentUser.username;
        const contact = dmState.contact;
        const pair = rows.filter(function (row) {
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
    if (!dmState.contact) {
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
        dmSetStatus('');
        dmLoadInbox();
        if (dmState.poll) clearInterval(dmState.poll);
        dmState.poll = setInterval(function () {
            if (dmState.open && dmState.contact) dmRefreshThread(true);
        }, 5000);
    } else if (dmState.poll) {
        clearInterval(dmState.poll);
        dmState.poll = 0;
    }
    if (window.Games3D) window.Games3D.setPaused(wantOpen || racerMp.panelOpen);
}

function dmClose() {
    if (dmState.poll) { clearInterval(dmState.poll); dmState.poll = 0; }
    dmState.open = false;
    const panel = document.getElementById('g3dDmSidebar');
    const btn = document.getElementById('g3dMsgBtn');
    if (panel) panel.style.display = 'none';
    if (btn) btn.classList.remove('is-open');
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

    if (!isOwner()) {
        ownerUnlocked = false;
        if (currentView === 'debug') showView('games');
    }

    // Keep featured/disabled game markers correct after sign-in or logout.
    renderGames();
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
            currentUser={type:'user',username: username, persistScores: true, isAdmin: false, adminPowers: [], avatar: ''}; 
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
            currentUser={type:'user',username:data.username, persistScores: true, isAdmin: !!data.is_admin, adminPowers: parseAdminPowers(data.admin_powers), avatar: data.avatar || ''}; 
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
    { id: 'paint_coral', type: 'paint', name: 'Coral Cruiser', cost: 0, default: true, color: '#ef476f', threeColor: 0xef476f },
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
    { id: 'body_classic', type: 'body', name: 'Classic Cruiser', cost: 0, default: true, style: 'classic', color: '#ef476f', threeColor: 0xef476f },
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
    { id: 'body_beater', type: 'body', name: 'Free Beater', cost: 0, style: 'beater', color: '#8a6f5a', threeColor: 0x8a6f5a },
    { id: 'body_offroad', type: 'body', name: 'Off-Road Rig', cost: 2400, style: 'offroad', color: '#6a994e', threeColor: 0x6a994e },
    { id: 'body_gt', type: 'body', name: 'GT3 Coupe', cost: 3600, style: 'gt', color: '#118ab2', threeColor: 0x118ab2 },
    { id: 'body_super', type: 'body', name: 'Supercar', cost: 5200, style: 'super', color: '#ff2d55', threeColor: 0xff2d55 },

    // Engines (visual exhaust and glow only — never changes speed)
    { id: 'engine_stock', type: 'engine', name: 'Stock Engine', cost: 0, default: true, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
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
    { id: 'engine_lawnmower', type: 'engine', name: 'Free Lawnmower', cost: 0, style: 'lawnmower', color: '#7f8c8d', threeColor: 0x7f8c8d },
    { id: 'engine_v16', type: 'engine', name: 'V16 Titan', cost: 3600, style: 'v16', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'engine_plasma', type: 'engine', name: 'Plasma Drive', cost: 5200, style: 'plasma', color: '#c77dff', threeColor: 0xc77dff },

    // Aerodynamic parts (real grip and top-speed parts)
    { id: 'aero_stock', type: 'aero', name: 'Stock Aero', cost: 0, default: true, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'aero_splitter', type: 'aero', name: 'Carbon Splitter', cost: 700, style: 'splitter', color: '#2b2f36', threeColor: 0x2b2f36 },
    { id: 'aero_wing', type: 'aero', name: 'GT Rear Wing', cost: 1100, style: 'wing', color: '#1f242b', threeColor: 0x1f242b },
    { id: 'aero_diffuser', type: 'aero', name: 'Rear Diffuser', cost: 1500, style: 'diffuser', color: '#15191f', threeColor: 0x15191f },
    { id: 'aero_active', type: 'aero', name: 'Active Aero Pack', cost: 2800, style: 'active', color: '#4cc9f0', threeColor: 0x4cc9f0 },
    { id: 'aero_broken', type: 'aero', name: 'Free Broken Wing', cost: 0, style: 'broken', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'aero_gt3', type: 'aero', name: 'GT3 Aero', cost: 2200, style: 'gt3', color: '#1f242b', threeColor: 0x1f242b },
    { id: 'aero_ground', type: 'aero', name: 'Ground Effect', cost: 3000, style: 'ground', color: '#2ff6ff', threeColor: 0x2ff6ff },

    // Body kits (real grip and acceleration parts)
    { id: 'kit_stock', type: 'kit', name: 'Stock Body', cost: 0, default: true, style: 'stock', color: '#8d99ae', threeColor: 0x8d99ae },
    { id: 'kit_widebody', type: 'kit', name: 'Widebody Kit', cost: 900, style: 'widebody', color: '#ef476f', threeColor: 0xef476f },
    { id: 'kit_track', type: 'kit', name: 'Track Kit', cost: 1600, style: 'track', color: '#ffd166', threeColor: 0xffd166 },
    { id: 'kit_rally', type: 'kit', name: 'Rally Kit', cost: 2100, style: 'rally', color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'kit_hyper', type: 'kit', name: 'Hyper Kit', cost: 3200, style: 'hyper', color: '#b14dff', threeColor: 0xb14dff },
    { id: 'kit_rust', type: 'kit', name: 'Free Rust Kit', cost: 0, style: 'rust', color: '#8a6f5a', threeColor: 0x8a6f5a },
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
    { id: 'glow_off', type: 'glow', name: 'No Underglow', cost: 0, default: true, none: true, color: '#555a63', threeColor: 0x555a63 },
    { id: 'glow_pink', type: 'glow', name: 'Pink Haze', cost: 400, color: '#ff4d9d', threeColor: 0xff4d9d },
    { id: 'glow_cyan', type: 'glow', name: 'Cyan Pulse', cost: 450, color: '#22e6ff', threeColor: 0x22e6ff },
    { id: 'glow_lime', type: 'glow', name: 'Lime Glow', cost: 500, color: '#9dff00', threeColor: 0x9dff00 },
    { id: 'glow_purple', type: 'glow', name: 'Violet Glow', cost: 600, color: '#b14dff', threeColor: 0xb14dff },
    { id: 'glow_gold', type: 'glow', name: 'Golden Glow', cost: 900, color: '#ffcf4d', threeColor: 0xffcf4d },
    { id: 'glow_rainbow', type: 'glow', name: 'Rainbow Glow', cost: 1600, rainbow: true, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'glow_red', type: 'glow', name: 'Red Alert', cost: 500, color: '#ff3131', threeColor: 0xff3131 },
    { id: 'glow_blue', type: 'glow', name: 'Ice Blue', cost: 560, color: '#4dabf7', threeColor: 0x4dabf7 },
    { id: 'glow_white', type: 'glow', name: 'Pure White', cost: 720, color: '#f8f9fa', threeColor: 0xf8f9fa },
    { id: 'glow_sunset', type: 'glow', name: 'Sunset Fade', cost: 1050, rainbow: true, color: '#ff9f1c', threeColor: 0xff9f1c },

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
    { id: 'umbrella_sunset', type: 'umbrella', name: 'Sunset Stripes', cost: 720, color: '#ff7b00', threeColor: 0xff7b00 }
];

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
    beater:   { top: 0.82, accel: 0.84, grip: 0.90 }
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
    { type: 'glow', label: 'Underglow', blurb: 'Neon light pools under the car.' },
    { type: 'wheel', label: 'Wheels', blurb: 'Rims that pop against the sand.' },
    { type: 'trail', label: 'Exhaust Trails', blurb: 'Glowing streaks behind the rear bumper.' },
    { type: 'umbrella', label: 'Beach Umbrellas', blurb: 'Dress the whole shoreline in one colour.' }
];

const COSMETIC_TYPES = COSMETIC_CATEGORIES.map(function (category) { return category.type; });
const GLOBAL_COSMETIC_TYPES = ['theme', 'frame'];
const GARAGE_COSMETIC_TYPES = ['paint', 'body', 'engine', 'aero', 'kit', 'board', 'glow', 'wheel', 'trail', 'umbrella'];

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

function normalizeWallet(raw, username) {
    var w = raw || {};
    var inventory = Array.isArray(w.inventory) ? w.inventory.slice() : [];
    var equipped = Object.assign({}, w.equipped || {});

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

    return {
        username: username,
        shells: Number.isFinite(w.shells) ? Math.max(0, Math.floor(w.shells)) : SHELLS_START,
        inventory: inventory,
        equipped: equipped,
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

    if (!(currentUser && currentUser.type === 'user' && supabaseClient)) return;

    try {
        var res = await supabaseClient
            .from('wallets')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (token !== walletLoadToken) return;

        if (!res.error && res.data) {
            var remote = normalizeWallet(res.data, username);
            if (walletMutated || local.updatedAt > remote.updatedAt) {
                // The player earned or bought something while the request was
                // in flight. Keep the newer local copy and push it up.
                wallet = local;
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
                equipped: wallet.equipped,
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
            equipped: wallet.equipped,
            streak: wallet.streak,
            last_play_day: wallet.lastPlayDay,
            streak_rewards: wallet.streakRewards,
            total_earned: wallet.totalEarned,
            updated_at: new Date(wallet.updatedAt).toISOString()
        }, { onConflict: 'username' });
    } catch (e) {
        // Offline or table missing: localStorage remains the source of truth.
    }
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
    var bodyPerf = BODY_PERF[body ? body.style : 'classic'] || BODY_PERF.classic;
    var enginePerf = ENGINE_PERF[engine ? engine.style : 'stock'] || ENGINE_PERF.stock;
    var aeroPerf = AERO_PERF[aero ? aero.style : 'stock'] || AERO_PERF.stock;
    var kitPerf = KIT_PERF[kit ? kit.style : 'stock'] || KIT_PERF.stock;
    return {
        paint: paint ? paint.threeColor : 0xef476f,
        body: body ? body.style : 'classic',
        bodyColor: body ? body.threeColor : null,
        engine: engine ? engine.style : 'stock',
        engineColor: engine ? engine.threeColor : null,
        aeroStyle: aero ? aero.style : 'stock',
        kitStyle: kit ? kit.style : 'stock',
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
            if (pendingPostMedia) {
                alert('Could not attach that file. Make sure the community migration (supabase/community.sql) has been run.\n\n' + error.message);
            } else {
                alert(error.message);
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

async function renderCommunity() {
    const container = document.getElementById('communityPosts');
    if (!container) return;
    if (!supabaseClient) return;

    if (!communityPostsOpen()) {
        container.innerHTML = '<div class="community-closed-card"><strong>Community is taking a break.</strong><p>An owner has temporarily closed posts, replies, and reactions. Check back soon.</p></div>';
        return;
    }

    const results = await Promise.all([
        socialQuery(supabaseClient.from('posts').select('*').order('created_at', { ascending: false })),
        socialQuery(supabaseClient.from('post_replies').select('*').order('created_at', { ascending: true })),
        socialQuery(supabaseClient.from('post_reactions').select('*').order('created_at', { ascending: false })),
        socialQuery(supabaseClient.from('reply_reactions').select('*').order('created_at', { ascending: false }))
    ]);

    if (results[0].error) {
        container.innerHTML = '<div class="community-closed-card"><strong>Could not load posts.</strong><p>' + escapeHtml(results[0].error.message || 'Unknown error') + '</p></div>';
        return;
    }

    const posts = results[0].data || [];
    const replies = results[1].data || [];
    const postReactions = results[2].data || [];
    const replyReactions = results[3].data || [];
    const migrationMissing = !!(results[1].error || results[2].error || results[3].error);

    if (!posts.length) {
        container.innerHTML = '<p class="community-empty">No posts yet. Start the conversation.</p>';
        return;
    }

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
        }).join('');
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
        let res = await supabaseClient.from('users').select('banned, is_admin, admin_powers, avatar').eq('username', currentUser.username).maybeSingle();
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

const APP_VERSION = "LessFun Developer Beta 1.23.5";
const UPDATE_NOTES = "Call invites are now a user dropdown that works with anyone, and the engine buzz is removed by deleting the low sub-oscillator and keeping all audio sources stopped until the engine actually starts";

function checkForUpdates() {
    var lastVersion = localStorage.getItem('lessfun_version');
    if (lastVersion !== APP_VERSION) {
        setTimeout(function() {
            alert('New Update!\nVersion: ' + APP_VERSION);
        }, 500);
        localStorage.setItem('lessfun_version', APP_VERSION);
    }
}

document.addEventListener('DOMContentLoaded', ()=>{
    loadSiteSettings();
    renderGames();
    loadUser();
    verifyAccountState();
    initViewCounter();
    updateUserSection();
    loadWallet();
    startPresence();
    loadAvatarCache();
    checkForUpdates();
    applyRenderScaleSetting();
    applySoundSetting();
    applyUnitSetting();
});

document.addEventListener('visibilitychange', function () {
    if (!document.hidden) touchPresence();
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
        if (!res.error) notifRows = res.data || [];
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
    const me = friendUsername();
    if (!me || !payload || payload.to !== me || payload.from === me) return;
    if (party.connected) {
        sendCallSignal('call-decline', { from: me, to: payload.from, code: payload.code, reason: 'busy' });
        return;
    }
    pendingCall = payload;
    const modal = document.getElementById('callModal');
    const kicker = document.getElementById('callKicker');
    const caller = document.getElementById('callCaller');
    const sub = document.getElementById('callSub');
    if (kicker) kicker.textContent = payload.group ? 'GROUP CALL INVITE' : 'INCOMING CALL';
    if (caller) caller.textContent = payload.from;
    if (sub) sub.textContent = payload.group ? 'invited you to a group call' : 'is calling you';
    ensureCallLayer(modal);
    if (modal) modal.style.display = 'flex';
}

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
    if ((event.key === 'v' || event.key === 'V') && party.connected && !isEditableKeyTarget(event.target)) {
        event.preventDefault();
        togglePartyMic();
    }
});

function resumePartyAudio() {
    if (partyAudioCtx && partyAudioCtx.state === 'suspended') {
        const resumed = partyAudioCtx.resume();
        if (resumed && resumed.catch) resumed.catch(function () {});
    }
}
document.addEventListener('pointerdown', resumePartyAudio, true);
document.addEventListener('keydown', resumePartyAudio, true);

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
    channel.on('broadcast', { event: 'call-invite' }, function (message) {
        handleCallInvite(message && message.payload);
    });
    channel.on('broadcast', { event: 'call-decline' }, function (message) {
        handleCallDecline(message && message.payload);
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
    (results[5].data || []).forEach(function (row) {
        const key = String(row.username || '').toLowerCase();
        if (!key) return;
        const score = Number(row.score) || 0;
        const game = row.game || 'Game';
        if (!runsByUser[key]) runsByUser[key] = {};
        if (!runsByUser[key][game] || score > runsByUser[key][game]) runsByUser[key][game] = score;
        if (!bestRuns[key] || score > bestRuns[key].score) {
            bestRuns[key] = { score: score, game: game };
        }
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
        return '<div class="friend-details">' +
            '<span class="friend-detail">' + escapeHtml(joinedText) + '</span>' +
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
