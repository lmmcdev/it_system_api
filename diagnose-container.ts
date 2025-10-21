/**
 * Diagnose container configuration issues
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

async function diagnose() {
  console.log('🔍 DIAGNOSING CONTAINER CONFIGURATION\n');

  try {
    const database = client.database('it-system');
    const container = database.container('alert_events');

    // Get container properties
    console.log('[1] Reading container properties...');
    const { resource: containerDef } = await container.read();

    console.log('\n📋 CONTAINER CONFIGURATION:');
    console.log('  - ID:', containerDef.id);
    console.log('  - Partition Key:', JSON.stringify(containerDef.partitionKey, null, 2));
    console.log('  - Indexing Mode:', containerDef.indexingPolicy?.indexingMode);
    console.log('  - Automatic Indexing:', containerDef.indexingPolicy?.automatic);

    console.log('\n📇 INDEXING POLICY:');
    console.log(JSON.stringify(containerDef.indexingPolicy, null, 2));

    // Test different query approaches
    console.log('\n\n🧪 TESTING QUERY APPROACHES:\n');

    // Test 1: No filters
    console.log('[TEST 1] SELECT TOP 1 * FROM c');
    try {
      const { resources: r1 } = await container.items.query('SELECT TOP 1 * FROM c').fetchAll();
      console.log('✅ Success:', r1.length, 'documents');
      if (r1.length > 0) {
        console.log('   Structure:', Object.keys(r1[0]).filter(k => !k.startsWith('_')));
      }
    } catch (e: any) {
      console.log('❌ Failed:', e.message);
    }

    // Test 2: Select nested field (no WHERE)
    console.log('\n[TEST 2] SELECT TOP 1 c.value FROM c');
    try {
      const { resources: r2 } = await container.items.query('SELECT TOP 1 c.value FROM c').fetchAll();
      console.log('✅ Success:', r2.length, 'documents');
    } catch (e: any) {
      console.log('❌ Failed:', e.message);
    }

    // Test 3: WHERE with root-level field
    console.log('\n[TEST 3] SELECT TOP 1 * FROM c WHERE c.id != ""');
    try {
      const { resources: r3 } = await container.items.query('SELECT TOP 1 * FROM c WHERE c.id != ""').fetchAll();
      console.log('✅ Success:', r3.length, 'documents');
    } catch (e: any) {
      console.log('❌ Failed:', e.message);
    }

    // Test 4: WHERE with nested field (the problematic one)
    console.log('\n[TEST 4] SELECT TOP 1 * FROM c WHERE c.value.createdDateTime >= "2025-01-01"');
    try {
      const { resources: r4 } = await container.items.query(
        'SELECT TOP 1 * FROM c WHERE c.value.createdDateTime >= "2025-01-01"'
      ).fetchAll();
      console.log('✅ Success:', r4.length, 'documents');
    } catch (e: any) {
      console.log('❌ Failed:', e.code, '-', e.message.substring(0, 100));
    }

    // Test 5: IS_DEFINED check
    console.log('\n[TEST 5] SELECT TOP 1 * FROM c WHERE IS_DEFINED(c.value)');
    try {
      const { resources: r5 } = await container.items.query(
        'SELECT TOP 1 * FROM c WHERE IS_DEFINED(c.value)'
      ).fetchAll();
      console.log('✅ Success:', r5.length, 'documents');
    } catch (e: any) {
      console.log('❌ Failed:', e.code, '-', e.message.substring(0, 100));
    }

    console.log('\n\n💡 ANALYSIS:');
    console.log('If TEST 1-3 pass but TEST 4-5 fail, the issue is:');
    console.log('  - Nested path queries are not supported in this container');
    console.log('  - Possible causes:');
    console.log('    • Partition key configuration prevents nested queries');
    console.log('    • SDK version incompatibility');
    console.log('    • Container created with legacy settings\n');

  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

diagnose();
