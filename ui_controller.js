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
let isFindListCleared = false; // 一括非表示状態のフラグ

// 超激レア追加シミュレーション用
let uberAdditionCounts = {};

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
                if (options.length > 1) tableGachaIds.push(options[1].value);
            } else {
                const sortedGachas = Object.values(gachaMasterData.gachas)
                    .filter(gacha => gacha.sort < 800)
                    .sort((a, b) => a.sort - b.sort);
                if (sortedGachas.length > 0) tableGachaIds.push(sortedGachas[0].id);
                if (sortedGachas.length > 1) tableGachaIds.push(sortedGachas[1].id);
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
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    delete uberAdditionCounts[index];
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
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

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

function updateUberAddition(selectElement, index) {
    const val = parseInt(selectElement.value, 10);
    uberAdditionCounts[index] = (!isNaN(val)) ? val : 0;
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// --- 表示切替 ---

function toggleSeedColumns() {
    showSeedColumns = !showSeedColumns;
    if (typeof generateRollsTable === 'function') generateRollsTable(); 
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
            container.innerHTML = (typeof generateMasterInfoHtml === 'function') ? generateMasterInfoHtml() : '';
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
            container.innerHTML = (typeof generateMasterInfoHtml === 'function') ? generateMasterInfoHtml() : '';
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

// ▼ 追加: Findの一括表示/非表示切り替え (トグル)
function toggleAllFindVisibility() {
    if (isFindListCleared) {
        // 現在「全非表示」状態 -> デフォルト（伝説・限定表示）に戻す
        hiddenFindIds.clear();
        userTargetIds.clear();
        isFindListCleared = false;
    } else {
        // 現在「表示」状態 -> 全て非表示にする
        // 現在表示されているテーブルのガチャに含まれるすべての「自動ターゲット」を非表示リストに追加
        const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
            let id = idStr;
            if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
            return id;
        }))];

        uniqueIds.forEach(id => {
            const config = gachaMasterData.gachas[id];
            if (!config) return;
            
            // プール内の全キャラをスキャン
            ['rare', 'super', 'uber', 'legend'].forEach(r => {
                if (config.pool[r]) {
                    config.pool[r].forEach(c => {
                        const cid = c.id;
                        // 新規超激の考慮 (IDがsim-new-でなくてもプールに含まれる可能性があるか確認、通常はgenerate時に追加される)
                        // ここでは標準プールのみチェックするが、sim-newは動的生成のため
                        // 実際には isAutomaticTarget で判定可能
                        
                        if (isAutomaticTarget(cid)) {
                            hiddenFindIds.add(cid);
                        }
                    });
                }
            });
            
            // 新規超激レア (uberAdditionCountsに基づく) も非表示対象にする
            const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
            const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
            for(let k=1; k<=addCount; k++){
                hiddenFindIds.add(`sim-new-${k}`);
            }
        });

        // ユーザーターゲットもクリア（全て非表示なので）
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