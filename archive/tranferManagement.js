import wixData from 'wix-data';
import { v4 as uuidv4 } from 'uuid';
import { goTo } from 'public/stateManager.js';

const A = "@prostrategix/smartsync-ecommerce/ParsedData";
const B = "@prostrategix/smartsync-ecommerce/WixImageURLs";
const C = "@prostrategix/smartsync-ecommerce/NewProductListings";

let errorLog = [];
let dataC = [];

// Normalize ID function
function normalizeId(id) {
    if (!id || typeof id !== 'string' && typeof id !== 'number') return '';
    const str = id.toString().trim();
    if (str.length === 0) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Create C item from A and B
function createCItem(aItem, bItem) {
    return { mainImg: bItem.image, ...aItem };
}

// Core matching function - Strategies 1 & 2 only
async function findMatches() {
    const itemsA = await wixData.query(A).find().then(r => r.items);
    const itemsB = await wixData.query(B).find().then(r => r.items);
    
    let outcomesA = new Array(itemsA.length);
    let outcomesB = new Array(itemsB.length).fill(null);
    
    for(let i = 0; i < itemsA.length; i++) {
        // Strategy 1: rowId exact match
        let match = itemsB.findIndex(b => b.rowId === itemsA[i].rowId);
        
        if (match !== -1) {
            const cItem = createCItem(itemsA[i], itemsB[match]);
            dataC[i] = cItem;
            outcomesA[i] = { matched: true, strategy: 'rowId-exact', bIndex: match };
            outcomesB[match] = { matched: true, strategy: 'rowId-exact', aIndex: i };
            continue;
        }
        
        // Strategy 2: ID exact match
        const normIdA = normalizeId(itemsA[i].ID || itemsA[i].Id || itemsA[i].id || itemsA[i].productId || itemsA[i]._id);
        if (normIdA !== '') {
            match = itemsB.findIndex(b => {
                const normIdB = normalizeId(b.ID || b.Id || b.id || b.productId || b._id);
                return normIdB !== '' && normIdB === normIdA;
            });
            
            if (match !== -1) {
                const cItem = createCItem(itemsA[i], itemsB[match]);
                dataC[i] = cItem;
                outcomesA[i] = { matched: true, strategy: 'ID-exact', bIndex: match };
                outcomesB[match] = { matched: true, strategy: 'ID-exact', aIndex: i };
                continue;
            }
        }
        
        // No match found
        dataC[i] = null;
        outcomesA[i] = { matched: false, strategy: null, aItem: itemsA[i] };
    }
    
    // Mark unmatched B items
    for(let j = 0; j < itemsB.length; j++) {
        if(!outcomesB[j]) {
            outcomesB[j] = { matched: false, strategy: null, bItem: itemsB[j] };
        }
    }
    
    return { dataC, outcomesA, outcomesB };
}

// Check for errors in outcomes
function checkForErrors(outcomesA, outcomesB) {
    const hasErrors = outcomesA.some(o => o.matched === false) || outcomesB.some(o => o.matched === false);
    
    if (!hasErrors) {
        return { hasErrors: false, errorLog: [] };
    }
    
    const errors = [];
    
    // Build error log from unmatched items
    outcomesA.forEach((outcome, index) => {
        if (outcome.matched === false) {
            errors.push({
                productName: outcome.aItem.Name || outcome.aItem.name || 'Unknown',
                Message: 'No matching image found',
                Action: 'Add image URL to your data'
            });
        }
    });
    
    outcomesB.forEach((outcome, index) => {
        if (outcome.matched === false) {
            errors.push({
                productName: 'Unmatched Image',
                Message: outcome.bItem.image || 'No image URL',
                Action: 'Image has no matching product'
            });
        }
    });
    
    return { hasErrors: true, errorLog: errors };
}

let saveResults = {}

// Main handler function
export async function handleFinalReview() {
   const { dataC, outcomesA, outcomesB } = await findMatches();
   const errors = checkForErrors(outcomesA, outcomesB);
   
   // Calculate match statistics
   const validItems = dataC.filter(item => item !== null);
   const totalProductsInA = outcomesA.length;
   const totalImagesInB = outcomesB.length;
   const successfulMatches = validItems.length;
   const unmatchedProducts = outcomesA.filter(o => o.matched === false).length;
   const unmatchedImages = outcomesB.filter(o => o.matched === false).length;
   const matchRate = totalProductsInA > 0 ? ((successfulMatches / totalProductsInA) * 100).toFixed(1) + '%' : '0%';
   
   // Count matches by strategy
   const rowIdMatches = outcomesA.filter(o => o.strategy === 'rowId-exact').length;
   const idExactMatches = outcomesA.filter(o => o.strategy === 'ID-exact').length;
   
   // Build comprehensive summary
   const summary = {
       status: errors.errorLog.length > 0 ? "error" : "completed",
       data: validItems,
       totalProductsInA,
       totalImagesInB,
       successfulMatches,
       unmatchedProducts,
       unmatchedImages,
       totalErrors: errors.errorLog.length,
       errorLog: errors.errorLog,
       matchRate,
       matchesByStrategy: {
           rowIdExact: rowIdMatches,
           idExact: idExactMatches
       }
   };
   
   // Console logging for diagnostics
   console.log(`\n📊 MERGE SUMMARY:`);
   console.log(`   Products (A): ${summary.totalProductsInA}`);
   console.log(`   Images (B): ${summary.totalImagesInB}`);
   console.log(`   ✅ Matched: ${summary.successfulMatches} (${summary.matchRate})`);
   console.log(`   ❌ Unmatched Products: ${summary.unmatchedProducts}`);
   console.log(`   ❌ Unmatched Images: ${summary.unmatchedImages}`);
   console.log(`   ⚠️  Total Errors: ${summary.totalErrors}`);
   console.log(`\n🎯 MATCH BREAKDOWN BY STRATEGY:`);
   console.log(`   Strategy 1 (rowId-exact): ${summary.matchesByStrategy.rowIdExact}`);
   console.log(`   Strategy 2 (ID-exact): ${summary.matchesByStrategy.idExact}\n`);
   
   if (errors.errorLog.length > 0) {
        errorLog = errors.errorLog;
        $w("#fileErrorText").text = `Errors found: ${errorLog.length}. Please use the button below to review and fix them before proceeding.`;
        $w("#fileErrorText").show();
        $w("#fileErrorButton").show();
        return summary;
   } else {
        // Save merged items to collection C 
        fillUi(dataC)
        saveResults = await wixData.bulkSave(C, dataC);
        summary.data = dataC;
        return summary;
   }
}

// Exported event handler functions for page code to wire up
export function fileErrorButton_onClick() {
    $w('#finalErrorRepeater').data = errorLog;
    $w('#finalErrorRepeater').onItemReady(($item, itemData) => {
        $item('#productNameText').text = itemData.productName;
        $item('#message').text = itemData.Message;
        $item('#action').text = itemData.Action;
    });
    $w("#returnToStartButton").show();  
    $w("#returnToStartButton").expand();
    goTo("FINALERRORREVIEW");
}

export function returnToStartButton_onClick() {
    goTo("INIT");
}

function fillUi(data) {
  let review = $w("#finalReviewRepeater")
  review.data = data
  review.onItemReady(($item, itemData, index) => {
    $item('#item').text = itemData.name
    $item("itemPrice").text = itemData.formattedPrice
    $item("#strain").text = itemData.strain
    $item('#category').test = itemData.category
    $item("#headline").text = itemData.headline
  })
}

export async function transmit_onClick() {
    console.log("🚀 Starting transmission process...");
    
    // Update UI
    $w("#transmit").disable();
    $w("#transmit").label = "Transmitting...";
    goTo("TRANSMITTING");
    
    try {
        // Use the dataC already stored in memory from handleFinalReview
        console.log(`📦 Transmitting ${dataC.length} merged items`);
        
        // Prepare JSON payload
        const jsonPayload = JSON.stringify(dataC);
        console.log(`📊 Payload size: ${jsonPayload.length} characters`);
        
        // Fire the transmit event to parent page
        $widget.fireEvent('transmit', { 
            data: jsonPayload,
            timestamp: new Date().toISOString(),
            itemCount: dataC.length,
            source: 'transferManagement-new'
        });
        
        console.log("✅ Transmit event fired successfully");
        $w('#message2').text = `Transmission initiated. Awaiting host page reply...`;
        $w('#icon2').text = "✅";
        $w("#a2").show()
        
    } catch (error) {
        console.error(`❌ Error during transmission:`, error);
        $w("#transmit").enable();
        $w("#transmit").label = "Transmit";
        goTo("ERROR");
    }
}