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
let showFindInfo = false; // Findエリア（予報＋マスター情報）の表示フラグ
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;
let activeGuaranteedIds = new Set();
let isScheduleAnalyzed = false;

// Find機能の状態管理
let hiddenFindIds = new Set(); // 自動ターゲットのうち、非表示にするID
let userTargetIds = new Set(); // 自動ターゲット以外で、表示するID (手動ターゲット)
let isFindListCleared = false; 

// 超激レア追加シミュレーション用
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
        uberAdditionCounts.push(0); 
        if (typeof generateRollsTable === 'function') generateRollsTable();
        updateMasterInfoView();
    }
}

function addGachasFromSchedule() {
    if (!loadedTsvContent || typeof parseGachaTSV !== 'function') {
        alert("スケジュールデータがありません。");
        return;
    }

    const scheduleData = parseGachaTSV(loadedTsvContent);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayInt = parseInt(`${y}${m}${d}`, 10);

    let activeScheduleItems = scheduleData.filter(item => parseInt(item.rawEnd) >= yesterdayInt);
    if (activeScheduleItems.length === 0) {
        alert("条件に合致するスケジュール（昨日以降終了、または開催中・未来）がありません。");
        return;
    }

    activeScheduleItems.sort((a, b) => {
        const checkSpecial = (item) => {
            if (typeof isPlatinumOrLegend === 'function') return isPlatinumOrLegend(item);
            const n = (item.seriesName + (item.tsvName || "")).replace(/\s/g, "");
            return n.includes("プラチナガチャ") || n.includes("レジェンドガチャ");
        };

        const isSpecialA = checkSpecial(a);
        const isSpecialB = checkSpecial(b);
        
        if (isSpecialA && !isSpecialB) return 1; 
        if (!isSpecialA && isSpecialB) return -1; 
        return parseInt(a.rawStart) - parseInt(b.rawStart);
    });

    const scheduleIds = new Set(activeScheduleItems.map(item => item.id.toString()));
    const keptGachas = [];
    tableGachaIds.forEach((idWithSuffix, index) => {
        const baseId = idWithSuffix.replace(/[gfs]$/, '');
        if (!scheduleIds.has(baseId)) {
            keptGachas.push({
                fullId: idWithSuffix,
                count: uberAdditionCounts[index] || 0
            });
        }
    });

    const newScheduleGachas = activeScheduleItems.map(item => {
        let newId = item.id.toString();
        if (item.guaranteed) newId += 'g';
        return {
            fullId: newId,
            count: 0
        };
    });

    const finalGachaList = [...keptGachas, ...newScheduleGachas];
    tableGachaIds = finalGachaList.map(item => item.fullId);
    uberAdditionCounts = finalGachaList.map(item => item.count);

    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    updateUrlParams();
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    uberAdditionCounts.splice(index, 1);
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
}

