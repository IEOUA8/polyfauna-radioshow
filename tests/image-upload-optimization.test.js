import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
  calculateContainedDimensions,
  getImageUploadPreset,
  webpFilename,
} from '../src/lib/imageOptimization.js';

const uploadField = readFileSync('src/components/admin/UploadField.jsx', 'utf8');
const r2UploadField = readFileSync('src/components/admin/R2UploadField.jsx', 'utf8');
const editProfile = readFileSync('src/components/EditProfile.jsx', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const podcastManager = readFileSync('src/components/admin/PodcastManager.jsx', 'utf8');
const publishedCoverMigration = readFileSync('supabase/migrations/20260717022000_optimize_published_podcast_cover.sql', 'utf8');

test('las dimensiones conservan proporción y nunca amplían la imagen', () => {
  assert.deepEqual(calculateContainedDimensions(4000, 2000, 1920, 1080), { width: 1920, height: 960 });
  assert.deepEqual(calculateContainedDimensions(800, 800, 1200, 1200), { width: 800, height: 800 });
  assert.deepEqual(calculateContainedDimensions(2000, 4000, 1080, 1600), { width: 800, height: 1600 });
});

test('los nombres de salida siempre terminan en webp', () => {
  assert.equal(webpFilename('portada.final.PNG'), 'portada.final.webp');
  assert.equal(webpFilename('avatar'), 'avatar.webp');
});

test('los presets limitan portadas y avatares según su superficie', () => {
  assert.deepEqual(
    { maxWidth: getImageUploadPreset('square').maxWidth, maxHeight: getImageUploadPreset('square').maxHeight },
    { maxWidth: 1200, maxHeight: 1200 },
  );
  assert.deepEqual(
    { maxWidth: getImageUploadPreset('avatar').maxWidth, maxHeight: getImageUploadPreset('avatar').maxHeight },
    { maxWidth: 640, maxHeight: 640 },
  );
});

test('todos los flujos de carga convierten imágenes antes de subirlas', () => {
  assert.match(uploadField, /optimizeImageForUpload\(file, imagePreset\)/);
  assert.match(uploadField, /contentType: 'image\/webp'/);
  assert.match(r2UploadField, /file\.type\.startsWith\('image\/'\)/);
  assert.match(r2UploadField, /optimizeImageForUpload\(file, imagePreset\)/);
  assert.match(editProfile, /optimizeImageForUpload\(file, 'avatar'\)/);
  assert.match(eventManager, /imagePreset="eventBanner"/);
  assert.match(eventManager, /imagePreset="eventMobile"/);
  assert.match(eventManager, /imagePreset="eventTicket"/);
  assert.match(podcastManager, /imagePreset="square"/);
});

test('la portada publicada tiene backfill WebP liviano e idempotente', () => {
  const coverPath = 'public/media/podcasts/plano-de-fase-serie-001-nous.webp';
  assert.ok(statSync(coverPath).size < 120 * 1024);
  assert.match(publishedCoverMigration, /plano-de-fase-serie-001-nous\.webp/);
  assert.match(publishedCoverMigration, /AND cover_url = 'https:\/\/pub-[^']+\.png'/);
});
