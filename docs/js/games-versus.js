/* LessFun versus game: Rock Paper Scissors. */
(function () {
  "use strict";

  var icon = LF.icon;
  var stats = LF.stats;
  var difficultyBar = LF.difficultyBar;

  LF.registerGame({
    id: "rps",
    title: "Rock Paper Scissors",
    tagline: "First to three. Settle it.",
    icon: "scissors",
    category: "versus",
    color: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.4)",
    bestKey: "rps.seriesWins",
    bestSuffix: " W",
    mount: function (ctx) {
      var moves = {
        rock: { title: "Rock", icon: "hand", color: "#f97316", beats: "scissors" },
        paper: { title: "Paper", icon: "paper", color: "#4d9bff", beats: "rock" },
        scissors: { title: "Scissors", icon: "scissors", color: "#22d3ee", beats: "paper" }
      };
      var order = ["rock", "paper", "scissors"];
      var counter = { rock: "paper", paper: "scissors", scissors: "rock" };
      var targetWins = 3;
      var counterChance = ctx.difficulty === "chill" ? 0 : ctx.difficulty === "brutal" ? 0.6 : 0.35;

      var seriesWins = LF.get("rps.seriesWins", 0);
      var playerMove = null;
      var aiMove = null;
      var playerScore = 0;
      var aiScore = 0;
      var lastPlayerMove = null;
      var history = [];
      var matchOver = false;
      var settling = false;
      var lastOutcome = null;
      var message = "Pick your weapon.";

      function setText(id, value) {
        var node = document.getElementById(id);
        if (node) node.textContent = value;
      }

      function outcomeMeta(outcome) {
        if (outcome === "win") return { icon: "check", color: "#22c55e" };
        if (outcome === "lose") return { icon: "x", color: "#ef4444" };
        return { icon: "equal", color: "inherit" };
      }

      ctx.root.innerHTML =
        difficultyBar(ctx.difficulty) +
        stats([
          { label: "You", value: "0", tone: "tone-teal", id: "rps-you" },
          { label: "Robot", value: "0", tone: "tone-pink", id: "rps-robot" },
          { label: "Series", value: String(seriesWins), tone: "tone-purple", id: "rps-series" }
        ]) +
        '<div class="rps-arena">' +
        '<div class="rps-side"><div class="rps-orb" id="rps-player-orb"></div><span class="hint">You</span></div>' +
        '<span class="rps-vs">VS</span>' +
        '<div class="rps-side"><div class="rps-orb ai" id="rps-ai-orb"></div><span class="hint">Robot</span></div>' +
        "</div>" +
        '<div class="message-bar" id="rps-message"></div>' +
        '<div class="rps-options" id="rps-options">' +
        order
          .map(function (move) {
            return (
              '<button type="button" class="rps-btn ' + move + '" data-move="' + move + '">' +
              '<span style="color:' + moves[move].color + '">' + icon(moves[move].icon) + "</span>" +
              "<span>" + moves[move].title + "</span></button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="split-hint"><span>First to ' + targetWins + " wins the series</span><span>" +
        (ctx.difficulty === "brutal" ? "Reads your habits" : "Mostly random") +
        "</span></div>" +
        '<div class="history-strip" id="rps-history"></div>';

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var playerOrb = document.getElementById("rps-player-orb");
      var aiOrb = document.getElementById("rps-ai-orb");
      var messageBar = document.getElementById("rps-message");
      var options = document.getElementById("rps-options");
      var historyStrip = document.getElementById("rps-history");

      function orbMarkup(move) {
        if (!move) return icon("help");
        return '<span style="color:' + moves[move].color + '">' + icon(moves[move].icon) + "</span>";
      }

      function render() {
        setText("rps-you", String(playerScore));
        setText("rps-robot", String(aiScore));
        setText("rps-series", String(seriesWins));

        playerOrb.innerHTML = orbMarkup(playerMove);
        aiOrb.innerHTML = orbMarkup(aiMove);

        var meta = outcomeMeta(lastOutcome);
        messageBar.innerHTML =
          '<span style="color:' + meta.color + '">' + icon(meta.icon) + "</span><span>" + message + "</span>";

        var locked = matchOver || settling;
        options.querySelectorAll("[data-move]").forEach(function (button) {
          var move = button.getAttribute("data-move");
          button.classList.toggle("active", move === playerMove);
          button.disabled = locked;
        });

        historyStrip.innerHTML = history
          .map(function (entry) {
            var outcome = outcomeMeta(entry.outcome);
            return (
              '<span class="history-chip">' +
              '<span style="color:' + moves[entry.player].color + '">' + icon(moves[entry.player].icon) + "</span>" +
              '<span style="color:' + outcome.color + '">' + icon(outcome.icon) + "</span>" +
              '<span style="color:' + moves[entry.ai].color + '">' + icon(moves[entry.ai].icon) + "</span>" +
              "</span>"
            );
          })
          .join("");
      }

      function pickAI() {
        var random = order[Math.floor(Math.random() * order.length)];
        if (!lastPlayerMove) return random;
        return Math.random() < counterChance ? counter[lastPlayerMove] : random;
      }

      function finishMatch() {
        settling = false;
        matchOver = true;

        if (playerScore > aiScore) {
          seriesWins += 1;
          LF.set("rps.seriesWins", seriesWins);
        }

        render();

        LF.showResult({
          icon: playerScore > aiScore ? "trophy" : "cpu",
          title: playerScore > aiScore ? "Series won" : "Series lost",
          text: playerScore + "–" + aiScore + " · " + seriesWins + " series wins overall",
          color: playerScore > aiScore ? "#22d3ee" : "#ff6bb5",
          primaryLabel: "New match",
          onPrimary: reset,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function choose(move) {
        if (matchOver || settling) return;

        var ai = pickAI();
        var outcome;

        if (move === ai) {
          outcome = "draw";
        } else if (moves[move].beats === ai) {
          outcome = "win";
          playerScore += 1;
        } else {
          outcome = "lose";
          aiScore += 1;
        }

        lastPlayerMove = move;
        lastOutcome = outcome;
        history.unshift({ player: move, ai: ai, outcome: outcome });
        if (history.length > 12) history.pop();

        playerMove = move;
        aiMove = ai;

        if (outcome === "win") {
          message = moves[move].title + " beats " + moves[ai].title + ".";
        } else if (outcome === "lose") {
          message = moves[ai].title + " beats " + moves[move].title + ".";
        } else {
          message = "Both picked " + moves[move].title + ".";
        }

        if (playerScore >= targetWins || aiScore >= targetWins) {
          settling = true;
          render();
          ctx.scope.after(finishMatch, 600);
          return;
        }

        render();
      }

      function reset() {
        playerMove = null;
        aiMove = null;
        playerScore = 0;
        aiScore = 0;
        lastPlayerMove = null;
        history = [];
        matchOver = false;
        settling = false;
        lastOutcome = null;
        message = "Pick your weapon.";
        render();
      }

      options.addEventListener("click", function (event) {
        var button = event.target.closest("[data-move]");
        if (!button) return;
        choose(button.getAttribute("data-move"));
      });

      render();
    }
  });
})();
