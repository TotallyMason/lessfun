/* LessFun — 2048 · slide tiles, merge numbers */
(function (global) {
    'use strict';

    var STYLE_ID = 'g2048Styles';
    var root = null;
    var container = null;
    var grid = null;           // 4x4 -> tile object or null
    var tiles = [];            // live tile objects
    var idSeq = 1;
    var score = 0;
    var best = 0;
    var over = false;
    var moving = false;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.g2048-wrap{position:absolute;inset:0;overflow:auto;background:linear-gradient(180deg,#1b1a24 0%,#232132 55%,#2b2a3d 100%);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;padding:18px;color:#f5efe2}
.g2048{width:min(88vw,460px)}
.g2048-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.g2048-title{font-size:clamp(26px,6vw,38px);font-weight:900;letter-spacing:-.05em;color:#f5efe2}
.g2048-title small{display:block;font-size:9px;font-weight:800;letter-spacing:.14em;color:rgba(245,239,226,.5);margin-top:3px}
.g2048-scores{display:flex;gap:8px}
.g2048-score{padding:7px 14px;border-radius:12px;background:rgba(245,239,226,.1);text-align:center;min-width:64px}
.g2048-score small{display:block;font-size:8px;font-weight:800;letter-spacing:.14em;color:rgba(245,239,226,.55)}
.g2048-score b{font-size:17px;letter-spacing:-.02em}
.g2048-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.g2048-hint{font-size:10.5px;color:rgba(245,239,226,.5);line-height:1.4}
.g2048-new{border:0;padding:9px 16px;border-radius:12px;background:#8f7a66;color:#f9f6f1;font:inherit;font-size:11px;font-weight:800;letter-spacing:.06em;cursor:pointer}
.g2048-new:hover{background:#9f8b77}
.g2048-board{position:relative;width:100%;aspect-ratio:1;border-radius:14px;background:rgba(143,122,102,.35);padding:calc(100% * .02);box-sizing:border-box}
.g2048-bg{position:absolute;inset:2%;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:2.4%}
.g2048-bg i{border-radius:10px;background:rgba(238,228,218,.18)}
.g2048-tiles{position:absolute;inset:2%}
.g2048-tile{position:absolute;width:23.2%;height:23.2%;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;letter-spacing:-.04em;transition:transform .17s cubic-bezier(.22,.9,.28,1);font-size:clamp(16px,4.6vw,30px);will-change:transform;backface-visibility:hidden}
.g2048-tile.is-new{animation:g2048Pop .26s cubic-bezier(.2,1.5,.45,1) .02s backwards}
.g2048-tile.is-merged{animation:g2048Merge .32s cubic-bezier(.2,1.6,.4,1);z-index:3}
@keyframes g2048Pop{0%{transform:var(--tf) scale(.2);opacity:.4}70%{transform:var(--tf) scale(1.06);opacity:1}100%{transform:var(--tf) scale(1)}}
@keyframes g2048Merge{0%{transform:var(--tf) scale(1)}38%{transform:var(--tf) scale(1.3)}68%{transform:var(--tf) scale(.94)}100%{transform:var(--tf) scale(1);box-shadow:0 0 0 rgba(255,235,180,0)}}
.g2048-board.is-bump{animation:g2048Bump .24s ease-out}
@keyframes g2048Bump{0%{transform:scale(1)}36%{transform:scale(1.008)}100%{transform:scale(1)}}
.g2048-score{position:relative;overflow:visible}
.g2048-delta{position:absolute;left:50%;top:-6px;transform:translate(-50%,0);font-size:12px;font-weight:900;color:#7ce7b3;pointer-events:none;animation:g2048Delta .65s ease-out forwards;text-shadow:0 1px 6px rgba(0,0,0,.35)}
@keyframes g2048Delta{0%{opacity:0;transform:translate(-50%,6px) scale(.8)}25%{opacity:1;transform:translate(-50%,-2px) scale(1.08)}100%{opacity:0;transform:translate(-50%,-26px) scale(1)}}
.g2048-over{position:absolute;inset:0;z-index:9;border-radius:14px;background:rgba(238,228,218,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;transition:opacity .35s}
.g2048-over.is-visible{opacity:1;pointer-events:auto}
.g2048-over strong{font-size:clamp(22px,5vw,34px);font-weight:900;color:#776e65;letter-spacing:-.04em}
.g2048-over button{border:0;padding:10px 18px;border-radius:12px;background:#8f7a66;color:#f9f6f1;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
`;
        document.head.appendChild(style);
    }

    function tileColor(v) {
        var map = {
            2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#f9f6f2'],
            16: ['#f59563', '#f9f6f2'], 32: ['#f67c5f', '#f9f6f2'], 64: ['#f65e3b', '#f9f6f2'],
            128: ['#edcf72', '#f9f6f2'], 256: ['#edcc61', '#f9f6f2'], 512: ['#edc850', '#f9f6f2'],
            1024: ['#edc53f', '#f9f6f2'], 2048: ['#edc22e', '#f9f6f2'], 4096: ['#3c3a32', '#f9f6f2']
        };
        return map[v] || ['#2f2b22', '#f9f6f2'];
    }

    function place(tile) {
        // tile = 23.2% of the board; one grid step = 25.6% of the board
        // translate() percentages are relative to the tile itself: 25.6 / 23.2 = 110.34%
        var x = tile.c * 110.34, y = tile.r * 110.34;
        tile.el.style.setProperty('--tf', 'translate(' + x + '%,' + y + '%)');
        tile.el.style.transform = 'translate(' + x + '%,' + y + '%)';
    }

    function spawnTile(r, c, v, isNew) {
        var el = document.createElement('div');
        el.className = 'g2048-tile' + (isNew ? ' is-new' : '');
        var colors = tileColor(v);
        el.style.background = colors[0];
        el.style.color = colors[1];
        if (v >= 1024) el.style.fontSize = 'clamp(12px,3.4vw,22px)';
        el.textContent = v;
        var t = { id: idSeq++, r: r, c: c, v: v, el: el };
        place(t);
        root.querySelector('.g2048-tiles').appendChild(el);
        tiles.push(t);
        grid[r][c] = t;
        return t;
    }

    function removeTile(t) {
        if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
        var i = tiles.indexOf(t);
        if (i >= 0) tiles.splice(i, 1);
    }

    function emptyCells() {
        var out = [];
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (!grid[r][c]) out.push([r, c]);
        return out;
    }

    function addRandomTile() {
        var empty = emptyCells();
        if (!empty.length) return;
        var cell = empty[Math.floor(Math.random() * empty.length)];
        spawnTile(cell[0], cell[1], Math.random() < 0.9 ? 2 : 4, true);
    }

    function canMove() {
        if (emptyCells().length) return true;
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
            var v = grid[r][c].v;
            if (r < 3 && grid[r + 1][c].v === v) return true;
            if (c < 3 && grid[r][c + 1].v === v) return true;
        }
        return false;
    }

    function move(dr, dc) {
        if (over || moving) return;
        moving = true;
        var gained = 0;
        var mergedAnything = false;
        var moved = false;
        // traversal order: towards movement direction
        var rows = [0, 1, 2, 3], cols = [0, 1, 2, 3];
        if (dr === 1) rows.reverse();
        if (dc === 1) cols.reverse();
        var mergeQueue = [];
        rows.forEach(function (r) {
            cols.forEach(function (c) {
                var t = grid[r][c];
                if (!t) return;
                var nr = r, nc = c;
                var hit = null;
                while (true) {
                    var tr = nr + dr, tc = nc + dc;
                    if (tr < 0 || tr > 3 || tc < 0 || tc > 3) break;
                    if (!grid[tr][tc]) { nr = tr; nc = tc; continue; }
                    if (grid[tr][tc].v === t.v && !grid[tr][tc]._merging) { hit = grid[tr][tc]; nr = tr; nc = tc; }
                    break;
                }
                if (nr !== r || nc !== c) moved = true;
                if (hit) {
                    // slide onto the target, then merge
                    grid[r][c] = null;
                    t.r = hit.r; t.c = hit.c;
                    place(t);
                    t.el.style.zIndex = 2;
                    hit._merging = true;
                    mergeQueue.push({ moving: t, target: hit });
                    gained += t.v * 2;
                    mergedAnything = true;
                } else if (nr !== r || nc !== c) {
                    grid[r][c] = null;
                    grid[nr][nc] = t;
                    t.r = nr; t.c = nc;
                    place(t);
                }
            });
        });
        if (!moved && !mergedAnything) { moving = false; return; }
        score += gained;
        if (score > best) { best = score; try { localStorage.setItem('g2048_best', String(best)); } catch (e) {} }
        updateHUD();
        if (mergedAnything) {
            var boardEl = root && root.querySelector('.g2048-board');
            if (boardEl) {
                boardEl.classList.remove('is-bump');
                void boardEl.offsetWidth;
                boardEl.classList.add('is-bump');
                setTimeout(function () { boardEl.classList.remove('is-bump'); }, 280);
            }
            var scoreEl = root && root.querySelector('.g2048-score');
            if (scoreEl && gained > 0) {
                var delta = document.createElement('span');
                delta.className = 'g2048-delta';
                delta.textContent = '+' + gained;
                scoreEl.appendChild(delta);
                setTimeout(function () { if (delta.parentNode) delta.parentNode.removeChild(delta); }, 700);
            }
        }
        setTimeout(function () {
            mergeQueue.forEach(function (m) {
                removeTile(m.moving);
                var t = m.target;
                t.v *= 2;
                t._merging = false;
                var colors = tileColor(t.v);
                t.el.style.background = colors[0];
                t.el.style.color = colors[1];
                t.el.textContent = t.v;
                if (t.v >= 1024) t.el.style.fontSize = 'clamp(12px,3.4vw,22px)';
                t.el.classList.remove('is-merged');
                void t.el.offsetWidth;
                t.el.classList.add('is-merged');
                t.el.style.zIndex = 3;
                if (t.v === 2048 && !root._won) {
                    root._won = true;
                    root.querySelector('.g2048-over strong').textContent = 'You win!';
                    root.querySelector('[data-g2048-again]').textContent = 'KEEP GOING';
                    root.querySelector('.g2048-over').classList.add('is-visible');
                    setTimeout(function () { root.querySelector('.g2048-over').classList.remove('is-visible'); }, 1500);
                }
            });
            addRandomTile();
            updateHUD();
            if (!canMove()) {
                over = true;
                root.querySelector('.g2048-over strong').textContent = 'Game over!';
                root.querySelector('[data-g2048-again]').textContent = 'TRY AGAIN';
                root.querySelector('.g2048-over').classList.add('is-visible');
            }
            moving = false;
        }, 155);
    }

    function updateHUD() {
        if (!root) return;
        root.querySelector('[data-g2048-score]').textContent = score;
        root.querySelector('[data-g2048-best]').textContent = best;
    }

    function reset() {
        tiles.slice().forEach(removeTile);
        grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
        score = 0;
        over = false;
        root._won = false;
        root.querySelector('.g2048-over').classList.remove('is-visible');
        root.querySelector('[data-g2048-again]').textContent = 'TRY AGAIN';
        addRandomTile();
        addRandomTile();
        updateHUD();
    }

    function onKey(e) {
        if (!root) return;
        var k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { move(0, -1); e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { move(0, 1); e.preventDefault(); }
        else if (k === 'ArrowUp' || k === 'w' || k === 'W') { move(-1, 0); e.preventDefault(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { move(1, 0); e.preventDefault(); }
    }

    function open(el) {
        close();
        injectStyles();
        container = el;
        try { best = parseInt(localStorage.getItem('g2048_best') || '0', 10) || 0; } catch (e) { best = 0; }
        el.innerHTML =
            '<div class="g2048-wrap">' +
                '<div class="g2048">' +
                    '<div class="g2048-head">' +
                        '<div class="g2048-title">2048<small>SLIDE · MERGE · REACH 2048</small></div>' +
                        '<div class="g2048-scores"><div class="g2048-score"><small>SCORE</small><b data-g2048-score>0</b></div><div class="g2048-score"><small>BEST</small><b data-g2048-best>0</b></div></div>' +
                    '</div>' +
                    '<div class="g2048-row"><span class="g2048-hint">Arrow keys / WASD on desktop · swipe on touch</span><button type="button" class="g2048-new" data-g2048-new>NEW GAME</button></div>' +
                    '<div class="g2048-board">' +
                        '<div class="g2048-bg"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
                        '<div class="g2048-tiles"></div>' +
                        '<div class="g2048-over"><strong>Game over!</strong><button type="button" data-g2048-again>TRY AGAIN</button></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        root = el.querySelector('.g2048-wrap');
        root.querySelector('[data-g2048-new]').addEventListener('click', reset);
        root.querySelector('[data-g2048-again]').addEventListener('click', function () {
            if (over) reset();
            else root.querySelector('.g2048-over').classList.remove('is-visible');
        });
        global.addEventListener('keydown', onKey);
        // touch swipe
        var touch = null;
        root.addEventListener('touchstart', function (e) {
            touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });
        root.addEventListener('touchend', function (e) {
            if (!touch) return;
            var dx = e.changedTouches[0].clientX - touch.x;
            var dy = e.changedTouches[0].clientY - touch.y;
            touch = null;
            if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
            else move(dy > 0 ? 1 : -1, 0);
        }, { passive: true });
        grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
        addRandomTile();
        addRandomTile();
        updateHUD();
    }

    function close() {
        if (root) global.removeEventListener('keydown', onKey);
        if (container) { try { container.innerHTML = ''; } catch (e) {} }
        container = null;
        root = null;
        tiles = [];
        grid = null;
        over = false;
        moving = false;
    }

    global.Game2048 = { open: open, close: close };
})(window);
