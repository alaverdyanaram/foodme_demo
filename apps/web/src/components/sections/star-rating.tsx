import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Read-only stars for a given rating. Exposed to screen readers as one image
 * ("Rated 4 out of 5 stars") instead of five separate icons.
 */
export function StarRatingDisplay({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
      className={cn("sr_display inline-flex items-center gap-0.5", className)}
    >
      {STARS.map((value) => (
        <Star
          key={value}
          size={size}
          aria-hidden="true"
          className={value <= rating ? "text-amber-500" : "text-zinc-300"}
          fill={value <= rating ? "currentColor" : "none"}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

/**
 * Star picker built on native radio inputs, so mouse, touch, keyboard (Tab into the
 * group, arrow keys to change) and screen readers all work without extra wiring (R24).
 */
export function StarRatingInput({
  value,
  onChange,
  disabled,
  label = "Rating",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const name = useId();
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className="sr_input" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {STARS.map((star) => {
          const id = `${name}-${star}`;
          return (
            <span key={star}>
              <input
                id={id}
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                onMouseEnter={() => setHovered(star)}
                className={cn(
                  "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform",
                  "hover:scale-110 active:scale-95",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 peer-focus-visible:ring-offset-2",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="sr-only">{star === 1 ? "1 star" : `${star} stars`}</span>
                <Star
                  size={30}
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={star <= shown ? "text-amber-500" : "text-zinc-300"}
                  fill={star <= shown ? "currentColor" : "none"}
                />
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
