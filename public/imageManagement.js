/**
 * imageManagement.js
 * Image processing and conversion management for SmartSync
 */

import { postEntry } from 'public/logManagement.js';
import { goTo, pushMessageImg } from 'public/stateManagement.js';
import {session} from 'wix-storage';
import { uploadBlobs } from 'backend/imageProcessor.web.js';
import wixData from 'wix-data';

const loc = "imageManagement.js";
const PRODUCT_LISTINGS_DB = "@prostrategix/smartsync-product-transfer/ParsedData";
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
    
    if (results.success && results.wixURLs) {
        return results.wixURLs;
    }
    
    return [];
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

        // Upload blobs to Wix Media Manager
        if (imgFiles.length > 0) {
            pushMessageImg(imgMessages, "info", `Uploading ${imgFiles.length} images to Wix Media Manager...`, "🔄");
            postEntry(`Starting upload of ${imgFiles.length} images to Wix Media Manager`, "info", loc, null);
            
            try {
                const uploadResult = await uploadBlobs(imgFiles);
                
                if (!uploadResult.success) {
                    pushMessageImg(imgMessages, "error", `Upload failed: ${uploadResult.error}`, "❌");
                    postEntry(`Upload failed: ${uploadResult.error}`, "error", loc, null);
                    return {
                        success: false,
                        error: uploadResult.error
                    };
                }
                
                console.log("✅ Upload completed. Results:", uploadResult.results);
                pushMessageImg(imgMessages, "success", `Successfully uploaded ${uploadResult.successCount} images`, "✅");
                postEntry(`Successfully uploaded ${uploadResult.successCount} of ${uploadResult.totalProcessed} images`, "success", loc, null);
                
                // Extract rowIds and wixURLs from upload results
                const rowIds = uploadResult.results.map(result => result.rowId);
                const wixURLs = uploadResult.results.map(result => result.wixId);
                
                console.log("Extracted rowIds:", rowIds);
                console.log("Extracted wixURLs:", wixURLs);
                
                // Merge upload results with values.data (values[0])
                const productData = values[0]; // This is the data array
                
                if (!Array.isArray(productData)) {
                    pushMessageImg(imgMessages, "error", "Product data is not in expected format", "❌");
                    postEntry("Product data is not an array - cannot merge", "error", loc, null);
                    return {
                        success: false,
                        error: "Invalid product data format"
                    };
                }
                
                // Create a lookup map for quick access to uploaded image data by rowId
                const uploadedImagesMap = new Map();
                uploadResult.results.forEach(result => {
                    uploadedImagesMap.set(result.rowId, result);
                });
                
                // Merge product data with uploaded image URLs
                const newProductListings = productData.map(product => {
                    const uploadedImage = uploadedImagesMap.get(product.rowId);
                    
                    if (uploadedImage) {
                        return {
                            ...product,
                            mainImg: uploadedImage.wixId,  // Add the Wix media URL
                            fileName: uploadedImage.fileName,
                            imageUploadedAt: uploadedImage.uploadedAt
                        };
                    }
                    
                    // Product without uploaded image (might be in failed uploads)
                    return product;
                });
                
                console.log("✅ Created newProductListings with", newProductListings.length, "products");
                pushMessageImg(imgMessages, "info", `Merging image data with ${newProductListings.length} products...`, "🔄");
                postEntry(`Created merged product listings with ${newProductListings.length} products`, "info", loc, null);
                
                // Save newProductListings to the database
                try {
                    // Clear existing data first
                    const existingResults = await wixData.query(PRODUCT_LISTINGS_DB).find();
                    const existingIds = existingResults.items.map(item => item._id);
                    
                    if (existingIds.length > 0) {
                        await wixData.bulkRemove(PRODUCT_LISTINGS_DB, existingIds);
                        console.log(`Cleared ${existingIds.length} existing product listings`);
                        postEntry(`Cleared ${existingIds.length} existing product listings`, 'info', loc, null);
                    }
                    
                    // Insert new product listings
                    const savedProducts = await wixData.bulkInsert(PRODUCT_LISTINGS_DB, newProductListings);
                    
                    console.log("✅ Successfully saved", savedProducts.items.length, "product listings");
                    pushMessageImg(imgMessages, "success", `Successfully saved ${savedProducts.items.length} product listings with images`, "✅");
                    postEntry(`Successfully saved ${savedProducts.items.length} product listings to database`, "success", loc, null);
                    
                    // Store session data for later use
                    session.setItem('newProductListings', JSON.stringify(newProductListings));
                    session.setItem('uploadSummary', JSON.stringify({
                        totalProducts: newProductListings.length,
                        successfulUploads: uploadResult.successCount,
                        failedUploads: uploadResult.failureCount
                    }));
                    
                    return {
                        success: true,
                        newProductListings: newProductListings,
                        rowIds: rowIds,
                        wixURLs: wixURLs,
                        uploadSummary: {
                            totalProducts: newProductListings.length,
                            successfulUploads: uploadResult.successCount,
                            failedUploads: uploadResult.failureCount,
                            savedProducts: savedProducts.items.length
                        },
                        uploadResults: uploadResult.results,
                        failedUploads: uploadResult.failures
                    };
                    
                } catch (saveError) {
                    console.error("❌ Failed to save product listings:", saveError);
                    pushMessageImg(imgMessages, "error", `Failed to save product listings: ${saveError.message}`, "❌");
                    postEntry(`Failed to save product listings: ${saveError.message}`, "error", loc, saveError.stack);
                    
                    return {
                        success: false,
                        error: `Failed to save product listings: ${saveError.message}`,
                        newProductListings: newProductListings,  // Still return the data
                        rowIds: rowIds,
                        wixURLs: wixURLs
                    };
                }
                
            } catch (uploadError) {
                console.error("❌ Upload process failed:", uploadError);
                pushMessageImg(imgMessages, "error", `Upload process failed: ${uploadError.message}`, "❌");
                postEntry(`Upload process failed: ${uploadError.message}`, "error", loc, uploadError.stack);
                
                return {
                    success: false,
                    error: uploadError.message
                };
            }
        }
        
        return conversionSummary;
        
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

$w('#uploadRawImgs').onChange((event) => {
    console.log("🔄 uploadRawImgs onChange triggered - not yet implemented");
    $w("#uploadRawImgs").uploadFiles()
        .then((uploadedFiles) => {
            uploadedFiles.forEach((uploadedFile) => {
                console.log("File url:", uploadedFile.fileUrl); 
                pushMessageImg(imgMessages, "success", `${uploadedFile.originalFileName} was uploaded successfully. It now is assigned to ${uploadedFile.fileUrl}`, "✅");
            });
        })
        .catch((uploadError) => {
            let errCode = uploadError.errorCode;
            let errDesc = uploadError.errorDescription;
            console.error("Upload error:", errCode, errDesc);
            pushMessageImg(imgMessages, "error", `Upload failed: ${errDesc}`, "❌");
        });
});