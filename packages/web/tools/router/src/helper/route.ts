import type { Router } from "component";
import type { Route, Param, MappedRoute } from "types";

import { deepClone } from "./utils";
import { assign, extract as extract_params, ParamRegex } from "./param";
import { join, format } from "./url";


/**
 * This function is used when url is changed and will give a target route back, 
 * if match it would also update the params if theres overalap 
 * @param url string
 * @param routes Route[]
 * @returns Route or null
 */
export function intermediate(url: string | undefined, routes: Route[]): Route | null {
    if (!url) return null;

    const route: Route = {
        url,
        reroute: [url],
        params: {},
    }

    let targetroute: Route | undefined = undefined;
    let urlparam: Record<string, string> = {};
    const urlsplit = url.split("/");

    for (let r of routes)
    {

        if (route.url === r.url)
        {
            targetroute = r;
            break;
        }

        const routesplit = r.url.split("/");
        if (routesplit.length !== urlsplit.length) continue; // sanity check

        let notsame = false;
        urlparam = {};
        for (let i = 0; i < routesplit.length; i++)
        {
            if (urlsplit[i] === routesplit[i]) continue;
            if (routesplit[i].startsWith(":"))
            {
                urlparam[routesplit[i].slice(1)] = urlsplit[i];
                continue; // only route can have :var to match, if url has its dynamic and will not reflect route specifications 
            }

            // not same 
            notsame = true;
            break;
        }

        if (notsame) continue;
        targetroute = r;
        break;
    }

    if (targetroute)
    {
        // first lets assign all we can 
        route.url = targetroute.url;
        route.reroute = deepClone<string[]>(targetroute.reroute);
        route.params = deepClone<Record<string, Param>>(targetroute.params);

        for (let name in urlparam)
        {
            const p = route.params[name];
            if (!p)
            {
                continue;
            }
            if (p.default)
            {
                p.fallback = [p.default].concat(p.fallback);
            }
            p.default = urlparam[name];
        }
    }

    return route;
}

type Variable = { name: string, options: string[] };
type Output = Record<string, string>;

export function* candidateGenerator(route: Route, browser_url: string, router: Router): Generator<MappedRoute> {
    const urlmatch = route.url.match(ParamRegex);
    const urlvariables: Record<string, string[]> = {};
    if (urlmatch)
    {
        for (let name of urlmatch)
        {
            urlvariables[name] = [];
            if (route.params[name]?.default) urlvariables[name].push(route.params[name].default);
            if (route.params[name]?.fallback) urlvariables[name].push(...route.params[name].fallback);
        }
    }

    for (let request of route.reroute)
    {

        const requestmatch = request.match(ParamRegex);
        const variablemap = { ...urlvariables };
        if (requestmatch)
        {
            for (let name of requestmatch)
            {
                if (variablemap[name]) continue;

                variablemap[name] = [];
                if (route.params[name]?.default) variablemap[name].push(route.params[name].default);
                if (route.params[name]?.fallback) variablemap[name].push(...route.params[name].fallback);
            }
        }

        const variables = Object.keys(variablemap).map(name => ({ name, options: variablemap[name] }));
        // should populate variables with atleast one to have the outputs 
        if (variables.length === 0) variables.push({ name: 'if-you-can-see-me-something-went-terrible-wrong', options: ['if-you-can-see-me-something-went-terrible-wrong'] })
        const gen = generateCombinations(variables);

        for (let output of gen)
        {
            let copy = request;
            let browser = route.url;

            const params: Record<string, string> = {};
            for (let variable in output)
            {
                if (variable === "if-you-can-see-me-something-went-terrible-wrong") continue;
                params[variable] = output[variable];
                copy = copy.replace(":" + variable, output[variable]);
                browser = browser.replace(":" + variable, output[variable]);
            }

            yield {
                url: route.url,
                browser: format(join(browser_url, router.hashbased ? "#" : "", assign(browser, params)), router.trailingslash),
                request: format(join(browser_url, assign(copy, params)), true),
                params, // assign will also affect param to its latest value (if param-value is dynamic aka another variable)
            };
        }
    }
}
function* generateCombinations(variables: Variable[] | undefined, i: number = 0, currentOutput: Output = {}): Generator<Output> {
    if (variables === undefined) return {};

    if (i >= variables.length)
    {
        // Base case: If we've reached the end of the variables, yield the current output
        yield { ...currentOutput };
    } else
    {
        // Recursive case: Iterate over each option for the current variable
        const variable = variables[i];
        for (const option of variable.options)
        {
            currentOutput[variable.name] = option;
            // Recursively generate combinations for the next variable
            yield* generateCombinations(variables, i + 1, currentOutput);
        }
    }
}

type ExtractRoute = {
    url: string;
    reroute: Record<string, string>;
    params: Record<string, {
        default: undefined | string;
        fallback: Record<string, string>
    }>;
}

export function extract(element: Element): Route | null {
    const url = element.getAttribute("url") || element.getAttribute("path") || element.getAttribute("route");
    if (!url) return null;

    const reroutes_attr = element.getAttribute("reroute") || element.getAttribute("realpath");

    const route: ExtractRoute = {
        url,
        reroute: {},
        params: {}
    }

    // extract all params from path 
    extract_params_into(route.url, route);


    if (reroutes_attr)
    {
        route.reroute["0" + reroutes_attr] = reroutes_attr;
        extract_params_into(reroutes_attr, route);
    }
    else
    {
        route.reroute["0" + url] = url;
    }

    for (let i = 0; i < element.attributes.length; i++)
    {
        const a = element.attributes.item(i);
        if (!a) continue;
        if (["url", "path", "route", "reroute", "realpath"].includes(a.name)) continue;

        // REALPATH checks 
        if (a.name.startsWith("reroute-fallback") || a.name.startsWith("realpath-fallback"))
        {
            route.reroute[a.name.endsWith("fallback") ? "00" : "000" + a.name] = a.value;
            extract_params_into(a.value, route);
            continue;
        }

        // PARAM checks
        const param_match = a.name.match(/.*(-fallback(-\d+)?)$/);
        if (param_match)
        {
            const name = a.name.slice(0, a.name.length - param_match[1].length);
            if (!route.params[name]) route.params[name] = { default: undefined, fallback: {} }
            route.params[name].fallback[a.name] = a.value;
            continue;
        }

        // else we just take all as params.. 
        if (a.value)
        {
            if (!route.params[a.name])
            {
                route.params[a.name] = {
                    default: undefined,
                    fallback: {}
                }
            }
            route.params[a.name].default = a.value;
        }
    }

    const params: Record<string, Param> = {};
    for (let param in route.params)
    {
        params[param] = {
            default: route.params[param].default,
            fallback: Object.values(route.params[param].fallback),
        }
    }

    return {
        url,
        reroute: Object.values(route.reroute),
        params,
    }
}

function extract_params_into(url: string, route: ExtractRoute) {
    const urlparams = extract_params(url);

    urlparams.forEach(name => {
        if (!route.params[name]) route.params[name] = {
            default: undefined,
            fallback: {},
        }
    });
}