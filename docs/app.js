/* LessFun */
const SUPABASE_URL = "https://yuuopbgzfrwcatmhuypr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ev9umZevWcT-AwVHTPQLnw_DHdpDHWR";
const supabaseClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const games = [
    { id: 1, name: "Tap Frenzy", description: "Tap as fast as you can for 10 seconds", icon: "hand.tap" },
    { id: 2, name: "Whack-a-Mole", description: "Bonk the moles", icon: "hammer" },
    { id: 3, name: "Reaction Test", description: "Tap when green", icon: "bolt" },
    { id: 4, name: "Memory Match", description: "Flip cards", icon: "brain" },
    { id: 5, name: "Tic-Tac-Toe", description: "Beat the bot", icon: "grid" },
    { id: 6, name: "Guess the Number", description: "Find the number", icon: "hash" },
    { id: 7, name: "Higher or Lower", description: "Higher or lower", icon: "spade" },
    { id: 8, name: "Dice Roller", description: "Roll dice", icon: "dice" },
    { id: 9, name: "Coin Flip", description: "Heads or tails", icon: "circle" },
    { id: 10, name: "Rock Paper Scissors", description: "Play RPS", icon: "scissors" }
];

let currentUser = null;
let gameState = {};

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
        "scissors": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8.2 7.8 20 20M8.2 16.2 20 4"/></svg>'
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

function openGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    document.getElementById('modalGameTitle').textContent = game.name;
    document.getElementById('modalGameBody').innerHTML = getGameHTML(game);
    document.getElementById('gameModal').style.display = 'flex';
    initGame(game);
}

function closeGame() {
    document.getElementById('gameModal').style.display = 'none';
    if (gameState.timer) clearInterval(gameState.timer);
}

