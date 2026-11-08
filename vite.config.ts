import { defineConfig } from 'vite';
import { networkInterfaces } from 'node:os';

// Find the computer's address on the local Wi-Fi so the in-game QR code
// points phones to it instead of "localhost".
function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '';
}

export default defineConfig({
  base: './',
  define: { __LAN_IP__: JSON.stringify(lanAddress()) },
  server: { host: true, port: 5173 },
});
