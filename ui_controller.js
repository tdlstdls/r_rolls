/**
 * ui_controller.js
 * アプリケーションのメインコントローラー
 * 初期化、モード管理、基本UI操作を担当
 */

// --- 初期化ロジック ---

function initializeDefaultGachas() {
    // スケジュール情報を解析 (ui_schedule_handler.js)
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
                        let newId = gacha.id.toString();
                        if (gacha.guaranteed) newId += 'g';
                   
                        tableGachaIds.push(newId);
                        uberAdditionCounts.push(0); 
                    });
                    scheduleFound = true;
                }
            } catch (e) {
                console.warn("Auto-select from schedule failed:", e);
            }
        }
        
        // スケジュールから見つからなければデフォルトロジック
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
        showSeedInput();
    }
}


// --- モード切替 ---

function onModeChange() {
    updateModeButtonState();
    refreshModeView();
}

function toggleAppMode() {
    isSimulationMode = !isSimulationMode;
    onModeChange();
}

function updateModeButtonState() {
    const btn = document.getElementById('mode-toggle-btn');
    if (btn) {
        if (isSimulationMode) {
            btn.textContent = "View";
            btn.classList.add('active');
        } else {
            btn.textContent = "Sim";
            btn.classList.remove('active');
        }
    }
}

function refreshModeView() {
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        if (isSimulationMode && !isScheduleMode && !isDescriptionMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    resetAndGenerateTable();
}

// --- テーブル更新・リセット ---

function resetAndGenerateTable() {
    if (isScheduleMode || isDescriptionMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    if (typeof updateUrlParams === 'function') updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// シード更新（セルクリック時などに呼ばれる）
function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 300;
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
        if (typeof updateUrlParams === 'function') updateUrlParams();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// シミュレーションConfigクリア
function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    resetAndGenerateTable();
}

// シミュレーション結果のシードをStart Seedに反映
function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}


// --- SEED入力欄の制御 ---

function showSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    if (container) container.classList.remove('hidden');
    if (trigger) trigger.classList.add('hidden');
    
    const input = document.getElementById('seed');
    if (input) input.focus();
}

function applySeedInput() {
    if (typeof updateUrlParams === 'function') updateUrlParams();
    resetAndGenerateTable();
    
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    
    if (container) container.classList.add('hidden');
    if (trigger) trigger.classList.remove('hidden');
}


// --- 表示切替 ---

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    if (typeof generateRollsTable === 'function') generateRollsTable(); 
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEED非表示' : 'SEED表示';
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    
    // UI要素の取得
    const tableContainer = document.getElementById('rolls-table-container');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const resultDiv = document.getElementById('result');
    const mainControls = document.getElementById('main-controls');
    const scheduleContainer = document.getElementById('schedule-container');

    // モード切替
    isDescriptionMode = !isDescriptionMode;

    if (isDescriptionMode) {
        // --- 概要モード ON ---

        // 1. スケジュールモードが開いていれば閉じる
        if (typeof isScheduleMode !== 'undefined' && isScheduleMode && typeof toggleSchedule === 'function') {
            toggleSchedule(); 
        }

        // 2. ボタン状態更新
        if (toggle) {
            toggle.textContent = 'Back';
            toggle.classList.add('active');
        }

        // 3. メイン画面の要素を隠す
        if (tableContainer) tableContainer.classList.add('hidden');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (mainControls) mainControls.classList.add('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');

        // 4. 概要コンテンツを表示＆スタイル調整 (画面いっぱいに広げる)
        if (content) {
            content.classList.remove('hidden');
            content.style.flexGrow = '1';       // 残りの領域を埋める
            content.style.overflowY = 'auto';   // スクロール許可
            content.style.height = 'auto';
            content.style.maxHeight = 'none';   // 高さ制限解除
        }

    } else {
        // --- 概要モード OFF ---

        // 1. ボタン状態更新
        if (toggle) {
            toggle.textContent = '概要';
            toggle.classList.remove('active');
        }

        // 2. 概要コンテンツを隠す＆スタイルリセット
        if (content) {
            content.classList.add('hidden');
            content.style.flexGrow = '';
            content.style.overflowY = '';
            content.style.maxHeight = '';
        }

        // 3. メイン画面の要素を復帰
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (mainControls) mainControls.classList.remove('hidden');
        
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (showResultDisplay && resultDiv) resultDiv.classList.remove('hidden');
    }
}

function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    const btn = document.getElementById('toggle-find-info-btn');
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    if (btn) btn.textContent = showFindInfo ? 'Findを隠す' : 'Find';
}

// --- 共通View更新 ---

function updateMasterInfoView() {
    // マスター情報は generateRollsTable 内で生成されるため、ここでは何もしない
    // (将来的に分離する場合はここにロジックを追加)
}