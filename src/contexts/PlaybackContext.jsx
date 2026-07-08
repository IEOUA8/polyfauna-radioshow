import React, { createContext, useContext, useCallback, useRef, useState } from 'react';

const PlaybackContext = createContext(undefined);

export function PlaybackProvider({ children }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const sectionNavigatorRef = useRef(null);

  // PolyfaunaOS se registra aca mientras esta montado, para que
  // GlobalPlayer (que ahora vive fuera de las rutas, ver App.jsx) pueda
  // cambiar de seccion al instante si PolyfaunaOS ya esta en pantalla, en
  // vez de navegar siempre por URL.
  const registerSectionNavigator = useCallback((fn) => {
    sectionNavigatorRef.current = fn;
  }, []);

  const goToSection = useCallback((section) => {
    if (sectionNavigatorRef.current) {
      sectionNavigatorRef.current(section);
      return true;
    }
    return false;
  }, []);

  return (
    <PlaybackContext.Provider value={{
      isPlaying, setIsPlaying,
      currentTrack, setCurrentTrack,
      registerSectionNavigator, goToSection,
    }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (ctx === undefined) throw new Error('usePlayback must be used within a PlaybackProvider');
  return ctx;
}
