var assert = require("assert");
var babel = require("babel-core");
var fs = require("fs");
var path = require("path");

var whitelist_with_react = [
    'es6.arrowFunctions',
    'es6.blockScoping',
    'es6.classes',
    'es6.destructuring',
    'es6.parameters.rest',
    'es6.templateLiterals',
    'es6.spread',
    'es7.objectRestSpread',
    'react'
];

function compile(code) {
    return babel.transform(code, {
        plugins: ["../index.js"],
        retainLines: true,
        whitelist: whitelist_with_react
    }).code;
}

function compileFile(file) {
    return babel.transformFileSync(file, {
        plugins: ["../index.js"],
        retainLines: true,
        whitelist: whitelist_with_react
    }).code;
}

var fixturesDir = path.join(__dirname, "fixtures");
describe("i18n-babel-plugin", function () {
    describe("fixtures", function () {
        fs.readdirSync(fixturesDir).forEach(function(file) {
            if (fs.statSync(path.join(fixturesDir, file)).isDirectory()) {
                it(file, function () {
                    var actual = compileFile(
                        path.join(fixturesDir, file, "input.jsx")
                    );
                    var expected = fs.readFileSync(
                        path.join(fixturesDir, file, "expected.js"),
                        { encoding: "utf-8" }
                    );
                    assert.equal(actual + "\n", expected);
                }); 
            } 
        });
    });
    
    describe("sanity checks", function () {
        it("should throw with mismatched tags", function () {
            assert.throws(function () {
                compile("<$_>hi</div>");
            });
        });
    });
});
