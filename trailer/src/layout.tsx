import { createContext, useContext } from 'react';
import { PORTRAIT, type Layout } from './theme';

// Which shape of video is being drawn (vertical or landscape). Set once in Trailer.tsx.
export const LayoutContext = createContext<Layout>(PORTRAIT);
export const useLayout = () => useContext(LayoutContext);
