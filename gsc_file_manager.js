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
// En iOS (.ipa), esto muestra la hoja nativa de impresión.
// El usuario toca el ícono de Compartir (📤) y elige "Guardar en Archivos"
// para depositar el PDF donde desee (o directamente en su correo/Drive).
// =============================================================================
function savePDFNativo(docType, fileName, _ignored) {

    // 1. Inyectar estilos de impresión específicos para iOS
    var styleId = '_gsc_print_override';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
        '@page {',
        '  size: letter portrait;',   /* Tamaño carta */
        '  margin: 15mm 10mm;',
        '}',
        'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',

        /* Ocultar controles de UI */
        'nav, .no-print, .fab-container, #toast-container, .modal-overlay,',
        '.btn-action, .btn-firma, .photo-controls, .hidden-file-input { display: none !important; }',

        /* Sin cortes en fotos */
        'img { break-inside: avoid !important; page-break-inside: avoid !important;',
        '      display: block !important; max-width: 100% !important; }',

        /* Sin cortes en filas y celdas de tabla */
        'table { border-collapse: collapse !important; }',
        'tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }',

        /* Sin cortes en fichas, tarjetas de foto y cajas de firma */
        '.ficha-punto, .photo-card, .img-slot, .global-photo-slot,',
        '.firma-box, .firma-wrapper, .audit-table tr {',
        '  break-inside: avoid !important; page-break-inside: avoid !important;',
        '}',

        /* Forzar fondo blanco */
        'body, * { background-color: white; }'
    ].join('\n');

    document.head.appendChild(style);

    // 2. Fijar el título del documento (será el nombre por defecto del PDF)
    var originalTitle = document.title;
    document.title = fileName.replace('.pdf', '');

    // 3. Lanzar el diálogo de impresión nativo de iOS
    setTimeout(function() {
        window.print();

        // 4. Restaurar título y limpiar estilos después de que cierre el diálogo
        setTimeout(function() {
            document.title = originalTitle;
            var s = document.getElementById(styleId);
            if (s) s.remove();
        }, 3000);
    }, 300);
}
