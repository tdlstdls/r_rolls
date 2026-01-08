/** @file sim_engine_config.js @description 経路構成文字列の解析と圧縮 */

/**
 * 経路構成文字列の解析
 */
function parseSimConfig(str) {
    if (!str) return [];
    const tokens = str.trim().split(/\s+/);
    const segments = [];
    for (let i = 0; i < tokens.length; i += 2) {
        if (i + 1 >= tokens.length) break;
        const fullId = tokens[i];
        const rolls = parseInt(tokens[i + 1]);
        if (isNaN(rolls)) continue;
        const g = fullId.endsWith("g");
        const baseId = g ? fullId.slice(0, -1) : fullId;
        segments.push({ id: baseId, fullId: fullId, rolls: rolls, g: g });
    }
    return segments;
}

/**
 * 経路構成オブジェクトの文字列化
 */
function stringifySimConfig(parts) {
    return parts.map(p => `${p.fullId || (p.id + (p.g ? "g" : ""))} ${p.rolls}`).join(" ");
}

/**
 * 経路の圧縮
 */
function compressRoute(route) {
    if (route.length === 0) return "";
    let compressed = [];
    let current = { ...route[0] };
    for (let i = 1; i < route.length; i++) {
        const currentFullId = current.fullId || (current.id + (current.g ? "g" : ""));
        const targetFullId = route[i].id + (route[i].g ? "g" : "");
        if (targetFullId === currentFullId && !current.g) {
            current.rolls += route[i].rolls;
        } else {
            compressed.push(current);
            current = { ...route[i], fullId: targetFullId };
        }
    }
    compressed.push(current);
    return stringifySimConfig(compressed);
}