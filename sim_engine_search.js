/** @file sim_engine_search.js @description ビームサーチによる経路探索アルゴリズム */

/**
 * ビームサーチ本体
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar) {
    const BEAM_WIDTH = 25, MAX_STEPS = 2500;
    const sortedConfigs = [...configs].sort((a, b) => (a._fullId == targetGachaId ? -1 : 1));
    let candidates = [{ idx: startIdx, path: [], lastDraw: initialLastDraw, score: 0, platUsed: 0, guarUsed: 0 }];
    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        let nextCandidates = [];
        for (const current of candidates) {
            if (current.idx === targetIdx) return current.path;
            nextCandidates.push(...expandCandidates(current, targetIdx, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId));
        }
        if (nextCandidates.length === 0) break;
        nextCandidates.sort((a, b) => b.score - a.score);
        candidates = filterUniqueCandidates(nextCandidates).slice(0, BEAM_WIDTH);
    }
    return null;
}

/**
 * 候補展開処理
 */
function expandCandidates(current, targetIdx, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId) {
    const results = [];
    const dist = targetIdx - current.idx;
    if (dist < 0) return results;

    for (const conf of sortedConfigs) {
        const isPlat = conf.name.includes('プラチナ') || conf.name.includes('レジェンド');
        const isG = conf._fullId.endsWith("g");

        if (!isPlat || current.platUsed < maxPlat) {
            const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);
            if (current.idx + res.seedsConsumed <= targetIdx) {
                const newDraw = { 
                    rarity: res.rarity, charId: res.charId, 
                    originalCharId: res.originalChar ? res.originalChar.id : res.charId,
                    isRerolled: res.isRerolled, lastRerollSlot: res.lastRerollSlot, fromRerollRoute: res.isRerolled
                };
                results.push({ 
                    idx: current.idx + res.seedsConsumed, path: [...current.path, { id: conf.id, rolls: 1, g: isG, fullId: conf._fullId }], 
                    lastDraw: newDraw, score: calculateScore(current.score, res, dist, targetIdx, primaryTargetId, conf.id), 
                    platUsed: isPlat ? current.platUsed + 1 : current.platUsed, guarUsed: current.guarUsed 
                });
            }
        }
        if (!isPlat && current.guarUsed < maxGuar && isG) {
            const res = simulateSingleSegment({id: conf.id, rolls: 11, g: true}, current.idx, current.lastDraw, simSeeds);
            if (res.nextIndex <= targetIdx) {
                results.push({ 
                    idx: res.nextIndex, path: [...current.path, { id: conf.id, rolls: 11, g: true, fullId: conf._fullId }], 
                    lastDraw: res.lastDraw, score: current.score - 500, platUsed: current.platUsed, guarUsed: current.guarUsed + 1 
                });
            }
        }
    }
    return results;
}

function filterUniqueCandidates(candidates) {
    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
        const key = `${c.idx}-${c.lastDraw?.charId}-${c.platUsed}-${c.guarUsed}`;
        if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }
    return unique;
}

function calculateScore(currentScore, res, dist, targetIdx, primaryTargetId, confId) {
    let s = currentScore;
    if ((dist % 2 !== 0) === (res.seedsConsumed % 2 !== 0)) s += 500; else s -= 50;
    if (primaryTargetId && String(res.charId) === String(primaryTargetId)) s += 1000;
    if (res.rarity === 'legend') s += 300; else if (res.rarity === 'uber') s += 100;
    return s + res.seedsConsumed;
}