export type CreationMode = 'style' | 'template' | 'prompt';

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  emoji: string;
  prompt: string;
}

export const styles: CatalogItem[] = [
  { id: 'anime', title: 'Anime', description: 'Crisp expressive character art', emoji: '🌸', prompt: 'premium anime character portrait, expressive eyes, cinematic light' },
  { id: 'comic', title: 'Comic Book', description: 'Bold ink and dramatic colour', emoji: '💥', prompt: 'high-end comic book cover portrait, dynamic inks, halftone accents' },
  { id: 'cyberpunk', title: 'Cyberpunk', description: 'Neon city hero portrait', emoji: '🌃', prompt: 'cinematic cyberpunk portrait, neon city, futuristic clothing, rim light' },
  { id: 'royal', title: 'Royal Portrait', description: 'Regal museum-style painting', emoji: '👑', prompt: 'regal royal oil portrait, ornate clothing, museum lighting' },
  { id: 'watercolour', title: 'Watercolour', description: 'Soft handmade washes', emoji: '🎨', prompt: 'delicate watercolour portrait, premium paper texture, soft colour washes' },
  { id: 'oil', title: 'Oil Painting', description: 'Rich classical brushwork', emoji: '🖼️', prompt: 'classical oil painting portrait, rich brushwork, gallery finish' },
  { id: '3d', title: '3D Character', description: 'Friendly animated-film look', emoji: '✨', prompt: 'premium stylised 3D animated character portrait, soft cinematic lighting' },
  { id: 'scifi', title: 'Sci-Fi Hero', description: 'Epic future explorer', emoji: '🚀', prompt: 'epic science-fiction hero portrait, advanced suit, cinematic atmosphere' },
  { id: 'fantasy', title: 'Fantasy Warrior', description: 'Legendary magical character', emoji: '⚔️', prompt: 'fantasy warrior portrait, elegant armour, magical environment' },
  { id: 'vintage', title: 'Vintage Film', description: 'Timeless analogue cinema', emoji: '🎞️', prompt: 'vintage cinematic portrait, analogue film grain, timeless lighting' },
  { id: 'pencil', title: 'Pencil Sketch', description: 'Detailed graphite drawing', emoji: '✏️', prompt: 'high-detail graphite pencil portrait, fine shading, clean paper' },
  { id: 'pop', title: 'Neon Pop Art', description: 'Bright exhibition statement', emoji: '⚡', prompt: 'neon pop-art portrait, bold graphic shapes, vibrant gallery composition' }
];

export const templates: CatalogItem[] = [
  { id: 'magazine', title: 'Magazine Cover', description: 'Editorial cover composition', emoji: '📰', prompt: 'luxury magazine cover portrait with tasteful editorial layout' },
  { id: 'movie', title: 'Movie Poster', description: 'Cinematic blockbuster poster', emoji: '🎬', prompt: 'cinematic movie poster portrait, dramatic composition and lighting' },
  { id: 'superhero', title: 'Superhero Card', description: 'Collectible hero artwork', emoji: '🦸', prompt: 'premium superhero collectible card portrait, heroic pose' },
  { id: 'future-id', title: 'Futuristic ID', description: 'Sleek holographic identity card', emoji: '🪪', prompt: 'futuristic holographic identity card portrait, minimal interface graphics' },
  { id: 'space', title: 'Space Explorer', description: 'Astronaut mission portrait', emoji: '🧑‍🚀', prompt: 'space explorer mission portrait, modern astronaut suit, stars' },
  { id: 'graduate', title: 'Graduation Portrait', description: 'Celebratory academic keepsake', emoji: '🎓', prompt: 'premium graduation portrait, academic gown, celebratory lighting' },
  { id: 'champion', title: 'Sports Champion', description: 'Powerful athlete poster', emoji: '🏆', prompt: 'sports champion portrait, stadium lights, victory atmosphere' },
  { id: 'leader', title: 'Historical Leader', description: 'Dignified period portrait', emoji: '🏛️', prompt: 'dignified historical leader portrait, period clothing, respectful composition' },
  { id: 'festival', title: 'Festival Greeting', description: 'Warm celebratory card', emoji: '🎉', prompt: 'elegant festival greeting portrait, warm lights and celebratory decoration' }
];

export const negativePrompt = 'Preserve one person and recognisable identity. Do not distort the face, add people, duplicate features, create asymmetrical eyes, unnatural skin, blur, low resolution, extra fingers, or text unless the template needs it.';
