/** @file view_table_dom.js @description テーブルのDOM構造構築（操作パネル・ボタン統一版） */

/**
 * テーブル上部のグローバル操作パネルを生成
 */
function buildGlobalControlPanel() {
    return `
        <div id="table-global-controls" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 10px; margin-bottom: 10px; padding: 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">
            <span style="font-weight: bold; font-size: 12px; color: #333;">ガチャ列操作:</span>
            <button class="add-gacha-btn" onclick="addGachaColumn()" style="font-size: 11px; padding: 2px 6px;">＋列を追加</button>
            <button class="add-gacha-btn" style="background-color: #17a2b8; font-size: 11px; padding: 2px 6px;" onclick="addGachasFromSchedule()">skdで追加</button>
            
            <button id="add-id-trigger" class="add-gacha-btn" style="background-color: #6c757d; font-size: 11px; padding: 2px 6px;" onclick="showIdInput()">IDで追加</button>
            
            <button class="remove-btn" onclick="resetToFirstGacha()" title="解除" style="font-size: 11px; padding: 2px 6px; margin-left: auto;">全て解除×</button>
        </div>`;
}

/**
 * テーブルDOM構築のメイン
 */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    const totalTrackSpan = calculateTotalTrackSpan();
    const fullTableColSpan = 2 + totalTrackSpan * 2;
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;

    let html = buildGlobalControlPanel();

    html += `<table style="table-layout: auto; width: 100%; border-collapse: collapse;"><thead>
        <tr>
            <th class="col-no" style="position: sticky; left: 0; z-index: 30; background: #f8f9fa; border-right: 1px solid #ddd;"></th>
            <th class="track-header" colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; border-right: 1px solid #ddd; font-weight: bold;">A</th>
            <th class="col-no"></th>
            <th class="track-header" colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; font-weight: bold;">B</th>
        </tr>
        <tr class="sticky-row">
            <th class="col-no" style="position: sticky; top: 0; left: 0; z-index: 40; background: #f8f9fa; border-right: 1px solid #ddd;">NO.</th>
            <th class="${calcColClass}">SEED</th>
            ${generateNameHeaderHTML()}
            <th class="col-no" style="border-left: 1px solid #ddd;">NO.</th>
            <th class="${calcColClass}">SEED</th>
            ${generateNameHeaderHTML()}
        </tr>
        <tr class="control-row">
            <th class="col-no" style="position: sticky; left: 0; z-index: 30; background: #f8f9fa; border-right: 1px solid #ddd;"></th>
            <th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(true)}
            <th class="col-no" style="border-left: 1px solid #ddd;"></th>
            <th class="${calcColClass}"></th>
            ${generateControlHeaderHTML(false)}
        </tr>
    </thead><tbody>`;

    for (let i = 0; i < numRolls; i++) {
        const seedIndexA = i * 2, seedIndexB = i * 2 + 1;
        html += `<tr>${renderTableRowSide(i, seedIndexA, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, true)}`;
        html += `${renderTableRowSide(i, seedIndexB, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, false)}</tr>`;
    }

    html += `<tr><td colspan="${fullTableColSpan}" style="padding: 10px; text-align: center;">
        <div style="margin-bottom: 10px;">
            <button onclick="addMoreRolls()">+100行</button>
            <button id="toggle-seed-btn" class="secondary" onclick="toggleSeedColumns()">${showSeedColumns ? 'SEED非表示' : 'SEED表示'}</button>
        </div>
        <div id="seed-calc-explanation" class="${showSeedColumns ? '' : 'hidden'}" style="text-align: left; margin-top: 20px;">
            ${typeof generateSeedExplanationHtml === 'function' ? generateSeedExplanationHtml() : ''}
        </div>
    </td></tr></tbody></table>`;
    
    return html;
}

/**
 * ガチャID入力フォームの表示
 * ボタンがクリックされたら、ボタンの中身を input 要素に書き換えます
 */
function showIdInput() {
    const trigger = document.getElementById('add-id-trigger');
    if (!trigger) return;

    // ボタンのクリックイベントを一時的に解除し、中身を書き換え
    trigger.onclick = null;
    trigger.innerHTML = `<input type="text" id="direct-id-input" placeholder="ID" style="width:50px; font-size:10px; border:none; outline:none; padding:0; margin:0; background:transparent; color:white; text-align:center;" onkeydown="if(event.key==='Enter') applyDirectId()">`;
    
    const input = document.getElementById('direct-id-input');
    input.focus();

    // フォーカスが外れたら元のボタン表示に戻す
    input.onblur = () => { 
        setTimeout(() => { 
            trigger.innerText = 'IDで追加';
            trigger.onclick = showIdInput; 
        }, 200); 
    };
}

/**
 * トラックあたりの総Colspanを計算
 */
function calculateTotalTrackSpan() {
    const calcColSpan = showSeedColumns ? 1 : 0;
    let gachaColSpan = 0;
    tableGachaIds.forEach(idWithSuffix => {
        let id = idWithSuffix.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[id]) {
            gachaColSpan += /[gfs]$/.test(idWithSuffix) ? 2 : 1;
        }
    });
    return calcColSpan + gachaColSpan;
}

/**
 * 入力されたIDをガチャ列として追加
 */
function applyDirectId() {
    const input = document.getElementById('direct-id-input');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        const baseId = val.replace(/[gfs]$/, '');
        if (gachaMasterData.gachas[baseId]) {
            tableGachaIds.push(val);
            if (typeof updateUrlParams === 'function') updateUrlParams();
            resetAndGenerateTable();
        } else {
            alert("無効なガチャIDです。");
        }
    }
}
