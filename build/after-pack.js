const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const appDir = path.join(context.appOutDir, 'resources', 'app');

  const script = `#!/usr/bin/env node
require('./dist/cli/index.js');
`;

  fs.writeFileSync(path.join(appDir, 'roar'), script, { mode: 0o755 });
};
