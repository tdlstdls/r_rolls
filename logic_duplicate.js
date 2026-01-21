/** @file logic_duplicate.js @description レア被り判定ロジック */
function checkDuplicateStatus(currentCharId, lastDrawInfo, mode = 'table') {
    if (!lastDrawInfo) return { targetToAvoid: null, isConsecutiveRerollTarget: false };

    const idAboveOriginal = lastDrawInfo.originalIdAbove ? String(lastDrawInfo.originalIdAbove) : null;
    const idSourceFinal = lastDrawInfo.finalIdSource ? String(lastDrawInfo.finalIdSource) : null;

    // ルートの連続性（遷移元）を最優先でチェック
    if (idSourceFinal && currentCharId === idSourceFinal) {
        const isR = idAboveOriginal && currentCharId !== idAboveOriginal;
        return { targetToAvoid: idSourceFinal, isConsecutiveRerollTarget: isR };
    }

    // テーブルモードでは、物理的な直上との一致もチェックする
    if (mode === 'table') {
        if (idAboveOriginal && currentCharId === idAboveOriginal) {
            return { targetToAvoid: idAboveOriginal, isConsecutiveRerollTarget: false };
        }
    }

    return { targetToAvoid: null, isConsecutiveRerollTarget: false };
}