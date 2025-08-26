// Enhanced unified player color management system for consistent colors across components

// Premium colors for player slices - optimized for visibility and contrast
export const PLAYER_COLORS = [
  '#667eea', // Purple-blue - High contrast
  '#f5576c', // Pink-red - Vibrant
  '#00d4ff', // Bright cyan - Enhanced visibility 
  '#38f9d7', // Green-cyan - Good contrast
  '#ffd700', // Gold yellow - Better visibility
  '#ff69b4', // Hot pink - More vibrant
  '#9370db', // Medium purple
  '#ff8c00', // Dark orange
  '#dc143c', // Crimson
  '#4169e1', // Royal blue
  '#ff1493', // Deep pink
  '#20b2aa', // Light sea green
  '#ff6347', // Tomato
  '#00bfff', // Deep sky blue
  '#ba55d3', // Medium orchid
  '#32cd32', // Lime green
  '#ff4500', // Orange red
  '#8a2be2', // Blue violet
  '#00ced1', // Dark turquoise
  '#ff0000', // Pure red
  '#00ff7f', // Spring green - 100% slice visibility
  '#ff6495', // Hot pink variant
  '#4682b4', // Steel blue
  '#daa520', // Goldenrod
  '#ff1493'  // Deep pink variant
];

// Enhanced color validation and debugging
export const validateColorContrast = (colors: string[]): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const colorMap = new Map<string, number>();
  
  colors.forEach((color, index) => {
    if (colorMap.has(color)) {
      issues.push(`Duplicate color ${color} at indices ${colorMap.get(color)} and ${index}`);
    } else {
      colorMap.set(color, index);
    }
    
    // Enhanced color validation
    const hex = color.replace('#', '');
    if (hex.length !== 6) {
      issues.push(`Invalid hex color format: ${color}`);
      return;
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    if (brightness < 50) {
      issues.push(`Color ${color} may be too dark for text visibility (brightness: ${brightness.toFixed(1)})`);
    }
    if (brightness > 220) {
      issues.push(`Color ${color} may be too light for wheel visibility (brightness: ${brightness.toFixed(1)})`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
};

// Create a stable color assignment based on username hash with enhanced distribution
export const getPlayerColor = (username: string): string => {
  // Enhanced hash function for better distribution
  let hash = 5381; // DJB2 hash algorithm
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
  }
  
  // Use absolute value and ensure we stay within bounds
  const colorIndex = Math.abs(hash) % PLAYER_COLORS.length;
  const selectedColor = PLAYER_COLORS[colorIndex];
  
  // Enhanced debug logging for color assignment
  console.log(`🎨 Color assignment for ${username}:`, {
    username,
    hash,
    colorIndex,
    selectedColor,
    totalColors: PLAYER_COLORS.length,
    hashAsHex: hash.toString(16)
  });
  
  return selectedColor;
};

// Get multiple colors for a group, ensuring no duplicates within the group
export const getUniqueColorsForGroup = (usernames: string[]): Map<string, string> => {
  const colorMap = new Map<string, string>();
  const usedColors = new Set<string>();
  
  // Sort usernames for consistent ordering
  const sortedUsernames = [...usernames].sort();
  
  console.log('🎨 getUniqueColorsForGroup called with:', sortedUsernames);
  
  sortedUsernames.forEach((username, index) => {
    let color = getPlayerColor(username);
    let attempts = 0;
    
    // If color is already used in this group, find an alternative
    while (usedColors.has(color) && attempts < PLAYER_COLORS.length) {
      // Use a different index based on the attempt number
      const fallbackIndex = (Math.abs(username.length + attempts) * 7) % PLAYER_COLORS.length;
      color = PLAYER_COLORS[fallbackIndex];
      attempts++;
    }
    
    colorMap.set(username, color);
    usedColors.add(color);
    
    if (attempts > 0) {
      console.log(`🔄 Color conflict resolved for ${username}: used fallback after ${attempts} attempts`);
    }
  });
  
  // Validate no duplicates in final result
  const colorValues = Array.from(colorMap.values());
  const uniqueColors = new Set(colorValues);
  if (colorValues.length !== uniqueColors.size) {
    console.error('❌ CRITICAL: Duplicate colors detected after resolution!');
  }
  
  return colorMap;
};

// Enhanced function to add colors to a list of players with better consistency
export const addColorsToPlayers = <T extends { username: string }>(players: T[]): (T & { color: string })[] => {
  console.group('🎨 addColorsToPlayers Enhanced Processing');
  console.log('Input players:', players.length, 'players');
  console.log('Player usernames:', players.map(p => p.username));
  
  // Validate colors first
  const validation = validateColorContrast(PLAYER_COLORS);
  if (!validation.valid) {
    console.warn('⚠️ Color validation issues detected:', validation.issues);
  }
  
  // Get unique colors for this group to prevent conflicts
  const uniqueColors = getUniqueColorsForGroup(players.map(p => p.username));
  
  const result = players.map((player, index) => {
    const color = uniqueColors.get(player.username);
    
    if (!color) {
      console.error(`❌ No color assigned for player: ${player.username}`);
      // Fallback to a default color
      const fallbackColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
      return {
        ...player,
        color: fallbackColor
      };
    }
    
    console.log(`✅ Player ${index + 1} (${player.username}):`, {
      assignedColor: color,
      colorIndex: PLAYER_COLORS.indexOf(color)
    });
    
    return {
      ...player,
      color
    };
  });
  
  // Additional validation: check for duplicates in final result
  const finalColors = result.map(p => p.color);
  const colorCounts = new Map<string, number>();
  finalColors.forEach(color => {
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  });
  
  const duplicates = Array.from(colorCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.error('❌ CRITICAL: Duplicate colors detected in final result:', duplicates);
    
    // Store debug info for testing
    (window as any).colorAssignmentError = {
      duplicates,
      finalColors,
      players: players.map(p => p.username),
      timestamp: new Date().toISOString()
    };
  } else {
    console.log('✅ All colors unique in final result');
  }
  
  // Store debug info globally for testing
  (window as any).colorDebugInfo = {
    inputPlayers: players,
    finalResult: result,
    validation,
    uniqueColors: Object.fromEntries(uniqueColors),
    timestamp: new Date().toISOString()
  };
  
  console.groupEnd();
  return result;
};

// Utility function to get color statistics for debugging
export const getColorStatistics = (players: { username: string; color: string }[]) => {
  const stats = {
    totalPlayers: players.length,
    uniqueColors: new Set(players.map(p => p.color)).size,
    colorDistribution: {} as Record<string, number>,
    duplicateColors: [] as string[],
    validColors: 0,
    invalidColors: 0
  };
  
  players.forEach(player => {
    const color = player.color;
    stats.colorDistribution[color] = (stats.colorDistribution[color] || 0) + 1;
    
    if (PLAYER_COLORS.includes(color)) {
      stats.validColors++;
    } else {
      stats.invalidColors++;
    }
  });
  
  // Find duplicates
  Object.entries(stats.colorDistribution).forEach(([color, count]) => {
    if (count > 1) {
      stats.duplicateColors.push(color);
    }
  });
  
  return stats;
};