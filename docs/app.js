/* LessFun Games - Full Implementation with 3D Effects */
const games = [
    { id: 1, name: "Tap Frenzy", description: "Tap as fast as you can for 10 seconds", icon: "hand.tap", category: "arcade" },
    { id: 2, name: "Whack-a-Mole", description: "Bonk the moles, avoid bombs", icon: "hammer", category: "arcade" },
    { id: 3, name: "Reaction Test", description: "Tap when the screen turns green", icon: "bolt", category: "arcade" },
    { id: 4, name: "Memory Match", description: "Flip cards and find pairs", icon: "brain", category: "puzzle" },
    { id: 5, name: "Tic-Tac-Toe", description: "Beat the robot opponent", icon: "grid", category: "puzzle" },
    { id: 6, name: "Guess the Number", description: "Find the hidden number", icon: "hash", category: "puzzle" },
    { id: 7, name: "Higher or Lower", description: "Guess if next card is higher or lower", icon: "spade", category: "luck" },
    { id: 8, name: "Dice Roller", description: "Roll the dice and predict", icon: "dice", category: "luck" },
    { id: 9, name: "Coin Flip", description: "Heads or tails", icon: "circle", category: "luck" },
    { id: 10, name: "Rock Paper Scissors", description: "First to three wins", icon: "scissors", category: "versus" }
];

let currentView = 'games';
let gameState = {};