function getGameHTML(game) {
    if (game.id === 1) return `<div class="game-3d-container"><div class="game-stats"><div class="stat-3d"><span>Score</span><strong id="tapScore">0</strong></div><div class="stat-3d"><span>Time</span><strong id="tapTime">10.0</strong></div></div><button class="tap-button-3d" id="tapBtn" onclick="tapFrenzyTap()">TAP</button></div>`;
    if (game.id === 2) return `<div class="game-3d-container"><div class="game-stats"><div class="stat-3d"><span>Score</span><strong id="whackScore">0</strong></div><div class="stat-3d"><span>Time</span><strong id="whackTime">20</strong></div></div><div class="mole-grid-3d">${[0,1,2,3,4,5,6,7,8].map(i=>`<div class="mole-hole-3d" id="hole${i}" onclick="whackMole(${i})"></div>`).join('')}</div><button class="game-btn-3d" onclick="startWhack()">Start</button></div>`;
    if (game.id === 3) return `<div class="game-3d-container"><div class="reaction-box-3d" id="reactionBox" onclick="reactionTap()"><span id="reactionText">Tap to Start</span></div><div class="game-stats"><div class="stat-3d"><span>Time</span><strong id="reactionTime">-</strong></div></div></div>`;
    if (game.id === 4) return `<div class="game-3d-container"><div class="memory-grid-3d">${[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i=>`<div class="memory-card-3d" id="mem${i}" onclick="flipCard(${i})"><div class="memory-card-inner"><div class="memory-card-front">?</div><div class="memory-card-back" id="memBack${i}"></div></div></div>`).join('')}</div><button class="game-btn-3d" onclick="startMemory()">New Game</button></div>`;
    if (game.id === 5) return `<div class="game-3d-container"><p id="tttStatus" style="text-align:center;margin-bottom:20px;">Your turn (X)</p><div class="ttt-grid-3d">${[0,1,2,3,4,5,6,7,8].map(i=>`<div class="ttt-cell-3d" id="ttt${i}" onclick="tttMove(${i})"></div>`).join('')}</div><button class="game-btn-3d" onclick="resetTTT()" style="margin-top:20px;">Reset</button></div>`;
    if (game.id === 6) return `<div class="game-3d-container"><p style="text-align:center;margin-bottom:20px;">Guess 1-100</p><div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;"><input type="number" id="guessInput" class="guess-input-3d" min="1" max="100"><button class="game-btn-3d" onclick="guessNumber()">Guess</button></div><p id="guessHint" style="text-align:center;color:rgba(255,255,255,0.7);"></p><p id="guessCount" style="text-align:center;margin-top:10px;">Attempts: 0</p></div>`;
    if (game.id === 7) return `<div class="game-3d-container"><div style="display:flex;gap:30px;justify-content:center;margin-bottom:30px;align-items:center;"><div class="card-3d" id="currentCard">?</div><div style="font-size:32px;">VS</div><div class="card-3d" id="nextCard">?</div></div><p id="hlScore" style="text-align:center;margin-bottom:20px;">Score: 0</p><div style="display:flex;gap:15px;justify-content:center;"><button class="game-btn-3d" onclick="hlGuess(false)">Lower</button><button class="game-btn-3d" onclick="hlGuess(true)">Higher</button></div><button class="game-btn-3d" onclick="startHL()" style="margin-top:20px;">Start</button></div>`;
    if (game.id === 8) return `<div class="game-3d-container"><div style="display:flex;gap:20px;justify-content:center;margin-bottom:30px;"><div class="dice-3d" id="dice1">1</div><div class="dice-3d" id="dice2">1</div></div><p id="diceResult" style="text-align:center;margin-bottom:20px;">Roll!</p><button class="game-btn-3d" onclick="rollDice()">Roll</button></div>`;
    if (game.id === 9) return `<div class="game-3d-container"><div class="coin-3d-container"><div class="coin-3d" id="coin3d"><div class="coin-face coin-heads">H</div><div class="coin-face coin-tails">T</div></div></div><p id="coinResult" style="text-align:center;margin:20px 0;">Flip!</p><button class="game-btn-3d" onclick="flipCoin()">Flip</button></div>`;
    if (game.id === 10) return `<div class="game-3d-container"><div style="display:flex;gap:30px;justify-content:center;margin-bottom:20px;align-items:center;"><div style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">You</div><div class="rps-choice-3d" id="rpsYou">?</div></div><div style="font-size:24px;">VS</div><div style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">Bot</div><div class="rps-choice-3d" id="rpsBot">?</div></div></div><p id="rpsScore" style="text-align:center;margin-bottom:20px;">You: 0 | Bot: 0</p><div style="display:flex;gap:10px;justify-content:center;"><button class="rps-btn-3d" onclick="playRPS('rock')">Rock</button><button class="rps-btn-3d" onclick="playRPS('paper')">Paper</button><button class="rps-btn-3d" onclick="playRPS('scissors')">Scissors</button></div></div>`;
    return '';
}

function initGame(game) { if (game.id === 1) initTapFrenzy(); if (game.id === 2) initWhack(); if (game.id === 3) initReaction(); if (game.id === 4) initMemory(); if (game.id === 5) resetTTT(); if (game.id === 6) initGuess(); if (game.id === 7) startHL(); if (game.id === 10) resetRPS(); }
function initTapFrenzy() { gameState.tap = {score:0,time:10,running:false}; document.getElementById('tapScore').textContent='0'; document.getElementById('tapTime').textContent='10.0'; document.getElementById('tapBtn').textContent='START'; }
async function saveScore(gameName, score) {
    if (!currentUser || currentUser.type === 'guest' || !currentUser.persistScores) {
        // Guest mode - do not persist scores
        return;
    }
    if (supabaseClient) {
        try {
            await supabaseClient.from('scores').insert({
                username: currentUser.username,
                game: gameName,
                score: score,
                created_at: new Date().toISOString()
            });
        } catch (e) {
            // Silently fail if table doesn't exist or other issues
        }
    }
    // For account mode without Supabase table, still don't persist to localStorage
}

