// =============================================================================
// gsc_file_manager.js — Motor de Archivos GSC para iOS (.ipa / Cordova)
// Sin plugins adicionales. Usa cordova-plugin-file (JSON) + window.print() (PDF)
// =============================================================================

// ---- SISTEMA DE ARCHIVOS NATIVO (cordova-plugin-file) ----

function _getGSCDir(docType, subFolder, callback) {
    window.resolveLocalFileSystemURL(cordova.file.documentsDirectory, function(root) {
        root.getDirectory(docType, { create: true }, function(docDir) {
            docDir.getDirectory(subFolder, { create: true }, function(finalDir) {
                callback(finalDir);
            }, _fsError);
        }, _fsError);
    }, _fsError);
}

function _fsError(err) {
    console.error('[GSC] Error FS:', err);
    if (typeof showToast !== 'undefined') showToast('Error de sistema: ' + (err.code || err));
}

function _writeBlob(dirEntry, fileName, blob, successMsg) {
    dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
        fileEntry.createWriter(function(writer) {
            writer.onwriteend = function() {
                if (typeof showToast !== 'undefined') showToast(successMsg);
            };
            writer.onerror = function(e) {
                console.error('[GSC] Error escribiendo:', e);
                if (typeof showToast !== 'undefined') showToast('Error al guardar archivo.');
            };
            writer.write(blob);
        }, _fsError);
    }, _fsError);
}

function _fallbackDownload(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// GUARDAR JSON (siempre nativo en device, descarga en web)
// =============================================================================
function saveJSONNativo(docType, fileName, dataObj) {
    var blob = new Blob([JSON.stringify(dataObj)], { type: 'application/json' });

    if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
        _getGSCDir(docType, 'JSON', function(dir) {
            _writeBlob(dir, fileName, blob, '✅ Guardado en ' + docType + '/JSON');
        });
    } else {
        _fallbackDownload(blob, fileName);
        if (typeof showToast !== 'undefined') showToast('✅ JSON descargado: ' + fileName);
    }
}

// =============================================================================
// EXPORTAR PDF — window.print() con CSS optimizado para iOS nativo
//
// Muestra un modal de instrucciones claro, luego llama window.print().
// El PDF se guarda desde el diálogo de impresión de iOS con 2 toques.
// =============================================================================
function savePDFNativo(docType, fileName, _ignored) {

    // --- CSS de impresión ---
    var styleId = '_gsc_print_override';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
        '@page { size: letter portrait; margin: 15mm 10mm; }' +
        'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
        'nav, .no-print, .fab-container, #toast-container, .modal-overlay,' +
        '.btn-action, .btn-firma, .hidden-file-input { display: none !important; }' +
        'img { break-inside: avoid !important; page-break-inside: avoid !important; display: block !important; max-width: 100% !important; }' +
        'table { border-collapse: collapse !important; }' +
        'tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }' +
        '.ficha-punto, .photo-card, .img-slot, .global-photo-slot,' +
        '.firma-box, .firma-wrapper, .audit-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }';
    document.head.appendChild(style);

    // --- Modal de instrucciones iOS (claro, sin alert()) ---
    var overlayId = '_gsc_pdf_overlay';
    var oldOverlay = document.getElementById(overlayId);
    if (oldOverlay) oldOverlay.remove();

    var overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,20,60,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML =
        '<div style="background:#fff;border-radius:14px;padding:26px 22px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.4);">' +
          '<div style="font-size:36px;margin-bottom:8px;">🖨️</div>' +
          '<h3 style="color:#002060;margin:0 0 14px;font-size:16px;">Guardar como PDF</h3>' +
          '<p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 18px;">' +
            'Se abrirá el diálogo de impresión de iOS.<br><br>' +
            '<b>1.</b> Toca el ícono <b>📤 Compartir</b><br>' +
            '(arriba a la derecha de la pantalla)<br><br>' +
            '<b>2.</b> Elige <b>"Guardar en Archivos"</b><br>' +
            'para seleccionar dónde guardarlo como PDF.' +
          '</p>' +
          '<button id="_gsc_pdf_btn" style="background:#002060;color:#fff;border:none;border-radius:50px;padding:12px 30px;font-size:15px;font-weight:bold;cursor:pointer;width:100%;">Continuar → Imprimir</button>' +
        '</div>';
    document.body.appendChild(overlay);

    document.getElementById('_gsc_pdf_btn').onclick = function() {
        overlay.remove();
        var originalTitle = document.title;
        document.title = fileName.replace('.pdf', '');
        setTimeout(function() {
            window.print();
            setTimeout(function() {
                document.title = originalTitle;
                var s = document.getElementById(styleId);
                if (s) s.remove();
            }, 3000);
        }, 200);
    };
}
