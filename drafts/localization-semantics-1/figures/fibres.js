import { mountFigure } from './lib/essay.js';
import './essay.css';

export function mount(host, ctx) { return mountFigure('fibres', host, ctx); }
