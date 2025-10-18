import wixData from 'wix-data';
import {goTo, initializeNotices, pushMessage, pushMessageImg, updateStatus, pause} from 'public/stateManagement.js'
import {postEntry, initializeLog } from 'public/logManagement.js'
import {Entry, Log, MediaFile} from "public/classes.js"
import {getUrl, normalizeCsv } from 'backend/dataProcessor.web.js'
import { uploadAccessCsv, processCsv, splitDataImages, splitNormalizedRowsIntoStructuredData } from 'public/dataManagement.js'
//import {processAndSaveImages} from 'backend/imageConverter.web.js'
//import {manageImgResult, handleImgError, clearErrorReport, setupErrorReportUI, getErrorReport, manageFileResult, processCallableUrls, saveUploadedFiles, processManualUrls, processExternalImageUrls, processWixUrls, processRawImgs} from 'public/imageManagement.js'
//import {handleFinalReview} from  'public/transferManagement.js'

let messages = []
let imageMessages = []
let mainLog 
let entries = []
const loc = "widget.js"
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

let csvFile;
let normalized = []
let parsedData = []
let imageResults ={}

$w('#uploadCsvButton').onChange((event) => {
    $w('#uploadCsvButton').uploadFiles()
        .then(async ([file]) => uploadAccessCsv(file, messages))
        .then((text) => processCsv(text, messages))
        .then((result) => {
            result.success? normalized = result.data : normalized = []
            result.success? pushMessage(messages, "success", "CSV processed successfully", "✅") : pushMessage(messages, "error", "CSV processing failed. "+result.message, "❌")
            postEntry("CSV processed. "+result.message, result.success? "success" : "error" , loc, null)
            console.log('Normalized data:', normalized)
            return normalized
        })
        .then(async (normalized) => {
            ({parsedData, imageResults} = await splitNormalizedRowsIntoStructuredData(normalized))
            // displayOptions(imageResults)
            // storeParsedData(parsedData)
            return {parsedData, imageResults}
        })
        
        .catch((uploadError) => {
            console.error('❌ CSV upload failed:', uploadError);
            postEntry(`CSV upload failed: ${uploadError.message}`, 'error', loc, uploadError.stack);
            // $w('#statusText').text = `CSV upload failed: ${uploadError.message}`;
            // $w('#statusIcon').text = "❌";
            // $w("#a1").show()
            goTo("ERROR");
        });
});


$w.onReady(function () {
	// Initialize your widget here. If your widget has properties, this is a good place to read their values and initialize the widget accordingly.
	
});

$widget.onPropsChanged((oldProps, newProps) => {
	// If your widget has properties, onPropsChanged is where you should handle changes to their values.
	// Property values can change at runtime by code written on the site, or when you preview your widget here in the App Builder.
	
});
