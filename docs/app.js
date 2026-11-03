const games = [
    { id: 1, name: "Tap Frenzy", description: "Tap as fast as you can for 10 seconds", icon: "hand.tap" },
    { id: 2, name: "Whack-a-Mole", description: "Bonk the moles, avoid bombs", icon: "hammer" },
    { id: 3, name: "Reaction Test", description: "Tap when the screen turns green", icon: "bolt" },
    { id: 4, name: "Memory Match", description: "Flip cards and find pairs", icon: "brain" },
    { id: 5, name: "Tic-Tac-Toe", description: "Beat the robot opponent", icon: "grid" },
    { id: 6, name: "Guess the Number", description: "Find the hidden number", icon: "hash" },
    { id: 7, name: "Higher or Lower", description: "Guess if next card is higher or lower", icon: "spade" },
    { id: 8, name: "Dice Roller", description: "Roll the dice and predict", icon: "dice" },
    { id: 9, name: "Coin Flip", description: "Heads or tails", icon: "circle" },
    { id: 10, name: "Rock Paper Scissors", description: "First to three wins", icon: "scissors" }
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

function renderGames(filter = '') {
    const gameList = document.getElementById('gameList');
    const filteredGames = filter 
        ? games.filter(g => g.name.toLowerCase().includes(filter.toLowerCase()) || g.description.toLowerCase().includes(filter.toLowerCase()))
        : games;
    
    gameList.innerHTML = filteredGames.map(game => `
        <div class="game-card" onclick="openGame(${game.id})">
            <div class="game-icon">${getIcon(game.icon)}</div>
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
            <div style="width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(236,72,153,0.3) 100%); border-radius: 20px;">
                ${getIcon(game.icon).replace('width="24" height="24"', 'width="40" height="40"')}
            </div>
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
function closePromo() {
    document.getElementById('promoBanner').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    renderGames();
});
