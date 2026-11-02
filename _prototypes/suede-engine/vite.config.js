// Dev-server spec store: the prototype autosaves its calibration to specs/latest.json on this Mac
// (shared by every device on the network, survives browser storage being cleared), plus a snapshot every 10 min in specs/history/.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'specs');
let lastSnap = 0;
export const specStore = () => ({
  name: 'spec-store',
  configureServer(server) {
    server.middlewares.use('/__spec', (req, res) => {
      const latest = path.join(DIR, 'latest.json');
      if (req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try { JSON.parse(body); } catch { res.statusCode = 400; return res.end('bad json'); }
          fs.mkdirSync(path.join(DIR, 'history'), { recursive: true });
          if (req.url.includes('backup')) { fs.writeFileSync(path.join(DIR, 'history', 'device-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), body); return res.end('ok'); }   // a device's own copy before the shared file replaces it
          fs.writeFileSync(latest + '.tmp', body); fs.renameSync(latest + '.tmp', latest);   // atomic
          if (Date.now() - lastSnap > 10 * 60e3) { lastSnap = Date.now(); fs.writeFileSync(path.join(DIR, 'history', new Date().toISOString().replace(/[:.]/g, '-') + '.json'), body); }
          res.end('ok');
        });
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(fs.existsSync(latest) ? fs.readFileSync(latest) : 'null');
    });
  },
});

export default { plugins: [specStore()] };
