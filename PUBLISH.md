# Publishing Instructions for version 1.0.0-alpha.5

This document contains instructions for publishing version 1.0.0-alpha.5 to npm.

## Pre-Publish Verification

All verification steps have been completed:

✅ Version updated in package.json to `1.0.0-alpha.5`  
✅ Build successful (`npm run build`)  
✅ All tests passing (52/52 tests)  
✅ Package contents verified  

## Package Contents

The package includes:
- `dist/index.js` - Main entry point with CLI shebang
- `dist/index.d.ts` - TypeScript type definitions
- `dist/index.js.map` - Source maps
- `README.md` - Documentation
- `LICENSE` - MIT License
- `package.json` - Package metadata

Total package size: ~26.3 kB (97.8 kB unpacked)

## Publishing to npm

To publish this version to npm, run:

```bash
npm publish --tag alpha
```

This will:
1. Publish `@akotliar/sitemap-qa@1.0.0-alpha.5` to npm
2. Tag it with `alpha` (users can install with `npm install @akotliar/sitemap-qa@alpha`)
3. Keep the `latest` tag pointing to the latest stable release

## Verification After Publishing

After publishing, verify the package:

```bash
# Check if the version is published
npm view @akotliar/sitemap-qa@1.0.0-alpha.5

# Test installation
npm install -g @akotliar/sitemap-qa@alpha

# Test the CLI
sitemap-qa --help
```

## Notes

- This is an alpha release, so it should be tagged appropriately
- Users can install it with: `npm install -g @akotliar/sitemap-qa@alpha`
- The package is configured with `"publishConfig": { "access": "public" }` in package.json
