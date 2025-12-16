/**
 * ui_schedule_handler.js
 * スケジュールデータの解析、skdモード切替、スケジュールからの列追加ロジック
 */

// スケジュール情報の事前解析
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

// スケジュールモードのUIセットアップ
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

// スケジュールモードの切り替え (skdボタン)
function toggleSchedule() {
    if (!loadedTsvContent) {
        alert("スケジュールの読み込みに失敗しました。");
        return;
    }

    // もし概要モードが開いていれば、先に閉じる (排他制御)
    if (typeof isDescriptionMode !== 'undefined' && isDescriptionMode && typeof toggleDescription === 'function') {
        toggleDescription(); 
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

// スケジュールから開催中・予定のガチャを一括追加
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
    // 既存の手動追加分を残すかどうかのロジック（ここではスケジュールにないものは残す）
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
    if (typeof updateMasterInfoView === 'function') updateMasterInfoView();
    if (typeof updateUrlParams === 'function') updateUrlParams();
}