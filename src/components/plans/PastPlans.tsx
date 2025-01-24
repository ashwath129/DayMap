import React, { useEffect, useState } from 'react';
import { MapPin, Calendar, Trash2, Eye, Loader2, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ItineraryResponse } from '../../lib/types';

interface SavedPlan {
  id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  plan_data: ItineraryResponse;
}

interface Props {
  onViewPlan: (plan: ItineraryResponse) => void;
}

export function PastPlans({ onViewPlan }: Props) {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load saved plans');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    setDeleting(id);
    try {
      const { error } = await supabase
        .from('saved_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPlans(plans.filter(plan => plan.id !== id));
      toast.success('Plan deleted successfully');
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success('Plan ID copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No saved plans yet</h3>
        <p className="text-gray-600">
          Your saved travel plans will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Your Saved Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <button
                  onClick={(e) => handleCopyId(plan.id, e)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Copy Plan ID"
                >
                  <Copy className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  {plan.destination}
                </div>
                {(plan.start_date || plan.end_date) && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {plan.start_date && format(new Date(plan.start_date), 'MMM d, yyyy')}
                    {plan.start_date && plan.end_date && ' - '}
                    {plan.end_date && format(new Date(plan.end_date), 'MMM d, yyyy')}
                  </div>
                )}
                <div className="text-sm text-gray-500">
                  Created {format(new Date(plan.created_at), 'MMM d, yyyy')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewPlan({
                    ...plan.plan_data,
                    id: plan.id
                  })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Plan
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  disabled={deleting === plan.id}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}