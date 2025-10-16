import { Entry, Log } from './classes.js';
const LOGS_DB = "LogsDB";
const MAX_LOG_ENTRIES = 500; // Define a maximum number of log entries to keep in memory
let mainLog;

/**
 * Initializes the main log object with the given messages array.
 * If the messages array is empty or not an array, a new log object is created.
 * If the messages array is not empty, the existing main log object is cleared and re-initialized with the given messages.
 * @param {Array} messages - an array of objects containing message, level, source, and optionally, stackTrace
 * @returns {Promise} mainLog - the main log object, re-initialized if messages array is not empty
 */
export async function initializeLog(messages) {
    mainLog = await new Promise((res,rej) => {
            if (!Array.isArray(messages)) {
            console.error('Expected array for messages parameter');
            messages = [];
        }

        if (messages.length < 1) {
            let log = new Log("Log initialized", "info", "Log Management Module");
            console.log('Log initialized with entry:', mainLog);
            // No need for postEntry here since Log constructor already adds an entry
            res(log);
        } else if (mainLog) {
                mainLog.initializeLog(); // Use the existing method instead of clearLog
                console.log('Log cleared. Current entries:', mainLog.entries);
                let log = new Log("Log re-initialized", "info", "Log Management Module");
            // No need for postEntry here
                res(log);
            } else {
                rej('log could not be initiated')
            }
    })
    return mainLog
}

     
/**
 * Returns the current main log object if it exists and has entries, or null otherwise.
 * @returns {Log|null} mainLog - the current main log object, or null if no log exists
 */
export function getCurrentLog() {
    if (mainLog && mainLog.entries.length > 0) {
        return mainLog;
    }
    return null; // Return null explicitly when no log exists
}

/**
 * Posts a new log entry to the current main log object.
 * If the main log object does not exist or has no entries, a new log object is created.
 * If the main log object has entries and exceeds the maximum number of log entries, the oldest entries are removed.
 * @param {string} message - the message to be logged
 * @param {"info"|"success"|"warning"|"error"} level - the log level (info, success, warning, error)
 * @param {string} source - the source of the log entry (e.g., module name)
 * @param {string|null} stackTrace - an optional stack trace to be stored with the log entry
 * @returns {Promise<Log>} mainLog - the current main log object with the new entry added
 */
export async function postEntry(message, level, source, stackTrace) {
    // Check if mainLog exists first
    if (!mainLog || mainLog.entries.length < 1) {
        mainLog = new Log("Log created", "info", "Log Management Module");
    }
    
    // Trim entries if exceeding maximum
    if (mainLog.entries.length >= MAX_LOG_ENTRIES) {
        mainLog.entries = mainLog.entries.slice(-MAX_LOG_ENTRIES + 1);
        console.warn(`Log entries exceeded maximum. Oldest entries removed.`);
    }
    
    const entry = new Entry(message, level, source, stackTrace);
    console.log('Posting entry: ', entry);
    
    mainLog.entries.push(entry);
    console.log('Current log entries: ', mainLog.entries);
    return mainLog;
}

/**
 * Ends the current log session and stores the log entries if available.
 * @returns {Promise<boolean>} true if log stored successfully, false otherwise
 * @throws {Error} if failed to store log entries
 */

export async function endSession() {
    // First check if mainLog exists at all
    if (!mainLog) {
        console.log('No log exists. Session end skipped.');
        return false;
    }
    
    // Then check if it has entries
    if (mainLog.entries.length > 0) {
        try {
            await mainLog.storeLog(mainLog.entries);
            console.log('Session ended. Log stored with entries:', mainLog.entries);
            mainLog = null; // Reset log for next session
            return true;
        } catch (error) {
            console.error('Failed to store log entries:', error);
            return false;
        }
    } else {
        console.log('No log entries to store. Session end skipped.');
        return false;
    }
}