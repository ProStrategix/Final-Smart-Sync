// let tickerMessages = [];

// UNUSED FUNCTION - handleImageResults is exported but never called
// export async function handleImageResults(result) {
//   if (result !== null) {
//     pushMessage(tickerMessages, "success", `✅ ${result.name} - Complete`, "✅");
//     $w("#uploadWixUrlsTicker").data = [...tickerMessages];
//   }
// }

// UNUSED FUNCTION - handleWixImageUpload is exported but never called
// export async function handleWixImageUpload(imageData) {
//   if (imageData !== null) {
//     pushMessage(tickerMessages, "success", `✅ ${imageData.name} - Complete`, "✅");
//     $w("#uploadWixUrlsTicker").data = [...tickerMessages];
//   }
// }

/**
 * Clears all existing Wix URLs from the WixImageURLs collection
 */
// UNUSED FUNCTION - clearWixUrlsCollection is defined but never called
// async function clearWixUrlsCollection() {
//   try {
//     await postEntry(
//       "Clearing existing Wix URLs from collection",
//       "info",
//       "dataManagement.js",
//       null
//     );
//     
//     // Query all items from WixImageURLs collection
//     const results = await wixData.query("WixImageURLs")
//       .limit(1000)
//       .find();
//     
//     if (results.items.length > 0) {
//       // Delete all items
//       const deletePromises = results.items.map(item => 
//         wixData.remove("WixImageURLs", item._id)
//       );
//       await Promise.all(deletePromises);
//       
//       await postEntry(
//         `Cleared ${results.items.length} existing Wix URLs from collection`,
//         "info",
//         "dataManagement.js",
//         null
//       );
//     } else {
//       await postEntry(
//         "No existing Wix URLs to clear",
//         "info",
//         "dataManagement.js",
//         null
//       );
//     }
//   } catch (err) {
//     await postEntry(
//       `Error clearing Wix URLs collection: ${err.message}`,
//       "error",
//       "dataManagement.js",
//       err.stack
//     );
//     throw err;
//   }
// }

// UNUSED FUNCTION - DUPLICATE #1 - processImagesWithTicker (incomplete version)
// This function is never called - splitAndSaveData is not called from app.js
// /**
//  * Processes images with progress ticker display
//  */
// async function processImagesWithTicker(callableUrls) {
//   try {
//     await postEntry(
//       "Clearing existing Wix URLs from collection",
//       "info",
//       "dataManagement.js",
//       null
//     );
//     
//     // Query all items from WixImageURLs collection
//     const results = await wixData.query("WixImageURLs")
//       .limit(1000)
//       .find();
//     
//     if (results.items.length > 0) {
//       // Delete all items
//       const deletePromises = results.items.map(item => 
//         wixData.remove("WixImageURLs", item._id)
//       );
//       await Promise.all(deletePromises);
//       
//       await postEntry(
//         `Cleared ${results.items.length} existing Wix URLs from collection`,
//         "info",
//         "dataManagement.js",
//         null
//       );
//     } else {
//       await postEntry(
//         "No existing Wix URLs to clear",
//         "info",
//         "dataManagement.js",
//         null
//       );
//     }
//   } catch (err) {
//     await postEntry(
//       `Error clearing Wix URLs collection: ${err.message}`,
//       "error",
//       "dataManagement.js",
//       err.stack
//     );
//     throw err;
//   }
// }

