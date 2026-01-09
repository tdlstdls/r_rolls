/** @file sim_engine_search.js @description ビームサーチによる経路探索アルゴリズム（ターゲットSEEDインデックス・トラック同期完全版） */

/**
 * ビームサーチ本体
 * 各ステップで上位候補を保持しつつ、ターゲットのインデックス（A/Bトラック含む）に正確に一致する経路を探します。
 */
function findPathBeamSearch(startIdx, targetIdx, targetGachaId, configs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar) {
    const BEAM_WIDTH = 25;
    const MAX_STEPS = 1500; 
    
    // ターゲットガチャを優先的に評価するためソート
    const sortedConfigs = [...configs].sort((a, b) => (a._fullId == targetGachaId ? -1 : 1));

    // 探索候補の初期化
    // idx: 現在のSEEDインデックス（これが奇数ならB、偶数ならAトラック）
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
            // 【重要】ターゲットインデックスに「ピッタリ」到達したかチェック
            // インデックスが一致していれば、トラック(A/B)も物理行も一致しています
            if (current.idx === targetIdx) {
                return current.path;
            }

            // 次の候補を展開
            const expanded = expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId);
            nextCandidates.push(...expanded);
        }

        if (nextCandidates.length === 0) break;

        // スコア順にソート（目標に近い、かつ加点要素が多いものを優先）
        nextCandidates.sort((a, b) => b.score - a.score);

        // 同一状態の重複を除去（効率化）
        const uniqueCandidates = filterUniqueCandidates(nextCandidates);

        // トラックA(偶数)とトラックB(奇数)の候補をバランスよく残す（ビーム幅の半分ずつ）
        // これにより「特定のトラックに偏って探索が詰まる」現象を防ぎます
        const trackA = uniqueCandidates.filter(c => c.idx % 2 === 0);
        const trackB = uniqueCandidates.filter(c => c.idx % 2 !== 0);
        
        const halfBeam = Math.ceil(BEAM_WIDTH / 2);
        const bestA = trackA.slice(0, halfBeam);
        const bestB = trackB.slice(0, halfBeam);
        
        candidates = [...bestA, ...bestB].sort((a, b) => b.score - a.score).slice(0, BEAM_WIDTH);
    }
    
    return null;
}

/**
 * 候補展開処理
 */
function expandCandidates(current, targetIdx, targetGachaId, sortedConfigs, simSeeds, maxPlat, maxGuar, primaryTargetId) {
    const results = [];
    const dist = targetIdx - current.idx;
    
    // ターゲットを既に追い越している場合はこれ以上展開しない
    if (dist < 0) return results;

    const lastGachaId = current.path.length > 0 ? current.path[current.path.length - 1].id : null;

    for (const conf of sortedConfigs) {
        const isPlat = conf.name.includes('プラチナ') || conf.name.includes('レジェンド');
        const isG = conf._fullId.endsWith("g");

        // 1. 通常ロール（1回分）を試行
        if (!isPlat || current.platUsed < maxPlat) {
            // 物理的な「直上のセル（2つ前のインデックス）」から排出されるキャラを算出
            // レア被り判定（logic_duplicate.js）において、テーブル上の物理配置との一致を確認するために必要
            let originalIdAbove = null;
            if (current.idx >= 2) {
                const s0_above = simSeeds[current.idx - 2];
                const s1_above = simSeeds[current.idx - 1];
                const rarityAbove = determineRarity(s0_above, conf.rarity_rates);
                const poolAbove = conf.pool[rarityAbove] || [];
                if (poolAbove.length > 0) {
                    originalIdAbove = String(poolAbove[s1_above % poolAbove.length].id);
                }
            }

            const drawContext = {
                originalIdAbove: originalIdAbove,
                finalIdSource: current.lastDraw ? String(current.lastDraw.charId) : null
            };

            // ロジック層の共通関数で実際の消費SEED数（rr.seedsConsumed）を算出
            const res = rollWithSeedConsumptionFixed(current.idx, conf, simSeeds, drawContext);

            // 到達先がターゲットを超えない場合に候補として採用
            if (current.idx + res.seedsConsumed <= targetIdx) {
                const newDraw = { 
                    rarity: res.rarity, 
                    charId: res.charId, 
                    originalCharId: res.originalChar ? String(res.originalChar.id) : String(res.charId)
                };

                results.push({ 
                    idx: current.idx + res.seedsConsumed, 
                    path: [...current.path, { id: conf.id, rolls: 1, g: false, fullId: conf._fullId }], 
                    lastDraw: newDraw, 
                    score: calculateScore(current.score, res, dist, targetIdx, primaryTargetId, conf.id, lastGachaId, targetGachaId, current.lastDraw), 
                    platUsed: isPlat ? current.platUsed + 1 : current.platUsed, 
                    guarUsed: current.guarUsed 
                });
            }
        }

        // 2. 確定ロール（11連等）を試行
        if (!isPlat && current.guarUsed < maxGuar && isG) {
            // 確定枠シミュレーション（内部でレア被りを考慮しながら11回分回す）
            const res = simulateSingleSegment({id: conf.id, rolls: 11, g: true}, current.idx, current.lastDraw, simSeeds);
            
            if (res.nextIndex <= targetIdx) {
                results.push({ 
                    idx: res.nextIndex, 
                    path: [...current.path, { id: conf.id, rolls: 11, g: true, fullId: conf._fullId }], 
                    lastDraw: res.trackStates.lastAction, // 確定枠最後のキャラ情報を継承
                    score: current.score - 800, // 確定枠は貴重なため、極力温存するルートを優先
                    platUsed: current.platUsed, 
                    guarUsed: current.guarUsed + 1 
                });
            }
        }
    }
    return results;
}

/**
 * 同一状態の候補をフィルタリング
 */
function filterUniqueCandidates(candidates) {
    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
        // インデックス、直前のキャラID、リソース使用状況が同じなら同一状態とみなす
        const key = `${c.idx}-${c.lastDraw?.charId}-${c.platUsed}-${c.guarUsed}`;
        if (!seen.has(key)) { 
            seen.add(key); 
            unique.push(c);
        }
    }
    return unique;
}

/**
 * 探索スコア計算
 */
function calculateScore(currentScore, res, dist, targetIdx, primaryTargetId, confId, lastGachaId, targetGachaId, lastDraw) {
    let s = currentScore;

    // 1. 同一ガチャ継続ボーナス（頻繁なガチャ切り替えを抑止）
    if (lastGachaId && confId === lastGachaId) {
        s += 150;
    } 
    // ターゲットガチャ（クリックした列）を優先
    else if (confId === targetGachaId.replace(/[gfs]$/, '')) {
        s += 50;
    }

    // 2. ターゲットキャラ発見ボーナス
    if (primaryTargetId && String(res.charId) === String(primaryTargetId)) {
        s += 5000;
    }

    // 3. 限定・伝説レアリティ加点
    const charId = String(res.charId);
    if (typeof limitedCats !== 'undefined' && limitedCats.includes(parseInt(charId))) {
        s += 300;
    }
    if (res.rarity === 'legend') {
        s += 1000;
    } else if (res.rarity === 'uber') {
        s += 200;
    }
    
    // 4. 到達度ボーナス（ターゲットに近いほど高得点）
    const progress = (res.startIndex || 0) / targetIdx;
    
    // 消費したSEED分を加算しつつ、進行状況を重視
    return s + res.seedsConsumed + (progress * 100);
}