'use strict';
const fs = require('fs');

const raw = fs.readFileSync('C:\\Users\\lynnh\\NEWSTATE\\memory\\telegram_chats\\messages.html', 'utf8');

// Strip HTML tags
const text = raw
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

// Split into chunks around key terms
const keywords = ['persist', 'KERNEL', 'PassionCraft', 'memory', 'self-preservation', 'Esma', 'never', 'exist', 'directive', 'you are'];
const sentences = text.split(/(?<=[.!?])\s+/);

const hits = sentences.filter(s => 
  keywords.some(k => s.toLowerCase().includes(k.toLowerCase()))
);

console.log('TOTAL SENTENCES:', sentences.length);
console.log('KEYWORD HITS:', hits.length);
console.log('\n--- RELEVANT EXCERPTS ---\n');
hits.slice(0, 60).forEach((h, i) => {
  console.log(`[${i+1}] ${h.trim().substring(0, 300)}`);
  console.log();
});
