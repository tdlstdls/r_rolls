/** @file ui_seed_logic.js @description SEED値の操作・同期ロジック */

/**
 * ヘッダーの現在のSEED表示を更新する
 */
function updateSeedDisplay() {
    const display = document.getElementById('current-seed-display');
    const seedInput = document.getElementById('seed');
    if (display && seedInput) {
        display.textContent = seedInput.value;
    }
}

/**
 * SEED入力モーダルを表示する
 */
function toggleSeedInput() {
    const currentSeed = document.getElementById('seed')?.value || "12345";
    
    // モーダルのHTML。決定ボタンで applyModalSeed() を呼ぶ。
    const contentHtml = `
        <h3 style="margin-top:0; font-size:1.1em;">SEEDを入力</h3>
        <p style="font-size:0.85em; color:#666;">値を変更して「決定」を押してください。</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
            <input type="number" id="modal-seed-input" value="${currentSeed}" 
                   style="width:100%; padding:8px; font-size:1.1em; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"
                   onkeydown="if(event.key==='Enter') applyModalSeed()">
            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button onclick="closeModal()" class="secondary" style="padding:6px 12px; cursor:pointer;">キャンセル</button>
                <button onclick="applyModalSeed()" style="padding:6px 20px; cursor:pointer; background:#444; color:#fff; border:none; border-radius:4px;">決定</button>
            </div>
        </div>
    `;
    
    if (typeof showModal === 'function') {
        showModal(contentHtml);
        // 入力欄にフォーカス
        setTimeout(() => document.getElementById('modal-seed-input')?.focus(), 50);
    }
}

/**
 * モーダル内の「決定」ボタンが押された時の処理
 */
function applyModalSeed() {
    const modalInput = document.getElementById('modal-seed-input');
    const mainSeedInput = document.getElementById('seed');
    
    if (modalInput && mainSeedInput) {
        mainSeedInput.value = modalInput.value;
        // 値を適用してテーブル再描画
        applySeedInput();
        // モーダルを閉じる
        if (typeof closeModal === 'function') closeModal();
    }
}

/**
 * 値を適用し、URL同期とテーブル再描画、ヘッダー更新を行う
 */
function applySeedInput() {
    // 既存の同期・更新ロジックを呼び出す
    if (typeof updateUrlParams === 'function') updateUrlParams();
    if (typeof resetAndGenerateTable === 'function') resetAndGenerateTable();
    
    // ヘッダー表示を最新の入力値に同期
    updateSeedDisplay();

    // 旧UIコンテナが残っている場合は隠す
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    if (container) container.classList.add('hidden');
    if (trigger) trigger.classList.remove('active');
}

/**
 * 現在のSEED値をクリップボードにコピー
 */
function copySeedToClipboard() {
    const seedInput = document.getElementById('seed');
    if (!seedInput) return;
    
    navigator.clipboard.writeText(seedInput.value).then(() => {
        const display = document.getElementById('current-seed-display');
        const originalText = display.textContent;
        display.textContent = 'Copied!';
        display.style.color = '#28a745';
        setTimeout(() => {
            display.textContent = originalText;
            display.style.color = '';
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

/**
 * 外部（Sim等）からSEEDが更新された際の反映用
 */
function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        updateSeedDisplay();
        if (typeof resetAndGenerateTable === 'function') resetAndGenerateTable();
    }
}