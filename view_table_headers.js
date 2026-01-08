/** @file view_table_headers.js @description テーブルヘッダー詳細描画 */

/**
 * [cite_start]名称ヘッダーの生成 (名称右に11G表示ラベル付与) [cite: 1000-1008]
 */
function generateNameHeaderHTML() {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const isGCol = suffix !== '';
        const config = gachaMasterData.gachas[id];
        if (!config) return;

        const options = (typeof getGachaSelectorOptions === 'function') ? getGachaSelectorOptions(id) : [];
        const currentOpt = options.find(o => String(o.value) === id);
        let label = currentOpt ? currentOpt.label : config.name;
        
        const addCount = uberAdditionCounts[index] || 0;
        let addStr = addCount > 0 ? ` <span style="color:#d9534f; font-weight:normal; font-size:0.8em;">(add:${addCount})</span>` : "";

        let displayHTML = "";
        const spaceIdx = label.indexOf(' ');
        if (spaceIdx !== -1) {
            const p1 = label.substring(0, spaceIdx), p2 = label.substring(spaceIdx + 1);
            displayHTML = `<span style="font-size:0.85em; color:#666;">${p1}</span><br><span style="font-weight:bold;">${p2}${addStr}</span>`;
        } else {
            displayHTML = `<span>${label}${addStr}</span>`;
        }

        if (isGCol) {
            let gText = (suffix === 'g') ? '11G' : (suffix === 'f' ? '15G' : '7G');
            html += `<th colspan="2" class="gacha-column" style="vertical-align: bottom; padding: 4px; border-right: 1px solid #ddd;">
                        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                            <div style="text-align: center; line-height: 1.2;">${displayHTML}</div>
                            <div style="font-weight:bold; background:#d0e8ff; border-radius:3px; font-size:10px; padding:2px 8px; white-space:nowrap;">${gText}</div>
                        </div>
                     </th>`;
        } else {
            html += `<th class="gacha-column" style="vertical-align: bottom; padding: 4px; min-width: 120px; border-right: 1px solid #ddd;">
                        <div style="text-align: center; line-height: 1.2;">${displayHTML}</div>
                     </th>`;
        }
    });
    return html;
}

/**
 * [cite_start]操作ヘッダーの生成 [cite: 1009-1018]
 */
function generateControlHeaderHTML(isInteractive) {
    let html = "";
    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        let suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const isGCol = suffix !== '';

        let controlArea = "";
        if (isInteractive) {
            const options = (typeof getGachaSelectorOptions === 'function') ? getGachaSelectorOptions(id) : [];
            let select = `<select onchange="updateGachaSelection(this, ${index})" style="width:100%; height:100%; opacity:0; position:absolute; left:0; top:0; cursor:pointer;">`;
            options.forEach(opt => {
                select += `<option value="${opt.value}" ${String(opt.value) === id ? 'selected' : ''}>${opt.label}</option>`;
            });
            select += `</select>`;
            const pullDownBtn = `<div style="position:relative; width:18px; height:18px; background:#eee; border:1px solid #999; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:10px;">▼${select}</div>`;
            
            let gLabel = (suffix === 'g') ? '11G' : (suffix === 'f' ? '15G' : (suffix === 's' ? '7G' : 'G'));
            const gBtn = `<button onclick="toggleGStep(${index})" style="min-width:28px; font-size:10px; padding:1px 3px;">${gLabel}</button>`;
            
            const curAdd = uberAdditionCounts[index] || 0;
            const addLabel = curAdd > 0 ? `add:${curAdd}` : `add`;
            const addTrigger = `<span id="add-trigger-${index}" style="font-size:10px; color:#007bff; cursor:pointer; text-decoration:underline;" onclick="showAddInput(${index})">${addLabel}</span>`;
            
            let addSelect = `<span id="add-select-wrapper-${index}" style="display:none;"><select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width:35px; font-size:10px;">`;
            for(let k=0; k<=20; k++) addSelect += `<option value="${k}" ${k===curAdd?'selected':''}>${k}</option>`;
            addSelect += `</select></span>`;
            
            const delBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:10px; padding:1px 5px;">×</button>`;
            controlArea = `<div style="display:flex; justify-content:center; align-items:center; gap:5px;">${pullDownBtn}${gBtn}${addTrigger}${addSelect}${delBtn}</div>`;
        }

        if (isGCol) {
            html += `<th colspan="2" class="gacha-column" style="padding: 2px; border-right: 1px solid #ddd;">${controlArea}</th>`;
        } else {
            html += `<th class="gacha-column" style="padding: 2px; min-width: 120px; border-right: 1px solid #ddd;">${controlArea}</th>`;
        }
    });
    return html;
}