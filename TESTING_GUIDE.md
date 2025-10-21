# Testing Guide for Image Upload & Merge Feature

## Quick Testing Checklist

### Prerequisites
- Wix development environment set up
- Access to Wix database collections
- Test CSV file with product data and image URLs

### Test Cases

#### 1. Happy Path - Successful Upload and Merge
**Steps:**
1. Upload a CSV with valid product data and image URLs
2. Click "Continue to Image Conversion"
3. Wait for processing to complete

**Expected Results:**
- ✅ All images successfully uploaded
- ✅ `newProductListings` created with merged data
- ✅ Each product has `mainImg`, `fileName`, and `imageUploadedAt` fields
- ✅ Data saved to `ParsedData` collection
- ✅ Session storage contains `newProductListings` and `uploadSummary`

**Validation:**
```javascript
// Check console output
console.log("Result:", result);
// Should see:
// - success: true
// - newProductListings: [array of products with images]
// - rowIds: [array of rowIds]
// - wixURLs: [array of Wix media URLs]

// Check session storage
const saved = JSON.parse(session.getItem('newProductListings'));
console.log("Saved products:", saved.length);

// Check database
const dbProducts = await wixData.query(PRODUCT_LISTINGS_DB).find();
console.log("DB products:", dbProducts.items.length);
```

---

#### 2. Partial Success - Some Uploads Fail
**Steps:**
1. Upload CSV with mix of valid and invalid image URLs
2. Click "Continue to Image Conversion"

**Expected Results:**
- ✅ Valid images uploaded successfully
- ⚠️ Invalid images recorded in failures array
- ✅ Products with successful uploads have `mainImg` field
- ✅ Products with failed uploads remain without `mainImg` field
- ✅ Upload summary shows: `successfulUploads` and `failedUploads` counts

**Validation:**
```javascript
console.log("Upload Summary:", result.uploadSummary);
// Should see:
// - successfulUploads: X
// - failedUploads: Y
// - totalProducts: X + Y (or total in CSV)

console.log("Failed uploads:", result.failedUploads);
// Array of failed upload objects with error messages
```

---

#### 3. Error Handling - All Uploads Fail
**Steps:**
1. Upload CSV with all invalid/inaccessible image URLs
2. Click "Continue to Image Conversion"

**Expected Results:**
- ❌ All images fail to upload
- ✅ Error message displayed to user
- ✅ Products created but without image URLs
- ⚠️ Upload summary shows 0 successful uploads

**Validation:**
```javascript
if (result.success && result.uploadSummary.successfulUploads === 0) {
  console.log("No images uploaded - expected behavior");
  console.log("Products saved without images:", result.newProductListings.length);
}
```

---

#### 4. Edge Case - Empty Image Array
**Steps:**
1. Upload CSV with products but no image URLs (all Category 4 or 5)
2. Click "Continue to Image Conversion"

**Expected Results:**
- ✅ Function returns early with `conversionSummary`
- ✅ No upload attempt made
- ✅ Message: "0 files to process"

**Validation:**
```javascript
if (result.totalProcessed === 0) {
  console.log("No images to process - expected behavior");
}
```

---

#### 5. Data Integrity - Verify Merge Accuracy
**Steps:**
1. Upload CSV with known product data
2. After processing, verify data integrity

**Expected Results:**
- ✅ Each product retains all original fields
- ✅ Image data added only to products with matching `rowId`
- ✅ Products without images remain unchanged (except database fields)

**Validation:**
```javascript
// Before merge (values[0])
const originalProduct = values[0][0];
console.log("Original:", originalProduct);

// After merge (newProductListings)
const mergedProduct = result.newProductListings[0];
console.log("Merged:", mergedProduct);

// Verify all original fields present
Object.keys(originalProduct).forEach(key => {
  if (mergedProduct[key] !== originalProduct[key]) {
    console.error(`Field ${key} mismatch!`);
  }
});

// Verify new fields added
if (mergedProduct.mainImg) {
  console.log("✅ mainImg added:", mergedProduct.mainImg);
  console.log("✅ fileName added:", mergedProduct.fileName);
  console.log("✅ imageUploadedAt added:", mergedProduct.imageUploadedAt);
}
```

