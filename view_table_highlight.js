/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算（確定枠・トラック遷移・物理配置完全同期版） */

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

    // テーブルのシミュレーション（view_table_data.js）および探索エンジンと完全に同期するため、
    // トラックごとの物理的な「直上」の状態を独立して保持します。
    let lastDrawA = null;
    let lastDrawB = null;
    
    // 直前に「実際に引いた」ロールの状態（トラック遷移の起点となる情報）
    let lastRollState = null;

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;

        // 確定枠設定（11G/15G/7G等）の判定
        if (sim.g) {
            if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
            else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
            else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
            else { normalRolls = Math.max(0, sim.rolls - 1); isGuaranteedStep = true; }
        }

        // 通常ロール（確定枠に達するまでのロールを含む）の処理
        for (let k = 0; k < normalRolls; k++) {
            // 表示範囲外（生成行数×2）を超えた場合は計算のみ継続し、ハイライト登録は行わない
            const canHighlight = currentSeedIndex < numRolls * 2;
            const isTrackB = (currentSeedIndex % 2 !== 0);

            // 1. 物理的な「直上のセル」のキャラIDを特定（レア被り判定に必須）
            // テーブル描画ロジックと一致させるため、現在のセルの物理的直上（index - 2）を参照
            let originalIdAbove = null;
            if (currentSeedIndex >= 2) {
                const s0_above = seeds[currentSeedIndex - 2];
                const s1_above = seeds[currentSeedIndex - 1];
                const rates = config.rarity_rates || { rare: 6970, super: 2500, uber: 500, legend: 30 };
                const rarityAbove = determineRarity(s0_above, rates);
                const poolAbove = config.pool[rarityAbove] || [];
                if (poolAbove.length > 0) {
                    originalIdAbove = String(poolAbove[s1_above % poolAbove.length].id);
                }
            }

            // 2. 判定コンテキストの構築
            // originalIdAbove: 物理チェック用 / finalIdSource: 遷移元チェック用
            const drawContext = {
                originalIdAbove: originalIdAbove,
                finalIdSource: lastRollState ? String(lastRollState.charId) : null
            };

            if (canHighlight) {
                // 確定枠セグメントの最初の位置なら確定枠用ハイライト、それ以外は通常ハイライト
                if (isGuaranteedStep && k === 0) {
                    guarHighlightMap.set(currentSeedIndex, sim.id);
                } else {
                    highlightMap.set(currentSeedIndex, sim.id);
                }
            }

            // 3. ロールの実行と状態更新
            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext);
            if (rr.seedsConsumed === 0) break;

            const resultState = {
                rarity: rr.rarity,
                charId: String(rr.charId),
                originalCharId: rr.originalChar ? String(rr.originalChar.id) : String(rr.charId),
                trackB: isTrackB
            };

            // 各トラックの物理履歴と、直近の遷移元状態を更新
            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            const consumed = rr.seedsConsumed;
            currentSeedIndex += consumed;
            
            // Txtモード表示用の乱数状態を同期
            for (let x = 0; x < consumed; x++) rngForText.next();
        }

        // 確定枠（超激レア）の実行
        if (isGuaranteedStep && currentSeedIndex < seeds.length) {
            const isTrackB = (currentSeedIndex % 2 !== 0);
            const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
            
            const resultState = { 
                rarity: 'uber', 
                charId: String(gr.charId), 
                originalCharId: String(gr.charId),
                trackB: isTrackB
            };

            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            currentSeedIndex += gr.seedsConsumed;
            for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
        }
    }

    // 最終的なSEED値を保持（Txtモード等での継続計算用）
    lastSeedValue = rngForText.seed;

    return { highlightMap, guarHighlightMap, lastSeedValue };
}