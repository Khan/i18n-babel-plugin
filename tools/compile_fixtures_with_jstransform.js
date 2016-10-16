/**
 * The purpose of this file is compile the test fixtures with jstransform
 * so that we can compare the output and make sure it's acceptable.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const visitors = require("react-tools/vendor/fbtransform/visitors");
const jstransform = require('jstransform');
const jsxI18n = require('jsx-i18n');

const outputDir = path.join(__dirname, "fixtures");
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const inputDir = path.join(__dirname, "..", "test", "fixtures");
fs.readdirSync(inputDir).forEach(function(file) {
    if (fs.statSync(path.join(inputDir, file)).isDirectory()) {
        const inputPath = path.join(inputDir, file, "input.jsx");
        const options = {encoding: "utf-8"};

        const inputCode = fs.readFileSync(inputPath, options);
        const visitorList = jsxI18n.getVisitorList([
            "$_",
            "$i18nDoNotTranslate",
        ]).concat(visitors.getAllVisitors());
        const outputCode = jstransform.transform(visitorList, inputCode).code;
        const outputPath = path.join(outputDir, file);

        fs.writeFileSync(outputPath, outputCode, options);
    }
});
