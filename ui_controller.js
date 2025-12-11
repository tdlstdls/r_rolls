/**
 * ui_controller.js
 * 画面描画制御、イベントハンドラ、UI状態管理
 */

// UI状態変数 (Global)
let tableGachaIds = [];
let currentRolls = 300; 
let showSeedColumns = false;
let showResultDisplay = false;
let showMasterInfo = false; // マスタ情報表示フラグ
let finalSeedForUpdate = null;
let isSimulationMode = false;
let isScheduleMode = false;
let activeGuaranteedIds = new Set();
let isScheduleAnalyzed = false;

// 超激レア追加シミュレーション用
let uberAdditionCounts = {};

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

        if (!scheduleFound || tableGachaIds.length === 0) {
            const options = getGachaSelectorOptions(null);
            if (options.length > 0) {
                tableGachaIds.push(options[0].value);
                if (options.length > 1) {
                    tableGachaIds.push(options[1].value);
                }
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

// --- モード切替ロジック (トグルボタン) ---

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
            // ここを変更: ボタンテキストを更新
            btn.textContent = "シミュレーションモードへ（未実装）";
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

function resetAndGenerateTable() {
    if (isScheduleMode) return;
    finalSeedForUpdate = null;
    const simConf = document.getElementById('sim-config');
    if (simConf && simConf.value.trim() === '') {
         currentRolls = 300;
    }
    generateRollsTable();
    updateMasterInfoView();
    updateUrlParams();
}

function addMoreRolls() {
    currentRolls += 100;
    generateRollsTable();
}

function updateSeedAndRefresh(newSeed) {
    const seedInput = document.getElementById('seed');
    if(seedInput && newSeed) {
        seedInput.value = newSeed;
        currentRolls = 300;
        generateRollsTable();
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
        if (activeGuaranteedIds.has(parseInt(val))) {
            val += 'g';
        }
        tableGachaIds.push(val);
        generateRollsTable();
        updateMasterInfoView();
    }
}

function removeGachaColumn(index) {
    tableGachaIds.splice(index, 1);
    delete uberAdditionCounts[index];
    generateRollsTable();
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
    generateRollsTable();
    updateMasterInfoView();
}

function toggleGuaranteedColumn(index) {
    const currentVal = tableGachaIds[index];
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
    if (suffix === '') nextSuffix = 'g';
    else if (suffix === 'g') nextSuffix = 'f';
    else if (suffix === 'f') nextSuffix = 's';
    else if (suffix === 's') nextSuffix = '';

    tableGachaIds[index] = baseId + nextSuffix;
    generateRollsTable();
}

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

// --- ガチャマスター情報表示機能 ---

function toggleMasterInfo() {
    showMasterInfo = !showMasterInfo;
    const container = document.getElementById('master-info-container');
    const btn = document.getElementById('toggle-master-info-btn');
    
    if (showMasterInfo) {
        if (container) {
            container.innerHTML = generateMasterInfoHtml();
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
            container.innerHTML = generateMasterInfoHtml();
        }
    }
}

function generateMasterInfoHtml() {
    if (!gachaMasterData || !gachaMasterData.gachas) return '<p>データがありません</p>';
    
    // 現在選択中のユニークなガチャIDを抽出 (suffix除去)
    const uniqueIds = [...new Set(tableGachaIds.map(idStr => {
        let id = idStr;
        if (id.endsWith('f') || id.endsWith('s') || id.endsWith('g')) {
            id = id.slice(0, -1);
        }
        return id;
    }))];

    if (uniqueIds.length === 0) return '<p>ガチャが選択されていません</p>';

    let html = '';
    
    uniqueIds.forEach(id => {
        const config = gachaMasterData.gachas[id];
        if (!config) return;

        html += `<div style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">`;
        html += `<h4 style="margin: 0 0 5px 0;">${config.name} (ID: ${id})</h4>`;

        const rates = config.rarity_rates || {};
        const pool = config.pool || {};

        // レアリティの表示順 (Legendary -> Uber -> Super -> Rare)
        const rarities = [
            { key: 'legend', label: 'Legendary' },
            { key: 'uber', label: 'Uber' },
            { key: 'super', label: 'Super' },
            { key: 'rare', label: 'Rare' }
        ];

        rarities.forEach(r => {
            const rateVal = rates[r.key] || 0;
            const rateStr = (rateVal / 100) + '%';
            const charList = pool[r.key] || [];
            const count = charList.length;

            // 確率もリストも空なら表示しない
            if (count === 0 && rateVal === 0) return;

            // キャラリスト: "0 名前, 1 名前..."
            const listStr = charList.map((c, idx) => `${idx}&nbsp;${c.name}`).join(', ');

            html += `<div style="margin-bottom: 3px;">`;
            html += `<strong>${r.label}:</strong> ${rateStr} (${count} cats) `;
            html += `<span style="color: #555;">${listStr}</span>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    return html;
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