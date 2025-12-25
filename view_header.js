/** @file view_header.js @description テーブルヘッダー（固定行・操作行）のHTML生成を担当 @dependency gacha_selector.js */

// 変更: 名前行（固定表示）のHTMLを生成
function generateNameHeaderHTML() {
    let html = ``;
    
    // index引数を追加して、uberAdditionCountsにアクセスできるように変更
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

        // --- 追加: add情報の表示文字列を作成 ---
        const addCount = uberAdditionCounts[index] || 0;
        let addInfoStr = '';
        if (addCount > 0) {
            // 赤字で目立たせて表示 (例: add:1)
            addInfoStr = ` <span style="font-size:0.85em; color:#d9534f; font-weight:normal;">(add:${addCount})</span>`;
        }
        // ---------------------------------------

        let displayHTML = "";
        const firstSpaceIdx = selectedLabel.indexOf(' ');
    
        if (firstSpaceIdx !== -1) {
            const part1 = selectedLabel.substring(0, firstSpaceIdx);
            const part2 = selectedLabel.substring(firstSpaceIdx + 1);
            // ガチャ名の後ろにadd情報を付与
            displayHTML = `<span style="font-size:0.85em; color:#333;">${part1}</span><br><span style="font-weight:bold; font-size:0.95em;">${part2}${addInfoStr}</span>`;
        } else {
            displayHTML = `${selectedLabel}${addInfoStr}`;
        }

        // 確定列の場合はクラスを外す（下のセルが幅を規定するため）か、
        // または幅制限のない別のクラスを検討します。
        // 今回は「下のセル（td）が幅を持つ」ため、ヘッダーは colspan のみを活かす形が安全です。
        const cls = isGuaranteed ? '' : 'class="gacha-column"'; 

        // 名前行なので ControlArea は出力しない
        html += `<th ${cls} ${isGuaranteed?'colspan="2"':''} style="vertical-align: bottom; padding-bottom: 2px;">
                    <div style="text-align: center; line-height: 1.25;">${displayHTML}</div>
                 </th>`;
    });
    return html;
}

// 変更: 操作ボタン行（スクロールと一緒に流れる）のHTMLを生成
function generateControlHeaderHTML(isInteractive) {
    let html = ``;

    tableGachaIds.forEach((idWithSuffix, index) => {
        let id = idWithSuffix;
        let suffix = '';
        if (idWithSuffix.endsWith('f')) { suffix = 'f'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('s')) { suffix = 's'; id = idWithSuffix.slice(0, -1); }
        else if (idWithSuffix.endsWith('g')) { suffix = 'g'; id = idWithSuffix.slice(0, -1); }

        const isGuaranteed = (suffix !== '');
        
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
            
            // セレクター（透明）の再構築
            const options = getGachaSelectorOptions(id);
            let selector = `<select onchange="updateGachaSelection(this, ${index})" style="width: 30px; cursor: pointer; opacity: 0; position: absolute; left:0; top:0; height: 100%; width: 100%;">`;
            options.forEach(opt => {
                const selected = (opt.value == id) ? 'selected' : '';
                selector += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
            selector += '</select>';
            
            const fakeSelectBtn = `<div style="width:20px; height:20px; background:#ddd; border:1px solid #999; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:10px;">▼</div>`;
            selectorArea = `<div style="position: relative; width: 20px; height: 20px;">${fakeSelectBtn}${selector}</div>`;
            
            controlArea = `<div style="display:flex; justify-content:center; align-items:center; gap:3px;">${selectorArea}${gBtn}${triggerHtml}${addSelect}${removeBtn}</div>`;
        } else {
            // Interactiveでない場合（A, Bの表示のみの箇所など）
             controlArea = `<div style="height: 20px;"></div>`;
        }
        
        const cls = isGuaranteed ? '' : 'class="gacha-column"';
        html += `<th ${cls} ${isGuaranteed?'colspan="2"':''} style="vertical-align: top; padding-top: 2px;">
                    ${controlArea}
                 </th>`;
    });
    return html;
}