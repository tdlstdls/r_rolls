/** @file simulation.js @description 自動経路探索（ビームサーチ）、回避・誘発の判定、Config解析を担当 @dependency logic.js, ui_globals.js */

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

// 追加: 最後のセグメント（ID+回数）を丸ごと削除する
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
 * 内部ヘルパー: 単一セグメントをシミュレートし、次のインデックスとLastDrawを返す
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

    // Normal Rolls
    for(let k=0; k < normalRolls; k++) {
        if (tempIdx >= seeds.length - 5) break;
        const rr = rollWithSeedConsumptionFixed(tempIdx, conf, seeds, tempLastDraw);
        if (rr.seedsConsumed === 0) break;
        tempLastDraw = { rarity: rr.rarity, charId: rr.charId, isRerolled: rr.isRerolled };
        tempIdx += rr.seedsConsumed;
    }
    
    // Guaranteed Roll
    if (isGuaranteedStep && tempIdx < seeds.length) {
        if (typeof rollGuaranteedUber !== 'undefined') {
            const gr = rollGuaranteedUber(tempIdx, conf, seeds);
            tempIdx += gr.seedsConsumed;
        }
    }

    return { nextIndex: tempIdx, lastDraw: tempLastDraw };
}

/**
 * 経路探索: Start(0)からTarget(seedIndex)までの最適なガチャ操作手順を算出する
 * ★修正: 途中セルがクリックされた場合、既存のConfigを遡って最大限維持し、そこからルートを再計算する
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null) {
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

    // 0. 開始地点の決定 
    // 既存のConfigを解析し、ターゲットより手前の有効なルートまでを特定する
    let startIdx = 0;
    let initialLastDraw = null;
    let validConfigParts = [];

    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0;
        let tempLastDraw = null;

        for (const segment of existingConfigs) {
            // このセグメントを実行した場合の到達点を計算
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);

            // もしこのセグメントを実行すると、ターゲットを超えてしまう場合
            // このセグメント以降は採用せず、ここから経路探索を行う
            if (res.nextIndex > targetSeedIndex) {
                break;
            }

            // ターゲットより手前（またはターゲット地点）で終わるセグメントなら維持する
            validConfigParts.push(segment);
            tempIdx = res.nextIndex;
            tempLastDraw = res.lastDraw;
            
            // ターゲット地点ぴったりに到達した場合、そこまでのConfigは確定としループを抜ける
            // (これ以上既存Configを読み込むとオーバーするため)
            if (tempIdx === targetSeedIndex) {
                break;
            }
        }

        startIdx = tempIdx;
        initialLastDraw = tempLastDraw;
    }
    
    // 維持されたConfig文字列
    const baseConfigStr = stringifySimConfig(validConfigParts);

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
    // findPathBeamSearch に名称変更
    const route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw);
    
    if (route) {
        // クリックしたセルの処理
        if (finalActionOverride) {
            // 確定枠などの指定がある場合はそのアクションを追加
            route.push(finalActionOverride);
        } else {
            // 通常セルは単発1回
            route.push({ id: targetGachaId, rolls: 1 });
        }

        const newRouteStr = compressRoute(route);

        if (baseConfigStr) {
            // 維持したConfig + 新しいルート
            return baseConfigStr + " " + newRouteStr;
        } else {
            return newRouteStr;
        }
    } else {
        // ルートが見つからない場合
        return null;
    }
}

/**
 * 経路探索: Start(0)からTarget(seedIndex)までの最適なガチャ操作手順を算出する
 * ビームサーチ(Beam Search)を使用し、最適なルートを探索する
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw) {
    // ビームサーチ設定
    const BEAM_WIDTH = 20;
    // 同時に探索するルート候補の数（増やしすぎると重くなるが精度が上がる）
    const MAX_STEPS = 1000; // 無限ループ防止

    // targetGachaId を優先的に試行するためにリストを並び替える
    const sortedConfigs = [...configs].sort((a, b) => {
        if (a.id == targetGachaId) return -1;
        if (b.id == targetGachaId) return 1;
        return 0;
    });

    // 候補リスト: { idx, path, lastDraw, score }
    // scoreが大きいほど優先度が高い
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
        
        // 現在の候補すべてについて、次の手を展開
        for (const current of candidates) {
            // すでにゴールしている場合は（念のため）リターン
            if (current.idx === targetIdx) {
                return current.path;
            }

            // 残りの距離
            const dist = targetIdx - current.idx;
            if (dist < 0) continue; // 行き過ぎたルートは破棄

            for (const conf of sortedConfigs) {
                // このガチャを引いた場合の結果を予測
                const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, current.lastDraw);

                // ターゲットを越える場合は除外
                if (current.idx + res.seedsConsumed > targetIdx) continue;

                // --- スコアリング (大きいほど良い) ---
                let score = current.score;

                // 1. パリティ（偶奇）チェック
                // 「残り距離」と「移動距離」の偶奇が一致すれば、トラック移動として非常に高評価
                const distIsOdd = (dist % 2 !== 0);
                const moveIsOdd = (res.seedsConsumed % 2 !== 0);
                
                if (distIsOdd === moveIsOdd) {
                    score += 500; // パリティ一致は最優先
                } else {
                    score -= 50; // パリティ不一致は減点
                }

                // 2. レアリティ・ターゲットに基づく加点（優先順位指定あり）
                let rarityScore = 0;
                const cid = res.charId;
                const cStr = String(cid);

                // 限定キャラ判定（limited_cats.js）
                const isLimited = (typeof limitedCats !== 'undefined' && (limitedCats.includes(cid) || limitedCats.includes(cStr)));
                
                // ユーザー指定ターゲット判定（ui_globals.js, ui_target_handler.js）
                // userTargetIds は Set
                const isUserTarget = (typeof userTargetIds !== 'undefined' && (userTargetIds.has(cid) || userTargetIds.has(parseInt(cid))));
                
                if (res.rarity === 'legend') {
                    if (isUserTarget) rarityScore = 300; // Findで選択された伝説レア
                    else rarityScore = 250;              // その他の伝説レア
                } else if (isLimited) {
                    if (isUserTarget) rarityScore = 200; // Findで選択された限定キャラ
                    else rarityScore = 150;              // その他の限定キャラ
                } else if (res.rarity === 'uber') {
                    if (isUserTarget) rarityScore = 100; // Findで選択された超激レア
                    else rarityScore = 80;               // その他の超激レア
                } else if (isUserTarget) {
                    rarityScore = 50;                    // Findで選択されたその他のレアリティ
                }

                score += rarityScore;

                // 3. Stickiness（同じガチャを連続して引く）
                const prevId = current.path.length > 0 ? current.path[current.path.length - 1].id : null;
                if (conf.id == prevId) score += 40; // 加点を強化

                // 4. Target Gacha の条件削除
                // if (conf.id == targetGachaId) score += 30; // 削除済み

                // 5. 進むこと自体への加点（停滞防止）
                score += res.seedsConsumed;

                // 新しい候補を作成
                const newPath = [...current.path, { id: conf.id, rolls: 1 }];
                const newLastDraw = { 
                    rarity: res.rarity, 
                    charId: res.charId, 
                    isRerolled: res.isRerolled 
                };

                // もしこれでゴールなら即終了
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

        if (nextCandidates.length === 0) break; // 手詰まり

        // スコア順にソート (降順)
        nextCandidates.sort((a, b) => b.score - a.score);

        // 重複除去（同じ到達点・同じLastDrawなら、スコアが高い方だけ残す）
        const uniqueCandidates = [];
        const seenState = new Set();

        for (const cand of nextCandidates) {
            const stateKey = `${cand.idx}-${cand.lastDraw.charId}`;
            if (!seenState.has(stateKey)) {
                seenState.add(stateKey);
                uniqueCandidates.push(cand);
            }
            if (uniqueCandidates.length >= BEAM_WIDTH) break;
        }

        candidates = uniqueCandidates;
    }

    return null; // ルートが見つからなかった
}

/**
 * ルート配列をConfig文字列に圧縮する
 * [{id:A}, {id:A}, {id:B}] -> "A 2 B 1"
 */
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
            // 通常ロール同士は結合
            count += (step.rolls || 1);
        } else {
            // 切り替わりまたは確定枠
            compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
            currentId = step.id;
            isG = stepG;
            count = step.rolls || 1;
        }
    }
    // 最後の一つ
    compressed.push(`${currentId} ${count}${isG ? 'g' : ''}`);
    return compressed.join(" ");
}