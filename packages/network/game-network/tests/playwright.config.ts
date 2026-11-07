import { Information, PackageGraph } from "@papit/information";
import { defineConfig, devices } from '@playwright/test';
import path from "node:path";

const dirname = path.join(PackageGraph.get("@papit/game-network").location, "tests");
// run the built bin directly: in CI `npm install` runs before signal-server's lib/ exists, so npm never links its bin
const signalServer = path.join(PackageGraph.get("@papit/signal-server").location, "lib", "bin.js");
// const relative = path.relative(Information.root.location, PackageGraph.get("@papit/web-component").location);

export default defineConfig({
    // Look for test files in the "tests" directory, relative to this configuration file.
    testDir: dirname,

    // Run all tests in parallel.
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code.
    forbidOnly: !!process.env.CI,

    // Retry on CI only.
    retries: 0,

    // Opt out of parallel tests on CI.
    workers: !!process.env.CI ? 1 : undefined,

    // reporter, with output path for HTML reports.
    reporter: [[
        !!process.env.CI ? "github" : "html",
        {
            open: "never",
            outputFolder: path.join(dirname, "test-reports"),
        }
    ]],

    outputDir: path.join(dirname, "test-results"),

    snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{testFilePath}/{arg}-{platform}{ext}',

    use: {
        // Base URL to use in actions like `await page.goto('/')`.
        baseURL: process.env.LOCATION ? `http://localhost:3500/${process.env.LOCATION}/` : 'http://localhost:3500/',

        // Collect trace when retrying the failed test.
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },


    expect: {
        toHaveScreenshot: {
            maxDiffPixels: 100,
            maxDiffPixelRatio: 0.2,
        },
    },
    testIgnore: process.env.SKIP_SNAPSHOTS === "true"
        ? ["**/snapshot.test.ts"]
        : [],

    // Configure projects for major browsers.
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    // running web-server before starting tests 
    webServer: [
        {
            command: 'npx @papit/server --serve --port=3500 --bundle',
            url: 'http://localhost:3500',
            reuseExistingServer: true,
            stdout: 'pipe',
            stderr: 'pipe'
        },
        {
            // a local signal server for the game tests (see tests/game-network/helpers.ts)
            command: `node ${signalServer} --port 3599 --no-push`,
            url: 'http://localhost:3599/health',
            reuseExistingServer: true,
            stdout: 'pipe',
            stderr: 'pipe'
        },
    ],
});