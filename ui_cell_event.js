/** @file ui_cell_event.js @description ガチャセルクリック時のイベントハンドラ（算出過程ポップアップ・確定枠線形シミュレーション完全版） */

/**
 * テーブル上のガチャセル、または確定枠（G列）をクリックした際のハンドラ
 */
function onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType = null, fromFind = false, targetCharId = null) {
    // 1. シミュレーションモードがOFFの場合は、ONに切り替えてから実行
    if (!isSimulationMode) {
        toggleAppMode();
        const notifEl = document.getElementById('sim-notif-msg');
        if (notifEl) {
            notifEl.style.display = 'block';
            notifEl.style.color = '#007bff';
            notifEl.textContent = 'Simモードに切り替えてルートを探索します...';
            setTimeout(() => { if (notifEl.textContent && notifEl.textContent.includes('Simモード')) notifEl.style.display = 'none'; }, 2000);
        }

        // モード切替後の再描画と状態遷移を待ってから再試行
        setTimeout(() => {
            onGachaCellClick(targetSeedIndex, gachaId, charName, guaranteedType, fromFind, targetCharId);
        }, 150);
        return;
    }

    // メッセージエリアのクリア
    const errorEl = document.getElementById('sim-error-msg');
    const notifEl = document.getElementById('sim-notif-msg');
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (notifEl) { notifEl.textContent = ''; notifEl.style.display = 'none'; }

    const visibleIds = tableGachaIds.map(id => id);
    const configInput = document.getElementById('sim-config');
    const currentConfig = configInput ? configInput.value : "";

    if (typeof calculateRouteToCell === 'function') {
        let routeResult = null;
        if (guaranteedType) {
            const rollsCount = parseInt(guaranteedType.replace('g', ''), 10);
            const finalAction = { 
                id: gachaId, 
                rolls: rollsCount, 
                g: true,
                fullId: gachaId + 'g'
            };
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, finalAction, targetCharId);
        } else {
            routeResult = calculateRouteToCell(targetSeedIndex, gachaId, visibleIds, currentConfig, null, targetCharId);
        }

        if (routeResult) {
            if (configInput) {
                configInput.value = routeResult;
                if (typeof updateUrlParams === 'function') updateUrlParams();
                resetAndGenerateTable();
                
                if (notifEl) {
                    const row = Math.floor(targetSeedIndex / 2) + 1;
                    const side = (targetSeedIndex % 2 === 0) ? 'A' : 'B';
                    notifEl.style.display = 'block';
                    notifEl.style.color = '#28a745';
                    notifEl.textContent = `${side}${row}セルへのルートを更新しました`;
                    setTimeout(() => { if(notifEl) notifEl.style.display = 'none'; }, 3000);
                }
            }
        } else {
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.style.color = '#d9534f';
                errorEl.textContent = '見つかりませんでした';
                setTimeout(() => {
                    if(errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
                }, 1500);
            }
        }
    }
}

/**
 * SEED表示モード時に詳細な算出過程をポップアップ表示する
 */
