/**
 * @file sim_engine_search.js
 * @description ビームサーチによる目的セルへの最短・最適経路探索
 * @input_data targetIdx, targetGachaId, usableConfigs, maxPlat, maxGuar
 * @output_data path (最短アクション配列)
 */

/**
 * ビームサーチを用いて目標インデックスまでのアクション経路を探索する
 * @param {number} startIdx - 探索を開始する現在のSEEDインデックス
 * @param {number} targetIdx - 到達目標とするSEEDインデックス
 * @param {string} targetGachaId - 目標セルで使用するガチャID
 * @param {Array} configs - 探索中に利用可能なガチャ設定の配列
 * @param {Array} simSeeds - シミュレーション用乱数配列
 * @param {Object} initialLastDraw - 開始地点でのトラック状態
 * @param {string|null} primaryTargetId - 優先して発見したい特定のキャラID
 * @param {number} maxPlat - 使用を許可するプラチナチケットの最大数
 * @param {number} maxGuar - 使用を許可する確定11連の最大数
 * @returns {Array|null} アクションオブジェクトの配列。見つからない場合はnull
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar) {
    const BEAM_WIDTH = 25;
    const MAX_STEPS = 2000; // 探索の最大ステップ数
    
    // ターゲットガチャを評価の優先順位に反映するためソート
    const sortedConfigs = [...configs].sort((a, b) => (a._fullId == targetGachaId ? -1 : 1));

    let candidates = [{ 
        idx: startIdx, 
        path: [], 
        lastDraw: initialLastDraw, 
        score: 0, 
        platUsed: 0, 
        guarUsed: 0 
    }];

    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        console.group(`[findPathBeamSearch] Loop ${loopCount}`);
        console.log(`Current candidates: ${candidates.length}`, candidates.map(c => `idx:${c.idx} score:${c.score.toFixed(0)}`));

        let nextCandidates = [];

        for (const current of candidates) {
            // ターゲットインデックスにピッタリ到達したかチェック
            if (current.idx === targetIdx) {
                console.log(`%c[findPathBeamSearch] Success: Exact match found at index ${targetIdx}`, 'color: #28a745; font-weight: bold;');
                console.groupEnd();
                return current.path;
            }

            // 次の候補を展開
            const expanded = expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId);
            nextCandidates.push(...expanded);
        }

        if (nextCandidates.length === 0) {
            console.warn('[findPathBeamSearch] Terminated: No next candidates could be generated.');
            console.groupEnd();
            break;
        }
        console.log(`Generated ${nextCandidates.length} next candidates.`);

        // スコア順にソート
        nextCandidates.sort((a, b) => b.score - a.score);

        // 同一インデックスかつ同一状態の重複を除去
        const uniqueCandidates = filterUniqueCandidates(nextCandidates);
        console.log(`Reduced to ${uniqueCandidates.length} unique candidates.`);
        if (uniqueCandidates.length > 0) {
            const scoreRange = `min: ${uniqueCandidates[uniqueCandidates.length - 1].score.toFixed(0)}, max: ${uniqueCandidates[0].score.toFixed(0)}`;
            console.log(`Unique candidate score range: ${scoreRange}`);
        }
        
        // トラックA(偶数)とトラックB(奇数)の候補をバランスよく残す
        const trackA = uniqueCandidates.filter(c => c.idx % 2 === 0);
        const trackB = uniqueCandidates.filter(c => c.idx % 2 !== 0);
        
        const halfBeam = Math.ceil(BEAM_WIDTH / 2);
        const bestA = trackA.slice(0, halfBeam);
        const bestB = trackB.slice(0, halfBeam);
        
        candidates = [...bestA, ...bestB].sort((a, b) => b.score - a.score).slice(0, BEAM_WIDTH);
        
        console.log(`Pruned to ${candidates.length} candidates for next loop (A: ${bestA.length}, B: ${bestB.length})`);
        console.groupEnd();
    }
    
    if (loopCount >= MAX_STEPS) {
        console.warn(`[findPathBeamSearch] Terminated: Reached MAX_STEPS (${MAX_STEPS}).`);
    }

    // --- ループ終了: 完全一致する経路が見つからなかった場合のフォールバック ---
    console.log('[findPathBeamSearch] No exact match found. Looking for best overshooting candidate...');
    const validOvershoots = candidates.filter(c => c.idx >= targetIdx);

    if (validOvershoots.length > 0) {
        validOvershoots.sort((a, b) => a.idx - b.idx);
        const bestFit = validOvershoots[0];
        console.log(`%c[findPathBeamSearch] Fallback success: Found overshooting path. Target=${targetIdx}, Found=${bestFit.idx}`, 'color: #e67e22; font-weight: bold;');
        return bestFit.path;
    }

    console.error('[findPathBeamSearch] Fallback failed: No candidate reached or passed the target index.');
    return null; // 経路が見つからなかった場合
}

/**
 * 現時点からの可能なアクション（通常ロール/確定ロール）を展開
 */
function expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId) {
    const results = [];
    const OVERSHOOT_ALLOWANCE = 10;
    const distToTarget = targetIdx - current.idx;
    
    if (distToTarget < -OVERSHOOT_ALLOWANCE) return results;

    const lastGachaId = current.path.length > 0 ? current.path[current.path.length - 1].id : null;

    for (const conf of sortedConfigs) {
        const isPlat = conf.name.includes('プラチナ') || conf.name.includes('レジェンド');
        const isGuaranteedGacha = conf._fullId.endsWith("g");

        // --- 1. 通常ロール（1回分）の試行 ---
        if (!isPlat || current.platUsed < maxPlat) {
            // 単一ロールのシミュレーション
            // simulateSingleSegment を利用することで、レア被り判定と状態更新を logic_roll_core と同期させる
            const segResult = simulateSingleSegment(
                { id: conf.id, rolls: 1, g: false }, 
                current.idx, 
                current.lastDraw, 
                simSeeds
            );

            // 到達先がターゲットを少し超える程度まで許容
            if (segResult.nextIndex <= targetIdx + OVERSHOOT_ALLOWANCE) {
                // 今回のロール結果（lastAction）を取得
                const rollInfo = segResult.trackStates.lastAction;
                
                results.push({ 
                    idx: segResult.nextIndex, 
                    path: [...current.path, { id: conf.id, rolls: 1, g: false, fullId: conf._fullId }], 
                    lastDraw: segResult.trackStates, 
                    score: calculateScore(current.score, rollInfo, segResult.nextIndex - current.idx, targetIdx, primaryTargetId, conf.id, lastGachaId, targetGachaId), 
                    platUsed: isPlat ? current.platUsed + 1 : current.platUsed, 
                    guarUsed: current.guarUsed 
                });
            }
        }

        // --- 2. 確定ロール（11連等）の試行 ---
        // ターゲットガチャが確定設定（g）かつ、リソースに余裕がある場合
        if (!isPlat && current.guarUsed < maxGuar && isGuaranteedGacha) {
            // 確定枠シミュレーション
            const segResult = simulateSingleSegment(
                { id: conf.id, rolls: 11, g: true }, 
                current.idx, 
                current.lastDraw, 
                simSeeds
            );

            if (segResult.nextIndex <= targetIdx + OVERSHOOT_ALLOWANCE) {
                results.push({ 
                    idx: segResult.nextIndex, 
                    path: [...current.path, { id: conf.id, rolls: 11, g: true, fullId: conf._fullId }], 
                    lastDraw: segResult.trackStates, 
                    score: current.score - 1000, // 確定枠消費のペナルティ（温存を優先）
                    platUsed: current.platUsed, 
                    guarUsed: current.guarUsed + 1 
                });
            }
        }
    }
    return results;
}

/**
 * 状態の同一性チェックによる重複排除
 */
function filterUniqueCandidates(candidates) {
    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
        // インデックス、直近のキャラID、リソース使用状況をキーにする
        const charId = c.lastDraw?.lastAction?.charId || 'none';
        const key = `${c.idx}-${charId}-${c.platUsed}-${c.guarUsed}`;
        if (!seen.has(key)) { 
            seen.add(key); 
            unique.push(c);
        }
    }
    return unique;
}

/**
 * 探索スコア計算
 * ガチャの切り替え回数や、目的のキャラの発見、レアリティを評価します。
 */
function calculateScore(currentScore, rollInfo, consumed, targetIdx, primaryTargetId, confId, lastGachaId, targetGachaId) {
    let s = currentScore;
    
    // ガチャの継続性ボーナス（頻繁な切り替えを抑制）
    if (lastGachaId && confId === lastGachaId) {
        s += 100;
    } else if (confId === targetGachaId.replace(/[gfs]$/, '')) {
        s += 50;
    }

    // ターゲットキャラ発見ボーナス
    if (primaryTargetId && String(rollInfo.charId) === String(primaryTargetId)) {
        s += 10000; // 最優先
    }

    // レアリティ加点
    const charId = parseInt(rollInfo.charId);
    if (typeof limitedCats !== 'undefined' && limitedCats.includes(charId)) {
        s += 500;
    }
    
    if (rollInfo.rarity === 'legend') {
        s += 2000;
    } else if (rollInfo.rarity === 'uber') {
        s += 300;
    }
    
    // 到達度ボーナス（ターゲットに近いほど高得点）
    const progress = (rollInfo.startIndex || 0) / targetIdx;
    return s + consumed + (progress * 200);
}