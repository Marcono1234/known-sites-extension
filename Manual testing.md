# Manual testing

The following manual tests can be performed to verify that the extension works correctly. It is recommended to
perform them with a fresh browser profile, for example by starting the browser using `web-ext run` (see `package.json`
scripts), to get consistent behavior. Make sure that you performed a build (`npm run package`) after your last changes.

In the following, 'unknown site' refers to a website which would by default be blocked by the extension because
the user has never visited it before.

It is recommended to also have a look at the console output during testing to verify that the extension behaves
as expected, and to make sure that no errors occur, see the [Extension log](#extension-log) section.

The following symbols are used for the tests:

- :mag: Describes the expected outcome
- :information_source: An important note about the test, for example a browser incompatibility

## Extension log

The extension logs messages to the console of the background script. To open this console:

- [Firefox](https://extensionworkshop.com/documentation/develop/debugging/#debugging-background-scripts)
- [Chrome](https://developer.chrome.com/docs/extensions/mv2/tutorials/debugging#debug_bg)\
  Chrome hides "debug" messages by default; make sure the "Verbose" log level is enabled in the console tab.

By default the extension logs only limited information to the console to avoid leaking sensitive information. To enable debug logging for the extension, execute the following JavaScript expression in the console of the extension background script. Subsequent logging should then be more verbose, for example it should mention which domain is being accessed.

```javascript
_KNOWN_SITES_DEBUG = true
```

## Tests

### Browser action icon

:information_source: Does not work for Chrome

1. Make sure the extension is active\
   :mag: The browser navbar should show the extension logo
2. Deactivate the extension\
   :mag: The browser navbar should not show the extension logo

### Open blocked

1. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked\
   :mag: The extension page should show the domain\
   :mag: The domain should be shown in the title of the tab
2. Check the browser history\
   :mag: The site should not appear in the history yet
3. Click the "Open" button of the extension page\
   :mag: The site should be opened
4. Check the browser history again\
   :mag: The site should be listed in the history
5. Check the browser history navigation buttons (forward, backward)\
   :mag: The extension page should not be listed\
   :information_source: Does not work for Chrome

### Open blocked complex URL

1. Open an unknown site, whose URL has a path, query and fragment, e.g. `https://example.com/test?test=%C3%A4#section`\
   :mag: The site should be blocked
2. Click the "Open" button of the extension page\
   :mag: The site should be opened, and the complete URL should have been preserved

### Blocked non-ASCII domain

1. Open an unknown site with a non-ASCII domain, e.g. `testäötestü.com`\
   :mag: The site should be blocked\
   :mag: The extension page should inform the user that the domain contains non-ASCII characters\
   :mag: The domain should be shown in the title of the tab, with non-ASCII characters replaced with `?`\
   :mag: The extension page should show the domain with non-ASCII characters replaced with `?` and highlighted in red
2. Click the eye icon on the extension page\
   :mag: The eye icon should have become crossed out\
   :mag: The domain should show the non-ASCII characters, highlighted in red
3. Click the crossed out eye icon on the extension page\
   :mag: The original (non crossed out) eye icon should be shown again\
   :mag: The extension page should show `?` as replacement for non-ASCII characters again

### Blocked "Go back"

1. In a tab which already has navigation history (for example Firefox's default `about:newtab`), open an unknown site, e.g. `example.com`\
   :mag: The site should be blocked\
   :mag: A "Go back" button should be shown on the extension page
2. Click the "Go back" button of the extension page\
   :mag: The tab should show the previously opened site
3. Check the browser history navigation buttons (forward, backward)\
   :mag: The extension page should be listed for the "forward" navigation

### Blocked "Close tab"

1. Open in a new tab an unknown site, for example by middle-clicking (or right-click and selecting "Open Link in New Tab") one of the websites recommended on Firefox's start page\
   :mag: The site should be blocked\
   :mag: A "Close tab" button should be shown on the extension page
2. Click the "Close tab" button of the extension page\
   :mag: The tab should be closed

### Still blocked after no action

1. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked
2. Check the browser history\
   :mag: The site should not appear in the history yet
3. Without doing anything on that page, open a new tab and open the same unknown site (e.g. `example.com`) again\
   :mag: The site should be blocked

### Still blocked after "Go back"

1. In a tab which already has navigation history (for example Firefox's default `about:newtab`), open an unknown site, e.g. `example.com`\
   :mag: The site should be blocked
2. Check the browser history\
   :mag: The site should not appear in the history yet
3. Click the "Go back" button of the extension page
4. Open a new tab and open the same unknown site (e.g. `example.com`) again\
   :mag: The site should be blocked

### Still blocked after "Close tab"

1. Open in a new tab an unknown site, for example by middle-clicking (or right-click and selecting "Open Link in New Tab") one of the websites recommended on Firefox's start page\
   :mag: The site should be blocked
2. Check the browser history\
   :mag: The site should not appear in the history yet
3. Click the "Close tab" button of the extension page
4. Open a new tab and open the same unknown site again\
   :mag: The site should be blocked

### Allowed after "Open"

1. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked
2. Click the "Open" button of the extension page\
   :mag: The site should be opened
3. In a separate tab, open the site (e.g. `example.com`) again\
   :mag: The site should not be blocked

### Allowed when in history

1. Disable the extension
2. Open an unknown site, for example `example.com`\
   :mag: The site should not be blocked
3. Check the browser history\
   :mag: The site should appear in the history
4. Enable the extension
5. Enable extension debug logging (`_KNOWN_SITES_DEBUG = true`), see the [Extension log](#extension-log) section
6. Open the site (e.g. `example.com`) again\
   :mag: The site should not be blocked (and the debug log should indicate that the site was found in the history)
7. Delete the site from the browser history\
   :mag: The extension debug log should indicate that the site was removed from history
8. Open the site (e.g. `example.com`) again\
   :mag: The site should be blocked

### Allowed when bookmarked

1. Add a bookmark for an unknown site, for example `example.com`
2. Enable extension debug logging (`_KNOWN_SITES_DEBUG = true`), see the [Extension log](#extension-log) section
3. Open the site (e.g. `example.com`)\
   :mag: The site should not be blocked (and the debug log should indicate that a matching bookmark was found)

### Allowed subdomain (first parent domain)

1. Open the unknown site `https://github.com`\
   :mag: The site should be blocked
2. Click the "Open" button on the extension page
3. Open the subdomain site `https://docs.github.com`\
   :mag: The site should not be blocked

### Allowed subdomain (first subdomain)

1. Open the unknown subdomain site `https://docs.github.com`\
   :mag: The site should be blocked\
   :mag: The extension page should show only the domain `github.com`\
   :mag: Only the domain `github.com` should be shown in the title of the tab
2. Click the "Open" button on the extension page
3. Open the site `https://github.com`\
   :mag: The site should not be blocked

### Allowed non-HTTP

1. Open URLs with a scheme other than `http` or `https`, e.g.:
   - A `file:///` URL
   - Under Chrome `chrome-extension://a/`

   :mag: The URL should not be blocked

2. Enable extension debug logging (`_KNOWN_SITES_DEBUG = true`), see the [Extension log](#extension-log) section
3. Remove the `file:///` URL from the browser history\
   :mag: An extension debug message should have been logged, saying the URL protocol is unsupported

### PSL domain `.co.uk`

1. Open an unknown site under the `.co.uk` domain, for example `https://google.co.uk`\
   :mag: The site should be blocked\
   :mag: The extension page should show the complete `google.co.uk` domain
2. Click the "Open" button on the extension page
3. Open another unknown site under the `.co.uk` domain, for example `https://wikipedia.co.uk`\
   :mag: The site should be blocked\
   :mag: The extension page should show the complete `wikipedia.co.uk` domain

### PSL domain `.github.io`

1. Open an unknown site under the `.github.io` domain, for example `https://octocat.github.io`\
   :mag: The site should be blocked\
   :mag: The extension page should show the complete `octocat.github.io` domain
2. Click the "Open" button on the extension page
3. Open another unknown site under the `.github.io` domain, for example `https://google.github.io`\
   :mag: The site should be blocked\
   :mag: The extension page should show the complete `google.github.io` domain

### IPv4 address

1. Try to open `http://127.0.0.0`\
   :mag: The site should be blocked\
   :mag: The extension page should show `127.0.0.0` as hostname
2. Click the "Open" button on the extension page\
   :information_source: The site most likely fails to load; this can be ignored
3. Try to open `http://127.1.0.0`\
   :mag: The site should be blocked

### IPv6 address

1. Try to open `http://[::1]`\
   :mag: The site should be blocked\
   :mag: The extension page should show `[::1]` as hostname
2. Try to open `http://[2001:4860:4860::8888]` (address of [Google DNS](https://developers.google.com/speed/public-dns/docs/using#addresses))\
   :mag: The site should be blocked\
   :mag: The extension page should show `[2001:4860:4860::8888]` as hostname

### Extension logging

1. Open the console of the extension background script, see the [Extension log](#extension-log) section (but don't enable debug logging yet)
2. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked
3. Click the "Go back" or "Close tab" button of the extension (but don't accidentally close the complete browser window)
4. Open the unknown site again, this time click the "Open" button of the extension\
   :mag: The site should open
5. Open the previously unknown site another time\
   :mag: It should not be blocked anymore
6. Look at the console of the extension background script (for Chrome make sure the "Verbose" log level is enabled)\
   :mag: It should have logged none or only very few messages\
   :mag: None of the logged messages should include the domain or the full URL of the unknown site
7. Enable extension debug logging (`_KNOWN_SITES_DEBUG = true`), see the [Extension log](#extension-log) section
8. Open the previously unknown site another time\
   :mag: It should not be blocked
9. Look at the console again\
   :mag: This time it should have logged verbose messages, saying for example that the domain was found in the cache

### HTML injection

1. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked
2. Edit the URL of the 'blocked page' (`moz-extension://...` or `chrome-extension://...`):\
   Replace all of the URL parameter values (except for `token`) with `<script>alert("XSS")</script>`, for example something like:

   ```text
   .../blocked-unknown.html?url=<script>alert("XSS")</script>&domain=<script>alert("XSS")</script>&rawDomain=<script>alert("XSS")</script>&isIncognito=<script>alert("XSS")</script>&token=...
   ```

3. Open the modified URL\
   :mag: The text `<script>alert("XSS")</script>` should appear literally\
   :mag: No browser dialog should appear, saying "XSS"\
   :mag: Neither the console of the extension background script (see [Extension log](#extension-log) section) nor the console of the blocked page should show any related warnings or errors

4. Repeat steps 2 & 3, this time with `<script>alert("XSS ä")</script>`\
   This time also click the eye icon of the extension page

   ```text
   .../blocked-unknown.html?url=<script>alert("XSS ä")</script>&domain=<script>alert("XSS ä")</script>&rawDomain=<script>alert("XSS ä")</script>&isIncognito=<script>alert("XSS ä")</script>&token=...
   ```

   :mag: This time the extension page should mention that non-ASCII characters were detected\
   Clicking on the eye icon should not cause any of the events described in step 3 either

### Invalid token

1. Open an unknown site, for example `example.com`\
   :mag: The site should be blocked
2. Edit the URL of the 'blocked page' (`moz-extension://...` or `chrome-extension://...`):\
   Modify the `token` URL parameter value, for example switch one letter
3. Open the modified URL\
   :mag: A dialog should appear saying that the token is incorrect\
   :mag: The buttons of the extension page should do nothing / should show a dialog as well, but should not open any pages
4. Repeat steps 2 & 3, this time completely removing the `token` parameter\
   :mag: The same behavior as in step 3 should be observable

### Incognito / Private mode (Chrome)

1. Open the extension settings and allow usage in Incognito windows
2. Open a new Incognito window\
   :mag: A dialog should appear, telling the user that Incognito mode is not supported for this browser

### Incognito / Private mode (Firefox)

1. Open the extension settings and allow usage in Private windows
2. In a non-private window open `example.com` (clicking the "Open" button of the extension, if necessary)
3. In a private window open `example.com`\
   :mag: The site should not be blocked
4. In the same private window open another site, for example `github.com`\
   :mag: The site should be blocked
5. Click the "Open" button of the extension page\
   :mag: The site should be opened
6. In another tab of the same private window, open `github.com` again\
   :mag: It should not be blocked
7. In a non-private window, open `github.com`\
   :mag: The site should be blocked (despite having been opened in the private window)
8. Close all private windows
9. In a new private window, open `github.com` again\
   :mag: The site should be blocked again
