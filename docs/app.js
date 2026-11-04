/* LessFun */
const SUPABASE_URL = "https://yuuopbgzfrwcatmhuypr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ev9umZevWcT-AwVHTPQLnw_DHdpDHWR";
const supabaseClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const games = [
    { id: 1, name: "Beach Racer", description: "Outrun traffic along the sunset coast", icon: "beach", hasBrake: true, controls: "Steer freely with ← → or drag · hold ↓ / S or BRAKE to slow" },
    { id: 2, name: "Tunnel Rush", description: "Thread the neon tunnel at warp speed", icon: "tunnel", controls: "Left / Right or drag to rotate" },
    { id: 3, name: "Cube Stack", description: "Stack the tower as high as you can", icon: "blocks", controls: "Tap or press Space to drop" },
    { id: 4, name: "Helix Drop", description: "Fall through the rotating helix", icon: "helix", controls: "Left / Right or drag to rotate" },
    { id: 5, name: "Star Dodger", description: "Weave through an asteroid storm", icon: "rocket", controls: "Arrow keys or drag to fly" }
];

let currentUser = null;
let currentView = 'games';
let ownerUnlocked = false;
let debugUsersCache = [];
let debugStatusTimer = 0;

function isOwner() {
    return !!(currentUser && currentUser.type === 'user' && currentUser.username === 'TotallyMason' && currentUser.persistScores !== false);
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
    document.getElementById('supportView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('communityView').style.display = 'none';
    if(document.getElementById('usersView')) document.getElementById('usersView').style.display = 'none';
    if(document.getElementById('debugView')) document.getElementById('debugView').style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('profileModal')) document.getElementById('profileModal').style.display = 'none';
    if (view === 'games') { document.getElementById('gamesView').style.display = 'block'; document.getElementById('nav-games').classList.add('active'); }
    else if (view === 'community') { document.getElementById('communityView').style.display = 'block'; document.getElementById('nav-community').classList.add('active'); renderCommunity(); }
    else if (view === 'users') { if(document.getElementById('usersView')){ document.getElementById('usersView').style.display = 'block'; document.getElementById('nav-users').classList.add('active'); renderUsers(); } }
    else if (view === 'store') { document.getElementById('storeView').style.display = 'block'; document.getElementById('nav-store').classList.add('active'); renderWalletUI(); renderStore(); }
    else if (view === 'support') { document.getElementById('supportView').style.display = 'block'; document.getElementById('nav-support').classList.add('active'); }
    else if (view === 'settings') { document.getElementById('settingsView').style.display = 'block'; document.getElementById('nav-settings').classList.add('active'); }
    else if (view === 'debug') { document.getElementById('debugView').style.display = 'block'; document.getElementById('nav-debug').classList.add('active'); renderDebugUsers(); }
    currentView = view;
}

function renderGames() {
    const gameList = document.getElementById('gameList');
    if (!gameList) return;
    gameList.innerHTML = games.map(game => `
        <div class="game-card" onclick="openGame(${game.id})">
            <div class="game-icon">${getIcon(game.icon).replace('width="24" height="24"', 'width="28" height="28"')}</div>
            <h3>${game.name}</h3>
            <p>${game.description}</p>
        </div>
    `).join('');
}

let currentGameId = null;

function openGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    currentGameId = id;
    document.getElementById('modalGameTitle').textContent = game.name;
    const body = document.getElementById('modalGameBody');
    body.innerHTML =
        '<div class="game3d-wrap">' +
            '<div class="game3d-hud">' +
                '<div class="game3d-pill"><span>Score</span><strong id="g3dScore">0</strong></div>' +
                '<div class="game3d-pill"><span>Status</span><strong id="g3dExtra">-</strong></div>' +
            '</div>' +
            '<div id="g3dCanvas" class="game3d-canvas"></div>' +
            '<div class="game3d-hint">' + (game.controls || '') + '</div>' +
            (game.hasBrake ? '<button class="game3d-brake" id="g3dBrake" type="button">Brake</button>' : '') +
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
            onGameOver: function (score, seconds) { handleGameOver(score, seconds); }
        });
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
}

