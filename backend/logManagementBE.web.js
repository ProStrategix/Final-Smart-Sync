import wixData from 'wix-data';
import { webMethod, Permissions } from 'wix-web-module';

const logBEDB = '@prostrategix/smartsync-product-transfer/LogBE';

/**
 * postEntryBE
 * Store a log entry in the backend log database.
 * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR').
 * @param {string} message - The log message.
 * @param {object} metadata - Optional metadata associated with the log entry.
 * @returns {Promise<object>} A promise that resolves with the stored log entry.
 */
export const postEntryBE = webMethod(Permissions.Anyone, async (level, message, metadata = {}) => {
    try {
        const logEntry = {
            level: level || 'INFO',
            message: message || 'No message provided',
            metadata: JSON.stringify(metadata),
            timestamp: new Date(),
            source: 'DataConverter'
        };

        const result = await wixData.insert(logBEDB, logEntry);
        console.log('Log entry stored successfully:', result._id);
        return { success: true, id: result._id };
    } catch (error) {
        console.error('Error storing log entry:', error);
        return { success: false, error: error.message };
    }
});