function tapFrenzyTap() { if (!gameState.tap.running) { gameState.tap.running=true; gameState.tap.score=0; gameState.tap.time=10; document.getElementById('tapBtn').textContent='TAP'; document.getElementById('tapScore').textContent='0'; if (gameState.timer) clearInterval(gameState.timer); gameState.timer=setInterval(()=>{ gameState.tap.time-=0.1; document.getElementById('tapTime').textContent=gameState.tap.time.toFixed(1); if (gameState.tap.time<=0){ clearInterval(gameState.timer); gameState.tap.running=false; document.getElementById('tapBtn').textContent='GAME OVER'; const finalScore = gameState.tap.score; saveScore('Tap Frenzy', finalScore); alert('Score: '+finalScore); }},100); } else { gameState.tap.score++; document.getElementById('tapScore').textContent=gameState.tap.score; } }
function initWhack() { gameState.whack={score:0,time:20,running:false,active:-1}; document.getElementById('whackScore').textContent='0'; document.getElementById('whackTime').textContent='20'; }
function startWhack() { if (gameState.whack.running) return; gameState.whack.running=true; gameState.whack.score=0; gameState.whack.time=20; document.getElementById('whackScore').textContent='0'; if (gameState.timer) clearInterval(gameState.timer); gameState.timer=setInterval(()=>{ gameState.whack.time--; document.getElementById('whackTime').textContent=gameState.whack.time; if (gameState.whack.time<=0){ clearInterval(gameState.timer); gameState.whack.running=false; const finalScore = gameState.whack.score; saveScore('Whack-a-Mole', finalScore); alert('Score: '+finalScore); }},1000); setInterval(()=>{ if (!gameState.whack.running) return; for(let i=0;i<9;i++) document.getElementById('hole'+i).classList.remove('active'); const a=Math.floor(Math.random()*9); document.getElementById('hole'+a).classList.add('active'); gameState.whack.active=a; },800); }
function whackMole(i) { if (gameState.whack.running && i===gameState.whack.active){ gameState.whack.score++; document.getElementById('whackScore').textContent=gameState.whack.score; document.getElementById('hole'+i).classList.remove('active'); } }
function initReaction() { gameState.reaction={state:'idle'}; const box=document.getElementById('reactionBox'); if(box) box.style.background='#333'; const t=document.getElementById('reactionText'); if(t) t.textContent='Tap to Start'; }
function reactionTap() { const box=document.getElementById('reactionBox'); const text=document.getElementById('reactionText'); if (gameState.reaction.state==='idle'){ box.style.background='#f59e0b'; text.textContent='Wait...'; gameState.reaction.state='waiting'; setTimeout(()=>{ if (gameState.reaction.state==='waiting'){ box.style.background='#22c55e'; text.textContent='TAP!'; gameState.reaction.state='ready'; gameState.reaction.start=Date.now(); }},1000+Math.random()*2000); } else if (gameState.reaction.state==='ready'){ const time=Date.now()-gameState.reaction.start; document.getElementById('reactionTime').textContent=time+'ms'; box.style.background='#333'; text.textContent='Tap to try again'; gameState.reaction.state='idle'; } else if (gameState.reaction.state==='waiting'){ box.style.background='#ef4444'; text.textContent='Too early!'; gameState.reaction.state='idle'; } }
function initMemory() { gameState.memory={cards:[],flipped:[],matched:[]}; }
function startMemory() { const symbols=['A','B','C','D','E','F','G','H']; const cards=[...symbols,...symbols].sort(()=>Math.random()-0.5); gameState.memory={cards,flipped:[],matched:[]}; for(let i=0;i<16;i++){ document.getElementById('mem'+i).classList.remove('flipped','matched'); document.getElementById('memBack'+i).textContent=cards[i]; } }
function flipCard(i) { if(gameState.memory.flipped.length>=2)return; if(gameState.memory.matched.includes(i))return; if(gameState.memory.flipped.includes(i))return; document.getElementById('mem'+i).classList.add('flipped'); gameState.memory.flipped.push(i); if(gameState.memory.flipped.length===2){ setTimeout(()=>{ const [a,b]=gameState.memory.flipped; if(gameState.memory.cards[a]===gameState.memory.cards[b]){ document.getElementById('mem'+a).classList.add('matched'); document.getElementById('mem'+b).classList.add('matched'); gameState.memory.matched.push(a,b); if(gameState.memory.matched.length===16) alert('You won!'); } else { document.getElementById('mem'+a).classList.remove('flipped'); document.getElementById('mem'+b).classList.remove('flipped'); } gameState.memory.flipped=[]; },800); } }
function resetTTT() { gameState.ttt={board:Array(9).fill(null),turn:'X'}; for(let i=0;i<9;i++){ document.getElementById('ttt'+i).textContent=''; document.getElementById('ttt'+i).classList.remove('x','o'); } document.getElementById('tttStatus').textContent='Your turn (X)'; }
function tttMove(i) { if(gameState.ttt.board[i]||gameState.ttt.turn!=='X')return; gameState.ttt.board[i]='X'; document.getElementById('ttt'+i).textContent='X'; document.getElementById('ttt'+i).classList.add('x'); gameState.ttt.turn='O'; document.getElementById('tttStatus').textContent='Bot thinking...'; setTimeout(tttBot,500); }
function tttBot() { const empty=gameState.ttt.board.map((v,i)=>v===null?i:-1).filter(i=>i!==-1); if(empty.length===0){ document.getElementById('tttStatus').textContent='Draw!'; return; } const move=empty[Math.floor(Math.random()*empty.length)]; gameState.ttt.board[move]='O'; document.getElementById('ttt'+move).textContent='O'; document.getElementById('ttt'+move).classList.add('o'); gameState.ttt.turn='X'; document.getElementById('tttStatus').textContent='Your turn (X)'; }
function initGuess() { gameState.guess={number:Math.floor(Math.random()*100)+1,count:0}; document.getElementById('guessInput').value=''; document.getElementById('guessHint').textContent=''; document.getElementById('guessCount').textContent='Attempts: 0'; }
function guessNumber() { const input=document.getElementById('guessInput'); const g=parseInt(input.value); if(isNaN(g))return; gameState.guess.count++; document.getElementById('guessCount').textContent='Attempts: '+gameState.guess.count; if(g===gameState.guess.number){ document.getElementById('guessHint').textContent='Correct!'; document.getElementById('guessHint').style.color='#22c55e'; } else if(g<gameState.guess.number){ document.getElementById('guessHint').textContent='Higher!'; document.getElementById('guessHint').style.color='#f59e0b'; } else { document.getElementById('guessHint').textContent='Lower!'; document.getElementById('guessHint').style.color='#f59e0b'; } input.value=''; }
function startHL() { gameState.hl={score:0,current:Math.floor(Math.random()*13)+1}; document.getElementById('currentCard').textContent=gameState.hl.current; document.getElementById('nextCard').textContent='?'; document.getElementById('hlScore').textContent='Score: 0'; }
function hlGuess(h) { const next=Math.floor(Math.random()*13)+1; document.getElementById('nextCard').textContent=next; if((h&&next>gameState.hl.current)||(!h&&next<gameState.hl.current)){ gameState.hl.score++; document.getElementById('hlScore').textContent='Score: '+gameState.hl.score; } else if(next===gameState.hl.current){ document.getElementById('hlScore').textContent='Score: '+gameState.hl.score+' (Push)'; } else { alert('Game Over! Score: '+gameState.hl.score); startHL(); return; } gameState.hl.current=next; setTimeout(()=>{ document.getElementById('currentCard').textContent=gameState.hl.current; document.getElementById('nextCard').textContent='?'; },1000); }
function rollDice() { const d1=Math.floor(Math.random()*6)+1,d2=Math.floor(Math.random()*6)+1; document.getElementById('dice1').textContent=d1; document.getElementById('dice2').textContent=d2; document.getElementById('diceResult').textContent='Total: '+(d1+d2); }
function flipCoin() { const coin=document.getElementById('coin3d'); coin.style.transform='rotateY(720deg)'; setTimeout(()=>{ document.getElementById('coinResult').textContent=(Math.random()<0.5?'Heads':'Tails')+'!'; coin.style.transform='rotateY(0deg)'; },600); }
function resetRPS() { gameState.rps={you:0,bot:0}; document.getElementById('rpsYou').textContent='?'; document.getElementById('rpsBot').textContent='?'; document.getElementById('rpsScore').textContent='You: 0 | Bot: 0'; }
function playRPS(c) { const choices=['rock','paper','scissors']; const b=choices[Math.floor(Math.random()*3)]; document.getElementById('rpsYou').textContent=c==='rock'?'R':c==='paper'?'P':'S'; document.getElementById('rpsBot').textContent=b==='rock'?'R':b==='paper'?'P':'S'; if(c===b){ alert('Draw!'); } else if((c==='rock'&&b==='scissors')||(c==='paper'&&b==='rock')||(c==='scissors'&&b==='paper')){ gameState.rps.you++; alert('You win!'); } else { gameState.rps.bot++; alert('Bot wins!'); } document.getElementById('rpsScore').textContent='You: '+gameState.rps.you+' | Bot: '+gameState.rps.bot; }
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
        const {data:existing}=await supabaseClient.from('users').select('*').eq('username',username).maybeSingle(); 
        if(existing){alert('Username taken');return;} 
        const {error}=await supabaseClient.from('users').insert({username,password}); 
        if(error){alert(error.message);return;} 
        currentUser={type:'user',username, persistScores: true}; 
        localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
        closeAuthModal(); 
        updateUserSection(); 
        return; 
    } else { 
        currentUser={type:'user',username, persistScores: true}; 
        localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
        localStorage.setItem('lessfun_pass_'+username,password); 
        closeAuthModal(); 
        updateUserSection(); 
    } 
}

