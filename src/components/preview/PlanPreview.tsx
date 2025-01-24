import React from 'react';
import { Calendar, Users, DollarSign, Clock, MapPin, Heart, Loader2, Star, X, Sparkles } from 'lucide-react';
import { QuickPlanData, TripFormData } from '../../lib/types';

interface Props {
  data: QuickPlanData | TripFormData;
  onClose: () => void;
  onConfirm: () => void;
  type: 'quick' | 'detailed';
  isLoading: boolean;
  isAI?: boolean;
}

const getBudgetLabel = (budget: string) => {
  const labels: Record<string, string> = {
    'budget': 'Budget ($)',
    'moderate': 'Moderate ($$)',
    'luxury': 'Luxury ($$$)',
    'ultra': 'Ultra-Luxury ($$$$)'
  };
  return labels[budget] || budget;
};

const getDurationLabel = (duration: string) => {
  const labels: Record<string, string> = {
    '1-3': '1-3 days',
    '4-7': '4-7 days',
    '8-14': '8-14 days',
    '15+': '15+ days'
  };
  return labels[duration] || duration;
};

const getExperienceLabel = (experience: string) => {
  const labels: Record<string, string> = {
    'relaxed': 'Relaxed & Easy',
    'balanced': 'Balanced Mix',
    'adventurous': 'Adventurous',
    'cultural': 'Cultural Focus',
    'luxury': 'Luxury Experience'
  };
  return labels[experience] || experience;
};

export function PlanPreview({ data, onClose, onConfirm, type, isLoading, isAI }: Props) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {isAI ? 'Everything Looks Good!' : 'Plan Preview'}
          </h2>
          <p className="text-gray-600">
            {isAI 
              ? 'Our AI will create a personalized itinerary based on your preferences'
              : 'Here\'s a summary of your trip details'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Destination</p>
              <p className="font-medium">{data.destination}</p>
            </div>
          </div>

          {type === 'detailed' && 'startDate' in data && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Dates</p>
                <p className="font-medium">
                  {formatDate(data.startDate)} - {formatDate(data.endDate)}
                </p>
              </div>
            </div>
          )}

          {type === 'quick' && 'duration' in data && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">{getDurationLabel(data.duration)}</p>
              </div>
            </div>
          )}

          {type === 'detailed' && 'numberOfDays' in data && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">{data.numberOfDays} days</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Travelers</p>
              <p className="font-medium">{data.travelers}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Budget</p>
              <p className="font-medium">{getBudgetLabel(data.budget)}</p>
            </div>
          </div>

          {type === 'detailed' && 'experienceType' in data && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Experience Type</p>
                <p className="font-medium">{getExperienceLabel(data.experienceType)}</p>
              </div>
            </div>
          )}

          {type === 'detailed' && 'interests' in data && data.interests && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Interests</p>
                <p className="font-medium">{data.interests}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg text-white flex items-center gap-2 ${
              isAI 
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
            }`}
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                Generating...
              </>
            ) : (
              <>
                {isAI ? <Sparkles className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                {isAI ? 'Generate AI Plan' : 'Generate Plan'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}