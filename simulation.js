/** @file simulation.js @description 自動経路探索（ビームサーチ）、回避・誘発の判定、Config解析を担当 @dependency logic.js, ui_globals.js */

// --- sim-config ヘルパー関数 ---

function parseSimConfig(configStr) {
    if (!configStr) return [];
    const parts = configStr.split(/[\s\-]+/).filter(Boolean);
    const configs = [];
    for (let i = 0; i < parts.length; i += 2) {
        const id = parts[i];
        const rollStr = parts[i+1];
        if (id && rollStr) {
            const isGuaranteed = rollStr.endsWith('g');
            const rolls = parseInt(rollStr.replace('g', ''), 10);
            configs.push({ id, rolls, g: isGuaranteed });
        }
    }
    return configs;
}

function stringifySimConfig(configArr) {
    return configArr.map(c => `${c.id} ${c.rolls}${c.g ? 'g' : ''}`).join(' ');
}

function incrementLastRoll(configStr) {
    if (!configStr) return null;
    const configs = parseSimConfig(configStr);
    if (configs.length > 0) {
        const last = configs[configs.length - 1];
        if (!last.g) { 
            last.rolls += 1;
        } else {
            configs.push({ id: last.id, rolls: 1, g: false });
        }
    }
    return stringifySimConfig(configs);
}

function decrementLastRollOrRemoveSegment(configStr) {
    if (!configStr) return null;
    const configs = parseSimConfig(configStr);
    if (configs.length > 0) {
        const last = configs[configs.length - 1];
        if (last.rolls > 1 && !last.g) {
            last.rolls -= 1;
        } else {
            configs.pop();
        }
    }
    return stringifySimConfig(configs);
}

function removeLastConfigSegment(configStr) {
    if (!configStr) return "";
    const configs = parseSimConfig(configStr);
    if (configs.length > 0) {
        configs.pop();
    }
    return stringifySimConfig(configs);
}

function generateGuaranteedConfig(configStr, gachaId) {
    if (!configStr) return null;
    const parsed = parseSimConfig(configStr);
    if (parsed.length === 0) return null;
    
    const lastPart = parsed.pop();
    if (!lastPart.g && lastPart.rolls > 0) { 
        const newRollsForLastPart = Math.max(0, lastPart.rolls - 1);
        if (newRollsForLastPart > 0) {
            lastPart.rolls = newRollsForLastPart;
            parsed.push(lastPart);
        }
        parsed.push({ id: gachaId, rolls: 11, g: true });
        return stringifySimConfig(parsed);
    }
    return null;
}

// --- 回避/誘発ロジック (View用) ---

function getBestLink(cellSimConfigs, seedIndex, gachaConfigs) {
    if (seedIndex < 0) return null;
    for (const config of gachaConfigs) {
        const configStr = cellSimConfigs.get(`${seedIndex}-${config.id}`);
        if (configStr !== undefined) {
            return configStr;
        }
    }
    return null;
}

function getForcedRerollName(currentRoll, gachaConfig) {
    if (!currentRoll || !gachaConfig || currentRoll.rarity !== 'rare' || currentRoll.s2 === null) {
        return null;
    }
    const characterPool = gachaConfig.pool['rare'] || [];
    const uniqueRareChars = characterPool.filter(c => c.id !== currentRoll.originalChar.id);
    const uniqueTotal = uniqueRareChars.length;
    
    if (uniqueTotal > 0) {
        const reRollIndex = currentRoll.s2 % uniqueTotal;
        return uniqueRareChars[reRollIndex].name;
    }
    return null;
}

