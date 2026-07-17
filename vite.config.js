import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const disabledPdfRenderer = path.resolve(__dirname, './src/lib/disabledPdfOptionalRenderer.js');

export default defineConfig({
	plugins: [
		react(),
	],
	server: {
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
		alias: [
			{ find: '@', replacement: path.resolve(__dirname, './src') },
			{ find: /^html2canvas$/, replacement: disabledPdfRenderer },
			{ find: /^dompurify$/, replacement: disabledPdfRenderer },
			{ find: /^canvg$/, replacement: disabledPdfRenderer },
		],
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('vite/preload-helper')) return 'vendor';
					if (!id.includes('node_modules')) return undefined;
					if (id.includes('/jspdf/')) return 'vendor-pdf';
					if (id.includes('/html2canvas/')) return 'vendor-html2canvas';
					if (
						id.includes('/canvg/')
						|| id.includes('/dompurify/')
						|| id.includes('/pako/')
						|| id.includes('/fflate/')
						|| id.includes('/fast-png/')
						|| id.includes('/iobuffer/')
						|| id.includes('/rgbcolor/')
						|| id.includes('/stackblur-canvas/')
						|| id.includes('/svg-pathdata/')
					) {
						return 'vendor-pdf-renderers';
					}
					if (id.includes('/@vercel/')) return 'vendor-vercel';
					if (id.includes('/framer-motion/')) return 'vendor-motion';
					if (id.includes('/html5-qrcode/')) return 'vendor-qr-scanner';
					if (id.includes('/qrcode.react/')) return 'vendor-qr-renderer';
					if (id.includes('/recharts/')) return 'vendor-charts';
					return undefined;
				},
			},
		},
	},
});
