import { MappedRoute } from "types";

export type Router = {
    abortcontrollers: Set<AbortController>;
    cache: "session" | "local" | undefined;
    browser_url: string | undefined;
}

export async function fetchURL(url: string, route: MappedRoute, router: Router, printerror = true) {
    if (router.cache)
    {
        const item = window.localStorage.getItem(url);
        if (item)
        {
            const { type, content } = JSON.parse(item);
            return {
                content, response: {
                    ok: true, headers: {
                        get: (key: string) => {
                            return type;
                        }
                    }
                } as Response
            };
        }
    }

    const controller = new AbortController();
    let response, content;

    try
    {
        response = await fetch(url, {
            signal: controller.signal,
            referrer: route.request
        });
        router.abortcontrollers.add(controller);

        if (response.ok)
        {
            content = await response.text();
        }
        else if (printerror)
        {
            console.error('[router] fetching went wrong, status not 2xx', response.status, response.statusText);
        }
    }
    catch (e)
    {
        if (printerror)
        {
            console.error('[router] fetching went wrong', e);
        }
    }
    finally
    {
        router.abortcontrollers.delete(controller);
        if (router.cache && content && response && response.ok)
        {
            window.localStorage.setItem(url, JSON.stringify({
                content,
                type: response.headers.get('content-type')
            }));
        }
        return { content, response };
    }
}