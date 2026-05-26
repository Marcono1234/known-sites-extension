# integration-tests

Integration tests for the extension, implemented using [WebdriverIO](https://webdriver.io/).

These tests cover most of the scenarios described in the [Manual Testing guide](../Manual%20testing.md), however the manual tests should be executed nonetheless because some scenarios cannot be covered by automated integration tests, and because the integration tests cannot easily verify that the extension UI looks and works as expected.

This integration tests project is an independent project and is not part of the workspace to avoid any dependency conflicts with the extension dependencies.
This means:

- Dependencies here have to be installed separately, using `npm clean-install`
- Linting has a dedicated script here, `npm run lint`

## Running the tests

1. [Build the extension](../README.md#building)\
   (the integration tests use the built extension from the `../web-ext-artifacts` directory; make sure it only contains a single file)
2. Run `npm run wdio` (or alternatively only run [specific tests](https://webdriver.io/docs/organizingsuites/#run-selected-tests))

## Implementation notes

- The tests launch separate clean Firefox instances, install the extension and run tests\
  (Note: These instances should not affect your regular Firefox profile, but it has happened that they may erroneously trigger a Firefox update, which can cause issues for the regular Firefox instance if it is also currently running, requiring a restart of it.)
- The tests assume that the `en-US` locale is available for Firefox\
  (Other translations of the extension, currently the German one, are not tested at the moment because it would require that the Firefox installation also has the German language pack installed, which might not be easy to set up automatically.)
- Each file under [`specs`](./specs/) is a separate test spec which runs in a clean browser session
- Tests within the same spec share state, e.g. the extension will remember which websites are 'known'\
  (Sharing state between tests might be avoidable, but probably causes quite some overhead because it requires starting a new session for every test. For now try to work around it, see also the ["Writing tests" section](#writing-tests) below.)
- The integration tests use [Webdriver IO's `browser.mock`](https://webdriver.io/docs/api/browser/mock/) to avoid sending any requests to the 'blocked' or 'known' websites
- It seems the Firefox instance launched by WebdriverIO does not record browser history entries; even after a blocked website was opened by the extension, it does not appear in the browser history.
  Therefore the integration tests currently rely on the known websites cache of the extension (except for the tests which are [manually recording history entries](./specs/browser-history.ts)).
- A subset of all tests is additionally run in Firefox Private mode; in the WebdriverIO log it might not be immediately obvious which ones these are. It seems they are the `[1-...]` one, since the capabilities configuration for it is the second (index 1) in the [`wdio.conf.ts` file](./wdio.conf.ts).
- The [`wdio.conf.ts` file](./wdio.conf.ts) currently does not specify a `browserVersion`, therefore using any matching installed stable browser version (?).
  For the GitHub workflow this means it uses the Firefox version preinstalled in the runner image. In case of unexpected errors or mismatch to local test results, for a workflow run check its "Set up job" step and there the "Runner Image" details to find out the installed software in the image. Additionally have a look at the summary of the WebdriverIO run, which says something like "[firefox _\<version\>_ linux #0-0] Running: firefox (_\<version\>_) on linux".

## Writing tests

- Unless testing functionality of the Public Suffix List, use dummy domains with the [special-use TLD `.invalid`](https://en.wikipedia.org/wiki/.invalid)\
  (to ensure that if the test setup is broken and accidentally sends a real request to a website, it won't connect to real websites, and also to not be affected by their potential HTTP redirects)
- Tests within the same spec file share state, as mentioned in the ["Implementation notes" section](#implementation-notes) above.
  - If a test is expected to modify state, e.g. by opening a blocked website and therefore the extension remembering it as 'known', make sure the used domains are unique and no other test within the spec uses the same domain.
  - Tests within the same spec should close all additional tabs and windows they created, otherwise it might affect other tests in the spec.
