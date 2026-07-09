import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const nvmrc = readFileSync('.nvmrc', 'utf8').trim();

test('@supabase/supabase-js esta en una version reciente (no la 2.30.0 original)', () => {
  // Causa raiz de "se queda en Guardando" con una sesion de recuperacion
  // real (no reproducible con datos falsos): la 2.30.0 (de mediados de
  // 2023) tiene el bug documentado en supabase-js#1441, #1594, #2013 y
  // #2111 — updateUser()/setSession() solo resuelven si hay error; en
  // exito, el cliente se queda esperando para siempre un lock interno
  // (Web Locks API / navigator.locks) que nunca se libera. Las versiones
  // recientes usan un camino "lockless" por defecto (single-flight +
  // resolucion de carreras del lado del servidor) que elimina esa clase
  // de deadlock — ver auth-js CHANGELOG y el comentario `lock` deprecado
  // en GoTrueClientOptions.
  const version = pkg.dependencies['@supabase/supabase-js'];
  const [major, minor] = version.replace(/^[^\d]*/, '').split('.').map(Number);
  assert.equal(major, 2);
  assert.ok(minor >= 100, `esperaba minor >= 100, encontre ${version}`);
});

test('la version de supabase-js instalada respeta el Node de CI/Vercel (.nvmrc)', () => {
  // @supabase/supabase-js@2.110.0+ exige Node >=22; este repo esta
  // fijado a Node 20 en .nvmrc (usado por CI y por Vercel para el build).
  // Subir mas alla de 2.109.x rompe el build sin subir tambien el Node
  // de la plataforma — fuera de alcance de este fix puntual.
  assert.match(nvmrc, /^20\./);
  const version = pkg.dependencies['@supabase/supabase-js'];
  const [, minor] = version.replace(/^[^\d]*/, '').split('.').map(Number);
  assert.ok(minor <= 109, `${version} podria exigir Node >=22 y romper el build en Node ${nvmrc}`);
});
