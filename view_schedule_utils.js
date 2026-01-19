/** @file view_schedule_utils.js @description スケジュール表示の共通設定とユーティリティ */

// 表示状態管理用の変数
if (typeof hideEndedSchedules === 'undefined') {
    window.hideEndedSchedules = false;
}

/** 終了分の表示/非表示を切り替えて再描画 */
function toggleHideEnded() {
    hideEndedSchedules = !hideEndedSchedules;
    if (typeof loadedTsvContent !== 'undefined' && loadedTsvContent) {
        // 再描画を実行
        renderScheduleTable(loadedTsvContent, 'schedule-container');
    }
}

/** 文字列の表示幅を概算する関数 (動的幅調整用) */
function calcTextWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if ((code >= 0x00 && code < 0x81) || (code === 0xf8f0) || (code >= 0xff61 && code < 0xffa0) || (code >= 0xf8f1 && code < 0xf8f4)) {
            width += 8;
        } else {
            width += 13;
        }
    }
    return width;
}

/** 確率のフォーマット (30 -> 0.3%) */
function fmtRate(val) {
    if (!val) return "0%";
    return (parseInt(val) / 100) + "%";
}

/** ガントチャートを画像として全体保存 */
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    const scrollWrapper = document.querySelector('.gantt-scroll-wrapper');
    const scrollContent = scrollWrapper ? scrollWrapper.firstElementChild : null;
    if (!element || !scrollWrapper || !scrollContent) return;

    // 現在のコンテンツの実際の横幅を取得（全日数分）
    const fullContentWidth = scrollContent.offsetWidth;

    // 1. デスクトップ表示用のスタイルを一時的に注入
    // スマホのメディアクエリによる制限を解除するため、コンテナを全幅固定にする
    const styleOverride = document.createElement('style');
    styleOverride.id = 'gantt-save-override';
    styleOverride.innerHTML = `
        /* モバイル用の制限を完全に無効化 */
        .gantt-outer-wrapper, .gantt-chart-container, .gantt-scroll-wrapper { 
            width: ${fullContentWidth}px !important;
            max-width: none !important;
            overflow: visible !important;
        }
        .gantt-header, .gantt-row { 
            height: 30px !important; 
            display: flex !important; 
            flex-wrap: nowrap !important;
            width: ${fullContentWidth}px !important;
        }
        .gantt-label-col, .gantt-date-cell { 
            height: 30px !important;
            line-height: 30px !important; 
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            text-align: center !important;
            vertical-align: middle !important;
            font-size: 11px !important;
            position: static !important; /* 固定列を解除して正しく並べる */
        }
        .gantt-bar { 
            height: 20px !important;
            top: 5px !important; 
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .gantt-bar-text {
            line-height: 20px !important;
            font-size: 10px !important;
        }
    `;
    document.head.appendChild(styleOverride);
    
    // 2. スタイルの保存
    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalWrapperOverflow = scrollWrapper.style.overflow;

    // 要素の状態を一時変更
    element.style.overflow = 'visible';
    element.style.width = fullContentWidth + 'px';
    element.style.maxWidth = 'none';
    scrollWrapper.style.overflow = 'visible';

    // 3. html2canvasでキャプチャ
    // windowWidthをコンテンツ幅に合わせることで、モバイルブラウザでもデスクトップとして描画させる
    html2canvas(element, {
        width: fullContentWidth,
        windowWidth: fullContentWidth > 1200 ? fullContentWidth : 1200,
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `gacha_schedule_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        restoreStyles();
    }).catch(err => {
        console.error("Image capture failed:", err);
        restoreStyles();
    });

    function restoreStyles() {
        const override = document.getElementById('gantt-save-override');
        if (override) override.remove();

        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        element.style.maxWidth = originalMaxWidth;
        scrollWrapper.style.overflow = originalWrapperOverflow;
    }
}