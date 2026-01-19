/** @file sim_ui_logic.js @description UI表示用の回避・誘発判定ロジック */

/** セルに対応するConfigを取得 [cite: 251-254] */
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

/** 再抽選後のキャラ名を取得 [cite: 255-257] */
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

/** 回避・誘発判定 [cite: 258-276] */
function checkAvoidanceAndForcing(seedIndex, currentGachaId, tableData, gachaConfigs, cellSimConfigs, newRow1Index) {
    const i = Math.floor(seedIndex / 2);
    if (i < newRow1Index) return { link: null, rerollCharName: null };

    const gachaIndex = gachaConfigs.findIndex(c => c.id === currentGachaId);
    if (gachaIndex === -1 || !tableData[seedIndex] || !tableData[seedIndex][gachaIndex]) {
        return { link: null, rerollCharName: null };
    }

    const currentRoll = tableData[seedIndex][gachaIndex].roll;
    const isRerolled = currentRoll.isRerolled;
    const originalCharId = currentRoll.originalChar?.id;
    const originalRarity = currentRoll.rarity;
    if (originalRarity !== 'rare' || !originalCharId) return { link: null, rerollCharName: null };

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

/** 誘発可能判定 [cite: 277-283] */
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

/** 回避可能判定 [cite: 284-290] */
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