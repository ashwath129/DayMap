import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  onViewPlan: (plan: any) => void;
}

export function PastPlans({ onViewPlan }: Props) {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('saved_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching plans:', error);
        return;
      }

      console.log('Fetched plans:', data);
      setPlans(data || []);
    };

    fetchPlans();
  }, []);

  const handleViewPlan = (plan: any) => {
    console.log('Plan object:', plan);
    console.log('Plan ID:', plan.id);
    console.log('Plan data:', plan.plan_data);
    
    const planWithId = {
      ...plan.plan_data,
      id: plan.id
    };
    
    console.log('Data being passed to onViewPlan:', planWithId);
    onViewPlan(planWithId);
  };

  return (
    <div>
      {plans.map((plan) => (
        <div key={plan.id} onClick={() => handleViewPlan(plan)}>
          {/* Plan card content */}
        </div>
      ))}
    </div>
  );
} 