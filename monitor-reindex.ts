/**
 * Continuous monitoring of CosmosDB re-indexing progress
 * Checks every 2 minutes until indexing is complete
 */

import { CosmosClient } from '@azure/cosmos';
import * as fs from 'fs';
import * as path from 'path';

const settingsPath = path.join(__dirname, 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

Object.keys(settings.Values).forEach((key: string) => {
  process.env[key] = settings.Values[key];
});

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT!,
  key: process.env.COSMOS_KEY!
});

async function checkIndexStatus(): Promise<boolean> {
  try {
    const database = client.database('it-system');
    const container = database.container('alert_events');

    // Try the problematic query
    const query = {
      query: 'SELECT TOP 1 * FROM c WHERE c.value.createdDateTime >= @date',
      parameters: [{ name: '@date', value: '2025-10-01T00:00:00.000Z' }]
    };

    await container.items.query(query).fetchAll();
    return true; // Success!
  } catch (error: any) {
    if (error.code === 400 && error.message.includes('invalid')) {
      return false; // Still indexing
    }
    throw error; // Other error
  }
}

async function monitor() {
  console.log('🔍 Monitoring CosmosDB Re-indexing Progress');
  console.log('   Press Ctrl+C to stop\n');

  const startTime = Date.now();
  let attempt = 0;

  while (true) {
    attempt++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    process.stdout.write(`\r[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}] Attempt ${attempt}: Checking... `);

    try {
      const isComplete = await checkIndexStatus();

      if (isComplete) {
        console.log('✅ COMPLETE!\n');
        console.log('🎉 Re-indexing finished successfully!');
        console.log(`   Total time: ${minutes} minutes ${seconds} seconds`);
        console.log('\n✅ You can now run statistics generation:');
        console.log('   npm start');
        console.log('   curl http://localhost:7071/api/trigger/generate-statistics?code=your-key\n');
        process.exit(0);
      } else {
        process.stdout.write('⏳ Still indexing...');
      }
    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}`);
    }

    // Wait 2 minutes before next check
    await new Promise(resolve => setTimeout(resolve, 120000));
  }
}

console.log('Starting monitor in 3 seconds...');
console.log('(This will check every 2 minutes)\n');

setTimeout(() => {
  monitor().catch(error => {
    console.error('\n❌ Monitor failed:', error);
    process.exit(1);
  });
}, 3000);
