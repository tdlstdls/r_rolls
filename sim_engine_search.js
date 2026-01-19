/** @file sim_engine_search.js @description ビームサーチによる経路探索アルゴリズム（インデックス線形同期・状態遷移完全整合版） */

/**
 * ビームサーチ本体
 * インデックスの線形的な進展とレア被りによるトラック遷移を考慮し、ターゲットへ正確に到達する経路を探索します。
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar) {
    const BEAM_WIDTH = 25;
    const MAX_STEPS = 2000; // 探索の最大ステップ数
    
    // ターゲットガチャを評価の優先順位に反映するためソート
    const sortedConfigs = [...configs].sort((a, b) => (a._fullId == targetGachaId ? -1 : 1));

    // 探索候補の初期化
    // idx: 現在のSEEDインデックス
    // lastDraw: 前のステップからのトラック状態（lastA, lastB, lastAction）を保持
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
        let nextCandidates = [];

        for (const current of candidates) {
            // ターゲットインデックスにピッタリ到達したかチェック
            // インデックスが一致すれば、SEEDの消費履歴とトラック状態が物理テーブルと完全に同期していることを意味します
            if (current.idx === targetIdx) {
                return current.path;
            }

            // 次の候補を展開（1回引く、または確定11連を試行）
            const expanded = expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId);
            nextCandidates.push(...expanded);
        }

        if (nextCandidates.length === 0) break;

        // スコア順にソート（目標への近さ、レアキャラ発見、ガチャの継続性などを評価）
        nextCandidates.sort((a, b) => b.score - a.score);

        // 同一インデックスかつ同一状態の重複を除去して効率化
        const uniqueCandidates = filterUniqueCandidates(nextCandidates);

        // トラックA(偶数)とトラックB(奇数)の候補をバランスよく残すことで、
        // 片方のトラックで探索が詰まる（デッドエンド）を防止します
        const trackA = uniqueCandidates.filter(c => c.idx % 2 === 0);
        const trackB = uniqueCandidates.filter(c => c.idx % 2 !== 0);
        
        const halfBeam = Math.ceil(BEAM_WIDTH / 2);
        const bestA = trackA.slice(0, halfBeam);
        const bestB = trackB.slice(0, halfBeam);
        
        candidates = [...bestA, ...bestB].sort((a, b) => b.score - a.score).slice(0, BEAM_WIDTH);
    }
    
    return null; // 経路が見つからなかった場合
}

/**
 * 現時点からの可能なアクション（通常ロール/確定ロール）を展開
 */
function expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId) {
    const results = [];
    const distToTarget = targetIdx - current.idx;
    
    if (distToTarget < 0) return results;

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

            // 到達先がターゲットを超えない場合に候補として採用
            if (segResult.nextIndex <= targetIdx) {
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

            if (segResult.nextIndex <= targetIdx) {
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