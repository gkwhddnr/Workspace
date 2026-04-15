// GraphicStyle.ts

/**
 * Flyweight Pattern: GraphicStyle
 * 
 * Encapsulates visual properties that are frequently shared among many elements.
 * This saves memory and provides a single point of truth for style modifications.
 */
export class GraphicStyle {
    constructor(
        public readonly color: string = '#000000',
        public readonly strokeWidth: number = 2,
        public readonly opacity: number = 1.0,
        public readonly isDashed: boolean = false,
        public readonly arrowHeadSize: number = 12
    ) {}

    /**
     * Helper to create a new style while changing only some properties.
     */
    copy(updates: Partial<GraphicStyle>): GraphicStyle {
        return new GraphicStyle(
            updates.color ?? this.color,
            updates.strokeWidth ?? this.strokeWidth,
            updates.opacity ?? this.opacity,
            updates.isDashed ?? this.isDashed,
            updates.arrowHeadSize ?? this.arrowHeadSize
        );
    }

    /**
     * Simple identity comparison for cache/pooling potential.
     */
    equals(other: GraphicStyle): boolean {
        return this.color === other.color &&
               this.strokeWidth === other.strokeWidth &&
               this.opacity === other.opacity &&
               this.isDashed === other.isDashed &&
               this.arrowHeadSize === other.arrowHeadSize;
    }
}
