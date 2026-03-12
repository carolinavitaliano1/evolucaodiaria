import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MessageCircle, Trash2, ExternalLink, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface FeedPost {
  id: string;
  patient_id: string;
  therapist_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image: string | null;
  created_at: string;
  comments: FeedComment[];
  reactions: FeedReaction[];
}

export interface FeedComment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_type: string;
  content: string;
  created_at: string;
}

export interface FeedReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
}

interface FeedPostCardProps {
  post: FeedPost;
  currentUserId: string;
  currentUserName: string;
  currentUserType: 'therapist' | 'patient';
  isTherapist: boolean;
  onDelete?: (postId: string) => void;
  onReactionChange: (postId: string, reactions: FeedReaction[]) => void;
  onCommentAdded: (postId: string, comment: FeedComment) => void;
}

const REACTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'heart', emoji: '❤️' },
  { type: 'star', emoji: '🌟' },
];

function isYoutubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function getYoutubeEmbedId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function FeedPostCard({
  post,
  currentUserId,
  currentUserName,
  currentUserType,
  isTherapist,
  onDelete,
  onReactionChange,
  onCommentAdded,
}: FeedPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [optimisticReactions, setOptimisticReactions] = useState<FeedReaction[]>(post.reactions);

  const myReaction = optimisticReactions.find(r => r.user_id === currentUserId);

  const handleReact = async (reactionType: string) => {
    if (myReaction?.reaction_type === reactionType) {
      // Remove reaction (optimistic)
      const updated = optimisticReactions.filter(r => r.user_id !== currentUserId);
      setOptimisticReactions(updated);
      onReactionChange(post.id, updated);
      await supabase.from('feed_reactions').delete()
        .eq('post_id', post.id).eq('user_id', currentUserId);
    } else if (myReaction) {
      // Change reaction type (optimistic)
      const updated = optimisticReactions.map(r =>
        r.user_id === currentUserId ? { ...r, reaction_type: reactionType } : r
      );
      setOptimisticReactions(updated);
      onReactionChange(post.id, updated);
      await supabase.from('feed_reactions').update({ reaction_type: reactionType })
        .eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      // Add reaction (optimistic)
      const newReaction: FeedReaction = { id: 'temp', post_id: post.id, user_id: currentUserId, reaction_type: reactionType };
      const updated = [...optimisticReactions, newReaction];
      setOptimisticReactions(updated);
      onReactionChange(post.id, updated);
      const { data } = await supabase.from('feed_reactions').insert({
        post_id: post.id, user_id: currentUserId, reaction_type: reactionType
      }).select().single();
      if (data) {
        const final = optimisticReactions
          .filter(r => r.user_id !== currentUserId)
          .concat(data as FeedReaction);
        setOptimisticReactions(final);
        onReactionChange(post.id, final);
      }
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const { data, error } = await supabase.from('feed_comments').insert({
        post_id: post.id,
        user_id: currentUserId,
        author_name: currentUserName,
        author_type: currentUserType,
        content: commentText.trim(),
      }).select().single();
      if (error) throw error;
      onCommentAdded(post.id, data as FeedComment);
      setCommentText('');
    } catch {
      toast.error('Erro ao comentar');
    } finally {
      setSavingComment(false);
    }
  };

  const reactionCounts = REACTIONS.map(r => ({
    ...r,
    count: optimisticReactions.filter(rx => rx.reaction_type === r.type).length,
  }));

  const youtubeId = post.link_url && isYoutubeUrl(post.link_url) ? getYoutubeEmbedId(post.link_url) : null;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-bold">T</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">Terapeuta</p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(post.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        {isTherapist && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Media */}
      {post.media_type === 'image' && post.media_url && (
        <img src={post.media_url} alt="post" className="w-full max-h-96 object-cover" />
      )}
      {post.media_type === 'video' && post.media_url && (
        <video
          src={post.media_url}
          controls
          preload="metadata"
          className="w-full max-h-96 bg-black"
          style={{ display: 'block' }}
        />
      )}

      {/* Link preview */}
      {post.media_type === 'link' && post.link_url && (
        <a
          href={post.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-4 mb-3 flex gap-3 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 transition-colors items-start"
        >
          {youtubeId && (
            <img
              src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
              alt="thumb"
              className="w-20 h-14 object-cover rounded-lg shrink-0"
            />
          )}
          {!youtubeId && post.link_image && (
            <img src={post.link_image} alt="thumb" className="w-20 h-14 object-cover rounded-lg shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{post.link_title || post.link_url}</p>
            <p className="text-[11px] text-muted-foreground break-all line-clamp-2 mt-0.5">{post.link_url}</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </a>
      )}

      {/* Reactions & comment count */}
      <div className="px-4 py-2 flex items-center gap-1 border-t border-border/50">
        {reactionCounts.map(r => (
          <button
            key={r.type}
            onClick={() => handleReact(r.type)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all border',
              myReaction?.reaction_type === r.type
                ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
            )}
          >
            <span>{r.emoji}</span>
            {r.count > 0 && <span>{r.count}</span>}
          </button>
        ))}
        <button
          onClick={() => setShowComments(v => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {post.comments.length > 0 && <span>{post.comments.length}</span>}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {post.comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">Nenhum comentário ainda.</p>
          )}
          {post.comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                c.author_type === 'therapist' ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'
              )}>
                {c.author_name?.[0] ?? '?'}
              </div>
              <div className="bg-muted/50 rounded-xl px-3 py-2 flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground">{c.author_name}</p>
                <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
          {/* Comment input */}
          <div className="flex gap-2 items-center pt-1">
            <Input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
              placeholder="Escreva um comentário..."
              className="text-xs h-8"
              disabled={savingComment}
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleAddComment} disabled={savingComment || !commentText.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
