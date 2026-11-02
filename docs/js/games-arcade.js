/* LessFun arcade games: Tap Frenzy, Whack-a-Mole, Reaction Test. */
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

  function setProgress(node, value) {
    if (!node) return;
    var fill = node.querySelector("span");
    if (fill) fill.style.width = Math.max(0, Math.min(1, value)) * 100 + "%";
  }

  // ---------------------------------------------------------------------------
  // Tap Frenzy
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "tapFrenzy",
    title: "Tap Frenzy",
    tagline: "Ten seconds. Maximum chaos.",
    icon: "hand-tap",
    category: "arcade",
    color: "#ff9f4a",
    glow: "rgba(255, 122, 42, 0.45)",
    bestKey: "best.tapFrenzy",
    bestSuffix: " pts",
    mount: function (ctx) {
      var duration = ctx.difficulty === "chill" ? 15 : ctx.difficulty === "brutal" ? 6 : 10;
      var best = LF.get("best.tapFrenzy", 0);
      var score = 0;
      var combo = 0;
      var bestCombo = 0;
      var timeLeft = duration;
      var running = false;
      var over = false;
      var lastTap = 0;

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Score", value: "0", tone: "tone-orange", id: "tap-score" },
          { label: "Combo", value: "—", tone: "tone-pink", id: "tap-combo" },
          { label: "Time", value: duration.toFixed(1) + "s", tone: "tone-red", id: "tap-time" },
          { label: "Best", value: String(best), tone: "tone-purple", id: "tap-best" }
        ]) +
          LF.progress(1, "tone-orange", "tap-progress") +
          '<div class="stage">' +
          '<div class="ripple-host" id="tap-host">' +
          '<button type="button" class="big-button" id="tap-pad" aria-label="Tap to play">' +
          icon("hand-tap") +
          '<span class="big-button-text" id="tap-label">Start</span>' +
          "</button>" +
          "</div>" +
          "</div>" +
          '<p class="hint">Tap fast to build a combo. Every five taps raises the multiplier.</p>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var progress = document.querySelector(".progress");
      var progressFill = progress ? progress.querySelector("span") : null;
      var host = document.getElementById("tap-host");
      var pad = document.getElementById("tap-pad");
      var label = document.getElementById("tap-label");

      function update() {
        setText("tap-score", String(score));
        setText("tap-combo", combo > 1 ? "x" + combo : "—");
        setText("tap-time", Math.max(0, timeLeft).toFixed(1) + "s");
        setText("tap-best", String(best));
        if (progressFill) {
          progressFill.style.width = Math.max(0, Math.min(1, timeLeft / duration)) * 100 + "%";
        }
      }

      function ripple() {
        var ring = document.createElement("span");
        ring.className = "ripple";
        host.appendChild(ring);
        ctx.scope.after(function () {
          if (ring.parentNode) ring.parentNode.removeChild(ring);
        }, 700);
      }

      function restart() {
        score = 0;
        combo = 0;
        bestCombo = 0;
        timeLeft = duration;
        running = false;
        over = false;
        lastTap = 0;
        label.textContent = "Start";
        update();
      }

      function finish() {
        running = false;
        over = true;
        best = Math.max(best, score);
        LF.set("best.tapFrenzy", best);
        update();
        LF.showResult({
          icon: "timer",
          title: "Time's up",
          text: score + " points · best combo x" + bestCombo,
          color: "#ff9f4a",
          primaryLabel: "Play again",
          onPrimary: restart,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      function tap() {
        if (over) {
          restart();
          return;
        }

        if (!running) {
          score = 0;
          combo = 0;
          bestCombo = 0;
          timeLeft = duration;
          running = true;
          lastTap = 0;
          label.textContent = "Tap";
          update();
          return;
        }

        var now = Date.now();
        if (now - lastTap < 450) {
          combo += 1;
        } else {
          combo = 1;
        }
        lastTap = now;
        bestCombo = Math.max(bestCombo, combo);

        var multiplier = Math.floor(combo / 5) + 1;
        score += multiplier;

        pad.classList.add("pressed");
        ctx.scope.after(function () { pad.classList.remove("pressed"); }, 120);
        ripple();
        update();
      }

      pad.addEventListener("click", tap);

      ctx.scope.every(function () {
        if (!running) return;
        timeLeft = Math.max(0, timeLeft - 0.05);
        if (timeLeft <= 0.001) {
          timeLeft = 0;
          update();
          finish();
        } else {
          update();
        }
      }, 50);

      update();
    }
  });

  // ---------------------------------------------------------------------------
  // Whack-a-Mole
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "whack",
    title: "Whack-a-Mole",
    tagline: "Moles, gold, and bombs.",
    icon: "hammer",
    category: "arcade",
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.4)",
    bestKey: "best.whack",
    bestSuffix: " pts",
    mount: function (ctx) {
      var duration = ctx.difficulty === "chill" ? 22 : ctx.difficulty === "brutal" ? 14 : 18;
      var spawnInterval = ctx.difficulty === "chill" ? 0.95 : ctx.difficulty === "brutal" ? 0.5 : 0.72;
      var bombChance = ctx.difficulty === "chill" ? 0.06 : ctx.difficulty === "brutal" ? 0.26 : 0.16;

      var best = LF.get("best.whack", 0);
      var score = 0;
      var combo = 0;
      var timeLeft = duration;
      var spawnCountdown = 0;
      var running = false;
      var over = false;
      var activeIndex = null;
      var activeKind = null;

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Score", value: "0", tone: "tone-green", id: "whack-score" },
          { label: "Combo", value: "—", tone: "tone-orange", id: "whack-combo" },
          { label: "Time", value: duration.toFixed(1) + "s", tone: "tone-red", id: "whack-time" },
          { label: "Best", value: String(best), tone: "tone-purple", id: "whack-best" }
        ]) +
          LF.progress(1, "tone-green", "whack-progress") +
          '<div class="mole-grid" id="mole-grid"></div>' +
          '<div class="action-row"><button type="button" class="primary-btn" id="whack-start">' + icon("play") + "<span>Start</span></button></div>" +
          '<div class="legend-row">' +
          '<span class="legend" style="color:#22c55e">' + icon("paw") + "1 pt</span>" +
          '<span class="legend" style="color:#f59e0b">' + icon("star") + "3x gold</span>" +
          '<span class="legend" style="color:#ef4444">' + icon("bomb") + "-2s bomb</span>" +
          "</div>" +
          '<p class="hint">Chain hits for bonus points. Bombs cost time.</p>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var grid = document.getElementById("mole-grid");
      var startButton = document.getElementById("whack-start");
      var progress = document.querySelector(".progress");

      var holes = [];
      for (var i = 0; i < 9; i += 1) {
        var hole = document.createElement("button");
        hole.type = "button";
        hole.className = "mole-hole";
        hole.setAttribute("data-index", String(i));
        hole.addEventListener("click", (function (index) {
          return function () { whack(index); };
        })(i));
        grid.appendChild(hole);
        holes.push(hole);
      }

      function kindMeta(kind) {
        if (kind === "gold") return { icon: "star", color: "#f59e0b", className: "gold" };
        if (kind === "bomb") return { icon: "bomb", color: "#ef4444", className: "bomb" };
        return { icon: "paw", color: "#22c55e", className: "" };
      }

      function renderHoles() {
        holes.forEach(function (hole, index) {
          if (index === activeIndex) {
            var meta = kindMeta(activeKind);
            hole.className = "mole-hole active " + meta.className;
            hole.innerHTML = '<span class="mole-symbol" style="color:' + meta.color + '">' + icon(meta.icon) + "</span>";
          } else {
            hole.className = "mole-hole";
            hole.innerHTML = "";
          }
        });
      }

      function update() {
        setText("whack-score", String(score));
        setText("whack-combo", combo > 0 ? "x" + combo : "—");
        setText("whack-time", Math.max(0, timeLeft).toFixed(1) + "s");
        setText("whack-best", String(best));
        setProgress(progress, timeLeft / duration);
      }

      function spawn() {
        var options = [];
        for (var index = 0; index < 9; index += 1) {
          if (index !== activeIndex) options.push(index);
        }
        var next = options[Math.floor(Math.random() * options.length)];
        var roll = Math.random();

        activeIndex = next;
        if (roll < bombChance) {
          activeKind = "bomb";
        } else if (roll < bombChance + 0.12) {
          activeKind = "gold";
        } else {
          activeKind = "mole";
        }

        renderHoles();
      }

      function whack(index) {
        if (!running || index !== activeIndex || !activeKind) return;

        if (activeKind === "mole") {
          combo += 1;
          score += 1 + Math.floor(combo / 4);
        } else if (activeKind === "gold") {
          combo += 1;
          score += (1 + Math.floor(combo / 4)) * 3;
        } else {
          combo = 0;
          score = Math.max(0, score - 3);
          timeLeft = Math.max(0, timeLeft - 2);
        }

        activeIndex = null;
        activeKind = null;
        spawnCountdown = 0.16;
        renderHoles();
        update();
      }

      function start() {
        score = 0;
        combo = 0;
        timeLeft = duration;
        spawnCountdown = 0;
        running = true;
        over = false;
        activeIndex = null;
        activeKind = null;
        startButton.disabled = true;
        startButton.innerHTML = icon("timer") + "<span>Whacking…</span>";
        renderHoles();
        update();
      }

      function finish() {
        running = false;
        over = true;
        activeIndex = null;
        activeKind = null;
        best = Math.max(best, score);
        LF.set("best.whack", best);
        startButton.disabled = false;
        startButton.innerHTML = icon("refresh") + "<span>Play again</span>";
        renderHoles();
        update();
        LF.showResult({
          icon: "hammer",
          title: "Time's up",
          text: score + " points · best " + best,
          color: "#22c55e",
          primaryLabel: "Play again",
          onPrimary: start,
          secondaryLabel: "All games",
          onSecondary: function () { LF.navigate(""); }
        });
      }

      startButton.addEventListener("click", start);

      ctx.scope.every(function () {
        if (!running) return;

        timeLeft = Math.max(0, timeLeft - 0.05);
        spawnCountdown -= 0.05;

        if (spawnCountdown <= 0) {
          spawn();
          spawnCountdown = spawnInterval;
        }

        if (timeLeft <= 0.001) {
          timeLeft = 0;
          update();
          finish();
          return;
        }

        update();
      }, 50);

      renderHoles();
      update();
    }
  });

  // ---------------------------------------------------------------------------
  // Reaction Test
  // ---------------------------------------------------------------------------

  LF.registerGame({
    id: "reaction",
    title: "Reaction Test",
    tagline: "How slow are your thumbs?",
    icon: "zap",
    category: "arcade",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.42)",
    bestKey: "best.reaction",
    bestSuffix: " ms",
    mount: function (ctx) {
      var totalRounds = 5;
      var best = LF.get("best.reaction", 0);
      var phase = "idle";
      var attempts = [];
      var readyAt = 0;
      var token = 0;

      ctx.root.innerHTML = screenMarkup(
        ctx.difficulty,
        stats([
          { label: "Last", value: "—", tone: "tone-yellow", id: "react-last" },
          { label: "Fastest", value: "—", tone: "tone-green", id: "react-fastest" },
          { label: "Average", value: "—", tone: "tone-orange", id: "react-average" },
          { label: "Round", value: "1/" + totalRounds, tone: "tone-blue", id: "react-round" }
        ]) +
          '<div class="reaction-panel">' +
          '<button type="button" class="reaction-zone idle" id="react-zone"></button>' +
          '<div class="bar-chart" id="react-chart" hidden></div>' +
          "</div>" +
          '<p class="hint">Tap when the screen turns green. False starts do not count.</p>'
      );

      LF.bindDifficulty(ctx.root, ctx.setDifficulty);

      var zone = document.getElementById("react-zone");
      var chart = document.getElementById("react-chart");

      function fastest() {
        if (!attempts.length) return 0;
        return attempts.reduce(function (min, value) { return Math.min(min, value); }, attempts[0]);
      }

      function average() {
        if (!attempts.length) return 0;
        return Math.round(attempts.reduce(function (sum, value) { return sum + value; }, 0) / attempts.length);
      }

      function update() {
        setText("react-last", attempts.length ? attempts[attempts.length - 1] + " ms" : "—");
        setText("react-fastest", fastest() ? fastest() + " ms" : "—");
        setText("react-average", average() ? average() + " ms" : "—");
        setText("react-round", Math.min(attempts.length + 1, totalRounds) + "/" + totalRounds);

        chart.hidden = attempts.length === 0;
        chart.innerHTML = attempts
          .map(function (value) {
            var ratio = fastest() > 0 ? fastest() / Math.max(value, 1) : 1;
            return '<span style="height:' + Math.max(10, Math.round(ratio * 100)) + '%"></span>';
          })
          .join("");
      }

      function renderZone() {
        zone.className = "reaction-zone " + phase;
        var body = "";

        if (phase === "waiting") {
          body =
            '<span class="pulse-ring"></span><span class="pulse-ring delay"></span>' +
            icon("timer") +
            '<span class="reaction-title">Wait for green</span>' +
            '<span class="reaction-subtitle">Tap only when it turns green.</span>';
        } else if (phase === "ready") {
          body =
            icon("hand-tap") +
            '<span class="reaction-title">TAP NOW</span>' +
            '<span class="reaction-subtitle">Go go go.</span>';
        } else if (phase === "tooSoon") {
          body =
            icon("zap") +
            '<span class="reaction-title">Too soon</span>' +
            '<span class="reaction-subtitle">Tap to try again. False starts do not count.</span>';
        } else if (phase === "done") {
          body =
            icon("check") +
            '<span class="reaction-title">' + attempts[attempts.length - 1] + " ms</span>" +
            '<span class="reaction-subtitle">Tap for round ' + (attempts.length + 1) + " of " + totalRounds + ".</span>";
        } else if (phase === "finished") {
          body = icon("flag") + '<span class="reaction-title">Done</span>';
        } else {
          body =
            icon("zap") +
            '<span class="reaction-title">Tap to start</span>' +
            '<span class="reaction-subtitle">Five rounds. Try not to blink.</span>';
        }

        zone.innerHTML = body;
      }

      function begin() {
        phase = "waiting";
        renderZone();

        var current = token + 1;
        token = current;

        var delay;
        if (ctx.difficulty === "chill") {
          delay = 1.6 + Math.random() * 2.0;
        } else if (ctx.difficulty === "brutal") {
          delay = 0.7 + Math.random() * 1.5;
        } else {
          delay = 1.1 + Math.random() * 1.9;
        }

        ctx.scope.after(function () {
          if (token !== current || phase !== "waiting") return;
          readyAt = performance.now();
          phase = "ready";
          renderZone();
        }, delay * 1000);
      }

      function finish() {
        phase = "finished";
        renderZone();
        update();

        var avg = average();
        var quick = fastest();

        ctx.scope.after(function () {
          LF.showResult({
            icon: "flag",
            title: "Five rounds done",
            text: "Average " + avg + " ms · fastest " + quick + " ms · best " + best + " ms",
            color: "#f59e0b",
            primaryLabel: "Run it back",
            onPrimary: reset,
            secondaryLabel: "All games",
            onSecondary: function () { LF.navigate(""); }
          });
        }, 260);
      }

      function reset() {
        attempts = [];
        phase = "idle";
        renderZone();
        update();
      }

      function handleTap() {
        if (phase === "waiting") {
          token += 1;
          phase = "tooSoon";
          renderZone();
          return;
        }

        if (phase === "ready") {
          var milliseconds = Math.max(1, Math.round(performance.now() - readyAt));
          attempts.push(milliseconds);
          best = best === 0 ? milliseconds : Math.min(best, milliseconds);
          LF.set("best.reaction", best);

          if (attempts.length >= totalRounds) {
            finish();
          } else {
            phase = "done";
            renderZone();
            update();
          }
          return;
        }

        if (phase === "idle" || phase === "tooSoon" || phase === "done") {
          begin();
        }
      }

      zone.addEventListener("click", handleTap);
      renderZone();
      update();
    }
  });
})();
