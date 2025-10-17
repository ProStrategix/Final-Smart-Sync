import wixData from 'wix-data';
import {move, goTo, initializeNotices, pushMessage, pushMessageImg, updateNavButtons, updateStatus, pause} from 'public/stateManager.js'
import {postEntry, initializeLog } from 'public/logManagement.js'
import {Entry, Log, MediaFile} from "public/classes.js"
import {getUrl, normalizeCsv } from 'backend/dataConverter.web.js'
import {getSchemaMap, parseCsv,  splitAndSaveData, reportMissingHeaders } from 'public/dataManagement.js'
import {processAndSaveImages} from 'backend/imageConverter.web.js'
import {manageImgResult, handleImgError, clearErrorReport, setupErrorReportUI, getErrorReport, manageFileResult, processCallableUrls, saveUploadedFiles, processManualUrls} from 'public/imageManagement.js'
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

$w('#uploadCsvButton').onChange((event) => {
    $w('#uploadCsvButton').uploadFiles()
		.then(async ([file]) => {
			csvFile = new MediaFile(file, $w("#uploadCsvButton").fileType)
			console.log ("file name: ", file.fileName)
			console.log ("url :", file.fileUrl)
			console.log( 'old file name: ', file.originalFileName)
			pushMessage(messages, "success", "CSV file was successfully uploaded.", "✅")
			postEntry("CSV file was successfullly uploaded in Media Manager", "success", loc, null)
			$w("#msbox").changeState("STATUSTRACK")
			
			const { success, downloadUrl, error } = await getUrl(file.fileUrl);

 			 if (!success) {
    			console.error("Failed to resolve download URL:", error);
				postEntry("CSV file was successfullly uploaded in Media Manager", "error", "getUrl() in dataConverter.web.js", null)
    			return;
  			}
			
			console.log("Fetchable download URL:", downloadUrl);
			postEntry("fetchable url was provided to the csv content", "success", "getUrl", null)
			const response = await fetch(downloadUrl);
  			const text = await response.text();
  			console.log("CSV contents:", text);
			console.log("CSV Text Length:", text?.length);
			console.log("CSV Sample:", text?.slice(0, 100));
			pushMessage(messages, "success", "CSV file was successfully accessed.", "✅")
			postEntry("CSV file was successfullly accessed and text extracted", "success", "widget.js", null)
			updateStatus(1)
			const rawParse = await parseCsv(text)
			let parsed = JSON.parse(rawParse)
			let schemaMap = await getSchemaMap()
			console.log('data heading to normalization: ' , parsed, ' vs map: ', schemaMap)
			postEntry("Csv data has been parsed and schema map creates", 'success',"dataManagement.js", null)
			let normalizedRaw = await normalizeCsv(parsed.headers, parsed.rows, schemaMap)
			let normalize = normalizedRaw
			pushMessage(messages, "success", "CSV data has been normalized.", "✅")
			postEntry("Data have been normalized", 'success',"dataConverter.web.js", null)
			if (normalize.success && normalize.normalizedRows?.length > 0) {
				console.log("🔄 Starting data split and save...");
				pushMessage(messages, "info", "Splitting and saving data...", "🔄");
				
				const splitResult = await splitAndSaveData(normalize.normalizedRows);
				console.log("🔄 Image processing required for some URLs");
				// Handle split result - check specific cases first before generic success
				if (splitResult.requiresImageProcessing) {
					// Callable URLs - ready for processing
					pushMessage(messages, "info", "Image URLs ready for processing", "🔄");
					console.log("🖼️ Callable URLs:", splitResult.callableUrls);
					
					// Update status, pause, then go to PROCESSING
					updateStatus(2);
					await pause(1500);
					updateStatus(3);
					goTo("PROCESSING")
					
					// Process all callable URLs
					await processCallableUrls(splitResult.callableUrls, messages);
					
				
				} else if (splitResult.requiresSmartSyncApp) {
					// Wix URLs detected - splitAndSaveData already called goTo("ERRORMISSINGIMAGES")
					updateStatus(2, "ERRORMISSINGIMAGES");
					pushMessage(messages, "error", "Wix image URLs detected - SmartSync app required", "❌");
					console.log("🔗 Wix URLs:", splitResult.wixUrls);
				} else if (splitResult.missingImages) {
					updateStatus(2, "ERRORMISSINGIMAGES");
					// Missing images - splitAndSaveData already called goTo("ERRORMISSINGIMAGES")
					pushMessage(messages, "warning", "Products missing image URLs", "⚠️");
					console.log("📷 Missing images:", splitResult.emptyImageProducts);
				} else if (splitResult.success) {
					pushMessage(messages, "success", splitResult.message, "✅");
					console.log("📊 Split completed:", splitResult.details);
				} else {
					pushMessage(messages, "error", `Split failed: ${splitResult.error || 'Unknown error'}`, "❌");
				}
			} else if (normalize.missingEssentialHeaders?.length > 0) {
				updateStatus(2, "ERRORMISSINGHEADERS");
				return reportMissingHeaders(normalize.missingEssentialHeaders)
			}	else {
				pushMessage(messages, "error", "Normalization failed - no rows to process", "❌");
			}
		})
		.catch(err => {
			console.log(err)
			pushMessage(messages, "error", "CSV file failed to upload. "+err, "❌")
			postEntry("Error: "+err, "error" , loc, null)
		})
	mainLog.showLog()    
})


