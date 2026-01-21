/** @file view_table_highlight_guaranteed.js @description 確定枠の処理とハイライトマップ更新 */

/**
 * 確定枠の処理を実行し、ハイライトマップを更新する
 * @param {Object} params - 処理パラメータ
 * @param {number} params.currentSeedIndex - 現在のシードインデックス
 * @param {Object} params.config - ガチャ設定
 * @param {Array} params.seeds - 乱数シード配列
 * @param {string} params.simId - シミュレーションID
 * @param {Object} params.lastDrawA - Aトラックの前回抽選結果
 * @param {Object} params.lastDrawB - Bトラックの前回抽選結果
 * @param {Object} params.lastRollState - 前回のロール状態
 * @param {Object} params.maps - マップオブジェクト { logicPathMap }
 * @param {Xorshift32} params.rngForText - テキスト用乱数生成器
 * @returns {Object} { newSeedIndex: number, newLastDrawA: Object, newLastDrawB: Object, newLastRollState: Object }
 */
function processGuaranteedRoll(params) {
    let { currentSeedIndex, config, seeds, simId, lastDrawA, lastDrawB, 
          lastRollState, maps, rngForText } = params;

    const isTrackB = (currentSeedIndex % 2 !== 0);

    // 【検証用】確定枠そのものの位置も記録（Txtモードでのエラー防止）
    // ※ここでは guarHighlightMap には入れない（入れるとテーブルが光ってしまうため）
    maps.logicPathMap.set(currentSeedIndex, simId);

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

    return {
        newSeedIndex: currentSeedIndex,
        newLastDrawA: lastDrawA,
        newLastDrawB: lastDrawB,
        newLastRollState: lastRollState
    };
}