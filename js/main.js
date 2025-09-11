// main.js
import { startPlacing, clearSelection, rotateSelected } from "./core.js";

function init() {
    const buttons = document.querySelectorAll('.tool');
    buttons.forEach(btn => {
        const kind = btn.getAttribute('data-kind');
        if (!kind) return;
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            startPlacing(kind);
        });
    });
    // …（省略：キャンバスクリックやRキーなど）
}
document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, { once: true })
    : init();

// Canvasの空クリックで選択解除
document.getElementById("canvas").addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "canvas" || id === "wireLayer" || id === "zero") { clearSelection(); }
});

// サイドバーのツールボタン
document.querySelectorAll('.tool').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const kind = btn.getAttribute('data-kind') || btn.dataset.kind;
        if (kind) startPlacing(kind);
    });
});

// 例: Rキーで回転（グローバル）
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') rotateSelected();
});
