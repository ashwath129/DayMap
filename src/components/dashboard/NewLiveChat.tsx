import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Send, Users, Crown, Clock, Hotel, Train, MapPin, Calendar, X, ChevronDown, ChevronRight, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface LiveSession {
  id: number;
  group_id: number;
  owner_id: string;
  title: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at?: string;
}

interface LiveItinerary {
  id: number;
  session_id: number;
  day_number: number;
  title: string;
  date?: string;
  accommodation: string;
  transportation: string;
  notes: string;
  activities: LiveActivity[];
}

interface LiveActivity {
  id: number;
  itinerary_id: number;
  time: string;
  description: string;
  location: string;
}

interface Message {
  id: number;
  group_id: number;
  content: string;
  sender_id: string;
  sender_email: string;
  created_at: string;
}

// Add debounce utility at the top
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};

// Add these new interfaces
interface GroupNotification {
  hasNewMessages: boolean;
  hasActiveSession: boolean;
}

// Add these utility functions at the top
const NOTIFICATION_STORAGE_KEY = 'chat-notifications';

const getStoredNotifications = (): Record<number, GroupNotification> => {
  const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

const setStoredNotifications = (notifications: Record<number, GroupNotification>) => {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
};

// Add this interface
interface GroupMember {
  id: number;
  user_id: string;
  email: string;
}

// Add interface for session participant
interface SessionParticipant {
  id: number;
  session_id: number;
  user_id: string;
  user_email: string;
  joined_at: string;
}

export function NewLiveChat() {
  const [user, setUser] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [itineraryDays, setItineraryDays] = useState<LiveItinerary[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [groupNotifications, setGroupNotifications] = useState<Record<number, GroupNotification>>({});
  const [lastSeenMessages, setLastSeenMessages] = useState<Record<number, number>>({});
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Fetch user and groups on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const fetchGroups = async () => {
      if (!user) return;

      try {
        // Get groups user created
        const { data: ownedGroups, error: ownedError } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('created_by', user.id);

        // Get groups user is member of
        const { data: memberGroups, error: memberError } = await supabase
          .from('group_members')
          .select('trip_groups(*)')
          .eq('user_id', user.id);

        if (ownedError || memberError) throw ownedError || memberError;

        const allGroups = [
          ...(ownedGroups || []),
          ...(memberGroups?.map(m => m.trip_groups) || [])
        ].filter((group, index, self) => 
          index === self.findIndex((g) => g.id === group.id)
        );

        setGroups(allGroups);
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast.error('Failed to load groups');
      }
    };

    fetchGroups();
  }, [user?.id]);

  // Initialize notifications from localStorage
  useEffect(() => {
    if (user?.id) {
      const storedNotifications = getStoredNotifications();
      setGroupNotifications(storedNotifications);
    }
  }, [user?.id]);

  // Set up global message subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('global-notifications');

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_messages'
      }, (payload) => {
        const newMessage = payload.new as Message;
        
        // If message is from another user and not in current view
        if (newMessage.sender_id !== user.id) {
          const notifications = getStoredNotifications();
          const updatedNotifications = {
            ...notifications,
            [newMessage.group_id]: {
              ...notifications[newMessage.group_id],
              hasNewMessages: true
            }
          };
          setStoredNotifications(updatedNotifications);
          setGroupNotifications(updatedNotifications);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  // Update fetchGroupMembers to get session participants
  const fetchGroupMembers = async (groupId: number) => {
    try {
      // Get group members
      const { data: members, error } = await supabase
        .from('group_members')
        .select('id, user_id, email')
        .eq('group_id', groupId);

      if (error) throw error;

      // Get group owner
      const { data: group, error: groupError } = await supabase
        .from('trip_groups')
        .select('created_by, created_by_email')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      // If there's an active session, get session participants
      if (liveSession) {
        const { data: participants, error: participantsError } = await supabase
          .from('new_session_participants')
          .select('*')
          .eq('session_id', liveSession.id);

        if (participantsError) throw participantsError;

        // Set group members based on session participants
        if (participants) {
          setGroupMembers(participants.map(p => ({
            id: p.id,
            user_id: p.user_id,
            email: p.user_email
          })));
          return;
        }
      }

      // If no active session, show all group members
      const allMembers = [
        { 
          id: 0, 
          user_id: group.created_by, 
          email: group.created_by_email 
        },
        ...(members || [])
      ];

      setGroupMembers(allMembers);
    } catch (error) {
      console.error('Error fetching group members:', error);
    }
  };

  // Update startSession function to handle duplicate participants
  const startSession = async () => {
    if (!selectedGroup || !user) return;
    setIsSessionLoading(true);

    try {
      // 1. Create new session
      const { data: session, error: sessionError } = await supabase
        .from('new_live_sessions')
        .insert([{
          group_id: selectedGroup.id,
          owner_id: user.id,
          title: `${selectedGroup.name}'s Trip Plan`,
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null // Explicitly set to null
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Get all group members
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, email')
        .eq('group_id', selectedGroup.id);

      if (membersError) throw membersError;

      // 3. Create unique participants array (no duplicates)
      const uniqueParticipants = [
        {
          session_id: session.id,
          user_id: user.id,
          user_email: user.email
        },
        ...groupMembers
          .filter(member => member.user_id !== user.id) // Filter out owner if they're also in group_members
          .map(member => ({
            session_id: session.id,
            user_id: member.user_id,
            user_email: member.email
          }))
      ];

      // Add participants
      const { error: participantsError } = await supabase
        .from('new_session_participants')
        .insert(uniqueParticipants);

      if (participantsError) throw participantsError;

      // 4. Create initial itinerary day
      const { data: itinerary, error: itineraryError } = await supabase
        .from('new_live_itineraries')
        .insert([{
          session_id: session.id,
          day_number: 1,
          title: 'Day 1',
          accommodation: '',
          transportation: '',
          notes: ''
        }])
        .select()
        .single();

      if (itineraryError) throw itineraryError;

      // Update local state
      setLiveSession(session);
      setItineraryDays([{ ...itinerary, activities: [] }]);
      await fetchSessionParticipants(session.id);
      
      toast.success('Live session started');
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast.error(error.message || 'Failed to start session');
    } finally {
      setIsSessionLoading(false);
    }
  };

  // Add function to fetch session participants
  const fetchSessionParticipants = async (sessionId: number) => {
    try {
      const { data: participants, error } = await supabase
        .from('new_session_participants')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;

      // Filter out any participants without valid email
      const validParticipants = participants?.filter(p => p.user_email) || [];
      
      setGroupMembers(validParticipants.map(p => ({
        id: p.id,
        user_id: p.user_id,
        email: p.user_email // Map user_email to email
      })));
    } catch (error) {
      console.error('Error fetching session participants:', error);
    }
  };

  // Update handleGroupSelect to include message fetching
  const handleGroupSelect = async (group: any) => {
    setSelectedGroup(group);
    setIsOwner(group.created_by === user?.id);
    
    try {
      // Fetch messages first
      await fetchMessages(group.id);

      // Check for active session
      const { data: activeSession } = await supabase
        .from('new_live_sessions')
        .select('*')
        .eq('group_id', group.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .maybeSingle();

      if (activeSession) {
        setLiveSession(activeSession);
        
        // Fetch session participants
        await fetchSessionParticipants(activeSession.id);
        
        // Fetch itinerary
        const { data: itinerary } = await supabase
          .from('new_live_itineraries')
          .select(`
            *,
            activities:new_live_activities(*)
          `)
          .eq('session_id', activeSession.id)
          .order('day_number', { ascending: true });

        setItineraryDays(itinerary || []);
        
        if (!isOwner) {
          toast.success('Joined active planning session');
        }
      } else {
        setLiveSession(null);
        setItineraryDays([]);
        // Get regular group members when no active session
        const { data: members } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', group.id);
        setGroupMembers(members || []);
      }

      // Clear message notifications when group is selected
      const notifications = getStoredNotifications();
      const updatedNotifications = {
        ...notifications,
        [group.id]: {
          ...notifications[group.id],
          hasNewMessages: false
        }
      };
      setStoredNotifications(updatedNotifications);
      setGroupNotifications(updatedNotifications);

    } catch (error) {
      console.error('Error loading group data:', error);
      toast.error('Failed to load group data');
    }
  };

  // Fetch messages for selected group
  const fetchMessages = async (groupId: number) => {
    try {
      const { data, error } = await supabase
        .from('trip_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  // Fetch current live session
  const fetchCurrentSession = async (groupId: number) => {
    try {
      const { data, error } = await supabase
        .from('new_live_sessions')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLiveSession(data);
        await fetchItinerary(data.id);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      toast.error('Failed to load session');
    }
  };

  // Fetch itinerary for a session
  const fetchItinerary = async (sessionId: number) => {
    try {
      const { data: days, error: daysError } = await supabase
        .from('new_live_itineraries')
        .select(`
          *,
          activities:new_live_activities(*)
        `)
        .eq('session_id', sessionId)
        .order('day_number', { ascending: true });

      if (daysError) throw daysError;
      
      // Only update state if data has changed
      const currentDaysJSON = JSON.stringify(itineraryDays);
      const newDaysJSON = JSON.stringify(days);
      
      if (currentDaysJSON !== newDaysJSON) {
        console.log('Updating itinerary state with new data');
        setItineraryDays(days || []);
      }
    } catch (error) {
      console.error('Error fetching itinerary:', error);
      if (!isOwner) {
        toast.error('Failed to sync with owner\'s changes');
      }
    }
  };

  // Update endSession function to properly clean up
  const endSession = async () => {
    if (!liveSession) return;
    setIsSessionLoading(true);

    try {
      // 1. End the session
      const { error: sessionError } = await supabase
        .from('new_live_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', liveSession.id);

      if (sessionError) throw sessionError;

      // 2. Delete session participants
      const { error: participantsError } = await supabase
        .from('new_session_participants')
        .delete()
        .eq('session_id', liveSession.id);

      if (participantsError) throw participantsError;

      // 3. Update local state
      setLiveSession(null);
      setItineraryDays([]);
      setGroupMembers([]);

      // 4. Fetch regular group members
      if (selectedGroup) {
        const { data: members } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', selectedGroup.id);
        setGroupMembers(members || []);
      }

      toast.success('Live session ended');
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast.error(error.message || 'Failed to end session');
    } finally {
      setIsSessionLoading(false);
    }
  };

  // Add a new day to the itinerary
  const addDay = async (sessionId: number) => {
    if (!liveSession || !isOwner) return;

    try {
      const newDayNumber = itineraryDays.length + 1;
      const { data: newDay, error } = await supabase
        .from('new_live_itineraries')
        .insert([{
          session_id: sessionId,
          day_number: newDayNumber,
          title: `Day ${newDayNumber}`,
          accommodation: '',
          transportation: '',
          notes: ''
        }])
        .select()
        .single();

      if (error) throw error;
      setItineraryDays([...itineraryDays, { ...newDay, activities: [] }]);
    } catch (error) {
      console.error('Error adding day:', error);
      toast.error('Failed to add day');
    }
  };

  // Update the debounced update function to be more efficient
  const debouncedUpdateDay = debounce(async (dayId: number, updates: Partial<LiveItinerary>) => {
    try {
      const { error } = await supabase
        .from('new_live_itineraries')
        .update(updates)
        .eq('id', dayId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating day:', error);
      toast.error('Failed to update itinerary');
    }
  }, 500);

  // Add immediate update function for better UX
  const handleDayUpdate = (dayId: number, field: keyof LiveItinerary, value: string) => {
    // Update local state immediately
    setItineraryDays(days => 
      days.map(day => 
        day.id === dayId 
          ? { ...day, [field]: value }
          : day
      )
    );
    
    // Debounce the database update
    debouncedUpdateDay(dayId, { [field]: value });
  };

  // Update the refresh function to mimic full group selection
  const refreshItinerary = async () => {
    if (!liveSession?.id || !selectedGroup) return;
    
    try {
      // Show loading state
      setIsLoading(true);

      // Fetch messages first
      await fetchMessages(selectedGroup.id);
      
      // Check for active session
      const { data: activeSession } = await supabase
        .from('new_live_sessions')
        .select('*')
        .eq('group_id', selectedGroup.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .maybeSingle();

      if (activeSession) {
        setLiveSession(activeSession);
        
        // Fetch session participants
        await fetchSessionParticipants(activeSession.id);
        
        // Fetch itinerary
        const { data: itinerary } = await supabase
          .from('new_live_itineraries')
          .select(`
            *,
            activities:new_live_activities(*)
          `)
          .eq('session_id', activeSession.id)
          .order('day_number', { ascending: true });

        setItineraryDays(itinerary || []);
        
        if (!isOwner) {
          toast.success('Session refreshed');
        }
      } else {
        setLiveSession(null);
        setItineraryDays([]);
        // Get regular group members when no active session
        const { data: members } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', selectedGroup.id);
        setGroupMembers(members || []);
      }

      // Clear message notifications
      const notifications = getStoredNotifications();
      const updatedNotifications = {
        ...notifications,
        [selectedGroup.id]: {
          ...notifications[selectedGroup.id],
          hasNewMessages: false
        }
      };
      setStoredNotifications(updatedNotifications);
      setGroupNotifications(updatedNotifications);

    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Failed to refresh session');
    } finally {
      setIsLoading(false);
    }
  };

  // Add an activity to a day
  const addActivity = async (dayId: number) => {
    if (!liveSession || !isOwner) return;

    try {
      const { data: newActivity, error } = await supabase
        .from('new_live_activities')
        .insert([{
          itinerary_id: dayId,
          time: '',
          description: '',
          location: ''
        }])
        .select()
        .single();

      if (error) throw error;

      setItineraryDays(prevDays => 
        prevDays.map(day => 
          day.id === dayId 
            ? { ...day, activities: [...day.activities, newActivity] }
            : day
        )
      );
    } catch (error) {
      console.error('Error adding activity:', error);
      toast.error('Failed to add activity');
    }
  };

  // Update the sendMessage function to handle optimistic updates better
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    // Create temporary message with a unique temporary ID
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId, // Use string ID to avoid conflicts with DB-generated IDs
      group_id: selectedGroup.id,
      content: messageContent,
      sender_id: user.id,
      sender_email: user.email,
      created_at: new Date().toISOString()
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, tempMessage]);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const { data, error } = await supabase
        .from('trip_messages')
        .insert([{
          group_id: selectedGroup.id,
          content: messageContent,
          sender_id: user.id,
          sender_email: user.email
        }])
        .select()
        .single();

      if (error) throw error;

      // Replace temporary message with real one
      setMessages(prev => prev.map(msg => 
        // Use type assertion to compare string and number IDs
        (msg.id as any) === tempId ? data : msg
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Remove temporary message if failed
      setMessages(prev => prev.filter(msg => (msg.id as any) !== tempId));
      setNewMessage(messageContent);
    }
  };

  // Add this function to handle activity updates
  const debouncedUpdateActivity = debounce(async (
    activityId: number,
    field: keyof LiveActivity,
    value: string
  ) => {
    if (!liveSession || !isOwner) return;

    try {
      const { error } = await supabase
        .from('new_live_activities')
        .update({ [field]: value })
        .eq('id', activityId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Failed to update activity');
    }
  }, 500);

  // Add delete activity handler
  const deleteActivity = async (dayId: number, activityId: number) => {
    if (!liveSession || !isOwner) return;

    try {
      const { error } = await supabase
        .from('new_live_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      setItineraryDays(prevDays =>
        prevDays.map(day =>
          day.id === dayId
            ? {
                ...day,
                activities: day.activities.filter(a => a.id !== activityId)
              }
            : day
        )
      );
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    }
  };

  // Update the real-time subscription to avoid duplicate messages
  useEffect(() => {
    if (!user?.id) return;

    const setupChat = async () => {
      // Subscribe to new messages for all groups
      const messageChannel = supabase
        .channel('new-chat-messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages'
        }, (payload) => {
          const newMessage = payload.new as Message;
          
          // Only add message if it's from another user
          if (newMessage.sender_id !== user.id) {
            // If this is the current group, add to messages
            if (selectedGroup?.id === newMessage.group_id) {
              setMessages(prev => [...prev, newMessage]);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
              // Show notification for unselected groups
              setGroupNotifications(prev => ({
                ...prev,
                [newMessage.group_id]: {
                  ...prev[newMessage.group_id],
                  hasNewMessages: true
                }
              }));
              // Optional: Play notification sound
              new Audio('/notification.mp3').play().catch(() => {});
            }
          }
        })
        .subscribe();

      return () => {
        messageChannel.unsubscribe();
      };
    };

    setupChat();
  }, [user?.id, selectedGroup?.id]);

  // Add reconnection handling
  useEffect(() => {
    if (!selectedGroup?.id || !liveSession?.id) return;

    const handleReconnection = () => {
      console.log('Reconnecting to realtime channels...');
      fetchMessages(selectedGroup.id);
      fetchItinerary(liveSession.id);
    };

    window.addEventListener('online', handleReconnection);
    
    return () => {
      window.removeEventListener('online', handleReconnection);
    };
  }, [selectedGroup?.id, liveSession?.id]);

  // Add optimistic updates for activities
  const handleActivityUpdate = (
    activityId: number,
    field: keyof LiveActivity,
    value: string
  ) => {
    // Immediately update UI
    setItineraryDays(prevDays =>
      prevDays.map(day => ({
        ...day,
        activities: day.activities.map(activity =>
          activity.id === activityId
            ? { ...activity, [field]: value }
            : activity
        )
      }))
    );

    // Debounce the server update
    debouncedUpdateActivity(activityId, field, value);
  };

  // Add day deletion functionality
  const deleteDay = async (dayId: number) => {
    if (!liveSession || !isOwner) return;

    try {
      // Delete all activities first
      const { error: activitiesError } = await supabase
        .from('new_live_activities')
        .delete()
        .eq('itinerary_id', dayId);

      if (activitiesError) throw activitiesError;

      // Then delete the day
      const { error: dayError } = await supabase
        .from('new_live_itineraries')
        .delete()
        .eq('id', dayId);

      if (dayError) throw dayError;

      // Update local state
      setItineraryDays(prevDays => 
        prevDays.filter(day => day.id !== dayId)
          .map((day, index) => ({
            ...day,
            day_number: index + 1,
            title: `Day ${index + 1}`
          }))
      );

      toast.success('Day deleted');
    } catch (error) {
      console.error('Error deleting day:', error);
      toast.error('Failed to delete day');
    }
  };

  // Update the session subscription to properly handle real-time updates
  useEffect(() => {
    if (!user?.id || !selectedGroup?.id) return;

    const channel = supabase.channel(`live-session-${selectedGroup.id}`);

    // Subscribe to session changes
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'new_live_sessions',
        filter: `group_id=eq.${selectedGroup.id}`
      }, async (payload) => {
        console.log('Session change detected:', payload);
        
        // New session started
        if (payload.eventType === 'INSERT') {
          const session = payload.new as LiveSession;
          console.log('New session:', session);
          
          if (session.status === 'active') {
            setLiveSession(session);
            await fetchItinerary(session.id);
            
            if (session.owner_id !== user.id) {
              toast.success('Owner started a live planning session');
            }
          }
        }
        // Session updated
        else if (payload.eventType === 'UPDATE') {
          const session = payload.new as LiveSession;
          if (session.status === 'ended') {
            setLiveSession(null);
            setItineraryDays([]);
            toast.info('Live session ended');
          }
        }
      })
      .subscribe();

    // Check for existing active session on mount
    const checkExistingSession = async () => {
      try {
        const { data: session } = await supabase
          .from('new_live_sessions')
          .select('*')
          .eq('group_id', selectedGroup.id)
          .eq('status', 'active')
          .is('ended_at', null)
          .maybeSingle();

        if (session) {
          console.log('Found existing session:', session);
          setLiveSession(session);
          await fetchItinerary(session.id);
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      }
    };

    checkExistingSession();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, selectedGroup?.id]);

  // Add real-time subscription for itinerary updates
  useEffect(() => {
    if (!liveSession?.id) return;

    const channel = supabase.channel(`itinerary-updates-${liveSession.id}`);

    channel
      // Listen for itinerary changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'new_live_itineraries',
        filter: `session_id=eq.${liveSession.id}`
      }, async () => {
        console.log('Itinerary update detected');
        await fetchItinerary(liveSession.id);
      })
      // Listen for activity changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'new_live_activities'
      }, async (payload) => {
        const activity = payload.new as LiveActivity;
        // Check if the activity belongs to any of our itinerary days
        const belongsToSession = itineraryDays.some(day => 
          day.activities.some(a => a.id === activity.id)
        );
        if (belongsToSession) {
          console.log('Activity update detected');
          await fetchItinerary(liveSession.id);
        }
      })
      .subscribe();

    // Also set up a polling interval as a backup
    const pollInterval = setInterval(() => {
      fetchItinerary(liveSession.id);
    }, 5000); // Poll every 5 seconds

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [liveSession?.id]);

  // Component JSX
  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      {/* Group selection sidebar */}
      <div className="w-64 bg-white rounded-lg shadow-lg p-4">
        <h2 className="text-lg font-semibold mb-4">My Groups</h2>
        <div className="space-y-2">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => handleGroupSelect(group)}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors relative
                ${selectedGroup?.id === group.id 
                  ? 'bg-blue-50 text-blue-600 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">{group.name}</span>
                {group.created_by === user?.id && (
                  <Crown className="w-3 h-3 text-yellow-500" />
                )}
              </div>
              
              {/* Notification indicators */}
              {groupNotifications[group.id] && (
                <div className="flex gap-1 items-center">
                  {groupNotifications[group.id].hasNewMessages && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" 
                         title="New messages" />
                  )}
                  {groupNotifications[group.id].hasActiveSession && (
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" 
                         title="Active session in progress" />
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4">
        {selectedGroup ? (
          <>
            {/* Live Itinerary */}
            <div className="w-1/2 bg-white rounded-lg shadow-lg flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Live Itinerary</h2>
                    <button
                      onClick={refreshItinerary}
                      className="p-1 hover:bg-gray-100 rounded-full"
                      title="Refresh itinerary"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2">
                      {!liveSession ? (
                        <button
                          onClick={startSession}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                        >
                          Start Session
                        </button>
                      ) : (
                        <button
                          onClick={endSession}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                        >
                          End Session
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Show participants when session is active */}
                {liveSession && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Participants:</span>
                    <div className="flex flex-wrap gap-2">
                      {groupMembers.filter(member => member?.email).map(member => (
                        <div 
                          key={member.user_id}
                          className={`px-2 py-0.5 rounded-full text-xs
                            ${member.user_id === liveSession.owner_id 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-gray-100'}`}
                          title={member.email}
                        >
                          {member.email?.split('@')[0] || 'Unknown User'}
                          {member.user_id === liveSession.owner_id && ' (Owner)'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {liveSession ? (
                  <div className="space-y-4">
                    {itineraryDays.map(day => (
                      <div
                        key={day.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        {/* Day Header */}
                        <div
                          className="bg-gray-50 p-3 flex items-center justify-between cursor-pointer"
                          onClick={() => {
                            setExpandedDays(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(day.id)) {
                                newSet.delete(day.id);
                              } else {
                                newSet.add(day.id);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <h3 className="font-medium">{day.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDay(day.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {expandedDays.has(day.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        </div>

                        {/* Day Content */}
                        {expandedDays.has(day.id) && (
                          <div className="p-4 space-y-4">
                            {/* Accommodation */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Hotel className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium">Accommodation</span>
                              </div>
                              <input
                                type="text"
                                value={day.accommodation}
                                onChange={(e) => handleDayUpdate(day.id, 'accommodation', e.target.value)}
                                placeholder="Where are you staying?"
                                className="w-full p-2 border rounded-md"
                                disabled={!isOwner}
                              />
                            </div>

                            {/* Transportation */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Train className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium">Transportation</span>
                              </div>
                              <input
                                type="text"
                                value={day.transportation}
                                onChange={(e) => handleDayUpdate(day.id, 'transportation', e.target.value)}
                                placeholder="How are you getting around?"
                                className="w-full p-2 border rounded-md"
                                disabled={!isOwner}
                              />
                            </div>

                            {/* Activities */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-purple-500" />
                                  <span className="text-sm font-medium">Activities</span>
                                </div>
                                {isOwner && (
                                  <button
                                    onClick={() => addActivity(day.id)}
                                    className="text-blue-500 hover:text-blue-600"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {day.activities.map(activity => (
                                  <div key={activity.id} className="flex gap-2 group">
                                    <input
                                      type="text"
                                      value={activity.time}
                                      onChange={(e) => handleActivityUpdate(activity.id, 'time', e.target.value)}
                                      placeholder="Time"
                                      className="w-24 p-2 border rounded-md"
                                      disabled={!isOwner}
                                    />
                                    <input
                                      type="text"
                                      value={activity.description}
                                      onChange={(e) => handleActivityUpdate(activity.id, 'description', e.target.value)}
                                      placeholder="Description"
                                      className="flex-1 p-2 border rounded-md"
                                      disabled={!isOwner}
                                    />
                                    <input
                                      type="text"
                                      value={activity.location}
                                      onChange={(e) => handleActivityUpdate(activity.id, 'location', e.target.value)}
                                      placeholder="Location"
                                      className="w-32 p-2 border rounded-md"
                                      disabled={!isOwner}
                                    />
                                    {isOwner && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteActivity(day.id, activity.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-red-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isOwner && (
                      <button
                        onClick={() => addDay(liveSession.id)}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
                      >
                        Add Day
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    {isOwner ? "Start a session to begin planning" : "Waiting for owner to start a session"}
                  </div>
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="w-1/2 bg-white rounded-lg shadow-lg flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                  <div
                    key={typeof message.id === 'string' ? message.id : `msg-${message.id}`}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {message.sender_id !== user?.id && (
                        <div className="text-xs text-gray-500 mb-1">
                          {message.sender_email.split('@')[0]}
                        </div>
                      )}
                      <div>{message.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-2 border rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white rounded-lg shadow-lg flex items-center justify-center">
            <p className="text-gray-500">Select a group to start planning</p>
          </div>
        )}
      </div>

      {/* Loading indicators */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Session loading indicator */}
      {isSessionLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {isOwner ? "Starting session..." : "Joining session..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
