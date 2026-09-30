import roseIcon from "@/assets/rose-icon.png";

interface RotatingBadgeProps {
  text?: string;
  className?: string;
  color?: string; // цвет текста и иконки (hex)
}

export function RotatingBadge({ text = "ваш надёжный партнёр", className = "", color }: RotatingBadgeProps) {
  // Две полные фразы по кругу. Радиус пути увеличен, кегль/трекинг подогнаны под длину.
  const phrase = text.trim().toUpperCase();
  const displayText = `${phrase}  •  ${phrase}  •  `;

  const textStyle = color
    ? { fontSize: "5.8px", letterSpacing: "0.6px", fill: color }
    : { fontSize: "5.8px", letterSpacing: "0.6px" };

  const textClassName = color
    ? "font-medium"
    : "fill-foreground font-medium";

  const isWhite = color && /^#(fff|ffffff)$/i.test(color.replace(/\s/g, ''));
  const isBlue = color && color.toLowerCase() === '#0047bb';
  const iconFilter = !color || isWhite
    ? 'brightness(0) invert(1)'
    : isBlue
      ? 'brightness(0) saturate(100%) invert(15%) sepia(100%) saturate(5000%) hue-rotate(210deg) brightness(95%)'
      : 'brightness(0) invert(1)';

  return (
    <div className={`relative w-24 h-24 sm:w-32 sm:h-32 md:w-44 md:h-44 ${className}`}>
      <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 100 100">
        <defs>
          {/* Больше длина окружности → две фразы полностью помещаются */}
          <path id="circlePath" d="M 50,50 m -43,0 a 43,43 0 1,1 86,0 a 43,43 0 1,1 -86,0" fill="none" />
        </defs>
        <text className={textClassName} style={textStyle}>
          <textPath href="#circlePath" startOffset="0%" textLength="270" lengthAdjust="spacing">
            {displayText}
          </textPath>
        </text>
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={roseIcon}
          alt="Rose"
          className="w-12 h-12 sm:w-16 sm:h-16 md:w-28 md:h-28 object-contain"
          style={{ filter: iconFilter }}
        />
      </div>
    </div>
  );
}
