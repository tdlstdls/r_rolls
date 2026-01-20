/** @file view_txt_route.js @description 計算ロジック解説テキスト・詳細計算過程ダンプ・消し込み機能版 */

// 計算過程表示モードの状態保持
let isDetailedLogMode = false;

/**
 * 現在のシミュレーションルートを生成して返す
 * @param {Array} seeds - 乱数シード配列
 * @param {number} initialSeed - 開始前シード値
 * @param {Object} highlightMap - テーブル描画時に計算されたハイライト済みインデックスのマップ
 * @returns {string} 生成されたHTML文字列
 */
function generateTxtRouteView(seeds, initialSeed, highlightMap) {
    const configInput = document.getElementById('sim-config');
    const configValue = configInput ? configInput.value.trim() : "";

    if (!configValue) {
        return `
            <div id="txt-route-container" class="description-box" style="margin-top:10px; padding:10px; background:#f9f9f9; border:1px solid #ddd;">
                <div id="txt-route-display" style="color:#999; font-size:11px;">ルートが入力されていません。</div>
            </div>
        `;
    }

    const segments = parseSimConfig(configValue);
    let currentIdx = 0;
    
    let trackStates = {
        lastA: null,
        lastB: null,
        lastAction: null
    };

    let segmentHtmlBlocks = [];

    // --- 計算方法の文章説明 (計算過程モードONの時のみ生成) ---
    let calculationGuideHtml = "";
    if (isDetailedLogMode) {
        calculationGuideHtml = `
            <div style="background: #fffbe6; border: 1px solid #ffe58f; padding: 12px; margin-bottom: 15px; border-radius: 4px; font-size: 11px; line-height: 1.6; color: #856404;">
                <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px; border-bottom: 1px solid #ffe58f; padding-bottom: 3px;">📖 ガチャ抽選ロジックの解説</div>
                <ol style="margin: 0; padding-left: 18px;">
                    <li><strong>レア度判定:</strong> 対象番地のSEED値を 10000 で割った剰余（余り）を計算し、設定された確率（レア：0～、激レア：N～、超激レア：M～ 等）と比較してレア度を決定します。</li>
                    <li><strong>キャラ判定:</strong> レア度決定後、<strong>「その次の番地（Index + 1）」</strong>のSEED値を使用します。その値を当該レアリティのキャラ総数（除数）で割った剰余によって、排出キャラが決定されます。</li>
                    <li><strong>レア被り再抽選:</strong> もし決定したキャラが、直前の同じトラックのキャラ、または直前のアクションと同じだった場合（レア度に関わらず）、さらに<strong>「その次の番地（Index + 2）」</strong>を使って再抽選を行い、同時にトラックが切り替わります。</li>
                    <li><strong>確定枠:</strong> 11連確定などの最終枠は、レア度判定をスキップし、その番地のSEED値を直接超激レアの総数で割った剰余でキャラを決定し、トラックを切り替えます。</li>
                </ol>
                <div style="margin-top: 5px; font-size: 10px; color: #b7811d;">※ 遷移先アドレスは、レア被りが発生すると通常の +1 ではなく +2 以上消費されるため、番地が飛びます。</div>
            </div>
        `;
    }

    segments.forEach((seg, sIdx) => {
        const config = gachaMasterData.gachas[seg.id];
        if (!config) return;

        const segmentStartAddr = formatTxtAddress(currentIdx);
        let rollsToPerform = seg.rolls;
        let isGuaranteed = false;

        if (seg.g) {
            if (seg.rolls === 15) { rollsToPerform = 14; isGuaranteed = true; }
            else if (seg.rolls === 7) { rollsToPerform = 6; isGuaranteed = true; }
            else if (seg.rolls === 11) { rollsToPerform = 10; isGuaranteed = true; }
            else { rollsToPerform = Math.max(0, seg.rolls - 1); isGuaranteed = true; }
        }

        let gachaName = config.name || `ガチャID:${seg.id}`;
        let segTitle = seg.g ? `${seg.rolls}連確定` : `${seg.rolls}回`;

        let blockLines = [];
        blockLines.push(`
            <div id="txt-seg-${sIdx}" class="txt-seg-wrapper" style="margin-bottom: 15px; transition: opacity 0.3s;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 6px; border-bottom: 1px dashed #ddd; padding-bottom: 3px;">
                    <input type="checkbox" id="chk-seg-${sIdx}" onclick="toggleTxtSegment(${sIdx})" style="margin-right: 8px; transform: scale(1.2); cursor: pointer;">
                    <label for="chk-seg-${sIdx}" style="color:#17a2b8; font-weight:bold; cursor: pointer; line-height: 1.4;">
                        ${String(sIdx + 1).padStart(2, ' ')}. 【${gachaName}】 ${segTitle}
                    </label>
                </div>
                <div class="txt-seg-content" style="padding-left: 24px;">`);

        for (let i = 0; i < rollsToPerform; i++) {
            if (currentIdx >= seeds.length) break;

            const isTrackB = (currentIdx % 2 !== 0);
            const isHighlighted = highlightMap && (highlightMap[currentIdx] !== undefined || highlightMap[String(currentIdx)] !== undefined);
            const addr = formatTxtAddress(currentIdx);
            let errorMsg = "";
            if (!isHighlighted) {
                errorMsg = `<span style="background: #ffcccc; color: #d9534f; padding: 0 4px; border-radius: 2px; font-weight: bold; margin-left: 5px; font-size:10px;">[Error: 経路不整合 (Idx:${currentIdx})]</span>`;
            }

            const drawAbove = isTrackB ? trackStates.lastB : trackStates.lastA;
            const drawContext = {
                originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
                finalIdSource: trackStates.lastAction ? String(trackStates.lastAction.charId) : null
            };

            const rr = rollWithSeedConsumptionFixed(currentIdx, config, seeds, drawContext);
            if (rr.seedsConsumed === 0) break;

            const decoratedName = decorateCharNameHtml(rr.charId, rr.rarity, rr.finalChar.name);
            let line = `<div style="margin-bottom: 4px;">(${String(i + 1).padStart(2, ' ')})  <span style="color:#888;">${addr}</span>  ${decoratedName}${errorMsg}`;
            if (rr.isRerolled) line += ` <span style="color:#d9534f; font-weight:bold;">(被り)</span>`;
            
            if (isDetailedLogMode) {
                line += generateDetailedLogHtml(currentIdx, seeds, config, rr, isTrackB);
            }
            line += `</div>`;
            blockLines.push(line);

            const result = { rarity: rr.rarity, charId: rr.charId, trackB: isTrackB };
            if (isTrackB) trackStates.lastB = result; else trackStates.lastA = result;
            trackStates.lastAction = result;
            currentIdx += rr.seedsConsumed;
        }

        if (isGuaranteed && currentIdx < seeds.length) {
            const isTrackB = (currentIdx % 2 !== 0);
            const gr = rollGuaranteedUber(currentIdx, config, seeds);
            const guaranteedAddr = segmentStartAddr + "G";
            const isHighlighted = highlightMap && (highlightMap[currentIdx] !== undefined || highlightMap[String(currentIdx)] !== undefined);
            let errorMsg = !isHighlighted ? `<span style="background: #ffcccc; color: #d9534f; padding: 0 4px; border-radius: 2px; font-weight: bold; margin-left: 5px; font-size:10px;">[Error: 経路不整合 (Idx:${currentIdx})]</span>` : "";

            const decoratedName = decorateCharNameHtml(gr.charId, 'uber', gr.finalChar.name);
            let line = `<div style="margin-bottom: 4px;"><span style="color:#d9534f; font-weight:bold;">(確定)</span>  <span style="color:#888;">${guaranteedAddr}</span>  ${decoratedName} <span style="color:#d9534f; font-weight:bold;">（確定）</span>${errorMsg}`;
            
            if (isDetailedLogMode) {
                line += generateDetailedLogHtml(currentIdx, seeds, config, gr, isTrackB, true);
            }
            line += `</div>`;
            blockLines.push(line);

            const result = { rarity: 'uber', charId: gr.charId, trackB: isTrackB };
            if (isTrackB) trackStates.lastB = result; else trackStates.lastA = result;
            trackStates.lastAction = result;
            currentIdx += gr.seedsConsumed;
        }

        blockLines.push(`</div></div>`);
        segmentHtmlBlocks.push(blockLines.join(''));
    });

    const finalSeed = (currentIdx < seeds.length) ? seeds[currentIdx] : "---";
    const footerHtml = `
        <div style="margin-top:15px; padding-top:10px; border-top: 1px solid #ccc;">
            <div style="font-weight:bold;">最終地点: <span style="color:#17a2b8;">${formatTxtAddress(currentIdx)}</span></div>
            <div style="font-weight:bold;">最終シード: <span style="color:#17a2b8; border-bottom:1px solid #17a2b8;">${finalSeed}</span></div>
            <div style="color:#666; font-size:10px; margin-top:5px;">※最終シードは次回の「開始前シード」となります。</div>
        </div>
    `;

    return `
        <style>
            .txt-seg-wrapper.is-checked { text-decoration: line-through; opacity: 0.3; }
            .txt-seg-wrapper.is-checked .txt-seg-content span, 
            .txt-seg-wrapper.is-checked label { color: #888 !important; background: transparent !important; border: none !important; }
            .detailed-log { font-size: 10px; color: #666; background: #f8f8f8; padding: 8px; margin: 6px 0 10px 15px; border-radius: 4px; border-left: 4px solid #ddd; font-family: 'Consolas', monospace; line-height: 1.5; }
            .detailed-log span { color: #d9534f; font-weight: bold; }
            .detailed-log .seed-val { color: #2e7d32; }
            .detailed-log .idx-val { color: #0056b3; }
        </style>
        <div id="txt-route-container" class="description-box" style="margin-top:10px; padding:10px; background:#fdfdfd; border:1px solid #ddd; border-left: 4px solid #17a2b8; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom: 1px solid #eee; padding-bottom: 5px; flex-wrap: wrap; gap: 10px;">
                <span style="font-weight:bold; font-size:12px; color: #17a2b8;">
                    <span style="margin-right:5px;">📝</span>シミュレーションルート
                </span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label style="font-size: 11px; cursor: pointer; display: flex; align-items: center; background: #eee; padding: 2px 8px; border-radius: 4px;">
                        <input type="checkbox" ${isDetailedLogMode ? 'checked' : ''} onchange="toggleDetailedLogMode(this.checked)" style="margin-right: 4px;">
                        計算過程を表示
                    </label>
                    <button onclick="copyTxtToClipboard()" style="padding:2px 10px; font-size:10px; background:#17a2b8; color:white; border-radius:3px; border:none; cursor:pointer;">コピー</button>
                </div>
            </div>
            <div id="txt-route-display" style="background:#fff; border:1px solid #eee; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size:11px; padding:10px; max-height:550px; overflow-y:auto; line-height:1.6; color:#333;">
                ${calculationGuideHtml}
                <div style="margin-bottom:10px; color:#555; font-weight: bold;">開始前シード: ${initialSeed}</div>
                ${segmentHtmlBlocks.join('')}
                ${footerHtml}
            </div>
        </div>
    `;
}

