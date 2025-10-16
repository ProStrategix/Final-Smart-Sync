// backend/imageConverter.web.js

import { files } from 'wix-media.v2';
import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

/**
 * Ensures WixImageURLs records exist for the products being processed
 * Creates records from PendingImageUrls data if they don't exist
 */
async function ensureWixImageUrlsRecords(fullArray) {
  try {
    console.log(`🔄 Ensuring WixImageURLs records exist for ${fullArray.length} items`);
    
    for (const item of fullArray) {
      const productId = item.productId || item.id || item._id || 'unknown';
      const rowId = item.rowId;
      const productName = item.productName || item.name || 'Unknown Product';
      const imageUrl = item.imageUrl || item.image || item.url || '';
      
      // Check if record already exists
      const existingRecord = await wixData.query('@prostrategix/smartsync-ecommerce/WixImageURLs')
        .eq('id', productId)
        .find();
      
      if (existingRecord.items.length === 0) {
        // Create new record
        const newRecord = {
          id: productId,
          productName: productName,
          originalUrl: imageUrl,
          status: 'processing',
          rowId: rowId,
          createdAt: new Date()
        };
        
        await wixData.insert('@prostrategix/smartsync-ecommerce/WixImageURLs', newRecord);
        console.log(`✅ Created WixImageURLs record for ${productId} with rowId: ${rowId}`);
      } else {
        // Update existing record to include rowId if missing
        const record = existingRecord.items[0];
        if (!record.rowId && rowId) {
          record.rowId = rowId;
          await wixData.update('@prostrategix/smartsync-ecommerce/WixImageURLs', record);
          console.log(`✅ Updated WixImageURLs record ${productId} with rowId: ${rowId}`);
        }
      }
    }
    
    console.log(`✅ WixImageURLs records are ready for processing`);
  } catch (err) {
    console.error(`❌ Error ensuring WixImageURLs records:`, err);
    throw err;
  }
}

/**
 * Provides user-friendly error messages and solutions for image import failures
 */
function getErrorGuidance(errorCode, errorMsg, imageUrl) {
  const guidance = {
    errorCode: errorCode,
    technicalError: errorMsg,
    userMessage: '',
    solution: '',
    actionRequired: ''
  };

  // Map error codes to user-friendly messages
  switch (errorCode) {
    case 'URL_IMPORT_ERROR':
      guidance.userMessage = 'The image could not be downloaded from the provided URL';
      guidance.solution = 'The image URL may be inaccessible, blocked, or the file format is not supported by Wix';
      guidance.actionRequired = 'Verify the URL is publicly accessible and points to a valid image file (JPG, PNG, GIF, or WEBP)';
      break;
      
    case 'INVALID_EXTENSION':
      guidance.userMessage = 'The image file type is not supported';
      guidance.solution = 'Only JPG, JPEG, PNG, GIF, and WEBP formats are supported';
      guidance.actionRequired = 'Convert the image to a supported format or use a different image';
      break;
      
    case 'INVALID_ARGUMENT':
      if (errorMsg.includes('406') || errorMsg.includes('not accessible')) {
        guidance.userMessage = 'The image server rejected the download request';
        guidance.solution = 'The image host may be blocking automated downloads or the URL has expired';
        guidance.actionRequired = 'Try downloading the image manually and re-uploading it, or use a different image hosting service';
      } else {
        guidance.userMessage = 'The image URL or file is invalid';
        guidance.solution = 'The URL format is incorrect or the file is corrupted';
        guidance.actionRequired = 'Check that the URL is complete and points to a valid image file';
      }
      break;
      
    default:
      guidance.userMessage = 'An unexpected error occurred during image import';
      guidance.solution = errorMsg;
      guidance.actionRequired = 'Check the image URL and try again, or contact support if the issue persists';
  }

  return guidance;
}

// Internal function - not wrapped in webMethod
async function fetchImagesFromWebInternal(fullArray) {
  const results = [];
  const errors = [];

  for (const item of fullArray) {
    // Safely extract properties with fallbacks
    const productId = item.productId || item.id || item._id || 'unknown';
    const rowId = item.rowId; // Preserve rowId for cross-collection matching
    const productName = item.productName || item.name || 'Unknown Product';
    const imageUrl = item.imageUrl || item.image || item.url || '';

    // Validate imageUrl exists
    if (!imageUrl) {
      console.error(`❌ No image URL provided for product ${productId}`);
      errors.push({
        productId,
        productName,
        imageUrl: 'N/A',
        errorCode: 'MISSING_URL',
        userMessage: 'No image URL was provided',
        solution: 'Ensure the product data includes a valid image URL',
        actionRequired: 'Add an image URL to the product data',
        technicalError: 'imageUrl property is missing or empty'
      });
      continue;
    }

    try {
      const urlExt = imageUrl.split('.').pop().toLowerCase().split('?')[0];
      if (!VALID_EXTENSIONS.includes(urlExt)) {
        const errorMsg = `Invalid image type: ${urlExt}`;
        console.error(`❌ ${errorMsg} for ${productId}: ${imageUrl}`);
        
        const guidance = getErrorGuidance('INVALID_EXTENSION', errorMsg, imageUrl);
        errors.push({
          productId,
          productName,
          imageUrl,
          ...guidance
        });
        continue;
      }

      // Use Wix Media v2 importFile - it fetches from external URLs automatically
      const displayName = `${productName}-${Date.now()}.${urlExt}`;
      
      console.log(`🔄 Attempting to import image for ${productName} from ${imageUrl}`);
      
      const importResult = await files.importFile(imageUrl, {
        displayName: displayName,
        mediaType: files.MediaType.IMAGE
      });

      // Validate that import was successful
      if (!importResult || !importResult.file) {
        throw new Error('Import returned no file descriptor');
      }

      const fileDescriptor = importResult.file;
      
      // Verify file descriptor has required properties
      if (!fileDescriptor.url || !fileDescriptor._id) {
        throw new Error('File descriptor missing required properties (url or _id)');
      }

      console.log(`✅ Successfully imported ${productName}: ${fileDescriptor.url}`);

      results.push({
        productId, 
        productName,
        wixMediaUrl: fileDescriptor.url,
        fileId: fileDescriptor._id,
        originalUrl: imageUrl,
        rowId: rowId // Include rowId for cross-collection matching
      });
    } catch (err) {
      const errorMsg = err.message || 'Unknown error during image import';
      const errorCode = err.code || err.details?.applicationError?.code || 'UNKNOWN_ERROR';
      
      // Get user-friendly error guidance
      const guidance = getErrorGuidance(errorCode, errorMsg, imageUrl);
      
      console.error(`❌ Error importing ${productName}:`, {
        productId,
        errorCode,
        technicalError: errorMsg,
        userMessage: guidance.userMessage,
        solution: guidance.solution,
        url: imageUrl
      });
      
      errors.push({
        productId,
        productName,
        imageUrl,
        ...guidance
      });
    }
  }

  return {
    results,
    errors,
    successCount: results.length,
    errorCount: errors.length,
    totalProcessed: fullArray.length
  };
}

