/**
 * ui_controller.js
 * 画面操作（ボタンクリック等）と状態管理を担当
 * 実際のHTML生成は view_*.js に委譲する
 */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 300;
let showSeedColumns = false;
let showResultDisplay = false;
let showMasterInfo = false;
let showFindInfo = false;
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;
let activeGuaranteedIds = new Set();
let isScheduleAnalyzed = false;
// Find機能の状態管理
let hiddenFindIds = new Set(); // 自動ターゲットのうち、非表示にするID
let userTargetIds = new Set(); // 自動ターゲット以外で、表示するID (手動ターゲット)
let isFindListCleared = false;
// 一括非表示状態のフラグ

// 超激レア追加シミュレーション用 (配列に変更してindex管理を容易にする)
let uberAdditionCounts = [];

// --- 初期化 & データ処理 ---

function prepareScheduleInfo() {
    if (isScheduleAnalyzed) return;
    if (typeof loadedTsvContent === 'string' && loadedTsvContent && 
        typeof parseGachaTSV === 'function' && typeof parseDateTime === 'function') {
        try {
            const scheduleData = parseGachaTSV(loadedTsvContent);
            const now = new Date();
            activeGuaranteedIds.clear();

            scheduleData.forEach(item => {
                const startDt = parseDateTime(item.rawStart, item.startTime);
                const endDt = parseDateTime(item.rawEnd, item.endTime);
                
                if (now >= startDt && now <= endDt) {
            
                    if (item.guaranteed) {
                        const gId = parseInt(item.id);
                        activeGuaranteedIds.add(gId);
                        if (gachaMasterData && gachaMasterData.gachas && gachaMasterData.gachas[gId]) {
         
                            const currentName = gachaMasterData.gachas[gId].name;
                            if (!currentName.includes('[確定]')) {
                                gachaMasterData.gachas[gId].name += " [確定]";
             
                           }
                        }
                    }
                }
            });
            isScheduleAnalyzed = true;
            console.log("Schedule Analyzed. Active Guaranteed IDs:", Array.from(activeGuaranteedIds));
        } catch (e) {
            console.warn("Schedule analysis failed:", e);
        }
    }
}

function initializeDefaultGachas() {
    prepareScheduleInfo();
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
                        uberAdditionCounts.push(0); // 初期化
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
            btn.textContent = "表示モードへ";
            btn.classList.add('active');
        } else {
            btn.textContent = "SIMモードへ（未実装）";
            btn.classList.remove('active');
        }
    }
}

