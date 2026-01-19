/** @file sim_engine_config.js @description 経路探索の統合制御（ターゲットインデックス同期・末尾アクション自動付加版） */

/**
 * 経路探索エントリポイント
 * 指定されたセル（targetSeedIndex）まで正確に到達し、最後にそのセルを1回引くアクションを追加します [cite: 257, 265]。
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    // 1. 必要な乱数シードを生成 [cite: 258]
    const estimatedNeededSeeds = Math.max(targetSeedIndex, 1000) + 500;
    const simSeeds = generateSeedsForSim(estimatedNeededSeeds);

    // 2. 現在の入力値（sim-config）を解析し、開始地点の状態を算出 [cite: 258, 281]
    const { startIdx, initialLastDraw, baseSegments } = calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds);

    // 3. 利用可能なガチャ設定のリストを作成 [cite: 259]
    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);

    if (usableConfigs.length === 0) return null;

    // UIから探索制限（プラチナ/確定使用数）を取得 [cite: 260, 261]
    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);

    // 4. ビームサーチの実行 [cite: 262-264, 317]
    // startIdx から targetSeedIndex に到達するまでの「過程」を探索します
    let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0);
    if (!route && maxGuar > 0) {
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, maxGuar);
    }
    if (!route && maxPlat > 0) {
        route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar);
    }
    
    // 5. 経路の構築と最終アクションの付加
    if (route) {
        if (finalActionOverride) {
            // 確定枠（G列）をクリックした場合は、指定された確定アクションを付加 [cite: 265, 485]
            route.push(finalActionOverride);
        } else {
            // 通常セルをクリックした場合は、そのセルのガチャIDで「1回引く」アクションを末尾に追加 [cite: 242-244]
            // これにより、ルートの終端がクリックしたキャラと一致します
            const baseId = targetGachaId.replace(/[gfs]$/, "");
            route.push({ 
                id: baseId, 
                rolls: 1, 
                g: false, 
                fullId: targetGachaId 
            });
        }

        // 固定済みルート（既設分）と新規探索ルートを結合 [cite: 266, 286]
        const fullRoute = [...baseSegments, ...route];

        // 重複セグメントを圧縮して文字列で返す [cite: 275, 403]
        return compressRoute(fullRoute);
    }
    
    return null;
}

/**
 * 探索用の乱数シード配列を生成 [cite: 277-280]
 */
function generateSeedsForSim(targetSeedIndex) {
    const seedEl = document.getElementById('seed');
    const initialSeed = parseInt(seedEl ? seedEl.value : 12345, 10);
    const rng = new Xorshift32(initialSeed);
    const tempSeeds = [];
    
    const limit = Math.max(targetSeedIndex, 1000) + 500;
    for (let i = 0; i < limit; i++) {
        tempSeeds.push(rng.next());
    }
    return tempSeeds;
}

/**
 * 現在のルート入力値（sim-config）を解析し、探索を開始すべき地点の状態を算出 [cite: 281-287]
 */
function calculateInitialState(currentConfigStr, targetSeedIndex, simSeeds) {
    let startIdx = 0;
    let initialLastDraw = null;
    let validConfigParts = [];

    if (currentConfigStr && currentConfigStr.trim() !== "") {
        const existingConfigs = parseSimConfig(currentConfigStr);
        let tempIdx = 0;
        let tempLastDraw = null;

        for (const segment of existingConfigs) {
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds);
            
            // ターゲット（クリック箇所）を追い越す設定は除外 [cite: 283]
            if (res.nextIndex > targetSeedIndex) break;

            validConfigParts.push(segment);
            tempIdx = res.nextIndex; 
            tempLastDraw = res.trackStates; // トラックの状態を継承 [cite: 289]
            
            if (tempIdx === targetSeedIndex) break;
        }
        startIdx = tempIdx;
        initialLastDraw = tempLastDraw;
    }
    
    return { 
        startIdx, 
        initialLastDraw, 
        baseSegments: validConfigParts 
    };
}