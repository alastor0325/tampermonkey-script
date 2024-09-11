// ==UserScript==
// @name         DRM Data Logger with ASCII and Hexadecimal Conversion
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Log DRM initialization data and update responses with ASCII filtering and Hexadecimal keyId
// @author       alwu
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to convert binary data to filtered ASCII string
    function binaryToFilteredAscii(data) {
        const printableRange = { min: 32, max: 126 }; // Printable ASCII range (space to tilde)
        let result = '';
        data.forEach(byte => {
            if (byte >= printableRange.min && byte <= printableRange.max) {
                result += String.fromCharCode(byte);
            }
        });
        return result;
    }

    // Function to convert Uint8Array to Hex String
    function bufferToHex(buffer) {
        return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    // Hook into MediaKeySession.generateRequest
    if (window.MediaKeySession && MediaKeySession.prototype.generateRequest) {
        const originalGenerateRequest = MediaKeySession.prototype.generateRequest;

        MediaKeySession.prototype.generateRequest = function(initDataType, initData) {
            console.log('Init DataType:', initDataType);
            console.log('Init Data:', binaryToFilteredAscii(new Uint8Array(initData)));

            // Set interval to log key statuses periodically
            setInterval(() => {
                if (this.keyStatuses && this.keyStatuses.size > 0) {
                    console.log('Periodic Key Status Check:');
                    this.keyStatuses.forEach((status, keyId) => {
                        console.log(`KeyID: ${bufferToHex(new Uint8Array(keyId))} Status: ${status}`);
                    });
                }
            }, 5000); // Check every 5 seconds

            return originalGenerateRequest.apply(this, [initDataType, initData]);
        };
    }

    // Hook into MediaKeySession.update
    if (window.MediaKeySession && MediaKeySession.prototype.update) {
        const originalUpdate = MediaKeySession.prototype.update;

        MediaKeySession.prototype.update = function(response) {
            console.log('Update response:', binaryToFilteredAscii(new Uint8Array(response)));
            return originalUpdate.apply(this, [response]);
        };
    } else {
        console.error('MediaKeySession or update is not supported by this browser.');
    }
})();
