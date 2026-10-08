const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

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

// Match root layout: one data bundle + one app bundle
const dataBundle = [
  fs.readFileSync(path.join(srcDir, "courses.js"), "utf8"),
  fs.readFileSync(path.join(srcDir, "city-coords.js"), "utf8"),
].join("\n");

const appSource = fs.readFileSync(path.join(srcDir, "app.js"), "utf8");

const outputs = [
  { name: "data.js", source: dataBundle },
  { name: "app.js", source: appSource },
];

for (const file of outputs) {
  const result = JavaScriptObfuscator.obfuscate(file.source, obfuscatorOptions);
  const outPath = path.join(distDir, file.name);
  fs.writeFileSync(outPath, result.getObfuscatedCode());
  console.log(`unihub/dist/${file.name} written (${fs.statSync(outPath).size} bytes)`);
}
