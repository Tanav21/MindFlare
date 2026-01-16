#!/usr/bin/env node

/**
 * Helper script to find your LAN IP address
 * Run: node get-lan-ip.js
 */

const os = require('os');

function getLANIP() {
  const nets = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address,
        });
      }
    }
  }

  return addresses;
}

console.log('\n=== Network Configuration Helper ===\n');

const addresses = getLANIP();

if (addresses.length === 0) {
  console.log('❌ No LAN IP addresses found. Make sure you are connected to a network.\n');
  process.exit(1);
}

console.log('✅ Found LAN IP addresses:\n');

addresses.forEach((addr, index) => {
  console.log(`  ${index + 1}. ${addr.interface}: ${addr.address}`);
});

const primaryIP = addresses[0].address;

console.log('\n📝 Configuration:\n');
console.log('Backend URL:', `http://${primaryIP}:5000`);
console.log('Frontend URL:', `http://${primaryIP}:5173`);
console.log('\n📄 Update backend/.env:');
console.log(`FRONTEND_URL=http://${primaryIP}:5173`);
console.log(`HOST=0.0.0.0`);
console.log('\n📄 Update frontend/.env:');
console.log(`VITE_API_URL=http://${primaryIP}:5000/api`);
console.log('\n💡 To start frontend with network access:');
console.log('   npm run dev -- --host');
console.log('\n');
