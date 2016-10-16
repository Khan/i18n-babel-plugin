"use strict";

const assert = require("assert");
const babel = require("babel-core");
const fs = require("fs");
const path = require("path");

const whitelistWithReact = [
    'es6.arrowFunctions',
    'es6.blockScoping',
    'es6.classes',
    'es6.destructuring',
    'es6.parameters.rest',
    'es6.templateLiterals',
    'es6.spread',
    'es7.objectRestSpread',
    'react',
];

function compile(code) {
    return babel.transform(code, {
        plugins: ["../index.js"],
        retainLines: true,
        whitelist: whitelistWithReact,
    }).code;
}

function compileFile(file) {
    return babel.transformFileSync(file, {
        plugins: ["../index.js"],
        retainLines: true,
        whitelist: whitelistWithReact,
    }).code;
}

const fixturesDir = path.join(__dirname, "fixtures");
describe("i18n-babel-plugin", function() {
    describe("fixtures", function() {
        fs.readdirSync(fixturesDir).forEach(function(file) {
            if (fs.statSync(path.join(fixturesDir, file)).isDirectory()) {
                it(file, function() {
                    const actual = compileFile(
                        path.join(fixturesDir, file, "input.jsx")
                    );
                    const expected = fs.readFileSync(
                        path.join(fixturesDir, file, "expected.js"),
                        {encoding: "utf-8"}
                    );
                    assert.equal(actual + "\n", expected);
                });
            }
        });
    });

    describe("sanity checks", function() {
        it("should throw with mismatched tags", function() {
            assert.throws(function() {
                compile("<$_>hi</div>");
            });
        });
    });
});
