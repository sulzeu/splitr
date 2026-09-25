import React from "react";

type Props = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
};

export function Button({ label, onClick, variant = "primary", disabled, style }: Props) {
  return (
    <button
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {label}
    </button>
  );
}