// SVG Icons
function getIcon(name) {
    const icons = {
        "hand.tap": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 12v-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4.5 14a1.6 1.6 0 0 1 2.4-2.1L8 13"/></svg>',
        "hammer": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="m13.5 6.5 4-4 4 4-4 4"/><path d="M17.5 6.5 8 16"/><path d="m5 14 5 5-2.5 2.5a2.1 2.1 0 0 1-3-3L5 14Z"/></svg>',
        "bolt": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>',
        "brain": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M9.5 4A2.5 2.5 0 0 0 7 7v.2A2.6 2.6 0 0 0 5 9.7c0 .8.3 1.5.9 2a2.6 2.6 0 0 0 .1 4.1A2.5 2.5 0 0 0 9.5 20V4Z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 7v.2a2.6 2.6 0 0 1 2 2.5c0 .8-.3 1.5-.9 2a2.6 2.6 0 0 1-.1 4.1A2.5 2.5 0 0 1 14.5 20V4Z"/></svg>',
        "grid": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        "hash": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
        "spade": '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2.8C9 8 4 9.4 4 13.8A4 4 0 0 0 11 16.4L10 21h4l-1-4.6a4 4 0 0 0 7-2.6c0-4.4-5-5.8-8-11Z"/></svg>',
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
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    if (view === 'games') {
        document.getElementById('gamesView').style.display = 'block';
        document.getElementById('nav-games').classList.add('active');
    } else if (view === 'community') {
        document.getElementById('communityView').style.display = 'block';
        document.getElementById('nav-community').classList.add('active');
        renderCommunity();
    } else if (view === 'store') {
        document.getElementById('storeView').style.display = 'block';
        document.getElementById('nav-store').classList.add('active');
    } else if (view === 'support') {
        document.getElementById('supportView').style.display = 'block';
        document.getElementById('nav-support').classList.add('active');
    } else if (view === 'settings') {
        document.getElementById('settingsView').style.display = 'block';
        document.getElementById('nav-settings').classList.add('active');
        updateViewDisplay();
    }
    
    currentView = view;
}

function renderGames() {
    const gameList = document.getElementById('gameList');
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
    if (game.id === 1) return getTapFrenzyHTML();
    if (game.id === 2) return getWhackHTML();
    if (game.id === 3) return getReactionHTML();
    if (game.id === 4) return getMemoryHTML();
    if (game.id === 5) return getTicTacToeHTML();
    if (game.id === 6) return getGuessHTML();
    if (game.id === 7) return getHigherLowerHTML();
    if (game.id === 8) return getDiceHTML();
    if (game.id === 9) return getCoinHTML();
    if (game.id === 10) return getRPSHTML();
    return '<div style="text-align:center;padding:40px;">Coming soon</div>';
}

function getTapFrenzyHTML() {
    return `
        <div class="game-3d-container">
            <div class="game-stats">
                <div class="stat-3d"><span>Score</span><strong id="tapScore">0</strong></div>
                <div class="stat-3d"><span>Time</span><strong id="tapTime">10.0</strong></div>
            </div>
            <button class="tap-button-3d" id="tapBtn" onclick="tapFrenzyTap()">TAP</button>
            <p class="game-instruction">Tap as fast as you can!</p>
        </div>
    `;
}

function getWhackHTML() {
    let holes = '';
    for (let i = 0; i < 9; i++) holes += `<div class="mole-hole-3d" id="hole${i}" onclick="whackMole(${i})"></div>`;
    return `
        <div class="game-3d-container">
            <div class="game-stats">
                <div class="stat-3d"><span>Score</span><strong id="whackScore">0</strong></div>
                <div class="stat-3d"><span>Time</span><strong id="whackTime">20</strong></div>
            </div>
            <div class="mole-grid-3d">${holes}</div>
            <button class="game-btn-3d" onclick="startWhack()">Start</button>
        </div>
    `;
}

function getReactionHTML() {
    return `
        <div class="game-3d-container">
            <div class="reaction-box-3d" id="reactionBox" onclick="reactionTap()">
                <span id="reactionText">Tap to Start</span>
            </div>
            <p class="game-instruction">Tap when the box turns green</p>
            <div class="game-stats"><div class="stat-3d"><span>Time</span><strong id="reactionTime">-</strong></div></div>
        </div>
    `;
}

function getMemoryHTML() {
    let cards = '';
    for (let i = 0; i < 16; i++) cards += `<div class="memory-card-3d" id="mem${i}" onclick="flipCard(${i})"><div class="memory-card-inner"><div class="memory-card-front">?</div><div class="memory-card-back" id="memBack${i}"></div></div></div>`;
    return `
        <div class="game-3d-container">
            <div class="memory-grid-3d">${cards}</div>
            <button class="game-btn-3d" onclick="startMemory()">New Game</button>
        </div>
    `;
}

function getTicTacToeHTML() {
    let cells = '';
    for (let i = 0; i < 9; i++) cells += `<div class="ttt-cell-3d" id="ttt${i}" onclick="tttMove(${i})"></div>`;
    return `
        <div class="game-3d-container">
            <p id="tttStatus" style="text-align:center;margin-bottom:20px;">Your turn (X)</p>
            <div class="ttt-grid-3d">${cells}</div>
            <button class="game-btn-3d" onclick="resetTTT()" style="margin-top:20px;">Reset</button>
        </div>
    `;
}

function getGuessHTML() {
    return `
        <div class="game-3d-container">
            <p style="text-align:center;margin-bottom:20px;">Guess a number between 1 and 100</p>
            <div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;">
                <input type="number" id="guessInput" class="guess-input-3d" min="1" max="100">
                <button class="game-btn-3d" onclick="guessNumber()">Guess</button>
            </div>
            <p id="guessHint" style="text-align:center;color:rgba(255,255,255,0.7);"></p>
            <p id="guessCount" style="text-align:center;margin-top:10px;">Attempts: 0</p>
        </div>
    `;
}

function getHigherLowerHTML() {
    return `
        <div class="game-3d-container">
            <div style="display:flex;gap:30px;justify-content:center;margin-bottom:30px;align-items:center;">
                <div class="card-3d" id="currentCard">?</div>
                <div style="font-size:32px;">VS</div>
                <div class="card-3d" id="nextCard">?</div>
            </div>
            <p id="hlScore" style="text-align:center;margin-bottom:20px;">Score: 0</p>
            <div style="display:flex;gap:15px;justify-content:center;">
                <button class="game-btn-3d" onclick="hlGuess(false)">Lower</button>
                <button class="game-btn-3d" onclick="hlGuess(true)">Higher</button>
            </div>
            <button class="game-btn-3d" onclick="startHL()" style="margin-top:20px;">Start</button>
        </div>
    `;
}

function getDiceHTML() {
    return `
        <div class="game-3d-container">
            <div style="display:flex;gap:20px;justify-content:center;margin-bottom:30px;">
                <div class="dice-3d" id="dice1">1</div>
                <div class="dice-3d" id="dice2">1</div>
            </div>
            <p id="diceResult" style="text-align:center;margin-bottom:20px;">Roll the dice!</p>
            <button class="game-btn-3d" onclick="rollDice()">Roll</button>
        </div>
    `;
}

function getCoinHTML() {
    return `
        <div class="game-3d-container">
            <div class="coin-3d-container">
                <div class="coin-3d" id="coin3d">
                    <div class="coin-face coin-heads">H</div>
                    <div class="coin-face coin-tails">T</div>
                </div>
            </div>
            <p id="coinResult" style="text-align:center;margin:20px 0;">Flip the coin!</p>
            <button class="game-btn-3d" onclick="flipCoin()">Flip</button>
        </div>
    `;
}

function getRPSHTML() {
    return `
        <div class="game-3d-container">
            <div style="display:flex;gap:30px;justify-content:center;margin-bottom:20px;align-items:center;">
                <div style="text-align:center;">
                    <div style="font-size:14px;margin-bottom:10px;">You</div>
                    <div class="rps-choice-3d" id="rpsYou">?</div>
                </div>
                <div style="font-size:24px;font-weight:bold;">VS</div>
                <div style="text-align:center;">
                    <div style="font-size:14px;margin-bottom:10px;">Bot</div>
                    <div class="rps-choice-3d" id="rpsBot">?</div>
                </div>
            </div>
            <p id="rpsScore" style="text-align:center;margin-bottom:20px;">You: 0 | Bot: 0</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button class="rps-btn-3d" onclick="playRPS('rock')">Rock</button>
                <button class="rps-btn-3d" onclick="playRPS('paper')">Paper</button>
                <button class="rps-btn-3d" onclick="playRPS('scissors')">Scissors</button>
            </div>
        </div>
    `;
}

// Game implementations
function initGame(game) {
    if (game.id === 1) initTapFrenzy();
    if (game.id === 2) initWhack();
    if (game.id === 3) initReaction();
    if (game.id === 4) initMemory();
    if (game.id === 5) resetTTT();
    if (game.id === 6) initGuess();
    if (game.id === 7) startHL();
    if (game.id === 10) resetRPS();
}

function initTapFrenzy() {
    gameState.tap = { score: 0, time: 10, running: false };
    document.getElementById('tapScore').textContent = '0';
    document.getElementById('tapTime').textContent = '10.0';
    document.getElementById('tapBtn').textContent = 'START';
}

function tapFrenzyTap() {
    if (!gameState.tap.running) {
        gameState.tap.running = true;
        gameState.tap.score = 0;
        gameState.tap.time = 10;
        document.getElementById('tapBtn').textContent = 'TAP';
        document.getElementById('tapScore').textContent = '0';
        gameState.timer = setInterval(() => {
            gameState.tap.time -= 0.1;
            document.getElementById('tapTime').textContent = gameState.tap.time.toFixed(1);
            if (gameState.tap.time <= 0) {
                clearInterval(gameState.timer);
                gameState.tap.running = false;
                document.getElementById('tapBtn').textContent = 'GAME OVER';
                saveScore('Tap Frenzy', gameState.tap.score);
                alert('Score: ' + gameState.tap.score + (currentUser.type !== 'guest' ? ' (Saved)' : ''));
            }
        }, 100);
    } else {
        gameState.tap.score++;
        document.getElementById('tapScore').textContent = gameState.tap.score;
    }
}

function initWhack() {
    gameState.whack = { score: 0, time: 20, running: false, active: -1 };
    document.getElementById('whackScore').textContent = '0';
    document.getElementById('whackTime').textContent = '20';
}

function startWhack() {
    if (gameState.whack.running) return;
    gameState.whack.running = true;
    gameState.whack.score = 0;
    gameState.whack.time = 20;
    document.getElementById('whackScore').textContent = '0';
    
    gameState.timer = setInterval(() => {
        gameState.whack.time--;
        document.getElementById('whackTime').textContent = gameState.whack.time;
        if (gameState.whack.time <= 0) {
            clearInterval(gameState.timer);
            gameState.whack.running = false;
            saveScore('Whack-a-Mole', gameState.whack.score);
            alert('Score: ' + gameState.whack.score + (currentUser.type !== 'guest' ? ' (Saved)' : ''));
        }
    }, 1000);
    
    setInterval(() => {
        if (!gameState.whack.running) return;
        for (let i = 0; i < 9; i++) document.getElementById('hole' + i).classList.remove('active');
        const active = Math.floor(Math.random() * 9);
        document.getElementById('hole' + active).classList.add('active');
        gameState.whack.active = active;
    }, 800);
}

function whackMole(i) {
    if (gameState.whack.running && i === gameState.whack.active) {
        gameState.whack.score++;
        document.getElementById('whackScore').textContent = gameState.whack.score;
        document.getElementById('hole' + i).classList.remove('active');
    }
}

function initReaction() {
    gameState.reaction = { state: 'idle' };
    document.getElementById('reactionBox').style.background = '#333';
    document.getElementById('reactionText').textContent = 'Tap to Start';
}

function reactionTap() {
    const box = document.getElementById('reactionBox');
    const text = document.getElementById('reactionText');
    if (gameState.reaction.state === 'idle') {
        box.style.background = '#f59e0b';
        text.textContent = 'Wait for green...';
        gameState.reaction.state = 'waiting';
        setTimeout(() => {
            if (gameState.reaction.state === 'waiting') {
                box.style.background = '#22c55e';
                text.textContent = 'TAP NOW!';
                gameState.reaction.state = 'ready';
                gameState.reaction.start = Date.now();
            }
        }, Math.random() * 3000 + 1000);
    } else if (gameState.reaction.state === 'ready') {
        const time = Date.now() - gameState.reaction.start;
        document.getElementById('reactionTime').textContent = time + 'ms';
        box.style.background = '#333';
        text.textContent = 'Tap to try again';
        gameState.reaction.state = 'idle';
    } else if (gameState.reaction.state === 'waiting') {
        box.style.background = '#ef4444';
        text.textContent = 'Too early! Tap to try again';
        gameState.reaction.state = 'idle';
    }
}

function initMemory() {
    gameState.memory = { cards: [], flipped: [], matched: [] };
}

function startMemory() {
    const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
    gameState.memory = { cards, flipped: [], matched: [] };
    for (let i = 0; i < 16; i++) {
        document.getElementById('mem' + i).classList.remove('flipped', 'matched');
        document.getElementById('memBack' + i).textContent = cards[i];
    }
}

function flipCard(i) {
    if (gameState.memory.flipped.length >= 2) return;
    if (gameState.memory.matched.includes(i)) return;
    if (gameState.memory.flipped.includes(i)) return;
    
    document.getElementById('mem' + i).classList.add('flipped');
    gameState.memory.flipped.push(i);
    
    if (gameState.memory.flipped.length === 2) {
        setTimeout(() => {
            const [a, b] = gameState.memory.flipped;
            if (gameState.memory.cards[a] === gameState.memory.cards[b]) {
                document.getElementById('mem' + a).classList.add('matched');
                document.getElementById('mem' + b).classList.add('matched');
                gameState.memory.matched.push(a, b);
            } else {
                document.getElementById('mem' + a).classList.remove('flipped');
                document.getElementById('mem' + b).classList.remove('flipped');
            }
            gameState.memory.flipped = [];
            if (gameState.memory.matched.length === 16) alert('You won!');
        }, 800);
    }
}

function resetTTT() {
    gameState.ttt = { board: Array(9).fill(null), turn: 'X' };
    for (let i = 0; i < 9; i++) {
        document.getElementById('ttt' + i).textContent = '';
        document.getElementById('ttt' + i).classList.remove('x', 'o');
    }
    document.getElementById('tttStatus').textContent = 'Your turn (X)';
}

function tttMove(i) {
    if (gameState.ttt.board[i] || gameState.ttt.turn !== 'X') return;
    gameState.ttt.board[i] = 'X';
    document.getElementById('ttt' + i).textContent = 'X';
    document.getElementById('ttt' + i).classList.add('x');
    gameState.ttt.turn = 'O';
    document.getElementById('tttStatus').textContent = 'Bot thinking...';
    setTimeout(() => tttBot(), 500);
}

function tttBot() {
    const empty = gameState.ttt.board.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
    if (empty.length === 0) {
        document.getElementById('tttStatus').textContent = 'Draw!';
        return;
    }
    const move = empty[Math.floor(Math.random() * empty.length)];
    gameState.ttt.board[move] = 'O';
    document.getElementById('ttt' + move).textContent = 'O';
    document.getElementById('ttt' + move).classList.add('o');
    gameState.ttt.turn = 'X';
    document.getElementById('tttStatus').textContent = 'Your turn (X)';
}

function initGuess() {
    gameState.guess = { number: Math.floor(Math.random() * 100) + 1, count: 0 };
    document.getElementById('guessInput').value = '';
    document.getElementById('guessHint').textContent = '';
    document.getElementById('guessCount').textContent = 'Attempts: 0';
}

function guessNumber() {
    const input = document.getElementById('guessInput');
    const guess = parseInt(input.value);
    if (isNaN(guess)) return;
    gameState.guess.count++;
    document.getElementById('guessCount').textContent = 'Attempts: ' + gameState.guess.count;
    if (guess === gameState.guess.number) {
        document.getElementById('guessHint').textContent = 'Correct!';
        document.getElementById('guessHint').style.color = '#22c55e';
    } else if (guess < gameState.guess.number) {
        document.getElementById('guessHint').textContent = 'Higher!';
        document.getElementById('guessHint').style.color = '#f59e0b';
    } else {
        document.getElementById('guessHint').textContent = 'Lower!';
        document.getElementById('guessHint').style.color = '#f59e0b';
    }
    input.value = '';
}

function startHL() {
    gameState.hl = { score: 0, current: Math.floor(Math.random() * 13) + 1 };
    document.getElementById('currentCard').textContent = gameState.hl.current;
    document.getElementById('nextCard').textContent = '?';
    document.getElementById('hlScore').textContent = 'Score: 0';
}

function hlGuess(higher) {
    const next = Math.floor(Math.random() * 13) + 1;
    document.getElementById('nextCard').textContent = next;
    if ((higher && next > gameState.hl.current) || (!higher && next < gameState.hl.current)) {
        gameState.hl.score++;
        document.getElementById('hlScore').textContent = 'Score: ' + gameState.hl.score;
    } else if (next === gameState.hl.current) {
        document.getElementById('hlScore').textContent = 'Score: ' + gameState.hl.score + ' (Push)';
    } else {
        alert('Game Over! Score: ' + gameState.hl.score);
        startHL();
        return;
    }
    gameState.hl.current = next;
    setTimeout(() => {
        document.getElementById('currentCard').textContent = gameState.hl.current;
        document.getElementById('nextCard').textContent = '?';
    }, 1000);
}

function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice1').textContent = d1;
    document.getElementById('dice2').textContent = d2;
    document.getElementById('diceResult').textContent = 'Total: ' + (d1 + d2);
}

