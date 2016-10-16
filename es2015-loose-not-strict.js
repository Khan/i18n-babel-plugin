// modified from https://github.com/bkonkle/babel-preset-es2015-loose/blob/master/index.js
/**
 * Modify the es2015 preset to use loose mode but not strict mode.
 *
 * Loose mode generates more concise and readable code at the expense of not
 * being quite as spec compliant.
 */
const modify = require('modify-babel-preset');

module.exports = modify('es2015', {
    'transform-es2015-template-literals': {loose: true},
    'transform-es2015-classes': {loose: true},
    'transform-es2015-computed-properties': {loose: true},
    'transform-es2015-for-of': {loose: true},
    'transform-es2015-spread': {loose: true},
    'transform-es2015-destructuring': {loose: true},
    'transform-es2015-modules-commonjs': {loose: true, strict : false},
});
