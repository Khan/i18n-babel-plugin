/**
 * The purpose of this file is compile the test fixtures with jstransform
 * so that we can compare the output and make sure it's acceptable.
 */

var fs = require("fs");
var path = require("path");

var visitors = require("react-tools/vendor/fbtransform/visitors");
var jstransform = require('jstransform');
var jsxI18n = require('jsx-i18n');

var outputDir = path.join(__dirname, "fixtures");
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

var inputDir = path.join(__dirname, "..", "test", "fixtures");
fs.readdirSync(inputDir).forEach(function(file) {
    if (fs.statSync(path.join(inputDir, file)).isDirectory()) {
        var inputPath = path.join(inputDir, file, "input.jsx");
        var options = { encoding: "utf-8" };
        
        var inputCode = fs.readFileSync(inputPath, options);
        var visitorList = jsxI18n.getVisitorList([
            "$_", "$i18nDoNotTranslate"
        ]).concat(visitors.getAllVisitors());
        var outputCode = jstransform.transform(visitorList, inputCode).code;
        var outputPath = path.join(outputDir, file);
        
        fs.writeFileSync(outputPath, outputCode, options);
    }
});

