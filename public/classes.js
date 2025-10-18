import { v4 as uuidv4 } from 'uuid';
import wixData from "wix-data";

export class Entry {
    constructor ( message, level, source, stackTrace = null) {
        this.date = (new Date()).toISOString();
        this.message = message;
        this.level = level;
        this.source = source;
        this._id =  this.generateId();
        this.icon = this.getIcon(level);

        // Add stackTrace as an optional property
        if (stackTrace) {
            this.stackTrace = stackTrace;
        }

    }

    generateId() {
        return uuidv4();
    }

    getIcon(level) {
        switch (level) {
            case 'success':
                return '✅';
            case 'info':
                return 'ℹ️';
            case 'warning':
                return '⚠️';
            case 'error':
                return '❌';
            default:
                return 'ℹ️';
        }
    }
     addStackTrace(stackTrace) {
        this.stackTrace = stackTrace;
        return this;
    }
}

export class Log extends Entry {
constructor(message, level, source, stackTrace = null) {
        super(message, level, source, stackTrace);
        this.entries = []; // Initialize as empty array first
          
        // If stackTrace was provided, store it
        if (stackTrace) {
            this.stackTrace = stackTrace;
        }
        
        this.addEntry(); // Then add the first entry

    }


    addEntry() {
        const entry = new Entry(this.date, this.message, this.level, this.source);
        this.entries.push(entry);
        return this.entries;
    }

    initializeLog() {
        if(this.entries.length > 0) {
           this.storeLog(this.entries);
        } 
        this.date = null;
        this.message = null;
        this.level = null;
        this.source = null;
        this.entries = [];
        return this.entries;
    }

    storeLog(entries) {
        //Store log entries to persistent storage or database
        console.log('Storing log entries:', entries);
        let entry = new Entry((new Date()).toDateString(), `Stored ${entries.length} log entries`, 'info', 'Log.storeLog');
        this.entries.push(entry);
        // Current implementation doesn't handle promise rejection properly:
        wixData.save('LogEntries', this.entries)
                    .then(() => {
                        console.log('Log entries saved successfully');
                        return true;
                    })
                    .catch((err) => {
                        console.error('Error saving log entries:', err);
                        return false;
                    });
            }

    // UNUSED METHOD - getErrorLogs is never called
    // getErrorLogs() {
    //     return this.entries.filter(entry => entry.level === 'error');
    // }
    
    // UNUSED METHOD - getErrorCount is never called
    // // Count errors by type
    // getErrorCount() {
    //     return this.getErrorLogs().length;
    // }
    
    // UNUSED METHOD - logError is never called
    // // Enhanced error logging with stack traces
    // logError(message, error, source) {
    //     const stackTrace = error?.stack || 'No stack trace available';
    //     const errorMessage = `${message}: ${error?.message || 'Unknown error'}`;
    //     
    //     const entry = new Entry(
    //         new Date().toISOString(),
    //         errorMessage,
    //         'error',
    //         source || 'unknown'
    //     );
    //     
    //     // Add stack trace as additional property
    //     entry.stackTrace = stackTrace;
    //     
    //     this.entries.push(entry);
    //     return entry;
    // }
    
    // UNUSED METHOD - reportCriticalError is never called
    // // Report critical errors to external service
    // reportCriticalError(entry) {
    //     // Example implementation - replace with actual reporting logic
    //     console.error('CRITICAL ERROR:', entry);
    //     
    //     // Could send to error tracking service
    //     // errorTrackingService.report({
    //     //     message: entry.message,
    //     //     stack: entry.stackTrace,
    //     //     timestamp: entry.date,
    //     //     source: entry.source
    //     // });
    //     
    //     return true;
    // }

    clearLog() {
        this.entries = [];
        return this.entries;
    }
}

export class MediaFile {
    constructor(file,fileType) {
        this.fileName =  file.fileName;
        this.originalFileName = file.originalFileName;
        this.fileUrl = file.fileUrl;
        this.jobId = uuidv4();
        this.created = (new Date()).toISOString();
       this.type = ['Image', 'Document', 'Video', 'Audio', 'Gallery'].includes(fileType) ? fileType : 'invalid';
    }

    isImage() {
        return this.type === 'Image';
    }

    isValid() {
        return this.type !== 'invalid' && this.fileUrl && this.originalFileName;
    }

    getInfo(param) {
        switch(param) {
            case 'file':
                return this.fileName;
            case 'original':
                return this.originalFileName;
            case 'url':
                return this.fileUrl;
            case 'jobId':
                return this.jobId;
            case 'created':
                return this.created;
            case 'type':
                return this.type;
            default:
                return null;
        }
    }

    // UNUSED METHOD - isWixImg is never called
    // isWixImg() {
    //     return this.isImage() && (this.fileUrl.includes("wix:image://") || this.fileUrl.includes("wixstatic.com"));
    // }

    // UNUSED METHOD - isRegImg is never called
    // isRegImg() {
    //     return this.isImage() && !this.isWixImg();
    // }
}
