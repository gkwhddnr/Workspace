const fs = require('node:fs');

// Match Vite's ?raw imports when running source bundles outside the dev server.
exports.rawSourcesPlugin = {
    name: 'vite-raw-sources',
    setup(build) {
        build.onLoad({ filter: /\.(?:js|md)$/ }, args => args.suffix === '?raw'
            ? { contents: fs.readFileSync(args.path, 'utf8'), loader: 'text' }
            : undefined);
    },
};
