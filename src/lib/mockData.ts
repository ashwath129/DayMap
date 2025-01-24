import { ItineraryResponse } from './types';

export const generateMockItinerary = (params: {
  location: string;
  peopleCount: number;
  budgetRange: string;
  occasion: string;
  duration: number;
}): ItineraryResponse => {
  return {
    tripDetails: {
      destination: params.location,
      duration: params.duration,
      groupSize: params.peopleCount,
      budgetLevel: params.budgetRange,
      occasion: params.occasion
    },
    dailyItinerary: Array.from({ length: params.duration }, (_, i) => ({
      dayNumber: i + 1,
      morningActivities: [
        {
          activityName: 'Local Market Visit',
          startTime: '09:00',
          duration: '2 hours',
          description: 'Explore the vibrant local market',
          estimatedCost: '$20',
          location: 'City Center Market',
          tips: 'Arrive early for the freshest produce'
        }
      ],
      afternoonActivities: [
        {
          activityName: 'Museum Tour',
          startTime: '14:00',
          duration: '3 hours',
          description: 'Visit the city\'s main museum',
          estimatedCost: '$25',
          location: 'City Museum',
          tips: 'Book tickets online to avoid queues'
        }
      ],
      eveningActivities: [
        {
          activityName: 'Sunset Dinner',
          startTime: '19:00',
          duration: '2 hours',
          description: 'Dinner with a view',
          estimatedCost: '$50',
          location: 'Skyline Restaurant',
          tips: 'Make reservations in advance'
        }
      ],
      meals: {
        breakfast: {
          suggestion: 'Local Cafe',
          priceRange: '$15-20',
          cuisine: 'Local',
          location: 'Downtown'
        },
        lunch: {
          suggestion: 'Street Food Market',
          priceRange: '$10-15',
          cuisine: 'Various',
          location: 'City Center'
        },
        dinner: {
          suggestion: 'Fine Dining Restaurant',
          priceRange: '$40-60',
          cuisine: 'International',
          location: 'Harbor Area'
        }
      },
      accommodation: {
        name: 'City Center Hotel',
        type: 'Hotel',
        priceRange: '$150-200',
        location: 'Downtown',
        bookingTips: 'Book at least 2 weeks in advance'
      },
      transportation: {
        recommendedModes: ['Public Transit', 'Walking'],
        estimatedCosts: '$20 per day',
        tips: 'Get a daily transit pass'
      }
    })),
    budgetSummary: {
      estimatedTotalCost: `$${params.duration * 200}`,
      costBreakdown: {
        accommodation: '$150 per night',
        activities: '$100 per day',
        transportation: '$20 per day',
        food: '$80 per day'
      }
    },
    generalTips: [
      {
        category: 'Weather',
        tip: 'Check local weather forecast before planning outdoor activities'
      },
      {
        category: 'Transportation',
        tip: 'Public transportation is efficient and cost-effective'
      },
      {
        category: 'Local Customs',
        tip: 'Research local customs and etiquette'
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    }
  };
};