function flipCoin() {
    const coin = document.getElementById('coin3d');
    coin.style.transform = 'rotateY(720deg)';
    setTimeout(() => {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        document.getElementById('coinResult').textContent = result + '!';
        coin.style.transform = 'rotateY(0deg)';
    }, 600);
}

function resetRPS() {
    gameState.rps = { you: 0, bot: 0 };
    document.getElementById('rpsYou').textContent = '?';
    document.getElementById('rpsBot').textContent = '?';
    document.getElementById('rpsScore').textContent = 'You: 0 | Bot: 0';
}

function playRPS(choice) {
    const choices = ['rock', 'paper', 'scissors'];
    const bot = choices[Math.floor(Math.random() * 3)];
    document.getElementById('rpsYou').textContent = choice === 'rock' ? 'R' : choice === 'paper' ? 'P' : 'S';
    document.getElementById('rpsBot').textContent = bot === 'rock' ? 'R' : bot === 'paper' ? 'P' : 'S';
    
    if (choice === bot) {
        alert('Draw!');
    } else if ((choice === 'rock' && bot === 'scissors') || (choice === 'paper' && bot === 'rock') || (choice === 'scissors' && bot === 'paper')) {
        gameState.rps.you++;
        alert('You win!');
    } else {
        gameState.rps.bot++;
        alert('Bot wins!');
    }
    document.getElementById('rpsScore').textContent = 'You: ' + gameState.rps.you + ' | Bot: ' + gameState.rps.bot;
}

