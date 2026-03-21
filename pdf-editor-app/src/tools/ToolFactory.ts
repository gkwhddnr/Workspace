// ToolFactory.ts
// Factory Method: creates the correct DrawingToolStrategy for a given tool type.
// PdfViewer calls ToolFactory.create(activeTool) and delegates all drawing
// behaviour to the returned strategy, eliminating if/else chains.

import { DrawingTool, DrawingToolStrategy } from './DrawingToolStrategy';
import { PenToolStrategy } from './PenToolStrategy';
import { HighlightToolStrategy } from './HighlightToolStrategy';
import { ShapeToolStrategy } from './ShapeToolStrategy';
import { ArrowToolStrategy } from './ArrowToolStrategy';
import { EraserToolStrategy } from './EraserToolStrategy';
import { ImageToolStrategy } from './ImageToolStrategy';

// Cache instances — strategies are stateless, so singletons are safe.
const strategyCache = new Map<DrawingTool, DrawingToolStrategy>();

export class ToolFactory {
    static create(tool: DrawingTool): DrawingToolStrategy {
        if (strategyCache.has(tool)) {
            return strategyCache.get(tool)!;
        }

        let strategy: DrawingToolStrategy;

        switch (tool) {
            case 'pen':
                strategy = new PenToolStrategy();
                break;
            case 'highlight':
                strategy = new HighlightToolStrategy();
                break;
            case 'rect':
                strategy = new ShapeToolStrategy('rect');
                break;
            case 'circle':
                strategy = new ShapeToolStrategy('circle');
                break;
            case 'arrow-up':
            case 'arrow-down':
            case 'arrow-left':
            case 'arrow-right':
            case 'arrow-l-1':
            case 'arrow-l-2':
                strategy = new ArrowToolStrategy(tool);
                break;
            case 'eraser':
                strategy = new EraserToolStrategy();
                break;
            case 'image':
                strategy = new ImageToolStrategy();
                break;
            default:
                // 'select' and 'text' do not draw vector annotations.
                // Return a no-op strategy to avoid null checks in PdfViewer.
                strategy = new EraserToolStrategy(); // harmless no-op for non-drawing tools
        }

        strategyCache.set(tool, strategy);
        return strategy;
    }
}
