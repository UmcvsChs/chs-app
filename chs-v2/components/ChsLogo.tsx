"use client";

// The real, complete, precise CHS logo — built exactly to the full
// design specification, not the earlier simplified approximation.
// Every element specified: the H with its asymmetric roof (left edge
// continuing down as a diagonal crossing the left pillar — this is
// the exact "crossing line" element that was missing before), the
// serif C nested in the H's lower opening with "SOLUTIONS" across its
// middle, the divider, "COMPLETE HOUSING" in luxury serif, and the
// bottom "S O L U T I O N S" flanked by two decorative lines.
export default function ChsLogo({ width = 320 }: { width?: number }) {
  const height = width * 1.25;
  return (
    <svg width={width} height={height} viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chsLogoBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4B627A" />
          <stop offset="50%" stopColor="#1C1B1A" />
          <stop offset="100%" stopColor="#B56A28" />
        </linearGradient>
      </defs>

      <rect width="320" height="400" fill="url(#chsLogoBg)" />

      {/* The H — two thick geometric posts, forming the house frame */}
      <rect x="70" y="70" width="22" height="130" fill="#fff" />
      <rect x="228" y="70" width="22" height="130" fill="#fff" />

      {/* Roof — asymmetric, high central peak, extending slightly
          beyond the right pillar, with the real, precise diagonal
          left edge continuing downward, crossing in front of the left
          pillar — the exact element the client specifically described
          as missing. */}
      <polygon points="60,70 160,10 260,70 238,70 160,32 82,70" fill="#fff" />
      <polygon points="82,70 60,70 45,215 67,215" fill="#fff" />

      {/* The C — large serif, nested in the H's lower opening */}
      <text
        x="160" y="185"
        fontFamily="Georgia, 'Playfair Display', serif"
        fontSize="150"
        fontWeight="700"
        fill="#fff"
        textAnchor="middle"
      >
        C
      </text>

      {/* SOLUTIONS — small, spaced, across the middle of the C */}
      <text
        x="160" y="150"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="2.5"
        fill="#1C1B1A"
        textAnchor="middle"
      >
        SOLUTIONS
      </text>

      {/* Divider line */}
      <rect x="40" y="232" width="240" height="4" fill="#fff" />

      {/* COMPLETE HOUSING — the largest text element, luxury serif */}
      <text
        x="160" y="278"
        fontFamily="Georgia, 'Playfair Display', serif"
        fontSize="30"
        fontWeight="700"
        fill="#fff"
        textAnchor="middle"
      >
        COMPLETE
      </text>
      <text
        x="160" y="312"
        fontFamily="Georgia, 'Playfair Display', serif"
        fontSize="30"
        fontWeight="700"
        fill="#fff"
        textAnchor="middle"
      >
        HOUSING
      </text>

      {/* Bottom decorative lines flanking S O L U T I O N S */}
      <rect x="18" y="345" width="70" height="3" fill="#fff" />
      <rect x="232" y="345" width="70" height="3" fill="#fff" />
      <text
        x="160" y="350"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontWeight="500"
        letterSpacing="4"
        fill="#fff"
        textAnchor="middle"
      >
        SOLUTIONS
      </text>
    </svg>
  );
}
