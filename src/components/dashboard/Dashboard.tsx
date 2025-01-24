import React, { useEffect, useState } from 'react';
import { Menu, Users, Clock, History, LogOut, MapPin, Calendar, DollarSign, Heart, Star, Plane, Sparkles, PlusCircle, Zap, Trash2 } from 'lucide-react';
import { ItineraryView } from '../itinerary/ItineraryView';
import { PastPlans } from '../plans/PastPlans';
import { supabase } from '../../lib/supabase';
import { LocationInput } from '../location/LocationInput';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { TripFormData, QuickPlanData, ItineraryResponse } from '../../lib/types';
import { PlanPreview } from '../preview/PlanPreview';
import { AIPreview } from '../preview/AIPreview';
import { generateItinerary } from '../../lib/api';
import { generateAIItinerary } from '../../lib/openai';
import toast from 'react-hot-toast';
import { TripForm } from '../trip-form/TripForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { GroupChat } from '../chat/GroupChat';
import { NewItineraryForm } from './NewItineraryForm';
import { CreateGroupModal, JoinGroupModal } from '../modals/GroupModals';
import { NewLiveChat } from './NewLiveChat';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isDestructive?: boolean;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  groupName: string;
}

interface Group {
  id: number;
  name: string;
  created_by: string;
  join_code?: string;
}

