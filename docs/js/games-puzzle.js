/* LessFun puzzle games: Memory Match, Tic-Tac-Toe, Guess the Number. */
(function () {
  "use strict";

  var icon = LF.icon;
  var stats = LF.stats;
  var difficultyBar = LF.difficultyBar;

  function screenMarkup(difficulty, inner) {
    return difficultyBar(difficulty) + inner;
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setBar(node, value) {
    if (!node) return;
    var fill = node.querySelector("span");
    if (fill) fill.style.width = Math.max(0, Math.min(1, value)) * 100 + "%";
  }

  function shuffle(list) {
    for (var index = list.length - 1; index > 0; index -= 1) {
      var swap = Math.floor(Math.random() * (index + 1));
      var temp = list[index];
      list[index] = list[swap];
      list[swap] = temp;
    }
    return list;
  }

  // ---------------------------------------------------------------------------
  // Memory Match
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "memory",
    title: "Memory Match",
    tagline: "Find the pairs. Beat the clock.",
    icon: "brain",
    category: "puzzle",
    color: "#ff6bb5",
    glow: "rgba(255, 77, 157, 0.4)",
    bestKey: "best.memory",
    bestSuffix: " mv",
    mount: function (ctx) {
      var pool = [
        { icon: "leaf", tint: "#22c55e" },
        { icon: "zap", tint: "#f59e0b" },
        { icon: "flame", tint: "#f97316" },
        { icon: "droplet", tint: "#4d9bff" },
        { icon: "star", tint: "#a855f7" },
        { icon: "moon", tint: "#6366f1" },
        { icon: "cloud", tint: "#22d3ee" },
        { icon: "snowflake", tint: "#2dd4bf" }
      ];

      var pairCount = ctx.difficulty === "chill" ? 4 : ctx.difficulty === "brutal" ? 8 : 6;
      var best = LF.get("best.memory", 0);
      var cards = [];
      var firstPick = null;
      var moves = 0;
      var elapsed = 0;
      var hasStarted = false;
      var busy = false;
      var won = false;

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Moves", value: "0", tone: "tone-pink", id: "memory-moves" },
          { label: "Pairs", value: "0/" + pairCount, tone: "tone-purple", id: "memory-pairs" },
          { label: "Time", value: "0:00", tone: "tone-blue", id: "memory-time" },
          { label: "Best", value: best > 0 ? best + " mv" : "—", tone: "tone-green", id: "memory-best" }
        ]) +
          '<div class="memory-grid" id="memory-grid"></div>' +
          '<div class="action-row"><button type="button" class="primary-btn" id="memory-shuffle">' + icon("refresh") + "<span>Shuffle</span></button></div>" +
          '<p class="hint">Flip two cards. Fewer moves means more stars.</p>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var grid = document.getElementById("memory-grid");

      function matchedPairs() {
        return cards.filter(function (card) { return card.matched; }).length / 2;
      }

      function starsFor() {
        if (moves <= Math.round(pairCount * 1.6)) return 3;
        if (moves <= Math.round(pairCount * 2.4)) return 2;
        return 1;
      }

      function updateStats() {
        setText("memory-moves", String(moves));
        setText("memory-pairs", matchedPairs() + "/" + pairCount);
        setText("memory-time", LF.fmtClock(elapsed));
        setText("memory-best", best > 0 ? best + " mv" : "—");
      }

      function renderGrid() {
        grid.innerHTML = cards
          .map(function (card, index) {
            var state = card.matched ? "matched" : card.faceUp ? "flipped" : "";
            return (
              '<button type="button" class="memory-card ' + state + '" data-index="' + index + '" aria-label="Card ' + (index + 1) + '">' +
              '<span class="memory-front" style="color:' + card.tint + '">' + icon(card.icon) + "</span>" +
              icon("help", "back") +
              "</button>"
            );
          })
          .join("");
        updateStats();
      }

      function reset() {
        var deck = [];
        pool.slice(0, pairCount).forEach(function (entry) {
          deck.push({ icon: entry.icon, tint: entry.tint, faceUp: false, matched: false });
          deck.push({ icon: entry.icon, tint: entry.tint, faceUp: false, matched: false });
        });

        cards = shuffle(deck);
        firstPick = null;
        moves = 0;
        elapsed = 0;
        hasStarted = false;
        busy = false;
        won = false;
        renderGrid();
      }

      function finish() {
        won = true;
        best = best === 0 ? moves : Math.min(best, moves);
        LF.set("best.memory", best);
        updateStats();

        LF.showResult({
          icon: "star",
          title: "Board cleared",
          text: starsFor() + " stars · " + moves + " moves · " + LF.fmtClock(elapsed),
          color: "#ff6bb5",
          primaryLabel: "Play again",
          onPrimary: reset,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function flip(index) {
        if (busy || won || index < 0 || index >= cards.length) return;
        var card = cards[index];
        if (card.faceUp || card.matched) return;

        hasStarted = true;
        card.faceUp = true;

        if (firstPick === null) {
          firstPick = index;
          renderGrid();
          return;
        }

        var previous = firstPick;
        moves += 1;

        if (cards[previous].icon === card.icon) {
          cards[previous].matched = true;
          card.matched = true;
          firstPick = null;
          renderGrid();

          if (cards.every(function (entry) { return entry.matched; })) {
            finish();
          }
        } else {
          busy = true;
          renderGrid();

          ctx.scope.after(function () {
            cards[previous].faceUp = false;
            card.faceUp = false;
            firstPick = null;
            busy = false;
            renderGrid();
          }, 700);
        }
      }

      grid.addEventListener("click", function (event) {
        var target = event.target.closest(".memory-card");
        if (!target) return;
        flip(Number(target.getAttribute("data-index")));
      });

      document.getElementById("memory-shuffle").addEventListener("click", reset);

      ctx.scope.every(function () {
        if (!hasStarted || won) return;
        elapsed += 1;
        updateStats();
      }, 1000);

      reset();
    }
  });

  // ---------------------------------------------------------------------------
  // Tic-Tac-Toe
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "ticTacToe",
    title: "Tic-Tac-Toe",
    tagline: "Three brains, one robot.",
    icon: "grid",
    category: "puzzle",
    color: "#8b8bff",
    glow: "rgba(99, 102, 241, 0.42)",
    bestKey: "ttt.wins",
    bestSuffix: " W",
    mount: function (ctx) {
      var wins = LF.get("ttt.wins", 0);
      var losses = LF.get("ttt.losses", 0);
      var draws = LF.get("ttt.draws", 0);

      var board = [null, null, null, null, null, null, null, null, null];
      var playerTurn = true;
      var thinking = false;
      var gameOver = false;
      var message = "Your move";
      var messageIcon = "hand";
      var winningLine = [];

      var lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "You", value: String(wins), tone: "tone-purple", id: "ttt-wins" },
          { label: "Robot", value: String(losses), tone: "tone-pink", id: "ttt-losses" },
          { label: "Draws", value: String(draws), tone: "tone-blue", id: "ttt-draws" }
        ]) +
          '<div class="ttt-grid" id="ttt-grid"></div>' +
          '<div class="message-bar" id="ttt-message"></div>' +
          '<div class="action-row">' +
          '<button type="button" class="primary-btn" id="ttt-new">' + icon("refresh") + "<span>New round</span></button>" +
          '<span class="hint">' + (ctx.difficulty === "brutal" ? "Unbeatable robot" : "Beatable robot") + "</span>" +
          "</div>"
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var grid = document.getElementById("ttt-grid");
      var messageBar = document.getElementById("ttt-message");

      function updateStats() {
        setText("ttt-wins", String(wins));
        setText("ttt-losses", String(losses));
        setText("ttt-draws", String(draws));
      }

      function renderMessage() {
        messageBar.innerHTML = icon(messageIcon) + "<span>" + message + "</span>";
      }

      function renderBoard() {
        grid.innerHTML = board
          .map(function (mark, index) {
            var tone = mark === "X" ? "x" : mark === "O" ? "o" : "";
            var win = winningLine.indexOf(index) !== -1 ? " win" : "";
            var body = mark === "X" ? icon("x") : mark === "O" ? icon("circle") : "";
            return (
              '<button type="button" class="ttt-cell ' + tone + win + '" data-index="' + index + '"' +
              (mark ? " disabled" : "") + ' aria-label="Cell ' + (index + 1) + '">' + body + "</button>"
            );
          })
          .join("");
        updateStats();
      }

      function winner(cells) {
        for (var index = 0; index < lines.length; index += 1) {
          var line = lines[index];
          var first = cells[line[0]];
          if (first && cells[line[1]] === first && cells[line[2]] === first) {
            return { mark: first, line: line };
          }
        }
        return null;
      }

      function available(cells) {
        var moves = [];
        cells.forEach(function (cell, index) {
          if (cell === null) moves.push(index);
        });
        return moves;
      }

      function winningMove(player) {
        var moves = available(board);
        for (var index = 0; index < moves.length; index += 1) {
          var copy = board.slice();
          copy[moves[index]] = player;
          if (winner(copy) && winner(copy).mark === player) return moves[index];
        }
        return null;
      }

      function tacticalMove() {
        var win = winningMove("O");
        if (win !== null) return win;

        var block = winningMove("X");
        if (block !== null) return block;

        if (board[4] === null) return 4;

        var corners = [0, 2, 6, 8].filter(function (index) { return board[index] === null; });
        if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

        var moves = available(board);
        return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
      }

      function minimax(cells, maximizing, depth) {
        var result = winner(cells);
        if (result) {
          return result.mark === "O" ? 10 - depth : depth - 10;
        }
        if (available(cells).length === 0) return 0;

        var value = maximizing ? -1000 : 1000;
        var moves = available(cells);
        for (var index = 0; index < moves.length; index += 1) {
          var copy = cells.slice();
          copy[moves[index]] = maximizing ? "O" : "X";
          var score = minimax(copy, !maximizing, depth + 1);
          value = maximizing ? Math.max(value, score) : Math.min(value, score);
        }
        return value;
      }

      function minimaxMove() {
        var bestScore = -1000;
        var bestMove = null;
        var moves = available(board);
        for (var index = 0; index < moves.length; index += 1) {
          var copy = board.slice();
          copy[moves[index]] = "O";
          var score = minimax(copy, false, 1);
          if (score > bestScore) {
            bestScore = score;
            bestMove = moves[index];
          }
        }
        return bestMove;
      }

      function finishIfNeeded() {
        var result = winner(board);
        if (result) {
          winningLine = result.line;
          gameOver = true;
          playerTurn = false;

          if (result.mark === "X") {
            wins += 1;
            LF.set("ttt.wins", wins);
            message = "You win";
            messageIcon = "trophy";
          } else {
            losses += 1;
            LF.set("ttt.losses", losses);
            message = "Robot wins";
            messageIcon = "cpu";
          }

          renderBoard();
          renderMessage();
          ctx.scope.after(showResult, 420);
          return true;
        }

        if (available(board).length === 0) {
          draws += 1;
          LF.set("ttt.draws", draws);
          gameOver = true;
          message = "Draw";
          messageIcon = "equal";
          renderBoard();
          renderMessage();
          ctx.scope.after(showResult, 420);
          return true;
        }

        return false;
      }

      function showResult() {
        var playerWon = message === "You win";
        LF.showResult({
          icon: playerWon ? "trophy" : message === "Draw" ? "equal" : "cpu",
          title: message,
          text: "You " + wins + " · Robot " + losses + " · Draws " + draws,
          color: playerWon ? "#8b8bff" : "#ff6bb5",
          primaryLabel: "Next round",
          onPrimary: startRound,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function startRound() {
        board = [null, null, null, null, null, null, null, null, null];
        winningLine = [];
        gameOver = false;
        playerTurn = true;
        thinking = false;
        message = "Your move";
        messageIcon = "hand";
        renderBoard();
        renderMessage();
      }

      function aiTurn() {
        if (gameOver) return;

        var move;
        if (ctx.difficulty === "chill") {
          var moves = available(board);
          move = moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
        } else if (ctx.difficulty === "brutal") {
          move = minimaxMove();
        } else {
          move = tacticalMove();
        }

        if (move !== null) {
          board[move] = "O";
        }

        thinking = false;
        renderBoard();

        if (finishIfNeeded()) return;

        playerTurn = true;
        message = "Your move";
        messageIcon = "hand";
        renderMessage();
      }

      function play(index) {
        if (!playerTurn || gameOver || board[index] !== null) return;

        board[index] = "X";
        renderBoard();

        if (finishIfNeeded()) return;

        playerTurn = false;
        thinking = true;
        message = "Robot is thinking";
        messageIcon = "cpu";
        renderMessage();

        ctx.scope.after(aiTurn, 400);
      }

      grid.addEventListener("click", function (event) {
        var target = event.target.closest(".ttt-cell");
        if (!target) return;
        play(Number(target.getAttribute("data-index")));
      });

      document.getElementById("ttt-new").addEventListener("click", startRound);

      renderBoard();
      renderMessage();
    }
  });

  // ---------------------------------------------------------------------------
  // Guess the Number
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "guessNumber",
    title: "Guess the Number",
    tagline: "Narrow it down, fast.",
    icon: "hash",
    category: "puzzle",
    color: "#4d9bff",
    glow: "rgba(77, 155, 255, 0.42)",
    bestKey: "best.guessNumber",
    bestSuffix: " tries",
    mount: function (ctx) {
      var upper = ctx.difficulty === "chill" ? 50 : ctx.difficulty === "brutal" ? 500 : 100;
      var maxAttempts = ctx.difficulty === "chill" ? 10 : ctx.difficulty === "brutal" ? 7 : 8;

      var best = LF.get("best.guessNumber", 0);
      var target = 1 + Math.floor(Math.random() * upper);
      var input = "";
      var attemptsUsed = 0;
      var history = [];
      var message = "I picked a number. Find it.";
      var won = false;
      var lost = false;

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Range", value: "1–" + upper, tone: "tone-blue", id: "guess-range" },
          { label: "Tries", value: String(maxAttempts), tone: "tone-green", id: "guess-tries" },
          { label: "Best", value: best > 0 ? best + " tries" : "—", tone: "tone-purple", id: "guess-best" }
        ]) +
          '<div class="guess-stage">' +
          '<div class="guess-display" id="guess-display">—</div>' +
          '<div class="guess-therm">' + icon("flame") +
          '<span class="hint">Proximity</span>' +
          '<div class="therm-bar" id="guess-therm"><span style="width:0%"></span></div>' +
          "</div>" +
          '<div class="message-bar" id="guess-message"></div>' +
          '<div class="keypad" id="guess-keypad">' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(function (digit) { return '<button type="button" class="keypad-btn" data-digit="' + digit + '">' + digit + "</button>"; })
            .join("") +
          '<button type="button" class="keypad-btn" data-action="delete" aria-label="Delete">' + icon("delete") + "</button>" +
          '<button type="button" class="keypad-btn" data-digit="0">0</button>' +
          '<button type="button" class="keypad-btn accent" data-action="submit" aria-label="Submit guess">' + icon("check") + "</button>" +
          "</div>" +
          '<div class="history-row" id="guess-history"></div>' +
          "</div>"
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var display = document.getElementById("guess-display");
      var therm = document.getElementById("guess-therm");
      var messageBar = document.getElementById("guess-message");
      var historyRow = document.getElementById("guess-history");
      var keypad = document.getElementById("guess-keypad");
      var submitButton = keypad.querySelector('[data-action="submit"]');

      function proximity() {
        if (!history.length) return 0;
        var span = upper - 1;
        var distance = Math.abs(target - history[0].value);
        return Math.max(0, 1 - distance / span);
      }

      function update() {
        display.textContent = input || "—";
        display.classList.toggle("empty", input === "");
        setText("guess-tries", String(Math.max(0, maxAttempts - attemptsUsed)));
        setText("guess-best", best > 0 ? best + " tries" : "—");

        var close = proximity();
        var fill = therm.querySelector("span");
        if (fill) {
          fill.style.width = close * 100 + "%";
          fill.style.background = close > 0.8
            ? "linear-gradient(90deg, #f97316, #ef4444)"
            : close > 0.55
              ? "linear-gradient(90deg, #f59e0b, #f97316)"
              : close > 0.3
                ? "linear-gradient(90deg, #eab308, #f59e0b)"
                : "linear-gradient(90deg, #4d9bff, #6366f1)";
        }

        messageBar.innerHTML =
          icon(won ? "check" : lost ? "x" : proximity() > 0.55 ? "flame" : "info") +
          "<span>" + message + "</span>";

        historyRow.innerHTML = history
          .map(function (entry) {
            return (
              '<span class="history-pill">' + entry.value +
              icon(entry.direction === "higher" ? "arrow-up" : "arrow-down") +
              "</span>"
            );
          })
          .join("");

        submitButton.disabled = input === "" || won || lost;
        keypad.querySelectorAll("[data-digit]").forEach(function (button) {
          button.disabled = won || lost;
        });
        keypad.querySelector('[data-action="delete"]').disabled = won || lost;
      }

      function press(digit) {
        if (won || lost || input.length >= 3) return;
        if (input === "0") input = "";
        input += String(digit);
        update();
      }

      function deleteLast() {
        if (won || lost || !input.length) return;
        input = input.slice(0, -1);
        update();
      }

      function finish(winning) {
        if (winning) {
          won = true;
          best = best === 0 ? attemptsUsed : Math.min(best, attemptsUsed);
          LF.set("best.guessNumber", best);
          message = "Correct.";
        } else {
          lost = true;
          message = "No tries left.";
        }

        update();

        LF.showResult({
          icon: winning ? "target" : "x",
          title: winning ? "Got it" : "Out of tries",
          text: winning
            ? target + " in " + attemptsUsed + (attemptsUsed === 1 ? " try" : " tries")
            : "The number was " + target + ".",
          color: winning ? "#4d9bff" : "#ef4444",
          primaryLabel: "New number",
          onPrimary: reset,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function submit() {
        if (won || lost) return;
        var guess = Number(input);
        if (!input || !Number.isFinite(guess) || guess < 1 || guess > upper) {
          input = "";
          message = "Enter a number from 1 to " + upper + ".";
          update();
          return;
        }

        if (history.some(function (entry) { return entry.value === guess; })) {
          message = "You already tried " + guess + ".";
          input = "";
          update();
          return;
        }

        attemptsUsed += 1;
        input = "";

        if (guess === target) {
          finish(true);
          return;
        }

        var direction = guess < target ? "higher" : "lower";
        history.unshift({ value: guess, direction: direction });

        if (attemptsUsed >= maxAttempts) {
          finish(false);
          return;
        }

        message = direction === "higher"
          ? guess + " is too low. Go higher."
          : guess + " is too high. Go lower.";
        update();
      }

      function reset() {
        target = 1 + Math.floor(Math.random() * upper);
        input = "";
        attemptsUsed = 0;
        history = [];
        message = "I picked a number. Find it.";
        won = false;
        lost = false;
        update();
      }

      keypad.addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button) return;
        var digit = button.getAttribute("data-digit");
        var action = button.getAttribute("data-action");
        if (digit !== null) press(Number(digit));
        if (action === "delete") deleteLast();
        if (action === "submit") submit();
      });

      update();
    }
  });
})();