// UNUSED FUNCTION - DUPLICATE #2 - processImagesWithTicker (complete version)
// This function is never called - splitAndSaveData is not called from app.js
// /**
//  * Processes images with progress ticker display
//  */
// async function processImagesWithTicker(callableUrls) {
//   try {
//     // Initialize ticker data
//     const tickerData = callableUrls.map((item, index) => ({
//       _id: uuidv4(),
//       index: index + 1,
//       productName: item.productName || item.name || 'Unknown Product',
//       status: "⏳ Pending",
//       statusColor: "#FFA500"
//     }));
//     
//     // Bind and display ticker - wrap in try/catch in case repeater doesn't exist
//     try {
//       $w("#uploadWixUrlsTicker").data = tickerData;
//       $w("#uploadWixUrlsTicker").onItemReady(($item, itemData) => {
//         $item("#tickerIndex").text = itemData.index.toString();
//         $item("#tickerProductName").text = itemData.productName;
//         $item("#tickerStatus").text = itemData.status;
//         $item("#tickerStatus").style.color = itemData.statusColor;
//       });
//     } catch (tickerError) {
//       await postEntry(
//         `Ticker display not available: ${tickerError.message}`,
//         "warning",
//         "dataManagement.js",
//         null
//       );
//     }
//     
//     await postEntry(
//       `Starting image processing for ${callableUrls.length} products`,
//       "info",
//       "dataManagement.js",
//       null
//     );
//     
//     // Process images and update ticker
//     const results = [];
//     for (let i = 0; i < callableUrls.length; i++) {
//       const item = callableUrls[i];
//       
//       try {
//         // Update ticker to "Processing"
//         tickerData[i].status = "🔄 Processing";
//         tickerData[i].statusColor = "#2196F3";
//         try {
//           $w("#uploadWixUrlsTicker").data = [...tickerData];
//         } catch (e) { /* Ticker not available */ }
//         
//         // Process single image
//         const imageResult = await processAndSaveImages([item]);
//         
//         if (imageResult && imageResult.success && imageResult.successCount > 0) {
//           // Update ticker to "Success"
//           tickerData[i].status = "✅ Complete";
//           tickerData[i].statusColor = "#4CAF50";
//           results.push(imageResult);
//           
//           await postEntry(
//             `Successfully processed image for ${item.productName || item.name}`,
//             "success",
//             "dataManagement.js",
//             null
//           );
//         } else {
//           // Update ticker to "Failed"
//           tickerData[i].status = "❌ Failed";
//           tickerData[i].statusColor = "#F44336";
//           
//           await postEntry(
//             `Failed to process image for ${item.productName || item.name}: ${imageResult?.errors?.[0]?.userMessage || 'Unknown error'}`,
//             "error",
//             "dataManagement.js",
//             null
//           );
//         }
//         
//         try {
//           $w("#uploadWixUrlsTicker").data = [...tickerData];
//         } catch (e) { /* Ticker not available */ }
//         
//       } catch (err) {
//         // Update ticker to "Error"
//         tickerData[i].status = "❌ Error";
//         tickerData[i].statusColor = "#F44336";
//         try {
//           $w("#uploadWixUrlsTicker").data = [...tickerData];
//         } catch (e) { /* Ticker not available */ }
//         
//         await postEntry(
//           `Error processing image for ${item.productName || item.name}: ${err.message}`,
//           "error",
//           "dataManagement.js",
//           err.stack
//         );
//       }
//     }
//     
//     await postEntry(
//       `Image processing complete. Successfully processed ${results.length} of ${callableUrls.length} images`,
//       "info",
//       "dataManagement.js",
//       null
//     );
//     
//     return results;
//     
//   } catch (err) {
//     await postEntry(
//       `Error in processImagesWithTicker: ${err.message}`,
//       "error",
//       "dataManagement.js",
//       err.stack
//     );
//     throw err;
//   }
// }

// UNUSED FUNCTION - splitDataImages is exported but never called in app.js or splitAndSaveData
// export async function splitDataImages(normalizedData) {
//     let parsedData = [];
//     let imageResults = {};  
//     if (normalizedData.length > 0) {
//         console.log("Splitting data and image URLs from normalized data");
//         postEntry("Splitting data and image URLs from normalized data", "info", loc, null);
//         pushMessage(messages, "info", "Splitting data and image URLs...", "");
//         const splitResult = await splitAndSaveData(normalizedData);
//         parsedData = splitResult.parsedData || [];
//         imageResults = splitResult.imageResults || {};
//         console.log("Data and image URLs split complete");
//         postEntry("Data and image URLs split complete", "info", loc, null);
//         pushMessage(messages, "success", "Data and image URLs split complete", "✅");
//     } else {
//         console.warn("No normalized data provided for splitting");
//         postEntry("No normalized data provided for splitting", "warning", loc, null);
//         pushMessage(messages, "warning", "No normalized data to split", "⚠️");
//         return goTo("ERRORMISSINGDATA");
//     }
//     return { parsedData, imageResults };
// }



/**
 * Processes normalized rows and classifies images into data, imgs, errors
 */
