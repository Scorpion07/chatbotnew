import React from 'react';
import BotCard from './BotCard';

export default function BotGrid({ bots, onBotSelect }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bots.map((bot) => (
        <BotCard key={bot.id} bot={bot} onClick={() => onBotSelect(bot)} />
      ))}
    </div>
  );
}