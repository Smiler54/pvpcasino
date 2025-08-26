import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

interface JackpotLiveChatProps {
  gameId?: string;
}

export const JackpotLiveChat = ({ gameId }: JackpotLiveChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Load recent messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages' as any)
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;
        setMessages((data as unknown as ChatMessage[]) || []);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => [...prev.slice(-49), newMsg]);
      })
      .subscribe();

    // Subscribe to user presence
    const presenceChannel = supabase
      .channel('jackpot-chat-presence')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined chat:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left chat:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('chat_messages' as any)
        .insert({
          user_id: user.id,
          username: user.user_metadata?.username || 'Anonymous',
          message: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold gradient-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Live Chat
          </div>
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {onlineUsers}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 p-4 pt-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 min-h-0 pr-4" ref={scrollAreaRef}>
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {message.username}
                    </span>
                    <span>{formatTime(message.created_at)}</span>
                  </div>
                  <div className="text-sm bg-secondary/30 rounded-lg px-3 py-2">
                    {message.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        {user ? (
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
              maxLength={500}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !newMessage.trim()}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center p-3 bg-secondary/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Sign in to join the chat
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};