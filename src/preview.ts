// Dev-only page (figures.html) that shows every character, front and back.
import { PACKS } from './game/packs';
import { getSprite } from './figures/sprites';

const out = document.getElementById('out')!;
for (const pack of PACKS) {
  const h = document.createElement('h3');
  h.textContent = pack.name;
  out.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  for (const ch of pack.chars) {
    for (const view of ['front', 'back'] as const) {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = getSprite(ch, view).canvas.toDataURL();
      fig.append(img, Object.assign(document.createElement('figcaption'), { textContent: `${ch.name} (${view})` }));
      row.appendChild(fig);
    }
  }
  out.appendChild(row);
}
