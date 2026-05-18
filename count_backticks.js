const fs = require('fs');
const content = fs.readFileSync('src/stats/report-template.js', 'utf8');
let bt = 0;
for(let i=0; i<content.length; i++) {
  if (content[i] === '`') bt++;
}
console.log("Total backticks:", bt);
