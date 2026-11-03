document.addEventListener('DOMContentLoaded', () => {
    renderGames();
    loadUser();
    initViewCounter();
});

// Authentication System
let currentUser = null;

function loadUser() {
    const saved = localStorage.getItem("lessfun_user");
    if (saved) {
        currentUser = JSON.parse(saved);
        updateUserSection();
    } else {
        currentUser = { type: "guest", username: "Guest" };
        updateUserSection();
    }
}

function updateUserSection() {
    const section = document.getElementById("userSection");
    if (currentUser.type === "guest") {
        section.innerHTML = `<button class="nav-btn" onclick="openAuthModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right:6px;"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Sign In</button>`;
    } else {
        section.innerHTML = `<button class="nav-btn" onclick="logout()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right:6px;"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${currentUser.username}</button>`;
    }
}

function openAuthModal() {
    document.getElementById("authModal").style.display = "flex";
    document.getElementById("authSignIn").style.display = "block";
    document.getElementById("authSignUp").style.display = "none";
    document.getElementById("authTitle").textContent = "Sign In";
}

function closeAuthModal() {
    document.getElementById("authModal").style.display = "none";
}

function showAuthSignup() {
    document.getElementById("authSignIn").style.display = "none";
    document.getElementById("authSignUp").style.display = "block";
    document.getElementById("authTitle").textContent = "Create Account";
}

function showAuthSignin() {
    document.getElementById("authSignIn").style.display = "block";
    document.getElementById("authSignUp").style.display = "none";
    document.getElementById("authTitle").textContent = "Sign In";
}

async function signUp() {
    if (supabaseClient) {
        const username = document.getElementById("signupUsername").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        if (!username || !email || !password) { alert("Please fill in all fields"); return; }
        const { error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) { alert(error.message); return; }
        alert("Check your email to confirm!");
        closeAuthModal();
        return;
    }
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    if (!username || !password) { alert("Please fill in all fields"); return; }
    let users = [];
    try {
        const r = await fetch("users.json?t=" + Date.now());
        const data = await r.json();
        users = data.users || [];
    } catch(e) {
        users = JSON.parse(localStorage.getItem("lessfun_users") || "[]");
    }
    if (users.find(u => u.username === username)) { alert("Username already exists"); return; }
    users.push({ username, email, password, scores: {}, created: Date.now() });
    localStorage.setItem("lessfun_users", JSON.stringify(users));
    currentUser = { type: "user", username, scores: {} };
    localStorage.setItem("lessfun_user", JSON.stringify(currentUser));
    closeAuthModal();
    updateUserSection();
    alert("Account created!");
}

async function signIn() {
    if (supabaseClient) {
        const email = document.getElementById("signinEmail").value.trim();
        const password = document.getElementById("signinPassword").value;
        if (!email || !password) { alert("Please fill in all fields"); return; }
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); return; }
        currentUser = { type: "user", username: data.user.user_metadata?.username || email.split('@')[0] };
        localStorage.setItem("lessfun_user", JSON.stringify(currentUser));
        closeAuthModal();
        updateUserSection();
        return;
    }
    const username = document.getElementById("signinUsername").value.trim();
    const password = document.getElementById("signinPassword").value;
    let users = [];
    try {
        const r = await fetch("users.json?t=" + Date.now());
        const data = await r.json();
        users = data.users || [];
    } catch(e) {
        users = JSON.parse(localStorage.getItem("lessfun_users") || "[]");
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) { alert("Invalid credentials"); return; }
    currentUser = { type: "user", username: user.username, scores: user.scores || {} };
    localStorage.setItem("lessfun_user", JSON.stringify(currentUser));
    closeAuthModal();
    updateUserSection();
}

function continueAsGuest() {
    currentUser = { type: "guest", username: "Guest" };
    localStorage.removeItem("lessfun_user");
    closeAuthModal();
    updateUserSection();
}

async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = { type: "guest", username: "Guest" };
    localStorage.removeItem("lessfun_user");
    updateUserSection();
}

function saveScore(gameName, score) {
    if (currentUser.type === "guest") return;
    if (!currentUser.scores) currentUser.scores = {};
    if (!currentUser.scores[gameName] || score > currentUser.scores[gameName]) {
        currentUser.scores[gameName] = score;
        localStorage.setItem("lessfun_user", JSON.stringify(currentUser));
        const users = JSON.parse(localStorage.getItem("lessfun_users") || "[]");
        const idx = users.findIndex(u => u.username === currentUser.username);
        if (idx >= 0) {
            users[idx].scores = currentUser.scores;
            localStorage.setItem("lessfun_users", JSON.stringify(users));
        }
    }
}

// Community System
async function createPost() {
    if (!currentUser || currentUser.type === "guest") {
        alert("Please sign in to post");
        openAuthModal();
        return;
    }
    const content = document.getElementById("postContent").value.trim();
    if (!content) return;
    if (supabaseClient) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) { alert("Please sign in to post"); openAuthModal(); return; }
        const { error } = await supabaseClient.from('posts').insert({
            user_id: user.id,
            username: currentUser.username,
            content: content
        });
        if (error) { alert(error.message); return; }
        document.getElementById("postContent").value = "";
        renderCommunity();
        return;
    }
    const posts = JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    posts.unshift({
        id: Date.now(),
        user: currentUser.username,
        content: content,
        time: new Date().toISOString()
    });
    localStorage.setItem("lessfun_posts", JSON.stringify(posts));
    document.getElementById("postContent").value = "";
    renderCommunity();
}

