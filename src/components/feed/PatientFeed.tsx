import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FeedPostCreator } from './FeedPostCreator';
import { FeedPostCard, FeedPost, FeedComment, FeedReaction } from './FeedPostCard';
import { Loader2, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PatientFeedProps {
  patientId: string;
  therapistId: string;
  therapistName?: string;
  isTherapist: boolean;
  currentUserId: string;
  currentUserName: string;
}

export function PatientFeed({
  patientId,
  therapistId,
  therapistName,
  isTherapist,
  currentUserId,
  currentUserName,
}: PatientFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const patientIdRef = useRef(patientId);
  patientIdRef.current = patientId;

  const loadPosts = async (pid: string) => {
    try {
      const { data: postsData, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('patient_id', pid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(p => p.id);

      const [{ data: commentsData }, { data: reactionsData }] = await Promise.all([
        supabase.from('feed_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }),
        supabase.from('feed_reactions').select('*').in('post_id', postIds),
      ]);

      const merged: FeedPost[] = postsData.map(p => ({
        ...p,
        media_url: p.media_url ?? null,
        media_type: p.media_type ?? null,
        link_url: p.link_url ?? null,
        link_title: p.link_title ?? null,
        link_image: p.link_image ?? null,
        comments: (commentsData ?? []).filter(c => c.post_id === p.id) as FeedComment[],
        reactions: (reactionsData ?? []).filter(r => r.post_id === p.id) as FeedReaction[],
      }));

      setPosts(merged);
    } catch {
      toast.error('Erro ao carregar o mural');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPosts(patientId);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`feed-posts-${patientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts', filter: `patient_id=eq.${patientId}` }, () => {
        loadPosts(patientIdRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, () => {
        loadPosts(patientIdRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_reactions' }, () => {
        loadPosts(patientIdRef.current);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeletePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post?.media_url) {
      try {
        const url = new URL(post.media_url);
        const pathParts = url.pathname.split('/feed_media/');
        if (pathParts[1]) {
          await supabase.storage.from('feed_media').remove([pathParts[1]]);
        }
      } catch {}
    }
    const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
    if (error) { toast.error('Erro ao excluir'); return; }
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success('Post removido');
  };

  const handleReactionChange = (postId: string, reactions: FeedReaction[]) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions } : p));
  };

  const handleCommentAdded = (postId: string, comment: FeedComment) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
    ));
  };

  return (
    <div className="space-y-4">
      {isTherapist && (
        <FeedPostCreator
          patientId={patientId}
          therapistId={therapistId}
          therapistName={therapistName}
          onPostCreated={loadPosts}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Newspaper className="w-7 h-7 text-primary/50" />
          </div>
          <p className="font-medium text-foreground">Nenhuma postagem ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isTherapist ? 'Publique uma novidade, foto ou conquista do paciente!' : 'Seu terapeuta ainda não publicou nada aqui.'}
          </p>
        </div>
      )}

      {!loading && posts.map(post => (
        <FeedPostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserType={isTherapist ? 'therapist' : 'patient'}
          isTherapist={isTherapist}
          onDelete={isTherapist ? handleDeletePost : undefined}
          onReactionChange={handleReactionChange}
          onCommentAdded={handleCommentAdded}
        />
      ))}
    </div>
  );
}
