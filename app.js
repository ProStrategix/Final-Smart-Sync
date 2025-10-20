import wixData from 'wix-data';
import {goTo, initializeNotices, pushMessage, pushMessageImg, updateStatus, pause} from 'public/stateManagement.js'
import {postEntry, initializeLog } from 'public/logManagement.js'
import {Entry, Log, MediaFile} from "public/classes.js"
import {getUrl, normalizeCsv } from 'backend/dataProcessor.web.js'
import { uploadAccessCsv, processCsv, splitNormalizedRowsIntoStructuredData, store, showResults } from 'public/dataManagement.js'
//import {processAndSaveImages} from 'backend/imageConverter.web.js'
//import {manageImgResult, handleImgError, clearErrorReport, setupErrorReportUI, getErrorReport, manageFileResult, processCallableUrls, saveUploadedFiles, processManualUrls, processExternalImageUrls, processWixUrls, processRawImgs} from 'public/imageManagement.js'
//import {handleFinalReview} from  'public/transferManagement.js'
import {initiateConversion} from 'public/imageManagement.js'

let messages = []
let imageMessages = []
let mainLog 
let entries = []
const loc = "app.js"
// let finalProducts = []
// let stat = 1

$w.onReady(async function () {
	if($widget.props.state === "" || $widget.props.state === null || $widget.props.state === undefined) {$widget.props.state = "INIT"}
	goTo("START")
	console.log("Starting initializeNotices...");
	await initializeNotices(messages)
	console.log("initializeNotices completed");
	console.log("Starting initializeLog...");
	mainLog = await initializeLog(entries)
	console.log("initializeLog completed");
})

$widget.onPropsChanged(async(oldProps, newProps) => {
	if(newProps.state !== oldProps.state) {
		console.log('new props detected ')
		postEntry(`props changed from: ${oldProps} to ${newProps}`, 'info', 'widget', null)
		console.log(newProps.state, oldProps.state)
		$w("#msbox").changeState(newProps.state)	
	}
	// if(newProps.page === 'received') {
    //     $w('#message3').text = `Transmission received. Prepping for storage...`;
    //     $w('#icon3').text = "✅";
	// 	$w("#a3").show()
    // }
    // if(newProps.page === 'storing') {
    //     $w('#message4').text = `Storing data in Wix collection...`;
    //     $w('#icon4').text = "✅";
	// 	$w("#a4").show()
    // }
    // if (newProps.page === 'complete') {
    //     $w('#message5').text = `Process complete!`;
    //     $w('#icon5').text = "✅";
	// 	$w("#a5").show()
    //     $w('#finalMessage').text = `Cleanup process initiated.`;
    //     $w('#finalIcon').text = "🧹";
	// 	$w("#a6").show()
    //     console.log("✅ Transmission acknowledged by host page");
    //     console.log("🧹 Cleanup process initiated");
    //     await pause(1500);
    //     goTo("DONE");
    // }
});

const dataDB = "@prostrategix/smartsync-product-transfer/ParsedData"
const imagesDB = "@prostrategix/smartsync-product-transfer/PendingImageUrls"
const errorsDB = "@prostrategix/smartsync-product-transfer/ParsedErrors"
let normalData = {}
let continueToImgConversion = false

$w('#uploadCsvButton').onChange((event) => {
    $w('#uploadCsvButton').uploadFiles()
        .then(async ([file]) => uploadAccessCsv(file, messages))
        .then((text) => processCsv(text, messages))
        .then((result) => {
            result.success? normalData = result.data : normalData = []
            result.success? pushMessage(messages, "success", "CSV processed successfully", "✅") : pushMessage(messages, "error", "CSV processing failed. "+result.message, "❌")
            postEntry("CSV processed. "+result.message, result.success? "success" : "error" , loc, null)
            console.log('Normalized data:', normalData)
            return normalData
        })
        .then(async (normalData) => {
            if (!normalData || !normalData.normalizedRows) {
                throw new Error('Invalid normalized data received');
            }
            const {data, imgs, imgTypes, errors, isAllOneCategory} = await splitNormalizedRowsIntoStructuredData(normalData.normalizedRows, messages)
            let types = {
                isMixed: !isAllOneCategory,
                values: imgTypes
            }
           return Promise.allSettled([store(data,dataDB), store(imgs,imagesDB), store(errors,errorsDB)])
           .then((results) => {
                if(results.every(res => res.status === 'fulfilled')) {
                    console.log("All data stored successfully.");
                    // Pass the original arrays, not the database operation results
                    let values = [data, imgs, errors];
                    showResults(values, types)
                } else {
                    let html =  `<h6>Data Storage Errors:</h6><ul>`;
                    results.forEach(res => {
                        if(res.status === 'rejected') {
                            html += `<li>${res.reason}</li>`;
                            console.error('Data storage error:', res.reason);
                        }
                    });
                    html += `</ul>`;
                    $w('#errorText').html = html;
                    console.error('Some data storage operations failed.');
                    postEntry('Some data storage operations failed.', 'error', loc, null);
                    pushMessage(messages, "error", "Some data storage operations failed. Check status for details.", "❌")
                    goTo("ERROR");
                }
           })
           .catch((storageError) => {
                let html =  `<h6>Data Storage Failed:</h6><p>${"❌ " + storageError.message}</p>`;
                $w('#errorText').html = html;
                console.error('❌ Data storage failed:', storageError);
               postEntry(`Data storage failed: ${storageError.message}`, 'error', loc, storageError.stack);
               pushMessage(messages, "error", "Data storage failed during CSV processing. "+storageError.message, "❌")
               goTo("ERROR");
           });
        })    
        .catch((uploadError) => {
            let html = `<h6>CSV Upload Failed:</h6><p>${"❌ " + uploadError.message}</p>`;
            $w('#errorText').html = html;
            postEntry(`CSV upload failed: ${uploadError.message}`, 'error', loc, uploadError.stack);
            pushMessage(messages, "error", "CSV upload failed. "+uploadError.message, "❌")
            console.error('❌ CSV upload failed:', uploadError);
            goTo("ERROR");
        });
});

$w("#continueToImgConversion").onClick(() => {
    continueToImgConversion = !continueToImgConversion;
    if(continueToImgConversion) {
        $w("#continueToImgConversion").label = "✅ Initiate Image Conversion...";
        initiateConversion();

    }

});
