/**
 * CSV Processing Flow Test Script
 * Tests the complete flow: Upload → Parse → Normalize → Validate
 */

import { uploadAccessCsv, processCsv, parseCsv, getSchemaMap } from 'public/dataManagement.js';
import { normalizeCsv } from 'backend/dataProcessor.web.js';
import { reportMissingHeaders } from 'public/dataManagement.js';

// Mock file objects for testing
const mockFile1 = {
    fileName: 'test1_valid_csv.csv',
    fileUrl: 'wix:document://test1',
    originalFileName: 'test1_valid_csv.csv'
};

const mockFile2 = {
    fileName: 'test2_missing_category.csv', 
    fileUrl: 'wix:document://test2',
    originalFileName: 'test2_missing_category.csv'
};

const mockFile3 = {
    fileName: 'test3_headers_only.csv',
    fileUrl: 'wix:document://test3', 
    originalFileName: 'test3_headers_only.csv'
};

// Test data
const testCsv1 = `ID,name,mainImg,category,unitPrice,strain,headline
PROD001,Cannabis Strain A,https://example.com/image1.jpg,Cannabis,29.99,Indica,Premium Quality Cannabis
PROD002,Cannabis Strain B,https://example.com/image2.jpg,Cannabis,39.99,Sativa,High-Quality Cannabis Product
PROD003,Cannabis Strain C,https://example.com/image3.jpg,Cannabis,49.99,Hybrid,Premium Hybrid Strain`;

const testCsv2 = `ID,name,mainImg,unitPrice,strain,headline
PROD001,Cannabis Strain A,https://example.com/image1.jpg,29.99,Indica,Premium Quality Cannabis
PROD002,Cannabis Strain B,https://example.com/image2.jpg,39.99,Sativa,High-Quality Cannabis Product
PROD003,Cannabis Strain C,https://example.com/image3.jpg,49.99,Hybrid,Premium Hybrid Strain`;

const testCsv3 = `ID,name,mainImg,category,unitPrice,strain,headline`;

console.log('🧪 Starting CSV Processing Flow Tests...\n');

/**
 * TEST 1: Valid CSV with All Essential Headers
 */
async function testValidCsv() {
    console.log('📋 TEST 1: Valid CSV with All Essential Headers');
    console.log('=' .repeat(50));
    
    try {
        // Step 1: Parse CSV
        console.log('Step 1: Parsing CSV...');
        const parseResult = await parseCsv(testCsv1);
        const parsed = JSON.parse(parseResult);
        console.log('✅ Parse successful:', {
            headers: parsed.headers,
            rowCount: parsed.rows.length
        });
        
        // Step 2: Get Schema Map
        console.log('\nStep 2: Getting schema map...');
        const schemaMap = await getSchemaMap();
        console.log('✅ Schema map loaded:', Object.keys(schemaMap).length, 'fields');
        
        // Step 3: Normalize CSV
        console.log('\nStep 3: Normalizing CSV...');
        const normalizeResult = await normalizeCsv(parsed.headers, parsed.rows, schemaMap);
        console.log('✅ Normalization result:', {
            success: normalizeResult.success,
            normalizedRows: normalizeResult.normalizedRows?.length || 0,
            missingEssentialHeaders: normalizeResult.missingEssentialHeaders?.length || 0
        });
        
        // Step 4: Process CSV (full flow)
        console.log('\nStep 4: Processing CSV (full flow)...');
        const processResult = await processCsv(testCsv1);
        console.log('✅ Process result:', {
            success: processResult.success,
            hasData: !!processResult.data,
            error: processResult.error || 'None'
        });
        
        if (processResult.success) {
            console.log('\n🎉 TEST 1 PASSED: Valid CSV processed successfully');
            console.log('✅ Expected: No missing headers, normalized rows present');
            console.log('✅ Actual: Success = true, Data available');
        } else {
            console.log('\n❌ TEST 1 FAILED: Valid CSV should have succeeded');
            console.log('❌ Error:', processResult.error);
        }
        
    } catch (error) {
        console.log('\n❌ TEST 1 FAILED with exception:', error.message);
    }
    
    console.log('\n' + '=' .repeat(50) + '\n');
}

/**
 * TEST 2: CSV Missing Essential Headers
 */
