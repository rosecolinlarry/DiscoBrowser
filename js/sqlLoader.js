// sqlLoader.js
// Loads sql.js and returns an init function that resolves to a SQL factory.

export async function loadSqlJs({ vendorPath = "./vendor/sql-wasm/sql-wasm.js", localPath = "./node_modules/sql.js/dist/sql-wasm.js", cdn = "https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js" } = {}) {
  let useVendor = false;
  let useLocal = false;

  if (typeof initSqlJs === "undefined") {
    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });

    try {
      await loadScript(vendorPath);
      useVendor = true;
      console.info("Loaded vendored sql-wasm.js from", vendorPath);
    } catch (_) {
      try {
        await loadScript(localPath);
        useLocal = true;
        console.info("Loaded local sql-wasm.js from", localPath);
      } catch (err) {
        console.warn("Local sql-wasm.js not found; falling back to CDN");
        await loadScript(cdn);
      }
    }
  }

  const SQL = await initSqlJs({
    locateFile: (file) =>
      useVendor
        ? `./vendor/sql-wasm/${file}`
        : useLocal
        ? `./node_modules/sql.js/dist/${file}`
        : `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`,
  });

  return SQL;
}
