import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, Clock, DollarSign, Info, RefreshCw } from 'lucide-react';
import { ChangeSuggestionButton } from './ChangeSuggestionButton';

interface Activity {
  id: string;
  activityName: string;
  startTime: string;
  duration: string;
  description: string;
  estimatedCost: string;
  location: string;
  tips: string;
}

interface Props {
  activity: Activity;
  onTimeChange: (id: string, newTime: string) => void;
  actionButton?: React.ReactNode;
  index: number;
  currentDay: any;
  handleShowMap: (location: string) => void;
  onSuggestionChange?: (newSuggestion: any) => void;
  isChanging?: boolean;
}

export function SortableActivityItem({ activity, onTimeChange, actionButton, index, currentDay, handleShowMap, onSuggestionChange, isChanging }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTime, setTempTime] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Convert 12h format to 24h format for the input
  const get24HourTime = (timeStr: string) => {
    const [time, meridiem] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours, 10);
    
    if (meridiem === 'PM' && hour !== 12) {
      hour += 12;
    } else if (meridiem === 'AM' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  };

  // Convert 24h format to 12h format
  const get12HourTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${meridiem}`;
  };

  const handleTimeClick = () => {
    setTempTime(get24HourTime(activity.startTime));
    setIsEditing(true);
  };

  const handleTimeBlur = () => {
    setIsEditing(false);
    if (!tempTime) return;
    onTimeChange(activity.id, get12HourTime(tempTime));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTime(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTimeBlur();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="cursor-grab hover:bg-gray-100 p-1.5 rounded transition-colors">
              <GripVertical className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{activity.activityName}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                {isEditing ? (
                  <input
                    type="time"
                    value={tempTime}
                    onChange={handleTimeChange}
                    onBlur={handleTimeBlur}
                    onKeyDown={handleKeyDown}
                    className="w-24 px-2 py-1 border rounded"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={handleTimeClick}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    {activity.startTime}
                  </button>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {activity.duration}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {activity.estimatedCost}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Updated ChangeSuggestionButton */}
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 rounded-full hover:bg-blue-50 transition-colors group"
            title="View details"
          >
            <Info className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => onSuggestionChange?.(activity)}
            disabled={isChanging}
            className="p-1.5 rounded-full hover:bg-green-50 transition-colors group"
            title="Get new suggestion"
          >
            <RefreshCw className={`w-4 h-4 text-green-500 group-hover:text-green-600 ${
              isChanging ? 'animate-spin' : ''
            }`} />
          </button>
          <button
            onClick={() => handleShowMap(activity.location)}
            className="p-1.5 rounded-full hover:bg-purple-50 transition-colors group"
            title="View on map"
          >
            <MapPin className="w-4 h-4 text-purple-500 group-hover:text-purple-600" />
          </button>
        </div>
      </div>

      {/* Activity Details Section - Enhanced styling */}
      {showDetails && (
        <div className="mt-3 pl-12">
          <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-sm text-gray-900">Location</p>
                <p className="text-sm text-gray-700">{activity.location}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-gray-500 mt-1" />
              <div>
                <p className="font-medium text-sm text-gray-900">Cost Details</p>
                <p className="text-sm text-gray-700">{activity.estimatedCost}</p>
              </div>
            </div>

            {activity.tips && (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Tips</p>
                  <p className="text-sm text-gray-700">{activity.tips}</p>
                </div>
              </div>
            )}

            {activity.description && (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Description</p>
                  <p className="text-sm text-gray-700">{activity.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}