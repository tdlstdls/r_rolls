/** @file sim_engine.js @description 経路探索・シミュレーションエンジン */

/** 単一セグメントのシミュレーション [cite: 291-301] */
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

    for(let k=0; k < normalRolls; k++) {
        if (tempIdx >= seeds.length - 5) break;
        const rr = rollWithSeedConsumptionFixed(tempIdx, conf, seeds, tempLastDraw);
        if (rr.seedsConsumed === 0) break;
        tempLastDraw = { rarity: rr.rarity, charId: rr.charId, isRerolled: rr.isRerolled };
        tempIdx += rr.seedsConsumed;
    }
    
    if (isGuaranteedStep && tempIdx < seeds.length) {
        if (typeof rollGuaranteedUber !== 'undefined') {
            const gr = rollGuaranteedUber(tempIdx, conf, seeds);
            tempIdx += gr.seedsConsumed;
        }
    }
    return { nextIndex: tempIdx, lastDraw: tempLastDraw };
}

/** 経路探索エントリポイント [cite: 302-320] */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    const getSeeds = () => {
        const seedEl = document.getElementById('seed');
        const initialSeed = parseInt(seedEl ? seedEl.value : 12345);
        const rng = new Xorshift32(initialSeed);
        const tempSeeds = [];
        const limit = Math.max(targetSeedIndex, 1000) + 500;
        for(let i=0; i < limit; i++) tempSeeds.push(rng.next());
        return tempSeeds;
    };
    const simSeeds = getSeeds();
    let startIdx = 0;
    let initialLastDraw = null;
    let validConfigParts = [];
    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0;
        let tempLastDraw = null;
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
    
    const baseConfigStr = stringifySimConfig(validConfigParts);
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const conf = gachaMasterData.gachas[id];
        if (!conf) return null;
        if (conf.name.includes('プラチナ') || conf.name.includes('レジェンド')) return null;
        return conf;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    const route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId);
    if (route) {
        if (finalActionOverride) route.push(finalActionOverride);
        else route.push({ id: targetGachaId, rolls: 1 });
        const newRouteStr = compressRoute(route);
        return baseConfigStr ? baseConfigStr + " " + newRouteStr : newRouteStr;
    }
    return null;
}

/** ビームサーチによる経路探索  */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId = null) {
    const BEAM_WIDTH = 20;
    const MAX_STEPS = 2200;

    const sortedConfigs = [...configs].sort((a, b) => {
        if (a.id == targetGachaId) return -1;
        if (b.id == targetGachaId) return 1;
        return 0;
    });
    let candidates = [{ idx: startIdx, path: [], lastDraw: initialLastDraw, score: 0 }];
    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        let nextCandidates = [];
        for (const current of candidates) {
            if (current.idx === targetIdx) return current.path;
            const dist = targetIdx - current.idx;
            if (dist < 0) continue;

            for (const conf of sortedConfigs) {
                const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);
                if (current.idx + res.seedsConsumed > targetIdx) continue;

                let score = current.score;
                const distIsOdd = (dist % 2 !== 0);
                const moveIsOdd = (res.seedsConsumed % 2 !== 0);
                if (distIsOdd === moveIsOdd) score += 500;
                else score -= 50;

                const cid = res.charId;
                const cStr = String(cid);
                if (primaryTargetId !== null && (cid == primaryTargetId || cStr == primaryTargetId)) score += 1000;

                let rarityScore = 0;
                const isLimited = (typeof limitedCats !== 'undefined' && (limitedCats.includes(cid) || limitedCats.includes(cStr)));
                const isUserTarget = (typeof userTargetIds !== 'undefined' && (userTargetIds.has(cid) || userTargetIds.has(parseInt(cid))));
                if (res.rarity === 'legend') rarityScore = isUserTarget ? 300 : 250;
                else if (isLimited) rarityScore = isUserTarget ? 200 : 150;
                else if (res.rarity === 'uber') rarityScore = isUserTarget ? 100 : 80;
                else if (isUserTarget) rarityScore = 50;

                score += rarityScore;
                const prevId = current.path.length > 0 ? current.path[current.path.length - 1].id : null;
                if (conf.id == prevId) score += 40;
                score += res.seedsConsumed;

                const newPath = [...current.path, { id: conf.id, rolls: 1 }];
                const newLastDraw = { rarity: res.rarity, charId: res.charId, isRerolled: res.isRerolled };
                if (current.idx + res.seedsConsumed === targetIdx) return newPath;

                nextCandidates.push({ idx: current.idx + res.seedsConsumed, path: newPath, lastDraw: newLastDraw, score: score });
            }
        }
        if (nextCandidates.length === 0) break;
        nextCandidates.sort((a, b) => b.score - a.score);

        const uniqueCandidates = [];
        const seenState = new Set();
        for (const cand of nextCandidates) {
            const stateKey = `${cand.idx}-${cand.lastDraw.charId}`;
            if (!seenState.has(stateKey)) {
                seenState.add(stateKey);
                uniqueCandidates.push(cand);
            }
        }
        const bestA = uniqueCandidates.filter(c => c.idx % 2 === 0).slice(0, BEAM_WIDTH / 2);
        const bestB = uniqueCandidates.filter(c => c.idx % 2 !== 0).slice(0, BEAM_WIDTH / 2);
        let combined = [...bestA, ...bestB];
        if (combined.length < BEAM_WIDTH) {
            const combinedSet = new Set(combined);
            const remaining = uniqueCandidates.filter(c => !combinedSet.has(c));
            combined = combined.concat(remaining.slice(0, BEAM_WIDTH - combined.length));
        }
        candidates = combined.sort((a, b) => b.score - a.score);
    }
    return null;
}