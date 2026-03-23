// =============================================================================
// gsc_file_manager.js — Motor de Archivos GSC para iOS (.ipa / Cordova)
// PDF: usa navigator.share() con blob HTML — funciona en WKWebView iOS 14+
// JSON: usa cordova-plugin-file para guardar en Documents/
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
            _writeBlob(dir, fileName, blob, '✅ JSON guardado en ' + docType + '/JSON');
        });
    } else {
        _fallbackDownload(blob, fileName);
        if (typeof showToast !== 'undefined') showToast('✅ JSON descargado: ' + fileName);
    }
}

// =============================================================================
// EXPORTAR PDF — Estrategia híbrida para Cordova WKWebView iOS
//
// 1. Genera un HTML autocontenido con todo el CSS inline y datos actuales
// 2. Intenta compartirlo con navigator.share() (abre hoja nativa iOS)
//    → El usuario puede: Imprimir, Guardar en Archivos, Mail, AirDrop, etc.
// 3. Si share no está disponible, guarda el .html en Documents/ via Cordova
// =============================================================================
function savePDFNativo(docType, fileName, _ignored) {

    if (typeof showToast !== 'undefined') showToast('⏳ Preparando documento...');

    // CSS de impresión para cuando el usuario imprima desde Safari
    var printCSS = [
        '<style>',
        '@page { size: letter portrait; margin: 15mm 10mm; }',
        'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: -apple-system, sans-serif; }',
        'nav, .no-print, .fab-container, #toast-container, .modal-overlay,',
        '.btn-action, .btn-firma, .hidden-file-input, .upload-zone { display: none !important; }',
        'img { break-inside: avoid !important; page-break-inside: avoid !important; display: block !important; max-width: 100% !important; }',
        'table { border-collapse: collapse !important; }',
        'tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.ficha-punto, .photo-card, .audit-table tr, .firma-box, .firma-wrapper { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.paper-container { box-shadow: none !important; border-top: none !important; border-radius: 0 !important; padding: 0 !important; max-width: 100% !important; }',
        '.print-wrapper { display: table !important; width: 100% !important; }',
        '.print-wrapper > thead { display: table-header-group !important; }',
        '.print-wrapper > tbody { display: table-row-group !important; }',
        '.audit-table { display: table !important; }',
        '.audit-table tbody { display: table-row-group !important; }',
        '.audit-table tr { display: table-row !important; margin: 0 !important; box-shadow: none !important; }',
        '.audit-table td, .audit-table th { display: table-cell !important; }',
        '.audit-table td::before { display: none !important; }',
        '.status-select { border: none !important; background: transparent !important; font-weight: bold !important; }',
        'textarea { border: none !important; background: transparent !important; resize: none !important; min-height: 0 !important; }',
        '</style>'
    ].join('\n');

    // Capturar todos los estilos actuales de la página
    var allStyles = '';
    Array.prototype.forEach.call(document.querySelectorAll('style, link[rel="stylesheet"]'), function(el) {
        if (el.tagName === 'STYLE') { allStyles += '<style>' + el.textContent + '</style>\n'; }
    });

    // Construir HTML autocontenido
    var htmlContent = '<!DOCTYPE html><html lang="es"><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + fileName.replace('.pdf', '') + '</title>' +
        allStyles +
        printCSS +
        '</head><body>' +
        document.body.innerHTML +
        '<script>' +
        // Auto-print cuando se abra en Safari
        'window.onload = function() {' +
        '  var noprint = document.querySelectorAll(".no-print, nav, .fab-container, #toast-container, .modal-overlay");' +
        '  noprint.forEach(function(el) { el.style.display = "none"; });' +
        '};' +
        '<\/script>' +
        '</body></html>';

    var htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    var htmlFileName = fileName.replace('.pdf', '') + '.html';

    // ---- Intento 1: navigator.share() — abre hoja nativa de iOS ----
    if (navigator.canShare && navigator.canShare({ files: [new File([htmlBlob], htmlFileName, { type: 'text/html' })] })) {
        var fileToShare = new File([htmlBlob], htmlFileName, { type: 'text/html' });
        navigator.share({
            files: [fileToShare],
            title: fileName.replace('.pdf', ''),
            text: 'Abrir en Safari y compartir → Imprimir para guardar como PDF'
        }).then(function() {
            if (typeof showToast !== 'undefined') showToast('✅ Documento compartido');
        }).catch(function(err) {
            console.warn('[GSC] Share cancelado o error:', err);
            _saveHTMLFallback(docType, htmlFileName, htmlBlob);
        });

    // ---- Intento 2: Guardar .html con cordova-plugin-file ----
    } else {
        _saveHTMLFallback(docType, htmlFileName, htmlBlob);
    }
}

function _saveHTMLFallback(docType, htmlFileName, htmlBlob) {
    if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
        _getGSCDir(docType, 'PDF', function(dir) {
            _writeBlob(dir, htmlFileName, htmlBlob,
                '✅ Guardado en Archivos > ' + docType + '/PDF\n' +
                'Ábralo desde la app Archivos para imprimir como PDF');
        });
    } else {
        _fallbackDownload(htmlBlob, htmlFileName);
        if (typeof showToast !== 'undefined') showToast('✅ Archivo descargado: ' + htmlFileName);
    }
}
