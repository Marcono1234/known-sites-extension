> [!WARNING]\
> This is a hobby project and might not provide good protection. Do not rely on it for professional phishing protection.

---

# <img src="extension/icon.svg" alt="Logo" width="30"> Known Sites

Browser extension blocking websites the user has not opened before.

The goal of this extension is to help protect against phishing attacks and against accidental typos when typing a URL.
Users should however still be **vigilant when opening links**. This extension might not protect against all attacks,
might be disabled in certain situations (e.g. in a Firefox private window, without the extension being enabled for
Private Browsing), and might not be installed on all devices of the user.

## Usage

Every time the user opens a new website, the extension checks if the user has opened the website before (i.e. if it is a 'known site' to
the user). If this is not the case, loading of the website is blocked and a warning page is shown. On that page the user is informed that
they have not opened the website before. They then have the choice to open the website, or to go to previous website / close the tab.
When the user choses to open the website, this choice is temporarily stored, and additionally because the browser adds it to the history,
it will be considered 'known' next time; see the sections below.

An icon in the browser toolbar indicates that the extension is active; it can be removed if desired ([Firefox documentation](https://support.mozilla.org/en-US/kb/customize-firefox-controls-buttons-and-toolbars)).

### Detection of known websites

A website is considered 'known' to the user if any of the following applies:

- the browser history contains an entry with the same domain
- a browser bookmark with the same domain exists

The extension uses the [Public Suffix List](https://publicsuffix.org/) (possibly a slightly outdated version) for obtaining the domain.
This avoid false positives when the content for the domain and all its subdomains is created by the domain owner, but at the same
time differentiates between subdomains when their content is user controlled.

### Usage notes

- For this extension to work properly, the browser should be configured to record the browsing history (active by default, see
  [related Firefox settings](https://support.mozilla.org/en-US/kb/delete-browsing-search-download-history-firefox#w_how-do-i-make-firefox-clear-my-history-automatically)).
  Because this extension itself does not persistently store information about 'known' websites, it might otherwise consider all
  websites unknown the next time the browser is opened.
- This extension only checks websites opened as top-level documents in tabs; it does not check content included in `<iframe>`,
  content loaded in the background (e.g. scripts or stylesheets) or images.

## Supported Browsers

- Chrome Desktop (Incognito mode is not supported, because the
  [extension page cannot be shown](https://developer.chrome.com/docs/extensions/reference/manifest/incognito#spanning))
- Firefox Desktop

Other browsers might not support all features needed by this extension.

## Development

1. Copy the polyfill file

   ```bash
   npm run copy-polyfill
   ```

2. In Visual Studio Code press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> (command "Tasks: Run Build Task").\
   Or alternatively in separate terminal windows run the `watch` scripts defined for the sub-projects under the [`typescript-src` directory](./typescript-src).

3. In a separate terminal, run:

   ```bash
   npm run debug-firefox
   ```

   This will launch a development browser Firefox browser and automatically apply changes made to the extension resources.

4. In the development Firefox browser, open `about:debugging`. See the [Extension Workshop documentation](https://extensionworkshop.com/documentation/develop/debugging/)
   for more information.

It is recommended to use [Visual Studio Code](https://code.visualstudio.com/) for development.

## Testing

For manual testing instructions, see [Manual testing](Manual%20testing.md).

## Building

```bash
npm run package
```

This will create the packaged extension under `./web-ext-artifacts`.

## Credits

- Implementation based on [HTTPS Everywhere](https://github.com/EFForg/https-everywhere)
- npm packages:
  - [lru-cache](https://www.npmjs.com/package/lru-cache): Cache implementation used for domain cache
  - [psl](https://www.npmjs.com/package/psl): JavaScript API around the Public Suffix List
  - [punycode](https://www.npmjs.com/package/punycode): Punycode domain decoding
- [Bootstrap Icons](https://icons.getbootstrap.com/)
