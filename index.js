module.exports = function (babel) {
    // babel.types is used to create new AST nodes
    var t = babel.types;

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
    var concatStrings = function (strings) {
        if (strings.length === 1) {
            return strings[0];
        }
        
        // Note: it appears that babel's parser doesn't split string Literals
        // that are children of JSXElements.  This means that this code should
        // never get executed.  The rationale for leaving this code in, is to 
        // guard against changes in parser behavior.
        var expression = strings.reduce(
            function (previous, current) {
                return t.binaryExpression("+", previous, current);
            }
        );
        
        expression.loc = {
            start: strings[0].loc.start,
            end: strings[strings.length - 1].loc.end
        };
        
        return expression;
    };

    /**
     * The purpose fixWhitespace is to remove any extra spaces introduced into
     * a string by a linefeed and any extra whitespace surrounding it.
     * 
     * See test/fixtures/i18n-line-feed for test cases.
     * Note: turn on "show whitespace" in your editor
     * 
     * @param {Literal} string
     * @returns {Literal}
     */
    var fixWhitespace = function (string) {
        var value = string.value;

        // remove any whitespace containing a linefeed from the start
        value = value.replace(/^\s*\n\s*/, "");

        // remove any whitespace containing a linefeed from the end
        value = value.replace(/\s*\n\s*$/, "");

        // replace any whitespace containing a linefeed in the middle of the
        // string with a single space
        value = value.replace(/\s*\n\s*/g, " ");

        string.value = value;
        return string;
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
    var printWarning = function (file, node, message) {
        var line = node.loc.start.line;
        var column = node.loc.start.column;
        var filename = file.opts.filename.replace(__dirname, "");
        var location = filename + "@" + line + ":" + column;
        console.warn("WARNING: " + location + " " + message);
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
    return new babel.Transformer("i18n-plugin", {
        /**
         * Process JSXElement on entering the node.  It replaces the node
         * with a CallExpression representing the output of the transform
         * described above.
         * 
         * Note: Doing the processing when entering the node won't handle
         * nested i18n tags, e.g. <$_><$_>inner</$_></$_>.
         * TODO(kevinb) create eslint plugin to lint against this
         * 
         * @param {JSXElement} node
         * @param {Node} parent
         * @param {Scope} scope
         * @param {File} file
         * @returns {CallExpression}
         */
        JSXElement: function (node, parent, scope, file) {
            var openName = node.openingElement.name.name;

            var tagNames = ["$_", "$i18nDoNotTranslate"];
            for (var i = 0; i < tagNames.length; i++) {
                var tagName = tagNames[i];
                if (openName === tagName) {
                    // Remove empty tags and warn
                    if (node.children.length === 0) {
                        var message =  "<" + tagName + "> has no children";
                        printWarning(file, node, message);
                    }
                    
                    // Handle attributes if they exist
                    var options = t.literal(null);
                    var attributes = node.openingElement.attributes;
                    if (attributes.length > 0) {
                        var properties = attributes.map(function (attr) {
                            var kind = "init";
                            var key = attr.name;
                            var value = attr.value;
                            return t.property(kind, key, value);
                        });
                        options = t.objectExpression(properties);
                    }

                    // The node.children array can contain the following nodes:
                    // - Literal (can only be a string)
                    // - JSXExpressionContainer
                    // - JSXElement
                    //
                    // Although it's valid jsx syntax for JSXElements to 
                    // appear within the i18n tags, they shouldn't because it
                    // doesn't make sense to translate an element.
                    // TODO(kevinb) create eslint plugin to lint against this
                    //
                    // This code handles multiple children within the an i18n 
                    // tag by appending them to the args array, but only the 
                    // first child is actually used by either $_() or 
                    // $i18nDoNotTranslate() because these methods only take 
                    // two args: options and str.
                    var args = [options];
                    var strings = [];
                    var string;
                    node.children.forEach(function (child) {
                        if (child.type === "Literal") {
                            string = fixWhitespace(child);
                            if (string.value !== "") {
                                strings.push(string);
                            }
                        } else if (child.type === "JSXExpressionContainer" &&
                            child.expression.type === "JSXEmptyExpression") {
                            // ignore contents such as <$_>{/* foo */}</$_>
                        } else {
                            if (strings.length > 0) {
                                args.push(concatStrings(strings));
                                strings = [];
                            }
                            args.push(child);
                        }
                    });
                    if (strings.length > 0) {
                        args.push(concatStrings(strings));
                    }

                    // create the function call to either $_() or
                    // $i18nDoNotTranslate()
                    var callee = t.identifier(tagName);
                    var call = t.callExpression(callee, args);

                    // set the source code location of the new node so that it
                    // appears on the same line
                    call.loc = node.loc;
                    return call;
                }
            }
        }
    });
};
