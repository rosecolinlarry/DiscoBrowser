// Loads sql.js and returns an init function that resolves to a SQL factory.

export async function loadSqlJs({
  vendorPath = "./vendor/sql-wasm/sql-wasm.js", localPath = "./node_modules/sql.js/dist/sql-wasm.js", cdn = "https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js",
} = {}) {
  let useVendor = false;
  let useLocal = false;

  if (typeof initSqlJs === "undefined") {
    const loadScript = (src) => new Promise((resolve, reject) => {
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
    } catch (err) {
      try {
        await loadScript(localPath);
        useLocal = true;
        console.error(err);
      } catch (err) {
        await loadScript(cdn);
        console.error(err);
      }
    }
  }

  // eslint-disable-next-line no-undef
  const SQL = await initSqlJs({
    locateFile: (file) => useVendor
      ? `./vendor/sql-wasm/${file}`
      : useLocal
        ? `./node_modules/sql.js/dist/${file}`
        : `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`,
  });

  return SQL;
}