function restartGame3D() {
    if (currentGameId != null) openGame(currentGameId);
}

function closeGame() {
    if (window.Games3D) window.Games3D.stop();
    document.getElementById('gameModal').style.display = 'none';
    currentGameId = null;
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

function closePromo() { const p=document.getElementById('promoBanner'); if(p) p.style.display='none'; }

function handleProfileNavClick() {
    if (currentUser && currentUser.type === 'user') {
        logout();
    } else {
        openAuthModal();
    }
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
    if (debugBtn) debugBtn.style.display = isOwner() ? 'flex' : 'none';

    if (!isOwner()) {
        ownerUnlocked = false;
        if (currentView === 'debug') showView('games');
    }
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

const DEBUG_TABS = ['overview', 'users', 'posts', 'wallets', 'scores', 'tools'];
let debugData = { users: [], posts: [], wallets: [], scores: [] };
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
        debugQuery(supabaseClient.from('scores').select('*').order('created_at', { ascending: false }).limit(500))
    ]);
    if (token !== debugLoadToken) return;

    debugErrors = {
        users: results[0].error,
        posts: results[1].error,
        wallets: results[2].error,
        scores: results[3].error
    };
    debugData = {
        users: results[0].data || [],
        posts: results[1].data || [],
        wallets: results[2].data || [],
        scores: results[3].data || []
    };
    debugUsersCache = debugData.users;

    const userCount = document.getElementById('debugUserCount');
    if (userCount) userCount.textContent = debugNum(debugData.users.length);
    const postCount = document.getElementById('debugPostCount');
    if (postCount) postCount.textContent = debugNum(debugData.posts.length);
    const walletCount = document.getElementById('debugWalletCount');
    if (walletCount) walletCount.textContent = debugNum(debugData.wallets.length);
    const scoreCount = document.getElementById('debugScoreCount');
    if (scoreCount) scoreCount.textContent = debugNum(debugData.scores.length);
    const shellsTotal = document.getElementById('debugShellsTotal');
    if (shellsTotal) shellsTotal.textContent = debugNum(debugData.wallets.reduce(function (sum, w) {
        return sum + (Number(w.shells) || 0);
    }, 0));

    renderDebugTab();

    const missing = [];
    ['users', 'posts', 'wallets', 'scores'].forEach(function (table) {
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
    renderDebugWallets();
    renderDebugScores();
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
            ['Wallets', debugNum(wallets.length), 'Shells balances'],
            ['Scores', debugNum(scores.length), 'recent runs loaded'],
            ['Shells in circulation', debugNum(shells), debugNum(totalEarned) + ' earned all-time'],
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

function renderDebugUsersTable() {
    const tbody = document.getElementById('debugUsers');
    if (!tbody) return;
    if (debugErrors.users && !debugData.users.length) {
        tbody.innerHTML = debugEmptyRow(4, 'Could not load accounts: ' + (debugErrors.users.message || 'Unknown error'));
        return;
    }
    const query = String((document.getElementById('debugUserSearch') || {}).value || '').trim().toLowerCase();
    const rows = debugData.users.filter(function (user) {
        return !query || String(user.username || '').toLowerCase().indexOf(query) >= 0;
    });

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(4, query ? 'No accounts match "' + query + '".' : 'No accounts yet.');
        return;
    }

    tbody.innerHTML = rows.map(function (user) {
        const isOwnerRow = user.username === 'TotallyMason';
        return '<tr>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(user.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(user.username || '') + (isOwnerRow ? '<span class="debug-owner-tag">OWNER</span>' : '') + '</span></div></td>' +
            '<td><code class="debug-password">' + escapeHtml(user.password || '') + '</code></td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(user.created_at)) + '</td>' +
            '<td class="debug-actions"><div class="debug-action-row">' +
                '<button class="debug-btn" onclick="resetDebugPassword(\'' + debugArg(user.username) + '\')">Reset PW</button>' +
                (isOwnerRow ? '<span class="debug-protected">Protected</span>' : '<button class="debug-delete" onclick="deleteUserAccount(\'' + debugArg(String(user.id)) + '\')">Delete</button>') +
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
            String(post.content || '').toLowerCase().indexOf(query) >= 0;
    });

    if (!rows.length) {
        tbody.innerHTML = debugEmptyRow(4, query ? 'No posts match "' + query + '".' : 'No posts yet.');
        return;
    }

    const localPins = getPinnedIds();
    tbody.innerHTML = rows.map(function (post) {
        const pinned = isPinnedByContent(post.content) || localPins.indexOf(String(post.id)) >= 0;
        return '<tr>' +
            '<td><div class="debug-user"><span class="debug-avatar">' + escapeHtml(String(post.username || '?').charAt(0).toUpperCase()) + '</span><span>' + escapeHtml(post.username || '') + '</span></div></td>' +
            '<td class="debug-post-text">' + escapeHtml(debugTruncate(stripPinMarker(post.content), 90)) + '</td>' +
            '<td class="debug-date">' + escapeHtml(debugDate(post.created_at)) + '</td>' +
            '<td class="debug-actions"><div class="debug-action-row">' +
                '<button class="debug-btn" onclick="toggleDebugPin(\'' + debugArg(String(post.id)) + '\',' + (pinned ? 'true' : 'false') + ')">' + (pinned ? 'Unpin' : 'Pin') + '</button>' +
                '<button class="debug-delete" onclick="deleteDebugPost(\'' + debugArg(String(post.id)) + '\')">Delete</button>' +
            '</div></td>' +
        '</tr>';
    }).join('');
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
                '<button class="debug-btn" onclick="grantDebugShells(\'' + debugArg(w.username) + '\')">+ Shells</button>' +
                '<button class="debug-btn" onclick="setDebugShells(\'' + debugArg(w.username) + '\')">Set</button>' +
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

function debugWalletDefaults(username) {
    const inventory = [];
    const equipped = {};
    COSMETICS.forEach(function (item) {
        if (item.default) {
            inventory.push(item.id);
            if (!equipped[item.type]) equipped[item.type] = item.id;
        }
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

async function debugGiveShells() {
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
        showDebugStatus('Enter a positive number of Shells.', true);
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
            showDebugStatus('Gave ' + debugNum(amount) + ' Shells to ' + username + ' (' + debugNum(next) + ' total).', false);
        }
    } else {
        const fresh = debugWalletDefaults(username);
        fresh.shells = SHELLS_START + amount;
        res = await debugQuery(supabaseClient.from('wallets').insert(fresh));
        if (!res.error) {
            showDebugStatus('Created ' + username + "'s wallet with " + debugNum(fresh.shells) + ' Shells.', false);
        }
    }

    if (res.error) {
        showDebugStatus('Could not give Shells: ' + (res.error.message || 'Unknown error'), true);
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

async function grantDebugShells(username) {
    if (!debugGuard()) return;
    const walletRow = debugData.wallets.filter(function (w) { return String(w.username) === String(username); })[0];
    const amount = Number(window.prompt('Shells to add to "' + username + '" (use a negative number to remove):', '100'));
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
    showDebugStatus(username + ' now has ' + debugNum(next) + ' Shells.', false);
    await refreshOwnWalletIfNeeded(username);
    await renderDebugUsers();
}

async function setDebugShells(username) {
    if (!debugGuard()) return;
    const value = Number(window.prompt('Set "' + username + '" to how many Shells?', '100'));
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
    showDebugStatus(username + ' set to ' + debugNum(next) + ' Shells.', false);
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
    if (!window.confirm('Delete the Shells wallet for "' + username + '"? Their next game starts a fresh wallet.')) return;
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
        wallets: debugData.wallets,
        scores: debugData.scores
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
    if (!window.confirm('Clear cached scores, pinned posts, and local Shells wallets on this browser?')) return;
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
    if (!window.confirm('Really delete all ' + debugData.posts.length + ' posts?')) return;
    const res = await debugQuery(supabaseClient.from('posts').delete().neq('id', -1));
    if (res.error) {
        showDebugStatus('Could not delete posts: ' + (res.error.message || 'Unknown error'), true);
        return;
    }
    savePinnedIds([]);
    showDebugStatus('All posts deleted.', false);
    await renderDebugUsers();
}

async function clearAllDebugScores() {
    if (!debugGuard()) return;
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
    if (!window.confirm('Reset EVERY wallet to ' + SHELLS_START + ' Shells and clear streaks?')) return;
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
    showDebugStatus('All wallets reset to ' + SHELLS_START + ' Shells.', false);
    if (currentUser && currentUser.type === 'user') {
        try { await loadWallet(); } catch (e) {}
    }
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
    if (!window.confirm('Delete "' + user.username + '"?\n\nThis permanently removes the account. Their posts and Shells wallet will also be cleaned up.')) return;
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
    try { await supabaseClient.from('wallets').delete().eq('username', user.username); } catch (e) {}
    try { await supabaseClient.from('scores').delete().eq('username', user.username); } catch (e) {}

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
    if(supabaseClient){ 
        try {
            const {data:existing}=await supabaseClient.from('users').select('*').eq('username',username).maybeSingle(); 
            if(existing){alert('Username taken');return;} 
            const {error}=await supabaseClient.from('users').insert({username: username, password: password}); 
            if(error){
                alert(error.message);
                return;
            } 
            currentUser={type:'user',username: username, persistScores: true}; 
            localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
            closeAuthModal(); 
            updateUserSection(); 
            loadWallet();
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
            currentUser={type:'user',username:data.username, persistScores: true}; 
            localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
            closeAuthModal(); 
            updateUserSection(); 
            loadWallet();
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
    currentUser={type:'guest',username:'Guest', persistScores: false}; 
    localStorage.removeItem('lessfun_user'); 
    closeAuthModal(); 
    updateUserSection(); 
    loadWallet();
}
async function logout(){ 
    if(supabaseClient){ 
        try {
            await supabaseClient.auth.signOut(); 
        } catch(e) {}
    } 
    currentUser={type:'guest',username:'Guest', persistScores: false}; 
    localStorage.removeItem('lessfun_user'); 
    updateUserSection(); 
    loadWallet();
}

function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

/* ============================================================
   Shells wallet + cosmetics shop
   ============================================================ */

const SHELLS_START = 100;
const WALLET_STORAGE_PREFIX = 'lessfun_wallet_v1_';
const DAILY_BONUS = 25;
const STREAK_BONUSES = { 3: 150, 7: 400, 14: 1000 };

const COSMETICS = [
    { id: 'paint_coral', type: 'paint', name: 'Coral Cruiser', cost: 0, default: true, color: '#ef476f', threeColor: 0xef476f },
    { id: 'paint_sunset', type: 'paint', name: 'Sunset Amber', cost: 250, color: '#ffa94d', threeColor: 0xffa94d },
    { id: 'paint_lagoon', type: 'paint', name: 'Lagoon Teal', cost: 350, color: '#2ec4b6', threeColor: 0x2ec4b6 },
    { id: 'paint_grape', type: 'paint', name: 'Grape Soda', cost: 500, color: '#9b5de5', threeColor: 0x9b5de5 },
    { id: 'paint_midnight', type: 'paint', name: 'Midnight', cost: 650, color: '#1b263b', threeColor: 0x1b263b },
    { id: 'paint_gold', type: 'paint', name: 'Gold Rush', cost: 1200, color: '#ffd166', threeColor: 0xffd166 },
    { id: 'board_teal', type: 'board', name: 'Teal Board', cost: 0, default: true, color: '#06d6a0', threeColor: 0x06d6a0 },
    { id: 'board_flame', type: 'board', name: 'Flame Board', cost: 300, color: '#ff6b35', threeColor: 0xff6b35 },
    { id: 'board_ice', type: 'board', name: 'Ice Board', cost: 450, color: '#9be7ff', threeColor: 0x9be7ff },
    { id: 'board_rainbow', type: 'board', name: 'Rainbow Board', cost: 900, color: '#ff70a6', threeColor: 0xff70a6 },
    { id: 'board_void', type: 'board', name: 'Void Board', cost: 1500, color: '#2b2d42', threeColor: 0x2b2d42 }
];

let wallet = null;
let walletLoadToken = 0;
let walletMutated = false;
let storeStatusTimer = 0;

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
        if (item.default) {
            if (inventory.indexOf(item.id) < 0) inventory.push(item.id);
            if (!equipped[item.type]) equipped[item.type] = item.id;
        }
    });

    ['paint', 'board'].forEach(function (type) {
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

function renderWalletUI() {
    var shells = wallet ? wallet.shells : SHELLS_START;
    ['navShells', 'storeShells'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = shells.toLocaleString();
    });

    var profileShells = document.getElementById('profileShells');
    if (profileShells && wallet && currentUser && currentUser.type === 'user' && currentUser.username === wallet.username) {
        profileShells.innerHTML = shellIcon(14) + ' <span>' + shells.toLocaleString() + ' Shells</span>';
    }

    var guestNote = document.getElementById('storeGuestNote');
    if (guestNote) {
        guestNote.style.display = (!currentUser || currentUser.type !== 'user') ? 'block' : 'none';
    }
}

function getEquippedCosmetics() {
    var equipped = wallet ? wallet.equipped : {};
    var paint = COSMETICS.find(function (c) { return c.id === equipped.paint; });
    var board = COSMETICS.find(function (c) { return c.id === equipped.board; });
    return {
        paint: paint ? paint.threeColor : 0xef476f,
        board: board ? board.threeColor : 0x06d6a0
    };
}

function cosmeticCards(type) {
    return COSMETICS.filter(function (item) { return item.type === type; }).map(function (item) {
        var owned = wallet.inventory.indexOf(item.id) >= 0;
        var equipped = wallet.equipped[item.type] === item.id;
        var affordable = wallet.shells >= item.cost;

        var preview = type === 'paint'
            ? '<div class="cosmetic-car" style="--swatch:' + item.color + '"></div>'
            : '<div class="cosmetic-board" style="--swatch:' + item.color + '"></div>';

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

        return '<div class="cosmetic-card' + (equipped ? ' is-equipped' : '') + '">' +
            '<div class="cosmetic-preview">' + preview + '</div>' +
            '<h3 class="cosmetic-name">' + escapeHtml(item.name) + '</h3>' +
            '<div class="cosmetic-price">' + (owned ? (equipped ? 'In use' : 'Owned') : shellIcon(13) + ' ' + item.cost.toLocaleString()) + '</div>' +
            '<button class="cosmetic-btn ' + cls + '"' + disabled + ' onclick="handleCosmetic(\'' + item.id + '\')">' + action + '</button>' +
        '</div>';
    }).join('');
}

function renderStore() {
    var content = document.getElementById('storeContent');
    if (!content) return;
    if (!wallet) {
        content.innerHTML = '<p class="store-loading">Loading shop…</p>';
        return;
    }
    content.innerHTML =
        '<h2 class="store-heading">Car Paints</h2>' +
        '<div class="cosmetic-grid">' + cosmeticCards('paint') + '</div>' +
        '<h2 class="store-heading">Surfboards</h2>' +
        '<div class="cosmetic-grid">' + cosmeticCards('board') + '</div>' +
        '<p class="store-note">Cosmetics only — nothing in the shop changes your score or speed. Shells are earned by playing.</p>';
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

async function handleCosmetic(id) {
    var item = COSMETICS.find(function (c) { return c.id === id; });
    if (!item || !wallet) return;

    var owned = wallet.inventory.indexOf(item.id) >= 0;
    if (!owned) {
        if (wallet.shells < item.cost) {
            flashStoreStatus('Not enough Shells. You need ' + (item.cost - wallet.shells).toLocaleString() + ' more.', true);
            return;
        }
        if (!window.confirm('Buy ' + item.name + ' for ' + item.cost.toLocaleString() + ' Shells?')) return;

        wallet.shells -= item.cost;
        wallet.inventory.push(item.id);
        wallet.equipped[item.type] = item.id;
        await saveWallet();
        renderStore();
        flashStoreStatus('Purchased ' + item.name + ' and equipped it.');
        return;
    }

    wallet.equipped[item.type] = item.id;
    await saveWallet();
    renderStore();
    flashStoreStatus(item.name + ' equipped.');
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

async function awardShells(seconds) {
    var result = { total: 0, base: 0, bonus: 0, messages: [] };
    if (!wallet) return result;

    // 1 Shell per full second of active play. Background tabs and paused
    // frames are already clamped in the game loop, so they do not farm currency.
    var played = Math.max(0, Number(seconds) || 0);
    var base = Math.floor(played);
    if (played > 0 && base < 1) base = 1;
    var bonus = 0;
    var messages = [];
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

    awardShells(seconds).then(function (result) {
        var el = document.getElementById('g3dEarned');
        if (!el) return;
        if (!result || result.total <= 0) {
            el.style.display = 'none';
            return;
        }
        var parts = ['play +' + result.base];
        for (var i = 0; i < result.messages.length; i++) parts.push(result.messages[i]);
        el.innerHTML = shellIcon(14) + '<span>+' + result.total + ' Shells</span><small>' + parts.join(' · ') + '</small>';
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
async function createPost(){ 
    if(!currentUser || currentUser.type === 'guest' || !currentUser.persistScores){ 
        alert('Please sign in to post'); 
        openAuthModal(); 
        return; 
    } 
    const content=document.getElementById('postContent').value.trim(); 
    if(!content)return; 
    if(supabaseClient){ 
        try {
            const {error}=await supabaseClient.from('posts').insert({username:currentUser.username, content:content}); 
            if(error){alert(error.message);return;} 
            document.getElementById('postContent').value=''; 
            renderCommunity(); 
            return; 
        } catch(e) {
            alert(e.message || 'Error');
            return;
        }
    } else {
        alert('Error');
    }
}
async function deletePost(id){ 
    if(!currentUser || currentUser.type === 'guest' || !currentUser.persistScores) {
        alert('Account required to delete posts');
        return;
    }
    if(supabaseClient){ 
        try {
            if(currentUser.username!=='TotallyMason'){ 
                // Only allow deleting own posts
            } 
            await supabaseClient.from('posts').delete().eq('id',id); 
            renderCommunity(); 
            return; 
        } catch(e) {
            return;
        }
    } 
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
    if (!currentUser || currentUser.username !== 'TotallyMason' || currentUser.type === 'guest' || !currentUser.persistScores) {
        alert('Only TotallyMason can pin posts');
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
    // Local fallback if the post could not be updated (e.g. RLS blocks it).
    const ids = getPinnedIds();
    const sid = String(id);
    const idx = ids.indexOf(sid);
    if (next && idx < 0) ids.push(sid);
    if (!next && idx >= 0) ids.splice(idx, 1);
    savePinnedIds(ids);
    renderCommunity();
}
async function renderCommunity() {
    const container = document.getElementById('communityPosts');
    if (!container) return;
    if (!supabaseClient) return;
    const { data: posts } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:40px;">No posts yet</p>';
        return;
    }

    const localPins = getPinnedIds();
    const isOwner = currentUser && currentUser.username === 'TotallyMason' && currentUser.type !== 'guest' && currentUser.persistScores;
    const entries = posts.map(post => ({
        post,
        pinned: post.pinned === true || isPinnedByContent(post.content) || localPins.indexOf(String(post.id)) >= 0
    }));
    entries.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.post.created_at) - new Date(a.post.created_at);
    });

    container.innerHTML = entries.map(({ post, pinned }) => {
        const date = new Date(post.created_at);
        const postIsOwner = post.username === 'TotallyMason';
        const canDelete = currentUser && (currentUser.username === 'TotallyMason' || currentUser.username === post.username);
        const safeUser = escapeHtml(post.username).replace(/'/g, "\\'");
        const pinButton = isOwner
            ? `<button class="post-pin${pinned ? ' is-pinned' : ''}" onclick="togglePin(${post.id}, ${pinned})">${pinned ? '📌 Unpin' : '📌 Pin'}</button>`
            : '';
        return `<div class="community-post${pinned ? ' pinned' : ''}">
            <div class="post-header">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="post-user" style="cursor:pointer;" onclick="openProfile('${safeUser}')">${escapeHtml(post.username)}</span>
                    ${postIsOwner ? '<span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;font-weight:600;">OWNER</span>' : ''}
                    ${pinned ? '<span class="post-pin-badge">📌 PINNED</span>' : ''}
                </div>
                <span class="post-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <div class="post-content">${escapeHtml(stripPinMarker(post.content))}</div>
            <div class="post-actions">
                ${canDelete ? `<button class="post-delete" onclick="deletePost(${post.id})">Delete</button>` : ''}
                ${pinButton}
            </div>
        </div>`;
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
    } else { 
        currentUser={type:'guest',username:'Guest', persistScores: false}; 
    } 
    updateUserSection(); 
}
function initViewCounter(){ const v=parseInt(localStorage.getItem('lfv')||'0')+1; localStorage.setItem('lfv',v); if(document.getElementById('viewCounterDisplay')) document.getElementById('viewCounterDisplay').textContent=v.toLocaleString(); }

if(supabaseClient){
    supabaseClient.auth.onAuthStateChange((event,session)=>{
        if(session){ 
            const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User';
            currentUser={
                type:'user',
                username: username,
                persistScores: true
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

const APP_VERSION = "LessFun Developer Beta 1.20.1";
const UPDATE_NOTES = "Guest and Account modes added";

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
    renderGames();
    loadUser();
    initViewCounter();
    updateUserSection();
    loadWallet();
    checkForUpdates();
});

function openProfile(username) {
    if (!username) { openAuthModal(); return; }
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('profileTitle').textContent = username + "'s Profile";
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('profileJoined').textContent = 'Member';
    const profileShells = document.getElementById('profileShells');
    if (profileShells) {
        if (currentUser && currentUser.type === 'user' && currentUser.username === username) {
            profileShells.style.display = 'block';
            profileShells.innerHTML = shellIcon(14) + ' <span>' + (wallet ? wallet.shells.toLocaleString() : SHELLS_START.toLocaleString()) + ' Shells</span>';
        } else {
            profileShells.style.display = 'none';
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
    loadProfilePosts(username);
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

async function renderUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;
    container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">Loading...</p>';
    const search = document.getElementById('userSearch') ? document.getElementById('userSearch').value.toLowerCase() : '';
    let users = new Set();
    if (supabaseClient) {
        const { data: posts } = await supabaseClient.from('posts').select('username');
        if (posts) {
            posts.forEach(p => { if (p.username) users.add(p.username); });
        }
    }
    users.add('TotallyMason');
    const userList = Array.from(users).filter(u => !search || u.toLowerCase().includes(search));
    if (userList.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.5);text-align:center;">No users found</p>';
        return;
    }
    container.innerHTML = userList.map(u => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:linear-gradient(145deg,rgba(40,40,45,0.8),rgba(25,25,30,0.8));border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;" onclick="openProfile('${escapeHtml(u).replace(/'/g,"\\'")}')">
            <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#ec4899);display:flex;align-items:center;justify-content:center;font-weight:600;">${escapeHtml(u).charAt(0).toUpperCase()}</div>
            <div style="flex:1;">
                <div style="font-weight:600;">${escapeHtml(u)}${u==='TotallyMason'?' <span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;">OWNER</span>':''}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
    `).join('');
}
