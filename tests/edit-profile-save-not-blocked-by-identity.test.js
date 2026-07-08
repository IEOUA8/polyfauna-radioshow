import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editProfile = readFileSync('src/components/EditProfile.jsx', 'utf8');

test('guardar perfil no exige identidad completa antes de tocar la base de datos', () => {
  // Bug: handleSave hacia return antes de llamar a supabase si full_name o
  // document_number estaban vacios, bloqueando TODO el guardado (incluida
  // la foto) para cuentas que nunca completaron su identidad de ticketing.
  const handleSaveBody = editProfile.slice(
    editProfile.indexOf('const handleSave = async'),
    editProfile.indexOf('const handleSave = async') + 400
  );
  assert.doesNotMatch(handleSaveBody, /if \(!identity\.full_name\.trim\(\)/);

  // El upsert a profiles debe ser la primera operacion de handleSave, sin
  // condicionarla a la identidad.
  assert.match(handleSaveBody, /await supabase\.from\('profiles'\)\s*\n\s*\.upsert/);
});

test('user_identity solo se guarda cuando ambos campos estan presentes, sin bloquear el resto', () => {
  assert.match(editProfile, /const hasIdentityInput = identity\.full_name\.trim\(\) && identity\.document_number\.trim\(\)/);
  assert.match(editProfile, /\(error \|\| !hasIdentityInput\) \? \{ error: null \} : await supabase/);
});

test('guardado exitoso sin identidad muestra confirmacion, no error', () => {
  assert.match(editProfile, /else if \(!hasIdentityInput\) \{/);
  assert.match(editProfile, /Tus cambios se guardaron\. Completa tu nombre y número de documento/);
});
