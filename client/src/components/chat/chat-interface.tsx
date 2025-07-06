import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MessageCircle, Plus, Send, Bot, User, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Chat {
  id: string;
  userEmail: string;
  title: string;
  type: 'ai' | 'request';
  lastMessage: string;
  lastActivity: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  userEmail: string;
  message: string;
  response?: string;
  type: 'ai' | 'request';
  timestamp: string;
  isFromUser: boolean;
  createdAt: string;
}

interface ChatInterfaceProps {
  userEmail: string;
}

export function ChatInterface({ userEmail }: ChatInterfaceProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [commandType, setCommandType] = useState<'ai' | 'request'>('ai');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch user's chats
  const { data: chats = [], refetch: refetchChats } = useQuery({
    queryKey: ['/api/chats'],
    staleTime: 0,
    cacheTime: 0,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Fetch messages for selected chat
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['/api/chats', selectedChatId, 'messages'],
    enabled: !!selectedChatId,
    staleTime: 0,
    cacheTime: 0,
    meta: {
      headers: {
        'x-user-email': userEmail
      }
    }
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parse command from message
  useEffect(() => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.startsWith('/ai ')) {
      setCommandType('ai');
      setMessage(trimmedMessage.substring(4));
    } else if (trimmedMessage.startsWith('/request ')) {
      setCommandType('request');
      setMessage(trimmedMessage.substring(9));
    }
  }, [message]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; type: 'ai' | 'request'; chatId?: string }) => {
      if (data.chatId) {
        // Add message to existing chat
        return await apiRequest(`/api/chats/${data.chatId}/messages`, {
          method: 'POST',
          body: { message: data.message, isFromUser: true }
        });
      } else {
        // Create new chat with first message
        return await apiRequest('/api/chats', {
          method: 'POST',
          body: { message: data.message, type: data.type }
        });
      }
    },
    onSuccess: (response) => {
      if (!selectedChatId && response.chat) {
        setSelectedChatId(response.chat.id);
      }
      refetchChats();
      refetchMessages();
      setMessage('');
    }
  });

  // Create new chat
  const handleNewChat = () => {
    console.log('New chat button clicked');
    setSelectedChatId(null);
    setMessage('');
    setCommandType('ai');
  };

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      if (!selectedChatId) {
        // Create new chat with first message
        const response = await apiRequest('/api/chats', {
          method: 'POST',
          body: {
            message: message,
            type: commandType
          },
          headers: {
            'x-user-email': userEmail
          }
        });

        if (response.chat) {
          setSelectedChatId(response.chat.id);
        }
        
        refetchChats();
        refetchMessages();
        setMessage('');
      } else {
        // Send to existing chat
        await apiRequest(`/api/chats/${selectedChatId}/messages`, {
          method: 'POST',
          body: {
            message: message,
            isFromUser: true
          },
          headers: {
            'x-user-email': userEmail
          }
        });

        setMessage('');
        // Wait a moment for AI response if this is an AI chat
        const currentChat = chats.find((c: Chat) => c.id === selectedChatId);
        if (currentChat?.type === 'ai') {
          setTimeout(() => {
            refetchMessages();
            refetchChats();
          }, 2000); // Give AI time to respond
        } else {
          refetchMessages();
          refetchChats();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return await apiRequest(`/api/chats/${chatId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      refetchChats();
      if (selectedChatId) {
        setSelectedChatId(null);
      }
    }
  });

  // Filter chats based on search
  const filteredChats = chats.filter((chat: Chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <Button 
              onClick={handleNewChat} 
              size="sm" 
              variant="outline"
              className="cursor-pointer"
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredChats.map((chat: Chat) => (
              <div
                key={chat.id}
                className={`p-3 rounded-lg cursor-pointer mb-2 group hover:bg-muted/50 ${
                  selectedChatId === chat.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedChatId(chat.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={chat.type === 'ai' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {chat.type === 'ai' ? 'AI' : 'Request'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(chat.lastActivity), 'MMM dd')}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {chat.lastMessage}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatMutation.mutate(chat.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {filteredChats.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? 'No chats found' : 'No chats yet. Start a new conversation!'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Always show chat interface */}
        <>
          {/* Chat Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">
                {selectedChatId 
                  ? (chats.find((c: Chat) => c.id === selectedChatId)?.title || 'Chat')
                  : 'New Chat'
                }
              </span>
              <Badge
                variant={
                  selectedChatId 
                    ? (chats.find((c: Chat) => c.id === selectedChatId)?.type === 'ai' ? 'default' : 'secondary')
                    : (commandType === 'ai' ? 'default' : 'secondary')
                }
              >
                {selectedChatId 
                  ? (chats.find((c: Chat) => c.id === selectedChatId)?.type === 'ai' ? 'AI Discussion' : 'Support Request')
                  : (commandType === 'ai' ? 'AI Discussion' : 'Support Request')
                }
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {selectedChatId ? (
              <div className="space-y-4">
                {messages.map((msg: ChatMessage) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.isFromUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.isFromUser ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.timestamp), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      {msg.response && (
                        <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                          <p className="text-sm">{msg.response}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* New Chat Welcome */
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Start a New Conversation</h3>
                  <p className="text-muted-foreground mb-4">
                    Type your message below to begin.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>AI Discussion:</strong> Ask questions about your Notion data, tasks, and projects
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Support Request:</strong> Get help from administrators
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Message Input - Always Available */}
          <div className="p-4 border-t border-border">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Select
                    value={commandType}
                    onValueChange={(value: 'ai' | 'request') => setCommandType(value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">AI Discussion</SelectItem>
                      <SelectItem value="request">Support Request</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    Or type /ai or /request at the start of your message
                  </span>
                </div>
                <Textarea
                  placeholder={`Type your ${commandType === 'ai' ? 'AI question' : 'support request'}...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleSendMessage} disabled={!message.trim() || isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      </div>
    </div>
  );
}