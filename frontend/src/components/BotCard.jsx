import React from 'react';

export default function BotCard({ bot, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 transition-all hover:shadow-xl cursor-pointer overflow-hidden"
    >
      {/* Bot Icon and Name */}
      <div className="flex items-center gap-3 p-6 pb-4">
        <div className={`w-12 h-12 ${bot.color} rounded-xl flex items-center justify-center text-2xl shadow-lg overflow-hidden`}>
          {typeof bot.icon === 'string' && /(\.(png|jpe?g|svg|gif|webp)$|^https?:\/\/|^\/)/i.test(bot.icon)
            ? (
                // Image path or URL
                <img
                  src={bot.icon}
                  alt={bot.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to emoji if image fails
                    if (bot.emoji) {
                      e.currentTarget.replaceWith(document.createTextNode(bot.emoji));
                    } else if (bot.fallbackIcon) {
                      e.currentTarget.replaceWith(document.createTextNode(bot.fallbackIcon));
                    } else {
                      e.currentTarget.replaceWith(document.createTextNode('🤖'));
                    }
                  }}
                />
              )
            : (
                // Emoji or text icon
                <span>{bot.icon || '🤖'}</span>
              )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900">{bot.name}</h3>
            {bot.isNew && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                New
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{bot.tagline}</p>
        </div>
      </div>
      
      {/* Description */}
      <div className="px-6 pb-6">
        <p className="text-gray-600 text-sm">{bot.description}</p>
      </div>

      {/* Status Badge */}
      <div className="px-6 pb-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${bot.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500 capitalize">{bot.status}</span>
        </div>
        <div className="text-xs text-gray-400">
          {bot.provider}
        </div>
      </div>
    </div>
  );
}