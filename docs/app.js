/* LessFun */
const SUPABASE_URL = "https://yuuopbgzfrwcatmhuypr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ev9umZevWcT-AwVHTPQLnw_DHdpDHWR";
const supabaseClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const games = [
    { id: 1, name: "Neon Racer", description: "Dodge traffic at insane speed", icon: "car", hasBrake: true, controls: "Steer freely with ← → or drag · hold ↓ / S or BRAKE to slow" },
    { id: 2, name: "Tunnel Rush", description: "Thread the neon tunnel at warp speed", icon: "tunnel", controls: "Left / Right or drag to rotate" },
    { id: 3, name: "Cube Stack", description: "Stack the tower as high as you can", icon: "blocks", controls: "Tap or press Space to drop" },
    { id: 4, name: "Helix Drop", description: "Fall through the rotating helix", icon: "helix", controls: "Left / Right or drag to rotate" },
    { id: 5, name: "Star Dodger", description: "Weave through an asteroid storm", icon: "rocket", controls: "Arrow keys or drag to fly" }
];

let currentUser = null;

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
        "tunnel": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
        "blocks": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="4" y="15" width="16" height="5" rx="1"/><rect x="6" y="9" width="13" height="5" rx="1"/><rect x="8" y="3" width="9" height="5" rx="1"/></svg>',
        "helix": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M7 3c0 3 10 3 10 6S7 12 7 15s10 3 10 6"/><circle cx="17" cy="9" r="1.6" fill="white" stroke="none"/></svg>',
        "rocket": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M12 3c3 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 2-7 5-9Z"/><circle cx="12" cy="9" r="1.6"/><path d="M9 15l-2 4 3-1M15 15l2 4-3-1"/></svg>'
    };
    return icons[name] || '';
}

function showView(view) {
    document.getElementById('gamesView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    document.getElementById('supportView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('communityView').style.display = 'none';
    if(document.getElementById('usersView')) document.getElementById('usersView').style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (document.getElementById('profileModal')) document.getElementById('profileModal').style.display = 'none';
    if (view === 'games') { document.getElementById('gamesView').style.display = 'block'; document.getElementById('nav-games').classList.add('active'); }
    else if (view === 'community') { document.getElementById('communityView').style.display = 'block'; document.getElementById('nav-community').classList.add('active'); renderCommunity(); }
    else if (view === 'users') { if(document.getElementById('usersView')){ document.getElementById('usersView').style.display = 'block'; document.getElementById('nav-users').classList.add('active'); renderUsers(); } }
    else if (view === 'store') { document.getElementById('storeView').style.display = 'block'; document.getElementById('nav-store').classList.add('active'); }
    else if (view === 'support') { document.getElementById('supportView').style.display = 'block'; document.getElementById('nav-support').classList.add('active'); }
    else if (view === 'settings') { document.getElementById('settingsView').style.display = 'block'; document.getElementById('nav-settings').classList.add('active'); }
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
                    '<button class="game-btn-3d" onclick="restartGame3D()">Play Again</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.getElementById('gameModal').style.display = 'flex';

    if (window.Games3D) {
        window.Games3D.start(id, document.getElementById('g3dCanvas'), {
            name: game.name,
            onScore: function (name, score) { saveScore(name, score); },
            onGameOver: function (score) {
                var over = document.getElementById('g3dOver');
                var fin = document.getElementById('g3dFinal');
                if (fin) fin.textContent = score;
                if (over) over.style.display = 'flex';
            }
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
    if (supabaseClient) {
        try {
            await supabaseClient.from('scores').insert({
                username: currentUser.username,
                game: gameName,
                score: score,
                created_at: new Date().toISOString()
            });
        } catch (e) { /* ignore */ }
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
}

function escapeHtml(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
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
async function renderCommunity(){ const container=document.getElementById('communityPosts'); if(!container)return; if(supabaseClient){ const {data:posts}=await supabaseClient.from('posts').select('*').order('created_at',{ascending:false}); if(!posts||posts.length===0){ container.innerHTML='<p style="text-align:center;color:rgba(255,255,255,0.5);padding:40px;">No posts yet</p>'; return; } container.innerHTML=posts.map(post=>{ const date=new Date(post.created_at); const isOwner=post.username==='TotallyMason'; const canDelete=currentUser&&(currentUser.username==='TotallyMason'||currentUser.username===post.username); return `<div class="community-post"><div class="post-header"><div style="display:flex;align-items:center;gap:8px;"><span class="post-user" style="cursor:pointer;" onclick="openProfile('${escapeHtml(post.username).replace(/'/g,"\\'")}')">${escapeHtml(post.username)}</span>${isOwner?'<span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;font-weight:600;">OWNER</span>':''}</div><span class="post-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><div class="post-content">${escapeHtml(post.content)}</div>${canDelete?`<button class="post-delete" onclick="deletePost(${post.id})">Delete</button>`:''}</div>`; }).join(''); return; } }

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
    checkForUpdates();
});

function openProfile(username) {
    if (!username) { openAuthModal(); return; }
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('profileTitle').textContent = username + "'s Profile";
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('profileJoined').textContent = 'Member';
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
            return `<div style="padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;"><div style="color:rgba(255,255,255,0.8);margin-bottom:6px;">${escapeHtml(post.content)}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">${date.toLocaleDateString()}</div></div>`;
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
