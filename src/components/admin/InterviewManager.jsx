import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from './ConfirmDialog';

const InterviewManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    content: '',
    format: '',
    image_url: '',
  });

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInterviews(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching interviews",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingInterview && currentUser?.role !== 'admin') {
        toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can update interviews." });
        return;
      }

      const interviewData = {
        ...formData,
        created_by: currentUser.id,
      };

      if (editingInterview) {
        const { error } = await supabase
          .from('interviews')
          .update(interviewData)
          .eq('id', editingInterview.id);

        if (error) throw error;
        toast({ title: "Interview updated successfully" });
      } else {
        const { error } = await supabase
          .from('interviews')
          .insert([interviewData]);

        if (error) throw error;
        toast({ title: "Interview created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchInterviews();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error saving interview",
        description: error.message,
      });
    }
  };

  const handleEdit = (interview) => {
    setEditingInterview(interview);
    setFormData({
      title: interview.title,
      subject: interview.subject,
      content: interview.content,
      format: interview.format || '',
      image_url: interview.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (currentUser?.role !== 'admin') {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can delete interviews." });
      return;
    }

    if (!(await confirm({
      title: 'Eliminar entrevista',
      message: 'Esta acción no se puede deshacer. La entrevista dejará de estar disponible.',
      confirmLabel: 'Eliminar entrevista',
      variant: 'destructive',
    }))) return;

    try {
      const { error } = await supabase.from('interviews').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Interview deleted successfully" });
      fetchInterviews();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting interview",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setEditingInterview(null);
    setFormData({
      title: '',
      subject: '',
      content: '',
      format: '',
      image_url: '',
    });
  };

  return (
    <>
    {ConfirmDialogElement}
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Interviews Management</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingInterview ? 'Edit Interview' : 'Create Interview'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject/Interviewee</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="format">Format</Label>
                <Input
                  id="format"
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder="Video, Audio, Text"
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full min-h-[200px] bg-background border border-border text-foreground rounded-md p-3"
                  required
                />
              </div>
              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                {editingInterview ? 'Update Interview' : 'Create Interview'}
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
        ) : interviews.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No interviews yet</p>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => (
              <div
                key={interview.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex-1">
                  <h3 className="text-foreground font-semibold">{interview.title}</h3>
                  <p className="text-sm text-muted-foreground">with {interview.subject}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(interview)}
                    className="text-secondary hover:text-secondary/80"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(interview.id)}
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

export default InterviewManager;