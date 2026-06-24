import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trash2, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ROLES = ['citizen', 'artist', 'promoter', 'club', 'sello', 'admin'];
const ROLE_COLOR = {
  citizen: '#20C7E8', artist: '#A78BFA', promoter: '#F59E0B',
  club: '#34D399', sello: '#10B981', admin: '#F87171',
};

const UserManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al cargar usuarios', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: newRole,
        p_reason: 'Cambio manual desde panel admin',
      });
      if (error) throw error;
      toast({ title: 'Rol actualizado' });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar rol',
        description: error.code === '42883' ? 'Aplica la migración de gobernanza antes de cambiar roles.' : error.message,
      });
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('¿Seguro que quieres eliminar este perfil? El usuario perderá acceso.')) return;
    try {
      const { error } = await supabase.rpc('delete_profile_admin', {
        p_user_id: userId,
        p_reason: 'Eliminado desde panel admin',
      });
      if (error) throw error;
      toast({ title: 'Perfil eliminado' });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.code === '42883' ? 'Aplica la migración de gobernanza antes de eliminar perfiles.' : error.message,
      });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Gestión de Usuarios ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Sin usuarios registrados aún</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <User className="w-4 h-4 text-white/40" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold truncate">
                      {user.display_name || user.username || user.id.slice(0, 8)}
                    </p>
                    {user.city && (
                      <p className="text-xs text-muted-foreground">{user.city}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{
                      background: `${ROLE_COLOR[user.role] || '#20C7E8'}18`,
                      color: ROLE_COLOR[user.role] || '#20C7E8',
                      border: `1px solid ${ROLE_COLOR[user.role] || '#20C7E8'}30`,
                    }}
                  >
                    {user.role || 'citizen'}
                  </span>
                  <select
                    value={user.role || 'citizen'}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="bg-background border border-border text-foreground rounded-md px-2 py-1 text-xs"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(user.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManager;