/**
 * 計算過程のHTMLを生成する
 */
function generateDetailedLogHtml(idx, seeds, config, rr, isTrackB, isGuaranteed = false) {
    const rarityMod = 10000;
    const seedRarity = seeds[idx];
    const rarityRem = seedRarity % rarityMod;
    
    const poolKeyMap = {
        'rare': 'rare',
        'super': 'super',
        'super_rare': 'super',
        'uber': 'uber',
        'legend': 'legend'
    };
    
    let html = `<div class="detailed-log">`;
    
    if (isGuaranteed) {
        const pool = config['uber'] || [];
        const count = pool.length || 1;
        const charRem = seedRarity % count;
        html += `【確定抽選】<br>`;
        html += `SEEDインデックス: <span class="idx-val">${idx}</span> | SEED値: <span class="seed-val">${seedRarity}</span><br>`;
        html += `除数 (キャラ数): <span>${count}</span> | 剰余: <span>${charRem}</span><br>`;
    } else {
        const rarityKey = poolKeyMap[rr.rarity] || rr.rarity;
        const pool = config[rarityKey] || [];
        const count = pool.length || 1;
        
        html += `【レア度判定】<br>`;
        html += `SEEDインデックス: <span class="idx-val">${idx}</span> | SEED値: <span class="seed-val">${seedRarity}</span><br>`;
        html += `除数: <span>${rarityMod}</span> | 剰余: <span>${rarityRem}</span> (レア度: <span>${rr.rarity}</span>)<br>`;
        
        html += `【キャラ抽選】<br>`;
        if (rr.isRerolled) {
            const idx1 = idx + 1;
            const seed1 = seeds[idx1];
            const rem1 = seed1 % count;
            html += `1回目 - SEEDインデックス: <span class="idx-val">${idx1}</span> | SEED値: <span class="seed-val">${seed1}</span> | 剰余: <span>${rem1}</span> (被り発生)<br>`;
            
            const idx2 = idx + 2;
            const seed2 = seeds[idx2];
            const rem2 = seed2 % count;
            html += `再抽選 - SEEDインデックス: <span class="idx-val">${idx2}</span> | SEED値: <span class="seed-val">${seed2}</span> | 除数: <span>${count}</span> | 剰余: <span>${rem2}</span><br>`;
        } else {
            const idxChar = idx + 1;
            const seedChar = seeds[idxChar];
            const remChar = seedChar % count;
            html += `SEEDインデックス: <span class="idx-val">${idxChar}</span> | SEED値: <span class="seed-val">${seedChar}</span> | 除数: <span>${count}</span> | 剰余: <span>${remChar}</span><br>`;
        }
    }
    
    html += `遷移先アドレス: <span>${formatTxtAddress(idx + rr.seedsConsumed)}</span>`;
    html += `</div>`;
    return html;
}

