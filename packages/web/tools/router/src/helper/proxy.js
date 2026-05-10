export function proxy(router) {
    let _document = null;

    function addwindowload(value) {
        load_document();
        if (router) // allow fallback
        {
            function _load_event(e) {
                value(e);
                // apply clear after loaded
                router.addEventListener("window-clear", () => {
                    router.removeEventListener("window-load", _load_event);
                });
            }

            router.addEventListener("window-load", _load_event);
            return true;
        }

        console.warn('router not defined onload could not set');
        return false;
    }
    function load_document(withError = true) {
        if (!_document)
        {
            _document = router.shadowRoot;
        }

        if (!_document && withError)
        {
            // at this point we give up 
            throw new Error("could not establish proxy document");
        }
    }

    const location_proxy = new Proxy(window.location, {
        get: (target, key) => {
            if (key === "route" || key === "params")
            {
                load_document();
                if (typeof target[key] === "object")
                {
                    return {
                        ...target[key],
                        ...router.params
                    }
                }

                return router.params;
            }
            return target[key];
        }
    });

    const document_proxy = new Proxy(window.document, {
        get: (target, key) => {
            switch (key)
            {
                case "querySelector":
                case "querySelectorAll":
                    load_document();
                    return (original_query) => {
                        const modified_query = original_query.replaceAll("body", "#router-body");
                        let result = _document[key](modified_query);
                        if (result) return result;

                        // should not really happen but in one of view scripts I was referencing to the 
                        // need to fallback to document + original_query
                        return target[key](original_query);
                    }
                case "getElementById":
                case "getElementsByClassName":
                case "getElementsByName":
                case "getElementsByTagName":
                case "getElementsByTagNameNS":
                    load_document();
                    return _document[key].bind(_document);

                case "body":
                case "documentElement":
                    load_document();
                    return _document;

                default:
                    return target[key];
            }
        }
    });

    window[`proxy_${router.safeUUID}`] = new Proxy(window, {
        get: (target, key) => {
            switch (key)
            {
                case "document":
                    return document_proxy;
                case "location":
                    return location_proxy;
                case "addEventListener":
                    // truicky case as the moment we return another function we also need to actually listen to the event for fallback cases...
                    return (eventname, ...args) => {
                        if (eventname === "load")
                        {
                            addwindowload(args[0]);
                        }
                        else
                        {
                            target.addEventListener(eventname, ...args)
                        }
                    }

                default:
                    return target[key];
            }
        },
        set(target, key, value) {
            switch (key)
            {
                case "onload":
                    if (addwindowload(value)) break;

                default:
                    target[key] = value;
            }

            return true;
        }
    });
}