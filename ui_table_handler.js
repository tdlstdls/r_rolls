/** @file ui_table_handler.js @description テーブルの列操作（追加、削除、変更）のイベントハンドラを担当 @dependency view_table.js */

// 新しいガチャ列を追加 (デフォルト選択)
function addGachaColumn() {
    const options = getGachaSelectorOptions(null);
    if (options.length > 0) {
        let val = options[0].value;
        if (activeGuaranteedIds.has(parseInt(val))) val += 'g';
        tableGachaIds.push(val);
        uberAdditionCounts.push(0); 
        if (typeof generateRollsTable === 'function') generateRollsTable();
        if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
    }
}

// ガチャ列を削除
function removeGachaColumn(index) {
    if (tableGachaIds.length > 1) {
        tableGachaIds.splice(index, 1);
        uberAdditionCounts.splice(index, 1);
        if (typeof generateRollsTable === 'function') generateRollsTable();
        if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
    }
}

// 最初の列以外をリセット (×ボタンから呼ばれる)
function resetToFirstGacha() {
    if (tableGachaIds.length <= 1) return;
    
    if (confirm("一番左の列以外を削除しますか？")) {
        tableGachaIds = [tableGachaIds[0]];
        uberAdditionCounts = [uberAdditionCounts[0]];
        if (typeof generateRollsTable === 'function') generateRollsTable();
        if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
        if (typeof updateUrlParams === 'function') updateUrlParams();
    }
}

// 列のガチャを変更（プルダウン操作）
function updateGachaSelection(selectElement, index) {
    const originalIdWithSuffix = tableGachaIds[index];
    const newBaseId = selectElement.value;
    if (activeGuaranteedIds.has(parseInt(newBaseId))) {
        tableGachaIds[index] = newBaseId + 'g';
    } else {
        let suffix = '';
        if (originalIdWithSuffix.endsWith('f')) suffix = 'f';
        else if (originalIdWithSuffix.endsWith('s')) suffix = 's';
        else if (originalIdWithSuffix.endsWith('g')) suffix = 'g';
        tableGachaIds[index] = newBaseId + suffix;
    }
    if (typeof generateRollsTable === 'function') generateRollsTable();
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
}

// 確定枠タイプの切り替え (通常 -> 11g -> 15g -> 7g)
function toggleGuaranteedColumn(index) {
    const currentVal = tableGachaIds[index];
    let baseId = currentVal;
    let suffix = '';
    
    if (currentVal.endsWith('f')) { suffix = 'f'; baseId = currentVal.slice(0, -1); } 
    else if (currentVal.endsWith('s')) { suffix = 's'; baseId = currentVal.slice(0, -1); } 
    else if (currentVal.endsWith('g')) { suffix = 'g'; baseId = currentVal.slice(0, -1); }

    let nextSuffix = '';
    if (suffix === '') nextSuffix = 'g';
    else if (suffix === 'g') nextSuffix = 'f';
    else if (suffix === 'f') nextSuffix = 's';
    else if (suffix === 's') nextSuffix = '';
    
    tableGachaIds[index] = baseId + nextSuffix;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// 新規キャラ追加数（add機能）の更新
function updateUberAddition(selectElement, index) {
    const val = parseInt(selectElement.value, 10);
    uberAdditionCounts[index] = (!isNaN(val)) ? val : 0;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// add入力欄の表示
function showAddInput(index) {
    const trigger = document.getElementById(`add-trigger-${index}`);
    const wrapper = document.getElementById(`add-select-wrapper-${index}`);
    if(trigger) trigger.style.display = 'none';
    if(wrapper) wrapper.style.display = 'inline-block';
}

// ID指定追加入力欄の表示
function showIdInput() {
    const idStr = prompt("追加したいガチャIDを入力してください（例: 1006）\n確定枠付きにする場合はIDの末尾に g を付けてください（例: 1006g）");
    if (idStr) {
        const cleanId = idStr.trim();
        const baseId = cleanId.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[baseId]) {
            tableGachaIds.push(cleanId);
            uberAdditionCounts.push(0);
            if (typeof generateRollsTable === 'function') generateRollsTable();
            if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
            if (typeof updateUrlParams === 'function') updateUrlParams();
        } else {
            alert("無効なガチャIDです。");
        }
    }
}