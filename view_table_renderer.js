/** @file view_table_renderer.js @description 行・セルの描画処理（G列SEED更新精度修正版） */

/**
 * 行レンダリング (A/Bサイド別)
 */
function renderTableRowSide(rowIndex, seedIndex, columnConfigs, tableData, seeds, highlightMap, guarHighlightMap, isLeftSide) {
    const rowData = tableData[seedIndex];
    if (!rowData) return ''; 

    // No列の背景色を決定
    const rowInfo = rowData.rowInfo || {};
    let noColBgColor = '#f8f9fa'; 
    if (rowInfo.isNormalReroll) {
        noColBgColor = '#FFFF00';
    } else if (rowInfo.isCrossReroll) {
        noColBgColor = '#FFA500';
    } else if (rowInfo.isActualReroll) {
        noColBgColor = '#FFDAB9';
    }

    let sideHtml = `<td class="col-no" style="background: ${noColBgColor}; ${isLeftSide ? 'position: sticky; left: 0; z-index: 5; border-right: 1px solid #ddd;'
        : ''}">${rowIndex + 1}</td>`;

    // 詳細計算セルの描画
    if (typeof generateDetailedCalcCells === 'function') {
        sideHtml += generateDetailedCalcCells(seedIndex, seeds, tableData);
    } else {
        const calcColClass = `calc-column ${showSeedColumns ? '' : 'hidden'}`;
        sideHtml += `<td class="${calcColClass}">-</td>`.repeat(5);
    }

    // 各ガチャ列のセルを描画
    tableGachaIds.forEach((idWithSuffix, colIndex) => {
        const id = idWithSuffix.replace(/[gfs]$/, '');
        const suffix = idWithSuffix.match(/[gfs]$/)?.[0] || '';
        const data = rowData.cells ? rowData.cells[colIndex] : null;

        // 通常セルの描画
        if (typeof generateCell === 'function') {
            sideHtml += generateCell(seedIndex, id, colIndex, tableData, seeds, highlightMap, isSimulationMode);
        } else {
            sideHtml += `<td>-</td>`;
        }

        // 確定枠セルの描画
        if (suffix) {
            if (data && (data.guaranteed || (data.result && data.result.guaranteed))) {
                sideHtml += renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap);
            } else {
                sideHtml += `<td style="border: 1px solid #ddd; background: #eee; font-size:10px; text-align:center;">-</td>`;
            }
        }
    });
    return sideHtml;
}

/**
 * 確定枠セルの詳細描画
 */
