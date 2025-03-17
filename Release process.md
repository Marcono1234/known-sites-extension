# Release process

> [!TIP]\
> During development already create a draft GitHub Release and write down all relevant changes, so that
> on release you don't have to go in detail through all commits again.

1. Update the `version` number in the [`manifest.json` file](./extension/manifest.json)
2. Perform the tests described in the [Manual Testing guide](./Manual%20testing.md)
3. Git commit the changes _to a separate branch_ and push them
4. Manually run the ["Build extension" GitHub workflow](https://github.com/Marcono1234/known-sites-extension/actions/workflows/build.yml)\
   **Important:** Make sure to select the correct Git branch.
5. Download the extension from the workflow run
6. Verify that it is identical to the one you built locally (to make sure the build is reproducible)\
   **Note:** There might be differences in line endings when building on Windows locally, and [ZIP metadata might differ](https://github.com/mozilla/web-ext/issues/2381).
7. Submit the new extension version at the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addons)

## After submission approval

After the new extension version has been approved:

1. Merge the Git branch into `main`
2. Add a Git tag (see previous tags for the format)
3. Create a GitHub release
   1. Download the signed extension file from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/known-sites/)\
      (Note: Might be necessary to download the file in a browser other than Firefox, since that tries to install the extension file instead.)
   2. Attach the signed extension file to the GitHub release
