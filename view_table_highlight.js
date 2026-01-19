/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算（確定枠・トラック遷移・物理配置完全同期版） */

/**
 * シミュレーション設定（ルート）に基づき、テーブル上でハイライトすべきセルのマップを作成する
 * @param {number} initialSeed - 開始SEED
 * @param {Array} seeds - 乱数シード配列
 * @param {number} numRolls - 表示行数
 * @returns {Object} highlightMap(通常枠用), guarHighlightMap(確定枠用), lastSeedValue(最終SEED)
 */
function preparePathHighlightMaps(initialSeed, seeds, numRolls) {
    const highlightMap = new Map();
    const guarHighlightMap = new Map();
    let lastSeedValue = null;

    // シミュレーションモードでない、またはルートが空の場合は空のマップを返す
    if (!isSimulationMode) return { highlightMap, guarHighlightMap, lastSeedValue };

    const simConfigEl = document.getElementById('sim-config');
    if (!simConfigEl || !simConfigEl.value.trim()) return { highlightMap, guarHighlightMap, lastSeedValue };

    // Sim設定文字列（例: 1006-5-942-11g）をパースしてセグメント配列を取得
    const simConfigs = parseSimConfig(simConfigEl.value.trim());
    let rngForText = new Xorshift32(initialSeed);
    let currentSeedIndex = 0;

    // 物理的な「直上のセル」の状態をトラック別に保持
    let lastDrawA = null;
    let lastDrawB = null;
    // 遷移元（直前に実際に引いたロール）の状態
    let lastRollState = null;

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;

        // 確定枠設定（11G/15G/7G等）の判定と、通常枠として計算する回数の調整
        if (sim.g) {
            if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
            else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
            else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
            else { normalRolls = Math.max(0, sim.rolls - 1); isGuaranteedStep = true; }
        }

        // --- 1. 通常ロール部分のシミュレーション ---
        for (let k = 0; k < normalRolls; k++) {
            if (currentSeedIndex >= seeds.length) break;

            const isTrackB = (currentSeedIndex % 2 !== 0);
            const canHighlight = currentSeedIndex < numRolls * 2;

            // 物理的な「直上のセル」のキャラIDを特定（logic_duplicate.js でのレア被り判定に必要）
            const drawAbove = isTrackB ? lastDrawB : lastDrawA;

            // 判定コンテキストの構築
            const drawContext = {
                // 物理的な直上のID（テーブル上での縦の並び）
                originalIdAbove: drawAbove ? String(drawAbove.charId) : null,
                // 実際に直前に引いたID（インデックスの線形的な繋がり）
                finalIdSource: lastRollState ? String(lastRollState.charId) : null
            };

            // ハイライトマップへの登録（表示範囲内のみ）
            if (canHighlight) {
                // 確定枠セグメントの最初の1個目は、ユーザーへの視認性のために確定枠用マップ（guarHighlightMap）に登録
                if (isGuaranteedStep && k === 0) {
                    guarHighlightMap.set(currentSeedIndex, sim.id);
                } else {
                    highlightMap.set(currentSeedIndex, sim.id);
                }
            }

            // ロールの実行（logic_roll_core.js を使用）
            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, drawContext);
            if (rr.seedsConsumed === 0) break;

            const resultState = {
                rarity: rr.rarity,
                charId: String(rr.charId), // 再抽選後であれば、その後のIDを保持
                originalCharId: rr.originalChar ? String(rr.originalChar.id) : String(rr.charId),
                trackB: isTrackB
            };

            // 各トラックの物理履歴と、全体の直近アクション状態を更新
            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            // インデックスの線形移動
            const consumed = rr.seedsConsumed;
            currentSeedIndex += consumed;

            // Txtモード等での整合性のため、乱数生成器も同期させる
            for (let x = 0; x < consumed; x++) rngForText.next();
        }

        // --- 2. 確定枠（最後の1回）の処理 ---
        if (isGuaranteedStep && currentSeedIndex < seeds.length) {
            const isTrackB = (currentSeedIndex % 2 !== 0);
            
            // 確定枠の実行
            const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
            
            const resultState = { 
                rarity: 'uber', 
                charId: String(gr.charId), 
                originalCharId: String(gr.charId),
                trackB: isTrackB
            };

            // 状態の更新
            if (isTrackB) lastDrawB = resultState;
            else lastDrawA = resultState;
            lastRollState = resultState;

            // 確定枠は1シード消費
            currentSeedIndex += gr.seedsConsumed;
            for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
        }
    }

    // 次のロール開始に使用できるシード値を保持
    lastSeedValue = rngForText.seed;

    return { highlightMap, guarHighlightMap, lastSeedValue };
}