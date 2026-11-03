const games = [
    { id: 1, name: "Tap Frenzy", description: "Tap as fast as you can", color: "#f59e0b" },
    { id: 2, name: "Whack-a-Mole", description: "Bonk the moles", color: "#22c55e" },
    { id: 3, name: "Reaction Test", description: "Tap when green", color: "#3b82f6" },
    { id: 4, name: "Memory Match", description: "Find pairs", color: "#ec4899" },
    { id: 5, name: "Tic-Tac-Toe", description: "Beat the robot", color: "#8b5cf6" },
    { id: 6, name: "Guess the Number", description: "Find the number", color: "#06b6d4" },
    { id: 7, name: "Higher or Lower", description: "Guess the card", color: "#f97316" },
    { id: 8, name: "Dice Roller", description: "Roll the dice", color: "#ef4444" },
    { id: 9, name: "Coin Flip", description: "Heads or tails", color: "#eab308" },
    { id: 10, name: "Rock Paper Scissors", description: "First to three", color: "#10b981" }
];

function renderGameList() {
    const gameList = document.getElementById('gameList');
    gameList.innerHTML = games.map(game => `
        <div class="game-card" onclick="openGame(${game.id})" style="border-color: ${game.color}40;">
            <h3>${game.name}</h3>
            <p>${game.description}</p>
        </div>
    `).join('');
}

function openGame(id) {
    const game = games.find(g => g.id === id);
    document.getElementById('gameList').style.display = 'none';
    document.getElementById('gameView').style.display = 'block';
    document.getElementById('gameTitle').textContent = game.name;
    document.getElementById('gameContent').innerHTML = `
        <div class="game-content">
            <p style="color: #a1a1aa; margin-bottom: 20px;">${game.description}</p>
            <p style="color: #666;">Coming soon...</p>
        </div>
    `;
}

function showList() {
    document.getElementById('gameList').style.display = 'grid';
    document.getElementById('gameView').style.display = 'none';
}

renderGameList();
