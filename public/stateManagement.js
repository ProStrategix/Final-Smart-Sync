//import wixWidget from "wix-widget"
import { v4 as uuidv4 } from 'uuid';
import { postEntry } from 'public//logManagement.js';

let _statusRepeaterBound = false;
// let _imageProcessingRepeaterBound = false; // COMMENTED OUT - Image management not yet rebuilt
let _classificationRepeaterBound = false;
const state = $w('#msbox')
export const states = [  "START",
 "PROCESSDATA",
 "DATAREPORT",
 //"RETRIEVEIMGS",
 "CONVERT",
"MISSINGIMAGES",
 "REVIEW",
 "TRANSMIT",
// "FINISHRESET",
 "ERRORDATA",
 "ERRORIMAGES",
  "ERRORHEADERS",
  "ERRORREPORT",
  "ERRORCONVERSION",
  "PATCH",
  "RESET",
  "DONE",
  "EXIT", 
  "AOERROR"
  ]



let tstamp = (new Date()).toDateString()
let repeater = $w("#statusRepeater");
let classifyRepeater = $w("#classifyRepeater");
let imgRepeater = $w("#imageProcessingRepeater"); // COMMENTED OUT - Image management not yet rebuilt

export function logStateChange(oldState, newState) {
    const message = `State changed from ${oldState} to ${newState} at ${tstamp}`;
    postEntry(message, "info", "State Management Module", null)
    console.log(message);
}

