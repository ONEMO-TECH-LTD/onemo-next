import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const productAssetsDir = path.resolve(dirname, '../public/assets');
const editorImagesDir = path.resolve(dirname, 'images');

function contentTypeFor(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.png') return 'image/png';
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
	if (ext === '.webp') return 'image/webp';
	if (ext === '.svg') return 'image/svg+xml';
	if (ext === '.json') return 'application/json';
	if (ext === '.glb') return 'model/gltf-binary';
	if (ext === '.gltf') return 'model/gltf+json';
	if (ext === '.hdr' || ext === '.exr' || ext === '.onemo' || ext === '.bin') return 'application/octet-stream';
	return 'application/octet-stream';
}

function productAssetsPlugin() {
	return {
		name: 'onemo-product-assets',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const requestUrl = new URL(req.url || '/', 'http://studio.local');
				if (!requestUrl.pathname.startsWith('/assets/')) {
					next();
					return;
				}

				const relativePath = decodeURIComponent(requestUrl.pathname.slice('/assets/'.length));
				const filePath = path.normalize(path.join(productAssetsDir, relativePath));
				if (!filePath.startsWith(productAssetsDir + path.sep)) {
					res.statusCode = 403;
					res.end('Forbidden');
					return;
				}

				fs.stat(filePath, (statError, stat) => {
					if (statError || !stat.isFile()) {
						next();
						return;
					}

					res.setHeader('Content-Type', contentTypeFor(filePath));
					fs.createReadStream(filePath).pipe(res);
				});
			});
		},
		writeBundle() {
			if (!fs.existsSync(productAssetsDir)) return;

			const outDir = path.resolve(dirname, 'dist/assets');
			fs.rmSync(outDir, { recursive: true, force: true });
			fs.cpSync(productAssetsDir, outDir, { recursive: true });

			if (fs.existsSync(editorImagesDir)) {
				const imageOutDir = path.resolve(dirname, 'dist/images');
				fs.rmSync(imageOutDir, { recursive: true, force: true });
				fs.cpSync(editorImagesDir, imageOutDir, { recursive: true });
			}
		}
	};
}

export default defineConfig({
  appType: 'spa',
  publicDir: 'public',
  plugins: [productAssetsPlugin()],
  build: {
    assetsDir: 'studio-assets',
    target: 'es2022',
    sourcemap: true
  },
  server: {
    port: 8088,
    strictPort: true
  }
});
