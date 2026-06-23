import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

function VercelTelemetry({ beforeSend }) {
  return (
    <>
      <Analytics mode="production" beforeSend={beforeSend} />
      <SpeedInsights beforeSend={beforeSend} sampleRate={0.5} />
    </>
  );
}

export default VercelTelemetry;
