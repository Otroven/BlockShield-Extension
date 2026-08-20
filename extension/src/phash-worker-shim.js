(() => {
  const NativeWorker = window.Worker;
  if (!NativeWorker || window.__blockshieldPhashWorkerShimApplied) return;
  window.__blockshieldPhashWorkerShimApplied = true;

  const expectedBrokenUrl = `${window.location.origin}/magick.js`;
  const fixedMagickUrl = chrome.runtime.getURL("node_modules/phash-js/dist/magick.js");

  function createBlobWrappedWorker(targetUrl, options) {
    const source =
      `var magickJsCurrentPath = ${JSON.stringify(targetUrl)};\n` +
      `importScripts(magickJsCurrentPath);`;
    const blob = new Blob([source], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      return new NativeWorker(blobUrl, options);
    } finally {
      // Worker constructor synchronously resolves the URL; we can revoke right away.
      URL.revokeObjectURL(blobUrl);
    }
  }

  function createMagickWorker(options) {
    // Always wrap to inject magickJsCurrentPath so magick.wasm resolves correctly.
    return createBlobWrappedWorker(fixedMagickUrl, options);
  }

  window.Worker = function patchedWorker(url, options) {
    const normalized = typeof url === "string" ? url : String(url || "");
    if (
      normalized === expectedBrokenUrl ||
      normalized.endsWith("/magick.js") ||
      normalized === "magick.js"
    ) {
      return createMagickWorker(options);
    }
    return new NativeWorker(url, options);
  };

  window.Worker.prototype = NativeWorker.prototype;
})();
