import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Send, Smile, Users, PlusCircle, UserPlus, ChevronDown, ChevronRight, LogIn, Crown, RotateCw, Hotel, Train, Utensils, Coffee, Wine, UtensilsCrossed, CalendarClock, DollarSign, Edit2, Bot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { LiveItinerarySession, ItineraryChange } from '../../types';
import { generateAIQuickPlan } from '../../lib/openai';

interface ItineraryDay {
  id: string;
  dayNumber: number;
  accommodation: string;
  transportation: string;
  budget: string;
  activities: string[];
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  isCollapsed?: boolean;
}

interface ItinerarySection {
  id: string;
  type: 'accommodation' | 'transportation' | 'activity' | 'meal';
  content: string;
}

interface Reaction {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface Message {
  id: number;
  content: string;
  sender_id: string;
  sender_email: string;
  created_at: string;
  reactions?: Reaction[];
}

interface ChatProps {
  groupId: number;
}

interface Group {
  id: number;
  name: string;
  created_by: string;
  join_code?: string;
  active_session?: LiveItinerarySession;
}

interface NewItineraryFormProps {
  groupId?: number;
  initialGroups?: Group[];
}

interface EditPopupProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  title: string;
}

interface AIQuestion {
  id: string;
  question: string;
  response?: string;
  type: 'initial' | 'destination' | 'people' | 'days' | 'occasion' | 'other' | 'confirm';
}

