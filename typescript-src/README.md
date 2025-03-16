# typescript-src

TypeScript source code of this project. Consists of:

- [`background-scripts`](./background-scripts/)\
  [Background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts) of the extension,
  which check if a page should be blocked.
- [`pages-scripts`](./pages-scripts/)\
  Scripts which are used by the extension page shown when a website was blocked.
- [`common-src`](./common-src/)\
  Code shared between the background and the pages scripts, for communication between them.
