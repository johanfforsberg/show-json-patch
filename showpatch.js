var showPatch = (function () {

    function isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    function isPointerToArray(path, data) {
        return (new jsonpatch.JSONPointer(path)).get(data) instanceof Array;
    }

    // takes a JSON patch and an original object, and produces a new patch
    // tailored for producing output
    function formatPatch(patch, orig) {

        // First go through the patch and find any array operations.
        // If there are consecutive removes on the same array, the indices
        // must be adjusted since we won't remove anything.
        var new_patch = [], paths = {}, index, p2, splitpath, path, parent;
        patch.forEach(function (p, i) {
            switch (p.op) {
            case "add":
                splitpath = p.path.split("/");
                path = splitpath.slice(0, -1).join("/") || "/";
                p2 = {op: p.op, path: p.path, value: p.value};
                if (isPointerToArray(path, orig)) {
                    if (!paths[path])
                        paths[path] = [];
                    paths[path].push(p2);
                }
                new_patch.push(p2);
                break;
            case "remove":
                splitpath = p.path.split("/");
                path = splitpath.slice(0, -1).join("/") || "/";
                p2 = {op: p.op, path: p.path};
                if (isPointerToArray(path, orig)) {
                    if (!paths[path])
                        paths[path] = [];
                    paths[path].push(p2);
                }
                new_patch.push(p2);
                break;
            case "move":
                // cheat by replacing move by remove+add :(
                var remove = {op: "remove", path: p.from},
                    ptr = new jsonpatch.JSONPointer(p.from),
                    value = ptr.get(orig),
                    add = {op: "add", path: p.path, value: value};
                new_patch.push(remove, add);
                break;
            case "replace":
                p2 = {op: p.op, path: p.path, value: p.value};
                new_patch.push(p2);
                break;
            }
            // TODO: cover "copy" operation too
        });

        // Then go through the array related patches and adjust indices
        // (Not sure this is really correct for all cases...)
        Object.keys(paths).forEach(function (path) {
            var removals = [], additions = [];
            paths[path].forEach(function (p) {
                var splitpath = p.path.split("/"),
                    index = splitpath.slice(-1)[0],
                    i = parseInt(index);
                var adjustment = 0;
                // The idea here is to only take into account any operations on the
                // part before the index this operation works at. I *think* that's
                // how JSON-patch is supposed to work, though I didn't really find
                // documentation that details this.
                removals.forEach(function (r) {
                    if (r <= i + adjustment)
                        adjustment++;
                });
                additions.forEach(function (r) {
                    if (r <= i + adjustment)
                        adjustment++;
                });                
                p.path = splitpath.slice(0, -1).join("/") + "/" + (i + adjustment);
                if (p.op == "remove") {
                    removals.push(i);
                }                
                if (p.op == "add") {
                    additions.push(i);
                }                
            });
        });

        // Now go throuch the patch again and make a new one where the operations
        // are replaced with ones that produce nice output instead
        var new_patch2 = [];
        new_patch.forEach(function (p) {
            var newp = {}, ptr, value, old_value;
            switch (p.op) {
            case "add":
                newp = {
                    op: "add", path: p.path,
                    value: ('<span class="patch add">' +
                            prettyPrint(null, p.value).innerHTML + '</span>')
                };
                break;
            case "remove":
                ptr = new jsonpatch.JSONPointer(p.path);
                value = ptr.get(orig);
                newp = {
                    op: "replace",
                    path: p.path,
                    value: ('<span class="patch remove">' +
                            prettyPrint(null, value).innerHTML + '</span>')
                };
                break;
            case "replace":
                ptr = new jsonpatch.JSONPointer(p.path);
                old_value = ptr.get(orig);
                newp = {
                    op: "replace",
                    path: p.path,
                    value: ('<span class="patch replace">' +
                            '<span class="remove">' +
                            prettyPrint(null, old_value).innerHTML +
                            '</span> &#8594; <span class="add">' +
                            prettyPrint(null, p.value).innerHTML + '</span>')
                };
            }
            if (!isEmpty(newp)) {
                new_patch2.push(newp);
                // need to update the original each time so that later
                // pointers are correct
                orig = jsonpatch.apply_patch(orig, [newp]);
            }
        });
        return new_patch2;
    }

    // output DOM representation of patched object
    function prettyPrint(element, obj) {
        element = element || document.createElement("span");
        if (obj instanceof Array) {
            var key_el = document.createElement("span");
            key_el.classList.add("open");
            key_el.innerHTML = "[";
            element.appendChild(key_el);
            obj.forEach(function (o) {
                var value_el = document.createElement("div");
                value_el.classList.add("item");
                key_el.appendChild(value_el);
                prettyPrint(value_el, o);
            });
            key_el = document.createElement("span");
            key_el.innerHTML = "]";
            element.appendChild(key_el);
        } else if (obj instanceof Object) {
            var open_el = document.createElement("span");
            open_el.classList.add("open");
            open_el.innerHTML = "{";
            element.appendChild(open_el);

            var item_el = document.createElement("div");
            item_el.classList.add("item");
            open_el.appendChild(item_el);

            Object.keys(obj).forEach(function (key) {
                var wrap_el = document.createElement("div");
                var key_el = document.createElement("span");
                key_el.classList.add("key");
                key_el.innerHTML = key + ": ";
                item_el.appendChild(wrap_el);
                wrap_el.appendChild(key_el);

                var res = prettyPrint(wrap_el, obj[key]);
                if (res.classList) {
                    if(res.classList.contains("add"))
                        key_el.classList.add("add");
                    if(res.classList.contains("remove"))
                        key_el.classList.add("remove");
                    if(res.classList.contains("replace"))
                        key_el.classList.add("replace");
                }
            });
            var close_el = document.createElement("span");
            close_el.classList.add("close");
            close_el.innerHTML = "}";
            element.appendChild(close_el);
        } else {
            var tmp = document.createElement("span");
            tmp.innerHTML = obj;
            if (tmp.firstChild && tmp.firstChild.classList)
                tmp = tmp.firstChild;
            element.appendChild(tmp);
            return tmp;
        }
        return element;
    }

    return function (element, original, patch) {
        patch = patch || [];
        var formatted_patch = formatPatch(patch, original),
            result = jsonpatch.apply_patch(original, formatted_patch);
        prettyPrint(element, result);
    };

})();
