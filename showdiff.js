var showDiff = (function () {

    // takes a JSON patch and an original object, and produces a new patch
    // tailored for producing output
    function formatPatch(patch, orig) {

        // First go through the patch and find any array operations.
        // If there are consecutive removes on the same array, the indices
        // must be adjusted since we won't remove anything.
        var ordered_patch = [], paths = {};
        for (var i = 0; i < patch.length; i++) {
            var p = patch[i];
            console.log(i, patch);
            switch (p.op) {
            case "add":
                var splitpath = p.path.split("/"),
                index = splitpath.slice(-1)[0];
                console.log(p, splitpath);
                if (!isNaN(index)) {
                    index = parseInt(index);
                    var path = p.path.split("/").slice(0, -1).join("/") || "/";
                    if (!paths[path])
                        paths[path] = [];
                    paths[path].push(p);
                }
                break;
            case "remove":
                var splitpath = p.path.split("/"),
                index = splitpath.slice(-1)[0];
                console.log(p, splitpath);
                if (!isNaN(index)) {
                    index = parseInt(index);
                    var path = p.path.split("/").slice(0, -1).join("/") || "/";
                    if (!paths[path])
                        paths[path] = [];
                    paths[path].push(p);
                }
                break;
            case "move":
                // cheat by replacing move by remove+add :(
                var remove = {op: "remove", path: p.from},
                ptr = new jsonpatch.JSONPointer(p.from),
                value = ptr.get(orig),
                add = {op: "add", path: p.path, value: value};
                patch.splice(i+1, 0, remove, add);
            }
        }

        // Then go through the array patches and adjust indices
        Object.keys(paths).forEach(function (path) {
            var count = 0;
            paths[path].forEach(function (p) {
                console.log(p);
                var splitpath = p.path.split("/"),
                    index = splitpath.slice(-1)[0],
                    i = parseInt(index);
                p.path = splitpath.slice(0, -1).join("/") + "/" + (i + count);
                if (p.op == "remove")
                    count++;
            })
        })

        function isEmpty(obj) {
            return Object.keys(obj).length === 0;
        }

        // Now go throuch the patch again and make a new one where the operations
        // are replaced with ones that produce nice output instead
        var new_patch = [];
        patch.forEach(function (p) {
            var newp = {};
            switch (p.op) {
            case "add":
                newp.op = "add";
                newp.path = p.path;
                newp.value = '<span class="patch add">' + prettyPrint(null, p.value).innerHTML + '</span>';
                break;
            case "remove":
                newp.op = "replace";
                newp.path = p.path;
                var ptr = new jsonpatch.JSONPointer(p.path);
                var value = ptr.get(orig);
                newp.value = '<span class="patch remove">' + prettyPrint(null, value).innerHTML + '</span>';
                break;
            case "replace":
                newp.op = "replace";
                newp.path = p.path;
                var ptr = new jsonpatch.JSONPointer(p.path);
                var old_value = ptr.get(orig);
                newp.value = ('<span class="patch replace">' +
                              '<span class="remove">' + prettyPrint(null, old_value).innerHTML + "</span> &#8594; " +
                              '<span class="add">' + prettyPrint(null, p.value).innerHTML + '</span>');
            }
            if (!isEmpty(newp)) {
                new_patch.push(newp);
                // need to update the original each time so that later pointers are correct
                orig = jsonpatch.apply_patch(orig, [newp]);
            }
        });
        return new_patch;
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
            if (tmp.firstChild.classList)
                tmp = tmp.firstChild;
            element.appendChild(tmp);
            return tmp;
        }
        return element;
    }


    function showDiff(element, patch, original) {
        var newpatch = formatPatch(patch, original),
            result = jsonpatch.apply_patch(original, newpatch);
        prettyPrint(element, result);
    };

    return showDiff;

})();
