/**
 * @file sim_engine_search.js
 * @description ビームサーチによる目的セルへの最短・最適経路探索
 * @input_data targetIdx, targetGachaId, usableConfigs, maxPlat, maxGuar
 * @output_data path (最短アクション配列)
 */

/**
 * ビームサーチを用いて目標インデックスまでのアクション経路を探索する
 * [修正] allowOvershoot フラグを追加し、デフォルトでは厳密一致のみを許可します
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar, allowOvershoot = false) {
    const BEAM_WIDTH = 25;
    const MAX_STEPS = 2000;
    
    const sortedConfigs = [...configs].sort((a, b) => (a._fullId == targetGachaId ? -1 : 1));
    let candidates = [{ idx: startIdx, path: [], lastDraw: initialLastDraw, score: 0, platUsed: 0, guarUsed: 0 }];
    let loopCount = 0;

    while (candidates.length > 0 && loopCount < MAX_STEPS) {
        loopCount++;
        let nextCandidates = [];

        for (const current of candidates) {
            // ターゲットインデックス（＝トラックの一致を含む）にピッタリ到達したかチェック
            if (current.idx === targetIdx) {
                return current.path;
            }
            const expanded = expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId);
            nextCandidates.push(...expanded);
        }

        if (nextCandidates.length === 0) break;

        nextCandidates.sort((a, b) => b.score - a.score);
        const uniqueCandidates = filterUniqueCandidates(nextCandidates);
        
        const trackA = uniqueCandidates.filter(c => c.idx % 2 === 0);
        const trackB = uniqueCandidates.filter(c => c.idx % 2 !== 0);
        const halfBeam = Math.ceil(BEAM_WIDTH / 2);
        
        candidates = [...trackA.slice(0, halfBeam), ...trackB.slice(0, halfBeam)]
                        .sort((a, b) => b.score - a.score).slice(0, BEAM_WIDTH);
    }
    
    // --- 厳密一致が見つからなかった場合 ---
    if (allowOvershoot) {
        const validOvershoots = candidates.filter(c => c.idx >= targetIdx);
        if (validOvershoots.length > 0) {
            validOvershoots.sort((a, b) => a.idx - b.idx);
            return validOvershoots[0].path;
        }
    }

    return null; // 見つからない場合は null を返し、呼び出し元で再試行を誘発させる
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
                simSeeds,
                'sim'
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