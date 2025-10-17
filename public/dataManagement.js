import wixData from 'wix-data';
import Papa from 'papaparse';
import { postEntry } from 'public/logManagement.js';
import { goTo, pushMessage } from 'public/stateManager.js';
import { v4 as uuidv4 } from 'uuid';
import { splitAndSaveNormalizedData } from 'backend/dataConverter.web.js';
import { pause } from '../archive/stateManagement';

let messages = []; // Initialize messages array for this module

const A = "@prostrategix/smartsync-ecommerce/ParsedData";
const B = "@prostrategix/smartsync-ecommerce/WixImageURLs";
const loc = "dataManagement.js";

export async function uploadAccessCsv(file) {
                console.log ("file name: ", file.fileName)
                console.log ("url :", file.fileUrl)
                console.log( 'old file name: ', file.originalFileName)
                pushMessage(messages, "success", "CSV file was successfully uploaded.", "✅")
                postEntry("CSV file was successfullly uploaded in Media Manager", "success", loc, null)
                // Note: State change handled in app.js - removing widget reference
                
                const { success, downloadUrl, error } = await getUrl(file.fileUrl);
    
                 if (!success) {
                    console.error("Failed to resolve download URL:", error);
                    postEntry("CSV file was successfullly uploaded in Media Manager", "error", "getUrl() in dataConverter.web.js", null)
                    return;
                }
                
                console.log("Fetchable download URL:", downloadUrl);
                postEntry("fetchable url was provided to the csv content", "success", "getUrl", null)
                const response = await fetch(downloadUrl);
                const text = await response.text();
                console.log("CSV contents:", text);
                console.log("CSV Text Length:", text?.length);
                console.log("CSV Sample:", text?.slice(0, 100));
                pushMessage(messages, "success", "CSV file was successfully accessed.", "✅")
                postEntry("CSV file was successfullly accessed and text extracted", "success", "widget.js", null)
                return text
            }

export async function processCsv(csvText) {
   const rawParse = await parseCsv(csvText)
    let parsed = JSON.parse(rawParse)
    let schemaMap = await getSchemaMap()
    console.log('data heading to normalization: ' , parsed, ' vs map: ', schemaMap)
    postEntry("Csv data has been parsed and schema map created", 'success',"dataManagement.js", null)
    let normalizedRaw = await normalizeCsv(parsed.headers, parsed.rows, schemaMap)
    let normalize = normalizedRaw
    console.log('normalized data: ', normalize)
    postEntry("Csv data has been normalized", 'success',"dataManagement.js", null)
    
    // Check for missing essential headers first
    if (normalize.missingEssentialHeaders && normalize.missingEssentialHeaders.length > 0) {
        console.warn("Missing essential headers detected:", normalize.missingEssentialHeaders);
        pushMessage(messages, "warning", `Missing ${normalize.missingEssentialHeaders.length} essential headers`, "⚠️");
        postEntry(`Missing essential headers: ${normalize.missingEssentialHeaders.join(", ")}`, 'warning', loc, null);
        await reportMissingHeaders(normalize.missingEssentialHeaders);
        return { success: false, error: "Missing essential headers", missingHeaders: normalize.missingEssentialHeaders };
    }
    
    // Check for normalized rows
    if (normalize.normalizedRows?.length > 0) {
        pushMessage(messages, "success", "CSV data has been normalized.", "✅")
        postEntry("Data have been normalized", 'success',"dataConverter.web.js", null)
        await pause (1000)
        return {data: normalize, success: true}
    } else {
        console.error("No normalized rows found after normalization.");
        postEntry("No normalized rows found after normalization.", 'error', loc, null);
        pushMessage(messages, "error", "No normalized rows found after normalization.", "❌");
        goTo("ERROR");
       
    }    
    return { success: false, error: "No normalized rows found after normalization." };
}

export async function getSchemaMap() {
  const schemaMap = {};

  const results = await wixData.query('@prostrategix/smartsync-ecommerce/SchemaNormalization')
    .limit(1000)
    .find();

  results.items.forEach(item => {
    const main = item.main?.trim();
    if (!main) return;

    const aliases = [];
    for (let i = 1; i <= 7; i++) {
      const alt = item[`alt${i}`];
      if (alt && typeof alt === 'string') aliases.push(alt.trim());
    }

    const notes = (item.Notes || "")
      .split(',')
      .map(n => n.trim())
      .filter(Boolean);

    // Check if this field is essential (marked as TRUE in Combos column)
    const isEssential = item.combos === true || item.combos === "TRUE" || item.combos === "true";

    schemaMap[main] = { 
      aliases, 
      flags: notes,
      essential: isEssential
    };
  });

  return schemaMap;
}


