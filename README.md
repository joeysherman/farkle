# 🎲 Farkle

<div align="center">

![Farkle Game Banner](path/to/your/banner.png)

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.48.1-181818?style=flat-square&logo=supabase)](https://supabase.com/)

A modern, interactive implementation of the classic dice game Farkle, built with React and Three.js.

</div>

## 🎮 About Farkle

Farkle is a classic dice game that combines luck and strategy. Players roll six dice and must decide which combinations to keep and which to re-roll to maximize their score. The game features:

- 3D dice physics using React Three Fiber
- Multiplayer support with real-time updates
- Beautiful animations and visual effects
- Score tracking and statistics
- Customizable game rules
- Responsive design for all devices

## 🚀 Features

- 🎲 Realistic 3D dice rolling with physics
- 👥 Real-time multiplayer gameplay
- 📊 Comprehensive scoring system
- 🎨 Modern, responsive UI
- 🌐 Internationalization support
- 📱 Mobile-friendly design
- 🎮 Customizable game rules
- 📈 Player statistics and leaderboards

## 📸 Screenshots

<div align="center">
  <img src="path/to/your/screenshot1.png" alt="Farkle Game Screenshot 1" width="400"/>
  <img src="path/to/your/screenshot2.png" alt="Farkle Game Screenshot 2" width="400"/>
</div>

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm

### Installation

1. Clone the repository

```bash
git clone https://github.com/joeysherman/farkle.git
cd farkle
```

2. Install dependencies

```bash
pnpm install
```

3. Set up environment variables

```bash
cp .env.example .env
```

4. Start the development server

```bash
pnpm dev
```

## 🎯 How to Play

1. Each player takes turns rolling six dice
2. After each roll, you must set aside at least one scoring combination
3. You can continue rolling the remaining dice to add to your score
4. If you can't make any scoring combinations, you "Farkle" and lose your points for that turn
5. First player to reach the target score (default: 10,000) wins!

### Scoring Rules

- Three of a kind: 100 × dice value
- Four of a kind: 1000 points
- Five of a kind: 2000 points
- Six of a kind: 3000 points
- Three pairs: 1500 points
- Straight (1-6): 1500 points
- Single 1s: 100 points each
- Single 5s: 50 points each

## 📁 Project Structure

```
src/
├── assets/        # Game assets and resources
├── components/    # Reusable UI components
├── features/      # Game-specific features
├── hooks/         # Custom React hooks
├── lib/          # Library configurations
├── pages/        # Game pages and views
├── routes/       # Route definitions
├── services/     # Game services and API
├── store/        # Game state management
├── styles/       # Global styles
├── types/        # TypeScript definitions
└── utils/        # Utility functions
```

## 🧪 Testing

```bash
# Run unit tests
pnpm test:unit

# Run unit tests with coverage
pnpm test:unit:coverage

# Run E2E tests
pnpm test:e2e
```

## 📚 Documentation

For detailed game rules and API documentation, please visit our [documentation site](path/to/your/docs).

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated. Please check our [issues page](path/to/your/issues) for current tasks.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vite React Boilerplate](https://github.com/RicardoValdovinos/vite-react-boilerplate) for the excellent project structure
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) for the amazing 3D capabilities
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- All contributors and testers who helped improve the game

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/yourusername">Your Name</a></sub>
</div>
