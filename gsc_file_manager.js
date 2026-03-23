// =============================================================================
// gsc_file_manager.js — Motor Nativo de Archivos GSC para iOS (.ipa / Cordova)
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
// GUARDAR JSON
// =============================================================================
function saveJSONNativo(docType, fileName, dataObj) {
    var blob = new Blob([JSON.stringify(dataObj)], { type: 'application/json' });

    if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
        _getGSCDir(docType, 'JSON', function(dir) {
            _writeBlob(dir, fileName, blob, '✅ Guardado en ' + docType + '/JSON/' + fileName);
        });
    } else {
        _fallbackDownload(blob, fileName);
        if (typeof showToast !== 'undefined') showToast('✅ JSON descargado: ' + fileName);
    }
}

// =============================================================================
// GENERAR PDF — Usa cordova-plugin-printer (motor nativo iOS)
// Si no está disponible, usa window.print() como respaldo.
// =============================================================================
function savePDFNativo(docType, fileName, _ignored) {

    // Preparar CSS adicional para el PDF: sin cortes en fotos ni celdas de tabla
    var printRules = [
        '@page { size: letter portrait; margin: 12mm 8mm; }',
        'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
        '.no-print, nav, .fab-container, #toast-container, .modal-overlay { display: none !important; }',
        'img { break-inside: avoid; page-break-inside: avoid; max-width: 100%; display: block; }',
        'table { border-collapse: collapse; }',
        'tr, td, th { break-inside: avoid; page-break-inside: avoid; }',
        '.ficha-punto, .photo-card, .audit-table tr, .firma-box { break-inside: avoid; page-break-inside: avoid; }',
        '.img-slot, .global-photo-slot { break-inside: avoid; page-break-inside: avoid; }'
    ].join('\n');

    // Serializar el HTML completo de la página con el CSS extra inyectado
    var docHTML = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<style>' + printRules + '</style>' +
        '</head><body>' + document.body.innerHTML + '</body></html>';

    // ---- OPCIÓN A: cordova-plugin-printer (nativo iOS, máxima calidad) ----
    if (window.cordova && cordova.plugins && cordova.plugins.printer) {
        var opts = {
            name:        fileName,
            orientation: 'portrait',
            monochrome:  false,
            border:      true
        };

        // La función print() muestra el diálogo nativo de iOS donde el usuario
        // puede elegir "Salvar como PDF" y guardarlo en cualquier carpeta (Files, Mail, etc.)
        cordova.plugins.printer.print(docHTML, opts, function(success) {
            if (success) {
                if (typeof showToast !== 'undefined') showToast('✅ PDF exportado correctamente');
            }
        });

    // ---- OPCIÓN B: window.print() como respaldo (Safari / web) ----
    } else {
        // Inyectar estilos de impresión temporalmente
        var styleTag = document.createElement('style');
        styleTag.id = '_gsc_print_style';
        styleTag.textContent = printRules;
        document.head.appendChild(styleTag);

        var originalTitle = document.title;
        document.title = fileName.replace('.pdf', '');

        setTimeout(function() {
            window.print();
            setTimeout(function() {
                document.title = originalTitle;
                var s = document.getElementById('_gsc_print_style');
                if (s) s.remove();
            }, 2000);
        }, 300);
    }
}
