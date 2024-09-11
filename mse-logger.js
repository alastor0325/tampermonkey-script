// ==UserScript==
// @name         Media and MSE Logger with Unique Identifiers
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Log media playback, MediaSource, and SourceBuffer activities with unique identifiers for each instance.
// @author       alwu
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  let logs = [];
  let idCounter = 0;

  // Function to generate a unique ID
  function generateId(prefix) {
      return `${prefix}-${idCounter++}`;
  }

  // Helper function to log messages with timestamps and unique IDs
  function log(message, id) {
      const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''); // Strip milliseconds and Z
      const logEntry = `${timestamp} [${id}] - ${message}`;
      console.log(logEntry);
      logs.push(logEntry);
  }

  // Function to download logs as a text file
  function downloadLogs() {
      const dateString = new Date().toISOString().replace(/:\s*/g, '-').slice(0, 19).replace('T', '_'); // Replace colons and T for file naming
      const filename = `logs_${dateString}.txt`;

      const blob = new Blob(logs.map(entry => entry + '\n'), { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
  }

  // Add a button to download logs
  window.addEventListener('load', () => {
      const button = document.createElement('button');
      button.textContent = 'Download Logs';
      button.style.position = 'fixed';
      button.style.bottom = '20px';
      button.style.right = '20px';
      button.style.padding = '10px 20px';
      button.style.fontSize = '16px';
      button.style.color = 'white';
      button.style.backgroundColor = 'red';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.cursor = 'pointer';
      button.style.zIndex = '10000';
      button.addEventListener('click', downloadLogs);
      document.body.appendChild(button);
  });

  // Wrap MediaSource to enhance logging
  const originalMediaSource = MediaSource;
  window.MediaSource = function() {
      const instance = new originalMediaSource();
      const id = generateId('MediaSource');
      log('MediaSource instance created.', id);

      ['sourceopen', 'sourceended', 'sourceclose'].forEach(event => {
          instance.addEventListener(event, () => log(`MediaSource event '${event}' fired.`, id));
      });

      const originalEndOfStream = instance.endOfStream;
      instance.endOfStream = function(reason) {
          const stack = new Error().stack; // Capture the call stack
          log(`endOfStream called with reason: ${reason}\nCall stack:\n${stack}`);
          return originalEndOfStream.apply(this, arguments);
      };

      return instance;
  };
  window.MediaSource.prototype = originalMediaSource.prototype;
  window.MediaSource.isTypeSupported = originalMediaSource.isTypeSupported;

  // Enhance SourceBuffer logging
  const originalAddSourceBuffer = originalMediaSource.prototype.addSourceBuffer;
  originalMediaSource.prototype.addSourceBuffer = function(mimeType) {
      const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);
      const id = generateId('SourceBuffer');
      log(`SourceBuffer added for MIME type: ${mimeType}`, id);

      ['updatestart', 'update', 'error', 'abort'].forEach(event => {
          sourceBuffer.addEventListener(event, () => log(`SourceBuffer event '${event}' fired for MIME type: ${mimeType}`, id));
      });

      // Attach event listener for debugging
      sourceBuffer.addEventListener('updateend', () => {
          const bufferedRanges = [];
          for (let i = 0; i < sourceBuffer.buffered.length; i++) {
              bufferedRanges.push(`[${sourceBuffer.buffered.start(i).toFixed(2)}s - ${sourceBuffer.buffered.end(i).toFixed(2)}s]`);
          }
          log(`SourceBuffer 'updateend' fired for MIME type: ${mimeType}. Buffered Ranges: ${bufferedRanges.join(', ')}`);
      });

      return sourceBuffer;
  };

  // Attach detailed logging to media elements for playback details
  function attachMediaLogging(element) {
      const id = generateId('MediaElement');
      element.addEventListener('timeupdate', () => {
          const duration = element.duration.toFixed(2);
          const currentTime = element.currentTime.toFixed(2);
          const bufferedRanges = Array.from({length: element.buffered.length}, (_, i) => `[${element.buffered.start(i).toFixed(2)}s - ${element.buffered.end(i).toFixed(2)}s]`).join(', ');
          log(`Playback: Duration: ${duration}s, Current Time: ${currentTime}s, Buffered Ranges: ${bufferedRanges}`, id);
      });
  }

  // Monitor DOM for new media elements and attach logging
  const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === 'VIDEO' || node.nodeName === 'AUDIO')) {
                  attachMediaLogging(node);
              }
          });
      });
  });

  // Start observing the document body for additions of media elements
  observer.observe(document.body, { childList: true, subtree: true });

  // Attach logging to any existing media elements when the script runs
  document.querySelectorAll('video, audio').forEach(attachMediaLogging);
})();
