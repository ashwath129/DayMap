import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoogleMapsApi } from '../../lib/googleMaps';

interface LocationInputProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationInput({ value, onChange, placeholder = "Enter destination", className = "" }: LocationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsApi()
      .then(() => setIsLoaded(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoaded && inputRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['(cities)']
      });

      // Prevent form submission on enter
      inputRef.current.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });

      // Handle place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address, place.place_id);
          if (inputRef.current) {
            inputRef.current.value = place.formatted_address;
          }
        }
      });
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MapPin className="w-5 h-5 text-gray-400" />
      </div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        className={`pl-10 ${className}`}
      />
    </div>
  );
}