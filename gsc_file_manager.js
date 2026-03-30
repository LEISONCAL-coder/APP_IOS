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
// Estrategia garantizada para Cordova WKWebView iOS usando html2pdf.js local:
//   1. Oculta botones y menús.
//   2. Genera el PDF usando JavaScript dentro de la app (Bypass a plugins defectuosos de Apple).
//   3. Usa Web Share API Nativo de iOS para "Guardar a Archivos/PDF" o imprimir.
// =============================================================================
function savePDFNativo(docType, fileName) {
    if (typeof showToast !== 'undefined') showToast('⏳ Generando PDF, un momento...');
    
    // Si la librería html2pdf.js no cargó (fallback)
    if (typeof html2pdf === 'undefined') {
        if (typeof showToast !== 'undefined') showToast('❌ Error: Librería html2pdf no detectada.');
        return;
    }

    var docName = fileName.replace('.pdf', '');

    // 1. Ocultar los elementos de la interfaz de usuario antes del escaneo
    var hideElements = document.querySelectorAll('.no-print, nav, .fab-container, #toast-container, .modal-overlay, .btn-action, .btn-firma, .hidden-file-input, .upload-zone');
    hideElements.forEach(function(e) { e.style.display = 'none'; });
    
    // Normalizar textareas y selects transitoriamente para canvas
    var selects = document.querySelectorAll('select');
    selects.forEach(function(s) { s.style.border = 'none'; s.style.appearance = 'none'; s.style.webkitAppearance = 'none'; });
    var textareas = document.querySelectorAll('textarea');
    textareas.forEach(function(t) { t.style.border = 'none'; t.style.resize = 'none'; });
    var inputs = document.querySelectorAll('.info-input');
    inputs.forEach(function(i) { i.style.borderBottom = '1px solid #ccc'; });

    // 2. Elemento contenedor que forma el "Papel"
    var element = document.body;

    var opt = {
        margin:       0,
        filename:     docName + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'pt', format: 'letter', orientation: 'portrait' }
    };

    // 3. Crear PDF en Memoria
    html2pdf().set(opt).from(element).outputPdf('blob').then(function(pdfBlob) {
        
        // 4. RESTAURAR VISIBILIDAD DE LA UI TRAS ESCANEO
        hideElements.forEach(function(e) { e.style.display = ''; });
        selects.forEach(function(s) { s.style.border = ''; s.style.appearance = ''; s.style.webkitAppearance = ''; });
        textareas.forEach(function(t) { t.style.border = ''; t.style.resize = ''; });
        inputs.forEach(function(i) { i.style.borderBottom = ''; });

        if (navigator.share) {
            // ECOSISTEMA NATIVO iOS WKWebView (iOS 14+):
            var fileToShare = new File([pdfBlob], docName + '.pdf', { type: "application/pdf" });
            navigator.share({
                title: docName,
                text: 'Documento PDF Evaluativo: ' + docName,
                files: [fileToShare]
            }).then(function() {
                if (typeof showToast !== 'undefined') showToast('✅ Documento PDF Completo.');
            }).catch(function(err) {
                console.error('[WebShare cancelado o no soportado para archivos completos]', err);
                if (err.name !== 'AbortError') {
                    _downloadFallback(pdfBlob, docName + '.pdf');
                }
            });
        } else {
            // PC u otro entorno sin Share
            _downloadFallback(pdfBlob, docName + '.pdf');
        }
    }).catch(function(e) {
        console.error("Error html2pdf", e);
        if (typeof showToast !== 'undefined') showToast('❌ Error creando archivo PDF.');
        
        // Restaurar si falla
        hideElements.forEach(function(e) { e.style.display = ''; });
        selects.forEach(function(s) { s.style.border = ''; s.style.appearance = ''; s.style.webkitAppearance = ''; });
        textareas.forEach(function(t) { t.style.border = ''; t.style.resize = ''; });
        inputs.forEach(function(i) { i.style.borderBottom = ''; });
    });
}

function _downloadFallback(blob, fileName) {
    if (typeof showToast !== 'undefined') showToast('Preparando descarga local...');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; 
    a.download = fileName;
    document.body.appendChild(a); 
    a.click();
    setTimeout(function() {
        document.body.removeChild(a); 
        URL.revokeObjectURL(url);
    }, 100);
}
