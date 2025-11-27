# Space Invaders

A modern take on the classic Space Invaders arcade game, built with PixiJS and TypeScript.

## Live Demo

**Play it now: [https://adamu.dev/space-invaders/](https://adamu.dev/space-invaders/)**

## Features

- **Classic Gameplay**: Defend against waves of descending alien invaders
- **Progressive Difficulty**: Each level increases enemy speed and bomb frequency
- **Power-ups**: Collect special abilities to enhance your firepower
  - **Laser**: Powerful beam that destroys all enemies in its path
  - **Rapid Fire**: Shoot bullets at 5x the normal rate
  - **Triple Shot**: Fire three bullets in a spread pattern that bounce off walls
- **Lives System**: Start with 3 lives and try to survive as long as possible
- **Sound Effects**: Immersive audio for shooting, explosions, and power-ups
- **Responsive Controls**: Smooth keyboard controls for precise movement

## How to Play

- **Arrow Keys**: Move left and right
- **Spacebar**: Shoot
- **R**: Restart game (when game over)

## Technologies Used

- [PixiJS](https://pixijs.com/) - 2D rendering engine
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Build tool and dev server

## Local Development

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd space-invaders

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open in your browser at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

This project is configured for automatic deployment to GitHub Pages via GitHub Actions. Every push to the `main` branch triggers a new deployment.

## License

ISC
