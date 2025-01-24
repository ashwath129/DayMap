import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, DollarSign, Info, Code, X, Save, Check, Users, Heart, Hotel, Train, Utensils, Sun, Wallet, Coffee, UtensilsCrossed, Wine, CalendarClock, RefreshCw, Copy, FileDown, Loader2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableActivityItem } from './SortableActivityItem';
import { ItineraryResponse, Activity } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { generateNewSuggestion } from '../../lib/openai';
import html2pdf from 'html2pdf.js';
import { MapModal } from '../map/MapModal';
import { ItineraryPopupView } from './ItineraryPopupView';

interface Props {
  itinerary: ItineraryResponse;
  planId?: string;
}

interface DraggableActivity extends Activity {
  id: string;
}

// Add type for meal suggestion
interface MealSuggestion {
  suggestion: string;
  priceRange: string;
  cuisine: string;
  location: string;
}

export function ItineraryView({ itinerary, planId }: Props) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [planName, setPlanName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isChanging, setIsChanging] = useState<string | null>(null);
  const [days, setDays] = useState(() => {
    // Check if we have the new format (dailyItinerary) or old format
    if (itinerary.dailyItinerary) {
      return itinerary.dailyItinerary.map(day => ({
        ...day,
        // Combine all activities into a single array
        activities: [
          ...(day.morningActivities || []).map((activity, i) => ({ 
            ...activity, 
            id: `morning-${day.dayNumber}-${i}`,
            period: 'morning'
          })),
          ...(day.afternoonActivities || []).map((activity, i) => ({ 
            ...activity, 
            id: `afternoon-${day.dayNumber}-${i}`,
            period: 'afternoon'
          })),
          ...(day.eveningActivities || []).map((activity, i) => ({ 
            ...activity, 
            id: `evening-${day.dayNumber}-${i}`,
            period: 'evening'
          }))
        ]
      }));
    } else {
      // Handle the old format
      return itinerary.days.map(day => ({
        ...day,
        activities: day.activities.map((activity, i) => ({
          ...activity,
          id: `activity-${day.dayNumber}-${i}`
        }))
      }));
    }
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Add state for tracking current meal suggestion indexes
  const [mealIndexes, setMealIndexes] = useState<{[key: string]: number}>({
    breakfast: 0,
    lunch: 0,
    dinner: 0
  });

  // Add state for accommodation index
  const [accommodationIndex, setAccommodationIndex] = useState(0);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const currentDay = days[currentDayIndex];
    const oldIndex = currentDay.activities.findIndex(item => item.id === active.id);
    const newIndex = currentDay.activities.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newDays = [...days];
      newDays[currentDayIndex] = {
        ...currentDay,
        activities: arrayMove(currentDay.activities, oldIndex, newIndex)
      };
      setDays(newDays);
    }
  };

  const handleTimeChange = (activityId: string, newTime: string) => {
    const newDays = [...days];
    const currentDay = newDays[currentDayIndex];
    const activityIndex = currentDay.activities.findIndex(a => a.id === activityId);
    
    if (activityIndex !== -1) {
      currentDay.activities[activityIndex] = {
        ...currentDay.activities[activityIndex],
        startTime: newTime
      };
      setDays(newDays);
    }
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please sign in to save plans');
        return;
      }

      const { error } = await supabase
        .from('saved_plans')
        .insert({
          user_id: user.id,
          name: planName.trim(),
          plan_data: itinerary,
          destination: itinerary.tripDetails.destination,
          start_date: itinerary.tripDetails.startDate || null,
          end_date: itinerary.tripDetails.endDate || null
        });

      if (error) throw error;

      toast.success('Plan saved successfully!');
      setShowSaveModal(false);
      setPlanName('');
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add helper function to handle accommodation navigation
  const handleAccommodationNavigation = (direction: 'next' | 'prev', options: any[]) => {
    setAccommodationIndex(prev => 
      direction === 'next'
        ? (prev + 1) % options.length
        : (prev - 1 + options.length) % options.length
    );
  };

  // Update handleChangeSuggestion to handle accommodation
  const handleChangeSuggestion = async (itemType: string, currentItem: any, dayNumber?: number) => {
    setIsChanging(itemType + (dayNumber ? `-${dayNumber}` : ''));
    try {
      const newSuggestion = await generateNewSuggestion(
        currentItem,
        itemType,
        itinerary.tripDetails.destination,
        dayNumber
      );

      const newDays = [...days];
      const dayIndex = dayNumber ? dayNumber - 1 : currentDayIndex;

      if (itemType === 'accommodation') {
        // Handle both single and multiple accommodation formats
        if (Array.isArray(newDays[dayIndex].accommodation.options)) {
          newDays[dayIndex].accommodation.options.unshift(newSuggestion);
        } else {
          newDays[dayIndex].accommodation = {
            options: [newSuggestion, newDays[dayIndex].accommodation]
          };
        }
        setAccommodationIndex(0);
      } else if (itemType.startsWith('activity-')) {
        // Update activity handling
        const activityIndex = parseInt(itemType.split('-')[1]);
        if (!isNaN(activityIndex) && newDays[dayIndex].activities[activityIndex]) {
          newDays[dayIndex].activities[activityIndex] = {
            ...newSuggestion,
            id: newDays[dayIndex].activities[activityIndex].id
          };
        }
      } else if (itemType.startsWith('meal-')) {
        const mealType = itemType.split('-')[1] as 'breakfast' | 'lunch' | 'dinner';
        // Add new suggestion to the beginning of the array
        if (Array.isArray(newDays[dayIndex].meals[mealType])) {
          newDays[dayIndex].meals[mealType].unshift(newSuggestion);
        } else {
          newDays[dayIndex].meals[mealType] = [newSuggestion];
        }
        
        // Reset the meal index to show the new suggestion
        setMealIndexes(prev => ({
          ...prev,
          [mealType]: 0
        }));
      }

      setDays(newDays);
      toast.success('Generated new suggestion!');
    } catch (error) {
      console.error('Error generating new suggestion:', error);
      toast.error('Failed to generate new suggestion');
    } finally {
      setIsChanging(null);
    }
  };

  const ChangeSuggestionButton = ({ 
    itemType, 
    currentItem, 
    dayNumber 
  }: { 
    itemType: string; 
    currentItem: any; 
    dayNumber?: number;
  }) => {
    const isChangingThis = isChanging === (itemType + (dayNumber ? `-${dayNumber}` : ''));
    
    return (
      <button
        onClick={() => handleChangeSuggestion(itemType, currentItem, dayNumber)}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        disabled={isChangingThis}
        title="Get new suggestion"
      >
        {isChangingThis ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 text-gray-500 hover:text-blue-600" />
        )}
      </button>
    );
  };

  const currentDay = days[currentDayIndex];

  const goToPreviousDay = () => {
    setCurrentDayIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const goToNextDay = () => {
    setCurrentDayIndex((prev) => (prev < days.length - 1 ? prev + 1 : prev));
  };

  const formatCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCopyId = () => {
    if (planId) {
      navigator.clipboard.writeText(planId);
      toast.success('Plan ID copied to clipboard!');
    }
  };

  const handleExportPDF = () => {
    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">
          ${itinerary.tripDetails.destination} Travel Itinerary
        </h1>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #1e40af;">Trip Details</h2>
          <p><strong>Duration:</strong> ${itinerary.tripDetails.duration} days</p>
          <p><strong>Group Size:</strong> ${itinerary.tripDetails.groupSize} people</p>
          <p><strong>Budget Level:</strong> ${itinerary.tripDetails.budgetLevel}</p>
        </div>

        ${itinerary.dailyItinerary.map((day, index) => `
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
              Day ${day.dayNumber}
            </h2>
            
            <h3 style="color: #4b5563;">Morning Activities</h3>
            ${day.morningActivities.map(activity => `
              <div style="margin-bottom: 15px;">
                <p><strong>${activity.startTime} - ${activity.description}</strong></p>
                <p>Location: ${activity.location}</p>
                <p>Duration: ${activity.duration}</p>
                <p>Cost: ${activity.estimatedCost}</p>
                <p><em>Tips: ${activity.tips}</em></p>
              </div>
            `).join('')}

            <h3 style="color: #4b5563;">Afternoon Activities</h3>
            ${day.afternoonActivities.map(activity => `
              <div style="margin-bottom: 15px;">
                <p><strong>${activity.startTime} - ${activity.description}</strong></p>
                <p>Location: ${activity.location}</p>
                <p>Duration: ${activity.duration}</p>
                <p>Cost: ${activity.estimatedCost}</p>
                <p><em>Tips: ${activity.tips}</em></p>
              </div>
            `).join('')}

            <h3 style="color: #4b5563;">Evening Activities</h3>
            ${day.eveningActivities.map(activity => `
              <div style="margin-bottom: 15px;">
                <p><strong>${activity.startTime} - ${activity.description}</strong></p>
                <p>Location: ${activity.location}</p>
                <p>Duration: ${activity.duration}</p>
                <p>Cost: ${activity.estimatedCost}</p>
                <p><em>Tips: ${activity.tips}</em></p>
              </div>
            `).join('')}

            <div style="margin-top: 20px;">
              <h3 style="color: #4b5563;">Meals</h3>
              <p><strong>Breakfast:</strong> ${day.meals.breakfast.suggestion} at ${day.meals.breakfast.location}</p>
              <p><strong>Lunch:</strong> ${day.meals.lunch.suggestion} at ${day.meals.lunch.location}</p>
              <p><strong>Dinner:</strong> ${day.meals.dinner.suggestion} at ${day.meals.dinner.location}</p>
            </div>
          </div>
        `).join('')}

        <div style="margin-top: 30px;">
          <h2 style="color: #1e40af;">Travel Tips</h2>
          <ul style="list-style-type: none; padding: 0;">
            ${itinerary.generalTips.map(tip => `
              <li style="margin-bottom: 10px;">
                <strong>${tip.category}:</strong> ${tip.tip}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: `${itinerary.tripDetails.destination.replace(/[^a-zA-Z0-9]/g, '_')}_itinerary.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const element = document.createElement('div');
    element.innerHTML = content;
    html2pdf().from(element).set(options).save();
    toast.success('Downloading PDF...');
  };

  const handleShowMap = (location: string) => {
    setSelectedLocation(location);
    setShowMap(true);
  };

  const renderLocationButton = (location: string) => (
    <button
      onClick={() => handleShowMap(location)}
      className="p-1 rounded-full hover:bg-gray-100 transition-colors"
      title="View on map"
    >
      <MapPin className="w-4 h-4 text-gray-500 hover:text-blue-600" />
    </button>
  );

  // Add helper function to handle meal navigation
  const handleMealNavigation = (mealType: string, direction: 'next' | 'prev', suggestions: any[]) => {
    setMealIndexes(prev => ({
      ...prev,
      [mealType]: direction === 'next'
        ? (prev[mealType] + 1) % suggestions.length
        : (prev[mealType] - 1 + suggestions.length) % suggestions.length
    }));
  };

  // Update the meal section rendering
  const renderMealSection = (mealType: string, mealData: MealSuggestion | MealSuggestion[]) => {
    if (!mealData) return null;

    const suggestions = Array.isArray(mealData) ? mealData : [mealData];
    const currentSuggestion = suggestions[mealIndexes[mealType] || 0];
    const hasMultipleSuggestions = suggestions.length > 1;

    return (
      <div className="relative group">
        <div className="bg-white rounded-lg p-4">
          {currentSuggestion && (
            <>
              {/* Title and Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-medium">{currentSuggestion.suggestion}</div>
                <div className="flex items-center gap-1">
                  {hasMultipleSuggestions && (
                    <>
                      <button
                        onClick={() => handleMealNavigation(mealType, 'prev', suggestions)}
                        className="p-1 hover:bg-gray-100 rounded-full"
                        title="Previous suggestion"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMealNavigation(mealType, 'next', suggestions)}
                        className="p-1 hover:bg-gray-100 rounded-full"
                        title="Next suggestion"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <ChangeSuggestionButton 
                    itemType={`meal-${mealType}`}
                    currentItem={currentSuggestion}
                    dayNumber={currentDay.dayNumber}
                  />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-[auto,1fr,auto] gap-x-2 gap-y-3 items-center">
                {/* Location Row */}
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 truncate" title={currentSuggestion.location}>
                  {currentSuggestion.location}
                </span>
                {renderLocationButton(currentSuggestion.location)}

                {/* Cuisine Row */}
                <span className="text-sm text-gray-600">Cuisine:</span>
                <span className="text-sm text-gray-600 col-span-2">
                  {currentSuggestion.cuisine}
                </span>

                {/* Price Range Row */}
                <span className="text-sm text-gray-600">Price Range:</span>
                <span className="text-sm text-gray-600 col-span-2">
                  {currentSuggestion.priceRange}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Update the activity rendering to handle both formats
  const renderActivity = (activity: any) => {
    return (
      <div className="space-y-2">
        <div className="font-medium">{activity.activityName || activity.name}</div>
        <div className="text-sm text-gray-600">{activity.description}</div>
        {activity.interestingFacts && (
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">Interesting Facts:</div>
            <ul className="list-disc list-inside space-y-1">
              {activity.interestingFacts.map((fact: string, i: number) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          </div>
        )}
        {activity.tips && (
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">Tips:</div>
            <ul className="list-disc list-inside space-y-1">
              {activity.tips.map((tip: string, i: number) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{activity.startTime}</span>
            {activity.duration && (
              <span className="text-gray-400">({activity.duration})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>{activity.estimatedCost}</span>
          </div>
        </div>
        {activity.location && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{activity.location}</span>
            </div>
            {renderLocationButton(activity.location)}
          </div>
        )}
      </div>
    );
  };

  // Update the render function for accommodation
  const renderAccommodation = (accommodation: any) => {
    // Handle all possible formats
    let options: any[] = [];
    
    if (accommodation?.options) {
      // Handle the case where we have an options array
      options = accommodation.options.flat();
    } else if (Array.isArray(accommodation)) {
      // Handle direct array format
      options = accommodation.flat();
    } else {
      // Handle single accommodation object
      options = [accommodation];
    }

    const currentOption = options[accommodationIndex];
    const hasMultipleOptions = options.length > 1;

    if (!currentOption) return null;

    return (
      <div className="bg-white/80 rounded-lg p-4">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-pink-900">{currentOption.name}</h4>
            <p className="text-sm text-pink-700">{currentOption.type}</p>
          </div>
          <div className="flex items-center gap-1">
            {hasMultipleOptions && (
              <>
                <button
                  onClick={() => handleAccommodationNavigation('prev', options)}
                  className="p-1 hover:bg-pink-100 rounded-full transition-colors"
                  title="Previous option"
                >
                  <ChevronLeft className="w-4 h-4 text-pink-600" />
                </button>
                <span className="text-sm text-pink-600">
                  {accommodationIndex + 1}/{options.length}
                </span>
                <button
                  onClick={() => handleAccommodationNavigation('next', options)}
                  className="p-1 hover:bg-pink-100 rounded-full transition-colors"
                  title="Next option"
                >
                  <ChevronRight className="w-4 h-4 text-pink-600" />
                </button>
              </>
            )}
            <ChangeSuggestionButton 
              itemType="accommodation"
              currentItem={currentOption}
              dayNumber={currentDay.dayNumber}
            />
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-3">
          {/* Location */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-pink-500" />
              <span className="text-sm text-gray-700">{currentOption.location}</span>
            </div>
            {renderLocationButton(currentOption.location)}
          </div>

          {/* Price Range */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-pink-500" />
            <span className="text-sm text-gray-700">{currentOption.priceRange}</span>
          </div>

          {/* Booking Tips */}
          <div className="pt-1">
            <h5 className="text-sm font-medium text-pink-900 mb-2">Booking Tips</h5>
            {Array.isArray(currentOption.bookingTips) ? (
              <ul className="text-sm text-gray-600 space-y-2">
                {currentOption.bookingTips.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-pink-400 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-pink-400 mt-0.5 flex-shrink-0" />
                <span>{currentOption.bookingTips}</span>
              </p>
            )}
          </div>

          {/* Distance Information */}
          {currentOption.distanceFromKeyPoints && (
            <div className="pt-1">
              <h5 className="text-sm font-medium text-pink-900 mb-2">Distances</h5>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(currentOption.distanceFromKeyPoints).map(([key, value]: [string, string]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Add this helper function at the top of the file
  const getTransportationDetails = (transportation: any) => {
    if (Array.isArray(transportation)) {
      // If it's an array, use the first item's details
      const firstOption = transportation[0];
      return {
        recommendedModes: [firstOption.recommendedMode],
        estimatedCosts: firstOption.estimatedCosts,
        tips: firstOption.tips
      };
    }
    
    // If it's the usual object format
    return {
      recommendedModes: transportation.recommendedModes || [],
      estimatedCosts: transportation.estimatedCosts || '',
      tips: transportation.tips || ''
    };
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative bg-gradient-to-br from-blue-50 to-purple-50 min-h-screen">
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {planId && (
          <button
            onClick={handleCopyId}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            title="Copy Plan ID"
          >
            <Copy className="w-5 h-5 text-gray-600 hover:text-blue-600" />
          </button>
        )}
        <button
          onClick={handleExportPDF}
          className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          title="Export as PDF"
        >
          <FileDown className="w-5 h-5 text-gray-600 hover:text-blue-600" />
        </button>
      </div>

      {/* Save Plan Button */}
      <button
        onClick={() => setShowSaveModal(true)}
        className="fixed bottom-20 right-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-full shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 flex items-center gap-2"
        title="Save Plan"
      >
        <Save className="w-5 h-5" />
      </button>

      {/* JSON Viewer Button */}
      <button
        onClick={() => setShowJsonModal(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white p-3 rounded-full shadow-lg hover:from-gray-700 hover:to-gray-800 transition-all transform hover:scale-105"
        title="View JSON Data"
      >
        <Code className="w-5 h-5" />
      </button>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Save Your Plan</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="planName" className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  id="planName"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Enter a name for your plan"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  disabled={isSaving}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin">⌛</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save Plan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Itinerary JSON Data</h3>
              <button
                onClick={() => setShowJsonModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(itinerary, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 bg-white p-6 rounded-2xl shadow-lg border border-purple-100">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Your {itinerary.tripDetails.duration}-Day Trip to {itinerary.tripDetails.destination}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {itinerary.tripDetails.duration} days
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {itinerary.tripDetails.destination}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            {itinerary.budgetSummary.estimatedTotalCost} total
          </span>
          {itinerary.tripDetails.groupSize && (
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              Group of {itinerary.tripDetails.groupSize}
            </span>
          )}
          {itinerary.tripDetails.occasion && (
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {itinerary.tripDetails.occasion}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-md border border-blue-200 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">Daily Budget</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p>Accommodation: {itinerary.budgetSummary.costBreakdown.accommodation}</p>
            <p>Activities: {itinerary.budgetSummary.costBreakdown.activities}</p>
            <p>Transportation: {itinerary.budgetSummary.costBreakdown.transportation}</p>
            <p>Food: {itinerary.budgetSummary.costBreakdown.food}</p>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 shadow-md border border-purple-200 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-4">
            <Train className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-purple-800">Transportation</h3>
          </div>
          <div className="space-y-2 text-sm">
            {Array.isArray(currentDay.transportation) ? (
              // If it's an array of transportation options
              currentDay.transportation.map((option, index) => (
                <div key={index} className="p-3 bg-white bg-opacity-50 rounded-lg">
                  <p className="font-medium">{option.recommendedMode}</p>
                  <p>Cost: {option.estimatedCosts}</p>
                  <p className="text-gray-600 mt-1">{option.details}</p>
                  {option.tips && (
                    <div className="mt-2">
                      <p className="font-medium text-purple-700">Tips:</p>
                      <ul className="list-disc list-inside text-gray-600 space-y-1 mt-1">
                        {option.tips.split('\n').map((tip: string, i: number) => (
                          <li key={i}>{tip.replace(/^\d+\.\s/, '')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Original format
              <>
                <p>Recommended: {currentDay.transportation.recommendedModes?.join(', ') || 'Not specified'}</p>
                <p>Cost: {currentDay.transportation.estimatedCosts || 'Not specified'}</p>
                <p className="text-gray-600">{currentDay.transportation.tips || 'No tips available'}</p>
              </>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6 shadow-md border border-pink-200 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-4">
            <Hotel className="w-5 h-5 text-pink-600" />
            <h3 className="font-semibold text-pink-800">Accommodation</h3>
          </div>
          {renderAccommodation(currentDay.accommodation)}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-purple-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Day {currentDay.dayNumber} Schedule
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPopup(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              Popup View
            </button>
            <button
              onClick={goToPreviousDay}
              disabled={currentDayIndex === 0}
              className="p-2 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-purple-600" />
            </button>
            <button
              onClick={goToNextDay}
              disabled={currentDayIndex === days.length - 1}
              className="p-2 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentDay.activities.map(activity => activity.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {currentDay.activities.map((activity, index) => (
                <SortableActivityItem 
                  key={activity.id} 
                  activity={activity}
                  onTimeChange={handleTimeChange}
                  index={index}
                  currentDay={currentDay}
                  handleShowMap={handleShowMap}
                  onSuggestionChange={(activity) => {
                    handleChangeSuggestion(`activity-${index}`, activity, currentDay.dayNumber);
                  }}
                  isChanging={isChanging === `activity-${index}-${currentDay.dayNumber}`}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6 pt-6 border-t border-purple-100">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Meals
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(currentDay.meals).map(([mealType, mealData]) => (
                <div 
                  key={mealType} 
                  className={`p-4 rounded-lg ${
                    mealType === 'breakfast' ? 'bg-orange-50/50' :
                    mealType === 'lunch' ? 'bg-green-50/50' :
                    'bg-blue-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    {mealType === 'breakfast' ? <Coffee className="w-4 h-4" /> :
                     mealType === 'lunch' ? <UtensilsCrossed className="w-4 h-4" /> :
                     <Wine className="w-4 h-4" />}
                    <h4 className="font-medium capitalize">{mealType}</h4>
                  </div>
                  {renderMealSection(mealType, mealData)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-6 border border-purple-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-800">Travel Tips</h3>
        </div>
        <ul className="space-y-2">
          {itinerary.generalTips.map((tip, index) => (
            <li key={index} className="text-sm bg-white bg-opacity-60 p-4 rounded-lg hover:bg-opacity-80 transition-all">
              <span className="font-medium text-purple-700 block mb-1">{tip.category}</span>
              {tip.tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        Generated on {formatCurrentDate()} • Version {itinerary.metadata.version}
      </div>

      {/* Map Modal */}
      {showMap && (
        <MapModal
          location={selectedLocation}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Add the popup component */}
      {showPopup && (
        <ItineraryPopupView
          itinerary={itinerary}
          onClose={() => setShowPopup(false)}
          currentDayIndex={currentDayIndex}
          days={days}
          handleChangeSuggestion={handleChangeSuggestion}
          isChanging={isChanging}
          handleShowMap={handleShowMap}
          goToPreviousDay={goToPreviousDay}
          goToNextDay={goToNextDay}
        />
      )}
    </div>
  );
}