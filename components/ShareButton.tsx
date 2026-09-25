'use client';

import { useState } from 'react';

export default function ShareButton() {
  const [note, setNote] = useState('');

  async function share() {
    const url = window.location.href.split('#')[0];
    const text = 'Four cards. Hidden. Lowest total wins. Charpati is coming soon.';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Charpati', text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote('Link copied. Send it to your card crew.');
    } catch {
      // Closing the share sheet lands here too; nothing to report.
    }
  }

  return (
    <div className="share">
      <button type="button" className="btn big" onClick={share}>Share with your card crew</button>
      <span className="share-note" role="status">{note}</span>
    </div>
  );
}
