import { createContext, useContext } from 'react';
export const KeyboardRevealContext = createContext<(() => void) | undefined>(undefined);
export const useKeyboardReveal = () => useContext(KeyboardRevealContext);
