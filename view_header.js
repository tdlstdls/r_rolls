/**
 * view_header.js
 * テーブルヘッダーのHTML生成ロジック
 */

function generateHeaderHTML(isInteractive) {
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;

    let html = `
        <th class="${calcColClass}">SEED</th>
        <th class="${calcColClass}">rarity</th>
        <th class="${calcColClass}">slot</th>
        <th class="${calcColClass}">ReRoll</th>
        <th class="${calcColClass}">Guar</th>
    `;

    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix;
        let suffix = '';
        if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }

        const isGuaranteed = (suffix !== '');
        const gachaConfig = gachaMasterData.gachas[id];
        if (!gachaConfig) return;
        
        let selectedLabel = `${id} ${gachaConfig.name}`;
        const options = getGachaSelectorOptions(id);
        const foundOption = options.find(o => o.value == id);
        if (foundOption) selectedLabel = foundOption.label;

        let displayHTML = "";
        const firstSpaceIdx = selectedLabel.indexOf(' ');
        if (firstSpaceIdx !== -1) {
            const part1 = selectedLabel.substring(0, firstSpaceIdx);
            const part2 = selectedLabel.substring(firstSpaceIdx + 1);
            displayHTML = `<span style="font-size:0.85em; color:#333;">${part1}</span><br><span style="font-weight:bold; font-size:0.95em;">${part2}</span>`;
        } else {
            displayHTML = selectedLabel;
        }

        let selectorArea = '';
        let controlArea = '';

        if (isInteractive) {
            const removeBtn = `<button class="remove-btn" onclick="removeGachaColumn(${index})" style="font-size:11px; padding:2px 6px; margin-left: 5px;">x</button>`;
            let gBtnLabel = 'G';
            if (suffix === 'g') gBtnLabel = '11G';
            else if (suffix === 'f') gBtnLabel = '15G';
            else if (suffix === 's') gBtnLabel = '7G';
            
            const gBtn = `<button onclick="toggleGuaranteedColumn(${index})" style="min-width:25px; font-size:11px; padding:2px 6px;">${gBtnLabel}</button>`;
            const currentAddVal = uberAdditionCounts[index] || 0;
            const addLabelText = (currentAddVal > 0) ? `add:${currentAddVal}` : `add`;
            const triggerHtml = `<span id="add-trigger-${index}" style="font-size:12px; color:#007bff; cursor:pointer; text-decoration:underline;" onclick="showAddInput(${index})">${addLabelText}</span>`;
            
            let addSelect = `<span id="add-select-wrapper-${index}" style="display:none;">`;
            addSelect += `<select class="uber-add-select" onchange="updateUberAddition(this, ${index})" style="width: 40px; margin: 0 2px; padding: 0; font-size: 0.85em;">`;
            for(let k=0; k<=19; k++){
                addSelect += `<option value="${k}" ${k===currentAddVal ? 'selected':''}>${k}</option>`;
            }
            addSelect += `</select></span>`;
            
            let selector = `<select onchange="updateGachaSelection(this, ${index})" style="width: 30px; cursor: pointer; opacity: 0; position: absolute; left:0; top:0; height: 100%; width: 100%;">`;
            options.forEach(opt => {
                const selected = (opt.value == id) ? 'selected' : '';
                selector += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
            selector += '</select>';
            
            const fakeSelectBtn = `<div style="width:20px; height:20px; background:#ddd; border:1px solid #999; display:flex; align-items:center; justify-content:center; border-radius:3px;">▼</div>`;
            selectorArea = `<div style="position: relative; width: 24px; height: 24px;">${fakeSelectBtn}${selector}</div>`;
            controlArea = `<div style="margin-top:4px; display:flex; justify-content:center; align-items:center; gap:3px;">${gBtn}${triggerHtml}${addSelect}${removeBtn}</div>`;
        } else {
            selectorArea = `<div style="width: 24px; height: 24px;"></div>`;
            let statusTextParts = [];
            if (suffix === 'g') statusTextParts.push('11G');
            else if (suffix === 'f') statusTextParts.push('15G');
            else if (suffix === 's') statusTextParts.push('7G');
            const currentAddVal = uberAdditionCounts[index] || 0;
            if (currentAddVal > 0) statusTextParts.push(`add:${currentAddVal}`);
            if (statusTextParts.length > 0) {
                controlArea = `<div style="margin-top:4px; font-size:0.85em; color:#555; height: 21px; display: flex; align-items: center; justify-content: center;">${statusTextParts.join(' / ')}</div>`;
            } else {
                 controlArea = `<div style="margin-top:4px; height: 21px;"></div>`;
            }
        }
        
        const cls = isGuaranteed ? '' : 'class="gacha-column"';
        html += `<th ${cls} ${isGuaranteed?'colspan="2"':''}><div class="gacha-header-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 6px; position: relative;">${selectorArea}<div style="text-align: left; line-height: 1.25;">${displayHTML}</div></div>${controlArea}</th>`;
    });
    return html;
}