function generateJoinCode(): string {
  // Generate a random 6-character alphanumeric code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

export function Dashboard() {
  const [activeSection, setActiveSection] = useState('new-plan');
  const [showPreview, setShowPreview] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [itineraryData, setItineraryData] = useState<ItineraryResponse | null>(null);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isJoinGroupModalOpen, setIsJoinGroupModalOpen] = useState(false);
  const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [selectedGroupForAction, setSelectedGroupForAction] = useState<Group | null>(null);
  const [user, setUser] = useState<any>(null);

  const [quickPlanData, setQuickPlanData] = useState<QuickPlanData>({
    destination: '',
    destinationPlaceId: '',
    travelers: '2',
    budget: 'moderate',
    duration: '4-7'
  });

  const [newPlanData, setNewPlanData] = useState<TripFormData>({
    destination: '',
    destinationPlaceId: '',
    startDate: null,
    endDate: null,
    travelers: '2',
    budget: 'moderate',
    interests: '',
    numberOfDays: '3',
    experienceType: 'balanced'
  });

  const [currentCard, setCurrentCard] = useState(0);
  const totalCards = 4; // Destination, Travelers, Duration, Budget

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user?.user_metadata?.full_name) {
        setUserDisplayName(user.user_metadata.full_name);
      } else {
        setUserDisplayName(user?.email?.split('@')[0] || '');
      }
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleNewPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanData.destination) {
      toast.error('Please enter a destination');
      return;
    }
    setShowPreview(true);
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const params = {
        location: activeSection === 'quick-plan' ? quickPlanData.destination : newPlanData.destination,
        peopleCount: parseInt(activeSection === 'quick-plan' ? quickPlanData.travelers : newPlanData.travelers),
        budgetRange: activeSection === 'quick-plan' ? quickPlanData.budget : newPlanData.budget,
        occasion: 'leisure',
        duration: activeSection === 'quick-plan' 
          ? parseInt(quickPlanData.duration.split('-')[0]) 
          : parseInt(newPlanData.numberOfDays)
      };

      const { data } = await generateItinerary(params);
      setItineraryData(data);
      setSelectedPlan(null);
      setActiveSection('itinerary');
      setShowPreview(false);
    } catch (error) {
      console.error('Error generating itinerary:', error);
      toast.error('Failed to generate itinerary');
    } finally {
      setIsGenerating(false);
    }
  };

  const getBudgetValue = (data: QuickPlanData | TripFormData) => {
    if (data.budget === 'custom' && data.customBudget) {
      return data.customBudget;
    }
    return data.budget;
  };

  const handleGenerateAIPlan = async () => {
    const destination = activeSection === 'quick-plan' ? quickPlanData.destination : newPlanData.destination;
    
    if (!destination) {
      toast.error('Please enter a destination');
      return;
    }

    setIsGeneratingAI(true);
    try {
      // Format dates if they exist
      const dateString = newPlanData.startDate && newPlanData.endDate 
        ? `This itinerary is from ${newPlanData.startDate.toLocaleDateString()} to ${newPlanData.endDate.toLocaleDateString()}. Consider these dates, account for holidays, festivals, special events etc.`
        : '';

      // Combine occasion with interests and dates
      const occasionString = activeSection === 'quick-plan'
        ? 'leisure'
        : `${newPlanData.experienceType}${newPlanData.interests ? `. Other things to be kept in mind are ${newPlanData.interests}` : ''}${dateString}`;

      const getDurationValue = (data: QuickPlanData | TripFormData) => {
        if ('duration' in data) {
          // Quick plan
          if (data.duration === 'custom' && data.customDays) {
            return parseInt(data.customDays);
          }
          return parseInt(data.duration.split('-')[0]);
        } else {
          // Detailed plan
          if (data.numberOfDays === 'custom' && data.customDays) {
            return parseInt(data.customDays);
          }
          return parseInt(data.numberOfDays);
        }
      };

      const params = {
        location: destination,
        peopleCount: parseInt(activeSection === 'quick-plan' ? quickPlanData.travelers : newPlanData.travelers),
        budgetRange: getBudgetValue(activeSection === 'quick-plan' ? quickPlanData : newPlanData),
        occasion: occasionString,
        duration: getDurationValue(activeSection === 'quick-plan' ? quickPlanData : newPlanData)
      };

      const itinerary = await generateAIItinerary(params);
      setItineraryData(itinerary);
      setSelectedPlan(null);
      setActiveSection('itinerary');
      setShowAIPreview(false);
    } catch (error) {
      console.error('Error generating AI plan:', error);
      toast.error('Failed to generate AI plan');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSectionChange = (newSection: string) => {
    if (activeSection === 'itinerary' && itineraryData && !selectedPlan?.id) {
      const confirmed = window.confirm(
        'Are you sure you want to leave? You will need to generate the plan again to view it. Consider saving the plan if you want to view it later.'
      );
      if (!confirmed) {
        return;
      }
    }
    
    setActiveSection(newSection);
  };

  const handleViewPlan = (plan: any) => {
    setItineraryData(plan);
    setSelectedPlan({ id: plan.id });
    setActiveSection('itinerary');
  };

  const renderQuickPlanContent = () => {
    return (
      <div className="max-w-4xl mx-auto relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center transform rotate-12">
            <Plane className="w-8 h-8 text-white transform -rotate-12" />
          </div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Quick Trip Planner
          </h2>
          <p className="text-gray-600">Create your perfect trip in just a few clicks</p>
        </div>

        <div className="relative h-[400px]">
          {/* Card Container with transition */}
          <div className="relative w-full h-full">
            {/* Destination Card */}
            <div className={`absolute w-full transition-all duration-300 ${
              currentCard === 0 ? 'opacity-100 translate-x-0' : 
              currentCard > 0 ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'
            }`}>
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Where to?</h3>
                </div>
                <LocationInput
                  value={quickPlanData.destination}
                  onChange={(value, placeId) => {
                    setQuickPlanData(prev => ({
                      ...prev,
                      destination: value,
                      destinationPlaceId: placeId
                    }));
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="Enter destination"
                />
              </div>
            </div>

            {/* Travelers Card */}
            <div className={`absolute w-full transition-all duration-300 ${
              currentCard === 1 ? 'opacity-100 translate-x-0' : 
              currentCard > 1 ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'
            }`}>
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Who's going?</h3>
                </div>
                <select
                  value={quickPlanData.travelers}
                  onChange={(e) => setQuickPlanData(prev => ({ ...prev, travelers: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                >
                  <option value="1">Solo traveler</option>
                  <option value="2">2 people</option>
                  <option value="3-4">Small group (3-4)</option>
                  <option value="5+">Large group (5+)</option>
                </select>
              </div>
            </div>

            {/* Duration Card */}
            <div className={`absolute w-full transition-all duration-300 ${
              currentCard === 2 ? 'opacity-100 translate-x-0' : 
              currentCard > 2 ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'
            }`}>
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold">How long?</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: '1-3', label: '1-3 days' },
                    { value: '4-7', label: '4-7 days' },
                    { value: '8-14', label: '8-14 days' },
                    { value: '15+', label: '15+ days' },
                    { value: 'custom', label: 'Custom' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setQuickPlanData(prev => ({ ...prev, duration: option.value }))}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                        quickPlanData.duration === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {quickPlanData.duration === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={quickPlanData.customDays || ''}
                    onChange={(e) => setQuickPlanData(prev => ({ ...prev, customDays: e.target.value }))}
                    placeholder="Enter number of days"
                    className="mt-3 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>

            {/* Budget Card */}
            <div className={`absolute w-full transition-all duration-300 ${
              currentCard === 3 ? 'opacity-100 translate-x-0' : 
              currentCard > 3 ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'
            }`}>
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Budget</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'budget', label: 'Budget', icon: '$' },
                    { value: 'moderate', label: 'Moderate', icon: '$$' },
                    { value: 'luxury', label: 'Luxury', icon: '$$$' },
                    { value: 'ultra', label: 'Ultra', icon: '$$$$' },
                    { value: 'custom', label: 'Custom', icon: '✏️' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setQuickPlanData(prev => ({ ...prev, budget: option.value }))}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        quickPlanData.budget === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xl mb-1 font-semibold">{option.icon}</div>
                      <div className="text-sm">{option.label}</div>
                    </button>
                  ))}
                </div>
                {quickPlanData.budget === 'custom' && (
                  <input
                    type="text"
                    value={quickPlanData.customBudget || ''}
                    onChange={(e) => setQuickPlanData(prev => ({ ...prev, customBudget: e.target.value }))}
                    placeholder="Enter your budget (e.g., $500 per day)"
                    className="mt-3 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between items-center px-4">
            {currentCard > 0 && (
              <button
                onClick={() => setCurrentCard(prev => prev - 1)}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {currentCard < totalCards - 1 && (
              <button
                onClick={() => setCurrentCard(prev => prev + 1)}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors ml-auto"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Progress Dots */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2 mb-4">
            {Array.from({ length: totalCards }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCard(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  currentCard === index ? 'bg-blue-500 w-4' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Generate Button */}
        {currentCard === totalCards - 1 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowAIPreview(true)}
              disabled={!quickPlanData.destination || isGeneratingAI}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-md font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Generate AI Plan
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderMainContent = () => {
    if (activeSection === 'itinerary' && itineraryData) {
      return <ItineraryView itinerary={itineraryData} planId={selectedPlan?.id} />;
    }

    if (activeSection === 'new-itinerary') {
      return <NewItineraryForm groupId={selectedGroup?.id} initialGroups={groups} />;
    }

    if (activeSection === 'new-live-chat') {
      return <NewLiveChat />;
    }

    if (activeSection === 'past-plans') {
      return <PastPlans onViewPlan={handleViewPlan} />;
    }

    if (activeSection === 'quick-plan') {
      return renderQuickPlanContent();
    }

    if (activeSection === 'chat' && selectedGroup) {
      return (
        <GroupChat 
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          joinCode={selectedGroup.join_code}
          createdBy={selectedGroup.created_by}
        />
      );
    }

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 shadow-lg border border-blue-100">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center transform rotate-12">
              <MapPin className="w-8 h-8 text-white transform -rotate-12" />
            </div>
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Plan Your Dream Trip
            </h2>
            <p className="text-gray-600">Fill in the details below and let us create your perfect itinerary</p>
          </div>

          <form onSubmit={handleNewPlanSubmit} className="space-y-8">
            {/* Destination Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                Where would you like to go?
              </label>
              <LocationInput
                value={newPlanData.destination}
                onChange={(value, placeId) => {
                  setNewPlanData(prev => ({
                    ...prev,
                    destination: value,
                    destinationPlaceId: placeId
                  }));
                }}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors text-lg"
                placeholder="Enter your destination"
              />
            </div>

            {/* Trip Details Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Trip Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    When are you planning to travel?
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <DatePicker
                      selected={newPlanData.startDate}
                      onChange={(date) => setNewPlanData(prev => ({ ...prev, startDate: date }))}
                      selectsStart
                      startDate={newPlanData.startDate}
                      endDate={newPlanData.endDate}
                      placeholderText="Start Date"
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                    />
                    <DatePicker
                      selected={newPlanData.endDate}
                      onChange={(date) => setNewPlanData(prev => ({ ...prev, endDate: date }))}
                      selectsEnd
                      startDate={newPlanData.startDate}
                      endDate={newPlanData.endDate}
                      minDate={newPlanData.startDate}
                      placeholderText="End Date"
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="numberOfDays" className="block text-sm font-medium text-gray-700">
                    Trip Duration
                  </label>
                  <select
                    id="numberOfDays"
                    value={newPlanData.numberOfDays}
                    onChange={(e) => setNewPlanData(prev => ({ ...prev, numberOfDays: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  >
                    <option value="3">3 days</option>
                    <option value="5">5 days</option>
                    <option value="7">7 days</option>
                    <option value="10">10 days</option>
                    <option value="14">14 days</option>
                    <option value="custom">Custom</option>
                  </select>
                  {newPlanData.numberOfDays === 'custom' && (
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={newPlanData.customDays || ''}
                      onChange={(e) => setNewPlanData(prev => ({ ...prev, customDays: e.target.value }))}
                      placeholder="Enter number of days"
                      className="mt-2 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="travelers" className="block text-sm font-medium text-gray-700">
                    Number of Travelers
                  </label>
                  <select
                    id="travelers"
                    value={newPlanData.travelers}
                    onChange={(e) => setNewPlanData(prev => ({ ...prev, travelers: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  >
                    <option value="1">1 person</option>
                    <option value="2">2 people</option>
                    <option value="3-4">3-4 people</option>
                    <option value="5+">5+ people</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
                    Budget Range
                  </label>
                  <select
                    id="budget"
                    value={newPlanData.budget}
                    onChange={(e) => setNewPlanData(prev => ({ ...prev, budget: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  >
                    <option value="budget">Budget ($)</option>
                    <option value="moderate">Moderate ($$)</option>
                    <option value="luxury">Luxury ($$$)</option>
                    <option value="ultra">Ultra-Luxury ($$$$)</option>
                    <option value="custom">Custom Budget</option>
                  </select>
                  {newPlanData.budget === 'custom' && (
                    <input
                      type="text"
                      value={newPlanData.customBudget || ''}
                      onChange={(e) => setNewPlanData(prev => ({ ...prev, customBudget: e.target.value }))}
                      placeholder="Enter your budget (e.g., $500 per day)"
                      className="mt-2 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Experience Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Experience Preferences</h3>
              
              <div className="space-y-4">
                <label htmlFor="experienceType" className="block text-sm font-medium text-gray-700">
                  What type of experience are you looking for?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { value: 'relaxed', label: 'Relaxed & Easy', icon: '🌅' },
                    { value: 'balanced', label: 'Balanced Mix', icon: '⚖️' },
                    { value: 'adventurous', label: 'Adventurous', icon: '🏃‍♂️' },
                    { value: 'cultural', label: 'Cultural Focus', icon: '🏛️' },
                    { value: 'luxury', label: 'Luxury Experience', icon: '✨' },
                    { value: 'party', label: 'Party', icon: '🎉' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNewPlanData(prev => ({ ...prev, experienceType: option.value }))}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        newPlanData.experienceType === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{option.icon}</span>
                      <span className="font-medium block">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label htmlFor="interests" className="block text-sm font-medium text-gray-700">
                  Any specific interests or preferences? (Optional)
                </label>
                <textarea
                  id="interests"
                  value={newPlanData.interests}
                  onChange={(e) => setNewPlanData(prev => ({ ...prev, interests: e.target.value }))}
                  rows={3}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="e.g., photography, local cuisine, hiking..."
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAIPreview(true)}
                disabled={!newPlanData.destination || isGeneratingAI}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-md font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 w-full max-w-md"
              >
                <Sparkles className="w-5 h-5" />
                AI Plan
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleCreateGroup = async (name: string) => {
    try {
      // Get current user data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Create a unique join code
      const joinCode = generateJoinCode();

      // First create the group
      const { data: groupData, error: groupError } = await supabase
        .from('trip_groups')
        .insert([
          {
            name,
            join_code: joinCode,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (groupError) throw groupError;

      // Then add the creator as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupData.id,
            user_id: user.id,
            email: user.email,
            joined_at: new Date().toISOString()
          }
        ]);

      if (memberError) throw memberError;

      // Update local state and close modal
      setGroups(prev => [...prev, groupData]);
      setIsCreateGroupModalOpen(false);
      toast.success('Group created successfully!');
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const handleJoinGroup = async (joinCode: string) => {
    try {
      // Get current user data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Find the group with this join code
      const { data: groupData, error: groupError } = await supabase
        .from('trip_groups')
        .select('*')
        .eq('join_code', joinCode)
        .single();

      if (groupError) throw groupError;

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast.error('You are already a member of this group');
        return;
      }

      // Add user as a member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupData.id,
            user_id: user.id,
            email: user.email,
            joined_at: new Date().toISOString()
          }
        ]);

      if (memberError) throw memberError;

      // Update local state and close modal
      setGroups(prev => [...prev, groupData]);
      setIsJoinGroupModalOpen(false);
      toast.success('Joined group successfully!');
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error('Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setActiveSection('new-plan');
      }
      toast.success('Successfully left group');
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Failed to leave group');
    } finally {
      // Close the modal regardless of success or failure
      setIsLeaveGroupModalOpen(false);
      setSelectedGroupForAction(null);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      // First, delete all live sessions for this group
      const { error: sessionsError } = await supabase
        .from('live_itinerary_sessions')
        .delete()
        .eq('group_id', groupId);

      if (sessionsError) {
        console.error('Error deleting live sessions:', sessionsError);
        throw sessionsError;
      }

      // Delete all trip messages
      const { error: messagesError } = await supabase
        .from('trip_messages')
        .delete()
        .eq('group_id', groupId);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        throw messagesError;
      }

      // Delete all group members
      const { error: membersError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);

      if (membersError) {
        console.error('Error deleting members:', membersError);
        throw membersError;
      }

      // Finally delete the group
      const { error: groupError } = await supabase
        .from('trip_groups')
        .delete()
        .eq('id', groupId)
        .eq('created_by', user?.id); // Ensure only owner can delete

      if (groupError) {
        console.error('Error deleting group:', groupError);
        throw groupError;
      }

      // Update local state
      setGroups(groups.filter(g => g.id !== groupId));
      toast.success('Group deleted successfully');

    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // First get groups the user created
        const { data: createdGroups, error: createdError } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('created_by', user.id);

        // Then get groups the user is a member of
        const { data: memberGroups, error: memberError } = await supabase
          .from('group_members')
          .select('trip_groups(*)')
          .eq('user_id', user.id);

        if (createdError) throw createdError;
        if (memberError) throw memberError;

        // Combine and deduplicate groups
        const allGroups = [
          ...(createdGroups || []),
          ...(memberGroups?.map(m => m.trip_groups) || [])
        ].filter((group, index, self) => 
          index === self.findIndex((g) => g.id === group.id)
        );

        setGroups(allGroups);
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast.error('Failed to load groups');
      }
    };

    fetchGroups();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="w-64 bg-white border-r border-gray-200 fixed h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#CBD5E1_#F1F5F9]">
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Menu className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                DayMap
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleSectionChange('new-plan')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSection === 'new-plan'
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                New Plan
              </button>
              <button
                onClick={() => handleSectionChange('quick-plan')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSection === 'quick-plan'
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Zap className="w-5 h-5" />
                Quick Plan
              </button>
              <button
                onClick={() => handleSectionChange('past-plans')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSection === 'past-plans'
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Clock className="w-5 h-5" />
                Past Plans
              </button>
              <button
                onClick={() => {
                  setActiveSection('new-itinerary');
                  setSelectedGroup(null);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'new-itinerary'
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                Live Itinerary Chat
              </button>
              {/* <button
                onClick={() => {
                  setActiveSection('new-live-chat');
                  setSelectedGroup(null);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'new-live-chat'
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="w-5 h-5" />
                New Chat
              </button> */}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">My Groups</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCreateGroupModalOpen(true)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Create Group"
                  >
                    <PlusCircle className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setIsJoinGroupModalOpen(true)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Join Group"
                  >
                    <Users className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      selectedGroup?.id === group.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedGroup(group);
                        setActiveSection('chat');
                      }}
                      className={`flex-1 text-left truncate ${
                        selectedGroup?.id === group.id && activeSection === 'chat'
                          ? 'text-blue-600'
                          : 'text-gray-600'
                      }`}
                    >
                      <span className="truncate">{group.name}</span>
                      {group.created_by === user?.id && (
                        <span className="text-xs text-gray-400 ml-2">(Owner)</span>
                      )}
                    </button>
                    
                    {group.created_by === user?.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupForAction(group);
                          setIsDeleteGroupModalOpen(true);
                        }}
                        className="p-1 hover:bg-red-50 rounded-full group"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupForAction(group);
                          setIsLeaveGroupModalOpen(true);
                        }}
                        className="p-1 hover:bg-red-50 rounded-full group"
                        title="Leave Group"
                      >
                        <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 border-t">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-sm text-gray-600">
                Hi, {userDisplayName}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 pl-64">
        <div className="p-8 relative">
          {renderMainContent()}
          
          {isGeneratingAI && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <LoadingSpinner />
              <p className="mt-4 text-gray-600 font-medium">Generating your personalized itinerary...</p>
            </div>
          )}
        </div>
      </div>

      {showAIPreview && (
        <PlanPreview
          data={activeSection === 'quick-plan' ? quickPlanData : newPlanData}
          onClose={() => setShowAIPreview(false)}
          onConfirm={handleGenerateAIPlan}
          type={activeSection === 'quick-plan' ? 'quick' : 'detailed'}
          isLoading={isGeneratingAI}
          isAI={true}
        />
      )}

      {showPreview && (
        <PlanPreview
          data={activeSection === 'quick-plan' ? quickPlanData : newPlanData}
          onClose={() => setShowPreview(false)}
          onConfirm={handleGeneratePlan}
          type={activeSection === 'quick-plan' ? 'quick' : 'detailed'}
          isLoading={isGenerating}
          isAI={false}
        />
      )}

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onCreateGroup={handleCreateGroup}
        title="Create New Group"
      />

      <JoinGroupModal
        isOpen={isJoinGroupModalOpen}
        onClose={() => setIsJoinGroupModalOpen(false)}
        onJoinGroup={handleJoinGroup}
        title="Join Group"
      />

      <ConfirmDeleteModal
        isOpen={isDeleteGroupModalOpen}
        onClose={() => {
          setIsDeleteGroupModalOpen(false);
          setSelectedGroupForAction(null);
        }}
        onConfirm={() => selectedGroupForAction && handleDeleteGroup(selectedGroupForAction.id)}
        groupName={selectedGroupForAction?.name || ''}
      />

      <ConfirmLeaveModal
        isOpen={isLeaveGroupModalOpen}
        onClose={() => {
          setIsLeaveGroupModalOpen(false);
          setSelectedGroupForAction(null);
        }}
        onConfirm={() => selectedGroupForAction && handleLeaveGroup(selectedGroupForAction.id)}
        groupName={selectedGroupForAction?.name || ''}
      />
    </div>
  );
}

function ConfirmDeleteModal({ isOpen, onClose, onConfirm, groupName }: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Delete Group</h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete "{groupName}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmLeaveModal({ isOpen, onClose, onConfirm, groupName }: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Leave Group</h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to leave "{groupName}"?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

