---

## Testing from Browser Console

### 1. Check Session Storage
```javascript
// View saved product listings
const listings = JSON.parse(session.getItem('newProductListings'));
console.table(listings);

// View upload summary
const summary = JSON.parse(session.getItem('uploadSummary'));
console.log(summary);
```

### 2. Query Database
```javascript
// Check ParsedData collection
const products = await wixData.query("@prostrategix/smartsync-product-transfer/ParsedData")
  .limit(1000)
  .find();
  
console.log("Total products:", products.items.length);
console.log("First product:", products.items[0]);

// Verify images are Wix URLs
const withImages = products.items.filter(p => p.mainImg?.startsWith('wix:'));
console.log("Products with Wix images:", withImages.length);
```

### 3. Test Individual Functions
```javascript
// Test image fetch
const testUrl = "https://example.com/image.jpg";
const response = await fetch(testUrl);
const blob = await response.blob();
console.log("Blob type:", blob.type, "Size:", blob.size);

// Test uploadBlobs (if accessible from frontend)
const testFile = {
  productName: "Test Product",
  rowId: "test-123",
  blob: blob,
  contentType: "image/jpeg",
  imageUrl: testUrl
};

// Note: uploadBlobs is a backend function, call via:
const result = await uploadBlobs([testFile]);
console.log("Upload result:", result);
```

---

## Common Issues & Solutions

### Issue 1: "Upload failed: Network error"
**Cause:** Image URL not accessible or CORS issue
**Solution:** Verify URL is publicly accessible and supports CORS

### Issue 2: "Product data is not in expected format"
**Cause:** `values[0]` is not an array
**Solution:** Check that CSV processing completed successfully before calling `initiateConversion`

### Issue 3: "Failed to save product listings"
**Cause:** Database permission or connection issue
**Solution:** Verify user has write permissions to `ParsedData` collection

### Issue 4: Images not appearing in merged data
**Cause:** rowId mismatch between products and uploaded images
**Solution:** Verify rowId is consistently generated and preserved throughout the pipeline

---

## Performance Testing

### Measure Upload Time
```javascript
const startTime = Date.now();
const result = await initiateConversion(values);
const duration = Date.now() - startTime;

console.log(`Upload completed in ${duration}ms`);
console.log(`Average time per image: ${duration / result.uploadSummary.totalProducts}ms`);
```

### Monitor Memory Usage
```javascript
// Before processing
const memBefore = performance.memory?.usedJSHeapSize || 0;

// Process images
const result = await initiateConversion(values);

// After processing
const memAfter = performance.memory?.usedJSHeapSize || 0;
const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

console.log(`Memory used: ${memUsed.toFixed(2)} MB`);
```

---

## Success Criteria

✅ All test cases pass
✅ No console errors
✅ Data integrity maintained
✅ Images uploaded to Wix Media Manager
✅ `rowIds` and `wixURLs` arrays correctly populated
✅ `newProductListings` saved to database
✅ Session storage contains expected data
✅ Performance acceptable (< 5s per image)
✅ Memory usage reasonable (< 100MB for 100 images)

---

## Debugging Tips

1. **Enable verbose logging:**
   - Check browser console for detailed logs
   - Review Wix backend logs in developer console
   - Check `postEntry` logs in log collection

2. **Inspect data at each step:**
   - After CSV upload: Check `values` array
   - After blob conversion: Check `imgFiles` array
   - After upload: Check `uploadResult` object
   - After merge: Check `newProductListings` array

3. **Use breakpoints:**
   - Set breakpoint at start of `initiateConversion`
   - Step through upload, merge, and save operations
   - Inspect variables at each step

4. **Test with minimal data:**
   - Start with 1-2 products
   - Verify each step works correctly
   - Scale up to larger datasets

---

## Next Steps After Testing

1. ✅ Verify all test cases pass
2. ✅ Document any edge cases discovered
3. ✅ Update user documentation if needed
4. ✅ Consider adding automated tests
5. ✅ Monitor production usage for issues
