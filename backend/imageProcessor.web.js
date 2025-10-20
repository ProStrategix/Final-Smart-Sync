import { mediaManager } from 'wix-media-backend';
import { Permissions, webMethod } from "wix-web-module";
import { elevate } from 'wix-auth';
import { fetch } from 'wix-fetch';
import { postEntryBE } from 'backend/logManagementBE.web';

const loc = "imageProcessor.web.js";

/**
 * Uploads an array of image objects to Wix Media Manager.
 * Each object should have: { productName, rowId, blob, contentType, imageUrl, ...otherProps }
 * Returns: [{ fileName: originalFileName, wixId: fileUrl, ...file }]
 */
export const uploadBlobs = webMethod(Permissions.Anyone, async (objects) => {
    const results = [];
    const failures = [];
    
    try {
        postEntryBE("Starting blob upload process", "info", loc, null);
        
        for (const file of objects) {
            try {
                const { productName, rowId, blob, contentType, imageUrl, ...otherProps } = file;
                
                // Generate a clean filename from productName or use rowId as fallback
                const cleanFileName = (productName || `image_${rowId}`).replace(/[^a-zA-Z0-9.-]/g, '_');
                const fileExtension = getFileExtension(contentType, imageUrl);
                const fileName = `${cleanFileName}${fileExtension}`;
                
                // === STEP 1: Request Upload URL ===
                const uploadRequest = await mediaManager.getFileUploadUrl({
                    mediaType: 'image',
                    fileName: fileName,
                });
                
                const { uploadUrl, fileUrl } = uploadRequest;
                
                // === STEP 2: Upload Blob to Signed URL ===
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': contentType || 'application/octet-stream',
                        'Content-Length': blob.size?.toString() || undefined
                    },
                    body: blob
                });
                
                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    const errorMsg = `Upload failed for "${fileName}": ${uploadResponse.status} ${errorText}`;
                    postEntryBE(errorMsg, "error", loc, null);
                    
                    failures.push({
                        ...file,
                        error: errorMsg,
                        success: false
                    });
                    continue;
                }
                
                // === STEP 3: Return in requested format ===
                const result = {
                    fileName: fileName,  // This is the originalFileName equivalent
                    wixId: fileUrl,     // This is the Wix media URL
                    ...otherProps,      // Spread all other properties from original file
                    rowId,
                    productName,
                    success: true,
                    uploadedAt: new Date().toISOString()
                };
                
                results.push(result);
                postEntryBE(`Successfully uploaded ${fileName}`, "success", loc, null);
                
            } catch (fileError) {
                const errorMsg = `Error processing file ${file.productName || file.rowId}: ${fileError.message}`;
                postEntryBE(errorMsg, "error", loc, fileError.stack);
                
                failures.push({
                    ...file,
                    error: errorMsg,
                    success: false
                });
            }
        }
        
        postEntryBE(`Upload process completed. Success: ${results.length}, Failed: ${failures.length}`, "info", loc, null);
        
        return {
            success: true,
            results: results,
            failures: failures,
            totalProcessed: objects.length,
            successCount: results.length,
            failureCount: failures.length
        };
        
    } catch (error) {
        postEntryBE(`Upload process failed: ${error.message}`, "error", loc, error.stack);
        return {
            success: false,
            error: error.message,
            results: [],
            failures: objects.map(obj => ({ ...obj, error: error.message, success: false }))
        };
    }
});

/**
 * Helper function to determine file extension from content type or URL
 */
function getFileExtension(contentType, imageUrl) {
    // Try to get extension from content type first
    if (contentType) {
        const typeMap = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg', 
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp',
            'image/svg+xml': '.svg'
        };
        
        if (typeMap[contentType.toLowerCase()]) {
            return typeMap[contentType.toLowerCase()];
        }
    }
    
    // Fallback to URL extension
    if (imageUrl) {
        const urlParts = imageUrl.split('.');
        if (urlParts.length > 1) {
            const ext = urlParts.pop().toLowerCase().split('?')[0]; // Remove query params
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                return `.${ext}`;
            }
        }
    }
    
    // Default fallback
    return '.jpg';
}