import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserMinus, Mail, AlertCircle } from 'lucide-react';
import { GroupMember } from '../../lib/types';
import toast from 'react-hot-toast';

interface Props {
  groupId: number;
  createdBy: string;
}

export function GroupMembers({ groupId, createdBy }: Props) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        console.log('Fetching members for group:', groupId);
        
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user?.id || null);

        // Get all members for this group
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId);

        console.log('Member data:', memberData);

        if (memberError) throw memberError;

        // Extract usernames from member emails
        const membersWithEmails = memberData.map(member => {
          // Try to get email from member data or use a default
          const email = member.email || 'user@example.com';
          const username = email.split('@')[0];
          
          return {
            ...member,
            user_email: email,
            user_name: username.charAt(0).toUpperCase() + username.slice(1) // Capitalize first letter
          };
        });

        console.log('Processed members:', membersWithEmails);
        setMembers(membersWithEmails);
      } catch (error) {
        console.error('Error fetching members:', error);
        toast.error('Failed to load group members');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();

    // Subscribe to member changes
    const channel = supabase
      .channel('group-members')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [groupId]);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', memberId);

      if (error) throw error;
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  if (isLoading) {
    return <div className="p-4 text-gray-600">Loading members...</div>;
  }

  return (
    <div className="bg-white p-4 border-b">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Group Members ({members.length})</h3>
      </div>

      <div className="flex flex-wrap gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">
                {member.user_name}
              </div>
              {member.user_email && (
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {member.user_email}
                </div>
              )}
            </div>

            {createdBy === currentUser && member.user_id !== currentUser && (
              <button
                onClick={() => handleRemoveMember(member.user_id)}
                className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove member"
              >
                <UserMinus className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-4 w-full">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No members found</p>
          </div>
        )}
      </div>
    </div>
  );
} 