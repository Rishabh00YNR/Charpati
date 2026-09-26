import type { Metadata } from 'next';
import PlayHome from '@/components/play/PlayHome';
import './play.css';

export const metadata: Metadata = {
  title: 'Play Charpati',
  description: 'Create a room or join your friends with a code.',
};

export default function Page() {
  return <PlayHome />;
}
