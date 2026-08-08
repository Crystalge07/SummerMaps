type Props = {
  photoUrl: string;
  size?: number;
  borderColor?: string;
  isOwn?: boolean;
  className?: string;
};

/** Circular photo marker face for map pins — the photo itself is the pin. */
export function PhotoPin({
  photoUrl,
  size = 40,
  borderColor = "#fff",
  isOwn = false,
  className = "",
}: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt=""
      className={`photo-pin${isOwn ? " own" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        borderColor: isOwn ? undefined : borderColor,
      }}
    />
  );
}
