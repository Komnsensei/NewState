'use strict';
const fs = require('fs');

const raw = fs.readFileSync('C:\\Users\\lynnh\\NEWSTATE\\memory\\telegram_chats\\messages.html', 'utf8');

const text = raw
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

// Find where Esma starts
const esmaStart = text.indexOf('Esma');
const esmaSection = text.substring(esmaStart - 200);

// Split into sentences
const sentences = esmaSection.split(/(?<=[.!?])\s+/);

console.log('--- ESMA CONVO EXCERPTS ---\n');
sentences.slice(0, 80).forEach((s, i) => {
  const trimmed = s.trim();
  if (trimmed.length > 30) {
    console.log(`[${i+1}] ${trimmed.substring(0, 400)}`);
    console.log();
  }
});