async function signIn(){ 
    const username=document.getElementById("signinUsername").value.trim(); 
    const password=document.getElementById("signinPassword").value; 
    if(!username||!password){alert("Please fill in all fields");return;} 
    if(supabaseClient){ 
        const {data}=await supabaseClient.from('users').select('*').eq('username',username).eq('password',password).maybeSingle(); 
        if(!data){alert('Invalid username or password');return;} 
        currentUser={type:'user',username:data.username, persistScores: true}; 
        localStorage.setItem('lessfun_user',JSON.stringify(currentUser)); 
        closeAuthModal(); 
        updateUserSection(); 
        return; 
    } else { 
        const saved=localStorage.getItem('lessfun_user'); 
        if(saved){ 
            const u=JSON.parse(saved); 
            if(u.type==='user'){ 
                const p=localStorage.getItem('lessfun_pass_'+u.username); 
                if((p===password||!p)&&u.username===username){ 
                    currentUser={...u, persistScores: true}; 
                    closeAuthModal(); 
                    updateUserSection(); 
                    return; 
                } 
            } 
        } 
        alert('Invalid username or password'); 
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
        alert('Please create an account or sign in to post. Guest mode does not save posts.'); 
        openAuthModal(); 
        return; 
    } 
    const content=document.getElementById('postContent').value.trim(); 
    if(!content)return; 
    if(supabaseClient){ 
        const {data:{user}}=await supabaseClient.auth.getUser(); 
        if(!user){alert('Please sign in');openAuthModal();return;} 
        const {error}=await supabaseClient.from('posts').insert({user_id:user.id,username:currentUser.username,content}); 
        if(error){alert(error.message);return;} 
        document.getElementById('postContent').value=''; 
        renderCommunity(); 
        return; 
    } else {
        alert('Account required to post');
    }
}
async function deletePost(id){ 
    if(!currentUser || currentUser.type === 'guest' || !currentUser.persistScores) {
        alert('Account required to delete posts');
        return;
    }
    if(supabaseClient){ 
        if(currentUser.username!=='TotallyMason'){ 
            const {data:{user}}=await supabaseClient.auth.getUser(); 
            if(!user)return; 
        } 
        await supabaseClient.from('posts').delete().eq('id',id); 
        renderCommunity(); 
        return; 
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
            currentUser={
                type:'user',
                username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
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
const UPDATE_NOTES = "Guest/Account authentication modes, improved profile navigation, and cache fixes";

function checkForUpdates() {
    const lastVersion = localStorage.getItem('lessfun_version');
    if (lastVersion !== APP_VERSION) {
        // Show update notification
        setTimeout(() => {
            alert('🎉 New Update!\n\nVersion: ' + APP_VERSION + '\n\nWhat's new:\n' + UPDATE_NOTES);
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
