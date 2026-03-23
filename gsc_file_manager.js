// gsc_file_manager.js
// Maneja el guardado transparente en el sistema de archivos de iOS (vía Cordova-plugin-file)

function getGSCFolder(docType, subFolder, callback) {
    if (!window.cordova || !cordova.file || !cordova.file.documentsDirectory) {
        throw new Error("Cordova File API no disponible");
    }

    window.resolveLocalFileSystemURL(cordova.file.documentsDirectory, function (dirEntry) {
        // Carpeta del documento (Ej: Acta_Entorno)
        dirEntry.getDirectory(docType, { create: true, exclusive: false }, function (docDir) {
            // Subcarpeta (Ej: PDF o JSON)
            docDir.getDirectory(subFolder, { create: true, exclusive: false }, function (finalDir) {
                callback(finalDir);
            }, onError);
        }, onError);
    }, onError);

    function onError(err) {
        console.error("Error obteniendo carpeta nativa", err);
        if(typeof showToast !== 'undefined') showToast("Error de sistema de archivos: " + err.code);
    }
}

function writeBlobToFile(dirEntry, fileName, blob, successMsg) {
    dirEntry.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
        fileEntry.createWriter(function (fileWriter) {
            fileWriter.onwriteend = function() {
                if(typeof showToast !== 'undefined') showToast(successMsg);
            };
            fileWriter.onerror = function(e) {
                console.error("Fallo al escribir archivo", e);
                if(typeof showToast !== 'undefined') showToast("Error al escribir el archivo");
            };
            fileWriter.write(blob);
        }, function(err) { console.error("Error createWriter", err); });
    }, function(err) { console.error("Error getFile", err); });
}

function saveJSONNativo(formType, fileName, dataObj) {
    // formType: Ej "Acta_Entorno"
    if (!window.cordova || !cordova.file) {
        // Fallback Web
        let blob = new Blob([JSON.stringify(dataObj)], {type: "application/json"});
        fallbackDownload(blob, fileName, "Proyecto Guardado Web");
        return;
    }

    try {
        let blob = new Blob([JSON.stringify(dataObj)], {type: "application/json"});
        getGSCFolder(formType, "JSON", function(dirEntry) {
            writeBlobToFile(dirEntry, fileName, blob, `Guardado en: ${formType}/JSON/${fileName}`);
        });
    } catch (e) {
        console.error(e);
        let blob = new Blob([JSON.stringify(dataObj)], {type: "application/json"});
        fallbackDownload(blob, fileName, "Proyecto Guardado Fallback");
    }
}

function savePDFNativo(formType, fileName, htmlElementToPrint, isLandscape = true) {
    // Si hay un contenedor global de notificaciones (toast), ocultarlo si afecta el render visual
    let toast = document.getElementById('toast-container');
    if (toast) toast.style.display = 'none';

    // Ocultar elementos "no-print"
    let noPrintEls = htmlElementToPrint.querySelectorAll('.no-print');
    noPrintEls.forEach(el => {
        // Guardamos el display original por si acaso
        el.dataset.oldDisplay = el.style.display;
        el.style.display = 'none';
    });

    if(typeof showToast !== 'undefined') showToast("Generando PDF... Puede tardar unos segundos.");

    let opt = {
      margin:       0.2, // Márgenes pequeños para maximizar espacio
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: isLandscape ? 'landscape' : 'portrait' }
    };

    html2pdf().set(opt).from(htmlElementToPrint).output('blob').then(function(pdfBlob) {
        // Restaurar elementos
        if (toast) toast.style.display = '';
        noPrintEls.forEach(el => {
            el.style.display = el.dataset.oldDisplay || '';
        });
        
        if (!window.cordova || !cordova.file) {
            // Fallback Web: Descarga directa
            fallbackDownload(pdfBlob, fileName, "PDF Generado Web");
            return;
        }

        getGSCFolder(formType, "PDF", function(dirEntry) {
            writeBlobToFile(dirEntry, fileName, pdfBlob, `PDF Guardado: ${formType}/PDF/${fileName}`);
        });
    }).catch(err => {
        // Restaurar elementos en caso de fallo
        if (toast) toast.style.display = '';
        noPrintEls.forEach(el => el.style.display = el.dataset.oldDisplay || '');
        console.error("Error generando PDF", err);
        if(typeof showToast !== 'undefined') showToast("Error al generar PDF");
    });
}

function fallbackDownload(blob, fileName, msg) {
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); 
    URL.revokeObjectURL(url);
    if(typeof showToast !== 'undefined') showToast(msg);
}
