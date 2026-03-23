// =============================================================================
// gsc_file_manager.js — Motor Nativo de Archivos GSC para iOS (.ipa / Cordova)
// =============================================================================

/**
 * Obtiene (y crea si no existe) la ruta de subcarpeta nativa en iOS.
 * Estructura: documentsDirectory / docType / subFolder
 */
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
    console.error('[GSC FileManager] Error FS:', err);
    if (typeof showToast !== 'undefined') showToast('Error de sistema de archivos: ' + (err.code || JSON.stringify(err)));
}

/**
 * Escribe un Blob en un archivo dentro del directorio dado.
 */
function _writeBlob(dirEntry, fileName, blob, successMsg) {
    dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
        fileEntry.createWriter(function(writer) {
            writer.onwriteend = function() {
                console.log('[GSC FileManager] Guardado:', fileEntry.fullPath);
                if (typeof showToast !== 'undefined') showToast(successMsg);
            };
            writer.onerror = function(e) {
                console.error('[GSC FileManager] Error escribiendo:', e);
                if (typeof showToast !== 'undefined') showToast('Error al escribir el archivo.');
            };
            writer.write(blob);
        }, _fsError);
    }, _fsError);
}

/**
 * Descarga de respaldo (funciona en Safari/navegador web).
 */
function _fallbackDownload(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
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
            _writeBlob(dir, fileName, blob, '✅ JSON guardado en ' + docType + '/JSON');
        });
    } else {
        _fallbackDownload(blob, fileName);
        if (typeof showToast !== 'undefined') showToast('JSON descargado: ' + fileName);
    }
}

// =============================================================================
// GENERAR Y GUARDAR PDF
// Usa html2pdf.js para convertir el DOM a PDF sin usar window.print()
// =============================================================================
function savePDFNativo(docType, fileName, targetElement) {
    if (typeof showToast !== 'undefined') showToast('⏳ Generando PDF, espere...');

    // Ocultar todos los elementos .no-print durante la renderización
    var noPrintEls = document.querySelectorAll('.no-print');
    noPrintEls.forEach(function(el) {
        el._gscOldDisplay = el.style.display;
        el.style.setProperty('display', 'none', 'important');
    });

    // Esperar un frame para asegurar que el DOM se re-pintó sin los elementos ocultos
    setTimeout(function() {
        var opt = {
            margin:       [10, 8, 10, 8],   // mm: [arriba, derecha, abajo, izquierda]
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.85 },
            html2canvas: {
                scale:         2,            // Alta resolución
                useCORS:       true,
                allowTaint:    true,
                logging:       false,
                windowWidth:   document.documentElement.scrollWidth,
                windowHeight:  document.documentElement.scrollHeight,
                onclone: function(clonedDoc) {
                    // En el clon, asegurarnos que tablas e imágenes sean bloques completos
                    var style = clonedDoc.createElement('style');
                    style.textContent =
                        '.no-print { display: none !important; }' +
                        'img { break-inside: avoid; page-break-inside: avoid; display: block; max-width: 100%; }' +
                        'table { border-collapse: collapse; }' +
                        'tr, td, th { break-inside: avoid; page-break-inside: avoid; }' +
                        '.ficha-punto, .photo-card, .audit-table tr { break-inside: avoid; page-break-inside: avoid; }';
                    clonedDoc.head.appendChild(style);
                }
            },
            jsPDF: {
                unit:        'mm',
                format:      'letter',    // Tamaño carta (215.9 x 279.4 mm)
                orientation: 'portrait'
            },
            pagebreak: {
                mode:  ['css', 'legacy'],
                avoid: ['img', 'tr', 'td', '.ficha-punto', '.photo-card', '.firma-box', '.audit-table tr']
            }
        };

        html2pdf()
            .set(opt)
            .from(targetElement)
            .output('blob')
            .then(function(pdfBlob) {
                // Restaurar visibilidad
                noPrintEls.forEach(function(el) {
                    el.style.display = el._gscOldDisplay || '';
                });

                if (window.cordova && cordova.file && cordova.file.documentsDirectory) {
                    _getGSCDir(docType, 'PDF', function(dir) {
                        _writeBlob(dir, fileName, pdfBlob, '✅ PDF guardado en ' + docType + '/PDF');
                    });
                } else {
                    _fallbackDownload(pdfBlob, fileName);
                    if (typeof showToast !== 'undefined') showToast('✅ PDF descargado: ' + fileName);
                }
            })
            .catch(function(err) {
                noPrintEls.forEach(function(el) {
                    el.style.display = el._gscOldDisplay || '';
                });
                console.error('[GSC FileManager] Error generando PDF:', err);
                if (typeof showToast !== 'undefined') showToast('❌ Error al generar el PDF. Ver consola.');
            });
    }, 150);
}
