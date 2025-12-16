//simulation.js
// --- sim-config ヘルパー関数 ---

function parseSimConfig(configStr) {
    if (!configStr) return [];
    // スペース、タブ、ハイフンで分割し、空の要素を除外
    const parts = configStr.split(/[\s\-]+/).filter(Boolean);
    
    const configs = [];
    for (let i = 0; i < parts.length; i += 2) {
        const id = parts[i];
        const rollStr = parts[i+1];
        if (id && rollStr) {
            // 'g' が末尾にあれば確定扱い (11g, 15g, 7g など)
            const isGuaranteed = rollStr.endsWith('g');
            // 数値部分を取り出し
            const rolls = parseInt(rollStr.replace('g', ''), 10);
            configs.push({ id, rolls, g: isGuaranteed });
        }
    }
    return configs;
}

function stringifySimConfig(configArr) {
    // 表示用はスペース区切りで整形
    return configArr.map(c => `${c.id} ${c.rolls}${c.g ? 'g' : ''}`).join(' ');
}

function incrementLastRoll(configStr) {
    if (!configStr) return null;
    const configs = parseSimConfig(configStr);
    if (configs.length > 0) {
        const last = configs[configs.length - 1];
        // 確定でない場合のみ回数を増やす（確定指定の場合は単発1回を追加）
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
                // 回避
                if (otherRoll_prev.rarity !== 'rare' || otherRoll_prev.charId !== originalCharId) { 
                    const altConfig = createAltConfig(prevIndex);
                    if (altConfig) return { link: altConfig, rerollCharName: null };
                }
            } else {
                // 誘発
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

/**
 * Helper: 指定されたConfigを実行した後の SeedIndex と LastDraw を取得する
 */
function getSimulationState(configStr, seeds) {
    const configs = parseSimConfig(configStr);
    let currentSeedIndex = 0;
    let lastDraw = null;

    for (const sim of configs) {
        const conf = gachaMasterData.gachas[sim.id];
        if (!conf) continue;

        let normalRolls = sim.rolls;
        let isGuaranteedStep = false;
        
        if (sim.g) {
             if (sim.rolls === 15) { normalRolls = 14; isGuaranteedStep = true; }
             else if (sim.rolls === 7) { normalRolls = 6; isGuaranteedStep = true; }
             else if (sim.rolls === 11) { normalRolls = 10; isGuaranteedStep = true; }
             else { normalRolls = sim.rolls; }
        }

        // Normal Rolls
        for(let k=0; k < normalRolls; k++) {
            if (currentSeedIndex >= seeds.length - 5) break; // 安全策
            const rr = rollWithSeedConsumptionFixed(currentSeedIndex, conf, seeds, lastDraw);
            if (rr.seedsConsumed === 0) break;
            
            lastDraw = { rarity: rr.rarity, charId: rr.charId, isRerolled: rr.isRerolled };
            currentSeedIndex += rr.seedsConsumed;
        }
        
        // Guaranteed Roll
        if (isGuaranteedStep && currentSeedIndex < seeds.length) {
            if (typeof rollGuaranteedUber !== 'undefined') {
                const gr = rollGuaranteedUber(currentSeedIndex, conf, seeds);
                currentSeedIndex += gr.seedsConsumed;
                // 確定枠の結果は LastDraw に影響しない（次の通常枠の被り判定には使われない）のが一般的だが
                // 必要ならここで更新する。今回は更新しない実装とする。
            }
        }
    }
    return { currentIndex: currentSeedIndex, lastDraw: lastDraw };
}

/**
 * 経路探索: Start(0)からTarget(seedIndex)までの最適なガチャ操作手順を算出する
 * メインテーブルに表示されているガチャのみ使用し、確定・プラチナ等は使用しない
 * * ★追加機能: currentConfigStr がある場合、その続きから計算する
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr) {
    // シード配列の準備 (Start Seedから生成)
    const getSeeds = () => {
        const seedEl = document.getElementById('seed');
        const initialSeed = parseInt(seedEl ? seedEl.value : 12345);
        const rng = new Xorshift32(initialSeed);
        const tempSeeds = [];
        // 必要十分な数だけ回す（targetIdx + バッファ）
        const limit = Math.max(targetSeedIndex, 1000) + 500; 
        for(let i=0; i < limit; i++) tempSeeds.push(rng.next());
        return tempSeeds;
    };
    const simSeeds = getSeeds();

    // 0. 開始地点の決定 (既存Configの続き or 最初から)
    let startIdx = 0;
    let initialLastDraw = null;
    let baseConfigStr = "";

    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const state = getSimulationState(currentConfigStr, simSeeds);
        
        // もしターゲットが既に通過した地点(過去)にある場合は、追記ではなく上書き(最初から計算)にする
        if (targetSeedIndex > state.currentIndex) {
            startIdx = state.currentIndex;
            initialLastDraw = state.lastDraw;
            baseConfigStr = currentConfigStr.trim();
        }
    }

    // 1. 目標地点のガチャ設定を取得
    const targetConfig = gachaMasterData.gachas[targetGachaId];
    if (!targetConfig) return null;

    // 2. 探索に使用可能なガチャConfigリスト
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const conf = gachaMasterData.gachas[id];
        if (!conf) return null;
        if (conf.name.includes('プラチナ') || conf.name.includes('レジェンド')) return null;
        return conf;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    // 3. 経路探索実行 (startIdx から targetSeedIndex まで)
    const route = findPathGreedy(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw);
    
    if (route) {
        // ★修正: クリックしたセル自身を含めるため、最後にターゲットガチャを1回引く
        route.push({ id: targetGachaId, rolls: 1 });

        const newRouteStr = compressRoute(route);
        if (baseConfigStr) {
            return baseConfigStr + " " + newRouteStr;
        } else {
            return newRouteStr;
        }
    } else {
        return null; // ルート見つからず
    }
}

/**
 * 貪欲法による経路探索
 */
function findPathGreedy(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw) {
    let currentIdx = startIdx;
    let path = []; // { id: gachaId, rolls: 1 }
    let lastDraw = initialLastDraw; // { rarity, charId, isRerolled }

    // 安全装置: 無限ループ防止
    let loopCount = 0;
    const MAX_LOOPS = 2000;

    while (currentIdx < targetIdx && loopCount < MAX_LOOPS) {
        loopCount++;
        const dist = targetIdx - currentIdx;
        
        let possibleMoves = [];

        for (const conf of configs) {
            // このガチャを引いた場合の結果を予測
            const res = rollWithSeedConsumptionFixed(currentIdx, conf, simSeeds, lastDraw);
            
            // ターゲットを越える場合は除外
            if (currentIdx + res.seedsConsumed > targetIdx) continue;

            // 評価値計算 (小さいほど良い)
            let score = 0;

            // 1. パリティ（偶奇）チェック
            const distIsOdd = (dist % 2 !== 0);
            const moveIsOdd = (res.seedsConsumed % 2 !== 0);
            
            if (distIsOdd === moveIsOdd) {
                score -= 100; // パリティが一致する手は高評価
            } else {
                score += 50; // パリティ不一致は後回し
            }

            // 2. ターゲットガチャ優先
            if (conf.id == targetGachaId) score -= 10;
            
            // 3. 直前のガチャと同じなら優先（圧縮効率・Stickiness）
            const prevId = path.length > 0 ? path[path.length-1].id : null;
            if (conf.id == prevId) score -= 5;

            // 4. 消費シード数による重みづけ (パリティが合うなら大きく進む)
            score -= res.seedsConsumed;

            possibleMoves.push({ config: conf, result: res, score: score });
        }

        // 候補がない（詰み）
        if (possibleMoves.length === 0) return null;

        // スコア順にソート (昇順)
        possibleMoves.sort((a, b) => a.score - b.score);

        // 最良の手を採用
        const bestMove = possibleMoves[0];
        
        path.push({ id: bestMove.config.id, rolls: 1 });
        
        // 次のステップのために lastDraw を更新
        lastDraw = { 
            rarity: bestMove.result.rarity, 
            charId: bestMove.result.charId, 
            isRerolled: bestMove.result.isRerolled 
        };
        
        currentIdx += bestMove.result.seedsConsumed;
    }

    // 到達チェック
    if (currentIdx === targetIdx) {
        return path;
    }

    return null;
}

/**
 * ルート配列をConfig文字列に圧縮する
 * [{id:A}, {id:A}, {id:B}] -> "A 2 B 1"
 */
function compressRoute(path) {
    if (!path || path.length === 0) return "";
    
    let compressed = [];
    if (path.length > 0) {
        let currentId = path[0].id;
        let count = 0;

        for (const step of path) {
            if (step.id === currentId) {
                count++;
            } else {
                compressed.push(`${currentId} ${count}`);
                currentId = step.id;
                count = 1;
            }
        }
        // 最後の一つ
        compressed.push(`${currentId} ${count}`);
    }

    return compressed.join(" ");
}