// Botões magnéticos (adaptado do MagneticButton do CinematicFooter, sem GSAP): o botão segue o mouse e,
// ao sair, volta com uma mola elástica (a elastic.out(1, 0.3) do GSAP, amostrada como CSS linear()).
// Só com mouse; com movimento reduzido, nada acontece.

/** elastic.out(1, 0.3) do GSAP amostrada como easing CSS. */
function elasticEasing(samples = 60): string {
  const p = 0.3;
  const s = p / 4;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const v = t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
    pts.push(String(+v.toFixed(4)));
  }
  return `linear(${pts.join(', ')})`;
}

let spring: string | null = null;

export function magnetize(elements: Iterable<HTMLElement>): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  spring ??= CSS.supports('transition-timing-function', 'linear(0, 1)')
    ? elasticEasing()
    : 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  for (const el of elements) {
    const base = getComputedStyle(el).transition;
    const keep = base && base !== 'all 0s ease 0s' ? `${base}, ` : '';
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transition = `${keep}transform 0.4s cubic-bezier(0.33, 1, 0.68, 1)`;
      el.style.transform = `perspective(600px) translate(${x * 0.4}px, ${y * 0.4}px) rotateX(${-y * 0.15}deg) rotateY(${x * 0.15}deg) scale(1.05)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = `${keep}transform 1.2s ${spring}`;
      el.style.transform = '';
    });
  }
}
