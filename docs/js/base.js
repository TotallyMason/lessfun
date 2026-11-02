/* LessFun shared helpers, icons, and game registry. */
(function () {
  "use strict";

  const ICONS = {
    "hand-tap": '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 12v-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4.5 14a1.6 1.6 0 0 1 2.4-2.1L8 13"/>',
    brain: '<path d="M9.5 4A2.5 2.5 0 0 0 7 7v.2A2.6 2.6 0 0 0 5 9.7c0 .8.3 1.5.9 2a2.6 2.6 0 0 0 .1 4.1A2.5 2.5 0 0 0 9.5 20V4Z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 7v.2a2.6 2.6 0 0 1 2 2.5c0 .8-.3 1.5-.9 2a2.6 2.6 0 0 1-.1 4.1A2.5 2.5 0 0 1 14.5 20V4Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    hammer: '<path d="m13.5 6.5 4-4 4 4-4 4"/><path d="M17.5 6.5 8 16"/><path d="m5 14 5 5-2.5 2.5a2.1 2.1 0 0 1-3-3L5 14Z"/>',
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    spade: '<path fill="currentColor" stroke="none" d="M12 2.8C9 8 4 9.4 4 13.8A4 4 0 0 0 11 16.4L10 21h4l-1-4.6a4 4 0 0 0 7-2.6c0-4.4-5-5.8-8-11Z"/>',
    heart: '<path fill="currentColor" stroke="none" d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/>',
    diamond: '<path fill="currentColor" stroke="none" d="M12 2 21 12l-9 10L3 12 12 2Z"/>',
    club: '<path fill="currentColor" stroke="none" d="M12 3a4 4 0 0 1 2.5 7.1A4 4 0 1 1 13 17l.9 4h-3.8l.9-4a4 4 0 1 1-1.5-6.9A4 4 0 0 1 12 3Z"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.8 20 20M8.2 16.2 20 4"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>',
    coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "arrow-left": '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    "arrow-up": '<path d="M12 19V5M5 12l7-7 7 7"/>',
    "arrow-down": '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    star: '<path fill="currentColor" stroke="none" d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9L12 2.8Z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    delete: '<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m12 9 6 6M18 9l-6 6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
    crown: '<path fill="currentColor" stroke="none" d="M3 7.5 7.5 11 12 5l4.5 6L21 7.5 19 19H5L3 7.5Z"/><path d="M5 22h14"/>',
    moon: '<path fill="currentColor" stroke="none" d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5.3-4-7.5-.7 2.3-2 3.5-3.5 4.5C11 9 11 6 9 3c0 3-4 5.5-4 9.5C5 19 8 22 12 22Z"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s7-1 11-5c3-3 4-7 4-11Z"/><path d="M4 20C8 14 12 10 18 7"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    cloud: '<path d="M17.5 19H7a4 4 0 0 1-.7-7.9A5.5 5.5 0 0 1 17 9.5a4.75 4.75 0 0 1 .5 9.5Z"/>',
    snowflake: '<path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M8 4l4 3 4-3M8 20l4-3 4 3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.3-1.5 2.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    paw: '<circle cx="6" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M12 11c-3 0-5 2.5-5 5 0 2 1.7 3 3.2 3 .9 0 1.3-.5 1.8-.5s.9.5 1.8.5c1.5 0 3.2-1 3.2-3 0-2.5-2-5-5-5Z"/>',
    bomb: '<circle cx="11" cy="13" r="7"/><path d="m16 8 3-3M19 3v3h3"/>',
    paper: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v5h4M9 12h6M9 16h6"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 12v-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4.5 14a1.6 1.6 0 0 1 2.4-2.1L8 13"/>',
    equal: '<path d="M5 9h14M5 15h14"/>',
    "credit-card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2 2.2.8-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    play: '<path fill="currentColor" stroke="none" d="M8 5.5v13l11-6.5L8 5.5Z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    flag: '<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>',
    puzzle: '<path d="M9 3a2 2 0 0 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v1a2 2 0 0 1-4 0v-1H6a1 1 0 0 1-1-1v-3H4a2 2 0 0 1 0-4h1V5a1 1 0 0 1 1-1h3V3Z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
    "trend-up": '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>'
  };

  function icon(name, className) {
    const body = ICONS[name] || ICONS.help;
    return (
      '<svg class="icon ' +
      (className || "") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body +
      "</svg>"
    );
  }

  const STORE_PREFIX = "lessfun.";

  function get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(STORE_PREFIX + key);
      if (raw === null) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      window.localStorage.setItem(STORE_PREFIX + key, String(value));
    } catch (error) {
      /* Private mode: keep playing without persistence. */
    }
  }

  function fmtClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function createScope() {
    const timers = new Set();
    const intervals = new Set();

    return {
      after(fn, ms) {
        const id = window.setTimeout(function () {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
        return id;
      },
      every(fn, ms) {
        const id = window.setInterval(fn, ms);
        intervals.add(id);
        return id;
      },
      clear() {
        timers.forEach(function (id) { window.clearTimeout(id); });
        intervals.forEach(function (id) { window.clearInterval(id); });
        timers.clear();
        intervals.clear();
      }
    };
  }

  function stats(items) {
    return (
      '<div class="stat-grid">' +
      items
        .map(function (item) {
          return (
            '<div class="stat">' +
            "<span>" + item.label + "</span>" +
            '<strong class="' + (item.tone || "") + '"' + (item.id ? ' id="' + item.id + '"' : "") + ">" +
            item.value +
            "</strong></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function difficultyBar(selected) {
    const levels = [
      { id: "chill", label: "Chill", icon: "leaf" },
      { id: "normal", label: "Normal", icon: "flame" },
      { id: "brutal", label: "Brutal", icon: "zap" }
    ];

    return (
      '<div class="segmented" role="group" aria-label="Difficulty">' +
      levels
        .map(function (level) {
          return (
            '<button type="button" class="seg-btn ' + level.id + (selected === level.id ? " active" : "") +
            '" data-diff="' + level.id + '">' + icon(level.icon) + "<span>" + level.label + "</span></button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function bindDifficulty(root, onChange) {
    root.querySelectorAll("[data-diff]").forEach(function (button) {
      button.addEventListener("click", function () {
        onChange(button.getAttribute("data-diff"));
      });
    });
  }

  function progress(value, tone, id) {
    const percent = Math.max(0, Math.min(1, value)) * 100;
    return (
      '<div class="progress ' + (tone || "") + '"' + (id ? ' id="' + id + '"' : "") + ">" +
      '<span style="width:' + percent + '%"></span></div>'
    );
  }

  window.LF = {
    icon: icon,
    get: get,
    set: set,
    fmtClock: fmtClock,
    createScope: createScope,
    stats: stats,
    difficultyBar: difficultyBar,
    bindDifficulty: bindDifficulty,
    progress: progress,
    games: [],
    registerGame: function (game) {
      window.LF.games.push(game);
    }
  };
})();
