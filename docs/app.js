const games = [
    { id: 1, name: "Tap Frenzy", description: "Tap as fast as you can for 10 seconds", icon: "⚡" },
    { id: 2, name: "Whack-a-Mole", description: "Bonk the moles, avoid bombs", icon: "🔨" },
    { id: 3, name: "Reaction Test", description: "Tap when the screen turns green", icon: "⏱️" },
    { id: 4, name: "Memory Match", description: "Flip cards and find pairs", icon: "🧠" },
    { id: 5, name: "Tic-Tac-Toe", description: "Beat the robot opponent", icon: "⭕" },
    { id: 6, name: "Guess the Number", description: "Find the hidden number", icon: "🔢" },
    { id: 7, name: "Higher or Lower", description: "Guess if next card is higher or lower", icon: "🃏" },
    { id: 8, name: "Dice Roller", description: "Roll the dice and predict", icon: "🎲" },
    { id: 9, name: "Coin Flip", description: "Heads or tails", icon: "🪙" },
    { id: 10, name: "Rock Paper Scissors", description: "First to three wins", icon: "✂️" }
];

let currentView = 'games';

function showView(view) {
    // Hide all views
    document.getElementById('gamesView').style.display = 'none';
    document.getElementById('storeView').style.display = 'none';
    document.getElementById('supportView').style.display = 'none';
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected view and activate nav button
    if (view === 'games') {
        document.getElementById('gamesView').style.display = 'block';
        document.getElementById('nav-games').classList.add('active');
    } else if (view === 'store') {
        document.getElementById('storeView').style.display = 'block';
        document.getElementById('nav-store').classList.add('active');
    } else if (view === 'support') {
        document.getElementById('supportView').style.display = 'block';
        document.getElementById('nav-support').classList.add('active');
    }
    
    currentView = view;
}

function renderGames(filter = '') {
    const gameList = document.getElementById('gameList');
    const filteredGames = filter 
        ? games.filter(g => g.name.toLowerCase().includes(filter.toLowerCase()) || g.description.toLowerCase().includes(filter.toLowerCase()))
        : games;
    
    gameList.innerHTML = filteredGames.map(game => `
        <div class="game-card" onclick="openGame(${game.id})">
            <div class="game-icon">${game.icon}</div>
            <h3>${game.name}</h3>
            <p>${game.description}</p>
        </div>
    `).join('');
}

function searchGames() {
    const searchInput = document.getElementById('searchInput');
    renderGames(searchInput.value);
}

function openGame(id) {
    const game = games.find(g => g.id === id);
    document.getElementById('modalGameTitle').textContent = game.name;
    document.getElementById('modalGameBody').innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 64px; margin-bottom: 16px;">${game.icon}</div>
            <p style="color: rgba(255,255,255,0.7); font-size: 17px; margin-bottom: 24px;">${game.description}</p>
            <div style="padding: 16px; background: rgba(255,255,255,0.05); border-radius: 10px; color: rgba(255,255,255,0.5);">
                Game coming soon
            </div>
        </div>
    `;
    document.getElementById('gameModal').style.display = 'flex';
}

function closeGame() {
    document.getElementById('gameModal').style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderGames();
});
