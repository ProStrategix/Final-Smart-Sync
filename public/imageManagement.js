/**
 * imageManagement.js
 * Image processing and conversion management for SmartSync
 */

import { postEntry } from 'public/logManagement.js';
import { goTo, pushMessageImg } from 'public/stateManagement.js';
import {session} from 'wix-storage';

const loc = "imageManagement.js";
let imgMessages = [];
let imgFiles = [];
let failedFiles = [];
let filesToUpload = [];
if(typeof(session.getItem('imgMessageOn')) === "undefined" || session.getItem('imgMessageOn') === null || session.getItem('imgMessageOn') === 'false' ) {
    pushMessageImg(imgMessages, "info", "Image messaging system activated", "🔄");
    session.setItem('imgMessageOn', 'true')
    session.setItem('imgMessages', JSON.stringify(imgMessages));
} else {
    imgMessages = JSON.parse(session.getItem('imgMessages'));
}

/**
 * Initiates the image conversion process
 */
export async function handleMixed(values, types) {}


export async function covertImgToWixUrls(values) {
    let results = await initiateConversion(values);
    let wixUrls = 
}


export async function initiateConversion(values) {
    let files = values.imgs
    try {
        postEntry("Image conversion initiated", "info", loc, null);
        pushMessageImg(imgMessages, "info", "Image conversion initiated", "🔄");
        console.log("🔄 Starting image conversion process...");
        
        // Reset arrays for new processing
        imgFiles = [];
        failedFiles = [];
        
        // Process files sequentially to avoid overwhelming the system
        for (const file of files) {
            console.log(`Processing file: ${file.productName || file.name}`);
            try {
                const response = await fetch(file.imageUrl);
                
                if (!response.ok) {
                    pushMessageImg(imgMessages, "error", `Network response was not ok for ${file.productName}`, "❌");
                    failedFiles.push({
                        ...file,
                        success: false,
                        error: `Network response was not ok ${response.status} ${response.statusText}`
                    });
                    continue;
                }
                
                const imgBlob = await response.blob();
                const mimeType = response.headers.get('content-type');
                
                if (!mimeType || !mimeType.startsWith('image/')) {
                    pushMessageImg(imgMessages, "error", `Fetched file is not an image for ${file.productName}`, "❌");
                    failedFiles.push({
                        ...file,
                        success: false,
                        error: `Fetched file is not an image, content-type: ${mimeType}`
                    });
                    continue;
                }
                
                imgFiles.push({
                    ...file,
                    blob: imgBlob,
                    success: true,
                    contentType: mimeType,
                    size: imgBlob.size
                });
                
                console.log(`✅ Successfully fetched ${file.productName}`);
                pushMessageImg(imgMessages, "success", `Successfully processed ${file.productName}`, "✅");
                
            } catch (error) {
                pushMessageImg(imgMessages, 'error', `Error processing ${file.productName}: ${error.message}`, "❌");
                failedFiles.push({
                    ...file,
                    success: false,
                    error: error.message
                });
            }
        }
        
        if (imgFiles.length > 0) {
            pushMessageImg(imgMessages, "success", `Successfully retrieved ${imgFiles.length} image urls as images`, "✅");
        }
        
        if (failedFiles.length > 0) {
            pushMessageImg(imgMessages, "warning", `${failedFiles.length} files failed to process`, "⚠️");
        }
        
        pushMessageImg(imgMessages, "success", "Image conversion process completed", "✅");

        console.log("✅ Image conversion process completed.");
        console.log("Processed Images:", imgFiles, " needs to be uploaded & then merged with files");
        
        
        let conversionSummary = {
            success: true,
            processedImages: imgFiles,
            failedImages: failedFiles,
            totalProcessed: imgFiles.length,
            totalFailed: failedFiles.length
        };

        return upd
        
    } catch (error) {
        postEntry(`Image conversion failed: ${error.message}`, "error", loc, error.stack);
        console.error("❌ Image conversion failed:", error);
        
        pushMessageImg(imgMessages, "error", "Image conversion failed", "❌");
        goTo("ERRORSYSTEM");
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Placeholder functions for future implementation
export function processAndSaveImages(imageData) {
    console.log("🔄 processAndSaveImages called - not yet implemented");
    return Promise.resolve({ success: false, message: "Not implemented yet" });
}

export function manageImgResult(result) {
    console.log("🔄 manageImgResult called - not yet implemented");
    return result;
}

export function handleImgError(error) {
    console.log("🔄 handleImgError called - not yet implemented");
    return error;
}

export function clearErrorReport() {
    console.log("🔄 clearErrorReport called - not yet implemented");
    return true;
}

export function setupErrorReportUI() {
    console.log("🔄 setupErrorReportUI called - not yet implemented");
    return true;
}

export function getErrorReport() {
    console.log("🔄 getErrorReport called - not yet implemented");
    return [];
}

export function manageFileResult(result) {
    console.log("🔄 manageFileResult called - not yet implemented");
    return result;
}

export function processCallableUrls(urls) {
    console.log("🔄 processCallableUrls called - not yet implemented");
    return Promise.resolve([]);
}

export function saveUploadedFiles(files) {
    console.log("🔄 saveUploadedFiles called - not yet implemented");
    return Promise.resolve([]);
}

export function processManualUrls(urls) {
    console.log("🔄 processManualUrls called - not yet implemented");
    return Promise.resolve([]);
}

export function processExternalImageUrls(urls) {
    console.log("🔄 processExternalImageUrls called - not yet implemented");
    return Promise.resolve([]);
}

export function processWixUrls(urls) {
    console.log("🔄 processWixUrls called - not yet implemented");
    return Promise.resolve([]);
}

export function processRawImgs(images) {
    console.log("🔄 processRawImgs called - not yet implemented");
    return Promise.resolve([]);
}

$w('#uploadRawImgs').onChange( (event) => {
    console.log("🔄 uploadRawImgs onChange triggered - not yet implemented");
    $w("#uploadRawImgs").uploadFiles(files) 
    .then((uploadedFiles) => {
        uploadedFiles.forEach((uploadedFile) => {
          console.log("File url:", uploadedFile.fileUrl); 
          pushMessageImg(imgMessages, "success", `${uploadedFile.originalFileName} was uploaded successfully. It now is assigned to ${uploadedFile.fileUrl}`, "✅");
        })
}

.then((uploadedFiles) => {
    uploadedFiles.forEach((uploadedFile) => {
      console.log("File url:", uploadedFile.fileUrl);
    });
  })
  .catch((uploadError) => {
    let errCode = uploadError.errorCode; // 7751
    let errDesc = uploadError.errorDescription; // "Error description"
  });