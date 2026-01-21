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

    const maps = { highlightMap, guarHighlightMap, logicPathMap };

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        const { normalRolls, isGuaranteedStep } = calculateRollConfiguration(sim);

        // 連続ロールの「開始インデックス」を保持
        const segmentStartIdx = currentSeedIndex;

        // 【テーブル表示用】確定枠がある場合、その「開始行」のG列を青く塗るために登録
        if (isGuaranteedStep && segmentStartIdx < numRolls * 2) {
            guarHighlightMap.set(segmentStartIdx, sim.id);
        }

        // --- 1. 通常ロール部分 ---
        const normalResult = processNormalRolls({
            currentSeedIndex,
            normalRolls,
            config,
            seeds,
            numRolls,
            simId: sim.id,
            lastDrawA,
            lastDrawB,
            lastRollState,
            maps,
            rngForText
        });
        
        currentSeedIndex = normalResult.newSeedIndex;
        lastDrawA = normalResult.newLastDrawA;
        lastDrawB = normalResult.newLastDrawB;
        lastRollState = normalResult.newLastRollState;

        // --- 2. 確定枠（最後の1回） ---
        if (isGuaranteedStep && currentSeedIndex < seeds.length) {
            const guaranteedResult = processGuaranteedRoll({
                currentSeedIndex,
                config,
                seeds,
                simId: sim.id,
                lastDrawA,
                lastDrawB,
                lastRollState,
                maps,
                rngForText
            });

            currentSeedIndex = guaranteedResult.newSeedIndex;
            lastDrawA = guaranteedResult.newLastDrawA;
            lastDrawB = guaranteedResult.newLastDrawB;
            lastRollState = guaranteedResult.newLastRollState;
        }
    }

    lastSeedValue = rngForText.seed;
    return { highlightMap, guarHighlightMap, logicPathMap, lastSeedValue };
}