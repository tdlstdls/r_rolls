/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算（表示・検証分離版） */

/**
 * シミュレーション設定（ルート）に基づき、テーブル用ハイライトと経路検証用データを生成する
 * @param {number} initialSeed - 開始前SEED
 * @param {Array} seeds - 乱数シード配列
 * @param {number} numRolls - 表示行数
 * @returns {Object} highlightMap, guarHighlightMap, logicPathMap, lastSeedValue
 */
function preparePathHighlightMaps(initialSeed, seeds, numRolls) {
    const highlightMap = new Map();     // テーブルの通常枠（緑）用
    const guarHighlightMap = new Map(); // テーブルの確定枠（青・開始行のみ）用
    const logicPathMap = new Map();     // Txtモードの経路整合性チェック（全通過点）用
    let lastSeedValue = null;

    if (!isSimulationMode) return { highlightMap, guarHighlightMap, logicPathMap, lastSeedValue };
    const simConfigEl = document.getElementById('sim-config');
    if (!simConfigEl || !simConfigEl.value.trim()) return { highlightMap, guarHighlightMap, logicPathMap, lastSeedValue };

    const simConfigs = parseSimConfig(simConfigEl.value.trim());
    let rngForText = new Xorshift32(initialSeed);
    let currentSeedIndex = 0;

    let lastDrawA = null;
    let lastDrawB = null;
    let lastRollState = null;

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;

        if (sim.g) {
            if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
            else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
            else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
            else { normalRolls = Math.max(0, sim.rolls - 1); isGuaranteedStep = true; }
        }

        // 連続ロールの「開始インデックス」を保持
        const segmentStartIdx = currentSeedIndex;

        // 【テーブル表示用】確定枠がある場合、その「開始行」のG列を青く塗るために登録
        if (isGuaranteedStep && segmentStartIdx < numRolls * 2) {
            guarHighlightMap.set(segmentStartIdx, sim.id);
        }

        // --- 1. 通常ロール部分 ---
        for (let k = 0; k < normalRolls; k++) {
            if (currentSeedIndex >= seeds.length) break;

            const isTrackB = (currentSeedIndex % 2 !== 0);
            
            // 【検証用】通過した全てのインデックスを記録（Txtモードでのエラー防止）
            logicPathMap.set(currentSeedIndex, sim.id);

            // 【テーブル表示用】通常列（A/B）を緑色にするために登録
            if (currentSeedIndex < numRolls * 2) {
                highlightMap.set(currentSeedIndex, sim.id);
            }

            const drawAbove = isTrackB ? lastDrawB : lastDrawA;
            const drawContext = {
                originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
                finalIdSource: lastRollState ? String(lastRollState.charId) : null
            };

            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext);
            if (rr.seedsConsumed === 0) break;

            const resultState = {
                rarity: rr.rarity,
                charId: String(rr.charId),
                trackB: isTrackB
            };

            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            const consumed = rr.seedsConsumed;
            currentSeedIndex += consumed;
            for (let x = 0; x < consumed; x++) rngForText.next();
        }

        // --- 2. 確定枠（最後の1回） ---
        if (isGuaranteedStep && currentSeedIndex < seeds.length) {
            const isTrackB = (currentSeedIndex % 2 !== 0);

            // 【検証用】確定枠そのものの位置も記録（Txtモードでのエラー防止）
            // ※ここでは guarHighlightMap には入れない（入れるとテーブルが光ってしまうため）
            logicPathMap.set(currentSeedIndex, sim.id);

            const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
            const resultState = { 
                rarity: 'uber', 
                charId: String(gr.charId), 
                trackB: isTrackB
            };

            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            currentSeedIndex += gr.seedsConsumed;
            for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
        }
    }

    lastSeedValue = rngForText.seed;
    return { highlightMap, guarHighlightMap, logicPathMap, lastSeedValue };
}