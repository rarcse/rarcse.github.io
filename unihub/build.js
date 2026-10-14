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
const statesEmbedPath = path.join(srcDir, "germany-states-embed.js");
const appPath = path.join(srcDir, "app.js");
const journeyPath = path.join(srcDir, "journey.js");

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
for (const optional of [uniWebsitesPath, statesEmbedPath]) {
  if (fs.existsSync(optional)) appParts.push(fs.readFileSync(optional, "utf8"));
}
appParts.push(fs.readFileSync(appPath, "utf8"));
if (fs.existsSync(journeyPath)) appParts.push(fs.readFileSync(journeyPath, "utf8"));
appParts.push("\ninit();\n");
outputs.push({ name: "app.js", source: appParts.join("\n") });

const reviewsPath = path.join(srcDir, "reviews.js");
if (fs.existsSync(reviewsPath)) {
  outputs.push({ name: "reviews.js", source: fs.readFileSync(reviewsPath, "utf8") });
}

const siteViewsPath = path.join(srcDir, "site-views.js");
if (fs.existsSync(siteViewsPath)) {
  outputs.push({ name: "site-views.js", source: fs.readFileSync(siteViewsPath, "utf8") });
}

for (const file of outputs) {
  const result = JavaScriptObfuscator.obfuscate(file.source, obfuscatorOptions);
  const outPath = path.join(distDir, file.name);
  fs.writeFileSync(outPath, result.getObfuscatedCode());
  console.log(`unihub/dist/${file.name} written (${fs.statSync(outPath).size} bytes)`);
}