// Internal function - not wrapped in webMethod
async function uploadImagesToWixAndSaveInternal(dataArray) {
  const savedItems = [];

  for (const item of dataArray) {
    const { productId, productName, wixMediaUrl, fileId, rowId } = item;

    try {
      // Update the existing record in WixImageURLs collection with the converted Wix media URL
      const existingRecord = await wixData.query('@prostrategix/smartsync-ecommerce/WixImageURLs')
        .eq('id', productId)
        .find();

      if (existingRecord.items.length > 0) {
        // Update existing record with Wix media URL
        const recordToUpdate = existingRecord.items[0];
        recordToUpdate.image = wixMediaUrl;
        recordToUpdate.wixFileId = fileId;
        recordToUpdate.convertedAt = new Date();
        recordToUpdate.rowId = rowId; // Ensure rowId is preserved
        
        const updated = await wixData.update('@prostrategix/smartsync-ecommerce/WixImageURLs', recordToUpdate);
        savedItems.push(updated);
        console.log(`✅ Updated ${productId} with Wix media URL: ${wixMediaUrl}`);
      } else {
        console.warn(`⚠️ No existing record found for ${productId} in WixImageURLs collection`);
      }

    } catch (err) {
      console.error(`❌ Error updating ${productId}: ${err.message}`);
    }
  }

  return savedItems;
}

export const processAndSaveImages = webMethod(Permissions.Anyone, async (fullArray) => {
  // First, create WixImageURLs records from the fullArray data if they don't exist
  await ensureWixImageUrlsRecords(fullArray);
  
  const fetchResult = await fetchImagesFromWebInternal(fullArray);
  
  // If there were any successful imports, save them
  if (fetchResult.results.length > 0) {
    const saved = await uploadImagesToWixAndSaveInternal(fetchResult.results);
    return {
      success: true,
      saved: saved,
      errors: fetchResult.errors,
      successCount: fetchResult.successCount,
      errorCount: fetchResult.errorCount,
      totalProcessed: fetchResult.totalProcessed
    };
  } else {
    // All imports failed
    return {
      success: false,
      saved: [],
      errors: fetchResult.errors,
      successCount: 0,
      errorCount: fetchResult.errorCount,
      totalProcessed: fetchResult.totalProcessed,
      message: 'All image imports failed'
    };
  }
});

export const fetchImagesFromWeb = webMethod(Permissions.Anyone, async (fullArray) => {
  return await fetchImagesFromWebInternal(fullArray);
});

export const processLocalFileUpload = webMethod(Permissions.Anyone, async (fileUrl, productId, productName) => {
  try {
    console.log(`🔄 Processing local file upload for ${productName}: ${fileUrl}`);
    
    // The file is already uploaded to Wix Media Manager via the upload button
    // We just need to update the WixImageURLs collection with this file
    
    const existingRecord = await wixData.query('@prostrategix/smartsync-ecommerce/WixImageURLs')
      .eq('id', productId)
      .find();

    if (existingRecord.items.length > 0) {
      const recordToUpdate = existingRecord.items[0];
      recordToUpdate.image = fileUrl;
      recordToUpdate.convertedAt = new Date();
      recordToUpdate.uploadMethod = 'local_file';
      
      const updated = await wixData.update('@prostrategix/smartsync-ecommerce/WixImageURLs', recordToUpdate);
      console.log(`✅ Updated ${productId} with local file URL: ${fileUrl}`);
      
      return {
        success: true,
        productId,
        productName,
        wixMediaUrl: fileUrl,
        message: 'Local file successfully uploaded and linked'
      };
    } else {
      console.warn(`⚠️ No existing record found for ${productId} in WixImageURLs collection`);
      return {
        success: false,
        productId,
        productName,
        error: 'No existing product record found',
        message: 'Product not found in database'
      };
    }

  } catch (err) {
    console.error(`❌ Error processing local file for ${productName}:`, err);
    return {
      success: false,
      productId,
      productName,
      error: err.message,
      message: 'Failed to process local file upload'
    };
  }
});

export const uploadImagesToWixAndSave = webMethod(Permissions.Anyone, async (dataArray) => {
  return await uploadImagesToWixAndSaveInternal(dataArray);
});