function refreshModeView() {
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

// --- テーブル操作 ---

function resetAndGenerateTable() {
    if (isScheduleMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 300;
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
        updateUrlParams();
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
        let val = options[0].value;
        if (activeGuaranteedIds.has(parseInt(val))) val += 'g';
        tableGachaIds.push(val);
        uberAdditionCounts.push(0); // 新規列用に0を追加
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    uberAdditionCounts.splice(index, 1);
    // 対応する追加数データも削除して詰める
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

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
    // ガチャ変更時はadd設定をリセットしない（既存の値を維持する場合）
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

function toggleGuaranteedColumn(index) {
    const currentVal = tableGachaIds[index];
    let baseId = currentVal;
    let suffix = '';
    if (currentVal.endsWith('f')) { suffix = 'f'; baseId = currentVal.slice(0, -1);
    } 
    else if (currentVal.endsWith('s')) { suffix = 's'; baseId = currentVal.slice(0, -1);
    } 
    else if (currentVal.endsWith('g')) { suffix = 'g'; baseId = currentVal.slice(0, -1);
    }

    let nextSuffix = '';
    if (suffix === '') nextSuffix = 'g';
    else if (suffix === 'g') nextSuffix = 'f';
    else if (suffix === 'f') nextSuffix = 's';
    else if (suffix === 's') nextSuffix = '';
    tableGachaIds[index] = baseId + nextSuffix;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

function updateUberAddition(selectElement, index) {
    const val = parseInt(selectElement.value, 10);
    uberAdditionCounts[index] = (!isNaN(val)) ? val : 0;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// --- SEED入力欄の制御 ---

// 入力欄を表示
function showSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    
    if (container) container.classList.remove('hidden');
    if (trigger) trigger.classList.add('hidden');
    
    const input = document.getElementById('seed');
    if (input) input.focus();
}

// 値を反映して入力欄を隠す
function applySeedInput() {
    // データ更新と再描画
    updateUrlParams();
    resetAndGenerateTable();
    
    // 閉じる処理
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
    if(btnSeed) btnSeed.textContent = showSeedColumns ? 'SEEDを非表示' : 'SEEDを表示';
}

function toggleDescription() {
    const content = document.getElementById('description-content');
    const toggle = document.getElementById('toggle-description');
    if(content && toggle) {
        const isHidden = content.classList.toggle('hidden');
        toggle.textContent = isHidden ? '概要を表示' : '概要を非表示';
    }
}

// --- Find情報表示切り替え ---
function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    const container = document.getElementById('forecast-summary-area');
    const btn = document.getElementById('toggle-find-info-btn');
    if (container) {
        if (showFindInfo) container.classList.remove('hidden');
        else container.classList.add('hidden');
    }
    if (btn) btn.textContent = showFindInfo ? 'Findを非表示' : 'Findを表示';
}

// --- マスタ情報表示 ---
function toggleMasterInfo() {
    showMasterInfo = !showMasterInfo;
    const container = document.getElementById('master-info-container');
    const btn = document.getElementById('toggle-master-info-btn');
    if (showMasterInfo) {
        if (container) {
            container.innerHTML = (typeof generateMasterInfoHtml === 'function') ?
            generateMasterInfoHtml() : '';
            container.classList.remove('hidden');
        }
        if (btn) btn.textContent = 'ガチャマスター情報を非表示';
    } else {
        if (container) container.classList.add('hidden');
        if (btn) btn.textContent = 'ガチャマスター情報を表示';
    }
}

function updateMasterInfoView() {
    if (showMasterInfo) {
        const container = document.getElementById('master-info-container');
        if (container) {
            container.innerHTML = (typeof generateMasterInfoHtml === 'function') ?
            generateMasterInfoHtml() : '';
        }
    }
}

// Helper: 自動ターゲット（伝説・限定・新規）かどうかを判定
function isAutomaticTarget(charId) {
    const idStr = String(charId);
    if (idStr.startsWith('sim-new-')) return true;
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        if (limitedCats.includes(charId) || limitedCats.includes(parseInt(charId)) || limitedCats.includes(idStr)) {
            return true;
        }
    }
    if (typeof gachaMasterData !== 'undefined' && gachaMasterData.cats) {
        const catInfo = gachaMasterData.cats[charId];
        if (catInfo && catInfo.rarity === 'legend') {
            return true;
        }
    }
    return false;
}

// Findキャラの表示/非表示を切り替える関数 (個別)
function toggleCharVisibility(charId) {
    let idVal = charId;
    if (!isNaN(parseInt(charId)) && !String(charId).includes('sim-new')) {
        idVal = parseInt(charId);
    }
    
    if (isAutomaticTarget(idVal)) {
        if (hiddenFindIds.has(idVal)) hiddenFindIds.delete(idVal);
        else hiddenFindIds.add(idVal);
    } else {
        if (userTargetIds.has(idVal)) userTargetIds.delete(idVal); 
        else userTargetIds.add(idVal);
    }
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

// Findの一括表示/非表示切り替え (トグル)
function toggleAllFindVisibility() {
    if (isFindListCleared) {
        hiddenFindIds.clear();
        userTargetIds.clear();
        isFindListCleared = false;
    } else {
        const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
            let id = idStr;
            if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
            return id;
        }))];
        uniqueIds.forEach(id => {
            const config = gachaMasterData.gachas[id];
            if (!config) return;
            
            ['rare', 'super', 'uber', 'legend'].forEach(r => {
                if (config.pool[r]) {
                    config.pool[r].forEach(c => 
                    {
                        const cid = c.id;
                        if (isAutomaticTarget(cid)) {
                            hiddenFindIds.add(cid);
                   
                        }
                    });
                }
            });
            
            const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
            const addCount = (colIndex >= 0 
            && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
            for(let k=1; k<=addCount; k++){
                hiddenFindIds.add(`sim-new-${k}`);
            }
        });
        userTargetIds.clear();
        isFindListCleared = true;
    }

    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

// --- スケジュール表示 ---
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
    // ID付きのコントロールエリア、マスター情報エリア、Findエリアを取得
    const mainControls = document.getElementById('main-controls');
    const masterInfoContainer = document.getElementById('master-info-container');
    const findContainer = document.getElementById('forecast-summary-area');
    if (isScheduleMode) {
        scheduleBtn.textContent = 'ロールズに戻る';
        scheduleBtn.classList.add('active');
        // メインテーブル関連を隠す
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (bottomControls) bottomControls.classList.add('hidden');
        
        // ▼ 追加: 入力フィールド、マスター情報、Findを隠す
        if (mainControls) mainControls.classList.add('hidden');
        if (masterInfoContainer) masterInfoContainer.classList.add('hidden');
        if (findContainer) findContainer.classList.add('hidden');

        // スケジュール表示
        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.textContent = 'スケジュールを表示';
        scheduleBtn.classList.remove('active');
        
        // メインテーブル関連を表示
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (bottomControls) bottomControls.classList.remove('hidden');
        
        // ▼ 追加: 入力フィールドを表示
        if (mainControls) mainControls.classList.remove('hidden');
        // ▼ 追加: マスター情報とFindは元の状態に基づいて復元
        if (showMasterInfo && masterInfoContainer) masterInfoContainer.classList.remove('hidden');
        if (showFindInfo && findContainer) findContainer.classList.remove('hidden');

        // スケジュール非表示
        if (scheduleContainer) scheduleContainer.classList.add('hidden');
    }
}