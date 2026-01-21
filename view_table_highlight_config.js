/** @file view_table_highlight_config.js @description 確定ステップの判定とロール数調整 */

/**
 * 確定ステップの判定とロール数の調整を行う
 * @param {Object} sim - シミュレーション設定オブジェクト
 * @returns {Object} { normalRolls: number, isGuaranteedStep: boolean }
 */
function calculateRollConfiguration(sim) {
    let normalRolls = sim.rolls;
    let isGuaranteedStep = false;

    if (sim.g) {
        if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
        else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
        else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
        else { normalRolls = Math.max(0, sim.rolls - 1); isGuaranteedStep = true; }
    }

    return { normalRolls, isGuaranteedStep };
}