/* LessFun app shell: home, routing, modal, and boot. */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const siteHeader = document.getElementById("site-header");
  const modalRoot = document.getElementById("modal-root");

  let homeFilter = "all";
  let activeCleanup = null;
  const difficultyByGame = {};

  const CATEGORY_ORDER = ["all", "arcade", "puzzle", "luck", "versus"];
  const CATEGORY_META = {
    all: { title: "All", icon: "grid" },
    arcade: { title: "Arcade", icon: "zap" },
    puzzle: { title: "Puzzle", icon: "puzzle" },
    luck: { title: "Luck", icon: "dice" },
    versus: { title: "Versus", icon: "hand" }
  };

  function bestFor(game) {
    return LF.get(game.bestKey, 0);
  }

  function filteredGames() {
    if (homeFilter === "all") return LF.games.slice();
    return LF.games.filter(function (game) {
      return game.category === homeFilter;
    });
  }

  function renderHome() {
    closeModal();
    siteHeader.hidden = false;
    const games = filteredGames();

    const chips = CATEGORY_ORDER.map(function (id) {
      const meta = CATEGORY_META[id];
      return (
        '<button type="button" class="cat-btn ' + (homeFilter === id ? "active" : "") +
        '" data-cat="' + id + '">' + LF.icon(meta.icon) + "<span>" + meta.title + "</span></button>"
      );
    }).join("");

    const cards = games
      .map(function (game, index) {
        const best = bestFor(game);
        const bestPill = best > 0
          ? '<span class="pill pill-strong">Best ' + best + (game.bestSuffix || "") + "</span>"
          : "";

        return (
          '<button type="button" class="game-card" data-game="' + game.id +
          '" style="--card-glow:' + game.glow + ";--i:" + index + '">' +
          '<span class="card-top">' +
          '<span class="card-icon" style="color:' + game.color + '">' + LF.icon(game.icon) + "</span>" +
          '<span class="card-badges">' + bestPill + "</span>" +
          "</span>" +
          '<span class="card-body">' +
          '<span class="card-title">' + game.title + "</span>" +
          '<span class="card-subtitle">' + game.tagline + "</span>" +
          "</span>" +
          '<span class="card-foot">' +
          "<span>" + CATEGORY_META[game.category].title + "</span>" +
          LF.icon("chevron-right", "card-arrow") +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    view.innerHTML =
      '<section class="home-grid">' +
      '<div class="category-bar" role="group" aria-label="Game categories">' + chips + "</div>" +
      cards +
      '<button type="button" class="surprise" id="surprise">' +
      '<span class="surprise-left">' + LF.icon("shuffle") + "<span>Surprise me</span></span>" +
      LF.icon("arrow-right") +
      "</button>" +
      "</section>";

    view.querySelectorAll("[data-cat]").forEach(function (button) {
      button.addEventListener("click", function () {
        homeFilter = button.getAttribute("data-cat");
        renderHome();
      });
    });

    view.querySelectorAll("[data-game]").forEach(function (button) {
      button.addEventListener("click", function () {
        navigate(button.getAttribute("data-game"));
      });
    });

    const surprise = document.getElementById("surprise");
    if (surprise) {
      surprise.addEventListener("click", function () {
        const pool = games.length ? games : LF.games;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) navigate(pick.id);
      });
    }

    window.scrollTo(0, 0);
  }

  function renderGame(game) {
    siteHeader.hidden = true;
    const difficulty = difficultyByGame[game.id] || "normal";

    view.innerHTML =
      '<section class="game-screen">' +
      '<div class="toolbar">' +
      '<button type="button" class="back-link" data-back>' + LF.icon("arrow-left") + "<span>All games</span></button>" +
      '<span class="badge">' + LF.icon(game.icon) + "<span>" + game.category + "</span></span>" +
      "</div>" +
      '<div class="panel" style="--panel-glow:' + game.glow + '">' +
      '<div class="panel-head">' +
      '<div class="panel-title-row">' +
      '<div class="panel-title-group">' +
      '<span class="panel-icon" style="color:' + game.color + '">' + LF.icon(game.icon) + "</span>" +
      '<div class="panel-heading"><h2 class="panel-title">' + game.title + "</h2>" +
      '<p class="panel-subtitle">' + game.tagline + "</p></div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="game-body" id="game-body"></div>' +
      "</div>" +
      "</section>";

    view.querySelector("[data-back]").addEventListener("click", function () {
      navigate("");
    });

    const body = document.getElementById("game-body");
    const scope = LF.createScope();
    activeCleanup = function () {
      scope.clear();
    };

    game.mount({
      root: body,
      scope: scope,
      difficulty: difficulty,
      setDifficulty: function (next) {
        difficultyByGame[game.id] = next;
        renderGame(game);
      }
    });
  }

  function route() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    closeModal();

    const id = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
    const game = LF.games.find(function (item) {
      return item.id === id;
    });

    if (game) {
      renderGame(game);
    } else {
      renderHome();
    }
  }

  function navigate(id) {
    const target = id ? "#" + id : "";
    if (window.location.hash === target || (!window.location.hash && !id)) {
      route();
      return;
    }
    if (id) {
      window.location.hash = id;
    } else {
      window.location.hash = "";
    }
  }

  function closeModal() {
    modalRoot.classList.remove("active");
    modalRoot.innerHTML = "";
  }

  function showResult(options) {
    const tone = options.tone || "purple";
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-modal-close></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<button type="button" class="modal-close" aria-label="Close" data-modal-close>' + LF.icon("x") + "</button>" +
      '<div class="modal-icon" style="color:' + (options.color || "var(--text-primary)") + '">' + LF.icon(options.icon || "sparkles") + "</div>" +
      '<h2 class="modal-title" id="modal-title">' + options.title + "</h2>" +
      '<p class="modal-subtitle">' + (options.text || "") + "</p>" +
      '<div class="modal-actions">' +
      '<button type="button" class="primary-btn" data-modal-primary>' + (options.primaryLabel || "Play again") + "</button>" +
      (options.secondaryLabel ? '<button type="button" class="ghost-btn" data-modal-secondary>' + options.secondaryLabel + "</button>" : "") +
      "</div>" +
      "</div>";

    modalRoot.classList.add("active");

    modalRoot.querySelectorAll("[data-modal-close]").forEach(function (node) {
      node.addEventListener("click", closeModal);
    });

    const primary = modalRoot.querySelector("[data-modal-primary]");
    if (primary) {
      primary.addEventListener("click", function () {
        closeModal();
        if (typeof options.onPrimary === "function") options.onPrimary();
      });
    }

    const secondary = modalRoot.querySelector("[data-modal-secondary]");
    if (secondary) {
      secondary.addEventListener("click", function () {
        closeModal();
        if (typeof options.onSecondary === "function") options.onSecondary();
      });
    }

    void tone;
  }

  LF.showResult = showResult;
  LF.closeModal = closeModal;
  LF.navigate = navigate;

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  window.addEventListener("hashchange", route);
  route();
})();
