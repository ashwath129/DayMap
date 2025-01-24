import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, MapPin, Clock, DollarSign, Info, RefreshCw, Coffee, UtensilsCrossed, Wine, Hotel, ChevronLeft, ChevronRight, Train, Wallet, AlertCircle } from 'lucide-react';
import { ItineraryResponse } from '../../lib/types';

interface Props {
  itinerary: ItineraryResponse;
  onClose: () => void;
  currentDayIndex: number;
  days: any[];
  handleChangeSuggestion: (itemType: string, currentItem: any, dayNumber?: number) => void;
  isChanging: string | null;
  handleShowMap: (location: string) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
}

export function ItineraryPopupView({ 
  itinerary, 
  onClose,
  currentDayIndex,
  days,
  handleChangeSuggestion,
  isChanging,
  handleShowMap,
  goToPreviousDay,
  goToNextDay
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const currentDay = days[currentDayIndex];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const renderActivityItem = (activity: any, index: number) => (
    <div key={activity.id} className="border-b border-gray-100 py-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-sm">{activity.activityName}</p>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {activity.startTime}
            </span>
            <span>•</span>
            <span>{activity.duration}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleChangeSuggestion(`activity-${index}`, activity, currentDay.dayNumber)}
            disabled={isChanging === `activity-${index}-${currentDay.dayNumber}`}
            className="p-1 rounded-full hover:bg-green-50 transition-colors"
            title="Get new suggestion"
          >
            <RefreshCw className={`w-3 h-3 text-green-500 ${
              isChanging === `activity-${index}-${currentDay.dayNumber}` ? 'animate-spin' : ''
            }`} />
          </button>
          <button
            onClick={() => handleShowMap(activity.location)}
            className="p-1 rounded-full hover:bg-purple-50 transition-colors"
            title="View on map"
          >
            <MapPin className="w-3 h-3 text-purple-500" />
          </button>
          <button
            onClick={() => toggleSection(`activity-${activity.id}`)}
            className="p-1 rounded-full hover:bg-blue-50 transition-colors"
          >
            {expandedSections[`activity-${activity.id}`] ? (
              <ChevronUp className="w-3 h-3 text-blue-500" />
            ) : (
              <ChevronDown className="w-3 h-3 text-blue-500" />
            )}
          </button>
        </div>
      </div>

      {expandedSections[`activity-${activity.id}`] && (
        <div className="mt-2 pl-4 text-xs space-y-2 bg-gray-50 p-2 rounded">
          <p className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            {activity.location}
          </p>
          <p className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-gray-500" />
            {activity.estimatedCost}
          </p>
          {activity.tips && (
            <p className="flex items-start gap-1">
              <Info className="w-3 h-3 text-gray-500 mt-0.5" />
              {activity.tips}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderMealSection = (type: 'breakfast' | 'lunch' | 'dinner') => {
    const meal = currentDay.meals[type];
    const icons = {
      breakfast: Coffee,
      lunch: UtensilsCrossed,
      dinner: Wine
    };
    const Icon = icons[type];

    return (
      <div className="border-b border-gray-100 py-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-sm capitalize">{type}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChangeSuggestion(`meal-${type}`, meal, currentDay.dayNumber)}
              disabled={isChanging === `meal-${type}-${currentDay.dayNumber}`}
              className="p-1 rounded-full hover:bg-green-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 text-green-500 ${
                isChanging === `meal-${type}-${currentDay.dayNumber}` ? 'animate-spin' : ''
              }`} />
            </button>
            <button
              onClick={() => handleShowMap(meal.location)}
              className="p-1 rounded-full hover:bg-purple-50 transition-colors"
            >
              <MapPin className="w-3 h-3 text-purple-500" />
            </button>
            <button
              onClick={() => toggleSection(`meal-${type}`)}
              className="p-1 rounded-full hover:bg-blue-50 transition-colors"
            >
              {expandedSections[`meal-${type}`] ? (
                <ChevronUp className="w-3 h-3 text-blue-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-blue-500" />
              )}
            </button>
          </div>
        </div>

        {expandedSections[`meal-${type}`] && (
          <div className="mt-2 pl-4 text-xs space-y-2 bg-gray-50 p-2 rounded">
            <p>{meal.suggestion}</p>
            <p className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-500" />
              {meal.location}
            </p>
            <p>Cuisine: {meal.cuisine}</p>
            <p>{meal.priceRange}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Day {currentDay.dayNumber} Overview
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousDay}
                disabled={currentDayIndex === 0}
                className="p-1.5 rounded-lg hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm text-gray-600">
                Day {currentDayIndex + 1} of {days.length}
              </span>
              <button
                onClick={goToNextDay}
                disabled={currentDayIndex === days.length - 1}
                className="p-1.5 rounded-lg hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-4 p-4">
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Activities</h3>
                <div className="bg-white rounded-lg border border-gray-200 divide-y">
                  {currentDay.activities.map((activity: any, index: number) => 
                    renderActivityItem(activity, index)
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Meals</h3>
                <div className="bg-white rounded-lg border border-gray-200">
                  {renderMealSection('breakfast')}
                  {renderMealSection('lunch')}
                  {renderMealSection('dinner')}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Accommodation</h3>
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Hotel className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-sm">
                        {currentDay.accommodation.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleChangeSuggestion('accommodation', currentDay.accommodation, currentDay.dayNumber)}
                        disabled={isChanging === `accommodation-${currentDay.dayNumber}`}
                        className="p-1 rounded-full hover:bg-green-50 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 text-green-500 ${
                          isChanging === `accommodation-${currentDay.dayNumber}` ? 'animate-spin' : ''
                        }`} />
                      </button>
                      <button
                        onClick={() => handleShowMap(currentDay.accommodation.location)}
                        className="p-1 rounded-full hover:bg-purple-50 transition-colors"
                      >
                        <MapPin className="w-3 h-3 text-purple-500" />
                      </button>
                      <button
                        onClick={() => toggleSection('accommodation')}
                        className="p-1 rounded-full hover:bg-blue-50 transition-colors"
                      >
                        {expandedSections['accommodation'] ? (
                          <ChevronUp className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-blue-500" />
                        )}
                      </button>
                    </div>
                  </div>
                  {expandedSections['accommodation'] && (
                    <div className="mt-2 pl-4 text-xs space-y-2 bg-gray-50 p-2 rounded">
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        {currentDay.accommodation.location}
                      </p>
                      <p className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-gray-500" />
                        {currentDay.accommodation.priceRange}
                      </p>
                      {currentDay.accommodation.bookingTips && (
                        <p className="flex items-start gap-1">
                          <Info className="w-3 h-3 text-gray-500 mt-0.5" />
                          {currentDay.accommodation.bookingTips}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-80 space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Train className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-gray-900">Transportation</h3>
                </div>
                <div className="text-sm text-gray-600 space-y-2">
                  {currentDay.transportation ? (
                    <>
                      {currentDay.transportation.tips && (
                        <div className="space-y-1">
                          <p className="font-medium">Tips:</p>
                          <p>{currentDay.transportation.tips}</p>
                        </div>
                      )}
                      
                      {currentDay.transportation.estimatedCosts && (
                        <div className="space-y-1">
                          <p className="font-medium">Estimated Costs:</p>
                          <p>{currentDay.transportation.estimatedCosts}</p>
                        </div>
                      )}
                      
                      {currentDay.transportation.recommendedModes && (
                        <div className="space-y-1">
                          <p className="font-medium">Recommended Modes:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {Array.isArray(currentDay.transportation.recommendedModes) ? (
                              currentDay.transportation.recommendedModes.map((mode: string, index: number) => (
                                <li key={index}>{mode}</li>
                              ))
                            ) : (
                              <li>{currentDay.transportation.recommendedModes}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p>No transportation details available</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">Budget Summary</h3>
                </div>
                <div className="text-sm space-y-3">
                  {/* Cost Breakdown */}
                  <div className="space-y-2">
                    <p className="font-medium text-gray-700">Daily Cost Breakdown:</p>
                    <div className="bg-green-50 rounded p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accommodation:</span>
                        <span className="font-medium">{itinerary.budgetSummary?.costBreakdown.accommodation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Activities:</span>
                        <span className="font-medium">{itinerary.budgetSummary?.costBreakdown.activities}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transportation:</span>
                        <span className="font-medium">{itinerary.budgetSummary?.costBreakdown.transportation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Food:</span>
                        <span className="font-medium">{itinerary.budgetSummary?.costBreakdown.food}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-100">
                        <span className="font-medium text-gray-900">Estimated Total:</span>
                        <span className="font-medium text-gray-900">{itinerary.budgetSummary?.estimatedTotalCost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                  <h3 className="font-medium text-gray-900">Travel Tips</h3>
                </div>
                <div className="space-y-3">
                  {itinerary.generalTips?.map((tip, index) => (
                    <div key={index} className="text-sm bg-purple-50 p-3 rounded">
                      <span className="font-medium text-purple-900 block mb-1">
                        {tip.category}
                      </span>
                      <span className="text-purple-800">{tip.tip}</span>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-600">No travel tips available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 