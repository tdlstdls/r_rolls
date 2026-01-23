/** @file sim_engine_config.js @description 経路探索の統合制御（ターゲットインデックス同期・末尾アクション自動付加版） */

/**
 * 経路探索エントリポイント（自動バックトラック・特定量短縮版）
 */
function calculateRouteToCell(targetSeedIndex, targetGachaId, visibleGachaIds, currentConfigStr, finalActionOverride = null, primaryTargetId = null) {
    const estimatedNeededSeeds = Math.max(targetSeedIndex, 1000) + 500;
    const simSeeds = generateSeedsForSim(estimatedNeededSeeds);

    const usableConfigs = visibleGachaIds.map(idStr => {
        const id = idStr.replace(/[gfs]$/, '');
        const config = gachaMasterData.gachas[id] || null;
        if (config) config._fullId = idStr;
        return config;
    }).filter(c => c !== null);

    const maxPlat = parseInt(document.getElementById('sim-max-plat')?.value || 0, 10);
    const maxGuar = parseInt(document.getElementById('sim-max-guar')?.value || 0, 10);

    let workingConfig = currentConfigStr;
    const MAX_RETRIES = 8;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const { startIdx, initialLastDraw, baseSegments } = calculateInitialState(workingConfig, targetSeedIndex, simSeeds);

        // 探索実行（allowOvershoot = false で厳密一致を要求）
        let route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, 0, 0, false);
        
        if (!route && (maxGuar > 0 || maxPlat > 0)) {
            route = findPathBeamSearch(startIdx, targetSeedIndex, targetGachaId, usableConfigs, simSeeds, initialLastDraw, primaryTargetId, maxPlat, maxGuar, false);
        }

        if (route) {
            // ルート発見成功
            if (finalActionOverride) route.push(finalActionOverride);
            else route.push({ id: targetGachaId.replace(/[gfs]$/, ""), rolls: 1, g: false, fullId: targetGachaId });
            
            return compressRoute([...baseSegments, ...route]);
        }

        // --- ルートが見つからない場合のバックトラック処理 ---
        if (attempt < MAX_RETRIES && workingConfig && workingConfig.trim() !== "") {
            const segments = parseSimConfig(workingConfig);
            const totalRolls = segments.reduce((sum, s) => sum + s.rolls, 0);
            
            // 「1/10」または「10ロール」のいずれか小さい方（最低1ロール） [修正]
            const backtrackAmount = Math.max(1, Math.min(Math.floor(totalRolls / 10), 10));
            
            console.log(`[Sim] ルートが見つかりません。${backtrackAmount}ロール分戻って再探索します (${attempt + 1}/${MAX_RETRIES})`);
            
            for (let i = 0; i < backtrackAmount; i++) {
                workingConfig = decrementLastRollOrRemoveSegment(workingConfig);
                if (!workingConfig) break;
            }
        } else {
            break;
        }
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
            const res = simulateSingleSegment(segment, tempIdx, tempLastDraw, simSeeds, 'sim');
            
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