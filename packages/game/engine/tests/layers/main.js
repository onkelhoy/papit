import { GameEngine, InputEvents } from '@papit/game-engine';

window.GameEngine = GameEngine;
window.InputEvents = InputEvents;
window.warnings = [];
console.warn = message => window.warnings.push(message);