function checkAvoidanceAndForcing(seedIndex, currentGachaId, tableData, gachaConfigs, cellSimConfigs, newRow1Index) {
    const i = Math.floor(seedIndex / 2);
    if (i < newRow1Index) {
        return { link: null, rerollCharName: null };
    }

    const gachaIndex = gachaConfigs.findIndex(c => c.id === currentGachaId);
    if (gachaIndex === -1 || !tableData[seedIndex] || !tableData[seedIndex][gachaIndex]) {
        return { link: null, rerollCharName: null };
    }

    const currentRoll = tableData[seedIndex][gachaIndex].roll;
    const isRerolled = currentRoll.isRerolled;
    const originalCharId = currentRoll.originalChar?.id;
    const originalRarity = currentRoll.rarity;
    if (originalRarity !== 'rare' || !originalCharId) {
        return { link: null, rerollCharName: null };
    }

    const prevIndicesToCheck = [seedIndex - 2, seedIndex - 3];
    for (const otherConfig of gachaConfigs) {
        const otherGachaId = otherConfig.id;
        if (otherGachaId === currentGachaId) continue;

        const otherIndex = gachaConfigs.findIndex(c => c.id === otherGachaId);
        if (otherIndex === -1) continue;
        const createAltConfig = (prevIndexUsed) => {
            const configStr = getBestLink(cellSimConfigs, prevIndexUsed, gachaConfigs);
            if (configStr === null) return null; 
            const parts = parseSimConfig(configStr);
            const last_part = parts.length > 0 ? parts[parts.length - 1] : null;
            if (last_part && last_part.id === otherGachaId && !last_part.g) {
                last_part.rolls += 1;
            } else {
                parts.push({ id: otherGachaId, rolls: 1, g: false });
            }
            return stringifySimConfig(parts);
        };
        for (const prevIndex of prevIndicesToCheck) {
            if (prevIndex < 0) continue;
            const otherRoll_prev = tableData[prevIndex]?.[otherIndex]?.roll;
            if (!otherRoll_prev) continue;

            if (isRerolled) {
                if (otherRoll_prev.rarity !== 'rare' || otherRoll_prev.charId !== originalCharId) { 
                    const altConfig = createAltConfig(prevIndex);
                    if (altConfig) return { link: altConfig, rerollCharName: null };
                }
            } else {
                if (otherRoll_prev.rarity === 'rare' && otherRoll_prev.charId === originalCharId) {
                    const altConfig = createAltConfig(prevIndex);
                    if (altConfig) {
                        const rerollCharName = getForcedRerollName(currentRoll, gachaConfigs[gachaIndex]);
                        return { link: altConfig, rerollCharName: rerollCharName };
                    }
                }
            }
        }
    }
    return { link: null, rerollCharName: null };
}

function canBeForced(seedIndex, currentGachaId, tableData, gachaConfigs) {
    const gachaIndex = gachaConfigs.findIndex(c => c.id === currentGachaId);
    if (gachaIndex === -1 || seedIndex < 1 || !tableData[seedIndex] || !tableData[seedIndex][gachaIndex]) return false;

    const currentRoll = tableData[seedIndex][gachaIndex].roll;
    const originalCharId = currentRoll.originalChar ? currentRoll.originalChar.id : null;
    if (!originalCharId) return false;
    const prevIndicesToCheck = [seedIndex - 2, seedIndex - 3];
    for (const prevIndex of prevIndicesToCheck) {
        if (prevIndex < 0) continue;
        for (const otherConfig of gachaConfigs) {
            const otherIndex = gachaConfigs.findIndex(c => c.id === otherConfig.id);
            if (otherIndex === -1) continue;
            const otherRoll_prev = tableData[prevIndex]?.[otherIndex]?.roll;
            if (otherRoll_prev && otherRoll_prev.rarity === 'rare' && otherRoll_prev.charId === originalCharId) {
                return true;
            }
        }
    }
    return false;
}

function canBeAvoided(seedIndex, currentGachaId, tableData, gachaConfigs) {
    const gachaIndex = gachaConfigs.findIndex(c => c.id === currentGachaId);
    if (gachaIndex === -1 || seedIndex < 1 || !tableData[seedIndex] || !tableData[seedIndex][gachaIndex]) return false;

    const currentRoll = tableData[seedIndex][gachaIndex].roll;
    if (currentRoll.rarity !== 'rare' || !currentRoll.isRerolled || !currentRoll.originalChar) return false;
    const originalCharId = currentRoll.originalChar.id;
    const prevIndicesToCheck = [seedIndex - 2, seedIndex - 3];
    for (const prevIndex of prevIndicesToCheck) {
        if (prevIndex < 0) continue;
        for (const otherConfig of gachaConfigs) {
            const otherIndex = gachaConfigs.findIndex(c => c.id === otherConfig.id);
            if (otherIndex === -1) continue;
            const otherRoll_prev = tableData[prevIndex]?.[otherIndex]?.roll;
            if (otherRoll_prev && (otherRoll_prev.rarity !== 'rare' || otherRoll_prev.charId !== originalCharId)) {
                return true;
            }
        }
    }
    return false;
}

