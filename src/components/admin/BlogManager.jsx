import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from './ConfirmDialog';

const BlogManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    featured_image_url: '',
    category: '',
  });

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar artículos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingArticle && currentUser?.role !== 'admin') {
        toast({ variant: "destructive", title: "No autorizado", description: "Solo los administradores pueden actualizar artículos." });
        return;
      }

      const articleData = {
        ...formData,
        created_by: currentUser.id,
      };

      if (editingArticle) {
        const { error } = await supabase
          .from('blog_articles')
          .update(articleData)
          .eq('id', editingArticle.id);

        if (error) throw error;
        toast({ title: "Artículo actualizado" });
      } else {
        const { error } = await supabase
          .from('blog_articles')
          .insert([articleData]);

        if (error) throw error;
        toast({ title: "Artículo creado" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchArticles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar el artículo",
        description: error.message,
      });
    }
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      featured_image_url: article.featured_image_url || '',
      category: article.category || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (currentUser?.role !== 'admin') {
      toast({ variant: "destructive", title: "No autorizado", description: "Solo los administradores pueden eliminar artículos." });
      return;
    }

    if (!(await confirm({
      title: 'Eliminar artículo',
      message: 'Esta acción no se puede deshacer. El artículo dejará de estar disponible en el blog.',
      confirmLabel: 'Eliminar artículo',
      variant: 'destructive',
    }))) return;

    try {
      const { error } = await supabase.from('blog_articles').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Artículo eliminado" });
      fetchArticles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar el artículo",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setEditingArticle(null);
    setFormData({
      title: '',
      content: '',
      featured_image_url: '',
      category: '',
    });
  };

  return (
    <>
    {ConfirmDialogElement}
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Gestión de Blog</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Artículo
            </Button>
          </DialogTrigger>
          <DialogContent
            className="text-foreground max-w-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
            style={{ background: '#0B1110', borderColor: 'rgba(32,199,232,0.25)' }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(32,199,232,0.08)', border: '1px solid rgba(32,199,232,0.19)' }}
                >
                  <FileText className="w-4 h-4" style={{ color: '#20C7E8' }} />
                </span>
                {editingArticle ? 'Editar artículo' : 'Crear artículo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="content">Contenido</Label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full min-h-[200px] bg-background border border-border text-foreground rounded-md p-3"
                  required
                />
              </div>
              <div>
                <Label htmlFor="featured_image_url">URL de imagen destacada</Label>
                <Input
                  id="featured_image_url"
                  value={formData.featured_image_url}
                  onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                {editingArticle ? 'Actualizar artículo' : 'Crear artículo'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No hay artículos aún</p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex-1">
                  <h3 className="text-foreground font-semibold">{article.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{article.content}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(article)}
                    className="text-secondary hover:text-secondary/80"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(article.id)}
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
    </>
  );
};

export default BlogManager;