/** @file view_forecast_render.js @description Find機能のHTML描画担当 */

function generateForecastHeader(slots, status) {
    const lStr = slots.legendSlots.length > 0 ? slots.legendSlots.join(", ") : "なし";
    const pStr = slots.promotedSlots.length > 0 ? slots.promotedSlots.join(", ") : "なし";

    return `
        <div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed #eee; font-size: 0.85em;">
            <div style="margin-bottom: 4px;">
                <span style="font-weight:bold; color:#e91e63; background:#ffe0eb; padding:1px 4px; border-radius:3px;">伝説枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${lStr}</span>
            </div>
            <div>
                <span style="font-weight:bold; color:#9c27b0; background:#f3e5f5; padding:1px 4px; border-radius:3px;">昇格枠</span>
                <span style="font-family: monospace; margin-left: 5px;">${pStr}</span>
            </div>
        </div>
        <div style="margin-bottom: 10px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span onclick="clearAllTargets()" class="text-btn" title="全て非表示">×</span>
                <span class="separator">|</span>
                <span onclick="toggleLegendTargets()" class="${status.isLegendActive ? 'text-btn active' : 'text-btn'}">伝説</span>
                <span class="separator">|</span>
                <span onclick="toggleLimitedTargets()" class="${status.isLimitedActive ? 'text-btn active' : 'text-btn'}">限定</span>
                <span class="separator">|</span>
                <span id="toggle-master-info-btn" onclick="toggleMasterInfo()" class="${status.isMasterActive ? 'text-btn active' : 'text-btn'}">マスター</span>
                <span style="font-size: 0.8em; color: #666; margin-left: auto;">Target List</span>
            </div>
            <div style="font-size: 0.75em; color: #666; padding-left: 2px; line-height: 1.4;">
                ※キャラ名をタップで先頭へ移動。×で削除。右のアドレスをタップでルート探索。
            </div>
        </div>
    `;
}

function processGachaForecast(config, seeds, scanRows, extendedScanRows) {
    const targets = getTargetInfoForConfig(config);
    if (targets.ids.size === 0) return '';

    const resultMap = new Map();
    const missingTargets = new Set(targets.ids);

    performScan(config, seeds, 0, scanRows * 2, targets, resultMap, missingTargets);
    if (missingTargets.size > 0) {
        performScan(config, seeds, scanRows * 2, extendedScanRows * 2, targets, resultMap, missingTargets);
    }

    missingTargets.forEach(cid => {
        if (!resultMap.has(cid)) {
            resultMap.set(cid, {
                name: gachaMasterData.cats[cid]?.name || cid,
                hits: ["9999+"], isLegend: false, isNew: String(cid).startsWith('sim-new-'), isLimited: false
            });
        }
    });

    return renderGachaForecastList(config, resultMap);
}

function renderGachaForecastList(config, resultMap) {
    if (resultMap.size === 0) return '';
    let listItems = Array.from(resultMap.entries()).map(([id, data]) => ({ id, ...data }));
    
    listItems.sort((a, b) => {
        const idxA = prioritizedFindIds.indexOf(a.id);
        const idxB = prioritizedFindIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        const isNewA = String(a.id).startsWith('sim-new-'), isNewB = String(b.id).startsWith('sim-new-');
        if (isNewA && !isNewB) return -1;
        if (!isNewA && isNewB) return 1;
        return 0;
    });

    const itemHtmls = listItems.map(data => renderTargetItem(data, config));
    return `
        <div style="margin-bottom: 8px;">
            <div style="font-weight: bold; background: #eee; padding: 2px 5px; margin-bottom: 3px; font-size: 0.85em;">${config.name}</div>
            <div style="font-family: monospace; font-size: 1em;">${itemHtmls.join('')}</div>
        </div>
    `;
}

function renderTargetItem(data, config) {
    let nameStyle = 'font-weight:bold; font-size: 0.9em; cursor:pointer;';
    if (data.isNew) nameStyle += ' color:#007bff;';
    else if (data.isLegend) nameStyle += ' color:#e91e63;';
    else if (data.isLimited) nameStyle += ' color:#d35400;';
    else nameStyle += ' color:#333;';

    const hitLinks = data.hits.map(addr => {
        if (addr === "9999+") return `<span style="color:#999; font-weight:normal;">${addr}</span>`;
        const isB = addr.startsWith('B'), rowMatch = addr.match(/\d+/);
        const row = rowMatch ? parseInt(rowMatch[0], 10) : 0;
        const sIdx = (row - 1) * 2 + (isB ? 1 : 0);
        if (row > 10000) return `<span style="margin-right:4px; color: #999; font-size: 0.9em;">${addr}</span>`;
        return `<span class="char-link" style="cursor:pointer; text-decoration:underline; margin-right:4px;" onclick="onGachaCellClick(${sIdx}, '${config.id}', '${data.name.replace(/'/g, "\\'")}', null, true, '${data.id}')">${addr}</span>`;
    }).join("");

    const otherBtn = `<span onclick="searchInAllGachas('${data.id}', '${data.name.replace(/'/g, "\\'")}')" style="cursor:pointer; margin-left:8px; color:#009688; font-size:0.8em; text-decoration:underline;" title="他ガチャを検索">other</span>`;
    
    return `
        <div style="margin-bottom: 2px; line-height: 1.3;">
            <span onclick="toggleCharVisibility('${data.id}')" style="cursor:pointer; margin-right:6px; color:#999; font-weight:bold;">×</span>
            <span style="${nameStyle}" onclick="prioritizeChar('${data.id}')">${data.name}</span>: 
            <span style="font-size: 0.85em; color: #555;">${hitLinks}${otherBtn}</span>
        </div>
    `;
}

function renderGlobalSearchResults() {
    let html = `<div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #009688;">
            <div style="font-weight:bold; color:#009688; margin-bottom:5px; font-size:0.9em;">他ガチャでの「${globalSearchResults.charName}」出現位置:</div>`;
    if (globalSearchResults.results.length === 0) {
        html += `<div style="font-size:0.85em; color:#999; padding-left:5px;">他のガチャには出現しませんでした。</div>`;
    } else {
        globalSearchResults.results.forEach(res => {
            const displayHits = res.hits.map(h => {
                if (h === "9999+") return `<span style="color:#999; font-weight:normal;">${h}</span>`;
                const isB = h.endsWith('B'), row = parseInt(h);
                return `${isB ? 'B' : 'A'}${row})`;
            }).join(", ");
            html += `<div style="font-size:0.85em; margin-bottom:2px; padding-left:5px;"><span style="color:#666;">${res.gachaName}:</span> <span style="font-family:monospace; font-weight:bold;">${displayHits}</span></div>`;
        });
    }
    return html + `</div>`;
}