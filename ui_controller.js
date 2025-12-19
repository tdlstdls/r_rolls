/** @file ui_controller.js @description UIのメイン制御（初期化、モード切替、描画指示）を担当 @dependency ui_globals.js, view_table.js */

// マスター情報の表示状態管理フラグ
let isMasterInfoVisible = true;

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
        toggleSeedInput();
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
            btn.classList.add('active');
        } else {
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

function clearSimConfig() {
    const el = document.getElementById('sim-config');
    if(el) el.value = '';
    
    // エラーメッセージと通知メッセージの両方をクリア
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

function backSimConfig() {
    const el = document.getElementById('sim-config');
    if (el && typeof removeLastConfigSegment === 'function') {
        el.value = removeLastConfigSegment(el.value);
        resetAndGenerateTable();
    }
}

function updateSeedFromSim() {
    if (finalSeedForUpdate) {
        document.getElementById('seed').value = finalSeedForUpdate;
        document.getElementById('sim-config').value = '';
        resetAndGenerateTable(); 
    }
}

// --- SEED入力欄の制御 ---

function toggleSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    
    if (!container) return;

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (trigger) {
            trigger.classList.remove('hidden');
            trigger.classList.add('active');
        }
        const input = document.getElementById('seed');
        if (input) input.focus();
    } else {
        cancelSeedInput();
    }
}

function applySeedInput() {
    if (typeof updateUrlParams === 'function') updateUrlParams();
    resetAndGenerateTable();
    
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    
    if (container) container.classList.add('hidden');
    if (trigger) {
        trigger.classList.remove('hidden');
        trigger.classList.remove('active');
    }
}

function cancelSeedInput() {
    const container = document.getElementById('seed-input-container');
    const trigger = document.getElementById('seed-input-trigger');
    const input = document.getElementById('seed');
    const urlParams = new URLSearchParams(window.location.search);
    const currentSeed = urlParams.get('seed') || "12345";
    if (input) input.value = currentSeed;

    if (container) container.classList.add('hidden');
    if (trigger) {
        trigger.classList.remove('hidden');
        trigger.classList.remove('active');
    }
}

function copySeedToClipboard() {
    const seedInput = document.getElementById('seed');
    if (!seedInput) return;
    navigator.clipboard.writeText(seedInput.value).catch(err => {
        console.error('Failed to copy: ', err);
    });
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

function toggleMasterInfo() {
    isMasterInfoVisible = !isMasterInfoVisible;
    const content = document.getElementById('master-info-content');
    if (content) {
        content.style.display = isMasterInfoVisible ? 'block' : 'none';
    }
    
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    if (typeof updateMasterInfoView === 'function') {
        updateMasterInfoView();
    }
}

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
        if (toggle) {
            toggle.classList.add('active');
        }
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
        if (toggle) {
            toggle.classList.remove('active');
        }
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

function toggleFindInfo() {
    showFindInfo = !showFindInfo;
    const btn = document.getElementById('toggle-find-info-btn');
    if (typeof generateRollsTable === 'function') {
        generateRollsTable();
    }
    if (btn) {
        if (showFindInfo) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

// --- 共通View更新 ---

function updateMasterInfoView() {
    const el = document.getElementById('master-info-area');
    if (!el || typeof generateMasterInfoHTML !== 'function') return;

    const configs = [];
    tableGachaIds.forEach(idStr => {
        let gachaId = idStr;
        if (gachaId.endsWith('g') || gachaId.endsWith('s') || gachaId.endsWith('f')) {
            gachaId = gachaId.slice(0, -1);
        }
        if (gachaMasterData.gachas[gachaId]) {
            configs.push(gachaMasterData.gachas[gachaId]);
        }
    });
    el.innerHTML = generateMasterInfoHTML(configs);
}

/**
 * セルクリック時のハンドラ
 */
function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null, fromFind = false, targetCharId = null) {
    if (isSimulationMode) {
        const errorEl = document.getElementById('sim-error-msg');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        const visibleIds = tableGachaIds.map(id => id);
        const configInput = document.getElementById('sim-config');
        const currentConfig = configInput ? configInput.value : "";

        if (typeof calculateRouteToCell === 'function') {
            let routeConfig;
            if (guaranteedType) {
                const finalAction = { 
                    id: gachaId, 
                    rolls: parseInt(guaranteedType.replace('g', ''), 10), 
                    g: true 
                };
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction, targetCharId);
            } else {
                routeConfig = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, null, targetCharId);
            }

            if (routeConfig) {
                if (configInput) {
                    configInput.value = routeConfig;
                    if (typeof updateUrlParams === 'function') updateUrlParams();
                    resetAndGenerateTable();
                }
            } else {
                if (errorEl) {
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    const cellLabel = `${side}${row}`;
                    errorEl.textContent = `${cellLabel}セルへのルートは見つかりませんでした`;
                    errorEl.style.display = 'block'; 
                }
                console.warn("Route not found.");
            }
        }
    } else {
        // 自動でSimモードへ切り替え
        toggleAppMode();
        
        if (fromFind) {
            const notifEl = document.getElementById('sim-notif-msg');
            if (notifEl) {
                notifEl.textContent = 'Findのセル番地クリックによりSIMモードに切り替えました';
                notifEl.style.display = 'inline';
            }
        }
        
        setTimeout(() => {
            onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType, fromFind, targetCharId);
        }, 100);
    }
}