This is a small javascript utility for visualizing a JSON Patch (RFC 6902). It takes a DOM element, a patch, and the original object to be patched as arguments, and produces a colored representation of what the patch does into the element given.

There are no options, but the output can be customized a bit using CSS. See index.html for an example of use.

Requires the included "jsonpatch.js" library from http://jsonpatchjs.com/

Caveats:

- Not very well tested, there are likely corner cases where the behavior is wrong.

- Cheats a bit in that the "move" operation is shown simply as a "remove" followed by an "add".

- Currently does not support the "copy" operation, although that should be easily emulated using "add".

Use is permitted under the BSD license.
