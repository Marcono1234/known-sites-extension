# Manual testing

The following manual tests can be performed to verify that the extension works correctly. It is recommended to
perform them with a fresh browser profile, for example by starting the browser using `web-ext run` (see `package.json`
scripts), to get consistent behavior.

In the following, 'unknown site' refers to a website which would by default be blocked by the extension because
the user has never visited it before.

It is recommended to also have a look at the console output during testing to verify that the extension behaves
as expected, and to make sure that no errors occur:

- [Firefox documentation](https://extensionworkshop.com/documentation/develop/debugging/)
- [Chrome documentation](https://developer.chrome.com/docs/extensions/mv3/tut_debugging/)

The following symbols are used for the tests:

- :mag: Describes the expected outcome
- :information_source: An important note about the test, for example a browser incompatibility

## Tests

### Browser action icon

:information_source: Does not work for Chrome

1. Make sure the extension is active  
   :mag: The browser navbar should show the extension logo
2. Deactivate the extension  
   :mag: The browser navbar should not show the extension logo

### Open blocked

1. Open an unknown site, for example `example.com`  
   :mag: The site should be blocked  
   :mag: The extension page should show the domain  
   :mag: The domain should be shown in the title of the tab
2. Check the browser history  
   :mag: The site should not appear in the history yet
3. Click the "Open" button of the extension page  
   :mag: The site should be opened
4. Check the browser history navigation buttons (forward, backward)  
   :mag: The extension page should not be listed  
   :information_source: Does not work for Chrome
5. Check the browser history again  
   :mag: The site should be listed in the history

### Open blocked complex URL

1. Open an unknown site, whose URL has a path, query and fragment, e.g. `https://example.com/test?test=%C3%A4#section`  
   :mag: The site should be blocked
2. Click the "Open" button of the extension page  
   :mag: The site should be opened, and the complete URL should have been preserved

### Blocked non-ASCII domain

1. Open an unknown site with a non-ASCII domain, e.g. `testäötestü.com`  
   :mag: The site should be blocked  
   :mag: The extension page should inform the user that the domain contains non-ASCII characters  
   :mag: The domain should be shown in the title of the tab, with non-ASCII characters replaced with `?`  
   :mag: The extension page should the domain with non-ASCII characters replaced with `?` and highlighted in red
2. Click the eye icon on the extension page  
   :mag: The domain should show the non-ASCII characters, highlighted in red
3. Click the crossed out eye icon on the extension page  
   :mag: The extension page should show `?` as replacement for non-ASCII characters again

### Blocked "Go back"

1. In a tab which already has navigation history (for example Firefox's default `about:newtab`), open an unknown site, e.g. `example.com`  
   :mag: The site should be blocked  
   :mag: A "Go back" button should be shown on the extension page
2. Click the "Go back" button of the extension page  
   :mag: The tab should show the previously opened site
3. Check the browser history navigation buttons (forward, backward)  
   :mag: The extension page should be listed for the "forward" navigation

### Blocked "Close tab"

1. Open in a new tab an unknown site, for example by middle-clicking (or right-click and selecting "Open Link in New Tab") one of the websites recommended on Firefox's start page  
   :mag: The site should be blocked  
   :mag: A "Close tab" button should be shown on the extension page
2. Click the "Close tab" button of the extension page  
   :mag: The tab should be closed

### Still blocked after no action

1. Open an unknown site, for example `example.com`  
   :mag: The site should be blocked
2. Check the browser history  
   :mag: The site should not appear in the history yet
3. Without doing anything on that page, open a new tab and open the same unknown site (e.g. `example.com`) again  
   :mag: The site should be blocked

### Still blocked after "Go back"

1. In a tab which already has navigation history (for example Firefox's default `about:newtab`), open an unknown site, e.g. `example.com`  
   :mag: The site should be blocked
2. Check the browser history  
   :mag: The site should not appear in the history yet
3. Click the "Go back" button of the extension page
4. Open a new tab and open the same unknown site (e.g. `example.com`) again  
   :mag: The site should be blocked

### Still blocked after "Close tab"

1. Open in a new tab an unknown site, for example by middle-clicking (or right-click and selecting "Open Link in New Tab") one of the websites recommended on Firefox's start page  
   :mag: The site should be blocked
2. Check the browser history  
   :mag: The site should not appear in the history yet
3. Click the "Close tab" button of the extension page
4. Open a new tab and open the same unknown site again  
   :mag: The site should be blocked

### Allowed after "Open"

1. Open an unknown site, for example `example.com`  
   :mag: The site should be blocked
2. Click the "Open" button of the extension page  
   :mag: The site should be opened
3. In a separate tab, open the site (e.g. `example.com`) again  
   :mag: The site should not be blocked

### Allowed when in history

1. Disable the extension
2. Open an unknown site, for example `example.com`  
   :mag: The site should not be blocked
3. Check the browser history  
   :mag: The site should appear in the history
4. Enable the extension
5. In a separate tab, open the site (e.g. `example.com`) again  
   :mag: The site should not be blocked (and the log should indicate that the site was found in the history)
6. Delete the site from the browser history  
   :mag: The site should be blocked (and the log should indicate that the site was removed from history)

### Allowed when bookmarked

1. Add a bookmark for an unknown site, for example `example.com`
2. Open the site (e.g. `example.com`)  
   :mag: The site should not be blocked (and the log should indicate that a matching bookmark was found)

### Allowed subdomain (first parent domain)

1. Open the unknown site `https://github.com`  
   :mag: The site should be blocked
2. Click the "Open" button on the extension page
3. Open the subdomain site `https://docs.github.com`  
   :mag: The site should not be blocked

### Allowed subdomain (first subdomain)

1. Open the unknown subdomain site `https://docs.github.com`  
   :mag: The site should be blocked  
   :mag: The extension page should show only the domain `github.com`  
   :mag: Only the domain `github.com` should be shown in the title of the tab
2. Click the "Open" button on the extension page
3. Open the site `https://github.com`  
   :mag: The site should not be blocked

### Allowed non-HTTP / non-FTP

1. Open URLs with a scheme other than `http`, `https` or `ftp`, e.g.:

   - A `file:///` URI
   - Under Chrome `chrome-extension://a/`

   :mag: The URL should not be blocked

### PSL domain `.co.uk`

1. Open an unknown site under the `.co.uk` domain, for example `https://google.co.uk`  
   :mag: The site should be blocked  
   :mag: The extension page should show the complete `google.co.uk` domain
2. Click the "Open" button on the extension page
3. Open another unknown site under the `.co.uk` domain, for example `https://wikipedia.co.uk`  
   :mag: The site should be blocked  
   :mag: The extension page should show the complete `wikipedia.co.uk` domain

### PSL domain `.github.io`

1. Open an unknown site under the `.github.io` domain, for example `https://octocat.github.io`  
   :mag: The site should be blocked  
   :mag: The extension page should show the complete `octocat.github.io` domain
2. Click the "Open" button on the extension page
3. Open another unknown site under the `.github.io` domain, for example `https://google.github.io`  
   :mag: The site should be blocked  
   :mag: The extension page should show the complete `google.github.io` domain

### IPv4 address

1. Try to open `http://127.0.0.0`  
   :mag: The site should be blocked  
   :mag: The extension page should show `127.0.0.0` as hostname
2. Click the "Open" button on the extension page  
   :information_source: The site most likely fails to load; this can be ignored
3. Try to open `http://127.1.0.0`  
   :mag: The site should be blocked

### IPv6 address

1. Try to open `http://[::1]`  
   :mag: The site should be blocked  
   :mag: The extension page should show `[::1]` as hostname
2. Try to open `http://[2001:4860:4860::8888]` (address of [Google DNS](https://developers.google.com/speed/public-dns/docs/using#addresses))  
   :mag: The site should be blocked  
   :mag: The extension page should show `[2001:4860:4860::8888]` as hostname

### Incognito / Private mode (Chrome)

1. Open the extension settings and allow usage in Incognito windows
2. Open a new Incognito window  
   :mag: A dialog should appear, telling the user that Incognito mode is not supported for this browser

### Incognito / Private mode (Firefox)

1. Open the extension settings and allow usage in Private windows
2. In a non-private window open `example.com` (clicking the "Open" button of the extension, if necessary)
3. In a private window open `example.com`  
   :mag: The site should not be blocked
4. In the same private window open another site, for example `github.com`  
   :mag: The site should be blocked
5. Click the "Open" button of the extension page  
   :mag: The site should be opened
6. In another tab of the same private window, open `github.com` again  
   :mag: It should not be blocked
7. In a non-private window, open `github.com`  
   :mag: The site should be blocked (despite having been opened in the private window)
8. Close all private windows
9. In a new private window, open `github.com` again  
   :mag: The site should be blocked again
