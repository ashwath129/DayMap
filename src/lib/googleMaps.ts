// Get both API key and Map ID from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_ID = import.meta.env.VITE_GOOGLE_MAPS_ID;

// Singleton to manage Google Maps API loading
let isLoading = false;
let isLoaded = false;

export function loadGoogleMapsApi(): Promise<void> {
  if (isLoaded) {
    return Promise.resolve();
  }

  if (isLoading) {
    return new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (isLoaded) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
    });
  }

  isLoading = true;

  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker`;
      script.async = true;
      script.onload = () => {
        isLoaded = true;
        isLoading = false;
        resolve();
      };
      script.onerror = () => {
        isLoading = false;
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    } catch (error) {
      isLoading = false;
      reject(error);
    }
  });
}

export function showLocationOnMap(location: string): Promise<google.maps.Map> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGoogleMapsApi();
      
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: location }, async (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const mapOptions = {
            center: results[0].geometry.location,
            zoom: 15,
            mapTypeControl: true,
            fullscreenControl: true,
            mapId: GOOGLE_MAPS_ID,
            mapTypeId: google.maps.MapTypeId.ROADMAP
          };
          
          const map = new google.maps.Map(
            document.getElementById('map-container')!,
            mapOptions
          );

          if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            new google.maps.marker.AdvancedMarkerElement({
              map,
              position: results[0].geometry.location,
              title: location,
              content: new google.maps.marker.PinElement({
                background: '#1E40AF',
                borderColor: '#1E3A8A',
                glyphColor: '#FFFFFF',
              }).element
            });
          } else {
            new google.maps.Marker({
              map,
              position: results[0].geometry.location,
              title: location
            });
          }
          
          resolve(map);
        } else {
          reject(new Error('Location not found'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}