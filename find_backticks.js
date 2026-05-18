const fs = require('fs');
const content = fs.readFileSync('src/stats/report-template.js', 'utf8');
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('`')) {
    console.log((i + 1) + ':', lines[i]);
  }
}
