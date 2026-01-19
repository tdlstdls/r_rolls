/** @file ui_modal_service.js @description 汎用モーダル表示エンジン */

function showModal(contentHtml) {
    let modal = document.getElementById('common-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'common-modal';
        modal.style = "display:none; position:fixed; z-index:10000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.7); overflow:auto;";
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background:#fff; margin:10% auto; padding:15px; width:90%; max-width:500px; border-radius:8px; position:relative; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            ${contentHtml}
        </div>`;
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('common-modal');
    if (modal) modal.style.display = 'none';
}