/** @file sim_config_helpers.js @description Config文字列の解析・生成ヘルパー */

/** Config文字列をオブジェクト配列に変換 [cite: 230-233] */
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

/** オブジェクト配列をConfig文字列に変換 [cite: 235] */
function stringifySimConfig(configArr) {
    return configArr.map(c => `${c.id} ${c.rolls}${c.g ? 'g' : ''}`).join(' ');
}

/** 最後のロール回数を1増やす [cite: 236-239] */
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

/** 最後のロールを1減らす、またはセグメントを削除 [cite: 240-243] */
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

/** 最後のConfigセグメントを削除 [cite: 244-245] */
function removeLastConfigSegment(configStr) {
    if (!configStr) return "";
    const configs = parseSimConfig(configStr);
    if (configs.length > 0) {
        configs.pop();
    }
    return stringifySimConfig(configs);
}

/** 確定枠設定の生成 [cite: 246-250] */
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