async function deletePost(id) {
    if (!currentUser) return;
    if (supabaseClient) {
        if (currentUser.username !== "TotallyMason") {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;
        }
        const { error } = await supabaseClient.from('posts').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        renderCommunity();
        return;
    }
    if (currentUser.username !== "TotallyMason") return;
    let posts = JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    posts = posts.filter(p => p.id !== id);
    localStorage.setItem("lessfun_posts", JSON.stringify(posts));
    renderCommunity();
}

async function renderCommunity() {
    const container = document.getElementById("communityPosts");
    if (supabaseClient) {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error || !posts) {
            container.innerHTML = "<p style=\"text-align:center;color:rgba(255,255,255,0.5);padding:40px;\">No posts yet</p>";
            return;
        }
        if (posts.length === 0) {
            container.innerHTML = "<p style=\"text-align:center;color:rgba(255,255,255,0.5);padding:40px;\">No posts yet</p>";
            return;
        }
        container.innerHTML = posts.map(post => {
            const date = new Date(post.created_at);
            const isOwner = post.username === "TotallyMason";
            const canDelete = currentUser && (currentUser.username === "TotallyMason" || currentUser.username === post.username);
            return `<div class="community-post"><div class="post-header"><div style="display:flex;align-items:center;gap:8px;"><span class="post-user">${escapeHtml(post.username)}</span>${isOwner ? '<span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;font-weight:600;">OWNER</span>' : ''}</div><span class="post-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span></div><div class="post-content">${escapeHtml(post.content)}</div>${canDelete ? `<button class="post-delete" onclick="deletePost(${post.id})">Delete</button>` : ""}</div>`;
        }).join("");
        return;
    }
    const posts = JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    if (posts.length === 0) {
        container.innerHTML = "<p style=\"text-align:center;color:rgba(255,255,255,0.5);padding:40px;\">No posts yet</p>";
        return;
    }
    container.innerHTML = posts.map(post => {
        const date = new Date(post.time || post.created_at);
        const canDelete = currentUser && currentUser.username === "TotallyMason";
        const isOwner = post.user === "TotallyMason" || post.username === "TotallyMason";
        const username = post.user || post.username;
        return `<div class="community-post"><div class="post-header"><div style="display:flex;align-items:center;gap:8px;"><span class="post-user">${escapeHtml(username)}</span>${isOwner ? '<span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;font-weight:600;">OWNER</span>' : ''}</div><span class="post-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span></div><div class="post-content">${escapeHtml(post.content)}</div>${canDelete ? `<button class="post-delete" onclick="deletePost(${post.id})">Delete</button>` : ""}</div>`;
    }).join("");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

async function loadPostsFromCloud() {
    try {
        const res = await fetch("https://jsonblob.com/api/jsonBlob", {method:"GET"});
        return [];
    } catch(e) {
        return JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    }
}

async function savePostsToCloud(posts) {
    localStorage.setItem("lessfun_posts", JSON.stringify(posts));
}

const GIST_ID = "1234567890abcdef";
async function syncPosts() {
    try {
        const r = await fetch("posts.json?t=" + Date.now());
        const cloud = await r.json();
        if (Array.isArray(cloud.posts)) {
            localStorage.setItem("lessfun_posts", JSON.stringify(cloud.posts));
            if (document.getElementById("communityPosts") && document.getElementById("communityView").style.display !== "none") {
                renderCommunity();
            }
        } else if (Array.isArray(cloud)) {
            localStorage.setItem("lessfun_posts", JSON.stringify(cloud));
            if (document.getElementById("communityPosts") && document.getElementById("communityView").style.display !== "none") {
                renderCommunity();
            }
        }
    } catch(e){}
}
setInterval(syncPosts, 10000);
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(syncPosts, 500);
});
// Replace auth with Supabase
async function loadUser() {
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentUser = { type: 'user', username: session.user.user_metadata?.username || session.user.email?.split('@')[0] };
            updateUserSection();
            return;
        }
    }
    const saved = localStorage.getItem('lessfun_user');
    if (saved) {
        currentUser = JSON.parse(saved);
    } else {
        currentUser = { type: 'guest', username: 'Guest' };
    }
    updateUserSection();
}

async function signUp() {
    if (!supabaseClient) { alert('Supabase not connected'); return; }
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    if (!username || !email || !password) { alert("Please fill in all fields"); return; }
    const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    if (error) { alert(error.message); return; }
    alert("Check your email to confirm!");
    closeAuthModal();
}

async function signIn() {
    if (!supabaseClient) { alert('Supabase not connected'); return; }
    const email = document.getElementById("signinEmail").value.trim();
    const password = document.getElementById("signinPassword").value;
    if (!email || !password) { alert("Please fill in all fields"); return; }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { alert(error.message); return; }
    currentUser = { type: 'user', username: data.user.user_metadata?.username || email.split('@')[0] };
    localStorage.setItem('lessfun_user', JSON.stringify(currentUser));
    closeAuthModal();
    updateUserSection();
}

async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = { type: 'guest', username: 'Guest' };
    localStorage.removeItem('lessfun_user');
    updateUserSection();
}
---
