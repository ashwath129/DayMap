import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { X, Send, Smile, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { GroupMembers } from '../group/GroupMembers';

interface Reaction {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface Message {
  id: number;
  group_id: number;
  content: string;
  sender_id: string;
  sender_email: string;
  created_at: string;
  reactions?: Reaction[];
}

interface GroupChatProps {
  groupId: number;
  groupName: string;
  joinCode?: string;
  createdBy: string;
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😊', '🎉', '👏', '🚀', '💯', '⭐'];

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div className="absolute z-50 bg-white rounded-lg shadow-lg p-2 border transform -translate-y-full">
      <div className="flex gap-2">
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="hover:bg-gray-100 p-1 rounded"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let dateDisplay = '';
  if (date.toDateString() === today.toDateString()) {
    dateDisplay = 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    dateDisplay = 'Yesterday';
  } else {
    dateDisplay = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  const timeDisplay = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);

  return `${dateDisplay} ${timeDisplay}`;
}

export function GroupChat({ groupId, groupName, joinCode, createdBy }: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeReactionMessage, setActiveReactionMessage] = useState<number | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      // First get messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('trip_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Then get reactions for these messages
      const messageIds = messagesData?.map(m => m.id) || [];
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (reactionsError) throw reactionsError;

      // Combine messages with their reactions
      const messagesWithReactions = messagesData?.map(message => ({
        ...message,
        reactions: reactionsData?.filter(r => r.message_id === message.id) || []
      }));

      setMessages(messagesWithReactions || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      await fetchMessages();

      // Subscribe to new messages
      const messageChannel = supabase
        .channel('new-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trip_messages',
            filter: `group_id=eq.${groupId}`
          },
          (payload) => {
            const newMessage = payload.new as Message;
            setMessages(prev => [...prev, { ...newMessage, reactions: [] }]);
            scrollToBottom();
          }
        )
        .subscribe();

      // Subscribe to new reactions
      const reactionChannel = supabase
        .channel('new-reactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions'
          },
          () => {
            fetchMessages(); // Refresh all messages to get updated reactions
          }
        )
        .subscribe();

      return () => {
        messageChannel.unsubscribe();
        reactionChannel.unsubscribe();
      };
    };

    setupChat();
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('trip_messages')
        .insert([
          {
            group_id: groupId,
            content: newMessage.trim(),
            sender_id: user.id,
            sender_email: user.email
          }
        ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    try {
      // Check if user already reacted with this emoji
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();

      if (existingReaction) {
        // Remove the reaction if it already exists
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } else {
        // Add new reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert([
            {
              message_id: messageId,
              user_id: user.id,
              emoji
            }
          ]);

        if (error) throw error;
      }

      // Refresh messages to get updated reactions
      await fetchMessages();
      setActiveReactionMessage(null);
    } catch (error) {
      console.error('Error managing reaction:', error);
      toast.error('Failed to manage reaction');
    }
  };

  const handleCopyJoinCode = () => {
    if (joinCode) {
      navigator.clipboard.writeText(joinCode);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      toast.success('Join code copied to clipboard!');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{groupName}</h2>
          {joinCode && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-gray-500">Join Code: {joinCode}</span>
              <button
                onClick={handleCopyJoinCode}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy join code"
              >
                {showCopied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex-shrink-0">
        <GroupMembers groupId={groupId} createdBy={createdBy} />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className="relative group max-w-[70%]">
              {/* Message content with reactions */}
              <div className="flex items-center gap-2">
                {/* For logged-in user's messages, show reactions on the left */}
                {message.sender_id === user?.id && (
                  <div className="flex items-center gap-1">
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex gap-1">
                        {Object.entries(
                          message.reactions.reduce((acc: { [key: string]: number }, reaction) => {
                            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji]) => (
                          <span
                            key={emoji}
                            className="text-sm bg-white shadow-sm border px-1.5 py-0.5 rounded-full"
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col">
                  {message.sender_id !== user?.id && (
                    <div className="text-sm text-gray-500 mb-1">
                      {message.sender_email.split('@')[0]}
                    </div>
                  )}

                  <div className="relative group">
                    <div
                      className={`rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div>{message.content}</div>
                    </div>

                    {/* Reaction button */}
                    <button
                      onClick={() => setActiveReactionMessage(
                        activeReactionMessage === message.id ? null : message.id
                      )}
                      className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white shadow-md 
                        opacity-0 group-hover:opacity-100 transition-opacity
                        ${message.sender_id === user?.id ? 'right-full mr-2' : 'left-full ml-2'}`}
                    >
                      <Smile className="w-4 h-4 text-gray-500" />
                    </button>

                    {/* Emoji picker */}
                    {activeReactionMessage === message.id && (
                      <div 
                        className={`absolute top-1/2 -translate-y-1/2 z-50
                          ${message.sender_id === user?.id ? 'right-full mr-10' : 'left-full ml-10'}`}
                      >
                        <div className="bg-white rounded-lg shadow-lg p-2 border">
                          <div className="flex gap-2">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  handleAddReaction(message.id, emoji);
                                  setActiveReactionMessage(null);
                                }}
                                className="hover:bg-gray-100 p-1 rounded"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`text-xs text-gray-500 mt-1 ${
                    message.sender_id === user?.id ? 'text-right' : 'text-left'
                  }`}>
                    {formatMessageTime(message.created_at)}
                  </div>
                </div>

                {/* For other users' messages, show reactions on the right */}
                {message.sender_id !== user?.id && (
                  <div className="flex items-center gap-1">
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex gap-1">
                        {Object.entries(
                          message.reactions.reduce((acc: { [key: string]: number }, reaction) => {
                            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji]) => (
                          <span
                            key={emoji}
                            className="text-sm bg-white shadow-sm border px-1.5 py-0.5 rounded-full"
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
} 