// --- 自動経路探索ロジック ---

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
            if (res.nextIndex > targetSeedIndex) {
                break;
            }
            validConfigParts.push(segment);
            tempIdx = res.nextIndex;
            tempLastDraw = res.lastDraw;
            if (tempIdx === targetSeedIndex) {
                break;
            }
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
        if (finalActionOverride) {
            route.push(finalActionOverride);
        } else {
            route.push({ id: targetGachaId, rolls: 1 });
        }
        const newRouteStr = compressRoute(route);
        if (baseConfigStr) {
            return baseConfigStr + " " + newRouteStr;
        } else {
            return newRouteStr;
        }
    } else {
        return null;
    }
}

/**
 * ビームサーチによる経路探索 (A/Bトラック多様性維持 + ターゲット重みづけ版)
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId = null) {
    const BEAM_WIDTH = 20;
    const MAX_STEPS = 2200; // 2000ロール先まで対応

    const sortedConfigs = [...configs].sort((a, b) => {
        if (a.id == targetGachaId) return -1;
        if (b.id == targetGachaId) return 1;
        return 0;
    });

    let candidates = [{
        idx: startIdx,
        path: [],
        lastDraw: initialLastDraw,
        score: 0
    }];
    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        let nextCandidates = [];
        
        for (const current of candidates) {
            if (current.idx === targetIdx) {
                return current.path;
            }

            const dist = targetIdx - current.idx;
            if (dist < 0) continue;

            for (const conf of sortedConfigs) {
                const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);
                if (current.idx + res.seedsConsumed > targetIdx) continue;

                let score = current.score;
                const distIsOdd = (dist % 2 !== 0);
                const moveIsOdd = (res.seedsConsumed % 2 !== 0);
                
                if (distIsOdd === moveIsOdd) {
                    score += 500;
                } else {
                    score -= 50;
                }

                const cid = res.charId;
                const cStr = String(cid);

                // --- 特定ターゲット重みづけ (+1000) ---
                if (primaryTargetId !== null && (cid == primaryTargetId || cStr == primaryTargetId)) {
                    score += 1000;
                }

                let rarityScore = 0;
                const isLimited = (typeof limitedCats !== 'undefined' && (limitedCats.includes(cid) || limitedCats.includes(cStr)));
                const isUserTarget = (typeof userTargetIds !== 'undefined' && (userTargetIds.has(cid) || userTargetIds.has(parseInt(cid))));
                if (res.rarity === 'legend') {
                    if (isUserTarget) rarityScore = 300;
                    else rarityScore = 250;
                } else if (isLimited) {
                    if (isUserTarget) rarityScore = 200;
                    else rarityScore = 150;
                } else if (res.rarity === 'uber') {
                    if (isUserTarget) rarityScore = 100;
                    else rarityScore = 80;
                } else if (isUserTarget) {
                    rarityScore = 50;
                }

                score += rarityScore;
                const prevId = current.path.length > 0 ? current.path[current.path.length - 1].id : null;
                if (conf.id == prevId) score += 40;
                score += res.seedsConsumed;

                const newPath = [...current.path, { id: conf.id, rolls: 1 }];
                const newLastDraw = { 
                    rarity: res.rarity, 
                    charId: res.charId, 
                    isRerolled: res.isRerolled 
                };

                if (current.idx + res.seedsConsumed === targetIdx) {
                    return newPath;
                }

                nextCandidates.push({
                    idx: current.idx + res.seedsConsumed,
                    path: newPath,
                    lastDraw: newLastDraw,
                    score: score
                });
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

        // A列・B列をバランスよく残す
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

function compressRoute(path) {
    if (!path || path.length === 0) return "";
    let compressed = [];
    let currentId = path[0].id;
    let isG = path[0].g || false;
    let count = path[0].rolls || 1;
    for (let i = 1; i < path.length; i++) {
        const step = path[i];
        const stepG = step.g || false;
        if (step.id === currentId && stepG === isG && !isG) {
            count += (step.rolls || 1);
        } else {
            compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
            currentId = step.id;
            isG = stepG;
            count = step.rolls || 1;
        }
    }
    compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
    return compressed.join(" ");
}