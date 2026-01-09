/** @file view_description.js @description 使い方ガイド（概要）のHTML生成と初期化を担当 */

/**
 * 概要モード（使い方ガイド）のコンテンツHTMLを生成して返す
 * 以前のindex.htmlに記述されていた内容を完全に再現しています
 * @returns {string} 使い方ガイドのHTML文字列
 */
function generateDescriptionHTML() {
    return `
        <div style="padding: 15px; background: #fff; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #333; border-bottom: 2px solid #007bff; display: inline-block;">【R_Rolls 使い方ガイド】</h3>
            <p style="margin-bottom: 15px;">このツールは、自分の「シード値（SEED）」を元に、<strong>どのガチャをどの順番で引けば狙いのキャラが手に入るか</strong>を予測・計画するためのシミュレーターです。</p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">1. まずはシード（SEED）を入力</h4>
            <p style="margin-bottom: 10px;">
                上部の<strong>「SEED」</strong>を押し、現在の実行前シード値を入力してOKを押してください。画面に予測テーブルが表示されます。
            </p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">2. ガチャを選んで比較する</h4>
            <p style="margin-bottom: 10px;">
                テーブル上のプルダウンメニューからガチャを切り替えられます。<strong>「＋列を追加」</strong>で複数のガチャを並べて比較できます。
            </p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">3. Find（キャラ別検索）で狙い目を探す</h4>
            <p style="margin-bottom: 10px;">
                <strong>「Find」</strong>を押すと、2000〜10000ロール先までの「伝説枠」や「限定キャラ」を自動で検索します。
                <br>・<strong>リスト内のキャラ名</strong>をタップ：そのキャラをリストの一番上に表示します。
                <br>・<strong>「other」</strong>をタップ：ロールズに表示しているガチャ以外の全ガチャシリーズでの出現位置をまとめて検索します。
            </p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">4. Sim（シミュレーション）でルートを決める</h4>
            <p style="margin-bottom: 10px;">
                <strong>「Sim」</strong>をONにすると、複数のガチャを跨いで引く計画を立てられます。
                <br>・<strong>テーブル上のキャラ名</strong>をタップ：現在地からそのキャラまでのルートを自動計算します。
                <br>・<strong>MaxPlat / MaxG</strong>：自動計算時に、プラチナチケットや確定11連を最大何回まで使って良いか設定できます（デフォルトは0＝温存）。
                <br>・<strong>「Txt」</strong>ボタン：作成したルートをテキスト形式で表示します。
            </p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">5. skd（スケジュール）で開催予定をチェック</h4>
            <p style="margin-bottom: 10px;">
                <strong>「skd」</strong>を押すと、近日開催予定のガチャ一覧が表示されます。「skdで一括追加」ボタンを使うと、開催予定のガチャをすべてテーブルに並べて比較できます。
            </p>

            <h4 style="margin: 10px 0 5px 0; color: #007bff;">6. テーブルの便利な見方</h4>
            <ul style="margin: 0 0 15px 0; padding-left: 20px; font-size: 0.9em; line-height: 1.6;">
                <li><strong>No.列の背景色:</strong>
                    <ul style="padding-left: 15px; margin-top: 5px;">
                        <li><span style="background:#FFFF00; padding: 1px 3px; border-radius: 2px;">黄色</span>: 常設ガチャでのレア被り発生が予測される位置</li>
                        <li><span style="background:#FFA500; padding: 1px 3px; border-radius: 2px;">オレンジ</span>: 波動バスターズを利用し常設ガチャと組み合わせてレア被りが誘発できると予測される位置</li>
                        <li><span style="background:#FFDAB9; padding: 1px 3px; border-radius: 2px;">淡いオレンジ</span>: 表示中ガチャで実際にレア被りが発生する位置</li>
                    </ul>
                </li>
            </ul>

            <p style="font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 5px;">
                ※このツールは予測値を提供するものであり、実際のゲーム内での結果を100%保証するものではありません。
            </p>
        </div>
    `;
}

/**
 * 概要コンテナにコンテンツを注入する
 * DOMが構築された後に実行する必要があります
 */
function initDescriptionView() {
    // index.html内のコンテナIDを確認
    const container = document.getElementById('description-content');
    
    if (container) {
        // コンテンツを代入
        container.innerHTML = generateDescriptionHTML();
        console.log("Description content has been successfully injected.");
    } else {
        // IDが見つからない場合のデバッグ用ログ
        console.error("Error: Element with ID 'description-content' not found in the document.");
    }
}

/**
 * 概要の表示/非表示を切り替える（既存機能の補完）
 * 以前のui_...ファイルに同名関数がある場合はそちらが優先されます
 */
window.toggleDescription = function() {
    const el = document.getElementById('description-content');
    if (el) {
        const isHidden = el.classList.contains('hidden');
        if (isHidden) {
            el.classList.remove('hidden');
            // 表示した際に確実に中身が入っているようにする
            if (!el.innerHTML || el.innerHTML === "") {
                initDescriptionView();
            }
        } else {
            el.classList.add('hidden');
        }
    }
};