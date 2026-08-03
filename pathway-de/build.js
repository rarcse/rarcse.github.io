const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
};

function read(rel) {
  return fs.readFileSync(path.join(srcDir, rel), "utf8");
}

function escapeForTemplateLiteral(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function obfuscateAndWrite(filename, source) {
  const result = JavaScriptObfuscator.obfuscate(source, obfuscatorOptions);
  const out = path.join(distDir, filename);
  fs.writeFileSync(out, result.getObfuscatedCode());
  console.log(`wrote dist/${filename} (${fs.statSync(out).size} bytes)`);
}

// --- data bundle ---
const dataBundle = [
  read("data/courses-data.js"),
  read("data/geo.js"),
  read("data/germany-border.js"),
].join("\n;\n");

obfuscateAndWrite("data.js", dataBundle);

// --- app bundle: inject CSS + shell HTML + map + app + boot ---
const css = escapeForTemplateLiteral(read("styles.css"));
const shell = escapeForTemplateLiteral(read("shell.html"));
const mapJs = read("map.js");
const appJs = read("app.js");

const appBundle = `
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = \`${css}\`;
  document.head.appendChild(style);
}

function buildUI() {
  document.body.insertAdjacentHTML("afterbegin", \`${shell}\`);
}

${mapJs}

${appJs}

injectStyles();
buildUI();
boot();
`;

obfuscateAndWrite("app.js", appBundle);
console.log("pathway-de build complete");
