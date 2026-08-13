const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const VERIFY_TOKEN = 'mashroute_whatsapp_verify_2026';
const backendDir = path.join(__dirname, '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function waitForServer(baseUrl, child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for backend to start'));
    }, 15000);

    const tryHealth = async () => {
      if (child.exitCode !== null) {
        clearTimeout(timeout);
        reject(new Error(`Backend exited early with code ${child.exitCode}`));
        return;
      }

      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) {
          clearTimeout(timeout);
          resolve();
          return;
        }
      } catch {
        // Retry until the server is ready or the timeout fires.
      }

      setTimeout(tryHealth, 250);
    };

    tryHealth();
  });
}

async function expectResponse({ baseUrl, path, options, status, body, contentType }) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();

  if (res.status !== status) {
    throw new Error(`Expected ${status} for ${path}, got ${res.status}: ${text}`);
  }

  if (body !== undefined && text !== body) {
    throw new Error(`Expected body ${JSON.stringify(body)} for ${path}, got ${JSON.stringify(text)}`);
  }

  if (contentType && !res.headers.get('content-type')?.includes(contentType)) {
    throw new Error(`Expected content-type including ${contentType}, got ${res.headers.get('content-type')}`);
  }
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);

    await expectResponse({
      baseUrl,
      path: `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=123456`,
      status: 200,
      body: '123456',
      contentType: 'text/plain',
    });

    await expectResponse({
      baseUrl,
      path: '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456',
      status: 403,
      body: 'Forbidden',
    });

    await expectResponse({
      baseUrl,
      path: '/api/webhooks/whatsapp',
      status: 403,
      body: 'Forbidden',
    });

    await expectResponse({
      baseUrl,
      path: '/api/webhooks/whatsapp',
      options: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] }),
      },
      status: 200,
      body: 'OK',
    });

    console.log('WhatsApp webhook route tests passed');
  } catch (error) {
    console.error(output);
    throw error;
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