function closePromo() {
    document.getElementById('promoBanner').style.display = 'none';
}

// Initialize
function initViewCounter() {
    let views = parseInt(localStorage.getItem('lessfun_views') || '0');
    views++;
    localStorage.setItem('lessfun_views', views.toString());
}

document.addEventListener('DOMContentLoaded', () => {
    renderGames();
    loadUser();
    initViewCounter();
    updateViewDisplay();
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

function signUp() {
    const username = document.getElementById("signupUsername").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    if (!username || !password) { alert("Please fill in all fields"); return; }
    const users = JSON.parse(localStorage.getItem("lessfun_users") || "[]");
    if (users.find(u => u.username === username)) { alert("Username already exists"); return; }
    users.push({ username, email, password, scores: {} });
    localStorage.setItem("lessfun_users", JSON.stringify(users));
    currentUser = { type: "user", username, scores: {} };
    localStorage.setItem("lessfun_user", JSON.stringify(currentUser));
    closeAuthModal();
    updateUserSection();
    alert("Account created!");
}

function signIn() {
    const username = document.getElementById("signinUsername").value;
    const password = document.getElementById("signinPassword").value;
    const users = JSON.parse(localStorage.getItem("lessfun_users") || "[]");
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) { alert("Invalid credentials"); return; }
    currentUser = { type: "user", username: user.username, scores: user.sores || {} };
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

function logout() {
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
function createPost() {
    if (currentUser.type === "guest") {
        alert("Please sign in to post");
        openAuthModal();
        return;
    }
    const content = document.getElementById("postContent").value.trim();
    if (!content) return;
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

function deletePost(id) {
    if (currentUser.username !== "TotallyMason") return;
    let posts = JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    posts = posts.filter(p => p.id !== id);
    localStorage.setItem("lessfun_posts", JSON.stringify(posts));
    renderCommunity();
}

function renderCommunity() {
    const posts = JSON.parse(localStorage.getItem("lessfun_posts") || "[]");
    const container = document.getElementById("communityPosts");
    if (posts.length === 0) {
        container.innerHTML = "<p style=\"text-align:center;color:rgba(255,255,255,0.5);padding:40px;\">No posts yet</p>";
        return;
    }
    container.innerHTML = posts.map(post => {
        const date = new Date(post.time);
        const canDelete = currentUser && currentUser.username === "TotallyMason";
        const isOwner = post.user === "TotallyMason";
        return `<div class="community-post"><div class="post-header"><div style="display:flex;align-items:center;gap:8px;"><span class="post-user">${post.user}</span>${isOwner ? '<span style="font-size:9px;padding:2px 5px;background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:4px;font-weight:600;">OWNER</span>' : ''}</div><span class="post-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span></div><div class="post-content">${escapeHtml(post.content)}</div>${canDelete ? `<button class="post-delete" onclick="deletePost(${post.id})">Delete</button>` : ""}</div>`;
    }).join("");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
