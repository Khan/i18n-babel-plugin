"use strict";

module.exports = function(babel) {
    // babel.types is used to create new AST nodes
    const t = babel.types;

    /**
     * Concatenates an array of string Literal nodes by creating a tree where
     * BinaryExpressions are used to join them together.  If there is only one
     * string in the array, that string Literal is returned.
     *
     * e.g. strings = ['apple', 'banana', 'cherry'] will produce
     * {
     *   type: "BinaryExpression",
     *   left: {
     *     type: "BinaryExpression",
     *     left: {
     *       type: "Literal",
     *       value: "apple"
     *     },
     *     right: {
     *       type: "Literal",
     *       value: "banana"
     *     }
     *   },
     *   right: {
     *     type: "Literal",
     *     value: "cherry"
     *   }
     * }
     *
     * @param {Array<Literal>} strings
     * @returns {BinaryExpression|Literal}
     */
    const concatStrings = function(strings) {
        if (strings.length === 1) {
            return strings[0];
        }

        // Note: it appears that babel's parser doesn't split string Literals
        // that are children of JSXElements.  This means that this code should
        // never get executed.  The rationale for leaving this code in, is to
        // guard against changes in parser behavior.
        const expression = strings.reduce(
            function(previous, current) {
                return t.binaryExpression("+", previous, current);
            }
        );

        expression.loc = {
            start: strings[0].loc.start,
            end: strings[strings.length - 1].loc.end,
        };

        return expression;
    };

    /**
     * Removes any extra spaces introduced into a string by a linefeed and any
     * extra whitespace surrounding it.
     *
     * See test/fixtures/i18n-line-feed for test cases.
     * Note: turn on "show whitespace" in your editor
     *
     * @param {string} string
     * @returns {string}
     */
    const fixWhitespace = function(string) {
        return string
            // remove any whitespace containing a linefeed from the start
            .replace(/^\s*\n\s*/, "")

            // remove any whitespace containing a linefeed from the end
            .replace(/\s*\n\s*$/, "")

            // replace any whitespace containing a linefeed in the middle of
            // the string with a single space
            .replace(/\s*\n\s*/g, " ");
    };

    /**
     * Extracts line number and column information from the node and prints
     * a warning message to stderr.  If the babel.transform() is being used
     * then the filename will be "undefined".  Use babel.transformFile() or
     * babel.transformFileSync() to get full error reporting when working with
     * files.
     *
     * @param {File} file
     * @param {Node} node
     * @param {String} message
     */
    const printWarning = function(file, node, message) {
        const line = node.loc.start.line;
        const column = node.loc.start.column;
        const filename = file.opts.filename.replace(__dirname, "");
        const location = filename + "@" + line + ":" + column;
        console.warn("WARNING: " + location + " " + message); // @Nolint
    };

    /**
     * This is the babel transformer plugin itself.  It transforms JSXElements
     * <$_></$_> and <$i18nDoNotTranslate></$i18nDoNotTranslate> into function
     * calls.
     *
     * e.g.
     *  <$_ first="Motoko" last="Kusanagi">
     *      Hello, %(first)s %(last)s!
     *  </$_>
     *
     * is transformed into:
     *  $_({first: "Motoko", last: "Kusanagi"}, "Hello, %(first)s %(last)s!")
     *
     * Plugins are implemented using the visitor pattern.  For more details
     * see: http://babeljs.io/docs/advanced/plugins/
     */
    return {
        visitor: {
            /**
             * Process JSXElement on entering the node.  It replaces the node
             * with a CallExpression representing the output of the transform
             * described above.
             *
             * Note: Doing the processing when entering the node won't handle
             * nested i18n tags, e.g. <$_><$_>inner</$_></$_>.
             * TODO(kevinb) create eslint plugin to lint against this
             *
             * @param path
             * @returns {CallExpression}
             *
             * For more information about path objects see:
             * https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md#paths
             */
            JSXElement: function(path) {
                const node = path.node;
                const openName = node.openingElement.name.name;

                const tagNames = ["$_", "$i18nDoNotTranslate"];
                for (let i = 0; i < tagNames.length; i++) {
                    const tagName = tagNames[i];
                    if (openName === tagName) {
                        // Remove empty tags and warn
                        if (node.children.length === 0) {
                            const message =  `<${tagName}> has no children`;
                            printWarning(this.file, node, message);
                        }

                        // Handle attributes if they exist
                        let options = t.nullLiteral();
                        const attributes = node.openingElement.attributes;
                        if (attributes.length > 0) {
                            const properties = attributes.map(function(attr) {
                                // JSXIdentifier
                                const key = attr.name;

                                // JSXExpressionContainer
                                const value = attr.value;

                                return t.objectProperty(
                                    t.identifier(key.name), value.expression);
                            });
                            options = t.objectExpression(properties);
                        }

                        // The node.children array can contain the following
                        // nodes:
                        // - JSXText
                        // - JSXExpressionContainer
                        // - JSXElement
                        //
                        // Although it's valid jsx syntax for JSXElements to
                        // appear within the i18n tags, they shouldn't because
                        // it doesn't make sense to translate an element.
                        //
                        // This code handles multiple children within the an
                        // i18n tag by appending them to the args array, but
                        // only the first child is actually used by either $_()
                        // or $i18nDoNotTranslate() because these methods only
                        // take two args: options and str.
                        const args = [options];
                        let strings = [];
                        node.children.forEach(function(child, i) {
                            if (t.isJSXText(child)) {
                                const string = fixWhitespace(child.value);
                                if (string !== "") {
                                    strings.push(t.stringLiteral(string));
                                }
                            } else if (t.isJSXExpressionContainer(child)) {
                                if (t.isJSXEmptyExpression(child.expression)) {
                                    // TODO(kevinb) don't worry about comments?
                                    // This could clobber existing comments.
                                    args[args.length - 1].trailingComments =
                                        child.innerComments;
                                } else {
                                    if (strings.length > 0) {
                                        args.push(concatStrings(strings));
                                        strings = [];
                                    }
                                    // This copies the jsxtransformer plugin's
                                    // behavior, but should probably strign
                                    // concatenate it with the rest of the
                                    // strings.
                                    args.push(child.expression);
                                }
                            } else if (strings.length > 0) {
                                args.push(concatStrings(strings));
                                strings = [];
                            } else {
                                // TODO(kevinb) check if we hit this case for
                                // any of the webapp code
                                args.push(child);
                            }
                        });

                        // Take care of any remaining strings.
                        if (strings.length > 0) {
                            args.push(concatStrings(strings));
                        }

                        // create the function call to either $_() or
                        // $i18nDoNotTranslate()
                        const callee = t.identifier(tagName);
                        const call = t.callExpression(callee, args);

                        // set the source code location of the new node so that
                        // it appears on the same line
                        call.loc = node.loc;

                        // https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md#replacing-a-node
                        path.replaceWith(call);
                    }
                }
            },
        },
    };
};
