import * as React from "react";
import { useEffect, useState, useCallback } from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// GAP-UM02: Tipos de orientação
type Orientation = 'portrait' | 'landscape';

// GAP-UM04: Suporte a touch
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

interface UseMobileOptions {
  /** GAP-UM03: Breakpoint customizado */
  breakpoint?: number;
  /** GAP-UM04: Considerar touch como mobile */
  touchAsMobile?: boolean;
  /** GAP-UM02: Incluir orientação */
  includeOrientation?: boolean;
}

interface UseMobileReturn {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** GAP-UM02: Orientação */
  orientation: Orientation;
  /** GAP-UM04: Suporte a touch */
  isTouch: boolean;
  /** GAP-UM02: Largura atual */
  width: number;
  /** GAP-UM02: Altura atual */
  height: number;
}

export function useIsMobile(): boolean {
  return useMobile().isMobile;
}

export function useMobile(options: UseMobileOptions = {}): UseMobileReturn {
  const { 
    breakpoint = MOBILE_BREAKPOINT,
    touchAsMobile = true,
    includeOrientation = true,
  } = options;

  // GAP-UM01: SSR - estado inicial no servidor
  const getInitialState = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        orientation: 'landscape' as Orientation,
        isTouch: false,
        width: 1024,
        height: 768,
      };
    }
    return {
      isMobile: window.innerWidth < breakpoint,
      isTablet: window.innerWidth >= breakpoint && window.innerWidth < TABLET_BREAKPOINT,
      isDesktop: window.innerWidth >= TABLET_BREAKPOINT,
      orientation: window.innerWidth < window.innerHeight ? 'portrait' : 'landscape',
      isTouch: isTouchDevice(),
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }, [breakpoint]);

  const [state, setState] = useState(getInitialState);

  // GAP-UM03: Atualizar estado
  const updateState = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setState({
      isMobile: width < breakpoint,
      isTablet: width >= breakpoint && width < TABLET_BREAKPOINT,
      isDesktop: width >= TABLET_BREAKPOINT,
      orientation: width < height ? 'portrait' : 'landscape',
      isTouch: isTouchDevice(),
      width,
      height,
    });
  }, [breakpoint]);

  // GAP-UM03: Efeito para resize e orientation change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // GAP-UM02: Listen para orientation change
    const handleOrientationChange = () => {
      updateState();
    };

    const handleResize = () => {
      updateState();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateState]);

  // GAP-UM04: Touch detection com fallback
  const isTouch = state.isTouch || (touchAsMobile && state.isMobile);

  return {
    ...state,
    isTouch,
  };
}

// GAP-UM02: Hook específico para orientação
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setOrientation(window.innerWidth < window.innerHeight ? 'portrait' : 'landscape');
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return orientation;
}

// GAP-UM04: Hook específico para touch
export function useTouchSupport(): boolean {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    setHasTouch(isTouchDevice());
  }, []);

  return hasTouch;
}

// GAP-UM01: Hook para SSR seguro
export function useIsMobileSSR(defaultValue = false): boolean {
  const [isMobile, setIsMobile] = useState(defaultValue);

  useEffect(() => {
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
  }, []);

  return isMobile;
}