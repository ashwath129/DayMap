import { OpenAI } from 'openai';
import { ItineraryResponse } from './types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateAIItinerary = async (params: {
  location: string;
  peopleCount: number;
  budgetRange: string;
  occasion: string;
  duration: number;
}): Promise<ItineraryResponse> => {
  const prompt = `Give a travel plan / itinerary for the location ${params.location}, for people count ${params.peopleCount} with a budget of ${params.budgetRange}. The number of days is ${params.duration} and I want it to be like a nice "${params.occasion}". Give a nice detailed plan. Give budgets (make sure it is close to the budget range, and the destination currencies are taken into account) , transportation details (give specific services - example - uber,lyft, ola etc, and the names of bus,train,metro services), accomodation places, nice restaurants, and places to visit. For Meals for breakfast, lunch and dinner specify cuisine. Make everything very specific, and explanatory. Give two suggestions for each type. Every night activity does not need to be 'Dinner', but if that is what makes sense then fine. Ensure that you take the dates, and find weather information accurately as well, tailor the itinerary properly.Please make it very detailed (YOU CAN GENERATE RESPONSES FOR ABOUT 3000 TOKENS).  Can you give the response in the form of a JSON in the format - it has to be in this format {
  "tripDetails": {
    "destination": "Center Point, IA 52213, USA",
    "duration": 4,
    "groupSize": 2,
    "budgetLevel": "moderate",
    "occasion": "leisure" // based on input , If i give a location here, then please consider that location specifically.
  },
  "dailyItinerary": [
    {
      "dayNumber": 1,
      "morningActivities": [
        {
          "activityName": "Local Market Visit",
          "startTime": "09:00",
          "duration": "2 hours",
          "description": "Explore the vibrant local market",//Give interesting facts here as well, give three points
          "estimatedCost": "$20",
          "location": "City Center Market",
          "tips": "Arrive early for the freshest produce" //Give three tips, Ensure you include information for Parking, best time to visit, etc.
        }
      ],
      "afternoonActivities": [
        {
          "activityName": "Museum Tour",
          "startTime": "14:00",
          "duration": "3 hours",
          "description": "Visit the city's main museum",//Give interesting facts here as well, give three points
          "estimatedCost": "$25",
          "location": "City Museum",
          "tips": "Book tickets online to avoid queues" //Ensure you include information for Give three tips, Parking, best time to visit, etc.
        }
      ],
      "eveningActivities": [
        {
          "activityName": "Sunset Dinner",
          "startTime": "19:00",
          "duration": "2 hours",
          "description": "Dinner with a view",//Give interesting facts here as well, give three points
          "estimatedCost": "$50",
          "location": "Skyline Restaurant",
          "tips": "Make reservations in advance" //Give three tips,Ensure you include information for Parking, best time to visit, etc.
        }
      ],
      "meals": { //Give cuisines for breakfast, lunch and dinner
        "breakfast": {
          "suggestion": "Local Cafe",
          "priceRange": "$15-20",
          "cuisine": "Local", //Here within paranthesis mention whether it is vegetarian, non-vegetarian, or both
          "location": "Downtown"
        },
        "lunch": {
          "suggestion": "Street Food Market",
          "priceRange": "$10-15",
          "cuisine": "Various",
          "location": "City Center"
        },
        "dinner": {
          "suggestion": "Fine Dining Restaurant",
          "priceRange": "$40-60",
          "cuisine": "International",
          "location": "Harbor Area"
        }
      },
      "accommodation": {
        "name": "City Center Hotel",
        "type": "Hotel",
        "priceRange": "$150-200",
        "location": "Downtown",
        "bookingTips": "Book at least 2 weeks in advance" //Also add to this distance from the nearest airport, train station, bus station, metro station, etc.
      },
      "transportation": {
        "recommendedModes": [
          "Public Transit",
          "Walking"
        ],
        "estimatedCosts": "$20 per day",
        "tips": "Get a daily transit pass"
      }
    }
  ],
  "budgetSummary": {
    "estimatedTotalCost": "$800",
    "costBreakdown": {
      "accommodation": "$150 per night",
      "activities": "$100 per day",
      "transportation": "$20 per day",
      "food": "$80 per day"
    }
  },
  "generalTips": [
    {
      "category": "Weather" //Make this detailed, and specific - include weather forecast, and weather conditions based on the dates entered (if entered), or based on a week from the current date.
      "tip": "Check local weather forecast before planning outdoor activities"
    },
    {
      "category": "Transportation", //Make this detailed, and specific
      "tip": "Public transportation is efficient and cost-effective"
    },
    {
      "category": "Local Customs", //Make this detailed, and specific - include festivals, holidays etc.
      "tip": "Research local customs and etiquette"
    }
  ],
  "metadata": {
    "generatedAt": "2025-01-19T19:24:41.138Z",
    "version": "1.0.0"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'o1-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    const responseData = response.choices[0].message.content;
    if (!responseData) {
      throw new Error('No response content received');
    }

    // Extract JSON between ```json and ``` markers, handling optional text before and after
    let cleanJson = responseData.trim();

    // If response contains markdown code blocks
    if (cleanJson.includes('```')) {
      // First try to find JSON block specifically
      const jsonBlockMatch = cleanJson.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        cleanJson = jsonBlockMatch[1].trim();
      } else {
        // If no specific json block, take content from any code block
        const codeBlockMatch = cleanJson.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          cleanJson = codeBlockMatch[1].trim();
        }
      }
    }

    // Remove any remaining markdown markers
    cleanJson = cleanJson.replace(/```json\s*|\s*```/g, '').trim();

    console.log('Cleaned JSON:', cleanJson);
    return JSON.parse(cleanJson) as ItineraryResponse;
  } catch (parseError) {
    console.error('Failed to parse JSON:', cleanJson);
    throw new Error('Failed to parse itinerary data: ' + parseError.message);
  }
};