function showRollProcessPopup(seedIndex, gachaId, colIndex, isGuaranteed = false, isAlt = false) {
    if (!currentTableData) return;
    const rowData = currentTableData[seedIndex];
    const cellData = rowData?.cells?.[colIndex];
    if (!cellData) return;

    const gachaConfig = gachaMasterData.gachas[gachaId];
    if (!gachaConfig) return;

    let html = `<div style="font-family: monospace; line-height: 1.6; max-height: 85vh; overflow-y: auto; padding: 15px; background: #fff;">`;
    const addr = formatAddress(seedIndex);

    if (isGuaranteed) {
        // --- 確定枠の計算過程（線形連続シミュレーション） ---
        const gResult = isAlt ? cellData.alternativeGuaranteed : cellData.guaranteed;
        if (!gResult || !gResult.debugLog) return;

        html += `<h3 style="margin-top:0; color:#0056b3; border-bottom: 2px solid #0056b3;">確定枠算出過程 (${addr}</h3>`;
        html += `<p><strong>最終結果(11連目):</strong> <span style="color:#d9534f; font-weight:bold;">${gResult.name}</span></p>`;
        
        html += `<table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:10px;" border="1">
                    <tr style="background:#f2f2f2;">
                        <th style="padding:4px;">工程</th>
                        <th style="padding:4px;">開始Idx</th>
                        <th style="padding:4px;">使用SEED(s0)</th>
                        <th style="padding:4px;">排出キャラ [ID, SLOT]</th>
                        <th style="padding:4px;">消費</th>
                    </tr>`;
        
        gResult.debugLog.forEach((log) => {
            let resDisplay = "-";
            let consumption = (log.consumed !== undefined) ? log.consumed : (log.seedsConsumed !== undefined ? log.seedsConsumed : 1);
            
            if (log.step.includes("Roll")) {
                const charName = log.finalChar?.name || log.name || "不明";
                const charId = log.finalChar?.id || log.charId || "?";
                // SLOT値の取得。再抽選がある場合は最終試行のスロット、なければ初期スロット
                const slot = (log.isRerolled && log.rerollProcess && log.rerollProcess.attempts.length > 0) ? 
                             log.rerollProcess.attempts[log.rerollProcess.attempts.length-1].finalSlot : (log.charIndex !== undefined ? log.charIndex : "?");
                
                resDisplay = `${charName}<br>[ID:${charId}, SLOT:${slot}]`;
                if (log.isRerolled) resDisplay += `<br><span style="color:red; font-size:9px;">(被り回避発生)</span>`;
            } else if (log.step.includes("Guaranteed")) {
                const charId = log.finalChar?.id || log.charId || "?";
                const slot = log.charIndex !== undefined ? log.charIndex : (log.seedValue % log.totalChars);
                resDisplay = `<span style="color:#d9534f; font-weight:bold;">${log.finalChar?.name || log.name}</span><br>[ID:${charId}, SLOT:${slot}]`;
                consumption = 1;
            }

            html += `<tr>
                        <td style="padding:6px; text-align:center;">${log.step}</td>
                        <td style="padding:6px; text-align:center; background:#f9f9f9;">${log.startIndex}</td>
                        <td style="padding:6px;">${log.s0 || log.seedValue}</td>
                        <td style="padding:6px;">${resDisplay}</td>
                        <td style="padding:6px; text-align:center;">${consumption}</td>
                    </tr>`;
        });
        
        const nextIdx = gResult.nextRollStartSeedIndex;
        const nextAddr = formatTableAddress(nextIdx);
        html += `<tr style="background:#e7f3fe; font-weight:bold;">
                    <td colspan="3" style="padding:8px; text-align:right;">確定ガチャ終了後の遷移先:</td>
                    <td colspan="2" style="padding:8px; text-align:center; color:#0056b3;">${nextAddr} (Index: ${nextIdx})</td>
                 </tr>`;
        html += `</table>`;
    } else {
        // --- 通常セルの計算過程 ---
        const rr = cellData.roll;
        const debug = rr.debug;
        const charName = rr.finalChar.name;
        const charId = rr.finalChar.id;
        const poolSize = gachaConfig.pool[rr.rarity]?.length || 0;
        const finalSlot = rr.isRerolled ? debug.rerollProcess.attempts[debug.rerollProcess.attempts.length-1].finalSlot : debug.charIndex;

        html += `<h3 style="margin-top:0; color:#28a745; border-bottom: 2px solid #28a745;">通常枠算出過程 (${addr}</h3>`;
        html += `<p><strong>最終結果:</strong> <span style="color:#d9534f; font-weight:bold;">${charName} [ID:${charId}, SLOT:${finalSlot}]</span></p>`;

        // 1. レア度判定
        html += `<div style="background:#f8f9fa; padding:10px; border-radius:4px; border-left:4px solid #ccc; margin-bottom:10px;">`;
        html += `<strong>1. レア度判定 (s0)</strong><br>`;
        html += `Index: ${debug.startIndex} | SEED: ${debug.s0}<br>`;
        html += `計算: ${debug.s0} % 10000 = <span style="font-weight:bold;">${debug.s0 % 10000}</span><br>`;
        html += `結果: <span style="color:#007bff; font-weight:bold;">${rr.rarity}</span>`;
        html += `</div>`;

        // 2. レア被り判定 (順序入れ替え)
        html += `<div style="background:#f8f9fa; padding:10px; border-radius:4px; border-left:4px solid #ffc107; margin-bottom:10px;">`;
        html += `<strong>2. レア被り判定</strong><br>`;
        if (rr.rarity === 'rare') {
            const isMatch = debug.rerollProcess && debug.rerollProcess.isRerolled !== false;
            const prevId = (debug.rerollProcess && debug.rerollProcess.prevId) ? debug.rerollProcess.prevId : 'なし';
            html += `条件: レアリティが「rare」であること … <span style="color:green;">OK</span><br>`;
            html += `直前キャラID: ${prevId}<br>`;
            html += `今回候補ID: ${debug.originalChar.id} (${debug.originalChar.name})<br>`;
            html += `判定: ${isMatch ? '<span style="color:red; font-weight:bold;">一致（再抽選実行）</span>' : '<span style="color:green;">不一致（通常確定）</span>'}`;
        } else {
            html += `条件: レアリティが「rare」であること … <span style="color:blue;">NO</span><br>`;
            html += `結果: レアリティがレア以外のため、被り判定をスキップします。`;
        }
        html += `</div>`;

        // 3. キャラ判定 (s1) (順序入れ替え)
        html += `<div style="background:#f8f9fa; padding:10px; border-radius:4px; border-left:4px solid #ccc; margin-bottom:10px;">`;
        html += `<strong>3. キャラ判定 (s1)</strong><br>`;
        html += `Index: ${debug.startIndex + 1} | SEED: ${debug.s1}<br>`;
        html += `計算: ${debug.s1} % ${poolSize} = <span style="font-weight:bold;">${debug.charIndex}</span><br>`;
        html += `候補: ${debug.originalChar.name} [ID:${debug.originalChar.id}, SLOT:${debug.charIndex}]`;
        html += `</div>`;

        // 4. 再抽選プロセス
        if (rr.isRerolled && debug.rerollProcess) {
            html += `<div style="background:#fff0f0; padding:10px; border-radius:4px; border-left:4px solid #d9534f;">`;
            html += `<strong style="color:#d9534f;">4. 再抽選詳細 (s2～)</strong><br>`;
            debug.rerollProcess.attempts.forEach((att, i) => {
                html += `<div style="margin-top:5px; padding-top:5px; border-top:1px dashed #ccc;">`;
                html += `試行 ${i+1}: Index ${att.rerollSeedIndex} | SEED ${att.rerollSeed}<br>`;
                html += `計算: ${att.rerollSeed} % (プール-1:${att.tempPoolSize}) = スロット ${att.tempSlot}<br>`;
                html += `結果: <span style="font-weight:bold;">${charName} [ID:${att.foundCharId}, SLOT:${att.finalSlot}]</span>`;
                html += `</div>`;
            });
            html += `</div>`;
        }
        
        html += `<p style="font-size:0.8em; color:#666; margin-top:10px;">※消費シード数: ${rr.seedsConsumed} | 次回開始Index: ${debug.startIndex + rr.seedsConsumed}</p>`;
    }

    html += `<button onclick="closeModal()" style="width:100%; padding:12px; margin-top:20px; background:#4a4a4a; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">閉じる</button>`;
    html += `</div>`;

    if (typeof showModal === 'function') showModal(html);
}

