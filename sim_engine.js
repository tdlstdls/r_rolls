/** @file sim_engine.js @description 経路探索の統合制御・インターフェース */

/**
 * 経路探索エントリポイント
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    const simSeeds = generateSeedsForSim(targetSeedIndex);
    const { startIdx, initialLastDraw, baseConfigStr } = calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds);
    
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);

    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    if (!route && maxGuar > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, maxGuar);
    if (!route && maxPlat > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar);

    if (route) {
        if (finalActionOverride) route.push(finalActionOverride);
        else route.push({ id: targetGachaId.replace(/[gfs]$/, ""), rolls: 1, fullId: targetGachaId });
        return (baseConfigStr ? baseConfigStr + " " : "") + compressRoute(route);
    }
    return null;
}

function generateSeedsForSim(targetSeedIndex) {
    const seedEl = document.getElementById('seed');
    const initialSeed = parseInt(seedEl ? seedEl.value : 12345);
    const rng = new Xorshift32(initialSeed);
    const tempSeeds = [];
    const limit = Math.max(targetSeedIndex, 1000) + 500;
    for (let i = 0; i < limit; i++) tempSeeds.push(rng.next());
    return tempSeeds;
}

function calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds) {
    let startIdx = 0, initialLastDraw = null, validConfigParts = [];
    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0, tempLastDraw = null;
        for (const segment of existingConfigs) {
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);
            if (res.nextIndex > targetSeedIndex) break;
            validConfigParts.push(segment);
            tempIdx = res.nextIndex; 
            tempLastDraw = res.lastDraw;
            if (tempIdx === targetSeedIndex) break;
        }
        startIdx = tempIdx; 
        initialLastDraw = tempLastDraw;
    }
    return { startIdx, initialLastDraw, baseConfigStr: stringifySimConfig(validConfigParts) };
}