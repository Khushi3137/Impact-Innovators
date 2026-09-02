const fs = require('fs').promises;
const path = require('path');

const folders = [
  'temp/uploads',
  'temp/frames',
  'temp/audio',
  'temp/thumbnails',
  'temp/converted',
  'temp/segments',
  'temp/normalized',
  'temp/waveforms',
  'temp/chunks'
];

async function createFolders() {
  for (const folder of folders) {
    await fs.mkdir(path.join(__dirname, folder), { recursive: true });
    console.log(`Created: ${folder}`);
  }
  console.log('All temp folders created successfully!');
}

createFolders().catch(console.error);