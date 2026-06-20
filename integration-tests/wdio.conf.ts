import url from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { download as downloadGeckodriver } from 'geckodriver'

import DummyHttpServerService from './services/dummy-http-server.ts'

// See also https://webdriver.io/docs/extension-testing/web-extensions/#firefox
async function getExtensionFilePath(): Promise<string> {
  const extensionsDir = url.fileURLToPath(
    new URL('../web-ext-artifacts', import.meta.url),
  )
  const extensionsFiles = await Array.fromAsync(
    fs.glob('known_sites-*.zip', {
      cwd: extensionsDir,
    }),
  )
  if (extensionsFiles.length !== 1) {
    throw Error(
      `expected one extension file, found: ${extensionsFiles.toString()}`,
    )
  }
  return path.join(extensionsDir, extensionsFiles[0])
}

// Note: This is rather brittle; if this breaks for newer Firefox versions remove this
// and the corresponding Private mode capabilities test setup
async function enableExtensionForPrivateMode() {
  await browser.url('about:addons')
  // Open extensions tab
  await $('button[viewid="addons://list/extension"]').click()
  // Expand extension settings
  const addonId = 'known-sites@marcono1234.invalid'
  // Note: Select child `div` here because `addon-card` itself is apparently not clickable?
  await $(`addon-card[addon-id="${addonId}"] div:first-child`).click()
  // Allow running in private mode
  await $(
    `addon-card[addon-id="${addonId}"] span[data-l10n-id="addon-detail-private-browsing-allow"]`,
  ).click()

  // Set up new tab to not affect extension navigation
  await setUpNewTab()
}

async function installExtension(capabilities: WebdriverIO.Capabilities) {
  const browserName = capabilities.browserName
  if (browserName === 'firefox') {
    const extensionFilePath = await getExtensionFilePath()
    const extension = await fs.readFile(extensionFilePath)
    await browser.installAddOn(extension.toString('base64'), true)
  } else {
    // Could probably support other browsers as well (see also WebdriverIO docs), but
    // currently this extension is mainly developed for Firefox
    throw new Error(`cannot install extension for browser '${browserName}'`)
  }

  await enableExtensionForPrivateMode()
}

/**
 * Sets up a new browser tab.
 *
 * The extension shows a "Go back" / "Close tab" button depending on whether the current tab
 * has previous history entries; therefore use a new tab for every test.
 * Ideally would use `browser.reloadSession()` to avoid tests affecting each other (e.g.
 * regarding whether a website is 'known'), however as mentioned by the documentation
 * `reloadSession` this has quite some overhead, and would also require reinstalling the
 * extension every time.
 */
async function setUpNewTab() {
  const oldWindow = await browser.getWindowHandle()
  const tabHandle = (await browser.createWindow('tab')).handle
  await browser.switchToWindow(oldWindow)
  await browser.closeWindow()
  // Make sure new tab gets focus, in case `closeWindow()` somehow focused another window
  await browser.switchToWindow(tabHandle)
}

const LOCALE_EN_US = 'en-US'

// Separate file, to only use that for determining CI cache key
import browserConfig from './browser-config.json' with { type: 'json' }
/**
 * Cache directory for storing driver and browser binaries.
 *
 * This is a directory relative to the project instead of the default OS temp dir to:
 * - make it more obvious where the binaries are stored (and how large they are)
 * - cache them in CI
 */
