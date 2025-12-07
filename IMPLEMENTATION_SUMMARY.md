# Image Upload and Data Merge Implementation Summary

## Overview
This implementation completes the image upload workflow by integrating the `uploadBlobs` backend function with the frontend `initiateConversion` function, enabling seamless merging of uploaded image URLs with product data.

## Changes Made

### 1. `public/imageManagement.js`

#### Added Imports
```javascript
import { uploadBlobs } from 'backend/imageProcessor.web.js';
import wixData from 'wix-data';
```

#### Added Constant
```javascript
const PRODUCT_LISTINGS_DB = "@prostrategix/smartsync-product-transfer/ParsedData";
```

#### Completed `initiateConversion` Function
The function now performs the following workflow:

1. **Fetches image blobs** from external URLs (existing functionality)
2. **Uploads blobs to Wix Media Manager** via `uploadBlobs` backend function
3. **Extracts rowIds and wixURLs** from upload results
4. **Merges data** by matching rowId between products and uploaded images
5. **Creates newProductListings** array with merged data
6. **Saves to database** (clears existing data first, then bulk inserts)
7. **Stores session data** for later retrieval

#### Return Value Structure
```javascript
{
  success: true,
  newProductListings: [
    {
      _id: "rowId",
      rowId: "...",
      headline: "...",
      name: "...",
      strain: "...",
      category: "...",
      formattedPrice: "...",
      unitPrice: "...",
      mainImg: "wix:image://v1/...",  // ← Wix media URL
      fileName: "product_name.jpg",
      imageUploadedAt: "2025-10-20T..."
    },
    // ... more products
  ],
  rowIds: ["rowId1", "rowId2", ...],      // Array of all rowIds
  wixURLs: ["wix:image://...", ...],      // Array of all Wix media URLs
  uploadSummary: {
    totalProducts: 10,
    successfulUploads: 8,
    failedUploads: 2,
    savedProducts: 10
  },
  uploadResults: [...],  // Detailed upload results
  failedUploads: [...]   // Failed upload details
}
```

## Key Features

### 1. Efficient Data Merging
Uses a `Map` for O(1) lookup when matching products to uploaded images:
```javascript
const uploadedImagesMap = new Map();
uploadResult.results.forEach(result => {
    uploadedImagesMap.set(result.rowId, result);
});
```

### 2. Comprehensive Error Handling
- Validates upload success before proceeding
- Handles database save failures gracefully
- Returns partial data even on save failure
- Logs all errors with stack traces

### 3. Progress Messaging
Uses the existing `pushMessageImg` system to provide real-time feedback:
- "Uploading X images to Wix Media Manager..." (🔄)
- "Successfully uploaded X images" (✅)
- "Merging image data with X products..." (🔄)
- "Successfully saved X product listings with images" (✅)

### 4. Session Storage
Stores critical data in session for later retrieval:
```javascript
session.setItem('newProductListings', JSON.stringify(newProductListings));
session.setItem('uploadSummary', JSON.stringify({...}));
```

## How to Use

### From the UI
When the user clicks "Continue to Image Conversion":
1. System fetches image URLs as blobs
2. Uploads blobs to Wix Media Manager
3. Merges uploaded URLs with product data
4. Saves merged data to database
5. Returns success confirmation

### Programmatically
```javascript
// Call from app.js or other frontend code
const result = await initiateConversion(values);

if (result.success) {
    console.log("Products saved:", result.newProductListings.length);
    console.log("Row IDs:", result.rowIds);
    console.log("Wix URLs:", result.wixURLs);
    console.log("Upload summary:", result.uploadSummary);
} else {
    console.error("Upload failed:", result.error);
}
```

## Data Flow

```
CSV Upload
    ↓
Parse & Normalize
    ↓
Split into [data, imgs, errors]
    ↓
User clicks "Continue to Image Conversion"
    ↓
initiateConversion(values)
    ↓
Fetch image URLs → Blobs
    ↓
uploadBlobs(blobs) → Wix Media Manager
    ↓
Extract rowIds & wixURLs
    ↓
Merge with product data by rowId
    ↓
Save newProductListings to database
    ↓
Return success with rowIds & wixURLs
```

## Database Operations

### Clear Existing Data
```javascript
const existingResults = await wixData.query(PRODUCT_LISTINGS_DB).find();
const existingIds = existingResults.items.map(item => item._id);
if (existingIds.length > 0) {
    await wixData.bulkRemove(PRODUCT_LISTINGS_DB, existingIds);
}
```

### Save New Data
```javascript
const savedProducts = await wixData.bulkInsert(PRODUCT_LISTINGS_DB, newProductListings);
```

## Error Scenarios Handled

1. **Upload fails**: Returns error immediately, doesn't proceed to merge
2. **Invalid product data**: Validates array structure before merging
3. **Database save fails**: Still returns merged data in response
4. **Partial upload success**: Tracks both successful and failed uploads
5. **No images to process**: Returns early with conversion summary

## Testing Recommendations

1. **Test with valid image URLs**: Verify successful upload and merge
2. **Test with invalid URLs**: Verify error handling
3. **Test with mixed success/failure**: Verify partial processing
4. **Test database operations**: Verify clear and insert work correctly
5. **Test session storage**: Verify data persists across operations

## Security Considerations
- CodeQL security scan completed: **0 vulnerabilities found**
- Input validation on product data array
- Error messages sanitized (no sensitive data exposed)
- Stack traces logged securely via `postEntry`

## Next Steps
This completes the image upload and data merge functionality. The user can now:
1. Upload CSV with product data
2. Process and classify image URLs
3. Convert URLs to blobs
4. Upload to Wix Media Manager
5. Get merged product listings with Wix image URLs
6. Access data via `result.newProductListings`, `result.rowIds`, and `result.wixURLs`

The workflow section is now complete as requested.
