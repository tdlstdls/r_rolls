/** @file view_table_highlight.js @description シミュレーションモードのルートハイライト計算 */

function preparePathHighlightMaps(initialSeed, seeds, numRolls) {
    const highlightMap = new Map();
    const guarHighlightMap = new Map();
    let lastSeedValue = null;

    if (!isSimulationMode) return { highlightMap, guarHighlightMap, lastSeedValue };

    const simConfigEl = document.getElementById('sim-config');
    if (!simConfigEl || !simConfigEl.value.trim()) return { highlightMap, guarHighlightMap, lastSeedValue };

    const simConfigs = parseSimConfig(simConfigEl.value.trim());
    let rngForText = new Xorshift32(initialSeed);
    let currentSeedIndex = 0;
    let lastDrawForHighlight = { rarity: null, charId: null };

    for (const sim of simConfigs) {
        const config = gachaMasterData.gachas[sim.id];
        if (!config) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;
        if (sim.g) {
            if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
            else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
            else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
            else { normalRolls = sim.rolls; }
        }

        if (isGuaranteedStep) {
            const startSeedIndex = currentSeedIndex;
            guarHighlightMap.set(startSeedIndex, sim.id);
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;
                highlightMap.set(currentSeedIndex, sim.id);
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, lastDrawForHighlight);
                if (rr.seedsConsumed === 0) break;
                lastDrawForHighlight = { rarity: rr.rarity, charId: rr.charId };
                currentSeedIndex += rr.seedsConsumed;
                for (let x = 0; x < rr.seedsConsumed; x++) rngForText.next();
            }
            if (startSeedIndex < numRolls * 2) highlightMap.set(`${startSeedIndex}G`, sim.id);
            if (currentSeedIndex < seeds.length) {
                const gr = rollGuaranteedUber(currentSeedIndex, config, seeds);
                currentSeedIndex += gr.seedsConsumed;
                for (let x = 0; x < gr.seedsConsumed; x++) rngForText.next();
            }
        } else {
            for (let k = 0; k < normalRolls; k++) {
                if (currentSeedIndex >= numRolls * 2) break;
                highlightMap.set(currentSeedIndex, sim.id);
                const rr = rollWithSeedConsumptionFixed(currentSeedIndex, config, seeds, lastDrawForHighlight);
                if (rr.seedsConsumed === 0) break;
                lastDrawForHighlight = { rarity: rr.rarity, charId: rr.charId };
                currentSeedIndex += rr.seedsConsumed;
                for (let x = 0; x < rr.seedsConsumed; x++) rngForText.next();
            }
        }
    }
    lastSeedValue = rngForText.seed;
    return { highlightMap, guarHighlightMap, lastSeedValue };
}