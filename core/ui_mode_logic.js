/** @file ui_mode_logic.js @description アプリの初期化とモード切替（Sim/skd/概要/Txt）の管理 */

/**
 * アプリ起動時のデフォルトガチャ設定の初期化
 */
function initializeDefaultGachas() {
    if (typeof prepareScheduleInfo === 'function') {
        prepareScheduleInfo();
    }

    if (tableGachaIds.length === 0) {
        let scheduleFound = false;
        if (isScheduleAnalyzed && typeof parseGachaTSV === 'function') {
            try {
                const scheduleData = parseGachaTSV(loadedTsvContent);
                const now = new Date();
                const activeGachas = scheduleData.filter(item => {
                    if (typeof isPlatinumOrLegend === 'function' && isPlatinumOrLegend(item)) return false;
                    const startDt = parseDateTime(item.rawStart, item.startTime);
                    const endDt = parseDateTime(item.rawEnd, item.endTime);
              
                    return now >= startDt && now <= endDt;
                });

                if (activeGachas.length > 0) {
                    activeGachas.forEach(gacha => {
                        // すでに gacha.id に接尾辞が含まれているため、そのまま使用する
                        tableGachaIds.push(gacha.id.toString());
                        uberAdditionCounts.push(0); 
                    });
                    scheduleFound = true;
                }
            } catch (e) {
                console.warn("Auto-select from schedule failed:", e);
            }
        }
        
        if (!scheduleFound || tableGachaIds.length === 0) {
            const options = getGachaSelectorOptions(null);
            if (options.length > 0) {
                tableGachaIds.push(options[0].value);
                uberAdditionCounts.push(0);
                if (options.length > 1) {
                    tableGachaIds.push(options[1].value);
                    uberAdditionCounts.push(0);
                }
            } else {
                const sortedGachas = Object.values(gachaMasterData.gachas)
                    .filter(gacha => gacha.sort < 800)
                    .sort((a, b) => a.sort - b.sort);
                if (sortedGachas.length > 0) {
                    tableGachaIds.push(sortedGachas[0].id);
                    uberAdditionCounts.push(0);
                }
                if (sortedGachas.length > 1) {
                    tableGachaIds.push(sortedGachas[1].id);
                    uberAdditionCounts.push(0);
                }
            }
        }
    }

    const seedEl = document.getElementById('seed');
    if (seedEl && (seedEl.value === '12345' || seedEl.value === '')) {
        toggleSeedInput();
    }
}

/**
 * モード変更時の共通処理
 */
function onModeChange() {
    updateModeButtonState();
    refreshModeView();
}

/**
 * Sim（シミュレーション）モードの切り替え
 */
function toggleAppMode() {
    isSimulationMode = !isSimulationMode;
    // SimモードがOFFになったらTxtモードも自動的にOFFにする
    if (!isSimulationMode) {
        isTxtMode = false;
    }
    onModeChange();
}

/**
 * Txt（テキストルート表示）モードの切り替え
 */
function toggleTxtMode() {
    // SimモードがONの時のみ動作させる
    if (!isSimulationMode) {
        alert("Txt表示を利用するには、まずSimモードをONにしてください。");
        return;
    }
    isTxtMode = !isTxtMode;
    onModeChange();
}

/**
 * 各モード切替ボタンの見た目（Active状態）と関連ボタンの表示を更新
 */
function updateModeButtonState() {
    // Simボタン
    const btnSim = document.getElementById('mode-toggle-btn');
    if (btnSim) {
        if (isSimulationMode) btnSim.classList.add('active');
        else btnSim.classList.remove('active');
    }
    
    // Txtボタンとコピーボタン
    const btnTxt = document.getElementById('toggle-txt-btn');
    const btnCopy = document.getElementById('copy-txt-btn');
    
    if (btnTxt) {
        if (isTxtMode && isSimulationMode) {
            btnTxt.classList.add('active');
            if (btnCopy) btnCopy.classList.remove('hidden');
        } else {
            btnTxt.classList.remove('active');
            if (btnCopy) btnCopy.classList.add('hidden');
        }
    }
}

/**
 * モードに応じたコントロールエリアの表示制御とテーブル再描画
 */
function refreshModeView() {
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        // スケジュールモードや概要モードでない、かつSimモードが有効な場合のみ表示
        if (isSimulationMode && !isScheduleMode && !isDescriptionMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    // テーブルの再生成を実行してTxtビューの表示有無を反映させる
    resetAndGenerateTable();
}

/**
 * 概要（使い方ガイド）表示の切り替え
 */
function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    const tableContainer = document.getElementById('rolls-table-container');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const resultDiv = document.getElementById('result');
    const mainControls = document.getElementById('main-controls');
    const scheduleContainer = document.getElementById('schedule-container');

    isDescriptionMode = !isDescriptionMode;
    if (isDescriptionMode) {
        if (typeof isScheduleMode !== 'undefined' && isScheduleMode && typeof toggleSchedule === 'function') {
            toggleSchedule();
        }
        if (toggle) toggle.classList.add('active');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (mainControls) mainControls.classList.add('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
        if (content) {
            content.classList.remove('hidden');
            content.style.flexGrow = '1';       
            content.style.overflowY = 'auto';   
            content.style.height = '100%';
            content.style.webkitOverflowScrolling = 'touch';
            content.style.minHeight = '0';
            content.style.maxHeight = 'none';
        }
    } else {
        if (toggle) toggle.classList.remove('active');
        if (content) {
            content.classList.add('hidden');
            content.style.flexGrow = '';
            content.style.overflowY = '';
            content.style.height = '';
            content.style.minHeight = '';
            content.style.maxHeight = '';
            content.style.webkitOverflowScrolling = '';
        }
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (mainControls) mainControls.classList.remove('hidden');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (showResultDisplay && resultDiv) resultDiv.classList.remove('hidden');
    }
}