export async function parseCsv(csvText) {
  try {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    const headers = parsed.meta.fields || [];
    const rows = parsed.data || [];

    if (!headers.length) {
      throw new Error("No headers found in CSV");
    }

    return JSON.stringify({
      success: true,
      headers,
      rows
    });

  } catch (err) {
    return JSON.stringify({
      success: false,
      error: err.message
    });
  }
}

export async function splitAndSaveData(normalizedRows) {
  try {
    console.log("🔄 splitAndSaveData called with", normalizedRows.length, "rows");
    await postEntry(
      `Starting data split and save process from frontend. Row count: ${normalizedRows.length}`,
      "info",
      "dataManagement.js",
      null
    );

    const result = await splitAndSaveNormalizedData(normalizedRows);
    console.log("📊 Backend result:", result);
    
    // Case 1: Success - data saved successfully
    if (result.success && !result.requiresSmartSyncApp && !result.requiresImageProcessing && !result.missingImages) {
      await postEntry(
        `Data split and save completed successfully. Total processed: ${result.totalRowsProcessed}, Image records: ${result.imageRecordsSaved}, Parsed records: ${result.parsedRecordsSaved}`,
        "info",
        "dataManagement.js",
        null
      );
      
      return {
        success: true,
        message: `Successfully processed ${result.totalRowsProcessed} rows`,
        details: {
          imageRecordsSaved: result.imageRecordsSaved,
          parsedRecordsSaved: result.parsedRecordsSaved,
          generatedIds: result.generatedIds
        }
      };
    } 
    
    // Case 2: Wix URLs detected - requires SmartSync app (routes to ERRORMISSINGIMAGES)
    else if (result.requiresSmartSyncApp && result.wixUrls && result.wixUrls.length > 0) {
      await postEntry(
        `Data split encountered Wix URLs: ${result.wixUrls.length} products with Wix media URLs`,
        "error",
        "dataManagement.js",
        null
      );
      
      goTo("ERRORMISSINGIMAGES");
      
      // Create formatted text list for better readability
      const productList = result.wixUrls
        .map((p, index) => `${index + 1}. ${p.productName} (ID: ${p.productId})`)
        .join("\n");
      
      $w("#missingImagesMessage").text = `${result.message}
          Products with Wix URLs (${result.wixUrls.length}):
            ${productList}
          To continue, please download and install the SmartSync Wix Image Converter app:
            ${result.appInstallUrl}`;
      
      return {
        success: false,
        requiresSmartSyncApp: true,
        wixUrls: result.wixUrls,
        message: result.message
      };
    }
    
    // Case 3: Callable URLs detected - ready for image processing
    else if (result.requiresImageProcessing && result.callableUrls && result.callableUrls.length > 0) {
      await postEntry(
        `Callable image URLs detected and saved: ${result.callableUrls.length} products ready for processing`,
        "info",
        "dataManagement.js",
        null
      );
      
      // NOTE: Backend already clears and populates PendingImageUrls before returning
      // No need to clear here - would be redundant and risky
      
      // Process images with ticker
      const imageResults = await processImagesWithTicker(result.callableUrls);
      
      return {
        success: true,
        requiresImageProcessing: true,
        callableUrls: result.callableUrls,
        imageResults: imageResults,
        message: `Successfully processed ${imageResults.length} images`,
        nextAction: result.nextAction
      };
    }
    
    // Case 4: Missing images - all products have empty/invalid image URLs
    else if (result.missingImages === true && result.emptyImageProducts && result.emptyImageProducts.length > 0) {
      console.log("🚨 MISSING IMAGES CASE DETECTED");
      console.log("Missing images count:", result.emptyImageProducts.length);
      console.log("Empty image products:", result.emptyImageProducts);
      
      await postEntry(
        `Missing images detected: ${result.emptyImageProducts.length} products without image URLs`,
        "warning",
        "dataManagement.js",
        null
      );
      
      goTo("ERRORMISSINGIMAGES");
      
      // Create formatted text list for better readability
      const productList = result.emptyImageProducts
        .map((p, index) => `${index + 1}. ${p.productName} (ID: ${p.productId})`)
        .join("\n");
      
      $w("#missingImagesMessage").text = `${result.message}

Products missing images (${result.emptyImageProducts.length}):

${productList}

Please add image URLs to your CSV or upload images manually.`;
      
      return {
        success: false,
        missingImages: true,
        emptyImageProducts: result.emptyImageProducts,
        message: result.message
      };
    }
    
    // Case 5: General error
    else {
      await postEntry(
        `Data split and save failed: ${result.error || 'Unknown error'}`,
        "error",
        "dataManagement.js",
        null
      );
      
      return {
        success: false,
        error: result.error || 'Unknown error occurred during data processing'
      };
    }

  } catch (err) {
    console.error("❌ ERROR in splitAndSaveData:", err);
    await postEntry(
      `Frontend data split function failed: ${err.message}`,
      "error",
      "dataManagement.js",
      err.stack
    );
    
    return {
      success: false,
      error: err.message
    };
  }
}

