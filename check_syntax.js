const fs = require('fs');
const content = fs.readFileSync('src/stats/report-template.js', 'utf8');

let pos = 0;
let line = 1;
let col = 0;

function advance() {
  if (content[pos] === '\n') {
    line++;
    col = 0;
  } else {
    col++;
  }
  pos++;
}

while (pos < content.length) {
  if (content.substring(pos, pos+2) === '`' && !content.substring(pos-1, pos) === '\\') {
     // rudimentary
  }
  advance();
}
