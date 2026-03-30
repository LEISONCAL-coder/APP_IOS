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
// Usa cordova-plugin-printer para invocar el menú nativo (Guardar a Archivos/PDF).
// =============================================================================
function savePDFNativo(docType, fileName) {
    if (typeof showToast !== 'undefined') showToast('⏳ Generando vista previa PDF...');

    // --- Recopilar todos los estilos del documento ---
    var allStyles = '';
    var styleEls = document.querySelectorAll('style');
    for (var i = 0; i < styleEls.length; i++) {
        allStyles += styleEls[i].textContent;
    }

    // --- CSS adicional para impresión correcta ---
    var printCSS = [
        '@page { size: letter portrait; margin: 15mm 10mm; }',
        'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }',
        'nav, .no-print, .fab-container, #toast-container, .modal-overlay,',
        '.btn-action, .btn-firma, .hidden-file-input, .upload-zone { display: none !important; }',
        'img { break-inside: avoid !important; page-break-inside: avoid !important;',
        '      display: block !important; max-width: 100% !important; }',
        'table { border-collapse: collapse !important; width: 100% !important; }',
        'tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.ficha-punto, .photo-card, .audit-table tr, .firma-box { break-inside: avoid !important; page-break-inside: avoid !important; }',
        '.paper-container { box-shadow: none !important; border-radius: 0 !important; border-top: none !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important;}',
        '.print-wrapper { display: table !important; width: 100% !important;}',
        '.print-wrapper > thead { display: table-header-group !important; }',
        '.print-wrapper > tbody { display: table-row-group !important; }',
        '.audit-table { display: table !important; }',
        '.audit-table tbody { display: table-row-group !important; }',
        '.audit-table tr { display: table-row !important; margin: 0 !important; box-shadow: none !important; border: 1px solid #ccc !important;}',
        '.audit-table td, .audit-table th { display: table-cell !important;  background: white !important; color: black !important; border: 1px solid #000 !important;}',
        '.audit-table td::before { display: none !important; }',
        '.status-select { border: none !important; background: transparent !important; font-weight: bold !important; color: black !important; }',
        'textarea { border: none !important; background: transparent !important; resize: none !important; min-height: 0 !important; }'
    ].join('\n');

    var docName = fileName.replace('.pdf', '');

    // --- Construir HTML autocontenido ---
    var htmlContent =
        '<!DOCTYPE html><html lang="es"><head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + docName + '</title>' +
        '<style>' + allStyles + printCSS + '</style>' +
        '</head><body onload="' +
          'document.querySelectorAll(\'.no-print,nav,.fab-container,#toast-container,.modal-overlay\').forEach(function(e){e.style.display=\'none\';});' +
        '">' +
        document.body.innerHTML +
        '</body></html>';

    // 1. Cordova NATIVER PRINTER (iOS APP)
    if (window.cordova && cordova.plugins && cordova.plugins.printer) {
        cordova.plugins.printer.canPrintItem(htmlContent, function (canPrint) {
            if (canPrint) {
                // Al imprimir pasamos el documento como HTML, iOS lo levanta y muestra su diálogo de "Print / Save to Files" nativo
                cordova.plugins.printer.print(htmlContent, { 
                    name: docName,
                    duplex: 'none'
                }, function (res) {
                    if (typeof showToast !== 'undefined') showToast('✅ Diálogo nativo de PDF finalizado.');
                });
            } else {
                if (typeof showToast !== 'undefined') showToast('❌ Subsistema de impresión inactivo.');
            }
        });
    } 
    // 2. FALLBACK A NAVIGATOR SHARE API PARA DESCARGA (Chrome/Safari Web)
    else if (navigator.share) {
        var htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        var fileToShare = new File([htmlBlob], docName + '.html', { type: 'text/html' });
        navigator.share({
            title: docName,
            text: 'Descarga de evaluación: ' + docName,
            files: [fileToShare]
        }).catch(function(err) {
            console.error('[WebShare] Cancelado', err);
            _executeWebFallback(htmlContent, docName);
        });
    }
    // 3. FALLBACK ABSOLUTO (PC)
    else {
        _executeWebFallback(htmlContent, docName);
    }
}

function _executeWebFallback(htmlContent, docName) {
    if (typeof showToast !== 'undefined') showToast('Generando formato local...');
    // Intentar abrir ventana de impresión estándar
    var printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(function() {
            printWindow.print();
        }, 500);
    } else {
        // Ultimate fallback si el popup fue bloqueado: Descargar .html visible como archivo
        var htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(htmlBlob);
        var a = document.createElement('a');
        a.href = url; a.download = docName + '.html';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
}
