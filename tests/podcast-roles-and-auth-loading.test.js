import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJsx = readFileSync('src/App.jsx', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const podcastManager = readFileSync('src/components/admin/PodcastManager.jsx', 'utf8');
const podcastsPage = readFileSync('src/components/PodcastsPage.jsx', 'utf8');
const controlCenter = readFileSync('src/components/ControlCenter.jsx', 'utf8');
const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const podcastRolesMigration = readFileSync('supabase/migrations/20260702192510_podcast_upload_roles_and_admin_write.sql', 'utf8');
const ticketVault = readFileSync('src/components/TicketVault.jsx', 'utf8');
const organism = readFileSync('src/components/Organism.jsx', 'utf8');
const signalInbox = readFileSync('src/components/SignalInbox.jsx', 'utf8');

test('subir podcast es exclusivo de club/artista/sello/colectivo y se gestiona desde el panel operativo', () => {
  // La página pública de podcasts ya no tiene botón de subir ni el modal
  assert.doesNotMatch(podcastsPage, /UploadPodcastModal/);
  assert.doesNotMatch(podcastsPage, />\s*Subir\s*</);
  assert.doesNotMatch(podcastsPage, /CREATOR_ROLES/);

  // Control Center tampoco tiene su propio atajo de subida — todo apunta a /admin
  assert.doesNotMatch(controlCenter, /UploadPodcastModal/);
  assert.doesNotMatch(controlCenter, /showUpload/);

  // /admin queda accesible para artist y sello (antes solo admin/promoter/club)
  assert.match(appJsx, /allowedRoles=\{\['admin', 'promoter', 'club', 'artist', 'sello'\]\}/);
  assert.match(mobileMenu, /\['promoter', 'club', 'artist', 'sello', 'admin'\]\.includes\(role\)/);
  assert.match(controlCenter, /\['promoter', 'club', 'artist', 'sello', 'admin'\]\.includes\(role\)/);

  // El panel calcula el permiso de podcasts explícitamente (excluye promotor individual, incluye colectivo)
  assert.match(adminDashboard, /canManagePodcasts = isAdmin \|\| userRole === 'artist' \|\| userRole === 'club' \|\| userRole === 'sello'/);
  assert.match(adminDashboard, /userRole === 'promoter' && currentUser\?\.organizer_type === 'collective'/);
  assert.match(adminDashboard, /PodcastManager ownerId=\{isAdmin \? null : currentUser\?\.id\}/);

  // La política RLS refleja el mismo conjunto de roles
  assert.match(podcastRolesMigration, /role IN \('artist', 'club', 'sello', 'admin'\)/);
  assert.match(podcastRolesMigration, /role = 'promoter' AND organizer_type = 'collective'/);
  assert.match(podcastRolesMigration, /CREATE POLICY "podcasts_admin_all" ON public\.podcasts/);

  // PodcastManager queda scopeado por dueño y marca quién subió cada episodio
  assert.match(podcastManager, /const PodcastManager = \(\{ ownerId = null \}\)/);
  assert.match(podcastManager, /podcastsQuery\.eq\('uploaded_by', ownerId\)/);
  assert.match(podcastManager, /uploaded_by: currentUser\.id/);
});

test('Ticket Vault, Control Center, Organismo y Signal Inbox esperan a que resuelva la sesión antes de pedir login', () => {
  for (const [name, source] of [
    ['TicketVault', ticketVault],
    ['ControlCenter', controlCenter],
    ['Organism', organism],
    ['SignalInbox', signalInbox],
  ]) {
    assert.match(source, /isLoading: authLoading/, `${name} debe leer isLoading de useAuth()`);
    assert.match(source, /if \(authLoading\)/, `${name} debe verificar authLoading antes que currentUser`);
    assert.match(source, /PulseLoader/, `${name} debe mostrar un loader, no LoginRequired, mientras resuelve la sesión`);
  }
});
