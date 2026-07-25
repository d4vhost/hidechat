import { useState, useEffect } from 'react';

const COLORS = [
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-red-600',
  'bg-orange-600'
];

export function useChatColor() {
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    const savedColor = localStorage.getItem('chatColor');
    if (savedColor && COLORS.includes(savedColor)) {
      setColor(savedColor);
    }

    const handleStorageChange = () => {
      const updatedColor = localStorage.getItem('chatColor');
      if (updatedColor && COLORS.includes(updatedColor)) {
        setColor(updatedColor);
      }
    };

    window.addEventListener('chatColorChanged', handleStorageChange);
    return () => window.removeEventListener('chatColorChanged', handleStorageChange);
  }, []);

  const changeColor = (newColor: string) => {
    setColor(newColor);
    localStorage.setItem('chatColor', newColor);
    window.dispatchEvent(new Event('chatColorChanged'));
  };

  return { color, changeColor, availableColors: COLORS };
}
