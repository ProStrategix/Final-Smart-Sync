# SmartSync Product Transfer - AI Coding Agent Instructions

## Project Overview
SmartSync is a Wix Blocks widget for CSV-to-Wix data migration with intelligent image URL classification and processing. Built on Velo/Wix platform with frontend-backend architecture.

## Core Architecture

### State-Driven Widget Flow
- **State Management**: `public/stateManagement.js` defines UI states array and `goTo(state)` function
- **Main Controller**: `app.js` orchestrates CSV upload → processing → classification → storage → results
- **Key States**: `START` → `PROCESSDATA` → `DATAREPORT` / `ERRORIMAGES` / `ERRORSYSTEM`

### Data Pipeline (Critical Flow)
1. **CSV Upload**: `uploadAccessCsv()` → `getUrl()` backend → fetch CSV content
2. **Processing**: `processCsv()` → `normalizeCsv()` backend → schema mapping
3. **Classification**: `splitNormalizedRowsIntoStructuredData()` → image URL validation
4. **Storage**: `Promise.allSettled([store(data), store(imgs), store(errors)])`
5. **Results**: `showResults(values, types)` → route to appropriate UI state

### Image Classification System
Located in `public/classify.js` with 5-category classification:
- **Category 1**: Callable URLs (trusted domains + HTTP validation)
- **Category 2**: Wix media URLs (`wix:image://`, `static.wixstatic.com`)
- **Category 3**: Local file paths (drive letters, extensions)
- **Category 4**: Empty/null URLs
- **Category 5**: Non-callable URLs (fallback)

## Critical Developer Patterns

### Database Collections (Wix Data)
```javascript
const A = "@prostrategix/smartsync-product-transfer/ParsedData";
const B = "@prostrategix/smartsync-product-transfer/PendingImageUrls";
const C = "@prostrategix/smartsync-product-transfer/ParsedErrors";
```

### Error Handling Convention
- **UI State Routing**: Use `goTo("ERRORIMAGES")`, `goTo("ERRORSYSTEM")`
- **Promise Patterns**: `Promise.allSettled()` for parallel operations, not `Promise.all()`
- **Validation**: Always validate array structures before accessing (e.g., `showResults` input validation)

### Testing Workarounds
- `example.com` added to trusted domains in `classify.js` (marked with TODO for removal)
- Test data in `test_data/test_data.csv` uses placeholder URLs

## Backend Integration (Wix Web Modules)
- **File**: `backend/dataProcessor.web.js`
- **Elevated Permissions**: Uses `elevate()` for database operations
- **Web Methods**: `getUrl()`, `normalizeCsv()` exposed as `webMethod(Permissions.Anyone)`

## Key Files to Understand
- `app.js` - Main widget orchestration and event handlers
- `public/dataManagement.js` - Core business logic (893 lines)
- `public/stateManagement.js` - UI state control and message system
- `public/classify.js` - Image URL classification logic
- `backend/dataProcessor.web.js` - Server-side data processing

## Development Debugging
- **Logging**: Use `postEntry(message, level, location, stackTrace)` for persistent logs
- **UI Messages**: Use `pushMessage(messages, type, text, icon)` for user feedback
- **Console**: Extensive console.log throughout for debugging data flow

## Current Development Status
- Core CSV processing pipeline complete
- Image classification system functional
- State management system operational
- Image conversion system in development (`imageManagement.js`)
- Archive folder contains previous iterations for reference