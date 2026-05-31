const { spawnSync } = require('node:child_process');

const checks = [
  ['verify:core', ['node', 'scripts/verify-core.js']],
  ['verify:services', ['node', 'scripts/verify-services.js']],
  ['verify:http', ['node', 'scripts/verify-http-client.js']],
  ['verify:sde-source', ['node', 'scripts/verify-sde-source-bundle.js']],
  ['verify:frame', ['node', 'scripts/verify-frame-module.js']],
  ['verify:renderer-shell', ['node', 'scripts/verify-renderer-shell.js']]
];

for (const [label, command] of checks) {
  const result = spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

console.log('all checks verified');