export async function reportMissingHeaders(missingHeaders) {
  try {
    // Convert missing headers to lowercase for matching
    const normalizedMissing = missingHeaders.map(h => h.toLowerCase().trim());
    
    await postEntry(
      `Querying MissingEssential collection for headers: ${normalizedMissing.join(", ")}`,
      "info",
      "dataManagement.js",
      null
    );

    // Query all records from MissingEssential collection
    let allGuidance = await wixData.query('@prostrategix/smartsync-ecommerce/MissingEssential')
      .limit(1000)
      .find();

    await postEntry(
      `MissingEssential collection returned ${allGuidance.items.length} total records`,
      "info",
      "dataManagement.js",
      null
    );

    // Filter records where Header field (lowercase, trimmed) matches any missing header
    const matchedGuidance = allGuidance.items.filter(item => {
      const headerValue = (item.header || '').toLowerCase().trim();
      return normalizedMissing.includes(headerValue);
    });

    await postEntry(
      `Found ${matchedGuidance.length} matching guidance records`,
      "info",
      "dataManagement.js",
      null
    );

    // If no matches found, create default entries
    if (matchedGuidance.length === 0) {
      await postEntry(
        `No guidance found in MissingEssential collection. Creating default entries.`,
        "warning",
        "dataManagement.js",
        null
      );
      
      matchedGuidance.push(...missingHeaders.map(header => ({
        header: header,
        description: `The '${header}' field is required but was not found in your CSV`,
        solution: `Add a column named '${header}' to your CSV file with appropriate values`
      
      })));
    }

    //$w('#missingHeadersBox').expand();
    $w('#missingHeadersRepeater').data = matchedGuidance.map(item => ({
      _id: uuidv4(),
      field: item.header,
      description: item.description,
      solution: item.solution
    }));
    
    $w("#missingHeadersRepeater").onItemReady( ($item, itemData, index) => {
      $item("#index").text = (index + 1).toString();
      $item("#header").text = itemData.field;
      $item("#description").text = itemData.description;
      $item("#solution").text = itemData.solution;
    });
    
    await postEntry(
      `Missing essential headers: ${missingHeaders.join(", ")}`,
      "error",
      "dataManagement.js",
      null
    );
    
    //$w("#returnButton").show();
    return goTo("ERRORMISSINGHEADERS");
    
  } catch (err) {
    await postEntry(
      `Error in reportMissingHeaders: ${err.message}`,
      "error",
      "dataManagement.js",
      err.stack
    );
    throw err;
  }
}

let tickerMessages = [];

export async function handleImageResults(result) {
  if (result !== null) {
    pushMessage(tickerMessages, "success", `✅ ${result.name} - Complete`, "✅");
    $w("#uploadWixUrlsTicker").data = [...tickerMessages];
  }
}

export async function handleWixImageUpload(imageData) {
  if (imageData !== null) {
    pushMessage(tickerMessages, "success", `✅ ${imageData.name} - Complete`, "✅");
    $w("#uploadWixUrlsTicker").data = [...tickerMessages];
  }
}

/**
 * Clears all existing Wix URLs from the WixImageURLs collection
 */
