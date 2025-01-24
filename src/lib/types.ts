export interface TripFormData {
  destination: string;
  destinationPlaceId?: string;
  startDate: Date | null;
  endDate: Date | null;
  travelers: string;
  budget: string;
  customBudget?: string;
  interests: string;
  numberOfDays: string;
  experienceType: string;
  customDays?: string;
}

export interface QuickPlanData {
  destination: string;
  destinationPlaceId?: string;
  travelers: string;
  budget: string;
  customBudget?: string;
  duration: string;
  customDays?: string;
}

export interface Activity {
  activityName: string;
  startTime: string;
  duration: string;
  description: string;
  estimatedCost: string;
  location: string;
  tips: string;
}

export interface Meal {
  suggestion: string;
  priceRange: string;
  cuisine: string;
  location: string;
}

export interface Meals {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
}

export interface Accommodation {
  name: string;
  type: string;
  priceRange: string;
  location: string;
  bookingTips: string;
}

export interface Transportation {
  recommendedModes: string[];
  estimatedCosts: string;
  tips: string;
}

export interface DayItinerary {
  dayNumber: number;
  morningActivities: Activity[];
  afternoonActivities: Activity[];
  eveningActivities: Activity[];
  meals: Meals;
  accommodation: Accommodation;
  transportation: Transportation;
}

export interface BudgetSummary {
  estimatedTotalCost: string;
  costBreakdown: {
    accommodation: string;
    activities: string;
    transportation: string;
    food: string;
  };
}

export interface Tip {
  category: string;
  tip: string;
}

export interface ItineraryResponse {
  tripDetails: {
    destination: string;
    duration: number;
    groupSize: number;
    budgetLevel: string;
    occasion: string;
  };
  dailyItinerary: DayItinerary[];
  budgetSummary: BudgetSummary;
  generalTips: Tip[];
  metadata: {
    generatedAt: string;
    version: string;
  };
}

export interface Group {
  id: number;
  name: string;
  created_at: string;
  created_by: string;
  join_code: string;
}

export interface GroupMember {
  id: number;
  user_id: string;
  group_id: number;
  joined_at: string;
  user_email?: string;
  user_name?: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  _count?: {
    members: number;
  };
}