const fs = require('fs');
const path = require('path');

const migrationDir = path.join(__dirname, '..', 'migrations');

function getMigrationSql() {
  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
  return files.map((file) => fs.readFileSync(path.join(migrationDir, file), 'utf8')).join('\n');
}

module.exports = {
  getMigrationSql,
};
