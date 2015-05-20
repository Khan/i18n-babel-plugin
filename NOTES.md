# Notes

- babel-core 5.4.5 fixed issue CallExpression formatting w/ retainLine option so
  that calls with 3 or more arguments could appear on the same line if necessary.
- babel-core 5.4.6 fixed an issue where FunctionExpression identifiers were
  shadowing global identifiers such as 'setTimeout'.  In certain circumstances
  this would cause the local function to be called instead of the global one 
  leading to either an infinite loop or something being undefined on `this`.
- es6.classes transformer by itself will generate code containing the ES6
  keyword `let`.  In order to ensure that the output code is ES5 only,
  es6.blockScoping must also be included in the whitelist.
  