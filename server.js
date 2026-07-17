const express = require('express');
const si = require('systeminformation');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3456;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── System Information Cache & Endpoint ──────────────────────────────────────
let cachedStaticSystemInfo = null;
let staticInfoPromise = null;

async function getStaticSystemInfo() {
  if (cachedStaticSystemInfo) return cachedStaticSystemInfo;

  if (!staticInfoPromise) {
    staticInfoPromise = (async () => {
      try {
        const [cpu, mem, graphics, osInfo, diskLayout] = await Promise.all([
          si.cpu(),
          si.mem(),
          si.graphics(),
          si.osInfo(),
          si.diskLayout(),
        ]);

        const gpus = graphics.controllers.map(g => ({
          model: g.model,
          vendor: g.vendor,
          vram: g.vram,          // in MB
          driver: g.driverVersion || 'N/A',
          bus: g.bus || 'N/A',
        }));

        // Determine best GPU VRAM (dedicated GPU preferred)
        const dedicatedGpus = gpus.filter(g =>
          !g.model.toLowerCase().includes('intel') &&
          !g.model.toLowerCase().includes('integrated')
        );
        const bestGpu = dedicatedGpus.length > 0
          ? dedicatedGpus.reduce((a, b) => (a.vram > b.vram ? a : b))
          : gpus.length > 0
            ? gpus.reduce((a, b) => (a.vram > b.vram ? a : b))
            : null;

        cachedStaticSystemInfo = {
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            arch: osInfo.arch,
          },
          cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            cores: cpu.cores,
            physicalCores: cpu.physicalCores,
            speed: cpu.speed,
            speedMax: cpu.speedMax,
          },
          totalMemory: mem.total,
          totalMemoryGB: +(mem.total / 1073741824).toFixed(1),
          gpus,
          bestGpu: bestGpu ? {
            model: bestGpu.model,
            vramMB: bestGpu.vram,
            vramGB: +(bestGpu.vram / 1024).toFixed(1),
          } : null,
          storage: diskLayout.map(d => ({
            name: d.name,
            type: d.type,
            size: d.size,
            sizeGB: +(d.size / 1073741824).toFixed(0),
          })),
        };
        return cachedStaticSystemInfo;
      } catch (err) {
        staticInfoPromise = null; // Clear promise on error so next call can retry
        throw err;
      }
    })();
  }

  return staticInfoPromise;
}

app.get('/api/system', async (req, res) => {
  try {
    const staticInfo = await getStaticSystemInfo();
    const mem = await si.mem();

    const systemInfo = {
      os: staticInfo.os,
      cpu: staticInfo.cpu,
      memory: {
        total: staticInfo.totalMemory,
        free: mem.free,
        available: mem.available,
        used: mem.used,
        totalGB: staticInfo.totalMemoryGB,
        availableGB: +(mem.available / 1073741824).toFixed(1),
      },
      gpus: staticInfo.gpus,
      bestGpu: staticInfo.bestGpu,
      storage: staticInfo.storage,
    };

    res.json(systemInfo);
  } catch (err) {
    console.error('System info error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Ollama Proxy Endpoints ───────────────────────────────────────────────────
function proxyOllama(apiPath, res) {
  const options = {
    hostname: '127.0.0.1',
    port: 11434,
    path: apiPath,
    method: 'GET',
    timeout: 5000,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch {
        res.json({ raw: data });
      }
    });
  });

  proxyReq.on('error', () => {
    res.status(503).json({ error: 'Ollama is not running. Start it with: ollama serve' });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Ollama connection timed out' });
  });

  proxyReq.end();
}

// Check if Ollama is reachable
app.get('/api/ollama/status', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 11434,
    path: '/',
    method: 'GET',
    timeout: 3000,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      res.json({ online: true, response: data.trim() });
    });
  });

  proxyReq.on('error', () => {
    res.json({ online: false });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.json({ online: false });
  });

  proxyReq.end();
});

// List installed models
app.get('/api/ollama/tags', (req, res) => proxyOllama('/api/tags', res));

// List running models
app.get('/api/ollama/ps', (req, res) => proxyOllama('/api/ps', res));

// Show model details
app.get('/api/ollama/show/:model', (req, res) => {
  const modelName = req.params.model;
  const postData = JSON.stringify({ name: modelName });

  const options = {
    hostname: '127.0.0.1',
    port: 11434,
    path: '/api/show',
    method: 'POST',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch {
        res.json({ raw: data });
      }
    });
  });

  proxyReq.on('error', () => {
    res.status(503).json({ error: 'Ollama is not running' });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Request timed out' });
  });

  proxyReq.write(postData);
  proxyReq.end();
});

// Pull a model (streaming progress via SSE)
app.post('/api/ollama/pull', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Model name required' });

  // Disable socket and request timeouts for this long-running download stream
  req.socket.setTimeout(0);
  res.setTimeout(0);

  // Enable streaming from Ollama (default behavior)
  const postData = JSON.stringify({ name, stream: true });

  // Set up SSE headers so the browser can read chunks as they arrive
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const options = {
    hostname: '127.0.0.1',
    port: 11434,
    path: '/api/pull',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    // Use keepAlive to maintain connection stability with Ollama
    agent: new http.Agent({ keepAlive: true, maxSockets: 1 }),
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let buffer = '';

    proxyRes.on('error', (err) => {
      console.error('Ollama proxy response error:', err);
      res.write(`data: ${JSON.stringify({ error: `Connection lost: ${err.message}` })}\n\n`);
      res.end();
    });

    proxyRes.on('data', (chunk) => {
      buffer += chunk.toString();

      // Ollama sends newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Skip malformed lines
        }
      }
    });

    proxyRes.on('end', () => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch { /* ignore */ }
      }
      res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
      res.end();
    });
  });

  proxyReq.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: `Pull failed: ${err.message}` })}\n\n`);
    res.end();
  });

  // Disable timeout on the proxy request itself
  proxyReq.setTimeout(0);

  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.write(postData);
  proxyReq.end();
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║   🚀 CanIRunAI                               ║`);
  console.log(`  ║   Open: http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);

  // Pre-warm the hardware specs cache in the background
  console.log('⚡ Pre-warming hardware cache...');
  getStaticSystemInfo()
    .then(() => console.log('✅ Hardware cache fully warmed.'))
    .catch(err => console.error('⚠️ Error pre-warming hardware cache:', err));
});