$w('#addImagesFilesButton').onChange(async (event) => {
	const imgsToAdd = $w('#addImagesFilesButton').value
	if (imgsToAdd.length < 1) {
		pushMessage(messages, "warn", "No files selected for upload", "⚠️")
		return
	}
	let wixMediaUrls = []
	clearErrorReport();
	goTo("PROCESSING")
	$w("#addImagesFilesButton").uploadFiles()
  		.then((uploadedFiles) => {
    		uploadedFiles.forEach((uploadedFile) => {
      		let fileUrl = uploadedFile.fileUrl;
			let fileName = uploadedFile.fileName;
			let originalFileName = uploadedFile.originalFileName;
						
			// Match WixImageURLs schema from backend
			wixMediaUrls.push({
				id: fileName, // Use fileId as productId fallback
				productName: originalFileName || fileName,
				image: fileUrl, // Wix media URL
				wixFileId: fileName,
				status: 'ready',
				uploadMethod: 'local_file',
				createdAt: new Date(),
				convertedAt: new Date()
			})
			manageFileResult(uploadedFile)
    });
  })
  .catch((uploadError) => {
	let errorReport = getErrorReport();
    let errCode = uploadError.errorCode; // 7751
    let errDesc = uploadError.errorDescription; // "Error description"
	pushMessage(messages, "error", `File upload failed: ${errDesc} (Code: ${errCode})`, "❌");
	postEntry("Error: "+errDesc, "error" , "file upload in widget.js", null)
	errorReport.push(new Entry(`File upload failed: ${errDesc} (Code: ${errCode})`, "error", "widget.js", null));
  });
  	await pause(2000)
		.then(async() => {
			await saveUploadedFiles(wixMediaUrls);
			postEntry("Local files successfully uploaded and records created", "success", loc, null)
			setupErrorReportUI();
		})
		.catch(err => {
			pushMessage(messages, "error", "Image upload failed. "+err, "❌")
			postEntry("Error: "+err, "error" , loc, null)	
		})
});

$w("#addImageUrlButton").onClick( (event) => {
	let urls = parseUrls($w("#imageUrlsText").value)
	if (urls.length < 1) {
		pushMessage(messages, "warn", "No URLs provided for processing", "⚠️")
		return
	}
	clearErrorReport();
	goTo("PROCESSING")
	processManualUrls(urls, "urllist", messages)
});

function parseUrls(text) {
	let urls = text.split(",").map( url => url.trim()).filter( url => url.length > 0)
	return urls
}

$w("#fileErrorButton").onClick( (event) => {	
	$w("#fileErrorText").collapse();
	$w("#fileErrorButton").collapse();
	setupErrorReportUI();
})

/*
  "CSVUPLOADED",
  "CSVPARSED",
  "COLUMNEXTRACTED",
  "VALIDATED",
  "PROCESSING",
  "TRANSMITTED",
  "DONE",
  "ERROR"
  ]
  */

$w("#notChecked").onClick((event) => {
	let $item = $w.at(event.context)
	$item('#notChecked').collapse()
	$item("#checked").expand()
	$w('#notMatched').expand()
	setFieldValues($item("#id").text, "@prostrategix/smartsync-ecommerce/ParsedData")
	$item("#notChecked").disable()
	$item("#id").style.color = "#D9E8FF"
	$item("#itemBoxProd").style.backgroundColor = "#D9E8FF"
	
})

async function setFieldValues(value, db) {
	let item = await wixData.query(db).eq("id", value).find().then(r => r.items[0])
	if (db.toLowerCase().includes("wix")) {
		$w("#dataset2").setFieldValue("mainImg", item.image)
	} else {
		$w("#dataset2").setFieldValues({
			'id': item.ID,
			"headline": item.headline,
			"name": item.name,
			"strain": item.strain,
			"category": item.category,
			"formattedPrice": item.formattedPrice,
			"unitPrice": item.unitPrice

		})
	}
}

$w("#notMatched").onClick(e => {
	let $item = $w.at(e.context)
	$item("#itemBoxImg").style.backgroundColor = "#D9E8FF"
	$item("#notMatched").collapse()
	$item("#matched").expand()
})

$w("#fail").onViewportEnter(() => {
	$w("#dataset1").revert()
	$w("#dataset3").revert()
	$w("#dataset1").refresh()
	$w("#dataset3").refresh()
})

$w("#returnButton").onClick(() => {
	goTo("INIT");
})

$w("#continueToReview").onClick(() => {
	handleFinalReview()
	$w("#msbox").changeState("REVIEW")
})

