/** @file ui_display_logic.js @description 表示要素（SEED列/マスター情報/Find）のトグル管理 */

// マスター情報の表示フラグ（初期値は非表示）
let isMasterInfoVisible = false;

/**
 * SEED詳細列（左側の計算用数値列）の表示/非表示を切り替える
 */
function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    
    // テーブル全体を再生成して表示状態を反映
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    
    // ボタンのラベル表示を更新
    updateToggleButtons();

    // 【追加】計算方法の説明文エリアの表示切り替え
    const explanationArea = document.getElementById('seed-calc-explanation');
    if (explanationArea) {
        if (showSeedColumns) {
            explanationArea.classList.remove('hidden');
        } else {
            explanationArea.classList.add('hidden');
        }
    }
}

/**
 * SEED列切り替えボタンのテキストを現在の状態に合わせて更新する
 */
function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    if (btnSeed) {
        btnSeed.textContent = showSeedColumns ? 'SEED非表示' : 'SEED表示';
    }
}

/**
 * ガチャのマスター情報（キャラ一覧リスト）の表示/非表示を切り替える
 */
function toggleMasterInfo() {
    isMasterInfoVisible = !isMasterInfoVisible;

    // マスター表示ボタンの見た目（activeクラス）を更新
    const btn = document.getElementById('toggle-master-info-btn');
    if (btn) {
        if (isMasterInfoVisible) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    // コンテナ要素（master-info-area）の表示状態を直接制御
    const content = document.getElementById('master-info-area');
    if (content) {
        content.style.display = isMasterInfoVisible ? 'block' : 'none';
    }

    // テーブル生成フローの中でHTML構造を再構築
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    
    // リフレッシュロジックを実行して中身を最新にする
    if (typeof updateMasterInfoView === 'function') {
        updateMasterInfoView();
    }
}

/**
 * Find（高速予報・ターゲット検索）エリアの表示/非表示を切り替える
 */
function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    
    const btn = document.getElementById('toggle-find-info-btn');
    
    // テーブル全体を再生成してFindエリアの有無を反映
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    
    // Findボタンの活性化状態を更新
    if (btn) {
        if (showFindInfo) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}