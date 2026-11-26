// CANYON GLIDER — the HUD. DOM, not canvas: crisp text at any size, and
// the "instruments lit" look comes from glowing gauges and a compass strip.
// Text updates are throttled to 10 Hz; gauge bars move every frame via
// transform, which is cheap. All ids must exist in index.html.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $('hud-score'),
    best: $('hud-best'),
    combo: $('hud-combo'),
    alt: $('hud-alt'),
    altFill: $('hud-alt-fill'),
    speed: $('hud-speed'),
    speedFill: $('hud-speed-fill'),
    heading: $('hud-heading'),
    compass: $('hud-compass'),
    fuelFill: $('hud-fuel-fill'),
    fuelText: $('hud-fuel-text'),
    throttleFill: $('hud-throttle-fill'),
    damage: $('hud-damage'),
    missions: $('hud-missions'),
    banner: $('hud-banner'),
    bannerTitle: $('hud-banner-title'),
    bannerSub: $('hud-banner-sub'),
    overlayMenu: $('overlay-menu'),
    overlayOver: $('overlay-over'),
    overScore: $('over-score'),
    overBest: $('over-best'),
    overStats: $('over-stats'),
    menuBest: $('menu-best'),
    toast: $('hud-toast'),
  };
  let textTimer = 0;
  let bannerTimer = 0;
  let toastTimer = 0;

  function compassLabel(heading) {
    const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const label = points[Math.round(deg / 45) % 8];
    return `${String(Math.round(deg)).padStart(3, '0')}° ${label}`;
  }

  function update(game, dt) {
    const f = game.flight;
    // gauges every frame (cheap transforms)
    if (el.altFill) el.altFill.style.transform = `scaleY(${Math.max(0, Math.min(1, f.pos.y / 95))})`;
    if (el.speedFill) el.speedFill.style.transform = `scaleX(${Math.max(0, Math.min(1, f.speed / 70))})`;
    if (el.fuelFill) {
      el.fuelFill.style.transform = `scaleX(${Math.max(0, f.fuel / 100)})`;
      el.fuelFill.classList.toggle('low', f.fuel < 25);
    }
    if (el.throttleFill) el.throttleFill.style.transform = `scaleX(${f.throttle})`;
    if (el.compass) {
      const deg = ((f.heading * 180) / Math.PI % 360 + 360) % 360;
      el.compass.style.transform = `translateX(${-(deg / 360) * 360}px)`;
    }
    // text at 10 Hz
    textTimer -= dt;
    if (textTimer > 0) return;
    textTimer = 0.1;
    if (el.score) el.score.textContent = String(Math.floor(game.score));
    document.title = `Canyon Glider — ${Math.floor(game.score)} pts`;
    if (el.best) el.best.textContent = `BEST ${Math.floor(game.best)}`;
    if (el.combo) {
      el.combo.textContent = game.combo > 1 ? `COMBO x${game.combo.toFixed(1)}` : '';
      el.combo.classList.toggle('hot', game.combo >= 2.5);
    }
    if (el.alt) el.alt.textContent = `${Math.max(0, Math.round(f.pos.y))} m`;
    if (el.speed) el.speed.textContent = `${Math.round(f.speed * 3.6)} km/h`;
    if (el.heading) el.heading.textContent = compassLabel(f.heading);
    if (el.fuelText) el.fuelText.textContent = `${Math.round(f.fuel)}%`;
    if (el.damage) {
      el.damage.textContent = '♥'.repeat(Math.max(0, 3 - f.damage)) + '♡'.repeat(f.damage);
      el.damage.classList.toggle('hurt', f.damage > 0);
    }
    if (el.missions) {
      el.missions.innerHTML = game.missions
        .map((m) => `<div class="mission${m.done ? ' done' : ''}"><span>${m.label}</span><b>${Math.floor(Math.min(m.progress, m.goal))}/${m.goal}</b></div>`)
        .join('');
    }
    if (bannerTimer > 0) {
      bannerTimer -= 0.1;
      if (bannerTimer <= 0 && el.banner) el.banner.classList.remove('show');
    }
    if (toastTimer > 0) {
      toastTimer -= 0.1;
      if (toastTimer <= 0 && el.toast) el.toast.classList.remove('show');
    }
  }

  function showBanner(title, sub = '') {
    if (!el.banner) return;
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub;
    el.banner.classList.add('show');
    bannerTimer = 2.2;
  }

  function showToast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.classList.add('show');
    toastTimer = 1.6;
  }

  function showMenu(best) {
    if (el.overlayMenu) el.overlayMenu.classList.remove('hidden');
    if (el.overlayOver) el.overlayOver.classList.add('hidden');
    if (el.menuBest) el.menuBest.textContent = best > 0 ? `Best score: ${Math.floor(best)}` : 'Your first flight awaits';
  }

  function showGameOver(score, best, stats) {
    if (el.overlayOver) el.overlayOver.classList.remove('hidden');
    if (el.overlayMenu) el.overlayMenu.classList.add('hidden');
    if (el.overScore) el.overScore.textContent = String(Math.floor(score));
    if (el.overBest) el.overBest.textContent = `Best: ${Math.floor(best)}`;
    if (el.overStats) el.overStats.textContent = stats;
  }

  function hideOverlays() {
    if (el.overlayMenu) el.overlayMenu.classList.add('hidden');
    if (el.overlayOver) el.overlayOver.classList.add('hidden');
  }

  return { update, showBanner, showToast, showMenu, showGameOver, hideOverlays };
}
