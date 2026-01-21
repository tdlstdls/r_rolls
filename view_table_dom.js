/** @file view_table_dom.js @description テーブルのDOM構造構築（SEED 1列集約・全機能保全版） */

/**
 * テーブルDOM構築のメイン
 * @param {number} numRolls - 描画する行数
 * @param {Array} columnConfigs - 列の設定
 * @param {Array} tableData - 計算済みテーブルデータ
 * @param {Array} seeds - シード値配列
 * @param {Map} highlightMap - 通常セルのハイライト状態
 * @param {Map} guarHighlightMap - 確定枠のハイライト状態
 */
function buildTableDOM(numRolls, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap) {
    const totalTrackSpan = calculateTotalTrackSpan();
    // 全体の列数：(No列 + トラックAの全列) + (No列 + トラックBの全列)
    const fullTableColSpan = 2 + totalTrackSpan * 2;
    const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;

    let html = `<table style="table-layout: auto; width: 100%; border-collapse: collapse;"><thead>
        <tr>
            <th class="col-no" style="position: sticky; left: 0; z-index: 30; background: #f8f9fa; border-right: 1px solid #ddd;"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; border-right: 1px solid #ddd;">${buildHeaderButtonArea()}</th>
            <th class="col-no"></th>
            <th colspan="${totalTrackSpan}" style="text-align: center; vertical-align: middle; padding: 4px; font-weight: bold;">B</th>
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

    // 下部操作エリア
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
 * トラックあたりの総Colspanを計算
 * 修正：SEED表示列を 5列から 1列として計算するように修正
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
 * ヘッダー部分の操作ボタンエリア生成
 */
function buildHeaderButtonArea() {
    return `
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; font-weight: normal; white-space: normal;">
            <span style="font-weight: bold; margin-right: 1px; font-size: 11px;">A</span>
            <button class="add-gacha-btn" onclick="addGachaColumn()" style="font-size: 11px; padding: 1px 4px;">＋列を追加</button>
            <button class="add-gacha-btn" style="background-color: #17a2b8; font-size: 11px; padding: 1px 4px;" onclick="addGachasFromSchedule()">skdで追加</button>
            <span id="add-id-trigger" style="cursor:pointer; text-decoration:underline; color:#007bff; font-size: 11px; font-weight:bold;" onclick="showIdInput()">IDで追加</span>
            <button class="remove-btn" onclick="resetToFirstGacha()" title="解除" style="font-size: 11px; padding: 1px 5px; margin-left: 2px;">×</button>
        </div>`;
}

/**
 * ガチャID入力フォームの表示
 */
function showIdInput() {
    const trigger = document.getElementById('add-id-trigger');
    if (!trigger) return;
    trigger.innerHTML = `<input type="text" id="direct-id-input" placeholder="ID" style="width:40px; font-size:10px;" onkeydown="if(event.key==='Enter') applyDirectId()">`;
    const input = document.getElementById('direct-id-input');
    input.focus();
    input.onblur = () => { setTimeout(() => { trigger.innerText = 'IDで追加'; }, 200); };
}

/**
 * 入力されたIDをガチャ列として追加
 */
function applyDirectId() {
    const input = document.getElementById('direct-id-input');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        // gachaMasterDataに存在するかチェック
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