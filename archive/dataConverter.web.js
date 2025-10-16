import {mediaManager} from 'wix-media-backend';
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { elevate } from 'wix-auth';
import {postEntryBE} from 'backend/logManagementBE.web';
import { v4 as uuidv4 } from 'uuid';

// Elevate wixData functions to bypass permission restrictions
const elevatedQuery = elevate(wixData.query);
const elevatedBulkRemove = elevate(wixData.bulkRemove);
const elevatedBulkInsert = elevate(wixData.bulkInsert);

// Wrap Wix's getDownloadUrl as a webMethod
export const getUrl = webMethod(Permissions.Anyone, async (wixUrl) => {
  try {
    const downloadUrl = await mediaManager.getDownloadUrl(wixUrl);
    return { success: true, downloadUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function normalizeString(str = "", flags = []) {
  if (!str) return "";
  
  // Convert to lowercase and remove special characters but keep basic structure
  let result = str.toLowerCase().replace(/[-_\s]/g, '').replace(/[^a-z0-9]/g, '');
  
  if (flags.includes("-HU")) {
    result = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  } else if (flags.includes("-U")) {
    result = str.toLowerCase().replace(/[-_\s]/g, '');
  }
  
  return result;
}

export const normalizeCsv = webMethod(Permissions.Anyone, async (headers, rows, schemaMap) => {
  try {
    if (!Array.isArray(headers) || !Array.isArray(rows) || typeof schemaMap !== 'object') {
      throw new Error("Invalid inputs passed to normalizeCsv");
    }

    await postEntryBE("info", "CSV normalization started", {
      headerCount: headers.length,
      rowCount: rows.length,
      schemaFieldCount: Object.keys(schemaMap).length,
      location: "dataConverter.web.js"
    });

    // 1. Build header match map - Enhanced to fix unmapped headers
    const aliasToMainMap = {};
    for (const [mainKey, { aliases, flags }] of Object.entries(schemaMap)) {
      // Add all aliases
      aliases.forEach(alias => {
        const norm = normalizeString(alias, flags);
        aliasToMainMap[norm] = mainKey;
      });
      // Add main key itself
      aliasToMainMap[normalizeString(mainKey, flags)] = mainKey;
    }

    const headerMap = {};
    const mappedHeaders = {};
    const usedCsvHeaders = new Set();
    const fixedHeaders = {}; // Track header fixes

    // First pass - direct matches
    for (const header of headers) {
      const normHeader = normalizeString(header);
      const matchedMain = aliasToMainMap[normHeader];
      if (matchedMain && !usedCsvHeaders.has(header)) {
        headerMap[matchedMain] = header;
        mappedHeaders[matchedMain] = header;
        usedCsvHeaders.add(header);
      }
    }

    // Second pass - fix unmapped essential headers by finding best matches
    const essentialFields = Object.entries(schemaMap)
      .filter(([_, config]) => config.essential)
      .map(([mainKey]) => mainKey);

    for (const essentialField of essentialFields) {
      if (!mappedHeaders[essentialField]) {
        // Try to find a match by checking if any unmapped header could work
        for (const header of headers) {
          if (usedCsvHeaders.has(header)) continue;
          
          const normHeader = normalizeString(header);
          const { aliases } = schemaMap[essentialField];
          
          // Check if this header could be an alias for this essential field
          const couldMatch = aliases.some(alias => {
            const normAlias = normalizeString(alias);
            return normHeader.includes(normAlias) || normAlias.includes(normHeader) ||
                   normHeader === normalizeString(essentialField);
          });
          
          if (couldMatch) {
            headerMap[essentialField] = header;
            mappedHeaders[essentialField] = header;
            usedCsvHeaders.add(header);
            fixedHeaders[header] = essentialField;
            break;
          }
        }
      }
    }

    // Fill in remaining unmapped fields
    Object.keys(schemaMap).forEach(mainKey => {
      if (!headerMap[mainKey]) headerMap[mainKey] = undefined;
    });

    await postEntryBE("success", "Header fixes applied", {
      fixedHeaders,
      location: "dataConverter.web.js"
    });

    const unmapped = Object.entries(headerMap)
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    const missingEssentialHeaders = essentialFields.filter(key => !mappedHeaders[key]);

    await postEntryBE("success", "Header mapping completed", {
      mappedCount: Object.keys(mappedHeaders).length,
      unmappedCount: unmapped.length,
      essentialFields,
      missingEssentialHeaders,
      location: "dataConverter.web.js"
    });

    // 3. Normalize rows and validate essential fields
    const normalizedRows = [];
    const invalidRows = [];

    for (const [index, row] of rows.entries()) {
      const normRow = {};
      let hasAllEssentials = true;
      const missingEssentials = [];

      // Map all fields
      for (const [mainKey, csvHeader] of Object.entries(headerMap)) {
        if (csvHeader && row.hasOwnProperty(csvHeader)) {
          normRow[mainKey] = row[csvHeader];
          
          // Handle unitPrice field - ensure it's a number with 2 decimal places
          if (mainKey === "unitPrice") {
            const priceValue = row[csvHeader];
            const numericPrice = parseFloat(priceValue);
            
            if (!isNaN(numericPrice)) {
              // Valid number - format to 2 decimal places
              normRow[mainKey] = numericPrice.toFixed(2);
              // Create formatted price in US currency
              normRow['formattedPrice'] = new Intl.NumberFormat("en-US", { 
                style: "currency", 
                currency: "USD" 
              }).format(numericPrice);
              
              await postEntryBE("info", `Formatted price for row ${index}`, {
                original: priceValue,
                numeric: normRow[mainKey],
                formatted: normRow['formattedPrice'],
                location: "dataConverter.web.js"
              });
            } else {
              // Not a valid number - keep original value but log warning
              normRow[mainKey] = priceValue;
              await postEntryBE("warn", `Invalid price value for row ${index}`, {
                original: priceValue,
                location: "dataConverter.web.js"
              });
            }
          }
        }
      }

      // Add unique rowId to each row
      normRow.rowId = uuidv4();

      // Check essential fields (excluding mainImg since we handle missing images separately)
      essentialFields.forEach(essentialField => {
        // Skip mainImg validation - it's handled in splitAndSaveNormalizedData
        if (essentialField === 'mainImg') {
          return;
        }
        
        if (!normRow[essentialField] || normRow[essentialField].toString().trim() === '') {
          hasAllEssentials = false;
          missingEssentials.push(essentialField);
        }
      });

      if (hasAllEssentials) {
        normalizedRows.push(normRow);
      } else {
        invalidRows.push({
          rowIndex: index,
          row: normRow,
          missingEssentials
        });
      }
    }

    await postEntryBE("success", "Row validation completed", {
      validRows: normalizedRows.length,
      invalidRows: invalidRows.length,
      totalProcessed: rows.length,
      location: "dataConverter.web.js"
    });

    if (invalidRows.length > 0) {
      await postEntryBE("warn", "Invalid rows detected. Rows were normalized, but skipped and logged for reference and repair.", {
        invalidRowCount: invalidRows.length,
        sampleInvalidRow: invalidRows[0],
        location: "dataConverter.web.js"
      });
    }

    return {
      success: true,
      headers,
      originalRows: rows,
      headerMap,
      normalizedRows,
      invalidRows,
      mappedHeaders,
      unmapped,
      essentialFields,
      missingEssentialHeaders,
      validRowCount: normalizedRows.length,
      invalidRowCount: invalidRows.length
    };

  } catch (err) {
    await postEntryBE("error", "CSV normalization failed", { 
      error: err.message,
      location: "dataConverter.web.js"
    });
    return {
      error: err.message,
      success: false
    };
  }
});

export const splitAndSaveNormalizedData = webMethod(Permissions.Anyone, async (normalizedRows) => {
  try {
    if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
      throw new Error("Invalid or empty normalized data provided");
    }

    await postEntryBE("info", "Starting data split and save process", {
      rowCount: normalizedRows.length,
      location: "dataConverter.web.js"
    });

    // Step 1: Confirm each row has unique ID, add if missing
    const processedRows = [];
    const generatedIds = [];
    
    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      let processedRow = { ...row };
      
      // Ensure rowId exists (should already be set in normalizeCsv, but double-check)
      if (!processedRow.rowId) {
        processedRow.rowId = uuidv4();
        await postEntryBE("info", `Added missing rowId for row ${index}`, {
          generatedId: processedRow.rowId,
          location: "dataConverter.web.js"
        });
      }
      
      // Check if ID exists and is valid
      if (!processedRow.ID || processedRow.ID.toString().trim() === '') {
        // Generate unique ID if missing
        processedRow.ID = `auto_${Date.now()}_${index}`;
        generatedIds.push(processedRow.ID);
        await postEntryBE("info", `Generated ID for row ${index}`, {
          generatedId: processedRow.ID,
          location: "dataConverter.web.js"
        });
      }
      
      processedRows.push(processedRow);
    }

    // Step 2: Analyze image URLs and categorize them
    const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const imageAnalysis = {
      wixUrls: [],
      callableUrls: [],
      rawImgs: [],
      emptyOrInvalid: []
    };
    const invalidUrlWarnings = [];

    for (let index = 0; index < processedRows.length; index++) {
      const row = processedRows[index];
      
      if (row.mainImg && row.mainImg.trim() !== '') {
        const imageUrl = row.mainImg.trim();
        
        // Check if it's a Wix media URL
        const isWixMedia = imageUrl.startsWith('wix:image://') || 
                          imageUrl.startsWith('wix:document://') || 
                          imageUrl.includes('static.wixstatic.com') ||
                          imageUrl.includes('wixmp-');
        
        if (isWixMedia) {
          imageAnalysis.wixUrls.push({
            rowId: row.rowId,
            productId: row.ID,
            productName: row.name || 'Unknown Product',
            imageUrl: imageUrl,
            rowIndex: index
          });
        } else if (VALID_IMAGE_EXTENSIONS.some(ext => imageUrl.endsWith(ext))) {
           imageAnalysis.rawImgs.push({
            rowId: row.rowId,
            productId: row.ID,
            productName: row.name || 'Unknown Product',
            imageUrl: imageUrl,
            rowIndex: index
          });
        } else {
          // Validate if it's a proper URL with valid image extension
          let isValidUrl = false;
          let hasValidExtension = false;
          let validationError = null;
          
          try {
            // Check if it's a valid URL format
            const url = new URL(imageUrl);
            isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
            
            // Extract file extension from URL path (before query params)
            const urlPath = url.pathname.toLowerCase();
            const pathParts = urlPath.split('.');
            
            // Check if there's an extension in the path
            if (pathParts.length > 1) {
              const urlExt = pathParts[pathParts.length - 1].split('/')[0]; // Get extension, remove any trailing path
              hasValidExtension = VALID_IMAGE_EXTENSIONS.includes(urlExt);
            } else {
              // No extension in path - check if it's a known image service that doesn't require extensions
              // Unsplash, Imgur, and other image CDNs often don't have extensions in URLs
              const hostname = url.hostname.toLowerCase();
               const knownImageHosts = ['images.unsplash.com', 'i.imgur.com', 'cdn.pixabay.com', 'images.pexels.com'];
              
               if (knownImageHosts.some(host => hostname.includes(host))) {
               // Known image hosting service - accept as valid
               hasValidExtension = true;
              } else {
                hasValidExtension = false;
                validationError = 'No image file extension found in URL';
              }
            }
            
          } catch (e) {
            // Invalid URL format
            isValidUrl = false;
            validationError = 'Invalid URL format' + e.message;
          }
          
          if (isValidUrl && hasValidExtension) {
            // Valid URL with proper image extension - accept as callable
            // Per Wix documentation: files.importFile() requires either:
            // 1. MIME type in request, OR
            // 2. Extension in displayName/url (which we have), OR  
            // 3. Server supports HEAD requests (for MIME type retrieval)
            // 
            // We have #2 (extension in URL), so files.importFile() will handle the download.
            // Any download failures will be caught by imageConverter.web.js with detailed
            // error guidance via getErrorGuidance() function.
            imageAnalysis.callableUrls.push({
              rowId: row.rowId,
              productId: row.ID,
              productName: row.name || 'Unknown Product',
              imageUrl: imageUrl,
              rowIndex: index
            });
          } else {
            // Invalid URL or wrong file type
            const reason = validationError || 
                          (!isValidUrl ? 'Invalid URL format' : 
                          !hasValidExtension ? 'Invalid image file extension' : 
                          'Unknown error');
            imageAnalysis.emptyOrInvalid.push({
              rowId: row.rowId,
              productId: row.ID,
              productName: row.name || 'Unknown Product',
              imageUrl: imageUrl,
              reason: reason,
              rowIndex: index
            });
            
            invalidUrlWarnings.push({
              _id: row._id,
              productName: row.name || row.ID,
              reason: reason,
              url: imageUrl
            });
          }
        }
      } else {
        imageAnalysis.emptyOrInvalid.push({
          rowId: row.rowId,
          productId: row.ID,
          productName: row.name || 'Unknown Product',
          reason: 'Missing image URL',
          rowIndex: index
        });
      }
    }
    
    // Log all invalid URL warnings at once
    if (invalidUrlWarnings.length > 0) {
      await postEntryBE("error", `Found ${invalidUrlWarnings.length} invalid image URLs`, {
        invalidUrls: invalidUrlWarnings,
        location: "dataConverter.web.js"
      });
    }

    await postEntryBE("success", "Image URL analysis completed", {
      wixUrls: imageAnalysis.wixUrls.length,
      callableUrls: imageAnalysis.callableUrls.length,
      emptyOrInvalid: imageAnalysis.emptyOrInvalid.length,
      location: "dataConverter.web.js"
    });

    // EARLY RETURN 1: Wix URLs detected - require SmartSync app
    if (imageAnalysis.wixUrls.length > 0) {
      await postEntryBE("warn", "Wix URLs detected - SmartSync app required", {
        wixUrlCount: imageAnalysis.wixUrls.length,
        location: "dataConverter.web.js"
      });
      
      return {
        success: false,
        requiresSmartSyncApp: true,
        wixUrls: imageAnalysis.wixUrls,
        message: "Wix image URLs detected. Please install SmartSync Wix Image Converter app to process these images.",
        appInstallUrl: "https://www.wix.com/app-market/smartsync-wix-image-converter"
      };
    }

    // EARLY RETURN 2: No images at all - warn about missing images
    if (imageAnalysis.emptyOrInvalid.length === processedRows.length) {
      await postEntryBE("warn", "No images found in any products", {
        totalProducts: processedRows.length,
        location: "dataConverter.web.js"
      });
      
      return {
        success: false,
        missingImages: true,
        emptyImageProducts: imageAnalysis.emptyOrInvalid,
        message: "No product images found. All products are missing image URLs.",
        totalProducts: processedRows.length
      };
    }

    // EARLY RETURN 3: Callable URLs detected - save BOTH parsed data AND pending URLs
    if (imageAnalysis.callableUrls.length > 0) {
      await postEntryBE("success", "Callable URLs detected - saving parsed data and pending URLs", {
        callableUrlCount: imageAnalysis.callableUrls.length,
        location: "dataConverter.web.js"
      });

      // Step 1: Split the data into parsed data (without images) and image URLs
      const parsedData = [];
      processedRows.forEach(row => {
        const { mainImg, ...restOfData } = row;
        parsedData.push(restOfData);
      });

      try {
        // Step 2: Clear BOTH collections first
        const existingParsedData = await elevatedQuery('@prostrategix/smartsync-ecommerce/ParsedData')
          .limit(1000)
          .find();
        
        if (existingParsedData.items.length > 0) {
          const idsToRemove = existingParsedData.items.map(item => item._id);
          await elevatedBulkRemove('@prostrategix/smartsync-ecommerce/ParsedData', idsToRemove);
          await postEntryBE("info", `Cleared ${idsToRemove.length} existing parsed records`, {
            location: "dataConverter.web.js"
          });
        }

        const existingPending = await elevatedQuery('@prostrategix/smartsync-ecommerce/PendingImageUrls')
          .limit(1000)
          .find();
        
        if (existingPending.items.length > 0) {
          const idsToRemove = existingPending.items.map(item => item._id);
          await elevatedBulkRemove('@prostrategix/smartsync-ecommerce/PendingImageUrls', idsToRemove);
          await postEntryBE("info", `Cleared ${idsToRemove.length} existing pending image URLs`, {
            location: "dataConverter.web.js"
          });
        }

        // Step 3: Save parsed data to ParsedData collection
        const parsedInsertResult = await elevatedBulkInsert('@prostrategix/smartsync-ecommerce/ParsedData', parsedData);
        await postEntryBE("info", "Parsed data saved successfully", {
          insertedCount: parsedInsertResult.inserted,
          location: "dataConverter.web.js"
        });

        // Step 4: Prepare and save pending URLs to PendingImageUrls collection
        const pendingUrls = imageAnalysis.callableUrls.map(item => ({
          productId: item.productId,
          productName: item.productName,
          imageUrl: item.imageUrl,
          status: 'pending',
          rowId: item.rowId // Include rowId for cross-collection matching
        }));

        const pendingInsertResult = await elevatedBulkInsert('@prostrategix/smartsync-ecommerce/PendingImageUrls', pendingUrls);
        await postEntryBE("info", "Pending image URLs saved successfully", {
          insertedCount: pendingInsertResult.inserted,
          location: "dataConverter.web.js"
        });

        return {
          success: true,
          requiresImageProcessing: true,
          callableUrls: imageAnalysis.callableUrls,
          pendingUrlsSaved: pendingInsertResult.inserted,
          parsedRecordsSaved: parsedInsertResult.inserted,
          message: "Callable image URLs detected and saved. Ready to initiate image processing.",
          nextAction: "processImgUrls"
        };

      } catch (error) {
        await postEntryBE("error", "Failed to save data", {
          error: error.message,
          location: "dataConverter.web.js"
        });
        throw new Error(`Data save failed: ${error.message}`);
      }
    }

    // If we reach here, all images are already Wix URLs (already converted)
    // This means the images don't need processing - save directly to WixImageURLs
    await postEntryBE("info", "All images are already Wix URLs - saving directly to WixImageURLs", {
      location: "dataConverter.web.js"
    });

    // Step 3: Split the array into two parts
    const imageData = [];
    const parsedData = [];

    processedRows.forEach(row => {
      // Part A: Image data (already Wix URLs) - save to WixImageURLs
      imageData.push({
        id: row.ID, // Use 'id' field to match imageConverter.web.js schema
        productId: row.ID,
        productName: row.name || 'Unknown Product',
        image: row.mainImg || null, // Use 'image' field for Wix URL
        originalUrl: row.mainImg || null,
        status: 'completed',
        rowId: row.rowId, // Include rowId for cross-collection matching
        convertedAt: new Date(),
        uploadMethod: 'pre_converted'
      });

      // Part B: All data except mainImg
      const { mainImg, ...restOfData } = row;
      parsedData.push(restOfData);
    });

    await postEntryBE("info", "Data split completed", {
      imageDataCount: imageData.length,
      parsedDataCount: parsedData.length,
      location: "dataConverter.web.js"
    });

    // Step 4: Save A to WixImageURLs collection (NOT PendingImageUrls)
    // Since images are already Wix URLs, they go directly to final collection
    try {
      const existingImageData = await elevatedQuery('@prostrategix/smartsync-ecommerce/WixImageURLs')
        .limit(1000)
        .find();
      
      if (existingImageData.items.length > 0) {
        const idsToRemove = existingImageData.items.map(item => item._id);
        await elevatedBulkRemove('@prostrategix/smartsync-ecommerce/WixImageURLs', idsToRemove);
        await postEntryBE("info", `Cleared ${idsToRemove.length} existing image records from WixImageURLs`, {
          location: "dataConverter.web.js"
        });
      }

      const imageInsertResult = await elevatedBulkInsert('@prostrategix/smartsync-ecommerce/WixImageURLs', imageData);
      await postEntryBE("info", "Image data saved to WixImageURLs (already Wix URLs)", {
        insertedCount: imageInsertResult.inserted,
        location: "dataConverter.web.js"
      });
    } catch (imageError) {
      await postEntryBE("error", "Failed to save image data to WixImageURLs", {
        error: imageError.message,
        location: "dataConverter.web.js"
      });
      throw new Error(`Image data save failed: ${imageError.message}`);
    }

    // Step 5: Save B to ParsedData collection using elevated permissions
    try {
      const existingParsedData = await elevatedQuery('@prostrategix/smartsync-ecommerce/ParsedData')
        .limit(1000)
        .find();
      
      if (existingParsedData.items.length > 0) {
        const idsToRemove = existingParsedData.items.map(item => item._id);
        await elevatedBulkRemove('@prostrategix/smartsync-ecommerce/ParsedData', idsToRemove);
        await postEntryBE("info", `Cleared ${idsToRemove.length} existing parsed records`, {
          location: "dataConverter.web.js"
        });
      }

      const parsedInsertResult = await elevatedBulkInsert('@prostrategix/smartsync-ecommerce/ParsedData', parsedData);
      await postEntryBE("info", "Parsed data saved successfully", {
        insertedCount: parsedInsertResult.inserted,
        location: "dataConverter.web.js"
      });
    } catch (parsedError) {
      await postEntryBE("error", "Failed to save parsed data", {
        error: parsedError.message,
        location: "dataConverter.web.js"
      });
      throw new Error(`Parsed data save failed: ${parsedError.message}`);
    }

    // Step 6: Return success result
    await postEntryBE("info", "Data split and save process completed successfully", {
      totalRowsProcessed: processedRows.length,
      imageRecordsSaved: imageData.length,
      parsedRecordsSaved: parsedData.length,
      location: "dataConverter.web.js"
    });

    return {
      success: true,
      totalRowsProcessed: processedRows.length,
      imageRecordsSaved: imageData.length,
      parsedRecordsSaved: parsedData.length,
      generatedIds: generatedIds
    };

  } catch (err) {
    await postEntryBE("error", "Data split and save process failed", {
      error: err.message,
      location: "dataConverter.web.js"
    });
    return {
      success: false,
      error: err.message
    };
  }
});

// COMMENTED OUT - Validation logic moved to frontend (dataManagement.js reportMissingHeaders)
// This function is redundant as frontend handles validation with UI feedback
// Can be deleted after validation that frontend solution works correctly
/*
export const validateImgUrls = webMethod(Permissions.Anyone, async (normalizedRows, essentialFields = []) => {
  try {
    const validationResults = {
      success: true,
      nonWixImageUrls: [],

    };

    // Step 1: Check for missing essential columns with specific guidance
    if (essentialFields && essentialFields.length > 0) {
      for (const essential of essentialFields) {
        const hasField = normalizedRows.some(row => 
          row.hasOwnProperty(essential) && 
          row[essential] !== null && 
          row[essential] !== undefined && 
          row[essential].toString().trim() !== ''
        );
        
        if (!hasField) {
          const guidance = getFieldGuidance(essential);
          validationResults.missingEssentials.push({
            field: essential,
            description: guidance.description,
            solution: guidance.solution
          });
        }
      }
    }

    // Step 2: Check for non-Wix image URLs
    normalizedRows.forEach((row, index) => {
      if (row.mainImg && row.mainImg.trim() !== '') {
        const imageUrl = row.mainImg.trim();
        
        // Check if it's NOT a Wix media URL
        const isWixMedia = imageUrl.startsWith('wix:image://') || 
                          imageUrl.startsWith('wix:document://') || 
                          imageUrl.includes('static.wixstatic.com') ||
                          imageUrl.includes('wixmp-');
        
        if (!isWixMedia) {
          validationResults.nonWixImageUrls.push({
            productId: row.ID || `Row ${index + 1}`,
            productName: row.name || 'Unknown Product',
            //imageUrl: imageUrl
          });
        }
      }
    });

    // Determine if we can proceed
    // if (validationResults.missingEssentials.length > 0) {
    //   validationResults.canProceed = false;
    //   validationResults.success = false;
    // }

    await postEntryBE("info", "Data validation completed", {
     // missingEssentials: validationResults.missingEssentials.length,
      nonWixImages: validationResults.nonWixImageUrls.length,
      // canProceed: validationResults.canProceed,
      location: "dataConverter.web.js"
    });

    return validationResults;

  } catch (err) {
    await postEntryBE("error", "Data validation failed", {
      error: err.message,
      location: "dataConverter.web.js"
    });
    return {
      success: false,
      error: err.message,
      canProceed: false
    };
  }
});
*/
