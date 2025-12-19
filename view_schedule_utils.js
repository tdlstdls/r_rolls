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
        // 半角文字(ASCII範囲)は約8px、それ以外(全角)は約13pxと仮定
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

/** ガントチャートを画像として保存 */
function saveGanttImage() {
    const element = document.querySelector('.gantt-chart-container');
    if (!element) return;
    
    const header = element.querySelector('.gantt-header');
    if (!header) return;
    const contentWidth = header.style.width;

    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width; 
    const scrollWrapper = element.querySelector('.gantt-scroll-wrapper');
    const originalWrapperOverflow = scrollWrapper ? scrollWrapper.style.overflow : '';
    
    element.style.overflow = 'visible';
    element.style.width = contentWidth; 
    
    if(scrollWrapper) scrollWrapper.style.overflow = 'visible';
    
    html2canvas(element).then(canvas => {
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        if(scrollWrapper) scrollWrapper.style.overflow = originalWrapperOverflow;

        const link = document.createElement('a');
        link.download = 'gacha_schedule.png';
        link.href = canvas.toToDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error("Image capture failed:", err);
        alert("画像の保存に失敗しました。");
        element.style.overflow = originalOverflow;
        element.style.width = originalWidth;
        if(scrollWrapper) scrollWrapper.style.overflow = originalWrapperOverflow;
    });
}