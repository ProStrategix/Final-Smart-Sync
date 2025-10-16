import wixData from 'wix-data';
import {move, goTo, initializeNotices, pushMessage, pushMessageImg, updateStatus, pause} from 'public/stateManager.js'
import {postEntry, initializeLog } from 'public/logManagement.js'
import {Entry, Log, MediaFile} from "public/classes.js"
import {getUrl, normalizeCsv } from 'backend/dataConverter.web.js'
import {getSchemaMap, parseCsv,  splitAndSaveData, reportMissingHeaders, uploadAccessCsv } from 'public/dataManagement.js'
import {processAndSaveImages} from 'backend/imageConverter.web.js'
import {manageImgResult, handleImgError, clearErrorReport, setupErrorReportUI, getErrorReport, manageFileResult, processCallableUrls, saveUploadedFiles, processManualUrls, processExternalImageUrls, processWixUrls, processRawImgs} from 'public/imageManagement.js'
import {handleFinalReview} from  'public/transferManagement.js'

let messages = []
let imageMessages = []
let mainLog 
let entries = []
const loc = "widget.js"
let finalProducts = []

$w.onReady(async function () {
	if($widget.props.state === "" || $widget.props.state === null || $widget.props.state === undefined) {$widget.props.state = "INIT"}
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
	if(newProps.page === 'received') {
        $w('#message3').text = `Transmission received. Prepping for storage...`;
        $w('#icon3').text = "✅";
		$w("#a3").show()
    }
    if(newProps.page === 'storing') {
        $w('#message4').text = `Storing data in Wix collection...`;
        $w('#icon4').text = "✅";
		$w("#a4").show()
    }
    if (newProps.page === 'complete') {
        $w('#message5').text = `Process complete!`;
        $w('#icon5').text = "✅";
		$w("#a5").show()
        $w('#finalMessage').text = `Cleanup process initiated.`;
        $w('#finalIcon').text = "🧹";
		$w("#a6").show()
        console.log("✅ Transmission acknowledged by host page");
        console.log("🧹 Cleanup process initiated");
        await pause(1500);
        goTo("DONE");
    }
});

let csvFile;
let normalized = []
let parseData = []

$w('#uploadCsvButton').onChange((event) => {
    $w('#uploadCsvButton').uploadFiles()
        .then(async ([file]) => uploadAccessCsv(file))
        .then((text) => processCsv(text))
        .then((result) => {
            result.success? normalized = result.data : normalized = []
            result.success? pushMessage(messages, "success", "CSV processed successfully", "✅") : pushMessage(messages, "error", "CSV processing failed. "+result.message, "❌")
            postEntry("CSV processed. "+result.message, result.success? "success" : "error" , loc, null)
            console.log('Normalized data:', normalized);
            updateStatus(2);
            return parseDataImages(normalized)
        })
        .catch((uploadError) => {
            console.error('❌ CSV upload failed:', uploadError);
            postEntry(`CSV upload failed: ${uploadError.message}`, 'error', loc, uploadError.stack);
            $w('#message').text = `CSV upload failed: ${uploadError.message}`;
            $w('#icon').text = "❌";
            $w("#a1").show()
            goTo("ERROR");
        });
});

async function parseDataImages(result) {
    console.log('CSV processing result:', result);
    const splitResult = await splitAndSaveData(normalize.normalizedRows);
    console.log("🔄 Image processing required for some URLs");
    if (splitResult.success) {
        parseData = splitResult.data;
        if (parseData.requiresImageProcessing) {
            pushMessage(messages, "info", "Initiating image processing", "🔄");
           
            goTo("PROCESSING");
            const imageResult = await processExternalImageUrls();
           
        } 
    } else if (splitResult.requiresSmartSyncApp) {
        pushMessage(messages, "warning", "Wix Media files cannot be accessed remotely. They can only be accessed from your account. SmartSync app will make this process easier.", "⚠️");
        postEntry("Image processing requires SmartSync app. Please install it and try again.", "warning", loc, null); 
        await pause(2500);
        updateStatus(3);
        goTo("PAUSED");
    } else if (splitResult.{
}