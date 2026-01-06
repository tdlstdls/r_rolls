/** @file sim_engine.js @description 経路探索・シミュレーションエンジン */

/** 単一セグメントのシミュレーション */
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
            tempLastDraw = { rarity: 'uber', charId: gr.charId, isRerolled: false };
        }
    }
    return { nextIndex: tempIdx, lastDraw: tempLastDraw };
}

/** 経路探索エントリポイント (階層的フォールバック版) */
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

    // 全ての表示中ガチャを検索対象にする
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        return gachaMasterData.gachas[id] || null;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    // UIから上限値を取得
    const maxPlatInput = document.getElementById('sim-max-plat');
    const maxGuarInput = document.getElementById('sim-max-guar');
    const targetMaxPlat = maxPlatInput ? parseInt(maxPlatInput.value, 10) : 0;
    const targetMaxGuar = maxGuarInput ? parseInt(maxGuarInput.value, 10) : 0;

    let route = null;

    // --- 階層的検索ロジック ---

    // 1. まずはプラチナも確定ガチャも使わずに検索 (0, 0)
    route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);

    // 2. 見つからない場合、設定された上限の範囲内で「確定ガチャ」を解禁して検索 (0, N)
    if (!route && targetMaxGuar > 0) {
        console.log("Searching with Guaranteed rolls enabled...");
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, targetMaxGuar);
    }

    // 3. それでも見つからない場合、設定された上限の範囲内で「プラチナガチャ」も解禁して検索 (M, N)
    if (!route && targetMaxPlat > 0) {
        console.log("Searching with Platinum tickets enabled...");
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, targetMaxPlat, targetMaxGuar);
    }
    
    if (route) {
        if (finalActionOverride) route.push(finalActionOverride);
        else route.push({ id: targetGachaId, rolls: 1 });
        const newRouteStr = compressRoute(route);
        return baseConfigStr ? baseConfigStr + " " + newRouteStr : newRouteStr;
    }
    return null;
}

/** ビームサーチによる経路探索 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar) {
    const BEAM_WIDTH = 25;
    const MAX_STEPS = 2500;

    const sortedConfigs = [...configs].sort((a, b) => {
        if (a.id == targetGachaId) return -1;
        if (b.id == targetGachaId) return 1;
        return 0;
    });

    let candidates = [{ idx: startIdx, path: [], lastDraw: initialLastDraw, score: 0, platUsed: 0, guarUsed: 0 }];
    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        let nextCandidates = [];
        for (const current of candidates) {
            if (current.idx === targetIdx) return current.path;
            const dist = targetIdx - current.idx;
            if (dist < 0) continue;

            for (const conf of sortedConfigs) {
                const isPlat = conf.name.includes('プラチナ') || conf.name.includes('レジェンド');
                
                // 1. 通常の1ロール（プラチナは上限チェック）
                if (!isPlat || current.platUsed < maxPlat) {
                    const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);
                    if (current.idx + res.seedsConsumed <= targetIdx) {
                        const newPath = [...current.path, { id: conf.id, rolls: 1 }];
                        const newLastDraw = { rarity: res.rarity, charId: res.charId, isRerolled: res.isRerolled };
                        const newPlatCount = isPlat ? current.platUsed + 1 : current.platUsed;
                        
                        let score = calculateScore(current.score, res, dist, targetIdx, primaryTargetId, conf.id, current.path);
                        if (isPlat) score -= 1000; // 使用にはペナルティ

                        if (current.idx + res.seedsConsumed === targetIdx) return newPath;
                        nextCandidates.push({ idx: current.idx + res.seedsConsumed, path: newPath, lastDraw: newLastDraw, score: score, platUsed: newPlatCount, guarUsed: current.guarUsed });
                    }
                }

                // 2. 確定11連（通常のガチャかつ上限チェック）
                if (!isPlat && current.guarUsed < maxGuar) {
                    const res = simulateSingleSegment({id: conf.id, rolls: 11, g: true}, current.idx, current.lastDraw, simSeeds);
                    if (res.nextIndex <= targetIdx) {
                        const newPath = [...current.path, { id: conf.id, rolls: 11, g: true }];
                        let score = current.score + 100 - 500; // 使用にはペナルティ

                        if (res.nextIndex === targetIdx) return newPath;
                        nextCandidates.push({ idx: res.nextIndex, path: newPath, lastDraw: res.lastDraw, score: score, platUsed: current.platUsed, guarUsed: current.guarUsed + 1 });
                    }
                }
            }
        }
        if (nextCandidates.length === 0) break;

        nextCandidates.sort((a, b) => b.score - a.score);
        const uniqueCandidates = [];
        const seenState = new Set();
        for (const cand of nextCandidates) {
            const stateKey = `${cand.idx}-${cand.lastDraw.charId}-${cand.platUsed}-${cand.guarUsed}`;
            if (!seenState.has(stateKey)) {
                seenState.add(stateKey);
                uniqueCandidates.push(cand);
            }
        }
        candidates = uniqueCandidates.slice(0, BEAM_WIDTH);
    }
    return null;
}

/** スコア計算ヘルパー */
function calculateScore(currentScore, res, dist, targetIdx, primaryTargetId, confId, currentPath) {
    let score = currentScore;
    const distIsOdd = (dist % 2 !== 0);
    const moveIsOdd = (res.seedsConsumed % 2 !== 0);
    
    if (distIsOdd === moveIsOdd) score += 500;
    else score -= 50;

    const cid = res.charId;
    if (primaryTargetId !== null && String(cid) === String(primaryTargetId)) score += 1000;

    let rarityScore = 0;
    const isLimited = (typeof limitedCats !== 'undefined' && limitedCats.includes(parseInt(cid)));
    const isUserTarget = (typeof userTargetIds !== 'undefined' && (userTargetIds.has(cid) || userTargetIds.has(parseInt(cid))));
    
    if (res.rarity === 'legend') rarityScore = isUserTarget ? 300 : 250;
    else if (isLimited) rarityScore = isUserTarget ? 200 : 150;
    else if (res.rarity === 'uber') rarityScore = isUserTarget ? 100 : 80;
    else if (isUserTarget) rarityScore = 50;
    
    score += rarityScore;
    const prevId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
    if (confId == prevId) score += 40;
    score += res.seedsConsumed;
    return score;
}