/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算（確定枠・トラック遷移修正版） */

/**
 * シミュレーション設定に基づき、テーブル上でハイライトすべきセルのマップを作成する
 */
function preparePathHighlightMaps(initialSeed, seeds, numRolls) {
    const highlightMap = new Map();
    const guarHighlightMap = new Map();
    let lastSeedValue = null;

    if (!isSimulationMode) return { highlightMap, guarHighlightMap, lastSeedValue };
    
    const simConfigEl = document.getElementById('sim-config');
    if (!simConfigEl || !simConfigEl.value.trim()) return { highlightMap, guarHighlightMap, lastSeedValue };

    // Sim設定文字列をパース
    const simConfigs = parseSimConfig(simConfigEl.value.trim());
    let rngForText = new Xorshift32(initialSeed);
    let currentSeedIndex = 0;
    
    // テーブルのシミュレーション（view_table_data.js）と完全に同期するため、
    // トラックごとの物理的な「直上」の状態を保持します。
    let lastDrawA = null;
    let lastDrawB = null;
    let lastRollState = null;

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;
        
        // 確定枠設定の判定
        if (sim.g) {
            if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
            else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
            else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
            else { normalRolls = sim.rolls; }
        }

        if (isGuaranteedStep) {
            // 確定枠セルのハイライト登録（このインデックスを開始地点として記録）
            if (currentSeedIndex < numRolls * 2) {
                guarHighlightMap.set(currentSeedIndex, sim.id);
            }
            
            // 確定枠に達するまでの通常ロール
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;
                
                const isTrackB = (currentSeedIndex % 2 !== 0);
                const physicalAbove = isTrackB ? lastDrawB : lastDrawA;
                
                // レア被り判定用コンテキスト：物理的な直上IDと、遷移元のIDを考慮
                const drawContext = {
                    originalIdAbove: physicalAbove ? physicalAbove.originalCharId : null,
                    finalIdSource: lastRollState ? lastRollState.charId : null
                };

                highlightMap.set(currentSeedIndex, sim.id);
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext);
                if (rr.seedsConsumed === 0) break;

                const resultState = {
                    rarity: rr.rarity,
                    charId: rr.charId,
                    originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId
                };

                // 各トラックの物理履歴と、直近の遷移元状態を更新
                if (isTrackB) lastDrawB = resultState; else lastDrawA = resultState;
                lastRollState = resultState;

                const consumed = rr.seedsConsumed;
                currentSeedIndex += consumed;
                for (let x = 0; x < consumed; x++) rngForText.next();
            }
            
            // 最後の確定枠（超激レア）の実行
            if (currentSeedIndex < seeds.length) {
                const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
                const resultState = { rarity: 'uber', charId: gr.charId, originalCharId: gr.charId };
                
                const isTrackB = (currentSeedIndex % 2 !== 0);
                if (isTrackB) lastDrawB = resultState; else lastDrawA = resultState;
                lastRollState = resultState;

                currentSeedIndex += gr.seedsConsumed;
                for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
            }
        } else {
            // 通常ロールセグメントの処理
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;

                const isTrackB = (currentSeedIndex % 2 !== 0);
                const physicalAbove = isTrackB ? lastDrawB : lastDrawA;
                
                const drawContext = {
                    originalIdAbove: physicalAbove ? physicalAbove.originalCharId : null,
                    finalIdSource: lastRollState ? lastRollState.charId : null
                };

                highlightMap.set(currentSeedIndex, sim.id);
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext);
                if (rr.seedsConsumed === 0) break;

                const resultState = {
                    rarity: rr.rarity,
                    charId: rr.charId,
                    originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId
                };

                if (isTrackB) lastDrawB = resultState; else lastDrawA = resultState;
                lastRollState = resultState;

                const consumed = rr.seedsConsumed;
                currentSeedIndex += consumed;
                for (let x = 0; x < consumed; x++) rngForText.next();
            }
        }
    }
    // 最終的なSEED値を保持（Txtモード等での継続計算用）
    lastSeedValue = rngForText.seed;
    return { highlightMap, guarHighlightMap, lastSeedValue };
}