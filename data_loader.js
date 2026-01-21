/**
 * @file data_loader.js
 * @description 外部リソース(CSV/TSV)の非同期取得とgachaMasterDataの構築を担当
 * @input_data GatyaDataSetR1.csv, GatyaData_Option_SetR.tsv, gatya.tsv
 * @managed_state gachaMasterData (マスタ全体), loadedTsvContent (スケジュール生データ)
 * @output_data gachaMasterData.cats, gachaMasterData.gachas
 * @dependency cats.js, gacha_series.js
 */

/**
 * [gatya.tsv Data Structure Memo]
 * * ■ 基本構造
 * ・1-10列目 (Idx 0-9): 年月日・時刻情報
 * Idx 0: 開始年月日 (YYYYMMDD)
 * Idx 1: 開始時刻 (HHMM)
 * Idx 2: 終了年月日 (YYYYMMDD)
 * Idx 3: 終了時刻 (HHMM)
 * Idx 8: レアロールズ対象フラグ (1以外は除外)
 * * ・11列目以降 (Idx 10~): ガチャ情報ブロック (15列/ブロック の繰り返し)
 * ブロック開始インデックスを i (10, 25, 40...) とすると:
 * i+0  : ガチャID (Gacha ID)
 * i+6  : レアレート (Rare Rate)
 * i+8  : 激レアレート (Super Rare Rate)
 * i+10 : 超激レアレート (Uber Rare Rate)
 * i+11 : 超激レア確定フラグ (Guaranteed Flag, 1=確定)
 * i+12 : 伝説レアレート (Legend Rare Rate)
 * i+14 : 日本語説明文 (Description)
 */

// グローバル変数 (データ保持用)
let gachaMasterData = { cats: {}, gachas: {} };
let loadedTsvContent = null; // スケジュールデータ (gatya.tsv)

// 全データのロードと構築を行うメイン関数
async function loadAllData() {
    console.log("Loading data...");
    // 1. キャラクターデータ (cats.js) の処理
    processCatsData();

    // 2. マスタデータ (CSV/TSV) の取得と構築
    try {
        const [csvRes, tsvRes, gatyaRes] = await Promise.all([
            fetch('GatyaDataSetR1.csv'),
            fetch('GatyaData_Option_SetR.tsv'),
            fetch('gatya.tsv') // スケジュールデータもここで取得
        ]);
        if (!csvRes.ok) throw new Error("GatyaDataSetR1.csv fetch failed");
        if (!tsvRes.ok) throw new Error("GatyaData_Option_SetR.tsv fetch failed");
        
        const csvText = await csvRes.text();
        const tsvText = await tsvRes.text();
        let gatyaTsvText = null;
        
        if (gatyaRes.ok) {
            gatyaTsvText = await gatyaRes.text();
            loadedTsvContent = gatyaTsvText;
            console.log("gatya.tsv loaded successfully.");
        } else {
            console.warn("gatya.tsv not found.");
        }

        // マスタデータの構築
        const gachasMaster = buildGachaMaster(gachaMasterData.cats, csvText, tsvText);
        // gatya.tsv から正確なレート情報を反映
        if (gatyaTsvText) {
            applyTsvRates(gachasMaster, gatyaTsvText);
        }

        gachaMasterData.gachas = gachasMaster;
        
        console.log("Master Data Built:", Object.keys(gachasMaster).length, "gachas loaded.");
        return true;
    } catch (e) {
        console.error("Critical Data Load Error:", e);
        return false;
    }
}

// cats.js のデータを gachaMasterData.cats に変換
function processCatsData() {
    const fallbackCats = [{id:31, name:"ネコぼさつ", rarity:3}];
    let catsData = (typeof cats !== 'undefined') ? cats : fallbackCats;
    const rarityMap = { 0: "nomal", 1: "ex", 2: "rare", 3: "super", 4: "uber", 5: "legend" };
    const catsMaster = {};
    
    for (const cat of catsData) {
        catsMaster[cat.id] = { ...cat, rarity: rarityMap[cat.rarity] || "rare" };
    }
    gachaMasterData.cats = catsMaster;
}

