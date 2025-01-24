import { ItineraryResponse } from './types';
import { generateMockItinerary } from './mockData';

export const generateItinerary = async (params: {
  location: string;
  peopleCount: number;
  budgetRange: string;
  occasion: string;
  duration: number;
}): Promise<{ data: ItineraryResponse; status: number }> => {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate mock response
    const mockResponse = generateMockItinerary(params);
    console.log('Generated mock itinerary:', mockResponse);
    
    return {
      data: mockResponse,
      status: 200
    };
  } catch (error) {
    console.error('Error generating mock itinerary:', error);
    throw {
      error: 'Failed to generate itinerary',
      status: 500,
      details: error
    };
  }
};

// ... (keep existing helper functions)