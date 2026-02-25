#!/usr/bin/env node

/**
 * Telegram Bot Testing Script
 * Gunakan untuk test API endpoints tanpa perlu Telegram Bot
 * 
 * Usage:
 * node scripts/test-telegram.js [command] [args...]
 * 
 * Commands:
 * - status              : Get webhook status
 * - setup               : Setup webhook
 * - delete              : Delete webhook
 * - test-buy-idr        : Test BUY with IDR
 * - test-buy-usdt       : Test BUY with USDT
 * - test-sell           : Test SELL
 * - test-invalid        : Test invalid command
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function makeRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}/api/telegram${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`\n📡 ${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function testWebhook(message) {
  const payload = {
    update_id: Date.now(),
    message: {
      message_id: 1,
      from: {
        id: 123456789,
        first_name: 'TestUser',
        username: 'testuser'
      },
      chat: {
        id: 123456789,
        type: 'private'
      },
      text: message,
      date: Math.floor(Date.now() / 1000)
    }
  };

  try {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    console.log(`\n📡 POST /webhook`);
    console.log(`Message: "${message}"`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const command = process.argv[2] || 'status';

  console.log('🤖 Telegram Bot Testing Script');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('---');

  switch (command) {
    case 'status':
      await makeRequest('GET', '/setup');
      break;

    case 'setup':
      const domain = process.argv[3] || 'localhost:3000';
      const webhookUrl = `https://${domain}/api/telegram/webhook`;
      await makeRequest('POST', '/setup', { webhookUrl });
      break;

    case 'delete':
      await makeRequest('DELETE', '/setup');
      break;

    case 'test-buy-idr':
      await testWebhook('buy rp205000 16750 bybit');
      break;

    case 'test-buy-usdt':
      await testWebhook('buy $50 16750 binance');
      break;

    case 'test-sell':
      await testWebhook('sell 10 16800 okx');
      break;

    case 'test-invalid':
      await testWebhook('invalid command format');
      break;

    case 'help':
      console.log(`
Usage: node scripts/test-telegram.js [command] [args...]

Commands:
  status              Get webhook status
  setup [domain]      Setup webhook (default: localhost:3000)
  delete              Delete webhook
  test-buy-idr        Test BUY with IDR (buy rp205000 16750 bybit)
  test-buy-usdt       Test BUY with USDT (buy $50 16750 binance)
  test-sell           Test SELL (sell 10 16800 okx)
  test-invalid        Test invalid command
  help                Show this help message

Environment Variables:
  BASE_URL            Base URL for API (default: http://localhost:3000)

Examples:
  node scripts/test-telegram.js status
  node scripts/test-telegram.js setup p2ptracker.vercel.app
  node scripts/test-telegram.js test-buy-usdt
  BASE_URL=https://p2ptracker.vercel.app node scripts/test-telegram.js status
      `);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Run "node scripts/test-telegram.js help" for usage');
  }
}

main().catch(console.error);