// マスタデータ構築ロジック (CSV行番号 = ID)
function buildGachaMaster(catsMaster, csvText, tsvText) {
    const gachasMaster = {};
    // 1. CSVを行ごとに分割 (1行目=ID:0, 2行目=ID:1...)
    const gachaPools = csvText.split(/\r?\n/);
    // 2. Option TSVをパースして GatyaSetID -> seriesID のマップを作成
    const tsvLines = tsvText.split(/\r?\n/);
    const headers = tsvLines[0].split('\t').map(h => h.trim());
    const idIdx = headers.indexOf('GatyaSetID');
    const seriesIdx = headers.indexOf('seriesID');

    const gachaSeriesMap = {};
    if (idIdx !== -1 && seriesIdx !== -1) {
        for (let i = 1; i < tsvLines.length; i++) {
            const line = tsvLines[i];
            if (!line.trim()) continue;
            const cols = line.split('\t');
            const gID = parseInt(cols[idIdx]);
            const sID = parseInt(cols[seriesIdx]);
            if (!isNaN(gID) && !isNaN(sID)) {
                gachaSeriesMap[gID] = sID;
            }
        }
    }

    // gacha_series.js のデータ
    let seriesList = (typeof gacha_series !== 'undefined') ? gacha_series : [];

    // 3. 全結合して gachasMaster を構築
    gachaPools.forEach((line, index) => {
        if (!line.trim()) return;

        // CSVの行番号(index) = ガチャID
        const gachaID = index;
        const poolCats = line.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

        const seriesID = gachaSeriesMap[gachaID];

        // デフォルト情報
        let seriesInfo = { 
            name: `Gacha ID: ${gachaID}`, 
            rare: 0, supa: 0, uber: 0, legend: 0, sort: 999 
        };
        
        // gacha_series.js から名前とレートを引く
        if (seriesID !== undefined) {
            const found = seriesList.find(s => s.series_id === seriesID);
            if (found) {
                seriesInfo = found;
            }
        }

        // キャラクタープール構築
        const pool = { rare: [], super: [], uber: [], legend: [], nomal: [], ex: [] };
        for (const catId of poolCats) {
            const catInfo = catsMaster[catId];
            if (catInfo && pool[catInfo.rarity] !== undefined) {
                pool[catInfo.rarity].push({ id: catInfo.id, name: catInfo.name });
            }
        }

        gachasMaster[gachaID] = {
            id: gachaID.toString(),
            name: seriesInfo.name, // ガチャ名称
            rarity_rates: { 
                rare: seriesInfo.rare || 0, 
                super: seriesInfo.supa || 0,
                uber: seriesInfo.uber || 0, 
                legend: seriesInfo.legend || 0 
            },
            pool: pool,
            sort: seriesInfo.sort || 999,
            series_id: seriesID,
            guaranteed: false // デフォルトはfalse
        };
    });

    return gachasMaster;
}

// gatya.tsv からレート情報と確定情報を抽出してマスタデータに適用する
function applyTsvRates(gachasMaster, tsvContent) {
    const lines = tsvContent.split('\n');
    lines.forEach(line => {
        if (line.trim().startsWith('[') || !line.trim()) return;
        const cols = line.split('\t');
        if (cols.length < 15) return;

        // 9列目(Idx 8)が「1」以外の行は除外
        if (cols[8] !== '1') return;

        for (let i = 10; i < cols.length; i += 15) {
            if (i + 14 >= cols.length) break;

            const gachaId = parseInt(cols[i]);
            if (isNaN(gachaId) || gachaId < 0) continue;

            const isGuaranteed = cols[i + 11] === '1';
            // 確定フラグがある場合はID末尾に'g'を付けた別エントリとして保持する
            const storageId = isGuaranteed ? `${gachaId}g` : `${gachaId}`;

            const rateRare = parseInt(cols[i + 6]) || 0;
            const rateSupa = parseInt(cols[i + 8]) || 0;
            const rateUber = parseInt(cols[i + 10]) || 0;
            const rateLegend = parseInt(cols[i + 12]) || 0;

            if (gachasMaster[gachaId]) {
                // 元のデータをコピーして新しい設定を適用
                gachasMaster[storageId] = JSON.parse(JSON.stringify(gachasMaster[gachaId]));
                gachasMaster[storageId].id = storageId.toString();
                gachasMaster[storageId].rarity_rates = {
                    rare: rateRare,
                    super: rateSupa,
                    uber: rateUber,
                    legend: rateLegend
                };
                gachasMaster[storageId].guaranteed = isGuaranteed;
                
                // 確定名称の付与
                if (isGuaranteed && !gachasMaster[storageId].name.includes("確定")) {
                    gachasMaster[storageId].name += " [確定]";
                }
            }
        }
    });
}