/**
 * 計算過程表示モードを切り替えてテーブルを再描画する
 */
function toggleDetailedLogMode(checked) {
    isDetailedLogMode = checked;
    if (typeof resetAndGenerateTable === 'function') {
        resetAndGenerateTable();
    }
}

/**
 * セグメントのチェック状態を切り替える
 */
function toggleTxtSegment(index) {
    const wrapper = document.getElementById(`txt-seg-${index}`);
    const checkbox = document.getElementById(`chk-seg-${index}`);
    if (wrapper && checkbox) {
        if (checkbox.checked) wrapper.classList.add('is-checked');
        else wrapper.classList.remove('is-checked');
    }
}

/**
 * キャラクター名の装飾
 */
function decorateCharNameHtml(charId, rarity, baseName) {
    let name = baseName || "不明";
    const cid = Number(charId);
    let style = "font-weight:bold;";
    let prefix = "";
    let suffix = "";

    let isTarget = (typeof targetCharIds !== 'undefined' && targetCharIds.includes(cid));

    if (rarity === 'legend') {
        style += "color:#e91e63; background: #fce4ec; padding: 0 2px; border-radius: 2px;";
        prefix = "【伝説レア】";
    } else if (rarity === 'uber') {
        style += "color:#e67e22;";
        prefix = "[超激レア]";
    } else {
        style += "color:#333;";
    }

    if (typeof isLimitedCat === 'function' && isLimitedCat(cid)) {
        suffix = " <span style='font-size:10px; color:#3498db;'>(限定)</span>";
    }

    if (isTarget) {
        prefix = "<span style='color:#f1c40f;'>★</span>" + prefix;
        style += "border-bottom: 2px solid #f1c40f;";
    }

    return `<span style="${style}">${prefix}${name}</span>${suffix}`;
}

/**
 * 番地フォーマット
 */
function formatTxtAddress(index) {
    if (index === null || index === undefined || index < 0) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}