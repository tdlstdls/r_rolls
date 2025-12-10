/**
 * ui_controller.js
 * 画面描画制御、イベントハンドラ、UI状態管理
 * (ロジック詳細は url_manager.js, gacha_selector.js, table_renderer.js に委譲)
 */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 100;
let showSeedColumns = false;
let showResultDisplay = false;
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;

// 超激レア追加シミュレーション用 (index -> 追加数)
let uberAdditionCounts = {};

// --- 初期化関連 ---
// processUrlParamsは url_manager.js へ移動

function initializeDefaultGachas() {
    if (tableGachaIds.length === 0) {
        let scheduleFound = false;

        // 1. スケジュールロジックを利用して「現在開催中」かつ「プラチナ・レジェンド以外」のガチャを探す
        if (typeof loadedTsvContent === 'string' && loadedTsvContent && 
            typeof parseGachaTSV === 'function' && typeof isPlatinumOrLegend === 'function' && typeof parseDateTime === 'function') {
            
            try {
                const scheduleData = parseGachaTSV(loadedTsvContent);
                const now = new Date();

                // フィルタリング: 現在開催中 かつ プラチナ/レジェンド以外
                const activeGachas = scheduleData.filter(item => {
                    // 除外判定
                    if (isPlatinumOrLegend(item)) return false;

                    // 期間判定 (開始日時 <= 現在 <= 終了日時)
                    const startDt = parseDateTime(item.rawStart, item.startTime);
                    const endDt = parseDateTime(item.rawEnd, item.endTime);
                    
                    return now >= startDt && now <= endDt;
                });

                if (activeGachas.length > 0) {
                    activeGachas.forEach(gacha => {
                        let newId = gacha.id.toString();
                        // 確定フラグがあれば 'g' (11連確定) をデフォルトにする
                        if (gacha.guaranteed) {
                            newId += 'g';
                        }
                        tableGachaIds.push(newId);
                    });
                    scheduleFound = true;
                }
            } catch (e) {
                console.warn("Auto-select from schedule failed:", e);
            }
        }

        // 2. スケジュールから特定できなかった場合のフォールバック（既存ロジック）
        if (!scheduleFound || tableGachaIds.length === 0) {
            // getGachaSelectorOptions は gacha_selector.js へ移動
            const options = getGachaSelectorOptions(null);
            if (options.length > 0) {
                tableGachaIds.push(options[0].value);
                if (options.length > 1) {
                    tableGachaIds.push(options[1].value);
                }
            } else {
                // データがない場合のフォールバック
                const sortedGachas = Object.values(gachaMasterData.gachas)
                    .filter(gacha => gacha.sort < 800)
                    .sort((a, b) => a.sort - b.sort);
                if (sortedGachas.length > 0) tableGachaIds.push(sortedGachas[0].id);
                if (sortedGachas.length > 1) tableGachaIds.push(sortedGachas[1].id);
            }
        }
    }
}

// --- イベントハンドラ ---

function onModeChange() {
    const radios = document.getElementsByName('appMode');
    for (const radio of radios) {
        if (radio.checked) {
            isSimulationMode = (radio.value === 'simulation');
            break;
        }
    }
    const simWrapper = document.getElementById('sim-control-wrapper');
    if (simWrapper) {
        if (isSimulationMode && !isScheduleMode) {
            simWrapper.classList.remove('hidden');
        } else {
            simWrapper.classList.add('hidden');
        }
    }
    resetAndGenerateTable();
}

function resetAndGenerateTable() {
    if (isScheduleMode) return; 
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 100;
    }
    // generateRollsTable は table_renderer.js へ移動
    generateRollsTable();
    // updateUrlParams は url_manager.js へ移動
    updateUrlParams();
}

// 100行追加ボタン用
function addMoreRolls() {
    currentRolls += 100;
    generateRollsTable();
}

// キャラ名クリック時のSEED更新＆リフレッシュ用
function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 100; // 続きから100行表示するためリセット
        generateRollsTable();
        updateUrlParams();
        
        // 画面上部へスクロール（任意）
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    resetAndGenerateTable();
}

function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}

