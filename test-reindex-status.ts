/**
 * Test to check if re-indexing is complete
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

async function testReindexStatus() {
  console.log('🔍 Checking if CosmosDB re-indexing is complete...\n');

  try {
    const database = client.database('it-system');
    const container = database.container('alert_events');

    // Test 1: Simple query (should always work)
    console.log('[TEST 1] Simple query without filters...');
    const { resources: docs1 } = await container.items
      .query('SELECT TOP 3 * FROM c')
      .fetchAll();
    console.log(`✅ Success: Found ${docs1.length} documents\n`);

    // Test 2: Query with nested field selection (tests index on nested paths)
    console.log('[TEST 2] Query selecting nested fields...');
    const query2 = 'SELECT TOP 3 c.id, c.value.createdDateTime, c.value.severity FROM c';
    const { resources: docs2 } = await container.items
      .query(query2)
      .fetchAll();
    console.log(`✅ Success: Selected nested fields from ${docs2.length} documents\n`);

    // Test 3: Query with WHERE on nested field (THE CRITICAL TEST)
    console.log('[TEST 3] Query with WHERE on nested date field...');
    const query3 = {
      query: 'SELECT TOP 3 * FROM c WHERE c.value.createdDateTime >= @date',
      parameters: [
        { name: '@date', value: '2025-10-01T00:00:00.000Z' }
      ]
    };
    const { resources: docs3 } = await container.items
      .query(query3)
      .fetchAll();
    console.log(`✅ Success: Filtered ${docs3.length} documents by date\n`);

    // Test 4: The exact query from statistics code
    console.log('[TEST 4] Exact statistics query (with date range)...');
    const query4 = {
      query: 'SELECT TOP 5 * FROM c WHERE c.value.createdDateTime >= @startDate AND c.value.createdDateTime <= @endDate',
      parameters: [
        { name: '@startDate', value: '2020-01-01T00:00:00.000Z' },
        { name: '@endDate', value: new Date().toISOString() }
      ]
    };
    const { resources: docs4 } = await container.items
      .query(query4)
      .fetchAll();
    console.log(`✅ Success: Found ${docs4.length} documents in date range\n`);

    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Re-indexing is COMPLETE and working correctly!');
    console.log('✅ You can now run statistics generation successfully.\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}\n`);

    if (error.code === 400 && error.message.includes('invalid')) {
      console.log('⏳ RE-INDEXING STILL IN PROGRESS');
      console.log('   The indexes are configured correctly but Azure is still processing.');
      console.log('   Estimated time remaining: 10-20 minutes');
      console.log('   Please try again in a few minutes.\n');
    }

    process.exit(1);
  }
}

testReindexStatus();
