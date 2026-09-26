import type { Metadata } from 'next';
import Room from '@/components/play/Room';
import { cleanCode } from '@/lib/rooms';
import '../play.css';

export const metadata: Metadata = { title: 'Charpati room' };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Room code={cleanCode(code)} />;
}
