/** @file sim_engine_core.js @description 単一セグメントのシミュレーション実行 */

/**
 * 単一セグメントのシミュレーション
 */
function simulateSingleSegment(sim, currentIdx, currentLastDraw, seeds) {
    const conf = gachaMasterData.gachas[sim.id];
    if (!conf) return { nextIndex: currentIdx, lastDraw: currentLastDraw };

    let normalRolls = sim.rolls;
    let isGuaranteedStep = false;
    let tempIdx = currentIdx;
    let tempLastDraw = currentLastDraw;

    if (sim.g) {
        if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
        else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
        else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
        else { normalRolls = sim.rolls; }
    }

    for (let k = 0; k < normalRolls; k++) {
        if (tempIdx >= seeds.length - 5) break;
        const rr = rollWithSeedConsumptionFixed(tempIdx, conf, seeds, tempLastDraw);
        if (rr.seedsConsumed === 0) break;
        
        tempLastDraw = { 
            rarity: rr.rarity, 
            charId: rr.charId, 
            originalCharId: rr.originalChar ? rr.originalChar.id : rr.charId,
            isRerolled: rr.isRerolled,
            lastRerollSlot: rr.lastRerollSlot,
            fromRerollRoute: rr.isRerolled 
        };
        tempIdx += rr.seedsConsumed;
    }
    
    if (isGuaranteedStep && tempIdx < seeds.length) {
        if (typeof rollGuaranteedUber !== 'undefined') {
            const gr = rollGuaranteedUber(tempIdx, conf, seeds);
            tempIdx += gr.seedsConsumed;
            tempLastDraw = { 
                rarity: 'uber', charId: gr.charId, originalCharId: gr.charId,
                isRerolled: false, lastRerollSlot: null, fromRerollRoute: false
            };
        }
    }
    return { nextIndex: tempIdx, lastDraw: tempLastDraw };
}