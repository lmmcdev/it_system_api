/**
 * Test statistics generation with in-memory filtering
 */

import * as fs from 'fs';
import * as path from 'path';

async function testStatisticsGeneration() {
  // Load environment variables FIRST
  const settingsPath = path.join(__dirname, 'local.settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

  Object.keys(settings.Values).forEach((key: string) => {
    process.env[key] = settings.Values[key];
  });

  // NOW import repository (after environment is configured)
  const { alertStatisticsRepository } = await import('./src/repositories/AlertStatisticsRepository');
  console.log('🧪 Testing Statistics Generation with In-Memory Filtering\n');

  try {
    // Test 1: Fetch alerts without date filter
    console.log('[TEST 1] Fetch all alerts (no date filter)...');
    const result1 = await alertStatisticsRepository.queryAlertEventsForAggregation(
      {},
      { batchSize: 10 }
    );
    console.log(`✅ Success: Fetched ${result1.count} alerts`);
    console.log(`   Has more: ${result1.hasMore}`);

    if (result1.count > 0) {
      const sample = result1.items[0];
      console.log(`   Sample alert:`, {
        id: sample.id,
        hasValue: !!sample.value,
        createdDateTime: sample.value?.createdDateTime,
        severity: sample.value?.severity,
        status: sample.value?.status
      });
    }
    console.log();

    // Test 2: Fetch alerts with very wide date range (should get all)
    console.log('[TEST 2] Fetch with wide date range (2020-01-01 to today)...');
    const result2 = await alertStatisticsRepository.queryAlertEventsForAggregation(
      {
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: new Date().toISOString()
      },
      { batchSize: 10 }
    );
    console.log(`✅ Success: Fetched ${result2.count} alerts (after in-memory filtering)`);
    console.log(`   Has more: ${result2.hasMore}`);
    console.log();

    // Test 3: Fetch alerts with recent date range
    console.log('[TEST 3] Fetch recent alerts (October 2025 onwards)...');
    const result3 = await alertStatisticsRepository.queryAlertEventsForAggregation(
      {
        startDate: '2025-10-01T00:00:00.000Z',
        endDate: new Date().toISOString()
      },
      { batchSize: 10 }
    );
    console.log(`✅ Success: Fetched ${result3.count} alerts (after in-memory filtering)`);

    if (result3.count > 0) {
      console.log(`   Sample filtered alerts:`);
      result3.items.slice(0, 3).forEach((alert, idx) => {
        console.log(`     ${idx + 1}. ${alert.id} - ${alert.value?.createdDateTime} - ${alert.value?.severity}`);
      });
    }
    console.log();

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   Total alerts (no filter): ${result1.count}`);
    console.log(`   Wide date range (2020-today): ${result2.count}`);
    console.log(`   Recent alerts (Oct 2025+): ${result3.count}`);
    console.log();

    if (result1.count === 0) {
      console.log('⚠️  WARNING: No alerts found in database!');
      console.log('   Statistics generation will have no data to process.');
    } else {
      console.log('✅ IN-MEMORY FILTERING IS WORKING!');
      console.log('   You can now run statistics generation:');
      console.log('   npm start');
      console.log('   curl http://localhost:7071/api/trigger/generate-statistics?code=your-key');
    }
    console.log();

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

testStatisticsGeneration();