// Include Geckodriver version as workaround for https://github.com/webdriverio-community/node-geckodriver/issues/731
//   TODO: Omit subdir once that issue is fixed
const CACHE_DIR = `cache-dir/geckodriver-${browserConfig.geckodriverVersion}`

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  // Test files, each run in a separate worker process
  specs: ['./specs/**/*.ts'],

  maxInstances: 10,
  capabilities: [
    {
      browserName: 'firefox',
      browserVersion: browserConfig.firefoxVersion,
      'moz:firefoxOptions': {
        prefs: {
          // Explicitly specify locale to not be affected by browser default locale / OS locale
          // (assumes that en-US is already available for this Firefox installation)
          'intl.locale.requested': LOCALE_EN_US,
        },
      },
      'wdio:geckodriverOptions': {
        cacheDir: CACHE_DIR,
      },
    },
    // Separate configuration which runs a subset of the tests in a Firefox Private mode window
    {
      browserName: 'firefox',
      browserVersion: browserConfig.firefoxVersion,
      'moz:firefoxOptions': {
        prefs: {
          // Explicitly specify locale to not be affected by browser default locale / OS locale
          // (assumes that en-US is already available for this Firefox installation)
          'intl.locale.requested': LOCALE_EN_US,
        },
        args: [
          // Run in Private mode, see https://wiki.mozilla.org/Firefox/CommandLineOptions#-private-window
          '-private-window',
        ],
      },
      'wdio:geckodriverOptions': {
        cacheDir: CACHE_DIR,
      },
      'wdio:specs': [
        // Only run a subset of all tests in Private mode
        'basic.ts',
      ],
    },
  ],

  logLevel: 'warn',

  // Test runner services
  services: [[DummyHttpServerService, {}]],

  // Test framework
  framework: 'mocha',

  // Test results reporter for console
  reporters: ['spec'],

  // Options to be passed to Mocha
  // See the full list at http://mochajs.org/
  mochaOpts: {
    ui: 'bdd',
    // Use rather high timeout; it seems initial start time of browser is included in this, so low timeout
    // value can cause test failures
    timeout: 60_000, // milliseconds
  },

  // Retry tests; sometimes they fail with "WebDriverError: TypeError: can't access dead object when running ..."
  // Not sure why; is the test setup flawed? (TODO?)
  // Retry the whole spec (instead of individual tests) since the spec is stateful and might have modified browser
  // state already (e.g. cache of 'known sites' tracked by the extension)
  specFileRetries: 2,

  onPrepare: async () => {
    // Manually download driver (if it does not exist yet), as workaround for https://github.com/webdriverio/webdriverio/issues/15337
    await downloadGeckodriver(browserConfig.geckodriverVersion, CACHE_DIR)
  },

  // Note: If this fails, it might not actually cause test execution to fail, see https://github.com/webdriverio/webdriverio/issues/12138
  /** Executed before test execution */
  before: async (capabilities) => {
    // Check actual browser locale; it seems if browser does not support specified locale it silently falls back to default locale?
    // TODO: Might be more correct to use `browser.i18n.getUILanguage()` (which specifies the browser language)
    //   than `navigator.language` (which is the preferred website language)? But would have to run this in extension
    //   context then to access `browser.i18n` API
    const locale = await browser.execute(() => navigator.language)
    if (locale !== LOCALE_EN_US) {
      throw new Error(
        `locale ${LOCALE_EN_US} was not used; actual locale is: ${locale}`,
      )
    }
    await installExtension(capabilities as WebdriverIO.Capabilities)
  },

  beforeTest: async (_test, context) => {
    // TODO: Is this the intended use case for `context`?
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
    context['known-window-handles'] = await browser.getWindowHandles()
  },
  afterTest: async (test, context) => {
    // To be safe close all windows which did not exist when the test started; even though the
    // tests should do this themselves, if they fail then other tests might fail with confusing
    // errors if there are still additional windows open
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const knownWindowHandles = context['known-window-handles']
    if (!Array.isArray(knownWindowHandles) || knownWindowHandles.length === 0) {
      // There should always be at least one window handle; otherwise something with this test / cleanup setup is broken
      throw new Error(`No known window handles: ${knownWindowHandles}`)
    }

    const handlesToClose = (await browser.getWindowHandles()).filter(
      (h) => !knownWindowHandles.includes(h),
    )
    if (handlesToClose.length > 0) {
      console.warn(
        `Test '${test.parent}: ${test.title}' has ${handlesToClose.length} unclosed window handles; closing them`,
      )

      for (const handle of handlesToClose) {
        await browser.switchToWindow(handle)
        await browser.closeWindow()
      }
    }

    await setUpNewTab()
  },
}