export const generateNewSuggestion = async (
  currentItem: any,
  itemType: string,
  location: string,
  dayNumber?: number
): Promise<any> => {
  const prompt = `This is the current suggestion you gave for ${itemType}${dayNumber ? ` for day ${dayNumber}` : ''} for the itinerary in ${location} - can you give a better suggestion just for this ${itemType} instead of what is already there. Dont give the same one  Current suggestion: ${JSON.stringify(currentItem, null, 2)}. Please return just this part of the response in the same original JSON format.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'o1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1
    });

    const responseData = response.choices[0].message.content;
    if (!responseData) {
      throw new Error('No response content received');
    }

    // Clean up the response
    const jsonMatch = responseData.match(/```json\n?([\s\S]*?)```/);
    const cleanJson = jsonMatch 
      ? jsonMatch[1].trim()
      : responseData.trim();

    console.log('New suggestion response:', cleanJson);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error generating new suggestion:', error);
    throw error;
  }
};

export const generateAIQuickPlan = async (params: {
  destination: string;
  people: string;
  days: string;
  occasion: string;
  other?: string;
}): Promise<any> => {
  const prompt = `Generate a quick travel plan with the following details:
- Destination: ${params.destination}
- Number of People: ${params.people}
- Duration: ${params.days} days
- Occasion: ${params.occasion}
${params.other ? `- Additional Notes: ${params.other}` : ''}

Please provide a detailed plan including accommodation, transportation, activities, and meals for each day. Make everything specific and include local recommendations. Format the response as a JSON with the following structure for each day:
{
  "id": "1",
  "dayNumber": 1,
  "accommodation": "specific hotel/resort name and details",
  "transportation": "specific transportation details",
  "budget": "estimated daily budget",
  "activities": ["detailed activity 1", "detailed activity 2", ...],
  "meals": {
    "breakfast": "specific restaurant/meal suggestion",
    "lunch": "specific restaurant/meal suggestion",
    "dinner": "specific restaurant/meal suggestion"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'o1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1
    });

    const responseData = response.choices[0].message.content;
    if (!responseData) {
      throw new Error('No response content received');
    }

    // Clean and parse the response
    let cleanJson = responseData.trim();
    if (cleanJson.includes('```')) {
      const jsonMatch = cleanJson.match(/```json\n?([\s\S]*?)```/);
      cleanJson = jsonMatch ? jsonMatch[1].trim() : cleanJson;
    }

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error generating quick plan:', error);
    throw error;
  }
};