function renderGuaranteedCell(seedIndex, id, suffix, data, seeds, colIndex, guarHighlightMap) {
    let cellStyle = 'white-space: normal; min-width: 80px; word-break: break-all; vertical-align: middle; border: 1px solid #ddd; font-size: 11px; padding: 0;';
    
    if (isSimulationMode && guarHighlightMap.get(seedIndex) === id) {
        cellStyle += `background-color: #66b2ff;`;
    } else {
        cellStyle += `background-color: #eef7ff;`;
    }

    const gMain = data.guaranteed || (data.result ? data.result.guaranteed : null);
    const gAlt = data.alternativeGuaranteed || (data.result ? data.result.alternativeGuaranteed : null);
    
    let gContent = '<div style="padding: 4px;">---</div>';

    if (gMain && (gMain.name || (gMain.finalChar && gMain.finalChar.name))) {
        const buildGHtml = (res, isAltRoute) => {
            if (!res) return "";
            const addr = formatTableAddress(res.nextRollStartSeedIndex);
            const verifiedStyle = (!res.isVerified && showSeedColumns && !isAltRoute) ? "border-left: 3px solid #ff4444;" : "";
            const gType = (suffix === 'g') ? '11g' : (suffix === 'f' ? '15g' : '7g');
            const charName = res.name || (res.finalChar ? res.finalChar.name : "データ不足");
            const escapedName = charName.replace(/'/g, "\\'");
            const finalSeedInProcess = seeds[res.nextRollStartSeedIndex - 1];
            let clickAction = isSimulationMode ?
                `onclick="if(!event.ctrlKey) onGachaCellClick(${seedIndex}, '${id}', '${escapedName}', '${gType}')"` :
                (res.nextRollStartSeedIndex >= 0 ? `onclick="if(!event.ctrlKey) updateSeedAndRefresh(${finalSeedInProcess})"` : "");
            const debugAttrs = showSeedColumns ? 
                `onpointerdown="window.start11GTimer(${seedIndex}, ${colIndex}, ${isAltRoute})" onpointerup="window.clear11GTimer()" onpointerleave="window.clear11GTimer()"` : "";
            return `<div ${clickAction} ${debugAttrs} style="cursor:pointer; padding:4px; ${verifiedStyle} ${isAltRoute ? 'border-bottom:1px dashed #ccc;' : ''}">${addr})<span class="char-link" style="font-weight:bold; color:#0056b3;">${charName}</span></div>`;
        };
        gContent = gAlt ? buildGHtml(gAlt, true) + buildGHtml(gMain, false) : buildGHtml(gMain, false);
    }
    
    return `<td class="gacha-cell gacha-column" style="${cellStyle}">${gContent}</td>`;
}

/**
 * テーブル用アドレス（A1, B25等）のフォーマット
 */
function formatTableAddress(index) {
    if (index === null || index === undefined || index < 0) return "---";
    const row = Math.floor(index / 2) + 1;
    const track = (index % 2 === 0) ? "A" : "B";
    return `${track}${row}`;
}

/**
 * 計算方法の詳細説明HTMLを生成
 */
function generateSeedExplanationHtml() {
    return `
        <div class="seed-explanation-container">
            <h4 style="margin-top: 0; color: #17a2b8; border-bottom: 2px solid #17a2b8; display: inline-block;">📖 SEED計算と排出の仕組み</h4>
            <div style="font-size: 0.9em; line-height: 1.6; color: #555;">
                <p>左側のSEED詳細列を表示している際、以下のルールに基づいてキャラクターが決定されます：</p>
                <ul style="padding-left: 20px;">
                    <li><strong>1. レア度判定 (s0):</strong> <br>
                        その番地のSEED値を <strong>10000</strong> で割った剰余（余り）を使用します。
                        <br>例: 剰余が 0～6969 ならレア、9500～9969 なら超激レアとなります。
                    </li>
                    <li><strong>2. キャラ判定 (s1):</strong> <br>
                        レア度決定後、<strong>「その次の番地 (Index + 1)」</strong>のSEED値を使用します。
                        <br>その値を、該当するレアリティのキャラクター総数で割った剰余によって、どのキャラが出るか決まります。
                    </li>
                    <li style="margin-top: 10px;"><strong>3. 【参考表示】レア被り再抽選 (s2～):</strong> <br>
                        レアリティがレアで、かつ「前回引いたキャラ」と「今回判定されたキャラ」が同じ場合、さらに「その次のシード (Index + 2～)」で違うキャラが出るまで再抽選を繰り返し行います。<br>
                        再抽選を行う際は、当該ガチャマスターのキャラクタープールから、通常抽選（及び前回までの再抽選）で使用したスロットを除いた一時的なキャラプールを作成し、当該一時的なキャラプールの総数で除した剰余を当てはめてキャラを算出します。<br>
                        使用したシード数が奇数の場合は、次ロールでトラック(A/B)が切り替わります。<br>
                        なお、下記4.のとおり、確定11連などの「確定枠」でも使用シード数が１つで奇数となるためトラックの切り替わりが発生します。<br>
                        <div style="background: #fff; border: 1px solid #ddd; padding: 8px; margin: 5px 0; font-size: 0.9em;">
                            <strong>※【参考表示】について</strong><br>
                            連続するロールの前後で別のガチャを引くことにより、レア被りを誘発したり、回避したりすることもできるため、ご自身の計画でガチャを引くと次にどのセルに遷移するかは「ユーザーご自身で」ご確認ください。<br>
                            このテーブルでは、ユーザーが選択するルートは考慮されず、機械的に次のような仕様でレア被り時の遷移先セル番地及び再抽選キャラを表示しています。<br>
                            （１）同一トラック・同一ガチャの１つ上のセルと比較して、キャラが一致し、レアリティがレアの場合、レア被りと判定し、遷移先セル番地及び再抽選キャラを表示します。<br>
                            （２）上記のレア被りにより遷移した、遷移先セルにおいて、レア被りによる遷移元とキャラが一致した場合にも、連続レア被りと判定し、遷移先セル番地及び再抽選キャラを表示します。この場合は遷移先セルアドレスの先頭に「R」を付して表示します。
                        </div>
                    </li>
                    <li style="margin-top: 10px;"><strong>4. 確定枠の挙動:</strong> <br>
                        確定枠（G列）ではレア度判定を行わず、その番地のSEED値を直接「超激レアキャラ数」で割った剰余でキャラを決定します。
                        確定枠は常に1つのSEEDを消費（奇数消費）するため、必ずトラックが切り替わります。
                    </li>
                </ul>
                <div style="background: #e9ecef; padding: 10px; border-radius: 4px; font-size: 0.85em; margin-top: 10px;">
                    <strong>ヒント:</strong> テーブル上の「NO.」列の色が <strong>黄色</strong> や <strong>オレンジ</strong> の場所は、レア被りが発生しやすいシード値の並び（スロットの一致や逆順）を事前に示唆しています。
                </div>
            </div>
        </div>
    `;
}