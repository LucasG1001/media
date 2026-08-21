import { useState } from "react";
import type { ReactNode } from "react";
import { proxied } from "../../utils/imageUrl";

interface CoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  eager?: boolean;
  title?: string;
}

export function CoverImage({ src, alt, className, fallback, eager, title }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = proxied(src);

  // Guardar a URL que falhou (e não um booleano) faz o erro se desfazer sozinho
  // quando o item muda — os drawers reaproveitam a mesma instância entre itens.
  if (!resolved || resolved === failedSrc) return <>{fallback ?? null}</>;

  return (
    <img
      className={className}
      src={resolved}
      alt={alt}
      title={title}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSrc(resolved)}
    />
  );
}