async function clearWixUrlsCollection() {
  try {
    await postEntry(
      "Clearing existing Wix URLs from collection",
      "info",
      "dataManagement.js",
      null
    );
    
    // Query all items from WixImageURLs collection
    const results = await wixData.query("WixImageURLs")
      .limit(1000)
      .find();
    
    if (results.items.length > 0) {
      // Delete all items
      const deletePromises = results.items.map(item => 
        wixData.remove("WixImageURLs", item._id)
      );
      await Promise.all(deletePromises);
      
      await postEntry(
        `Cleared ${results.items.length} existing Wix URLs from collection`,
        "info",
        "dataManagement.js",
        null
      );
    } else {
      await postEntry(
        "No existing Wix URLs to clear",
        "info",
        "dataManagement.js",
        null
      );
    }
  } catch (err) {
    await postEntry(
      `Error clearing Wix URLs collection: ${err.message}`,
      "error",
      "dataManagement.js",
      err.stack
    );
    throw err;
  }
}

/**
 * Processes images with progress ticker display
 */
async function processImagesWithTicker(callableUrls) {
  try {
    // Initialize ticker data
    const tickerData = callableUrls.map((item, index) => ({
      _id: uuidv4(),
      index: index + 1,
      productName: item.productName || item.name || 'Unknown Product',
      status: "⏳ Pending",
      statusColor: "#FFA500"
    }));
    
    // Bind and display ticker - wrap in try/catch in case repeater doesn't exist
    try {
      $w("#uploadWixUrlsTicker").data = tickerData;
      $w("#uploadWixUrlsTicker").onItemReady(($item, itemData) => {
        $item("#tickerIndex").text = itemData.index.toString();
        $item("#tickerProductName").text = itemData.productName;
        $item("#tickerStatus").text = itemData.status;
        $item("#tickerStatus").style.color = itemData.statusColor;
      });
    } catch (tickerError) {
      await postEntry(
        `Ticker display not available: ${tickerError.message}`,
        "warning",
        "dataManagement.js",
        null
      );
    }
    
    await postEntry(
      `Starting image processing for ${callableUrls.length} products`,
      "info",
      "dataManagement.js",
      null
    );
    
    // Process images and update ticker
    const results = [];
    for (let i = 0; i < callableUrls.length; i++) {
      const item = callableUrls[i];
      
      try {
        // Update ticker to "Processing"
        tickerData[i].status = "🔄 Processing";
        tickerData[i].statusColor = "#2196F3";
        try {
          $w("#uploadWixUrlsTicker").data = [...tickerData];
        } catch (e) { /* Ticker not available */ }
        
        // Process single image
        const imageResult = await processAndSaveImages([item]);
        
        if (imageResult && imageResult.success && imageResult.successCount > 0) {
          // Update ticker to "Success"
          tickerData[i].status = "✅ Complete";
          tickerData[i].statusColor = "#4CAF50";
          results.push(imageResult);
          
          await postEntry(
            `Successfully processed image for ${item.productName || item.name}`,
            "success",
            "dataManagement.js",
            null
          );
        } else {
          // Update ticker to "Failed"
          tickerData[i].status = "❌ Failed";
          tickerData[i].statusColor = "#F44336";
          
          await postEntry(
            `Failed to process image for ${item.productName || item.name}: ${imageResult?.errors?.[0]?.userMessage || 'Unknown error'}`,
            "error",
            "dataManagement.js",
            null
          );
        }
        
        try {
          $w("#uploadWixUrlsTicker").data = [...tickerData];
        } catch (e) { /* Ticker not available */ }
        
      } catch (err) {
        // Update ticker to "Error"
        tickerData[i].status = "❌ Error";
        tickerData[i].statusColor = "#F44336";
        try {
          $w("#uploadWixUrlsTicker").data = [...tickerData];
        } catch (e) { /* Ticker not available */ }
        
        await postEntry(
          `Error processing image for ${item.productName || item.name}: ${err.message}`,
          "error",
          "dataManagement.js",
          err.stack
        );
      }
    }
    
    await postEntry(
      `Image processing complete. Successfully processed ${results.length} of ${callableUrls.length} images`,
      "info",
      "dataManagement.js",
      null
    );
    
    return results;
    
  } catch (err) {
    await postEntry(
      `Error in processImagesWithTicker: ${err.message}`,
      "error",
      "dataManagement.js",
      err.stack
    );
    throw err;
  }
}