function useClickOutside(ref: React.RefObject<HTMLDivElement>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

const DragDropWrapper: React.FC<{
  onDragEnd: (result: DropResult) => void;
  children: React.ReactNode;
}> = ({ onDragEnd, children }) => (
  <DragDropContext onDragEnd={onDragEnd}>
    {children}
  </DragDropContext>
);

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
    clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

const EMOJI_OPTIONS = ['👍', '❤️', '😊', '🎉', '👏', '🚀', '💯', '⭐'];

const EditPopup: React.FC<EditPopupProps> = ({ isOpen, onClose, value, onChange, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export function NewItineraryForm({ 
  groupId: initialGroupId, 
  initialGroups = [] 
}: NewItineraryFormProps) {
  const [days, setDays] = useState<ItineraryDay[]>([
    {
      id: '1',
      dayNumber: 1,
      accommodation: '',
      transportation: '',
      budget: '',
      activities: [''],
      meals: {
        breakfast: '',
        lunch: '',
        dinner: ''
      }
    }
  ]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [showMembersList, setShowMembersList] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const membersListRef = useRef<HTMLDivElement>(null);
  const membersButtonRef = useRef<HTMLButtonElement>(null);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(days.map(d => d.id)));

  const [liveSession, setLiveSession] = useState<LiveItinerarySession | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);

  const [showAIChat, setShowAIChat] = useState(false);
  const [aiQuestions, setAIQuestions] = useState<AIQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [aiPlanResponses, setAIPlanResponses] = useState<{
    destination?: string;
    people?: string;
    days?: string;
    occasion?: string;
    other?: string;
  }>({});

  useClickOutside(emojiPickerRef, () => {
    setShowEmojiPicker(null);
  });

  useClickOutside(membersListRef, () => {
    const buttonClicked = membersButtonRef.current?.contains(event?.target as Node);
    if (!buttonClicked) {
      setShowMembersList(false);
    }
  });

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newDays = Array.from(days);
    const [movedDay] = newDays.splice(source.index, 1);
    newDays.splice(destination.index, 0, movedDay);

    const updatedDays = newDays.map((day, index) => ({
      ...day,
      dayNumber: index + 1
    }));

    if (liveSession && isOwner) {
      await trackChange('reorder_days', {
        source: result.source,
        destination: result.destination,
        days: updatedDays
      });

      await supabase
        .from('live_itinerary_sessions')
        .update({ 
          itinerary_data: updatedDays 
        })
        .eq('id', liveSession.id);
    }

    setDays(updatedDays);
  };

  const addDay = async () => {
    if (liveSession && !isOwner) return;

    const newDayNumber = days.length + 1;
    const newDay = {
      id: String(newDayNumber),
      dayNumber: newDayNumber,
      accommodation: '',
      transportation: '',
      budget: '',
      activities: [''],
      meals: {
        breakfast: '',
        lunch: '',
        dinner: ''
      }
    };

    const newDays = [...days, newDay];

    if (liveSession) {
      try {
        await trackChange('add_day', { newDay });
        await supabase
          .from('live_itinerary_sessions')
          .update({ 
            itinerary_data: newDays 
          })
          .eq('id', liveSession.id);
      } catch (error) {
        console.error('Error adding day:', error);
        toast.error('Failed to add day');
        return;
      }
    }

    setDays(newDays);
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !groupId) return;

    try {
      const { error } = await supabase
        .from('trip_messages')
        .insert([
          {
            content: newMessage.trim(),
            sender_id: user.id,
            sender_email: user.email,
            group_id: groupId
          }
        ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Add these AI questions at the top with other constants
  const AI_QUESTIONS: AIQuestion[] = [
    {
      id: 'initial',
      question: "Hi! I'll help you plan your trip. First, where would you like to go?",
      type: 'destination'
    },
    {
      id: 'people',
      question: "Great choice! How many people are traveling?",
      type: 'people'
    },
    {
      id: 'days',
      question: "And how many days are you planning to stay?",
      type: 'days'
    },
    {
      id: 'occasion',
      question: "Is this trip for any special occasion? (Optional - type 'skip' to move on)",
      type: 'occasion'
    },
    {
      id: 'other',
      question: "Any other preferences or requirements? (Optional - type 'skip' to move on)",
      type: 'other'
    },
    {
      id: 'confirm',
      question: "Great! I'll generate a travel plan based on your preferences. Would you like me to proceed? (yes/no)",
      type: 'confirm'
    }
  ];

  // Update the handleAIChatButtonClick function
  const handleAIChatButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) {
      toast.error('Please type your question first');
      return;
    }

    // Check for live session first
    if (!liveSession) {
      const aiMessage = {
        content: "Please start a live session first to chat with AI",
        sender_id: user.id,
        sender_email: 'ai@system',
        group_id: groupId,
        is_ai: true,
        created_at: new Date().toISOString()
      };

      const { data: savedMessage, error } = await supabase
        .from('trip_messages')
        .insert(aiMessage)
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message');
        return;
      }

      setMessages(prev => [...prev, savedMessage]);
      setNewMessage('');
      return;
    }

    // Check for owner status
    if (!isOwner) {
      toast.error('Only the group owner can use AI chat');
      return;
    }

    try {
      // Add user's message
      const userMessage = {
        content: newMessage,
        sender_id: user.id,
        sender_email: user.email,
        group_id: groupId,
        is_ai: false,
        created_at: new Date().toISOString()
      };

      const { data: savedUserMessage, error: userMessageError } = await supabase
        .from('trip_messages')
        .insert(userMessage)
        .select()
        .single();

      if (userMessageError) throw userMessageError;
      setMessages(prev => [...prev, savedUserMessage]);
      setNewMessage('');

      // Start AI chat if not already started
      if (!showAIChat) {
        setAIQuestions(AI_QUESTIONS);
        const initialQuestion = AI_QUESTIONS[0];
        
        const aiResponse = {
          content: "I'll help you plan your trip! " + initialQuestion.question,
          sender_id: user.id,
          sender_email: 'ai@system',
          group_id: groupId,
          is_ai: true,
          created_at: new Date().toISOString()
        };

        const { data: savedAIMessage, error: aiMessageError } = await supabase
          .from('trip_messages')
          .insert(aiResponse)
          .select()
          .single();

        if (aiMessageError) throw aiMessageError;
        setMessages(prev => [...prev, savedAIMessage]);
        setShowAIChat(true);
        setCurrentQuestionIndex(0);
      } else {
        // Handle user response to current question
        handleAIResponse(newMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Update the handleAIResponse function
  const handleAIResponse = async (response: string) => {
    if (!user) return;

    try {
      const currentQuestion = aiQuestions[currentQuestionIndex];
      
      // Store response
      setAIPlanResponses(prev => ({
        ...prev,
        [currentQuestion.type]: response
      }));

      if (currentQuestion.type === 'confirm') {
        if (response.toLowerCase().includes('yes')) {
          // Save confirmation message
          const confirmMessage = {
            content: "Great! I'll generate your travel plan now...",
            sender_id: user.id,
            sender_email: 'ai@system',
            group_id: groupId,
            is_ai: true,
            created_at: new Date().toISOString()
          };

          const { data: savedConfirmMessage, error: confirmError } = await supabase
            .from('trip_messages')
            .insert(confirmMessage)
            .select()
            .single();

          if (confirmError) throw confirmError;
          setMessages(prev => [...prev, savedConfirmMessage]);

          // Generate and update itinerary
          setIsGeneratingPlan(true);
          await generateAndUpdateItinerary(aiPlanResponses);
          setShowAIChat(false);
          setCurrentQuestionIndex(0);
        } else {
          const aiMessage = {
            content: "No problem! Let me know if you'd like to try again.",
            sender_id: user.id,
            sender_email: 'ai@system',
            group_id: groupId,
            is_ai: true,
            created_at: new Date().toISOString()
          };

          const { data: savedMessage, error } = await supabase
            .from('trip_messages')
            .insert(aiMessage)
            .select()
            .single();

          if (error) throw error;
          setMessages(prev => [...prev, savedMessage]);
          setShowAIChat(false);
          setCurrentQuestionIndex(0);
        }
        return;
      }

      // Move to next question
      const nextQuestion = aiQuestions[currentQuestionIndex + 1];
      const aiMessage = {
        content: nextQuestion.question,
        sender_id: user.id,
        sender_email: 'ai@system',
        group_id: groupId,
        is_ai: true,
        created_at: new Date().toISOString()
      };

      const { data: savedMessage, error } = await supabase
        .from('trip_messages')
        .insert(aiMessage)
        .select()
        .single();

      if (error) throw error;
      setMessages(prev => [...prev, savedMessage]);
      setCurrentQuestionIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error saving AI response:', error);
      toast.error('Failed to save AI response');
    }
  };

  const generateAndUpdateItinerary = async (planResponses: {
    destination?: string;
    people?: string;
    days?: string;
    occasion?: string;
    other?: string;
  }) => {
    if (!liveSession || !isOwner) return;

    try {
      // Generate plan using OpenAI
      const generatedPlan = await generateAIQuickPlan({
        destination: planResponses.destination || '',
        people: planResponses.people || '',
        days: planResponses.days || '',
        occasion: planResponses.occasion || '',
        other: planResponses.other
      });
      // Show the raw response in chat
      const responseMessage = {
        id: Date.now(),
        content: "✨ Here's your generated plan:\n\n" + JSON.stringify(generatedPlan, null, 2),
        sender_id: 'ai',
        sender_email: 'ai@system',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, responseMessage]);
      console.log('Raw OpenAI response:', generatedPlan);

      // Extract the itinerary array from the response
      let planArray;
      if (Array.isArray(generatedPlan)) {
        planArray = generatedPlan;
      } else if (typeof generatedPlan === 'object') {
        // Look for an array property (itinerary, travelPlan, dayPlan, etc.)
        const arrayProperty = Object.values(generatedPlan).find(value => Array.isArray(value));
        planArray = arrayProperty || [generatedPlan];
      } else {
        planArray = [generatedPlan];
      }

      console.log('Extracted plan array:', planArray);

      // Transform the generated plan to match our itinerary structure
      const formattedDays = planArray.map((day: any) => ({
        id: String(day.dayNumber || '1'),
        dayNumber: day.dayNumber || 1,
        accommodation: day.accommodation ? (
          typeof day.accommodation === 'object' 
            ? `${day.accommodation.name || ''}\n${day.accommodation.address || ''}\n${day.accommodation.details || ''}`
            : day.accommodation
        ).trim() : '',
        transportation: day.transportation ? (
          typeof day.transportation === 'object'
            ? Object.values(day.transportation).filter(Boolean).join('\n')
            : day.transportation
        ).trim() : '',
        budget: day.budget || '',
        activities: Array.isArray(day.activities) 
          ? day.activities.filter(Boolean)
          : [''],
        meals: {
          breakfast: day.meals?.breakfast 
            ? typeof day.meals.breakfast === 'object'
              ? `${day.meals.breakfast.restaurant}: ${day.meals.breakfast.recommendation}`
              : day.meals.breakfast
            : '',
          lunch: day.meals?.lunch
            ? typeof day.meals.lunch === 'object'
              ? `${day.meals.lunch.restaurant}: ${day.meals.lunch.recommendation}`
              : day.meals.lunch
            : '',
          dinner: day.meals?.dinner
            ? typeof day.meals.dinner === 'object'
              ? `${day.meals.dinner.restaurant}: ${day.meals.dinner.recommendation}`
              : day.meals.dinner
            : ''
        }
      }));

      console.log('Formatted days:', formattedDays);

      // Update the database
      const { error } = await supabase
        .from('live_itinerary_sessions')
        .update({ 
          itinerary_data: formattedDays 
        })
        .eq('id', liveSession.id)
        .eq('status', 'active');

      if (error) throw error;

      // Update local state
      setDays(formattedDays);

      // Save the raw plan response to trip_messages
      const planMessage = {
        content: "✨ Here's your generated plan:\n\n" + JSON.stringify(generatedPlan, null, 2),
        sender_id: user.id, // Use actual user ID
        sender_email: 'ai@system',
        group_id: groupId,
        created_at: new Date().toISOString()
      };

      const { data: savedPlanMessage, error: planMessageError } = await supabase
        .from('trip_messages')
        .insert(planMessage)
        .select()
        .single();

      if (planMessageError) throw planMessageError;

      setMessages(prev => [...prev, savedPlanMessage]);

      // Send success message
      const successMessage = {
        content: "✨ I've updated the itinerary with the generated plan. You can now view and edit it in the itinerary view!",
        sender_id: user.id, // Use actual user ID
        sender_email: 'ai@system',
        group_id: groupId,
        created_at: new Date().toISOString()
      };

      const { data: savedSuccessMessage, error: successMessageError } = await supabase
        .from('trip_messages')
        .insert(successMessage)
        .select()
        .single();

      if (successMessageError) throw successMessageError;

      setMessages(prev => [...prev, savedSuccessMessage]);

    } catch (error) {
      console.error('Error generating plan:', error);
      
      // Send error message
      const errorMessage = {
        id: Date.now(),
        content: "Sorry, I encountered an error while updating the itinerary. Please try again.",
        sender_id: user.id, // Use actual user ID
        sender_email: 'ai@system',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      throw error;
    }
  };

  // Add this new function to handle live session notifications
  const handleLiveSessionNotification = (groupName: string, action: 'started' | 'ended') => {
    const notificationMessage = {
      id: Date.now(),
      content: action === 'started' 
        ? `🟢 Live session started for "${groupName}". Click to join the session!`
        : `🔴 Live session ended for "${groupName}"`,
      sender_id: 'system',
      sender_email: 'system@trippy',
      created_at: new Date().toISOString(),
      isNotification: true // Add this to style notifications differently
    };
    setMessages(prev => [...prev, notificationMessage]);
  };

  // Update the useEffect that handles subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to live session changes for all groups
    const subscription = supabase
      .channel('live-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_itinerary_sessions'
        },
        async (payload) => {
          // Find the affected group
          const affectedGroup = groups.find(g => 
            payload.new?.group_id === g.id || payload.old?.group_id === g.id
          );
          
          if (!affectedGroup) return;

          // Check if current user is the owner
          const isCurrentUserOwner = affectedGroup.created_by === user.id;

          if (payload.eventType === 'INSERT' && payload.new.status === 'active') {
            // New live session started
            if (!isCurrentUserOwner) {
              // Only show notification for non-owners
              const notificationMessage = {
                id: Date.now(),
                content: `🟢 Live session started for "${affectedGroup.name}". Click here to join!`,
                sender_id: 'system',
                sender_email: 'system@trippy',
                created_at: new Date().toISOString(),
                isNotification: true
              };
              setMessages(prev => [...prev, notificationMessage]);

              // Show toast notification
              toast((t) => (
                <div className="flex items-center gap-2" onClick={() => {
                  setSelectedGroup(affectedGroup);
                  setGroupId(affectedGroup.id);
                  setShowGroupModal(false);
                  toast.dismiss(t.id);
                }}>
                  <div className="flex-1">
                    Live session started for "{affectedGroup.name}"
                  </div>
                  <button className="px-2 py-1 bg-blue-500 text-white rounded text-sm">
                    Join
                  </button>
                </div>
              ), {
                duration: 5000,
                style: {
                  cursor: 'pointer',
                  background: '#EFF6FF',
                  color: '#1E40AF',
                },
              });
            }
            
            // Update groups state with active session
            setGroups(prev => prev.map(g => 
              g.id === affectedGroup.id 
                ? { ...g, active_session: payload.new }
                : g
            ));

            // If this is the currently selected group, update live session
            if (selectedGroup?.id === affectedGroup.id) {
              setLiveSession(payload.new);
            }
          } else if (
            (payload.eventType === 'UPDATE' && payload.new.status === 'ended') || 
            payload.eventType === 'DELETE'
          ) {
            if (!isCurrentUserOwner) {
              // Only show notification for non-owners
              const notificationMessage = {
                id: Date.now(),
                content: `🔴 Live session ended for "${affectedGroup.name}"`,
                sender_id: 'system',
                sender_email: 'system@trippy',
                created_at: new Date().toISOString(),
                isNotification: true
              };
              setMessages(prev => [...prev, notificationMessage]);
            }
            
            // Update groups state to remove active session
            setGroups(prev => prev.map(g => 
              g.id === affectedGroup.id 
                ? { ...g, active_session: null }
                : g
            ));

            // If this is the currently selected group, update live session
            if (selectedGroup?.id === affectedGroup.id) {
              setLiveSession(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, groups, selectedGroup]);

  useEffect(() => {
    if (!groupId) return;

    const fetchMessages = async () => {
      try {
        const { data: messagesData, error: messagesError } = await supabase
          .from('trip_messages')
          .select(`
            *,
            message_reactions (*)
          `)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;
        
        const messagesWithReactions = messagesData?.map(message => ({
          ...message,
          reactions: message.message_reactions
        })) || [];

        setMessages(messagesWithReactions);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    const fetchCurrentSession = async () => {
      try {
        const { data: sessionData } = await supabase
          .from('live_itinerary_sessions')
          .select('*')
          .eq('group_id', groupId)
          .eq('status', 'active')
          .maybeSingle();

        if (sessionData) {
          setLiveSession(sessionData);
          if (sessionData.itinerary_data && !isOwner) {
            setDays(sessionData.itinerary_data);
          }
        }
      } catch (error) {
        console.error('Error fetching current session:', error);
      }
    };

    fetchCurrentSession();
    fetchMessages();

    const channel = supabase.channel(`room-${groupId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_messages',
          filter: `group_id=eq.${groupId}`
        },
        () => fetchMessages()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        () => fetchMessages()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_itinerary_sessions',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && payload.new.status === 'ended')) {
            setLiveSession(null);
            toast('Live session ended', {
              icon: 'ℹ️',
              style: {
                background: '#EFF6FF',
                color: '#1E40AF',
              },
            });
            return;
          }

          if (payload.eventType === 'INSERT') {
            const session = payload.new as LiveItinerarySession;
            setLiveSession(session);
            if (!isOwner && session.itinerary_data) {
              setDays(session.itinerary_data);
              toast.success('Live session started');
            }
            return;
          }

          if (payload.eventType === 'UPDATE' && payload.new.status === 'active') {
            const session = payload.new as LiveItinerarySession;
            setLiveSession(session);
            if (!isOwner && session.itinerary_data) {
              setDays(session.itinerary_data);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [groupId, isOwner]);

  const generateJoinCode = (): string => {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    return code;
  };

  const handleCreateGroup = async (name: string) => {
    if (!name.trim() || !user) return;
    setIsCreatingGroup(true);
    try {
      const joinCode = generateJoinCode();

      const { data: groupData, error: groupError } = await supabase
        .from('trip_groups')
        .insert([
          {
            name: name.trim(),
            join_code: joinCode,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupData.id,
            user_id: user.id,
            email: user.email,
            joined_at: new Date().toISOString()
          }
        ]);

      if (memberError) throw memberError;

      setGroups(prev => [...prev, groupData]);
      setGroupId(groupData.id);
      setSelectedGroup(groupData);
      setShowGroupModal(false);
      setNewGroupName('');
      toast.success('Group created successfully!');

    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinGroupCode.trim() || isJoiningGroup || !user) return;
    setIsJoiningGroup(true);

    try {
      // First get the group details
      const { data: groupData, error: groupError } = await supabase
        .from('trip_groups')
        .select('*')
        .eq('join_code', joinGroupCode)
        .single();

      if (groupError || !groupData) {
        throw new Error('Invalid join code');
      }

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberCheckError) {
        throw memberCheckError;
      }

      if (existingMember) {
        // If already a member, just select the group and close modal
        setSelectedGroup(groupData);
        setGroupId(groupData.id);
        setShowGroupModal(false);
        return;
      }

      // Add user to group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          email: user.email
        });

      if (memberError) throw memberError;

      // Fetch updated groups list
      const { data: updatedGroups, error: groupsError } = await supabase
        .from('trip_groups')
        .select(`
          *,
          group_members!inner(*)
        `)
        .eq('group_members.user_id', user.id);

      if (groupsError) throw groupsError;
      
      // Update groups list
      setGroups(updatedGroups || []);
      
      // Select the joined group and open chat
      setSelectedGroup(groupData);
      setGroupId(groupData.id);
      setShowGroupModal(false);
      
      toast.success('Successfully joined group!');
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error('Failed to join group. Please check the join code.');
    } finally {
      setIsJoiningGroup(false);
      setJoinGroupCode('');
    }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    if (!user) return;

    try {
      const { data: existingReaction, error: checkError } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingReaction) {
        const { error: deleteError } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('message_reactions')
          .insert([
            {
              message_id: messageId,
              user_id: user.id,
              emoji: emoji
            }
          ]);

        if (insertError) throw insertError;
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from('trip_messages')
        .select(`
          *,
          message_reactions (*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const messagesWithReactions = messagesData?.map(message => ({
        ...message,
        reactions: message.message_reactions
      })) || [];

      setMessages(messagesWithReactions);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Error managing reaction:', error);
      toast.error('Failed to manage reaction');
    }
  };

  useEffect(() => {
    if (!groupId) return;

    const fetchGroupMembers = async () => {
      try {
        const { data: members, error } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId);

        if (error) throw error;
        setGroupMembers(members || []);
      } catch (error) {
        console.error('Error fetching group members:', error);
      }
    };

    const fetchGroupDetails = async () => {
      try {
        const { data: group, error } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('id', groupId)
          .single();

        if (error) throw error;
        setSelectedGroup(group);
      } catch (error) {
        console.error('Error fetching group details:', error);
      }
    };

    fetchGroupMembers();
    fetchGroupDetails();
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !user) return;

    let isSubscribed = true;

    const checkOwnerAndSession = async () => {
      try {
        const { data: groupData } = await supabase
          .from('trip_groups')
          .select('created_by')
          .eq('id', groupId)
          .single();

        if (!isSubscribed) return;
        setIsOwner(groupData?.created_by === user.id);

        const sessionData = await fetchLiveSession(groupId);

        if (!isSubscribed) return;
        if (sessionData) {
          setLiveSession(sessionData);
          if (sessionData.itinerary_data) {
            setDays(sessionData.itinerary_data);
          }
        } else {
          setLiveSession(null);
        }

      } catch (error) {
        console.error('Error checking session:', error);
        if (!isSubscribed) return;
        setLiveSession(null);
      }
    };

    checkOwnerAndSession();

    return () => {
      isSubscribed = false;
    };
  }, [groupId, user]);

  const handleEndSession = async () => {
    // Add confirmation dialog
    const confirmEnd = window.confirm(
      'Are you sure? This is a live chat so AI chats will be lost once you navigate away from this screen.'
    );

    if (!confirmEnd) {
      return; // Don't end session if user cancels
    }

    if (!liveSession || !isOwner) return;

    try {
      const { error } = await supabase
        .from('live_itinerary_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', liveSession.id);

      if (error) throw error;

      // Add end session message
      const endMessage = {
        id: Date.now(),
        content: "🔴 Live session ended",
        sender_id: 'system',
        sender_email: 'system@trippy',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, endMessage]);

      setLiveSession(null);
      toast.success('Live session ended');
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  const startLiveSession = async () => {
    if (!groupId || !user) return;

    try {
      const { data, error } = await supabase
        .from('live_itinerary_sessions')
        .insert([
          {
            group_id: groupId,
            owner_id: user.id,
            status: 'active',
            itinerary_data: days,
            started_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setLiveSession(data);
      toast.success('Live session started');
    } catch (error) {
      console.error('Error starting live session:', error);
      toast.error('Failed to start live session');
    }
  };

  const handleMealChange = (
    mealType: 'breakfast' | 'lunch' | 'dinner',
    value: string,
    dayId: string
  ) => {
    setDays(prevDays => 
      prevDays.map(day => {
        if (day.id === dayId) {
          return {
            ...day,
            meals: {
              ...day.meals,
              [mealType]: value
            }
          };
        }
        return day;
      })
    );

    if (liveSession && isOwner) {
      debouncedUpdateSession(days);
    }
  };

  const handleActivityChange = (
    value: string,
    dayId: string,
    activityIndex: number
  ) => {
    setDays(prevDays => 
      prevDays.map(day => {
        if (day.id === dayId) {
          const newActivities = [...day.activities];
          newActivities[activityIndex] = value;
          return {
            ...day,
            activities: newActivities
          };
        }
        return day;
      })
    );

    if (liveSession && isOwner) {
      debouncedUpdateSession(days);
    }
  };

  useEffect(() => {
    if (!liveSession || isOwner) return;

    const refreshInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('live_itinerary_sessions')
          .select('*')
          .eq('id', liveSession.id)
          .single();

        if (error) throw error;

        if (data.status === 'ended') {
          setLiveSession(null);
          toast('Live session has ended', {
            icon: 'ℹ️',
            style: {
              background: '#EFF6FF',
              color: '#1E40AF',
            },
          });
          clearInterval(refreshInterval);
          return;
        }

        if (data.itinerary_data) {
          setDays(data.itinerary_data);
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }, 2000);

    return () => clearInterval(refreshInterval);
  }, [liveSession, isOwner]);

  const handleDayChange = (
    dayId: string,
    field: keyof ItineraryDay | 'meal',
    value: string | string[],
    mealType?: 'breakfast' | 'lunch' | 'dinner'
  ) => {
    event?.stopPropagation();

    setDays(prevDays => 
      prevDays.map(day => {
        if (day.id === dayId) {
          if (field === 'meal' && mealType) {
            return {
              ...day,
              meals: {
                ...day.meals,
                [mealType]: value as string
              }
            };
          }
          return {
            ...day,
            [field]: value
          };
        }
        return day;
      })
    );

    if (liveSession && isOwner) {
      debouncedUpdateSession(days);
    }
  };

  const debouncedUpdateSession = useMemo(
    () =>
      debounce(async (updatedDays: ItineraryDay[]) => {
        if (!liveSession || !isOwner) return;

        try {
          const { error } = await supabase
            .from('live_itinerary_sessions')
            .update({ 
              itinerary_data: updatedDays 
            })
            .eq('id', liveSession.id)
            .eq('status', 'active');

          if (error) throw error;
        } catch (error) {
          console.error('Error updating session:', error);
        }
      }, 500),
    [liveSession, isOwner]
  );

  const trackChange = async (changeType: ItineraryChange['change_type'], changeData: any) => {
    if (!liveSession || !user) return;

    try {
      await supabase
        .from('itinerary_changes')
        .insert([
          {
            session_id: liveSession.id,
            user_id: user.id,
            change_type: changeType,
            change_data: changeData
          }
        ]);
    } catch (error) {
      console.error('Error tracking change:', error);
    }
  };

  const updateDay = async (index: number, updatedDay: ItineraryDay, shouldSync: boolean = true) => {
    if (liveSession && !isOwner) return;

    const newDays = [...days];
    newDays[index] = updatedDay;
    setDays(newDays);

    if (liveSession && shouldSync) {
      try {
        await debouncedUpdateSession(newDays);
      } catch (error) {
        console.error('Error updating day:', error);
        toast.error('Failed to update day');
      }
    }
  };

  const updateLastActive = async () => {
    if (!liveSession || !user) return;

    try {
      const { error } = await supabase
        .from('session_participants')
        .upsert({
          session_id: liveSession.id,
          user_id: user.id,
          last_active_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,user_id'
        });

      if (error) {
        console.error('Error updating activity:', error);
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  useEffect(() => {
    if (!liveSession || !user) return;

    const interval = setInterval(updateLastActive, 60000);
    
    updateLastActive();

    return () => clearInterval(interval);
  }, [liveSession, user]);

  const fetchUserGroups = async () => {
    if (!user) return;

    try {
      const { data: createdGroups, error: createdError } = await supabase
          .from('trip_groups')
        .select('*')
        .eq('created_by', user.id);

      if (createdError) throw createdError;

      const { data: memberGroups, error: memberError } = await supabase
          .from('group_members')
        .select('trip_groups(*)')
        .eq('user_id', user.id);

        if (memberError) throw memberError;

      const memberGroupsData = memberGroups
        .map(mg => mg.trip_groups)
        .filter(g => g !== null);

      const allGroups = [...(createdGroups || []), ...memberGroupsData];
      const uniqueGroups = Array.from(
        new Map(allGroups.map(group => [group.id, group])).values()
      );

      return uniqueGroups;
      } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
      return [];
    }
  };

  useEffect(() => {
    const loadGroups = async () => {
      const groups = await fetchUserGroups();
      if (groups) {
        setGroups(groups);
      }
    };

    if (user) {
      loadGroups();
    }
  }, [user]);

  const CreateGroupForm = ({ 
    onSubmit, 
    isCreatingGroup 
  }: { 
    onSubmit: (name: string) => void;
    isCreatingGroup: boolean;
  }) => {
    const [groupName, setGroupName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!groupName.trim()) return;
      onSubmit(groupName);
      setGroupName('');
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoComplete="off"
              />
              <button
                type="submit"
          disabled={isCreatingGroup || !groupName.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
          <PlusCircle className="w-4 h-4" />
          {isCreatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </form>
    );
  };

  const JoinGroupForm = ({ 
    onSubmit, 
    isJoiningGroup 
  }: { 
    onSubmit: (code: string) => void;
    isJoiningGroup: boolean;
  }) => {
    const [code, setCode] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;
      onSubmit(code);
      setCode('');
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
          className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoComplete="off"
              />
              <button
                type="submit"
          disabled={isJoiningGroup || !code.trim()}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
          <LogIn className="w-4 h-4" />
          {isJoiningGroup ? 'Joining...' : 'Join Group'}
              </button>
            </form>
    );
  };

  const GroupModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header - Fixed */}
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold">Group Chat Management</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* My Groups Section */}
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-700 mb-3">My Groups</h3>
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {groups.map((group) => (
                <div 
                  key={group.id} 
                  className="flex items-center justify-between p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.name}</span>
                    {group.created_by === user?.id && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        Owner
                      </span>
                    )}
                    {group.active_session && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                        Live
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      handleGroupSelect(group);
                      setShowGroupModal(false);
                    }}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Create New Group Section */}
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Create New Group</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {isCreatingGroup ? (
                  <RotateCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                Create
              </button>
            </div>
          </div>

          {/* Join Existing Group Section */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Join Existing Group</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinGroupCode}
                onChange={(e) => setJoinGroupCode(e.target.value)}
                placeholder="Enter join code"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleJoinGroup}
                disabled={isJoiningGroup || !joinGroupCode.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {isJoiningGroup ? (
                  <RotateCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 border-t flex-shrink-0">
          <button
            onClick={() => setShowGroupModal(false)}
            className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const isInputDisabled = liveSession && !isOwner;

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_itinerary_sessions',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        const session = payload.new as LiveItinerarySession;
        if (payload.eventType === 'INSERT') {
          toast.success('Live session started by group owner');
        } else if (payload.eventType === 'UPDATE' && session.status === 'ended') {
          toast('Live session ended by group owner', {
            icon: 'ℹ️',
            style: {
              background: '#EFF6FF',
              color: '#1E40AF',
            },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    if (selectedGroup) {
      localStorage.setItem('selectedGroup', JSON.stringify(selectedGroup));
    }
  }, [selectedGroup]);

  useEffect(() => {
    const savedGroup = localStorage.getItem('selectedGroup');
    if (savedGroup) {
      const group = JSON.parse(savedGroup);
      setSelectedGroup(group);
      setGroupId(group.id);
    }
  }, []);

  useEffect(() => {
    if (user && selectedGroup) {
      const isMember = groupMembers.some(member => member.user_id === user.id);
      if (!isMember) {
        setSelectedGroup(null);
        setGroupId(undefined);
        localStorage.removeItem('selectedGroup');
      }
    }
  }, [user, groupMembers, selectedGroup]);

  const DayContent = ({ 
    day, 
    index, 
    updateDay, 
    isInputDisabled, 
    debouncedUpdateSession 
  }: { 
    day: ItineraryDay;
    index: number;
    updateDay: (index: number, updatedDay: ItineraryDay, shouldSync?: boolean) => void;
    isInputDisabled: boolean;
    debouncedUpdateSession: (days: ItineraryDay[]) => void;
  }) => {
    const [accommodation, setAccommodation] = useState(day.accommodation);
    const [transportation, setTransportation] = useState(day.transportation);
    const [budget, setBudget] = useState(day.budget);

    const handleInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      dayId: string,
      field: keyof ItineraryDay | 'meal' | 'activities',
      value: string,
      activityIndex?: number
    ) => {
      e.preventDefault();
      e.stopPropagation();
      
      setDays(prevDays => 
        prevDays.map(day => {
          if (day.id === dayId) {
            if (field === 'meal' && mealType) {
              return {
                ...day,
                meals: {
                  ...day.meals,
                  [mealType]: value
                }
              };
            }
            if (field === 'activities' && typeof activityIndex === 'number') {
              const newActivities = [...day.activities];
              newActivities[activityIndex] = value;
              return {
                ...day,
                activities: newActivities
              };
            }
            return {
              ...day,
              [field]: value
            };
          }
          return day;
        })
      );

      if (liveSession && isOwner) {
        debouncedUpdateSession(days);
      }
    };

    const sampleText = {
      accommodation: "Luxury beachfront resort with ocean view rooms and private balcony",
      transportation: "Private shuttle service from airport, local transportation via resort's car service",
      budget: "$500 per day including accommodation and activities",
      activities: [
        "Morning yoga session on the beach",
        "Afternoon scuba diving expedition",
        "Evening sunset cruise with dinner"
      ],
      meals: {
        breakfast: "Buffet breakfast at Ocean View Restaurant with fresh tropical fruits",
        lunch: "Beach club light meals and refreshments",
        dinner: "Fine dining at the resort's signature restaurant"
      }
    };

    const [editPopup, setEditPopup] = useState<{
      isOpen: boolean;
      field: 'accommodation' | 'transportation' | 'budget' | 'activity' | 'breakfast' | 'lunch' | 'dinner';
      value: string;
      title: string;
      index?: number;
    }>({
      isOpen: false,
      field: 'accommodation',
      value: '',
      title: ''
    });

    return (
      <>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 shadow-md border border-pink-200">
              <div className="flex items-center gap-2 mb-3">
                <Hotel className="w-5 h-5 text-pink-600" />
                <h3 className="font-semibold text-pink-800">Accommodation</h3>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={accommodation || sampleText.accommodation}
                  readOnly
                  className="w-full p-2.5 border rounded-md pr-10"
                />
                <button
                  onClick={() => setEditPopup({
                    isOpen: true,
                    field: 'accommodation',
                    value: accommodation || sampleText.accommodation,
                    title: 'Edit Accommodation'
                  })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 shadow-md border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Train className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-800">Transportation</h3>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={transportation || sampleText.transportation}
                  readOnly
                  className="w-full p-2.5 border rounded-md pr-10"
                />
                <button
                  onClick={() => setEditPopup({
                    isOpen: true,
                    field: 'transportation',
                    value: transportation || sampleText.transportation,
                    title: 'Edit Transportation'
                  })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-md border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Budget</h3>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={budget || sampleText.budget}
                  readOnly
                  className="w-full p-2.5 border rounded-md pr-10"
                />
                <button
                  onClick={() => setEditPopup({
                    isOpen: true,
                    field: 'budget',
                    value: budget || sampleText.budget,
                    title: 'Edit Budget'
                  })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-md border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">Activities</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newDays = [...days];
                  newDays[index].activities.push('');
                  updateDay(index, newDays[index], false);
                  debouncedUpdateSession(newDays);
                }}
                className="p-1 hover:bg-blue-100 rounded-full transition-colors"
                disabled={isInputDisabled}
              >
                <Plus className="w-4 h-4 text-blue-600" />
              </button>
            </div>
            <div className="space-y-2">
              {day.activities.map((activity, actIndex) => (
                <div key={actIndex} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={activity || sampleText.activities[actIndex] || ''}
                      readOnly
                      className="w-full p-2.5 border rounded-md pr-10"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditPopup({
                          isOpen: true,
                          field: 'activity',
                          value: activity || sampleText.activities[actIndex] || '',
                          title: 'Edit Activity',
                          index: actIndex
                        });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newDays = [...days];
                      newDays[index].activities = day.activities.filter((_, i) => i !== actIndex);
                      updateDay(index, newDays[index], false);
                      debouncedUpdateSession(newDays);
                    }}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors"
                    disabled={isInputDisabled}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">Meals</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-orange-50/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-orange-600" />
                  <h4 className="font-medium text-orange-800">Breakfast</h4>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={day.meals.breakfast || sampleText.meals.breakfast}
                    readOnly
                    className="w-full p-2.5 border rounded-md pr-10"
                  />
                  <button
                    onClick={() => setEditPopup({
                      isOpen: true,
                      field: 'breakfast',
                      value: day.meals.breakfast || sampleText.meals.breakfast,
                      title: 'Edit Breakfast'
                    })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="bg-green-50/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="w-4 h-4 text-green-600" />
                  <h4 className="font-medium text-green-800">Lunch</h4>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={day.meals.lunch || sampleText.meals.lunch}
                    readOnly
                    className="w-full p-2.5 border rounded-md pr-10"
                  />
                  <button
                    onClick={() => setEditPopup({
                      isOpen: true,
                      field: 'lunch',
                      value: day.meals.lunch || sampleText.meals.lunch,
                      title: 'Edit Lunch'
                    })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wine className="w-4 h-4 text-blue-600" />
                  <h4 className="font-medium text-blue-800">Dinner</h4>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={day.meals.dinner || sampleText.meals.dinner}
                    readOnly
                    className="w-full p-2.5 border rounded-md pr-10"
                  />
                  <button
                    onClick={() => setEditPopup({
                      isOpen: true,
                      field: 'dinner',
                      value: day.meals.dinner || sampleText.meals.dinner,
                      title: 'Edit Dinner'
                    })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EditPopup
          isOpen={editPopup.isOpen}
          onClose={async () => {
            let updatedDays = [...days];
            const dayIndex = updatedDays.findIndex(d => d.id === day.id);

            switch (editPopup.field) {
              case 'accommodation':
              case 'transportation':
              case 'budget':
                updatedDays[dayIndex] = {
                  ...updatedDays[dayIndex],
                  [editPopup.field]: editPopup.value
                };
                break;
              case 'activity':
                if (typeof editPopup.index === 'number') {
                  const newActivities = [...updatedDays[dayIndex].activities];
                  newActivities[editPopup.index] = editPopup.value;
                  updatedDays[dayIndex] = {
                    ...updatedDays[dayIndex],
                    activities: newActivities
                  };
                }
                break;
              case 'breakfast':
              case 'lunch':
              case 'dinner':
                updatedDays[dayIndex] = {
                  ...updatedDays[dayIndex],
                  meals: {
                    ...updatedDays[dayIndex].meals,
                    [editPopup.field]: editPopup.value
                  }
                };
                break;
            }

            if (liveSession && isOwner) {
              try {
                await supabase
                  .from('live_itinerary_sessions')
                  .update({ 
                    itinerary_data: updatedDays 
                  })
                  .eq('id', liveSession.id)
                  .eq('status', 'active');
              } catch (error) {
                console.error('Error updating session:', error);
                toast.error('Failed to save changes');
                return;
              }
            }

            setDays(updatedDays);
            setEditPopup({ ...editPopup, isOpen: false });
          }}
          value={editPopup.value}
          onChange={(value) => setEditPopup({ ...editPopup, value })}
          title={editPopup.title}
        />
      </>
    );
  };

  const refreshItinerary = async (showToast: boolean = false) => {
    if (!liveSession) return;

    try {
      const { data, error } = await supabase
        .from('live_itinerary_sessions')
        .select('*')
        .eq('id', liveSession.id)
        .single();

      if (error) throw error;

      if (data) {
        if (data.status === 'ended') {
          setLiveSession(null);
          toast('Live session has ended', {
            icon: 'ℹ️',
            style: {
              background: '#EFF6FF',
              color: '#1E40AF',
            },
          });
          return;
        }

        setLiveSession(data);
        if (data.itinerary_data) {
          setDays(data.itinerary_data);
        }
        if (showToast) {
          toast.success('Itinerary refreshed');
        }
      }
    } catch (error) {
      console.error('Error refreshing itinerary:', error);
      if (showToast) {
        toast.error('Failed to refresh itinerary');
      }
    }
  };

  useEffect(() => {
    if (!liveSession || isOwner) return;

    const refreshInterval = setInterval(() => {
      refreshItinerary(false);
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [liveSession, isOwner]);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  const fetchLiveSession = async (groupId: number) => {
    try {
      const { data, error } = await supabase
        .from('live_itinerary_sessions')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle()
        .abortSignal(new AbortController().signal);

      if (error) {
        if (error.code === '406') {
          return null;
        }
        console.error('Error fetching live session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching live session:', error);
      return null;
    }
  };

  const handleGroupSelect = async (group: Group) => {
      setGroupId(group.id);
    setSelectedGroup(group);
    
    setLiveSession(null);
    setShowGroupModal(false);
    
    try {
      const sessionData = await fetchLiveSession(group.id);
      if (sessionData) {
        setLiveSession(sessionData);
        if (sessionData.itinerary_data) {
          setDays(sessionData.itinerary_data);
        }
      }
    } catch (error) {
      console.error('Error fetching session on group select:', error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      <div className={`overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#CBD5E1_#F1F5F9] bg-white rounded-lg shadow-lg p-6 ${groupId ? 'w-[55%]' : 'w-full'}`}>
        <div className="flex gap-8 p-8">
          <div className="flex-1">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-gray-800">Live Plan!</h1>
                  {liveSession && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-green-600">
                        Live Session Active for "{selectedGroup?.name}"
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {liveSession && !isOwner && (
                    <button
                      onClick={() => refreshItinerary(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors border border-gray-200 text-sm"
                      title="Auto-refreshing every 2 seconds"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  )}
                  {liveSession && isOwner && (
                    <button
                      onClick={handleEndSession}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                    >
                      End Live Session
                    </button>
                  )}
                  {!liveSession && groupId && selectedGroup?.created_by === user?.id && (
                    <button
                      onClick={startLiveSession}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                    >
                      Start Live Session
                    </button>
                  )}
                  <button
                    onClick={() => setShowGroupModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-blue-200 text-sm"
                  >
                    <Users className="w-4 h-4" />
                    Group Chat
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {liveSession && !isOwner && (
                  <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md">
                    <span className="text-sm text-blue-700">View Only Mode</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <button
              onClick={addDay}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm mx-auto"
              disabled={liveSession && !isOwner}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Empty Template
            </button>
          </div>
        ) : (
          <>
            <DragDropWrapper onDragEnd={handleDragEnd}>
              <Droppable droppableId="days">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-6"
                  >
                    {days.map((day, index) => (
                      <Draggable
                        key={day.id}
                        draggableId={day.id}
                        index={index}
                        isDragDisabled={liveSession && !isOwner}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden"
                          >
                            <div
                              onClick={(e) => {
                                if (!(e.target as HTMLElement).closest('input')) {
                                  const newExpandedDays = new Set(expandedDays);
                                  if (newExpandedDays.has(day.id)) {
                                    newExpandedDays.delete(day.id);
                                  } else {
                                    newExpandedDays.add(day.id);
                                  }
                                  setExpandedDays(newExpandedDays);
                                }
                              }}
                              className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 flex items-center justify-between border-b border-purple-100"
                            >
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                  Day {day.dayNumber}
                                </h2>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpandedDays = new Set(expandedDays);
                                  if (newExpandedDays.has(day.id)) {
                                    newExpandedDays.delete(day.id);
                                  } else {
                                    newExpandedDays.add(day.id);
                                  }
                                  setExpandedDays(newExpandedDays);
                                }}
                                className="p-1 hover:bg-purple-100 rounded-full transition-colors"
                              >
                                {expandedDays.has(day.id) ? (
                                  <ChevronDown className="w-5 h-5 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-gray-600" />
                                )}
                              </button>
                            </div>

                            {expandedDays.has(day.id) && (
                              <div className="p-4">
                                <DayContent
                                  day={day}
                                  index={index}
                                  updateDay={updateDay}
                                  isInputDisabled={liveSession && !isOwner}
                                  debouncedUpdateSession={debouncedUpdateSession}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropWrapper>
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={addDay}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                disabled={liveSession && !isOwner}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Day
              </button>
            </div>
          </>
        )}
      </div>

      {groupId && selectedGroup ? (
        <div className="w-[45%] bg-white rounded-lg shadow-lg flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
            <button
              ref={membersButtonRef}
              onClick={() => setShowMembersList(!showMembersList)}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Show Members"
            >
              <Users className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#CBD5E1_#F1F5F9] p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative group max-w-[70%]">
                  <div className="flex items-center gap-2">
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
                  </div>

                  <div className="flex flex-col">
                    {message.sender_id !== user?.id && (
                      <div className="text-sm text-gray-500 mb-1">
                        {message.sender_email.split('@')[0]}
                      </div>
                    )}

                    <div className="relative group">
                      <div
                        className={`rounded-lg p-3 ${
                          message.is_ai
                            ? 'bg-yellow-100 text-gray-900'  // AI messages always yellow
                            : message.sender_id === user?.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.content}
                      </div>
                      
                      <button
                        onClick={(e) => {
                              e.stopPropagation();
                              setShowEmojiPicker(
                                showEmojiPicker === message.id ? null : message.id
                              );
                            }}
                            className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white shadow-md 
                              opacity-0 group-hover:opacity-100 transition-opacity
                              ${message.sender_id === user?.id ? 'right-full mr-2' : 'left-full ml-2'}`}
                          >
                            <Smile className="w-4 h-4 text-gray-500" />
                      </button>

                      {showEmojiPicker === message.id && (
                        <div
                              className={`absolute top-1/2 -translate-y-1/2 z-50
                                ${message.sender_id === user?.id ? 'right-full mr-10' : 'left-full ml-10'}`}
                            >
                              <div className="bg-white rounded-lg shadow-lg p-2 border">
                                <div className="flex gap-2">
                                  {EMOJI_OPTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddReaction(message.id, emoji);
                                        setShowEmojiPicker(null);
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
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAIChatButtonClick}
                disabled={!isOwner}  // Disable for non-owners
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isOwner 
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                title={isOwner ? "Ask AI" : "Only group owner can use AI"}
              >
                <Bot className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>

          {showMembersList && (
            <div
              ref={membersListRef}
              className="absolute right-8 top-16 w-64 bg-white rounded-lg shadow-lg border p-4 z-[100]"
            >
              <div className="relative">
                <h3 className="font-medium mb-2">Group Members</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {groupMembers
                    .filter(member => member.group_id === selectedGroup?.id)
                    .map(member => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            {member.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm">{member.email.split('@')[0]}</span>
                        </div>
                        {member.user_id === selectedGroup?.created_by && (
                          <Crown className="w-4 h-4 text-yellow-500" title="Group Owner" />
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-[45%] bg-white rounded-lg shadow-lg flex flex-col justify-center items-center p-8">
          {groups.some(g => g.active_session) ? (
            // Show active sessions
            <div className="w-full space-y-4">
              <h3 className="text-lg font-semibold text-center mb-6">Active Live Sessions</h3>
              {groups
                .filter(g => g.active_session)
                .map(group => (
                  <div 
                    key={group.id}
                    className="bg-green-50 border border-green-100 rounded-lg p-4 flex flex-col items-center"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-green-700">Live Session Active</span>
                    </div>
                    <p className="text-gray-700 mb-3">
                      for group "{group.name}"
                    </p>
                    <button
                      onClick={() => handleGroupSelect(group)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Join Session
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            // Default view when no sessions are active
            <div className="space-y-6 text-center">
              <div>
                <Users className="w-12 h-12 text-gray-400 mb-4 mx-auto" />
                <p className="text-gray-600">
                  Select a group chat to start collaborating
                </p>
              </div>
              
              {selectedGroup && liveSession && (
                <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-700 font-medium">
                      Session Active for {selectedGroup.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleGroupSelect(selectedGroup)}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors w-full"
                  >
                    Join Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showGroupModal && <GroupModal />}
    </div>
  );
} 