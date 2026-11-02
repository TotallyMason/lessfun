/* LessFun luck games: Higher / Lower, Dice Roller, Coin Flip. */
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
  // Higher / Lower
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "higherLower",
    title: "Higher / Lower",
    tagline: "A deck, three lives, one guess.",
    icon: "spade",
    category: "luck",
    color: "#b98bff",
    glow: "rgba(155, 91, 255, 0.44)",
    bestKey: "best.higherLower",
    bestSuffix: " pts",
    mount: function (ctx) {
      var suits = [
        { icon: "spade", red: false },
        { icon: "heart", red: true },
        { icon: "diamond", red: true },
        { icon: "club", red: false }
      ];
      var rankNames = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      var maxLives = ctx.difficulty === "chill" ? 5 : ctx.difficulty === "brutal" ? 2 : 3;
      var multiplier = ctx.difficulty === "chill" ? 1 : ctx.difficulty === "brutal" ? 3 : 2;

      var best = LF.get("best.higherLower", 0);
      var deck = [];
      var current = null;
      var next = null;
      var revealed = false;
      var lives = maxLives;
      var streak = 0;
      var bestStreak = 0;
      var score = 0;
      var gameOver = false;
      var message = "Will the next card be higher or lower?";
      var outcome = null;

      function makeDeck() {
        var cards = [];
        for (var suit = 0; suit < suits.length; suit += 1) {
          for (var rank = 1; rank <= 13; rank += 1) {
            cards.push({ rank: rank, suit: suit });
          }
        }
        return shuffle(cards);
      }

      function cardMarkup(card, faceUp) {
        if (!card || !faceUp) {
          return (
            '<div class="play-card back">' +
            '<span class="card-rank">?</span>' +
            '<span class="card-suit-large">' + icon("club") + "</span>" +
            '<span class="card-rank bottom">?</span>' +
            "</div>"
          );
        }

        var suit = suits[card.suit];
        return (
          '<div class="play-card ' + (suit.red ? "red" : "") + '">' +
          '<span class="card-rank">' + rankNames[card.rank - 1] + "</span>" +
          '<span class="card-suit-large">' + icon(suit.icon) + "</span>" +
          '<span class="card-rank bottom">' + rankNames[card.rank - 1] + "</span>" +
          "</div>"
        );
      }

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Lives", value: String(lives), tone: "tone-red", id: "hl-lives" },
          { label: "Streak", value: "0", tone: "tone-purple", id: "hl-streak" },
          { label: "Score", value: "0", tone: "tone-green", id: "hl-score" },
          { label: "Best", value: String(best), tone: "tone-orange", id: "hl-best" }
        ]) +
          '<div class="cards-row" id="hl-cards"></div>' +
          '<div class="message-bar" id="hl-message"></div>' +
          '<div class="guess-actions">' +
          '<button type="button" class="primary-btn btn-teal" id="hl-lower">' + icon("arrow-down") + "<span>Lower</span></button>" +
          '<button type="button" class="primary-btn btn-purple" id="hl-higher">' + icon("arrow-up") + "<span>Higher</span></button>" +
          "</div>" +
          '<div class="split-hint"><span id="hl-deck">52 cards left</span><span>Streak of 5 earns a life</span></div>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var cardsRow = document.getElementById("hl-cards");
      var messageBar = document.getElementById("hl-message");
      var lowerButton = document.getElementById("hl-lower");
      var higherButton = document.getElementById("hl-higher");

      function render() {
        cardsRow.innerHTML = cardMarkup(current, true) + '<span class="cards-arrow">' + icon("chevron-right") + "</span>" + cardMarkup(next, revealed);

        setText("hl-lives", String(Math.max(0, lives)));
        setText("hl-streak", String(streak));
        setText("hl-score", String(score));
        setText("hl-best", String(best));
        setText("hl-deck", deck.length + " cards left");

        var messageIcon = outcome === "win" ? "check" : outcome === "loss" ? "x" : outcome === "push" ? "equal" : "help";
        var messageColor = outcome === "win" ? "#22c55e" : outcome === "loss" ? "#ef4444" : "inherit";
        messageBar.innerHTML =
          '<span style="color:' + messageColor + '">' + icon(messageIcon) + "</span><span>" + message + "</span>";

        var disabled = revealed || gameOver;
        lowerButton.disabled = disabled;
        higherButton.disabled = disabled;
      }

      function reset() {
        deck = makeDeck();
        current = deck.pop();
        next = null;
        revealed = false;
        lives = maxLives;
        streak = 0;
        bestStreak = 0;
        score = 0;
        gameOver = false;
        outcome = null;
        message = "Will the next card be higher or lower?";
        render();
      }

      function finish() {
        gameOver = true;
        best = Math.max(best, score);
        LF.set("best.higherLower", best);
        render();

        LF.showResult({
          icon: "spade",
          title: "Deck wins",
          text: score + " points · best streak " + bestStreak + " · record " + best,
          color: "#b98bff",
          primaryLabel: "Deal again",
          onPrimary: reset,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function guess(higher) {
        if (revealed || gameOver || !current) return;

        if (!deck.length) deck = makeDeck();
        var drawn = deck.pop();
        if (!drawn) return;

        next = drawn;
        revealed = true;

        if (drawn.rank === current.rank) {
          outcome = "push";
          message = "Push. Same rank, no cost.";
        } else if ((drawn.rank > current.rank) === higher) {
          outcome = "win";
          streak += 1;
          bestStreak = Math.max(bestStreak, streak);
          var points = 10 * streak * multiplier;
          score += points;

          if (streak % 5 === 0 && lives < maxLives) {
            lives += 1;
            message = "Correct +" + points + ". Bonus life.";
          } else {
            message = "Correct +" + points + " · streak " + streak + ".";
          }

          if (score > best) {
            best = score;
            LF.set("best.higherLower", best);
          }
        } else {
          outcome = "loss";
          lives -= 1;
          streak = 0;
          message = lives > 0
            ? "Wrong. " + lives + (lives === 1 ? " life left." : " lives left.")
            : "Wrong. No lives left.";
        }

        var ending = lives <= 0;
        render();

        ctx.scope.after(function () {
          current = drawn;
          next = null;
          revealed = false;

          if (deck.length < 6) deck = makeDeck();

          if (ending) {
            finish();
          } else {
            render();
          }
        }, 900);
      }

      lowerButton.addEventListener("click", function () { guess(false); });
      higherButton.addEventListener("click", function () { guess(true); });

      reset();
    }
  });

  // ---------------------------------------------------------------------------
  // Dice Roller
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "dice",
    title: "Dice Roller",
    tagline: "Predict the roll. Risk the chips.",
    icon: "dice",
    category: "luck",
    color: "#ff6b6b",
    glow: "rgba(239, 68, 68, 0.4)",
    bestKey: "best.dice",
    bestSuffix: " chips",
    mount: function (ctx) {
      var diceCount = ctx.difficulty === "brutal" ? 3 : 2;
      var minSum = diceCount + 1;
      var maxSum = diceCount * 6;
      var bet = 10;

      var chips = LF.get("dice.chips", 100);
      var best = LF.get("best.dice", 0);
      var targetSum = diceCount === 3 ? 10 : 7;
      var dice = [];
      var isRolling = false;
      var streak = 0;
      var message = "Pick a total, then roll.";

      for (var index = 0; index < diceCount; index += 1) dice.push(1);

      var options = [];
      for (var sum = minSum; sum <= maxSum; sum += 1) {
        options.push('<option value="' + sum + '"' + (sum === targetSum ? " selected" : "") + ">" + sum + "</option>");
      }

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Chips", value: String(chips), tone: "tone-red", id: "dice-chips" },
          { label: "Target", value: String(targetSum), tone: "tone-orange", id: "dice-target" },
          { label: "Streak", value: "0", tone: "tone-green", id: "dice-streak" },
          { label: "Best", value: String(best), tone: "tone-purple", id: "dice-best" }
        ]) +
          '<div class="dice-row" id="dice-row"></div>' +
          '<div class="message-bar" id="dice-message"></div>' +
          '<div class="select-field">' + icon("target", "") +
          '<span>Target total</span>' +
          '<select id="dice-target-select" aria-label="Target total">' + options.join("") + "</select>" +
          "</div>" +
          '<div class="action-row"><button type="button" class="primary-btn" id="dice-roll">' + icon("dice") + "<span>Roll · " + bet + " chips</span></button></div>" +
          '<div class="split-hint"><span>Exact total pays ' + (diceCount === 3 ? "15x" : "6x") + " your bet.</span><span>Off by one returns your bet.</span></div>" +
          '<div class="action-row"><button type="button" class="ghost-btn" id="dice-reset">' + icon("refresh") + "<span>Reset chips to 100</span></button></div>"
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var diceRow = document.getElementById("dice-row");
      var messageBar = document.getElementById("dice-message");
      var targetSelect = document.getElementById("dice-target-select");
      var rollButton = document.getElementById("dice-roll");
      var resetButton = document.getElementById("dice-reset");

      var dotGrid = "";
      for (var dot = 1; dot <= 9; dot += 1) {
        dotGrid += '<span class="die-dot d' + dot + '"></span>';
      }

      var dieNames = ["", "one", "two", "three", "four", "five", "six"];

      function renderDice() {
        diceRow.innerHTML = dice
          .map(function (value) {
            return '<div class="die ' + dieNames[value] + '">' + dotGrid + "</div>";
          })
          .join("");
      }

      function update() {
        setText("dice-chips", String(chips));
        setText("dice-target", String(targetSum));
        setText("dice-streak", String(streak));
        setText("dice-best", String(best));

        messageBar.innerHTML = icon("info") + "<span>" + message + "</span>";

        targetSelect.disabled = isRolling;
        rollButton.disabled = isRolling || chips < bet;
        resetButton.disabled = isRolling;
        renderDice();
      }

      function finishRoll() {
        var total = dice.reduce(function (sumSoFar, value) { return sumSoFar + value; }, 0);
        var difference = Math.abs(total - targetSum);

        if (difference === 0) {
          var payout = bet * (diceCount === 3 ? 15 : 6);
          chips += payout;
          streak += 1;
          message = "Exact " + total + ". +" + payout + " chips.";
        } else if (difference === 1) {
          chips += bet;
          streak = 0;
          message = "Off by one (" + total + "). Bet returned.";
        } else {
          streak = 0;
          message = "Rolled " + total + ". Target was " + targetSum + ".";
        }

        best = Math.max(best, chips);
        LF.set("dice.chips", chips);
        LF.set("best.dice", best);
        isRolling = false;
        update();

        if (chips < bet) {
          ctx.scope.after(showBroke, 220);
        }
      }

      function animateRoll(remaining) {
        if (remaining <= 0) {
          finishRoll();
          return;
        }

        dice = dice.map(function () { return 1 + Math.floor(Math.random() * 6); });
        renderDice();

        ctx.scope.after(function () { animateRoll(remaining - 1); }, 80);
      }

      function roll() {
        if (isRolling || chips < bet) return;

        chips -= bet;
        isRolling = true;
        streak = 0;
        message = "Rolling…";
        LF.set("dice.chips", chips);
        update();
        animateRoll(9);
      }

      function resetChips() {
        chips = 100;
        streak = 0;
        message = "Chips topped up.";
        LF.set("dice.chips", chips);
        update();
      }

      function showBroke() {
        LF.showResult({
          icon: "credit-card",
          title: "Out of chips",
          text: "The house always wins. Best stack: " + best + ".",
          color: "#ef4444",
          primaryLabel: "Reset to 100",
          onPrimary: resetChips,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      targetSelect.addEventListener("change", function () {
        targetSum = Number(targetSelect.value);
        message = "Target set to " + targetSum + ".";
        update();
      });

      rollButton.addEventListener("click", roll);
      resetButton.addEventListener("click", resetChips);

      update();

      if (chips < bet) {
        ctx.scope.after(showBroke, 260);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Coin Flip
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "coinFlip",
    title: "Coin Flip",
    tagline: "Pick a side. Build a streak.",
    icon: "coin",
    category: "luck",
    color: "#d1a06a",
    glow: "rgba(180, 83, 9, 0.44)",
    bestKey: "best.coinFlip",
    bestSuffix: " streak",
    mount: function (ctx) {
      var sides = {
        heads: { title: "Heads", icon: "crown", opposite: "tails", tint: "#f59e0b" },
        tails: { title: "Tails", icon: "moon", opposite: "heads", tint: "#6366f1" }
      };
      var maxLives = ctx.difficulty === "chill" ? 5 : ctx.difficulty === "brutal" ? 1 : 3;

      var best = LF.get("best.coinFlip", 0);
      var score = LF.get("coin.score", 0);
      var pick = "heads";
      var result = null;
      var streak = 0;
      var lives = maxLives;
      var flipping = false;
      var history = [];
      var message = "Pick a side and flip.";

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Lives", value: String(lives), tone: "tone-red", id: "coin-lives" },
          { label: "Streak", value: "0", tone: "tone-orange", id: "coin-streak" },
          { label: "Best", value: String(best), tone: "tone-purple", id: "coin-best" },
          { label: "Score", value: String(score), tone: "tone-green", id: "coin-score" }
        ]) +
          '<div class="coin-stage">' +
          '<div class="coin" id="coin"><span class="coin-face" id="coin-face"></span></div>' +
          '<div class="choice-row" id="coin-choices">' +
          '<button type="button" class="choice-btn active" data-side="heads">' + icon("crown") + "<span>Heads</span></button>" +
          '<button type="button" class="choice-btn" data-side="tails">' + icon("moon") + "<span>Tails</span></button>" +
          "</div>" +
          '<div class="action-row"><button type="button" class="primary-btn" id="coin-flip">' + icon("refresh") + "<span>Flip</span></button></div>" +
          '<div class="message-bar" id="coin-message"></div>' +
          '<div class="history-dots" id="coin-history"></div>' +
          "</div>" +
          '<p class="hint">Three correct flips in a row doubles the pressure. One wrong flip costs a life.</p>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var coin = document.getElementById("coin");
      var face = document.getElementById("coin-face");
      var choices = document.getElementById("coin-choices");
      var flipButton = document.getElementById("coin-flip");
      var messageBar = document.getElementById("coin-message");
      var historyRow = document.getElementById("coin-history");

      function update() {
        var shown = result || pick;
        face.innerHTML = icon(sides[shown].icon) + "<span>" + sides[shown].title + "</span>";
        face.style.color = "#fff7d6";

        setText("coin-lives", String(Math.max(0, lives)));
        setText("coin-streak", String(streak));
        setText("coin-best", String(best));
        setText("coin-score", String(score));

        choices.querySelectorAll("[data-side]").forEach(function (button) {
          button.classList.toggle("active", button.getAttribute("data-side") === pick);
          button.disabled = flipping;
        });

        flipButton.disabled = flipping || lives <= 0;
        flipButton.innerHTML = icon("refresh") + "<span>" + (flipping ? "Flipping…" : "Flip") + "</span>";

        messageBar.innerHTML =
          icon(result === null ? "help" : result === pick ? "check" : "x") +
          "<span>" + message + "</span>";

        historyRow.innerHTML = history
          .map(function (side) {
            return '<span class="history-dot ' + side + '" style="color:' + sides[side].tint + '">' + icon(sides[side].icon) + "</span>";
          })
          .join("");
      }

      function finish() {
        best = Math.max(best, streak);
        LF.set("best.coinFlip", best);
        LF.set("coin.score", score);

        LF.showResult({
          icon: "coin",
          title: "Out of lives",
          text: "Score " + score + " · best streak " + best,
          color: "#d1a06a",
          primaryLabel: "Flip again",
          onPrimary: reset,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function flip() {
        if (flipping || lives <= 0) return;

        flipping = true;
        result = null;
        message = "In the air…";
        coin.classList.add("flip");
        update();

        ctx.scope.after(function () {
          var outcome = Math.random() < 0.5 ? pick : sides[pick].opposite;
          result = outcome;
          history.unshift(outcome);
          if (history.length > 14) history.pop();

          if (outcome === pick) {
            streak += 1;
            best = Math.max(best, streak);
            var points = 10 * streak;
            score += points;
            message = sides[outcome].title + ". +" + points + " · streak " + streak + ".";
          } else {
            streak = 0;
            lives -= 1;
            message = lives > 0
              ? sides[outcome].title + ". " + lives + (lives === 1 ? " life left." : " lives left.")
              : sides[outcome].title + ". No lives left.";
          }

          flipping = false;
          coin.classList.remove("flip");
          LF.set("best.coinFlip", best);
          LF.set("coin.score", score);
          update();

          if (lives <= 0) {
            ctx.scope.after(finish, 240);
          }
        }, 900);
      }

      function reset() {
        lives = maxLives;
        streak = 0;
        score = 0;
        history = [];
        result = null;
        pick = "heads";
        flipping = false;
        coin.classList.remove("flip");
        message = "Pick a side and flip.";
        LF.set("coin.score", 0);
        update();
      }

      choices.addEventListener("click", function (event) {
        var button = event.target.closest("[data-side]");
        if (!button || flipping) return;
        pick = button.getAttribute("data-side");
        result = null;
        update();
      });

      flipButton.addEventListener("click", flip);

      update();
    }
  });
})();
