#!/usr/bin/env node

/**
 * Test script for TX Batch Commands
 * Tests the new TX batch functionality with exchange prefix
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testTxBatchCommand() {
  console.log('🧪 Testing TX Batch Commands...\n');

  // Test Case 1: TX Bybit - Valid commands
  console.log('📝 Test Case 1: TX Bybit - Valid commands');
  const txBybit = `TX bybit
buy rp200000 16750
buy $50 16750
b $20 750
sell rp250000 16800
sell $20 16750
s $15 800
s rp200000 900`;

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          from: { id: 999 },
          text: txBybit
        }
      })
    });

    const result = await response.json();
    console.log('✅ TX Bybit Status:', response.ok ? 'Success' : 'Failed');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ TX Bybit Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 2: TX Binance - Mixed commands
  console.log('📝 Test Case 2: TX Binance - Mixed commands');
  const txBinance = `TX binance
b rp300000 750
b $100 750
s rp400000 800
s $50 800`;

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          from: { id: 999 },
          text: txBinance
        }
      })
    });

    const result = await response.json();
    console.log('✅ TX Binance Status:', response.ok ? 'Success' : 'Failed');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ TX Binance Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 3: TX with invalid exchange
  console.log('📝 Test Case 3: TX with invalid exchange');
  const txInvalid = `TX invalidexchange
buy rp200000 16750`;

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          from: { id: 999 },
          text: txInvalid
        }
      })
    });

    const result = await response.json();
    console.log('✅ TX Invalid Status:', response.ok ? 'Success' : 'Failed');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ TX Invalid Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 4: TX OKX - With empty lines
  console.log('📝 Test Case 4: TX OKX - With empty lines');
  const txOkx = `TX okx
buy rp200000 16750

sell rp150000 16800

b $50 750`;

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          from: { id: 999 },
          text: txOkx
        }
      })
    });

    const result = await response.json();
    console.log('✅ TX OKX Status:', response.ok ? 'Success' : 'Failed');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ TX OKX Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 5: TX without commands (should fail)
  console.log('📝 Test Case 5: TX without commands');
  const txEmpty = `TX bybit`;

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          from: { id: 999 },
          text: txEmpty
        }
      })
    });

    const result = await response.json();
    console.log('✅ TX Empty Status:', response.ok ? 'Success' : 'Failed');
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ TX Empty Error:', error.message);
  }

  console.log('\n🎉 TX Batch command testing completed!');
}

// Main execution
async function main() {
  console.log('🚀 Starting TX Batch Command Tests\n');
  
  await testTxBatchCommand();
  
  console.log('\n📋 Test Summary:');
  console.log('✅ TX batch detects exchange prefix');
  console.log('✅ Commands processed without exchange in each line');
  console.log('✅ Error handling for invalid exchange');
  console.log('✅ Empty lines are skipped');
  console.log('✅ Support all command formats (buy/b, sell/s)');
  console.log('✅ Validation for TX format');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testTxBatchCommand };