/**
 * チェックボックス変更時の視覚効果
 */
function updateCheckboxWrapper(index) {
    const wrapper = document.getElementById(`seg-wrapper-${index}`);
    const checkbox = document.getElementById(`chk-seg-${index}`);
    if (wrapper && checkbox) {
        if (checkbox.checked) wrapper.classList.add('is-checked');
        else wrapper.classList.remove('is-checked');
    }
}

/**
 * キャラクター名の装飾
 */
function decorateCharNameHtml(charId, rarity, baseName) {
    let name = baseName || "不明";
    const cid = Number(charId);
    let style = "font-weight:bold;";
    let prefix = "";
    let suffix = "";

    let isTarget = (typeof targetCharIds !== 'undefined' && targetCharIds.includes(cid));

    if (rarity === 'legend') {
        style += "color:#e91e63; background: #fce4ec; padding: 0 2px; border-radius: 2px;";
        prefix = "【伝説レア】";
    } else if (rarity === 'uber') {
        style += "color:#e67e22;";
        prefix = "[超激レア]";
    } else {
        style += "color:#333;";
    }

    if (typeof isLimitedCat === 'function' && isLimitedCat(cid)) {
        suffix = " <span style='font-size:10px; color:#3498db;'>(限定)</span>";
    }

    if (isTarget) {
        prefix = "<span style='color:#f1c40f;'>★</span>" + prefix;
    }

    return `<span style="${style}">${prefix}${name}${suffix}</span>`;
}

/**
 * 以前の確定枠デバッグ用関数の互換性維持
 */
window.start11GTimer = function(seedIdx, colIdx, isAlt) { /* 算出過程ポップアップに統合済み */ };
window.clear11GTimer = function() { /* 算出過程ポップアップに統合済み */ };