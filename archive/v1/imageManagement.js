import wixData from 'wix-data';
import { pushMessage, pushMessageImg, goTo } from 'public/stateManager.js';
import { postEntry } from 'public/logManagement.js';
import { processAndSaveImages } from 'backend/imageConverter.web.js';
import { handleFinalReview } from 'public/transferManagement.js';

let errorReport = [];
let imageMessages = [];
let messages = [];

/**
 * Manages image processing results - handles success/failure, stores errors, updates UI
 */
export function manageImgResult(result, productId, productName, imageMessages, messages) {
  console.log(`✅ Image processing result for ${productName}:`, result);
  
  // Check if this specific image had errors
  if (result.errors && result.errors.length > 0) {
    const error = result.errors[0];
    
    // Store detailed error in errorReport array
    errorReport.push({
      _id: productId,
      productId: productId,
      productName: productName,
      imageUrl: error.imageUrl,
      errorCode: error.errorCode,
      userMessage: error.userMessage,
      solution: error.solution,
      actionRequired: error.actionRequired,
      technicalError: error.technicalError
    });
    
    console.error(`❌ Image import failed for ${productName}:`, error);
    pushMessageImg(imageMessages, productId, productName, "❌ Failed - See Error Report", "❌");
    pushMessage(messages, "error", `Failed: ${productName}`, "❌");
    
  } else if (result.successCount > 0) {
    pushMessageImg(imageMessages, productId, productName, "✅ Complete", "✅");
    pushMessage(messages, "success", `Successfully processed ${productName}`, "✅");
    
  } else {
    pushMessageImg(imageMessages, productId, productName, "❌ Failed", "❌");
    pushMessage(messages, "error", `Failed: ${productName}`, "❌");
  }
}

export function manageFileResult(file, imageMessages, messages) {
  console.log(`✅ Image processing result for ${file.sourceUrl}:`, file.operationStatus);
  
  const productId = file._id || 'N/A';
  const productName = file.displayName || file.fileName || 'Unknown File';
  
  // Check if this specific image had errors
  if (file.operationStatus && file.operationStatus === 'FAILED') {
    const error = file.error;
    
    // Store detailed error in errorReport array
    errorReport.push({
      _id: productId || 'N/A',
      productId: productId || 'N/A',
      productName: productName || 'N/A',
      imageUrl: file.sourceUrl || 'N/A',
      errorCode: "never provided",
      userMessage: "Wix rejected this file but does not provide any reason for upload failures.",
      solution: " All we can suggest is trying another image. We apologize for the inconvenience — this is a limitation of the Wix platform.",
      actionRequired: " All we can suggest is trying another image.",
      technicalError: " Wix fails to provide any reason for upload failures -  this is a major limitation when using this platform."
    });
    
    console.error(`❌ Image import failed for ${file.sourceUrl}:`, error);
    pushMessageImg(imageMessages, productId, productName, "❌ Failed - See Error Report", "❌");
    pushMessage(messages, "error", `Failed: ${productName}`, "❌");
    
  } else if (file.operationStatus && file.operationStatus === 'READY') {
    pushMessageImg(imageMessages, productId, productName, "✅ Complete", "✅");
    pushMessage(messages, "success", `Successfully processed ${productName}`, "✅");
    
  } else {
    pushMessageImg(imageMessages, productId, productName, " ⚠️ Pending - Check Prior to Transmitting", "⚠️");
    pushMessage(messages, "warn", `Pending: ${productName}`, "⚠️");
  }
}

/**
 * Handles errors caught during image processing
 */
export function handleImgError(err, productId, productName, imageMessages, messages) {
  console.error(`❌ Image processing error for ${productName}:`, err);
  pushMessageImg(imageMessages, productId, productName, "❌ Failed", "❌");
  pushMessage(messages, "error", `Failed: ${productName}`, "❌");
  postEntry(`Image processing error: ${productName} - ${err.message}`, "error", "widget.js", err.stack);
}

/**
 * Manages file upload results for manual image additions
 */
// export function manageFileResult(file) {
//   console.log(`📁 File uploaded: ${file.fileName}`);
//   // TODO: Implement file processing logic
//   // This would handle manual image uploads to replace failed URL imports
// }

/**
 * Returns the error report array
 */
export function getErrorReport() {
  return errorReport;
}

/**
 * Clears the error report array
 */
export function clearErrorReport() {
  errorReport = [];
}

/**
 * Save manually uploaded files to WixImageURLs collection
 * Called after uploadFiles() button completes in frontend
 */
export async function saveUploadedFiles(wixMediaUrls) {
  try {
    await wixData.bulkInsert("@prostrategix/smartsync-ecommerce/WixImageURLs", wixMediaUrls);
    console.log(`✅ Saved ${wixMediaUrls.length} uploaded files to WixImageURLs`);
    return { success: true, count: wixMediaUrls.length };
  } catch (err) {
    console.error("❌ Error saving uploaded files:", err);
    throw err;
  }
}

/**
 * Process manually entered URLs (comma-separated text input)
 * Note: Redirects for URLs differ depending on their source
 */
