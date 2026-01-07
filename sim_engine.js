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
                rarity: 'uber', 
                charId: gr.charId, 
                originalCharId: gr.charId,
                isRerolled: false,
                lastRerollSlot: null,
                fromRerollRoute: false
            };
        }
    }
    return { nextIndex: tempIdx, lastDraw: tempLastDraw };
}

/** * 経路構成文字列の解析ヘルパー
 * [形式修正] "ガチャID ロール数 ガチャID ロール数" というペア形式に対応
 */
function parseSimConfig(str) {
    if (!str) return [];
    // 全ての空白（スペース、タブ等）で分割
    const tokens = str.trim().split(/\s+/);
    const segments = [];
    
    // 2つ1組 (ID, Count) で読み込む
    for (let i = 0; i < tokens.length; i += 2) {
        if (i + 1 >= tokens.length) break;
        
        const fullId = tokens[i];
        const rolls = parseInt(tokens[i + 1]);
        if (isNaN(rolls)) continue;

        const g = fullId.endsWith("g");
        const baseId = g ? fullId.slice(0, -1) : fullId;
        
        segments.push({ 
            id: baseId,       // 計算用のベースID
            fullId: fullId,   // ハイライト判定用の完全ID (g等を含む)
            rolls: rolls, 
            g: g 
        });
    }
    return segments;
}

/** * 経路構成オブジェクトの文字列化
 * [形式修正] ガチャID スペース ロール数
 */
function stringifySimConfig(parts) {
    return parts.map(p => `${p.fullId || (p.id + (p.g ? "g" : ""))} ${p.rolls}`).join(" ");
}

/** 経路の圧縮 */
function compressRoute(route) {
    if (route.length === 0) return "";
    let compressed = [];
    let current = { ...route[0] };
    for (let i = 1; i < route.length; i++) {
        // 同じガチャID（gの有無含む）ならロール数を加算
        const currentFullId = current.fullId || (current.id + (current.g ? "g" : ""));
        const targetFullId = route[i].id + (route[i].g ? "g" : "");
        
        if (targetFullId === currentFullId) {
            current.rolls += route[i].rolls;
        } else {
            compressed.push(current);
            current = { ...route[i], fullId: targetFullId };
        }
    }
    compressed.push(current);
    return stringifySimConfig(compressed);
}

/** 経路探索エントリポイント */
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
    let startIdx = 0, initialLastDraw = null, validConfigParts = [];

    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0, tempLastDraw = null;
        for (const segment of existingConfigs) {
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);
            if (res.nextIndex > targetSeedIndex) break;
            validConfigParts.push(segment);
            tempIdx = res.nextIndex; tempLastDraw = res.lastDraw;
            if (tempIdx === targetSeedIndex) break;
        }
        startIdx = tempIdx; initialLastDraw = tempLastDraw;
    }
    
    const baseConfigStr = stringifySimConfig(validConfigParts);
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr; // 探索用
        return config;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    const targetMaxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const targetMaxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);

    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    if (!route && targetMaxGuar > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, targetMaxGuar);
    if (!route && targetMaxPlat > 0) route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, targetMaxPlat, targetMaxGuar);
    
    if (route) {
        if (finalActionOverride) route.push(finalActionOverride);
        else route.push({ id: targetGachaId.replace(/[gfs]$/, ""), rolls: 1, fullId: targetGachaId });
        const compressed = compressRoute(route);
        return (baseConfigStr ? baseConfigStr + " " : "") + compressed;
    }
    return null;
}

/** ビームサーチ */
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
            const dist = targetIdx - current.idx;
            if (dist < 0) continue;

            for (const conf of sortedConfigs) {
                const isPlat = conf.name.includes('プラチナ') || conf.name.includes('レジェンド');
                const isG = conf._fullId.endsWith("g");
                
                if (!isPlat || current.platUsed < maxPlat) {
                    const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);
                    if (current.idx + res.seedsConsumed <= targetIdx) {
                        const newPath = [...current.path, { id: conf.id, rolls: 1, g: isG, fullId: conf._fullId }];
                        const newDraw = { 
                            rarity: res.rarity, charId: res.charId, 
                            originalCharId: res.originalChar ? res.originalChar.id : res.charId,
                            isRerolled: res.isRerolled, lastRerollSlot: res.lastRerollSlot, fromRerollRoute: res.isRerolled
                        };
                        if (current.idx + res.seedsConsumed === targetIdx) return newPath;
                        nextCandidates.push({ idx: current.idx + res.seedsConsumed, path: newPath, lastDraw: newDraw, score: calculateScore(current.score, res, dist, targetIdx, primaryTargetId, conf.id, current.path), platUsed: isPlat ? current.platUsed + 1 : current.platUsed, guarUsed: current.guarUsed });
                    }
                }
                if (!isPlat && current.guarUsed < maxGuar && isG) {
                    const res = simulateSingleSegment({id: conf.id, rolls: 11, g: true}, current.idx, current.lastDraw, simSeeds);
                    if (res.nextIndex <= targetIdx) {
                        const newPath = [...current.path, { id: conf.id, rolls: 11, g: true, fullId: conf._fullId }];
                        if (res.nextIndex === targetIdx) return newPath;
                        nextCandidates.push({ idx: res.nextIndex, path: newPath, lastDraw: res.lastDraw, score: current.score - 500, platUsed: current.platUsed, guarUsed: current.guarUsed + 1 });
                    }
                }
            }
        }
        if (nextCandidates.length === 0) break;
        nextCandidates.sort((a, b) => b.score - a.score);
        const unique = []; const seen = new Set();
        for (const c of nextCandidates) {
            const key = `${c.idx}-${c.lastDraw?.charId}-${c.platUsed}-${c.guarUsed}`;
            if (!seen.has(key)) { seen.add(key); unique.push(c); }
        }
        candidates = unique.slice(0, BEAM_WIDTH);
    }
    return null;
}

function calculateScore(currentScore, res, dist, targetIdx, primaryTargetId, confId, currentPath) {
    let s = currentScore;
    if ((dist % 2 !== 0) === (res.seedsConsumed % 2 !== 0)) s += 500; else s -= 50;
    if (primaryTargetId && String(res.charId) === String(primaryTargetId)) s += 1000;
    if (res.rarity === 'legend') s += 300; else if (res.rarity === 'uber') s += 100;
    return s + res.seedsConsumed;
}