export function pause(ms = 1500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function goTo(newState) {
    if(states.includes(newState)) {
        const upperState = newState.toUpperCase();
        const currentState = typeof state.currentState === 'string' ? state.currentState : 'UNKNOWN';
        
        $widget.props.state = upperState;
        console.log('props set to', $widget.props.state);
        state.changeState(upperState);
        console.log('state.changeState called with:', upperState);
        logStateChange(currentState, upperState);
        return `Successful changed state to ${upperState}.`;
    }
    return `Failed to change state to ${newState.toUpperCase()}.`;
}

/**
 * Handles errors and updates UI accordingly
 * @param {Object} error - The error object
 * @param {string} context - Optional context where the error occurred
 */
export function handleError(error, context = "") {
  console.error(`Error ${context ? "in " + context : ""}:`, error);
  
  // Safely extract error properties
  const errorCode = (error && error.errorCode) || "UNKNOWN";
  const errorMessage = (error && (error.errorDescription || error.message)) || "Unknown error";
  
  // Update UI elements
  $w("#statusText").text = `Error occurred${context ? " during " + context : ""}`;
  $w("#errorMsg").text = `${errorMessage} (Code: ${errorCode})`;
  $w("#spinnerBox").hide();
  
  // Go to error state
  goTo("ERROR");
}


// Status notification functions

export function bindStatusRepeaterOnce() {
   if (_statusRepeaterBound) {return true};
   
   try {
    // Get a reference to the repeater
   
    // Check if the repeater exists
    if (!repeater) {
      console.error("Status repeater not found");
      return false;
    }
    
    // Bind the item ready handler
    repeater.onItemReady(($item, itemData, index) => {
      // message text
      $item("#statusText").text = itemData.message;

      // icon: prefer explicit icon, else derive from type
      const icon = itemData.icon || 
        (itemData.type.toLowerCase() === "success" ? "✅" :
         itemData.type.toLowerCase() === "warning" ? "⚠️" :
         itemData.type.toLowerCase() === "error"   ? "❌" :
         itemData.type.toLowerCase() === "info"    ? "ℹ️" : "");
      $item("#statusIcon").text = icon;

      // color by type
      const color =
        itemData.type.toLowerCase() === "success" ? "#2E7D32" :
        itemData.type.toLowerCase() === "warning" ? "#FF8F00" :
        itemData.type.toLowerCase() === "error"   ? "#C62828" : 
        itemData.type.toLowerCase() === "info"    ? "#2b5794" : "#0F2B42";
      $item("#statusText").style.color = color;
    });

    _statusRepeaterBound = true;
    console.log("Status repeater bound successfully");
    return true;
  } catch (err) {
    console.error("Failed to bind status repeater:", err);
    _statusRepeaterBound = false;
    return false;
  }
}

export function bindImageProcessingRepeaterOnce() {
   if (_imageProcessingRepeaterBound) {return true};
    
   try {
    // Get a reference to the image processing repeater
    const repeater = $w("#imageProcessingRepeater");
    
    // Check if the repeater exists
    if (!imgRepeater) {
      console.error("Image processing repeater not found");
      return false;
    }
    
    // Bind the item ready handler
    imgRepeater.onItemReady(($item, itemData) => {
      // Product name or identifier
      $item("#imgProductName").text = itemData.productName || itemData.productId || "Unknown";
      
      // Status text
      $item("#imgStatus").text = itemData.status;

      // icon: prefer explicit icon, else derive from status
      const icon = itemData.icon || 
        (itemData.status.toLowerCase().includes("success") || itemData.status.toLowerCase().includes("complete") ? "✅" :
         itemData.status.toLowerCase().includes("processing") ? "🔄" :
         itemData.status.toLowerCase().includes("pending") ? "⏳" :
         itemData.status.toLowerCase().includes("error") || itemData.status.toLowerCase().includes("failed") ? "❌" : "");
      $item("#imgIcon").text = icon;

      // color by status
      const color =
        itemData.status.toLowerCase().includes("success") || itemData.status.toLowerCase().includes("complete") ? "#2E7D32" :
        itemData.status.toLowerCase().includes("processing") ? "#2196F3" :
        itemData.status.toLowerCase().includes("pending") ? "#FF8F00" :
        itemData.status.toLowerCase().includes("error") || itemData.status.toLowerCase().includes("failed") ? "#C62828" : "#0F2B42";
      $item("#imgStatus").style.color = color;
    });

    _imageProcessingRepeaterBound = true;
    console.log("Image processing repeater bound successfully");
    return true;
  } catch (err) {
    console.error("Failed to bind image processing repeater:", err);
    _imageProcessingRepeaterBound = false;
    return false;
  }
}

export function clearStatusLog() {
  try {
    const repeater = $w("#statusRepeater");
    if (repeater) {
      repeater.data = [];
      console.log("Status log cleared");
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to clear status log:", err);
    return false;
  }
}

export function clearClassificationLog() {
  try {
    const repeater = $w("#classifyRepeater");
    if (repeater) {
      repeater.data = [];
      console.log("Classification log cleared");
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to clear classification log:", err);
    return false;
  }
}

export async function pushMessage(messages, type, text, icon) {
  try {
    // Create new message item
    const item = { 
      _id: uuidv4(), 
      type, 
      message: text,
      timestamp: new Date().toISOString() // Add timestamp to ensure uniqueness
    };
    if (icon) item.icon = icon;
    
    // Add to messages array
    messages.push(item);
    console.log(`Added message: ${text}. Total messages: ${messages.length}`);
    
    // Use direct DOM manipulation via setTimeout
    setTimeout(() => {
      try {
        // Get repeater element
        const repeater = $w("#statusRepeater");
        if (!repeater) {
          console.error("Status repeater not found during update");
          return;
        }
        
        // Create a fresh copy of the latest messages
        const latestMessages = messages.length <= 5 ? 
          [...messages] : 
          [...messages.slice(-5)];
          
        // Set the data directly
        repeater.data = latestMessages;
        
        // Auto-scroll the container to show the latest messages
        const container = $w("#statusWrapper"); // Replace with your actual container ID
        if (container) {
          // Scroll to the bottom
          container.scrollTo(0, container.scrollHeight);
        }
        
        console.log("Status repeater updated with:", latestMessages.map(m => m.message).join(", "));
      } catch (e) {
        console.error("Error updating status repeater:", e);
      }
    }, 10);
    
    return messages;
  } catch (err) {
    console.error("Failed to push message:", err);
    return messages;
  }
}

export async function initializeStatusLog(messages) {
  try {
    clearStatusLog();
    
    // Add initial message after a short delay
    setTimeout(() => {
      pushMessage(messages, 'info', 'Starting Up..This may take a few minutes', 'ℹ️');
    }, 100);
    
    return messages;
  } catch (err) {
    console.error("Failed to initialize status log:", err);
    return messages;
  }
}

export async function pushMessageImg(imageMessages, productId, productName, status, icon) {
  try {
    // Create new image processing message item
    const item = { 
      _id: uuidv4(), 
      productId,
      productName,
      status,
      timestamp: new Date().toISOString()
    };
    if (icon) item.icon = icon;
    
    // Add to imageMessages array
    imageMessages.push(item);
    console.log(`Added image processing message: ${productName} - ${status}. Total: ${imageMessages.length}`);
    
    // Use direct DOM manipulation via setTimeout
    setTimeout(() => {
      try {
        // Get repeater element
        const imgRepeater = $w("#imageProcessingRepeater");
        if (!imgRepeater) {
          console.error("Image processing repeater not found during update");
          return;
        }
        
        // Set the data directly
        imgRepeater.data = [...imageMessages];
        
        console.log("Image processing repeater updated with:", imageMessages.map(m => `${m.productName}: ${m.status}`).join(", "));
      } catch (e) {
        console.error("Error updating image processing repeater:", e);
        pushMessageImg(imageMessages, productId, productName, status, icon);
      }
    }, 10);
    
    return imageMessages;
  } catch (err) {
    console.error("Failed to push image processing message:", err);
    return imageMessages;
  }
}

export async function initializeNotices(messages) {
  try {
    // Ensure messages is an array
    if (!Array.isArray(messages)) {
      messages = [];
    }
    
    // Only bind once
    if (!_statusRepeaterBound) {
      const bindSuccess = bindStatusRepeaterOnce();
      if (!bindSuccess) {
        console.error("Failed to bind status repeater");
      } else {
        // Initialize with a delay to ensure binding completes
        setTimeout(() => {
          clearStatusLog();
          initializeStatusLog(messages);
        }, 200);
      }
    }
    
    // Also bind classification repeater
    if (!_classificationRepeaterBound) {
      const bindSuccess = bindClassificationRepeaterOnce();
      if (!bindSuccess) {
        console.error("Failed to bind classification repeater");
      } else {
        console.log("Classification repeater bound and ready");
      }
    }
    
    // COMMENTED OUT - Image management not yet rebuilt
    // // Also bind image processing repeater
    // if (!_imageProcessingRepeaterBound) {
    //   const bindSuccess = bindImageProcessingRepeaterOnce();
    //   if (!bindSuccess) {
    //     console.error("Failed to bind image processing repeater");
    //   }
    // }
    
    return messages;
  } catch (err) {
    console.error("Error in initializeNotices:", err);
    return Array.isArray(messages) ? messages : [];
  }
}

export async function populateClassificationResults(classificationData) {
  try {
    if (!Array.isArray(classificationData) || classificationData.length === 0) {
      console.log("No classification data to display");
      return [];
    }
    
    // Ensure classification repeater is bound
    if (!_classificationRepeaterBound) {
      const bindSuccess = bindClassificationRepeaterOnce();
      if (!bindSuccess) {
        console.error("Failed to bind classification repeater");
        return [];
      }
    }
    
    // Transform classification data for repeater
    const repeaterData = classificationData.map((item, index) => ({
      _id: item.rowId || uuidv4(),
      message: `${item.productName}: ${item.status}`,
      category: item.imageCategory,
      icon: item.imageCategory === 1 ? "✅" :
            item.imageCategory === 2 ? "🔷" :
            item.imageCategory === 3 ? "📁" :
            item.imageCategory === 4 ? "⚠️" :
            item.imageCategory === 5 ? "❌" : "❓",
      timestamp: new Date().toISOString()
    }));
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      try {
        const repeater = $w("#classifyRepeater");
        if (!repeater) {
          console.error("Classification repeater not found during update");
          return;
        }
        
        // Set the data directly
        repeater.data = repeaterData;
        
        console.log("Classification repeater updated with:", repeaterData.length, "items");
        console.log("Current log entries: ", repeaterData.map(d => d.message));
      } catch (e) {
        console.error("Error updating classification repeater:", e);
      }
    }, 10);
    
    return repeaterData;
  } catch (err) {
    console.error("Failed to populate classification results:", err);
    return [];
  }
}

export function updateStatus(x, y) {
   if(x < 3) { $w(`#statusBox${x+1}`).style.backgroundColor = "#D9e8ff" } 
    $w(`#statusBox${x}`).style.backgroundColor = "#CDD4DE"
    console.log('I supposed to go here ', y)
    if(x === 1) {
        $w(`#statusText${x+1}`).text = "Smart Matching Headers"
        $w(`#statusText${x}`).text = "Uploaded & Accessed the Data"
    } else if (x===2){
        $w(`#statusText${x+1}`).text = "Compiling Final Feedback"
        $w(`#statusText${x}`).text = "Smart Match Complete"
        goTo(y)
    } else {
        $w(`#statusText${x}`).text = "Final Feedback is Ready"
        goTo(y)
    }
}