function resetToFirstGacha() {
    if (tableGachaIds.length <= 1) {
        return;
    }
    tableGachaIds = [tableGachaIds[0]];
    uberAdditionCounts = [uberAdditionCounts[0]];
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    updateUrlParams();
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

function showAddInput(index) {
    const trigger = document.getElementById(`add-trigger-${index}`);
    const wrapper = document.getElementById(`add-select-wrapper-${index}`);
    if(trigger) trigger.style.display = 'none';
    if(wrapper) wrapper.style.display = 'inline-block';
}

function showIdInput() {
    const trigger = document.getElementById('add-id-trigger');
    const container = document.getElementById('add-id-container');
    if(trigger) trigger.style.display = 'none';
    if(container) {
        container.style.display = 'inline-block';
        const inp = document.getElementById('gacha-id-input');
        if(inp) inp.focus();
    }
}

function addGachaById() {
    const inp = document.getElementById('gacha-id-input');
    if(!inp) return;
    const val = inp.value.trim();
    if(!val) return;

    const id = parseInt(val, 10);
    if(isNaN(id)) { alert("数値を入力してください"); return; }

    if(!gachaMasterData.gachas[id]) {
        alert(`ガチャID: ${id} のデータが見つかりません。`);
        return;
    }

    tableGachaIds.push(id.toString());
    uberAdditionCounts.push(0);
    if (typeof generateRollsTable === 'function') generateRollsTable();
    updateMasterInfoView();
    updateUrlParams();
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
    updateUrlParams();
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
    if(content && toggle) {
        const isHidden = content.classList.toggle('hidden');
        toggle.textContent = isHidden ? '概要' : '概要を隠す';
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

function updateMasterInfoView() {
    // マスター情報は generateRollsTable 内で生成されるため、ここでは何もしない
}

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
}

// --- Findの一括操作ボタンアクション ---

// 1. 全消去 (×ボタン)
function clearAllTargets() {
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
                config.pool[r].forEach(c => {
                    const cid = c.id;
                    // 自動ターゲットは全てHiddenに追加
                    if (isAutomaticTarget(cid)) {
                        hiddenFindIds.add(cid);
                    }
                });
            }
        });
        const colIndex = tableGachaIds.findIndex(tid => tid.startsWith(id));
        const addCount = (colIndex >= 0 && uberAdditionCounts[colIndex]) ? uberAdditionCounts[colIndex] : 0;
        for(let k=1; k<=addCount; k++){
           hiddenFindIds.add(`sim-new-${k}`);
        }
    });
    
    // 手動ターゲットは全てクリア
    userTargetIds.clear();
    
    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// 2. 伝説ON (伝説ボタン)
function activateLegendTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config || !config.pool.legend) return;
        config.pool.legend.forEach(c => {
            const cid = c.id;
            // Hiddenリストから削除 (＝表示状態にする)
            if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
            if (hiddenFindIds.has(String(cid))) hiddenFindIds.delete(String(cid));
        });
    });

    if (typeof generateRollsTable === 'function') generateRollsTable();
}

// 3. 限定ON (限定ボタン)
function activateLimitedTargets() {
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) id = id.slice(0, -1);
        return id;
    }))];

    const limitedSet = new Set();
    if (typeof limitedCats !== 'undefined' && Array.isArray(limitedCats)) {
        limitedCats.forEach(id => {
            limitedSet.add(id);
            limitedSet.add(String(id));
        });
    }

    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;
        ['rare', 'super', 'uber'].forEach(r => {
            if (config.pool[r]) {
                config.pool[r].forEach(c => {
                    const cid = c.id;
                    const cStr = String(cid);
                    if (limitedSet.has(cid) || limitedSet.has(cStr)) {
                        if (hiddenFindIds.has(cid)) hiddenFindIds.delete(cid);
                        if (hiddenFindIds.has(cStr)) hiddenFindIds.delete(cStr);
                    }
                });
            }
        });
    });

    if (typeof generateRollsTable === 'function') generateRollsTable();
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
    const mainControls = document.getElementById('main-controls');

    if (isScheduleMode) {
        scheduleBtn.textContent = 'Back';
        scheduleBtn.classList.add('active');
        if (simWrapper) simWrapper.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (resultDiv) resultDiv.classList.add('hidden');
        if (mainControls) mainControls.classList.add('hidden');

        if (scheduleContainer) {
            scheduleContainer.classList.remove('hidden');
            if (typeof renderScheduleTable === 'function') {
                renderScheduleTable(loadedTsvContent, 'schedule-container');
            }
        }
    } else {
        scheduleBtn.textContent = 'skd';
        scheduleBtn.classList.remove('active');
        if (isSimulationMode && simWrapper) simWrapper.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        if (resultDiv && showResultDisplay) resultDiv.classList.remove('hidden');
        if (mainControls) mainControls.classList.remove('hidden');

        if (scheduleContainer) scheduleContainer.classList.add('hidden');
    }
}