const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
};

for (const file of ['data.js', 'app.js']) {
  const src = fs.readFileSync(path.join(__dirname, 'src', file), 'utf8');
  const result = JavaScriptObfuscator.obfuscate(src, obfuscatorOptions);
  fs.writeFileSync(path.join(distDir, file), result.getObfuscatedCode());
  console.log(`dist/${file} written`);
}
