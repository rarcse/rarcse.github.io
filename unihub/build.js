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

const coursesPath = path.join(srcDir, "courses.js");
const cityCoordsPath = path.join(srcDir, "city-coords.js");
const uniWebsitesPath = path.join(srcDir, "university-websites.js");
const appPath = path.join(srcDir, "app.js");

const outputs = [];

if (fs.existsSync(coursesPath) && fs.existsSync(cityCoordsPath)) {
  outputs.push({
    name: "data.js",
    source: [fs.readFileSync(coursesPath, "utf8"), fs.readFileSync(cityCoordsPath, "utf8")].join("\n"),
  });
} else {
  console.log("unihub/dist/data.js skipped (src/courses.js or src/city-coords.js missing)");
}

const appParts = [];
if (fs.existsSync(uniWebsitesPath)) {
  appParts.push(fs.readFileSync(uniWebsitesPath, "utf8"));
}
appParts.push(fs.readFileSync(appPath, "utf8"));
outputs.push({ name: "app.js", source: appParts.join("\n") });

for (const file of outputs) {
  const result = JavaScriptObfuscator.obfuscate(file.source, obfuscatorOptions);
  const outPath = path.join(distDir, file.name);
  fs.writeFileSync(outPath, result.getObfuscatedCode());
  console.log(`unihub/dist/${file.name} written (${fs.statSync(outPath).size} bytes)`);
}
