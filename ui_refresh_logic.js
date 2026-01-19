/** @file ui_refresh_logic.js @description テーブル再描画とConfig操作の管理 */

/**
 * テーブルを初期化して生成し、関連する表示（マスター情報、URLパラメータ）を更新する
 */
function resetAndGenerateTable() {
    // スケジュールモードや概要モードのときはテーブル生成を行わない
    if (isScheduleMode || isDescriptionMode) return;
    
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    
    // ルートが空の場合はデフォルトの表示行数にリセット
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    
    // テーブル本体の生成
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    
    // マスター情報の表示更新
    updateMasterInfoView();
    
    // URLパラメータの同期
    if (typeof updateUrlParams === 'function') {
        updateUrlParams();
    }
}

/**
 * 表示行数を100行増やす
 */
function addMoreRolls() {
    currentRolls += 100;
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
}

/**
 * シミュレーション設定（ルート）をクリアする
 */
function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if (el) el.value = '';
    
    const errorEl = document.getElementById('sim-error-msg');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
    const notifEl = document.getElementById('sim-notif-msg');
    if (notifEl) {
        notifEl.textContent = '';
        notifEl.style.display = 'none';
    }
    
    resetAndGenerateTable();
}

/**
 * シミュレーションの最後の一歩を取り消す
 */
function backSimConfig() {
    const el = document.getElementById('sim-config');
    if (el && typeof removeLastConfigSegment === 'function') {
        el.value = removeLastConfigSegment(el.value);
        resetAndGenerateTable();
    }
}

/**
 * ガチャのマスター詳細情報（キャラリスト）表示を更新する
 */
function updateMasterInfoView() {
    // view_table.js側で生成されるコンテナIDを指定
    const el = document.getElementById('master-info-area');
    
    // 関数名のタイポ修正：generateMasterInfoHTML -> generateMasterInfoHtml
    if (!el || typeof generateMasterInfoHtml !== 'function') return;

    // 現在テーブルに表示されているガチャ情報を収集
    const configs = [];
    tableGachaIds.forEach(idStr => {
        let gachaId = idStr.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[gachaId]) {
            configs.push(gachaMasterData.gachas[gachaId]);
        }
    });

    // 収集した情報を元にHTMLを生成して流し込む
    el.innerHTML = generateMasterInfoHtml(configs);
}