/** @file logic_reroll.js @description 再抽選実行ロジック（スロット除外・多重再抽選対応版） */
function executeReroll(startIndex, duplicateSlotIndex, characterPool, seeds, charIdToAvoid) {
    let character = null;
    let rerollProcess = { attempts: [] };
    let rerollAttempt = 0;

    // プールにキャラが1体しかいない場合は再抽選不可
    if (characterPool.length <= 1) {
        return { character: null, seedsConsumed: 2, rerollProcess: null };
    }

    while (true) {
        const rerollSeedIndex = startIndex + 2 + rerollAttempt;
        
        // 再抽選用のシードが存在するかチェック
        if (rerollSeedIndex >= seeds.length) {
            // これ以上再抽選できない場合は、被りを許容して終了（消費SEEDは通常分のみ）
            return { character: null, seedsConsumed: 2, rerollProcess: rerollProcess };
        }

        const totalChars = characterPool.length;
        const rerollSeed = seeds[rerollSeedIndex];
        
        // (キャラ総数 - 1) を法として剰余を計算
        const tempSlot = rerollSeed % (totalChars - 1);
        
        // 一時的なプールのスロットを、元のプールのスロットにマッピングする
        const finalSlot = tempSlot < duplicateSlotIndex ? tempSlot : tempSlot + 1;
        
        character = characterPool[finalSlot];

        // デバッグ用の情報を記録
        rerollProcess.attempts.push({
            rerollSeedIndex: rerollSeedIndex,
            rerollSeed: rerollSeed,
            tempPoolSize: totalChars - 1,
            tempSlot: tempSlot,
            finalSlot: finalSlot,
            foundCharId: character.id
        });

        // 被りIDと異なるキャラが出たらループ終了
        if (String(character.id) !== String(charIdToAvoid)) {
            break;
        }

        // 被っていた場合は次のSEEDで再試行
        rerollAttempt++;
    }

    // 消費したSEED数 = 通常抽選(2) + 再抽選試行回数(rerollAttempt + 1)
    const seedsConsumed = 2 + rerollAttempt + 1;

    return { character, seedsConsumed, rerollProcess };
}