import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const protectedRoute = readFileSync('src/components/ProtectedRoute.jsx', 'utf8');
const authContext = readFileSync('src/contexts/AuthContext.jsx', 'utf8');

test('Panel operativo navega dentro del router sin recargar la sesión móvil', () => {
  assert.match(mobileMenu, /import \{ useNavigate \} from 'react-router-dom'/);
  assert.match(mobileMenu, /const navigate\s*=\s*useNavigate\(\)/);
  assert.match(mobileMenu, /if \(item\.href\) \{\s*onClose\(\);\s*navigate\(item\.href\);/);
  assert.doesNotMatch(mobileMenu, /window\.location\.assign\(item\.href\)/);
});

test('la ruta protegida espera el rol restaurado antes de decidir acceso a admin', () => {
  assert.match(protectedRoute, /userRole == null && \(requireAdmin \|\| allowedRoles\)/);
  assert.match(protectedRoute, /return <RouteLoader \/>/);

  const waitForRole = protectedRoute.indexOf('userRole == null');
  const denyRole = protectedRoute.indexOf('!allowedRoles.includes(userRole)');
  assert.ok(waitForRole > -1 && waitForRole < denyRole);
});

test('la hidratación del rol continúa aunque fallen tareas secundarias de inicio', () => {
  assert.match(authContext, /try \{\s*await consumePendingOAuthRole\(authUser\);/);
  assert.match(authContext, /try \{\s*await notifyPendingRoleRequest\(authUser\);/);

  const optionalNotification = authContext.indexOf('await notifyPendingRoleRequest(authUser)');
  const requiredProfile = authContext.indexOf('await fetchUserProfile(authUser)', optionalNotification);
  assert.ok(optionalNotification > -1 && requiredProfile > optionalNotification);
});
