/** @file view_table_events.js @description テーブル上のUI操作イベント */

/**
 * [cite_start]確定枠ボタンのトグル切替 (11G -> 15G -> 7G -> 無し) [cite: 1019-1021]
 */
window.toggleGStep = function(index) {
    let idFull = tableGachaIds[index];
    let base = idFull.replace(/[gfs]$/, '');
    if (idFull.endsWith('g')) tableGachaIds[index] = base + 'f';
    else if (idFull.endsWith('f')) tableGachaIds[index] = base + 's';
    else if (idFull.endsWith('s')) tableGachaIds[index] = base;
    else tableGachaIds[index] = base + 'g';
    generateRollsTable();
};

/**
 * [cite_start]add入力欄の表示 [cite: 1022]
 */
window.showAddInput = function(index) {
    const trigger = document.getElementById(`add-trigger-${index}`);
    const wrapper = document.getElementById(`add-select-wrapper-${index}`);
    if (trigger) trigger.style.display = 'none';
    if (wrapper) wrapper.style.display = 'inline';
};

/**
 * [cite_start]add選択値の更新 [cite: 1023]
 */
window.updateUberAddition = function(el, index) {
    uberAdditionCounts[index] = parseInt(el.value, 10);
    generateRollsTable();
};