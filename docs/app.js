const games = [
  { id: 'tap', name: 'Tap Frenzy', desc: 'Tap as fast as you can' },
  { id: 'whack', name: 'Whack-a-Mole', desc: 'Bonk the moles' },
  { id: 'reaction', name: 'Reaction Test', desc: 'Tap when green' },
  { id: 'memory', name: 'Memory Match', desc: 'Find pairs' },
  { id: 'ttt', name: 'Tic-Tac-Toe', desc: 'Beat the robot' },
  { id: 'guess', name: 'Guess the Number', desc: 'Find the number' },
  { id: 'hl', name: 'Higher or Lower', desc: 'Guess the card' },
  { id: 'dice', name: 'Dice Roller', desc: 'Roll the dice' },
  { id: 'coin', name: 'Coin Flip', desc: 'Heads or tails' },
  { id: 'rps', name: 'Rock Paper Scissors', desc: 'First to three' }
];

const app = document.getElementById('app');

function showHome() {
  app.innerHTML = '<div class="grid">' + 
    games.map(g => `<div class="card" onclick="showGame('${g.id}')"><h2>${g.name}</h2><p>${g.desc}</p></div>`).join('') +
    '</div>';
}

function showGame(id) {
  const game = games.find(g => g.id === id);
  app.innerHTML = `
    <button class="back" onclick="showHome()">← Back</button>
    <div class="game">
      <h2>${game.name}</h2>
      <p>${game.desc}</p>
      <p style="color:#666">Game coming soon</p>
    </div>
  `;
}

showHome();
