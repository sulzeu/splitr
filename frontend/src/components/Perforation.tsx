
export function Perforation({ marginVertical }: { marginVertical?: number }) {
  return (
    <div
      className="perforation"
      style={marginVertical !== undefined ? { margin: `${marginVertical}px 0` } : undefined}
    />
  );
}
