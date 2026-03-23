// =============================================================================
// gsc_file_manager.js — Motor de Archivos GSC para iOS (.ipa / Cordova)
// PDF: Guarda HTML autocontenido via cordova-plugin-file (mismo mecanismo JSON)
//      luego abre el archivo en Safari con window.open(_system)
// JSON: cordova-plugin-file en Documents/
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
    if (typeof showToast !== 'undefined') showToast('Error de sistema: ' + (err.code || JSON.stringify(err)));
}

function _writeBlob(dirEntry, fileName, blob, onSuccess) {
    dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
        fileEntry.createWriter(function(writer) {
            writer.onwriteend = function() { if (onSuccess) onSuccess(fileEntry); };
            writer.onerror = function(e) {
                console.error('[GSC] Error escribiendo:', e);
                if (typeof showToast !== 'undefined') showToast('Error al guardar: ' + (e.message || e));
            };
            writer.write(blob);
        }, _fsError);
    }, _fsError);
}

// =============================================================================
// GUARDAR JSON
// =============================================================================
function saveJSONNativo(docType, fileName, dataObj) {
    var blob = new Blob([JSON.stringify(dataObj)], { type: 'application/json' });

    if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
        _getGSCDir(docType, 'JSON', function(dir) {
            _writeBlob(dir, fileName, blob, function() {
                if (typeof showToast !== 'undefined') showToast('✅ JSON guardado en ' + docType + '/JSON');
            });
        });
    } else {
        // Fallback web
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
}

// =============================================================================
// EXPORTAR PDF
// Estrategia garantizada para Cordova WKWebView iOS:
//   1. Genera HTML autocontenido con todos los estilos y datos
//   2. Guarda el .html usando cordova-plugin-file (mismo mecanismo que JSON)
//   3. Abre el archivo en Safari via window.open(_system)
//   4. Desde Safari el usuario imprime/guarda como PDF con 2 toques
// =============================================================================
function savePDFNativo(docType, fileName) {
    if (typeof showToast !== 'undefined') showToast('⏳ Generando archivo...');

    // --- Recopilar todos los estilos del documento ---
    var allStyles = '';
    var styleEls = document.querySelectorAll('style');
    for (var i = 0; i < styleEls.length; i++) {
        allStyles += styleEls[i].textContent;
    }

    // --- CSS adicional para impresión correcta ---
    var printCSS = [
        '@page { size: letter portrait; margin: 15mm 10mm; }',
        'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
        'nav, .no-print, .fab-container, #toast-container, .modal-overlay,',
        '.btn-action, .btn-firma, .hidden-file-input, .upload-zone { display: none !important; }',
        'img { break-inside: avoid !important; page-break-inside: avoid !important;',
        '      display: block !important; max-width: 100% !important; }',
        'table { border-collapse: collapse !important; }',
        'tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.ficha-punto, .photo-card, .audit-table tr, .firma-box { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.paper-container { box-shadow: none !important; border-radius: 0 !important; border-top: none !important; }',
        '.print-wrapper { display: table !important; }',
        '.print-wrapper > thead { display: table-header-group !important; }',
        '.print-wrapper > tbody { display: table-row-group !important; }',
        '.audit-table { display: table !important; }',
        '.audit-table tbody { display: table-row-group !important; }',
        '.audit-table tr { display: table-row !important; margin: 0 !important; box-shadow: none !important; }',
        '.audit-table td, .audit-table th { display: table-cell !important; }',
        '.audit-table td::before { display: none !important; }',
        '.status-select { border: none !important; background: transparent !important; font-weight: bold !important; }',
        'textarea { border: none !important; background: transparent !important; resize: none !important; min-height: 0 !important; }'
    ].join('\n');

    var htmlFileName = fileName.replace('.pdf', '') + '.html';

    // --- Construir HTML autocontenido ---
    var htmlContent =
        '<!DOCTYPE html><html lang="es"><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + (fileName.replace('.pdf', '')) + '</title>' +
        '<style>' + allStyles + printCSS + '</style>' +
        '</head><body onload="' +
          'document.querySelectorAll(\'.no-print,nav,.fab-container,#toast-container,.modal-overlay\').forEach(function(e){e.style.display=\'none\';});' +
        '">' +
        document.body.innerHTML +
        '</body></html>';

    var htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

    // --- Guardar con cordova-plugin-file y abrir en Safari ---
    if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
        _getGSCDir(docType, 'PDF', function(dir) {
            _writeBlob(dir, htmlFileName, htmlBlob, function(fileEntry) {
                if (typeof showToast !== 'undefined') {
                    showToast('✅ Guardado. Abriendo en Safari para imprimir como PDF...');
                }
                // Abrir en Safari (sistema) — desde ahí se puede imprimir como PDF
                setTimeout(function() {
                    window.open(fileEntry.nativeURL, '_system');
                }, 800);
            });
        });
    } else {
        // Fallback: descargar en navegador web
        var url = URL.createObjectURL(htmlBlob);
        var a = document.createElement('a');
        a.href = url; a.download = htmlFileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
}