export async function processManualUrls(urls, type, messagesArray) {
  messages = messagesArray;
  
  urls.forEach( async url => {
    // Safely extract properties with fallbacks
    const productName = url.productName || url.name || url.productId || "Unknown Product";
    const productId = url.productId || url.id || "";
    
    // Add/update with pending status
    await pushMessageImg(imageMessages, productId, productName, "⏳ Pending", "⏳");
      
    // Update to processing
    await pushMessageImg(imageMessages, productId, productName, "🔄 Processing", "🔄");
            
    // Process the image
    await processAndSaveImages([url])
      .then((result) => manageImgResult(result, productId, productName, imageMessages, messages))
      .catch((err) => handleImgError(err, productId, productName, imageMessages, messages));
  })
        
  // After all images processed, set up error report UI
  let errors = getErrorReport();
  if (errors.length > 0) {
    setupErrorReportUI();
  } else {
    $w("#fileErrorText").collapse();
    $w("#fileErrorButton").collapse();
    $w("#spinner").show();	
    $w("#fileSuccessText").expand();
    console.log('checking for errors for type: ', type)
    if (type === "urlcsv") {
      $w("#fileSuccessText").text = "No errors were detected. In a few seconds, you will be taken to the next step, where you can review and transmit your data to your store.";
      setTimeout(() => {
        handleFinalReview()
        goTo("REVIEW")
      }, 5000);
    } else {
      $w("#fileSuccessText").text = "No errors were detected. In a few seconds, you will be asked to match uploaded images to your products.";
      setTimeout(() => {
        goTo("MATCH")
      }, 5000);
    }
  }
}

/**
 * Process callable URLs - handles all image processing logic
 * URLs are processed via backend (imageConverter.web.js) using files.importFile()
 */
export async function processCallableUrls(callableUrls, messagesArray) {
  messages = messagesArray;
  imageMessages = [];
  clearErrorReport();
  
  // Process images one by one with ticker updates
  for (const url of callableUrls) {
    const productName = url.productName || url.name || url.productId || "Unknown Product";
    const productId = url.productId || url.id || "";
    
    // Add/update with pending status
    await pushMessageImg(imageMessages, productId, productName, "⏳ Pending", "⏳");
    
    // Update to processing
    await pushMessageImg(imageMessages, productId, productName, "🔄 Processing", "🔄");
    
    // Process the image
    await processAndSaveImages([url])
      .then((result) => manageImgResult(result, productId, productName, imageMessages, messages))
      .catch((err) => handleImgError(err, productId, productName, imageMessages, messages));
  }
  
  // After all images processed, set up error report UI
  let errors = getErrorReport();
  if (errors.length > 0) {
    setupErrorReportUI();
  } else {
    $w("#fileErrorText").collapse();
    $w("#fileErrorButton").collapse();
    $w("#fileSuccessText").text = "No errors were detected. In a few seconds, you will be taken to the next step, where you can review and transmit your data to your store.";
    $w('#continueToReview').expand();
    $w("#fileSuccessText").expand();
  }

  // Query WixImageURLs to verify updates
  console.log("🔍 Checking saved data in WixImageURLs collection...");
  const wixImageUrls = await wixData.query('@prostrategix/smartsync-ecommerce/WixImageURLs').find();
  console.log("📊 WixImageURLs collection (should now have Wix media URLs):", wixImageUrls.items);
  
  pushMessage(messages, "success", `Successfully processed ${callableUrls.length} images`, "✅");
}

/**
 * Binds error report data to repeater and sets up button visibility
 */
export function setupErrorReportUI() {
  // Check if error report UI elements exist
  try {
    //const button = $w("#viewErrorReportButton");
    const button = $w("#fileErrorButton");
    const message = $w("#fileErrorText");
    const nextButton = $w("#fileSuccessButton");
    const nextMessage = $w("#fileSuccessText");
    // Show/hide error report button based on errors
    if (errorReport.length > 0) {
     // Show text and button
      message.html = `<p span style="font-weight: bold;">View Error Report</span> ${errorReport.length} errors were detected during the uploading process. Click View Error Report to view suggested solutions.</p>`;
      button.expand();
      message.expand();

      nextButton.collapse();
      nextMessage.collapse();

      console.log(`📊 Error Report: ${errorReport.length} image import failures detected`);
      
      // Bind error report data to repeater BEFORE setting up click handler
      $w("#errorReportRepeater").data = errorReport;
      
      $w("#errorReportRepeater").onItemReady(($item, itemData, index) => {
        //$item("#errorIndex").text = (index + 1).toString();
       // $item("#errorProductName").text = itemData.productName;
        $item("#errorMessage").text = itemData.userMessage;
        $item("#errorSolution").text = itemData.solution;
       // $item("#errorAction").text = itemData.actionRequired;
        //$item("#errorUrl").text = itemData.imageUrl;
      });
      
      // Set up button click handler to navigate
      button.onClick(() => {
        goTo("ERRORREPORT");
      });
    } else {
      button.collapse();
      message.collapse();
      nextButton.expand();
      nextMessage.expand();
      console.log("✅ No image import errors detected");  
      nextButton.onClick(() => {
        goTo("TRANSMITTING");
      })
    }
  } catch (err) {
    // UI elements don't exist yet - just log the error report to console
    if (errorReport.length > 0) {
      console.log(`📊 Error Report: ${errorReport.length} image import failures detected`);
      console.log("Error details:", errorReport);
      console.log("Note: Add #viewErrorReportButton and #errorReportRepeater to UI to display error report");
    }
  }
}


