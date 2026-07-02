import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const albumManager = readFileSync('src/components/admin/AlbumManager.jsx', 'utf8');
const tracksRequireAlbum = readFileSync('supabase/migrations/20260702200933_tracks_require_album.sql', 'utf8');

test('los tracks se crean desde el álbum, no desde un gestor independiente', () => {
  assert.equal(existsSync('src/components/admin/TrackManager.jsx'), false);
  assert.doesNotMatch(adminDashboard, /TrackManager/);
  assert.doesNotMatch(adminDashboard, /id: 'tracks'/);
  assert.doesNotMatch(adminDashboard, /case 'tracks'/);

  // AlbumManager gestiona tracks anidados por álbum, sin selector de álbum
  // en el formulario de track (el álbum ya está implícito por contexto).
  assert.match(albumManager, /const toggleExpand = \(albumId\) =>/);
  assert.match(albumManager, /\.eq\('album_id', albumId\)/);
  assert.match(albumManager, /album_id: trackDialogAlbum/);
  assert.doesNotMatch(albumManager, /<option value="">Sin álbum<\/option>/);

  // album_id ya no puede ser nulo — un sencillo es un álbum de un track
  assert.match(tracksRequireAlbum, /ALTER COLUMN album_id SET NOT NULL/);
});