async function testMissingHeaders() {
    console.log('📋 TEST 2: CSV Missing Essential Headers (missing "category")');
    console.log('=' .repeat(50));
    
    try {
        // Step 1: Parse CSV
        console.log('Step 1: Parsing CSV...');
        const parseResult = await parseCsv(testCsv2);
        const parsed = JSON.parse(parseResult);
        console.log('✅ Parse successful:', {
            headers: parsed.headers,
            rowCount: parsed.rows.length
        });
        
        // Step 2: Get Schema Map
        console.log('\nStep 2: Getting schema map...');
        const schemaMap = await getSchemaMap();
        console.log('✅ Schema map loaded');
        
        // Step 3: Normalize CSV
        console.log('\nStep 3: Normalizing CSV...');
        const normalizeResult = await normalizeCsv(parsed.headers, parsed.rows, schemaMap);
        console.log('✅ Normalization result:', {
            success: normalizeResult.success,
            normalizedRows: normalizeResult.normalizedRows?.length || 0,
            missingEssentialHeaders: normalizeResult.missingEssentialHeaders || []
        });
        
        // Step 4: Process CSV (full flow)
        console.log('\nStep 4: Processing CSV (full flow)...');
        const processResult = await processCsv(testCsv2);
        console.log('✅ Process result:', {
            success: processResult.success,
            error: processResult.error || 'None',
            missingHeaders: processResult.missingHeaders || []
        });
        
        if (!processResult.success && processResult.missingHeaders?.includes('category')) {
            console.log('\n🎉 TEST 2 PASSED: Missing headers detected correctly');
            console.log('✅ Expected: Success = false, Missing headers = ["category"]');
            console.log('✅ Actual: Success = false, Missing headers detected');
        } else {
            console.log('\n❌ TEST 2 FAILED: Should have detected missing "category" header');
            console.log('❌ Result:', processResult);
        }
        
    } catch (error) {
        console.log('\n❌ TEST 2 FAILED with exception:', error.message);
    }
    
    console.log('\n' + '=' .repeat(50) + '\n');
}

/**
 * TEST 3: CSV with No Rows (Headers Only)
 */
async function testEmptyRows() {
    console.log('📋 TEST 3: CSV with No Rows (Headers Only)');
    console.log('=' .repeat(50));
    
    try {
        // Step 1: Parse CSV
        console.log('Step 1: Parsing CSV...');
        const parseResult = await parseCsv(testCsv3);
        const parsed = JSON.parse(parseResult);
        console.log('✅ Parse successful:', {
            headers: parsed.headers,
            rowCount: parsed.rows.length
        });
        
        // Step 2: Get Schema Map
        console.log('\nStep 2: Getting schema map...');
        const schemaMap = await getSchemaMap();
        console.log('✅ Schema map loaded');
        
        // Step 3: Normalize CSV
        console.log('\nStep 3: Normalizing CSV...');
        const normalizeResult = await normalizeCsv(parsed.headers, parsed.rows, schemaMap);
        console.log('✅ Normalization result:', {
            success: normalizeResult.success,
            normalizedRows: normalizeResult.normalizedRows?.length || 0
        });
        
        // Step 4: Process CSV (full flow)
        console.log('\nStep 4: Processing CSV (full flow)...');
        const processResult = await processCsv(testCsv3);
        console.log('✅ Process result:', {
            success: processResult.success,
            error: processResult.error || 'None'
        });
        
        if (!processResult.success && processResult.error?.includes('No normalized rows')) {
            console.log('\n🎉 TEST 3 PASSED: Empty rows detected correctly');
            console.log('✅ Expected: Success = false, Error about no normalized rows');
            console.log('✅ Actual: Success = false, Appropriate error message');
        } else {
            console.log('\n❌ TEST 3 FAILED: Should have detected no rows');
            console.log('❌ Result:', processResult);
        }
        
    } catch (error) {
        console.log('\n❌ TEST 3 FAILED with exception:', error.message);
    }
    
    console.log('\n' + '=' .repeat(50) + '\n');
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 Starting CSV Processing Flow Tests...\n');
    
    await testValidCsv();
    await testMissingHeaders(); 
    await testEmptyRows();
    
    console.log('🏁 All tests completed!');
    console.log('\n📊 Test Summary:');
    console.log('- Test 1: Valid CSV processing');
    console.log('- Test 2: Missing headers detection');
    console.log('- Test 3: Empty rows detection');
    console.log('\nCheck console logs above for detailed results.');
}

// Export for use in Wix environment
export { runAllTests, testValidCsv, testMissingHeaders, testEmptyRows };
