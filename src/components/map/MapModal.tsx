import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { showLocationOnMap } from '../../lib/googleMaps';
import toast from 'react-hot-toast';

interface Props {
  location: string;
  onClose: () => void;
}

export function MapModal({ location, onClose }: Props) {
  useEffect(() => {
    const initMap = async () => {
      try {
        await showLocationOnMap(location);
      } catch (error) {
        toast.error('Failed to load location on map');
        onClose();
      }
    };
    
    initMap();
  }, [location]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] relative">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-lg">{location}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div id="map-container" className="w-full h-[60vh]" />
      </div>
    </div>
  );
} 