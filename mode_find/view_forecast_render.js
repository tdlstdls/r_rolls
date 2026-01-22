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
                <span onclick="toggleUberTargets()" class="${status.isUberActive ? 'text-btn active' : 'text-btn'}">超激</span>
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
    let allItems = Array.from(resultMap.entries()).map(([id, data]) => ({ id, ...data }));
    
    // ユーザーが優先指定したターゲットとそれ以外を分離
    const prioritizedItems = [];
    const normalItems = [];
    const prioritizedSet = new Set(userPrioritizedTargets.map(id => String(id)));

    allItems.forEach(item => {
        if (prioritizedSet.has(String(item.id))) {
            prioritizedItems.push(item);
        } else {
            normalItems.push(item);
        }
    });

    // 優先リストを userPrioritizedTargets の順に並び替え
    prioritizedItems.sort((a, b) => {
        return userPrioritizedTargets.indexOf(a.id) - userPrioritizedTargets.indexOf(b.id);
    });

    // 通常リストのソート（ユーザー指定の優先順位）
    const rarityOrder = { 'legend': 1, 'uber': 3, 'super': 4, 'rare': 5 };
    normalItems.sort((a, b) => {
        const getPriority = (char) => {
            if (char.isLimited) return 2; // 限定キャラ
            return rarityOrder[char.rarity] || 99;
        };
        const priorityA = getPriority(a);
        const priorityB = getPriority(b);
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        // 同じ優先度内では名前順などでソート
        return (a.name || '').localeCompare(b.name || '');
    });

    // HTMLを生成
    let prioritizedHtml = prioritizedItems.map(data => renderTargetItem(data, config)).join('');
    let normalHtml = normalItems.map(data => renderTargetItem(data, config)).join('');
    
    let separatorHtml = '';
    if (prioritizedItems.length > 0 && normalItems.length > 0) {
        separatorHtml = '<hr style="border: none; border-top: 1px dashed #ccc; margin: 4px 0;">';
    }

    return `
        <div style="margin-bottom: 8px;">
            <div style="font-weight: bold; background: #eee; padding: 2px 5px; margin-bottom: 3px; font-size: 0.85em;">${config.name}</div>
            <div style="font-family: monospace; font-size: 1em;">
                ${prioritizedHtml}
                ${separatorHtml}
                ${normalHtml}
            </div>
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