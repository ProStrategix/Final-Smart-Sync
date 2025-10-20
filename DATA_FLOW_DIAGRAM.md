# Data Flow Diagram

## Complete Image Upload and Merge Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CSV Upload & Processing                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Parse & Normalize   │
                    │      CSV Data         │
                    └───────────┬───────────┘
                                │
                                ▼
            ┌───────────────────────────────────────┐
            │  splitNormalizedRowsIntoStructuredData │
            │                                        │
            │  Classifies images into categories     │
            └─────────┬──────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │     values = [data, imgs, errors] │
        │                                    │
        │  data:   Product information       │
        │  imgs:   Callable image URLs       │
        │  errors: Non-callable URLs         │
        └───────────┬────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   User clicks "Continue to        │
        │   Image Conversion"               │
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   initiateConversion(values)      │
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 1: Fetch Image URLs        │
        │   Convert to Blobs                │
        │                                   │
        │   For each image URL:             │
        │   - fetch(url) → response         │
        │   - response.blob() → imgBlob     │
        │   - Store in imgFiles array       │
        └───────────┬───────────────────────┘
                    │
                    │   imgFiles = [
                    │     {rowId, productName, blob, 
                    │      contentType, imageUrl, ...},
                    │     ...
                    │   ]
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 2: Upload to Wix Media     │
        │   uploadBlobs(imgFiles)           │
        │   [Backend Function]              │
        └───────────┬───────────────────────┘
                    │
                    │   uploadResult = {
                    │     success: true,
                    │     results: [
                    │       {fileName, wixId, rowId, 
                    │        productName, ...},
                    │       ...
                    │     ],
                    │     failures: [...]
                    │   }
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 3: Extract Arrays          │
        │                                   │
        │   rowIds = [rowId1, rowId2, ...]  │
        │   wixURLs = [wixUrl1, wixUrl2,...]│
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 4: Create Lookup Map       │
        │                                   │
        │   uploadedImagesMap = Map {       │
        │     rowId1 → {wixId, fileName...} │
        │     rowId2 → {wixId, fileName...} │
        │     ...                           │
        │   }                               │
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 5: Merge Data              │
        │                                   │
        │   newProductListings = products   │
        │     .map(product => {             │
        │       uploadedImg = map.get(      │
        │         product.rowId)            │
        │       return {                    │
        │         ...product,               │
        │         mainImg: uploadedImg.wixId│
        │       }                           │
        │     })                            │
        └───────────┬───────────────────────┘
                    │
                    │   newProductListings = [
                    │     {
                    │       _id: "rowId1",
                    │       name: "Product 1",
                    │       price: "$10",
                    │       mainImg: "wix:image://v1/...",
                    │       fileName: "product1.jpg",
                    │       ...
                    │     },
                    │     ...
                    │   ]
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 6: Save to Database        │
        │                                   │
        │   1. Clear existing data          │
        │   2. Bulk insert newProductListings│
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 7: Store in Session        │
        │                                   │
        │   session.setItem(                │
        │     'newProductListings',         │
        │     JSON.stringify(data)          │
        │   )                               │
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────┐
        │   Step 8: Return Result           │
        │                                   │
        │   return {                        │
        │     success: true,                │
        │     newProductListings,           │
        │     rowIds,                       │
        │     wixURLs,                      │
        │     uploadSummary: {...}          │
        │   }                               │
        └───────────────────────────────────┘

```

## Key Data Structures

### Input: values array
```javascript
values = [
  // values[0] - Product data
  [
    {
      _id: "rowId1",
      rowId: "rowId1",
      name: "Product 1",
      price: "$10",
      category: "Electronics",
      // ... other product fields (NO mainImg yet)
    },
    ...
  ],
  
  // values[1] - Image URLs to process
  [
    {
      rowId: "rowId1",
      productName: "Product 1",
      imageUrl: "https://example.com/image1.jpg",
      imageCategory: 1,
      status: "Callable URL"
    },
    ...
  ],
  
  // values[2] - Error images
  [
    {
      rowId: "rowId2",
      productName: "Product 2",
      imageUrl: "",
      imageCategory: 4,
      status: "Empty URL"
    },
    ...
  ]
]
```

### Output: Merged product listings
```javascript
{
  success: true,
  newProductListings: [
    {
      _id: "rowId1",
      rowId: "rowId1",
      name: "Product 1",
      price: "$10",
      category: "Electronics",
      mainImg: "wix:image://v1/abc123/product1.jpg",  // ← NEW!
      fileName: "product1.jpg",                        // ← NEW!
      imageUploadedAt: "2025-10-20T18:43:26.463Z"    // ← NEW!
      // ... other product fields
    },
    ...
  ],
  rowIds: ["rowId1", "rowId2", ...],
  wixURLs: ["wix:image://v1/abc123/...", ...],
  uploadSummary: {
    totalProducts: 10,
    successfulUploads: 8,
    failedUploads: 2,
    savedProducts: 10
  }
}
```

## Matching Process

The merge uses rowId as the key to match products with uploaded images:

```
Product Data              Upload Results           Merged Result
┌─────────────┐          ┌──────────────┐         ┌─────────────────┐
│ rowId: "A"  │          │ rowId: "A"   │         │ rowId: "A"      │
│ name: "P1"  │  +  ───→ │ wixId: "url1"│  ═══►   │ name: "P1"      │
│ price: "$10"│          │ fileName: "f1"│         │ price: "$10"    │
└─────────────┘          └──────────────┘         │ mainImg: "url1" │
                                                  │ fileName: "f1"  │
                                                  └─────────────────┘
```

This ensures each product gets the correct image based on their shared rowId.