function addGachaColumn() {
    const options = getGachaSelectorOptions(null);
    if (options.length > 0) {
        tableGachaIds.push(options[0].value);
        generateRollsTable();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    delete uberAdditionCounts[index]; 
    generateRollsTable();
}

function updateGachaSelection(selectElement, index) {
    const originalIdWithSuffix = tableGachaIds[index];
    
    // IDのサフィックス判定 (f=15, s=7, g=11)
    let suffix = '';
    if (originalIdWithSuffix.endsWith('f')) suffix = 'f';
    else if (originalIdWithSuffix.endsWith('s')) suffix = 's';
    else if (originalIdWithSuffix.endsWith('g')) suffix = 'g';
    
    let newId = selectElement.value;
    if (suffix) newId += suffix;
    tableGachaIds[index] = newId;
    generateRollsTable();
}

function toggleGuaranteedColumn(index) {
    const currentVal = tableGachaIds[index];
    
    // IDとサフィックスを分離
    let baseId = currentVal;
    let suffix = '';
    
    if (currentVal.endsWith('f')) {
        suffix = 'f';
        baseId = currentVal.substring(0, currentVal.length - 1);
    } else if (currentVal.endsWith('s')) {
        suffix = 's';
        baseId = currentVal.substring(0, currentVal.length - 1);
    } else if (currentVal.endsWith('g')) {
        suffix = 'g';
        baseId = currentVal.substring(0, currentVal.length - 1);
    }

    let nextSuffix = '';
    // サイクル: ''(通常) -> 'g'(11連) -> 'f'(15連) -> 's'(7連) -> ''(通常)
    if (suffix === '') nextSuffix = 'g';
    else if (suffix === 'g') nextSuffix = 'f';
    else if (suffix === 'f') nextSuffix = 's';
    else if (suffix === 's') nextSuffix = '';

    tableGachaIds[index] = baseId + nextSuffix;
    generateRollsTable();
}

// 超激レア追加シミュレーション用イベントハンドラ
function updateUberAddition(selectElement, index) {
    const val = parseInt(selectElement.value, 10);
    if (!isNaN(val)) {
        uberAdditionCounts[index] = val;
    } else {
        uberAdditionCounts[index] = 0;
    }
    generateRollsTable();
}

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    generateRollsTable(); 
    updateToggleButtons();
}

function toggleResultDisplay() {
    showResultDisplay = !showResultDisplay;
    const res = document.getElementById('result');
    if(res) res.classList.toggle('hidden', !showResultDisplay);
    updateToggleButtons();
}

function updateToggleButtons() {
    const btnSeed = document.getElementById('toggle-seed-btn');
    const btnRes = document.getElementById('toggle-result-btn');
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEEDを非表示' : 'SEEDを表示';
    if(btnRes) btnRes.textContent = showResultDisplay ? '計算過程を非表示' : '計算過程を表示';
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    if(content && toggle) {
        const isHidden = content.classList.toggle('hidden');
        toggle.textContent = isHidden ? '概要を表示' : '概要を非表示';
    }
}

// --- スケジュール表示関連 ---

function setupScheduleUI() {
    let scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) {
        scheduleContainer = document.createElement('div');
        scheduleContainer.id = 'schedule-container';
        scheduleContainer.className = 'hidden';
        const tableContainer = document.getElementById('rolls-table-container');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(scheduleContainer, tableContainer.nextSibling);
        } else {
            document.body.appendChild(scheduleContainer);
        }
    }

    if (!document.getElementById('toggle-schedule-btn')) {
        const btn = document.createElement('button');
        btn.id = 'toggle-schedule-btn';
        btn.textContent = 'スケジュールを表示';
        btn.onclick = toggleSchedule;
        btn.className = 'secondary';
        
        const refBtn = document.getElementById('toggle-description');
        if (refBtn && refBtn.parentNode) {
            refBtn.parentNode.insertBefore(btn, refBtn.nextSibling);
        } else {
            const controls = document.querySelector('.controls');
            if(controls) controls.appendChild(btn);
        }
    }
}

function toggleSchedule() {
    if (!loadedTsvContent) {
        alert("スケジュールの読み込みに失敗しました。");
        return;
    }

    isScheduleMode = !isScheduleMode;
    const scheduleBtn = document.getElementById('toggle-schedule-btn');
    const simWrapper = document.getElementById('sim-control-wrapper');
    const tableContainer = document.getElementById('rolls-table-container');
    const scheduleContainer = document.getElementById('schedule-container');
    const resultDiv = document.getElementById('result');
    const bottomControls = document.getElementById('bottom-controls');

    if (isScheduleMode) {
        scheduleBtn.textContent = 'ロールズに戻る';
        scheduleBtn.classList.add('active');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (bottomControls) bottomControls.classList.add('hidden');
        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.textContent = 'スケジュールを表示';
        scheduleBtn.classList.remove('active');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (bottomControls) bottomControls.classList.remove('hidden');
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
    }
}