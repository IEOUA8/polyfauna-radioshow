import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editProfile = readFileSync('src/components/EditProfile.jsx', 'utf8');
const useProfile = readFileSync('src/hooks/useProfile.js', 'utf8');
const deletePolicy = readFileSync('supabase/migrations/20260721000000_avatar_owner_delete_policy.sql', 'utf8');

test('el avatar muestra porcentaje y solo llega a 100 cuando Storage confirma la carga', () => {
  assert.match(editProfile, /const \[uploadProgress, setUploadProgress\] = useState\(0\)/);
  assert.match(editProfile, /await supabase\.storage\.from\('avatars'\)\.upload[\s\S]*setUploadProgress\(100\)/);
  assert.match(editProfile, /role="progressbar"/);
  assert.match(editProfile, /Imagen lista · ya puedes guardar/);
});

test('guardar queda bloqueado mientras la imagen sigue subiendo', () => {
  assert.match(editProfile, /disabled=\{saving \|\| uploading\}/);
  assert.match(editProfile, /if \(uploading\) return/);
  assert.match(editProfile, /Espera a que termine la imagen/);
});

test('el nuevo perfil se propaga a todas las vistas y el avatar anterior se limpia después de guardar', () => {
  const saveIndex = editProfile.indexOf("supabase.from('profiles')");
  const removeIndex = editProfile.indexOf("storage.from('avatars').remove");
  assert.ok(saveIndex >= 0 && removeIndex > saveIndex);
  assert.match(editProfile, /pf:profile-updated/);
  assert.match(useProfile, /addEventListener\('pf:profile-updated'/);
  assert.match(deletePolicy, /FOR DELETE TO authenticated/);
  assert.match(deletePolicy, /storage\.foldername\(name\)/);
});
