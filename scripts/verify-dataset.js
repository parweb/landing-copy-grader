#!/usr/bin/env node
// verify-dataset.js — re-score every row of data/landing-pages-scores.csv with the
// grader in this repo and fail if anything disagrees.
//
//   node scripts/verify-dataset.js
//
// The CSV ships the extracted headline/subhead/cta of each page, so the scores and
// flags are reproducible offline, with no network and no LLM. This exists because a
// truncated flag column once made the published summary statistics wrong: the CSV
// stored only the first three flags per row, so five of the nine tell frequencies
// came out low. A dataset that checks itself cannot drift that way again.

'use strict';
var fs = require('fs');
var path = require('path');
var grade = require('./score-page.js').grade;

function parseCsv(text) {
  var rows = [], row = [], field = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

var csv = parseCsv(fs.readFileSync(path.join(__dirname, '../data/landing-pages-scores.csv'), 'utf8'));
var head = csv.shift();
var col = {};
head.forEach(function (h, i) { col[h] = i; });

var bad = [], scores = [], tally = {};
csv.forEach(function (r) {
  var got = grade(r[col.headline], r[col.subhead], r[col.cta]);
  var want = { score: Number(r[col.score]), flags: (r[col.flags] || '').split(' ').filter(Boolean) };
  if (got.total !== want.score) bad.push(r[col.domain] + ': score ' + got.total + ' != ' + want.score);
  if (got.flags.slice().sort().join(' ') !== want.flags.slice().sort().join(' '))
    bad.push(r[col.domain] + ': flags [' + got.flags.join(' ') + '] != [' + want.flags.join(' ') + ']');
  scores.push(got.total);
  got.flags.forEach(function (f) { tally[f] = (tally[f] || 0) + 1; });
});

var n = scores.length;
scores.sort(function (a, b) { return a - b; });
var median = n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2;

if (bad.length) {
  console.error('MISMATCH on ' + bad.length + ' row(s):');
  bad.slice(0, 20).forEach(function (b) { console.error('  ' + b); });
  process.exit(1);
}

console.log(n + '/' + n + ' rows re-scored, every score and flag matches.');
console.log('median ' + median + '  mean ' + Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / n * 10) / 10 +
  '  min ' + scores[0] + '  max ' + scores[n - 1] +
  '  perfect ' + scores.filter(function (s) { return s === 100; }).length +
  '  below70 ' + scores.filter(function (s) { return s < 70; }).length);
Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).forEach(function (f) {
  console.log('  ' + f.padEnd(8) + String(tally[f]).padStart(4) + '  ' + Math.round(100 * tally[f] / n) + '%');
});
