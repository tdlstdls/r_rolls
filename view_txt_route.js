/** @file view_txt_route.js @description 属性強調（カラー装飾版：伝説/超激/限定/ターゲット対応） */

/**
 * 現在のシミュレーションルートをカラー装飾付きのHTML形式で生成して返す
 * @param {Array} seeds - 乱数シード配列
 * @param {number} initialSeed - 開始前シード値
 * @returns {string} 生成されたHTML文字列
 */
function generateTxtRouteView(seeds, initialSeed) {
    const configInput = document.getElementById('sim-config');
    const configValue = configInput ? configInput.value.trim() : "";

    if (!configValue) {
        return `
            <div id="txt-route-container" class="description-box" style="margin-top:10px; padding:10px; background:#f9f9f9; border:1px solid #ddd;">
                <div id="txt-route-display" style="color:#999; font-size:11px;">ルートが入力されていません。SimモードをONにし、表のキャラ名をタップしてルートを生成してください。</div>
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

    let outputLines = [];
    outputLines.push(`<span style="color:#333; font-weight:bold;">■ R_Rolls 経路詳細レポート</span>`);
    outputLines.push(`開始前シード: <span style="color:#555;">${initialSeed}</span>`);
    outputLines.push(`<span style="color:#ccc;">--------------------------------------------------</span>`);

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

        let gachaName = config.name;
        let segTitle = seg.g ? `${seg.rolls}連確定` : `${seg.rolls}回`;
        outputLines.push(`<span style="color:#17a2b8; font-weight:bold;">${String(sIdx + 1).padStart(2, ' ')}. 【${gachaName}】 ${segTitle}</span>`);

        // --- 1. 通常枠のシミュレーション ---
        for (let i = 0; i < rollsToPerform; i++) {
            if (currentIdx >= seeds.length) break;

            const isTrackB = (currentIdx % 2 !== 0);
            const drawAbove = isTrackB ? trackStates.lastB : trackStates.lastA;
            const drawContext = {
                originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
                finalIdSource: trackStates.lastAction ? String(trackStates.lastAction.charId) : null
            };

            const rr = rollWithSeedConsumptionFixed(currentIdx, config, seeds, drawContext);
            if (rr.seedsConsumed === 0) break;

            const addr = formatTxtAddress(currentIdx);
            const decoratedName = decorateCharNameHtml(rr.charId, rr.rarity, rr.finalChar.name);
            
            let line = `   (${String(i + 1).padStart(2, ' ')})  <span style="color:#888;">${addr}</span>  ${decoratedName}`;
            
            if (rr.isRerolled) {
                line += ` <span style="color:#d9534f; font-weight:bold;">(被り)</span>`;
            }
            outputLines.push(line);

            const result = { rarity: rr.rarity, charId: rr.charId, trackB: isTrackB };
            if (isTrackB) trackStates.lastB = result; else trackStates.lastA = result;
            trackStates.lastAction = result;

            currentIdx += rr.seedsConsumed;
        }

        // --- 2. 確定枠のシミュレーション ---
        if (isGuaranteed && currentIdx < seeds.length) {
            const isTrackB = (currentIdx % 2 !== 0);
            const gr = rollGuaranteedUber(currentIdx, config, seeds);
            const guaranteedAddr = segmentStartAddr + "G";
            
            const decoratedName = decorateCharNameHtml(gr.charId, 'uber', gr.finalChar.name);
            outputLines.push(`   <span style="color:#d9534f; font-weight:bold;">(確定)</span>  <span style="color:#888;">${guaranteedAddr}</span>  ${decoratedName} <span style="color:#d9534f; font-weight:bold;">（確定）</span>`);

            const result = { rarity: 'uber', charId: gr.charId, trackB: isTrackB };
            if (isTrackB) trackStates.lastB = result; else trackStates.lastA = result;
            trackStates.lastAction = result;

            currentIdx += gr.seedsConsumed;
        }
        
        outputLines.push(``);
    });

    outputLines.push(`<span style="color:#ccc;">--------------------------------------------------</span>`);
    const finalSeed = (currentIdx < seeds.length) ? seeds[currentIdx] : "---";
    outputLines.push(`<span style="font-weight:bold;">最終地点:</span> <span style="color:#17a2b8;">${formatTxtAddress(currentIdx)}</span>`);
    outputLines.push(`<span style="font-weight:bold;">最終シード:</span> <span style="color:#17a2b8; border-bottom:1px solid #17a2b8;">${finalSeed}</span>`);
    outputLines.push(``);
    outputLines.push(`<span style="color:#666; font-size:10px;">※最終シードは次回の「開始前シード」となります。</span>`);
    outputLines.push(`<span style="color:#666; font-size:10px;">※この値がURLパラメータの seed= に反映されます。</span>`);

    return `
        <div id="txt-route-container" class="description-box" style="margin-top:10px; padding:10px; background:#fdfdfd; border:1px solid #ddd; border-left: 4px solid #17a2b8; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <span style="font-weight:bold; font-size:12px; color: #17a2b8;">
                    <span style="margin-right:5px;">📝</span>シミュレーションルート (詳細レポート)
                </span>
                <button onclick="copyTxtToClipboard()" style="padding:2px 10px; font-size:10px; background:#17a2b8; color:white; border-radius:3px; border:none; cursor:pointer;">テキストをコピー</button>
            </div>
            <div id="txt-route-display" style="background:#fff; border:1px solid #eee; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size:11px; white-space:pre-wrap; padding:10px; max-height:450px; overflow-y:auto; line-height:1.5; color:#333;">${outputLines.join('\n')}</div>
        </div>
    `;
}

/**
 * キャラクター名に属性に応じたカラー装飾（HTML）を施す
 * @param {number|string} charId - キャラクターID
 * @param {string} rarity - レアリティ ('legend', 'uber', etc.)
 * @param {string} baseName - 基本キャラクター名
 * @returns {string} 装飾済み（HTML）キャラクター名
 */
function decorateCharNameHtml(charId, rarity, baseName) {
    let name = baseName || "不明";
    const cid = Number(charId);
    
    let style = "font-weight:bold;";
    let prefix = "";
    let suffix = "";

    // 1. Findターゲット (ユーザーが選択したキャラ)
    let isTarget = (typeof targetCharIds !== 'undefined' && targetCharIds.includes(cid));

    // 2. レアリティ別配色
    if (rarity === 'legend') {
        style += "color:#e91e63; background: #fce4ec; padding: 0 2px; border-radius: 2px;"; // 濃いピンク
        prefix = "【伝説レア】";
    } else if (rarity === 'uber') {
        style += "color:#e67e22;"; // オレンジ
        prefix = "[超激レア]";
    } else {
        style += "color:#333;"; // 通常
    }

    // 3. 限定キャラ
    if (typeof isLimitedCat === 'function' && isLimitedCat(cid)) {
        suffix = " <span style='font-size:10px; color:#3498db;'>(限定)</span>";
    }

    // 4. ターゲット強調（★）
    if (isTarget) {
        prefix = "<span style='color:#f1c40f;'>★</span>" + prefix;
        style += "border-bottom: 2px solid #f1c40f;";
    }

    return `<span style="${style}">${prefix}${name}</span>${suffix}`;
}

/**
 * テキスト表示用の番地フォーマット補助関数
 */
function formatTxtAddress(index) {
    if (index === null || index === undefined || index < 0) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}