import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Heart, Clock, Trash2, Edit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const UserDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '' });
  const [favorites, setFavorites] = useState([]);
  const [playbackHistory, setPlaybackHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      setEditData({ name: currentUser.name, email: currentUser.email });
      fetchUserData();
    }
  }, [currentUser]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      const { data: favData } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      setFavorites(favData || []);

      const { data: historyData } = await supabase
        .from('user_playback_history')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('played_at', { ascending: false })
        .limit(20);

      setPlaybackHistory(historyData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editData.name })
        .eq('id', currentUser.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    }
  };

  const handleRemoveFavorite = async (id) => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFavorites(favorites.filter(f => f.id !== id));
      toast({ title: "Removed from favorites" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleRemoveHistory = async (id) => {
    try {
      const { error } = await supabase
        .from('user_playback_history')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPlaybackHistory(playbackHistory.filter(h => h.id !== id));
      toast({ title: "Removed from history" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const groupedFavorites = {
    podcasts: favorites.filter(f => f.content_type === 'podcast'),
    events: favorites.filter(f => f.content_type === 'event'),
    interviews: favorites.filter(f => f.content_type === 'interview'),
    artists: favorites.filter(f => f.content_type === 'artist'),
  };

  return (
    <div className="relative min-h-screen pt-8 pb-32 px-4 poly-bg overflow-hidden text-foreground">
      <div className="poly-texture" />
      <Helmet>
        <title>My Dashboard - POLYFAUNA - Fractal Radio / Experimental Electronic Broadcast</title>
        <meta name="description" content="Manage your POLYFAUNA profile and preferences" />
      </Helmet>

      <div className="container mx-auto max-w-6xl relative z-10">
        <Card className="poly-surface rounded-3xl mb-8 border-white/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                  <User className="w-12 h-12 text-white" />
                </div>
                <div>
                  <CardTitle className="text-4xl font-bold text-white mb-2">{currentUser?.name}</CardTitle>
                  <p className="text-muted-foreground text-lg">{currentUser?.email}</p>
                  <p className="inline-block mt-3 px-3 py-1 bg-white/10 text-white rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">
                    {currentUser?.role} Account
                  </p>
                </div>
              </div>
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-white/10 text-white bg-[#222222] hover:bg-primary/20 hover:border-primary/50">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="poly-surface-elevated text-white max-w-md rounded-3xl border-white/10">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Edit Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div>
                      <Label htmlFor="edit-name" className="text-muted-foreground font-bold uppercase text-xs mb-2 block">Name</Label>
                      <Input
                        id="edit-name"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="bg-[#121212] border-white/10 text-white h-12 rounded-xl focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email" className="text-muted-foreground font-bold uppercase text-xs mb-2 block">Email (read-only)</Label>
                      <Input
                        id="edit-email"
                        value={editData.email}
                        disabled
                        className="bg-black/50 border-white/5 text-muted-foreground h-12 rounded-xl cursor-not-allowed"
                      />
                    </div>
                    <Button onClick={handleUpdateProfile} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                      Save Changes
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="history" className="space-y-8">
          <TabsList className="bg-[#1A1A1A] border border-white/5 p-1 rounded-xl">
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-6">
              <Clock className="w-4 h-4 mr-2" />
              Playback History
            </TabsTrigger>
            <TabsTrigger value="favorites" className="data-[state=active]:bg-secondary data-[state=active]:text-white rounded-lg px-6">
              <Heart className="w-4 h-4 mr-2" />
              Favorites
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card className="poly-surface rounded-3xl border-white/5">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-white">Recently Played</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : playbackHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12 font-medium">No playback history yet</p>
                ) : (
                  <div className="space-y-4">
                    {playbackHistory.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between p-5 bg-[#121212] rounded-2xl border border-white/5 hover:border-white/20 transition-all"
                      >
                        <div>
                          <p className="text-white font-bold text-lg capitalize mb-1">{item.content_type}</p>
                          <p className="text-sm text-muted-foreground font-medium">
                            {new Date(item.played_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveHistory(item.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites">
            <div className="space-y-8">
              {['podcasts', 'events', 'interviews', 'artists'].map((type) => (
                <Card key={type} className="poly-surface rounded-3xl border-white/5">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-white capitalize">Liked {type}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-secondary animate-spin" />
                      </div>
                    ) : groupedFavorites[type].length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 font-medium">No {type} saved yet</p>
                    ) : (
                      <div className="space-y-4">
                        {groupedFavorites[type].map((fav) => (
                          <motion.div
                            key={fav.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-between p-5 bg-[#121212] rounded-2xl border border-white/5 hover:border-white/20 transition-all"
                          >
                            <div>
                              <p className="text-white font-bold mb-1">Content ID: <span className="font-mono text-secondary">{fav.content_id.slice(0, 8)}...</span></p>
                              <p className="text-sm text-muted-foreground font-medium">
                                Added {new Date(fav.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFavorite(fav.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserDashboard;