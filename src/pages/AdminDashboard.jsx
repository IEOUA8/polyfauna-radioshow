import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Play, Heart, Loader2 } from 'lucide-react';
import EventManager from '@/components/admin/EventManager';
import PodcastManager from '@/components/admin/PodcastManager';
import BlogManager from '@/components/admin/BlogManager';
import InterviewManager from '@/components/admin/InterviewManager';
import ShowManager from '@/components/admin/ShowManager';
import UserManager from '@/components/admin/UserManager';
import ArtistManager from '@/components/admin/ArtistManager';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalPlays: 0, totalLikes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, likesRes, favsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_likes').select('id', { count: 'exact', head: true }),
        supabase.from('user_favorites').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalPlays: likesRes.count || 0,
        totalLikes: favsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-8 pb-32 px-4 poly-bg overflow-hidden text-foreground">
      <div className="poly-texture" />
      <Helmet>
        <title>Admin Dashboard - POLYFAUNA - Fractal Radio / Experimental Electronic Broadcast</title>
        <meta name="description" content="Manage POLYFAUNA content and users" />
      </Helmet>

      <div className="container mx-auto max-w-7xl relative z-10">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-10 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent drop-shadow-sm">
          Admin Dashboard
        </h1>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="poly-surface rounded-3xl border-white/5 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Users</CardTitle>
              <Users className="w-6 h-6 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : (
                <div className="text-5xl font-extrabold text-white">{stats.totalUsers}</div>
              )}
            </CardContent>
          </Card>

          <Card className="poly-surface rounded-3xl border-white/5 hover:border-secondary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Likes</CardTitle>
              <Play className="w-6 h-6 text-secondary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="w-8 h-8 text-secondary animate-spin" />
              ) : (
                <div className="text-5xl font-extrabold text-white">{stats.totalPlays}</div>
              )}
            </CardContent>
          </Card>

          <Card className="poly-surface rounded-3xl border-white/5 hover:border-accent/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Favoritos</CardTitle>
              <Heart className="w-6 h-6 text-accent" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              ) : (
                <div className="text-5xl font-extrabold text-white">{stats.totalLikes}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Management Tabs */}
        <div className="poly-surface rounded-[2.5rem] p-6 md:p-10 border border-white/5">
          <Tabs defaultValue="events" className="space-y-8">
            <TabsList className="bg-[#121212] border border-white/10 flex-wrap h-auto p-2 rounded-2xl gap-2 justify-start">
              <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Events</TabsTrigger>
              <TabsTrigger value="podcasts" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Podcasts</TabsTrigger>
              <TabsTrigger value="blog" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Blog</TabsTrigger>
              <TabsTrigger value="interviews" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Interviews</TabsTrigger>
              <TabsTrigger value="shows" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Shows</TabsTrigger>
              <TabsTrigger value="artists" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Artists</TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-secondary data-[state=active]:text-white rounded-xl px-6 py-3 font-bold">Users</TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="events"><EventManager /></TabsContent>
              <TabsContent value="podcasts"><PodcastManager /></TabsContent>
              <TabsContent value="blog"><BlogManager /></TabsContent>
              <TabsContent value="interviews"><InterviewManager /></TabsContent>
              <TabsContent value="shows"><ShowManager /></TabsContent>
              <TabsContent value="artists"><ArtistManager /></TabsContent>
              <TabsContent value="users"><UserManager /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;